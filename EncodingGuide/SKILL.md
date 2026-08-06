---
name: EncodingGuide
version: 1.1.0
author: TwilightRain
author_url: https://github.com/TwilightRainDev
license: MIT
description: Windows PowerShell 中文编码安全基线：乱码、中文路径、JSON/TOML、heredoc、管道、python -c、Out-File 必查。
---

# Windows PowerShell 编码避坑指南

## 核心原则（铁律）

**绝对不要把含中文路径或复杂代码的内容通过管道传给 `python -c` 或通过 heredoc 传递。**

PowerShell 的管道和 heredoc 会在文本传递中自行解析 Unicode、转义符和特殊符号，导致中文变 `??`、脚本崩溃、JSON 乱码。所有问题的根源皆在于此。

```powershell
# [错误] 错误 - 必定损坏
@"I:\code\项目\config.json"@ | python -c "..."

# [正确] 正确 - 先写入临时 .py 文件，再执行
```

## 一、编写 PowerShell 脚本时的行为准则

当你在 Windows 上编写调用 Python 处理中文内容的 PowerShell 脚本时，遵守以下规则：

### 规则 1：永远不要用管道传中文内容给 python -c

`python -c` 经过 PowerShell 解析后，中文、特殊符号、转义符都会损坏。任何需要传递给 Python 的代码，都写入临时 `.py` 文件。

### 规则 2：写临时文件用 Out-File + -LiteralPath + UTF8

```powershell
$script | Out-File -LiteralPath $env:TEMP\tool.py -Encoding UTF8
python $env:TEMP\tool.py
Remove-Item $env:TEMP\tool.py
```

关键点：
- `-LiteralPath`（而非 `-Path`）：禁用通配符展开，防止 `[]` 等字符被误解析
- `-Encoding UTF8`：确保输出 UTF-8，但注意这会带 BOM（对 Python 无影响，但对 TOML 致命）

### 规则 3：写 TOML 文件时剥离 BOM

`Out-File -Encoding UTF8` 会在文件头写入 `EF BB BF`（BOM），TOML 解析器会直接报 `Invalid statement (at line 1, column 1)`。

```powershell
# [错误] 错误 - 会带 BOM
$content | Out-File pyproject.toml -Encoding UTF8

# [正确] 正确 - 无 BOM
[System.IO.File]::WriteAllText("pyproject.toml", $content, [System.Text.UTF8Encoding]::new($false))
```

## 二、中文路径传参的三种方案

按优先级从高到低：

### 方案 A — 先查路径再硬编码（最稳定）

```powershell
$dir = (Get-ChildItem I:\code -Directory | Where-Object Name -match "项目").FullName
# 然后在 Python 脚本中直接使用 r"$dir"（会被 PowerShell 插值为实际路径）
```

### 方案 B — Out-File 中转（最推荐，适用任何场景）

```powershell
@"
import json, os
BASE = r"$dir"
# ... 你的 Python 代码 ...
"@ | Out-File -LiteralPath $env:TEMP\tool.py -Encoding UTF8
python $env:TEMP\tool.py
Remove-Item $env:TEMP\tool.py
```

### 方案 C — Base64 编码（终极兜底）

当内容包含 heredoc 闭合标记 `@`、反引号 `` ` ``、管道符 `|` 等特殊字符导致方案 B 也失败时使用：

```powershell
$b64 = "IyEvdXNyL2Jpbi9lbnYgcHl0aG9u...（Base64 编码的脚本内容）"
[System.IO.File]::WriteAllBytes($env:TEMP\tool.py, [System.Convert]::FromBase64String($b64))
python $env:TEMP\tool.py
```

`WriteAllBytes` 不经任何文本编码层，写什么得什么，零特殊字符风险。

## 三、JSON 文件的关键配置（三项必须同时设置）

修改或生成 JSON 文件时，必须同时设置三个参数，缺一不可：

```python
import json

# 读取
with open(path, "r", encoding="utf-8") as f:
    data = json.load(f)

