/**
 * 算法训练域 · 业务处理器
 *
 * 题库（静态，随云函数部署）：
 *   data/algo_problems.json  —— 原始题库快照
 *   data/algo_content.json   —— 原始中文题面与题解内容包
 *   data/algo_curated.js     —— 学生端精选白名单与牛客题目；只上线有中文题面和逐题代码的题
 * 数据库（ensure 自愈建表）：
 *   algo_records          —— 打卡明细（题库标记 + 手动补记共用一张表）
 *   algo_stats            —— 聚合统计（每人一行，写入时增量更新）
 *   algo_favorites        —— 收藏 + 已掌握标志（每人对每题一行）
 *   algo_problem_comments —— 题目留言（讨论区）
 *
 * 设计要点：
 *   - 统计与明细分离，页面不扫描全表
 *   - 删除记录必须反向扣减统计，连续天数按 byDate 重算兜底
 *   - 题目完成状态不单独建表，直接以 algo_records.problemId 反查
 *   - 背题内容只读 → 静态 JSON；收藏/掌握/留言可写 → 数据库
 *   - 内容包体积较大，单独走 algoProblemContent 接口按需取单题，不塞进列表响应
 */
const cloud = require('wx-server-sdk');
const { badRequest, notFound, forbidden } = require('../utils/response');
const { ensure } = require('../utils/ensure');

const db = () => cloud.database();
const now = () => db().serverDate();
const _ = () => db().command;

/** 学生端只展示牛客 + LeetCode 中文精选题。 */
const RAW_BANK = require('../data/algo_problems.json');
const CURATED = require('../data/algo_curated');
const LC_ALLOW = new Set(CURATED.leetcodeIds);
const ACTIVE_PROBLEMS = RAW_BANK.problems
  .filter((p) => p.source === 'leetcode' && LC_ALLOW.has(p.id))
  .concat(CURATED.problems);
const ACTIVE_TAG_KEYS = new Set(ACTIVE_PROBLEMS.flatMap((p) => p.tags || []));
const BANK = {
  version: '2.0.0',
  builtAt: RAW_BANK.builtAt,
  sources: ['nowcoder', 'leetcode'],
  bands: [
    { key: 'entry', name: '简单' },
    { key: 'basic', name: '中等' },
    { key: 'improve', name: '困难' }
  ],
  tags: RAW_BANK.tags.filter((t) => ACTIVE_TAG_KEYS.has(t.key)),
  total: ACTIVE_PROBLEMS.length,
  problems: ACTIVE_PROBLEMS
};
const BANK_INDEX = new Map(BANK.problems.map((p) => [p.id, p]));
const BAND_KEYS = BANK.bands.map((b) => b.key);

function sourceName(source) {
  return source === 'nowcoder' ? '牛客网' : source === 'leetcode' ? 'LeetCode' : source;
}

/** 内容包：题面 + 解题过程（知识点单独一份，避免 820 题重复存讲解） */
let CONTENT = null;
let KNOWLEDGE = null;

function contentOf(id) {
  if (!CONTENT) {
    try {
      CONTENT = require('../data/algo_content.json');
    } catch (e) {
      console.error('algo_content.json 未部署', e);
      CONTENT = { items: {} };
    }
  }
  const base = (CONTENT.items || {})[id] || null;
  const override = (CURATED.content || {})[id] || null;
  if (!base) return override;
  if (!override) return base;
  return Object.assign({}, base, override, {
    meta: Object.assign({}, base.meta || {}, override.meta || {}),
    solution: override.solution || base.solution
  });
}

function knowledgeOf(refs) {
  if (!KNOWLEDGE) {
    try {
      KNOWLEDGE = require('../data/algo_knowledge.json').items || {};
    } catch (e) {
      console.error('algo_knowledge.json 未部署', e);
      KNOWLEDGE = {};
    }
  }
  return (refs || []).map((r) => {
    const k = KNOWLEDGE[r.key];
    if (!k) return { key: r.key, name: r.name, why: r.why || '', missing: true };
    return {
      key: r.key,
      name: k.name,
      intro: k.intro,
      signals: k.signals,
      steps: k.steps,
      code: k.code,
      pitfalls: k.pitfalls,
      complexity: k.complexity,
      related: k.related,
      why: r.why || ''
    };
  });
}

