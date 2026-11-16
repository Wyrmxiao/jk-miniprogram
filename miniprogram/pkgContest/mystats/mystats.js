// pkgContest/mystats/mystats.js —— 赛事统计总览：两个板块入口
const { contest } = require('../../services/index');
const { getProfile } = require('../../utils/auth');

Page({
  data: {
    loading: true,
    openid: '',
    isSelf: false,
    counts: { preparing: 0, joined: 0 }
  },

  onLoad(options) {
    const target = (options && options.openid) || '';
    const profile = getProfile();
    const selfOpenid = (profile && profile.openid) || '';
    this.setData({
      openid: target,
      isSelf: !target || target === selfOpenid
    });
  },

  onShow() {
    this.load();
  },

  onPullDownRefresh() {
    this.load(true);
  },

  async load(fromPull) {
    this.setData({ loading: true });
    try {
      // 不传 openid = 查自己
      const params = this.data.isSelf ? {} : { openid: this.data.openid };
      const res = await contest.myProfile(params);
      this.setData({
        loading: false,
        counts: {
          preparing: (res.preparing || []).length,
          joined: (res.joined || []).length
        }
      });
    } catch (e) {
      this.setData({ loading: false, counts: { preparing: 0, joined: 0 } });
    } finally {
      if (fromPull) wx.stopPullDownRefresh();
    }
  },

  /** 进入板块列表页 */
  goList(e) {
    const type = e.currentTarget.dataset.type === 'joined' ? 'joined' : 'preparing';
    let url = '/pkgContest/mylist/mylist?type=' + type;
    if (!this.data.isSelf && this.data.openid) url += '&openid=' + this.data.openid;
    wx.navigateTo({ url });
  }
});
