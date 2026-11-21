/**
 * 项目域 · 路由表
 * 新增接口：handlers 里加方法 → 这里注册一行 → services/index.js 加映射
 */
const project = require('./handlers/project');
const access = require('./handlers/access');

module.exports = {
  list: project.list,
  detail: project.detail,
  comments: project.comments,
  create: project.create,
  update: project.update,
  remove: project.remove,
  addUpdate: project.addUpdate,
  removeUpdate: project.removeUpdate,
  addComment: project.addComment,
  removeComment: project.removeComment,
  feature: project.feature,
  // 访问申请
  accessApply: access.apply,
  accessInbox: access.inbox,
  accessBadge: access.badge,
  accessRespond: access.respond,
  ownerProjects: access.ownerProjects
};
