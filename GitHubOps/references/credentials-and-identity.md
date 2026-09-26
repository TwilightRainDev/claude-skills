# 凭据与身份（credentials-and-identity）

GitHub 操作的凭据来源、两种认证通道、以及提交署名规则。本文件是本机 GitHub 事实的**唯一来源**；CLAUDE.md、user-context.md 与持久记忆只保留指针。

## 一、账号

- 账号 **<account-login>**，数字 id **<account-id>**
- noreply 邮箱：`<account-id>+<account-login>@users.noreply.github.com`

## 二、凭据文件

统一在 `<CREDENTIALS_DIR>/`：

| 文件 | 内容 |
|---|---|
| `<github-token-file>` | PAT，`ghp_` 前缀（经典令牌） |
| `<recovery-codes-file>` | 账号恢复码 |

**本机没有 gh CLI，也没有 SSH key**——所有操作只能走 HTTPS + PAT。不要建议改用 `gh` 或 SSH 作为捷径。

## 三、两种认证通道

| 通道 | 头 | 用途 |
|---|---|---|
| REST API | `Authorization: Bearer <token>` | 建仓、改设置、发 Release、查状态 |
| git 协议 | `Authorization: Basic base64(<account-login>:<token>)` | push / fetch / ls-remote |

git 协议的写法（**进程级传入，不落盘**）：

```
TOKEN=$(cat "<CREDENTIALS_DIR>/<github-token-file>" | tr -d '\r\n')
B64=$(printf '<account-login>:%s' "$TOKEN" | base64 | tr -d '\n')
git -c http.extraheader="Authorization: Basic $B64" push -u origin main
```

**remote URL 始终保持干净**：`https://github.com/<owner>/<repo>.git`，不带任何凭据。写进去会永久留在 `.git/config`，并随仓库被复制、备份、误提交。

## 四、推送前先验令牌

比推失败再查便宜：

```
curl -s  -H "Authorization: Bearer <token>" https://api.github.com/user
curl -sI -H "Authorization: Bearer <token>" https://api.github.com/user | grep -i x-oauth-scopes
```

`X-OAuth-Scopes` 应含完整 `repo`。缺权限时该有的报错是 403，而不是 404——见下条。

## 五、404 的两义性

GitHub 对**无权访问的私有仓库**同样返回 404，与"仓库不存在"无法从状态码区分。别急着下结论：

```
curl -s -H "Authorization: Bearer <token>" "https://api.github.com/user/repos?per_page=100"
```

列出账号名下的仓库，排除了权限因素，才能确认是真的不存在。

## 六、提交署名

**`<system-user>` 只是系统用户名，禁止用作提交署名**，也禁止用 `-c user.name="<system-user>"` 覆盖。

署名遵循**各仓库既有惯例**——先 `git log -1 --format='%an <%ae>'` 看最近提交，不要全局一刀切：

| 场景 | 署名 |
|---|---|
| Blog 仓库（TwilightRain） | `TwilightRain <<account-id>+<account-login>@users.noreply.github.com>` |
| README / LICENSE / GitHub 平台侧（发布、Release、仓库描述） | `<account-login>` |

**历史提交不改动。**

## 七、邮箱与 GH007

账号开启了邮箱隐私保护：**提交邮箱若不是 noreply，推送会被 GH007 拒绝**。

因此**新仓库必须在首个提交之前就配好**：

```
git config user.name  "<account-login>"
git config user.email "<account-id>+<account-login>@users.noreply.github.com"
```

发布之后再改邮箱需要 `filter-branch` 重写历史，**所有提交哈希都会变**——代价远高于一开始就配对。
