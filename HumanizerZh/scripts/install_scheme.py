#!/usr/bin/env python3
"""把 HumanizerZh 的替换方案并入 TextTool 可执行文件目录下的 replace_schemes.json。

TextTool 的规则文件固定从 AppContext.BaseDirectory（即可执行文件所在目录）读取，
不是当前工作目录，也不是本技能目录，所以方案必须先"安装"过去才能被 --scheme 找到。

行为：
  - 目标目录没有 replace_schemes.json 时，先用仓库里的 TextTool.Core/default_schemes.json
    打底（保持内置方案可用），再加本技能方案；仓库文件也找不到时只写本技能方案。
  - 已存在时按 Name 覆盖同名项，其余条目原样保留（不破坏用户已有方案）。
  - 输出 UTF-8 无 BOM、LF、两空格缩进，可反复执行。

用法：
  python install_scheme.py                       # 安装到默认 CLI 目录
  python install_scheme.py --target <目录> ...   # 安装到指定目录（可多次）
  python install_scheme.py --show                # 只打印将要安装的方案
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# 机器上的 TextTool 位置（本机实测路径）
REPO_ROOT = Path(r"E:\work_zone\Code\TextTool")
DEFAULT_TARGETS = [REPO_ROOT / "TextTool.Cli" / "bin" / "Release" / "net8.0"]
DEFAULT_SCHEMES_SRC = REPO_ROOT / "TextTool.Core" / "default_schemes.json"
SCHEME_FILE_NAME = "replace_schemes.json"

SKILL_ROOT = Path(__file__).resolve().parent.parent
SCHEME_SRC = SKILL_ROOT / "references" / "humanize-scheme.json"


def load_json(path: Path) -> object:
    # utf-8-sig：兼容带 BOM 的既有配置
    with open(path, "r", encoding="utf-8-sig") as fh:
        return json.load(fh)


def write_json(path: Path, data: object) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    os.replace(tmp, path)


def main() -> int:
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("--target", action="append", default=None,
                    help="TextTool 可执行文件所在目录，可重复；缺省用内置 CLI 构建目录")
    ap.add_argument("--show", action="store_true", help="只打印方案，不写文件")
    args = ap.parse_args()

    if not SCHEME_SRC.is_file():
        print(f"[FAIL] 找不到方案源文件：{SCHEME_SRC}", file=sys.stderr)
        return 1

    incoming = load_json(SCHEME_SRC)
    if not isinstance(incoming, list) or not incoming:
        print(f"[FAIL] 方案源文件结构不对（应为非空数组）：{SCHEME_SRC}", file=sys.stderr)
        return 1
    new_schemes = {s["Name"]: s for s in incoming}

    if args.show:
        for name, s in new_schemes.items():
            print(f"{name}：{len(s.get('Rules', []))} 条规则")
        return 0

    targets = [Path(t) for t in args.target] if args.target else DEFAULT_TARGETS
    rc = 0
    for target in targets:
        if not target.is_dir():
            print(f"[FAIL] 目标目录不存在：{target}", file=sys.stderr)
            rc = 1
            continue
        exe = target / "texttool.dll"
        if not exe.is_file():
            print(f"[NOTE] {target} 下没有 texttool.dll —— 该目录可能不是 CLI 可执行文件所在目录",
                  file=sys.stderr)

        dest = target / SCHEME_FILE_NAME
        if dest.is_file():
            existing = load_json(dest)
            if not isinstance(existing, list):
                print(f"[FAIL] 既有配置结构不对：{dest}", file=sys.stderr)
                rc = 1
                continue
            origin = "既有配置"
        elif DEFAULT_SCHEMES_SRC.is_file():
            existing = load_json(DEFAULT_SCHEMES_SRC)
            origin = f"内置方案打底（{DEFAULT_SCHEMES_SRC.name}）"
        else:
            existing = []
            origin = "空"

        merged, replaced = [], False
        for item in existing:
            name = item.get("Name")
            if name in new_schemes:
                merged.append(new_schemes[name])
                replaced = True
            else:
                merged.append(item)
        if not replaced:
            merged.append(new_schemes[sorted(new_schemes)[0]])

        write_json(dest, merged)
        action = "覆盖同名方案" if replaced else "新增方案"
        print(f"[OK] {dest}（{origin}，{action}，共 {len(merged)} 个方案）")
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
