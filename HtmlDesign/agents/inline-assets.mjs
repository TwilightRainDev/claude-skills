#!/usr/bin/env node
// inline-assets.mjs — write a copy of an HTML page in which every resource the
// page references from a COVERED attribute (list below) or from CSS is replaced
// by a base64 `data:` URI, so the copy is one self-contained file that works
// offline.
//
// Covered references (this list is the contract — nothing outside it is touched):
//   img / source        src, srcset
//   video / audio       src        video: poster
//   track               src
//   script              src
//   SVG <image>, <use>  href, xlink:href
//   link                href — a stylesheet link becomes an inline <style> block
//                       (keeping its media/title/disabled/alternate semantics),
//                       every other link becomes a data: URI
//   any element         style="... url() ..."
//   <style> blocks      url(), and @import expanded recursively (cycle-safe;
//                       layer() / supports() / media conditions preserved)
//
// NOT covered — left exactly as they were, and NOT reported as unresolved:
//   iframe src, embed src, object data, input[type=image] src and any other
//   element/attribute outside the list above; markup inside HTML comments, CSS
//   comments and the raw text elements (script, style, title, textarea, xmp,
//   iframe, noembed, noframes, noscript — none of it is markup to the browser
//   either, so nothing in it loads); resources referenced only from a
//   JavaScript/JSX string.
//
// Remote URLs (http:, https:, //), drive paths (C:\..., C:foo) and UNC paths
// (\\srv\share\...) are not files beside the page, so they are left as they are.
// Those ARE listed on stderr as `left remote:` / `left absolute:` — a page that
// still points at the network or outside the export is then visible, instead of
// being silently shipped as "works offline". Exit stays 0: a remote reference is
// a legitimate reference, not an error.
//
// Why there are hand-written scanners below instead of regexes: in all three
// grammars the markers nest inside each other in real input, and a regex cannot
// tell which state a match sits in.
//   srcset  the URL runs to whitespace and a trailing comma ends the candidate,
//           but a comma is also legal INSIDE a file name (`hero,2x.png`) — so a
//           grammar read comes first and a comma split is only a fallback;
//   CSS     `/*` / `*/` occur inside strings, quotes occur inside comments, and
//           url("a(1).png") has parentheses inside a quoted URL;
//   HTML    `<!--`, `<script`, `<style` inside a quoted attribute value must
//           stay text, and a comment ends only where the tokenizer says it does
//           (`-->`, `--!>`, or an abrupt close) — a region that runs long
//           swallows every reference after it, silently.
//
// Usage:
//   node inline-assets.mjs <input.html> <output.html>
//
// Relative paths in the HTML resolve against the HTML file's own directory; a
// stylesheet's url() and @import resolve against that stylesheet's directory.
//
// Exit codes: 0 ok; 64 usage error; 1 the run failed — unreadable input, at
// least one unresolved reference, or unwritable output. The output path is
// written only when the whole run succeeds.
//
// Uses node:fs and node:path only — this skill ships no dependencies and must
// never grow a node_modules.

import fs from 'node:fs';
import path from 'node:path';

// --- MIME ---------------------------------------------------------------------

// Only these extensions are mapped. Anything else falls back to
// application/octet-stream so an unexpected type is still inlined rather than
// silently left pointing at a file that will not exist beside the output.
const MIME = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.gif', 'image/gif'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.woff2', 'font/woff2'],
  ['.woff', 'font/woff'],
  ['.ttf', 'font/ttf'],
  ['.otf', 'font/otf'],
  ['.css', 'text/css'],
  ['.js', 'text/javascript'],
  ['.mjs', 'text/javascript'],
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.mp3', 'audio/mpeg'],
  ['.vtt', 'text/vtt'],
]);
const FALLBACK_MIME = 'application/octet-stream';

// --- run state ----------------------------------------------------------------

// Absolute paths of stylesheets currently being expanded. A sheet is added
// BEFORE its body is walked and removed after, so a circular `@import`
// (a.css -> b.css -> a.css) always terminates, while the same sheet referenced
// twice from different places is still expanded twice — CSS semantics, and it
// keeps `<link media="screen">` + `<link media="print">` to one file both alive.
const expanding = new Set();

// Every resource that could not be read, in discovery order, de-duplicated.
const missing = [];
const missKeys = new Set();

