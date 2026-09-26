#!/usr/bin/env python3
"""中文文本"AI 味"体检：逐条检查机械特征与句式特征，报出命中位置。

只做检测，不改写。纯标准库，无第三方依赖。

用法：
  python tone_lint.py <文件>
  python tone_lint.py -            # 从 stdin 读
  python tone_lint.py <文件> --json
  python tone_lint.py <文件> --only P,S1

退出码：0 = 未发现可疑特征；1 = 有命中；2 = 用法/读取错误。
"""

from __future__ import annotations

import argparse
import io
import json
import re
import statistics
import sys

CJK = "㐀-䶿一-鿿豈-﫿　-〿＀-￯"

# ============================================================
# 机械层：标点与字符
# ============================================================

REPEAT_FULLWIDTH = re.compile(r"([。，、？！；：～])\1+")
REPEAT_ASCII_MARK = re.compile(r"([!?])\1+")
ELLIPSIS_ASCII = re.compile(r"\.{3,}")
ELLIPSIS_DOTS = re.compile(r"。{3,}")
ELLIPSIS_STD = re.compile(r"……")
ELLIPSIS_LONE = re.compile(r"(?<!…)…(?!…)")
HALF_PUNCT_NEXT_CJK = re.compile(rf"[,;:?!()\"'][{CJK}]")
HALF_PUNCT_PREV_CJK = re.compile(rf"[{CJK}][,;:?!()\"']")
DASH_ASCII = re.compile(r"--+")
DASH_SINGLE = re.compile(r"(?<!—)—(?!—)")
DASH_BETWEEN_CJK = re.compile(rf"[{CJK}] ?- ?[{CJK}]")
TILDE = re.compile(r"~{2,}|[～]")

INVISIBLE = {
    "​": "零宽空格",
    "‌": "零宽非连接符",
    "‍": "零宽连接符",
    "‎": "从左至右标记",
    "‏": "从右至左标记",
    "⁠": "词连接符",
    "­": "软连字符",
    " ": "不换行空格",
}

QUOTE_STYLES = {
    "ASCII 直引号": re.compile(r"\""),
    "弯引号": re.compile(r"[“”]"),
    "直角引号": re.compile(r"[「」]"),
    "双直角引号": re.compile(r"[『』]"),
    "ASCII 直单引号": re.compile(r"'"),
    "弯单引号": re.compile(r"[‘’]"),
}

# ============================================================
# 判断层：句式与用词
# ============================================================

# 对举句式：AI 最典型的骨架
BINARY_PATTERNS = [
    ("不是A而是B", re.compile(r"不是[^。！？\n]{1,25}?而是")),
    ("并非A而是B", re.compile(r"并非[^。！？\n]{1,25}?而是")),
    ("与其说A不如说B", re.compile(r"与其说[^。！？\n]{1,25}?不如说")),
    ("不只是A更是B", re.compile(r"不只是[^。！？\n]{1,25}?更是")),
    ("不在于A而在于B", re.compile(r"不在于[^。！？\n]{1,25}?而在于")),
    ("既A又B排比", re.compile(r"既[^。！？\n]{1,15}?又[^。！？\n]{1,15}?又")),
]

# 序数词骨架
ORDINAL_STRONG = re.compile(r"首先|其次|再次|最后|其一|其二|其三")
ORDINAL_WEAK = re.compile(r"第[一二三四五]|其[一二三四五]|[①②③④⑤]")

# 段落收尾升华
ELEVATION = re.compile(
    r"不仅仅|总而言之|总之|综上|由此可见|值得我们|让我们|"
    r"这正是|在这个.{0,12}的时代|不仅.{0,10}更是|未来可期|值得期待|"
    r"方能|唯有|方得|行稳致远"
)

# 形容词/定语堆叠：短距离内三个"的"
STACKED_DE = re.compile(r"的[^。，、\n]{0,8}的[^。，、\n]{0,8}的")

CLICHES = [
    "赋能", "抓手", "闭环", "生态位", "护城河", "降本增效", "提质增效",
    "不可否认", "毋庸置疑", "值得注意的是", "众所周知", "在当今社会",
    "随着.{0,10}的发展", "极大地", "深入地", "全方位", "多维度", "深层次",
    "带来.{0,6}的.{0,6}体验", "具有重要意义", "发挥着重要作用", "起到了关键作用",
    "在.{0,10}的背景下", "从某种意义上说", "换句话说", "简而言之",
]
CLICHE_RE = [(c, re.compile(c)) for c in CLICHES]


def pos(text: str, index: int) -> tuple[int, int]:
    line = text.count("\n", 0, index) + 1
    col = index - (text.rfind("\n", 0, index) + 1) + 1
    return line, col


