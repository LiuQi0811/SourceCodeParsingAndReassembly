import { api, bash, chapter, ex, section } from './helpers';

// 第 1 章：快速开始
export const gettingStarted = chapter('getting-started', '快速开始', '认识 Node.js 运行时：安装、第一个程序与 REPL 交互环境', [
  section('basics', '基础认知', [
    api(
      'what-is-node',
      'Node.js 是什么',
      'Node.js = V8 引擎 + libuv 事件循环 + 内置模块',
      'Node.js 是一个基于 Chrome V8 引擎的 JavaScript 运行时。它采用事件驱动、非阻塞 I/O 模型，单线程即可轻松处理上万并发连接，是构建 Web 服务、CLI 工具、脚手架与桌面应用的理想选择。npm 是全球最大的软件包仓库，几乎任何需求都有现成方案。',
      [],
      [
        ex('确认运行时信息', [
          "console.log('Node 版本:', process.version);",
          "console.log('运行平台:', process.platform);",
          "console.log('CPU 架构:', process.arch);",
        ].join('\n'), 'Node 版本: v22.11.0\n运行平台: linux\nCPU 架构: x64'),
      ],
      [
        '单线程事件循环（Event Loop）负责调度，libuv 线程池处理文件 I/O、DNS 等阻塞操作，默认 4 个线程。',
        '非阻塞 I/O 使其擅长 I/O 密集型任务（网关、BFF、实时推送）；CPU 密集型任务会阻塞事件循环，应使用 worker_threads 拆分。',
        'Node.js 版本号遵循偶数为 LTS（长期支持）、奇数为 Current（尝鲜）的规则，生产环境始终选择 LTS。',
      ],
    ),
    api(
      'install',
      '安装与版本管理',
      'nvm install --lts',
      '强烈推荐使用 nvm（Node Version Manager）管理多版本 Node.js，可在不同项目间自由切换版本，避免全局环境污染。',
      [],
      [
        bash('安装 nvm 并启用 LTS', [
          '# 安装 nvm（Linux / macOS）',
          'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash',
          'source ~/.bashrc',
          '',
          '# 安装并使用最新 LTS 版本',
          'nvm install --lts',
          'nvm use --lts',
          'node -v',
        ].join('\n'), 'v22.11.0'),
        bash('查看与切换版本', [
          'nvm ls                 # 查看已安装版本',
          'nvm use 20             # 临时切换到 Node 20',
          'nvm alias default 22   # 设置默认版本',
        ].join('\n')),
      ],
      [
        'LTS 版本维护周期 30 个月（12 个月 Active + 18 个月 Maintenance），生命周期结束后不再收到安全更新。',
        'Windows 用户可选择 nvm-windows 或 fnm；fnm 基于 Rust，启动速度更快。',
        '不要用 root 直接覆盖系统 Node，容易破坏依赖系统 Node 的工具链。',
      ],
      [
        '国内镜像加速：export NVM_NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node/',
        'npm 源加速：npm config set registry https://registry.npmmirror.com',
      ],
    ),
    api(
      'first-program',
      '第一个程序',
      'node <file.ts>',
      '从 Node 22.6 开始，Node.js 内置了 TypeScript 类型剥离能力（--experimental-strip-types），可以像运行 JS 一样直接运行 .ts 文件。结合 tsx 等工具链，TypeScript 开发体验与 JavaScript 无异。',
      [],
      [
        ex('hello.ts', [
          "const greeting = (name: string): string => {",
          "  return 'Hello, ' + name + '!';",
          "};",
          "",
          "console.log(greeting('Node.js'));",
          "console.log('当前版本:', process.version);",
        ].join('\n'), 'Hello, Node.js!\n当前版本: v22.11.0'),
        bash('运行 TypeScript 文件', [
          '# 方式一：Node 22.6+ 内置类型剥离（实验性）',
          'node --experimental-strip-types hello.ts',
          '',
          '# 方式二：tsx（推荐，支持完整 TS 特性）',
          'pnpm add -D tsx',
          'npx tsx hello.ts',
        ].join('\n')),
      ],
      [
        '--experimental-strip-types 只做"类型擦除"，不执行语法转换，因此枚举、命名空间、参数属性等需要编译的语法不受支持（tsconfig 中对应 erasableSyntaxOnly）。',
        '生产环境应在构建阶段用 tsc / tsup / esbuild 编译为 JS，再由 node 执行，避免运行时开销。',
        'CommonJS 与 ESM 混用时注意 package.json 的 "type" 字段，见第 2 章。',
      ],
      ['配置 NODE_OPTIONS 可持久化运行参数：export NODE_OPTIONS="--experimental-strip-types"'],
    ),
    api(
      'repl',
      'REPL 交互环境',
      'node',
      'REPL（Read-Eval-Print Loop）是 Node.js 自带的交互式解释器，适合快速验证 API 行为、调试表达式，是学习 Node.js 的最佳 playground。',
      [],
      [
        bash('启动 REPL 并执行表达式', [
          'node',
          '> 1 + 2',
          '3',
          '> const fs = require("node:fs")',
          'undefined',
          '> typeof fs.readFile',
          "'function'",
          '> .exit',
        ].join('\n')),
      ],
      [
        'REPL 中下划线 _ 保存上一次表达式的结果，例如 1+2 之后输入 _ * 10 得到 30。',
        '常用点命令：.help 查看帮助、.clear 重置上下文、.exit 或 Ctrl+C 两次退出。',
        'REPL 输入表达式会自动打印结果，执行语句（如 console.log）则返回 undefined，这是初学者最常见的困惑。',
      ],
    ),
  ]),
]);
