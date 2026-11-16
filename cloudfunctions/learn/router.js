/**
 * 路由表：action -> handler
 * 新增接口时，只需要在对应 handler 文件里加一个导出，再在这里注册一行
 */
const learn = require('./handlers/learn');
const algo = require('./handlers/algo');
const qa = require('./handlers/qa');
const report = require('./handlers/report');
const klass = require('./handlers/klass');

module.exports = {
  templates: learn.templates,
  createRoadmap: learn.createRoadmap,
  myRoadmap: learn.myRoadmap,
  roadmapDetail: learn.roadmapDetail,
  checkTask: learn.checkTask,
  addLog: learn.addLog,
  logList: learn.logList,
  logDetail: learn.logDetail,
  commentLog: learn.commentLog,
  addAchievement: learn.addAchievement,
  achievements: learn.achievements,
  // 学习任务（教师布置 → 学生提交 → 教师批阅）
  publishTask: learn.publishTask,
  taskList: learn.taskList,
  taskDetail: learn.taskDetail,
  submitTask: learn.submitTask,
  reviewSubmission: learn.reviewSubmission,
  closeTask: learn.closeTask,
  // 算法训练（题库驱动刷题 + 打卡统计）
  algoProblemModules: algo.algoProblemModules,
  algoProblemList: algo.algoProblemList,
  algoProblemDetail: algo.algoProblemDetail,
  algoProblemContent: algo.algoProblemContent,
  algoMarkProblem: algo.algoMarkProblem,
  algoCheckIn: algo.algoCheckIn,
  algoRecords: algo.algoRecords,
  algoRecordDetail: algo.algoRecordDetail,
  algoRemove: algo.algoRemove,
  algoUpdateNote: algo.algoUpdateNote,
  algoComment: algo.algoComment,
  algoStats: algo.algoStats,
  algoSetGoal: algo.algoSetGoal,
  algoTeacherOverview: algo.algoTeacherOverview,
  algoRecalc: algo.algoRecalc,
  // 学习问答（学生提问 → 师生解答 → 采纳 / 标记解决）
  qaList: qa.qaList,
  qaStats: qa.qaStats,
  qaDetail: qa.qaDetail,
  qaAsk: qa.qaAsk,
  qaAnswer: qa.qaAnswer,
  qaAccept: qa.qaAccept,
  qaSetStatus: qa.qaSetStatus,
  qaRemoveQuestion: qa.qaRemoveQuestion,
  qaRemoveAnswer: qa.qaRemoveAnswer,
  // 每周学习汇报（学生提交 → 教师按周查看 / 导出 Excel）
  reportMine: report.reportMine,
  reportSave: report.reportSave,
  reportMyWeeks: report.reportMyWeeks,
  reportWeeks: report.reportWeeks,
  reportList: report.reportList,
  reportExport: report.reportExport,
  // 班级（师生归属：老师建班，学生扫码/输码入班，汇报按班投递）
  classCreate: klass.classCreate,
  classList: klass.classList,
  classDetail: klass.classDetail,
  classJoin: klass.classJoin,
  classQuit: klass.classQuit,
  classDissolve: klass.classDissolve,
  classRemoveMember: klass.classRemoveMember,
  classUpdate: klass.classUpdate,
  classQr: klass.classQr,
  classMine: klass.classMine
};
