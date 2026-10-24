/**
 * 前后端通信唯一出口
 *
 * 约定：前端永远不直接操作数据库，全部走云函数。
 * 后端统一响应：{ code: 0, msg: 'ok', data: any }，code !== 0 为业务失败。
 *
 * 用法：
 *   const { request } = require('../../utils/request')
 *   request(DOMAIN.CONTEST, 'list', { level: 'A', page: 1 })
 */
const { STORAGE_KEY } = require('../constants/index');

/** 是否正在跳转登录，避免并发重复跳 */
let jumpingToLogin = false;

/** 统一错误提示（可关闭） */
function toastError(msg) {
  if (!msg) return;
  wx.showToast({ title: String(msg).slice(0, 30), icon: 'none', duration: 2000 });
}

/**
 * 调用后端
 * @param {string} domain  服务域（云函数名），见 constants.DOMAIN
 * @param {string} action  业务动作，后端 router 按此分发
 * @param {object} params  业务参数
 * @param {object} options { silent: 不提示错误, loading: 显示加载文案, retry: 401 时重试一次 }
 */
function request(domain, action, params = {}, options = {}) {
  const { silent = false, loading = '', retry = true } = options;

  if (loading) wx.showLoading({ title: loading, mask: true });

  return wx.cloud
    .callFunction({
      name: domain,
      data: { action, params }
    })
    .then((res) => {
      const body = (res && res.result) || {};
      const { code, msg, data } = body;

      // 未登录 / 登录态失效
      if (code === 401 && retry) {
        return refreshLogin().then(
          () => request(domain, action, params, Object.assign({}, options, { retry: false })),
          () => {
            gotoLogin();
            return Promise.reject(new Error('登录已失效'));
          }
        );
      }

      if (code === 0) return data;

      if (!silent) toastError(msg || '请求失败');
      return Promise.reject(Object.assign(new Error(msg || '请求失败'), { code, data }));
    })
    .catch((err) => {
      // 云函数本身执行失败（未捕获异常 / 网络问题）
      if (err && err.code === undefined) {
        if (!silent) toastError('网络异常，请稍后重试');
        console.error(`[request] ${domain}.${action} 调用失败`, err);
      }
      return Promise.reject(err);
    })
    .finally(() => {
      if (loading) wx.hideLoading();
    });
}

/** 静默登录：拿 code 换 openid 与身份，后端返回 profile */
function refreshLogin() {
  return wx.cloud
    .callFunction({ name: 'auth', data: { action: 'login', params: {} } })
    .then((res) => {
      const body = (res && res.result) || {};
      if (body.code !== 0) return Promise.reject(new Error(body.msg || '登录失败'));
      wx.setStorageSync(STORAGE_KEY.PROFILE, body.data);
      syncGlobalProfile(body.data);
      return body.data;
    });
}

/** 同步到全局，页面通过 getApp().globalData.profile 读取 */
function syncGlobalProfile(profile) {
  const app = getApp();
  if (app) app.globalData.profile = profile;
}

function gotoLogin() {
  if (jumpingToLogin) return;
  jumpingToLogin = true;
  wx.navigateTo({
    url: '/pkgAuth/login/login',
    complete: () => {
      jumpingToLogin = false;
    }
  });
}

/** 上传文件到云存储，返回 fileID */
function uploadFile(filePath, dir = 'uploads') {
  const ext = (filePath.split('.').pop() || 'png').toLowerCase();
  const cloudPath = `${dir}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
  return wx.cloud.uploadFile({ cloudPath, filePath }).then((res) => res.fileID);
}

module.exports = {
  request,
  refreshLogin,
  uploadFile,
  gotoLogin,
  syncGlobalProfile
};
