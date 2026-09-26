---
name: SubagentDrivenDev
description: 执行实施计划时把独立任务拆给多个子代理，任务后评审 + 最终全分支评审。
---

# SubagentDrivenDev（子代理驱动开发）

按实施计划逐任务派发一个全新的实施者子代理，每个任务后做一次任务评审（spec 合规 + 代码质量），全部完成后做一次整分支宽评审。

**核心公式：** 每任务一个新子代理 + 任务评审（spec + 质量）+ 最终整分支评审 = 高质量、快迭代。

子代理不继承你的会话上下文与历史 —— 它拿到什么完全由你构造，因此能专注并做成；你的上下文也留给协调工作。

**叙述纪律：** 工具调用之间最多一行短叙述，记录由 ledger 与工具结果承担。

**连续执行：** 任务之间不向人类伙伴请示，把计划里的任务一路执行完。只有三种情况停下：你无法解决的 BLOCKED、真正阻断进展的歧义、全部任务完成。“要不要继续？”式请示与进度汇报是浪费对方时间 —— 对方要的是执行。

## 何时使用

按顺序过三个问题：

1. 有书面实施计划吗？没有 → 先手动执行或头脑风暴，不用本技能。
2. 任务之间基本独立吗？紧密耦合 → 手动执行或头脑风暴。
3. 留在当前会话做吗？需要并行独立会话 → 用 `ExecutingPlans`；否则用本技能。

与 `ExecutingPlans` 的差异：

| 维度 | 本技能 |
|---|---|
| 会话 | 同一会话内进行，无上下文切换 |
| 子代理 | 每任务一个全新子代理，无上下文污染 |
| 评审 | 每任务后评审（spec 合规 + 质量），末尾一次宽评审 |
| 节奏 | 任务之间无人在环，迭代更快 |

## 流程总览

全局骨架：准备（worktree + ledger + 读计划 + 预检）→ 逐任务循环 → 最终整分支评审 → 清理 workspace → 交 `FinDevBranch`。

每个任务的循环（最多 5 轮修复）：

1. 派发实施者（实施者提问就回答并补上下文）→ 实现、测试、提交、自评。
2. 生成 review package，派发任务评审者（spec 与质量双重把关）。
   - spec 与质量都过 → 记 ledger、标 todo 完成，进下一个任务。
   - 有未过项且与计划文本冲突 → 先问人类伙伴哪个为准。
3. 修复轮 R：R≤3 恢复原实施者；R≥4 换更强大模型的新实施者。
4. 每次修复后做 scoped re-review；全部解决 → 记 ledger 完成。
5. R=5 仍有余留 → 停止派发，逐条裁决（park 带裁定 / 承重问题 STOP 上报 BLOCKED）。

最终评审：全部任务完成后，派发最终代码评审（用最强模型）；有 findings 只派一个 fixer 带全部 findings 修一轮，再 scoped re-review 一次；残余裁决同任务循环。没有第二轮修复波。

## 准备（Setup）

### 隔离工作区

优先用宿主环境的原生 worktree 工具（如 `EnterWorktree`），否则用 `git worktree add` 在 `.worktrees/` 下创建一个 —— 或确认已存在的那个可用。未经人类伙伴明确同意，不得在 main/master 分支上开始实施。

### 计划专属 workspace

技能开始时运行本技能的 `scripts/sdd-workspace PLAN_FILE`，它打印本计划的 git-ignored 目录 `<repo-root>/sdd/<plan-basename>/`，该目录存放本计划的全部产物：ledger、brief、报告、review package。别的计划的目录不归你读或写。

### ledger（进度账）

会话记忆不跨 compaction 存活，丢失进度的控制器会重新派发整段已完成的任务序列。进度写进 ledger 文件，不能只放 todo。