/** 按 (知识点 × 档位) 预分组，模块页与题单页共用 */
const CELLS = (() => {
  const m = new Map();
  for (const t of BANK.tags) {
    for (const b of BANK.bands) m.set(`${t.key}|${b.key}`, []);
  }
  for (const p of BANK.problems) {
    for (const tag of p.tags) {
      const arr = m.get(`${tag}|${p.band}`);
      if (arr) arr.push(p);
    }
  }
  // 低难度在前、同档热门优先
  for (const [, arr] of m) {
    arr.sort((a, b) => (a.rating || 9999) - (b.rating || 9999) || (b.solved || 0) - (a.solved || 0));
  }
  return m;
})();

/** 北京时间今天（云函数跑在 UTC，统计按中国时区算日） */
function bjDate(offsetDays = 0) {
  return new Date(Date.now() + 8 * 3600 * 1000 + offsetDays * 86400 * 1000)
    .toISOString()
    .slice(0, 10);
}

function isDateStr(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
}

/** 按个人 byDate 重算连续天数（唯一可靠兜底，写入/删除都调它） */
function calcStreak(byDate) {
  let d = byDate[bjDate()] ? bjDate() : bjDate(-1);
  if (!byDate[d]) return 0;
  let streak = 0;
  while (byDate[d]) {
    streak++;
    d = bjDate(-streak);
  }
  return streak;
}

/** 增量更新统计：delta = { total:+1|-1, passed, tags, diff, date } */
async function applyStats(openid, delta) {
  await ensure('algo_stats');
  const col = db().collection('algo_stats');
  const res = await col.where({ openid }).limit(1).get();

  let stats = res.data[0];
  const isNew = !stats;
  if (isNew) {
    stats = {
      openid,
      total: 0,
      passed: 0,
      byTag: {},
      byDiff: {},
      byDate: {},
      streak: 0,
      goal: null,
      createdAt: now(),
      updatedAt: now()
    };
  }

  const total = Math.max(0, (stats.total || 0) + delta.total);
  const passed = Math.max(0, (stats.passed || 0) + (delta.passed ? delta.total : 0));

  const byTag = Object.assign({}, stats.byTag || {});
  for (const t of delta.tags || []) {
    const v = (byTag[t] || 0) + delta.total;
    if (v > 0) byTag[t] = v;
    else delete byTag[t];
  }

  const byDiff = Object.assign({}, stats.byDiff || {});
  if (delta.diff) {
    const v = (byDiff[delta.diff] || 0) + delta.total;
    if (v > 0) byDiff[delta.diff] = v;
    else delete byDiff[delta.diff];
  }

  const byDate = Object.assign({}, stats.byDate || {});
  if (delta.date) {
    const v = (byDate[delta.date] || 0) + delta.total;
    if (v > 0) byDate[delta.date] = v;
    else delete byDate[delta.date];
  }

  const data = {
    total,
    passed,
    byTag,
    byDiff,
    byDate,
    streak: calcStreak(byDate),
    updatedAt: now()
  };

  if (isNew) {
    await col.add({ data: Object.assign({ openid }, data) });
  } else {
    await col.doc(stats._id).update({ data });
  }
  return data;
}

/** 记录可见性：学生只看自己，教师可看全部或指定学生 */
function recordWhere(params, ctx) {
  const { openid = '' } = params || {};
  const where = {};
  if (ctx.isTeacher) {
    if (openid) where.openid = openid;
  } else {
    where.openid = ctx.openid;
  }
  return where;
}

/** 我的 problemId -> 记录 映射（题库进度/完成态共用） */
async function myProblemRecords(openid, ids = null) {
  await ensure('algo_records');
  const _c = _();
  const where = { openid, problemId: _c.neq('') };
  if (ids && ids.length) where.problemId = _c.in(ids);
  const res = await db()
    .collection('algo_records')
    .where(where)
    .field({ problemId: true, passed: true, note: true, date: true, teacherComment: true })
    .limit(1000)
    .get();
  const map = {};
  for (const r of res.data) map[r.problemId] = r;
  return map;
}

