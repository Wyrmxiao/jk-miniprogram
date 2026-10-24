/**
 * 路由表：action -> handler
 * 新增接口时，只需要在对应 handler 文件里加一个导出，再在这里注册一行
 */
const auth = require('./handlers/auth');

module.exports = {
  login: auth.login,
  submitRealname: auth.submitRealname,
  myApplication: auth.myApplication,
  pendingList: auth.pendingList,
  review: auth.review,
  bootstrap: auth.bootstrap
};
