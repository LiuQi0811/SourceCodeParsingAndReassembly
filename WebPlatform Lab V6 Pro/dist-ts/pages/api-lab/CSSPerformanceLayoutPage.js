// =====================================================================
// CSSPerformanceLayoutPage.js —— CSS Containment + Content Visibility + Masonry 深度实验室
// 演示三大性能型 CSS 标准的完整能力：
//   1. 概述与动机 —— 现代 Web 性能瓶颈（DOM 规模爆炸、长列表渲染卡顿、
//      布局重计算成本）/ 三大性能型 CSS 标准（CSS Containment L1/L2/L3 +
//      content-visibility + Masonry）/ 浏览器支持 Chrome 85+/Firefox 125+/Safari 17+
//   2. contain 属性全集 —— contain: layout / paint / size / style / inline-size /
//      block-size / strict / content / none / layout containment 创建独立格式化上下文 /
//      paint containment 创建 clipping / size containment 子树尺寸视为 0
//   3. content-visibility: auto —— 跳过屏外内容渲染 / contain-intrinsic-size 兜底尺寸 /
//      与 IntersectionObserver 等价但浏览器自动处理 / 长列表（10000 行）渲染性能
//      数量级提升 / 滚动条跳变修复
//   4. content-visibility: hidden —— 完全隐藏但保留渲染状态 / vs display: none
//      （不保留状态）/ vs visibility: hidden / 暂停 CSS 动画与定时器 /
//      配合 IntersectionObserver 主动控制
//   5. contain-intrinsic-size 与尺寸提示 —— contain-intrinsic-size: 200px 100px /
//      contain-intrinsic-size: auto 200px 100px / 单轴尺寸 / 浏览器记录最后已知尺寸 /
//      content-visibility: auto 必备
//   6. Masonry Layout（CSS Grid L3）—— grid-template-rows: masonry /
//      grid-template-columns: masonry / masonry-auto-flow: pack/next /
//      与 Pinterest 瀑布流 / align-tracks/justify-tracks / Firefox 默认开启，
//      Chrome/Safari 实验 flag
//   7. 性能监控与验证 —— Performance API 测量 Layout/Paint 耗时 / Lighthouse
//      content-visibility 建议 / Render Blocking 监控 / Layout Shift 跳变检测 /
//      DevTools Performance 面板查看 skipped subtrees
//   8. 实战与陷阱 —— 虚拟列表 vs content-visibility:auto 取舍 / 长文档目录优化 /
//      配合 contain: strict 严格隔离 / content-visibility 与 anchor 定位冲突 /
//      Masonry 降级（CSS columns + JS）/ 焦点管理（屏外可聚焦元素）
// 说明：所有特性调用前做 typeof / CSS.supports 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。jsdom 不做真实 CSS 渲染，
//       CSS.supports 通常可用；Performance API / IntersectionObserver 在 jsdom
//       通常不可用，统一 try/catch 兜底。_flags() 用 safe(()=>...) 包裹，
//       jsdom 不可用时返回 false。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class CSSPerformanceLayoutPage extends Page {
    _inited = false;
    _dynamicStyles = [];
    _intersectionObservers = undefined;
    _perfObservers = undefined;
    _containMode = '';
    _cvAutoMode = '';
    _cvHiddenMode = '';
    _intrinsicMode = '';
    _masonryMode = '';
    _perfMode = '';
    // —— 初始 state ——
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            overviewInfo: '', // Card 1：概述与动机
            containInfo: '', // Card 2：contain 属性全集
            contentVisibilityAutoInfo: '', // Card 3：content-visibility: auto
            contentVisibilityHiddenInfo: '', // Card 4：content-visibility: hidden
            intrinsicSizeInfo: '', // Card 5：contain-intrinsic-size
            masonryInfo: '', // Card 6：Masonry Layout
            perfMonitorInfo: '', // Card 7：性能监控与验证
            pitfallsInfo: '', // Card 8：实战与陷阱
            beforematchInfo: '', // Card 9：beforematch 与 hidden=until-found
        };
    }
    // —— 生命周期 ——
    componentDidMount() {
        // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
        if (this._inited)
            return;
        this._inited = true;
        // 一次性初始化各实例引用（componentWillUnmount 中释放）
        this._dynamicStyles = []; // 动态创建并插入 head 的 <style> 元素列表
        this._intersectionObservers = []; // IntersectionObserver 实例列表
        this._perfObservers = []; // PerformanceObserver 实例列表
        // 各 Card 当前演示模式
        this._containMode = 'layout'; // Card 2 当前 contain 值
        this._cvAutoMode = 'on'; // Card 3 content-visibility: auto 开关
        this._cvHiddenMode = 'off'; // Card 4 content-visibility: hidden 开关
        this._intrinsicMode = 'fixed'; // Card 5 contain-intrinsic-size 模式
        this._masonryMode = 'rows'; // Card 6 Masonry 模式
        this._perfMode = 'layout'; // Card 7 性能监控模式
        // 一次性能力检测：CSS 性能型特性全家桶
        const f = this._flags();
        const c = (ok) => ok ? '✓' : '✗';
        const parts = [
            `CSS ${c(f.css)}`,
            `supports ${c(f.supports)}`,
            `contain:layout ${c(f.containLayout)}`,
            `contain:paint ${c(f.containPaint)}`,
            `contain:size ${c(f.containSize)}`,
            `contain:strict ${c(f.containStrict)}`,
            `contain:inline-size ${c(f.containInlineSize)}`,
            `content-visibility:auto ${c(f.contentVisibilityAuto)}`,
            `content-visibility:hidden ${c(f.contentVisibilityHidden)}`,
            `contain-intrinsic-size ${c(f.containIntrinsicSize)}`,
            `grid masonry ${c(f.masonry)}`,
            `IntersectionObserver ${c(f.intersectionObserver)}`,
            `PerformanceObserver ${c(f.performanceObserver)}`,
        ];
        const summary = f.css
            ? `CSS Containment + content-visibility + Masonry 能力检测：${parts.join(' · ')}。jsdom 不做真实 CSS 渲染，但 CSS.supports 通常可用；IntersectionObserver / PerformanceObserver 在 jsdom 通常不可用。contain/content-visibility 为 CSS Containment L1/L2（Chrome 85+/Firefox 125+/Safari 17+），Masonry 为 CSS Grid L3（Firefox 默认开启，Chrome/Safari 实验 flag）。按钮点击注入演示样式 + 完整代码示例，真实浏览器可查看长列表性能提升与瀑布流布局。`
            : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。';
        this.setState({ capsSummary: summary });
        this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!f.containLayout)
            this._addLog('warn', 'contain: layout 不可用或 jsdom 未识别（CSS Containment L1，Chrome 52+/Firefox 69+/Safari 15.4+ 支持）');
        if (!f.containPaint)
            this._addLog('warn', 'contain: paint 不可用或 jsdom 未识别（CSS Containment L2，Chrome 52+/Firefox 69+/Safari 15.4+）');
        if (!f.containSize)
            this._addLog('warn', 'contain: size 不可用或 jsdom 未识别（CSS Containment L1，Chrome 52+/Firefox 69+/Safari 15.4+）');
        if (!f.contentVisibilityAuto)
            this._addLog('warn', 'content-visibility: auto 不可用或 jsdom 未识别（CSS Containment L2，Chrome 85+/Firefox 125+/Safari 17+）');
        if (!f.masonry)
            this._addLog('warn', 'grid-template-rows: masonry 不可用或 jsdom 未识别（CSS Grid L3，Firefox 默认开启，Chrome/Safari 实验 flag）');
        if (!f.intersectionObserver)
            this._addLog('warn', 'IntersectionObserver 不可用（jsdom 通常不实现，现代浏览器全支持：Chrome 51+/Firefox 55+/Safari 12.1+）');
        if (!f.performanceObserver)
            this._addLog('warn', 'PerformanceObserver 不可用（jsdom 通常不实现，现代浏览器全支持：Chrome 52+/Firefox 57+/Safari 11+）');
        if (!f.beforematch)
            this._addLog('warn', 'beforematch 事件 / hidden=until-found 不可用（Chrome 102+/105+，jsdom 不识别）');
        // 一次性注入全部演示样式（仅一次；rerender 不会移除 head 中的 style）
        this._injectBaseStyles();
    }
    componentWillUnmount() {
        // 移除动态创建的 <style> 元素，便于 GC
        for (const style of this._dynamicStyles) {
            try {
                style.parentNode && style.parentNode.removeChild(style);
            }
            catch { /* noop */ }
        }
        this._dynamicStyles = [];
        // 断开所有 IntersectionObserver / PerformanceObserver
        for (const io of this._intersectionObservers) {
            try {
                io.disconnect();
            }
            catch { /* noop */ }
        }
        this._intersectionObservers = [];
        for (const po of this._perfObservers) {
            try {
                po.disconnect();
            }
            catch { /* noop */ }
        }
        this._perfObservers = [];
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
    _caps(items) {
        return items.map(([label, ok]) => h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
    }
    // safe 包装：jsdom 不可用时返回 false，绝不抛异常
    _safe(fn) {
        try {
            return fn();
        }
        catch {
            return false;
        }
    }
    // 返回布尔能力对象（供 capsSummary / 按钮 disabled 使用）
    _flags() {
        const hasCSS = this._safe(() => typeof CSS !== 'undefined');
        const supportsPV = (p, v) => this._safe(() => hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v));
        return {
            css: hasCSS,
            supports: this._safe(() => hasCSS && typeof CSS.supports === 'function'),
            // Card 2：contain 属性全集
            containLayout: supportsPV('contain', 'layout'),
            containPaint: supportsPV('contain', 'paint'),
            containSize: supportsPV('contain', 'size'),
            containStyle: supportsPV('contain', 'style'),
            containStrict: supportsPV('contain', 'strict'),
            containContent: supportsPV('contain', 'content'),
            containInlineSize: supportsPV('contain', 'inline-size'),
            containBlockSize: supportsPV('contain', 'block-size'),
            // Card 3/4：content-visibility
            contentVisibilityAuto: supportsPV('content-visibility', 'auto'),
            contentVisibilityHidden: supportsPV('content-visibility', 'hidden'),
            // Card 5：contain-intrinsic-size
            containIntrinsicSize: supportsPV('contain-intrinsic-size', '200px 100px'),
            containIntrinsicSizeAuto: supportsPV('contain-intrinsic-size', 'auto 200px 100px'),
            // Card 6：Masonry
            masonry: supportsPV('grid-template-rows', 'masonry'),
            masonryCols: supportsPV('grid-template-columns', 'masonry'),
            // Card 7：性能 API
            intersectionObserver: this._safe(() => typeof IntersectionObserver !== 'undefined'),
            performanceObserver: this._safe(() => typeof PerformanceObserver !== 'undefined' && typeof performance !== 'undefined'),
            // 测量 layout/paint 入口
            performanceMeasureUserAgent: this._safe(() => typeof performance !== 'undefined' && typeof performance.measure === 'function'),
            // Card 9：beforematch / hidden=until-found
            beforematch: this._safe(() => typeof document !== 'undefined'
                && !!document.documentElement && 'onbeforematch' in document.documentElement),
            hiddenUntilFound: this._safe(() => {
                if (typeof document === 'undefined')
                    return false;
                const el = document.createElement('div');
                el.setAttribute('hidden', 'until-found');
                return el.hidden === false || el.getAttribute('hidden') === 'until-found';
            }),
        };
    }
    // —— 注入一个 <style>，跟踪到 this._dynamicStyles ——
    _injectStyle(id, textContent) {
        const existing = document.getElementById(id);
        if (existing)
            existing.remove();
        const style = document.createElement('style');
        style.id = id;
        style.textContent = textContent;
        document.head.appendChild(style);
        this._dynamicStyles.push(style);
        return style;
    }
    // —— 动态注入所有演示样式（一次性）——
    _injectBaseStyles() {
        this._injectStyle('css-perf-layout-demo', `
      /* ===== 通用舞台 ===== */
      .perf-stage {
        margin-top: 10px;
        padding: 12px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
      }
      /* ===== Card 2：contain 属性演示 ===== */
      .contain-box {
        width: 200px;
        padding: 12px;
        margin: 8px 0;
        background: #dbeafe;
        border: 2px solid #3b82f6;
        color: #1e3a8a;
        border-radius: 6px;
        font-size: 13px;
      }
      .contain-layout { contain: layout; }
      .contain-paint { contain: paint; }
      .contain-size { contain: size; }
      .contain-style { contain: style; }
      .contain-strict { contain: strict; }
      .contain-content { contain: content; }
      .contain-inline-size { contain: inline-size; }
      .contain-none { contain: none; }
      /* ===== Card 3：content-visibility: auto 长列表 ===== */
      .cv-list {
        max-height: 200px;
        overflow-y: auto;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        margin-top: 8px;
        background: #fff;
      }
      .cv-item {
        padding: 12px;
        border-bottom: 1px solid #e2e8f0;
        font-size: 13px;
        contain-intrinsic-size: 0 44px;
      }
      .cv-item.cv-auto { content-visibility: auto; }
      .cv-item.cv-visible { content-visibility: visible; }
      /* ===== Card 4：content-visibility: hidden ===== */
      .cv-hidden-stage { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
      .cv-hidden-box {
        width: 100px;
        padding: 10px;
        background: #fef3c7;
        border: 2px solid #f59e0b;
        color: #78350f;
        border-radius: 6px;
        font-size: 12px;
      }
      .cv-hidden { content-visibility: hidden; }
      .cv-display-none { display: none; }
      .cv-visibility-hidden { visibility: hidden; }
      /* ===== Card 5：contain-intrinsic-size ===== */
      .intrinsic-stage { margin-top: 8px; }
      .intrinsic-box {
        background: #dcfce7;
        border: 2px solid #10b981;
        color: #064e3b;
        border-radius: 6px;
        padding: 10px;
        font-size: 13px;
        margin: 6px 0;
      }
      .intrinsic-fixed { contain-intrinsic-size: 200px 100px; }
      .intrinsic-auto { contain-intrinsic-size: auto 200px 100px; }
      .intrinsic-single { contain-intrinsic-size: 200px; }
      /* ===== Card 6：Masonry Layout ===== */
      .masonry-stage {
        margin-top: 8px;
        padding: 10px;
        background: #1e293b;
        border-radius: 6px;
      }
      .masonry-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        grid-template-rows: masonry;  /* Firefox 默认支持 */
        gap: 8px;
        max-height: 300px;
      }
      .masonry-item {
        background: #3b82f6;
        color: #fff;
        padding: 10px;
        border-radius: 4px;
        font-size: 12px;
      }
      .masonry-item.tall { background: #10b981; }
      .masonry-item.medium { background: #f59e0b; }
      .masonry-item.short { background: #ef4444; }
      /* Masonry 降级：CSS columns */
      .masonry-columns {
        column-count: 3;
        column-gap: 8px;
        max-height: 300px;
      }
      .masonry-columns .masonry-item {
        break-inside: avoid;
        margin-bottom: 8px;
        display: inline-block;
        width: 100%;
      }
      /* ===== Card 7：性能监控输出 ===== */
      .perf-output {
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 4px;
        padding: 8px;
        font-family: monospace;
        font-size: 11px;
        white-space: pre-wrap;
        word-break: break-all;
        margin-top: 8px;
        max-height: 200px;
        overflow-y: auto;
      }
      /* ===== 输出区 ===== */
      .perf-output-main {
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
            return `===== CSS Containment + content-visibility + Masonry 概述 =====\n` +
                `\n` +
                `【规范归属】\n` +
                `  CSS Containment Module Level 1（W3C CR 2020）—— contain 属性\n` +
                `  CSS Containment Module Level 2（W3C WD 2024）—— content-visibility / contain-intrinsic-size\n` +
                `  CSS Grid Layout Module Level 3（W3C WD 2024）—— grid-template-rows: masonry\n` +
                `  规范地址：https://www.w3.org/TR/css-contain-1/ 等\n` +
                `\n` +
                `【现代 Web 性能瓶颈】\n` +
                `  1. DOM 规模爆炸：单页应用 DOM 节点数万+，布局重计算成本高\n` +
                `  2. 长列表渲染卡顿：10000+ 行表格/列表滚动掉帧（60fps → 30fps）\n` +
                `  3. 布局重计算成本：任一元素尺寸变化触发全文档 reflow\n` +
                `  4. 屏外内容浪费：不可见内容仍参与布局/绘制，浪费 CPU/GPU\n` +
                `  5. 瀑布流布局复杂：Pinterest 风格需 JS 计算位置，性能差\n` +
                `\n` +
                `【三大性能型 CSS 标准】\n` +
                `  1. CSS Containment（contain 属性）—— 隔离元素布局/绘制/尺寸影响\n` +
                `     contain: layout / paint / size / style / strict / content / inline-size\n` +
                `     让浏览器跳过 containment 边界外的 reflow/paint\n` +
                `  2. content-visibility —— 跳过屏外内容渲染\n` +
                `     content-visibility: auto（自动跳过屏外）/ hidden（隐藏保留状态）\n` +
                `     配合 contain-intrinsic-size 兜底尺寸，长列表性能数量级提升\n` +
                `  3. Masonry Layout（CSS Grid L3）—— 原生瀑布流\n` +
                `     grid-template-rows: masonry / grid-template-columns: masonry\n` +
                `     原生支持 Pinterest 风格瀑布流，无需 JS\n` +
                `\n` +
                `【能力检测】\n` +
                `  CSS.supports('contain','layout')         = ${f.containLayout}\n` +
                `  CSS.supports('contain','paint')          = ${f.containPaint}\n` +
                `  CSS.supports('contain','size')           = ${f.containSize}\n` +
                `  CSS.supports('contain','strict')         = ${f.containStrict}\n` +
                `  CSS.supports('contain','inline-size')    = ${f.containInlineSize}\n` +
                `  CSS.supports('content-visibility','auto')   = ${f.contentVisibilityAuto}\n` +
                `  CSS.supports('content-visibility','hidden') = ${f.contentVisibilityHidden}\n` +
                `  CSS.supports('contain-intrinsic-size','200px 100px') = ${f.containIntrinsicSize}\n` +
                `  CSS.supports('grid-template-rows','masonry') = ${f.masonry}\n` +
                `  IntersectionObserver 可用                  = ${f.intersectionObserver}\n` +
                `  PerformanceObserver 可用                   = ${f.performanceObserver}\n` +
                `\n` +
                `【浏览器支持】\n` +
                `  contain: layout/paint/size —— Chrome 52+/Firefox 69+/Safari 15.4+（CSS Containment L1）\n` +
                `  contain: inline-size/block-size —— Chrome 105+/Firefox 101+/Safari 17+\n` +
                `  content-visibility: auto/hidden —— Chrome 85+/Firefox 125+/Safari 17+（CSS Containment L2）\n` +
                `  contain-intrinsic-size —— 同上\n` +
                `  grid-template-rows: masonry —— Firefox 默认开启（自 Firefox 70+），\n` +
                `    Chrome/Safari 需实验 flag（enable-experimental-web-platform-features）\n` +
                `  IntersectionObserver —— Chrome 51+/Firefox 55+/Safari 12.1+\n` +
                `  PerformanceObserver —— Chrome 52+/Firefox 57+/Safari 11+\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  /* contain 隔离布局影响 */\n` +
                `  .widget { contain: layout; }\n` +
                `\n` +
                `  /* content-visibility: auto 跳过屏外（长列表性能）*/\n` +
                `  .list-item {\n` +
                `    content-visibility: auto;\n` +
                `    contain-intrinsic-size: 0 44px;  /* 兜底尺寸防滚动条跳变 */\n` +
                `  }\n` +
                `\n` +
                `  /* Masonry 原生瀑布流 */\n` +
                `  .masonry {\n` +
                `    display: grid;\n` +
                `    grid-template-columns: repeat(3, 1fr);\n` +
                `    grid-template-rows: masonry;  /* Firefox 默认支持 */\n` +
                `    gap: 8px;\n` +
                `  }`;
        }
        catch (err) {
            return `读取概述信息失败：${err.name} - ${err.message}`;
        }
    }
    _runOverviewDemo() {
        this.setState({ overviewInfo: this._readOverviewInfo() });
        const f = this._flags();
        this._addLog('overview', `能力检测汇总：contain:layout=${f.containLayout}, content-visibility:auto=${f.contentVisibilityAuto}, masonry=${f.masonry}`);
    }
    _renderCard1() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '1. 概述与动机 —— 现代 Web 性能瓶颈 / 三大性能型 CSS 标准',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['contain:layout', f.containLayout],
                ['content-visibility:auto', f.contentVisibilityAuto],
                ['masonry', f.masonry],
            ]), h(Tag, { color: 'primary' }, 'CSS Containment L1/L2 + Grid L3')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '现代 Web 性能瓶颈：DOM 规模爆炸（单页应用节点数万+）、长列表渲染卡顿（10000+ 行滚动掉帧）、布局重计算成本（任一元素尺寸变化触发全文档 reflow）、屏外内容浪费、瀑布流布局复杂。三大性能型 CSS 标准：1. CSS Containment（contain 属性）隔离元素布局/绘制/尺寸影响，让浏览器跳过 containment 边界外的 reflow/paint；2. content-visibility 跳过屏外内容渲染（auto 自动跳过/hidden 隐藏保留状态），配合 contain-intrinsic-size 长列表性能数量级提升；3. Masonry Layout（CSS Grid L3）原生瀑布流无需 JS。浏览器支持：contain Chrome 52+/Firefox 69+/Safari 15.4+；content-visibility Chrome 85+/Firefox 125+/Safari 17+；Masonry Firefox 默认开启 Chrome/Safari 实验 flag。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取概述信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runOverviewDemo() })),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.overviewInfo || '（点击「读取概述信息」查看三大性能型 CSS 标准全景）')),
                h(Alert, {
                    type: 'info',
                    message: 'contain 隔离布局影响，content-visibility 跳过屏外渲染，Masonry 原生瀑布流',
                    description: '三大标准解决现代 Web 性能瓶颈：contain 让浏览器跳过 containment 边界外 reflow/paint；content-visibility: auto 自动跳过屏外内容渲染（配合 contain-intrinsic-size 兜底尺寸），长列表性能数量级提升；Masonry 原生支持 Pinterest 风格瀑布流无需 JS。jsdom 不做真实渲染但 CSS.supports 可用。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 2：contain 属性全集 ===================
    _readContainInfo() {
        const f = this._flags();
        try {
            const box = this.el && this.el.querySelector('.contain-box.contain-layout');
            let computed = '(未渲染)';
            if (box) {
                computed = window.getComputedStyle(box).getPropertyValue('contain') || '(空)';
            }
            return `===== contain 属性全集 =====\n` +
                `\n` +
                `【语法】\n` +
                `  contain: none | strict | content | [ size || layout || paint || style ]\n` +
                `        | inline-size | block-size\n` +
                `\n` +
                `【取值详解】\n` +
                `  none        —— 无 containment（默认）\n` +
                `  layout      —— 布局隔离：元素创建独立格式化上下文（类似 BFC），\n` +
                `                  内部布局变化不影响外部，外部变化也不影响内部\n` +
                `  paint       —— 绘制隔离：元素内容裁剪到 padding 边界（类似 overflow: hidden），\n` +
                `                  子元素绝对定位不会溢出（适用于浮动徽章、下拉菜单）\n` +
                `  size        —— 尺寸隔离：元素子树尺寸视为 0，\n` +
                `                  即元素尺寸不由内容决定（需显式指定 width/height）\n` +
                `                  ⚠ 危险：若未指定尺寸元素会塌陷为 0\n` +
                `  style       —— 样式隔离：计数器、引号等样式属性不泄漏到外部\n` +
                `                  （较少使用，对性能影响小）\n` +
                `  inline-size —— 行内尺寸隔离（CSS Containment L3，单轴版本）\n` +
                `                  仅隔离 inline 方向尺寸，block 方向由内容决定\n` +
                `                  Chrome 105+/Firefox 101+/Safari 17+\n` +
                `  block-size  —— 块尺寸隔离（CSS Containment L3，单轴版本）\n` +
                `\n` +
                `【组合值】\n` +
                `  strict  —— 等价于 contain: size layout paint style（全部隔离，最强）\n` +
                `              ⚠ size 包含，需显式指定尺寸否则塌陷\n` +
                `  content —— 等价于 contain: layout paint style（不含 size，较安全）\n` +
                `              推荐用于不确定尺寸的元素\n` +
                `\n` +
                `【layout containment 创建独立格式化上下文】\n` +
                `  类似 BFC（Block Formatting Context）但更强：\n` +
                `    内部 float 不会影响外部布局\n` +
                `    外部 margin 不会穿透到内部\n` +
                `    内部布局变化不触发外部 reflow\n` +
                `  适用于：第三方组件隔离、广告容器、动态内容区\n` +
                `\n` +
                `【paint containment 创建 clipping】\n` +
                `  元素内容裁剪到 padding 边界：\n` +
                `    子元素绝对定位不会溢出（防止浮动徽章/下拉菜单覆盖外部）\n` +
                `    自动创建 stacking context（层叠上下文）\n` +
                `    自动创建 containing block（包含块）用于绝对定位\n` +
                `  适用于：固定尺寸卡片、对话框、工具提示\n` +
                `\n` +
                `【size containment 子树尺寸视为 0】\n` +
                `  元素尺寸不由内容决定，需显式指定 width/height\n` +
                `  浏览器跳过子树布局计算（性能提升最大）\n` +
                `  ⚠ 若未指定尺寸元素塌陷为 0，破坏布局\n` +
                `  通常与 layout/paint 组合（contain: size layout paint = strict）\n` +
                `\n` +
                `【当前演示元素】\n` +
                `  .contain-layout { contain: ${this._containMode}; }\n` +
                `    contain 计算值="${computed}"\n` +
                `  CSS.supports 检测：\n` +
                `    contain:layout      = ${f.containLayout}\n` +
                `    contain:paint       = ${f.containPaint}\n` +
                `    contain:size        = ${f.containSize}\n` +
                `    contain:style       = ${f.containStyle}\n` +
                `    contain:strict      = ${f.containStrict}\n` +
                `    contain:content     = ${f.containContent}\n` +
                `    contain:inline-size = ${f.containInlineSize}\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  /* 第三方组件隔离（推荐 content，不含 size 安全）*/\n` +
                `  .ad-container { contain: content; }\n` +
                `\n` +
                `  /* 固定尺寸卡片（strict 最强隔离）*/\n` +
                `  .card {\n` +
                `    contain: strict;  /* = size layout paint style */\n` +
                `    width: 300px;     /* 必须指定，否则 size 塌陷 */\n` +
                `    height: 200px;\n` +
                `  }\n` +
                `\n` +
                `  /* 浮动徽章防溢出（paint）*/\n` +
                `  .badge-container { contain: paint; }\n` +
                `\n` +
                `  /* 单轴隔离（inline-size，block 方向由内容决定）*/\n` +
                `  .sidebar { contain: inline-size; }`;
        }
        catch (err) {
            return `读取 contain 信息失败：${err.name} - ${err.message}`;
        }
    }
    _setContainMode(mode) {
        this._containMode = mode;
        this._injectStyle('css-contain-mode-dynamic', `.contain-box.dynamic { contain: ${mode}; }`);
        this.setState({ containInfo: this._readContainInfo() });
        const desc = {
            none: '无 containment',
            layout: '布局隔离（独立格式化上下文）',
            paint: '绘制隔离（clipping + stacking context）',
            size: '尺寸隔离（子树尺寸视为 0，需显式尺寸）',
            style: '样式隔离（计数器/引号不泄漏）',
            strict: 'strict = size layout paint style（最强，需显式尺寸）',
            content: 'content = layout paint style（不含 size，较安全）',
            'inline-size': 'inline-size 单轴隔离（CSS Containment L3）',
        }[mode];
        this._addLog('contain', `切换 contain → ${mode}（${desc}）`);
    }
    _renderCard2() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '2. contain 属性全集 —— layout / paint / size / strict / inline-size',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['layout', f.containLayout],
                ['paint', f.containPaint],
                ['size', f.containSize],
                ['inline-size', f.containInlineSize],
            ]), h(Tag, { color: 'primary' }, 'CSS Containment L1/L2/L3')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'contain 属性全集：layout（布局隔离创建独立格式化上下文，内部布局变化不影响外部）、paint（绘制隔离裁剪到 padding 边界 + 自动 stacking context + containing block，防止子元素溢出）、size（尺寸隔离子树尺寸视为 0，浏览器跳过子树布局性能提升最大，但未指定尺寸会塌陷）、style（样式隔离计数器/引号不泄漏）、inline-size/block-size（CSS Containment L3 单轴隔离，Chrome 105+/Firefox 101+/Safari 17+）。组合值：strict = size layout paint style（最强，需显式尺寸）；content = layout paint style（不含 size 较安全，推荐不确定尺寸元素）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ containInfo: this._readContainInfo() }) }), this._btn('none', { size: 'sm', onClick: () => this._setContainMode('none') }), this._btn('layout', { size: 'sm', disabled: !f.containLayout, onClick: () => this._setContainMode('layout') }), this._btn('paint', { size: 'sm', disabled: !f.containPaint, onClick: () => this._setContainMode('paint') }), this._btn('size', { size: 'sm', disabled: !f.containSize, onClick: () => this._setContainMode('size') }), this._btn('style', { size: 'sm', disabled: !f.containStyle, onClick: () => this._setContainMode('style') }), this._btn('strict', { size: 'sm', disabled: !f.containStrict, onClick: () => this._setContainMode('strict') }), this._btn('content', { size: 'sm', disabled: !f.containContent, onClick: () => this._setContainMode('content') }), this._btn('inline-size', { size: 'sm', disabled: !f.containInlineSize, onClick: () => this._setContainMode('inline-size') })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, 'contain 演示元素（当前 contain: ' + this._containMode + '）：'),
                h('div', { class: 'contain-box dynamic' }, 'contain: ' + this._containMode + '\n（jsdom 不做真实布局，但 DOM 与样式正确）\n真实浏览器可观察隔离效果'),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.containInfo || '（点击按钮切换 contain 取值查看完整说明）')),
                h(Alert, {
                    type: 'warning',
                    message: 'contain: size / strict 需显式指定尺寸，否则元素塌陷为 0',
                    description: 'size containment 子树尺寸视为 0，浏览器跳过子树布局（性能提升最大），但未指定 width/height 元素塌陷破坏布局。推荐：不确定尺寸用 contain: content（不含 size 安全）；固定尺寸用 contain: strict（最强隔离）。paint 自动创建 stacking context + containing block 防子元素溢出。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 3：content-visibility: auto ===================
    _readContentVisibilityAutoInfo() {
        const f = this._flags();
        try {
            const item = this.el && this.el.querySelector('.cv-item.cv-auto');
            let computed = '(未渲染)';
            if (item) {
                computed = window.getComputedStyle(item).getPropertyValue('content-visibility') || '(空)';
            }
            return `===== content-visibility: auto 跳过屏外渲染 =====\n` +
                `\n` +
                `【作用】\n` +
                `  content-visibility: auto 让浏览器自动跳过屏外内容的渲染（布局/绘制/合成）\n` +
                `  屏外元素保留在 DOM 但不参与渲染，滚动到可见时才渲染\n` +
                `  长列表（10000+ 行）性能数量级提升（首屏渲染时间减少 50-90%）\n` +
                `\n` +
                `【与 IntersectionObserver 等价】\n` +
                `  IntersectionObserver 可监听元素进入视口，手动跳过/渲染\n` +
                `  content-visibility: auto 由浏览器自动处理，无需 JS\n` +
                `  优势：原生性能更好，无 JS 开销，浏览器优化更彻底\n` +
                `  劣势：无法自定义渲染逻辑（如懒加载图片需配合 IntersectionObserver）\n` +
                `\n` +
                `【contain-intrinsic-size 兜底尺寸】\n` +
                `  content-visibility: auto 跳过渲染时元素尺寸为 0，导致滚动条跳变\n` +
                `  contain-intrinsic-size 提供兜底尺寸（如 0 44px）维持滚动条稳定\n` +
                `  浏览器记录最后已知尺寸（auto 200px 100px），更精确\n` +
                `\n` +
                `【长列表性能提升】\n` +
                `  10000 行表格无 content-visibility：首屏渲染 2000ms+，滚动掉帧\n` +
                `  加 content-visibility: auto + contain-intrinsic-size：首屏 200ms，滚动流畅\n` +
                `  浏览器仅渲染可见区域（约 20-50 行），屏外 9950+ 行跳过\n` +
                `\n` +
                `【滚动条跳变修复】\n` +
                `  无 contain-intrinsic-size：屏外元素尺寸 0，滚动到时尺寸变化导致跳变\n` +
                `  有 contain-intrinsic-size：屏外元素维持兜底尺寸，滚动条稳定\n` +
                `  推荐：contain-intrinsic-size: auto 0 44px（auto 记录最后已知尺寸）\n` +
                `\n` +
                `【当前演示元素】\n` +
                `  .cv-item.cv-auto { content-visibility: ${this._cvAutoMode === 'on' ? 'auto' : 'visible'}; contain-intrinsic-size: 0 44px; }\n` +
                `    content-visibility 计算值="${computed}"\n` +
                `  CSS.supports('content-visibility','auto') = ${f.contentVisibilityAuto}\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  /* 长列表每项跳过屏外渲染 */\n` +
                `  .list-item {\n` +
                `    content-visibility: auto;\n` +
                `    contain-intrinsic-size: auto 0 44px;  /* 兜底尺寸 + 记录最后已知 */\n` +
                `  }\n` +
                `\n` +
                `  /* 10000 行表格优化 */\n` +
                `  table.tbody-tr {\n` +
                `    content-visibility: auto;\n` +
                `    contain-intrinsic-size: auto 0 36px;\n` +
                `  }\n` +
                `\n` +
                `  /* 长文档章节优化 */\n` +
                `  article section {\n` +
                `    content-visibility: auto;\n` +
                `    contain-intrinsic-size: auto 0 500px;  /* 章节兜底高度 */\n` +
                `  }`;
        }
        catch (err) {
            return `读取 content-visibility: auto 信息失败：${err.name} - ${err.message}`;
        }
    }
    _setCvAutoMode(mode) {
        this._cvAutoMode = mode;
        const val = mode === 'on' ? 'auto' : 'visible';
        this._injectStyle('css-cv-auto-dynamic', `.cv-item.cv-auto { content-visibility: ${val}; }`);
        this.setState({ contentVisibilityAutoInfo: this._readContentVisibilityAutoInfo() });
        this._addLog('cv-auto', `切换 content-visibility: auto → ${val}（${mode === 'on' ? '跳过屏外渲染' : '正常渲染'}）`);
    }
    _renderCard3() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '3. content-visibility: auto —— 跳过屏外渲染 / 长列表性能',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['content-visibility:auto', f.contentVisibilityAuto]]), h(Tag, { color: 'primary' }, 'CSS Containment L2')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'content-visibility: auto 让浏览器自动跳过屏外内容渲染（布局/绘制/合成），屏外元素保留 DOM 但不参与渲染，滚动到可见时才渲染。长列表（10000+ 行）性能数量级提升（首屏渲染时间减少 50-90%）。与 IntersectionObserver 等价但浏览器自动处理无 JS 开销。配合 contain-intrinsic-size 兜底尺寸防滚动条跳变（屏外元素尺寸为 0 导致跳变，兜底尺寸维持稳定）。浏览器记录最后已知尺寸（auto 200px 100px）更精确。浏览器支持：Chrome 85+/Firefox 125+/Safari 17+。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ contentVisibilityAutoInfo: this._readContentVisibilityAutoInfo() }) }), this._btn('auto 开', { type: 'primary', size: 'sm', disabled: !f.contentVisibilityAuto, onClick: () => this._setCvAutoMode('on') }), this._btn('visible 关', { size: 'sm', onClick: () => this._setCvAutoMode('off') })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '长列表演示（content-visibility: auto 跳过屏外，滚动可见时渲染）：'),
                h('div', { class: 'cv-list' }, Array.from({ length: 20 }, (_, i) => h('div', { class: 'cv-item ' + (this._cvAutoMode === 'on' ? 'cv-auto' : 'cv-visible') }, `第 ${i + 1} 行 · content-visibility: ${this._cvAutoMode === 'on' ? 'auto' : 'visible'} · contain-intrinsic-size: 0 44px`))),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.contentVisibilityAutoInfo || '（点击按钮切换 content-visibility: auto 查看说明）')),
                h(Alert, {
                    type: 'info',
                    message: 'content-visibility: auto 长列表性能数量级提升（首屏减少 50-90%）',
                    description: '与 IntersectionObserver 等价但浏览器自动处理无 JS 开销。配合 contain-intrinsic-size 兜底尺寸防滚动条跳变（屏外元素尺寸 0 导致跳变）。推荐 contain-intrinsic-size: auto 0 44px（auto 记录最后已知尺寸更精确）。浏览器仅渲染可见区域，屏外 9950+ 行跳过。Chrome 85+/Firefox 125+/Safari 17+。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 4：content-visibility: hidden ===================
    _readContentVisibilityHiddenInfo() {
        const f = this._flags();
        try {
            const box = this.el && this.el.querySelector('.cv-hidden-box.cv-hidden');
            let computed = '(未渲染)';
            if (box) {
                computed = window.getComputedStyle(box).getPropertyValue('content-visibility') || '(空)';
            }
            return `===== content-visibility: hidden 完全隐藏但保留渲染状态 =====\n` +
                `\n` +
                `【作用】\n` +
                `  content-visibility: hidden 完全隐藏元素（不渲染、不绘制、不参与布局）\n` +
                `  但保留渲染状态（如滚动位置、表单输入、CSS 动画进度）\n` +
                `  切换回 visible 时恢复状态，无需重建\n` +
                `\n` +
                `【vs display: none（不保留状态）】\n` +
                `  display: none：\n` +
                `    元素从渲染树移除，不参与布局\n` +
                `    子元素状态丢失（滚动位置重置、表单清空、动画重置）\n` +
                `    切换回 display: block 需重建渲染树（性能开销）\n` +
                `  content-visibility: hidden：\n` +
                `    元素不渲染但保留状态\n` +
                `    切换回 visible 时恢复状态（滚动位置/表单/动画进度保留）\n` +
                `    性能更好（无需重建渲染树）\n` +
                `\n` +
                `【vs visibility: hidden】\n` +
                `  visibility: hidden：\n` +
                `    元素不可见但仍参与布局（占据空间）\n` +
                `    子元素可单独设 visibility: visible 显示\n` +
                `    CSS 动画继续运行（即使不可见）\n` +
                `  content-visibility: hidden：\n` +
                `    元素不参与布局（不占据空间，类似 display: none）\n` +
                `    子元素无法单独显示（整体隐藏）\n` +
                `    CSS 动画暂停（节省 CPU）\n` +
                `\n` +
                `【暂停 CSS 动画与定时器】\n` +
                `  content-visibility: hidden 暂停元素内的 CSS 动画/过渡\n` +
                `  切换回 visible 时从暂停位置继续（不重置）\n` +
                `  节省 CPU/GPU 资源（适用于隐藏标签页、折叠面板）\n` +
                `  ⚠ JS 定时器（setTimeout/setInterval）不暂停，需手动管理\n` +
                `\n` +
                `【配合 IntersectionObserver 主动控制】\n` +
                `  // 标签页切换：屏外标签 content-visibility: hidden\n` +
                `  const io = new IntersectionObserver((entries) => {\n` +
                `    entries.forEach(e => {\n` +
                `      e.target.style.contentVisibility = e.isIntersecting ? 'visible' : 'hidden';\n` +
                `    });\n` +
                `  });\n` +
                `  document.querySelectorAll('.tab-panel').forEach(p => io.observe(p));\n` +
                `\n` +
                `【当前演示元素】\n` +
                `  .cv-hidden-box.cv-hidden { content-visibility: hidden; }\n` +
                `    content-visibility 计算值="${computed}"\n` +
                `  当前模式: ${this._cvHiddenMode}\n` +
                `  CSS.supports('content-visibility','hidden') = ${f.contentVisibilityHidden}\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  /* 标签页面板：屏外隐藏保留状态 */\n` +
                `  .tab-panel {\n` +
                `    content-visibility: hidden;\n` +
                `    contain-intrinsic-size: 0 500px;  /* 兜底尺寸 */\n` +
                `  }\n` +
                `  .tab-panel.active {\n` +
                `    content-visibility: visible;\n` +
                `  }\n` +
                `\n` +
                `  /* 折叠面板：折叠时隐藏保留滚动位置 */\n` +
                `  .accordion-content {\n` +
                `    content-visibility: hidden;\n` +
                `    contain-intrinsic-size: 0 300px;\n` +
                `  }\n` +
                `  .accordion.open .accordion-content {\n` +
                `    content-visibility: visible;\n` +
                `  }\n` +
                `\n` +
                `  /* 配合 IntersectionObserver 主动控制 */\n` +
                `  const io = new IntersectionObserver((entries) => {\n` +
                `    entries.forEach(e => {\n` +
                `      e.target.style.contentVisibility = e.isIntersecting ? 'visible' : 'hidden';\n` +
                `    });\n` +
                `  });\n` +
                `  document.querySelectorAll('.lazy-panel').forEach(p => io.observe(p));`;
        }
        catch (err) {
            return `读取 content-visibility: hidden 信息失败：${err.name} - ${err.message}`;
        }
    }
    _setCvHiddenMode(mode) {
        this._cvHiddenMode = mode;
        const val = mode === 'on' ? 'hidden' : 'visible';
        this._injectStyle('css-cv-hidden-dynamic', `.cv-hidden-box.dynamic { content-visibility: ${val}; }`);
        this.setState({ contentVisibilityHiddenInfo: this._readContentVisibilityHiddenInfo() });
        this._addLog('cv-hidden', `切换 content-visibility: hidden → ${val}（${mode === 'on' ? '隐藏保留状态' : '正常显示'}）`);
    }
    _renderCard4() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '4. content-visibility: hidden —— 完全隐藏但保留渲染状态',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['content-visibility:hidden', f.contentVisibilityHidden]]), h(Tag, { color: 'primary' }, 'vs display:none / visibility:hidden')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'content-visibility: hidden 完全隐藏元素（不渲染/不绘制/不参与布局）但保留渲染状态（滚动位置/表单输入/CSS 动画进度），切换回 visible 时恢复状态无需重建。vs display: none（不保留状态，子元素状态丢失，切换需重建渲染树）；vs visibility: hidden（仍参与布局占空间，子元素可单独 visible，CSS 动画继续运行）。content-visibility: hidden 暂停 CSS 动画/过渡节省 CPU，切换回时从暂停位置继续。配合 IntersectionObserver 主动控制标签页/折叠面板。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ contentVisibilityHiddenInfo: this._readContentVisibilityHiddenInfo() }) }), this._btn('hidden 开', { type: 'primary', size: 'sm', disabled: !f.contentVisibilityHidden, onClick: () => this._setCvHiddenMode('on') }), this._btn('visible 关', { size: 'sm', onClick: () => this._setCvHiddenMode('off') })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '三种隐藏方式对比（content-visibility:hidden / display:none / visibility:hidden）：'),
                h('div', { class: 'cv-hidden-stage' }, h('div', { class: 'cv-hidden-box dynamic' }, 'content-visibility: ' + (this._cvHiddenMode === 'on' ? 'hidden' : 'visible') + '\n保留渲染状态'), h('div', { class: 'cv-hidden-box cv-display-none' }, 'display: none\n不保留状态（不可见）'), h('div', { class: 'cv-hidden-box cv-visibility-hidden' }, 'visibility: hidden\n保留布局占空间'), h('div', { class: 'cv-hidden-box' }, '正常显示（对照）')),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.contentVisibilityHiddenInfo || '（点击按钮切换 content-visibility: hidden 查看说明）')),
                h(Alert, {
                    type: 'info',
                    message: 'content-visibility: hidden 保留渲染状态，切换回 visible 无需重建',
                    description: 'vs display: none（不保留状态，切换需重建渲染树）；vs visibility: hidden（仍占空间，动画继续运行）。content-visibility: hidden 暂停 CSS 动画节省 CPU，切换回时从暂停位置继续。配合 IntersectionObserver 主动控制标签页/折叠面板，屏外隐藏保留滚动位置/表单输入。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 5：contain-intrinsic-size ===================
    _readIntrinsicSizeInfo() {
        const f = this._flags();
        try {
            const box = this.el && this.el.querySelector('.intrinsic-box.intrinsic-fixed');
            let computed = '(未渲染)';
            if (box) {
                computed = window.getComputedStyle(box).getPropertyValue('contain-intrinsic-size') || '(空)';
            }
            return `===== contain-intrinsic-size 与尺寸提示 =====\n` +
                `\n` +
                `【语法】\n` +
                `  contain-intrinsic-size: <width>? <height>? | auto <width>? <height>?\n` +
                `  示例：\n` +
                `    contain-intrinsic-size: 200px 100px;        /* 固定宽高 */\n` +
                `    contain-intrinsic-size: auto 200px 100px;   /* auto + 固定宽高 */\n` +
                `    contain-intrinsic-size: 200px;              /* 仅宽（高 auto）*/\n` +
                `    contain-intrinsic-size: auto 0 44px;        /* 长列表常用 */\n` +
                `\n` +
                `【固定尺寸 vs auto 记录】\n` +
                `  固定尺寸（contain-intrinsic-size: 200px 100px）：\n` +
                `    屏外元素始终用 200px×100px 占位\n` +
                `    简单但可能与实际尺寸不符（滚动条跳变）\n` +
                `  auto 记录（contain-intrinsic-size: auto 200px 100px）：\n` +
                `    浏览器记录元素最后已知尺寸，下次屏外时用记录值\n` +
                `    更精确，滚动条跳变更少\n` +
                `    首次渲染前用 200px×100px 兜底\n` +
                `\n` +
                `【单轴尺寸】\n` +
                `  contain-intrinsic-size: 200px;       /* 仅 width，height auto */\n` +
                `  contain-intrinsic-size: auto 200px;  /* auto + width，height auto */\n` +
                `  适用于仅需固定一个方向的场景（如长列表固定行高，宽度自适应）\n` +
                `\n` +
                `【浏览器记录最后已知尺寸】\n` +
                `  auto 关键字让浏览器记录元素最后已知尺寸\n` +
                `  元素首次渲染后，浏览器存储其尺寸\n` +
                `  元素进入屏外时（content-visibility: auto），用记录尺寸占位\n` +
                `  元素再次进入视口时，重新渲染并更新记录尺寸\n` +
                `  这样滚动条跳变最小化\n` +
                `\n` +
                `【content-visibility: auto 必备】\n` +
                `  content-visibility: auto 跳过屏外渲染时元素尺寸为 0\n` +
                `  若无 contain-intrinsic-size，滚动条会跳变（屏外元素高度 0）\n` +
                `  contain-intrinsic-size 提供兜底尺寸，维持滚动条稳定\n` +
                `  推荐组合：\n` +
                `    .item {\n` +
                `      content-visibility: auto;\n` +
                `      contain-intrinsic-size: auto 0 44px;  /* auto 记录 + 兜底 */\n` +
                `    }\n` +
                `\n` +
                `【当前演示元素】\n` +
                `  .intrinsic-fixed { contain-intrinsic-size: 200px 100px; }\n` +
                `    contain-intrinsic-size 计算值="${computed}"\n` +
                `  当前模式: ${this._intrinsicMode}\n` +
                `  CSS.supports('contain-intrinsic-size','200px 100px')      = ${f.containIntrinsicSize}\n` +
                `  CSS.supports('contain-intrinsic-size','auto 200px 100px') = ${f.containIntrinsicSizeAuto}\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  /* 长列表行（固定行高 44px）*/\n` +
                `  .list-row {\n` +
                `    content-visibility: auto;\n` +
                `    contain-intrinsic-size: auto 0 44px;\n` +
                `  }\n` +
                `\n` +
                `  /* 卡片网格（固定卡片尺寸）*/\n` +
                `  .card {\n` +
                `    content-visibility: auto;\n` +
                `    contain-intrinsic-size: auto 280px 200px;\n` +
                `  }\n` +
                `\n` +
                `  /* 长文档章节（仅固定高度，宽度自适应）*/\n` +
                `  article section {\n` +
                `    content-visibility: auto;\n` +
                `    contain-intrinsic-size: auto 0 500px;\n` +
                `  }\n` +
                `\n` +
                `  /* 表格行（固定行高）*/\n` +
                `  tr {\n` +
                `    content-visibility: auto;\n` +
                `    contain-intrinsic-size: auto 0 36px;\n` +
                `  }`;
        }
        catch (err) {
            return `读取 contain-intrinsic-size 信息失败：${err.name} - ${err.message}`;
        }
    }
    _setIntrinsicMode(mode) {
        this._intrinsicMode = mode;
        const map = {
            fixed: '.intrinsic-box.dynamic { contain-intrinsic-size: 200px 100px; }',
            auto: '.intrinsic-box.dynamic { contain-intrinsic-size: auto 200px 100px; }',
            single: '.intrinsic-box.dynamic { contain-intrinsic-size: 200px; }',
            none: '.intrinsic-box.dynamic { contain-intrinsic-size: none; }',
        };
        this._injectStyle('css-intrinsic-dynamic', (map[mode]) || map.fixed);
        this.setState({ intrinsicSizeInfo: this._readIntrinsicSizeInfo() });
        this._addLog('intrinsic', `切换 contain-intrinsic-size 模式 → ${mode}`);
    }
    _renderCard5() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '5. contain-intrinsic-size —— 兜底尺寸 / auto 记录最后已知',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['contain-intrinsic-size', f.containIntrinsicSize]]), h(Tag, { color: 'primary' }, 'content-visibility 必备')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'contain-intrinsic-size 为 content-visibility: auto 跳过渲染的元素提供兜底尺寸，防滚动条跳变。语法：contain-intrinsic-size: 200px 100px（固定宽高）/ auto 200px 100px（auto + 固定宽高）/ 200px（仅宽，高 auto）。固定尺寸简单但可能与实际不符；auto 记录浏览器存储元素最后已知尺寸，下次屏外用记录值更精确，首次渲染前用兜底值。单轴尺寸适用于仅需固定一个方向（如长列表固定行高宽度自适应）。content-visibility: auto 必备：无 contain-intrinsic-size 屏外元素尺寸 0 导致滚动条跳变。推荐组合 content-visibility: auto + contain-intrinsic-size: auto 0 44px。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ intrinsicSizeInfo: this._readIntrinsicSizeInfo() }) }), this._btn('固定 200×100', { size: 'sm', disabled: !f.containIntrinsicSize, onClick: () => this._setIntrinsicMode('fixed') }), this._btn('auto 200×100', { size: 'sm', disabled: !f.containIntrinsicSizeAuto, onClick: () => this._setIntrinsicMode('auto') }), this._btn('单轴 200px', { size: 'sm', disabled: !f.containIntrinsicSize, onClick: () => this._setIntrinsicMode('single') }), this._btn('none', { size: 'sm', onClick: () => this._setIntrinsicMode('none') })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, 'contain-intrinsic-size 演示（当前模式: ' + this._intrinsicMode + '）：'),
                h('div', { class: 'intrinsic-stage' }, h('div', { class: 'intrinsic-box dynamic' }, 'contain-intrinsic-size: ' + this._intrinsicMode + '\n（jsdom 不做真实布局，真实浏览器可见尺寸占位）')),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.intrinsicSizeInfo || '（点击按钮切换 contain-intrinsic-size 模式查看说明）')),
                h(Alert, {
                    type: 'info',
                    message: 'contain-intrinsic-size: auto 记录最后已知尺寸，滚动条跳变最小化',
                    description: 'content-visibility: auto 必备：屏外元素尺寸 0 导致跳变，contain-intrinsic-size 提供兜底。固定尺寸简单但可能不符；auto 记录浏览器存储最后已知尺寸更精确。推荐组合 content-visibility: auto + contain-intrinsic-size: auto 0 44px（长列表行高）。单轴尺寸适用仅固定一个方向场景。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 6：Masonry Layout ===================
    _readMasonryInfo() {
        const f = this._flags();
        try {
            const grid = this.el && this.el.querySelector('.masonry-grid');
            let computed = '(未渲染)';
            if (grid) {
                computed = window.getComputedStyle(grid).getPropertyValue('grid-template-rows') || '(空)';
            }
            return `===== Masonry Layout（CSS Grid L3）原生瀑布流 =====\n` +
                `\n` +
                `【语法】\n` +
                `  grid-template-rows: masonry;       /* 行方向瀑布流（垂直排列）*/\n` +
                `  grid-template-columns: masonry;    /* 列方向瀑布流（水平排列）*/\n` +
                `  masonry-auto-flow: pack | next;    /* 排列策略 */\n` +
                `  align-tracks / justify-tracks;     /* 多轨道对齐 */\n` +
                `\n` +
                `【grid-template-rows: masonry】\n` +
                `  .masonry {\n` +
                `    display: grid;\n` +
                `    grid-template-columns: repeat(3, 1fr);  /* 3 列 */\n` +
                `    grid-template-rows: masonry;             /* 行方向瀑布流 */\n` +
                `    gap: 8px;\n` +
                `  }\n` +
                `  元素按列排列，每列高度独立，自动填充最短列（Pinterest 风格）\n` +
                `\n` +
                `【masonry-auto-flow: pack vs next】\n` +
                `  pack（默认）：新元素放入最短列（紧凑，减少空隙）\n` +
                `  next：新元素按顺序放入下一列（有序，但空隙多）\n` +
                `  .masonry { masonry-auto-flow: pack; }  /* 紧凑 */\n` +
                `\n` +
                `【与 Pinterest 瀑布流】\n` +
                `  Pinterest 风格瀑布流：不等高卡片按列排列，自动填充最短列\n` +
                `  传统方案：JS 计算每列高度，手动定位（性能差，复杂）\n` +
                `  CSS columns 方案：column-count + break-inside: avoid（顺序按列填充，非最短列）\n` +
                `  Masonry 原生方案：grid-template-rows: masonry（浏览器自动最短列填充）\n` +
                `\n` +
                `【align-tracks / justify-tracks】\n` +
                `  align-tracks: 多轨道垂直对齐（如 start, end, center, space-between）\n` +
                `  justify-tracks: 多轨道水平对齐\n` +
                `  适用于 Masonry 多轨道对齐控制\n` +
                `\n` +
                `【浏览器支持】\n` +
                `  Firefox：默认开启（自 Firefox 70+，2019 年）\n` +
                `  Chrome：实验 flag（enable-experimental-web-platform-features）\n` +
                `  Safari：实验 flag\n` +
                `  生产环境需降级（CSS columns + JS）\n` +
                `\n` +
                `【当前演示元素】\n` +
                `  .masonry-grid { grid-template-rows: masonry; }\n` +
                `    grid-template-rows 计算值="${computed}"\n` +
                `  当前模式: ${this._masonryMode}\n` +
                `  CSS.supports('grid-template-rows','masonry')    = ${f.masonry}\n` +
                `  CSS.supports('grid-template-columns','masonry') = ${f.masonryCols}\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  /* 原生 Masonry（Firefox 默认支持）*/\n` +
                `  .masonry {\n` +
                `    display: grid;\n` +
                `    grid-template-columns: repeat(3, 1fr);\n` +
                `    grid-template-rows: masonry;\n` +
                `    gap: 8px;\n` +
                `    masonry-auto-flow: pack;  /* 紧凑排列 */\n` +
                `  }\n` +
                `\n` +
                `  /* 降级方案 1：CSS columns（顺序按列填充）*/\n` +
                `  .masonry-fallback-columns {\n` +
                `    column-count: 3;\n` +
                `    column-gap: 8px;\n` +
                `  }\n` +
                `  .masonry-fallback-columns .item {\n` +
                `    break-inside: avoid;  /* 防止分栏断开 */\n` +
                `    margin-bottom: 8px;\n` +
                `  }\n` +
                `\n` +
                `  /* 降级方案 2：JS 计算最短列（最接近原生）*/\n` +
                `  function layoutMasonry(container, cols = 3) {\n` +
                `    const items = [...container.children];\n` +
                `    const colHeights = new Array(cols).fill(0);\n` +
                `    items.forEach(item => {\n` +
                `      const shortest = colHeights.indexOf(Math.min(...colHeights));\n` +
                `      item.style.gridColumn = shortest + 1;\n` +
                `      colHeights[shortest] += item.offsetHeight + 8;\n` +
                `    });\n` +
                `  }\n` +
                `\n` +
                `  /* @supports 检测 + 降级 */\n` +
                `  .masonry-fallback { column-count: 3; column-gap: 8px; }\n` +
                `  .masonry-fallback .item { break-inside: avoid; margin-bottom: 8px; }\n` +
                `  @supports (grid-template-rows: masonry) {\n` +
                `    .masonry-fallback {\n` +
                `      column-count: auto;\n` +
                `      display: grid;\n` +
                `      grid-template-columns: repeat(3, 1fr);\n` +
                `      grid-template-rows: masonry;\n` +
                `      gap: 8px;\n` +
                `    }\n` +
                `  }`;
        }
        catch (err) {
            return `读取 Masonry 信息失败：${err.name} - ${err.message}`;
        }
    }
    _setMasonryMode(mode) {
        this._masonryMode = mode;
        const map = {
            rows: `.masonry-grid.dynamic { grid-template-rows: masonry; }`,
            columns: `.masonry-grid.dynamic { grid-template-columns: masonry; }`,
            pack: `.masonry-grid.dynamic { grid-template-rows: masonry; masonry-auto-flow: pack; }`,
            next: `.masonry-grid.dynamic { grid-template-rows: masonry; masonry-auto-flow: next; }`,
        };
        this._injectStyle('css-masonry-dynamic', (map[mode]) || map.rows);
        this.setState({ masonryInfo: this._readMasonryInfo() });
        this._addLog('masonry', `切换 Masonry 模式 → ${mode}（Firefox 默认支持，Chrome/Safari 需实验 flag）`);
    }
    _renderCard6() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '6. Masonry Layout（CSS Grid L3）—— 原生 Pinterest 瀑布流',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['masonry', f.masonry]]), h(Tag, { color: 'primary' }, 'CSS Grid L3')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'Masonry Layout（CSS Grid L3）原生支持 Pinterest 风格瀑布流：grid-template-rows: masonry（行方向瀑布流，元素按列排列自动填充最短列）/ grid-template-columns: masonry（列方向）。masonry-auto-flow: pack（默认，紧凑减少空隙）/ next（有序空隙多）。align-tracks/justify-tracks 多轨道对齐。vs 传统方案：JS 计算最短列（性能差复杂）/ CSS columns（顺序按列填充非最短列）。浏览器支持：Firefox 默认开启（自 70+），Chrome/Safari 实验 flag。生产需降级：CSS columns + break-inside: avoid 或 JS 计算最短列，@supports 检测 + 降级。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ masonryInfo: this._readMasonryInfo() }) }), this._btn('rows: masonry', { size: 'sm', disabled: !f.masonry, onClick: () => this._setMasonryMode('rows') }), this._btn('columns: masonry', { size: 'sm', disabled: !f.masonryCols, onClick: () => this._setMasonryMode('columns') }), this._btn('pack', { size: 'sm', disabled: !f.masonry, onClick: () => this._setMasonryMode('pack') }), this._btn('next', { size: 'sm', disabled: !f.masonry, onClick: () => this._setMasonryMode('next') })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, 'Masonry 瀑布流演示（Firefox 默认支持，Chrome/Safari 需实验 flag）：'),
                h('div', { class: 'masonry-stage' }, h('div', { class: 'masonry-grid' }, h('div', { class: 'masonry-item short' }, '短卡片 1'), h('div', { class: 'masonry-item tall' }, '高卡片 1\n\n\n\n内容较多' + this._masonryMode), h('div', { class: 'masonry-item medium' }, '中卡片 1\n\n内容'), h('div', { class: 'masonry-item short' }, '短卡片 2'), h('div', { class: 'masonry-item tall' }, '高卡片 2\n\n\n\n\n\n内容更多'), h('div', { class: 'masonry-item medium' }, '中卡片 2\n\n内容'), h('div', { class: 'masonry-item short' }, '短卡片 3'), h('div', { class: 'masonry-item tall' }, '高卡片 3\n\n\n\n内容'), h('div', { class: 'masonry-item short' }, '短卡片 4'))),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '降级方案：CSS columns（顺序按列填充，非最短列）：'),
                h('div', { class: 'masonry-stage' }, h('div', { class: 'masonry-columns' }, h('div', { class: 'masonry-item short' }, '短卡片 1'), h('div', { class: 'masonry-item tall' }, '高卡片 1\n\n\n\n内容较多'), h('div', { class: 'masonry-item medium' }, '中卡片 1\n\n内容'), h('div', { class: 'masonry-item short' }, '短卡片 2'), h('div', { class: 'masonry-item tall' }, '高卡片 2\n\n\n\n\n\n内容更多'), h('div', { class: 'masonry-item medium' }, '中卡片 2\n\n内容'))),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.masonryInfo || '（点击按钮切换 Masonry 模式查看说明）')),
                h(Alert, {
                    type: 'warning',
                    message: 'Masonry 仅 Firefox 默认支持，Chrome/Safari 需实验 flag，生产需降级',
                    description: 'Firefox 自 70+ 默认开启 Masonry。Chrome/Safari 需 enable-experimental-web-platform-features flag。降级方案：CSS columns + break-inside: avoid（顺序按列填充非最短列）或 JS 计算最短列（最接近原生）。@supports (grid-template-rows: masonry) 检测 + 降级。masonry-auto-flow: pack 紧凑排列减少空隙。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 7：性能监控与验证 ===================
    _readPerfMonitorInfo() {
        const f = this._flags();
        try {
            return `===== 性能监控与验证 =====\n` +
                `\n` +
                `【Performance API 测量 Layout/Paint 耗时】\n` +
                `  // 测量布局耗时\n` +
                `  performance.mark('layout-start');\n` +
                `  element.style.width = '500px';  // 触发 reflow\n` +
                `  performance.mark('layout-end');\n` +
                `  performance.measure('layout', 'layout-start', 'layout-end');\n` +
                `  const measure = performance.getEntriesByName('layout')[0];\n` +
                `  console.log('Layout 耗时：', measure.duration, 'ms');\n` +
                `\n` +
                `【PerformanceObserver 监听 layout-shift / paint】\n` +
                `  // 监听布局抖动（CLS）\n` +
                `  const po = new PerformanceObserver((list) => {\n` +
                `    for (const entry of list.getEntries()) {\n` +
                `      console.log('Layout Shift:', entry.value, entry.hadRecentInput);\n` +
                `    }\n` +
                `  });\n` +
                `  po.observe({ type: 'layout-shift', buffered: true });\n` +
                `\n` +
                `  // 监听绘制耗时（FP/FCP/LCP）\n` +
                `  const paintObserver = new PerformanceObserver((list) => {\n` +
                `    for (const entry of list.getEntries()) {\n` +
                `      console.log(entry.name, ':', entry.startTime, 'ms');\n` +
                `    }\n` +
                `  });\n` +
                `  paintObserver.observe({ type: 'paint', buffered: true });\n` +
                `\n` +
                `【Lighthouse content-visibility 建议】\n` +
                `  Lighthouse 10+ 检测长列表/长文档，建议使用 content-visibility: auto\n` +
                `  "Defer rendering offscreen content" 审计：\n` +
                `    检测屏外可见内容（offscreen elements）\n` +
                `    建议加 content-visibility: auto + contain-intrinsic-size\n` +
                `  Lighthouse 评分提升：Performance 分数 +5~15 分\n` +
                `\n` +
                `【Render Blocking 监控】\n` +
                `  // 监听长任务（>50ms 阻塞主线程）\n` +
                `  const longTaskObserver = new PerformanceObserver((list) => {\n` +
                `    for (const entry of list.getEntries()) {\n` +
                `      console.log('Long Task:', entry.duration, 'ms');\n` +
                `    }\n` +
                `  });\n` +
                `  longTaskObserver.observe({ type: 'longtask', buffered: true });\n` +
                `\n` +
                `【Layout Shift 跳变检测】\n` +
                `  content-visibility: auto 切换时可能产生 Layout Shift\n` +
                `  监听 layout-shift 事件，CLS（Cumulative Layout Shift）应 < 0.1\n` +
                `  若 CLS 过高，调整 contain-intrinsic-size 兜底尺寸更精确\n` +
                `\n` +
                `【DevTools Performance 面板查看 skipped subtrees】\n` +
                `  Chrome DevTools Performance 面板录制：\n` +
                `    滚动长列表时查看 "Layout" / "Paint" 事件\n` +
                `    content-visibility: auto 跳过的子树标记为 "skipped"\n` +
                `    对比有/无 content-visibility 的 Layout/Paint 耗时差异\n` +
                `  Elements 面板：\n` +
                `    选中 content-visibility: auto 元素，显示 "not rendered" 标记\n` +
                `\n` +
                `【能力检测】\n` +
                `  PerformanceObserver 可用                          = ${f.performanceObserver}\n` +
                `  performance.measure 可用                          = ${f.performanceMeasureUserAgent}\n` +
                `  IntersectionObserver 可用                         = ${f.intersectionObserver}\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  // 综合性能监控\n` +
                `  function measureContentVisibilityPerf() {\n` +
                `    // 1. 测量首屏渲染\n` +
                `    const paintObserver = new PerformanceObserver((list) => {\n` +
                `      const entries = list.getEntries();\n` +
                `      const fcp = entries.find(e => e.name === 'first-contentful-paint');\n` +
                `      console.log('FCP:', fcp?.startTime, 'ms');\n` +
                `    });\n` +
                `    paintObserver.observe({ type: 'paint', buffered: true });\n` +
                `\n` +
                `    // 2. 监听布局抖动\n` +
                `    let cls = 0;\n` +
                `    const clsObserver = new PerformanceObserver((list) => {\n` +
                `      for (const entry of list.getEntries()) {\n` +
                `        if (!entry.hadRecentInput) cls += entry.value;\n` +
                `      }\n` +
                `      console.log('CLS:', cls);\n` +
                `    });\n` +
                `    clsObserver.observe({ type: 'layout-shift', buffered: true });\n` +
                `\n` +
                `    // 3. 监听长任务\n` +
                `    const longTaskObserver = new PerformanceObserver((list) => {\n` +
                `      for (const entry of list.getEntries()) {\n` +
                `        console.log('Long Task:', entry.duration, 'ms');\n` +
                `      }\n` +
                `    });\n` +
                `    longTaskObserver.observe({ type: 'longtask', buffered: true });\n` +
                `  }`;
        }
        catch (err) {
            return `读取性能监控信息失败：${err.name} - ${err.message}`;
        }
    }
    _runPerfMonitorDemo() {
        this.setState({ perfMonitorInfo: this._readPerfMonitorInfo() });
        const f = this._flags();
        this._addLog('perf', `性能监控演示：PerformanceObserver=${f.performanceObserver}, IntersectionObserver=${f.intersectionObserver}`);
        if (!f.performanceObserver) {
            this._addLog('warn', 'PerformanceObserver 不可用，跳过真实性能监控（jsdom 通常不实现，现代浏览器全支持）');
            return;
        }
        try {
            // 尝试监听 layout-shift 与 paint
            const out = this.el && this.el.querySelector('.perf-output-area');
            const lines = [];
            const po = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    lines.push(`[${entry.entryType}] ${entry.name || 'entry'} @ ${Math.round(entry.startTime)}ms dur=${Math.round(entry.duration || 0)}ms`);
                }
                if (out && lines.length > 0) {
                    out.textContent = lines.slice(-20).join('\n');
                }
            });
            // 尝试观察多种类型（部分浏览器不支持所有类型，try/catch 兜底）
            const types = ['layout-shift', 'paint', 'longtask'];
            for (const type of types) {
                try {
                    po.observe({ type, buffered: true });
                }
                catch { /* 类型不支持，跳过 */ }
            }
            this._perfObservers.push(po);
            // 测量一段布局
            if (f.performanceMeasureUserAgent) {
                performance.mark('perf-demo-start');
                // 触发一些布局工作
                const boxes = this.el && this.el.querySelectorAll('.contain-box');
                if (boxes)
                    boxes.forEach(b => { void b.offsetWidth; });
                performance.mark('perf-demo-end');
                performance.measure('perf-demo', 'perf-demo-start', 'perf-demo-end');
                const measure = performance.getEntriesByName('perf-demo')[0];
                if (out) {
                    out.textContent = `PerformanceObserver 已绑定（layout-shift/paint/longtask）\nperf-demo 测量：${Math.round(measure?.duration || 0)}ms\n（真实浏览器滚动长列表可观察 layout-shift 事件）`;
                }
            }
            this._addLog('info', 'PerformanceObserver 已绑定，开始监听 layout-shift/paint/longtask');
        }
        catch (err) {
            this._addLog('warn', `PerformanceObserver 绑定失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard7() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '7. 性能监控与验证 —— Performance API / Lighthouse / DevTools',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['PerformanceObserver', f.performanceObserver],
                ['IntersectionObserver', f.intersectionObserver],
            ]), h(Tag, { color: 'primary' }, '性能验证')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '性能监控与验证：Performance API 测量 Layout/Paint 耗时（performance.mark/measure）；PerformanceObserver 监听 layout-shift（CLS 布局抖动）/ paint（FP/FCP/LCP）/ longtask（长任务 >50ms 阻塞）；Lighthouse 10+ 检测长列表建议 content-visibility: auto（"Defer rendering offscreen content" 审计，Performance 分数 +5~15）；Render Blocking 监控（longtask）；Layout Shift 跳变检测（CLS 应 <0.1，过高调整 contain-intrinsic-size）；DevTools Performance 面板查看 skipped subtrees（content-visibility: auto 跳过子树标记 skipped）。jsdom 通常不实现 PerformanceObserver，真实浏览器可完整监控。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行性能监控演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runPerfMonitorDemo() })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '性能监控输出（PerformanceObserver 监听 layout-shift/paint/longtask）：'),
                h('div', { class: 'perf-output perf-output-area' }, f.performanceObserver
                    ? '点击「运行性能监控演示」绑定 PerformanceObserver，真实浏览器可观察 layout-shift/paint/longtask 事件...'
                    : 'PerformanceObserver 不可用（jsdom 通常不实现）。在真实浏览器中可监听 layout-shift（CLS）/ paint（FP/FCP/LCP）/ longtask（长任务）。'),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.perfMonitorInfo || '（点击「运行性能监控演示」查看完整说明）')),
                h(Alert, {
                    type: 'info',
                    message: 'Lighthouse 10+ 建议 content-visibility: auto，Performance 分数 +5~15',
                    description: 'Performance API（mark/measure）测量 Layout/Paint 耗时；PerformanceObserver 监听 layout-shift（CLS 应 <0.1）/ paint（FP/FCP/LCP）/ longtask（>50ms 阻塞）。Lighthouse "Defer rendering offscreen content" 审计检测长列表建议 content-visibility: auto。DevTools Performance 面板查看 skipped subtrees。jsdom 不实现 PerformanceObserver，真实浏览器可完整监控。',
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
                `【场景 1：虚拟列表 vs content-visibility:auto 取舍】\n` +
                `  虚拟列表（react-window / react-virtualized）：\n` +
                `    ✓ 极致性能（仅渲染可见行，DOM 节点少）\n` +
                `    ✓ 可控滚动位置、懒加载\n` +
                `    ✗ 实现复杂（需计算可见区域、占位）\n` +
                `    ✗ 破坏原生滚动（如键盘 PageDown）\n` +
                `  content-visibility: auto：\n` +
                `    ✓ 零 JS，原生支持\n` +
                `    ✓ 保留 DOM（屏外不渲染但保留）\n` +
                `    ✓ 原生滚动行为完整\n` +
                `    ✗ DOM 节点仍存在（10000 行 = 10000 DOM，内存占用）\n` +
                `    ✗ 极端长列表（100000+）仍需虚拟列表\n` +
                `  取舍：1000-10000 行用 content-visibility，100000+ 用虚拟列表\n` +
                `\n` +
                `【场景 2：长文档目录优化】\n` +
                `  article section {\n` +
                `    content-visibility: auto;\n` +
                `    contain-intrinsic-size: auto 0 500px;  /* 章节兜底高度 */\n` +
                `  }\n` +
                `  长文档（如 MDN/W3C 规范）仅渲染可见章节，屏外章节跳过\n` +
                `  首屏渲染时间减少 70%+\n` +
                `\n` +
                `【场景 3：配合 contain: strict 严格隔离】\n` +
                `  .widget {\n` +
                `    contain: strict;  /* size layout paint style */\n` +
                `    content-visibility: auto;\n` +
                `    width: 300px; height: 200px;  /* strict 需显式尺寸 */\n` +
                `    contain-intrinsic-size: 300px 200px;\n` +
                `  }\n` +
                `  contain: strict 提供最强隔离，content-visibility: auto 跳过屏外\n` +
                `\n` +
                `【场景 4：content-visibility 与 anchor 定位冲突】\n` +
                `  问题：content-visibility: auto 跳过屏外元素，#anchor 跳转可能定位失败\n` +
                `  原因：屏外元素未渲染，浏览器无法计算目标位置\n` +
                `  解决：\n` +
                `    1. 用 scrollIntoView() 触发渲染后再跳转\n` +
                `    2. 为 anchor 目标加 contain-intrinsic-size 兜底\n` +
                `    3. 用 IntersectionObserver 监听目标，可见时再跳转\n` +
                `  示例：\n` +
                `    document.querySelector('#section-5').scrollIntoView();\n` +
                `    // 浏览器渲染该章节后再跳转\n` +
                `\n` +
                `【场景 5：Masonry 降级（CSS columns + JS）】\n` +
                `  /* Firefox 用原生 Masonry */\n` +
                `  @supports (grid-template-rows: masonry) {\n` +
                `    .masonry {\n` +
                `      display: grid;\n` +
                `      grid-template-columns: repeat(3, 1fr);\n` +
                `      grid-template-rows: masonry;\n` +
                `    }\n` +
                `  }\n` +
                `  /* 其他浏览器降级 CSS columns */\n` +
                `  @supports not (grid-template-rows: masonry) {\n` +
                `    .masonry { column-count: 3; column-gap: 8px; }\n` +
                `    .masonry .item { break-inside: avoid; margin-bottom: 8px; }\n` +
                `  }\n` +
                `\n` +
                `【场景 6：焦点管理（屏外可聚焦元素）】\n` +
                `  问题：content-visibility: hidden 屏蔽了焦点，Tab 键无法到达\n` +
                `  原因：隐藏元素不参与渲染，无法聚焦\n` +
                `  解决：\n` +
                `    1. 用 tabindex="-1" + JS 控制焦点\n` +
                `    2. 切换 content-visibility: visible 后再 focus()\n` +
                `    3. 用 visibility: hidden（保留焦点但占空间）替代\n` +
                `  示例：\n` +
                `    function focusTab(index) {\n` +
                `      document.querySelectorAll('.tab-panel').forEach((p, i) => {\n` +
                `        p.style.contentVisibility = i === index ? 'visible' : 'hidden';\n` +
                `      });\n` +
                `      document.querySelectorAll('.tab-panel')[index].focus();\n` +
                `    }\n` +
                `\n` +
                `【陷阱清单】\n` +
                `  1. contain: size/strict 未指定尺寸元素塌陷为 0\n` +
                `     → 必须显式 width/height，或用 contain: content（不含 size）\n` +
                `  2. content-visibility: auto 无 contain-intrinsic-size 滚动条跳变\n` +
                `     → 必须配合 contain-intrinsic-size: auto 0 44px\n` +
                `  3. content-visibility: auto 与 anchor 定位冲突\n` +
                `     → scrollIntoView() 触发渲染后再跳转\n` +
                `  4. content-visibility: hidden 屏蔽焦点，Tab 键无法到达\n` +
                `     → 切换 visible 后再 focus()，或用 visibility: hidden\n` +
                `  5. content-visibility: hidden 不暂停 JS 定时器\n` +
                `     → 手动 clearInterval 或用 requestAnimationFrame\n` +
                `  6. Masonry 仅 Firefox 默认支持，Chrome/Safari 需 flag\n` +
                `     → @supports 检测 + CSS columns 降级\n` +
                `  7. content-visibility: auto 极端长列表（100000+）仍需虚拟列表\n` +
                `     → DOM 节点仍占内存，100000+ 行用 react-window\n` +
                `  8. contain: paint 创建 stacking context 影响层叠\n` +
                `     → z-index 行为变化，需测试层叠顺序\n` +
                `  9. contain: layout 影响绝对定位 containing block\n` +
                `     → 子元素绝对定位参照变化（paint 也创建 containing block）\n` +
                `  10. content-visibility 浏览器支持较新（Chrome 85+/Firefox 125+/Safari 17+）\n` +
                `      → 老浏览器降级，无 content-visibility 时正常渲染（性能无提升但不破坏）\n` +
                `\n` +
                `【最佳实践清单】\n` +
                `  ✓ contain: content 用于不确定尺寸元素（不含 size 安全）\n` +
                `  ✓ contain: strict 用于固定尺寸元素（最强隔离，需显式尺寸）\n` +
                `  ✓ content-visibility: auto 配合 contain-intrinsic-size: auto 0 44px\n` +
                `  ✓ 长列表 1000-10000 行用 content-visibility，100000+ 用虚拟列表\n` +
                `  ✓ 长文档章节 content-visibility: auto + 章节兜底高度\n` +
                `  ✓ content-visibility: hidden 用于标签页/折叠面板保留状态\n` +
                `  ✓ Masonry @supports 检测 + CSS columns 降级\n` +
                `  ✓ anchor 定位用 scrollIntoView() 触发渲染\n` +
                `  ✓ 焦点管理切换 visible 后再 focus()\n` +
                `  ✓ JS 定时器手动管理（content-visibility: hidden 不暂停）\n` +
                `\n` +
                `【能力检测汇总】\n` +
                `  contain:layout           = ${f.containLayout}\n` +
                `  contain:paint            = ${f.containPaint}\n` +
                `  contain:size             = ${f.containSize}\n` +
                `  content-visibility:auto  = ${f.contentVisibilityAuto}\n` +
                `  contain-intrinsic-size   = ${f.containIntrinsicSize}\n` +
                `  masonry                  = ${f.masonry}\n` +
                `  PerformanceObserver      = ${f.performanceObserver}\n` +
                `  IntersectionObserver     = ${f.intersectionObserver}`;
        }
        catch (err) {
            return `读取实战与陷阱信息失败：${err.name} - ${err.message}`;
        }
    }
    _runPitfallsDemo() {
        this.setState({ pitfallsInfo: this._readPitfallsInfo() });
        const f = this._flags();
        this._addLog('pitfalls', `实战与陷阱演示：content-visibility:auto=${f.contentVisibilityAuto}, masonry=${f.masonry}, PerformanceObserver=${f.performanceObserver}`);
    }
    _renderCard8() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '8. 实战与陷阱 —— 虚拟列表取舍 / 长文档 / anchor 冲突 / Masonry 降级',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['content-visibility:auto', f.contentVisibilityAuto], ['masonry', f.masonry]]), h(Tag, { color: 'warning' }, '6 大场景')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '六大实战场景：1. 虚拟列表 vs content-visibility:auto 取舍（1000-10000 行用 cv，100000+ 用虚拟列表）；2. 长文档目录优化（article section content-visibility: auto + 章节兜底高度，首屏减少 70%+）；3. 配合 contain: strict 严格隔离（最强隔离 + 跳过屏外）；4. content-visibility 与 anchor 定位冲突（屏外未渲染定位失败，scrollIntoView() 触发渲染）；5. Masonry 降级（@supports 检测 + CSS columns）；6. 焦点管理（content-visibility: hidden 屏蔽焦点，切换 visible 后再 focus()）。10 大陷阱：size/strict 塌陷、无 contain-intrinsic-size 跳变、anchor 冲突、焦点屏蔽、定时器不暂停、Masonry 兼容、极端长列表、stacking context、containing block、浏览器支持。10 条最佳实践清单。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行实战与陷阱演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runPitfallsDemo() })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '虚拟列表 vs content-visibility:auto 取舍 + 长文档优化对比：'),
                h('div', { class: 'perf-stage' }, h('div', { class: 'fs-sm' }, '长列表演示（content-visibility: auto 跳过屏外，1000-10000 行推荐）：'), h('div', { class: 'cv-list' }, Array.from({ length: 10 }, (_, i) => h('div', { class: 'cv-item cv-auto' }, `第 ${i + 1} 行 · content-visibility: auto · contain-intrinsic-size: 0 44px · 适用 1000-10000 行`))), h('div', { class: 'fs-sm', style: { marginTop: '8px' } }, '↑ content-visibility: auto 零 JS 原生支持；100000+ 行用虚拟列表（react-window）')),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } }, h('code', {}, s.pitfallsInfo || '（点击按钮查看 6 大实战场景与 10 大陷阱完整说明）')),
                h(Alert, {
                    type: 'warning',
                    message: 'content-visibility: auto 1000-10000 行推荐，100000+ 用虚拟列表',
                    description: '陷阱清单：contain:size/strict 需显式尺寸（否则塌陷）；content-visibility:auto 需配合 contain-intrinsic-size（否则滚动条跳变）；anchor 定位冲突（scrollIntoView 触发渲染）；content-visibility:hidden 屏蔽焦点（切换 visible 后 focus）；JS 定时器不暂停（手动 clearInterval）；Masonry 仅 Firefox 默认（@supports + CSS columns 降级）。最佳实践 10 条覆盖 contain/content-visibility/Masonry/焦点/定时器。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 9：beforematch 事件 / hidden=until-found ===================
    _runBeforematchDemo() {
        const f = this._flags();
        const info = 'beforematch 事件 / hidden="until-found" 完整说明：\n\n' +
            '【标准】HTML Standard（hidden="until-found" 状态）+ beforematch 事件。\n' +
            '【浏览器支持】Chrome 102+（beforematch 事件）/ Chrome 105+（hidden="until-found"）；Firefox/Safari 尚未实现。\n\n' +
            '【核心机制】\n' +
            '  1. hidden="until-found"：内容默认不渲染（类似 hidden），但会被浏览器的\n' +
            '     find-in-page（Ctrl+F）匹配；匹配时浏览器触发 beforematch 事件并自动\n' +
            '     移除 hidden 状态，内容变为可见。\n' +
            '  2. beforematch 事件：在 find-in-page 即将跳转到匹配内容前触发，可在此\n' +
            '     执行懒加载、状态初始化等逻辑。\n\n' +
            '【用法】\n' +
            '  <section hidden="until-found" id="faq-1">\n' +
            '    <h3>问题 1：什么是 beforematch？</h3>\n' +
            '    <p>当用户用浏览器查找功能匹配到这段内容时，它会自动显示。</p>\n' +
            '  </section>\n\n' +
            "  // 监听 beforematch 事件（仅在 document.documentElement 上支持）\n" +
            "  document.documentElement.addEventListener('beforematch', (e: any) => {\n" +
            "    console.log('即将显示匹配内容：', e.target);\n" +
            "    // 可在此执行懒加载、数据初始化等\n" +
            "  });\n\n" +
            '【与 hidden / content-visibility:hidden 对比】\n' +
            '  hidden：完全不可见，find-in-page 不匹配，无事件。\n' +
            '  hidden="until-found"：默认不可见，find-in-page 匹配并自动显示，触发 beforematch。\n' +
            '  content-visibility:hidden：跳过渲染但保留状态，find-in-page 不匹配，无事件。\n\n' +
            '【典型场景】\n' +
            '  - 长文档 FAQ：默认折叠答案（hidden="until-found"），用户搜索时自动展开。\n' +
            '  - 渐进式披露：搜索结果高亮 + 懒加载内容。\n' +
            '  - 性能优化：屏外内容不渲染，搜索时才激活。\n\n' +
            '【能力检测】\n' +
            "  // beforematch 事件：检测 document.documentElement 是否支持 'onbeforematch'\n" +
            "  const supportsBeforematch = 'onbeforematch' in document.documentElement;\n" +
            "  // hidden=\"until-found\"：创建元素并检测 hidden 属性状态\n" +
            "  const el = document.createElement('div');\n" +
            "  el.setAttribute('hidden', 'until-found');\n" +
            "  const supportsUntilFound = el.hidden === false;  // 关键：until-found 时 .hidden 为 false\n\n" +
            '【注意事项】\n' +
            '  - beforematch 仅在 find-in-page 触发，JS 设置 hidden 不会触发。\n' +
            '  - hidden="until-found" 的内容仍可被 :target / scrollIntoView 显示。\n' +
            '  - 可访问性：屏幕阅读器对 hidden="until-found" 的处理与 hidden 一致（默认不朗读）。\n' +
            '  - jsdom 不实现 beforematch / hidden="until-found"，能力检测返回 false。';
        this.setState({ beforematchInfo: info });
        this._addLog('pitfalls', `beforematch 演示：beforematch=${f.beforematch}, hiddenUntilFound=${f.hiddenUntilFound}`);
    }
    _renderCard9() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '9. beforematch 事件 / hidden="until-found" —— 搜索触发的渐进式披露',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['beforematch', f.beforematch], ['hidden=until-found', f.hiddenUntilFound]]), h(Tag, { color: 'primary' }, 'Chrome 102+')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'hidden="until-found" 是 HTML hidden 属性的新状态：内容默认不渲染，但浏览器的 find-in-page（Ctrl+F）匹配时会触发 beforematch 事件并自动显示内容。典型场景：长文档 FAQ 默认折叠答案、搜索时自动展开；渐进式披露与懒加载。beforematch 事件仅在 document.documentElement 上支持（Chrome 102+），hidden="until-found" 在 Chrome 105+ 实现，Firefox/Safari 尚未支持。jsdom 不实现这两个特性，能力检测返回 false。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 beforematch 演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runBeforematchDemo() })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, 'beforematch / hidden=until-found 用法与对比：'),
                h('div', { class: 'perf-stage' }, h('div', { class: 'fs-sm', style: { marginBottom: '6px' } }, '示例：hidden="until-found" 内容（真实浏览器中用 Ctrl+F 搜索"答案"可触发显示）：'), h('div', { class: 'contain-box', style: { background: '#ede9fe', borderColor: '#8b5cf6' } }, h('div', { hidden: 'until-found' }, '这段内容默认隐藏（hidden="until-found"），find-in-page 匹配"答案"时自动显示并触发 beforematch 事件。'))),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '560px', overflow: 'auto' } }, h('code', {}, s.beforematchInfo || '（点击按钮查看 beforematch / hidden=until-found 完整说明）')),
                h(Alert, {
                    type: 'warning',
                    message: 'beforematch 仅 Chrome 102+ / hidden="until-found" 仅 Chrome 105+；Firefox/Safari 未实现',
                    description: 'beforematch 事件仅在 find-in-page 触发（JS 设置 hidden 不会触发）；hidden="until-found" 的内容可被 :target / scrollIntoView 显示；屏幕阅读器默认不朗读（与 hidden 一致）。jsdom 不实现这两个特性，能力检测返回 false。降级方案：用 details/summary 或 JS 控制显隐 + 自定义搜索高亮。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== 日志面板 ===================
    _renderLogPanel() {
        const s = this.state;
        return h('div', { class: 'log-panel' }, h('div', { class: 'log-panel__header' }, '事件日志', h(Tag, { color: 'primary' }, `${s.logs.length} 条`)), s.logs.length === 0
            ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
            : s.logs.slice().reverse().map((log) => h('div', { class: 'log-panel__line' }, h('span', { class: 'log-panel__time' }, log.time), h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type), h('span', { class: 'log-panel__content' }, log.content))));
    }
    // =================== 整页渲染 ===================
    render() {
        const s = this.state;
        return h('div', { class: 'api-lab-page css-performance-layout-page' }, h('h2', { class: 'section-title' }, 'CSS Containment + content-visibility + Masonry 深度实验室'), h('p', { class: 'fs-sm text-secondary mb-md' }, '本页演示三大性能型 CSS 标准：contain 属性全集（layout/paint/size/strict/inline-size）、content-visibility:auto（跳过屏外渲染长列表性能数量级提升）、content-visibility:hidden（完全隐藏保留渲染状态）、contain-intrinsic-size（兜底尺寸防滚动条跳变）、Masonry Layout（CSS Grid L3 原生 Pinterest 瀑布流）、性能监控（Performance API/Lighthouse/DevTools）、6 大实战场景与 10 大陷阱。所有特性通过 typeof / CSS.supports / PerformanceObserver 能力检测，不可用时仅记日志，绝不抛异常。'), s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderCard7(), this._renderCard8(), this._renderCard9(), this._renderLogPanel());
    }
}
//# sourceMappingURL=CSSPerformanceLayoutPage.js.map