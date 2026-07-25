// =====================================================================
// URLEncodingDeepPage.js —— URL 与编码深入 实验室
// 演示 MDN：
//   1. URL 与 URLSearchParams —— new URL(input, base)、属性全集、searchParams 增删改查、
//      静态方法 URL.canParse / URL.parse / URL.createObjectURL / URL.revokeObjectURL
//   2. TextEncoder / TextDecoder —— encode / encodeInto / decode、多编码 label、fatal / ignoreBOM
//   3. TextEncoderStream / TextDecoderStream —— TransformStream、readable / writable、pipeThrough 往返
//   4. btoa / atob 与 Base64 —— Latin1 限制、Unicode 兼容技巧、TextEncoder 路线、Base64URL、JWT 结构
//   5. Percent-encoding / URI encoding —— encodeURI / decodeURI / encodeURIComponent / decodeURIComponent、UTF-8 百分号编码
//   6. URL 模式与解析边界 —— URLPattern(test/exec/groups)、URL.parse 严格模式 vs try/catch、
//      IDN/punycode、IPv4/IPv6、file/data/blob/javascript 协议
// 说明：URL 与编码是 Web 的基础设施。所有 API 调用前做 typeof 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。URLPattern 在 integration_test.mjs 中已有 polyfill 兜底。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class URLEncodingDeepPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      // Card 1：URL 与 URLSearchParams
      urlInfo: '',
      // Card 2：TextEncoder / TextDecoder
      textEncInfo: '',
      // Card 3：TextEncoderStream / TextDecoderStream
      streamInfo: '',
      // Card 4：btoa / atob 与 Base64
      base64Info: '',
      // Card 5：Percent-encoding / URI encoding
      percentInfo: '',
      // Card 6：URL 模式与解析边界
      patternInfo: '',
      // Card 9：URLPattern API + Text Fragments
      urlPatternInfo: '',
      textFragmentsInfo: '',
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._streamReader = null;       // Card 3 流式读取的 reader
    this._abortController = null;    // Card 3 中止读取的 AbortController

    // 一次性能力检测：URL 与编码全家桶
    const hasURL = typeof URL !== 'undefined';
    const hasURLSearchParams = typeof URLSearchParams !== 'undefined';
    const hasTextEncoder = typeof TextEncoder !== 'undefined';
    const hasTextDecoder = typeof TextDecoder !== 'undefined';
    const hasTextDecoderStream = typeof TextDecoderStream !== 'undefined';
    const hasTextEncoderStream = typeof TextEncoderStream !== 'undefined';
    const hasBtoa = typeof btoa === 'function';
    const hasAtob = typeof atob === 'function';
    const hasURLPattern = typeof URLPattern !== 'undefined';

    const parts = [];
    parts.push(`URL ${hasURL ? '✓' : '✗'}`);
    parts.push(`URLSearchParams ${hasURLSearchParams ? '✓' : '✗'}`);
    parts.push(`TextEncoder ${hasTextEncoder ? '✓' : '✗'}`);
    parts.push(`TextDecoder ${hasTextDecoder ? '✓' : '✗'}`);
    parts.push(`TextEncoderStream ${hasTextEncoderStream ? '✓' : '✗'}`);
    parts.push(`TextDecoderStream ${hasTextDecoderStream ? '✓' : '✗'}`);
    parts.push(`btoa ${hasBtoa ? '✓' : '✗'}`);
    parts.push(`atob ${hasAtob ? '✓' : '✗'}`);
    parts.push(`URLPattern ${hasURLPattern ? '✓' : '✗'}`);

    // 深度能力检测：URLPattern API + Text Fragments（_safe 包裹，绝不抛异常）
    const hasURLPatternTest = this._safe(() => typeof URLPattern === 'function' && typeof new URLPattern('https://example.com/:id').test === 'function');
    const hasFragmentDirective = this._safe(() => typeof FragmentDirective !== 'undefined');
    const hasTextFragmentHash = this._safe(() => { const u = new URL('https://example.com#:~:text=foo'); return u.hash.includes(':~:'); });
    parts.push(`URLPattern.test ${hasURLPatternTest ? '✓' : '✗'}`);
    parts.push(`FragmentDirective ${hasFragmentDirective ? '✓' : '✗'}`);
    parts.push(`TextFragment hash ${hasTextFragmentHash ? '✓' : '✗'}`);

    const anyAvailable = hasURL || hasTextEncoder;
    const summary = anyAvailable
      ? `URL 与编码能力检测：${parts.join(' · ')}。URL / URLSearchParams / TextEncoder / TextDecoder / btoa / atob 在 Node 与 jsdom 中真实可用，可完整演示解析、编解码与 Base64。TextEncoderStream / TextDecoderStream / URLPattern 由 integration_test.mjs 提供 polyfill 兜底（不可用时仅记日志说明）。`
      : '当前环境不支持 URL / TextEncoder（typeof 均为 "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。';

    this.setState({ capsSummary: summary });
    this._addLog(anyAvailable ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!hasTextEncoderStream || !hasTextDecoderStream) this._addLog('warn', 'TextEncoderStream / TextDecoderStream 不可用（jsdom 通常无，polyfill 兜底）');
    if (!hasURLPattern) this._addLog('warn', 'URLPattern 不可用（polyfill 已兜底，建议 Chrome 95+ 完整支持）');
    if (!hasURLPatternTest) this._addLog('warn', 'URLPattern.test 方法不可用（构造或调用失败，可能 polyfill 行为不一致）');
    if (!hasFragmentDirective) this._addLog('warn', 'FragmentDirective 不可用（Chrome 实验性 API，仅部分浏览器支持）');
    if (!hasTextFragmentHash) this._addLog('warn', 'Text Fragments hash 解析不可用（#:~:text= 语法，浏览器支持不一）');
  }

  componentWillUnmount() {
    // 释放流式读取的 reader 与中止控制器（try/catch 每个，避免互相影响）
    if (this._streamReader) {
      try { this._streamReader.releaseLock(); } catch { /* noop */ }
      try { this._streamReader.cancel(); } catch { /* noop */ }
    }
    this._streamReader = null;
    if (this._abortController) { try { this._abortController.abort(); } catch { /* noop */ } }
    this._abortController = null;
  }

  // —— 日志 / 按钮 / 能力标签辅助 ——

  _addLog(type, content) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  // 安全执行能力检测：任何异常都返回 false（绝不抛出），用于 URLPattern / FragmentDirective 等可能未实现的 API
  _safe(fn) {
    try { return !!fn(); } catch { return false; }
  }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // 接受 [label, ok] 元组数组，返回对应 Tag 组件数组（用于 Card 的 extra 展示）
  _caps(items) {
    return items.map(([label, ok]) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  // =================== Card 1：URL 与 URLSearchParams ===================

  // 解析复杂 URL，展示全部属性
  _parseComplexURL() {
    if (typeof URL === 'undefined') {
      this._addLog('warn', 'URL 不可用（typeof URL === "undefined"）');
      this.setState({ urlInfo: 'URL 不可用：typeof URL === "undefined"。\n测试环境需 Node 10+ 或浏览器。' });
      return;
    }
    try {
      const input = 'https://user:pass@example.com:8080/path/to/page?a=1&b=2&a=3#frag';
      const u = new URL(input);
      const props = ['href', 'origin', 'protocol', 'username', 'password', 'host', 'hostname', 'port', 'pathname', 'search', 'searchParams', 'hash'];
      const lines = [
        `输入：new URL('${input}')`, '', '===== URL 属性全集 =====',
        ...props.map((k) => `  ${k.padEnd(12)} = ${k === 'searchParams' ? String(u[k]) : u[k]}`),
        '', '说明：host = hostname:port；origin = protocol://host；searchParams 是 URLSearchParams 实例（live，与 search 双向同步）。',
      ];
      this.setState({ urlInfo: lines.join('\n') });
      this._addLog('url', `解析复杂 URL：host=${u.host}, pathname=${u.pathname}, hash=${u.hash}`);
    } catch (err) {
      this._addLog('warn', `解析 URL 失败：${err.name} - ${err.message}`);
    }
  }

  // 演示 URLSearchParams 增删改查 + 静态方法
  _mutateSearchParams() {
    if (typeof URL === 'undefined' || typeof URLSearchParams === 'undefined') {
      this._addLog('warn', 'URL / URLSearchParams 不可用');
      return;
    }
    try {
      const u = new URL('https://example.com/path?a=1&b=2&a=3');
      const sp = u.searchParams;
      const lines = ['===== URLSearchParams 增删改查 ====='];
      lines.push(`初始：sp.toString() = ${sp.toString()}`);
      lines.push(`  get('a')=${sp.get('a')}（取第一个）；getAll('a')=${JSON.stringify(sp.getAll('a'))}（取全部）`);
      lines.push(`  has('b')=${sp.has('b')}；has('a','3')=${sp.has('a', '3')}（带 value 匹配）`);
      sp.append('c', '4'); lines.push(`  append('c','4') → ${sp.toString()}`);
      sp.set('a', '99');   lines.push(`  set('a','99')（覆盖所有同名）→ ${sp.toString()}`);
      sp.delete('b');      lines.push(`  delete('b') → ${sp.toString()}`);
      sp.sort();           lines.push(`  sort() → ${sp.toString()}`);
      lines.push('', '迭代器：');
      lines.push(`  entries() → ${JSON.stringify(Array.from(sp.entries()))}`);
      lines.push(`  keys() → ${JSON.stringify(Array.from(sp.keys()))}；values() → ${JSON.stringify(Array.from(sp.values()))}`);
      const forEachList = [];
      sp.forEach((v, k) => forEachList.push(`${k}=${v}`));
      lines.push(`  forEach() → ${forEachList.join(', ')}`, '', '===== URL 静态方法 =====');
      const hasCanParse = typeof URL.canParse === 'function';
      const hasParse = typeof URL.parse === 'function';
      const hasCreateObjectURL = typeof URL.createObjectURL === 'function';
      const hasRevokeObjectURL = typeof URL.revokeObjectURL === 'function';
      lines.push(`  URL.canParse 存在：${hasCanParse}${hasCanParse ? `；canParse('https://x.com')=${URL.canParse('https://x.com')}；canParse('not-a-url')=${URL.canParse('not-a-url')}` : '（Node 19+ / Chrome 126+）'}`);
      lines.push(`  URL.parse 存在：${hasParse}${hasParse ? `；parse('https://x.com')=${URL.parse('https://x.com')?.href}；parse('bad')=${URL.parse('bad')}` : '（Node 22+ / Chrome 126+）'}`);
      lines.push(`  URL.createObjectURL 存在：${hasCreateObjectURL}；URL.revokeObjectURL 存在：${hasRevokeObjectURL}`);
      lines.push('', '说明：URL.canParse / URL.parse 是 new URL + try/catch 的安全替代（不抛异常）；createObjectURL(blob) 创建 blob: URL，用完须 revokeObjectURL 释放。');
      this.setState({ urlInfo: lines.join('\n') });
      this._addLog('url', `searchParams 演示完成：append/set/delete/sort + 静态方法检测`);
    } catch (err) {
      this._addLog('warn', `searchParams 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard1() {
    const s = this.state;
    const hasURL = typeof URL !== 'undefined';
    const hasSP = typeof URLSearchParams !== 'undefined';
    const card = new Card({
      title: '1. URL 与 URLSearchParams',
      extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
        ['URL', hasURL], ['URLSearchParams', hasSP],
      ]), h(Tag, { color: 'primary' }, '解析 / 增删改查')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new URL(input, base) 解析 URL，提供 href / origin / protocol / username / password / host / hostname / port / pathname / search / searchParams / hash 等属性；searchParams 是 URLSearchParams 实例（live，与 search 双向同步）。URLSearchParams 支持 append / delete / get / getAll / has / set / sort / entries / keys / values / forEach / toString。静态方法：URL.canParse / URL.parse（安全解析，不抛异常）、URL.createObjectURL / URL.revokeObjectURL（Blob 对象 URL）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('解析复杂 URL', { type: 'primary', size: 'sm', disabled: !hasURL, onClick: () => this._parseComplexURL() }),
          this._btn('searchParams 增删改查', { size: 'sm', disabled: !hasURL || !hasSP, onClick: () => this._mutateSearchParams() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'URL 解析 / searchParams 操作结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, s.urlInfo || '（点击「解析复杂 URL」或「searchParams 增删改查」）')),
        h(Alert, {
          type: 'info',
          message: 'searchParams 是 live 的，与 search 双向同步',
          description: '修改 u.searchParams 会自动更新 u.search，反之亦然。URL.canParse(input, base) 与 URL.parse(input, base) 是 new URL + try/catch 的安全替代：canParse 返回布尔，parse 返回 URL 或 null，都不抛 TypeError。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：TextEncoder / TextDecoder ===================

  // encode 'Hello 世界 🌍' → bytes → hex → decode 回，含多字节 UTF-8 拆解
  _encodeRoundtrip() {
    if (typeof TextEncoder === 'undefined' || typeof TextDecoder === 'undefined') {
      this._addLog('warn', 'TextEncoder / TextDecoder 不可用');
      this.setState({ textEncInfo: 'TextEncoder / TextDecoder 不可用。\n需 Node 11+ 或浏览器。' });
      return;
    }
    try {
      const str = 'Hello 世界 🌍';
      const encoder = new TextEncoder();
      const decoder = new TextDecoder('utf-8');
      const bytes = encoder.encode(str);
      const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(' ');
      const roundtrip = decoder.decode(bytes);
      // 逐码点 UTF-8 字节拆解
      const breakdown = Array.from(str).map((ch) => {
        const b = encoder.encode(ch);
        const h = Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join(' ');
        const cp = ch.codePointAt(0).toString(16).toUpperCase();
        return `  "${ch}" U+${cp.padStart(4, '0')} → ${b.length} 字节 [${h}]`;
      });
      const lines = [
        `输入字符串："${str}"`,
        `JS .length（UTF-16 码元数）：${str.length}；Array.from(str).length（码点数）：${Array.from(str).length}`,
        `UTF-8 字节长度：${bytes.length}`,
        `Hex：${hex}`,
        `decode 回原文："${roundtrip}"；一致性：${roundtrip === str ? '✓ 完全一致' : '✗ 不一致'}`,
        '', '逐码点 UTF-8 字节拆解（ASCII=1 字节；中文 BMP=3 字节；emoji 星平面=4 字节）：',
        ...breakdown, '',
        '说明：TextEncoder 仅支持 UTF-8（构造时无视 label 参数）；TextDecoder 支持 utf-8 / gbk / shift_jis 等多种编码。',
      ];
      this.setState({ textEncInfo: lines.join('\n') });
      this._addLog('enc', `编码 "${str}" → ${bytes.length} 字节，往返一致=${roundtrip === str}`);
    } catch (err) {
      this._addLog('warn', `编码往返演示失败：${err.name} - ${err.message}`);
    }
  }

  // encodeInto 性能 + 多编码 label 解码 + fatal/ignoreBOM 选项
  _decodeMultiLabel() {
    if (typeof TextEncoder === 'undefined' || typeof TextDecoder === 'undefined') {
      this._addLog('warn', 'TextEncoder / TextDecoder 不可用');
      return;
    }
    try {
      const sample = new TextEncoder().encode('你好');
      const labels = ['utf-8', 'utf-16le', 'utf-16be', 'ascii', 'latin1', 'iso-8859-1', 'windows-1252', 'gbk', 'big5', 'shift_jis'];
      const lines = ['===== 多编码 label 解码（输入为 UTF-8 字节"你好"）====='];
      for (const label of labels) {
        try {
          const dec = new TextDecoder(label);
          const out = dec.decode(sample);
          lines.push(`  ${label.padEnd(14)} → "${out}"`);
        } catch (e) {
          lines.push(`  ${label.padEnd(14)} → 不支持：${e.name || e.message}`);
        }
      }
      // fatal / ignoreBOM 选项
      lines.push('', '===== fatal / ignoreBOM 选项 =====');
      const bad = new Uint8Array([0xff, 0xfe, 0xfd]);
      try {
        const safe = new TextDecoder('utf-8', { fatal: false, ignoreBOM: false }).decode(bad);
        lines.push(`  fatal:false → "${safe}"（非法字节替换为 U+FFFD）`);
      } catch (e) { lines.push(`  fatal:false → 异常：${e.message}`); }
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(bad);
        lines.push('  fatal:true  → 未抛异常（异常）');
      } catch (e) { lines.push(`  fatal:true  → 抛异常：${e.name}（严格校验，遇非法字节即报错）`); }
      // encodeInto 演示
      lines.push('', '===== encodeInto(str, uint8Array) =====');
      if (typeof TextEncoder.prototype.encodeInto === 'function') {
        const str = 'Hello 世界';
        const buf = new Uint8Array(str.length * 4);
        const { read, written } = new TextEncoder().encodeInto(str, buf);
        lines.push(`  str="${str}"，预分配 ${buf.length} 字节，返回 { read: ${read}, written: ${written} }`);
        lines.push('  说明：read=已读码元，written=已写字节；直接写入调用方缓冲区，避免额外分配，适合高频 / 大数据量场景。');
      } else {
        lines.push('  encodeInto 不可用（较旧环境）');
      }
      this.setState({ textEncInfo: lines.join('\n') });
      this._addLog('enc', `多编码 label + fatal/ignoreBOM + encodeInto 演示完成`);
    } catch (err) {
      this._addLog('warn', `多编码解码演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard2() {
    const s = this.state;
    const hasTE = typeof TextEncoder !== 'undefined';
    const hasTD = typeof TextDecoder !== 'undefined';
    const card = new Card({
      title: '2. TextEncoder / TextDecoder',
      extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
        ['TextEncoder', hasTE], ['TextDecoder', hasTD],
      ]), h(Tag, { color: 'primary' }, 'UTF-8 / 多编码')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new TextEncoder() 仅支持 UTF-8：encode(string) → Uint8Array；encodeInto(string, uint8Array) → { read, written }（直接写入预分配缓冲区）。new TextDecoder(label, options) 支持多种编码（utf-8 / utf-16le / utf-16be / ascii / latin1 / iso-8859-1 / windows-1252 / gbk / big5 / shift_jis）；decode(buffer, { stream:true }) 支持分块解码；fatal:true 遇非法字节抛 TypeError；ignoreBOM 控制 BOM 处理。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('编码往返 + UTF-8 拆解', { type: 'primary', size: 'sm', disabled: !hasTE || !hasTD, onClick: () => this._encodeRoundtrip() }),
          this._btn('多编码 + fatal + encodeInto', { size: 'sm', disabled: !hasTE || !hasTD, onClick: () => this._decodeMultiLabel() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '编码 / 解码结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '340px', overflow: 'auto' } },
          h('code', {}, s.textEncInfo || '（点击「编码往返」或「多编码」按钮）')),
        h(Alert, {
          type: 'warning',
          message: 'TextEncoder 只支持 UTF-8，TextDecoder 才支持多编码',
          description: 'TextEncoder 构造时无视 label 参数，永远输出 UTF-8 字节。要解码 gbk / shift_jis 等需用 TextDecoder。fatal:true 适合严格校验（如解析外部数据），ignoreBOM:true 保留 BOM 字符。stream:true 用于分块解码跨块的多字节字符。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：TextEncoderStream / TextDecoderStream ===================

  // 管道：ReadableStream<string> → TextEncoderStream → TextDecoderStream → string
  _runStreamRoundtrip() {
    const hasTES = typeof TextEncoderStream !== 'undefined';
    const hasTDS = typeof TextDecoderStream !== 'undefined';
    const hasRS = typeof ReadableStream !== 'undefined';
    if (!hasTES || !hasTDS) {
      this._addLog('warn', 'TextEncoderStream / TextDecoderStream 不可用（polyfill 已兜底，建议 Chrome 71+ / Node 18+ 完整支持）');
      this.setState({ streamInfo: 'TextEncoderStream / TextDecoderStream 不可用。\n需 Chrome 71+ 或 Node 18+。polyfill 已兜底但无法真正 pipeThrough。' });
      return;
    }
    if (!hasRS) {
      this._addLog('warn', 'ReadableStream 不可用，无法演示流式管道');
      this.setState({ streamInfo: 'ReadableStream 不可用' });
      return;
    }
    // 中止上一次未完成的读取
    try { this._abortController?.abort(); } catch { /* noop */ }
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    const text = '你好，流式世界！Hello streaming world. 🌍 这是第二段。';
    (async () => {
      try {
        const chunks = [text.slice(0, 6), text.slice(6, 14), text.slice(14)];
        const readable = new ReadableStream({
          start(controller) {
            for (const c of chunks) controller.enqueue(c);
            controller.close();
          },
        });
        const enc = new TextEncoderStream();
        const dec = new TextDecoderStream('utf-8', { fatal: false, ignoreBOM: false });
        // pipeThrough 前读取 readable / writable 属性（避免锁定后不可访问）
        const encReadable = !!enc.readable;
        const encWritable = !!enc.writable;
        const decReadable = !!dec.readable;
        const decWritable = !!dec.writable;
        // 管道：string → bytes → string
        const piped = readable.pipeThrough(enc).pipeThrough(dec);
        const reader = piped.getReader();
        this._streamReader = reader;
        let result = '';
        let receivedChunks = 0;
        while (true) {
          if (signal.aborted) { try { reader.releaseLock(); } catch { /* noop */ } return; }
          const { done, value } = await reader.read();
          if (done) break;
          result += value;
          receivedChunks += 1;
        }
        if (this._destroyed) return;
        let bytesHex = '';
        try {
          const bytes = new TextEncoder().encode(text);
          bytesHex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(' ');
        } catch { /* noop */ }
        const lines = [
          `原始文本："${text}"`,
          `输入分块数：${chunks.length}（切片模拟流式输入）`,
          `UTF-8 字节(hex)：${bytesHex.slice(0, 60)}${bytesHex.length > 60 ? ' ...' : ''}`,
          '', '流式管道：', '  ReadableStream<string>',
          '    → pipeThrough(new TextEncoderStream())   // string → Uint8Array',
          '    → pipeThrough(new TextDecoderStream())   // Uint8Array → string', '',
          `往返结果："${result}"`, `收到分块数：${receivedChunks}`,
          `一致性：${result === text ? '✓ 完全一致' : '✗ 不一致'}`, '', '属性检查：',
          `  TextEncoderStream.readable = ${encReadable}；writable = ${encWritable}`,
          `  TextDecoderStream.readable = ${decReadable}；writable = ${decWritable}`, '',
          '典型用法：fetch(url).then(r => r.body.pipeThrough(new TextDecoderStream()))',
          '可在不一次性下载整个响应的情况下流式解码文本。',
        ];
        this.setState({ streamInfo: lines.join('\n') });
        this._addLog('stream', `流式往返成功：收到 ${receivedChunks} 个分块，一致=${result === text}`);
        try { this._streamReader = null; } catch { /* noop */ }
      } catch (err) {
        if (signal.aborted || this._destroyed) return;
        this._addLog('warn', `流式编码失败：${err.name} - ${err.message}`);
        this.setState({ streamInfo: `流式编码失败：${err.name} - ${err.message}` });
      }
    })();
  }

  _renderCard3() {
    const s = this.state;
    const hasTES = typeof TextEncoderStream !== 'undefined';
    const hasTDS = typeof TextDecoderStream !== 'undefined';
    const card = new Card({
      title: '3. TextEncoderStream / TextDecoderStream',
      extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
        ['TextEncoderStream', hasTES], ['TextDecoderStream', hasTDS],
      ]), h(Tag, { color: 'primary' }, 'TransformStream')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new TextEncoderStream() 与 new TextDecoderStream(label, options) 都是 TransformStream，拥有 .readable 与 .writable 属性。TextEncoderStream 把 string 转 Uint8Array（仅 UTF-8），TextDecoderStream 把 Uint8Array 转 string（支持多编码）。常配合 ReadableStream.pipeThrough() 串联，例如 fetch(url).then(r => r.body.pipeThrough(new TextDecoderStream())) 流式解码响应体，不必一次性下载。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('流式编码-解码往返', { type: 'primary', size: 'sm', disabled: !hasTES || !hasTDS, onClick: () => this._runStreamRoundtrip() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '流式往返结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '340px', overflow: 'auto' } },
          h('code', {}, s.streamInfo || '（点击「流式编码-解码往返」）')),
        h(Alert, {
          type: 'info',
          message: 'TextEncoderStream / TextDecoderStream 是流式版本的 Encoding API',
          description: '两者都是 TransformStream，可串联进流式管道。TextDecoderStream 的 stream 行为由内部自动处理（跨分块的多字节字符正确拼接），无需手动传 stream:true。适合处理大文本响应或逐块编解码场景。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：btoa / atob 与 Base64 ===================

  // btoa/atob Latin1 演示 + Unicode 兼容技巧 + TextEncoder 路线
  _btoaUnicodeDemo() {
    const hasBtoa = typeof btoa === 'function';
    const hasAtob = typeof atob === 'function';
    const hasTE = typeof TextEncoder !== 'undefined';
    if (!hasBtoa || !hasAtob) {
      this._addLog('warn', 'btoa / atob 不可用');
      this.setState({ base64Info: 'btoa / atob 不可用。\n需 Node 16+ 或浏览器。' });
      return;
    }
    try {
      const lines = [];
      // 1. Latin1 字符串（直接可用）
      const latin1 = 'Hello';
      const b64 = btoa(latin1);
      lines.push('===== btoa / atob 基础（仅 Latin1，码点 0-255）=====');
      lines.push(`  btoa("${latin1}") = "${b64}"；atob("${b64}") = "${atob(b64)}"`, '');
      // 2. Unicode 兼容技巧：btoa(unescape(encodeURIComponent(str)))
      const unicode = 'Hello 世界';
      const b64u = btoa(unescape(encodeURIComponent(unicode)));
      const backU = decodeURIComponent(escape(atob(b64u)));
      lines.push('===== Unicode 兼容技巧（escape/unescape 已废弃但广泛兼容）=====');
      lines.push(`  原文："${unicode}"`);
      lines.push(`  btoa(unescape(encodeURIComponent(str))) = "${b64u}"`);
      lines.push(`  decodeURIComponent(escape(atob(b64))) = "${backU}"，一致性：${backU === unicode ? '✓' : '✗'}`, '');
      // 3. 现代替代：TextEncoder + 手动 base64
      lines.push('===== 现代替代：TextEncoder + 手动 base64 =====');
      if (hasTE) {
        const bytes = new TextEncoder().encode(unicode);
        let bin = '';
        for (const b of bytes) bin += String.fromCharCode(b);
        const b64mod = btoa(bin);
        const bin2 = atob(b64mod);
        const bytes2 = new Uint8Array(bin2.length);
        for (let i = 0; i < bin2.length; i++) bytes2[i] = bin2.charCodeAt(i);
        const backMod = new TextDecoder('utf-8').decode(bytes2);
        lines.push(`  TextEncoder().encode("${unicode}") → ${bytes.length} 字节 → btoa = "${b64mod}"`);
        lines.push(`  atob → Uint8Array → TextDecoder.decode = "${backMod}"，一致性：${backMod === unicode ? '✓' : '✗'}（推荐：不依赖废弃的 escape/unescape）`);
      } else {
        lines.push('  TextEncoder 不可用，跳过现代替代演示');
      }
      lines.push('', '说明：btoa/atob 只处理 Latin1（码点 0-255），对含中文/emoji 的字符串直接调用会抛 InvalidCharacterError。');
      this.setState({ base64Info: lines.join('\n') });
      this._addLog('b64', `btoa/atob + Unicode 技巧 + TextEncoder 路线演示完成`);
    } catch (err) {
      this._addLog('warn', `btoa/atob 演示失败：${err.name} - ${err.message}`);
    }
  }

  // Base64URL 变体 + JWT 结构演示
  _base64UrlJwtDemo() {
    const hasBtoa = typeof btoa === 'function';
    const hasAtob = typeof atob === 'function';
    const hasTE = typeof TextEncoder !== 'undefined';
    if (!hasBtoa || !hasAtob) {
      this._addLog('warn', 'btoa / atob 不可用');
      return;
    }
    try {
      // base64url：+ → -，/ → _，去掉 = 填充
      const toB64Url = (b64) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const fromB64Url = (b64u) => { let b64 = b64u.replace(/-/g, '+').replace(/_/g, '/'); while (b64.length % 4) b64 += '='; return b64; };
      // 复用：bytes → base64（Unicode 安全）
      const bytesToB64 = (bytes) => { let bin = ''; for (const b of bytes) bin += String.fromCharCode(b); return btoa(bin); };
      const b64ToBytes = (b64) => { const bin = atob(b64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return arr; };
      const lines = ['===== Base64URL 变体 =====', '  规则：+ → -，/ → _，去掉 = 填充（URL 安全，无歧义字符）'];
      const str = hasTE ? 'Hello 世界' : 'Hello';
      const b64 = hasTE ? bytesToB64(new TextEncoder().encode(str)) : btoa(str);
      const b64u = toB64Url(b64);
      const back = hasTE ? new TextDecoder('utf-8').decode(b64ToBytes(fromB64Url(b64u))) : atob(fromB64Url(b64u));
      lines.push(`  原文："${str}"`, `  base64 = "${b64}"`, `  base64url = "${b64u}"`, `  解码回："${back}"，一致性=${back === str ? '✓' : '✗'}`, '');
      // JWT 结构：header.payload.signature（signature 此处仅占位，不真签名）
      lines.push('===== JWT 结构（header.payload.signature，Base64URL 编码）=====');
      const header = { alg: 'HS256', typ: 'JWT' };
      const payload = { sub: '1234567890', name: '张三', iat: 1717200000 };
      const encJson = (obj) => {
        const json = JSON.stringify(obj);
        return toB64Url(hasTE ? bytesToB64(new TextEncoder().encode(json)) : btoa(json));
      };
      const hPart = encJson(header);
      const pPart = encJson(payload);
      const sigPart = toB64Url(btoa('mock-signature-placeholder'));
      lines.push(`  header  = ${JSON.stringify(header)} → ${hPart}`);
      lines.push(`  payload = ${JSON.stringify(payload)} → ${pPart}`);
      lines.push(`  signature（占位）→ ${sigPart}`, `  JWT = ${hPart}.${pPart}.${sigPart}`, '');
      lines.push('说明：JWT 三段均用 Base64URL 编码（无 + / =，可安全放 URL/HTTP header）。实际 signature 用 HMAC/RSA 签名，非简单 base64。');
      this.setState({ base64Info: lines.join('\n') });
      this._addLog('b64', `Base64URL + JWT 结构演示完成`);
    } catch (err) {
      this._addLog('warn', `Base64URL/JWT 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard4() {
    const s = this.state;
    const hasBtoa = typeof btoa === 'function';
    const hasAtob = typeof atob === 'function';
    const card = new Card({
      title: '4. btoa / atob 与 Base64',
      extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
        ['btoa', hasBtoa], ['atob', hasAtob],
      ]), h(Tag, { color: 'primary' }, 'Base64 / Base64URL / JWT')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'btoa(binaryString) → base64；atob(base64) → binaryString。限制：仅处理 Latin1（码点 0-255），对中文/emoji 直接调用会抛 InvalidCharacterError。Unicode 兼容技巧：btoa(unescape(encodeURIComponent(str))) / decodeURIComponent(escape(atob(b64)))（escape 已废弃）。现代替代：TextEncoder 编码为 bytes，再逐字节 String.fromCharCode 拼接后 btoa。Base64URL 变体：+ → -，/ → _，去掉 = 填充（URL 安全，用于 JWT）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('btoa/atob + Unicode', { type: 'primary', size: 'sm', disabled: !hasBtoa || !hasAtob, onClick: () => this._btoaUnicodeDemo() }),
          this._btn('Base64URL + JWT 结构', { size: 'sm', disabled: !hasBtoa || !hasAtob, onClick: () => this._base64UrlJwtDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Base64 演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '340px', overflow: 'auto' } },
          h('code', {}, s.base64Info || '（点击「btoa/atob + Unicode」或「Base64URL + JWT」）')),
        h(Alert, {
          type: 'warning',
          message: 'btoa/atob 只支持 Latin1，Unicode 字符串需先转字节',
          description: '直接 btoa("中文") 会抛 InvalidCharacterError。推荐用 TextEncoder + 手动 base64（不依赖废弃的 escape/unescape）。Base64URL 把 + / = 替换为 URL 安全字符，是 JWT 与 JWS 的标准编码方式。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：Percent-encoding / URI encoding ===================

  // encodeURI vs encodeURIComponent 对比 + UTF-8 百分号编码说明
  _encodeUriCompare() {
    if (typeof encodeURI !== 'function' || typeof encodeURIComponent !== 'function') {
      this._addLog('warn', 'encodeURI / encodeURIComponent 不可用');
      this.setState({ percentInfo: 'encodeURI / encodeURIComponent 不可用。\n需 Node 或浏览器。' });
      return;
    }
    try {
      const input = 'https://example.com/path?name=张三&email=a@b.io#section';
      const hasTE = typeof TextEncoder !== 'undefined';
      const lines = [`输入：${input}`, ''];
      lines.push('===== encodeURI（保留保留字符 ;/?:@&=+$,-_.!~*\'()#）=====');
      lines.push(`  encodeURI(input) = ${encodeURI(input)}`);
      lines.push('  说明：保留 URL 结构字符（://?&=#），仅编码非 ASCII 与空格；适合编码整个 URL。', '');
      lines.push('===== encodeURIComponent（仅保留 -_.!~*\'()）=====');
      lines.push(`  encodeURIComponent(input) = ${encodeURIComponent(input)}`);
      lines.push('  说明：编码几乎所有特殊字符（含 : / ? & = #），仅保留 -_.!~*\'() ；适合编码单个查询参数值。', '');
      // 单个参数值对比
      const value = 'name=张三&a@b.io';
      lines.push(`===== 查询参数值对比（value="${value}"）=====`);
      lines.push(`  encodeURI(value)          = ${encodeURI(value)}`);
      lines.push(`  encodeURIComponent(value) = ${encodeURIComponent(value)}`);
      lines.push('  正确做法：参数值用 encodeURIComponent，避免 = & 等被误解析为分隔符。', '');
      // decodeURI / decodeURIComponent
      lines.push('===== decodeURI / decodeURIComponent =====');
      const encoded = encodeURIComponent('张三');
      lines.push(`  encodeURIComponent('张三') = ${encoded}`);
      lines.push(`  decodeURIComponent('${encoded}') = ${decodeURIComponent(encoded)}`);
      lines.push(`  decodeURI('${encoded}') = ${decodeURI(encoded)}（decodeURI 不解码保留字符的 %XX）`, '');
      // UTF-8 百分号编码拆解
      lines.push('===== UTF-8 百分号编码拆解 =====');
      for (const ch of ['张', '三', '🌍']) {
        if (hasTE) {
          const bytes = new TextEncoder().encode(ch);
          const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(' ');
          const pct = Array.from(bytes).map((b) => '%' + b.toString(16).padStart(2, '0').toUpperCase()).join('');
          lines.push(`  "${ch}" → UTF-8 [${hex}] → ${pct}`);
        } else {
          lines.push(`  "${ch}" → encodeURIComponent = ${encodeURIComponent(ch)}`);
        }
      }
      lines.push('', '说明：百分号编码把每个字节转成 %XX（大写 hex）。中文 BMP 字符 UTF-8 占 3 字节 → 3 个 %XX；emoji 星平面占 4 字节 → 4 个 %XX。');
      this.setState({ percentInfo: lines.join('\n') });
      this._addLog('pct', `encodeURI vs encodeURIComponent + UTF-8 百分号编码对比完成`);
    } catch (err) {
      this._addLog('warn', `URI 编码对比失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard5() {
    const s = this.state;
    const hasEncodeURI = typeof encodeURI === 'function';
    const hasEncodeComp = typeof encodeURIComponent === 'function';
    const card = new Card({
      title: '5. Percent-encoding / URI encoding',
      extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
        ['encodeURI', hasEncodeURI], ['encodeURIComponent', hasEncodeComp],
      ]), h(Tag, { color: 'primary' }, '%XX 百分号编码')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'encodeURI(str) 保留 URL 保留字符 ;/?:@&=+$,-_.!~*\'()#，仅编码非 ASCII 与空格，适合编码整个 URL；encodeURIComponent(str) 仅保留 -_.!~*\'()，编码其余所有特殊字符，适合编码单个查询参数值。decodeURI / decodeURIComponent 分别解码。UTF-8 百分号编码：每个字节转 %XX（大写 hex），中文 BMP 字符占 3 字节 → 3 个 %XX（如"张" → %E5%BC%A0），emoji 星平面占 4 字节。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('encodeURI vs encodeURIComponent', { type: 'primary', size: 'sm', disabled: !hasEncodeURI || !hasEncodeComp, onClick: () => this._encodeUriCompare() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'URI 编码对比结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '340px', overflow: 'auto' } },
          h('code', {}, s.percentInfo || '（点击「encodeURI vs encodeURIComponent」）')),
        h(Alert, {
          type: 'info',
          message: 'encodeURI 编码整条 URL，encodeURIComponent 编码单个参数值',
          description: 'encodeURI 保留 : / ? & = # 等 URL 结构字符；encodeURIComponent 把它们也编码，避免参数值中的 = & # 被误解析为分隔符。拼接查询字符串时，键和值都应使用 encodeURIComponent。decodeURIComponent 能解码所有 %XX，decodeURI 只解码非保留字符的 %XX。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：URL 模式与解析边界 ===================

  // URLPattern test/exec 演示
  _urlPatternDemo() {
    if (typeof URLPattern === 'undefined') {
      this._addLog('warn', 'URLPattern 不可用（polyfill 已兜底，建议 Chrome 95+ 完整支持）');
      this.setState({ patternInfo: 'URLPattern 不可用：typeof URLPattern === "undefined"。\npolyfill 已兜底，建议 Chrome 95+ / Edge 95+ 完整支持。' });
      return;
    }
    try {
      const lines = [
        '===== URLPattern 路由匹配 =====',
        'new URLPattern(input)：input 可为字符串或 { protocol, hostname, pathname, ... } 对象',
        '  :param 命名组；(regex) 正则约束；* 通配；{x}? 可选组', '',
      ];
      const p1 = new URLPattern({ pathname: '/users/:id' });
      const e1 = p1.exec('https://example.com/users/42');
      lines.push(`pattern = new URLPattern({ pathname: '/users/:id' })`);
      lines.push(`  test('.../users/42') = ${p1.test('https://example.com/users/42')}`);
      lines.push(`  exec('.../users/42') → pathname.groups = ${JSON.stringify(e1?.pathname?.groups)}`, '');
      const p2 = new URLPattern({ pathname: '/articles/:year/:month/:slug' });
      const e2 = p2.exec('https://example.com/articles/2026/07/hello');
      lines.push(`pattern = new URLPattern({ pathname: '/articles/:year/:month/:slug' })`);
      lines.push(`  exec('.../articles/2026/07/hello') → groups = ${JSON.stringify(e2?.pathname?.groups)}`, '');
      const p3 = new URLPattern({ pathname: '/files/*' });
      lines.push(`pattern = new URLPattern({ pathname: '/files/*' })`);
      lines.push(`  test('.../files/a/b/c.txt') = ${p3.test('https://example.com/files/a/b/c.txt')}（* 通配多段）`, '');
      lines.push('URLPatternResult 结构：{ protocol, username, password, hostname, port, pathname, search, hash }');
      lines.push('  每个字段含 { input, groups }；exec 不匹配返回 null，test 返回 boolean。');
      this.setState({ patternInfo: lines.join('\n') });
      this._addLog('pat', `URLPattern test/exec 演示完成`);
    } catch (err) {
      this._addLog('warn', `URLPattern 演示失败：${err.name} - ${err.message}`);
    }
  }

  // URL.parse 严格模式 vs try/catch + 边界协议解析（IDN/file/data/blob）
  _parseEdgeCases() {
    if (typeof URL === 'undefined') {
      this._addLog('warn', 'URL 不可用');
      this.setState({ patternInfo: 'URL 不可用' });
      return;
    }
    try {
      const lines = [];
      // URL.parse（严格模式，不抛异常）vs try/catch on new URL
      const hasParse = typeof URL.parse === 'function';
      lines.push('===== URL.parse 严格模式 vs new URL + try/catch =====');
      lines.push(`URL.parse 存在：${hasParse}${hasParse ? '（Node 22+ / Chrome 126+）' : '（较新 API，用 new URL + try/catch 替代）'}`);
      for (const c of ['https://example.com/path', 'not-a-url', '://missing-protocol', 'https://']) {
        let parseResult, newUrlResult;
        if (hasParse) { try { parseResult = URL.parse(c) ? 'URL 对象' : 'null'; } catch (e) { parseResult = `异常：${e.name}`; } }
        try { new URL(c); newUrlResult = 'URL 对象'; } catch (e) { newUrlResult = `抛 ${e.name}`; }
        lines.push(`  "${c}"：${hasParse ? `URL.parse=${parseResult}，` : ''}new URL=${newUrlResult}`);
      }
      lines.push('', '===== 边界协议解析（origin / pathname）=====');
      const edgeCases = [
        'https://例え.jp/path',      // IDN（国际化域名）
        'file:///etc/hosts',          // file 协议
        'data:text/plain,hello',      // data 协议
        'https://[2001:db8::1]/path', // IPv6
        'https://192.168.1.1:8080/',  // IPv4
      ];
      // blob: 需 createObjectURL，javascript: 现代浏览器禁用
      if (typeof URL.createObjectURL === 'function' && typeof Blob !== 'undefined') {
        try { edgeCases.push(URL.createObjectURL(new Blob(['x']))); } catch { /* noop */ }
      }
      for (const c of edgeCases) {
        try {
          const u = new URL(c);
          lines.push(`  "${c}"`, `    protocol=${u.protocol}, origin=${u.origin}, hostname=${u.hostname}, pathname=${u.pathname}`);
        } catch (e) {
          lines.push(`  "${c}" → 抛 ${e.name}：${e.message}`);
        }
      }
      lines.push('', '说明：');
      lines.push('  - IDN 域名（如 例え.jp）会被转为 punycode（xn--）；origin 反映 punycode 形式。');
      lines.push('  - file: URL 的 origin 通常是 "null"；data: URL 的 origin 也是 "null"。');
      lines.push('  - blob: URL 由 URL.createObjectURL(blob) 创建，含随机 UUID，origin 继承创建者。');
      lines.push('  - javascript: URL 在现代浏览器中被导航层禁用（防 XSS），但 new URL() 仍可解析。');
      this.setState({ patternInfo: lines.join('\n') });
      this._addLog('pat', `URL 边界解析演示完成（IDN/file/data/IPv6/blob）`);
    } catch (err) {
      this._addLog('warn', `边界解析演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard6() {
    const s = this.state;
    const hasURLPattern = typeof URLPattern !== 'undefined';
    const hasURL = typeof URL !== 'undefined';
    const card = new Card({
      title: '6. URL 模式与解析边界',
      extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
        ['URLPattern', hasURLPattern], ['URL', hasURL],
      ]), h(Tag, { color: 'primary' }, '模式 / 边界协议')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'URLPattern 类似 path-to-regexp：new URLPattern(input) 构造模式（:param 命名组、(regex) 约束、* 通配、{x}? 可选组），.test(input) 返回布尔，.exec(input) 返回 { pathname: { input, groups } } 等分组详情。URL.parse(input, base)（Node 22+ / Chrome 126+）是 new URL + try/catch 的安全替代（不抛异常，返回 null）。边界：IDN 域名转 punycode（xn--）；file:/data: 的 origin 为 "null"；blob: 由 createObjectURL 创建；IPv4/IPv6 主机；javascript: 现代浏览器导航层禁用（但 new URL 可解析）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('URLPattern test/exec', { type: 'primary', size: 'sm', disabled: !hasURLPattern, onClick: () => this._urlPatternDemo() }),
          this._btn('URL.parse + 边界协议', { size: 'sm', disabled: !hasURL, onClick: () => this._parseEdgeCases() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'URL 模式 / 解析边界结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '340px', overflow: 'auto' } },
          h('code', {}, s.patternInfo || '（点击「URLPattern test/exec」或「URL.parse + 边界协议」）')),
        h(Alert, {
          type: 'info',
          message: 'URLPattern 用于路由匹配，URL.parse 是安全解析',
          description: 'URLPattern 支持 protocol/hostname/pathname 等全字段模式匹配，适合前端路由与服务端框架。URL.parse 不抛异常（失败返回 null），比 new URL + try/catch 更简洁。IDN 域名自动转 punycode（xn-- 前缀）；file/data/blob 的 origin 为 "null" 或继承创建者。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 9：URLPattern API + Text Fragments ===================

  // URLPattern 深度演示：构造 / 匹配 / 模式语法 / 实战场景
  _runURLPatternDemo() {
    if (typeof URLPattern === 'undefined') {
      this._addLog('warn', 'URLPattern 不可用（polyfill 已兜底，建议 Chrome 95+ 完整支持）');
      this.setState({ urlPatternInfo: 'URLPattern 不可用：typeof URLPattern === "undefined"。\nWICG 提案，Chrome 95+ / Edge 95+ 稳定支持；Firefox / Safari 暂无原生支持，可用 urlpattern-polyfill 兜底（与原生 API 行为一致）。' });
      return;
    }
    try {
      const lines = [
        '===== URLPattern API 概述 =====',
        '来源：WICG 提案（Web Incubator Community Group），Chrome 95+ / Edge 95+ 进入稳定通道。',
        '定位：浏览器原生的 URL 模式匹配 API，类似 path-to-regexp 但作用于完整 URL（protocol/hostname/port/pathname/search/hash）。',
        'vs path-to-regexp：后者只处理 pathname 字符串；URLPattern 内置 URL 解析，可匹配任意字段组合并返回结构化 groups。',
        'vs 路由库（Express / React Router）：路由库通常基于 path-to-regexp 构建；URLPattern 提供底层标准化原语，可被路由库直接采用。',
        '浏览器支持：Chrome / Edge 稳定；Firefox / Safari 暂未原生支持；可用 urlpattern-polyfill 兜底（行为与原生一致）。',
        '',
        '===== 构造与匹配 =====',
        '两种构造形式：',
        '  1. 对象形式：new URLPattern({ protocol, hostname, port, pathname, search, hash })',
        '  2. 字符串形式：new URLPattern("https://example.com/:id")（自动拆分到各字段）',
        '匹配方法：pattern.test(url) → boolean；pattern.exec(url) → URLPatternResult | null',
        'URLPatternResult：{ protocol, username, password, hostname, port, pathname, search, hash }，每字段含 { input, groups }',
        '',
      ];
      // 对象形式
      const pObj = new URLPattern({ protocol: 'https', hostname: 'example.com', pathname: '/users/:id' });
      const eObj = pObj.exec('https://example.com/users/42');
      lines.push('--- 对象形式 ---');
      lines.push('  new URLPattern({ protocol: "https", hostname: "example.com", pathname: "/users/:id" })');
      lines.push(`  test("https://example.com/users/42") = ${pObj.test('https://example.com/users/42')}`);
      lines.push(`  test("http://example.com/users/42")  = ${pObj.test('http://example.com/users/42')}（protocol 不匹配 → false）`);
      lines.push(`  exec("https://example.com/users/42") → pathname.groups = ${JSON.stringify(eObj?.pathname?.groups)}`, '');
      // 字符串形式
      const pStr = new URLPattern('https://example.com/articles/:slug');
      const eStr = pStr.exec('https://example.com/articles/hello-world');
      lines.push('--- 字符串形式 ---');
      lines.push('  new URLPattern("https://example.com/articles/:slug")');
      lines.push(`  exec("https://example.com/articles/hello-world") → pathname.groups = ${JSON.stringify(eStr?.pathname?.groups)}`, '');
      // 模式语法
      lines.push('===== 模式语法（与 path-to-regexp 对比）=====');
      lines.push('  :param            命名参数（默认 [^/]+，不含 /）           path-to-regexp: :param');
      lines.push('  *                 通配符（含 /，匹配多段）                  path-to-regexp: *');
      lines.push('  {group}?          可选组（? 表示 0 或 1 次）               path-to-regexp: (group)?');
      lines.push('  (a|b)             分组 / Alternation（二选一）             path-to-regexp: (a|b)');
      lines.push('  :name(regex)      命名参数 + 正则约束                       path-to-regexp: :name(regex)');
      lines.push('  内部机制：URLPattern 的 :name 编译为 JS 正则命名组 (?<name>...)，groups 对象即来自此处。');
      lines.push('');
      // 命名参数 + 正则约束
      try {
        const pRegex = new URLPattern({ pathname: '/users/:id(\\d+)' });
        const eRegex = pRegex.exec('https://example.com/users/42');
        lines.push(`  /users/:id(\\d+) → test("/users/42")=${pRegex.test('https://example.com/users/42')}；test("/users/abc")=${pRegex.test('https://example.com/users/abc')}（非数字不匹配）`);
        lines.push(`    exec("/users/42") → groups = ${JSON.stringify(eRegex?.pathname?.groups)}`, '');
      } catch (e) {
        lines.push(`  正则约束示例不可用：${e.message}`, '');
      }
      // 通配符
      try {
        const pWild = new URLPattern({ pathname: '/files/*' });
        const eWild = pWild.exec('https://example.com/files/a/b/c.txt');
        lines.push(`  /files/* → test("/files/a/b/c.txt")=${pWild.test('https://example.com/files/a/b/c.txt')}（* 含 /，匹配多段）`);
        lines.push(`    exec → groups = ${JSON.stringify(eWild?.pathname?.groups)}（* 捕获存于 groups["0"]）`, '');
      } catch (e) {
        lines.push(`  通配符示例不可用：${e.message}`, '');
      }
      // 可选组
      try {
        const pOpt = new URLPattern({ pathname: '/repo{/tree/:branch}?' });
        const eOpt1 = pOpt.exec('https://example.com/repo');
        const eOpt2 = pOpt.exec('https://example.com/repo/tree/main');
        lines.push(`  /repo{/tree/:branch}? → exec("/repo")=${JSON.stringify(eOpt1?.pathname?.groups)}；exec("/repo/tree/main")=${JSON.stringify(eOpt2?.pathname?.groups)}`);
        lines.push('    （可选组缺失时 groups.branch 为 undefined；存在时为 "main"）', '');
      } catch (e) {
        lines.push(`  可选组示例不可用：${e.message}`, '');
      }
      // 分组 Alternation
      try {
        const pAlt = new URLPattern({ pathname: '/(books|movies)/:id' });
        lines.push(`  /(books|movies)/:id → test("/books/1")=${pAlt.test('https://example.com/books/1')}；test("/music/1")=${pAlt.test('https://example.com/music/1')}（非 books/movies 不匹配）`, '');
      } catch (e) {
        lines.push(`  分组示例不可用：${e.message}`, '');
      }
      // 实战场景
      lines.push('===== 实战场景 =====');
      lines.push('  1. SPA 路由：前端框架（React Router / Solid Router）可直接用 URLPattern 替代 path-to-regexp，');
      lines.push('     监听 popstate / navigate 事件，对 location.pathname 做模式匹配并渲染对应组件 + 提取参数。');
      lines.push('  2. API 端点匹配：服务端框架（Hono / Express）在 fetch handler 中分发请求：');
      lines.push('       const userPattern = new URLPattern({ pathname: "/api/users/:id" });');
      lines.push('       const m = userPattern.exec(request.url);');
      lines.push('       if (m) return new Response("user " + m.pathname.groups.id);');
      lines.push('  3. Service Worker fetch 路由：在 fetch 事件中按 URLPattern 分发缓存策略：');
      lines.push('       self.addEventListener("fetch", (e) => {');
      lines.push('         if (imgPattern.test(e.request.url)) e.respondWith(caches.match(e.request));');
      lines.push('       });');
      lines.push('  4. 与 Navigation API 协同：Navigation API（Chrome 102+ 实验）的 navigate 事件中，');
      lines.push('     用 URLPattern 匹配 destination.url 决定是否拦截导航并加载对应模块；');
      lines.push('     Navigation API 提供事件驱动路由模型，URLPattern 提供匹配原语，二者互补。');
      lines.push('', '说明：URLPattern 与 path-to-regexp 语法大部分兼容，细微差异如 * 在 URLPattern 含 /（path-to-regexp 默认不含）。');
      this.setState({ urlPatternInfo: lines.join('\n') });
      this._addLog('pat', `URLPattern 深度演示完成（构造/匹配/语法/实战）`);
    } catch (err) {
      this._addLog('warn', `URLPattern 深度演示失败：${err.name} - ${err.message}`);
    }
  }

  // Text Fragments 演示：语法 / 构造 / 实战场景
  _runTextFragmentsDemo() {
    if (typeof URL === 'undefined') {
      this._addLog('warn', 'URL 不可用，无法演示 Text Fragments');
      this.setState({ textFragmentsInfo: 'URL 不可用：typeof URL === "undefined"。\nText Fragments 需 URL API 构造示例。' });
      return;
    }
    try {
      const lines = [
        '===== Text Fragments 概述 =====',
        '来源：WHATWG / W3C 规范（最初 Google 提案，现纳入 HTML / URL 规范的 Fragment Directive 部分）。',
        '机制：URL hash 中使用 #:~:text=... 语法（Fragment Directive），让浏览器滚动到目标文本并高亮。',
        'vs 锚点：锚点 (#id) 定位元素；Text Fragments 定位文本内容，无需元素 ID，可跨任意页面。',
        '浏览器支持：Chrome 80+ / Edge 80+ 稳定；Safari 16.4+ 支持；Firefox 部分支持（about:config 实验）。',
        'Fragment Directive 隔离：#:~: 后的内容对 location.hash 不可见（浏览器剥离），避免与锚点冲突。',
        '',
        '===== 语法 =====',
        '  #:~:text=foo                  单词 / 短语（精确匹配）',
        '  #:~:text=foo,-,bar            范围（从 foo 到 bar 之间文本，含两端）',
        '  #:~:text=prefix-,foo          前缀匹配（foo 前面紧跟 prefix）',
        '  #:~:text=foo-,suffix          后缀匹配（foo 后面紧跟 suffix）',
        '  #:~:text=prefix-,foo-,suffix  前缀 + 后缀组合',
        '  #:~:text=foo&text=bar         多片段（& 分隔，同时高亮多处）',
        '  %20                           空格需百分号编码（text=hello%20world）',
        '',
        '===== 构造示例（仅构造 URL，不实际滚动）=====',
      ];
      const samples = [
        { label: '单词', hash: '#:~:text=hello' },
        { label: '短语（含空格）', hash: '#:~:text=hello%20world' },
        { label: '范围', hash: '#:~:text=foo,-,bar' },
        { label: '前缀', hash: '#:~:text=Chapter-,1' },
        { label: '前缀+后缀', hash: '#:~:text=Chapter-,1,-,Section' },
        { label: '多片段', hash: '#:~:text=foo&text=bar' },
      ];
      for (const sample of samples) {
        try {
          const u = new URL('https://example.com/article' + sample.hash);
          lines.push(`  ${sample.label.padEnd(14)} → ${u.href}`);
          lines.push(`                  u.hash = "${u.hash}"`);
        } catch (e) {
          lines.push(`  ${sample.label} → 构造失败：${e.message}`);
        }
      }
      lines.push('', '注意：现代浏览器中 location.hash 会剥离 #:~: fragment directive，');
      lines.push('      所以 u.hash 可能显示为 "" 或仅剩余普通锚点（行为依浏览器版本而异）。');
      lines.push('      FragmentDirective 接口（window.FragmentDirective）提供脚本访问入口（Chrome 实验）。');
      lines.push('', '===== 实战场景 =====');
      lines.push('  1. 分享特定文本位置：复制含 #:~:text=... 的 URL，他人打开即滚动到目标文本并高亮。');
      lines.push('  2. 文档引用：论文 / 文档中链接到目标段落的具体句子，无需依赖元素 ID。');
      lines.push('  3. 与 scroll-behavior: smooth 协同：CSS 设置 html { scroll-behavior: smooth; }，');
      lines.push('     浏览器滚动到 Text Fragment 时使用平滑动画，体验更佳。');
      lines.push('  4. Fragment Directive 隔离：#:~: 前缀后的内容不进入 location.hash，');
      lines.push('     避免与现有锚点逻辑冲突；可通过 FragmentDirective API（实验）访问原始 directive。');
      lines.push('  5. 生成工具：手动拼接或用 URLSearchParams，注意 %20 编码空格、& 分隔多片段、- 分隔范围与前后缀。');
      lines.push('', '说明：Text Fragments 是声明式跨页面文本定位机制，与元素 ID 锚点互补。');
      lines.push('       生产环境需注意浏览器兼容性（Firefox 旧版 / Safari < 16.4 不支持），可降级为普通锚点。');
      this.setState({ textFragmentsInfo: lines.join('\n') });
      this._addLog('frag', `Text Fragments 演示完成（语法/构造/实战）`);
    } catch (err) {
      this._addLog('warn', `Text Fragments 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard9() {
    const s = this.state;
    const hasURLPattern = typeof URLPattern === 'function';
    const hasURL = typeof URL !== 'undefined';
    const hasFragmentDirective = typeof FragmentDirective !== 'undefined';
    const card = new Card({
      title: '9. URLPattern API + Text Fragments / Scroll-to-Text',
      extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
        ['URLPattern', hasURLPattern],
        ['FragmentDirective', hasFragmentDirective],
        ['URL', hasURL],
      ]), h(Tag, { color: 'primary' }, '路由匹配 / 文本片段')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'URLPattern（WICG 提案，Chrome 95+ 稳定）是浏览器原生的 URL 模式匹配 API，支持 :param 命名参数、* 通配、{group}? 可选、(a|b) 分组、:name(regex) 正则约束（内部编译为 (?<name>...) 命名组），可比 path-to-regexp 匹配完整 URL（protocol/hostname/pathname/...）。Text Fragments（WHATWG/W3C）通过 URL hash 中 #:~:text=... 语法实现跨页面文本定位与高亮滚动，支持单词、范围（foo,-,bar）、前缀/后缀（prefix-,foo）、多片段（&）等语法，配合 scroll-behavior: smooth 提供流畅体验；#:~: fragment directive 对 location.hash 不可见，避免与锚点冲突。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('URLPattern 深度演示', { type: 'primary', size: 'sm', disabled: !hasURLPattern, onClick: () => this._runURLPatternDemo() }),
          this._btn('Text Fragments 演示', { size: 'sm', disabled: !hasURL, onClick: () => this._runTextFragmentsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'URLPattern 演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '360px', overflow: 'auto' } },
          h('code', {}, s.urlPatternInfo || '（点击「URLPattern 深度演示」）')),
        h('div', { class: 'fs-sm text-secondary' }, 'Text Fragments 演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '360px', overflow: 'auto' } },
          h('code', {}, s.textFragmentsInfo || '（点击「Text Fragments 演示」）')),
        h(Alert, {
          type: 'info',
          message: 'URLPattern 是路由匹配原语，Text Fragments 是声明式跨页面文本定位',
          description: 'URLPattern 可被前端路由库、Service Worker、Navigation API 直接采用，替代 path-to-regexp 依赖。Text Fragments 通过 #:~:text= 让 URL 携带文本位置信息，浏览器原生滚动+高亮，无需元素 ID；现代浏览器中 fragment directive 对 location.hash 不可见，避免与锚点冲突。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== 日志面板 ===================

  _renderLogPanel() {
    const s = this.state;
    return h('div', { class: 'log-panel' },
      h('div', { class: 'log-panel__header' },
        '事件日志',
        h(Tag, { color: 'primary' }, `${s.logs.length} 条`),
      ),
      s.logs.length === 0
        ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
        : s.logs.map((log) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  // =================== 整页渲染 ===================

  render() {
    const s = this.state;
    return h('div', { class: 'api-lab-page url-encoding-deep-page' },
      h('h2', { class: 'section-title' }, 'URL 与编码 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '演示 URL/URLSearchParams 解析、TextEncoder/TextDecoder 编解码、TextEncoderStream/TextDecoderStream 流式、btoa/atob 与 Base64/Base64URL/JWT、percent-encoding、URLPattern 与边界协议解析、URLPattern API 深度（构造/语法/路由实战）与 Text Fragments / Scroll-to-Text。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderCard6(),
      this._renderCard9(),
      this._renderLogPanel(),
    );
  }
}
