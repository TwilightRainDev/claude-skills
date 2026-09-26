---
name: "save-as-standalone-html"
description: "Save as standalone HTML\nSingle self-contained file that works offline"
---
Export the current design as a single self-contained HTML file that works completely offline — no external dependencies.

## How it works

There is a local Node script that inlines **exactly these references, and nothing else**, each as a base64 `data:` URI:

- `img` / `source`: `src`, `srcset`
- `video` / `audio` / `track`: `src`, plus `poster` on `video`
- `script`: `src`
- SVG `<image>` and `<use>`: `href`, `xlink:href`
- `link`: `href` — a stylesheet link becomes an inline `<style>` block (its `media`/`title` are kept; a sheet that was `disabled` or an `alternate` theme stays inactive, as it was on the page), any other link becomes a data URI
- any element: `style="… url() …"`
- `<style>` blocks: `url()`, and `@import` expanded recursively (`layer()`, `supports()` and media conditions preserved)

It does **NOT** touch, and does **NOT** report as missing, anything outside that list: `iframe src`, `embed src`, `object data`, `input type=image src`, other elements; markup inside HTML comments, `<script>` bodies or CSS `/* */` comments (none of it is rendered or loaded, so it is left verbatim); and resources referenced only as strings in JavaScript or JSX code — for example:
- An image src set in React: `<img src={"./hero.png"} />`
- A background URL in a styled-component: `background: url('./pattern.svg')`
- A dynamically imported script

Relative paths resolve against the HTML file's own directory; a stylesheet's `url()` and `@import` resolve against that stylesheet's directory.

Remote (`https://`, `//cdn…`) and drive-absolute (`C:\…`) references are not local files, so they are left exactly as they are — the run still succeeds, but it lists them on stderr as `left remote:` / `left absolute:`. **Read that list**: while it is non-empty the export still depends on the network or on a path outside itself, so it is not truly offline; inline those resources or drop the references before delivering.

Your job is to prepare the HTML file so the script can capture everything, then run it.

## Step 1: Make a copy of the HTML file and lift code-referenced resources into HTML attributes

Copy the current HTML file. Read it. Copy its dependencies. Look through ALL the code (inline scripts, imported JSX files, styled-components, etc) for any resource URL that is referenced as a string in code rather than as an HTML attribute. This includes:
- Image URLs in React/JSX (`<img src={...} />`, `style={{ backgroundImage: ... }}`)
- URLs in CSS-in-JS (styled-components, inline styles set via JS)
- Script tags that import other scripts which themselves reference resources
- Any fetch() or XMLHttpRequest calls that load assets
- Audio/video sources set programmatically

Rewrite each one as a plain HTML attribute or a CSS `url()` the script can see — e.g. `<img src={"./hero.png"} />` becomes `<img src="./hero.png" />`.

Note: if you use the Anthropic API in the project, it will not work standalone. If this is core to the project, STOP and tell the user!

Resources referenced only from JavaScript/JSX strings cannot be discovered.
Restructure them into HTML attributes, or the script will not inline them.
For the covered set listed above, every unresolved resource is listed on stderr and
the run exits 1 — it never writes a file that is missing one of them.

## Step 2: Run the script

If you made changes in step 1, save the modified HTML file first. Then (or if no changes were needed) call:

```
node <skill>/agents/inline-assets.mjs <input.html> <output.html>
```

Give the output file a friendly human name. Exit codes: 0 = done; 64 = wrong arguments; 1 = the run failed — unreadable input, at least one unresolved resource, or an unwritable output path. The output is written only when the whole run succeeds, so exit 1 always means nothing was written.

## Step 3: Verify (internal check only)

**Read the script's stderr first** — every reference it could not resolve (anything inside the covered set above) is listed there, and the run exits 1 **without writing the output file**. That's the authoritative miss list; fix those references and re-run before opening anything. A reference that exists only in JavaScript or JSX never reaches that list — that is what step 1 is for.

On a **successful** run stderr can still carry a `[NOTE] … left remote: / left absolute:` block. Those are not misses and not errors: they are references that still point outside the file. Decide whether the export is acceptable with them — if the user asked for something that works offline, it is not.

Then preview the inlined output via this skill's HTTP preview flow TO CHECK IT WORKS — this is a private verification step for YOU, not the delivery mechanism. Check the page's console/runtime logs for errors (JS exceptions, failed decodes). If there are issues, fix the source file and re-run.

## Step 4: Present for download — MANDATORY

You MUST deliver the final file using **SendUserFile** pointing directly at the inlined HTML output. This is the ONLY correct way to hand off a standalone export.

- Do NOT use preview/show-file tools as the delivery step — those are preview tools, not download tools. The user cannot reliably save the standalone export from them.
- If you skip this step, the user has no way to get the file. This step is non-negotiable.
