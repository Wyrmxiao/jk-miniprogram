/**
 * tools/build_algo_problems.js —— 构建算法训练题库快照
 *
 * 数据源（2026-10-29 实测可用）：
 *   Codeforces  https://codeforces.com/api/problemset.problems   11481 题，97% 有 rating
 *   力扣中文站   https://leetcode.cn/graphql/                    4484 题，标签带中文译名
 *
 * 策略：每个 (知识点 × 难度档) 取通过人数最多的前 TOP_PER_CELL 题，
 *       过滤 solvedCount < MIN_SOLVED 的冷门题。
 *
 * 产物：cloudfunctions/learn/data/algo_problems.json
 *   { version, builtAt, bands, tags, problems: [...] }
 *
 * 用法：
 *   node tools/build_algo_problems.js            # 只用 Codeforces
 *   node tools/build_algo_problems.js --with-lc  # 额外并入力扣（中文题名）
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.resolve(__dirname, '..', 'cloudfunctions', 'learn', 'data');
const OUT_FILE = path.join(OUT_DIR, 'algo_problems.json');

/** 每个 (知识点 × 档位) 保留的题目数 */
const TOP_PER_CELL = 20;
/** 低于此通过人数视为冷门题，不进题库 */
const MIN_SOLVED = 100;

/** 难度档位（5 档，固定） */
const BANDS = [
  { key: 'entry', name: '入门', min: 800, max: 1000 },
  { key: 'basic', name: '基础', min: 1100, max: 1300 },
  { key: 'improve', name: '提高', min: 1400, max: 1600 },
  { key: 'advanced', name: '进阶', min: 1700, max: 1900 },
  { key: 'challenge', name: '挑战', min: 2000, max: 2200 }
];

/** 13 个知识点（顺序即前端展示顺序） */
const TAGS = [
  { key: 'simulation', name: '模拟枚举' },
  { key: 'sort', name: '排序' },
  { key: 'binary', name: '二分' },
  { key: 'prefix', name: '前缀和差分' },
  { key: 'twopointer', name: '双指针' },
  { key: 'greedy', name: '贪心' },
  { key: 'recursion', name: '递归分治' },
  { key: 'dp', name: '动态规划' },
  { key: 'graph', name: '图论' },
  { key: 'tree', name: '树' },
  { key: 'ds', name: '数据结构' },
  { key: 'string', name: '字符串' },
  { key: 'search', name: '搜索' },
  { key: 'math', name: '数学' }
];

/**
 * Codeforces 英文标签 → 我们的知识点
 * 一对多映射：一道题可以有多个知识点
 */
const CF_TAG_MAP = {
  implementation: ['simulation'],
  'brute force': ['simulation'],
  'constructive algorithms': ['simulation'],
  sortings: ['sort'],
  'binary search': ['binary'],
  'two pointers': ['twopointer'],
  greedy: ['greedy'],
  'divide and conquer': ['recursion'],
  'dfs and similar': ['search', 'graph'],
  bfs: ['search', 'graph'],
  dp: ['dp'],
  graphs: ['graph'],
  'shortest paths': ['graph'],
  dsu: ['graph'],
  trees: ['tree'],
  'data structures': ['ds'],
  string: ['string'],
  strings: ['string'],
  math: ['math'],
  'number theory': ['math'],
  combinatorics: ['math']
};

function bandOf(rating) {
  return BANDS.find((b) => rating >= b.min && rating <= b.max) || null;
}

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; jk-algo-builder/1.0)', ...headers }
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

/* ---------- Codeforces ---------- */
async function buildFromCodeforces() {
  console.log('拉取 Codeforces 题库…');
  const d = await fetchJson('https://codeforces.com/api/problemset.problems');
  if (d.status !== 'OK') throw new Error('CF 返回状态异常: ' + d.status);

  const solvedMap = new Map();
  for (const s of d.result.problemStatistics || []) {
    solvedMap.set(`${s.contestId}:${s.index}`, s.solvedCount || 0);
  }

  const items = [];
  for (const p of d.result.problems) {
    const rating = p.rating;
    if (!rating) continue;
    const band = bandOf(rating);
    if (!band) continue;

    const solved = solvedMap.get(`${p.contestId}:${p.index}`) || 0;
    if (solved < MIN_SOLVED) continue;

    const tags = [];
    for (const t of p.tags || []) {
      for (const k of CF_TAG_MAP[t] || []) {
        if (tags.indexOf(k) === -1) tags.push(k);
      }
    }
    if (!tags.length) continue;

    items.push({
      id: `cf:${p.contestId}:${p.index}`,
      title: p.name,
      titleCn: '',
      source: 'codeforces',
      pid: `${p.contestId}${p.index}`,
      url: `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`,
      rating,
      band: band.key,
      tags,
      solved
    });
  }
  console.log(`  CF 候选题（有 rating + 有标签 + 通过数≥${MIN_SOLVED}）: ${items.length}`);
  return items;
}

