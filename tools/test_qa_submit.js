/**
 * 学习问答 · 前端提交流程回归测试（无需微信开发者工具 / 云环境）
 *
 * 覆盖修复的四类问题：
 *   1. 字数不足时点击静默无反应 → 应给出明确 toast
 *   2. 键盘弹起遮住发布按钮 → 应有 sheetPad 把操作条顶上去，提交前收键盘
 *   3. 本地认证缓存与云端不一致（403）→ 自动刷新登录态并重试一次
 *   4. 后端未返回 id / 返回业务错误 → 不跳 id=undefined，且显示真实原因
 *
 * 运行：node tools/test_qa_submit.js
 */
const Module = require('module');
const assert = require('assert');

/* ---------------- 测试替身 ---------------- */

let checks = 0;
let failures = 0;
function check(name, cond, extra) {
  checks++;
  if (cond) {
    console.log('  ✓ ' + name);
  } else {
    failures++;
    console.log('  ✗ ' + name + (extra ? ' | ' + extra : ''));
  }
}

function makeHarness() {
  const state = {
    toasts: [],
    navs: [],
    hideKeyboard: 0,
    askCalls: [],
    answerCalls: [],
    refresh: 0,
    askImpl: async () => ({ id: 'Q1' }),
    answerImpl: async () => ({})
  };

  const wx = {
    showToast: (o) => state.toasts.push(o.title),
    hideKeyboard: () => state.hideKeyboard++,
    navigateTo: (o) => state.navs.push(o.url),
    showLoading() {},
    hideLoading() {},
    getStorageSync: () => null,
    setStorageSync() {},
    stopPullDownRefresh() {},
    showModal: (o) => o && o.success && o.success({ confirm: false }),
    cloud: { callFunction: async () => ({ result: { code: 0, data: {} } }) }
  };

  const pages = {};
  global.wx = wx;
  global.getApp = () => ({ globalData: {} });
  global.Page = (o) => {
    const name = o.__testName || 'default';
    pages[name] = o;
  };

  const orig = Module._load;
  Module._load = function (req, parent, isMain) {
    if (req.endsWith('services/index')) {
      return {
        qa: {
          ask: (d) => {
            state.askCalls.push(d);
            return state.askImpl(d);
          },
          answer: (d) => {
            state.answerCalls.push(d);
            return state.answerImpl(d);
          },
          list: async () => ({ list: [], total: 0 }),
          stats: async () => ({ open: 0, solved: 0, mine: 0, total: 0 }),
          detail: async () => ({ question: {}, answers: [], total: 0 })
        }
      };
    }
    if (req.endsWith('utils/request')) {
      return { refreshLogin: async () => { state.refresh++; return {}; } };
    }
    if (req.endsWith('utils/auth')) {
      return { isVerified: () => true, isTeacher: () => false };
    }
    if (req.endsWith('utils/util')) {
      return { fromNow: () => '刚刚', confirm: async () => false };
    }
    return orig.apply(this, arguments);
  };

  state.load = function (pagePath) {
    const abs = require.resolve(pagePath);
    delete require.cache[abs];
    delete pages.default;
    require(abs);
    const obj = pages.default;
    const p = Object.assign({}, obj);
    p.data = JSON.parse(JSON.stringify(obj.data));
    p.setData = function (patch, cb) {
      Object.keys(patch).forEach((k) => (p.data[k] = patch[k]));
      if (cb) cb();
    };
    return p;
  };
  state.restore = () => (Module._load = orig);
  return state;
}

/* ---------------- 提问页 ---------------- */

