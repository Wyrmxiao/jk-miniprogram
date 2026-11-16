/**
 * 学习域 · 班级处理器
 *
 * 设计：班级是“师生归属”的载体
 *   - 老师/学生都能建班，一人在多个班
 *   - 学生扫码或输入邀请码入班
 *   - 学生提交每周汇报时选择投递给哪些班级
 *   - 老师只能看到自己所在班级的汇报（数据隔离在 report.js 里实现）
 *
 * 集合：
 *   classes        { name, intro, code, ownerOpenid, memberCount, status, createdAt, updatedAt }
 *   class_members  { classId, openid, role: owner|member, joinedAt }
 */
const cloud = require('wx-server-sdk');
const { badRequest } = require('../utils/response');
const { weekInfo } = require('../utils/week');
const {
  CLASS_COLL,
  MEMBER_COLL,
  db,
  now,
  ensureClassCollections,
  getClass,
  getMember,
  requireClassAccess,
  requireClassOwner,
  memberOpenids,
  usersByOpenids,
  reportsOfClassWeek,
  genInviteCode
} = require('../utils/classroom');

/** 创建班级 */
async function classCreate(params, ctx) {
  ctx.requireLogin();
  await ensureClassCollections();

  const name = String((params && params.name) || '').trim();
  const intro = String((params && params.intro) || '').trim();
  if (name.length < 2 || name.length > 20) throw badRequest('班级名称请填 2~20 个字');
  if (intro.length > 100) throw badRequest('班级简介请控制在 100 字以内');

  const code = await genInviteCode();
  const user = ctx.user || {};
  const addRes = await db()
    .collection(CLASS_COLL)
    .add({
      data: {
        name,
        intro,
        code,
        ownerOpenid: ctx.openid,
        ownerName: user.realName || user.nickname || '',
        memberCount: 1,
        status: 'active',
        createdAt: now(),
        updatedAt: now()
      }
    });

  await db()
    .collection(MEMBER_COLL)
    .add({
      data: {
        classId: addRes._id,
        openid: ctx.openid,
        role: 'owner',
        joinedAt: now()
      }
    });

  return { classId: addRes._id, name, code };
}

/** 我加入的班级列表（含本周是否已提交） */
async function classList(params, ctx) {
  ctx.requireLogin();
  await ensureClassCollections();

  const memberRes = await db()
    .collection(MEMBER_COLL)
    .where({ openid: ctx.openid })
    .limit(100)
    .get()
    .catch(() => ({ data: [] }));
  const members = memberRes.data || [];
  if (!members.length) return { list: [] };

  const classIds = members.map((m) => m.classId);
  const classRes = await db()
    .collection(CLASS_COLL)
    .where({ _id: db().command.in(classIds), status: 'active' })
    .limit(100)
    .get()
    .catch(() => ({ data: [] }));
  const classes = classRes.data || [];

  // 我的本周汇报，用于标记“已提交”
  const current = weekInfo();
  const reportRes = await db()
    .collection('weekly_reports')
    .where({ openid: ctx.openid, weekKey: current.weekKey })
    .limit(1)
    .get()
    .catch(() => ({ data: [] }));
  const myReport = (reportRes.data && reportRes.data[0]) || null;
  const myClassIds = (myReport && myReport.classIds) || [];

  const roleMap = {};
  members.forEach((m) => {
    roleMap[m.classId] = m.role;
  });

  const list = classes
    .map((c) => ({
      _id: c._id,
      name: c.name,
      intro: c.intro || '',
      code: c.code,
      ownerName: c.ownerName || '',
      memberCount: c.memberCount || 0,
      isOwner: c.ownerOpenid === ctx.openid,
      myRole: roleMap[c._id] || 'member',
      submittedThisWeek: myClassIds.includes(c._id)
    }))
    .sort((a, b) => (a.isOwner === b.isOwner ? String(a.name).localeCompare(String(b.name)) : a.isOwner ? -1 : 1));

  return { list, currentWeekKey: current.weekKey };
}

