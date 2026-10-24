/**
 * 学习域 · 业务处理器
 * 覆盖：学习路线（模板/生成/打卡）与成长记录（日志/成果/教师评语/能力雷达）
 */
const cloud = require('wx-server-sdk');
const { badRequest, notFound, forbidden } = require('../utils/response');
const { TEMPLATES, DIRECTIONS } = require('../services/templates');
const { ensure } = require('../utils/ensure');

const db = () => cloud.database();
const now = () => db().serverDate();
const _ = () => db().command;

/** 路线模板列表：数据库为空时用内置模板兜底 */
async function templates(params, ctx) {
  const { direction = '' } = params || {};
  const where = {};
  if (direction) where.direction = direction;

  const res = await db().collection('roadmap_templates').where(where).limit(50).get();
  if (res.data.length) return { list: res.data };

  // 内置模板兜底（未初始化数据库时也能用）
  const list = TEMPLATES.filter((t) => !direction || t.direction === direction);
  return { list };
}

/** 生成我的学习路线 */
async function createRoadmap(params, ctx) {
  ctx.requireLogin();
  const { templateKey, direction } = params || {};
  if (!templateKey && !direction) throw badRequest('请选择学习方向');

  const tpl =
    TEMPLATES.find((t) => t.key === templateKey) ||
    TEMPLATES.find((t) => t.direction === direction);
  if (!tpl) throw badRequest('未找到对应路线模板');

  // 已存在则直接返回
  const exist = await db()
    .collection('user_roadmaps')
    .where({ openid: ctx.openid, status: 'ongoing' })
    .limit(1)
    .get();
  if (exist.data.length) return exist.data[0];

  const stages = tpl.stages.map((stage, si) => ({
    index: si,
    name: stage.name,
    goal: stage.goal,
    status: si === 0 ? 'ongoing' : 'locked',
    tasks: stage.tasks.map((task, ti) => ({
      index: ti,
      name: task.name,
      hours: task.hours,
      done: false,
      doneAt: null,
      logId: ''
    }))
  }));

  const res = await db().collection('user_roadmaps').add({
    data: {
      openid: ctx.openid,
      templateKey: tpl.key,
      direction: tpl.direction,
      name: tpl.name,
      summary: tpl.summary,
      currentStage: 0,
      stages,
      progress: 0,
      status: 'ongoing',
      createdAt: now(),
      updatedAt: now()
    }
  });

  return { _id: res._id, templateKey: tpl.key, name: tpl.name, stages, progress: 0 };
}

/** 我的当前路线 */
async function myRoadmap(params, ctx) {
  ctx.requireLogin();
  const res = await db()
    .collection('user_roadmaps')
    .where({ openid: ctx.openid, status: 'ongoing' })
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  return res.data[0] || null;
}

/** 路线详情 */
async function roadmapDetail(params, ctx) {
  ctx.requireLogin();
  const { id } = params || {};
  if (!id) throw badRequest('缺少路线 ID');

  const res = await db().collection('user_roadmaps').doc(id).get();
  if (!res.data) throw notFound('路线不存在');
  return res.data;
}

/** 完成任务打卡，自动推进阶段 */
async function checkTask(params, ctx) {
  ctx.requireLogin();
  const { roadmapId, stageIndex, taskIndex, logId = '' } = params || {};
  if (roadmapId === undefined || stageIndex === undefined || taskIndex === undefined) {
    throw badRequest('参数不完整');
  }

  const res = await db().collection('user_roadmaps').doc(roadmapId).get();
  if (!res.data) throw notFound('路线不存在');
  if (res.data.openid !== ctx.openid) throw forbidden('无权操作');

  const stages = res.data.stages;
  const stage = stages[stageIndex];
  if (!stage) throw notFound('阶段不存在');

  stage.tasks[taskIndex].done = true;
  stage.tasks[taskIndex].doneAt = new Date();
  if (logId) stage.tasks[taskIndex].logId = logId;

  // 本阶段全部完成 -> 进入下一阶段
  if (stage.tasks.every((t) => t.done)) {
    stage.status = 'done';
    const next = stages[stageIndex + 1];
    if (next && next.status === 'locked') next.status = 'ongoing';
  }

  const total = stages.reduce((sum, s) => sum + s.tasks.length, 0);
  const done = stages.reduce((sum, s) => sum + s.tasks.filter((t) => t.done).length, 0);
  const currentStage = stages.findIndex((s) => s.status === 'ongoing');
  const progress = total ? Math.round((done / total) * 100) : 0;

  await db()
    .collection('user_roadmaps')
    .doc(roadmapId)
    .update({
      data: {
        stages,
        progress,
        currentStage: currentStage < 0 ? stages.length - 1 : currentStage,
        status: done === total ? 'finished' : 'ongoing',
        updatedAt: now()
      }
    });

  return { progress, done, total };
}

