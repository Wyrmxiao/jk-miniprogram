// pages/contest/contest.js
const { contest } = require('../../services/index');
const { isTeacher } = require('../../utils/auth');

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
    list: [],
    total: 0,
    page: 1,
    loading: true,
    loadingMore: false,
    noMore: false,
    isTeacher: false
  },

  onLoad() {
    this.loadList(true);
  },

  onShow() {
    this.setData({ isTeacher: isTeacher() });
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
          hasUrl: !!c.officialUrl
        })
      );
      this.setData({
        list: reset ? list : this.data.list.concat(list),
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

  onSearch(e) {
    this.setData({ keyword: e.detail.value }, () => this.loadList(true));
  }
});
