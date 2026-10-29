/**
 * 算法训练 · 训练主页
 * 统计三卡 / 12 周热力图 / 知识点分布 / 打卡流水 / 手动补记弹层
 * 教师可切「学生训练」总览，点学生下钻（openid 参数回到本页）
 */
const { learn, contest } = require('../../services/index');
const { isTeacher, isVerified } = require('../../utils/auth');
const { ALGO_BANDS, ALGO_BAND_TEXT, ALGO_TAGS, ALGO_TAG_TEXT, ALGO_PLATFORMS } =
  require('../../constants/index');

/** 今天的北京日期（前端展示用） */
function bjDate(offsetDays = 0) {
  return new Date(Date.now() + 8 * 3600 * 1000 + offsetDays * 86400 * 1000)
    .toISOString()
    .slice(0, 10);
}

/** 12 周热力图：84 格，按日题数分 4 档（0/1/2/3+/5+） */
function buildHeat(byDate) {
  const cells = [];
  for (let i = 83; i >= 0; i--) {
    const d = bjDate(-i);
    const n = (byDate && byDate[d]) || 0;
    const l = n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4;
    cells.push({ k: String(i), d, n, l });
  }
  // 按周排列：补齐第一行前导空格（周一开头）
  const DAY = 86400000;
  const todayTs = new Date(bjDate() + 'T12:00:00+08:00').getTime();
  const dow = new Date(todayTs - 83 * DAY).getDay(); // 0=周日
  const pad = [];
  for (let i = 0; i < (dow === 0 ? 6 : dow - 1); i++) pad.push({ k: 'p' + i, l: -1, n: 0, d: '' });
  return pad.concat(cells);
}

