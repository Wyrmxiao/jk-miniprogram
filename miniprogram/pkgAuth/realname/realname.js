// pkgAuth/realname/realname.js —— 统一「完善资料」页
// 学生：学号实名认证（教师审核）；教师/管理员：直接完善姓名即通过
const { auth, user } = require('../../services/index');
const { getProfile, isTeacher, isLogin } = require('../../utils/auth');
const { refreshLogin } = require('../../utils/request');
const { formatDateTime } = require('../../utils/util');

Page({
  data: {
    isTeacher: false,
    submitting: false,
    application: null,
    profile: null,
    form: { studentId: '', realName: '', grade: '', major: '', title: '', phone: '' },
    // 教师审核
    pendingList: [],
    loading: false
  },

  onShow() {
    if (!isLogin()) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.setData({ isTeacher: isTeacher(), profile: getProfile() });
    this.loadApplication();
    if (isTeacher()) this.loadPending();
  },

  async loadApplication() {
    try {
      const application = await auth.getMyApplication();
      this.setData({ application });
    } catch (e) {
      this.setData({ application: null });
    }
  },

  async loadPending() {
    this.setData({ loading: true });
    try {
      const res = await auth.pendingList({ status: 'pending', page: 1, size: 50 });
      const list = (res.list || []).map((a) =>
        Object.assign({}, a, { timeText: formatDateTime(a.createdAt) })
      );
      this.setData({ pendingList: list, loading: false });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  /** 学生：提交学号实名认证申请 */
  async submit() {
    const { studentId, realName } = this.data.form;
    if (!String(studentId).trim() || !String(realName).trim()) {
      wx.showToast({ title: '学号与姓名不能为空', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await auth.submitRealname(this.data.form);
      wx.showToast({ title: '已提交，等待教师审核', icon: 'success' });
      this.loadApplication();
    } catch (e) {
      /* 已在 request 层提示 */
    } finally {
      this.setData({ submitting: false });
    }
  },

  /** 教师/管理员：完善个人资料，填姓名即通过 */
  async submitProfile() {
    const { realName, title, phone } = this.data.form;
    if (!String(realName).trim()) {
      wx.showToast({ title: '请填写姓名', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await user.completeProfile({ realName: realName.trim(), title, phone });
      // 刷新本地登录态，让「我的」页与交流发布门禁立即生效
      try {
        await refreshLogin();
      } catch (e) {
        /* 刷新失败不阻断，下次进入自动同步 */
      }
      wx.showToast({ title: '已保存', icon: 'success' });
      this.setData({ profile: getProfile() });
    } catch (e) {
      /* 已在 request 层提示 */
    } finally {
      this.setData({ submitting: false });
    }
  },

  async review(e) {
    const id = e.currentTarget.dataset.id;
    const approved = e.currentTarget.dataset.approved === 'true';
    try {
      await auth.review({ applicationId: id, approved });
      wx.showToast({ title: approved ? '已通过' : '已驳回', icon: 'success' });
      this.loadPending();
    } catch (err) {
      /* 已在 request 层提示 */
    }
  }
});
