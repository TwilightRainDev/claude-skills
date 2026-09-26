#!/usr/bin/env node
// 引用完整性：SKILL.md 里指向的文件路径是否真实存在
//
// 用法:
//   node check-references.mjs [--skills <技能根目录>] [--baseline <改写前快照目录>] [--all]
//
//   --skills    默认 ~/.claude/skills
//   --baseline  快照目录；给出后会把「改写前即断」与「本次新断」分开标注
//   --all       连改写前即断的项也全部列出（默认两者都列，此项仅影响排版）
//
// 判据说明：本检查是复核辅助，不是硬门禁。外部绝对路径、宿主专有路径、占位符
// 会被归入「外部」类，仅供人工判读。
//
// 退出码: 0 = 无本次新断; 1 = 存在本次新断

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

const exists = p => { try { return fs.existsSync(p); } catch { return false; } };

// 明显不是「本库内相对路径」的形态：外部绝对路径、宿主路径、占位符
const EXTERNAL = /^(?:[A-Za-z]:[\\/]|~[\\/]|\/Users\/|\/home\/|\/tmp\/|\/mnt\/|\/d\/)|[<>]|\{[^}]*\}/;

function candidates(src) {
  const out = new Set();
  for (const m of src.matchAll(/\]\(([^)\s]+)\)/g)) {
    const t = m[1];
    if (/^(https?:|mailto:|#)/i.test(t)) continue;
    out.add(t.split('#')[0]);
  }
  for (const m of src.matchAll(/`([^`\n]+)`/g)) {
    const t = m[1].trim();
    if (!t || /\s/.test(t)) continue;
    if (/[*?{}<>]/.test(t)) continue;          // glob / 占位符
    if (/^-/.test(t)) continue;                 // 命令行旗标
    // 必须是「有主干的文件名」或含路径分隔符；裸扩展名（`.mjs`）与版本号（`v1.2`）不算
    const looksPath = t.includes('/') ||
      /^[A-Za-z0-9_][A-Za-z0-9_.\-]*\.(md|sh|mjs|cjs|js|py|ps1|json|txt|yml|yaml)$/i.test(t);
    if (!looksPath) continue;
    out.add(t);
  }
  return [...out];
}

function classify(skillDir, t) {
  const norm = t.replace(/^\.\//, '').replace(/\\/g, '/');
  if (EXTERNAL.test(norm)) return { kind: 'external', ok: exists(path.resolve(norm.replace(/^~/, os.homedir()))) };
  const tries = [path.join(skillDir, norm), path.resolve(SKILLS, norm), path.resolve(SKILLS, '..', norm)];
  return { kind: 'local', ok: tries.some(exists) };
}

function baselineFile(name) {
  if (!BASELINE) return null;
  for (const p of [path.join(BASELINE, name + '.SKILL.md'), path.join(BASELINE, name, 'SKILL.md')]) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const dirs = fs.readdirSync(SKILLS, { withFileTypes: true })
  .filter(d => d.isDirectory() && fs.existsSync(path.join(SKILLS, d.name, 'SKILL.md')))
  .map(d => d.name).sort();

let totalLocal = 0, freshBreaks = 0;
console.log('=== 引用完整性 ===\n');

for (const name of dirs) {
  const skillDir = path.join(SKILLS, name);
  const now = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
  const bFile = baselineFile(name);

  const brokenLocal = candidates(now)
    .map(t => ({ t, ...classify(skillDir, t) }))
    .filter(r => r.kind === 'local' && !r.ok);

  if (!brokenLocal.length) continue;

  const before = bFile ? new Set(candidates(fs.readFileSync(bFile, 'utf8'))
    .map(t => ({ t, ...classify(skillDir, t) }))
    .filter(r => r.kind === 'local' && !r.ok).map(r => r.t)) : new Set();

  totalLocal += brokenLocal.length;
  console.log(`[?] ${name}`);
  for (const r of brokenLocal) {
    const fresh = bFile && !before.has(r.t);
    if (fresh) freshBreaks++;
    console.log(`      ${bFile ? (fresh ? '★本次新断 ' : '改写前即断 ') : ''}${r.t}`);
  }
}

console.log(`\n本库内相对路径未解析合计：${totalLocal}` +
  (BASELINE ? `（其中本次新断 ${freshBreaks}）` : ''));
console.log('注：外部绝对路径与宿主路径不计入本数，需人工判读。');
process.exit(freshBreaks ? 1 : 0);
