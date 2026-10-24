/**
 * 智能体域 · 业务处理器
 * 所有场景方法签名固定，后续接入真实模型后前端无需改动
 */
const { badRequest } = require('../utils/response');
const { callLLM, saveConversation } = require('../services/llm');

/** 系统提示词：定义助手身份与边界 */
const SYSTEM_PROMPT =
  '你是重庆移通学院计算机学院「计科创新中心」的学习助手。' +
  '面向计算机专业学生，回答要具体、可执行，优先推荐院内有师资与承办单位的 A/B 类竞赛。' +
  '不确定的信息要说明，禁止编造政策、时间与金额。';

async function chat(params, ctx) {
  ctx.requireLogin();
  const { message = '', history = [] } = params || {};
  if (!message) throw badRequest('请输入内容');

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-10).map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: message }
  ];

  const res = await callLLM(messages);
  await saveConversation(ctx.openid, 'chat', messages, res.content);
  return { reply: res.content };
}

/** AI 生成学习路线建议 */
async function suggestRoadmap(params, ctx) {
  ctx.requireLogin();
  const { direction = '', level = 'beginner', goal = '' } = params || {};

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `我的方向是${direction || '未确定'}，当前水平${level}，目标：${goal || '提升专业能力并参加竞赛'}。请给出一份分阶段的学习路线，包含每个阶段的目标、任务与建议学时。`
    }
  ];

  const res = await callLLM(messages);
  await saveConversation(ctx.openid, 'suggestRoadmap', messages, res.content);
  return { roadmap: res.content };
}

/** AI 竞赛备赛建议 */
async function contestAdvice(params, ctx) {
  ctx.requireLogin();
  const { competitionId = '', competitionName = '', direction = '' } = params || {};

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `我想参加「${competitionName || competitionId}」，我的方向是${direction || '未确定'}。请给出备赛要点、所需知识储备、时间规划与组队建议。`
    }
  ];

  const res = await callLLM(messages);
  await saveConversation(ctx.openid, 'contestAdvice', messages, res.content);
  return { advice: res.content };
}

/** AI 点评学习记录 */
async function reviewLog(params, ctx) {
  ctx.requireLogin();
  const { title = '', content = '' } = params || {};
  if (!content) throw badRequest('缺少记录内容');

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `请点评这条学习记录，指出亮点与可改进之处。\n标题：${title}\n内容：${content}` }
  ];

  const res = await callLLM(messages);
  await saveConversation(ctx.openid, 'reviewLog', messages, res.content);
  return { review: res.content };
}

/** 会话历史 */
async function history(params, ctx) {
  ctx.requireLogin();
  const cloud = require('wx-server-sdk');
  const { scene = '', page = 1, size = 20 } = params || {};

  const where = { openid: ctx.openid };
  if (scene) where.scene = scene;

  const col = cloud.database().collection('ai_conversations');
  const countRes = await col.where(where).count();
  const listRes = await col
    .where(where)
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * size)
    .limit(size)
    .get();

  return { total: countRes.total, list: listRes.data, page, size };
}

module.exports = {
  chat,
  suggestRoadmap,
  contestAdvice,
  reviewLog,
  history
};
