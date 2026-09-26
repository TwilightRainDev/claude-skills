# 视觉伴随指南

基于浏览器的可视化追问伴随工具，用于展示 mockup、示意图和方案选项。

## 何时使用

**逐问题决定，不要逐会话决定。** 测试标准：**对方看起来是不是比读起来更明白？**

**内容本身是视觉的时候走浏览器：**

- **UI mockup** —— 线框图、布局、导航结构、组件设计
- **架构图** —— 系统组件、数据流、关系图
- **并排视觉对比** —— 两套布局、两套配色、两个设计方向
- **设计打磨** —— 问题本身关于观感、间距、视觉层级
- **空间关系** —— 状态机、流程图、实体关系这类画出来才清楚的图

**内容是文字或表格的时候走终端：**

- **需求与范围问题** —— "X 是什么意思"、"哪些功能在范围内"
- **概念性的 A/B/C 选择** —— 在几段文字描述之间选
- **取舍列表** —— 优缺点、对比表
- **技术决策** —— API 设计、数据建模、架构路线选择
- **澄清性问题** —— 答案是文字而不是视觉偏好的任何问题

**话题关于 UI，不等于这个问题是视觉问题。** "你想要什么样的向导？"是概念问题，走终端。"这几套向导布局哪套感觉对？"是视觉问题，走浏览器。

## 工作原理

服务监视一个目录里的 HTML 文件，把最新的那个送到浏览器。你把 HTML 内容写进 `screen_dir`，对方在浏览器里看到它并能点击选项。选择结果记录到 `state_dir/events`，你在下一个回合读取。

**内容片段 vs 完整文档：** 如果你的 HTML 文件以 `<!DOCTYPE` 或 `<html` 开头，服务就原样送出（只注入辅助脚本）。否则服务会自动把你的内容包进框架模板 —— 补上页头、CSS 主题、连接状态和全套交互基础设施。**默认写内容片段。** 只有需要对页面完全掌控时才写完整文档。

## 启动一次会话

```bash
# 在对方同意使用伴随工具之后再启动。--open 会在第一屏就绪时自动打开浏览器；
# --project-dir 让 mockup 持久化，并支持同端口重启。
bash scripts/start-server.sh --project-dir /path/to/project --open

# 返回：{"type":"server-started","port":52341,
#       "url":"http://localhost:52341/?key=ab12…",
#       "screen_dir":"/path/to/project/.probeintent/12345-1706000000/content",
#       "state_dir":"/path/to/project/.probeintent/12345-1706000000/state"}
```

把返回里的 `screen_dir` 和 `state_dir` 记下来。带 `--open` 时，你推第一屏过去浏览器会自己打开 —— 不需要请对方手动开，但仍然要把 URL 给对方留个后路（无头或远程环境不会自动打开）。

**URL 里带会话密钥（`?key=…`）。** 没有它服务会拒绝一切请求，所以**永远**把响应 `url` 字段里的**完整** URL 给对方 —— 不要截掉查询串，也不要只给一个光秃秃的 `http://host:port`。这个密钥同时守护 HTTP 和 WebSocket 访问，这样误开的浏览器标签页或网络上的另一台机器都读不到画面、也注入不了事件。首次加载后浏览器用 cookie 记住密钥，之后刷新和 `/files/*` 静态资源都不用再带。

**连接信息怎么找：** 服务把自己的启动 JSON 写进 `$STATE_DIR/server-info`。如果你是把服务放到后台启动、没接住 stdout，读那个文件拿 URL 和端口。用了 `--project-dir` 的话，去 `<项目>/.probeintent/` 下找这次会话的目录。

**注意：** 把项目根目录作为 `--project-dir` 传进去，mockup 才会持久落在 `.probeintent/` 里、挺过服务重启。不传的话文件落在 `/tmp`，会被清掉。提醒对方把 `.probeintent/` 加进 `.gitignore`（如果还没加）。

**按宿主启动：**

**Claude Code：**
```bash
# 默认模式就行 —— 脚本自己会把服务放到后台。
bash scripts/start-server.sh --project-dir /path/to/project --open
```

