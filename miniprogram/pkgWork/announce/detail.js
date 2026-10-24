// pkgWork/announce/detail.js
const { announce } = require('../../services/index');
const { isTeacher, isAdmin, getProfile } = require('../../utils/auth');
const { fromNow } = require('../../utils/util');

Page({
  data: {
    id: '',
    loading: true,
    detail: null,
    timeText: '',
    canDelete: false
  },

  onLoad(options) {
    this.setData({ id: (options && options.id) || '' });
    this.loadDetail();
  },

  async loadDetail() {
    if (!this.data.id) {
      this.setData({ loading: false });
      return;
    }
    this.setData({ loading: true });
    try {
      const detail = await announce.detail({ id: this.data.id });
      const profile = getProfile();
      const myOpenid = (profile && profile.openid) || '';
      // 教师可删自己的，管理员可删全部
      const canDelete =
        isTeacher() && (detail.publisherOpenid === myOpenid || isAdmin());
      this.setData({
        detail,
        timeText: fromNow(detail.createdAt),
        canDelete,
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  async removeItem() {
    const ok = await new Promise((resolve) => {
      wx.showModal({
        title: '删除公告',
        content: '删除后学生端将不再可见，确认删除？',
        success: (r) => resolve(!!r.confirm),
        fail: () => resolve(false)
      });
    });
    if (!ok) return;
    try {
      await announce.remove({ id: this.data.id });
      wx.showToast({ title: '已删除', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (e) {
      /* 错误已在 request 层提示 */
    }
  }
});
