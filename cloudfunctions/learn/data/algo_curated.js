/**
 * 学生端算法训练精选题库。
 *
 * 只收录同时具备「中文题面 + 逐题思路 + 可运行参考代码」的题目。
 * LeetCode 题面复用 algo_content.json，这里仅维护白名单与补充题解；
 * 牛客 HJ 题为校内练习版题面，官方入口统一指向牛客华为机试题单。
 */

const NOWCODER_URL = 'https://www.nowcoder.com/exam/oj/ta?tpId=37';

const leetcodeIds = [
  'lc:range-sum-query-immutable',
  'lc:find-pivot-index',
  'lc:minimum-size-subarray-sum',
  'lc:subarray-sum-equals-k',
  'lc:corporate-flight-bookings',
  'lc:split-array-largest-sum',
  'lc:merge-two-sorted-lists',
  'lc:reverse-linked-list',
  'lc:maximum-subarray',
  'lc:binary-tree-inorder-traversal',
  'lc:maximum-depth-of-binary-tree',
  'lc:search-a-2d-matrix-ii'
];

const problems = [
  ['HJ1', '字符串最后一个单词的长度', 'entry', ['string', 'simulation']],
  ['HJ3', '明明的随机数', 'entry', ['ds', 'sort']],
  ['HJ5', '进制转换', 'entry', ['string', 'math']],
  ['HJ6', '质数因子', 'basic', ['math']],
  ['HJ8', '合并表记录', 'entry', ['ds', 'sort']],
  ['HJ14', '字符串排序', 'entry', ['string', 'sort']],
  ['HJ17', '坐标移动', 'basic', ['string', 'simulation']],
  ['HJ20', '密码验证合格程序', 'basic', ['string', 'simulation']],
  ['HJ24', '合唱队', 'improve', ['dp']],
  ['HJ26', '字符串排序规则', 'basic', ['string', 'sort']],
  ['HJ32', '密码截取', 'basic', ['string', 'dp', 'twopointer']],
  ['HJ43', '迷宫问题', 'basic', ['graph', 'search']],
  ['HJ48', '从单向链表中删除指定值', 'basic', ['ds', 'simulation']],
  ['HJ50', '四则运算', 'improve', ['string', 'recursion']]
].map(([pid, title, band, tags], order) => ({
  id: `nc:${pid}`,
  pid,
  pidDisplay: pid,
  title,
  titleCn: title,
  source: 'nowcoder',
  url: NOWCODER_URL,
  rating: 0,
  band,
  tags,
  solved: 100000 - order
}));

