// pkgContest/mylist/mylist.js —— 板块列表：正在准备的比赛 / 参加过的比赛
const { contest } = require('../../services/index');
const { getProfile } = require('../../utils/auth');
const { raceTimeText, awardDisplay } = require('../../utils/contest');

const TYPE_TITLE = {
  preparing: '正在准备的比赛',
  joined: '参加过的比赛'
};

Page({
  data: {
    loading: true,
    type: 'preparing',
    openid: '',
    isSelf: false,
    list: []
  },

  onLoad(options) {
    const type = options && options.type === 'joined' ? 'joined' : 'preparing';
    const target = (options && options.openid) || '';
    const profile = getProfile();
    const selfOpenid = (profile && profile.openid) || '';
    wx.setNavigationBarTitle({ title: TYPE_TITLE[type] });
    this.setData({
      type,
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
      const params = this.data.isSelf ? {} : { openid: this.data.openid };
      const res = await contest.myProfile(params);
      const rows = res[this.data.type] || [];
      const list = rows.map((r) =>
        Object.assign({}, r, {
          timeText: raceTimeText(r),
          awardShow: awardDisplay(r) || '暂无登记'
        })
      );
      this.setData({ loading: false, list });
    } catch (e) {
      this.setData({ loading: false, list: [] });
    } finally {
      if (fromPull) wx.stopPullDownRefresh();
    }
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/contest/detail/detail?id=' + id });
  },

  /** 本人：去选择赛事加入 */
  goPick() {
    wx.navigateTo({ url: '/pkgContest/pick/pick' });
  },

  goContest() {
    wx.switchTab({ url: '/pages/contest/contest' });
  },

  /** 本人：长按移除 */
  async removeItem(e) {
    if (!this.data.isSelf) return;
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const isPreparing = this.data.type === 'preparing';
    const ok = await new Promise((resolve) => {
      wx.showModal({
        title: '移除赛事',
        content: isPreparing
          ? '不再将它列为「正在准备的比赛」？'
          : '将从「参加过的比赛」中移除，获奖登记也会一并清空',
        success: (r) => resolve(!!r.confirm),
        fail: () => resolve(false)
      });
    });
    if (!ok) return;
    try {
      await contest.register({ competitionId: id, [isPreparing ? 'preparing' : 'joined']: false });
      wx.showToast({ title: '已移除', icon: 'none' });
      this.load();
    } catch (err) {
      /* 错误已在 request 层提示 */
    }
  }
});
