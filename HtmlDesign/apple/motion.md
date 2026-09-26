# 动效系统

**本文件是动效参数的唯一权威源。** 两个 mode 文件里的缓动值仅供参考，冲突时一律以本文件为准 —— 平台 mode 素材里出现的 `--ease-in` 与回弹贝塞尔在本体系中**禁用**，理由见下。

## 唯一合法的三个缓动 token

内置的 CSS `ease-out` / `ease-in-out` 太弱，必须用这三个：

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);      /* UI 通用强 ease-out */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);  /* 屏幕内移动/形变 */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);   /* iOS 感抽屉曲线 */
```

需要别的曲线时从 easing.dev / easings.co 取，**不要手搓**。

**禁用清单：**

| 禁用 | 原因 |
|---|---|
| `ease-in` | 起步慢，恰好拖慢用户正在盯的那一刻。同样 200ms，`ease-out` 感觉比 `ease-in` 快 |
| `--ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275)` | 这是回弹贝塞尔，**不是弹簧**。要回弹请用真弹簧（见下），不要用贝塞尔伪装 |
| `--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55)` | 同上，且过冲量夸张 |
| `transition: all` | 隐式动画会波及你没打算动的属性 |

## 时长

| 元素 | 时长 |
|---|---|
| 按钮按压反馈 | 100–160ms |
| Tooltip、小 popover | 125–200ms |
| 下拉、选择器 | 150–250ms |
| 模态、抽屉 | 200–500ms |
| 营销 / 说明性 | 可以更长 |

**UI 动效保持在 300ms 以内。** 180ms 的下拉比 400ms 的感觉更跟手。

## 缓动选择（按决策顺序）

| 场景 | 缓动 |
|---|---|
| 进场或退场 | `--ease-out` |
| 屏幕内移动 / 形变 | `--ease-in-out` |
| Hover / 颜色变化 | `ease` |
| 恒定运动（跑马灯、进度） | `linear` |
| 默认 | `--ease-out` |

## 弹簧——什么时候用，用什么值

需要弹簧而非时长的场合：**带惯性的拖拽、应该显得有生命的元素、用户能中断或反转的手势、装饰性的鼠标跟随。**

```js
{ type: "spring", duration: 0.5, bounce: 0.2 }            // Apple 风格：更好推理
{ type: "spring", mass: 1, stiffness: 100, damping: 10 }  // 传统物理：更细的控制
```

- **bounce 保持 0.1–0.3**，且大多数 UI 里避免回弹 —— 留给拖拽消失和玩味交互。
- 无需回弹的场合用 `bounce: 0`。
- Apple 出厂参数（damping / response）：移动 `1.0 / 0.4`、旋转 `0.8 / 0.4`、抽屉与 Sheet `0.8 / 0.3`。参见 `design-language.md` 第 4 节。

## 构建序列（按顺序走，第 1、2 步是闸门）

### 1. 这个该动吗？

| 频率 | 决策 |
|---|---|
| 每天 100+ 次（快捷键、命令面板开关） | **不做动画。永远不做。到此为止** |
| 每天几十次（hover、列表导航） | 只做近乎不可察觉的 —— 快而微弱，否则不做 |
| 偶尔（模态、抽屉、toast） | 标准动画 |
| 罕见 / 首次（引导、成功、庆祝） | 愉悦预算花在这里 |

**键盘触发的动作是取消资格，不是判断题。** 一天开几百次的东西不该有开关动画。

若请求过不了这道闸，**直说，不要写动画**，并提供非动效替代（瞬时状态切换、静态可供性）。

### 2. 目的是什么？

先用下面一个词命名，再继续：

**反馈**（确认界面听到了用户）· **空间一致性**（表明某物从哪来、到哪去）· **状态指示**（让状态变化可读）· **防止突变**（衔接否则会瞬移的内容）· **说明**（演示某物如何工作，仅限营销/引导）· **愉悦**（**只**允许在罕见/首次层级）

命名不出来就别做。"在频繁出现的元素上因为它酷"是停下的理由。

再检查**功能**：用户正在阅读或操作的数据不应为了风格而移动。装饰性的鼠标跟随属于营销页，不属于银行 App 里的图表。

### 3. 选工具 —— 够用的最便宜的那个

自上而下走，停在第一个合适的：

| 需求 | 工具 |
|---|---|
| Hover、按压、颜色、由 class/attribute 控制的状态切换 | **CSS transition** |
| 挂载时的入场动画，无 JS 状态 | **CSS `@starting-style`** |
| 页面忙碌加载时仍需保持平滑的预定动效 | **CSS animation**（脱离主线程） |
| 需要编程控制但要 CSS 级性能、不要库 | **WAAPI**（`element.animate()`） |
| 弹簧、布局动画、退场动画、手势驱动的值 | **Motion**（motion.dev） |

CSS 动画在负载下胜过 JS —— 它跑在主线程之外，而基于 `requestAnimationFrame` 的动效会在浏览器加载、执行脚本或绘制时掉帧。**预定动效用 CSS，动态与可中断动效用 JS。**

### 4. 选属性

- **只动 `transform` 和 `opacity`。** 它们跳过 layout 和 paint，跑在 GPU 上。`width`/`height`/`margin`/`padding`/`top`/`left` 三者全触发。（`clip-path` 是获准的第四个；`height` 只在手风琴里被容忍，因为那里没有 transform 等价物。）
- **绝不用 `scale(0)`。** 从 `scale(0.9–0.97)` + `opacity: 0` 开始。现实中没有东西从虚无中出现。
- **popover / 下拉 / 菜单 / tooltip 的 `transform-origin` 设在触发器上。** **模态是豁免的** —— 它不锚定到触发器，保持居中。
- **`translate()` 里的百分比相对于元素自身尺寸** —— `translateY(100%)` 按自身高度移动，与内容多少无关。优先于硬编码像素。
- **Motion 里用完整 transform 字符串。** `x`/`y`/`scale` 简写不走硬件加速，负载下掉帧：

```jsx
<motion.div animate={{ x: 100 }} />                          // 负载下掉帧
<motion.div animate={{ transform: "translateX(100px)" }} />  // 硬件加速
```

- **绝不用父级的 CSS 变量驱动子元素的 transform** —— 那会为每个子元素重算样式。直接在元素上设 `transform`。

### 5. 可中断与退场

- **能被快速连触发的用 transition，不用 keyframes** —— toast、开关、任何一秒内可能被触发两次的东西。transition 从当前值重定向；keyframes 从零重启。
- **手势用弹簧**，因为弹簧在中断中携带速度。
- **从哪进就从哪出。** 从底部滑入的 toast 从底部离开。对称路径是滑动消失之所以显得理所当然的原因。
- **在用户决策的阶段用非对称时长。** 例如长按确认：按下阶段慢而刻意（2s linear），释放阶段干脆（200ms ease-out）。

### 6. 减少动态与指针门控（每次都随动画一起交付）

```css
@media (prefers-reduced-motion: reduce) {
  .element { animation: fade 0.2s ease; } /* 保留透明度/颜色，去掉基于 transform 的运动 */
}

