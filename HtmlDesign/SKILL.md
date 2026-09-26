---
name: HtmlDesign
description: 制作 Apple 风格的 HTML 制品：官网/营销页（apple.com 视觉）、仿 iOS/macOS 应用界面（HIG）双模，含原型、幻灯片、设计系统与打印/PDF 交付
---

# HtmlDesign

把想法做成**能用浏览器打开、能交互的 Apple 风格 HTML 制品** —— 原型、演示文稿、文档、设计系统。交付物是 HTML 本身，不是截图、不是图片。

**本技能产出的视觉语言只有 Apple 两套。** 需要别的品牌风格时不要用本技能。

## 何时使用

- 用户要 Apple 风格 / iOS / macOS 风格的界面、原型、mockup、"做个页面看看"
- 用户要幻灯片/演示文稿（HTML deck），或要能直接打印的文档
- 用户要建设计系统、UI kit，或要在项目里接入一套已有设计系统
- 用户要把设计交付为可打印的 PDF，或交接给开发者
  > **PPTX 与视频导出当前不可用**（缺构建产物与运行时依赖，见文末「当前不完整的部分」）；用户提出这两项时先说明现状，不要假装调用。

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

**起步组件**（两个起步包里每个组件都带标记，按名找、按块拷）：

| 文件 | mode | 内容 |
|---|---|---|
| `starter-components/apple-web-starter.html` | web | 整页瓦片节奏 + 导航/按钮/卡片/配置器/搜索/页脚 |
| `starter-components/apple-platform-starter.html` | platform | iOS/macOS 控件包：导航栏/分组列表/开关行/按钮/输入/分段控件/搜索/标签栏/Sheet/Alert/卡片 |

标记约定：`<!-- [COMPONENT: slug] -->` 标单个组件；`[COMPONENT-FAMILY: slug]` 标一族变体（如 `button`、`product-tile`）。用 `grep -o '\[COMPONENT[^]]*\]'` 可列全。两个包都通过 `<link>` 引入对应的 `apple/*-tokens.css`，**cp 进项目时先改这处相对路径**。

`apple/` 下的内容为本技能自带，**不依赖任何外部仓库或临时目录**。

## 第三步：读宿主映射

`references/` 下按当前宿主选一份读。**主提示词只给能力名**（提问、预览、截图、导出），这一份给出能力名到真实工具的确切映射：

| 宿主 | 文件 |
|---|---|
| Claude Code | `references/claude.md` |
| Codex | `references/codex.md` |
| Cursor | `references/cursor.md` |

另有一份**与宿主无关**的 `references/content-craft.md`（**按需**）：上游英文主提示词里仍适用的内容纪律、尺度、flex/grid 间距纪律与 **CJK 排版**。做中文界面、幻灯片或文档时值得一读。与 `apple/` 冲突时一律以 `apple/` 为准。

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
`make-a-deck`（幻灯片，静态 HTML 优先，保证文本可直接编辑）、`make-a-doc`（文档，开箱可打印）、`speaker-notes`（演讲者脚本）、`save-as-standalone-html`（单文件离线可用）、`save-as-pdf`。

**交互与动效**
`make-tweakable`（加入设计内调参控件）、`tweaks-protocol`（Tweaks 宿主协议 postMessage + 持久化）、`low-level-tweaks-api`（面板自由文本回传）、`animated-video`（时间线动效）、`generate-images`（需本机有图像后端，否则按该文档第 4 步告知用户，不要静默兜底）。

**设计系统**
`design-system-authoring-guide`（从建/导入到编译成 bundle 的全流程，主入口）、`create-design-system`、`design-components`、`design-system-preview`（编译成单个自包含预览页）、`use-design-system`（在项目里消费已有系统，导入到 `_ds/<slug>/` 并记录绑定）。

**导入**
`import-from-html`（读代码不读截图）、`import-from-github`（按需稀疏导入并记来源）。
> `import-from-figma`（离线解 .fig）**当前不可用** —— 入口脚本 `agents/import-figma.mjs` 已恢复，但解码器 `agents/vendor/fig-materialize.mjs` 已决定不恢复（来源不可归属），调用必然报 `ERR_MODULE_NOT_FOUND`。

**导出与交接**
`export-as-pptx-editable`（可编辑，默认）、`export-as-pptx-screenshots`（像素级不可编辑）、`export-as-video`、`handoff-to-claude-code`（开发者交接包）。

