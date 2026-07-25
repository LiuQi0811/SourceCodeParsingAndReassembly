// =====================================================================
// CSSVisualEffectsPage.js —— CSS 视觉效果与合成 实验室
// 演示 MDN CSS 视觉效果与合成特性：
//   1. aspect-ratio —— 16 / 9 / 1 / auto 16 / 9，维持元素宽高比，响应式布局
//      避免高度塌陷，与 width/height 协同自动计算高度，vs padding-top hack
//      （56.25% = 16:9），auto 优先使用固有尺寸（图片原始宽高比），
//      响应式视频容器、卡片网格保持统一比例
//   2. object-fit 与 object-position —— fill|contain|cover|none|scale-down
//      替换元素内容适配方式（fill 拉伸 / contain 留白 / cover 裁剪 /
//      none 原始 / scale-down 取较小者），object-position 内容定位，
//      vs background-size，头像裁剪（cover + object-position: center top）
//   3. CSS Shapes —— shape-outside: circle()|ellipse()|polygon()|inset()|
//      url(image.png) 文字环绕自定义形状，shape-margin 形状外边距，
//      shape-image-threshold 0-1 基于 alpha 通道阈值，仅对浮动元素生效，
//      圆形头像 + 文字环绕
//   4. mix-blend-mode 与 isolation —— 16 种混合模式（normal|multiply|screen|
//      overlay|darken|lighten|color-dodge|color-burn|hard-light|soft-light|
//      difference|exclusion|hue|saturation|color|luminosity），isolation:
//      isolate 创建独立合成层隔离混合范围（防泄漏到祖先），vs
//      background-blend-mode，文字叠加图片 difference 反色
//   5. will-change 与 GPU 合成层 —— will-change: transform|opacity|
//      scroll-position|contents 提示浏览器提前优化，触发 GPU 合成层的属性
//      （transform/opacity/filter/will-change），合成层优势（GPU 加速、
//      独立线程绘制），滥用警告（合成层爆炸、内存激增），will-change:auto
//      移除提示，动画结束后应重置，vs transform: translateZ(0) hack
//   6. filter 与 backdrop-filter —— blur|brightness|contrast|grayscale|
//      hue-rotate|invert|opacity|saturate|sepia|drop-shadow 元素滤镜，
//      多滤镜组合（filter: blur(2px) brightness(1.2) contrast(1.1)），
//      backdrop-filter 毛玻璃效果，backdrop-filter vs filter，
//      drop-shadow() vs box-shadow（drop-shadow 跟随实际形状含透明区域）
// 说明：所有特性调用前做 typeof / CSS.supports 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。jsdom 不做真实 CSS 渲染，但
//       CSS.supports 通常可用；aspect-ratio / shape-outside / backdrop-filter /
//       will-change / filter 等较新属性 jsdom 可能不识别，统一 try/catch 兜底。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// 替换元素演示图（240x140 横向 SVG，data URI，无网络依赖）—— object-fit/filter 演示用
const DEMO_IMG = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="240" height="140" viewBox="0 0 240 140"%3E%3Crect width="240" height="140" fill="%234a90d9"/%3E%3Ccircle cx="70" cy="70" r="40" fill="%23ec4899"/%3E%3Crect x="140" y="20" width="80" height="100" fill="%23f59e0b"/%3E%3Ctext x="120" y="132" text-anchor="middle" fill="%23fff" font-size="14" font-family="sans-serif"%3E240x140%3C/text%3E%3C/svg%3E';