Windows 上脚本会自动识别并切到前台模式（那会阻塞工具调用）。给 Bash 工具调用加 `run_in_background: true`，服务才能跨对话回合存活，然后在下一个回合读 `$STATE_DIR/server-info` 拿 URL 和端口。

**其他宿主：** 服务必须在对话回合之间**持续在后台运行**。如果你的环境会回收脱离的进程（Codex 一类），加 `--foreground` 让宿主而不是脚本去管后台化；再用你的平台的非阻塞执行机制启动它。判断依据看脚本有没有自动切前台，或者干脆先试默认模式。

**远程或容器环境：** 如果浏览器打不开返回的 URL（远程 / 容器里很常见），绑定一个非回环地址：

```bash
bash scripts/start-server.sh \
  --project-dir /path/to/project \
  --host 0.0.0.0 \
  --url-host localhost
```

`--url-host` 控制返回 URL 里印出来的主机名。

> [NOTE] `--host 0.0.0.0` 会把服务暴露到本机所有网络接口。只在确实需要时用；会话密钥是唯一防线。

## 循环

1. **先确认服务活着**，然后把 HTML **写进** `screen_dir` 里的新文件：
   - **必要动作：在引用 URL 或推送画面前，先确认服务活着。** 检查 `$STATE_DIR/server-info` 存在、且 `$STATE_DIR/server-stopped` 不存在。如果服务已经退出，用**同一个 `--project-dir`** 重启 —— 它会复用同一个端口，对方已经打开的标签页会自己重连（服务不在期间页面显示"已暂停"遮罩），你不需要发新 URL。服务闲置 4 小时后自动退出（可用 `--idle-timeout-minutes` 调）。
   - 文件名要有语义：`platform.html`、`visual-style.html`、`layout.html`
   - **绝不复用文件名** —— 每一屏都是一个新文件
   - 用你的文件创建工具写 —— **绝不要用 cat / heredoc**（会把噪音灌进终端）
   - 服务自动送最新的那个文件
2. **告诉对方会看到什么，然后结束你的回合：**
   - 重申 URL（**每一步都重申，不只是第一次**）
   - 用一句话说明屏幕上是什么（例如"正在展示首页的 3 套布局方案"）
   - 请对方在终端里回复："看一眼，告诉我你怎么想。想选哪个点一下就行。"
3. **你的下一个回合** —— 对方在终端回复之后：
   - 如果 `$STATE_DIR/events` 存在就读它 —— 里面是对方的浏览器交互（点击、选择），一行一个 JSON
   - 和对方在终端里的文字合起来看，才是一幅完整的图
   - 终端消息是主要反馈；`state_dir/events` 提供结构化的交互数据
4. **返工或前进** —— 反馈如果改变了当前这屏，就写新文件（例如 `layout-v2.html`）。当前这步确认了才进下一个问题。
5. **回到终端时卸载** —— 下一步不需要浏览器时（例如一个澄清问题、一段取舍讨论），推一个等待屏把旧内容清掉：

   ```html
   <!-- 文件名：waiting.html（或 waiting-2.html 等） -->
   <div style="display:flex;align-items:center;justify-content:center;min-height:60vh">
     <p class="subtitle">Continuing in terminal...</p>
   </div>
   ```

   免得对话已经翻篇了，对方还盯着一屏已经定了的选择。下次有视觉问题时，照常推新内容文件。
6. 重复，直到结束。

## 写内容片段

只写页面里面那部分内容。服务会自动把它包进框架模板（页头、主题 CSS、连接状态和全套交互基础设施）。

**最小例子：**

```html
<h2>哪套布局更合适？</h2>
<p class="subtitle">考虑可读性和视觉层级</p>

<div class="options">
  <div class="option" data-choice="a" onclick="toggleSelect(this)">
    <div class="letter">A</div>
    <div class="content">
      <h3>单栏</h3>
      <p>干净、专注的阅读体验</p>
    </div>
  </div>
  <div class="option" data-choice="b" onclick="toggleSelect(this)">
    <div class="letter">B</div>
    <div class="content">
      <h3>双栏</h3>
      <p>侧边导航配主内容区</p>
    </div>
  </div>
</div>
```

就这样。不需要 `<html>`、不需要 CSS、不需要 `<script>` 标签。服务全给你备好了。

