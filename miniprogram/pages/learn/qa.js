// pages/learn/qa.js —— 学习问答列表：学生提问 · 师生互助解答
const { qa } = require('../../services/index');
const { QA_CATEGORIES, QA_CATEGORY_TEXT, QA_STATUS_TEXT } = require('../../constants/index');
const { isVerified } = require('../../utils/auth');
const { fromNow } = require('../../utils/util');

const SCOPES = [
  { key: 'all', name: '全部' },
  { key: 'open', name: '待解决' },
  { key: 'solved', name: '已解决' },
  { key: 'mine', name: '我的提问' },
  { key: 'answered', name: '我回答过' }
];

const PAGE_SIZE = 20;

function emptyForm() {
  return { title: '', content: '', category: 'algorithm', problemTitle: '' };
}

function askCats(selected) {
  return QA_CATEGORIES.map((c) => ({ key: c.key, name: c.name, on: c.key === selected }));
}

Page({
  data: {
    loading: true,
    isVerified: false,
    scopes: SCOPES,
    scope: 'all',
    categories: [{ key: '', name: '全部' }].concat(QA_CATEGORIES),
    category: '',
    keyword: '',
    searchWord: '',
    stats: { open: 0, solved: 0, mine: 0, total: 0 },
    list: [],
    total: 0,
    page: 1,
    hasMore: false,
    loadingMore: false,

    // 提问弹层
    showAsk: false,
    asking: false,
    askForm: emptyForm(),
    askCats: askCats('algorithm'),
    canAsk: false,
    keyboardUp: false
  },

  onShow() {
    this.setData({ isVerified: isVerified() });
    this.reload();
    this.loadStats();
  },

  onPullDownRefresh() {
    Promise.all([this.reload(), this.loadStats()]).then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) this.loadMore();
  },

  async loadStats() {
    try {
      const s = await qa.stats();
      this.setData({ stats: s || { open: 0, solved: 0, mine: 0, total: 0 } });
    } catch (e) {
      /* 静默，入口数字不影响主流程 */
    }
  },

  /** 把后端原始字段转成 WXML 可直接绑定的展示字段 */
  decorate(items) {
    return (items || []).map((q) =>
      Object.assign({}, q, {
        statusText: QA_STATUS_TEXT[q.status] || q.status,
        categoryText: QA_CATEGORY_TEXT[q.category] || '其他',
        timeText: fromNow(q.lastActivityAt || q.createdAt),
        answerText: q.answerCount ? `${q.answerCount} 个回答` : '还没有回答',
        isTeacherAuthor: q.authorRole === 'teacher' || q.authorRole === 'admin'
      })
    );
  },

  async reload() {
    this.setData({ loading: true, page: 1 });
    try {
      const res = await qa.list({
        scope: this.data.scope,
        category: this.data.category,
        keyword: this.data.keyword,
        page: 1,
        size: PAGE_SIZE
      });
      this.setData({
        list: this.decorate(res.list),
        total: res.total || 0,
        page: 1,
        hasMore: PAGE_SIZE < (res.total || 0),
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  async loadMore() {
    const next = this.data.page + 1;
    this.setData({ loadingMore: true });
    try {
      const res = await qa.list({
        scope: this.data.scope,
        category: this.data.category,
        keyword: this.data.keyword,
        page: next,
        size: PAGE_SIZE
      });
      this.setData({
        list: this.data.list.concat(this.decorate(res.list)),
        page: next,
        hasMore: next * PAGE_SIZE < (res.total || 0),
        loadingMore: false
      });
    } catch (e) {
      this.setData({ loadingMore: false });
    }
  },

  onScope(e) {
    this.setData({ scope: e.currentTarget.dataset.key }, () => this.reload());
  },

  onCategory(e) {
    this.setData({ category: e.currentTarget.dataset.key }, () => this.reload());
  },

  onSearchInput(e) {
    this.setData({ searchWord: e.detail.value });
  },

  doSearch() {
    this.setData({ keyword: this.data.searchWord.trim() }, () => this.reload());
  },

  clearSearch() {
    this.setData({ searchWord: '', keyword: '' }, () => this.reload());
  },

  goRealname() {
    wx.navigateTo({ url: '/pkgAuth/realname/realname' });
  },

  goDetail(e) {
    wx.navigateTo({ url: `/pages/learn/qaDetail?id=${e.currentTarget.dataset.id}` });
  },

  // ============ 提问 ============
  openAsk() {
    if (!isVerified()) {
      wx.showToast({ title: '请先完成实名认证', icon: 'none' });
      return;
    }
    this.setData({
      showAsk: true,
      askForm: emptyForm(),
      askCats: askCats('algorithm'),
      canAsk: false,
      keyboardUp: false
    });
  },

  closeAsk() {
    this.setData({ showAsk: false, keyboardUp: false });
  },

  onAskTitle(e) {
    const title = e.detail.value;
    const form = Object.assign({}, this.data.askForm, { title });
    this.setData({ askForm: form, canAsk: title.trim().length >= 4 && form.content.trim().length >= 10 });
  },

  onAskContent(e) {
    const content = e.detail.value;
    const form = Object.assign({}, this.data.askForm, { content });
    this.setData({ askForm: form, canAsk: form.title.trim().length >= 4 && content.trim().length >= 10 });
  },

  onAskProblem(e) {
    const problemTitle = e.detail.value;
    this.setData({ askForm: Object.assign({}, this.data.askForm, { problemTitle }) });
  },

  onAskCategory(e) {
    const category = e.currentTarget.dataset.key;
    this.setData({
      askForm: Object.assign({}, this.data.askForm, { category }),
      askCats: askCats(category)
    });
  },

  onKeyboardHeightChange(e) {
    this.setData({ keyboardUp: (e.detail && e.detail.height) > 0 });
  },

  async submitAsk() {
    const f = this.data.askForm;
    if (!this.data.canAsk || this.data.asking) return;
    this.setData({ asking: true });
    try {
      const res = await qa.ask({
        title: f.title.trim(),
        content: f.content.trim(),
        category: f.category,
        problemTitle: f.problemTitle.trim()
      });
      this.setData({ showAsk: false, asking: false });
      wx.showToast({ title: '发布成功', icon: 'success' });
      this.reload();
      this.loadStats();
      wx.navigateTo({ url: `/pages/learn/qaDetail?id=${res.id}` });
    } catch (e) {
      this.setData({ asking: false });
    }
  },

  /** 弹层占位：catchtap 阻止事件冒泡到遮罩 */
  noop() {}
});