export class CSSVisualEffectsPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      // Card 1：aspect-ratio 宽高比
      aspectRatio: '16 / 9',
      aspectRatioIndex: 0,
      aspectRatioInfo: '',
      // Card 2：object-fit 与 object-position
      objectFit: 'cover',
      objectFitIndex: 0,
      objectPosition: '50% 50%',
      objectPositionIndex: 0,
      objectFitInfo: '',
      // Card 3：CSS Shapes
      shape: 'circle(50%)',
      shapeKind: 'circle',
      shapeIndex: 0,
      shapeMargin: 8,
      shapeThreshold: 0.5,
      shapesInfo: '',
      // Card 4：mix-blend-mode 与 isolation
      blendMode: 'normal',
      blendModeIndex: 0,
      isolationOn: false,
      blendModeInfo: '',
      // Card 5：will-change 与 GPU 合成层
      willChangeOn: false,
      animating: false,
      willChangeInfo: '',
      // Card 6：filter 与 backdrop-filter
      filter: 'blur(5px)',
      filterIndex: 0,
      combineFilters: false,
      backdropFilterOn: true,
      filterInfo: '',
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    this._injectedStyles = [];

    // —— 能力检测（全部用 try/catch，避免 jsdom 抛异常）——
    const caps = this._caps();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `CSS ${c(caps.css)}`, `supports ${c(caps.supports)}`,
      `aspect-ratio ${c(caps.aspectRatio)}`,
      `object-fit ${c(caps.objectFit)}`, `object-position ${c(caps.objectPosition)}`,
      `shape-outside ${c(caps.shapeOutside)}`, `shape-margin ${c(caps.shapeMargin)}`,
      `shape-image-threshold ${c(caps.shapeImageThreshold)}`,
      `mix-blend-mode ${c(caps.mixBlendMode)}`, `isolation ${c(caps.isolation)}`,
      `background-blend-mode ${c(caps.backgroundBlendMode)}`,
      `will-change ${c(caps.willChange)}`,
      `filter ${c(caps.filter)}`, `backdrop-filter ${c(caps.backdropFilter)}`,
      `drop-shadow ${c(caps.dropShadow)}`,
    ];

    const summary = caps.css
      ? `CSS 视觉效果与合成特性能力检测：${parts.join(' · ')}。jsdom 不做真实 CSS 渲染，但 CSS.supports 通常可用；aspect-ratio / shape-outside / backdrop-filter / will-change / filter 等部分属性 jsdom 可能不识别，按钮将仅记日志说明。在真实浏览器中打开可完整演示视觉效果。`
      : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示视觉效果。';

    this.setState({
      capsSummary: summary,
      logs: [...this.state.logs, { type: 'info', content: `能力检测：${parts.join('，')}`, time: formatTime() }].slice(-40),
    });

    if (!caps.aspectRatio) this._addLog('warn', 'aspect-ratio: 16/9 不可用或 jsdom 未识别（Chrome 88+ / Firefox 89+ / Safari 15+）');
    if (!caps.shapeOutside) this._addLog('warn', 'shape-outside: circle(50%) 不可用或 jsdom 未识别（Chrome 37+ / Firefox 62+ / Safari 11.1+）');
    if (!caps.backdropFilter) this._addLog('warn', 'backdrop-filter: blur(10px) 不可用或 jsdom 未识别（Chrome 76+ / Safari 9+ -webkit- / Firefox 103+）');
    if (!caps.willChange) this._addLog('warn', 'will-change: transform 不可用或 jsdom 未识别（Chrome 36+ / Firefox 36+ / Safari 9.1+）');

    // —— 注入演示 CSS（仅一次；style 元素在 <head> 中，rerender 不会移除）——
    this._injectDemoStyles();
  }

  componentWillUnmount() {
    // 清理：移除所有注入的 <style> 元素
    if (Array.isArray(this._injectedStyles)) {
      this._injectedStyles.forEach((el) => el?.remove());
      this._injectedStyles = [];
    }
  }

  // —— 日志 / 按钮辅助 ——

  _addLog(type, content) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // —— 注入一个 <style>，跟踪到 this._injectedStyles ——
  _injectStyle(id, textContent) {
    // 若已存在同 id 的 style（rerender 后再次注入），先移除旧引用
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = textContent;
    document.head.appendChild(style);
    this._injectedStyles.push(style);
    return style;
  }

  // —— 能力检测：返回布尔能力对象（无参，唯一 _caps 定义，避免重名报错）——
  _caps() {
    const hasCSS = typeof CSS !== 'undefined';
    const supportsPV = (p, v) => {
      try { return hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v); }
      catch { return false; }
    };
    return {
      css: hasCSS,
      supports: hasCSS && typeof CSS.supports === 'function',
      aspectRatio: supportsPV('aspect-ratio', '16 / 9'),
      aspectRatioAuto: supportsPV('aspect-ratio', 'auto 16 / 9'),
      objectFit: supportsPV('object-fit', 'cover'),
      objectFitFill: supportsPV('object-fit', 'fill'),
      objectFitContain: supportsPV('object-fit', 'contain'),
      objectFitNone: supportsPV('object-fit', 'none'),
      objectFitScaleDown: supportsPV('object-fit', 'scale-down'),
      objectPosition: supportsPV('object-position', '50% 50%'),
      shapeOutside: supportsPV('shape-outside', 'circle(50%)'),
      shapeOutsidePolygon: supportsPV('shape-outside', 'polygon(0 0, 100% 50%, 50% 100%, 0 50%)'),
      shapeOutsideEllipse: supportsPV('shape-outside', 'ellipse(50% 50%)'),
      shapeOutsideInset: supportsPV('shape-outside', 'inset(10% round 50%)'),
      shapeMargin: supportsPV('shape-margin', '10px'),
      shapeImageThreshold: supportsPV('shape-image-threshold', '0.5'),
      mixBlendMode: supportsPV('mix-blend-mode', 'difference'),
      mixBlendModeMultiply: supportsPV('mix-blend-mode', 'multiply'),
      isolation: supportsPV('isolation', 'isolate'),
      backgroundBlendMode: supportsPV('background-blend-mode', 'multiply'),
      willChange: supportsPV('will-change', 'transform'),
      willChangeOpacity: supportsPV('will-change', 'opacity'),
      willChangeScroll: supportsPV('will-change', 'scroll-position'),
      willChangeContents: supportsPV('will-change', 'contents'),
      filter: supportsPV('filter', 'blur(5px)'),
      filterBlur: supportsPV('filter', 'blur(5px)'),
      filterBrightness: supportsPV('filter', 'brightness(1.5)'),
      filterGrayscale: supportsPV('filter', 'grayscale(1)'),
      filterHueRotate: supportsPV('filter', 'hue-rotate(90deg)'),
      backdropFilter: supportsPV('backdrop-filter', 'blur(10px)') || supportsPV('-webkit-backdrop-filter', 'blur(10px)'),
      dropShadow: supportsPV('filter', 'drop-shadow(4px 4px 4px red)'),
    };
  }

  // —— 渲染 Tag 列表：items = [[label, ok], ...]，展示能力状态（✓/✗）——
  _capTags(items) {
    return items.map(([label, ok]) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  // —— 注入全部演示样式（aspect-ratio / object-fit / shapes /
  //    mix-blend-mode / will-change / filter / backdrop-filter）——
  _injectDemoStyles() {
    this._injectStyle('css-visual-effects-demo', `
      /* ===== Card 1: aspect-ratio ===== */
      .ve-ar-box {
        background: linear-gradient(135deg, #4a90d9, #8b5cf6);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        font-size: 14px;
        font-weight: bold;
        width: 100%;
        max-width: 360px;
      }
      .ve-ar-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin-top: 8px;
        max-width: 360px;
      }
      .ve-ar-grid > div {
        background: linear-gradient(135deg, #10b981, #06b6d4);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
        padding: 4px;
        text-align: center;
      }
      .ve-ar-padhack {
        width: 100%;
        max-width: 360px;
        position: relative;
        height: 0;
        padding-top: 56.25%;
        background: linear-gradient(135deg, #f59e0b, #ef4444);
        border-radius: 6px;
      }
      .ve-ar-padhack-inner {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 14px;
        font-weight: bold;
      }

      /* ===== Card 2: object-fit / object-position ===== */
      .ve-of-stage {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 8px;
      }
      .ve-of-cell {
        width: 140px;
        height: 140px;
        border: 2px solid #ccc;
        border-radius: 6px;
        overflow: hidden;
        position: relative;
        background: #f5f5f5;
      }
      .ve-of-cell .label {
        position: absolute;
        bottom: 0; left: 0; right: 0;
        background: rgba(0,0,0,.6);
        color: #fff;
        font-size: 11px;
        padding: 2px 4px;
        text-align: center;
        z-index: 2;
      }
      .ve-of-img {
        width: 100%;
        height: 100%;
        display: block;
      }
      .ve-of-img.fill { object-fit: fill; }
      .ve-of-img.contain { object-fit: contain; }
      .ve-of-img.cover { object-fit: cover; }
      .ve-of-img.none { object-fit: none; }
      .ve-of-img.scale-down { object-fit: scale-down; }
      .ve-of-img.pos-tl { object-position: left top; }
      .ve-of-img.pos-tr { object-position: right top; }
      .ve-of-img.pos-c { object-position: center center; }
      .ve-of-img.pos-cb { object-position: center bottom; }

      /* ===== Card 3: CSS Shapes ===== */
      .ve-shape-stage {
        overflow: hidden;
        border: 1px solid #ccc;
        border-radius: 6px;
        padding: 12px;
        background: #fff;
        min-height: 180px;
        margin-top: 8px;
      }
      .ve-shape-float {
        float: left;
        width: 100px;
        height: 100px;
        margin: 0 12px 12px 0;
        background: linear-gradient(135deg, #8b5cf6, #ec4899);
        border-radius: 50%;
        shape-outside: circle(50%);
        shape-margin: 8px;
      }
      .ve-shape-float.polygon {
        shape-outside: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
        clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
        border-radius: 0;
        background: linear-gradient(135deg, #ef4444, #f59e0b);
      }
      .ve-shape-float.none {
        shape-outside: none;
        shape-margin: 0;
      }
      .ve-shape-float.ellipse {
        shape-outside: ellipse(50% 50%);
        border-radius: 50%;
      }
      .ve-shape-stage p {
        margin: 0 0 4px 0;
        font-size: 13px;
        line-height: 1.7;
        color: #333;
      }

      /* ===== Card 4: mix-blend-mode / isolation ===== */
      .ve-blend-stage {
        position: relative;
        width: 100%;
        max-width: 360px;
        height: 140px;
        border-radius: 6px;
        overflow: hidden;
        margin-top: 8px;
        background: linear-gradient(135deg, #4a90d9 0%, #10b981 50%, #f59e0b 100%);
      }
      .ve-blend-stage.isolated { isolation: isolate; }
      .ve-blend-text {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 28px;
        font-weight: bold;
        color: #ffffff;
        mix-blend-mode: difference;
        white-space: nowrap;
      }
      .ve-blend-layers {
        position: relative;
        width: 100%;
        max-width: 360px;
        height: 80px;
        border-radius: 6px;
        overflow: hidden;
        margin-top: 8px;
      }
      .ve-blend-layers .bg1 {
        position: absolute; inset: 0;
        background: linear-gradient(90deg, #ff4d4f, #722ed1);
      }
      .ve-blend-layers .bg2 {
        position: absolute; inset: 0;
        background: radial-gradient(circle, #52c41a 0%, transparent 70%);
        mix-blend-mode: screen;
      }

      /* ===== Card 5: will-change / GPU 合成层 ===== */
      .ve-wc-stage {
        position: relative;
        width: 100%;
        max-width: 360px;
        height: 100px;
        border: 1px dashed #ccc;
        border-radius: 6px;
        margin-top: 8px;
        overflow: hidden;
      }
      .ve-wc-box {
        position: absolute;
        top: 30px;
        left: 10px;
        width: 60px;
        height: 40px;
        background: linear-gradient(135deg, #4a90d9, #8b5cf6);
        border-radius: 4px;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: bold;
        transition: transform 0.6s ease;
      }
      .ve-wc-box.animating { transform: translateX(280px) rotate(180deg); }
      .ve-wc-box.willchange { will-change: transform; }

      /* ===== Card 6: filter / backdrop-filter ===== */
      .ve-filter-stage {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 8px;
      }
      .ve-filter-cell {
        width: 120px;
        text-align: center;
      }
      .ve-filter-cell .img-wrap {
        width: 120px;
        height: 80px;
        border-radius: 6px;
        overflow: hidden;
        background: #f5f5f5;
      }
      .ve-filter-cell .img-wrap img {
        width: 100%; height: 100%; object-fit: cover; display: block;
      }
      .ve-filter-cell .label {
        font-size: 11px;
        color: #666;
        margin-top: 4px;
      }
      .ve-bd-stage {
        position: relative;
        width: 100%;
        max-width: 360px;
        height: 120px;
        border-radius: 8px;
        overflow: hidden;
        margin-top: 8px;
        background: linear-gradient(135deg, #ff4d4f 0%, #722ed1 50%, #52c41a 100%);
      }
      .ve-bd-panel {
        position: absolute;
        top: 20px; left: 20px; right: 20px;
        height: 50px;
        background: rgba(255,255,255,.25);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,.4);
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: bold;
        text-shadow: 0 1px 2px rgba(0,0,0,.3);
      }
      .ve-bd-panel.off {
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
      }
      /* drop-shadow vs box-shadow */
      .ve-shadow-stage {
        display: flex;
        gap: 24px;
        flex-wrap: wrap;
        margin-top: 8px;
        align-items: center;
      }
      .ve-shadow-cell {
        text-align: center;
      }
      .ve-shadow-icon {
        width: 100px;
        height: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f5f5f5;
        border-radius: 6px;
      }
      .ve-shadow-star {
        width: 60px;
        height: 60px;
        background: #f59e0b;
        clip-path: polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
      }
      .ve-shadow-star.box-shadow { box-shadow: 4px 6px 8px rgba(0,0,0,.5); }
      .ve-shadow-star.drop-shadow { filter: drop-shadow(4px 6px 4px rgba(0,0,0,.5)); }
      .ve-shadow-cell .label {
        font-size: 11px;
        color: #666;
        margin-top: 6px;
      }
    `);
  }

  // ============================================================
  // Card 1: aspect-ratio 宽高比
  // ============================================================

  _toggleAspectRatio() {
    const ratios = ['16 / 9', '1 / 1', '4 / 3', '21 / 9', 'auto 16 / 9', '1.5'];
    const idx = (this.state.aspectRatioIndex + 1) % ratios.length;
    const next = ratios[idx];
    this.setState({ aspectRatio: next, aspectRatioIndex: idx });
    this._addLog('info', `aspect-ratio 切换 → "${next}"（${idx + 1}/${ratios.length}）。width:100% + aspect-ratio 自动计算高度，响应式布局无需 height。`);
  }

  _readAspectRatioInfo() {
    const caps = this._caps();
    try {
      const box = this.el && this.el.querySelector('.ve-ar-box');
      let arComputed = '(未渲染)';
      let boxSize = '(未测量)';
      if (box) {
        arComputed = window.getComputedStyle(box).getPropertyValue('aspect-ratio') || '(空)';
        boxSize = `${box.clientWidth}x${box.clientHeight}px`;
      }
      this.setState({ aspectRatioInfo:
        'aspect-ratio 宽高比演示：\n' +
        `  .ve-ar-box { width: 100%; aspect-ratio: ${this.state.aspectRatio}; }\n` +
        `  aspect-ratio 计算值="${arComputed}"\n` +
        `  实际渲染尺寸=${boxSize}\n` +
        `  CSS.supports('aspect-ratio','16 / 9') = ${caps.aspectRatio}\n` +
        `  CSS.supports('aspect-ratio','auto 16 / 9') = ${caps.aspectRatioAuto}\n\n` +
        '说明：\n' +
        '  aspect-ratio: 16 / 9 —— 维持宽高比，width 变化时高度按比例自动计算\n' +
        '  aspect-ratio: 1 —— 正方形（1:1），常用头像、图标占位\n' +
        '  aspect-ratio: auto 16 / 9 —— auto 优先使用固有尺寸（如图片原始宽高比），\n' +
        '    无固有尺寸时回退到 16 / 9\n' +
        '  aspect-ratio: 1.5 —— 也支持纯数字（= 1.5 / 1）\n\n' +
        'vs padding-top hack：\n' +
        '  padding-top: 56.25% （= 9/16 * 100%）实现 16:9，但需绝对定位子元素，\n' +
        '  内容布局受影响；aspect-ratio 更直观、内容正常流式布局。\n\n' +
        '实战：\n' +
        '  响应式视频容器（16:9）、卡片网格统一比例、骨架屏占位避免高度塌陷。\n' +
        '  Chrome 88+ / Firefox 89+ / Safari 15+ 支持。' });
      this._addLog('info', `读取 aspect-ratio 计算值="${arComputed}"，尺寸=${boxSize}，支持=${caps.aspectRatio}`);
    } catch (err) {
      this._addLog('warn', `读取 aspect-ratio 失败：${err.name} - ${err.message}`);
    }
  }

  _renderAspectRatioCard() {
    const s = this.state;
    const caps = this._caps();
    return h(Card, {
      title: '1. aspect-ratio 宽高比',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._capTags([['aspect-ratio', caps.aspectRatio], ['auto', caps.aspectRatioAuto]]),
        h(Tag, { color: 'primary' }, '16/9 · 1 · auto'),
      ),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'aspect-ratio 维持元素宽高比，width 变化时高度按比例自动计算，响应式布局避免高度塌陷。值支持 "16 / 9"（比例）、"1"（正方形，等价 1/1）、"auto 16 / 9"（auto 优先使用固有尺寸如图片原始宽高比，无固有尺寸时回退）。vs padding-top: 56.25% hack：aspect-ratio 更直观，不影响内容布局。实战：响应式视频容器、卡片网格统一比例、骨架屏占位。'),
      !caps.aspectRatio && h(Alert, {
        type: 'warning',
        message: '当前浏览器不支持 aspect-ratio',
        description: 'CSS.supports("aspect-ratio", "16 / 9") 返回 false。Chrome 88+ / Firefox 89+ / Safari 15+ 支持。jsdom 不渲染 CSS，下方演示需在真实浏览器查看效果，但能力检测与代码展示正常。',
      }),
      h('div', { class: 'flex gap-sm mt-sm flex-wrap' },
        this._btn(`切换宽高比（当前：${s.aspectRatio}）`, {
          type: 'primary', size: 'sm',
          disabled: !caps.css,
          onClick: () => this._toggleAspectRatio(),
        }),
        this._btn('读取计算值', {
          size: 'sm',
          disabled: !caps.css,
          onClick: () => this._readAspectRatioInfo(),
        }),
      ),
      h('div', { class: 'fs-sm text-secondary mt-sm' }, `aspect-ratio: ${s.aspectRatio} 的演示框（width:100% 自动算高度）：`),
      h('div', { class: 've-ar-box', style: { aspectRatio: s.aspectRatio } },
        `aspect-ratio: ${s.aspectRatio}`),
      h('div', { class: 'fs-sm text-secondary mt-sm' }, '卡片网格统一比例（每个 div: aspect-ratio: 4/3）：'),
      h('div', { class: 've-ar-grid' },
        h('div', { style: { aspectRatio: '4 / 3' } }, '4:3'),
        h('div', { style: { aspectRatio: '4 / 3' } }, '4:3'),
        h('div', { style: { aspectRatio: '4 / 3' } }, '4:3'),
      ),
      h('div', { class: 'fs-sm text-secondary mt-sm' }, 'padding-top: 56.25% hack（= 9/16 * 100%，16:9；需绝对定位子元素）：'),
      h('div', { class: 've-ar-padhack' },
        h('div', { class: 've-ar-padhack-inner' }, 'padding-top: 56.25% hack')),
      h('pre', { class: 'code-block mt-sm', style: { maxHeight: '260px', overflow: 'auto' } },
        h('code', {}, s.aspectRatioInfo || '（点击「读取计算值」查看 aspect-ratio 计算值与说明）')),
      h('pre', { class: 'code-block mt-sm' }, `/* aspect-ratio —— 维持宽高比 */
.video-box {
  width: 100%;
  aspect-ratio: 16 / 9;     /* width 变化时高度自动 = width * 9/16 */
}
.avatar {
  width: 80px;
  aspect-ratio: 1;          /* 正方形 1:1 */
}
img.responsive {
  aspect-ratio: auto 16 / 9;/* 优先用图片原始宽高比，无固有尺寸时回退 16:9 */
}

/* vs padding-top hack（旧方案） */
.hack-16-9 {
  width: 100%;
  height: 0;
  padding-top: 56.25%;      /* = 9 / 16 * 100% */
  position: relative;       /* 子元素需绝对定位 */
}
.hack-16-9 > .content {
  position: absolute;
  inset: 0;
}`),
    );
  }

  // ============================================================
  // Card 2: object-fit 与 object-position
  // ============================================================

  _toggleObjectFit() {
    const fits = ['fill', 'contain', 'cover', 'none', 'scale-down'];
    const idx = (this.state.objectFitIndex + 1) % fits.length;
    const next = fits[idx];
    this.setState({ objectFit: next, objectFitIndex: idx });
    const desc = {
      fill: '拉伸填满（变形）',
      contain: '完整显示（留白）',
      cover: '填满裁剪（常用封面）',
      none: '原始尺寸（不缩放）',
      'scale-down': '取 none 或 contain 中较小者',
    }[next];
    this._addLog('info', `object-fit 切换 → "${next}"（${desc}）。仅作用于替换元素 img/video/iframe 内容。`);
  }

  _toggleObjectPosition() {
    const positions = ['50% 50%', 'left top', 'right top', 'center bottom', 'left center', '25% 75%'];
    const idx = (this.state.objectPositionIndex + 1) % positions.length;
    const next = positions[idx];
    this.setState({ objectPosition: next, objectPositionIndex: idx });
    this._addLog('info', `object-position 切换 → "${next}"。控制替换元素内容在容器内的定位点（配合 cover 裁剪可见区域）。`);
  }

  _readObjectFitInfo() {
    const caps = this._caps();
    try {
      const cell = this.el && this.el.querySelector('.ve-of-cell');
      let ofComputed = '(未渲染)';
      let opComputed = '(未渲染)';
      if (cell) {
        const img = cell.querySelector('.ve-of-img');
        if (img) {
          ofComputed = window.getComputedStyle(img).getPropertyValue('object-fit') || '(空)';
          opComputed = window.getComputedStyle(img).getPropertyValue('object-position') || '(空)';
        }
      }
      this.setState({ objectFitInfo:
        'object-fit / object-position 演示：\n' +
        `  当前 object-fit="${this.state.objectFit}"，object-position="${this.state.objectPosition}"\n` +
        `  object-fit 计算值="${ofComputed}"\n` +
        `  object-position 计算值="${opComputed}"\n` +
        `  CSS.supports('object-fit','cover') = ${caps.objectFit}\n` +
        `  CSS.supports('object-position','50% 50%') = ${caps.objectPosition}\n\n` +
        'object-fit: fill|contain|cover|none|scale-down：\n' +
        '  fill —— 拉伸填满容器（变形，不保持比例）\n' +
        '  contain —— 完整显示（保持比例，可能留白）\n' +
        '  cover —— 填满裁剪（保持比例，常用封面/头像）\n' +
        '  none —— 原始尺寸（不缩放，可能溢出或留白）\n' +
        '  scale-down —— 取 none 或 contain 中尺寸较小者（不放大）\n\n' +
        'object-position: <x> <y>：内容在容器内的定位点\n' +
        '  支持 % / 关键字（left|center|right / top|center|bottom）/ 长度\n' +
        '  配合 cover 时控制裁剪可见区域（如 center top 显示头部）\n\n' +
        'vs background-size：\n' +
        '  object-fit 用于 <img>/<video>/<iframe> 替换元素的内容适配\n' +
        '  background-size 用于背景图（background-image），不影响元素内容\n\n' +
        '实战：\n' +
        '  头像裁剪（object-fit: cover + object-position: center top 显示头部）\n' +
        '  视频适配容器、产品图统一比例展示。全平台浏览器支持。' });
      this._addLog('info', `读取 object-fit="${ofComputed}"，object-position="${opComputed}"，支持=${caps.objectFit}`);
    } catch (err) {
      this._addLog('warn', `读取 object-fit 失败：${err.name} - ${err.message}`);
    }
  }

  _renderObjectFitCard() {
    const s = this.state;
    const caps = this._caps();
    const fits = ['fill', 'contain', 'cover', 'none', 'scale-down'];
    return h(Card, {
      title: '2. object-fit 与 object-position',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._capTags([['object-fit', caps.objectFit], ['object-position', caps.objectPosition]]),
        h(Tag, { color: 'primary' }, 'fill · contain · cover'),
      ),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'object-fit: fill|contain|cover|none|scale-down 控制替换元素（img/video/iframe）内容适配方式：fill 拉伸变形、contain 完整显示留白、cover 填满裁剪（常用封面）、none 原始尺寸、scale-down 取 none/contain 较小者。object-position: 50% 50%|left top|center bottom 控制内容定位点。vs background-size：object-fit 用于 img/video 内容，background-size 用于背景图。实战：头像裁剪（cover + center top 显示头部）。全平台浏览器支持。'),
      !caps.objectFit && h(Alert, {
        type: 'warning',
        message: '当前浏览器不支持 object-fit',
        description: 'CSS.supports("object-fit", "cover") 返回 false。object-fit 全平台支持，jsdom 不渲染图片，下方演示需在真实浏览器查看裁剪效果。',
      }),
      h('div', { class: 'flex gap-sm mt-sm flex-wrap' },
        this._btn(`切换 object-fit（当前：${s.objectFit}）`, {
          type: 'primary', size: 'sm',
          disabled: !caps.css,
          onClick: () => this._toggleObjectFit(),
        }),
        this._btn(`切换 object-position（当前：${s.objectPosition}）`, {
          size: 'sm',
          disabled: !caps.css,
          onClick: () => this._toggleObjectPosition(),
        }),
        this._btn('读取计算值', {
          size: 'sm',
          disabled: !caps.css,
          onClick: () => this._readObjectFitInfo(),
        }),
      ),
      h('div', { class: 'fs-sm text-secondary mt-sm' }, `5 种 object-fit 对比（容器 140x140，图片 240x140 横向；当前演示框：object-fit=${s.objectFit}, object-position=${s.objectPosition}）：`),
      h('div', { class: 've-of-stage' },
        ...fits.map((fit) => h('div', { class: 've-of-cell' },
          h('img', { class: `ve-of-img ${fit}`, src: DEMO_IMG, alt: fit }),
          h('div', { class: 'label' }, fit),
        )),
      ),
      h('div', { class: 'fs-sm text-secondary mt-sm' }, `当前演示框（object-fit: ${s.objectFit}; object-position: ${s.objectPosition}）：`),
      h('div', { class: 've-of-cell', style: { width: '180px', height: '180px', display: 'inline-block' } },
        h('img', {
          class: `ve-of-img ${s.objectFit}`,
          src: DEMO_IMG,
          alt: 'demo',
          style: { objectPosition: s.objectPosition },
        }),
        h('div', { class: 'label' }, `${s.objectFit} / ${s.objectPosition}`),
      ),
      h('pre', { class: 'code-block mt-sm', style: { maxHeight: '260px', overflow: 'auto' } },
        h('code', {}, s.objectFitInfo || '（点击「读取计算值」查看 object-fit/object-position 计算值与说明）')),
      h('pre', { class: 'code-block mt-sm' }, `/* object-fit —— 替换元素内容适配 */
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;          /* 填满裁剪，保持比例 */
  object-position: center top;/* 显示头部（裁剪底部） */
}
.gallery img { object-fit: contain; }  /* 完整显示，留白 */

/* 5 种值对比 */
img.fill       { object-fit: fill; }       /* 拉伸变形 */
img.contain    { object-fit: contain; }    /* 完整留白 */
img.cover      { object-fit: cover; }      /* 填满裁剪 */
img.none       { object-fit: none; }       /* 原始尺寸 */
img.scale-down { object-fit: scale-down; } /* none/contain 较小者 */

/* vs background-size（背景图） */
.bg-box {
  background-image: url(cover.jpg);
  background-size: cover;     /* 背景图适配，非替换元素 */
  background-position: center;
}`),
    );
  }

  // ============================================================
  // Card 3: CSS Shapes（shape-outside / shape-margin / shape-image-threshold）
  // ============================================================

  _toggleShape() {
    const shapes = [
      { kind: 'circle', value: 'circle(50%)' },
      { kind: 'polygon', value: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)' },
      { kind: 'ellipse', value: 'ellipse(50% 50%)' },
      { kind: 'none', value: 'none' },
    ];
    const idx = (this.state.shapeIndex + 1) % shapes.length;
    const next = shapes[idx];
    this.setState({
      shape: next.value,
      shapeKind: next.kind,
      shapeIndex: idx,
    });
    this._addLog('info', `shape-outside 切换 → "${next.value}"（${next.kind}）。仅对浮动元素（float: left/right）生效，文字会环绕形状外轮廓。`);
  }

  _changeShapeMargin(delta) {
    const next = Math.max(0, Math.min(40, this.state.shapeMargin + delta));
    this.setState({ shapeMargin: next });
    this._addLog('info', `shape-margin 调整 → ${next}px（形状外边距，文字与形状保持距离）。`);
  }

  _changeShapeThreshold(delta) {
    const next = Math.max(0, Math.min(1, +(this.state.shapeThreshold + delta).toFixed(2)));
    this.setState({ shapeThreshold: next });
    this._addLog('info', `shape-image-threshold 调整 → ${next}（基于图片 alpha 通道的阈值 0-1，配合 shape-outside: url() 使用）。`);
  }

  _readShapesInfo() {
    const caps = this._caps();
    try {
      const stage = this.el && this.el.querySelector('.ve-shape-stage');
      let soComputed = '(未渲染)';
      let smComputed = '(未渲染)';
      if (stage) {
        const float = stage.querySelector('.ve-shape-float');
        if (float) {
          soComputed = window.getComputedStyle(float).getPropertyValue('shape-outside') || '(空)';
          smComputed = window.getComputedStyle(float).getPropertyValue('shape-margin') || '(空)';
        }
      }
      this.setState({ shapesInfo:
        'CSS Shapes 演示：\n' +
        `  .ve-shape-float { float: left; shape-outside: ${this.state.shape}; shape-margin: ${this.state.shapeMargin}px; }\n` +
        `  shape-outside 计算值="${soComputed}"\n` +
        `  shape-margin 计算值="${smComputed}"\n` +
        `  CSS.supports('shape-outside','circle(50%)') = ${caps.shapeOutside}\n` +
        `  polygon 支持 = ${caps.shapeOutsidePolygon}；ellipse 支持 = ${caps.shapeOutsideEllipse}\n` +
        `  shape-margin 支持 = ${caps.shapeMargin}；shape-image-threshold 支持 = ${caps.shapeImageThreshold}\n\n` +
        '说明：\n' +
        '  shape-outside: circle()|ellipse()|polygon()|inset()|url(image.png)\n' +
        '    定义浮动元素的外轮廓，文字会环绕该轮廓（而非矩形边框）\n' +
        '    circle(50%) = 圆形；polygon() = 多边形；inset() = 内缩矩形（可圆角）\n' +
        '    url(image.png) = 基于图片 alpha 通道的形状（配合 shape-image-threshold）\n' +
        '  shape-margin: <length> —— 形状外边距，文字与形状保持距离\n' +
        '  shape-image-threshold: 0-1 —— 基于 url() 图片 alpha 通道的阈值\n' +
        '    0 = 完全透明区域才环绕；1 = 完全不透明也环绕；0.5 = 半透明阈值\n\n' +
        '重要约束：\n' +
        '  shape-outside 仅对浮动元素（float: left/right）生效！\n' +
        '  元素需有明确的宽高，否则形状无意义。\n\n' +
        '实战：\n' +
        '  圆形头像 + 文字环绕（shape-outside: circle(50%) + float: left）\n' +
        '  不规则图片文字环绕（shape-outside: url(img.png) + shape-image-threshold）\n' +
        '  Chrome 37+ / Firefox 62+ / Safari 11.1+ 支持（全平台但使用率低）。' });
      this._addLog('info', `读取 shape-outside="${soComputed}"，shape-margin="${smComputed}"，支持=${caps.shapeOutside}`);
    } catch (err) {
      this._addLog('warn', `读取 shape 信息失败：${err.name} - ${err.message}`);
    }
  }

  _renderShapesCard() {
    const s = this.state;
    const caps = this._caps();
    return h(Card, {
      title: '3. CSS Shapes（shape-outside / shape-margin / shape-image-threshold）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._capTags([['shape-outside', caps.shapeOutside], ['shape-margin', caps.shapeMargin], ['shape-image-threshold', caps.shapeImageThreshold]]),
        h(Tag, { color: 'primary' }, 'float 元素'),
      ),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'CSS Shapes 让文字环绕自定义形状而非矩形：shape-outside: circle()|ellipse()|polygon()|inset()|url(image.png) 定义浮动元素外轮廓，文字环绕该轮廓。shape-margin 控制文字与形状的距离，shape-image-threshold (0-1) 基于 url() 图片 alpha 通道决定环绕区域。重要约束：shape-outside 仅对浮动元素（float: left/right）生效。实战：圆形头像 + 文字环绕、不规则图片文字环绕。Chrome 37+ / Firefox 62+ / Safari 11.1+ 支持。'),
      !caps.shapeOutside && h(Alert, {
        type: 'warning',
        message: '当前浏览器不支持 shape-outside',
        description: 'CSS.supports("shape-outside", "circle(50%)") 返回 false。Chrome 37+ / Firefox 62+ / Safari 11.1+ 支持（全平台但使用率低）。jsdom 不渲染 CSS，文字环绕效果需在真实浏览器查看。',
      }),
      h('div', { class: 'flex gap-sm mt-sm flex-wrap' },
        this._btn(`切换 shape-outside（当前：${s.shapeKind}）`, {
          type: 'primary', size: 'sm',
          disabled: !caps.css,
          onClick: () => this._toggleShape(),
        }),
        this._btn('shape-margin +4', {
          size: 'sm',
          disabled: !caps.shapeMargin,
          onClick: () => this._changeShapeMargin(4),
        }),
        this._btn('shape-margin -4', {
          size: 'sm',
          disabled: !caps.shapeMargin,
          onClick: () => this._changeShapeMargin(-4),
        }),
        this._btn('threshold +0.1', {
          size: 'sm',
          disabled: !caps.shapeImageThreshold,
          onClick: () => this._changeShapeThreshold(0.1),
        }),
        this._btn('读取计算值', {
          size: 'sm',
          disabled: !caps.css,
          onClick: () => this._readShapesInfo(),
        }),
      ),
      h('div', { class: 'fs-sm text-secondary mt-sm' }, `浮动元素 + shape-outside: ${s.shape}（shape-margin: ${s.shapeMargin}px）—— 真实浏览器中右侧文字会环绕形状轮廓：`),
      h('div', { class: 've-shape-stage' },
        h('div', {
          class: `ve-shape-float ${s.shapeKind}`,
          style: { shapeMargin: `${s.shapeMargin}px` },
        }, ''),
        h('p', {}, '这段文字会环绕左侧浮动元素的形状轮廓（而非矩形边框）。在真实浏览器中可见：圆形时文字贴合圆弧，菱形（polygon）时文字贴合菱形边，none 时回退为矩形环绕。'),
        h('p', {}, 'shape-outside 仅对 float: left/right 的元素生效。元素需要有明确的宽高，shape-outside 定义其外轮廓，浏览器据此计算文字可流入的区域。'),
        h('p', {}, `当前形状：${s.shape}，shape-margin: ${s.shapeMargin}px（文字与形状保持距离）。shape-image-threshold: ${s.shapeThreshold}（配合 url() 图片使用，基于 alpha 通道阈值决定环绕区域）。`),
        h('p', {}, 'polygon() 用顶点坐标定义多边形（如菱形 polygon(50% 0, 100% 50%, 50% 100%, 0 50%)）；url(image.png) 基于图片不透明区域生成形状，配合 shape-image-threshold 控制灵敏度。'),
      ),
      h('pre', { class: 'code-block mt-sm', style: { maxHeight: '260px', overflow: 'auto' } },
        h('code', {}, s.shapesInfo || '（点击「读取计算值」查看 shape-outside 计算值与说明）')),
      h('pre', { class: 'code-block mt-sm' }, `/* CSS Shapes —— 文字环绕自定义形状 */
.avatar-wrap {
  float: left;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  shape-outside: circle(50%);  /* 圆形轮廓 */
  shape-margin: 8px;           /* 文字与形状保持 8px 距离 */
  margin: 0 12px 12px 0;
}
.text { /* 自动环绕 .avatar-wrap 的圆形轮廓 */ }

/* 多边形（菱形） */
.diamond {
  float: left;
  shape-outside: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
}

/* 基于图片 alpha 通道的形状 */
.leaf {
  float: left;
  shape-outside: url(leaf.png);
  shape-image-threshold: 0.5;  /* 半透明阈值，0-1 */
}

/* inset() 内缩矩形（可圆角） */
.inset-shape {
  float: left;
  shape-outside: inset(10% round 50%);
}

/* 约束：仅 float 元素生效！ */
.shape-elem { float: left; shape-outside: circle(50%); }`),
    );
  }

  // ============================================================
  // Card 4: mix-blend-mode 与 isolation
  // ============================================================

  _toggleBlendMode() {
    const modes = [
      'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
      'color-dodge', 'color-burn', 'hard-light', 'soft-light',
      'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
    ];
    const idx = (this.state.blendModeIndex + 1) % modes.length;
    const next = modes[idx];
    this.setState({ blendMode: next, blendModeIndex: idx });
    this._addLog('info', `mix-blend-mode 切换 → "${next}"（${idx + 1}/16）。元素内容与下层背景混合。isolation:isolate 可隔离混合范围。`);
  }

  _toggleIsolation() {
    const next = !this.state.isolationOn;
    this.setState({ isolationOn: next });
    this._addLog('info', `isolation ${next ? '开启' : '关闭'} → ${next ? 'isolate（创建独立合成层，混合不泄漏到祖先）' : 'auto（默认，混合可影响祖先层）'}。`);
  }

  _readBlendModeInfo() {
    const caps = this._caps();
    try {
      const stage = this.el && this.el.querySelector('.ve-blend-stage');
      let mbmComputed = '(未渲染)';
      let isoComputed = '(未渲染)';
      if (stage) {
        const text = stage.querySelector('.ve-blend-text');
        if (text) mbmComputed = window.getComputedStyle(text).getPropertyValue('mix-blend-mode') || '(空)';
        isoComputed = window.getComputedStyle(stage).getPropertyValue('isolation') || '(空)';
      }
      this.setState({ blendModeInfo:
        'mix-blend-mode / isolation 演示：\n' +
        `  当前 mix-blend-mode="${this.state.blendMode}"，isolation="${this.state.isolationOn ? 'isolate' : 'auto'}"\n` +
        `  mix-blend-mode 计算值="${mbmComputed}"\n` +
        `  isolation 计算值="${isoComputed}"\n` +
        `  CSS.supports('mix-blend-mode','difference') = ${caps.mixBlendMode}\n` +
        `  CSS.supports('isolation','isolate') = ${caps.isolation}\n` +
        `  background-blend-mode 支持 = ${caps.backgroundBlendMode}\n\n` +
        '16 种混合模式（mix-blend-mode）：\n' +
        '  normal（默认，不混合）\n' +
        '  multiply（正片叠底，变暗）/ screen（滤色，变亮）/ overlay（叠加）\n' +
        '  darken（变暗）/ lighten（变亮）\n' +
        '  color-dodge（颜色减淡）/ color-burn（颜色加深）\n' +
        '  hard-light（强光）/ soft-light（柔光）\n' +
        '  difference（差值，反相效果）/ exclusion（排除）\n' +
        '  hue（色相）/ saturation（饱和度）/ color（颜色）/ luminosity（明度）\n\n' +
        'isolation: isolate：\n' +
        '  创建独立合成层，隔离 mix-blend-mode 的混合范围\n' +
        '  防止子元素混合泄漏到祖先层（混合只在隔离层内生效）\n\n' +
        'vs background-blend-mode：\n' +
        '  mix-blend-mode 混合元素与下层背景（跨元素）\n' +
        '  background-blend-mode 混合元素自身的多层背景（background-image 之间）\n\n' +
        '实战：\n' +
        '  文字叠加图片（difference 反色高对比）、颜色滤镜效果、\n' +
        '  模态框内混合不泄漏（isolation:isolate）。全平台浏览器支持。' });
      this._addLog('info', `读取 mix-blend-mode="${mbmComputed}"，isolation="${isoComputed}"，支持=${caps.mixBlendMode}`);
    } catch (err) {
      this._addLog('warn', `读取混合模式失败：${err.name} - ${err.message}`);
    }
  }

  _renderBlendModeCard() {
    const s = this.state;
    const caps = this._caps();
    const allModes = [
      'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
      'color-dodge', 'color-burn', 'hard-light', 'soft-light',
      'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
    ];
    return h(Card, {
      title: '4. mix-blend-mode 与 isolation（混合模式与隔离）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._capTags([['mix-blend-mode', caps.mixBlendMode], ['isolation', caps.isolation], ['background-blend-mode', caps.backgroundBlendMode]]),
        h(Tag, { color: 'primary' }, '16 种模式'),
      ),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'mix-blend-mode 让元素内容与下层背景混合，共 16 种模式（normal/multiply/screen/overlay/darken/lighten/color-dodge/color-burn/hard-light/soft-light/difference/exclusion/hue/saturation/color/luminosity）。isolation:isolate 创建独立合成层隔离混合范围，防止混合泄漏到祖先。vs background-blend-mode：mix-blend-mode 混合元素与背景（跨元素），background-blend-mode 混合元素自身多层背景。实战：文字叠加图片 difference 反色、颜色滤镜。全平台浏览器支持。'),
      !caps.mixBlendMode && h(Alert, {
        type: 'warning',
        message: '当前浏览器不支持 mix-blend-mode',
        description: 'CSS.supports("mix-blend-mode", "difference") 返回 false。mix-blend-mode 全平台支持，jsdom 不渲染混合效果，下方演示需在真实浏览器查看。',
      }),
      h('div', { class: 'flex gap-sm mt-sm flex-wrap' },
        this._btn(`切换混合模式（当前：${s.blendMode}）`, {
          type: 'primary', size: 'sm',
          disabled: !caps.css,
          onClick: () => this._toggleBlendMode(),
        }),
        this._btn(`isolation ${s.isolationOn ? '关闭' : '开启'}（当前：${s.isolationOn ? 'isolate' : 'auto'}）`, {
          size: 'sm',
          disabled: !caps.isolation,
          onClick: () => this._toggleIsolation(),
        }),
        this._btn('读取计算值', {
          size: 'sm',
          disabled: !caps.css,
          onClick: () => this._readBlendModeInfo(),
        }),
      ),
      h('div', { class: 'fs-sm text-secondary mt-sm' }, `mix-blend-mode: ${s.blendMode} 文字（${s.isolationOn ? '父容器已 isolate 隔离' : '父容器未隔离'}）—— 真实浏览器可见混合效果：`),
      h('div', { class: `ve-blend-stage${s.isolationOn ? ' isolated' : ''}` },
        h('div', { class: 've-blend-text', style: { mixBlendMode: s.blendMode } }, `MIX ${s.blendMode.toUpperCase()}`),
      ),
      h('div', { class: 'fs-sm text-secondary mt-sm' }, 'background-blend-mode: screen（多层背景混合，区别于 mix-blend-mode 跨元素）：'),
      h('div', { class: 've-blend-layers' },
        h('div', { class: 'bg1' }, ''),
        h('div', { class: 'bg2' }, ''),
      ),
      h('div', { class: 'fs-sm text-tertiary mt-sm' },
        `16 种模式：${allModes.join(' / ')}。点击「切换混合模式」循环演示。isolation:isolate 防止混合泄漏到祖先层（如模态框内混合不影响背景页面）。`),
      h('pre', { class: 'code-block mt-sm', style: { maxHeight: '260px', overflow: 'auto' } },
        h('code', {}, s.blendModeInfo || '（点击「读取计算值」查看 mix-blend-mode/isolation 计算值与说明）')),
      h('pre', { class: 'code-block mt-sm' }, `/* mix-blend-mode —— 元素与下层背景混合 */
.text-overlay {
  mix-blend-mode: difference;  /* 反色高对比，文字始终可见 */
  color: #fff;
}
.card:hover .badge { mix-blend-mode: multiply; }

/* 16 种模式 */
.normal     { mix-blend-mode: normal; }      /* 默认 */
.multiply   { mix-blend-mode: multiply; }    /* 正片叠底，变暗 */
.screen     { mix-blend-mode: screen; }      /* 滤色，变亮 */
.difference { mix-blend-mode: difference; }  /* 差值，反相 */
.hue        { mix-blend-mode: hue; }         /* 取下层色相 */
/* ... overlay / darken / lighten / color-dodge / color-burn /
       hard-light / soft-light / exclusion / saturation / color / luminosity */

/* isolation:isolate —— 隔离混合范围 */
.modal {
  isolation: isolate;  /* 子元素混合不泄漏到祖先 */
}

/* background-blend-mode —— 多层背景混合（区别于 mix-blend-mode） */
.bg {
  background-image: url(a.png), url(b.png);
  background-color: #4a90d9;
  background-blend-mode: screen, multiply;  /* 按层声明 */
}`),
    );
  }

  // ============================================================
  // Card 5: will-change 与 GPU 合成层
  // ============================================================

  _toggleWillChange() {
    const next = !this.state.willChangeOn;
    this.setState({ willChangeOn: next });
    this._addLog('info', `will-change ${next ? '开启' : '关闭'} → ${next ? 'transform（提示浏览器提前为变换创建合成层，GPU 加速）' : 'auto（移除优化提示，动画结束后应重置）'}。`);
  }

  _triggerAnimation() {
    const next = !this.state.animating;
    this.setState({ animating: next });
    this._addLog('info', `动画 ${next ? '触发' : '复位'} → transform: translateX(280px) rotate(180deg)${this.state.willChangeOn ? '（will-change:transform 已提前优化）' : '（无 will-change，可能首次动画有卡顿）'}。`);
  }

  _readWillChangeInfo() {
    const caps = this._caps();
    try {
      const box = this.el && this.el.querySelector('.ve-wc-box');
      let wcComputed = '(未渲染)';
      if (box) {
        wcComputed = window.getComputedStyle(box).getPropertyValue('will-change') || '(空)';
      }
      this.setState({ willChangeInfo:
        'will-change / GPU 合成层 演示：\n' +
        `  .ve-wc-box { will-change: ${this.state.willChangeOn ? 'transform' : 'auto'}; transition: transform 0.6s; }\n` +
        `  will-change 计算值="${wcComputed}"\n` +
        `  CSS.supports('will-change','transform') = ${caps.willChange}\n` +
        `  CSS.supports('will-change','opacity') = ${caps.willChangeOpacity}\n` +
        `  CSS.supports('will-change','scroll-position') = ${caps.willChangeScroll}\n` +
        `  CSS.supports('will-change','contents') = ${caps.willChangeContents}\n\n` +
        'will-change: transform|opacity|scroll-position|contents：\n' +
        '  提示浏览器该属性即将变化，提前优化（创建合成层、预渲染）\n' +
        '  transform / opacity / filter / will-change 触发 GPU 合成层\n\n' +
        '合成层优势：\n' +
        '  GPU 加速（独立显卡渲染）、独立线程绘制（不阻塞主线程布局）\n' +
        '  变化只触发 paint/composite，不触发 layout（高性能动画）\n\n' +
        '滥用警告：\n' +
        '  过多 will-change 导致内存占用激增、合成层爆炸\n' +
        '  每个合成层占用 GPU 内存，数量过多会崩溃或卡顿\n' +
        '  应在动画前设置，动画结束后重置 will-change: auto\n\n' +
        'vs transform: translateZ(0) hack：\n' +
        '  translateZ(0)/translate3d(0,0,0) 强制创建合成层（hack）\n' +
        '  will-change 是语义化的优化提示，浏览器可智能决策\n' +
        '  两者都应谨慎使用，仅在性能瓶颈时启用\n\n' +
        '实战：\n' +
        '  动画前 element.style.willChange = "transform"，动画结束移除\n' +
        '  滚动列表 will-change: scroll-position（谨慎）\n' +
        '  Chrome 36+ / Firefox 36+ / Safari 9.1+ 支持。' });
      this._addLog('info', `读取 will-change="${wcComputed}"，支持=${caps.willChange}`);
    } catch (err) {
      this._addLog('warn', `读取 will-change 失败：${err.name} - ${err.message}`);
    }
  }

  _renderWillChangeCard() {
    const s = this.state;
    const caps = this._caps();
    return h(Card, {
      title: '5. will-change 与 GPU 合成层',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._capTags([['will-change', caps.willChange]]),
        h(Tag, { color: 'primary' }, 'transform · opacity'),
      ),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'will-change: transform|opacity|scroll-position|contents 提示浏览器该属性即将变化，提前优化（创建 GPU 合成层、预渲染）。触发合成层的属性：transform/opacity/filter/will-change。合成层优势：GPU 加速、独立线程绘制、变化只触发 paint/composite 不触发 layout。滥用警告：过多 will-change 导致内存激增、合成层爆炸，应在动画前设置、动画后重置 will-change:auto。vs transform:translateZ(0) hack：will-change 是语义化优化提示。Chrome 36+ / Firefox 36+ / Safari 9.1+ 支持。'),
      !caps.willChange && h(Alert, {
        type: 'warning',
        message: '当前浏览器不支持 will-change',
        description: 'CSS.supports("will-change", "transform") 返回 false。Chrome 36+ / Firefox 36+ / Safari 9.1+ 支持。jsdom 不渲染动画，下方演示需在真实浏览器查看 GPU 加速效果。',
      }),
      h('div', { class: 'flex gap-sm mt-sm flex-wrap' },
        this._btn(`will-change ${s.willChangeOn ? '关闭' : '开启'}（当前：${s.willChangeOn ? 'transform' : 'auto'}）`, {
          type: 'primary', size: 'sm',
          disabled: !caps.willChange,
          onClick: () => this._toggleWillChange(),
        }),
        this._btn(`${s.animating ? '复位' : '触发'}动画`, {
          size: 'sm',
          disabled: !caps.css,
          onClick: () => this._triggerAnimation(),
        }),
        this._btn('读取计算值', {
          size: 'sm',
          disabled: !caps.css,
          onClick: () => this._readWillChangeInfo(),
        }),
      ),
      h('div', { class: 'fs-sm text-secondary mt-sm' }, `动画演示框（${s.willChangeOn ? 'will-change:transform 已开启' : 'will-change 未开启'}；点击「触发动画」平移+旋转）：`),
      h('div', { class: 've-wc-stage' },
        h('div', {
          class: `ve-wc-box${s.animating ? ' animating' : ''}${s.willChangeOn ? ' willchange' : ''}`,
        }, s.willChangeOn ? 'WC' : 'box'),
      ),
      h('p', { class: 'fs-sm text-tertiary mt-sm' },
        '真实浏览器中，开启 will-change:transform 后动画更流畅（GPU 合成层加速）。但长期保留 will-change 会占用 GPU 内存，动画结束后应重置为 auto。'),
      h('pre', { class: 'code-block mt-sm', style: { maxHeight: '260px', overflow: 'auto' } },
        h('code', {}, s.willChangeInfo || '（点击「读取计算值」查看 will-change 计算值与说明）')),
      h('pre', { class: 'code-block mt-sm' }, `/* will-change —— 提示浏览器提前优化 */
.animated-box {
  transition: transform 0.6s ease;
  will-change: transform;  /* 提示 transform 即将变化 */
}
.animated-box.move { transform: translateX(280px) rotate(180deg); }

/* 动画结束后重置（避免内存占用） */
const el = document.querySelector('.animated-box');
el.style.willChange = 'transform';   /* 动画前设置 */
el.classList.add('move');
el.addEventListener('transitionend', () => {
  el.style.willChange = 'auto';      /* 动画后重置 */
});

/* 触发 GPU 合成层的属性 */
.gpu { transform: translateZ(0); }       /* hack，强制合成层 */
.gpu { will-change: transform; }         /* 语义化提示 */
.gpu { opacity: 0.99; filter: blur(0); } /* 也会创建合成层 */

/* 滚动优化（谨慎） */
.scroller { will-change: scroll-position; }

/* 滥用警告：合成层爆炸 */
/* .bad { will-change: transform; } 给 100 个元素都设置 → 内存激增 */`),
    );
  }

  // ============================================================
  // Card 6: filter 与 backdrop-filter
  // ============================================================

  _toggleFilter() {
    const filters = [
      'blur(5px)', 'brightness(1.5)', 'contrast(2)', 'grayscale(1)',
      'hue-rotate(90deg)', 'invert(1)', 'opacity(0.5)', 'saturate(2)', 'sepia(1)',
    ];
    const idx = (this.state.filterIndex + 1) % filters.length;
    const next = filters[idx];
    this.setState({ filter: next, filterIndex: idx, combineFilters: false });
    this._addLog('info', `filter 切换 → "${next}"。filter 滤镜元素自身，backdrop-filter 滤镜元素后面的内容。`);
  }

  _toggleCombineFilters() {
    const next = !this.state.combineFilters;
    this.setState({ combineFilters: next });
    if (next) {
      this._addLog('info', '多滤镜组合 → filter: blur(2px) brightness(1.2) contrast(1.1) saturate(1.3)（按顺序叠加应用）。');
    } else {
      this._addLog('info', `取消组合，恢复单滤镜 → filter: ${this.state.filter}。`);
    }
  }

  _toggleBackdropFilter() {
    const next = !this.state.backdropFilterOn;
    this.setState({ backdropFilterOn: next });
    this._addLog('info', `backdrop-filter ${next ? '开启' : '关闭'} → ${next ? 'blur(10px) 毛玻璃效果（滤镜元素后面的内容）' : '无（对比毛玻璃消失）'}。`);
  }

  _readFilterInfo() {
    const caps = this._caps();
    try {
      const cell = this.el && this.el.querySelector('.ve-filter-cell .img-wrap img');
      let filterComputed = '(未渲染)';
      if (cell) {
        filterComputed = window.getComputedStyle(cell).getPropertyValue('filter') || '(空)';
      }
      const bdPanel = this.el && this.el.querySelector('.ve-bd-panel');
      let bdComputed = '(未渲染)';
      if (bdPanel) {
        bdComputed = window.getComputedStyle(bdPanel).getPropertyValue('backdrop-filter')
          || window.getComputedStyle(bdPanel).getPropertyValue('-webkit-backdrop-filter')
          || '(空)';
      }
      this.setState({ filterInfo:
        'filter / backdrop-filter 演示：\n' +
        `  当前 filter="${this.state.combineFilters ? 'blur(2px) brightness(1.2) contrast(1.1) saturate(1.3)' : this.state.filter}"\n` +
        `  backdrop-filter ${this.state.backdropFilterOn ? '开启（blur(10px)）' : '关闭'}\n` +
        `  filter 计算值="${filterComputed}"\n` +
        `  backdrop-filter 计算值="${bdComputed}"\n` +
        `  CSS.supports('filter','blur(5px)') = ${caps.filter}\n` +
        `  CSS.supports('backdrop-filter','blur(10px)') = ${caps.backdropFilter}\n` +
        `  CSS.supports('filter','drop-shadow(4px 4px 4px red)') = ${caps.dropShadow}\n\n` +
        'filter 滤镜函数：\n' +
        '  blur(5px) —— 高斯模糊\n' +
        '  brightness(1.5) —— 亮度（1=原值，>1 变亮，<1 变暗）\n' +
        '  contrast(2) —— 对比度\n' +
        '  grayscale(1) —— 灰度（0-1，1=完全灰）\n' +
        '  hue-rotate(90deg) —— 色相旋转\n' +
        '  invert(1) —— 反相（0-1，1=完全反色）\n' +
        '  opacity(0.5) —— 透明度\n' +
        '  saturate(2) —— 饱和度\n' +
        '  sepia(1) —— 棕褐色（复古）\n' +
        '  drop-shadow(4px 4px 4px red) —— 投影（跟随实际形状）\n' +
        '  多滤镜组合：filter: blur(2px) brightness(1.2) contrast(1.1)\n\n' +
        'backdrop-filter —— 背景滤镜（毛玻璃）：\n' +
        '  滤镜元素后面的内容（透过半透明元素看到）\n' +
        '  常用 backdrop-filter: blur(10px) 实现毛玻璃导航栏\n' +
        '  Safari 需 -webkit-backdrop-filter 前缀\n\n' +
        'backdrop-filter vs filter：\n' +
        '  backdrop-filter 滤镜元素后面的内容（元素本身半透明）\n' +
        '  filter 滤镜元素自身（含内容）\n\n' +
        'drop-shadow() vs box-shadow：\n' +
        '  drop-shadow 跟随元素实际形状（含透明区域，如 clip-path 星形）\n' +
        '  box-shadow 是元素边框盒的矩形阴影（不跟随形状）\n\n' +
        '实战：\n' +
        '  毛玻璃导航栏（backdrop-filter: blur）、图片滤镜调节、\n' +
        '  星形图标阴影（drop-shadow 跟随 clip-path 形状）。\n' +
        '  filter 全平台支持；backdrop-filter Chrome 76+ / Safari 9+（-webkit-）/ Firefox 103+。' });
      this._addLog('info', `读取 filter="${filterComputed}"，backdrop-filter="${bdComputed}"，filter 支持=${caps.filter}, backdrop 支持=${caps.backdropFilter}`);
    } catch (err) {
      this._addLog('warn', `读取 filter 失败：${err.name} - ${err.message}`);
    }
  }

  _renderFilterCard() {
    const s = this.state;
    const caps = this._caps();
    const allFilters = [
      'blur(5px)', 'brightness(1.5)', 'contrast(2)', 'grayscale(1)',
      'hue-rotate(90deg)', 'invert(1)', 'opacity(0.5)', 'saturate(2)', 'sepia(1)',
    ];
    const combined = 'blur(2px) brightness(1.2) contrast(1.1) saturate(1.3)';
    const activeFilter = s.combineFilters ? combined : s.filter;
    return h(Card, {
      title: '6. filter 与 backdrop-filter（滤镜与背景滤镜）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._capTags([['filter', caps.filter], ['backdrop-filter', caps.backdropFilter], ['drop-shadow', caps.dropShadow]]),
        h(Tag, { color: 'primary' }, 'blur · 毛玻璃'),
      ),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'filter 给元素加滤镜：blur/brightness/contrast/grayscale/hue-rotate/invert/opacity/saturate/sepia/drop-shadow，可多滤镜组合（filter: blur(2px) brightness(1.2) contrast(1.1)）。backdrop-filter 滤镜元素后面的内容（毛玻璃效果），Safari 需 -webkit- 前缀。backdrop-filter vs filter：前者滤镜元素后面内容，后者滤镜元素自身。drop-shadow() vs box-shadow：drop-shadow 跟随元素实际形状（含透明区域），box-shadow 是矩形阴影。实战：毛玻璃导航栏、图片滤镜、星形图标阴影。filter 全平台；backdrop-filter Chrome 76+/Safari 9+(-webkit-)/Firefox 103+。'),
      !caps.filter && h(Alert, {
        type: 'warning',
        message: '当前浏览器不支持 filter',
        description: 'CSS.supports("filter", "blur(5px)") 返回 false。filter 全平台支持，jsdom 不渲染滤镜，下方演示需在真实浏览器查看。',
      }),
      !caps.backdropFilter && caps.filter && h(Alert, {
        type: 'warning',
        message: '当前浏览器不支持 backdrop-filter',
        description: 'CSS.supports("backdrop-filter", "blur(10px)") 返回 false。Chrome 76+ / Safari 9+（需 -webkit-）/ Firefox 103+ 支持。毛玻璃效果需在真实浏览器查看。',
      }),
      h('div', { class: 'flex gap-sm mt-sm flex-wrap' },
        this._btn(`切换 filter（当前：${s.combineFilters ? '组合' : s.filter}）`, {
          type: 'primary', size: 'sm',
          disabled: !caps.filter,
          onClick: () => this._toggleFilter(),
        }),
        this._btn(`${s.combineFilters ? '取消' : '开启'}多滤镜组合`, {
          size: 'sm',
          disabled: !caps.filter,
          onClick: () => this._toggleCombineFilters(),
        }),
        this._btn(`backdrop-filter ${s.backdropFilterOn ? '关闭' : '开启'}`, {
          size: 'sm',
          disabled: !caps.backdropFilter,
          onClick: () => this._toggleBackdropFilter(),
        }),
        this._btn('读取计算值', {
          size: 'sm',
          disabled: !caps.css,
          onClick: () => this._readFilterInfo(),
        }),
      ),
      h('div', { class: 'fs-sm text-secondary mt-sm' }, `9 种 filter 对比（当前演示框 filter: ${activeFilter}）：`),
      h('div', { class: 've-filter-stage' },
        ...allFilters.map((f) => h('div', { class: 've-filter-cell' },
          h('div', { class: 'img-wrap' },
            h('img', { src: DEMO_IMG, alt: f, style: { filter: f } }),
          ),
          h('div', { class: 'label' }, f),
        )),
      ),
      h('div', { class: 'fs-sm text-secondary mt-sm' }, `当前演示框（filter: ${activeFilter}）：`),
      h('div', { class: 've-filter-cell', style: { display: 'inline-block' } },
        h('div', { class: 'img-wrap' },
          h('img', { src: DEMO_IMG, alt: 'demo', style: { filter: activeFilter } }),
        ),
        h('div', { class: 'label' }, activeFilter),
      ),
      h('div', { class: 'fs-sm text-secondary mt-sm' }, `backdrop-filter: blur(10px) 毛玻璃（${s.backdropFilterOn ? '开启' : '关闭'} —— 真实浏览器可见毛玻璃效果）：`),
      h('div', { class: 've-bd-stage' },
        h('div', { class: `ve-bd-panel${s.backdropFilterOn ? '' : ' off'}` },
          s.backdropFilterOn ? 'backdrop-filter: blur(10px)' : 'backdrop-filter: none'),
      ),
      h('div', { class: 'fs-sm text-secondary mt-sm' }, 'drop-shadow() vs box-shadow（星形 clip-path，drop-shadow 跟随形状，box-shadow 是矩形）：'),
      h('div', { class: 've-shadow-stage' },
        h('div', { class: 've-shadow-cell' },
          h('div', { class: 've-shadow-icon' },
            h('div', { class: 've-shadow-star box-shadow' }, '')),
          h('div', { class: 'label' }, 'box-shadow（矩形）'),
        ),
        h('div', { class: 've-shadow-cell' },
          h('div', { class: 've-shadow-icon' },
            h('div', { class: 've-shadow-star drop-shadow' }, '')),
          h('div', { class: 'label' }, 'drop-shadow（跟随形状）'),
        ),
        h('div', { class: 've-shadow-cell' },
          h('div', { class: 've-shadow-icon' },
            h('div', { class: 've-shadow-star' }, '')),
          h('div', { class: 'label' }, '无阴影'),
        ),
      ),
      h('pre', { class: 'code-block mt-sm', style: { maxHeight: '260px', overflow: 'auto' } },
        h('code', {}, s.filterInfo || '（点击「读取计算值」查看 filter/backdrop-filter 计算值与说明）')),
      h('pre', { class: 'code-block mt-sm' }, `/* filter —— 元素滤镜 */
img.blur       { filter: blur(5px); }          /* 高斯模糊 */
img.bright     { filter: brightness(1.5); }    /* 亮度 1.5x */
img.contrast   { filter: contrast(2); }        /* 对比度 2x */
img.gray       { filter: grayscale(1); }       /* 完全灰度 */
img.hue        { filter: hue-rotate(90deg); }  /* 色相旋转 90° */
img.invert     { filter: invert(1); }          /* 完全反色 */
img.opacity    { filter: opacity(0.5); }       /* 半透明 */
img.saturate   { filter: saturate(2); }        /* 饱和度 2x */
img.sepia      { filter: sepia(1); }           /* 棕褐复古 */

/* 多滤镜组合 */
img.combo { filter: blur(2px) brightness(1.2) contrast(1.1) saturate(1.3); }

/* drop-shadow —— 跟随实际形状（含透明区域） */
.star {
  clip-path: polygon(50% 0, 61% 35%, 98% 35%, ...);
  filter: drop-shadow(4px 6px 4px rgba(0,0,0,.5)); /* 跟随星形 */
  /* vs box-shadow: 4px 6px 8px rgba(0,0,0,.5); —— 矩形阴影 */
}

/* backdrop-filter —— 毛玻璃（滤镜元素后面的内容） */
.glass-nav {
  background: rgba(255,255,255,.25);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);  /* Safari 前缀 */
}
/* filter 滤镜元素自身；backdrop-filter 滤镜元素后面内容 */`),
    );
  }

  // ============================================================
  // 日志面板
  // ============================================================

  _renderLogPanel() {
    const s = this.state;
    return h(Card, {
      title: '事件日志',
      extra: h('span', { class: 'fs-sm text-tertiary' }, `${s.logs.length} 条`),
    },
      h('div', { class: 'log-panel' },
        s.logs.length === 0
          ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
          : s.logs.map((log) => h('div', { class: 'log-panel__line' },
              h('span', { class: 'log-panel__time' }, log.time),
              h('span', { class: `log-panel__tag log-panel__tag--${log.type === 'error' ? 'error' : 'info'}` }, log.type),
              h('span', { class: 'log-panel__content' }, log.content),
            )),
      ),
    );
  }

  // ============================================================
  // 页面渲染入口
  // ============================================================

  renderPage() {
    const s = this.state;
    return [
      h('h2', { class: 'section-title' }, 'CSS 视觉效果与合成 实验室'),

      h(Alert, {
        type: 'info',
        message: 'CSS 视觉效果与合成',
        description: '演示 aspect-ratio 宽高比、object-fit 与 object-position、CSS Shapes（shape-outside/shape-margin/shape-image-threshold）、mix-blend-mode 与 isolation、will-change 与 GPU 合成层、filter 与 backdrop-filter 等视觉效果特性。所有特性通过 CSS.supports() 检测，不支持时显示提示但不报错。由于 jsdom 不渲染 CSS，所有视觉演示需在真实浏览器中查看效果，能力检测、代码展示、日志记录在 jsdom 中正常工作。',
      }),

      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,

      this._renderAspectRatioCard(),
      this._renderObjectFitCard(),
      this._renderShapesCard(),
      this._renderBlendModeCard(),
      this._renderWillChangeCard(),
      this._renderFilterCard(),

      this._renderLogPanel(),
    ];
  }
}