async function testAskPage() {
  console.log('\n=== 提问页 qa.js ===');
  const s = makeHarness();

  const p = s.load('../miniprogram/pages/learn/qa.js');
  check('初始按钮不可用且有提示', p.data.canAsk === false && p.data.askHint === '请填写问题标题');

  p.openAsk();
  check('打开弹层后状态干净', p.data.showAsk === true && p.data.sheetPad === '');

  p.onKeyboardHeightChange({ detail: { height: 300 } });
  check('键盘弹起时生成操作条位移', p.data.keyboardUp === true && /padding-bottom:316px/.test(p.data.sheetPad));
  p.onKeyboardHeightChange({ detail: { height: 0 } });
  check('键盘收起后位移归零', p.data.keyboardUp === false && p.data.sheetPad === '');

  p.onAskTitle({ detail: { value: 'DP' } });
  check('标题不足 4 字给出差额提示', p.data.canAsk === false && /还差 2 字/.test(p.data.askHint));

  p.onAskTitle({ detail: { value: 'DP 状态怎么定义' } });
  p.onAskContent({ detail: { value: '不太懂' } });
  check('描述不足 10 字给出差额提示', p.data.canAsk === false && /描述还差/.test(p.data.askHint));

  // 场景 1：字数不足点提交，必须明确提示，且不得发起请求
  s.toasts.length = 0;
  await p.submitAsk();
  check('字数不足点击有 toast（不再静默 return）', s.toasts.length === 1 && /描述还差/.test(s.toasts[0]), JSON.stringify(s.toasts));
  check('字数不足不调用后端', s.askCalls.length === 0 && p.data.asking === false);

  p.onAskContent({ detail: { value: '我不明白状态为什么要这样定义，试过一维数组但转移方程写不出来。' } });
  check('内容达标后按钮可用', p.data.canAsk === true && p.data.askHint === '');

  // 场景 2：正常成功
  s.toasts.length = 0;
  s.navs.length = 0;
  s.hideKeyboard = 0;
  s.askImpl = async () => ({ id: 'Q-001' });
  await p.submitAsk();
  check('提交前主动收键盘', s.hideKeyboard === 1);
  check('提交成功提示', s.toasts.includes('发布成功'));
  check('提交成功跳转到详情且带正确 id', s.navs.length === 1 && s.navs[0] === '/pages/learn/qaDetail?id=Q-001');
  check('提交后弹层关闭且状态复位', p.data.showAsk === false && p.data.asking === false && p.data.canAsk === false);
  const payload = s.askCalls[s.askCalls.length - 1];
  check('提交参数已 trim 且分类正确', payload.title === 'DP 状态怎么定义' && payload.category === 'algorithm' && payload.content.length > 10);

  // 场景 3：后端没返回 id —— 不能跳 id=undefined
  p.openAsk();
  p.onAskTitle({ detail: { value: '另一个问题标题' } });
  p.onAskContent({ detail: { value: '这是一段足够长的详细描述内容，用来测试后端没有返回主键的情况。' } });
  s.navs.length = 0;
  s.askImpl = async () => ({});
  await p.submitAsk();
  check('后端无 id 时不跳 id=undefined', s.navs.length === 0, JSON.stringify(s.navs));

  // 场景 4：403 认证缓存不一致 → 自动刷新并重试一次
  p.openAsk();
  p.onAskTitle({ detail: { value: '认证状态不一致' } });
  p.onAskContent({ detail: { value: '这段描述足够长，用来触发一次 403 然后自动刷新登录态重试。' } });
  s.refresh = 0;
  let n403 = 0;
  s.askImpl = async () => {
    n403++;
    if (n403 === 1) {
      const e = new Error('请先完成实名认证');
      e.code = 403;
      throw e;
    }
    return { id: 'Q-403' };
  };
  s.toasts.length = 0;
  await p.submitAsk();
  check('403 自动刷新登录态一次', s.refresh === 1);
  check('403 重试后发布成功', s.toasts.includes('发布成功') && p.data.asking === false);
  check('403 场景共调用后端两次', n403 === 2);

  // 场景 5：403 重试仍失败 → 显示真实原因、复位按钮
  p.openAsk();
  p.onAskTitle({ detail: { value: '重试仍然失败' } });
  p.onAskContent({ detail: { value: '这段描述足够长，用来验证 403 之后重试仍然失败时的错误提示是否可见。' } });
  s.askImpl = async () => {
    const e = new Error('请先完成实名认证');
    e.code = 403;
    throw e;
  };
  s.toasts.length = 0;
  await p.submitAsk();
  check('重试失败显示后端真实原因', s.toasts.some((t) => /实名认证/.test(t)), JSON.stringify(s.toasts));
  check('失败后 asking 复位可再次提交', p.data.asking === false && p.data.showAsk === true);

  // 场景 6：其他业务错误（例如云函数未部署返回「未知接口」）
  p.openAsk();
  p.onAskTitle({ detail: { value: '云函数没部署' } });
  p.onAskContent({ detail: { value: '这段描述足够长，用来验证后端返回未知接口时前端是否把原因显示出来。' } });
  s.askImpl = async () => {
    const e = new Error('未知接口: qaAsk');
    e.code = 404;
    throw e;
  };
  s.toasts.length = 0;
  const refreshBefore = s.refresh;
  await p.submitAsk();
  check('非 403 错误不盲目重试', s.refresh === refreshBefore, `refresh ${refreshBefore} -> ${s.refresh}`);
  check('非 403 错误显示具体原因', s.toasts.some((t) => /未知接口/.test(t)), JSON.stringify(s.toasts));

  s.restore();
}

/* ---------------- 回答页 ---------------- */

async function testDetailPage() {
  console.log('\n=== 回答页 qaDetail.js ===');
  const s = makeHarness();
  const p = s.load('../miniprogram/pages/learn/qaDetail.js');
  p.data.id = 'Q-001';

  p.onKeyboardHeightChange({ detail: { height: 280 } });
  check('回答弹层键盘弹起生成位移', /padding-bottom:296px/.test(p.data.sheetPad));

  p.openReply();
  s.toasts.length = 0;
  await p.sendReply();
  check('空回答点击有明确提示', s.toasts.length === 1 && s.answerCalls.length === 0);

  p.onDraftInput({ detail: { value: '   ' } });
  check('纯空格不算有效输入', p.data.canSend === false);
  p.onDraftInput({ detail: { value: '  用哈希表把查找降到 O(1)  ' } });
  check('有效回答按钮可用', p.data.canSend === true && p.data.replyHint === '');

  s.hideKeyboard = 0;
  s.answerImpl = async () => ({});
  await p.sendReply();
  check('回答提交前收键盘', s.hideKeyboard === 1);
  check('回答成功提示且弹层关闭', s.toasts.includes('已回答') && p.data.showReply === false);
  check('回答内容已 trim', s.answerCalls[0].content === '用哈希表把查找降到 O(1)');

  // 403 自动重试
  p.openReply();
  p.onDraftInput({ detail: { value: '这是另一条足够长的回答内容' } });
  let n = 0;
  s.answerImpl = async () => {
    n++;
    if (n === 1) {
      const e = new Error('请先完成实名认证');
      e.code = 403;
      throw e;
    }
    return {};
  };
  s.refresh = 0;
  s.toasts.length = 0;
  await p.sendReply();
  check('回答 403 自动刷新并重试成功', s.refresh === 1 && s.toasts.includes('已回答'));

  s.restore();
}

(async () => {
  await testAskPage();
  await testDetailPage();
  console.log(`\n=== 结果：${checks - failures} 通过 / ${failures} 失败 ===`);
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error('测试异常:', e);
  process.exit(1);
});