def snippet(text: str, start: int, end: int, pad: int = 8) -> str:
    lo = max(0, start - pad)
    hi = min(len(text), end + pad)
    s = text[lo:hi].replace("\n", "")
    if lo > 0:
        s = "…" + s
    if hi < len(text):
        s = s + "…"
    return s


def visible(text: str) -> str:
    """把不可见字符转成转义写法。人看不见 U+200B，直接打印等于没报，
    而且 Windows 控制台的 GBK 码页根本编码不出它。"""
    out = []
    for ch in text:
        if ch in INVISIBLE or ch == "﻿" or ord(ch) < 0x20:
            out.append("\\u%04x" % ord(ch))
        else:
            out.append(ch)
    return "".join(out)


class Report:
    def __init__(self) -> None:
        self.hits: list[dict] = []
        self.notes: list[str] = []

    def hit(self, code: str, title: str, text: str, start: int, end: int, detail: str = "") -> None:
        line, col = pos(text, start)
        self.hits.append({
            "code": code, "title": title, "line": line, "col": col,
            "text": snippet(text, start, end), "detail": detail,
        })

    def note(self, msg: str) -> None:
        self.notes.append(msg)


def scan_mechanical(text: str, rep: Report) -> None:
    for m in REPEAT_FULLWIDTH.finditer(text):
        rep.hit("P1", "重复标点", text, m.start(), m.end(), f"连续 {m.end() - m.start()} 个相同标点")
    for m in REPEAT_ASCII_MARK.finditer(text):
        rep.hit("P1", "重复标点", text, m.start(), m.end(), "半角重复叹号/问号")

    # 省略号风格
    styles: dict[str, int] = {}
    for name, pat in [("ASCII 三点", ELLIPSIS_ASCII), ("全角句号串", ELLIPSIS_DOTS),
                      ("标准中文省略号", ELLIPSIS_STD), ("落单的 …", ELLIPSIS_LONE)]:
        found = list(pat.finditer(text))
        if found:
            styles[name] = len(found)
            for m in found:
                rep.hit("P2", "省略号", text, m.start(), m.end(), name)
    if len(styles) > 1:
        rep.note(f"省略号风格混用：{'、'.join(f'{k}({v})' for k, v in styles.items())}")

    for m in HALF_PUNCT_NEXT_CJK.finditer(text):
        rep.hit("P3", "全半角混用", text, m.start(), m.end(), "半角标点紧跟中文")
    for m in HALF_PUNCT_PREV_CJK.finditer(text):
        rep.hit("P3", "全半角混用", text, m.start(), m.end(), "中文后紧跟半角标点")

    qstyle = {k: len(p.findall(text)) for k, p in QUOTE_STYLES.items()}
    used = {k: v for k, v in qstyle.items() if v}
    if len(used) > 1:
        rep.note(f"引号风格混用：{'、'.join(f'{k}({v})' for k, v in used.items())}")

    paren_half = len(re.findall(r"[()]", text))
    paren_full = len(re.findall(r"[（）]", text))
    if paren_half and paren_full:
        rep.note(f"括号全半角混用：半角 {paren_half} 个 / 全角 {paren_full} 个")

    for m in DASH_ASCII.finditer(text):
        rep.hit("P6", "破折号", text, m.start(), m.end(), "ASCII 连字符当破折号")
    for m in DASH_SINGLE.finditer(text):
        rep.hit("P6", "破折号", text, m.start(), m.end(), "单个 em dash，中文应用 ——")
    for m in DASH_BETWEEN_CJK.finditer(text):
        rep.hit("P6", "破折号", text, m.start(), m.end(), "中文之间用半角连字符")
    for m in TILDE.finditer(text):
        rep.hit("P6", "波浪号", text, m.start(), m.end(), "波浪号/全角波浪号")

    for ch, name in INVISIBLE.items():
        for m in re.finditer(re.escape(ch), text):
            rep.hit("P7", "隐形字符", text, m.start(), m.end(), name)


def paragraphs(text: str) -> list[tuple[int, str]]:
    """返回 (段首在全文中的下标, 去空白后的段落文本)。逐行累计偏移，
    不用 text.index —— 重复段落会定位到第一次出现的位置。"""
    out = []
    off = 0
    for line in text.splitlines(keepends=True):
        s = line.strip()
        if s:
            out.append((off, s))
        off += len(line)
    return out


def sentences(text: str) -> list[str]:
    return [s for s in re.split(r"(?<=[。！？…])", text) if s.strip()]


