---
name: EncodingGuide
description: Windows PowerShell 中文安全基线，按“AI 最容易凭直觉做出的危险操作”索引，给出诊断思路和修正方向，不展开最优实践，只告诉你怎么查、往哪改。
---

# EncodingGuide（Windows PowerShell 编码故障排查手册）

Windows 下中文与编码故障的排查手册：按“AI 最容易凭直觉做出的危险操作”索引，每条给出症状、根因、诊断思路和修正方向。不展开最优实践，只说明怎么查、往哪改。

## 何时使用

- 在 Windows PowerShell 或 Git Bash 中传递含中文的内容、中文路径或脚本代码。
- 出现编码类报错或疑似损坏：中文变 `??`、终端乱码、`SyntaxError: invalid character`、`IndentationError`、`Invalid statement (at line 1, column 1)`。
- 需要判断“文件是不是坏了”。
- 只看到现象、不记得自己刚才的直觉操作 → 从下方「快速诊断流程图」按现象倒查。

## 前置红线（阅读任何条目前的必读）

- **绝对不要**把含中文路径或复杂代码的内容通过管道传给 `python -c` / `node -e`。
- **也不要**通过 heredoc 直接内嵌多行脚本传给解释器。PowerShell 的管道和 heredoc 会在传递过程中自行解析 Unicode、转义符和括号，导致中文变 `??`、反斜杠被吞、括号被误认为命令调用。
- **凡是你直觉想写 `python -c "..."` 的地方，立刻停下来，改成临时文件方案。**

## 索引（按你的直觉动作查找）

