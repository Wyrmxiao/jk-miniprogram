/**
 * 路由表：action -> handler
 * 新增接口时，只需要在对应 handler 文件里加一个导出，再在这里注册一行
 */
const agent = require('./handlers/agent');

module.exports = {
  chat: agent.chat,
  suggestRoadmap: agent.suggestRoadmap,
  contestAdvice: agent.contestAdvice,
  reviewLog: agent.reviewLog,
  history: agent.history
};
