#!/usr/bin/env node
/**
 * 远程驱动工具：通过微信开发者工具自动化端口操作云函数
 *
 * 安装依赖（仅开发机需要）：
 *   npm i -D miniprogram-automator
 *
 * 前置：开发者工具已登录，且已开启自动化端口
 *   cli.bat auto --project <项目路径> --auto-port 9420
 *
 * 用法：
 *   node tools/remote.js init            # 系统初始化（幂等）
 *   node tools/remote.js init force      # 覆盖重导竞赛库
 *   node tools/remote.js verify          # 全接口自检
 *   node tools/remote.js smoke           # 公告发布链路冒烟测试
 *   node tools/remote.js call <域> <action> [json参数]
 *
 * 环境变量：
 *   CSIC_ENV       云环境 ID，默认 cloud1-d5gr2v7tz34fafa7c
 *   AUTO_WS        自动化端口地址，默认 ws://127.0.0.1:9420
 */
const path = require('path');
const automator = require('miniprogram-automator');

const PROJECT = path.resolve(__dirname, '..');
const ENV_ID = process.env.CSIC_ENV || 'cloud1-d5gr2v7tz34fafa7c';
const WS = process.env.AUTO_WS || 'ws://127.0.0.1:9420';

/** 在小程序 AppService 上下文调用云函数 */
function callFn(mp, name, action, params = {}) {
  return mp.evaluate(
    (env, fnName, act, p) => {
      return new Promise((resolve) => {
        try {
          wx.cloud.init({ env, traceUser: true });
        } catch (e) {
          /* 已初始化时忽略 */
        }
        wx.cloud
          .callFunction({ name: fnName, data: { action: act, params: p } })
          .then((r) => resolve(r && r.result ? r.result : r))
          .catch((e) => resolve({ code: -1, msg: String((e && e.message) || e) }));
      });
    },
    ENV_ID,
    name,
    action,
    Object.assign({ __debug: true }, params)
  );
}

async function connect() {
  const mp = await automator.connect({ wsEndpoint: WS });
  await mp.reLaunch('/pages/index/index').catch(() => {});
  await new Promise((r) => setTimeout(r, 2000));
  return mp;
}

// ============ 子命令 ============

async function cmdInit(argv) {
  const force = argv.includes('force');
  const mp = await connect();

  const bootstrap = await callFn(mp, 'auth', 'bootstrap', {});
  console.log('[1/3] 系统初始化:', JSON.stringify(bootstrap));

  const seed = await callFn(
    mp,
    'contest',
    'importSeed',
    force ? { force: true } : {}
  );
  console.log('[2/3] 竞赛库导入:', JSON.stringify(seed));

  const status = await callFn(mp, 'auth', 'bootstrap', { viewOnly: true });
  console.log('[3/3] 最终状态:', JSON.stringify(status));

  await mp.disconnect();
}

async function cmdVerify() {
  const CASES = [
    ['contest', 'categories', {}, '竞赛筛选项'],
    ['contest', 'list', { level: 'A', page: 1, size: 3 }, 'A类竞赛列表'],
    ['learn', 'templates', {}, '学习路线模板'],
    ['announce', 'list', { page: 1, size: 5 }, '公告列表'],
    ['project', 'list', { page: 1, size: 5 }, '项目广场'],
    ['user', 'profile', {}, '当前用户资料'],
    ['user', 'list', { page: 1, size: 5 }, '用户列表'],
    ['auth', 'login', {}, '登录态']
  ];

  const mp = await connect();
  let pass = 0;
  let fail = 0;
  for (const [domain, action, params, label] of CASES) {
    const res = await callFn(mp, domain, action, params);
    const ok = res && res.code === 0;
    ok ? pass++ : fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${domain}.${action} (${label}) ${JSON.stringify(res).slice(0, 150)}`);
  }
  console.log(`SUMMARY pass=${pass} fail=${fail}`);
  await mp.disconnect();
}

async function cmdSmoke() {
  const mp = await connect();

  const cat = await callFn(mp, 'contest', 'list', { level: 'A', page: 1, size: 1 });
  const comp = cat.data && cat.data.list && cat.data.list[0];

  const notice = await callFn(mp, 'announce', 'publish', {
    type: 'notice',
    title: '【冒烟测试】通知',
    content: '自动化测试生成，验证后自动删除。',
    top: false,
    push: false
  });
  console.log('发布通知:', JSON.stringify(notice));

  const contestAnno = await callFn(mp, 'announce', 'publish', {
    type: 'contest',
    title: '【冒烟测试】赛事公告',
    content: '自动化测试生成，验证后自动删除。',
    competitionId: comp ? comp._id : '',
    top: true,
    push: false
  });
  console.log('发布赛事公告:', JSON.stringify(contestAnno));

  const list = await callFn(mp, 'announce', 'list', { page: 1, size: 10 });
  console.log('公告总数:', list.data && list.data.total);

  for (const id of [notice.data && notice.data.id, contestAnno.data && contestAnno.data.id]) {
    if (id) console.log('删除:', JSON.stringify(await callFn(mp, 'announce', 'remove', { id })));
  }

  const after = await callFn(mp, 'announce', 'list', { page: 1, size: 10 });
  console.log('清理后公告数:', after.data && after.data.total);
  await mp.disconnect();
}

async function cmdCall(argv) {
  const [domain, action, json] = argv;
  if (!domain || !action) {
    console.log('用法: node tools/remote.js call <域> <action> [json参数]');
    return;
  }
  let params = {};
  if (json) {
    try {
      params = JSON.parse(json);
    } catch (e) {
      console.log('参数 JSON 解析失败，按空参数处理');
    }
  }
  const mp = await connect();
  console.log(JSON.stringify(await callFn(mp, domain, action, params), null, 2));
  await mp.disconnect();
}

(async () => {
  const [cmd, ...argv] = process.argv.slice(2);
  switch (cmd) {
    case 'init':
      await cmdInit(argv);
      break;
    case 'verify':
      await cmdVerify();
      break;
    case 'smoke':
      await cmdSmoke();
      break;
    case 'call':
      await cmdCall(argv);
      break;
    default:
      console.log('用法: node tools/remote.js init|verify|smoke|call');
  }
})().catch((err) => {
  console.error('ERROR:', err && err.message ? err.message : err);
  process.exit(1);
});
