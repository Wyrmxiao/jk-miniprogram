Component({
  data: {
    active: 0,
    list: [
      { pagePath: '/pages/index/index', text: '首页', icon: '/assets/icons/home.png', activeIcon: '/assets/icons/home-active.png' },
      { pagePath: '/pages/learn/learn', text: '学习', icon: '/assets/icons/learn.png', activeIcon: '/assets/icons/learn-active.png' },
      { pagePath: '/pages/contest/contest', text: '竞赛', icon: '/assets/icons/contest.png', activeIcon: '/assets/icons/contest-active.png' },
      { pagePath: '/pages/project/project', text: '项目', icon: '/assets/icons/project.png', activeIcon: '/assets/icons/project-active.png' },
      { pagePath: '/pages/mine/mine', text: '我的', icon: '/assets/icons/mine.png', activeIcon: '/assets/icons/mine-active.png' }
    ]
  },
  methods: {
    onTap(e) {
      const index = e.currentTarget.dataset.index;
      const item = this.data.list[index];
      if (this.data.active === index) return;
      wx.switchTab({ url: item.pagePath });
    }
  }
});
