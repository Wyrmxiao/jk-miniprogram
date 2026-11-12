/**
 * 算法训练 · 打卡记录详情
 * 学生查看；教师写评语；本人/管理员可删除
 */
const { learn } = require('../../services/index');
const { isTeacher, isAdmin } = require('../../utils/auth');
const { ALGO_BAND_TEXT, ALGO_TAG_TEXT } = require('../../constants/index');

Page({
  data: {
    id: '',
    loading: true,
    rec: null,
    isTeacher: false,
    isAdmin: false,
    isOwner: false,
    comment: '',
    submitting: false,
    problemInfo: null
  },

  onLoad(options) {
    this.setData({
      id: (options && options.id) || '',
      isTeacher: isTeacher(),
      isAdmin: isAdmin()
    });
  },

  onShow() {
    this.load();
  },

  async load() {
    try {
      const rec = await learn.algoRecordDetail({ id: this.data.id });
      const app = getApp();
      const myOpenid = (app && app.globalData && app.globalData.profile && app.globalData.profile.openid) || '';
      rec.diffText = ALGO_BAND_TEXT[rec.difficulty] || '未分档';
      rec.dateText = rec.date || '';
      rec.tagNames = (rec.tags || []).map((k) => ALGO_TAG_TEXT[k] || k);
      rec.passedText = rec.passed ? '已通过' : '未通过';
      this.setData({
        rec,
        isOwner: !!myOpenid && rec.openid === myOpenid,
        problemInfo: rec.problemInfo || null,
        comment: rec.teacherComment || '',
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  onComment(e) {
    this.setData({ comment: e.detail.value });
  },

  async submitComment() {
    if (!this.data.comment.trim() || this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      await learn.algoComment({ id: this.data.id, comment: this.data.comment });
      wx.showToast({ title: '评语已保存', icon: 'success' });
      this.load();
    } catch (e) {
      /* request 层已提示 */
    }
    this.setData({ submitting: false });
  },

  removeRecord() {
    wx.showModal({
      title: '删除这条记录？',
      content: '删除后统计会同步扣减，无法恢复',
      confirmColor: '#b9807f',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await learn.algoRemove({ id: this.data.id });
          wx.showToast({ title: '已删除', icon: 'none' });
          setTimeout(() => wx.navigateBack(), 600);
        } catch (e) {
          /* request 层已提示 */
        }
      }
    });
  },

  copyLink() {
    const info = this.data.problemInfo;
    if (!info || !info.url) return;
    wx.setClipboardData({
      data: info.url,
      success: () => wx.showToast({ title: '链接已复制', icon: 'none' })
    });
  }
});
