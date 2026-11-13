/**
 * 智能体域 · 大模型接入（OpenAI 兼容 /chat/completions）
 *
 * 环境变量（云开发控制台 → 云函数 agent → 配置）：
 *   LLM_BASE_URL  如 https://api.openai.com/v1（兼容 DeepSeek/通义/Kimi 等 OpenAI 协议网关）
 *   LLM_API_KEY   对应网关的密钥
 *   LLM_MODEL     模型名，如 deepseek-chat / qwen-plus
 * 三个都配置后自动启用；未配置时调用返回 503「未启用」，不影响其他功能。
 *
 * 实现：Node 原生 https，不引入 axios，部署零额外依赖。
 */
const https = require('https');
const http = require('http');
const { URL } = require('url');

const cloud = require('wx-server-sdk');

const db = () => cloud.database();
const now = () => db().serverDate();

/** 供应商配置：优先读环境变量，便于不同环境切换 */
const PROVIDERS = {
  default: {
    baseUrl: process.env.LLM_BASE_URL || '',
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || '',
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS || 60000),
    get enabled() {
      return !!(this.baseUrl && this.apiKey && this.model);
    }
  }
};

/** OpenAI 兼容补全请求（原生 https，返回 { content, usage }） */
function postChatCompletions(cfg, body) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      const base = cfg.baseUrl.replace(/\/+$/, '');
      url = new URL(base.endsWith('/chat/completions') ? base : base + '/chat/completions');
    } catch (e) {
      return reject(new Error('LLM_BASE_URL 配置不合法'));
    }
    const payload = JSON.stringify(body);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + (url.search || ''),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          Authorization: `Bearer ${cfg.apiKey}`
        },
        timeout: cfg.timeoutMs
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode !== 200) {
            const err = new Error(`模型服务返回 ${res.statusCode}：${raw.slice(0, 200)}`);
            err.code = 502;
            return reject(err);
          }
          try {
            const data = JSON.parse(raw);
            const content =
              data && data.choices && data.choices[0] && data.choices[0].message
                ? data.choices[0].message.content
                : '';
            if (!content) return reject(new Error('模型返回为空'));
            // 防御：个别网关会把思考过程以 <think>...</think> 混进正文，剥掉只留答案
            const cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            if (!cleaned) return reject(new Error('模型返回为空（仅含思考内容）'));
            resolve({ content: cleaned, usage: data.usage || null });
          } catch (e) {
            reject(new Error('模型响应解析失败'));
          }
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error('模型服务响应超时'));
    });
    req.on('error', (e) => {
      const err = new Error(`模型服务连接失败：${e.message}`);
      err.code = 502;
      reject(err);
    });
    req.write(payload);
    req.end();
  });
}

/**
 * 调用大模型
 * @param {Array<{role,content}>} messages OpenAI 消息数组
 * @param {object} options { provider, temperature, maxTokens, disableThinking }
 *   - disableThinking: 关闭推理模型的思考模式（讯飞 Spark-X2.5 等，官方规范 reasoning.effort='none'），
 *     可显著降低响应延迟；需要深度推理的场景不要传
 * @returns {Promise<{content: string, usage: object}>}
 */
async function callLLM(messages, options = {}) {
  const cfg = PROVIDERS[options.provider || 'default'];
  if (!cfg || !cfg.enabled) {
    const err = new Error('智能体服务未启用，请先在云函数环境变量中配置 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL');
    err.code = 503;
    throw err;
  }

  const body = {
    model: cfg.model,
    messages,
    temperature: typeof options.temperature === 'number' ? options.temperature : 0.7
  };
  if (options.maxTokens) body.max_tokens = options.maxTokens;
  if (options.disableThinking) body.reasoning = { effort: 'none' };

  const res = await postChatCompletions(cfg, body);
  return res;
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
