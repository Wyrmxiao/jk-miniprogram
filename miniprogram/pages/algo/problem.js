/**
 * 算法训练 · 题目详情
 *
 * 三段内容：完整题面 / 解题过程 / 涉及的知识点
 * 背题模式：默认收起解析与知识点，学生先自己想，点了再看。
 *
 * 内容按需加载：列表页与首屏不带题面，进本页面才请求 algoProblemContent。
 * WXML 数据绑定不调用方法（项目约定），所有派生字段在 JS 里预计算。
 */
const { learn } = require('../../services/index');

Page({
  data: {
    id: '',
    loading: true,
    problem: null,
    myRecords: [],
    done: false,
    note: '',
    latestRecordId: '',
    noteSaving: false,

    // 内容包
    contentLoading: false,
    content: null,
    contentErr: '',
    tab: 'statement',          // statement | solution | knowledge
    hasContent: false,
    // 背题模式：solution / knowledge 先遮住
    revealed: false,
    // 预计算的展示字段（WXML 不调方法）
    solutionSteps: [],
    codeNotes: [],
    knowledgeItems: [],
    metaText: '',
    solutionTypeText: ''
  },

  onLoad(options) {
    this.setData({ id: (options && options.id) || '' });
    this.load();
  },

  async load() {
    try {
      const res = await learn.algoProblemDetail({ id: this.data.id });
      const latest = res.myRecords && res.myRecords[0];
      this.setData({
        problem: res.problem,
        myRecords: res.myRecords || [],
        done: res.done,
        note: (latest && latest.note) || '',
        latestRecordId: (latest && latest._id) || '',
        loading: false,
        hasContent: !!res.problem.hasContent,
        solutionTypeText: res.problem.solutionType === 'editorial' ? '逐题精讲' : '通用解题框架'
      });
      // 有内容才拉，避免无谓请求
      if (res.problem.hasContent) this.loadContent();
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  async loadContent() {
    if (this.data.contentLoading) return;
    this.setData({ contentLoading: true, contentErr: '' });
    try {
      const c = await learn.algoProblemContent({ id: this.data.id });
      if (!c || !c.available) {
        this.setData({ contentErr: '这道题的题面还在补充中，可以先去官方做题。', contentLoading: false });
        return;
      }
      this.setData({
        content: c,
        contentLoading: false,
        solutionSteps: this.decorateSteps(c.solution),
        codeNotes: this.decorateNotes(c.solution),
        knowledgeItems: this.decorateKnowledge(c.knowledge),
        metaText: this.buildMeta(c)
      });
    } catch (e) {
      this.setData({ contentLoading: false, contentErr: '内容加载失败，下拉重试或稍后再看。' });
    }
  },

  /** 步骤加序号，WXML 直接渲染，不做方法调用 */
  decorateSteps(solution) {
    if (!solution || !Array.isArray(solution.steps)) return [];
    return solution.steps.map((text, i) => ({ n: i + 1, text }));
  },

  decorateNotes(solution) {
    if (!solution || !Array.isArray(solution.codeNotes)) return [];
    return solution.codeNotes.map((text, i) => ({ n: i + 1, text }));
  },

  /** 知识点：把数组字段拼成文本，并预生成展开态字段 */
  decorateKnowledge(list) {
    if (!Array.isArray(list)) return [];
    return list.map((k, i) => ({
      key: k.key,
      name: k.name,
      intro: k.intro || '',
      why: k.why || '',
      signalsText: (k.signals || []).join('；'),
      stepsText: (k.steps || []).map((s, j) => `${j + 1}. ${s}`).join('\n'),
      pitfallsText: (k.pitfalls || []).join('；'),
      complexity: k.complexity || '',
      code: k.code || '',
      relatedText: (k.related || []).join('、'),
      open: false,
      idx: i
    }));
  },

  buildMeta(c) {
    const m = c.meta || {};
    const parts = [];
    if (m.difficulty) parts.push(c.source === 'leetcode' ? `难度 ${m.difficulty}` : m.difficulty);
    if (m.timeLimit) parts.push(`时限 ${m.timeLimit}`);
    if (m.memoryLimit) parts.push(`内存 ${m.memoryLimit}`);
    return parts.join(' · ');
  },

  onTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
  },

  toggleReveal() {
    this.setData({ revealed: !this.data.revealed });
  },

  toggleKnowledge(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const key = `knowledgeItems[${idx}].open`;
    this.setData({ [key]: !this.data.knowledgeItems[idx].open });
  },

  copyLink() {
    const p = this.data.problem;
    if (!p || !p.url) return;
    wx.setClipboardData({
      data: p.url,
      success: () => {
        wx.showToast({ title: '链接已复制，去浏览器打开', icon: 'none', duration: 2000 });
      }
    });
  },

  copyCode() {
    const s = this.data.content && this.data.content.solution;
    if (!s || !s.code) return;
    wx.setClipboardData({ data: s.code, success: () => wx.showToast({ title: '代码已复制', icon: 'none' }) });
  },

  onNote(e) {
    this.setData({ note: e.detail.value });
  },

  async saveNote() {
    if (!this.data.latestRecordId || this.data.noteSaving) return;
    this.setData({ noteSaving: true });
    try {
      await learn.algoUpdateNote({ id: this.data.latestRecordId, note: this.data.note });
      wx.showToast({ title: '备注已保存', icon: 'none' });
    } catch (e) {
      /* request 层已提示 */
    }
    this.setData({ noteSaving: false });
  },

  goTagProblems(e) {
    const tag = e.currentTarget.dataset.tag;
    wx.navigateTo({
      url: `/pages/algo/problems?tag=${tag}&band=${this.data.problem.band}`
    });
  },

  goRecord(e) {
    wx.navigateTo({ url: `/pages/algo/detail?id=${e.currentTarget.dataset.id}` });
  },

  onPullDownRefresh() {
    if (this.data.hasContent) this.loadContent();
    wx.stopPullDownRefresh();
  },

  noop() {}
});
