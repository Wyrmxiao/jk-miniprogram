// pages/report/report.js —— 学生端：每周学习汇报
const { report, classroom } = require('../../services/index');
const { ensureLogin } = require('../../utils/auth');
const week = require('../../utils/week');

Page({
  data: {
    loading: true,
    submitting: false,
    keyboard: false,
    weekInfo: null,
    weekLabel: '',
    weekRangeText: '',
    weekdayText: '',
    editable: false,
    submitted: false,
    updatedText: '',
    classes: [],
    selectedIds: [],
    form: {
      knowledge: '',
      difficulty: '',
      questions: '',
      blogUrl: ''
    },
    history: []
  },

  onShow() {
    this.loadAll();
  },

  /* 键盘弹起时收起固定 footer，避免遮挡输入框 */
  onKeyboardHeightChange(e) {
    this.setData({ keyboard: e.detail.height > 0 });
  },

  /** 拉取本周记录 + 我的班级 + 我的历史 */
  async loadAll() {
    const ok = await ensureLogin();
    if (!ok) return;
    this.setData({ loading: true });
    try {
      const [res, classRes] = await Promise.all([report.mine({}), classroom.mine({}).catch(() => ({ list: [] }))]);
      const w = res.week || {};
      const clsList = classRes.list || [];
      const saved = (res.report && res.report.classIds) || [];
      // 有历史选择就用历史的；首次提交默认投给所有已加入班级
      const selected = saved.length ? saved.filter((id) => clsList.some((c) => c._id === id)) : clsList.map((c) => c._id);
      this.setData({
        loading: false,
        weekInfo: w,
        weekLabel: w.weekKey || '',
        weekRangeText: week.shortRange(w),
        weekdayText: week.weekdayText(),
        editable: !!w.editable,
        submitted: !!res.report,
        updatedText: res.report ? this.formatTime(res.report.updatedAt) : '',
        classes: clsList.map((c) => ({
          _id: c._id,
          name: c.name,
          checked: selected.includes(c._id)
        })),
        selectedIds: selected,
        form: {
          knowledge: (res.report && res.report.knowledge) || '',
          difficulty: (res.report && res.report.difficulty) || '',
          questions: (res.report && res.report.questions) || '',
          blogUrl: (res.report && res.report.blogUrl) || ''
        }
      });
    } catch (e) {
      this.setData({ loading: false });
    }
    this.loadHistory();
  },

  /** 勾选/取消投递班级 */
  toggleClass(e) {
    const id = e.currentTarget.dataset.id;
    const classes = this.data.classes.map((c) => (c._id === id ? Object.assign({}, c, { checked: !c.checked }) : c));
    this.setData({ classes, selectedIds: classes.filter((c) => c.checked).map((c) => c._id) });
  },

  goClasses() {
    wx.navigateTo({ url: '/pages/class/list' });
  },

  async loadHistory() {
    try {
      const res = await report.myWeeks({ page: 1, size: 30 });
      const list = (res.list || []).map((r) => ({
        _id: r._id,
        weekKey: r.weekKey,
        rangeText: week.shortRange(week.weekRange(r.weekKey)),
        summary: this.summaryOf(r),
        hasBlog: !!r.blogUrl,
        updatedText: this.formatTime(r.updatedAt)
      }));
      this.setData({ history: list });
    } catch (e) {
      /* 历史加载失败不阻断填写 */
    }
  },

  /** 历史条目摘要：优先取知识点首句 */
  summaryOf(r) {
    const text = r.knowledge || r.difficulty || r.questions || '';
    const flat = String(text).replace(/\s+/g, ' ').trim();
    return flat.length > 40 ? `${flat.slice(0, 40)}…` : flat || '（未填写文字内容）';
  },

  formatTime(v) {
    if (!v) return '';
    const t = new Date(v);
    if (Number.isNaN(t.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}`;
  },

  onField(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  /** 一键粘贴示例，方便同学照着写（可删） */
  fillExample() {
    this.setData({
      'form.knowledge': '本周学习了动态规划的状态设计与转移方程，重点做了背包问题与最长上升子序列。',
      'form.difficulty': '状态压缩 DP 的空间优化还不太熟，滚动数组的边界条件容易写错。',
      'form.questions': '区间 DP 的循环顺序为什么必须按区间长度从小到大？',
      'form.blogUrl': 'https://example.com/my-blog/weekly-12'
    });
  },

  async submit() {
    if (this.data.submitting) return;
    if (!this.data.editable) {
      wx.showToast({ title: '历史周不可修改', icon: 'none' });
      return;
    }
    const f = this.data.form;
    if (!f.knowledge.trim() && !f.difficulty.trim() && !f.questions.trim() && !f.blogUrl.trim()) {
      wx.showToast({ title: '请至少填写一项', icon: 'none' });
      return;
    }
    if (f.blogUrl.trim() && !/^https?:\/\/\S+$/i.test(f.blogUrl.trim())) {
      wx.showToast({ title: '博客地址需以 http(s):// 开头', icon: 'none' });
      return;
    }
    if (!this.data.selectedIds.length) {
      wx.showModal({
        title: '还没选择班级',
        content: '汇报需要投递给至少一个班级，老师才能看到。先去加入班级吗？',
        confirmText: '去加入',
        success: (r) => {
          if (r.confirm) this.goClasses();
        }
      });
      return;
    }

    this.setData({ submitting: true });
    try {
      await report.save({
        weekKey: this.data.weekLabel,
        knowledge: f.knowledge.trim(),
        difficulty: f.difficulty.trim(),
        questions: f.questions.trim(),
        blogUrl: f.blogUrl.trim(),
        classIds: this.data.selectedIds
      });
      wx.showToast({ title: this.data.submitted ? '已更新' : '提交成功', icon: 'success' });
      this.loadAll();
    } catch (e) {
      /* 错误提示由 request 层统一处理 */
    } finally {
      this.setData({ submitting: false });
    }
  },

  /** 历史项点击：展示只读详情 */
  openHistory(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.history.find((h) => h._id === id);
    if (!item) return;
    wx.showModal({
      title: `${item.weekKey} 的汇报`,
      content: `更新于 ${item.updatedText || '—'}\n\n${item.summary}`,
      showCancel: false,
      confirmText: '知道了'
    });
  }
});
