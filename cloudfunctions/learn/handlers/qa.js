/**
 * 学习问答 · 业务处理器
 *
 * 场景：学生提出自己的问题 → 教师与同学查看并解答 → 提问者采纳答案 / 教师标记解决
 *
 * 集合（ensure 自愈，无需手工建表）：
 *   qa_questions —— 问题（软删除 status='removed'）
 *   qa_answers   —— 回答（软删除 status='removed'，按问题 id 关联）
 *
 * 设计要点：
 *   1. 回答独立成表，避免单文档膨胀，也便于「我回答过的问题」反查
 *   2. answerCount / acceptedAnswerId 冗余在问题里，列表页零额外查询
 *   3. lastActivityAt 随提问与回答更新，列表按「最近有讨论」排序而非单纯创建时间
 *   4. 采纳是唯一的「高质量答案」标记；教师可直接标记解决（线下解决的场景）
 *   5. 权限一律在后端校验，前端只做展示判断
 */
const cloud = require('wx-server-sdk');
const { badRequest, notFound, forbidden } = require('../utils/response');
const { ensure } = require('../utils/ensure');

const db = () => cloud.database();
const now = () => db().serverDate();
const _ = () => db().command;

/** 问题分类（与前端 constants.QA_CATEGORIES 保持一致） */
const CATEGORIES = ['algorithm', 'course', 'project', 'contest', 'other'];
/** 状态：open 待解决 / solved 已解决 / removed 已删除 */
const STATUS = ['open', 'solved', 'removed'];

/** 展示名：优先实名，其次昵称 */
function displayName(user) {
  return (user && (user.realName || user.nickname)) || '同学';
}

function isStaff(ctx) {
  return ctx.isTeacher || ctx.isAdmin;
}

