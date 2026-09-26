---
name: "claude-api-in-prototypes"
description: "Claude API in prototypes\nCall Claude from your HTML artifacts via window.claude.complete"
---
> **[Claude Code 下不可用]** `window.claude.complete` 是**托管制品专属的注入全局** —— 本地 HTTP 伺服出来的页面里**不存在**这个对象，本机也没有提供它背后的配额代理，**无本地替代**。见 [`../references/claude.md`](../references/claude.md) → "Web tools with no drop-in equivalent"。

Your HTML artifacts can call Claude via a built-in helper. No SDK or API key needed.

```html
<script>
(async () => {
  const text = await window.claude.complete("Summarize this: ...");
  // or with a messages array:
  const text2 = await window.claude.complete({
    messages: [{ role: 'user', content: '...' }],
  });
})();
</script>
```

Calls use `claude-haiku-4-5` with a 1024-token output cap (fixed — shared artifacts run under the viewer's quota). The call is rate-limited per user.
