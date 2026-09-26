# claude-skills

TwilightRainDev 的 Claude Code 技能（skill）聚合仓库，同时作为本地 `~/.claude/skills/` 的备份镜像。

## 技能列表

| 技能 | 说明 |
|------|------|
| [Ask](Ask/SKILL.md) | 任何会话与任务开始前先检查是否有适用技能，再行动。当不确定当前任务该用哪个已装技能、用户请求横跨多个领域、任务类型模糊、或用户提到“该用什么技能/流程/skill”时使用。判定出目标技能后必须直接用 Skill 工具加载执行，不要建议用户手动输入斜杠命令。 |
| [ChangeClaudeConfig](ChangeClaudeConfig/SKILL.md) | 修改 Claude Code 配置：settings.json（钩子/权限/env/MCP/插件/模型）、keybindings、白名单优化。 |
| [CreatePrompts](CreatePrompts/SKILL.md) | 为任何 AI 模型创建/编写/改进提示词：刨根问底（苏格拉底式澄清）→ 生成。 |
| [Debugging](Debugging/SKILL.md) | 任何 bug、测试失败、性能回归、构建/集成问题，先分诊找根因，再动手修。 |
| [EditorialCharts](EditorialCharts/SKILL.md) | 一套模板驱动的数据可视化 skill，严格从 Lupi、Basics、Glance 与 Interactive gallery 的真实实现生成 HTML 图表；以 Mono 为保底，能按数据语义自动选择内置彩色预设，也支持用户明确提供的自定义色板，同一交付禁止混用色系。 |
| [EncodingGuide](EncodingGuide/SKILL.md) | Windows PowerShell 中文安全基线，按“AI 最容易凭直觉做出的危险操作”索引，给出诊断思路和修正方向，不展开最优实践，只告诉你怎么查、往哪改。 |
| [EnvRouter](EnvRouter/SKILL.md) | Windows 环境事实快查表与路由。遇到环境敏感任务或症状时使用。先查表取证（1 秒），再按事实路由到对应技能执行。 |
| [ExecutingPlans](ExecutingPlans/SKILL.md) | 有书面实施计划时：独立会话逐步执行 + 评审检查点。 |
| [FinDevBranch](FinDevBranch/SKILL.md) | 实现完成、测试全过、合并前收尾分支时使用。 |
| [GitHubOps](GitHubOps/SKILL.md) | 当在本机做 GitHub 平台操作（建仓/推送/发布/PR/Release）或 GitHub 通路报错（连接被拒/证书/502）时使用。 |
| [GitMaster](GitMaster/SKILL.md) | 完整的 Git 专家知识体系，覆盖所有 Git 操作。 |
| [GlossaryAndAdr](GlossaryAndAdr/SKILL.md) | 构建并完善领域模型：确定领域术语、记录架构决策。 |
| [HandleReview](HandleReview/SKILL.md) | 收到审查反馈后、实施前：技术严谨验证，拒绝表演性赞同或盲目实施。 |
| [HtmlDesign](HtmlDesign/SKILL.md) | 制作 Apple 风格的 HTML 制品：官网/营销页（apple.com 视觉）、仿 iOS/macOS 应用界面（HIG）双模，含原型、幻灯片、设计系统与打印/PDF 交付。 |
| [HumanizerZh](HumanizerZh/SKILL.md) | 中文文本去 AI 味、改写得像人写，或做标点全半角归一化时使用。 |
| [LongTaskPlaybook](LongTaskPlaybook/SKILL.md) | 处理 CLI/远程 API 长耗时任务，长任务不阻塞回合，先 ACK 再跟进。 |
| [ManageSkills](ManageSkills/SKILL.md) | 当要创建技能、改进或评测现有技能、给技能改名、部署技能或部署前验证技能时使用。 |
| [ObsidianVault](ObsidianVault/SKILL.md) | 在 Obsidian 仓库搜索、创建、管理笔记，支持 wikilink 与索引笔记。 |
| [PersonaEcho](PersonaEcho/SKILL.md) | 把 colleague/relationship/celebrity 三类角色蒸馏成可复用技能。 |
| [PolishCode](PolishCode/SKILL.md) | 提交前润色代码：复用、简化、效率、抽象层次，并行评审代理并应用修复。 |
| [ProbeIntent](ProbeIntent/SKILL.md) | 动手构建前需求还含糊时使用：要加新功能、做新项目或新子系统，或需要头脑风暴、方案选型、把想法盘成设计共识时。 |
| [ProjectExplore](ProjectExplore/SKILL.md) | 当接手或初步了解一个项目、不清楚项目是什么、怎么组织、怎么运行，需要快速建立项目心智模型时使用。 |
| [ReviewPr](ReviewPr/SKILL.md) | 合并前评审 PR/diff 正确性缺陷：并行评审代理 + 置信度评分，可 --fix。 |
| [ReviewRouter](ReviewRouter/SKILL.md) | 完成任务、实现主要功能或合入前，请 reviewer 验证是否符合需求。 |
| [ReviewStandards](ReviewStandards/SKILL.md) | 双轴评审：标准轴（编码规范）+ 规范轴（需求/PRD 符合度），并行子代理。 |
| [SecurityAudit](SecurityAudit/SKILL.md) | 安全漏洞审计（OWASP 类）；安装第三方技能前审查 SKILL.md 恶意指令、提示词注入。 |
| [SkillstoreFetch](SkillstoreFetch/SKILL.md) | 发现并安装第三方技能（“有没有能做 X 的技能”时使用）。 |
| [SubagentDrivenDev](SubagentDrivenDev/SKILL.md) | 执行实施计划时把独立任务拆给多个子代理，任务后评审 + 最终全分支评审。 |
| [TDD](TDD/SKILL.md) | 实现功能或修 bug 前先写测试；先看失败，再写最少代码。 |
| [ThinkFirst](ThinkFirst/SKILL.md) | 当任务变难、变长、变绕，你需要先想清楚再动手，或思路卡住、越做越乱时使用。一份极简思维引导：一个前提、三档投入、几条内部检查。可一眼检查或已有明确方法覆盖的任务不使用。 |
| [VerifyFirst](VerifyFirst/SKILL.md) | 声称完成/修复/通过前先运行验证命令：先证据，后断言。 |
| [WinBashTest](WinBashTest/SKILL.md) | Win和 Git Bash 环境下的 Vitest、Playwright 及 MSW 测试兼容性指南。 |
| [WriteIssue](WriteIssue/SKILL.md) | 当用户要写 issue、report，或要向社区反馈报错问题时使用。不产出聊天式回答。 |
| [WritePlan](WritePlan/SKILL.md) | 把需求/重构/规格转化为可执行实施计划（细粒度任务、小提交），可生成 PRD。 |

