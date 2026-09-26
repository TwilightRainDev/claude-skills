# mode: platform —— iOS / macOS 应用界面（HIG）

**适用**：仿原生 App 的 Web UI、移动端原型、桌面应用外壳、控件级高保真稿。
**不适用**：营销页与官网 —— 那走 `web-mode.md`。

两者是**两套不同的设计语言**，不要混。同一个产品可以两种都用，但一页之内只能用一种：`web` 用 Action Blue 单一强调 + 通版瓦片；`platform` 用系统色族 + 控件密度。

**动效参数以 `motion.md` 为准。** 本节若出现 `--ease-in` 或回弹贝塞尔，**一律忽略** —— 那是被禁用的值。

## 四支柱

1. **Clarity（清晰）** —— 每个元素都有目的；消除不必要的复杂；用户无需说明即能理解；用清晰的视觉层级。
2. **Deference（尊重内容）** —— UI 支持内容而非与之竞争；最小化 chrome 与视觉噪音；让内容当主角；用克制的背景与边框。
3. **Depth（层次）** —— 用分层建立清晰层级；有目的地使用阴影、模糊、半透明；动效强化空间关系；Z 轴传达重要性。
4. **Consistency（一致性）** —— 跨平台熟悉的模式；可预测的交互；统一的视觉语言；尊重平台惯例。

## 排版

### 字体栈

```css
--font-system: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text',
               'Helvetica Neue', Arial, sans-serif;
--font-mono: 'SF Mono', SFMono-Regular, ui-monospace, Menlo, Monaco, Consolas, monospace;
--font-rounded: -apple-system-rounded, 'SF Pro Rounded', 'Helvetica Neue Rounded', var(--font-system);
```

### 字号阶（iOS）

| Token | 值 | 名称 |
|---|---|---|
| `--text-caption2` | 11px | Caption 2 |
| `--text-caption1` | 12px | Caption 1 |
| `--text-footnote` | 13px | Footnote |
| `--text-subhead` | 15px | Subheadline |
| `--text-callout` | 16px | Callout |
| `--text-body` | 17px | **Body（默认）** |
| `--text-headline` | 17px | Headline（半粗） |
| `--text-title3` | 20px | Title 3 |
| `--text-title2` | 22px | Title 2 |
| `--text-title1` | 28px | Title 1 |
| `--text-large-title` | 34px | Large Title |

主页 hero 可用显示尺寸：40 / 56 / 80 / 96px。

**规则：** ≥ 20pt 用 SF Pro Display，< 20pt 用 SF Pro Text。行高保持 1.2–1.5。**用字重建立层级，不只靠字号。**

字距阶梯：`-0.03em`(tighter) / `-0.02em`(tight) / `0`(normal) / `0.02em`(wide) / `0.04em`(wider)。
行高阶梯：`1.1`(tight) / `1.2`(snug) / `1.4`(normal) / `1.5`(relaxed) / `1.75`(loose)。

## 颜色

### 系统色（浅色）

```
blue    #007AFF    green   #34C759    indigo  #5856D6    orange  #FF9500
pink    #FF2D55    purple  #AF52DE    red     #FF3B30    teal    #5AC8FA
yellow  #FFCC00    cyan    #32ADE6    mint    #00C7BE    brown   #A2845E
```

### 系统色（深色）

```
blue    #0A84FF    green   #30D158    indigo  #5E5CE6    orange  #FF9F0A
pink    #FF375F    purple  #BF5AF2    red     #FF453A    teal    #64D2FF
yellow  #FFD60A
```

深色模式下 gray 同样取反：`gray #8E8E93` 不变，`gray2 #636366`、`gray3 #48484A`、`gray4 #3A3A3C`、`gray5 #2C2C2E`、`gray6 #1C1C1E`。

### 灰度（浅色）