# 修改
data["key"] = "新值"

# 写入 — 三个关键点缺一不可
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write("\n")   # 末尾换行，git diff 友好
```

| 参数 | 作用 | 忘记的后果 |
|------|------|-----------|
| `ensure_ascii=False` | 直接输出中文字符 | 整个文件变成 `\uXXXX` 地狱 |
| `indent=2` | 格式化缩进 | 单行不可读 blob，无法 diff |
| `encoding="utf-8"` | 明确 UTF-8 编码 | 系统默认编码可能乱码 |

## 四、PowerShell 特殊字符避坑速查

| 场景 | 错误 | 正确 |
|------|--------|--------|
| 正则中的 `.` | `-replace ".", "X"` | `-replace "\.", "X"` |
| 正则中的 `()` | `-replace "(abc)", ""` | `-replace "\(abc\)", ""` |
| 路径含 `[]` | `-Path "file[1].txt"` | `-LiteralPath "file[1].txt"` |
| 字符串中的双引号 | `"He said "hi""` | `` "He said`"hi`"" `` |
| heredoc 内含管道符 | `@ 内容含 \| @` | 改用 Base64 或临时文件 |

**遇到复杂替换操作，直接调用 Python 的 `str.replace()` 或 `re.sub()`**，避免与 .NET 正则的差异纠缠。

## 五、七大致命陷阱及解决方案

### 陷阱 1：heredoc 内嵌套闭合标记

内容中恰好包含 `@` 序列时，外层 heredoc 会提前闭合。

```powershell
# [错误] 炸裂 - 内部的 @ 被误认为是闭合标记
@"
python -c @
print(42)
@
"@
```

**解决**：放弃 heredoc，改用 `Out-File` 或 Base64。

### 陷阱 2：PowerShell 变量插值污染 python -c

```powershell
# [错误] PowerShell 把 $x 展开为空 → Python 收到 " = 1; print()"
python -c "$x = 1; print($x)"
```

**解决**：不用 `python -c` 写复杂逻辑，改用临时 `.py` 文件。

### 陷阱 3：括号被 PowerShell 解析器吃掉

```powershell
# [错误] 括号可能被识别为命令调用语法
python -c "base64.b64decode('...')"
```

**根因**：PowerShell 在传给外部程序前会扫描命令行语法，括号、花括号、方括号都可能触发意外解析。

**解决**：改用临时 `.py` 文件。

### 陷阱 4：Unicode 特殊字符经管道损坏

报错：`SyntaxError: invalid character (U+2014)`

**解决**：所有通过 PowerShell 传递给 Python 的源码中，注释和文档字符串只用 ASCII 标点（不要用 em dash `—`、弯引号等）。

### 陷阱 5：Out-File 的 BOM 破坏 TOML

`Out-File -Encoding UTF8` 默认带 BOM，`pip wheel` 会报 `Invalid statement (at line 1, column 1)`。

**解决**：用 `[System.IO.File]::WriteAllText` 配合 `UTF8Encoding($false)` 写出无 BOM 文件。

### 陷阱 6：非 ASCII 字符经 PowerShell 字节级损坏

在 GBK 终端下，`Get-Content` / `Set-Content` 可能静默将 Unicode 字符转换为 GBK 乱码字节，导致后续字符串匹配失败。

**解决**：在 GBK 终端下编辑 Python 文件时，只用纯 ASCII 字符做字符串匹配和替换。如果必须处理 Unicode，交给 Python 脚本而非 PowerShell。

### 陷阱 7：行号编辑 Python 文件的级联损坏

```powershell
# [错误] 删除一行后，后续 if 语句的缩进可能断掉
$lines = $lines[0..28] + $lines[30..$count]
```

**解决**：对 Python 文件做结构性改动时，用 regex 匹配代码块整体替换（`re.sub`），不要逐行操作。缩进是语法，不是装饰。

## 六、完整工作流模板