// References left alone because they are not files beside the page. Remote and
// absolute ones are reported; data:/#fragment ones are already self-contained
// and stay silent.
const leftOutside = [];
const leftKeys = new Set();

// Assets turned into a data: URI (or, for a stylesheet, expanded inline).
let inlined = 0;

const USAGE = 'Usage: node inline-assets.mjs <input.html> <output.html>\n';

function miss(url, abs, detail) {
  const key = JSON.stringify([abs, url]);
  if (missKeys.has(key)) return;
  missKeys.add(key);
  missing.push(`  - ${url}  ->  ${abs}  (${detail})`);
}

function matchesAt(s, i, word) {
  return s.slice(i, i + word.length).toLowerCase() === word;
}

// 'local'    — a path beside the page, resolve it
// 'remote'   — http(s), protocol-relative //host, or any other scheme: not ours
// 'absolute' — a path outside the page's tree: C:\a, C:/a, C:a, \\srv\share\a
// 'skip'     — already self-contained (data:) or same-document (#fragment)
function classify(url) {
  if (!url) return 'skip';
  if (/^data:/i.test(url)) return 'skip';
  if (url.startsWith('#')) return 'skip';
  if (/^[a-zA-Z]:/.test(url)) return 'absolute'; // 盘符（绝对或相对）
  if (url.startsWith('\\\\')) return 'absolute'; // UNC
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')) return 'remote';
  return 'local';
}

// True when the URL must be left exactly as it is. Remote/absolute cases are
// also recorded, so a run that exits 0 can still say what it did not inline.
function leaveAsIs(url) {
  const kind = classify(url);
  if (kind === 'local') return false;
  if (kind !== 'skip') {
    const key = `${kind} ${url}`;
    if (!leftKeys.has(key)) {
      leftKeys.add(key);
      leftOutside.push(`  - left ${kind}: ${url}`);
    }
  }
  return true;
}

// Absolute path of a local reference (its #fragment peeled off), or null.
function localPath(url, baseDir) {
  if (!url || classify(url) !== 'local') return null;
  const hash = url.indexOf('#');
  const ref = hash === -1 ? url : url.slice(0, hash);
  return ref ? path.resolve(baseDir, ref) : null;
}

// Probe, for the srcset fallback: can this reference be read right now? Changes
// no state (no counter, no miss), so it is safe to ask before committing.
function canInline(url, baseDir) {
  if (!url || classify(url) !== 'local') return true;
  const abs = localPath(url, baseDir);
  if (!abs) return false;
  try {
    return fs.statSync(abs).isFile();
  } catch {
    return false;
  }
}

function dataUriFor(abs, buf) {
  const mime = MIME.get(path.extname(abs).toLowerCase()) || FALLBACK_MIME;
  return `data:${mime};base64,${buf.toString('base64')}`;
}

// Replace one URL with a data: URI. A `#fragment` is peeled off first and
// re-attached after the data: URI: SVG sprites are referenced as
// `sprite.svg#icon` and the fragment has to survive the rewrite. On failure the
// original URL is returned unchanged and the miss is recorded.
function inlineUrl(url, baseDir) {
  if (!url || leaveAsIs(url)) return url;
  const abs = localPath(url, baseDir);
  if (!abs) return url;
  const hash = url.indexOf('#');
  const frag = hash === -1 ? '' : url.slice(hash);
  let buf;
  try {
    buf = fs.readFileSync(abs);
  } catch (e) {
    miss(url, abs, e.code || e.message);
    return url;
  }
  inlined++;
  return dataUriFor(abs, buf) + frag;
}

// --- CSS scanner --------------------------------------------------------------
//
// States: comment, string, code. Only code is rewritten; comments and strings
// are copied through byte for byte. This is what makes `content:"/*"` harmless
// and `/* url(./old.png) */` inert instead of a fatal miss.

const CSS_DQ = '"';
const CSS_SQ = "'";

// End index (just past the closing quote) of the CSS string starting at s[i].
// A backslash escapes the next character; a raw newline ends an unterminated
// string, so the rest of the sheet is still scanned as code.
function endOfCssString(s, i) {
  const q = s[i];
  let j = i + 1;
  while (j < s.length) {
    const c = s[j];
    if (c === '\\') {
      j += 2;
      continue;
    }
    if (c === q) return j + 1;
    if (c === '\n') return j;
    j++;
  }
  return s.length;
}

