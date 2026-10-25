// pages/contest/contest.js
const { contest } = require('../../services/index');
const { isTeacher, isLogin } = require('../../utils/auth');
const favorite = require('../../utils/favorite');

const LEVELS = [
  { key: '', text: '全部' },
  { key: 'A', text: 'A类' },
  { key: 'B', text: 'B类' },
  { key: 'C', text: 'C类' },
  { key: 'D', text: 'D类' }
];

const CATEGORIES = [
  { key: '', text: '全部' },
  { key: 'hardware', text: '硬件类' },
  { key: 'scienceOther', text: '理工其他' },
  { key: 'humanity', text: '人文社科' }
];

/** 生成每项赛事的时间标注 */
function timeMeta(item) {
  if (item.regEnd) {
    return { timeLabel: '报名截止 ' + String(item.regEnd).slice(0, 10), timeState: 'exact' };
  }
  if (item.contestDate) {
    return { timeLabel: '开赛 ' + String(item.contestDate).slice(0, 10), timeState: 'exact' };
  }
  const ms = item.typicalMonths;
  if (ms && ms.length) {
    const m = new Date().getMonth() + 1;
    const next = ms.find((x) => x >= m) || ms[0];
    const diff = next >= m ? next - m : next + 12 - m;
    const label = '往期惯例 ' + ms.join('/') + ' 月报名';
    return {
      timeLabel: label,
      timeState: diff <= 1 ? 'soon' : 'normal',
      soon: diff <= 1
    };
  }
  return { timeLabel: '时间待定', timeState: 'pending' };
}

const CATEGORY_TEXT = { hardware: '硬件类', scienceOther: '理工其他', humanity: '人文社科' };

Page({
  data: {
    levels: LEVELS,
    categories: CATEGORIES,
    level: '',
    category: 'scienceOther',
    keyword: '',
    focusOnly: false,
    followedOnly: false,
    displayList: [],

    list: [],
    total: 0,
    page: 1,
    loading: true,
    loadingMore: false,
    noMore: false,
    isTeacher: false,
    isLogin: false
  },

  onLoad() {
    this.loadList(true);
  },

  onShow() {
    this.setData({ isTeacher: isTeacher(), isLogin: isLogin() });
  },

  /** 教师入口：赛事维护（编辑时间等信息） */
  goManage() {
    wx.navigateTo({ url: '/pkgContest/manage/manage' });
  },

  /** 点击赛事卡片进入详情 */
  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/contest/detail/detail?id=' + id });
  },

  onReachBottom() {
    if (this.data.noMore || this.data.loadingMore) return;
    this.loadList(false);
  },

  async loadList(reset) {
    if (reset) {
      this.setData({ page: 1, list: [], noMore: false, loading: true });
    } else {
      this.setData({ loadingMore: true });
    }

    const page = reset ? 1 : this.data.page + 1;
    try {
      const res = await contest.list({
        level: this.data.level,
        category: this.data.category,
        keyword: this.data.keyword,
        focusOnly: this.data.focusOnly,
      
        page,
        size: 20
      });
      const list = res.list.map((c) =>
        Object.assign({}, c, timeMeta(c), {
          categoryText: CATEGORY_TEXT[c.category] || '',
          hasUrl: !!c.officialUrl,
          // 云端状态优先，本地缓存兜底（未登录/云端未同步）
          followed: c.followed !== undefined ? !!c.followed : favorite.has(c._id)
        })
      );
      const all = reset ? list : this.data.list.concat(list);
      this.setData({
        list: all,
        displayList: this.filterDisplay(all),
        total: res.total,
        page,
        noMore: list.length >= res.total,
        loading: false,
        loadingMore: false
      });
    } catch (e) {
      this.setData({ loading: false, loadingMore: false });
    }
  },

  onLevelChange(e) {
    this.setData({ level: e.currentTarget.dataset.key }, () => this.loadList(true));
  },

  onCategoryChange(e) {
    this.setData({ category: e.currentTarget.dataset.key }, () => this.loadList(true));
  },

  toggleFocus() {
    this.setData({ focusOnly: !this.data.focusOnly }, () => this.loadList(true));
  },

  /** 关注/取消关注：先写本地星标（即时反馈），已认证用户再静默同步云端 */
  async toggleFollow(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const followed = favorite.toggle(id);
    this.setData({
      list: this.data.list.map((c) =>
        c._id === id ? Object.assign({}, c, { followed }) : c
      )
    }, () => {
      this.setData({ displayList: this.filterDisplay(this.data.list) });
    });
    wx.showToast({ title: followed ? '已关注' : '已取消关注', icon: 'none', duration: 800 });

    // 已登录用户同步云端（云端是最终真相，失败则回滚本地）
    if (this.data.isLogin) {
      try {
        await contest.follow({ competitionId: id, follow: followed });
      } catch (err) {
        favorite.set(id, !followed);
        this.setData({
          list: this.data.list.map((c) =>
            c._id === id ? Object.assign({}, c, { followed: !followed }) : c
          ),
          displayList: this.filterDisplay(this.data.list)
        });
      }
    }
  },

  toggleFollowedOnly() {
    const followedOnly = !this.data.followedOnly;
    this.setData({ followedOnly, displayList: this.filterDisplay(this.data.list) });
  },

  filterDisplay(list) {
    return this.data.followedOnly ? list.filter((c) => c.followed) : list;
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value }, () => this.loadList(true));
  }
});