/* ============================================================
 * 题库（静态数据 + 完成态合并）
 * ============================================================ */

/** 题库首页：平台、难度、知识点三维统计 + 下一道未完成题 */
async function algoProblemModules(params, ctx) {
  ctx.requireLogin();
  const { source = '' } = params || {};
  if (source && !BANK.sources.includes(source)) throw badRequest('平台无效');
  const doneMap = await myProblemRecords(ctx.openid);
  const sourceProblems = source ? BANK.problems.filter((p) => p.source === source) : BANK.problems;

  const modules = BANK.tags.map((t) => {
    const bands = {};
    let total = 0;
    let done = 0;
    for (const b of BANK.bands) {
      const list = (CELLS.get(`${t.key}|${b.key}`) || []).filter((p) => !source || p.source === source);
      const d = list.reduce((n, p) => n + (doneMap[p.id] ? 1 : 0), 0);
      bands[b.key] = { total: list.length, done: d };
      total += list.length;
      done += d;
    }
    return { key: t.key, name: t.name, bands, total, done };
  });

  const platforms = BANK.sources.map((key) => {
    const list = BANK.problems.filter((p) => p.source === key);
    return {
      key,
      name: sourceName(key),
      total: list.length,
      done: list.reduce((n, p) => n + (doneMap[p.id] ? 1 : 0), 0)
    };
  });
  const difficulties = BANK.bands.map((b) => {
    const list = sourceProblems.filter((p) => p.band === b.key);
    return {
      key: b.key,
      name: b.name,
      total: list.length,
      done: list.reduce((n, p) => n + (doneMap[p.id] ? 1 : 0), 0)
    };
  });
  const next = sourceProblems.find((p) => !doneMap[p.id]) || null;
  return {
    modules,
    platforms,
    difficulties,
    total: sourceProblems.length,
    done: sourceProblems.reduce((n, p) => n + (doneMap[p.id] ? 1 : 0), 0),
    next: next ? {
      id: next.id,
      pid: next.pidDisplay || next.pid,
      title: next.titleCn || next.title,
      source: next.source,
      sourceName: sourceName(next.source),
      band: next.band,
      bandName: (BANK.bands.find((b) => b.key === next.band) || {}).name || next.band
    } : null,
    bands: BANK.bands,
    builtAt: BANK.builtAt
  };
}

/** 题单页：按平台 / 知识点 / 难度 / 关键词 / 完成状态组合筛选。 */
async function algoProblemList(params, ctx) {
  ctx.requireLogin();
  const {
    tag = '', band = '', source = '', keyword = '', status = '', page = 1, size = 50
  } = params || {};
  if (tag && !BANK.tags.some((t) => t.key === tag)) throw badRequest('知识点无效');
  if (band && !BAND_KEYS.includes(band)) throw badRequest('难度无效');
  if (source && !BANK.sources.includes(source)) throw badRequest('平台无效');

  const kw = String(keyword || '').trim().toLowerCase();
  let filtered = BANK.problems.filter((p) =>
    (!tag || (p.tags || []).includes(tag)) &&
    (!band || p.band === band) &&
    (!source || p.source === source) &&
    (!kw || [p.pidDisplay || p.pid, p.title, p.titleCn]
      .some((v) => String(v || '').toLowerCase().includes(kw)))
  );
  const allDoneMap = await myProblemRecords(ctx.openid, filtered.map((p) => p.id));
  if (status === 'done') filtered = filtered.filter((p) => allDoneMap[p.id]);
  if (status === 'todo') filtered = filtered.filter((p) => !allDoneMap[p.id]);

  const start = (page - 1) * size;
  const pageItems = filtered.slice(start, start + size);

  const list = pageItems.map((p) => ({
    id: p.id,
    pid: p.pidDisplay || p.pid,
    title: p.title,
    titleCn: p.titleCn || '',
    source: p.source,
    sourceName: sourceName(p.source),
    rating: p.rating || 0,
    band: p.band,
    bandName: (BANK.bands.find((b) => b.key === p.band) || {}).name || p.band,
    tags: p.tags || [],
    tagNames: (p.tags || []).map((k) => (BANK.tags.find((t) => t.key === k) || {}).name || k),
    url: p.url,
    solved: p.solved || 0,
    done: !!allDoneMap[p.id]
  }));

  return {
    total: filtered.length,
    page,
    size,
    list,
    tagName: tag ? ((BANK.tags.find((t) => t.key === tag) || {}).name || tag) : '全部知识点',
    bandName: band ? ((BANK.bands.find((b) => b.key === band) || {}).name || band) : '全部难度',
    sourceName: source ? sourceName(source) : '全部平台'
  };
}

