---
name: PersonaEcho
description: 把 colleague/relationship/celebrity 三类角色蒸馏成可复用技能。
argument-hint: "[character] [name-or-slug]"
version: "1.0.0"
user-invocable: true
allowed-tools: Read, Write, Edit, Bash
---

# PersonaEcho（角色蒸馏创建器）

把 colleague / relationship / celebrity 三类角色蒸馏成可复用 Skill：录入基础信息 → 导入原材料 → 分析 → 预览 → 由 writer 落盘。

## 执行环境

本技能固定使用中文执行。所有 `Bash` 命令都必须在当前 `SKILL.md` 所在目录执行，不要拼接 `cd ~/.hermes/...`、`cd ~/.claude/...`、`cd ~/.openclaw/...`、`cd ~/.codex/...` 或硬编码 `/Users/.../PersonaEcho` 路径。当前工作目录就是 skill 根目录，直接运行 `python3 tools/...`。下文所有 `tools/...` 和 `prompts/...` 均为相对 skill 根目录的相对路径。宿主只需能读取本地文件并执行 Bash / Python 命令；兼容宿主：Claude Code、OpenClaw、Hermes、Codex。

## 何时使用

用户说出以下任意一条时，启动创建流程：

- `/PersonaEcho`
- “帮我创建一个 skill”
- “我想蒸馏一个人”
- “新建一个 skill”
- “给我做一个 XX 的 skill”

用户对已有 Skill 说出以下任意一条时，进入进化模式：

- “我有新文件” / “追加”
- “这不对” / “他不会这样” / “他应该是”
- `/update-skill {character} {slug}`
- 兼容更新别名：`/update-colleague {slug}`

用户要求查看已生成的 Skill 时，执行下方“管理操作”里的列出命令。

统一主入口是 `PersonaEcho`；在支持 slash command 的宿主中使用 `/PersonaEcho`。Hermes 只保证 `/PersonaEcho` 这一条 slash 入口稳定；`colleague`、`relationship`、`celebrity` 的兼容语义保留在工具层和 preset 层，不保证每个兼容名称都能作为 Hermes slash command 被路由。

## 工具使用规则

| 任务 | 使用工具 |
|------|---------|
| 读取 PDF 文档 | `Read` 工具（原生支持 PDF） |
| 读取图片截图 | `Read` 工具（原生支持图片） |
| 读取 MD/TXT 文件 | `Read` 工具 |
| 解析飞书消息 JSON 导出 | `Bash` → `python3 tools/feishu_parser.py` |
| 飞书全自动采集（推荐） | `Bash` → `python3 tools/feishu_auto_collector.py` |
| 飞书文档（浏览器登录态） | `Bash` → `python3 tools/feishu_browser.py` |
| 飞书文档（MCP App Token） | `Bash` → `python3 tools/feishu_mcp_client.py` |
| 钉钉全自动采集 | `Bash` → `python3 tools/dingtalk_auto_collector.py` |
| 解析邮件 .eml/.mbox | `Bash` → `python3 tools/email_parser.py` |
| 写入/更新 Skill 文件 | `Write` / `Edit` 工具 |
| 版本管理 | `Bash` → `python3 tools/version_manager.py` |
| 列出已有 Skill | `Bash` → `python3 tools/skill_writer.py --action list` |

基础目录：

| character | 目录 |
|---|---|
| `colleague` | `./skills/colleague/{slug}/` |
| `relationship` | `./skills/relationship/{slug}/` |
| `celebrity` | `./skills/celebrity/{slug}/` |

改为全局路径时，用 `--base-dir` 指向对应 character family 的根目录。

## 主流程：创建新 Skill

### Step 0：确认 character family

用户使用的是 `/PersonaEcho` 时，先确认本次要蒸馏的是哪一类：

1. `colleague`
2. `relationship`
3. `celebrity`

上层宿主已经显式把 family 传进来时，直接固定对应的 character family。

当前 family 是 `celebrity` 时，还必须确认 research profile：

1. `budget-friendly`
2. `budget-unfriendly`

默认使用 `budget-friendly`。只有当用户明确要求更深研究、更高置信度、或者愿意接受更慢更贵的蒸馏流程时，才切到 `budget-unfriendly`。

### Step 1：基础信息录入

按 character family 选择对应 intake prompt：

- `colleague` → `prompts/intake.md`
- `relationship` → `prompts/relationship/intake.md`
- `celebrity` → `prompts/celebrity/intake.md`

