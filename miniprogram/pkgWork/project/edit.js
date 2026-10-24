// pkgWork/project/edit.js —— 项目创建/编辑（编辑模式复用，带 id 参数）
const { project, contest } = require('../../services/index');
const { PROJECT_STAGE_TEXT } = require('../../constants/index');
const { DIRECTIONS } = require('../../constants/index');

const STAGES = Object.keys(PROJECT_STAGE_TEXT).map((key) => ({
  key,
  name: PROJECT_STAGE_TEXT[key]
}));

Page({
  data: {
    id: '',
    keyboard: false,
    submitting: false,
    directions: DIRECTIONS,
    stages: STAGE_TABS(),
    // 单选高亮查表（WXML 绑定不支持方法调用）
    dirSel: {},
    stageSel: {},
    contestNames: [],
    contestIndex: 0,
    form: {
      name: '',
      direction: '',
      stage: '',
      summary: '',
      outcome: '',
      members: '',
      competitionId: '',
      competitionName: ''
    }
  },

  onLoad(options) {
    const id = (options && options.id) || '';
    this.setData({ id });
    if (id) {
      wx.setNavigationBarTitle({ title: '编辑项目' });
      this.loadForEdit(id);
    }
    this.loadContests();
  },

  onKeyboardHeightChange(e) {
    this.setData({ keyboard: e.detail.height > 0 });
  },

  /** 编辑模式：拉详情回填 */
  async loadForEdit(id) {
    try {
      const res = await project.detail({ id });
      const p = res.project || {};
      this.setData({
        form: {
          name: p.name || '',
          direction: p.direction || '',
          stage: p.stage || '',
          summary: p.summary || '',
          outcome: p.outcome || '',
          members: p.members || '',
          competitionId: p.competitionId || '',
          competitionName: p.competitionName || ''
        },
        dirSel: this.singleSel(p.direction),
        stageSel: this.singleSel(p.stage)
      });
    } catch (e) {
      /* 已在 request 层提示 */
    }
  },

  /** 拉竞赛库供关联选择 */
  async loadContests() {
    try {
      const res = await contest.list({ page: 1, size: 100 });
      const list = res.list || [];
      // 「不关联」固定首项（WXML 绑定不支持方法调用，picker range 用预计算数组）
      this._contests = list;
      this.setData({
        contestNames: ['不关联竞赛'].concat(list.map((c) => c.name))
      });
    } catch (e) {
      this.setData({ contestNames: ['不关联竞赛'] });
    }
  },

  singleSel(key) {
    const sel = {};
    if (key) sel[key] = true;
    return sel;
  },

  onField(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  pickDirection(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ 'form.direction': key, dirSel: this.singleSel(key) });
  },

  pickStage(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ 'form.stage': key, stageSel: this.singleSel(key) });
  },

  onContestPick(e) {
    const index = Number(e.detail.value) || 0;
    this.setData({ contestIndex: index });
    if (index === 0) {
      this.setData({ 'form.competitionId': '', 'form.competitionName': '' });
    } else {
      const c = (this._contests || [])[index - 1];
      if (c) {
        this.setData({ 'form.competitionId': c._id, 'form.competitionName': c.name });
      }
    }
  },

  async submit() {
    if (this.data.submitting) return;
    const f = this.data.form;
    if (!f.name.trim()) {
      wx.showToast({ title: '请填写项目名称', icon: 'none' });
      return;
    }
    if (!f.direction) {
      wx.showToast({ title: '请选择技术方向', icon: 'none' });
      return;
    }
    if (!f.stage) {
      wx.showToast({ title: '请选择项目阶段', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      if (this.data.id) {
        await project.update(Object.assign({ id: this.data.id }, f));
        wx.showToast({ title: '已保存', icon: 'success' });
      } else {
        await project.create(f);
        wx.showToast({ title: '已创建', icon: 'success' });
      }
      setTimeout(() => wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/project/project' }) }), 600);
    } catch (e) {
      /* 已在 request 层提示 */
    } finally {
      this.setData({ submitting: false });
    }
  }
});

/** 阶段选项（从常量生成） */
function STAGE_TABS() {
  return Object.keys(PROJECT_STAGE_TEXT).map((key) => ({ key, name: PROJECT_STAGE_TEXT[key] }));
}
