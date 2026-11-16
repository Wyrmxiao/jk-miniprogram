/**
 * 自然周工具（与云函数 handlers/report.js 的算法保持一致）
 *
 * weekKey 统一格式：2026-W45
 * 一周从周一开始，到周日结束，时间基准为北京时间。
 */

const TZ_OFFSET = 8 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

const pad = (n) => String(n).padStart(2, '0');

/** 某时刻所属自然周：{ weekKey, weekStart, weekEnd } */
function weekInfo(date = new Date()) {
  const shifted = new Date(date.getTime() + TZ_OFFSET);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();
  const local = Date.UTC(y, m, d);
  const dow = new Date(local).getUTCDay() || 7;
  const thursday = local + (4 - dow) * DAY;
  const thursdayYear = new Date(thursday).getUTCFullYear();
  const yearStart = Date.UTC(thursdayYear, 0, 1);
  const week = Math.ceil(((thursday - yearStart) / DAY + 1) / 7);
  const monday = local - (dow - 1) * DAY;
  const fmt = (ms) => {
    const t = new Date(ms);
    return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
  };
  return {
    weekKey: `${thursdayYear}-W${pad(week)}`,
    weekStart: fmt(monday),
    weekEnd: fmt(monday + 6 * DAY)
  };
}

/** 由 weekKey 反推起止日期；非法返回 null */
function weekRange(weekKey) {
  const match = /^(\d{4})-W(\d{1,2})$/.exec(String(weekKey || ''));
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  const jan4 = Date.UTC(year, 0, 4);
  const jan4Dow = new Date(jan4).getUTCDay() || 7;
  const week1Monday = jan4 - (jan4Dow - 1) * DAY;
  const monday = week1Monday + (week - 1) * 7 * DAY;
  const fmt = (ms) => {
    const t = new Date(ms);
    return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
  };
  return { weekKey: `${year}-W${pad(week)}`, weekStart: fmt(monday), weekEnd: fmt(monday + 6 * DAY) };
}

/** 12-30 ~ 12-06 这样的短标签 */
function shortRange(info) {
  if (!info) return '';
  const s = String(info.weekStart || '').slice(5).replace('-', '/');
  const e = String(info.weekEnd || '').slice(5).replace('-', '/');
  return s && e ? `${s} - ${e}` : '';
}

/** 是否为本周 */
function isCurrentWeek(weekKey) {
  return weekKey === weekInfo().weekKey;
}

/** 最近的 n 个自然周（含本周），倒序 */
function recentWeeks(n = 8) {
  const current = weekInfo();
  const base = Date.UTC(
    Number(current.weekStart.slice(0, 4)),
    Number(current.weekStart.slice(5, 7)) - 1,
    Number(current.weekStart.slice(8, 10))
  );
  const list = [];
  for (let i = 0; i < n; i += 1) {
    list.push(weekInfo(new Date(base - i * 7 * DAY)));
  }
  return list;
}

/** 周几（用于提示“今天是周X”） */
const WEEKDAY_TEXT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
function weekdayText(date = new Date()) {
  return WEEKDAY_TEXT[date.getDay()];
}

module.exports = {
  weekInfo,
  weekRange,
  shortRange,
  isCurrentWeek,
  recentWeeks,
  weekdayText
};
