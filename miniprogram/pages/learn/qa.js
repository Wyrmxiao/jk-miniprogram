// pages/learn/qa.js —— 学习问答列表：学生提问 · 师生互助解答
const { qa } = require('../../services/index');
const { refreshLogin } = require('../../utils/request');
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

/** 提问校验：与后端 qaAsk 的规则保持一致，并给出可操作的提示 */
function validateAsk(f) {
  const t = String((f && f.title) || '').trim();
  const c = String((f && f.content) || '').trim();
  if (!t) return { ok: false, hint: '请填写问题标题' };
  if (t.length < 4) return { ok: false, hint: `标题还差 ${4 - t.length} 字` };
  if (!c) return { ok: false, hint: '请填写详细描述' };
  if (c.length < 10) return { ok: false, hint: `描述还差 ${10 - c.length} 字` };
  return { ok: true, hint: '' };
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
    askHint: '请填写问题标题',
    keyboardUp: false,
    sheetPad: ''
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
      askHint: validateAsk(emptyForm()).hint,
      keyboardUp: false,
      sheetPad: ''
    });
  },

  closeAsk() {
    wx.hideKeyboard();
    this.setData({ showAsk: false, keyboardUp: false, sheetPad: '' });
  },

  /** 任一输入变化后统一刷新按钮态与提示，避免「点了没反应」 */
  refreshAsk(form) {
    const v = validateAsk(form);
    this.setData({ askForm: form, canAsk: v.ok, askHint: v.hint });
  },

  onAskTitle(e) {
    this.refreshAsk(Object.assign({}, this.data.askForm, { title: e.detail.value }));
  },

  onAskContent(e) {
    this.refreshAsk(Object.assign({}, this.data.askForm, { content: e.detail.value }));
  },

  onAskProblem(e) {
    this.refreshAsk(Object.assign({}, this.data.askForm, { problemTitle: e.detail.value }));
  },

  onAskCategory(e) {
    const category = e.currentTarget.dataset.key;
    this.refreshAsk(Object.assign({}, this.data.askForm, { category }));
    this.setData({ askCats: askCats(category) });
  },

  onKeyboardHeightChange(e) {
    const h = Number(e.detail && e.detail.height) || 0;
    this.setData({
      keyboardUp: h > 0,
      // 键盘弹起时把固定操作条顶到键盘上方，按钮始终可见可点
      sheetPad: h > 0 ? `padding-bottom:${h + 16}px;` : ''
    });
  },

  async submitAsk() {
    if (this.data.asking) return;
    const f = this.data.askForm;
    const v = validateAsk(f);
    if (!v.ok) {
      wx.showToast({ title: v.hint, icon: 'none' });
      return;
    }

    // 先收键盘：否则第一次点击往往只用来收键盘，按钮也会被遮住
    wx.hideKeyboard();
    this.setData({ asking: true, keyboardUp: false, sheetPad: '' });

    const payload = {
      title: f.title.trim(),
      content: f.content.trim(),
      category: f.category,
      problemTitle: String(f.problemTitle || '').trim()
    };

    try {
      const res = await qa.ask(payload);
      this.onAskSuccess(res);
    } catch (err) {
      // 本地认证缓存与云端不一致（后端 403）时，刷新登录态后自动重试一次
      let last = err;
      if (err && err.code === 403) {
        try {
          await refreshLogin();
          const res = await qa.ask(payload);
          this.onAskSuccess(res);
          return;
        } catch (e2) {
          last = e2;
        }
      }
      this.setData({ asking: false });
      wx.showToast({
        title: String((last && last.message) || '发布失败，请稍后重试').slice(0, 20),
        icon: 'none',
        duration: 2600
      });
    }
  },

  onAskSuccess(res) {
    this.setData({
      showAsk: false,
      asking: false,
      askForm: emptyForm(),
      askCats: askCats('algorithm'),
      canAsk: false,
      askHint: '请填写问题标题',
      keyboardUp: false,
      sheetPad: ''
    });
    wx.showToast({ title: '发布成功', icon: 'success' });
    this.reload();
    this.loadStats();
    // 后端没返回 id 时留在列表即可，不要跳 id=undefined
    const id = res && res.id;
    if (id) wx.navigateTo({ url: `/pages/learn/qaDetail?id=${id}` });
  },

  /** 弹层占位：catchtap 阻止事件冒泡到遮罩 */
  noop() {}
});
