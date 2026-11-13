/**
 * 题库索引生成器：把 learn 云函数的题库快照转成 agent 云函数可注入 AI 的紧凑索引
 *
 * 用法（在 jk-miniprogram 根目录执行）：
 *   node tools/build_algo_bank_index.js
 *
 * 数据来源：cloudfunctions/learn/data/{algo_problems.json, algo_curated.js}
 * 过滤规则：与 cloudfunctions/learn/handlers/algo.js 的 ACTIVE_PROBLEMS 一致
 *   （牛客精选 + LeetCode 白名单，学生端实际可见的题）
 * 输出：cloudfunctions/agent/data/algo_bank_index.js
 *
 * 题库更新后（learn/data 重新生成快照或精选增删）需要重新跑一次本脚本，
 * 然后重新部署 agent 云函数。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LEARN_DATA = path.join(ROOT, 'cloudfunctions', 'learn', 'data');
const OUT_FILE = path.join(ROOT, 'cloudfunctions', 'agent', 'data', 'algo_bank_index.js');

const RAW = require(path.join(LEARN_DATA, 'algo_problems.json'));
const CURATED = require(path.join(LEARN_DATA, 'algo_curated.js'));

// 与 learn/handlers/algo.js 保持一致：LeetCode 只取白名单，牛客取精选
const LC_ALLOW = new Set(CURATED.leetcodeIds);
const active = RAW.problems
  .filter((p) => p.source === 'leetcode' && LC_ALLOW.has(p.id))
  .concat(CURATED.problems);

// 按知识点排序输出（同类题聚在一起，模型读起来更顺），再按难度
const TAG_ORDER = [
  'simulation', 'sort', 'binary', 'prefix', 'twopointer', 'greedy', 'recursion',
  'dp', 'graph', 'tree', 'ds', 'string', 'search', 'math'
];
const BAND_ORDER = { entry: 0, basic: 1, improve: 2, advanced: 3, challenge: 4 };
const problems = active
  .map((p) => ({
    id: p.id,
    title: p.titleCn || p.title,
    titleEn: p.titleCn && p.title && p.titleCn !== p.title ? p.title : '',
    band: p.band,
    tags: p.tags || [],
    source: p.source
  }))
  .sort((a, b) => {
    const ta = Math.min(...a.tags.map((t) => TAG_ORDER.indexOf(t)).filter((x) => x >= 0), 99);
    const tb = Math.min(...b.tags.map((t) => TAG_ORDER.indexOf(t)).filter((x) => x >= 0), 99);
    if (ta !== tb) return ta - tb;
    return (BAND_ORDER[a.band] ?? 9) - (BAND_ORDER[b.band] ?? 9);
  });

const header = `/**
 * 题库紧凑索引（自动生成，勿手改）
 * 生成：node tools/build_algo_bank_index.js
 * 生成时间：${new Date().toISOString()}
 * 来源：cloudfunctions/learn/data/{algo_problems.json, algo_curated.js}
 * 用途：agent 云函数注入 AI 助手 system prompt，让模型认识真实题库
 */
`;

const body = `module.exports = {
  total: ${problems.length},
  problems: ${JSON.stringify(problems, null, 2).replace(/\n/g, '\n  ')}
};
`;

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, header + body, 'utf8');

console.log(`已生成 ${OUT_FILE}`);
console.log(`题数：${problems.length}（牛客 ${CURATED.problems.length} + LeetCode 白名单 ${CURATED.leetcodeIds.length}）`);
const size = Buffer.byteLength(header + body, 'utf8');
console.log(`文件大小：${size} 字节`);
