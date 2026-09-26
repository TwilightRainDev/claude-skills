---
name: "read-pdf"
description: "read_pdf\nExtract text from PDF files"
---
> **[Claude Code 下需改写]** 下面的片段用的是浏览器沙箱的 `readFileBinary` / `log`，**二者在 Claude Code 都不存在**。改用 `Read`（文本）或 `Bash` + Node `fs.readFileSync`（字节）读取，再把同一个 pdf-parse 跑在 Node 里。见 [`../references/claude.md`](../references/claude.md) → "Web tool → Claude Code tool map"。

To read a PDF in a script, use the browser build of pdf-parse (pinned @2.4.5):

```js
const { PDFParse } = await import('https://cdn.jsdelivr.net/npm/pdf-parse@2.4.5/dist/pdf-parse/web/pdf-parse.es.js');
PDFParse.setWorker('https://cdn.jsdelivr.net/npm/pdf-parse@2.4.5/dist/pdf-parse/web/pdf.worker.min.mjs');

const blob = await readFileBinary('document.pdf');
const parser = new PDFParse({ data: new Uint8Array(await blob.arrayBuffer()) });
const result = await parser.getText();
log(result.text);
```

SRI hashes (for reference — dynamic import() cannot enforce SRI at runtime):

```
pdf-parse.es.js      sha384-J7LMAGioDDEBxHBcdxpU9NGtQu2/iLuSGyD3HsO5aYDJ0BAisPtpTYGc5XcB7UcI
pdf.worker.min.mjs   sha384-zdw/VQhL/JrSgvr/Omai4B8USJUC6AQXr/4YW01OlVWutKoGvg34AOFCRsO1dGJr
```