@media (hover: hover) and (pointer: fine) {
  .element:hover { transform: scale(1.05); } /* 触摸设备在点击时会误触 hover */
}
```

```jsx
const reduce = useReducedMotion();
const closedX = reduce ? 0 : '-100%';
```

减少动态意味着**更少更温和**的动画，不是零 —— 保留有助于理解的过渡，去掉位移与位置变化。

**禁止写成 `* { animation-duration: 0.01ms !important }` 这种粗暴一锅端** —— 那会把有助于理解的淡变也一起干掉，且与本节要求相悖。

## 配方（直接起手，不要从空文件开始）

### 按钮按压

```css
.button { transition: transform 160ms var(--ease-out); }
.button:active { transform: scale(0.97); }
```
`scale()` 会连子元素一起缩放，标签和图标跟着动，这正是"物理按压"感的来源。`:active` 在触摸上是真实按压，不需 hover 门控；`:hover` 样式要单独门控。

### 下拉 / popover / 菜单

```css
.popover {
  transform-origin: var(--transform-origin); /* 由触发器位置供给 */
  transition: opacity 200ms var(--ease-out), transform 200ms var(--ease-out);
}
.popover[data-starting-style],
.popover[data-ending-style] { opacity: 0; transform: scale(0.95); }
```
`transform-origin` 是全部要点 —— 面板应该看起来是从你点的东西里长出来的。

### Tooltip

同 popover 形状，更快（125ms，`scale(0.97)`），另加一个多数实现漏掉的细节：**一个 tooltip 打开后，相邻 tooltip 瞬时打开**（`transition-duration: 0ms`）。首次延迟是为了防误触；之后跳过延迟和动画会让整条工具栏感觉更快。

### 模态

唯一保持居中的浮层（`transform-origin: center`）。250ms `--ease-out`，从 `scale(0.96)` + `opacity: 0` 进入。**遮罩的透明度要同步动**，让两者读作同一个表面。

### 抽屉 / Sheet

```css
.drawer { transform: translateY(0); transition: transform 500ms var(--ease-drawer); }
.drawer[data-closed] { transform: translateY(100%); }
```
加上拖拽后它就变成手势问题 —— 见下面"拖拽消失"。

### Toast

400ms **`ease`**（不是 `--ease-out`），比典型 UI 略慢 —— 优雅感来自它按组件性格调音，而不是套用通用 UI 预算。用 `@starting-style` 做入场；不支持时退回到挂载标记（`data-mounted`）方案。

toast 堆叠、列表回流时，透明度变化必须对抗高度变化。这一对没有公式 —— 调到感觉对了为止，第二天再看一次。

### 手风琴

`height` + `opacity` 各 200ms `--ease-out`，配 `overflow: hidden`。这是少数**每帧都付 layout 代价**的动画之一，时长要短。在 JS 里量度内容高度，不要动画到 `auto`。

### 列表错峰入场

用户偶尔看到的列表/网格可用（不是每天滚过去的）。`opacity 0 → 1` + `translateY(8px) → 0`，300ms `--ease-out`，错峰 **30–80ms**。**错峰是装饰性的，播放期间绝不能阻塞交互。**

### 长按确认

危险操作，普通点击太容易误触。按下阶段 `clip-path` 2s **`linear`**（进度不该缓动），释放阶段 200ms `--ease-out` 收回。`linear` 在这里是正确的 —— 填充是进度指示器。

### Tab 指示器

逐个颜色过渡永远对不准。**用 clip 代替**：复制一份 tab 列表，把副本样式化成激活态，用 `clip-path: inset(...)` 裁到只露出当前 tab，切换时动这个裁剪（250ms `--ease-in-out`）。文字和背景一起变、完全同步，因为它们是同一个元素被揭开，而不是两种颜色在插值。

### 滚动揭示

**仅限营销面。** 不要对用户每天访问的功能性 UI 做这个。`clip-path: inset(0 0 100% 0) → inset(0 0 0 0)`，600ms `--ease-in-out`，用 `IntersectionObserver` 触发**一次**（`{ once: true }`）。每次滚过都重播的界面是在和读者对抗。

### 拖拽消失

**手势配方，用弹簧不用时长**，因为用户能在运动中反转。

```js
const timeTaken = Date.now() - dragStartTime.current;
const velocity = Math.abs(swipeAmount) / timeTaken;