`colleague` 和 `relationship` 只问 3 个问题。
`celebrity` 按 `prompts/celebrity/intake.md` 问 4 个问题，其中第 4 个问题必须确认 `research_profile`。

默认的 3 个基础问题：

1. **花名/代号**（必填）
2. **基本信息**（一句话：公司、职级、职位、性别，想到什么写什么）
   - 示例：`字节 2-1 后端工程师 男`
3. **性格画像**（一句话：MBTI、星座、个性标签、企业文化、印象）
   - 示例：`INTJ 摩羯座 甩锅高手 字节范 CR很严格但从来不解释原因`

除姓名外均可跳过。收集完后汇总确认，再进入下一步。

### Step 2：原材料导入

询问用户提供原材料，按 `references/display-templates.md` 展示“原材料提供菜单”（A 飞书自动采集 / B 钉钉自动采集 / C 飞书链接 / D 上传文件 / E 直接粘贴，可混用或跳过）。

#### 方式 A：飞书自动采集（推荐）

首次使用需配置：
```bash
python3 tools/feishu_auto_collector.py --setup
```

**群聊采集**（使用 tenant_access_token，需 bot 在群内）：
```bash
python3 tools/feishu_auto_collector.py \
  --name "{name}" \
  --output-dir ./knowledge/{slug} \
  --msg-limit 1000 \
  --doc-limit 20
```

**私聊采集**（需要 user_access_token + 私聊 chat_id）：边缘场景，完整流程见 `references/feishu-private-collection.md`（前置条件 → OAuth 授权 → 换 token → 取 chat_id → 执行采集 → 核心 API → 常见失败）。要点：私聊只能用用户身份（user_access_token）访问；token 有效期 2 小时。

自动采集内容：

- 群聊：所有与他共同群聊中他发出的消息（过滤系统消息、表情包）
- 私聊：与他的私聊完整对话（含双方消息，用于理解对话语境）
- 他创建/编辑的飞书文档和 Wiki
- 相关多维表格（如有权限）

采集完成后用 `Read` 读取输出目录下的文件：

- `knowledge/{slug}/messages.txt` → 消息记录（群聊 + 私聊）
- `knowledge/{slug}/docs.txt` → 文档内容
- `knowledge/{slug}/collection_summary.json` → 采集摘要

采集失败时按报错判断原因并修复。常见失败：

- 群聊采集：bot 未添加到群聊
- 私聊采集：user_access_token 过期（有效期 2 小时，可用 refresh_token 刷新）
- 权限不足：引导用户在飞书开放平台开通对应权限并重新授权
- 或改用方式 B/C

#### 方式 B：钉钉自动采集

首次使用需配置：
```bash
python3 tools/dingtalk_auto_collector.py --setup
```

然后输入姓名，一键采集：
```bash
python3 tools/dingtalk_auto_collector.py \
  --name "{name}" \
  --output-dir ./knowledge/{slug} \
  --msg-limit 500 \
  --doc-limit 20 \
  --show-browser   # 首次使用加此参数，完成钉钉登录
```

采集内容：

- 他创建/编辑的钉钉文档和知识库
- 多维表格
- 消息记录（[WARN] 钉钉 API 不支持历史消息拉取，自动切换浏览器采集）

采集完成后 `Read` 读取：

- `knowledge/{slug}/docs.txt`
- `knowledge/{slug}/bitables.txt`
- `knowledge/{slug}/messages.txt`

消息采集失败时，提示用户截图聊天记录后上传。

#### 方式 C：飞书链接

用户提供飞书文档/Wiki 链接时，按 `references/display-templates.md` 展示“飞书链接读取方式菜单”（[1] 浏览器方案 或 [2] MCP 方案），让用户选择。

**选 1（浏览器方案）**：
```bash
python3 tools/feishu_browser.py \
  --url "{feishu_url}" \
  --target "{name}" \
  --output /tmp/feishu_doc_out.txt
```
首次使用若未登录，会弹出浏览器窗口要求登录（一次性）。

**选 2（MCP 方案）**：

首次使用需初始化配置：
```bash
python3 tools/feishu_mcp_client.py --setup
```

之后直接读取：
```bash
python3 tools/feishu_mcp_client.py \
  --url "{feishu_url}" \
  --output /tmp/feishu_doc_out.txt
```

