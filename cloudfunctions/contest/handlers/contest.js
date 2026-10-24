/**
 * 竞赛域 · 业务处理器
 * 数据来源：学校《学生学科竞赛管理办法（修订）》附件1（A类）与附件2（B类）
 */
const cloud = require('wx-server-sdk');
const { badRequest, forbidden, notFound } = require('../utils/response');
const seed = require('../data/competitions.seed.json');

const db = () => cloud.database();
const now = () => db().serverDate();
const _ = () => db().command;

/** 竞赛列表：支持级别、学科分类、方向、承办单位、关键词筛选 */
async function list(params, ctx) {
  const {
    level = '',
    category = '',
    direction = '',
    host = '',
    keyword = '',
    focusOnly = false,
    page = 1,
    size = 20
  } = params || {};

  const where = { deleted: false, status: 'published' };
  if (level) where.level = level;
  if (category) where.category = category;
  if (direction) where.directions = direction;
  if (host) where.host = host;
  if (focusOnly) where.isFocus = true;
  if (keyword) {
    where.name = db().RegExp({ regexp: String(keyword).trim(), options: 'i' });
  }

  const col = db().collection('competitions');
  const countRes = await col.where(where).count();

  // 数据量小（百级），取回后内存排序：
  // 1) 有确切时间（报名截止/开赛）→ 按最近时间升序
  // 2) 仅有惯例月份 → 按下一次该月份的时间升序
  // 3) 无时间信息 → 按级别 + 编号排后
  const listRes = await col.where(where).limit(1000).get();
  const nowDate = new Date();
  const timeOf = (c) => {
    if (c.regEnd) {
      const d = new Date(c.regEnd);
      if (!isNaN(d.getTime())) return d;
    }
    if (c.contestDate) {
      const d = new Date(c.contestDate);
      if (!isNaN(d.getTime())) return d;
    }
    if (Array.isArray(c.typicalMonths) && c.typicalMonths.length) {
      const m = nowDate.getMonth() + 1;
      const ms = [...c.typicalMonths].sort((a, b) => a - b);
      const next = ms.find((x) => x >= m) || ms[0];
      const year = next >= m ? nowDate.getFullYear() : nowDate.getFullYear() + 1;
      return new Date(year, next - 1, 1);
    }
    return null;
  };

  const all = listRes.data.map((c) => Object.assign({}, c, { _time: timeOf(c) }));
  all.sort((a, b) => {
    if (a._time && b._time) return a._time - b._time;
    if (a._time) return -1;
    if (b._time) return 1;
    const lv = String(a.level || 'Z').localeCompare(String(b.level || 'Z'));
    if (lv) return lv;
    return (a.serialNo || 0) - (b.serialNo || 0);
  });

  const list = all
    .slice((page - 1) * size, page * size)
    .map((c) => {
      const o = Object.assign({}, c);
      delete o._time;
      return o;
    });

  return { total: countRes.total, list, page, size };
}

/** 竞赛详情 */
async function detail(params, ctx) {
  const { id } = params || {};
  if (!id) throw badRequest('缺少竞赛 ID');

  const res = await db().collection('competitions').doc(id).get();
  if (!res.data) throw notFound('竞赛不存在');

  // 是否已关注
  let mine = null;
  if (ctx.user) {
    const mineRes = await db()
      .collection('my_contests')
      .where({ openid: ctx.openid, competitionId: id })
      .limit(1)
      .get();
    mine = mineRes.data[0] || null;
  }

  // 关联公告
  const annoRes = await db()
    .collection('announcements')
    .where({ competitionId: id, status: 'published' })
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  return Object.assign({}, res.data, { mine, announcements: annoRes.data });
}

