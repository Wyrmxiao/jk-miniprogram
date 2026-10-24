// app.js
const { DOMAIN, STORAGE_KEY } = require('./constants/index');
const { request, refreshLogin } = require('./utils/request');

App({
  globalData: {
    /** 云开发环境 ID：cloud1-d5gr2v7tz34fafa7c */
    env: 'cloud1-d5gr2v7tz34fafa7c',
    /** 当前用户信息 { openid, role, authStatus, studentId, realName, ... } */
    profile: null,
    /** 系统信息，供页面做安全区与适配 */
    systemInfo: null,
    /** 是否已检查过隐私授权 */
    privacyChecked: false
  },

  onLaunch() {
    this.initSystemInfo();
    this.initCloud();
    this.globalData.profile = wx.getStorageSync(STORAGE_KEY.PROFILE) || null;
    this.checkPrivacy();
    this.silentLogin().then(
      () => this.ensureSystemReady(),
      () => this.ensureSystemReady()
    );
  },

  initSystemInfo() {
    try {
      this.globalData.systemInfo = wx.getSystemInfoSync();
    } catch (e) {
      this.globalData.systemInfo = null;
    }
  },

  initCloud() {
    if (!wx.cloud) {
      console.error('当前基础库过低，无法使用云开发能力');
      wx.showModal({
        title: '基础库版本过低',
        content: '请升级微信客户端后使用',
        showCancel: false
      });
      return;
    }
    wx.cloud.init({
      env: this.globalData.env,
      traceUser: true
    });
  },

  /**
   * 用户隐私保护指引
   * 采集学号、姓名前必须先取得授权，否则相关接口会被微信拦截
   * 需在小程序后台「设置-服务内容声明-用户隐私保护指引」中同步配置
   */
  checkPrivacy() {
    if (!wx.getPrivacySetting) return;
    wx.getPrivacySetting({
      success: (res) => {
        // needAuthorization 为 true 表示需要弹窗；res.privacyContractName 为指引名称
        this.globalData.needPrivacy = !!res.needAuthorization;
      },
      fail: () => {}
    });
  },

  /** 静默登录：失败不打断用户，等进入需登录页面时再引导 */
  silentLogin() {
    return refreshLogin()
      .then((profile) => {
        this.globalData.profile = profile;
        return profile;
      })
      .catch(() => {
        this.globalData.profile = null;
        return null;
      });
  },

  /**
   * 系统冷启动初始化：建配置、指定首位管理员、导入竞赛库
   * 后端两个接口都是幂等的，重复调用无副作用；本地缓存标记避免每次启动都跑
   */
  ensureSystemReady() {
    if (wx.getStorageSync(STORAGE_KEY.DB_INITED)) return Promise.resolve(null);

    return refreshLogin()
      .then(() => request(DOMAIN.AUTH, 'bootstrap', {}, { silent: true, retry: false }))
      .then((res) => {
        this.globalData.systemStatus = res;
        // 刚被提升为管理员时刷新身份，否则导入竞赛会因权限不足失败
        return res && res.justInitialized ? refreshLogin() : null;
      })
      .then(() => request(DOMAIN.CONTEST, 'importSeed', {}, { silent: true, retry: false }))
      .then((res) => {
        this.globalData.seedResult = res;
        console.log('[系统初始化] 竞赛库导入结果', res);
        wx.setStorageSync(STORAGE_KEY.DB_INITED, true);
        // 首次导入给个可见反馈，便于在模拟器/真机确认结果
        if (res && res.imported > 0) {
          setTimeout(() => {
            wx.showToast({ title: `竞赛库已导入 ${res.imported} 项`, icon: 'none', duration: 2500 });
          }, 1200);
        }
        return res;
      })
      .catch((err) => {
        console.error('[系统初始化] 未完成，下次启动会重试', err);
        return null;
      });
  },

  /** 手动重跑初始化（管理员在「我的」页触发） */
  rerunSystemInit() {
    wx.removeStorageSync(STORAGE_KEY.DB_INITED);
    return this.ensureSystemReady();
  }
});
