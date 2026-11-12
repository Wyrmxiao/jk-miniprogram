/**
 * Codeforces 题面抓取器
 *
 * 用法：
 *   node tools/fetch_cf_statements.js test   —— 抓 3 题验证解析
 *   node tools/fetch_cf_statements.js fetch  —— 全量抓取（断点续跑，限速）
 *
 * 说明：
 *   codeforces.com 需要浏览器 UA 才返回 200（无 UA 是 Cloudflare 403）。
 *   页面题面在 <div class="problem-statement"> 内，用 div 配平截取，
 *   再清洗成小程序 rich-text 可渲染的 HTML。
 *
 * 缓存：tools/.cf_stmt_cache.json，键为 "contestId:index"（如 "4:A"）
 */
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BANK_PATH = path.join(ROOT, 'cloudfunctions/learn/data/algo_problems.json');
const CACHE_PATH = path.join(__dirname, '.cf_stmt_cache.json');
const BANK = JSON.parse(fs.readFileSync(BANK_PATH, 'utf8'));
const CF = BANK.problems.filter((p) => p.source === 'codeforces');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/* ---------------- 网络 ---------------- */

/**
 * 用 curl 子进程抓取。
 * 为什么不用 https 模块：Cloudflare 会识别 Node 的 TLS 指纹并返回 403，
 * 而 curl 带浏览器 UA 可稳定返回 200（2026-11-04 连续 5 题实测）。
 * 输出经文件落地再读，避免大 HTML 走 stdout 管道被截断。
 */
