/**
 * 公告域 · 云函数入口
 *
 * 统一入口：所有请求 { action, params } 进来后按 action 分发
 * 新增业务只需动 router.js 与 handlers/，本文件无需修改
 */
const cloud = require('wx-server-sdk');
const router = require('./router');
const { buildContext } = require('./middleware/context');
const { ok, fail, BizError } = require('./utils/response');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event = {}) => {
  const { action, params = {} } = event;

  if (!action) return fail('缺少 action', 400);

  const handler = router[action];
  if (!handler) return fail(`未知接口: ${action}`, 404);

  try {
    const ctx = await buildContext();
    const data = await handler(params, ctx);
    return ok(data);
  } catch (err) {
    if (err instanceof BizError || err.code) {
      return fail(err.message || '请求失败', err.code || 400);
    }
    console.error(`[announce:${action}] 执行失败`, err);
    // __debug=true 时返回真实错误，便于联机排障
    const detail = event.__debug ? String((err && err.message) || err) : '服务异常，请稍后重试';
    return fail(detail, 500);
  }
};
