# 凭据与身份（credentials-and-identity）

本机 GitHub 事实的唯一编辑副本在 `fact\github\`；本文件只保留操作程序。
账号与 noreply 见 `fact:github.account`。认证通道与 PAT 文件名见 `fact:github.auth-channels`。
署名与 GH007 见 `fact:github.identity`。凭据目录见 `fact:credentials.api-key-dir`。

## 推送时怎么带令牌

git 协议必须进程级传入 Basic 头，不落盘。令牌文件名与两种头见 `fact:github.auth-channels`。

```
TOKEN=$(cat "<CREDENTIALS_DIR>/<github-token-file>" | tr -d '\r\n')
B64=$(printf '<account-login>:%s' "$TOKEN" | base64 | tr -d '\n')
git -c http.extraheader="Authorization: Basic $B64" push -u origin main
```

remote URL 始终保持干净：`https://github.com/<owner>/<repo>.git`，不带任何凭据。
写进去会永久留在 `.git/config`，并随仓库被复制、备份、误提交。

不要建议改用 `gh` 或 SSH 作为捷径（本机有无见 `fact:github.account`）。

## 推送前先验令牌

比推失败再查便宜：

```
curl -s  -H "Authorization: Bearer <token>" https://api.github.com/user
curl -sI -H "Authorization: Bearer <token>" https://api.github.com/user | grep -i x-oauth-scopes
```

`X-OAuth-Scopes` 应含完整 `repo`。缺权限时该有的报错是 403，而不是 404。

## 404 的两义性

GitHub 对无权访问的私有仓库同样返回 404，与"仓库不存在"无法从状态码区分：

```
curl -s -H "Authorization: Bearer <token>" "https://api.github.com/user/repos?per_page=100"
```

列出账号名下的仓库，排除了权限因素，才能确认是真的不存在。

## 新仓库首提前配署名

具体值从 `fact:github.account` / `fact:github.identity` 取，不要用系统用户名顶替。
必须在首个提交之前配好；发布后再改邮箱要重写历史，所有提交哈希都会变。