/** 新增学习记录（学习过程留痕，不统计时长与能力值） */
async function addLog(params, ctx) {
  ctx.requireLogin();
  const {
    title,
    content,
    studyDate = '',
    tags = [],
    images = [],
    taskId = '',
    roadmapId = ''
  } = params || {};
  if (!title || !content) throw badRequest('标题与内容不能为空');

  await ensure('learning_logs');
  const res = await db().collection('learning_logs').add({
    data: {
      openid: ctx.openid,
      title: String(title).trim(),
      content: String(content).trim(),
      studyDate: studyDate ? String(studyDate) : '',
      tags: Array.isArray(tags) ? tags : [],
      images: Array.isArray(images) ? images : [],
      taskId,
      roadmapId,
      authorName: (ctx.user && ctx.user.realName) || '',
      teacherComment: '',
      commentBy: '',
      status: 'published',
      createdAt: now(),
      updatedAt: now()
    }
  });
  return { id: res._id };
}

/** 学习记录列表（学生看自己的，教师看全部或指定学生） */
async function logList(params, ctx) {
  ctx.requireLogin();
  const { page = 1, size = 20, openid = '', keyword = '' } = params || {};

  await ensure('learning_logs');
  const where = { status: 'published' };
  if (ctx.isTeacher && openid) {
    where.openid = openid;
  } else if (!ctx.isTeacher) {
    where.openid = ctx.openid;
  }
  if (keyword) {
    where.title = db().RegExp({ regexp: String(keyword).trim(), options: 'i' });
  }

  const col = db().collection('learning_logs');
  const countRes = await col.where(where).count();
  const listRes = await col
    .where(where)
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * size)
    .limit(size)
    .get();

  return { total: countRes.total, list: listRes.data, page, size };
}

async function logDetail(params, ctx) {
  ctx.requireLogin();
  const { id } = params || {};
  if (!id) throw badRequest('缺少记录 ID');

  const res = await db().collection('learning_logs').doc(id).get();
  if (!res.data) throw notFound('记录不存在');
  return res.data;
}

/** 教师批注学习记录 */
async function commentLog(params, ctx) {
  ctx.requireRole('teacher', 'admin');
  const { id, comment } = params || {};
  if (!id || !comment) throw badRequest('缺少记录 ID 或评语');

  await db()
    .collection('learning_logs')
    .doc(id)
    .update({
      data: {
        teacherComment: String(comment).trim(),
        commentBy: (ctx.user && ctx.user.realName) || '老师',
        commentedAt: now(),
        updatedAt: now()
      }
    });
  return { id };
}

/** 登记成果（获奖/项目/证书） */
async function addAchievement(params, ctx) {
  ctx.requireLogin();
  const { type, title, competitionId = '', awardLevel = '', files = [], date } = params || {};
  if (!type || !title) throw badRequest('类型与标题不能为空');

  const res = await db().collection('achievements').add({
    data: {
      openid: ctx.openid,
      type,
      title: String(title).trim(),
      competitionId,
      awardLevel,
      files: Array.isArray(files) ? files : [],
      date: date || null,
      createdAt: now(),
      updatedAt: now()
    }
  });
  return { id: res._id };
}

async function achievements(params, ctx) {
  ctx.requireLogin();
  const { openid = '', page = 1, size = 20 } = params || {};
  const where = {};
  where.openid = ctx.isTeacher && openid ? openid : ctx.openid;

  const col = db().collection('achievements');
  const countRes = await col.where(where).count();
  const listRes = await col
    .where(where)
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * size)
    .limit(size)
    .get();

  return { total: countRes.total, list: listRes.data, page, size };
}

/* ============================================================
 * 学习任务：教师布置 → 学生提交 → 教师批阅
 * ============================================================ */

/** 教师发布学习任务 */
async function publishTask(params, ctx) {
  ctx.requireRole('teacher', 'admin');
  const {
    title,
    content = '',
    dueDate = '',
    direction = '',
    assignType = 'all',
    assignTo = []
  } = params || {};
  if (!title) throw badRequest('任务标题不能为空');

  await ensure('learn_tasks');
  const res = await db().collection('learn_tasks').add({
    data: {
      title: String(title).trim(),
      content: String(content).trim(),
      dueDate: dueDate ? String(dueDate) : '',
      direction,
      assignType: assignType === 'some' ? 'some' : 'all',
      assignTo: Array.isArray(assignTo) ? assignTo : [],
      createdBy: ctx.openid,
      createdByName: (ctx.user && ctx.user.realName) || '老师',
      status: 'open',
      submitCount: 0,
      reviewedCount: 0,
      createdAt: now(),
      updatedAt: now()
    }
  });
  return { id: res._id };
}

/**
 * 任务列表
 * 教师：返回自己布置的任务（含提交统计）
 * 学生：返回指派给自己的任务 + 自己的提交状态
 */
