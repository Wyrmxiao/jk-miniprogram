/**
 * 项目域 · 访问申请处理器
 *
 * 场景：项目默认只有「本人 / 项目伙伴 / 老师」可见；其他人想看他人的项目，
 * 需要向项目主人发起申请，主人同意后才会放开（针对该主人的全部项目）。
 *
 * 集合：
 *   project_access { ownerOpenid, ownerName, applicantOpenid, applicantName,
 *                    status: pending|approved|rejected, readAt, createdAt, updatedAt }
 */
const cloud = require('wx-server-sdk');
const { badRequest, forbidden, notFound } = require('../utils/response');
const { ensure } = require('../utils/ensure');

const ACCESS_COLL = 'project_access';
const NOTICE_COLL = 'project_notices';

const db = () => cloud.database();
const _ = () => db().command;
const now = () => db().serverDate();

function displayName(user) {
  return (user && (user.realName || user.nickname)) || '同学';
}

function accessText(status) {
  if (status === 'approved') return '已通过';
  if (status === 'rejected') return '已拒绝';
  return '待审核';
}

/** 我已获授权的项目主人列表（visibility 用） */
async function approvedOwners(openid) {
  if (!openid) return [];
  await ensure(ACCESS_COLL);
  const res = await db()
    .collection(ACCESS_COLL)
    .where({ applicantOpenid: openid, status: 'approved' })
    .limit(200)
    .get();
  return (res.data || []).map((d) => d.ownerOpenid).filter(Boolean);
}

/** 是否已获得某位主人的查看授权 */
async function hasAccess(applicantOpenid, ownerOpenid) {
  if (!applicantOpenid || !ownerOpenid) return false;
  await ensure(ACCESS_COLL);
  const res = await db()
    .collection(ACCESS_COLL)
    .where({ applicantOpenid, ownerOpenid, status: 'approved' })
    .limit(1)
    .get();
  return !!(res.data && res.data[0]);
}

/** ============ 接口 ============ */

/** 发起申请：查看某位同学的项目 */
async function apply(params, ctx) {
  ctx.requireLogin();
  const ownerOpenid = String((params && params.ownerOpenid) || '');
  if (!ownerOpenid) throw badRequest('缺少对方标识');
  if (ownerOpenid === ctx.openid) throw badRequest('这是你自己的项目');

  await ensure(ACCESS_COLL);
  const col = db().collection(ACCESS_COLL);
  const exist = await col.where({ ownerOpenid, applicantOpenid: ctx.openid }).limit(1).get();
  const cur = exist.data && exist.data[0];

  if (cur && cur.status === 'approved') return { status: 'approved', text: accessText('approved') };
  if (cur && cur.status === 'pending') return { status: 'pending', text: accessText('pending') };

  // 拿到主人的展示名（列表里要显示“谁向谁申请”）
  let ownerName = '';
  try {
    const u = await db().collection('users').where({ openid: ownerOpenid }).limit(1).get();
    ownerName = displayName((u.data || [])[0]);
  } catch (e) {
    ownerName = '';
  }

  if (cur) {
    await col.doc(cur._id).update({
      data: {
        status: 'pending',
        readAt: null,
        applicantName: displayName(ctx.user),
        ownerName,
        updatedAt: now()
      }
    });
  } else {
    await col.add({
      data: {
        ownerOpenid,
        ownerName,
        applicantOpenid: ctx.openid,
        applicantName: displayName(ctx.user),
        status: 'pending',
        readAt: null,
        createdAt: now(),
        updatedAt: now()
      }
    });
  }
  return { status: 'pending', text: accessText('pending') };
}

/** 我收到的申请（打开「信息」时调用，同时把这些申请标记为已读 → 红点消失） */
async function inbox(params, ctx) {
  ctx.requireLogin();
  await ensure(ACCESS_COLL);
  await ensure(NOTICE_COLL);
  const col = db().collection(ACCESS_COLL);
  const ncol = db().collection(NOTICE_COLL);

  const [inRes, outRes, nRes] = await Promise.all([
    col.where({ ownerOpenid: ctx.openid }).orderBy('updatedAt', 'desc').limit(100).get(),
    col.where({ applicantOpenid: ctx.openid }).orderBy('updatedAt', 'desc').limit(100).get(),
    ncol.where({ ownerOpenid: ctx.openid }).orderBy('createdAt', 'desc').limit(100).get().catch(() => ({ data: [] }))
  ]);

  const received = (inRes.data || []).map((d) => ({
    id: d._id,
    name: d.applicantName || '同学',
    status: d.status,
    statusText: accessText(d.status),
    updatedAt: d.updatedAt || d.createdAt
  }));

  const sent = (outRes.data || []).map((d) => ({
    id: d._id,
    name: d.ownerName || '同学',
    status: d.status,
    statusText: accessText(d.status),
    updatedAt: d.updatedAt || d.createdAt
  }));

  const notices = (nRes.data || []).map((d) => ({
    id: d._id,
    name: d.fromName || '同学',
    projectId: d.projectId || '',
    projectName: d.projectName || '',
    excerpt: d.excerpt || '',
    createdAt: d.createdAt
  }));

  // 标记已读：只有「待审核」的申请和未读留言通知才需要清红点
  const unread = (inRes.data || []).filter((d) => d.status === 'pending' && !d.readAt);
  await Promise.all(
    unread
      .map((d) => col.doc(d._id).update({ data: { readAt: now() } }).catch(() => {}))
      .concat(
        (nRes.data || [])
          .filter((d) => !d.readAt)
          .map((d) => ncol.doc(d._id).update({ data: { readAt: now() } }).catch(() => {}))
      )
  );

  return {
    received,
    sent,
    notices,
    pendingCount: received.filter((r) => r.status === 'pending').length
  };
}

