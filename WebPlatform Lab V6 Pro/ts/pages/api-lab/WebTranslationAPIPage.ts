// =====================================================================
// WebTranslationAPIPage.js —— Translation + Language Detector API 完整实验室
// 演示 Chrome 130+ origin trial 的浏览器内置翻译与语言识别能力：
//   1. 概述与动机 —— 浏览器内置翻译与语言识别需求 / Translation API +
//      Language Detector API 标准 / vs Google Translate API（云）/ Built-in
//      AI 关系（WebNN 之下的应用封装层）/ 浏览器支持 Chrome 130+ origin trial
//   2. Translator 入口 —— Translator.create({ sourceLanguage,
//      targetLanguage }) / translator.translate(text) → Promise<string> /
//      translator.translate(source, signal) / 浏览器本地小模型推理 /
//      同步翻译 + 流式翻译
//   3. Language Detector 入口 —— LanguageDetector.create() /
//      detector.detect(text) → Promise<[{detectedLanguage, confidence}]> /
//      多候选结果 / 置信度排序 / 短文本识别挑战
//   4. 可用性检测与可用性 —— (Translator as any).availability({ sourceLanguage,
//      targetLanguage }) → 'available'/'downloadable'/'downloading'/
//      'after-download' / LanguageDetector.availability() / 模型下载状态
//      管理 / 首次使用提示
//   5. 支持语言列表与配对 —— Translator.languagePairAvailable(
//      sourceLanguage, targetLanguage) / 支持语言全集（约 50+ 种）/ 配对
//      矩阵 / 语言代码 BCP-47 / 中文 zh-Hans/zh-Hant 区分
//   6. 实战：实时翻译输入框 —— input 事件 → debounce →
//      LanguageDetector.detect → Translator.translate → 显示翻译结果 /
//      与 Web Speech API 协同（语音输入翻译）/ 离线场景
//   7. 实战：批量文档翻译与语言路由 —— 长文本分段 / 进度监控 /
//      AbortSignal 中止 / 翻译质量评估 / 与 WebNN 硬件加速协同
//   8. 陷阱与最佳实践 —— 模型体积与下载时机 / 隐私敏感文本（不应翻译）/
//      与云翻译 API 取舍（本地隐私 vs 云质量）/ 多语言混合文本 /
//      浏览器支持矩阵 / 降级到 Google Translate widget
// 说明：所有特性调用前做 typeof 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。jsdom 无 Translator/
//       LanguageDetector（Chrome 130+ 实验 API），统一兜底。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { State } from '../../core/types.js';

interface WebTranslationAPIPageState extends State {
  logs: any;
  capsSummary: any;
  overviewInfo: any;
  translatorInfo: any;
  detectorInfo: any;
  availabilityInfo: any;
  languagesInfo: any;
  realtimeInfo: any;
  batchInfo: any;
  pitfallsInfo: any;
  detectResult: any;
  translateResult: any;
}

export class WebTranslationAPIPage extends Page {
  declare state: WebTranslationAPIPageState;
  _abortControllers!: any[];
  _debounceTimer!: any;
  _detectors!: any;
  _dynamicStyles!: any[];
  _inited!: boolean;
  _translators!: any;

  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      overviewInfo: '',        // Card 1：概述与动机
      translatorInfo: '',      // Card 2：Translator 入口
      detectorInfo: '',        // Card 3：Language Detector 入口
      availabilityInfo: '',    // Card 4：可用性检测
      languagesInfo: '',       // Card 5：支持语言列表与配对
      realtimeInfo: '',        // Card 6：实时翻译输入框
      batchInfo: '',           // Card 7：批量文档翻译与语言路由
      pitfallsInfo: '',        // Card 8：陷阱与最佳实践
      detectResult: '',        // Card 3 本地语言探测结果
      translateResult: '',     // Card 2 本地翻译结果
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    this._dynamicStyles = [];
    this._translators = [];      // 创建过的 Translator 实例（销毁时 destroy）
    this._detectors = [];        // 创建过的 LanguageDetector 实例
    this._abortControllers = []; // 翻译中止信号
    this._debounceTimer = null;  // 实时翻译 debounce 定时器

    const f = this._flags();
    const c = (ok: boolean) => ok ? '✓' : '✗';
    const parts = [
      `Translator ${c(f.translator)}`,
      `Translator.create ${c(f.translatorCreate)}`,
      `(Translator as any).availability ${c(f.translatorAvailability)}`,
      `LanguageDetector ${c(f.languageDetector)}`,
      `LanguageDetector.create ${c(f.detectorCreate)}`,
      `LanguageDetector.availability ${c(f.detectorAvailability)}`,
      `languagePairAvailable ${c(f.languagePairAvailable)}`,
    ];

    const any = f.translator || f.languageDetector;
    const summary = any
      ? `Translation + Language Detector API 能力检测：${parts.join(' · ')}。当前环境支持部分内置 AI 翻译能力，可真实体验本地模型推理；首次使用可能触发模型下载（数十 MB），需用户授权。`
      : `Translation + Language Detector API 能力检测：${parts.join(' · ')}。jsdom/Node 环境无 Translator/LanguageDetector（Chrome 130+ origin trial 实验 API），所有按钮点击仅记日志说明，绝不抛异常；真实 Chrome（开启 origin trial）可完整体验本地翻译。`;

    this.setState({ capsSummary: summary });
    this._addLog(any ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.translator) this._addLog('warn', 'Translator 不可用（Chrome 130+ origin trial，jsdom/Node/Firefox/Safari 均无）');
    if (!f.languageDetector) this._addLog('warn', 'LanguageDetector 不可用（Chrome 130+ origin trial，与 Translator 同期推出）');
    if (!f.translatorAvailability) this._addLog('warn', '(Translator as any).availability 不可用，无法探测模型下载状态');
    if (!f.languagePairAvailable) this._addLog('warn', 'Translator.languagePairAvailable 不可用，无法查询语言配对');

