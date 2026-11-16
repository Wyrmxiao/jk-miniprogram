/**
 * 集合自愈：云开发中集合必须先存在才能写入
 * 新增业务集合时无需手工建表，调用处 ensure('xxx') 即可
 */
const cloud = require('wx-server-sdk');

const ready = {};

async function ensure(name) {
  if (ready[name]) return true;
  try {
    await cloud.database().createCollection(name);
  } catch (e) {
    // 已存在或其他原因均视为可继续（真正写入失败会在业务层抛出）
  }
  ready[name] = true;
  return true;
}

module.exports = { ensure };
