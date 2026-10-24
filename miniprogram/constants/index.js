/**
 * 全局常量
 * 与后端各云函数域保持一致，改动需同步
 */

/** 角色 */
const ROLE = {
  GUEST: 'guest',
  STUDENT: 'student',
  TEACHER: 'teacher',
  ADMIN: 'admin'
};

const ROLE_TEXT = {
  guest: '游客',
  student: '学生',
  teacher: '教师',
  admin: '管理员'
};

/** 认证状态 */
const AUTH_STATUS = {
  NONE: 'none',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

const AUTH_STATUS_TEXT = {
  none: '未认证',
  pending: '审核中',
  approved: '已认证',
  rejected: '未通过'
};

/** 学科竞赛级别（依据学校《学生学科竞赛管理办法（修订）》第五条） */
const CONTEST_LEVEL = {
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D'
};

const CONTEST_LEVEL_TEXT = {
  A: 'A类·国家级榜单',
  B: 'B类·省部级/赛区',
  C: 'C类·省市及以上',
  D: 'D类·校级'
};

/** 学科分类（依据办法第四条） */
const CONTEST_CATEGORY = {
  HARDWARE: 'hardware',
  SCIENCE_OTHER: 'scienceOther',
  HUMANITY: 'humanity'
};

const CONTEST_CATEGORY_TEXT = {
  hardware: '理工类（硬件类）',
  scienceOther: '理工类（其他类）',
  humanity: '人文社科类'
};

/** 奖励等次 */
const AWARD_RANK = {
  SPECIAL: 'special',
  FIRST: 'first',
  SECOND: 'second',
  THIRD: 'third'
};

const AWARD_RANK_TEXT = {
  special: '特等奖',
  first: '一等奖',
  second: '二等奖',
  third: '三等奖'
};

/** 学习方向（能力雷达六维） */
const DIRECTIONS = [
  { key: 'frontend', name: '前端开发' },
  { key: 'backend', name: '后端开发' },
  { key: 'algorithm', name: '算法竞赛' },
  { key: 'ai', name: '人工智能' },
  { key: 'security', name: '网络安全' },
  { key: 'embedded', name: '嵌入式/硬件' }
];

/** 技术方向文案映射（项目卡片/详情用） */
const DIRECTION_TEXT = {
  frontend: '前端开发',
  backend: '后端开发',
  algorithm: '算法竞赛',
  ai: '人工智能',
  security: '网络安全',
  embedded: '嵌入式/硬件'
};

/** 项目阶段 */
const PROJECT_STAGE = {
  IDEA: 'idea',
  DOING: 'doing',
  DONE: 'done',
  AWARDED: 'awarded'
};

const PROJECT_STAGE_TEXT = {
  idea: '构思中',
  doing: '进行中',
  done: '已完成',
  awarded: '获奖作品'
};

/** 公告类型 */
const ANNOUNCE_TYPE = {
  NOTICE: 'notice',
  CONTEST: 'contest'
};

const ANNOUNCE_TYPE_TEXT = {
  notice: '通知',
  contest: '赛事公告'
};

/** 我的竞赛状态 */
const MY_CONTEST_STATUS = {
  WATCH: 'watch',
  SIGNED: 'signed',
  PREPARING: 'preparing',
  FINISHED: 'finished'
};

const MY_CONTEST_STATUS_TEXT = {
  watch: '关注',
  signed: '已报名',
  preparing: '备赛中',
  finished: '已完赛'
};

/** 后端服务域：与云函数目录名一一对应，新增域需同步后端 */
const DOMAIN = {
  AUTH: 'auth',
  USER: 'user',
  LEARN: 'learn',
  CONTEST: 'contest',
  PROJECT: 'project',
  ANNOUNCE: 'announce',
  AGENT: 'agent'
};

/** 本地缓存 key */
const STORAGE_KEY = {
  PROFILE: 'csic_profile',
  TOKEN: 'csic_token',
  LAST_ROUTE: 'csic_last_route',
  /** 系统初始化标记，清除后下次启动会重新执行初始化流程 */
  DB_INITED: 'csic_db_inited'
};

module.exports = {
  ROLE,
  ROLE_TEXT,
  AUTH_STATUS,
  AUTH_STATUS_TEXT,
  CONTEST_LEVEL,
  CONTEST_LEVEL_TEXT,
  CONTEST_CATEGORY,
  CONTEST_CATEGORY_TEXT,
  AWARD_RANK,
  AWARD_RANK_TEXT,
  DIRECTIONS,
  DIRECTION_TEXT,
  PROJECT_STAGE,
  PROJECT_STAGE_TEXT,
  ANNOUNCE_TYPE,
  ANNOUNCE_TYPE_TEXT,
  MY_CONTEST_STATUS,
  MY_CONTEST_STATUS_TEXT,
  DOMAIN,
  STORAGE_KEY
};