if (Math.abs(swipeAmount) >= SWIPE_THRESHOLD || velocity > 0.11) {
  dismiss();  // 用速度判断，不是只用距离
}
```

四个区分好坏拖拽的细节：
- **指针捕获**，拖拽开始后指针离开边界仍继续。
- **多点触摸保护** —— 新的触点直接 `if (isDragging) return`，否则换手指会让元素跳变。
- **越界阻尼** —— 越过自然边界后，越远移动越少。
- **摩擦，不是墙** —— 允许越界拖拽，但阻力递增。

落定用弹簧，让被中断的拖拽保住速度：`{ type: "spring", duration: 0.5, bounce: 0.2 }`。**直接在元素上设 `transform`**，不要通过父级 CSS 变量驱动。

### 交叉淡入对不齐时

两个状态在过渡中可见地重叠、怎么调缓动和时长都救不回来时，**把接缝模糊掉**：过渡中给内容加 `filter: blur(2px)` 并降 `opacity: 0.7`，200ms `ease`。没有模糊时眼睛会读成两个不同物体在交换；模糊把它们混成一次感知到的形变。**模糊保持在 20px 以下**，重模糊很贵，Safari 尤其。

### 无库的编程式动效

需要 JS 控制但不想引入依赖时，WAAPI 给出 CSS 级性能：

```js
element.animate(
  [{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0 0)' }],
  { duration: 1000, fill: 'forwards', easing: 'cubic-bezier(0.77, 0, 0.175, 1)' }
);
```
硬件加速、可中断、零包体成本。

## 交付前自检（每条都是硬性阻断项）

| 绝不 | 改为 |
|---|---|
| `transition: all` | 写明具体属性 |
| `transform: scale(0)` 入场 | `scale(0.95)` + `opacity: 0` |
| UI 元素上用 `ease-in` | `--ease-out` 或强自定义曲线 |
| 刻意的动画上用内置 `ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` |
| 键盘快捷键或每天 100+ 次动作上有动画 | 不做动画 |
| UI 时长超过 300ms 且无理由 | 150–250ms |
| 触发器锚定的 popover 用 `transform-origin: center` | 锚到触发器（模态豁免） |
| toast、开关、可快速连触的元素用 keyframes | CSS transition |
| 动 `width`/`height`/`margin`/`padding`/`top`/`left` | `transform` / `opacity` |
| 负载下用 Motion 的 `x`/`y`/`scale` 简写 | 完整 `transform` 字符串 |
| 未门控的 `:hover` 运动 | `@media (hover: hover) and (pointer: fine)` |
| 缺 `prefers-reduced-motion` | 更温和的变体，不是零 |
| 所有元素同时入场 | 30–80ms 错峰 |

## 交付时的说明格式

写完代码后，最多几行：

- **闸门结果** —— 频率层级与命名后的目的。请求里有被驳回的部分，说明是哪条、为什么。
- **配料** —— 工具、属性、曲线、时长或弹簧配置，每项一行。
- **该用感觉验的东西** —— 若结果依赖代码里判断不了的手感（交叉淡入、弹簧回弹量、入场列表里透明度与高度的配比），直说，并指向验证方法：以 2–5 倍时长慢放或在 DevTools 动画检查器里逐帧步进、在真机上测手势、第二天用新鲜眼光再看一次。

不要把这段膨胀成报告。**代码才是交付物。**
