---
name: ChangeClaudeConfig
description: 修改 Claude Code 配置：settings.json（钩子/权限/env/MCP/插件/模型）、keybindings、白名单优化。
---

# ChangeClaudeConfig

## 概述

所有 Claude Code 配置修改的统一入口。三个领域：

| 领域 | 目标文件 | 使用时机 |
|---|---|---|
| **1. 设置** | `settings.json`（用户级 / 项目级 / 本地级） | 钩子、权限、环境变量、MCP 服务器、插件、模型、归属信息…… |
| **2. 快捷键** | `~/.claude/keybindings.json` | 自定义键盘快捷键 |
| **3. 白名单优化** | 项目 `.claude/settings.json` → `permissions.allow` | 通过扫描对话记录减少权限提示 |

将请求路由到对应的领域。一个请求可能跨越多个领域（例如“允许 npm 命令并重新绑定 ctrl+s”）——逐一处理每个领域。

## 通用规则（所有领域）

1. **先读后写** —— 始终先读取目标文件；它可能尚不存在。将新设置与现有设置合并 —— **永远不要替换整个文件**。
2. **澄清歧义** —— 当请求不明确时使用 AskUserQuestion：使用哪个设置文件（用户级/项目级/本地级）、是添加到现有数组还是替换、当有多个选项时具体值是什么。
3. **写入后验证** —— 无效的 JSON/配置会静默禁用该文件中的所有内容；编辑后检查语法和结构形状。
4. **确认** —— 告知用户更改了什么。

## 领域 1：设置（settings.json）

### 何时需要钩子（而非记忆）

如果用户希望某些事情在某个事件发生时自动执行，他们需要在 settings.json 中配置一个**钩子**。记忆/偏好设置无法触发自动化操作。

**以下情况需要钩子：**
- “在压缩对话之前，询问我要保留什么” → PreCompact 钩子
- “写入文件后，运行 prettier” → PostToolUse 钩子，匹配 Write|Edit
- “当我运行 bash 命令时，记录它们” → PreToolUse 钩子，匹配 Bash
- “代码更改后始终运行测试” → PostToolUse 钩子

### /config 与直接编辑

对于简单设置，建议使用 **`/config` 斜杠命令**：`theme`、`editorMode`、`verbose`、`model`、`language`、`alwaysThinkingEnabled`、`permissions.defaultMode`。

**直接编辑 settings.json** 用于：钩子、复杂的权限规则（allow/deny 数组）、环境变量、MCP 服务器配置、插件配置。

### 设置文件位置

| 文件 | 作用域 | 是否纳入 Git | 用途 |
|------|--------|-------------|------|
| `~/.claude/settings.json` | 全局 | 不适用 | 所有项目的个人偏好 |
| `.claude/settings.json` | 项目 | 提交 | 团队共享的钩子、权限、插件 |
| `.claude/settings.local.json` | 项目 | 忽略（.gitignore） | 该项目的个人覆盖配置 |

设置加载顺序：用户级 → 项目级 → 本地级（后者覆盖前者）。

### 数组合并（重要！）

当向权限数组或钩子数组添加内容时，**与现有内容合并**，不要替换：

```json
{
  "permissions": {
    "allow": [
      "Bash(git *)",      // 已存在
      "Edit(.claude)",    // 已存在
      "Bash(npm *)"       // 新增
    ]
  }
}
```

### 权限

```json
{
  "permissions": {
    "allow": ["Bash(npm *)", "Edit(.claude)", "Read"],
    "deny": ["Bash(rm -rf *)"],
    "ask": ["Edit(//etc/*)"],
    "defaultMode": "default" | "plan" | "acceptEdits" | "dontAsk",
    "additionalDirectories": ["/extra/dir"]
  }
}
```

**权限规则语法：**
- 精确匹配：`"Bash(npm run test)"`
- 前缀通配：`"Bash(git *)"` —— 匹配 `git`、`git status`、`git commit` 等。`*` 前的空格是必需的，以确保前缀匹配正确工作。
- 仅限工具：`"Read"` —— 允许所有 Read 操作

### 环境变量

```json
{ "env": { "DEBUG": "true", "MY_API_KEY": "value" } }
```

### 钩子

**钩子事件：** PreToolUse、PostToolUse、PostToolUseFailure、Notification、Stop、PreCompact、PostCompact、UserPromptSubmit、SessionStart、PermissionRequest 等。**常用工具匹配器：** `Bash`、`Write`、`Edit`、`Read`、`Glob`、`Grep`。

**钩子结构：**
```json
{
  "hooks": {
    "EVENT_NAME": [
      {
        "matcher": "ToolName|OtherTool",
        "hooks": [
          { "type": "command", "command": "your-command-here", "timeout": 60 }
        ]
      }
    ]
  }
}
```

