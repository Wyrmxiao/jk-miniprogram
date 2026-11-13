/**
 * 智能体域 · 业务处理器
 * 所有场景方法签名固定，后续接入真实模型后前端无需改动
 */
const { badRequest } = require('../utils/response');
const { callLLM, saveConversation } = require('../services/llm');
const { COACH_PROMPT, buildProblemContext } = require('../prompts/errichto-coach');
const {
  ASSISTANT_PROMPT,
  TAG_KEYS,
  BAND_KEYS,
  buildProblemContext: buildAssistantProblemContext
} = require('../prompts/algo-assistant');
const { QA_PROMPT } = require('../prompts/qa-assistant');
// 题库紧凑索引（自动生成：node tools/build_algo_bank_index.js，题库更新后需重跑）
const BANK_INDEX = require('../data/algo_bank_index');

/** 系统提示词：定义助手身份与边界 */
const SYSTEM_PROMPT =
  '你是重庆移通学院计算机学院「计科创新中心」的学习助手。' +
  '面向计算机专业学生，回答要具体、可执行，优先推荐院内有师资与承办单位的 A/B 类竞赛。' +
  '不确定的信息要说明，禁止编造政策、时间与金额。';

/**
 * 题库知识块：学生端真实题库注入 AI 助手（algoAssistant / qaAssistant 共用）。
 * 26 题约 1.2K token，常驻 system prompt 开销可忽略；
 * 题库更新后重跑 tools/build_algo_bank_index.js 并重新部署即可。
 */
const BANK_BAND_NAME = { entry: '简单', basic: '中等', improve: '困难', advanced: '进阶', challenge: '挑战' };
const BANK_SOURCE_NAME = { leetcode: 'LeetCode', nowcoder: '牛客网' };
const BANK_TAG_NAME = new Map(TAG_KEYS.map((t) => [t.key, t.name]));
const BANK_PROMPT = [
  `以下是小程序「算法训练」题库当前全部 ${BANK_INDEX.total} 道题（每行：题名 · 难度 · 平台 · 知识点）：`,
  ...BANK_INDEX.problems.map((p) => {
    const tags = (p.tags || []).map((t) => BANK_TAG_NAME.get(t) || t).join('、');
    const parts = [p.title];
    if (p.titleEn) parts.push(`英文题名 ${p.titleEn}`);
    parts.push(BANK_BAND_NAME[p.band] || p.band);
    parts.push(BANK_SOURCE_NAME[p.source] || p.source);
    if (tags) parts.push(tags);
    return `- ${parts.join(' · ')}`;
  }),
  '推荐题目时只能从上述清单中选择，用题目中文名；清单之外的题一律不要编造。'
].join('\n');

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

/**
 * 算法训练 · 悬浮球 AI 助手
 *
 * 两种意图，模型返回严格 JSON（见 prompts/algo-assistant.js 的输出契约）：
 *   goto   → 学生想刷某类题，前端拿 tag/band 跳到对应题单页
 *   answer → 讲解/答疑，直接展示文本
 * 解析失败时兜底降级为 answer，保证对话永不白屏。
 */
async function algoAssistant(params, ctx) {
  ctx.requireLogin();
  const { message = '', history: hist = [], problem = null } = params || {};
  if (!message) throw badRequest('请输入你的问题');

  const problemCtx = buildAssistantProblemContext(problem);

  const messages = [
    { role: 'system', content: ASSISTANT_PROMPT },
    { role: 'system', content: BANK_PROMPT },
    ...(problemCtx ? [{ role: 'system', content: problemCtx }] : []),
    ...hist.slice(-6).map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: message }
  ];

  // Spark-X2.5 等推理模型官方推荐 temperature=1.0（偏离会降效果）；
  // 找题/答疑是轻任务，关闭思考模式换取响应速度
  const res = await callLLM(messages, { temperature: 1.0, disableThinking: true });
  const intent = parseIntent(res.content, message);
  await saveConversation(ctx.openid, 'algoAssistant', messages, res.content);
  return intent;
}

/** 解析模型 JSON 输出：剥代码块围栏 → 提取首个 {} → 校验合法 key，失败降级为 answer */
function parseIntent(text, fallbackQuestion) {
  const raw = String(text || '').trim();
  let body = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  const match = body.match(/\{[\s\S]*\}/);
  let obj = null;
  if (match) {
    try {
      obj = JSON.parse(match[0]);
    } catch (e) {
      obj = null;
    }
  }

  if (obj && obj.action === 'goto') {
    return normalizeGoto(obj);
  }
  if (obj && obj.action === 'answer' && typeof obj.text === 'string' && obj.text.trim()) {
    return { action: 'answer', text: obj.text.trim() };
  }

  // 模型没按契约输出：若整段是纯文本就直接当回答，否则给兜底话术
  const clean = body.replace(/```/g, '').trim();
  return {
    action: 'answer',
    text: clean && clean.length <= 500 ? clean : `这个问题我先记下了（“${fallbackQuestion}”），你可以换个说法再问我，或直接去题单页筛选知识点。`
  };
}

/** goto 意图归一化：key 必须在合法表内，非法回空串；补齐中文名给前端展示 */
function normalizeGoto(obj) {
  const tagKey = TAG_KEYS.some((t) => t.key === obj.tag) ? String(obj.tag) : '';
  const bandKey = BAND_KEYS.some((b) => b.key === obj.band) ? String(obj.band) : '';
  const tagName = tagKey ? (TAG_KEYS.find((t) => t.key === tagKey) || {}).name : '全部知识点';
  const bandName = bandKey ? (BAND_KEYS.find((b) => b.key === bandKey) || {}).name : '';
  const text =
    typeof obj.text === 'string' && obj.text.trim()
      ? obj.text.trim()
      : `已为你选好${tagName}${bandName ? ' · ' + bandName : ''}的题目`;
  return { action: 'goto', tag: tagKey, band: bandKey, tagName, bandName, text };
}

/**
 * 学习问答 · 悬浮球 AI 答疑助手
 *
 * 与 algoAssistant 的区别：不做跳题单意图，永远返回纯文本回答
 * （返回结构与 algoAssistant 的 answer 分支一致：{ action:'answer', text }，
 *  前端组件按 scene 区分，qa 场景不渲染「去刷题」按钮）。
 */
async function qaAssistant(params, ctx) {
  ctx.requireLogin();
  const { message = '', history: hist = [] } = params || {};
  if (!message) throw badRequest('请输入你的问题');

  const messages = [
    { role: 'system', content: QA_PROMPT },
    { role: 'system', content: BANK_PROMPT },
    ...hist.slice(-6).map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: message }
  ];

  // 悬浮球答疑：提示词已约束 200 字内，max_tokens 兜底防长输出拖慢响应
  const res = await callLLM(messages, {
    temperature: 1.0,
    maxTokens: 500,
    disableThinking: true
  });
  await saveConversation(ctx.openid, 'qaAssistant', messages, res.content);
  return { action: 'answer', text: res.content };
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
  algoAssistant,
  qaAssistant,
  history
};
