/**
 * 竞赛域 · 业务处理器
 * 数据来源：学校《学生学科竞赛管理办法（修订）》附件1（A类）与附件2（B类）
 */
const cloud = require('wx-server-sdk');
const { badRequest, forbidden, notFound } = require('../utils/response');
const { buildStats, AWARD_TEXT } = require('../utils/stats');
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

  // 已登录用户：标记每项是否已关注（让列表星标跨设备一致）
  const followedMap = {};
  if (ctx.openid) {
    try {
      const mineRes = await db()
        .collection('my_contests')
        .where({ openid: ctx.openid })
        .limit(1000)
        .get();
      mineRes.data.forEach((m) => {
        if (m.competitionId) followedMap[m.competitionId] = true;
      });
    } catch (e) {
      /* 查询失败时退回前端本地缓存，不影响列表 */
    }
  }

  return {
    total: countRes.total,
    list: list.map((c) => Object.assign({}, c, { followed: !!followedMap[c._id] })),
    page,
    size
  };
}

/** 竞赛详情 */
async function detail(params, ctx) {
  const { id } = params || {};
  if (!id) throw badRequest('缺少竞赛 ID');

  const res = await db().collection('competitions').doc(id).get();
  if (!res.data) throw notFound('竞赛不存在');

  // 是否已关注 / 已登记参赛（只要拿到 openid 就查，未实名用户也能回读自己的登记）
  let mine = null;
  if (ctx.openid) {
    try {
      const mineRes = await db()
        .collection('my_contests')
        .where({ openid: ctx.openid, competitionId: id })
        .limit(1)
        .get();
      mine = mineRes.data[0] || null;
    } catch (e) {
      // 集合尚未创建时按未关注处理，不影响赛事详情展示
      mine = null;
    }
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

  // 取消关注只清空关注标记，不删除记录：
  // 同一条记录还承载「已参赛 / 获奖等次」，删掉会丢失学生的登记数据
  if (!follow) {
    if (exist.data.length) {
      await col.doc(exist.data[0]._id).update({ data: { status: '', updatedAt: now() } });
    }
    return { following: false };
  }

  if (exist.data.length) {
    if (exist.data[0].status !== 'watch') {
      await col.doc(exist.data[0]._id).update({ data: { status: 'watch', updatedAt: now() } });
    }
    return { following: true, id: exist.data[0]._id };
  }

  const res = await col.add({
    data: {
      openid: ctx.openid,
      competitionId,
      status: 'watch',
      joined: false,
      award: '',
      progress: '',
      result: '',
      createdAt: now(),
      updatedAt: now()
    }
  });
  return { following: true, id: res._id };
}

/**
 * 登记/更新我的赛事档案（学生自主登记，可反复修改）
 * 未传的字段保持原值，便于"我的赛事统计"与详情页共用一个接口
 * @param {string} competitionId 赛事 ID
 * @param {boolean} [joined] 是否参加过
 * @param {boolean} [preparing] 是否正在准备
 * @param {string} [award] 获奖等次（枚举，统计积分用）
 * @param {string} [awardNote] 获奖情况自由文本（可填"无"，展示优先于等次）
 */
async function register(params, ctx) {
  ctx.requireLogin();
  const { competitionId } = params || {};
  if (!competitionId) throw badRequest('缺少竞赛 ID');

  let comp = null;
  try {
    const compRes = await db().collection('competitions').doc(competitionId).get();
    comp = (compRes && compRes.data) || null;
  } catch (e) {
    comp = null;
  }
  if (!comp || comp.deleted) throw notFound('赛事不存在或已下架');

  const col = db().collection('my_contests');
  const exist = await col.where({ openid: ctx.openid, competitionId }).limit(1).get();
  const cur = (exist.data && exist.data[0]) || {};

  const joined = params.joined === undefined ? !!cur.joined : !!params.joined;
  const preparing = params.preparing === undefined ? !!cur.preparing : !!params.preparing;

  let award = params.award === undefined ? cur.award || '' : String(params.award || '');
  if (award && !AWARD_TEXT[award]) throw badRequest('获奖等次不合法');

  let awardNote =
    params.awardNote === undefined
      ? cur.awardNote || ''
      : String(params.awardNote || '').trim().slice(0, 100);

  // 未参赛就不保留获奖信息
  if (!joined) {
    award = '';
    awardNote = '';
  }

  const data = {
    status: cur.status === 'watch' ? 'watch' : cur.status || '',
    joined,
    preparing,
    award,
    awardNote,
    updatedAt: now()
  };
  if (joined) data.joinedAt = now();

  if (exist.data.length) {
    await col.doc(exist.data[0]._id).update({ data });
    return { id: exist.data[0]._id, joined, preparing, award, awardNote };
  }

  const res = await col.add({
    data: Object.assign(
      {
        openid: ctx.openid,
        competitionId,
        progress: '',
        result: '',
        createdAt: now()
      },
      data
    )
  });
  return { id: res._id, joined, preparing, award, awardNote };
}

/**
 * 个人赛事档案：本人或他人（公开可查）
 * @param {string} [openid] 目标用户；不传查自己
 */
async function myProfile(params, ctx) {
  const targetOpenid = (params && params.openid) || ctx.openid;
  const base = {
    user: null,
    isSelf: false,
    preparing: [],
    joined: [],
    counts: { preparing: 0, joined: 0 }
  };
  if (!targetOpenid) return base;

  const isSelf = !!ctx.openid && targetOpenid === ctx.openid;

  // 用户公开信息（不含学号、手机等敏感字段）
  let user = null;
  try {
    const uRes = await db().collection('users').where({ openid: targetOpenid }).limit(1).get();
    const u = (uRes.data && uRes.data[0]) || null;
    user = u
      ? {
          name: u.realName || u.nickName || '同学',
          major: u.major || '',
          grade: u.grade || '',
          role: u.role || 'student'
        }
      : null;
  } catch (e) {
    user = null;
  }

  let records = [];
  try {
    const res = await db().collection('my_contests').where({ openid: targetOpenid }).limit(200).get();
    records = res.data || [];
  } catch (e) {
    records = [];
  }

  // 关联赛事信息（in 分批查询）
  const compMap = {};
  const ids = Array.from(new Set(records.map((r) => r.competitionId).filter(Boolean)));
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    try {
      const res = await db()
        .collection('competitions')
        .where({ _id: _().in(chunk) })
        .limit(100)
        .get();
      (res.data || []).forEach((c) => {
        compMap[c._id] = c;
      });
    } catch (e) {
      /* 忽略，赛事信息缺失时降级展示 */
    }
  }

  const toRow = (r) => {
    const c = compMap[r.competitionId] || {};
    return {
      recordId: r._id,
      competitionId: r.competitionId,
      name: c.name || '赛事已下架',
      level: c.level || '',
      category: c.category || '',
      host: c.host || '',
      officialUrl: c.officialUrl || '',
      officialName: c.officialName || '',
      regStart: c.regStart || '',
      regEnd: c.regEnd || '',
      contestDate: c.contestDate || '',
      typicalMonths: Array.isArray(c.typicalMonths) ? c.typicalMonths : [],
      intro: c.intro || '',
      award: AWARD_TEXT[r.award] ? r.award : '',
      awardText: AWARD_TEXT[r.award] || '',
      awardNote: r.awardNote || ''
    };
  };

  /** 即将比赛的优先：与赛事库列表同口径（报名截止 → 开赛 → 往期惯例） */
  const timeOf = (row) => {
    if (row.regEnd) {
      const d = new Date(row.regEnd);
      if (!isNaN(d.getTime())) return d;
    }
    if (row.contestDate) {
      const d = new Date(row.contestDate);
      if (!isNaN(d.getTime())) return d;
    }
    const ms = Array.isArray(row.typicalMonths) ? row.typicalMonths : [];
    if (ms.length) {
      const m = nowDate.getMonth() + 1;
      const sorted = [...ms].sort((a, b) => a - b);
      const next = sorted.find((x) => x >= m) || sorted[0];
      const year = next >= m ? nowDate.getFullYear() : nowDate.getFullYear() + 1;
      return new Date(year, next - 1, 1);
    }
    return null;
  };

  const inShelf = (r) => r.competitionId && compMap[r.competitionId] && !compMap[r.competitionId].deleted;

  const preparing = records
    .filter((r) => r.preparing && !r.joined && inShelf(r))
    .map(toRow)
    .sort((a, b) => {
      const ta = timeOf(a);
      const tb = timeOf(b);
      if (ta && tb) return ta - tb;
      if (ta) return -1;
      if (tb) return 1;
      return 0;
    });

  const joined = records
    .filter((r) => r.joined && inShelf(r))
    .map(toRow)
    .sort((a, b) => {
      const da = a.contestDate ? new Date(a.contestDate).getTime() || 0 : 0;
      const dbb = b.contestDate ? new Date(b.contestDate).getTime() || 0 : 0;
      return dbb - da;
    });

  const out = {
    user,
    isSelf,
    preparing,
    joined,
    counts: { preparing: preparing.length, joined: joined.length }
  };

  // 本人视角附带关注 id，前端同步星标缓存
  if (isSelf) {
    out.followedIds = records
      .filter((r) => r.status === 'watch' || r.status === 'following')
      .map((r) => r.competitionId)
      .filter(Boolean);
  }

  return out;
}

/** 比赛统计：概览 + 学生榜 + 热门赛事 + 我的战绩（全员可见） */
async function stats(params, ctx) {
  return buildStats(db(), ctx.openid);
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
  register,
  stats,
  myProfile,
  updateProgress,
  create,
  update,
  remove,
  guides,
  addGuide,
  importSeed
};