// The two commonest CSS escapes; `\20`-style hex escapes are left alone (rare
// in a URL, and unescaping them wrongly would be worse).
function unescapeCssUrl(u) {
  return u.replace(/\\(["'()\\\s])/g, '$1');
}

// `url(...)` at s[i]. A quoted URL may contain parentheses; a bare one runs to
// the first `)`. Returns { end, url } or null when it is malformed.
function readUrlFunction(s, i) {
  let j = i + 4;
  while (j < s.length && /\s/.test(s[j])) j++;
  let url;
  if (s[j] === CSS_DQ || s[j] === CSS_SQ) {
    const end = endOfCssString(s, j);
    if (s[end - 1] !== s[j]) return null; // unterminated string
    url = s.slice(j + 1, end - 1);
    j = end;
    while (j < s.length && /\s/.test(s[j])) j++;
  } else {
    const close = s.indexOf(')', j);
    if (close === -1) return null;
    url = s.slice(j, close).trim();
    j = close;
  }
  if (s[j] !== ')') return null;
  return { end: j + 1, url: unescapeCssUrl(url) };
}

function isUrlAt(s, i) {
  if (!matchesAt(s, i, 'url(')) return false;
  return !/[-\w]/.test(s[i - 1] || ''); // 别把 `myurl(` 当成 url(
}

// `@import <url> <modifiers>;` at s[i] — the URL may be quoted or url()-wrapped,
// the modifiers run to the `;` in code state. Returns { end, url, cond } or null.
function parseImport(s, i) {
  let j = i + 7;
  while (j < s.length && /\s/.test(s[j])) j++;
  let url;
  if (isUrlAt(s, j)) {
    const u = readUrlFunction(s, j);
    if (!u) return null;
    url = u.url;
    j = u.end;
  } else if (s[j] === CSS_DQ || s[j] === CSS_SQ) {
    const end = endOfCssString(s, j);
    if (s[end - 1] !== s[j]) return null;
    url = s.slice(j + 1, end - 1);
    j = end;
  } else {
    return null;
  }
  const condStart = j;
  let depth = 0;
  while (j < s.length) {
    const c = s[j];
    if (c === CSS_DQ || c === CSS_SQ) {
      j = endOfCssString(s, j);
      continue;
    }
    if (c === '/' && s[j + 1] === '*') {
      const close = s.indexOf('*/', j + 2);
      j = close === -1 ? s.length : close + 2;
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    else if (c === ';' && depth === 0) return { end: j + 1, url, cond: s.slice(condStart, j) };
    j++;
  }
  return { end: s.length, url, cond: s.slice(condStart) };
}

// Text inside balanced parens starting at s[open] === '('.
function readParens(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') {
      depth--;
      if (!depth) return { inner: s.slice(open + 1, i), end: i + 1 };
    }
  }
  return null;
}

// The modifiers after an @import URL: `layer(...) supports(...) <media query>` in
// that order, any of them optional. Wrapping EVERYTHING in @media turns
// `layer(base)` into the invalid at-rule `@media layer(base)`, which browsers
// drop whole: the rules vanish while the script still reports success. Media
// stays outermost, the others nest inside.
function wrapImport(body, cond) {
  let rest = (cond || '').trim();
  const wrappers = [];
  let m;
  while ((m = /^layer\b\s*(?:\(([^)]*)\))?/i.exec(rest))) {
    const name = (m[1] || '').trim();
    wrappers.push(name ? `@layer ${name}` : '@layer');
    rest = rest.slice(m[0].length).trim();
  }
  while ((m = /^supports\s*\(/i.exec(rest))) {
    const par = readParens(rest, m[0].length - 1);
    if (!par) break;
    wrappers.push(`@supports (${par.inner.trim()})`);
    rest = rest.slice(par.end).trim();
  }
  if (rest) wrappers.push(`@media ${rest}`);
  let out = body;
  for (let i = wrappers.length - 1; i >= 0; i--) out = `${wrappers[i]} {\n${out}\n}`;
  return out;
}

// A stylesheet file, expanded. Returns the CSS text; null when it cannot be read
// (the miss has been recorded); '' when the sheet is already being expanded
// (circular import) or is empty.
function expandCssFile(url, abs) {
  if (expanding.has(abs)) return '';
  let buf;
  try {
    buf = fs.readFileSync(abs);
  } catch (e) {
    miss(url, abs, e.code || e.message);
    return null;
  }
  expanding.add(abs);
  try {
    inlined++;
    return processCss(buf.toString('utf8'), path.dirname(abs), true);
  } finally {
    expanding.delete(abs);
  }
}

// Returns the text to emit, or null to mean "copy the statement verbatim".
function handleImport(imp, baseDir) {
  const url = imp.url;
  if (!url || leaveAsIs(url)) return null; // remote / self-contained: keep it
  const body = expandCssFile(url, localPath(url, baseDir));
  if (body === null) return null; // unreadable: keep it, the run exits 1
  if (!body) return ''; // circular import or empty sheet: drop the statement
  return wrapImport(body, imp.cond);
}

function processCss(css, baseDir, allowImports) {
  let out = '';
  let i = 0;
  while (i < css.length) {
    const c = css[i];
    // Comments are copied verbatim — including an unterminated one, which runs
    // to the end of the sheet.
    if (c === '/' && css[i + 1] === '*') {
      const close = css.indexOf('*/', i + 2);
      const end = close === -1 ? css.length : close + 2;
      out += css.slice(i, end);
      i = end;
      continue;
    }
    if (c === CSS_DQ || c === CSS_SQ) {
      const end = endOfCssString(css, i);
      out += css.slice(i, end);
      i = end;
      continue;
    }
    if (allowImports && matchesAt(css, i, '@import') && !/[-\w]/.test(css[i + 7] || '')) {
      const imp = parseImport(css, i);
      if (imp) {
        const handled = handleImport(imp, baseDir);
        out += handled === null ? css.slice(i, imp.end) : handled;
        i = imp.end;
        continue;
      }
    }
    if (isUrlAt(css, i)) {
      const u = readUrlFunction(css, i);
      if (u) {
        out += u.url && !leaveAsIs(u.url) ? `url(${inlineUrl(u.url, baseDir)})` : css.slice(i, u.end);
        i = u.end;
        continue;
      }
    }
    out += c;
    i++;
  }
  return out;
}

// CSS inlined into a <style> ELEMENT: a literal `</style` would end the element
// early and spill the rest of the sheet into the document as text — a silent
// layout break. `\/` is an escaped `/` in CSS, so this is semantics-preserving.
function styleElementText(css) {
  return css.replace(/<\/style/gi, '<\\/style');
}

// --- srcset -------------------------------------------------------------------

// Grammar read (HTML "parse a srcset attribute"): skip separators, take the URL
// up to whitespace, strip trailing commas — a stripped comma ALSO ends the
// candidate, so what follows is a new candidate and never a descriptor.
function splitSrcset(value) {
  const out = [];
  let i = 0;
  while (i < value.length) {
    while (i < value.length && (/\s/.test(value[i]) || value[i] === ',')) i++;
    if (i >= value.length) break;
    const urlStart = i;
    while (i < value.length && !/\s/.test(value[i])) i++;
    let end = i;
    while (end > urlStart && value[end - 1] === ',') end--;
    const url = value.slice(urlStart, end);
    const endedByComma = end !== i;
    let desc = '';
    if (!endedByComma) {
      const descStart = i;
      let depth = 0;
      while (i < value.length) {
        const c = value[i];
        if (c === '(') depth++;
        else if (c === ')') depth = Math.max(0, depth - 1);
        else if (c === ',' && depth === 0) break;
        i++;
      }
      desc = value.slice(descStart, i).trim();
      if (i < value.length) i++; // step over the terminating comma
    }
    if (url) out.push({ url, desc });
  }
  return out;
}

// The grammar read is the main path. Real input is messier than the grammar in
// both directions: `srcset="a.png,b.png"` (adjacent candidates, no descriptors)
// is read by every browser as two candidates, while `hero,2x.png` is a legal
// file name that must stay one URL. So: use the grammar read when it resolves;
// when it does not and the token does contain a comma, retry once by splitting
// on commas (every piece must resolve); only then record the miss.
function resolveCandidate(cand, baseDir) {
  if (canInline(cand.url, baseDir)) {
    return [{ url: inlineUrl(cand.url, baseDir), desc: cand.desc }];
  }
  if (cand.url.includes(',')) {
    const parts = cand.url.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1 && parts.every((p) => canInline(p, baseDir))) {
      return parts.map((p, idx) => ({
        url: inlineUrl(p, baseDir),
        desc: idx === parts.length - 1 ? cand.desc : '',
      }));
    }
  }
  inlineUrl(cand.url, baseDir); // records the miss
  return [{ url: cand.url, desc: cand.desc }];
}

function rewriteSrcset(value, baseDir) {
  return splitSrcset(value)
    .flatMap((cand) => resolveCandidate(cand, baseDir))
    .map((c) => [c.url, c.desc].filter(Boolean).join(' '))
    .join(', ');
}

// --- attributes ---------------------------------------------------------------

// Attribute name, plus an OPTIONAL value: `disabled` carries no value and is
// invisible to a value-only pattern, yet it decides whether a stylesheet is
// applied at all.
const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g;

// Which attribute of which element carries a resource URL.
const URL_ATTRS = {
  img: new Set(['src']),
  source: new Set(['src']),
  video: new Set(['src', 'poster']),
  audio: new Set(['src']),
  track: new Set(['src']),
  script: new Set(['src']),
  image: new Set(['href', 'xlink:href']), // SVG <image>
  use: new Set(['href', 'xlink:href']), // SVG <use href="sprite.svg#icon">
};
const SRCSET_ATTRS = { img: true, source: true };

// value/quote of one attribute match: "v" | 'v' | bare v (bare is re-emitted
// quoted, because a base64 payload contains `=` and may not stay unquoted).
function attrValue(dq, sq, bare) {
  if (dq !== undefined) return { value: dq, quote: '"' };
  if (sq !== undefined) return { value: sq, quote: "'" };
  return { value: bare, quote: '"' };
}

// Every attribute token, valueless ones included, with its raw text so unknown
// attributes survive a rewrite untouched.
function parseAttrTokens(raw) {
  const tokens = [];
  for (const m of raw.matchAll(ATTR_RE)) {
    const value = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4];
    tokens.push({ name: m[1].toLowerCase(), value, raw: m[0] });
  }
  return tokens;
}

