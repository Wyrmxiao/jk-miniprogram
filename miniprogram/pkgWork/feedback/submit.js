// pkgWork/feedback/submit.js —— 提交意见反馈并查看回复
const { user } = require('../../services/index');

const MAX_LEN = 500; // 与后端 FB_MAX_LEN 保持一致

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
    content: '',
    contact: '',
    submitting: false,
    list: [],
    loading: true
  },

  onShow() {
    // 每次进入都刷新：首次加载 + 提交后更新历史
    this.loadMy();
  },

  onContent(e) {
    this.setData({ content: e.detail.value });
  },

  onContact(e) {
    this.setData({ contact: e.detail.value });
  },

  async loadMy() {
    try {
      const res = await user.myFeedbacks({ page: 1, size: 20 });
      this.setData({ list: (res.list || []).map(toView), loading: false });
      // 学生已看到「我的反馈」历史 → 把老师的回复标记为已读（红点随之熄灭）
      user.markFeedbacksRead().catch(() => {});
    } catch (e) {
      this.setData({ list: [], loading: false });
    }
  },

  async submit() {
    if (this.data.submitting) return;
    const content = this.data.content.trim();
    if (!content) {
      wx.showToast({ title: '请先填写反馈内容', icon: 'none' });
      return;
    }
    if (content.length > MAX_LEN) {
      wx.showToast({ title: `反馈内容不能超过 ${MAX_LEN} 字`, icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await user.submitFeedback({ content, contact: this.data.contact.trim() });
      wx.showToast({ title: '已提交，感谢反馈', icon: 'success' });
      this.setData({ content: '', contact: '' });
      this.loadMy();
    } catch (e) {
      /* 错误已在 request 层统一提示 */
    } finally {
      this.setData({ submitting: false });
    }
  }
});
