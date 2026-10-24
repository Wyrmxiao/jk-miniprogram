// pages/learn/learn.js
const { learn } = require('../../services/index');
const { isTeacher, isVerified } = require('../../utils/auth');

const DIRECTIONS = [
  { key: 'frontend', name: '前端开发' },
  { key: 'backend', name: '后端开发' },
  { key: 'algorithm', name: '算法竞赛' },
  { key: 'ai', name: '人工智能' },
  { key: 'security', name: '网络安全' },
  { key: 'embedded', name: '嵌入式/硬件' }
];

/** 提交状态文案 */
const SUB_TEXT = {
  todo: '待完成',
  submitted: '已提交',
  reviewed: '已批阅',
  returned: '退回重做'
};

Page({
  data: {
    loading: true,
    isVerified: false,
    isTeacher: false,
    tab: 'task',
    directions: DIRECTIONS,
    SUB_TEXT,

    // 任务
    tasks: [],
    // 记录
    logs: [],

    // 弹层：提交 / 批阅 / 查看提交
    showSubmit: false,
    showReview: false,

    submitForm: { taskId: '', content: '', title: '' },
    reviewForm: { id: '', kind: 'log', comment: '', status: 'reviewed' },

    // 教师查看某任务的提交
    activeTask: null,
    submissions: []
  },

  onShow() {
    this.setData({ isVerified: isVerified(), isTeacher: isTeacher() });
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().then(() => wx.stopPullDownRefresh());
  },

  async loadData() {
    if (!isVerified()) {
      this.setData({ loading: false, tasks: [], logs: [] });
      return;
    }
    this.setData({ loading: true });
    try {
      const [tasks, logs] = await Promise.all([
        learn.taskList({ page: 1, size: 50 }),
        learn.logList({ page: 1, size: 30 })
      ]);
      this.setData({
        tasks: tasks.list || [],
        logs: logs.list || [],
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
  },

  goRealname() {
    wx.navigateTo({ url: '/pkgAuth/realname/realname' });
  },

  // ============ 教师：布置任务（独立页面） ============
  goPublishTask() {
    wx.navigateTo({ url: '/pkgWork/task/publish' });
  },

  // ============ 教师：查看提交并批阅 ============
  async openSubmissions(e) {
    const id = e.currentTarget.dataset.id;
    try {
      const res = await learn.taskDetail({ id });
      this.setData({ activeTask: res, submissions: res.submissions || [] });
    } catch (err) {
      /* 已在 request 层提示 */
    }
  },

  closeSubmissions() {
    this.setData({ activeTask: null, submissions: [] });
  },

  openReview(e) {
    const { id, kind } = e.currentTarget.dataset;
    this.setData({
      showReview: true,
      reviewForm: { id, kind: kind || 'submission', comment: '', status: 'reviewed' }
    });
  },

  closeReview() {
    this.setData({ showReview: false });
  },

  onReviewInput(e) {
    this.setData({ 'reviewForm.comment': e.detail.value });
  },

  onReviewStatus(e) {
    this.setData({ 'reviewForm.status': e.currentTarget.dataset.value });
  },

  async submitReview() {
    const f = this.data.reviewForm;
    if (f.kind === 'log') {
      await learn.commentLog({ id: f.id, comment: f.comment });
    } else {
      await learn.reviewSubmission({ id: f.id, comment: f.comment, status: f.status });
    }
    wx.showToast({ title: '已提交', icon: 'success' });
    this.setData({ showReview: false });
    this.loadData();
    if (this.data.activeTask) {
      const res = await learn.taskDetail({ id: this.data.activeTask._id });
      this.setData({ submissions: res.submissions || [] });
    }
  },

  async closeActiveTask() {
    if (!this.data.activeTask) return;
    await learn.closeTask({ id: this.data.activeTask._id });
    wx.showToast({ title: '任务已关闭', icon: 'success' });
    this.setData({ activeTask: null, submissions: [] });
    this.loadData();
  },

  // ============ 学生：提交作业 ============
  openSubmit(e) {
    const { id, title } = e.currentTarget.dataset;
    this.setData({
      showSubmit: true,
      submitForm: { taskId: id, title, content: '' }
    });
  },

  closeSubmit() {
    this.setData({ showSubmit: false });
  },

  onSubmitInput(e) {
    this.setData({ 'submitForm.content': e.detail.value });
  },

  async submitMyWork() {
    const f = this.data.submitForm;
    if (!f.content.trim()) {
      wx.showToast({ title: '请填写完成情况', icon: 'none' });
      return;
    }
    await learn.submitTask({ taskId: f.taskId, content: f.content });
    wx.showToast({ title: '已提交', icon: 'success' });
    this.setData({ showSubmit: false });
    this.loadData();
  },

  // ============ 学习记录（独立页面：pkgWork/log/edit） ============
  goWriteLog() {
    wx.navigateTo({ url: '/pkgWork/log/edit' });
  },

  /** 弹层占位：catchtap 阻止事件冒泡到遮罩 */
  noop() {}
});
