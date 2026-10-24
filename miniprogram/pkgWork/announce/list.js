// pkgWork/announce/list.js
const { announce } = require('../../services/index');
const { isTeacher, isAdmin, getProfile } = require('../../utils/auth');
const { fromNow } = require('../../utils/util');

Page({
  data: {
    tab: '',
    list: [],
    total: 0,
    page: 1,
    loading: true,
    loadingMore: false,
    noMore: false,
    myOpenid: '',
    isTeacher: false,
    isAdmin: false
  },

  onLoad(options) {
    if (options && options.type) this.setData({ tab: options.type });
    this.applyIdentity();
  },

  onShow() {
    this.loadList(true);
  },

  onPullDownRefresh() {
    this.loadList(true).then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.noMore || this.data.loadingMore || this.data.loading) return;
    this.loadList(false);
  },

  /** 从本地登录态取身份：决定每条的删除权限 */
  applyIdentity() {
    const profile = getProfile();
    this.setData({
      myOpenid: (profile && profile.openid) || '',
      isTeacher: isTeacher(),
      isAdmin: isAdmin()
    });
  },

  async loadList(reset) {
    const page = reset ? 1 : this.data.page + 1;
    this.setData(reset ? { loading: true } : { loadingMore: true });
    try {
      const res = await announce.list({ type: this.data.tab, page, size: 20 });
      const { myOpenid, isTeacher, isAdmin } = this.data;
      const list = (res.list || []).map((a) =>
        Object.assign({}, a, {
          timeText: fromNow(a.createdAt),
          // 教师可删自己的，管理员可删全部
          canDel: isTeacher && (a.publisherOpenid === myOpenid || isAdmin)
        })
      );
      const merged = reset ? list : this.data.list.concat(list);
      this.setData({
        list: merged,
        total: res.total,
        page,
        noMore: merged.length >= res.total,
        loading: false,
        loadingMore: false
      });
    } catch (e) {
      this.setData({ loading: false, loadingMore: false });
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.tab) return;
    this.setData({ tab });
    this.loadList(true);
  },

  openDetail(e) {
    wx.navigateTo({ url: '/pkgWork/announce/detail?id=' + e.currentTarget.dataset.id });
  },

  async removeItem(e) {
    const id = e.currentTarget.dataset.id;
    const ok = await new Promise((resolve) => {
      wx.showModal({
        title: '删除公告',
        content: '删除后学生端将不再可见，确认删除？',
        success: (r) => resolve(!!r.confirm),
        fail: () => resolve(false)
      });
    });
    if (!ok) return;
    try {
      await announce.remove({ id });
      wx.showToast({ title: '已删除', icon: 'success' });
      this.loadList(true);
    } catch (err) {
      /* 错误已在 request 层提示 */
    }
  }
});
