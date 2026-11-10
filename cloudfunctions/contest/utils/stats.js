/**
 * 比赛统计 · 公共层
 *
 * 数据口径：
 *   my_contests 中 joined=true 的记录 = 一次参赛
 *   my_contests 中 award 非空 = 一次获奖
 *   仅统计未被下架（deleted=false）的赛事
 *
 * 积分规则（用于学生榜排序，仅作展示激励，不代表学校认定）：
 *   参赛一次 +2 分
 *   获奖按等次计分，再乘以赛事级别系数：
 *     特等 10 / 一等 8 / 二等 6 / 三等 4 / 其他获奖 3
 *     A 类 ×1.5 / B 类 ×1.2 / C 类 ×1.0 / D 类 ×0.8
 */

const AWARD_TEXT = {
  special: '特等奖',
  first: '一等奖',
  second: '二等奖',
  third: '三等奖',
  other: '其他获奖'
};

const AWARD_KEYS = Object.keys(AWARD_TEXT);

const AWARD_SCORE = { special: 10, first: 8, second: 6, third: 4, other: 3 };
const LEVEL_FACTOR = { A: 1.5, B: 1.2, C: 1.0, D: 0.8 };
const JOIN_SCORE = 2;

/** 单页拉取上限（云函数端单次上限 1000，取 500 兼顾速度与超时） */
const PAGE_SIZE = 500;

/**
 * 分页拉取集合全量数据
 * 云数据库单次查询有条数上限，统计类接口必须循环取完
 */
async function fetchAll(db, collection, where) {
  const col = db.collection(collection);
  const list = [];
  let skip = 0;

  for (;;) {
    let batch = [];
    try {
      const query = where ? col.where(where) : col;
      const res = await query.skip(skip).limit(PAGE_SIZE).get();
      batch = (res && res.data) || [];
    } catch (e) {
      // 集合尚未创建（如竞赛库未导入）时按空数据处理，避免整个统计接口报错
      console.warn('[stats] 读取集合失败：' + collection, e && e.message);
      return list;
    }
    list.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
    // 安全阀：避免异常数据导致死循环
    if (skip > 20000) break;
  }

  return list;
}

/** 按 openid 批量取用户档案（姓名/专业/年级），分批避免 in 条件过长 */
async function fetchUsers(db, openids) {
  const map = {};
  const unique = Array.from(new Set(openids.filter(Boolean)));
  const _ = db.command;

  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const res = await db
      .collection('users')
      .where({ openid: _.in(chunk) })
      .limit(100)
      .get();
    (res.data || []).forEach((u) => {
      map[u.openid] = {
        name: u.realName || u.nickName || '',
        major: u.major || '',
        grade: u.grade || ''
      };
    });
  }

  return map;
}

/** 保留一位小数 */
function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * 构建全局统计
 * @param {object} db 数据库句柄
 * @param {string} openid 当前用户（可为空，游客也能看）
 */
