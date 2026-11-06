/**
 * 学习域 · 每周学习汇报处理器
 *
 * 覆盖：学生提交/修改本周汇报、查看历史；教师按班级 + 周次查看提交情况、导出 Excel
 *
 * 数据集合：weekly_reports
 *   { openid, name, studentId, weekKey, weekStart, weekEnd,
 *     knowledge, difficulty, questions, blogUrl, classIds: [], createdAt, updatedAt }
 *
 * 规则：
 *   1. 每人每周一条记录，自然周（周一~周日）归档，截止前可反复修改（覆盖更新）
 *   2. classIds 记录“投递给哪些班级”，教师端只能看到 classIds 含自己班级的汇报
 */
const cloud = require('wx-server-sdk');
const { badRequest, forbidden } = require('../utils/response');
const { ensure } = require('../utils/ensure');
const { weekInfo, weekRange, formatTime } = require('../utils/week');
const {
  ensureClassCollections,
  requireClassAccess,
  memberOpenids,
  usersByOpenids,
  reportsOfClassWeek
} = require('../utils/classroom');

const db = () => cloud.database();
const now = () => db().serverDate();
const _ = () => db().command;

const COLL = 'weekly_reports';
const DAY = 24 * 60 * 60 * 1000;

/** 校验查看者：老师 / admin / 班级创建者才能看全班的提交情况 */
async function ensureViewer(classId, ctx) {
  ctx.requireLogin();
  if (!classId) throw badRequest('请先选择班级');
  const { cls, member } = await requireClassAccess(classId, ctx);
  const isOwner = member.role === 'owner' || ctx.isAdmin;
  if (!ctx.isTeacher && !isOwner) throw forbidden('只有老师或班级创建者可以查看提交情况');
  return { cls, member, isOwner };
}

/** 学生：读取某周（默认本周）自己的汇报 */
async function reportMine(params, ctx) {
  ctx.requireLogin();
  await ensure(COLL);

  const current = weekInfo();
  const target = weekRange((params && params.weekKey) || current.weekKey);
  if (!target) throw badRequest('周次格式不正确，应为 2026-W45');

  const res = await db()
    .collection(COLL)
    .where({ openid: ctx.openid, weekKey: target.weekKey })
    .limit(1)
    .get();

  return {
    week: Object.assign({}, target, {
      isCurrent: target.weekKey === current.weekKey,
      // 历史周只读；本周在周日 23:59 前可改
      editable: target.weekKey === current.weekKey
    }),
    currentWeekKey: current.weekKey,
    report: (res.data && res.data[0]) || null
  };
}

/** 学生：保存/修改本周汇报（同周覆盖更新） */
async function reportSave(params, ctx) {
  ctx.requireLogin();
  await ensure(COLL);

  const p = params || {};
  const current = weekInfo();
  const target = weekRange(p.weekKey || current.weekKey);
  if (!target) throw badRequest('周次格式不正确');
  if (target.weekKey !== current.weekKey) throw badRequest('只能提交本周的汇报，历史周不可修改');

  const knowledge = String(p.knowledge || '').trim();
  const difficulty = String(p.difficulty || '').trim();
  const questions = String(p.questions || '').trim();
  const blogUrl = String(p.blogUrl || '').trim();

  if (!knowledge && !difficulty && !questions && !blogUrl) {
    throw badRequest('请至少填写一项内容');
  }
  if (knowledge.length > 2000 || difficulty.length > 2000 || questions.length > 2000) {
    throw badRequest('单项内容请控制在 2000 字以内');
  }
  if (blogUrl && !/^https?:\/\/\S+$/i.test(blogUrl)) {
    throw badRequest('博客地址需以 http:// 或 https:// 开头');
  }

  // 投递班级：必须是自己已加入的班级
  const classIds = Array.isArray(p.classIds) ? Array.from(new Set(p.classIds.filter(Boolean))) : [];
  if (classIds.length) {
    await ensureClassCollections();
    const mineRes = await db()
      .collection('class_members')
      .where({ openid: ctx.openid })
      .limit(100)
      .get()
      .catch(() => ({ data: [] }));
    const joined = new Set((mineRes.data || []).map((m) => m.classId));
    const invalid = classIds.filter((id) => !joined.has(id));
    if (invalid.length) throw forbidden('你还不是所选班级的成员');
  }

  const data = {
    weekKey: target.weekKey,
    weekStart: target.weekStart,
    weekEnd: target.weekEnd,
    knowledge,
    difficulty,
    questions,
    blogUrl,
    classIds,
    updatedAt: now()
  };

  const existed = await db()
    .collection(COLL)
    .where({ openid: ctx.openid, weekKey: target.weekKey })
    .limit(1)
    .get();

  if (existed.data && existed.data[0]) {
    await db().collection(COLL).doc(existed.data[0]._id).update({ data });
    return { id: existed.data[0]._id, created: false, classIds };
  }

  const user = ctx.user || {};
  const addRes = await db()
    .collection(COLL)
    .add({
      data: Object.assign(
        {
          openid: ctx.openid,
          name: user.realName || '',
          studentId: user.studentId || '',
          createdAt: now()
        },
        data
      )
    });
  return { id: addRes._id, created: true, classIds };
}

