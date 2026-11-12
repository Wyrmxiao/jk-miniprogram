/**
 * 算法训练 · 题单页（某知识点 × 某档位）
 * 核心交互：[通过] 在列表就地标记，不跳页；标记后出现「下一题」直达
 */
const { learn } = require('../../services/index');
const { ALGO_BAND_TEXT } = require('../../constants/index');

Page({
  data: {
    tag: '',
    band: '',
    tagName: '',
    bandName: '',
    list: [],
    doneCount: 0,
    loading: true,
    markingId: '',
    /** 下一道未做的题（标记后出现） */
    nextItem: null
  },

  onLoad(options) {
    this.setData({
      tag: options.tag || '',
      band: options.band || '',
      tagName: decodeURIComponent(options.tagName || ''),
      bandName: ALGO_BAND_TEXT[options.band] || ''
    });
    this.load();
  },

  async load() {
    try {
      const res = await learn.algoProblemList({
        tag: this.data.tag,
        band: this.data.band,
        page: 1,
        size: 50
      });
      this.setData({
        list: res.list,
        tagName: res.tagName || this.data.tagName,
        bandName: res.bandName || this.data.bandName,
        loading: false
      });
      this.recount();
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  recount() {
    const done = this.data.list.filter((x) => x.done).length;
    const next = this.data.list.find((x) => !x.done) || null;
    this.setData({ doneCount: done, nextItem: next });
  },

  async mark(e) {
    const id = e.currentTarget.dataset.id;
    if (this.data.markingId) return;
    this.setData({ markingId: id });
    try {
      const res = await learn.algoMarkProblem({ problemId: id });
      const list = this.data.list.map((x) =>
        x.id === id ? Object.assign({}, x, { done: true }) : x
      );
      this.setData({ list, markingId: '' });
      this.recount();
      wx.showToast({
        title: res && res.already ? '此题已记录过' : '已记录，今日 +1 题',
        icon: 'none'
      });
    } catch (err) {
      this.setData({ markingId: '' });
    }
  },

  goProblem(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/algo/problem?id=${id}` });
  },

  goNext() {
    if (!this.data.nextItem) return;
    this.goProblem({ currentTarget: { dataset: { id: this.data.nextItem.id } } });
  }
});
