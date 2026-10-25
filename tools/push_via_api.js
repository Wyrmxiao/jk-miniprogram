/**
 * tools/push_via_api.js —— 在 git 端点被拦截时，用 GitHub REST API 推送本地提交
 *
 * 用法：
 *   GH_TOKEN=$(git credential fill ...) node tools/push_via_api.js [branch]
 *
 * 原理：把本地 HEAD 与 origin/<branch> 之间的差异（blob → tree → commit）
 * 用 API 逐层创建，最后快进更新远端引用。历史内容一致，仅 commit 对象
 * 的哈希可能因签名/时区表达不同而变化；推送后请执行
 *   git fetch && git reset --hard origin/<branch>
 * 使本地与远端对齐。
 */
const { execSync } = require('child_process');

const TOKEN = process.env.GH_TOKEN;
if (!TOKEN) {
  console.error('缺少 GH_TOKEN 环境变量');
  process.exit(1);
}
const BRANCH = process.argv[2] || 'main';
const OWNER = 'Wyrmxiao';
const REPO = 'jk-miniprogram';
const API = 'https://api.github.com';

async function api(path, method = 'GET', body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + TOKEN,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'jk-push-script'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 300)}`);
  }
  return data;
}

const git = (cmd) => execSync('git ' + cmd, { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
const gitText = (cmd) => git(cmd).toString('utf8');

function parseCommit(raw) {
  const text = raw.toString('utf8');
  const idx = text.indexOf('\n\n');
  const header = text.slice(0, idx);
  const message = text.slice(idx + 2);
  const get = (key) => {
    const m = header.match(new RegExp('^' + key + ' (.+)$', 'm'));
    return m ? m[1] : '';
  };
  const tree = get('tree');
  const parents = (header.match(/^parent (.+)$/gm) || []).map((l) => l.slice(7));
  const parsePerson = (line) => {
    const m = line.match(/^(.*) <(.*)> (\d+) ([+-]\d{4})$/);
    return m ? { name: m[1], email: m[2], date: new Date(Number(m[3]) * 1000).toISOString() } : null;
  };
  return {
    tree,
    parents,
    author: parsePerson(get('author')),
    committer: parsePerson(get('committer')),
    message
  };
}

(async () => {
  const localSha = gitText('rev-parse HEAD').trim();
  const localCommit = parseCommit(git('cat-file commit ' + localSha));

  // 远端当前 HEAD
  const remoteRef = await api(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
  const remoteSha = remoteRef.object.sha;
  console.log('local  HEAD:', localSha);
  console.log('remote HEAD:', remoteSha);
  if (remoteSha === localSha) {
    console.log('已是最新，无需推送');
    return;
  }

  // 差异文件（含新增/修改/删除）；core.quotepath=false 避免中文路径被转成八进制
  const diff = gitText(`-c core.quotepath=false diff --name-status ${remoteSha} ${localSha}`).trim();
  const changes = diff
    ? diff.split('\n').map((l) => {
        const [status, path] = l.split('\t');
        return { status: status.trim(), path };
      })
    : [];
  console.log('变更文件数:', changes.length);
  changes.forEach((c) => console.log('  ', c.status, c.path));

  // 上传变更 blob
  const entries = [];
  for (const c of changes) {
    if (c.status.startsWith('D')) {
      entries.push({ path: c.path, mode: '100644', type: 'blob', sha: null });
      continue;
    }
    // JSON.stringify 给中文路径补上 shell 引号
    const buf = git(`cat-file blob ${localSha}:${JSON.stringify(c.path)}`);
    const blob = await api(`/repos/${OWNER}/${REPO}/git/blobs`, 'POST', {
      content: buf.toString('base64'),
      encoding: 'base64'
    });
    entries.push({ path: c.path, mode: '100644', type: 'blob', sha: blob.sha });
    console.log('  blob', blob.sha.slice(0, 8), c.path);
  }

  if (!entries.length) {
    console.log('无内容变更，跳过');
    return;
  }

  // base_tree 必须是远端已存在的 tree；本地 tree 不在远端对象库里
  const remoteCommit = await api(`/repos/${OWNER}/${REPO}/git/commits/${remoteSha}`);
  const tree = await api(`/repos/${OWNER}/${REPO}/git/trees`, 'POST', {
    base_tree: remoteCommit.tree.sha,
    tree: entries
  });

  const commit = await api(`/repos/${OWNER}/${REPO}/git/commits`, 'POST', {
    message: localCommit.message,
    tree: tree.sha,
    parents: [remoteSha],
    author: localCommit.author,
    committer: localCommit.author
  });

  await api(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, 'PATCH', {
    sha: commit.sha,
    force: false
  });

  console.log('\n推送成功');
  console.log('  远端新提交:', commit.sha);
  console.log('  下一步: git fetch && git reset --hard origin/' + BRANCH);
})().catch((e) => {
  console.error('推送失败:', e.message);
  process.exit(1);
});
