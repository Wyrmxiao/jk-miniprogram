// pkgContest/profile/profile.js —— 个人主页：头像信息 + 赛事统计入口（支持链接分享）
const { contest } = require('../../services/index');
const { getProfile, isLogin } = require('../../utils/auth');

Page({
  data: {
    loading: true,
    openid: '',
    isSelf: false,
    user: null,
    isLogin: false,
    copying: false
  },

  onLoad(options) {
    const profile = getProfile();
    const selfOpenid = (profile && profile.openid) || '';

    // 三种进入方式：直接进入（自己）/ ?openid=xxx（分享链接）/ ?scene=xxx（小程序码）
    let target = (options && options.openid) || '';
    if (!target && options && options.scene) {
      try {
        target = decodeURIComponent(options.scene);
      } catch (e) {
        target = options.scene;
      }
    }

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

  /** 转发（右上角「···」）：带 openid，别人打开就是这份档案 */
  onShareAppMessage() {
    const name = (this.data.user && this.data.user.name) || '我';
    return {
      title: name + ' 的个人主页',
      path: '/pkgContest/profile/profile?openid=' + this.data.openid
    };
  },

  // ===== 链接分享 =====

  /** 复制主页链接：对方点开即可看到这份主页 */
  async copyLink() {
    if (this.data.copying) return;
    this.setData({ copying: true });
    wx.showLoading({ title: '生成链接', mask: true });

    try {
      const res = await contest.profileLink({});
      wx.hideLoading();
      if (res && res.link) {
        wx.setClipboardData({ data: res.link });
        wx.showModal({
          title: '链接已复制',
          content: '粘贴发送给微信好友，对方点开即可查看你的主页',
          showCancel: false,
          confirmText: '知道了'
        });
        return;
      }
      // 小程序未发布正式版时无法生成外链，降级为小程序码
      this.useQr();
    } catch (e) {
      wx.hideLoading();
      this.useQr();
    } finally {
      this.setData({ copying: false });
    }
  },

  /** 降级方案：生成主页小程序码，发图片让对方扫码 */
  async useQr() {
    wx.showLoading({ title: '生成小程序码', mask: true });
    try {
      const res = await contest.profileQr({});
      if (!res || !res.fileID) {
        wx.hideLoading();
        const errs = (res && res.errors) || [];
        wx.showModal({
          title: '暂时无法分享',
          content: errs.length
            ? '小程序码生成失败：' + errs.join('；')
            : '可以点右上角「···」直接转发给好友',
          showCancel: false
        });
        return;
      }

      // 用 cloud.downloadFile 直接按 fileID 下载，不走域名白名单，开发/正式版都免配置
      const dl = await wx.cloud.downloadFile({ fileID: res.fileID });
      wx.hideLoading();
      if (!dl.tempFilePath) throw new Error('no file');

      try {
        await wx.showShareImageMenu({ path: dl.tempFilePath });
      } catch (e) {
        wx.previewImage({ urls: [dl.tempFilePath] });
      }
    } catch (e) {
      wx.hideLoading();
      console.error('[useQr] 失败:', e);
      wx.showToast({ title: '小程序码处理失败: ' + (e.errMsg || e.message || ''), icon: 'none' });
    }
  },

  /** 赛事统计 → 总览页（两个板块） */
  goMyStats() {
    let url = '/pkgContest/mystats/mystats';
    if (!this.data.isSelf && this.data.openid) url += '?openid=' + this.data.openid;
    wx.navigateTo({ url });
  }
});
