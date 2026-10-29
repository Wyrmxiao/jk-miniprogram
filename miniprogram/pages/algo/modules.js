/**
 * 算法训练 · 知识点模块选择
 * 14 模块 × 5 档位矩阵，一次拉取后本地切换档位
 */
const { learn } = require('../../services/index');
const { ALGO_BANDS } = require('../../constants/index');

Page({
  data: {
    bands: ALGO_BANDS,
    bandIndex: 0,
    modules: [],
    loading: true,
    builtAtText: ''
  },

  onLoad() {
    this.load();
  },

  async load() {
    try {
      const res = await learn.algoProblemModules({});
      const modules = (res.modules || []).map((m) => ({
        key: m.key,
        name: m.name,
        bands: m.bands,
        total: m.total,
        done: m.done
      }));
      this.setData({
        modules,
        builtAtText: res.builtAt ? res.builtAt.slice(0, 10) : '',
        loading: false
      });
      this.applyBand();
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  /** 切换档位：纯本地重算，不重复请求 */
  switchBand(e) {
    this.setData({ bandIndex: Number(e.currentTarget.dataset.index) }, () => this.applyBand());
  },

  applyBand() {
    const b = ALGO_BANDS[this.data.bandIndex].key;
    const view = this.data.modules.map((m) => {
      const cell = m.bands[b] || { total: 0, done: 0 };
      return {
        key: m.key,
        name: m.name,
        done: cell.done,
        total: cell.total,
        pct: cell.total ? Math.round((cell.done / cell.total) * 100) : 0,
        empty: cell.total === 0
      };
    });
    this.setData({ view });
  },

  goProblems(e) {
    const { key, empty } = e.currentTarget.dataset;
    if (empty) {
      wx.showToast({ title: '本档暂无题目', icon: 'none' });
      return;
    }
    const band = ALGO_BANDS[this.data.bandIndex].key;
    wx.navigateTo({ url: `/pages/algo/problems?tag=${key}&band=${band}` });
  }
});
