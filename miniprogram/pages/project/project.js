// pages/project/project.js —— 项目广场
const { project } = require('../../services/index');
const { isLogin } = require('../../utils/auth');
const { PROJECT_STAGE_TEXT, DIRECTION_TEXT } = require('../../constants/index');
const { fromNow } = require('../../utils/util');

const STAGE_TABS = [
  { key: '', name: '全部' },
  { key: 'idea', name: '构思中' },
  { key: 'doing', name: '进行中' },
  { key: 'done', name: '已完成' },
  { key: 'awarded', name: '获奖作品' }
];

Page({
  data: {
    loading: true,
    stages: STAGE_TABS,
    /** 查表高亮（WXML 绑定不支持方法调用，见项目约定） */
    stageSel: { '': true },
    activeStage: '',
    onlyMine: false,
    list: [],
    total: 0,
    page: 1,
    noMore: false
  },

  onShow() {
    this.load(true);
  },

  onPullDownRefresh() {
    this.load(true).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (!this.data.noMore) this.load(false);
  },

  switchStage(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.activeStage) return;
    const sel = {};
    sel[key] = true;
    this.setData({ activeStage: key, stageSel: sel });
    this.load(true);
  },

  toggleMine() {
    if (this.data.onlyMine && !isLogin()) return;
    if (!this.data.onlyMine && !isLogin()) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    this.setData({ onlyMine: !this.data.onlyMine });
    this.load(true);
  },

  async load(reset) {
    const page = reset ? 1 : this.data.page + 1;
    if (reset) this.setData({ loading: this.data.list.length === 0 });
    try {
      const res = await project.list({
        stage: this.data.activeStage,
        onlyMine: this.data.onlyMine,
        page,
        size: 20
      });
      const rows = (res.list || []).map((p) =>
        Object.assign({}, p, {
          stageText: PROJECT_STAGE_TEXT[p.stage] || p.stage,
          directionText: DIRECTION_TEXT[p.direction] || p.direction,
          timeText: fromNow(p.updatedAt)
        })
      );
      this.setData({
        list: reset ? rows : this.data.list.concat(rows),
        total: res.total || 0,
        page,
        noMore: rows.length < 20,
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false, noMore: true });
    }
  },

  goDetail(e) {
    wx.navigateTo({ url: `/pages/project/detail?id=${e.currentTarget.dataset.id}` });
  },

  goCreate() {
    if (!isLogin()) {
      wx.navigateTo({ url: '/pkgAuth/login/login' });
      return;
    }
    wx.navigateTo({ url: '/pkgWork/project/edit' });
  }
});
