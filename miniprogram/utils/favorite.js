// utils/favorite.js —— 「关注赛事」的本地缓存（存于本机，不依赖云开发）
//
// 语义统一：全站只有「关注」一个动作，星标(★/☆)是它的视觉呈现。
// 云端 contest.follow / contest.myList 是最终真相；本模块是列表星标的快速缓存，
// 在 follow 成功后写入、在 myList 拉回后 addMany 合并，保证两边一致。
const KEY = 'JK_FAV_CONTESTS';

/** 取全部已关注的 competitionId */
function list() {
  return wx.getStorageSync(KEY) || [];
}

/** 是否已关注 */
function has(id) {
  return !!id && list().indexOf(id) !== -1;
}

/** 显式设置关注状态（用于与云端对齐，不触发切换） */
function set(id, on) {
  if (!id) return !!on;
  const cur = list();
  const idx = cur.indexOf(id);
  const next = on
    ? (idx === -1 ? cur.concat(id) : cur)
    : (idx === -1 ? cur : cur.filter((x) => x !== id));
  wx.setStorageSync(KEY, next);
  return !!on;
}

/** 本地切换，返回切换后的状态（true=已关注）。云端同步由调用方负责 */
function toggle(id) {
  return set(id, !has(id));
}

/** 把云端返回的 competitionId 合并进本地缓存（去重，保留本地兜底项） */
function addMany(ids) {
  const seen = {};
  const merged = [];
  list().concat(Array.isArray(ids) ? ids : []).forEach((id) => {
    if (id && !seen[id]) {
      seen[id] = true;
      merged.push(id);
    }
  });
  wx.setStorageSync(KEY, merged);
  return merged;
}

module.exports = { list, has, set, toggle, addMany };
