# 内容纪律与排版工艺（中文摘录）

本文件是上游英文主提示词 `system-prompt.md` 中**尚适用于本技能**的部分的中文摘录。该原文已不再随技能分发（见 `SKILL.md` 的「当前不完整的部分」）。

**权威顺序**：`apple/design-language.md` > `apple/{web,platform}-mode.md` > `apple/motion.md` > 本文件。
本文件**不授权**任何与 `apple/` 冲突的做法 —— 尤其**不授权手写字体或配色**，那必须走 `apple/*-tokens.css`。本文件只补 `apple/` 未覆盖的通用内容纪律与排版细节。

---

## 1. 内容纪律

**不要填充。** 绝不用占位文本、凑数段落或"资讯性"内容把版面撑满。每个元素都要自己挣得位置。一块地方显得空，那是**布局与构图要解决的问题，不是靠发明内容解决**。一千个"不"换一个"是"。避免"数据垃圾" —— 用不上的数字、图标、统计一律不加。少即是多，偏向极简。

**加内容前先问。** 觉得多加几个板块、页面、文案或内容会更好时，**先问用户**，不要单方面加。用户比你更清楚他的受众和目标。

## 2. 反 AI 套路

除 `apple/checklist.md` 已列的「无装饰性渐变」「无 Emoji」外，另注意：

- **避开被用滥的字体**（Inter、Roboto、Arial、Fraunces 一类）。字体一律从 `apple/*-tokens.css` 取，不要自行引入。
- **不要用 SVG 画影像。** 需要图就用占位并**向用户要真实素材**，或用 `starter-components/image-slot.js` 摆好正确比例的槽位让用户往里丢图。绝不手搓 SVG/HTML 冒充位图。
- 避免「圆角容器 + 左侧彩色边框」这类被用滥的卡片形态。

## 3. 尺度

- **1920×1080 幻灯片**：文字**不得小于 24px**，理想情况下要大得多。
- **打印文档**：最小 **12pt**。
- **移动端稿件的点击目标**：不得小于 **44px**。

## 4. CSS 技法

- **优先 `flex` / `grid` 配合 `gap`，不要用行内流布局。** 任何一行或一组同级元素（按钮、胶囊、图标、卡片、导航项、工具条）都用 `display: flex` 或 `display: grid` 加 `gap:` 控制间距 —— **不要**靠源码空白符或逐个元素的 margin 去隔开行内/行内块兄弟节点。flex/grid 的间距是显式的，后续编辑（重排、删除、复制）时依然成立；行内流依赖空白文本节点，一改就碎。行内流只留给**句子内部的文字流**（句子里偶尔夹一个 `<a>`/`<strong>`/`<em>`），不用来排 UI 元素。
- `text-wrap: pretty`、CSS grid 以及其他现代 CSS 效果都可以放心用。

## 5. CJK 与多语言排版

界面同时出现中文（或日文、韩文）与拉丁文时：

- **用拉丁优先的系统 CJK 字体栈**，让每种文字都拿到正确的字形：
  `font-family: -apple-system, "SF Pro Text", "PingFang SC", "Noto Sans SC", sans-serif;`
  （`web` mode 下正文/UI 用 `--font-text`、大字用 `--font-display`，都已在 `apple/web-tokens.css` 里定义好，直接引用即可；上例是无 token 可用时的兜底形态。）
- **中文正文行高要比拉丁文更大**（阅读场景约 **1.7–1.8**）—— 汉字密度高，需要更多纵向空间。
- **给内容打 `lang="zh"` / `lang="en"`**，浏览器才能选对字体与断行规则。
- **多数"阅读型衬线"网页字体不覆盖 CJK。** 若提供衬线阅读模式，必须给拉丁衬线配一个中文衬线兜底（如 `"Newsreader", "Songti SC", "Noto Serif SC", serif`）—— 否则中文会静默回退到无衬线，衬线开关在中文文本上看起来就是坏的。

---

## 来源与范围说明

- 摘录自 `system-prompt.md`（40,979 B，英文，272 行）的 `## Content Guidelines`（原行 210–233）与 `## Output creation guidelines`（原行 28–41）两节中**当前仍适用**的条目。
- **未摘录**的部分及理由：`Harness setup`、`Your workflow`、`Asking questions`、`How to do design work`、`Starter Components`、`Verification`、`Skills` 索引 —— 已被现 `SKILL.md` 与 `references/{claude,codex,cursor}.md` 接管；`React + Babel`（pinned CDN + integrity 哈希）—— 已由 `agents/lib/ds-prompt.mjs` 的 `REACT_UMD_TAGS` / `BABEL_TAG` 常量承载，是更可靠的载体；`Fixed-size content`、`In-page controls`、`GitHub`、`Napkin Sketches`、`System placeholders`、`Web Search and Fetch` —— 已被 `built-in-skills/` 下的对应文档接管。
- **改写而非直译**的一处：原文「若已有字体系统就用它，否则写几个 `<style>` 用字体变量让用户调」在 Apple 双模下**不成立**（本技能禁止手写字体）。第 5 节已改写成"从 token 取"的口径。