- 查 `<workspace>/progress.md`：
  - 首行是本计划的计划文件 → 带 `Task <N>: complete` 行的任务已完成，不要重新派发，从第一个没有该行的任务续做。
  - 某任务最后一行是修复轮 → 该任务在循环中，从下一轮续做。
  - 首行是别的计划文件，或旧扁平路径 `sdd/progress.md` 下有游离 ledger → 那是别的计划的进度：原地不动，从零建自己的。
- 创建 ledger，首行写身份：`# SDD ledger — plan: <plan file path>`。
- ledger 是你的恢复地图：它记的 commit 在 git 里真实存在，即使你的上下文已不记得创建过它们。compaction 之后，信 ledger 与 `git log`，不信自己的回忆。
- `git clean -fdx` 会摧毁 workspace（它是 git-ignored 的临时目录）；真被清了，从 `git log` 恢复。

### 读计划与预检

1. 通读计划一次，记下它的上下文与 Global Constraints，每个任务建一个 todo。
2. 派发 Task 1 之前扫一遍计划中的冲突：
   - 任务之间互相矛盾，或与计划的 Global Constraints 矛盾。
   - 计划明确要求、但评审标准视为缺陷的东西（不断言任何东西的测试、逐字重复的逻辑块）。
3. 有发现 → 一次性打包问人类伙伴：每条发现连同强制它的计划原文并列，问哪一方为准；在开始执行前问，不要发现一条打断一次。扫描干净 → 不做评论直接开始。实现阶段才浮现的冲突由评审循环兜底。

## 模型选择

用能胜任该角色的最弱模型，以省成本、提速度。

| 角色 | 选型 |
|---|---|
| 机械实现（孤立函数、规格清晰、1-2 个文件） | 快而便宜的模型。计划写得够细时，多数实现任务都是机械的 |
| 集成与判断（多文件协调、模式匹配、调试） | 标准模型 |
| 架构与设计 | 最强可用模型。最终整分支评审属此类 —— 用最强可用模型派发，不要用会话默认模型 |
| 评审（按 diff 的规模、复杂度、风险缩放） | 小而机械的 diff 不需要最强模型，微妙的并发改动需要；小修复 diff 的 scoped re-review 用便宜到中档 |
| 修复循环升级（第 4-5 轮） | 比卡住的实施者至少高一档 |

**派发子代理时必须显式指定模型。** 省略模型会继承你所在会话的模型 —— 往往是最强最贵的那档，静默抵消本节的全部意义。

**回合数比 token 单价重要。** 墙钟时间与上下文成本随子代理的回合数增长，而最便宜的模型在多步任务上常规性地花 2-3 倍回合，总成本反而更高。评审者、以及按散文描述做事的实施者，以中档模型为下限。当任务的计划文本里含着要写的完整代码时，实现只是誊写加测试：这类实施者用最便宜的一档。单文件机械修复也用最便宜的一档。

实现任务的复杂度信号：

| 信号 | 选型 |
|---|---|
| 触及 1-2 个文件且规格完整 | 便宜模型 |
| 触及多个文件且有集成关注点 | 标准模型 |
| 需要设计判断或对代码库的广泛理解 | 最强可用模型 |

## 任务循环

粘进派发提示词的一切、以及子代理打印回来的一切，都会在会话余下的时间里驻留于你的上下文，并在之后每一回合被重读。产物一律以文件交接。

### 1. 派发实施者

派发前记录 BASE（`git rev-parse HEAD`）—— review package 与修复轮 diff 都要用它。

- **任务 brief：** 派发实施者前运行本技能的 `scripts/task-brief PLAN_FILE N` —— 它把该任务的全文抽到一个唯一命名的文件并打印路径。派发提示词要让 brief 成为需求的唯一来源：
  1. 一行说明本任务在项目中的位置。
  2. brief 路径，并说明 "read this first — it is your requirements, with the exact values to use verbatim"。
  3. brief 不可能知道的、来自前序任务的接口与决策。
  4. 你对 brief 中歧义的裁决。
  5. 报告文件路径与报告契约。
  确切取值（数字、魔法字符串、签名、测试用例）只出现在 brief 里。绝不让子代理读整个计划文件。
