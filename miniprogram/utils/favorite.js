// utils/favorite.js —— 竞赛本地收藏（存于本机，不依赖云开发）
const KEY = 'JK_FAV_CONTESTS';

function list() {
  return wx.getStorageSync(KEY) || [];
}

function has(id) {
  return list().indexOf(id) !== -1;
}

/** 收藏/取消收藏，返回切换后的状态（true=已收藏） */
function toggle(id) {
  const cur = list();
  const idx = cur.indexOf(id);
  const next = idx === -1 ? cur.concat(id) : cur.filter((x) => x !== id);
  wx.setStorageSync(KEY, next);
  return idx === -1;
}

module.exports = { list, has, toggle };
