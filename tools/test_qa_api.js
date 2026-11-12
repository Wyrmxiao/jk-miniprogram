/**
 * 学习问答接口级测试（纯本地，无需云环境 / node_modules）
 *
 * 做法：用 Module._load 拦截 wx-server-sdk，替换成内存数据库，
 * 再直接调用 handlers/qa.js 的方法，验证权限、计数、状态流转。
 *
 * 运行：node tools/test_qa_api.js
 */
const Module = require('module');
const path = require('path');

/* ---------------- 内存数据库 mock ---------------- */
const store = Object.create(null);
let seq = 0;

const cmd = {
  neq: (v) => ({ $ne: v }),
  in: (arr) => ({ $in: arr }),
  inc: (n) => ({ $inc: n }),
  and: (arr) => ({ $and: arr }),
  or: (arr) => ({ $or: arr })
};

function bucket(name) {
  if (!store[name]) store[name] = [];
  return store[name];
}

function clone(d) {
  const o = Object.assign({}, d);
  return o;
}

function matchField(val, cond) {
  if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
    if (cond.$regex) return cond.$regex.test(String(val == null ? '' : val));
    if ('$ne' in cond) return val !== cond.$ne;
    if ('$in' in cond) return cond.$in.indexOf(val) !== -1;
  }
  return val === cond;
}

function match(doc, cond) {
  if (!cond) return true;
  if (cond.$and) return cond.$and.every((c) => match(doc, c));
  if (cond.$or) return cond.$or.some((c) => match(doc, c));
  return Object.keys(cond).every((k) => matchField(doc[k], cond[k]));
}

function applyUpdate(doc, data) {
  Object.keys(data || {}).forEach((k) => {
    const v = data[k];
    if (v && typeof v === 'object' && '$inc' in v) doc[k] = (Number(doc[k]) || 0) + v.$inc;
    else doc[k] = v;
  });
}

function selected(name, st) {
  let rows = bucket(name).filter((d) => match(d, st.cond));
  if (st.order) {
    const [f, dir] = st.order;
    rows.sort((a, b) => {
      const av = a[f] instanceof Date ? a[f].getTime() : a[f];
      const bv = b[f] instanceof Date ? b[f].getTime() : b[f];
      return dir === 'asc' ? (av > bv ? 1 : -1) : av < bv ? 1 : -1;
    });
  }
  return rows;
}

function query(name, cond) {
  const st = { cond, order: null, skip: 0, limit: Infinity };
  const q = {
    where(c) {
      st.cond = c;
      return q;
    },
    orderBy(f, dir) {
      st.order = [f, dir];
      return q;
    },
    skip(n) {
      st.skip = n;
      return q;
    },
    limit(n) {
      st.limit = n;
      return q;
    },
    count: async () => ({ total: bucket(name).filter((d) => match(d, st.cond)).length }),
    get: async () => ({ data: selected(name, st).slice(st.skip, st.skip + st.limit).map(clone) }),
    update: async ({ data }) => {
      const rows = bucket(name).filter((d) => match(d, st.cond));
      rows.forEach((d) => applyUpdate(d, data));
      return { stats: { updated: rows.length } };
    }
  };
  return q;
}

function collection(name) {
  return {
    where: (cond) => query(name, cond),
    add: async ({ data }) => {
      const _id = `mock_${++seq}`;
      bucket(name).push(Object.assign({ _id }, data));
      return { _id };
    },
    doc: (id) => ({
      get: async () => {
        const d = bucket(name).find((x) => x._id === id);
        if (!d) return Promise.reject(new Error('document not exists'));
        return { data: clone(d) };
      },
      update: async ({ data }) => {
        const d = bucket(name).find((x) => x._id === id);
        if (!d) return Promise.reject(new Error('document not exists'));
        applyUpdate(d, data);
        return { stats: { updated: 1 } };
      }
    })
  };
}

const fakeCloud = {
  init() {},
  database: () => ({
    collection,
    createCollection: async (n) => {
      bucket(n);
      return {};
    },
    serverDate: () => new Date(),
    RegExp: ({ regexp, options }) => ({ $regex: new RegExp(regexp, options) }),
    command: cmd
  }),
  getWXContext: () => ({ OPENID: 'mock' }),
  DYNAMIC_CURRENT_ENV: 'mock'
};

const origLoad = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'wx-server-sdk') return fakeCloud;
  return origLoad.apply(this, arguments);
};