- **报告文件：** 按 brief 命名实施者的报告文件（brief `…/task-N-brief.md` → 报告 `…/task-N-report.md`），把路径写进派发提示词。实施者把完整报告写进该文件，只回传状态、commit、一行测试摘要与顾虑。
- 派发提示词描述一个任务，不描述会话历史。不要把累积的前序任务摘要（"state after Tasks 1-3"）粘进后续派发 —— 那会把派发提示词撑到几万字符，而全新子代理只需要它的任务、它触及的接口和全局约束，别的都不要。
- 前序任务在本次任务触及的区域 park 过 finding → 在派发里带上该 ledger 条目的指针。
- 记下派发结果中的实施者 agent 身份 —— 修复轮 1-3 要恢复这个 agent。
- 绝不并行派发多个实现子代理（会冲突）。

模板：[implementer-prompt.md](implementer-prompt.md)

### 2. 处理报告

实施者子代理回传四种状态之一：

| 状态 | 处理 |
|---|---|
| `DONE` | 生成 review package（本技能目录下的 `scripts/review-package PLAN_FILE BASE HEAD`，它打印写入的唯一文件路径），带该路径派发任务评审者。BASE 用派发实施者前记录的那个 commit，绝不用 `HEAD~1` —— 那会静默丢掉多 commit 任务中除最后一个之外的全部 commit |
| `DONE_WITH_CONCERNS` | 工作已完成但实施者标了疑虑。先读顾虑：涉及正确性或范围 → 送评审前先处理；属观察性质（如“这个文件越来越大”）→ 记下并送评审 |
| `NEEDS_CONTEXT` | 实施者缺信息。补齐缺失上下文后重新派发 |
| `BLOCKED` | 实施者无法完成。判定阻塞类型：上下文问题 → 补更多上下文，同模型重新派发；需要更强推理 → 换更强模型重新派发；任务过大 → 拆小；计划本身有错 → 升级给人类 |

绝不忽略一次升级，也绝不让同一模型不做任何改变地重试 —— 实施者说卡住了，就必须有东西改变。

实施者在开工前或任务中途提问时，清晰完整地回答，按需补上下文，不要催它进入实现。

### 3. 评审任务

任务评审是任务范围的闸门，宽评审只在最终的整分支评审做一次。绝不跳过任务评审，也绝不接受缺少任一裁决的报告 —— spec 合规与任务质量两者都必需。实施者自评永远不能替代任务评审。

- 以文件形式把 diff 交给评审者：运行本技能的 `scripts/review-package PLAN_FILE BASE HEAD`，把打印的文件路径交给评审者（没有 bash 时：把 `git log --oneline`、`git diff --stat`、`git diff -U10` 按该范围重定向到一个唯一命名的文件）。输出不进入你自己的上下文，评审者一次 Read 就拿到 commit 列表、stat 摘要与带上下文的完整 diff。BASE 用派发实施者前记录的那个，绝不用 `HEAD~1`，那会静默截断多 commit 任务。没有 diff 文件就不派发任务评审者。
- **评审者输入：** 三个路径 —— 同一个 brief 文件、报告文件、review package —— 外加约束该任务的全局约束。
- 交给评审者的全局约束块是它的注意力透镜。从计划的 Global Constraints 段或 spec 里逐字抄录有约束力的要求：确切取值、确切格式、以及组件之间陈述的关系（"same layout as X"、"matches Y"）。评审者模板已自带流程规则（YAGNI、测试卫生、评审方法），约束块负责本项目的 spec 要求什么。
- 不要在没有具体、任务相关理由时下开放指令，如“检查所有用法”“顺手跑一下竞态测试”。
- 不要让评审者重跑实施者已在同一份代码上跑过的测试 —— 测试证据在实施者报告里。
- 不要替评审者预判 finding —— 绝不指示评审者忽略或不报某个问题。你认为某条 finding 是误报，就让评审者提出、在评审循环里裁决。你正在写的提示词里出现 "do not flag"、"don't treat X as a defect"、"at most Minor"、"the plan chose" → 停止：你在预判，通常是为了给自己省掉一轮评审。
- 任务评审者可能报 "[WARN] Cannot verify from diff" 项 —— 位于未改动代码中或跨任务的需求。它不阻断评审的其余部分，但你必须逐条自行解决后才能把任务标为完成：计划与跨任务上下文在你手里，评审者没有。确认某项是真缺口 → 按 spec 评审未过处理，与其他 finding 一起进入修复循环。