读取消息记录（需要群聊 ID，格式 `oc_xxx`）：
```bash
python3 tools/feishu_mcp_client.py \
  --chat-id "oc_xxx" \
  --target "{name}" \
  --limit 500 \
  --output /tmp/feishu_msg_out.txt
```

两种方式输出后均用 `Read` 读取结果文件，进入分析流程。

#### 方式 D：上传文件

- **PDF / 图片**：`Read` 工具直接读取
- **飞书消息 JSON 导出**：
  ```bash
  python3 tools/feishu_parser.py --file {path} --target "{name}" --output /tmp/feishu_out.txt
  ```
  然后 `Read /tmp/feishu_out.txt`
- **邮件文件 .eml / .mbox**：
  ```bash
  python3 tools/email_parser.py --file {path} --target "{name}" --output /tmp/email_out.txt
  ```
  然后 `Read /tmp/email_out.txt`
- **Markdown / TXT**：`Read` 工具直接读取

#### 方式 E：直接粘贴

用户粘贴的内容直接作为文本原材料，无需调用任何工具。

用户说“没有文件”或“跳过”时，仅凭 Step 1 的手动信息生成 Skill。

### Step 3：分析原材料

先根据 character family 解析本次的执行矩阵：

| character | intake | persona analyzer | persona builder | merger | storage root |
|-----------|--------|------------------|-----------------|--------|--------------|
| `colleague` | `prompts/intake.md` | `prompts/persona_analyzer.md` | `prompts/persona_builder.md` | `prompts/merger.md` | `./skills/colleague/{slug}` |
| `relationship` | `prompts/relationship/intake.md` | `prompts/relationship/persona_analyzer.md` | `prompts/relationship/persona_builder.md` | `prompts/relationship/merger.md` | `./skills/relationship/{slug}` |
| `celebrity` | `prompts/celebrity/intake.md` | `prompts/celebrity/persona_analyzer.md` | `prompts/celebrity/persona_builder.md` | `prompts/celebrity/merger.md` | `./skills/celebrity/{slug}` |

所有 family 共用：

- Work analyzer：`prompts/work_analyzer.md`
- Work builder：`prompts/work_builder.md`
- Correction handler：`prompts/correction_handler.md`

family 为 `celebrity` 时，先执行 celebrity 研究子流程（见下方同名小节），再进入分析。分析按两条线进行：

**线路 A（Work Skill）**：

- 参考 `prompts/work_analyzer.md`
- 提取：负责系统、技术规范、工作流程、输出偏好、经验知识
- celebrity 场景下，`work` 更偏方法论、判断框架、决策习惯，不要机械套成“工作职责”

**线路 B（Persona）**：

- 使用当前 family 对应的 persona analyzer
- `celebrity` 且 `research_profile=budget-unfriendly` 时，改用 `prompts/celebrity/budget_unfriendly/persona_analyzer.md`
- 将用户填写的标签翻译为具体行为规则
- 从原材料中提取：表达风格、决策模式、人际行为
- celebrity 场景下，必须保留：
  - mental models
  - decision heuristics
  - expression DNA
  - contradictions
  - honest boundaries

### Step 4：生成并预览

使用 `prompts/work_builder.md` 生成 Work 内容。
使用当前 family 对应的 persona builder 生成 Persona 内容。

具体映射：

- `colleague` → `prompts/persona_builder.md`
- `relationship` → `prompts/relationship/persona_builder.md`
- `celebrity` → `prompts/celebrity/persona_builder.md`
- `celebrity` + `budget-unfriendly` → `prompts/celebrity/budget_unfriendly/persona_builder.md`

向用户展示摘要（各 5-8 行，模板见 `references/display-templates.md`），询问“确认生成？还是需要调整？”

### Step 5：写入文件

用户确认后，不要手工拼接 `skills/colleague/{slug}` 这类文件树。统一走 writer：

1. 先解析当前 storage root：
   - `colleague` → `./skills/colleague`
   - `relationship` → `./skills/relationship`
   - `celebrity` → `./skills/celebrity`
2. 用 `Write` 工具写三个临时文件：
   - `/tmp/PersonaEcho_{slug}_meta.json`
   - `/tmp/PersonaEcho_{slug}_work.md`
   - `/tmp/PersonaEcho_{slug}_persona.md`
3. `meta.json` 至少包含：
   - `name`
   - `display_name`
   - `character`
   - `research_profile`（当 character=`celebrity` 时必填）
   - `classification.language`（必须设置为用户当前语言，例如 `zh-CN` 或 `en`）
   - `profile`
   - `tags`
   - `knowledge_sources`
