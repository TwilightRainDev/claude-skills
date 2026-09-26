# 评审共享协议（review-protocol）

审查引擎族的共用说明书：**评审范围收集**、**并行代理派发协议**、**评审包生成**。
权威宿主为 `ReviewPr`；PolishCode、SecurityAudit、ReviewStandards、Debugging 的并行分派均引用本文件。
各引擎保留自己的视角定义、过滤阈值与输出格式，本文件只定义共享骨架。

## 一、阶段 0：评审范围收集（权威版）

同一命令序列在 PolishCode / ReviewPr / SecurityAudit 中曾三处重复，此处为唯一维护点。

**默认范围（对已提交变更）：**

```bash
# 优先上游，其次 main，最后 HEAD~1；按首个可解析者执行
git diff @{upstream}...HEAD
git diff main...HEAD
git diff HEAD~1
```

**未提交变更：** 若存在未提交更改，或上述范围差异为空，运行 `git diff HEAD` 并把工作树变更纳入范围。评审通常在提交之前运行。

**目标覆盖：** 若用户传入了 PR 编号、分支名称或文件路径，改为评审该目标，忽略默认推导。

**固定点模式（ReviewStandards 变体）：** 用户说出的任何提交 SHA、分支名、标签、`main`、`HEAD~N` 即固定点；未指定则询问。

```bash
git diff <fixed-point>...HEAD   # 三个点：比较 merge-base
git log <fixed-point>..HEAD --oneline   # 提交列表
git rev-parse <fixed-point>     # 预校验固定点可解析
```

无效引用或空差异应在此阶段失败——不要在并行子代理内部失败。

## 二、阶段 1：并行代理派发协议

同一骨架在 PolishCode（4 代理）、ReviewPr（3 代理）、SecurityAudit（3 代理）、ReviewStandards（2 代理）、Debugging 阶段 0（独立故障域分派）中同构。

**派发规则：**

1. 通过 Agent 工具启动 N 个独立代理，**全部放在单条消息中**以便并发运行。
2. 每个代理只接收：评审范围（或评审包文件路径）+ 一个明确的视角/角度 + 发现条目的输出契约。**不传会话历史。**
3. 每个代理返回的发现条目遵循统一最小结构：
   - `file`、`line`（或范围标识）
   - 单行 `summary`
   - 具体代价 / 失败模式 / 为何真实（按引擎语义选择）
4. 任务描述必须**聚焦、自包含、有约束、明确输出**——四要素缺一不可：

| 过于宽泛 | 聚焦 |
|---|---|
| "审查所有代码" | "评审 diff `base..head`，只看 X 视角" |
| "检查竞态条件" | "粘贴错误消息和测试名称" |
| 无约束，代理顺手重构 | "只读评审，不修改任何文件" |
| 输出模糊，"没问题" | "返回 file:line + summary + 理由" |

**并行分派适用于修复域（Debugging 阶段 0）时，另加两条独立性检验：** 多个故障相互独立（修复一个不影响其他）；代理不会编辑同一文件或争用同一资源。不满足则不得并行，合为一个域调试。

**何时不得并行：** 故障相互关联、需要全系统上下文才能理解任何一个、尚处探索阶段不知什么坏了、代理会相互干扰。

## 三、阶段 2：聚合与过滤

1. **去重：** 对指向同一行或同一机制的发现去重。
2. **过滤：** 丢弃预先存在的问题（非此范围引入）、工具（lint/typechecker/编译器）必报的问题、可能的误报。
3. **阈值（各引擎自定）：** ReviewPr 保留置信度 >=80 的发现；SecurityAudit 按严重性（严重/重要/次要）排序；PolishCode 跳过会改变预期行为或超出范围的发现并注明。
4. **诚实报告：** 没有剩余发现时明确说明，不硬凑。

## 四、评审包生成（review-package）

**原则：** diff 与提交列表作为文件交付，不进入派发者上下文；评审代理一次 Read 读完。派生成本只发生一次。

**通用版脚本（审查引擎族用）：**

```bash
# 本技能目录：ReviewPr/scripts/review-package
"$(dirname "$0")/../scripts/review-package" BASE HEAD          # 默认输出到系统临时目录
"$(dirname "$0")/../scripts/review-package" BASE HEAD out.diff # 指定输出文件
```

生成内容：提交列表、变更统计、带扩展上下文（-U10）的完整 diff。BASE 用派发前记录的 `git rev-parse HEAD`，**不要用 `HEAD~1`**——会静默丢弃多提交任务的全部提交。

**变体：** SubagentDrivenDev 的 `scripts/review-package`（带 PLAN_FILE 参数，默认输出到 `<repo-root>/sdd/<plan-basename>/`）为计划场景专用版，与通用版同一生成逻辑；两者以通用版为最新基准，SDD 版若有漂移以 SDD 版为准。

**无 Bash 时的等价手写：** `git log --oneline` + `git diff --stat` + `git diff -U10` 重定向到一个唯一命名文件。