模板：[task-reviewer-prompt.md](task-reviewer-prompt.md)

### 4. 修复循环

触发条件：评审报 spec [FAIL]、任何 Critical 或 Important finding、或你确认为真缺口的 [WARN] 项。

循环开始前，两条路线直接离开循环：

- Minor finding 随手记进进度 ledger（`Task <N>: minor (deferred): <one-liner>`），并让最终整分支评审指向该清单，由它分诊哪些必须在合并前修。没人看的汇总等于静默丢弃。Minor finding 永不进循环。
- 标为 plan-mandated 的 finding、或任何与计划文本要求冲突的 finding，是人类的决定，与任何计划矛盾同等处理：把 finding 与计划原文并列呈现，问哪一方为准。不因为计划强制它就丢弃它，也不在未问的情况下派发与计划矛盾的修复。

其余全部进入循环。一个修复轮 = 一次修复派发 + 一次 scoped re-review，每任务最多五轮。

| 轮次 | 派发对象 |
|---|---|
| 1-3 | 恢复原实施者，把未决 finding 逐字发给它。它的上下文完好：它知道任务、代码和自己的选择。宿主环境无法向存活子代理再发消息时，派发新实施者并带上 brief 路径、报告文件路径与 findings —— 无论如何，报告文件都是持久记忆 |
| 4-5 | 按“模型选择”派发更高能力模型的新实施者，带上 brief 路径、报告文件路径、未决 findings，以及这段框定："A prior implementer attempted this task [N] times; you own it now. Read the report file for what was tried." 三次恢复后循环仍未收敛，通常意味着实施者看不见自己的问题 —— 换一双眼睛加一档能力，一步到位 |

**每轮都做：** 实施者修复、重跑覆盖改动代码的测试、把修复报告追加到同一报告文件、回传简短契约。重新派发评审者之前，确认修复报告含覆盖测试、所跑命令、输出三者，三者齐备才派发 re-review。在修复消息里点名覆盖的测试文件 —— 一行修复不需要整套测试。

**re-review 是范围受限的。** 运行 `scripts/review-package PLAN_FILE FIX_BASE HEAD`（FIX_BASE 是上一次评审看到的 head），带 findings 清单、brief、报告文件与打印的 diff 路径派发 [re-review-prompt.md](re-review-prompt.md)。re-reviewer 对每条 finding 裁决 ADDRESSED 或 NOT ADDRESSED，只在修复 diff 范围内标记新的破坏。修复 diff 中新的 Critical/Important 破坏并入未决 findings。超出范围的观察记为 deferred minor 进 ledger，绝不延长循环。

**每轮之后**向 ledger 追加一行：
`Task <N>: fix round <R>/5 (<X> addressed, <Y> open — <finding one-liners>; commits <a7>..<b7>)`

绝不在控制器会话里自己修 finding —— 你的上下文要保持干净以做协调，且控制器修复绕过评审。

**熔断。** 第 5 轮的 re-review 仍有未决 finding 时，停止派发，逐条自行裁决（计划与跨任务上下文在你手里，评审者没有）：

