/**
 * 题库内容构建器：把 题面 + 知识点 + 精讲 合并成随云函数部署的静态数据
 *
 * 用法：node tools/build_algo_content.js
 *
 * 输入：
 *   cloudfunctions/learn/data/algo_problems.json        题目元数据（820 题）
 *   tools/.algo_lc_stmt_cache.json                     LC 中文题面（115 条）
 *   tools/.cf_stmt_cache.json                          CF 题面（约 696 条）
 *   tools/algo_knowledge.js                            14 个知识点完整讲解
 *   tools/algo_editorials.js                           20 道精讲（逐题手写）
 *
 * 输出：
 *   cloudfunctions/learn/data/algo_content.json      按题 id 索引的题面 + 解题过程
 *   cloudfunctions/learn/data/algo_knowledge.json   14 个知识点完整讲解（单独一份）
 *
 * 设计要点：
 *   1. 静态 JSON 随云函数部署，零 DB 查询（与 algo_problems.json 一致）
 *   2. 知识点只存一份，题里只存 tag key + 本题说明（why）。
 *      实测：把完整讲解塞进每题会让内容包从 ~2MB 涨到 6MB，纯冗余。
 *      云函数返回时按 tags 组装完整知识点。
 *   3. 三类内容严格区分，前端要据此显示不同标签，不能拿框架冒充题解：
 *      - editorial  逐题手写精讲（有 steps / code / codeNotes / trap）
 *      - framework  按知识点生成的通用解题步骤（明确标注，无代码）
 *      - 两者都一定带 knowledge[]，即「涉及的知识点」完整讲解
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'cloudfunctions/learn/data');
const BANK = JSON.parse(fs.readFileSync(path.join(DATA, 'algo_problems.json'), 'utf8'));
const KNOWLEDGE = require('./algo_knowledge');
const EDITORIALS = require('./algo_editorials');

const LC_STMT = path.join(__dirname, '.algo_lc_stmt_cache.json');
const CF_STMT = path.join(__dirname, '.cf_stmt_cache.json');
const OUT = path.join(DATA, 'algo_content.json');
const OUT_KNOWLEDGE = path.join(DATA, 'algo_knowledge.json');

const lcCache = fs.existsSync(LC_STMT) ? JSON.parse(fs.readFileSync(LC_STMT, 'utf8')) : {};
const cfCache = fs.existsSync(CF_STMT) ? JSON.parse(fs.readFileSync(CF_STMT, 'utf8')) : {};

/* ---------- LC 题面清洗（rich-text 兼容，复用 gen_editorials.js 的规则） ---------- */

function escText(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function cleanLc(html) {
  if (!html) return '';
  let h = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '');

  h = h.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (m, inner) => {
    let t = inner
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li)>/gi, '\n')
      .replace(/<[^>]+>/g, '');
    t = t
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
    const lines = t.split('\n').map((l) => escText(l.replace(/\t/g, '    ')).replace(/ /g, '&nbsp;'));
    while (lines.length && !lines[lines.length - 1]) lines.pop();
    return (
      '<div style="font-family:Menlo,Consolas,monospace;font-size:12px;line-height:1.7;' +
      'background:rgba(107,140,163,0.08);border-radius:10px;padding:12px;color:#4a4640;' +
      'margin:8px 0;white-space:nowrap;overflow-x:auto">' + lines.join('<br/>') + '</div>'
    );
  });

  h = h.replace(/<sup[^>]*>([\s\S]*?)<\/sup>/gi, '^$1');
  h = h.replace(/<sub[^>]*>([\s\S]*?)<\/sub>/gi, '_$1');
  h = h.replace(/\sstyle="[^"]*"/gi, '').replace(/\sclass="[^"]*"/gi, '');
  return h.trim();
}

/* ---------- 知识点引用：题里只存 key + 本题为什么用到它 ---------- */

function buildKnowledgeRefs(problem, editorial) {
  const whyMap = editorial
    ? Object.fromEntries((editorial.knowledge || []).map((k) => [k.key, k.why]))
    : {};
  return (problem.tags || []).map((key) => ({
    key,
    name: (KNOWLEDGE[key] && KNOWLEDGE[key].name) || key,
    // 精讲题才有「本题为什么用到它」；框架题留空，前端据此决定是否显示
    why: whyMap[key] || ''
  }));
}

