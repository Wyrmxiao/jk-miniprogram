/**
 * 智能体域 · 业务处理器
 * 所有场景方法签名固定，后续接入真实模型后前端无需改动
 */
const { badRequest } = require('../utils/response');
const { callLLM, saveConversation } = require('../services/llm');
const { COACH_PROMPT, buildProblemContext } = require('../prompts/errichto-coach');

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

/**
 * 算法教练 · Errichto 视角
 *
 * 场景：学生在题目详情页或背题页发问，比如「这题为什么要用双指针」
 * 「我卡了两小时了」「动态规划到底怎么练」。
 *
 * 设计要点（改动前请先读 prompts/errichto-coach.js 的文件头）：
 *   1. 系统提示词只有约 1100 token，知识上下文按题注入约 130 token，
 *      留足空间给对话历史和输出，适合小程序高频短问答。
 *   2. problem 是可选的。学生从题目页进来会带上，纯方法论提问不带。
 *   3. 不查数据库。题库以静态 JSON 随 learn 云函数部署，这里只接收前端传入的题目元信息，
 *      避免在 agent 域再引一次 820 题的数据文件。
 */
async function algoCoach(params, ctx) {
  ctx.requireLogin();
  const { message = '', problem = null, history: hist = [] } = params || {};
  if (!message) throw badRequest('请输入你的问题');

  // 按题注入知识点训练要点，控制在 200 token 内
  const problemCtx = buildProblemContext(problem);

  const messages = [
    { role: 'system', content: COACH_PROMPT },
    ...(problemCtx ? [{ role: 'system', content: problemCtx }] : []),
    ...hist.slice(-6).map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: message }
  ];

  const res = await callLLM(messages, { temperature: 0.7 });
  await saveConversation(ctx.openid, 'algoCoach', messages, res.content);
  return { reply: res.content };
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
  algoCoach,
  history
};
