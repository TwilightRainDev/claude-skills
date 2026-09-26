# 多平台 CI 矩阵（ci-matrix）

## GitHub Actions 多平台测试矩阵

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node: [18, 20, 22]
    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}

      - run: npm ci
      - run: npm test
      - run: npm run test:e2e
        if: matrix.os == 'ubuntu-latest'  # 仅在 Linux 上运行 E2E
```

要点：

- 矩阵覆盖 ubuntu / windows / macos 三平台，尽早暴露平台特定问题
- 所有测试通过 npm scripts 执行，避免平台 shell 差异
- E2E 等重任务按需限制运行平台
