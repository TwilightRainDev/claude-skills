# 通路诊断命令集（network-diagnostics）

SKILL.md 阶段 1-4 的可执行细节。全部命令在本机实测过，输出形态照录。

## 一、通路探测

```
netstat -ano | grep -E '127\.0\.0\.1:443\s+.*LISTENING'
tasklist | grep -i 302
grep -c '#<LOCAL_PROXY>' /c/Windows/System32/drivers/etc/hosts
git ls-remote https://github.com/<owner>/<repo>.git HEAD
```

判读：

- `netstat` 命中 → 有进程在接管，记下 PID
- 条目数（实测 <count> 条 `#<LOCAL_PROXY>`）**只说明配置存在，不说明可用**——它是常驻的
- `ls-remote` 是唯一能证明"链路通"的判据

**nslookup 是假线索**：它绕过 hosts 返回真实 IP（如 20.205.243.166），与 git 实际走的路径无关。

## 二、接管者是谁

持有 443 的**不是 GUI**，而是引擎：

```
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name LIKE '%302%'\" | Select-Object ProcessId,ParentProcessId,Name,CreationDate | Format-Table -AutoSize"
```

实测的启动链（时间戳为同一次运行）：

```
pid 2396  <proxy-gui-exe>   23:56:01   GUI，父为 explorer
pid 12220 <proxy-cli>   23:56:21   <- 持有 127.0.0.1:443，父为 2396
pid 7664  <proxy-caddy> 23:56:33   内嵌 Web 服务器，父为 12220
```

约 30 秒从提交 GUI 到 443 就位。

### 四个可执行体（勿混）

| 文件 | 大小 | 日期 | 清单 | 角色 |
|---|---|---|---|---|
| `<proxy-gui-exe>` | <size> | <date> | `requireAdministrator` | **唯一能自我提权的入口** |
| `<proxy-cli>` | <size> | <date> | 无 | **真正的引擎**，由 GUI spawn |
| `<proxy-cli-exe>` | <size> | <date> | `asInvoker` | 旧版残留，勿用 |
| `<proxy-caddy>` | <size> | <date> | 无 | 引擎自带，单独启动会绕过编排 |

清单查询：`grep -a -o -c "requireAdministrator" <exe>`

`<proxy-cli>` 无任何提权清单，也没有 `runas`/`IsUserAnAdmin` 之类自我提权代码——单独从普通 shell 启动会**静默退出、不写 hosts、无报错**。只有被提权后的 GUI 拉起时才正常工作。

### 提权是静默的

```
HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System
  EnableLUA                  = <value>
  ConsentPromptBehaviorAdmin = <value>   # <elevation-mode>
  PromptOnSecureDesktop      = <value>
```

`<system-user>` 在 Administrators 组，故带 `requireAdministrator` 清单的程序由 AppInfo 服务直接派发完整令牌，**不弹 UAC**。若日后 UAC 改回提示模式，改用计划任务派发提升令牌（`/RL HIGHEST`，`/IT` 用交互令牌、无需存密码）。

### 启停

```
# 起（幂等）
explorer.exe "<PROXY_DIR>\<proxy-gui-exe>"

# 停：必须先 GUI 后引擎，否则 .cli 成孤儿继续占 443
taskkill /IM <proxy-gui-exe> /F
taskkill /IM <proxy-cli> /F
```

`<proxy-lock>`（0 字节）由运行中实例刷新，做单实例守卫。进程崩溃而锁残留时，**不要直接删锁重启**——先 `taskkill` 干净收尾。二进制内另有 `<proxy-exit-ipc>` 字符串，疑为优雅退出 IPC，未实测，不作依赖。

## 三、TLS 后端对照实验

同命令、同时刻、同仓库，只改后端：

| 组 | 命令 | 结果 |
|---|---|---|
| A | 默认（schannel） | 成功 3/3 |
| B | `-c http.sslBackend=openssl` | **精确复现** `unable to get local issuer certificate` |
| C | openssl + `-c http.sslCAInfo=<PROXY_DIR>/<proxy-ca-pem>` | 成功 2/3（另 1 次是上游 502，与 TLS 无关） |

取证命令：

```
git config --show-origin --get-all http.sslBackend
env | grep -iE 'GIT_SSL|CURL_CA|SSL_CERT'
openssl s_client -connect 127.0.0.1:443 -servername github.com   # issuer 应为 CN=<PROXY-CA-NAME>
certutil -store Root | grep -i <proxy-ca-name>                     # 确认 CA 在机器 Root
grep -c <PROXY-CA-NAME> /<git-ca-bundle>   # 实测 0
```

<LOCAL_PROXY> MITM CA：`<PROXY_DIR>\<proxy-ca-pem>`，`CA:TRUE pathlen:0`，2026-06-29 → 2036-06-26。
节点证书 subject `CN=<proxied-host>`、issuer `CN=<PROXY-CA-NAME>`，只发叶子不带链。

### 修复

```
# 首选：换回走 Windows 存储的后端
git config --global http.sslBackend schannel
```

调用方必须用 openssl 时，把 <LOCAL_PROXY> CA 并入 git 自带 bundle（**不要覆盖原 bundle**）：

```
{ cat /<git-ca-bundle>; echo; cat /<PROXY_DIR>/<proxy-ca-pem>; } > /<PROXY_DIR>/git-ca-bundle.crt
git config --global http.sslCAInfo '<PROXY_DIR>/git-ca-bundle.crt'
```

反对的两种做法：

- `http.sslVerify=false` —— 把所有主机的校验一起关掉
- 按 URL 钉 `http.https://github.com/.sslCAInfo` —— <LOCAL_PROXY> 关停后会直连真实证书，反过来校验失败

## 四、可达性与抖动

上游 502 是瞬态。实测 8 次连续 `git ls-remote`：成功 5、失败 3，失败全部是代理返回的 `HTTP 502` / `RPC failed`。

判定推送专用端点是否抵达：

```
curl -o /dev/null -w '%{http_code}' "https://github.com/<owner>/<repo>.git/info/refs?service=git-receive-pack"
# 401 = 已抵达、只差认证（网络层没问题）
```

**直连不是退路**：`curl --resolve` 打真实 IP 的结果是分裂的——140.82.112.3 / 140.82.116.3 及 api、raw 可通，但 140.82.113.3 / 140.82.114.3 / 140.82.121.3 / 20.27.177.113 / 4.237.22.34 及 DNS 返回的 20.205.243.166 全部 timeout。且 `env` 无 proxy、git config 无 `http.proxy`，除 hosts + <LOCAL_PROXY> 外没有第二条路。

## 五、`<proxy-ini>` 相关项

```
github                        = 1      # github 项已开；<LOCAL_PROXY>.hosts 含 42 条 github 条目
Auto_Modify_Hosts             = 1
DNS_Mode                      = 0
autostart                     = 1      # [NOTE] 未落地——Run 项与计划任务里都没有 <LOCAL_PROXY>
Auto_Minimize_To_Tray         = 1
```

目录与 `<proxy-ini>`、早期日志中仍写旧路径 `<legacy-proxy-dir>`（该目录已不存在）。启动路径按 EXE 所在目录解析，不受影响。
