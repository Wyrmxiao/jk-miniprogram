// pages/mine/mine.js
const { announce, contest, auth } = require('../../services/index');
const { getProfile, isTeacher, isVerified, isLogin } = require('../../utils/auth');
const favorite = require('../../utils/favorite');
const { ROLE_TEXT, AUTH_STATUS_TEXT, MY_CONTEST_STATUS_TEXT } = require('../../constants/index');

/** 关注状态 → 标签配色 */
const STATUS_CLASS = {
  watch: 'tag-primary',
  signed: 'tag-success',
  preparing: 'tag-warning',
  finished: 'tag'
};

Page({
  data: {
    profile: null,
    isTeacher: false,
    isAdmin: false,
    isVerified: false,
    isLogin: false,
    roleText: '',
    authStatusText: '',
    // 管理员系统面板
    systemStatus: null,
    // 教师：我发布的公告
    myAnnouncements: [],
    showMyAnnounce: false,
    // 学生/教师：我关注的赛事
    myContests: []
  },

  onShow() {
    this.applyIdentity();
  },

  /** 从本地登录态计算身份并渲染（激活/完善资料后调用） */
  applyIdentity() {
    const profile = getProfile();
    const role = (profile && profile.role) || 'guest';
    const authStatus = (profile && profile.authStatus) || 'none';
    const admin = role === 'admin';
    this.setData({
      profile,
      isTeacher: isTeacher(),
      isAdmin: admin,
      isVerified: isVerified(),
      isLogin: isLogin(),
      roleText: ROLE_TEXT[role] || '游客',
      authStatusText: AUTH_STATUS_TEXT[authStatus] || '未认证'
    });
    if (admin) this.loadSystemStatus();
    // 只要登录就可读「我关注的赛事」（云端 myList 仅要求登录）
    if (this.data.isLogin) this.loadMyContests();
  },

  /** 我关注的赛事（报名时间/开赛时间/往期惯例） */
  async loadMyContests() {
    try {
      const res = await contest.myList({ page: 1, size: 50 });
      const list = (res.list || []).map((m) => {
        const c = m.competition || {};
        return {
          _id: m._id,
          competitionId: m.competitionId,
          name: c.name || '赛事已下架',
          level: c.level || '',
          statusText: MY_CONTEST_STATUS_TEXT[m.status] || '关注',
          statusClass: STATUS_CLASS[m.status] || 'tag-primary',
          timeText: this.buildRaceTime(c)
        };
      });
      // 云端是真相：把云端关注合并进本地缓存，保证赛事库星标一致
      favorite.addMany(list.map((x) => x.competitionId));
      this.setData({ myContests: list });
    } catch (e) {
      this.setData({ myContests: [] });
    }
  },

  /** 赛事时间文案：优先官方精确日期，否则往期惯例月份 */
  buildRaceTime(c) {
    if (c.regEnd) return '报名截止 ' + String(c.regEnd).slice(0, 10);
    if (c.contestDate) return '开赛 ' + String(c.contestDate).slice(0, 10);
    const ms = c.typicalMonths;
    if (ms && ms.length) return '往届惯例 ' + ms.join('/') + ' 月报名';
    return '时间待定';
  },

  // ===== 管理员：系统状态 =====
  async loadSystemStatus() {
    try {
      const res = await auth.bootstrap({ viewOnly: true });
      this.setData({ systemStatus: res });
    } catch (e) {
      /* 静默 */
    }
  },

  /** 重新导入 83 号文赛事库（覆盖式） */
  async forceReseed() {
    const ok = await new Promise((resolve) => {
      wx.showModal({
        title: '重新导入竞赛库',
        content: '将按学校 83 号文附件重新覆盖导入全部赛事，确认继续？',
        success: (r) => resolve(!!r.confirm),
        fail: () => resolve(false)
      });
    });
    if (!ok) return;
    try {
      const res = await contest.importSeed({ force: true });
      wx.showToast({ title: `已导入 ${res.imported} 项`, icon: 'success' });
      this.loadSystemStatus();
    } catch (e) {
      /* 错误已在 request 层提示 */
    }
  },

  /** 重跑系统初始化（建配置 + 提升管理员 + 导入数据） */
  async rerunInit() {
    const app = getApp();
    wx.showLoading({ title: '初始化中', mask: true });
    try {
      await app.rerunSystemInit();
      await this.loadSystemStatus();
      wx.showToast({ title: '初始化完成', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '初始化未完成', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  /** 管理员：打开「用户与权限」页，查看全部用户并分配角色 */
  goUsers() {
    wx.navigateTo({ url: '/pkgWork/admin/users/users' });
  },

  goLogin() {
    wx.navigateTo({ url: '/pkgAuth/login/login' });
  },

  /** 弹层占位：catchtap 阻止事件冒泡到遮罩 */
  noop() {},

  goRealname() {
    wx.navigateTo({ url: '/pkgAuth/realname/realname' });
  },

  goAgreement() {
    wx.navigateTo({ url: '/pkgAuth/agreement/agreement' });
  },

  // ===== 教师发布公告（独立页面） =====
  goPublishAnnounce() {
    wx.navigateTo({ url: '/pkgWork/announce/publish' });
  },

  goPublishTask() {
    wx.navigateTo({ url: '/pkgWork/task/publish' });
  },

  goManageContest() {
    wx.navigateTo({ url: '/pkgContest/manage/manage' });
  },

  /** 去赛事库（tab 页） */
  goContest() {
    wx.switchTab({ url: '/pages/contest/contest' });
  },

  /** 关注的赛事 → 赛事详情 */
  goContestDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/contest/detail/detail?id=' + id });
  },

  // ===== 教师：我发布的公告 =====
  async goMyAnnouncements() {
    try {
      const res = await announce.myList({ page: 1, size: 50 });
      this.setData({ myAnnouncements: res.list || [], showMyAnnounce: true });
    } catch (e) {
      /* 静默 */
    }
  },

  closeMyAnnounce() {
    this.setData({ showMyAnnounce: false });
  },

  async removeAnnounce(e) {
    const { id } = e.currentTarget.dataset;
    const ok = await new Promise((resolve) => {
      wx.showModal({
        title: '删除公告',
        content: '删除后学生端不再可见，确认删除？',
        success: (r) => resolve(!!r.confirm),
        fail: () => resolve(false)
      });
    });
    if (!ok) return;
    try {
      await announce.remove({ id });
      wx.showToast({ title: '已删除', icon: 'success' });
      this.goMyAnnouncements();
    } catch (e) {
      /* 错误已在 request 层提示 */
    }
  }
});
