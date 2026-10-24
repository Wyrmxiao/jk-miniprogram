/**
 * 项目域 · 业务处理器
 * 学生项目管理与分享：项目档案 + 进展时间线 + 留言 + 教师推荐
 *
 * 权限分界：
 * - 创建/编辑/删除项目、发/删进展：项目主人（管理员可兜底）
 * - 留言：登录用户；删留言：本人或教师/管理员
 * - 推荐/取消推荐：教师/管理员
 */
const cloud = require('wx-server-sdk');
const { badRequest, notFound, forbidden } = require('../utils/response');
const { ensure } = require('../utils/ensure');

const db = () => cloud.database();
const _ = db().command;
const now = () => db().serverDate();

const STAGES = ['idea', 'doing', 'done', 'awarded'];
const DIRECTIONS = ['frontend', 'backend', 'algorithm', 'ai', 'security', 'embedded'];

/** 转义正则特殊字符，防注入 */
function escapeReg(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 展示名：真实姓名优先，其次昵称 */
function displayName(user) {
  return (user && (user.realName || user.nickname)) || '同学';
}

/** 取项目（存在且未删除），否则抛 404 */
async function getProject(id) {
  if (!id) throw badRequest('缺少项目 ID');
  const res = await db()
    .collection('projects')
    .doc(id)
    .get()
    .catch(() => null);
  if (!res || !res.data || res.data.status === 'removed') {
    throw notFound('项目不存在或已删除');
  }
  return res.data;
}

/** ============ 查询 ============ */

/**
 * 项目列表（广场）
 * @param {string}  stage      阶段筛选（可选）
 * @param {string}  direction  方向筛选（可选）
 * @param {boolean} onlyMine   只看我的（可选）
 * @param {string}  keyword    名称关键词（可选）
 */
async function list(params, ctx) {
  const { stage = '', direction = '', onlyMine = false, keyword = '', page = 1, size = 20 } = params || {};

  const where = { status: 'active' };
  if (stage && STAGES.includes(stage)) where.stage = stage;
  if (direction && DIRECTIONS.includes(direction)) where.direction = direction;
  if (keyword) {
    where.name = db().RegExp({ regexp: escapeReg(String(keyword).trim()), options: 'i' });
  }
  if (onlyMine) {
    ctx.requireLogin();
    where.ownerOpenid = ctx.openid;
  }

  const col = db().collection('projects');
  const countRes = await col.where(where).count();
  const listRes = await col
    .where(where)
    .orderBy('featured', 'desc')
    .orderBy('updatedAt', 'desc')
    .skip((page - 1) * size)
    .limit(Math.min(size, 50))
    .get();

  return { total: countRes.total, list: listRes.data, page, size };
}

/**
 * 项目详情：档案 + 进展时间线 + 留言（一次拉齐，省请求数）
 */
async function detail(params, ctx) {
  const { id } = params || {};
  const project = await getProject(id);

  // 浏览量 +1（尽力而为，失败不影响主流程）
  db()
    .collection('projects')
    .doc(id)
    .update({ data: { viewCount: _.inc(1) } })
    .catch(() => {});

  const [updates, comments] = await Promise.all([
    db()
      .collection('project_updates')
      .where({ projectId: id, status: 'active' })
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get(),
    db()
      .collection('project_comments')
      .where({ projectId: id, status: 'active' })
      .orderBy('createdAt', 'asc')
      .limit(100)
      .get()
  ]);

  return { project, updates: updates.data, comments: comments.data };
}

/** 项目留言分页（详情页已带 100 条，此接口供后续扩展） */
async function comments(params, ctx) {
  const { projectId, page = 1, size = 50 } = params || {};
  if (!projectId) throw badRequest('缺少项目 ID');
  const where = { projectId, status: 'active' };
  const col = db().collection('project_comments');
  const countRes = await col.where(where).count();
  const listRes = await col
    .where(where)
    .orderBy('createdAt', 'asc')
    .skip((page - 1) * size)
    .limit(Math.min(size, 100))
    .get();
  return { total: countRes.total, list: listRes.data, page, size };
}

/** ============ 项目档案 ============ */

/** 创建项目 */
async function create(params, ctx) {
  ctx.requireLogin();
  const { name, direction, stage, summary = '', outcome = '', members = '', competitionId = '', competitionName = '' } = params || {};

  if (!name || !String(name).trim()) throw badRequest('请填写项目名称');
  if (!DIRECTIONS.includes(direction)) throw badRequest('请选择技术方向');
  if (!STAGES.includes(stage)) throw badRequest('请选择项目阶段');

  await ensure('projects');
  const res = await db()
    .collection('projects')
    .add({
      data: {
        ownerOpenid: ctx.openid,
        ownerName: displayName(ctx.user),
        name: String(name).trim().slice(0, 40),
        direction,
        stage,
        summary: String(summary || '').trim().slice(0, 120),
        outcome: String(outcome || '').trim().slice(0, 2000),
        members: String(members || '').trim().slice(0, 120),
        competitionId: String(competitionId || ''),
        competitionName: String(competitionName || ''),
        updateCount: 0,
        commentCount: 0,
        viewCount: 0,
        featured: false,
        featuredBy: '',
        status: 'active',
        createdAt: now(),
        updatedAt: now()
      }
    });

  return { projectId: res._id };
}

/** 编辑项目（项目主人或管理员） */
async function update(params, ctx) {
  ctx.requireLogin();
  const { id, name, direction, stage, summary, outcome, members, competitionId, competitionName } = params || {};
  const project = await getProject(id);
  if (project.ownerOpenid !== ctx.openid && !ctx.isAdmin) {
    throw forbidden('只有项目主人可以编辑');
  }

  const data = { updatedAt: now() };
  if (name !== undefined && String(name).trim()) data.name = String(name).trim().slice(0, 40);
  if (direction !== undefined && DIRECTIONS.includes(direction)) data.direction = direction;
  if (stage !== undefined && STAGES.includes(stage)) data.stage = stage;
  if (summary !== undefined) data.summary = String(summary).trim().slice(0, 120);
  if (outcome !== undefined) data.outcome = String(outcome).trim().slice(0, 2000);
  if (members !== undefined) data.members = String(members).trim().slice(0, 120);
  if (competitionId !== undefined) data.competitionId = String(competitionId || '');
  if (competitionName !== undefined) data.competitionName = String(competitionName || '');

  await db()
    .collection('projects')
    .doc(id)
    .update({ data });
  return { projectId: id };
}

/** 删除项目（软删除：项目主人或管理员） */
async function remove(params, ctx) {
  ctx.requireLogin();
  const { id } = params || {};
  const project = await getProject(id);
  if (project.ownerOpenid !== ctx.openid && !ctx.isAdmin) {
    throw forbidden('只有项目主人或管理员可以删除');
  }
  await db()
    .collection('projects')
    .doc(id)
    .update({ data: { status: 'removed', updatedAt: now() } });
  return { projectId: id };
}

/** ============ 项目进展 ============ */

/** 发布进展（项目主人；管理员兜底可代发） */
async function addUpdate(params, ctx) {
  ctx.requireLogin();
  const { projectId, content } = params || {};
  const project = await getProject(projectId);
  if (project.ownerOpenid !== ctx.openid && !ctx.isAdmin) {
    throw forbidden('只有项目主人可以发布进展');
  }
  if (!content || !String(content).trim()) throw badRequest('请填写进展内容');

  await ensure('project_updates');
  await db()
    .collection('project_updates')
    .add({
      data: {
        projectId,
        authorOpenid: ctx.openid,
        authorName: displayName(ctx.user),
        content: String(content).trim().slice(0, 2000),
        status: 'active',
        createdAt: now()
      }
    });
  await db()
    .collection('projects')
    .doc(projectId)
    .update({ data: { updateCount: _.inc(1), updatedAt: now() } });
  return { ok: true };
}

/** 删除进展（作者本人或管理员） */
async function removeUpdate(params, ctx) {
  ctx.requireLogin();
  const { id } = params || {};
  if (!id) throw badRequest('缺少进展 ID');
  const res = await db()
    .collection('project_updates')
    .doc(id)
    .get()
    .catch(() => null);
  if (!res || !res.data || res.data.status === 'removed') throw notFound('进展不存在');
  if (res.data.authorOpenid !== ctx.openid && !ctx.isAdmin) {
    throw forbidden('只能删除自己发布的进展');
  }

  await db()
    .collection('project_updates')
    .doc(id)
    .update({ data: { status: 'removed' } });
  await db()
    .collection('projects')
    .doc(res.data.projectId)
    .update({ data: { updateCount: _.inc(-1) } })
    .catch(() => {});
  return { id };
}

/** ============ 留言 ============ */

/** 发表留言（登录用户） */
async function addComment(params, ctx) {
  ctx.requireLogin();
  const { projectId, content } = params || {};
  if (!projectId) throw badRequest('缺少项目 ID');
  if (!content || !String(content).trim()) throw badRequest('请填写留言内容');
  await getProject(projectId);

  await ensure('project_comments');
  await db()
    .collection('project_comments')
    .add({
      data: {
        projectId,
        authorOpenid: ctx.openid,
        authorName: displayName(ctx.user),
        authorRole: ctx.role,
        content: String(content).trim().slice(0, 500),
        status: 'active',
        createdAt: now()
      }
    });
  await db()
    .collection('projects')
    .doc(projectId)
    .update({ data: { commentCount: _.inc(1) } });
  return { ok: true };
}

/** 删除留言（本人或教师/管理员） */
async function removeComment(params, ctx) {
  ctx.requireLogin();
  const { id } = params || {};
  if (!id) throw badRequest('缺少留言 ID');
  const res = await db()
    .collection('project_comments')
    .doc(id)
    .get()
    .catch(() => null);
  if (!res || !res.data || res.data.status === 'removed') throw notFound('留言不存在');
  if (res.data.authorOpenid !== ctx.openid && !ctx.isTeacher) {
    throw forbidden('没有权限删除该留言');
  }

  await db()
    .collection('project_comments')
    .doc(id)
    .update({ data: { status: 'removed' } });
  await db()
    .collection('projects')
    .doc(res.data.projectId)
    .update({ data: { commentCount: _.inc(-1) } })
    .catch(() => {});
  return { id };
}

/** ============ 教师推荐 ============ */

/** 推荐/取消推荐（教师/管理员）；推荐项目在广场置顶展示 */
async function feature(params, ctx) {
  ctx.requireRole('teacher', 'admin');
  const { projectId, featured = true } = params || {};
  await getProject(projectId);

  await db()
    .collection('projects')
    .doc(projectId)
    .update({
      data: {
        featured: !!featured,
        featuredBy: featured ? displayName(ctx.user) : '',
        updatedAt: now()
      }
    });
  return { projectId, featured: !!featured };
}

module.exports = {
  list,
  detail,
  comments,
  create,
  update,
  remove,
  addUpdate,
  removeUpdate,
  addComment,
  removeComment,
  feature
};