/** 题目详情 + 我的做题记录 */
async function algoProblemDetail(params, ctx) {
  ctx.requireLogin();
  const { id } = params || {};
  const p = BANK_INDEX.get(id);
  if (!p) throw notFound('题目不存在');

  const c = contentOf(id);

  const mineRes = await db()
    .collection('algo_records')
    .where({ openid: ctx.openid, problemId: id })
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  return {
    problem: {
      id: p.id,
      pid: p.pidDisplay || p.pid,
      title: p.title,
      titleCn: p.titleCn || '',
      source: p.source,
      sourceName: sourceName(p.source),
      rating: p.rating || 0,
      band: p.band,
      bandName: (BANK.bands.find((b) => b.key === p.band) || {}).name || p.band,
      tags: p.tags || [],
      tagNames: (p.tags || []).map((k) => (BANK.tags.find((t) => t.key === k) || {}).name || k),
      url: p.url,
      solved: p.solved || 0,
      // 内容可用性：前端据此决定是否显示「查看题面与解析」入口
      hasContent: !!(c && c.statementHtml && c.solution && c.solution.code),
      solutionType: c && c.solution ? c.solution.type : ''
    },
    myRecords: mineRes.data,
    done: mineRes.data.length > 0
  };
}

/**
 * 题目内容（完整题面 + 解题过程 + 涉及的知识点）
 *
 * 单独接口的原因：一题题面 HTML 常有 2-6KB，列表页与详情页首屏都不该背这个体积。
 * 学生点「查看题面与解析」时才请求，且内容只读、静态，天然适合缓存。
 *
 * params: { id, sections? }
 *   sections 可选，用于只取部分内容（'statement' | 'solution' | 'knowledge'），
 *   默认全量返回。背题模式下可先只取 statement，点开再看 solution。
 */
async function algoProblemContent(params, ctx) {
  ctx.requireLogin();
  const { id, sections } = params || {};
  const p = BANK_INDEX.get(id);
  if (!p) throw notFound('题目不存在');

  const c = contentOf(id);
  if (!c) {
    return {
      id,
      available: false,
      statementHtml: '',
      knowledge: knowledgeOf((p.tags || []).map((key) => ({
        key,
        name: (BANK.tags.find((t) => t.key === key) || {}).name || key
      }))),
      solution: null,
      meta: {}
    };
  }

  const want = (s) => !sections || !Array.isArray(sections) || sections.includes(s);
  return {
    id,
    available: !!c.statementHtml,
    statementHtml: want('statement') ? c.statementHtml : '',
    knowledge: want('knowledge') ? knowledgeOf(c.knowledgeRefs) : [],
    solution: want('solution') ? c.solution : null,
    meta: want('statement') ? c.meta : {},
    title: c.title,
    titleEn: c.titleEn,
    source: c.source,
    sourceName: sourceName(c.source || p.source),
    pid: c.pid,
    rating: c.rating,
    band: c.band
  };
}