/** 筛选项：级别、学科分类、承办单位 */
async function categories(params, ctx) {
  const res = await db()
    .collection('competitions')
    .where({ deleted: false })
    .limit(1000)
    .get();

  const hosts = Array.from(new Set(res.data.map((c) => c.host).filter(Boolean))).sort();
  const levels = [
    { key: 'A', text: 'A类·国家级榜单' },
    { key: 'B', text: 'B类·省部级/赛区' },
    { key: 'C', text: 'C类·省市及以上' },
    { key: 'D', text: 'D类·校级' }
  ];
  const categories = [
    { key: 'hardware', text: '理工类（硬件类）' },
    { key: 'scienceOther', text: '理工类（其他类）' },
    { key: 'humanity', text: '人文社科类' }
  ];
  const directions = [
    { key: 'frontend', text: '前端开发' },
    { key: 'backend', text: '后端开发' },
    { key: 'algorithm', text: '算法竞赛' },
    { key: 'ai', text: '人工智能' },
    { key: 'security', text: '网络安全' },
    { key: 'embedded', text: '嵌入式/硬件' }
  ];

  return { levels, categories, directions, hosts, total: res.data.length };
}

/** 我的竞赛列表 */
async function myList(params, ctx) {
  ctx.requireLogin();
  const { status = '', page = 1, size = 20 } = params || {};

  const where = { openid: ctx.openid };
  if (status) where.status = status;

  const col = db().collection('my_contests');
  const countRes = await col.where(where).count();
  const listRes = await col
    .where(where)
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * size)
    .limit(size)
    .get();

  // 补全竞赛信息
  const ids = listRes.data.map((m) => m.competitionId).filter(Boolean);
  let compMap = {};
  if (ids.length) {
    const compRes = await db()
      .collection('competitions')
      .where({ _id: _().in(ids) })
      .limit(100)
      .get();
    compMap = compRes.data.reduce((acc, c) => {
      acc[c._id] = c;
      return acc;
    }, {});
  }

  const list = listRes.data.map((m) => Object.assign({}, m, { competition: compMap[m.competitionId] || null }));
  return { total: countRes.total, list, page, size };
}

/** 关注 / 取消关注竞赛 */
async function follow(params, ctx) {
  ctx.requireLogin();
  const { competitionId, follow = true } = params || {};
  if (!competitionId) throw badRequest('缺少竞赛 ID');

  const col = db().collection('my_contests');
  const exist = await col.where({ openid: ctx.openid, competitionId }).limit(1).get();

  if (!follow) {
    if (exist.data.length) await col.doc(exist.data[0]._id).remove();
    return { following: false };
  }

  if (exist.data.length) return { following: true, id: exist.data[0]._id };

  const res = await col.add({
    data: {
      openid: ctx.openid,
      competitionId,
      status: 'watch',
      progress: '',
      result: '',
      createdAt: now(),
      updatedAt: now()
    }
  });
  return { following: true, id: res._id };
}

/** 更新我的竞赛进度 */
async function updateProgress(params, ctx) {
  ctx.requireLogin();
  const { id, status, progress = '', result = '' } = params || {};
  if (!id) throw badRequest('缺少记录 ID');

  const col = db().collection('my_contests');
  const res = await col.doc(id).get();
  if (!res.data) throw notFound('记录不存在');
  if (res.data.openid !== ctx.openid && !ctx.isAdmin) throw forbidden('无权修改');

  await col.doc(id).update({
    data: { status, progress, result, updatedAt: now() }
  });
  return { id, status };
}

/** 新增竞赛（教师/管理员） */
async function create(params, ctx) {
  ctx.requireRole('teacher', 'admin');
  const { name, level = 'C', category = 'scienceOther', host = '', directions = [] } = params || {};
  if (!name) throw badRequest('竞赛名称不能为空');

  const res = await db().collection('competitions').add({
    data: Object.assign({}, params, {
      name: String(name).trim(),
      level,
      category,
      host,
      directions: Array.isArray(directions) ? directions : [],
      status: 'published',
      source: 'manual',
      deleted: false,
      createdAt: now(),
      updatedAt: now()
    })
  });
  return { id: res._id };
}

