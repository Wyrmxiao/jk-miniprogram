/**
 * 算法训练 · 题库导航
 * 平台 → 难度 → 知识点，三层筛选都在首屏完成。
 */
const { learn } = require('../../services/index');
const { ALGO_BANDS, ALGO_SOURCES } = require('../../constants/index');

Page({
  data: {
    sources: [{ key: '', name: '全部平台', short: '全部' }].concat(ALGO_SOURCES),
    difficulties: [{ key: '', name: '全部' }].concat(ALGO_BANDS),
    sourceKey: '',
    bandKey: '',
    query: '',
    modules: [],
    view: [],
    platforms: [],
    total: 0,
    done: 0,
    progress: 0,
    next: null,
    loading: true
  },

  onLoad(options) {
    this.setData({ sourceKey: (options && options.source) || '' });
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const res = await learn.algoProblemModules({ source: this.data.sourceKey });
      const total = res.total || 0;
      const done = res.done || 0;
      this.setData({
        modules: res.modules || [],
        platforms: res.platforms || [],
        total,
        done,
        progress: total ? Math.round((done / total) * 100) : 0,
        next: res.next || null,
        loading: false
      });
      this.applyFilters();
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  selectSource(e) {
    const sourceKey = e.currentTarget.dataset.key || '';
    if (sourceKey === this.data.sourceKey) return;
    this.setData({ sourceKey }, () => this.load());
  },

  selectBand(e) {
    this.setData({ bandKey: e.currentTarget.dataset.key || '' }, () => this.applyFilters());
  },

  applyFilters() {
    const band = this.data.bandKey;
    const view = this.data.modules.map((m) => {
      const cell = band ? (m.bands[band] || { total: 0, done: 0 }) : m;
      return {
        key: m.key,
        name: m.name,
        done: cell.done || 0,
        total: cell.total || 0,
        pct: cell.total ? Math.round((cell.done / cell.total) * 100) : 0
      };
    }).filter((m) => m.total > 0);
    this.setData({ view });
  },

  onQuery(e) {
    this.setData({ query: e.detail.value });
  },

  submitSearch() {
    const query = this.data.query.trim();
    if (!query) {
      wx.showToast({ title: '输入题号或题目名称', icon: 'none' });
      return;
    }
    this.goList({ keyword: query });
  },

  goAll() {
    this.goList({});
  },

  goProblems(e) {
    this.goList({ tag: e.currentTarget.dataset.key });
  },

  goNext() {
    if (!this.data.next) return;
    wx.navigateTo({ url: `/pages/algo/problem?id=${this.data.next.id}` });
  },

  goList(extra) {
    const params = Object.assign({
      source: this.data.sourceKey,
      band: this.data.bandKey
    }, extra || {});
    const query = Object.keys(params)
      .filter((k) => params[k])
      .map((k) => `${k}=${encodeURIComponent(params[k])}`)
      .join('&');
    wx.navigateTo({ url: `/pages/algo/problems${query ? `?${query}` : ''}` });
  }
});
