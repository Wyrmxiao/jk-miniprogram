// pkgWork/task/publish.js
const { learn, user } = require('../../services/index');

const DIRECTIONS = [
  { key: '', name: '不限' },
  { key: 'frontend', name: '前端开发' },
  { key: 'backend', name: '后端开发' },
  { key: 'algorithm', name: '算法竞赛' },
  { key: 'ai', name: '人工智能' },
  { key: 'security', name: '网络安全' },
  { key: 'embedded', name: '嵌入式/硬件' }
];

/** 已选学生 openid 数组 → 查表对象（WXML 绑定在 exparser 框架不能调 indexOf） */
function assignSelOf(list) {
  const sel = {};
  (list || []).forEach((id) => {
    sel[id] = true;
  });
  return sel;
}

Page({
  data: {
    submitting: false,
    keyboard: false,
    directions: DIRECTIONS,
    students: [],
    assignSel: {},
    form: {
      title: '',
      content: '',
      dueDate: '',
      direction: '',
      assignType: 'all',
      assignTo: []
    }
  },

  onLoad() {
    this.loadStudents();
  },

  /* 键盘弹起时收起固定 footer，避免遮挡输入框 */
  onKeyboardHeightChange(e) {
    this.setData({ keyboard: e.detail.height > 0 });
  },

  async loadStudents() {
    try {
      const res = await user.list({ role: 'student', page: 1, size: 100 });
      this.setData({ students: res.list || [] });
    } catch (e) {
      /* 学生名单可选 */
    }
  },

  onField(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onDirection(e) {
    this.setData({ 'form.direction': e.currentTarget.dataset.value });
  },

  onDueDate(e) {
    this.setData({ 'form.dueDate': e.detail.value });
  },

  onAssignType(e) {
    this.setData({ 'form.assignType': e.currentTarget.dataset.value });
  },

  toggleStudent(e) {
    const openid = e.currentTarget.dataset.openid;
    const list = this.data.form.assignTo.slice();
    const i = list.indexOf(openid);
    if (i >= 0) list.splice(i, 1);
    else list.push(openid);
    this.setData({ 'form.assignTo': list, assignSel: assignSelOf(list) });
  },

  async submit() {
    if (this.data.submitting) return;
    const f = this.data.form;
    if (!f.title.trim()) {
      wx.showToast({ title: '请填写任务标题', icon: 'none' });
      return;
    }
    if (f.assignType === 'some' && f.assignTo.length === 0) {
      wx.showToast({ title: '请至少选择一名学生', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await learn.publishTask(f);
      wx.showToast({ title: '任务已发布', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (e) {
      /* 已在 request 层提示 */
    } finally {
      this.setData({ submitting: false });
    }
  }
});
