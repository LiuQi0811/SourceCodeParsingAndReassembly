// =====================================================================
// CompressionStreamsPage.js —— Compression Streams API 完整实验室
// 演示浏览器原生 CompressionStream + DecompressionStream：
//   1. 概述与动机 —— JS 端压缩库痛点（pako/fflate 体积大）/ 浏览器原生
//      CompressionStream + DecompressionStream 标准 / 与 Streams API 协同 /
//      浏览器支持 Chrome 80+/Firefox 113+/Safari 16.4+ 全部稳定
//   2. CompressionStream 构造 —— new CompressionStream('gzip') /
//      format: 'gzip'/'deflate'/'deflate-raw' / gzip vs deflate 区别
//      （gzip 有 header）/ readable + writable duplex 流 / 与 pipeThrough 协同
//   3. DecompressionStream 构造 —— new DecompressionStream('gzip') /
//      接收压缩数据 → 解压 / format 必须匹配 / 解压错误处理 / 与 fetch 协同
//   4. 与 fetch + Streams 协同 —— fetch(url).then(r =>
//      r.body.pipeThrough(new DecompressionStream('gzip'))) / 上传前压缩 /
//      new CompressionStream('gzip').readable / 流式压缩大文件 / 内存友好
//   5. 实战：上传大文件压缩 —— FormData + CompressionStream /
//      大日志文件上传压缩 / 与 ReadableStream 配合分片压缩 /
//      与 Service Worker 缓存压缩协同
//   6. 实战：下载解压流 —— fetch gzip 响应自动解压 / 服务端
//      Content-Encoding: gzip 浏览器自动处理 / 手动解压场景 / Web Worker
//      并行压缩 / ByteLengthQueuingStrategy 背压
//   7. 性能与压缩率对比 —— CompressionStream vs pako/fflate 压缩率 /
//      速度对比 / 浏览器原生 vs WASM 实现 / 不同 level（gzip 默认 level 6）/
//      不同格式取舍
//   8. 陷阱与最佳实践 —— 仅支持 gzip/deflate/deflate-raw（无 bzip2/lz4/zstd）/
//      压缩级别不可配置 / 流式压缩不能随机访问 / 小数据压缩开销 /
//      与 Crypto.subtle 协同（先压缩后加密）/ 文件类型与压缩率关系
// 说明：所有特性调用前做 typeof 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。jsdom 较新版本有
//       CompressionStream/DecompressionStream，可真实运行压缩演示；
//       ReadableStream/WritableStream/TransformStream 同样可用。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class CompressionStreamPage extends Page {
    _abortControllers = null;
    _dynamicStyles = null;
    _inited = false;
    // —— 初始 state ——
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            overviewInfo: '', // Card 1：概述与动机
            compressionInfo: '', // Card 2：CompressionStream 构造
            decompressionInfo: '', // Card 3：DecompressionStream 构造
            fetchStreamsInfo: '', // Card 4：与 fetch + Streams 协同
            uploadInfo: '', // Card 5：上传大文件压缩
            downloadInfo: '', // Card 6：下载解压流
            performanceInfo: '', // Card 7：性能与压缩率对比
            pitfallsInfo: '', // Card 8：陷阱与最佳实践
            compressResult: '', // Card 2 真实压缩结果
            decompressResult: '', // Card 3 真实解压结果
            perfResult: '', // Card 7 真实性能对比结果
        };
    }
    // —— 生命周期 ——
    componentDidMount() {
        // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
        if (this._inited)
            return;
        this._inited = true;
        this._dynamicStyles = [];
        this._abortControllers = []; // 真实压缩/解压 AbortController（销毁时 abort）
        const f = this._flags();
        const c = (ok) => ok ? '✓' : '✗';
        const parts = [
            `CompressionStream ${c(f.compressionStream)}`,
            `DecompressionStream ${c(f.decompressionStream)}`,
            `gzip ${c(f.gzipSupported)}`,
            `deflate ${c(f.deflateSupported)}`,
            `deflate-raw ${c(f.deflateRawSupported)}`,
            `ReadableStream ${c(f.readableStream)}`,
            `WritableStream ${c(f.writableStream)}`,
            `TransformStream ${c(f.transformStream)}`,
        ];
        const any = f.compressionStream && f.decompressionStream;
        const summary = any
            ? `Compression Streams API 能力检测：${parts.join(' · ')}。当前环境支持 CompressionStream/DecompressionStream，可真实运行 gzip/deflate/deflate-raw 三种格式压缩演示，与 fetch + ReadableStream + pipeThrough 协同。`
            : `Compression Streams API 能力检测：${parts.join(' · ')}。jsdom 老版本无 CompressionStream（Chrome 80+/Firefox 113+/Safari 16.4+ 全部稳定），所有按钮点击仅记日志说明，绝不抛异常；现代浏览器与较新 jsdom 可完整体验。`;
        this.setState({ capsSummary: summary });
        this._addLog(any ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!f.compressionStream)
            this._addLog('warn', 'CompressionStream 不可用（Chrome 80+/Firefox 113+/Safari 16.4+ 全部稳定，jsdom 较新版本支持）');
        if (!f.decompressionStream)
            this._addLog('warn', 'DecompressionStream 不可用（与 CompressionStream 同期稳定）');
        if (f.compressionStream && !f.gzipSupported)
            this._addLog('warn', 'gzip 格式不被支持（罕见，仅极老浏览器）');
        if (f.compressionStream && !f.deflateRawSupported)
            this._addLog('warn', 'deflate-raw 格式不被支持（Chrome 103+ 支持，Safari 16.4+ 支持）');
        if (!f.readableStream)
            this._addLog('warn', 'ReadableStream 不可用（pipeThrough 演示跳过）');
        this._injectBaseStyles();
    }
    componentWillUnmount() {
        // 中止所有进行中的压缩/解压
        for (const ac of this._abortControllers) {
            try {
                ac.abort();
            }
            catch { /* noop */ }
        }
        this._abortControllers = [];
        // 移除动态注入的样式
        for (const style of this._dynamicStyles) {
            try {
                style.parentNode && style.parentNode.removeChild(style);
            }
            catch { /* noop */ }
        }
        this._dynamicStyles = [];
    }
    // —— 辅助方法 ——
    _addLog(type, content) {
        this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
    }
    _btn(label, opts) {
        const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
        this.registerChild(btn);
        return btn.render();
    }
    _caps(items) {
        return items.map(([label, ok]) => h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
    }
    _injectStyle(id, css) {
        const existing = document.getElementById(id);
        if (existing)
            existing.remove();
        const style = document.createElement('style');
        style.id = id;
        style.textContent = css;
        document.head.appendChild(style);
        this._dynamicStyles.push(style);
    }
    // 返回布尔能力对象（供 capsSummary / 按钮 disabled 使用）
    _flags() {
        const safe = (fn) => {
            try {
                return fn();
            }
            catch {
                return false;
            }
        };
        return {
            compressionStream: safe(() => typeof window.CompressionStream === 'function'),
            decompressionStream: safe(() => typeof window.DecompressionStream === 'function'),
            gzipSupported: safe(() => { try {
                new CompressionStream('gzip');
                return true;
            }
            catch {
                return false;
            } }),
            deflateSupported: safe(() => { try {
                new CompressionStream('deflate');
                return true;
            }
            catch {
                return false;
            } }),
            deflateRawSupported: safe(() => { try {
                new CompressionStream('deflate-raw');
                return true;
            }
            catch {
                return false;
            } }),
            readableStream: safe(() => typeof window.ReadableStream === 'function'),
            writableStream: safe(() => typeof window.WritableStream === 'function'),
            transformStream: safe(() => typeof window.TransformStream === 'function'),
        };
    }
    _injectBaseStyles() {
        this._injectStyle('cs-base', `
      .cs-demo {
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
      }
      .cs-stage {
        margin-top: 10px;
        padding: 12px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
      }
      .cs-output {
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 4px;
        padding: 8px;
        font-family: monospace;
        font-size: 11px;
        white-space: pre-wrap;
        word-break: break-all;
        margin-top: 8px;
        min-height: 30px;
      }
      .cs-output--success { background: #064e3b; color: #d1fae5; }
      .cs-output--warn { background: #78350f; color: #fef3c7; }
      .cs-matrix {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 8px;
        margin-top: 10px;
      }
      .cs-matrix-cell {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 8px;
        font-size: 12px;
      }
      .cs-matrix-title { font-weight: 600; color: #1e293b; margin-bottom: 4px; }
      .cs-flow {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 8px;
        font-size: 12px;
      }
      .cs-flow-node {
        padding: 4px 8px;
        border-radius: 6px;
        background: #e0e7ff;
        color: #1e40af;
        font-weight: 600;
      }
      .cs-flow-node--stream { background: #ede9fe; color: #4c1d95; }
      .cs-flow-arrow { color: #64748b; }
      .cs-bar-wrap {
        background: #1e293b;
        border-radius: 4px;
        height: 14px;
        overflow: hidden;
        margin-top: 6px;
      }
      .cs-bar {
        height: 100%;
        background: linear-gradient(90deg, #22c55e, #3b82f6);
        transition: width 0.2s ease;
      }
    `);
    }
    // —— 真实压缩辅助（jsdom 较新版本可用）——
    async _compress(text, format = 'gzip') {
        const cs = new CompressionStream(format);
        const writer = cs.writable.getWriter();
        const encoder = new TextEncoder();
        writer.write(encoder.encode(text));
        writer.close();
        const reader = cs.readable.getReader();
        const chunks = [];
        let totalBytes = 0;
        for (;;) {
            const { value, done } = await reader.read();
            if (done)
                break;
            chunks.push(value);
            totalBytes += value.byteLength;
        }
        const merged = new Uint8Array(totalBytes);
        let offset = 0;
        for (const c of chunks) {
            merged.set(c, offset);
            offset += c.byteLength;
        }
        return merged;
    }
    async _decompress(bytes, format = 'gzip') {
        const ds = new DecompressionStream(format);
        const writer = ds.writable.getWriter();
        writer.write(bytes);
        writer.close();
        const reader = ds.readable.getReader();
        const decoder = new TextDecoder();
        let result = '';
        for (;;) {
            const { value, done } = await reader.read();
            if (done)
                break;
            result += decoder.decode(value, { stream: true });
        }
        result += decoder.decode();
        return result;
    }
    _bytesToHex(bytes, max = 64) {
        const arr = [];
        const n = Math.min(bytes.length, max);
        for (let i = 0; i < n; i++) {
            arr.push(bytes[i].toString(16).padStart(2, '0'));
        }
        return arr.join(' ') + (bytes.length > max ? ` ... (+${bytes.length - max} bytes)` : '');
    }
    // ===================== Card 1：概述与动机 =====================
    _runOverviewDemo() {
        const f = this._flags();
        this._injectStyle('cs-overview-demo', `
      .cs-overview-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
        const info = [
            '===== Compression Streams API 概述与动机 =====',
            '',
            '【JS 端压缩库痛点】',
            '  传统方案：用 pako / fflate / jszip 等第三方库',
            '  问题：',
            '  1. 库体积大：pako ~45KB min+gzip，fflate ~8KB',
            '  2. 性能不如原生：JS 实现的 deflate 比 C++ 慢 2-5 倍',
            '  3. 维护成本：需定期升级、安全审计',
            '  4. WASM 替代（如 fflate-wasm）仍需下载',
            '  5. 与 Streams API 集成需手动包装',
            '',
            '【CompressionStream + DecompressionStream 标准】',
            '  W3C Web Applications Working Group 提案',
            '  https://streams.spec.whatwg.org/',
            '  核心：',
            '  - new CompressionStream(format)  压缩流（TransformStream 子类）',
            '  - new DecompressionStream(format) 解压流',
            '  - format: "gzip" / "deflate" / "deflate-raw"',
            '  - 继承 TransformStream：readable + writable duplex',
            '',
            '【与 Streams API 协同】',
            '  - CompressionStream 是 TransformStream 的子类',
            '  - 可用 pipeThrough 串联到任意 ReadableStream',
            '  - fetch response.body / ReadableStream / WritableStream 互通',
            '  - ByteLengthQueuingStrategy 提供背压',
            '',
            '【浏览器支持（全部稳定）】',
            '  CompressionStream：',
            '    Chrome 80+（2020）',
            '    Edge 80+',
            '    Firefox 113+（2023）',
            '    Safari 16.4+（2023）',
            '    Deno 1.19+',
            '    Node.js 18+（实验）',
            '    jsdom 较新版本支持',
            '',
            '  DecompressionStream：与 CompressionStream 同期',
            '',
            '  deflate-raw 格式：',
            '    Chrome 103+',
            '    Safari 16.4+',
            '    Firefox 113+',
            '',
            '【压缩格式：gzip / deflate / deflate-raw】',
            '  gzip         gzip 格式（RFC 1952），有 header（10 字节）+ footer（8 字节）',
            '               含 magic number 0x1f 0x8b、压缩方法、时间戳、原始大小',
            '               最通用，浏览器自动处理 Content-Encoding: gzip',
            '  deflate      zlib 格式（RFC 1950），有 2 字节 header + 4 字节 adler32 校验',
            '               比 gzip 少了时间戳与原始大小，体积略小',
            '  deflate-raw  raw deflate（RFC 1971），无 header/footer',
            '               体积最小，但需自行管理校验与边界',
            '',
            '【三种格式取舍】',
            '  通用性：gzip > deflate > deflate-raw',
            '  体积：deflate-raw < deflate < gzip',
            '  自描述：gzip（含原始大小） > deflate > deflate-raw',
            '',
            '  建议：',
            '  - 通用场景用 gzip（最兼容）',
            '  - 已知边界的小数据用 deflate-raw（省字节）',
            '  - 与 zlib 兼容用 deflate',
            '',
            '【与 pako/fflate 对比】',
            '  维度              CompressionStream    pako / fflate',
            '  -----------------------------------------------------------------',
            '  体积              ✓ 0（浏览器内置）    ✗ ~45KB / ~8KB',
            '  性能              ✓ 原生 C++           △ JS/WASM 实现',
            '  压缩级别          ✗ 不可配置（默认 6）  ✓ 1-9 可配置',
            '  支持格式          gzip/deflate/raw     gzip/deflate/raw + zip',
            '  与 Streams 协同    ✓ 原生 pipeThrough   ✗ 需手动包装',
            '  流式压缩          ✓                    △ 需自己实现 chunking',
            '  浏览器支持        Chrome 80+           全平台（库）',
            '',
            '【能力检测代码】',
            "  const hasCS = typeof CompressionStream === 'function';",
            "  const hasDS = typeof DecompressionStream === 'function';",
            "  const gzipOK = (() => { try { new CompressionStream('gzip'); return true; } catch { return false; } })();",
            "  const deflateRawOK = (() => { try { new CompressionStream('deflate-raw'); return true; } catch { return false; } })();",
            '',
            '【实际能力检测演示】',
            `  CompressionStream: ${f.compressionStream ? '✓' : '✗'}`,
            `  DecompressionStream: ${f.decompressionStream ? '✓' : '✗'}`,
            `  gzip: ${f.gzipSupported ? '✓' : '✗'}`,
            `  deflate: ${f.deflateSupported ? '✓' : '✗'}`,
            `  deflate-raw: ${f.deflateRawSupported ? '✓' : '✗'}`,
            `  ReadableStream: ${f.readableStream ? '✓' : '✗'}`,
            `  WritableStream: ${f.writableStream ? '✓' : '✗'}`,
            `  TransformStream: ${f.transformStream ? '✓' : '✗'}`,
            '',
            '【常见陷阱】',
            '  1. 仅支持 gzip/deflate/deflate-raw（无 bzip2/lz4/zstd）',
            '  2. 压缩级别不可配置（gzip 默认 level 6，pako 可 1-9）',
            '  3. 流式压缩不能随机访问（无法 append 已有 gzip 文件）',
            '  4. 小数据（< 100 字节）压缩后可能更大（gzip header 18 字节）',
            '  5. 与 Crypto.subtle 协同需注意：先压缩后加密（加密后无法压缩）',
        ].join('\n');
        this.setState({ overviewInfo: info });
        this._addLog('cs', `概述演示完成：CompressionStream=${f.compressionStream}，gzip=${f.gzipSupported}`);
    }
    _renderCard1() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '1. 概述与动机 —— JS 压缩库痛点 / CompressionStream / 浏览器支持',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['CompressionStream', f.compressionStream],
                ['DecompressionStream', f.decompressionStream],
                ['gzip', f.gzipSupported],
            ]), h(Tag, { color: 'primary' }, '概述')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'JS 端压缩库（pako ~45KB / fflate ~8KB）体积大、性能不如原生。CompressionStream + DecompressionStream 是 W3C 标准，继承 TransformStream（readable + writable duplex），与 fetch response.body / ReadableStream / pipeThrough 互通。三种格式：gzip（有 header+footer，最通用）/ deflate（zlib，2 字节 header）/ deflate-raw（无 header，体积最小）。浏览器支持 Chrome 80+/Firefox 113+/Safari 16.4+ 全部稳定多年，jsdom 较新版本支持。压缩级别不可配置（默认 6），仅支持 gzip/deflate/deflate-raw（无 bzip2/lz4/zstd）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行概述演示', { type: 'primary', size: 'sm', onClick: () => this._runOverviewDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, `// CompressionStream + DecompressionStream
const cs = new CompressionStream('gzip');
const writer = cs.writable.getWriter();
writer.write(new TextEncoder().encode('Hello, world!'));
writer.close();

const reader = cs.readable.getReader();
const chunks: any[] = [];
for (;;) {
  const { value, done } = await reader.read();
  if (done) break;
  chunks.push(value);
}
const compressed = new Blob(chunks);

// 解压
const ds = new DecompressionStream('gzip');
// ... 同样 writable.getWriter() / readable.getReader()`)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.overviewInfo || '（点击按钮查看 Compression Streams API 概述完整说明）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 2：CompressionStream 构造 =====================
    _runCompressionDemo() {
        const f = this._flags();
        this._injectStyle('cs-compression-demo', `
      .cs-compression-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
        if (!f.compressionStream || !f.gzipSupported) {
            this._addLog('warn', 'CompressionStream/gzip 不可用，仅展示 API 用法（jsdom 老版本无此 API）');
            this.setState({ compressResult: 'CompressionStream 不可用' });
        }
        else if (!f.readableStream) {
            this._addLog('warn', 'ReadableStream 不可用，无法读取压缩结果');
            this.setState({ compressResult: 'ReadableStream 不可用' });
        }
        else {
            // 真实压缩演示：压缩一段重复文本，观察压缩率
            const sample = 'Compression Streams API 演示文本。'.repeat(50) +
                ' 重复内容压缩率高，随机内容压缩率低。'.repeat(20);
            const originalBytes = new TextEncoder().encode(sample).byteLength;
            const formats = ['gzip', 'deflate', 'deflate-raw'].filter((fmt) => {
                try {
                    new CompressionStream(fmt);
                    return true;
                }
                catch {
                    return false;
                }
            });
            Promise.all(formats.map(async (fmt) => {
                const compressed = await this._compress(sample, fmt);
                const ratio = (compressed.byteLength / originalBytes * 100).toFixed(1);
                return `${fmt}: 原始 ${originalBytes}B → 压缩 ${compressed.byteLength}B（压缩率 ${ratio}%）\n  hex 前 32 字节: ${this._bytesToHex(compressed, 32)}`;
            })).then((lines) => {
                this.setState({ compressResult: `原始文本：${originalBytes}B\n\n` + lines.join('\n\n') });
                this._addLog('info', `本地压缩成功（${formats.length} 种格式）：原始 ${originalBytes}B`);
            }).catch((err) => {
                this.setState({ compressResult: `压缩失败：${err.name} - ${err.message}` });
                this._addLog('warn', `压缩失败：${err.name} - ${err.message}`);
            });
        }
        const info = [
            '===== CompressionStream 构造：format / duplex / pipeThrough =====',
            '',
            '【构造签名】',
            '  new CompressionStream(format)',
            '  // format: "gzip" | "deflate" | "deflate-raw"',
            '',
            '  const cs = new CompressionStream("gzip");',
            '  // 不传 format 或传不支持的格式抛 TypeError',
            '',
            '【CompressionStream 是 TransformStream 子类】',
            '  // 继承自 TransformStream，有 readable + writable 两端',
            '  cs.readable;   // ReadableStream<Uint8Array>  压缩后输出',
            '  cs.writable;   // WritableStream<BufferSource> 原始数据输入',
            '',
            '  // 双工特性：写入未压缩数据，读取压缩数据',
            '  // 类似管道：input → [compress] → output',
            '',
            '【写入数据：writable.getWriter()】',
            '  const writer = cs.writable.getWriter();',
            '  const encoder = new TextEncoder();',
            '  writer.write(encoder.encode("Hello, world!"));',
            '  writer.close();  // 必须关闭，否则压缩流不结束',
            '',
            '  // 多次写入（流式压缩）',
            '  for (const chunk of largeData) {',
            '    await writer.ready;  // 等待下游准备好（背压）',
            '    writer.write(chunk);',
            '  }',
            '  writer.close();',
            '',
            '【读取结果：readable.getReader()】',
            '  const reader = cs.readable.getReader();',
            '  const chunks: any[] = [];',
            '  for (;;) {',
            '    const { value, done } = await reader.read();',
            '    if (done) break;',
            '    chunks.push(value);  // Uint8Array',
            '  }',
            '  // 合并 chunks',
            '  const total = chunks.reduce((s, c) => s + (c as any).byteLength, 0);',
            '  const merged = new Uint8Array(total);',
            '  let offset = 0;',
            '  for (const c of chunks) { merged.set(c, offset); offset += (c as any).byteLength; }',
            '',
            '【与 pipeThrough 协同】',
            '  // 把 ReadableStream 通过 CompressionStream 串联',
            '  const sourceStream = new ReadableStream({',
            '    start(controller) {',
            '      controller.enqueue(new TextEncoder().encode("chunk1"));',
            '      controller.enqueue(new TextEncoder().encode("chunk2"));',
            '      controller.close();',
            '    },',
            '  });',
            '',
            '  const compressedStream = sourceStream.pipeThrough(',
            '    new CompressionStream("gzip"),',
            '  );',
            '',
            '  // 再 pipe 到 WritableStream（如 fetch 上传 body）',
            '  await compressedStream.pipeTo(new WritableStream({',
            '    write(chunk) { console.log("压缩 chunk:", chunk); },',
            '  }));',
            '',
            '【与 fetch 上传 body 协同】',
            '  // 把 readable 直接作为 fetch body',
            '  const cs = new CompressionStream("gzip");',
            '  const writer = cs.writable.getWriter();',
            '  writer.write(textBytes);',
            '  writer.close();',
            '',
            '  await fetch("/upload", {',
            '    method: "POST",',
            '    headers: { "Content-Encoding": "gzip" },',
            '    body: cs.readable,  // ReadableStream 作为 body',
            '  });',
            '',
            '【gzip vs deflate 区别】',
            '  gzip (RFC 1952):',
            '    - 10 字节 header（含 magic 0x1f 0x8b、压缩方法、时间戳）',
            '    - 8 字节 footer（CRC32 + 原始大小）',
            '    - 含原始大小信息（解压前可知大小）',
            '    - 浏览器自动处理 Content-Encoding: gzip',
            '',
            '  deflate (RFC 1950 = zlib wrapper):',
            '    - 2 字节 header（CMF + FLG）',
            '    - 4 字节 footer（adler32 校验）',
            '    - 无原始大小信息',
            '    - 不被浏览器自动解压（Content-Encoding: deflate 兼容性问题）',
            '',
            '  deflate-raw (RFC 1971):',
            '    - 无 header/footer',
            '    - 体积最小',
            '    - 需自行管理边界与校验',
            '    - 适合已知大小的内部数据',
            '',
            '【format 必须匹配解压】',
            '  // 压缩和解压必须用相同 format',
            '  const compressed = await compress(data, "gzip");',
            '  const restored = await decompress(compressed, "gzip");  // ✓',
            '  // const wrong = await decompress(compressed, "deflate");  // ✗ 抛 error',
            '',
            '【浏览器支持】',
            `  CompressionStream: ${f.compressionStream ? '✓' : '✗'}`,
            `  gzip: ${f.gzipSupported ? '✓' : '✗'}`,
            `  deflate: ${f.deflateSupported ? '✓' : '✗'}`,
            `  deflate-raw: ${f.deflateRawSupported ? '✓' : '✗'}`,
            `  ReadableStream: ${f.readableStream ? '✓' : '✗'}`,
            '',
            '【常见陷阱】',
            '  1. format 不支持抛 TypeError（如 "bzip2"）',
            '  2. writer.close() 必须调用，否则 readable 不结束',
            '  3. readable 可能输出多个 chunk（流式），必须合并',
            '  4. 小数据压缩后可能更大（gzip header 18 字节固定开销）',
            '  5. pipeThrough 后原 stream 锁定，不能再用',
        ].join('\n');
        this.setState({ compressionInfo: info });
        this._addLog('cs', `CompressionStream 构造演示完成：gzip/deflate/deflate-raw + pipeThrough`);
    }
    _renderCard2() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '2. CompressionStream 构造 —— gzip/deflate/deflate-raw + duplex + pipeThrough',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['CompressionStream', f.compressionStream],
                ['gzip', f.gzipSupported],
                ['deflate-raw', f.deflateRawSupported],
            ]), h(Tag, { color: 'primary' }, '压缩')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'new CompressionStream(format) format 为 gzip（RFC 1952，10 字节 header + 8 字节 footer，含原始大小，浏览器自动处理）/ deflate（RFC 1950 zlib，2 字节 header + 4 字节 adler32 校验）/ deflate-raw（RFC 1971 raw，无 header 体积最小）。继承 TransformStream，readable + writable duplex。writable.getWriter() 写入 BufferSource，close() 结束；readable.getReader() 读取 Uint8Array chunks。与 pipeThrough 串联 ReadableStream，可直接作为 fetch body。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行压缩演示', { type: 'primary', size: 'sm', disabled: !f.compressionStream, onClick: () => this._runCompressionDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, `// CompressionStream 构造（三种格式）
const cs = new CompressionStream('gzip');     // 或 'deflate' / 'deflate-raw'

// 写入未压缩数据
const writer = cs.writable.getWriter();
writer.write(new TextEncoder().encode('Hello, '));
writer.write(new TextEncoder().encode('world!'));
writer.close();  // 必须 close

// 读取压缩结果
const reader = cs.readable.getReader();
const chunks: any[] = [];
for (;;) {
  const { value, done } = await reader.read();
  if (done) break;
  chunks.push(value);
}

// 与 pipeThrough 协同
const compressed = sourceStream.pipeThrough(
  new CompressionStream('gzip'),
);

// 直接作为 fetch body
await fetch('/upload', {
  method: 'POST',
  headers: { 'Content-Encoding': 'gzip' },
  body: cs.readable,  // ReadableStream
});`)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果（真实压缩对比）：'),
                h('div', { class: `cs-output ${s.compressResult.startsWith('压缩失败') ? 'cs-output--warn' : (s.compressResult ? 'cs-output--success' : '')}` }, s.compressResult || '（点击按钮尝试真实压缩 700B+ 文本，对比三种格式压缩率）'),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.compressionInfo || '（点击按钮查看 CompressionStream 构造完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 3：DecompressionStream 构造 =====================
    _runDecompressionDemo() {
        const f = this._flags();
        this._injectStyle('cs-decompression-demo', `
      .cs-decompression-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
        if (!f.decompressionStream || !f.gzipSupported || !f.readableStream) {
            this._addLog('warn', 'DecompressionStream 不可用，仅展示 API 用法');
            this.setState({ decompressResult: 'DecompressionStream 不可用' });
        }
        else {
            // 真实演示：先压缩再解压，验证往返一致
            const samples = [
                'Hello, world! 这是一段测试文本。',
                'Compression Streams API round-trip test. ' + 'ABC'.repeat(30),
                '短文本',
            ];
            Promise.all(samples.map(async (text) => {
                const compressed = await this._compress(text, 'gzip');
                const restored = await this._decompress(compressed, 'gzip');
                const match = restored === text;
                return `原文：${text.length} 字符\n  压缩：${compressed.byteLength}B\n  解压：${restored.length} 字符\n  往返一致：${match ? '✓' : '✗'}`;
            })).then((lines) => {
                this.setState({ decompressResult: lines.join('\n\n') });
                this._addLog('info', `本地解压成功（${samples.length} 个样本往返验证）`);
            }).catch((err) => {
                this.setState({ decompressResult: `解压失败：${err.name} - ${err.message}` });
                this._addLog('warn', `解压失败：${err.name} - ${err.message}`);
            });
        }
        const info = [
            '===== DecompressionStream 构造：接收压缩数据 → 解压 =====',
            '',
            '【构造签名】',
            '  new DecompressionStream(format)',
            '  // format 必须与压缩时一致',
            '',
            '  const ds = new DecompressionStream("gzip");',
            '',
            '【DecompressionStream 也是 TransformStream 子类】',
            '  ds.writable;  // 接收压缩数据',
            '  ds.readable;  // 输出解压后数据',
            '',
            '【写入压缩数据 → 读取解压数据】',
            '  const ds = new DecompressionStream("gzip");',
            '  const writer = ds.writable.getWriter();',
            '  writer.write(compressedBytes);  // Uint8Array',
            '  writer.close();',
            '',
            '  const reader = ds.readable.getReader();',
            '  const decoder = new TextDecoder();',
            '  let result = "";',
            '  for (;;) {',
            '    const { value, done } = await reader.read();',
            '    if (done) break;',
            '    result += decoder.decode(value, { stream: true });',
            '  }',
            '  result += decoder.decode();  // flush 末尾残缺字节',
            '  console.log(result);',
            '',
            '【format 必须匹配】',
            '  // 错误的 format 会抛异常',
            '  try {',
            '    const ds = new DecompressionStream("deflate");  // 实际是 gzip 数据',
            '    // ... 写入 gzip 数据',
            '    // 解压时抛 "The compressed data was not valid" DOMException',
            '  } catch (err: any) {',
            '    console.error(err.name, err.message);',
            '  }',
            '',
            '【解压错误处理】',
            '  // 数据损坏、format 不匹配、不完整的 gzip 流都会抛异常',
            '  // 异常类型：DOMException',
            '  //   name: "EncodingError" 或 "InvalidStateError"',
            '',
            '  // 完整的错误处理',
            '  async function safeDecompress(bytes, format) {',
            '    try {',
            '      const ds = new DecompressionStream(format);',
            '      const writer = ds.writable.getWriter();',
            '      writer.write(bytes);',
            '      writer.close();',
            '      const reader = ds.readable.getReader();',
            '      const chunks: any[] = [];',
            '      for (;;) {',
            '        const { value, done } = await reader.read();',
            '        if (done) break;',
            '        chunks.push(value);',
            '      }',
            '      // 合并 chunks',
            '      return mergeChunks(chunks);',
            '    } catch (err: any) {',
            '      console.error("解压失败:", err.name, err.message);',
            '      return null;',
            '    }',
            '  }',
            '',
            '【与 fetch response.body 协同】',
            '  // 服务端返回 gzip 压缩响应',
            '  // 通常浏览器自动处理 Content-Encoding: gzip',
            '  // 但若服务端返回 Content-Type: application/gzip（非 transport 压缩）',
            '  // 需手动解压',
            '',
            '  const resp = await fetch("/api/data.gz");',
            '  const compressedStream = resp.body;  // ReadableStream<Uint8Array>',
            '  const decompressedStream = compressedStream.pipeThrough(',
            '    new DecompressionStream("gzip"),',
            '  );',
            '  const reader = decompressedStream.getReader();',
            '  const decoder = new TextDecoder();',
            '  let text = "";',
            '  for (;;) {',
            '    const { value, done } = await reader.read();',
            '    if (done) break;',
            '    text += decoder.decode(value, { stream: true });',
            '  }',
            '  text += decoder.decode();',
            '',
            '【解压不完整数据】',
            '  // 截断的 gzip 流会抛异常',
            '  const truncated = compressedBytes.slice(0, compressedBytes.length - 10);',
            '  // DecompressionStream 抛 "The compressed data was truncated" ',
            '',
            '【浏览器支持】',
            `  DecompressionStream: ${f.decompressionStream ? '✓' : '✗'}`,
            `  gzip: ${f.gzipSupported ? '✓' : '✗'}`,
            `  ReadableStream: ${f.readableStream ? '✓' : '✗'}`,
            '',
            '【常见陷阱】',
            '  1. format 必须与压缩时一致，否则抛 EncodingError',
            '  2. 截断的压缩流抛异常，需 try/catch',
            '  3. 解压结果可能跨多个 chunk，必须循环 read',
            '  4. TextDecoder 的 stream: true + 末尾 flush 不可少',
            '  5. Content-Encoding: gzip 浏览器自动解压，无需手动 DecompressionStream',
        ].join('\n');
        this.setState({ decompressionInfo: info });
        this._addLog('cs', `DecompressionStream 构造演示完成：format 匹配 + 错误处理 + fetch 协同`);
    }
    _renderCard3() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '3. DecompressionStream 构造 —— 接收压缩 → 解压 + format 匹配 + 错误处理',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['DecompressionStream', f.decompressionStream],
                ['gzip', f.gzipSupported],
            ]), h(Tag, { color: 'primary' }, '解压')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'new DecompressionStream(format) 与 CompressionStream 对称，writable 接收压缩数据，readable 输出解压后数据。format 必须与压缩时一致（gzip 数据用 deflate 解压抛 EncodingError）。截断或损坏的压缩流抛异常需 try/catch。与 fetch response.body 协同：服务端返回 Content-Type: application/gzip 时手动解压（Content-Encoding: gzip 浏览器自动处理）。TextDecoder stream:true + 末尾 decode() flush 不可少。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行解压演示', { type: 'primary', size: 'sm', disabled: !f.decompressionStream, onClick: () => this._runDecompressionDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, `// 解压流程
const ds = new DecompressionStream('gzip');
const writer = ds.writable.getWriter();
writer.write(compressedBytes);  // Uint8Array
writer.close();

const reader = ds.readable.getReader();
const decoder = new TextDecoder();
let text = '';
for (;;) {
  const { value, done } = await reader.read();
  if (done) break;
  text += decoder.decode(value, { stream: true });
}
text += decoder.decode();  // flush

// 与 fetch response.body 协同（手动解压）
const resp = await fetch('/api/data.gz');
const decompressed = resp.body.pipeThrough(
  new DecompressionStream('gzip'),
);
const reader = decompressed.getReader();
// ... 循环 read

// 错误处理
try {
  await decompress(bytes, 'gzip');
} catch (err: any) {
  console.error('解压失败:', err.name); // EncodingError
}`)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果（往返一致验证）：'),
                h('div', { class: `cs-output ${s.decompressResult.startsWith('解压失败') ? 'cs-output--warn' : (s.decompressResult ? 'cs-output--success' : '')}` }, s.decompressResult || '（点击按钮尝试真实压缩+解压往返验证 3 个样本）'),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.decompressionInfo || '（点击按钮查看 DecompressionStream 构造完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 4：与 fetch + Streams 协同 =====================
    _runFetchStreamsDemo() {
        const f = this._flags();
        this._injectStyle('cs-fetch-streams-demo', `
      .cs-fetch-streams-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
        if (!f.compressionStream || !f.readableStream) {
            this._addLog('warn', 'CompressionStream/ReadableStream 不可用，仅展示模式');
        }
        const info = [
            '===== 与 fetch + Streams 协同：pipeThrough / 上传压缩 / 流式压缩 =====',
            '',
            '【fetch + DecompressionStream：解压响应】',
            '  // 服务端返回 .gz 文件（Content-Type: application/gzip）',
            '  // 注意：Content-Encoding: gzip 由浏览器自动处理',
            '  //       只有 Content-Type: application/gzip 需手动解压',
            '',
            '  const resp = await fetch("/api/data.json.gz");',
            '  const decompressedStream = resp.body.pipeThrough(',
            '    new DecompressionStream("gzip"),',
            '  );',
            '  const reader = decompressedStream.getReader();',
            '  const decoder = new TextDecoder();',
            '  let text = "";',
            '  for (;;) {',
            '    const { value, done } = await reader.read();',
            '    if (done) break;',
            '    text += decoder.decode(value, { stream: true });',
            '  }',
            '  text += decoder.decode();',
            '  const data = JSON.parse(text);',
            '',
            '【上传前压缩：CompressionStream.readable 作为 body】',
            '  // 把 readable 直接作为 fetch body',
            '  const cs = new CompressionStream("gzip");',
            '  const writer = cs.writable.getWriter();',
            '  const encoder = new TextEncoder();',
            '',
            '  // 流式写入大文本',
            '  for (const chunk of largeTextChunks) {',
            '    await writer.ready;  // 背压',
            '    writer.write(encoder.encode(chunk));',
            '  }',
            '  writer.close();',
            '',
            '  await fetch("/upload", {',
            '    method: "POST",',
            '    headers: {',
            '      "Content-Type": "application/json",',
            '      "Content-Encoding": "gzip",',
            '    },',
            '    body: cs.readable,  // ReadableStream 作为 body',
            '  });',
            '',
            '【流式压缩大文件：内存友好】',
            '  // 传统方式：先读完整文件到内存再压缩 → 大文件 OOM',
            '  // Streams 方式：边读边压缩，内存占用恒定',
            '',
            '  async function compressFile(file) {',
            '    const cs = new CompressionStream("gzip");',
            '    const writer = cs.writable.getWriter();',
            '    const reader = file.stream().getReader();  // File 解析为 ReadableStream',
            '    // 边读边写',
            '    (async () => {',
            '      while (true) {',
            '        const { value, done } = await reader.read();',
            '        if (done) { writer.close(); break; }',
            '        await writer.ready;  // 背压',
            '        writer.write(value);',
            '      }',
            '    })();',
            '    // 边读压缩结果',
            '    const compressedReader = cs.readable.getReader();',
            '    const chunks: any[] = [];',
            '    while (true) {',
            '      const { value, done } = await compressedReader.read();',
            '      if (done) break;',
            '      chunks.push(value);',
            '    }',
            '    return new Blob(chunks);',
            '  }',
            '',
            '【pipeThrough 链式处理】',
            '  // 多个 TransformStream 串联',
            '  // 如：解压 → 解码 → JSON 解析',
            '  const pipeline = fetch(url)',
            '    .then(r => r.body',
            '      .pipeThrough(new DecompressionStream("gzip"))',
            '      .pipeThrough(new TextDecoderStream())  // Uint8Array → string',
            '    );',
            '  const reader = pipeline.getReader();',
            '  // reader.read() 直接得到 string',
            '',
            '【上传 + 压缩 + 流式：完整代码】',
            '  // 上传大文件，边压缩边上传',
            '  async function uploadCompressed(file, url) {',
            '    const cs = new CompressionStream("gzip");',
            '    // 把 file 流写入压缩流',
            '    file.stream().pipeTo(cs.writable);',
            '    // 压缩流的 readable 作为 fetch body',
            '    await fetch(url, {',
            '      method: "POST",',
            '      headers: { "Content-Encoding": "gzip" },',
            '      body: cs.readable,',
            '      duplex: "half",  // 流式 body 必须设',
            '    });',
            '  }',
            '',
            '【与 Service Worker 协同】',
            '  // Service Worker 缓存压缩后的资源',
            '  self.addEventListener("fetch", (event: any) => {',
            '    if (event.request.url.endsWith(".gz")) {',
            '      event.respondWith(',
            '        caches.open("v1").then(async (cache) => {',
            '          const cached = await cache.match(event.request);',
            '          if (cached) return cached;',
            '          const resp = await fetch(event.request);',
            '          // 解压后缓存（节省缓存空间：缓存原始而非压缩）',
            '          const decompressed = new Response(',
            '            resp.body.pipeThrough(new DecompressionStream("gzip")),',
            '          );',
            '          cache.put(event.request, decompressed.clone());',
            '          return decompressed;',
            '        }),',
            '      );',
            '    }',
            '  });',
            '',
            '【ByteLengthQueuingStrategy 背压】',
            '  // 自定义背压策略（按字节数）',
            '  const strategy = new ByteLengthQueuingStrategy({',
            '    highWaterMark: 1024 * 1024,  // 1MB',
            '  });',
            '  const rs = new ReadableStream({',
            '    start(c) { /* ... */ },',
            '    strategy,  // 注入策略',
            '  });',
            '',
            '【duplex: "half" 要求】',
            '  // 使用 ReadableStream 作为 fetch body 时必须设',
            '  await fetch(url, {',
            '    method: "POST",',
            '    body: readableStream,',
            '    duplex: "half",  // 必需！',
            '  });',
            '  // 不设会抛 TypeError',
            '',
            '【浏览器支持】',
            `  CompressionStream: ${f.compressionStream ? '✓' : '✗'}`,
            `  ReadableStream: ${f.readableStream ? '✓' : '✗'}`,
            '  fetch body ReadableStream: Chrome 105+ / Firefox 124+',
            '  duplex: "half": Chrome 105+',
            '',
            '【常见陷阱】',
            '  1. fetch body 是 ReadableStream 时必须设 duplex: "half"',
            '  2. writer.ready 是背压点，不 await 会撑爆内存',
            '  3. Content-Encoding: gzip 浏览器自动处理，无需手动 DecompressionStream',
            '  4. Content-Type: application/gzip 才需手动解压',
            '  5. pipeTo 后原 stream 锁定，不能再用',
        ].join('\n');
        this.setState({ fetchStreamsInfo: info });
        this._addLog('cs', `与 fetch + Streams 协同演示完成：pipeThrough + 上传压缩 + duplex:half`);
    }
    _renderCard4() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '4. 与 fetch + Streams 协同 —— pipeThrough / 上传压缩 / 流式大文件',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['CompressionStream', f.compressionStream],
                ['ReadableStream', f.readableStream],
            ]), h(Tag, { color: 'primary' }, 'fetch + Streams')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'fetch(url).body.pipeThrough(new DecompressionStream("gzip")) 解压响应（Content-Type: application/gzip 需手动，Content-Encoding: gzip 浏览器自动）。上传压缩：CompressionStream.readable 直接作为 fetch body（必设 duplex: "half"）。流式压缩大文件：file.stream() → pipeTo(cs.writable)，边读边压缩内存恒定。pipeThrough 链式：解压 → TextDecoderStream → JSON。Service Worker 缓存压缩资源。ByteLengthQueuingStrategy 自定义背压。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 fetch + Streams 演示', { type: 'primary', size: 'sm', disabled: !f.compressionStream, onClick: () => this._runFetchStreamsDemo() })),
                // 流式压缩流程图
                h('div', { class: 'cs-flow' }, h('span', { class: 'cs-flow-node' }, 'file.stream()'), h('span', { class: 'cs-flow-arrow' }, '→'), h('span', { class: 'cs-flow-node cs-flow-node--stream' }, 'CompressionStream.writable'), h('span', { class: 'cs-flow-arrow' }, '→'), h('span', { class: 'cs-flow-node cs-flow-node--stream' }, 'CompressionStream.readable'), h('span', { class: 'cs-flow-arrow' }, '→'), h('span', { class: 'cs-flow-node' }, 'fetch body')),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, `// 解压 fetch 响应
const resp = await fetch('/api/data.json.gz');
const decompressed = resp.body.pipeThrough(
  new DecompressionStream('gzip'),
);
const reader = decompressed.getReader();
// ... 循环 read

// 上传前压缩：readable 作为 body（必设 duplex: 'half'）
const cs = new CompressionStream('gzip');
const writer = cs.writable.getWriter();
writer.write(new TextEncoder().encode(json));
writer.close();
await fetch('/upload', {
  method: 'POST',
  headers: { 'Content-Encoding': 'gzip' },
  body: cs.readable,
  duplex: 'half',  // 必需
});

// 流式压缩大文件：内存恒定
file.stream().pipeTo(cs.writable);
await fetch(url, { method: 'POST', body: cs.readable, duplex: 'half' });

// 链式处理：解压 → 解码 → JSON
const reader = fetch(url)
  .then(r => r.body
    .pipeThrough(new DecompressionStream('gzip'))
    .pipeThrough(new TextDecoderStream()))
  .getReader();`)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.fetchStreamsInfo || '（点击按钮查看与 fetch + Streams 协同完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 5：上传大文件压缩 =====================
    _runUploadDemo() {
        const f = this._flags();
        this._injectStyle('cs-upload-demo', `
      .cs-upload-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
        if (!f.compressionStream) {
            this._addLog('warn', 'CompressionStream 不可用，仅展示模式');
        }
        const info = [
            '===== 实战：上传大文件压缩 =====',
            '',
            '【场景：上传大日志/JSON 文件】',
            '  - 用户上传 100MB 日志文件',
            '  - 服务端要求 Content-Encoding: gzip',
            '  - 传统方式：先 pako 压缩到内存再上传 → 内存峰值 200MB',
            '  - Streams 方式：边读边压缩边上传 → 内存恒定 ~1MB',
            '',
            '【FormData + CompressionStream】',
            '  // FormData 字段值可以是 ReadableStream',
            '  const file = fileInput.files[0];',
            '  const cs = new CompressionStream("gzip");',
            '  // 把 file 流写入压缩流',
            '  file.stream().pipeTo(cs.writable);',
            '',
            '  // 压缩流作为 FormData 字段',
            '  const formData = new FormData();',
            '  formData.append("file", cs.readable, file.name + ".gz");',
            '  formData.append("originalSize", file.size);',
            '',
            '  await fetch("/upload", {',
            '    method: "POST",',
            '    body: formData,',
            '    duplex: "half",',
            '  });',
            '',
            '【大日志文件上传压缩】',
            '  // 实时日志聚合场景：边产生边压缩上传',
            '  const cs = new CompressionStream("gzip");',
            '  const writer = cs.writable.getWriter();',
            '  const encoder = new TextEncoder();',
            '',
            '  // 启动上传（readable 作为 body）',
            '  const uploadPromise = fetch("/logs", {',
            '    method: "POST",',
            '    headers: { "Content-Encoding": "gzip" },',
            '    body: cs.readable,',
            '    duplex: "half",',
            '  });',
            '',
            '  // 日志产生时写入',
            '  function log(level, msg) {',
            '    const line = `${new Date().toISOString()} [${level}] ${msg}\\n`;',
            '    writer.write(encoder.encode(line));  // 流式追加',
            '  }',
            '',
            '  // 结束时关闭',
            '  function finish() {',
            '    writer.close();',
            '  }',
            '',
            '  await uploadPromise;',
            '',
            '【与 ReadableStream 配合分片压缩】',
            '  // 大文件分片压缩（如 1MB 一片）',
            '  async function compressInChunks(file, chunkSize = 1024 * 1024) {',
            '    const cs = new CompressionStream("gzip");',
            '    const writer = cs.writable.getWriter();',
            '    const reader = file.stream().getReader();',
            '    let totalRead = 0;',
            '    let totalCompressed = 0;',
            '    // 边读边写',
            '    const writePromise = (async () => {',
            '      while (true) {',
            '        const { value, done } = await reader.read();',
            '        if (done) { writer.close(); break; }',
            '        await writer.ready;  // 背压',
            '        writer.write(value);',
            '        totalRead += (value as any).byteLength;',
            '      }',
            '    })();',
            '    // 边读压缩结果',
            '    const compressedReader = cs.readable.getReader();',
            '    const chunks: any[] = [];',
            '    while (true) {',
            '      const { value, done } = await compressedReader.read();',
            '      if (done) break;',
            '      chunks.push(value);',
            '      totalCompressed += (value as any).byteLength;',
            '    }',
            '    await writePromise;',
            '    return { blob: new Blob(chunks), totalRead, totalCompressed };',
            '  }',
            '',
            '【与 Service Worker 缓存压缩协同】',
            '  // Service Worker 拦截 fetch，把响应压缩后缓存',
            '  self.addEventListener("fetch", (event: any) => {',
            '    if (event.request.destination === "image") {',
            '      event.respondWith(',
            '        caches.open("img-v1").then(async (cache) => {',
            '          const cached = await cache.match(event.request);',
            '          if (cached) {',
            '            // 解压缓存',
            '            const decompressed = new Response(',
            '              cached.body.pipeThrough(new DecompressionStream("gzip")),',
            '            );',
            '            return decompressed;',
            '          }',
            '          const resp = await fetch(event.request);',
            '          // 压缩后缓存',
            '          const cs = new CompressionStream("gzip");',
            '          resp.body.pipeTo(cs.writable);',
            '          const compressed = new Response(cs.readable);',
            '          cache.put(event.request, compressed.clone());',
            '          return resp;  // 返回原始（浏览器渲染需要）',
            '        }),',
            '      );',
            '    }',
            '  });',
            '',
            '【上传进度监控】',
            '  // 监控已上传字节数（无法监控压缩后字节数）',
            '  async function uploadWithProgress(file, url, onProgress) {',
            '    const cs = new CompressionStream("gzip");',
            '    file.stream().pipeTo(cs.writable);',
            '    // 用 ReadableStream 包装，Tee 出一份用于进度',
            '    let uploaded = 0;',
            '    const progressStream = new ReadableStream({',
            '      start(controller) {',
            '        const reader = cs.readable.getReader();',
            '        (async () => {',
            '          while (true) {',
            '            const { value, done } = await reader.read();',
            '            if (done) { controller.close(); break; }',
            '            uploaded += (value as any).byteLength;',
            '            onProgress(uploaded);',
            '            controller.enqueue(value);',
            '          }',
            '        })();',
            '      },',
            '    });',
            '    return fetch(url, {',
            '      method: "POST",',
            '      body: progressStream,',
            '      duplex: "half",',
            '    });',
            '  }',
            '',
            '【浏览器支持】',
            `  CompressionStream: ${f.compressionStream ? '✓' : '✗'}`,
            `  ReadableStream: ${f.readableStream ? '✓' : '✗'}`,
            '  fetch body ReadableStream: Chrome 105+',
            '  duplex: "half": Chrome 105+',
            '',
            '【常见陷阱】',
            '  1. fetch body 是 ReadableStream 必须设 duplex: "half"',
            '  2. FormData 字段值是 ReadableStream 时部分浏览器不支持',
            '  3. Service Worker 中 CompressionStream 可用（Worker 上下文）',
            '  4. 大文件压缩可能阻塞主线程，建议用 Web Worker',
            '  5. 上传进度无法精确（压缩后字节数未知）',
        ].join('\n');
        this.setState({ uploadInfo: info });
        this._addLog('cs', `上传大文件压缩演示完成：FormData + ReadableStream + Service Worker`);
    }
    _renderCard5() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '5. 实战：上传大文件压缩 —— FormData + ReadableStream + Service Worker',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['CompressionStream', f.compressionStream],
                ['ReadableStream', f.readableStream],
            ]), h(Tag, { color: 'primary' }, '上传压缩')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'FormData + CompressionStream：file.stream() pipeTo cs.writable，cs.readable 作为 FormData 字段或 fetch body（duplex:"half"）。大日志文件上传：边产生边写入 writer.write()，结束时 writer.close()。分片压缩：1MB 一片，await writer.ready 背压。Service Worker 协同：拦截响应压缩后缓存，读取时解压。上传进度：用 ReadableStream 包装 tee 计数（无法精确监控压缩后字节）。大文件压缩建议用 Web Worker 避免阻塞主线程。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行上传压缩演示', { type: 'primary', size: 'sm', disabled: !f.compressionStream, onClick: () => this._runUploadDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, `// FormData + 压缩
const file = fileInput.files[0];
const cs = new CompressionStream('gzip');
file.stream().pipeTo(cs.writable);

const formData = new FormData();
formData.append('file', cs.readable, file.name + '.gz');
await fetch('/upload', {
  method: 'POST',
  body: formData,
  duplex: 'half',
});

// 实时日志上传
const cs = new CompressionStream('gzip');
const writer = cs.writable.getWriter();
const upload = fetch('/logs', {
  method: 'POST',
  headers: { 'Content-Encoding': 'gzip' },
  body: cs.readable,
  duplex: 'half',
});
function log(level, msg) {
  writer.write(new TextEncoder().encode(
    new Date().toISOString() + " [" + level + "] " + msg + "\\n"
  ));
}
// ... 持续 log
writer.close();
await upload;

// Service Worker 缓存压缩
self.addEventListener('fetch', (event: any) => {
  // 拦截 + 压缩 + 缓存
});`)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.uploadInfo || '（点击按钮查看上传大文件压缩完整方案）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 6：下载解压流 =====================
    _runDownloadDemo() {
        const f = this._flags();
        this._injectStyle('cs-download-demo', `
      .cs-download-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
        if (!f.decompressionStream) {
            this._addLog('warn', 'DecompressionStream 不可用，仅展示模式');
        }
        const info = [
            '===== 实战：下载解压流 =====',
            '',
            '【Content-Encoding: gzip 浏览器自动处理】',
            '  // 服务端响应头：',
            '  //   Content-Encoding: gzip',
            '  //   Content-Type: application/json',
            '',
            '  // 浏览器自动解压，response.text() / response.json() 直接可用',
            '  const resp = await fetch("/api/data");  // 服务端 gzip',
            '  const data = await resp.json();  // 已解压，无需手动处理',
            '',
            '  // Accept-Encoding: gzip 让服务端知道客户端支持',
            '  // 浏览器自动加，无需手动设',
            '',
            '【Content-Type: application/gzip 需手动解压】',
            '  // 服务端返回 .gz 文件本身（如下载打包好的数据）',
            '  //   Content-Type: application/gzip',
            '  //   Content-Disposition: attachment; filename="data.json.gz"',
            '',
            '  const resp = await fetch("/api/data.json.gz");',
            '  const decompressedStream = resp.body.pipeThrough(',
            '    new DecompressionStream("gzip"),',
            '  );',
            '  const reader = decompressedStream.getReader();',
            '  const decoder = new TextDecoder();',
            '  let text = "";',
            '  for (;;) {',
            '    const { value, done } = await reader.read();',
            '    if (done) break;',
            '    text += decoder.decode(value, { stream: true });',
            '  }',
            '  text += decoder.decode();',
            '  const data = JSON.parse(text);',
            '',
            '【手动解压场景】',
            '  1. 服务端返回 .gz 文件本身（非 transport 压缩）',
            '  2. 自定义协议：客户端与服务端约定 gzip 包装',
            '  3. WebSocket / WebTransport 二进制消息解压',
            '  4. IndexedDB 存储压缩数据，读取时解压',
            '  5. 用户上传 .gz 文件，前端预览内容',
            '',
            '【Web Worker 中并行压缩】',
            '  // 主线程',
            '  const worker = new Worker("compress-worker.js");',
            '  const file = fileInput.files[0];',
            '  worker.postMessage({ file });',
            '  worker.onmessage = (e) => {',
            '    console.log("压缩完成:", e.data.compressed);',
            '  };',
            '',
            '  // compress-worker.js',
            '  self.onmessage = async (e) => {',
            '    const { file } = e.data;',
            '    const cs = new CompressionStream("gzip");',
            '    file.stream().pipeTo(cs.writable);',
            '    const reader = cs.readable.getReader();',
            '    const chunks: any[] = [];',
            '    while (true) {',
            '      const { value, done } = await reader.read();',
            '      if (done) break;',
            '      chunks.push(value);',
            '    }',
            '    self.postMessage({ compressed: new Blob(chunks) });',
            '  };',
            '',
            '【ByteLengthQueuingStrategy 背压】',
            '  // 大文件解压时，下游消费慢会导致内存积压',
            '  // 用 ByteLengthQueuingStrategy 限制队列',
            '',
            '  const highWaterMark = 1024 * 1024;  // 1MB',
            '  const strategy = new ByteLengthQueuingStrategy({ highWaterMark });',
            '',
            '  const rs = new ReadableStream({',
            '    async start(controller) {',
            '      // 解压数据入队',
            '    },',
            '  }, strategy);  // 第二参数是策略',
            '',
            '  // pipeThrough 自动应用策略',
            '  resp.body',
            '    .pipeThrough(new DecompressionStream("gzip"))',
            '    .pipeTo(new WritableStream({',
            '      write(chunk) { console.log("解压 chunk:", (chunk as any).byteLength); },',
            '    }));',
            '',
            '【下载进度监控】',
            '  // 监控已下载字节数（无法监控解压后字节数）',
            '  const resp = await fetch(url);',
            '  const total = +resp.headers.get("Content-Length");',
            '  let downloaded = 0;',
            '  const reader = resp.body.getReader();',
            '  // 第一层：读取下载',
            '  // 第二层：通过 DecompressionStream 解压',
            '  // 进度只能监控下载层',
            '',
            '【流式下载 + 解压 + 显示】',
            '  // 大 JSON 文件流式解析',
            '  const resp = await fetch("/api/big-data.json.gz");',
            '  const pipeline = resp.body',
            '    .pipeThrough(new DecompressionStream("gzip"))',
            '    .pipeThrough(new TextDecoderStream());',
            '',
            '  // 配合 JSON 解析库（如 stream-json）',
            '  const reader = pipeline.getReader();',
            '  let buffer = "";',
            '  while (true) {',
            '    const { value, done } = await reader.read();',
            '    if (done) break;',
            '    buffer += value;',
            '    // 流式提取完整 JSON 对象',
            '    while (buffer.includes("}")) {',
            '      const idx = buffer.indexOf("}");',
            '      const obj = JSON.parse(buffer.slice(0, idx + 1));',
            '      handleObject(obj);',
            '      buffer = buffer.slice(idx + 1);',
            '    }',
            '  }',
            '',
            '【浏览器支持】',
            `  DecompressionStream: ${f.decompressionStream ? '✓' : '✗'}`,
            `  ReadableStream: ${f.readableStream ? '✓' : '✗'}`,
            `  TransformStream: ${f.transformStream ? '✓' : '✗'}`,
            '  Web Worker CompressionStream: Chrome 80+',
            '  ByteLengthQueuingStrategy: 全平台',
            '',
            '【常见陷阱】',
            '  1. Content-Encoding: gzip 浏览器自动处理，无需手动 DecompressionStream',
            '  2. Content-Type: application/gzip 才需手动解压',
            '  3. 大文件解压在主线程会阻塞 UI，建议 Web Worker',
            '  4. ByteLengthQueuingStrategy 默认 highWaterMark=0，需显式设',
            '  5. 流式 JSON 解析需自己实现（无标准 API）',
        ].join('\n');
        this.setState({ downloadInfo: info });
        this._addLog('cs', `下载解压流演示完成：Content-Encoding vs Content-Type + Web Worker + 背压`);
    }
    _renderCard6() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '6. 实战：下载解压流 —— Content-Encoding / 手动解压 / Web Worker / 背压',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['DecompressionStream', f.decompressionStream],
                ['ReadableStream', f.readableStream],
            ]), h(Tag, { color: 'primary' }, '下载解压')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'Content-Encoding: gzip 浏览器自动处理（response.json() 直接可用，无需手动 DecompressionStream）；Content-Type: application/gzip 需手动 pipeThrough(new DecompressionStream)。手动解压场景：.gz 文件下载、自定义协议、WebSocket 消息、IndexedDB 压缩存储、用户上传预览。Web Worker 并行压缩避免阻塞主线程。ByteLengthQueuingStrategy 提供背压（highWaterMark 默认 0 需显式设）。下载进度只能监控下载层（无法监控解压后字节）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行下载解压演示', { type: 'primary', size: 'sm', disabled: !f.decompressionStream, onClick: () => this._runDownloadDemo() })),
                // 下载解压流程图
                h('div', { class: 'cs-flow' }, h('span', { class: 'cs-flow-node' }, 'fetch(url)'), h('span', { class: 'cs-flow-arrow' }, '→'), h('span', { class: 'cs-flow-node cs-flow-node--stream' }, 'resp.body'), h('span', { class: 'cs-flow-arrow' }, '→'), h('span', { class: 'cs-flow-node cs-flow-node--stream' }, 'DecompressionStream'), h('span', { class: 'cs-flow-arrow' }, '→'), h('span', { class: 'cs-flow-node cs-flow-node--stream' }, 'TextDecoderStream'), h('span', { class: 'cs-flow-arrow' }, '→'), h('span', { class: 'cs-flow-node' }, 'string')),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, `// Content-Encoding: gzip 浏览器自动处理
const resp = await fetch('/api/data');  // 服务端 gzip
const data = await resp.json();  // 已解压

// Content-Type: application/gzip 需手动解压
const resp = await fetch('/api/data.json.gz');
const decompressed = resp.body
  .pipeThrough(new DecompressionStream('gzip'))
  .pipeThrough(new TextDecoderStream());
const reader = decompressed.getReader();
let text = '';
for (;;) {
  const { value, done } = await reader.read();
  if (done) break;
  text += value;
}
const data = JSON.parse(text);

// Web Worker 中压缩
const worker = new Worker('compress-worker.js');
worker.postMessage({ file });

// ByteLengthQueuingStrategy 背压
const strategy = new ByteLengthQueuingStrategy({ highWaterMark: 1024 * 1024 });`)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.downloadInfo || '（点击按钮查看下载解压流完整方案）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 7：性能与压缩率对比 =====================
    _runPerformanceDemo() {
        const f = this._flags();
        this._injectStyle('cs-performance-demo', `
      .cs-performance-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
        if (!f.compressionStream || !f.readableStream) {
            this._addLog('warn', 'CompressionStream 不可用，性能对比仅展示说明');
            this.setState({ perfResult: 'CompressionStream 不可用' });
        }
        else {
            // 真实性能对比：不同文本类型 × 不同格式
            const samples = {
                '重复文本（高压缩率）': 'AAAAAAAAAA'.repeat(500),
                '英文散文': 'The quick brown fox jumps over the lazy dog. '.repeat(50),
                '中文文本': '压缩流 API 是浏览器原生能力，性能优于 JS 库。'.repeat(20),
                '随机字符（低压缩率）': Array.from({ length: 500 }, () => String.fromCharCode(33 + Math.floor(Math.random() * 90))).join(''),
                'JSON 数据': JSON.stringify({ items: Array.from({ length: 50 }, (_, i) => ({ id: i, name: `item-${i}` })) }),
            };
            const formats = ['gzip', 'deflate', 'deflate-raw'].filter((fmt) => {
                try {
                    new CompressionStream(fmt);
                    return true;
                }
                catch {
                    return false;
                }
            });
            Promise.all(Object.entries(samples).map(async ([name, text]) => {
                const original = new TextEncoder().encode(text).byteLength;
                const lines = [`${name}（原始 ${original}B）:`];
                for (const fmt of formats) {
                    const t0 = performance.now();
                    const compressed = await this._compress(text, fmt);
                    const t1 = performance.now();
                    const ratio = (compressed.byteLength / original * 100).toFixed(1);
                    lines.push(`  ${fmt.padEnd(12)} → ${compressed.byteLength}B（压缩率 ${ratio}%，耗时 ${(t1 - t0).toFixed(1)}ms）`);
                }
                return lines.join('\n');
            })).then((results) => {
                this.setState({ perfResult: results.join('\n\n') });
                this._addLog('info', `性能对比完成（${Object.keys(samples).length} 类文本 × ${formats.length} 格式）`);
            }).catch((err) => {
                this.setState({ perfResult: `性能测试失败：${err.name} - ${err.message}` });
                this._addLog('warn', `性能测试失败：${err.name} - ${err.message}`);
            });
        }
        const info = [
            '===== 性能与压缩率对比：CompressionStream vs pako/fflate =====',
            '',
            '【CompressionStream vs pako 性能对比】',
            '  维度              CompressionStream    pako',
            '  -----------------------------------------------------------',
            '  实现语言          原生 C++             JavaScript',
            '  启动开销          ✓ 0（浏览器内置）    ✗ 库加载 ~45KB',
            '  压缩速度          ✓ ~500MB/s           △ ~200MB/s',
            '  解压速度          ✓ ~1GB/s             △ ~500MB/s',
            '  内存占用          ✓ 低（流式）         △ 高（全量）',
            '  压缩级别          ✗ 不可配置（默认 6） ✓ 1-9 可配置',
            '  流式支持          ✓ 原生               △ 需手动 chunking',
            '  与 Streams 协同    ✓ 原生 pipeThrough   ✗ 需手动包装',
            '',
            '【不同 level 对比（pako 可配置，CompressionStream 固定）】',
            '  // pako 可配置 1-9',
            '  //   level 1: 速度最快，压缩率最低',
            '  //   level 6: 默认，平衡',
            '  //   level 9: 速度最慢，压缩率最高',
            '  pako.gzip(text, { level: 1 });  // 快',
            '  pako.gzip(text, { level: 9 });  // 慢但小',
            '',
            '  // CompressionStream 固定 level 6（无法配置）',
            '  new CompressionStream("gzip");  // 等价 pako level 6',
            '',
            '  压缩率差异：',
            '    level 1 vs level 6: 压缩率差 ~5-10%',
            '    level 6 vs level 9: 压缩率差 ~1-3%',
            '    CompressionStream(level 6) 介于 pako level 6-7',
            '',
            '【浏览器原生 vs WASM 实现】',
            '  // WASM 压缩库（如 fflate-wasm）',
            '  //   - 体积：~30KB',
            '  //   - 速度：~300MB/s（介于 CompressionStream 和 JS pako 之间）',
            '  //   - 压缩级别：可配置',
            '  //   - 跨平台一致',
            '',
            '  // CompressionStream 优势：',
            '  //   - 0 体积',
            '  //   - 与 Streams 原生协同',
            '  //   - 浏览器持续优化（V8 引擎级优化）',
            '',
            '【不同文本类型的压缩率】',
            '  文本类型              压缩率（gzip level 6）',
            '  -----------------------------------------------',
            '  重复文本（AAAAAA）    ~1%（极高）',
            '  英文散文              ~30-40%',
            '  中文文本              ~40-50%',
            '  JSON 数据             ~15-25%',
            '  HTML                  ~20-30%',
            '  CSS                   ~30-40%',
            '  JavaScript（minified） ~50-60%',
            '  随机字符              ~100%（无压缩效果）',
            '  已压缩数据（jpg/png） ~100%（无效）',
            '',
            '【不同格式取舍】',
            '  gzip        通用性最好，浏览器自动处理',
            '              体积略大（10 字节 header + 8 字节 footer）',
            '              适合：HTTP transport 压缩',
            '',
            '  deflate     zlib 兼容（与 Node.js zlib API 一致）',
            '              体积略小（2 字节 header + 4 字节 adler32）',
            '              适合：与 zlib 互通的场景',
            '',
            '  deflate-raw 体积最小（无 header/footer）',
            '              需自行管理校验与边界',
            '              适合：已知大小的内部数据',
            '',
            '【性能基准测试代码】',
            '  async function bench(text, format, iterations = 10) {',
            '    const encoder = new TextEncoder();',
            '    const bytes = encoder.encode(text);',
            '    const t0 = performance.now();',
            '    for (let i = 0; i < iterations; i++) {',
            '      const cs = new CompressionStream(format);',
            '      const writer = cs.writable.getWriter();',
            '      writer.write(bytes);',
            '      writer.close();',
            '      const reader = cs.readable.getReader();',
            '      while (true) {',
            '        const { done } = await reader.read();',
            '        if (done) break;',
            '      }',
            '    }',
            '    const t1 = performance.now();',
            '    return (t1 - t0) / iterations;  // 平均耗时 ms',
            '  }',
            '',
            '  // 与 pako 对比',
            '  function benchPako(text, iterations = 10) {',
            '    const t0 = performance.now();',
            '    for (let i = 0; i < iterations; i++) {',
            '      pako.gzip(text);',
            '    }',
            '    return (performance.now() - t0) / iterations;',
            '  }',
            '',
            '【内存占用对比】',
            '  // CompressionStream：流式，内存恒定 ~1MB（chunk 大小）',
            '  // pako：全量加载，内存 = 原始 + 压缩（2x）',
            '',
            '  // 大文件压缩（100MB）',
            '  //   CompressionStream: 内存峰值 ~2MB',
            '  //   pako: 内存峰值 ~200MB（OOM 风险）',
            '',
            '【浏览器支持】',
            `  CompressionStream: ${f.compressionStream ? '✓' : '✗'}`,
            '  CompressionStream 性能：Chrome 80+/Firefox 113+/Safari 16.4+ 全部稳定',
            '',
            '【常见陷阱】',
            '  1. CompressionStream 不可配置 level，需 level 控制时用 pako',
            '  2. 小数据压缩后可能更大（header 开销）',
            '  3. 已压缩数据（jpg/png/zip）压缩无效甚至变大',
            '  4. CompressionStream 性能取决于浏览器实现（V8/Blink）',
            '  5. 流式压缩内存恒定，但单 chunk 大小受 highWaterMark 影响',
        ].join('\n');
        this.setState({ performanceInfo: info });
        this._addLog('cs', `性能与压缩率对比演示完成：CompressionStream vs pako/fflate`);
    }
    _renderCard7() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '7. 性能与压缩率对比 —— CompressionStream vs pako/fflate + 不同文本类型',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['CompressionStream', f.compressionStream],
                ['gzip', f.gzipSupported],
            ]), h(Tag, { color: 'primary' }, '性能')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'CompressionStream 原生 C++ 实现速度 ~500MB/s（pako JS ~200MB/s，fflate WASM ~300MB/s），内存流式恒定 ~1MB（pako 全量 2x）。压缩级别不可配置（固定 level 6，介于 pako 6-7）。不同文本压缩率：重复文本 ~1%、JSON ~15-25%、英文 ~30-40%、中文 ~40-50%、随机/已压缩数据 ~100%（无效）。gzip 通用性最好（浏览器自动处理）；deflate zlib 兼容；deflate-raw 体积最小但需自管理边界。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行性能对比演示', { type: 'primary', size: 'sm', disabled: !f.compressionStream, onClick: () => this._runPerformanceDemo() })),
                // 三种实现对比矩阵
                h('div', { class: 'cs-matrix' }, h('div', { class: 'cs-matrix-cell' }, h('div', { class: 'cs-matrix-title' }, 'CompressionStream'), h('div', {}, '原生 C++ · ~500MB/s · 0KB · level 6 固定')), h('div', { class: 'cs-matrix-cell' }, h('div', { class: 'cs-matrix-title' }, 'pako'), h('div', {}, 'JS · ~200MB/s · 45KB · level 1-9 可配')), h('div', { class: 'cs-matrix-cell' }, h('div', { class: 'cs-matrix-title' }, 'fflate'), h('div', {}, 'JS · ~250MB/s · 8KB · level 1-9 可配')), h('div', { class: 'cs-matrix-cell' }, h('div', { class: 'cs-matrix-title' }, 'fflate-wasm'), h('div', {}, 'WASM · ~300MB/s · 30KB · level 1-9 可配'))),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, `// 性能基准测试
async function bench(text, format, iterations = 10) {
  const bytes = new TextEncoder().encode(text);
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) {
    const cs = new CompressionStream(format);
    const writer = cs.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const reader = cs.readable.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  }
  return (performance.now() - t0) / iterations;
}

// 与 pako 对比
function benchPako(text, iterations = 10) {
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) pako.gzip(text);
  return (performance.now() - t0) / iterations;
}

// CompressionStream 内存恒定（流式）
// pako 内存 = 原始 + 压缩（2x，大文件 OOM 风险）`)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果（真实性能对比）：'),
                h('div', { class: `cs-output ${s.perfResult.startsWith('性能测试失败') ? 'cs-output--warn' : (s.perfResult ? 'cs-output--success' : '')}` }, s.perfResult || '（点击按钮尝试真实压缩 5 类文本 × 3 种格式，对比压缩率与耗时）'),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.performanceInfo || '（点击按钮查看性能与压缩率对比完整说明）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 8：陷阱与最佳实践 =====================
    _runPitfallsDemo() {
        const f = this._flags();
        this._injectStyle('cs-pitfalls-demo', `
      .cs-pitfalls-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
        const info = [
            '===== 陷阱与最佳实践：格式限制 / level / 流式 / 加密协同 =====',
            '',
            '【陷阱 1：仅支持 gzip/deflate/deflate-raw】',
            '  CompressionStream 不支持：',
            '    - bzip2（更高效但慢）',
            '    - lz4（极快但压缩率低）',
            '    - zstd（Facebook，平衡好但新）',
            '    - brotli（Google，比 gzip 好，但 CompressionStream 不支持）',
            '',
            '  替代方案：',
            '    - brotli：服务端 Content-Encoding: br，浏览器自动处理',
            '    - zstd/lz4：用 WASM 库（如 fflate-wasm-zstd）',
            '    - bzip2：少用，无标准浏览器实现',
            '',
            '【陷阱 2：压缩级别不可配置】',
            '  // CompressionStream 固定 level 6（gzip 默认）',
            '  // 无法配置 level 1（快）或 level 9（小）',
            '',
            '  // 需要 level 控制：用 pako',
            '  pako.gzip(text, { level: 1 });  // 快',
            '  pako.gzip(text, { level: 9 });  // 小',
            '',
            '  // 或 fflate',
            '  fflate.gzipSync(text, { level: 9 });',
            '',
            '【陷阱 3：流式压缩不能随机访问】',
            '  // gzip 流式压缩后，无法在末尾追加数据',
            '  //   （每个 gzip 流是独立的，append 会创建新流）',
            '',
            '  // 错误示例：',
            '  const cs = new CompressionStream("gzip");',
            '  writer.write(part1);',
            '  writer.close();',
            '  // 不能再 write(part2)，必须新建 CompressionStream',
            '',
            '  // 需要追加：用 pako 的 gzipAppend 或重新压缩',
            '',
            '【陷阱 4：小数据压缩开销】',
            '  // gzip 固定 header 18 字节（10 header + 8 footer）',
            '  // 小数据压缩后可能更大',
            '',
            '  // 示例：',
            '  //   原始 "Hello" 5 字节 → 压缩后 25 字节（变大！）',
            '  //   原始 100 字节随机 → 压缩后 118 字节',
            '',
            '  // 判断：',
            '  if (data.length < 100) {',
            '    // 不压缩，直接发送',
            '  } else {',
            '    // 用 CompressionStream 压缩',
            '  }',
            '',
            '【陷阱 5：与 Crypto.subtle 协同（先压缩后加密）】',
            '  // 重要：加密后无法压缩！',
            '  // 顺序：先压缩 → 后加密',
            '',
            '  // 错误：先加密后压缩（压缩无效，加密后是随机数据）',
            '  const encrypted = await crypto.subtle.encrypt(..., data);',
            '  const compressed = await compress(encrypted);  // ✗ 无效',
            '',
            '  // 正确：先压缩后加密',
            '  const compressed = await compress(data);  // ✓ 有效',
            '  const encrypted = await crypto.subtle.encrypt(..., compressed);',
            '',
            '  // 完整流程：',
            '  //   原始数据 → CompressionStream → 加密 → 上传',
            '  //   下载 → 解密 → DecompressionStream → 原始数据',
            '',
            '  // 加密后压缩的原理：',
            '  //   加密后的数据是高熵随机字节，压缩算法无法找到规律',
            '  //   压缩率接近 100%（即不压缩）',
            '',
            '【陷阱 6：文件类型与压缩率关系】',
            '  // 已压缩文件类型不能再压缩（甚至变大）',
            '  文件类型              压缩率',
            '  --------------------------------',
            '  文本（.txt/.json）    ~30-50% ✓',
            '  代码（.js/.css）      ~30-50% ✓',
            '  HTML                  ~30-40% ✓',
            '  日志                  ~10-30% ✓',
            '  图片（.jpg/.png）     ~100% ✗（已压缩）',
            '  视频（.mp4/.webm）    ~100% ✗（已压缩）',
            '  音频（.mp3/.aac）     ~100% ✗（已压缩）',
            '  PDF                   ~90-95% △（部分压缩）',
            '  Office（.docx）       ~95-100% ✗（内部已 zip）',
            '  zip/gzip              ~100% ✗（已压缩）',
            '',
            '  // 判断是否值得压缩：',
            '  const COMPRESSIBLE_TYPES = ["text/", "application/json", "application/xml", "application/javascript"];',
            '  function shouldCompress(contentType) {',
            '    return COMPRESSIBLE_TYPES.some(t => contentType.startsWith(t));',
            '  }',
            '',
            '【陷阱 7：format 不匹配解压失败】',
            '  // gzip 数据用 deflate 解压会抛异常',
            '  try {',
            '    await decompress(gzipData, "deflate");  // ✗',
            '  } catch (err: any) {',
            '    console.error(err.name);  // EncodingError',
            '  }',
            '',
            '  // 需要识别压缩格式（无标准 API，靠 magic number）',
            '  function detectFormat(bytes) {',
            '    if (bytes[0] === 0x1f && bytes[1] === 0x8b) return "gzip";',
            '    if (bytes[0] === 0x78) return "deflate";  // zlib',
            '    return "deflate-raw";  // 兜底',
            '  }',
            '',
            '【陷阱 8：duplex: "half" 必需】',
            '  // fetch body 是 ReadableStream 时必须设',
            '  await fetch(url, {',
            '    method: "POST",',
            '    body: readableStream,',
            '    duplex: "half",  // 必需！否则抛 TypeError',
            '  });',
            '',
            '【最佳实践清单】',
            '  ✓ 通用场景用 gzip（浏览器自动处理）',
            '  ✓ 与 zlib 互通用 deflate',
            '  ✓ 已知大小内部数据用 deflate-raw（省字节）',
            '  ✓ 大文件流式压缩（内存恒定 ~1MB）',
            '  ✓ 大文件用 Web Worker 避免阻塞主线程',
            '  ✓ 小数据（< 100 字节）不压缩',
            '  ✓ 已压缩文件（jpg/png/zip）不重复压缩',
            '  ✓ 加密场景：先压缩后加密',
            '  ✓ fetch body 是 ReadableStream 时设 duplex: "half"',
            '  ✓ Service Worker 中可用 CompressionStream（Worker 上下文）',
            '  ✗ 不要用 CompressionStream 控制压缩级别（用 pako）',
            '  ✗ 不要 append 已有 gzip 流（不能随机访问）',
            '',
            '【浏览器支持总览】',
            `  CompressionStream: ${f.compressionStream ? '✓' : '✗'}`,
            `  DecompressionStream: ${f.decompressionStream ? '✓' : '✗'}`,
            `  gzip: ${f.gzipSupported ? '✓' : '✗'}`,
            `  deflate-raw: ${f.deflateRawSupported ? '✓' : '✗'}`,
            '  Chrome 80+ / Firefox 113+ / Safari 16.4+ 全部稳定',
        ].join('\n');
        this.setState({ pitfallsInfo: info });
        this._addLog('cs', `陷阱与最佳实践演示完成：8 大陷阱 + 12 条最佳实践`);
    }
    _renderCard8() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '8. 陷阱与最佳实践 —— 格式限制 / level / 流式 / 加密协同 / 文件类型',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['CompressionStream', f.compressionStream],
                ['DecompressionStream', f.decompressionStream],
            ]), h(Tag, { color: 'warning' }, '陷阱 + 最佳实践')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '8 大陷阱：仅支持 gzip/deflate/deflate-raw（无 bzip2/lz4/zstd/brotli，brotli 用服务端 Content-Encoding: br）/ level 不可配置（固定 6，需控制用 pako）/ 流式不能随机访问（不能 append 已有 gzip）/ 小数据压缩开销（gzip header 18 字节，< 100 字节不压缩）/ 与 Crypto.subtle 协同必须先压缩后加密（加密后无法压缩）/ 文件类型与压缩率（已压缩 jpg/png/zip 不重复压缩）/ format 不匹配抛 EncodingError（靠 magic number 识别）/ fetch body ReadableStream 必设 duplex:half。12 条最佳实践覆盖格式选择、流式压缩、Web Worker、小数据跳过、加密顺序、duplex 等。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行陷阱与最佳实践演示', { type: 'primary', size: 'sm', disabled: !f.compressionStream, onClick: () => this._runPitfallsDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, `// 陷阱 4：小数据不压缩
if (data.length < 100) {
  // 直接发送
} else {
  await compress(data);
}

// 陷阱 5：先压缩后加密（不能反过来）
const compressed = await compress(data);     // ✓ 先压缩
const encrypted = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  key,
  compressed,  // 压缩后数据
);
// 上传 encrypted
// 下载 → 解密 → decompress

// 陷阱 6：判断文件类型是否值得压缩
function shouldCompress(contentType) {
  return ['text/', 'application/json', 'application/xml',
          'application/javascript'].some(t => contentType.startsWith(t));
}

// 陷阱 7：识别压缩格式（无标准 API，靠 magic number）
function detectFormat(bytes) {
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return 'gzip';
  if (bytes[0] === 0x78) return 'deflate';
  return 'deflate-raw';
}

// 陷阱 8：fetch body ReadableStream 必设 duplex
await fetch(url, {
  method: 'POST',
  body: readableStream,
  duplex: 'half',  // 必需
});`)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } }, h('code', {}, s.pitfallsInfo || '（点击按钮查看 8 大陷阱与 12 条最佳实践完整说明）')),
                h(Alert, {
                    type: 'warning',
                    message: '仅支持 gzip/deflate/deflate-raw；压缩级别固定 6；先压缩后加密',
                    description: '8 大陷阱：仅支持三种格式（无 brotli 用 Content-Encoding: br）/ level 不可配置（需 pako）/ 流式不能 append / 小数据不压缩（header 18B）/ 先压缩后加密（加密后无法压缩）/ 已压缩文件不重复 / format 靠 magic number 识别 / duplex:half 必需。12 条最佳实践覆盖格式选择、流式压缩、Web Worker、加密顺序、duplex 等。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== 日志面板 =====================
    _renderLogPanel() {
        const s = this.state;
        if (!s.logs || s.logs.length === 0)
            return null;
        return h(Card, { title: '运行日志' }, h('div', { class: 'log-list' }, ...s.logs.map((log) => h('div', { class: `log-item log-${log.type}` }, h('span', { class: 'log-time' }, log.time), h('span', { class: 'log-content' }, log.content)))));
    }
    // ===================== 渲染入口 =====================
    renderPage() {
        const s = this.state;
        return [
            h('h2', { class: 'section-title' }, 'Compression Streams API 完整实验室'),
            h(Alert, {
                type: 'info',
                message: 'Compression Streams API —— 浏览器原生 CompressionStream + DecompressionStream 深度实验室',
                description: '演示浏览器原生压缩能力（CompressionStream + DecompressionStream，W3C 标准，继承 TransformStream，readable + writable duplex，与 fetch/ReadableStream/pipeThrough 原生协同）：CompressionStream 构造（new CompressionStream(format) format 为 gzip/deflate/deflate-raw / gzip RFC 1952 有 header+footer 含原始大小浏览器自动处理 / deflate RFC 1950 zlib 2 字节 header+4 字节 adler32 / deflate-raw RFC 1971 无 header 体积最小 / writable.getWriter 写入 + readable.getReader 读取 / pipeThrough 串联 ReadableStream / 作为 fetch body）、DecompressionStream 构造（接收压缩数据 → 解压 / format 必须匹配否则抛 EncodingError / 截断或损坏抛异常 / 与 fetch response.body 协同 / Content-Type: application/gzip 手动解压 vs Content-Encoding: gzip 浏览器自动）、与 fetch + Streams 协同（fetch(url).body.pipeThrough(new DecompressionStream) / 上传前压缩 readable 作为 body 必设 duplex:half / 流式压缩大文件 file.stream → pipeTo cs.writable 内存恒定 / pipeThrough 链式 解压 → TextDecoderStream → JSON / Service Worker 缓存压缩 / ByteLengthQueuingStrategy 背压）、上传大文件压缩（FormData + CompressionStream / 大日志文件边产生边上传 / 分片压缩 await writer.ready 背压 / Service Worker 协同 / 上传进度监控）、下载解压流（Content-Encoding 浏览器自动 vs Content-Type 手动 / Web Worker 并行压缩避免阻塞 / 流式 JSON 解析）、性能与压缩率对比（CompressionStream 原生 C++ ~500MB/s vs pako JS ~200MB/s vs fflate WASM ~300MB/s / 内存流式恒定 vs 全量 2x / level 不可配置固定 6 / 不同文本压缩率 重复 1% / JSON 15-25% / 中文 40-50% / 随机 100% / 已压缩无效）、陷阱与最佳实践（仅 gzip/deflate/deflate-raw 无 brotli 用 Content-Encoding: br / level 不可配置 / 流式不能 append / 小数据不压缩 / 先压缩后加密 / 文件类型与压缩率 / format 靠 magic number 识别 / duplex:half 必需 / 12 条最佳实践）。jsdom 较新版本支持 CompressionStream，可真实运行压缩演示；老版本无此 API 仅记日志绝不抛异常；真实浏览器全部稳定多年。',
            }),
            s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
            h('div', { class: 'feature-grid' }, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderCard7(), this._renderCard8()),
            this._renderLogPanel(),
        ];
    }
}
//# sourceMappingURL=CompressionStreamsPage.js.map