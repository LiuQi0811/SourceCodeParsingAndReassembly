// =====================================================================
// BuiltInAIPage.js —— 内置 AI 与 WebNN 实验室
// 演示 MDN / Chrome 内置 AI APIs：
//   1. Translator API 翻译 —— Translator.create / translate / destroy /
//      availability / monitor 下载进度
//   2. LanguageDetector 语言检测 —— LanguageDetector.create / detect /
//      availability（按 confidence 排序的检测结果数组）
//   3. Summarizer 摘要 + Writer / Rewriter 写作 —— summarize /
//      summarizeStreaming（AsyncIterable）/ write / rewrite
//   4. Prompt API（LanguageModel）—— prompt / promptStreaming /
//      countPromptTokens / params / availability
//   5. AI 可用性检测与会话管理 —— navigator.ai / window.ai /
//      canCreateGenericSession / 汇总各 Availability 状态
//   6. WebNN（Neural Network）API —— navigator.ml / createContext /
//      MLGraphBuilder / build / compute（含 NPU 加速说明）
// 说明：内置 AI API（Translator/Summarizer/LanguageModel 等）与 WebNN
//       均为 Chrome 138+ 的新能力，需 HTTPS + 用户开启 flag + 模型下载。
//       jsdom / Node 中 polyfill 不包含这些 API，故 typeof 全部为
//       "undefined"。所有调用前做 typeof 能力检测，不可用时仅记日志
//       （_addLog('warn'/'info', ...)），绝不抛异常。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { State } from '../../core/types.js';

interface BuiltInAIPageState extends State {
  logs: any;
  capsSummary: any;
  translatorInfo: any;
  detectorInfo: any;
  summarizerInfo: any;
  promptInfo: any;
  availabilityInfo: any;
  webnnInfo: any;
}

export class BuiltInAIPage extends Page {
  declare state: BuiltInAIPageState;
  _detector!: any;
  _inited!: boolean;
  _languageModel!: any;
  _mlContext!: any | null;
  _rewriter!: any;
  _summarizer!: any;
  _translator!: any;
  _writer!: any;

  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      translatorInfo: '',     // Card 1：Translator API 翻译
      detectorInfo: '',       // Card 2：LanguageDetector 语言检测
      summarizerInfo: '',     // Card 3：Summarizer + Writer / Rewriter
      promptInfo: '',         // Card 4：Prompt API（LanguageModel）
      availabilityInfo: '',   // Card 5：AI 可用性检测与会话管理
      webnnInfo: '',          // Card 6：WebNN（Neural Network）API
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._translator = null;       // Card 1 Translator 实例
    this._detector = null;         // Card 2 LanguageDetector 实例
    this._summarizer = null;       // Card 3 Summarizer 实例
    this._writer = null;           // Card 3 Writer 实例
    this._rewriter = null;         // Card 3 Rewriter 实例
    this._languageModel = null;    // Card 4 LanguageModel 会话
    this._mlContext = null;        // Card 6 WebNN MLContext

