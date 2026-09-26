# Shell 检测（shell-detection）

Git Bash / MINGW 环境检测的完整代码实现。决策要点见 `path-conversion.md` 第一节。

## 方法 1：环境变量 MSYSTEM（最可靠）

Git Bash / MSYS2 会话中 `MSYSTEM` 必存在（MINGW64 / MINGW32 / MSYS），非 Git Bash 为空。

```javascript
// 在 Node.js 测试设置中检测 Git Bash/MINGW
function isGitBash() {
  return !!(process.env.MSYSTEM); // MINGW64, MINGW32, MSYS
}

function isWindows() {
  return process.platform === 'win32';
}

function needsPathConversion() {
  return isWindows() && isGitBash();
}
```

## 方法 2：设置脚本中使用 uname

```bash
# 在 bash 测试设置脚本中
case "$(uname -s)" in
  MINGW64*|MINGW32*|MSYS_NT*)
    # Git Bash/MINGW 环境
    export TEST_ENV="mingw"
    ;;
  CYGWIN*)
    # Cygwin 环境
    export TEST_ENV="cygwin"
    ;;
  Linux*)
    export TEST_ENV="linux"
    ;;
  Darwin*)
    export TEST_ENV="macos"
    ;;
esac
```

## 方法 3：测试配置中的组合检测

```javascript
// vitest.config.js 或测试设置文件
import { execSync } from 'child_process';

function detectShell() {
  // 首先检查 MSYSTEM（对 Git Bash 最可靠）
  if (process.env.MSYSTEM) {
    return { type: 'mingw', subsystem: process.env.MSYSTEM };
  }

  // 如果可用，尝试 uname
  try {
    const uname = execSync('uname -s', { encoding: 'utf8' }).trim();
    if (uname.startsWith('MINGW')) return { type: 'mingw' };
    if (uname.startsWith('CYGWIN')) return { type: 'cygwin' };
    if (uname === 'Darwin') return { type: 'macos' };
    if (uname === 'Linux') return { type: 'linux' };
  } catch {
    // uname 不可用（很可能是 Windows cmd/PowerShell）
  }

  return { type: 'unknown', platform: process.platform };
}

const shell = detectShell();
console.log('运行测试的环境:', shell.type);
```

## 按检测结果做条件设置

```javascript
// tests/setup.js
import { detectShell } from './helpers/shell-detect.js';

const shell = detectShell();

// 应用 Shell 特定配置
if (shell.type === 'mingw') {
  console.log('正在 Git Bash/MINGW 环境中运行');
  // 应用 MINGW 特定的测试设置
  process.env.FORCE_COLOR = '1'; // 在 Git Bash 中启用颜色
}

// 标准设置继续...
```
