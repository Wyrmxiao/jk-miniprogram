// pkgContest/edit/edit.js
const { contest } = require('../../services/index');

const LEVELS = ['A', 'B', 'C', 'D'];
const CATEGORIES = [
  { key: 'hardware', text: '硬件类' },
  { key: 'scienceOther', text: '理工其他' },
  { key: 'humanity', text: '人文社科' }
];
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** 已选月份数组 → 查表对象（WXML 绑定在 exparser 框架不能调 indexOf，用对象查表） */
function monthSelOf(list) {
  const sel = {};
  (list || []).forEach((m) => {
    sel[m] = true;
  });
  return sel;
}

Page({
  data: {
    id: '',
    loaded: false,
    submitting: false,
    levels: LEVELS,
    categories: CATEGORIES,
    months: MONTHS,
    monthSel: {},
    form: {
      name: '',
      level: 'A',
      category: 'scienceOther',
      host: '',
      isFocus: false,
      regStart: '',
      regEnd: '',
      contestDate: '',
      typicalMonths: [],
      officialUrl: '',
      intro: ''
    }
  },

  onLoad(options) {
    if (options && options.id) {
      this.setData({ id: options.id });
      this.loadDetail(options.id);
    } else {
      this.setData({ loaded: true });
    }
  },

  async loadDetail(id) {
    try {
      const res = await contest.detail({ id });
      const typicalMonths = Array.isArray(res.typicalMonths) ? res.typicalMonths : [];
      this.setData({
        loaded: true,
        monthSel: monthSelOf(typicalMonths),
        form: {
          name: res.name || '',
          level: res.level || 'A',
          category: res.category || 'scienceOther',
          host: res.host || '',
          isFocus: !!res.isFocus,
          regStart: res.regStart || '',
          regEnd: res.regEnd || '',
          contestDate: res.contestDate || '',
          typicalMonths,
          officialUrl: res.officialUrl || '',
          intro: res.intro || ''
        }
      });
    } catch (e) {
      this.setData({ loaded: true });
    }
  },

  onField(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  pickLevel(e) {
    this.setData({ 'form.level': e.currentTarget.dataset.value });
  },

  pickCategory(e) {
    this.setData({ 'form.category': e.currentTarget.dataset.value });
  },

  onDate(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  toggleMonth(e) {
    const m = Number(e.currentTarget.dataset.month);
    const list = this.data.form.typicalMonths.slice();
    const i = list.indexOf(m);
    if (i >= 0) list.splice(i, 1);
    else list.push(m);
    list.sort((a, b) => a - b);
    this.setData({ 'form.typicalMonths': list, monthSel: monthSelOf(list) });
  },

  toggleFocus(e) {
    this.setData({ 'form.isFocus': e.detail.value });
  },

  async save() {
    if (this.data.submitting) return;
    const f = this.data.form;
    if (!f.name.trim()) {
      wx.showToast({ title: '请填写竞赛名称', icon: 'none' });
      return;
    }
    if (f.regStart && f.regEnd && f.regStart > f.regEnd) {
      wx.showToast({ title: '报名开始不能晚于截止', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      if (this.data.id) {
        await contest.update(Object.assign({ id: this.data.id }, f));
      } else {
        const res = await contest.create(f);
        this.setData({ id: res.id });
      }
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (e) {
      /* 已在 request 层提示 */
    } finally {
      this.setData({ submitting: false });
    }
  },

  takeOffline() {
    wx.showModal({
      title: '下架该赛事',
      content: '下架后学生端不再显示，可在云开发控制台恢复。',
      success: async (r) => {
        if (!r.confirm) return;
        await contest.remove({ id: this.data.id });
        wx.showToast({ title: '已下架', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 600);
      }
    });
  }
});
