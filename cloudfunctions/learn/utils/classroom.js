/**
 * 班级公共层（后端）
 *
 * 集合：
 *   classes        { name, intro, code, ownerOpenid, memberCount, status, createdAt, updatedAt }
 *   class_members  { classId, openid, role: owner|member, joinedAt }
 *
 * 权限规则：
 *   - 班级成员（含创建者）可查看班级详情、邀请码、本班汇报
 *   - 创建者可改名、移除成员、解散班级
 *   - admin 不受限制
 */
const cloud = require('wx-server-sdk');
const { forbidden, notFound } = require('./response');
const { ensure } = require('./ensure');

const CLASS_COLL = 'classes';
const MEMBER_COLL = 'class_members';

const db = () => cloud.database();
const now = () => db().serverDate();

/** 集合自愈 */
async function ensureClassCollections() {
  await ensure(CLASS_COLL);
  await ensure(MEMBER_COLL);
}

/** 取班级，不存在则抛 404 */
async function getClass(classId) {
  const res = await db().collection(CLASS_COLL).doc(String(classId || '')).get().catch(() => ({ data: null }));
  const doc = res && res.data;
  if (!doc || doc.status === 'closed') throw notFound('班级不存在或已解散');
  return doc;
}

/** 取我在该班的成员记录，没有则 null */
async function getMember(classId, openid) {
  const res = await db()
    .collection(MEMBER_COLL)
    .where({ classId: String(classId), openid })
    .limit(1)
    .get()
    .catch(() => ({ data: [] }));
  return (res.data && res.data[0]) || null;
}

/** 要求可访问该班（成员或 admin），返回 { cls, member } */
async function requireClassAccess(classId, ctx) {
  if (!classId) throw notFound('缺少班级参数');
  const cls = await getClass(classId);
  if (ctx.isAdmin) return { cls, member: { role: 'admin' } };
  const member = await getMember(classId, ctx.openid);
  if (!member) throw forbidden('你还不是该班级成员');
  return { cls, member };
}

/** 要求是该班创建者 */
async function requireClassOwner(classId, ctx) {
  const { cls, member } = await requireClassAccess(classId, ctx);
  if (member.role !== 'owner' && !ctx.isAdmin) throw forbidden('只有班级创建者可以操作');
  return { cls, member };
}

/** 班级成员 openid 列表 */
async function memberOpenids(classId) {
  const res = await db()
    .collection(MEMBER_COLL)
    .where({ classId: String(classId) })
    .limit(1000)
    .get()
    .catch(() => ({ data: [] }));
  return (res.data || []).map((m) => m.openid);
}

/** 按 openid 批量取 users（自动分片，_.in 单次最多 100） */
async function usersByOpenids(openids) {
  const list = Array.from(new Set((openids || []).filter(Boolean)));
  const map = {};
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100);
    const res = await db()
      .collection('users')
      .where({ openid: db().command.in(chunk) })
      .limit(100)
      .get()
      .catch(() => ({ data: [] }));
    (res.data || []).forEach((u) => {
      map[u.openid] = u;
    });
  }
  return map;
}

/** 生成不易混淆的 6 位邀请码并确保唯一 */
const ALPHABET = 'ACDEFGHJKLMNPQRTUVWXY34679'; // 去掉 0/O/1/I/L/S/2/Z/5/B/8 等易混字符
async function genInviteCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    let code = '';
    for (let i = 0; i < 6; i += 1) {
      code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    const exists = await db().collection(CLASS_COLL).where({ code }).limit(1).get().catch(() => ({ data: [1] }));
    if (!exists.data || !exists.data.length) return code;
  }
  return `${Date.now()}`.slice(-6);
}

/**
 * 某班某周的汇报记录
 * 说明：classIds 为数组，等值查询即“数组包含该值”（云开发/MongoDB 语义）
 * 查询异常时降级为内存过滤，避免个别环境不支持导致页面空白
 */
async function reportsOfClassWeek(classId, weekKey) {
  try {
    const res = await db()
      .collection('weekly_reports')
      .where({ weekKey, classIds: String(classId) })
      .limit(500)
      .get();
    return res.data || [];
  } catch (e) {
    const res = await db()
      .collection('weekly_reports')
      .where({ weekKey })
      .limit(500)
      .get()
      .catch(() => ({ data: [] }));
    return (res.data || []).filter((r) => (r.classIds || []).includes(String(classId)));
  }
}

module.exports = {
  CLASS_COLL,
  MEMBER_COLL,
  reportsOfClassWeek,
  db,
  now,
  ensureClassCollections,
  getClass,
  getMember,
  requireClassAccess,
  requireClassOwner,
  memberOpenids,
  usersByOpenids,
  genInviteCode
};