/** 红点：有未读（未点开过）的待审核申请 + 未读留言通知 */
async function badge(params, ctx) {
  if (!ctx.openid) return { count: 0 };
  await ensure(ACCESS_COLL);
  let count = 0;
  try {
    // 用「待审核列表 + 本地过滤 readAt」判断，避开 null 字段查询的兼容问题
    const res = await db()
      .collection(ACCESS_COLL)
      .where({ ownerOpenid: ctx.openid, status: 'pending' })
      .limit(100)
      .get();
    count += (res.data || []).filter((d) => !d.readAt).length;
  } catch (e) {
    /* 静默 */
  }
  try {
    await ensure(NOTICE_COLL);
    const res = await db()
      .collection(NOTICE_COLL)
      .where({ ownerOpenid: ctx.openid })
      .limit(100)
      .get();
    count += (res.data || []).filter((d) => !d.readAt).length;
  } catch (e) {
    /* 静默 */
  }
  return { count };
}

/** 同意 / 拒绝（只有被申请的项目主人可以操作） */
async function respond(params, ctx) {
  ctx.requireLogin();
  const { id, approve } = params || {};
  if (!id) throw badRequest('缺少申请 ID');
  await ensure(ACCESS_COLL);
  const col = db().collection(ACCESS_COLL);
  const res = await col
    .doc(id)
    .get()
    .catch(() => null);
  if (!res || !res.data) throw notFound('申请不存在');
  if (res.data.ownerOpenid !== ctx.openid) throw forbidden('只有项目主人可以处理申请');

  const status = approve ? 'approved' : 'rejected';
  await col.doc(id).update({ data: { status, readAt: now(), updatedAt: now() } });
  return { id, status, text: accessText(status) };
}

/** ============ 个人主页 · 已完成项目 ============ */

/**
 * 某人的「已完成项目」公开列表（个人主页展示用）
 * 只返回项目名称与项目介绍；查看详情需要项目主人通过访问申请
 * @param {string} [ownerOpenid] 目标用户；不传查自己
 */
async function ownerProjects(params, ctx) {
  const target = String((params && params.ownerOpenid) || ctx.openid || '');
  if (!target) return { list: [], access: 'none' };

  await ensure('projects');
  const res = await db()
    .collection('projects')
    .where({ ownerOpenid: target, status: 'active', stage: _().in(['done', 'awarded']) })
    .orderBy('updatedAt', 'desc')
    .limit(50)
    .get()
    .catch(() => ({ data: [] }));

  const isSelf = !!ctx.openid && target === ctx.openid;
  let accessStatus = isSelf ? 'self' : 'none';
  if (!isSelf && ctx.openid) {
    await ensure(ACCESS_COLL);
    const a = await db()
      .collection(ACCESS_COLL)
      .where({ applicantOpenid: ctx.openid, ownerOpenid: target })
      .limit(1)
      .get()
      .catch(() => ({ data: [] }));
    if (a.data && a.data[0]) accessStatus = a.data[0].status;
  }

  // 能否直接打开详情：本人 / 老师 / 已授权 / 项目伙伴（成员里带本人姓名）
  const myName = String((ctx.user && (ctx.user.realName || ctx.user.nickname)) || '').toLowerCase();
  const list = (res.data || []).map((p) => {
    const partner = !!(myName && String(p.members || '').toLowerCase().indexOf(myName) > -1);
    const open = isSelf || ctx.isTeacher || accessStatus === 'approved' || partner;
    return { _id: p._id, name: p.name || '', summary: p.summary || '', stage: p.stage || '', open };
  });

  return { list, access: accessStatus };
}

module.exports = { apply, inbox, badge, respond, ownerProjects, approvedOwners, hasAccess };
