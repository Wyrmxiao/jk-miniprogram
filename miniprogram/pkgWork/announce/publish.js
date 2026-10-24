// pkgWork/announce/publish.js
const { announce, contest } = require('../../services/index');

Page({
  data: {
    submitting: false,
    keyboard: false,
    form: {
      type: 'notice',
      title: '',
      content: '',
      competitionId: '',
      top: false,
      push: true
    },
    competitions: [],
    competitionNames: [],
    competitionIndex: -1
  },

  onLoad() {
    this.loadCompetitions();
  },

  /* 键盘弹起时收起固定 footer，避免遮挡输入框 */
  onKeyboardHeightChange(e) {
    this.setData({ keyboard: e.detail.height > 0 });
  },

  async loadCompetitions() {
    try {
      const res = await contest.list({ page: 1, size: 200 });
      this.setData({
        competitions: res.list || [],
        competitionNames: (res.list || []).map((c) => `${c.level}类 · ${c.name}`)
      });
    } catch (e) {
      /* 关联竞赛为可选项，失败不阻断发布 */
    }
  },

  onType(e) {
    this.setData({ 'form.type': e.currentTarget.dataset.value });
  },

  onField(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onToggle(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: !this.data.form[field] });
  },

  onCompetitionPick(e) {
    const index = Number(e.detail.value);
    const id = index >= 0 ? this.data.competitions[index]._id : '';
    this.setData({ competitionIndex: index, 'form.competitionId': id });
  },

  async submit() {
    if (this.data.submitting) return;
    const f = this.data.form;
    if (!f.title.trim()) {
      wx.showToast({ title: '请填写标题', icon: 'none' });
      return;
    }
    if (!f.content.trim()) {
      wx.showToast({ title: '请填写公告内容', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await announce.publish(f);
      wx.showToast({ title: '发布成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (e) {
      /* 已在 request 层提示 */
    } finally {
      this.setData({ submitting: false });
    }
  }
});
