// pkgWork/report/detail.js —— 教师端：某一周的汇报明细 + 导出
const { report } = require('../../services/index');
const { isTeacher, ensureLogin } = require('../../utils/auth');
const week = require('../../utils/week');

Page({
  data: {
    weekKey: '',
    classId: '',
    className: '',
    rangeText: '',
    isCurrent: false,
    loading: true,
    exporting: false,
    list: [],
    displayList: [],
    missing: [],
    submitted: 0,
    total: 0,
    keyword: ''
  },

  onLoad(query) {
    const weekKey = (query && query.weekKey) || week.weekInfo().weekKey;
    const classId = (query && query.classId) || '';
    this.setData({ weekKey, classId, rangeText: week.shortRange(week.weekRange(weekKey)) });
  },

  onShow() {
    this.load();
  },

  async load() {
    const ok = await ensureLogin();
    if (!ok) return;
    if (!isTeacher() && !this.data.classId) {
      wx.showToast({ title: '仅老师或班级创建者可查看', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.setData({ loading: true });
    try {
      const res = await report.list({ weekKey: this.data.weekKey, classId: this.data.classId });
      const list = (res.list || []).map((r) => ({
        _id: r._id,
        name: r.name || '未实名',
        studentId: r.studentId || '',
        knowledge: r.knowledge || '',
        difficulty: r.difficulty || '',
        questions: r.questions || '',
        blogUrl: r.blogUrl || '',
        updatedText: this.formatTime(r.updatedAt || r.createdAt)
      }));
      this.setData({
        loading: false,
        list,
        displayList: list,
        missing: res.missing || [],
        submitted: res.submitted || 0,
        total: res.total || 0,
        isCurrent: !!(res.week && res.week.isCurrent),
        className: (res.classInfo && res.classInfo.name) || ''
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  formatTime(v) {
    if (!v) return '';
    const t = new Date(v);
    if (Number.isNaN(t.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}`;
  },

  onSearch(e) {
    const keyword = String(e.detail.value || '').trim();
    const lower = keyword.toLowerCase();
    const displayList = keyword
      ? this.data.list.filter(
          (r) =>
            String(r.name).toLowerCase().includes(lower) ||
            String(r.studentId).toLowerCase().includes(lower)
        )
      : this.data.list;
    this.setData({ keyword, displayList });
  },

  copyBlog(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.setClipboardData({ data: url });
  },

  async exportExcel() {
    if (this.data.exporting) return;
    this.setData({ exporting: true });
    try {
      const res = await report.exportExcel({ weekKey: this.data.weekKey, classId: this.data.classId });
      if (!res || !res.fileID) return;
      wx.showLoading({ title: '下载中', mask: true });
      const file = await wx.cloud.downloadFile({ fileID: res.fileID });
      wx.hideLoading();
      wx.openDocument({
        filePath: file.tempFilePath,
        fileType: 'xlsx',
        showMenu: true,
        success: () => {},
        fail: () => wx.showToast({ title: '打开失败，可重试', icon: 'none' })
      });
    } catch (e) {
      wx.hideLoading();
    } finally {
      this.setData({ exporting: false });
    }
  }
});