| 如果你的直觉是… | 直接跳转 |
|----------------|---------|
| **1. “我把代码用管道或 heredoc 传给 `python -c` 吧，省事”** | [条目一](#条目一管道--heredoc--python--c) |
| **2. “我把中文路径用双引号拼到命令里传进去”** | [条目二](#条目二中文路径拼接到命令参数) |
| **3. “我用 `Out-File` 把内容保存到文件，指定 UTF8 总没错”** | [条目三](#条目三out-file-保存文件) |
| **4. “我改完 JSON 直接 `json.dump` 写回去”** | [条目四](#条目四json-直接-dump) |
| **5. “我在 PowerShell 里用 `-replace` 或逐行删改 Python 代码”** | [条目五](#条目五powershell-正则替换或逐行编辑) |
| **6. “我在 Git Bash 工具里用 `node -e` / `python -c` 内嵌脚本改文件”** | [条目六](#条目六git-bash-内嵌脚本-e) |
| **7. “我用 `head` / `grep` 看一眼文件内容确认结果”** | [条目七](#条目七head--grep-查看文件) |
| **8. “控制台输出乱码，文件肯定坏了，我重写一遍”** | [条目八](#条目八控制台乱码即文件损坏) |

## 条目一：管道 / heredoc → `python -c`

**直觉动作**
```powershell
@"I:\code\项目\config.json"@ | python -c "import json; ..."
# 或
python -c @"
print("你好")
"@
```

**典型症状**
- 报 `SyntaxError: invalid character`（如 U+2014）
- 中文字符变成 `??` 或乱码
- 脚本直接崩溃，或括号/花括号报错
- heredoc 意外提前闭合（内部含 `@` 序列时）

**根本原因**
PowerShell 管道和 heredoc 不是透传通道，会自行解析 Unicode 转义、变量插值（`$x` 展开）、括号语法。传给外部程序时，原始字符串已经被改写。

**诊断思路**
1. 把传给 `python -c` 的字符串先 `Write-Host` 打印出来，看是否与你预期一致。
2. 打印结果中中文已消失，或出现 `\uXXXX` 以外的异常字符 → 确诊为这个问题。
3. heredoc 提前闭合 → 检查内容中是否含有单独出现的 `@`（尤其在 JSON 或正则里）。

**解决方向**
- **放弃 `python -c` 和 heredoc。**
- 把脚本内容赋给一个变量，用 `Out-File -LiteralPath` 写入临时 `.py` 文件，再执行 `python 文件`。
- 因特殊字符（反引号、管道符）导致写入也失败时，退到 **Base64 字节写入**（`WriteAllBytes`）兜底。
- **生成的 Python 源码里，注释和文档字符串只用 ASCII 标点** —— 不要用 em dash `—`、弯引号 `“ ” ‘ ’` 这类字符。它们经 PowerShell 传递时会损坏，触发 `SyntaxError: invalid character (U+2014)`。坏在**注释**里最容易让人找错方向，以为是代码逻辑问题，所以这条要主动预防，不要等报错。

## 条目二：中文路径拼接到命令参数

**直觉动作**
```powershell
$dir = "I:\code\项目"
python tool.py --path "$dir"
```

**典型症状**
- Python 收到路径后报 `FileNotFoundError`，路径名显示为乱码或截断
- 路径中的空格或中文被拆分成多个参数
- `os.listdir` 返回空列表

**根本原因**
PowerShell 传参给外部程序时，会按系统 ANSI 编码（GBK）转换，中文路径字节损坏。同时路径中的 `[]`、`()` 等可能触发通配符展开。

**诊断思路**
1. 在 Python 脚本里 `print(sys.argv)`，看传进来的参数字符串是否完整。
2. 显示为乱码或丢失字符 → 确认为传参编码损坏。

**解决方向**
- **不要**把中文路径直接作为命令行参数传递。
- **优先方案**：在 PowerShell 中先 `Get-ChildItem -LiteralPath` 获取完整路径，然后**将路径硬编码写入临时 Python 脚本内容**（`BASE = r"I:\code\项目"`），执行该脚本。
- **兜底方案**：用 Base64 编码路径，在 Python 内解码，但不如临时文件方案稳定。
- **路径参数一律用 `-LiteralPath` 而非 `-Path`**：`-Path` 会展开通配符，路径里的 `[]`、`()` 等字符会被误解析成模式，命中错误的文件或直接不匹配。
- **但 `-LiteralPath` 不能和 `-Include` 搭配 —— 这是个静默陷阱。**
  `Get-ChildItem -LiteralPath <目录> -Recurse -Include *.json` 里的 `-Include` **会被静默忽略**，命令退回成“返回整棵子树的全部文件”。不报错、不警告，后果是脚本处理了远多于预期的文件。

  ```powershell
  # 错：-Include 失效，返回整棵子树
  Get-ChildItem -LiteralPath "I:\code\项目" -Recurse -Include *.json
  # 对：用 Where-Object 过滤
  Get-ChildItem -LiteralPath "I:\code\项目" -Recurse -File | Where-Object { $_.Extension -eq '.json' }
  ```

  要删改文件时这条尤其危险（可能波及无关文件）——**动手前列清单核对**。

## 条目三：`Out-File` 保存文件

**直觉动作**
```powershell
$content | Out-File pyproject.toml -Encoding UTF8
# 或保存 .py 脚本
$script | Out-File tool.py -Encoding UTF8
```

**典型症状**
- TOML 文件报错：`Invalid statement (at line 1, column 1)`
- Python 脚本运行正常（对 BOM 不敏感），但 **TOML 解析器必炸**
- 某些工具读取时在文件开头出现不可见字符

**根本原因**
`Out-File -Encoding UTF8` 默认写入 **带 BOM 的 UTF-8**（文件头 `EF BB BF`）。TOML 规范不允许 BOM，Python 的 `tomllib` / `tomli` 会直接报错。

**诊断思路**
1. 用十六进制查看器或 `Format-Hex` 查看文件开头：若前三个字节是 `EF BB BF`，就是 BOM 问题。
2. 若用记事本另存为 UTF-8（无 BOM）后文件恢复正常，即确诊。

**解决方向**
- **保存 TOML 文件**：弃用 `Out-File`，改用

  ```powershell
  [System.IO.File]::WriteAllText("pyproject.toml", $content, [System.Text.UTF8Encoding]::new($false))
  ```

- **保存 .py 脚本**：`Out-File -Encoding UTF8` 可用（Python 接受 BOM），但为统一习惯，一律用 `WriteAllText` 去 BOM。

## 条目四：JSON 直接 `dump`

**直觉动作**
```python
with open("config.json", "w") as f:
    json.dump(data, f, indent=2)
```

**典型症状**
- JSON 文件中所有中文变成 `\uXXXX` 转义序列
- 文件没有末尾换行，`git diff` 显示整行变更
- 其他工具读取时中文显示为 Unicode 码点

**根本原因**
`json.dump` 默认 `ensure_ascii=True`，将所有非 ASCII 字符转义；未显式指定 `encoding="utf-8"` 时可能用系统默认编码（GBK）写入。

**诊断思路**
1. 打开 JSON 文件，若看到 `"\u9879\u76ee"` 而不是 `"项目"`，即为该问题。
2. 检查文件编码：若用 GBK 打开不报错但中文乱码，说明写入时用了非 UTF-8。

**解决方向**
修改 Python 写入代码，**三个参数缺一不可**：

```python
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write("\n")   # 加末尾换行
```

如果脚本由 PowerShell 临时生成，直接在脚本内容中写死这三项。

## 条目五：PowerShell 正则替换或逐行编辑

**直觉动作**
```powershell
$lines = Get-Content script.py
$lines = $lines[0..28] + $lines[30..$count]   # 删一行
$content -replace "(abc)", ""                # 正则替换
```

**典型症状**
- Python 脚本运行时报 `IndentationError`（缩进错误）
- 替换操作没生效，或替换了不该替换的内容
- 正则匹配失败，明明肉眼看到目标字符串却返回原样

**根本原因**
1. **逐行删除**会破坏 Python 的缩进结构（例如删除 `if` 的某一行导致后续 `else` 缩进断开）。
2. PowerShell 的 `-replace` 使用 .NET 正则，与 Python 正则语法有差异（如转义层级），且路径中的 `[]`、`.`、`()` 不转义会直接匹配失败。

**诊断思路**
1. 修改后手动检查被删除行前后的缩进层级是否仍连续。
2. 对 `-replace` 失败的情况，把替换目标和被替换字符串分别 `Write-Host` 打印，肉眼对比是否一致——差异通常在反斜杠或括号的转义层级上。

**解决方向**
- **对 Python 代码做结构性增删**：不要逐行操作，改用 Python 自己的 `re.sub` 整体匹配代码块（通过临时脚本完成）。
- **对字符串替换**：替换逻辑复杂时同样交给 Python 的 `str.replace()` 或 `re.sub()` 处理，避免在 PowerShell 层纠缠转义。
- 必须在 PowerShell 内做简单替换时，对路径使用 `-LiteralPath` 而非 `-Path`；对正则元字符使用 `[Regex]::Escape()`。

## 条目六：Git Bash 内嵌脚本（`-e`）

> 路径转换与 Shell 检测的通用知识见 `WinBashTest/references/path-conversion.md`；本条聚焦内嵌脚本的三层解析。

**直觉动作**
在 Bash 工具（如 Git Bash）中：

```bash
node -e 'fs.writeFileSync("p", "D:\\android-sdk")'
# 或
python -c "import re; print(re.sub('a', 'b', 'aaa'))"
```

**典型症状**
- 文件写入后内容为 `D:android-sdk`（反斜杠全部丢失）
- 替换操作报 `SyntaxError` 或 `Not Found`
- 用完整行字符串做 `replace` 匹配时，**连续三次返回 NOT FOUND**，而肉眼确认目标行存在

**根本原因**
这是 **三层解析叠加**：

1. **工具参数 JSON 层**（如 CodeBuddy 的 Bash 工具参数）：剥掉一层反斜杠。
2. **Bash 单引号/双引号层**：对反斜杠和特殊字符有自己的解析。
3. **目标语言字符串层（JS/Python）**：字符串内部的 `\` 又被解释一次。

三层叠加后，**要最终得到 1 个反斜杠，工具调用层需要写 4 个 `\\\\`**。而 `\a`、`\p`、`\w` 等未知转义序列会被静默吞掉反斜杠（JS 中 `\a`→`a`）。

**诊断思路**
1. 在目标脚本中加入调试输出，打印实际收到的字符串：

   ```bash
   node -e 'console.log(JSON.stringify(process.argv[2]))' "参数"
   ```

   JSON.stringify 会把每个反斜杠显示为 `\\`，数出真实数量即可核对。
2. 对于整行匹配 NOT FOUND：**先取证，再动手**——打印出目标行的实际字节与你的替换字符串字节，差异通常就在反斜杠数量上。

**解决方向**
- **路径一律改用正斜杠**（`D:/android-sdk`），Windows API 和 Node/Python 都接受，彻底绕过反斜杠转义层。
- **不要用完整行字符串做字面匹配**——改用不含反斜杠的唯一锚点子串（如 `adb 主路径`）定位，再用 `indexOf` + 切片插入，从根上消除转义匹配问题。
- 必须用反斜杠时，工具调用层写 4 个 `\\\\`，并在 JS 里用 `String.raw` 或双反斜杠再处理。

## 条目七：`head` / `grep` 查看文件

**直觉动作**
```bash
head -6 SKILL.md | grep description
# 或
grep "description" SKILL.md
```

**典型症状**
- 输出 `description: |` 后为空，误以为描述字段缺失
- 检查 YAML 块标量时，得出“文件损坏”的结论，但用编辑器打开正文完好

**根本原因**
YAML 的 `|`（以及 `>-`、`|+`、`|-` 等变体）是 **多行块标量指示符**，正文在**后续缩进行**中。`head -6` 截断时只抓到了指示符行，正文行可能被截掉；`grep` 只匹配键所在行，自然看不到内容。

这不代表文件有问题，而是**读取方法不完整**。

**诊断思路**
1. 用 `cat -A` 或 `xxd` 查看文件完整内容，确认缩进行确实存在。
2. 用 **Read 工具**（IDE/编辑器）直接打开完整文件，不经 shell 解析。
3. 若用 Python 解析 YAML（`yaml.safe_load`）能正常读取，则确认为 shell 查看方式误判。

**解决方向**
- **永远不要仅凭 `head`/`grep` 的输出断定 YAML 块标量字段为空**。
- 检查元数据时，优先用 Read 工具读取完整文件内容，或写一段 Python 脚本完整加载 YAML 后再判断。
- 脚本化检查时，识别到块标量指示符后，需收集**所有后续缩进行**作为正文，判空标准是“指示符后无缩进行”，而非“指示符本身为空”。

## 条目八：控制台乱码即文件损坏

**直觉动作**
终端输出显示乱码 → 认为文件编码坏了 → 用 `Set-Content` 或 GBK 重写一遍 → 越改越乱

**典型症状**
- `Get-Content` 输出中文显示为 `??` 或方块
- 文件中原本正常的中文，经过 PowerShell 变量处理后，后续匹配失败
- 在 GBK 终端下运行 Python 脚本，`print("中文")` 输出乱码

**根本原因**
Windows 默认控制台代码页是 GBK（936），PowerShell 的 `Get-Content` / `Set-Content` 在不指定 `-Encoding` 时，会**静默使用 GBK 进行字节转换**。UTF-8 文件被当作 GBK 读取时，Unicode 字符被映射为错误的字节序列，甚至不可逆地损坏（如果把乱码写回文件）。

**终端乱码 ≠ 文件损坏**，往往是显示层或读取层的编码不匹配。

**诊断思路**
1. 用十六进制工具查看文件原始字节：若开头是 `EF BB BF` 或 UTF-8 序列，则文件本身完好。
2. 用 `[System.IO.File]::ReadAllText("文件", [System.Text.UTF8Encoding]::new($false))` 读取，看是否能正确还原中文。若能，说明是 `Get-Content` 的默认编码问题。
3. 只是终端输出乱码时，在 Python 脚本前设置 `$env:PYTHONIOENCODING="utf-8"`，看输出是否正常。

**解决方向**
- **读文件**：始终指定 `-Encoding UTF8`（`Get-Content -Encoding UTF8`）。
- **写文件**：用 `WriteAllText` 去 BOM（如条目三），或 `Set-Content -Encoding UTF8`（注意它也带 BOM）。
- **Python 输出**：设置 `PYTHONIOENCODING=utf-8` 环境变量，或在脚本内 `sys.stdout.reconfigure(encoding='utf-8')`。
- **核心判断原则**：默认假设**文件没坏，是你的读法错了**。用至少两种独立方式（编辑器 + 十六进制 + Python 读取）交叉验证，确认一致后才断言文件损坏。

## 快速诊断流程图（按现象倒查）

如果你不记得自己的直觉操作，但看到了具体报错/现象，按此索引回溯到对应条目：

| 现象 | 优先查看条目 |
|-------|-------------|
| `SyntaxError: invalid character (U+2014)` 或中文变 `??` | [条目一](#条目一管道--heredoc--python--c) |
| `FileNotFoundError`，路径含中文或方括号 | [条目二](#条目二中文路径拼接到命令参数) |
| 脚本处理了远超预期的文件，`-Include` 看上去没生效（不报错） | [条目二](#条目二中文路径拼接到命令参数) |
| `Invalid statement (at line 1, column 1)`（TOML） | [条目三](#条目三out-file-保存文件) |
| JSON 文件全是 `\uXXXX` 或 git diff 显示整行变更 | [条目四](#条目四json-直接-dump) |
| 修改 Python 后 `IndentationError` | [条目五](#条目五powershell-正则替换或逐行编辑) |
| Bash 中 `node -e` 写入路径丢失反斜杠，或替换 NOT FOUND | [条目六](#条目六git-bash-内嵌脚本-e) |
| `head`/`grep` 显示字段为空，但编辑器里却有内容 | [条目七](#条目七head--grep-查看文件) |
| 终端输出乱码，文件读取出错 | [条目八](#条目八控制台乱码即文件损坏) |

## 最后的通用诊断原则

> **任何“内容缺失 / 损坏 / 为空”的结论，第一反应不是修文件，而是检查你的读取/传递方法本身。**
> 用两种以上独立方式（编辑器直读、十六进制、Python 原生 API、不同命令）交叉验证，得出相同结论后才可断言。默认假设：**你的直觉操作改写了数据，文件本身大概率是好的。**