**钩子类型：** `command`（运行 shell 命令）、`prompt`（LLM 评估条件；仅限工具事件）、`agent`（运行带工具的 agent；仅限工具事件）、`http`（POST 到 URL）、`mcp_tool`（调用 MCP 工具）。

**钩子输入**以 stdin 上的 JSON 形式传入：`{ "session_id", "tool_name", "tool_input", "tool_response" }`。钩子可以返回 JSON 以控制行为：`systemMessage`、`continue`、`stopReason`、`decision`、`hookSpecificOutput`（例如 `additionalContext`、用于 PreToolUse 的 `permissionDecision`）。

**构建钩子（附带验证）** —— 每一步捕获不同类别的失败；一个静默什么都不做的钩子比没有钩子更糟糕：

1. **去重检查。** 读取目标文件。如果同一事件+匹配器上已存在钩子，则显示现有命令并询问：保留它、替换它、还是在其旁添加。
2. **为当前项目构建命令——不要假设。** 钩子从 stdin 接收 JSON。构建一个命令，该命令：
   - 安全提取任何需要的负载 —— 使用 `jq -r` 到带引号的变量中，或使用 `{ read -r f; ... "$f"; }`，而不是不加引号的 `| xargs`（会在空格处分割）
   - 以该项目实际运行底层工具的方式调用它（npx/bunx/yarn/pnpm？Makefile 目标？全局安装？）
   - 跳过工具不处理的输入（格式化工具通常有 `--ignore-unknown`；如果没有，则按扩展名保护）
   - 暂时保持原始状态 —— 不加 `|| true`，不抑制 stderr。等管道测试通过后再包裹。
3. **管道测试原始命令。** 合成 stdin 负载并直接管道传入：
   - `Pre|PostToolUse` 作用于 `Write|Edit`：`echo '{"tool_name":"Edit","tool_input":{"file_path":"<一个真实文件>"}}' | <cmd>`
   - `Pre|PostToolUse` 作用于 `Bash`：`echo '{"tool_name":"Bash","tool_input":{"command":"ls"}}' | <cmd>`
   
   检查退出码和副作用（文件是否实际被格式化、测试是否实际运行）。一旦生效，用 `2>/dev/null || true` 包裹（除非用户希望阻塞性检查）。
4. **写入 JSON。** 合并到目标文件。如果这是第一次创建 `.claude/settings.local.json`，将其添加到 .gitignore —— Write 工具不会自动将其加入 .gitignore。
5. **一次性验证语法 + 结构：** `jq -e '.hooks.<event>[] | select(.matcher == "<matcher>") | .hooks[] | select(.type == "command") | .command' <目标文件>`。退出码 0 且打印出你的命令 = 正确。退出码 4 = 匹配器不匹配。退出码 5 = JSON 格式错误或嵌套错误。
6. **证明钩子确实触发** —— 仅适用于 `Pre|PostToolUse` 中你能依次触发的匹配器（`Write|Edit` 通过 Edit 触发，`Bash` 通过 Bash 触发）。对于格式化工具：通过 Edit 引入一个可检测的违规，重新读取，确认钩子修复了它。对于其他情况：临时在命令前加上 `echo "$(date) hook fired" >> /tmp/claude-hook-check.txt; `，触发匹配的工具，读取哨兵文件。**始终清理** —— 恢复违规内容，移除哨兵前缀。
   
   **如果证明失败但管道测试通过且 `jq -e` 通过：** 设置监视器（settings watcher）没有监视 `.claude/` —— 它只监视此会话启动时存在设置文件的目录。钩子已正确写入。告知用户打开一次 `/hooks`（重新加载配置）或重启 —— 你无法自行完成此操作。
7. **交接。** 告知用户钩子已生效（或根据监视器注意事项需要 `/hooks`/重启）。指引他们通过 `/hooks` 稍后查看、编辑或禁用。

**常见模式：**
- 写入后自动格式化：PostToolUse(Write|Edit) → `jq -r '.tool_response.filePath // .tool_input.file_path' | { read -r f; prettier --write "$f"; } 2>/dev/null || true`
- 记录所有 bash 命令：PreToolUse(Bash) → `jq -r '.tool_input.command' >> ~/.claude/bash-log.txt`
- 代码更改后运行测试：PostToolUse(Write|Edit) → `jq -r '.tool_input.file_path // .tool_response.filePath' | grep -E '\.(ts|js)$' && npm test || true`

### 其他设置

- **模型和 agent：** `model`（或 `"fable"`/`"opus"`/`"haiku"`）、`agent`、`alwaysThinkingEnabled`
- **归属信息：** `attribution.commit` / `attribution.pr`（空字符串 `""` 可隐藏）
- **MCP 服务器：** `enableAllProjectMcpServers`、`enabledMcpjsonServers`、`disabledMcpjsonServers`
- **插件：** `enabledPlugins`（`"plugin-name@source"`）、`extraKnownMarketplaces`
- **杂项：** `language`、`cleanupPeriodDays`、`respectGitignore`、`spinnerTipsEnabled`、`spinnerVerbs`、`syntaxHighlightingDisabled`、`statusLine`、`plansDirectory`、`theme`、`editorMode`

