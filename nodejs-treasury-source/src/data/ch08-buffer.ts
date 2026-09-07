import { api, chapter, ex, p, section } from './helpers';

// 第 8 章：buffer 缓冲区
export const bufferChapter = chapter('buffer', 'Buffer 缓冲区', '二进制数据处理：编码转换、内存视图与常见陷阱', [
  section('buffer-core', 'Buffer 基础', [
    api(
      'buffer-create',
      '创建 Buffer',
      'Buffer.from(...) / Buffer.alloc(size)',
      'Buffer 是处理 TCP 流、文件 I/O 的二进制数据容器，是 Uint8Array 的子类。创建方式只有 Buffer.from / Buffer.alloc / Buffer.allocUnsafe 三类，new Buffer() 已废弃。',
      [
        p('size', 'number', true, 'alloc 的字节数，分配后自动用 0 填充'),
        p('string', 'string', true, 'from(str, encoding) 将字符串按指定编码转成字节'),
        p('arrayOrBuffer', 'number[] | Buffer | ArrayBuffer', true, 'from 的另一形态：复制生成新 Buffer'),
      ],
      [
        ex('三种创建方式', [
          "const fromStr = Buffer.from('Node.js', 'utf8');",
          'const zeroed = Buffer.alloc(4);',
          'const fromBytes = Buffer.from([0x4e, 0x6f, 0x64, 0x65]);',
          '',
          "console.log(fromStr);",
          "console.log(zeroed);",
          "console.log(fromBytes.toString('utf8'));",
          "console.log(Buffer.isBuffer(fromStr));",
        ].join('\n'), '<Buffer 4e 6f 64 65 2e 6a 73>\n<Buffer 00 00 00 00>\nNode\ntrue'),
      ],
      [
        'Buffer.allocUnsafe(size) 不做零填充，速度更快但内容是内存残留，必须立即 fill 或覆盖全部字节。',
        'Buffer.from(bufferOrArray) 是复制语义；buf.subarray() 是共享内存的视图（见下节）。',
        '小于 4KB 的分配走内部 Buffer.poolSize（8KB）内存池，开销极低，但也因此 subarray 可能与陌生 Buffer 共享池内存。',
      ],
    ),
    api(
      'buffer-encoding',
      '编码与转换',
      'buf.toString(encoding?) / Buffer.from(str, encoding)',
      'Buffer 与字符串互转是中文乱码、Base64 图片、十六进制签名的底层原理。支持的编码：utf8 / utf16le / latin1 / ascii / hex / base64 / base64url。',
      [
        p('encoding', 'BufferEncoding', false, '默认 utf8；网络签名场景常用 hex 或 base64'),
      ],
      [
        ex('常见编码往返', [
          "const buf = Buffer.from('Node 宝典');",
          '',
          "console.log(buf.toString('utf8'));",
          "console.log(buf.toString('hex'));",
          '',
          "const b64 = buf.toString('base64url');",
          "console.log(b64);",
          "console.log(Buffer.from(b64, 'base64url').toString('utf8'));",
        ].join('\n'), 'Node 宝典\n4e6f646520e5ae9de585b8\nTm9kZSDlrp3lhbg\nNode 宝典'),
        ex('中文被截断的乱码现场', [
          "// '宝' 占 3 字节，从第 4 字节切开会切碎它",
          "const buf = Buffer.from('Node宝典', 'utf8');",
          "console.log(buf.subarray(0, 5).toString('utf8'));",
          '',
          "// 正确做法：按完整字符边界或使用 StringDecoder",
        ].join('\n'), 'Node�'),
      ],
      [
        '多字节字符（中文 3 字节）被 subarray/slice 切断后 toString 会产生替换符，跨 chunk 拼接必须用 string_decoder.StringDecoder。',
        'base64url（v15.7+）不使用 +/ 字符，适合 URL 与 JWT 场景。',
        'Buffer.isEncoding(enc) 可在运行时校验编码名合法性。',
        '二进制协议开发时明确每个字段的字节序（buf.readUInt32BE / LE）。',
      ],
    ),
    api(
      'buffer-typedarray',
      'Buffer 与 TypedArray',
      'buf.subarray(start, end?) / buf.copy(target)',
      'Buffer 继承自 Uint8Array，可以与 TypedArray、DataView 互操作。理解"视图共享内存"与"copy 复制内存"的区别是进阶关键。',
      [],
      [
        ex('视图与复制', [
          "const buf = Buffer.from('hello world');",
          '',
          '// subarray：共享内存的视图',
          "const view = buf.subarray(0, 5);",
          "view[0] = 0x48; // 修改会反映到原 buf（本来就是 H）",
          "console.log(view.toString());",
          '',
          '// copy：真正的内存复制',
          "const dest = Buffer.alloc(5);",
          'buf.copy(dest, 0, 0, 5);',
          "console.log(dest.toString());",
          '',
          '// 与 Uint8Array 互转',
          'const u8 = new Uint8Array(buf);',
          "console.log(u8 instanceof Uint8Array, Buffer.isBuffer(u8));",
        ].join('\n'), 'hello\nhello\ntrue false'),
      ],
      [
        'subarray 不复制数据，改视图就是改原数据；copy / from 是复制，二者性能与语义差异要在架构层面想清楚。',
        'Buffer.poolSize 池化意味着两个看似无关的小 Buffer 可能物理相邻，不要假设隔离。',
        'buffer.constants.MAX_LENGTH（现代 64 位系统约 4GB）是单个 Buffer 上限，超限抛 RangeError。',
        '需要 16/32 位视图时用 buf.readInt16BE() 系列，而不是把 Buffer 转 ArrayBuffer 再开 DataView（多一次复制）。',
      ],
    ),
  ]),
  section('buffer-advanced', 'Blob 与 File', [
    api(
      'buffer-blob',
      'Blob / File：Web 标准二进制',
      'new Blob(parts[, options])',
      'Blob（v15.7+ 全局）与 File（v20+ 全局）让 Node 拥有与浏览器一致的二进制抽象，fetch 的 body、multipart 上传、FormData 都围绕它们构建。',
      [
        p('parts', '(Blob | Buffer | string)[]', true, '二进制内容片段'),
        p('options.type', 'string', false, 'MIME 类型，如 image/png'),
      ],
      [
        ex('创建 Blob 并互转', [
          'async function main(): Promise<void> {',
          "  const blob = new Blob([Buffer.from('宝典二进制内容')], { type: 'text/plain' });",
          '',
          "  console.log('大小:', blob.size, 'B | 类型:', blob.type);",
          '  const text = await blob.text();',
          "  console.log('内容:', text);",
          '',
          '  // Blob 转 Buffer',
          '  const buf = Buffer.from(await blob.arrayBuffer());',
          "  console.log('Buffer 字节:', buf.length);",
          '}',
          '',
          'void main();',
        ].join('\n'), '大小: 18 B | 类型: text/plain\n内容: 宝典二进制内容\nBuffer 字节: 18'),
      ],
      [
        'Blob 数据不可变（immutable）：修改场景新建实例或用 new File 包装。',
        'Buffer 是可读写的内存视图，Blob 是不可变值——跨 fetch/Workers 传递用 Blob 更安全。',
        'FormData.append("file", new File([buf], "a.png")) 直接构造 multipart 上传体（v20+）。',
        'Blob 默认整体驻留内存，GB 级文件请走流式处理。',
      ],
    ),
  ]),
]);
