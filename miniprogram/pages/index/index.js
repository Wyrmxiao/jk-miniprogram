// pages/index/index.js
const { announce, contest, learn, auth } = require('../../services/index');
const { getProfile, isVerified, isTeacher } = require('../../utils/auth');
const { fromNow } = require('../../utils/util');

Page({
  data: {
    loading: true,
    profile: null,
    isTeacher: false,
    isVerified: false,
    showAuthTip: false,
    announcements: [],
    contestTotal: 0,
    pendingCount: 0,
    todoTaskCount: 0
  },

  onLoad() {
    this.loadAll();
  },

  onShow() {
    const profile = getProfile();
    this.setData({
      profile,
      isTeacher: isTeacher(),
      isVerified: isVerified(),
      showAuthTip: !!profile && !isVerified()
    });
    if (isTeacher()) this.loadTeacherData();
    if (isVerified()) this.loadTodoTasks();
  },

  onPullDownRefresh() {
    this.loadAll().then(() => wx.stopPullDownRefresh());
  },

  async loadAll() {
    this.setData({ loading: true });

    const profile = getProfile();
    this.setData({
      profile,
      isTeacher: isTeacher(),
      isVerified: isVerified(),
      showAuthTip: !!profile && !isVerified()
    });

    await Promise.all([this.loadAnnouncements(), this.loadContestTotal()]);
    if (isTeacher()) await this.loadTeacherData();
    if (isVerified()) await this.loadTodoTasks();

    this.setData({ loading: false });
  },

  async loadAnnouncements() {
    try {
      const res = await announce.list({ page: 1, size: 3 });
      const list = (res.list || []).map((a) =>
        Object.assign({}, a, { timeText: fromNow(a.createdAt) })
      );
      this.setData({ announcements: list });
    } catch (e) {
      this.setData({ announcements: [] });
    }
  },

  /** 赛事总数（底部浮窗展示用） */
  async loadContestTotal() {
    try {
      const res = await contest.list({ page: 1, size: 1 });
      this.setData({ contestTotal: res.total || 0 });
    } catch (e) {
      this.setData({ contestTotal: 0 });
    }
  },

  /** 学生待完成的学习任务数 */
  async loadTodoTasks() {
    try {
      const res = await learn.taskList({ page: 1, size: 50 });
      const list = res.list || [];
      const todo = list.filter((t) => t.myStatus === 'todo' || t.myStatus === 'returned');
      this.setData({ todoTaskCount: todo.length });
    } catch (e) {
      this.setData({ todoTaskCount: 0 });
    }
  },

  /** 教师：实名认证待审核数 */
  async loadTeacherData() {
    try {
      const pending = await auth.pendingList({ status: 'pending', page: 1, size: 1 });
      this.setData({ pendingCount: pending.total || 0 });
    } catch (e) {
      /* 教师数据加载失败不影响主流程 */
    }
  },

  // ===== 公告 =====
  openAnno(e) {
    // 全屏详情页（pkgWork/announce/detail），替代原底部小弹层
    wx.navigateTo({ url: '/pkgWork/announce/detail?id=' + e.currentTarget.dataset.id });
  },

  goAnnounceList() {
    wx.navigateTo({ url: '/pkgWork/announce/list' });
  },

  // ===== 跳转 =====
  goLogin() {
    wx.navigateTo({ url: '/pkgAuth/login/login' });
  },

  goRealname() {
    wx.navigateTo({ url: '/pkgAuth/realname/realname' });
  },

  goContest() {
    wx.switchTab({ url: '/pages/contest/contest' });
  },

  goLearn() {
    wx.switchTab({ url: '/pages/learn/learn' });
  },

  goMine() {
    wx.switchTab({ url: '/pages/mine/mine' });
  },

  goPublishAnnounce() {
    wx.navigateTo({ url: '/pkgWork/announce/publish' });
  },

  goPublishTask() {
    wx.navigateTo({ url: '/pkgWork/task/publish' });
  },

  goManageContest() {
    wx.navigateTo({ url: '/pkgContest/manage/manage' });
  },

  goWriteLog() {
    wx.navigateTo({ url: '/pkgWork/log/edit' });
  },

  onShareAppMessage() {
    return {
      title: '计科创新中心 · 计算机能力个性化培养平台',
      path: '/pages/index/index'
    };
  }
});
