---
name: GitMaster
description: 完整的 Git 专家知识体系，覆盖所有 Git 操作。含 git archive 行尾、exFAT 上 git gc / multi-pack-index 失败。
---

# GitMaster（Git 精通）

覆盖从基础到高级的完整 Git 操作，对破坏性命令设强制安全护栏，并提供平台特定工作流。

## 何时使用

任何 Git 命令或操作均可激活：

- 仓库初始化、克隆、配置
- 分支管理和策略
- 提交工作流及最佳实践
- 合并策略和冲突解决
- Rebase 操作（交互式和非交互式）
- 历史重写（filter-repo、reset、revert）
- 恢复操作（reflog、fsck）
- 危险操作（force push、hard reset）
- 平台特定工作流（GitHub、Azure DevOps、Bitbucket、GitLab）
- 高级功能（子模块、worktree、钩子）
- 性能优化、大文件（LFS）
- 跨平台兼容性（Windows/Linux/macOS）

**关键触发词：** 用户提到 Git、GitHub、GitLab、Bitbucket、Azure DevOps、版本控制、commit/push/pull/merge/rebase、分支管理、历史修改或恢复场景。

## 安全第一

在执行任何破坏性操作之前：

```bash
# 始终先检查状态
git status
git log --oneline -10

# 对于危险操作，创建一个安全分支
git branch backup-$(date +%Y%m%d-%H%M%S)

# 记住：git reflog 是你的安全网（默认保留 90 天）
git reflog
```

**用户偏好检查（在任何 Git 任务开始时始终询问）：**

“您希望我：
1. 自动创建提交，并使用合适的提交信息
2. 仅暂存更改（由您手动提交）
3. 仅提供指导（不自动执行任何操作）”

在整个会话中尊重此选择。

## 核心原则

### 1. 破坏性操作的安全护栏

在任何破坏性操作（`reset --hard`、force push、`filter-repo` 等）之前：

1. 始终明确警告用户
2. 清楚说明风险
3. 请求确认
4. 建议先创建备份分支
5. 提供恢复指引

详见 `references/dangerous-operations.md` 中的完整安全协议和确认脚本。

### 2. 提交创建策略

在任何 Git 任务开始时，始终询问用户偏好（自动提交 / 仅暂存 / 仅指导）。在整个会话中尊重此选择。

### 3. 平台感知

Git 的行为在不同平台和托管服务商上有所不同：

- **Windows（Git Bash/PowerShell）：** 行尾符（`core.autocrlf`）、路径分隔符、大小写敏感性、Windows 凭据管理器
- **Linux/macOS：** 大小写敏感文件系统、SSH 密钥管理、权限
- **托管平台：** GitHub（PR、Actions、`gh` CLI）、Azure DevOps（PR、Pipelines、策略）、Bitbucket（PR、Pipelines、Jira）、GitLab（MR、CI/CD）

详见 `references/platform-workflows.md` 中的托管平台特定命令，以及 `references/cross-platform.md` 中的 Windows/Linux/macOS 处理方式。

## 关键准则

### Windows 文件路径要求

在 Windows 的 Git Bash 会话中使用 Edit 或 Write 工具时，文件路径用正斜杠（`/`），不用反斜杠（`\`）：

- 正确：`D:/repos/project/file.tsx`
- 错误：`D:\repos\project\file.tsx`

适用于：Edit/Write 的 `file_path` 参数及所有文件操作。

### 本机陷阱（症状 → 对策）

| 症状 | 对策 | 正文 |
|------|------|------|
| `git archive` 取出的文件是 CRLF | 取 LF 用 `git show`，或 `git -c core.autocrlf=false archive` | `fact:machine.text-eol` |
| exFAT 卷上 `git gc` / `git maintenance` 报 `could not write multi-pack-index` | 删 `.git/objects/pack/multi-pack-index`，清无对应 `.pack` 的孤儿 `.idx`，再重跑 | `fact:machine.fs.volume-heal` |

第二条不绑定盘符。本机各卷现为 NTFS，只在 exFAT 仓库上触发。

### 文档编写准则

除非用户明确要求，或者已有 `docs` 文件夹，否则绝不创建新的文档文件。优先更新现有的 README.md 文件。保持文档简洁、直接、专业。

## 参考文件索引

本 SKILL.md 作为精简编排器。详细的命令目录和操作流程位于 `references/` 中；在执行某一类命令前，加载对应的参考文件。

| 参考文件 | 内容 |
|-----------|------|
| `references/basic-operations.md` | init、clone、config、基本工作流、分支、远程仓库、fetch/pull/push（非破坏性） |
| `references/merging-rebasing.md` | 合并策略、冲突解决、rebase（交互式/onto/autosquash）、cherry-pick |
| `references/advanced-commands.md` | stash（含 Git 2.51+ 的 import/export）、revert、reflog、bisect、clean、worktree、子模块、标签 |
| `references/dangerous-operations.md` | reset（hard/soft/mixed）、force push、filter-repo、amend 已推送提交、安全协议 |
| `references/platform-workflows.md` | GitHub、Azure DevOps、Bitbucket、GitLab 的 CLI 和 CI/CD 模板 |
| `references/performance-large-files.md` | GC、repack、fsck、LFS、浅克隆、大文件发现 |
| `references/hooks-and-security.md` | 客户端/服务端钩子、凭据管理、SSH、GPG、密钥防范、约定式提交 |
| `references/troubleshooting-recovery.md` | 常见问题、恢复场景、紧急命令 |
| `references/cross-platform.md` | 行尾符、大小写敏感性、Git Bash/MINGW 路径转换、Shell 检测 |

## 快速命令索引

| 任务 | 参考文件 |
|------|-----------|
| `git init`、`git clone`、`git add`、`git commit`、`git log`、`git diff` | basic-operations |
| `git branch`、`git switch`、`git remote`、`git fetch`、`git pull`、`git push` | basic-operations |
| `git merge`、冲突标记、`git rebase -i`、`git cherry-pick` | merging-rebasing |
| `git stash`、`git revert`、`git reflog`、`git bisect`、`git clean`、`git worktree`、`git submodule`、`git tag` | advanced-commands |
| `git reset --hard`、`git push --force[-with-lease]`、`git filter-repo`、amend 已推送 | dangerous-operations |
| `gh pr`、`az repos pr`、`bb pr`、`glab mr`、CI/CD YAML | platform-workflows |
| `git gc`、`git repack`、`git lfs`、浅克隆 | performance-large-files |
| `.git/hooks/*`、约定式提交、SSH/GPG/密钥 | hooks-and-security |
| 分离 HEAD、恢复分支/文件/提交、损坏的仓库 | troubleshooting-recovery |
| `core.autocrlf`、`core.ignorecase`、`MSYS_NO_PATHCONV`、`cygpath`、`$MSYSTEM` | cross-platform |
| `git archive` 行尾、exFAT 上 `git gc` / midx | 上表「本机陷阱」；正文 `fact:machine.text-eol`、`fact:machine.fs.volume-heal` |

## 成功标准

1. 始终在任务开始时询问用户偏好（自动提交 vs 手动）
2. 在破坏性操作前始终警告
3. 在危险操作前始终创建备份分支
4. 始终解释恢复方法
5. 根据项目选择合适的分支策略
6. 编写有意义的提交信息
7. 保持提交历史整洁且线性
8. 绝不提交密钥或大型二进制文件
9. 提交前测试代码
10. 知道如何从任何错误中恢复
