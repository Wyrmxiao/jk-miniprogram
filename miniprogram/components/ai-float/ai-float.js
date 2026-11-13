/**
 * AI 悬浮球助手（多场景）
 *
 * 交互：
 *   - 页面右下角悬浮球，点击弹出底部聊天面板（fixed 定位，不影响页面布局）；
 *   - scene="algo"（默认，算法训练）：发消息 → agent.algoAssistant，
 *     回复 action=goto 时气泡内出现「去刷题」按钮 → 跳题单页（tag×band）；
 *   - scene="qa"（学习问答）：发消息 → agent.qaAssistant，纯答疑不跳转；
 *   - 传入 problem 属性时（题目详情页），提问自动带题目上下文。
 * 样式走全局设计令牌（variables.wxss 定义在 page 上，CSS 变量可继承进组件）。
 */
const { agent } = require('../../services/index');

const SCENES = {
  algo: {
    api: (payload) => agent.algoAssistant(payload),
    title: 'AI 算法助手',
    welcomeTitle: '想刷什么题？问我就行',
    welcomeDesc: '比如「来几道动态规划中等题」，我帮你挑好题单直达；做完哪题没看懂，也直接问我解析',
    placeholder: '问点什么…',
    chips: ['来几道动态规划中等题', '挑 5 道贪心简单题练手', '这道题卡住了，讲讲思路'],
    allowGoto: true
  },
  qa: {
    api: (payload) => agent.qaAssistant(payload),
    title: 'AI 答疑助手',
    welcomeTitle: '学习上有疑问？先问我',
    welcomeDesc: '概念没懂、方法不对、问题不知道怎么描述，都可以问我；值得深挖的问题记得发到社区让老师看到',
    placeholder: '问问学习上的事…',
    chips: ['动态规划入门该先学什么', '怎么高效准备蓝桥杯', '帮我润色一下要提问的问题'],
    allowGoto: false
  }
};

Component({
  properties: {
    /** 场景：algo=算法训练（默认），qa=学习问答 */
    scene: { type: String, value: 'algo' },
    /** 题目详情页传入 { title, titleCn, bandName, tagNames }，其他页不传 */
    problem: { type: Object, value: null }
  },

  data: {
    open: false,
    sending: false,
    input: '',
    msgs: [],          // { role:'user'|'ai', text, loading, goto:{tag,band,tagName,bandName}|null }
    scrollInto: '',
    chips: [],
    title: '',
    welcomeTitle: '',
    welcomeDesc: '',
    placeholder: ''
  },

  lifetimes: {
    attached() {
      // 会话历史仅组件实例内存级：页面卸载即清，控制 token 也避免串场景
      this._history = [];
      const cfg = SCENES[this.data.scene] || SCENES.algo;
      this._cfg = cfg;
      this.setData({
        chips: cfg.chips,
        title: cfg.title,
        welcomeTitle: cfg.welcomeTitle,
        welcomeDesc: cfg.welcomeDesc,
        placeholder: cfg.placeholder
      });
    }
  },

  methods: {
    toggle() {
      this.setData({ open: !this.data.open });
      if (this.data.open) this.scrollBottom();
    },
    close() {
      this.setData({ open: false });
    },
    // 阻断面板内点击冒泡到遮罩
    noop() {},

    onInput(e) {
      this.setData({ input: e.detail.value });
    },

    onConfirm() {
      this.send();
    },

    onChip(e) {
      const text = e.currentTarget.dataset.text;
      if (text) this.send(text);
    },

    scrollBottom() {
      const n = this.data.msgs.length;
      if (n > 0) this.setData({ scrollInto: 'msg-' + (n - 1) });
    },

    /** 题目上下文载荷（仅题目详情页有值） */
    problemPayload() {
      const p = this.data.problem;
      if (!p || !p.title) return null;
      return {
        title: p.title,
        titleCn: p.titleCn || '',
        bandName: p.bandName || '',
        tagNames: Array.isArray(p.tagNames) ? p.tagNames : []
      };
    },

    async send(text) {
      const raw = typeof text === 'string' ? text : this.data.input;
      const msg = (raw || '').trim();
      if (!msg || this.data.sending) return;

      const msgs = this.data.msgs.concat([
        { role: 'user', text: msg, loading: false, goto: null },
        { role: 'ai', text: '', loading: true, goto: null }
      ]);
      this._history.push({ role: 'user', content: msg });
      if (this._history.length > 12) this._history = this._history.slice(-12);

      this.setData({ msgs, input: '', sending: true, scrollInto: 'msg-' + (msgs.length - 1) });

      try {
        const res = await this._cfg.api({
          message: msg,
          history: this._history.slice(0, -1), // 最后一条 user 已在后端消息里
          problem: this.problemPayload()
        });
        this._history.push({ role: 'assistant', content: res.text || '' });

        const goto =
          this._cfg.allowGoto && res.action === 'goto'
            ? {
                tag: res.tag || '',
                band: res.band || '',
                tagName: res.tagName || '全部知识点',
                bandName: res.bandName || ''
              }
            : null;

        const idx = this.data.msgs.length - 1;
        this.setData({
          ['msgs[' + idx + ']']: { role: 'ai', text: res.text || '（空回复）', loading: false, goto },
          sending: false,
          scrollInto: 'msg-' + idx
        });
      } catch (e) {
        const idx = this.data.msgs.length - 1;
        this._history.pop();
        this.setData({
          ['msgs[' + idx + ']']: {
            role: 'ai',
            text: (e && e.message) || 'AI 开小差了，稍后再试',
            loading: false,
            goto: null
          },
          sending: false,
          scrollInto: 'msg-' + idx
        });
      }
    },

    /** 跳到题单页（AI 选定的 tag × band） */
    onGoto(e) {
      const g = e.currentTarget.dataset.goto;
      if (!g) return;
      const parts = [];
      if (g.tag) parts.push('tag=' + g.tag);
      if (g.band) parts.push('band=' + g.band);
      parts.push('tagName=' + encodeURIComponent(g.tagName || '全部知识点'));
      parts.push('bandName=' + encodeURIComponent(g.bandName || '全部难度'));
      this.setData({ open: false });
      wx.navigateTo({ url: '/pages/algo/problems?' + parts.join('&') });
    }
  }
});
