# 单文件模板骨架（single-file-skeleton）

每个交付 HTML 都从这份骨架出发。结构与字段按原样保留，仅替换内容。

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Mono — {图名}</title>
<!-- 需要 ECharts 时： -->
<script src="https://cdn.jsdelivr.net/npm/echarts@6/dist/echarts.min.js"></script>
<!-- 需要 Chart.js 时（G1 / G3）： -->
<!-- <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script> -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="{MONO.FONT.link}" rel="stylesheet">
<style>/* 内联 MONO.CARD_CSS */</style>
</head>
<body>
<div class="grid2">
  <div class="card"><!-- 或 card dark / card wide -->
    <h2>{结论式标题}</h2>
    <div class="sub">{说明} · {图例} · {时间范围}</div>
    <!-- 图容器按引擎三选一： -->
    <div class="ch" id="ch"></div><!-- ECharts -->
    <!-- 手写 SVG： <svg id="ch" viewBox="0 0 400 320"></svg> -->
    <!-- Chart.js（G1/G3）： <div class="wrap"><canvas id="ch"></canvas></div>，配 .wrap{position:relative;height:320px} -->
    <!-- [WARN] Chart.js 必须挂 <canvas>，套 <div class="ch"> 会报 can't acquire context -->
    <div class="src">{图型名} · {系列} · {数据来源}</div>
  </div>
</div>
<script>
// 内联 mono-tokens.js 全文
// ── 数据（用户只需要改这里）──
const DATA = [ /* ... */ ];
// ── 渲染 ──
MONO.obsReveal('ch', el => { /* ... */ });
</script>
</body>
</html>
```
