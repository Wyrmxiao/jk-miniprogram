// pkgContest/stats/stats.js —— 比赛统计（全员可见）
const { contest } = require('../../services/index');
const { isLogin } = require('../../utils/auth');

const LEVEL_TEXT = { A: 'A类', B: 'B类', C: 'C类', D: 'D类' };

Page({
  data: {
    loading: true,
    error: '',
    tab: 'ranking',
    isLogin: false,

    overview: { people: 0, entries: 0, awards: 0, contests: 0 },
    levelRows: [],
    ranking: [],
    rankingTotal: 0,
    myRank: 0,
    myInTop: false,
    hot: [],
    my: {},
    myScore: 0
  },

  onLoad() {
    this.load();
  },

  onShow() {
    this.setData({ isLogin: isLogin() });
  },

  onPullDownRefresh() {
    this.load(true);
  },

  async load(fromPull) {
    this.setData({ loading: true, error: '' });
    try {
      const res = await contest.stats();
      const overview = res.overview || {};

      // 级别获奖分布：只展示非零项，避免一排 0 占位置
      const levelAwards = overview.levelAwards || {};
      const levelRows = ['A', 'B', 'C', 'D']
        .filter((lv) => levelAwards[lv] > 0)
        .map((lv) => ({ level: lv, text: LEVEL_TEXT[lv] || lv, count: levelAwards[lv] }));

      const ranking = (res.ranking || []).map((r) => {
        const meta = [r.major, r.grade].filter(Boolean).join(' · ');
        return Object.assign({}, r, { metaText: meta || '专业未填写' });
      });

      const hot = (res.hot || []).map((h) =>
        Object.assign({}, h, {
          levelText: LEVEL_TEXT[h.level] || (h.level ? h.level + '类' : ''),
          subText:
            (LEVEL_TEXT[h.level] || '未定级') +
            ' · 参赛 ' +
            h.joinCount +
            ' 人 · 获奖 ' +
            h.awardCount +
            ' 项'
        })
      );

      const my = res.my || {};
      this.setData({
        loading: false,
        overview,
        levelRows,
        ranking,
        rankingTotal: res.rankingTotal || 0,
        myRank: res.myRank || 0,
        myInTop: ranking.some((r) => r.isMe),
        hot,
        my,
        myScore: (my && my.score) || 0
      });
    } catch (e) {
      this.setData({
        loading: false,
        error: (e && e.message) || '统计加载失败'
      });
    } finally {
      if (fromPull) wx.stopPullDownRefresh();
    }
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/contest/detail/detail?id=' + id });
  },

  goLogin() {
    wx.navigateTo({ url: '/pkgAuth/login/login' });
  },

  goContest() {
    wx.switchTab({ url: '/pages/contest/contest' });
  }
});
