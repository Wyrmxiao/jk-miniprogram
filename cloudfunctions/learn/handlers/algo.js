/**
 * 算法训练域 · 业务处理器
 *
 * 题库（静态，随云函数部署）：
 *   data/algo_problems.json —— 820 题，构建脚本 tools/build_algo_problems.js
 * 数据库（ensure 自愈建表）：
 *   algo_records —— 打卡明细（题库标记 + 手动补记共用一张表）
 *   algo_stats   —— 聚合统计（每人一行，写入时增量更新）
 *
 * 设计要点：
 *   - 统计与明细分离，页面不扫描全表
 *   - 删除记录必须反向扣减统计，连续天数按 byDate 重算兜底
 *   - 题目完成状态不单独建表，直接以 algo_records.problemId 反查
 */
const cloud = require('wx-server-sdk');
const { badRequest, notFound, forbidden } = require('../utils/response');
const { ensure } = require('../utils/ensure');

const db = () => cloud.database();
const now = () => db().serverDate();
const _ = () => db().command;

/** 内置题库快照 */
const BANK = require('../data/algo_problems.json');
const BANK_INDEX = new Map(BANK.problems.map((p) => [p.id, p]));
const BAND_KEYS = BANK.bands.map((b) => b.key);

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

/** 模块页：14 知识点 × 5 档位矩阵 + 我的进度 */
async function algoProblemModules(params, ctx) {
  ctx.requireLogin();
  const doneMap = await myProblemRecords(ctx.openid);

  const modules = BANK.tags.map((t) => {
    const bands = {};
    let total = 0;
    let done = 0;
    for (const b of BANK.bands) {
      const list = CELLS.get(`${t.key}|${b.key}`) || [];
      const d = list.reduce((n, p) => n + (doneMap[p.id] ? 1 : 0), 0);
      bands[b.key] = { total: list.length, done: d };
      total += list.length;
      done += d;
    }
    return { key: t.key, name: t.name, bands, total, done };
  });

  return { modules, bands: BANK.bands, builtAt: BANK.builtAt };
}

/** 题单页：某知识点某档位的题目列表（带我的完成态） */
async function algoProblemList(params, ctx) {
  ctx.requireLogin();
  const { tag = '', band = '', page = 1, size = 50 } = params || {};
  const cell = CELLS.get(`${tag}|${band}`);
  if (!cell) throw badRequest('知识点或档位无效');

  const start = (page - 1) * size;
  const pageItems = cell.slice(start, start + size);
  const doneMap = await myProblemRecords(ctx.openid, pageItems.map((p) => p.id));

  const list = pageItems.map((p) => ({
    id: p.id,
    pid: p.pidDisplay || p.pid,
    title: p.title,
    titleCn: p.titleCn || '',
    source: p.source,
    rating: p.rating || 0,
    url: p.url,
    solved: p.solved || 0,
    done: !!doneMap[p.id]
  }));

  return {
    total: cell.length,
    page,
    size,
    list,
    tagName: (BANK.tags.find((t) => t.key === tag) || {}).name || tag,
    bandName: (BANK.bands.find((b) => b.key === band) || {}).name || band
  };
}

/** 题目详情 + 我的做题记录 */
async function algoProblemDetail(params, ctx) {
  ctx.requireLogin();
  const { id } = params || {};
  const p = BANK_INDEX.get(id);
  if (!p) throw notFound('题目不存在');

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
      rating: p.rating || 0,
      band: p.band,
      tags: p.tags || [],
      tagNames: (p.tags || []).map((k) => (BANK.tags.find((t) => t.key === k) || {}).name || k),
      url: p.url,
      solved: p.solved || 0
    },
    myRecords: mineRes.data,
    done: mineRes.data.length > 0
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
      platform: p.source === 'codeforces' ? 'Codeforces' : '力扣',
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
