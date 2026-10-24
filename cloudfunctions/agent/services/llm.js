/**
 * 智能体域 · 大模型接入预留
 *
 * 现状：未配置任何模型服务，调用会返回「未启用」提示，不影响其他功能。
 * 接入步骤（后续要接智能体 API 时只改本目录）：
 *   1. 在下方 PROVIDERS 里加一个供应商配置，或在云函数环境变量里配置
 *      LLM_BASE_URL / LLM_API_KEY / LLM_MODEL
 *   2. 实现 callLLM()，用 axios 或 wx-server-sdk 自带的 http 请求访问模型接口
 *   3. handlers/agent.js 里的场景方法保持不变，前端无需改动
 *
 * 建议接入场景：
 *   suggestRoadmap 根据学生测评结果生成个性化学习路线
 *   contestAdvice  根据竞赛与学生方向给出备赛建议
 *   reviewLog      AI 先点评学习记录，再由老师复核
 *   chat           通用问答助手
 */
const cloud = require('wx-server-sdk');

const db = () => cloud.database();
const now = () => db().serverDate();

/** 供应商配置：优先读环境变量，便于不同环境切换 */
const PROVIDERS = {
  default: {
    baseUrl: process.env.LLM_BASE_URL || '',
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || '',
    enabled: false
  }
};

/**
 * 调用大模型
 * TODO: 接入时实现。参考返回结构 { content: string, usage: object }
 */
async function callLLM(messages, options = {}) {
  const cfg = PROVIDERS[options.provider || 'default'];
  if (!cfg || !cfg.enabled || !cfg.baseUrl || !cfg.apiKey) {
    const err = new Error('智能体服务未启用，请先配置模型服务');
    err.code = 503;
    throw err;
  }

  // 接入示例（需安装 axios 或使用 https 模块）：
  // const axios = require('axios')
  // const res = await axios.post(`${cfg.baseUrl}/chat/completions`, {
  //   model: cfg.model,
  //   messages
  // }, { headers: { Authorization: `Bearer ${cfg.apiKey}` } })
  // return { content: res.data.choices[0].message.content, usage: res.data.usage }

  throw new Error('callLLM 尚未实现');
}

/** 保存会话记录，便于后续分析与审计 */
async function saveConversation(openid, scene, messages, reply) {
  try {
    await db().collection('ai_conversations').add({
      data: {
        openid,
        scene,
        messages,
        reply,
        createdAt: now()
      }
    });
  } catch (e) {
    console.error('保存智能体会话失败', e);
  }
}

module.exports = { PROVIDERS, callLLM, saveConversation };
