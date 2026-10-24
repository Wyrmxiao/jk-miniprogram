/**
 * 认证域 · 业务处理器
 * 每个 handler 签名：(params, ctx) => data，抛 BizError 即为失败
 */
const cloud = require('wx-server-sdk');
const { badRequest, notFound } = require('../utils/response');

const db = () => cloud.database();
const now = () => db().serverDate();

/** 登录：无则创建游客记录，返回身份信息 */
async function login(params, ctx) {
  if (!ctx.openid) {
    return { openid: '', role: 'guest', authStatus: 'none', isNew: false };
  }

  const col = db().collection('users');
  let user = ctx.user;
  let isNew = false;

  if (!user) {
    const addRes = await col.add({
      data: {
        openid: ctx.openid,
        role: 'guest',
        authStatus: 'none',
        nickname: '',
        avatarUrl: '',
        createdAt: now(),
        updatedAt: now(),
        lastLoginAt: now()
      }
    });
    user = { _id: addRes._id, openid: ctx.openid, role: 'guest', authStatus: 'none' };
    isNew = true;
  } else {
    await col.doc(user._id).update({ data: { lastLoginAt: now() } });
  }

  return {
    openid: ctx.openid,
    userId: user._id,
    role: user.role || 'guest',
    authStatus: user.authStatus || 'none',
    studentId: user.studentId || '',
    realName: user.realName || '',
    grade: user.grade || '',
    major: user.major || '',
    direction: user.direction || '',
    isNew
  };
}

/** 提交实名认证申请 */
async function submitRealname(params, ctx) {
  ctx.requireLogin();
  const { studentId, realName, grade, major } = params || {};

  if (!studentId || !realName) throw badRequest('学号与姓名不能为空');
  if (!/^\d{6,20}$/.test(String(studentId).trim())) throw badRequest('学号格式不正确');

  const col = db().collection('auth_applications');
  // 已通过或在审的不再重复提交
  const exist = await col
    .where({ openid: ctx.openid, status: db().command.in(['pending', 'approved']) })
    .limit(1)
    .get();
  if (exist.data.length) {
    throw badRequest('已提交过认证申请，请等待审核');
  }

  const res = await col.add({
    data: {
      openid: ctx.openid,
      userId: ctx.user ? ctx.user._id : '',
      studentId: String(studentId).trim(),
      realName: String(realName).trim(),
      grade: grade || '',
      major: major || '',
      status: 'pending',
      reviewerId: '',
      reviewAt: null,
      remark: '',
      createdAt: now(),
      updatedAt: now()
    }
  });

  return { applicationId: res._id, status: 'pending' };
}

/** 我的认证申请 */
async function myApplication(params, ctx) {
  ctx.requireLogin();
  const res = await db()
    .collection('auth_applications')
    .where({ openid: ctx.openid })
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  return res.data[0] || null;
}

/** 待审核列表（教师/管理员） */
async function pendingList(params, ctx) {
  ctx.requireRole('teacher', 'admin');
  const { status = 'pending', page = 1, size = 20 } = params || {};

  const where = { status };
  const col = db().collection('auth_applications');
  const countRes = await col.where(where).count();
  const listRes = await col
    .where(where)
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * size)
    .limit(size)
    .get();

  return { total: countRes.total, list: listRes.data, page, size };
}

/** 审核认证申请 */
async function review(params, ctx) {
  ctx.requireRole('teacher', 'admin');
  const { applicationId, approved, remark = '' } = params || {};
  if (!applicationId) throw badRequest('缺少申请 ID');

  const col = db().collection('auth_applications');
  const appRes = await col.doc(applicationId).get();
  const application = appRes.data;
  if (!application) throw notFound('申请不存在');
  if (application.status !== 'pending') throw badRequest('该申请已处理');

  const status = approved ? 'approved' : 'rejected';
  await col.doc(applicationId).update({
    data: {
      status,
      reviewerId: ctx.user ? ctx.user._id : '',
      reviewerOpenid: ctx.openid,
      reviewAt: now(),
      remark,
      updatedAt: now()
    }
  });

  // 通过则把用户升级为学生
  if (approved) {
    await db()
      .collection('users')
      .where({ openid: application.openid })
      .update({
        data: {
          role: 'student',
          authStatus: 'approved',
          studentId: application.studentId,
          realName: application.realName,
          grade: application.grade,
          major: application.major,
          updatedAt: now()
        }
      });
  } else {
    await db()
      .collection('users')
      .where({ openid: application.openid })
      .update({
        data: { authStatus: 'rejected', updatedAt: now() }
      });
  }

  return { status };
}

