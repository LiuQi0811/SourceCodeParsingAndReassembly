// =====================================================================
// CSSMediaUserPreferencePage.js —— CSS 用户偏好媒体查询实验室
// 演示 MDN / CSS Media Queries Level 5+ 用户偏好与交互能力特性：
//   1. prefers-color-scheme 与 color-scheme ——
//      `@media (prefers-color-scheme: dark|light)` 检测用户系统深浅色偏好；
//      `color-scheme: light dark` 声明元素支持的配色方案，浏览器自动适配默认表单控件、滚动条、canvas 背景；
//      `light-dark(lightValue, darkValue)` 根据当前 color-scheme 自动取值（本页侧重系统偏好联动）；
//      `window.matchMedia('(prefers-color-scheme: dark)').matches` JS 检测；
//      `matchMedia(...).addEventListener('change', cb)` 监听系统主题切换；
//      vs 手动主题切换（.dark 类 + localStorage）：系统偏好是用户全局设置，应优先尊重。
//   2. prefers-reduced-motion ——
//      `@media (prefers-reduced-motion: reduce|no-preference)` 检测用户是否请求减少动画
//      （前庭障碍、注意力问题、节省电量）；
//      实战模式：`@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }`；
//      `matchMedia('(prefers-reduced-motion: reduce)').matches` JS 检测；
//      与 WAAPI 协同：`element.animate(keyframes, { duration: prefersReducedMotion ? 0 : 300 })`；
//      vs CSS @media：JS 检测用于动态决策（如禁用 rAF 动画循环）。
//   3. prefers-contrast 与 forced-colors ——
//      `@media (prefers-contrast: more|less|custom|no-preference)` 用户请求的对比度级别；
//      `@media (forced-colors: active|none)` Windows 高对比度模式（强制配色）；
//      `forced-color-adjust: auto|none|preserve-parent-color` 控制元素是否服从强制配色；
//      强制配色下颜色被替换为系统调色板（Canvas / CanvasText / ButtonText 等），需用系统颜色关键字；
//      实战：高对比度模式下调整边框、移除纯装饰性背景、确保焦点可见；
//      `matchMedia('(forced-colors: active)').matches` JS 检测。
//   4. prefers-reduced-transparency 与 prefers-reduced-data ——
//      `@media (prefers-reduced-transparency: reduce)` 用户请求减少半透明效果（提升可读性）；
//      `@media (prefers-reduced-data: reduce)` 用户请求减少数据传输（省流量模式）；
//      reduced-data 实战：不加载非必要资源、用系统字体替代 web font、低分辨率图片；
//      reduced-transparency 实战：移除 backdrop-filter、降低 opacity 叠加；
//      两者均为较新特性，浏览器支持有限；
//      `matchMedia('(prefers-reduced-transparency: reduce)').matches` /
//      `matchMedia('(prefers-reduced-data: reduce)').matches` 检测。
//   5. inverted-colors 与 dynamic-range ——
//      `@media (inverted-colors: inverted|none)` 检测系统是否启用颜色反转（macOS 反转颜色辅助功能）；
//      `@media (dynamic-range: high|standard)` 检测显示器动态范围（HDR/SDR），与 color-gamut 相关；
//      `@media (color-gamut: rec2020|p3|srgb)` 检测色域支持（本页侧重 media query 检测方式）；
//      inverted-colors 实战：反转图片避免双重反转（图片被系统反转一次再被 CSS 反转一次）；
//      dynamic-range/high 实战：为 HDR 显示器提供更广色域内容；
//      浏览器支持：inverted-colors 仅 Safari/macOS；dynamic-range 较新。
//   6. hover 与 pointer 媒体特性 ——
//      `@media (hover: hover|none)` 检测主输入设备是否支持 hover（桌面 vs 触屏）；
//      `@media (pointer: fine|coarse|none)` 检测指针精度（鼠标 fine / 触屏 coarse / 无指针 none）；
//      `@media (any-hover: hover)` / `@media (any-pointer: fine)` 检测任意输入设备（多设备场景）；
//      实战：hover 设备显示 hover 效果与工具提示；触屏设备增大点击区域、用 tap 替代 hover；
//      vs 特征检测 `window.matchMedia('(hover: hover)').matches`：比 ontouchstart 更可靠；
//      与 :hover 伪类协同：`@media (hover: hover) { .btn:hover { ... } }`。
// 说明：jsdom 中 CSS 渲染不可用，matchMedia 通常未实现（typeof 检测后降级为仅说明）；
//       所有特性检测用 window.matchMedia(...) 包裹 try/catch，不可用仅记 warn 日志，绝不抛异常；
//       视觉演示与实时检测需在真实浏览器查看，但能力检测、代码展示、日志记录在 jsdom 中正常工作。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class CSSMediaUserPreferencePage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      colorSchemeInfo: '',       // Card 1：prefers-color-scheme 与 color-scheme
      reducedMotionInfo: '',     // Card 2：prefers-reduced-motion
      contrastForcedInfo: '',    // Card 3：prefers-contrast 与 forced-colors
      transparencyDataInfo: '',  // Card 4：prefers-reduced-transparency 与 prefers-reduced-data
      invertedDynamicInfo: '',   // Card 5：inverted-colors 与 dynamic-range
      hoverPointerInfo: '',      // Card 6：hover 与 pointer 媒体特性
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._mqls = [];               // 注册的 MediaQueryList（用于在卸载时显式移除监听）
    this._styleEl = null;          // 动态插入的 <style> 引用（演示样式）

    // 注入演示用 <style>（参考 CSSStartingStylePage 的 _injectStyle / _removeStyle 模式）
    this._injectStyle();

    // 一次性能力检测：matchMedia 是否可用 + 各用户偏好特性
    const caps = this._caps();
    const parts = [
      `matchMedia ${caps.matchMedia ? '✓' : '✗'}`,
      `prefers-color-scheme ${caps.colorScheme ? '✓' : '✗'}`,
      `prefers-reduced-motion ${caps.reducedMotion ? '✓' : '✗'}`,
      `prefers-contrast ${caps.contrast ? '✓' : '✗'}`,
      `forced-colors ${caps.forcedColors ? '✓' : '✗'}`,
      `prefers-reduced-transparency ${caps.reducedTransparency ? '✓' : '✗'}`,
      `prefers-reduced-data ${caps.reducedData ? '✓' : '✗'}`,
      `inverted-colors ${caps.invertedColors ? '✓' : '✗'}`,
      `dynamic-range ${caps.dynamicRange ? '✓' : '✗'}`,
      `hover ${caps.hover ? '✓' : '✗'}`,
      `pointer ${caps.pointer ? '✓' : '✗'}`,
    ];
    const summary = caps.matchMedia
      ? `CSS 用户偏好媒体查询能力检测：${parts.join(' · ')}。jsdom 中 matchMedia 通常未实现，所有检测会降级为「未知」并仅展示代码片段；真实浏览器（Chrome/Edge/Safari/Firefox 现代版本）支持大部分特性。`
      : '当前环境 window.matchMedia 不可用（jsdom 默认未实现）。所有按钮点击将仅展示 CSS 代码片段与说明，不会抛异常。在真实浏览器中打开可执行实时探测与系统偏好变化监听。';

    this.setState({ capsSummary: summary });
    this._addLog(caps.matchMedia ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!caps.matchMedia) {
      this._addLog('warn', 'window.matchMedia 不可用（jsdom 默认未实现），所有检测降级为仅说明');
    } else {
      // 注册 prefers-color-scheme 变化监听（真实浏览器中切换系统主题会触发）
      this._watchMedia('(prefers-color-scheme: dark)', '系统配色方案');
      this._watchMedia('(prefers-reduced-motion: reduce)', '减少动画偏好');
      this._watchMedia('(prefers-contrast: more)', '对比度偏好');
      this._watchMedia('(forced-colors: active)', '强制配色');
      this._watchMedia('(prefers-reduced-transparency: reduce)', '减少透明度');
      this._watchMedia('(prefers-reduced-data: reduce)', '减少数据');
      this._watchMedia('(inverted-colors: inverted)', '颜色反转');
      this._watchMedia('(hover: hover)', 'hover 能力');
      this._watchMedia('(pointer: fine)', '指针精度');
      // 列出当前所有探测结果
      const cur = [];
      if (caps.colorSchemeDark) cur.push(`prefers-color-scheme=dark`);
      if (caps.colorSchemeLight) cur.push(`prefers-color-scheme=light`);
      if (caps.reducedMotion) cur.push(`prefers-reduced-motion=reduce`);
      if (caps.noReducedMotion) cur.push(`prefers-reduced-motion=no-preference`);
      if (caps.contrastMore) cur.push(`prefers-contrast=more`);
      if (caps.forcedColors) cur.push(`forced-colors=active`);
      if (caps.reducedTransparency) cur.push(`prefers-reduced-transparency=reduce`);
      if (caps.reducedData) cur.push(`prefers-reduced-data=reduce`);
      if (caps.invertedColors) cur.push(`inverted-colors=inverted`);
      if (caps.dynamicRangeHigh) cur.push(`dynamic-range=high`);
      if (caps.hover) cur.push(`hover=hover`);
      if (caps.pointerFine) cur.push(`pointer=fine`);
      if (caps.pointerCoarse) cur.push(`pointer=coarse`);
      this._addLog('info', `当前激活的偏好：${cur.length ? cur.join('，') : '（均为默认值 / no-preference / none）'}`);
    }
  }

  componentWillUnmount() {
    // 1. 移除动态注入的 <style> 元素（若存在）
    try {
      if (this._styleEl && this._styleEl.parentNode) {
        this._styleEl.parentNode.removeChild(this._styleEl);
      }
    } catch { /* noop */ }
    this._styleEl = null;
    // 2. 显式移除 MediaQueryList 监听（兼容旧版 addListener / removeListener）
    for (const { mql, handler } of this._mqls || []) {
      try {
        if (typeof mql.removeEventListener === 'function') mql.removeEventListener('change', handler);
        else if (typeof mql.removeListener === 'function') mql.removeListener(handler);
      } catch { /* noop */ }
    }
    this._mqls = [];
    // 注：通过 this.on() 注册的 document/window 监听由基类 Component.destroy() 统一移除，无需在此手动清理。
  }

  // —— 注入 / 移除演示样式 ——
  _injectStyle() {
    const STYLE_ID = 'css-media-user-preference-demo';
    try {
      // 若已存在则先移除（防止重复注入）
      const existed = document.getElementById(STYLE_ID);
      if (existed && existed.parentNode) existed.parentNode.removeChild(existed);
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
/* ===== Card 1：prefers-color-scheme 与 color-scheme 演示 ===== */
.css-mup-cs-demo {
  color-scheme: light dark;            /* 声明元素支持浅/深两种配色方案 */
  padding: 12px 16px;
  border: 1px solid canvas;
  background: canvas;
  color: canvastext;
  border-radius: 6px;
}
.css-mup-light-dark-demo {
  /* light-dark() 根据当前 color-scheme 自动取值（Chrome 123+ / Safari 17.5+） */
  background: light-dark(#f5f5f5, #1a1a1a);
  color: light-dark(#1a1a1a, #f5f5f5);
  padding: 8px 12px;
  border-radius: 4px;
}
@media (prefers-color-scheme: dark) {
  .css-mup-pcs-dark-tag { background: #1a1a1a; color: #f0f0f0; border-color: #444; }
}
@media (prefers-color-scheme: light) {
  .css-mup-pcs-light-tag { background: #f0f0f0; color: #1a1a1a; border-color: #ccc; }
}

/* ===== Card 2：prefers-reduced-motion 演示 ===== */
.css-mup-motion-box {
  width: 40px; height: 40px;
  background: #1677ff;
  border-radius: 4px;
  animation: css-mup-spin 2s linear infinite;
  transition: transform 0.3s;
}
@keyframes css-mup-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
/* 实战模式：减少动画偏好下，全局禁用动画与过渡 */
@media (prefers-reduced-motion: reduce) {
  .css-mup-motion-demo, .css-mup-motion-demo *,
  .css-mup-motion-demo *::before, .css-mup-motion-demo *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* ===== Card 3：prefers-contrast 与 forced-colors 演示 ===== */
@media (prefers-contrast: more) {
  .css-mup-contrast-demo {
    border-width: 2px;
    font-weight: 700;
    outline: 1px solid CanvasText;
  }
}
@media (prefers-contrast: less) {
  .css-mup-contrast-demo { opacity: 0.85; border-width: 1px; }
}
@media (forced-colors: active) {
  .css-mup-forced-demo {
    /* 强制配色模式下颜色被替换为系统调色板 */
    background: Canvas;
    color: CanvasText;
    border: 1px solid ButtonText;
    forced-color-adjust: auto;
  }
  .css-mup-forced-none {
    /* 不服从强制配色（保留作者颜色，慎用） */
    forced-color-adjust: none;
  }
}

/* ===== Card 4：prefers-reduced-transparency 与 prefers-reduced-data 演示 ===== */
.css-mup-transparency-demo {
  background: rgba(22, 119, 255, 0.4);
  backdrop-filter: blur(8px);
  padding: 12px;
  border-radius: 6px;
}
@media (prefers-reduced-transparency: reduce) {
  .css-mup-transparency-demo {
    opacity: 1 !important;
    background: #1677ff !important;
    backdrop-filter: none !important;
  }
}
@media (prefers-reduced-data: reduce) {
  /* reduced-data：跳过 web font、低分辨率图片等 */
  .css-mup-data-demo { font-family: system-ui, sans-serif !important; }
  .css-mup-data-demo .web-font { display: none; }
}

/* ===== Card 5：inverted-colors 与 dynamic-range 演示 ===== */
@media (inverted-colors: inverted) {
  /* 反转图片避免双重反转：图片已被系统反转一次，再 invert(1) 抵消 */
  img.css-mup-invert-img, .css-mup-invert-img {
    filter: invert(1);
  }
}
@media (dynamic-range: high) {
  /* HDR 显示器：提供更广色域（需配合 color-gamut: p3 / rec2020） */
  .css-mup-hdr-demo {
    background: linear-gradient(in oklab, #ff0000, #00ff00, #0000ff);
  }
}
@media (color-gamut: p3) {
  .css-mup-gamut-demo { background: color(display-p3 1 0 0); }
}
@media (color-gamut: rec2020) {
  .css-mup-gamut-demo { background: color(rec2020 1 0 0); }
}

/* ===== Card 6：hover 与 pointer 演示 ===== */
@media (hover: hover) {
  .css-mup-hover-demo:hover {
    background: Highlight;
    color: HighlightText;
    transform: translateY(-1px);
  }
}
@media (any-hover: hover) {
  .css-mup-any-hover-tag::after { content: ' · any-hover 可用'; }
}
@media (pointer: fine) {
  .css-mup-pointer-demo { padding: 4px 10px; cursor: pointer; }
}
@media (pointer: coarse) {
  /* 触屏设备：增大点击区域 */
  .css-mup-pointer-demo { padding: 12px 20px; min-height: 44px; }
}
@media (pointer: none) {
  .css-mup-pointer-demo { padding: 8px 12px; }
}
`;
      document.head.appendChild(style);
      this._styleEl = style;
    } catch { /* noop */ }
  }

  // —— 注册 MediaQueryList 变化监听（兼容旧 API）——
  _watchMedia(query, label) {
    try {
      const mql = window.matchMedia(query);
      const handler = (e) => {
        this._addLog('change', `${label} 变化：${query} → matches=${e.matches}`);
      };
      if (typeof mql.addEventListener === 'function') mql.addEventListener('change', handler);
      else if (typeof mql.addListener === 'function') mql.addListener(handler);
      this._mqls.push({ mql, handler });
    } catch { /* noop */ }
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

  // —— 同步能力检测（render 时调用，开销可忽略）——
  _caps() {
    const matchMedia = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
    const probe = (q) => {
      if (!matchMedia) return false;
      try { return window.matchMedia(q).matches; } catch { return false; }
    };
    const supportOf = (q) => {
      if (!matchMedia) return false;
      try { window.matchMedia(q); return true; } catch { return false; }
    };
    return {
      matchMedia,
      // Card 1
      colorScheme: supportOf('(prefers-color-scheme: dark)'),
      colorSchemeDark: probe('(prefers-color-scheme: dark)'),
      colorSchemeLight: probe('(prefers-color-scheme: light)'),
      // Card 2
      reducedMotion: supportOf('(prefers-reduced-motion: reduce)'),
      reducedMotionActive: probe('(prefers-reduced-motion: reduce)'),
      noReducedMotion: probe('(prefers-reduced-motion: no-preference)'),
      // Card 3
      contrast: supportOf('(prefers-contrast: more)'),
      contrastMore: probe('(prefers-contrast: more)'),
      contrastLess: probe('(prefers-contrast: less)'),
      forcedColors: supportOf('(forced-colors: active)'),
      forcedColorsActive: probe('(forced-colors: active)'),
      // Card 4
      reducedTransparency: supportOf('(prefers-reduced-transparency: reduce)'),
      reducedTransparencyActive: probe('(prefers-reduced-transparency: reduce)'),
      reducedData: supportOf('(prefers-reduced-data: reduce)'),
      reducedDataActive: probe('(prefers-reduced-data: reduce)'),
      // Card 5
      invertedColors: supportOf('(inverted-colors: inverted)'),
      invertedColorsActive: probe('(inverted-colors: inverted)'),
      dynamicRange: supportOf('(dynamic-range: high)'),
      dynamicRangeHigh: probe('(dynamic-range: high)'),
      colorGamutP3: probe('(color-gamut: p3)'),
      colorGamutRec2020: probe('(color-gamut: rec2020)'),
      // Card 6
      hover: supportOf('(hover: hover)'),
      hoverSupported: probe('(hover: hover)'),
      hoverNone: probe('(hover: none)'),
      anyHover: probe('(any-hover: hover)'),
      pointer: supportOf('(pointer: fine)'),
      pointerFine: probe('(pointer: fine)'),
      pointerCoarse: probe('(pointer: coarse)'),
      pointerNone: probe('(pointer: none)'),
      anyPointerFine: probe('(any-pointer: fine)'),
    };
  }

  // =================== Card 1：prefers-color-scheme 与 color-scheme ===================

  _showColorSchemeCaps() {
    const caps = this._caps();
    this.setState({ colorSchemeInfo:
      '===== prefers-color-scheme 与 color-scheme 能力检测 =====\n\n' +
      `  window.matchMedia                                : ${caps.matchMedia ? 'function（可用）' : 'undefined（不可用）'}\n` +
      `  matchMedia('(prefers-color-scheme: dark)').matches : ${caps.colorSchemeDark}\n` +
      `  matchMedia('(prefers-color-scheme: light)').matches: ${caps.colorSchemeLight}\n` +
      `  matchMedia('(prefers-color-scheme: dark)') 可识别  : ${caps.colorScheme}\n\n` +
      'CSS 属性：\n' +
      "  color-scheme: light dark;  /* 声明元素支持的配色方案，浏览器据此自动适配：\n" +
      '                                 默认表单控件、滚动条、canvas 背景、系统颜色等 */\n' +
      '  color-scheme: light;       /* 仅支持浅色 */\n' +
      '  color-scheme: dark;        /* 仅支持深色 */\n' +
      '  color-scheme: only light;  /* 强制浅色（不跟随系统）*/\n\n' +
      'CSS 函数：\n' +
      '  background: light-dark(#f5f5f5, #1a1a1a);\n' +
      '  /* 根据当前 color-scheme 自动取值（Chrome 123+ / Safari 17.5+）*/\n\n' +
      '语义：prefers-color-scheme 反映用户操作系统层的「深色 / 浅色模式」全局偏好；\n' +
      '      color-scheme 让作者声明元素支持哪些方案，浏览器据此自动渲染原生 UI；\n' +
      '      light-dark() 让作者根据当前生效的 color-scheme 提供两套取值。\n\n' +
      '注：jsdom 中 matchMedia 默认未实现，检测结果为 false 仅代表本环境不支持，不代表真实浏览器不支持。' });
    this._addLog('caps', `prefers-color-scheme 检测：matchMedia=${caps.matchMedia}, dark=${caps.colorSchemeDark}, light=${caps.colorSchemeLight}`);
  }

  _showColorSchemeSyntax() {
    this.setState({ colorSchemeInfo:
      '===== prefers-color-scheme 与 color-scheme 语法 =====\n\n' +
      '/* 1. 媒体查询：根据系统配色应用不同样式 */\n' +
      '@media (prefers-color-scheme: dark) {\n' +
      '  body { background: #1a1a1a; color: #f0f0f0; }\n' +
      '}\n' +
      '@media (prefers-color-scheme: light) {\n' +
      '  body { background: #ffffff; color: #1a1a1a; }\n' +
      '}\n\n' +
      '/* 2. color-scheme 属性：声明元素支持的配色方案 */\n' +
      ':root {\n' +
      '  color-scheme: light dark;  /* 跟随系统，自动适配原生控件 */\n' +
      '}\n' +
      '/* 浏览器据此自动渲染：\n' +
      '   - <input>、<select>、<button> 等表单控件\n' +
      '   - 滚动条颜色\n' +
      '   - canvas 默认背景（透明 vs 深色）\n' +
      '   - 系统颜色关键字（Canvas / CanvasText / ButtonText 等）*/\n\n' +
      '/* 3. light-dark() 函数：根据当前 color-scheme 自动取值 */\n' +
      '.card {\n' +
      '  background: light-dark(#f5f5f5, #1a1a1a);\n' +
      '  color:      light-dark(#1a1a1a, #f5f5f5);\n' +
      '  border:     1px solid light-dark(#ccc, #444);\n' +
      '}\n\n' +
      '/* 4. JS 检测与监听 */\n' +
      "const mql = window.matchMedia('(prefers-color-scheme: dark)');\n" +
      'console.log(mql.matches);  // true=深色 / false=浅色\n' +
      "mql.addEventListener('change', (e) => {\n" +
      '  console.log(`系统切换为 ${e.matches ? "深色" : "浅色"} 模式`);\n' +
      '});' });
    this._addLog('syntax', '已展示 prefers-color-scheme / color-scheme / light-dark() 语法');
  }

  _compareSystemVsManual() {
    this.setState({ colorSchemeInfo:
      '===== 系统偏好 vs 手动主题切换 =====\n\n' +
      '【手动主题切换（.dark 类 + localStorage）】\n' +
      '  // JS：读取用户偏好并应用 .dark 类\n' +
      '  const saved = localStorage.getItem("theme");\n' +
      '  const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;\n' +
      '  const theme = saved || (prefersDark ? "dark" : "light");\n' +
      '  document.documentElement.classList.toggle("dark", theme === "dark");\n' +
      '\n' +
      '  /* CSS：用 .dark 类切换变量 */\n' +
      '  :root { --bg: #fff; --fg: #000; }\n' +
      '  :root.dark { --bg: #1a1a1a; --fg: #f0f0f0; }\n' +
      '  body { background: var(--bg); color: var(--fg); }\n\n' +
      '【系统偏好优先方案（推荐）】\n' +
      '  :root { color-scheme: light dark; }  /* 让浏览器自动适配原生控件 */\n' +
      '  body {\n' +
      '    background: light-dark(#fff, #1a1a1a);  /* 跟随系统，无需 JS */\n' +
      '    color:      light-dark(#000, #f0f0f0);\n' +
      '  }\n' +
      '  /* 仍允许手动覆盖：检测 localStorage 后再加 color-scheme 覆盖 */\n\n' +
      '最佳实践：\n' +
      '  1. 默认尊重系统偏好（color-scheme + light-dark() / @media prefers-color-scheme）\n' +
      '  2. 提供「跟随系统 / 强制浅色 / 强制深色」三态切换，localStorage 记录用户选择\n' +
      '  3. 监听 prefers-color-scheme 变化，仅当用户选择「跟随系统」时响应\n' +
      '  4. 避免仅靠 .dark 类切换：原生表单控件、滚动条不会跟随，需 color-scheme 配合\n\n' +
      '关键差异：\n' +
      '  - 系统偏好是用户全局设置（操作系统层），应优先尊重（无障碍、电量、用户预期）\n' +
      '  - .dark 类是站点局部设置，仅影响站点自身样式，无法影响原生控件外观\n' +
      '  - 二者应协同：系统偏好为默认值，手动切换为用户覆盖' });
    this._addLog('compare', '对比系统偏好 vs 手动主题切换方案');
  }

  _showColorSchemeListener() {
    const caps = this._caps();
    this.setState({ colorSchemeInfo:
      '===== 监听系统主题切换（matchMedia change 事件） =====\n\n' +
      '/* 注册监听 */\n' +
      "const mql = window.matchMedia('(prefers-color-scheme: dark)');\n" +
      '\n' +
      '// 现代写法（推荐）\n' +
      "mql.addEventListener('change', (e) => {\n" +
      '  console.log(`系统切换为 ${e.matches ? "深色" : "浅色"} 模式`);\n' +
      '  applyTheme(e.matches ? "dark" : "light");\n' +
      '});\n' +
      '\n' +
      '// 兼容旧版 Safari（< 14）\n' +
      'mql.addListener((e) => { /* 同上 */ });\n' +
      '\n' +
      '/* 移除监听 */\n' +
      "mql.removeEventListener('change', handler);\n" +
      'mql.removeListener(handler);  // 旧 API\n\n' +
      '事件对象 MediaQueryListEvent 属性：\n' +
      '  - matches: boolean        // 当前是否匹配\n' +
      '  - media: string           // 查询字符串，如 "(prefers-color-scheme: dark)"\n' +
      '  - onchange: null          // IDL 属性\n\n' +
      `本页 componentDidMount 已注册监听：\n` +
      `  matchMedia 可用 = ${caps.matchMedia}\n` +
      `  当前 prefers-color-scheme: dark matches = ${caps.colorSchemeDark}\n` +
      (caps.matchMedia
        ? '  切换系统深浅色模式后，下方「事件日志」会出现 change 类型记录。'
        : '  当前环境 matchMedia 不可用，监听未注册。') });
    this._addLog('listener', `prefers-color-scheme 监听（matchMedia=${caps.matchMedia}, dark=${caps.colorSchemeDark}）`);
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. prefers-color-scheme 与 color-scheme',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.colorScheme ? 'success' : 'error' }, caps.colorScheme ? 'prefers-color-scheme ✓' : 'prefers-color-scheme ✗'),
        h(Tag, { color: caps.colorSchemeDark ? 'warning' : 'primary' }, caps.colorSchemeDark ? '当前=dark' : '当前=light'),
        h(Tag, { color: 'info' }, 'light-dark()')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '@media (prefers-color-scheme: dark|light) 检测用户系统深浅色偏好；color-scheme: light dark CSS 属性声明元素支持的配色方案，浏览器自动适配默认表单控件、滚动条、canvas 背景；light-dark() 函数根据当前 color-scheme 自动取值；window.matchMedia(\'(prefers-color-scheme: dark)\').matches JS 检测；matchMedia(...).addEventListener(\'change\', cb) 监听系统主题切换。系统偏好是用户全局设置，应优先尊重（vs 手动 .dark 类 + localStorage）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('能力检测', { type: 'primary', size: 'sm', onClick: () => this._showColorSchemeCaps() }),
          this._btn('展示语法', { size: 'sm', onClick: () => this._showColorSchemeSyntax() }),
          this._btn('系统 vs 手动', { size: 'sm', onClick: () => this._compareSystemVsManual() }),
          this._btn('监听 change', { size: 'sm', onClick: () => this._showColorSchemeListener() })),
        h('div', { class: 'css-mup-cs-demo fs-sm' },
          'color-scheme: light dark 演示容器（背景/文字为系统颜色 Canvas / CanvasText，跟随系统深浅色）'),
        h('div', { class: 'css-mup-light-dark-demo fs-sm' },
          'light-dark(#f5f5f5, #1a1a1a) 演示（真实浏览器中跟随系统切换）'),
        h('div', { class: 'fs-sm text-secondary' }, 'prefers-color-scheme 状态 / 语法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.colorSchemeInfo || '（点击「能力检测」或「展示语法」）')),
        h(Alert, { type: 'info', message: '系统偏好应优先尊重，配合 color-scheme 属性让原生控件也跟随', description: '仅用 .dark 类切换无法影响原生表单控件、滚动条；color-scheme: light dark 让浏览器自动适配原生 UI。light-dark() 让作者根据当前方案提供两套取值。jsdom 不模拟 CSS 渲染与 matchMedia，演示仅展示代码片段。' }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：prefers-reduced-motion ===================

  _showReducedMotionCaps() {
    const caps = this._caps();
    this.setState({ reducedMotionInfo:
      '===== prefers-reduced-motion 能力检测 =====\n\n' +
      `  matchMedia('(prefers-reduced-motion: reduce)').matches      : ${caps.reducedMotionActive}\n` +
      `  matchMedia('(prefers-reduced-motion: no-preference)').matches: ${caps.noReducedMotion}\n` +
      `  matchMedia('(prefers-reduced-motion: reduce)') 可识别       : ${caps.reducedMotion}\n\n` +
      '取值：\n' +
      '  - reduce          // 用户请求减少动画\n' +
      '  - no-preference   // 用户未表达偏好（默认）\n\n' +
      '触发场景：\n' +
      '  - 前庭障碍（前庭功能异常，动画引发眩晕 / 晕动症）\n' +
      '  - 注意力问题（动画分散注意力，影响认知）\n' +
      '  - 节省电量（OLED 屏幕、移动设备）\n' +
      '  - 用户主动在系统设置中开启「减少动态效果」\n\n' +
      '操作系统设置入口：\n' +
      '  - macOS: 系统设置 → 辅助功能 → 显示 → 减少动态效果\n' +
      '  - Windows: 设置 → 辅助功能 → 视觉效果 → 动画效果（关闭）\n' +
      '  - iOS: 设置 → 辅助功能 → 动态效果 → 减少动态效果\n' +
      '  - Android: 设置 → 辅助功能 → 移除动画\n\n' +
      '注：jsdom 不模拟 matchMedia，检测结果仅作能力探测参考。' });
    this._addLog('caps', `prefers-reduced-motion 检测：reduce=${caps.reducedMotionActive}, no-preference=${caps.noReducedMotion}`);
  }

  _showReducedMotionPattern() {
    this.setState({ reducedMotionInfo:
      '===== prefers-reduced-motion 实战模式 =====\n\n' +
      '/* 全局禁用动画（推荐作为 reset）*/\n' +
      '@media (prefers-reduced-motion: reduce) {\n' +
      '  *, *::before, *::after {\n' +
      '    animation-duration: 0.01ms !important;\n' +
      '    animation-iteration-count: 1 !important;\n' +
      '    transition-duration: 0.01ms !important;\n' +
      '    scroll-behavior: auto !important;\n' +
      '  }\n' +
      '}\n\n' +
      '/* 精细化：仅对装饰性动画禁用，保留功能性反馈 */\n' +
      '@media (prefers-reduced-motion: reduce) {\n' +
      '  .decorative-spinner { animation: none; display: none; }\n' +
      '  .feedback-button { transition: opacity 0.1s; }  /* 保留极短反馈 */\n' +
      '}\n\n' +
      '/* 反向增强：no-preference 时才启用复杂动画 */\n' +
      '@media (prefers-reduced-motion: no-preference) {\n' +
      '  .hero { animation: fade-in 0.6s ease-out; }\n' +
      '}\n\n' +
      '关键点：\n' +
      '  - duration: 0.01ms 而非 0：0 会让 transitionend 不触发，0.01ms 保证事件仍触发（逻辑兼容）\n' +
      '  - !important：覆盖作者样式，确保用户偏好优先\n' +
      '  - 包含 ::before / ::after：伪元素动画也需禁用' });
    this._addLog('pattern', '已展示 prefers-reduced-motion 实战模式（全局禁用 + 精细化）');
  }

  _showReducedMotionWithWAAPI() {
    const caps = this._caps();
    this.setState({ reducedMotionInfo:
      '===== prefers-reduced-motion 与 WAAPI 协同 =====\n\n' +
      '// JS 检测用户偏好\n' +
      "const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;\n\n" +
      '// WAAPI：根据偏好动态调整 duration\n' +
      'element.animate(\n' +
      '  [\n' +
      '    { transform: "translateX(0)" },\n' +
      '    { transform: "translateX(100px)" },\n' +
      '  ],\n' +
      '  {\n' +
      '    duration: prefersReducedMotion ? 0 : 300,\n' +
      '    fill: "forwards",\n' +
      '    easing: "ease-out",\n' +
      '  }\n' +
      ');\n\n' +
      '// 实时响应偏好变化（用户切换系统设置后无需刷新）\n' +
      "const mql = window.matchMedia('(prefers-reduced-motion: reduce)');\n" +
      "mql.addEventListener('change', (e) => {\n" +
      '  // 重新决策：禁用 rAF 动画循环 / 调整 WAAPI 参数\n' +
      '  if (e.matches) stopRAFLoop();\n' +
      '  else startRAFLoop();\n' +
      '});\n\n' +
      'vs CSS @media：\n' +
      '  - CSS @media 适用于声明式动画（CSS animation / transition）\n' +
      '  - JS matchMedia 适用于命令式动画（WAAPI / rAF 循环 / Canvas / WebGL）\n' +
      '  - 二者需协同：CSS 处理 declarative，JS 处理 imperative\n\n' +
      `当前环境：matchMedia=${caps.matchMedia}, reducedMotion=${caps.reducedMotionActive}` });
    this._addLog('waapi', `展示 prefers-reduced-motion 与 WAAPI 协同（reduce=${caps.reducedMotionActive}）`);
  }

  _showReducedMotionDecision() {
    this.setState({ reducedMotionInfo:
      '===== 动画决策矩阵（reduced-motion 优先级） =====\n\n' +
      '场景                          | 处理方式                                   | 理由\n' +
      '------------------------------|--------------------------------------------|---------------------------\n' +
      '装饰性 spinner / loader       | reduce 时直接隐藏或显示静态占位            | 纯装饰，无功能价值\n' +
      '页面进入 / 路由过渡           | reduce 时瞬切（duration: 0.01ms）          | 反馈仍需，但去除视觉运动\n' +
      '按钮 hover 反馈               | reduce 时保留极短过渡（0.1s 内）           | 功能性反馈，必要\n' +
      '滚动驱动动画（scroll-driven） | reduce 时禁用，改用静态布局                | 滚动 + 动画易引发眩晕\n' +
      '视差滚动                      | reduce 时完全禁用                          | 高度引发眩晕\n' +
      '自动播放轮播                  | reduce 时改为手动切换                      | 用户可控\n' +
      'Canvas / WebGL 游戏           | 提供「减少动效」选项，不强制               | 游戏体验依赖动画，需用户主动\n' +
      'rAF 物理动画                  | reduce 时停止循环或降低帧率                | 节省电量 + 减少运动\n\n' +
      '决策原则：\n' +
      '  1. 区分「装饰性」与「功能性」动画：装饰性直接禁用，功能性保留极短反馈\n' +
      '  2. 保留状态变化的视觉反馈（即使瞬切也要让用户感知到变化）\n' +
      '  3. 提供手动覆盖选项（游戏 / 创作工具等场景）\n' +
      '  4. 实时监听变化：用户可能在浏览过程中切换系统设置' });
    this._addLog('decision', '已展示动画决策矩阵（reduced-motion 优先级）');
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. prefers-reduced-motion 减少动画',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.reducedMotion ? 'success' : 'error' }, caps.reducedMotion ? 'reduce ✓' : 'reduce ✗'),
        h(Tag, { color: caps.reducedMotionActive ? 'warning' : 'primary' }, caps.reducedMotionActive ? '当前=reduce' : '当前=no-preference'),
        h(Tag, { color: 'info' }, 'WAAPI 协同')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '@media (prefers-reduced-motion: reduce|no-preference) 检测用户是否请求减少动画（前庭障碍、注意力问题、节省电量）。实战模式：@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }。matchMedia(\'(prefers-reduced-motion: reduce)\').matches JS 检测；与 WAAPI 协同：element.animate(keyframes, { duration: prefersReducedMotion ? 0 : 300 })。CSS @media 处理 declarative，JS 检测用于动态决策（如禁用 rAF 循环）。'),
        h('div', { class: 'css-mup-motion-demo flex items-center gap-sm' },
          h('div', { class: 'css-mup-motion-box' }),
          h('span', { class: 'fs-sm text-secondary' }, '↑ 旋转方块演示（reduce 偏好下应几乎不动）')),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('能力检测', { type: 'primary', size: 'sm', onClick: () => this._showReducedMotionCaps() }),
          this._btn('实战模式', { size: 'sm', onClick: () => this._showReducedMotionPattern() }),
          this._btn('与 WAAPI 协同', { size: 'sm', onClick: () => this._showReducedMotionWithWAAPI() }),
          this._btn('动画决策矩阵', { size: 'sm', onClick: () => this._showReducedMotionDecision() })),
        h('div', { class: 'fs-sm text-secondary' }, 'prefers-reduced-motion 状态 / 模式：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.reducedMotionInfo || '（点击「能力检测」或「实战模式」）')),
        h(Alert, { type: 'info', message: 'reduced-motion 是无障碍关键，需区分装饰性与功能性动画', description: '装饰性动画直接禁用；功能性动画保留极短反馈（duration: 0.01ms 保证 transitionend 仍触发）。WAAPI 用 matchMedia 动态决策 duration。jsdom 不模拟，演示仅展示代码片段。' }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：prefers-contrast 与 forced-colors ===================

  _showContrastForcedCaps() {
    const caps = this._caps();
    this.setState({ contrastForcedInfo:
      '===== prefers-contrast 与 forced-colors 能力检测 =====\n\n' +
      `  matchMedia('(prefers-contrast: more)').matches       : ${caps.contrastMore}\n` +
      `  matchMedia('(prefers-contrast: less)').matches       : ${caps.contrastLess}\n` +
      `  matchMedia('(prefers-contrast: more)') 可识别        : ${caps.contrast}\n` +
      `  matchMedia('(forced-colors: active)').matches        : ${caps.forcedColorsActive}\n` +
      `  matchMedia('(forced-colors: active)') 可识别         : ${caps.forcedColors}\n\n` +
      'prefers-contrast 取值：\n' +
      '  - more          // 用户请求更高对比度\n' +
      '  - less          // 用户请求更低对比度\n' +
      '  - custom        // 用户使用了自定义配色（如 Windows 高对比度）\n' +
      '  - no-preference // 默认\n\n' +
      'forced-colors 取值：\n' +
      '  - active  // 强制配色模式激活（Windows 高对比度）\n' +
      '  - none    // 默认\n\n' +
      'forced-color-adjust 取值：\n' +
      '  - auto                   // 默认，服从强制配色\n' +
      '  - none                   // 不服从（保留作者颜色，慎用）\n' +
      '  - preserve-parent-color  // 保留父元素被强制后的颜色\n\n' +
      '系统颜色关键字（强制配色下使用）：\n' +
      '  Canvas / CanvasText                // 画布背景 / 文字\n' +
      '  LinkText / VisitedText             // 链接 / 已访问链接\n' +
      '  ActiveText / ButtonFace / ButtonText / ButtonBorder\n' +
      '  Field / FieldText / Highlight / HighlightText\n' +
      '  Mark / MarkText / GrayText\n\n' +
      '注：jsdom 不模拟 matchMedia 与强制配色，检测仅作能力探测参考。' });
    this._addLog('caps', `prefers-contrast / forced-colors 检测：more=${caps.contrastMore}, forced=${caps.forcedColorsActive}`);
  }

  _showContrastForcedSyntax() {
    this.setState({ contrastForcedInfo:
      '===== prefers-contrast 与 forced-colors 语法 =====\n\n' +
      '/* prefers-contrast：根据用户对比度偏好调整 */\n' +
      '@media (prefers-contrast: more) {\n' +
      '  .card { border-width: 2px; font-weight: 700; }\n' +
      '  .text { color: #000; }  /* 提升对比度 */\n' +
      '}\n' +
      '@media (prefers-contrast: less) {\n' +
      '  .card { border-width: 1px; opacity: 0.85; }\n' +
      '}\n' +
      '@media (prefers-contrast: custom) {\n' +
      '  /* 用户自定义配色，使用系统颜色关键字 */\n' +
      '  .card { background: Canvas; color: CanvasText; }\n' +
      '}\n\n' +
      '/* forced-colors：Windows 高对比度模式 */\n' +
      '@media (forced-colors: active) {\n' +
      '  /* 颜色被替换为系统调色板 */\n' +
      '  .button {\n' +
      '    background: ButtonFace;\n' +
      '    color: ButtonText;\n' +
      '    border: 1px solid ButtonBorder;\n' +
      '  }\n' +
      '  .decorative-bg { display: none; }  /* 移除纯装饰性背景 */\n' +
      '}\n\n' +
      '/* forced-color-adjust：控制元素是否服从强制配色 */\n' +
      '.preserve-colors {\n' +
      '  forced-color-adjust: none;  /* 不服从，保留作者颜色（慎用，可能破坏可读性）*/\n' +
      '}\n' +
      '.inherit-forced {\n' +
      '  forced-color-adjust: preserve-parent-color;\n' +
      '}' });
    this._addLog('syntax', '已展示 prefers-contrast / forced-colors / forced-color-adjust 语法');
  }

  _showContrastForcedPractical() {
    this.setState({ contrastForcedInfo:
      '===== 高对比度 / 强制配色实战要点 =====\n\n' +
      '1. 边框与可见性\n' +
      '   - 高对比度模式下，背景色被替换为系统色，依赖背景区分的边界会消失\n' +
      '   - 应显式声明 border：border: 1px solid CanvasText;\n' +
      '   - 移除纯装饰性背景（gradient / shadow）：display: none 或 background: none\n' +
      '\n' +
      '2. 焦点可见性\n' +
      '   - 强制配色下 outline 可能被替换，需显式声明：\n' +
      '     :focus-visible { outline: 2px solid Highlight; outline-offset: 2px; }\n' +
      '   - 不要 outline: none（除非提供替代）\n' +
      '\n' +
      '3. 系统颜色关键字\n' +
      '   - Canvas / CanvasText：主背景 / 主文字（最常用）\n' +
      '   - ButtonFace / ButtonText / ButtonBorder：按钮三件套\n' +
      '   - LinkText / VisitedText / ActiveText：链接状态\n' +
      '   - Highlight / HighlightText：选中高亮\n' +
      '   - 不要硬编码颜色（#fff 等），用系统颜色让用户主题生效\n' +
      '\n' +
      '4. forced-color-adjust 慎用\n' +
      '   - none：保留作者颜色（如品牌 logo），但可能破坏可读性\n' +
      '   - 仅用于「确实需要保留原色」的场景（如品牌标识、图标颜色编码）\n' +
      '   - 大面积内容区不要用 none\n' +
      '\n' +
      '5. prefers-contrast: more 增强\n' +
      '   - 提升字体粗细：font-weight: 700\n' +
      '   - 加粗边框：border-width: 2px\n' +
      '   - 加深文字颜色：避免浅灰文字\n' +
      '   - 增加间距：letter-spacing / line-height' });
    this._addLog('practical', '已展示高对比度 / 强制配色实战要点');
  }

  _showContrastForcedDecision() {
    const caps = this._caps();
    this.setState({ contrastForcedInfo:
      '===== prefers-contrast vs forced-colors 决策 =====\n\n' +
      '二者区别：\n' +
      '  - prefers-contrast：用户请求的对比度级别（more/less/custom/no-preference）\n' +
      '    → 软提示，作者应增强 / 减弱对比度，颜色仍由作者控制\n' +
      '  - forced-colors：Windows 高对比度模式（active/none）\n' +
      '    → 硬替换，浏览器强制把作者颜色替换为系统调色板\n\n' +
      '组合场景：\n' +
      '  prefers-contrast: more + forced-colors: none\n' +
      '    → 用户希望更高对比度，但未启用强制配色\n' +
      '    → 作者主动增强（加粗边框、加深文字）\n' +
      '\n' +
      '  prefers-contrast: custom + forced-colors: active\n' +
      '    → 用户启用了 Windows 高对比度（custom 通常伴随 forced-colors）\n' +
      '    → 作者应使用系统颜色关键字，让用户主题生效\n' +
      '\n' +
      '  prefers-contrast: no-preference + forced-colors: active\n' +
      '    → 用户启用强制配色但未表达对比度偏好\n' +
      '    → 仍需使用系统颜色（forced-colors 优先级更高）\n\n' +
      '实战优先级：\n' +
      '  forced-colors: active > prefers-contrast: more/less > 默认样式\n' +
      '  即：先检测 forced-colors（硬替换），再检测 prefers-contrast（软增强）\n\n' +
      '@media 组合写法：\n' +
      '  @media (forced-colors: active) { /* 系统颜色关键字 */ }\n' +
      '  @media (prefers-contrast: more) { /* 增强 */ }\n' +
      '  @media (prefers-contrast: more) and (forced-colors: none) { /* 仅增强，不强制 */ }\n\n' +
      `当前环境：contrast=${caps.contrastMore}, forced=${caps.forcedColorsActive}` });
    this._addLog('decision', `展示 prefers-contrast vs forced-colors 决策（contrast=${caps.contrastMore}, forced=${caps.forcedColorsActive}）`);
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. prefers-contrast 与 forced-colors',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.contrast ? 'success' : 'error' }, caps.contrast ? 'contrast ✓' : 'contrast ✗'),
        h(Tag, { color: caps.forcedColors ? 'success' : 'error' }, caps.forcedColors ? 'forced-colors ✓' : 'forced-colors ✗'),
        h(Tag, { color: caps.forcedColorsActive ? 'warning' : 'primary' }, caps.forcedColorsActive ? '当前=active' : '当前=none')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '@media (prefers-contrast: more|less|custom|no-preference) 用户请求的对比度级别；@media (forced-colors: active|none) Windows 高对比度模式（强制配色）；forced-color-adjust: auto|none|preserve-parent-color 控制元素是否服从强制配色。强制配色下颜色被替换为系统调色板（Canvas/CanvasText/ButtonText 等），需用系统颜色关键字。实战：高对比度模式下调整边框、移除纯装饰性背景、确保焦点可见。matchMedia(\'(forced-colors: active)\').matches JS 检测。'),
        h('div', { class: 'css-mup-contrast-demo css-mup-forced-demo fs-sm', style: { padding: '8px 12px', border: '1px solid #888', borderRadius: '4px' } },
          '强制配色 / 高对比度演示容器（forced-colors: active 时背景=Canvas、文字=CanvasText、边框=ButtonText）'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('能力检测', { type: 'primary', size: 'sm', onClick: () => this._showContrastForcedCaps() }),
          this._btn('展示语法', { size: 'sm', onClick: () => this._showContrastForcedSyntax() }),
          this._btn('实战要点', { size: 'sm', onClick: () => this._showContrastForcedPractical() }),
          this._btn('决策对比', { size: 'sm', onClick: () => this._showContrastForcedDecision() })),
        h('div', { class: 'fs-sm text-secondary' }, 'prefers-contrast / forced-colors 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.contrastForcedInfo || '（点击「能力检测」或「展示语法」）')),
        h(Alert, { type: 'info', message: 'forced-colors 是硬替换（系统调色板），prefers-contrast 是软提示（作者增强）', description: 'forced-colors: active 时浏览器强制把作者颜色替换为系统颜色关键字；prefers-contrast 让作者主动增强/减弱对比度。优先级：forced-colors > prefers-contrast > 默认。jsdom 不模拟，演示仅展示代码片段。' }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：prefers-reduced-transparency 与 prefers-reduced-data ===================

  _showTransparencyDataCaps() {
    const caps = this._caps();
    this.setState({ transparencyDataInfo:
      '===== prefers-reduced-transparency 与 prefers-reduced-data 能力检测 =====\n\n' +
      `  matchMedia('(prefers-reduced-transparency: reduce)').matches : ${caps.reducedTransparencyActive}\n` +
      `  matchMedia('(prefers-reduced-transparency: reduce)') 可识别 : ${caps.reducedTransparency}\n` +
      `  matchMedia('(prefers-reduced-data: reduce)').matches         : ${caps.reducedDataActive}\n` +
      `  matchMedia('(prefers-reduced-data: reduce)') 可识别          : ${caps.reducedData}\n\n` +
      'prefers-reduced-transparency 取值：\n' +
      '  - reduce          // 用户请求减少半透明效果\n' +
      '  - no-preference   // 默认\n\n' +
      'prefers-reduced-data 取值：\n' +
      '  - reduce          // 用户请求减少数据传输（省流量模式）\n' +
      '  - no-preference   // 默认\n\n' +
      '浏览器支持（截至 2025 年初）：\n' +
      '  prefers-reduced-transparency: Chrome 118+ / Safari 17.5+（部分）/ Firefox 待定\n' +
      '  prefers-reduced-data:        Chrome 80+（部分，需启用 flag）/ Firefox 待定 / Safari 不支持\n' +
      '  → 两者均为较新特性，浏览器支持有限，应作为渐进增强而非必需\n\n' +
      '注：jsdom 不模拟 matchMedia，检测仅作能力探测参考。' });
    this._addLog('caps', `prefers-reduced-transparency / prefers-reduced-data 检测：transparency=${caps.reducedTransparencyActive}, data=${caps.reducedDataActive}`);
  }

  _showTransparencyDataSyntax() {
    this.setState({ transparencyDataInfo:
      '===== prefers-reduced-transparency 与 prefers-reduced-data 语法 =====\n\n' +
      '/* prefers-reduced-transparency：减少半透明效果 */\n' +
      '.glass-panel {\n' +
      '  background: rgba(255, 255, 255, 0.6);\n' +
      '  backdrop-filter: blur(10px);\n' +
      '}\n' +
      '@media (prefers-reduced-transparency: reduce) {\n' +
      '  .glass-panel {\n' +
      '    background: #ffffff;          /* 实色背景 */\n' +
      '    backdrop-filter: none;        /* 移除 backdrop-filter */\n' +
      '    opacity: 1;                   /* 移除透明度 */\n' +
      '  }\n' +
      '}\n\n' +
      '/* prefers-reduced-data：减少数据传输 */\n' +
      '@media (prefers-reduced-data: reduce) {\n' +
      '  /* 1. 不加载 web font，用系统字体 */\n' +
      '  body { font-family: system-ui, sans-serif !important; }\n' +
      '  .web-font-loaded { display: none; }\n' +
      '\n' +
      '  /* 2. 不加载非必要图片（用 CSS 渐变替代）*/\n' +
      '  .hero-bg {\n' +
      '    background: linear-gradient(#1677ff, #722ed1);\n' +
      '    background-image: none;  /* 覆盖高分辨率图片 */\n' +
      '  }\n' +
      '\n' +
      '  /* 3. 不预加载视频 / 大型资源 */\n' +
      '  video { preload: none; }\n' +
      '\n' +
      '  /* 4. 降低图片分辨率（srcset 配合）*/\n' +
      '  /* HTML: <img srcset="low.jpg 480w, high.jpg 1920w" sizes="..."> */\n' +
      '}\n\n' +
      'JS 检测：\n' +
      "  matchMedia('(prefers-reduced-transparency: reduce)').matches\n" +
      "  matchMedia('(prefers-reduced-data: reduce)').matches" });
    this._addLog('syntax', '已展示 prefers-reduced-transparency / prefers-reduced-data 语法');
  }

  _showTransparencyPractical() {
    this.setState({ transparencyDataInfo:
      '===== prefers-reduced-transparency 实战 =====\n\n' +
      '触发场景：\n' +
      '  - 透明度叠加导致文字可读性下降（玻璃拟态、半透明遮罩）\n' +
      '  - 用户在系统设置中开启「减少透明度」（macOS: 辅助功能 → 显示 → 减少透明度）\n' +
      '  - 视觉障碍用户对低对比度内容敏感\n\n' +
      '常见需调整的属性：\n' +
      '  - opacity: 0.x → opacity: 1\n' +
      '  - rgba(r, g, b, 0.x) → rgb(r, g, b)（实色）\n' +
      '  - backdrop-filter: blur() → backdrop-filter: none\n' +
      '  - background-blend-mode → 移除或简化\n' +
      '  - mix-blend-mode → normal\n\n' +
      '实战模式：\n' +
      '  /* 默认：玻璃拟态 */\n' +
      '  .modal {\n' +
      '    background: rgba(0, 0, 0, 0.5);\n' +
      '    backdrop-filter: blur(8px);\n' +
      '  }\n' +
      '  /* reduce：实色遮罩 */\n' +
      '  @media (prefers-reduced-transparency: reduce) {\n' +
      '    .modal {\n' +
      '      background: rgba(0, 0, 0, 0.85);  /* 提高不透明度 */\n' +
      '      backdrop-filter: none;\n' +
      '    }\n' +
      '  }\n\n' +
      '注意：\n' +
      '  - 不要完全移除遮罩（功能性需保留），仅提升不透明度\n' +
      '  - 渐变背景也属于「半透明」范畴（如有 alpha 通道）\n' +
      '  - 与 prefers-contrast 协同：两者常一起启用，增强可读性' });
    this._addLog('practical', '已展示 prefers-reduced-transparency 实战要点');
  }

  _showDataPractical() {
    this.setState({ transparencyDataInfo:
      '===== prefers-reduced-data 实战 =====\n\n' +
      '触发场景：\n' +
      '  - 移动设备省流量模式（Android: 数据节省程序）\n' +
      '  - 用户在系统 / 浏览器设置中启用「数据节省」\n' +
      '  - 网络计费 / 弱网环境\n\n' +
      '资源节省策略（按数据量排序）：\n' +
      '  1. 字体（web font，单文件可达数百 KB）\n' +
      '     - 用系统字体替代：font-family: system-ui, sans-serif;\n' +
      '     - 或仅加载子集（unicode-range 配合）\n' +
      '     - font-display: optional（不阻塞渲染）\n' +
      '\n' +
      '  2. 图片（占页面数据量最大）\n' +
      '     - 降低分辨率：srcset 提供多档，reduce 时选最低档\n' +
      '     - 用 CSS 渐变 / 纯色替代装饰性图片\n' +
      '     - 懒加载：loading="lazy"\n' +
      '     - 现代格式：AVIF / WebP（更小）\n' +
      '\n' +
      '  3. 视频\n' +
      '     - preload="none"（不预加载）\n' +
      '     - 提供海报图替代自动播放\n' +
      '     - 降低分辨率 / 帧率\n' +
      '\n' +
      '  4. JavaScript / 第三方库\n' +
      '     - 不加载非必要 polyfill\n' +
      '     - 延迟加载分析脚本、广告 SDK\n' +
      '     - 移除装饰性动画库\n' +
      '\n' +
      '  5. 预加载 / 预取（prefetch / preload）\n' +
      '     - reduce 时禁用 prefetch（不预取下一页资源）\n' +
      '     - 仅保留 critical preload\n\n' +
      'JS 决策示例：\n' +
      "  const saveData = matchMedia('(prefers-reduced-data: reduce)').matches;\n" +
      '  if (!saveData) {\n' +
      '    loadWebFont();      // 仅在非省流模式加载 web font\n' +
      '    prefetchNextPage();\n' +
      '  }\n\n' +
      '与 navigator.connection.saveData 协同：\n' +
      '  - prefers-reduced-data 是用户偏好（CSS / matchMedia）\n' +
      '  - navigator.connection.saveData 是浏览器层的数据节省开关\n' +
      '  - 二者可能同时存在，建议任一为 true 即采取节省策略' });
    this._addLog('practical', '已展示 prefers-reduced-data 实战要点');
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. prefers-reduced-transparency 与 prefers-reduced-data',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.reducedTransparency ? 'success' : 'error' }, caps.reducedTransparency ? 'transparency ✓' : 'transparency ✗'),
        h(Tag, { color: caps.reducedData ? 'success' : 'error' }, caps.reducedData ? 'reduced-data ✓' : 'reduced-data ✗'),
        h(Tag, { color: 'warning' }, '较新特性')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '@media (prefers-reduced-transparency: reduce) 用户请求减少半透明效果（提升可读性）；@media (prefers-reduced-data: reduce) 用户请求减少数据传输（省流量模式）。reduced-data 实战：不加载非必要资源、用系统字体替代 web font、低分辨率图片；reduced-transparency 实战：移除 backdrop-filter、降低 opacity 叠加。两者均为较新特性，浏览器支持有限。matchMedia(\'(prefers-reduced-transparency: reduce)\').matches / matchMedia(\'(prefers-reduced-data: reduce)\').matches 检测。'),
        h('div', { class: 'css-mup-transparency-demo fs-sm' },
          '半透明 + backdrop-filter 演示容器（reduce-transparency 时应变为实色）'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('能力检测', { type: 'primary', size: 'sm', onClick: () => this._showTransparencyDataCaps() }),
          this._btn('展示语法', { size: 'sm', onClick: () => this._showTransparencyDataSyntax() }),
          this._btn('transparency 实战', { size: 'sm', onClick: () => this._showTransparencyPractical() }),
          this._btn('data 实战', { size: 'sm', onClick: () => this._showDataPractical() })),
        h('div', { class: 'fs-sm text-secondary' }, 'transparency / data 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.transparencyDataInfo || '（点击「能力检测」或「展示语法」）')),
        h(Alert, { type: 'warning', message: '两者均为较新特性，浏览器支持有限，应作为渐进增强', description: 'prefers-reduced-transparency（Chrome 118+）、prefers-reduced-data（Chrome 80+ 部分需 flag）。不支持时降级为默认样式（功能仍可用）。与 navigator.connection.saveData 协同判断省流模式。jsdom 不模拟，演示仅展示代码片段。' }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：inverted-colors 与 dynamic-range ===================

  _showInvertedDynamicCaps() {
    const caps = this._caps();
    this.setState({ invertedDynamicInfo:
      '===== inverted-colors 与 dynamic-range 能力检测 =====\n\n' +
      `  matchMedia('(inverted-colors: inverted)').matches : ${caps.invertedColorsActive}\n` +
      `  matchMedia('(inverted-colors: inverted)') 可识别 : ${caps.invertedColors}\n` +
      `  matchMedia('(dynamic-range: high)').matches      : ${caps.dynamicRangeHigh}\n` +
      `  matchMedia('(dynamic-range: high)') 可识别       : ${caps.dynamicRange}\n` +
      `  matchMedia('(color-gamut: p3)').matches          : ${caps.colorGamutP3}\n` +
      `  matchMedia('(color-gamut: rec2020)').matches     : ${caps.colorGamutRec2020}\n\n` +
      'inverted-colors 取值：\n' +
      '  - inverted  // 系统启用了颜色反转（macOS 反转颜色辅助功能）\n' +
      '  - none      // 默认\n\n' +
      'dynamic-range 取值：\n' +
      '  - high      // HDR 显示器（高动态范围）\n' +
      '  - standard  // SDR（标准动态范围）\n\n' +
      'color-gamut 取值（与 dynamic-range 相关）：\n' +
      '  - srgb      // 标准 sRGB 色域\n' +
      '  - p3        // Display P3 广色域\n' +
      '  - rec2020   // Rec.2020 超广色域\n\n' +
      '浏览器支持：\n' +
      '  inverted-colors: 仅 Safari / macOS（Chrome / Firefox 不支持）\n' +
      '  dynamic-range:   Chrome 98+ / Safari 17.2+ / Firefox 待定\n' +
      '  color-gamut:     Chrome 64+ / Safari 10.1+ / Firefox 未完整\n\n' +
      '注：jsdom 不模拟 matchMedia，检测仅作能力探测参考。' });
    this._addLog('caps', `inverted-colors / dynamic-range 检测：inverted=${caps.invertedColorsActive}, hdr=${caps.dynamicRangeHigh}, p3=${caps.colorGamutP3}`);
  }

  _showInvertedColorsPractical() {
    this.setState({ invertedDynamicInfo:
      '===== inverted-colors 实战（避免双重反转） =====\n\n' +
      '问题场景：\n' +
      '  macOS 用户启用「反转颜色」辅助功能后，系统会把所有内容（包括图片）颜色反转。\n' +
      '  若作者用 CSS filter: invert(1) 反转图片（如让深色图标在深色背景可见），\n' +
      '  图片会被「系统反转一次 + CSS 反转一次」= 双重反转 = 原色（破坏视觉效果）。\n\n' +
      '解决方案：仅在系统未反转时应用 CSS 反转\n' +
      '  /* 默认：CSS 反转深色图标 */\n' +
      '  .dark-icon { filter: invert(1); }\n\n' +
      '  /* 系统已反转时，撤销 CSS 反转（避免双重反转）*/\n' +
      '  @media (inverted-colors: inverted) {\n' +
      '    .dark-icon { filter: none; }\n' +
      '  }\n\n' +
      '反向场景：强制反转特定内容\n' +
      '  /* 系统未反转时，主动反转 */\n' +
      '  @media (inverted-colors: none) {\n' +
      '    .invertible { filter: invert(1); }\n' +
      '  }\n\n' +
      '注意事项：\n' +
      '  - inverted-colors 仅 Safari / macOS 支持，其他浏览器需降级\n' +
      '  - 降级策略：不依赖该特性，仅作为渐进增强\n' +
      '  - 用户启用反转通常是为了无障碍（光敏感、低视力），应尊重而非对抗' });
    this._addLog('practical', '已展示 inverted-colors 实战（避免双重反转）');
  }

  _showDynamicRangePractical() {
    this.setState({ invertedDynamicInfo:
      '===== dynamic-range / color-gamut 实战（HDR / 广色域） =====\n\n' +
      'dynamic-range: high 表示用户显示器支持 HDR（高动态范围），可呈现更亮的高光、更深的暗部。\n' +
      'color-gamut 表示显示器色域范围：srgb < p3 < rec2020。\n\n' +
      '实战 1：HDR 图片\n' +
      '  /* SDR 默认图 */\n' +
      '  .hero { background-image: url("hero-sdr.jpg"); }\n' +
      '  /* HDR 显示器：加载 HDR 版本（更广色域、更高亮度）*/\n' +
      '  @media (dynamic-range: high) {\n' +
      '    .hero { background-image: url("hero-hdr.jpg"); }\n' +
      '  }\n\n' +
      '实战 2：广色域颜色\n' +
      '  /* 默认 sRGB */\n' +
      '  .vivid-red { background: rgb(255, 0, 0); }\n' +
      '  /* P3 广色域：更鲜艳的红 */\n' +
      '  @media (color-gamut: p3) {\n' +
      '    .vivid-red { background: color(display-p3 1 0 0); }\n' +
      '  }\n' +
      '  /* Rec.2020 超广色域 */\n' +
      '  @media (color-gamut: rec2020) {\n' +
      '    .vivid-red { background: color(rec2020 1 0 0); }\n' +
      '  }\n\n' +
      '实战 3：HDR 视频\n' +
      '  <video src="video-sdr.mp4">\n' +
      '    @media (dynamic-range: high) {\n' +
      '      /* JS 切换 src 为 HDR 版本 */\n' +
      '    }\n' +
      '  </video>\n\n' +
      '实战 4：渐变（HDR 配合 oklab / oklch）\n' +
      '  @media (dynamic-range: high) {\n' +
      '    .gradient {\n' +
      '      background: linear-gradient(in oklab, #ff0000, #00ff00, #0000ff);\n' +
      '    }\n' +
      '  }\n\n' +
      'JS 检测：\n' +
      "  const isHDR = matchMedia('(dynamic-range: high)').matches;\n" +
      "  const gamut = matchMedia('(color-gamut: rec2020)').matches ? 'rec2020'\n" +
      "             : matchMedia('(color-gamut: p3)').matches       ? 'p3'\n" +
      "             : 'srgb';" });
    this._addLog('practical', '已展示 dynamic-range / color-gamut 实战（HDR / 广色域）');
  }

  _showInvertedDynamicDecision() {
    const caps = this._caps();
    this.setState({ invertedDynamicInfo:
      '===== inverted-colors vs dynamic-range vs color-gamut 决策 =====\n\n' +
      '三者关注不同维度：\n' +
      '  - inverted-colors：用户辅助功能（颜色反转），关注「是否被系统反转」\n' +
      '  - dynamic-range：显示器硬件能力（HDR vs SDR），关注「亮度动态范围」\n' +
      '  - color-gamut：显示器色域（sRGB / P3 / Rec2020），关注「可呈现颜色范围」\n\n' +
      '组合使用：\n' +
      '  /* P3 + HDR：提供最广色域 + 最高亮度的资源 */\n' +
      '  @media (color-gamut: p3) and (dynamic-range: high) {\n' +
      '    .hero { background-image: url("hero-p3-hdr.jpg"); }\n' +
      '  }\n' +
      '  /* 仅 P3（SDR）：广色域但标准亮度 */\n' +
      '  @media (color-gamut: p3) and (dynamic-range: standard) {\n' +
      '    .hero { background-image: url("hero-p3-sdr.jpg"); }\n' +
      '  }\n' +
      '  /* 默认 sRGB SDR */\n' +
      '  .hero { background-image: url("hero-srgb.jpg"); }\n\n' +
      'inverted-colors 优先级：\n' +
      '  - 用户启用反转通常是无障碍需求，应尊重\n' +
      '  - 仅在「作者主动反转」场景下需检测（避免双重反转）\n' +
      '  - 不应为了「对抗用户反转」而使用（破坏无障碍）\n\n' +
      '降级策略：\n' +
      '  - inverted-colors 不支持时：不应用 CSS 反转（避免双重反转风险）\n' +
      '  - dynamic-range / color-gamut 不支持时：使用 SDR / sRGB 默认资源\n' +
      '  - 渐进增强：基础 sRGB SDR，支持时升级到 P3 / HDR\n\n' +
      `当前环境：inverted=${caps.invertedColorsActive}, hdr=${caps.dynamicRangeHigh}, p3=${caps.colorGamutP3}, rec2020=${caps.colorGamutRec2020}` });
    this._addLog('decision', `展示三特性决策（inverted=${caps.invertedColorsActive}, hdr=${caps.dynamicRangeHigh}）`);
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. inverted-colors 与 dynamic-range',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.invertedColors ? 'success' : 'error' }, caps.invertedColors ? 'inverted-colors ✓' : 'inverted-colors ✗'),
        h(Tag, { color: caps.dynamicRange ? 'success' : 'error' }, caps.dynamicRange ? 'dynamic-range ✓' : 'dynamic-range ✗'),
        h(Tag, { color: caps.colorGamutP3 ? 'success' : 'default' }, caps.colorGamutP3 ? 'P3 ✓' : 'P3 ?')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '@media (inverted-colors: inverted|none) 检测系统是否启用颜色反转（macOS 反转颜色辅助功能）；@media (dynamic-range: high|standard) 检测显示器动态范围（HDR/SDR），与 color-gamut 相关；@media (color-gamut: rec2020|p3|srgb) 检测色域支持。inverted-colors 实战：反转图片避免双重反转（图片被系统反转一次再被 CSS 反转一次）；dynamic-range/high 实战：为 HDR 显示器提供更广色域内容。浏览器支持：inverted-colors 仅 Safari/macOS；dynamic-range 较新。 '),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('能力检测', { type: 'primary', size: 'sm', onClick: () => this._showInvertedDynamicCaps() }),
          this._btn('inverted 实战', { size: 'sm', onClick: () => this._showInvertedColorsPractical() }),
          this._btn('dynamic-range 实战', { size: 'sm', onClick: () => this._showDynamicRangePractical() }),
          this._btn('决策对比', { size: 'sm', onClick: () => this._showInvertedDynamicDecision() })),
        h('div', { class: 'fs-sm text-secondary' }, 'inverted-colors / dynamic-range 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.invertedDynamicInfo || '（点击「能力检测」或「inverted 实战」）')),
        h(Alert, { type: 'info', message: 'inverted-colors 仅 Safari/macOS，dynamic-range 较新，应作为渐进增强', description: 'inverted-colors 避免双重反转（图片被系统反转+CSS反转）；dynamic-range + color-gamut 为 HDR 显示器提供更广色域内容。不支持时降级为 SDR / sRGB 默认资源。jsdom 不模拟，演示仅展示代码片段。' }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：hover 与 pointer 媒体特性 ===================

  _showHoverPointerCaps() {
    const caps = this._caps();
    this.setState({ hoverPointerInfo:
      '===== hover 与 pointer 媒体特性能力检测 =====\n\n' +
      `  matchMedia('(hover: hover)').matches             : ${caps.hoverSupported}\n` +
      `  matchMedia('(hover: none)').matches              : ${caps.hoverNone}\n` +
      `  matchMedia('(pointer: fine)').matches            : ${caps.pointerFine}\n` +
      `  matchMedia('(pointer: coarse)').matches          : ${caps.pointerCoarse}\n` +
      `  matchMedia('(pointer: none)').matches            : ${caps.pointerNone}\n` +
      `  matchMedia('(any-hover: hover)').matches         : ${caps.anyHover}\n` +
      `  matchMedia('(any-pointer: fine)').matches        : ${caps.anyPointerFine}\n\n` +
      'hover 取值：\n' +
      '  - hover   // 主输入设备支持 hover（鼠标、可悬停触控板）\n' +
      '  - none    // 主输入设备不支持 hover（触屏、笔触）\n\n' +
      'pointer 取值：\n' +
      '  - fine    // 精确指针（鼠标）\n' +
      '  - coarse  // 粗指针（手指触控）\n' +
      '  - none    // 无指针（纯语音、键盘）\n\n' +
      'any-hover / any-pointer 取值（同上，但检测「任意」输入设备）：\n' +
      '  - 主设备 vs 任意设备的区别：\n' +
      '    笔记本 + 触屏 + 外接鼠标：\n' +
      '      hover: none（主设备=触屏，不支持 hover）\n' +
      '      any-hover: hover（存在外接鼠标，支持 hover）\n' +
      '  - 实战：通常用 hover / pointer（主设备），any-* 用于「多设备场景」\n\n' +
      '注：jsdom 不模拟输入设备，检测仅作能力探测参考。' });
    this._addLog('caps', `hover / pointer 检测：hover=${caps.hoverSupported}, pointer=${caps.pointerFine ? 'fine' : caps.pointerCoarse ? 'coarse' : caps.pointerNone ? 'none' : '?'}`);
  }

  _showHoverPointerSyntax() {
    this.setState({ hoverPointerInfo:
      '===== hover 与 pointer 媒体特性语法 =====\n\n' +
      '/* hover: hover 时才启用 hover 效果（避免触屏「粘滞 hover」）*/\n' +
      '@media (hover: hover) {\n' +
      '  .btn:hover {\n' +
      '    background: Highlight;\n' +
      '    color: HighlightText;\n' +
      '    transform: translateY(-1px);\n' +
      '  }\n' +
      '  .tooltip:hover .tooltip-content { display: block; }\n' +
      '}\n\n' +
      '/* pointer: fine 时，正常间距与光标 */\n' +
      '@media (pointer: fine) {\n' +
      '  .btn { padding: 4px 10px; cursor: pointer; }\n' +
      '}\n\n' +
      '/* pointer: coarse 时，增大点击区域（44x44 最小）*/\n' +
      '@media (pointer: coarse) {\n' +
      '  .btn {\n' +
      '    padding: 12px 20px;\n' +
      '    min-height: 44px;\n' +
      '    min-width: 44px;\n' +
      '  }\n' +
      '}\n\n' +
      '/* pointer: none 时，移除 cursor 相关样式 */\n' +
      '@media (pointer: none) {\n' +
      '  .btn { cursor: default; }\n' +
      '}\n\n' +
      '/* any-hover / any-pointer：检测任意设备 */\n' +
      '@media (any-hover: hover) {\n' +
      '  /* 至少有一个设备支持 hover，可显示 hover 提示 */\n' +
      '}\n' +
      '@media (any-pointer: fine) {\n' +
      '  /* 至少有一个精确指针，可启用精细交互 */\n' +
      '}\n\n' +
      'JS 检测：\n' +
      "  const canHover = matchMedia('(hover: hover)').matches;\n" +
      "  const pointerType = matchMedia('(pointer: fine)').matches  ? 'fine'\n" +
      "                   : matchMedia('(pointer: coarse)').matches ? 'coarse'\n" +
      "                   : 'none';" });
    this._addLog('syntax', '已展示 hover / pointer / any-hover / any-pointer 语法');
  }

  _showHoverPointerPractical() {
    this.setState({ hoverPointerInfo:
      '===== hover / pointer 实战要点 =====\n\n' +
      '1. 触屏「粘滞 hover」问题\n' +
      '   - 触屏设备上，:hover 会在 tap 后「粘滞」直到下次 tap 别处\n' +
      '   - 仅在 (hover: hover) 时启用 :hover，避免触屏粘滞\n' +
      '   - 示例：\n' +
      '     @media (hover: hover) {\n' +
      '       .dropdown:hover .menu { display: block; }\n' +
      '     }\n' +
      '     /* 触屏用 tap 切换（JS 控制）*/\n' +
      '\n' +
      '2. 增大点击区域（触屏）\n' +
      '   - WCAG 建议 44x44 CSS px 最小可点击区域\n' +
      '   - pointer: coarse 时增大 padding / min-height\n' +
      '   - 示例：\n' +
      '     @media (pointer: coarse) {\n' +
      '       .btn { min-height: 44px; min-width: 44px; padding: 12px 20px; }\n' +
      '     }\n' +
      '\n' +
      '3. 工具提示（tooltip）策略\n' +
      '   - hover 设备：鼠标悬停显示 tooltip（CSS :hover）\n' +
      '   - 触屏设备：tap 显示 / tap 隐藏（JS 控制，需提供关闭按钮）\n' +
      '   - 无指针设备：聚焦显示（:focus / :focus-visible）\n' +
      '\n' +
      '4. 拖拽交互\n' +
      '   - pointer: fine 时启用拖拽（鼠标精确）\n' +
      '   - pointer: coarse 时改用长按 / 滑动（触屏不精确）\n' +
      '\n' +
      '5. vs ontouchstart 特征检测\n' +
      '   - 旧方案：const isTouch = \'ontouchstart\' in window;\n' +
      '   - 问题：笔记本触屏会误判为触屏（实际主设备是鼠标）\n' +
      '   - 新方案：matchMedia(\'(hover: hover)\').matches 更可靠（主设备语义）\n' +
      '   - 推荐：用 hover / pointer 媒体特性替代 ontouchstart\n' +
      '\n' +
      '6. 与 :hover 伪类协同\n' +
      '   - 不要全局禁用 :hover（影响桌面体验）\n' +
      '   - 用 @media (hover: hover) 包裹 :hover 规则，触屏自动降级\n' +
      '   - 触屏用 :active / :focus-visible 替代 hover 反馈' });
    this._addLog('practical', '已展示 hover / pointer 实战要点');
  }

  _showHoverPointerDecision() {
    const caps = this._caps();
    this.setState({ hoverPointerInfo:
      '===== hover vs pointer vs any-hover 决策矩阵 =====\n\n' +
      '场景                          | 推荐检测                    | 理由\n' +
      '------------------------------|-----------------------------|---------------------------\n' +
      '是否启用 :hover 效果          | (hover: hover)              | 主设备语义，避免触屏粘滞\n' +
      '点击区域大小                  | (pointer: coarse)           | 触屏需 44x44 最小\n' +
      '是否显示 tooltip（悬停）      | (hover: hover)              | 触屏无悬停概念\n' +
      '是否启用拖拽                  | (pointer: fine)             | 鼠标精确，触屏不精确\n' +
      '是否存在任意 hover 设备       | (any-hover: hover)          | 笔记本触屏+外接鼠标场景\n' +
      '是否存在任意精确指针          | (any-pointer: fine)         | 多设备场景精细交互\n\n' +
      '主设备 vs 任意设备选择：\n' +
      '  - 主设备（hover / pointer）：反映「当前主要交互方式」\n' +
      '    笔记本触屏：主设备=触屏 → hover: none, pointer: coarse\n' +
      '    适用：决定 UI 默认交互模式（hover vs tap）\n' +
      '\n' +
      '  - 任意设备（any-hover / any-pointer）：反映「是否存在该能力」\n' +
      '    笔记本触屏+外接鼠标：any-hover: hover（鼠标存在）\n' +
      '    适用：决定是否「提供」该能力（如显示 hover 提示，用户可切到鼠标）\n\n' +
      '组合写法：\n' +
      '  /* 主设备支持 hover：默认启用 */\n' +
      '  @media (hover: hover) { .btn:hover { ... } }\n' +
      '  /* 主设备不支持但存在 hover 设备：可选启用 */\n' +
      '  @media (hover: none) and (any-hover: hover) {\n' +
      '    .btn.js-hover { /* JS 检测鼠标进入时启用 */ }\n' +
      '  }\n' +
      '  /* 触屏：增大点击区域 */\n' +
      '  @media (pointer: coarse) { .btn { min-height: 44px; } }\n\n' +
      'vs 现代指针事件（Pointer Events API）：\n' +
      '  - 媒体特性：CSS 声明式，决定样式分支\n' +
      '  - Pointer Events：JS 命令式，运行时处理交互\n' +
      '  - 二者协同：媒体特性决定 UI 形态，Pointer Events 处理交互逻辑\n\n' +
      `当前环境：hover=${caps.hoverSupported}, pointer=${caps.pointerFine ? 'fine' : caps.pointerCoarse ? 'coarse' : 'none'}, any-hover=${caps.anyHover}` });
    this._addLog('decision', `展示 hover / pointer 决策矩阵（hover=${caps.hoverSupported}, any-hover=${caps.anyHover}）`);
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const pointerLabel = caps.pointerFine ? 'fine' : caps.pointerCoarse ? 'coarse' : caps.pointerNone ? 'none' : '?';
    const card = new Card({
      title: '6. hover 与 pointer 媒体特性',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.hover ? 'success' : 'error' }, caps.hover ? 'hover ✓' : 'hover ✗'),
        h(Tag, { color: caps.pointer ? 'success' : 'error' }, caps.pointer ? 'pointer ✓' : 'pointer ✗'),
        h(Tag, { color: caps.hoverSupported ? 'warning' : 'primary' }, `当前=${caps.hoverSupported ? 'hover' : 'none'} / ${pointerLabel}`)),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '@media (hover: hover|none) 检测主输入设备是否支持 hover（桌面 vs 触屏）；@media (pointer: fine|coarse|none) 检测指针精度（鼠标 fine / 触屏 coarse / 无指针 none）；@media (any-hover: hover) / @media (any-pointer: fine) 检测任意输入设备（多设备场景）。实战：hover 设备显示 hover 效果与工具提示；触屏设备增大点击区域、用 tap 替代 hover。vs 特征检测 window.matchMedia(\'(hover: hover)\').matches 比 ontouchstart 更可靠；与 :hover 伪类协同：@media (hover: hover) { .btn:hover { ... } }。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('能力检测', { type: 'primary', size: 'sm', onClick: () => this._showHoverPointerCaps() }),
          this._btn('展示语法', { size: 'sm', onClick: () => this._showHoverPointerSyntax() }),
          this._btn('实战要点', { size: 'sm', onClick: () => this._showHoverPointerPractical() }),
          this._btn('决策矩阵', { size: 'sm', onClick: () => this._showHoverPointerDecision() })),
        h('div', { class: 'fs-sm text-secondary' }, 'hover / pointer 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.hoverPointerInfo || '（点击「能力检测」或「展示语法」）')),
        h(Alert, { type: 'info', message: 'hover / pointer 比 ontouchstart 更可靠，反映主设备语义', description: 'ontouchstart 在笔记本触屏会误判；hover / pointer 媒体特性反映「主输入设备」能力。用 @media (hover: hover) 包裹 :hover 规则避免触屏粘滞；pointer: coarse 时增大点击区域（44x44 最小）。jsdom 不模拟，演示仅展示代码片段。' }),
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
    return h('div', { class: 'api-lab-page css-media-user-preference-page' },
      h('h2', { class: 'section-title' }, 'CSS 用户偏好媒体查询'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页演示 CSS Media Queries Level 5+ 用户偏好与交互能力特性：prefers-color-scheme 与 color-scheme、prefers-reduced-motion、prefers-contrast 与 forced-colors、prefers-reduced-transparency 与 prefers-reduced-data、inverted-colors 与 dynamic-range、hover 与 pointer 媒体特性。jsdom 中 matchMedia 默认未实现，所有特性检测会降级为仅说明，真实浏览器中可实时探测与监听系统偏好变化。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
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