    // 一次性能力检测：内置 AI 全家桶 + WebNN
    const caps = this._caps();
    const parts = [
      `Translator ${caps.translator ? '✓' : '✗'}`,
      `LanguageDetector ${caps.languageDetector ? '✓' : '✗'}`,
      `Summarizer ${caps.summarizer ? '✓' : '✗'}`,
      `Writer ${caps.writer ? '✓' : '✗'}`,
      `Rewriter ${caps.rewriter ? '✓' : '✗'}`,
      `LanguageModel ${caps.languageModel ? '✓' : '✗'}`,
      `navigator.ai ${caps.navigatorAi ? '✓' : '✗'}`,
      `window.ai ${caps.windowAi ? '✓' : '✗'}`,
      `navigator.ml (WebNN) ${caps.navigatorMl ? '✓' : '✗'}`,
      `navigator.gpu (WebGPU) ${caps.navigatorGpu ? '✓' : '✗'}`,
    ];
    const anyAvailable = caps.translator || caps.languageDetector || caps.summarizer ||
      caps.writer || caps.rewriter || caps.languageModel || caps.navigatorMl;
    const summary = anyAvailable
      ? `内置 AI / WebNN 能力检测：${parts.join(' · ')}。当前环境支持部分能力，可执行真实演示；其余按钮点击将仅记日志说明。`
      : `内置 AI / WebNN 能力检测：${parts.join(' · ')}。这些 API 为 Chrome 138+ 新能力，需 HTTPS + chrome://flags 开启 + 模型下载；jsdom / Node 的 polyfill 不包含它们（typeof 均为 "undefined"），所有按钮点击将仅记日志说明用法与浏览器支持状态，不会抛异常。在真实 Chrome 138+ 浏览器中打开可完整演示。`;
    this.setState({ capsSummary: summary });
    this._addLog(anyAvailable ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!caps.translator) this._addLog('warn', 'Translator 不可用（Chrome 138+，多数环境需 flag）');
    if (!caps.languageDetector) this._addLog('warn', 'LanguageDetector 不可用（Chrome 138+）');
    if (!caps.summarizer) this._addLog('warn', 'Summarizer 不可用（Chrome 138+）');
    if (!caps.writer || !caps.rewriter) this._addLog('warn', 'Writer / Rewriter 不可用（Chrome 138+）');
    if (!caps.languageModel) this._addLog('warn', 'LanguageModel（Prompt API）不可用（Chrome 138+）');
    if (!caps.navigatorMl) this._addLog('warn', 'navigator.ml（WebNN）不可用（Chrome 138+，部分平台仅 Origin Trial）');
  }

  componentWillUnmount() {
    // 释放所有已创建的 AI 会话 / translator / ML context（每个 try/catch，避免互相影响）
    const release = (obj: any) => {
      if (obj && typeof obj.destroy === 'function') {
        try { obj.destroy(); } catch { /* noop */ }
      }
    };
    release(this._translator);
    release(this._detector);
    release(this._summarizer);
    release(this._writer);
    release(this._rewriter);
    release(this._languageModel);
    release(this._mlContext);
    this._translator = this._detector = this._summarizer = null;
    this._writer = this._rewriter = this._languageModel = null;
    this._mlContext = null;
  }

  // —— 日志 / 按钮辅助 ——

  _addLog(type: any, content: any){
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label: any, opts: any){
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // —— 同步能力检测（render 时调用，开销可忽略）——
  _caps() {
    const translator = typeof Translator !== 'undefined';
    const languageDetector = typeof LanguageDetector !== 'undefined';
    const summarizer = typeof Summarizer !== 'undefined';
    const writer = typeof Writer !== 'undefined';
    const rewriter = typeof Rewriter !== 'undefined';
    const languageModel = typeof LanguageModel !== 'undefined';
    const navigatorAi = typeof navigator !== 'undefined' && !!navigator.ai;
    const windowAi = typeof window !== 'undefined' && !!window.ai;
    const navigatorMl = typeof navigator !== 'undefined' && !!navigator.ml;
    const navigatorGpu = typeof navigator !== 'undefined' && !!navigator.gpu;
    return {
      translator, languageDetector, summarizer, writer, rewriter,
      languageModel, navigatorAi, windowAi, navigatorMl, navigatorGpu,
    };
  }

  // =================== Card 1：Translator API 翻译 ===================

  // 检测 (Translator as any).availability 并说明状态枚举
  async _checkTranslator() {
    const caps = this._caps();
    if (!caps.translator) {
      this.setState({ translatorInfo:
        'Translator API 用法（测试环境不可用，仅说明）：\n\n' +
        "// 静态：检查可用性（返回 Availability 枚举）\n" +
        "const status = await (Translator as any).availability();\n" +
        "// 'available'|'downloadable'|'downloading'|'available-after-download'|'unavailable'\n\n" +
        '// 创建 Translator（若需下载模型，传入 monitor 回调）\n' +
        "const translator = await Translator.create({\n" +
        "  sourceLanguage: 'en', targetLanguage: 'zh',\n" +
        '  monitor: (downloadProgress: any) => console.log(downloadProgress),\n' +
        "});\nconst zh = await translator.translate('Hello world');\n" +
        'translator.destroy();   // 释放\n\n' +
        '说明：Chrome 138+ 提供，多数环境需在 chrome://flags 开启 Translation API\n' +
        '  并下载语言模型；本环境 typeof Translator === "undefined"，仅记录用法。' });
      this._addLog('warn', 'Translator 不可用（typeof undefined），已记录用法');
      return;
    }
    try {
      this._addLog('info', '检测 (Translator as any).availability()…');
      const availability = await (Translator as any).availability();
      this.setState({ translatorInfo:
        `(Translator as any).availability() = ${JSON.stringify(availability)}\n\n` +
        'Availability 枚举含义：\n' +
        "  'available'                —— 模型已下载，可直接创建\n" +
        "  'downloadable'             —— 可下载，create 时会触发下载\n" +
        "  'downloading'              —— 正在下载中\n" +
        "  'available-after-download' —— 需先完成下载\n" +
        "  'unavailable'              —— 当前环境/语言对不支持\n\n" +
        '点击「创建并翻译」创建 Translator 并翻译样例句子。' });
      this._addLog('trans', `(Translator as any).availability() = ${availability}`);
    } catch (err: any) {
      this._addLog('warn', `(Translator as any).availability 失败：${err.name} - ${err.message}`);
    }
  }

  // 创建 Translator 并翻译样例句子
  async _createAndTranslate() {
    const caps = this._caps();
    if (!caps.translator) {
      this._addLog('warn', 'Translator 不可用，无法创建');
      return;
    }
    try {
      if (this._translator && typeof this._translator.destroy === 'function') {
        try { this._translator.destroy(); } catch { /* noop */ }
      }
      this._addLog('info', '开始创建 Translator（en → zh），若需下载模型会通过 monitor 回调上报进度…');
      const translator = await Translator.create({
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        monitor: (p: any) => { this._addLog('trans', `模型下载进度：${typeof p === 'number' ? Math.round(p * 100) + '%' : JSON.stringify(p)}`); },
      });
      this._translator = translator;
      const sample = 'The built-in AI APIs enable on-device machine learning directly in the browser.';
      this._addLog('trans', `Translator 已创建，开始翻译：${sample}`);
      const translated = await translator.translate(sample);
      this.setState({ translatorInfo:
        `Translator.create({ sourceLanguage:'en', targetLanguage:'zh', monitor }) → Translator 实例\n` +
        `  monitor 回调接收 downloadProgress（下载进度）\n\n` +
        `原句（en）：${sample}\n` +
        `translate(text) → ${translated}\n\n` +
        `方法：translator.translate(text) → Promise<string>；translator.destroy() 释放\n` +
        `  注：translate 不会自动检测源语言，需在 create 时指定 sourceLanguage/targetLanguage。` });
      this._addLog('trans', `翻译结果：${translated}`);
    } catch (err: any) {
      this._addLog('warn', `Translator 创建/翻译失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. Translator API 翻译',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.translator ? 'success' : 'error' }, caps.translator ? 'Translator ✓' : 'Translator ✗'),
        h(Tag, { color: 'primary' }, 'Chrome 138+'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Translator API 提供端侧文本翻译。Translator.create({ sourceLanguage, targetLanguage, monitor }) 返回 Promise<Translator>；实例方法 translator.translate(text) 返回 Promise<string>，translator.destroy() 释放。静态 (Translator as any).availability() 返回 Availability 枚举（available / downloadable / downloading / available-after-download / unavailable）；create 的 monitor 回调接收下载进度。Chrome 138+ 提供，多数环境需在 chrome://flags 开启并下载语言模型。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测 availability', { type: 'primary', size: 'sm', disabled: !caps.translator, onClick: () => this._checkTranslator() }),
          this._btn('创建并翻译', { size: 'sm', disabled: !caps.translator, onClick: () => this._createAndTranslate() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Translator 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.translatorInfo || '（点击「检测 availability」或「创建并翻译」）')),
        h(Alert, {
          type: 'warning',
          message: 'Translator 需要指定源/目标语言，且不支持自动检测',
          description: 'create 时必须显式提供 sourceLanguage 与 targetLanguage（BCP 47 标签，如 en/zh/ja）；translate 不会自动检测源语言。若需先识别语言，请配合 LanguageDetector（见 Card 2）。首次创建某语言对会触发模型下载，用 monitor 回调上报进度。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：LanguageDetector 语言检测 ===================

  // 检测 LanguageDetector.availability
  async _checkDetector() {
    const caps = this._caps();
    if (!caps.languageDetector) {
      this.setState({ detectorInfo:
        'LanguageDetector API 用法（测试环境不可用，仅说明）：\n\n' +
        "const status = await LanguageDetector.availability();\n" +
        'const detector = await LanguageDetector.create();\n' +
        "const results = await detector.detect('Hello world');\n" +
        '// results = [{ detectedLanguage:"en", confidence:0.99 }, ...]\n' +
        '// 按 confidence 降序排列，可能含多个候选\n' +
        'detector.destroy();\n\n' +
        '说明：Chrome 138+ 提供；本环境 typeof LanguageDetector === "undefined"。' });
      this._addLog('warn', 'LanguageDetector 不可用（typeof undefined），已记录用法');
      return;
    }
    try {
      const availability = await LanguageDetector.availability();
      this.setState({ detectorInfo:
        `LanguageDetector.availability() = ${JSON.stringify(availability)}\n\n` +
        '点击「检测语言样例」对 "Hello world" / "你好世界" 进行语言检测。' });
      this._addLog('detect', `LanguageDetector.availability() = ${availability}`);
    } catch (err: any) {
      this._addLog('warn', `LanguageDetector.availability 失败：${err.name} - ${err.message}`);
    }
  }

  // 检测样例句子语言
  async _detectSamples() {
    const caps = this._caps();
    if (!caps.languageDetector) {
      this._addLog('warn', 'LanguageDetector 不可用，无法检测');
      return;
    }
    try {
      if (this._detector && typeof this._detector.destroy === 'function') {
        try { this._detector.destroy(); } catch { /* noop */ }
      }
      const detector = await LanguageDetector.create();
      this._detector = detector;
      const samples = ['Hello world', '你好世界', 'こんにちは世界'];
      const results = [];
      for (const text of samples) {
        const detected = await detector.detect(text);
        results.push({ text, detected });
        this._addLog('detect', `detect(${JSON.stringify(text)}) → ${JSON.stringify(detected)}`);
      }
      const lines = results.map((r: any) => `detect(${JSON.stringify(r.text)}) → ${JSON.stringify(r.detected)}`);
      this.setState({ detectorInfo:
        `LanguageDetector.create() → detector\n\n` +
        `检测结果（数组，按 confidence 降序，可能含多个候选）：\n  ${lines.join('\n  ')}\n\n` +
        `说明：detect(text) 返回 [{ detectedLanguage, confidence }]；\n` +
        `  detectedLanguage 为 BCP 47 语言标签，confidence 为 0~1 的置信度。` });
    } catch (err: any) {
      this._addLog('warn', `LanguageDetector 检测失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. LanguageDetector 语言检测',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.languageDetector ? 'success' : 'error' }, caps.languageDetector ? 'LanguageDetector ✓' : '不可用'),
        h(Tag, { color: 'primary' }, '按 confidence 排序'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'LanguageDetector.create() 返回 Promise<LanguageDetector>；detector.detect(text) 返回 Promise<[{ detectedLanguage, confidence }]>，数组按 confidence 降序排列，可能含多个候选语言。静态 LanguageDetector.availability() 返回 Availability。常与 Translator 配合：先用 detector 识别源语言，再创建对应语言对的 Translator。Chrome 138+ 提供。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测 availability', { type: 'primary', size: 'sm', disabled: !caps.languageDetector, onClick: () => this._checkDetector() }),
          this._btn('检测语言样例', { size: 'sm', disabled: !caps.languageDetector, onClick: () => this._detectSamples() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'LanguageDetector 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, s.detectorInfo || '（点击「检测 availability」或「检测语言样例」）')),
        h(Alert, {
          type: 'info',
          message: 'detect 返回数组而非单个结果',
          description: 'detect(text) 返回的是数组（按 confidence 降序），可包含多个候选语言，便于在置信度接近时让上层做决策。detectedLanguage 为 BCP 47 标签（如 en、zh、ja）。LanguageDetector 无需指定语言对，模型体积相对较小。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：Summarizer + Writer / Rewriter ===================

  // 检测 Summarizer.availability 与选项
  async _checkSummarizer() {
    const caps = this._caps();
    if (!caps.summarizer) {
      this.setState({ summarizerInfo:
        'Summarizer / Writer / Rewriter 用法（测试环境不可用，仅说明）：\n\n' +
        "// Summarizer\nconst s = await Summarizer.create({\n" +
        "  type: 'tl;dr',          // 'tl;dr'|'key-points'|'teaser'|'headline'\n" +
        "  format: 'markdown',     // 'markdown'|'plain-text'\n" +
        "  length: 'medium',       // 'short'|'medium'|'long'\n" +
        "  sharedContext: '...', monitor: (p: any) => {},\n" +
        "});\n" +
        "await s.summarize(text, { context: '...' });     // → string\n" +
        'for await (const chunk of s.summarizeStreaming(text)) { /* 流式输出 */ }\n\n' +
        "// Writer\nconst w = await Writer.create({ sharedContext: '...' });\n" +
        "await w.write(prompt, { context: '...' });\n\n" +
        "// Rewriter\nconst r = await Rewriter.create({\n" +
        "  sharedContext: '...', tone: 'more-formal',     // 'as-is'|'more-formal'|'more-casual'\n" +
        "  format, length,\n});\n" +
        "await r.rewrite(text, { context: '...' });\n\n" +
        '说明：Chrome 138+ 提供；本环境均 typeof undefined。' });
      this._addLog('warn', 'Summarizer / Writer / Rewriter 不可用（typeof undefined），已记录用法');
      return;
    }
    try {
      const availability = await Summarizer.availability();
      this.setState({ summarizerInfo:
        `Summarizer.availability() = ${JSON.stringify(availability)}\n\n` +
        'Summarizer.create 选项：type（tl;dr/key-points/teaser/headline）、\n' +
        '  format（markdown/plain-text）、length（short/medium/long）、\n' +
        '  sharedContext、monitor。\n\n点击「摘要样例」执行摘要（含流式输出）。' });
      this._addLog('sum', `Summarizer.availability() = ${availability}`);
    } catch (err: any) {
      this._addLog('warn', `Summarizer.availability 失败：${err.name} - ${err.message}`);
    }
  }

  // 摘要样例段落（含流式输出）
  async _summarizeSample() {
    const caps = this._caps();
    if (!caps.summarizer) {
      this._addLog('warn', 'Summarizer 不可用，无法摘要');
      return;
    }
    try {
      if (this._summarizer && typeof this._summarizer.destroy === 'function') {
        try { this._summarizer.destroy(); } catch { /* noop */ }
      }
      this._addLog('info', '创建 Summarizer（type=tl;dr）…');
      const summarizer = await Summarizer.create({
        type: 'tl;dr', format: 'plain-text', length: 'short',
        monitor: (p: any) => { this._addLog('sum', `模型下载进度：${typeof p === 'number' ? Math.round(p * 100) + '%' : JSON.stringify(p)}`); },
      });
      this._summarizer = summarizer;
      const sample = 'Built-in AI APIs run machine learning models directly on the user device, without sending data to a cloud server. This preserves privacy, reduces latency, and works offline. Chrome 138+ ships Translator, LanguageDetector, Summarizer, Writer, Rewriter, and LanguageModel behind flags, with model downloads on first use.';
      this._addLog('sum', '开始流式摘要…');
      let streamed = '';
      let chunkCount = 0;
      // summarizeStreaming 返回 AsyncIterable<string>
      for await (const chunk of (await summarizer.summarizeStreaming(sample) as any)) {
        streamed += chunk;
        chunkCount += 1;
      }
      const full = await summarizer.summarize(sample);
      this.setState({ summarizerInfo:
        `Summarizer.create({ type:'tl;dr', format:'plain-text', length:'short' }) → summarizer\n\n` +
        `原段落：${sample}\n\n` +
        `summarizeStreaming(text)（AsyncIterable<string>，流式）：\n` +
        `  共 ${chunkCount} 个 chunk，拼接结果：${streamed}\n\n` +
        `summarize(text)（一次性）：${full}\n\n` +
        `Writer.create({ sharedContext }) + writer.write(prompt, { context }) —— 生成式写作\n` +
        `Rewriter.create({ sharedContext, tone, format, length }) + rewriter.rewrite(text, { context })\n` +
        `  tone: 'as-is' | 'more-formal' | 'more-casual'` });
      this._addLog('sum', `流式摘要 ${chunkCount} chunks；非流式：${full}`);
    } catch (err: any) {
      this._addLog('warn', `Summarizer 摘要失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. Summarizer 摘要 + Writer / Rewriter 写作',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.summarizer ? 'success' : 'error' }, caps.summarizer ? 'Summarizer ✓' : 'Summarizer ✗'),
        h(Tag, { color: caps.writer ? 'success' : 'error' }, caps.writer ? 'Writer ✓' : 'Writer ✗'),
        h(Tag, { color: caps.rewriter ? 'success' : 'error' }, caps.rewriter ? 'Rewriter ✓' : 'Rewriter ✗'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Summarizer.create({ type, format, length, sharedContext, monitor }) 创建摘要器，type 可为 tl;dr / key-points / teaser / headline，format 为 markdown / plain-text，length 为 short / medium / long。summarizer.summarize(text, { context }) 一次性返回 Promise<string>；summarizer.summarizeStreaming(text) 返回 AsyncIterable<string>，可流式拼接。Writer.create({ sharedContext }) + writer.write(text, { context }) 做生成式写作；Rewriter.create({ sharedContext, tone, format, length }) + rewriter.rewrite(text, { context }) 改写文本，tone 可为 as-is / more-formal / more-casual。Chrome 138+。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测 Summarizer', { type: 'primary', size: 'sm', disabled: !caps.summarizer, onClick: () => this._checkSummarizer() }),
          this._btn('摘要样例（流式）', { size: 'sm', disabled: !caps.summarizer, onClick: () => this._summarizeSample() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Summarizer / Writer / Rewriter 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.summarizerInfo || '（点击「检测 Summarizer」或「摘要样例」）')),
        h(Alert, {
          type: 'info',
          message: 'summarizeStreaming 是 AsyncIterable，可用 for await 消费',
          description: '与 summarize 一次性返回完整字符串不同，summarizeStreaming 返回 AsyncIterable<string>，每 yield 一个增量 chunk，适合做打字机式 UI。Writer 用于从 prompt 生成新文本，Rewriter 在保留原意基础上按 tone/format/length 改写。三者均通过 sharedContext 注入全局上下文，通过单次调用的 context 注入局部上下文。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：Prompt API（LanguageModel）===================

  // 检测 LanguageModel.availability 与 params
  async _checkPrompt() {
    const caps = this._caps();
    if (!caps.languageModel) {
      this.setState({ promptInfo:
        'Prompt API（LanguageModel）用法（测试环境不可用，仅说明）：\n\n' +
        '// 部分浏览器暴露在 window.ai 上\n' +
        'const status = await LanguageModel.availability();\n' +
        'const params = await (LanguageModel as any).params();\n' +
        '// params = { defaultTemperature, defaultTopK, maxTemperature, maxTopK }\n\n' +
        'const model = await LanguageModel.create({\n' +
        '  systemPrompt: "你是一个翻译助手",\n' +
        '  initialTemp: 0.7, topK: 40, monitor: (p: any) => {},\n' +
        "});\nconst reply = await model.prompt('Translate: hello');\n" +
        "// 流式：model.promptStreaming(text) → ReadableStream\n" +
        "const tokens = await model.countPromptTokens('hello world');\n" +
        'model.destroy();\n\n' +
        '说明：Chrome 138+ 提供；本环境 typeof LanguageModel === "undefined"。' });
      this._addLog('warn', 'LanguageModel 不可用（typeof undefined），已记录用法');
      return;
    }
    try {
      const availability = await LanguageModel.availability();
      let paramsLine = '';
      try {
        const params = await (LanguageModel as any).params();
        paramsLine = `\n(LanguageModel as any).params() = ${JSON.stringify(params)}\n` +
          '  含 defaultTemperature / defaultTopK / maxTemperature / maxTopK';
      } catch (e: any) {
        paramsLine = `\n(LanguageModel as any).params() 失败：${e.name}`;
      }
      this.setState({ promptInfo:
        `LanguageModel.availability() = ${JSON.stringify(availability)}${paramsLine}\n\n` +
        '点击「统计 token 数」对样例 prompt 调用 countPromptTokens。' });
      this._addLog('prompt', `LanguageModel.availability() = ${availability}`);
    } catch (err: any) {
      this._addLog('warn', `LanguageModel.availability 失败：${err.name} - ${err.message}`);
    }
  }

  // 统计样例 prompt 的 token 数
  async _countTokens() {
    const caps = this._caps();
    if (!caps.languageModel) {
      this._addLog('warn', 'LanguageModel 不可用，无法统计 token');
      return;
    }
    try {
      const sample = '请把下面这段话翻译成中文：The quick brown fox jumps over the lazy dog.';
      const tokens = await (LanguageModel as any).countPromptTokens(sample);
      this.setState({ promptInfo:
        (this.state.promptInfo || '') + '\n\n' +
        `countPromptTokens 样例：\n` +
        `  prompt = ${JSON.stringify(sample)}\n` +
        `  countPromptTokens(prompt) = ${tokens}（token 数）\n\n` +
        `说明：countPromptTokens 用于在发送前预估 token 占用，避免超出上下文窗口。\n` +
        `  prompt(text) 一次性返回；promptStreaming(text) 返回 ReadableStream 流式输出。` });
      this._addLog('prompt', `countPromptTokens = ${tokens}`);
    } catch (err: any) {
      this._addLog('warn', `countPromptTokens 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. Prompt API（LanguageModel）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.languageModel ? 'success' : 'error' }, caps.languageModel ? 'LanguageModel ✓' : '不可用'),
        h(Tag, { color: 'primary' }, '通用会话'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'LanguageModel（部分浏览器暴露在 window.ai 上）是通用提示词 API。LanguageModel.create({ systemPrompt, initialTemp, topK, monitor }) 返回 Promise<LanguageModel>。实例方法：model.prompt(text) 一次性返回 Promise<string>；model.promptStreaming(text) 返回 ReadableStream 流式输出；model.countPromptTokens(text) 返回 Promise<number> 预估 token；model.destroy() 释放。静态：LanguageModel.availability()、(LanguageModel as any).params() 返回 { defaultTemperature, defaultTopK, maxTemperature, maxTopK }。Chrome 138+。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测 availability/params', { type: 'primary', size: 'sm', disabled: !caps.languageModel, onClick: () => this._checkPrompt() }),
          this._btn('统计 token 数', { size: 'sm', disabled: !caps.languageModel, onClick: () => this._countTokens() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'LanguageModel 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, s.promptInfo || '（点击「检测 availability/params」或「统计 token 数」）')),
        h(Alert, {
          type: 'info',
          message: 'LanguageModel 是最通用的内置 AI 入口',
          description: '与 Translator/Summarizer 等专用 API 不同，LanguageModel 通过 systemPrompt 自定义任务（翻译、摘要、问答等均可）。initialTemp 控制随机性（0~maxTemperature），topK 控制候选词范围。countPromptTokens 用于在发送前预估 token 占用，避免超出上下文窗口。promptStreaming 返回 ReadableStream 而非 AsyncIterable，需用 reader.read() 消费。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：AI 可用性检测与会话管理 ===================

  // 汇总所有 AI API 的 availability（并行）
  async _aggregateAvailability() {
    const caps = this._caps();
    const check = async (name: any, ctor: any) => {
      if (!ctor) return `${name}: typeof undefined`;
      try {
        const a = await ctor.availability();
        return `${name}: ${a}`;
      } catch (e: any) {
        return `${name}: 调用失败 ${e.name}`;
      }
    };
    this._addLog('info', '汇总各内置 AI availability…');
    const lines = await Promise.all([
      check('Translator', caps.translator ? Translator : null),
      check('LanguageDetector', caps.languageDetector ? LanguageDetector : null),
      check('Summarizer', caps.summarizer ? Summarizer : null),
      check('Writer', caps.writer ? Writer : null),
      check('Rewriter', caps.rewriter ? Rewriter : null),
      check('LanguageModel', caps.languageModel ? LanguageModel : null),
    ]);
    let aiMgrLine = '';
    if (caps.navigatorAi) {
      try {
        const canCreate = typeof navigator.ai.canCreateGenericSession === 'function'
          ? await navigator.ai.canCreateGenericSession()
          : '（无 canCreateGenericSession）';
        aiMgrLine = `\nnavigator.ai.canCreateGenericSession() = ${canCreate}`;
      } catch (e: any) {
        aiMgrLine = `\nnavigator.ai 调用失败：${e.name}`;
      }
    } else if (caps.windowAi) {
      aiMgrLine = '\nwindow.ai 存在（旧版入口），navigator.ai 不可用';
    } else {
      aiMgrLine = '\nnavigator.ai / window.ai 均不可用（typeof undefined）';
    }
    const gpuLine = `navigator.gpu (WebGPU) = ${caps.navigatorGpu ? '可用' : '不可用'}；navigator.ml (WebNN) = ${caps.navigatorMl ? '可用' : '不可用'}`;
    this.setState({ availabilityInfo:
      '===== 内置 AI availability 汇总 =====\n\n' +
      lines.join('\n') + aiMgrLine + '\n' + gpuLine + '\n\n' +
      '门控说明：\n' +
      '  1. 必须在 HTTPS（或 localhost）环境\n' +
      '  2. 用户需在 chrome://flags 或浏览器设置中开启对应 AI API\n' +
      '  3. 首次使用会触发模型下载（monitor 回调上报进度）\n' +
      '  4. Availability：available / downloadable / downloading / available-after-download / unavailable\n\n' +
      'navigator.gpu（WebGPU，图形/通用计算）vs navigator.ml（WebNN，神经网络加速）的区别：\n' +
      '  WebGPU 走 GPU 着色器通用计算；WebNN 走系统 NNAPI / CoreML / DirectML / NPU 专用加速。' });
    this._addLog('avail', `汇总完成：${lines.filter((l: any) => !l.includes('undefined')).length} 项可用`);
  }

  // 说明会话管理（genericSession）
  _explainSession() {
    const caps = this._caps();
    let body = '';
    if (caps.navigatorAi) {
      body = 'navigator.ai 存在，提供通用会话管理：\n' +
        '  ai.canCreateGenericSession() → Promise<Availability>\n' +
        '  ai.genericSession.create({ monitor }) → Promise<GenericSession>\n' +
        '  会话与 LanguageModel 类似，但通过 navigator.ai 统一入口管理。\n\n';
    } else if (caps.windowAi) {
      body = 'window.ai 存在（旧版入口，部分早期 Chrome 使用）：\n' +
        '  window.ai.languageModel.create(...) 等子属性挂在 window.ai 下。\n\n';
    } else {
      body = 'navigator.ai / window.ai 均不可用（typeof undefined）。\n\n';
    }
    this.setState({ availabilityInfo:
      body +
      '会话管理最佳实践：\n' +
      '  - 创建的 Translator / Summarizer / LanguageModel 等会话需在不用时调用 destroy() 释放\n' +
      '  - 本页 componentWillUnmount 已统一释放所有会话\n' +
      '  - 流式输出（summarizeStreaming / promptStreaming）中途 destroy 会中断流\n\n' +
      '门控要点：HTTPS + 用户开启 flag + 模型下载；Availability 为 unavailable 时该 API 永不可用。' });
    this._addLog('avail', '已展示会话管理与门控说明');
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. AI 可用性检测与会话管理',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.navigatorAi || caps.windowAi ? 'success' : 'error' }, caps.navigatorAi || caps.windowAi ? 'navigator.ai ✓' : 'navigator.ai ✗'),
        h(Tag, { color: caps.navigatorMl ? 'success' : 'error' }, caps.navigatorMl ? 'navigator.ml ✓' : 'navigator.ml ✗'),
        h(Tag, { color: caps.navigatorGpu ? 'success' : 'error' }, caps.navigatorGpu ? 'gpu ✓' : 'gpu ✗'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'navigator.ai（部分浏览器为 window.ai）是内置 AI 的统一入口，提供 canCreateGenericSession() 与 genericSession.create() 等会话管理。内置 AI 受多重门控：必须 HTTPS（或 localhost）、用户在 chrome://flags 或设置中开启对应 API、首次使用触发模型下载。Availability 枚举：available / downloadable / downloading / available-after-download / unavailable。navigator.gpu（WebGPU，通用计算）与 navigator.ml（WebNN，神经网络专用加速）是两套不同的底层加速通道。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('汇总 availability', { type: 'primary', size: 'sm', onClick: () => this._aggregateAvailability() }),
          this._btn('会话管理说明', { size: 'sm', onClick: () => this._explainSession() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '可用性 / 会话管理：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.availabilityInfo || '（点击「汇总 availability」或「会话管理说明」）')),
        h(Alert, {
          type: 'warning',
          message: '内置 AI 受 HTTPS + flag + 模型下载三重门控',
          description: '即使浏览器版本支持，也需在安全上下文（HTTPS/localhost）中、用户主动开启对应 flag、并完成首次模型下载后才可用。生产环境应始终先 await XXX.availability() 判断状态，unavailable 时回退到云端方案。会话（Translator/Summarizer/LanguageModel 等）用完务必 destroy() 释放资源。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：WebNN（Neural Network）API ===================

  // 检测 navigator.ml 并尝试构建简单图（矩阵加法）
  async _detectWebNN() {
    const caps = this._caps();
    if (!caps.navigatorMl) {
      this.setState({ webnnInfo:
        'WebNN（Neural Network）API 用法（测试环境不可用，仅说明）：\n\n' +
        "// 创建上下文（指定设备类型）\n" +
        "const ctx = await navigator.ml.createContext({ deviceType: 'cpu' }); // 'cpu'|'gpu'|'npu'\n\n" +
        '// 构建计算图\n' +
        'const builder = new MLGraphBuilder(ctx);\n' +
        "const A = builder.input('A', { type: 'float32', dimensions: [2,2] });\n" +
        "const B = builder.input('B', { type: 'float32', dimensions: [2,2] });\n" +
        "const C = builder.add(A, B);   // 元素加\n" +
        'const graph = await builder.build({ C });   // → MLGraph\n\n' +
        '// 执行计算\n' +
        'const outputs = await ctx.compute(graph, {\n' +
        '  A: new Float32Array([1,2,3,4]), B: new Float32Array([10,20,30,40]),\n' +
        '});\n// outputs.C = Float32Array([11,22,33,44])\n\n' +
        'MLGraphBuilder 算子：add/sub/mul/div、matmul、conv2d、relu、softmax、\n' +
        '  reshape、transpose、gemm、batchNormalization、pooling 等。\n\n' +
        'NPU（Neural Processing Unit）加速：deviceType:"npu" 使用设备专用 AI 加速器，\n' +
        '  能效比远高于 CPU/GPU，适合推理密集场景。\n\n' +
        '说明：Chrome 138+ 提供 navigator.ml，部分平台仅 Origin Trial；\n' +
        '  本环境 typeof navigator.ml === "undefined"。' });
      this._addLog('warn', 'navigator.ml（WebNN）不可用（typeof undefined），已记录用法');
      return;
    }
    try {
      const ctx = await navigator.ml.createContext({ deviceType: 'cpu' });
      this._mlContext = ctx;
      const builder = new MLGraphBuilder(ctx);
      const A = builder.input('A', { type: 'float32', dimensions: [2, 2] });
      const B = builder.input('B', { type: 'float32', dimensions: [2, 2] });
      const C = builder.add(A, B);
      const graph = await builder.build({ C });
      const outputs = await ctx.compute(graph, {
        A: new Float32Array([1, 2, 3, 4]),
        B: new Float32Array([10, 20, 30, 40]),
      });
      const out = Array.from(outputs.C);
      this.setState({ webnnInfo:
        `navigator.ml.createContext({ deviceType:'cpu' }) → MLContext\n` +
        `new MLGraphBuilder(ctx) → builder\n` +
        `  builder.input('A', { type:'float32', dimensions:[2,2] })\n` +
        `  builder.input('B', { type:'float32', dimensions:[2,2] })\n` +
        `  builder.add(A, B) → C（元素加）\n` +
        `builder.build({ C }) → MLGraph\n\n` +
        `ctx.compute(graph, { A:[1,2,3,4], B:[10,20,30,40] }) → outputs\n` +
        `  outputs.C = [${out.join(', ')}]（=[11,22,33,44]）\n\n` +
        `MLGraphBuilder 算子：add/sub/mul/div、matmul、conv2d、relu、softmax、\n` +
        `  reshape、transpose、gemm、batchNormalization、pooling。\n\n` +
        `NPU（Neural Processing Unit）加速：deviceType:"npu" 调用设备专用 AI\n` +
        `  加速器，能效比远高于 CPU/GPU，适合推理密集场景。` });
      this._addLog('webnn', `WebNN 矩阵加法计算完成：[${out.join(', ')}]`);
    } catch (err: any) {
      this._addLog('warn', `WebNN 演示失败：${err.name} - ${err.message}`);
    }
  }

  // 列出 WebNN 算子清单与 NPU 说明
  _listWebNNOps() {
    this.setState({ webnnInfo:
      '===== WebNN MLGraphBuilder 算子清单 =====\n\n' +
      '【逐元素运算】add / sub / mul / div\n' +
      '【矩阵/张量运算】matmul / gemm / reshape / transpose / split / concat / squeeze / unsqueeze\n' +
      '【卷积】conv2d / convTranspose2d\n【激活】relu / sigmoid / tanh / softmax / elu / leakyRelu\n' +
      '【归一化】batchNormalization / layerNormalization\n' +
      '【池化】pooling（max/average/l2）/ reduceMean / reduceMax / reduceSum\n' +
      '【其他】clamp / cast / slice / pad / where / gather\n\n' +
      '===== createContext 选项 =====\n' +
      "  navigator.ml.createContext({ deviceType: 'cpu' | 'gpu' | 'npu' })\n" +
      '  不同设备类型对应不同后端：CPU（通用）/ GPU（图形处理器）/ NPU（神经网络专用）\n\n' +
      '===== NPU（Neural Processing Unit）加速 =====\n' +
      '  NPU 是设备内置的神经网络专用加速器（如手机 SoC 中的 AI 单元），相比 CPU/GPU\n' +
      '  在推理密集任务上能效比高出数倍，适合长时间运行的 AI 任务。\n' +
      '  deviceType:"npu" 让 WebNN 优先使用 NPU，不可用时回退到 GPU/CPU。\n\n' +
      '===== navigator.gpu vs navigator.ml =====\n' +
      '  navigator.gpu（WebGPU）：通用 GPU 计算（WGSL 着色器），可写任意并行算法\n' +
      '  navigator.ml（WebNN）：神经网络专用，算子级 API，底层走 NNAPI/CoreML/DirectML' });
    this._addLog('webnn', '已列出 WebNN 算子清单与 NPU 说明');
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. WebNN（Neural Network）API',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.navigatorMl ? 'success' : 'error' }, caps.navigatorMl ? 'navigator.ml ✓' : 'navigator.ml ✗'),
        h(Tag, { color: 'primary' }, 'CPU/GPU/NPU'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'navigator.ml（WebNN）提供神经网络专用加速。navigator.ml.createContext({ deviceType: "cpu"|"gpu"|"npu" }) 创建 MLContext；new MLGraphBuilder(context) 构建计算图，用 builder.input(name, { type, dimensions }) / builder.constant(desc, data) 定义输入与常量，用 builder.add/sub/mul/div/matmul/conv2d/relu/softmax/reshape/transpose/gemm/batchNormalization/pooling 等算子组合；builder.build(outputOperand) 编译为 MLGraph；ctx.compute(graph, inputs) 执行得到 outputs。NPU（Neural Processing Unit）是设备内置的神经网络专用加速器，能效比远高于 CPU/GPU。Chrome 138+ 提供，部分平台仅 Origin Trial。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测并构建图', { type: 'primary', size: 'sm', disabled: !caps.navigatorMl, onClick: () => this._detectWebNN() }),
          this._btn('算子与 NPU 说明', { size: 'sm', onClick: () => this._listWebNNOps() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'WebNN 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, s.webnnInfo || '（点击「检测并构建图」或「算子与 NPU 说明」）')),
        h(Alert, {
          type: 'info',
          message: 'WebNN 是算子级神经网络 API，区别于 WebGPU 的通用计算',
          description: 'WebNN 提供标准神经网络算子（conv2d/matmul/relu 等），底层由系统 NNAPI（Android）/ CoreML（macOS/iOS）/ DirectML（Windows）等驱动，可直接调度到 NPU。相比 WebGPU 需要手写 WGSL 着色器，WebNN 算子级 API 更贴近 ML 框架语义，部署成本更低。内置 AI API（Translator/Summarizer 等）在某些后端即通过 WebNN 加速。',
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
        : s.logs.map((log: any) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  // =================== 整页渲染 ===================

  render() {
    const s = this.state;
    return h('div', { class: 'api-lab-page builtin-ai-page' },
      h('h2', { class: 'section-title' }, '内置 AI 与 WebNN 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页演示浏览器内置 AI API（Translator / LanguageDetector / Summarizer / Writer / Rewriter / LanguageModel）与 WebNN（navigator.ml）神经网络加速。这些能力为 Chrome 138+ 新特性，需 HTTPS + chrome://flags 开启 + 模型下载；jsdom 环境不可用，所有按钮点击将仅记日志说明用法与支持状态。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null as any,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderCard6(),
      this._renderLogPanel(),
    );
  }
}
