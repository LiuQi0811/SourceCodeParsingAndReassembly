// =====================================================================
// CSSViewportUnitsMulticolPage.js —— CSS 视口/容器单位与多栏布局 实验室
// 演示 CSS 布局基础原语中容易被忽视的高价值特性：
//   1. 视口相对单位全家桶 —— vw/vh/vmin/vmax/vi/vb（CSS Values L3）
//      + Small/Large/Dynamic 视口单位 svh/lvh/dvh/svw/lvw/dvw
//      + svmin/lvmin/dvmin/svmax/lvmax/dvmax/svi/lvi/dvi/svb/lvb/dvb
//      解决移动端动态工具栏导致 100vh 溢出问题：lvh=最大可见（含工具栏）、
//      svh=最小可见（不含工具栏）、dvh=当前可见（动态跟随）Chrome 108+/Safari 15.4+
//   2. 容器查询单位 cqw/cqh/cqi/cqb/cqmin/cqmax —— 相对最近祖先容器尺寸
//      而非视口；@container 配套；组件级响应式排版；Chrome 105+
//   3. CSS Multi-column Layout 多栏布局 —— columns 简写、column-count、
//      column-width、column-gap、column-rule（width/style/color 简写）、
//      column-fill: auto|balance|balance-all、column-span: all|none、
//      break-inside: avoid-column 防止分栏打断元素
//   4. CSS 内在/外在尺寸 + display 阶梯 —— width: min-content|max-content|
//      fit-content|fit-content(\<length\>)|stretch；contain-intrinsic-size；
//      display: contents（元素自身不生成盒子但子元素参与父级布局）、
//      display: flow-root（创建新 BFC 但不脱离文档流，清除浮动替代 clearfix hack）、
//      display: list-item/ruby；与 display: block/inline/flex/grid 关系
// 说明：jsdom 不做真实 CSS 渲染，但 CSS.supports() 通常可用做能力检测；
//       单位/属性的支持情况通过 CSS.supports('(width: 1svh)') 等方式探测。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Tag } from '../../components/ui/Tag.js';
export class CSSViewportUnitsMulticolPage extends Page {
    _inited = false;
    _dynamicStyles = [];
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            viewportInfo: '', // Card 1：视口相对单位
            containerInfo: '', // Card 2：容器查询单位
            multicolInfo: '', // Card 3：多栏布局
            sizingInfo: '', // Card 4：内在/外在尺寸 + display 阶梯
            multicolDemoHtml: '', // Card 3 演示容器 innerHTML 片段
        };
    }
    componentDidMount() {
        if (this._inited)
            return;
        this._inited = true;
        this._dynamicStyles = [];
        const f = this._flags();
        const c = (ok) => ok ? '✓' : '✗';
        const parts = [
            `CSS ${c(f.css)}`,
            `vw/vh ${c(f.vh)}`,
            `svh/lvh/dvh ${c(f.svh)}`,
            `cqw ${c(f.cqw)}`,
            `columns ${c(f.columns)}`,
            `min-content ${c(f.minContent)}`,
            `display:contents ${c(f.displayContents)}`,
            `flow-root ${c(f.flowRoot)}`,
        ];
        const summary = f.css
            ? `CSS 视口/容器单位与多栏布局能力检测：${parts.join(' · ')}。jsdom 不做真实 CSS 渲染，但 CSS.supports 可探测单位/属性支持；按钮点击将插入/移除演示 <style> 并展示属性对照与代码示例。`
            : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击仅记日志说明，不会抛异常。';
        this.setState({ capsSummary: summary });
        this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!f.svh)
            this._addLog('warn', 'svh/lvh/dvh 不可用（Chrome 108+/Safari 15.4+/Firefox 101+）');
        if (!f.cqw)
            this._addLog('warn', 'cqw/cqh/cqi/cqb/cqmin/cqmax 不可用（需 Chrome 105+/Safari 16+ 容器查询）');
        if (!f.displayContents)
            this._addLog('warn', 'display: contents 不可用（Firefox 37+/Chrome 65+/Safari 11.1+）');
        this._injectBaseStyles();
    }
    componentWillUnmount() {
        for (const s of this._dynamicStyles) {
            try {
                s.parentNode && s.parentNode.removeChild(s);
            }
            catch { /* noop */ }
        }
        this._dynamicStyles = [];
    }
    _addLog(type, content) {
        this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
    }
    _btn(label, opts) {
        const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
        this.registerChild(btn);
        return btn.render();
    }
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
    _injectBaseStyles() {
        this._injectStyle('css-viewport-multicol-base', `
      .vp-card-row { display: flex; gap: 12px; align-items: flex-start; margin-top: 8px; flex-wrap: wrap; }
      .vp-box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; background: #fff; min-width: 200px; flex: 1; }
      .vp-demo-vh { background: linear-gradient(180deg, #dbeafe, #bfdbfe); border-radius: 4px; padding: 8px; color: #1e3a8a; font-weight: 600; }
      .vp-demo-svh { background: #dcfce7; border-radius: 4px; padding: 8px; color: #14532d; font-weight: 600; }
      .vp-demo-dvh { background: #fef9c3; border-radius: 4px; padding: 8px; color: #713f12; font-weight: 600; }
      .vp-multicol { column-count: 3; column-gap: 16px; column-rule: 1px solid #94a3b8; column-fill: balance; background: #fff; padding: 12px; border-radius: 6px; border: 1px solid #cbd5e1; }
      .vp-multicol p { margin: 0 0 8px 0; break-inside: avoid-column; }
      .vp-multicol .vp-span { column-span: all; background: #1e40af; color: #fff; padding: 6px 10px; border-radius: 4px; margin: 8px 0; font-weight: 600; }
      .vp-sizing-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 8px; }
      .vp-sizing-item { border: 1px dashed #94a3b8; padding: 8px; border-radius: 4px; background: #f8fafc; }
      .vp-sizing-item .vp-sz-min { width: min-content; background: #fecaca; padding: 4px 8px; border-radius: 4px; margin-top: 4px; white-space: nowrap; }
      .vp-sizing-item .vp-sz-max { width: max-content; background: #bbf7d0; padding: 4px 8px; border-radius: 4px; margin-top: 4px; white-space: nowrap; }
      .vp-sizing-item .vp-sz-fit { width: fit-content; background: #bfdbfe; padding: 4px 8px; border-radius: 4px; margin-top: 4px; white-space: nowrap; max-width: 100%; }
      .vp-display-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
      .vp-display-box { border: 1px solid #94a3b8; padding: 8px; border-radius: 4px; background: #fff; }
      .vp-display-flow-root { display: flow-root; background: #fef3c7; padding: 8px; border-radius: 4px; }
      .vp-display-flow-root::after { content: '↓ 清除浮动，无需 clearfix hack'; display: block; clear: both; color: #92400e; font-size: 11px; margin-top: 4px; }
      .vp-display-flow-root .vp-float { float: left; background: #fde68a; padding: 4px 8px; border-radius: 4px; margin-right: 6px; }
      .vp-display-contents { display: contents; }
      .vp-output { background: #0f172a; color: #e2e8f0; border-radius: 4px; padding: 8px; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; margin-top: 8px; }
    `);
    }
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
            vh: supportsPV('width', '1vh'),
            svh: supportsPV('width', '1svh'),
            lvh: supportsPV('width', '1lvh'),
            dvh: supportsPV('width', '1dvh'),
            vi: supportsPV('width', '1vi'),
            vb: supportsPV('width', '1vb'),
            cqw: supportsPV('width', '1cqw'),
            cqh: supportsPV('width', '1cqh'),
            cqi: supportsPV('width', '1cqi'),
            cqb: supportsPV('width', '1cqb'),
            cqmin: supportsPV('width', '1cqmin'),
            cqmax: supportsPV('width', '1cqmax'),
            columns: supportsPV('column-count', '3'),
            columnFill: supportsPV('column-fill', 'balance'),
            columnSpan: supportsPV('column-span', 'all'),
            breakInside: supportsPV('break-inside', 'avoid-column'),
            minContent: supportsPV('width', 'min-content'),
            maxContent: supportsPV('width', 'max-content'),
            fitContent: supportsPV('width', 'fit-content'),
            stretch: supportsPV('width', 'stretch'),
            containIntrinsicSize: supportsPV('contain-intrinsic-size', 'auto 100px'),
            displayContents: supportsPV('display', 'contents'),
            flowRoot: supportsPV('display', 'flow-root'),
        };
    }
    // ===================== Card 1：视口相对单位 =====================
    _runViewportDemo() {
        const f = this._flags();
        this._injectStyle('vp-viewport-demo', `
      .vp-viewport-strip { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
      .vp-vh-cell { width: 10vh; height: 10vh; background: #3b82f6; color: #fff; display: flex; align-items: center; justify-content: center; border-radius: 6px; font-size: 12px; }
      .vp-svh-cell { width: 10svh; height: 10svh; background: #22c55e; color: #fff; display: flex; align-items: center; justify-content: center; border-radius: 6px; font-size: 12px; }
      .vp-lvh-cell { width: 10lvh; height: 10lvh; background: #eab308; color: #fff; display: flex; align-items: center; justify-content: center; border-radius: 6px; font-size: 12px; }
      .vp-dvh-cell { width: 10dvh; height: 10dvh; background: #ef4444; color: #fff; display: flex; align-items: center; justify-content: center; border-radius: 6px; font-size: 12px; }
    `);
        const info = [
            '===== CSS 视口相对单位全家桶 =====',
            '',
            '【基础单位（CSS Values L3）】',
            '  vw  = 1% 视口宽度     vh  = 1% 视口高度',
            '  vmin = min(vw, vh)    vmax = max(vw, vh)',
            '  vi  = 1% 视口 inline-size（随 writing-mode/direction 变化）',
            '  vb  = 1% 视口 block-size（随 writing-mode/direction 变化）',
            '',
            '【Small/Large/Dynamic 视口单位（CSS Viewport L5，移动端动态工具栏适配）】',
            '  问题：移动浏览器 URL 栏伸缩导致 100vh 溢出 / 内容被工具栏遮挡',
            '  svh  = Small Viewport Height  = 1% 最小可见高度（所有工具栏完全展开时）',
            '  lvh  = Large Viewport Height  = 1% 最大可见高度（所有工具栏完全收起时）',
            '  dvh  = Dynamic Viewport Height = 1% 当前可见高度（动态跟随工具栏伸缩）',
            '  svw/lvw/dvw  = 同上但宽度维度（水平工具栏较少见）',
            '  svmin/svmax、lvmin/lvmax、dvmin/dvmax = min/max 版本',
            '  svi/lvi/dvi、svb/lvb/dvb = inline/block 维度的逻辑版本',
            '',
            '【使用场景决策】',
            '  100vh  → 旧代码兼容（不推荐新代码用，移动端会溢出）',
            '  100svh → 「最坏情况」可用区域，确保按钮始终可见不被遮',
            '  100lvh → 「最大可用」区域，全屏沉浸式 hero/banner',
            '  100dvh → 「跟随当前」最自然，多数现代页面推荐',
            '',
            '【浏览器支持】',
            `  vh: ${f.vh ? '✓' : '✗'}  |  svh: ${f.svh ? '✓' : '✗'}  |  lvh: ${f.lvh ? '✓' : '✗'}  |  dvh: ${f.dvh ? '✓' : '✗'}`,
            '  Chrome 108+/Safari 15.4+/Firefox 101+',
            '',
            '【示例代码】',
            '  .hero { height: 100dvh; }              /* 跟随动态视口 */',
            '  .sticky-cta { bottom: calc(1svh + 16px); }  /* 始终可见，不被工具栏遮 */',
            '  .immersive-banner { height: 100lvh; }  /* 最大沉浸式 */',
        ].join('\n');
        this.setState({ viewportInfo: info });
        this._addLog('info', '视口相对单位演示已注入演示样式；展示了 vh/svh/lvh/dvh 四种基础维度');
    }
    _renderCard1() {
        const f = this._flags();
        const s = this.state;
        return h(Card, {
            title: 'Card 1 · 视口相对单位 vh / svh / lvh / dvh',
            extra: h(Tag, { color: f.svh ? 'success' : 'error' }, f.svh ? 'svh 已支持' : 'svh 未支持'),
        }, h('p', { class: 'fs-sm text-secondary' }, 'CSS Viewport Module Level 5 引入 Small/Large/Dynamic 三档视口单位，解决移动端动态工具栏导致 100vh 溢出问题：svh=最小可见（工具栏展开）、lvh=最大可见（工具栏收起）、dvh=当前可见（动态跟随）。'), h('div', { class: 'vp-viewport-strip' }, h('div', { class: 'vp-vh-cell' }, '10vh'), h('div', { class: 'vp-svh-cell' }, '10svh'), h('div', { class: 'vp-lvh-cell' }, '10lvh'), h('div', { class: 'vp-dvh-cell' }, '10dvh')), h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' }, this._btn('运行视口单位演示', { type: 'primary', size: 'sm', onClick: () => this._runViewportDemo() })), s.viewportInfo ? h('pre', { class: 'code-block mt-md' }, s.viewportInfo) : null);
    }
    // ===================== Card 2：容器查询单位 =====================
    _runContainerDemo() {
        const f = this._flags();
        this._injectStyle('vp-container-demo', `
      .vp-cq-host { container-type: inline-size; container-name: cqdemo; border: 2px dashed #6366f1; padding: 12px; border-radius: 6px; background: #eef2ff; margin-top: 8px; }
      .vp-cq-title { font-size: 5cqi; color: #312e81; font-weight: 700; margin: 0 0 8px 0; }
      .vp-cq-text { font-size: max(2cqw, 12px); color: #3730a3; line-height: 1.5; }
      .vp-cq-box { width: 50cqw; padding: 4cqi; background: #c7d2fe; border-radius: 4px; margin-top: 6px; }
      .vp-cq-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(30cqw, 1fr)); gap: 2cqw; margin-top: 8px; }
      .vp-cq-grid > div { background: #a5b4fc; padding: 6px; border-radius: 4px; color: #1e1b4b; font-size: 3cqi; text-align: center; }
    `);
        const info = [
            '===== CSS 容器查询单位 cqw/cqh/cqi/cqb/cqmin/cqmax =====',
            '',
            '【定义】相对最近祖先「容器查询上下文」尺寸的单位，而非视口。',
            '  cqw   = 1% 容器 query container 宽度',
            '  cqh   = 1% 容器 query container 高度',
            '  cqi   = 1% 容器 inline-size（随 writing-mode/direction 变化）',
            '  cqb   = 1% 容器 block-size（随 writing-mode/direction 变化）',
            '  cqmin = min(cqi, cqb)',
            '  cqmax = max(cqi, cqb)',
            '',
            '【前提：父级必须声明 container-type】',
            '  .vp-cq-host { container-type: inline-size; container-name: cqdemo; }',
            '  /* inline-size 仅按宽度建容器（避免递归布局）*/',
            '  /* size 双维度慎用，可能触发循环布局 */',
            '',
            '【组件级响应式排版示例】',
            '  .vp-cq-title { font-size: 5cqi; }     /* 标题随容器宽度缩放 */',
            '  .vp-cq-text  { font-size: max(2cqw, 12px); }  /* 字号下限 12px */',
            '  .vp-cq-box   { width: 50cqw; padding: 4cqi; } /* 占容器一半宽 */',
            '  .vp-cq-grid  { grid-template-columns: repeat(auto-fit, minmax(30cqw, 1fr)); }',
            '',
            '【vs vw/vh 视口单位】',
            '  vw/vh = 全局视口，无法适配组件不同尺寸',
            '  cqw/cqi = 组件局部尺寸，同一组件在大屏 sidebar/main/footer 自适应',
            '',
            '【浏览器支持】',
            `  cqw: ${f.cqw ? '✓' : '✗'}  |  cqi: ${f.cqi ? '✓' : '✗'}  |  cqmin: ${f.cqmin ? '✓' : '✗'}  |  cqmax: ${f.cqmax ? '✓' : '✗'}`,
            '  Chrome 105+/Safari 16+/Firefox 110+',
        ].join('\n');
        this.setState({ containerInfo: info });
        this._addLog('info', '容器查询单位演示：父级 container-type: inline-size，子元素用 cqw/cqi 自适应');
    }
    _renderCard2() {
        const f = this._flags();
        const s = this.state;
        return h(Card, {
            title: 'Card 2 · 容器查询单位 cqw / cqh / cqi / cqb / cqmin / cqmax',
            extra: h(Tag, { color: f.cqw ? 'success' : 'error' }, f.cqw ? 'cqw 已支持' : 'cqw 未支持'),
        }, h('p', { class: 'fs-sm text-secondary' }, '相对最近祖先「容器查询上下文」尺寸的单位，而非视口。配合 container-type 使用，实现组件级响应式排版（同组件在 sidebar/main/footer 不同宽度自适应）。'), h('div', { class: 'vp-cq-host' }, h('div', { class: 'vp-cq-title' }, '容器查询单位演示 (font-size: 5cqi)'), h('div', { class: 'vp-cq-text' }, '字号会随容器宽度缩放（min 12px）。resize 容器查看效果。'), h('div', { class: 'vp-cq-box' }, 'width: 50cqw; padding: 4cqi'), h('div', { class: 'vp-cq-grid' }, h('div', {}, '3cqi'), h('div', {}, '3cqi'), h('div', {}, '3cqi'))), h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' }, this._btn('运行容器单位演示', { type: 'primary', size: 'sm', onClick: () => this._runContainerDemo() })), s.containerInfo ? h('pre', { class: 'code-block mt-md' }, s.containerInfo) : null);
    }
    // ===================== Card 3：Multi-column Layout =====================
    _runMulticolDemo() {
        const f = this._flags();
        this._injectStyle('vp-multicol-demo', `
      .vp-multicol-demo { column-count: 3; column-gap: 16px; column-rule: 2px solid #6366f1; column-fill: balance; background: #fff; padding: 12px; border-radius: 6px; border: 1px solid #cbd5e1; margin-top: 8px; }
      .vp-multicol-demo p { margin: 0 0 8px 0; break-inside: avoid-column; color: #1e293b; line-height: 1.5; }
      .vp-multicol-demo .vp-span-all { column-span: all; background: #4f46e5; color: #fff; padding: 6px 10px; border-radius: 4px; margin: 8px 0; font-weight: 600; text-align: center; }
      .vp-multicol-narrow { column-width: 120px; column-gap: 12px; background: #fef3c7; padding: 10px; border-radius: 6px; margin-top: 8px; border: 1px solid #fcd34d; }
      .vp-multicol-narrow p { margin: 0 0 6px 0; break-inside: avoid-column; }
    `);
        const demoHtml = [
            h('div', { class: 'vp-multicol-demo' }, h('p', {}, '栏目一：这是第一段文字。多栏布局让内容像报纸一样分栏展示，提升阅读体验。break-inside: avoid-column 防止元素被分栏打断。'), h('p', {}, '栏目二：第二段内容。column-rule 在栏间画分隔线，column-gap 控制栏间距。'), h('div', { class: 'vp-span-all' }, 'column-span: all 跨所有列'), h('p', {}, '栏目三：第三段。column-fill: balance 默认尽量让各栏高度平衡；auto 让内容自然填充。'), h('p', {}, '栏目四：column-count: 3 强制 3 栏；column-width: 120px 让浏览器按宽度自适应栏数（窄则少栏）。')),
            h('div', { class: 'vp-multicol-narrow' }, h('p', {}, 'column-width: 120px 的自适应栏：浏览器根据容器宽度自动计算栏数（container 宽 / 120px），窄屏自动减栏。'), h('p', {}, '与 column-count 互斥，columns: 12em 3 简写同时声明（取较小值）。')),
        ];
        this.setState({ multicolDemoHtml: demoHtml });
        const info = [
            '===== CSS Multi-column Layout 多栏布局 =====',
            '',
            '【核心属性】',
            '  columns: <column-width> <column-count>;  /* 简写 */',
            '  column-count: 3 | auto;                 /* 强制栏数 */',
            '  column-width: 120px | auto;             /* 理想栏宽，浏览器自适应栏数 */',
            '  column-gap: 16px | normal;              /* 栏间距，normal≈1em */',
            '  column-rule: <width> <style> <color>;   /* 栏间分隔线简写 */',
            '    column-rule-width: 1px | thin | medium | thick',
            '    column-rule-style: solid | dashed | dotted | double | groove | ridge | inset | outset | none | hidden',
            '    column-rule-color: #6366f1 | currentColor',
            '  column-fill: auto | balance | balance-all;  /* 内容填充策略 */',
            '    balance（默认）：各栏高度尽量相等',
            '    auto：按顺序填充，前栏满再下一栏（分页媒体常用）',
            '    balance-all：连续媒体也平衡（实验性）',
            '  column-span: none | all;  /* all 跨所有列，常做标题 */',
            '',
            '【分栏打断控制（CSS Fragmentation Module）】',
            '  break-inside: avoid-column;  /* 防元素被分栏打断（图片/卡片常用）*/',
            '  break-before: column;        /* 元素前强制断栏 */',
            '  break-after: column;         /* 元素后强制断栏 */',
            '',
            '【自适应栏数】',
            '  column-width 让浏览器根据容器宽度自适应：',
            '    容器宽 600px + column-width: 120px → 栏数 = floor((600+gap)/(120+gap))',
            '  与 column-count 同时声明取较小值：',
            '    columns: 120px 3;  /* 最多 3 栏，每栏至少 120px */',
            '',
            '【浏览器支持】',
            `  column-count: ${f.columns ? '✓' : '✗'}  |  column-fill: ${f.columnFill ? '✓' : '✗'}  |  column-span: ${f.columnSpan ? '✓' : '✗'}  |  break-inside: avoid-column: ${f.breakInside ? '✓' : '✗'}`,
            '  全主流浏览器支持（IE10+），column-span: all 仅 Chrome/Safari 早期支持，Firefox 71+',
        ].join('\n');
        this.setState({ multicolInfo: info });
        this._addLog('info', '多栏布局演示：column-count:3 + column-rule + column-span:all + break-inside:avoid-column');
    }
    _renderCard3() {
        const f = this._flags();
        const s = this.state;
        return h(Card, {
            title: 'Card 3 · CSS Multi-column Layout 多栏布局',
            extra: h(Tag, { color: f.columns ? 'success' : 'error' }, f.columns ? 'columns 已支持' : 'columns 未支持'),
        }, h('p', { class: 'fs-sm text-secondary' }, '报纸式多栏布局：columns 简写、column-count/column-width 控制栏数与栏宽、column-rule 画分隔线、column-span: all 跨栏标题、break-inside: avoid-column 防止元素被分栏打断。'), h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' }, this._btn('运行多栏布局演示', { type: 'primary', size: 'sm', onClick: () => this._runMulticolDemo() })), s.multicolDemoHtml ? h('div', { class: 'mt-md' }, s.multicolDemoHtml) : null, s.multicolInfo ? h('pre', { class: 'code-block mt-md' }, s.multicolInfo) : null);
    }
    // ===================== Card 4：内在/外在尺寸 + display 阶梯 =====================
    _runSizingDemo() {
        const f = this._flags();
        const info = [
            '===== CSS 内在/外在尺寸 + display 阶梯 =====',
            '',
            '【内在尺寸（Intrinsic Sizing）—— 元素根据内容自然尺寸】',
            '  width: min-content;   /* 内容最小不可断行宽度，长单词决定 */',
            '  width: max-content;   /* 内容最大不限断行宽度，所有内容一行 */',
            '  width: fit-content;   /* 等于 min(max-content, max(min-content, 可用空间)) */',
            '  width: fit-content(20em);  /* 带 max 参数：fit-content 但上限 20em */',
            '  width: stretch;       /* 拉伸到容器可用空间，新关键字（替代 width:100%） */',
            '',
            '【contain-intrinsic-size —— content-visibility 配套占位】',
            '  .lazy-card {',
            '    content-visibility: auto;            /* 离屏不渲染省性能 */',
            '    contain-intrinsic-size: auto 100px;  /* 占位高度，避免滚动条跳变 CLS */',
            '    /* auto 前缀：首次渲染后记住真实尺寸，再次离屏用真实尺寸 */',
            '  }',
            '',
            '【display 阶梯（CSS Display Module L3）—— display 由内外两部分组成】',
            '  display: block;             /* <block-outside> = 流式块 */',
            '  display: inline;            /* <inline-outside> = 行内 */',
            '  display: inline-block;      /* 行内但内部块级 */',
            '  display: flow-root;         /* 块级 + 创建新 BFC，清除浮动替代 clearfix */',
            '  display: contents;          /* 元素自身不生成盒子，子元素直接参与父级布局 */',
            '  display: list-item;         /* 块级 + 生成 ::marker 列表标记 */',
            '  display: flex / inline-flex;       /* flex 容器 */',
            '  display: grid / inline-grid;       /* grid 容器 */',
            '  display: table / inline-table;     /* 表格布局 */',
            '  display: ruby / ruby-base / ruby-text;  /* 注音布局 */',
            '',
            '【display: flow-root 用法（清除浮动，无需 clearfix hack）】',
            '  .container { display: flow-root; }',
            '  /* 内部 .float-left 自动清除，无需 ::after { content:""; display:table; clear:both } */',
            '',
            '【display: contents 用法（让子元素"穿透"父元素参与祖父布局）】',
            '  /* 父 .grid-item { display: contents; } 时，其子元素直接成为 .grid 的网格项 */',
            '  /* 注意：a11y 影响实验性，部分浏览器旧版本 accessibility tree 仍包含该元素 */',
            '',
            '【浏览器支持】',
            `  min-content: ${f.minContent ? '✓' : '✗'}  |  max-content: ${f.maxContent ? '✓' : '✗'}  |  fit-content: ${f.fitContent ? '✓' : '✗'}  |  stretch: ${f.stretch ? '✓' : '✗'}`,
            `  contain-intrinsic-size: ${f.containIntrinsicSize ? '✓' : '✗'}`,
            `  display: contents: ${f.displayContents ? '✓' : '✗'}  |  flow-root: ${f.flowRoot ? '✓' : '✗'}`,
            '  min/max/fit-content: Firefox 3+/Chrome 46+/Safari 11+',
            '  stretch: 仅 Firefox 92+ 实验性，Chrome/Safari 暂不支持',
            '  contain-intrinsic-size: Chrome 83+/Firefox 110+/Safari 17+',
            '  display: contents: Firefox 37+/Chrome 65+/Safari 11.1+',
            '  display: flow-root: Firefox 53+/Chrome 58+/Safari 13+',
        ].join('\n');
        this.setState({ sizingInfo: info });
        this._addLog('info', '内在/外在尺寸 + display 阶梯演示：min/max/fit-content + display:contents/flow-root');
    }
    _renderCard4() {
        const f = this._flags();
        const s = this.state;
        return h(Card, {
            title: 'Card 4 · 内在/外在尺寸 + display: contents / flow-root',
            extra: h(Tag, { color: f.minContent ? 'success' : 'error' }, f.minContent ? 'intrinsic 已支持' : 'intrinsic 未支持'),
        }, h('p', { class: 'fs-sm text-secondary' }, 'CSS 内在尺寸关键字（min-content/max-content/fit-content/stretch）+ contain-intrinsic-size 占位 + display 阶梯（contents/flow-root/list-item/ruby）。flow-root 创建 BFC 清除浮动替代 clearfix hack；contents 让子元素穿透父元素参与祖父布局。'), h('div', { class: 'vp-sizing-grid' }, h('div', { class: 'vp-sizing-item' }, h('div', { class: 'fs-sm' }, 'min-content'), h('div', { class: 'vp-sz-min' }, '不被断行的最小宽')), h('div', { class: 'vp-sizing-item' }, h('div', { class: 'fs-sm' }, 'max-content'), h('div', { class: 'vp-sz-max' }, '所有内容放一行')), h('div', { class: 'vp-sizing-item' }, h('div', { class: 'fs-sm' }, 'fit-content'), h('div', { class: 'vp-sz-fit' }, '最多 max，最少 min'))), h('div', { class: 'vp-display-row' }, h('div', { class: 'vp-display-box vp-display-flow-root' }, h('div', { class: 'vp-float' }, 'float:left'), h('div', { class: 'vp-float' }, 'float:left')), h('div', { class: 'vp-display-box' }, h('div', { style: 'display: contents;' }, h('div', { style: 'background:#bfdbfe; padding:4px 8px; border-radius:4px;' }, '穿透：父 display:contents')))), h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' }, this._btn('运行尺寸+display 演示', { type: 'primary', size: 'sm', onClick: () => this._runSizingDemo() })), s.sizingInfo ? h('pre', { class: 'code-block mt-md' }, s.sizingInfo) : null);
    }
    _renderLogPanel() {
        const s = this.state;
        return h(Card, { title: '日志面板' }, h('div', { class: 'log-panel' }, s.logs.length === 0
            ? h('div', { class: 'log-empty' }, '暂无日志')
            : s.logs.map((log) => h('div', { class: `log-item log-item--${log.type}` }, h('span', { class: 'log-time' }, log.time), h('span', { class: `log-badge log-badge--${log.type}` }, log.type), h('span', { class: 'log-content' }, log.content)))));
    }
    renderPage() {
        const s = this.state;
        return [
            h('h2', { class: 'section-title' }, 'CSS 视口/容器单位与多栏布局'),
            h('p', { class: 'text-secondary mb-lg' }, s.capsSummary),
            h('div', { class: 'feature-grid' }, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4()),
            this._renderLogPanel(),
        ];
    }
}
//# sourceMappingURL=CSSViewportUnitsMulticolPage.js.map