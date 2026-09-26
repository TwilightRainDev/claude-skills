# 通路诊断命令集（network-diagnostics）

SKILL.md 阶段 1-4 的可执行细节。四可执行体、TLS 后端、MITM CA 见 `fact:github.network-diagnostics`。
`#<LOCAL_PROXY>` 条目分布与 ini 开关表见 `fact:network.proxy.s302`。本文件不复述那些值，也不断言代理当前开关。

## 一、通路探测

```
netstat -ano | grep -E '127\.0\.0\.1:443\s+.*LISTENING'
tasklist | grep -i 302
grep -c '#<LOCAL_PROXY>' /c/Windows/System32/drivers/etc/hosts
git ls-remote https://github.com/<owner>/<repo>.git HEAD
```

判读：

- `netstat` 命中 → 有进程在接管，记下 PID
- hosts 条目数只说明配置存在，不说明可用（条数见 `fact:network.proxy.s302`）
- `ls-remote` 是唯一能证明"链路通"的判据

**nslookup 是假线索**：它绕过 hosts 返回真实 IP，与 git 实际走的路径无关。

## 二、接管者是谁

持有 443 的不是 GUI，而是引擎。四个可执行体的角色与字节见 `fact:github.network-diagnostics`。

```
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name LIKE '%302%'\" | Select-Object ProcessId,ParentProcessId,Name,CreationDate | Format-Table -AutoSize"
```

约 30 秒从提交 GUI 到 443 就位。PID 与时刻每次不同，不要把某次运行的 PID 写进事实库。

清单查询：`grep -a -o -c "requireAdministrator" <exe>`

引擎单独从普通 shell 启动会静默退出、不写 hosts、无报错。只有被提权后的 GUI 拉起时才正常工作。

### 提权是静默的

```
HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System
  EnableLUA                  = <value>
  ConsentPromptBehaviorAdmin = <value>   # <elevation-mode>
  PromptOnSecureDesktop      = <value>
```

本机管理员组成员带 `requireAdministrator` 清单的程序由 AppInfo 服务直接派发完整令牌，不弹 UAC。
若日后 UAC 改回提示模式，改用计划任务派发提升令牌（`/RL HIGHEST`，`/IT` 用交互令牌、无需存密码）。

### 启停

```
# 起（幂等）
explorer.exe "<PROXY_DIR>\<proxy-gui-exe>"

# 停：必须先 GUI 后引擎，否则 .cli 成孤儿继续占 443
taskkill /IM <proxy-gui-exe> /F
taskkill /IM <proxy-cli> /F
```

`<proxy-lock>`（0 字节）由运行中实例刷新，做单实例守卫。进程崩溃而锁残留时，不要直接删锁重启——先 `taskkill` 干净收尾。

## 三、TLS 后端对照

同命令、同时刻、同仓库，只改后端。取证与修复命令：

```
git config --show-origin --get-all http.sslBackend
env | grep -iE 'GIT_SSL|CURL_CA|SSL_CERT'
openssl s_client -connect 127.0.0.1:443 -servername github.com
certutil -store Root | grep -i <proxy-ca-name>
```

对照实验结论与 CA 路径见 `fact:github.network-diagnostics`。生效 git 是哪一份见 `fact:machine.git.install`。

首选换回 schannel：

```
git config --global http.sslBackend schannel
```

调用方必须用 openssl 时，把 <LOCAL_PROXY> CA 并入副本 bundle（不要覆盖原 bundle）：

```
{ cat /<git-ca-bundle>; echo; cat /<PROXY_DIR>/<proxy-ca-pem>; } > /<PROXY_DIR>/git-ca-bundle.crt
git config --global http.sslCAInfo '<PROXY_DIR>/git-ca-bundle.crt'
```

反对的两种做法：

- `http.sslVerify=false` —— 把所有主机的校验一起关掉
- 按 URL 钉 `http.https://github.com/.sslCAInfo` —— 代理关停后会直连真实证书，反过来校验失败

## 四、可达性与抖动

上游 502 是瞬态。判定推送专用端点是否抵达：

```
curl -o /dev/null -w '%{http_code}' "https://github.com/<owner>/<repo>.git/info/refs?service=git-receive-pack"
# 401 = 已抵达、只差认证（网络层没问题）
```

直连真实 IP 不是退路。除 hosts + <LOCAL_PROXY> 外没有第二条路（见 `fact:github.network-diagnostics`）。