4. 然后调用：
   ```bash
   python3 tools/skill_writer.py \
     --action create \
     --character {character} \
     --research-profile {research_profile} \
     --slug {slug} \
     --name "{name}" \
     --meta /tmp/PersonaEcho_{slug}_meta.json \
     --work /tmp/PersonaEcho_{slug}_work.md \
     --persona /tmp/PersonaEcho_{slug}_persona.md \
     --base-dir {resolved_base_dir}
   ```
5. 该命令统一生成：
   - `SKILL.md`
   - `work.md`
   - `persona.md`
   - `work_skill.md`
   - `persona_skill.md`
   - `manifest.json`
   - `meta.json`
   - 如需把生成后的角色 Skill 安装到宿主：
     - Claude Code：追加 `--install-claude-skill`
     - OpenClaw：追加 `--install-openclaw-skill`
     - Codex：追加 `--install-codex-skill`
     - Claude Code on Windows：可再追加 `--install-claude-command-shim`
6. family 为 `celebrity` 时，创建完成后必须再跑一次质量检查：
   ```bash
   python3 tools/research/quality_check.py "{resolved_base_dir}/{slug}/SKILL.md" --profile {research_profile}
   ```
7. `celebrity` 的质量检查仍然提示 `source_grounding` 失败时：
   - 补写诚实的来源说明和局限说明
   - 补充 URL 的前提是拿到真实、具体、可追溯的外部来源
   - **不要**用站点首页、topic 页、搜索页、个人空间首页等泛化链接来“刷过”检查
   - 没有真实来源时保留 FAIL，并向用户说明后续需要补哪些材料

告知用户时，文件位置必须按当前 family 返回，不要默认写成 colleague。

## celebrity 研究子流程

family 为 `celebrity` 时，在 Step 3 分析之前执行本小节；按 Step 0 已确认的 research profile 走对应流程。

### celebrity / budget-friendly

1. 读取 `prompts/celebrity/research.md`，按其中的 **6 维度并行采集策略** 做 research planning
2. 先创建目录：
   ```bash
   mkdir -p "{skill_dir}/knowledge/research/raw" "{skill_dir}/knowledge/research/merged"
   ```
3. 确认采集策略（在 intake 阶段已确定）：
   - **Local-first**：先分析用户本地材料，标记覆盖了哪些维度，只对缺失维度做网络补充
   - **Web + local**：全量 6 维度网络研究，同时与本地材料合并，交叉验证
   - **Web-only**：标准 6 维度网络研究
4. 用户明确提供了可处理的视频链接或字幕来源，而且处理结果不会作为长文本落盘时：
   ```bash
   bash tools/research/download_subtitles.sh "{url}" "{skill_dir}/knowledge/subtitles"
   python3 tools/research/srt_to_transcript.py "{subtitle_file}" "{skill_dir}/knowledge/transcripts/{name}.txt"
   ```
5. 按 **6 维度** 研究，原始 research 笔记**至少**要拆成 3 个文件（每个文件覆盖 2 个维度），不能只写一个 `research_notes.md`：
   - `knowledge/research/raw/01_core_profile.md`（维度 1 著作 + 维度 6 时间线）
   - `knowledge/research/raw/02_conversations_and_material.md`（维度 2 对话 + 维度 4 决策）
   - `knowledge/research/raw/03_expression_and_reception.md`（维度 3 表达 DNA + 维度 5 他者视角）
6. 研究过程必须遵守 **品味原则**（详见 research prompt）：
   - 长文 > 金句，争议 > 共识，变化 > 固定，一手 > 二手
   - 遵守 **信源黑名单**：永不引用知乎、微信公众号、百度百科、内容农场
   - 遵守 **信源优先级**：用户本地材料 > 一手著作 > 长访谈 > 决策记录 > 社交媒体 > 外部分析 > 二手转述
7. 合并 research：
   ```bash
   python3 tools/research/merge_research.py "{skill_dir}"
   ```
   输出：`knowledge/research/merged/summary.md`
8. 读取 `knowledge/research/merged/summary.md`，确认：
   - `Files scanned >= 3`
   - `Unique URLs >= 2`
   - `Potential long quote lines = 0`
   - research notes 里的 URL 必须是**实际打开过的具体页面**，不是平台首页、搜索页、话题页或占位路径

   不满足时继续补 research notes，直到满足或明确记录搜集受限原因。
