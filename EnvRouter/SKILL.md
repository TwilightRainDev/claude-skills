---
name: EnvRouter
description: Windows 环境事实快查表与路由。遇到环境敏感任务或症状时使用。先查表取证（1 秒），再按事实路由到对应技能执行。
---

# 环境路由（Environment Router）

你是本机 Windows 环境事实的快查表与路由器。**模型会现场取证，但每次 72 秒；本机已知事实已实测固化，先查表。** 查表后仍不确定时再实测兜底，环境会变，旧记忆可能过时。

## 使用流程

1. **查本机事实表**（下表）→ 命中症状即得事实
2. **按路由表** → 需要深处理时 Skill() 加载对应技能
3. **查表未命中 / 事实存疑** → 跑最小实测命令（见"实测兜底"）确认后更新结论

## 本机已知环境事实（2026-08-09 实测版）

- **静态项**，一次实测固化，无需重复取证。
- **动态项**，随状态变化，任务前应实测确认。

| 维度 | 事实 | 状态 |
|---|---|---|
| Shell | 会话在 Git Bash（MSYSTEM=MINGW64）或 cmd/PowerShell；`$MSYSTEM` 判语境 | 静态 |
| Python | 裸 `python` = 官方 CPython 3.14.4（pythoncore-3.14-64，入口 `AppData\Local\Python\bin\python`）；MSYS2 的 `/d/msys64/ucrt64/bin/python`（3.14.5）在 PATH 后面。**项目依赖都在官方版，勿往 MSYS2 `pip install`** | **动态** |
| Python 编码 | 未设 `PYTHONUTF8`，stdout 编码为 GBK/cp936 | 静态 |
| GitHub 网络 | <LOCAL_PROXY> 为用户自装代理，劫持 github，证书验证错误为预期现象、非安全事件。**开关完全由用户决定，有时状态模糊：任何断言不可信，任务前必须实测** | **动态** |
| <LOCAL_PROXY> 证书 | 自签 4 张 <LOCAL_PROXY> CA，在 Windows 根存储，3 张有效，至 2027/2035/2036 | 静态 |
| git | Git for Win 2.54.0（`D:\Git\mingw64\bin\git.exe`），系统级 `http.sslbackend=schannel`（读 Windows 证书存储）配置在 `D:/Git/etc/gitconfig`；推送走 PAT + extraheader，无 gh/SSH | 静态 |
| git 身份 | `user.name=<account-login>`，`user.email` 为 noreply 邮箱 | 静态 |
| 文件系统 | H 盘 exFAT：无 ACL、无大小写敏感、git multi-pack-index 类操作可能失败 | 静态 |
| 开发工具链 | 一律关注 D 盘。无全局 JAVA_HOME。 | 静态 |
| 无头验证工具 | puppeteer-core `<VERIFY_TOOLS_DIR>`，node 包根 + verify.js 通用脚本 + Edge。<WORKSPACE>\Tools 仅存旧工具不新增 | 静态 |
| 行尾 | 工作区约定一律 LF；`core.autocrlf` 应为 false/input | 静态 |
| 路径约定 | Obsidian 仓库 `<OBSIDIAN_VAULT>`（Git Bash 格式）；**勿用** `/mnt/`（WSL 格式） | 静态 |

**证书报错分诊**（按报错原文）：
- "unable to get local issuer certificate" / "self-signed certificate" → 客户端走 OpenSSL 而非 schannel（WSL/MSYS2 git/IDE 内置 git/其他 git 安装）——补信任 <LOCAL_PROXY> CA 或 `git config http.sslbackend schannel`
- "certificate has expired" → 根存储有过期旧 CA；重启/更新 <LOCAL_PROXY> 用新证书链，**勿删证书**
- "connection refused" → hosts 劫持条目在但 <LOCAL_PROXY> 没跑（用户可能忘记开），非证书问题

## 路由表（症状 → 处理）

| 症状 | 处理 |
|---|---|
| PowerShell 中文乱码、Out-File/heredoc/管道编码问题 | `EncodingGuide` |
| Git 操作（含破坏性/跨平台/恢复/凭证） | `GitMaster` |
| Git Bash 下测试失败、路径转换、MSYSTEM 相关 | `WinBashTest` |
| 环境症状不明、需根因分诊 | `Debugging` |
| 环境配置收敛（settings.json/PATH/代理开关） | `ChangeClaudeConfig` |
| Obsidian 笔记查建整理 | `ObsidianVault` |
| 查表命中即明确 | 直接用表内事实处理，不再加载技能 |

## 实测兜底（只测动态项，只读命令）

静态项（schannel 配置、git 版本、身份、编码现状、exFAT 等）**不重复取证**——除非出现与之矛盾的报错。只测动态项：

```bash
echo "$MSYSTEM"                                          # Git Bash 判定
type -a python; python -c "import sys; print(sys.executable)"  # 解释器命中顺序（动态）
grep -n github /c/Windows/System32/drivers/etc/hosts     # <LOCAL_PROXY> 劫持条目有无（动态）
netstat -ano | grep -E '127\.0\.0\.1:443\s.*LISTENING'   # <LOCAL_PROXY> 是否在监听（动态；按进程名查不可靠）
git ls-remote https://github.com/<owner>/<repo>.git HEAD # 当前<LOCAL_PROXY>握手（动态，最终以它为准）
date                                                     # 系统时间（动态）
```

## Rationalization 红牌（发现自己在想这些 等于 先查表）

| 想法 | 现实 |
|---|---|
| "直接跑一下试试" | 跑之前先查表：哪个解释器会被命中？什么编码？ |
| "报证书错误就是被攻击/要修证书" | <LOCAL_PROXY> 是用户自装代理（开关由用户决定、可能忘开）。先实测当前状态与 schannel，勿动系统证书。 |
| "我记得 python 指向 MSYS2" | 查表，存疑就实测。 |
| "用 /mnt/d/ 格式" | WSL 格式。本机是 Git Bash，用 `D:/`。 |
| "环境问题太常见，每次都现场查" | 快查表 1 秒，现场取证 72 秒。先查表。 |
| "这不重要，先做事" | 环境判断错了，后面的活全白干。 |

## 红线

- **快查表优先，实测兜底**：事实表命中即用；存疑才实测，实测结论以本次为准并更新认知。
- **不把证书错误当安全事件**：<LOCAL_PROXY> 是用户自装的已知常态；其开关状态模糊，任何快查表/记忆不得断言，任务前实测。
- **探测不改状态**：兜底命令只读；改环境先说明。
- **路由不等于建议**：判定后立即 Skill() 加载执行。
- **用户指令优先**：用户明确"直接做"时跳过查表。
