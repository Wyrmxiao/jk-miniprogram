/* 三方向初稿体检：语法错误、点击切换、截图 */
const { chromium } = require('C:/Users/10906/AppData/Local/npm-cache/_npx/f0a362733743bae2/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const DIR = path.resolve(__dirname);
const OUT = path.join(DIR, 'shots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const FILES = [
  { f: 'dir-a.html', name: 'A', tabProbe: ['学习', '赛事'] },
  { f: 'dir-b.html', name: 'B', tabProbe: ['训练', '赛事'] },
  { f: 'dir-c.html', name: 'C', tabProbe: ['学习', '赛事'] },
];

(async () => {
  const browser = await chromium.launch();
  let fail = 0;

  for (const item of FILES) {
    const page = await browser.newPage({ viewport: { width: 1680, height: 1200 }, deviceScaleFactor: 1.5 });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

    const url = 'file:///' + path.join(DIR, item.f).replace(/\\/g, '/');
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2200);

    const phones = await page.locator('div[style*="border-radius: 46px"], div[style*="border-radius: 50px"], div[style*="border-radius: 48px"]').count();
    const boardText = await page.evaluate(() => document.body.innerText.length);

    // 点击测试：切一次 tab，看画面文字是否变化
    const before = await page.evaluate(() => document.body.innerText.length);
    let clicked = false;
    for (const label of item.tabProbe) {
      const el = page.getByText(label, { exact: true }).last();
      if (await el.count()) {
        try { await el.click({ timeout: 3000 }); clicked = true; await page.waitForTimeout(700); break; } catch (e) {}
      }
    }
    const after = await page.evaluate(() => document.body.innerText.length);

    await page.screenshot({ path: path.join(OUT, `dir-${item.name}-full.png`), fullPage: true });
    await page.setViewportSize({ width: 1680, height: 1240 });
    await page.screenshot({ path: path.join(OUT, `dir-${item.name}-top.png`) });

    const ok = errors.length === 0 && boardText > 500 && clicked;
    if (!ok) fail++;
    console.log(`[${ok ? 'PASS' : 'FAIL'}] ${item.f}  text=${boardText}  phones≈${phones}  click=${clicked}  lenChange=${after - before}`);
    errors.slice(0, 6).forEach(e => console.log('    ' + e));
    await page.close();
  }

  await browser.close();
  console.log(fail === 0 ? '\n全部通过' : `\n${fail} 个文件有问题`);
  process.exit(fail === 0 ? 0 : 1);
})();
