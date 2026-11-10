// pkgContest/profile/profile.js —— 个人主页：头像信息 + 赛事统计入口（可分享）
const { contest } = require('../../services/index');
const { getProfile, isLogin } = require('../../utils/auth');

Page({
  data: {
    loading: true,
    openid: '',
    isSelf: false,
    user: null,
    isLogin: false
  },

  onLoad(options) {
    const profile = getProfile();
    const selfOpenid = (profile && profile.openid) || '';
    const target = (options && options.openid) || '';
    this.setData({
      openid: target || selfOpenid,
      isSelf: !target || target === selfOpenid
    });
  },

  onShow() {
    this.setData({ isLogin: isLogin() });
    this.load();
  },

  onPullDownRefresh() {
    this.load(true);
  },

  async load(fromPull) {
    this.setData({ loading: true });
    try {
      // 不传 openid = 查自己
      const params = this.data.isSelf ? {} : { openid: this.data.openid };
      const res = await contest.myProfile(params);
      this.setData({ loading: false, user: res.user });
    } catch (e) {
      this.setData({ loading: false });
    } finally {
      if (fromPull) wx.stopPullDownRefresh();
    }
  },

  /** 转发：带 openid，别人打开就是这份档案 */
  onShareAppMessage() {
    const name = (this.data.user && this.data.user.name) || '我';
    return {
      title: name + ' 的个人主页',
      path: '/pkgContest/profile/profile?openid=' + this.data.openid
    };
  },

  /** 赛事统计 → 总览页（两个板块） */
  goMyStats() {
    let url = '/pkgContest/mystats/mystats';
    if (!this.data.isSelf && this.data.openid) url += '?openid=' + this.data.openid;
    wx.navigateTo({ url });
  }
});
