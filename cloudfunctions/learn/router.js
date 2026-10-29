/**
 * 路由表：action -> handler
 * 新增接口时，只需要在对应 handler 文件里加一个导出，再在这里注册一行
 */
const learn = require('./handlers/learn');
const algo = require('./handlers/algo');

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
  algoRecalc: algo.algoRecalc
};
