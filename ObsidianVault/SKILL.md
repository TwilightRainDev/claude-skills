---
name: ObsidianVault
description: 在 Obsidian 仓库搜索、创建、管理笔记，支持 wikilink 与索引笔记。
---

# Obsidian 仓库

## 仓库位置

`A:/Obsidian Vault`

仓库根为 `A:\Obsidian Vault`（Windows 路径）。目录结构按类型分三层：

- **`Indexes\`** —— 索引笔记层
  - 顶层索引直接放 `Indexes\`（如 `学科学习 Index.md`、`编程学习 Index.md`）
  - 子索引放 `Indexes\<父索引名>子Index\`（如 `Indexes\学科学习子Index\物理 Index.md`）
- **`Notes\`** —— 实际学习笔记（平铺，不建文件夹）
- **`Resources\`** —— 附件（图片等）

## 命名约定

- **索引笔记**：聚合相关主题，统一存放于 `Indexes\` 目录（例如 `学科学习 Index.md`、`编程学习 Index.md`、`Ralph Wiggum Index.md`）
- **子索引分层**：当某分类下笔记增多时，建立子索引挂到上级分类索引下（如 `物理 Index.md` 挂在 `学科学习 Index` 下），分类索引只挂子索引；实际笔记链到最近的子索引。新增学科（语文、化学等）同理建各自子索引，子索引文件放 `Indexes\<父索引名>子Index\`
- 所有笔记名称使用**标题大小写（Title Case）**
- 不使用文件夹组织实际笔记 —— 通过链接和索引笔记来组织
- wikilink 按文件名解析，移动文件位置不影响已有链接

## 链接

- 使用 Obsidian `[[wikilinks]]` 语法：`[[笔记标题]]`
- 笔记在底部链接到依赖项/相关笔记
- 索引笔记只是 `[[wikilinks]]` 的列表

## 工作流

### 搜索笔记

```bash
# 按文件名搜索
find "A:/Obsidian Vault" -name "*.md" | grep -i "关键词"

# 按内容搜索
grep -rl "关键词" "A:/Obsidian Vault" --include="*.md"
```

或者直接在仓库路径上使用 Grep/Glob 工具。

### 创建新笔记

1. 文件名使用**标题大小写（Title Case）**
2. 将内容作为一个学习单元来撰写（遵循仓库规则）
3. 在底部添加指向相关笔记的 `[[wikilinks]]`
4. 如果属于编号序列，使用层级编号方案
5. 实际笔记保存到 `Notes\`；索引笔记保存到 `Indexes\`（子索引放 `Indexes\<父索引名>子Index\`）；附件放 `Resources\`

### 查找相关笔记

搜索 `[[笔记标题]]` 以在仓库中查找反向链接：

```bash
grep -rl "\\[\\[笔记标题\\]\\]" "A:/Obsidian Vault"
```

### 查找索引笔记

```bash
find "A:/Obsidian Vault" -name "*Index*"
```
