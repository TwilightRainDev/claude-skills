#!/usr/bin/env node
// 内容保全比对：改写后有哪些「必须保留要素」消失或减少
//
// 用法:
//   node diff-preservation.mjs --baseline <改写前快照目录> [--skills <技能根目录>] [--max <每项显示条数>]
//
//   --baseline  必需。支持 <目录>/<技能>.SKILL.md 或 <目录>/<技能>/SKILL.md
//   --skills    默认 ~/.claude/skills
//   --max       每个技能最多列出多少条差异，默认 25
//
// 提取的要素：反引号内 token、路径形态字符串、对本库其它技能的引用。
// 这是复核辅助，不是硬门禁：合理的去叙事也会删掉个别 token，需人工判读。
//
// 注意：只比对 SKILL.md。改写时把内容移入 references/ 的（如模板、数据契约）
// 会显示为「消失」，那是预期结果，需人工区分。
//
// 退出码: 恒为 0（比对结果需人工裁决）

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
const MAX = parseInt(opt('max', '25'), 10);

if (!BASELINE || !fs.existsSync(BASELINE)) {
  console.error('缺少 --baseline <改写前快照目录>');
  process.exit(1);
}

const skillNames = fs.readdirSync(SKILLS, { withFileTypes: true })
  .filter(d => d.isDirectory() && fs.existsSync(path.join(SKILLS, d.name, 'SKILL.md')))
  .map(d => d.name);

const PATH_RE = /[A-Za-z0-9_][A-Za-z0-9_./\\-]*\.(?:md|mjs|cjs|js|py|sh|json|ps1|txt|yml|yaml|ts)\b/g;

function extract(src) {
  const t = new Map();
  const bump = k => t.set(k, (t.get(k) || 0) + 1);
  for (const m of src.matchAll(/`([^`\n]+)`/g)) bump(m[1].trim());
  for (const m of src.matchAll(PATH_RE)) bump(m[0]);
  for (const n of skillNames) {
    const c = (src.match(new RegExp('\\b' + n + '\\b', 'g')) || []).length;
    if (c) t.set('技能:' + n, c);
  }
  return t;
}

// 过滤纯噪音 token（过短、纯中文短语、单字符）
const NOISE = new Set(['是', '的', '与', '或', 'Y', 'N', '-', '---', '|']);
const interesting = k =>
  !NOISE.has(k) && (k.startsWith('技能:') || (k.length >= 4 && /[A-Za-z0-9_./\\-]/.test(k)));

function baselineFile(name) {
  for (const p of [path.join(BASELINE, name + '.SKILL.md'), path.join(BASELINE, name, 'SKILL.md')]) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

console.log('=== 改写后消失 / 减少的要素（复核候选）===\n');

let totalMissing = 0, missingFiles = 0;
for (const name of skillNames) {
  const bFile = baselineFile(name);
  if (!bFile) { console.log(`[WARN] ${name}: 快照缺失，无法比对\n`); missingFiles++; continue; }

  const before = extract(fs.readFileSync(bFile, 'utf8'));
  const after = extract(fs.readFileSync(path.join(SKILLS, name, 'SKILL.md'), 'utf8'));

  const missing = [];
  for (const [k, c] of before) {
    if (!interesting(k)) continue;
    const nc = after.get(k) || 0;
    if (nc < c) missing.push(nc === 0 ? k : `${k}(×${c}→${nc})`);
  }
  totalMissing += missing.length;

  console.log(`${missing.length ? '[?]  ' : '[OK] '}${name} (${missing.length})`);
  for (const m of missing.slice(0, MAX)) console.log(`        - ${m}`);
  if (missing.length > MAX) console.log(`        ... 另有 ${missing.length - MAX} 项`);
}

console.log(`\n合计复核候选：${totalMissing}` + (missingFiles ? `（${missingFiles} 个技能无快照）` : ''));
console.log('注：这是复核辅助，不是硬门禁 —— 定向删除失效引用、装饰性伪代码行属预期结果。');
