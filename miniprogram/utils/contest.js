/**
 * 竞赛展示公共工具：赛事时间文案 / 获奖展示
 * 「我的-赛事统计」「个人主页」「赛事详情」共用，保持口径一致
 */

/** 获奖等次文本（与云端 utils/stats.js 的 AWARD_TEXT 保持一致） */
const AWARD_TEXT = {
  special: '特等奖',
  first: '一等奖',
  second: '二等奖',
  third: '三等奖',
  other: '其他获奖'
};

/** 赛事时间文案：优先官方精确日期，否则往期惯例月份 */
function raceTimeText(c) {
  if (!c) return '时间待定';
  if (c.regEnd) return '报名截止 ' + String(c.regEnd).slice(0, 10);
  if (c.contestDate) return '开赛 ' + String(c.contestDate).slice(0, 10);
  const ms = c.typicalMonths;
  if (ms && ms.length) return '往届惯例 ' + ms.join('/') + ' 月报名';
  return '时间待定';
}

/**
 * 获奖展示文案：自由说明优先，其次等次，否则空串
 * 调用方对空串兜底「暂无登记」
 */
function awardDisplay(row) {
  if (!row) return '';
  if (row.awardNote) return row.awardNote;
  return AWARD_TEXT[row.award] || '';
}

module.exports = { AWARD_TEXT, raceTimeText, awardDisplay };
