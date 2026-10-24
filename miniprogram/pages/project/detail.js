// pages/project/detail.js —— 项目详情：档案 + 进展时间线 + 留言
const { project } = require('../../services/index');
const { getProfile, isTeacher } = require('../../utils/auth');
const { PROJECT_STAGE_TEXT, DIRECTION_TEXT } = require('../../constants/index');
const { fromNow } = require('../../utils/util');

Page({
  data: {
    id: '',
    loading: true,
    project: null,
    updates: [],
    comments: [],
    isTeacher: false,
    isOwner: false,
    // 进展草稿（仅项目主人）
    draft: '',
    canSend: false,
    sending: false,
    // 留言草稿
    commentDraft: '',
    canSendComment: false,
    commentSending: false
  },

  onLoad(options) {
    this.setData({ id: (options && options.id) || '' });
  },

  onShow() {
    this.load();
  },

  async load() {
    if (!this.data.id) return;
    try {
      const res = await project.detail({ id: this.data.id });
      const me = getProfile();
      const myOpenid = (me && me.openid) || '';
      const isAdmin = !!(me && me.role === 'admin');
      const p = res.project || {};

      // 预计算展示字段（WXML 绑定不支持方法调用）
      p.stageText = PROJECT_STAGE_TEXT[p.stage] || p.stage;
      p.directionText = DIRECTION_TEXT[p.direction] || p.direction;
      p.timeText = fromNow(p.updatedAt);

      const updates = (res.updates || []).map((u) =>
        Object.assign({}, u, {
          timeText: fromNow(u.createdAt),
          canDelete: u.authorOpenid === myOpenid || isAdmin
        })
      );
      const comments = (res.comments || []).map((c) =>
        Object.assign({}, c, {
          timeText: fromNow(c.createdAt),
          isTeacher: c.authorRole === 'teacher' || c.authorRole === 'admin',
          canDelete: c.authorOpenid === myOpenid || isAdmin
        })
      );

      this.setData({
        loading: false,
        project: p,
        updates,
        comments,
        isTeacher: isTeacher(),
        isOwner: !!myOpenid && p.ownerOpenid === myOpenid
      });
      wx.setNavigationBarTitle({ title: p.name || '项目详情' });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  // ===== 教师推荐 =====
  async toggleFeature() {
    if (this.data.featuring) return;
    this.setData({ featuring: true });
    try {
      await project.feature({
        projectId: this.data.id,
        featured: !this.data.project.featured
      });
      wx.showToast({ title: this.data.project.featured ? '已取消推荐' : '已推荐', icon: 'success' });
      this.load();
    } catch (e) {
      /* 已在 request 层提示 */
    } finally {
      this.setData({ featuring: false });
    }
  },

  // ===== 作者操作 =====
  editProject() {
    wx.navigateTo({ url: `/pkgWork/project/edit?id=${this.data.id}` });
  },

  removeProject() {
    wx.showModal({
      title: '删除项目',
      content: '删除后广场不再展示，确定删除该项目？',
      confirmColor: '#b9807f',
      success: async (r) => {
        if (!r.confirm) return;
        try {
          await project.remove({ id: this.data.id });
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/project/project' }) }), 600);
        } catch (e) {
          /* 已在 request 层提示 */
        }
      }
    });
  },

  // ===== 项目进展 =====
  onDraftInput(e) {
    const draft = e.detail.value || '';
    this.setData({ draft, canSend: !!draft.trim() });
  },

  async publishUpdate() {
    const content = (this.data.draft || '').trim();
    if (!content || this.data.sending) return;
    this.setData({ sending: true });
    try {
      await project.addUpdate({ projectId: this.data.id, content });
      wx.showToast({ title: '已发布', icon: 'success' });
      this.setData({ draft: '', canSend: false });
      this.load();
    } catch (e) {
      /* 已在 request 层提示 */
    } finally {
      this.setData({ sending: false });
    }
  },

  removeUpdate(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除进展',
      content: '确定删除这条进展记录？',
      confirmColor: '#b9807f',
      success: async (r) => {
        if (!r.confirm) return;
        try {
          await project.removeUpdate({ id });
          this.load();
        } catch (e2) {
          /* 已在 request 层提示 */
        }
      }
    });
  },

  // ===== 留言 =====
  onCommentInput(e) {
    const commentDraft = e.detail.value || '';
    this.setData({ commentDraft, canSendComment: !!commentDraft.trim() });
  },

  async sendComment() {
    const content = (this.data.commentDraft || '').trim();
    if (!content || this.data.commentSending) return;
    this.setData({ commentSending: true });
    try {
      await project.addComment({ projectId: this.data.id, content });
      this.setData({ commentDraft: '', canSendComment: false });
      this.load();
    } catch (e) {
      /* 已在 request 层提示 */
    } finally {
      this.setData({ commentSending: false });
    }
  },

  removeComment(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除留言',
      content: '确定删除这条留言？',
      confirmColor: '#b9807f',
      success: async (r) => {
        if (!r.confirm) return;
        try {
          await project.removeComment({ id });
          this.load();
        } catch (e2) {
          /* 已在 request 层提示 */
        }
      }
    });
  }
});
