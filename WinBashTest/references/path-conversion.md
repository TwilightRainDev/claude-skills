# Git Bash / Windows 路径转换与编码安全（path-conversion）

Git Bash 环境下路径、转义与编码问题的共享说明书。权威宿主为 `WinBashTest`；`EncodingGuide` 条目六（Git Bash 内嵌脚本）、`GitMaster/references/cross-platform.md` 覆盖同一主题的不同场景。

## 一、Shell 检测

**最可靠：环境变量 `MSYSTEM`**（Git Bash / MSYS2 会话中必存在）。

```bash
echo "$MSYSTEM"        # MINGW64 / MINGW32 / MSYS，空则非 Git Bash
uname -s               # MINGW64_NT-* / CYGWIN_NT-* / Linux / Darwin
node -p process.platform  # Windows 上为 win32
```

```javascript
function isGitBash() { return !!(process.env.MSYSTEM); }
```

## 二、路径转换问题

Git Bash 会自动把 Unix 风格参数转换为 Windows 路径，导致测试文件路径、模块导入、命令参数出错：

```bash
/foo      → C:/Program Files/Git/usr/foo
/foo:/bar → C:\msys64\foo;C:\msys64\bar
--dir=/foo → --dir=C:/msys64/foo
```

**三种解法（按优先级）：**

1. **相对路径（首选）** —— 配置、导入、输出目录一律用相对路径，任何环境都有效。
2. **禁用转换** —— 单条命令或整个会话：
   ```bash
   MSYS_NO_PATHCONV=1 vitest run
   export MSYS2_ARG_CONV_EXCL="--coverage.reporter"
   export MSYS_NO_PATHCONV=1
   ```
3. **显式转换** —— 需要绝对路径时用 `cygpath`：
   ```bash
   cygpath -u "C:\path"   # Windows → Unix（/c/path）
   cygpath -w "/c/path"   # Unix → Windows（C:\path）
   ```

## 三、内嵌脚本的三层解析（EncodingGuide 条目六的通用化）

在 Bash 工具中写 `node -e` / `python -c` 内嵌脚本时，转义被**三层叠加解析**：工具参数 JSON 层 → Bash 引号层 → 目标语言字符串层。要最终得到 1 个反斜杠，工具调用层需要写 4 个 `\\\\`；未知转义序列（`\a`、`\p`、`\w`）会被静默吞掉反斜杠。

**规则：**
- 路径一律用正斜杠（`D:/android-sdk`）——Windows API 与 Node/Python 都接受，彻底绕过转义层。
- 不要用完整行字符串做字面匹配；用不含反斜杠的唯一锚点子串定位，再 `indexOf` + 切片插入。
- 复杂脚本一律写临时文件执行，不用 `-e`/`-c` 内嵌。

## 四、临时文件与输出路径

- Git Bash 用 Unix 风格临时目录；`os.tmpdir()` 可能返回 Windows 路径，必要时转换（`/` 统一）。
- 测试产物（截图、视频、覆盖率）一律相对路径输出目录（`./test-results`、`./coverage`）。

## 五、Windows 测试执行的通行规则（速查）

1. 用 npm 脚本执行测试，不要直接调 vitest/playwright（Shell 行为一致性）。
2. 配置与导入用相对路径，避免 `/c/` 或 `C:\` 开头的绝对路径。
3. 条件设置时检测 Shell 环境（`MSYSTEM`）。
4. 出问题先试 `MSYS_NO_PATHCONV=1`。
5. Playwright 有头模式注意 `unset DISPLAY` / `unset BROWSER`。
6. 程序化路径构建用 `path.join()`。
