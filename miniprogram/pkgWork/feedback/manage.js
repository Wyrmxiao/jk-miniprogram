// pkgWork/feedback/manage.js —— 教师/管理员：查看并回复反馈
const { user } = require('../../services/index');
const { getProfile, isAdmin } = require('../../utils/auth');

const MAX_LEN = 500; // 与后端 FB_MAX_LEN 保持一致

const TABS = [
  { key: '', text: '全部' },
  { key: 'pending', text: '待处理' },
  { key: 'replied', text: '已回复' }
];

/** 云端时间（Date 或字符串）→ 「10月24日 13:42」 */
function fmtTime(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 后端反馈文档 → 视图模型（WXML 不做方法调用，全部在此预计算） */
function toView(item) {
  return Object.assign({}, item, {
    statusText: item.status === 'replied' ? '已回复' : '待处理',
    statusClass: item.status === 'replied' ? 'tag-success' : 'tag-warning',
    createdText: fmtTime(item.createdAt),
    replyText: fmtTime(item.replyAt)
  });
}

Page({
  data: {
    tabs: TABS,
    tab: '',
    keyword: '',
    list: [],
    total: 0,
    page: 1,
    loading: true,
    loadingMore: false,
    noMore: false,
    // 回复弹层
    showReply: false,
    replyItem: null,
    replyText: '',
    sending: false
  },

  onLoad() {
    // 后端 feedbackList / replyFeedback 仅 admin（反馈收件人=开发团队），此处前端门禁与之对齐
    if (!isAdmin()) {
      wx.showToast({ title: '仅管理员可访问', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.loadList(true);
  },

  onPullDownRefresh() {
    this.loadList(true, () => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.noMore || this.data.loadingMore || this.data.loading) return;
    this.loadList(false);
  },

  async loadList(reset, done) {
    if (reset) this.setData({ page: 1, list: [], noMore: false, loading: true });
    else this.setData({ loadingMore: true });

    const page = reset ? 1 : this.data.page + 1;
    try {
      const res = await user.feedbackList({
        status: this.data.tab,
        keyword: this.data.keyword,
        page,
        size: 20
      });
      const list = (res.list || []).map(toView);
      const merged = reset ? list : this.data.list.concat(list);
      const total = res.total || 0;
      this.setData({
        list: merged,
        total,
        page,
        noMore: list.length === 0 || merged.length >= total,
        loading: false,
        loadingMore: false
      });
    } catch (e) {
      this.setData({ loading: false, loadingMore: false });
    } finally {
      if (done) done();
    }
  },

  switchTab(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.tab) return;
    this.setData({ tab: key }, () => this.loadList(true));
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value }, () => this.loadList(true));
  },

  /* ===== 回复弹层 ===== */
  openReply(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.list.find((x) => x._id === id);
    if (!item) return;
    this.setData({ showReply: true, replyItem: item, replyText: '' });
  },

  closeReply() {
    this.setData({ showReply: false });
  },

  onReplyInput(e) {
    this.setData({ replyText: e.detail.value });
  },

  /** 弹层占位：catchtap 阻止事件冒泡到遮罩 */
  noop() {},

  async sendReply() {
    if (this.data.sending) return;
    const text = this.data.replyText.trim();
    const item = this.data.replyItem;
    if (!text) {
      wx.showToast({ title: '请填写回复内容', icon: 'none' });
      return;
    }
    if (text.length > MAX_LEN) {
      wx.showToast({ title: `回复不能超过 ${MAX_LEN} 字`, icon: 'none' });
      return;
    }
    this.setData({ sending: true });
    try {
      await user.replyFeedback({ id: item._id, reply: text });
      // 就地更新，避免整页刷新导致列表跳动
      const me = getProfile();
      const list = this.data.list.map((x) => {
        if (x._id !== item._id) return x;
        return toView(Object.assign({}, x, {
          status: 'replied',
          reply: text,
          replyBy: (me && me.realName) || '开发团队',
          replyAt: new Date()
        }));
      });
      this.setData({ list, showReply: false, sending: false });
      wx.showToast({ title: '已回复', icon: 'success' });
    } catch (e) {
      this.setData({ sending: false });
      /* 错误已在 request 层统一提示 */
    }
  }
});
