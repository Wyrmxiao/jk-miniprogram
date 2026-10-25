// 一次性全站校验：页面四件套 / WXML 配平 / WXSS @import / JS require / WXML 方法调用 / 页面跳转
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..'); // tools/ 的上一级 = 项目根
const MP = path.join(root, 'miniprogram');

const appJson = JSON.parse(fs.readFileSync(path.join(MP, 'app.json'), 'utf8'));
const pages = []
  .concat(appJson.pages || [])
  .concat((appJson.subPackages || appJson.subpackages || []).flatMap((s) => s.pages.map((p) => s.root + '/' + p)));

const errors = [];
const ok = [];

// 1) 四件套
for (const p of pages) {
  const base = path.join(MP, p);
  for (const ext of ['js', 'wxml', 'wxss', 'json']) {
    if (!fs.existsSync(base + '.' + ext)) errors.push(`[四件套] ${p}.${ext} 不存在`);
  }
}
ok.push(`四件套检查：${pages.length} 个页面`);

// 2) WXML 标签配平 + 3) 方法调用 + 5) 跳转
const VOID = new Set(['input', 'image', 'icon', 'import', 'include', 'template', 'wxs', 'live-player', 'live-pusher', 'ad', 'official-account']);
function walkWxml(dir, cb) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) walkWxml(full, cb);
    else if (f.name.endsWith('.wxml')) cb(full);
  }
}
const wxmlFiles = [];
walkWxml(MP, (f) => wxmlFiles.push(f));

for (const f of wxmlFiles) {
  const rel = path.relative(MP, f).replace(/\\/g, '/');
  const src = fs.readFileSync(f, 'utf8');
  // 去掉注释与 {{ }} 内容，避免标签误判
  const cleaned = src.replace(/<!--[\s\S]*?-->/g, '').replace(/\{\{[\s\S]*?\}\}/g, '');
  const stack = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let m;
  while ((m = re.exec(cleaned))) {
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();
    const attrs = m[3];
    const selfClosed = /\/\s*$/.test(attrs) || VOID.has(name);
    if (closing) {
      if (!stack.length) errors.push(`[WXML] ${rel} 多出闭合 </${name}>`);
      else {
        const top = stack.pop();
        if (top !== name) errors.push(`[WXML] ${rel} 标签不匹配：期望 </${top}>，实际 </${name}>`);
      }
    } else if (!selfClosed) {
      stack.push(name);
    }
  }
  if (stack.length) errors.push(`[WXML] ${rel} 未闭合标签：${stack.join(', ')}`);

  // {{ }} 内方法调用（WXS 除外，这里只查形如 xxx( 的调用）
  const binds = src.match(/\{\{[\s\S]*?\}\}/g) || [];
  for (const b of binds) {
    if (/\b[a-zA-Z_$][\w$]*\s*\(/.test(b) && !/\?\s*:|&&|\|\|/.test(b.slice(0, 5))) {
      // 允许三元/逻辑；仅当像纯方法调用时报
      if (/^\s*[a-zA-Z_$][\w$]*\s*\(/.test(b)) {
        errors.push(`[WXML绑定] ${rel} 可能的方法调用：${b.slice(0, 60)}`);
      }
    }
  }

  // 页面跳转
  const jumpRe = /url\s*=\s*["']([^"']+)["']/g;
  let jm;
  while ((jm = jumpRe.exec(src))) {
    const url = jm[1].split('?')[0];
    if (!url.startsWith('/')) continue;
    const target = url.replace(/^\//, '');
    if (pages.indexOf(target) === -1) errors.push(`[跳转] ${rel} → ${target} 未在 app.json 注册`);
  }
}
ok.push(`WXML 检查：${wxmlFiles.length} 个文件（配平 / 绑定 / 跳转）`);

// 3) WXSS @import
function walkExt(dir, ext, cb) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) walkExt(full, ext, cb);
    else if (f.name.endsWith(ext)) cb(full);
  }
}
walkExt(MP, '.wxss', (f) => {
  const rel = path.relative(MP, f).replace(/\\/g, '/');
  const src = fs.readFileSync(f, 'utf8');
  const re = /@import\s+["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src))) {
    const target = path.resolve(path.dirname(f), m[1]);
    if (!fs.existsSync(target)) errors.push(`[WXSS] ${rel} @import ${m[1]} 不存在`);
  }
});

// 4) JS require 相对路径（先剥离行注释与块注释，避免把示例代码当引用）
walkExt(MP, '.js', (f) => {
  const rel = path.relative(MP, f).replace(/\\/g, '/');
  const src = fs.readFileSync(f, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  const re = /require\(\s*["'](\.[^"']+)["']\s*\)/g;
  let m;
  while ((m = re.exec(src))) {
    const target = path.resolve(path.dirname(f), m[1]);
    if (!fs.existsSync(target) && !fs.existsSync(target + '.js')) {
      errors.push(`[require] ${rel} → ${m[1]} 不存在`);
    }
  }
});
ok.push('WXSS @import / JS require 路径检查完成');

// 5b) JS 内跳转路径（wx.navigateTo/redirectTo/reLaunch/switchTab 的 url）
walkExt(MP, '.js', (f) => {
  const rel = path.relative(MP, f).replace(/\\/g, '/');
  const src = fs.readFileSync(f, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  const re = /url\s*:\s*["'](\/[^"']+)["']/g;
  let m;
  while ((m = re.exec(src))) {
    const target = m[1].split('?')[0].replace(/^\//, '');
    if (pages.indexOf(target) === -1) errors.push(`[跳转] ${rel} → ${target} 未在 app.json 注册`);
  }
});

console.log(ok.map((s) => '✓ ' + s).join('\n'));
if (errors.length) {
  console.log('\n发现 ' + errors.length + ' 处问题：');
  errors.forEach((e) => console.log('  ✗ ' + e));
  process.exit(1);
} else {
  console.log('\n全部通过，未发现问题。');
}
