# 计科创新中心小程序

重庆移通学院计算机学院学生社团「计科创新中心」—— 学生计算机能力个性化培养平台。

## 环境状态

| 项 | 值 |
|---|---|
| 云环境 ID | `cloud1-d5gr2v7tz34fafa7c`（已写入 `miniprogram/app.js`） |
| 云函数 | 7 个已部署，见下方一键部署命令 |
| 数据库 | 22 个集合已建，113 项赛事已入库 |
| 管理员 | 第一位使用者自动成为管理员；后续角色由管理员在「我的 → 用户与权限」分配 |

## 快速开始

> **Clone 后第一步**：本仓库不含 `project.config.json`（避免泄露 AppID）。
> 请在微信开发者工具中「导入项目」选择本目录，使用自己的 AppID 生成配置，
> 并将云环境 ID 改为你所在环境（默认值见下表）。

1. 微信开发者工具打开本目录，首次编译即自动完成初始化
   （建集合 → 指定管理员 → 导入竞赛库，结果打印在控制台）
2. 真机预览后，由首位管理员在「我的 → 用户与权限」中把真机用户设为 `admin`
3. 管理员在同一页面把两位教师设为 `teacher`
4. 按 `docs/数据库初始化.md` 收紧索引与安全规则

### 命令行部署与自检

```bash
# 部署全部云函数
cli.bat cloud functions deploy --project <项目路径> \
  --env cloud1-d5gr2v7tz34fafa7c \
  --names auth user learn contest announce project agent --remote-npm-install

# 开启自动化端口后，用联机工具操作（需 npm i -D miniprogram-automator）
cli.bat auto --project <项目路径> --auto-port 9420
node tools/remote.js verify    # 全接口自检
node tools/remote.js init      # 幂等初始化
node tools/remote.js smoke     # 公告链路冒烟
```

### 代码校验与推送

```bash
# 全站校验：页面四件套 / WXML 配平 / 绑定方法调用 / 跳转注册对齐 /
# WXSS @import / JS require 路径
node tools/check_all.js

# git 端点被拦截时（如代理拦 CONNECT），用 GitHub REST API 推送本地提交。
# 令牌取自凭据管理器，不要写进命令行：
GH_TOKEN=$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill | sed -n 's/^password=//p') \
  node tools/push_via_api.js main
# 推完对齐：git fetch && git reset --hard origin/main
```

## 目录结构

```
miniprogram/
├── pages/            主包页面（首页/学习/竞赛/项目/我的）
├── pkgAuth/          分包：登录、实名认证、隐私指引
├── pkgContest/       分包：赛事维护
├── pkgWork/          分包：发布、任务、记录、用户与权限
├── services/         前端服务层，页面只与它交互
├── utils/            通信、登录态、工具函数
├── constants/        全局常量（与后端保持一致）
├── styles/           设计变量与通用样式
└── assets/           图标与图片

cloudfunctions/
├── auth/ user/ learn/ contest/ project/ announce/ agent/
│   ├── index.js        统一入口：按 action 分发
│   ├── router.js       路由表：新增接口注册一行
│   ├── handlers/       业务处理器
│   ├── middleware/     上下文与鉴权
│   ├── services/       领域服务（如路线模板、LLM）
│   └── utils/response.js  统一响应

docs/
├── 需求与架构方案.md    整体架构、扩展方式、合规清单
└── 数据库初始化.md      集合、索引、安全规则、初始化方式

tools/
├── remote.js            联机工具：初始化 / 自检 / 冒烟 / 单接口调试
├── check_all.js         全站静态校验（四件套 / WXML / 跳转 / 引用路径）
├── push_via_api.js      git 端点不可用时，走 GitHub REST API 推送
├── deploy_cloudfunctions.sh  批量部署云函数
├── gen_competition_seed.py   由 83 号文生成竞赛种子数据
├── gen_tabbar_icons.py       生成 tabBar 图标
└── patch_debug.py            给云函数加 __debug 错误返回
```

## 扩展方式

新增一个接口只需三步：

1. `cloudfunctions/<域>/handlers/*.js` 加 async 方法
2. `cloudfunctions/<域>/router.js` 注册 `action: handler`
3. `miniprogram/services/index.js` 对应域加方法

页面调用 `services.<域>.<方法>(params)` 即可，通信层无需改动。

## 智能体接入

`cloudfunctions/agent` 已预留。配置 `LLM_BASE_URL / LLM_API_KEY / LLM_MODEL`
并实现 `services/llm.js` 的 `callLLM` 即可启用，前端 `services.agent` 无需改动。

## 相关文档

- 项目档案：`小程序项目档案.md`
- 架构方案：`docs/需求与架构方案.md`
- 数据库：`docs/数据库初始化.md`
- 微信云开发文档：https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html
