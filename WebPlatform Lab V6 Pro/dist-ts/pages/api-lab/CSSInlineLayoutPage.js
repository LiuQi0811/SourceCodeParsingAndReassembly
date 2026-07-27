// =====================================================================
// CSSInlineLayoutPage.js —— CSS Inline Layout Module Level 3 实验室
// 演示 W3C CSS Inline Layout Module Level 3 行内级排版特性
//   （与 CSSTextAdvancedPage 互补：CSSTextAdvancedPage 关注文本换行/对齐/标点
//    等 CSS Text Module；本页关注行内盒模型与基线，覆盖行内盒对齐、
//    initial-letters drop cap、inline-sizing 行内盒尺寸控制等）：
//   1. 概述：CSS Inline Layout Module 概述 + 与 CSS Text Module 区别 +
//      Level 3 状态 + 行内盒模型与基线概念
//   2. dominant-baseline —— auto/text-bottom/alphabetic/ideographic/middle/
//      central/mathematical/hanging/text-top，SVG 与 CSS 共用同一属性
//   3. baseline-shift —— sub/super/<length>/<percentage>，与 <sup>/<sub> 元素
//      对比，数学公式上下标排版
//   4. initial-letters —— normal|<integer> <integer>|drop|raise，drop cap 排版
//      与 ::first-letter 协同，Chrome 110+/Safari 17+ 支持
//   5. inline-sizing —— normal|stretch，行内元素宽高控制，与 display:inline-block
//      对比，浏览器支持有限（实验性）
//   6. alignment-baseline 与 text-anchor —— SVG 内文本对齐，与 dominant-baseline
//      协同，图标 + 文字基线对齐实战
//   7. 实战场景 —— 图标与文字垂直居中、数学公式排版、多语言混排基线对齐、
//      drop cap 杂志排版
//   8. 兼容性与降级 —— vertical-align 历史方案、flexbox align-items: baseline
//      替代、浏览器支持矩阵、与 SVG <text> 元素协同
// 说明：所有特性调用前做 typeof / CSS.supports 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。jsdom 不做真实 CSS 渲染，
//       CSS.supports 通常可用；initial-letter / inline-sizing / baseline-shift 等
//       较新或实验性属性 jsdom 可能不识别，统一 try/catch 兜底。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class CSSInlineLayoutPage extends Page {
    _inited = false;
    _dynamicStyles = [];
    _domBaselineMode = '';
    _baselineShiftMode = '';
    _initialLettersOn = false;
    _initialLettersSize = 0;
    _inlineSizingOn = false;
    _alignBaselineMode = '';
    _textAnchorMode = '';
    // —— 初始 state ——
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            // Card 1：概述
            overviewInfo: '',
            // Card 2：dominant-baseline
            dominantBaselineInfo: '',
            // Card 3：baseline-shift
            baselineShiftInfo: '',
            // Card 4：initial-letters
            initialLettersInfo: '',
            // Card 5：inline-sizing
            inlineSizingInfo: '',
            // Card 6：alignment-baseline 与 text-anchor
            alignmentBaselineInfo: '',
            // Card 7：实战场景
            scenariosInfo: '',
            // Card 8：兼容性与降级
            compatInfo: '',
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
        this._domBaselineMode = 'alphabetic'; // Card 2 当前 dominant-baseline 值
        this._baselineShiftMode = 'none'; // Card 3 当前 baseline-shift 值
        this._initialLettersOn = false; // Card 4 initial-letter 是否开启
        this._initialLettersSize = 3; // Card 4 drop cap 行数
        this._inlineSizingOn = false; // Card 5 inline-sizing 是否开启
        this._alignBaselineMode = 'auto'; // Card 6 当前 alignment-baseline 值
        this._textAnchorMode = 'start'; // Card 6 当前 text-anchor 值
        // 一次性能力检测：CSS Inline Layout Module Level 3 全家桶
        const f = this._flags();
        const c = (ok) => ok ? '✓' : '✗';
        const parts = [
            `CSS ${c(f.css)}`, `supports ${c(f.supports)}`,
            `dominant-baseline ${c(f.dominantBaseline)}`,
            `baseline-shift ${c(f.baselineShift)}`,
            `initial-letter ${c(f.initialLetter)}`,
            `inline-sizing ${c(f.inlineSizing)}`,
            `alignment-baseline ${c(f.alignmentBaseline)}`,
            `text-anchor ${c(f.textAnchor)}`,
            `vertical-align ${c(f.verticalAlign)}`,
        ];
        const summary = f.css
            ? `CSS Inline Layout Module Level 3 特性能力检测：${parts.join(' · ')}。jsdom 不做真实 CSS 渲染，但 CSS.supports 通常可用；initial-letter / inline-sizing / baseline-shift 等较新或实验性属性 jsdom 可能不识别，按钮将仅记日志说明。在真实浏览器中打开可完整演示（Chrome 110+/Safari 17+ 支持 initial-letter；inline-sizing 仍实验性）。`
            : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。';
        this.setState({ capsSummary: summary });
        this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!f.dominantBaseline)
            this._addLog('warn', 'dominant-baseline 不可用或 jsdom 未识别（SVG 1.1 起支持，CSS Inline Layout L3 引入 CSS 上下文）');
        if (!f.baselineShift)
            this._addLog('warn', 'baseline-shift 不可用或 jsdom 未识别（实验性，Firefox 仅 SVG 上下文支持）');
        if (!f.initialLetter)
            this._addLog('warn', 'initial-letter 不可用或 jsdom 未识别（Chrome 110+/Safari 17+，Firefox 仍 behind flag）');
        if (!f.inlineSizing)
            this._addLog('warn', 'inline-sizing 不可用或 jsdom 未识别（仍实验性，仅 Firefox 部分实现）');
        // 一次性注入全部演示样式（仅一次；rerender 不会移除 head 中的 style）
        this._injectDemoStyles();
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
    _flags() {
        const hasCSS = typeof CSS !== 'undefined';
        const supportsPV = (p, v) => {
            try {
                return hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v);
            }
            catch {
                return false;
            }
        };
        return {
            css: hasCSS,
            supports: hasCSS && typeof CSS.supports === 'function',
            // Card 2
            dominantBaseline: supportsPV('dominant-baseline', 'central') ||
                supportsPV('dominant-baseline', 'middle'),
            // Card 3
            baselineShift: supportsPV('baseline-shift', 'sub') ||
                supportsPV('baseline-shift', 'super'),
            // Card 4
            initialLetter: supportsPV('initial-letter', '3') ||
                supportsPV('initial-letter', 'drop 3'),
            // Card 5
            inlineSizing: supportsPV('inline-sizing', 'stretch'),
            // Card 6
            alignmentBaseline: supportsPV('alignment-baseline', 'central') ||
                supportsPV('alignment-baseline', 'middle'),
            textAnchor: supportsPV('text-anchor', 'middle'),
            // Card 8
            verticalAlign: supportsPV('vertical-align', 'baseline') ||
                supportsPV('vertical-align', 'middle'),
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
    // —— 动态注入所有演示样式 ——
    _injectDemoStyles() {
        this._injectStyle('css-inline-layout-demo', `
      /* ===== Card 2: dominant-baseline ===== */
      .dom-baseline-stage { padding: 8px 12px; border: 1px solid var(--color-border, #ccc);
        border-radius: 4px; margin-top: 8px; font-size: 16px; line-height: 1.8;
        background: var(--color-bg-spotlight, #f5f5f5); }
      .dom-baseline-stage .row { display: flex; align-items: baseline; gap: 8px; margin: 4px 0; }
      .dom-baseline-stage .icon-box { display: inline-block; width: 24px; height: 24px;
        border: 1px dashed var(--color-primary, #1677ff); background: var(--color-primary-bg, #e6f0ff);
        text-align: center; font-size: 16px; line-height: 24px; }
      /* ===== Card 3: baseline-shift ===== */
      .baseline-shift-stage { padding: 8px 12px; border-left: 3px solid var(--color-success, #10b981);
        background: var(--color-success-bg, #e6f9ee); border-radius: 4px; margin-top: 8px;
        font-size: 16px; line-height: 1.8; }
      .baseline-shift-stage .formula { font-family: 'Cambria Math', 'Times New Roman', serif;
        font-size: 18px; }
      .baseline-shift-stage sup, .baseline-shift-stage sub { font-size: 0.75em; }
      .baseline-shift-stage .bs-shift { baseline-shift: super; font-size: 0.75em; }
      .baseline-shift-stage .bs-sub { baseline-shift: sub; font-size: 0.75em; }
      .baseline-shift-stage .bs-len { baseline-shift: 0.4em; font-size: 0.75em; color: var(--color-primary, #1677ff); }
      /* ===== Card 4: initial-letters ===== */
      .initial-letters-stage { padding: 12px 16px; border: 1px solid var(--color-border, #ccc);
        border-radius: 4px; margin-top: 8px; font-size: 15px; line-height: 1.8;
        background: var(--color-bg-spotlight, #f5f5f5); max-width: 480px; }
      .initial-letters-stage p { margin: 0; text-align: justify; }
      .initial-letters-stage::first-letter {
        initial-letter: 3;
        font-weight: 700; color: var(--color-primary, #1677ff);
        margin-right: 6px;
      }
      .initial-letters-off::first-letter { initial-letter: normal; font-weight: inherit; color: inherit; }
      /* ===== Card 5: inline-sizing ===== */
      .inline-sizing-stage { padding: 8px 12px; border: 1px dashed var(--color-border, #ccc);
        border-radius: 4px; margin-top: 8px; font-size: 15px; line-height: 1.8;
        background: var(--color-bg-spotlight, #f5f5f5); }
      .inline-sizing-stage .is-target { background: var(--color-primary-bg, #e6f0ff);
        padding: 2px 6px; border-radius: 3px; inline-sizing: stretch; min-width: 80px;
        text-align: center; display: inline; }
      .inline-sizing-stage .is-ib { display: inline-block; background: var(--color-success-bg, #e6f9ee);
        padding: 2px 6px; border-radius: 3px; width: 120px; text-align: center; }
      /* ===== Card 6: alignment-baseline / text-anchor ===== */
      .align-baseline-stage { padding: 12px; border: 1px solid var(--color-border, #ccc);
        border-radius: 4px; margin-top: 8px; background: var(--color-bg-spotlight, #f5f5f5); }
      .align-baseline-stage .svg-row { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; }
      .align-baseline-stage svg { background: #fff; border: 1px dashed var(--color-border, #ccc);
        border-radius: 3px; }
      /* ===== Card 7: 实战场景 ===== */
      .scenarios-stage { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
      .scenarios-stage .scene { padding: 8px 12px; border: 1px solid var(--color-border, #ccc);
        border-radius: 4px; background: var(--color-bg-spotlight, #f5f5f5); font-size: 14px; line-height: 1.8; }
      .scenarios-stage .icon-text { display: flex; align-items: baseline; gap: 6px; font-size: 16px; }
      .scenarios-stage .icon-text .icon { display: inline-block; width: 20px; height: 20px;
        background: var(--color-primary, #1677ff); color: #fff; border-radius: 50%;
        text-align: center; line-height: 20px; font-size: 12px;
        dominant-baseline: central; }
      .scenarios-stage .math { font-family: 'Cambria Math', 'Times New Roman', serif;
        font-size: 18px; padding: 4px 0; }
      .scenarios-stage .math .sup { baseline-shift: super; font-size: 0.7em; }
      .scenarios-stage .math .sub { baseline-shift: sub; font-size: 0.7em; }
      .scenarios-stage .mix { font-size: 16px; }
      .scenarios-stage .mix .cn { font-family: 'PingFang SC', 'Microsoft YaHei', serif; }
      .scenarios-stage .mix .en { font-family: Georgia, serif; }
      .scenarios-stage .mix .num { font-family: 'SF Mono', Consolas, monospace; dominant-baseline: central; }
      .scenarios-stage .magazine { font-size: 15px; line-height: 1.8; text-align: justify; max-width: 460px; }
      .scenarios-stage .magazine::first-letter {
        initial-letter: 3; font-weight: 700; color: var(--color-primary, #1677ff);
        margin-right: 6px;
      }
      /* ===== Card 8: 兼容性与降级 ===== */
      .compat-stage { padding: 8px 12px; border: 1px solid var(--color-border, #ccc);
        border-radius: 4px; margin-top: 8px; font-size: 14px; line-height: 1.8;
        background: var(--color-bg-spotlight, #f5f5f5); }
      .compat-stage .va-demo span.va-middle { vertical-align: middle; }
      .compat-stage .va-demo span.va-top { vertical-align: top; }
      .compat-stage .va-demo span.va-text-bottom { vertical-align: text-bottom; }
      .compat-stage .flex-baseline { display: flex; align-items: baseline; gap: 8px; margin-top: 6px; }
      .compat-stage .flex-baseline .big { font-size: 24px; }
      .compat-stage .flex-baseline .small { font-size: 12px; color: var(--color-text-secondary, #888); }
      .compat-stage .matrix { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
      .compat-stage .matrix th, .compat-stage .matrix td { border: 1px solid var(--color-border, #ccc);
        padding: 4px 8px; text-align: left; }
      .compat-stage .matrix th { background: var(--color-primary-bg, #e6f0ff); font-weight: 600; }
      .compat-stage .matrix .yes { color: var(--color-success, #10b981); }
      .compat-stage .matrix .no { color: var(--color-error, #ef4444); }
      .compat-stage .matrix .partial { color: var(--color-warning, #f59e0b); }
    `);
    }
    // =================== Card 1：概述 ===================
    _readOverviewInfo() {
        const f = this._flags();
        try {
            return `CSS Inline Layout Module 概述：\n` +
                `  CSS.supports('dominant-baseline','central') = ${f.dominantBaseline}\n` +
                `  CSS.supports('baseline-shift','super') = ${f.baselineShift}\n` +
                `  CSS.supports('initial-letter','3') = ${f.initialLetter}\n` +
                `  CSS.supports('inline-sizing','stretch') = ${f.inlineSizing}\n` +
                `  CSS.supports('alignment-baseline','central') = ${f.alignmentBaseline}\n` +
                `  CSS.supports('text-anchor','middle') = ${f.textAnchor}\n` +
                `  CSS.supports('vertical-align','middle') = ${f.verticalAlign}\n\n` +
                'CSS Inline Layout Module 与 CSS Text Module 区别：\n' +
                '  CSS Text Module：关注文本流（换行、对齐、断字、标点、空白折叠）—— 文本"内容"如何流\n' +
                '  CSS Inline Layout Module：关注行内盒模型（inline box）与基线对齐——\n' +
                '    inline-level box 在行盒（line box）中如何被定位、对齐、缩放\n' +
                '  两者互补：CSS Text 决定文字怎么排，CSS Inline Layout 决定行内盒怎么对齐\n\n' +
                '行内盒模型与基线概念：\n' +
                '  line box（行盒）：包含一行内所有 inline-level box 的矩形区域\n' +
                '  inline-level box：display: inline/inline-block/inline-flex/inline-grid 等产生的盒\n' +
                '  strut：行盒内隐式的占位盒，决定最小行高（line-height 继承的零宽盒）\n' +
                '  baseline（基线）：英文字母（如 x）下沿所在的水平线，inline box 对齐的参照\n' +
                '  alphabetic baseline：字母基线（默认）；text-top/text-bottom：文本框上下沿\n' +
                '  central baseline：行盒中央；middle：x-height 中点；hanging：悬挂基线（天城文）\n' +
                '  ideographic baseline：表意文字基线（CJK 字符下沿）\n\n' +
                '规范状态：CSS Inline Layout Module Level 3 仍为 W3C Working Draft（2024+），\n' +
                '  其中 dominant-baseline / baseline-shift / alignment-baseline 早期源自 SVG 1.1，\n' +
                '  现被 CSS Inline Layout L3 引入 CSS 上下文。initial-letter（CSS Inline Layout L3\n' +
                '  独立章节）Chrome 110+/Safari 17+ 支持，Firefox 仍 behind flag。\n' +
                '  inline-sizing 仍实验性，仅 Firefox 部分实现。';
        }
        catch (err) {
            return `读取 概述 信息失败：${err.name} - ${err.message}`;
        }
    }
    _runOverviewDemo() {
        this.setState({ overviewInfo: this._readOverviewInfo() });
        const f = this._flags();
        this._addLog('overview', `能力检测汇总：dominant-baseline=${f.dominantBaseline}, initial-letter=${f.initialLetter}, inline-sizing=${f.inlineSizing}`);
    }
    _renderCard1() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '1. 概述：CSS Inline Layout Module',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['dominant-baseline', f.dominantBaseline],
                ['initial-letter', f.initialLetter],
                ['inline-sizing', f.inlineSizing],
            ]), h(Tag, { color: 'primary' }, 'Level 3 WD')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'CSS Inline Layout Module Level 3 关注行内盒模型（inline-level box）在行盒（line box）中的定位、对齐与缩放，与 CSS Text Module（关注文本流换行/对齐/标点）互补。核心概念：line box（行盒）、inline-level box（display:inline/inline-block/inline-flex 等）、strut（行盒内隐式占位盒决定最小行高）、baseline（基线，包括 alphabetic/central/middle/hanging/ideographic 等多种）。规范现为 W3C Working Draft，其中 dominant-baseline/baseline-shift/alignment-baseline 源自 SVG 1.1，initial-letter（Chrome 110+/Safari 17+）、inline-sizing（仍实验性）为新增。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取概述信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runOverviewDemo() })),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.overviewInfo || '（点击「读取概述信息」查看 CSS Inline Layout Module 全景）')),
                h(Alert, {
                    type: 'info',
                    message: 'CSS Inline Layout 决定行内盒如何对齐，CSS Text 决定文本如何流',
                    description: '两者互补：CSS Text Module 控制 text-wrap / hanging-punctuation / hyphens / white-space-collapse 等"文本流"属性；CSS Inline Layout Module 控制 dominant-baseline / baseline-shift / initial-letter / inline-sizing 等"行内盒"对齐与缩放属性。规范现为 Working Draft，部分属性（如 dominant-baseline）已通过 SVG 1.1 普遍支持。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 2：dominant-baseline ===================
    _readDominantBaselineInfo() {
        const f = this._flags();
        try {
            const stage = this.el && this.el.querySelector('.dom-baseline-stage');
            let computed = '(未渲染)';
            if (stage) {
                const iconBox = stage.querySelector('.icon-box');
                if (iconBox) {
                    computed = window.getComputedStyle(iconBox).getPropertyValue('dominant-baseline') || '(空)';
                }
            }
            return `dominant-baseline 演示：\n` +
                `  .dom-baseline-stage .icon-box { dominant-baseline: ${this._domBaselineMode}; }\n` +
                `  dominant-baseline 计算值="${computed}"\n` +
                `  CSS.supports('dominant-baseline','central') = ${f.dominantBaseline}\n\n` +
                '说明：\n' +
                '  dominant-baseline 指定 inline-level box 的"主导基线"，用于与其他行内盒对齐\n' +
                '  auto | text-bottom | alphabetic | ideographic | middle | central | mathematical | hanging | text-top\n' +
                '    auto：默认（通常是 alphabetic，但 SVG <text> 默认 alphabetic；<tspan> 继承）\n' +
                '    alphabetic：英文字母基线（"x" 下沿，西文默认）\n' +
                '    text-bottom：文本框下沿\n' +
                '    text-top：文本框上沿\n' +
                '    ideographic：表意文字基线（CJK 字符下沿）\n' +
                '    central：行盒中央（中点，与 middle 略不同：central 用 em-box 中点）\n' +
                '    middle：x-height 中点（"x" 字母垂直中点）\n' +
                '    mathematical：数学基线（用于数学符号）\n' +
                '    hanging：悬挂基线（天城文/藏文等顶部基线）\n\n' +
                'SVG 与 CSS 共用：\n' +
                '  dominant-baseline 最初定义于 SVG 1.1（用于 <text>/<tspan>），后被 CSS Inline Layout\n' +
                '  Module L3 引入 CSS 上下文。SVG 上下文支持广泛（Chrome/Firefox/Safari 全支持）；\n' +
                '  CSS 上下文（HTML 元素）支持较新，主流浏览器逐步支持。\n' +
                '  与 alignment-baseline 区别：dominant-baseline 设置自身主导基线，\n' +
                '    alignment-baseline 设置对齐到父级哪个基线。';
        }
        catch (err) {
            return `读取 dominant-baseline 信息失败：${err.name} - ${err.message}`;
        }
    }
    _setDominantBaseline(mode) {
        this._domBaselineMode = mode;
        this._injectStyle('css-dom-baseline-mode', `.dom-baseline-stage .icon-box { dominant-baseline: ${mode}; }`);
        this.setState({ dominantBaselineInfo: this._readDominantBaselineInfo() });
        const desc = {
            auto: '默认（通常 alphabetic）',
            alphabetic: '字母基线（西文默认）',
            central: '行盒中央（em-box 中点）',
            middle: 'x-height 中点',
            'text-bottom': '文本框下沿',
            'text-top': '文本框上沿',
            ideographic: '表意文字基线（CJK 下沿）',
            hanging: '悬挂基线（天城文等）',
            mathematical: '数学基线',
        }[mode];
        this._addLog('dominant', `切换 dominant-baseline → ${mode}（${desc}）`);
    }
    _renderCard2() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '2. dominant-baseline 行内盒主导基线',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['dominant-baseline', f.dominantBaseline]]), h(Tag, { color: 'primary' }, 'SVG + CSS 共用')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'dominant-baseline 指定 inline-level box 的主导基线：auto|text-bottom|alphabetic|ideographic|middle|central|mathematical|hanging|text-top。alphabetic 是西文默认字母基线，central 是行盒中央（em-box 中点，常用于图标与文字垂直居中），middle 是 x-height 中点（与 central 略不同），ideographic 是 CJK 表意文字基线，hanging 是天城文/藏文顶部基线。该属性最初定义于 SVG 1.1（用于 <text>/<tspan>），后被 CSS Inline Layout L3 引入 CSS 上下文，SVG 上下文支持广泛。与 alignment-baseline 区别：dominant-baseline 设置自身主导基线，alignment-baseline 设置对齐到父级哪个基线。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ dominantBaselineInfo: this._readDominantBaselineInfo() }) }), this._btn('alphabetic', { size: 'sm', disabled: !f.dominantBaseline, onClick: () => this._setDominantBaseline('alphabetic') }), this._btn('central', { size: 'sm', disabled: !f.dominantBaseline, onClick: () => this._setDominantBaseline('central') }), this._btn('middle', { size: 'sm', disabled: !f.dominantBaseline, onClick: () => this._setDominantBaseline('middle') }), this._btn('text-bottom', { size: 'sm', disabled: !f.dominantBaseline, onClick: () => this._setDominantBaseline('text-bottom') }), this._btn('text-top', { size: 'sm', disabled: !f.dominantBaseline, onClick: () => this._setDominantBaseline('text-top') }), this._btn('ideographic', { size: 'sm', disabled: !f.dominantBaseline, onClick: () => this._setDominantBaseline('ideographic') })),
                h('div', { class: 'dom-baseline-stage' }, h('div', { class: 'row' }, h('span', { class: 'icon-box' }, '★'), h('span', {}, '图标与文字基线对齐（当前 dominant-baseline = ' + this._domBaselineMode + '）')), h('div', { class: 'row' }, h('span', { class: 'icon-box' }, '◆'), h('span', {}, 'central 常用于图标垂直居中，alphabetic 是默认字母基线。'))),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '300px', overflow: 'auto' } }, h('code', {}, s.dominantBaselineInfo || '（点击按钮切换 dominant-baseline）')),
                h(Alert, {
                    type: 'info',
                    message: 'central 常用于图标垂直居中，alphabetic 是西文默认',
                    description: '图标与文字垂直居中推荐 dominant-baseline: central（em-box 中点），比 vertical-align: middle（x-height 中点）更精确。SVG <text> 默认 alphabetic。Chrome/Firefox/Safari 在 SVG 上下文全支持；CSS 上下文（HTML 元素）支持逐步完善。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 3：baseline-shift ===================
    _readBaselineShiftInfo() {
        const f = this._flags();
        try {
            const stage = this.el && this.el.querySelector('.baseline-shift-stage');
            const readComp = (sel, prop) => {
                const el = stage && stage.querySelector(sel);
                if (!el)
                    return '(未渲染)';
                return window.getComputedStyle(el).getPropertyValue(prop) || '(空)';
            };
            return `baseline-shift 演示：\n` +
                `  .bs-shift { baseline-shift: super; }    计算值="${readComp('.bs-shift', 'baseline-shift')}"\n` +
                `  .bs-sub   { baseline-shift: sub; }       计算值="${readComp('.bs-sub', 'baseline-shift')}"\n` +
                `  .bs-len   { baseline-shift: 0.4em; }     计算值="${readComp('.bs-len', 'baseline-shift')}"\n` +
                `  CSS.supports('baseline-shift','super') = ${f.baselineShift}\n\n` +
                '说明：\n' +
                '  baseline-shift 调整 inline-level box 相对其主导基线的偏移：\n' +
                '    baseline | sub | super | <length> | <percentage>\n' +
                '    baseline：默认（无偏移）\n' +
                '    sub：下标偏移（默认 ≈ -0.33em，向下）\n' +
                '    super：上标偏移（默认 ≈ +0.33em，向上）\n' +
                '    <length>：指定长度（如 0.4em 向上、-0.4em 向下）\n' +
                '    <percentage>：相对 line-height 的百分比\n\n' +
                '与 <sup>/<sub> 元素对比：\n' +
                '  <sup>/<sub> 是 HTML 语义元素，默认 vertical-align: super/sub（不是 baseline-shift）\n' +
                '  <sup>/<sub> 还会缩小字号（浏览器默认 font-size: smaller ≈ 0.83em）\n' +
                '  baseline-shift 是 CSS 属性，可在任意 inline 元素上施加，更精确控制偏移量\n' +
                '  语义上：化学式 H₂O 用 <sub>，数学公式 x² 用 <sup>，自定义上下标用 baseline-shift\n\n' +
                '采纳现状：baseline-shift 仍实验性（CSS Inline Layout L3 Working Draft），\n' +
                '  Firefox 仅在 SVG 上下文支持，Chrome/Safari 部分支持。生产多用 vertical-align: sub/super\n' +
                '  或 <sup>/<sub> 兜底。';
        }
        catch (err) {
            return `读取 baseline-shift 信息失败：${err.name} - ${err.message}`;
        }
    }
    _setBaselineShift(mode) {
        this._baselineShiftMode = mode;
        const map = {
            none: '.baseline-shift-stage .bs-shift { baseline-shift: baseline; } .baseline-shift-stage .bs-sub { baseline-shift: baseline; } .baseline-shift-stage .bs-len { baseline-shift: baseline; }',
            super: '.baseline-shift-stage .bs-shift { baseline-shift: super; } .baseline-shift-stage .bs-sub { baseline-shift: sub; } .baseline-shift-stage .bs-len { baseline-shift: 0.4em; }',
            len: '.baseline-shift-stage .bs-shift { baseline-shift: 0.5em; } .baseline-shift-stage .bs-sub { baseline-shift: -0.5em; } .baseline-shift-stage .bs-len { baseline-shift: 0.3em; }',
        };
        this._injectStyle('css-baseline-shift-mode', (map[mode]) || map.none);
        this.setState({ baselineShiftInfo: this._readBaselineShiftInfo() });
        const desc = {
            none: '默认（无偏移）',
            super: 'super/sub/0.4em 上下标',
            len: '自定义长度 0.5em/-0.5em',
        }[mode];
        this._addLog('shift', `切换 baseline-shift → ${mode}（${desc}）`);
    }
    _renderCard3() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '3. baseline-shift 上下标偏移',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['baseline-shift', f.baselineShift]]), h(Tag, { color: 'primary' }, 'sub/super/<length>')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'baseline-shift 调整 inline-level box 相对其主导基线的偏移：baseline（默认无偏移）| sub（下标 ≈ -0.33em 向下）| super（上标 ≈ +0.33em 向上）| <length>（指定长度）| <percentage>（相对 line-height）。与 HTML <sup>/<sub> 元素对比：<sup>/<sub> 是语义元素，默认用 vertical-align: super/sub 且缩小字号（smaller ≈ 0.83em）；baseline-shift 是 CSS 属性，可在任意 inline 元素施加，更精确控制偏移。语义上化学式 H₂O 用 <sub>，数学公式 x² 用 <sup>，自定义上下标用 baseline-shift。该属性仍实验性（CSS Inline Layout L3 WD），Firefox 仅 SVG 上下文支持，生产多用 vertical-align 或 <sup>/<sub> 兜底。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ baselineShiftInfo: this._readBaselineShiftInfo() }) }), this._btn('无偏移', { size: 'sm', disabled: !f.baselineShift, onClick: () => this._setBaselineShift('none') }), this._btn('super/sub', { size: 'sm', disabled: !f.baselineShift, onClick: () => this._setBaselineShift('super') }), this._btn('自定义长度', { size: 'sm', disabled: !f.baselineShift, onClick: () => this._setBaselineShift('len') })),
                h('div', { class: 'baseline-shift-stage' }, h('div', { class: 'formula' }, '数学公式：x', h('span', { class: 'bs-shift' }, '2'), ' + y', h('span', { class: 'bs-sub' }, '1'), ' = z', h('span', { class: 'bs-len' }, 'n')), h('div', { class: 'formula', style: { marginTop: '6px' } }, '对比 <sup>/<sub>：x', h('sup', {}, '2'), ' + y', h('sub', {}, '1'), ' = z', h('sup', {}, 'n')), h('div', { style: { marginTop: '6px', fontSize: '14px', color: 'var(--color-text-secondary, #888)' } }, 'baseline-shift 在支持的浏览器中显示偏移；不支持时仅展示缩小字号（<sup>/<sub> 始终生效）。')),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '300px', overflow: 'auto' } }, h('code', {}, s.baselineShiftInfo || '（点击按钮切换 baseline-shift 模式）')),
                h(Alert, {
                    type: 'warning',
                    message: 'baseline-shift 仍实验性，生产多用 <sup>/<sub> 或 vertical-align 兜底',
                    description: 'baseline-shift 仍为 CSS Inline Layout L3 Working Draft，Firefox 仅 SVG 上下文支持，Chrome/Safari 部分支持。语义场景：化学式 H₂O 用 <sub>、数学公式 x² 用 <sup>，自定义偏移可用 vertical-align: super/sub（兼容性更好）或 baseline-shift（更精确但需检测）。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 4：initial-letters ===================
    _readInitialLettersInfo() {
        const f = this._flags();
        try {
            const stage = this.el && this.el.querySelector('.initial-letters-stage');
            let computed = '(未渲染)';
            if (stage) {
                computed = window.getComputedStyle(stage, '::first-letter').getPropertyValue('initial-letter') || '(空)';
            }
            return `initial-letters 演示：\n` +
                `  .initial-letters-stage::first-letter { initial-letter: ${this._initialLettersOn ? this._initialLettersSize : 'normal'}; }\n` +
                `  ::first-letter initial-letter 计算值="${computed}"\n` +
                `  当前 drop cap 行数 = ${this._initialLettersOn ? this._initialLettersSize : '关闭'}\n` +
                `  CSS.supports('initial-letter','3') = ${f.initialLetter}\n\n` +
                '说明：\n' +
                '  initial-letter 控制 drop cap（首字下沉）排版：\n' +
                '    normal | <integer> <integer>? | drop <integer>? | raise <integer>?\n' +
                '    normal：默认（无 drop cap）\n' +
                '    <integer>：drop cap 占据的行数（如 initial-letter: 3 占 3 行高）\n' +
                '    <integer> <integer>：第一个是行数，第二个是"下沉深度"（占多少行的基线下方）\n' +
                '    drop <integer>：等价于 <integer>（首字下沉，独占多行）\n' +
                '    raise <integer>：首字"上升"（raise 1 ≈ super，不占多行）\n\n' +
                '与 ::first-letter 协同：\n' +
                '  initial-letter 必须配合 ::first-letter 伪元素使用（针对块级元素的首字符）\n' +
                '  示例：article::first-letter { initial-letter: 3; color: navy; }\n' +
                '  浏览器自动计算首字字号、行高、与正文的对齐，无需手动 font-size/margin/float\n' +
                '  替代历史方案：float: left + font-size: 3em + line-height: 0.8（hack 且不精确）\n\n' +
                '采纳现状：Chrome 110+/Safari 17+ 支持；Firefox 仍 behind flag（layout.css.initial-letter.enabled）；\n' +
                '  jsdom 不识别。生产建议渐进增强 + ::first-letter + float 兜底。';
        }
        catch (err) {
            return `读取 initial-letters 信息失败：${err.name} - ${err.message}`;
        }
    }
    _toggleInitialLetters() {
        this._initialLettersOn = !this._initialLettersOn;
        const val = this._initialLettersOn ? this._initialLettersSize : 'normal';
        this._injectStyle('css-initial-letters', `.initial-letters-stage::first-letter { initial-letter: ${val}; -webkit-initial-letter: ${val}; }`);
        // 关闭时加 class 让 ::first-letter 重置样式
        if (this.el) {
            const stage = this.el.querySelector('.initial-letters-stage');
            if (stage) {
                if (this._initialLettersOn)
                    stage.classList.remove('initial-letters-off');
                else
                    stage.classList.add('initial-letters-off');
            }
        }
        this.setState({ initialLettersInfo: this._readInitialLettersInfo() });
        this._addLog('initial', `切换 initial-letter → ${val}（${this._initialLettersOn ? 'drop cap 占 ' + this._initialLettersSize + ' 行' : '关闭 drop cap'}）`);
    }
    _setInitialLettersSize(n) {
        this._initialLettersSize = n;
        if (this._initialLettersOn) {
            this._injectStyle('css-initial-letters', `.initial-letters-stage::first-letter { initial-letter: ${n}; -webkit-initial-letter: ${n}; }`);
        }
        this.setState({ initialLettersInfo: this._readInitialLettersInfo() });
        this._addLog('initial', `调整 drop cap 行数 → ${n}（${this._initialLettersOn ? '已应用' : '未开启'}）`);
    }
    _renderCard4() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '4. initial-letters drop cap 首字下沉',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['initial-letter', f.initialLetter]]), h(Tag, { color: 'primary' }, 'Chrome 110+ / Safari 17+')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'initial-letter 控制 drop cap（首字下沉）排版：normal | <integer> <integer>? | drop <integer>? | raise <integer>?。initial-letter: 3 让首字占据 3 行高（drop cap），initial-letter: 3 2 第一个是行数、第二个是下沉深度（基线下方行数），raise 1 让首字上升约 super。必须配合 ::first-letter 伪元素使用（针对块级元素首字符），浏览器自动计算字号/行高/对齐，无需手动 float+font-size hack。Chrome 110+/Safari 17+ 支持，Firefox 仍 behind flag（layout.css.initial-letter.enabled）。生产建议渐进增强 + ::first-letter + float 兜底。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ initialLettersInfo: this._readInitialLettersInfo() }) }), this._btn(`initial-letter（${this._initialLettersOn ? '开启' : '关闭'}）`, { size: 'sm', disabled: !f.initialLetter, onClick: () => this._toggleInitialLetters() }), this._btn('2 行', { size: 'sm', disabled: !f.initialLetter, onClick: () => this._setInitialLettersSize(2) }), this._btn('3 行', { size: 'sm', disabled: !f.initialLetter, onClick: () => this._setInitialLettersSize(3) }), this._btn('4 行', { size: 'sm', disabled: !f.initialLetter, onClick: () => this._setInitialLettersSize(4) })),
                h('div', { class: 'initial-letters-stage' }, h('p', {}, '层叠样式表（CSS）是一种用来表现 HTML 或 XML 等文件样式的计算机语言。CSS Inline Layout Module Level 3 引入了 initial-letter 属性，用于实现 drop cap（首字下沉）排版——常见于杂志、书籍、新闻报道的首段。开启后首字"层"会占据多行高度，正文环绕其右侧。')),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '300px', overflow: 'auto' } }, h('code', {}, s.initialLettersInfo || '（点击按钮开启 initial-letter drop cap）')),
                h(Alert, {
                    type: 'info',
                    message: 'initial-letter 必须配合 ::first-letter 使用',
                    description: '示例：article::first-letter { initial-letter: 3; color: navy; }。浏览器自动计算首字字号、行高、与正文对齐，替代历史 hack（float: left + font-size: 3em + line-height: 0.8）。Chrome 110+/Safari 17+ 支持，Firefox 仍 behind flag。生产渐进增强：现代浏览器用 initial-letter，旧浏览器降级到 float+font-size。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 5：inline-sizing ===================
    _readInlineSizingInfo() {
        const f = this._flags();
        try {
            const stage = this.el && this.el.querySelector('.inline-sizing-stage');
            const readComp = (sel, prop) => {
                const el = stage && stage.querySelector(sel);
                if (!el)
                    return '(未渲染)';
                return window.getComputedStyle(el).getPropertyValue(prop) || '(空)';
            };
            return `inline-sizing 演示：\n` +
                `  .is-target { inline-sizing: ${this._inlineSizingOn ? 'stretch' : 'normal'}; min-width: 80px; }\n` +
                `    inline-sizing 计算值="${readComp('.is-target', 'inline-sizing')}"\n` +
                `  .is-ib { display: inline-block; width: 120px; }\n` +
                `    display 计算值="${readComp('.is-ib', 'display')}"\n` +
                `  CSS.supports('inline-sizing','stretch') = ${f.inlineSizing}\n\n` +
                '说明：\n' +
                '  inline-sizing 控制 inline-level box 是否可设置宽高：\n' +
                '    normal | stretch\n' +
                '    normal：默认（inline 元素 width/height 不生效，由内容撑开）\n' +
                '    stretch：让 inline 元素可设置宽高（自动 stretch 到指定尺寸）\n\n' +
                '与 display: inline-block 对比：\n' +
                '  display: inline-block：让元素既能设宽高，又保持行内布局（不换行）\n' +
                '    但 inline-block 会创建新的 BFC（块格式化上下文），影响基线对齐\n' +
                '    inline-block 默认 baseline 对齐到自身底部（除非 vertical-align 调整）\n' +
                '  inline-sizing: stretch：保持 inline 显示类型，仅启用宽高\n' +
                '    不创建 BFC，基线对齐行为与普通 inline 一致\n' +
                '    理论上更"轻量"，适合需要宽高但不想改变对齐行为的场景\n\n' +
                '采纳现状：inline-sizing 仍实验性（CSS Inline Layout L3 WD），\n' +
                '  仅 Firefox 部分实现（behind flag），Chrome/Safari 未支持。\n' +
                '  生产环境继续用 display: inline-block 或 display: inline-flex 兜底。';
        }
        catch (err) {
            return `读取 inline-sizing 信息失败：${err.name} - ${err.message}`;
        }
    }
    _toggleInlineSizing() {
        this._inlineSizingOn = !this._inlineSizingOn;
        const val = this._inlineSizingOn ? 'stretch' : 'normal';
        this._injectStyle('css-inline-sizing', `.inline-sizing-stage .is-target { inline-sizing: ${val}; }`);
        this.setState({ inlineSizingInfo: this._readInlineSizingInfo() });
        this._addLog('sizing', `切换 inline-sizing → ${val}（${this._inlineSizingOn ? '行内元素可设宽高' : '默认 inline 不能设宽高'}）`);
    }
    _renderCard5() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '5. inline-sizing 行内盒尺寸控制',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['inline-sizing', f.inlineSizing]]), h(Tag, { color: 'primary' }, '实验性')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'inline-sizing 控制 inline-level box 是否可设置宽高：normal（默认，inline 元素 width/height 不生效）| stretch（让 inline 元素可设置宽高，自动 stretch 到指定尺寸）。与 display: inline-block 对比：inline-block 让元素既能设宽高又保持行内布局，但会创建 BFC 影响基线对齐（默认对齐到自身底部）；inline-sizing: stretch 保持 inline 显示类型，仅启用宽高，不创建 BFC，基线对齐与普通 inline 一致，更"轻量"。该属性仍实验性（CSS Inline Layout L3 WD），仅 Firefox 部分实现（behind flag），Chrome/Safari 未支持，生产继续用 inline-block 或 inline-flex 兜底。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ inlineSizingInfo: this._readInlineSizingInfo() }) }), this._btn(`inline-sizing（${this._inlineSizingOn ? 'stretch' : 'normal'}）`, { size: 'sm', disabled: !f.inlineSizing, onClick: () => this._toggleInlineSizing() })),
                h('div', { class: 'inline-sizing-stage' }, h('div', {}, 'inline-sizing: ', h('span', { class: 'is-target' }, 'is-target（min-width: 80px）'), ' 对比 display: inline-block ', h('span', { class: 'is-ib' }, 'is-ib（width: 120px）'), ' 末尾文字。'), h('div', { style: { marginTop: '6px', fontSize: '13px', color: 'var(--color-text-secondary, #888)' } }, 'inline-sizing: stretch 后 .is-target 可设宽高且不创建 BFC；inline-block 创建 BFC 影响基线对齐。')),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '300px', overflow: 'auto' } }, h('code', {}, s.inlineSizingInfo || '（点击按钮切换 inline-sizing）')),
                h(Alert, {
                    type: 'warning',
                    message: 'inline-sizing 仍实验性，生产用 inline-block / inline-flex 兜底',
                    description: 'inline-sizing: stretch 仅 Firefox 部分实现（behind flag），Chrome/Safari 未支持。生产环境继续用 display: inline-block（创建 BFC，需注意基线对齐）或 display: inline-flex（更灵活，可配合 align-items 控制对齐）兜底。inline-sizing 的优势是保持 inline 显示类型不创建 BFC。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 6：alignment-baseline 与 text-anchor ===================
    _readAlignmentBaselineInfo() {
        const f = this._flags();
        try {
            const stage = this.el && this.el.querySelector('.align-baseline-stage');
            const readComp = (sel, prop) => {
                const el = stage && stage.querySelector(sel);
                if (!el)
                    return '(未渲染)';
                return window.getComputedStyle(el).getPropertyValue(prop) || '(空)';
            };
            return `alignment-baseline 与 text-anchor 演示：\n` +
                `  .ab-text { alignment-baseline: ${this._alignBaselineMode}; }\n` +
                `    alignment-baseline 计算值="${readComp('.ab-text', 'alignment-baseline')}"\n` +
                `  SVG <text> { text-anchor: ${this._textAnchorMode}; }\n` +
                `    text-anchor 计算值="${readComp('text', 'text-anchor')}"\n` +
                `  CSS.supports('alignment-baseline','central') = ${f.alignmentBaseline}\n` +
                `  CSS.supports('text-anchor','middle') = ${f.textAnchor}\n\n` +
                '说明：\n' +
                '  alignment-baseline 指定 inline-level box 对齐到父级的哪个基线：\n' +
                '    auto | baseline | before-edge | text-before-edge | middle | central | after-edge |\n' +
                '    text-after-edge | ideographic | alphabetic | hanging | mathematical\n' +
                '    auto：默认（继承 dominant-baseline 的值）\n' +
                '    baseline：对齐到父级 alphabetic 基线\n' +
                '    central/middle：对齐到父级中央/x-height 中点\n' +
                '    before-edge/text-before-edge：对齐到父级文本框上沿\n' +
                '    after-edge/text-after-edge：对齐到父级文本框下沿\n' +
                '    ideographic/hanging/mathematical：对应表意/悬挂/数学基线\n\n' +
                '  text-anchor 控制 SVG <text> 文本水平对齐（相对锚点）：\n' +
                '    start | middle | end\n' +
                '    start：左对齐（锚点在左）；middle：居中（锚点在中）；end：右对齐（锚点在右）\n' +
                '    text-anchor 是 SVG 专属属性，但 CSS Inline Layout L3 引入 CSS 上下文支持\n\n' +
                '与 dominant-baseline 协同：\n' +
                '  dominant-baseline：设置自身主导基线（"我是哪种基线"）\n' +
                '  alignment-baseline：设置对齐到父级哪个基线（"我对齐到父的哪个基线"）\n' +
                '  常见组合：图标用 dominant-baseline: central + 文字默认 alphabetic，自动垂直居中\n' +
                '  SVG <text> 用 text-anchor: middle + dominant-baseline: central 实现完全居中';
        }
        catch (err) {
            return `读取 alignment-baseline/text-anchor 信息失败：${err.name} - ${err.message}`;
        }
    }
    _setAlignBaseline(mode) {
        this._alignBaselineMode = mode;
        this._injectStyle('css-align-baseline', `.align-baseline-stage .ab-text { alignment-baseline: ${mode}; }`);
        this.setState({ alignmentBaselineInfo: this._readAlignmentBaselineInfo() });
        this._addLog('align', `切换 alignment-baseline → ${mode}`);
    }
    _setTextAnchor(mode) {
        this._textAnchorMode = mode;
        this._injectStyle('css-text-anchor', `.align-baseline-stage text { text-anchor: ${mode}; }`);
        this.setState({ alignmentBaselineInfo: this._readAlignmentBaselineInfo() });
        this._addLog('anchor', `切换 text-anchor → ${mode}（start=左对齐 | middle=居中 | end=右对齐）`);
    }
    _renderCard6() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '6. alignment-baseline 与 text-anchor',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['alignment-baseline', f.alignmentBaseline], ['text-anchor', f.textAnchor]]), h(Tag, { color: 'primary' }, 'SVG 文本对齐')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'alignment-baseline 指定 inline-level box 对齐到父级的哪个基线：auto|baseline|before-edge|text-before-edge|middle|central|after-edge|text-after-edge|ideographic|alphabetic|hanging|mathematical。与 dominant-baseline 协同：dominant-baseline 设置自身主导基线（"我是哪种基线"），alignment-baseline 设置对齐到父级哪个基线（"我对齐到父的哪个基线"）。常见组合：图标用 dominant-baseline: central + 文字默认 alphabetic 自动垂直居中。text-anchor 控制 SVG <text> 文本水平对齐（相对锚点）：start|middle|end，是 SVG 专属属性但 CSS Inline Layout L3 引入 CSS 上下文支持。SVG <text> 用 text-anchor: middle + dominant-baseline: central 实现完全居中。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ alignmentBaselineInfo: this._readAlignmentBaselineInfo() }) }), this._btn('ab: auto', { size: 'sm', disabled: !f.alignmentBaseline, onClick: () => this._setAlignBaseline('auto') }), this._btn('ab: central', { size: 'sm', disabled: !f.alignmentBaseline, onClick: () => this._setAlignBaseline('central') }), this._btn('ab: middle', { size: 'sm', disabled: !f.alignmentBaseline, onClick: () => this._setAlignBaseline('middle') }), this._btn('ab: baseline', { size: 'sm', disabled: !f.alignmentBaseline, onClick: () => this._setAlignBaseline('baseline') }), this._btn('ta: start', { size: 'sm', disabled: !f.textAnchor, onClick: () => this._setTextAnchor('start') }), this._btn('ta: middle', { size: 'sm', disabled: !f.textAnchor, onClick: () => this._setTextAnchor('middle') }), this._btn('ta: end', { size: 'sm', disabled: !f.textAnchor, onClick: () => this._setTextAnchor('end') })),
                h('div', { class: 'align-baseline-stage' }, h('div', { class: 'svg-row' }, h('svg', { width: '120', height: '60', viewBox: '0 0 120 60', xmlns: 'http://www.w3.org/2000/svg' }, h('line', { x1: '0', y1: '30', x2: '120', y2: '30', stroke: '#ccc', 'stroke-dasharray': '2,2' }), h('circle', { cx: '60', cy: '30', r: '3', fill: '#1677ff' }), h('text', { x: '60', y: '30', fill: '#333', 'font-size': '14', class: 'ab-text' }, 'SVG 文本（text-anchor=' + this._textAnchorMode + '）')), h('svg', { width: '120', height: '60', viewBox: '0 0 120 60', xmlns: 'http://www.w3.org/2000/svg' }, h('rect', { x: '10', y: '10', width: '20', height: '20', fill: '#1677ff' }), h('text', { x: '40', y: '25', fill: '#333', 'font-size': '14', class: 'ab-text' }, '图标+文字'))), h('div', { style: { marginTop: '6px', fontSize: '13px', color: 'var(--color-text-secondary, #888)' } }, '上方虚线为 y=30 中线，蓝色圆点为锚点。text-anchor 控制文字相对锚点的水平对齐；alignment-baseline 控制文字相对图标的垂直对齐。')),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.alignmentBaselineInfo || '（点击按钮切换 alignment-baseline / text-anchor）')),
                h(Alert, {
                    type: 'info',
                    message: 'SVG <text> 用 text-anchor: middle + dominant-baseline: central 实现完全居中',
                    description: 'alignment-baseline 与 dominant-baseline 协同：dominant-baseline 设自身主导基线，alignment-baseline 设对齐到父级哪个基线。SVG 上下文全支持；CSS 上下文支持逐步完善。text-anchor 是 SVG 专属水平对齐属性（start/middle/end），CSS Inline Layout L3 引入 CSS 上下文支持。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 7：实战场景 ===================
    _readScenariosInfo() {
        const f = this._flags();
        try {
            return `实战场景 演示：\n` +
                `  dominant-baseline 支持 = ${f.dominantBaseline}\n` +
                `  baseline-shift 支持 = ${f.baselineShift}\n` +
                `  initial-letter 支持 = ${f.initialLetter}\n\n` +
                '场景 1：图标与文字垂直居中\n' +
                '  .icon { dominant-baseline: central; }\n' +
                '  .icon-text { display: inline-flex; align-items: baseline; gap: 6px; }\n' +
                '  对比历史方案：vertical-align: middle（x-height 中点，不精确）\n' +
                '            flexbox align-items: center（不基于基线，可能错位）\n\n' +
                '场景 2：数学公式排版\n' +
                '  .math .sup { baseline-shift: super; font-size: 0.7em; }\n' +
                '  .math .sub { baseline-shift: sub; font-size: 0.7em; }\n' +
                '  或用 HTML 语义元素：<sup>/<sub>（默认 vertical-align: super/sub + smaller）\n' +
                '  对比 vertical-align: super/sub（兼容性更好但精度有限）\n\n' +
                '场景 3：多语言混排基线对齐\n' +
                '  .num { dominant-baseline: central; font-family: monospace; }\n' +
                '  CJK（中文/日文/韩文）用 ideographic 基线，西文用 alphabetic 基线\n' +
                '  数字（等宽字体）用 central 让数字与 CJK 字符垂直对齐\n\n' +
                '场景 4：drop cap 杂志排版\n' +
                '  article::first-letter { initial-letter: 3; color: navy; font-weight: 700; }\n' +
                '  替代历史 hack：float: left + font-size: 3em + line-height: 0.8 + margin\n' +
                '  杂志/书籍/新闻报道首段常用 drop cap 增强视觉冲击力';
        }
        catch (err) {
            return `读取 实战场景 信息失败：${err.name} - ${err.message}`;
        }
    }
    _runScenariosDemo() {
        this.setState({ scenariosInfo: this._readScenariosInfo() });
        const f = this._flags();
        this._addLog('scenario', `实战场景演示：dominant-baseline=${f.dominantBaseline}, baseline-shift=${f.baselineShift}, initial-letter=${f.initialLetter}`);
    }
    _renderCard7() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '7. 实战场景',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['dominant-baseline', f.dominantBaseline],
                ['baseline-shift', f.baselineShift],
                ['initial-letter', f.initialLetter],
            ]), h(Tag, { color: 'primary' }, '图标/公式/混排/drop cap')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'CSS Inline Layout 实战场景：图标与文字垂直居中（dominant-baseline: central 比 vertical-align: middle 更精确）、数学公式排版（baseline-shift: super/sub 或 <sup>/<sub>）、多语言混排基线对齐（CJK 用 ideographic 基线、西文用 alphabetic、数字用 central）、drop cap 杂志排版（initial-letter: 3 替代 float+font-size hack）。每个场景展示真实 CSS 代码与渲染效果对比。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取实战信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runScenariosDemo() })),
                h('div', { class: 'scenarios-stage' }, 
                // 场景 1：图标与文字垂直居中
                h('div', { class: 'scene' }, h('div', { class: 'fs-sm text-secondary' }, '场景 1：图标与文字垂直居中（dominant-baseline: central）'), h('div', { class: 'icon-text' }, h('span', { class: 'icon' }, '★'), h('span', {}, '首页'), h('span', { class: 'icon' }, '◆'), h('span', {}, '设置'))), 
                // 场景 2：数学公式排版
                h('div', { class: 'scene' }, h('div', { class: 'fs-sm text-secondary' }, '场景 2：数学公式排版（baseline-shift: super/sub）'), h('div', { class: 'math' }, '爱因斯坦质能方程：E = mc', h('span', { class: 'sup' }, '2'), '，化学式 H', h('span', { class: 'sub' }, '2'), 'O，求和 Σ', h('span', { class: 'sub' }, 'i=1'), h('span', { class: 'sup' }, 'n'), ' x', h('span', { class: 'sub' }, 'i'))), 
                // 场景 3：多语言混排基线对齐
                h('div', { class: 'scene' }, h('div', { class: 'fs-sm text-secondary' }, '场景 3：多语言混排基线对齐（数字用 dominant-baseline: central）'), h('div', { class: 'mix' }, h('span', { class: 'cn' }, '中国'), h('span', { class: 'num' }, '2024'), h('span', { class: 'en' }, 'GDP'), h('span', { class: 'num' }, '17.96'), h('span', { class: 'cn' }, '万亿美元'))), 
                // 场景 4：drop cap 杂志排版
                h('div', { class: 'scene' }, h('div', { class: 'fs-sm text-secondary' }, '场景 4：drop cap 杂志排版（initial-letter: 3）'), h('div', { class: 'magazine' }, '在数字时代，CSS Inline Layout Module Level 3 为 Web 排版带来了专业的行内盒对齐能力。从 dominant-baseline 的图标垂直居中，到 initial-letter 的杂志首字下沉，这些特性让 Web 排版逐步逼近印刷品质。'))),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.scenariosInfo || '（点击「读取实战信息」查看 4 个场景的 CSS 代码）')),
                h(Alert, {
                    type: 'success',
                    message: '4 个实战场景覆盖图标对齐、公式排版、多语言混排、drop cap',
                    description: '场景 1：dominant-baseline: central 让图标与文字精确垂直居中（替代 vertical-align: middle）。场景 2：baseline-shift: super/sub 或 <sup>/<sub> 排版数学/化学公式。场景 3：数字用 dominant-baseline: central 与 CJK 字符对齐。场景 4：initial-letter: 3 实现 drop cap 杂志排版（替代 float+font-size hack）。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 8：兼容性与降级 ===================
    _readCompatInfo() {
        const f = this._flags();
        try {
            return `兼容性与降级 演示：\n` +
                `  CSS.supports('vertical-align','middle') = ${f.verticalAlign}\n` +
                `  CSS.supports('dominant-baseline','central') = ${f.dominantBaseline}\n` +
                `  CSS.supports('initial-letter','3') = ${f.initialLetter}\n\n` +
                'vertical-align 历史方案：\n' +
                '  vertical-align: baseline | sub | super | top | text-top | middle | bottom | text-bottom | <length> | <percentage>\n' +
                '    仅作用于 inline-level 与 table-cell 元素，CSS1 起就有，兼容性最佳\n' +
                '    middle = x-height 中点（与 dominant-baseline: middle 等价）\n' +
                '    sub/super = 上下标（与 baseline-shift: sub/super 等价，但语义不同）\n' +
                '    缺点：基于 x-height 计算，不同字体 x-height 不同导致跨字体表现不一致\n\n' +
                'flexbox align-items: baseline 替代方案：\n' +
                '  .row { display: flex; align-items: baseline; gap: 8px; }\n' +
                '  让 flex 子项按基线对齐（而非顶部/中央），适合多字号文字行内对齐\n' +
                '  优势：兼容性极佳（IE11+ 部分支持，现代浏览器全支持）\n' +
                '  局限：仅 flex 容器内有效，不解决 SVG/HTML 混排的基线问题\n\n' +
                '浏览器支持矩阵（截至 2025 年）：\n' +
                '  dominant-baseline：SVG 上下文全支持（Chrome/Firefox/Safari/Edge）；CSS 上下文部分支持\n' +
                '  baseline-shift：实验性（Firefox 仅 SVG，Chrome/Safari 部分）\n' +
                '  initial-letter：Chrome 110+/Safari 17+；Firefox behind flag\n' +
                '  inline-sizing：仅 Firefox 部分实现（behind flag）\n' +
                '  alignment-baseline：SVG 上下文全支持；CSS 上下文部分\n' +
                '  text-anchor：SVG 全支持；CSS 上下文实验性\n' +
                '  vertical-align：全支持（CSS1）\n\n' +
                '与 SVG <text> 元素协同：\n' +
                '  SVG <text>/<tspan> 默认使用 dominant-baseline: alphabetic + text-anchor: start\n' +
                '  完全居中：text-anchor="middle" dominant-baseline="central"\n' +
                '  SVG 属性可在元素上直接写（如 <text text-anchor="middle">），也可用 CSS 设置';
        }
        catch (err) {
            return `读取 兼容性 信息失败：${err.name} - ${err.message}`;
        }
    }
    _runCompatDemo() {
        this.setState({ compatInfo: this._readCompatInfo() });
        const f = this._flags();
        this._addLog('compat', `兼容性演示：vertical-align=${f.verticalAlign}, dominant-baseline=${f.dominantBaseline}, initial-letter=${f.initialLetter}`);
    }
    _renderCard8() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '8. 兼容性与降级',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['vertical-align', f.verticalAlign],
                ['dominant-baseline', f.dominantBaseline],
                ['initial-letter', f.initialLetter],
            ]), h(Tag, { color: 'primary' }, '降级方案')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '兼容性与降级方案：vertical-align（CSS1 起全支持，基于 x-height 计算跨字体不一致）、flexbox align-items: baseline（IE11+ 部分支持，让 flex 子项按基线对齐，仅 flex 容器内有效）。浏览器支持矩阵：dominant-baseline SVG 上下文全支持、CSS 上下文部分；baseline-shift 实验性；initial-letter Chrome 110+/Safari 17+、Firefox behind flag；inline-sizing 仅 Firefox 部分实现；vertical-align 全支持（CSS1）。与 SVG <text> 协同：SVG 默认 alphabetic + start，完全居中用 text-anchor="middle" dominant-baseline="central"。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取兼容性信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runCompatDemo() })),
                h('div', { class: 'compat-stage' }, h('div', { class: 'fs-sm text-secondary' }, 'vertical-align 历史方案对比：'), h('div', { class: 'va-demo' }, h('span', {}, '文字'), h('span', { class: 'va-middle', style: { display: 'inline-block', width: '20px', height: '20px', background: '#1677ff', verticalAlign: 'middle' } }), 'middle ', h('span', { class: 'va-top', style: { display: 'inline-block', width: '20px', height: '20px', background: '#10b981', verticalAlign: 'top' } }), 'top ', h('span', { class: 'va-text-bottom', style: { display: 'inline-block', width: '20px', height: '20px', background: '#f59e0b', verticalAlign: 'text-bottom' } }), 'text-bottom'), h('div', { class: 'fs-sm text-secondary', style: { marginTop: '8px' } }, 'flexbox align-items: baseline 替代：'), h('div', { class: 'flex-baseline' }, h('span', { class: 'big' }, '大字'), h('span', { class: 'small' }, '小字（基线对齐）'), h('span', { class: 'big' }, 'Big')), h('div', { class: 'fs-sm text-secondary', style: { marginTop: '8px' } }, '浏览器支持矩阵：'), h('table', { class: 'matrix' }, h('thead', {}, h('tr', {}, h('th', {}, '属性'), h('th', {}, 'Chrome'), h('th', {}, 'Firefox'), h('th', {}, 'Safari'))), h('tbody', {}, h('tr', {}, h('td', {}, 'dominant-baseline (SVG)'), h('td', { class: 'yes' }, '✓ 全支持'), h('td', { class: 'yes' }, '✓ 全支持'), h('td', { class: 'yes' }, '✓ 全支持')), h('tr', {}, h('td', {}, 'dominant-baseline (CSS)'), h('td', { class: 'partial' }, '部分'), h('td', { class: 'partial' }, '部分'), h('td', { class: 'partial' }, '部分')), h('tr', {}, h('td', {}, 'baseline-shift'), h('td', { class: 'partial' }, '部分'), h('td', { class: 'no' }, '仅 SVG'), h('td', { class: 'partial' }, '部分')), h('tr', {}, h('td', {}, 'initial-letter'), h('td', { class: 'yes' }, '110+'), h('td', { class: 'no' }, 'flag'), h('td', { class: 'yes' }, '17+')), h('tr', {}, h('td', {}, 'inline-sizing'), h('td', { class: 'no' }, '✗'), h('td', { class: 'partial' }, 'flag'), h('td', { class: 'no' }, '✗')), h('tr', {}, h('td', {}, 'alignment-baseline (SVG)'), h('td', { class: 'yes' }, '✓'), h('td', { class: 'yes' }, '✓'), h('td', { class: 'yes' }, '✓')), h('tr', {}, h('td', {}, 'text-anchor (SVG)'), h('td', { class: 'yes' }, '✓'), h('td', { class: 'yes' }, '✓'), h('td', { class: 'yes' }, '✓')), h('tr', {}, h('td', {}, 'vertical-align'), h('td', { class: 'yes' }, '✓ CSS1'), h('td', { class: 'yes' }, '✓ CSS1'), h('td', { class: 'yes' }, '✓ CSS1'))))),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.compatInfo || '（点击「读取兼容性信息」查看降级方案与浏览器支持矩阵）')),
                h(Alert, {
                    type: 'info',
                    message: '生产降级链：vertical-align → flexbox baseline → dominant-baseline',
                    description: '兼容性优先级：vertical-align（CSS1 全支持，但基于 x-height 跨字体不一致）→ flexbox align-items: baseline（IE11+ 部分支持，仅 flex 容器内）→ dominant-baseline（SVG 全支持、CSS 部分支持，更精确）。initial-letter 用 ::first-letter + float 兜底；inline-sizing 用 inline-block/inline-flex 兜底。SVG <text> 用 text-anchor + dominant-baseline 实现完全居中。',
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
            : s.logs.map((log) => h('div', { class: 'log-panel__line' }, h('span', { class: 'log-panel__time' }, log.time), h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type), h('span', { class: 'log-panel__content' }, log.content))));
    }
    // =================== 整页渲染 ===================
    render() {
        const s = this.state;
        return h('div', { class: 'api-lab-page css-inline-layout-page' }, h('h2', { class: 'section-title' }, 'CSS Inline Layout Module Level 3 实验室'), h('p', { class: 'fs-sm text-secondary mb-md' }, '本页演示 CSS Inline Layout Module Level 3 行内盒排版：dominant-baseline 主导基线、baseline-shift 上下标偏移、initial-letter drop cap 首字下沉、inline-sizing 行内盒尺寸控制、alignment-baseline 与 text-anchor SVG 文本对齐、4 个实战场景、兼容性降级方案。所有特性通过 typeof / CSS.supports 能力检测，不可用时仅记日志，绝不抛异常。'), s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderCard7(), this._renderCard8(), this._renderLogPanel());
    }
}
//# sourceMappingURL=CSSInlineLayoutPage.js.map