function rewriteAttrs(raw, baseDir, urlAttrs, srcsetAttrs) {
  return raw.replace(ATTR_RE, (m, name, dq, sq, bare) => {
    if (dq === undefined && sq === undefined && bare === undefined) return m; // valueless
    const n = name.toLowerCase();
    if (n === 'style') {
      const { value, quote } = attrValue(dq, sq, bare);
      const next = processCss(value, baseDir, false); // @import is meaningless here
      return next === value ? m : `${name}=${quote}${next}${quote}`;
    }
    if (srcsetAttrs && n === 'srcset') {
      const { value, quote } = attrValue(dq, sq, bare);
      const next = rewriteSrcset(value, baseDir);
      return next === value ? m : `${name}=${quote}${next}${quote}`;
    }
    if (urlAttrs && urlAttrs.has(n)) {
      const { value, quote } = attrValue(dq, sq, bare);
      const next = inlineUrl(value, baseDir);
      return next === value ? m : `${name}=${quote}${next}${quote}`;
    }
    return m;
  });
}

// `<link rel=stylesheet ...>` -> `<style ...>`. Every attribute except rel/href
// is carried over (media, title, nonce, id, data-*, ... are all legal on
// <style>), so the inlined sheet keeps the conditions it had.
// `disabled` and `rel="alternate stylesheet"` mean "present but not applied":
// <style> has no disabled attribute, so the faithful encoding of that state is
// media="not all" — the rules are kept, and a theme sheet the user never
// selected cannot silently become active.
function buildStyleTag(tokens, css) {
  const rel = (tokens.find((t) => t.name === 'rel') || {}).value || '';
  const inactive = /\balternate\b/i.test(rel) || tokens.some((t) => t.name === 'disabled');
  const kept = tokens
    .filter((t) => t.name !== 'rel' && t.name !== 'href' && !(t.name === 'media' && inactive))
    .map((t) => ` ${t.raw}`)
    .join('');
  return `<style${kept}${inactive ? ' media="not all"' : ''}>${css}</style>`;
}