| 情形 | 动作 |
|---|---|
| 评审者错了，或该点可争议 | park：`Task <N>: parked — <finding> — ruling: <why the code stands>`。最终评审会看到双方 |
| 是真的，但没有下游构建在它之上 | 同样 park，裁定写明“真实且延后” |
| 真实且承重 —— 后续任务构建在它之上，或它暴露了计划缺陷 | STOP。追加 `Task <N>: BLOCKED — <reason>`，把 finding、与之相撞的计划原文、修复历史一并报告人类伙伴。park 结构性失败会让每个依赖任务都构建在它之上，给最终评审送去一个它也修不了的问题 |

只在到达上限时裁决。提前裁决以结束循环，是换了个名字的预判。每次裁决都是一条 ledger 条目 —— 禁止静默丢弃。

### 5. 完成任务

评审干净返回 —— 或所有未决 finding 都在上限处带裁定 park —— 时，与其他记账在**同一条消息**里向 ledger 追加完成行：

- `Task <N>: complete (commits <base7>..<head7>, review clean)`
- `Task <N>: complete (commits <base7>..<head7>, <K> parked)`（熔断触发后）

然后标 todo 完成并前进。评审存在既未修复、也未在上限处带裁定 park 的 Critical/Important 问题时，绝不进入下一个任务。

## 最终评审

最终整分支评审也要有 package：运行 `scripts/review-package PLAN_FILE MERGE_BASE HEAD`（MERGE_BASE = 分支起始的 commit，如 `git merge-base main HEAD`），把打印的路径写进最终评审派发，让最终评审者读一个文件，而不是用 git 命令重新推导分支 diff。按“模型选择”用最强可用模型派发。让它指向 review-package 路径与 ledger 里的 deferred-minor、parked 行，以便分诊哪些必须在合并前修。

最终整分支评审返回 findings 时，只派一个修复子代理并带上完整 findings 清单 —— 不是每条 finding 一个 fixer：逐 finding 派 fixer 各自重建上下文、重跑测试套件，成本高于一次性修复。然后对修复波做且只做一次 scoped re-review（对修复范围运行 `scripts/review-package PLAN_FILE FIX_BASE HEAD`，[re-review-prompt.md](re-review-prompt.md)）。残余 finding 按任务循环的熔断裁决：park 带裁定，或对承重项停下。没有第二轮修复波 —— 残余承重 finding 由 `FinDevBranch` 呈现选项时上呈人类伙伴。

## 收尾

最终整分支评审干净且其修复已合入后，删除本计划的 workspace（`rm -rf <workspace>`）—— git 历史现在是记录。同级目录属于其他计划，不要动。

使用 `FinDevBranch`。

## 常见辩解

| 借口 | 事实 |
|---|---|
| “spec 合规上差不多就行” | 评审者发现 spec 缺口 = 没做完。修掉，或到上限后裁决 —— 那只有两条出口 |
| “我自己修更快，派发是开销” | 控制器修复污染你的上下文且绕过评审。恢复实施者 |
| “再来一轮就收敛了” | 过了上限，轮次不会收敛 —— 失败是结构性的。裁决并路由 |
| “评审者反正会找新问题” | scoped re-review 只验证修复，不会漫游。未改动代码上的新 finding 进 ledger，不进循环 |
| “这条 finding 明显是错的，我丢掉” | 你只在上限处裁决，且每次裁定都是一条 ledger 条目。禁止静默丢弃 |
| “修复很小，跳过 re-review” | 未评审的修复正是回归落地的方式。每轮都以一次 scoped re-review 收尾 |
| “评审拖慢循环” | 没有评审的循环只是未验证的空转。评审是循环的刹车与方向 |
| “ledger 记账是开销” | ledger 是跨越 compaction 存活的东西。没有它的控制器曾重新派发整段已完成任务序列 |

## 示例工作流

完整示例（含一个修复轮）见 `references/example-workflow.md` —— 对照学习控制器节奏：brief 派发 → 报告处理 → review package → task review → fix loop → ledger 记账。