def scan_style(text: str, rep: Report) -> None:
    for name, pat in BINARY_PATTERNS:
        for m in pat.finditer(text):
            rep.hit("S1", "对举句式", text, m.start(), m.end(), name)

    paras = paragraphs(text)

    strong = len(ORDINAL_STRONG.findall(text))
    weak = len(ORDINAL_WEAK.findall(text))
    if strong >= 2:
        rep.note(f"序数词骨架「首先/其次/最后」出现 {strong} 次 —— 结构化排版的典型痕迹")
    if weak:
        rep.note(f"显式序号标记出现 {weak} 次，确认是否为真实并列清单")

    for off, para in paras:
        ms = list(ORDINAL_STRONG.finditer(para))
        if len(ms) >= 2:
            rep.hit("S2", "段内序数词", text, off + ms[0].start(), off + ms[-1].end(),
                    f"同段出现 {len(ms)} 个：{'、'.join(m.group() for m in ms)}")

    for off, para in paras:
        tail = para[-30:]
        m = ELEVATION.search(tail)
        if m:
            rep.hit("S3", "结尾升华", text, off + len(para) - len(tail) + m.start(),
                    off + len(para) - len(tail) + m.end(), "段末拔高收尾")

    for m in STACKED_DE.finditer(text):
        rep.hit("S4", "定语堆叠", text, m.start(), m.end(), "短距离内出现三个「的」")

    for name, pat in CLICHE_RE:
        for m in pat.finditer(text):
            rep.hit("S5", "套话词", text, m.start(), m.end(), name)

    exclam = text.count("！")
    if len(text) >= 400 and exclam * 1000 / len(text) > 3:
        rep.note(f"叹号密度偏高：{exclam} 个 / {len(text)} 字")

    if len(paras) >= 5:
        lens = [len(p) for _, p in paras]
        mean = statistics.mean(lens)
        if mean > 0:
            cv = statistics.pstdev(lens) / mean
            if cv < 0.25:
                rep.note(f"段落长度过于均一（变异系数 {cv:.2f}，{len(paras)} 段）—— 人写文本段落长短通常更参差")

    sents = [s for s in sentences(text) if len(s.strip()) >= 6]
    if len(sents) >= 10:
        lens = [len(s) for s in sents]
        mean = statistics.mean(lens)
        if mean > 0:
            cv = statistics.pstdev(lens) / mean
            if cv < 0.35:
                rep.note(f"句长分布过于整齐（变异系数 {cv:.2f}，{len(sents)} 句）")

    if len(paras) >= 4:
        heads: dict[str, int] = {}
        for _, p in paras:
            head = p[:2]
            heads[head] = heads.get(head, 0) + 1
        dup = {k: v for k, v in heads.items() if v >= 3}
        if dup:
            rep.note("段首两字高度重复：" + "、".join(f"「{k}」×{v}" for k, v in dup.items()))


def main() -> int:
    # Windows 控制台默认 GBK 码页：报隐形字符时 print 会抛 UnicodeEncodeError 直接崩，
    # --json 亦然。强制 UTF-8 输出，保证报告与 JSON 永远打得出来。
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass

    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("path", help="待检查文件，或 - 表示 stdin")
    ap.add_argument("--json", action="store_true", help="以 JSON 输出")
    ap.add_argument("--only", default="", help="只跑指定类别，逗号分隔，如 P1,S1")
    args = ap.parse_args()

    try:
        if args.path == "-":
            text = sys.stdin.buffer.read().decode("utf-8", errors="replace")
        else:
            with open(args.path, "rb") as fh:
                raw = fh.read()
            try:
                text = raw.decode("utf-8-sig")
            except UnicodeDecodeError:
                text = raw.decode("gbk", errors="replace")
    except OSError as exc:
        print(f"[FAIL] 读取失败：{exc}", file=sys.stderr)
        return 2

    only = {c.strip().upper() for c in args.only.split(",") if c.strip()}
    rep = Report()
    scan_mechanical(text, rep)
    scan_style(text, rep)
    if only:
        rep.hits = [h for h in rep.hits if h["code"] in only]

    if args.json:
        print(json.dumps({"hits": rep.hits, "notes": rep.notes,
                          "chars": len(text)}, ensure_ascii=False, indent=2))
        return 1 if rep.hits else 0

    if rep.hits:
        by_code: dict[str, list[dict]] = {}
        for h in rep.hits:
            by_code.setdefault(f"{h['code']} {h['title']}", []).append(h)
        for key, items in by_code.items():
            print(f"[命中] {key}（{len(items)} 处）")
            for h in items:
                detail = f"  <- {h['detail']}" if h["detail"] else ""
                print(f"       第 {h['line']} 行 第 {h['col']} 列  {visible(h['text'])}{detail}")
    else:
        print("[OK] 未发现机械层面的可疑特征")

    if rep.notes:
        print("[统计]")
        for n in rep.notes:
            print(f"       - {n}")

    print(f"[NOTE] 全文 {len(text)} 字，命中 {len(rep.hits)} 处，"
          f"统计项 {len(rep.notes)} 条；本脚本只报位置，改写由判断层完成")
    return 1 if rep.hits else 0


if __name__ == "__main__":
    raise SystemExit(main())
