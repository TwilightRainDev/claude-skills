---
name: EnvRouter
description: Windows 环境事实快查表与路由。遇到环境敏感任务或症状时使用。先查表取证（1 秒），再按事实路由到对应技能执行。
---

# EnvRouter（环境路由）

本机 Windows 环境事实的快查表与路由器。**现场取证每次 72 秒；本机已知事实已实测固化，先查表。** 查表后仍不确定时再实测兜底 —— 环境会变，旧记忆可能过时。

## 使用流程

1. **查本机事实表**（下表）→ 命中症状即得事实
2. **按路由表** → 需要深处理时 Skill() 加载对应技能
3. **查表未命中 / 事实存疑** → 跑最小实测命令（见“实测兜底”）确认后更新结论

## 本机已知环境事实（2026-09-26 复核）

- **静态项**，一次实测固化，无需重复取证。
- **动态项**，随状态变化，任务前应实测确认。
- **载体已消失的项直接删除**：某个环境被删除、卸载、带离后，对应条目连同它的探测命令一并从本表删除，不留「曾安装过」「已不可达」「原 X 盘」一类注记——**如同从未安装过**。本表描述的是**当下存在什么**，不是历史沿革。
- 环境变动（装/卸工具、增删盘符、换机）后重新实测并同步本表。

| 维度 | 事实 | 状态 |
|---|---|---|
| Shell | 会话在 Git Bash（MSYSTEM=MINGW64）或 cmd/PowerShell；`$MSYSTEM` 判语境 | 静态 |
| Python | 真值：fact:machine.toolchain.python | **动态** |
| Python 编码 | 未设 `PYTHONUTF8`，stdout 编码为 GBK/cp936 | 静态 |
| GitHub 网络 | 真值：fact:github.network-diagnostics 。开关由用户决定，任务前实测，任何断言不可信 | **动态** |
| <LOCAL_PROXY> 证书 | 真值：fact:github.network-diagnostics | 静态 |
| git | 真值：fact:machine.git.install | 静态 |
| git 身份 | 真值：fact:github.identity | 静态 |
| 开发工具链 | 真值：fact:machine.drives | 静态 |
| 无头验证工具 | 真值：fact:tooling.host-capabilities 。个人库归属见 fact:workspace.tools-ownership | 静态 |
| 行尾 | 真值：fact:machine.text-eol | 静态 |
| 盘符 | 真值：fact:machine.drives | 动态 |
| 路径约定 | 用 Git Bash 格式（`D:/`）；**勿用** `/mnt/`（WSL 格式） | 静态 |

**证书报错分诊**（按报错原文）：
- “unable to get local issuer certificate” / “self-signed certificate” → 客户端走 OpenSSL 而非 schannel（WSL/MSYS2 git/IDE 内置 git/其他 git 安装）——补信任 <LOCAL_PROXY> CA 或 `git config http.sslbackend schannel`
- “certificate has expired” → 根存储有过期旧 CA；重启/更新 <LOCAL_PROXY> 用新证书链，**勿删证书**
- “connection refused” → hosts 劫持条目在但 <LOCAL_PROXY> 没跑（用户可能忘记开），非证书问题

## 路由表（症状 → 处理）

| 症状 | 处理 |
|---|---|
| **命令没报错，但结果可疑**（筛选器疑似没生效、条数不对、行尾/编码存疑） | 先取证再判断，见下「静默失效」 |
| **批量删除，或任何「筛选 + 删除/移动/覆盖」组合** | 走 `<WORKSPACE>\ClaudeCode\tools\recycle-remove.ps1`（默认干跑；**`-Path` 一次只收一个字符串**，多个目标逐个调用）；`Remove-Item` **不进回收站** |
| PowerShell 中文乱码、Out-File/heredoc/管道编码问题 | `EncodingGuide` |
| Git 操作（含破坏性/跨平台/恢复/凭证） | `GitMaster` |
| Git Bash 下测试失败、路径转换、MSYSTEM 相关 | `WinBashTest` |
| 环境症状不明、需根因分诊 | `Debugging` |
| 环境配置收敛（settings.json/PATH/代理开关） | `ChangeClaudeConfig` |
| 查表命中即明确 | 直接用表内事实处理，不再加载技能 |

