/**
 * 自然周工具（后端）
 * 与前端 miniprogram/utils/week.js 算法保持一致（ISO 周，周一为起点，北京时间）
 */
const TZ_OFFSET = 8 * 60 * 60 * 1000; // 北京时间
const DAY = 24 * 60 * 60 * 1000;

const pad = (n) => String(n).padStart(2, '0');

/** 计算某时刻所属自然周（ISO 周，周一为起点）及起止日期 */
function weekInfo(date = new Date()) {
  const shifted = new Date(date.getTime() + TZ_OFFSET);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();
  const local = Date.UTC(y, m, d); // 把北京时间的“日期”当作 UTC 日期处理，避免时区偏移
  const dow = new Date(local).getUTCDay() || 7; // 1=周一 ... 7=周日
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

/** 把 weekKey 还原成该周的起止日期；非法格式返回 null */
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

/** 云数据库时间 → yyyy-MM-dd HH:mm */
function formatTime(v) {
  if (!v) return '';
  const t = new Date(v);
  if (Number.isNaN(t.getTime())) return '';
  const bj = new Date(t.getTime() + TZ_OFFSET);
  return `${bj.getUTCFullYear()}-${pad(bj.getUTCMonth() + 1)}-${pad(bj.getUTCDate())} ${pad(bj.getUTCHours())}:${pad(bj.getUTCMinutes())}`;
}

module.exports = { weekInfo, weekRange, formatTime, pad, DAY, TZ_OFFSET };