/** 规范化日期字段：仅接受 YYYY-MM-DD，其余置空；典型月份限制 1-12 */
function normalizeTime(payload) {
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const out = Object.assign({}, payload);
  ['regStart', 'regEnd', 'contestDate'].forEach((k) => {
    if (out[k] !== undefined) {
      const v = String(out[k] || '').trim();
      out[k] = dateRe.test(v) ? v : '';
    }
  });
  if (out.typicalMonths !== undefined) {
    const arr = Array.isArray(out.typicalMonths) ? out.typicalMonths : [];
    out.typicalMonths = arr
      .map((m) => Number(m))
      .filter((m) => m >= 1 && m <= 12)
      .sort((a, b) => a - b);
  }
  return out;
}

/** 修改竞赛（教师/管理员：含时间、简介、官网等） */
async function update(params, ctx) {
  ctx.requireRole('teacher', 'admin');
  const { id } = params || {};
  if (!id) throw badRequest('缺少竞赛 ID');

  const payload = normalizeTime(params);
  delete payload.id;
  payload.updatedAt = now();
  payload.updatedBy = ctx.openid;

  await db().collection('competitions').doc(id).update({ data: payload });
  return { id };
}

/** 下架竞赛（软删除，教师/管理员） */
async function remove(params, ctx) {
  ctx.requireRole('teacher', 'admin');
  const { id } = params || {};
  if (!id) throw badRequest('缺少竞赛 ID');

  await db()
    .collection('competitions')
    .doc(id)
    .update({ data: { deleted: true, status: 'offline', updatedAt: now(), updatedBy: ctx.openid } });
  return { id };
}

/**
 * 导入竞赛种子数据（管理员执行一次即可）
 * 数据来源：移通〔2026〕83号 附件1（A类80项）与附件2（B类33项）
 */
async function importSeed(params, ctx) {
  ctx.requireRole('admin');

  const col = db().collection('competitions');

  // 集合可能尚未创建，读取失败按空库处理
  let existCount = 0;
  try {
    const exist = await col.where({ deleted: false }).count();
    existCount = exist.total || 0;
  } catch (e) {
    existCount = 0;
  }

  if (existCount > 0 && !params.force) {
    return {
      imported: 0,
      skipped: true,
      total: existCount,
      message: '竞赛库已有数据，如需覆盖请传 force=true'
    };
  }

  if (params.force && existCount > 0) {
    await col.where({ deleted: false }).update({ data: { deleted: true } });
  }

  const docs = seed.map((item) =>
    Object.assign({}, item, { createdAt: now(), updatedAt: now() })
  );

  // 并发分批写入，兼顾速度与云函数超时限制
  const BATCH = 20;
  let imported = 0;
  for (let i = 0; i < docs.length; i += BATCH) {
    const chunk = docs.slice(i, i + BATCH);
    await Promise.all(chunk.map((doc) => col.add({ data: doc })));
    imported += chunk.length;
  }

  return { imported, total: docs.length, skipped: false };
}

/** 竞赛指导文章列表 */
async function guides(params, ctx) {
  const { competitionId = '', page = 1, size = 20 } = params || {};
  const where = { status: 'published' };
  if (competitionId) where.competitionId = competitionId;

  const col = db().collection('contest_guides');
  const countRes = await col.where(where).count();
  const listRes = await col
    .where(where)
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * size)
    .limit(size)
    .get();

  return { total: countRes.total, list: listRes.data, page, size };
}

/** 发布竞赛指导（教师） */
async function addGuide(params, ctx) {
  ctx.requireRole('teacher', 'admin');
  const { competitionId, title, content, files = [] } = params || {};
  if (!competitionId || !title || !content) throw badRequest('竞赛、标题与内容不能为空');

  const res = await db().collection('contest_guides').add({
    data: {
      competitionId,
      title: String(title).trim(),
      content: String(content).trim(),
      files: Array.isArray(files) ? files : [],
      authorOpenid: ctx.openid,
      authorName: (ctx.user && ctx.user.realName) || '',
      status: 'published',
      createdAt: now(),
      updatedAt: now()
    }
  });
  return { id: res._id };
}

module.exports = {
  list,
  detail,
  categories,
  myList,
  follow,
  updateProgress,
  create,
  update,
  remove,
  guides,
  addGuide,
  importSeed
};