async function taskList(params, ctx) {
  ctx.requireLogin();
  const { page = 1, size = 20 } = params || {};

  await ensure('learn_tasks');
  await ensure('task_submissions');
  const col = db().collection('learn_tasks');
  let listRes;
  if (ctx.isTeacher) {
    listRes = await col
      .where({ createdBy: ctx.openid, status: 'open' })
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * size)
      .limit(size)
      .get();
    return { total: listRes.data.length, list: listRes.data, page, size, role: 'teacher' };
  }

  const _c = _();
  listRes = await col
    .where(
      _c.and([
        { status: 'open' },
        _c.or([{ assignType: 'all' }, { assignTo: ctx.openid }])
      ])
    )
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();

  // 合并我自己的提交状态
  const ids = listRes.data.map((t) => t._id);
  let subMap = {};
  if (ids.length) {
    const subRes = await db()
      .collection('task_submissions')
      .where({ openid: ctx.openid, taskId: _c.in(ids) })
      .limit(200)
      .get();
    subMap = subRes.data.reduce((acc, s) => {
      acc[s.taskId] = s;
      return acc;
    }, {});
  }

  const list = listRes.data.slice((page - 1) * size, page * size).map((t) => {
    const sub = subMap[t._id];
    return Object.assign({}, t, {
      mySubmission: sub || null,
      myStatus: sub ? sub.status : 'todo'
    });
  });

  return { total: listRes.data.length, list, page, size, role: 'student' };
}

/** 任务详情 + 提交情况（教师查看全部提交，学生看自己的） */
async function taskDetail(params, ctx) {
  ctx.requireLogin();
  const { id } = params || {};
  if (!id) throw badRequest('缺少任务 ID');

  await ensure('task_submissions');
  const res = await db().collection('learn_tasks').doc(id).get();
  if (!res.data) throw notFound('任务不存在');

  const col = db().collection('task_submissions');
  if (ctx.isTeacher) {
    const subRes = await col
      .where({ taskId: id })
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    return Object.assign({}, res.data, { submissions: subRes.data });
  }

  const mine = await col.where({ taskId: id, openid: ctx.openid }).limit(1).get();
  return Object.assign({}, res.data, { mySubmission: mine.data[0] || null });
}

/** 学生提交任务（重复提交则覆盖更新） */
async function submitTask(params, ctx) {
  ctx.requireLogin();
  const { taskId, content = '', images = [] } = params || {};
  if (!taskId) throw badRequest('缺少任务 ID');
  if (!content && (!images || !images.length)) throw badRequest('请填写完成情况');

  await ensure('task_submissions');
  const taskRes = await db().collection('learn_tasks').doc(taskId).get();
  if (!taskRes.data) throw notFound('任务不存在');

  const col = db().collection('task_submissions');
  const exist = await col.where({ taskId, openid: ctx.openid }).limit(1).get();

  const data = {
    content: String(content).trim(),
    images: Array.isArray(images) ? images : [],
    status: 'submitted',
    submittedAt: now(),
    updatedAt: now()
  };

  if (exist.data.length) {
    await col.doc(exist.data[0]._id).update({ data });
    return { id: exist.data[0]._id, updated: true };
  }

  const res = await col.add({
    data: Object.assign(
      {
        taskId,
        openid: ctx.openid,
        studentName: (ctx.user && ctx.user.realName) || '',
        studentNo: (ctx.user && ctx.user.studentNo) || '',
        createdAt: now()
      },
      data
    )
  });

  await db()
    .collection('learn_tasks')
    .doc(taskId)
    .update({ data: { submitCount: _().inc(1), updatedAt: now() } });

  return { id: res._id, updated: false };
}

/** 教师批阅提交：status = reviewed（通过）| returned（退回重做） */
async function reviewSubmission(params, ctx) {
  ctx.requireRole('teacher', 'admin');
  const { id, comment = '', status = 'reviewed' } = params || {};
  if (!id) throw badRequest('缺少提交 ID');

  const col = db().collection('task_submissions');
  const res = await col.doc(id).get();
  if (!res.data) throw notFound('提交不存在');

  await col.doc(id).update({
    data: {
      status: status === 'returned' ? 'returned' : 'reviewed',
      teacherComment: String(comment).trim(),
      reviewBy: (ctx.user && ctx.user.realName) || '老师',
      reviewedAt: now(),
      updatedAt: now()
    }
  });

  await db()
    .collection('learn_tasks')
    .doc(res.data.taskId)
    .update({ data: { reviewedCount: _().inc(1), updatedAt: now() } });

  return { id, status };
}

/** 教师关闭任务（不再显示给学生） */
async function closeTask(params, ctx) {
  ctx.requireRole('teacher', 'admin');
  const { id } = params || {};
  if (!id) throw badRequest('缺少任务 ID');

  const task = await db().collection('learn_tasks').doc(id).get();
  if (!task.data) throw notFound('任务不存在');
  if (task.data.createdBy !== ctx.openid && !ctx.isAdmin) throw forbidden('只能关闭自己发布的任务');

  await db()
    .collection('learn_tasks')
    .doc(id)
    .update({ data: { status: 'closed', updatedAt: now() } });
  return { id, status: 'closed' };
}

module.exports = {
  templates,
  createRoadmap,
  myRoadmap,
  roadmapDetail,
  checkTask,
  addLog,
  logList,
  logDetail,
  commentLog,
  addAchievement,
  achievements,
  publishTask,
  taskList,
  taskDetail,
  submitTask,
  reviewSubmission,
  closeTask
};
