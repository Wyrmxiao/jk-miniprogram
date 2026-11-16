// pkgWork/report/list.js —— 教师端：按班级查看每周学习汇报汇总
const { report, classroom } = require('../../services/index');
const { isTeacher, ensureLogin } = require('../../utils/auth');
const week = require('../../utils/week');

Page({
  data: {
    loading: true,
    classes: [],
    classId: '',
    className: '',
    weeks: [],
    totalStudents: 0,
    currentWeekKey: ''
  },

  onLoad(options) {
    this.initialClassId = (options && options.classId) || '';
  },

  onShow() {
    this.load();
  },

  async load() {
    const ok = await ensureLogin();
    if (!ok) return;
    if (!isTeacher() && !this.data.classId && !this.initialClassId) {
      wx.showToast({ title: '仅老师或班级创建者可查看', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.setData({ loading: true });

    // 先取班级列表，确定当前查看哪个班
    let classes = this.data.classes;
    try {
      const res = await classroom.mine({});
      classes = res.list || [];
    } catch (e) {
      classes = [];
    }

    if (!classes.length) {
      this.setData({ loading: false, classes: [], weeks: [], classId: '', totalStudents: 0 });
      return;
    }

    let classId = this.data.classId || this.initialClassId;
    if (!classes.some((c) => c._id === classId)) classId = classes[0]._id;
    this.initialClassId = '';

    this.setData({
      classes,
      classId,
      className: (classes.find((c) => c._id === classId) || {}).name || ''
    });

    try {
      const res = await report.weeks({ size: 12, classId });
      const list = (res.list || []).map((w) => ({
        weekKey: w.weekKey,
        rangeText: week.shortRange(w),
        submitted: w.submitted || 0,
        total: w.total || 0,
        isCurrent: !!w.isCurrent,
        percent: w.total ? Math.round(((w.submitted || 0) / w.total) * 100) : 0,
        done: w.total > 0 && w.submitted >= w.total
      }));
      this.setData({
        loading: false,
        weeks: list,
        totalStudents: res.totalStudents || 0,
        currentWeekKey: res.currentWeekKey || ''
      });
    } catch (e) {
      this.setData({ loading: false, weeks: [] });
    }
  },

  switchClass(e) {
    const classId = e.currentTarget.dataset.id;
    if (classId === this.data.classId) return;
    const cls = this.data.classes.find((c) => c._id === classId) || {};
    this.setData({ classId, className: cls.name || '', weeks: [] });
    this.load();
  },

  goClasses() {
    wx.navigateTo({ url: '/pages/class/list' });
  },

  openWeek(e) {
    const weekKey = e.currentTarget.dataset.week;
    wx.navigateTo({ url: `/pkgWork/report/detail?weekKey=${weekKey}&classId=${this.data.classId}` });
  },

  /** 快速导出本周 */
  async exportCurrent() {
    if (!this.data.currentWeekKey || !this.data.classId) return;
    const { fileID } = await report
      .exportExcel({ weekKey: this.data.currentWeekKey, classId: this.data.classId })
      .catch(() => ({}));
    if (!fileID) return;
    wx.showLoading({ title: '下载中', mask: true });
    try {
      const res = await wx.cloud.downloadFile({ fileID });
      wx.hideLoading();
      wx.openDocument({
        filePath: res.tempFilePath,
        fileType: 'xlsx',
        showMenu: true,
        success: () => {},
        fail: () => wx.showToast({ title: '打开失败，请重试', icon: 'none' })
      });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '下载失败', icon: 'none' });
    }
  }
});
