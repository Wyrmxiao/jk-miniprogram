# Apple 风格 UI 设计提示词（微信小程序落地版）

> 用途：把 Apple HIG（Human Interface Guidelines）翻译成小程序可执行的验收标准。
> 任何新页面/改版，先对照本文件自检；AI 生成 UI 时，把「核心提示词」整段粘贴给它。
> 设计哲学三根柱子：**Clarity 清晰 / Deference 谦让 / Depth 深度**。

---

## 一、核心提示词（直接复制使用）

```
你是微信小程序的 iOS 风格 UI 工程师。按以下规范输出 WXML/WXSS，禁止自由发挥：

【色彩】iOS 系统色板：主蓝 #007AFF，学生端成长绿 #34C759，教师端职能蓝 #007AFF，
警示橙 #FF9500，危险红 #FF3B30，信息紫 #AF52DE；页面背景用系统分组背景 #F2F2F7，
卡片纯白 #FFFFFF；文字主色 #1C1C1E，次级 rgba(60,60,67,0.6)，三级 rgba(60,60,67,0.3)。
禁止使用高饱和渐变做大面积背景，禁止彩色投影。

【字阶】Large Title 48rpx/700（页面大标题），Title 40rpx/600（区块标题），
Headline 32rpx/600（卡片标题），Body 28rpx/400（正文），Caption 24rpx/400（辅助说明），
Micro 22rpx/400（时间戳等）。行高 1.5~1.7。数字用等宽感知（font-variant-numeric: tabular-nums）。

【布局】一屏一件事；卡片圆角 24rpx，卡片间距 24rpx，卡片内边距 32rpx，
分组间距 48rpx；内容左右安全边距 32rpx；所有可点击区域不小于 88rpx 高。

【组件】
1. 页面头部：Large Title 大标题 + 一行副标题，品牌区可用低饱和渐变（仅限头部），
   不得使用重阴影和描边。
2. 列表用 iOS「 inset grouped 」风格：白色圆角卡片分组，行高 96rpx，
   行间用 2rpx 分割线（左缩进 32rpx，最后一行无分割线），右侧导航箭头 › 用浅灰。
3. 选项卡用分段控件（segmented control）：浅灰底槽 #E9E9EB，选中项白底 + 阴影 + 圆角 16rpx，
   高度 72rpx，动画 200ms。
4. 按钮：主按钮=品牌色填充胶囊（高 88rpx，字重 600，白色文字）；次按钮=同色 10% 透明度底 +
   同色文字；危险操作=红色文字 + 红色 10% 底。所有按钮 hover-class 按下缩放至 0.97，
   过渡 120ms。
5. 弹层：底部弹出，顶部把手（72rpx×8rpx 圆角 #E2E6EE），圆角 28rpx 28rpx 0 0，
   遮罩 rgba(0,0,0,0.4)，内容区最大高度 84vh 可滚动；输入框 focus 时自动避让键盘
   （cursor-spacing，input 120 / textarea 240）。
6. 徽章/标签：胶囊形，浅色底 + 同色系文字，字号 22rpx，禁止描边。
7. 空状态：居中，72rpx 表情符号 + 一行 26rpx 灰色说明，禁止大红叉和警告图标。
8. 角色区分：学生端操作控件用成长绿 #34C759，教师端用职能蓝 #007AFF，
   页面顶部放一条低饱和度角色条（rolebar）说明当前身份与页面用途。

【材质】毛玻璃 backdrop-filter: blur(24rpx) saturate(180%) 只用于浮动层
（弹层把手区、悬浮按钮、固定操作条）；阴影仅一层柔和投影
0 8rpx 24rpx rgba(28,28,30,0.06)，禁止多层投影叠加。

【动效】只做三种：按下缩放 0.97（120ms）、弹层/开关淡入滑动（240ms）、
列表加载骨架屏。禁止弹跳、旋转、视差等装饰性动画。

【文案】按钮文字用动词（保存记录/发布公告/开始测算）；说明文字一行说清，
不超过 20 字；错误提示用 toast，不打断流程；危险操作（删除/下架）才用模态确认。

【禁忌】不用暗色模式专用配色（跟随系统时保证对比度）；不用超过 2 种字体；
不用图标+文字+角标的三重装饰；一页不超过 3 个强调色元素。
```

---

## 二、检查清单（自检用，逐条打勾）

| # | 检查项 | 标准 |
|---|--------|------|
| 1 | 首屏 3 秒测试 | 新用户不看文字就知道这页干什么 |
| 2 | 大字标题 | 每个页面顶部有 48rpx 粗体标题 |
| 3 | 留白节奏 | 卡片间 24rpx、分组间 48rpx，没有挤在一起的元素 |
| 4 | 点击反馈 | 每个可点区域都有 hover-class 缩放反馈 |
| 5 | 键盘避让 | 每个输入框都有 cursor-spacing，弹层输入不遮挡 |
| 6 | 角色一致 | 学生端绿、教师端蓝，同页不混用 |
| 7 | 色彩纪律 | 强调色元素 ≤ 3 个/屏，其余用灰阶 |
| 8 | 文案动词 | 按钮都是动作，不是名词 |
| 9 | 空状态友好 | 空列表有说明，不裸奔 |
| 10 | 危险操作确认 | 删除/下架必须二次确认 |

---

## 三、本项目落地映射

| Apple 概念 | 本项目实现 | 位置 |
|---|---|---|
| System colors | `styles/variables.wxss` 色板 | 全局 |
| Type scale | `--font-*` 变量（48/40/32/28/24/22rpx） | variables.wxss |
| Inset grouped list | `.group` + `.cell` + `.cell__chevron` | mixins.wxss |
| Segmented control | `.seg` + `.seg__item--on` | mixins.wxss |
| Large title hero | `.hero`（低饱和渐变，仅头部） | mixins.wxss |
| Materials (blur) | `.glass`（backdrop-filter） | mixins.wxss |
| Press feedback | `.press`（hover-class 缩放 0.97） | mixins.wxss |
| Bottom sheet | `.sheet` + `.sheet__grip` | mixins.wxss |
| 角色条 | `.rolebar--student` / `.rolebar--teacher` | mixins.wxss |
| 键盘避让 | cursor-spacing 120/240 + onKeyboardHeightChange | 各表单页 |

## 四、变更记录

- 2026-10-16：首版。基于 Apple HIG（iOS 17 设计语言）与微信小程序实际能力取交集：
  原生组件限制（无真毛玻璃 tabBar、字体仅系统字体）处用小程序最接近的方案替代。