// A local stylesheet link becomes an inline <style> block; any other local link
// (favicon, apple-touch-icon, manifest, preload, ...) becomes a data: URI.
// Leaving one external would make the output quietly dependent on a file the
// user will not have, which is the failure this whole script exists to prevent.
function renderLinkTag(raw, baseDir) {
  const tokens = parseAttrTokens(raw);
  const href = (tokens.find((t) => t.name === 'href') || {}).value;
  if (!href || leaveAsIs(href)) return `<link${raw}>`;
  const rel = (tokens.find((t) => t.name === 'rel') || {}).value || '';
  if (/\bstylesheet\b/i.test(rel)) {
    const css = expandCssFile(href, localPath(href, baseDir));
    if (css === null) return `<link${raw}>`; // unresolved: keep it, the run exits 1
    return buildStyleTag(tokens, styleElementText(css));
  }
  return `<link${rewriteAttrs(raw, baseDir, new Set(['href']), false)}>`;
}

function renderTag(name, raw, baseDir) {
  const t = name.toLowerCase();
  if (t === 'link') return renderLinkTag(raw, baseDir);
  const urlAttrs = URL_ATTRS[t];
  const srcsetAttrs = SRCSET_ATTRS[t];
  // Fast path: leave tags that cannot carry a resource untouched. `\bstyle=`
  // may also hit `data-style=`, which merely costs a second pass — the
  // per-attribute branch below matches the name exactly.
  if (!urlAttrs && !srcsetAttrs && !/\bstyle\s*=/i.test(raw)) return `<${name}${raw}>`;
  const next = rewriteAttrs(raw, baseDir, urlAttrs, srcsetAttrs);
  return next === raw ? `<${name}${raw}>` : `<${name}${next}>`;
}

