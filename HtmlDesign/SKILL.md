---
name: HtmlDesign
description: 制作 Apple 风格的 HTML 制品：官网/营销页（apple.com 视觉）、仿 iOS/macOS 应用界面（HIG）双模，含原型、幻灯片、设计系统与 PPTX/PDF/视频导出
---

# HtmlDesign

把想法做成**能用浏览器打开、能交互的 Apple 风格 HTML 制品** —— 原型、演示文稿、文档、设计系统。交付物是 HTML 本身，不是截图、不是图片。

**本技能产出的视觉语言只有 Apple 两套。** 需要别的品牌风格时不要用本技能。

## 何时使用

- 用户要 Apple 风格 / iOS / macOS 风格的界面、原型、mockup、"做个页面看看"
- 用户要幻灯片/演示文稿（HTML deck），或要能直接打印的文档
- 用户要建设计系统、UI kit，或要在项目里接入一套已有设计系统
- 用户要把设计导出为 PPTX / PDF / 视频，或交接给 Figma / Canva / 开发者

不适用：生产级前端工程（走常规开发流程）、纯位图生成、非 Apple 品牌风格。

## 第一步：定 mode（必做，不要跳过）

两套语言**互斥**，一页之内只能用一种。先判定，再动手：

| 制品类型 | mode | 权威文件 |
|---|---|---|
| 营销页、落地页、产品页、品牌站、活动页 | **web** | `apple/web-mode.md` |
| 仿原生 App 的 Web UI、移动原型、桌面应用外壳、控件级高保真稿 | **platform** | `apple/platform-mode.md` |
| 幻灯片 / 文档 | 二选一，**默认 web** | 同上 |
| 线框图 / 低调真 | 暂不套设计层 | 走 `built-in-skills/wireframe.md` |

判据冲突或用户没说清时**直接问**，不要替他猜 —— 猜错等于整份产物作废重做。

## 第二步：读设计层（按顺序）

| 顺序 | 文件 | 读法 |
|---|---|---|
| 1 | `apple/design-language.md` | **必读**。原则层：为什么这样做。冲突时以它为准 |
| 2 | `apple/motion.md` | **必读**。动效参数的**唯一权威源** |
| 3 | `apple/web-mode.md` **或** `apple/platform-mode.md` | 按 mode 读其中一个 |
| 4 | `apple/web-tokens.css` **或** `apple/platform-tokens.css` | **引入制品**，不要手敲数值 |
| 5 | `apple/checklist.md` | 交付前逐条核对 |
| 6 | `apple/ds-integration.md` | **按需**。仅当要把 token 当设计系统数据源去编译时读；日常直接 `<link>` 引入 token 文件不涉及 |

起步组件：`starter-components/apple-platform-starter.html`（iOS/macOS 控件包）。`web` 模式的起步页面见 `starter-components/apple-web-starter.html`。

`apple/` 下的内容为本技能自带，**不依赖任何外部仓库或临时目录**。

## 第三步：读宿主映射

`references/` 下按当前宿主选一份读。**主提示词只给能力名**（提问、预览、截图、导出），这一份给出能力名到真实工具的确切映射：

| 宿主 | 文件 |
|---|---|
| Claude Code | `references/claude.md` |
| Codex | `references/codex.md` |
| Cursor | `references/cursor.md` |

## 核心流程

1. **定目录** —— 制品落在 `designs/<project>/`；一个 HTTP 服务器服务整个 `designs/` 目录，所有项目共用（`python3 -m http.server 4311 --directory designs`）。
2. **定 mode 并读设计层** —— 见上两步。
3. **选形态** —— 按制品类型读 `built-in-skills/` 下对应文件，每个子技能自带完整指令、检查项和交付标准。
4. **起步用现成组件** —— `starter-components/` 里的文件 `cp` 进项目再改，不要从零手搓：
   `deck-stage.js`（幻灯片舞台与编辑模式）、`animations.jsx`（时间线动画 Stage）、`tweaks-panel.jsx`（页内调参面板）、`design-canvas.jsx`（画布）、`ios-frame.jsx` / `android-frame.jsx` / `macos-window.jsx` / `browser-window.jsx`（设备外框）、`image-slot.js`、`deck-stage-patch.md`。
   > 设备外框与 `platform` mode 天然搭配；`web` mode 用 `browser-window.jsx`。
5. **本地预览必须走 HTTP** —— 多文件原型（`<script src="…jsx">`）用 `file://` 打开一定加载不了（浏览器拦截跨源本地脚本读取）。起服务后开 `http://localhost:<port>/<project>/<file>.html`。
6. **验证后交付** —— 先跑视觉探针判断本会话是否支持读图，再决定要不要截图检查；交付时给出文件本身和可打开的 URL。
7. **过 `apple/checklist.md`** —— 任一条不过就先修再交。

## 工作方法（三条纪律，不随 mode 变化）

**1. 先取设计上下文，不要从头搓。**

好的高保真稿不从零开始，它们植根于已有的设计上下文。动手前先花时间**收集**：`starter-components/` 里的起步组件、用户已有的代码库或设计系统、截图、Figma。

**从零 mock 一个完整产品是最后手段，且必然导致糟糕的设计。** Apple 风格尤其如此 —— 它的说服力来自执行精度，而精度需要参照物。拿不到上下文就**开口向用户要**，不要闷头编。

**2. 问够问题。**

问足够多的好问题是必需的，不是可选项。本技能至少要问清：**mode（web / platform）**、**有无既有品牌或设计系统**、**有无真实产品图**。含糊处不要替用户猜 —— 猜错的代价是整份产物重做。