> `export-as-pptx-*` 与 `export-as-video` 当前**不可用**（缺构建产物与依赖，见文末「当前不完整的部分」）。`send-to-figma`、`send-to-canva` 依赖 claude.ai 网络产品专有工具，在 Claude Code 下不成立，已从本索引移除。

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

本技能的文件在 2026-09-25 的一次还原事故中丢失部分。**2026-09-26 已从事故外的祖先快照恢复设计系统管线**（编译/检查/导入/预览）、Figma 导入入口脚本、资产登记，以及三份子代理提示词。以下是**当前仍不存在**的文件：

- `agents/vendor/fig-materialize.mjs`（319 KB，`.fig` 离线解码器）—— **已决定不恢复**（理由：来源不可归属 —— 无版本号、无许可头、无上游 URL，无法核验；其内嵌 54 KB WASM 的能力面经枚举确认无法 I/O，但来源不可归属本身已足以否决）。`agents/import-figma.mjs` 已恢复，但因此**当前必然报 `ERR_MODULE_NOT_FOUND`**。该悬空引用**有意保留**，以保住将来恢复的路径
- `agents/gen-pptx/` 的 21 个源文件（`src/cli.ts`、`src/index.ts`、`src/types.ts`、`src/render/**`、`src/browser/{capture-editable,capture-screenshot,dom-style,entry,gradient}.ts`、`package.json`、`tsconfig.json`、`package-lock.json` 等）及其两个构建产物 `dist/cli.mjs`、`dist/capture.iife.js`
- `agents/gen-video/` 的全部 14 个源文件及其 `dist/cli.mjs`
- `system-prompt.md`（上游英文主提示词，40,979 B）—— **有意不恢复**；其中仍适用于本技能的内容已摘入 `references/content-craft.md`

**影响**：**PPTX 导出**与**视频导出**两条链路不可用。二者都需要 `npm install` + `npx playwright install chromium`（约 150 MB）并构建，视频另需系统 `ffmpeg`；且文档给的安装命令会把 `node_modules` 装进技能目录，违反本机"大依赖装 D 盘"的约定，故本次未执行。**Figma 导入**因缺解码器不可用。

**以下能力已恢复且可用**：设计系统的编译 / 检查 / 导入 / 预览（`preview.html`）、资产登记（`_d_meta.json`）、视觉探针与子代理校验。

`[NOTE]` 本机 Claude Code 环境下**另有 6 项能力本来就不成立**（依赖 claude.ai 网络产品专有工具，与本次事故无关）：

| 子技能 | 依赖的未映射工具 | 处置 |
|---|---|---|
| `send-to-figma` | `generate_figma_design`（Figma MCP） | 已从索引移除，**本宿主不要调用** |
| `send-to-canva` | `super_inline_html`、`get_public_file_url`、`present_fs_item_for_download`、`canva__*` | 同上 |
| `sound-effects` | `generate_sound`（ElevenLabs） | 同上 |
| `claude-api-in-prototypes` | `window.claude.complete` | 同上 |
| `read-pdf` | `readFileBinary`、`log` | 同上 |
| `read-pdf` | `readFileBinary`、`log` | 需按替换表改写成 Node 版；文档里的片段是浏览器沙箱形态 |
| `save-as-pdf` | `open_for_print`（仅末步） | **已有本地替代且已实跑验证**，见下 |

`references/claude.md` 的「Web tool → Claude Code tool map」本应给出这些工具在本宿主的替代。**这 10 个现已全部补入该表**，逐个标注处置：`open_for_print` 与 `readFileBinary` 给了可照做的本地替代，其余标注**本机无替代**并写明**缺的是哪个后端**。详见该文档的「Web tools with no drop-in equivalent」与「Exporting to PDF (print)」两节。

`save-as-pdf` 的本地替代（**已实跑验证** —— 起 `designs` 服务器、取回 `-print.html` 及其相对 CSS/图片，均 HTTP 200 且内容与源逐字节一致）：
它的产物是 `-print.html`（打印就绪 HTML），**生成本身不依赖任何缺失件**；末步改为：**复用同一个 `designs` HTTP 服务器**把 `-print.html` 伺服出来，把 `http://localhost:<port>/<project>/<file>-print.html` 交给用户自行在浏览器里打印为 PDF。
**不要**用 `SendUserFile` 单独发这个文件 —— 它的相对资源路径只在该服务器下才解析得对。用户侧"另存为 PDF"那一步是 agent 无法代劳也无法验证的，如实告知即可。

这 6 份子技能文档仍留在 `built-in-skills/` 下，供 Codex / Cursor 等宿主按需参考。

依赖上述缺失文件时，先告知用户该能力当前缺失，不要假装调用。