// --- HTML scanner -------------------------------------------------------------
//
// One left-to-right pass with four states: text, tag, comment, raw text. Only
// tags and <style> bodies are transformed; everything else is copied byte for
// byte, which is what keeps `<!--` inside a quoted attribute value, markup
// inside a comment, and JavaScript inside a <script> body out of the way.
//
// Where a region ENDS is the tokenizer's decision, and getting it wrong is
// silent in both directions — a region cut short misses a reference, a region
// run long swallows every reference after it. So the states below are the
// tokenizer's states, not a shape that happens to fit the fixtures:
//
//   comment  ends at `-->`, at `--!>`, or by abrupt closing (`<!-->` and
//            `<!--->` are complete comments). A `--` NOT followed by `>` or
//            `!>` is comment data, so `<!-- x -- >` and an unterminated
//            `<!--` run to the end of the document — the browser puts the rest
//            of the file in the comment too, nothing in it loads, and leaving
//            it alone is the correct answer rather than a loud one.
//   bogus    `<!...` that is not a comment, `<?...`, and `</` + a non-letter
//            are one token ending at the first `>` (a declaration, a bogus
//            comment — the extent is the same), so a `<script` written inside
//            one is text and does not open a raw text element.
//   raw text the RCDATA and RAWTEXT elements hold text until their OWN end
//            tag, so a `<script` inside `<title>`, `<textarea>`, `<xmp>`,
//            `<noembed>` or `<noframes>` is text, and the elements that come
//            after the raw text element are still elements.

