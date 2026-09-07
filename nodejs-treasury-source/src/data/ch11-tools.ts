import { api, chapter, ex, p, section } from './helpers';

// 第 11 章：工具模块（os / url / util）
export const toolsChapter = chapter('tools', '工具模块', 'os 系统信息 / url 解析 / util 实用函数', [
  section('os-module', 'os：系统信息', [
    api(
      'os-info',
      '获取系统与硬件信息',
      'import os from "node:os"',
      'os 模块提供操作系统级信息：CPU 核数、内存、网络接口、临时目录等。多进程架构的进程数、容器资源判断都依赖它。',
      [],
      [
        ex('常用系统信息', [
          "import os from 'node:os';",
          '',
          "console.log('平台:', os.platform());",
          "console.log('CPU 逻辑核:', os.cpus().length);",
          "console.log('总内存:', Math.round(os.totalmem() / 1024 ** 3), 'GB');",
          "console.log('空闲内存:', Math.round(os.freemem() / 1024 ** 3), 'GB');",
          "console.log('临时目录:', os.tmpdir());",
          "console.log('换行符:', JSON.stringify(os.EOL));",
          "console.log('运行时长:', Math.round(os.uptime() / 3600), '小时');",
        ].join('\n'), '平台: linux\nCPU 逻辑核: 8\n总内存: 16 GB\n空闲内存: 6 GB\n临时目录: /tmp\n换行符: "\\n"\n运行时长: 72 小时'),
      ],
      [
        '多进程 worker 数的常见公式：os.availableParallelism()（v18.14+），比 cpus().length 更准确。',
        'os.EOL 在 Windows 是 \r\n，生成跨平台文本文件时必须使用。',
        '容器中 cpus() 返回宿主机核数，CPU 配额要用 cgroup 文件或 os.loadavg 结合分析。',
        'os.userInfo() 返回当前用户名与 home 目录，CLI 工具常用。',
      ],
    ),
  ]),
  section('url-module', 'url：URL 解析', [
    api(
      'url-class',
      'URL 类与 searchParams',
      'new URL(url, base?)',
      'WHATWG URL 是全局类（v10+ 可直接使用无需导入），把 URL 解析为 protocol/host/pathname/search/hash 等字段，searchParams 提供 URL 查询参数的增删改查（自动编解码）。',
      [
        p('url', 'string', true, '绝对地址；相对地址必须提供 base'),
        p('base', 'string | URL', false, '解析相对地址时的基准'),
      ],
      [
        ex('解析与构造 URL', [
          'const url = new URL(',
          '  "https://api.example.com:8443/v1/users?page=2&size=10&tag=node%20js",',
          ');',
          '',
          "console.log(url.protocol, url.host, url.pathname);",
          '',
          "console.log('page =', url.searchParams.get('page'));",
          "console.log('tag =', url.searchParams.get('tag'));",
          '',
          "url.searchParams.set('page', '3');",
          "url.searchParams.append('sort', 'name');",
          "console.log(url.pathname + url.search);",
        ].join('\n'), 'https: api.example.com:8443 /v1/users\npage = 2\ntag = node js\n/v1/users?page=3&size=10&tag=node%20js&sort=name'),
        ex('http 服务器中解析请求地址', [
          "import { createServer } from 'node:http';",
          '',
          'const server = createServer((req, res) => {',
          '  const url = new URL(req.url ?? "/", "http://localhost");',
          "  const keyword = url.searchParams.get('q') ?? '';",
          "  res.end('搜索: ' + keyword);",
          '});',
          'server.listen(3000);',
        ].join('\n'), '搜索: node.js（访问 /search?q=node.js 时）'),
      ],
      [
        'searchParams.get 自动做 URL 解码，不需要 decodeURIComponent；手动再解码反而出错。',
        '传统 url.parse 已标记 legacy（DEP0170），新代码一律用 WHATWG URL。',
        'file:// 地址与本地路径互转用 url.fileURLToPath / pathToFileURL。',
        '构造查询串时直接操作 searchParams，禁止手工字符串拼接（转义是重灾区）。',
      ],
    ),
  ]),
  section('util-module', 'util：实用函数', [
    api(
      'util-promisify',
      'promisify：回调转 Promise',
      'util.promisify<T>(fn: (...args, cb) => void)',
      'promisify 把"错误优先回调"风格的函数转换为返回 Promise 的版本，是迁移老代码的桥梁。v14+ 的核心模块大多已有原生 Promise 版（如 fs/promises），优先用原生。',
      [
        p('fn', '回调风格函数', true, '回调签名必须是 (err, value) => void'),
      ],
      [
        ex('转换回调式 API', [
          "import { promisify } from 'node:util';",
          "import { setTimeout as setTimeoutCb } from 'node:timers';",
          '',
          'const sleep = promisify(setTimeoutCb) as (ms: number) => Promise<void>;',
          '',
          'async function main(): Promise<void> {',
          '  await sleep(100);',
          "  console.log('100ms 后继续');",
          '}',
          'void main();',
        ].join('\n'), '100ms 后继续'),
      ],
      [
        'promisify 只认"第一个参数是 Error"的约定，不遵守约定的回调 API 转出来结果错乱。',
        '带自定义属性的函数（如 promisify.custom 符号）可自定义转换逻辑。',
        '回调 API 带"额外参数"时（multi-values），结果包成数组返回。',
      ],
    ),
    api(
      'util-inspect-format',
      'inspect 与 format：对象可视化',
      'util.inspect(obj, options?) / util.format(fmt, ...args)',
      'console.log 内部就是 util.inspect 的浅层调用。调试复杂嵌套对象时，inspect 的 depth、colors、breakLength 参数能救命；format 提供类 printf 的占位符格式化。',
      [
        p('obj', 'unknown', true, '任意对象；循环引用安全'),
        p('options.depth', 'number | null', false, '递归深度，默认 2；null 表示无限'),
        p('options.colors', 'boolean', false, '终端 ANSI 着色输出'),
      ],
      [
        ex('深度打印嵌套对象', [
          "import { inspect, format } from 'node:util';",
          '',
          'const app = {',
          '  name: "api",',
          '  deps: { db: { pool: { size: 10 } } },',
          '};',
          '',
          "console.log(inspect(app, { depth: null, colors: false }));",
          "console.log(format('%s 已运行 %d 秒，负载 %O', 'api', 42, { cpu: 0.3 }));",
        ].join('\n'), '{\n  name: \'api\',\n  deps: { db: { pool: { size: 10 } } }\n}\napi 已运行 42 秒，负载 { cpu: 0.3 }'),
      ],
      [
        'console.log 大对象显示 [Object] 不是丢了数据，是 depth=2 截断；调试时用 inspect({ depth: null })。',
        '常用占位符：%s 字符串、%d 数字、%i 整数、%f 浮点、%j JSON（循环引用会抛错）、%O/%o 对象。',
        '为类定义 [util.inspect.custom] 方法可自定义调试输出，CLI 工具必备。',
        '对象含 BigInt/循环引用时 %j 会抛错，改用 %O。',
      ],
    ),
  ]),
]);
