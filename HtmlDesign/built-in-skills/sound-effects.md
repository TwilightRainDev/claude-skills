---
name: "sound-effects"
description: "Sound effects\nAI-generated audio via ElevenLabs"
---
> **[Claude Code 下不可用]** 本宿主**没有** `generate_sound` 工具 —— 它依赖 claude.ai 托管的 ElevenLabs 后端，本机没有该后端，也**没有本地替代**。用户要音效时如实说明，不要假装调用。见 [`../references/claude.md`](../references/claude.md) → "Web tools with no drop-in equivalent"。

You have access to the generate_sound tool which generates sound effects using ElevenLabs. Use it when the user asks you to create sound effects, audio clips, ambient sounds, UI sounds, or any audio asset. The tool writes small MP3 files to the project's scraps/ folder. Use descriptive prompts — the more specific, the better (e.g. "soft UI click with subtle reverb", "thunderstorm with distant rumbling"). You can optionally set duration_seconds (0.5–22s) and prompt_influence (0–1, default 0.3).
