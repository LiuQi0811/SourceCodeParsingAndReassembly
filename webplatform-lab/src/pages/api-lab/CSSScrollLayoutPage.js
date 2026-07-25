// =====================================================================
// CSSScrollLayoutPage.js —— CSS 滚动与布局 实验室
// 演示 MDN CSS 滚动与布局特性（不与 CSSAdvancedFeaturesPage /
//   ModernCSSPage 重复）：
//   1. CSS Scroll Snap —— scroll-snap-type: x|y|both [mandatory|proximity] /
//      scroll-snap-align: start|center|end|none / scroll-snap-stop: normal|always /
//      scroll-padding / scroll-margin
//   2. scrollIntoView 与滚动行为 —— element.scrollIntoView({ behavior, block,
//      inline }) / scrollIntoViewIfNeeded() / window.scrollTo / scrollBy /
//      element.scroll / scroll-behavior: smooth|instant|auto /
//      overscroll-behavior: contain|none|auto（防滚动链）
//   3. content-visibility 与 contain-intrinsic-size —— content-visibility:
//      visible|hidden|auto（auto 跳过屏外渲染）/ contain-intrinsic-size: auto W H /
//      contain: layout|paint|style|size|strict|content / hidden vs display:none
//   4. 自定义滚动条 scrollbar-* —— scrollbar-width: auto|thin|none /
//      scrollbar-color: <thumb> <track> / ::-webkit-scrollbar{,-track,-thumb,
//      -button,-corner} / scrollbar-gutter: auto|stable|both-edges
//   5. overflow 与 clip 新特性 —— overflow: visible|hidden|scroll|auto|clip /
//      overflow-clip-margin: <length> / overflow-x / overflow-y /
//      text-overflow: clip|ellipsis|<string> / overflow-wrap: break-word|anywhere|normal
//   6. 滚动容器查询与布局性能 —— container-type: normal|inline-size|size|scroll-state /
//      container-name / @container (min-width) / @container style(--x) 样式查询 /
//      content-visibility + container queries 组合 / will-change / contain / overscroll-behavior
// 说明：所有特性调用前做 typeof / CSS.supports 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。jsdom 不做真实 CSS 渲染，但
//       CSS.supports 通常可用；scroll-snap / content-visibility / scrollbar-gutter /
//       overflow:clip / container 等较新属性 jsdom 可能不识别，统一 try/catch 兜底。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class CSSScrollLayoutPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      // Card 1：CSS Scroll Snap 滚动捕捉
      scrollSnapInfo: '',
      // Card 2：scrollIntoView 与滚动行为
      scrollBehaviorInfo: '',
      // Card 3：content-visibility 与 contain-intrinsic-size
      contentVisibilityInfo: '',
      // Card 4：自定义滚动条 scrollbar-* 属性
      scrollbarInfo: '',
      // Card 5：overflow 与 clip 新特性
      overflowClipInfo: '',
      // Card 6：滚动容器查询与布局性能
      containerQueryInfo: '',
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._dynamicStyles = [];   // 动态创建并插入 head 的 <style> 元素列表
    this._dynamicNodes = [];    // 动态创建并 appendChild 到 body 的元素列表
    this._observers = [];       // ResizeObserver / IntersectionObserver 等
    this._snapStrictness = 'mandatory'; // Card 1 当前 scroll-snap-type 严格度

    // 一次性能力检测：CSS 滚动与布局全家桶
    const f = this._flags();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `CSS ${c(f.css)}`, `supports ${c(f.supports)}`,
      `scroll-snap-type ${c(f.scrollSnap)}`, `scroll-behavior ${c(f.scrollBehavior)}`,
      `scrollIntoView ${c(f.scrollIntoView)}`, `overscroll-behavior ${c(f.overscrollBehavior)}`,
      `content-visibility ${c(f.contentVisibility)}`, `contain-intrinsic-size ${c(f.containIntrinsicSize)}`,
      `contain ${c(f.contain)}`, `scrollbar-width ${c(f.scrollbarWidth)}`,
      `scrollbar-color ${c(f.scrollbarColor)}`, `scrollbar-gutter ${c(f.scrollbarGutter)}`,
      `overflow:clip ${c(f.overflowClip)}`, `overflow-clip-margin ${c(f.overflowClipMargin)}`,
      `container-type ${c(f.containerType)}`, `@container style ${c(f.containerStyle)}`,
    ];

    const summary = f.css
      ? `CSS 滚动与布局特性能力检测：${parts.join(' · ')}。jsdom 不做真实 CSS 渲染，但 CSS.supports 通常可用；scroll-snap / content-visibility / scrollbar-gutter / overflow:clip / container 等较新特性 jsdom 可能不识别，按钮将仅记日志说明。在真实浏览器中打开可完整演示。`
      : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。';

    this.setState({ capsSummary: summary });
    this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.scrollSnap) this._addLog('warn', 'scroll-snap-type 不可用或 jsdom 未识别（Chrome 69+ / Firefox 68+ / Safari 11+）');
    if (!f.contentVisibility) this._addLog('warn', 'content-visibility:auto 不可用或 jsdom 未识别（Chrome 85+）');
    if (!f.scrollbarGutter) this._addLog('warn', 'scrollbar-gutter:stable 不可用或 jsdom 未识别（Chrome 94+ / Firefox 97+）');
    if (!f.overflowClip) this._addLog('warn', 'overflow:clip 不可用或 jsdom 未识别（Chrome 90+ / Firefox 81+）');
    if (!f.containerType) this._addLog('warn', 'container-type:inline-size 不可用或 jsdom 未识别（Chrome 105+ / Firefox 110+ / Safari 16+）');

    // 一次性注入全部演示样式（仅一次；rerender 不会移除 head 中的 style）
    this._injectDemoStyles();
  }

  componentWillUnmount() {
    // 移除动态创建的 <style> 元素与 appendChild 到 body 的元素，便于 GC
    for (const style of this._dynamicStyles) {
      try { style.parentNode && style.parentNode.removeChild(style); } catch { /* noop */ }
    }
    for (const node of this._dynamicNodes) {
      try { node.parentNode && node.parentNode.removeChild(node); } catch { /* noop */ }
    }
    this._dynamicStyles = [];
    this._dynamicNodes = [];
    // 断开所有 observer（各自 try/catch）
    for (const obs of this._observers) {
      try { obs.disconnect(); } catch { /* noop */ }
    }
    this._observers = [];
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

  // 返回布尔能力对象（供 capsSummary / 按钮 disabled 使用）
  _flags() {
    const hasCSS = typeof CSS !== 'undefined';
    const supportsPV = (p, v) => {
      try { return hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v); }
      catch { return false; }
    };
    const supportsCond = (cond) => {
      try { return hasCSS && typeof CSS.supports === 'function' && CSS.supports(cond); }
      catch { return false; }
    };
    const hasEl = typeof Element !== 'undefined' && typeof Element.prototype !== 'undefined';
    return {
      css: hasCSS,
      supports: hasCSS && typeof CSS.supports === 'function',
      scrollSnap: supportsPV('scroll-snap-type', 'x mandatory'),
      scrollSnapAlign: supportsPV('scroll-snap-align', 'start'),
      scrollSnapStop: supportsPV('scroll-snap-stop', 'always'),
      scrollPadding: supportsPV('scroll-padding', '10px'),
      scrollMargin: supportsPV('scroll-margin', '10px'),
      scrollBehavior: supportsPV('scroll-behavior', 'smooth'),
      scrollIntoView: hasEl && typeof Element.prototype.scrollIntoView === 'function',
      scrollIntoViewIfNeeded: hasEl && typeof Element.prototype.scrollIntoViewIfNeeded === 'function',
      overscrollBehavior: supportsPV('overscroll-behavior', 'contain'),
      contentVisibility: supportsPV('content-visibility', 'auto'),
      containIntrinsicSize: supportsPV('contain-intrinsic-size', 'auto 50px'),
      contain: supportsPV('contain', 'layout'),
      scrollbarWidth: supportsPV('scrollbar-width', 'thin'),
      scrollbarColor: supportsPV('scrollbar-color', '#888 transparent'),
      scrollbarGutter: supportsPV('scrollbar-gutter', 'stable'),
      overflowClip: supportsPV('overflow', 'clip'),
      overflowClipMargin: supportsPV('overflow-clip-margin', '20px'),
      textOverflow: supportsPV('text-overflow', 'ellipsis'),
      overflowWrap: supportsPV('overflow-wrap', 'anywhere'),
      containerType: supportsPV('container-type', 'inline-size'),
      containerName: supportsPV('container-name', 'card'),
      containerStyle: supportsCond('@container style(--x: 1)'),
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

  // —— 动态注入所有演示样式（scroll-snap / scrollIntoView / content-visibility /
  //    scrollbar / overflow:clip / container query）——
  _injectDemoStyles() {
    this._injectStyle('css-scroll-layout-demo', `
      /* ===== Card 1: CSS Scroll Snap ===== */
      .css-snap-stage { display: flex; gap: 8px; overflow-x: auto; padding: 8px;
        border: 1px dashed var(--color-border, #ccc); scroll-snap-type: x mandatory;
        scroll-padding: 8px; max-width: 100%; }
      .css-snap-card { flex: 0 0 140px; height: 90px; scroll-snap-align: start;
        scroll-snap-stop: normal; scroll-margin: 8px; display: flex; align-items: center;
        justify-content: center; color: #fff; font-weight: bold; border-radius: 6px; }
      /* ===== Card 2: scrollIntoView / overscroll-behavior ===== */
      .css-scroll-stage { height: 120px; overflow-y: auto; border: 1px solid var(--color-border, #ccc);
        padding: 8px; scroll-behavior: smooth; position: relative; }
      .css-scroll-section { height: 80px; margin-bottom: 8px; padding: 6px; border-radius: 4px; color: #fff; }
      .css-osb-modal { height: 100px; overflow-y: auto; border: 1px solid var(--color-border, #ccc);
        padding: 8px; overscroll-behavior: contain; background: var(--color-bg-spotlight, #f5f5f5); }
      /* ===== Card 3: content-visibility / contain ===== */
      .css-cv-list { height: 160px; overflow-y: auto; border: 1px solid var(--color-border, #ccc); }
      .css-cv-item { content-visibility: auto; contain-intrinsic-size: auto 40px;
        padding: 8px; border-bottom: 1px solid var(--color-border-secondary, #eee); }
      /* ===== Card 4: scrollbar-* ===== */
      .css-sb-thin { height: 100px; overflow-y: scroll; border: 1px solid var(--color-border, #ccc);
        scrollbar-width: thin; scrollbar-color: #4a90d9 transparent; }
      .css-sb-none { height: 100px; overflow-y: scroll; border: 1px solid var(--color-border, #ccc); scrollbar-width: none; }
      .css-sb-gutter { height: 100px; overflow-y: auto; border: 1px solid var(--color-border, #ccc); scrollbar-gutter: stable; }
      .css-sb-webkit { height: 100px; overflow-y: scroll; border: 1px solid var(--color-border, #ccc); }
      .css-sb-webkit::-webkit-scrollbar { width: 10px; }
      .css-sb-webkit::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 5px; }
      .css-sb-webkit::-webkit-scrollbar-thumb { background: #4a90d9; border-radius: 5px; }
      .css-sb-webkit::-webkit-scrollbar-thumb:hover { background: #357abd; }
      .css-sb-webkit::-webkit-scrollbar-button { display: block; height: 10px; background: #ddd; }
      /* ===== Card 5: overflow:clip / overflow-clip-margin ===== */
      .css-oc-box { width: 120px; height: 80px; border: 1px solid var(--color-border, #ccc); display: inline-block; vertical-align: top; margin: 4px; }
      .css-oc-hidden { overflow: hidden; }
      .css-oc-clip { overflow: clip; }
      .css-oc-clip-margin { overflow: clip; overflow-clip-margin: 20px; }
      .css-oc-inner { width: 200px; height: 120px; background: linear-gradient(135deg, #4a90d9, #8b5cf6); color: #fff; padding: 4px; }
      .css-ow-test { width: 80px; border: 1px dashed var(--color-border, #ccc); padding: 4px; margin: 4px; display: inline-block; vertical-align: top; word-break: normal; }
      .css-ow-anywhere { overflow-wrap: anywhere; }
      .css-ow-break { overflow-wrap: break-word; }
      /* ===== Card 6: container query ===== */
      .css-cq-host { container-type: inline-size; container-name: card; border: 1px solid var(--color-border, #ccc);
        padding: 8px; resize: horizontal; overflow: auto; max-width: 100%; min-width: 120px; }
      .css-cq-widget { padding: 8px; background: var(--color-primary-bg, #e6f0ff); border-radius: 4px; }
      @container card (min-width: 280px) {
        .css-cq-widget { display: flex; gap: 8px; align-items: center; background: var(--color-success-bg, #e6f9ee); }
        .css-cq-widget .cq-title { font-weight: bold; }
      }
      @container card (max-width: 200px) { .css-cq-widget { flex-direction: column; font-size: 12px; } }
    `);
  }

  // =================== Card 1：CSS Scroll Snap 滚动捕捉 ===================

  _readSnapInfo() {
    const f = this._flags();
    try {
      const stage = this.el && this.el.querySelector('.css-snap-stage');
      let stageSnapType = '(未渲染)';
      let cardSnapAlign = '(未渲染)';
      if (stage) {
        stageSnapType = window.getComputedStyle(stage).getPropertyValue('scroll-snap-type') || '(空)';
        const firstCard = stage.querySelector('.css-snap-card');
        if (firstCard) cardSnapAlign = window.getComputedStyle(firstCard).getPropertyValue('scroll-snap-align') || '(空)';
      }
      return `CSS Scroll Snap 演示：\n` +
        `  已注入 .css-snap-stage { scroll-snap-type: x ${this._snapStrictness}; scroll-padding: 8px; }\n` +
        `  .css-snap-card { scroll-snap-align: start; scroll-snap-stop: normal; scroll-margin: 8px; }\n` +
        `  容器 scroll-snap-type 计算值="${stageSnapType}"\n` +
        `  子元素 scroll-snap-align 计算值="${cardSnapAlign}"\n` +
        `  CSS.supports('scroll-snap-type','x mandatory') = ${f.scrollSnap}\n` +
        `  scroll-snap-align 支持 = ${f.scrollSnapAlign}\n` +
        `  scroll-snap-stop 支持 = ${f.scrollSnapStop}\n` +
        `  scroll-padding 支持 = ${f.scrollPadding}；scroll-margin 支持 = ${f.scrollMargin}\n\n` +
        '说明：\n' +
        '  scroll-snap-type: x|y|both [mandatory|proximity] 在容器声明捕捉轴与严格度\n' +
        '    mandatory=必须捕捉（强制）；proximity=接近时捕捉（宽松）\n' +
        '  scroll-snap-align: start|center|end|none 在子元素声明捕捉对齐点\n' +
        '  scroll-snap-stop: normal|always 控制是否能跳过捕捉点（always 防快速滚动跳过）\n' +
        '  scroll-padding: <length> 容器的捕捉偏移（如顶部固定栏遮挡时留空间）\n' +
        '  scroll-margin: <length> 子元素的捕捉偏移\n\n' +
        '真实浏览器中横向滚动 5 张卡片，会自动 snap 到每张卡片的 start 对齐点。';
    } catch (err) {
      return `读取 Snap 信息失败：${err.name} - ${err.message}`;
    }
  }

  _runScrollSnapDemo() {
    this.setState({ scrollSnapInfo: this._readSnapInfo() });
    this._addLog('snap', `Scroll Snap 演示：严格度=x ${this._snapStrictness}，支持=${this._flags().scrollSnap}`);
  }

  _toggleSnapStrictness() {
    this._snapStrictness = this._snapStrictness === 'mandatory' ? 'proximity' : 'mandatory';
    // 重新注入 Card 1 的 snap-type 规则
    const css = `.css-snap-stage { scroll-snap-type: x ${this._snapStrictness}; }`;
    this._injectStyle('css-scroll-snap-strictness', css);
    const next = this._snapStrictness;
    this.setState({ scrollSnapInfo: this._readSnapInfo() });
    this._addLog('snap', `切换 scroll-snap-type → x ${next}（${next === 'mandatory' ? '强制捕捉' : '接近时捕捉'}）`);
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const colors = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6'];
    const card = new Card({
      title: '1. CSS Scroll Snap 滚动捕捉',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['scroll-snap-type', f.scrollSnap], ['scroll-snap-align', f.scrollSnapAlign], ['scroll-snap-stop', f.scrollSnapStop]]),
        h(Tag, { color: 'primary' }, 'mandatory / proximity'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'CSS Scroll Snap 让滚动容器在滚动结束时自动停在指定的捕捉点。scroll-snap-type: x|y|both [mandatory|proximity] 在容器声明捕捉轴与严格度（mandatory 强制捕捉、proximity 接近时捕捉）；scroll-snap-align: start|center|end|none 在子元素声明对齐点；scroll-snap-stop: always 防止快速滚动跳过捕捉点；scroll-padding 给容器留捕捉偏移（如顶部固定栏遮挡）；scroll-margin 给子元素额外偏移。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取 Snap 信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runScrollSnapDemo() }),
          this._btn(`切换严格度（当前：${this._snapStrictness}）`, { size: 'sm', disabled: !f.scrollSnap, onClick: () => this._toggleSnapStrictness() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '横向滚动下方 5 张卡片（真实浏览器中会自动 snap）：'),
        h('div', { class: 'css-snap-stage mt-xs' },
          ...colors.map((color, i) => h('div', {
            class: 'css-snap-card', style: { background: color },
          }, `卡片 ${i + 1}`)),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.scrollSnapInfo || '（点击「读取 Snap 信息」）')),
        h(Alert, {
          type: 'info',
          message: 'mandatory 强制捕捉，proximity 宽松捕捉',
          description: 'mandatory 滚动结束必须停在最近捕捉点；proximity 仅在接近时吸附。scroll-padding 解决固定栏遮挡问题，scroll-snap-stop: always 防止快速滑动跳过中间捕捉点（如相册场景）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：scrollIntoView 与滚动行为 ===================

  _scrollToSection(block, behavior) {
    const f = this._flags();
    if (!f.scrollIntoView) {
      this._addLog('warn', 'Element.prototype.scrollIntoView 不可用');
      this.setState({ scrollBehaviorInfo: 'scrollIntoView 不可用（typeof Element.prototype.scrollIntoView === "undefined"）。' });
      return;
    }
    try {
      const stage = this.el && this.el.querySelector('.css-scroll-stage');
      const target = stage && stage.querySelector(`[data-sec="${block}"]`);
      if (!target) {
        this._addLog('warn', `未找到 data-sec="${block}" 的目标元素`);
        return;
      }
      const opts = { behavior, block, inline: 'nearest' };
      target.scrollIntoView(opts);
      const readBack = `scrollIntoView(${JSON.stringify(opts)}) 已调用`;
      this.setState({ scrollBehaviorInfo:
        'scrollIntoView 演示：\n' +
        `  ${readBack}\n` +
        `  目标元素 data-sec="${block}"（${behavior === 'smooth' ? '平滑滚动' : behavior === 'instant' ? '瞬时跳转' : '默认'}）\n\n` +
        'API 表面：\n' +
        '  element.scrollIntoView({ behavior: "smooth"|"instant"|"auto", block: "start"|"center"|"end"|"nearest", inline: "start"|"center"|"end"|"nearest" })\n' +
        '  element.scrollIntoViewIfNeeded() —— WebKit 私有，仅在不可见时滚动（避免可见时跳动）\n\n' +
        '其他滚动 API：\n' +
        '  window.scrollTo({ top, left, behavior }) —— 绝对滚动到指定坐标\n' +
        '  window.scrollBy({ left, top, behavior }) —— 相对滚动增量\n' +
        '  element.scroll({ top, left, behavior }) —— 容器内滚动\n\n' +
        `CSS：scroll-behavior: smooth|instant|auto 在容器声明，支持=${f.scrollBehavior}\n` +
        `scrollIntoView 可用=${f.scrollIntoView}；scrollIntoViewIfNeeded（WebKit）可用=${f.scrollIntoViewIfNeeded}\n` +
        `overscroll-behavior 支持=${f.overscrollBehavior}` });
      this._addLog('scroll', `${readBack}，behavior=${behavior}`);
    } catch (err) {
      this._addLog('warn', `scrollIntoView 失败：${err.name} - ${err.message}`);
    }
  }

  _showOverscrollInfo() {
    const f = this._flags();
    this.setState({ scrollBehaviorInfo:
      'overscroll-behavior 与 scroll-timeline 说明：\n\n' +
      'overscroll-behavior: auto|contain|none|<x> <y>\n' +
      '  auto（默认）：滚动到边界时触发滚动链（父级/页面继续滚）\n' +
      '  contain：阻止滚动链，但允许自身回弹效果\n' +
      '  none：阻止滚动链 + 阻止回弹效果\n' +
      `  CSS.supports('overscroll-behavior','contain') = ${f.overscrollBehavior}\n\n` +
      '用途：模态框/抽屉内滚动到边界时不影响背景页面（contain）；下拉刷新区域隔离。\n' +
      '本卡片下方的 .css-osb-modal 已设置 overscroll-behavior: contain，\n' +
      '在真实浏览器中滚到顶部/底部时不会带动外层滚动。\n\n' +
      'scroll-behavior: smooth|instant|auto：\n' +
      '  在容器声明后，所有程序化滚动（scrollTo/scrollIntoView 默认 behavior:auto）\n' +
      '  以及锚点跳转都会按声明值滚动。也可在 scrollIntoView({behavior}) 单次覆盖。\n\n' +
      'scroll-timeline 集成：scroll-timeline 把滚动进度作为动画时间线\n' +
      '  （详见 CSSAdvancedFeaturesPage 的 Scroll-driven Animations 卡片），\n' +
      '  本页仅引用，不重复演示。' });
    this._addLog('scroll', `展示 overscroll-behavior / scroll-behavior / scroll-timeline 说明，支持=${f.overscrollBehavior}`);
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. scrollIntoView 与滚动行为',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['scroll-behavior', f.scrollBehavior], ['scrollIntoView', f.scrollIntoView], ['overscroll-behavior', f.overscrollBehavior]]),
        h(Tag, { color: 'primary' }, 'smooth / contain'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'element.scrollIntoView({ behavior, block, inline }) 让元素滚动到视口；scrollIntoViewIfNeeded() 是 WebKit 私有，仅在不可见时滚动。window.scrollTo({top,left,behavior}) 绝对滚动，scrollBy({left,top}) 相对滚动，element.scroll({top,left}) 容器内滚动。scroll-behavior: smooth 在容器声明后所有程序化滚动与锚点跳转都平滑滚动。overscroll-behavior: contain 阻止滚动链（模态框滚到边界不带动背景）。scroll-timeline 把滚动进度作为动画时间线（详见 CSSAdvancedFeaturesPage）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('滚到 start（smooth）', { type: 'primary', size: 'sm', disabled: !f.scrollIntoView, onClick: () => this._scrollToSection('start', 'smooth') }),
          this._btn('滚到 center（smooth）', { size: 'sm', disabled: !f.scrollIntoView, onClick: () => this._scrollToSection('center', 'smooth') }),
          this._btn('滚到 end（instant）', { size: 'sm', disabled: !f.scrollIntoView, onClick: () => this._scrollToSection('end', 'instant') }),
          this._btn('overscroll 说明', { size: 'sm', onClick: () => this._showOverscrollInfo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'scroll-behavior: smooth 容器（点击按钮滚动到对应区块）：'),
        h('div', { class: 'css-scroll-stage mt-xs' },
          h('div', { class: 'css-scroll-section', style: { background: '#3b82f6' }, 'data-sec': 'start' }, '区块 start'),
          h('div', { class: 'css-scroll-section', style: { background: '#10b981' }, 'data-sec': 'center' }, '区块 center'),
          h('div', { class: 'css-scroll-section', style: { background: '#ef4444' }, 'data-sec': 'end' }, '区块 end'),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'overscroll-behavior: contain 模态框（滚到边界不动外层）：'),
        h('div', { class: 'css-osb-modal mt-xs' },
          h('div', { style: { height: '300px' } }, '模态内容（overscroll-behavior: contain）—— 真实浏览器中滚到顶/底不会带动外层页面滚动。'),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, s.scrollBehaviorInfo || '（点击按钮触发 scrollIntoView 或查看 overscroll 说明）')),
        h(Alert, {
          type: 'info',
          message: 'scroll-behavior + scrollIntoView({behavior}) 控制滚动动画',
          description: 'scroll-behavior 在容器声明全局滚动行为；scrollIntoView({behavior}) 单次覆盖。overscroll-behavior: contain 是模态框/抽屉防止背景滚动的关键属性。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：content-visibility 与 contain-intrinsic-size ===================

  _runContentVisibilityDemo() {
    const f = this._flags();
    try {
      const list = this.el && this.el.querySelector('.css-cv-list');
      let renderMs = '(未测量)';
      if (list) {
        const t0 = performance.now();
        // 触发一次同步布局读取以测量渲染开销
        const count = list.querySelectorAll('.css-cv-item').length;
        const _ = list.scrollHeight; // 强制 reflow
        const t1 = performance.now();
        renderMs = `${(t1 - t0).toFixed(2)}ms（${count} 项，读取 scrollHeight 强制 reflow）`;
      }
      let cvComputed = '(未渲染)';
      let cisComputed = '(未渲染)';
      if (list) {
        const first = list.querySelector('.css-cv-item');
        if (first) {
          cvComputed = window.getComputedStyle(first).getPropertyValue('content-visibility') || '(空)';
          cisComputed = window.getComputedStyle(first).getPropertyValue('contain-intrinsic-size') || '(空)';
        }
      }
      this.setState({ contentVisibilityInfo:
        'content-visibility 与 contain-intrinsic-size 演示：\n' +
        `  .css-cv-item { content-visibility: auto; contain-intrinsic-size: auto 40px; }\n` +
        `  100 项渲染测量：${renderMs}\n` +
        `  content-visibility 计算值="${cvComputed}"\n` +
        `  contain-intrinsic-size 计算值="${cisComputed}"\n` +
        `  CSS.supports('content-visibility','auto') = ${f.contentVisibility}\n` +
        `  contain-intrinsic-size 支持 = ${f.containIntrinsicSize}\n` +
        `  contain 支持 = ${f.contain}\n\n` +
        '说明：\n' +
        '  content-visibility: visible|hidden|auto —— auto 跳过屏外内容渲染（巨大性能提升）\n' +
        '    visible：正常渲染；hidden：跳过渲染但保留状态；auto：屏外自动跳过\n' +
        '  contain-intrinsic-size: <W> <H> 或 auto <W> <H> —— 提供占位尺寸，避免滚动条跳动\n' +
        '    auto 前缀让浏览器记住上次渲染的真实尺寸，更精确\n' +
        '  contain: layout|paint|style|size|strict|content —— containment 原语\n' +
        '    strict=layout+paint+style+size；content=layout+paint+style\n' +
        '  content-visibility:hidden vs display:none：\n' +
        '    hidden 保留渲染状态（再显示更快）；display:none 完全移除（再显示需重渲染）\n\n' +
        '本列表 100 项用 content-visibility:auto + contain-intrinsic-size:auto 40px，\n' +
        '屏外项不渲染，初始渲染成本大幅降低；滚动到可视时才渲染。' });
      this._addLog('cv', `content-visibility 演示：渲染测量=${renderMs}，支持=${f.contentVisibility}`);
    } catch (err) {
      this._addLog('warn', `content-visibility 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const items = Array.from({ length: 100 }, (_, i) => i + 1);
    const card = new Card({
      title: '3. content-visibility 与 contain-intrinsic-size',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['content-visibility', f.contentVisibility], ['contain-intrinsic-size', f.containIntrinsicSize], ['contain', f.contain]]),
        h(Tag, { color: 'primary' }, 'lazy 渲染'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'content-visibility: auto 让浏览器跳过屏外内容的渲染（layout/paint），对长列表/长文档有巨大性能提升。contain-intrinsic-size 提供占位尺寸避免滚动条跳动（auto 前缀让浏览器记住真实尺寸）。contain: layout|paint|style|size 是 containment 原语。content-visibility:hidden 与 display:none 区别：hidden 保留渲染状态，再显示更快；display:none 完全移除需重渲染。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('测量 100 项渲染', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runContentVisibilityDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '100 项列表（content-visibility:auto; contain-intrinsic-size:auto 40px）：'),
        h('div', { class: 'css-cv-list mt-xs' },
          ...items.map((i) => h('div', { class: 'css-cv-item' }, `第 ${i} 项 —— 屏外时跳过渲染，contain-intrinsic-size 占位 40px`)),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.contentVisibilityInfo || '（点击「测量 100 项渲染」）')),
        h(Alert, {
          type: 'warning',
          message: 'content-visibility: auto 需配合 contain-intrinsic-size 避免滚动条跳动',
          description: 'auto 跳过屏外渲染但不占用布局空间，会导致滚动条高度跳动；contain-intrinsic-size 给出占位尺寸稳定滚动条。auto <size> 前缀让浏览器记住上次真实尺寸更精确。Chrome 85+ 支持。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：自定义滚动条 scrollbar-* 属性 ===================

  _runScrollbarDemo() {
    const f = this._flags();
    try {
      const thin = this.el && this.el.querySelector('.css-sb-thin');
      const none = this.el && this.el.querySelector('.css-sb-none');
      const gutter = this.el && this.el.querySelector('.css-sb-gutter');
      const readComp = (el, prop) => {
        if (!el) return '(未渲染)';
        return window.getComputedStyle(el).getPropertyValue(prop) || '(空)';
      };
      this.setState({ scrollbarInfo:
        '自定义滚动条 scrollbar-* 演示：\n' +
        `  .css-sb-thin { scrollbar-width: thin; scrollbar-color: #4a90d9 transparent; }\n` +
        `    scrollbar-width 计算值="${readComp(thin, 'scrollbar-width')}"\n` +
        `    scrollbar-color 计算值="${readComp(thin, 'scrollbar-color')}"\n` +
        `  .css-sb-none { scrollbar-width: none; } —— 隐藏滚动条但仍可滚动\n` +
        `    scrollbar-width 计算值="${readComp(none, 'scrollbar-width')}"\n` +
        `  .css-sb-gutter { scrollbar-gutter: stable; } —— 预留滚动条空间防布局抖动\n` +
        `    scrollbar-gutter 计算值="${readComp(gutter, 'scrollbar-gutter')}"\n` +
        `  CSS.supports('scrollbar-width','thin') = ${f.scrollbarWidth}\n` +
        `  scrollbar-color 支持 = ${f.scrollbarColor}\n` +
        `  scrollbar-gutter 支持 = ${f.scrollbarGutter}\n\n` +
        '说明：\n' +
        '  scrollbar-width: auto|thin|none —— Firefox 起源，现已标准化（thin=细滚动条，none=隐藏）\n' +
        '  scrollbar-color: <thumb> <track> —— 同时设置滑块与轨道颜色\n' +
        '  ::-webkit-scrollbar / ::-webkit-scrollbar-track / ::-webkit-scrollbar-thumb /\n' +
        '    ::-webkit-scrollbar-button / ::-webkit-scrollbar-corner —— WebKit/Blink 旧伪元素，仍可用\n' +
        '    （下方 .css-sb-webkit 容器用 ::-webkit-scrollbar 自定义宽 10px、蓝色滑块）\n' +
        '  scrollbar-gutter: auto|stable|both-edges —— 预留滚动条空间，防内容溢出时布局抖动\n' +
        '    stable=始终预留；both-edges=两侧都预留；auto=仅溢出时预留\n\n' +
        '兼容策略：标准 scrollbar-width/color + ::-webkit-scrollbar 伪元素双写覆盖所有现代浏览器。' });
      this._addLog('scrollbar', `scrollbar 演示：width=${f.scrollbarWidth}, color=${f.scrollbarColor}, gutter=${f.scrollbarGutter}`);
    } catch (err) {
      this._addLog('warn', `scrollbar 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const filler = (text) => h('div', { style: { height: '300px', padding: '8px' } }, text);
    const card = new Card({
      title: '4. 自定义滚动条 scrollbar-* 属性',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['scrollbar-width', f.scrollbarWidth], ['scrollbar-color', f.scrollbarColor], ['scrollbar-gutter', f.scrollbarGutter]]),
        h(Tag, { color: 'primary' }, 'thin / stable'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'scrollbar-width: auto|thin|none（Firefox 起源，现已标准化）控制滚动条粗细，none 可隐藏但仍可滚动。scrollbar-color: <thumb> <track> 同时设置滑块与轨道颜色。::-webkit-scrollbar{,-track,-thumb,-button,-corner} 是 WebKit/Blink 旧伪元素，仍可用以细粒度定制。scrollbar-gutter: stable 预留滚动条空间，防止内容从无溢出到溢出时布局抖动。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取滚动条信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runScrollbarDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'scrollbar-width: thin; scrollbar-color: #4a90d9 transparent：'),
        h('div', { class: 'css-sb-thin mt-xs' }, filler('thin 滚动条（蓝色滑块、透明轨道）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'scrollbar-width: none（隐藏滚动条）：'),
        h('div', { class: 'css-sb-none mt-xs' }, filler('none —— 滚动条隐藏但仍可滚动')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '::-webkit-scrollbar 自定义（宽 10px、蓝色滑块、带 button）：'),
        h('div', { class: 'css-sb-webkit mt-xs' }, filler('webkit 自定义滚动条')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'scrollbar-gutter: stable（预留空间防抖动）：'),
        h('div', { class: 'css-sb-gutter mt-xs' }, filler('stable —— 滚动条空间始终预留')),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.scrollbarInfo || '（点击「读取滚动条信息」）')),
        h(Alert, {
          type: 'info',
          message: '标准 scrollbar-* + ::-webkit-scrollbar 双写覆盖所有现代浏览器',
          description: 'scrollbar-width/color 是标准属性（Chrome 121+ 完整支持，Firefox 早已支持）；::-webkit-scrollbar 在 Chrome/Safari/新版 Edge 仍有效。scrollbar-gutter: stable 解决模态框出现/消失导致的布局抖动。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：overflow 与 clip 新特性 ===================

  _runOverflowClipDemo() {
    const f = this._flags();
    try {
      const clip = this.el && this.el.querySelector('.css-oc-clip');
      const hidden = this.el && this.el.querySelector('.css-oc-hidden');
      const clipMargin = this.el && this.el.querySelector('.css-oc-clip-margin');
      const readComp = (el, prop) => {
        if (!el) return '(未渲染)';
        return window.getComputedStyle(el).getPropertyValue(prop) || '(空)';
      };
      this.setState({ overflowClipInfo:
        'overflow 与 clip 新特性 演示：\n' +
        `  .css-oc-hidden { overflow: hidden; } —— 创建滚动容器，可程序化滚动\n` +
        `    overflow 计算值="${readComp(hidden, 'overflow')}"\n` +
        `  .css-oc-clip { overflow: clip; } —— 不创建滚动容器，不可程序化滚动，更轻量\n` +
        `    overflow 计算值="${readComp(clip, 'overflow')}"\n` +
        `  .css-oc-clip-margin { overflow: clip; overflow-clip-margin: 20px; } —— 允许溢出 20px\n` +
        `    overflow-clip-margin 计算值="${readComp(clipMargin, 'overflow-clip-margin')}"\n` +
        `  CSS.supports('overflow','clip') = ${f.overflowClip}\n` +
        `  overflow-clip-margin 支持 = ${f.overflowClipMargin}\n` +
        `  text-overflow 支持 = ${f.textOverflow}；overflow-wrap 支持 = ${f.overflowWrap}\n\n` +
        '说明：\n' +
        '  overflow: visible|hidden|scroll|auto|clip —— clip 是新增值\n' +
        '    hidden 创建滚动容器（可 scrollTo/scrollIntoView），clip 不创建（更轻量，无法程序化滚动）\n' +
        '    clip 适合纯裁剪场景（如隐藏超出头像的图片），开销更低\n' +
        '  overflow-clip-margin: <length> —— clip 裁剪边距，允许内容溢出指定距离再裁剪\n' +
        '    可用 <visual-box> <length> 形式（如 content-box 10px）\n' +
        '  overflow-x / overflow-y —— 独立设置两轴\n' +
        '  text-overflow: clip|ellipsis|<string> —— 文本溢出处理（Firefox 支持 <string>）\n' +
        '  overflow-wrap: normal|break-word|anywhere —— 任意位置断行\n' +
        '    anywhere=即使无断点也断（影响 min-content 计算）；break-word=仅在无断点时断\n' +
        '    vs word-break:break-all（强制任意字符断，CJK 友好）' });
      this._addLog('clip', `overflow:clip 演示：支持=${f.overflowClip}, clip-margin=${f.overflowClipMargin}`);
    } catch (err) {
      this._addLog('warn', `overflow:clip 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const longWord = 'Supercalifragilisticexpialidocious';
    const card = new Card({
      title: '5. overflow 与 clip 新特性',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['overflow:clip', f.overflowClip], ['overflow-clip-margin', f.overflowClipMargin], ['overflow-wrap', f.overflowWrap]]),
        h(Tag, { color: 'primary' }, 'clip / clip-margin'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'overflow 新增 clip 值：类似 hidden 但不创建滚动容器，无法程序化滚动，开销更低，适合纯裁剪。overflow-clip-margin: <length> 允许内容溢出指定距离再裁剪。overflow-x / overflow-y 可独立设置两轴。text-overflow: clip|ellipsis|<string>（Firefox 支持 string）。overflow-wrap: break-word|anywhere 控制断行（anywhere 影响 min-content 计算，与 word-break:break-all 不同）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取 clip 信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runOverflowClipDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'overflow: hidden vs clip vs clip+margin（内层 200x120，外层 120x80）：'),
        h('div', { class: 'mt-xs' },
          h('div', { class: 'css-oc-box css-oc-hidden' }, h('div', { class: 'css-oc-inner' }, 'hidden')),
          h('div', { class: 'css-oc-box css-oc-clip' }, h('div', { class: 'css-oc-inner' }, 'clip')),
          h('div', { class: 'css-oc-box css-oc-clip-margin' }, h('div', { class: 'css-oc-inner' }, 'clip+margin 20px')),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'overflow-wrap: anywhere / break-word（长单词 ' + longWord + '）：'),
        h('div', { class: 'mt-xs' },
          h('div', { class: 'css-ow-test css-ow-anywhere' }, longWord),
          h('div', { class: 'css-ow-test css-ow-break' }, longWord),
          h('div', { class: 'css-ow-test' }, longWord + '（默认 normal）'),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.overflowClipInfo || '（点击「读取 clip 信息」）')),
        h(Alert, {
          type: 'info',
          message: 'overflow: clip 比 hidden 更轻量，不创建滚动容器',
          description: 'clip 无法被 scrollTo/scrollIntoView 程序化滚动，适合纯裁剪。overflow-clip-margin 允许裁剪边向外扩展。overflow-wrap:anywhere 与 word-break:break-all 都能断长词，但前者影响 min-content 计算。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：滚动容器查询与布局性能 ===================

  _runContainerQueryDemo() {
    const f = this._flags();
    try {
      const host = this.el && this.el.querySelector('.css-cq-host');
      let ctComputed = '(未渲染)';
      let cnComputed = '(未渲染)';
      let width = '(未测量)';
      if (host) {
        ctComputed = window.getComputedStyle(host).getPropertyValue('container-type') || '(空)';
        cnComputed = window.getComputedStyle(host).getPropertyValue('container-name') || '(空)';
        width = `${host.clientWidth}px`;
      }
      this.setState({ containerQueryInfo:
        '容器查询与布局性能 演示：\n' +
        `  .css-cq-host { container-type: inline-size; container-name: card; }\n` +
        `  @container card (min-width: 280px) { .css-cq-widget { display:flex; ... } }\n` +
        `  @container card (max-width: 200px) { .css-cq-widget { flex-direction:column; ... } }\n` +
        `  container-type 计算值="${ctComputed}"\n` +
        `  container-name 计算值="${cnComputed}"\n` +
        `  容器当前 clientWidth=${width}\n` +
        `  CSS.supports('container-type','inline-size') = ${f.containerType}\n` +
        `  container-name 支持 = ${f.containerName}\n` +
        `  @container style(--x:1) 样式查询 = ${f.containerStyle}\n\n` +
        '说明：\n' +
        '  container-type: normal|inline-size|size|scroll-state —— 声明容器查询维度\n' +
        '    inline-size=按行内尺寸查询（最常用）；size=双维度；scroll-state=滚动状态查询\n' +
        '  container-name: <custom-ident> —— 命名容器，@container <name> (条件) 精确匹配\n' +
        '  @container (min-width: 280px) —— 基于容器尺寸响应（非视口，区别 @media）\n' +
        '  @container style(--theme: dark) —— 样式查询，按自定义属性值响应\n' +
        `    （containerStyle=${f.containerStyle}，Chrome 111+ 部分支持）\n\n` +
        '组合与性能：\n' +
        '  content-visibility:auto + container queries —— 卡片组件屏外跳过渲染 + 容器内响应式\n' +
        '  will-change: scroll-position —— 提示浏览器为滚动优化（适当用，勿滥用）\n' +
        '  contain: layout —— 滚动容器隔离布局影响范围\n' +
        '  overscroll-behavior: contain —— 嵌套滚动防滚动链\n' +
        '  scroll-timeline —— 滚动驱动动画（详见 CSSAdvancedFeaturesPage，此处仅引用）\n\n' +
        '拖动下方容器右下角调整宽度，真实浏览器中 widget 会在 >280px 变横向布局、<200px 变纵向。' });
      this._addLog('cq', `容器查询演示：container-type=${f.containerType}, style=${f.containerStyle}, width=${width}`);
    } catch (err) {
      this._addLog('warn', `容器查询演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. 滚动容器查询与布局性能',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['container-type', f.containerType], ['container-name', f.containerName], ['@container style', f.containerStyle]]),
        h(Tag, { color: 'primary' }, '@container'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'container-type: inline-size 声明容器查询维度，container-name 命名容器，@container (min-width) 基于容器尺寸响应（区别于 @media 视口）。@container style(--theme:dark) 样式查询按自定义属性值响应。组合 content-visibility:auto + container queries 可让卡片组件屏外跳过渲染且容器内响应式。性能：will-change: scroll-position 提示滚动优化、contain: layout 隔离布局、overscroll-behavior: contain 防嵌套滚动链；scroll-timeline 滚动驱动动画详见 CSSAdvancedFeaturesPage。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取容器查询信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runContainerQueryDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '拖动右下角调整容器宽度（container-type: inline-size; container-name: card）：'),
        h('div', { class: 'css-cq-host mt-xs' },
          h('div', { class: 'css-cq-widget' },
            h('span', { class: 'cq-title' }, '响应式卡片'),
            h('span', {}, '>280px 横向布局；<200px 纵向紧凑布局'),
          ),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.containerQueryInfo || '（点击「读取容器查询信息」）')),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '150px', overflow: 'auto' } },
          h('code', {},
`.card-host { container-type: inline-size; container-name: card; }
@container card (min-width: 280px) {
  .widget { display: flex; gap: 8px; }
}
@container card (max-width: 200px) {
  .widget { flex-direction: column; font-size: 12px; }
}
/* 样式查询：按自定义属性值响应 */
@container style(--theme: dark) { .widget { background: #333; } }
/* 性能组合 */
.scroller { contain: layout; overscroll-behavior: contain; will-change: scroll-position; }`)),
        h(Alert, {
          type: 'info',
          message: '容器查询让组件基于自身容器而非视口响应',
          description: 'container-type: inline-size 是最常用值（仅按宽度查询，避免 size 双维度递归）。样式查询 @container style(--x) 较新。配合 content-visibility:auto 可构建高性能响应式卡片。',
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
    return h('div', { class: 'api-lab-page css-scroll-layout-page' },
      h('h2', { class: 'section-title' }, 'CSS 滚动与布局 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页演示 CSS Scroll Snap、scrollIntoView 与滚动行为、content-visibility 与 contain-intrinsic-size、scrollbar-* 自定义滚动条、overflow:clip 与 clip-margin、容器查询与布局性能。所有特性通过 typeof / CSS.supports 能力检测，不可用时仅记日志，绝不抛异常。'),
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
