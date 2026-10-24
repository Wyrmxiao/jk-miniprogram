// pkgAuth/login/login.js
const { refreshLogin } = require('../../utils/request');
const { getProfile } = require('../../utils/auth');

Page({
  data: {
    loading: false,
    agreed: false,
    needPrivacy: false
  },

  onLoad() {
    const app = getApp();
    this.setData({ needPrivacy: !!(app && app.globalData.needPrivacy) });
  },

  onAgreeChange(e) {
    this.setData({ agreed: e.detail.value.length > 0 });
  },

  onAgreePrivacy() {
    if (!wx.requirePrivacyAuthorize) {
      this.setData({ needPrivacy: false });
      return;
    }
    wx.requirePrivacyAuthorize({
      success: () => this.setData({ needPrivacy: false }),
      fail: () => wx.showToast({ title: '需同意隐私指引才能使用', icon: 'none' })
    });
  },

  async onLogin() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先阅读并同意隐私保护指引', icon: 'none' });
      return;
    }
    if (this.data.needPrivacy) {
      wx.showToast({ title: '请先完成隐私授权', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    try {
      await refreshLogin();
      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => {
        const profile = getProfile();
        // 未完善资料（含新登录的教师）→ 引导到「完善资料」页填写
        if (profile && profile.authStatus !== 'approved') {
          wx.redirectTo({ url: '/pkgAuth/realname/realname' });
        } else {
          wx.navigateBack({
            fail: () => wx.switchTab({ url: '/pages/index/index' })
          });
        }
      }, 800);
    } catch (e) {
      wx.showToast({ title: '登录失败，请检查云环境配置', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  openAgreement() {
    wx.navigateTo({ url: '/pkgAuth/agreement/agreement' });
  }
});
