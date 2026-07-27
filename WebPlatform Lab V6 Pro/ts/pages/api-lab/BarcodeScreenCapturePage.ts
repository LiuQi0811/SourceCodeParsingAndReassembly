// =====================================================================
// BarcodeScreenCapturePage.js —— 条码识别 / 屏幕共享 / 图像捕获 实验室
// 演示 MDN：
//   1. Barcode Detection API —— BarcodeDetector 构造器、getSupportedFormats、
//      detect(imageSource) 识别条码/二维码，读取 rawValue / boundingBox / cornerPoints
//   2. Screen Capture API —— navigator.mediaDevices.getDisplayMedia 请求屏幕共享，
//      读取 displaySurface / cursor 设置，applyConstraints 动态修改，onended 监听停止
//   3. ImageCapture API —— new ImageCapture(videoTrack)、takePhoto 获取 Blob、
//      getPhotoCapabilities 读取能力、grabFrame 抓取 ImageBitmap
//   4. MediaStreamTrack 高级能力 —— getCapabilities（pan/tilt/zoom/torch）、
//      getSettings、applyConstraints、onmute/onunmute、clone
//   5. MediaDevices 设备枚举 —— enumerateDevices、getSupportedConstraints、ondevicechange
// 说明：BarcodeDetector / ImageCapture / navigator.mediaDevices 在 jsdom 中均 undefined，
//       所有 API 调用前做 typeof 能力检测，不可用时仅记日志（_addLog('warn', ...)），
//       绝不抛异常。本页不真正调用 getDisplayMedia / getUserMedia（会触发权限弹窗），
//       仅展示用法和检测能力；如需演示用 mock track 或仅记日志说明调用方式。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { Props, State } from '../../core/types.js';
import type { ButtonProps } from '../../components/ui/Button.js';

// BarcodeDetector 构造器允许指定的全部条码格式（按 MDN 文档罗列）
const ALL_BARCODE_FORMATS = [
  'qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8',
  'upc_a', 'upc_e', 'itf', 'codabar', 'pdf417', 'aztec', 'data_matrix',
];

interface LogEntry { type: string; content: string; time: string; }

interface BarcodeScreenCapturePageCaps {
  barcode: boolean;
  barcodeFormats: boolean;
  mediaDevices: boolean;
  displayMedia: boolean;
  userMedia: boolean;
  enumerate: boolean;
  supportedConstraints: boolean;
  onDeviceChange: boolean;
  imageCapture: boolean;
  createImageBitmap: boolean;
  canvas: boolean;
}

export interface BarcodeScreenCapturePageProps extends Props {}

export interface BarcodeScreenCapturePageState extends State {
  logs: LogEntry[];
  capsSummary: string;
  barcodeSupportInfo: string;
  barcodeDetectInfo: string;
  displayMediaInfo: string;
  imageCaptureInfo: string;
  trackCapabilityInfo: string;
  devicesInfo: string;
}

export class BarcodeScreenCapturePage extends Page {
  declare props: BarcodeScreenCapturePageProps;
  declare state: BarcodeScreenCapturePageState;

  _inited: boolean = false;
  declare _destroyed: boolean;
  _barcodeDetector!: any;
  _displayStream!: any;
  _displayTrack!: any;
  _imageCapture!: any;
  _cameraTrack!: any;
  _deviceChangeHandler!: any;


  // —— 初始 state ——
  initialState(): BarcodeScreenCapturePageState {
    return {
      logs: [],
      capsSummary: '',
      // Card 1：BarcodeDetector 能力检测 + getSupportedFormats
      barcodeSupportInfo: '',
      // Card 2：BarcodeDetector.detect 识别
      barcodeDetectInfo: '',
      // Card 3：getDisplayMedia 屏幕共享
      displayMediaInfo: '',
      // Card 4：ImageCapture 拍照
      imageCaptureInfo: '',
      // Card 5：MediaTrack capabilities/settings/applyConstraints
      trackCapabilityInfo: '',
      // Card 6：enumerateDevices + getSupportedConstraints
      devicesInfo: '',
    };
  }

  // —— 生命周期 ——
  componentDidMount(): void {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._barcodeDetector = null;    // Card 1/2 构造的 BarcodeDetector 实例
    this._displayStream = null;      // Card 3 屏幕共享 MediaStream
    this._displayTrack = null;       // Card 3 屏幕共享视频 track
    this._imageCapture = null;       // Card 4 ImageCapture 实例
    this._cameraTrack = null;        // Card 5 摄像头视频 track（演示 capabilities）
    this._deviceChangeHandler = null;// Card 6 ondevicechange 处理器

    // 一次性能力检测：BarcodeDetector / ImageCapture / mediaDevices 全家桶
    const hasBarcode = typeof BarcodeDetector !== 'undefined';
    const hasBarcodeGetFormats = hasBarcode && typeof BarcodeDetector.getSupportedFormats === 'function';
    const hasMediaDevices = typeof navigator !== 'undefined' && navigator.mediaDevices &&
      typeof navigator.mediaDevices === 'object';
    const md = navigator.mediaDevices;
    const hasDisplayMedia = hasMediaDevices && typeof md.getDisplayMedia === 'function';
    const hasUserMedia = hasMediaDevices && typeof md.getUserMedia === 'function';
    const hasEnumerate = hasMediaDevices && typeof md.enumerateDevices === 'function';
    const hasSupportedConstraints = hasMediaDevices && typeof md.getSupportedConstraints === 'function';
    const hasOnDeviceChange = hasMediaDevices && 'ondevicechange' in md;
    const hasImageCapture = typeof ImageCapture !== 'undefined';
    const hasCreateImageBitmap = typeof createImageBitmap === 'function';
    const hasCanvas = typeof HTMLCanvasElement !== 'undefined' ||
      (typeof document !== 'undefined' && typeof document.createElement === 'function');

    const tick = (n: any) => n ? '✓' : '✗';
    const parts = [
      `BarcodeDetector ${tick(hasBarcode)}`, `getSupportedFormats ${tick(hasBarcodeGetFormats)}`,
      `mediaDevices ${tick(hasMediaDevices)}`, `getDisplayMedia ${tick(hasDisplayMedia)}`,
      `getUserMedia ${tick(hasUserMedia)}`, `enumerateDevices ${tick(hasEnumerate)}`,
      `getSupportedConstraints ${tick(hasSupportedConstraints)}`, `ondevicechange ${tick(hasOnDeviceChange)}`,
      `ImageCapture ${tick(hasImageCapture)}`, `createImageBitmap ${tick(hasCreateImageBitmap)}`,
      `Canvas ${tick(hasCanvas)}`,
    ];

    const anyMedia = hasBarcode || hasImageCapture || hasDisplayMedia;
    const summary = anyMedia
      ? `能力检测：${parts.join(' · ')}。当前环境部分能力可用；getDisplayMedia/getUserMedia 会触发权限弹窗，本页不真正调用，仅展示用法与能力检测。`
      : `能力检测：${parts.join('，')}。当前环境（jsdom/Node）BarcodeDetector / ImageCapture / navigator.mediaDevices 均不可用；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器（HTTPS 或 localhost）中打开可完整演示。`;

    this.setState({ capsSummary: summary });
    this._addLog(hasBarcode ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!hasBarcode) this._addLog('warn', 'BarcodeDetector 不可用（typeof BarcodeDetector === "undefined"），需 Chrome/Edge 或开启实验标志');
    if (!hasMediaDevices) this._addLog('warn', 'navigator.mediaDevices 不可用（需安全上下文 https/localhost + 真实浏览器）');
    if (!hasImageCapture) this._addLog('warn', 'ImageCapture 不可用（typeof ImageCapture === "undefined"），需 Chromium 系浏览器');
    if (hasDisplayMedia) this._addLog('info', 'getDisplayMedia 可用，但本页不真正调用（避免触发权限弹窗）');
  }