/* ---------- 力扣（中文题名补充） ---------- */
async function buildFromLeetCode() {
  console.log('拉取力扣中文题库…');
  const query = `query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
    problemsetQuestionList(categorySlug: $categorySlug, limit: $limit, skip: $skip, filters: $filters) {
      total
      questions { titleSlug title difficulty topicTags { name slug nameTranslated } }
    }
  }`;

  const LC_TAG_MAP = {
    'dynamic-programming': 'dp',
    'depth-first-search': 'search',
    'breadth-first-search': 'search',
    'binary-search': 'binary',
    greedy: 'greedy',
    'two-pointers': 'twopointer',
    'sliding-window': 'twopointer',
    'prefix-sum': 'prefix',
    sorting: 'sort',
    'divide-and-conquer': 'recursion',
    recursion: 'recursion',
    'union-find': 'graph',
    graph: 'graph',
    'shortest-path': 'graph',
    tree: 'tree',
    'binary-tree': 'tree',
    string: 'string',
    math: 'math',
    'hash-table': 'ds',
    stack: 'ds',
    queue: 'ds',
    heap: 'ds',
    'linked-list': 'ds',
    array: 'simulation',
    simulation: 'simulation',
    backtracking: 'search'
  };
  const LC_BAND = { EASY: 'entry', MEDIUM: 'basic', HARD: 'improve' };

  const items = [];
  let skip = 0;
  const LIMIT = 100;
  let total = Infinity;
  while (skip < total) {
    const res = await fetch('https://leetcode.cn/graphql/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Referer: 'https://leetcode.cn/problemset/',
        'User-Agent': 'Mozilla/5.0 (compatible; jk-algo-builder/1.0)'
      },
      body: JSON.stringify({
        query,
        variables: { categorySlug: '', limit: LIMIT, skip, filters: {} }
      })
    });
    if (!res.ok) throw new Error(`力扣 HTTP ${res.status}`);
    const json = await res.json();
    const page = json.data && json.data.problemsetQuestionList;
    if (!page) throw new Error('力扣返回结构异常');
    total = page.total || 0;

    for (const q of page.questions || []) {
      const band = LC_BAND[q.difficulty];
      if (!band) continue;
      const tags = [];
      for (const t of q.topicTags || []) {
        const k = LC_TAG_MAP[t.slug];
        if (k && tags.indexOf(k) === -1) tags.push(k);
      }
      if (!tags.length) continue;
      items.push({
        id: `lc:${q.titleSlug}`,
        title: q.title,
        titleCn: '',
        source: 'leetcode',
        pid: q.titleSlug,
        url: `https://leetcode.cn/problems/${q.titleSlug}/`,
        rating: 0,
        band,
        tags,
        solved: 0,
        // 力扣不提供通过人数，用 difficulty 转成排序权重，保证热门题在前
        _order: q.difficulty === 'EASY' ? 3 : q.difficulty === 'MEDIUM' ? 2 : 1
      });
    }
    skip += LIMIT;
    process.stdout.write(`\r  已拉取 ${Math.min(skip, total)}/${total}`);
  }
  console.log(`\n  力扣候选: ${items.length}`);
  return items;
}

/**
 * 力扣列表接口不返回中文题名，需逐题查 detail。
 * 并发 8 路，失败不阻塞（题名退回英文）。
 */
async function fetchLeetCodeTitles(slugs) {
  const map = new Map();
  const query = `query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) { questionFrontendId title translatedTitle }
  }`;
  const CONCURRENCY = 8;
  let idx = 0;
  let done = 0;

  async function worker() {
    while (idx < slugs.length) {
      const slug = slugs[idx++];
      try {
        const res = await fetch('https://leetcode.cn/graphql/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Referer: 'https://leetcode.cn/problemset/',
            'User-Agent': 'Mozilla/5.0 (compatible; jk-algo-builder/1.0)'
          },
          body: JSON.stringify({ query, variables: { titleSlug: slug } })
        });
        if (res.ok) {
          const j = await res.json();
          const q = j.data && j.data.question;
          if (q) map.set(slug, { cn: q.translatedTitle || '', no: q.questionFrontendId || '' });
        }
      } catch (e) {
        /* 单题失败忽略 */
      }
      done++;
      if (done % 20 === 0) process.stdout.write(`\r  中文题名 ${done}/${slugs.length}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\r  中文题名 ${map.size}/${slugs.length} 条`);
  return map;
}

/* ---------- Codeforces 英文题名 → 中文（MyMemory 翻译，带本地缓存） ---------- */
const CACHE_FILE = path.join(__dirname, '.algo_title_cache.json');

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}
function saveCache(cache) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf8');
}

/**
 * 翻译单条。MyMemory 免费接口：
 *   匿名 5000 字符/天；带 de=邮箱参数提升到 50000 字符/天
 * 返回译文或 ''。
 */
