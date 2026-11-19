// pages/learn/answer/answer.js —— 写回答独立页面
const { qa } = require('../../../services/index');
const { refreshLogin } = require('../../../utils/request');

Page({
  data: {
    id: '',
    qtitle: '',
    draft: '',
    canSend: false,
    sending: false,
    hint: '回答至少 2 个字'
  },

  onLoad(options) {
    let title = (options && options.title) || '';
    try {
      title = decodeURIComponent(title);
    } catch (e) {
      /* 保持原样 */
    }
    this.setData({
      id: (options && options.id) || '',
      qtitle: title
    });
  },

  onInput(e) {
    const draft = e.detail.value;
    const n = String(draft || '').trim().length;
    this.setData({
      draft,
      canSend: n >= 2,
      hint: n >= 2 ? '' : '回答至少 2 个字'
    });
  },

  async submit() {
    if (this.data.sending) return;
    if (!this.data.canSend) {
      wx.showToast({ title: this.data.hint || '请填写回答内容', icon: 'none' });
      return;
    }

    wx.hideKeyboard();
    this.setData({ sending: true });
    const content = this.data.draft.trim();

    try {
      await qa.answer({ questionId: this.data.id, content });
      this.done();
    } catch (err) {
      let last = err;
      if (err && err.code === 403) {
        try {
          await refreshLogin();
          await qa.answer({ questionId: this.data.id, content });
          this.done();
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

  done() {
    this.setData({ sending: false, draft: '', canSend: false });
    wx.showToast({ title: '已回答', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 600);
  }
});
