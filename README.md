# claude-skills

TwilightRainDev 的 Claude Code 技能（skill）聚合仓库。

## 技能列表

| 技能 | 说明 |
|------|------|
| [EncodingGuide](EncodingGuide/SKILL.md) | Windows PowerShell 中文编码安全基线：乱码、中文路径、JSON/TOML、heredoc、管道、python -c、Out-File 必查 |

## 安装

将对应技能目录（如 `EncodingGuide`）复制到 `~/.claude/skills/` 下即可被 Claude Code 识别：

```bash
cp -r EncodingGuide ~/.claude/skills/
```

## 许可证

各技能目录内 SKILL.md 的 frontmatter 标注各自的许可证（默认 MIT）。
