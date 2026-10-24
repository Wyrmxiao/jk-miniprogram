/**
 * 公告域 · 业务处理器
 *
 * 两类公告：
 *   notice  通知      —— 教师发布的日常通知、安排、提醒
 *   contest 赛事公告  —— 教师发布的赛事报名、选拔、结果通报，可关联竞赛库条目
 */
const cloud = require('wx-server-sdk');
const { badRequest, forbidden, notFound } = require('../utils/response');

const db = () => cloud.database();
const now = () => db().serverDate();

/** 公告列表：按置顶、时间倒序 */
async function list(params, ctx) {
  const { type = '', page = 1, size = 20, keyword = '' } = params || {};

  const where = { status: 'published' };
  if (type) where.type = type;
  if (keyword) {
    where.title = db().RegExp({ regexp: String(keyword).trim(), options: 'i' });
  }

  const col = db().collection('announcements');
  const countRes = await col.where(where).count();
  const listRes = await col
    .where(where)
    .orderBy('top', 'desc')
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * size)
    .limit(size)
    .get();

  // 标记已读
  let readIds = [];
  if (ctx.user) {
    const readRes = await db()
      .collection('announce_reads')
      .where({ openid: ctx.openid })
      .limit(100)
      .get();
    readIds = readRes.data.map((r) => r.announceId);
  }

  const list = listRes.data.map((item) =>
    Object.assign({}, item, { read: readIds.includes(item._id) })
  );

  return { total: countRes.total, list, page, size };
}

/** 公告详情：同时记录已读 */
async function detail(params, ctx) {
  const { id } = params || {};
  if (!id) throw badRequest('缺少公告 ID');

  const res = await db().collection('announcements').doc(id).get();
  if (!res.data) throw notFound('公告不存在');

  if (ctx.user) {
    const exist = await db()
      .collection('announce_reads')
      .where({ openid: ctx.openid, announceId: id })
      .limit(1)
      .get();
    if (!exist.data.length) {
      await db().collection('announce_reads').add({
        data: {
          openid: ctx.openid,
          announceId: id,
          createdAt: now()
        }
      });
    }
  }

  // 浏览量 +1
  await db()
    .collection('announcements')
    .doc(id)
    .update({ data: { viewCount: db().command.inc(1) } });

  // 关联的竞赛信息
  let competition = null;
  if (res.data.competitionId) {
    try {
      const c = await db().collection('competitions').doc(res.data.competitionId).get();
      competition = c.data || null;
    } catch (e) {
      competition = null;
    }
  }

  // 发布者信息
  let publisher = null;
  if (res.data.publisherOpenid) {
    const u = await db()
      .collection('users')
      .where({ openid: res.data.publisherOpenid })
      .limit(1)
      .get();
    publisher = u.data[0]
      ? { realName: u.data[0].realName || '老师', role: u.data[0].role }
      : null;
  }

  return Object.assign({}, res.data, { competition, publisher, read: true });
}

/**
 * 发布公告（教师/管理员）
 * params: { type, title, content, images?, competitionId?, deadline?, top?, push? }
 */
async function publish(params, ctx) {
  ctx.requireRole('teacher', 'admin');

  const {
    type = 'notice',
    title,
    content,
    images = [],
    competitionId = '',
    deadline = null,
    top = false,
    push = false
  } = params || {};

  if (!title || !content) throw badRequest('标题与内容不能为空');
  if (!['notice', 'contest'].includes(type)) throw badRequest('公告类型不正确');

  const res = await db().collection('announcements').add({
    data: {
      type,
      title: String(title).trim(),
      content: String(content).trim(),
      images: Array.isArray(images) ? images : [],
      competitionId,
      deadline,
      top: !!top,
      status: 'published',
      publisherOpenid: ctx.openid,
      publisherName: (ctx.user && ctx.user.realName) || '',
      publisherRole: ctx.role,
      viewCount: 0,
      push: !!push,
      createdAt: now(),
      updatedAt: now()
    }
  });

  // 需要推送时，给全部已认证用户写一条站内通知
  if (push) {
    await pushToAll(res._id, title, type);
  }

  return { id: res._id };
}

/** 我发布的公告 */
async function myList(params, ctx) {
  ctx.requireRole('teacher', 'admin');
  const { page = 1, size = 20 } = params || {};

  const where = { publisherOpenid: ctx.openid };
  const col = db().collection('announcements');
  const countRes = await col.where(where).count();
  const listRes = await col
    .where(where)
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * size)
    .limit(size)
    .get();

  return { total: countRes.total, list: listRes.data, page, size };
}

/** 删除（下架）公告 */
async function remove(params, ctx) {
  ctx.requireRole('teacher', 'admin');
  const { id } = params || {};
  if (!id) throw badRequest('缺少公告 ID');

  const res = await db().collection('announcements').doc(id).get();
  if (!res.data) throw notFound('公告不存在');
  if (res.data.publisherOpenid !== ctx.openid && !ctx.isAdmin) {
    throw forbidden('只能删除自己发布的公告');
  }

  await db()
    .collection('announcements')
    .doc(id)
    .update({ data: { status: 'removed', updatedAt: now() } });

  return { id };
}

/** 未读数量 */
async function unreadCount(params, ctx) {
  if (!ctx.user) return { count: 0 };

  const published = await db()
    .collection('announcements')
    .where({ status: 'published' })
    .limit(100)
    .get();
  const readRes = await db()
    .collection('announce_reads')
    .where({ openid: ctx.openid })
    .limit(100)
    .get();

  const readSet = new Set(readRes.data.map((r) => r.announceId));
  const count = published.data.filter((a) => !readSet.has(a._id)).length;
  return { count };
}

/** 内部：给所有已认证用户写站内通知 */
async function pushToAll(announceId, title, type) {
  const users = await db()
    .collection('users')
    .where({ authStatus: 'approved' })
    .limit(100)
    .get();

  const docs = users.data.map((u) => ({
    openid: u.openid,
    type: 'announce',
    title: type === 'contest' ? '新赛事公告' : '新通知',
    content: title,
    link: `/pages/index/index?announceId=${announceId}`,
    read: false,
    createdAt: now()
  }));

  if (!docs.length) return;
  // 分批写入，单次最多 100 条
  for (let i = 0; i < docs.length; i += 100) {
    await db().collection('notifications').add({
      data: docs.slice(i, i + 100)
    });
  }
}

module.exports = {
  list,
  detail,
  publish,
  myList,
  remove,
  unreadCount
};
