// =====================================================================
// CSSColorHDRDeepPage.js —— CSS Color Level 4/5 与 HDR 深度实验室
// 演示 CSS Color Module Level 4/5 现代色彩标准与 HDR 广色域能力：
//   1. 概述与动机 —— CSS Color Module Level 4/5 标准 / RGB 与 sRGB 局限 /
//      HDR 广色域需求 / Display P3 / Rec2020 / 浏览器支持
//      Chrome 111+/Firefox 113+/Safari 15+
//   2. color() 函数与色彩空间 —— color(display-p3 1 0 0) / color(rec2020 ...) /
//      color(xyz-d65 ...) / 预定义色彩空间全集（srgb/srgb-linear/display-p3/
//      a98-rgb/prophoto-rgb/rec2020/xyz/xyz-d50/xyz-d65）/ 自定义 @color profile
//   3. oklch()/lab()/lch() 感知色 —— oklch(L C H) / oklab(L a b) / lab()/lch() /
//      感知均匀色彩空间 / vs HSL 优势（亮度/饱和度线性可调）/ 设计系统色阶生成
//   4. color-mix() 混色 —— color-mix(in oklch, red, blue) /
//      color-mix(in srgb, red 50%, blue) / 百分比语法 / 透明度合并 /
//      与 design tokens 协同
//   5. 相对颜色（from 关键字）—— rgb(from red r g b) /
//      oklch(from red calc(l + 0.1) c h) / 提取并修改通道 / 主题色调派生 /
//      color-contrast() 提案
//   6. HDR 与 dynamic-range —— @media (dynamic-range: high) /
//      @media (color-gamut: p3/rec2020) / HDR 视频背景 / prefers-contrast /
//      system-color / HDR 显示检测
//   7. 浏览器渲染与色彩管理 —— 渲染管线 color space 转换 / ICC profile /
//      canvas colorSpace 选项 / drawImage 跨色彩空间 / ImageData colorSpace
//   8. 实战与陷阱 —— 暗色主题切换 + 色阶生成器 / 设计系统 color-mix 应用 /
//      浏览器降级（不支持 color() 时 fallback）/ 色彩可访问性
//      （WCAG contrast ratio）/ 渐变色带修复
// 说明：所有特性调用前做 typeof / CSS.supports / matchMedia 能力检测，不可用时
//       仅记日志（_addLog('warn', ...)），绝不抛异常。jsdom 不做真实 CSS 渲染，
//       CSS.supports 通常可用；matchMedia 在 jsdom 通常不可用或返回 false，统一兜底。
//       _flags() 用 safe(()=>...) 包裹，jsdom 不可用时返回 false。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class CSSColorHDRDeepPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      overviewInfo: '',       // Card 1：概述与动机
      colorFuncInfo: '',      // Card 2：color() 函数与色彩空间
      oklchInfo: '',          // Card 3：oklch/lab/lch 感知色
      colorMixInfo: '',       // Card 4：color-mix() 混色
      relativeColorInfo: '',  // Card 5：相对颜色（from）
      hdrInfo: '',            // Card 6：HDR 与 dynamic-range
      renderingInfo: '',      // Card 7：浏览器渲染与色彩管理
      pitfallsInfo: '',       // Card 8：实战与陷阱
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._dynamicStyles = [];   // 动态创建并插入 head 的 <style> 元素列表
    // 各 Card 当前演示模式
    this._colorSpaceMode = 'display-p3';  // Card 2 当前 color() 色彩空间
    this._oklchMode = 'oklch';            // Card 3 当前感知色函数
    this._mixMode = 'oklch';              // Card 4 color-mix 当前中间空间
    this._relativeMode = 'lighten';       // Card 5 相对颜色当前模式
    this._hdrMode = 'dynamic-range';      // Card 6 当前 HDR 媒体查询
    this._renderingMode = 'canvas';       // Card 7 当前渲染模式

    // 一次性能力检测：CSS Color Level 4/5 与 HDR 全家桶
    const f = this._flags();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `CSS ${c(f.css)}`,
      `supports ${c(f.supports)}`,
      `color() ${c(f.colorFunc)}`,
      `oklch ${c(f.oklch)}`,
      `lab ${c(f.lab)}`,
      `color-mix ${c(f.colorMix)}`,
      `relative-color ${c(f.relativeColor)}`,
      `dynamic-range:high ${c(f.dynamicRangeHigh)}`,
      `color-gamut:p3 ${c(f.colorGamutP3)}`,
    ];

    const summary = f.css
      ? `CSS Color Level 4/5 与 HDR 能力检测：${parts.join(' · ')}。jsdom 不做真实 CSS 渲染，但 CSS.supports 通常可用；matchMedia 在 jsdom 通常不可用，dynamic-range/color-gamut 检测会返回 false。color()/oklch()/lab()/color-mix()/相对颜色（from）为 CSS Color L4 新特性（Chrome 111+/Firefox 113+/Safari 15+）。HDR 需要 Display P3 / Rec2020 显示器 + 真实浏览器才完整呈现。`
      : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。';

    this.setState({ capsSummary: summary });
    this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.colorFunc) this._addLog('warn', 'color() 函数不可用或 jsdom 未识别（CSS Color L4，Chrome 111+/Firefox 113+/Safari 15+ 支持）');
    if (!f.oklch) this._addLog('warn', 'oklch() 不可用或 jsdom 未识别（CSS Color L4，Chrome 111+/Firefox 113+/Safari 15.4+ 支持）');
    if (!f.colorMix) this._addLog('warn', 'color-mix() 不可用或 jsdom 未识别（CSS Color L5，Chrome 111+/Firefox 113+/Safari 16.2+ 支持）');
    if (!f.relativeColor) this._addLog('warn', '相对颜色 rgb(from ...) 不可用或 jsdom 未识别（CSS Color L5，Chrome 119+/Safari 16.4+ 支持）');
    if (!f.dynamicRangeHigh) this._addLog('warn', 'matchMedia("(dynamic-range: high)") 不可用或未匹配（jsdom 通常不实现 matchMedia；需真实 HDR 显示器）');
    if (!f.colorGamutP3) this._addLog('warn', 'matchMedia("(color-gamut: p3)") 不可用或未匹配（jsdom 通常不实现；需 Display P3 显示器）');

    // 一次性注入全部演示样式（仅一次；rerender 不会移除 head 中的 style）
    this._injectBaseStyles();
  }

  componentWillUnmount() {
    // 移除动态创建的 <style> 元素，便于 GC
    for (const style of this._dynamicStyles) {
      try { style.parentNode && style.parentNode.removeChild(style); } catch { /* noop */ }
    }
    this._dynamicStyles = [];
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

  // 返回 Tag 数组：items = [[label, ok], ...]，展示能力状态（✓/✗）
  _caps(items) {
    return items.map(([label, ok]) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  // safe 包装：jsdom 不可用时返回 false，绝不抛异常
  _safe(fn) {
    try { return fn(); } catch { return false; }
  }

  // 返回布尔能力对象（供 capsSummary / 按钮 disabled 使用）
  _flags() {
    const hasCSS = this._safe(() => typeof CSS !== 'undefined');
    const supportsPV = (p, v) => this._safe(() =>
      hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v));
    const matchMQ = (mq) => this._safe(() =>
      typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
      window.matchMedia(mq).matches);
    return {
      css: hasCSS,
      supports: this._safe(() => hasCSS && typeof CSS.supports === 'function'),
      // Card 2：color() 函数
      colorFunc: supportsPV('color', 'color(display-p3 1 0 0)'),
      // Card 3：感知色函数
      oklch: supportsPV('color', 'oklch(0.5 0.1 200)'),
      oklab: supportsPV('color', 'oklab(0.5 0.1 0.1)'),
      lab: supportsPV('color', 'lab(50% 40 30)'),
      lch: supportsPV('color', 'lch(50% 40 30)'),
      // Card 4：color-mix()
      colorMix: supportsPV('color', 'color-mix(in oklch, red, blue)'),
      // Card 5：相对颜色（from）
      relativeColor: supportsPV('color', 'rgb(from red r g b)'),
      relativeOklch: supportsPV('color', 'oklch(from red calc(l + 0.1) c h)'),
      // Card 6：HDR / 广色域媒体查询
      dynamicRangeHigh: matchMQ('(dynamic-range: high)'),
      colorGamutP3: matchMQ('(color-gamut: p3)'),
      colorGamutRec2020: matchMQ('(color-gamut: rec2020)'),
      prefersContrast: matchMQ('(prefers-contrast: more)'),
      // Card 7：canvas colorSpace
      canvasColorSpace: this._safe(() => {
        if (typeof document === 'undefined') return false;
        const c = document.createElement('canvas');
        return typeof c.getContext === 'function' &&
          typeof c.getContext('2d', { colorSpace: 'display-p3' }) !== 'undefined';
      }),
    };
  }

  // —— 注入一个 <style>，跟踪到 this._dynamicStyles ——
  _injectStyle(id, textContent) {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = textContent;
    document.head.appendChild(style);
    this._dynamicStyles.push(style);
    return style;
  }

  // —— 动态注入所有演示样式（一次性）——
  _injectBaseStyles() {
    this._injectStyle('css-color-hdr-demo', `
      /* ===== 通用舞台 ===== */
      .color-stage {
        margin-top: 10px;
        padding: 12px;
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 8px;
        color: #e2e8f0;
      }
      /* ===== Card 2：color() 色彩空间对比 ===== */
      .cs-swatch-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
      .cs-swatch {
        width: 80px; height: 60px; border-radius: 6px;
        border: 2px solid #475569;
        display: flex; align-items: flex-end; justify-content: center;
        font-size: 10px; color: #fff; padding: 4px;
        text-shadow: 0 1px 2px rgba(0,0,0,0.8);
      }
      .cs-srgb { background: rgb(100% 0% 0%); }
      .cs-display-p3 { background: color(display-p3 1 0 0); }
      .cs-rec2020 { background: color(rec2020 1 0 0); }
      .cs-a98 { background: color(a98-rgb 1 0 0); }
      .cs-prophoto { background: color(prophoto-rgb 1 0 0); }
      .cs-xyz-d65 { background: color(xyz-d65 0.5 0.2 0.1); }
      /* ===== Card 3：oklch 感知色色阶 ===== */
      .oklch-scale { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 8px; }
      .oklch-step {
        width: 50px; height: 50px; border-radius: 4px;
        display: flex; align-items: center; justify-content: center;
        font-size: 10px; color: #fff;
        text-shadow: 0 1px 2px rgba(0,0,0,0.8);
      }
      .oklch-l50 { background: oklch(0.5 0.2 250); }
      .oklch-l60 { background: oklch(0.6 0.2 250); }
      .oklch-l70 { background: oklch(0.7 0.2 250); }
      .oklch-l80 { background: oklch(0.8 0.2 250); }
      .oklch-l90 { background: oklch(0.9 0.2 250); }
      .oklch-hsl-cmp { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 8px; }
      .oklch-hsl-cmp .step {
        width: 50px; height: 50px; border-radius: 4px;
        display: flex; align-items: center; justify-content: center;
        font-size: 10px; color: #fff;
        text-shadow: 0 1px 2px rgba(0,0,0,0.8);
      }
      /* ===== Card 4：color-mix 混色 ===== */
      .mix-stage { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
      .mix-box {
        width: 80px; height: 60px; border-radius: 6px;
        border: 2px solid #475569;
        display: flex; align-items: flex-end; justify-content: center;
        font-size: 10px; color: #fff; padding: 4px;
        text-shadow: 0 1px 2px rgba(0,0,0,0.8);
      }
      .mix-a { background: red; }
      .mix-b { background: blue; }
      .mix-oklch-50 { background: color-mix(in oklch, red 50%, blue); }
      .mix-oklch-25 { background: color-mix(in oklch, red 25%, blue); }
      .mix-oklch-75 { background: color-mix(in oklch, red 75%, blue); }
      .mix-srgb-50 { background: color-mix(in srgb, red 50%, blue); }
      .mix-alpha { background: color-mix(in srgb, rgb(255 0 0 / 0.5), rgb(0 0 255 / 0.5)); }
      /* ===== Card 5：相对颜色 ===== */
      .rel-stage { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
      .rel-box {
        width: 80px; height: 60px; border-radius: 6px;
        border: 2px solid #475569;
        display: flex; align-items: flex-end; justify-content: center;
        font-size: 10px; color: #fff; padding: 4px;
        text-shadow: 0 1px 2px rgba(0,0,0,0.8);
      }
      .rel-base { background: #2563eb; }
      .rel-lighten { background: oklch(from #2563eb calc(l + 0.15) c h); }
      .rel-darken { background: oklch(from #2563eb calc(l - 0.15) c h); }
      .rel-saturate { background: oklch(from #2563eb l calc(c + 0.05) h); }
      .rel-hue { background: oklch(from #2563eb l c calc(h + 60)); }
      .rel-alpha { background: rgb(from #2563eb r g b / 0.4); }
      /* ===== Card 6：HDR 媒体查询 ===== */
      .hdr-stage { padding: 10px; border-radius: 6px; margin-top: 8px; background: #1e293b; }
      .hdr-sdr { background: linear-gradient(red, blue); padding: 10px; border-radius: 4px; color: #fff; }
      @media (dynamic-range: high) {
        .hdr-hdr { background: linear-gradient(color(display-p3 1 0 0), color(display-p3 0 0 1)); }
      }
      @media (color-gamut: p3) {
        .hdr-p3 { background: color(display-p3 1 0 0); color: #fff; }
      }
      @media (color-gamut: rec2020) {
        .hdr-rec2020 { background: color(rec2020 1 0 0); color: #fff; }
      }
      @media (prefers-contrast: more) {
        .hdr-contrast { border: 3px solid #fff; }
      }
      .hdr-swatch {
        padding: 10px; border-radius: 4px; margin-top: 6px;
        border: 1px solid #475569; color: #fff; font-size: 12px;
      }
      /* ===== Card 7：canvas 色彩空间 ===== */
      .canvas-stage { padding: 10px; background: #1e293b; border-radius: 6px; margin-top: 8px; }
      .canvas-stage canvas { border: 1px solid #475569; border-radius: 4px; display: block; margin-top: 6px; }
      /* ===== Card 8：暗色主题 + 色阶生成器 ===== */
      .theme-stage { padding: 12px; border-radius: 6px; margin-top: 8px; border: 1px solid #334155; }
      .theme-stage.light { background: #f1f5f9; color: #0f172a; }
      .theme-stage.dark { background: #0f172a; color: #e2e8f0; }
      .theme-stage .scale-row { display: flex; gap: 4px; margin-top: 8px; }
      .theme-stage .scale-step {
        width: 40px; height: 40px; border-radius: 4px;
        display: flex; align-items: center; justify-content: center;
        font-size: 9px; color: #fff;
        text-shadow: 0 1px 2px rgba(0,0,0,0.8);
      }
      /* 渐变色带修复：oklch 感知均匀，无灰色死区 */
      .gradient-bad { background: linear-gradient(in srgb, blue, red); height: 30px; border-radius: 4px; margin-top: 6px; }
      .gradient-good { background: linear-gradient(in oklch, blue, red); height: 30px; border-radius: 4px; margin-top: 6px; }
      /* ===== 输出区 ===== */
      .color-output {
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 4px;
        padding: 8px;
        font-family: monospace;
        font-size: 11px;
        white-space: pre-wrap;
        word-break: break-all;
        margin-top: 8px;
      }
    `);
  }

  // =================== Card 1：概述与动机 ===================

  _readOverviewInfo() {
    const f = this._flags();
    try {
      return `===== CSS Color Level 4/5 与 HDR 概述 =====\n` +
        `\n` +
        `【规范归属】\n` +
        `  CSS Color Module Level 4（W3C CR 2024）—— color() 函数 / oklch() / oklab() / lab() / lch()\n` +
        `  CSS Color Module Level 5（W3C WD 2024）—— color-mix() / 相对颜色（from）/ color-contrast()\n` +
        `  规范地址：https://www.w3.org/TR/css-color-4/ 与 https://www.w3.org/TR/css-color-5/\n` +
        `\n` +
        `【RGB 与 sRGB 局限】\n` +
        `  传统 CSS 颜色（#hex / rgb() / hsl()）均基于 sRGB 色彩空间\n` +
        `  sRGB 色域狭窄（约占 CIE 1931 色域 35%），无法表达 Display P3 / Rec2020 鲜艳颜色\n` +
        `  HSL 感知不均匀：HSL(0,100%,50%) 与 HSL(60,100%,50%) 视觉亮度差异巨大\n` +
        `  HSL 调亮度（L）时饱和度会失真（L=50% 最饱和，L=0/100% 灰色）\n` +
        `\n` +
        `【HDR 广色域需求】\n` +
        `  HDR（High Dynamic Range）：动态范围超越 sRGB，支持更高亮度（1000+ nits）与更深黑色\n` +
        `  广色域（Wide Color Gamut, WCG）：色域超越 sRGB，覆盖 Display P3 / Rec2020\n` +
        `  应用场景：HDR 视频 / 摄影 / 设计系统 / 游戏流媒体 / 医学影像\n` +
        `\n` +
        `【主要广色域色彩空间】\n` +
        `  Display P3 —— Apple 主推，覆盖 sRGB + 35% 鲜艳红绿，iPhone/Mac 显示器标准\n` +
        `  Rec2020 —— UHDTV 标准，色域最广（约占 CIE 75%），4K/8K 视频使用\n` +
        `  a98-rgb —— Adobe RGB（1998），印刷与摄影\n` +
        `  prophoto-rgb —— ProPhoto RGB，色域最广（部分超出可见光，谨慎使用）\n` +
        `  xyz / xyz-d50 / xyz-d65 —— CIE 1931 XYZ 设备无关中间空间\n` +
        `\n` +
        `【能力检测】\n` +
        `  CSS.supports('color','color(display-p3 1 0 0)') = ${f.colorFunc}\n` +
        `  CSS.supports('color','oklch(0.5 0.1 200)')    = ${f.oklch}\n` +
        `  CSS.supports('color','lab(50% 40 30)')          = ${f.lab}\n` +
        `  CSS.supports('color','color-mix(in oklch, red, blue)') = ${f.colorMix}\n` +
        `  CSS.supports('color','rgb(from red r g b)')     = ${f.relativeColor}\n` +
        `  matchMedia('(dynamic-range: high)').matches     = ${f.dynamicRangeHigh}\n` +
        `  matchMedia('(color-gamut: p3)').matches         = ${f.colorGamutP3}\n` +
        `  matchMedia('(color-gamut: rec2020)').matches    = ${f.colorGamutRec2020}\n` +
        `  canvas colorSpace: 'display-p3'                  = ${f.canvasColorSpace}\n` +
        `\n` +
        `【浏览器支持】\n` +
        `  color() / oklch() / lab() / lch() —— Chrome 111+ / Firefox 113+ / Safari 15+（CSS Color L4）\n` +
        `  color-mix() —— Chrome 111+ / Firefox 113+ / Safari 16.2+（CSS Color L5）\n` +
        `  相对颜色（from）—— Chrome 119+ / Firefox 128+ / Safari 16.4+（CSS Color L5）\n` +
        `  @media (dynamic-range: high) —— Chrome 98+ / Firefox 100+ / Safari 17+\n` +
        `  @media (color-gamut: p3) —— Chrome 58+ / Firefox 49+ / Safari 10+\n` +
        `  canvas colorSpace: 'display-p3' —— Chrome 98+ / Safari 16.4+（Firefox 部分支持）\n` +
        `  HDR 视频背景需真实 HDR 显示器 + 浏览器 + 操作系统三方支持\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  /* sRGB 传统（色域窄）*/\n` +
        `  .srgb-red { color: rgb(255, 0, 0); }\n` +
        `\n` +
        `  /* Display P3 鲜艳红（HDR 显示器可见差异）*/\n` +
        `  .p3-red { color: color(display-p3 1 0 0); }\n` +
        `\n` +
        `  /* oklch 感知均匀（亮度线性可调）*/\n` +
        `  .oklch-blue { color: oklch(0.5 0.2 250); }\n` +
        `\n` +
        `  /* color-mix 混色（CSS Color L5）*/\n` +
        `  .mix { color: color-mix(in oklch, red 50%, blue); }\n` +
        `\n` +
        `  /* 相对颜色：派生亮色变体 */\n` +
        `  .lighten { color: oklch(from #2563eb calc(l + 0.15) c h); }`;
    } catch (err) {
      return `读取概述信息失败：${err.name} - ${err.message}`;
    }
  }

  _runOverviewDemo() {
    this.setState({ overviewInfo: this._readOverviewInfo() });
    const f = this._flags();
    this._addLog('overview', `能力检测汇总：color()=${f.colorFunc}, oklch=${f.oklch}, color-mix=${f.colorMix}, dynamic-range:high=${f.dynamicRangeHigh}`);
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. 概述与动机 —— CSS Color Level 4/5 标准 / HDR 广色域需求',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['color()', f.colorFunc],
          ['oklch()', f.oklch],
          ['color-mix()', f.colorMix],
          ['HDR', f.dynamicRangeHigh],
        ]),
        h(Tag, { color: 'primary' }, 'CSS Color L4/L5'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'CSS Color Module Level 4 引入 color() 函数（指定任意色彩空间）/ oklch()/oklab()/lab()/lch()（感知均匀色彩空间），Level 5 新增 color-mix()（混色）/ 相对颜色（from 关键字派生颜色）/ color-contrast()（提案）。传统 RGB/HSL 基于 sRGB 色域狭窄（约占 CIE 35%）且 HSL 感知不均匀（调亮度饱和度失真）。HDR 广色域需求：Display P3（Apple 主推，覆盖 sRGB + 35% 鲜艳红绿）/ Rec2020（UHDTV，色域最广）/ a98-rgb（Adobe RGB 印刷）/ prophoto-rgb / xyz。浏览器支持：color()/oklch/lab 在 Chrome 111+/Firefox 113+/Safari 15+；color-mix() 在 Safari 16.2+；相对颜色（from）在 Chrome 119+/Safari 16.4+。HDR 需真实 HDR 显示器 + 浏览器 + 操作系统三方支持。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取概述信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runOverviewDemo() }),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.overviewInfo || '（点击「读取概述信息」查看 CSS Color Level 4/5 与 HDR 全景）')),
        h(Alert, {
          type: 'info',
          message: 'CSS Color L4/L5 让 CSS 摆脱 sRGB 局限，支持 HDR 广色域与感知均匀色彩',
          description: 'color() 指定任意色彩空间（display-p3/rec2020/xyz 等），oklch() 提供感知均匀色彩空间（亮度/饱和度线性可调，适合设计系统色阶生成），color-mix() 在指定空间混色，相对颜色（from）派生主题色调变体。HDR 需要 Display P3/Rec2020 显示器 + 真实浏览器才完整呈现，jsdom 不做真实渲染但 CSS.supports 可用。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：color() 函数与色彩空间 ===================

  _readColorFuncInfo() {
    const f = this._flags();
    try {
      const swatch = this.el && this.el.querySelector('.cs-display-p3');
      let computed = '(未渲染)';
      if (swatch) {
        computed = window.getComputedStyle(swatch).getPropertyValue('background-color') ||
                   window.getComputedStyle(swatch).getPropertyValue('background') || '(空)';
      }
      return `===== color() 函数与色彩空间 =====\n` +
        `\n` +
        `【语法】\n` +
        `  color( <colorspace> <component>... / <alpha>? )\n` +
        `  示例：color(display-p3 1 0 0)  /* Display P3 鲜艳红 */\n` +
        `        color(rec2020 1 0 0)    /* Rec2020 鲇艳红，色域更广 */\n` +
        `        color(xyz-d65 0.5 0.2 0.1)\n` +
        `\n` +
        `【预定义色彩空间全集（CSS Color L4）】\n` +
        `  srgb            —— 标准 sRGB（与 rgb() 等价基准）\n` +
        `  srgb-linear     —— 线性 sRGB（无 gamma 校正，用于中间计算）\n` +
        `  display-p3      —— Apple Display P3（iPhone/Mac，覆盖 sRGB + 鲜艳红绿）\n` +
        `  a98-rgb         —— Adobe RGB (1998)（印刷与摄影）\n` +
        `  prophoto-rgb    —— ProPhoto RGB（色域最广，部分超可见光，谨慎用）\n` +
        `  rec2020         —— Rec2020（UHDTV 标准，色域最广）\n` +
        `  xyz             —— CIE XYZ（等同 xyz-d65）\n` +
        `  xyz-d50         —— CIE XYZ（D50 白点，印刷标准）\n` +
        `  xyz-d65         —— CIE XYZ（D65 白点，sRGB 默认白点）\n` +
        `\n` +
        `【自定义 @color profile】\n` +
        `  @color-profile --my-colors {\n` +
        `    src: url(my-colors.icc);\n` +
        `  }\n` +
        `  .custom { color: color(--my-colors 0.5 0.3 0.2); }\n` +
        `  通过 ICC profile 加载自定义色彩空间（如 CMYK、专色 Pantone）\n` +
        `\n` +
        `【当前演示元素】\n` +
        `  .cs-display-p3 { background: color(display-p3 1 0 0); }\n` +
        `    background 计算值="${computed}"\n` +
        `  当前切换色彩空间: ${this._colorSpaceMode}\n` +
        `  CSS.supports('color','color(display-p3 1 0 0)') = ${f.colorFunc}\n` +
        `\n` +
        `【Display P3 vs sRGB 视觉差异】\n` +
        `  在 HDR / 广色域显示器上，color(display-p3 1 0 0) 比 rgb(255,0,0) 更鲜艳\n` +
        `  sRGB 红色约 (0.64, 0.33) 色坐标，Display P3 红色约 (0.68, 0.32)\n` +
        `  Display P3 覆盖 sRGB 全部 + 额外 35% 鲜艳红绿色域\n` +
        `  在 sRGB 显示器上两者视觉一致（浏览器降级渲染）\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  /* 各色彩空间红色对比 */\n` +
        `  .srgb-red     { background: rgb(100% 0% 0%); }\n` +
        `  .p3-red       { background: color(display-p3 1 0 0); }\n` +
        `  .rec2020-red  { background: color(rec2020 1 0 0); }\n` +
        `  .a98-red      { background: color(a98-rgb 1 0 0); }\n` +
        `  .prophoto-red { background: color(prophoto-rgb 1 0 0); }\n` +
        `  .xyz-mix      { background: color(xyz-d65 0.5 0.2 0.1); }\n` +
        `\n` +
        `  /* 自定义 ICC profile（CMYK 印刷）*/\n` +
        `  @color-profile --cmyk-coated {\n` +
        `    src: url(CoatedFOGRA27.icc);\n` +
        `  }\n` +
        `  .print-color { color: color(--cmyk-coated 0.5 0.2 0.1 0.1); }`;
    } catch (err) {
      return `读取 color() 信息失败：${err.name} - ${err.message}`;
    }
  }

  _setColorSpaceMode(mode) {
    this._colorSpaceMode = mode;
    this._injectStyle('css-color-space-dynamic',
      `.cs-swatch.active { background: color(${mode} 1 0 0); }`);
    this.setState({ colorFuncInfo: this._readColorFuncInfo() });
    this._addLog('color', `切换 color() 色彩空间 → ${mode}`);
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. color() 函数与色彩空间 —— display-p3 / rec2020 / xyz 全集',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['color()', f.colorFunc]]),
        h(Tag, { color: 'primary' }, 'CSS Color L4'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'color() 函数指定任意色彩空间：color(display-p3 1 0 0) 表达 Display P3 鲜艳红。预定义色彩空间全集：srgb / srgb-linear / display-p3（Apple 主推）/ a98-rgb（Adobe RGB）/ prophoto-rgb（色域最广）/ rec2020（UHDTV）/ xyz / xyz-d50 / xyz-d65。自定义 @color-profile 通过 ICC profile 加载自定义色彩空间（如 CMYK 印刷、Pantone 专色）。在 HDR/广色域显示器上 color(display-p3 1 0 0) 比 rgb(255,0,0) 更鲜艳，sRGB 显示器上两者视觉一致（浏览器降级渲染）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ colorFuncInfo: this._readColorFuncInfo() }) }),
          this._btn('srgb', { size: 'sm', disabled: !f.colorFunc, onClick: () => this._setColorSpaceMode('srgb') }),
          this._btn('display-p3', { size: 'sm', disabled: !f.colorFunc, onClick: () => this._setColorSpaceMode('display-p3') }),
          this._btn('rec2020', { size: 'sm', disabled: !f.colorFunc, onClick: () => this._setColorSpaceMode('rec2020') }),
          this._btn('a98-rgb', { size: 'sm', disabled: !f.colorFunc, onClick: () => this._setColorSpaceMode('a98-rgb') }),
          this._btn('prophoto-rgb', { size: 'sm', disabled: !f.colorFunc, onClick: () => this._setColorSpaceMode('prophoto-rgb') }),
          this._btn('xyz-d65', { size: 'sm', disabled: !f.colorFunc, onClick: () => this._setColorSpaceMode('xyz-d65') }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '各色彩空间红色对比（HDR 显示器可见差异）：'),
        h('div', { class: 'cs-swatch-row' },
          h('div', { class: 'cs-swatch cs-srgb' }, 'srgb'),
          h('div', { class: 'cs-swatch cs-display-p3' }, 'display-p3'),
          h('div', { class: 'cs-swatch cs-rec2020' }, 'rec2020'),
          h('div', { class: 'cs-swatch cs-a98' }, 'a98-rgb'),
          h('div', { class: 'cs-swatch cs-prophoto' }, 'prophoto'),
          h('div', { class: 'cs-swatch cs-xyz-d65' }, 'xyz-d65'),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.colorFuncInfo || '（点击按钮切换 color() 色彩空间查看说明）')),
        h(Alert, {
          type: 'info',
          message: 'color() 让 CSS 表达 sRGB 之外的广色域颜色',
          description: 'Display P3 覆盖 sRGB + 35% 鲜艳红绿（iPhone/Mac 标准）；Rec2020 色域最广（UHDTV 4K/8K）；prophoto-rgb 部分超出可见光需谨慎。自定义 @color-profile 通过 ICC profile 支持 CMYK 印刷与 Pantone 专色。HDR 显示器上可见差异，sRGB 显示器浏览器自动降级渲染。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：oklch/lab/lch 感知色 ===================

  _readOklchInfo() {
    const f = this._flags();
    try {
      const step = this.el && this.el.querySelector('.oklch-l70');
      let computed = '(未渲染)';
      if (step) {
        computed = window.getComputedStyle(step).getPropertyValue('background-color') || '(空)';
      }
      return `===== oklch() / lab() / lch() 感知均匀色彩空间 =====\n` +
        `\n` +
        `【函数语法】\n` +
        `  oklch(L C H / A?)   —— L 亮度 0~1 / C 彩度 0~0.4+ / H 色相 0~360\n` +
        `  oklab(L a b / A?)   —— L 亮度 / a 红绿轴 / b 黄蓝轴\n` +
        `  lab(L a b / A?)     —— CIE Lab（L 0~100%/0~100 / a b 通常 -125~125）\n` +
        `  lch(L C H / A?)     —— CIE LCH（极坐标版 Lab）\n` +
        `\n` +
        `【感知均匀色彩空间】\n` +
        `  感知均匀：相同数值增量产生相同视觉差异\n` +
        `  oklch 由 Björn Ottosson 2020 提出，是 Lab 的改进版\n` +
        `    修正 Lab 在蓝色区域感知不均、色相偏移问题\n` +
        `    已被 CSS Color L4 选为推荐感知色函数\n` +
        `  Lab/LCH 源自 CIE 1976，老牌标准但感知不完美\n` +
        `\n` +
        `【vs HSL 优势】\n` +
        `  HSL 感知不均匀：HSL(0,100%,50%) 与 HSL(60,100%,50%) 视觉亮度差异巨大\n` +
        `  HSL 调 L 时饱和度失真：L=50% 最饱和，L=0/100% 灰色\n` +
        `  oklch L 线性可调：oklch(0.5 0.2 250) → oklch(0.7 0.2 250) 亮度均匀增加\n` +
        `  oklch C 线性可调：彩度（chroma）独立于亮度，调 C 不影响 L\n` +
        `  oklch H 纴性可调：色相旋转保持 L 与 C 不变\n` +
        `\n` +
        `【设计系统色阶生成】\n` +
        `  用 oklch 生成 50/100/200/.../900 色阶，亮度线性递增，彩度/色相不变\n` +
        `    --blue-50:  oklch(0.97 0.02 250);\n` +
        `    --blue-100: oklch(0.93 0.05 250);\n` +
        `    --blue-500: oklch(0.60 0.20 250);  /* 主色 */\n` +
        `    --blue-900: oklch(0.30 0.10 250);\n` +
        `  Tailwind v4 / Radix Colors / Stripe 设计系统均采用 oklch 生成色阶\n` +
        `\n` +
        `【当前演示元素】\n` +
        `  .oklch-l70 { background: oklch(0.7 0.2 250); }\n` +
        `    background 计算值="${computed}"\n` +
        `  当前感知色函数: ${this._oklchMode}\n` +
        `  CSS.supports('color','oklch(0.5 0.1 200)') = ${f.oklch}\n` +
        `  CSS.supports('color','oklab(0.5 0.1 0.1)') = ${f.oklab}\n` +
        `  CSS.supports('color','lab(50% 40 30)')      = ${f.lab}\n` +
        `  CSS.supports('color','lch(50% 40 30)')       = ${f.lch}\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  /* oklch 生成蓝色色阶（亮度线性递增）*/\n` +
        `  :root {\n` +
        `    --blue-50:  oklch(0.97 0.02 250);\n` +
        `    --blue-100: oklch(0.93 0.05 250);\n` +
        `    --blue-200: oklch(0.88 0.08 250);\n` +
        `    --blue-300: oklch(0.80 0.12 250);\n` +
        `    --blue-400: oklch(0.70 0.17 250);\n` +
        `    --blue-500: oklch(0.60 0.20 250);  /* 主色 */\n` +
        `    --blue-600: oklch(0.55 0.20 250);\n` +
        `    --blue-700: oklch(0.48 0.18 250);\n` +
        `    --blue-800: oklch(0.40 0.14 250);\n` +
        `    --blue-900: oklch(0.30 0.10 250);\n` +
        `  }\n` +
        `\n` +
        `  /* oklab（直角坐标）vs oklch（极坐标）等价转换 */\n` +
        `  .oklab-blue { color: oklab(0.60 -0.10 -0.15); }\n` +
        `  .oklch-blue { color: oklch(0.60 0.18 250); }  /* 等价 */\n` +
        `\n` +
        `  /* CIE Lab/LCH（老牌标准，仍广泛使用）*/\n` +
        `  .lab-red { color: lab(50% 60 40); }\n` +
        `  .lch-red { color: lch(50% 70 30); }`;
    } catch (err) {
      return `读取 oklch 信息失败：${err.name} - ${err.message}`;
    }
  }

  _setOklchMode(mode) {
    this._oklchMode = mode;
    this.setState({ oklchInfo: this._readOklchInfo() });
    this._addLog('oklch', `切换感知色函数 → ${mode}`);
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. oklch()/lab()/lch() 感知色 —— 设计系统色阶生成',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['oklch()', f.oklch], ['lab()', f.lab], ['lch()', f.lch]]),
        h(Tag, { color: 'primary' }, '感知均匀'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'oklch(L C H) / oklab(L a b) 是 CSS Color L4 推荐的感知均匀色彩空间，由 Björn Ottosson 2020 提出改进 CIE Lab。vs HSL 优势：HSL 感知不均匀（H 0° 与 60° 视觉亮度差异巨大），调 L 时饱和度失真；oklch L/C/H 三轴独立可调，亮度线性递增生成设计系统色阶（Tailwind v4 / Radix Colors / Stripe 采用）。lab()/lch() 是 CIE 1976 老牌标准（Lab 直角坐标 a 红绿/b 黄蓝，LCH 极坐标 C 彩度/H 色相），仍广泛使用但蓝色区域感知不完美。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ oklchInfo: this._readOklchInfo() }) }),
          this._btn('oklch', { size: 'sm', disabled: !f.oklch, onClick: () => this._setOklchMode('oklch') }),
          this._btn('oklab', { size: 'sm', disabled: !f.oklab, onClick: () => this._setOklchMode('oklab') }),
          this._btn('lab', { size: 'sm', disabled: !f.lab, onClick: () => this._setOklchMode('lab') }),
          this._btn('lch', { size: 'sm', disabled: !f.lch, onClick: () => this._setOklchMode('lch') }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'oklch 蓝色色阶（亮度 0.5→0.9 线性递增，C/H 不变）：'),
        h('div', { class: 'oklch-scale' },
          h('div', { class: 'oklch-step oklch-l50' }, 'L=0.5'),
          h('div', { class: 'oklch-step oklch-l60' }, 'L=0.6'),
          h('div', { class: 'oklch-step oklch-l70' }, 'L=0.7'),
          h('div', { class: 'oklch-step oklch-l80' }, 'L=0.8'),
          h('div', { class: 'oklch-step oklch-l90' }, 'L=0.9'),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.oklchInfo || '（点击按钮查看 oklch/lab/lch 完整说明与色阶生成代码）')),
        h(Alert, {
          type: 'info',
          message: 'oklch 是 CSS Color L4 推荐感知色函数，Tailwind v4 / Radix Colors 采用',
          description: 'oklch L/C/H 三轴独立可调，亮度线性递增生成设计系统色阶（50/100/.../900），调 L 不影响 C/H，调 H 保持 L/C 不变。vs HSL：HSL 调 L 时饱和度失真，H 轴感知不均匀。oklch 由 Björn Ottosson 2020 提出改进 CIE Lab（修正蓝色区域感知不均、色相偏移）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：color-mix() 混色 ===================

  _readColorMixInfo() {
    const f = this._flags();
    try {
      const mix = this.el && this.el.querySelector('.mix-oklch-50');
      let computed = '(未渲染)';
      if (mix) {
        computed = window.getComputedStyle(mix).getPropertyValue('background-color') || '(空)';
      }
      return `===== color-mix() 混色 =====\n` +
        `\n` +
        `【语法】\n` +
        `  color-mix(in <colorspace>, <color1> <pct>?, <color2> <pct>?)\n` +
        `  示例：color-mix(in oklch, red, blue)              /* 50/50 混合 */\n` +
        `        color-mix(in srgb, red 50%, blue)           /* sRGB 空间混合 */\n` +
        `        color-mix(in oklch, red 25%, blue 75%)      /* 25/75 */\n` +
        `        color-mix(in lab, color(display-p3 1 0 0), blue)\n` +
        `\n` +
        `【支持的中间色彩空间】\n` +
        `  in srgb / in srgb-linear / in oklch / in oklab / in lab / in lch\n` +
        `  in xyz / in xyz-d50 / in xyz-d65\n` +
        `  也可指定极坐标色相插值方法：\n` +
        `    in oklch longer hue / shorter hue / increasing hue / decreasing hue\n` +
        `\n` +
        `【百分比语法】\n` +
        `  color-mix(in oklch, red 50%, blue 50%)  /* 显式 50/50 */\n` +
        `  color-mix(in oklch, red 50%, blue)      /* blue 自动补 50% */\n` +
        `  color-mix(in oklch, red, blue)          /* 省略 = 50/50 */\n` +
        `  color-mix(in oklch, red 70%, blue)      /* 70/30（归一化）*/\n` +
        `  color-mix(in oklch, red 70%, blue 50%)  /* 总和 120%，归一化为 58/42 */\n` +
        `\n` +
        `【透明度合并】\n` +
        `  color-mix(in srgb, rgb(255 0 0 / 0.5), rgb(0 0 255 / 0.5))\n` +
        `  → 透明度按 alpha 通道混合，颜色按指定空间混合\n` +
        `  常用于：半透明叠加层、毛玻璃背景、阴影色\n` +
        `\n` +
        `【与 design tokens 协同】\n` +
        `  :root {\n` +
        `    --brand: #2563eb;\n` +
        `    --brand-hover: color-mix(in oklch, var(--brand), white 15%);\n` +
        `    --brand-active: color-mix(in oklch, var(--brand), black 15%);\n` +
        `    --brand-disabled: color-mix(in srgb, var(--brand) 50%, transparent);\n` +
        `  }\n` +
        `  一行代码派生 hover/active/disabled 变体，无需手动算 hex\n` +
        `\n` +
        `【当前演示元素】\n` +
        `  .mix-oklch-50 { background: color-mix(in oklch, red 50%, blue); }\n` +
        `    background 计算值="${computed}"\n` +
        `  当前中间空间: ${this._mixMode}\n` +
        `  CSS.supports('color','color-mix(in oklch, red, blue)') = ${f.colorMix}\n` +
        `\n` +
        `【oklch vs srgb 混色差异】\n` +
        `  in srgb：在 sRGB 空间线性插值，中间色偏灰暗（"灰色死区"）\n` +
        `  in oklch：在感知均匀空间插值，中间色保持饱和度，过渡自然\n` +
        `  渐变色带修复：linear-gradient(in oklch, blue, red) 比 srgb 过渡更鲜艳\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  /* 设计系统派生色 */\n` +
        `  :root {\n` +
        `    --primary: oklch(0.60 0.20 250);\n` +
        `    --primary-hover: color-mix(in oklch, var(--primary), white 15%);\n` +
        `    --primary-active: color-mix(in oklch, var(--primary), black 15%);\n` +
        `    --primary-soft: color-mix(in srgb, var(--primary) 20%, white);\n` +
        `  }\n` +
        `  .btn { background: var(--primary); }\n` +
        `  .btn:hover { background: var(--primary-hover); }\n` +
        `  .btn:active { background: var(--primary-active); }\n` +
        `  .btn:disabled { background: var(--primary-soft); }\n` +
        `\n` +
        `  /* 色相旋转混色（longer/shorter hue）*/\n` +
        `  .hue-rotate-short { background: color-mix(in oklch shorter hue, red, blue); }\n` +
        `  .hue-rotate-long  { background: color-mix(in oklch longer hue, red, blue); }`;
    } catch (err) {
      return `读取 color-mix 信息失败：${err.name} - ${err.message}`;
    }
  }

  _setMixMode(mode) {
    this._mixMode = mode;
    this._injectStyle('css-color-mix-dynamic',
      `.mix-dynamic { background: color-mix(in ${mode}, red 50%, blue); }`);
    this.setState({ colorMixInfo: this._readColorMixInfo() });
    this._addLog('mix', `切换 color-mix 中间空间 → ${mode}`);
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. color-mix() 混色 —— 设计系统派生色 / 透明度合并',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['color-mix()', f.colorMix]]),
        h(Tag, { color: 'primary' }, 'CSS Color L5'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'color-mix(in <space>, <color1> <pct>?, <color2> <pct>?) 在指定色彩空间混合两色。支持中间空间：srgb/srgb-linear/oklch/oklab/lab/lch/xyz，可指定色相插值方法（longer/shorter/increasing/decreasing hue）。百分比语法：省略=50/50，自动补全，总和超 100% 归一化。透明度合并：alpha 通道按混合规则计算。与 design tokens 协同：一行 color-mix(in oklch, var(--brand), white 15%) 派生 hover/active/disabled 变体。in oklch 比 in srgb 混色更鲜艳（srgb 中间色偏灰暗"灰色死区"，oklch 感知均匀保持饱和度）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ colorMixInfo: this._readColorMixInfo() }) }),
          this._btn('in oklch', { size: 'sm', disabled: !f.colorMix, onClick: () => this._setMixMode('oklch') }),
          this._btn('in srgb', { size: 'sm', disabled: !f.colorMix, onClick: () => this._setMixMode('srgb') }),
          this._btn('in lab', { size: 'sm', disabled: !f.colorMix, onClick: () => this._setMixMode('lab') }),
          this._btn('in xyz-d65', { size: 'sm', disabled: !f.colorMix, onClick: () => this._setMixMode('xyz-d65') }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'color-mix 混色对比（oklch vs srgb 中间色差异）：'),
        h('div', { class: 'mix-stage' },
          h('div', { class: 'mix-box mix-a' }, 'red'),
          h('div', { class: 'mix-box mix-oklch-50' }, 'oklch 50%'),
          h('div', { class: 'mix-box mix-srgb-50' }, 'srgb 50%'),
          h('div', { class: 'mix-box mix-oklch-25' }, 'oklch 25%'),
          h('div', { class: 'mix-box mix-oklch-75' }, 'oklch 75%'),
          h('div', { class: 'mix-box mix-alpha' }, 'alpha 0.5'),
          h('div', { class: 'mix-box mix-b' }, 'blue'),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.colorMixInfo || '（点击按钮切换 color-mix 中间空间查看说明）')),
        h(Alert, {
          type: 'info',
          message: 'color-mix() 一行代码派生设计系统 hover/active/disabled 变体',
          description: '与 design tokens 协同：--brand-hover: color-mix(in oklch, var(--brand), white 15%) 自动派生变体。in oklch 比 in srgb 混色更鲜艳（srgb 中间色偏灰暗"灰色死区"，oklch 感知均匀保持饱和度）。支持透明度合并（alpha 通道混合）与色相插值方法（longer/shorter/increasing/decreasing hue）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：相对颜色（from 关键字）===================

  _readRelativeColorInfo() {
    const f = this._flags();
    try {
      const rel = this.el && this.el.querySelector('.rel-lighten');
      let computed = '(未渲染)';
      if (rel) {
        computed = window.getComputedStyle(rel).getPropertyValue('background-color') || '(空)';
      }
      return `===== 相对颜色（from 关键字）=====\n` +
        `\n` +
        `【语法】\n` +
        `  <func>(from <base-color> <channel>... / <alpha>?)\n` +
        `  支持函数：rgb() / rgba() / hsl() / hwb() / lab() / lch() / oklab() / oklch() / color()\n` +
        `  示例：rgb(from red r g b)                       /* 提取通道 */\n` +
        `        oklch(from red calc(l + 0.1) c h)         /* 亮度 +0.1 */\n` +
        `        hsl(from red calc(h + 60) s l)            /* 色相 +60° */\n` +
        `        rgb(from red r g b / 0.5)                 /* 提取并改 alpha */\n` +
        `\n` +
        `【通道变量】\n` +
        `  rgb()  → r g b（0~255）\n` +
        `  hsl()  → h s l（h: 0~360, s/l: 0~100%）\n` +
        `  lab()/lch()  → L a b / L C H\n` +
        `  oklab()/oklch() → l a b / l c h（l: 0~1）\n` +
        `  color() → 通道名依色彩空间（如 display-p3 的 r g b）\n` +
        `  alpha 通道用 alpha 变量（所有函数通用）\n` +
        `\n` +
        `【提取并修改通道】\n` +
        `  /* 提取红色通道，其他置 0 */\n` +
        `  .only-red { background: rgb(from #2563eb r 0 0); }\n` +
        `\n` +
        `  /* 修改 alpha（保留颜色）*/\n` +
        `  .semi-transparent { background: rgb(from #2563eb r g b / 0.5); }\n` +
        `\n` +
        `  /* 旋转色相 60° */\n` +
        `  .hue-60 { background: hsl(from #2563eb calc(h + 60) s l); }\n` +
        `\n` +
        `【主题色调派生】\n` +
        `  :root {\n` +
        `    --brand: #2563eb;\n` +
        `    --brand-light: oklch(from var(--brand) calc(l + 0.15) c h);\n` +
        `    --brand-dark:  oklch(from var(--brand) calc(l - 0.15) c h);\n` +
        `    --brand-saturate: oklch(from var(--brand) l calc(c + 0.05) h);\n` +
        `    --brand-hue-60: oklch(from var(--brand) l c calc(h + 60));\n` +
        `    --brand-alpha: rgb(from var(--brand) r g b / 0.4);\n` +
        `  }\n` +
        `  比 color-mix 更灵活：可单独修改某一通道（color-mix 只能整体混合）\n` +
        `\n` +
        `【color-contrast() 提案】\n` +
        `  color-contrast(<base> vs <color1>, <color2>, ...)\n` +
        `  自动选择与 base 对比度最高的颜色（WCAG 无障碍）\n` +
        `  示例：color: color-contrast(var(--bg) vs white, black)\n` +
        `  状态：CSS Color L5 提案中，仅 Safari 16.4+ 部分支持，生产慎用\n` +
        `\n` +
        `【当前演示元素】\n` +
        `  .rel-lighten { background: oklch(from #2563eb calc(l + 0.15) c h); }\n` +
        `    background 计算值="${computed}"\n` +
        `  当前模式: ${this._relativeMode}\n` +
        `  CSS.supports('color','rgb(from red r g b)')          = ${f.relativeColor}\n` +
        `  CSS.supports('color','oklch(from red calc(l + 0.1) c h)') = ${f.relativeOklch}\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  /* 主题色调派生（一次定义，自动派生变体）*/\n` +
        `  :root {\n` +
        `    --primary: #2563eb;\n` +
        `    --primary-50:  oklch(from var(--primary) 0.95 c h);\n` +
        `    --primary-100: oklch(from var(--primary) 0.90 c h);\n` +
        `    --primary-500: var(--primary);\n` +
        `    --primary-900: oklch(from var(--primary) 0.30 c h);\n` +
        `    --primary-hover:  oklch(from var(--primary) calc(l + 0.10) c h);\n` +
        `    --primary-active: oklch(from var(--primary) calc(l - 0.10) c h);\n` +
        `  }\n` +
        `\n` +
        `  /* 配合 @property 类型检查（更安全）*/\n` +
        `  @property --brand {\n` +
        `    syntax: '<color>';\n` +
        `    initial-value: #2563eb;\n` +
        `    inherits: true;\n` +
        `  }`;
    } catch (err) {
      return `读取相对颜色信息失败：${err.name} - ${err.message}`;
    }
  }

  _setRelativeMode(mode) {
    this._relativeMode = mode;
    this.setState({ relativeColorInfo: this._readRelativeColorInfo() });
    this._addLog('relative', `切换相对颜色模式 → ${mode}`);
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. 相对颜色（from 关键字）—— 主题色调派生',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['rgb(from)', f.relativeColor], ['oklch(from)', f.relativeOklch]]),
        h(Tag, { color: 'primary' }, 'CSS Color L5'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '相对颜色用 from 关键字派生颜色：<func>(from <base> <channel>...)，支持 rgb/hsl/lab/lch/oklab/oklch/color()。通道变量：rgb→r g b，oklch→l c h，hsl→h s l，alpha 通用。提取并修改通道：rgb(from #2563eb r 0 0) 仅保留红色通道，rgb(from red r g b / 0.5) 改 alpha。主题色调派生：oklch(from var(--brand) calc(l + 0.15) c h) 派生亮色变体，比 color-mix 更灵活（可单独修改某一通道）。color-contrast() 提案自动选择 WCAG 对比度最高颜色，仅 Safari 16.4+ 部分支持。浏览器：Chrome 119+/Firefox 128+/Safari 16.4+。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ relativeColorInfo: this._readRelativeColorInfo() }) }),
          this._btn('lighten', { size: 'sm', disabled: !f.relativeOklch, onClick: () => this._setRelativeMode('lighten') }),
          this._btn('darken', { size: 'sm', disabled: !f.relativeOklch, onClick: () => this._setRelativeMode('darken') }),
          this._btn('saturate', { size: 'sm', disabled: !f.relativeOklch, onClick: () => this._setRelativeMode('saturate') }),
          this._btn('hue+60', { size: 'sm', disabled: !f.relativeOklch, onClick: () => this._setRelativeMode('hue') }),
          this._btn('alpha', { size: 'sm', disabled: !f.relativeColor, onClick: () => this._setRelativeMode('alpha') }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '相对颜色派生变体（基础色 #2563eb）：'),
        h('div', { class: 'rel-stage' },
          h('div', { class: 'rel-box rel-base' }, 'base'),
          h('div', { class: 'rel-box rel-lighten' }, 'lighten'),
          h('div', { class: 'rel-box rel-darken' }, 'darken'),
          h('div', { class: 'rel-box rel-saturate' }, 'saturate'),
          h('div', { class: 'rel-box rel-hue' }, 'hue+60'),
          h('div', { class: 'rel-box rel-alpha' }, 'alpha 0.4'),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.relativeColorInfo || '（点击按钮切换相对颜色模式查看说明）')),
        h(Alert, {
          type: 'info',
          message: '相对颜色（from）比 color-mix 更灵活，可单独修改某一通道',
          description: '主题色调派生：oklch(from var(--brand) calc(l + 0.15) c h) 派生亮色变体，调 L 不影响 C/H。提取通道：rgb(from red r 0 0) 仅保留红色。color-contrast() 提案自动选 WCAG 对比度最高颜色（仅 Safari 16.4+ 部分支持）。浏览器：Chrome 119+/Firefox 128+/Safari 16.4+。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：HDR 与 dynamic-range ===================

  _readHdrInfo() {
    const f = this._flags();
    try {
      return `===== HDR 与 dynamic-range 媒体查询 =====\n` +
        `\n` +
        `【HDR 媒体查询】\n` +
        `  @media (dynamic-range: high)   /* HDR 显示器 + 浏览器支持 */\n` +
        `  @media (dynamic-range: standard)  /* SDR 标准 */\n` +
        `\n` +
        `【广色域媒体查询】\n` +
        `  @media (color-gamut: srgb)     /* sRGB 色域（基准）*/\n` +
        `  @media (color-gamut: p3)       /* Display P3 广色域 */\n` +
        `  @media (color-gamut: rec2020)  /* Rec2020 超广色域 */\n` +
        `\n` +
        `【对比度偏好】\n` +
        `  @media (prefers-contrast: more)    /* 用户偏好高对比度 */\n` +
        `  @media (prefers-contrast: less)    /* 用户偏好低对比度 */\n` +
        `  @media (prefers-contrast: custom)  /* 自定义（强制/无障碍）*/\n` +
        `\n` +
        `【system-color 系统颜色】\n` +
        `  Canvas / LinkText / ButtonText / Field / Highlight 等\n` +
        `  反映操作系统主题色（如 macOS 强调色、Windows 高对比度模式）\n` +
        `  CSS Color L4 重新定义 system-color() 函数：color-mix(in srgb, Canvas 50%, transparent)\n` +
        `\n` +
        `【HDR 视频背景】\n` +
        `  video { mix-blend-mode: normal; }\n` +
        `  .hdr-bg {\n` +
        `    background: color(display-p3 1 0 0);\n` +
        `    /* 在 HDR 显示器上呈现鲜艳红色 */\n` +
        `  }\n` +
        `  @media (dynamic-range: high) {\n` +
        `    .hdr-bg { background: color(rec2020 1 0 0); }  /* 更广色域 */\n` +
        `  }\n` +
        `\n` +
        `【HDR 显示检测】\n` +
        `  方法 1：matchMedia('(dynamic-range: high)').matches\n` +
        `  方法 2：matchMedia('(color-gamut: p3)').matches\n` +
        `  方法 3：matchMedia('(color-gamut: rec2020)').matches\n` +
        `  ⚠ 需 HDR 显示器 + 浏览器 + 操作系统三方支持\n` +
        `    Windows: HDR 模式需在"显示设置"开启\n` +
        `    macOS: 仅 MacBook Pro / iMac 4K/5K 等支持\n` +
        `\n` +
        `【当前演示】\n` +
        `  当前媒体查询模式: ${this._hdrMode}\n` +
        `  matchMedia('(dynamic-range: high)').matches  = ${f.dynamicRangeHigh}\n` +
        `  matchMedia('(color-gamut: p3)').matches      = ${f.colorGamutP3}\n` +
        `  matchMedia('(color-gamut: rec2020)').matches = ${f.colorGamutRec2020}\n` +
        `  matchMedia('(prefers-contrast: more)').matches = ${f.prefersContrast}\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  /* HDR 渐进增强 */\n` +
        `  .hero {\n` +
        `    background: linear-gradient(red, blue);  /* SDR 默认 */\n` +
        `  }\n` +
        `  @media (color-gamut: p3) {\n` +
        `    .hero {\n` +
        `      background: linear-gradient(color(display-p3 1 0 0), color(display-p3 0 0 1));\n` +
        `    }\n` +
        `  }\n` +
        `  @media (color-gamut: rec2020) {\n` +
        `    .hero {\n` +
        `      background: linear-gradient(color(rec2020 1 0 0), color(rec2020 0 0 1));\n` +
        `    }\n` +
        `  }\n` +
        `\n` +
        `  /* prefers-contrast 高对比度模式 */\n` +
        `  @media (prefers-contrast: more) {\n` +
        `    :root { --text: #000; --bg: #fff; }\n` +
        `    .card { border: 2px solid var(--text); }\n` +
        `  }\n` +
        `\n` +
        `  /* system-color 系统颜色 */\n` +
        `  body { background: Canvas; color: CanvasText; }\n` +
        `  a { color: LinkText; }\n` +
        `  input { background: Field; color: FieldText; }`;
    } catch (err) {
      return `读取 HDR 信息失败：${err.name} - ${err.message}`;
    }
  }

  _setHdrMode(mode) {
    this._hdrMode = mode;
    this.setState({ hdrInfo: this._readHdrInfo() });
    this._addLog('hdr', `切换 HDR 媒体查询模式 → ${mode}（dynamic-range:high=${this._flags().dynamicRangeHigh}, color-gamut:p3=${this._flags().colorGamutP3}）`);
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. HDR 与 dynamic-range —— 媒体查询与系统颜色',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['dynamic-range:high', f.dynamicRangeHigh],
          ['color-gamut:p3', f.colorGamutP3],
          ['prefers-contrast', f.prefersContrast],
        ]),
        h(Tag, { color: 'primary' }, 'HDR 媒体查询'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'HDR 与广色域媒体查询：@media (dynamic-range: high) 检测 HDR 显示器，@media (color-gamut: p3|rec2020) 检测广色域。prefers-contrast: more|less|custom 用户对比度偏好。system-color（Canvas/LinkText/ButtonText/Field 等）反映操作系统主题色，CSS Color L4 重新定义为函数可混色。HDR 视频背景在 HDR 显示器上呈现鲜艳颜色。HDR 显示检测需三方支持：HDR 显示器 + 浏览器 + 操作系统（Windows HDR 模式 / macOS MacBook Pro 等）。jsdom 通常不实现 matchMedia，真实浏览器 + HDR 显示器才能完整检测。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ hdrInfo: this._readHdrInfo() }) }),
          this._btn('dynamic-range', { size: 'sm', onClick: () => this._setHdrMode('dynamic-range') }),
          this._btn('color-gamut', { size: 'sm', onClick: () => this._setHdrMode('color-gamut') }),
          this._btn('prefers-contrast', { size: 'sm', onClick: () => this._setHdrMode('prefers-contrast') }),
        ),
        h('div', { class: 'hdr-stage' },
          h('div', { class: 'hdr-swatch hdr-sdr' }, 'SDR 渐变（sRGB red→blue）'),
          h('div', { class: 'hdr-swatch hdr-p3' }, 'P3 鲜艳红（HDR 显示器可见差异）'),
          h('div', { class: 'hdr-swatch hdr-rec2020' }, 'Rec2020 超广色域红'),
          h('div', { class: 'hdr-swatch hdr-contrast' }, 'prefers-contrast: more（高对比度边框）'),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.hdrInfo || '（点击按钮查看 HDR 媒体查询完整说明）')),
        h(Alert, {
          type: 'warning',
          message: 'HDR 需 HDR 显示器 + 浏览器 + 操作系统三方支持',
          description: 'matchMedia("(dynamic-range: high)") 需 HDR 显示器并开启 HDR 模式（Windows 显示设置 / macOS 自动）。color-gamut: p3 需 Display P3 显示器（iPhone/MacBook Pro/iMac 4K+）。jsdom 通常不实现 matchMedia 返回 false。真实浏览器 + HDR 显示器才能完整检测与呈现 HDR 效果。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 7：浏览器渲染与色彩管理 ===================

  _readRenderingInfo() {
    const f = this._flags();
    try {
      return `===== 浏览器渲染与色彩管理 =====\n` +
        `\n` +
        `【渲染管线 color space 转换】\n` +
        `  CSS 颜色值 → 解析为内部颜色对象（保留色彩空间信息）\n` +
        `  → 计算样式（保留色彩空间）\n` +
        `  → 绘制时转换为目标色彩空间（显示器原生色域）\n` +
        `  → 显示器呈现\n` +
        `  转换过程遵循 ICC profile 与色彩管理协议\n` +
        `\n` +
        `【ICC profile】\n` +
        `  ICC（International Color Consortium）profile 描述设备色彩空间\n` +
        `  浏览器内置 sRGB / Display P3 / Rec2020 等标准 ICC profile\n` +
        `  自定义 @color-profile --name { src: url(x.icc); } 加载外部 ICC\n` +
        `  渲染时浏览器按 ICC profile 转换颜色到显示器色域\n` +
        `\n` +
        `【canvas colorSpace 选项】\n` +
        `  const ctx = canvas.getContext('2d', { colorSpace: 'display-p3' });\n` +
        `  // 或 'srgb'（默认）\n` +
        `  // 创建 Display P3 画布，绘制内容用 P3 色彩空间\n` +
        `  // 适合 HDR 图像处理、P3 图片预览\n` +
        `  // Chrome 98+ / Safari 16.4+ 支持，Firefox 部分支持\n` +
        `\n` +
        `【drawImage 跨色彩空间】\n` +
        `  当源图像与目标 canvas 色彩空间不同时，drawImage 自动转换\n` +
        `  // P3 图片绘制到 sRGB canvas（色域裁剪）\n` +
        `  const img = new Image(); img.src = 'p3-photo.jpg';\n` +
        `  const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });\n` +
        `  ctx.drawImage(img, 0, 0);  // 自动 P3 → sRGB 转换\n` +
        `\n` +
        `【ImageData colorSpace】\n` +
        `  const imageData = ctx.getImageData(0, 0, w, h);\n` +
        `  console.log(imageData.colorSpace);  // 'srgb' | 'display-p3'\n` +
        `  // 反映 ImageData 的色彩空间\n` +
        `  // putImageData 时若色彩空间不匹配自动转换\n` +
        `\n` +
        `【能力检测】\n` +
        `  canvas colorSpace: 'display-p3' 支持 = ${f.canvasColorSpace}\n` +
        `  // 检测方法：\n` +
        `  // const c = document.createElement('canvas');\n` +
        `  // const ctx = c.getContext('2d', { colorSpace: 'display-p3' });\n` +
        `  // return ctx !== null;\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  // 创建 Display P3 画布绘制 HDR 图像\n` +
        `  const canvas = document.createElement('canvas');\n` +
        `  canvas.width = 800; canvas.height = 600;\n` +
        `  const ctx = canvas.getContext('2d', { colorSpace: 'display-p3' });\n` +
        `\n` +
        `  // 绘制 P3 鲜艳红色（P3 显示器可见）\n` +
        `  ctx.fillStyle = 'color(display-p3 1 0 0)';\n` +
        `  ctx.fillRect(0, 0, 400, 600);\n` +
        `\n` +
        `  // 绘制 sRGB 红色对比\n` +
        `  ctx.fillStyle = 'rgb(255, 0, 0)';\n` +
        `  ctx.fillRect(400, 0, 400, 600);\n` +
        `\n` +
        `  // 读取 ImageData 色彩空间\n` +
        `  const imageData = ctx.getImageData(0, 0, 800, 600);\n` +
        `  console.log(imageData.colorSpace);  // 'display-p3'\n` +
        `\n` +
        `  // drawImage 跨色彩空间（P3 图 → sRGB canvas 自动转换）\n` +
        `  const img = new Image();\n` +
        `  img.onload = () => {\n` +
        `    const srgbCanvas = document.createElement('canvas');\n` +
        `    const srgbCtx = srgbCanvas.getContext('2d', { colorSpace: 'srgb' });\n` +
        `    srgbCtx.drawImage(img, 0, 0);  // P3 → sRGB 色域裁剪\n` +
        `  };\n` +
        `  img.src = 'p3-photo.jpg';`;
    } catch (err) {
      return `读取渲染信息失败：${err.name} - ${err.message}`;
    }
  }

  _runRenderingDemo() {
    this.setState({ renderingInfo: this._readRenderingInfo() });
    const f = this._flags();
    this._addLog('rendering', `渲染与色彩管理演示：canvas colorSpace:display-p3=${f.canvasColorSpace}`);
    // 尝试在真实 canvas 上绘制 P3 vs sRGB 对比
    if (!f.canvasColorSpace) {
      this._addLog('warn', 'canvas colorSpace: display-p3 不可用，跳过真实绘制（Firefox 部分支持，Chrome 98+/Safari 16.4+ 支持）');
      return;
    }
    try {
      const canvas = this.el && this.el.querySelector('.canvas-stage canvas');
      if (!canvas) {
        this._addLog('warn', '未找到 canvas 元素，跳过绘制');
        return;
      }
      canvas.width = 240;
      canvas.height = 80;
      const ctx = canvas.getContext('2d', { colorSpace: 'display-p3' });
      if (!ctx) {
        this._addLog('warn', 'getContext("2d", { colorSpace: "display-p3" }) 返回 null');
        return;
      }
      ctx.fillStyle = 'color(display-p3 1 0 0)';
      ctx.fillRect(0, 0, 120, 80);
      ctx.fillStyle = 'rgb(255, 0, 0)';
      ctx.fillRect(120, 0, 120, 80);
      // 标注
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.fillText('display-p3', 10, 20);
      ctx.fillText('srgb', 140, 20);
      const out = this.el.querySelector('.rendering-output');
      if (out) {
        const imgData = ctx.getImageData(0, 0, 240, 80);
        out.textContent = `canvas 绘制完成：\n  colorSpace = ${imgData.colorSpace}\n  尺寸 = ${imgData.width}×${imgData.height}\n  P3 红色像素 [0,0] = rgba(${imgData.data[0]},${imgData.data[1]},${imgData.data[2]},${imgData.data[3]})\n  sRGB 红色像素 [120,0] = rgba(${imgData.data[(80*120+0)*4]},${imgData.data[(80*120+1)*4]},${imgData.data[(80*120+2)*4]},${imgData.data[(80*120+3)*4]})`;
      }
      this._addLog('info', 'canvas P3 vs sRGB 红色对比绘制完成（HDR 显示器可见差异）');
    } catch (err) {
      this._addLog('warn', `canvas 绘制失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard7() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. 浏览器渲染与色彩管理 —— canvas colorSpace / ICC profile',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['canvas P3', f.canvasColorSpace]]),
        h(Tag, { color: 'primary' }, '色彩管理'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '浏览器渲染管线：CSS 颜色值解析（保留色彩空间）→ 计算样式 → 绘制时转换为目标色域 → 显示器呈现，遵循 ICC profile 与色彩管理协议。canvas colorSpace 选项：getContext("2d", { colorSpace: "display-p3" }) 创建 P3 画布绘制 HDR 图像（Chrome 98+/Safari 16.4+，Firefox 部分支持）。drawImage 跨色彩空间自动转换（P3 图 → sRGB canvas 色域裁剪）。ImageData.colorSpace 反映像素色彩空间，putImageData 不匹配时自动转换。自定义 @color-profile 加载外部 ICC profile（如 CMYK 印刷、Pantone 专色）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行渲染演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runRenderingDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'canvas P3 vs sRGB 红色对比（HDR 显示器可见差异）：'),
        h('div', { class: 'canvas-stage' },
          h('canvas', { width: '240', height: '80' }, '（您的浏览器不支持 canvas）'),
          h('div', { class: 'color-output rendering-output' },
            f.canvasColorSpace
              ? '点击「运行渲染演示」在 canvas 上绘制 P3 vs sRGB 红色对比...'
              : 'canvas colorSpace: "display-p3" 不可用（Firefox 部分支持，Chrome 98+/Safari 16.4+ 支持），跳过真实绘制。',
          ),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.renderingInfo || '（点击「运行渲染演示」查看色彩管理完整说明）')),
        h(Alert, {
          type: 'info',
          message: 'canvas colorSpace: "display-p3" 创建 P3 画布绘制 HDR 图像',
          description: 'Chrome 98+/Safari 16.4+ 支持，Firefox 部分支持。drawImage 跨色彩空间自动转换（P3→sRGB 色域裁剪）。ImageData.colorSpace 反映像素色彩空间。自定义 @color-profile 加载外部 ICC profile 支持 CMYK 印刷与 Pantone 专色。渲染管线遵循 ICC profile 与色彩管理协议。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 8：实战与陷阱 ===================

  _readPitfallsInfo() {
    const f = this._flags();
    try {
      return `===== 实战与陷阱 =====\n` +
        `\n` +
        `【场景 1：暗色主题切换 + 色阶生成器】\n` +
        `  :root {\n` +
        `    --blue-500: oklch(0.60 0.20 250);\n` +
        `    --blue-50:  oklch(0.97 0.02 250);\n` +
        `    --blue-900: oklch(0.30 0.10 250);\n` +
        `  }\n` +
        `  [data-theme="dark"] {\n` +
        `    --blue-500: oklch(0.70 0.18 250);  /* 暗色主题提亮主色 */\n` +
        `    --blue-50:  oklch(0.30 0.10 250);  /* 暗色主题反转色阶 */\n` +
        `    --blue-900: oklch(0.97 0.02 250);\n` +
        `  }\n` +
        `  .btn { background: var(--blue-500); color: white; }\n` +
        `\n` +
        `【场景 2：设计系统 color-mix 应用】\n` +
        `  :root {\n` +
        `    --primary: #2563eb;\n` +
        `    --primary-hover:  color-mix(in oklch, var(--primary), white 15%);\n` +
        `    --primary-active: color-mix(in oklch, var(--primary), black 15%);\n` +
        `    --primary-soft:   color-mix(in srgb, var(--primary) 20%, white);\n` +
        `    --primary-border: color-mix(in oklch, var(--primary), black 30%);\n` +
        `  }\n` +
        `  .btn-primary { background: var(--primary); border: 1px solid var(--primary-border); }\n` +
        `  .btn-primary:hover  { background: var(--primary-hover); }\n` +
        `  .btn-primary:active { background: var(--primary-active); }\n` +
        `\n` +
        `【场景 3：浏览器降级（fallback）】\n` +
        `  /* 方案 1：双写（先 fallback 后现代）*/\n` +
        `  .box {\n` +
        `    color: rgb(255, 0, 0);                      /* fallback */\n` +
        `    color: color(display-p3 1 0 0);             /* 现代浏览器覆盖 */\n` +
        `  }\n` +
        `  /* 方案 2：@supports 检测 */\n` +
        `  .box { background: rgb(255, 0, 0); }\n` +
        `  @supports (color: color(display-p3 1 0 0)) {\n` +
        `    .box { background: color(display-p3 1 0 0); }\n` +
        `  }\n` +
        `  /* 方案 3：CSS.supports() JS 检测 */\n` +
        `  if (CSS.supports('color', 'color(display-p3 1 0 0)')) {\n` +
        `    document.documentElement.classList.add('p3');\n` +
        `  }\n` +
        `\n` +
        `【场景 4：WCAG 对比度（color-contrast 提案）】\n` +
        `  /* 提案：自动选择对比度最高颜色 */\n` +
        `  .text { color: color-contrast(var(--bg) vs white, black); }\n` +
        `  /* 现行方案：JS 计算 WCAG 对比度 */\n` +
        `  function contrastRatio(c1, c2) {\n` +
        `    const l1 = relativeLuminance(c1);\n` +
        `    const l2 = relativeLuminance(c2);\n` +
        `    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);\n` +
        `  }\n` +
        `  // WCAG AA 要求 ≥ 4.5:1（正文）/ 3:1（大字）\n` +
        `  // WCAG AAA 要求 ≥ 7:1（正文）/ 4.5:1（大字）\n` +
        `\n` +
        `【场景 5：渐变色带修复（灰色死区）】\n` +
        `  /* sRGB 渐变中间偏灰暗（"灰色死区"）*/\n` +
        `  .gradient-bad { background: linear-gradient(in srgb, blue, red); }\n` +
        `  /* oklch 渐变感知均匀，中间色保持饱和度 */\n` +
        `  .gradient-good { background: linear-gradient(in oklch, blue, red); }\n` +
        `  /* 或用 color-mix 中间点修复 */\n` +
        `  .gradient-fixed {\n` +
        `    background: linear-gradient(\n` +
        `      blue,\n` +
        `      color-mix(in oklch, blue, red),  /* 中间点 */\n` +
        `      red\n` +
        `    );\n` +
        `  }\n` +
        `\n` +
        `【陷阱清单】\n` +
        `  1. sRGB 显示器上 color(display-p3 1 0 0) 与 rgb(255,0,0) 视觉一致（浏览器降级）\n` +
        `     → 需 HDR/广色域显示器才见差异，开发时勿误判"无效果"\n` +
        `  2. oklch L 范围 0~1（不是 0~100），与 lab L 0~100% 易混淆\n` +
        `     → oklch(0.5 ...) vs lab(50% ...)；oklch L 用小数\n` +
        `  3. color-mix 百分比总和可超 100%（自动归一化）\n` +
        `     → color-mix(in oklch, red 70%, blue 50%) 实际 58/42，非 70/50\n` +
        `  4. 相对颜色通道变量区分大小写（oklch 用 l/c/h 小写，Lab 用 L/a/b 大写）\n` +
        `     → oklch(from red calc(l + 0.1) c h) vs lab(from red calc(L + 10) a b)\n` +
        `  5. prophoto-rgb 部分色域超出可见光，可能产生"虚拟"颜色\n` +
        `     → 谨慎使用，优先 display-p3 / rec2020\n` +
        `  6. canvas colorSpace Firefox 部分支持，需检测\n` +
        `     → if (!ctx) fallback 到 srgb\n` +
        `  7. color-contrast() 仅 Safari 16.4+ 部分支持，生产用 JS 计算\n` +
        `  8. HDR 媒体查询需三方支持（显示器+浏览器+操作系统）\n` +
        `     → matchMedia 在 jsdom 返回 false 勿误判\n` +
        `\n` +
        `【能力检测汇总】\n` +
        `  color()        = ${f.colorFunc}\n` +
        `  oklch()        = ${f.oklch}\n` +
        `  color-mix()    = ${f.colorMix}\n` +
        `  相对颜色(from) = ${f.relativeColor}\n` +
        `  dynamic-range  = ${f.dynamicRangeHigh}\n` +
        `  color-gamut:p3 = ${f.colorGamutP3}\n` +
        `  canvas P3      = ${f.canvasColorSpace}`;
    } catch (err) {
      return `读取实战与陷阱信息失败：${err.name} - ${err.message}`;
    }
  }

  _runPitfallsDemo() {
    this.setState({ pitfallsInfo: this._readPitfallsInfo() });
    const f = this._flags();
    this._addLog('pitfalls', `实战与陷阱演示：color-mix=${f.colorMix}, 相对颜色=${f.relativeColor}, canvas P3=${f.canvasColorSpace}`);
  }

  _renderCard8() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 实战与陷阱 —— 暗色主题 / color-mix / 降级 / WCAG / 渐变修复',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['color-mix', f.colorMix], ['relative-color', f.relativeColor]]),
        h(Tag, { color: 'warning' }, '5 大场景'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '五大实战场景：暗色主题切换 + 色阶生成器（oklch 反转色阶）、设计系统 color-mix 派生变体（hover/active/soft/border）、浏览器降级（双写 / @supports / CSS.supports 三方案）、WCAG 对比度（color-contrast 提案 + JS 计算 relativeLuminance，AA ≥4.5:1 / AAA ≥7:1）、渐变色带修复（in oklch 替代 in srgb 消除"灰色死区"）。8 大陷阱：sRGB 显示器无差异、oklch L 范围 0~1、color-mix 百分比归一化、通道变量大小写、prophoto-rgb 超可见光、canvas colorSpace 兼容、color-contrast 仅 Safari、HDR 三方支持。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行实战与陷阱演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runPitfallsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'oklch 色阶生成器 + 渐变色带修复对比：'),
        h('div', { class: 'theme-stage light' },
          h('div', { class: 'fs-sm' }, '亮色主题 oklch 蓝色色阶（L 0.97→0.30 线性递减）：'),
          h('div', { class: 'scale-row' },
            h('div', { class: 'scale-step', style: { background: 'oklch(0.97 0.02 250)', color: '#000' } }, '50'),
            h('div', { class: 'scale-step', style: { background: 'oklch(0.80 0.12 250)' } }, '300'),
            h('div', { class: 'scale-step', style: { background: 'oklch(0.60 0.20 250)' } }, '500'),
            h('div', { class: 'scale-step', style: { background: 'oklch(0.40 0.14 250)' } }, '800'),
            h('div', { class: 'scale-step', style: { background: 'oklch(0.30 0.10 250)' } }, '900'),
          ),
          h('div', { class: 'fs-sm', style: { marginTop: '8px' } }, '渐变色带修复（srgb 灰色死区 vs oklch 感知均匀）：'),
          h('div', { class: 'gradient-bad' }),
          h('div', { class: 'fs-sm', style: { marginTop: '4px', fontSize: '10px' } }, '↑ linear-gradient(in srgb, blue, red) —— 中间偏灰暗'),
          h('div', { class: 'gradient-good' }),
          h('div', { class: 'fs-sm', style: { marginTop: '4px', fontSize: '10px' } }, '↑ linear-gradient(in oklch, blue, red) —— 中间保持饱和度'),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.pitfallsInfo || '（点击按钮查看 5 大实战场景与 8 大陷阱完整说明）')),
        h(Alert, {
          type: 'warning',
          message: 'sRGB 显示器上 color(display-p3) 与 rgb() 视觉一致，需 HDR 显示器才见差异',
          description: '陷阱清单：oklch L 范围 0~1（非 0~100）；color-mix 百分比超 100% 自动归一化；相对颜色通道变量大小写敏感（oklch 小写 l/c/h，Lab 大写 L/a/b）；prophoto-rgb 部分超可见光；canvas colorSpace Firefox 部分支持需检测；color-contrast() 仅 Safari 16.4+；HDR 需三方支持。降级方案：双写 / @supports / CSS.supports 三选一。',
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
        : s.logs.slice().reverse().map((log) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  // =================== 整页渲染 ===================

  render() {
    const s = this.state;
    return h('div', { class: 'api-lab-page css-color-hdr-deep-page' },
      h('h2', { class: 'section-title' }, 'CSS Color Level 4/5 与 HDR 深度实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页演示 CSS Color Module Level 4/5 现代色彩标准与 HDR 广色域：color() 函数与色彩空间全集（display-p3/rec2020/xyz）、oklch/lab/lch 感知均匀色彩、color-mix() 混色、相对颜色（from 关键字）派生主题色调、HDR 与 dynamic-range 媒体查询、canvas colorSpace 色彩管理、5 大实战场景与 8 大陷阱。所有特性通过 typeof / CSS.supports / matchMedia 能力检测，不可用时仅记日志，绝不抛异常。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderCard6(),
      this._renderCard7(),
      this._renderCard8(),
      this._renderLogPanel(),
    );
  }
}
