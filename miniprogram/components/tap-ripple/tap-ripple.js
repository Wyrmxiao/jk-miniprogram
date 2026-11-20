/**
 * 点击涟漪（tap ripple）
 *
 * 用法（页面接入两步）：
 *   1. 页面根节点加监听：<view class="page" bindtap="onTapFx"> …
 *   2. 页面里放组件实例：<tap-ripple id="tapFx" />
 *   3. 页面 js 加方法：
 *        onTapFx(e) {
 *          const fx = this.selectComponent('#tapFx');
 *          if (fx) fx.show(e);
 *        }
 *
 * 原理：点击（bindtap，滚动不触发）时取触点坐标，在原地渲染一个
 * 浅灰小圆，CSS 动画放大并淡出（约半秒），随后移除节点。
 * 圆点为 fixed 定位 + pointer-events:none，不遮挡任何点击。
 */
let uid = 0;

const LIFE = 520; // 与 CSS 动画时长一致，动画结束后移除节点
const MAX = 8; // 同屏最多涟漪数，防止极端连点堆积

Component({
  data: {
    ripples: []
  },

  methods: {
    /** 由页面 onTapFx 调用，e 为根节点收到的 tap 事件 */
    show(e) {
      const t = e && e.changedTouches && e.changedTouches[0];
      if (!t) return;
      const id = ++uid;
      const ripple = { id, x: t.clientX, y: t.clientY };
      const ripples = this.data.ripples.concat(ripple).slice(-MAX);
      this.setData({ ripples });
      setTimeout(() => {
        this.setData({
          ripples: this.data.ripples.filter((r) => r.id !== id)
        });
      }, LIFE);
    }
  }
});
