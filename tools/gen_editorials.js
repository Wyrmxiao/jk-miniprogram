/**
 * LC 背题内容构建器
 *
 * 用法：
 *   node tools/gen_editorials.js fetch   —— 拉 124 题 LC 中文题面（缓存到 .algo_lc_stmt_cache.json）
 *   node tools/gen_editorials.js build   —— 合并题面 + 手写解析（algo_editorial_content.js）→ 云函数静态数据
 *
 * 题面来源：leetcode.cn GraphQL（translatedContent，HTML 字符串）
 * 输出：cloudfunctions/learn/data/algo_editorials.json（随 learn 云函数部署，零 DB 查询）
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const BANK_PATH = path.join(ROOT, 'cloudfunctions/learn/data/algo_problems.json');
const CACHE_PATH = path.join(__dirname, '.algo_lc_stmt_cache.json');
const CONTENT_PATH = path.join(__dirname, 'algo_editorial_content.js');
const OUT_PATH = path.join(ROOT, 'cloudfunctions/learn/data/algo_editorials.json');

const BANK = JSON.parse(fs.readFileSync(BANK_PATH, 'utf8'));
const LC = BANK.problems.filter((p) => p.source === 'leetcode');

/* ---------------- 网络层 ---------------- */

function postGraphql(query, variables) {
  const body = JSON.stringify({ query, variables });
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'leetcode.cn',
        path: '/graphql',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          Referer: 'https://leetcode.cn/',
          'User-Agent': 'Mozilla/5.0 (algo-editorial-builder)'
        },
        timeout: 20000
      },
      (res) => {
        let buf = '';
        res.on('data', (d) => (buf += d));
        res.on('end', () => {
          try {
            const j = JSON.parse(buf);
            if (j.errors) return reject(new Error(j.errors[0] && j.errors[0].message));
            resolve(j.data);
          } catch (e) {
            reject(new Error('bad json: ' + buf.slice(0, 120)));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.write(body);
    req.end();
  });
}

const QUERY = `query q($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    translatedTitle
    translatedContent
    difficulty
  }
}`;

async function fetchOne(slug, cache) {
  const key = slug;
  if (cache[key] && cache[key].statement) return cache[key];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const d = await postGraphql(QUERY, { titleSlug: slug });
      const q = d && d.question;
      if (!q) throw new Error('question not found');
      cache[key] = {
        statement: q.translatedContent || '',
        difficulty: q.difficulty || ''
      };
      return cache[key];
    } catch (e) {
      if (attempt === 3) throw new Error(slug + ' -> ' + e.message);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

async function fetchAll() {
  const cache = fs.existsSync(CACHE_PATH)
    ? JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
    : {};
  let done = 0;
  const queue = LC.map((p) => p.pid);
  const workers = Array.from({ length: 2 }, async function worker() {
    for (;;) {
      const slug = queue.shift();
      if (!slug) return;
      await fetchOne(slug, cache);
      done++;
      if (done % 10 === 0) {
        fs.writeFileSync(CACHE_PATH, JSON.stringify(cache));
        console.log(`  ${done}/${LC.length}`);
      }
    }
  });
  await Promise.all(workers);
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache));
  const miss = LC.filter((p) => !(cache[p.pid] && cache[p.pid].statement)).length;
  console.log(`题面拉取完成：${LC.length - miss}/${LC.length} 成功`);
  if (miss) console.log('缺题面：', LC.filter((p) => !(cache[p.pid] && cache[p.pid].statement)).map((p) => p.pid).join(', '));
}

/* ---------------- 题面清洗（rich-text 兼容） ---------------- */

function escText(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function cleanStatement(html) {
  if (!html) return '';
  let h = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '');

  // pre 块：rich-text 白名单没有 pre，转为行内样式代码块（&nbsp; 保缩进）
  h = h.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (m, inner) => {
    let t = inner
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li)>/gi, '\n')
      .replace(/<[^>]+>/g, '');
    t = t
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&');
    const lines = t
      .split('\n')
      .map((l) => l.replace(/\t/g, '    '))
      .map((l) => escText(l).replace(/ /g, '&nbsp;'));
    while (lines.length && !lines[lines.length - 1]) lines.pop();
    return (
      '<div style="font-family:Menlo,Consolas,monospace;font-size:12px;line-height:1.7;background:rgba(107,140,163,0.08);border-radius:10px;padding:12px 12px;color:#4a4640;margin:8px 0;white-space:nowrap;overflow-x:auto">' +
      lines.join('<br/>') +
      '</div>'
    );
  });

  // sup/sub 不在 rich-text 白名单，转 ^/_ 记号
  h = h.replace(/<sup[^>]*>([\s\S]*?)<\/sup>/gi, '^$1');
  h = h.replace(/<sub[^>]*>([\s\S]*?)<\/sub>/gi, '_$1');

  // 题面内元素自带样式会破坏暗色适配，剥掉（代码块样式已在上面注入）
  h = h.replace(/\sstyle="[^"]*"/gi, '').replace(/\sclass="[^"]*"/gi, '');
  return h.trim();
}

/* ---------------- 合并输出 ---------------- */

function build() {
  if (!fs.existsSync(CACHE_PATH)) throw new Error('先跑 node tools/gen_editorials.js fetch');
  const stmtCache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  if (!fs.existsSync(CONTENT_PATH)) throw new Error('缺手写解析文件 ' + CONTENT_PATH);
  const content = require(CONTENT_PATH);

  const items = {};
  const missing = [];
  for (const p of LC) {
    const stmt = stmtCache[p.pid] || {};
    const c = content[p.id];
    if (!c || !c.analysis || !c.code || !c.codeAnalysis) {
      missing.push(p.pid);
      continue;
    }
    items[p.id] = {
      pid: p.pidDisplay || p.pid,
      slug: p.pid,
      title: p.title,
      titleCn: p.titleCn || '',
      lcDifficulty: { Easy: '简单', Medium: '中等', Hard: '困难' }[stmt.difficulty] || '',
      statementHtml: cleanStatement(stmt.statement || ''),
      analysis: c.analysis,
      code: c.code,
      codeAnalysis: c.codeAnalysis
    };
  }

  const out = { builtAt: new Date().toISOString(), count: Object.keys(items).length, items };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out));
  const size = (fs.statSync(OUT_PATH).size / 1024).toFixed(0);
  console.log(`已生成 ${OUT_PATH}：${out.count} 题 / ${size}KB`);
  if (missing.length) {
    console.log(`缺手写解析 ${missing.length} 题：`, missing.join(', '));
    process.exitCode = 1;
  }
}

(async () => {
  const cmd = process.argv[2] || 'build';
  if (cmd === 'fetch') await fetchAll();
  else build();
})().catch((e) => {
  console.error('失败：', e.message);
  process.exit(1);
});
