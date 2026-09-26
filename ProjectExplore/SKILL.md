---
name: ProjectExplore
description: 当接手或初步了解一个项目、不清楚项目是什么、怎么组织、怎么运行，需要快速建立项目心智模型时使用
---

# ProjectExplore — 项目上手探索

## 概述

文档说"是什么"，图说"在哪"。本项目探索技能把两类数据源交叉验证，产出**可复用的项目概览档案**：

- **md/txt 文档**（README、架构文档、ADR、CHANGELOG）：项目意图、设计决策、运行方式
- **codegraph 图**（本地 SQLite 知识图谱）：入口、核心模块、符号调用关系、影响半径

只读文档会错过"代码里真正的大头"；只看图会错过"项目的意图和坑"。两者交叉，才有完整心智模型。

## 何时使用

- 初步接触一个项目，不清楚它是什么
- 需要建立/更新项目心智模型（核心模块、关键符号、修改入口）
- 会话中需要项目全局图景，而非单文件细节

**不使用**：只查单个符号/文件（直接 `codegraph explore` 或 Read 即可，无需全套流程）；项目已熟、仅改小功能。

## 核心流程

```
触发 → ① 旧档检查 → ② 侦察 → ③ 索引就绪 → ④ 文档读取 → ⑤ 图交叉验证 → ⑥ 写档案
```

### ① 旧档检查（变化检测）

检查 `E:\work_zone\Docs\<项目名>-项目概览.md` 是否存在：

- **存在** → 对比档案头部时间戳与当前状态：
  - 源信号：项目内 md/txt 的最新 mtime 晚于档案记录时间戳
  - 图信号：`codegraph status` 的节点数 ≠ 档案记录的节点数
  - **无变化** → 直接引用旧档案给摘要，流程结束
  - **有变化** → 继续重新探索
- `--force` 参数强制忽略旧档全量重跑

### ② 侦察

- md/txt 清单（排除 node_modules/.git/.codegraph/dist 等）
- 项目清单文件：package.json / pyproject.toml / Cargo.toml / *.sln / go.mod 等
- `.codegraph/` 是否存在

### ③ 索引就绪

项目无 `.codegraph/` → 先执行 `codegraph init`（建索引是探索的前置，秒级完成）。已建则跳过。

### ④ 文档读取（优先级队列，150KB 上限）

按优先级消费，**总量上限 150KB**，超限即停：

1. README（任何大小写变体）
2. 架构/设计文档（Architecture*.md、docs/design/、design docs）
3. ADR（doc/adr/、docs/adr/、ADR-*.md）
4. CHANGELOG / 变更日志
5. 其他 md/txt

**超限处理**：剩余文档只列清单（路径+一句话主题，从文件名/首行推断），不读内容——探索者后续按需深入。

### ⑤ 图交叉验证

在项目目录内用 codegraph CLI（见快速参考）：

- **验证文档提到的符号**确实存在（`query`），不存在则标注"文档过时"
- **找文档没提的事实**：node 数最大的文件/模块（`files` 或 `status`）、高被引用符号（`callers`）
- 入口符号确认（`node` 查 main 入口的调用者）

### ⑥ 写档案

产出 `E:\work_zone\Docs\<项目名>-项目概览.md`（模板见下），并在对话给出摘要。档案只落 Docs 目录，**不写项目目录、不写 CLAUDE.md**。

## 产物模板（结构槽位，照填）

```markdown
# <项目名> 项目概览
> 探索日期：<YYYY-MM-DD> | 项目路径：<path>
> 数据源时间戳：文档最新 mtime=<ts> / 图节点数=<n>

## 项目是什么
## 怎么跑
## 技术栈与入口
## 核心模块与关键符号
## 修改入口与影响
```

## 快速参考

**本机 codegraph CLI 形态**（npm 本地安装，PATH 无此命令）：

```bash
BASE="E:/work_zone/ClaudeCode/.claude/mcps/codegraph/node_modules/@colbymchenry/codegraph-win32-x64"
CG="$BASE/node.exe"
SCRIPT="$BASE/lib/dist/bin/codegraph.js"
# 用法示例：cd 项目目录后 "$CG" "$SCRIPT" status
# 均需在项目目录内运行（query/explore 不支持 path 参数）
```

| 命令 | 用途 |
|---|---|
| `codegraph status` | 索引状态、节点数（变化检测依据） |
| `codegraph query <词> --limit N` | 符号搜索，验证文档提到的东西 |
| `codegraph node <符号\|文件>` | 单符号源码 + 调用者 |
| `codegraph explore <query>` | 相关符号源码 + 调用路径 + 影响半径 |
| `codegraph files --max-depth 2` | 文件结构，找最大模块 |
| `codegraph callers <符号>` | 高被引用符号（影响核心的判定） |
| `codegraph init` | 建索引（前置步骤） |

## 常见错误

| 借口 | 现实 |
|---|---|
| "项目小，不用建索引" | init 秒级完成；图让后续查询精确，探索结论也有据可查 |
| "只读 README 就够了" | README 说意图，图说事实——文档提的符号可能已不存在或已重构 |
| "文档全读一遍更放心" | 150KB 上限防失控；剩余列清单，按需深入 |
| "重新探索一次更稳" | 旧档优先 + 变化检测就是稳的；没变化重跑是浪费 |
| "结论写在对话里就行" | 档案落 Docs 让下次会话可复用；对话不持久 |
| "符号用 grep 慢慢找" | 索引已建好就一次 `query`/`explore`，别用 27 次工具调用手搓 |

## 红旗信号

- 未做旧档检查直接全量重跑
- 项目已建索引却全程 grep 手搓符号
- 档案写入项目目录或 CLAUDE.md（应只在 E:\work_zone\Docs）
- 超 150KB 还在继续读文档