  componentWillUnmount(): void {
    // 释放屏幕共享 / 摄像头 MediaStream 的所有 track，关闭 ImageCapture，
    // 移除 ondevicechange 监听，置空引用便于 GC
    this._stopDisplayStream();
    this._stopCameraTrack();
    this._imageCapture = null;  // ImageCapture 无显式 close API，置空引用即可
    if (this._deviceChangeHandler && navigator.mediaDevices) {
      try { navigator.mediaDevices.removeEventListener('devicechange', this._deviceChangeHandler); }
      catch { /* noop */ }
      this._deviceChangeHandler = null;
    }
    this._barcodeDetector = null;
  }

  // —— 日志 / 按钮辅助 ——
  _addLog(type: string, content: string): void {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label: string, opts: ButtonProps): Node | string {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render() as Node;
  }

  // —— 同步能力检测（render 时调用，开销可忽略）——
  _caps(): BarcodeScreenCapturePageCaps {
    const hasMedia = typeof navigator !== 'undefined' && navigator.mediaDevices &&
      typeof navigator.mediaDevices === 'object';
    const md = navigator.mediaDevices;
    const has = (fn: any) => hasMedia && typeof ((md as any)[(fn as any)]) === 'function';
    return {
      barcode: typeof BarcodeDetector !== 'undefined',
      barcodeFormats: typeof BarcodeDetector !== 'undefined' &&
        typeof BarcodeDetector.getSupportedFormats === 'function',
      mediaDevices: hasMedia,
      displayMedia: has('getDisplayMedia'), userMedia: has('getUserMedia'),
      enumerate: has('enumerateDevices'), supportedConstraints: has('getSupportedConstraints'),
      onDeviceChange: hasMedia && 'ondevicechange' in md,
      imageCapture: typeof ImageCapture !== 'undefined',
      createImageBitmap: typeof createImageBitmap === 'function',
      canvas: typeof HTMLCanvasElement !== 'undefined' ||
        (typeof document !== 'undefined' && typeof document.createElement === 'function'),
    };
  }

  // =================== Card 1：BarcodeDetector 能力检测 + getSupportedFormats ===================

  // 检测 typeof BarcodeDetector，并调用静态方法 getSupportedFormats() 列出支持的条码格式
  async _checkBarcodeSupport() {
    const caps = this._caps();
    if (!caps.barcode) {
      this._addLog('warn', 'BarcodeDetector 不可用（typeof BarcodeDetector === "undefined"）');
      this.setState({
        barcodeSupportInfo:
          `typeof BarcodeDetector = "${typeof BarcodeDetector}"\n` +
          `说明：BarcodeDetector 在 jsdom/Node 中未定义；真实浏览器需 Chrome/Edge（部分版本需开启 #enable-experimental-web-platform-features），安全上下文 https/localhost。`,
      });
      return;
    }
    try {
      this._addLog('info', '开始 BarcodeDetector.getSupportedFormats()…');
      // getSupportedFormats() 是静态方法，返回当前浏览器支持的格式子集
      let formats: any[] = [];
      if (caps.barcodeFormats) {
        formats = await BarcodeDetector.getSupportedFormats();
      } else {
        this._addLog('warn', 'BarcodeDetector.getSupportedFormats 不可用（旧版本可能无此静态方法）');
      }
      const unsupported = ALL_BARCODE_FORMATS.filter((f) => !formats.includes(f));
      this.setState({
        barcodeSupportInfo:
          `typeof BarcodeDetector = "${typeof BarcodeDetector}"（构造器可用）\n` +
          `BarcodeDetector.getSupportedFormats() → Promise<string[]>（静态方法）\n` +
          `当前浏览器支持的格式（${formats.length} 项）：${formats.join(', ') || '（空）'}\n` +
          `全部规范格式（${ALL_BARCODE_FORMATS.length} 项）：${ALL_BARCODE_FORMATS.join(', ')}\n` +
          `未支持格式（${unsupported.length} 项）：${unsupported.join(', ') || '（无）'}\n\n` +
          `说明：getSupportedFormats 受浏览器与系统条码识别库影响；iOS Safari 不支持 BarcodeDetector。`,
      });
      this._addLog('info', `getSupportedFormats 返回 ${formats.length} 种格式：${formats.join(', ') || '（空）'}`);
    } catch (err: any) {
      this._addLog('warn', `getSupportedFormats 失败：${err.name} - ${err.message}`);
      this.setState({ barcodeSupportInfo: `getSupportedFormats 失败：${err.name} - ${err.message}` });
    }
  }