async function buildStats(db, openid) {
  const [records, competitions] = await Promise.all([
    fetchAll(db, 'my_contests', { joined: true }),
    fetchAll(db, 'competitions', { deleted: false })
  ]);

  const compMap = {};
  competitions.forEach((c) => {
    compMap[c._id] = c;
  });

  // 只保留仍然在架的赛事，避免已下架赛事影响统计
  const valid = records.filter((r) => r.openid && r.competitionId && compMap[r.competitionId]);

  const people = new Set();
  const contestSet = new Set();
  const levelAwards = { A: 0, B: 0, C: 0, D: 0 };
  const userMap = {};
  const hotMap = {};
  let awardCount = 0;

  valid.forEach((r) => {
    const comp = compMap[r.competitionId];
    const level = comp.level || '';
    const award = AWARD_TEXT[r.award] ? r.award : '';

    people.add(r.openid);
    contestSet.add(r.competitionId);

    if (!userMap[r.openid]) {
      userMap[r.openid] = {
        openid: r.openid,
        joinCount: 0,
        awardCount: 0,
        score: 0
      };
    }
    const u = userMap[r.openid];
    u.joinCount += 1;
    u.score += JOIN_SCORE;

    if (award) {
      awardCount += 1;
      u.awardCount += 1;
      u.score += (AWARD_SCORE[award] || 0) * (LEVEL_FACTOR[level] || 1);
      if (levelAwards[level] !== undefined) levelAwards[level] += 1;
    }

    if (!hotMap[r.competitionId]) {
      hotMap[r.competitionId] = {
        id: r.competitionId,
        name: comp.name || '未知赛事',
        level,
        category: comp.category || '',
        joinCount: 0,
        awardCount: 0
      };
    }
    hotMap[r.competitionId].joinCount += 1;
    if (award) hotMap[r.competitionId].awardCount += 1;
  });

  // ---- 学生榜 ----
  const users = await fetchUsers(db, Object.keys(userMap));
  const rankAll = Object.keys(userMap)
    .map((k) => {
      const u = userMap[k];
      const info = users[k] || {};
      return {
        openid: k,
        name: info.name || '未实名同学',
        major: info.major || '',
        grade: info.grade || '',
        joinCount: u.joinCount,
        awardCount: u.awardCount,
        score: round1(u.score)
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.awardCount !== a.awardCount) return b.awardCount - a.awardCount;
      if (b.joinCount !== a.joinCount) return b.joinCount - a.joinCount;
      return String(a.name).localeCompare(String(b.name));
    });

  let myRank = 0;
  rankAll.forEach((item, idx) => {
    item.rank = idx + 1;
    item.isMe = !!openid && item.openid === openid;
    if (item.isMe) myRank = item.rank;
    // openid 不下发到前端
    delete item.openid;
  });

  // ---- 热门赛事 ----
  const hot = Object.keys(hotMap)
    .map((k) => hotMap[k])
    .sort((a, b) => {
      if (b.joinCount !== a.joinCount) return b.joinCount - a.joinCount;
      if (b.awardCount !== a.awardCount) return b.awardCount - a.awardCount;
      return String(a.name).localeCompare(String(b.name));
    })
    .slice(0, 10);

  // ---- 我的战绩 ----
  const my = await buildMine(db, openid, compMap);
  // 我的积分与榜单同口径
  const meRow = openid ? userMap[openid] : null;
  my.score = meRow ? round1(meRow.score) : 0;

  return {
    overview: {
      people: people.size,
      entries: valid.length,
      awards: awardCount,
      contests: contestSet.size,
      levelAwards
    },
    ranking: rankAll.slice(0, 30),
    rankingTotal: rankAll.length,
    myRank,
    hot,
    my,
    updatedAt: new Date().toISOString()
  };
}

/** 我的战绩：关注 / 参赛 / 获奖明细 */
async function buildMine(db, openid, compMap) {
  const empty = {
    followed: 0,
    joined: 0,
    awards: 0,
    levelAwards: { A: 0, B: 0, C: 0, D: 0 },
    awardsList: [],
    joinedList: []
  };

  if (!openid) return empty;

  let mine = [];
  try {
    const res = await db.collection('my_contests').where({ openid }).limit(100).get();
    mine = res.data || [];
  } catch (e) {
    return empty;
  }

  const out = {
    followed: 0,
    joined: 0,
    awards: 0,
    levelAwards: { A: 0, B: 0, C: 0, D: 0 },
    awardsList: [],
    joinedList: []
  };

  mine.forEach((r) => {
    if (r.status === 'watch' || r.status === 'following') out.followed += 1;

    const comp = compMap[r.competitionId];
    if (!r.joined || !comp) return;

    out.joined += 1;
    const award = AWARD_TEXT[r.award] ? r.award : '';
    const row = {
      competitionId: r.competitionId,
      name: comp.name || '',
      level: comp.level || '',
      award,
      awardText: award ? AWARD_TEXT[award] : '',
      contestDate: comp.contestDate || ''
    };

    out.joinedList.push(row);
    if (award) {
      out.awards += 1;
      out.awardsList.push(row);
      if (out.levelAwards[comp.level] !== undefined) out.levelAwards[comp.level] += 1;
    }
  });

  return out;
}

module.exports = {
  buildStats,
  fetchAll,
  AWARD_TEXT,
  AWARD_KEYS,
  AWARD_SCORE,
  LEVEL_FACTOR
};