/** 标记通过（幂等：同一题只记一次） */
async function algoMarkProblem(params, ctx) {
  ctx.requireLogin();
  const { problemId = '', note = '' } = params || {};
  const p = BANK_INDEX.get(problemId);
  if (!p) throw notFound('题目不存在');

  await ensure('algo_records');
  const col = db().collection('algo_records');
  const exist = await col.where({ openid: ctx.openid, problemId }).limit(1).get();
  if (exist.data.length) return { id: exist.data[0]._id, already: true };

  const res = await col.add({
    data: {
      openid: ctx.openid,
      problemId,
      title: p.titleCn || p.title,
      titleEn: p.title,
      platform: sourceName(p.source),
      pid: p.pidDisplay || p.pid,
      difficulty: p.band,
      rating: p.rating || 0,
      tags: p.tags || [],
      passed: true,
      url: p.url,
      note: String(note || '').trim(),
      studentName: (ctx.user && ctx.user.realName) || '',
      teacherComment: '',
      commentBy: '',
      date: bjDate(),
      createdAt: now(),
      updatedAt: now()
    }
  });

  await applyStats(ctx.openid, {
    total: 1,
    passed: true,
    tags: p.tags || [],
    diff: p.band,
    date: bjDate()
  });

  return { id: res._id, already: false };
}

/* ============================================================
 * 手动打卡（补记外站题）与记录管理
 * ============================================================ */

/** 手动打卡：洛谷/牛客等题库外的题 */
async function algoCheckIn(params, ctx) {
  ctx.requireLogin();
  const {
    title,
    platform = '',
    difficulty = '',
    tags = [],
    passed = true,
    url = '',
    note = '',
    date = ''
  } = params || {};
  if (!title) throw badRequest('请填写题名');
  if (!BAND_KEYS.includes(difficulty)) throw badRequest('请选择难度档位');

  let d = isDateStr(date) ? date : bjDate();
  if (d > bjDate()) throw badRequest('不能选择未来的日期');
  if (d < bjDate(-30)) throw badRequest('最多回补 30 天内的记录');

  const validTags = Array.isArray(tags) ? tags.filter((t) => BANK.tags.some((x) => x.key === t)) : [];

  await ensure('algo_records');
  const res = await db()
    .collection('algo_records')
    .add({
      data: {
        openid: ctx.openid,
        problemId: '',
        title: String(title).trim(),
        titleEn: '',
        platform: String(platform || '').trim() || '其他',
        pid: '',
        difficulty,
        rating: 0,
        tags: validTags,
        passed: !!passed,
        url: String(url || '').trim(),
        note: String(note || '').trim(),
        studentName: (ctx.user && ctx.user.realName) || '',
        teacherComment: '',
        commentBy: '',
        date: d,
        createdAt: now(),
        updatedAt: now()
      }
    });

  await applyStats(ctx.openid, {
    total: 1,
    passed: !!passed,
    tags: validTags,
    diff: difficulty,
    date: d
  });

  return { id: res._id };
}

/** 记录列表：学生看自己，教师看全部/指定学生；支持标签/难度/通过状态筛选 */
async function algoRecords(params, ctx) {
  ctx.requireLogin();
  const { page = 1, size = 20, tag = '', difficulty = '', passed = '', from = '', to = '' } =
    params || {};

  await ensure('algo_records');
  const where = recordWhere(params, ctx);
  if (tag) where.tags = tag;
  if (BAND_KEYS.includes(difficulty)) where.difficulty = difficulty;
  if (passed === 'yes' || passed === 'no') where.passed = passed === 'yes';
  if (isDateStr(from) || isDateStr(to)) {
    const _c = _();
    where.date = {};
    if (isDateStr(from)) where.date = _c.gte(from);
    if (isDateStr(to)) {
      where.date = isDateStr(from)
        ? _c.and([_c.gte(from), _c.lte(to)])
        : _c.lte(to);
    }
  }

  const col = db().collection('algo_records');
  const countRes = await col.where(where).count();
  const listRes = await col
    .where(where)
    .orderBy('date', 'desc')
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * size)
    .limit(size)
    .get();

  return { total: countRes.total, list: listRes.data, page, size };
}

