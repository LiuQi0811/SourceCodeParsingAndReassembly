import { api, chapter, ex, p, section } from './helpers';

// 第 4 章：path 路径处理
export const pathChapter = chapter('path', 'path 路径处理', '跨平台路径拼接、解析与 ESM 时代的 __dirname 替代方案', [
  section('path-core', '核心方法', [
    api(
      'join-resolve',
      'join 与 resolve',
      'path.join(...paths: string[]) / path.resolve(...paths: string[])',
      'join 负责智能拼接（自动处理分隔符与 ../），resolve 从右向左拼接直到拼出绝对路径（缺省时以 process.cwd() 兜底）。二者是最容易混淆的一对。',
      [
        p('paths', 'string[]', true, '路径片段，支持任意数量'),
      ],
      [
        ex('join vs resolve 行为差异', [
          "import path from 'node:path';",
          '',
          "console.log(path.join('src', 'utils', 'logger.ts'));",
          "console.log(path.join('src', '..', 'dist'));",
          '',
          "console.log(path.resolve('src', 'main.ts'));",
          "console.log(path.resolve('/var/www', 'logs', '../conf'));",
        ].join('\n'), '/workspace/projects/src/utils/logger.ts\n/workspace/projects/dist\n/workspace/projects/src/main.ts\n/var/www/conf'),
      ],
      [
        'join 只是"拼接 + 规范化"，不会得到绝对路径；resolve 会一路向左寻找绝对路径，找不到就拼上 cwd。',
        'resolve 相当于依次执行 cd：path.resolve("/a", "b") 等价于 cd /a && cd b 后的 pwd。',
        '处理用户输入路径时先 path.normalize 规范化，并检查 .. 防止目录穿越攻击。',
        'Windows 下 path 自动使用反斜杠，代码中永远用 path 方法拼接，禁止手写 / 或 \\。',
      ],
    ),
    api(
      'base-dir-ext',
      'basename / dirname / extname',
      'path.basename(p, ext?) / path.extname(p)',
      '三剑客分别取文件名、目录名与扩展名。extname 的边界行为（点文件、多扩展名）是高频面试题。',
      [
        p('p', 'string', true, '目标路径'),
        p('ext', 'string', false, 'basename 的第二参数：匹配到则从结果中移除该后缀'),
      ],
      [
        ex('解析路径的各个部分', [
          "import path from 'node:path';",
          '',
          "const file = '/var/log/app/error.log.1';",
          "console.log(path.basename(file));",
          "console.log(path.basename(file, '.1'));",
          "console.log(path.dirname(file));",
          "console.log(path.extname(file));",
          "console.log(path.extname('.bashrc'));",
        ].join('\n'), 'error.log.1\nerror.log\n/var/log/app\n.1\n（空字符串）'),
      ],
      [
        'extname 取的是最后一个点开始的部分：a.tar.gz 得到 .gz。',
        '以点开头的隐藏文件（.bashrc）没有扩展名，extname 返回空字符串。',
        'basename 对末尾分隔符免疫：path.basename("/src/") 返回 "src"。',
      ],
    ),
    api(
      'parse-format',
      'parse 与 format',
      'path.parse(p): ParsedPath / path.format(pathObject)',
      'parse 把路径拆解为 root / dir / base / ext / name 五元组，format 是它的逆运算。两者组合可实现"只改文件名不动目录"这类精细操作。',
      [],
      [
        ex('拆解与重组路径', [
          "import path from 'node:path';",
          '',
          "const parsed = path.parse('/home/user/report.final.pdf');",
          "console.log(parsed);",
          '',
          "const renamed = path.format({",
          '  ...parsed,',
          "  name: 'report-2024',",
          '});',
          "console.log(renamed);",
          "console.log(path.isAbsolute('/tmp'));",
        ].join('\n'), "{ root: '/', dir: '/home/user', base: 'report.final.pdf', ext: '.pdf', name: 'report.final' }\n/home/user/report-2024.pdf\ntrue"),
      ],
      [
        'format 时若同时提供 base 与 name/ext，以 base 为准；改文件名应覆盖 name 字段。',
        'parse(p) 再 format 回去是恒等变换，可用于"解析-修改-重组"流水线。',
        'isAbsolute 在 Windows 下识别 "C:\\" 前缀；posix/win32 子命名空间可强制按指定平台解析。',
      ],
    ),
    api(
      'relative-esm-dirname',
      'relative 与 __dirname 的 ESM 替代',
      'path.relative(from, to)',
      'relative 计算从 from 到 to 的相对路径。ESM 中不再有 __dirname，标准替代方案是 import.meta.url + fileURLToPath。',
      [
        p('from / to', 'string', true, '起点与目标（绝对路径）'),
      ],
      [
        ex('计算相对路径', [
          "import path from 'node:path';",
          '',
          "console.log(path.relative('/a/b/c', '/a/b/d/e'));",
          "console.log(path.relative('/a/b', '/a/b'));",
        ].join('\n'), '../d/e\n（空字符串）'),
        ex('ESM 中重建 __dirname / __filename', [
          "import { fileURLToPath } from 'node:url';",
          "import path from 'node:path';",
          '',
          'const __filename = fileURLToPath(import.meta.url);',
          'const __dirname = path.dirname(__filename);',
          '',
          "const dataDir = path.resolve(__dirname, '../data');",
          "console.log(dataDir);",
        ].join('\n'), '/workspace/projects/data'),
      ],
      [
        'relative 返回的路径不带末尾分隔符，相同路径返回空字符串。',
        'import.meta.url 是 file:// 协议 URL，含空格或中文时会被编码，直接当路径用会出错，必须 fileURLToPath。',
        '项目中如频繁使用，建议封装为 src/paths.ts 统一导出，避免到处重复。',
      ],
    ),
  ]),
]);
