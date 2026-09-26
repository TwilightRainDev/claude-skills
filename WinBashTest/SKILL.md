---
name: WinBashTest
description: Win和 Git Bash 环境下的 Vitest、Playwright 及 MSW 测试兼容性指南。
---

# Windows 和 Git Bash 测试兼容性

## 概述

测试在 Windows 的 Git Bash/MINGW 下出现路径转换、Shell 检测、启动失败等问题时，先用本页的路由表定位症状与对策；需要完整可执行代码时再按指针读取对应 reference。本文件只做路由与决策引导，不内嵌大段代码。

## 何时使用

- 测试报 "No such file or directory"、模块导入失败、Playwright 浏览器启动失败
- 覆盖率 / 截图 / 视频产物写到错误位置
- 需要跨平台 CI 矩阵，或测试需要按 Shell 条件设置
- MSW 在 Git Bash 下工作异常

## 症状 → 对策（路由表）

| 症状 | 根因 | 对策 | 完整代码 |
|------|------|------|---------|
| 路径被改写（/foo → C:/Program Files/Git/usr/foo） | Git Bash 自动路径转换 | 相对路径首选；单条命令 `MSYS_NO_PATHCONV=1`；需绝对路径时 `cygpath` | references/path-conversion.md |
| "No such file or directory"（C:UsersUsername...） | 路径转换 + 临时目录 | 同上；或改走 npm scripts | references/path-conversion.md |
| Cannot find module '../src/utils' | 分隔符混淆 | `path.join()` / `path.resolve()` 构建路径 | references/config-snippets.md |
| Playwright 启动失败 | DISPLAY/BROWSER 变量干扰 | `unset DISPLAY` + `unset BROWSER` | 见下方错误速查 |
| 覆盖率/产物写到 /c/... 失败 | 配置中绝对路径 | 输出目录与 include 一律相对路径 | references/config-snippets.md |
| 需要按环境条件设置测试 | 不知道当前 Shell | 检测 `MSYSTEM` 环境变量（最可靠） | references/shell-detection.md |
| CI 需要多平台验证 | 单平台测试漏掉平台问题 | GitHub Actions matrix 三平台跑 | references/ci-matrix.md |

## 核心规则（思路引导）

1. **用 npm scripts 执行测试**，不要直接调 vitest/playwright——Shell 行为一致性，npm 自动处理路径。
2. **配置、导入、产物目录一律相对路径**，避免 `/c/` 或 `C:\` 开头的绝对路径。
3. **条件设置先检测 Shell**：`process.env.MSYSTEM` 存在即 Git Bash/MINGW；uname 检测仅作补充。
4. **出问题先试禁用路径转换**：`MSYS_NO_PATHCONV=1`，再排查其他原因。
5. **程序化构建路径用 `path.join()`**，需要跨 Shell 表示时再显式转换（cygpath）。
6. **Playwright 有头模式**：确认 `DISPLAY` / `BROWSER` 未被设置。
7. **Node 18+ 才有原生 fetch**，MSW 2.x 依赖它。

## 快速参考（行内命令）

```bash
# Shell 检测
echo $MSYSTEM           # MINGW64 / MINGW32 / 空
uname -s                # Git Bash 显示 MINGW64_NT-*
node -p process.platform  # Windows 上为 win32

# 路径转换
MSYS_NO_PATHCONV=1 vitest run          # 单条命令禁用转换
export MSYS2_ARG_CONV_EXCL="--coverage.reporter"   # 特定模式禁用
export MSYS_NO_PATHCONV=1 && npm test  # 整个会话禁用
cygpath -u "C:\path"    # Windows → Unix
cygpath -w "/c/path"    # Unix → Windows
```

## 常见错误速查

| 错误 | 修复 |
|------|------|
| Error: /usr/bin/bash: line 1: C:Users...No such file | `MSYS_NO_PATHCONV=1 npm test`；或经 npm scripts 运行 |
| Cannot find module '../src/utils' | `path.resolve()` 后动态 import |
| Failed to launch browser | `unset DISPLAY` + `unset BROWSER` 后重试 |
| Failed to write coverage to /c/project/coverage | coverage.reportsDirectory 改相对路径 |
| Playwright 安装异常 | 优先 `npx playwright install`；必要时改用 Windows 原生命令提示符安装 |

## References

- `references/path-conversion.md` —— 路径转换与编码安全共享说明书（Shell 检测要点、三种解法、内嵌脚本三层解析、临时文件）
- `references/shell-detection.md` —— 三种检测方法的完整实现（MSYSTEM / uname / 组合检测 + 条件设置）
- `references/config-snippets.md` —— 跨平台 npm scripts、vitest/playwright 配置、paths.js / setup.js / test-utils.js 辅助函数、MSW 导入
- `references/ci-matrix.md` —— GitHub Actions 多平台测试矩阵

## 资源

- [Git Bash 路径转换](https://www.msys2.org/docs/filesystem-paths/)
- [Vitest 配置](https://vitest.dev/config/)
- [Playwright on Windows](https://playwright.dev/docs/browsers#install-system-requirements)
- [MSW Node.js Integration](https://mswjs.io/docs/integrations/node)