    this._injectBaseStyles();
  }

  componentWillUnmount() {
    // 销毁创建过的 Translator / LanguageDetector（释放模型内存）
    for (const t of this._translators) {
      try { t.destroy?.(); } catch { /* noop */ }
    }
    this._translators = [];
    for (const d of this._detectors) {
      try { d.destroy?.(); } catch { /* noop */ }
    }
    this._detectors = [];
    // 中止所有进行中的翻译
    for (const ac of this._abortControllers) {
      try { ac.abort(); } catch { /* noop */ }
    }
    this._abortControllers = [];
    // 清理 debounce 定时器
    try { clearTimeout(this._debounceTimer); } catch { /* noop */ }
    // 移除动态注入的样式
    for (const style of this._dynamicStyles) {
      try { style.parentNode && style.parentNode.removeChild(style); } catch { /* noop */ }
    }
    this._dynamicStyles = [];
  }

  // —— 辅助方法 ——

  _addLog(type: any, content: any){
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label: any, opts: any){
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  _caps(items: any) {
    return items.map(([label, ok]: any) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  _injectStyle(id: any, css: any){
    const existing = (document.getElementById(id) as any);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
    this._dynamicStyles.push(style);
  }

  // 返回布尔能力对象（供 capsSummary / 按钮 disabled 使用）
  _flags() {
    const safe = (fn: any) => {
      try { return fn(); } catch { return false; }
    };
    return {
      translator: safe(() => 'Translator' in window && typeof window.Translator === 'function'),
      translatorCreate: safe(() => typeof window.Translator?.create === 'function'),
      translatorAvailability: safe(() => typeof window.Translator?.availability === 'function'),
      languageDetector: safe(() => 'LanguageDetector' in window && typeof window.LanguageDetector === 'function'),
      detectorCreate: safe(() => typeof window.LanguageDetector?.create === 'function'),
      detectorAvailability: safe(() => typeof window.LanguageDetector?.availability === 'function'),
      languagePairAvailable: safe(() => typeof window.Translator?.languagePairAvailable === 'function'),
    };
  }

  _injectBaseStyles() {
    this._injectStyle('wt-base', `
      .wt-demo {
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
      }
      .wt-stage {
        margin-top: 10px;
        padding: 12px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
      }
      .wt-input {
        width: 100%;
        padding: 8px;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        font-size: 13px;
        min-height: 60px;
        box-sizing: border-box;
        resize: vertical;
        font-family: inherit;
      }
      .wt-result {
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
      .wt-result--success { background: #064e3b; color: #d1fae5; }
      .wt-result--warn { background: #78350f; color: #fef3c7; }
      .wt-matrix {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 8px;
        margin-top: 10px;
      }
      .wt-matrix-cell {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 8px;
        font-size: 12px;
      }
      .wt-matrix-title { font-weight: 600; color: #1e293b; margin-bottom: 4px; }
      .wt-flow {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 8px;
        font-size: 12px;
      }
      .wt-flow-node {
        padding: 4px 8px;
        border-radius: 6px;
        background: #e0e7ff;
        color: #1e40af;
        font-weight: 600;
      }
      .wt-flow-node--ai { background: #ede9fe; color: #4c1d95; }
      .wt-flow-arrow { color: #64748b; }
      .wt-bar-wrap {
        background: #1e293b;
        border-radius: 4px;
        height: 14px;
        overflow: hidden;
        margin-top: 6px;
      }
      .wt-bar {
        height: 100%;
        background: linear-gradient(90deg, #22c55e, #3b82f6);
        transition: width 0.2s ease;
      }
    `);
  }

  // ===================== Card 1：概述与动机 =====================

  _runOverviewDemo() {
    const f = this._flags();
    this._injectStyle('wt-overview-demo', `
      .wt-overview-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    const info = [
      '===== Translation + Language Detector API 概述与动机 =====',
      '',
      '【浏览器内置翻译与语言识别需求】',
      '  - 跨语言阅读：用户母语非英语，需把英文文档/评论/邮件翻译成母语',
      '  - 隐私敏感：医疗/法律/财务文档不应上传到云翻译（如 Google Translate API）',
      '  - 离线场景：飞行模式、弱网环境仍需翻译能力',
      '  - 实时输入翻译：聊天/输入框边输入边翻译（需低延迟）',
      '  - 多语言混合文本：自动检测每段语言再路由到对应翻译',
      '',
      '【Translation API 标准】',
      '  W3C Web Machine Learning Working Group 提案',
      '  https://github.com/WICG/translation-api',
      '  核心：Translator.create({ sourceLanguage, targetLanguage }) → Translator',
      '        translator.translate(text) → Promise<string>',
      '  特点：',
      '  - 浏览器内置小模型（通常基于 WebNN 硬件加速）',
      '  - 完全本地推理，数据不离开设备',
      '  - 首次使用触发模型下载（数十 MB）',
      '  - 支持流式翻译（source signal 控制流式输入）',
      '',
      '【Language Detector API 标准】',
      '  W3C 提案，与 Translation API 同期',
      '  https://github.com/WICG/translation-api',
      '  核心：LanguageDetector.create() → LanguageDetector',
      '        detector.detect(text) → Promise<[{detectedLanguage, confidence}]>',
      '  特点：',
      '  - 多候选结果（按置信度排序）',
      '  - 短文本识别挑战（< 20 字符准确率下降）',
      '  - 与 Translator 协同：先检测语言再翻译（语言路由）',
      '',
      '【vs Google Translate API（云）】',
      '  维度              Translation API        Google Translate API',
      '  --------------------------------------------------------------------',
      '  运行位置          浏览器本地              云端（Google 服务器）',
      '  隐私              ✓ 数据不离开设备        ✗ 上传到 Google',
      '  离线              ✓ 模型下载后可用        ✗ 必须联网',
      '  翻译质量          △ 小模型，质量略低      ✓ 大模型，质量更高',
      '  延迟              △ 首次下载耗时          ✓ 即时响应',
      '  成本              ✓ 免费（浏览器内置）    ✗ 按字符收费',
      '  支持语言          △ ~50+ 种（持续扩展）   ✓ 100+ 种',
      '  API 兼容          ✗ Chrome 130+ origin    ✓ 全平台 REST',
      '',
      '【与 Built-in AI 的关系（WebNN 应用封装层）】',
      '  WebNN（Web Neural Network API）：底层硬件加速（GPU/NPU/DSP）',
      '    navigator.ml.createContext() / nnBuilder',
      '    直接操作张量、构建计算图',
      '',
      '  Translation API / Language Detector API：',
      '    基于内置模型的上层 API',
      '    底层可能调用 WebNN 加速（透明）',
      '    开发者无需了解模型结构、推理流程',
      '    类似 InnerModel API（Chrome 127+ 内置 Gemini Nano）',
      '',
      '  层次：',
      '    Translation API / Language Detector API  ← 应用层封装',
      '    Prompt API / Writer API / Summarizer API ← 通用大模型 API',
      '    InnerModel API                            ← 直接访问内置模型',
      '    WebNN                                     ← 硬件加速层',
      '',
      '【浏览器支持】',
      '  Chrome 130+ origin trial（需注册 token）',
      '  Edge 跟随 Chromium',
      '  Firefox：未实现（截至 2025）',
      '  Safari：未实现（截至 2025）',
      '  Node.js / jsdom：无（本页所有检测为 false）',
      '',
      '  启用方式：',
      '  1. 注册 origin trial：https://developers.chrome.com/origin-trials/',
      '  2. 在 HTML head 注入 meta：<meta http-equiv="origin-trial" content="TOKEN">',
      '  3. 或在 chrome://flags 开启 Experimental Web Platform Features',
      '',
      '【能力检测代码】',
      "  // 一次性检测本页涉及的全部底层 API",
      "  const hasTranslator = 'Translator' in window && typeof Translator === 'function';",
      "  const hasTranslatorCreate = typeof Translator?.create === 'function';",
      "  const hasTranslatorAvailability = typeof Translator?.availability === 'function';",
      "  const hasLanguageDetector = 'LanguageDetector' in window && typeof LanguageDetector === 'function';",
      "  const hasDetectorCreate = typeof LanguageDetector?.create === 'function';",
      "  const hasDetectorAvailability = typeof LanguageDetector?.availability === 'function';",
      "  const hasLanguagePairAvailable = typeof Translator?.languagePairAvailable === 'function';",
      '',
      '【实际能力检测演示】',
      `  Translator: ${f.translator ? '✓' : '✗'}`,
      `  Translator.create: ${f.translatorCreate ? '✓' : '✗'}`,
      `  (Translator as any).availability: ${f.translatorAvailability ? '✓' : '✗'}`,
      `  LanguageDetector: ${f.languageDetector ? '✓' : '✗'}`,
      `  LanguageDetector.create: ${f.detectorCreate ? '✓' : '✗'}`,
      `  LanguageDetector.availability: ${f.detectorAvailability ? '✓' : '✗'}`,
      `  languagePairAvailable: ${f.languagePairAvailable ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. 首次使用触发模型下载（数十 MB），需用户授权与等待 UI',
      '  2. 翻译质量低于云 API，复杂/专业内容仍需人工校对',
      '  3. 支持语言有限（~50+），冷门语言可能不支持',
      '  4. origin trial 过期后 API 失效，需重新注册',
      '  5. 隐私敏感文本（医疗/法律）应避免上传到云，但本地翻译无此问题',
    ].join('\n');
    this.setState({ overviewInfo: info });
    this._addLog('wt', `概述演示完成：Translator=${f.translator}，LanguageDetector=${f.languageDetector}`);
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. 概述与动机 —— 内置翻译需求 / Translation + Language Detector API / Chrome 130+',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['Translator', f.translator],
          ['LanguageDetector', f.languageDetector],
        ]),
        h(Tag, { color: 'primary' }, '概述'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '浏览器内置翻译需求：跨语言阅读、隐私敏感文档（医疗/法律/财务不应上传云）、离线场景、实时输入翻译、多语言混合文本路由。Translation API（Translator.create + translate）与 Language Detector API（LanguageDetector.create + detect）基于内置小模型，底层可能用 WebNN 硬件加速，是 Built-in AI 的应用封装层。vs Google Translate API：本地隐私 + 离线 + 免费，但质量略低、支持语言少。浏览器支持 Chrome 130+ origin trial，Firefox/Safari 未实现，jsdom 无。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行概述演示', { type: 'primary', size: 'sm', onClick: () => this._runOverviewDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// Translation API：本地翻译
const translator = await Translator.create({
  sourceLanguage: 'en',
  targetLanguage: 'zh-Hans',
});
const translated = await translator.translate('Hello, world!');
console.log(translated); // "你好，世界！"
translator.destroy(); // 释放模型内存

// Language Detector API：本地语言识别
const detector = await LanguageDetector.create();
const results = await detector.detect('Bonjour le monde');
console.log(results);
// [{ detectedLanguage: 'fr', confidence: 0.98 },
//  { detectedLanguage: 'en', confidence: 0.01 }]
detector.destroy();`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.overviewInfo || '（点击按钮查看 Translation + Language Detector API 概述完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 2：Translator 入口 =====================

  _runTranslatorDemo() {
    const f = this._flags();
    this._injectStyle('wt-translator-demo', `
      .wt-translator-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (!f.translatorCreate) {
      this._addLog('warn', 'Translator.create 不可用，本地翻译仅展示 API 用法（jsdom 无此 API）');
      this.setState({ translateResult: 'Translator 不可用（Chrome 130+ origin trial）' });
    } else {
      // 真实环境：创建 en → zh-Hans 翻译器（首次会触发模型下载）
      this._addLog('info', '检测到 Translator.create，将尝试真实翻译（首次可能下载模型）');
      try {
        const ac = new AbortController();
        this._abortControllers.push(ac);
        Translator.create({
          sourceLanguage: 'en',
          targetLanguage: 'zh-Hans',
          signal: ac.signal,
        }).then((translator: any) => {
          this._translators.push(translator);
          return translator.translate('Hello, world!', ac.signal);
        }).then((result: any) => {
          this.setState({ translateResult: `翻译成功：Hello, world! → ${result}` });
          this._addLog('info', `本地翻译成功（en → zh-Hans）：${result}`);
        }).catch((err: any) => {
          this.setState({ translateResult: `翻译失败：${err.name} - ${err.message}` });
          this._addLog('warn', `翻译失败：${err.name} - ${err.message}（可能是模型未下载或 origin trial 未启用）`);
        });
      } catch (err: any) {
        this._addLog('warn', `Translator.create 异常：${err && err.message}`);
      }
    }
    const info = [
      '===== Translator 入口：create / translate / signal =====',
      '',
      '【Translator.create 静态方法】',
      '  const translator = await Translator.create({',
      '    sourceLanguage: "en",       // BCP-47 语言代码',
      '    targetLanguage: "zh-Hans",  // 简体中文',
      '    signal: ac.signal,           // AbortSignal 中止创建',
      '  });',
      '',
      '  // create 是异步 Promise，resolve 后才能 translate',
      '  // 首次创建可能触发模型下载（数十 MB），需 await 等待',
      '',
      '【translator.translate(text) 同步翻译】',
      '  // translate 接收 string，返回 Promise<string>',
      '  const translated = await translator.translate("Hello, world!");',
      '  console.log(translated);  // "你好，世界！"',
      '',
      '  // 多次调用复用同一 Translator（性能好）',
      '  for (const text of sentences) {',
      '    const result = await translator.translate(text);',
      '    console.log(result);',
      '  }',
      '',
      '【translator.translate(source, signal) 流式翻译】',
      '  // source 是 ReadableStream，逐 chunk 输入文本',
      '  // signal 是 AbortSignal 中止',
      '  const source = new ReadableStream({',
      '    start(controller) {',
      '      controller.enqueue("Hello, ");',
      '      controller.enqueue("world!");',
      '      controller.close();',
      '    },',
      '  });',
      '  const result = await translator.translate(source, ac.signal);',
      '  console.log(result);  // "你好，世界！"',
      '',
      '  // 适合：实时语音输入翻译、流式文档读取',
      '',
      '【浏览器本地小模型推理】',
      '  - 内置模型通常是轻量 Transformer（如 Gemma 2B / T5-small 量化版）',
      '  - 模型大小：~30-100 MB（按语言对）',
      '  - 推理硬件：CPU / GPU（WebGPU）/ NPU（WebNN）',
      '  - 延迟：本地推理 100ms-1s（取决于硬件与文本长度）',
      '',
      '【同步翻译 vs 流式翻译】',
      '  同步翻译：translate(text)',
      '    - 一次性返回完整结果',
      '    - 适合：短文本、文档片段',
      '    - 优点：API 简单',
      '    - 缺点：长文本需等推理完成',
      '',
      '  流式翻译：translate(ReadableStream, signal)',
      '    - 边输入边输出（增量翻译）',
      '    - 适合：实时语音输入、聊天、长文档',
      '    - 优点：低延迟感知',
      '    - 缺点：API 复杂，需管理流',
      '',
      '【destroy() 释放模型内存】',
      '  // Translator 持有模型引用，必须 destroy 释放',
      '  translator.destroy();',
      '  // 否则内存泄漏（多次 create 会累积）',
      '',
      '【AbortSignal 中止】',
      '  const ac = new AbortController();',
      '  const translator = await Translator.create({ ..., signal: ac.signal });',
      '  // 中止创建（如模型下载过长）',
      '  ac.abort(new DOMException("用户取消", "AbortError"));',
      '',
      '  // 中止翻译',
      '  const ac2 = new AbortController();',
      '  translator.translate(text, ac2.signal).catch((err: any) => {',
      '    if (err.name === "AbortError") console.log("已中止");',
      '  });',
      '  ac2.abort();',
      '',
      '【完整的「检测语言 → 翻译」流程】',
      '  async function smartTranslate(text, targetLang = "zh-Hans") {',
      '    const detector = await LanguageDetector.create();',
      '    const [{ detectedLanguage }] = await detector.detect(text);',
      '    detector.destroy();',
      '    const translator = await Translator.create({',
      '      sourceLanguage: detectedLanguage,',
      '      targetLanguage: targetLang,',
      '    });',
      '    const result = await translator.translate(text);',
      '    translator.destroy();',
      '    return { detectedLanguage, result };',
      '  }',
      '',
      '【浏览器支持】',
      `  Translator.create: ${f.translatorCreate ? '✓' : '✗'}`,
      `  (Translator as any).availability: ${f.translatorAvailability ? '✓' : '✗'}`,
      '  Chrome 130+ origin trial',
      '',
      '【常见陷阱】',
      '  1. create 是异步，必须 await 才能 translate',
      '  2. 首次 create 触发模型下载（数十 MB），需 UI 提示与进度',
      '  3. translate 多次调用复用同一 Translator，避免重复 create',
      '  4. destroy 必须调用，否则模型内存泄漏',
      '  5. signal 中止后不能再调用 translate（需重新 create）',
    ].join('\n');
    this.setState({ translatorInfo: info });
    this._addLog('wt', `Translator 入口演示完成：create / translate / signal / destroy`);
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. Translator 入口 —— create / translate / signal / 流式翻译',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['Translator.create', f.translatorCreate],
          ['(Translator as any).availability', f.translatorAvailability],
        ]),
        h(Tag, { color: 'primary' }, 'Translator'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Translator.create({ sourceLanguage, targetLanguage, signal }) 异步创建（首次触发模型下载数十 MB），translate(text) 同步翻译返回 Promise<string>，translate(ReadableStream, signal) 流式翻译（边输入边输出）。复用同一 Translator 性能更好，destroy() 释放模型内存。AbortSignal 中止 create/translate。内置小模型（Gemma/T5 量化版）通过 WebNN/WebGPU 硬件加速，延迟 100ms-1s。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 Translator 演示', { type: 'primary', size: 'sm', onClick: () => this._runTranslatorDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 同步翻译
const translator = await Translator.create({
  sourceLanguage: 'en',
  targetLanguage: 'zh-Hans',
});
const result = await translator.translate('Hello, world!');
console.log(result); // "你好，世界！"

// 流式翻译：ReadableStream 逐 chunk 输入
const source = new ReadableStream({
  start(c: any) {
    c.enqueue('Hello, ');
    c.enqueue('world!');
    c.close();
  },
});
const streamed = await translator.translate(source, ac.signal);

// AbortSignal 中止
const ac = new AbortController();
translator.translate(longText, ac.signal).catch((err: any) => {
  if (err.name === 'AbortError') console.log('已中止');
});
setTimeout(() => ac.abort(), 1000);

// 用完释放模型内存
translator.destroy();`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('div', { class: `wt-result ${s.translateResult.startsWith('翻译成功') ? 'wt-result--success' : (s.translateResult ? 'wt-result--warn' : '')}` },
          s.translateResult || '（点击按钮尝试真实本地翻译 en → zh-Hans）'),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.translatorInfo || '（点击按钮查看 Translator 入口完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 3：Language Detector 入口 =====================

  _runDetectorDemo() {
    const f = this._flags();
    this._injectStyle('wt-detector-demo', `
      .wt-detector-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (!f.detectorCreate) {
      this._addLog('warn', 'LanguageDetector.create 不可用，本地语言检测仅展示 API 用法（jsdom 无此 API）');
      this.setState({ detectResult: 'LanguageDetector 不可用（Chrome 130+ origin trial）' });
    } else {
      // 真实环境：创建 detector 检测多语言样本
      this._addLog('info', '检测到 LanguageDetector.create，将尝试真实语言检测');
      try {
        const samples = ['Hello, world!', 'Bonjour le monde', '你好，世界', 'こんにちは世界'];
        LanguageDetector.create().then((detector: any) => {
          this._detectors.push(detector);
          return Promise.all(samples.map((s: any) => detector.detect(s)));
        }).then((results: any) => {
          const lines = results.map((r: any, i: number) =>
            `"${samples[i]}" → ${r.map((x: any) => `${x.detectedLanguage}(${(x.confidence * 100).toFixed(0)}%)`).join(', ')}`);
          this.setState({ detectResult: lines.join('\n') });
          this._addLog('info', `本地语言检测成功（4 个样本）`);
        }).catch((err: any) => {
          this.setState({ detectResult: `检测失败：${err.name} - ${err.message}` });
          this._addLog('warn', `语言检测失败：${err.name} - ${err.message}`);
        });
      } catch (err: any) {
        this._addLog('warn', `LanguageDetector.create 异常：${err && err.message}`);
      }
    }
    const info = [
      '===== Language Detector 入口：create / detect / 多候选 =====',
      '',
      '【LanguageDetector.create 静态方法】',
      '  const detector = await LanguageDetector.create();',
      '  // 无参数（模型单一，支持所有语言识别）',
      '  // create 是异步，resolve 后才能 detect',
      '',
      '【detector.detect(text) 返回多候选】',
      '  const results = await detector.detect("Bonjour le monde");',
      '  // results: [{ detectedLanguage, confidence }, ...]',
      '  console.log(results);',
      '  // [',
      '  //   { detectedLanguage: "fr", confidence: 0.98 },',
      '  //   { detectedLanguage: "en", confidence: 0.01 },',
      '  //   { detectedLanguage: "es", confidence: 0.005 },',
      '  // ]',
      '',
      '  // 按置信度降序排列，取第一个最可能的语言',
      '  const [{ detectedLanguage, confidence }] = results;',
      '  if (confidence < 0.5) console.warn("置信度过低，结果不可靠");',
      '',
      '【多候选结果的意义】',
      '  - 短文本可能多语言相似（如 " OK " 在英/德/荷/挪均可）',
      '  - 提供 top-N 候选让上层决策',
      '  - 上层可结合用户偏好（如用户母语）选择',
      '',
      '【置信度排序】',
      '  // results[0] 是置信度最高的候选',
      '  // confidence 范围 0-1，通常 > 0.7 才可靠',
      '  for (const r of results) {',
      '    console.log(`${r.detectedLanguage}: ${(r.confidence * 100).toFixed(1)}%`);',
      '  }',
      '',
      '【短文本识别挑战】',
      '  // < 20 字符的文本识别准确率显著下降',
      '  await detector.detect("OK");        // 多语言相同，置信度低',
      '  await detector.detect("Hi");        // 英/德/荷难以区分',
      '  await detector.detect("你好");     // 中文较易识别',
      '',
      '  // 最佳实践：',
      '  // 1. 累积足够文本（> 50 字符）再 detect',
      '  // 2. 多次 detect 取加权平均',
      '  // 3. 结合上下文（如用户已知母语）',
      '',
      '【detect(source, signal) 流式检测】',
      '  // source 是 ReadableStream，逐 chunk 检测',
      '  const source = new ReadableStream({',
      '    start(c) {',
      '      c.enqueue("Hello, ");',
      '      c.enqueue("world!");',
      '      c.close();',
      '    },',
      '  });',
      '  const results = await detector.detect(source, ac.signal);',
      '  // 流式检测：边输入边更新置信度',
      '',
      '【destroy() 释放模型】',
      '  detector.destroy();',
      '  // 模型内存释放，避免泄漏',
      '',
      '【完整的「检测 → 路由到对应 Translator」流程】',
      '  async function detectAndRoute(text, targetLang) {',
      '    const detector = await LanguageDetector.create();',
      '    const results = await detector.detect(text);',
      '    detector.destroy();',
      '    const top = results[0];',
      '    if (top.confidence < 0.5) {',
      '      return { error: "语言识别置信度过低", results };',
      '    }',
      '    // 检查目标语言是否支持',
      '    const supported = await Translator.languagePairAvailable(',
      '      top.detectedLanguage, targetLang,',
      '    );',
      '    if (supported !== "available") {',
      '      return { error: "不支持的语言配对", source: top.detectedLanguage };',
      '    }',
      '    const translator = await Translator.create({',
      '      sourceLanguage: top.detectedLanguage,',
      '      targetLanguage: targetLang,',
      '    });',
      '    const translated = await translator.translate(text);',
      '    translator.destroy();',
      '    return { source: top.detectedLanguage, translated };',
      '  }',
      '',
      '【浏览器支持】',
      `  LanguageDetector.create: ${f.detectorCreate ? '✓' : '✗'}`,
      `  LanguageDetector.availability: ${f.detectorAvailability ? '✓' : '✗'}`,
      '  Chrome 130+ origin trial',
      '',
      '【常见陷阱】',
      '  1. detect 返回多候选，必须取 results[0] 而非整个数组',
      '  2. 短文本置信度低，需累积文本或结合上下文',
      '  3. detect 复用同一 detector，避免重复 create',
      '  4. destroy 必须调用，否则模型内存泄漏',
      '  5. 多语言混合文本（如中英混排）结果可能不稳定',
    ].join('\n');
    this.setState({ detectorInfo: info });
    this._addLog('wt', `Language Detector 入口演示完成：create / detect / 多候选`);
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. Language Detector 入口 —— create / detect / 多候选 / 置信度排序',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['LanguageDetector.create', f.detectorCreate],
          ['LanguageDetector.availability', f.detectorAvailability],
        ]),
        h(Tag, { color: 'primary' }, 'Detector'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'LanguageDetector.create() 异步创建（无参数），detect(text) 返回多候选 [{detectedLanguage, confidence}]，按置信度降序排列。短文本（< 20 字符）识别准确率下降，需累积文本或结合上下文。detect(ReadableStream, signal) 流式检测边输入边更新。与 Translator 协同：先 detect 语言再 languagePairAvailable 检查配对再 create Translator（语言路由）。destroy() 释放模型内存。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 Language Detector 演示', { type: 'primary', size: 'sm', onClick: () => this._runDetectorDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 多候选语言检测
const detector = await LanguageDetector.create();
const results = await detector.detect('Bonjour le monde');
// [
//   { detectedLanguage: 'fr', confidence: 0.98 },
//   { detectedLanguage: 'en', confidence: 0.01 },
// ]
const [{ detectedLanguage, confidence }] = results;
if (confidence < 0.5) console.warn('置信度过低');

// 短文本识别挑战
await detector.detect('OK');   // 多语言相同，置信度低
await detector.detect('Hi');  // 英/德/荷难区分

// 流式检测
const source = new ReadableStream({
  start(c: any) {
});
await detector.detect(source, ac.signal);

detector.destroy(); // 释放模型`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果（4 个语言样本）：'),
        h('div', { class: `wt-result ${s.detectResult.startsWith('检测失败') ? 'wt-result--warn' : (s.detectResult ? 'wt-result--success' : '')}` },
          s.detectResult || '（点击按钮尝试真实本地语言检测：英/法/中/日样本）'),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.detectorInfo || '（点击按钮查看 Language Detector 入口完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 4：可用性检测 =====================

  _runAvailabilityDemo() {
    const f = this._flags();
    this._injectStyle('wt-availability-demo', `
      .wt-availability-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (!f.translatorAvailability) {
      this._addLog('warn', '(Translator as any).availability 不可用，可用性检测仅展示 API 用法（jsdom 无）');
    }
    const info = [
      '===== 可用性检测：availability / 模型下载状态 =====',
      '',
      '【(Translator as any).availability 静态方法】',
      '  // 探测某语言对的模型可用性，无需真实下载',
      '  const status = await (Translator as any).availability({',
      '    sourceLanguage: "en",',
      '    targetLanguage: "zh-Hans",',
      '  });',
      '',
      '  // status 可能值：',
      '  // "available"       模型已下载，可直接 create',
      '  // "downloadable"    模型可下载，首次 create 会触发下载',
      '  // "downloading"     模型正在下载（其他 create 已触发）',
      '  // "after-download"  模型下载后可用（需先触发下载）',
      '  // "unsupported"     不支持该语言对',
      '',
      '  switch (status) {',
      '    case "available":',
      '      // 直接创建，无延迟',
      '      break;',
      '    case "downloadable":',
      '      // 提示用户：首次使用需下载模型（数十 MB）',
      '      // 用户确认后 create 触发下载',
      '      break;',
      '    case "downloading":',
      '      // 显示下载进度，等待',
      '      break;',
      '    case "after-download":',
      '      // 需要先触发下载',
      '      break;',
      '    case "unsupported":',
      '      // 提示不支持，降级到云 API',
      '      break;',
      '  }',
      '',
      '【LanguageDetector.availability 静态方法】',
      '  const status = await LanguageDetector.availability();',
      '  // 无参数（detector 模型单一，支持所有语言）',
      '  // 返回值同 (Translator as any).availability',
      '',
      '【模型下载状态管理】',
      '  // 首次 create 触发下载，可通过 progress 事件监听',
      '  // （具体 API 在提案中演进，部分实现用 create 的 options）',
      '',
      '  // 方案 1：先 availability 探测，再 create',
      '  async function createTranslator(src, tgt) {',
      '    const status = await (Translator as any).availability({',
      '      sourceLanguage: src, targetLanguage: tgt,',
      '    });',
      '    if (status === "unsupported") {',
      '      throw new Error(`不支持 ${src} → ${tgt}`);',
      '    }',
      '    if (status === "downloadable") {',
      '      showDownloadPrompt(`${src} → ${tgt} 需下载模型（~50MB）`);',
      '      // 用户确认后 create',
      '    }',
      '    return await Translator.create({',
      '      sourceLanguage: src, targetLanguage: tgt,',
      '    });',
      '  }',
      '',
      '【首次使用提示 UI】',
      '  async function ensureModel(src, tgt) {',
      '    const status = await (Translator as any).availability({',
      '      sourceLanguage: src, targetLanguage: tgt,',
      '    });',
      '    if (status === "downloadable") {',
      '      const confirmed = await showConfirm({',
      '        title: "首次使用翻译",',
      '        body: `需要下载语言模型（约 50MB），是否继续？`,',
      '        confirmText: "下载并翻译",',
      '      });',
      '      if (!confirmed) {',
      '        return fallbackToCloudAPI(text, src, tgt);',
      '      }',
      '    }',
      '    return Translator.create({ sourceLanguage: src, targetLanguage: tgt });',
      '  }',
      '',
      '【模型缓存与复用】',
      '  - 浏览器自动缓存已下载的模型（IndexedDB / 文件系统）',
      '  - 同语言对第二次 create 即时返回（无下载）',
      '  - 多页面共享同一模型缓存',
      '  - 用户可手动清除（Chrome 设置 → 隐私 → 网站数据）',
      '',
      '【下载进度监听（提案演进中）】',
      '  // 部分实现提供 monitor 选项',
      '  const translator = await Translator.create({',
      '    sourceLanguage: "en",',
      '    targetLanguage: "zh-Hans",',
      '    monitor: (state: any) => {',
      '      // state: { downloadedBytes, totalBytes, status }',
      '      const pct = (state.downloadedBytes / state.totalBytes * 100).toFixed(0);',
      '      updateProgressBar(pct);',
      '    },',
      '  });',
      '',
      '【降级方案】',
      '  // 不支持或用户拒绝下载时降级到云 API',
      '  async function translateWithFallback(text, src, tgt) {',
      '    const status = await (Translator as any).availability({',
      '      sourceLanguage: src, targetLanguage: tgt,',
      '    });',
      '    if (status === "available" || status === "downloadable") {',
      '      try {',
      '        const t = await Translator.create({',
      '          sourceLanguage: src, targetLanguage: tgt,',
      '        });',
      '        const result = await t.translate(text);',
      '        t.destroy();',
      '        return result;',
      '      } catch (err: any) {',
      '        console.warn("本地翻译失败，降级到云");',
      '      }',
      '    }',
      '    return await cloudTranslate(text, src, tgt);',
      '  }',
      '',
      '【浏览器支持】',
      `  (Translator as any).availability: ${f.translatorAvailability ? '✓' : '✗'}`,
      `  LanguageDetector.availability: ${f.detectorAvailability ? '✓' : '✗'}`,
      '  Chrome 130+ origin trial',
      '',
      '【常见陷阱】',
      '  1. availability 是异步，必须 await',
      '  2. "available" 才能立即 create，"downloadable" 需 UI 提示',
      '  3. 多页面共享模型缓存，第二次 create 即时返回',
      '  4. monitor 选项 API 在演进，需查最新规范',
      '  5. 用户清除浏览器数据会删除模型，需重新下载',
    ].join('\n');
    this.setState({ availabilityInfo: info });
    this._addLog('wt', `可用性检测演示完成：availability / 模型下载状态管理`);
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. 可用性检测 —— (Translator as any).availability / LanguageDetector.availability / 下载状态',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['(Translator as any).availability', f.translatorAvailability],
          ['LanguageDetector.availability', f.detectorAvailability],
        ]),
        h(Tag, { color: 'primary' }, '可用性'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '(Translator as any).availability({ sourceLanguage, targetLanguage }) 返回 available（已下载）/ downloadable（可下载，首次 create 触发）/ downloading（下载中）/ after-download（需先触发下载）/ unsupported（不支持）。LanguageDetector.availability() 同语义但无参数。首次使用需 UI 提示模型下载（数十 MB），用户确认后 create 触发下载。浏览器自动缓存模型（IndexedDB），多页面共享，第二次 create 即时返回。降级方案：不支持或拒绝下载时回退到云 API。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行可用性检测演示', { type: 'primary', size: 'sm', onClick: () => this._runAvailabilityDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 探测模型可用性
const status = await (Translator as any).availability({
  sourceLanguage: 'en',
  targetLanguage: 'zh-Hans',
});
// 'available' / 'downloadable' / 'downloading' / 'after-download' / 'unsupported'

switch (status) {
  case 'available':
    // 直接 create，无延迟
    break;
  case 'downloadable':
    // UI 提示：首次需下载模型（~50MB），用户确认后 create
    if (await showDownloadConfirm()) {
      return await Translator.create({ sourceLanguage, targetLanguage });
    }
    return await cloudTranslate(); // 降级
  case 'unsupported':
    return await cloudTranslate(); // 降级
}

// 下载进度监听（提案演进中）
const translator = await Translator.create({
  sourceLanguage: 'en',
  targetLanguage: 'zh-Hans',
  monitor: (state: any) => {
    updateProgressBar(state.downloadedBytes / state.totalBytes * 100);
  },
});`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.availabilityInfo || '（点击按钮查看可用性检测完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 5：支持语言列表与配对 =====================

  _runLanguagesDemo() {
    const f = this._flags();
    this._injectStyle('wt-languages-demo', `
      .wt-languages-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (!f.languagePairAvailable) {
      this._addLog('warn', 'Translator.languagePairAvailable 不可用，仅展示常见语言列表（jsdom 无此 API）');
    }
    const info = [
      '===== 支持语言列表与配对：languagePairAvailable / BCP-47 =====',
      '',
      '【Translator.languagePairAvailable 静态方法】',
      '  // 探测某语言对是否支持翻译',
      '  const status = await Translator.languagePairAvailable(',
      '    "en",        // sourceLanguage',
      '    "zh-Hans",   // targetLanguage',
      '  );',
      '  // 返回同 availability：available/downloadable/after-download/unsupported',
      '',
      '  // 与 availability 的区别：',
      '  // - availability：探测模型下载状态',
      '  // - languagePairAvailable：探测语言对是否支持',
      '  // 实际语义类似，提案中可能合并',
      '',
      '【支持语言全集（约 50+ 种，持续扩展）】',
      '  常见语言：',
      '    en       英语',
      '    zh-Hans  简体中文',
      '    zh-Hant  繁体中文',
      '    es       西班牙语',
      '    fr       法语',
      '    de       德语',
      '    ja       日语',
      '    ko       韩语',
      '    ru       俄语',
      '    ar       阿拉伯语',
      '    hi       印地语',
      '    pt       葡萄牙语',
      '    it       意大利语',
      '    nl       荷兰语',
      '    tr       土耳其语',
      '    vi       越南语',
      '    th       泰语',
      '    id       印尼语',
      '    ms       马来语',
      '    pl       波兰语',
      '    uk       乌克兰语',
      '    sv       瑞典语',
      '    no       挪威语',
      '    da       丹麦语',
      '    fi       芬兰语',
      '    cs       捷克语',
      '    el       希腊语',
      '    he       希伯来语',
      '    fa       波斯语',
      '    bn       孟加拉语',
      '    ta       泰米尔语',
      '    ur       乌尔都语',
      '    ...',
      '',
      '【配对矩阵】',
      '  // 检查多语言对的可用性',
      '  const pairs = [',
      '    ["en", "zh-Hans"],',
      '    ["zh-Hans", "en"],',
      '    ["en", "ja"],',
      '    ["fr", "de"],',
      '    ["ar", "en"],',
      '  ];',
      '  for (const [src, tgt] of pairs) {',
      '    const status = await Translator.languagePairAvailable(src, tgt);',
      '    console.log(`${src} → ${tgt}: ${status}`);',
      '  }',
      '',
      '  // 注意：翻译方向不对称！en → zh 支持，zh → en 可能不支持',
      '  // （取决于模型训练数据）',
      '',
      '【语言代码 BCP-47】',
      '  // BCP-47 = RFC 5646 / RFC 4646 / RFC 4647',
      '  // 格式：language-script-region',
      '',
      '  常见 BCP-47 代码：',
      '    en         英语（通用）',
      '    en-US      美式英语',
      '    en-GB      英式英语',
      '    zh         中文（通用）',
      '    zh-Hans    简体中文（用 Hans 脚本子标签）',
      '    zh-Hant    繁体中文（用 Hant 脚本子标签）',
      '    zh-CN      中国大陆中文（用地区子标签）',
      '    zh-TW      台湾中文',
      '    zh-HK      香港中文',
      '    ja         日语',
      '    ko         韩语',
      '',
      '【中文 zh-Hans / zh-Hant 区分】',
      '  // 简体 vs 繁体是脚本（script）差异，非地区差异',
      '  // BCP-47 推荐用脚本子标签：',
      '    zh-Hans  简体中文（推荐）',
      '    zh-Hant  繁体中文（推荐）',
      '',
      '  // 而非地区子标签（不推荐）：',
      '    zh-CN    中国大陆（默认简体）',
      '    zh-TW    台湾（默认繁体）',
      '    zh-HK    香港（默认繁体）',
      '',
      '  // Translation API 通常要求精确的 zh-Hans/zh-Hant，',
      '  // 用 zh 可能不被识别或回退到默认',
      '',
      '【完整代码：列出所有可用语言对】',
      '  async function listAvailablePairs() {',
      '    const commonLanguages = [',
      '      "en", "zh-Hans", "zh-Hant", "es", "fr", "de", "ja", "ko",',
      '      "ru", "ar", "hi", "pt", "it", "nl", "tr", "vi", "th",',
      '    ];',
      '    const matrix = {};',
      '    for (const src of commonLanguages) {',
      '      matrix[src] = {};',
      '      for (const tgt of commonLanguages) {',
      '        if (src === tgt) continue;',
      '        const status = await Translator.languagePairAvailable(src, tgt);',
      '        matrix[src][tgt] = status;',
      '      }',
      '    }',
      '    return matrix;',
      '  }',
      '',
      '【用户语言偏好探测】',
      '  // 浏览器语言',
      '  const userLang = navigator.language;        // "zh-CN"',
      '  const userLangs = navigator.languages;     // ["zh-CN", "zh", "en-US", "en"]',
      '',
      '  // 优先匹配最具体语言（如 zh-CN → zh-Hans）',
      '  function pickTargetLanguage() {',
      '    for (const lang of navigator.languages) {',
      '      if (lang.startsWith("zh-Hans") || lang === "zh-CN") return "zh-Hans";',
      '      if (lang.startsWith("zh-Hant") || lang === "zh-TW") return "zh-Hant";',
      '      if (lang.startsWith("en")) return "en";',
      '      // ... 其他语言',
      '    }',
      '    return "en"; // 默认英语',
      '  }',
      '',
      '【浏览器支持】',
      `  languagePairAvailable: ${f.languagePairAvailable ? '✓' : '✗'}`,
      '  Chrome 130+ origin trial',
      '',
      '【常见陷阱】',
      '  1. 翻译方向不对称（en → zh 支持，zh → en 可能不支持）',
      '  2. 中文必须用 zh-Hans/zh-Hant，而非 zh-CN/zh-TW',
      '  3. languagePairAvailable 是异步，必须 await',
      '  4. 支持语言持续扩展，需动态探测而非硬编码',
      '  5. 方言变体（如 en-US vs en-GB）通常映射到 en，但 API 可能严格',
    ].join('\n');
    this.setState({ languagesInfo: info });
    this._addLog('wt', `支持语言列表与配对演示完成：BCP-47 / zh-Hans vs zh-Hant`);
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. 支持语言列表与配对 —— languagePairAvailable / BCP-47 / zh-Hans',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['languagePairAvailable', f.languagePairAvailable]]),
        h(Tag, { color: 'primary' }, '语言配对'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Translator.languagePairAvailable(src, tgt) 探测语言对支持（与 availability 语义类似）。支持语言全集约 50+ 种持续扩展。翻译方向不对称（en→zh 支持，zh→en 可能不支持）。BCP-47 语言代码：zh-Hans 简体（推荐）/ zh-Hant 繁体（推荐），而非 zh-CN/zh-TW（地区子标签，不推荐）。中文必须用 script 子标签，否则 API 可能不识别。用户语言偏好从 navigator.languages 匹配，优先具体语言。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行语言配对演示', { type: 'primary', size: 'sm', onClick: () => this._runLanguagesDemo() }),
        ),
        // 语言支持速查
        h('div', { class: 'wt-matrix' },
          h('div', { class: 'wt-matrix-cell' },
            h('div', { class: 'wt-matrix-title' }, '常见语言'),
            h('div', {}, 'en / zh-Hans / zh-Hant / es / fr / de / ja / ko / ru / ar / hi'),
          ),
          h('div', { class: 'wt-matrix-cell' },
            h('div', { class: 'wt-matrix-title' }, '亚洲语言'),
            h('div', {}, 'ja / ko / zh-Hans / zh-Hant / vi / th / id / ms / hi / ta'),
          ),
          h('div', { class: 'wt-matrix-cell' },
            h('div', { class: 'wt-matrix-title' }, '欧洲语言'),
            h('div', {}, 'en / fr / de / es / pt / it / nl / sv / no / da / fi / pl / uk / cs / el'),
          ),
          h('div', { class: 'wt-matrix-cell' },
            h('div', { class: 'wt-matrix-title' }, 'BCP-47 中文'),
            h('div', {}, 'zh-Hans 简体（推荐）· zh-Hant 繁体（推荐）· zh-CN/zh-TW 不推荐'),
          ),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 探测语言对支持
const status = await Translator.languagePairAvailable('en', 'zh-Hans');
// 'available' / 'downloadable' / 'unsupported'

// 翻译方向不对称：en → zh 支持，zh → en 可能不支持
const a = await Translator.languagePairAvailable('en', 'zh-Hans');
const b = await Translator.languagePairAvailable('zh-Hans', 'en');
console.log(a, b); // 可能 'available' / 'unsupported'

// 中文 BCP-47：用 script 子标签
// ✓ zh-Hans / zh-Hant（推荐）
// ✗ zh-CN / zh-TW（不推荐，API 可能不识别）

// 用户语言偏好
function pickTargetLang() {
  for (const lang of navigator.languages) {
    if (lang.startsWith('zh-Hans') || lang === 'zh-CN') return 'zh-Hans';
    if (lang.startsWith('zh-Hant') || lang === 'zh-TW') return 'zh-Hant';
    if (lang.startsWith('en')) return 'en';
  }
  return 'en';
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.languagesInfo || '（点击按钮查看支持语言列表与配对完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 6：实时翻译输入框 =====================

  _runRealtimeDemo() {
    const f = this._flags();
    this._injectStyle('wt-realtime-demo', `
      .wt-realtime-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (!f.translatorCreate || !f.detectorCreate) {
      this._addLog('warn', 'Translator/LanguageDetector 不可用，实时翻译仅展示模式（jsdom 无此 API）');
    }
    const info = [
      '===== 实战：实时翻译输入框 =====',
      '',
      '【场景：聊天输入框实时翻译】',
      '  - 用户输入英文，实时显示中文翻译',
      '  - 输入 → debounce → LanguageDetector.detect → Translator.translate → 显示',
      '  - 延迟感知：< 500ms（本地模型推理）',
      '',
      '【完整代码：实时翻译输入框】',
      '  <textarea id="input" placeholder="输入文本..."></textarea>',
      '  <div id="translation"></div>',
      '  <div id="detected-lang"></div>',
      '',
      '  let detector, translator;',
      '  let debounceTimer;',
      '  let currentRequest = null;  // AbortController 取消旧请求',
      '',
      '  async function init() {',
      '    detector = await LanguageDetector.create();',
      '    // 延迟创建 Translator（首次 detect 后才知道源语言）',
      '  }',
      '',
      '  input.addEventListener("input", () => {',
      '    clearTimeout(debounceTimer);',
      '    debounceTimer = setTimeout(translate, 300);  // 300ms debounce',
      '  });',
      '',
      '  async function translate() {',
      '    const text = input.value.trim();',
      '    if (!text) { translation.textContent = ""; return; }',
      '',
      '    // 取消上一个请求',
      '    if (currentRequest) currentRequest.abort();',
      '    const ac = new AbortController();',
      '    currentRequest = ac;',
      '',
      '    try {',
      '      // 1. 检测语言',
      '      const [{ detectedLanguage, confidence }] = await detector.detect(text);',
      '      detectedLang.textContent = `${detectedLanguage} (${(confidence * 100).toFixed(0)}%)`;',
      '',
      '      // 2. 跳过：源语言已是目标语言',
      '      const targetLang = "zh-Hans";',
      '      if (detectedLanguage === targetLang) {',
      '        translation.textContent = "(无需翻译)";',
      '        return;',
      '      }',
      '',
      '      // 3. 检查配对支持',
      '      const status = await Translator.languagePairAvailable(',
      '        detectedLanguage, targetLang,',
      '      );',
      '      if (status === "unsupported") {',
      '        translation.textContent = `(不支持 ${detectedLanguage} → ${targetLang})`;',
      '        return;',
      '      }',
      '',
      '      // 4. 创建/复用 Translator',
      '      if (!translator || translator.sourceLanguage !== detectedLanguage) {',
      '        translator?.destroy();',
      '        translator = await Translator.create({',
      '          sourceLanguage: detectedLanguage,',
      '          targetLanguage: targetLang,',
      '          signal: ac.signal,',
      '        });',
      '      }',
      '',
      '      // 5. 翻译',
      '      const result = await translator.translate(text, ac.signal);',
      '      if (!ac.signal.aborted) {',
      '        translation.textContent = result;',
      '      }',
      '    } catch (err: any) {',
      '      if (err.name !== "AbortError") {',
      '        console.error("翻译失败:", err);',
      '      }',
      '    }',
      '  }',
      '',
      '  init();',
      '',
      '【与 Web Speech API 协同：语音输入翻译】',
      '  // Web Speech API：语音识别 → 文本',
      '  // Translation API：文本 → 翻译',
      '',
      '  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();',
      '  recognition.lang = "en-US";',
      '  recognition.continuous = true;',
      '  recognition.interimResults = true;  // 实时中间结果',
      '',
      '  recognition.onresult = (event: any) => {',
      '    let interim = "";',
      '    let final = "";',
      '    for (let i = event.resultIndex; i < event.results.length; i++) {',
      '      const transcript = event.results[i][0].transcript;',
      '      if (event.results[i].isFinal) final += transcript;',
      '      else interim += transcript;',
      '    }',
      '    // 实时翻译中间结果',
      '    if (interim) translateRealtime(interim);',
      '    // 最终结果翻译',
      '    if (final) translateFinal(final);',
      '  };',
      '',
      '  recognition.start();',
      '',
      '  // 完整链路：',
      '  // 麦克风 → Web Speech API → interim 文本 → Translation API → 翻译显示',
      '  //         （实时）           （流式）      （本地推理）      （< 500ms）',
      '',
      '【离线场景】',
      '  - 模型下载后完全本地运行，无需网络',
      '  - 适合：飞行模式、弱网、隐私敏感场景',
      '  - 注意：',
      '    - 模型下载需联网（一次性）',
      '    - 模型缓存大小有限，可能被清除',
      '    - 多语言对需分别下载模型',
      '',
      '【性能优化】',
      '  - debounce 300-500ms（避免每次按键触发）',
      '  - 复用 Translator（避免重复 create）',
      '  - AbortController 取消旧请求（用户快速输入）',
      '  - 缓存翻译结果（相同文本不重复翻译）',
      '',
      '【降级方案】',
      '  // 不支持 Translation API 时降级到云',
      '  if (!("Translator" in window)) {',
      '    // 方案 1：Google Translate widget',
      '    google.translate.init({',
      '      apiKey: "YOUR_KEY",',
      '      source: "en", target: "zh",',
      '    });',
      '    // 方案 2：自建后端代理 Google Cloud Translation',
      '    const result = await fetch("/api/translate", {',
      '      method: "POST",',
      '      body: JSON.stringify({ text, src, tgt }),',
      '    });',
      '  }',
      '',
      '【浏览器支持】',
      `  Translator.create: ${f.translatorCreate ? '✓' : '✗'}`,
      `  LanguageDetector.create: ${f.detectorCreate ? '✓' : '✗'}`,
      '  Web Speech API: Chrome/Edge/Safari（Firefox 部分支持）',
      '',
      '【常见陷阱】',
      '  1. debounce 过短导致频繁 create/destroy，建议复用 Translator',
      '  2. AbortController 取消旧请求，避免结果错乱',
      '  3. 源语言 = 目标语言时跳过翻译',
      '  4. Web Speech API interimResults 实时翻译需 AbortController',
      '  5. 离线场景需检查 availability === "available"',
    ].join('\n');
    this.setState({ realtimeInfo: info });
    this._addLog('wt', `实时翻译输入框演示完成：input → debounce → detect → translate`);
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. 实战：实时翻译输入框 —— input → debounce → detect → translate',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['Translator.create', f.translatorCreate],
          ['LanguageDetector.create', f.detectorCreate],
        ]),
        h(Tag, { color: 'primary' }, '实时翻译'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '实时翻译输入框：input 事件 → 300ms debounce → LanguageDetector.detect 检测语言 → languagePairAvailable 检查配对 → Translator.create/复用 → translate 显示结果。AbortController 取消旧请求避免结果错乱。与 Web Speech API 协同：语音识别 interimResults → 实时翻译（麦克风 → Web Speech → Translation API → 显示，< 500ms）。离线场景需 availability==="available"。降级方案：不支持时回退到 Google Translate widget 或后端代理。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行实时翻译演示', { type: 'primary', size: 'sm', onClick: () => this._runRealtimeDemo() }),
        ),
        // 实时翻译流程图
        h('div', { class: 'wt-flow' },
          h('span', { class: 'wt-flow-node' }, 'input'),
          h('span', { class: 'wt-flow-arrow' }, '→'),
          h('span', { class: 'wt-flow-node' }, 'debounce 300ms'),
          h('span', { class: 'wt-flow-arrow' }, '→'),
          h('span', { class: 'wt-flow-node wt-flow-node--ai' }, 'LanguageDetector.detect'),
          h('span', { class: 'wt-flow-arrow' }, '→'),
          h('span', { class: 'wt-flow-node wt-flow-node--ai' }, 'Translator.translate'),
          h('span', { class: 'wt-flow-arrow' }, '→'),
          h('span', { class: 'wt-flow-node' }, '显示结果'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 实时翻译输入框
input.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(translate, 300);
});

async function translate() {
  const text = input.value.trim();
  if (!text) return;
  // 取消旧请求
  if (currentRequest) currentRequest.abort();
  const ac = new AbortController();
  currentRequest = ac;

  // 1. 检测语言
  const [{ detectedLanguage }] = await detector.detect(text);
  if (detectedLanguage === 'zh-Hans') return; // 无需翻译

  // 2. 创建/复用 Translator
  if (!translator || translator.sourceLanguage !== detectedLanguage) {
    translator?.destroy();
    translator = await Translator.create({
      sourceLanguage: detectedLanguage,
      targetLanguage: 'zh-Hans',
      signal: ac.signal,
    });
  }
  // 3. 翻译
  const result = await translator.translate(text, ac.signal);
  if (!ac.signal.aborted) translation.textContent = result;
}

// 与 Web Speech API 协同：语音输入翻译
const recognition = new SpeechRecognition();
recognition.lang = 'en-US';
recognition.interimResults = true;
recognition.onresult = (e: any) => {
  for (let i = e.resultIndex; i < e.results.length; i++) {
    const transcript = e.results[i][0].transcript;
    if (e.results[i].isFinal) translateFinal(transcript);
    else translateRealtime(transcript);
  }
};`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.realtimeInfo || '（点击按钮查看实时翻译输入框完整方案）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 7：批量文档翻译与语言路由 =====================

  _runBatchDemo() {
    const f = this._flags();
    this._injectStyle('wt-batch-demo', `
      .wt-batch-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (!f.translatorCreate) {
      this._addLog('warn', 'Translator 不可用，批量翻译仅展示模式（jsdom 无此 API）');
    }
    const info = [
      '===== 实战：批量文档翻译与语言路由 =====',
      '',
      '【场景：批量翻译长文档】',
      '  - 输入：10000+ 字文档（可能是多语言混合）',
      '  - 输出：目标语言译文',
      '  - 挑战：',
      '    - 单次 translate 上限（通常 ~5000 字符）',
      '    - 多语言混合需分段检测语言',
      '    - 进度反馈',
      '    - 中止能力',
      '',
      '【长文本分段】',
      '  // 按句子/段落切分，每段 < 5000 字符',
      '  function splitText(text, maxLen = 5000) {',
      '    const chunks = [];',
      '    // 优先按段落切分',
      '    const paragraphs = text.split(/\\n\\n+/);',
      '    let current = "";',
      '    for (const para of paragraphs) {',
      '      if ((current + para).length > maxLen) {',
      '        if (current) chunks.push(current);',
      '        // 段落本身过长，按句子切分',
      '        if (para.length > maxLen) {',
      '          const sentences = para.match(/[^.!?。！？]+[.!?。！？]?/g) || [para];',
      '          current = "";',
      '          for (const s of sentences) {',
      '            if ((current + s).length > maxLen) {',
      '              if (current) chunks.push(current);',
      '              current = s;',
      '            } else {',
      '              current += s;',
      '            }',
      '          }',
      '        } else {',
      '          current = para;',
      '        }',
      '      } else {',
      '        current += "\\n\\n" + para;',
      '      }',
      '    }',
      '    if (current) chunks.push(current);',
      '    return chunks;',
      '  }',
      '',
      '【多语言混合文本：语言路由】',
      '  // 检测每段语言，分别用对应 Translator',
      '  async function translateMixedText(chunks, targetLang) {',
      '    const detector = await LanguageDetector.create();',
      '    const translators = {};  // 缓存：lang → Translator',
      '    const results = [];',
      '    for (const chunk of chunks) {',
      '      const [{ detectedLanguage }] = await detector.detect(chunk);',
      '      if (detectedLanguage === targetLang) {',
      '        results.push(chunk);  // 无需翻译',
      '        continue;',
      '      }',
      '      // 缓存 Translator（避免重复 create）',
      '      if (!translators[detectedLanguage]) {',
      '        translators[detectedLanguage] = await Translator.create({',
      '          sourceLanguage: detectedLanguage,',
      '          targetLanguage: targetLang,',
      '        });',
      '      }',
      '      const translated = await translators[detectedLanguage].translate(chunk);',
      '      results.push(translated);',
      '    }',
      '    // 释放所有 Translator',
      '    for (const t of (Object as any).values(translators)) t.destroy();',
      '    detector.destroy();',
      '    return results.join("\\n\\n");',
      '  }',
      '',
      '【进度监控】',
      '  async function translateWithProgress(text, targetLang, onProgress) {',
      '    const chunks = splitText(text);',
      '    const total = chunks.length;',
      '    let done = 0;',
      '    const results = [];',
      '    for (const chunk of chunks) {',
      '      const result = await translateChunk(chunk, targetLang);',
      '      results.push(result);',
      '      done++;',
      '      onProgress({ done, total, pct: (done / total * 100).toFixed(0) });',
      '    }',
      '    return results.join("\\n\\n");',
      '  }',
      '',
      '  // UI 进度条',
      '  await translateWithProgress(doc, "zh-Hans", ({ done, total, pct }: any) => {',
      '    progressBar.style.width = pct + "%";',
      '    progressText.textContent = `${done}/${total} 段 (${pct}%)`;',
      '  });',
      '',
      '【AbortSignal 中止】',
      '  const ac = new AbortController();',
      '  abortButton.onclick = () => ac.abort(new DOMException("用户取消", "AbortError"));',
      '',
      '  try {',
      '    const result = await translateWithProgress(text, "zh-Hans", { signal: ac.signal });',
      '  } catch (err: any) {',
      '    if (err.name === "AbortError") {',
      '      console.log("用户中止翻译");',
      '    } else {',
      '      console.error("翻译失败:", err);',
      '    }',
      '  }',
      '',
      '【翻译质量评估】',
      '  // 1. BLEU / METEOR 分数（需参考译文）',
      '  // 2. 回译：翻译后再翻译回原文，对比相似度',
      '  async function backTranslationQuality(text, src, tgt) {',
      '    const t1 = await Translator.create({ sourceLanguage: src, targetLanguage: tgt });',
      '    const t2 = await Translator.create({ sourceLanguage: tgt, targetLanguage: src });',
      '    const translated = await t1.translate(text);',
      '    const back = await t2.translate(translated);',
      '    t1.destroy(); t2.destroy();',
      '    // 相似度评估（如 Levenshtein / 余弦）',
      '    return { translated, back, similarity: cosineSim(text, back) };',
      '  }',
      '',
      '【与 WebNN 硬件加速协同】',
      '  // 检测 WebNN 支持时优先使用 NPU',
      '  if ("ml" in navigator) {',
      '    // WebNN 可用，Translation API 自动用 NPU 加速',
      '    const context = await navigator.ml.createContext();',
      '    console.log("WebNN 加速已启用");',
      '  }',
      '',
      '  // 不影响 API 调用，但推理速度可能提升 5-10 倍',
      '',
      '【并发翻译优化】',
      '  // 多段并发翻译（受限于 Translator 实例数与硬件并发）',
      '  async function parallelTranslate(chunks, targetLang, concurrency = 4) {',
      '    const detector = await LanguageDetector.create();',
      '    const results = new Array(chunks.length);',
      '    let index = 0;',
      '    async function worker() {',
      '      while (index < chunks.length) {',
      '        const i = index++;',
      '        const [{ detectedLanguage }] = await detector.detect(chunks[i]);',
      '        const t = await Translator.create({',
      '          sourceLanguage: detectedLanguage, targetLanguage: targetLang,',
      '        });',
      '        results[i] = await t.translate(chunks[i]);',
      '        t.destroy();',
      '      }',
      '    }',
      '    await Promise.all(Array(concurrency).fill().map(worker));',
      '    detector.destroy();',
      '    return results.join("\\n\\n");',
      '  }',
      '',
      '【浏览器支持】',
      `  Translator.create: ${f.translatorCreate ? '✓' : '✗'}`,
      `  LanguageDetector.create: ${f.detectorCreate ? '✓' : '✗'}`,
      '  WebNN: Chrome 130+（部分实现）',
      '',
      '【常见陷阱】',
      '  1. 单次 translate 上限 ~5000 字符，长文本必须分段',
      '  2. 多语言混合需分段检测，避免整篇按一种语言翻译',
      '  3. 并发翻译受限于硬件（CPU/GPU/NPU），过度并发反而降速',
      '  4. Translator 实例数有限制，过多 create 会失败',
      '  5. WebNN 加速对 API 透明，但需硬件支持（NPU）',
    ].join('\n');
    this.setState({ batchInfo: info });
    this._addLog('wt', `批量文档翻译与语言路由演示完成：分段 + 进度监控 + AbortSignal + 并发`);
  }

  _renderCard7() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. 实战：批量文档翻译与语言路由 —— 分段 / 进度 / AbortSignal / WebNN',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['Translator.create', f.translatorCreate],
          ['LanguageDetector.create', f.detectorCreate],
        ]),
        h(Tag, { color: 'primary' }, '批量翻译'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '长文本分段（按段落/句子，每段 < 5000 字符）。多语言混合：每段 detect 语言，缓存对应 Translator（语言路由）。进度监控：onProgress({ done, total, pct })。AbortSignal 中止（abortButton 触发 ac.abort）。翻译质量评估：回译（翻译后译回原文对比相似度）。与 WebNN 硬件加速协同（navigator.ml 检测，NPU 提速 5-10 倍）。并发翻译：worker pool concurrency=4（受限于硬件并发与 Translator 实例数）。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行批量翻译演示', { type: 'primary', size: 'sm', onClick: () => this._runBatchDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 长文本分段
function splitText(text: any, maxLen: any = 5000) {
  // 按段落 + 句子切分
  const chunks = [];
  // ... 切分逻辑
  return chunks;
}

// 多语言混合：语言路由
async function translateMixed(chunks: any,  targetLang: any) {
  const detector = await LanguageDetector.create();
  const translators = {}; // 缓存
  for (const chunk of chunks) {
    const [{ detectedLanguage }] = await detector.detect(chunk);
    if (!translators[detectedLanguage]) {
      translators[detectedLanguage] = await Translator.create({
        sourceLanguage: detectedLanguage, targetLanguage: targetLang,
      });
    }
    await translators[detectedLanguage].translate(chunk);
  }
  for (const t of (Object as any).values(translators)) t.destroy();
  detector.destroy();
}

// 进度 + AbortSignal
const ac = new AbortController();
await translateWithProgress(text, 'zh-Hans', {
  signal: ac.signal,
  onProgress: ({ done, total, pct }: any) => updateBar(pct),
});
abortButton.onclick = () => ac.abort();

// WebNN 硬件加速（透明）
if ('ml' in navigator) console.log('NPU 加速已启用');`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.batchInfo || '（点击按钮查看批量文档翻译与语言路由完整方案）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 8：陷阱与最佳实践 =====================

  _runPitfallsDemo() {
    const f = this._flags();
    this._injectStyle('wt-pitfalls-demo', `
      .wt-pitfalls-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    const info = [
      '===== 陷阱与最佳实践：模型体积 / 隐私 / 云取舍 / 降级 =====',
      '',
      '【陷阱 1：模型体积与下载时机】',
      '  - 单语言对模型 30-100 MB',
      '  - 多语言对累积可达数百 MB',
      '  - 首次 create 触发下载，用户未预期会困惑',
      '',
      '  最佳实践：',
      '  1. 先 availability 探测，"downloadable" 时弹窗提示',
      '  2. 在 onboarding 阶段预下载常用语言对',
      '  3. 监控下载进度，超时降级到云',
      '  4. 用户清除浏览器数据会删除模型，需重新下载',
      '',
      '【陷阱 2：隐私敏感文本（不应翻译）】',
      '  场景：医疗病历、法律合同、财务报表',
      '  问题：',
      '  - 本地翻译虽不上传，但翻译结果可能被缓存',
      '  - 浏览器扩展可能拦截 translate 调用',
      '  - 调试日志可能记录翻译内容',
      '',
      '  最佳实践：',
      '  1. 极敏感内容用专用客户端（非浏览器）',
      '  2. 翻译后清理浏览器缓存',
      '  3. 禁用调试日志（生产环境）',
      '  4. 提供用户选项：「不翻译此页面」',
      '',
      '【陷阱 3：与云翻译 API 取舍】',
      '  本地（Translation API）：',
      '    ✓ 隐私：数据不离开设备',
      '    ✓ 离线：飞行模式可用',
      '    ✓ 成本：免费',
      '    ✓ 延迟：本地推理（无网络往返）',
      '    ✗ 质量：小模型，复杂内容质量低',
      '    ✗ 语言：~50+ 种（持续扩展）',
      '    ✗ 兼容：Chrome 130+ origin trial',
      '',
      '  云（Google Translate API）：',
      '    ✓ 质量：大模型，质量更高',
      '    ✓ 语言：100+ 种',
      '    ✓ 兼容：全平台 REST API',
      '    ✗ 隐私：上传到云',
      '    ✗ 离线：必须联网',
      '    ✗ 成本：按字符收费',
      '    ✗ 延迟：网络往返',
      '',
      '  选型建议：',
      '    隐私敏感 + 离线场景 → 本地（Translation API）',
      '    高质量 + 多语言 + 跨平台 → 云（Google Translate）',
      '    混合方案：',
      '      - 短文本/常用语言 → 本地',
      '      - 长文档/复杂内容 → 云',
      '      - 隐私敏感 → 本地',
      '      - 用户选择 → 提供切换',
      '',
      '【陷阱 4：多语言混合文本】',
      '  问题：',
      '  - 整篇按一种语言翻译会失败（如中英混排）',
      '  - detect 返回的可能是主导语言，遗漏少数语言段',
      '  - 翻译方向不一致导致上下文丢失',
      '',
      '  最佳实践：',
      '  1. 分段 detect（见 Card 7）',
      '  2. 缓存对应 Translator（语言路由）',
      '  3. 短段（< 20 字符）置信度低，合并到相邻段',
      '  4. 用户可选「按段翻译」或「整篇翻译」',
      '',
      '【陷阱 5：浏览器支持矩阵】',
      '  Chrome 130+ origin trial（需注册 token）',
      '  Edge 跟随 Chromium',
      '  Firefox：未实现（截至 2025）',
      '  Safari：未实现（截至 2025）',
      '  移动端：Android Chrome 跟随桌面',
      '',
      '  降级链：',
      '    Translation API → Google Translate widget → 后端代理 → 提示用户手动翻译',
      '',
      '【陷阱 6：降级到 Google Translate widget】',
      '  // 不支持 Translation API 时',
      '  if (!("Translator" in window)) {',
      '    // 方案 1：Google Translate widget（需 Google 账号）',
      '    const script = document.createElement("script");',
      '    script.src = "https://translate.google.com/translate_a/element.js";',
      '    script.onload = () => {',
      '      google.translate.init({',
      '        pageLanguage: "en",',
      '        includedLanguages: "zh-Hans,zh-Hant,ja,ko,es,fr,de",',
      '      });',
      '    };',
      '    document.head.appendChild(script);',
      '',
      '    // 方案 2：后端代理 Google Cloud Translation',
      '    async function cloudTranslate(text, src, tgt) {',
      '      const resp = await fetch("/api/translate", {',
      '        method: "POST",',
      '        headers: { "Content-Type": "application/json" },',
      '        body: JSON.stringify({ text, source: src, target: tgt }),',
      '      });',
      '      return (await resp.json()).translatedText;',
      '    }',
      '',
      '    // 方案 3：提示用户',
      '    alert("您的浏览器不支持本地翻译，请使用 Chrome 130+ 或刷新页面");',
      '  }',
      '',
      '【陷阱 7：模型缓存与清理】',
      '  - 模型缓存大小有限（通常 ~500MB）',
      '  - 用户清除浏览器数据会删除所有模型',
      '  - 多语言对模型累积可能超出缓存',
      '  - 提供用户选项：清理未使用语言对的模型',
      '',
      '【陷阱 8：origin trial 过期】',
      '  - origin trial token 有效期通常 6 个月',
      '  - 过期后 API 失效，需重新注册',
      '  - 生产环境应监控 API 可用性，降级到云',
      '',
      '【最佳实践清单】',
      '  ✓ 先 availability 探测，"downloadable" 时弹窗提示下载',
      '  ✓ 复用 Translator（避免重复 create/destroy）',
      '  ✓ destroy 必须调用，释放模型内存',
      '  ✓ AbortSignal 中止长翻译',
      '  ✓ 长文本分段（< 5000 字符）',
      '  ✓ 多语言混合分段 detect（语言路由）',
      '  ✓ 隐私敏感内容提示用户',
      '  ✓ 不支持时降级到 Google Translate widget',
      '  ✓ 监控 origin trial 过期',
      '  ✓ 用户选项：不翻译此页面 / 清理模型',
      '',
      '【浏览器支持总览】',
      `  Translator: ${f.translator ? '✓' : '✗'}`,
      `  LanguageDetector: ${f.languageDetector ? '✓' : '✗'}`,
      `  (Translator as any).availability: ${f.translatorAvailability ? '✓' : '✗'}`,
      `  languagePairAvailable: ${f.languagePairAvailable ? '✓' : '✗'}`,
      '  Chrome 130+ origin trial',
      '  Firefox/Safari 未实现（截至 2025）',
    ].join('\n');
    this.setState({ pitfallsInfo: info });
    this._addLog('wt', `陷阱与最佳实践演示完成：8 大陷阱 + 10 条最佳实践`);
  }

  _renderCard8() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 陷阱与最佳实践 —— 模型体积 / 隐私 / 云取舍 / 混合文本 / 降级',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['Translator', f.translator],
          ['LanguageDetector', f.languageDetector],
        ]),
        h(Tag, { color: 'warning' }, '陷阱 + 最佳实践'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '8 大陷阱：模型体积（30-100MB，先 availability 探测提示下载）/ 隐私敏感文本（医疗/法律/财务，禁用日志）/ 云 vs 本地取舍（隐私+离线+免费 vs 质量+语言+兼容）/ 多语言混合（分段 detect 语言路由）/ 浏览器支持矩阵（Chrome 130+ origin trial）/ 降级 Google Translate widget / 模型缓存清理 / origin trial 过期。10 条最佳实践：availability 探测、复用 Translator、destroy 释放、AbortSignal 中止、长文本分段、混合文本路由、隐私提示、降级方案、监控过期、用户选项。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行陷阱与最佳实践演示', { type: 'primary', size: 'sm', onClick: () => this._runPitfallsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 陷阱 1：模型体积 → 先 availability 探测
const status = await (Translator as any).availability({ sourceLanguage: 'en', targetLanguage: 'zh-Hans' });
if (status === 'downloadable') {
  if (!await showDownloadPrompt()) return cloudTranslate();
}

// 陷阱 3：云 vs 本地取舍
if (text.length < 1000 && privacySensitive) {
  return await localTranslate(text); // 本地
} else if (text.length > 5000 || complexContent) {
  return await cloudTranslate(text); // 云
}

// 陷阱 6：降级到 Google Translate widget
if (!('Translator' in window)) {
  const script = document.createElement('script');
  script.src = 'https://translate.google.com/translate_a/element.js';
  document.head.appendChild(script);
}

// 陷阱 8：监控 origin trial 过期
try {
  const t = await Translator.create({ sourceLanguage: 'en', targetLanguage: 'zh-Hans' });
  t.destroy();
} catch (err: any) {
  console.warn('Translation API 可能已过期，降级到云');
  return cloudTranslate();
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.pitfallsInfo || '（点击按钮查看 8 大陷阱与 10 条最佳实践完整说明）')),
        h(Alert, {
          type: 'warning',
          message: 'Chrome 130+ origin trial 实验 API，生产需降级方案',
          description: '8 大陷阱：模型体积（先 availability）/ 隐私敏感（禁用日志）/ 云取舍（隐私 vs 质量）/ 混合文本（分段路由）/ 浏览器矩阵（Chrome 130+）/ 降级 widget / 缓存清理 / origin trial 过期。10 条最佳实践：availability 探测、复用 Translator、destroy、AbortSignal、长文本分段、混合路由、隐私提示、降级方案、监控过期、用户选项。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== 日志面板 =====================

  _renderLogPanel() {
    const s = this.state;
    if (!s.logs || s.logs.length === 0) return null;
    return h(Card, { title: '运行日志' },
      h('div', { class: 'log-list' },
        ...s.logs.map((log: any) =>
          h('div', { class: `log-item log-${log.type}` },
            h('span', { class: 'log-time' }, log.time),
            h('span', { class: 'log-content' }, log.content),
          ),
        ),
      ),
    );
  }

  // ===================== 渲染入口 =====================

  renderPage() {
    const s = this.state;
    return [
      h('h2', { class: 'section-title' }, 'Translation + Language Detector API 完整实验室'),

      h(Alert, {
        type: 'info',
        message: 'Translation + Language Detector API —— 浏览器内置翻译与语言识别深度实验室',
        description: '演示 Chrome 130+ origin trial 的浏览器内置翻译能力（Translation API + Language Detector API，基于内置小模型 + WebNN 硬件加速，完全本地推理数据不离开设备）：Translator 入口（create 异步创建 + translate 同步/流式翻译 + signal 中止 + destroy 释放模型 + 复用实例）、Language Detector 入口（create + detect 多候选 + 置信度排序 + 短文本识别挑战 + 与 Translator 协同语言路由）、可用性检测（availability 返回 available/downloadable/downloading/after-download/unsupported + 首次下载 UI 提示 + 模型缓存复用 + monitor 进度监听 + 降级方案）、支持语言列表与配对（languagePairAvailable + ~50+ 种语言 + BCP-47 zh-Hans/zh-Hant 区分 + 翻译方向不对称 + 用户语言偏好匹配）、实时翻译输入框（input → debounce 300ms → detect → languagePairAvailable → create/复用 → translate + AbortController 取消旧请求 + 与 Web Speech API 协同语音输入翻译 + 离线场景 + 降级 Google Translate widget）、批量文档翻译与语言路由（长文本分段 < 5000 字符 + 多语言混合分段 detect + 进度监控 onProgress + AbortSignal 中止 + 回译质量评估 + 与 WebNN 硬件加速协同 NPU 提速 + 并发 worker pool）、陷阱与最佳实践（模型体积与下载时机 + 隐私敏感文本不应翻译 + 云翻译取舍本地隐私 vs 云质量 + 多语言混合分段路由 + 浏览器支持矩阵 Chrome 130+ origin trial + 降级 Google Translate widget + 模型缓存清理 + origin trial 过期监控）。jsdom 无 Translator/LanguageDetector 所有检测为 false，仅记日志绝不抛异常；真实 Chrome（开启 origin trial）可完整体验本地翻译。',
      }),

      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null as any,

      h('div', { class: 'feature-grid' },
        this._renderCard1(),
        this._renderCard2(),
        this._renderCard3(),
        this._renderCard4(),
        this._renderCard5(),
        this._renderCard6(),
        this._renderCard7(),
        this._renderCard8(),
      ),

      this._renderLogPanel(),
    ];
  }
}
