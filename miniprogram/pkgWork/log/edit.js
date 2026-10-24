// pkgWork/log/edit.js
const { learn } = require('../../services/index');

const DIRECTIONS = [
  { key: 'frontend', name: '前端开发' },
  { key: 'backend', name: '后端开发' },
  { key: 'algorithm', name: '算法竞赛' },
  { key: 'ai', name: '人工智能' },
  { key: 'security', name: '网络安全' },
  { key: 'embedded', name: '嵌入式/硬件' }
];

/** 已选标签数组 → 查表对象（WXML 绑定在 exparser 框架不能调 indexOf） */
function tagSelOf(list) {
  const sel = {};
  (list || []).forEach((k) => {
    sel[k] = true;
  });
  return sel;
}

Page({
  data: {
    submitting: false,
    keyboard: false,
    directions: DIRECTIONS,
    tagSel: {},
    form: { title: '', content: '', studyDate: '', tags: [] }
  },

  onLoad() {
    const d = new Date();
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    this.setData({
      'form.studyDate': `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    });
  },

  /* 键盘弹起时收起固定 footer，避免遮挡输入框 */
  onKeyboardHeightChange(e) {
    this.setData({ keyboard: e.detail.height > 0 });
  },

  onField(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onDate(e) {
    this.setData({ 'form.studyDate': e.detail.value });
  },

  toggleTag(e) {
    const key = e.currentTarget.dataset.key;
    const tags = this.data.form.tags.slice();
    const i = tags.indexOf(key);
    if (i >= 0) tags.splice(i, 1);
    else tags.push(key);
    this.setData({ 'form.tags': tags, tagSel: tagSelOf(tags) });
  },

  async submit() {
    if (this.data.submitting) return;
    const f = this.data.form;
    if (!f.title.trim()) {
      wx.showToast({ title: '请填写标题', icon: 'none' });
      return;
    }
    if (!f.content.trim()) {
      wx.showToast({ title: '请填写学习内容', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await learn.addLog(f);
      wx.showToast({ title: '已记录', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (e) {
      /* 已在 request 层提示 */
    } finally {
      this.setData({ submitting: false });
    }
  }
});