**3. 给多变体，并排呈现。**

同一需求给 **3 个以上跨维度变体**：按规范来的和带新意的混搭，有的用彩色或高级 CSS，有的纯图标。变异要发生在**内容编排、影像选择、节奏密度**这些真实维度上 —— 在固定设计系统里，换强调色不算变体。

并排比较时用**中性的呈现框架**，不要让它污染被评估的设计：

- 页面底层用中性灰
- 每个选项放进**带标签的独立画框**（小标题 + 一块按内容自适应大小的白色圆角卡片）
- 相关选项分组为区块

> 这个呈现框架是**工具层，不是制品**。它刻意保持中性、不套 Apple token —— 否则每块对比框本身都在暗示同一个答案，比较就失效了。

## 子技能索引

**探索与原型**
`wireframe`（线框与故事板）、`hi-fi-design`（高保真稿）、`interactive-prototype`（可用应用）、`mobile-prototype`（可加到主屏幕的移动原型）、`something-cool`。

> `frontend-design` 已改写为本技能的美学定调入口 —— 它不再主张自由发明方向，而是在 Apple 两套语言内部**选定性格并落实到细节**，并负责反"通用 Apple 仿制品"。需要非 Apple 品牌风格请另走别的技能。

**制品形态**
`make-a-deck`（幻灯片，静态 HTML 优先，保证文本可直接编辑）、`make-a-doc`（文档，开箱可打印）、`speaker-notes`（演讲者脚本）、`save-as-standalone-html`（单文件离线可用）、`save-as-pdf`、`read-pdf`。

**交互与动效**
`make-tweakable`（加入设计内调参控件）、`tweaks-protocol`（Tweaks 宿主协议 postMessage + 持久化）、`low-level-tweaks-api`（面板自由文本回传）、`animated-video`（时间线动效）、`sound-effects`、`generate-images`、`claude-api-in-prototypes`（在制品里调 Claude）。

**设计系统**
`design-system-authoring-guide`（从建/导入到编译成 bundle 的全流程，主入口）、`create-design-system`、`design-components`、`design-system-preview`（编译成单个自包含预览页）、`use-design-system`（在项目里消费已有系统，导入到 `_ds/<slug>/` 并记录绑定）。

**导入**
`import-from-figma`（离线解 .fig）、`import-from-html`（读代码不读截图）、`import-from-github`（按需稀疏导入并记来源）。

**导出与交接**
`export-as-pptx-editable`（可编辑，默认）、`export-as-pptx-screenshots`（像素级不可编辑）、`export-as-video`、`handoff-to-claude-code`（开发者交接包）、`send-to-figma`、`send-to-canva`。

## 常见错误

- **没定 mode 就开做** —— 最贵的错误。整份产物可能方向性作废。先问清楚。
- **混用两套语言** —— 把 Action Blue 单一强调色用在仿 App 界面上，或把系统色族用在官网上。一页只用一套。
- **动效凭感觉取曲线** —— `ease-in`、内置 `ease-out`、贝塞尔伪弹簧都是禁止值。参数只从 `apple/motion.md` 取。
- **手敲颜色和字号** —— 应该引入 `apple/*-tokens.css`。手敲会漂移，且会漏掉尺寸专属的字距。
- **用 `file://` 打开多文件原型** —— 组件静默加载失败，页面一片空白。必须走 HTTP。
- **`text/babel` 块里给顶层绑定起 window 全局名** —— `status`、`name`、`open`、`top`、`length`、`history` 等；Babel 把转译结果当经典脚本注入，顶层 `const`/`let` 变 `var` 就成了写 `window.*`，页面报错而控制台未必显示。取长一点的变量名。
- **把能静态表达的内容写成 React/JS 渲染** —— 直接写 HTML 元素，用户才能在编辑模式里点开重输；脚本渲染的内容每次修改都要绕一圈对话。
- **截图前没跑视觉探针** —— 模型不接收图像输入时，截图会把上下文搞坏。探针不通过就走文本 + DOM 证据验证（`document.body.innerText`、元素数量、`getBoundingClientRect()`）。
- **`prefers-reduced-motion` 写成一刀切** —— `* { animation-duration: 0.01ms !important }` 会把有助于理解的淡变也干掉。要更温和的变体，不是零。

## 当前不完整的部分

本技能的文件在 2026-09-25 的一次还原事故中丢失部分，以下是各文档引用但**当前不存在**的文件：

- `system-prompt.md`（主提示词本体）、`package.json`、`tsconfig.json`
- `agents/` 顶层脚本：`compile-design-system.mjs`、`check-design-system.mjs`、`import-design-system.mjs`
- `agents/` 子代理提示词：`fork-verifier-agent.md`、`vision-probe-agent.md`、`design-system-checker.md`
- `agents/vendor/babel.min.js`（浏览器内 JSX 转换，运行时依赖）
- `agents/gen-pptx/dist/cli.mjs`、`agents/gen-video/` 全部源码

影响：**设计系统的编译/检查/导入、PPTX 与视频导出、子代理验证**这几条链路当前不可用；`built-in-skills/` 下 33 个子技能文档、`starter-components/` 下 10 个起步组件、`agents/lib/{asset-store,ds-core,ds-prompt}.mjs` 与 `agents/gen-pptx/src/` 源码完好，制品设计与制作仍可进行。依赖上述缺失文件时，先告知用户该能力当前缺失，不要假装调用。