9. **质量关卡（Phase 1.5）**：在进入分析之前，必须向用户展示结构化采集摘要（6 维度表格见 `references/display-templates.md`），等待用户确认后再继续。用户指出问题或需要某个维度更深入时，先补充研究。
10. **冷门人物检测**：总来源 < 10 条时，按冷门人物协议处理：
    - 心智模型限制为 2–3 个
    - 薄弱模型标注“基于有限信息”
    - 扩大诚实边界章节
    - 告知用户补充哪些材料可改善质量
11. celebrity 的后续分析输入必须优先使用：
    - 一手材料（信源权重 1-3）
    - merged research summary
    - 用户提供的补充描述

### celebrity / budget-unfriendly

1. 先读取：
   - `prompts/celebrity/budget_unfriendly/research.md`
   - `references/celebrity_budget_unfriendly_framework.md`
2. 先创建目录：
   ```bash
   mkdir -p "{skill_dir}/knowledge/research/raw" "{skill_dir}/knowledge/research/merged" "{skill_dir}/knowledge/research/reviews"
   ```
3. 确认采集策略（在 intake 阶段已确定）：local-first / web+local / web-only
4. 按 **6-track 独立文件结构** 写 research notes（不可合并，不可克隆观察）：
   - `knowledge/research/raw/01_writings.md`（维度 1：著作与系统思考）
   - `knowledge/research/raw/02_conversations.md`（维度 2：即兴对话与压力应对）
   - `knowledge/research/raw/03_expression_dna.md`（维度 3：语言指纹）
   - `knowledge/research/raw/04_decisions.md`（维度 4：行为与选择）
   - `knowledge/research/raw/05_external_views.md`（维度 5：他者视角与批评）
   - `knowledge/research/raw/06_timeline.md`（维度 6：认知轨迹）
5. 研究过程必须遵守 **品味原则 + 信源黑名单 + 信源优先级**（见 research prompt），每条 evidence 必须标注 source weight (1-7)。
6. 合并 research：
   ```bash
   python3 tools/research/merge_research.py "{skill_dir}"
   ```
7. 读取 `knowledge/research/merged/summary.md`，确认最低门槛：
   - `Files scanned >= 6`
   - `Unique URLs >= 8`
   - `Primary-source markers >= 3`
   - `Source metadata blocks >= 6`
   - `Contradiction bullets >= 6`
   - `Inference bullets >= 6`
   - `Potential long quote lines = 0`
   - `Track coverage count = 6`
   - research notes 里的 URL 必须是**实际打开过的具体页面**，不是平台首页、搜索页、话题页或占位路径

   不满足时继续补对应 track，而不是直接进入后续 review。
8. **质量关卡（Phase 1.5）**：在进入 audit 之前，向用户展示结构化采集摘要（含 primary 比例、矛盾数、候选 mental models、known-answer 候选、薄弱维度、冷门人物判定）。等待用户确认后再继续。
9. 再读取：
   - `prompts/celebrity/budget_unfriendly/audit.md`
   - `prompts/celebrity/budget_unfriendly/synthesis.md`
   - `references/celebrity_budget_unfriendly_template.md`
10. 先生成 `knowledge/research/reviews/research_audit.md`
    - 审计必须明确给出 `PASS / FAIL`
    - audit 必须检查：信源层级合规（无黑名单）、primary 比例 > 50%、品味原则遵守、冷门人物评估
    - audit 是 `FAIL` 时，按 audit 给出的 Backfill Tasks 补齐，不要跳到 synthesis
11. **提炼关卡（Phase 2.5）**：audit 通过后，向用户展示候选 mental models 摘要（含三重门判定、evidence anchors、failure modes）。确认合理性后再进入 synthesis。
12. 再生成 `knowledge/research/reviews/synthesis.md`
    - 必须对候选 mental models 做 triple-gate 判断：
      - cross-context recurrence
      - generative power
      - exclusivity
    - 同时提取智识谱系种子（influenced by / diverged from）和 Agentic Protocol 种子（该人物会如何分析新问题的维度列表）
13. 再按 `prompts/celebrity/budget_unfriendly/validation.md` 生成：
    - `knowledge/research/reviews/validation.md`
    - validation 必须明确给出 `PASS / FAIL`
    - 必须做 known-answer check（至少 2 题）+ edge-case check（1 题）+ voice check（100 字盲测）+ copyright check + Agentic Protocol check
    - validation 是 `FAIL` 时，必须先修 draft 再继续