/** 学生：我的历史汇报（按周倒序） */
async function reportMyWeeks(params, ctx) {
  ctx.requireLogin();
  await ensure(COLL);

  const { page = 1, size = 20 } = params || {};
  const res = await db()
    .collection(COLL)
    .where({ openid: ctx.openid })
    .orderBy('weekKey', 'desc')
    .skip((page - 1) * size)
    .limit(size)
    .get();

  return { list: res.data, page, size };
}

/** 教师：某班周次汇总（提交人数 / 班级人数） */
async function reportWeeks(params, ctx) {
  await ensure(COLL);

  const current = weekInfo();
  const { size = 12, classId } = params || {};
  const { cls } = await ensureViewer(classId, ctx);

  // 以当前周为基准，往前推 size 周（即使没人提交也展示，方便看“未提交”）
  const weeks = [];
  const base = Date.UTC(
    Number(current.weekStart.slice(0, 4)),
    Number(current.weekStart.slice(5, 7)) - 1,
    Number(current.weekStart.slice(8, 10))
  );
  for (let i = 0; i < size; i += 1) {
    weeks.push(weekInfo(new Date(base - i * 7 * DAY)));
  }

  const totalStudents = (await memberOpenids(classId)).length;
  const keys = weeks.map((w) => w.weekKey);

  let reports = [];
  try {
    const res = await db()
      .collection(COLL)
      .where({ weekKey: _.in(keys), classIds: String(classId) })
      .limit(1000)
      .get();
    reports = res.data || [];
  } catch (e) {
    for (let i = 0; i < weeks.length; i += 1) {
      const chunk = await reportsOfClassWeek(classId, weeks[i].weekKey);
      reports = reports.concat(chunk);
    }
  }

  const countMap = {};
  reports.forEach((r) => {
    countMap[r.weekKey] = (countMap[r.weekKey] || 0) + 1;
  });

  return {
    classInfo: { _id: cls._id, name: cls.name, memberCount: totalStudents },
    currentWeekKey: current.weekKey,
    totalStudents,
    list: weeks.map((w) =>
      Object.assign({}, w, {
        submitted: countMap[w.weekKey] || 0,
        total: totalStudents,
        isCurrent: w.weekKey === current.weekKey
      })
    )
  };
}

/** 教师：某班某周提交明细（含未提交名单） */
async function reportList(params, ctx) {
  await ensure(COLL);

  const { weekKey, classId } = params || {};
  const target = weekRange(weekKey);
  if (!target) throw badRequest('周次格式不正确');
  const { cls } = await ensureViewer(classId, ctx);
  await ensureClassCollections();

  const [reports, openids] = await Promise.all([reportsOfClassWeek(classId, target.weekKey), memberOpenids(classId)]);
  const users = await usersByOpenids(openids);
  const submittedSet = new Set(reports.map((r) => r.openid));

  const memberList = openids.map((openid) => {
    const u = users[openid] || {};
    return {
      openid,
      name: u.realName || u.nickname || '未实名',
      studentId: u.studentId || ''
    };
  });

  const missing = memberList.filter((m) => !submittedSet.has(m.openid));

  // 汇报补充姓名/学号（以用户表为准）
  const list = reports.map((r) => {
    const u = users[r.openid] || {};
    return Object.assign({}, r, {
      name: u.realName || r.name || '未实名',
      studentId: u.studentId || r.studentId || ''
    });
  });

  return {
    classInfo: { _id: cls._id, name: cls.name },
    week: Object.assign({}, target, { isCurrent: target.weekKey === weekInfo().weekKey }),
    list,
    missing,
    submitted: list.length,
    total: memberList.length
  };
}