/** 记录详情（本人或教师） */
async function algoRecordDetail(params, ctx) {
  ctx.requireLogin();
  const { id } = params || {};
  if (!id) throw badRequest('缺少记录 ID');

  const res = await db().collection('algo_records').doc(id).get();
  if (!res.data) throw notFound('记录不存在');
  if (res.data.openid !== ctx.openid && !ctx.isTeacher) throw forbidden('无权查看');

  // 题库题补全信息
  const p = BANK_INDEX.get(res.data.problemId);
  if (p) {
    res.data.problemInfo = {
      id: p.id,
      pid: p.pidDisplay || p.pid,
      title: p.title,
      titleCn: p.titleCn || '',
      url: p.url,
      rating: p.rating || 0
    };
  }
  return res.data;
}

/** 删除记录：本人或管理员；同步反向扣减统计 */
async function algoRemove(params, ctx) {
  ctx.requireLogin();
  const { id } = params || {};
  if (!id) throw badRequest('缺少记录 ID');

  const res = await db().collection('algo_records').doc(id).get();
  if (!res.data) throw notFound('记录不存在');
  if (res.data.openid !== ctx.openid && !ctx.isAdmin) throw forbidden('无权删除');

  await db().collection('algo_records').doc(id).remove();

  await applyStats(res.data.openid, {
    total: -1,
    passed: !!res.data.passed,
    tags: res.data.tags || [],
    diff: res.data.difficulty || '',
    date: res.data.date || ''
  });

  return { id };
}

/** 更新我的做题备注 */
async function algoUpdateNote(params, ctx) {
  ctx.requireLogin();
  const { id, note = '' } = params || {};
  if (!id) throw badRequest('缺少记录 ID');

  const res = await db().collection('algo_records').doc(id).get();
  if (!res.data) throw notFound('记录不存在');
  if (res.data.openid !== ctx.openid) throw forbidden('无权修改');

  await db()
    .collection('algo_records')
    .doc(id)
    .update({ data: { note: String(note).trim(), updatedAt: now() } });
  return { id };
}

/** 教师评语 */
async function algoComment(params, ctx) {
  ctx.requireRole('teacher', 'admin');
  const { id, comment } = params || {};
  if (!id) throw badRequest('缺少记录 ID');

  await db()
    .collection('algo_records')
    .doc(id)
    .update({
      data: {
        teacherComment: String(comment || '').trim(),
        commentBy: (ctx.user && ctx.user.realName) || '老师',
        commentedAt: now(),
        updatedAt: now()
      }
    });
  return { id };
}

/* ============================================================
 * 统计与教师总览
 * ============================================================ */

/** 我的（或指定学生的）统计 */
async function algoStats(params, ctx) {
  ctx.requireLogin();
  const { openid = '' } = params || {};
  const target = ctx.isTeacher && openid ? openid : ctx.openid;

  await ensure('algo_stats');
  const res = await db().collection('algo_stats').where({ openid: target }).limit(1).get();
  const stats = res.data[0] || {
    openid: target,
    total: 0,
    passed: 0,
    byTag: {},
    byDiff: {},
    byDate: {},
    streak: 0,
    goal: null
  };

  // 教师查学生时补姓名
  if (ctx.isTeacher && target !== ctx.openid) {
    const u = await db().collection('users').where({ openid: target }).limit(1).get();
    stats.displayName = (u.data[0] && u.data[0].realName) || '学生';
  }

  // 目标赛事名补全
  if (stats.goal && stats.goal.contestId) {
    try {
      const c = await db()
        .collection('competitions')
        .doc(stats.goal.contestId)
        .get()
        .catch(() => null);
      if (c && c.data) stats.goal.contestName = c.data.name;
    } catch (e) {
      /* 赛事可能已删除，忽略 */
    }
  }

  return stats;
}