生成任何涉及中文路径的 PowerShell+Python 脚本时，使用此模板：

```powershell
# 1. 安全获取中文路径
$dir = (Get-ChildItem I:\code -Directory | Where-Object Name -match "项目").FullName

# 2. 生成 Python 脚本到临时文件（不经过管道，关键！）
$script = @"
import json, os
BASE = os.path.join(r"$dir", "subdir")
for f in ["en_US.json", "zh_CN.json"]:
    p = os.path.join(BASE, f)
    with open(p, "r", encoding="utf-8") as fh:
        d = json.load(fh)
    d["version_info"] = d["version_info"].replace(" (build {build})", "")
    with open(p, "w", encoding="utf-8") as fh:
        json.dump(d, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
print("Done")
"@

# 3. 写入并执行（关键：-LiteralPath 和 UTF8）
$script | Out-File -LiteralPath $env:TEMP\tool.py -Encoding UTF8
python $env:TEMP\tool.py

# 4. 清理
Remove-Item $env:TEMP\tool.py
```

## 七、快速检查清单

当你或用户编写 PowerShell 脚本时，逐项检查以下各点。发现任一问题，立即采用对应的解决方案：

1. **中文路径是否经过了管道或 heredoc？** → 改写成临时文件方案（方案 B）
2. **JSON 读写是否设置了 `ensure_ascii=False` + `encoding="utf-8"` + `indent=2`？**
3. **文件路径参数是否用了 `-LiteralPath` 而非 `-Path`？**
4. **`python -c` 里是否包含变量、括号或特殊符号？** → 改用临时 `.py` 文件
5. **生成的 Python 源码中是否使用了非 ASCII 标点（em dash 等）？** → 改用纯 ASCII
6. **如果所有方式都失败，是否准备了 Base64 兜底？**（方案 C）
7. **写 TOML 时，是否用了 `WriteAllText` + `UTF8Encoding($false)` 去 BOM？**
8. **对 Python 文件做了逐行删除/替换操作？** → 改用 `re.sub` 整体替换代码块
9. **检查 YAML/JSON 元数据时，只看了键所在行？** → 块标量正文在后续缩进行，用 Read 工具或完整解析验证

## 八、检查文件内容与元数据时的误判陷阱（实战案例）

本节教训来自一次真实误判：检查技能 SKILL.md 的 description 字段时，两种直觉做法都产生了"描述缺失"的假象，而文件本身完好。这与本技能的主题同构——**直觉方法在 Windows 环境下的输出不可轻信，下结论前先怀疑读取方法本身**。

### 用 head/grep 检查 YAML 块标量字段

```bash
# [错误] 误判 - head 截断：description 正文在 | 之后的缩进行中，被截掉了
head -6 SKILL.md | grep description
# 输出：description: |    ← 看起来像空值，其实是多行块标量指示符

# [错误] 误判 - 简单正则把 | 本身当成字段值
# 输出：EMPTY description（实际有 116 字正文）
```

**根因**：YAML 的 `|`、`>`（及 `|-`、`>-`、`|+`、`>+` 变体）是多行块标量指示符，正文在**后续缩进行**中。任何只看"键所在行"的做法都会得到看似为空的假象。

**解决**：
1. 人工判断用 Read 工具读完整文件——不经 shell 解析，最可靠
2. 脚本化检查时，识别到块标量指示符后收集**所有后续缩进行**作为正文；判空标准是"块标量后无缩进行"，而非"指示符本身为空"
3. Windows 控制台输出中文需 `PYTHONIOENCODING=utf-8`，否则结果本身也会乱码，进一步干扰判断

### 把读取方法的缺陷误判为文件缺陷

任何"内容缺失 / 损坏 / 为空"的结论，先自问：**是文件的问题，还是读取方法的问题？**

**解决**：用至少两种独立方式交叉验证（Read 工具 vs shell 命令 vs 解析脚本），得出相同结论才可断言。默认假设是读取方法有问题，而不是文件有问题。