  // new BarcodeDetector(options) 构造器：options.formats 指定识别格式白名单
  _createBarcodeDetector(): void {
    const caps = this._caps();
    if (!caps.barcode) {
      this._addLog('warn', 'BarcodeDetector 不可用，无法构造实例');
      return;
    }
    try {
      // 构造时传入 formats 白名单，仅识别这些格式（性能更优）
      // 若不传 formats 则识别所有支持的格式
      const detector = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] });
      this._barcodeDetector = detector;
      this.setState({
        barcodeSupportInfo:
          `new BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] }) ✓\n` +
          `说明：formats 为识别白名单，仅匹配这些格式（性能更优）；不传 formats 则识别所有支持格式。\n` +
          `构造器若传入不支持的格式会抛 DOMException（NotSupportedError）。\n` +
          `后续 detect(imageSource) 将使用此实例。`,
      });
      this._addLog('info', '已构造 BarcodeDetector（formats: qr_code, code_128, ean_13）');
    } catch (err: any) {
      this._addLog('warn', `构造 BarcodeDetector 失败：${err.name} - ${err.message}`);
      this.setState({ barcodeSupportInfo: `构造失败：${err.name} - ${err.message}` });
    }
  }

  _renderCard1(): Node | string {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. BarcodeDetector 能力检测 + getSupportedFormats',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.barcode ? 'success' : 'error' }, caps.barcode ? 'BarcodeDetector ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'qr / ean / code_128'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Barcode Detection API 提供 new BarcodeDetector(options) 构造器，options.formats 指定识别格式白名单；BarcodeDetector.getSupportedFormats() 是静态方法，返回当前浏览器支持的格式（Promise<string[]>）。支持格式包括 qr_code / code_128 / code_39 / ean_13 / ean_8 / upc_a / upc_e / itf / codabar / pdf417 / aztec / data_matrix。用于扫描二维码、商品条码等。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测能力', { type: 'primary', size: 'sm', disabled: !caps.barcode, onClick: () => this._checkBarcodeSupport() }),
          this._btn('构造 Detector', { type: 'primary', size: 'sm', disabled: !caps.barcode, onClick: () => this._createBarcodeDetector() }),
          this._btn('仅检测 typeof', { size: 'sm', onClick: () => this._checkBarcodeSupport() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '能力检测 / 构造结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.barcodeSupportInfo || '（点击「检测能力」或「构造 Detector」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } },
          h('code', {},
`if (typeof BarcodeDetector !== 'undefined') {
  const formats = await BarcodeDetector.getSupportedFormats();
  const detector = new BarcodeDetector({ formats: ['qr_code', 'ean_13'] });
  // 后续调用 detector.detect(imageSource)
} else {
  console.warn('BarcodeDetector 不可用，需 Chromium 系浏览器');
}`)),
        h(Alert, {
          type: 'info',
          message: 'BarcodeDetector 受浏览器与系统条码库影响',
          description: 'Chrome/Edge 在 Android 上原生支持；桌面端部分版本需开启实验标志。iOS Safari 完全不支持。getSupportedFormats 返回的格式子集随系统条码识别库变化。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 2：BarcodeDetector.detect 识别 ===================

  // 创建一个含简单图案的 canvas 作为 imageSource，调用 detect
  // 注：jsdom 中无真实条码识别能力，detect 会失败或返回空；此处演示调用流程与结果读取
  async _detectFromCanvas() {
    const caps = this._caps();
    if (!caps.barcode) {
      this._addLog('warn', 'BarcodeDetector 不可用，detect 无法调用');
      this.setState({
        barcodeDetectInfo:
          `typeof BarcodeDetector = "${typeof BarcodeDetector}"\n` +
          `detect(imageSource) 不可调用（BarcodeDetector 未定义）。\n` +
          `imageSource 可为：ImageBitmap / Blob / ImageData / HTMLImageElement / HTMLCanvasElement / HTMLVideoElement。\n` +
          `说明：在真实浏览器中可传入摄像头帧或图片调用 detect 识别条码。`,
      });
      return;
    }
    let canvas = null;
    try {
      // 构造 imageSource：创建 canvas 并绘制简单图案（非真实条码，仅演示调用流程）
      canvas = (document.createElement('canvas') as any);
      canvas.width = 200;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 200, 200);
      ctx.fillStyle = '#000000';
      // 画几条竖线模拟条码外观（detect 实际不会识别为合法条码）
      for (let i = 0; i < 20; i += 4) ctx.fillRect(i * 4, 20, 2, 160);
      this._addLog('detect', '已构造 canvas imageSource（200x200，含模拟条纹），开始 detect…');
      // 使用已构造的 detector，或临时构造一个（formats 限定 code_128）
      const detector = this._barcodeDetector || new BarcodeDetector({ formats: ['code_128'] });
      if (!this._barcodeDetector) this._barcodeDetector = detector;
      // detect(imageSource) → Promise<DetectedBarcode[]>
      const results = await detector.detect(canvas);
      const detectedText = results.length
        ? results.map((b: any, i: any) =>
            `[${i}] rawValue = "${b.rawValue}"\n` +
            `    boundingBox = { x:${b.boundingBox.x}, y:${b.boundingBox.y}, width:${b.boundingBox.width}, height:${b.boundingBox.height} }\n` +
            `    cornerPoints = ${b.cornerPoints ? b.cornerPoints.length : 0} 个角点`,
          ).join('\n')
        : '（空数组，未识别到任何条码——canvas 画的不是合法条码）';
      this.setState({
        barcodeDetectInfo:
          `detector.detect(canvas) → Promise<DetectedBarcode[]> ✓\n` +
          `imageSource 类型：HTMLCanvasElement（200x200）\n` +
          `识别结果数量：${results.length}\n\n${detectedText}\n\n` +
          `DetectedBarcode 字段：rawValue（解码文本）/ boundingBox（DOMRectReadOnly）/ cornerPoints（{x,y}[] 四角点，顺序：左上、右上、右下、左下）`,
      });
      this._addLog('detect', `detect 完成：识别到 ${results.length} 个条码`);
    } catch (err: any) {
      this._addLog('warn', `detect 失败：${err.name} - ${err.message}`);
      this.setState({ barcodeDetectInfo: `detect 失败：${err.name} - ${err.message}` });
    } finally {
      canvas = null;  // 释放 canvas（无显式 dispose，置空引用）
    }
  }

  // 演示用 createImageBitmap 创建 ImageBitmap 作为 imageSource（jsdom 中 createImageBitmap 可能未定义）
  async _detectFromImageBitmap() {
    const caps = this._caps();
    if (!caps.barcode) {
      this._addLog('warn', 'BarcodeDetector 不可用');
      return;
    }
    if (!caps.createImageBitmap) {
      this._addLog('warn', 'createImageBitmap 不可用，无法构造 ImageBitmap imageSource');
      this.setState({
        barcodeDetectInfo:
          `typeof createImageBitmap = "${typeof createImageBitmap}"\n` +
          `说明：createImageBitmap 在 jsdom 中未实现；真实浏览器中可 createImageBitmap(blob) 得到 ImageBitmap 后传入 detect。\n` +
          `detect 支持的 imageSource 类型：ImageBitmap / Blob / ImageData / HTMLImageElement / HTMLCanvasElement / HTMLVideoElement。`,
      });
      return;
    }
    try {
      this._addLog('detect', '尝试 createImageBitmap + detect 流程演示…');
      // 此处仅展示流程：真实场景需从文件/网络获取含条码的 Blob（测试环境无法构造合法条码图像）
      this.setState({
        barcodeDetectInfo:
          `createImageBitmap(blob) → ImageBitmap，可作为 detect 的 imageSource：\n\n` +
          `// 真实场景示例（本测试环境无法构造合法条码图像）：\n` +
          `const blob = await fetch('barcode.png').then(r => r.blob());\n` +
          `const bitmap = await createImageBitmap(blob);\n` +
          `const detector = new BarcodeDetector({ formats: ['ean_13'] });\n` +
          `const results = await detector.detect(bitmap);\n` +
          `for (const r of results) console.log(r.rawValue, r.boundingBox);\n\n` +
          `说明：detect 对 ImageBitmap / Blob / ImageData / HTMLImageElement / HTMLCanvasElement / HTMLVideoElement 均支持；推荐 ImageBitmap（GPU 友好，性能最佳）。`,
      });
      this._addLog('detect', 'createImageBitmap + detect 流程已记录（测试环境无合法条码图像）');
    } catch (err: any) {
      this._addLog('warn', `流程演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard2(): Node | string {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. BarcodeDetector.detect 识别',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.barcode ? 'success' : 'error' }, caps.barcode ? 'detect ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'canvas / ImageBitmap'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'detector.detect(imageSource) → Promise<DetectedBarcode[]> 识别条码。imageSource 可为 ImageBitmap / Blob / ImageData / HTMLImageElement / HTMLCanvasElement / HTMLVideoElement。DetectedBarcode 含 rawValue（解码文本）、boundingBox（DOMRectReadOnly）、cornerPoints（四个角点 {x,y} 数组）。本卡片构造含模拟条纹的 canvas 作为 imageSource 演示调用流程（实际不会识别为合法条码）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('detect(canvas)', { type: 'primary', size: 'sm', disabled: !caps.barcode, onClick: () => this._detectFromCanvas() }),
          this._btn('detect(ImageBitmap)', { size: 'sm', disabled: !caps.barcode, onClick: () => this._detectFromImageBitmap() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'detect 识别结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.barcodeDetectInfo || '（点击「detect(canvas)」或「detect(ImageBitmap)」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } },
          h('code', {},
`const detector = new BarcodeDetector({ formats: ['qr_code'] });
const results = await detector.detect(videoElement); // 从 video 帧识别（实时扫码）
for (const r of results) {
  console.log(r.rawValue);        // 解码文本
  console.log(r.boundingBox);     // DOMRectReadOnly
  console.log(r.cornerPoints);    // [{x,y}, ...] 四角点
}
// 也可传入 ImageBitmap / Blob / ImageData / HTMLCanvasElement`)),
        h(Alert, {
          type: 'warning',
          message: 'detect 需要合法的条码图像',
          description: '本演示 canvas 画的模拟条纹不是合法条码，detect 返回空数组。真实场景需传入含真实条码/二维码的图像（摄像头帧、图片文件等）。detect 是异步 Promise，需 await。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 3：getDisplayMedia 屏幕共享 ===================

  // 内部辅助：停止屏幕共享 MediaStream 的所有 track
  _stopDisplayStream(): void {
    if (this._displayStream) {
      try { this._displayStream.getTracks().forEach((t: any) => t.stop()); } catch { /* noop */ }
      this._displayStream = null;
      this._displayTrack = null;
    } else if (this._displayTrack) {
      try { this._displayTrack.stop(); } catch { /* noop */ }
      this._displayTrack = null;
    }
  }

  // 检测 getDisplayMedia 能力，说明 options.video / options.audio 用法（不真正调用，避免权限弹窗）
  _checkDisplayMediaSupport(): void {
    const caps = this._caps();
    if (!caps.displayMedia) {
      this._addLog('warn', 'getDisplayMedia 不可用（navigator.mediaDevices.getDisplayMedia 未定义）');
      this.setState({
        displayMediaInfo:
          `typeof navigator.mediaDevices = "${navigator.mediaDevices ? 'object' : 'undefined'}"\n` +
          `typeof navigator.mediaDevices.getDisplayMedia = "${caps.mediaDevices ? typeof (navigator.mediaDevices.getDisplayMedia) : 'undefined'}"\n` +
          `说明：getDisplayMedia 在 jsdom/Node 中不可用；真实浏览器需 https/localhost 安全上下文。\n` +
          `与 getUserMedia 区别：getDisplayMedia 捕获屏幕/窗口/标签页，getUserMedia 捕获摄像头/麦克风。`,
      });
      return;
    }
    this.setState({
      displayMediaInfo:
        `typeof navigator.mediaDevices.getDisplayMedia = "function"（可用）\n` +
        `getDisplayMedia(options) → Promise<MediaStream>，options：\n` +
        `• video：{ cursor: 'always'|'motion'|'hidden', displaySurface: 'monitor'|'window'|'browser' }\n` +
        `• audio：true | { echoCancellation, noiseSuppression, ... }\n\n` +
        `调用流程：\n` +
        `1) const stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' } });\n` +
        `2) const [track] = stream.getVideoTracks();\n` +
        `3) track.getSettings().displaySurface → 'monitor'|'window'|'browser'\n` +
        `4) track.getSettings().cursor → 'always'|'motion'|'hidden'\n` +
        `5) track.applyConstraints({ cursor: 'hidden' }) 动态修改\n` +
        `6) track.onended = () => {} 监听用户在浏览器 UI 停止共享\n` +
        `7) track.stop() 停止共享\n\n说明：本页不真正调用 getDisplayMedia（会触发权限弹窗），仅展示用法。`,
    });
    this._addLog('info', 'getDisplayMedia 可用（本页不真正调用，仅展示用法）');
  }

  // 用 mock track 演示 track.getSettings / applyConstraints / onended 的用法（不真正请求屏幕共享）
  _demoDisplayMediaUsage(): any {
    const caps = this._caps();
    if (!caps.displayMedia) {
      this._addLog('warn', 'getDisplayMedia 不可用，无法演示 track 用法');
      return;
    }
    // 构造 mock video track 演示 getSettings / applyConstraints / onended 的 API 形态
    // 真实场景由 getDisplayMedia 返回的 MediaStream.getVideoTracks()[0] 提供
    const mockTrack = {
      kind: 'video',
      label: 'mock-screen-share',
      getSettings() {
        return { displaySurface: 'monitor', cursor: 'always', width: 1920, height: 1080, frameRate: 30 };
      },
      getCapabilities() {
        return { cursor: ['always', 'motion', 'hidden'], displaySurface: ['monitor', 'window', 'browser'] };
      },
      async applyConstraints(constraints: any) { return Promise.resolve(); },
      onended: null,
      stop() { /* mock */ },
      addEventListener(type: any, handler: any) { if (type === 'ended') this.onended = handler; },
    };
    this._displayTrack = mockTrack;
    // 读取 displaySurface / cursor 设置
    const settings = mockTrack.getSettings();
    const capabilities = mockTrack.getCapabilities();
    // 演示 applyConstraints 动态修改 cursor
    let applyResult = '';
    try {
      mockTrack.applyConstraints({ cursor: 'hidden' });
      applyResult = `track.applyConstraints({ cursor: 'hidden' }) → Promise resolved（动态修改光标显示）`;
    } catch (err: any) { applyResult = `applyConstraints 失败：${err.message}`; }
    // 监听 onended：用户在浏览器 UI 点击「停止共享」时触发
    mockTrack.addEventListener('ended', () => this._addLog('warn', '屏幕共享 track onended 触发：用户在浏览器 UI 停止了共享'));
    this.setState({
      displayMediaInfo:
        `（用 mock track 演示 API 形态，未真正请求屏幕共享）\n\n` +
        `track.getSettings() → MediaTrackSettings：\n` +
        `• displaySurface = "${settings.displaySurface}"（'monitor' | 'window' | 'browser'）\n` +
        `• cursor = "${settings.cursor}"（'always' | 'motion' | 'hidden'）\n` +
        `• width = ${settings.width}, height = ${settings.height}, frameRate = ${settings.frameRate}\n\n` +
        `track.getCapabilities() → MediaTrackCapabilities：\n` +
        `• cursor = [${capabilities.cursor.join(', ')}] / displaySurface = [${capabilities.displaySurface.join(', ')}]\n\n` +
        `${applyResult}\n\n` +
        `track.onended 已注册：用户在浏览器 UI 停止共享时触发回调。\n` +
        `track.stop() 停止共享并释放资源（componentWillUnmount 时调用）。`,
    });
    this._addLog('info', `mock track 演示：displaySurface=${settings.displaySurface}, cursor=${settings.cursor}`);
  }

  // 演示停止屏幕共享（调用 track.stop）
  _stopDisplayShare(): void {
    if (!this._displayTrack) {
      this._addLog('warn', '当前无屏幕共享 track（请先点击「演示 track 用法」）');
      return;
    }
    this._stopDisplayStream();
    this._addLog('info', '已调用 track.stop() 停止屏幕共享（mock track）');
    this.setState({ displayMediaInfo: '已调用 track.stop() 停止屏幕共享。\n说明：真实场景下 stop() 后 MediaStream 结束，video 元素 srcObject 应置空。' });
  }

  _renderCard3(): Node | string {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. getDisplayMedia 屏幕共享',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.displayMedia ? 'success' : 'error' }, caps.displayMedia ? 'getDisplayMedia ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'displaySurface / cursor'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'navigator.mediaDevices.getDisplayMedia(options) → Promise<MediaStream> 请求屏幕共享，需用户授权（权限弹窗）。options.video 可指定 cursor（always/motion/hidden）与 displaySurface（monitor/window/browser）。返回的 MediaStream 视频 track 支持 getSettings().displaySurface / cursor、applyConstraints({cursor}) 动态修改、onended 监听用户在浏览器 UI 停止共享、stop() 停止。本页不真正调用 getDisplayMedia（避免权限弹窗），仅展示用法与 mock track 演示。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测能力', { type: 'primary', size: 'sm', disabled: !caps.displayMedia, onClick: () => this._checkDisplayMediaSupport() }),
          this._btn('演示 track 用法', { type: 'primary', size: 'sm', disabled: !caps.displayMedia, onClick: () => this._demoDisplayMediaUsage() }),
          this._btn('停止共享', { danger: true, size: 'sm', disabled: !caps.displayMedia, onClick: () => this._stopDisplayShare() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '屏幕共享状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.displayMediaInfo || '（点击「检测能力」或「演示 track 用法」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`const stream = await navigator.mediaDevices.getDisplayMedia({
  video: { cursor: 'always', displaySurface: 'monitor' }, audio: false,
});
const [track] = stream.getVideoTracks();
console.log(track.getSettings().displaySurface); // 'monitor'|'window'|'browser'
console.log(track.getSettings().cursor);          // 'always'|'motion'|'hidden'
await track.applyConstraints({ cursor: 'hidden' }); // 动态改光标
track.onended = () => console.log('用户停止共享');
// track.stop(); 停止共享`)),
        h(Alert, {
          type: 'warning',
          message: 'getDisplayMedia 会触发权限弹窗',
          description: '本页不真正调用 getDisplayMedia，避免在自动化测试中弹出权限对话框。真实场景需用户在浏览器 UI 选择共享的屏幕/窗口/标签页并授权。与 getUserMedia 区别：getDisplayMedia 捕获屏幕，getUserMedia 捕获摄像头/麦克风。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 4：ImageCapture 拍照 ===================

  // 内部辅助：停止摄像头 track（用于 componentWillUnmount）
  _stopCameraTrack(): void {
    if (this._cameraTrack) {
      try { this._cameraTrack.stop(); } catch { /* noop */ }
      this._cameraTrack = null;
    }
  }

  // 检测 ImageCapture 能力，说明构造器与 takePhoto/getPhotoCapabilities/grabFrame 用法
  _checkImageCaptureSupport(): void {
    const caps = this._caps();
    if (!caps.imageCapture) {
      this._addLog('warn', 'ImageCapture 不可用（typeof ImageCapture === "undefined"）');
      this.setState({
        imageCaptureInfo:
          `typeof ImageCapture = "${typeof ImageCapture}"\n` +
          `说明：ImageCapture 在 jsdom/Node 中未定义；真实浏览器需 Chromium 系（Chrome/Edge）。\n` +
          `构造器：new ImageCapture(videoTrack)（videoTrack 来自 getUserMedia 返回的 MediaStream）。\n` +
          `方法：takePhoto(options) → Promise<Blob>、getPhotoCapabilities() → Promise<PhotoCapabilities>、getPhotoSettings() → Promise<PhotoSettings>、grabFrame() → Promise<ImageBitmap>。`,
      });
      return;
    }
    this.setState({
      imageCaptureInfo:
        `typeof ImageCapture = "${typeof ImageCapture}"（构造器可用）\n` +
        `new ImageCapture(videoTrack) 构造器（videoTrack 来自 getUserMedia 返回的 MediaStream）\n\n` +
        `方法：\n` +
        `• takePhoto(options) → Promise<Blob>（options: imageWidth/imageHeight/redEyeReduction/fillLightMode）\n` +
        `• getPhotoCapabilities() → Promise<PhotoCapabilities>（redEyeReduction/imageWidth{min,max,step,current}/imageHeight/fillLightMode）\n` +
        `• getPhotoSettings() → Promise<PhotoSettings>（当前拍照设置）\n` +
        `• grabFrame() → Promise<ImageBitmap>（快速抓取未编码的帧，比 takePhoto 快）\n\n说明：本页不真正调用 getUserMedia（避免权限弹窗），仅展示用法。`,
    });
    this._addLog('info', 'ImageCapture 可用（本页不真正调用 getUserMedia，仅展示用法）');
  }

  // 用 mock track 演示 ImageCapture 的 takePhoto / getPhotoCapabilities / grabFrame 调用形态
  async _demoImageCaptureUsage() {
    const caps = this._caps();
    if (!caps.imageCapture) {
      this._addLog('warn', 'ImageCapture 不可用，无法演示');
      return;
    }
    try {
      this._addLog('info', '演示 ImageCapture 用法（mock track，未真正调用 getUserMedia）…');
      // 构造 mock video track 演示 ImageCapture 构造与调用形态
      // 真实场景：getUserMedia({video:true}) → getVideoTracks()[0] → new ImageCapture(track)
      const mockTrack = {
        kind: 'video', label: 'mock-camera',
        getSettings() { return { width: 1280, height: 720, frameRate: 30 }; },
        getCapabilities() { return { torch: true, zoom: { min: 100, max: 400, step: 10 } }; },
        stop() { /* mock */ },
      };
      this._cameraTrack = mockTrack;
      // 构造 ImageCapture 实例（mock track 可能不被真实 ImageCapture 接受，故 try/catch）
      let imageCapture = null, constructLine = '';
      try {
        imageCapture = new ImageCapture((mockTrack as any));
        this._imageCapture = imageCapture;
        constructLine = `new ImageCapture(mockTrack as any) ✓ 构造成功`;
      } catch (err: any) {
        constructLine = `new ImageCapture(mockTrack as any) 失败：${err.name} - ${err.message}（mock track 不被接受，需 getUserMedia 返回的 track）`;
      }

      // 演示 getPhotoCapabilities 调用形态
      let capsLine = '';
      if (imageCapture && typeof imageCapture.getPhotoCapabilities === 'function') {
        try {
          const photoCaps = await imageCapture.getPhotoCapabilities();
          capsLine = `getPhotoCapabilities() → PhotoCapabilities ✓\n` +
            `  redEyeReduction = ${photoCaps.redEyeReduction}\n` +
            `  imageWidth = ${JSON.stringify(photoCaps.imageWidth)} / imageHeight = ${JSON.stringify(photoCaps.imageHeight)}（{ min, max, step, current }）\n` +
            `  fillLightMode = ${JSON.stringify(photoCaps.fillLightMode)}`;
        } catch (err: any) {
          capsLine = `getPhotoCapabilities 失败：${err.name} - ${err.message}（mock track 无法提供真实能力）`;
        }
      } else { capsLine = `getPhotoCapabilities 不可调用（构造失败或方法不存在）`; }

      this.setState({
        imageCaptureInfo:
          `（mock track 演示 ImageCapture 调用形态，未真正调用 getUserMedia）\n\n` +
          `${constructLine}\n\n${capsLine}\n\n` +
          `takePhoto(options) → Promise<Blob>（拍照）：options 含 imageWidth / imageHeight / redEyeReduction / fillLightMode\n` +
          `  const blob = await imageCapture.takePhoto({ imageWidth: 1920, imageHeight: 1080 });\n` +
          `  const url = URL.createObjectURL(blob); // 转 DataURL 显示\n\n` +
          `grabFrame() → Promise<ImageBitmap>（快速抓帧，未编码，比 takePhoto 快，适合实时取景）\n` +
          `说明：真实场景需 getUserMedia 获取 videoTrack；本页不真正调用以避免权限弹窗。`,
      });
      this._addLog('info', `ImageCapture 演示完成：${constructLine}`);
    } catch (err: any) {
      this._addLog('warn', `ImageCapture 演示失败：${err.name} - ${err.message}`);
      this.setState({ imageCaptureInfo: `演示失败：${err.name} - ${err.message}` });
    }
  }

  _renderCard4(): Node | string {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. ImageCapture 拍照',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.imageCapture ? 'success' : 'error' }, caps.imageCapture ? 'ImageCapture ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'takePhoto / grabFrame'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'ImageCapture API 提供 new ImageCapture(videoTrack) 构造器（videoTrack 来自 getUserMedia）。takePhoto(options) → Promise<Blob> 拍照（options: imageWidth/imageHeight/redEyeReduction/fillLightMode）；getPhotoCapabilities() → Promise<PhotoCapabilities> 读取能力（redEyeReduction/imageWidth{min,max,step,current}/imageHeight/fillLightMode）；getPhotoSettings() 读取当前设置；grabFrame() → Promise<ImageBitmap> 快速抓帧（比 takePhoto 快，无编码开销）。本页不真正调用 getUserMedia（避免权限弹窗），用 mock track 演示调用形态。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测能力', { type: 'primary', size: 'sm', disabled: !caps.imageCapture, onClick: () => this._checkImageCaptureSupport() }),
          this._btn('演示拍照流程', { type: 'primary', size: 'sm', disabled: !caps.imageCapture, onClick: () => this._demoImageCaptureUsage() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'ImageCapture 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, s.imageCaptureInfo || '（点击「检测能力」或「演示拍照流程」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`const stream = await navigator.mediaDevices.getUserMedia({ video: true });
const [track] = stream.getVideoTracks();
const imageCapture = new ImageCapture(track);
const caps = await imageCapture.getPhotoCapabilities(); // { min, max, step, current }
const blob = await imageCapture.takePhoto({
  imageWidth: 1920, imageHeight: 1080, redEyeReduction: true, fillLightMode: 'auto',
});
const url = URL.createObjectURL(blob);              // 显示照片
const bitmap = await imageCapture.grabFrame();      // 快速抓帧`)),
        h(Alert, {
          type: 'info',
          message: 'grabFrame 与 takePhoto 的区别',
          description: 'grabFrame() 返回 ImageBitmap，是未编码的原始帧，速度快但无元数据；takePhoto() 返回 Blob（JPEG），含 EXIF 等元数据，可设置分辨率与闪光灯。实时取景用 grabFrame，保存照片用 takePhoto。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 5：MediaTrack capabilities/settings/applyConstraints ===================

  // 演示 track.getCapabilities / getSettings / applyConstraints / onmute / clone（用 mock track）
  _demoTrackCapabilities(): any {
    const caps = this._caps();
    if (!caps.userMedia) {
      this._addLog('warn', 'getUserMedia 不可用，无法获取真实 track 演示 capabilities');
      this.setState({
        trackCapabilityInfo:
          `typeof navigator.mediaDevices.getUserMedia = "${caps.mediaDevices ? typeof (navigator.mediaDevices.getUserMedia) : 'undefined'}"\n` +
          `说明：getUserMedia 在 jsdom/Node 中不可用；真实浏览器需 https/localhost + 真实摄像头设备。\n\n` +
          `MediaStreamTrack 高级能力（需真实 track）：\n` +
          `• track.getCapabilities() → MediaTrackCapabilities（pan/tilt/zoom/torch 等）\n` +
          `• track.getSettings() → MediaTrackSettings（当前实际值）\n` +
          `• track.applyConstraints({ advanced: [{ zoom: 200, torch: true }] }) 动态修改\n` +
          `• track.onmute / onunmute 事件（设备被占用/释放）/ track.clone() 克隆 track`,
      });
      return;
    }
    // 构造 mock video track 演示 getCapabilities/getSettings/applyConstraints 的 API 形态
    // 真实场景由 getUserMedia 返回的 MediaStream.getVideoTracks()[0] 提供
    const mockTrack = {
      kind: 'video',
      label: 'mock-camera',
      // getCapabilities 返回支持的能力范围（PTZ 摄像头才有 pan/tilt/zoom/torch）
      getCapabilities() {
        return {
          pan: { min: 0, max: 360, step: 1 }, tilt: { min: -45, max: 45, step: 1 },
          zoom: { min: 100, max: 400, step: 10 }, torch: true,
          width: { min: 320, max: 3840, step: 1 }, height: { min: 240, max: 2160, step: 1 },
          frameRate: { min: 1, max: 60, step: 1 }, aspectRatio: { min: 1, max: 2 },
          facingMode: ['user', 'environment'], resizeMode: ['none', 'crop-and-scale'],
          whiteBalanceMode: ['none', 'manual', 'continuous'],
          exposureMode: ['none', 'manual', 'continuous'],
          focusMode: ['none', 'manual', 'continuous'],
        };
      },
      // getSettings 返回当前实际值
      getSettings() {
        return {
          pan: 180, tilt: 0, zoom: 150, torch: false, width: 1280, height: 720, frameRate: 30,
          facingMode: 'user', resizeMode: 'none',
          whiteBalanceMode: 'continuous', exposureMode: 'continuous', focusMode: 'continuous',
        };
      },
      // applyConstraints 动态修改约束（如改 zoom/torch）
      async applyConstraints(constraints: any) { return Promise.resolve(); },
      onmute: null, onunmute: null,
      clone() { return { ...this, label: 'mock-camera-clone' }; },
      stop() { /* mock */ },
      addEventListener(type: any, handler: any) {
        if (type === 'mute') this.onmute = handler;
        if (type === 'unmute') this.onunmute = handler;
      },
    };
    this._cameraTrack = mockTrack;
    const capabilities = mockTrack.getCapabilities();
    const settings = mockTrack.getSettings();
    // 演示 applyConstraints 修改 zoom 与 torch
    let applyResult = '';
    try {
      mockTrack.applyConstraints({ advanced: [{ zoom: 200, torch: true }] }); // advanced 数组传递多个约束
      applyResult = `track.applyConstraints({ advanced: [{ zoom: 200, torch: true }] }) → Promise resolved ✓`;
    } catch (err: any) {
      applyResult = `applyConstraints 失败：${err.message}`;
    }
    // 演示 onmute / onunmute 事件
    mockTrack.addEventListener('mute', () => this._addLog('warn', 'track.onmute 触发：摄像头被其他应用占用或不可用'));
    mockTrack.addEventListener('unmute', () => this._addLog('info', 'track.onunmute 触发：摄像头恢复可用'));
    // 演示 clone
    const cloned = mockTrack.clone();
    this.setState({
      trackCapabilityInfo:
        `（mock track 演示 MediaStreamTrack 高级能力，未真正调用 getUserMedia）\n\n` +
        `track.getCapabilities() → MediaTrackCapabilities（能力范围）：\n` +
        `• pan = ${JSON.stringify(capabilities.pan)}（水平转动,度）/ tilt = ${JSON.stringify(capabilities.tilt)}（垂直俯仰,度）\n` +
        `• zoom = ${JSON.stringify(capabilities.zoom)}（缩放,百分比）/ torch = ${capabilities.torch}（手电筒）/ facingMode = [${capabilities.facingMode.join(', ')}]\n` +
        `• whiteBalanceMode = [${capabilities.whiteBalanceMode.join(', ')}] / exposureMode = [${capabilities.exposureMode.join(', ')}] / focusMode = [${capabilities.focusMode.join(', ')}]\n\n` +
        `track.getSettings() → MediaTrackSettings（当前值）：\n` +
        `• pan=${settings.pan}, tilt=${settings.tilt}, zoom=${settings.zoom}, torch=${settings.torch}\n` +
        `• width=${settings.width}, height=${settings.height}, frameRate=${settings.frameRate}, facingMode="${settings.facingMode}", resizeMode="${settings.resizeMode}"\n\n` +
        `${applyResult}\n\n` +
        `track.onmute / onunmute 已注册（设备被占用/恢复时触发）\n` +
        `track.clone() → 新 track（label="${cloned.label}"，独立实例可独立停止）\n\n` +
        `说明：PTZ（云台）能力 pan/tilt/zoom/torch 仅高端摄像头支持；普通摄像头 getCapabilities 不含这些字段。`,
    });
    this._addLog('info', `mock track 演示：zoom=${settings.zoom}, torch=${settings.torch}, clone label="${cloned.label}"`);
  }

  _renderCard5(): Node | string {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. MediaTrack capabilities/settings/applyConstraints',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.userMedia ? 'success' : 'error' }, caps.userMedia ? 'getUserMedia ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'pan / tilt / zoom / torch'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'MediaStreamTrack 高级能力：track.getCapabilities() → MediaTrackCapabilities（pan/tilt/zoom/torch 等 PTZ 能力，仅高端摄像头支持）；track.getSettings() → MediaTrackSettings（当前实际值）；track.applyConstraints({ advanced: [{ zoom, torch }] }) 动态修改；track.onmute / onunmute 事件（设备被占用/恢复）；track.clone() 克隆 track。本页用 mock track 演示 API 形态（不真正调用 getUserMedia）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('演示 track 能力', { type: 'primary', size: 'sm', disabled: !caps.userMedia, onClick: () => this._demoTrackCapabilities() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'MediaTrack 能力 / 设置：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, s.trackCapabilityInfo || '（点击「演示 track 能力」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`const stream = await navigator.mediaDevices.getUserMedia({ video: true });
const [track] = stream.getVideoTracks();
const caps = track.getCapabilities();      // 支持的能力范围
if (caps.zoom) await track.applyConstraints({ advanced: [{ zoom: 300 }] });
if (caps.torch) await track.applyConstraints({ advanced: [{ torch: true }] }); // 开手电筒
const settings = track.getSettings();      // 当前实际值
track.onmute = () => console.log('设备被占用');
const cloned = track.clone();              // 克隆独立 track`)),
        h(Alert, {
          type: 'info',
          message: 'PTZ 能力需要硬件支持',
          description: 'pan/tilt/zoom/torch 仅高端 PTZ 摄像头支持，普通笔记本摄像头 getCapabilities 不含这些字段。applyConstraints 修改不支持的约束会被忽略或抛 OverconstrainedError。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 6：enumerateDevices + getSupportedConstraints ===================

  // 演示 enumerateDevices / getSupportedConstraints / ondevicechange（不真正调用以避免权限提示）
  async _demoEnumerateDevices() {
    const caps = this._caps();
    if (!caps.enumerate) {
      this._addLog('warn', 'enumerateDevices 不可用');
      this.setState({
        devicesInfo:
          `typeof navigator.mediaDevices.enumerateDevices = "${caps.mediaDevices ? typeof (navigator.mediaDevices.enumerateDevices) : 'undefined'}"\n` +
          `说明：enumerateDevices 在 jsdom/Node 中不可用；真实浏览器需 https/localhost 安全上下文。\n` +
          `返回 MediaDeviceInfo[]：deviceId / kind('videoinput'|'audioinput'|'audiooutput') / label / groupId。未授权前 label 为空字符串，授权后才有可读 label。`,
      });
      return;
    }
    try {
      this._addLog('info', '开始 navigator.mediaDevices.enumerateDevices()…');
      // enumerateDevices 返回所有媒体设备（未授权前 label 为空）
      const devices = await navigator.mediaDevices.enumerateDevices();
      const byKind: any = { videoinput: [], audioinput: [], audiooutput: [] };
      for (const d of devices) if (byKind[d.kind]) byKind[d.kind].push(d);
      const devicesText = devices.length
        ? devices.map((d, i) =>
            `[${i}] kind="${d.kind}" label="${d.label || '（空，未授权）'}" ` +
            `deviceId="${d.deviceId ? d.deviceId.slice(0, 8) + '...' : '（空）'}" groupId="${d.groupId ? d.groupId.slice(0, 8) + '...' : '（空）'}"`,
          ).join('\n')
        : '（空数组，无设备或未授权）';
      // 演示 getSupportedConstraints
      let constraintsText = '';
      if (caps.supportedConstraints) {
        const supported = navigator.mediaDevices.getSupportedConstraints();
        const keys = (Object as any).keys(supported).filter((k: any) => ((supported as any)[(k as any)]));
        constraintsText = `getSupportedConstraints() → MediaTrackSupportedConstraints（${keys.length} 项为 true）：${keys.join(', ')}`;
      } else {
        constraintsText = 'getSupportedConstraints 不可用';
      }
      // 演示 ondevicechange 事件（设备插拔时触发）
      if (caps.onDeviceChange && !this._deviceChangeHandler) {
        this._deviceChangeHandler = () => this._addLog('warn', 'navigator.mediaDevices.ondevicechange 触发：设备发生插拔变化');
        navigator.mediaDevices.addEventListener('devicechange', this._deviceChangeHandler);
      }
      this.setState({
        devicesInfo:
          `navigator.mediaDevices.enumerateDevices() → Promise<MediaDeviceInfo[]>（${devices.length} 个设备）\n\n` +
          `设备列表：\n${devicesText}\n\n` +
          `按 kind 统计：videoinput（摄像头）${byKind.videoinput.length} / audioinput（麦克风）${byKind.audioinput.length} / audiooutput（扬声器）${byKind.audiooutput.length}\n\n` +
          `${constraintsText}\n\n` +
          `ondevicechange 监听：${caps.onDeviceChange ? '已注册（设备插拔时触发回调）' : '不可用'}\n` +
          `说明：未授权前 label 为空；授权（getUserMedia）后才有可读 label。getSupportedConstraints 返回浏览器支持的约束键（值全为 true）。`,
      });
      this._addLog('info', `enumerateDevices 返回 ${devices.length} 个设备（video=${byKind.videoinput.length}, audio_in=${byKind.audioinput.length}, audio_out=${byKind.audiooutput.length}）`);
    } catch (err: any) {
      this._addLog('warn', `enumerateDevices 失败：${err.name} - ${err.message}`);
      this.setState({ devicesInfo: `enumerateDevices 失败：${err.name} - ${err.message}` });
    }
  }

  _renderCard6(): Node | string {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. enumerateDevices + getSupportedConstraints',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.enumerate ? 'success' : 'error' }, caps.enumerate ? 'enumerate ✓' : '不可用'),
        h(Tag, { color: caps.onDeviceChange ? 'success' : 'error' }, caps.onDeviceChange ? 'ondevicechange ✓' : 'ondevicechange ✗'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'navigator.mediaDevices.enumerateDevices() → Promise<MediaDeviceInfo[]> 枚举所有媒体设备，MediaDeviceInfo 含 deviceId / kind（videoinput|audioinput|audiooutput）/ label / groupId。getSupportedConstraints() → MediaTrackSupportedConstraints 返回浏览器支持的约束键（值全为 true）。ondevicechange 事件在设备插拔时触发。未授权 getUserMedia 前 label 为空字符串。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('枚举设备', { type: 'primary', size: 'sm', disabled: !caps.enumerate, onClick: () => this._demoEnumerateDevices() }),
          this._btn('仅检测 typeof', { size: 'sm', disabled: !caps.enumerate, onClick: () => this._demoEnumerateDevices() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '设备枚举结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, s.devicesInfo || '（点击「枚举设备」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`const devices = await navigator.mediaDevices.enumerateDevices();
for (const d of devices) console.log(d.kind, d.label, d.deviceId, d.groupId);
// kind: 'videoinput' | 'audioinput' | 'audiooutput'

const supported = navigator.mediaDevices.getSupportedConstraints();
console.log(supported.zoom, supported.torch, supported.facingMode);

navigator.mediaDevices.addEventListener('devicechange', async () => {
  const fresh = await navigator.mediaDevices.enumerateDevices();
  console.log('设备变化', fresh);
});`)),
        h(Alert, {
          type: 'info',
          message: '未授权前 label 为空',
          description: 'enumerateDevices 在用户授权 getUserMedia 之前返回的 MediaDeviceInfo.label 为空字符串（隐私保护）。授权后才有可读 label。getSupportedConstraints 不需要授权，可在任何时候调用。ondevicechange 只通知"有变化"，需重新 enumerateDevices 获取最新列表。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== 日志面板 ===================

  _renderLogPanel(): Node | string {
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

  render(): Node {
    const s = this.state;
    return h('div', { class: 'page api-lab-page' },
      h('h2', { class: 'section-title' }, '条码识别 / 屏幕共享 / 图像捕获 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页演示 Barcode Detection API（BarcodeDetector）、Screen Capture API（getDisplayMedia）、ImageCapture API（takePhoto/grabFrame）、MediaStreamTrack 高级能力（PTZ/torch）、MediaDevices 设备枚举。所有 API 调用前做 typeof 能力检测，jsdom 不可用时仅记日志说明。'),
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
