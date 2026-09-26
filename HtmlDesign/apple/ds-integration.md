# apple token 层与 ds-core 的接入口径

本文件记录 `apple/web-tokens.css` 与 `apple/platform-tokens.css` 相对于本技能既有设计系统机制（`agents/lib/ds-core.mjs`）的确切关系。**以下全部是读源码实测的结论，不是推测。**

## 现状

两套 token 文件是**独立层**：主用法是制品直接 `<link>` 引入，不经任何编译。它们与 `ds-core` 之间**没有接线**，但**可以接线** —— 口径如下。

## ds-core 认什么（实测）

`buildModel(projectDir)` 找设计系统的全局 CSS 入口，规则有两条：

1. **文件名白名单**（`CSS_ENTRY_NAMES`）：basename 必须**精确等于** `styles.css` / `index.css` / `globals.css` / `global.css` / `main.css` / `theme.css` / `app.css` / **`tokens.css`** 之一，取路径最浅的那个。
2. 白名单未命中时，退回读 `_ds_manifest.json` 的 `globalCssPaths`，取其**最后一项**（后序遍历，最后一项即入口本身）。

找到入口后，`resolveCssClosure` 展开 `@import` 闭包（后序：被导入文件的声明排在导入者之前），`extractTokens` 再从闭包内**全部文件**抽取自定义属性。

## 三条关键结论

### 1. 我的两个 token 文件不能被当作入口

`web-tokens.css` 与 `platform-tokens.css` 的 basename **不在白名单里**。设计系统项目若想消费它们，必须自己建一个白名单入口：

```css
/* tokens.css —— 项目里的入口，名字必须是白名单之一 */
@import 'apple/web-tokens.css';
```

这样两个文件的声明就进入闭包，被正常抽取。（`resolveCssClosure` 只展开 `@import`，不认 `<link>`。）

### 2. token 抽取是「选择器盲」的正则扫描

```js
const DECL_RE = /(--[A-Za-z0-9-]+)\s*:\s*([^;]+);[ \t]*(?:\/\*\s*@kind\s+([A-Za-z]+)\s*\*\/)?/g;
```

它**不解析 CSS 结构**，全文件线性扫描。两个直接后果：

- **明暗两套会塌成一个。** `platform-tokens.css` 里 `--system-blue` 在 `:root` 与 `@media (prefers-color-scheme: dark)` 各定义一次，抽取后 `valueByName` 是 `Map`，**后写的暗色值覆盖亮色值**，且 `tokens` 数组里会留下**同名重复条目**。
  - 这是 `ds-core` 的模型局限，不是我的文件写错了。**不要为了迁就它而拆分明暗文件** —— 那会让主用法（人/agent 直接 `<link>` 一个文件）变差，是本末倒置。
  - 真要走 ds 管线又需要明暗区分时，在**入口文件**里覆盖，不要动 `apple/` 下的文件。
- **`@import` 闭包内不要有同名 token**，否则同样是后者覆盖前者。

> 顺带：抽取器会跳过值里含 `{` 或 `}` 的声明（用于排除跨选择器边界的幻影匹配）。我的 token 值都不含花括号，不受影响。

### 3. 分类器只认三类，我的动效与排版 token 会全部落进 `other`

`classifyByValue` 的判定逻辑：

| 结果 | 条件 |
|---|---|
| `shadow` | 同时含颜色与长度 |
| `color` | 含颜色（hex / `rgb()` 族 / 具名色） |
| `spacing` | 含长度 —— 正则单位集是 `px\|rem\|em\|vh\|vw\|vmin\|vmax\|%\|pt` |
| `null` → 记入 `unclassified`，kind 置 `other` | 都不含 |

**注意长度正则里没有 `ms`。** 因此在 `apple/` 两套 token 里：

| token 类 | 抽取结果 |
|---|---|
| 颜色、阴影、`px` 尺寸与间距、圆角、`px` 字距 | 正常分类 |
| **时长**（`160ms` 等） | `other` + 进 `unclassified` |
| **缓动**（`cubic-bezier(...)`） | `other` |
| **无单位行高**（`1.47`） | `other` |
| **字重**（`300` / `600`） | `other` |
| **字体族**（字符串） | `other` |

要修正，可在声明尾部加 `@kind` 注解（`DECL_RE` 的第三个捕获组，会**覆盖**按值分类的结果）：

```css
--duration-press: 160ms; /* @kind duration */
```

**这件事目前没做**，理由：ds 管线当前是断的（`import-design-system.mjs` 缺失，见 `SKILL.md` 的缺口清单），注解是纯机械劳动且可随时批量补。**管线修复时再补**，不要现在为一个用不上的消费者增加两套 token 文件的噪音。

## 什么时候需要管这件事

只有一种情况：**把 `apple/` 的 token 当成一个设计系统的数据源**去编译成 `_ds/<slug>/` bundle。

日常使用（制品直接 `<link>` 引入 token 文件）**完全不涉及本文件描述的任何机制**，不需要入口白名单、不需要 `@kind`、不受明暗塌陷影响。
