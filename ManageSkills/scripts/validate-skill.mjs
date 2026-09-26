#!/usr/bin/env node
// 技能机械层校验：frontmatter / H1 唯一性 / 行尾 / BOM / Emoji / 围栏配平 / 大代码块 / 骨架锚点 / 语言红线
//
// 用法:
//   node validate-skill.mjs [--skills <技能根目录>] [--baseline <改写前快照目录>] [--quiet]
//
//   --skills    默认 ~/.claude/skills
//   --baseline  快照目录，用于给出前后行数差；支持 <目录>/<技能>.SKILL.md 或 <目录>/<技能>/SKILL.md
//   --quiet     只打印有问题的文件
//
// 退出码: 0 = 无问题; 1 = 存在问题

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const args = process.argv.slice(2);
const opt = (n, d = null) => {
  const i = args.indexOf('--' + n);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const SKILLS = opt('skills', path.join(os.homedir(), '.claude', 'skills'));
const BASELINE = opt('baseline');
const QUIET = args.includes('--quiet');

// 语言红线（见 references/skill-voice-contract.md）
const HEDGE = ['可以', '或许', '也许', '大概', '建议', '尽量', '尝试', '按理说', '一般来说', '视情况而定'];
const NARRATIVE = ['我们曾经', '当初', '本技能将', '值得注意的是', '需要强调的是', '总而言之', '在实践中我们'];
const SECTIONS = /何时使用|何时使|何时用|何时请求|什么时候用/;

const norm = s => s.replace(/\r\n/g, '\n').replace(/\n$/, '');

function baselineLines(dir, name) {
  if (!dir) return null;
  for (const p of [path.join(dir, name + '.SKILL.md'), path.join(dir, name, 'SKILL.md')]) {
    if (fs.existsSync(p)) return norm(fs.readFileSync(p, 'utf8')).split('\n').length;
  }
  return null;
}

function analyze(file, dirName) {
  const buf = fs.readFileSync(file);
  const raw = buf.toString('utf8');
  const lines = norm(raw).split('\n');

  const crlf = (raw.match(/\r\n/g) || []).length;
  const loneCr = (raw.match(/\r(?!\n)/g) || []).length;
  const bom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;

  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  let fmName = '', fmDesc = '';
  if (fm) {
    const m1 = fm[1].match(/^name:[ \t]*(.+)$/m);
    fmName = m1 ? m1[1].trim() : '';
    const m2 = fm[1].match(/description:[ \t]*([\s\S]*?)(?=\r?\n[a-zA-Z_-]+:|\r?\n*$)/);
    fmDesc = m2 ? m2[1].replace(/\s+/g, ' ').trim() : '';
  }

  const body = fm ? raw.slice(fm[0].length) : raw;
  const h2s = (body.match(/^##\s+(.+)$/gm) || []).map(s => s.replace(/^##\s+/, '').trim());

  // 围栏感知：统计 H1、最大代码块、围栏配平
  let inFence = false, h1Count = 0, h1s = [], maxBlock = 0, cur = 0, fences = 0, fenceChar = null;
  for (const l of lines) {
    const m = l.match(/^(`{3,})/);
    if (m) {
      fences++;
      if (!inFence) { inFence = true; fenceChar = m[1].length; cur = 0; }
      else if (m[1].length >= fenceChar) { inFence = false; maxBlock = Math.max(maxBlock, cur); }
      continue;
    }
    if (inFence) cur++;
    else if (/^#\s+/.test(l)) { h1Count++; h1s.push(l.replace(/^#\s+/, '').trim()); }
  }

  const emoji = [...new Set(raw.match(/\p{Extended_Pictographic}/gu) || [])];
  const hedge = HEDGE.filter(w => raw.includes(w));
  const narr = NARRATIVE.filter(w => raw.includes(w));

  const problems = [];
  if (!fm) problems.push('无 frontmatter');
  if (fm && fmName !== dirName) problems.push(`name 与目录不符(${fmName})`);
  if (fm && !fmDesc) problems.push('无 description');
  if (fmDesc.length > 1024) problems.push(`description 超长(${fmDesc.length})`);
  if (crlf || loneCr) problems.push(`CRLF(${crlf})/loneCR(${loneCr})`);
  if (bom) problems.push('UTF-8 BOM');
  if (emoji.length) problems.push(`Emoji:${emoji.join('')}`);
  if (h1Count === 0) problems.push('无 H1');
  if (h1Count > 1) problems.push(`多个 H1(${h1Count}: ${h1s.join(' / ')})`);
  if (fences % 2) problems.push('围栏未配平');
  if (maxBlock >= 15) problems.push(`大代码块(${maxBlock} 行)`);

  return {
    dirName, lines: lines.length, base: baselineLines(BASELINE, dirName),
    hasSection: h2s.some(h => SECTIONS.test(h)),
    hedge, narr, problems,
  };
}

const dirs = fs.readdirSync(SKILLS, { withFileTypes: true })
  .filter(d => d.isDirectory() && fs.existsSync(path.join(SKILLS, d.name, 'SKILL.md')))
  .map(d => d.name).sort();

if (!dirs.length) {
  console.error(`未在 ${SKILLS} 下找到任何 <技能>/SKILL.md`);
  process.exit(1);
}

const results = dirs.map(n => analyze(path.join(SKILLS, n, 'SKILL.md'), n));

if (!QUIET) {
  console.log('技能 | 行数 | Δ | 何时使用 | 对冲 | 叙事 | 问题');
  console.log('---|---|---|---|---|---|---');
}
let total = 0, totalBase = 0;
for (const r of results) {
  total += r.lines;
  if (r.base) totalBase += r.base;
  if (QUIET && !r.problems.length && !r.narr.length) continue;
  const d = r.base ? (r.lines - r.base) : null;
  console.log(`${r.dirName} | ${r.lines} | ${d === null ? '-' : (d > 0 ? '+' + d : d)} | ` +
    `${r.hasSection ? 'Y' : '-'} | ${r.hedge.length || ''} | ${r.narr.length || ''} | ${r.problems.join(' ') || 'OK'}`);
}

const bad = results.filter(r => r.problems.length);
if (!QUIET) {
  console.log(`\n合计 ${results.length} 份，${total} 行` +
    (totalBase ? `（基线 ${totalBase}，Δ ${total - totalBase}）` : ''));
  console.log(`机械问题：${bad.length}/${results.length}`);
  for (const r of bad) console.log(`  [FAIL] ${r.dirName}: ${r.problems.join(', ')}`);
  const narr = results.filter(r => r.narr.length);
  if (narr.length) for (const r of narr) console.log(`  [NARR] ${r.dirName}: ${r.narr.join(', ')}`);
}
process.exit(bad.length ? 1 : 0);
