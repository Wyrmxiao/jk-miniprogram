// pages/class/detail.js —— 班级详情（邀请码 / 二维码 / 成员 / 本周提交）
const { classroom } = require('../../services/index');
const { ensureLogin, isTeacher } = require('../../utils/auth');
const poster = require('../../utils/poster');

Page({
  data: {
    classId: '',
    loading: true,
    cls: null,
    members: [],
    week: null,
    mySubmitted: false,
    canViewReports: false,
    qrFileID: '',
    qrUrl: '',
    qrLoading: false,
    cardLoading: false,
    cardPath: '',
    showAllMembers: false
  },

  onLoad(options) {
    const classId = (options && options.classId) || '';
    this.setData({ classId });
  },

  onShow() {
    if (this.data.classId) this.load();
  },

  async load() {
    const ok = await ensureLogin();
    if (!ok) return;
    this.setData({ loading: true });
    try {
      const res = await classroom.detail({ classId: this.data.classId });
      const cls = res.cls || {};
      this.setData({
        loading: false,
        cls,
        members: res.members || [],
        week: res.week || null,
        mySubmitted: !!res.mySubmittedThisWeek,
        canViewReports: !!(cls.isOwner || isTeacher())
      });
    } catch (e) {
      this.setData({ loading: false });
      setTimeout(() => wx.navigateBack(), 1200);
    }
  },

  copyCode() {
    if (!this.data.cls || !this.data.cls.code) return;
    wx.setClipboardData({ data: this.data.cls.code });
  },

  /** 拿二维码（有缓存直接用，失败返回空串，不弹提示） */
  async ensureQr() {
    if (this.data.qrFileID) return this.data.qrFileID;
    if (this.data.qrLoading) return '';
    this.setData({ qrLoading: true });
    try {
      const res = await classroom.qr({ classId: this.data.classId });
      if (!res.fileID) return '';
      const urlRes = await wx.cloud.getTempFileURL({ fileList: [res.fileID] });
      const url = (urlRes.fileList && urlRes.fileList[0] && urlRes.fileList[0].tempFileURL) || '';
      this.setData({ qrFileID: res.fileID, qrUrl: url });
      return res.fileID;
    } catch (e) {
      return '';
    } finally {
      this.setData({ qrLoading: false });
    }
  },

  async makeQr() {
    if (this.data.qrLoading) return;
    const fileID = await this.ensureQr();
    if (!fileID) wx.showToast({ title: '二维码生成失败，请用邀请码', icon: 'none' });
  },

  previewQr() {
    if (!this.data.qrUrl) return;
    wx.previewImage({ urls: [this.data.qrUrl] });
  },

  /**
   * 一键邀请卡片：拼「班级名 + 小程序码 + 邀请码」成图片，
   * 直接调起微信分享图片面板，可选中班级群发送。
   */
  async shareCard() {
    if (this.data.cardLoading) return;
    const cls = this.data.cls || {};
    if (!cls.code) {
      wx.showToast({ title: '班级信息还没加载好', icon: 'none' });
      return;
    }
    this.setData({ cardLoading: true });
    wx.showLoading({ title: '正在生成卡片', mask: true });
    try {
      // 没二维码就先试着生成一张（失败也继续，卡片里会提示用邀请码）
      let qrSrc = '';
      const fileID = await this.ensureQr();
      if (fileID) {
        try {
          const dl = await wx.cloud.downloadFile({ fileID });
          qrSrc = dl.tempFilePath || '';
        } catch (e) {
          qrSrc = '';
        }
      }
      const path = await poster.buildClassCard(this, {
        className: cls.name,
        intro: cls.intro,
        code: cls.code,
        qrSrc
      });
      wx.hideLoading();
      this.setData({ cardLoading: false, cardPath: path });
      await poster.shareImage(path);
    } catch (e) {
      wx.hideLoading();
      this.setData({ cardLoading: false });
      wx.showToast({ title: '卡片生成失败，请重试', icon: 'none' });
    }
  },

  goReports() {
    wx.navigateTo({ url: `/pkgWork/report/list?classId=${this.data.classId}` });
  },

  goReport() {
    wx.navigateTo({ url: '/pages/report/report' });
  },

  toggleMembers() {
    this.setData({ showAllMembers: !this.data.showAllMembers });
  },

  async removeMember(e) {
    const { openid, name } = e.currentTarget.dataset;
    const confirm = await new Promise((resolve) => {
      wx.showModal({
        title: '移除成员',
        content: `确定把「${name}」移出班级？对方将无法再向本班提交汇报。`,
        confirmText: '移除',
        confirmColor: '#ef4444',
        success: (r) => resolve(!!r.confirm),
        fail: () => resolve(false)
      });
    });
    if (!confirm) return;
    try {
      await classroom.removeMember({ classId: this.data.classId, openid });
      wx.showToast({ title: '已移除', icon: 'success' });
      this.load();
    } catch (err) {
      /* 错误提示由 request 层统一处理 */
    }
  },

  async quit() {
    const confirm = await new Promise((resolve) => {
      wx.showModal({
        title: '退出班级',
        content: '退出后将不再向本班提交汇报，确定退出？',
        confirmText: '退出',
        success: (r) => resolve(!!r.confirm),
        fail: () => resolve(false)
      });
    });
    if (!confirm) return;
    try {
      await classroom.quit({ classId: this.data.classId });
      wx.showToast({ title: '已退出', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 700);
    } catch (e) {
      /* 统一提示 */
    }
  },

  async dissolve() {
    const confirm = await new Promise((resolve) => {
      wx.showModal({
        title: '解散班级',
        content: '解散后成员与历史汇报仍保留在数据库，但班级不可再用，确定解散？',
        confirmText: '解散',
        confirmColor: '#ef4444',
        success: (r) => resolve(!!r.confirm),
        fail: () => resolve(false)
      });
    });
    if (!confirm) return;
    try {
      await classroom.dissolve({ classId: this.data.classId });
      wx.showToast({ title: '已解散', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 700);
    } catch (e) {
      /* 统一提示 */
    }
  },

  onShareAppMessage() {
    const cls = this.data.cls || {};
    return {
      title: `${cls.name || '班级'}：邀请你加入`,
      path: `/pages/class/join?code=${cls.code || ''}`
    };
  }
});
