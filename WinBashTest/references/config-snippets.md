# 跨平台测试配置与工具（config-snippets）

Vitest / Playwright / MSW 在 Windows + Git Bash 下的可执行配置与辅助函数。所有片段遵守同一原则：**相对路径优先，必要时显式转换**。

## 跨平台 npm scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:watch": "vitest watch",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:debug": "vitest run --reporter=verbose"
  }
}
```

始终通过 npm scripts 运行测试，而不是直接调用 vitest/playwright 命令——保证不同 Shell 下行为一致。

## vitest.config.js（Windows 兼容）

```javascript
// vitest.config.js - 兼容 Windows
export default defineConfig({
  test: {
    include: [
      'tests/unit/**/*.test.js',     // 相对路径效果最好
      'tests/integration/**/*.test.js'
    ],
    // 避免以 /c/ 或 C: 开头的绝对路径
    setupFiles: ['./tests/setup.js'], // 使用相对路径
    coverage: {
      reportsDirectory: './coverage'  // 相对而非绝对
    }
  }
});
```

文件发现：使用 glob 模式而非绝对路径：

```javascript
// vitest.config.js - 使用 glob 模式，不要用绝对路径
export default defineConfig({
  test: {
    // [OK] Glob 模式跨平台工作
    include: ['tests/**/*.test.js', 'src/**/*.test.js'],

    // [FAIL] 绝对路径在 Git Bash 中有问题
    include: ['/c/project/tests/**/*.test.js']
  }
});
```

## playwright.config.js

```javascript
// playwright.config.js - 相对目录路径
export default defineConfig({
  // [OK]
  testDir: './tests/e2e',

  // [FAIL]
  testDir: '/c/project/tests/e2e'
});
```

```javascript
// playwright.config.js
export default defineConfig({
  use: {
    // [OK] 相对路径
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  // 使用相对路径的输出目录
  outputDir: './test-results',
});
```

## 路径转换辅助 tests/helpers/paths.js

```javascript
// tests/helpers/paths.js
import { execSync } from 'child_process';

/**
 * 将 Windows 路径转换为 Unix 路径，以兼容 Git Bash
 */
export function toUnixPath(windowsPath) {
  if (!needsPathConversion()) return windowsPath;

  try {
    // 如果可用，使用 cygpath
    return execSync(`cygpath -u "${windowsPath}"`, {
      encoding: 'utf8'
    }).trim();
  } catch {
    // 回退：手动转换
    // C:\Users\foo → /c/Users/foo
    return windowsPath
      .replace(/\\/g, '/')
      .replace(/^([A-Z]):/, (_, drive) => `/${drive.toLowerCase()}`);
  }
}

/**
 * 将 Unix 路径转换为 Windows 路径
 */
export function toWindowsPath(unixPath) {
  if (!needsPathConversion()) return unixPath;

  try {
    return execSync(`cygpath -w "${unixPath}"`, {
      encoding: 'utf8'
    }).trim();
  } catch {
    // 回退：手动转换
    // /c/Users/foo → C:\Users\foo
    return unixPath
      .replace(/^\/([a-z])\//, (_, drive) => `${drive.toUpperCase()}:\\`)
      .replace(/\//g, '\\');
  }
}

function needsPathConversion() {
  return !!(process.env.MSYSTEM ||
           (process.platform === 'win32' && process.env.TERM === 'cygwin'));
}
```

在测试中使用：

```javascript
import { toUnixPath, toWindowsPath } from '../helpers/paths.js';

test('加载配置文件', () => {
  const configPath = toWindowsPath('/c/project/config.json');
  const config = loadConfig(configPath);
  expect(config).toBeDefined();
});
```

## 测试文件中的相对导入

```javascript
// [OK] 相对路径在任何地方都有效
import { myFunction } from '../../src/utils.js';
import { server } from '../mocks/server.js';

// [FAIL] 绝对路径在 Git Bash 中可能引起问题
import { myFunction } from '/c/project/src/utils.js';
```

MSW 处理程序文件同理：

```javascript
// tests/mocks/server.js
// [OK]
import { handlers } from './handlers.js';

// [FAIL] 避免绝对路径
import { handlers } from '/c/project/tests/mocks/handlers.js';
```

## 临时目录处理 tests/setup.js

```javascript
// tests/setup.js - 跨平台临时文件处理
import os from 'os';
import path from 'path';

function getTempDir() {
  const tmpdir = os.tmpdir();

  // 在 Git Bash 中，os.tmpdir() 可能返回 Windows 路径
  // 确保测试框架能够使用它
  if (process.env.MSYSTEM && !tmpdir.startsWith('/')) {
    // 必要时转换 Windows 临时路径
    return tmpdir.replace(/\\/g, '/');
  }

  return tmpdir;
}

// 在测试中使用
const testTempDir = path.join(getTempDir(), 'my-tests');
```

## ESM 路径工具 tests/helpers/test-utils.js

```javascript
// tests/helpers/test-utils.js
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// 在 ESM 中获取 __dirname 的等效项
export function getCurrentDir(importMetaUrl) {
  return dirname(fileURLToPath(importMetaUrl));
}

// 跨平台路径拼接
export function testPath(...segments) {
  return path.join(...segments).replace(/\\/g, '/');
}

// 在测试文件中的使用：
// const __dirname = getCurrentDir(import.meta.url);
// const fixturePath = testPath(__dirname, 'fixtures', 'data.json');
```

## 模块导入失败修复

```javascript
// 使用 path.join() 或 path.resolve() 构建跨平台路径
import path from 'path';

const utilsPath = path.resolve(__dirname, '../src/utils.js');
const utils = await import(utilsPath);
```

## 覆盖率报告路径修复

```javascript
// vitest.config.js - 使用相对路径
export default defineConfig({
  test: {
    coverage: {
      // [OK]
      reportsDirectory: './coverage',

      // [FAIL]
      reportsDirectory: '/c/project/coverage'
    }
  }
});
```
