// pages/project/project.js —— 项目板块（项目列表 + 访问申请信息）
const { project } = require('../../services/index');
const { isLogin, isTeacher } = require('../../utils/auth');
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
    /** list = 项目 | inbox = 信息（访问申请） */
    tab: 'list',
    loading: true,
    stages: STAGE_TABS,
    /** 查表高亮（WXML 绑定不支持方法调用，见项目约定） */
    stageSel: { '': true },
    activeStage: '',
    onlyMine: false,
    list: [],
    total: 0,
    page: 1,
    noMore: false,
    /** 加载失败提示（为空表示正常），用于区分「真的没有项目」和「接口挂了」 */
    loadError: '',
    emptyText: '还没有项目，来创建第一个吧',

    // 信息：访问申请 + 留言通知
    badgeCount: 0,
    received: [],
    sent: [],
    notices: []
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ active: 3 });
    if (this.data.tab === 'inbox') {
      this.loadInbox();
    } else {
      this.load(true);
    }
    this.loadBadge();
  },

  onPullDownRefresh() {
    const job = this.data.tab === 'inbox' ? this.loadInbox() : this.load(true);
    Promise.resolve(job).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.tab === 'list' && !this.data.noMore) this.load(false);
  },

  /** 切换「项目 / 信息」 */
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.tab) return;
    this.setData({ tab });
    if (tab === 'inbox') {
      if (!isLogin()) {
        wx.showToast({ title: '请先登录', icon: 'none' });
        this.setData({ tab: 'list' });
        return;
      }
      // 打开即视为已读：红点在这里消失
      this.setData({ badgeCount: 0 });
      this.loadInbox();
    } else {
      this.load(true);
    }
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
        loading: false,
        loadError: '',
        emptyText: this.buildEmptyText()
      });
    } catch (e) {
      const errCode = e && e.errCode;
      this.setData({
        loading: false,
        noMore: true,
        loadError: errCode ? `加载失败（${errCode}）` : '加载失败，请检查网络'
      });
    }
  },

  /** 空态文案：区分未登录 / 只看我的 / 正常视角 */
  buildEmptyText() {
    if (!isLogin()) return '登录后可查看自己的项目';
    if (this.data.onlyMine) return '你还没有创建项目';
    if (isTeacher()) return '还没有项目';
    return '暂无可见项目：只能看到自己和项目伙伴的项目';
  },

  retryLoad() {
    this.setData({ loadError: '' });
    this.load(true);
  },

  /** ============ 访问申请 ============ */

  /** 红点：有没有新的（未读）申请 */
  async loadBadge() {
    if (!isLogin()) {
      this.setData({ badgeCount: 0 });
      return;
    }
    try {
      const res = await project.accessBadge();
      // 已经停留在「信息」页时不再亮红点
      this.setData({ badgeCount: this.data.tab === 'inbox' ? 0 : res.count || 0 });
    } catch (e) {
      /* 静默：红点失败不影响主流程 */
    }
  },

  /** 我收到 / 我发出的申请 + 留言通知；打开即标记已读 */
  async loadInbox() {
    try {
      const res = await project.accessInbox({});
      const map = (arr) =>
        (arr || []).map((x) =>
          Object.assign({}, x, { timeText: x.updatedAt || x.createdAt ? fromNow(x.updatedAt || x.createdAt) : '' })
        );
      this.setData({
        received: map(res.received),
        sent: map(res.sent),
        notices: map(res.notices),
        badgeCount: 0
      });
    } catch (e) {
      wx.showToast({ title: '加载申请失败', icon: 'none' });
    }
  },

  /** 点留言通知 → 进对应项目详情 */
  goNoticeProject(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/project/detail?id=' + id });
  },

  /** 同意 / 拒绝 */
  async respond(e) {
    const id = e.currentTarget.dataset.id;
    const approve = String(e.currentTarget.dataset.approve) === '1';
    if (!id) return;
    try {
      await project.accessRespond({ id, approve });
      wx.showToast({ title: approve ? '已通过' : '已拒绝', icon: 'none' });
      this.loadInbox();
    } catch (err) {
      /* 错误已在 request 层提示 */
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
  },

  /** 点击涟漪：把触点交给 tap-ripple 组件播放 */
  onTapFx(e) {
    const fx = this.selectComponent('#tapFx');
    if (fx) fx.show(e);
  }
});