## 安装

将对应技能目录（如 `EncodingGuide`）复制到 `~/.claude/skills/` 下即可被 Claude Code 识别：

```bash
cp -r EncodingGuide ~/.claude/skills/
```

## 备份说明

本仓库是 `~/.claude/skills/` 的镜像，由本机同步脚本生成，用于异地备份与恢复：

- 每个技能目录下的 `SKILL.md` 是该技能的入口，其余为它引用的资源文件
- 目录名保留原始大小写；`GlossaryAndAdr` 的目录名与其 frontmatter 的 `name: GlossaryAndADR` 大小写不同，属原始状态
- **公开副本经过脱敏**：涉及账号标识、凭据路径、本机代理与提权姿态、机器绝对路径的内容，以 `<占位符>` 形式给出，仅作格式示例，不是本机实值；本地原件保留真值
- 含个人隐私的人物人设、以及 Python 缓存（`__pycache__` / `*.pyc`）不纳入备份
- 所有文本以 LF 行尾入库，由 `.gitattributes` 保证

## 许可证

各技能目录内 `SKILL.md` 的 frontmatter 标注各自的许可证（默认 MIT）。`PersonaEcho` 为第三方项目（MIT，见其 [LICENSE](PersonaEcho/LICENSE) 与 [CITATION.cff](PersonaEcho/CITATION.cff)），归属与引用要求随目录保留。