async function translateOne(text) {
  const url =
    'https://api.mymemory.translated.net/get?q=' +
    encodeURIComponent(text) +
    '&langpair=en|zh-CN&de=jk-algo-builder%40example.com';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; jk-algo-builder/1.0)' }
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      if (j.responseStatus === 200 && j.responseData && j.responseData.translatedText) {
        return j.responseData.translatedText.trim();
      }
      return '';
    } catch (e) {
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  return '';
}

/** 并发 3 路批量翻译，结果写入缓存；失败题名保持英文（前端降级显示英文） */
async function fetchCfTranslations(problems) {
  const cache = loadCache();
  const todo = problems.filter((p) => p.source === 'codeforces' && !p.titleCn && !cache[p.title]);
  console.log(`\n翻译 CF 题名：待译 ${todo.length}，缓存命中 ${problems.length - todo.length}`);

  let idx = 0;
  let done = 0;
  const CONCURRENCY = 3;

  async function worker() {
    while (idx < todo.length) {
      const p = todo[idx++];
      const cn = await translateOne(p.title);
      if (cn) cache[p.title] = cn;
      done++;
      if (done % 25 === 0) {
        process.stdout.write(`\r  已译 ${done}/${todo.length}`);
        saveCache(cache);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  saveCache(cache);
  console.log(`\r  已译 ${done}/${todo.length}（缓存 ${Object.keys(cache).length} 条）`);

  let filled = 0;
  for (const p of problems) {
    if (p.source !== 'codeforces' || p.titleCn) continue;
    const cn = cache[p.title];
    if (cn) {
      p.titleCn = cn;
      filled++;
    }
  }
  console.log(`  CF 中文题名: ${filled}/${problems.filter((p) => p.source === 'codeforces').length}`);
}

/* ---------- 择优：每 (知识点 × 档位) 取 Top N ---------- */
function pickTop(items) {
  const cells = new Map();
  for (const it of items) {
    for (const tag of it.tags) {
      const key = `${tag}|${it.band}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(it);
    }
  }

  const score = (it) => it.solved || (it._order || 0) * 1000;
  const picked = new Map();

  const coverage = [];
  for (const t of TAGS) {
    for (const b of BANDS) {
      const key = `${t.key}|${b.key}`;
      const list = (cells.get(key) || []).sort((a, b2) => score(b2) - score(a));
      const top = list.slice(0, TOP_PER_CELL);
      picked.set(key, top);
      coverage.push({ tag: t.key, tagName: t.name, band: b.key, count: top.length });
    }
  }

  // 合并去重（一题可属多知识点）
  const unique = new Map();
  for (const [, list] of picked) {
    for (const it of list) unique.set(it.id, it);
  }
  return { problems: Array.from(unique.values()), coverage };
}

function reportCoverage(coverage) {
  const byTag = {};
  for (const c of coverage) {
    if (!byTag[c.tag]) byTag[c.tag] = { name: c.tagName, counts: {} };
    byTag[c.tag].counts[c.band] = c.count;
  }
  const pad = (s, n) => String(s).padEnd(n, ' ');
  console.log('\n' + pad('知识点', 12) + BANDS.map((b) => pad(b.name, 8)).join(''));
  for (const t of TAGS) {
    const row = byTag[t.key];
    console.log(
      pad(t.name, 12) + BANDS.map((b) => pad(row.counts[b.key] || 0, 8)).join('')
    );
  }
}

(async () => {
  const withLc = process.argv.includes('--with-lc');
  let items = await buildFromCodeforces();
  if (withLc) {
    const lc = await buildFromLeetCode();
    items = items.concat(lc);
  }

  const { problems, coverage } = pickTop(items);
  reportCoverage(coverage);

  // 全部题名补中文：CF 走 MyMemory 翻译，力扣走官方 translatedTitle
  await fetchCfTranslations(problems);

  // 力扣题名补中文（只对最终入选的题查，避免浪费请求）
  const lcSlugs = problems.filter((p) => p.source === 'leetcode').map((p) => p.pid);
  if (lcSlugs.length) {
    console.log('\n补全力扣中文题名…');
    const titles = await fetchLeetCodeTitles(lcSlugs);
    let filled = 0;
    for (const p of problems) {
      if (p.source !== 'leetcode') continue;
      const t = titles.get(p.pid);
      if (t) {
        p.titleCn = t.cn;
        if (t.no) p.pidDisplay = t.no;
        if (t.cn) filled++;
      }
    }
    console.log(`  已补中文题名: ${filled}/${lcSlugs.length}`);
  }

  const out = {
    version: '1.0.0',
    builtAt: new Date().toISOString(),
    sources: withLc ? ['codeforces', 'leetcode'] : ['codeforces'],
    bands: BANDS,
    tags: TAGS,
    total: problems.length,
    problems
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 0), 'utf8');
  const kb = (fs.statSync(OUT_FILE).size / 1024).toFixed(1);
  console.log(`\n已生成: ${OUT_FILE}`);
  console.log(`  题目数: ${problems.length}   体积: ${kb} KB`);
})().catch((e) => {
  console.error('\n构建失败:', e.message);
  process.exit(1);
});
