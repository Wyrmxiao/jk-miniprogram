// pages/contest/detail/detail.js
const { contest } = require('../../../services/index');
const { isTeacher, isVerified } = require('../../../utils/auth');

const CATEGORY_TEXT = {
  hardware: '硬件类',
  scienceOther: '理工其他',
  humanity: '人文社科'
};

const MONTH_TEXT = {
  1: '一月', 2: '二月', 3: '三月', 4: '四月', 5: '五月', 6: '六月',
  7: '七月', 8: '八月', 9: '九月', 10: '十月', 11: '十一月', 12: '十二月'
};

Page({
  data: {
    id: '',
    loading: true,
    detail: null,
    categoryText: '',
    /** 时间展示：精确日期或往期惯例 */
    timeRows: [],
    timeNote: '',
    announcements: [],
    isTeacher: false,
    isVerified: false,
    following: false
  },

  onLoad(options) {
    this.setData({ id: (options && options.id) || '' });
    this.loadDetail();
  },

  onShow() {
    this.setData({ isTeacher: isTeacher(), isVerified: isVerified() });
  },

  async loadDetail() {
    if (!this.data.id) {
      this.setData({ loading: false });
      return;
    }
    this.setData({ loading: true });
    try {
      const d = await contest.detail({ id: this.data.id });
      this.setData({
        detail: d,
        categoryText: CATEGORY_TEXT[d.category] || '',
        timeRows: this.buildTimeRows(d),
        timeNote: this.buildTimeNote(d),
        announcements: (d.announcements || []).map((a) => a),
        following: !!(d.mine && d.mine.status === 'following'),
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  /** 时间安排行：优先官方精确日期，否则展示往期惯例月份 */
  buildTimeRows(d) {
    const rows = [];
    if (d.regStart) rows.push({ label: '报名开始', value: d.regStart });
    if (d.regEnd) rows.push({ label: '报名截止', value: d.regEnd, strong: true });
    if (d.contestDate) rows.push({ label: '比赛时间', value: d.contestDate, strong: true });
    return rows;
  },

  buildTimeNote(d) {
    if (d.regEnd || d.contestDate) return '以上为本届已公布时间，最终以官方通知为准';
    const ms = Array.isArray(d.typicalMonths) ? d.typicalMonths.slice().sort((a, b) => a - b) : [];
    if (!ms.length) return '该赛事时间尚未公布，可关注官方渠道获取通知';
    return '往届惯例于 ' + ms.map((m) => MONTH_TEXT[m] || m + '月').join('、') + ' 启动，今年具体时间以官方通知为准';
  },

  /** 打开赛事官网：个人主体无业务域名，采用复制链接 + 引导浏览器打开 */
  copyUrl() {
    const url = (this.data.detail && this.data.detail.officialUrl) || '';
    if (!url) {
      wx.showToast({ title: '暂无官网链接', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: url,
      success: () => {
        wx.showModal({
          title: '链接已复制',
          content: '小程序内无法直接打开外部网站，请打开浏览器粘贴访问：\n' + url,
          showCancel: false,
          confirmText: '知道了'
        });
      }
    });
  },

  async toggleFollow() {
    if (!this.data.isVerified) {
      wx.showToast({ title: '请先完善实名资料', icon: 'none' });
      return;
    }
    try {
      await contest.follow({ competitionId: this.data.id });
      this.setData({ following: !this.data.following });
      wx.showToast({ title: this.data.following ? '已关注' : '已取消关注', icon: 'success' });
    } catch (e) {
      /* 错误已在 request 层提示 */
    }
  },

  goManage() {
    wx.navigateTo({ url: '/pkgContest/manage/manage' });
  },

  goAnnounce(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pkgWork/announce/detail?id=' + id });
  }
});
