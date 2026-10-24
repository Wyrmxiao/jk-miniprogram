// pkgContest/manage/manage.js
const { contest } = require('../../services/index');

const FILTERS = [
  { key: 'all', text: '全部' },
  { key: 'noTime', text: '未填时间' },
  { key: 'hasTime', text: '已填时间' },
  { key: 'focus', text: '院内重点' }
];

Page({
  data: {
    filters: FILTERS,
    filter: 'all',
    keyword: '',
    list: [],
    loading: true
  },

  onShow() {
    this.loadList();
  },

  onPullDownRefresh() {
    this.loadList().then(() => wx.stopPullDownRefresh());
  },

  onFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.key }, () => this.loadList());
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value }, () => this.loadList());
  },

  async loadList() {
    this.setData({ loading: true });
    try {
      const res = await contest.list({
        keyword: this.data.keyword,
        focusOnly: this.data.filter === 'focus',
        page: 1,
        size: 200
      });
      let list = (res.list || []).map((c) =>
        Object.assign({}, c, {
          hasTime: !!(c.regEnd || c.contestDate || (c.typicalMonths || []).length),
          // 预计算惯例月份文本（WXML 绑定不能调 join）
          typicalText: (c.typicalMonths || []).join('/')
        })
      );
      if (this.data.filter === 'noTime') list = list.filter((c) => !c.hasTime);
      if (this.data.filter === 'hasTime') list = list.filter((c) => c.hasTime);
      this.setData({ list, loading: false });
    } catch (e) {
      this.setData({ list: [], loading: false });
    }
  },

  goEdit(e) {
    wx.navigateTo({ url: `/pkgContest/edit/edit?id=${e.currentTarget.dataset.id}` });
  },

  goCreate() {
    wx.navigateTo({ url: '/pkgContest/edit/edit' });
  }
});
