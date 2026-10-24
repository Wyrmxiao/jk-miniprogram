// pkgWork/admin/users/users.js —— 管理员：用户与权限管理
const { user } = require('../../../services/index');
const { getProfile, isAdmin } = require('../../../utils/auth');
const { ROLE_TEXT, AUTH_STATUS_TEXT } = require('../../../constants/index');

const TABS = [
  { key: '', text: '全部' },
  { key: 'guest', text: '游客' },
  { key: 'student', text: '学生' },
  { key: 'teacher', text: '教师' },
  { key: 'admin', text: '管理员' }
];

/** 角色 → 徽章样式类 */
const ROLE_TAG = {
  guest: 'tag',
  student: 'tag-success',
  teacher: 'tag-primary',
  admin: 'tag-danger'
};

/** 最近活跃时间：只显示到月日，避免长串时间串 */
function formatTime(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 后端用户文档 → 视图模型（WXML 不做任何方法调用，全部在此预计算） */
function toView(item, myId) {
  const name = item.realName || item.nickname || '未完善资料';
  const meta = [];
  if (item.studentId) meta.push(`学号 ${item.studentId}`);
  if (item.grade || item.major) meta.push([item.grade, item.major].filter(Boolean).join(' '));
  const active = formatTime(item.lastLoginAt || item.updatedAt);
  if (active) meta.push(`活跃于 ${active}`);
  if (!meta.length) meta.push('尚未完善资料');

  return Object.assign({}, item, {
    name,
    initial: name.slice(0, 1),
    sub: meta.join(' · '),
    roleText: ROLE_TEXT[item.role] || '游客',
    authText: AUTH_STATUS_TEXT[item.authStatus] || '未认证',
    roleTag: ROLE_TAG[item.role] || 'tag',
    isSelf: !!myId && item._id === myId
  });
}

Page({
  data: {
    tabs: TABS,
    tab: '',
    keyword: '',
    list: [],
    total: 0,
    page: 1,
    loading: true,
    loadingMore: false,
    noMore: false
  },

  onLoad() {
    // 后端 setRole 亦有管理员校验，此处仅为前端门禁，防止误入
    if (!isAdmin()) {
      wx.showToast({ title: '仅管理员可访问', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.loadList(true);
  },

  onPullDownRefresh() {
    this.loadList(true, () => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.noMore || this.data.loadingMore || this.data.loading) return;
    this.loadList(false);
  },

  async loadList(reset, done) {
    const myId = (getProfile() && getProfile()._id) || '';
    if (reset) this.setData({ page: 1, list: [], noMore: false, loading: true });
    else this.setData({ loadingMore: true });

    const page = reset ? 1 : this.data.page + 1;
    try {
      const res = await user.list({
        role: this.data.tab,
        keyword: this.data.keyword,
        page,
        size: 20
      });
      const list = (res.list || []).map((u) => toView(u, myId));
      const merged = reset ? list : this.data.list.concat(list);
      const total = res.total || 0;
      this.setData({
        list: merged,
        total,
        page,
        noMore: list.length === 0 || merged.length >= total,
        loading: false,
        loadingMore: false
      });
    } catch (e) {
      this.setData({ loading: false, loadingMore: false });
    } finally {
      if (done) done();
    }
  },

  switchTab(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.tab) return;
    this.setData({ tab: key }, () => this.loadList(true));
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value }, () => this.loadList(true));
  },

  /** 分配角色：学生 / 教师 / 管理员 */
  async setRole(e) {
    const { id, role } = e.currentTarget.dataset;
    const item = this.data.list.find((x) => x._id === id);
    if (!item || item.role === role) return;
    if (item.isSelf) {
      wx.showToast({ title: '不能修改自己的角色', icon: 'none' });
      return;
    }

    const text = ROLE_TEXT[role] || role;
    const ok = await new Promise((resolve) => {
      wx.showModal({
        title: '分配角色',
        content: `确认将「${item.name}」设为${text}？`,
        success: (r) => resolve(!!r.confirm),
        fail: () => resolve(false)
      });
    });
    if (!ok) return;

    try {
      const res = await user.setRole({ userId: id, role });
      // 就地更新，避免整页刷新导致列表跳动
      const list = this.data.list.map((x) => {
        if (x._id !== id) return x;
        const next = Object.assign({}, x, {
          role,
          authStatus: res.authStatus || x.authStatus
        });
        return toView(next, (getProfile() && getProfile()._id) || '');
      });
      this.setData({ list });
      wx.showToast({ title: `已设为${text}`, icon: 'success' });
    } catch (e) {
      /* 错误已在 request 层统一提示 */
    }
  }
});
