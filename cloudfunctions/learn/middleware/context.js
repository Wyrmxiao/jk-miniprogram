/**
 * 请求上下文（后端公共层）
 *
 * 每个请求都会构造 ctx：
 *   ctx.openid  —— 当前用户微信标识，来自微信私有协议，可信
 *   ctx.user    —— users 集合中的用户记录（可能为空）
 *   ctx.role    —— guest | student | teacher | admin
 *   ctx.isTeacher / ctx.isAdmin
 *   ctx.db / ctx._ —— 数据库句柄
 */
const cloud = require('wx-server-sdk');
const { unauthorized, forbidden } = require('../utils/response');

const ROLE = {
  GUEST: 'guest',
  STUDENT: 'student',
  TEACHER: 'teacher',
  ADMIN: 'admin'
};

async function buildContext() {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || wxContext.FROM_OPENID || '';
  const db = cloud.database();

  let user = null;
  if (openid) {
    try {
      const res = await db.collection('users').where({ openid }).limit(1).get();
      user = (res.data && res.data[0]) || null;
    } catch (e) {
      user = null;
    }
  }

  const role = (user && user.role) || ROLE.GUEST;

  return {
    openid,
    user,
    role,
    db,
    _: db.command,
    isGuest: role === ROLE.GUEST,
    isStudent: role === ROLE.STUDENT,
    isTeacher: role === ROLE.TEACHER || role === ROLE.ADMIN,
    isAdmin: role === ROLE.ADMIN,
    /** 要求已登录 */
    requireLogin() {
      if (!openid) throw unauthorized('请先登录');
      return this;
    },
    /** 要求具备指定角色之一 */
    requireRole(...roles) {
      if (!openid) throw unauthorized('请先登录');
      if (!roles.includes(role)) throw forbidden('没有操作权限');
      return this;
    },
    /** 要求已通过实名认证 */
    requireVerified() {
      if (!openid) throw unauthorized('请先登录');
      if (!user || user.authStatus !== 'approved') throw forbidden('请先完成实名认证');
      return this;
    }
  };
}

module.exports = { buildContext, ROLE };
