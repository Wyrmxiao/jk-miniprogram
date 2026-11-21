// pkgContest/profile/profile.js —— 个人主页：头像信息 + 赛事统计入口 + 已完成项目（支持链接分享）
const { contest, project } = require('../../services/index');
const { getProfile, isLogin } = require('../../utils/auth');

Page({
  data: {
    loading: true,
    openid: '',
    isSelf: false,
    user: null,
    isLogin: false,
    copying: false,
    // 已完成项目（只展示名称与简介；详情需项目主人通过访问申请）
    projects: [],
    projAccess: 'none' // self | approved | pending | rejected | none
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
      // 已完成项目并行加载，不阻塞主页展示
      this.loadProjects();
    } catch (e) {
      this.setData({ loading: false });
    } finally {
      if (fromPull) wx.stopPullDownRefresh();
    }
  },

  /** 已完成项目（本人也展示，点卡片直接看详情；他人点卡片走申请流程） */
  async loadProjects() {
    const params = this.data.isSelf ? {} : { ownerOpenid: this.data.openid };
    try {
      const res = await project.ownerProjects(params);
      this.setData({
        projects: res.list || [],
        projAccess: res.access || 'none'
      });
    } catch (e) {
      /* 静默：项目加载失败不影响主页 */
      this.setData({ projects: [], projAccess: 'none' });
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
  },

  /** ============ 已完成项目 ============ */

  /** 点项目卡片：可看直接进详情；否则引导申请 */
  goProject(e) {
    const id = e.currentTarget.dataset.id;
    const open = String(e.currentTarget.dataset.open) === '1';
    if (!id) return;

    if (open) {
      wx.navigateTo({ url: '/pages/project/detail?id=' + id });
      return;
    }
    if (!this.data.isLogin) {
      wx.showToast({ title: '请先登录后申请查看', icon: 'none' });
      return;
    }
    if (this.data.projAccess === 'pending') {
      wx.showToast({ title: '申请已提交，等对方在「信息」里通过', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '查看项目详情',
      content: '需要向 TA 发起申请，对方通过后即可查看 TA 的项目详情',
      confirmText: '申请查看',
      success: (r) => {
        if (!r.confirm) return;
        this.applyView();
      }
    });
  },

  /** 发起查看申请（云端按 ownerOpenid 去重：已通过/待审核会直接返回现状） */
  async applyView() {
    if (this.data.projAccess === 'pending') return;
    try {
      await project.accessApply({ ownerOpenid: this.data.openid });
      this.setData({ projAccess: 'pending' });
      wx.showToast({ title: '申请已发送', icon: 'none' });
    } catch (e) {
      /* 错误已在 request 层提示 */
    }
  }
});