function cleanText(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

async function ready() {
  await ensure('qa_questions');
  await ensure('qa_answers');
}

/** 取未删除的问题，否则抛 404 */
async function getQuestion(id) {
  if (!id) throw badRequest('缺少问题 ID');
  const res = await db()
    .collection('qa_questions')
    .doc(id)
    .get()
    .catch(() => null);
  if (!res || !res.data || res.data.status === 'removed') throw notFound('问题不存在或已删除');
  return res.data;
}

/** 取未删除的回答 */
async function getAnswer(id) {
  if (!id) throw badRequest('缺少回答 ID');
  const res = await db()
    .collection('qa_answers')
    .doc(id)
    .get()
    .catch(() => null);
  if (!res || !res.data || res.data.status === 'removed') throw notFound('回答不存在或已删除');
  return res.data;
}

/** 是否有权管理该问题（作者本人 / 教师 / 管理员） */
function canManageQuestion(q, ctx) {
  return q.openid === ctx.openid || isStaff(ctx);
}

/* ==================== 查询 ==================== */

/**
 * 问题列表
 * params:
 *   scope     all | open | solved | mine | answered  默认 all
 *   category  分类 key，空为全部
 *   keyword   标题 / 正文 模糊匹配
 *   page/size 分页
 */
async function qaList(params, ctx) {
  ctx.requireLogin();
  await ready();
  const { scope = 'all', category = '', keyword = '', page = 1, size = 20 } = params || {};

  const conds = [{ status: _().neq('removed') }];
  if (scope === 'open' || scope === 'solved') conds.push({ status: scope });
  if (scope === 'mine') conds.push({ openid: ctx.openid });
  if (category && CATEGORIES.includes(category)) conds.push({ category });

  const kw = cleanText(keyword, 40);
  if (kw) {
    // 与 user.list 一致的写法：command.or 命中标题或正文
    const reg = db().RegExp({ regexp: kw, options: 'i' });
    conds.push(_().or([{ title: reg }, { content: reg }, { authorName: reg }]));
  }

  // 「我回答过的」需要反查回答表，先取去重的问题 id
  let answeredIds = null;
  if (scope === 'answered') {
    const mine = await db()
      .collection('qa_answers')
      .where({ openid: ctx.openid, status: _().neq('removed') })
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    answeredIds = Array.from(new Set(mine.data.map((a) => a.questionId)));
    if (!answeredIds.length) return { total: 0, list: [], page: 1, size: 20 };
    conds.push({ _id: _().in(answeredIds) });
  }

  const where = conds.length === 1 ? conds[0] : _().and(conds);
  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.min(50, Math.max(1, Number(size) || 20));

  const col = db().collection('qa_questions');
  const countRes = await col.where(where).count();
  const listRes = await col
    .where(where)
    .orderBy('lastActivityAt', 'desc')
    .skip((safePage - 1) * safeSize)
    .limit(safeSize)
    .get();

  // 列表不返回正文全文，减少传输；预生成摘要供卡片显示
  const list = listRes.data.map((q) => ({
    _id: q._id,
    title: q.title,
    summary: cleanText(q.content, 90),
    category: q.category,
    tags: q.tags || [],
    status: q.status,
    answerCount: q.answerCount || 0,
    viewCount: q.viewCount || 0,
    acceptedAnswerId: q.acceptedAnswerId || '',
    problemId: q.problemId || '',
    problemTitle: q.problemTitle || '',
    authorName: q.authorName,
    authorRole: q.authorRole,
    isMine: q.openid === ctx.openid,
    createdAt: q.createdAt,
    lastActivityAt: q.lastActivityAt
  }));

  return { total: countRes.total, list, page: safePage, size: safeSize };
}

/** 概览数字：学习页入口卡片用 */
async function qaStats(params, ctx) {
  ctx.requireLogin();
  await ready();
  const col = db().collection('qa_questions');
  const [openRes, solvedRes, mineRes] = await Promise.all([
    col.where({ status: 'open' }).count(),
    col.where({ status: 'solved' }).count(),
    col.where({ openid: ctx.openid, status: _().neq('removed') }).count()
  ]);
  return {
    open: openRes.total,
    solved: solvedRes.total,
    mine: mineRes.total,
    total: openRes.total + solvedRes.total
  };
}

/** 问题详情 + 回答列表（采纳的答案排最前） */
async function qaDetail(params, ctx) {
  ctx.requireLogin();
  await ready();
  const { id, page = 1, size = 50 } = params || {};
  const q = await getQuestion(id);

  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.min(100, Math.max(1, Number(size) || 50));

  const ansCol = db().collection('qa_answers');
  const where = { questionId: id, status: _().neq('removed') };
  const countRes = await ansCol.where(where).count();
  const listRes = await ansCol
    .where(where)
    .orderBy('createdAt', 'asc')
    .skip((safePage - 1) * safeSize)
    .limit(safeSize)
    .get();

  // 采纳答案置顶，其余保持时间顺序；权限字段在后端算好，WXML 不做方法调用
  const answers = listRes.data
    .map((a) =>
      Object.assign({}, a, {
        isTeacher: a.authorRole === 'teacher' || a.authorRole === 'admin',
        isMine: a.openid === ctx.openid,
        canDelete: a.openid === ctx.openid || q.openid === ctx.openid || isStaff(ctx),
        canAccept:
          (q.openid === ctx.openid || isStaff(ctx)) &&
          q.status === 'open' &&
          a.openid !== ctx.openid
      })
    )
    .sort((x, y) => Number(!!y.accepted) - Number(!!x.accepted));

  // 浏览量自增：失败不影响主流程
  try {
    await db()
      .collection('qa_questions')
      .doc(id)
      .update({ data: { viewCount: _().inc(1) } });
  } catch (e) {
    /* ignore */
  }

  return {
    question: Object.assign({}, q, {
      isMine: q.openid === ctx.openid,
      canManage: canManageQuestion(q, ctx),
      canAccept: q.openid === ctx.openid || isStaff(ctx),
      isTeacherAuthor: q.authorRole === 'teacher' || q.authorRole === 'admin'
    }),
    answers,
    total: countRes.total,
    page: safePage,
    size: safeSize
  };
}

/* ==================== 写入 ==================== */

/** 提问：已实名认证的学生 / 教师均可 */
async function qaAsk(params, ctx) {
  ctx.requireVerified();
  await ready();
  const {
    title,
    content,
    category = 'other',
    tags = [],
    problemId = '',
    problemTitle = ''
  } = params || {};

  const t = cleanText(title, 80);
  const c = cleanText(content, 3000);
  if (!t) throw badRequest('请填写问题标题');
  if (c.length < 10) throw badRequest('请把问题描述清楚（至少 10 个字）');
  if (!CATEGORIES.includes(category)) throw badRequest('请选择正确的分类');

  const res = await db()
    .collection('qa_questions')
    .add({
      data: {
        openid: ctx.openid,
        authorName: displayName(ctx.user),
        authorRole: ctx.role,
        title: t,
        content: c,
        category,
        tags: (Array.isArray(tags) ? tags : []).slice(0, 5).map((x) => cleanText(x, 12)),
        problemId: cleanText(problemId, 60),
        problemTitle: cleanText(problemTitle, 80),
        status: 'open',
        answerCount: 0,
        viewCount: 0,
        acceptedAnswerId: '',
        solvedBy: '',
        lastActivityAt: now(),
        createdAt: now(),
        updatedAt: now()
      }
    });
  return { id: res._id };
}

/** 回答：教师与同学都可解答；自己也能补充自己的问题（但不能被采纳） */
async function qaAnswer(params, ctx) {
  ctx.requireVerified();
  await ready();
  const { questionId, content } = params || {};
  // 已解决的问题仍允许补充回答（只是不能再被采纳），避免把讨论硬切断
  await getQuestion(questionId);

  const c = cleanText(content, 2000);
  if (c.length < 2) throw badRequest('请填写回答内容');

  const res = await db()
    .collection('qa_answers')
    .add({
      data: {
        questionId,
        openid: ctx.openid,
        authorName: displayName(ctx.user),
        authorRole: ctx.role,
        content: c,
        accepted: false,
        status: 'active',
        createdAt: now(),
        updatedAt: now()
      }
    });

  await db()
    .collection('qa_questions')
    .doc(questionId)
    .update({
      data: {
        answerCount: _().inc(1),
        lastActivityAt: now(),
        updatedAt: now()
      }
    });
  return { id: res._id };
}

/** 采纳答案：提问者本人或教师 / 管理员 */
async function qaAccept(params, ctx) {
  ctx.requireVerified();
  await ready();
  const { questionId, answerId } = params || {};
  const q = await getQuestion(questionId);
  if (!canManageQuestion(q, ctx)) throw forbidden('只有提问者或老师可以采纳答案');
  const a = await getAnswer(answerId);
  if (a.questionId !== questionId) throw badRequest('回答不属于该问题');

  // 先清掉该问题下所有已采纳标记（云函数端支持 where 批量更新）
  await db()
    .collection('qa_answers')
    .where({ questionId, accepted: true })
    .update({ data: { accepted: false, updatedAt: now() } })
    .catch(() => null);
  await db()
    .collection('qa_answers')
    .doc(answerId)
    .update({ data: { accepted: true, updatedAt: now() } });

  await db()
    .collection('qa_questions')
    .doc(questionId)
    .update({
      data: {
        status: 'solved',
        acceptedAnswerId: answerId,
        solvedBy: displayName(ctx.user),
        updatedAt: now()
      }
    });
  return { id: questionId, status: 'solved', acceptedAnswerId: answerId };
}

/**
 * 设置解决状态：教师可直接标记解决（线下已解答）；提问者 / 教师可重新打开
 * status 仅允许 'solved' | 'open'
 */
async function qaSetStatus(params, ctx) {
  ctx.requireVerified();
  await ready();
  const { id, status } = params || {};
  if (!STATUS.includes(status) || status === 'removed') throw badRequest('状态不合法');
  const q = await getQuestion(id);
  if (!canManageQuestion(q, ctx)) throw forbidden('没有权限修改该问题');

  const data = { status, updatedAt: now() };
  if (status === 'open') {
    data.acceptedAnswerId = '';
    data.solvedBy = '';
    await db()
      .collection('qa_answers')
      .where({ questionId: id, accepted: true })
      .update({ data: { accepted: false, updatedAt: now() } })
      .catch(() => null);
  } else {
    data.solvedBy = displayName(ctx.user);
  }

  await db().collection('qa_questions').doc(id).update({ data });
  return { id, status };
}

/** 删除问题（软删除，作者本人或教师 / 管理员），同时下架其回答 */
async function qaRemoveQuestion(params, ctx) {
  ctx.requireLogin();
  await ready();
  const { id } = params || {};
  const q = await getQuestion(id);
  if (!canManageQuestion(q, ctx)) throw forbidden('没有权限删除该问题');

  await db()
    .collection('qa_questions')
    .doc(id)
    .update({ data: { status: 'removed', updatedAt: now() } });
  await db()
    .collection('qa_answers')
    .where({ questionId: id })
    .update({ data: { status: 'removed', accepted: false, updatedAt: now() } })
    .catch(() => null);
  return { id };
}

/** 删除回答（回答者 / 提问者 / 教师 / 管理员），被采纳的答案删除后问题回到待解决 */
async function qaRemoveAnswer(params, ctx) {
  ctx.requireLogin();
  await ready();
  const { id } = params || {};
  const a = await getAnswer(id);
  const q = await getQuestion(a.questionId);
  if (a.openid !== ctx.openid && q.openid !== ctx.openid && !isStaff(ctx)) {
    throw forbidden('没有权限删除该回答');
  }

  await db()
    .collection('qa_answers')
    .doc(id)
    .update({ data: { status: 'removed', accepted: false, updatedAt: now() } });

  const patch = { answerCount: _().inc(-1), updatedAt: now() };
  if (a.accepted) {
    patch.status = 'open';
    patch.acceptedAnswerId = '';
    patch.solvedBy = '';
  }
  await db().collection('qa_questions').doc(a.questionId).update({ data: patch });
  return { id, questionStatus: patch.status || q.status };
}

module.exports = {
  qaList,
  qaStats,
  qaDetail,
  qaAsk,
  qaAnswer,
  qaAccept,
  qaSetStatus,
  qaRemoveQuestion,
  qaRemoveAnswer,
  CATEGORIES
};
