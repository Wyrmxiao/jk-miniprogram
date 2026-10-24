/** 通用工具函数 */

/** 补零 */
function pad(n) {
  return n < 10 ? `0${n}` : String(n);
}

/** Date/时间戳 -> YYYY-MM-DD */
function formatDate(input) {
  if (!input) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Date/时间戳 -> YYYY-MM-DD HH:mm */
function formatDateTime(input) {
  if (!input) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '';
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 相对时间：刚刚 / x分钟前 / x天前 / 具体日期 */
function fromNow(input) {
  if (!input) return '';
  const d = input instanceof Date ? input : new Date(input);
  const diff = Date.now() - d.getTime();
  if (diff < 60 * 1000) return '刚刚';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / 86400000)}天前`;
  return formatDate(d);
}

/** 距离某个日期还有几天（负数为已过） */
function daysUntil(input) {
  if (!input) return null;
  const d = input instanceof Date ? input : new Date(input);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
  return Math.round((target - today) / 86400000);
}

function toast(title, icon = 'none') {
  wx.showToast({ title: String(title).slice(0, 30), icon, duration: 2000 });
}

function confirm(content, title = '提示') {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      success: (res) => resolve(res.confirm),
      fail: () => resolve(false)
    });
  });
}

/** 防抖 */
function debounce(fn, wait = 300) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

/** 节流（按钮防重复点击） */
function throttle(fn, wait = 800) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last < wait) return;
    last = now;
    return fn.apply(this, args);
  };
}

/** 截断文本 */
function ellipsis(text, len = 20) {
  if (!text) return '';
  return text.length > len ? `${text.slice(0, len)}…` : text;
}

module.exports = {
  pad,
  formatDate,
  formatDateTime,
  fromNow,
  daysUntil,
  toast,
  confirm,
  debounce,
  throttle,
  ellipsis
};