/** 教师：导出某班某周 Excel，返回云文件 ID */
async function reportExport(params, ctx) {
  await ensure(COLL);

  const { weekKey, classId } = params || {};
  const target = weekRange(weekKey);
  if (!target) throw badRequest('周次格式不正确');
  const { cls } = await ensureViewer(classId, ctx);
  await ensureClassCollections();

  let xlsx;
  try {
    xlsx = require('node-xlsx');
  } catch (e) {
    throw badRequest('导出组件未安装：请在开发者工具中对 learn 云函数执行「上传并部署：云端安装依赖」');
  }

  const [reports, openids] = await Promise.all([reportsOfClassWeek(classId, target.weekKey), memberOpenids(classId)]);
  const users = await usersByOpenids(openids);
  const byOpenid = {};
  reports.forEach((r) => {
    byOpenid[r.openid] = r;
  });

  const header = [
    '学号',
    '姓名',
    '班级',
    '周次',
    '本周学习知识点',
    '重难点',
    '不理解的地方',
    '博客链接',
    '提交时间'
  ];
  const rows = [header];

  const students = openids
    .map((openid) => Object.assign({ openid }, users[openid] || {}))
    .sort((a, b) => String(a.studentId || '').localeCompare(String(b.studentId || '')));

  const used = new Set();
  students.forEach((s) => {
    const r = byOpenid[s.openid];
    if (!r) return;
    used.add(s.openid);
    rows.push([
      s.studentId || r.studentId || '',
      s.realName || r.name || '',
      cls.name,
      target.weekKey,
      r.knowledge || '',
      r.difficulty || '',
      r.questions || '',
      r.blogUrl || '',
      formatTime(r.updatedAt || r.createdAt)
    ]);
  });
  // 不在成员名单内但投递到本班的记录，也一并导出
  reports.forEach((r) => {
    if (used.has(r.openid)) return;
    rows.push([
      r.studentId || '',
      r.name || '',
      cls.name,
      target.weekKey,
      r.knowledge || '',
      r.difficulty || '',
      r.questions || '',
      r.blogUrl || '',
      formatTime(r.updatedAt || r.createdAt)
    ]);
  });

  const missing = students.filter((s) => !byOpenid[s.openid]);
  if (missing.length) {
    rows.push([]);
    rows.push(['未提交名单', `${missing.length} 人`]);
    missing.forEach((s) => rows.push([s.studentId || '', s.realName || '未实名', cls.name, '', '未提交']));
  }

  const buffer = xlsx.build([
    {
      name: `周报 ${target.weekKey}`.slice(0, 30),
      data: rows,
      options: {
        '!cols': [
          { wch: 14 },
          { wch: 10 },
          { wch: 16 },
          { wch: 10 },
          { wch: 40 },
          { wch: 30 },
          { wch: 30 },
          { wch: 34 },
          { wch: 20 }
        ]
      }
    }
  ]);

  const upload = await cloud.uploadFile({
    cloudPath: `exports/weekly-report/${cls._id}_${target.weekKey}_${Date.now()}.xlsx`,
    fileContent: buffer
  });

  return {
    fileID: upload.fileID,
    fileName: `${cls.name}_每周学习汇报_${target.weekKey}.xlsx`,
    submitted: reports.length,
    missing: missing.length
  };
}

module.exports = {
  reportMine,
  reportSave,
  reportMyWeeks,
  reportWeeks,
  reportList,
  reportExport
};