### 钩子故障排除

如果钩子未运行：1. 检查设置文件。2. 验证 JSON 语法（无效 JSON 会静默失败）。3. 检查匹配器是否匹配工具名称。4. 检查钩子类型。5. 手动测试命令。6. 运行 `claude --debug` 查看钩子执行日志。

## 领域 2：快捷键（keybindings.json）

创建或修改 `~/.claude/keybindings.json`。**始终先读取它**（可能尚不存在）；与现有绑定合并 —— 永远不要替换。对于已有文件使用 Edit，仅在文件不存在时使用 Write。

### 文件格式

```json
{
  "$schema": "https://www.schemastore.org/claude-code-keybindings.json",
  "$docs": "https://code.claude.com/docs/en/keybindings",
  "bindings": [
    {
      "context": "Chat",
      "bindings": { "ctrl+e": "chat:externalEditor" }
    }
  ]
}
```

始终包含 `$schema` 和 `$docs` 字段。

### 按键语法

**修饰键**（用 `+` 组合）：`ctrl`（别名 `control`）、`alt`（别名 `opt`/`option` —— 在终端中 `alt` 与 `meta` 相同）、`shift`、`meta`（别名 `cmd`/`command`）。

**特殊键：** `escape`/`esc`、`enter`/`return`、`tab`、`space`、`backspace`、`delete`、`up`、`down`、`left`、`right`。

**和弦键：** 以空格分隔的按键序列，例如 `ctrl+k ctrl+s`（按键之间超时 1 秒）。

**取消绑定默认快捷键：** 将键设为 `null`。

### 行为规则

1. 只包含用户想要修改的上下文（最小覆盖）。
2. 验证动作和上下文是否来自已知列表。
3. 主动警告与保留快捷键或常用工具（tmux `ctrl+b`、screen `ctrl+a`）冲突的键。
4. 新绑定是**附加的** —— 除非明确取消绑定，否则默认绑定仍然有效。
5. 要**移动**一个绑定：取消绑定旧键（`null`）并同时添加新绑定。

**重新绑定示例：**
```json
{
  "context": "Chat",
  "bindings": {
    "ctrl+g": null,
    "ctrl+e": "chat:externalEditor"
  }
}
```

### 保留快捷键（不可重新绑定）

- **错误相关：** `ctrl+c`（中断/退出，硬编码）、`ctrl+d`（退出，硬编码）、`ctrl+m`（在终端中等同于 Enter）、`capslock`
- **终端保留：** `ctrl+z`（SIGTSTP）、`ctrl+\`（SIGQUIT）
- **macOS 保留：** `cmd+c/v/x/q/w`、`cmd+tab`、`cmd+space`

### 验证

Claude Code 在加载时验证 keybindings.json；警告会进入调试日志。常见问题：

| 问题 | 原因 | 修复 |
| --- | --- | --- |
| `must have a "bindings" array` | 缺少包装对象 | 包装为 `{ "bindings": [...] }` |
| `Unknown context "X"` | 拼写错误 / 无效上下文 | 使用准确的上下文名称（`Global`、`Chat`、`Autocomplete`、`Confirmation`、`Settings`、`Transcript`、`Tabs`、……） |
| `Duplicate key "X"` | 同一上下文中同一个键出现两次 | 删除重复项；JSON 只使用最后一个值 |
| `"X" may not work` | 终端/操作系统保留的快捷键 | 选择另一个键 |

**错误**会阻止绑定生效，必须修复。**警告**表示可能存在冲突，但绑定仍可能生效。

**已知上下文：** Global、Chat、Autocomplete、Confirmation、Help、Transcript、HistorySearch、Task、ThemePicker、Settings、Tabs、Attachments、Footer、MessageSelector、DiffDialog、DiffPanel、ModelPicker、Select、Plugin、Scroll。

**已知动作（示例）：** `app:toggleTodos`（ctrl+t）、`app:toggleTranscript`（ctrl+o）、`chat:modelPicker`（meta+p）、`chat:externalEditor`（ctrl+x ctrl+e）、`chat:clearInput`（ctrl+l）、`history:search`（ctrl+r）、`autocomplete:accept`（tab）、`task:background`（ctrl+x ctrl+b）、`theme:editCustom`（ctrl+e）。当不确定某个动作是否存在时，优先查阅 `https://code.claude.com/docs/en/keybindings` 上的文档，而非猜测。

## 领域 3：白名单优化（减少权限提示）

