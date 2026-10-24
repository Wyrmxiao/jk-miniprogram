/**
 * 路由表：action -> handler
 * 新增接口时，只需要在对应 handler 文件里加一个导出，再在这里注册一行
 */
const contest = require('./handlers/contest');

module.exports = {
  list: contest.list,
  detail: contest.detail,
  categories: contest.categories,
  myList: contest.myList,
  follow: contest.follow,
  updateProgress: contest.updateProgress,
  create: contest.create,
  update: contest.update,
  remove: contest.remove,
  guides: contest.guides,
  addGuide: contest.addGuide,
  importSeed: contest.importSeed
};