`#8E8E93`(gray) · `#AEAEB2`(gray2) · `#C7C7CC`(gray3) · `#D1D1D6`(gray4) · `#E5E5EA`(gray5) · `#F2F2F7`(gray6)

### 语义色

**文字（label）** —— 浅色：`#000000` / `rgba(60,60,67,0.6)` / `rgba(60,60,67,0.3)` / `rgba(60,60,67,0.18)`；深色：`#FFFFFF` / `rgba(235,235,245,0.6)` / `rgba(235,235,245,0.3)` / `rgba(235,235,245,0.18)`。四级依次是 primary / secondary / tertiary / quaternary。

**填充（fill）** —— `rgba(120,120,128,0.2)` / `0.16` / `0.12` / `0.08`。

**背景** —— 浅色 `#FFFFFF`(primary) / `#F2F2F7`(secondary) / `#FFFFFF`(tertiary)；深色 `#000000` / `#1C1C1E` / `#2C2C2E`。分组背景：`#F2F2F7` 外层 + `#FFFFFF` 内层。

**分隔线** —— 浅色 `rgba(60,60,67,0.29)`，不透明白 `#C6C6C8`；深色 `rgba(84,84,88,0.6)`，不透明白 `#38383A`。

**所有颜色必须通过 `prefers-color-scheme` 提供明暗两套。** 不要只写浅色。

## 间距 —— 8pt 网格

`0` · `1px` · `2` · `4` · `6` · `8` · `10` · `12` · `14` · `16` · `20` · `24` · `28` · `32` · `36` · `40` · `44` · `48` · `56` · `64` · `80` · `96` · `112` · `128`

### 触控目标

| 平台 | 最小值 |
|---|---|
| iOS | **44×44 pt** |
| visionOS | 60 pt |
| 舒适 | 48px |
| 宽裕 | 56px |

小视觉元素必须靠内边距补足命中区，不要靠放大图标。

## 圆角 —— 同心规则

`0` · `4px` · `8` · `12` · `16` · `20` · `24` · `32` · `9999px`(capsule)

语义别名：`--radius-button: 9999px`（胶囊）· `--radius-card: 16px` · `--radius-modal: 20px` · `--radius-input: 8px`

**同心规则：`内圆角 + 内边距 = 外圆角`。** 例：8px 内圆角 + 8px 内边距 = 16px 外圆角。嵌套圆角不满足这个等式时，视觉上会"不圆"，这是最常见的仿原生破绽。

## 纵深

