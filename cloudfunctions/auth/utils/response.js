/**
 * 统一响应格式（后端公共层）
 * 前端 utils/request.js 依赖该结构，所有云函数必须遵守
 */

/** 成功 */
function ok(data) {
  return { code: 0, msg: 'ok', data: data === undefined ? null : data };
}

/** 失败 */
function fail(msg = '请求失败', code = 400) {
  return { code, msg, data: null };
}

/** 业务异常：带 code，会被 index.js 捕获并转成响应 */
class BizError extends Error {
  constructor(msg, code = 400) {
    super(msg);
    this.name = 'BizError';
    this.code = code;
  }
}

/** 未登录 */
function unauthorized(msg = '请先登录') {
  return new BizError(msg, 401);
}

/** 无权限 */
function forbidden(msg = '没有操作权限') {
  return new BizError(msg, 403);
}

/** 参数缺失 */
function badRequest(msg = '参数不完整') {
  return new BizError(msg, 400);
}

/** 资源不存在 */
function notFound(msg = '内容不存在') {
  return new BizError(msg, 404);
}

module.exports = {
  ok,
  fail,
  BizError,
  unauthorized,
  forbidden,
  badRequest,
  notFound
};