## 静默失效

本机工具链有一类失败：**参数被接受但被忽略，命令成功返回，结果是错的**。没有报错、退出码为 0，唯一线索是结果本身不合理。

适用判据：任何「筛选 + 删除/移动/覆盖」组合，或任何你**没有亲眼看过结果**的批量操作。

取证纪律：

- **先列后删**。枚举与删除分两次执行，中间核对**完整清单与条数**（不是前几条），条数符合预期才动手。
- **不把 `Get-ChildItem` 的返回值直接接给 `Remove-Item`**。
- **行尾/编码结论要有字节级证据**，不能凭 `grep` 或肉眼。
- **筛选器可能静默失效**是通用假设，不限于某个具体参数。

PowerShell 枚举陷阱的完整取证（10 个变体的原始实测输出）见 `<WORKSPACE>\Docs\lesson-recursive-delete-trap.md`；工作区级规则见 `CLAUDE.md` §8。此处只留路由与判据，细节不在本表重复。

## 实测兜底（只测动态项，只读命令）

静态项（schannel 配置、git 版本、身份、编码现状等）**不重复取证**——除非出现与之矛盾的报错。只测动态项：

```bash
powershell -NoProfile -Command "Get-PSDrive -PSProvider FileSystem|% Name"  # 当前存在的卷（动态）
echo "$MSYSTEM"                                          # Git Bash 判定
type -a python; python -c "import sys; print(sys.executable)"  # 解释器命中顺序（动态）
grep -n github /c/Windows/System32/drivers/etc/hosts     # <LOCAL_PROXY> 劫持条目有无（动态）
netstat -ano | grep -E '127\.0\.0\.1:443\s.*LISTENING'   # <LOCAL_PROXY> 是否在监听（动态；按进程名查不可靠）
git ls-remote https://github.com/<owner>/<repo>.git HEAD # 当前<LOCAL_PROXY>握手（动态，最终以它为准）
date                                                     # 系统时间（动态）
```

## 合理化红牌

| 想法 | 现实 |
|---|---|
| “直接跑一下试试” | 跑之前先查表：哪个解释器会被命中？什么编码？ |
| “报证书错误就是被攻击/要修证书” | <LOCAL_PROXY> 是用户自装代理（开关由用户决定、可能忘开）。先实测当前状态与 schannel，勿动系统证书。 |
| “我记得 python 指向 MSYS2” | 查表，存疑就实测。 |
| “用 /mnt/d/ 格式” | WSL 格式。本机是 Git Bash，用 `D:/`。 |
| “这条留着吧，删了以后忘了它曾经存在过” | 本表描述当下存在什么。消失的环境其条目一并消失，如同从未安装过。 |
| “命令没报错，那就是没问题” | 本机工具链会静默忽略参数。结果可疑就先取证：数条数、看字节。 |
| “环境问题太常见，每次都现场查” | 快查表 1 秒，现场取证 72 秒。先查表。 |
| “这不重要，先做事” | 环境判断错了，后面的活全白干。 |

## 红线

- **消失的环境 = 消失的条目**：环境被删除、卸载、带离后，其条目与探测命令一并删除，不留墓碑。本表只描述当下存在什么。
- **快查表优先，实测兜底**：事实表命中即用；存疑才实测，实测结论以本次为准并更新认知。
- **不把证书错误当安全事件**：<LOCAL_PROXY> 是用户自装的已知常态；其开关状态模糊，任何快查表/记忆不得断言，任务前实测。
- **探测不改状态**：兜底命令只读；改环境先说明。
- **路由不等于建议**：判定后立即 Skill() 加载执行。
- **用户指令优先**：用户明确“直接做”时跳过查表。
