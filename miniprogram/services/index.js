/**
 * 前端业务服务层：页面只与 services 交互，不直接 callFunction
 * 后端新增接口时，在这里加一个方法即可，页面无需感知通信细节
 */
const { request } = require('../utils/request');
const { DOMAIN } = require('../constants/index');

// ============ 认证 ============
const auth = {
  login: () => request(DOMAIN.AUTH, 'login', {}, { silent: true }),
  submitRealname: (data) => request(DOMAIN.AUTH, 'submitRealname', data, { loading: '提交中' }),
  getMyApplication: () => request(DOMAIN.AUTH, 'myApplication', {}, { silent: true }),
  // 教师/管理员
  pendingList: (params) => request(DOMAIN.AUTH, 'pendingList', params, { silent: true }),
  review: (data) => request(DOMAIN.AUTH, 'review', data, { loading: '处理中' }),
  // 系统初始化（幂等，viewOnly=true 时只读不写）
  bootstrap: (params) => request(DOMAIN.AUTH, 'bootstrap', params, { silent: true })
};

// ============ 用户 ============
const user = {
  getProfile: () => request(DOMAIN.USER, 'profile', {}, { silent: true }),
  updateProfile: (data) => request(DOMAIN.USER, 'update', data, { loading: '保存中' }),
  // 完善个人资料：教师/管理员填姓名即通过；学生走学号认证
  completeProfile: (data) => request(DOMAIN.USER, 'completeProfile', data, { loading: '保存中' }),
  list: (params) => request(DOMAIN.USER, 'list', params, { silent: true }),
  setRole: (data) => request(DOMAIN.USER, 'setRole', data, { loading: '处理中' }),
  // 意见反馈：用户提交 → 教师/管理员回复
  submitFeedback: (data) => request(DOMAIN.USER, 'submitFeedback', data, { loading: '提交中' }),
  myFeedbacks: (params) => request(DOMAIN.USER, 'myFeedbacks', params, { silent: true }),
  feedbackList: (params) => request(DOMAIN.USER, 'feedbackList', params, { silent: true }),
  replyFeedback: (data) => request(DOMAIN.USER, 'replyFeedback', data, { loading: '提交中' }),
  // 红点计数：教师=待处理数 / 学生=未读回复数；标记回复已读
  feedbackBadge: () => request(DOMAIN.USER, 'feedbackBadge', {}, { silent: true }),
  markFeedbacksRead: () => request(DOMAIN.USER, 'markFeedbacksRead', {}, { silent: true })
};


// ============ 学习路线与成长记录 ============
const learn = {
  // 路线
  templates: (params) => request(DOMAIN.LEARN, 'templates', params, { silent: true }),
  createRoadmap: (data) => request(DOMAIN.LEARN, 'createRoadmap', data, { loading: '生成中' }),
  myRoadmap: () => request(DOMAIN.LEARN, 'myRoadmap', {}, { silent: true }),
  roadmapDetail: (params) => request(DOMAIN.LEARN, 'roadmapDetail', params, { silent: true }),
  checkTask: (data) => request(DOMAIN.LEARN, 'checkTask', data, { loading: '提交中' }),
  // 成长记录（学习过程留痕）
  addLog: (data) => request(DOMAIN.LEARN, 'addLog', data, { loading: '保存中' }),
  logList: (params) => request(DOMAIN.LEARN, 'logList', params, { silent: true }),
  logDetail: (params) => request(DOMAIN.LEARN, 'logDetail', params, { silent: true }),
  commentLog: (data) => request(DOMAIN.LEARN, 'commentLog', data, { loading: '提交中' }),
  // 成果
  addAchievement: (data) => request(DOMAIN.LEARN, 'addAchievement', data, { loading: '保存中' }),
  achievements: (params) => request(DOMAIN.LEARN, 'achievements', params, { silent: true }),
  // 学习任务：教师布置 → 学生提交 → 教师批阅
  publishTask: (data) => request(DOMAIN.LEARN, 'publishTask', data, { loading: '发布中' }),
  taskList: (params) => request(DOMAIN.LEARN, 'taskList', params, { silent: true }),
  taskDetail: (params) => request(DOMAIN.LEARN, 'taskDetail', params, { silent: true }),
  submitTask: (data) => request(DOMAIN.LEARN, 'submitTask', data, { loading: '提交中' }),
  reviewSubmission: (data) => request(DOMAIN.LEARN, 'reviewSubmission', data, { loading: '提交中' }),
  closeTask: (data) => request(DOMAIN.LEARN, 'closeTask', data, { loading: '处理中' })
};

