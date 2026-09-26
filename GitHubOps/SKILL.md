---
name: GitHubOps
description: 当在本机做 GitHub 平台操作（建仓/推送/发布/PR/Release）或 GitHub 通路报错（连接被拒/证书/502）时使用
---

# GitHubOps

## 概述

本机到 GitHub 的通路只有一条：**hosts 劫持 github.com → 127.0.0.1，再由 <LOCAL_PROXY> 本地代理转发**。没有备用出口——实测直连真实 IP 大面积超时，`env`/git config 里也没有任何 proxy 配置。

因此 GitHub 操作失败时，几乎总能定位到这条链的某一环。核心原则：**先按症状把失败定位到具体环节，再动手**。在没定位之前重试、改配置或绕过，都只会让下一次失败更难解释。

纯本地的 git 操作（对象模型、分支、历史改写）不属于本技能，走 GitMaster。

## 核心流程

### 阶段 1 — 通路（每次操作前，结论不缓存）

判据是**端口监听与真实握手**，不是 hosts。

hosts 里的劫持条目是常驻的：代理死了条目照样在盘。实测最常见的失败态恰恰是"条目在、进程死"——此时域名被黑洞，看 hosts 会误判成"已开"。所以：

```
netstat -ano | grep -E '127\.0\.0\.1:443\s+.*LISTENING'   # 有没有人在接管
git ls-remote https://github.com/<owner>/<repo>.git HEAD    # 真握手
```

未监听时**不要停下报告，直接拉起 GUI**（这是唯一能自我提权的入口）：

```
explorer.exe "<PROXY_DIR>\<proxy-gui-exe>"
```

本机提权是**静默**的（`ConsentPromptBehaviorAdmin=<value>`，`<system-user>` 在 Administrators 组），不会弹 UAC，无需人工确认。提交后轮询等待 443 监听就位（实测约 30 秒），再走一次握手确认，然后继续原任务。

起不来时按顺序排查：`<proxy-lock>` 是否残留单实例 → 先 `taskkill` 干净收尾再启。停机也必须**先 GUI 后引擎**，否则引擎成孤儿继续占着 443。

### 阶段 2 — 认证

两种头，按通道选，别混：

| 通道 | 头 |
|---|---|
| REST API | `Authorization: Bearer <token>` |
| git 协议 | `Authorization: Basic base64(<account-login>:<token>)`，经 `-c http.extraheader` 传入 |

令牌在 `<CREDENTIALS_DIR>/<github-token-file>`。**remote URL 始终保持干净**——写进去就会永久留在 `.git/config`。

推送前先验一次凭据与权限范围，比推失败再查便宜：

```
curl -s -H "Authorization: Bearer <token>" https://api.github.com/user
curl -sI -H "Authorization: Bearer <token>" https://api.github.com/user | grep -i x-oauth-scopes
```

### 阶段 3 — TLS：证书错误的真正原因

**本机的证书报错几乎都不是证书有问题，而是 git 选了哪个 TLS 后端。**

- **schannel 后端**走 Windows 根存储。<LOCAL_PROXY> 的 MITM CA（`CN=<PROXY-CA-NAME>`）已装机级 Root，因此能验通。
- **openssl 后端**只认静态 bundle（包内 `tools/git/mingw64/etc/ssl/certs/ca-bundle.crt`），该 bundle 里没有 <LOCAL_PROXY> CA，链建不起来，报 `unable to get local issuer certificate`。

**报错措辞可直接判定后端**，这是最快的分诊：

| 措辞 | 后端 |
|---|---|
| `unable to get local issuer certificate` | OpenSSL |
| `schannel: SEC_E_UNTRUSTED_ROOT` | schannel（真不受信） |

本机 system 级配置写的是 `http.sslBackend=schannel`，所以默认路径本该正常。出现 OpenSSL 措辞，说明这次调用被**额外强制**成了 openssl——查环境变量（`GIT_SSL_BACKEND` / `GIT_SSL_CAINFO` / `CURL_CA_BUNDLE`）、命令行 `-c`、或是否用了另一套 git 二进制。