| Token | 值 |
|---|---|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.04)` |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)` |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.06)` |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.04), 0 4px 6px rgba(0,0,0,0.08)` |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.06), 0 8px 10px rgba(0,0,0,0.1)` |
| `--shadow-2xl` | `0 25px 50px rgba(0,0,0,0.15)` |
| `--shadow-focus` | `0 0 0 4px rgba(0,122,255,0.3)` |
| `--shadow-focus-error` | `0 0 0 4px rgba(255,59,48,0.3)` |
| `--shadow-inset` | `inset 0 2px 4px rgba(0,0,0,0.05)` |

模糊阶梯：`4` / `8` / `16` / `24` / `40` / `64` px。玻璃用 `backdrop-filter: blur(20px) saturate(180%)`。

## 组件规格

### 按钮

- **主按钮** —— 胶囊形（`9999px`），`min-height: 44px`，系统蓝底白字，600 字重。
- **次按钮** —— 同胶囊形，系统蓝字配 `rgba(0,122,255,0.1)` 底。
- **按下反馈** —— `:active` 时 `scale(0.98)`，用 `--duration-instant` + `--ease-out`。

### 卡片

- **默认** —— 实色底（`--bg-tertiary`），16px 圆角，轻微阴影。
- **分组样式** —— `--bg-secondary` 外层容器 + `--bg-tertiary` 内层条目，用 `--separator` 分隔。

### 输入框

`min-height: 44px`，`--bg-secondary` 底，12px 圆角。焦点态 `box-shadow: 0 0 0 4px rgba(0,122,255,0.3)`。

### 标签栏（Tab Bar）

固定底部，高 **49px** + safe-area 内边距。每个 tab 最小 44×44pt。**必须显示文字标签，绝不只用图标。** 选中态用实心 SF Symbol，未选中用线框。支持角标（红色椭圆 + 白字）。

```css
padding-bottom: env(safe-area-inset-bottom);
```

### 工具栏（Toolbar）

三段式：leading（返回/标题）、center（工具）、trailing（动作）。最多 3 组。SF Symbols 不带边框。主操作放 trailing 侧并用 `.prominent` 样式。返回按钮是圆形、只有符号、无文字。

### Sheet

Detents：`large`(100%) 与 `medium`(50%)。含抓取条（36×5px，居中）。完成按钮右上，取消按钮左上。遮罩 `rgba(0,0,0,0.4)`。

### 警告框（Alert）

**克制使用，仅限关键信息。** 最多 3 个按钮。用具体动词做标题，避免"确定"。取消在 leading 侧；破坏性操作只用于非预期的危险动作。宽度 270px，圆角 14px。

### 列表与表格

最小行高 44px。信息按钮（i）无跳转地揭示详情；披露指示符（>）跳转到子视图。分组样式 10px 圆角，内缩分隔线从 60px 处开始。

### 玻璃效果

**默认用实色底。** 仅在用户明确要求玻璃/磨砂效果时使用，且**必须提供不支持 `backdrop-filter` 的降级方案**。参数：`backdrop-filter: blur(20px) saturate(180%)` 配半透明背景。

> 注：`web-mode` 把半透明材质当常规层次表达手段，`platform-mode` 默认实色 —— 这是两套语言的真实差异，按当前 mode 走，不要互相借。

## SF Symbols

**四种渲染模式：** Monochrome（单色）· Hierarchical（同色透明度分层）· Palette（逐层自定义色）· Multicolor（Apple 内置色）。

**用法：** 工具栏/导航用线框变体，标签栏用实心变体。符号自动与 SF 字体对齐。**始终提供文字替代（`aria-label`）。**

Web 上没有真 SF Symbols，用 SVG 图标近似 —— 不要用私有区码点字符（`&#xF...;` 那套），它们在非 Apple 设备上会显示成豆腐块。

## 无障碍

- 正文对比度 **4.5:1** 最低（WCAG AA），大字号 **3:1**。
- 交互元素的状态必须明确可辨。
- 用语义化 HTML（`<button>`、`<nav aria-label>`、`<main>`）。
- **减少动态写在 `motion.md` 里，不要用 `* { animation-duration: 0.01ms !important }` 这种一锅端写法。**

## 布局与 z-index

内容宽度：`320` / `480` / `640` / `768` / `1024` / `1280` / `1440`(max)。

断点：`430px`(compact) · `744px`(regular) · `1024px`(large) · `1280px`(xl)。

z-index 阶梯：`0` base · `100` dropdown · `200` sticky · `300` fixed · `400` modal-backdrop · `500` modal · `600` popover · `700` tooltip · `800` toast · `9999` max。

## 交付清单

出稿前逐条核对：

- [ ] 字体用 SF Pro 栈，尺寸阈值正确（≥20pt Display / <20pt Text）
- [ ] 颜色用系统色且**提供明暗两套**
- [ ] 间距走 8pt 网格
- [ ] 触控目标 ≥ 44×44pt
- [ ] 嵌套圆角满足同心等式
- [ ] 动效参数取自 `motion.md`，无 `ease-in`、无贝塞尔伪弹簧
- [ ] WCAG AA 达标，`prefers-reduced-motion` 有更温和的变体（不是一刀切 0.01ms）
- [ ] 玻璃效果仅按需使用且带降级
- [ ] 语义化标签与 `aria-*` 完整
