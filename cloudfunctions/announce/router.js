/**
 * 路由表：action -> handler
 * 新增接口时，只需要在对应 handler 文件里加一个导出，再在这里注册一行
 */
const announce = require('./handlers/announce');

module.exports = {
  list: announce.list,
  detail: announce.detail,
  publish: announce.publish,
  myList: announce.myList,
  remove: announce.remove,
  unreadCount: announce.unreadCount
};