/* ---------- 通用解题框架（未精讲的题） ---------- */

function buildFramework(problem, refs, editorial) {
  // 选主知识点：标签里第一个有讲解的
  const main = refs.find((r) => KNOWLEDGE[r.key]) || refs[0];
  const K = main && KNOWLEDGE[main.key];
  const steps = K ? K.steps : [];
  return {
    type: 'framework',
    mainTag: main ? main.key : '',
    mainName: main ? main.name : '',
    steps: [
      `先读题，确认数据规模（本题难度 ${problem.rating || '未知'}，档位 ${problem.band}）。`,
      ...steps
    ],
    note: '这是按本题知识点给出的通用解题步骤，不是本题的逐题题解。逐题精讲会持续补充。'
  };
}

/* ---------- 主流程 ---------- */

function run() {
  const items = {};
  const stat = { total: 0, withStatement: 0, editorial: 0, framework: 0, noStatement: 0 };
  const missingStatements = [];

  for (const p of BANK.problems) {
    stat.total++;
    let statementHtml = '';
    let meta = {};

    if (p.source === 'leetcode') {
      const c = lcCache[p.pid];
      if (c && c.statement) {
        statementHtml = cleanLc(c.statement);
        meta.difficulty = { Easy: '简单', Medium: '中等', Hard: '困难' }[c.difficulty] || c.difficulty || '';
      }
    } else {
      const c = cfCache[p.pid];
      if (c && c.statementHtml) {
        statementHtml = c.statementHtml;
        meta.timeLimit = c.timeLimit || '';
        meta.memoryLimit = c.memoryLimit || '';
      }
    }

    if (statementHtml) stat.withStatement++;
    else {
      stat.noStatement++;
      if (missingStatements.length < 20) missingStatements.push(p.id);
    }

    const editorial = EDITORIALS[p.id];
    const refs = buildKnowledgeRefs(p, editorial);

    let solution;
    if (editorial) {
      stat.editorial++;
      solution = {
        type: 'editorial',
        insight: editorial.insight,
        steps: editorial.steps,
        code: editorial.code,
        codeNotes: editorial.codeNotes,
        complexity: editorial.complexity,
        trap: editorial.trap
      };
    } else {
      stat.framework++;
      solution = buildFramework(p, refs, editorial);
    }

    items[p.id] = {
      title: p.titleCn || p.title,
      titleEn: p.title,
      source: p.source,
      pid: p.pidDisplay || p.pid,
      rating: p.rating || 0,
      band: p.band,
      tags: p.tags || [],
      statementHtml,
      meta,
      knowledgeRefs: refs,
      solution
    };
  }

  const out = {
    version: '1.0.0',
    builtAt: new Date().toISOString(),
    knowledgeCount: Object.keys(KNOWLEDGE).length,
    stat,
    items
  };

  // 知识点单独一份：完整讲解只存一次，云函数按 tags 组装
  const knowledgeOut = {
    version: '1.0.0',
    builtAt: out.builtAt,
    count: Object.keys(KNOWLEDGE).length,
    items: KNOWLEDGE
  };

  fs.writeFileSync(OUT, JSON.stringify(out));
  fs.writeFileSync(OUT_KNOWLEDGE, JSON.stringify(knowledgeOut));
  const size = (fs.statSync(OUT).size / 1024).toFixed(0);
  const ksize = (fs.statSync(OUT_KNOWLEDGE).size / 1024).toFixed(0);
  console.log('=== 题库内容构建完成 ===');
  console.log('题目总数:', stat.total);
  console.log('有完整题面:', stat.withStatement, '| 缺题面:', stat.noStatement);
  console.log('逐题精讲:', stat.editorial, '| 通用框架:', stat.framework);
  console.log('知识点:', out.knowledgeCount);
  console.log('输出:', OUT, `(${size}KB)`, '|', OUT_KNOWLEDGE, `(${ksize}KB)`);
  console.log('合计:', (Number(size) + Number(ksize)).toFixed(0) + 'KB');
  if (missingStatements.length) console.log('缺题面样例:', missingStatements.join(', '));
}

run();