修复优先换回 schannel；若调用方必须用 openssl，就显式指定 <LOCAL_PROXY> 的 CA。**不要用 `http.sslVerify=false`**——那是把所有主机的证书校验一并关掉。也**不要按 URL 钉死 `sslCAInfo`**——<LOCAL_PROXY> 关停后直连真实证书会反过来校验失败。

完整命令与 A/B 对照见 `references/network-diagnostics.md`。

### 阶段 4 — 读症状表定环节

| 症状 | 根因 | 处置 |
|---|---|---|
| `Failed to connect ... port 443` | 代理没跑（条目在、进程死） | 回阶段 1 拉起 GUI |
| `unable to get local issuer certificate` | git 走了 openssl 后端 | 回阶段 3 |
| `HTTP 502` / `RPC failed` | 代理到上游的抖动，**瞬态** | 重试；见下方"502 纪律" |
| `401` | 网络通、缺凭据 | 回阶段 2 |
| `404` | 仓库不存在 **或** 你的身份看不见它 | 列举账号仓库区分 |

**502 纪律**：上游抖动实测约 8 次里失败 3 次，是瞬态而非硬阻断——直接重试 2-3 次往往就过。大推送宜拆小，降低单次 502 的代价。**别把 502 当认证失败去查凭据**，那是白费功夫。

**404 分诊**：GitHub 对"无权限的私有仓库"也回 404。别急着断定仓库不存在——先用 `GET /user/repos?per_page=100` 列一遍账号名下的仓库，排除了权限因素，才能确认是真的不存在。

### 阶段 5 — 不可逆动作的护栏

以下动作**对外可见或不易撤销**，执行前先向用户确认，不要因为"任务里没禁止"就做：

- 创建仓库（尤其 public——一建就是公开可索引的）
- 修改仓库可见性、转移所有权
- 删除仓库、删除远端分支
- 强推（`--force`）到已发布分支、改写已推送的历史
- 发布 Release / 打 tag（对外宣告版本）

任务只说"假设仓库存在"时，**不要顺手建一个**——那既改变了任务前提，也可能造成用户并不想要的公开记录。需要建仓时给出确切命令让用户拍板。

## 快速参考

```
通路探测    netstat -ano | grep -E '127\.0\.0\.1:443\s+.*LISTENING'
拉起代理    explorer.exe "<PROXY_DIR>\<proxy-gui-exe>"
真握手      git ls-remote https://github.com/<owner>/<repo>.git HEAD
带令牌推    git -c http.extraheader="Authorization: Basic $B64" push -u origin main
后端取证    git config --show-origin --get-all http.sslBackend
```

停机顺序：`taskkill /IM <proxy-gui-exe> /F` → `/IM <proxy-cli> /F`

## 常见错误

**把 token 拼进 remote URL** —— "这样就省得每次传 header 了"。它会把凭据永久写进 `.git/config`，且随仓库一起被复制、备份、误提交。用 `-c http.extraheader` 进程级传入。

**用 `http.sslVerify=false` 绕过证书错误** —— 它让所有主机的校验一起失效，把一次配置问题变成长期的安全洞。证书错误在本机有确定成因，按阶段 3 分诊即可。

**靠 `grep hosts` 判断代理状态** —— 条目常驻，代理死了它还在。判据永远是监听与握手。

**没定位就反复重试** —— 502 值得重试，连接被拒和证书错误重试一万次也一样。先看症状表。

**把 404 直接当成"仓库不存在"** —— 也可能是你的身份看不见。先列仓库。

## 红旗信号

出现以下念头时停下来，回到对应阶段：

- "先把 token 写进 URL，回头再清理" → 不会有回头，它已经落盘了
- "关掉证书校验先跑通" → 阶段 3 有确定的成因和修法
- "重试一下应该就好了"（但没看症状） → 先查症状表，再决定要不要重试
- "任务没说不让建，我就建了" → 不可逆动作默认要确认
- "hosts 里有 github，代理应该是开着的" → 这正是最常见的误判