/**
 * 系统用到的全部数据集合
 * 新增模块时在这里补一行，初始化时会自动建集合
 */
const COLLECTIONS = [
  'users',
  'auth_applications',
  'system_config',
  'roadmap_templates',
  'user_roadmaps',
  'learning_logs',
  'achievements',
  'competitions',
  'contest_guides',
  'my_contests',
  'announcements',
  'announce_reads',
  'notifications',
  'posts',
  'comments',
  'reports',
  'ai_conversations',
  'learn_tasks',
  'task_submissions',
  'projects',
  'project_updates',
  'project_comments'
];

/** 建集合（已存在时云开发会报错，忽略即可） */
async function ensureCollections() {
  const created = [];
  const failed = [];
  for (const name of COLLECTIONS) {
    try {
      await db().createCollection(name);
      created.push(name);
    } catch (e) {
      const msg = String((e && e.message) || e);
      // 已存在属正常情况，其余记录到 failed 便于排查
      if (!/exist/i.test(msg)) failed.push({ name, msg });
    }
  }
  return { created, failed, total: COLLECTIONS.length };
}

/** 统计竞赛库条数（集合不存在时返回 0） */
async function countCompetitions() {
  try {
    const res = await db().collection('competitions').where({ deleted: false }).count();
    return res.total || 0;
  } catch (e) {
    return 0;
  }
}

async function readSystemConfig() {
  try {
    const res = await db().collection('system_config').where({ key: 'system' }).limit(1).get();
    return (res.data && res.data[0]) || null;
  } catch (e) {
    return null;
  }
}

/**
 * 系统初始化（幂等，可重复调用）
 *
 * 首次调用：写入系统配置，并把「第一位使用者」提升为管理员，
 * 解决没有管理员就无法导入数据、又没有数据的冷启动死锁。
 * 之后调用：只返回当前状态，不再改动任何数据。
 */
async function bootstrap(params, ctx) {
  const viewOnly = !!(params && params.viewOnly);
  let config = await readSystemConfig();
  let competitions = await countCompetitions();

  if (config) {
    return {
      initialized: true,
      justInitialized: false,
      competitions,
      role: ctx.role,
      openid: ctx.openid,
      config
    };
  }

  if (viewOnly) {
    return { initialized: false, justInitialized: false, competitions, role: ctx.role, config: null };
  }

  if (!ctx.openid) throw badRequest('未获取到 openid，无法初始化');

  // 云开发集合必须先存在才能写入，这里统一补齐
  const collections = await ensureCollections();

  // 建集合后重新读取，避免空库误判
  config = await readSystemConfig();
  if (config) {
    return {
      initialized: true,
      justInitialized: false,
      competitions,
      role: ctx.role,
      collections,
      config
    };
  }

  await db().collection('system_config').add({
    data: {
      key: 'system',
      orgName: '重庆移通学院计算机学院 · 计科创新中心',
      schoolYear: '2026-2027',
      contestPolicy: '移通〔2026〕83号《重庆移通学院学生学科竞赛管理办法（修订）》',
      initializedBy: ctx.openid,
      initializedAt: now(),
      updatedAt: now()
    }
  });

  // 第一位使用者成为管理员：后续教师角色由管理员在「我的-用户管理」中分配
  if (!ctx.user) {
    await db().collection('users').add({
      data: {
        openid: ctx.openid,
        role: 'admin',
        authStatus: 'approved',
        nickname: '',
        avatarUrl: '',
        createdAt: now(),
        updatedAt: now(),
        lastLoginAt: now()
      }
    });
  } else {
    await db()
      .collection('users')
      .doc(ctx.user._id)
      .update({ data: { role: 'admin', authStatus: 'approved', updatedAt: now() } });
  }

  competitions = await countCompetitions();

  return {
    initialized: true,
    justInitialized: true,
    competitions,
    role: 'admin',
    openid: ctx.openid,
    collections,
    config: await readSystemConfig()
  };
}

module.exports = {
  login,
  submitRealname,
  myApplication,
  pendingList,
  review,
  bootstrap
};
