/**
 * 算法训练 · 题目详情
 * 中英题名 / 复制链接去官方做题 / 我的记录与备注 / 同知识点下一题
 */
const { learn } = require('../../services/index');

Page({
  data: {
    id: '',
    loading: true,
    problem: null,
    myRecords: [],
    done: false,
    note: '',
    latestRecordId: '',
    noteSaving: false
  },

  onLoad(options) {
    this.setData({ id: (options && options.id) || '' });
    this.load();
  },

  async load() {
    try {
      const res = await learn.algoProblemDetail({ id: this.data.id });
      const latest = res.myRecords && res.myRecords[0];
      this.setData({
        problem: res.problem,
        myRecords: res.myRecords || [],
        done: res.done,
        note: (latest && latest.note) || '',
        latestRecordId: (latest && latest._id) || '',
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  copyLink() {
    const p = this.data.problem;
    if (!p || !p.url) return;
    wx.setClipboardData({
      data: p.url,
      success: () => {
        wx.showToast({ title: '链接已复制，去浏览器打开', icon: 'none', duration: 2000 });
      }
    });
  },

  onNote(e) {
    this.setData({ note: e.detail.value });
  },

  async saveNote() {
    if (!this.data.latestRecordId || this.data.noteSaving) return;
    this.setData({ noteSaving: true });
    try {
      await learn.algoUpdateNote({ id: this.data.latestRecordId, note: this.data.note });
      wx.showToast({ title: '备注已保存', icon: 'none' });
    } catch (e) {
      /* request 层已提示 */
    }
    this.setData({ noteSaving: false });
  },

  goTagProblems(e) {
    const tag = e.currentTarget.dataset.tag;
    wx.navigateTo({
      url: `/pages/algo/problems?tag=${tag}&band=${this.data.problem.band}`
    });
  },

  goRecord(e) {
    wx.navigateTo({ url: `/pages/algo/detail?id=${e.currentTarget.dataset.id}` });
  }
});