function get(url, outFile) {
  return new Promise((resolve, reject) => {
    execFile(
      'curl',
      ['-s', '--max-time', '20', '-H', 'User-Agent: ' + UA, '-o', outFile, '-w', '%{http_code}', url],
      { maxBuffer: 1024 * 1024 },
      (err, stdout) => {
        if (err) return reject(err);
        const code = String(stdout).trim();
        if (code !== '200') return reject(new Error('HTTP ' + code));
        try {
          resolve(fs.readFileSync(outFile, 'utf8'));
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}

const TMP_HTML = path.join(__dirname, '.cf_fetch_tmp.html');

/* ---------------- div 配平截取 ---------------- */

function extractStatement(html) {
  const START = '<div class="problem-statement">';
  const start = html.indexOf(START);
  if (start < 0) return '';

  let depth = 0;
  let i = start;
  const re = /<\/?div\b[^>]*>/gi;
  re.lastIndex = start;
  let m;
  let end = -1;
  while ((m = re.exec(html))) {
    if (m[0][1] === '/') {
      depth--;
      if (depth === 0) {
        end = m.index + m[0].length;
        break;
      }
    } else {
      depth++;
    }
  }
  if (end < 0) return '';
  return html.slice(start, end);
}

/* ---------------- HTML 清洗（rich-text 白名单） ---------------- */

const ALLOWED = new Set([
  'p', 'div', 'br', 'strong', 'b', 'em', 'i', 'u', 'span',
  'ul', 'ol', 'li', 'code', 'pre', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img', 'sub', 'sup'
]);

function clean(html) {
  if (!html) return '';
  let h = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // 数学公式：CF 用 <span class="tex-span"> 包裹，样式剥掉后保留文字
  // 常见 $...$ 与 \[...\] 交给 plain text 呈现
  h = h.replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, (m, alt) => alt || '');

  // 只保留白名单标签，其他标签丢弃但保留内部文本
  h = h.replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g, (tag, name) => {
    const n = name.toLowerCase();
    if (!ALLOWED.has(n)) return '';
    // 剥掉所有属性，避免 CF 的 class/style 破坏小程序样式
    const closing = tag[1] === '/';
    return closing ? `</${n}>` : `<${n}>`;
  });

  // 代码块与样例：pre 不被 rich-text 白名单支持，转成带行内样式的 div
  h = h.replace(/<pre>([\s\S]*?)<\/pre>/gi, (m, inner) => {
    const t = inner
      .replace(/<br>/gi, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    const lines = t.split('\n').map((l) =>
      l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '&nbsp;')
    );
    while (lines.length && !lines[lines.length - 1]) lines.pop();
    return (
      '<div style="font-family:Menlo,Consolas,monospace;font-size:12px;line-height:1.7;' +
      'background:rgba(107,140,163,0.08);border-radius:10px;padding:12px;color:#4a4640;' +
      'margin:8px 0;white-space:nowrap;overflow-x:auto">' + lines.join('<br/>') + '</div>'
    );
  });

  // sup/sub 转记号
  h = h.replace(/<sup>([\s\S]*?)<\/sup>/gi, '^$1');
  h = h.replace(/<sub>([\s\S]*?)<\/sub>/gi, '_$1');

  // 实体规整 + 数学公式可读化
  // CF 的题面里 KaTeX 分隔符常混排成 "$$n$ ... $k$$"，且夹着 \le 等命令。
  // rich-text 不能渲染 LaTeX，所以剥掉所有 $，把高频命令换成可读字符。
  h = h
    .replace(/&#8722;/g, '-')
    .replace(/&#8804;/g, '≤')
    .replace(/&#8805;/g, '≥')
    .replace(/&nbsp;/g, ' ')
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
    .replace(/\\([a-zA-Z]+)/g, '$1')      // 其余命令去掉反斜杠，保留字母
    .replace(/[{}]/g, '')
    .replace(/\$/g, '');                   // 最后统一剥掉所有 $ 分隔符

  return h.trim();
}

/* ---------------- 结构化字段提取 ---------------- */

function sections(html) {
  const pick = (cls) => {
    const re = new RegExp('<div class="' + cls + '">([\\s\\S]*?)(?=<div class="(?:input-specification|output-specification|sample-tests|note|section-title|property-title)|</div>\\s*</div>\\s*</div>)', 'i');
    const m = html.match(re);
    return m ? m[1] : '';
  };
  const plain = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const limit = html.match(/time limit per test<\/div>([^<]+)/i);
  const mem = html.match(/memory limit per test<\/div>([^<]+)/i);

  return {
    timeLimit: limit ? plain(limit[1]) : '',
    memoryLimit: mem ? plain(mem[1]) : ''
  };
}

/* ---------------- 抓取主流程 ---------------- */

function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch (e) {
    console.warn('缓存损坏，重建');
    return {};
  }
}

function problemUrl(p) {
  const m = String(p.pid).match(/^(\d+)([A-Za-z]\d*)$/);
  if (!m) return null;
  return `https://codeforces.com/problemset/problem/${m[1]}/${m[2]}`;
}

async function fetchOne(p, cache) {
  const key = p.pid;
  if (cache[key] && cache[key].statementHtml) return cache[key];
  const url = problemUrl(p);
  if (!url) {
    cache[key] = { error: 'bad pid' };
    return cache[key];
  }
  // 每个 worker 用独立临时文件，避免并发覆盖
  const tmp = path.join(__dirname, '.cf_fetch_' + key.replace(/[^A-Za-z0-9]/g, '_') + '.html');
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const html = await get(url, tmp);
      const raw = extractStatement(html);
      if (!raw || raw.length < 80) throw new Error('no statement block');
      const meta = sections(raw);
      const statementHtml = clean(raw);
      if (statementHtml.length < 60) throw new Error('cleaned empty');
      cache[key] = {
        statementHtml,
        timeLimit: meta.timeLimit,
        memoryLimit: meta.memoryLimit,
        url
      };
      try { fs.unlinkSync(tmp); } catch (e) { /* 忽略 */ }
      return cache[key];
    } catch (e) {
      try { fs.unlinkSync(tmp); } catch (e2) { /* 忽略 */ }
      if (attempt === 3) {
        cache[key] = { error: e.message };
        return cache[key];
      }
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
}

function save(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache));
}

async function run() {
  const cmd = process.argv[2] || 'test';
  const cache = loadCache();

  if (cmd === 'test') {
    const sample = ['4A', '231A', '263A'].map((pid) => CF.find((p) => p.pid === pid)).filter(Boolean);
    for (const p of sample) {
      const r = await fetchOne(p, cache);
      console.log('\n===', p.pid, p.title, '===');
      console.log('状态:', r.error || 'OK');
      if (r.statementHtml) {
        console.log('HTML 长度:', r.statementHtml.length);
        console.log('时限/内存:', r.timeLimit, '/', r.memoryLimit);
        console.log('纯文本预览:', r.statementHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300));
      }
    }
    save(cache);
    return;
  }

  const pending = CF.filter((p) => !(cache[p.pid] && cache[p.pid].statementHtml));
  console.log(`待抓 ${pending.length}/${CF.length} 题`);

  let done = 0;
  let ok = 0;
  const CONCURRENCY = 3;
  const queue = pending.slice();

  async function worker(wid) {
    for (;;) {
      const p = queue.shift();
      if (!p) return;
      const r = await fetchOne(p, cache);
      if (r.statementHtml) ok++;
      done++;
      if (done % 20 === 0) {
        save(cache);
        console.log(`  ${done}/${pending.length}（成功 ${ok}）`);
      }
      // 限速：每题之间留一点，避免触发反爬
      await new Promise((r2) => setTimeout(r2, 120 + wid * 40));
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));
  save(cache);

  const failed = CF.filter((p) => !cache[p.pid] || !cache[p.pid].statementHtml);
  console.log(`完成：成功 ${ok}，失败 ${failed.length}`);
  if (failed.length) console.log('失败样例:', failed.slice(0, 15).map((p) => p.pid).join(', '));
}

run().catch((e) => {
  console.error('失败：', e);
  process.exit(1);
});