/** 知识点分布条：预计算宽度百分比与文案 */
function buildTagDist(byTag) {
  const rows = ALGO_TAGS.map((t) => ({ key: t.key, name: t.name, n: (byTag && byTag[t.key]) || 0 }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 8);
  const max = Math.max(1, ...rows.map((r) => r.n));
  return rows.map((r) => Object.assign(r, { pct: Math.round((r.n / max) * 100) }));
}

Page({
  data: {
    isTeacher: false,
    isVerified: false,
    /** mine 我的学习 | students 学生总览（教师） | student 教师查看指定学生 */
    mode: 'mine',
    viewOpenid: '',
    viewName: '',

    stats: null,
    passRate: 0,
    heatCells: [],
    heatLegend: [0, 1, 2, 3, 4],
    tagRows: [],
    records: [],
    recordsLoading: true,

    goalText: '',
    goalPct: 0,
    goalDone: 0,
    goalTotal: 0,

    /* 补记弹层 */
    sheetShow: false,
    bands: ALGO_BANDS,
    tagChips: ALGO_TAGS,
    platformNames: ALGO_PLATFORMS,
    diffIndex: -1,
    platformIndex: ALGO_PLATFORMS.length - 1,
    tagSel: {},
    form: { title: '', url: '', note: '', passed: true, date: '' },
    dateStart: bjDate(-30),
    dateEnd: bjDate(),
    canSubmit: false,

    /* 学生总览（教师） */
    overview: [],

    /* 备赛目标弹层 */
    goalShow: false,
    contests: [],
    contestNames: [],
    contestIndex: -1,
    goalForm: { targetCount: '', deadline: '' }
  },

  onLoad(options) {
    const teacher = isTeacher();
    const data = { isTeacher: teacher, isVerified: isVerified() };
    if (options && options.openid && teacher) {
      data.mode = 'student';
      data.viewOpenid = options.openid;
      data.viewName = decodeURIComponent(options.name || '学生');
    }
    this.setData(data);
  },

  onShow() {
    if (this.data.mode === 'students') this.loadOverview();
    else this.refresh();
  },

  /** 加载统计 + 流水（学生视角 / 教师查看指定学生） */
  async refresh() {
    if (!this.data.isVerified && !this.data.isTeacher) {
      this.setData({ recordsLoading: false });
      return;
    }
    const openid = this.data.viewOpenid;
    try {
      const stats = await learn.algoStats(openid ? { openid } : {});
      const rec = await learn.algoRecords({ openid, page: 1, size: 20 });
      this.applyData(stats, rec.list || []);
    } catch (e) {
      this.setData({ recordsLoading: false });
    }
  },

  applyData(stats, records) {
    const passRate = stats.total ? Math.round((stats.passed / stats.total) * 100) : 0;
    const tagRows = buildTagDist(stats.byTag);
    const recordsView = records.map((r) => ({
      _id: r._id,
      title: r.title || r.titleEn || '未命名',
      difficulty: ALGO_BAND_TEXT[r.difficulty] || '未分档',
      diffKey: r.difficulty,
      dateText: r.date || '',
      passed: !!r.passed,
      hasComment: !!r.teacherComment,
      tagsText: (r.tags || [])
        .map((k) => ALGO_TAG_TEXT[k] || k)
        .slice(0, 2)
        .join(' / ')
    }));

    let goalText = '';
    let goalPct = 0;
    let goalDone = 0;
    let goalTotal = 0;
    const g = stats.goal;
    if (g && g.targetCount) {
      goalDone = stats.total || 0;
      goalTotal = g.targetCount;
      goalPct = Math.min(100, Math.round((goalDone / goalTotal) * 100));
      goalText = [g.contestName || '备赛目标', g.deadline ? `截止 ${g.deadline}` : ''].join(' · ');
    }

    this.setData({
      stats,
      passRate,
      heatCells: buildHeat(stats.byDate),
      tagRows,
      records: recordsView,
      recordsLoading: false,
      goalText,
      goalPct,
      goalDone,
      goalTotal
    });
  },

  /* ---------- 教师模式切换 ---------- */
  goBack() {
    wx.navigateBack();
  },

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode === this.data.mode) return;
    this.setData({ mode });
    if (mode === 'students') this.loadOverview();
    else this.refresh();
  },

  async loadOverview() {
    try {
      const res = await learn.algoTeacherOverview({ page: 1, size: 50 });
      const overview = (res.list || []).map((s) => ({
        openid: s.openid,
        name: s.displayName,
        studentNo: s.studentNo,
        total: s.total,
        passRate: s.passRate,
        streak: s.streak,
        isStudent: s.role === 'student'
      }));
      this.setData({ overview });
    } catch (e) {
      /* request 层已提示 */
    }
  },

  goStudent(e) {
    const { openid, name } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/algo/algo?openid=${openid}&name=${encodeURIComponent(name)}`
    });
  },

  /* ---------- 刷题入口 ---------- */
  goModules() {
    wx.navigateTo({ url: '/pages/algo/modules' });
  },

  goRecord(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/algo/detail?id=${id}` });
  },

  /* ---------- 手动补记弹层 ---------- */
  openSheet() {
    if (!this.data.isVerified) {
      wx.showToast({ title: '请先完成实名认证', icon: 'none' });
      return;
    }
    this.setData({ sheetShow: true, form: Object.assign({}, this.data.form, { date: bjDate() }) });
  },

  closeSheet() {
    this.setData({ sheetShow: false });
  },

  noop() {},

  onTitle(e) {
    this.setData({
      'form.title': e.detail.value,
      canSubmit: !!(e.detail.value.trim() && this.data.diffIndex >= 0)
    });
  },
  onUrl(e) {
    this.setData({ 'form.url': e.detail.value });
  },
  onNote(e) {
    this.setData({ 'form.note': e.detail.value });
  },
  onPassed(e) {
    this.setData({ 'form.passed': e.detail.value });
  },
  onDate(e) {
    this.setData({ 'form.date': e.detail.value });
  },
  onPlatform(e) {
    this.setData({ platformIndex: Number(e.detail.value) });
  },
  onDiffTap(e) {
    const diffIndex = Number(e.currentTarget.dataset.index);
    this.setData({
      diffIndex,
      canSubmit: !!(this.data.form.title.trim() && diffIndex >= 0)
    });
  },
  toggleTag(e) {
    const key = e.currentTarget.dataset.key;
    const tagSel = Object.assign({}, this.data.tagSel);
    if (tagSel[key]) delete tagSel[key];
    else tagSel[key] = true;
    this.setData({ tagSel });
  },

  async submitCheckIn() {
    const f = this.data.form;
    if (!this.data.canSubmit) return;
    try {
      await learn.algoCheckIn({
        title: f.title,
        platform: ALGO_PLATFORMS[this.data.platformIndex] || '',
        difficulty: ALGO_BANDS[this.data.diffIndex].key,
        tags: Object.keys(this.data.tagSel),
        passed: f.passed,
        url: f.url,
        note: f.note,
        date: f.date
      });
      this.setData({ sheetShow: false });
      wx.showToast({ title: '已记录，今日 +1 题', icon: 'none' });
      this.refresh();
    } catch (e) {
      /* request 层已提示 */
    }
  },

  /* ---------- 备赛目标 ---------- */
  async openGoal() {
    if (!this.data.isVerified) {
      wx.showToast({ title: '请先完成实名认证', icon: 'none' });
      return;
    }
    this.setData({ goalShow: true });
    if (!this.data.contests.length) {
      try {
        const res = await contest.list({ page: 1, size: 100 });
        const list = (res.list || []).filter((c) => c.name);
        this.setData({
          contests: list,
          contestNames: list.map((c) => c.name)
        });
      } catch (e) {
        /* 忽略，仍可设纯数字目标 */
      }
    }
  },

  closeGoal() {
    this.setData({ goalShow: false });
  },

  onContest(e) {
    this.setData({ contestIndex: Number(e.detail.value) });
  },
  onTargetCount(e) {
    this.setData({ 'goalForm.targetCount': e.detail.value });
  },
  onDeadline(e) {
    this.setData({ 'goalForm.deadline': e.detail.value });
  },
  clearGoal() {
    this.saveGoal(null);
  },

  async saveGoal(goal) {
    try {
      await learn.algoSetGoal(
        goal || { contestId: '', targetCount: 0, deadline: '' }
      );
      this.setData({ goalShow: false });
      wx.showToast({ title: goal ? '目标已保存' : '目标已清除', icon: 'none' });
      this.refresh();
    } catch (e) {
      /* request 层已提示 */
    }
  },

  submitGoal() {
    const idx = this.data.contestIndex;
    const count = parseInt(this.data.goalForm.targetCount, 10);
    if (idx < 0 || !count || count <= 0) {
      wx.showToast({ title: '请选择赛事并填写目标题数', icon: 'none' });
      return;
    }
    this.saveGoal({
      contestId: this.data.contests[idx]._id,
      targetCount: count,
      deadline: this.data.goalForm.deadline
    });
  }
});