// ============ 竞赛 ============
const contest = {
  list: (params) => request(DOMAIN.CONTEST, 'list', params, { silent: true }),
  detail: (params) => request(DOMAIN.CONTEST, 'detail', params, { silent: true }),
  categories: () => request(DOMAIN.CONTEST, 'categories', {}, { silent: true }),
  // 我的竞赛
  myList: (params) => request(DOMAIN.CONTEST, 'myList', params, { silent: true }),
  follow: (data) => request(DOMAIN.CONTEST, 'follow', data, { loading: '处理中' }),
  updateProgress: (data) => request(DOMAIN.CONTEST, 'updateProgress', data, { loading: '保存中' }),
  // 教师/管理员维护（含赛事时间编辑）
  create: (data) => request(DOMAIN.CONTEST, 'create', data, { loading: '保存中' }),
  update: (data) => request(DOMAIN.CONTEST, 'update', data, { loading: '保存中' }),
  remove: (data) => request(DOMAIN.CONTEST, 'remove', data, { loading: '处理中' }),
  // 竞赛指导文章
  guides: (params) => request(DOMAIN.CONTEST, 'guides', params, { silent: true }),
  addGuide: (data) => request(DOMAIN.CONTEST, 'addGuide', data, { loading: '发布中' }),
  // 导入学校 83 号文赛事数据（管理员，幂等；force=true 覆盖重导）
  importSeed: (params) => request(DOMAIN.CONTEST, 'importSeed', params, { loading: '导入中' })
};

// ============ 通知与赛事公告 ============
const announce = {
  list: (params) => request(DOMAIN.ANNOUNCE, 'list', params, { silent: true }),
  detail: (params) => request(DOMAIN.ANNOUNCE, 'detail', params, { silent: true }),
  // 教师发布
  publish: (data) => request(DOMAIN.ANNOUNCE, 'publish', data, { loading: '发布中' }),
  myList: (params) => request(DOMAIN.ANNOUNCE, 'myList', params, { silent: true }),
  remove: (data) => request(DOMAIN.ANNOUNCE, 'remove', data, { loading: '删除中' }),
  unreadCount: () => request(DOMAIN.ANNOUNCE, 'unreadCount', {}, { silent: true })
};

// ============ 项目（学生项目管理与分享） ============
const project = {
  list: (params) => request(DOMAIN.PROJECT, 'list', params, { silent: true }),
  detail: (params) => request(DOMAIN.PROJECT, 'detail', params, { silent: true }),
  create: (data) => request(DOMAIN.PROJECT, 'create', data, { loading: '创建中' }),
  update: (data) => request(DOMAIN.PROJECT, 'update', data, { loading: '保存中' }),
  // 删除：项目主人或管理员
  remove: (data) => request(DOMAIN.PROJECT, 'remove', data, { loading: '删除中' }),
  // 项目进展
  addUpdate: (data) => request(DOMAIN.PROJECT, 'addUpdate', data, { loading: '发布中' }),
  removeUpdate: (data) => request(DOMAIN.PROJECT, 'removeUpdate', data, { loading: '删除中' }),
  // 留言
  comments: (params) => request(DOMAIN.PROJECT, 'comments', params, { silent: true }),
  addComment: (data) => request(DOMAIN.PROJECT, 'addComment', data, { loading: '发送中' }),
  removeComment: (data) => request(DOMAIN.PROJECT, 'removeComment', data, { loading: '删除中' }),
  // 教师推荐
  feature: (data) => request(DOMAIN.PROJECT, 'feature', data, { loading: '处理中' })
};

// ============ 智能体（预留） ============
/**
 * 后续接入大模型 API 时，只需后端 agent 云函数对接，
 * 前端这几个方法保持不变
 */
const agent = {
  /** 通用对话 */
  chat: (data) => request(DOMAIN.AGENT, 'chat', data, { loading: '思考中' }),
  /** AI 生成学习路线建议 */
  suggestRoadmap: (data) => request(DOMAIN.AGENT, 'suggestRoadmap', data, { loading: '生成中' }),
  /** AI 竞赛指导建议 */
  contestAdvice: (data) => request(DOMAIN.AGENT, 'contestAdvice', data, { loading: '分析中' }),
  /** AI 点评学习记录 */
  reviewLog: (data) => request(DOMAIN.AGENT, 'reviewLog', data, { loading: '点评中' }),
  /** 会话历史 */
  history: (params) => request(DOMAIN.AGENT, 'history', params, { silent: true })
};

module.exports = {
  auth,
  user,
  learn,
  contest,
  announce,
  project,
  agent
};