const TAG_AT_RE = /<([a-zA-Z][a-zA-Z0-9:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/y;

// Elements whose content is text, not markup: the tokenizer's RCDATA pair
// (title, textarea) plus its RAWTEXT set. The two sets differ only in whether
// character references are decoded, which cannot matter here — both end at
// their own end tag and both treat `<script` in the body as text. `noscript`
// is raw text while scripting is enabled, which is the browser default and so
// the reading the exported page has to match.
const RAW_TEXT_TAGS = new Set([
  'title',
  'textarea',
  'script',
  'style',
  'xmp',
  'iframe',
  'noembed',
  'noframes',
  'noscript',
]);

// `<plaintext>` never leaves the tokenizer's PLAINTEXT state: everything after
// the start tag is text, to the end of the file.
const TEXT_TO_EOF_TAGS = new Set(['plaintext']);

// Case-insensitive without building a lowercased copy of the document: U+0130
// `İ` is the one character whose toLowerCase() is two code units long, and a
// lowercased copy plus offsets taken from the original silently desynchronises
// every index after it.
function isAsciiAlpha(c) {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
}

// The whitespace the tokenizer uses to delimit a tag name. Deliberately not
// /\s/, which also matches NBSP and friends — the tokenizer appends those to
// the tag name, so `</style` followed by U+00A0 does not close a <style> element.
function isTagSpace(c) {
  return c === ' ' || c === '\t' || c === '\n' || c === '\f' || c === '\r';
}

// End of the token starting at `<!` / `<?` / `</`-without-a-letter: the first
// `>`. `<!DOCTYPE html>`, `<!anything>`, `<?xml ... ?>`, `<![CDATA[` outside
// SVG (a bogus comment) and `</ 3>` all have this extent in the tokenizer.
function endOfDeclaration(html, i) {
  const gt = html.indexOf('>', i + 2);
  return gt === -1 ? html.length : gt + 1;
}

// End of the tag whose `<` is at html[i]: just past its `>`. A `>` inside a
// quoted attribute value does not end a tag in the tokenizer either, and an
// unterminated quote runs to the end of the document.
function endOfTag(html, i) {
  let j = i + 1;
  while (j < html.length) {
    const c = html[j];
    if (c === '"' || c === "'") {
      const close = html.indexOf(c, j + 1);
      if (close === -1) return html.length;
      j = close + 1;
      continue;
    }
    if (c === '>') return j + 1;
    j++;
  }
  return html.length;
}

// End of the comment whose `<!--` is at html[i] — the tokenizer's comment
// states, which are the only thing that knows where a comment ends. Two of the
// subtleties are load-bearing and neither is guessed at from examples:
//   - `--` ends the comment only when `>` or `!>` follows it; a `--` followed
//     by anything else is comment data, so `<!-- x -- >` is still a comment;
//   - a `<!` inside the comment re-enters the same terminator grammar, which is
//     why `<!--<!-->` is a complete comment.
// Returns html.length for an unterminated comment, which is where the
// tokenizer leaves it too: EOF in a comment state emits the comment and stops,
// so everything after an unterminated `<!--` is comment text and nothing in it
// is loaded.
function endOfComment(html, i) {
  const START = 0; // just after `<!--`
  const START_DASH = 1; // ... followed by `-`
  const BODY = 2; // comment data
  const LT = 3; // ... a `<` in the data
  const LT_BANG = 4; // ... and a `!` straight after it
  const LT_BANG_DASH = 5;
  const LT_BANG_DASH_DASH = 6;
  const END_DASH = 7; // ... a `-` in the data
  const END = 8; // ... `--`
  const END_BANG = 9; // ... `--!`
  let state = START;
  let j = i + 4;
  while (j < html.length) {
    const c = html[j];
    if (state === START || state === START_DASH) {
      if (c === '>') return j + 1; // <!--> and <!--->: abruptly closed
      if (c === '-') state = state === START ? START_DASH : END;
      else {
        state = BODY; // the `-` that got us here is comment data
        continue; // reconsume
      }
    } else if (state === BODY) {
      if (c === '-') state = END_DASH;
      else if (c === '<') state = LT;
    } else if (state === LT) {
      if (c === '!') state = LT_BANG; // the `!` is data; it is consumed here
      else if (c !== '<') {
        state = BODY;
        continue;
      }
      // a further `<` keeps the run going and is consumed
    } else if (state === LT_BANG) {
      if (c !== '-') {
        state = BODY;
        continue;
      }
      state = LT_BANG_DASH;
    } else if (state === LT_BANG_DASH) {
      // `<!-` only reaches the end state with a SECOND `-`; a single `-` then
      // anything else is plain comment data (`<!--<!->>` does not end).
      state = c === '-' ? LT_BANG_DASH_DASH : BODY;
      continue;
    } else if (state === LT_BANG_DASH_DASH) {
      state = END; // `>` is reconsume-tested against the end state
      continue;
    } else if (state === END_DASH) {
      if (c !== '-') {
        state = BODY;
        continue;
      }
      state = END;
    } else if (state === END) {
      if (c === '>') return j + 1; // -->
      if (c === '!') state = END_BANG;
      else if (c !== '-') {
        state = BODY;
        continue;
      }
    } else {
      // END_BANG
      if (c === '>') return j + 1; // --!>
      state = c === '-' ? END_DASH : BODY;
      if (state === BODY) continue;
    }
    j++;
  }
  return html.length;
}

// End of the text of a raw text element: the `</` of its own end tag, or -1
// when the element is never closed. A tag name that merely starts with the
// element's name (`</stylex>`) is text inside the element, so the search keeps
// going from there.
function endOfRawText(html, from, name) {
  const needle = `</${name}`;
  for (let at = from; ; ) {
    const k = html.indexOf('</', at);
    if (k === -1) return -1;
    const after = html[k + needle.length];
    if (matchesAt(html, k, needle) && (after === '>' || after === '/' || isTagSpace(after))) {
      return k;
    }
    at = k + 2;
  }
}

function processHtml(html, baseDir) {
  let out = '';
  let i = 0;
  while (i < html.length) {
    if (html[i] !== '<') {
      out += html[i];
      i++;
      continue;
    }
    if (html.startsWith('<!--', i)) {
      const end = endOfComment(html, i);
      out += html.slice(i, end);
      i = end;
      continue;
    }
    const next = html[i + 1];
    if (next === '!' || next === '?' || (next === '/' && !isAsciiAlpha(html[i + 2]))) {
      const end = endOfDeclaration(html, i);
      out += html.slice(i, end);
      i = end;
      continue;
    }
    if (next === '/') {
      const end = endOfTag(html, i);
      out += html.slice(i, end); // an end tag carries no resource URL
      i = end;
      continue;
    }
    TAG_AT_RE.lastIndex = i;
    const m = TAG_AT_RE.exec(html);
    if (!m) {
      out += '<';
      i++;
      continue;
    }
    const name = m[1];
    const t = name.toLowerCase();
    const tagEnd = i + m[0].length;
    out += renderTag(name, m[2], baseDir);
    if (TEXT_TO_EOF_TAGS.has(t)) {
      out += html.slice(tagEnd); // <plaintext>: the rest of the file is text
      break;
    }
    if (RAW_TEXT_TAGS.has(t)) {
      const closeAt = endOfRawText(html, tagEnd, t);
      // Never closed: the tokenizer keeps the element open to the end of the
      // document, so everything after it is its text — not markup, and nothing
      // in it is loaded by the browser.
      const body = html.slice(tagEnd, closeAt === -1 ? html.length : closeAt);
      // <style> is the one raw text element whose text has a grammar of its
      // own; every other one is copied byte for byte.
      out += t === 'style' ? styleElementText(processCss(body, baseDir, true)) : body;
      if (closeAt === -1) break;
      const closeEnd = endOfTag(html, closeAt);
      out += html.slice(closeAt, closeEnd);
      i = closeEnd;
      continue;
    }
    i = tagEnd;
  }
  return out;
}

// --- main ---------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);
  if (argv.length !== 2) {
    process.stderr.write(USAGE);
    return 64;
  }
  const [inArg, outArg] = argv;
  const inPath = path.resolve(inArg);
  const outPath = path.resolve(outArg);

  let html;
  try {
    html = fs.readFileSync(inPath, 'utf8');
  } catch (e) {
    process.stderr.write(`inline-assets: cannot read input ${inArg}: ${e.code || e.message}\n`);
    return 1;
  }

  const baseDir = path.dirname(inPath);
  const out = processHtml(html, baseDir);

  // Not an error, but the caller has to know: these references still point
  // outside the file, so "works offline" may not hold for them.
  const outsideNote = leftOutside.length
    ? `[NOTE] ${leftOutside.length} reference(s) left outside the page (not an error, not inlined):\n` +
      `${leftOutside.join('\n')}\n` +
      'A remote or drive-absolute reference keeps the export dependent on the network or on a\n' +
      'path outside it. Inline it (or drop the reference) if the file has to work fully offline.\n'
    : '';

  if (missing.length) {
    process.stderr.write(
      `[FAIL] ${missing.length} unresolved resource(s) - nothing written to ${outArg}\n` +
        `${missing.join('\n')}\n` +
        `Relative paths are resolved against ${baseDir}.\n` +
        'A reference can end up here because the file is not at that path, because the path is\n' +
        'URL-encoded while the name on disk is not, or because the reference exists only inside a\n' +
        'JavaScript/JSX string (this script cannot see those - restructure it into an HTML\n' +
        'attribute). Markup inside HTML comments, <script> bodies and CSS comments is left\n' +
        'untouched and never counted here.\n' +
        outsideNote
    );
    return 1;
  }

  if (outsideNote) process.stderr.write(outsideNote);

  try {
    fs.writeFileSync(outPath, out);
  } catch (e) {
    process.stderr.write(`inline-assets: cannot write output ${outArg}: ${e.code || e.message}\n`);
    return 1;
  }
  process.stdout.write(`[OK] inlined ${inlined} assets -> ${outArg}\n`);
  return 0;
}

process.exitCode = main();
