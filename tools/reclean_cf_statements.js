/**
 * 对已抓好的 CF 题面缓存做二次清洗（公式可读化）
 *
 * 背景：首版清洗只处理了单 $...$，没处理 CF 常见的 "$$n$ ... $k$$" 混排，
 *       导致 398 题残留 $ 与 \le 等 LaTeX 命令。
 * 本脚本直接对 .cf_stmt_cache.json 里的 statementHtml 再跑一遍规则，不重新联网。
 *
 * 用法：node tools/reclean_cf_statements.js
 */
const fs = require('fs');
const path = require('path');

const CACHE = path.join(__dirname, '.cf_stmt_cache.json');
const cache = JSON.parse(fs.readFileSync(CACHE, 'utf8'));

function reflow(h) {
  if (!h) return h;
  return h
    .replace(/\\le\b/g, '≤')
    .replace(/\\ge\b/g, '≥')
    .replace(/\\neq\b/g, '≠')
    .replace(/\\cdot\b/g, '·')
    .replace(/\\times\b/g, '×')
    .replace(/\\pm\b/g, '±')
    .replace(/\\infty\b/g, '∞')
    .replace(/\\sum\b/g, 'Σ')
    .replace(/\\prod\b/g, 'Π')
    .replace(/\\lfloor\b/g, '⌊')
    .replace(/\\rfloor\b/g, '⌋')
    .replace(/\\sqrt\{([^{}]*)\}/g, '√($1)')
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
    .replace(/\\text\{([^{}]*)\}/g, '$1')
    .replace(/\\mathrm\{([^{}]*)\}/g, '$1')
    .replace(/\\operatorname\{([^{}]*)\}/g, '$1')
    .replace(/\\(left|right|big|Big|,|;|!|:)/g, '')
    .replace(/\\([a-zA-Z]+)/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\$/g, '');
}

let changed = 0;
let hadDollar = 0;
for (const [k, v] of Object.entries(cache)) {
  if (!v.statementHtml) continue;
  if (v.statementHtml.includes('$')) hadDollar++;
  const next = reflow(v.statementHtml);
  if (next !== v.statementHtml) {
    v.statementHtml = next;
    changed++;
  }
}

fs.writeFileSync(CACHE, JSON.stringify(cache));
const remain = Object.values(cache).filter((v) => v.statementHtml && v.statementHtml.includes('$')).length;
console.log('重清洗完成：', Object.keys(cache).length, '条');
console.log('原含 $：', hadDollar, '| 已改：', changed, '| 残留 $：', remain);
