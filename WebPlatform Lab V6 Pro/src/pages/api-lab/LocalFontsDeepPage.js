// =====================================================================
// LocalFontsDeepPage.js —— Local Font Access 与 CSS Font Loading API 深入 实验室
// 演示 MDN（6 张卡片覆盖的 API）：
//   1. Local Font Access API —— window.queryLocalFonts({ postscriptNames }) / 'local-fonts'
//      权限策略 / 用户手势 / LocalFont(family, fullName, postscriptName, style)
//   2. CSS Font Loading API —— document.fonts (FontFaceSet) / check / load / ready /
//      onloading|onloadingdone|onloadingerror / new FontFace(family, source, descriptors) /
//      .load() / .status / add|delete|clear
//   3. @font-face 与 font-display 策略 —— @font-face 属性 / font-display 取值 / unicode-range 子集 / FOUT vs FOIT
//   4. 可变字体 Variable Fonts —— 注册轴 wght/wdth/ital/slnt/opsz 与自定义轴 GRAD/XPRN / font-variation-settings / font-optical-sizing / CSS.supports 检测
//   5. font-feature-settings 与 OpenType 特性 —— liga/kern/calt/smcp/onum/tnum/frac/ss01-20/zero/swsh / font-variant-* 简写 / font-kerning
//   6. FontFaceSet 与性能优化 —— document.fonts.ready / forEach / preload / font-display: optional / unicode-range 子集 / size-adjust / ascent|descent|line-gap-override (减少 CLS)
// 说明：queryLocalFonts 为 Chrome-only 且需 'local-fonts' 权限策略与用户手势；FontFace /
//       document.fonts 在真实浏览器与 jsdom 中多数可用。所有 API 调用前做 typeof 能力检测，不可用时仅记日志（_addLog('warn', ...)），绝不抛异常。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class LocalFontsDeepPage extends Page {
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      localFontsInfo: '',       // Card 1：Local Font Access API
      fontLoadingInfo: '',      // Card 2：CSS Font Loading API
      fontFaceInfo: '',         // Card 3：@font-face 与 font-display
      variableFontInfo: '',     // Card 4：可变字体
      featureSettingsInfo: '',  // Card 5：font-feature-settings
      perfInfo: '',             // Card 6：FontFaceSet 性能优化
      iftInfo: '',              // Card 9：Incremental Font Transfer
    };
  }

  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    this._fontFaces = [];           // Card 2 通过 new FontFace 创建并 add 的对象数组
    this._fontFaceSetHandlers = []; // Card 2 / Card 6 document.fonts 上注册的事件回调
    this._injectedStyleEls = [];    // Card 3 / Card 4 注入的 <style> 元素数组

    // 一次性能力检测：本地字体 + CSS 字体加载全家桶
    const hasQueryLocalFonts = typeof queryLocalFonts === 'function';
    const hasDocumentFonts = typeof document !== 'undefined'
      && typeof document.fonts !== 'undefined' && document.fonts !== null;
    const hasFontFace = typeof FontFace !== 'undefined';
    let hasFontFaceSetMethods = false;
    if (hasDocumentFonts) {
      try { hasFontFaceSetMethods = typeof document.fonts.add === 'function'
        && typeof document.fonts.delete === 'function'; } catch { hasFontFaceSetMethods = false; }
    }
    let hasCSSSupports = false;
    try { hasCSSSupports = typeof CSS !== 'undefined' && typeof CSS.supports === 'function'; }
    catch { hasCSSSupports = false; }

    const parts = [
      `queryLocalFonts ${hasQueryLocalFonts ? '✓' : '✗'}`,
      `document.fonts ${hasDocumentFonts ? '✓' : '✗'}`,
      `FontFace ${hasFontFace ? '✓' : '✗'}`,
      `FontFaceSet.add/delete ${hasFontFaceSetMethods ? '✓' : '✗'}`,
      `CSS.supports ${hasCSSSupports ? '✓' : '✗'}`,
    ];
    const anyAvailable = hasDocumentFonts || hasFontFace;
    const summary = anyAvailable
      ? `本地字体与 CSS 字体加载能力检测：${parts.join(' · ')}。queryLocalFonts 为 Chrome-only 且需用户手势与 'local-fonts' 权限策略；FontFace / document.fonts 在真实浏览器与 jsdom 中多数可用，可执行真实字体加载演示。CSS.supports 用于检测可变字体支持。`
      : `本地字体与 CSS 字体加载能力检测：${parts.join(' · ')}。当前环境 document.fonts / FontFace 均不可用，所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。`;

    this.setState({ capsSummary: summary });
    this._addLog(anyAvailable ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!hasQueryLocalFonts) this._addLog('warn', 'queryLocalFonts 不可用（仅 Chrome 实现，且需用户手势 + local-fonts 权限策略）');
    if (!hasFontFace) this._addLog('warn', 'FontFace 不可用（typeof undefined）');
    if (!hasDocumentFonts) this._addLog('warn', 'document.fonts (FontFaceSet) 不可用');
    const hasIft = (function () { try { return typeof window !== 'undefined' && typeof window.IncrementalFontLoader !== 'undefined'; } catch { return false; } })();
    if (!hasIft) this._addLog('warn', 'IncrementalFontLoader 不可用（W3C WebFonts WG 2024-2025，Chrome 开发中，jsdom 无）');
  }

  componentWillUnmount() {
    // 释放 Card 2 通过 new FontFace 创建并 add 到 document.fonts 的对象
    if (Array.isArray(this._fontFaces) && this._fontFaces.length > 0) {
      for (const ff of this._fontFaces) {
        try {
          if (ff && typeof document !== 'undefined' && document.fonts
            && typeof document.fonts.delete === 'function') document.fonts.delete(ff);
        } catch { /* noop */ }
      }
      this._fontFaces = [];
    }
    // 清理 document.fonts 上的事件监听（try/catch 每个）
    if (Array.isArray(this._fontFaceSetHandlers) && this._fontFaceSetHandlers.length > 0) {
      for (const entry of this._fontFaceSetHandlers) {
        try {
          if (!entry) continue;
          const { type, handler } = entry;
          if (typeof document !== 'undefined' && document.fonts
            && typeof document.fonts.removeEventListener === 'function') {
            document.fonts.removeEventListener(type, handler);
          } else if (typeof document !== 'undefined' && document.fonts) {
            if (type === 'loading' && document.fonts.onloading === handler) document.fonts.onloading = null;
            else if (type === 'loadingdone' && document.fonts.onloadingdone === handler) document.fonts.onloadingdone = null;
            else if (type === 'loadingerror' && document.fonts.onloadingerror === handler) document.fonts.onloadingerror = null;
          }
        } catch { /* noop */ }
      }
      this._fontFaceSetHandlers = [];
    }
    // 移除注入的 <style> 元素（Card 3 / Card 4）
    for (const el of this._injectedStyleEls) {
      try { if (el && el.parentNode) el.parentNode.removeChild(el); } catch { /* noop */ }
    }
    this._injectedStyleEls = [];
  }

  _addLog(type, content) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  _caps() {
    return {
      queryLocalFonts: typeof queryLocalFonts === 'function',
      documentFonts: typeof document !== 'undefined'
        && typeof document.fonts !== 'undefined' && document.fonts !== null,
      fontFace: typeof FontFace !== 'undefined',
      fontFaceSetMethods: (function () {
        try { return typeof document !== 'undefined' && document.fonts
          && typeof document.fonts.add === 'function' && typeof document.fonts.delete === 'function'; }
        catch { return false; }
      })(),
      cssSupports: (function () {
        try { return typeof CSS !== 'undefined' && typeof CSS.supports === 'function'; }
        catch { return false; }
      })(),
      ift: (function () {
        try { return typeof window !== 'undefined' && typeof window.IncrementalFontLoader !== 'undefined'; }
        catch { return false; }
      })(),
      fontDisplaySwap: (function () {
        try { return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('font-display', 'swap'); }
        catch { return false; }
      })(),
    };
  }

  // =================== Card 1：Local Font Access API 本地字体访问 ===================

  _checkLocalFonts() {
    const caps = this._caps();
    if (!caps.queryLocalFonts) {
      this.setState({ localFontsInfo:
        'Local Font Access API 用法（当前环境不可用，仅说明）：\n\n' +
        "// 调用前需用户手势 + Permission Policy: local-fonts\n" +
        "const fonts = await window.queryLocalFonts({\n" +
        "  postscriptNames: ['Arial', 'Helvetica'],  // 可选，过滤 PostScript 名称\n" +
        "});\n" +
        "// fonts: LocalFont[]\n" +
        "for (const f of fonts) console.log(f.family, f.fullName, f.postscriptName, f.style);\n\n" +
        "说明：queryLocalFonts 仅 Chrome 实现，返回 LocalFont[]；LocalFont 字段：\n" +
        "  .family / .fullName / .postscriptName / .style（均为 string）\n" +
        "  需 Permission Policy 'local-fonts' 授权 + 用户手势触发。\n" +
        "  使用场景：设计工具、字体选择器、富文本编辑器。" });
      this._addLog('warn', 'queryLocalFonts 不可用（typeof undefined），已记录用法');
      return;
    }
    this.setState({ localFontsInfo:
      'Local Font Access API 检测：\n' +
      `  typeof queryLocalFonts = 'function'（可用）\n` +
      '  说明：调用前需用户手势与 Permission Policy "local-fonts" 授权。\n' +
      '  返回 Promise<LocalFont[]>，LocalFont 字段：\n' +
      '    .family / .fullName / .postscriptName / .style（均为 string）\n\n' +
      '点击「枚举本地字体」执行 queryLocalFonts（可能被拒绝，已 try/catch）。' });
    this._addLog('local', `queryLocalFonts 检测：可用（typeof === 'function'）`);
  }

  async _enumerateLocalFonts() {
    const caps = this._caps();
    if (!caps.queryLocalFonts) { this._addLog('warn', 'queryLocalFonts 不可用，无法枚举'); return; }
    try {
      const fonts = await queryLocalFonts({ postscriptNames: ['Arial', 'Helvetica'] });
      const arr = Array.isArray(fonts) ? fonts : [];
      const head = arr.slice(0, 5).map((f, i) =>
        `  [${i}] family="${f.family}" fullName="${f.fullName}" postscript="${f.postscriptName}" style="${f.style}"`).join('\n');
      this.setState({ localFontsInfo:
        `queryLocalFonts({ postscriptNames: ['Arial', 'Helvetica'] }) 调用成功：\n` +
        `  返回 LocalFont[]，共 ${arr.length} 个\n` +
        (arr.length > 0 ? `前 5 条：\n${head}\n` : '  （无匹配字体）\n') +
        '说明：postscriptNames 可选，省略则返回全部本地字体。' });
      this._addLog('local', `queryLocalFonts 成功，返回 ${arr.length} 个本地字体`);
    } catch (err) {
      this.setState({ localFontsInfo:
        `queryLocalFonts 调用失败：${err && err.name} - ${err && err.message}\n\n` +
        '常见原因：Permission Policy 未授权 / 非用户手势 / 用户拒绝 / 非安全上下文（需 https 或 localhost）。' });
      this._addLog('warn', `queryLocalFonts 调用失败：${err && err.name} - ${err && err.message}`);
    }
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. Local Font Access API 本地字体访问',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.queryLocalFonts ? 'success' : 'error' }, caps.queryLocalFonts ? 'queryLocalFonts ✓' : 'queryLocalFonts ✗'),
        h(Tag, { color: 'primary' }, 'Chrome-only'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'window.queryLocalFonts({ postscriptNames }) 返回 Promise<LocalFont[]>，需 Permission Policy "local-fonts" 授权与用户手势。LocalFont 字段：.family / .fullName / .postscriptName / .style。场景：设计工具、字体选择器。该 API 仅 Chrome 实现，jsdom 中 typeof queryLocalFonts === "undefined"。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测能力', { type: 'primary', size: 'sm', onClick: () => this._checkLocalFonts() }),
          this._btn('枚举本地字体', { size: 'sm', disabled: !caps.queryLocalFonts, onClick: () => this._enumerateLocalFonts() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '本地字体访问状态 / 用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.localFontsInfo || '（点击「检测能力」或「枚举本地字体」）')),
        h(Alert, {
          type: 'warning',
          message: 'queryLocalFonts 需要 Permission Policy 与用户手势',
          description: '调用前需授权 "local-fonts"（iframe 用 allow="local-fonts"），且必须在用户手势回调内调用，否则抛 NotAllowedError。用户可能在权限弹窗中拒绝。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：CSS Font Loading API 字体加载 ===================

  _checkFontFaceSet() {
    const caps = this._caps();
    if (!caps.documentFonts) {
      this.setState({ fontLoadingInfo:
        'CSS Font Loading API 用法（当前环境不可用，仅说明）：\n\n' +
        "const fontFace = new FontFace('Roboto', 'url(./Roboto.woff2)', {\n" +
        "  style: 'normal', weight: '400', stretch: 'normal',\n" +
        "  unicodeRange: 'U+0000-00FF', display: 'swap',\n" +
        "});\n" +
        "await fontFace.load();   // 显式加载，Promise<FontFace>\n" +
        "document.fonts.add(fontFace);   // 加入 FontFaceSet\n" +
        "// fontFace.status: 'unloaded' | 'loading' | 'loaded' | 'error'\n\n" +
        "document.fonts.check('16px Roboto', 'Aa')   // 同步检测是否已加载\n" +
        "document.fonts.load('16px Roboto', 'Aa')   // Promise<FontFace[]>\n" +
        "document.fonts.ready                        // Promise<FontFaceSet>\n" +
        "document.fonts.onloading / .onloadingdone / .onloadingerror\n" +
        "document.fonts.add(ff) / .delete(ff) / .clear()" });
      this._addLog('warn', 'document.fonts (FontFaceSet) 不可用，已记录用法');
      return;
    }
    try {
      const ffset = document.fonts;
      const readyType = ffset && typeof ffset.ready !== 'undefined' ? 'Promise' : 'undefined';
      const checkFn = ffset && typeof ffset.check === 'function';
      const loadFn = ffset && typeof ffset.load === 'function';
      const addFn = ffset && typeof ffset.add === 'function';
      const deleteFn = ffset && typeof ffset.delete === 'function';
      const clearFn = ffset && typeof ffset.clear === 'function';
      const forEachFn = ffset && typeof ffset.forEach === 'function';
      this.setState({ fontLoadingInfo:
        'CSS Font Loading API 能力检测：\n' +
        `  document.fonts = ${Object.prototype.toString.call(ffset)}\n` +
        `  .ready = ${readyType}\n` +
        `  .check(font, text) = ${checkFn ? '✓' : '✗'}  .load(font, text) = ${loadFn ? '✓' : '✗'}\n` +
        `  .add(ff) = ${addFn ? '✓' : '✗'}  .delete(ff) = ${deleteFn ? '✓' : '✗'}  .clear() = ${clearFn ? '✓' : '✗'}\n` +
        `  .forEach(cb) = ${forEachFn ? '✓' : '✗'}\n\n` +
        'FontFaceSet 状态机：unloaded → loading → loaded | error\n' +
        '  事件：.onloading / .onloadingdone / .onloadingerror\n\n' +
        '点击「创建并加载 FontFace」执行 new FontFace + add + load 演示。' });
      this._addLog('loading', `FontFaceSet 检测：ready=${readyType}, check=${checkFn}, load=${loadFn}, add=${addFn}`);
    } catch (err) {
      this._addLog('warn', `FontFaceSet 检测失败：${err && err.name} - ${err && err.message}`);
    }
  }

  async _createAndLoadFontFace() {
    const caps = this._caps();
    if (!caps.fontFace || !caps.documentFonts) { this._addLog('warn', 'FontFace 或 document.fonts 不可用，无法创建'); return; }
    try {
      const dataUrl = 'url("data:font/woff2;base64,")';
      const ff = new FontFace('DemoLocalFont', dataUrl, { style: 'normal', weight: '400', stretch: 'normal', display: 'swap' });
      const statusBefore = ff.status;
      const onLoading = () => this._addLog('loading', 'FontFaceSet onloading：字体开始加载');
      const onLoadingDone = () => this._addLog('loading', 'FontFaceSet onloadingdone：字体加载完成');
      const onLoadingError = () => this._addLog('warn', 'FontFaceSet onloadingerror：字体加载失败');
      try {
        if (typeof document.fonts.addEventListener === 'function') {
          document.fonts.addEventListener('loading', onLoading);
          document.fonts.addEventListener('loadingdone', onLoadingDone);
          document.fonts.addEventListener('loadingerror', onLoadingError);
        } else {
          document.fonts.onloading = onLoading;
          document.fonts.onloadingdone = onLoadingDone;
          document.fonts.onloadingerror = onLoadingError;
        }
        this._fontFaceSetHandlers.push({ type: 'loading', handler: onLoading });
        this._fontFaceSetHandlers.push({ type: 'loadingdone', handler: onLoadingDone });
        this._fontFaceSetHandlers.push({ type: 'loadingerror', handler: onLoadingError });
      } catch { /* noop */ }
      document.fonts.add(ff);
      this._fontFaces.push(ff);
      const statusAfterAdd = ff.status;
      let loadResult = '（未执行 load）';
      try { await ff.load(); loadResult = `ff.load() resolve ✓，status="${ff.status}"`; }
      catch (err) { loadResult = `ff.load() reject：${err && err.name} - ${err && err.message}（数据 URL 无效属预期）`; }
      this.setState({ fontLoadingInfo:
        'FontFace 创建并加载演示：\n' +
        `  new FontFace('DemoLocalFont', 'url("data:font/woff2;base64,")', { display: 'swap' })\n` +
        `  ff.status（add 前）= "${statusBefore}"\n` +
        `  document.fonts.add(ff) ✓，ff.status（add 后）= "${statusAfterAdd}"\n` +
        `  ${loadResult}\n\n` +
        'FontFace 属性：.family / .weight / .style / .stretch / .unicodeRange / .display / .featureSettings / .variationSettings / .status / .load()\n' +
        'FontFaceSet 状态：unloaded → loading → loaded | error，事件 onloading / onloadingdone / onloadingerror（已绑定）。' });
      this._addLog('loading', `FontFace add + load 完成，status="${ff.status}"`);
    } catch (err) {
      this._addLog('warn', `创建 FontFace 失败：${err && err.name} - ${err && err.message}`);
    }
  }

  async _checkLoadReady() {
    const caps = this._caps();
    if (!caps.documentFonts) { this._addLog('warn', 'document.fonts 不可用'); return; }
    try {
      const ffset = document.fonts;
      let checkResult = '（无 check）';
      if (typeof ffset.check === 'function') {
        try { checkResult = `check('16px Arial', 'Aa') = ${ffset.check('16px Arial', 'Aa')}`; }
        catch (e) { checkResult = `check 抛错：${e && e.message}`; }
      }
      let loadResult = '（无 load）';
      if (typeof ffset.load === 'function') {
        try {
          const faces = await ffset.load('16px Arial', 'Aa');
          loadResult = `load('16px Arial', 'Aa') resolve ✓，返回 ${Array.isArray(faces) ? faces.length : 0} 个 FontFace`;
        } catch (e) { loadResult = `load reject：${e && e.message}`; }
      }
      let readyResult = '（无 ready）';
      if (ffset.ready && typeof ffset.ready.then === 'function') {
        const settled = await ffset.ready.then(() => 'resolved').catch((e) => `rejected: ${e && e.message}`);
        readyResult = `document.fonts.ready = ${settled}`;
      }
      this.setState({ fontLoadingInfo:
        'FontFaceSet 方法演示：\n' +
        `  ${checkResult}\n  ${loadResult}\n  ${readyResult}\n\n` +
        '说明：.check(font, text) 同步返回 boolean；.load(font, text) 返回 Promise<FontFace[]> 触发加载；\n' +
        '  .ready 是 Promise<FontFaceSet>，所有字体加载完成后 resolve。' });
      this._addLog('loading', `FontFaceSet check/load/ready 演示完成`);
    } catch (err) {
      this._addLog('warn', `FontFaceSet 方法演示失败：${err && err.name} - ${err && err.message}`);
    }
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. CSS Font Loading API 字体加载',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.documentFonts ? 'success' : 'error' }, caps.documentFonts ? 'document.fonts ✓' : 'document.fonts ✗'),
        h(Tag, { color: caps.fontFace ? 'success' : 'error' }, caps.fontFace ? 'FontFace ✓' : 'FontFace ✗'),
        h(Tag, { color: 'primary' }, 'FontFaceSet'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'document.fonts 返回 FontFaceSet：.check(font, text) 同步 boolean、.load(font, text) Promise<FontFace[]>、.ready Promise<FontFaceSet>、.onloading/.onloadingdone/.onloadingerror 状态事件。状态机：unloaded → loading → loaded | error。new FontFace(family, source, descriptors) 创建字体对象（source 为 CSS font source 字符串或 ArrayBuffer），fontFace.load() 返回 Promise<FontFace>；属性 .status/.family/.weight/.style/.stretch/.unicodeRange/.display/.featureSettings/.variationSettings。document.fonts.add(ff)/.delete(ff)/.clear()。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测 FontFaceSet', { type: 'primary', size: 'sm', onClick: () => this._checkFontFaceSet() }),
          this._btn('创建并加载 FontFace', { size: 'sm', disabled: !caps.fontFace || !caps.documentFonts, onClick: () => this._createAndLoadFontFace() }),
          this._btn('check / load / ready', { size: 'sm', disabled: !caps.documentFonts, onClick: () => this._checkLoadReady() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '字体加载状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.fontLoadingInfo || '（点击「检测 FontFaceSet」或对应演示按钮）')),
        h(Alert, {
          type: 'info',
          message: 'FontFace 是 CSS Font Loading API 的核心',
          description: '通过 new FontFace + document.fonts.add 可在 JS 中动态注册字体（无需 @font-face CSS），await fontFace.load() 显式加载并感知状态。FontFaceSet.ready 是判断"页面所有字体加载完成"的标准方式。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：@font-face 与 font-display 策略 ===================

  _showFontFaceSpec() {
    this.setState({ fontFaceInfo:
      '===== @font-face 完整属性清单 =====\n\n' +
      "@font-face {\n" +
      "  font-family: 'MyFont';          /* 必需：字体家族名 */\n" +
      "  src: url('myfont.woff2') format('woff2'), local('MyFont');  /* 必需：来源 */\n" +
      "  font-weight: 100 900;           /* 字重范围（可变字体） */\n" +
      "  font-style: normal | italic | oblique;\n" +
      "  font-stretch: 50% 200%;         /* 字宽范围 */\n" +
      "  unicode-range: U+0000-00FF, U+0131, U+0152-0153;  /* 子集化 */\n" +
      "  font-display: swap;             /* 加载策略 */\n" +
      "  font-variant / font-feature-settings / size-adjust / ascent|descent|line-gap-override\n" +
      "}\n\n" +
      '===== font-display 取值 =====\n' +
      '  auto      浏览器决定（通常等同 block）\n' +
      '  block     最多 3s 阻塞渲染（FOIT），超时后用 fallback，加载完切换\n' +
      '  swap      立即用 fallback 渲染，加载完成后切换（FOUT，无阻塞期）\n' +
      '  fallback  100ms 阻塞 + 3s 切换窗口，超时后不再切换\n' +
      '  optional  100ms 阻塞，无切换窗口（慢网络不切换，避免布局抖动）\n\n' +
      '===== unicode-range 子集化 =====\n' +
      '  仅当页面用到对应 Unicode 字符时才加载该 @font-face 子集\n' +
      "  例：U+0000-00FF（拉丁基础）, U+4E00-9FFF（中日韩），显著减少首屏下载量。\n\n" +
      '===== FOUT vs FOIT =====\n' +
      '  FOUT (Flash of Unstyled Text)：先用 fallback 渲染，加载后切换（font-display: swap）\n' +
      '  FOIT (Flash of Invisible Text)：加载前隐藏文字（font-display: block，最多 3s）\n' +
      '  推荐：正文用 optional / fallback，标题用 swap。' });
    this._addLog('face', '已展示 @font-face 属性与 font-display 取值');
  }

  _injectFontFaceStyle() {
    try {
      const style = document.createElement('style');
      style.textContent =
        "@font-face {\n" +
        "  font-family: 'DemoSwapFont';\n" +
        "  src: url('data:font/woff2;base64,') format('woff2');\n" +
        "  font-display: swap;     /* 立即用 fallback，加载后切换 */\n" +
        "  unicode-range: U+0000-00FF;  /* 仅拉丁基础字符子集 */\n" +
        "}\n" +
        ".lfdp-swap-target { font-family: 'DemoSwapFont', 'Arial', sans-serif; }";
      document.head.appendChild(style);
      this._injectedStyleEls.push(style);
      this.setState({ fontFaceInfo:
        '已注入 <style> 含 @font-face + font-display: swap：\n\n' +
        "@font-face {\n" +
        "  font-family: 'DemoSwapFont';\n" +
        "  src: url('data:font/woff2;base64,') format('woff2');\n" +
        "  font-display: swap;     /* 立即用 fallback，加载后切换 */\n" +
        "  unicode-range: U+0000-00FF;  /* 仅拉丁基础字符子集 */\n" +
        "}\n" +
        ".lfdp-swap-target { font-family: 'DemoSwapFont', 'Arial', sans-serif; }\n\n" +
        '渲染行为：1. 立即用 Arial（fallback）渲染（FOUT）；2. DemoSwapFont 加载完成后切换；\n' +
        '  3. 因 data URL 无效实际不会切换（仅演示机制）。\n' +
        '说明：font-display: swap 适合标题 / icon 字体；正文建议 optional / fallback 减少 CLS。' });
      this._addLog('face', '已注入 @font-face + font-display: swap 演示样式');
    } catch (err) {
      this._addLog('warn', `注入 @font-face 样式失败：${err && err.name} - ${err && err.message}`);
    }
  }

  _renderCard3() {
    const s = this.state;
    const card = new Card({
      title: '3. @font-face 与 font-display 策略',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'success' }, '@font-face'),
        h(Tag, { color: 'primary' }, 'swap / optional'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'CSS @font-face 注册自定义字体：font-family（必需名）、src（url() 或 local()）、font-weight/font-style/font-stretch（可设范围支持可变字体）、unicode-range（子集化，按字符按需加载）、font-display（加载策略）、font-variant、font-feature-settings、size-adjust、ascent-override/descent-override/line-gap-override（覆盖 metrics 匹配 fallback，减少 CLS）。font-display：auto/block（3s 阻塞）/swap（立即 fallback）/fallback（100ms 阻塞+3s 切换窗）/optional（100ms 阻塞无切换，避免布局抖动）。FOUT vs FOIT 由 font-display 决定。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('查看 @font-face 规范', { type: 'primary', size: 'sm', onClick: () => this._showFontFaceSpec() }),
          this._btn('注入 font-display:swap', { size: 'sm', onClick: () => this._injectFontFaceStyle() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '@font-face / font-display 说明：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, s.fontFaceInfo || '（点击「查看 @font-face 规范」或「注入 font-display:swap」）')),
        h(Alert, {
          type: 'info',
          message: 'font-display 是控制 FOUT/FOIT 的关键',
          description: 'swap 立即用 fallback 避免空白（FOUT，适合标题）；optional 慢网络不切换避免 CLS（适合正文）；block 隐藏文字最多 3s（FOIT）。unicode-range 子集化可显著减少首屏字体下载量。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：可变字体 Variable Fonts ===================

  _checkVariableFont() {
    const caps = this._caps();
    if (!caps.cssSupports) {
      this.setState({ variableFontInfo:
        '可变字体检测（CSS.supports 不可用，仅说明）：\n\n' +
        "CSS.supports('font-variation-settings', \"'wght' 400\") → boolean\n" +
        "CSS.supports('font-optical-sizing', 'auto') → boolean\n\n" +
        '可变字体通过单个文件提供连续字重/字宽变化，需 @font-face 引用支持可变轴的字体文件。' });
      this._addLog('warn', 'CSS.supports 不可用，无法检测可变字体');
      return;
    }
    let supVar = false; let supOpt = false;
    try { supVar = CSS.supports('font-variation-settings', "'wght' 400"); } catch { /* noop */ }
    try { supOpt = CSS.supports('font-optical-sizing', 'auto'); } catch { /* noop */ }
    this.setState({ variableFontInfo:
      '可变字体能力检测：\n' +
      `  CSS.supports('font-variation-settings', "'wght' 400") = ${supVar}\n` +
      `  CSS.supports('font-optical-sizing', 'auto')           = ${supOpt}\n\n` +
      '===== 注册轴（registered axes）=====\n' +
      "  wght  weight       font-variation-settings: 'wght' 400; / font-weight: 400;\n" +
      "  wdth  width        font-variation-settings: 'wdth' 100; / font-stretch: 100%;\n" +
      "  ital  italic       font-variation-settings: 'ital' 1;  / font-style: italic;\n" +
      "  slnt  slant        font-variation-settings: 'slnt' -10;\n" +
      "  opsz  optical size font-variation-settings: 'opsz' 14; / font-optical-sizing: auto;\n\n" +
      '===== 自定义轴（custom axes，4 字母大写标签）=====\n' +
      "  GRAD  grade        font-variation-settings: 'GRAD' -200;  /* 灰度 */\n" +
      "  XPRN  expressive   font-variation-settings: 'XPRN' 100;   /* 表现力 */\n\n" +
      '语法：font-variation-settings: "wght" 400, "wdth" 100, "GRAD" -200;（多轴逗号分隔）\n' +
      '  标签 4 字母小写=注册轴，大写=自定义轴；font-optical-sizing: auto | none。' });
    this._addLog('variable', `可变字体检测：variation-settings=${supVar}, optical-sizing=${supOpt}`);
  }

  _demoVariationSlider() {
    const caps = this._caps();
    if (!caps.cssSupports) { this._addLog('warn', 'CSS.supports 不可用，跳过滑块演示'); return; }
    let supVar = false;
    try { supVar = CSS.supports('font-variation-settings', "'wght' 400"); } catch { /* noop */ }
    try {
      const style = document.createElement('style');
      const wght = 400 + Math.floor(Math.random() * 500);
      style.textContent =
        ".lfdp-variable-target {\n" +
        `  font-variation-settings: 'wght' ${wght}, 'wdth' 100;\n` +
        "  font-size: 24px; padding: 8px 12px; border: 1px solid var(--color-border);\n" +
        "  border-radius: var(--radius-base); margin-top: 6px;\n" +
        "}";
      document.head.appendChild(style);
      this._injectedStyleEls.push(style);
      this.setState({ variableFontInfo:
        `滑块演示：font-variation-settings: 'wght' ${wght}, 'wdth' 100\n\n` +
        `  CSS.supports('font-variation-settings') = ${supVar}\n` +
        `  当前 wght = ${wght}（400 ~ 899 随机，真实滑块应绑定 input 事件）\n\n` +
        '说明：\n' +
        '  - 真实滑块：<input type="range" min="100" max="900" oninput="el.style.fontVariationSettings=`\'wght\' ${value}`">\n' +
        '  - 需 @font-face 引用支持 wght 轴的可变字体文件，否则无视觉效果\n' +
        '  - jsdom 不渲染，仅注入规则；真实浏览器中字体粗细会随 wght 变化\n' +
        '  - font-weight: 400 等价于 font-variation-settings: "wght" 400（注册轴映射）' });
      this._addLog('variable', `滑块演示：wght=${wght}（variation-settings 支持=${supVar}）`);
    } catch (err) {
      this._addLog('warn', `滑块演示失败：${err && err.name} - ${err && err.message}`);
    }
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const supVar = caps.cssSupports ? (function () {
      try { return CSS.supports('font-variation-settings', "'wght' 400"); } catch { return false; }
    })() : false;
    const card = new Card({
      title: '4. 可变字体 Variable Fonts',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: supVar ? 'success' : 'error' }, supVar ? 'variation-settings ✓' : 'variation-settings ✗'),
        h(Tag, { color: 'primary' }, 'wght / wdth / ital'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '可变字体通过单个文件提供连续字重/字宽变化。注册轴：wght（weight，映射 font-weight）、wdth（width，映射 font-stretch）、ital（italic）、slnt（slant）、opsz（optical size，由 font-optical-sizing: auto 控制）。自定义轴用 4 字母大写标签如 GRAD（grade）、XPRN（expressive）。CSS：font-variation-settings: "wght" 400, "wdth" 100; 多轴逗号分隔。检测：CSS.supports("font-variation-settings", "\'wght\' 400")。@font-face 的 src 须引用支持可变轴的字体文件。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测可变字体支持', { type: 'primary', size: 'sm', onClick: () => this._checkVariableFont() }),
          this._btn('滑块调整 wght', { size: 'sm', disabled: !caps.cssSupports, onClick: () => this._demoVariationSlider() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '可变字体说明：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, s.variableFontInfo || '（点击「检测可变字体支持」或「滑块调整 wght」）')),
        h(Alert, {
          type: 'info',
          message: '可变字体单文件覆盖连续变化范围',
          description: '一个文件覆盖 100~900 字重、50%~200% 字宽等，相比传统每字重一个文件大幅减少下载。注册轴（小写）有 CSS 属性映射（font-weight/font-stretch/font-style）；自定义轴（大写）只能用 font-variation-settings 控制。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：font-feature-settings 与 OpenType 特性 ===================

  _showFeatureSpec() {
    this.setState({ featureSettingsInfo:
      "===== font-feature-settings 常用 OpenType 特性 =====\n\n" +
      "  'liga' 1   连字（ligatures，如 fi / fl 合并）\n" +
      "  'kern' 1   字距调整（kerning）\n" +
      "  'calt' 1   上下文替代字形（contextual alternates）\n" +
      "  'smcp' 1   小型大写（small caps）\n" +
      "  'c2sc' 1   大写转小型大写（caps to small caps）\n" +
      "  'onum' 1   旧式数字（old-style figures，降升数字）\n" +
      "  'lnum' 1   齐线数字（lining figures）\n" +
      "  'tnum' 1   表格数字（tabular numbers，等宽对齐）\n" +
      "  'frac' 1   分数（fractions，如 1/2 → ½）\n" +
      "  'zero' 1   带斜杠零（slashed zero，区分 O / 0）\n" +
      "  'swsh' 1   花体（swash）\n" +
      "  'ss01'~'ss20' 1  风格集（stylistic sets，字体自定义）\n\n" +
      "语法：font-feature-settings: \"liga\" 1, \"tnum\" 1, \"ss01\" 1;（0=关闭，1=开启，可多个）\n\n" +
      '===== font-variant-* 简写属性（推荐）=====\n' +
      '  font-variant-ligatures: common-ligatures | no-common-ligatures | ...\n' +
      '  font-variant-caps: small-caps | all-small-caps | titling-caps | ...\n' +
      '  font-variant-numeric: lining-nums | oldstyle-nums | tabular-nums |\n' +
      '                       proportional-nums | diagonal-fractions | ...\n' +
      '  font-variant-east-asian: jis78 | jis83 | simplified | traditional | ...\n' +
      '  font-variant-alternates: historical-forms | styleset() | ...\n' +
      '  font-variant-position: normal | super | sub\n\n' +
      '===== font-kerning =====\n' +
      '  font-kerning: auto | normal | none（auto 由浏览器基于性能决定）\n\n' +
      '推荐：优先用 font-variant-* 简写（语义清晰），font-feature-settings 仅用于无简写对应的细粒度控制（如 ss01）。' });
    this._addLog('feature', '已展示 font-feature-settings 与 font-variant-* 清单');
  }

  _applyFeatures() {
    const caps = this._caps();
    if (!caps.cssSupports) { this._addLog('warn', 'CSS.supports 不可用，跳过特性应用演示'); return; }
    let supFeature = false; let supVariant = false;
    try { supFeature = CSS.supports('font-feature-settings', "'tnum' 1"); } catch { /* noop */ }
    try { supVariant = CSS.supports('font-variant-numeric', 'tabular-nums'); } catch { /* noop */ }
    try {
      const style = document.createElement('style');
      style.textContent =
        ".lfdp-feature-tnum { font-feature-settings: 'tnum' 1, 'zero' 1; font-variant-numeric: tabular-nums;\n" +
        "  padding: 4px 8px; background: var(--color-bg-spotlight); border-radius: var(--radius-sm); display: inline-block; margin: 2px 0; }\n" +
        ".lfdp-feature-liga { font-feature-settings: 'liga' 1, 'calt' 1, 'kern' 1; font-kerning: normal;\n" +
        "  padding: 4px 8px; background: var(--color-bg-spotlight); border-radius: var(--radius-sm); display: inline-block; margin: 2px 0; }";
      document.head.appendChild(style);
      this._injectedStyleEls.push(style);
      this.setState({ featureSettingsInfo:
        '已注入 font-feature-settings 演示样式：\n\n' +
        "  .lfdp-feature-tnum { font-feature-settings: 'tnum' 1, 'zero' 1; font-variant-numeric: tabular-nums; }\n" +
        "  .lfdp-feature-liga { font-feature-settings: 'liga' 1, 'calt' 1, 'kern' 1; font-kerning: normal; }\n\n" +
        `  CSS.supports('font-feature-settings', "'tnum' 1") = ${supFeature}\n` +
        `  CSS.supports('font-variant-numeric', 'tabular-nums') = ${supVariant}\n\n` +
        '应用效果：tnum + zero 表格数字等宽对齐 + 带斜杠零；liga + calt + kern 启用连字/上下文替代/字距。\n' +
        '说明：font-variant-numeric: tabular-nums 让数字等宽对齐，适合表格/计时器/价格列；\n' +
        '  font-feature-settings: "zero" 1 让 0 带斜杠。优先用 font-variant-* 简写。' });
      this._addLog('feature', `应用 font-feature-settings：tnum=${supFeature}, variant-numeric=${supVariant}`);
    } catch (err) {
      this._addLog('warn', `应用 font-feature-settings 失败：${err && err.name} - ${err && err.message}`);
    }
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const supFeature = caps.cssSupports ? (function () {
      try { return CSS.supports('font-feature-settings', "'tnum' 1"); } catch { return false; }
    })() : false;
    const card = new Card({
      title: '5. font-feature-settings 与 OpenType 特性',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: supFeature ? 'success' : 'error' }, supFeature ? 'feature-settings ✓' : 'feature-settings ✗'),
        h(Tag, { color: 'primary' }, 'liga / tnum / ss01'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'font-feature-settings 控制 OpenType 特性：liga（连字）、kern（字距）、calt（上下文替代）、smcp（小型大写）、c2sc、onum（旧式数字）、lnum（齐线数字）、tnum（表格数字等宽对齐）、frac（分数）、ss01~ss20（风格集）、zero（带斜杠零）、swsh（花体）。简写属性：font-variant-ligatures/caps/numeric/east-asian/alternates/position。font-kerning: auto | normal | none 控制字距。推荐用 font-variant-* 简写，font-feature-settings 仅用于无简写对应的细粒度控制。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('查看特性清单', { type: 'primary', size: 'sm', onClick: () => this._showFeatureSpec() }),
          this._btn('应用 tnum / liga 特性', { size: 'sm', disabled: !caps.cssSupports, onClick: () => this._applyFeatures() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'OpenType 特性说明：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, s.featureSettingsInfo || '（点击「查看特性清单」或「应用 tnum / liga 特性」）')),
        h(Alert, {
          type: 'info',
          message: 'font-variant-numeric: tabular-nums 让数字等宽对齐',
          description: '表格/计时器/价格列数字需等宽对齐（tabular-nums）避免跳动；lining-nums（齐线）vs oldstyle-nums（旧式降升）；diagonal-fractions 把 1/2 渲染为分数。特性是否生效取决于字体是否实现对应 OpenType 特性。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：FontFaceSet 与性能优化 ===================

  async _measureFontsReady() {
    const caps = this._caps();
    if (!caps.documentFonts) {
      this.setState({ perfInfo:
        'FontFaceSet 性能演示（当前环境不可用，仅说明）：\n\n' +
        "const t0 = performance.now();\n" +
        "await document.fonts.ready;  // 等待所有字体加载完成\n" +
        "const t1 = performance.now();\n" +
        "console.log('字体加载耗时', t1 - t0, 'ms');\n\n" +
        'document.fonts.ready 是 Promise<FontFaceSet>，resolve 时所有字体就绪。' });
      this._addLog('warn', 'document.fonts 不可用，无法测量 ready');
      return;
    }
    try {
      const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      let readyResult = '（无 ready）';
      if (document.fonts.ready && typeof document.fonts.ready.then === 'function') {
        await document.fonts.ready;
        const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        readyResult = `document.fonts.ready resolve ✓，耗时 ${(t1 - t0).toFixed(2)} ms`;
      }
      let count = 0;
      if (typeof document.fonts.forEach === 'function') document.fonts.forEach(() => { count += 1; });
      this.setState({ perfInfo:
        'FontFaceSet.ready 性能测量：\n' +
        `  ${readyResult}\n` +
        `  document.fonts.forEach 遍历 → 共 ${count} 个 FontFace\n\n` +
        '说明：.ready 是判断"所有字体加载完成"的标准 Promise；.forEach(cb) 遍历已注册 FontFace；\n' +
        '  可在 ready 后隐藏 loading 占位 / 触发关键渲染路径优化。' });
      this._addLog('perf', `fonts.ready 测量完成，FontFace 数=${count}`);
    } catch (err) {
      this._addLog('warn', `fonts.ready 测量失败：${err && err.name} - ${err && err.message}`);
    }
  }

  _showPerfPatterns() {
    this.setState({ perfInfo:
      '===== 字体性能优化模式清单 =====\n\n' +
      '1) preload 关键字体（提前下载，减少首屏等待）\n' +
      '   <link rel="preload" as="font" type="font/woff2" crossorigin href="./font.woff2">\n' +
      '   注：crossorigin 必需（字体强制 CORS）；as="font" 才能被 @font-face 复用\n\n' +
      '2) self-host vs Google Fonts\n' +
      '   self-host：可控缓存策略、无第三方依赖、可子集化\n' +
      '   Google Fonts：CDN 缓存共享、自动格式协商，但多一次 DNS / 连接\n\n' +
      '3) font-display: optional（非关键字体，避免布局抖动）\n' +
      '   100ms 阻塞后不再切换，慢网络用 fallback 不切换，CLS=0\n\n' +
      '4) unicode-range 子集化（按字符按需加载）\n' +
      '   @font-face { unicode-range: U+0000-00FF; } 仅加载用到的子集\n\n' +
      '5) size-adjust / ascent-override / descent-override / line-gap-override\n' +
      "   @font-face {\n" +
      "     font-family: 'FallbackOverride'; src: local('Arial');\n" +
      "     ascent-override: 90%;   descent-override: 20%;   line-gap-override: 0%;\n" +
      "     size-adjust: 100%;      /* 整体缩放匹配字形尺寸 */\n" +
      "   }\n" +
      '   作用：让 fallback 字体 metrics 与真实字体一致，减少字体加载后的布局位移（CLS）。\n\n' +
      '6) FontFaceSetLoadEvent\n' +
      '   document.fonts.addEventListener("loadingdone", (e: FontFaceSetLoadEvent) => {\n' +
      '     e.fontfaces  // 本次加载完成的 FontFace 数组\n' +
      '   });\n\n' +
      '===== 减少 CLS 的核心：fallback metrics 匹配 =====\n' +
      '  通过 ascent/descent/line-gap/size-adjust 覆盖 fallback 字体 metrics，\n' +
      '  使 fallback 与真实字体在行高/字符宽度上接近，字体切换时几乎无位移，CLS 接近 0。' });
    this._addLog('perf', '已展示字体性能优化模式清单（preload / optional / 子集 / metrics 覆盖）');
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. FontFaceSet 与性能优化',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.documentFonts ? 'success' : 'error' }, caps.documentFonts ? 'fonts.ready ✓' : 'fonts.ready ✗'),
        h(Tag, { color: 'primary' }, 'preload / CLS'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'document.fonts.ready 是 Promise<FontFaceSet>，resolve 时所有字体加载完成，常用于测量耗时、隐藏 loading 占位。document.fonts.forEach(cb) 遍历已注册 FontFace。性能模式：preload 关键字体（<link rel="preload" as="font" type="font/woff2" crossorigin>）、self-host vs Google Fonts、font-display: optional 非关键字体避免布局抖动、unicode-range 子集化、size-adjust/ascent-override/descent-override/line-gap-override 覆盖 fallback 字体 metrics 减少 CLS。FontFaceSetLoadEvent.fontfaces 返回本次加载完成的 FontFace 数组。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('测量 fonts.ready 耗时', { type: 'primary', size: 'sm', disabled: !caps.documentFonts, onClick: () => this._measureFontsReady() }),
          this._btn('查看性能优化模式', { size: 'sm', onClick: () => this._showPerfPatterns() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'FontFaceSet 性能 / 优化模式：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, s.perfInfo || '（点击「测量 fonts.ready 耗时」或「查看性能优化模式」）')),
        h(Alert, {
          type: 'warning',
          message: 'fallback metrics 覆盖是减少 CLS 的关键',
          description: '通过 @font-face 的 ascent-override/descent-override/line-gap-override/size-adjust 让 fallback 字体的行高/字宽与真实字体接近，字体切换时几乎无位移，CLS 接近 0。preload 必须加 crossorigin（字体强制 CORS）；font-display: optional 适合非关键字体。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 9：Incremental Font Transfer 字体分片传输 ===================

  _runIftDemo() {
    const caps = this._caps();
    const lines = [];
    lines.push('===== Incremental Font Transfer (IFT/IFTX) =====');
    lines.push('');
    lines.push('【标准】W3C WebFonts Working Group 2024-2025');
    lines.push('  - 字体按需分片传输，大幅减少首屏字体体积');
    lines.push('  - 两种方案：Patch Subset（补丁子集）与 Range Request（范围请求）');
    lines.push('');
    lines.push('【两种传输模式】');
    lines.push('  Patch Subset：服务器返回字体补丁，客户端合并增量');
    lines.push('  Range Request：客户端按 unicode-range 请求字节范围');
    lines.push('  IFTX：扩展协议，支持更细粒度的分片');
    lines.push('');
    lines.push('【与 @font-face 协同】');
    lines.push('  @font-face {');
    lines.push('    font-family: "MyFont";');
    lines.push('    src: url("myfont.ift") format("incremental-woff2");');
    lines.push('    font-display: swap;  /* 加载期间用 fallback，加载完切换 */');
    lines.push('  }');
    lines.push('  // 浏览器自动按需请求字体的子集分片，而非整包下载');
    lines.push('');
    lines.push('【实战：首屏字体优化】');
    lines.push('  // 传统：下载完整字体（可能 200KB+），首屏文字闪现/布局抖动');
    lines.push('  // IFT：仅下载首屏所需字符分片（可能 10-20KB），首屏更快');
    lines.push('  @font-face {');
    lines.push('    font-family: "Display";');
    lines.push('    src: url("/fonts/display.ift2") format("incremental-woff2");');
    lines.push('    font-display: swap;');
    lines.push('    unicode-range: U+0000-007F;  /* 仅首屏拉丁字符 */');
    lines.push('  }');
    lines.push('  // 用户滚动到中文内容时，浏览器再请求中文字符分片');
    lines.push('');
    lines.push('【降级策略】');
    lines.push('  - 不支持 IFT：浏览器回退到完整字体下载（src 用普通 woff2）');
    lines.push('  - 用 font-display: swap 避免 FOIT（字体加载前用 fallback）');
    lines.push('  - unicode-range 子集化 + preload 关键字体（传统优化）');
    lines.push('  - 检测：typeof window.IncrementalFontLoader !== "undefined"');
    lines.push('');
    lines.push('【当前环境能力检测】');
    lines.push('  IncrementalFontLoader: ' + (caps.ift ? '✓' : '✗'));
    lines.push('  font-display: swap 支持: ' + (caps.fontDisplaySwap ? '✓' : '✗'));
    lines.push('');
    lines.push('【浏览器支持】');
    lines.push('  Chrome        开发中（behind flag）');
    lines.push('  Firefox       未实现');
    lines.push('  Safari        未实现');
    lines.push('  jsdom         ✗（无字体加载概念）');

    this.setState({ iftInfo: lines.join('\n') });

    if (!caps.ift) {
      this._addLog('warn', 'IncrementalFontLoader 不可用（W3C WebFonts WG 2024-2025，Chrome 开发中），仅展示文档与代码');
    } else {
      this._addLog('info', 'IncrementalFontLoader 可用，可体验字体分片传输');
    }
  }

  _renderCard9() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '9. Incremental Font Transfer —— 字体分片传输',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.ift ? 'success' : 'error' }, caps.ift ? 'IFT ✓' : 'IFT ✗'),
        h(Tag, { color: caps.fontDisplaySwap ? 'success' : 'error' }, caps.fontDisplaySwap ? 'font-display:swap ✓' : 'swap ✗'),
        h(Tag, { color: 'primary' }, 'W3C WebFonts WG 2024-2025'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Incremental Font Transfer（IFT/IFTX，W3C WebFonts WG 2024-2025）让字体按需分片传输，大幅减少首屏字体体积。两种模式：Patch Subset（补丁子集合并）与 Range Request（按 unicode-range 字节范围请求）。与 @font-face 协同：src 用 incremental-woff2 格式，浏览器自动按需请求字符分片。Chrome 开发中，Firefox/Safari 未实现。降级：回退完整字体下载 + font-display: swap + unicode-range 子集化。jsdom 无，演示仅展示文档。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('展示 IFT 文档与代码', { type: 'primary', size: 'sm', onClick: () => this._runIftDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'IFT 文档与示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '520px', overflow: 'auto' } },
          h('code', {}, s.iftInfo || '（点击按钮查看 IFT 完整文档与首屏字体优化示例）')),
        h(Alert, {
          type: 'info',
          message: 'IFT 让字体按需分片传输，首屏仅下载所需字符',
          description: '传统字体整包下载可能 200KB+，IFT 首屏仅请求所需字符分片（10-20KB）。Patch Subset 与 Range Request 两种模式。Chrome 开发中。jsdom 无，演示仅展示文档。降级用 font-display:swap + unicode-range 子集 + preload。',
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
    return h('div', { class: 'api-lab-page local-fonts-deep-page' },
      h('h2', { class: 'section-title' }, '本地字体与 CSS 字体加载 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '演示 Local Font Access API（queryLocalFonts）、CSS Font Loading API（document.fonts / FontFace）、@font-face + font-display 策略、可变字体、OpenType 特性、FontFaceSet 性能优化。'),
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
