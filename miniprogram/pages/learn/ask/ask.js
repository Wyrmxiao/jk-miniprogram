// pages/learn/ask/ask.js —— 提问独立页面（与写回答同构，避开弹层 + 键盘的 iOS 坑）
const { qa } = require('../../../services/index');
const { refreshLogin } = require('../../../utils/request');
const { QA_CATEGORIES } = require('../../../constants/index');

/** 提问校验：与后端 qaAsk 的规则保持一致，并给出可操作的提示 */
function validate(f) {
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
    cats: [],
    category: 'algorithm',
    title: '',
    content: '',
    problemTitle: '',
    canAsk: false,
    hint: '请填写问题标题',
    asking: false
  },

  onLoad() {
    this.setData({
      cats: QA_CATEGORIES.map((c) => ({ key: c.key, name: c.name, on: c.key === 'algorithm' }))
    });
  },

  /** 任一输入变化后统一刷新按钮态与提示，避免「点了没反应」 */
  refresh(form) {
    const v = validate(form);
    this.setData({
      category: form.category,
      title: form.title,
      content: form.content,
      problemTitle: form.problemTitle,
      canAsk: v.ok,
      hint: v.hint
    });
  },

  pickCategory(e) {
    const key = e.currentTarget.dataset.key;
    const f = this.currentForm();
    f.category = key;
    this.refresh(f);
    this.setData({ cats: this.data.cats.map((c) => ({ key: c.key, name: c.name, on: c.key === key })) });
  },

  onTitle(e) {
    this.refresh(Object.assign(this.currentForm(), { title: e.detail.value }));
  },

  onContent(e) {
    this.refresh(Object.assign(this.currentForm(), { content: e.detail.value }));
  },

  onProblem(e) {
    this.refresh(Object.assign(this.currentForm(), { problemTitle: e.detail.value }));
  },

  currentForm() {
    return {
      category: this.data.category,
      title: this.data.title,
      content: this.data.content,
      problemTitle: this.data.problemTitle
    };
  },

  async submit() {
    if (this.data.asking) return;
    const f = this.currentForm();
    const v = validate(f);
    if (!v.ok) {
      wx.showToast({ title: v.hint, icon: 'none' });
      return;
    }

    // 先收键盘：否则第一次点击往往只用来收键盘
    wx.hideKeyboard();
    this.setData({ asking: true });

    const payload = {
      title: f.title.trim(),
      content: f.content.trim(),
      category: f.category,
      problemTitle: String(f.problemTitle || '').trim()
    };

    try {
      await qa.ask(payload);
      this.done();
    } catch (err) {
      // 本地认证缓存与云端不一致（后端 403）时，刷新登录态后自动重试一次
      let last = err;
      if (err && err.code === 403) {
        try {
          await refreshLogin();
          await qa.ask(payload);
          this.done();
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

  done() {
    this.setData({ asking: false, title: '', content: '', problemTitle: '', canAsk: false });
    wx.showToast({ title: '发布成功', icon: 'success' });
    // 返回列表页：qa 页 onShow 会自动刷新列表与统计
    setTimeout(() => wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/learn/qa' }) }), 600);
  }
});
