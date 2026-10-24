/**
 * 学习域 · 路线模板
 * 六个方向对应能力雷达六维，与 constants.DIRECTIONS 一致
 * 模板为内置默认数据，首次调用 templates 时按需写入数据库
 */
const DIRECTIONS = ['frontend', 'backend', 'algorithm', 'ai', 'security', 'embedded'];

const TEMPLATES = [
  {
    key: 'frontend',
    name: '前端开发路线',
    direction: 'frontend',
    level: 'beginner',
    summary: '从 HTML/CSS 起步，到框架工程化与项目实战',
    stages: [
      {
        name: '入门',
        goal: '掌握网页结构与样式，能还原静态页面',
        tasks: [
          { name: 'HTML 语义化与表单', hours: 8 },
          { name: 'CSS 布局：Flex 与 Grid', hours: 12 },
          { name: 'JavaScript 基础语法', hours: 20 }
        ]
      },
      {
        name: '进阶',
        goal: '掌握框架与工程化，能做组件化开发',
        tasks: [
          { name: '小程序原生开发', hours: 24 },
          { name: 'Vue/React 组件化', hours: 30 },
          { name: '构建工具与模块化', hours: 12 }
        ]
      },
      {
        name: '实战',
        goal: '独立交付完整项目',
        tasks: [
          { name: '完成一个完整项目', hours: 40 },
          { name: '性能优化与兼容性', hours: 16 }
        ]
      },
      {
        name: '竞赛',
        goal: '参加中国大学生计算机设计大赛等赛事',
        tasks: [{ name: '组队并选题参赛', hours: 30 }]
      }
    ]
  },
  {
    key: 'backend',
    name: '后端开发路线',
    direction: 'backend',
    level: 'beginner',
    summary: '从一门语言到数据库、接口与分布式实践',
    stages: [
      {
        name: '入门',
        goal: '掌握一门后端语言与基本数据结构',
        tasks: [
          { name: 'Java/Python 语法基础', hours: 30 },
          { name: '数据结构与常用算法', hours: 24 }
        ]
      },
      {
        name: '进阶',
        goal: '掌握数据库与接口开发',
        tasks: [
          { name: 'MySQL 与 SQL 优化', hours: 20 },
          { name: 'RESTful 接口开发', hours: 24 },
          { name: 'Redis 缓存', hours: 12 }
        ]
      },
      {
        name: '实战',
        goal: '完成可部署的服务端项目',
        tasks: [
          { name: '项目部署与容器化', hours: 20 },
          { name: '接口安全与鉴权', hours: 12 }
        ]
      },
      {
        name: '竞赛',
        goal: '参加中国软件杯、计算机系统能力大赛',
        tasks: [{ name: '组队参赛', hours: 30 }]
      }
    ]
  },
  {
    key: 'algorithm',
    name: '算法竞赛路线',
    direction: 'algorithm',
    level: 'beginner',
    summary: '面向蓝桥杯、ACM-ICPC、天梯赛的系统训练',
    stages: [
      {
        name: '入门',
        goal: '掌握基础算法与复杂度分析',
        tasks: [
          { name: '排序与二分', hours: 16 },
          { name: '前缀和与差分', hours: 10 },
          { name: '递归与分治', hours: 12 }
        ]
      },
      {
        name: '进阶',
        goal: '掌握图论、动态规划与数据结构',
        tasks: [
          { name: '栈队列链表与树', hours: 24 },
          { name: '图论最短路与生成树', hours: 24 },
          { name: '动态规划入门到进阶', hours: 40 }
        ]
      },
      {
        name: '实战',
        goal: '稳定刷题与模拟赛',
        tasks: [
          { name: '刷题 200 题以上', hours: 100 },
          { name: '参加线上模拟赛', hours: 20 }
        ]
      },
      {
        name: '竞赛',
        goal: '蓝桥杯/ACM-ICPC 获奖',
        tasks: [{ name: '参加省级及以上赛事', hours: 30 }]
      }
    ]
  },
  {
    key: 'ai',
    name: '人工智能路线',
    direction: 'ai',
    level: 'beginner',
    summary: '数学基础、机器学习到深度学习与大模型应用',
    stages: [
      {
        name: '入门',
        goal: '补齐数学与编程基础',
        tasks: [
          { name: '线性代数与概率统计', hours: 24 },
          { name: 'Python 数据处理', hours: 20 }
        ]
      },
      {
        name: '进阶',
        goal: '掌握机器学习与深度学习',
        tasks: [
          { name: '经典机器学习算法', hours: 30 },
          { name: '神经网络与 PyTorch', hours: 40 }
        ]
      },
      {
        name: '实战',
        goal: '完成一个可演示的 AI 应用',
        tasks: [
          { name: '图像或文本项目实战', hours: 40 },
          { name: '大模型应用开发', hours: 20 }
        ]
      },
      {
        name: '竞赛',
        goal: '参加 AI 大模型创新应用大赛等',
        tasks: [{ name: '组队参赛', hours: 30 }]
      }
    ]
  },
  {
    key: 'security',
    name: '网络安全路线',
    direction: 'security',
    level: 'beginner',
    summary: '从网络基础到 CTF 实战与防御体系',
    stages: [
      {
        name: '入门',
        goal: '掌握网络与操作系统基础',
        tasks: [
          { name: '计算机网络与协议', hours: 20 },
          { name: 'Linux 基础与常用命令', hours: 16 }
        ]
      },
      {
        name: '进阶',
        goal: '掌握常见漏洞原理与利用',
        tasks: [
          { name: 'Web 安全基础', hours: 30 },
          { name: '渗透测试流程与工具', hours: 24 }
        ]
      },
      {
        name: '实战',
        goal: 'CTF 竞赛与靶场练习',
        tasks: [
          { name: 'CTF 入门题型训练', hours: 50 },
          { name: '内网与安全防御', hours: 20 }
        ]
      },
      {
        name: '竞赛',
        goal: '参加全国大学生信息安全竞赛',
        tasks: [{ name: '组队参赛', hours: 30 }]
      }
    ]
  },
  {
    key: 'embedded',
    name: '嵌入式与硬件路线',
    direction: 'embedded',
    level: 'beginner',
    summary: '面向电子设计、智能车、嵌入式芯片等硬件类赛事',
    stages: [
      {
        name: '入门',
        goal: '掌握电路与单片机基础',
        tasks: [
          { name: '电路与模电数电基础', hours: 24 },
          { name: 'C 语言与单片机', hours: 30 }
        ]
      },
      {
        name: '进阶',
        goal: '掌握外设驱动与实时系统',
        tasks: [
          { name: '传感器与通信外设', hours: 24 },
          { name: 'RTOS 实时系统', hours: 20 }
        ]
      },
      {
        name: '实战',
        goal: '完成一个完整硬件作品',
        tasks: [
          { name: '硬件项目完整实现', hours: 50 },
          { name: 'PCB 设计与焊接调试', hours: 20 }
        ]
      },
      {
        name: '竞赛',
        goal: '参加电子设计竞赛、智能汽车竞赛',
        tasks: [{ name: '组队参赛', hours: 40 }]
      }
    ]
  }
];

module.exports = { TEMPLATES, DIRECTIONS };