/** 班级详情：成员名单 + 本周提交情况 */
async function classDetail(params, ctx) {
  ctx.requireLogin();
  await ensureClassCollections();

  const { classId } = params || {};
  const { cls, member } = await requireClassAccess(classId, ctx);

  const memberRes = await db()
    .collection(MEMBER_COLL)
    .where({ classId: String(classId) })
    .limit(1000)
    .get()
    .catch(() => ({ data: [] }));
  const members = memberRes.data || [];
  const users = await usersByOpenids(members.map((m) => m.openid));

  const memberList = members
    .map((m) => {
      const u = users[m.openid] || {};
      return {
        openid: m.openid,
        role: m.role,
        name: u.realName || u.nickname || '未实名',
        studentId: u.studentId || '',
        authStatus: u.authStatus || 'none',
        joinedAt: m.joinedAt
      };
    })
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'owner' ? -1 : 1;
      return String(a.studentId || '').localeCompare(String(b.studentId || ''));
    });

  const current = weekInfo();
  const reports = await reportsOfClassWeek(classId, current.weekKey);
  const submittedSet = new Set(reports.map((r) => r.openid));
  const submittedCount = memberList.filter((m) => submittedSet.has(m.openid)).length;

  return {
    cls: {
      _id: cls._id,
      name: cls.name,
      intro: cls.intro || '',
      code: cls.code,
      ownerOpenid: cls.ownerOpenid,
      ownerName: cls.ownerName || '',
      memberCount: memberList.length,
      isOwner: cls.ownerOpenid === ctx.openid || ctx.isAdmin,
      myRole: (member && member.role) || 'admin'
    },
    members: memberList,
    week: Object.assign({}, current, {
      submitted: submittedCount,
      total: memberList.length
    }),
    mySubmittedThisWeek: submittedSet.has(ctx.openid)
  };
}

/** 用邀请码加入班级 */
async function classJoin(params, ctx) {
  ctx.requireLogin();
  await ensureClassCollections();

  const code = String((params && params.code) || '')
    .trim()
    .toUpperCase();
  if (!/^[A-Z0-9]{4,10}$/.test(code)) throw badRequest('请输入正确的班级邀请码');

  const res = await db().collection(CLASS_COLL).where({ code, status: 'active' }).limit(1).get();
  const cls = (res.data && res.data[0]) || null;
  if (!cls) throw badRequest('邀请码无效，请向老师确认');

  const existed = await getMember(cls._id, ctx.openid);
  if (existed) return { classId: cls._id, className: cls.name, already: true };

  await db()
    .collection(MEMBER_COLL)
    .add({ data: { classId: cls._id, openid: ctx.openid, role: 'member', joinedAt: now() } });
  await db()
    .collection(CLASS_COLL)
    .doc(cls._id)
    .update({ data: { memberCount: db().command.inc(1), updatedAt: now() } });

  return { classId: cls._id, className: cls.name, already: false };
}

/** 退出班级（创建者需先解散） */
async function classQuit(params, ctx) {
  ctx.requireLogin();
  await ensureClassCollections();

  const { classId } = params || {};
  const { cls, member } = await requireClassAccess(classId, ctx);
  if (member.role === 'owner') throw badRequest('你是班级创建者，请先解散班级');

  await db()
    .collection(MEMBER_COLL)
    .where({ classId: String(classId), openid: ctx.openid })
    .remove()
    .catch(() => null);
  await db()
    .collection(CLASS_COLL)
    .doc(cls._id)
    .update({ data: { memberCount: db().command.inc(-1), updatedAt: now() } })
    .catch(() => null);

  return { ok: true };
}

/** 解散班级（创建者） */
async function classDissolve(params, ctx) {
  ctx.requireLogin();
  await ensureClassCollections();

  const { classId } = params || {};
  const { cls } = await requireClassOwner(classId, ctx);

  await db()
    .collection(MEMBER_COLL)
    .where({ classId: String(classId) })
    .remove()
    .catch(() => null);
  await db()
    .collection(CLASS_COLL)
    .doc(cls._id)
    .update({ data: { status: 'closed', memberCount: 0, updatedAt: now() } });

  return { ok: true };
}

