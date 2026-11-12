// pages/learn/qaDetail.js —— 问题详情：完整描述 + 师生回答 + 采纳 / 标记解决
const { qa } = require('../../services/index');
const { refreshLogin } = require('../../utils/request');
const { QA_CATEGORY_TEXT, QA_STATUS_TEXT } = require('../../constants/index');
const { fromNow, confirm } = require('../../utils/util');

Page({
  data: {
    id: '',
    loading: true,
    q: null,
    answers: [],
    total: 0,

    // 回答弹层
    showReply: false,
    draft: '',
    canSend: false,
    replyHint: '请填写回答内容',
    sending: false,
    keyboardUp: false,
    sheetPad: ''
  },

  onLoad(options) {
    this.setData({ id: (options && options.id) || '' });
  },

  onShow() {
    this.load();
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh());
  },

  async load() {
    if (!this.data.id) return;
    try {
      const res = await qa.detail({ id: this.data.id });
      const q = res.question || {};
      q.statusText = QA_STATUS_TEXT[q.status] || q.status;
      q.categoryText = QA_CATEGORY_TEXT[q.category] || '其他';
      q.timeText = fromNow(q.createdAt);

      const answers = (res.answers || []).map((a) =>
        Object.assign({}, a, { timeText: fromNow(a.createdAt) })
      );

      this.setData({
        q,
        answers,
        total: res.total || 0,
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  // ============ 回答 ============
  openReply() {
    this.setData({
      showReply: true,
      draft: '',
      canSend: false,
      replyHint: '请填写回答内容',
      keyboardUp: false,
      sheetPad: ''
    });
  },

  closeReply() {
    wx.hideKeyboard();
    this.setData({ showReply: false, keyboardUp: false, sheetPad: '' });
  },

  onDraftInput(e) {
    const draft = e.detail.value;
    const n = String(draft || '').trim().length;
    this.setData({
      draft,
      canSend: n >= 2,
      replyHint: n >= 2 ? '' : '回答至少 2 个字'
    });
  },

  onKeyboardHeightChange(e) {
    const h = Number(e.detail && e.detail.height) || 0;
    this.setData({
      keyboardUp: h > 0,
      sheetPad: h > 0 ? `padding-bottom:${h + 16}px;` : ''
    });
  },

  async sendReply() {
    if (this.data.sending) return;
    if (!this.data.canSend) {
      wx.showToast({ title: this.data.replyHint || '请填写回答内容', icon: 'none' });
      return;
    }

    wx.hideKeyboard();
    this.setData({ sending: true, keyboardUp: false, sheetPad: '' });
    const content = this.data.draft.trim();

    try {
      await qa.answer({ questionId: this.data.id, content });
      this.onReplySuccess();
    } catch (err) {
      let last = err;
      if (err && err.code === 403) {
        try {
          await refreshLogin();
          await qa.answer({ questionId: this.data.id, content });
          this.onReplySuccess();
          return;
        } catch (e2) {
          last = e2;
        }
      }
      this.setData({ sending: false });
      wx.showToast({
        title: String((last && last.message) || '发送失败，请稍后重试').slice(0, 20),
        icon: 'none',
        duration: 2600
      });
    }
  },

  onReplySuccess() {
    this.setData({
      showReply: false,
      sending: false,
      draft: '',
      canSend: false,
      replyHint: '请填写回答内容',
      keyboardUp: false,
      sheetPad: ''
    });
    wx.showToast({ title: '已回答', icon: 'success' });
    this.load();
  },

  // ============ 采纳 / 解决状态 ============
  async acceptAnswer(e) {
    const id = e.currentTarget.dataset.id;
    const yes = await confirm('采纳这个回答后，问题会标记为已解决。', '采纳回答');
    if (!yes) return;
    try {
      await qa.accept({ questionId: this.data.id, answerId: id });
      wx.showToast({ title: '已采纳', icon: 'success' });
      this.load();
    } catch (e) {
      /* request 层已提示 */
    }
  },

  async toggleStatus() {
    const q = this.data.q;
    if (!q || !q.canManage) return;
    const to = q.status === 'solved' ? 'open' : 'solved';
    const yes = await confirm(
      to === 'solved' ? '标记为已解决？线下已讲清楚的问题可以这样做。' : '重新打开这个问题，继续征集回答？',
      to === 'solved' ? '标记已解决' : '重新打开'
    );
    if (!yes) return;
    try {
      await qa.setStatus({ id: this.data.id, status: to });
      wx.showToast({ title: to === 'solved' ? '已解决' : '已重新打开', icon: 'success' });
      this.load();
    } catch (e) {
      /* request 层已提示 */
    }
  },

  // ============ 删除 ============
  async removeQuestion() {
    const yes = await confirm('删除后问题和所有回答都不再显示，且无法恢复。', '删除问题');
    if (!yes) return;
    try {
      await qa.removeQuestion({ id: this.data.id });
      wx.showToast({ title: '已删除', icon: 'success' });
      wx.navigateBack();
    } catch (e) {
      /* request 层已提示 */
    }
  },

  async removeAnswer(e) {
    const yes = await confirm('确定删除这条回答？', '删除回答');
    if (!yes) return;
    try {
      await qa.removeAnswer({ id: e.currentTarget.dataset.id });
      wx.showToast({ title: '已删除', icon: 'success' });
      this.load();
    } catch (e) {
      /* request 层已提示 */
    }
  },

  /** 弹层占位：catchtap 阻止事件冒泡到遮罩 */
  noop() {}
});
