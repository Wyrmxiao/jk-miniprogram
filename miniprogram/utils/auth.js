/**
 * 登录态与身份
 * 前端只做展示层判断，真正的权限校验在后端云函数里
 */
const { STORAGE_KEY, ROLE, AUTH_STATUS } = require('../constants/index');
const { refreshLogin } = require('./request');

/** 取本地缓存的用户信息（可能为 null） */
function getProfile() {
  return wx.getStorageSync(STORAGE_KEY.PROFILE) || null;
}

function setProfile(profile) {
  wx.setStorageSync(STORAGE_KEY.PROFILE, profile);
  const app = getApp();
  if (app) app.globalData.profile = profile;
}

function getRole() {
  const p = getProfile();
  return (p && p.role) || ROLE.GUEST;
}

function isLogin() {
  const p = getProfile();
  return !!(p && p.openid);
}

/** 是否已通过实名认证的学生/教师 */
function isVerified() {
  const p = getProfile();
  return !!(p && p.authStatus === AUTH_STATUS.APPROVED);
}

function isTeacher() {
  const r = getRole();
  return r === ROLE.TEACHER || r === ROLE.ADMIN;
}

function isAdmin() {
  return getRole() === ROLE.ADMIN;
}

function clear() {
  wx.removeStorageSync(STORAGE_KEY.PROFILE);
  const app = getApp();
  if (app) app.globalData.profile = null;
}

/**
 * 页面/组件里确保已登录，未登录则跳登录页
 * @returns {Promise<boolean>} 是否已登录
 */
function ensureLogin() {
  if (isLogin()) return Promise.resolve(true);
  return refreshLogin()
    .then(() => true)
    .catch(() => {
      wx.navigateTo({ url: '/pkgAuth/login/login' });
      return false;
    });
}

module.exports = {
  getProfile,
  setProfile,
  getRole,
  isLogin,
  isVerified,
  isTeacher,
  isAdmin,
  clear,
  ensureLogin
};