/** 移除成员（创建者） */
async function classRemoveMember(params, ctx) {
  ctx.requireLogin();
  await ensureClassCollections();

  const { classId, openid } = params || {};
  if (!openid) throw badRequest('缺少成员标识');
  const { cls, member } = await requireClassOwner(classId, ctx);
  if (openid === cls.ownerOpenid) throw badRequest('不能移除班级创建者');
  if (member.role !== 'owner' && !ctx.isAdmin) throw badRequest('没有操作权限');

  await db()
    .collection(MEMBER_COLL)
    .where({ classId: String(classId), openid })
    .remove()
    .catch(() => null);
  await db()
    .collection(CLASS_COLL)
    .doc(cls._id)
    .update({ data: { memberCount: db().command.inc(-1), updatedAt: now() } })
    .catch(() => null);

  return { ok: true };
}

/** 修改班级信息（创建者） */
async function classUpdate(params, ctx) {
  ctx.requireLogin();
  await ensureClassCollections();

  const { classId, name, intro } = params || {};
  const { cls } = await requireClassOwner(classId, ctx);

  const data = { updatedAt: now() };
  if (name !== undefined) {
    const n = String(name).trim();
    if (n.length < 2 || n.length > 20) throw badRequest('班级名称请填 2~20 个字');
    data.name = n;
  }
  if (intro !== undefined) {
    const i = String(intro).trim();
    if (i.length > 100) throw badRequest('班级简介请控制在 100 字以内');
    data.intro = i;
  }

  await db().collection(CLASS_COLL).doc(cls._id).update({ data });
  return { ok: true };
}

/** 生成班级邀请小程序码（失败时返回空 fileID，前端降级用邀请码） */
async function classQr(params, ctx) {
  ctx.requireLogin();
  await ensureClassCollections();

  const { classId } = params || {};
  const { cls } = await requireClassAccess(classId, ctx);

  const tryMake = async (envVersion) => {
    const res = await cloud.openapi.wxacode.getUnlimited({
      scene: cls.code,
      page: 'pages/class/join',
      checkPath: false,
      envVersion,
      width: 430
    });
    return res.buffer;
  };

  let buffer = null;
  const envs = ['release', 'trial', 'develop'];
  for (let i = 0; i < envs.length && !buffer; i += 1) {
    try {
      buffer = await tryMake(envs[i]);
    } catch (e) {
      buffer = null;
    }
  }

  if (!buffer) {
    return { fileID: '', code: cls.code, tip: '二维码生成失败，可直接使用邀请码加入' };
  }

  const upload = await cloud.uploadFile({
    cloudPath: `class-qr/${cls._id}_${Date.now()}.png`,
    fileContent: buffer
  });
  return { fileID: upload.fileID, code: cls.code };
}

/** 我加入的班级（精简版，供汇报页选择投递对象） */
async function classMine(params, ctx) {
  ctx.requireLogin();
  await ensureClassCollections();

  const memberRes = await db()
    .collection(MEMBER_COLL)
    .where({ openid: ctx.openid })
    .limit(100)
    .get()
    .catch(() => ({ data: [] }));
  const members = memberRes.data || [];
  if (!members.length) return { list: [] };

  const classRes = await db()
    .collection(CLASS_COLL)
    .where({ _id: db().command.in(members.map((m) => m.classId)), status: 'active' })
    .limit(100)
    .get()
    .catch(() => ({ data: [] }));

  const roleMap = {};
  members.forEach((m) => {
    roleMap[m.classId] = m.role;
  });

  return {
    list: (classRes.data || []).map((c) => ({
      _id: c._id,
      name: c.name,
      isOwner: roleMap[c._id] === 'owner'
    }))
  };
}

module.exports = {
  classCreate,
  classList,
  classDetail,
  classJoin,
  classQuit,
  classDissolve,
  classRemoveMember,
  classUpdate,
  classQr,
  classMine
};