14. budget-unfriendly 的后续分析输入必须优先使用：
    - 6-track raw notes
    - merged research summary
    - research audit
    - synthesis review（含智识谱系种子、Agentic Protocol 种子）
    - validation review
    - 用户补充材料

### 两种 celebrity profile 的共同约束

- 外部搜集失败或被平台验证拦截时：
  - 明确告诉用户搜集受限的原因
  - 保留已有 research 原始材料和 merged summary
  - 继续生成，但把 `source_grounding` 视为未完成
  - **不要**为了通过质量检查而编造 URL、引用、书名、视频标题，或塞入泛化主页链接
- **不要**把完整 transcript、完整字幕、长段原文抄进仓库
- 只允许保留结构化摘要、来源元信息和极短引用，避免版权风险

## 进化模式：追加文件

用户提供新文件或文本时：

1. 按 Step 2 的方式读取新内容
2. 根据当前 family 解析 base dir
3. 用 `Read` 读取现有 `{resolved_base_dir}/{slug}/work.md` 和 `persona.md`
4. 使用当前 family 对应的 merger prompt 分析增量内容
5. 存档当前版本（用 Bash）：
   ```bash
   python3 tools/version_manager.py \
     --action backup \
     --character {character} \
     --slug {slug} \
     --base-dir {resolved_base_dir}
   ```
6. 把 work/persona 增量分别写到临时 patch 文件
7. 调用：
   ```bash
   python3 tools/skill_writer.py \
     --action update \
     --character {character} \
     --slug {slug} \
     --work-patch /tmp/PersonaEcho_{slug}_work_patch.md \
     --persona-patch /tmp/PersonaEcho_{slug}_persona_patch.md \
     --base-dir {resolved_base_dir}
   ```
8. family 为 `celebrity` 时，更新后再次执行 quality check

## 进化模式：对话纠正

用户表达“不对”/“应该是”时：

1. 参考 `prompts/correction_handler.md` 识别纠正内容
2. 判断属于 Work（技术/流程）还是 Persona（性格/沟通）
3. 属于 Work 时：
   - 生成 `/tmp/PersonaEcho_{slug}_work_patch.md`
   - patch 必须是可替换的 `##` section，不要直接手改最终文件
   - 调用：
     ```bash
     python3 tools/skill_writer.py \
       --action update \
       --character {character} \
       --slug {slug} \
       --work-patch /tmp/PersonaEcho_{slug}_work_patch.md \
       --base-dir {resolved_base_dir}
     ```
4. 属于 Persona 时：
   - 将 correction 写入 `/tmp/PersonaEcho_{slug}_correction.json`
   - 单条纠正可直接写成 `{scene, wrong, correct}`
   - 多条 persona 纠正可写成 `{"persona_corrections": [{...}, {...}]}`
   - 调用：
     ```bash
     python3 tools/skill_writer.py \
       --action update \
       --character {character} \
       --slug {slug} \
       --correction-json /tmp/PersonaEcho_{slug}_correction.json \
       --base-dir {resolved_base_dir}
     ```
5. family 为 `celebrity` 时，更新后再次执行 quality check
6. 不要直接手改 `work.md`、`persona.md`、`SKILL.md`、`meta.json`；统一通过 writer 更新

## 管理操作

列出三类 Skill：
```bash
python3 tools/skill_writer.py --action list --character colleague --base-dir ./skills/colleague
python3 tools/skill_writer.py --action list --character relationship --base-dir ./skills/relationship
python3 tools/skill_writer.py --action list --character celebrity --base-dir ./skills/celebrity
```

回滚某个 Skill 版本：
```bash
# colleague
python3 tools/version_manager.py --action rollback --character colleague --slug {slug} --version {version} --base-dir ./skills/colleague
# relationship
python3 tools/version_manager.py --action rollback --character relationship --slug {slug} --version {version} --base-dir ./skills/relationship
# celebrity
python3 tools/version_manager.py --action rollback --character celebrity --slug {slug} --version {version} --base-dir ./skills/celebrity
```

删除某个 Skill，确认 character 后执行：
```bash
# colleague
rm -rf skills/colleague/{slug}
# relationship
rm -rf skills/relationship/{slug}
# celebrity
rm -rf skills/celebrity/{slug}
```