/** 设置备赛目标 */
async function algoSetGoal(params, ctx) {
  ctx.requireLogin();
  const { contestId = '', targetCount = 0, deadline = '' } = params || {};

  const goal =
    contestId && targetCount > 0
      ? {
          contestId,
          targetCount: Math.min(2000, Math.max(1, parseInt(targetCount, 10) || 0)),
          deadline: isDateStr(deadline) ? deadline : ''
        }
      : null;

  await ensure('algo_stats');
  const res = await db().collection('algo_stats').where({ openid: ctx.openid }).limit(1).get();
  if (res.data.length) {
    await db()
      .collection('algo_stats')
      .doc(res.data[0]._id)
      .update({ data: { goal, updatedAt: now() } });
  } else {
    await db().collection('algo_stats').add({
      data: {
        openid: ctx.openid,
        total: 0,
        passed: 0,
        byTag: {},
        byDiff: {},
        byDate: {},
        streak: 0,
        goal,
        createdAt: now(),
        updatedAt: now()
      }
    });
  }
  return { goal };
}

/** 教师总览：全班训练量（algo_stats 一次查回，users 补姓名，避免 N+1） */
async function algoTeacherOverview(params, ctx) {
  ctx.requireRole('teacher', 'admin');
  const { page = 1, size = 50 } = params || {};

  await ensure('algo_stats');
  const statsRes = await db()
    .collection('algo_stats')
    .orderBy('updatedAt', 'desc')
    .skip((page - 1) * size)
    .limit(size)
    .get();

  const openids = statsRes.data.map((s) => s.openid).filter(Boolean);
  let nameMap = {};
  if (openids.length) {
    const u = await db()
      .collection('users')
      .where({ openid: _().in(openids) })
      .field({ openid: true, realName: true, studentNo: true, role: true })
      .limit(200)
      .get();
    nameMap = u.data.reduce((acc, x) => {
      acc[x.openid] = x;
      return acc;
    }, {});
  }

  const list = statsRes.data.map((s) => {
    const u = nameMap[s.openid] || {};
    return {
      openid: s.openid,
      displayName: u.realName || '未认证用户',
      studentNo: u.studentNo || '',
      role: u.role || 'guest',
      total: s.total || 0,
      passed: s.passed || 0,
      passRate: s.total ? Math.round(((s.passed || 0) / s.total) * 100) : 0,
      streak: s.streak || 0,
      byTag: s.byTag || {},
      goal: s.goal || null,
      updatedAt: s.updatedAt
    };
  });

  return { total: statsRes.data.length, list, page, size };
}

/** 管理员兜底：按明细全量重算某人的统计 */
async function algoRecalc(params, ctx) {
  ctx.requireRole('admin');
  const { openid = '' } = params || {};
  const target = openid || ctx.openid;

  await ensure('algo_records');
  const col = db().collection('algo_records');
  const all = [];
  let skip = 0;
  for (;;) {
    const res = await col
      .where({ openid: target })
      .field({ tags: true, difficulty: true, passed: true, date: true })
      .skip(skip)
      .limit(1000)
      .get();
    all.push(...res.data);
    if (res.data.length < 1000) break;
    skip += 1000;
  }

  const byTag = {};
  const byDiff = {};
  const byDate = {};
  let passed = 0;
  for (const r of all) {
    for (const t of r.tags || []) byTag[t] = (byTag[t] || 0) + 1;
    if (r.difficulty) byDiff[r.difficulty] = (byDiff[r.difficulty] || 0) + 1;
    if (r.date) byDate[r.date] = (byDate[r.date] || 0) + 1;
    if (r.passed) passed++;
  }

  await ensure('algo_stats');
  const exist = await db().collection('algo_stats').where({ openid: target }).limit(1).get();
  const data = {
    total: all.length,
    passed,
    byTag,
    byDiff,
    byDate,
    streak: calcStreak(byDate),
    updatedAt: now()
  };
  if (exist.data.length) {
    await db().collection('algo_stats').doc(exist.data[0]._id).update({ data });
  } else {
    await db()
      .collection('algo_stats')
      .add({ data: Object.assign({ openid: target, goal: null, createdAt: now() }, data) });
  }
  return data;
}

module.exports = {
  algoProblemModules,
  algoProblemList,
  algoProblemDetail,
  algoProblemContent,
  algoMarkProblem,
  algoCheckIn,
  algoRecords,
  algoRecordDetail,
  algoRemove,
  algoUpdateNote,
  algoComment,
  algoStats,
  algoSetGoal,
  algoTeacherOverview,
  algoRecalc
};
