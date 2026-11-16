// pages/class/list.js —— 我的班级（学生 / 教师通用）
const { classroom } = require('../../services/index');
const { ensureLogin, isTeacher } = require('../../utils/auth');

Page({
  data: {
    loading: true,
    list: [],
    isTeacherMode: false,
    showCreate: false,
    creating: false,
    form: { name: '', intro: '' }
  },

  onShow() {
    this.setData({ isTeacherMode: isTeacher() });
    this.load();
  },

  async load() {
    const ok = await ensureLogin();
    if (!ok) return;
    this.setData({ loading: true });
    try {
      const res = await classroom.list({});
      this.setData({ loading: false, list: res.list || [] });
    } catch (e) {
      this.setData({ loading: false, list: [] });
    }
  },

  toggleCreate() {
    this.setData({ showCreate: !this.data.showCreate });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  async create() {
    if (this.data.creating) return;
    const name = this.data.form.name.trim();
    if (name.length < 2) {
      wx.showToast({ title: '班级名称至少 2 个字', icon: 'none' });
      return;
    }
    this.setData({ creating: true });
    try {
      const res = await classroom.create({ name, intro: this.data.form.intro.trim() });
      wx.showToast({ title: '创建成功', icon: 'success' });
      this.setData({ creating: false, showCreate: false, form: { name: '', intro: '' } });
      wx.navigateTo({ url: `/pages/class/detail?classId=${res.classId}` });
    } catch (e) {
      this.setData({ creating: false });
    }
  },

  goJoin() {
    wx.navigateTo({ url: '/pages/class/join' });
  },

  openDetail(e) {
    const classId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/class/detail?classId=${classId}` });
  },

  /** 长按卡片：复制邀请码，方便口头发给同学 */
  copyCode(e) {
    const code = e.currentTarget.dataset.code;
    if (!code) return;
    wx.setClipboardData({ data: code });
  }
});
