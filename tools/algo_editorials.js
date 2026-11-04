/**
 * 精讲题库 · 逐题手写解析
 *
 * 键 = algo_problems.json 里的 problem.id
 * 每题字段：
 *   insight      一句话点破这题在考什么
 *   steps[]      解题过程（分步，写「为什么这样想」，不是只写结论）
 *   knowledge[]  涉及的知识点（{ key, why }：本题为什么用到它）
 *   code         C++17 完整可提交代码
 *   codeNotes[]  代码逐段解析
 *   complexity   时间 / 空间复杂度
 *   trap         本题最容易 WA 的一处
 *
 * 与通用框架的区别：这里每题都是具体推导，可以按题面复现；
 * 未收录的题目由 build_algo_content.js 生成「通用解题框架」并显式标注类型。
 */
module.exports = {
  /* ---------------- 模拟 / 数学 ---------------- */
  'cf:4:A': {
    insight: '把「分成两个正偶数」翻译成 w 是偶数且大于 2。',
    steps: [
      '设两部分为 a 和 b，题目只要求 a、b 都是正偶数，不要求相等。于是 w = a + b。',
      '两个偶数之和一定是偶数，所以 w 必须是偶数；这是必要条件。',
      '最小的两个正偶数是 2 和 2，所以和最小是 4。w = 2 时只能拆成 1+1，不符合。',
      '反过来，任意偶数 w ≥ 4 都能写成 2 + (w-2)，而 w-2 也是正偶数，所以条件也充分。',
      '合并成一个判断：w % 2 == 0 && w > 2。'
    ],
    knowledge: [
      { key: 'simulation', why: '不需要模拟切西瓜的过程，只要把自然语言条件翻译成布尔表达式。这类题的功夫在读题。' },
      { key: 'math', why: '用的是奇偶性与「偶数 + 偶数 = 偶数」，以及最小值的构造性证明。' }
    ],
    code: `#include <bits/stdc++.h>
using namespace std;
int main() {
    int w; cin >> w;
    cout << (w % 2 == 0 && w > 2 ? "YES" : "NO") << '\\n';
    return 0;
}`,
    codeNotes: [
      '读一个整数 w，范围很小，int 足够。',
      '核心是三元表达式里的两个条件，缺一不可：偶数、且大于 2。',
      '输出必须全大写 YES / NO，大小写错会被判 WA。'
    ],
    complexity: '时间 O(1)，空间 O(1)。',
    trap: '只判偶数会漏掉 w = 2；只判 w > 2 会漏掉奇数。两个条件必须同时成立。'
  },

  'cf:158:A': {
    insight: '第 k 名的分数线是 score[k-1]，过关人数是「分数 ≥ 分数线且 > 0」的人数。',
    steps: [
      '先读出第 k 名的分数：下标从 0 开始，所以是 a[k-1]。',
      '题目说「与第 k 名同分且分数为正的人都能晋级」，所以条件是 a[i] >= a[k-1] 且 a[i] > 0。',
      '注意分数为 0 的人无论排第几都不能晋级，这是独立的限制。',
      '数组已经按降序给出，但即使不排序，直接遍历统计也只需 O(n)。',
      '遍历计数即可。'
    ],
    knowledge: [
      { key: 'simulation', why: '照着题目给的晋级规则逐个人判断，是最直接的模拟。' },
      { key: 'sort', why: '题面已保证降序，理解这一点才能确定 a[k-1] 就是分数线；如果没保证，第一步要先排序。' }
    ],
    code: `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n, k; cin >> n >> k;
    vector<int> a(n);
    for (int &x : a) cin >> x;
    int line = a[k-1], ans = 0;
    for (int x : a) if (x >= line && x > 0) ++ans;
    cout << ans << '\\n';
    return 0;
}`,
    codeNotes: [
      'a[k-1] 是第 k 名分数，因为数组下标从 0 开始。',
      'x >= line 保证与第 k 名同分的人也算进来。',
      'x > 0 是题目额外条件，不能省。'
    ],
    complexity: '时间 O(n)，空间 O(n)。',
    trap: '忘记 x > 0。当第 k 名分数是 0 时，后面的 0 分选手会被错误计入。'
  },

  'cf:263:A': {
    insight: '答案是 1 所在位置到矩阵中心 (3,3) 的曼哈顿距离。',
    steps: [
      '每次操作只能把 1 和上下左右相邻的格子交换，也就是让 1 移动一格。',
      '把 1 移到中心，横向要走 |r - 3| 步，纵向要走 |c - 3| 步，两者互不影响。',
      '所以最少步数就是 |r-3| + |c-3|，即曼哈顿距离。',
      '扫描 5×5 找到 1 的行列，注意行列下标按题意从 1 开始。'
    ],
    knowledge: [
      { key: 'simulation', why: '不用真的模拟每一步交换，把操作抽象成「坐标移动一格」即可。' },
      { key: 'math', why: '曼哈顿距离的可加性：横向与纵向步数可以分别计算再相加。' }
    ],
    code: `#include <bits/stdc++.h>
using namespace std;
int main() {
    int r = 0, c = 0;
    for (int i = 1; i <= 5; ++i)
        for (int j = 1; j <= 5; ++j) {
            int x; cin >> x;
            if (x == 1) { r = i; c = j; }
        }
    cout << abs(r - 3) + abs(c - 3) << '\\n';
    return 0;
}`,
    codeNotes: [
      '双重循环按 1-based 读入，找到 1 就记下 r、c。',
      'abs(r-3) + abs(c-3) 直接给出最少步数，无需 BFS。'
    ],
    complexity: '时间 O(1)（固定 25 格），空间 O(1)。',
    trap: '把下标写成 0-based 却仍用中心 3，答案会整体偏移 2。'
  },

  'cf:546:A': {
    insight: '前 k 件总价是等差数列和 k(k+1)/2·w，不够的钱就是它减去已有的 n。',
    steps: [
      '第 i 件价格是 i·w，买前 k 件共 w·(1+2+...+k) = w·k(k+1)/2。',
      '设需要借 d，则 n + d = w·k(k+1)/2。',
      '所以 d = max(0, w·k(k+1)/2 - n)。钱够的时候不需要借，答案不能是负数。',
      'k 可以到 1000，w 可以到 1000，总和约 5e8，用 long long 更稳妥。'
    ],
    knowledge: [
      { key: 'math', why: '等差数列求和公式与一元一次方程，是这类题的全部数学。' },
      { key: 'simulation', why: '也可以逐件累加，但公式法只需 O(1)；两种做法都应能想到。' }
    ],
    code: `#include <bits/stdc++.h>
using namespace std;
int main() {
    long long w, m, n; cin >> w >> m >> n;  // m = 想买的件数 k
    long long cost = w * m * (m + 1) / 2;
    cout << max(0LL, cost - n) << '\\n';
    return 0;
}`,
    codeNotes: [
      '三个变量都用 long long，避免 w·m·(m+1) 溢出 int。',
      '先乘完再除可能会溢出，但这里量级安全；更保险可以先约分。',
      'max(0LL, ...) 处理「钱够不用借」的情况。'
    ],
    complexity: '时间 O(1)，空间 O(1)。',
    trap: '用 int 存 cost 会溢出；或忘了 max 导致输出负数。'
  },

  'cf:69:A': {
    insight: '合力为零等价于三个分量各自的和都为零。',
    steps: [
      '把每个力看成三维向量 (x, y, z)。',
      '多个力的合力就是各分量分别相加。',
      '平衡的条件是合力为零向量，也就是 sx = sy = sz = 0 同时成立。',
      '读入 n 个向量累加三个分量，最后判断三者是否全为 0。'
    ],
    knowledge: [
      { key: 'math', why: '向量加法按分量独立进行，这是把「物理平衡」翻译成代码的关键。' },
      { key: 'simulation', why: '逐个读入并累加，最朴素的模拟就够。' }
    ],
    code: `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; cin >> n;
    int sx = 0, sy = 0, sz = 0;
    for (int i = 0; i < n; ++i) {
        int x, y, z; cin >> x >> y >> z;
        sx += x; sy += y; sz += z;
    }
    cout << (sx == 0 && sy == 0 && sz == 0 ? "YES" : "NO") << '\\n';
    return 0;
}`,
    codeNotes: [
      '三个分量分别累加，互不干扰。',
      '判断必须三个同时为 0，用 && 而不是 ||。'
    ],
    complexity: '时间 O(n)，空间 O(1)。',
    trap: '误以为只要总和为 0，写成 sx+sy+sz == 0，这会把 (1,-1,0) 错判成平衡。'
  },

  /* ---------------- 贪心 / 排序 ---------------- */
  'cf:230:A': {
    insight: '按龙的体力从小到大打，能打就打，打不过就停。',
    steps: [
      '每打赢一条龙力量 +1，打死任何一条的收益都一样，所以应该先挑最弱的打。',
      '把龙按体力升序排序，这构成贪心策略。',
      '依次遍历：若当前力量 s > 龙体力 a[i]，则打赢并 s++；否则跳过。',
      '为什么停在这里是对的：最弱的都打不过，后面更强的更打不过，力量也不会再增长。',
      '遍历完判断是否打赢了全部 n 条。'
    ],
    knowledge: [
      { key: 'greedy', why: '「先打最弱的」是贪心选择；理由是所有龙收益相同、消耗单调，交换论证成立。' },
      { key: 'sort', why: '贪心的前提是把可选对象按体力排好序。' }
    ],
    code: `#include <bits/stdc++.h>
using namespace std;
int main() {
    int s, n; cin >> s >> n;
    vector<pair<int,int>> a(n);
    for (auto &p : a) cin >> p.first >> p.second;
    sort(a.begin(), a.end());
    for (auto &p : a) {
        if (s > p.first) s += p.second;
        else { cout << "NO\\n"; return 0; }
    }
    cout << "YES\\n";
    return 0;
}`,
    codeNotes: [
      'pair 默认按 first（体力）升序，正好是需要的顺序。',
      '条件是严格大于 s > a[i]，等于时打不赢，这是题目的原话。',
      '打赢后 s += bonus（本题 bonus 为 1）。'
    ],
    complexity: '时间 O(n log n)（排序），空间 O(n)。',
    trap: '把 s > a[i] 写成 s >= a[i]，会在力量刚好相等时误判为能赢。'
  },

  'cf:160:A': {
    insight: '从大到小拿硬币，拿到总和超过总数一半就停，此时拿的枚数最少。',
    steps: [
      '要让「我拿的比剩下的多」，即我拿的总和 > total/2。',
      '为了让枚数最少，每次都应该拿面值最大的硬币 —— 收益最大的选择优先。',
      '把硬币降序排序，累加直到 cur * 2 > total。',
      '为什么这样最优：任何用更少枚数的方案，其总和一定不超过前 k 个最大硬币之和（交换论证）。',
      '输出累加的枚数。'
    ],
    knowledge: [
      { key: 'greedy', why: '每次取最大面值，是典型的「用最少个数达到阈值」贪心。' },
      { key: 'sort', why: '降序排序是贪心能执行的前提。' }
    ],
    code: `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; cin >> n;
    vector<int> a(n); long long total = 0;
    for (int &x : a) { cin >> x; total += x; }
    sort(a.rbegin(), a.rend());
    long long cur = 0;
    for (int i = 0; i < n; ++i) {
        cur += a[i];
        if (cur * 2 > total) { cout << i + 1 << '\\n'; return 0; }
    }
    return 0;
}`,
    codeNotes: [
      'sort(a.rbegin(), a.rend()) 得到降序。',
      '用 cur * 2 > total 避免浮点和整除问题，比 cur > total/2 更安全。',
      '找到就立刻输出并 return，i+1 是拿的枚数。'
    ],
    complexity: '时间 O(n log n)，空间 O(n)。',
    trap: '写成 cur > total / 2：当 total 是奇数时整数除法会向下取整，判断提前成立。'
  },

  'cf:231:A': {
    insight: '一题只要有一个人确信，团队就会做；统计三个数里 ≥2 的行数。',
    steps: [
      '每行是三个 0/1，表示三个人各自是否确信。',
      '题目说至少两人确信才做，所以条件是三个数之和 >= 2。',
      '遍历每行求和并计数。',
      '这是最直接的模拟，不需要额外数据结构。'
    ],
    knowledge: [
      { key: 'simulation', why: '逐行按规则判断并计数。' },
      { key: 'greedy', why: '本题不涉及取舍，但「多数决」是理解阈值型贪心的入门模型。' }
    ],
    code: `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; cin >> n; int ans = 0;
    while (n--) {
        int a, b, c; cin >> a >> b >> c;
        if (a + b + c >= 2) ++ans;
    }
    cout << ans << '\\n';
    return 0;
}`,
    codeNotes: [
      '三个 0/1 相加直接得到确信人数。',
      '>= 2 是「至少两个」，不是 > 2。'
    ],
    complexity: '时间 O(n)，空间 O(1)。',
    trap: '写成 > 2 会只统计三人全确信的行，漏掉恰好两人确信的情况。'
  },

  /* ---------------- 字符串 ---------------- */
  'cf:112:A': {
    insight: '先统一成小写再逐字符比较，返回第一个不同处的字典序关系。',
    steps: [
      '题目说比较时忽略大小写，最省事的做法是两个串都先转成小写。',
      '然后从左到右找第一个不同的位置。',
      '该位置上字符小的串字典序更小；如果所有字符都相同，输出 0。',
      '转小写用 tolower，注意要转成 unsigned char 再调用以避免未定义行为（本题都是字母可省略）。'
    ],
    knowledge: [
      { key: 'string', why: '字典序比较与大小写规整，是字符串题最基本的两个操作。' },
      { key: 'simulation', why: '逐字符扫描，一次遍历。' }
    ],
    code: `#include <bits/stdc++.h>
using namespace std;
int main() {
    string a, b; cin >> a >> b;
    for (char &c : a) c = tolower(c);
    for (char &c : b) c = tolower(c);
    if (a < b) cout << -1 << '\\n';
    else if (a > b) cout << 1 << '\\n';
    else cout << 0 << '\\n';
    return 0;
}`,
    codeNotes: [
      '两次遍历把两个串都转成小写。',
      'string 自带的 < / > 就是字典序比较，长度不同时短串更小，符合题目规则。'
    ],
    complexity: '时间 O(|a|+|b|)，空间 O(1) 额外。',
    trap: '只转其中一个串，或在原串上比较时忘了大小写已被修改。'
  },

  /* ---------------- 二分 ---------------- */
  'cf:474:B': {
    insight: '用前缀和把每堆变成累计区间，查询时用 lower_bound 找第一个 ≥ 目标的位置。',
    steps: [
      '第 i 堆包含的蠕虫编号是 (前缀和[i-1], 前缀和[i]] 这段连续区间。',
      '把所有堆的累计和算出来放进数组 s，s 严格递增。',
      '对每个查询 q，找第一个 s[i] >= q 的下标 i，那 q 就属于第 i+1 堆。',
      '因为 s 有序，用 lower_bound 二分，每次查询 O(log n)。',
      '输出时下标加 1 转成 1-based 堆编号。'
    ],
    knowledge: [
      { key: 'prefix', why: '前缀和把「第几堆」的归属问题转成有序数轴上的定位问题。' },
      { key: 'binary', why: 'lower_bound 就是在单调数组上二分找第一个满足条件的下标。' },
      { key: 'ds', why: '用一个有序数组承载累计和，是最轻量的结构选择。' }
    ],
    code: `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; cin >> n;
    vector<int> s(n);
    for (int i = 0; i < n; ++i) {
        int x; cin >> x;
        s[i] = x + (i ? s[i-1] : 0);
    }
    int m; cin >> m;
    while (m--) {
        int q; cin >> q;
        cout << (lower_bound(s.begin(), s.end(), q) - s.begin()) + 1 << '\\n';
    }
    return 0;
}`,
    codeNotes: [
      's[i] 是前 i+1 堆的蠕虫总数，天然递增。',
      'lower_bound 返回迭代器，减去 begin() 得到 0-based 下标。',
      '+1 转成题目要求的堆编号。'
    ],
    complexity: '预处理 O(n)，每次查询 O(log n)，空间 O(n)。',
    trap: '用 upper_bound 会在 q 恰好等于某堆末尾时把它归到下一堆。'
  },

  'cf:492:B': {
    insight: '答案是相邻灯笼间距最大值、以及两端到边界距离的两倍，三者取最大再除以 2。',
    steps: [
      '设灯笼半径 d，要照亮整段 [0, l]。',
      '两端需要覆盖：左边 0 到第一个灯笼距离 a[0]，右边 l 到最后一个灯笼距离 l - a[n-1]，各需要 d >= 该距离。',
      '中间相邻两灯笼间距 gap，两者光锥要接上，需要 2d >= gap，即 d >= gap/2。',
      '取所有约束的最大值：d = max(a[0], l - a[n-1], maxGap/2)。',
      '先把灯笼坐标排序，才能算相邻间距。输出保留浮点。'
    ],
    knowledge: [
      { key: 'sort', why: '坐标给的是无序的，必须先排序才能求相邻间距和两端。' },
      { key: 'binary', why: '也可对答案 d 二分（check：覆盖是否连续），但直接取最大值更简洁；两种思路都值得知道。' },
      { key: 'math', why: '把覆盖条件翻译成不等式，再取上界最大值。' }
    ],
    code: `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n, l; cin >> n >> l;
    vector<int> a(n);
    for (int &x : a) cin >> x;
    sort(a.begin(), a.end());
    double d = max(a[0], l - a[n-1]);
    for (int i = 1; i < n; ++i) d = max(d, (a[i] - a[i-1]) / 2.0);
    cout << fixed << setprecision(10) << d << '\\n';
    return 0;
}`,
    codeNotes: [
      '排序后 a[0] 和 a[n-1] 分别是两端最近的灯笼。',
      '相邻间距要除以 2，因为两个灯笼的光锥各覆盖一半。',
      '用 double 并保留足够精度，避免浮点误差被判 WA。'
    ],
    complexity: '时间 O(n log n)，空间 O(n)。',
    trap: '相邻间距忘了除以 2，答案会大一倍；或漏掉两端到边界的距离。'
  },

  /* ---------------- 前缀和 / 差分 / 双指针（LC） ---------------- */
  'lc:range-sum-query-immutable': {
    insight: '把「区间和」预处理成两个前缀和相减，每次查询 O(1)。',
    steps: [
      '朴素做法是每次 sumRange(i, j) 都循环累加，n 次查询会到 O(n²)。',
      '构造 s[k] = nums[0] + ... + nums[k-1]，并令 s[0] = 0（哨兵）。',
      '则 sumRange(i, j) = s[j+1] - s[i]。',
      '预处理一次 O(n)，之后所有查询都是 O(1)。',
      '注意数组不可变，所以前缀和可以一直复用；如果数组会变，就要换成树状数组。'
    ],
    knowledge: [
      { key: 'prefix', why: '本题就是前缀和的定义题，是后续所有区间统计的基础。' },
      { key: 'simulation', why: '预处理阶段逐个累加，是最简单的线性模拟。' }
    ],
    code: `class NumArray {
    vector<int> s;   // s[i] = 前 i 个元素之和
public:
    NumArray(vector<int>& nums) {
        s.assign(nums.size() + 1, 0);
        for (int i = 0; i < (int)nums.size(); ++i) s[i+1] = s[i] + nums[i];
    }
    int sumRange(int i, int j) { return s[j+1] - s[i]; }
};`,
    codeNotes: [
      's 开 n+1 长度，s[0] = 0 让公式在 i=0 时也成立。',
      '构造函数里一次线性累加完成预处理。',
      'sumRange 只做一次减法，O(1)。'
    ],
    complexity: '预处理 O(n)，每次查询 O(1)，空间 O(n)。',
    trap: 's 只开 n 长度，导致 sumRange(0, j) 时要访问 s[-1]；多开一位是标准做法。'
  },

  'lc:find-pivot-index': {
    insight: '左侧和 = 总和 - 左侧和 - nums[i]，解出左侧和即可 O(1) 判断每个位置。',
    steps: [
      '设 total 为数组总和，left 为 i 左侧元素之和。',
      '右侧和 = total - left - nums[i]。',
      '中心下标条件：left == total - left - nums[i]。',
      '从左往右遍历，维护 left，命中就返回下标（题目要最靠左的，首次命中即为答案）。',
      '注意 i=0 时 left=0，i=n-1 时右侧和为 0，两个端点都要正确处理。'
    ],
    knowledge: [
      { key: 'prefix', why: 'left 就是动态维护的前缀和，不需要真的开一个前缀和数组。' },
      { key: 'simulation', why: '一次从左到右扫描，边更新边判断。' }
    ],
    code: `class Solution {
public:
    int pivotIndex(vector<int>& nums) {
        long long total = 0;
        for (int x : nums) total += x;
        long long left = 0;
        for (int i = 0; i < (int)nums.size(); ++i) {
            if (left * 2 == total - nums[i]) return i;
            left += nums[i];
        }
        return -1;
    }
};`,
    codeNotes: [
      'total 用 long long 防止累加溢出。',
      '条件 left == total - left - nums[i] 移项后是 left*2 == total - nums[i]，避免重复计算右侧和。',
      '先判断再累加 left，因为 left 是「i 左侧」，不含 nums[i]。'
    ],
    complexity: '时间 O(n)，空间 O(1)。',
    trap: '把 left += nums[i] 写在判断之前，会变成「含自身的左侧和」，条件整体错位。'
  },

  'lc:minimum-size-subarray-sum': {
    insight: '窗口和单调（元素全为正），用双指针维护一个和 ≥ target 的最小窗口。',
    steps: [
      '元素都是正整数，所以右端点右移时窗口和只增不减 → 单调性成立，可以用滑动窗口。',
      '扩张右端点 r，把 nums[r] 加入 cur。',
      '当 cur >= target 时，说明当前窗口合法，尝试用 r-l+1 更新答案，并从左端收缩（cur -= nums[l++]，l++）。',
      '用 while 而不是 if 收缩，因为可能连续收缩多次才是最小窗口。',
      '另外可以二分「长度」做，但双指针 O(n) 更优。元素有负数时该方法失效，要改用前缀和 + 单调队列。'
    ],
    knowledge: [
      { key: 'twopointer', why: '本题是滑动窗口的模板题，单调性来自「元素全为正」。' },
      { key: 'prefix', why: '另一种解法是前缀和 + 二分找下界；理解前缀和能看懂这个替代方案。' },
      { key: 'binary', why: '替代解法里对前缀和数组做 lower_bound，体现「有单调性就能二分」。' }
    ],
    code: `class Solution {
public:
    int minSubArrayLen(int target, vector<int>& nums) {
        int n = nums.size(), ans = n + 1, l = 0;
        long long cur = 0;
        for (int r = 0; r < n; ++r) {
            cur += nums[r];
            while (cur >= target) {
                ans = min(ans, r - l + 1);
                cur -= nums[l++];
            }
        }
        return ans == n + 1 ? 0 : ans;
    }
};`,
    codeNotes: [
      'ans 初始化为 n+1 作为「不存在」的哨兵。',
      'while 内部先更新答案再收缩，保证不会漏掉当前合法窗口。',
      'cur 用 long long，避免大数累加溢出。'
    ],
    complexity: '时间 O(n)（每个下标最多进出窗口各一次），空间 O(1)。',
    trap: '把 while 写成 if，一次只收缩一格，会错过更短的合法窗口。'
  },

  'lc:subarray-sum-equals-k': {
    insight: '两个前缀和之差等于 k，用哈希表统计之前出现过的前缀和次数。',
    steps: [
      '设 s[i] 为前 i 个元素之和，则子数组 (j, i] 的和是 s[i] - s[j]。',
      '要它等于 k，就是 s[j] = s[i] - k。',
      '从左往右扫描，维护当前前缀和 cur，并查询「之前有多少个前缀和等于 cur - k」。',
      '把这个数量加到答案里，再把 cur 出现次数 +1。',
      '哈希表初始化为 {0: 1}，表示空前缀（和为 0）出现过一次，否则从下标 0 开始的子数组会被漏掉。',
      '注意不能用双指针：数组里有负数，窗口和不单调。'
    ],
    knowledge: [
      { key: 'prefix', why: '把子数组和转成两个前缀和之差，是处理「任意子数组和」的通用手法。' },
      { key: 'ds', why: '哈希表把「查找有多少个历史前缀和等于某值」降到 O(1)。' },
      { key: 'simulation', why: '一次线性扫描，边算边查边记录。' }
    ],
    code: `class Solution {
public:
    int subarraySum(vector<int>& nums, int k) {
        unordered_map<long long, int> cnt;
        cnt[0] = 1;
        long long cur = 0, ans = 0;
        for (int x : nums) {
            cur += x;
            auto it = cnt.find(cur - k);
            if (it != cnt.end()) ans += it->second;
            ++cnt[cur];
        }
        return ans;
    }
};`,
    codeNotes: [
      'cnt[0] = 1 是关键初始化，代表空前缀。',
      '先查询再 ++cnt[cur]，顺序不能反（否则 k=0 时会把自己算进去）。',
      'key 用 long long 避免前缀和溢出。'
    ],
    complexity: '时间 O(n) 平均，空间 O(n)。',
    trap: '漏掉 cnt[0] = 1，会导致「从第一个元素开始的、和恰好为 k 的子数组」计数为 0。'
  },

  'lc:corporate-flight-bookings': {
    insight: '一次区间加用差分数组两个端点搞定，最后求一次前缀和还原。',
    steps: [
      '每笔预订 [l, r, seats] 表示给 l..r 每个航班加 seats，是典型的「区间加、最后只查一次」。',
      '构造差分 d，令 d[i] = ans[i] - ans[i-1]。',
      '区间加 v 等价于 d[l] += v、d[r+1] -= v，两次 O(1) 修改。',
      '所有预订处理完后，对 d 求前缀和就得到每个航班的答案。',
      '数组要开 n+2，容纳 r+1 这个越界位置。'
    ],
    knowledge: [
      { key: 'prefix', why: '差分是前缀和的逆运算：对差分求前缀和还原原数组。' },
      { key: 'simulation', why: '逐笔处理预订、最后一次线性还原。' }
    ],
    code: `class Solution {
public:
    vector<int> corpFlightBookings(vector<vector<int>>& b, int n) {
        vector<int> d(n + 2, 0);
        for (auto &x : b) {
            int l = x[0], r = x[1], v = x[2];
            d[l] += v;
            d[r+1] -= v;
        }
        vector<int> ans(n);
        int cur = 0;
        for (int i = 1; i <= n; ++i) {
            cur += d[i];
            ans[i-1] = cur;
        }
        return ans;
    }
};`,
    codeNotes: [
      'd 开 n+2，因为 r 可能等于 n，此时 d[n+1] 要能写。',
      '两行修改就是整个区间加的全部代价。',
      '最后一遍前缀和还原，ans 用 0-based 存。'
    ],
    complexity: '时间 O(m + n)，空间 O(n)。',
    trap: 'd 只开 n+1，当 r = n 时 d[r+1] 越界。'
  },

  /* ---------------- DP ---------------- */
  'cf:189:A': {
    insight: '完全背包：三种长度可以无限次使用，求切出总长 n 的最大段数。',
    steps: [
      '设 f[len] 表示切出总长 len 时最多能切成几段，不可达记为 -INF。',
      'f[0] = 0 是初始状态。',
      '对每个长度 len，尝试接上一段长度 a、b 或 c：f[len] = max(f[len-a], f[len-b], f[len-c]) + 1。',
      '因为每段可以重复使用，这是完全背包，len 从小到大枚举即可（顺序循环，不是倒序）。',
      '答案是 f[n]；若不可达则应为 0（本题保证有解）。'
    ],
    knowledge: [
      { key: 'dp', why: '本题是完全背包的最简形式，状态只有一维，转移是「最后一段选哪种」。' },
      { key: 'recursion', why: '也可以写成记忆化搜索 f(len) = 1 + max(f(len-a), ...)，两种写法等价。' }
    ],
    code: `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n, a, b, c; cin >> n >> a >> b >> c;
    const int NEG = -1e9;
    vector<int> f(n + 1, NEG);
    f[0] = 0;
    int cut[3] = {a, b, c};
    for (int len = 1; len <= n; ++len)
        for (int x : cut)
            if (len >= x && f[len - x] != NEG)
                f[len] = max(f[len], f[len - x] + 1);
    cout << f[n] << '\\n';
    return 0;
}`,
    codeNotes: [
      'NEG 表示不可达，避免把「切不出来」误当成 0 段。',
      'len 正序枚举且三种长度可重复使用，正是完全背包。',
      '转移前检查 len >= x 且前驱可达。'
    ],
    complexity: '时间 O(3n)，空间 O(n)。',
    trap: '把循环写成倒序（0/1 背包写法），会导致每种长度只能用一次。'
  },

  /* ---------------- 图 / 树 / 搜索 ---------------- */
  'cf:500:A': {
    insight: '每个点只有一条出边，从 1 出发要么走到 t，要么走进环后停下。',
    steps: [
      '题目给的 a[i] 表示从 i 可以跳到 i + a[i]，也就是每个点最多一条出边。',
      '从 1 开始不断跳，如果到达 t 就 YES。',
      '因为出度都是 1，路径不会分叉；一旦跳过 t 或走进循环就永远到不了。',
      '用 visited 数组或步数上限 n 防止死循环。',
      '这是最简形式的图遍历（函数图），不需要 BFS/DFS 的栈或队列。'
    ],
    knowledge: [
      { key: 'graph', why: '把每个位置和跳跃看成点与有向边，就是一张每个点出度为 1 的函数图。' },
      { key: 'search', why: '从起点沿唯一路径搜索目标，是 DFS 的退化情形。' }
    ],
    code: `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n, t; cin >> n >> t;
    vector<int> a(n + 1);
    for (int i = 1; i <= n; ++i) cin >> a[i];
    int cur = 1;
    vector<int> vis(n + 1, 0);
    while (cur <= n && !vis[cur]) {
        if (cur == t) { cout << "YES\\n"; return 0; }
        vis[cur] = 1;
        cur += a[cur];
    }
    cout << "NO\\n";
    return 0;
}`,
    codeNotes: [
      'vis 防止进入环后无限循环。',
      'cur += a[cur] 是唯一的一条出边。',
      'cur > n 说明跳出界，也到不了 t。'
    ],
    complexity: '时间 O(n)，空间 O(n)。',
    trap: '不加 visited，遇到环会死循环超时。'
  },

  'cf:862:B': {
    insight: '树一定是二分图，按到根的距离奇偶染色，两边点数相加要等于 n。',
    steps: [
      '题目要求把点分成两组，使每条边都跨组 —— 这正是二分图的定义。',
      '树没有奇环，所以一定能二分染色；从任意点（1）开始 BFS/DFS。',
      '相邻点染成相反颜色，统计两种颜色各有 cnt0、cnt1 个。',
      '为了让跨组边尽量多，把所有「孤立可加入的点」加到人数较少的那组；在树上答案就是 cnt0 + cnt1 = n（本题求的是可以补多少点，实际输出 n - 原始点数）。',
      '具体实现上：先染色统计，再按题意输出两组点集大小之和。'
    ],
    knowledge: [
      { key: 'tree', why: '树无环，二分染色一定成功，这是本题能简化的根本原因。' },
      { key: 'graph', why: '二分图判定与 BFS 染色是图论基础操作。' },
      { key: 'search', why: '用 BFS 从根向外逐层染色。' }
    ],
    code: `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; cin >> n;
    vector<vector<int>> g(n + 1);
    for (int i = 0; i < n - 1; ++i) {
        int u, v; cin >> u >> v;
        g[u].push_back(v); g[v].push_back(u);
    }
    vector<int> color(n + 1, -1);
    queue<int> q; color[1] = 0; q.push(1);
    long long cnt[2] = {0, 0};
    while (!q.empty()) {
        int u = q.front(); q.pop(); ++cnt[color[u]];
        for (int v : g[u]) if (color[v] == -1) {
            color[v] = color[u] ^ 1; q.push(v);
        }
    }
    cout << cnt[0] + cnt[1] << '\\n';   // = n
    return 0;
}`,
    codeNotes: [
      '邻接表存无向树，每条边要 push 两次。',
      'color[u] ^ 1 把相邻点染成相反颜色。',
      'BFS 保证每个点只被染色一次。'
    ],
    complexity: '时间 O(n)，空间 O(n)。',
    trap: '无向图只加一条边，遍历会漏掉一半节点。'
  },

  'lc:split-array-largest-sum': {
    insight: '对「最大子段和」这个答案二分，用贪心 check 需要分成几段。',
    steps: [
      '设答案上界 X（每段和都不超过 X），判断能否把数组分成不超过 m 段。',
      'check(X)：从左到右贪心地往当前段里装，装不下就新开一段，最后看段数是否 ≤ m。',
      'X 越大越容易满足，所以可行性单调 → 可以二分找最小的可行 X。',
      '搜索区间下界是 max(nums[i])（一段至少装得下最大元素），上界是 sum(nums)（全放一段）。',
      '这个「二分答案 + 贪心 check」是最大值最小化问题的通用套路。'
    ],
    knowledge: [
      { key: 'binary', why: '把「求最优值」转成「判断某个值可不可行」，靠单调性二分。' },
      { key: 'greedy', why: 'check 里「能装就装」的贪心是最优的，因为分段越少越好。' },
      { key: 'dp', why: '也可以用 O(n·m) DP 直接求，但二分 + 贪心是 O(n log sum)，是很好的对照。' }
    ],
    code: `class Solution {
public:
    int splitArray(vector<int>& nums, int m) {
        long long lo = 0, hi = 0;
        for (int x : nums) { lo = max(lo, (long long)x); hi += x; }
        auto ok = [&](long long cap) {
            int seg = 1; long long cur = 0;
            for (int x : nums) {
                if (cur + x > cap) { ++seg; cur = 0; }
                cur += x;
            }
            return seg <= m;
        };
        while (lo < hi) {
            long long mid = lo + (hi - lo) / 2;
            if (ok(mid)) hi = mid; else lo = mid + 1;
        }
        return (int)lo;
    }
};`,
    codeNotes: [
      'lo 取最大元素、hi 取总和，是答案的紧界。',
      'ok(cap) 里贪心分段，段数不超过 m 即可行。',
      '用 while (lo < hi) 的「找第一个可行」写法，结束时 lo == hi。'
    ],
    complexity: '时间 O(n log(sum))，空间 O(1)。',
    trap: 'lo 初始化为 0，导致 cap 小于最大元素时 check 逻辑错误；或 hi 用 int 溢出。'
  }
};
