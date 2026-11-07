// pkgContest/pick/pick.js —— 从赛事库选择赛事，加入「正在准备」或「参加过」
const { contest } = require('../../services/index');
const { raceTimeText } = require('../../utils/contest');

Page({
  data: {
    mode: 'preparing', // preparing = 正在准备 | joined = 参加过
    keyword: '',
    list: [],
    total: 0,
    page: 1,
    loading: true,
    loadingMore: false,
    noMore: false,
    // 已加入的赛事 id 集合（数组，便于 setData）
    prepSet: [],
    joinedSet: []
  },

  onLoad() {
    this.loadMine();
    this.loadList(true);
  },

  /** 我已加入的赛事（用于按钮态） */
  async loadMine() {
    try {
      const res = await contest.myProfile({});
      this.setData({
        prepSet: (res.preparing || []).map((x) => x.competitionId),
        joinedSet: (res.joined || []).map((x) => x.competitionId)
      });
      this.refreshFlags();
    } catch (e) {
      /* 静默，按钮态按未加入处理 */
    }
  },

  async loadList(reset) {
    if (reset) {
      this.setData({ page: 1, list: [], noMore: false, loading: true });
    } else {
      if (this.data.loadingMore || this.data.noMore) return;
      this.setData({ loadingMore: true });
    }

    const page = reset ? 1 : this.data.page + 1;
    try {
      const res = await contest.list({
        keyword: this.data.keyword,
        page,
        size: 20
      });
      const list = (res.list || []).map((c) =>
        Object.assign({}, c, {
          timeText: raceTimeText(c),
          inPreparing: this.data.prepSet.indexOf(c._id) > -1,
          inJoined: this.data.joinedSet.indexOf(c._id) > -1
        })
      );
      const all = reset ? list : this.data.list.concat(list);
      this.setData({
        list: all,
        total: res.total || 0,
        page,
        loading: false,
        loadingMore: false,
        noMore: all.length >= (res.total || 0)
      });
    } catch (e) {
      this.setData({ loading: false, loadingMore: false });
    }
  },

  onReachBottom() {
    this.loadList(false);
  },

  switchMode(e) {
    this.setData({ mode: e.currentTarget.dataset.mode });
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value || '' });
    this.loadList(true);
  },

  /** 加入 / 移出当前模式对应的列表 */
  async toggle(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const mode = this.data.mode;
    const setKey = mode === 'preparing' ? 'prepSet' : 'joinedSet';
    const set = this.data[setKey];
    const has = set.indexOf(id) > -1;

    const params =
      mode === 'preparing'
        ? { competitionId: id, preparing: !has }
        : { competitionId: id, joined: !has };

    try {
      await contest.register(params);
      const next = has ? set.filter((x) => x !== id) : set.concat(id);
      this.setData({ [setKey]: next });
      this.refreshFlags();
      wx.showToast({
        title: has ? '已移除' : (mode === 'preparing' ? '已加入准备' : '已登记参加过'),
        icon: 'none'
      });
    } catch (err) {
      /* 错误已在 request 层提示 */
    }
  },

  /** 依据两个集合刷新按钮态 */
  refreshFlags() {
    const list = this.data.list.map((c) =>
      Object.assign({}, c, {
        inPreparing: this.data.prepSet.indexOf(c._id) > -1,
        inJoined: this.data.joinedSet.indexOf(c._id) > -1
      })
    );
    this.setData({ list });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/contest/detail/detail?id=' + id });
  }
});
