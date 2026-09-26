# 仓库清单与各自特殊性（repositories）

本机涉及的 GitHub 仓库，以及每个仓库不能从代码推导的特殊约定。本文件是本机 GitHub 事实的**唯一来源**。

## 一、<account-login>/TwilightRain（博客）

| 项 | 值 |
|---|---|
| 本地路径 | `<WORKSPACE>\Blog`（本机唯一在册的 git 仓库副本） |
| remote | `https://github.com/<account-login>/TwilightRain.git` |
| 站点 | `twilightrain.pages.dev` |
| 构建 | Cloudflare Pages **监听 main 分支**，`npm run build` → `public/` |

**部署链路（代码不可推导）**：推 main 之后约 1 分钟 CF 才生效，**别急着判定构建失败**。

**gh-pages 是历史遗留**：`hexo deploy` 方案已废弃并在 `_config.yml` 中声明移除，本地也没有 gh-pages 跟踪分支（远端是否仍存残留，离线不可验）。无论如何，**推 gh-pages 不会触发 CF 构建**——GitHub Pages 时代的路径已经不通了。

**仓库内其它约定**：

- `.git/config` 本地设了 `core.autocrlf=false`（覆盖 system 级的 true）
- `.gitignore` 忽略 `docs/`，是用户主动加的隐私防护，别"顺手"删掉
- 提交邮箱已改为 noreply；**旧提交里仍含真实邮箱**，属历史，不改
- 技术陷阱（csp.js 中间件时序、giscus CSP、hexo 下划线文件等）记在 `<WORKSPACE>\Blog\CLAUDE.md`

## 二、三个公开仓库

| 仓库 | 本地副本 | 内容 | 许可与署名要求 |
|---|---|---|---|
| `claude-skills` | `<WORKSPACE>\Code\claude-skills` | 全部技能的备份镜像 | 各技能目录内标注 |
| `HowToAskQue` | 不在本机 | README（2026 新版）+ 旧版.md（经典翻译版） | 源为 ryanhanwu 仓库，MIT，**署名保留**；繁体版链接已改指原仓库 |
| `DSClaudeCodeRouter` | 不在本机 | dsh 思维模式路由移植为 Claude Code hook | MIT，**NOTICE 保留 dsh 归属** |

后两个需要改动时先 clone 到本地再操作；它们的许可与署名是**合规要求**，改动文件时不要顺手删掉归属声明。

### claude-skills 的备份约定

- **来源**：`~/.claude/skills/`（本机即配置根下 `home\.claude\skills\`），技能目录平铺在仓库根
- 该仓库同时是**发布渠道**：CreatePrompts / EncodingGuide 曾按版本发布（v1.0.0 / v1.2.0，见 commit `6e69cb3`、`39476a3`）；备份时若用本地工作版覆盖，旧发布版只留在 git 历史里
- `README.md` 维护技能索引表，新增技能时要同步
- **个人隐私人设不入库**：`PersonaEcho/skills/relationship/` 下按真人蒸馏的角色不备份
- `__pycache__` / `*.pyc` 不入库；`SelfImprovingAgent` 这类空壳技能也无法入库（git 不跟踪空目录）
- 文本统一 LF 入库，由 `.gitattributes` 的 `* text=auto eol=lf` 保证；`git add --renormalize` 只作用于已跟踪文件，**新增文件要另跑一次 `git add`**
- 署名 `<account-login> <<account-id>+<account-login>@users.noreply.github.com>`

## 三、已消失的路径（勿再引用）

- `<WORKSPACE>\Code\DSRouteSuite` —— 已不存在
- `<WORKSPACE>\Docs` —— 曾为 git 仓库，现**已非** git 仓库

## 四、首次发布一个新仓库的顺序

顺序错了要付重写历史的代价，所以固定按此走：

1. 确认署名与 noreply 邮箱（见 `credentials-and-identity.md` 第七节）——**必须在首次提交前**
2. 首次提交
3. 在 GitHub 建仓（**不可逆动作，先向用户确认**；见 SKILL.md 阶段 5）
4. `git remote add origin https://github.com/<owner>/<repo>.git`（干净 URL）
5. 推送：`git -c http.extraheader="Authorization: Basic $B64" push -u origin main`
6. 复验：`git ls-remote origin HEAD` 与远端页面

**分支名**：本机全局 `init.defaultBranch=master`，但 GitHub 新仓库默认 main。要推成默认分支就得先 `git branch -m main`，否则会推上去一个非默认分支。

## 五、网页占位 README 导致的 rebase 冲突

在 GitHub 网页上勾了 "Add a README" 建仓，远端就有一个初始提交；若本地也 init 并提交过，`git pull --rebase origin main` 会在 README.md 上冲突。

**坑在于方向是反的**：rebase 不比 merge——它先 checkout 上游作新基线，再逐个重放你的提交。所以在冲突现场：

- `--ours` = **远端**那份网页占位 README
- `--theirs` = **你本地**写的那份

与 merge 时的直觉正好相反。要保住本地内容：

```
git checkout --theirs -- README.md
git add README.md
git rebase --continue
```

若已经用错方向把本地版覆盖掉了，从原提交里捞回来再 `--amend`：`git show <原提交>:README.md > README.md`。