const content = {
  'nc:HJ1': {
    title: '字符串最后一个单词的长度', source: 'nowcoder', pid: 'HJ1', band: 'entry', tags: ['string', 'simulation'],
    statementHtml: '<p>输入一行由单词和空格组成的字符串，输出最后一个单词的长度。字符串非空，单词之间用空格分隔。</p><p><strong>示例</strong></p><p>输入：<code>hello nowcoder</code><br/>输出：<code>8</code></p>',
    meta: { difficulty: '简单' },
    knowledgeRefs: [{ key: 'string', name: '字符串', why: '从行尾定位最后一个空格即可得到最后一个单词。' }],
    solution: {
      type: 'editorial', insight: '整行读取后，从最后一个非空字符开始向左计数，直到遇到空格。',
      steps: ['使用 getline 读取整行，避免空格导致输入被截断。', '跳过行尾可能存在的空格。', '从右向左扫描，统计连续非空格字符的数量。'],
      code: '#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    string s; getline(cin, s);\n    int i = (int)s.size() - 1, ans = 0;\n    while (i >= 0 && s[i] == \' \') --i;\n    while (i >= 0 && s[i] != \' \') { ++ans; --i; }\n    cout << ans << \'\\n\';\n    return 0;\n}',
      codeNotes: ['getline 保留整行中的空格。', '两段 while 分别处理尾部空格和最后一个单词。'],
      complexity: '时间 O(n)，空间 O(n)。', trap: '直接使用 cin >> s 只能读到第一个单词。'
    }
  },
  'nc:HJ3': {
    title: '明明的随机数', source: 'nowcoder', pid: 'HJ3', band: 'entry', tags: ['ds', 'sort'],
    statementHtml: '<p>输入 n 个整数，请删除重复数字，再按从小到大的顺序输出。</p><p><strong>输入</strong>：第一行 n，后续 n 行每行一个整数。<br/><strong>输出</strong>：去重排序后的数字，每行一个。</p>',
    meta: { difficulty: '简单' },
    knowledgeRefs: [{ key: 'ds', name: '数据结构', why: '有序集合可以同时完成去重与排序。' }, { key: 'sort', name: '排序', why: '结果要求严格升序输出。' }],
    solution: {
      type: 'editorial', insight: '把所有数字插入 set，集合天然去重且保持升序。',
      steps: ['读取 n。', '依次把数字插入 set<int>。', '遍历集合并输出。'],
      code: '#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    int n, x; cin >> n;\n    set<int> values;\n    while (n-- && cin >> x) values.insert(x);\n    for (int v : values) cout << v << \'\\n\';\n    return 0;\n}',
      codeNotes: ['set 的键唯一，重复插入不会增加元素。', 'set 迭代顺序就是升序。'],
      complexity: '时间 O(n log n)，空间 O(n)。', trap: '只排序不去重，或只用 unordered_set 导致输出无序。'
    }
  },
  'nc:HJ5': {
    title: '进制转换', source: 'nowcoder', pid: 'HJ5', band: 'entry', tags: ['string', 'math'],
    statementHtml: '<p>输入一个以 <code>0x</code> 开头的十六进制字符串，输出对应的十进制整数。十六进制字母不区分大小写。</p><p>示例：输入 <code>0xAA</code>，输出 <code>170</code>。</p>',
    meta: { difficulty: '简单' },
    knowledgeRefs: [{ key: 'math', name: '数学', why: '本质是按位展开的 16 进制转 10 进制。' }],
    solution: {
      type: 'editorial', insight: '从 0x 后开始扫描，答案不断执行 ans = ans * 16 + 当前位。',
      steps: ['跳过前缀 0x。', '把字符映射为 0 到 15。', '按高位到低位累加。'],
      code: '#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    string s; cin >> s;\n    long long ans = 0;\n    for (int i = 2; i < (int)s.size(); ++i) {\n        char c = toupper(s[i]);\n        int v = isdigit(c) ? c - \'0\' : c - \'A\' + 10;\n        ans = ans * 16 + v;\n    }\n    cout << ans << \'\\n\';\n    return 0;\n}',
      codeNotes: ['toupper 统一处理大小写字母。', '每读一位，原答案整体左移一个十六进制位。'],
      complexity: '时间 O(n)，空间 O(1)。', trap: '字母 A 对应 10，不是 1；还要跳过 0x 前缀。'
    }
  },
  'nc:HJ6': {
    title: '质数因子', source: 'nowcoder', pid: 'HJ6', band: 'basic', tags: ['math'],
    statementHtml: '<p>输入一个大于 1 的正整数，按从小到大的顺序输出它的全部质因子；相同质因子需要重复输出。</p><p>示例：<code>180 = 2 × 2 × 3 × 3 × 5</code>。</p>',
    meta: { difficulty: '中等' },
    knowledgeRefs: [{ key: 'math', name: '数学', why: '使用试除法分解质因数。' }],
    solution: {
      type: 'editorial', insight: '从最小因子 2 开始反复试除；循环结束后若 n>1，它本身就是最后一个质因子。',
      steps: ['枚举 p 从 2 到 sqrt(n)。', '只要 n 能被 p 整除，就输出 p 并令 n/=p。', '最后输出剩余的大于 1 的 n。'],
      code: '#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    long long n; cin >> n;\n    for (long long p = 2; p * p <= n; ++p) {\n        while (n % p == 0) { cout << p << \' \'; n /= p; }\n    }\n    if (n > 1) cout << n;\n    cout << \'\\n\';\n    return 0;\n}',
      codeNotes: ['p*p<=n 会随 n 缩小，减少枚举次数。', 'while 保留重复质因子。'],
      complexity: '时间 O(√n)，空间 O(1)。', trap: '使用 if 只能除一次，会丢失重复因子。'
    }
  },
  'nc:HJ8': {
    title: '合并表记录', source: 'nowcoder', pid: 'HJ8', band: 'entry', tags: ['ds', 'sort'],
    statementHtml: '<p>输入若干组“索引 值”。相同索引的值需要累加，最后按索引从小到大输出合并结果。</p>',
    meta: { difficulty: '简单' },
    knowledgeRefs: [{ key: 'ds', name: '数据结构', why: '映射表负责按索引聚合。' }, { key: 'sort', name: '排序', why: '有序 map 可直接按索引升序遍历。' }],
    solution: {
      type: 'editorial', insight: '使用 map<int,int>，读到一条记录就执行 sum[index] += value。',
      steps: ['创建有序映射。', '逐条累加相同索引。', '遍历 map 输出键和值。'],
      code: '#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    int n; cin >> n;\n    map<int, long long> sum;\n    while (n--) { int k, v; cin >> k >> v; sum[k] += v; }\n    for (auto [k, v] : sum) cout << k << \' \' << v << \'\\n\';\n    return 0;\n}',
      codeNotes: ['map 的下标访问会自动创建初值 0。', '遍历顺序按 key 递增。'],
      complexity: '时间 O(n log n)，空间 O(n)。', trap: '使用普通数组前要确认索引范围；unordered_map 还需要额外排序。'
    }
  },
  'nc:HJ14': {
    title: '字符串排序', source: 'nowcoder', pid: 'HJ14', band: 'entry', tags: ['string', 'sort'],
    statementHtml: '<p>输入 n 个字符串，按字典序从小到大输出，每个字符串一行。</p>',
    meta: { difficulty: '简单' },
    knowledgeRefs: [{ key: 'sort', name: '排序', why: '标准字符串比较就是字典序。' }],
    solution: {
      type: 'editorial', insight: '把字符串放入 vector，使用默认 sort 即可。',
      steps: ['读取全部字符串。', '调用 sort。', '逐行输出。'],
      code: '#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    int n; cin >> n;\n    vector<string> a(n);\n    for (string &s : a) cin >> s;\n    sort(a.begin(), a.end());\n    for (const string &s : a) cout << s << \'\\n\';\n    return 0;\n}',
      codeNotes: ['string 的 operator< 已实现字典序比较。'],
      complexity: '时间 O(n log n · L)，空间 O(nL)，L 为平均字符串长度。', trap: '不要按字符串长度排序。'
    }
  },
  'nc:HJ17': {
    title: '坐标移动', source: 'nowcoder', pid: 'HJ17', band: 'basic', tags: ['string', 'simulation'],
    statementHtml: '<p>初始坐标为 (0,0)。输入由分号分隔的指令：A 左移、D 右移、W 上移、S 下移，后接 1~99 的距离。非法指令忽略，输出最终坐标。</p><p>示例：<code>A10;S20;W10;D30;X;</code> 输出 <code>20,-10</code>。</p>',
    meta: { difficulty: '中等' },
    knowledgeRefs: [{ key: 'simulation', name: '模拟枚举', why: '校验后逐条执行移动指令。' }],
    solution: {
      type: 'editorial', insight: '先按分号切分，再验证“方向字符 + 1~2 位数字”的格式。',
      steps: ['getline 读取整行。', '用 stringstream 按分号切出 token。', '检查长度、方向和数字部分，合法后更新坐标。'],
      code: '#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    string s, t; getline(cin, s);\n    stringstream ss(s); int x = 0, y = 0;\n    while (getline(ss, t, \';\')) {\n        if (t.size() < 2 || t.size() > 3 || string("ADWS").find(t[0]) == string::npos) continue;\n        bool ok = true; for (int i = 1; i < (int)t.size(); ++i) ok &= isdigit(t[i]);\n        if (!ok) continue;\n        int d = stoi(t.substr(1));\n        if (t[0] == \'A\') x -= d; if (t[0] == \'D\') x += d;\n        if (t[0] == \'W\') y += d; if (t[0] == \'S\') y -= d;\n    }\n    cout << x << \',\' << y << \'\\n\';\n    return 0;\n}',
      codeNotes: ['先校验再 stoi，避免非法字符串抛异常。', '四个方向分别修改 x 或 y。'],
      complexity: '时间 O(n)，空间 O(n)。', trap: '如 A1A、A100、空指令都应忽略。'
    }
  },
  'nc:HJ20': {
    title: '密码验证合格程序', source: 'nowcoder', pid: 'HJ20', band: 'basic', tags: ['string', 'simulation'],
    statementHtml: '<p>逐行判断密码是否合法：长度大于 8；大写字母、小写字母、数字、其他符号四类中至少三类；不能包含长度大于等于 3 的重复子串。输出 <code>OK</code> 或 <code>NG</code>。</p>',
    meta: { difficulty: '中等' },
    knowledgeRefs: [{ key: 'string', name: '字符串', why: '需要分类字符并检查重复子串。' }],
    solution: {
      type: 'editorial', insight: '分别完成长度、字符类别、重复长度 3 子串三项校验。',
      steps: ['统计四类字符是否出现。', '枚举每个长度为 3 的子串，在后缀中查找是否重复。', '三个条件全部满足才输出 OK。'],
      code: '#include <bits/stdc++.h>\nusing namespace std;\nbool valid(const string& s) {\n    if (s.size() <= 8) return false;\n    bool up=0, low=0, dig=0, oth=0;\n    for (unsigned char c : s) { up |= isupper(c); low |= islower(c); dig |= isdigit(c); oth |= !isalnum(c); }\n    if ((int)up + low + dig + oth < 3) return false;\n    for (int i = 0; i + 2 < (int)s.size(); ++i)\n        if (s.find(s.substr(i, 3), i + 3) != string::npos) return false;\n    return true;\n}\nint main(){ string s; while (cin >> s) cout << (valid(s) ? "OK" : "NG") << \'\\n\'; }',
      codeNotes: ['长度 3 的重复片段足以覆盖“长度至少 3”的重复。', '从 i+3 开始查找，避免与当前片段重叠。'],
      complexity: '最坏时间 O(n²)，空间 O(n)。', trap: '字符种类要求至少三种，不是必须四种。'
    }
  },
  'nc:HJ24': {
    title: '合唱队', source: 'nowcoder', pid: 'HJ24', band: 'improve', tags: ['dp'],
    statementHtml: '<p>给定 n 名同学的身高，删除尽量少的人，使剩余队列先严格升高再严格降低。输出最少出列人数。</p>',
    meta: { difficulty: '困难' },
    knowledgeRefs: [{ key: 'dp', name: '动态规划', why: '分别计算以每个位置结尾的上升序列和开头的下降序列。' }],
    solution: {
      type: 'editorial', insight: '枚举峰顶 i，保留人数为 LIS[i] + LDS[i] - 1。',
      steps: ['从左到右计算以 i 结尾的最长严格上升子序列。', '从右到左计算以 i 开头的最长严格下降子序列。', '取最大合唱队长度，用 n 减去它。'],
      code: '#include <bits/stdc++.h>\nusing namespace std;\nint main(){\n    int n; cin >> n; vector<int>a(n), L(n,1), R(n,1);\n    for(int &x:a) cin >> x;\n    for(int i=0;i<n;++i) for(int j=0;j<i;++j) if(a[j]<a[i]) L[i]=max(L[i],L[j]+1);\n    for(int i=n-1;i>=0;--i) for(int j=n-1;j>i;--j) if(a[j]<a[i]) R[i]=max(R[i],R[j]+1);\n    int keep=0; for(int i=0;i<n;++i) keep=max(keep,L[i]+R[i]-1);\n    cout << n-keep << \'\\n\';\n}',
      codeNotes: ['峰顶在 L 和 R 中被计算两次，所以减 1。', '题目要求严格升降，比较符号必须是 <。'],
      complexity: '时间 O(n²)，空间 O(n)。', trap: '把非严格比较写成 <= 会错误保留相同身高。'
    }
  },
  'nc:HJ26': {
    title: '字符串排序规则', source: 'nowcoder', pid: 'HJ26', band: 'basic', tags: ['string', 'sort'],
    statementHtml: '<p>对一行字符串中的英文字母按不区分大小写的字典序稳定排序；非字母字符保持原位置不动。</p>',
    meta: { difficulty: '中等' },
    knowledgeRefs: [{ key: 'sort', name: '排序', why: '字母需要稳定排序，原相对顺序在忽略大小写后保持。' }],
    solution: {
      type: 'editorial', insight: '先提取所有字母稳定排序，再按原字符串中的字母位置依次回填。',
      steps: ['收集所有字母。', '按 tolower(c) 使用 stable_sort。', '遍历原串，遇到字母就取下一个排序后的字母替换。'],
      code: '#include <bits/stdc++.h>\nusing namespace std;\nint main(){\n    string s; getline(cin,s); vector<char> letters;\n    for(unsigned char c:s) if(isalpha(c)) letters.push_back(c);\n    stable_sort(letters.begin(),letters.end(),[](char a,char b){return tolower(a)<tolower(b);});\n    int k=0; for(char &c:s) if(isalpha((unsigned char)c)) c=letters[k++];\n    cout << s << \'\\n\';\n}',
      codeNotes: ['stable_sort 保证同一字母的大小写原顺序不乱。', '只替换字母位置，标点和数字自然保留。'],
      complexity: '时间 O(n log n)，空间 O(n)。', trap: '直接排序整个字符串会移动空格和标点。'
    }
  },
  'nc:HJ32': {
    title: '密码截取', source: 'nowcoder', pid: 'HJ32', band: 'basic', tags: ['string', 'dp', 'twopointer'],
    statementHtml: '<p>输入一个字符串，求其中最长回文子串的长度。</p><p>例如 <code>ABBA</code> 的答案为 4。</p>',
    meta: { difficulty: '中等' },
    knowledgeRefs: [{ key: 'twopointer', name: '双指针', why: '从回文中心向两侧同步扩展。' }],
    solution: {
      type: 'editorial', insight: '每个回文串都有一个中心；分别枚举奇数中心和偶数中心。',
      steps: ['定义 expand(l,r)，相等时向两边扩展。', '对每个 i 计算 (i,i) 与 (i,i+1)。', '维护最大长度。'],
      code: '#include <bits/stdc++.h>\nusing namespace std;\nint main(){\n    string s; cin >> s; int n=s.size(), ans=0;\n    auto expand=[&](int l,int r){ while(l>=0&&r<n&&s[l]==s[r]){--l;++r;} return r-l-1; };\n    for(int i=0;i<n;++i) ans=max({ans,expand(i,i),expand(i,i+1)});\n    cout << ans << \'\\n\';\n}',
      codeNotes: ['奇数回文中心是一个字符，偶数回文中心是两个字符之间。', '退出循环时左右各多走一步，所以长度是 r-l-1。'],
      complexity: '时间 O(n²)，空间 O(1)。', trap: '只枚举单字符中心会漏掉 ABBA 这类偶数回文。'
    }
  },
  'nc:HJ43': {
    title: '迷宫问题', source: 'nowcoder', pid: 'HJ43', band: 'basic', tags: ['graph', 'search'],
    statementHtml: '<p>给定 0/1 矩阵迷宫，0 表示可走，1 表示障碍。从左上角走到右下角，每次上下左右移动一格，输出一条可行路径上的坐标。</p>',
    meta: { difficulty: '中等' },
    knowledgeRefs: [{ key: 'search', name: '搜索', why: 'BFS 可以找到路径，并用父节点恢复路线。' }],
    solution: {
      type: 'editorial', insight: 'BFS 访问每个格子时记录它从哪个格子而来，到终点后逆序恢复路径。',
      steps: ['从 (0,0) 入队。', '扩展四个方向，首次访问时记录 parent。', '从终点沿 parent 回溯到起点，再反转输出。'],
      code: '#include <bits/stdc++.h>\nusing namespace std;\nint main(){\n    int n,m; cin>>n>>m; vector<vector<int>>a(n,vector<int>(m));\n    for(auto &r:a) for(int &x:r) cin>>x;\n    vector<vector<pair<int,int>>> pre(n,vector<pair<int,int>>(m,{-2,-2}));\n    queue<pair<int,int>>q; q.push({0,0}); pre[0][0]={-1,-1};\n    int d[5]={1,0,-1,0,1};\n    while(!q.empty()){ auto [x,y]=q.front(); q.pop();\n      for(int k=0;k<4;++k){int nx=x+d[k],ny=y+d[k+1];\n        if(nx>=0&&nx<n&&ny>=0&&ny<m&&!a[nx][ny]&&pre[nx][ny].first==-2){pre[nx][ny]={x,y};q.push({nx,ny});}\n      }\n    }\n    vector<pair<int,int>> path; for(pair<int,int> p={n-1,m-1};p.first!=-1;p=pre[p.first][p.second]) path.push_back(p);\n    reverse(path.begin(),path.end()); for(auto [x,y]:path) cout<<\'(\'<<x<<\',\'<<y<<")\\n";\n}',
      codeNotes: ['pre 同时充当 visited 数组。', '父节点设为 (-1,-1) 作为回溯终点。'],
      complexity: '时间 O(nm)，空间 O(nm)。', trap: '必须在入队时标记访问，避免同一格被重复入队。'
    }
  },
  'nc:HJ48': {
    title: '从单向链表中删除指定值', source: 'nowcoder', pid: 'HJ48', band: 'basic', tags: ['ds', 'simulation'],
    statementHtml: '<p>给定头结点和若干“把新值插入到某值之后”的操作，构造链表；最后删除指定值并输出剩余链表。</p>',
    meta: { difficulty: '中等' },
    knowledgeRefs: [{ key: 'ds', name: '数据结构', why: '需要按指定位置插入和删除链表结点。' }],
    solution: {
      type: 'editorial', insight: '使用 std::list 模拟链表，find 定位插入点后执行 insert。',
      steps: ['读取 n 和头结点。', '每次找到 afterVal，把 newVal 插入它后面。', '找到待删除值并删除，最后输出。'],
      code: '#include <bits/stdc++.h>\nusing namespace std;\nint main(){\n    int n,head; cin>>n>>head; list<int> a={head};\n    for(int i=1,x,y;i<n;++i){cin>>x>>y; auto it=find(a.begin(),a.end(),y); a.insert(next(it),x);}\n    int del; cin>>del; auto it=find(a.begin(),a.end(),del); if(it!=a.end()) a.erase(it);\n    for(int x:a) cout<<x<<\' \'; cout<<\'\\n\';\n}',
      codeNotes: ['题意保证作为参照的结点已经存在。', 'list 的 insert 在迭代器前插入，所以使用 next(it)。'],
      complexity: '当前写法时间 O(n²)，空间 O(n)。', trap: '输入顺序是“新值 参照值”，不要读反。'
    }
  },
  'nc:HJ50': {
    title: '四则运算', source: 'nowcoder', pid: 'HJ50', band: 'improve', tags: ['string', 'recursion'],
    statementHtml: '<p>计算包含整数、加减乘除和括号的表达式。需要遵守括号与运算符优先级，除法按整数除法处理。</p>',
    meta: { difficulty: '困难' },
    knowledgeRefs: [{ key: 'recursion', name: '递归分治', why: '递归下降按表达式层级自然处理优先级和括号。' }],
    solution: {
      type: 'editorial', insight: '把文法拆成 expression（加减）、term（乘除）、factor（数字/括号/正负号）三层。',
      steps: ['factor 读取数字、括号表达式或一元正负号。', 'term 循环处理乘除。', 'expression 循环处理加减。'],
      code: '#include <bits/stdc++.h>\nusing namespace std;\nstring s; int i=0;\nlong long expr();\nlong long factor(){\n    if(s[i]==\'+\'||s[i]==\'-\'){char op=s[i++]; long long v=factor(); return op==\'-\'?-v:v;}\n    if(s[i]==\'(\'||s[i]==\'[\'||s[i]==\'{\'){++i; long long v=expr(); ++i; return v;}\n    long long v=0; while(i<(int)s.size()&&isdigit(s[i])) v=v*10+s[i++]-\'0\'; return v;\n}\nlong long term(){ long long v=factor(); while(i<(int)s.size()&&(s[i]==\'*\'||s[i]==\'/\')){char op=s[i++]; long long r=factor(); v=op==\'*\'?v*r:v/r;} return v; }\nlong long expr(){ long long v=term(); while(i<(int)s.size()&&(s[i]==\'+\'||s[i]==\'-\')){char op=s[i++]; long long r=term(); v=op==\'+\'?v+r:v-r;} return v; }\nint main(){cin>>s; cout<<expr()<<\'\\n\';}',
      codeNotes: ['三层函数的调用顺序对应三档优先级。', 'factor 递归处理一元负号和任意括号。'],
      complexity: '时间 O(n)，递归空间 O(n)。', trap: '负号既可能是减法，也可能是一元负号，例如 -3 和 2*-3。'
    }
  },

  // 以下条目复用力扣中文题面，只覆盖原内容包中的通用框架题解。
  'lc:merge-two-sorted-lists': {
    solution: {
      type: 'editorial', insight: '使用虚拟头结点，把两个链表中较小的结点依次接到答案尾部。',
      steps: ['创建 dummy 和 tail。', '两个链表都非空时，选择值较小的结点接到 tail。', '把剩余链表整体接到尾部，返回 dummy.next。'],
      code: 'class Solution {\npublic:\n    ListNode* mergeTwoLists(ListNode* a, ListNode* b) {\n        ListNode dummy, *tail = &dummy;\n        while (a && b) {\n            if (a->val <= b->val) tail->next = a, a = a->next;\n            else tail->next = b, b = b->next;\n            tail = tail->next;\n        }\n        tail->next = a ? a : b;\n        return dummy.next;\n    }\n};',
      codeNotes: ['dummy 避免单独处理头结点。', '复用原链表结点，不需要创建新结点。'],
      complexity: '时间 O(m+n)，空间 O(1)。', trap: '移动 a 或 b 后，tail 也要同步移动。'
    }
  },
  'lc:reverse-linked-list': {
    solution: {
      type: 'editorial', insight: '遍历链表，把当前结点的 next 指针改为指向前一个结点。',
      steps: ['prev 初始为空，cur 指向头结点。', '先保存 next，再反转 cur->next。', 'prev 和 cur 同步前进，最后 prev 就是新头结点。'],
      code: 'class Solution {\npublic:\n    ListNode* reverseList(ListNode* head) {\n        ListNode *prev = nullptr, *cur = head;\n        while (cur) {\n            ListNode* next = cur->next;\n            cur->next = prev;\n            prev = cur;\n            cur = next;\n        }\n        return prev;\n    }\n};',
      codeNotes: ['修改指针前必须先保存 next。', '循环不变量：prev 始终是已经反转好的部分。'],
      complexity: '时间 O(n)，空间 O(1)。', trap: '先改 cur->next 再读取它，会丢失后续链表。'
    }
  },
  'lc:maximum-subarray': {
    solution: {
      type: 'editorial', insight: '以当前位置结尾的最大和，要么从当前数重新开始，要么接在前一段后面。',
      steps: ['令 cur 表示以当前元素结尾的最大子数组和。', '转移 cur=max(nums[i], cur+nums[i])。', '用 ans 记录所有 cur 的最大值。'],
      code: 'class Solution {\npublic:\n    int maxSubArray(vector<int>& nums) {\n        int cur = nums[0], ans = nums[0];\n        for (int i = 1; i < (int)nums.size(); ++i) {\n            cur = max(nums[i], cur + nums[i]);\n            ans = max(ans, cur);\n        }\n        return ans;\n    }\n};',
      codeNotes: ['初始化为 nums[0] 才能正确处理全负数组。', 'cur 只依赖前一个状态，可压缩到一个变量。'],
      complexity: '时间 O(n)，空间 O(1)。', trap: '把答案初始化为 0，会让全负数组错误返回 0。'
    }
  },
  'lc:binary-tree-inorder-traversal': {
    solution: {
      type: 'editorial', insight: '用栈模拟递归：一路压入左孩子，弹出访问，再转向右子树。',
      steps: ['当前结点非空时持续入栈并向左。', '左侧走完后弹出栈顶并记录值。', '转向该结点右孩子，重复直到栈和当前结点都为空。'],
      code: 'class Solution {\npublic:\n    vector<int> inorderTraversal(TreeNode* root) {\n        vector<int> ans; stack<TreeNode*> st;\n        TreeNode* cur = root;\n        while (cur || !st.empty()) {\n            while (cur) st.push(cur), cur = cur->left;\n            cur = st.top(); st.pop();\n            ans.push_back(cur->val);\n            cur = cur->right;\n        }\n        return ans;\n    }\n};',
      codeNotes: ['入栈过程对应递归进入左子树。', '弹栈时才访问根结点，符合左-根-右。'],
      complexity: '时间 O(n)，空间 O(h)。', trap: '访问结点后忘记转向右子树会造成死循环。'
    }
  },
  'lc:maximum-depth-of-binary-tree': {
    solution: {
      type: 'editorial', insight: '一棵树的最大深度等于左右子树最大深度加 1。',
      steps: ['空结点深度为 0。', '递归求左右子树深度。', '返回 max(left,right)+1。'],
      code: 'class Solution {\npublic:\n    int maxDepth(TreeNode* root) {\n        if (!root) return 0;\n        return max(maxDepth(root->left), maxDepth(root->right)) + 1;\n    }\n};',
      codeNotes: ['空树是递归终止条件。', '当前层贡献 1。'],
      complexity: '时间 O(n)，递归空间 O(h)。', trap: '不要把空树深度写成 1。'
    }
  },
  'lc:search-a-2d-matrix-ii': {
    solution: {
      type: 'editorial', insight: '从右上角开始：当前值太大就左移，太小就下移，每步排除一行或一列。',
      steps: ['起点设为右上角。', '等于 target 直接返回 true。', '大于 target 左移，否则下移。'],
      code: 'class Solution {\npublic:\n    bool searchMatrix(vector<vector<int>>& a, int target) {\n        int n = a.size(), m = a[0].size();\n        int i = 0, j = m - 1;\n        while (i < n && j >= 0) {\n            if (a[i][j] == target) return true;\n            if (a[i][j] > target) --j; else ++i;\n        }\n        return false;\n    }\n};',
      codeNotes: ['右上角同时具有“左边更小、下边更大”的单调性质。'],
      complexity: '时间 O(n+m)，空间 O(1)。', trap: '从左上角出发无法唯一决定移动方向。'
    }
  }
};

module.exports = { leetcodeIds, problems, content, nowcoderUrl: NOWCODER_URL };
