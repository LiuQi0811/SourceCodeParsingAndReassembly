// =====================================================================
// CSSScrollSnapPage.js —— CSS Scroll Snap Module Level 1 完整实验室
// 演示 W3C CSS Scroll Snap Module Level 1 滚动吸附特性：
//   1. 概述与动机：分页滚动 / 轮播图原生实现 / 移动端横滑相册 /
//      CSS Scroll Snap Module Level 1 标准 / 浏览器支持 Chrome 69+ /
//      Firefox 68+ / Safari 11+ 全部稳定
//   2. scroll-snap-type 容器属性：x mandatory / y proximity / both /
//      inline / block / none / mandatory 强制吸附 vs proximity 接近吸附 /
//      与 overflow 协同
//   3. scroll-snap-align 子项属性：start / center / end / none /
//      与 scroll-snap-type 配合 / 多元素对齐方式 / 单元素多 snap point
//   4. scroll-padding 与 scroll-margin：scroll-padding: 20px /
//      scroll-padding-block / scroll-padding-inline / scroll-margin: 10px /
//      顶部固定导航偏移 / 与 position: sticky 协同
//   5. scroll-snap-stop 强制停止：normal / always / 防止快速滑动跳过多个
//      snap 点 / 移动端原生体验 / 与触摸惯性协同
//   6. 实战：全屏轮播图：水平横滑相册 / 垂直分页滚动 / 嵌套滚动容器 /
//      与 IntersectionObserver 懒加载协同 / 焦点管理
//   7. 实战：图片画廊与 Tabs 选项卡：Tabs 选项卡切换 + scroll-snap /
//      图片网格 + 分页 / 移动端 Drawer / iOS/Android 原生体验对比
//   8. 陷阱与最佳实践：mandatory vs proximity 取舍 / 焦点跳变问题 /
//      与 position: sticky 冲突 / DevTools 调试 / 屏幕阅读器 /
//      RTL 与 writing-mode 适配 / 与 scroll-behavior: smooth 协同
//   9. scroll-start / scroll-start-target（Level 2 草案，Chrome 124+）：
//      声明式滚动容器初始位置（scroll-start: 0/50%/100px/center /
//      单轴 scroll-start-x/y / 逻辑 scroll-start-block/inline）+
//      子元素对齐（scroll-start-target: start/center/end/nearest）/
//      vs 命令式 scrollIntoView / SSR 友好 / 实战 Tab 默认选中第 2 个、
//      长列表默认滚动、与 scroll-snap-stop 协同、阅读位置持久化 /
//      陷阱：仅 Chrome 124+ / 与 scroll-snap-type 双跳 / 降级 scrollTo
// 说明：所有特性调用前做 typeof / CSS.supports 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。jsdom 不做真实 CSS 渲染，
//       CSS.supports 通常可用；scroll-snap 系列属性 jsdom 通常识别为合法
//       语法但无真实吸附行为，统一 try/catch 兜底。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class CSSScrollSnapPage extends Page {
    _inited = false;
    _dynamicStyles = [];
    _snapTypeMode = '';
    _snapAlignMode = '';
    _scrollPaddingMode = '';
    _snapStopMode = '';
    _carouselIndex = 0;
    _scrollStartTargetMode = '';
    // —— 初始 state ——
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            overviewInfo: '', // Card 1：概述与动机
            snapTypeInfo: '', // Card 2：scroll-snap-type 容器属性
            snapAlignInfo: '', // Card 3：scroll-snap-align 子项属性
            paddingMarginInfo: '', // Card 4：scroll-padding 与 scroll-margin
            snapStopInfo: '', // Card 5：scroll-snap-stop 强制停止
            carouselInfo: '', // Card 6：实战：全屏轮播图
            galleryTabsInfo: '', // Card 7：实战：图片画廊与 Tabs 选项卡
            pitfallsInfo: '', // Card 8：陷阱与最佳实践
            scrollStartInfo: '', // Card 9：scroll-start / scroll-start-target（Level 2 草案）
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
        this._snapTypeMode = 'x mandatory'; // Card 2 当前 scroll-snap-type 值
        this._snapAlignMode = 'start'; // Card 3 当前 scroll-snap-align 值
        this._scrollPaddingMode = '0px'; // Card 4 当前 scroll-padding 值
        this._snapStopMode = 'normal'; // Card 5 当前 scroll-snap-stop 值
        this._carouselIndex = 0; // Card 6 当前轮播索引
        this._scrollStartTargetMode = 'center'; // Card 9 当前 scroll-start-target 值
        // 一次性能力检测：CSS Scroll Snap 全家桶
        const f = this._flags();
        const c = (ok) => ok ? '✓' : '✗';
        const parts = [
            `CSS ${c(f.css)}`,
            `supports ${c(f.supports)}`,
            `snap-type:x mandatory ${c(f.snapTypeX)}`,
            `snap-type:y proximity ${c(f.snapTypeY)}`,
            `snap-align:start ${c(f.snapAlignStart)}`,
            `snap-align:center ${c(f.snapAlignCenter)}`,
            `scroll-padding ${c(f.scrollPadding)}`,
            `scroll-margin ${c(f.scrollMargin)}`,
            `snap-stop:always ${c(f.snapStop)}`,
            `scroll-start:0 ${c(f.scrollStart0)}`,
            `scroll-start:50% ${c(f.scrollStart50)}`,
            `scroll-start:center ${c(f.scrollStartCenter)}`,
            `scroll-start-target:start ${c(f.scrollStartTargetStart)}`,
        ];
        const summary = f.css
            ? `CSS Scroll Snap Module Level 1 能力检测：${parts.join(' · ')}。jsdom 不做真实 CSS 渲染，但 CSS.supports 通常可用；scroll-snap-type / scroll-snap-align / scroll-padding / scroll-margin / scroll-snap-stop 五大属性现代浏览器支持完整（Chrome 69+ / Firefox 68+ / Safari 11+）。scroll-start / scroll-start-target 属 Level 2 草案，仅 Chrome 124+ 实现，Safari/Firefox 未实现。按钮点击注入演示样式 + 完整代码示例，真实浏览器可查看吸附效果。`
            : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。';
        this.setState({ capsSummary: summary });
        this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!f.snapTypeX)
            this._addLog('warn', 'scroll-snap-type: x mandatory 不可用或 jsdom 未识别（Chrome 69+ / Firefox 68+ / Safari 11+ 全部稳定）');
        if (!f.snapAlignStart)
            this._addLog('warn', 'scroll-snap-align: start 不可用或 jsdom 未识别（Chrome 69+ / Firefox 68+ / Safari 11+ 全部稳定）');
        if (!f.snapStop)
            this._addLog('warn', 'scroll-snap-stop: always 不可用或 jsdom 未识别（Chrome 81+ / Firefox 75+ / Safari 14.1+ 较新）');
        if (!f.scrollStart0)
            this._addLog('warn', 'scroll-start: 0 不可用或 jsdom 未识别（CSS Scroll Snap Module Level 2 草案，仅 Chrome 124+ 实现，Safari/Firefox 截至 2024 未实现）');
        if (!f.scrollStartTargetStart)
            this._addLog('warn', 'scroll-start-target: start 不可用或 jsdom 未识别（CSS Scroll Snap Module Level 2 草案，仅 Chrome 124+ 实现）');
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
    // 返回布尔能力对象（供 capsSummary / 按钮 disabled 使用）
    // 用 safe 包裹：jsdom 不可用时返回 false，绝不抛异常
    _flags() {
        const safe = (fn) => { try {
            return fn();
        }
        catch {
            return false;
        } };
        const hasCSS = safe(() => typeof CSS !== 'undefined');
        const supportsPV = (p, v) => safe(() => hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v));
        return {
            css: hasCSS,
            supports: safe(() => hasCSS && typeof CSS.supports === 'function'),
            snapTypeX: supportsPV('scroll-snap-type', 'x mandatory'),
            snapTypeY: supportsPV('scroll-snap-type', 'y proximity'),
            snapAlignStart: supportsPV('scroll-snap-align', 'start'),
            snapAlignCenter: supportsPV('scroll-snap-align', 'center'),
            scrollPadding: supportsPV('scroll-padding', '20px'),
            scrollMargin: supportsPV('scroll-margin', '10px'),
            snapStop: supportsPV('scroll-snap-stop', 'always'),
            // scroll-start / scroll-start-target（CSS Scroll Snap Module Level 2 草案，Chrome 124+）
            scrollStart0: supportsPV('scroll-start', '0'),
            scrollStart50: supportsPV('scroll-start', '50%'),
            scrollStartCenter: supportsPV('scroll-start', 'center'),
            scrollStartTargetStart: supportsPV('scroll-start-target', 'start'),
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
    // —— 一次性注入全部基础演示样式 ——
    _injectBaseStyles() {
        this._injectStyle('css-scroll-snap-demo', `
      /* ===== 通用 snap 舞台 ===== */
      .snap-stage {
        margin-top: 10px;
        padding: 12px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
      }
      /* ===== Card 2：scroll-snap-type 演示 ===== */
      .snap-type-stage {
        display: flex;
        gap: 10px;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        padding: 10px;
        background: #fef3c7;
        border: 2px solid #f59e0b;
        border-radius: 6px;
        height: 120px;
      }
      .snap-type-stage .snap-item {
        flex: 0 0 160px;
        scroll-snap-align: start;
        background: #dbeafe;
        border: 2px solid #3b82f6;
        color: #1e3a8a;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 600;
      }
      /* ===== Card 3：scroll-snap-align 演示 ===== */
      .snap-align-stage {
        display: flex;
        gap: 10px;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        padding: 10px;
        background: #dcfce7;
        border: 2px solid #10b981;
        border-radius: 6px;
        height: 120px;
      }
      .snap-align-stage .snap-item {
        flex: 0 0 160px;
        scroll-snap-align: start;
        background: #ede9fe;
        border: 2px solid #8b5cf6;
        color: #4c1d95;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 600;
      }
      /* ===== Card 4：scroll-padding / scroll-margin 演示 ===== */
      .scroll-pad-stage {
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        scroll-padding: 20px;
        padding: 10px;
        background: #fee2e2;
        border: 2px solid #ef4444;
        border-radius: 6px;
        height: 120px;
        display: flex;
        gap: 10px;
      }
      .scroll-pad-stage .snap-item {
        flex: 0 0 160px;
        scroll-snap-align: start;
        scroll-margin: 10px;
        background: #fef3c7;
        border: 2px solid #f59e0b;
        color: #78350f;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 600;
      }
      /* ===== Card 6：全屏轮播图 ===== */
      .snap-carousel {
        display: flex;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        scroll-behavior: smooth;
        height: 160px;
        background: #0f172a;
        border-radius: 8px;
        margin-top: 10px;
      }
      .snap-carousel .slide {
        flex: 0 0 100%;
        scroll-snap-align: start;
        scroll-snap-stop: always;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        font-weight: 700;
        color: #fff;
      }
      .slide-1 { background: linear-gradient(135deg, #3b82f6, #1e40af); }
      .slide-2 { background: linear-gradient(135deg, #10b981, #047857); }
      .slide-3 { background: linear-gradient(135deg, #f59e0b, #b45309); }
      .slide-4 { background: linear-gradient(135deg, #ef4444, #991b1b); }
      .slide-5 { background: linear-gradient(135deg, #8b5cf6, #5b21b6); }
      /* ===== Card 7：Tabs 选项卡 + scroll-snap ===== */
      .snap-tabs {
        display: flex;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        background: #1e293b;
        border-radius: 6px 6px 0 0;
        padding: 4px;
        gap: 4px;
      }
      .snap-tabs .tab {
        flex: 0 0 auto;
        scroll-snap-align: start;
        padding: 8px 16px;
        background: #334155;
        color: #cbd5e1;
        border-radius: 4px;
        font-size: 13px;
        cursor: pointer;
        white-space: nowrap;
      }
      .snap-tabs .tab.active { background: #3b82f6; color: #fff; }
      .snap-tab-panel {
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-top: none;
        border-radius: 0 0 6px 6px;
        padding: 12px;
        font-size: 13px;
        color: #334155;
      }
      /* ===== Card 9：scroll-start / scroll-start-target 演示（Level 2 草案）===== */
      .scroll-start-stage {
        display: flex;
        gap: 10px;
        overflow-x: auto;
        scroll-snap-type: x proximity;   /* 接近吸附，与 scroll-start 协同 */
        scroll-start: 50%;               /* 声明式初始滚动到容器 50% 处 */
        padding: 10px;
        background: #ecfeff;
        border: 2px solid #06b6d4;
        border-radius: 6px;
        height: 120px;
      }
      .scroll-start-stage .snap-item {
        flex: 0 0 140px;
        scroll-snap-align: start;
        background: #cffafe;
        border: 2px solid #0891b2;
        color: #164e63;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 600;
      }
      .scroll-start-stage .snap-item.is-target {
        scroll-start-target: center;     /* 初始滚动到此元素时居中对齐 */
        background: #fef9c3;
        border: 2px dashed #ca8a04;
        color: #713f12;
      }
      /* ===== 输出区 ===== */
      .snap-output {
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
            return `===== CSS Scroll Snap Module 概述 =====\n` +
                `\n` +
                `【规范归属】\n` +
                `  CSS Scroll Snap Module Level 1（W3C Candidate Recommendation）\n` +
                `  规范地址：https://www.w3.org/TR/css-scroll-snap-1/\n` +
                `  前身 CSS Scroll Snap Points（已被 Level 1 取代，语法不同）\n` +
                `\n` +
                `【核心动机】\n` +
                `  分页滚动：让用户在滚动容器内"按页"吸附，而非连续滑动\n` +
                `  轮播图原生实现：无需 JS 库（如 Swiper/Slick），纯 CSS 实现\n` +
                `  移动端横滑相册：iOS/Android 原生相册体验\n` +
                `  分页滚动落地页：全屏一页一屏，滚动自然吸附\n` +
                `\n` +
                `【五大核心属性】\n` +
                `  1. scroll-snap-type     容器属性：定义吸附轴 + 严格度（mandatory/proximity）\n` +
                `  2. scroll-snap-align    子项属性：定义子项对齐方式（start/center/end）\n` +
                `  3. scroll-padding       容器属性：吸附偏移（如顶部固定导航留空）\n` +
                `  4. scroll-margin        子项属性：子项吸附偏移\n` +
                `  5. scroll-snap-stop     子项属性：normal/always，防止快速滑动跳过多个 snap 点\n` +
                `\n` +
                `【能力检测】\n` +
                `  CSS.supports('scroll-snap-type','x mandatory') = ${f.snapTypeX}\n` +
                `  CSS.supports('scroll-snap-type','y proximity') = ${f.snapTypeY}\n` +
                `  CSS.supports('scroll-snap-align','start') = ${f.snapAlignStart}\n` +
                `  CSS.supports('scroll-snap-align','center') = ${f.snapAlignCenter}\n` +
                `  CSS.supports('scroll-padding','20px') = ${f.scrollPadding}\n` +
                `  CSS.supports('scroll-margin','10px') = ${f.scrollMargin}\n` +
                `  CSS.supports('scroll-snap-stop','always') = ${f.snapStop}\n` +
                `\n` +
                `【浏览器支持】\n` +
                `  scroll-snap-type / scroll-snap-align —— 全部现代浏览器稳定支持\n` +
                `    Chrome 69+ / Firefox 68+ / Safari 11+ / Edge 79+ / Opera 56+\n` +
                `  scroll-padding / scroll-margin —— Chrome 69+ / Firefox 68+ / Safari 14.1+\n` +
                `    （早期 Safari 11+ 支持 scroll-snap-padding 旧名，14.1+ 改为 scroll-padding）\n` +
                `  scroll-snap-stop —— 较新：Chrome 81+ / Firefox 75+ / Safari 14.1+\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  <style>\n` +
                `    .carousel {\n` +
                `      display: flex;\n` +
                `      overflow-x: auto;\n` +
                `      scroll-snap-type: x mandatory;   /* 容器：x 轴强制吸附 */\n` +
                `      scroll-behavior: smooth;          /* 平滑滚动 */\n` +
                `    }\n` +
                `    .carousel .slide {\n` +
                `      flex: 0 0 100%;                    /* 每张占满宽度 */\n` +
                `      scroll-snap-align: start;          /* 子项：左对齐吸附 */\n` +
                `      scroll-snap-stop: always;          /* 防快速滑动跳过 */\n` +
                `    }\n` +
                `  </style>\n` +
                `  <div class="carousel">\n` +
                `    <div class="slide">Slide 1</div>\n` +
                `    <div class="slide">Slide 2</div>\n` +
                `    <div class="slide">Slide 3</div>\n` +
                `  </div>`;
        }
        catch (err) {
            return `读取概述信息失败：${err.name} - ${err.message}`;
        }
    }
    _runOverviewDemo() {
        this.setState({ overviewInfo: this._readOverviewInfo() });
        this._addLog('info', `概述演示：CSS Scroll Snap Module Level 1，snap-type=${this._flags().snapTypeX}`);
    }
    _renderCard1() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '1. 概述与动机 —— CSS Scroll Snap Module Level 1',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['snap-type', f.snapTypeX],
                ['snap-align', f.snapAlignStart],
                ['snap-stop', f.snapStop],
            ]), h(Tag, { color: 'primary' }, 'Level 1 CR')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'CSS Scroll Snap Module Level 1 让滚动容器在用户停止滚动后自动吸附到指定"snap 点"，实现分页滚动 / 轮播图 / 移动端横滑相册的原生 CSS 实现，无需 JS 库。五大核心属性：scroll-snap-type（容器，定义吸附轴 + 严格度）、scroll-snap-align（子项，对齐方式）、scroll-padding（容器偏移）、scroll-margin（子项偏移）、scroll-snap-stop（防快速跳过）。浏览器支持完整：Chrome 69+ / Firefox 68+ / Safari 11+ 全部稳定，scroll-snap-stop 较新（Chrome 81+ / Safari 14.1+）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取概述信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runOverviewDemo() })),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.overviewInfo || '（点击「读取概述信息」查看 CSS Scroll Snap Module 全景）')),
                h(Alert, {
                    type: 'info',
                    message: 'CSS Scroll Snap 让分页滚动 / 轮播图成为纯 CSS 实现',
                    description: '规范定义于 CSS Scroll Snap Module Level 1（W3C CR），五大核心属性：scroll-snap-type（容器）、scroll-snap-align（子项）、scroll-padding（容器偏移）、scroll-margin（子项偏移）、scroll-snap-stop（防快速跳过）。浏览器支持完整（Chrome 69+ / Firefox 68+ / Safari 11+），scroll-snap-stop 较新。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 2：scroll-snap-type 容器属性 ===================
    _readSnapTypeInfo() {
        const f = this._flags();
        try {
            const stage = this.el && this.el.querySelector('.snap-type-stage');
            let computed = '(未渲染)';
            if (stage) {
                computed = window.getComputedStyle(stage).getPropertyValue('scroll-snap-type') || '(空)';
            }
            return `===== scroll-snap-type 容器属性 =====\n` +
                `\n` +
                `【语法】\n` +
                `  scroll-snap-type: none | [ x | y | block | inline | both ] [ mandatory | proximity ]?\n` +
                `\n` +
                `【轴取值】\n` +
                `  none      —— 不吸附（默认）\n` +
                `  x         —— 水平轴吸附（横滑相册）\n` +
                `  y         —— 垂直轴吸附（分页滚动）\n` +
                `  block     —— 块方向吸附（默认 = y，随 writing-mode 翻转）\n` +
                `  inline    —— 行方向吸附（默认 = x，随 writing-mode 翻转）\n` +
                `  both      —— 横纵双向吸附（罕见，地图类应用）\n` +
                `\n` +
                `【严格度取值】\n` +
                `  mandatory   —— 强制吸附：滚动停止后必然吸附到最近 snap 点\n` +
                `                  优点：可预测，分页体验明确\n` +
                `                  缺点：用户无法停留在 snap 点之间，可能违反用户意图\n` +
                `                  适用：轮播图、全屏分页（一屏一页）\n` +
                `  proximity   —— 接近吸附：仅在接近 snap 点时吸附，远离则不吸附\n` +
                `                  优点：用户意图优先，可停留在任意位置\n` +
                `                  缺点：吸附行为不明确\n` +
                `                  适用：图片画廊、文章列表\n` +
                `  （省略严格度时默认 mandatory）\n` +
                `\n` +
                `【与 overflow 协同】\n` +
                `  scroll-snap-type 必须配合 overflow 非 visible 才生效\n` +
                `  常见组合：scroll-snap-type: x mandatory; overflow-x: auto;\n` +
                `  overflow: visible 时不创建滚动容器，scroll-snap 无效\n` +
                `\n` +
                `【当前演示元素】\n` +
                `  .snap-type-stage { scroll-snap-type: ${this._snapTypeMode}; overflow-x: auto; }\n` +
                `    scroll-snap-type 计算值="${computed}"\n` +
                `  CSS.supports('scroll-snap-type','x mandatory') = ${f.snapTypeX}\n` +
                `  CSS.supports('scroll-snap-type','y proximity') = ${f.snapTypeY}\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  /* 横滑相册：x 轴强制吸附 */\n` +
                `  .h-carousel {\n` +
                `    display: flex;\n` +
                `    overflow-x: auto;\n` +
                `    scroll-snap-type: x mandatory;\n` +
                `  }\n` +
                `\n` +
                `  /* 垂直分页：y 轴强制吸附（全屏一页）*/\n` +
                `  .v-pages {\n` +
                `    overflow-y: auto;\n` +
                `    scroll-snap-type: y mandatory;\n` +
                `    height: 100vh;\n` +
                `  }\n` +
                `\n` +
                `  /* 图片画廊：接近吸附（用户可自由浏览）*/\n` +
                `  .gallery {\n` +
                `    overflow-x: auto;\n` +
                `    scroll-snap-type: x proximity;  /* 仅接近时吸附 */\n` +
                `  }\n` +
                `\n` +
                `  /* 块方向吸附（随 writing-mode 翻转）*/\n` +
                `  .vertical-text-pages {\n` +
                `    writing-mode: vertical-rl;\n` +
                `    overflow-block: auto;          /* 等价 overflow-x */\n` +
                `    scroll-snap-type: block mandatory;  /* 块方向 = 横向 */\n` +
                `  }`;
        }
        catch (err) {
            return `读取 scroll-snap-type 信息失败：${err.name} - ${err.message}`;
        }
    }
    _setSnapType(mode) {
        this._snapTypeMode = mode;
        this._injectStyle('css-snap-type-dynamic', `.snap-type-stage { scroll-snap-type: ${mode}; }`);
        this.setState({ snapTypeInfo: this._readSnapTypeInfo() });
        this._addLog('snap-type', `切换 scroll-snap-type → ${mode}`);
    }
    _renderCard2() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '2. scroll-snap-type 容器属性 —— x mandatory / y proximity / both',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['x mandatory', f.snapTypeX],
                ['y proximity', f.snapTypeY],
            ]), h(Tag, { color: 'primary' }, '容器属性')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'scroll-snap-type 是容器属性，定义吸附轴（none/x/y/block/inline/both）+ 严格度（mandatory 强制 / proximity 接近）。mandatory 强制吸附到最近 snap 点（适合轮播图、全屏分页），proximity 仅接近时吸附（适合画廊、列表）。必须配合 overflow 非 visible。block/inline 随 writing-mode 翻转（默认 block=y、inline=x，vertical-rl 时翻转）。浏览器支持完整：Chrome 69+ / Firefox 68+ / Safari 11+。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ snapTypeInfo: this._readSnapTypeInfo() }) }), this._btn('x mandatory', { size: 'sm', disabled: !f.snapTypeX, onClick: () => this._setSnapType('x mandatory') }), this._btn('x proximity', { size: 'sm', disabled: !f.snapTypeX, onClick: () => this._setSnapType('x proximity') }), this._btn('y mandatory', { size: 'sm', disabled: !f.snapTypeY, onClick: () => this._setSnapType('y mandatory') }), this._btn('none', { size: 'sm', onClick: () => this._setSnapType('none') })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '横滑相册演示（当前 scroll-snap-type: ' + this._snapTypeMode + '，真实浏览器拖动观察吸附）：'),
                h('div', { class: 'snap-type-stage' }, h('div', { class: 'snap-item' }, 'Item 1'), h('div', { class: 'snap-item' }, 'Item 2'), h('div', { class: 'snap-item' }, 'Item 3'), h('div', { class: 'snap-item' }, 'Item 4'), h('div', { class: 'snap-item' }, 'Item 5')),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.snapTypeInfo || '（点击按钮切换 scroll-snap-type 查看说明）')),
                h(Alert, {
                    type: 'info',
                    message: 'mandatory 强制吸附 vs proximity 接近吸附',
                    description: 'mandatory：滚动停止后必然吸附到最近 snap 点（可预测，适合轮播图、全屏分页）。proximity：仅接近 snap 点时吸附，远离则不吸附（用户意图优先，适合画廊、列表）。必须配合 overflow 非 visible 才生效。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 3：scroll-snap-align 子项属性 ===================
    _readSnapAlignInfo() {
        const f = this._flags();
        try {
            const stage = this.el && this.el.querySelector('.snap-align-stage');
            let computed = '(未渲染)';
            if (stage) {
                const item = stage.querySelector('.snap-item');
                if (item) {
                    computed = window.getComputedStyle(item).getPropertyValue('scroll-snap-align') || '(空)';
                }
            }
            return `===== scroll-snap-align 子项属性 =====\n` +
                `\n` +
                `【语法】\n` +
                `  scroll-snap-align: none | start | end | center\n` +
                `  （可分别指定两个值：scroll-snap-align: start end; 横纵不同）\n` +
                `\n` +
                `【取值详解】\n` +
                `  none    —— 该子项不作为 snap 点（不吸附）\n` +
                `  start   —— 子项的 start 边对齐到容器的 snap 点（左/上）\n` +
                `  center  —— 子项的中心对齐到容器的 snap 点（居中）\n` +
                `  end     —— 子项的 end 边对齐到容器的 snap 点（右/下）\n` +
                `\n` +
                `【与 scroll-snap-type 配合】\n` +
                `  scroll-snap-type 定义"在哪里吸附"（轴 + 严格度）\n` +
                `  scroll-snap-align 定义"对齐到子项的哪个边"\n` +
                `  两者必须同时设置才能生效\n` +
                `\n` +
                `【多元素对齐方式】\n` +
                `  容器内多个子项可设置不同 scroll-snap-align：\n` +
                `    .item-a { scroll-snap-align: start; }   /* 对齐到左 */\n` +
                `    .item-b { scroll-snap-align: center; }  /* 对齐到中 */\n` +
                `    .item-c { scroll-snap-align: end; }     /* 对齐到右 */\n` +
                `  滚动停止时，浏览器选择最近的 snap 点（基于子项的对齐方式）\n` +
                `\n` +
                `【单元素多 snap point】\n` +
                `  一个子项可同时定义 start 和 end 两个 snap point：\n` +
                `    .wide-item { scroll-snap-align: start end; }\n` +
                `  即该子项的左边缘和右边缘都是 snap 点\n` +
                `  适合宽子项（如横幅）需要两端都能吸附\n` +
                `\n` +
                `【当前演示元素】\n` +
                `  .snap-align-stage .snap-item { scroll-snap-align: ${this._snapAlignMode}; }\n` +
                `    scroll-snap-align 计算值="${computed}"\n` +
                `  CSS.supports('scroll-snap-align','start') = ${f.snapAlignStart}\n` +
                `  CSS.supports('scroll-snap-align','center') = ${f.snapAlignCenter}\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  /* 轮播图：每张幻灯片左对齐吸附 */\n` +
                `  .carousel .slide {\n` +
                `    scroll-snap-align: start;\n` +
                `    flex: 0 0 100%;\n` +
                `  }\n` +
                `\n` +
                `  /* 居中画廊：图片居中吸附 */\n` +
                `  .gallery .photo {\n` +
                `    scroll-snap-align: center;  /* 图片中心对齐到容器中心 */\n` +
                `  }\n` +
                `\n` +
                `  /* 宽横幅：两端都可吸附 */\n` +
                `  .banner {\n` +
                `    scroll-snap-align: start end;  /* 左右两端都是 snap 点 */\n` +
                `    width: 200%;\n` +
                `  }\n` +
                `\n` +
                `  /* 跳过某些子项（不作为 snap 点）*/\n` +
                `  .skip-item {\n` +
                `    scroll-snap-align: none;  /* 滚动时不吸附到此项 */\n` +
                `  }`;
        }
        catch (err) {
            return `读取 scroll-snap-align 信息失败：${err.name} - ${err.message}`;
        }
    }
    _setSnapAlign(mode) {
        this._snapAlignMode = mode;
        this._injectStyle('css-snap-align-dynamic', `.snap-align-stage .snap-item { scroll-snap-align: ${mode}; }`);
        this.setState({ snapAlignInfo: this._readSnapAlignInfo() });
        this._addLog('snap-align', `切换 scroll-snap-align → ${mode}`);
    }
    _renderCard3() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '3. scroll-snap-align 子项属性 —— start / center / end / none',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['start', f.snapAlignStart],
                ['center', f.snapAlignCenter],
            ]), h(Tag, { color: 'primary' }, '子项属性')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'scroll-snap-align 是子项属性，定义子项对齐到容器 snap 点的方式：none（不作为 snap 点）/ start（左/上对齐）/ center（居中对齐）/ end（右/下对齐）。可与 scroll-snap-type 配合生效，单个子项可设两个值（start end）让两端都是 snap 点。多元素可设不同 align，浏览器滚动停止时选择最近 snap 点。常见用法：轮播图 slide 设 start（左对齐）、画廊图片设 center（居中）、宽横幅设 start end（两端吸附）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ snapAlignInfo: this._readSnapAlignInfo() }) }), this._btn('start', { size: 'sm', disabled: !f.snapAlignStart, onClick: () => this._setSnapAlign('start') }), this._btn('center', { size: 'sm', disabled: !f.snapAlignCenter, onClick: () => this._setSnapAlign('center') }), this._btn('end', { size: 'sm', disabled: !f.snapAlignStart, onClick: () => this._setSnapAlign('end') }), this._btn('none', { size: 'sm', onClick: () => this._setSnapAlign('none') })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '横滑演示（当前 scroll-snap-align: ' + this._snapAlignMode + '）：'),
                h('div', { class: 'snap-align-stage' }, h('div', { class: 'snap-item' }, 'A'), h('div', { class: 'snap-item' }, 'B'), h('div', { class: 'snap-item' }, 'C'), h('div', { class: 'snap-item' }, 'D'), h('div', { class: 'snap-item' }, 'E')),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.snapAlignInfo || '（点击按钮切换 scroll-snap-align 查看说明）')),
                h(Alert, {
                    type: 'info',
                    message: 'scroll-snap-align 必须配合 scroll-snap-type 才生效',
                    description: 'scroll-snap-type 定义"在哪里吸附"（轴 + 严格度），scroll-snap-align 定义"对齐到子项的哪个边"。两者必须同时设置。center 让子项居中（适合画廊），start 让子项左对齐（适合轮播图），单元素可设 start end 让两端都是 snap 点。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 4：scroll-padding 与 scroll-margin ===================
    _readPaddingMarginInfo() {
        const f = this._flags();
        try {
            const stage = this.el && this.el.querySelector('.scroll-pad-stage');
            let computedPad = '(未渲染)';
            let computedMar = '(未渲染)';
            if (stage) {
                computedPad = window.getComputedStyle(stage).getPropertyValue('scroll-padding') || '(空)';
                const item = stage.querySelector('.snap-item');
                if (item) {
                    computedMar = window.getComputedStyle(item).getPropertyValue('scroll-margin') || '(空)';
                }
            }
            return `===== scroll-padding 与 scroll-margin =====\n` +
                `\n` +
                `【scroll-padding（容器属性）】\n` +
                `  scroll-padding: <length> | <percentage>\n` +
                `  作用：定义滚动容器的"吸附偏移区域"，snap 点相对此区域计算\n` +
                `  常见场景：顶部固定导航栏遮挡内容，scroll-padding 留出空间\n` +
                `\n` +
                `  分轴属性：\n` +
                `    scroll-padding-top / right / bottom / left\n` +
                `    scroll-padding-block / scroll-padding-inline（逻辑属性）\n` +
                `    scroll-padding-block-start / -end\n` +
                `    scroll-padding-inline-start / -end\n` +
                `\n` +
                `【scroll-margin（子项属性）】\n` +
                `  scroll-margin: <length>\n` +
                `  作用：定义子项的"吸附偏移量"，子项 snap 点相对此偏移计算\n` +
                `  常见场景：子项需要额外留白（如卡片边距）\n` +
                `\n` +
                `  分轴属性：\n` +
                `    scroll-margin-top / right / bottom / left\n` +
                `    scroll-margin-block / scroll-margin-inline（逻辑属性）\n` +
                `\n` +
                `【与 position: sticky 协同】\n` +
                `  顶部固定导航常用 position: sticky; top: 0;\n` +
                `  但 sticky 元素会遮挡 snap 点内容\n` +
                `  解决：scroll-padding-top: 60px;（导航高度）\n` +
                `  这样 snap 点会偏移 60px，避免被导航遮挡\n` +
                `\n` +
                `【scroll-padding vs scroll-margin】\n` +
                `  scroll-padding：作用于容器，影响所有 snap 点的偏移基准\n` +
                `  scroll-margin：作用于子项，仅影响该子项的 snap 点偏移\n` +
                `  两者可叠加：最终 snap 点 = 容器 scroll-padding + 子项 scroll-margin\n` +
                `\n` +
                `【当前演示元素】\n` +
                `  .scroll-pad-stage {\n` +
                `    scroll-snap-type: x mandatory;\n` +
                `    scroll-padding: ${this._scrollPaddingMode};\n` +
                `  }\n` +
                `    scroll-padding 计算值="${computedPad}"\n` +
                `  .scroll-pad-stage .snap-item { scroll-margin: 10px; }\n` +
                `    scroll-margin 计算值="${computedMar}"\n` +
                `  CSS.supports('scroll-padding','20px') = ${f.scrollPadding}\n` +
                `  CSS.supports('scroll-margin','10px') = ${f.scrollMargin}\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  /* 顶部固定导航 + 分页滚动 */\n` +
                `  .page-container {\n` +
                `    overflow-y: auto;\n` +
                `    scroll-snap-type: y mandatory;\n` +
                `    scroll-padding-top: 60px;     /* 留出固定导航高度 */\n` +
                `    scroll-padding-bottom: 20px;\n` +
                `    height: 100vh;\n` +
                `  }\n` +
                `  .page-container .section {\n` +
                `    scroll-snap-align: start;\n` +
                `    scroll-margin-top: 10px;      /* 子项额外留白 */\n` +
                `    min-height: 100vh;\n` +
                `  }\n` +
                `\n` +
                `  /* 固定导航 */\n` +
                `  .navbar {\n` +
                `    position: sticky;\n` +
                `    top: 0;\n` +
                `    height: 60px;\n` +
                `    background: #fff;\n` +
                `    z-index: 10;\n` +
                `  }\n` +
                `\n` +
                `【逻辑属性】\n` +
                `  /* 随 writing-mode 自适应 */\n` +
                `  .vertical-pages {\n` +
                `    writing-mode: vertical-rl;\n` +
                `    scroll-snap-type: block mandatory;\n` +
                `    scroll-padding-block: 20px;   /* 块方向偏移 */\n` +
                `    scroll-padding-inline: 10px;  /* 行方向偏移 */\n` +
                `  }`;
        }
        catch (err) {
            return `读取 scroll-padding/margin 信息失败：${err.name} - ${err.message}`;
        }
    }
    _setScrollPadding(mode) {
        this._scrollPaddingMode = mode;
        this._injectStyle('css-scroll-pad-dynamic', `.scroll-pad-stage { scroll-padding: ${mode}; }`);
        this.setState({ paddingMarginInfo: this._readPaddingMarginInfo() });
        this._addLog('padding', `切换 scroll-padding → ${mode}`);
    }
    _renderCard4() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '4. scroll-padding 与 scroll-margin —— 吸附偏移与固定导航协同',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['scroll-padding', f.scrollPadding],
                ['scroll-margin', f.scrollMargin],
            ]), h(Tag, { color: 'primary' }, '偏移属性')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'scroll-padding（容器属性）定义滚动容器的吸附偏移区域，scroll-margin（子项属性）定义子项的吸附偏移量。常见场景：顶部固定导航（position: sticky）遮挡 snap 点内容，用 scroll-padding-top: 60px 留出导航高度。两者可叠加（最终 snap 点 = 容器 scroll-padding + 子项 scroll-margin）。支持逻辑属性 scroll-padding-block/inline、scroll-margin-block/inline，随 writing-mode 翻转。浏览器支持：Chrome 69+ / Firefox 68+ / Safari 14.1+（旧 Safari 用 scroll-snap-padding 旧名）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ paddingMarginInfo: this._readPaddingMarginInfo() }) }), this._btn('padding 0', { size: 'sm', disabled: !f.scrollPadding, onClick: () => this._setScrollPadding('0px') }), this._btn('padding 20px', { size: 'sm', disabled: !f.scrollPadding, onClick: () => this._setScrollPadding('20px') }), this._btn('padding 40px', { size: 'sm', disabled: !f.scrollPadding, onClick: () => this._setScrollPadding('40px') })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '横滑演示（scroll-padding: ' + this._scrollPaddingMode + '，子项 scroll-margin: 10px）：'),
                h('div', { class: 'scroll-pad-stage' }, h('div', { class: 'snap-item' }, 'Card 1'), h('div', { class: 'snap-item' }, 'Card 2'), h('div', { class: 'snap-item' }, 'Card 3'), h('div', { class: 'snap-item' }, 'Card 4')),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.paddingMarginInfo || '（点击按钮切换 scroll-padding 查看说明）')),
                h(Alert, {
                    type: 'info',
                    message: 'scroll-padding 解决固定导航遮挡 snap 点问题',
                    description: '顶部固定导航（position: sticky）会遮挡 snap 点内容，用 scroll-padding-top: 60px（导航高度）留出空间。scroll-padding 作用于容器影响所有 snap 点，scroll-margin 作用于子项仅影响该项，两者可叠加。支持逻辑属性 scroll-padding-block/inline 随 writing-mode 翻转。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 5：scroll-snap-stop 强制停止 ===================
    _readSnapStopInfo() {
        const f = this._flags();
        try {
            return `===== scroll-snap-stop 强制停止 =====\n` +
                `\n` +
                `【语法】\n` +
                `  scroll-snap-stop: normal | always\n` +
                `\n` +
                `【取值详解】\n` +
                `  normal  —— 默认，允许快速滑动跳过多个 snap 点\n` +
                `              用户用力滑动可一次跳过多页\n` +
                `              适合：图片画廊（用户想快速浏览）\n` +
                `  always  —— 强制在每个 snap 点停止，不允许跳过\n` +
                `              即使用户用力滑动，也只前进一页\n` +
                `              适合：轮播图（一页一屏，防止误操作跳过）\n` +
                `\n` +
                `【防止快速滑动跳过多个 snap 点】\n` +
                `  场景：手机端横滑相册，用户用力一滑可能跳过 3-5 张\n` +
                `  解决：scroll-snap-stop: always;\n` +
                `  原理：浏览器在触摸惯性滚动到达下一个 snap 点时强制停止\n` +
                `        不允许惯性继续越过该 snap 点\n` +
                `\n` +
                `【移动端原生体验】\n` +
                `  iOS UIImagePickerController 横滑相册：每张照片独立停止\n` +
                `  Android ViewPager：默认一页一滑，需用力滑动才跳多页\n` +
                `  scroll-snap-stop: always 让 Web 体验接近原生\n` +
                `\n` +
                `【与触摸惯性协同】\n` +
                `  触摸滑动的惯性由浏览器控制（momentum scrolling）\n` +
                `  scroll-snap-stop: normal 时，惯性可越过多个 snap 点\n` +
                `  scroll-snap-stop: always 时，惯性在第一个 snap 点强制停止\n` +
                `  注意：鼠标滚轮滚动通常不受 scroll-snap-stop 影响（依赖浏览器实现）\n` +
                `\n` +
                `【当前演示元素】\n` +
                `  .snap-carousel .slide { scroll-snap-stop: ${this._snapStopMode}; }\n` +
                `  CSS.supports('scroll-snap-stop','always') = ${f.snapStop}\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  /* 全屏轮播图：强制每页停止 */\n` +
                `  .full-carousel {\n` +
                `    display: flex;\n` +
                `    overflow-x: auto;\n` +
                `    scroll-snap-type: x mandatory;\n` +
                `  }\n` +
                `  .full-carousel .slide {\n` +
                `    flex: 0 0 100%;\n` +
                `    scroll-snap-align: start;\n` +
                `    scroll-snap-stop: always;     /* 防快速滑动跳过 */\n` +
                `  }\n` +
                `\n` +
                `  /* 图片画廊：允许快速跳过 */\n` +
                `  .gallery {\n` +
                `    overflow-x: auto;\n` +
                `    scroll-snap-type: x proximity;\n` +
                `  }\n` +
                `  .gallery .photo {\n` +
                `    scroll-snap-align: center;\n` +
                `    scroll-snap-stop: normal;     /* 默认，可快速浏览 */\n` +
                `  }\n` +
                `\n` +
                `【浏览器支持】\n` +
                `  scroll-snap-stop 较新：Chrome 81+ / Firefox 75+ / Safari 14.1+ / Edge 81+\n` +
                `  老浏览器（Chrome < 81）不支持，回退为 normal 行为（可跳过）\n` +
                `  移动端 iOS Safari 14.1+ 支持，Android Chrome 81+ 支持`;
        }
        catch (err) {
            return `读取 scroll-snap-stop 信息失败：${err.name} - ${err.message}`;
        }
    }
    _setSnapStop(mode) {
        this._snapStopMode = mode;
        this._injectStyle('css-snap-stop-dynamic', `.snap-carousel .slide { scroll-snap-stop: ${mode}; }`);
        this.setState({ snapStopInfo: this._readSnapStopInfo() });
        this._addLog('snap-stop', `切换 scroll-snap-stop → ${mode}（${mode === 'always' ? '强制每页停止' : '允许快速跳过'}）`);
    }
    _renderCard5() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '5. scroll-snap-stop 强制停止 —— normal / always',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['snap-stop:always', f.snapStop]]), h(Tag, { color: 'primary' }, '移动端体验')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'scroll-snap-stop 控制是否允许快速滑动跳过多个 snap 点：normal（默认，允许跳过，适合画廊）/ always（强制每个 snap 点停止，适合轮播图）。移动端原生体验：iOS 相册、Android ViewPager 默认一页一滑，scroll-snap-stop: always 让 Web 体验接近原生。与触摸惯性协同：normal 时惯性可越过多个 snap 点，always 时在第一个 snap 点强制停止。浏览器支持较新：Chrome 81+ / Firefox 75+ / Safari 14.1+。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ snapStopInfo: this._readSnapStopInfo() }) }), this._btn('normal', { size: 'sm', onClick: () => this._setSnapStop('normal') }), this._btn('always', { type: 'primary', size: 'sm', disabled: !f.snapStop, onClick: () => this._setSnapStop('always') })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '全屏轮播图演示（当前 scroll-snap-stop: ' + this._snapStopMode + '，真实浏览器用力滑动观察是否跳过）：'),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.snapStopInfo || '（点击按钮切换 scroll-snap-stop 查看说明）')),
                h(Alert, {
                    type: 'info',
                    message: 'scroll-snap-stop: always 防止快速滑动跳过多个 snap 点',
                    description: 'normal（默认）允许快速滑动跳过多个 snap 点（适合画廊），always 强制每个 snap 点停止（适合轮播图一页一屏）。移动端触摸惯性滚动时，always 在第一个 snap 点强制停止，让 Web 体验接近 iOS 相册 / Android ViewPager 原生行为。浏览器支持较新（Chrome 81+ / Safari 14.1+）。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 6：实战：全屏轮播图 ===================
    _readCarouselInfo() {
        const f = this._flags();
        try {
            return `===== 实战：全屏轮播图 =====\n` +
                `\n` +
                `【场景 1：水平横滑相册】\n` +
                `  .h-carousel {\n` +
                `    display: flex;\n` +
                `    overflow-x: auto;\n` +
                `    scroll-snap-type: x mandatory;\n` +
                `    scroll-behavior: smooth;\n` +
                `  }\n` +
                `  .h-carousel .slide {\n` +
                `    flex: 0 0 100%;           /* 每张占满宽度 */\n` +
                `    scroll-snap-align: start;\n` +
                `    scroll-snap-stop: always;  /* 一页一滑 */\n` +
                `  }\n` +
                `\n` +
                `【场景 2：垂直分页滚动】\n` +
                `  .v-pages {\n` +
                `    overflow-y: auto;\n` +
                `    scroll-snap-type: y mandatory;\n` +
                `    scroll-padding-top: 60px;  /* 固定导航留空 */\n` +
                `    height: 100vh;\n` +
                `  }\n` +
                `  .v-pages .page {\n` +
                `    scroll-snap-align: start;\n` +
                `    scroll-snap-stop: always;\n` +
                `    min-height: 100vh;\n` +
                `  }\n` +
                `\n` +
                `【场景 3：嵌套滚动容器】\n` +
                `  外层垂直分页 + 内层水平横滑相册\n` +
                `  .outer { scroll-snap-type: y mandatory; overflow-y: auto; }\n` +
                `  .outer .section { scroll-snap-align: start; }\n` +
                `  .inner { scroll-snap-type: x mandatory; overflow-x: auto; }\n` +
                `  .inner .slide { scroll-snap-align: start; }\n` +
                `  注意：嵌套时内层 snap 不影响外层，外层 snap 不影响内层\n` +
                `\n` +
                `【场景 4：与 IntersectionObserver 懒加载协同】\n` +
                `  监听 slide 进入视口时加载图片（懒加载）\n` +
                `  const io = new IntersectionObserver((entries) => {\n` +
                `    entries.forEach(entry => {\n` +
                `      if (entry.isIntersecting) {\n` +
                `        const img = entry.target.querySelector('img');\n` +
                `        img.src = img.dataset.src;   /* 真实加载 */\n` +
                `        io.unobserve(entry.target);\n` +
                `      }\n` +
                `    });\n` +
                `  }, { root: carouselEl, threshold: 0.5 });\n` +
                `  carouselEl.querySelectorAll('.slide').forEach(s => io.observe(s));\n` +
                `\n` +
                `【场景 5：焦点管理】\n` +
                `  滑动到新 slide 后，将焦点移到该 slide 内的可聚焦元素\n` +
                `  carouselEl.addEventListener('scroll', () => {\n` +
                `    clearTimeout(scrollTimer);\n` +
                `    scrollTimer = setTimeout(() => {\n` +
                `      const slides = carouselEl.querySelectorAll('.slide');\n` +
                `      const idx = Math.round(carouselEl.scrollLeft / carouselEl.clientWidth);\n` +
                `      const focusable = slides[idx].querySelector('a, button, [tabindex]');\n` +
                `      focusable && focusable.focus();\n` +
                `    }, 150);  /* 滚动停止后聚焦 */\n` +
                `  });\n` +
                `\n` +
                `【能力检测】\n` +
                `  scroll-snap-type 支持 = ${f.snapTypeX}\n` +
                `  scroll-snap-stop 支持 = ${f.snapStop}`;
        }
        catch (err) {
            return `读取轮播图实战信息失败：${err.name} - ${err.message}`;
        }
    }
    _runCarouselDemo() {
        this.setState({ carouselInfo: this._readCarouselInfo() });
        this._addLog('carousel', `全屏轮播图演示：当前索引 ${this._carouselIndex}，snap-type=${this._flags().snapTypeX}`);
    }
    _carouselGoTo(idx) {
        this._carouselIndex = idx;
        const carousel = this.el && this.el.querySelector('.snap-carousel');
        if (carousel) {
            try {
                carousel.scrollTo({ left: idx * carousel.clientWidth, behavior: 'smooth' });
            }
            catch { /* jsdom 不实现 scrollTo */ }
        }
        this._addLog('carousel', `跳转到 Slide ${idx + 1}`);
    }
    _renderCard6() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '6. 实战：全屏轮播图 —— 横滑相册 / 垂直分页 / 嵌套 / 懒加载 / 焦点',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['snap-type', f.snapTypeX], ['snap-stop', f.snapStop]]), h(Tag, { color: 'primary' }, '5 大场景')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '全屏轮播图五大场景：水平横滑相册（scroll-snap-type: x mandatory + flex: 0 0 100% + scroll-snap-stop: always 一页一滑）、垂直分页滚动（scroll-snap-type: y mandatory + scroll-padding-top 留固定导航空）、嵌套滚动容器（外层垂直分页 + 内层横滑相册，互不影响）、与 IntersectionObserver 懒加载协同（监听 slide 进入视口加载图片）、焦点管理（滑动停止后聚焦到当前 slide 可聚焦元素）。配合 scroll-behavior: smooth 实现平滑过渡。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取实战信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runCarouselDemo() }), this._btn('Slide 1', { size: 'sm', onClick: () => this._carouselGoTo(0) }), this._btn('Slide 2', { size: 'sm', onClick: () => this._carouselGoTo(1) }), this._btn('Slide 3', { size: 'sm', onClick: () => this._carouselGoTo(2) }), this._btn('Slide 4', { size: 'sm', onClick: () => this._carouselGoTo(3) }), this._btn('Slide 5', { size: 'sm', onClick: () => this._carouselGoTo(4) })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '全屏轮播图演示（点击按钮切换，真实浏览器可拖动滑动）：'),
                h('div', { class: 'snap-carousel' }, h('div', { class: 'slide slide-1' }, 'Slide 1'), h('div', { class: 'slide slide-2' }, 'Slide 2'), h('div', { class: 'slide slide-3' }, 'Slide 3'), h('div', { class: 'slide slide-4' }, 'Slide 4'), h('div', { class: 'slide slide-5' }, 'Slide 5')),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } }, h('code', {}, s.carouselInfo || '（点击按钮查看 5 大轮播图场景完整代码）')),
                h(Alert, {
                    type: 'info',
                    message: 'scroll-snap + IntersectionObserver + 焦点管理实现完整轮播',
                    description: '5 大场景：水平横滑相册（x mandatory + flex 0 0 100% + snap-stop always）、垂直分页（y mandatory + scroll-padding-top）、嵌套滚动（外纵内横互不影响）、IntersectionObserver 懒加载（监听 slide 进入视口）、焦点管理（scroll 事件防抖后聚焦）。配合 scroll-behavior: smooth 平滑过渡。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 7：实战：图片画廊与 Tabs 选项卡 ===================
    _readGalleryTabsInfo() {
        const f = this._flags();
        try {
            return `===== 实战：图片画廊与 Tabs 选项卡 =====\n` +
                `\n` +
                `【场景 1：Tabs 选项卡切换 + scroll-snap】\n` +
                `  顶部 tab 栏可横滑（小屏自动滚动）+ 内容区 snap\n` +
                `  .tabs-bar {\n` +
                `    display: flex;\n` +
                `    overflow-x: auto;\n` +
                `    scroll-snap-type: x proximity;  /* 接近吸附 */\n` +
                `  }\n` +
                `  .tabs-bar .tab {\n` +
                `    scroll-snap-align: start;\n` +
                `    white-space: nowrap;\n` +
                `    padding: 8px 16px;\n` +
                `  }\n` +
                `  /* 点击 tab 滚动到对应内容 */\n` +
                `  tab.addEventListener('click', () => {\n` +
                `    content.scrollTo({ left: idx * content.clientWidth, behavior: 'smooth' });\n` +
                `  });\n` +
                `\n` +
                `【场景 2：图片网格 + 分页】\n` +
                `  每页 4 张图片，横滑切换页\n` +
                `  .photo-grid-pages {\n` +
                `    display: flex;\n` +
                `    overflow-x: auto;\n` +
                `    scroll-snap-type: x mandatory;\n` +
                `  }\n` +
                `  .photo-grid-pages .page {\n` +
                `    flex: 0 0 100%;\n` +
                `    scroll-snap-align: start;\n` +
                `    scroll-snap-stop: always;\n` +
                `    display: grid;\n` +
                `    grid-template-columns: repeat(2, 1fr);\n` +
                `    gap: 10px;\n` +
                `  }\n` +
                `\n` +
                `【场景 3：移动端 Drawer】\n` +
                `  底部抽屉可上下滑动展开/收起，snap 到固定位置\n` +
                `  .drawer {\n` +
                `    overflow-y: auto;\n` +
                `    scroll-snap-type: y mandatory;\n` +
                `    height: 100vh;\n` +
                `  }\n` +
                `  .drawer-collapsed { scroll-snap-align: start; height: 20vh; }\n` +
                `  .drawer-expanded { scroll-snap-align: start; height: 80vh; }\n` +
                `\n` +
                `【场景 4：iOS/Android 原生体验对比】\n` +
                `  iOS UIScrollView pagingEnabled: true\n` +
                `    → 等价 scroll-snap-type: x mandatory + scroll-snap-stop: always\n` +
                `  Android ViewPager\n` +
                `    → 等价 scroll-snap-type: x mandatory + flex 0 0 100%\n` +
                `  iOS UICollectionView paging\n` +
                `    → 等价 scroll-snap-type: x mandatory + scroll-snap-align: start\n` +
                `  Web 优势：纯 CSS 实现，无需 JS 库；劣势：触摸惯性体验略逊原生\n` +
                `\n` +
                `【能力检测】\n` +
                `  scroll-snap-type 支持 = ${f.snapTypeX}\n` +
                `  scroll-snap-align 支持 = ${f.snapAlignStart}`;
        }
        catch (err) {
            return `读取画廊/Tabs 实战信息失败：${err.name} - ${err.message}`;
        }
    }
    _runGalleryTabsDemo() {
        this.setState({ galleryTabsInfo: this._readGalleryTabsInfo() });
        this._addLog('gallery', `图片画廊与 Tabs 演示：snap-type=${this._flags().snapTypeX}`);
    }
    _renderCard7() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '7. 实战：图片画廊与 Tabs 选项卡 —— Tabs / 网格 / Drawer / 原生对比',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['snap-type', f.snapTypeX], ['snap-align', f.snapAlignStart]]), h(Tag, { color: 'primary' }, '4 大场景')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '图片画廊与 Tabs 四大场景：Tabs 选项卡切换 + scroll-snap（顶部 tab 栏横滑 proximity 吸附 + 点击滚动到内容）、图片网格 + 分页（每页 4 张 grid + 横滑切换页）、移动端 Drawer（底部抽屉上下 snap 展开/收起）、iOS/Android 原生体验对比（iOS UIScrollView pagingEnabled 等价 x mandatory + always，Android ViewPager 等价 x mandatory + flex 100%）。Web 优势：纯 CSS 无需 JS 库；劣势：触摸惯性体验略逊原生。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取实战信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runGalleryTabsDemo() })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, 'Tabs 选项卡 + scroll-snap 演示：'),
                h('div', { class: 'snap-tabs' }, h('div', { class: 'tab active' }, '首页'), h('div', { class: 'tab' }, '产品'), h('div', { class: 'tab' }, '解决方案'), h('div', { class: 'tab' }, '案例'), h('div', { class: 'tab' }, '关于我们'), h('div', { class: 'tab' }, '联系我们')),
                h('div', { class: 'snap-tab-panel' }, '当前 Tab：首页（小屏下 tab 栏可横滑，scroll-snap-type: x proximity 接近吸附）'),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } }, h('code', {}, s.galleryTabsInfo || '（点击按钮查看 4 大画廊/Tabs 场景完整代码）')),
                h(Alert, {
                    type: 'info',
                    message: 'scroll-snap 让 Web 体验接近 iOS/Android 原生',
                    description: 'iOS UIScrollView pagingEnabled: true 等价 scroll-snap-type: x mandatory + scroll-snap-stop: always。Android ViewPager 等价 x mandatory + flex 0 0 100%。Web 优势：纯 CSS 无需 JS 库；劣势：触摸惯性体验略逊原生。Tabs + scroll-snap 让小屏 tab 栏自动横滑吸附。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 9：scroll-start / scroll-start-target（Level 2 草案）===================
    _readScrollStartInfo() {
        const f = this._flags();
        try {
            return `===== scroll-start / scroll-start-target 声明式滚动定位 =====\n` +
                `\n` +
                `【规范归属】\n` +
                `  CSS Scroll Snap Module Level 2（W3C Editor's Draft 草案）\n` +
                `  规范地址：https://drafts.csswg.org/css-scroll-snap-2/\n` +
                `  在 Level 1 基础上新增 scroll-start / scroll-start-target 两个属性\n` +
                `  浏览器支持：仅 Chrome 124+ 实现，Safari/Firefox 截至 2024 未实现\n` +
                `\n` +
                `【核心动机：声明式 vs 命令式】\n` +
                `  传统命令式（JS）：el.scrollTo({top:200}) / el.scrollIntoView()\n` +
                `    缺点：需要 JS 执行；SSR 首屏渲染后才能滚动；初始闪烁（FOUC）\n` +
                `  声明式（CSS）：scroll-start: 50%\n` +
                `    优点：浏览器在初始渲染时直接定位；无需 JS；SSR 友好；无闪烁\n` +
                `  vs scrollIntoView()：scroll-start 仅指定初始位置，不触发主动滚动\n` +
                `\n` +
                `【scroll-start 容器属性】\n` +
                `  语法：scroll-start: 0 | <length> | <percentage> | center\n` +
                `\n` +
                `  scroll-start: 0       —— 滚动容器初始滚动位置在起点（默认）\n` +
                `  scroll-start: 50%      —— 初始滚动到容器内容的 50% 处\n` +
                `  scroll-start: 100px    —— 初始滚动到 100px 像素位置\n` +
                `  scroll-start: center   —— 初始滚动到内容居中位置\n` +
                `\n` +
                `  作用：声明式指定滚动容器的初始滚动位置\n` +
                `  与 scroll-snap-type 协同：scroll-snap 在 scroll-start 之后再次吸附到最近 snap 点\n` +
                `\n` +
                `【单轴 / 逻辑属性】\n` +
                `  scroll-start-x: <value>      —— 仅 x 轴初始位置\n` +
                `  scroll-start-y: <value>      —— 仅 y 轴初始位置\n` +
                `  scroll-start-block: <value>  —— 块方向初始位置（随 writing-mode 翻转）\n` +
                `  scroll-start-inline: <value> —— 行方向初始位置（随 writing-mode 翻转）\n` +
                `  scroll-start: 50%            —— 简写，等价同时设置 x/y（或 block/inline）\n` +
                `\n` +
                `【scroll-start-target 子元素属性】\n` +
                `  语法：scroll-start-target: start | center | end | nearest\n` +
                `\n` +
                `  scroll-start-target: start    —— 滚动到此元素时对齐到 start 边\n` +
                `  scroll-start-target: center   —— 滚动到此元素时居中对齐\n` +
                `  scroll-start-target: end      —— 滚动到此元素时对齐到 end 边\n` +
                `  scroll-start-target: nearest  —— 滚动到此元素时对齐到最近边\n` +
                `\n` +
                `  作用：指定当浏览器滚动到该元素时的对齐位置\n` +
                `  与 scroll-into-view（scrollIntoView）协同：scrollIntoView 也遵守此对齐\n` +
                `  与 scroll-snap-align 区别：\n` +
                `    scroll-snap-align      —— 滚动停止后吸附到 snap 点的对齐\n` +
                `    scroll-start-target    —— 声明式 / scrollIntoView 滚动到此元素时的对齐\n` +
                `    前者作用于"滚动结束吸附"，后者作用于"主动滚动到此元素"\n` +
                `\n` +
                `【实战 1：Tab 选项卡默认选中第 2 个】\n` +
                `  场景：Tab 栏初始默认选中第 2 个 Tab（而非第 1 个）\n` +
                `  /* 命令式（旧）：JS 在 DOMContentLoaded 后 scrollTo */\n` +
                `  tabsEl.scrollTo({ left: tab2.offsetLeft, behavior: 'instant' });\n` +
                `\n` +
                `  /* 声明式（新）：纯 CSS */\n` +
                `  .tabs-bar { overflow-x: auto; }\n` +
                `  .tabs-bar .tab:nth-child(2) { scroll-start-target: start; }\n` +
                `\n` +
                `  优势：无需 JS、SSR 友好、初始渲染即定位、无闪烁\n` +
                `\n` +
                `【实战 2：长列表默认滚动到某项】\n` +
                `  .long-list { overflow-y: auto; }\n` +
                `  .long-list .item.current { scroll-start-target: center; }\n` +
                `  /* 浏览器初始即滚动到 .current 项并居中 */\n` +
                `\n` +
                `【实战 3：与 scroll-snap-stop 协同】\n` +
                `  .carousel {\n` +
                `    overflow-x: auto;\n` +
                `    scroll-snap-type: x mandatory;\n` +
                `    scroll-start: 100%;        /* 初始滚动到末尾 */\n` +
                `  }\n` +
                `  .carousel .slide:last-child {\n` +
                `    scroll-snap-align: end;\n` +
                `    scroll-snap-stop: always;\n` +
                `  }\n` +
                `\n` +
                `【实战 4：分页文章阅读位置持久化】\n` +
                `  场景：刷新后保持阅读位置\n` +
                `  /* 与 sessionStorage 持久化 */\n` +
                `  sessionStorage.setItem('readPos', String(window.scrollY));\n` +
                `  const pos = Number(sessionStorage.getItem('readPos') || 0);\n` +
                `  /* 声明式：用 CSS 变量传递位置 */\n` +
                `  document.documentElement.style.setProperty('--read-pos', pos + 'px');\n` +
                `  /* CSS */\n` +
                `  .article-container {\n` +
                `    overflow-y: auto;\n` +
                `    scroll-start: var(--read-pos, 0);\n` +
                `  }\n` +
                `\n` +
                `  /* 与 history.scrollRestoration 协同 */\n` +
                `  if ('scrollRestoration' in history) {\n` +
                `    history.scrollRestoration = 'manual';   /* 禁用浏览器自动恢复 */\n` +
                `    /* 改用 scroll-start 声明式控制 */\n` +
                `  }\n` +
                `\n` +
                `【与命令式 API 对比】\n` +
                `  命令式 scrollTo()/scrollIntoView()：\n` +
                `    - 需要 JS 执行\n` +
                `    - SSR 首屏渲染后才滚动（FOUC 闪烁）\n` +
                `    - 可在任意时机触发（用户点击、路由变化等）\n` +
                `  声明式 scroll-start / scroll-start-target：\n` +
                `    - 仅初始定位，浏览器渲染时直接定位（无闪烁）\n` +
                `    - SSR 友好（首屏即正确位置）\n` +
                `    - 性能更优（避免 JS 布局计算 + 滚动）\n` +
                `    - 局限：仅初始定位，运行时滚动仍需 scrollTo\n` +
                `  推荐组合：初始定位用 scroll-start；运行时滚动用 scrollTo\n` +
                `\n` +
                `【陷阱】\n` +
                `  1. 浏览器支持有限：仅 Chrome 124+ 实现\n` +
                `     Safari / Firefox 截至 2024 未实现，需降级到 JS scrollTo\n` +
                `  2. 与 scroll-snap-type 冲突：\n` +
                `     scroll-start 设置初始位置后，scroll-snap 可能再次吸附到最近 snap 点\n` +
                `     若 scroll-start 不在 snap 点上，会出现"先定位再吸附"的双跳\n` +
                `  3. 仅初始定位不持续：\n` +
                `     scroll-start 仅在元素首次渲染时生效\n` +
                `     用户滚动后再次刷新才会重新生效\n` +
                `  4. 与 CSS Anchor Positioning 协同：\n` +
                `     未来可与 anchor 定位协同（如 scroll-start: anchor(--my-anchor)）\n` +
                `     目前规范未明确，浏览器未实现\n` +
                `  5. 降级到 JS scrollTo：\n` +
                `     if (!CSS.supports('scroll-start', '0')) {\n` +
                `       el.scrollTo({ top: 200, behavior: 'instant' });\n` +
                `     }\n` +
                `\n` +
                `【当前演示元素】\n` +
                `  .scroll-start-stage {\n` +
                `    scroll-snap-type: x proximity;\n` +
                `    scroll-start: 50%;\n` +
                `  }\n` +
                `  .scroll-start-stage .snap-item.is-target {\n` +
                `    scroll-start-target: ${this._scrollStartTargetMode};\n` +
                `  }\n` +
                `  CSS.supports('scroll-start','0') = ${f.scrollStart0}\n` +
                `  CSS.supports('scroll-start','50%') = ${f.scrollStart50}\n` +
                `  CSS.supports('scroll-start','center') = ${f.scrollStartCenter}\n` +
                `  CSS.supports('scroll-start-target','start') = ${f.scrollStartTargetStart}\n` +
                `\n` +
                `【浏览器支持】\n` +
                `  scroll-start / scroll-start-target —— 仅 Chrome 124+（2024-05+）\n` +
                `  Safari / Firefox 截至 2024 未实现\n` +
                `  降级：JS scrollTo({top:...}) / scrollIntoView({block:'start'})\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  /* Tab 选项卡默认选中第 2 个 */\n` +
                `  .tabs-bar {\n` +
                `    display: flex;\n` +
                `    overflow-x: auto;\n` +
                `    scroll-snap-type: x proximity;\n` +
                `  }\n` +
                `  .tabs-bar .tab {\n` +
                `    scroll-snap-align: start;\n` +
                `    flex: 0 0 auto;\n` +
                `    padding: 8px 16px;\n` +
                `  }\n` +
                `  .tabs-bar .tab:nth-child(2) {\n` +
                `    scroll-start-target: start;   /* 初始滚动到第 2 个 Tab */\n` +
                `  }\n` +
                `\n` +
                `  /* 分页文章阅读位置持久化 */\n` +
                `  :root { --read-pos: 0px; }\n` +
                `  .article-container {\n` +
                `    overflow-y: auto;\n` +
                `    scroll-start: var(--read-pos);\n` +
                `    height: 100vh;\n` +
                `  }\n` +
                `\n` +
                `  /* 降级 */\n` +
                `  if (typeof CSS !== 'undefined' && !CSS.supports('scroll-start', '0')) {\n` +
                `    el.scrollTo({ top: 200, behavior: 'instant' });\n` +
                `  }`;
        }
        catch (err) {
            return `读取 scroll-start 信息失败：${err.name} - ${err.message}`;
        }
    }
    _setScrollStartTarget(mode) {
        this._scrollStartTargetMode = mode;
        this._injectStyle('css-scroll-start-dynamic', `.scroll-start-stage .snap-item.is-target { scroll-start-target: ${mode}; }`);
        this.setState({ scrollStartInfo: this._readScrollStartInfo() });
        this._addLog('scroll-start', `切换 scroll-start-target → ${mode}（Level 2 草案，仅 Chrome 124+）`);
    }
    _runScrollStartDemo() {
        this.setState({ scrollStartInfo: this._readScrollStartInfo() });
        const f = this._flags();
        this._addLog('scroll-start', `scroll-start 演示：target=${this._scrollStartTargetMode}，scroll-start:0=${f.scrollStart0}，scroll-start:50%=${f.scrollStart50}（Level 2 草案，仅 Chrome 124+）`);
    }
    _renderCard9() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '9. scroll-start / scroll-start-target —— Level 2 草案 / Chrome 124+ / 声明式滚动定位',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['scroll-start:0', f.scrollStart0],
                ['scroll-start:50%', f.scrollStart50],
                ['scroll-start:center', f.scrollStartCenter],
                ['scroll-start-target:start', f.scrollStartTargetStart],
            ]), h(Tag, { color: 'warning' }, 'Level 2 草案')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'scroll-start / scroll-start-target 是 CSS Scroll Snap Module Level 2 草案新增属性，声明式指定滚动容器初始位置（scroll-start: 0 / 50% / 100px / center，单轴 scroll-start-x/y、逻辑 scroll-start-block/inline）和子元素被滚动到时的对齐位置（scroll-start-target: start / center / end / nearest）。vs 命令式 scrollIntoView()：声明式无需 JS、SSR 友好、初始渲染即定位、无 FOUC 闪烁。浏览器支持仅 Chrome 124+（2024-05+），Safari/Firefox 未实现需降级到 JS scrollTo。实战：Tab 选项卡默认选中第 2 个、长列表默认滚动到某项、与 scroll-snap-stop 协同、分页文章阅读位置持久化（sessionStorage + history.scrollRestoration = manual）。陷阱：与 scroll-snap-type 双跳吸附、仅初始定位不持续、降级 scrollTo({behavior:"instant"})。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runScrollStartDemo() }), this._btn('target:start', { size: 'sm', disabled: !f.scrollStartTargetStart, onClick: () => this._setScrollStartTarget('start') }), this._btn('target:center', { type: 'primary', size: 'sm', disabled: !f.scrollStartTargetStart, onClick: () => this._setScrollStartTarget('center') }), this._btn('target:end', { size: 'sm', disabled: !f.scrollStartTargetStart, onClick: () => this._setScrollStartTarget('end') }), this._btn('target:nearest', { size: 'sm', disabled: !f.scrollStartTargetStart, onClick: () => this._setScrollStartTarget('nearest') })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '横滑演示（容器 scroll-start: 50%，第 3 项 scroll-start-target: ' + this._scrollStartTargetMode + '，真实 Chrome 124+ 初始即定位 / 其他浏览器忽略）：'),
                h('div', { class: 'scroll-start-stage' }, h('div', { class: 'snap-item' }, 'Item 1'), h('div', { class: 'snap-item' }, 'Item 2'), h('div', { class: 'snap-item is-target' }, 'Item 3 (target)'), h('div', { class: 'snap-item' }, 'Item 4'), h('div', { class: 'snap-item' }, 'Item 5')),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '700px', overflow: 'auto' } }, h('code', {}, s.scrollStartInfo || '（点击按钮查看 scroll-start / scroll-start-target 完整说明）')),
                h(Alert, {
                    type: 'warning',
                    message: 'scroll-start 声明式滚动定位：Level 2 草案，仅 Chrome 124+',
                    description: 'scroll-start / scroll-start-target 声明式指定滚动容器初始位置和子元素对齐方式。vs scrollIntoView()：无需 JS、SSR 友好、初始渲染即定位、无 FOUC 闪烁。浏览器支持有限（仅 Chrome 124+，Safari/Firefox 未实现），需降级到 JS scrollTo({behavior:"instant"})。陷阱：与 scroll-snap-type 可能双跳吸附、仅初始定位不持续、与 anchor 协同待规范明确。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 8：陷阱与最佳实践 ===================
    _readPitfallsInfo() {
        const f = this._flags();
        try {
            return `===== CSS Scroll Snap 陷阱与最佳实践 =====\n` +
                `\n` +
                `【陷阱 1：mandatory vs proximity 取舍】\n` +
                `  mandatory 强制吸附：可预测但可能违反用户意图\n` +
                `    适合：轮播图、全屏分页（一屏一页）\n` +
                `    风险：用户想停在中间查看时被迫吸附到 snap 点\n` +
                `  proximity 接近吸附：用户意图优先但吸附不明确\n` +
                `    适合：图片画廊、文章列表、Tabs 栏\n` +
                `    风险：吸附行为不可预测，用户体验不一致\n` +
                `  建议：分页场景用 mandatory，浏览场景用 proximity\n` +
                `\n` +
                `【陷阱 2：焦点跳变问题】\n` +
                `  键盘 Tab 切换聚焦元素时，浏览器自动滚动聚焦元素到视口\n` +
                `  这会破坏 scroll-snap 的吸附位置\n` +
                `  解决：\n` +
                `    1. 监听 scroll 事件，防抖后重新吸附到最近 snap 点\n` +
                `    2. 用 tabindex="-1" 让非活动 slide 不参与 Tab 序列\n` +
                `    3. 主动管理焦点（滑动后聚焦当前 slide）\n` +
                `\n` +
                `【陷阱 3：与 position: sticky 冲突】\n` +
                `  顶部固定导航 position: sticky; top: 0; 会遮挡 snap 点\n` +
                `  解决：scroll-padding-top: 60px;（导航高度）\n` +
                `  注意：sticky 元素本身也可设 scroll-snap-align（不推荐，行为不稳定）\n` +
                `\n` +
                `【陷阱 4：DevTools 调试】\n` +
                `  Chrome DevTools 支持 scroll-snap 可视化：\n` +
                `    Elements 面板 → 选中滚动容器 → 看到 snap 点标记\n` +
                `    还可调试 scroll-padding 区域（紫色边框）\n` +
                `  Firefox DevTools 也支持类似可视化\n` +
                `\n` +
                `【陷阱 5：屏幕阅读器】\n` +
                `  scroll-snap 不影响屏幕阅读器的阅读顺序（仍按 DOM 顺序）\n` +
                `  但 snap 切换可能让屏幕阅读器用户困惑（视口跳转）\n` +
                `  解决：\n` +
                `    1. 用 aria-live="polite" 通知 slide 切换\n` +
                `    2. 提供"上一页/下一页"按钮作为键盘等价\n` +
                `    3. 不要依赖 scroll-snap 作为唯一导航方式\n` +
                `\n` +
                `【陷阱 6：RTL 与 writing-mode 适配】\n` +
                `  RTL（direction: rtl）时，scroll-snap-type: x 仍生效\n` +
                `    但 start/end 含义翻转（start = 右，end = 左）\n` +
                `  writing-mode: vertical-rl 时，x/y 轴不变，但 block/inline 翻转\n` +
                `    scroll-snap-type: block 等价 x（横向）\n` +
                `  建议用逻辑属性 block/inline 替代 x/y 适配多语言\n` +
                `\n` +
                `【陷阱 7：与 scroll-behavior: smooth 协同】\n` +
                `  scroll-behavior: smooth 让 scrollTo/scrollIntoView 平滑滚动\n` +
                `  scroll-snap 的吸附也会受 scroll-behavior 影响（平滑 vs 瞬间）\n` +
                `  建议：scroll-snap-type: x mandatory; scroll-behavior: smooth;\n` +
                `  注意：smooth 在某些场景下可能感觉"迟钝"，可用 JS 控制时机\n` +
                `\n` +
                `【最佳实践清单】\n` +
                `  ✓ 分页场景用 mandatory，浏览场景用 proximity\n` +
                `  ✓ 配合 scroll-padding-top 留出固定导航空间\n` +
                `  ✓ 用 scroll-snap-stop: always 防快速滑动跳过（轮播图）\n` +
                `  ✓ 配合 IntersectionObserver 实现懒加载\n` +
                `  ✓ 主动管理焦点（滑动后聚焦当前 slide）\n` +
                `  ✓ 提供"上一页/下一页"按钮作为键盘等价\n` +
                `  ✓ 用 block/inline 逻辑属性适配 RTL/writing-mode\n` +
                `  ✓ 配合 scroll-behavior: smooth 平滑过渡\n` +
                `  ✓ DevTools 调试 snap 点与 scroll-padding 区域\n` +
                `  ✓ 不要依赖 scroll-snap 作为唯一导航（屏幕阅读器友好）\n` +
                `\n` +
                `  CSS.supports('scroll-snap-type','x mandatory') = ${f.snapTypeX}\n` +
                `  CSS.supports('scroll-snap-stop','always') = ${f.snapStop}`;
        }
        catch (err) {
            return `读取陷阱与最佳实践信息失败：${err.name} - ${err.message}`;
        }
    }
    _runPitfallsDemo() {
        this.setState({ pitfallsInfo: this._readPitfallsInfo() });
        this._addLog('pitfalls', `陷阱与最佳实践演示完成；snap-type=${this._flags().snapTypeX}, snap-stop=${this._flags().snapStop}`);
    }
    _renderCard8() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '8. 陷阱与最佳实践 —— mandatory/proximity / 焦点 / sticky / RTL / smooth',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['snap-type', f.snapTypeX], ['snap-stop', f.snapStop]]), h(Tag, { color: 'warning' }, '7 大陷阱')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '七大陷阱：mandatory vs proximity 取舍（分页用 mandatory、浏览用 proximity）、焦点跳变（键盘 Tab 破坏吸附，用 tabindex="-1" + 主动管理焦点）、与 position: sticky 冲突（sticky 遮挡 snap 点，用 scroll-padding-top）、DevTools 调试（Chrome/Firefox 支持 snap 点可视化）、屏幕阅读器（snap 不影响阅读顺序，提供按钮等价 + aria-live）、RTL/writing-mode 适配（start/end 翻转，用 block/inline 逻辑属性）、与 scroll-behavior: smooth 协同（平滑过渡）。10 条最佳实践覆盖分页/浏览取舍、固定导航、键盘等价、多语言适配等。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行陷阱与最佳实践演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runPitfallsDemo() })),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } }, h('code', {}, s.pitfallsInfo || '（点击按钮查看 7 大陷阱与 10 条最佳实践完整说明）')),
                h(Alert, {
                    type: 'warning',
                    message: 'mandatory 违反用户意图，proximity 吸附不明确；键盘焦点破坏 snap',
                    description: '陷阱清单：mandatory/proximity 取舍（分页 mandatory、浏览 proximity）、焦点跳变（tabindex="-1" + 主动管理）、sticky 冲突（scroll-padding-top）、屏幕阅读器（提供按钮等价 + aria-live）、RTL/writing-mode（用 block/inline 逻辑属性）、scroll-behavior: smooth 协同。最佳实践：分页/浏览取舍 + 固定导航留空 + 键盘等价 + 多语言适配。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== 日志面板（按时间倒序，最新在上）===================
    _renderLogPanel() {
        const s = this.state;
        const reversed = [...s.logs].reverse(); // 按时间倒序：最新日志在最上方
        return h('div', { class: 'log-panel' }, h('div', { class: 'log-panel__header' }, '事件日志（按时间倒序）', h(Tag, { color: 'primary' }, `${s.logs.length} 条`)), reversed.length === 0
            ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
            : reversed.map((log) => h('div', { class: 'log-panel__line' }, h('span', { class: 'log-panel__time' }, log.time), h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type), h('span', { class: 'log-panel__content' }, log.content))));
    }
    // =================== 整页渲染 ===================
    render() {
        const s = this.state;
        return h('div', { class: 'api-lab-page css-scroll-snap-page' }, h('h2', { class: 'section-title' }, 'CSS Scroll Snap Module Level 1 实验室'), h('p', { class: 'fs-sm text-secondary mb-md' }, '本页演示 CSS Scroll Snap Module 滚动吸附：scroll-snap-type 容器属性（x mandatory / y proximity / both）、scroll-snap-align 子项属性（start / center / end）、scroll-padding 与 scroll-margin 偏移（固定导航协同）、scroll-snap-stop 强制停止（防快速跳过）、全屏轮播图实战（横滑相册 / 垂直分页 / 嵌套 / 懒加载 / 焦点）、图片画廊与 Tabs 选项卡（Tabs 切换 / 网格分页 / Drawer / 原生对比）、scroll-start / scroll-start-target 声明式滚动定位（Level 2 草案 / Chrome 124+ / 声明式初始位置 vs 命令式 scrollIntoView）、陷阱与最佳实践（mandatory/proximity 取舍 / 焦点跳变 / sticky 冲突 / RTL / smooth）。所有特性通过 typeof / CSS.supports 能力检测，不可用时仅记日志，绝不抛异常。'), s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderCard7(), this._renderCard9(), this._renderCard8(), this._renderLogPanel());
    }
}
//# sourceMappingURL=CSSScrollSnapPage.js.map