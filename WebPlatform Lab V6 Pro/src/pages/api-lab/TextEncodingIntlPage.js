// TextEncodingIntlPage.js —— 文本编码与高级国际化 API 实验室
// 演示：Encoding API（TextEncoder / TextDecoder / encodeInto）、
//       TextEncoderStream / TextDecoderStream（流式编码）、
//       Intl.Segmenter（分词 / 分段 / 字素）、
//       Intl 高级格式化（ListFormat / PluralRules / RelativeTimeFormat / DisplayNames / DurationFormat）、
//       CSS Font Loading API（FontFace / document.fonts）
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class TextEncodingIntlPage extends Page {
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      // Card 1: Encoding API
      encResult: '',
      decResult: '',
      // Card 2: TextEncoderStream / TextDecoderStream
      streamResult: '',
      // Card 3: Intl.Segmenter
      segResult: '',
      // Card 4: Intl 高级格式化
      listResult: '',
      pluralResult: '',
      relResult: '',
      displayResult: '',
      // Card 5: CSS Font Loading API
      fontResult: '',
    };
  }

  // =================== 生命周期 ===================
  componentDidMount() {
    // 守卫：防止 setState 触发重渲染后再次进入 componentDidMount 导致死循环 OOM
    if (this._inited) return;
    this._inited = true;

    // —— 能力检测：typeof 各 API，记录 capsSummary ——
    const mark = (ok) => (ok ? '✓' : '✗');
    const hasIntl = typeof Intl !== 'undefined';
    const te = typeof TextEncoder !== 'undefined';
    const td = typeof TextDecoder !== 'undefined';
    const tes = typeof TextEncoderStream !== 'undefined';
    const tds = typeof TextDecoderStream !== 'undefined';
    const seg = hasIntl && typeof Intl.Segmenter !== 'undefined';
    const lf = hasIntl && typeof Intl.ListFormat !== 'undefined';
    const pr = hasIntl && typeof Intl.PluralRules !== 'undefined';
    const rtf = hasIntl && typeof Intl.RelativeTimeFormat !== 'undefined';
    const dn = hasIntl && typeof Intl.DisplayNames !== 'undefined';
    const df = hasIntl && typeof Intl.DurationFormat !== 'undefined';
    const ff = typeof FontFace !== 'undefined';
    const dfs = typeof document !== 'undefined' && !!document.fonts;

    const caps = [
      `TextEncoder ${mark(te)}`,
      `TextDecoder ${mark(td)}`,
      `TextEncoderStream ${mark(tes)}`,
      `TextDecoderStream ${mark(tds)}`,
      `Segmenter ${mark(seg)}`,
      `ListFormat ${mark(lf)}`,
      `PluralRules ${mark(pr)}`,
      `RelativeTimeFormat ${mark(rtf)}`,
      `DisplayNames ${mark(dn)}`,
      `DurationFormat ${mark(df)}`,
      `FontFace ${mark(ff)}`,
      `document.fonts ${mark(dfs)}`,
    ];
    this.setState({ capsSummary: '能力检测：' + caps.join('  ·  ') });

    // 记录缺失项到日志
    if (!tes || !tds) {
      this._addLog('warn', 'TextEncoderStream / TextDecoderStream 可能不可用（建议 Chrome 71+ / Node 18+）');
    }
    if (!df) {
      this._addLog('warn', 'Intl.DurationFormat 不可用（较新 API，Node 22+ / Chrome 较新版本）');
    }
    if (!ff || !dfs) {
      this._addLog('warn', 'FontFace / document.fonts 在 jsdom 通常缺失，演示会降级');
    }

    // 初始演示：编码 + 中文分词，让页面加载即有内容
    if (te) this._runEncode();
    if (seg) this._runSegmentZh();
  }

  componentWillUnmount() {
    // 清理：FontFaceSet 事件移除
    try {
      if (this._fontHandler && typeof document !== 'undefined' && document.fonts) {
        document.fonts.removeEventListener('loadingdone', this._fontHandler);
      }
    } catch { /* noop */ }
    this._fontHandler = null;
    // 清理：中止流式读取的 AbortController
    try {
      if (this._abortController) this._abortController.abort();
    } catch { /* noop */ }
    this._abortController = null;
  }

  // =================== 通用辅助 ===================
  _addLog(type, content) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  _card(title, desc, extra, children) {
    // Card 用法：new Card({ title, desc, extra, children }); this.registerChild(card); return card.render()
    // desc 同时渲染为首段说明（Card 本身不消费 desc 属性，这里前置一个 <p> 保证可见）
    const kids = Array.isArray(children) ? children : [children];
    const body = desc ? [h('p', { class: 'fs-sm text-secondary' }, desc), ...kids] : kids;
    const card = new Card({ title, desc, extra, children: body });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 1: Encoding API ===================
  _runEncode() {
    if (typeof TextEncoder === 'undefined' || typeof TextDecoder === 'undefined') {
      this._addLog('warn', 'TextEncoder / TextDecoder 不可用');
      return;
    }
    try {
      const str = '你好世界';
      const encoder = new TextEncoder();
      const bytes = encoder.encode(str);
      const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(' ');
      const decoder = new TextDecoder('utf-8');
      const roundtrip = decoder.decode(bytes);
      // 字节分布说明：中文常用字 UTF-8 占 3 字节
      const zhBytes = Array.from(str).map((ch) => {
        const b = encoder.encode(ch);
        return `"${ch}"→${b.length}字节`;
      });
      const lines = [
        `输入字符串: "${str}"`,
        `字符串 JS length: ${str.length}（UTF-16 码元数）`,
        `UTF-8 字节长度: ${bytes.length}`,
        `Hex: ${hex}`,
        `解码回原文: "${roundtrip}"`,
        `一致性: ${roundtrip === str ? '✓ 完全一致' : '✗ 不一致'}`,
        '',
        '逐字符 UTF-8 字节数（中文常用字占 3 字节，BMP 内）:',
        '  ' + zhBytes.join('  '),
        '',
        '说明: TextEncoder 仅支持 UTF-8（构造时无视 label 参数）；',
        '      TextDecoder("utf-8", { fatal, ignoreBOM }).decode(bytes) 解码。',
        '      fatal:true 时遇到非法字节抛 TypeError，便于严格校验。',
      ];
      this.setState({ encResult: lines.join('\n') });
      this._addLog('enc', `编码 "你好世界" → ${bytes.length} 字节，hex: ${hex}`);
    } catch (err) {
      this._addLog('err', `编码演示失败：${err.message}`);
    }
  }

  _runDecode() {
    if (typeof TextDecoder === 'undefined') {
      this._addLog('warn', 'TextDecoder 不可用');
      return;
    }
    try {
      // 用 UTF-8 字节作为统一输入，观察不同 label 的解码差异
      const sample = new TextEncoder().encode('你好');
      const lines = [];
      const encodings = ['utf-8', 'gbk', 'gb18030', 'big5', 'shift_jis', 'euc-kr', 'iso-8859-1', 'windows-1252'];
      for (const enc of encodings) {
        try {
          const decoder = new TextDecoder(enc);
          const decoded = decoder.decode(sample);
          lines.push(`${enc.padEnd(14)} → "${decoded}"`);
          this._addLog('dec', `TextDecoder('${enc}') 解码 UTF-8 字节 → "${decoded.slice(0, 12)}"`);
        } catch (e) {
          lines.push(`${enc.padEnd(14)} → 不支持: ${e.name || e.message}`);
          this._addLog('warn', `TextDecoder('${enc}') 不可用：${e.message}`);
        }
      }
      // fatal 选项演示：非法字节
      lines.push('');
      lines.push('【fatal 选项】用非法字节 [0xff 0xfe 0xfd] 测试:');
      try {
        const bad = new Uint8Array([0xff, 0xfe, 0xfd]);
        const safeDecoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: false });
        lines.push(`  fatal:false  → "${safeDecoder.decode(bad)}"（替换为 U+FFFD）`);
        try {
          new TextDecoder('utf-8', { fatal: true }).decode(bad);
          lines.push('  fatal:true   → 未抛异常（异常）');
        } catch (e) {
          lines.push(`  fatal:true   → 抛异常: ${e.name}`);
        }
      } catch (e) {
        lines.push(`  fatal 演示失败: ${e.message}`);
      }
      this.setState({ decResult: lines.join('\n') });
    } catch (err) {
      this._addLog('err', `decode 多编码演示失败：${err.message}`);
    }
  }

  _runEncodeInto() {
    if (typeof TextEncoder === 'undefined' || typeof TextEncoder.prototype.encodeInto !== 'function') {
      this._addLog('warn', 'TextEncoder.encodeInto 不可用');
      return;
    }
    try {
      const now = (typeof performance !== 'undefined' && performance.now) ? () => performance.now() : () => Date.now();
      const str = '你好世界 Hello World '.repeat(2000);
      const encoder = new TextEncoder();

      // encodeInto：写入预分配缓冲区
      const buf = new Uint8Array(str.length * 4);
      const t0 = now();
      const { read, written } = encoder.encodeInto(str, buf);
      const t1 = now();

      // encode：返回新 Uint8Array
      const t2 = now();
      const bytes = encoder.encode(str);
      const t3 = now();

      const lines = [
        `测试字符串长度: ${str.length} 字符`,
        '',
        '【encodeInto(str, uint8Array)】',
        `  返回 { read: ${read}, written: ${written} }`,
        `  预分配缓冲区大小: ${buf.length} 字节`,
        `  耗时: ${(t1 - t0).toFixed(4)} ms`,
        '',
        '【encode(str)】',
        `  返回新 Uint8Array，字节长度: ${bytes.length}`,
        `  耗时: ${(t3 - t2).toFixed(4)} ms`,
        '',
        '结论: encodeInto 直接写入调用方提供的缓冲区，避免额外分配；',
        '      适合高频 / 大数据量编码场景（如 WebSocket、流式序列化）。',
      ];
      this.setState({ encResult: lines.join('\n') });
      this._addLog('enc', `encodeInto 对比 encode：read=${read} written=${written}，耗时 ${(t1 - t0).toFixed(3)}ms vs ${(t3 - t2).toFixed(3)}ms`);
    } catch (err) {
      this._addLog('err', `encodeInto 演示失败：${err.message}`);
    }
  }

  _renderCard1() {
    return this._card(
      '1. Encoding API — TextEncoder / TextDecoder',
      'TextEncoder 仅支持 UTF-8，encode(str) → Uint8Array；TextDecoder 支持 utf-8 / gbk / shift_jis / euc-kr 等多种编码，decode(bytes) → str；options: { fatal, ignoreBOM }；encodeInto(str, uint8) → { read, written }。',
      h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'TextEncoder'),
        h(Tag, { color: 'success' }, 'TextDecoder'),
        h(Tag, { color: 'warning' }, 'encodeInto'),
      ),
      [
        h('div', { class: 'flex gap-sm flex-wrap' },
          this._btn('编码演示', { type: 'primary', size: 'sm', onClick: () => this._runEncode() }),
          this._btn('decode 多编码', { size: 'sm', onClick: () => this._runDecode() }),
          this._btn('encodeInto 性能对比', { size: 'sm', onClick: () => this._runEncodeInto() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '编码 / 性能结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px' } }, this.state.encResult || '（点击「编码演示」）'),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'decode 多编码结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px' } }, this.state.decResult || '（点击「decode 多编码」）'),
      ],
    );
  }

  // =================== Card 2: TextEncoderStream / TextDecoderStream ===================
  _runStream() {
    if (typeof TextEncoderStream === 'undefined' || typeof TextDecoderStream === 'undefined') {
      this._addLog('warn', 'TextEncoderStream / TextDecoderStream 不可用（建议 Chrome 71+ / Node 18+）');
      this.setState({ streamResult: '流式编码 API 不支持。\nTextEncoderStream / TextDecoderStream 需要 Chrome 71+ 或 Node 18+。' });
      return;
    }
    if (typeof ReadableStream === 'undefined') {
      this._addLog('warn', 'ReadableStream 不可用，无法演示流式管道');
      this.setState({ streamResult: 'ReadableStream 不可用' });
      return;
    }
    // 中止上一次未完成的读取（AbortController 清理）
    try { this._abortController?.abort(); } catch { /* noop */ }
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    const text = '你好，流式世界！Hello streaming world. 这是第二段文本。';

    (async () => {
      try {
        // 1. 字符串分块（模拟流式输入）
        const chunks = [text.slice(0, 6), text.slice(6, 14), text.slice(14)];
        const readable = new ReadableStream({
          start(controller) {
            for (const c of chunks) controller.enqueue(c);
            controller.close();
          },
        });

        // 2. 检查 readable / writable 属性（pipeThrough 前读取，避免锁定）
        const enc = new TextEncoderStream();
        const dec = new TextDecoderStream('utf-8', { fatal: false, ignoreBOM: false });
        const hasEncReadable = !!enc.readable;
        const hasEncWritable = !!enc.writable;
        const hasDecReadable = !!dec.readable;
        const hasDecWritable = !!dec.writable;

        // 3. 管道：string → bytes → string
        const piped = readable.pipeThrough(enc).pipeThrough(dec);
        const reader = piped.getReader();

        let result = '';
        let receivedChunks = 0;
        while (true) {
          if (signal.aborted) { try { reader.releaseLock(); } catch { /* noop */ } return; }
          const { done, value } = await reader.read();
          if (done) break;
          result += value;
          receivedChunks++;
        }
        if (this._destroyed) return;

        // 4. 用 TextEncoder 单独计算 UTF-8 字节用于展示
        let bytesHex = '';
        try {
          const bytes = new TextEncoder().encode(text);
          bytesHex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(' ');
        } catch { /* noop */ }

        const lines = [
          `原始文本: "${text}"`,
          `输入分块数: ${chunks.length}（切片模拟流式输入）`,
          `UTF-8 字节(hex): ${bytesHex.slice(0, 60)}${bytesHex.length > 60 ? ' ...' : ''}`,
          '',
          '流式管道:',
          '  ReadableStream<string>',
          '    → pipeThrough(new TextEncoderStream())   // string → Uint8Array',
          '    → pipeThrough(new TextDecoderStream())   // Uint8Array → string',
          '',
          `往返结果: "${result}"`,
          `收到分块数: ${receivedChunks}`,
          `一致性: ${result === text ? '✓ 完全一致' : '✗ 不一致'}`,
          '',
          '属性检查:',
          `  TextEncoderStream.readable = ${hasEncReadable}`,
          `  TextEncoderStream.writable = ${hasEncWritable}`,
          `  TextDecoderStream.readable = ${hasDecReadable}`,
          `  TextDecoderStream.writable = ${hasDecWritable}`,
          '',
          '典型用法: fetch(url).then(r => r.body.pipeThrough(new TextDecoderStream()))',
          '可在不一次性下载整个响应的情况下流式解码文本。',
        ];
        this.setState({ streamResult: lines.join('\n') });
        this._addLog('stream', `流式往返成功：收到 ${receivedChunks} 个分块，一致性 ${result === text ? '✓' : '✗'}`);
      } catch (err) {
        if (signal.aborted || this._destroyed) return;
        this._addLog('err', `流式编码失败：${err.message}`);
        this.setState({ streamResult: `流式编码失败: ${err.message}` });
      }
    })();
  }

  _renderCard2() {
    return this._card(
      '2. TextEncoderStream / TextDecoderStream — 流式编码',
      'new TextEncoderStream() / new TextDecoderStream(label, { fatal, ignoreBOM })；拥有 readable / writable 属性，可 pipeThrough；常用于 fetch response.body 流式解码。',
      h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'TextEncoderStream'),
        h(Tag, { color: 'success' }, 'TextDecoderStream'),
        h(Tag, { color: 'warning' }, 'pipeThrough'),
      ),
      [
        h('div', { class: 'flex gap-sm flex-wrap' },
          this._btn('流式编码-解码往返', { type: 'primary', size: 'sm', onClick: () => this._runStream() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '流式往返结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px' } }, this.state.streamResult || '（点击「流式编码-解码往返」）'),
      ],
    );
  }

  // =================== Card 3: Intl.Segmenter ===================
  _runSegmentZh() {
    if (typeof Intl === 'undefined' || typeof Intl.Segmenter === 'undefined') {
      this._addLog('warn', 'Intl.Segmenter 不可用（建议 Chrome 87+ / Node 16+）');
      this.setState({ segResult: 'Intl.Segmenter 不支持' });
      return;
    }
    try {
      const str = '你好，世界！人工智能正在改变世界。';
      const seg = new Intl.Segmenter('zh', { granularity: 'word' });
      const segments = Array.from(seg.segment(str));
      const lines = segments.map((s, i) =>
        `[${String(i).padStart(2, '0')}] segment="${s.segment}"  isWordLike=${s.isWordLike}  index=${s.index}`);
      const words = segments.filter((s) => s.isWordLike).map((s) => s.segment);
      lines.push('');
      lines.push(`提取词（isWordLike=true）: ${words.join(' / ')}`);
      this.setState({ segResult: lines.join('\n') });
      this._addLog('seg', `中文 word 分词：${segments.length} 段，词 ${words.length} 个`);
    } catch (err) {
      this._addLog('err', `中文分词失败：${err.message}`);
    }
  }

  _runSegmentEn() {
    if (typeof Intl === 'undefined' || typeof Intl.Segmenter === 'undefined') {
      this._addLog('warn', 'Intl.Segmenter 不可用');
      return;
    }
    try {
      const str = "Hello world! The quick brown fox jumps. Let's test.";
      const segWord = new Intl.Segmenter('en', { granularity: 'word' });
      const segments = Array.from(segWord.segment(str));
      const lines = ['【word 分词】'];
      segments.forEach((s, i) =>
        lines.push(`  [${String(i).padStart(2, '0')}] seg="${s.segment}"  isWordLike=${s.isWordLike}  index=${s.index}`));
      const words = segments.filter((s) => s.isWordLike).map((s) => s.segment);
      lines.push('');
      lines.push(`英文词: ${words.join(' / ')}`);

      // sentence 分句
      const segSent = new Intl.Segmenter('en', { granularity: 'sentence' });
      const sentences = Array.from(segSent.segment(str));
      lines.push('');
      lines.push(`【sentence 分句】共 ${sentences.length} 句:`);
      sentences.forEach((s, i) => lines.push(`  句[${i}] "${s.segment.trim()}"`));
      this.setState({ segResult: lines.join('\n') });
      this._addLog('seg', `英文 word 分词：${segments.length} 段；sentence 分句 ${sentences.length} 句`);
    } catch (err) {
      this._addLog('err', `英文分词失败：${err.message}`);
    }
  }

  _runSegmentGrapheme() {
    if (typeof Intl === 'undefined' || typeof Intl.Segmenter === 'undefined') {
      this._addLog('warn', 'Intl.Segmenter 不可用');
      return;
    }
    try {
      // 含 emoji surrogate pair / ZWJ 序列 / 国旗（regional indicator）
      const str = '👨‍👩‍👧 家庭 emoji！🇨🇳 国旗 + 🏳️‍🌈 彩虹旗';
      const seg = new Intl.Segmenter('zh', { granularity: 'grapheme' });
      const segments = Array.from(seg.segment(str));
      const lines = [
        `输入: "${str}"`,
        `JS .length（UTF-16 码元数）: ${str.length}`,
        `Array.from(str).length（码点数）: ${Array.from(str).length}`,
        `grapheme 字素数: ${segments.length}`,
        '',
        '逐字素（展示 emoji surrogate pair / ZWJ 处理）:',
      ];
      segments.forEach((s, i) => {
        const cp = s.segment.codePointAt(0).toString(16).toUpperCase();
        lines.push(`  [${String(i).padStart(2, '0')}] "${s.segment}"  U+${cp.padStart(4, '0')}  index=${s.index}`);
      });
      lines.push('');
      lines.push('说明: 👨‍👩‍👧 是 man + ZWJ + woman + ZWJ + girl 组合字素；');
      lines.push('      🇨🇳 是两个 regional indicator 码元组合。grapheme 粒度正确把它们视为单个字素。');
      this.setState({ segResult: lines.join('\n') });
      this._addLog('seg', `grapheme 字素切分：${segments.length} 个字素（JS length=${str.length}）`);
    } catch (err) {
      this._addLog('err', `grapheme 切分失败：${err.message}`);
    }
  }

  _renderCard3() {
    return this._card(
      '3. Intl.Segmenter — 分词 / 分段 / 字素',
      'new Intl.Segmenter(locale, { granularity: "grapheme" | "word" | "sentence" | "line" })；segment(str) 返回可迭代的 Segments；每段 { segment, index, input, isWordLike }。',
      h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'Segmenter'),
        h(Tag, { color: 'success' }, 'word'),
        h(Tag, { color: 'success' }, 'sentence'),
        h(Tag, { color: 'warning' }, 'grapheme'),
      ),
      [
        h('div', { class: 'flex gap-sm flex-wrap' },
          this._btn('中文分词', { type: 'primary', size: 'sm', onClick: () => this._runSegmentZh() }),
          this._btn('英文分词', { size: 'sm', onClick: () => this._runSegmentEn() }),
          this._btn('grapheme 字素', { size: 'sm', onClick: () => this._runSegmentGrapheme() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '分词 / 字素结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '340px' } }, this.state.segResult || '（点击上方按钮）'),
      ],
    );
  }

  // =================== Card 4: Intl 高级格式化 ===================
  _runListFormat() {
    if (typeof Intl === 'undefined' || typeof Intl.ListFormat === 'undefined') {
      this._addLog('warn', 'Intl.ListFormat 不可用');
      return;
    }
    try {
      const items = ['苹果', '香蕉', '橘子'];
      const lines = [];
      for (const locale of ['zh', 'en', 'ja']) {
        for (const type of ['conjunction', 'disjunction']) {
          for (const style of ['long', 'short', 'narrow']) {
            try {
              const fmt = new Intl.ListFormat(locale, { type, style });
              lines.push(`${locale} [${type}/${style}]: ${fmt.format(items)}`);
            } catch (e) {
              lines.push(`${locale} [${type}/${style}]: 不支持`);
            }
          }
        }
      }
      this.setState({ listResult: lines.join('\n') });
      this._addLog('list', `ListFormat 已生成 ${lines.length} 种 locale/type/style 组合`);
    } catch (err) {
      this._addLog('err', `ListFormat 失败：${err.message}`);
    }
  }

  _runPluralRules() {
    if (typeof Intl === 'undefined' || typeof Intl.PluralRules === 'undefined') {
      this._addLog('warn', 'Intl.PluralRules 不可用');
      return;
    }
    try {
      const lines = [];
      const card = new Intl.PluralRules('en', { type: 'cardinal' });
      lines.push('【cardinal（基数）en】 select(0..5):');
      [0, 1, 2, 3, 4, 5].forEach((n) => lines.push(`  ${n} → ${card.select(n)}`));

      const ord = new Intl.PluralRules('en', { type: 'ordinal' });
      const suffix = { one: 'st', two: 'nd', few: 'rd', other: 'th' };
      lines.push('');
      lines.push('【ordinal（序数）en】 1..5:');
      [1, 2, 3, 4, 5].forEach((n) => lines.push(`  ${n}${suffix[ord.select(n)] || ''} → ${ord.select(n)}`));

      // 俄语有多形式：one / few / many / other
      const ru = new Intl.PluralRules('ru', { type: 'cardinal' });
      lines.push('');
      lines.push('【cardinal ru】 1 / 2 / 5 / 21 / 22:');
      [1, 2, 5, 21, 22].forEach((n) => lines.push(`  ${n} → ${ru.select(n)}`));
      this.setState({ pluralResult: lines.join('\n') });
      this._addLog('plural', 'PluralRules select 0-5 完成（cardinal + ordinal + ru 多形式）');
    } catch (err) {
      this._addLog('err', `PluralRules 失败：${err.message}`);
    }
  }

  _runRelativeTime() {
    if (typeof Intl === 'undefined' || typeof Intl.RelativeTimeFormat === 'undefined') {
      this._addLog('warn', 'Intl.RelativeTimeFormat 不可用');
      return;
    }
    try {
      const lines = [];
      const fmtAuto = new Intl.RelativeTimeFormat('zh', { numeric: 'auto', style: 'long' });
      const fmtAlways = new Intl.RelativeTimeFormat('zh', { numeric: 'always', style: 'long' });
      lines.push('【zh, numeric:auto】（-1 = 昨天，+1 = 明天）:');
      lines.push(`  -1 day → ${fmtAuto.format(-1, 'day')}`);
      lines.push(`  +1 day → ${fmtAuto.format(1, 'day')}`);
      lines.push(`   0 day → ${fmtAuto.format(0, 'day')}`);
      lines.push('');
      lines.push('【zh, numeric:always】:');
      lines.push(`  -1 day → ${fmtAlways.format(-1, 'day')}`);
      lines.push(`  +1 day → ${fmtAlways.format(1, 'day')}`);
      lines.push(`   0 day → ${fmtAlways.format(0, 'day')}`);
      lines.push('');
      lines.push('【多 unit, auto】（-1）:');
      ['year', 'month', 'week', 'day', 'hour', 'minute', 'second'].forEach((u) => {
        lines.push(`  -1 ${u.padEnd(8)} → ${fmtAuto.format(-1, u)}`);
      });
      lines.push('');
      lines.push('【2 天后】:');
      lines.push(`  +2 day → ${fmtAuto.format(2, 'day')}`);
      this.setState({ relResult: lines.join('\n') });
      this._addLog('rel', 'RelativeTimeFormat 演示完成（1天前 / 2天后 / 昨天 / 明天）');
    } catch (err) {
      this._addLog('err', `RelativeTimeFormat 失败：${err.message}`);
    }
  }

  _runDisplayNames() {
    if (typeof Intl === 'undefined' || typeof Intl.DisplayNames === 'undefined') {
      this._addLog('warn', 'Intl.DisplayNames 不可用');
      return;
    }
    try {
      const lines = [];
      const lang = new Intl.DisplayNames('zh', { type: 'language' });
      lines.push('【language】:');
      ['en', 'ja', 'fr', 'ko'].forEach((c) => lines.push(`  ${c} → ${lang.of(c)}`));

      const region = new Intl.DisplayNames('zh', { type: 'region' });
      lines.push('');
      lines.push('【region】:');
      ['US', 'CN', 'JP', 'FR'].forEach((c) => lines.push(`  ${c} → ${region.of(c)}`));

      const currency = new Intl.DisplayNames('zh', { type: 'currency' });
      lines.push('');
      lines.push('【currency】:');
      ['USD', 'CNY', 'JPY', 'EUR'].forEach((c) => lines.push(`  ${c} → ${currency.of(c)}`));

      const script = new Intl.DisplayNames('zh', { type: 'script' });
      lines.push('');
      lines.push('【script】:');
      ['Latn', 'Hans', 'Hant', 'Cyrl'].forEach((c) => lines.push(`  ${c} → ${script.of(c)}`));

      // DurationFormat（较新，能力检测）
      lines.push('');
      lines.push('【DurationFormat】（较新 API）:');
      if (typeof Intl.DurationFormat !== 'undefined') {
        try {
          const df = new Intl.DurationFormat('zh', { style: 'long' });
          const dur = df.format({ hours: 1, minutes: 2, seconds: 3 });
          lines.push(`  zh long {h:1,m:2,s:3} → ${dur}`);
          const dfShort = new Intl.DurationFormat('en', { style: 'short' });
          lines.push(`  en short {h:1,m:2,s:3} → ${dfShort.format({ hours: 1, minutes: 2, seconds: 3 })}`);
          this._addLog('display', 'DisplayNames + DurationFormat 演示完成');
        } catch (e) {
          lines.push(`  失败: ${e.message}`);
          this._addLog('warn', `DurationFormat 调用失败：${e.message}`);
        }
      } else {
        lines.push('  Intl.DurationFormat 不支持（较新，Node 22+ / Chrome 较新版本）');
        this._addLog('display', 'DisplayNames 演示完成（DurationFormat 不支持）');
      }
      this.setState({ displayResult: lines.join('\n') });
    } catch (err) {
      this._addLog('err', `DisplayNames 失败：${err.message}`);
    }
  }

  _renderCard4() {
    return this._card(
      '4. Intl 高级格式化 — ListFormat / PluralRules / RelativeTimeFormat / DisplayNames / DurationFormat',
      'ListFormat 列表连接词；PluralRules 基数/序数规则（select → one/other/two/few/many）；RelativeTimeFormat 相对时间（昨天/明天）；DisplayNames 语言/地区/货币/脚本本地化名称；DurationFormat 时长格式化（较新）。',
      h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'ListFormat'),
        h(Tag, { color: 'success' }, 'PluralRules'),
        h(Tag, { color: 'warning' }, 'RelativeTimeFormat'),
        h(Tag, { color: 'warning' }, 'DisplayNames'),
        h(Tag, { color: 'default' }, 'DurationFormat'),
      ),
      [
        h('div', { class: 'flex gap-sm flex-wrap' },
          this._btn('ListFormat', { type: 'primary', size: 'sm', onClick: () => this._runListFormat() }),
          this._btn('PluralRules 0-5', { type: 'primary', size: 'sm', onClick: () => this._runPluralRules() }),
          this._btn('RelativeTime', { type: 'primary', size: 'sm', onClick: () => this._runRelativeTime() }),
          this._btn('DisplayNames', { type: 'primary', size: 'sm', onClick: () => this._runDisplayNames() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'ListFormat 结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '200px' } }, this.state.listResult || '（点击 ListFormat）'),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'PluralRules 结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '200px' } }, this.state.pluralResult || '（点击 PluralRules）'),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'RelativeTimeFormat 结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '200px' } }, this.state.relResult || '（点击 RelativeTime）'),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'DisplayNames / DurationFormat 结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px' } }, this.state.displayResult || '（点击 DisplayNames）'),
      ],
    );
  }

  // =================== Card 5: CSS Font Loading API ===================
  _checkFonts() {
    if (typeof document === 'undefined' || !document.fonts) {
      this._addLog('warn', 'document.fonts（FontFaceSet）不可用（jsdom 通常缺失）');
      this.setState({ fontResult: 'document.fonts 不可用。\nCSS Font Loading API 需要 Chrome 35+，jsdom 不支持。' });
      return;
    }
    try {
      const fonts = document.fonts;
      const lines = [];
      lines.push(`document.fonts 构造器: ${fonts.constructor?.name || 'FontFaceSet'}`);
      lines.push(`document.fonts.size: ${fonts.size}`);
      lines.push(`document.fonts.status: ${fonts.status}`);
      lines.push(`typeof fonts.add:    ${typeof fonts.add}`);
      lines.push(`typeof fonts.has:    ${typeof fonts.has}`);
      lines.push(`typeof fonts.check:  ${typeof fonts.check}`);
      lines.push(`typeof fonts.load:   ${typeof fonts.load}`);
      lines.push(`typeof fonts.clear:  ${typeof fonts.clear}`);
      lines.push(`typeof fonts.ready:  ${fonts.ready ? 'Promise' : 'undefined'}`);
      lines.push(`typeof fonts.forEach:${typeof fonts.forEach}`);
      lines.push('');
      lines.push('【check(font, text) 测试】:');
      ['16px Arial', '16px "Times New Roman"', '16px "NonExistent-Font-XYZ"', 'bold 16px sans-serif'].forEach((f) => {
        try {
          lines.push(`  fonts.check("${f}") → ${fonts.check(f)}`);
        } catch (e) {
          lines.push(`  fonts.check("${f}") → 异常: ${e.message}`);
        }
      });
      // 注册 onloadingdone 事件（this._fontHandler 引用，componentWillUnmount 移除）
      if (!this._fontHandler) {
        this._fontHandler = () => {
          if (this._destroyed) return;
          this._addLog('font', 'FontFaceSet 事件: onloadingdone（字体加载完成）');
        };
        try { fonts.addEventListener('loadingdone', this._fontHandler); } catch { /* noop */ }
      }
      this.setState({ fontResult: lines.join('\n') });
      this._addLog('font', `检测 document.fonts：size=${fonts.size}, status=${fonts.status}`);
    } catch (err) {
      this._addLog('err', `检测 document.fonts 失败：${err.message}`);
    }
  }

  _loadFontFace() {
    if (typeof FontFace === 'undefined') {
      this._addLog('warn', 'FontFace 构造器不可用（jsdom 通常缺失）');
      this.setState({ fontResult: 'FontFace 不可用。\nnew FontFace() 需要 Chrome 35+，jsdom 不支持。' });
      return;
    }
    try {
      // 模拟加载网络字体（jsdom 大概率不支持，用 try/catch 兜底）
      const ff = new FontFace('DemoFont', 'url(https://fonts.gstatic.com/s/notosanssc/v1.woff2)', {
        weight: '400',
        style: 'normal',
      });
      const lines = [
        `new FontFace('DemoFont', 'url(...)') → ${ff.constructor.name}`,
        `ff.family: ${ff.family}`,
        `ff.weight: ${ff.weight}`,
        `ff.style:  ${ff.style}`,
        `ff.status: ${ff.status}`,
        `ff.display: ${ff.display}`,
        '',
        '调用 ff.load() ...(返回 Promise<FontFace>)',
      ];
      this.setState({ fontResult: lines.join('\n') });
      this._addLog('font', `FontFace.load() 已发起（status=${ff.status}），等待 Promise...`);

      ff.load().then((loaded) => {
        if (this._destroyed) return;
        // 加入 document.fonts（FontFaceSet）
        let added = false;
        try {
          if (typeof document !== 'undefined' && document.fonts) {
            document.fonts.add(loaded);
            added = true;
          }
        } catch (e) {
          this._addLog('warn', `add 到 document.fonts 失败：${e.message}`);
        }
        const more = [...lines, '', `ff.load() 成功！status=${loaded.status}`, added ? '已 document.fonts.add(loaded)' : 'document.fonts 不可用，未 add'];
        this.setState({ fontResult: more.join('\n') });
        this._addLog('font', `FontFace.load 成功（status=${loaded.status}），${added ? '已 add 到 document.fonts' : '未 add'}`);
      }).catch((err) => {
        if (this._destroyed) return;
        const more = [...lines, '', `ff.load() 失败: ${err.message}`, '（网络字体在 jsdom / 离线环境无法加载属正常）'];
        this.setState({ fontResult: more.join('\n') });
        this._addLog('warn', `FontFace.load 失败（网络/jsdom 不支持）：${err.message}`);
      });
    } catch (err) {
      this._addLog('err', `FontFace 演示失败：${err.message}`);
    }
  }

  _checkFontsReady() {
    if (typeof document === 'undefined' || !document.fonts || !document.fonts.ready) {
      this._addLog('warn', 'document.fonts.ready 不可用');
      this.setState({ fontResult: 'document.fonts.ready 不可用' });
      return;
    }
    try {
      const fonts = document.fonts;
      const lines = [
        `document.fonts.status: ${fonts.status}`,
        `document.fonts.size: ${fonts.size}`,
        `document.fonts.ready: ${fonts.ready.constructor.name}`,
        '',
        '等待 ready Promise resolve ...(所有字体加载完成时 resolve)',
      ];
      this.setState({ fontResult: lines.join('\n') });
      // 注册 onloadingdone（this._fontHandler 引用）
      if (!this._fontHandler) {
        this._fontHandler = () => {
          if (this._destroyed) return;
          this._addLog('font', 'FontFaceSet 事件: onloadingdone（字体加载完成）');
        };
        try { fonts.addEventListener('loadingdone', this._fontHandler); } catch { /* noop */ }
      }
      fonts.ready.then((fs) => {
        if (this._destroyed) return;
        const more = [
          ...lines,
          '',
          `ready 已 resolve！`,
          `resolved status: ${fs.status}`,
          `resolved size: ${fs.size}`,
          '',
          '说明: document.fonts.ready 在所有 @font-face 与 add() 的字体加载完成时 resolve；',
          '      可用于确保字体就绪后再渲染文本，避免 FOUT（无样式文本闪烁）。',
        ];
        this.setState({ fontResult: more.join('\n') });
        this._addLog('font', `document.fonts.ready 已 resolve（status=${fs.status}, size=${fs.size}）`);
      }).catch((err) => {
        if (this._destroyed) return;
        this._addLog('warn', `document.fonts.ready 失败：${err.message}`);
      });
    } catch (err) {
      this._addLog('err', `document.fonts.ready 检查失败：${err.message}`);
    }
  }

  _renderCard5() {
    return this._card(
      '5. CSS Font Loading API — FontFace / document.fonts',
      'new FontFace(family, source, { weight, style }).load() → Promise<FontFace>；document.fonts（FontFaceSet）：add / has / delete / check / load / ready / clear / onloadingdone。',
      h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'FontFace'),
        h(Tag, { color: 'success' }, 'FontFaceSet'),
        h(Tag, { color: 'warning' }, 'document.fonts'),
      ),
      [
        h('div', { class: 'flex gap-sm flex-wrap' },
          this._btn('检测 document.fonts', { type: 'primary', size: 'sm', onClick: () => this._checkFonts() }),
          this._btn('模拟 FontFace.load', { size: 'sm', onClick: () => this._loadFontFace() }),
          this._btn('document.fonts.ready', { size: 'sm', onClick: () => this._checkFontsReady() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'Font Loading 结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px' } }, this.state.fontResult || '（点击上方按钮）'),
      ],
    );
  }

  // =================== 日志面板 ===================
  _renderLogPanel() {
    const s = this.state;
    return h('div', { class: 'log-panel' },
      h('div', { class: 'log-panel__header' }, '事件日志'),
      s.logs.length === 0
        ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
        : s.logs.map((log) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  // =================== 主渲染 ===================
  render() {
    const s = this.state;
    return h('div', { class: 'page api-lab-page' },
      h('h2', { class: 'section-title' }, '文本编码与国际化实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' }, '演示 Encoding API / TextEncoderStream / Intl.Segmenter / Intl 高级格式化 / CSS Font Loading API。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderLogPanel(),
    );
  }
}
