// pages/class/join.js —— 输入邀请码 / 扫码加入班级
const { classroom } = require('../../services/index');
const { ensureLogin } = require('../../utils/auth');

Page({
  data: {
    code: '',
    joining: false,
    joinedClass: null
  },

  onLoad(options) {
    const opt = options || {};
    // 支持三种进入方式：普通链接 ?code=xxx、小程序码 scene=xxx、分享卡片
    let code = opt.code || '';
    if (!code && opt.scene) {
      try {
        code = decodeURIComponent(opt.scene);
      } catch (e) {
        code = opt.scene;
      }
      // 部分场景 scene 会带参数（如 code=ABC123）
      const m = /code=([A-Za-z0-9]+)/.exec(code);
      if (m) code = m[1];
    }
    this.setData({ code: String(code || '').toUpperCase() });
  },

  onInput(e) {
    this.setData({ code: String(e.detail.value || '').toUpperCase().replace(/\s/g, '') });
  },

  async join() {
    if (this.data.joining) return;
    const code = this.data.code.trim();
    if (code.length < 4) {
      wx.showToast({ title: '请输入完整邀请码', icon: 'none' });
      return;
    }
    const ok = await ensureLogin();
    if (!ok) return;

    this.setData({ joining: true });
    try {
      const res = await classroom.join({ code });
      this.setData({ joining: false, joinedClass: res });
      wx.showToast({ title: res.already ? '你已在该班级' : '加入成功', icon: 'success' });
      setTimeout(() => {
        wx.redirectTo({ url: `/pages/class/detail?classId=${res.classId}` });
      }, 700);
    } catch (e) {
      this.setData({ joining: false });
    }
  },

  goReport() {
    wx.navigateTo({ url: '/pages/report/report' });
  }
});