## 可用的 CSS 类

框架模板提供以下 CSS 类：

### 选项（A/B/C 选择）

```html
<div class="options">
  <div class="option" data-choice="a" onclick="toggleSelect(this)">
    <div class="letter">A</div>
    <div class="content">
      <h3>标题</h3>
      <p>描述</p>
    </div>
  </div>
</div>
```

**多选：** 给容器加 `data-multiselect` 就能多选，每次点击切换该项的选中样式。

```html
<div class="options" data-multiselect>
  <!-- 同样的 option 结构 —— 允许选择/取消多个 -->
</div>
```

### 卡片（展示视觉设计）

```html
<div class="cards">
  <div class="card" data-choice="design1" onclick="toggleSelect(this)">
    <div class="card-image"><!-- mockup 内容 --></div>
    <div class="card-body">
      <h3>名称</h3>
      <p>描述</p>
    </div>
  </div>
</div>
```

### mockup 容器

```html
<div class="mockup">
  <div class="mockup-header">预览：仪表盘布局</div>
  <div class="mockup-body"><!-- 你的 mockup HTML --></div>
</div>
```

### 分栏视图（并排对比）

```html
<div class="split">
  <div class="mockup"><!-- 左 --></div>
  <div class="mockup"><!-- 右 --></div>
</div>
```

### 优缺点

```html
<div class="pros-cons">
  <div class="pros"><h4>优点</h4><ul><li>好处</li></ul></div>
  <div class="cons"><h4>缺点</h4><ul><li>代价</li></ul></div>
</div>
```

### mock 元素（线框积木）

```html
<div class="mock-nav">Logo | 首页 | 关于 | 联系</div>
<div style="display: flex;">
  <div class="mock-sidebar">导航</div>
  <div class="mock-content">主内容区</div>
</div>
<button class="mock-button">操作按钮</button>
<input class="mock-input" placeholder="输入框">
<div class="placeholder">占位区域</div>
```

### 排版与分节

- `h2` —— 页面标题
- `h3` —— 小节标题
- `.subtitle` —— 标题下方的次级文字
- `.section` —— 带下边距的内容块
- `.label` —— 小号大写标签文字

## 浏览器事件格式

对方在浏览器里点击选项时，交互记录到 `$STATE_DIR/events`（一行一个 JSON 对象）。你推新画面时这个文件会被自动清空。

```jsonl
{"type":"click","choice":"a","text":"Option A - Simple Layout","timestamp":1706000101}
{"type":"click","choice":"c","text":"Option C - Complex Grid","timestamp":1706000108}
{"type":"click","choice":"b","text":"Option B - Hybrid","timestamp":1706000115}
```

完整事件流能看出对方的探索路径 —— 他可能在定下来之前点了好几个。最后一个 `choice` 事件通常就是最终选择，但点击的模式能透露犹豫或偏好，值得开口问一句。

如果 `$STATE_DIR/events` 不存在，说明对方没在浏览器里交互 —— 只用他终端里的文字。

## 设计要领

- **保真度跟着问题走** —— 布局问题给线框，打磨问题才给精细稿
- **每页都说明问题是什么** —— 写"哪套布局更专业"而不是只写"选一个"
- **先返工再前进** —— 反馈改变了当前这屏，就写新版本
- **每屏最多 2-4 个选项**
- **该用真实内容时就用真的** —— 做摄影作品集就用真实照片，占位内容会掩盖设计问题。
- **mockup 保持简单** —— 聚焦布局和结构，不追求像素级还原

## 文件命名

- 用有语义的名字：`platform.html`、`visual-style.html`、`layout.html`
- 绝不复用文件名 —— 每一屏必须是新文件
- 返工版本加后缀：`layout-v2.html`、`layout-v3.html`
- 服务按修改时间送最新的那个文件

## 收尾

```bash
bash scripts/stop-server.sh $SESSION_DIR
```

会话用了 `--project-dir` 的话，mockup 文件留在 `.probeintent/` 里以后还能看。只有 `/tmp` 下的会话会在停止时被删掉。

## 参考

- 框架模板（CSS 参考）：`scripts/frame-template.html`
- 辅助脚本（客户端）：`scripts/helper.js`
