#!/usr/bin/env node
/**
 * UI 截图验收工具：对关键页面截图，供键盘遮挡/角色区分走查
 *
 * 依赖 miniprogram-automator（已装于受管 node 工作区，通过 NODE_PATH 引入）
 * 用法：
 *   NODE_PATH=<受管工作区>/node_modules node tools/shoot_ui.js
 */
const path = require('path');
const fs = require('fs');
const automator = require('miniprogram-automator');

const PROJECT = path.resolve(__dirname, '..');
const CLI = 'E:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat';
const OUT = path.join(__dirname, 'shots');

const PAGES = [
  ['index', '/pages/index/index'],
  ['announce-list', '/pkgWork/announce/list'],
  ['announce-detail', '/pkgWork/announce/detail?id=demo'],
  ['community', '/pages/community/community'],
  ['community-detail', '/pages/community/detail?id=demo'],
  ['log-edit', '/pkgWork/log/edit'],
  ['announce-publish', '/pkgWork/announce/publish'],
  ['task-publish', '/pkgWork/task/publish'],
  ['contest-edit', '/pkgContest/edit/edit'],
  ['contest', '/pages/contest/contest'],
  ['learn', '/pages/learn/learn'],
  ['mine', '/pages/mine/mine']
];

async function main() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  let mp;
  if (process.env.AUTO_WS) {
    // 连接模式：IDE 已由 cli.bat auto --auto-port 打开
    mp = await automator.connect({ wsEndpoint: process.env.AUTO_WS });
    console.log('CONNECTED', process.env.AUTO_WS);
  } else {
    mp = await automator.launch({
      projectPath: PROJECT,
      cliPath: CLI,
      port: 9420,
      timeout: 180000
    });
    console.log('LAUNCHED');
  }
  for (const [name, url] of PAGES) {
    try {
      await mp.reLaunch(url);
      await new Promise((r) => setTimeout(r, 2000));
      const file = path.join(OUT, name + '.png');
      await mp.screenshot({ path: file });
      console.log('SHOT', file);
    } catch (e) {
      console.log('SKIP', name, e.message);
    }
  }
  await mp.reLaunch('/pages/index/index').catch(() => {});
  await mp.disconnect();
  console.log('DONE');
}

main().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
