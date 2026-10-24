/**
 * 用户域 · 业务处理器（骨架）
 * 后续新增用户相关能力时在此扩展，前端服务层同步加方法即可
 */
const cloud = require('wx-server-sdk');
const { badRequest, notFound, forbidden } = require('../utils/response');

const db = () => cloud.database();
const now = () => db().serverDate();

/** 当前用户信息 */
async function profile(params, ctx) {
  ctx.requireLogin();
  return ctx.user || null;
}

/** 更新资料 */
async function update(params, ctx) {
  ctx.requireLogin();
  const { nickname = '', avatarUrl = '', direction = '', grade = '', major = '' } = params || {};

  if (!ctx.user) throw notFound('用户不存在');

  await db()
    .collection('users')
    .doc(ctx.user._id)
    .update({
      data: {
        nickname: nickname || ctx.user.nickname || '',
        avatarUrl: avatarUrl || ctx.user.avatarUrl || '',
        direction: direction || ctx.user.direction || '',
        grade: grade || ctx.user.grade || '',
        major: major || ctx.user.major || '',
        updatedAt: now()
      }
    });

  return { userId: ctx.user._id };
}

/**
 * 完善个人资料
 * 学生：仍走学号实名认证审核（submitRealname），这里只更新展示字段
 * 教师/管理员：身份已受信任，填姓名即通过（authStatus=approved）
 */
async function completeProfile(params, ctx) {
  ctx.requireLogin();
  const { realName, title = '', phone = '' } = params || {};
  if (!realName || !String(realName).trim()) throw badRequest('请填写姓名');

  const role = (ctx.user && ctx.user.role) || 'guest';
  const isStaff = role === 'teacher' || role === 'admin';

  const data = { realName: String(realName).trim(), updatedAt: now() };
  if (isStaff) {
    data.authStatus = 'approved';
    if (title) data.title = String(title).trim();
    if (phone) data.phone = String(phone).trim();
  }

  await db()
    .collection('users')
    .doc(ctx.user._id)
    .update({ data });

  return {
    realName: data.realName,
    authStatus: isStaff ? 'approved' : (ctx.user && ctx.user.authStatus) || 'none'
  };
}

/**
 * 用户列表（教师/管理员）
 *
 * 教师：布置任务时需要学生名单（openid 用于指派），故教师也保留读权限
 * 管理员：在「用户与权限」页查看全部用户并分配角色
 * 含未认证与游客，便于冷启动阶段把第二位教师提为教师
 */
async function list(params, ctx) {
  ctx.requireRole('teacher', 'admin');
  const { role = '', keyword = '', page = 1, size = 20 } = params || {};

  const _ = db().command;
  const conds = [];
  if (role) conds.push({ role });

  const kw = String(keyword || '').trim();
  if (kw) {
    // 姓名 / 学号 / 昵称 任一命中即可
    const reg = db().RegExp({ regexp: kw, options: 'i' });
    conds.push(_.or([{ realName: reg }, { studentId: reg }, { nickname: reg }]));
  }

  const where = conds.length === 0 ? {} : conds.length === 1 ? conds[0] : _.and(conds);
  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.min(100, Math.max(1, Number(size) || 20));

  const col = db().collection('users');
  const countRes = await col.where(where).count();
  const listRes = await col
    .where(where)
    .orderBy('updatedAt', 'desc')
    .skip((safePage - 1) * safeSize)
    .limit(safeSize)
    .get();

  return { total: countRes.total, list: listRes.data, page: safePage, size: safeSize };
}

/**
 * 设置角色（仅管理员）
 * student / teacher / admin 三选一；教师与管理员直接视为已认证
 */
async function setRole(params, ctx) {
  ctx.requireRole('admin');
  const { userId, openid = '', role } = params || {};
  if (!userId && !openid) throw badRequest('缺少用户标识');
  if (!['student', 'teacher', 'admin'].includes(role)) throw badRequest('角色不合法');

  const col = db().collection('users');
  let target = null;
  if (userId) {
    const res = await col.doc(userId).get().catch(() => null);
    target = res && res.data;
  } else {
    const res = await col.where({ openid }).limit(1).get();
    target = res.data[0] || null;
  }
  if (!target) throw notFound('用户不存在');

  // 不允许改自己：避免管理员误把自己降级导致系统无人可管
  if (ctx.user && target._id === ctx.user._id) throw forbidden('不能修改自己的角色');

  // 系统至少保留一位管理员
  if (target.role === 'admin' && role !== 'admin') {
    const adminCount = await col.where({ role: 'admin' }).count();
    if (adminCount.total <= 1) throw forbidden('系统至少需要保留一位管理员');
  }

  const data = { role, updatedAt: now() };
  // 教师/管理员由后台指派即可信，直接通过认证；改为学生时不重置其认证状态
  if (role === 'teacher' || role === 'admin') data.authStatus = 'approved';

  await col.doc(target._id).update({ data });

  return {
    userId: target._id,
    role,
    authStatus: data.authStatus || target.authStatus || 'none'
  };
}

module.exports = {
  profile,
  update,
  completeProfile,
  list,
  setRole
};
