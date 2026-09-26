# 仓库清单与各自特殊性（repositories）

本机 GitHub 事实的唯一编辑副本在 `fact\github\`；本文件只保留操作程序。
本机仓库副本、remote、gitignore 实测见 `fact:github.repositories`。
博客文档去向见 `fact:projects.blog`。技能备份管道见 `fact:skills.backup-pipeline`。

## 博客部署链路（代码不可推导）

推 main 之后约 1 分钟 Cloudflare Pages 才生效，别急着判定构建失败。

`gh-pages` 是历史遗留：`hexo deploy` 方案已废弃并在 `_config.yml` 中声明移除。
推 gh-pages 不会触发 CF 构建。

技术陷阱（csp.js 中间件时序、giscus CSP、hexo 下划线文件等）记在 `<WORKSPACE>\Blog\CLAUDE.md`。

## 公开仓库的合规（改文件时不要顺手删归属）

- `HowToAskQue`：源为 ryanhanwu 仓库，MIT，署名保留；繁体版链接已改指原仓库。
- `DSClaudeCodeRouter`：MIT，NOTICE 保留 dsh 归属。
- 本机有无副本见 `fact:github.repositories`。没有副本时先 clone 再改。

## claude-skills 同步

同步只能跑脚本，不要手工 `cp` 后直接推送。管道见 `fact:skills.backup-pipeline`。

```
bash <WORKSPACE>\Code\claude-skills-sync\sync.sh ["提交信息"]
```

脚本做四件事：复制、脱敏、校验闸门、提交推送。
`README.md` 由脚本按各 `SKILL.md` 的 frontmatter `description` 自动生成，不要手改。
个人隐私人设不入库：`PersonaEcho/skills/relationship/` 下按真人蒸馏的角色不备份。

## 首次发布一个新仓库的顺序

顺序错了要付重写历史的代价：

1. 确认署名与 noreply（见 `fact:github.identity` / `fact:github.account`）——必须在首次提交前
2. 首次提交
3. 在 GitHub 建仓（不可逆，先向用户确认；见 SKILL.md 阶段 5）
4. `git remote add origin https://github.com/<owner>/<repo>.git`（干净 URL）
5. 推送：`git -c http.extraheader="Authorization: Basic $B64" push -u origin main`
6. 复验：`git ls-remote origin HEAD` 与远端页面

本机全局 `init.defaultBranch` 与 GitHub 新仓默认分支见 `fact:github.repositories`。
要推成默认分支就得先 `git branch -m main`。

## 网页占位 README 导致的 rebase 冲突

在 GitHub 网页上勾了 "Add a README" 建仓，远端就有一个初始提交；若本地也 init 并提交过，`git pull --rebase origin main` 会在 README.md 上冲突。

rebase 不比 merge——它先 checkout 上游作新基线，再逐个重放你的提交。所以在冲突现场：

- `--ours` = 远端那份网页占位 README
- `--theirs` = 你本地写的那份

与 merge 时的直觉正好相反。要保住本地内容：

```
git checkout --theirs -- README.md
git add README.md
git rebase --continue
```

若已经用错方向把本地版覆盖掉了，从原提交里捞回来再 `--amend`：`git show <原提交>:README.md > README.md`。