const ROOT = path.resolve(__dirname, '..');
const qa = require(path.join(ROOT, 'cloudfunctions/learn/handlers/qa.js'));
const router = require(path.join(ROOT, 'cloudfunctions/learn/router.js'));

/* ---------------- 测试上下文 ---------------- */
function ctx(openid, role, name) {
  return {
    openid,
    role,
    user: { realName: name, role },
    isTeacher: role === 'teacher' || role === 'admin',
    isAdmin: role === 'admin',
    requireLogin() {
      return this;
    },
    requireVerified() {
      return this;
    },
    requireRole() {
      return this;
    }
  };
}

const A = ctx('openid-A', 'student', '张三');
const B = ctx('openid-B', 'student', '李四');
const T = ctx('openid-T', 'teacher', '王老师');

let pass = 0;
let fail = 0;
function check(label, cond, extra) {
  if (cond) {
    pass++;
    console.log('  ✓ ' + label);
  } else {
    fail++;
    console.log('  ✗ ' + label + (extra ? ' → ' + extra : ''));
  }
}
async function expectThrow(label, fn, keyword) {
  try {
    await fn();
    check(label, false, '没有抛错');
  } catch (e) {
    check(label, !keyword || String(e.message).includes(keyword), e.message);
  }
}

/* ---------------- 用例 ---------------- */
(async () => {
  console.log('\n=== 0. 路由注册 ===');
  const actions = [
    'qaList', 'qaStats', 'qaDetail', 'qaAsk', 'qaAnswer',
    'qaAccept', 'qaSetStatus', 'qaRemoveQuestion', 'qaRemoveAnswer'
  ];
  check('9 个接口全部注册到 router', actions.every((a) => typeof router[a] === 'function'));

  console.log('\n=== 1. 提问参数校验 ===');
  await expectThrow('标题为空被拦截', () => qa.qaAsk({ title: '', content: '详细内容足够长' }, A), '标题');
  await expectThrow('描述少于 10 字被拦截', () => qa.qaAsk({ title: '一个问题', content: '太短' }, A), '至少 10 个字');
  await expectThrow('非法分类被拦截', () => qa.qaAsk({ title: '一个问题', content: '这是一段足够长的描述内容', category: 'nope' }, A), '分类');

  const asked = await qa.qaAsk(
    { title: 'DP 状态为什么这样定义', content: '我在做背包问题时不知道为什么状态要这么设，试过贪心但不对。', category: 'algorithm', problemTitle: 'cf:189A' },
    A
  );
  const QID = asked.id;
  check('学生 A 提问成功', !!QID);

  console.log('\n=== 2. 列表与筛选 ===');
  const all = await qa.qaList({ scope: 'all' }, B);
  check('全部列表 1 条', all.total === 1 && all.list.length === 1);
  check('列表不返回正文全文', all.list[0].summary && !all.list[0].content);
  check('列表带 isMine 标记（B 视角为 false）', all.list[0].isMine === false);
  const openList = await qa.qaList({ scope: 'open' }, B);
  check('待解决筛选 1 条', openList.total === 1);
  const solvedList = await qa.qaList({ scope: 'solved' }, B);
  check('已解决筛选 0 条', solvedList.total === 0);
  const mineA = await qa.qaList({ scope: 'mine' }, A);
  const mineB = await qa.qaList({ scope: 'mine' }, B);
  check('我的提问：A=1 / B=0', mineA.total === 1 && mineB.total === 0);
  const kw = await qa.qaList({ keyword: '背包' }, B);
  check('正文关键词可搜到', kw.total === 1);
  const kwCat = await qa.qaList({ keyword: '背包', category: 'course' }, B);
  check('关键词 + 分类组合生效', kwCat.total === 0);
  const answeredEmpty = await qa.qaList({ scope: 'answered' }, B);
  check('未回答过时「我回答过」返回空', answeredEmpty.total === 0);

  console.log('\n=== 3. 详情与回答 ===');
  const d0 = await qa.qaDetail({ id: QID }, B);
  check('详情返回问题', d0.question._id === QID);
  check('详情 0 条回答', d0.answers.length === 0);
  check('浏览量自增到 1', bucket('qa_questions')[0].viewCount === 1);
  check('B 无管理权限', d0.question.canManage === false);

  const ansB = await qa.qaAnswer({ questionId: QID, content: '可以从最后一步倒推状态，先写出转移再压缩维度。' }, B);
  const ansT = await qa.qaAnswer({ questionId: QID, content: '老师补充：先看清楚「选或不选」两个分支，状态就是这两个分支的结果。' }, T);
  const d1 = await qa.qaDetail({ id: QID }, A);
  check('两条回答都在', d1.answers.length === 2);
  check('回答数更新为 2', d1.question.answerCount === 2);
  check('教师回答带 isTeacher', d1.answers.some((a) => a.isTeacher));
  check('提问者可采纳他人回答', d1.answers.every((a) => a.canAccept === true));
  check('A 视角 canManage 为 true', d1.question.canManage === true);
  const answeredB = await qa.qaList({ scope: 'answered' }, B);
  check('「我回答过」反查命中', answeredB.total === 1 && answeredB.list[0]._id === QID);

  console.log('\n=== 4. 采纳与解决状态 ===');
  await expectThrow('同学 B 不能采纳', () => qa.qaAccept({ questionId: QID, answerId: ansB.id }, B), '只有提问者或老师');
  await expectThrow('不属于该问题的回答被拦截', async () => {
    const other = await qa.qaAsk({ title: '另一个问题标题', content: '这是另一个问题的详细描述内容。' }, A);
    await qa.qaAccept({ questionId: other.id, answerId: ansB.id }, A);
  }, '回答不属于该问题');

  const acc = await qa.qaAccept({ questionId: QID, answerId: ansT.id }, A);
  check('提问者采纳教师回答', acc.status === 'solved' && acc.acceptedAnswerId === ansT.id);
  const d2 = await qa.qaDetail({ id: QID }, A);
  check('已采纳答案排第一', d2.answers[0].accepted === true);
  check('另一条回答未被采纳', d2.answers.filter((a) => a.accepted).length === 1);
  check('已解决后不再提供采纳按钮', d2.answers.every((a) => a.canAccept === false));
  check('已解决列表命中', (await qa.qaList({ scope: 'solved' }, B)).total >= 1);

  const extra = await qa.qaAnswer({ questionId: QID, content: '已解决的问题也允许补充一个不同的解法。' }, B);
  check('已解决问题仍可补充回答', !!extra.id);

  console.log('\n=== 5. 重新打开 / 教师标记解决 ===');
  await expectThrow('无关同学不能改状态', () => qa.qaSetStatus({ id: QID, status: 'open' }, B), '没有权限');
  await expectThrow('非法状态被拦截', () => qa.qaSetStatus({ id: QID, status: 'removed' }, A), '状态不合法');
  await qa.qaSetStatus({ id: QID, status: 'open' }, A);
  const d3 = await qa.qaDetail({ id: QID }, A);
  check('重新打开后状态 open', d3.question.status === 'open');
  check('重新打开清空采纳标记', d3.answers.every((a) => !a.accepted) && !d3.question.acceptedAnswerId);
  check('重新打开恢复可采纳', d3.answers.some((a) => a.canAccept === true));
  const teacherSolved = await qa.qaSetStatus({ id: QID, status: 'solved' }, T);
  check('教师可直接标记解决（线下已解答）', teacherSolved.status === 'solved');

  console.log('\n=== 6. 删除与计数 ===');
  await expectThrow('无关同学不能删他人回答', () => qa.qaRemoveAnswer({ id: ansT.id }, ctx('openid-X', 'student', '路人')), '没有权限');
  await qa.qaRemoveAnswer({ id: ansB.id }, B);
  const d4 = await qa.qaDetail({ id: QID }, A);
  check('删除回答后回答数 -1', d4.question.answerCount === 2);
  check('被删回答不再出现', !d4.answers.some((a) => a._id === ansB.id));
  await qa.qaSetStatus({ id: QID, status: 'open' }, A);

  const stats = await qa.qaStats({}, A);
  check('统计：待解决 >=1 / 我的提问 >=1', stats.open >= 1 && stats.mine >= 1, JSON.stringify(stats));

  await expectThrow('无关同学不能删问题', () => qa.qaRemoveQuestion({ id: QID }, B), '没有权限');
  await qa.qaRemoveQuestion({ id: QID }, A);
  check('删除后列表不再出现', (await qa.qaList({ scope: 'all' }, A)).list.every((x) => x._id !== QID));
  await expectThrow('已删除问题详情返回 404', () => qa.qaDetail({ id: QID }, A), '问题不存在');

  console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('测试异常终止：', e);
  process.exit(1);
});