扫描对话记录中的 MCP 和 bash 工具调用，然后生成一个优先级列表，将模式添加到 `permissions.allow` 以减少权限提示。**专注于只读命令。**

### 步骤

1. **定位对话记录。** 会话记录位于 `~/.claude/projects/<sanitized-cwd>/*.jsonl`。每行是一个 JSON 对象；工具调用以 `assistant` 消息的形式出现，其中 `message.content[]` 条目包含 `type: "tool_use"`。`name` 字段标识工具（`"Bash"`、`"mcp__slack__slack_read_thread"`）；对于 Bash，`input.command` 是 shell 字符串。扫描所有项目中的最近对话记录 —— 不限于当前项目 —— 限制为最近修改的大约 50 个 JSONL 文件。

2. **提取工具调用频率。** 对于 Bash：解析 `input.command`，取前导命令令牌（处理 `sudo`、`timeout`、管道、`&&`、环境变量前缀），记录命令 + 第一个子命令对（`git status`、`gh pr view`、`ls`）。对于 MCP：记录完整的工具名称。统计出现次数。

3. **过滤为只读。** 仅保留不改变状态的命令（`ls`、`cat`、`pwd`、`git status/log/diff/show`、`rg`、`grep`、`find`、`head`、`tail`、`wc`、`gh pr view/list`、`docker ps/logs`、`ps`、`top`、`df`、`du`、`env`，以及名称中包含 read/get/list/search/view 的 MCP 工具）。丢弃任何会写入、删除、重命名、推送、合并、安装或运行有副作用的构建/测试的命令。如有疑问，就排除。

4. **绝不允许一个会授予任意代码执行权限的模式。** 以下任意一项的通配符规则都等同于允许任意代码执行 —— 此处未穷举：
   - 解释器：`python`/`python3`、`node`、`bun`、`deno`、`ruby`、`perl`、`php`、`lua`、……
   - Shell：`bash`、`sh`、`zsh`、`fish`、`eval`、`exec`、`ssh`、……
   - 包运行器：`npx`、`bunx`、`uvx`、`uv run`、……
   - 任务运行器通配：`npm run *`、`yarn run *`、`pnpm run *`、`bun run *`、`make *`、`just *`、`cargo run *`、`go run *` —— 精确的 `Bash(bun run typecheck)` 可以，`Bash(bun run *)` 不可以
   - `gh api *`、`docker run`/`exec`、`kubectl exec`、`sudo` 等

5. **丢弃 Claude Code 已自动允许的命令** —— 它们从不提示，不需要白名单条目：`cat`、`ls`、`head`、`tail`、`wc`、`stat`、`strings`、`id`、`uname`、`free`、`df`、`du`、`basename`、`dirname`、`realpath`、`cut`、`paste`、`tr`、`diff`、`true`、`false`、`sleep`、`which`、`type`、`expr`、`seq`、`echo`、`cd`；git/gh/docker 的只读子命令；`rg`、`grep`、`jq`、`find`（安全标志）等。事实来源：`src/tools/BashTool/readOnlyValidation.ts`（`READONLY_COMMANDS`、`READONLY_NOARGS`、`READONLY_EXACT`、`COMMAND_ALLOWLIST`）和 `src/utils/shell/readOnlyCommandValidation.ts`（`GIT_READ_ONLY_COMMANDS`、`GH_READ_ONLY_COMMANDS`、`DOCKER_READ_ONLY_COMMANDS`）。如果不确定某个命令是否已被覆盖，请 grep 这些文件而不是猜测。

6. **选择模式形式。** 使用仍能覆盖所观察用法的最窄模式：
   - 多个变体（`git log`、`git log --oneline`）：`Bash(git log *)` —— 注意 `*` 前的空格，前缀匹配必需。
   - 一个精确调用：`Bash(foo)`，不带通配符。
   - MCP：完整工具名称原样（无需通配符）。
   - 永远不要将模式扩大到与上述规则冲突的程度。

7. **排序优先级。** 按出现次数降序排列。丢弃出现次数少于约 3 次的项。最多取前约 20 个。

8. **向用户呈现优先级列表**，以 markdown 表格形式：排名、模式、次数、一行描述。

9. **合并到 `.claude/settings.json`**（项目作用域，根据“设置文件位置”表格 —— 遵循领域 1 的合并规则）。保留现有键和现有 `permissions.allow` 条目；去重；不要删除任何内容；不要重新排序无关字段。如果文件不存在则创建。

10. **报告结果。** 告知用户你添加了什么（数量 + 示例）、白名单中已存在什么、以及你跳过了什么及原因（例如“跳过了 `rm` 和 `git push` —— 非只读；跳过了 `cat`/`ls` —— 已自动允许”）。

不要向 `permissions.deny` 或 `permissions.ask` 添加任何内容。不要触碰任何其他设置字段。