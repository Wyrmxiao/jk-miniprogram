/**
 * 路由表：action -> handler
 * 新增接口时，只需要在对应 handler 文件里加一个导出，再在这里注册一行
 */
const user = require('./handlers/user');

module.exports = {
  profile: user.profile,
  update: user.update,
  completeProfile: user.completeProfile,
  list: user.list,
  setRole: user.setRole
};
