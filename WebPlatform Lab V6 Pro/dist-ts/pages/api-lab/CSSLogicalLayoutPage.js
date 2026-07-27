// =====================================================================
// CSSLogicalLayoutPage.js —— CSS 逻辑属性与布局 实验室
// 演示 MDN / CSS 逻辑属性与布局特性：
//   1. CSS 逻辑属性基础（Logical Properties）—— 物理属性 vs 逻辑属性
//      （margin-left vs margin-inline-start、padding-top vs padding-block-start、
//       width/height vs inline-size/block-size、top/left vs inset-block-start/inset-inline-start）；
//      inset 简写（inset:0 = top/right/bottom/left:0；inset-inline/inset-block 逻辑简写）；
//      逻辑属性随 writing-mode 和 direction 自动适配
//      （horizontal-tb+ltr：inline=水平左→右、block=垂直上→下；
//       vertical-rl：inline=垂直上→下、block=水平右→左）；
//      浏览器支持：Chrome 87+、Firefox 66+、Safari 15+，
//      CSS.supports('margin-inline-start', '10px') 检测。
//   2. 方向感知布局（Direction-Aware Layout）—— direction: rtl（阿拉伯语/希伯来语）
//      下逻辑属性自动翻转（margin-inline-start 在 ltr 是左边、rtl 是右边）；
//      :dir() 伪类选择器（:dir(rtl) / :dir(ltr)）；unicode-bidi 与 direction 协同处理双向文本；
//      实战：图标+文字布局，rtl 下图标自动到右侧（用 margin-inline-end 而非 margin-right）；
//      vs 物理属性：物理属性 margin-right 在 rtl 下不会翻转，需手动 :dir() 判断。
//   3. writing-mode 与流相对映射（Flow-Relative Mapping）——
//      writing-mode: horizontal-tb（默认）/vertical-rl（竖排右到左）/vertical-lr（竖排左到右）
//      /sideways-rl/sideways-lr；
//      逻辑属性映射随 writing-mode 变化（vertical-rl 时 inline-size=高度、block-size=宽度）；
//      block-size/inline-size：块方向尺寸/行内方向尺寸；
//      min-block-size/min-inline-size/max-block-size/max-inline-size；
//      实战：竖排卡片布局用 block-size 控制水平宽度。
//   4. CSS Subgrid（子网格）—— grid-template-columns: subgrid / grid-template-rows: subgrid
//      子网格继承父网格的轨道；解决嵌套网格对齐问题（父网格列线被子网格共享，无需重复定义）；
//      subgrid 值只能用于嵌套的 grid 容器（display:grid 的子元素且自身也是 grid）；
//      line-names 继承：subgrid 可附加自定义轨道名；
//      浏览器支持：Chrome 117+、Firefox 71+、Safari 16+，
//      CSS.supports('grid-template-columns', 'subgrid') 检测。
//   5. CSS Masonry 布局（砌体布局）—— grid-template-rows: masonry：瀑布流布局，自动填充不留空隙；
//      grid-auto-flow: masonry（早期语法）vs grid-template-rows: masonry（当前语法）；
//      align-tracks/justify-tracks：多轨道对齐；
//      vs Flexbox flex-wrap + 固定高度：masonry 支持不定高项目；
//      浏览器支持：仅 Firefox 实验性（需 flag），
//      CSS.supports('grid-template-rows', 'masonry') 检测。
//   6. 逻辑属性与盒模型（Logical Box Model）——
//      边框逻辑属性（border-inline-start-width/border-block-start-width/border-inline-color）；
//      圆角逻辑属性（border-start-start-radius/border-start-end-radius/
//                    border-end-start-radius/border-end-end-radius，start-end 对应 block/inline）；
//      轮廓逻辑属性（outline-inline-start/outline-block-start）；
//      margin-inline/margin-block 简写（start+end）；padding-inline/padding-block 简写；
//      实战：卡片在 rtl/竖排下边框、圆角、间距自动适配。
// 说明：jsdom 中 CSS 渲染不可用，CSS.supports 可能不可靠或缺失；所有演示通过展示 CSS 代码片段说明，
//       无法真实渲染布局效果。所有调用前做能力检测（try/catch 包裹 CSS.supports），不可用仅记日志，绝不抛异常。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class CSSLogicalLayoutPage extends Page {
    _inited = false;
    _dynamicStyles = [];
    _rtlDemoOn = false;
    _writingMode = '';
    // —— 初始 state ——
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            logicalPropsInfo: '', // Card 1：CSS 逻辑属性基础
            directionAwareInfo: '', // Card 2：方向感知布局
            writingModeInfo: '', // Card 3：writing-mode 与流相对映射
            subgridInfo: '', // Card 4：CSS Subgrid
            masonryInfo: '', // Card 5：CSS Masonry 布局
            boxModelInfo: '', // Card 6：逻辑属性与盒模型
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
        this._rtlDemoOn = false; // Card 2 当前 rtl 演示开关
        this._writingMode = 'horizontal-tb'; // Card 3 当前 writing-mode
        // 一次性能力检测：CSS 逻辑属性与布局全家桶
        const caps = this._caps();
        const parts = [
            `CSS.supports ${caps.cssSupports ? '✓' : '✗'}`,
            `margin-inline-start ${caps.marginInlineStart ? '✓' : '✗'}`,
            `inset ${caps.inset ? '✓' : '✗'}`,
            `:dir() ${caps.dirPseudo ? '✓' : '✗'}`,
            `writing-mode:vertical-rl ${caps.writingMode ? '✓' : '✗'}`,
            `block-size ${caps.blockSize ? '✓' : '✗'}`,
            `subgrid ${caps.subgrid ? '✓' : '✗'}`,
            `masonry ${caps.masonry ? '✓' : '✗'}`,
            `border-start-start-radius ${caps.borderRadiusLogical ? '✓' : '✗'}`,
            `margin-inline ${caps.marginInline ? '✓' : '✗'}`,
        ];
        const anyAvailable = caps.cssSupports;
        const summary = anyAvailable
            ? `CSS 逻辑属性与布局能力检测：${parts.join(' · ')}。jsdom 中 CSS.supports 通常可用但仅做语法检查（不真实渲染），CSS 渲染与布局不可用。可执行的演示将以 CSS.supports 真实探测，并展示 CSS 代码片段说明，缺失特性仅记日志。`
            : '当前环境 CSS.supports 不可用（jsdom 部分版本缺失或受限）；所有按钮点击将仅展示 CSS 代码片段说明，不会抛异常。在真实浏览器（Chrome 117+ 完整支持）中打开可执行真实探测。';
        this.setState({ capsSummary: summary });
        this._addLog(anyAvailable ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!caps.cssSupports)
            this._addLog('warn', 'CSS.supports 不可用（jsdom 部分版本缺失），所有检测降级为仅说明');
        if (!caps.marginInlineStart)
            this._addLog('warn', 'margin-inline-start 不支持（Chrome 87+ / Firefox 66+ / Safari 15+，jsdom 不模拟）');
        if (!caps.dirPseudo)
            this._addLog('warn', ':dir() 伪类不支持或 jsdom 未识别（Chrome 120+ / Firefox 49+ / Safari 17.4+）');
        if (!caps.subgrid)
            this._addLog('warn', 'grid-template-columns: subgrid 不支持（Chrome 117+ / Firefox 71+ / Safari 16+）');
        if (!caps.masonry)
            this._addLog('warn', 'grid-template-rows: masonry 不支持（仅 Firefox 实验性，需 flag）');
        // 一次性注入全部演示样式（仅一次；rerender 不会移除 head 中的 style）
        this._injectDemoStyles();
    }
    componentWillUnmount() {
        // 移除动态创建的 <style> 元素，便于 GC
        for (const style of this._dynamicStyles || []) {
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
    // 返回 Tag 数组：items = [[label, ok], ...]，展示能力状态（✓/✗）
    _capTags(items) {
        return items.map(([label, ok]) => h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
    }
    // —— 同步能力检测（render 时调用，开销可忽略）——
    _caps() {
        const cssSupports = typeof CSS !== 'undefined' && typeof CSS.supports === 'function';
        const sup = (p, v) => {
            try {
                return cssSupports && CSS.supports(p, v);
            }
            catch {
                return false;
            }
        };
        const supSel = (sel) => {
            try {
                return cssSupports && CSS.supports(`selector(${sel})`);
            }
            catch {
                return false;
            }
        };
        return {
            cssSupports,
            marginInlineStart: sup('margin-inline-start', '10px'),
            paddingBlockStart: sup('padding-block-start', '10px'),
            inlineSize: sup('inline-size', '100px'),
            blockSize: sup('block-size', '100px'),
            insetBlockStart: sup('inset-block-start', '0'),
            insetInlineStart: sup('inset-inline-start', '0'),
            inset: sup('inset', '0'),
            insetInline: sup('inset-inline', '0'),
            insetBlock: sup('inset-block', '0'),
            dirPseudo: supSel(':dir(rtl)'),
            writingMode: sup('writing-mode', 'vertical-rl'),
            minBlockSize: sup('min-block-size', '100px'),
            maxBlockSize: sup('max-block-size', '100px'),
            subgrid: sup('grid-template-columns', 'subgrid'),
            masonry: sup('grid-template-rows', 'masonry'),
            alignTracks: sup('align-tracks', 'start'),
            justifyTracks: sup('justify-tracks', 'start'),
            borderInlineStartWidth: sup('border-inline-start-width', '2px'),
            borderBlockStartWidth: sup('border-block-start-width', '2px'),
            borderInlineColor: sup('border-inline-color', 'red'),
            borderRadiusLogical: sup('border-start-start-radius', '10px'),
            outlineInlineStart: sup('outline-inline-start', '2px'),
            outlineBlockStart: sup('outline-block-start', '2px'),
            marginInline: sup('margin-inline', '10px'),
            marginBlock: sup('margin-block', '10px'),
            paddingInline: sup('padding-inline', '10px'),
            paddingBlock: sup('padding-block', '10px'),
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
    // —— 动态注入所有演示样式（逻辑属性 / rtl / writing-mode / subgrid / masonry / 盒模型）——
    _injectDemoStyles() {
        this._injectStyle('css-logical-layout-demo', `
      /* ===== Card 1: 逻辑属性基础 ===== */
      .css-lp-box { padding: 8px; border: 1px solid var(--color-border, #ccc); margin-block-end: 8px; }
      .css-lp-inset { position: relative; height: 80px; border: 1px dashed var(--color-border, #ccc); }
      .css-lp-inset > span { position: absolute; inset-block-start: 8px; inset-inline-start: 8px;
        padding: 4px 8px; background: #3b82f6; color: #fff; border-radius: 4px; }
      /* ===== Card 2: 方向感知布局 ===== */
      .css-da-row { display: flex; align-items: center; gap: 8px; padding: 8px;
        border: 1px solid var(--color-border, #ccc); margin-block-end: 8px; }
      .css-da-row .icon { width: 24px; height: 24px; background: #10b981; border-radius: 4px;
        margin-inline-end: 8px; flex: none; }
      .css-da-row.rtl { direction: rtl; }
      .css-da-row .text { flex: 1; }
      /* ===== Card 3: writing-mode ===== */
      .css-wm-stage { display: flex; gap: 12px; padding: 12px; border: 1px solid var(--color-border, #ccc);
        background: var(--color-bg-spotlight, #f5f5f5); min-height: 120px; align-items: flex-start; }
      .css-wm-card { block-size: 100px; inline-size: 60px; padding: 8px; background: #8b5cf6; color: #fff;
        border-radius: 4px; writing-mode: vertical-rl; display: flex; align-items: center; justify-content: center; }
      .css-wm-card.lr { writing-mode: vertical-lr; }
      .css-wm-card.tb { writing-mode: horizontal-tb; inline-size: 100px; block-size: auto; }
      /* ===== Card 4: Subgrid ===== */
      .css-sg-parent { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 8px;
        border: 1px solid var(--color-border, #ccc); }
      .css-sg-parent > .cell { background: #e6f0ff; padding: 8px; border-radius: 4px; }
      .css-sg-nested { display: grid; grid-template-columns: subgrid; grid-column: span 3;
        background: #e6f9ee; padding: 4px; border-radius: 4px; }
      .css-sg-nested > .sub-cell { background: #fef3c7; padding: 6px; border-radius: 4px; }
      /* ===== Card 5: Masonry ===== */
      .css-ms-grid { display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: masonry;
        gap: 8px; padding: 8px; border: 1px solid var(--color-border, #ccc); }
      .css-ms-item { padding: 8px; color: #fff; border-radius: 4px; }
      /* ===== Card 6: 逻辑盒模型 ===== */
      .css-bm-card { padding-block: 12px; padding-inline: 16px; margin-block-end: 8px;
        border-inline-start-width: 4px; border-inline-start-style: solid; border-inline-start-color: #3b82f6;
        border-start-start-radius: 12px; border-end-end-radius: 12px;
        background: var(--color-bg-spotlight, #f5f5f5); }
      .css-bm-card.rtl { direction: rtl; border-inline-start-color: #ef4444; }
      .css-bm-outline { outline-inline-start: 2px; outline-block-start: 2px; outline-style: dashed;
        outline-color: #f59e0b; padding: 8px; }
    `);
    }
    // =================== Card 1：CSS 逻辑属性基础 ===================
    _showLogicalPropsCaps() {
        const caps = this._caps();
        this.setState({ logicalPropsInfo: '===== CSS 逻辑属性能力检测 =====\n\n' +
                `  CSS.supports                                : ${caps.cssSupports ? 'function（可用）' : 'undefined（不可用）'}\n` +
                `  CSS.supports('margin-inline-start','10px')  : ${caps.marginInlineStart ? 'true（支持）' : 'false / 不可识别'}\n` +
                `  CSS.supports('padding-block-start','10px')  : ${caps.paddingBlockStart ? 'true（支持）' : 'false / 不可识别'}\n` +
                `  CSS.supports('inline-size','100px')         : ${caps.inlineSize ? 'true（支持）' : 'false / 不可识别'}\n` +
                `  CSS.supports('block-size','100px')          : ${caps.blockSize ? 'true（支持）' : 'false / 不可识别'}\n` +
                `  CSS.supports('inset-block-start','0')       : ${caps.insetBlockStart ? 'true（支持）' : 'false / 不可识别'}\n` +
                `  CSS.supports('inset','0')                   : ${caps.inset ? 'true（支持）' : 'false / 不可识别'}\n\n` +
                '物理属性 vs 逻辑属性对应表：\n' +
                '  margin-left / margin-right         →  margin-inline-start / margin-inline-end\n' +
                '  margin-top / margin-bottom         →  margin-block-start / margin-block-end\n' +
                '  padding-left / padding-right       →  padding-inline-start / padding-inline-end\n' +
                '  padding-top / padding-bottom       →  padding-block-start / padding-block-end\n' +
                '  width / height                     →  inline-size / block-size\n' +
                '  min-width / min-height             →  min-inline-size / min-block-size\n' +
                '  max-width / max-height             →  max-inline-size / max-block-size\n' +
                '  top / right / bottom / left        →  inset-block-start / inset-inline-end / inset-block-end / inset-inline-start\n\n' +
                '注：jsdom 中 CSS.supports 可能不识别逻辑属性语法（返回 false 或抛错），不代表真实浏览器不支持。' });
        this._addLog('caps', `逻辑属性检测：cssSupports=${caps.cssSupports}, marginInlineStart=${caps.marginInlineStart}, inset=${caps.inset}`);
    }
    _showPhysicalVsLogical() {
        const caps = this._caps();
        this.setState({ logicalPropsInfo: '===== 物理属性 vs 逻辑属性 详解 =====\n\n' +
                '【物理属性（Physical Properties）】\n' +
                '  以「物理方向」为参照：top/right/bottom/left 对应屏幕的上/右/下/左。\n' +
                '  示例：margin-left: 10px; padding-top: 8px; width: 100px; top: 0;\n' +
                '  特点：方向固定，不随 writing-mode / direction 变化。\n' +
                '  问题：rtl（阿拉伯语/希伯来语）或竖排场景下，left/right 不再对应「阅读起点/终点」，需手动适配。\n\n' +
                '【逻辑属性（Logical Properties）】\n' +
                '  以「流方向」为参照：inline（行内方向）/ block（块方向），start（起点）/ end（终点）。\n' +
                '  示例：margin-inline-start: 10px; padding-block-start: 8px; inline-size: 100px; inset-block-start: 0;\n' +
                '  特点：随 writing-mode / direction 自动重映射，一套样式适配所有书写模式。\n\n' +
                '映射规则（horizontal-tb + ltr，默认）：\n' +
                '  inline 方向 = 水平（左→右），block 方向 = 垂直（上→下）\n' +
                '  inline-start = left，inline-end = right\n' +
                '  block-start = top，block-end = bottom\n' +
                '  inline-size = width，block-size = height\n\n' +
                '为何用逻辑属性：\n' +
                '  1. 国际化：阿拉伯语/希伯来语 rtl 场景，逻辑属性自动翻转，无需 :dir() 判断\n' +
                '  2. 竖排布局：vertical-rl 下 inline-size 自动变高度，一套样式通吃横/竖排\n' +
                '  3. 语义清晰：margin-inline-start 表达「行内起点边距」，比 margin-left 更准确\n' +
                '  4. 维护性：writing-mode 切换无需重写所有边距/尺寸\n\n' +
                `当前环境 CSS.supports('margin-inline-start','10px') = ${caps.marginInlineStart}（jsdom 不一定识别，仅供参考）。` });
        this._addLog('explain', `对比物理 vs 逻辑属性（当前检测 marginInlineStart=${caps.marginInlineStart}）`);
    }
    _showInsetShorthand() {
        const caps = this._caps();
        this.setState({ logicalPropsInfo: '===== inset 简写详解 =====\n\n' +
                '【inset 物理简写】\n' +
                '  inset: 0;                    /* = top:0; right:0; bottom:0; left:0; */\n' +
                '  inset: 10px;                 /* = top/right/bottom/left: 10px */\n' +
                '  inset: 10px 20px;            /* = top/bottom:10px; left/right:20px */\n' +
                '  inset: 10px 20px 30px;       /* = top:10px; left/right:20px; bottom:30px */\n' +
                '  inset: 10px 20px 30px 40px;  /* = top:10px; right:20px; bottom:30px; left:40px */\n' +
                '  等价于 top/right/bottom/left 四个属性的简写，仅用于 position 非 static 的元素。\n\n' +
                '【inset-inline / inset-block 逻辑简写】\n' +
                '  inset-inline: 10px;          /* = inset-inline-start:10px; inset-inline-end:10px; */\n' +
                '  inset-inline: 10px 20px;     /* = inset-inline-start:10px; inset-inline-end:20px; */\n' +
                '  inset-block: 0;              /* = inset-block-start:0; inset-block-end:0; */\n' +
                '  inset-block: 10px 20px;      /* = inset-block-start:10px; inset-block-end:20px; */\n\n' +
                '【全逻辑简写 inset（同物理 inset 但语义为逻辑）】\n' +
                '  inset: 0; 在逻辑属性规范中等价于 inset-block-start/inset-block-end/inset-inline-start/inset-inline-end 全 0\n' +
                '  （浏览器实现中 inset 同时设置物理与逻辑值，二者在 horizontal-tb+ltr 下结果一致）\n\n' +
                '【实战：全屏覆盖层】\n' +
                '  .overlay {\n' +
                '    position: fixed;\n' +
                '    inset: 0;          /* 替代 top:0; right:0; bottom:0; left:0; */\n' +
                '    background: rgba(0,0,0,0.5);\n' +
                '  }\n' +
                '  .badge {\n' +
                '    position: absolute;\n' +
                '    inset-block-start: 8px;    /* 顶部 8px，rtl/竖排自动适配 */\n' +
                '    inset-inline-end: 8px;     /* 行内终点 8px，ltr=右、rtl=左 */\n' +
                '  }\n\n' +
                `当前环境 CSS.supports('inset','0') = ${caps.inset}；CSS.supports('inset-inline','0') = ${caps.insetInline}。` });
        this._addLog('syntax', `展示 inset / inset-inline / inset-block 简写（inset=${caps.inset}, insetInline=${caps.insetInline}）`);
    }
    _showWritingDirectionMapping() {
        const caps = this._caps();
        this.setState({ logicalPropsInfo: '===== 逻辑属性随 writing-mode / direction 自动适配 =====\n\n' +
                '【场景 1：horizontal-tb + ltr（默认，英文/中文横排）】\n' +
                '  inline 方向 = 水平左→右，block 方向 = 垂直上→下\n' +
                '  margin-inline-start = margin-left\n' +
                '  margin-block-start  = margin-top\n' +
                '  inline-size = width，block-size = height\n\n' +
                '【场景 2：horizontal-tb + rtl（阿拉伯语/希伯来语横排）】\n' +
                '  inline 方向 = 水平右→左，block 方向 = 垂直上→下\n' +
                '  margin-inline-start = margin-right   ← 自动翻转！\n' +
                '  margin-block-start  = margin-top     ← block 方向不变\n' +
                '  inline-size = width，block-size = height\n\n' +
                '【场景 3：vertical-rl + ltr（日文/中文竖排右到左）】\n' +
                '  inline 方向 = 垂直上→下，block 方向 = 水平右→左\n' +
                '  margin-inline-start = margin-top     ← inline 变垂直！\n' +
                '  margin-block-start  = margin-right   ← block 变水平！\n' +
                '  inline-size = height，block-size = width   ← 尺寸轴互换！\n\n' +
                '【场景 4：vertical-lr + ltr（蒙古文竖排左到右）】\n' +
                '  inline 方向 = 垂直上→下，block 方向 = 水平左→右\n' +
                '  margin-inline-start = margin-top\n' +
                '  margin-block-start  = margin-left\n' +
                '  inline-size = height，block-size = width\n\n' +
                '核心结论：\n' +
                '  - inline 方向 = 文字排列方向（一行内字与字的走向）\n' +
                '  - block 方向 = 段落换行方向（一行到下一行的走向）\n' +
                '  - 逻辑属性 = 物理属性的「语义抽象」，浏览器根据 writing-mode + direction 自动计算物理值\n' +
                '  - 一套逻辑属性样式可同时适配横排/竖排/ltr/rtl，无需 :dir() 或 media query 分支\n\n' +
                `当前环境 CSS.supports('writing-mode','vertical-rl') = ${caps.writingMode}（jsdom 不一定识别，仅供参考）。` });
        this._addLog('mapping', `展示逻辑属性随 writing-mode/direction 的映射变化（writingMode=${caps.writingMode}）`);
    }
    _renderCard1() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '1. CSS 逻辑属性基础',
            extra: h('div', { class: 'flex gap-xs' }, ...this._capTags([['margin-inline-start', caps.marginInlineStart], ['inset', caps.inset]]), h(Tag, { color: 'primary' }, 'inline / block'), h(Tag, { color: 'info' }, '流相对')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '物理属性 vs 逻辑属性：margin-left vs margin-inline-start、padding-top vs padding-block-start、width/height vs inline-size/block-size、top/left vs inset-block-start/inset-inline-start。inset: 0 = top/right/bottom/left:0；inset-inline/inset-block 逻辑简写。逻辑属性随 writing-mode 和 direction 自动适配：horizontal-tb+ltr 时 inline=水平左→右、block=垂直上→下；vertical-rl 时 inline=垂直上→下、block=水平右→左。Chrome 87+、Firefox 66+、Safari 15+，CSS.supports(\'margin-inline-start\', \'10px\') 检测。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('能力检测', { type: 'primary', size: 'sm', onClick: () => this._showLogicalPropsCaps() }), this._btn('物理 vs 逻辑', { size: 'sm', onClick: () => this._showPhysicalVsLogical() }), this._btn('inset 简写', { size: 'sm', onClick: () => this._showInsetShorthand() }), this._btn('writing-mode/direction 映射', { size: 'sm', onClick: () => this._showWritingDirectionMapping() })),
                h('div', { class: 'fs-sm text-secondary' }, '逻辑属性基础：'),
                h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.logicalPropsInfo || '（点击「能力检测」或「物理 vs 逻辑」）')),
                h(Alert, { type: 'info', message: '逻辑属性 = 物理属性的语义抽象，随书写模式自动重映射', description: 'inline/block/start/end 是流方向语义，浏览器根据 writing-mode + direction 计算物理值。一套逻辑属性样式可同时适配横排/竖排/ltr/rtl。Chrome 87+ / Firefox 66+ / Safari 15+ 支持。jsdom 不模拟，演示仅展示代码片段。' }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 2：方向感知布局 ===================
    _showRtlAutoFlip() {
        const caps = this._caps();
        this.setState({ directionAwareInfo: '===== direction: rtl 下逻辑属性自动翻转 =====\n\n' +
                '【direction 属性】\n' +
                '  direction: ltr（默认） | rtl；\n' +
                '  ltr = 左到右（英文/中文/拉丁语系）；rtl = 右到左（阿拉伯语/希伯来语）\n' +
                '  作用于块级元素，影响文本方向与逻辑属性的物理映射\n\n' +
                '【逻辑属性在 rtl 下的自动翻转】\n' +
                '  .card { margin-inline-start: 10px; }\n' +
                '  ltr 下：margin-inline-start = margin-left（左边距 10px）\n' +
                '  rtl 下：margin-inline-start = margin-right（右边距 10px）← 自动翻转！\n\n' +
                '  .row { padding-inline: 16px 8px; }  /* start 16px, end 8px */\n' +
                '  ltr 下：padding-left:16px; padding-right:8px;\n' +
                '  rtl 下：padding-right:16px; padding-left:8px;  ← 自动互换！\n\n' +
                '【物理属性的局限】\n' +
                '  .card { margin-left: 10px; }  /* 物理属性 */\n' +
                '  ltr 下：左边距 10px\n' +
                '  rtl 下：仍是左边距 10px（不翻转）← 需手动 :dir(rtl) 判断改写\n\n' +
                '  /* 物理属性方案：需 :dir() 分支 */\n' +
                '  .card { margin-left: 10px; }\n' +
                '  .card:dir(rtl) { margin-left: 0; margin-right: 10px; }\n\n' +
                '【实战：图标 + 文字布局】\n' +
                '  .row { display: flex; align-items: center; }\n' +
                '  .icon { margin-inline-end: 8px; }  /* 逻辑属性 */\n' +
                '  ltr：图标在左，margin-inline-end = margin-right（图标右侧 8px 间距）\n' +
                '  rtl：图标自动到右侧（flex 受 direction 影响），margin-inline-end = margin-left（图标左侧 8px 间距）\n' +
                '  → 间距始终在「图标与文字之间」，无需 :dir() 判断\n\n' +
                `当前环境 CSS.supports('margin-inline-start','10px') = ${caps.marginInlineStart}（jsdom 不一定识别，仅供参考）。` });
        this._addLog('rtl', `展示 direction:rtl 下逻辑属性自动翻转（marginInlineStart=${caps.marginInlineStart}）`);
    }
    _showDirPseudo() {
        const caps = this._caps();
        this.setState({ directionAwareInfo: '===== :dir() 伪类选择器 =====\n\n' +
                '【语法】\n' +
                '  :dir(ltr)  /* 匹配 direction: ltr 的元素 */\n' +
                '  :dir(rtl)  /* 匹配 direction: rtl 的元素 */\n\n' +
                '【与 [dir] 属性选择器的区别】\n' +
                '  [dir="rtl"]  仅匹配显式设置 dir="rtl" 属性的元素（不继承）\n' +
                '  :dir(rtl)    匹配计算方向为 rtl 的元素（包括从父级继承的 direction）\n' +
                '  示例：\n' +
                '    <div dir="rtl"><p>文本</p></div>\n' +
                '    p 匹配 :dir(rtl)（继承父级 rtl），但不匹配 [dir="rtl"]（p 无 dir 属性）\n\n' +
                '【用法：物理属性的 rtl 适配】\n' +
                '  .icon { margin-right: 8px; }       /* ltr 默认：图标在右 */\n' +
                '  .icon:dir(rtl) { margin-right: 0; margin-left: 8px; }  /* rtl：图标在左 */\n\n' +
                '  /* 对比：逻辑属性无需 :dir() */\n' +
                '  .icon { margin-inline-end: 8px; }  /* ltr/rtl 自动适配，无需分支 */\n\n' +
                '【用法：方向相关的样式微调】\n' +
                '  .arrow { transform: rotate(0deg); }       /* ltr：箭头朝右 */\n' +
                '  .arrow:dir(rtl) { transform: rotate(180deg); }  /* rtl：箭头朝左 */\n' +
                '  /* 翻转图标方向，逻辑属性无法解决（transform 无逻辑版本）*/\n\n' +
                '【浏览器支持】\n' +
                '  Chrome 120+（2023 年底支持）、Firefox 49+、Safari 17.4+\n' +
                '  CSS.supports("selector(:dir(rtl))") 检测\n' +
                `  当前环境 :dir() 支持 = ${caps.dirPseudo}（jsdom 不一定识别，仅供参考）\n\n` +
                '注：:dir() 主要用于「逻辑属性无法覆盖」的场景（如 transform 翻转、背景图镜像）；间距/边距优先用逻辑属性。' });
        this._addLog('dir', `展示 :dir() 伪类选择器（dirPseudo=${caps.dirPseudo}）`);
    }
    _showUnicodeBidi() {
        this.setState({ directionAwareInfo: '===== unicode-bidi 与 direction 协同处理双向文本 =====\n\n' +
                '【双向文本问题】\n' +
                '  混合 ltr 和 rtl 文本时（如「Hello مرحبا World」），字符的显示方向需根据字符本身的方向性决定。\n' +
                '  Unicode Bidirectional Algorithm（Bidi 算法）自动处理，CSS 通过 direction + unicode-bidi 控制。\n\n' +
                '【direction 属性】\n' +
                '  direction: ltr | rtl；\n' +
                '  设置块级元素的「基础方向」（段落方向），影响逻辑属性映射与文本对齐默认值。\n\n' +
                '【unicode-bidi 属性】\n' +
                '  unicode-bidi: normal | embed | isolate | bidi-override | isolate-override | plaintext;\n\n' +
                '  normal（默认）：使用 Bidi 算法默认行为，不改写方向\n' +
                '  embed：在 Bidi 算法中插入一个方向控制点（lre/rle），方向由 direction 决定，影响整体重排\n' +
                '  isolate：将元素内容隔离，独立计算方向，不影响外部文本（推荐，类似 ubi 隔离）\n' +
                '  bidi-override：覆盖字符方向，强制按 direction 排列（用于强制顺序场景）\n' +
                '  isolate-override：isolate + bidi-override，隔离且强制方向\n' +
                '  plaintext：根据内容自动判断方向（不继承父级 direction，适合用户输入）\n\n' +
                '【实战：用户评论（方向未知）】\n' +
                '  .comment { unicode-bidi: plaintext; }\n' +
                '  /* 每条评论根据内容自动判断 ltr/rtl，不强制继承父级方向 */\n\n' +
                '【实战：嵌入外语文本】\n' +
                '  <p>用户 <span class="name">محمد</span> 发表了评论</p>\n' +
                '  .name { unicode-bidi: isolate; direction: rtl; }\n' +
                '  /* 阿拉伯语名字隔离计算，不影响周围中文方向 */\n\n' +
                '【HTML dir 属性 vs CSS direction】\n' +
                '  <p dir="rtl">...</p>  /* HTML 属性，语义化，推荐 */\n' +
                '  p { direction: rtl; } /* CSS 属性，仅视觉，不改变文档语义 */\n' +
                '  优先用 HTML dir 属性（影响无障碍/SEO），CSS direction 仅用于样式微调\n\n' +
                '注：unicode-bidi 的 isolate/isolate-override/plaintext 是较新值，Chrome/Firefox/Safari 现代版本均支持。' });
        this._addLog('bidi', '展示 unicode-bidi 与 direction 协同处理双向文本');
    }
    _toggleRtlDemo() {
        this._rtlDemoOn = !this._rtlDemoOn;
        const on = this._rtlDemoOn;
        // 重新注入 rtl 切换样式
        const css = on
            ? '.css-da-row.demo { direction: rtl; }'
            : '.css-da-row.demo { direction: ltr; }';
        this._injectStyle('css-logical-layout-rtl-toggle', css);
        this.setState({ directionAwareInfo: '===== 实战：图标 + 文字布局（rtl 切换演示） =====\n\n' +
                `当前演示状态：${on ? 'rtl（direction: rtl）' : 'ltr（direction: ltr，默认）'}\n\n` +
                'HTML 结构：\n' +
                '  <div class="css-da-row demo">\n' +
                '    <div class="icon"></div>\n' +
                '    <div class="text">图标 + 文字（margin-inline-end: 8px）</div>\n' +
                '  </div>\n\n' +
                'CSS（逻辑属性方案）：\n' +
                '  .css-da-row { display: flex; align-items: center; }\n' +
                '  .css-da-row .icon { margin-inline-end: 8px; }  /* 逻辑属性 */\n\n' +
                '效果分析：\n' +
                `  ${on ? 'rtl 模式：direction: rtl 让 flex 主轴反向（row-reverse 效果），图标自动到右侧；margin-inline-end = margin-left（图标左侧 8px 间距）'
                    : 'ltr 模式：direction: ltr 默认，图标在左侧；margin-inline-end = margin-right（图标右侧 8px 间距）'}\n` +
                '  → 间距始终在「图标与文字之间」，无需 :dir() 判断\n\n' +
                '对比物理属性方案（需 :dir() 分支）：\n' +
                '  .icon { margin-right: 8px; }\n' +
                '  .icon:dir(rtl) { margin-right: 0; margin-left: 8px; }\n' +
                '  → 物理属性 margin-right 在 rtl 下不翻转，需手动 :dir(rtl) 改写\n\n' +
                '点击「切换 rtl/ltr」按钮可在真实浏览器中观察图标位置自动翻转（jsdom 不渲染，仅切换 CSS）。' });
        this._addLog('demo', `切换图标+文字演示 → ${on ? 'rtl' : 'ltr'}（逻辑属性自动适配间距）`);
    }
    _renderCard2() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '2. 方向感知布局',
            extra: h('div', { class: 'flex gap-xs' }, ...this._capTags([[':dir()', caps.dirPseudo], ['margin-inline-start', caps.marginInlineStart]]), h(Tag, { color: 'primary' }, 'direction: rtl'), h(Tag, { color: 'warning' }, '双向文本')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'direction: rtl（阿拉伯语/希伯来语）下逻辑属性自动翻转：margin-inline-start 在 ltr 是左边、rtl 是右边。:dir() 伪类选择器（:dir(rtl) / :dir(ltr)）选择特定方向的元素（区别于 [dir] 属性选择器，:dir 匹配计算方向含继承）。unicode-bidi 与 direction 协同处理双向文本（isolate 隔离、plaintext 自动判断）。实战：图标+文字布局用 margin-inline-end 而非 margin-right，rtl 下图标自动到右侧。vs 物理属性：物理属性 margin-right 在 rtl 下不会翻转，需手动 :dir() 判断。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('rtl 自动翻转', { type: 'primary', size: 'sm', onClick: () => this._showRtlAutoFlip() }), this._btn(':dir() 伪类', { size: 'sm', onClick: () => this._showDirPseudo() }), this._btn('unicode-bidi', { size: 'sm', onClick: () => this._showUnicodeBidi() }), this._btn(`切换 rtl/ltr（当前：${this._rtlDemoOn ? 'rtl' : 'ltr'}）`, { size: 'sm', onClick: () => this._toggleRtlDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '方向感知布局：'),
                h('div', { class: 'css-da-row demo mt-xs' }, h('div', { class: 'icon' }), h('div', { class: 'text' }, '图标 + 文字（margin-inline-end: 8px，真实浏览器中切换 rtl 图标自动到右侧）')),
                h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.directionAwareInfo || '（点击「rtl 自动翻转」或「切换 rtl/ltr」）')),
                h(Alert, { type: 'info', message: '逻辑属性让间距/边距在 rtl 下自动翻转，无需 :dir() 判断', description: 'margin-inline-end 在 ltr=margin-right、rtl=margin-left，间距始终在「图标与文字之间」。物理属性需 :dir(rtl) 分支改写。:dir() 主要用于逻辑属性无法覆盖的场景（transform 翻转、背景图镜像）。jsdom 不渲染，演示仅展示代码片段。' }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 3：writing-mode 与流相对映射 ===================
    _showWritingModeValues() {
        const caps = this._caps();
        this.setState({ writingModeInfo: '===== writing-mode 取值详解 =====\n\n' +
                '【writing-mode 属性】\n' +
                '  writing-mode: horizontal-tb | vertical-rl | vertical-lr | sideways-rl | sideways-lr;\n\n' +
                '【horizontal-tb（默认）】\n' +
                '  inline 方向 = 水平左→右，block 方向 = 垂直上→下\n' +
                '  适用：英文/中文/拉丁语系横排\n' +
                '  inline-size = width，block-size = height\n\n' +
                '【vertical-rl】\n' +
                '  inline 方向 = 垂直上→下，block 方向 = 水平右→左\n' +
                '  适用：日文/中文竖排（传统书籍，从右到左翻页）\n' +
                '  inline-size = height，block-size = width\n' +
                '  新段落出现在上一段的左侧\n\n' +
                '【vertical-lr】\n' +
                '  inline 方向 = 垂直上→下，block 方向 = 水平左→右\n' +
                '  适用：蒙古文竖排（从左到右翻页）\n' +
                '  inline-size = height，block-size = width\n' +
                '  新段落出现在上一段的右侧\n\n' +
                '【sideways-rl / sideways-lr（较新，部分浏览器支持）】\n' +
                '  sideways-rl：所有字符顺时针旋转 90°，block 方向 = 右→左\n' +
                '  sideways-lr：所有字符逆时针旋转 90°，block 方向 = 左→右\n' +
                '  与 vertical-* 区别：vertical-* 中拉丁字符仍直立（仅 CJK 字符旋转），sideways-* 所有字符都旋转\n' +
                '  适用：竖排标题中的拉丁文字旋转场景\n\n' +
                '【实战：竖排卡片容器】\n' +
                '  .vertical-deck { writing-mode: vertical-rl; }\n' +
                '  .vertical-deck .card { block-size: 200px; inline-size: 80px; }\n' +
                '  /* block-size 控制水平宽度（200px 宽），inline-size 控制垂直高度（80px 高）*/\n\n' +
                `当前环境 CSS.supports('writing-mode','vertical-rl') = ${caps.writingMode}（jsdom 不一定识别，仅供参考）。` });
        this._addLog('wm', `展示 writing-mode 取值（writingMode=${caps.writingMode}）`);
    }
    _showFlowMapping() {
        const caps = this._caps();
        this.setState({ writingModeInfo: '===== 流相对映射（Flow-Relative Mapping）详解 =====\n\n' +
                '逻辑属性的「流相对」本质：属性名描述「在流中的语义位置」，浏览器根据 writing-mode 计算物理值。\n\n' +
                '【horizontal-tb + ltr（默认）】\n' +
                '  inline 方向（行内）= 水平 →  inline-start = left,   inline-end = right\n' +
                '  block 方向（块）  = 垂直 →  block-start  = top,    block-end   = bottom\n' +
                '  margin-inline-start = margin-left\n' +
                '  margin-block-start  = margin-top\n' +
                '  inset-inline-start  = left\n' +
                '  inset-block-start   = top\n\n' +
                '【vertical-rl + ltr】\n' +
                '  inline 方向 = 垂直 →  inline-start = top,    inline-end = bottom\n' +
                '  block 方向  = 水平 →  block-start  = right,  block-end  = left\n' +
                '  margin-inline-start = margin-top     ← inline 变垂直\n' +
                '  margin-block-start  = margin-right   ← block 变水平\n' +
                '  inset-inline-start  = top\n' +
                '  inset-block-start   = right\n\n' +
                '【vertical-lr + ltr】\n' +
                '  inline 方向 = 垂直 →  inline-start = top,    inline-end = bottom\n' +
                '  block 方向  = 水平 →  block-start  = left,   block-end  = right\n' +
                '  margin-inline-start = margin-top\n' +
                '  margin-block-start  = margin-left\n\n' +
                '【尺寸轴互换】\n' +
                '  horizontal-tb：inline-size = width，  block-size = height\n' +
                '  vertical-*：  inline-size = height， block-size = width   ← 尺寸轴互换！\n\n' +
                '【实战：一套样式适配横/竖排】\n' +
                '  .card { inline-size: 200px; block-size: 100px; padding-inline: 16px; padding-block: 8px; }\n' +
                '  /* horizontal-tb：宽 200px、高 100px，左右 padding 16、上下 padding 8 */\n' +
                '  /* vertical-rl：  高 200px、宽 100px，上下 padding 16、左右 padding 8 */\n' +
                '  /* 一套样式，writing-mode 切换即自动适配，无需重写 */\n\n' +
                '核心：inline = 「文字流动方向」，block = 「换行方向」；逻辑属性始终描述「流方向上的位置」，物理值由浏览器计算。\n\n' +
                `当前环境 CSS.supports('block-size','100px') = ${caps.blockSize}（jsdom 不一定识别，仅供参考）。` });
        this._addLog('mapping', `展示流相对映射（blockSize=${caps.blockSize}）`);
    }
    _showBlockInlineSize() {
        const caps = this._caps();
        this.setState({ writingModeInfo: '===== block-size / inline-size 尺寸属性 =====\n\n' +
                '【基础尺寸属性】\n' +
                '  inline-size: <length> | <percentage> | auto；  /* 行内方向尺寸 */\n' +
                '  block-size:  <length> | <percentage> | auto；  /* 块方向尺寸 */\n\n' +
                '  horizontal-tb：inline-size = width，  block-size = height\n' +
                '  vertical-*：  inline-size = height， block-size = width\n\n' +
                '【最小/最大尺寸】\n' +
                '  min-inline-size / min-block-size   /* 行内/块方向最小尺寸 */\n' +
                '  max-inline-size / max-block-size   /* 行内/块方向最大尺寸 */\n\n' +
                '  horizontal-tb：min-inline-size = min-width，  min-block-size = min-height\n' +
                '  vertical-*：  min-inline-size = min-height， min-block-size = min-width\n\n' +
                '【实战：响应式卡片】\n' +
                '  .card {\n' +
                '    inline-size: 300px;        /* 横排=宽 300px，竖排=高 300px */\n' +
                '    min-block-size: 100px;     /* 横排=最小高度 100px，竖排=最小宽度 100px */\n' +
                '    max-inline-size: 100%;     /* 不超过容器行内方向 */\n' +
                '  }\n\n' +
                '【实战：竖排卡片用 block-size 控制水平宽度】\n' +
                '  .vertical-deck { writing-mode: vertical-rl; display: flex; gap: 8px; }\n' +
                '  .vertical-deck .card {\n' +
                '    block-size: 120px;        /* 竖排下 block=水平，即卡片水平宽度 120px */\n' +
                '    inline-size: 200px;       /* 竖排下 inline=垂直，即卡片垂直高度 200px */\n' +
                '    padding-block: 8px;       /* 水平方向 padding（左右） */\n' +
                '    padding-inline: 12px;     /* 垂直方向 padding（上下） */\n' +
                '  }\n\n' +
                '【为何用 inline-size/block-size 而非 width/height】\n' +
                '  1. writing-mode 切换时尺寸自动适配（横排 width=inline-size，竖排 height=inline-size）\n' +
                '  2. 国际化组件库（如 React Aria、Radix）默认用逻辑尺寸，一套样式适配多语言\n' +
                '  3. 容器查询（container-type: inline-size）也基于行内方向，与逻辑尺寸语义一致\n\n' +
                `当前环境 CSS.supports('block-size','100px') = ${caps.blockSize}；CSS.supports('min-block-size','100px') = ${caps.minBlockSize}；CSS.supports('max-block-size','100px') = ${caps.maxBlockSize}。` });
        this._addLog('size', `展示 block-size/inline-size 尺寸属性（blockSize=${caps.blockSize}, minBlockSize=${caps.minBlockSize}）`);
    }
    _toggleWritingMode() {
        const modes = ['horizontal-tb', 'vertical-rl', 'vertical-lr'];
        const idx = modes.indexOf(this._writingMode);
        this._writingMode = modes[(idx + 1) % modes.length];
        const wm = this._writingMode;
        // 重新注入 writing-mode 切换样式
        const css = `.css-wm-card.demo { writing-mode: ${wm}; ${wm === 'horizontal-tb' ? 'inline-size: 100px; block-size: auto;' : 'inline-size: 60px; block-size: 100px;'} }`;
        this._injectStyle('css-logical-layout-wm-toggle', css);
        this.setState({ writingModeInfo: '===== 实战：竖排卡片布局演示 =====\n\n' +
                `当前 writing-mode：${wm}\n\n` +
                'CSS（竖排卡片容器）：\n' +
                '  .css-wm-stage { display: flex; gap: 12px; padding: 12px; }\n' +
                `  .css-wm-card.demo { writing-mode: ${wm}; }\n` +
                (wm === 'horizontal-tb'
                    ? '    inline-size: 100px; block-size: auto;\n    /* 横排：宽 100px、高自适应 */'
                    : '    inline-size: 60px; block-size: 100px;\n    /* 竖排：高 60px（inline=垂直）、宽 100px（block=水平）*/') + '\n\n' +
                '映射分析：\n' +
                (wm === 'horizontal-tb'
                    ? '  inline 方向 = 水平，block 方向 = 垂直\n  inline-size(100px) = width，block-size(auto) = height\n  文字横排，卡片横向排列'
                    : wm === 'vertical-rl'
                        ? '  inline 方向 = 垂直，block 方向 = 水平右→左\n  inline-size(60px) = height，block-size(100px) = width\n  文字竖排，新卡片出现在左侧'
                        : '  inline 方向 = 垂直，block 方向 = 水平左→右\n  inline-size(60px) = height，block-size(100px) = width\n  文字竖排，新卡片出现在右侧') + '\n\n' +
                '下方 3 张卡片在真实浏览器中可观察：\n' +
                '  - horizontal-tb：横排，卡片横向排列，文字横排\n' +
                '  - vertical-rl：竖排，卡片从右到左排列，文字竖排（CJK 字符直立，拉丁字符旋转）\n' +
                '  - vertical-lr：竖排，卡片从左到右排列，文字竖排\n\n' +
                '点击「切换 writing-mode」按钮循环切换三种模式（jsdom 不渲染，仅切换 CSS）。' });
        this._addLog('demo', `切换 writing-mode → ${wm}（观察 inline/block 方向变化）`);
    }
    _renderCard3() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '3. writing-mode 与流相对映射',
            extra: h('div', { class: 'flex gap-xs' }, ...this._capTags([['writing-mode', caps.writingMode], ['block-size', caps.blockSize]]), h(Tag, { color: 'primary' }, 'vertical-rl'), h(Tag, { color: 'info' }, '流映射')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'writing-mode: horizontal-tb（默认）/vertical-rl（竖排右到左）/vertical-lr（竖排左到右）/sideways-rl/sideways-lr。逻辑属性映射随 writing-mode 变化：vertical-rl 时 inline-size=高度、block-size=宽度。block-size/inline-size 是块方向尺寸/行内方向尺寸，配合 min-block-size/min-inline-size/max-block-size/max-inline-size。实战：竖排卡片布局用 block-size 控制水平宽度，一套逻辑属性样式适配横/竖排。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('writing-mode 取值', { type: 'primary', size: 'sm', onClick: () => this._showWritingModeValues() }), this._btn('流相对映射', { size: 'sm', onClick: () => this._showFlowMapping() }), this._btn('block-size/inline-size', { size: 'sm', onClick: () => this._showBlockInlineSize() }), this._btn(`切换 writing-mode（当前：${this._writingMode}）`, { size: 'sm', onClick: () => this._toggleWritingMode() })),
                h('div', { class: 'fs-sm text-secondary' }, 'writing-mode 演示：'),
                h('div', { class: 'css-wm-stage mt-xs' }, h('div', { class: 'css-wm-card demo' }, '卡片 1'), h('div', { class: 'css-wm-card demo' }, '卡片 2'), h('div', { class: 'css-wm-card demo' }, '卡片 3')),
                h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.writingModeInfo || '（点击「writing-mode 取值」或「切换 writing-mode」）')),
                h(Alert, { type: 'info', message: 'writing-mode 决定 inline/block 方向，逻辑属性自动重映射', description: 'horizontal-tb：inline=水平、block=垂直；vertical-rl：inline=垂直、block=水平右→左。inline-size/block-size 随之互换（width↔height）。一套逻辑属性样式可适配横/竖排，无需重写。jsdom 不渲染，演示仅展示代码片段。' }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 4：CSS Subgrid ===================
    _showSubgridCaps() {
        const caps = this._caps();
        this.setState({ subgridInfo: '===== CSS Subgrid 能力检测 =====\n\n' +
                `  CSS.supports                                       : ${caps.cssSupports ? 'function（可用）' : 'undefined（不可用）'}\n` +
                `  CSS.supports('grid-template-columns','subgrid')    : ${caps.subgrid ? 'true（支持）' : 'false / 不可识别'}\n\n` +
                '浏览器支持：\n' +
                '  Chrome          | 117+（2023 年 9 月）| 完整支持\n' +
                '  Edge            | 117+                | 完整支持\n' +
                '  Firefox         | 71+（2019 年）      | 完整支持（最早支持）\n' +
                '  Safari          | 16+（2022 年）      | 完整支持\n' +
                '  jsdom           | -                   | 不模拟（CSS 渲染不可用）\n\n' +
                '语法：\n' +
                '  .parent { display: grid; grid-template-columns: repeat(3, 1fr); }\n' +
                '  .child  { display: grid; grid-template-columns: subgrid; grid-column: span 3; }\n' +
                '  /* 子元素 .child 作为嵌套 grid，其列轨道继承父网格的列线 */\n\n' +
                '注：jsdom 中 CSS.supports 可能不识别 subgrid 值（返回 false），不代表真实浏览器不支持。' });
        this._addLog('caps', `Subgrid 检测：cssSupports=${caps.cssSupports}, subgrid=${caps.subgrid}`);
    }
    _showSubgridSyntax() {
        const caps = this._caps();
        this.setState({ subgridInfo: '===== CSS Subgrid 语法详解 =====\n\n' +
                '【基础语法】\n' +
                '  .parent {\n' +
                '    display: grid;\n' +
                '    grid-template-columns: repeat(3, 1fr);\n' +
                '    gap: 8px;\n' +
                '  }\n' +
                '  .child {\n' +
                '    display: grid;\n' +
                '    grid-template-columns: subgrid;   /* 继承父网格的列轨道 */\n' +
                '    grid-column: span 3;              /* 子网格跨越父网格 3 列 */\n' +
                '  }\n\n' +
                '【subgrid 值的限制】\n' +
                '  - 只能用于嵌套的 grid 容器（display:grid 的子元素，且自身也是 display:grid）\n' +
                '  - 必须配合 grid-column / grid-row 指定跨越的轨道数（span N）\n' +
                '  - 子网格继承父网格对应方向的轨道（含 gap），无需重复定义 grid-template-columns/rows\n' +
                '  - 可单独 subgrid 列或行：grid-template-columns: subgrid; grid-template-rows: auto;\n\n' +
                '【line-names 继承】\n' +
                '  .parent {\n' +
                '    grid-template-columns: [main-start] 1fr [main-end] 1fr [side-start] 1fr [side-end];\n' +
                '  }\n' +
                '  .child {\n' +
                '    grid-template-columns: subgrid;        /* 继承父网格列线名 */\n' +
                '    /* 子网格内可用 grid-column: main-start / main-end 引用继承的线名 */\n' +
                '  }\n' +
                '  /* 也可附加新线名：grid-template-columns: subgrid [extra-start]; */\n\n' +
                '【subgrid 的 span 行为】\n' +
                '  .child { grid-column: span 2; grid-template-columns: subgrid; }\n' +
                '  /* 子网格跨越父网格 2 列，自身列轨道 = 父网格那 2 列的轨道 */\n' +
                '  若父网格有 4 列，子网格只继承其中 2 列（由 grid-column 起止决定）\n\n' +
                `当前环境 CSS.supports('grid-template-columns','subgrid') = ${caps.subgrid}（jsdom 不一定识别，仅供参考）。` });
        this._addLog('syntax', `展示 Subgrid 语法（subgrid=${caps.subgrid}）`);
    }
    _showNestedAlignment() {
        const caps = this._caps();
        this.setState({ subgridInfo: '===== Subgrid 解决嵌套网格对齐问题 =====\n\n' +
                '【问题：嵌套网格列线不共享】\n' +
                '  .parent { display: grid; grid-template-columns: 1fr 2fr 1fr; }\n' +
                '  .parent > .card { display: grid; grid-template-columns: 1fr 2fr 1fr; }\n' +
                '  /* 子网格独立计算列宽，与父网格列线「不对齐」*/\n' +
                '  现象：父网格第 2 列宽 200px，子网格第 2 列宽可能是 180px（基于子网格自身宽度计算）\n' +
                '  原因：子网格的 1fr 基于自身 content box 计算，与父网格的 1fr（基于父 content box）不同\n\n' +
                '【Subgrid 方案：列线共享】\n' +
                '  .parent { display: grid; grid-template-columns: 1fr 2fr 1fr; gap: 8px; }\n' +
                '  .parent > .card {\n' +
                '    display: grid;\n' +
                '    grid-template-columns: subgrid;   /* 继承父网格列轨道（含 gap）*/\n' +
                '    grid-column: span 3;              /* 跨越父网格 3 列 */\n' +
                '  }\n' +
                '  /* 子网格的列线与父网格完全对齐，1fr 就是父网格的 1fr */\n\n' +
                '【实战：卡片内表单对齐】\n' +
                '  .form-grid { display: grid; grid-template-columns: 100px 1fr; gap: 8px; }\n' +
                '  .form-grid .row {\n' +
                '    display: grid;\n' +
                '    grid-template-columns: subgrid;\n' +
                '    grid-column: span 2;\n' +
                '  }\n' +
                '  /* 每行 label(100px) + input(1fr) 与父网格对齐，多行表单整齐 */\n\n' +
                '【实战：卡片网格内的嵌套卡片】\n' +
                '  .deck { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }\n' +
                '  .deck .card {\n' +
                '    display: grid;\n' +
                '    grid-template-columns: subgrid;\n' +
                '    grid-column: span 1;     /* 单列卡片，内部子元素与父网格列对齐 */\n' +
                '  }\n' +
                '  /* 卡片内的标题、内容、按钮与父网格列线对齐，视觉整齐 */\n\n' +
                '【降级：不支持 subgrid 时】\n' +
                '  - 旧浏览器忽略 subgrid 值，子网格用默认 grid-template-columns（auto）\n' +
                '  - 视觉上可能不对齐，但布局仍可用（不影响功能）\n' +
                '  - 可用 @supports (grid-template-columns: subgrid) 条件加载对齐样式\n\n' +
                `当前环境 CSS.supports('grid-template-columns','subgrid') = ${caps.subgrid}（jsdom 不一定识别，仅供参考）。` });
        this._addLog('align', `展示 Subgrid 解决嵌套对齐（subgrid=${caps.subgrid}）`);
    }
    _showSubgridLineNames() {
        const caps = this._caps();
        this.setState({ subgridInfo: '===== Subgrid line-names 继承 =====\n\n' +
                '【父网格定义列线名】\n' +
                '  .parent {\n' +
                '    display: grid;\n' +
                '    grid-template-columns: [card-start] 1fr [card-end sidebar-start] 200px [sidebar-end];\n' +
                '  }\n\n' +
                '【子网格继承列线名】\n' +
                '  .child {\n' +
                '    display: grid;\n' +
                '    grid-template-columns: subgrid;     /* 继承 card-start/card-end/sidebar-start/sidebar-end */\n' +
                '    grid-column: span 2;                /* 跨越父网格 2 列 */\n' +
                '  }\n' +
                '  .child > .item {\n' +
                '    grid-column: card-start / card-end; /* 引用继承的线名 */\n' +
                '  }\n\n' +
                '【附加新线名】\n' +
                '  .child {\n' +
                '    grid-template-columns: subgrid [extra-start];\n' +
                '    /* 继承父网格线名 + 在末尾附加 extra-start */\n' +
                '  }\n\n' +
                '【line-names 的作用】\n' +
                '  1. 语义化引用：grid-column: card-start / card-end 比数字 grid-column: 1 / 2 更易读\n' +
                '  2. 跨层级对齐：子网格引用父网格线名，确保跨层级元素对齐到同一列线\n' +
                '  3. 重构友好：父网格列顺序调整时，线名引用自动跟随（数字引用会错位）\n\n' +
                '【实战：多层嵌套对齐】\n' +
                '  .layout { display: grid; grid-template-columns: [main-start] 1fr [main-end] 200px [side-end]; }\n' +
                '  .layout > .main {\n' +
                '    display: grid;\n' +
                '    grid-template-columns: subgrid;\n' +
                '    grid-column: main-start / main-end;\n' +
                '  }\n' +
                '  .layout > .main > .article {\n' +
                '    display: grid;\n' +
                '    grid-template-columns: subgrid;     /* 二级嵌套仍继承 */\n' +
                '    grid-column: span 1;\n' +
                '  }\n' +
                '  /* 三层网格共享同一组列线，任意层级元素可对齐到 main-start/main-end */\n\n' +
                `当前环境 CSS.supports('grid-template-columns','subgrid') = ${caps.subgrid}（jsdom 不一定识别，仅供参考）。` });
        this._addLog('names', `展示 Subgrid line-names 继承（subgrid=${caps.subgrid}）`);
    }
    _renderCard4() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '4. CSS Subgrid',
            extra: h('div', { class: 'flex gap-xs' }, ...this._capTags([['subgrid', caps.subgrid]]), h(Tag, { color: 'primary' }, '嵌套对齐'), h(Tag, { color: 'info' }, 'line-names')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'grid-template-columns: subgrid / grid-template-rows: subgrid：子网格继承父网格的轨道，解决嵌套网格对齐问题（父网格列线被子网格共享，无需重复定义）。subgrid 值只能用于嵌套的 grid 容器（display:grid 的子元素且自身也是 grid），需配合 grid-column/grid-row: span N 指定跨越轨道数。line-names 继承：subgrid 可附加自定义轨道名，子网格内可引用父网格线名。浏览器支持：Chrome 117+、Firefox 71+、Safari 16+，CSS.supports(\'grid-template-columns\', \'subgrid\') 检测。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('能力检测', { type: 'primary', size: 'sm', onClick: () => this._showSubgridCaps() }), this._btn('Subgrid 语法', { size: 'sm', onClick: () => this._showSubgridSyntax() }), this._btn('嵌套对齐问题', { size: 'sm', onClick: () => this._showNestedAlignment() }), this._btn('line-names 继承', { size: 'sm', onClick: () => this._showSubgridLineNames() })),
                h('div', { class: 'fs-sm text-secondary' }, 'Subgrid 嵌套演示（真实浏览器中子网格列线与父网格对齐）：'),
                h('div', { class: 'css-sg-parent mt-xs' }, h('div', { class: 'cell' }, '父-1'), h('div', { class: 'cell' }, '父-2'), h('div', { class: 'cell' }, '父-3'), h('div', { class: 'css-sg-nested' }, h('div', { class: 'sub-cell' }, '子-1（对齐父-1）'), h('div', { class: 'sub-cell' }, '子-2（对齐父-2）'), h('div', { class: 'sub-cell' }, '子-3（对齐父-3）'))),
                h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.subgridInfo || '（点击「能力检测」或「Subgrid 语法」）')),
                h(Alert, { type: 'info', message: 'Subgrid 让子网格共享父网格列线，解决嵌套对齐难题', description: '子网格用 grid-template-columns: subgrid 继承父网格轨道（含 gap），无需重复定义且自动对齐。配合 line-names 可跨层级语义化引用列线。Chrome 117+ / Firefox 71+ / Safari 16+ 支持。jsdom 不模拟，演示仅展示代码片段。' }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 5：CSS Masonry 布局 ===================
    _showMasonryCaps() {
        const caps = this._caps();
        this.setState({ masonryInfo: '===== CSS Masonry 能力检测 =====\n\n' +
                `  CSS.supports                                    : ${caps.cssSupports ? 'function（可用）' : 'undefined（不可用）'}\n` +
                `  CSS.supports('grid-template-rows','masonry')    : ${caps.masonry ? 'true（支持）' : 'false / 不可识别'}\n` +
                `  CSS.supports('align-tracks','start')            : ${caps.alignTracks ? 'true（支持）' : 'false / 不可识别'}\n` +
                `  CSS.supports('justify-tracks','start')          : ${caps.justifyTracks ? 'true（支持）' : 'false / 不可识别'}\n\n` +
                '浏览器支持：\n' +
                '  Chrome          | 实验性（需 flag）| 默认未启用，可通过 enable-experimental-web-platform-features 开启\n' +
                '  Edge            | 实验性（需 flag）| 同 Chrome\n' +
                '  Firefox         | 实验性（需 flag）| 最早实现，layout.css.grid-template-masonry-value.enabled\n' +
                '  Safari          | 未支持           | 截至 2024 年未支持\n' +
                '  jsdom           | -                | 不模拟（CSS 渲染不可用）\n\n' +
                '注：Masonry 仍处于 CSS Grid Level 3 草案阶段，规范与语法可能调整，生产环境慎用。\n' +
                '  当前推荐替代：CSS Columns（column-count）或 JS 瀑布流库（如 Masonry.js）。' });
        this._addLog('caps', `Masonry 检测：cssSupports=${caps.cssSupports}, masonry=${caps.masonry}, alignTracks=${caps.alignTracks}`);
    }
    _showMasonrySyntax() {
        const caps = this._caps();
        this.setState({ masonryInfo: '===== CSS Masonry 语法（早期 vs 当前） =====\n\n' +
                '【当前语法（CSS Grid Level 3 草案）】\n' +
                '  .masonry {\n' +
                '    display: grid;\n' +
                '    grid-template-columns: repeat(3, 1fr);\n' +
                '    grid-template-rows: masonry;   /* 行轨道用 masonry 自动瀑布流 */\n' +
                '  }\n' +
                '  /* 子元素按顺序填入最短列，自动不留空隙 */\n\n' +
                '【早期语法（已废弃）】\n' +
                '  .masonry {\n' +
                '    display: grid;\n' +
                '    grid-template-columns: repeat(3, 1fr);\n' +
                '    grid-auto-flow: masonry;       /* 早期提案，现废弃 */\n' +
                '  }\n' +
                '  /* 当前规范改为 grid-template-rows: masonry */\n\n' +
                '【为何废弃 grid-auto-flow: masonry】\n' +
                '  - grid-auto-flow 控制的是「自动放置算法」（dense/sparse），与 masonry 语义混淆\n' +
                '  - masonry 是「行轨道类型」而非「放置算法」，归入 grid-template-rows 更准确\n' +
                '  - 规范调整后，grid-template-rows: masonry 明确表达「行轨道为 masonry 类型」\n\n' +
                '【masonry 的填充算法】\n' +
                '  1. 浏览器测量每个子元素的高度（block-size）\n' +
                '  2. 找到当前最短的列（高度最小的列）\n' +
                '  3. 将下一个子元素放入最短列的底部\n' +
                '  4. 重复直到所有子元素放置完毕\n' +
                '  结果：列高度尽可能均衡，无空隙（不同于普通 grid 的「行对齐」）\n\n' +
                '【与普通 Grid 的区别】\n' +
                '  普通 grid：子元素按行排列，每行高度 = 最高元素，矮元素下方留空\n' +
                '  masonry：  子元素按列填充最短列，无空隙，类似 Pinterest 瀑布流\n\n' +
                `当前环境 CSS.supports('grid-template-rows','masonry') = ${caps.masonry}（jsdom 不一定识别，仅供参考）。` });
        this._addLog('syntax', `展示 Masonry 语法（masonry=${caps.masonry}）`);
    }
    _showMasonryVsFlex() {
        const caps = this._caps();
        this.setState({ masonryInfo: '===== Masonry vs Flexbox flex-wrap 对比 =====\n\n' +
                '【Flexbox flex-wrap 方案（当前常用）】\n' +
                '  .masonry-fallback {\n' +
                '    display: flex;\n' +
                '    flex-wrap: wrap;\n' +
                '    align-content: flex-start;\n' +
                '  }\n' +
                '  .masonry-fallback > .item { flex: 0 0 30%; }\n' +
                '  问题：\n' +
                '  - 子元素按行排列，每行高度 = 最高元素，矮元素下方留空\n' +
                '  - 不定高项目无法真正「瀑布流」（需 JS 计算或固定高度）\n' +
                '  - 列高度不均衡，视觉有空隙\n\n' +
                '【Masonry 方案】\n' +
                '  .masonry {\n' +
                '    display: grid;\n' +
                '    grid-template-columns: repeat(3, 1fr);\n' +
                '    grid-template-rows: masonry;\n' +
                '  }\n' +
                '  优势：\n' +
                '  - 子元素按列填充最短列，无空隙\n' +
                '  - 支持不定高项目（浏览器自动测量）\n' +
                '  - 列高度自动均衡\n' +
                '  - 纯 CSS，无需 JS\n\n' +
                '【CSS Columns 方案（替代）】\n' +
                '  .masonry-columns {\n' +
                '    column-count: 3;\n' +
                '    column-gap: 8px;\n' +
                '  }\n' +
                '  .masonry-columns > .item {\n' +
                '    break-inside: avoid;     /* 防止元素被分到两列 */\n' +
                '    margin-bottom: 8px;\n' +
                '  }\n' +
                '  特点：\n' +
                '  - 真正的瀑布流（无空隙）\n' +
                '  - 但元素顺序按列填充（先填满第 1 列再第 2 列），非「最短列优先」\n' +
                '  - 浏览器支持广泛（IE10+）\n' +
                '  - 适合「顺序不重要」的场景（如图片墙）\n\n' +
                '【JS 瀑布流库（如 Masonry.js）】\n' +
                '  - 优势：兼容性最好，可定制（动画、过滤、排序）\n' +
                '  - 劣势：需 JS 计算，性能开销；首屏可能闪烁\n' +
                '  - 适合：复杂交互需求或旧浏览器支持\n\n' +
                '选型建议：\n' +
                '  - 现代浏览器 + 纯展示：等待 Masonry 标准化（或用 @supports 检测）\n' +
                '  - 当前生产环境：CSS Columns（最简单）或 JS 库（最兼容）\n' +
                '  - Flexbox flex-wrap 仅适合「等高行」场景，非真正瀑布流\n\n' +
                `当前环境 CSS.supports('grid-template-rows','masonry') = ${caps.masonry}（jsdom 不一定识别，仅供参考）。` });
        this._addLog('compare', `对比 Masonry vs Flexbox vs Columns（masonry=${caps.masonry}）`);
    }
    _showAlignTracks() {
        const caps = this._caps();
        this.setState({ masonryInfo: '===== align-tracks / justify-tracks 多轨道对齐 =====\n\n' +
                '【问题：masonry 多列对齐】\n' +
                '  普通 grid 用 align-items / justify-items 控制单元对齐，但 masonry 有多列独立轨道，\n' +
                '  需 align-tracks / justify-tracks 分别对齐每个轨道。\n\n' +
                '【align-tracks（masonry 行方向对齐）】\n' +
                '  .masonry {\n' +
                '    grid-template-rows: masonry;\n' +
                '    align-tracks: start;       /* 所有列统一 start 对齐 */\n' +
                '  }\n' +
                '  取值：start | end | center | stretch | space-between | space-around | space-evenly\n' +
                '  也可多值：align-tracks: start center end;  /* 每列独立对齐 */\n\n' +
                '【justify-tracks（masonry 列方向对齐）】\n' +
                '  .masonry {\n' +
                '    grid-template-rows: masonry;\n' +
                '    justify-tracks: start;     /* 列内元素水平对齐 */\n' +
                '  }\n' +
                '  取值同 align-tracks，控制每列内元素的水平对齐\n\n' +
                '【与 align-items / justify-items 的区别】\n' +
                '  align-items：普通 grid 单轨道对齐（所有单元同一行）\n' +
                '  align-tracks：masonry 多轨道对齐（每列独立行轨道）\n' +
                '  masonry 下每列是独立的「行轨道」，需 align-tracks 分别控制\n\n' +
                '【实战：图片墙对齐】\n' +
                '  .photo-wall {\n' +
                '    display: grid;\n' +
                '    grid-template-columns: repeat(4, 1fr);\n' +
                '    grid-template-rows: masonry;\n' +
                '    gap: 12px;\n' +
                '    align-tracks: start;       /* 每列图片顶部对齐 */\n' +
                '    justify-tracks: center;    /* 每列图片水平居中 */\n' +
                '  }\n' +
                '  .photo-wall > img { inline-size: 100%; }\n\n' +
                '【浏览器支持】\n' +
                '  align-tracks / justify-tracks 是 masonry 配套属性，仅 Firefox 实验性支持（需 flag）\n' +
                '  Chrome/Safari 尚未实现\n' +
                `  CSS.supports('align-tracks','start') = ${caps.alignTracks}\n` +
                `  CSS.supports('justify-tracks','start') = ${caps.justifyTracks}\n\n` +
                '注：masonry 整体仍处草案阶段，align-tracks/justify-tracks 语法可能调整。' });
        this._addLog('align', `展示 align-tracks/justify-tracks（alignTracks=${caps.alignTracks}, justifyTracks=${caps.justifyTracks}）`);
    }
    _renderCard5() {
        const s = this.state;
        const caps = this._caps();
        const heights = [60, 100, 80, 120, 70, 90];
        const colors = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899'];
        const card = new Card({
            title: '5. CSS Masonry 布局',
            extra: h('div', { class: 'flex gap-xs' }, ...this._capTags([['masonry', caps.masonry], ['align-tracks', caps.alignTracks]]), h(Tag, { color: 'primary' }, '瀑布流'), h(Tag, { color: 'warning' }, '实验性')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'grid-template-rows: masonry：瀑布流布局，自动填充不留空隙（子元素按列填入最短列）。grid-auto-flow: masonry（早期语法，已废弃）vs grid-template-rows: masonry（当前语法）。align-tracks/justify-tracks：多轨道对齐（masonry 每列独立行轨道，需分别对齐）。vs Flexbox flex-wrap + 固定高度：masonry 支持不定高项目，列高度自动均衡。浏览器支持：仅 Firefox 实验性（需 flag），CSS.supports(\'grid-template-rows\', \'masonry\') 检测。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('能力检测', { type: 'primary', size: 'sm', onClick: () => this._showMasonryCaps() }), this._btn('Masonry 语法', { size: 'sm', onClick: () => this._showMasonrySyntax() }), this._btn('Masonry vs Flex', { size: 'sm', onClick: () => this._showMasonryVsFlex() }), this._btn('align-tracks/justify-tracks', { size: 'sm', onClick: () => this._showAlignTracks() })),
                h('div', { class: 'fs-sm text-secondary' }, 'Masonry 演示（真实浏览器中瀑布流，jsdom 不渲染）：'),
                h('div', { class: 'css-ms-grid mt-xs' }, ...heights.map((hgt, i) => h('div', {
                    class: 'css-ms-item', style: { background: colors[i], height: `${hgt}px` },
                }, `项目 ${i + 1}（高 ${hgt}px）`))),
                h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.masonryInfo || '（点击「能力检测」或「Masonry 语法」）')),
                h(Alert, { type: 'warning', message: 'Masonry 仍处草案阶段，仅 Firefox 实验性支持', description: 'grid-template-rows: masonry 是当前语法（废弃早期 grid-auto-flow: masonry）。生产环境推荐 CSS Columns 或 JS 瀑布流库替代。align-tracks/justify-tracks 是 masonry 配套多轨道对齐属性。jsdom 不模拟，演示仅展示代码片段。' }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 6：逻辑属性与盒模型 ===================
    _showBorderLogical() {
        const caps = this._caps();
        this.setState({ boxModelInfo: '===== 边框逻辑属性 =====\n\n' +
                '【边框宽度逻辑属性】\n' +
                '  border-inline-start-width: 2px;   /* 行内起点边框宽 */\n' +
                '  border-inline-end-width: 2px;     /* 行内终点边框宽 */\n' +
                '  border-block-start-width: 2px;    /* 块起点边框宽 */\n' +
                '  border-block-end-width: 2px;      /* 块终点边框宽 */\n' +
                '  border-inline-width: 2px;         /* 行内方向两边（简写）*/\n' +
                '  border-block-width: 2px;          /* 块方向两边（简写）*/\n\n' +
                '【边框样式逻辑属性】\n' +
                '  border-inline-start-style: solid;\n' +
                '  border-block-start-style: dashed;\n' +
                '  border-inline-style: solid;       /* 简写 */\n' +
                '  border-block-style: dashed;       /* 简写 */\n\n' +
                '【边框颜色逻辑属性】\n' +
                '  border-inline-start-color: #3b82f6;\n' +
                '  border-block-start-color: #ef4444;\n' +
                '  border-inline-color: #3b82f6;     /* 简写 */\n' +
                '  border-block-color: #ef4444;      /* 简写 */\n\n' +
                '【边框简写逻辑属性】\n' +
                '  border-inline-start: 2px solid #3b82f6;   /* width + style + color 简写 */\n' +
                '  border-block-start: 2px dashed #ef4444;\n' +
                '  border-inline: 2px solid #3b82f6;         /* 行内两边简写 */\n' +
                '  border-block: 2px dashed #ef4444;         /* 块两边简写 */\n\n' +
                '【映射规则（horizontal-tb + ltr）】\n' +
                '  border-inline-start = border-left\n' +
                '  border-inline-end   = border-right\n' +
                '  border-block-start  = border-top\n' +
                '  border-block-end    = border-bottom\n\n' +
                '【rtl 下自动翻转】\n' +
                '  border-inline-start: 2px solid #3b82f6;\n' +
                '  ltr：左边框 2px 蓝色\n' +
                '  rtl：右边框 2px 蓝色（自动翻转）\n\n' +
                '【实战：卡片左侧强调边框】\n' +
                '  .card {\n' +
                '    border-inline-start: 4px solid #3b82f6;  /* 行内起点边框 */\n' +
                '    padding-inline: 16px;\n' +
                '  }\n' +
                '  /* ltr：左边框 4px 蓝色 */\n' +
                '  /* rtl：右边框 4px 蓝色（自动适配，无需 :dir() 判断）*/\n\n' +
                `当前环境 CSS.supports('border-inline-start-width','2px') = ${caps.borderInlineStartWidth}；CSS.supports('border-block-start-width','2px') = ${caps.borderBlockStartWidth}；CSS.supports('border-inline-color','red') = ${caps.borderInlineColor}。` });
        this._addLog('border', `展示边框逻辑属性（borderInlineStartWidth=${caps.borderInlineStartWidth}）`);
    }
    _showRadiusLogical() {
        const caps = this._caps();
        this.setState({ boxModelInfo: '===== 圆角逻辑属性 =====\n\n' +
                '【四个逻辑圆角属性】\n' +
                '  border-start-start-radius: 12px;   /* 块起点 + 行内起点 圆角 */\n' +
                '  border-start-end-radius: 12px;     /* 块起点 + 行内终点 圆角 */\n' +
                '  border-end-start-radius: 12px;     /* 块终点 + 行内起点 圆角 */\n' +
                '  border-end-end-radius: 12px;       /* 块终点 + 行内终点 圆角 */\n\n' +
                '【命名规则：start-end 对应 block/inline】\n' +
                '  第一个 start/end = 块方向（block-start / block-end）\n' +
                '  第二个 start/end = 行内方向（inline-start / inline-end）\n' +
                '  示例：border-start-end-radius = 块起点 + 行内终点 的角\n\n' +
                '【映射规则（horizontal-tb + ltr）】\n' +
                '  border-start-start-radius = border-top-left-radius      /* 左上 */\n' +
                '  border-start-end-radius   = border-top-right-radius     /* 右上 */\n' +
                '  border-end-start-radius   = border-bottom-left-radius   /* 左下 */\n' +
                '  border-end-end-radius     = border-bottom-right-radius  /* 右下 */\n\n' +
                '【rtl 下自动翻转】\n' +
                '  border-start-start-radius: 12px;\n' +
                '  ltr：左上角圆角 12px\n' +
                '  rtl：右上角圆角 12px（inline-start 从 left 变 right）\n\n' +
                '【vertical-rl 下映射】\n' +
                '  border-start-start-radius = border-top-right-radius  /* 块起点=右，行内起点=上 */\n' +
                '  border-start-end-radius   = border-bottom-right-radius\n' +
                '  border-end-start-radius   = border-top-left-radius\n' +
                '  border-end-end-radius     = border-bottom-left-radius\n\n' +
                '【实战：卡片对角圆角】\n' +
                '  .card {\n' +
                '    border-start-start-radius: 12px;   /* 块起点+行内起点 */\n' +
                '    border-end-end-radius: 12px;       /* 块终点+行内终点 */\n' +
                '    /* 对角圆角，ltr=左上+右下；rtl=右上+左下（自动适配）*/\n' +
                '  }\n\n' +
                '【vs 物理圆角属性】\n' +
                '  border-top-left-radius: 12px;     /* 物理属性，固定左上 */\n' +
                '  border-start-start-radius: 12px;  /* 逻辑属性，rtl/竖排自动适配 */\n' +
                '  → 国际化组件库优先用逻辑圆角\n\n' +
                `当前环境 CSS.supports('border-start-start-radius','10px') = ${caps.borderRadiusLogical}（jsdom 不一定识别，仅供参考）。` });
        this._addLog('radius', `展示圆角逻辑属性（borderRadiusLogical=${caps.borderRadiusLogical}）`);
    }
    _showOutlineLogical() {
        const caps = this._caps();
        this.setState({ boxModelInfo: '===== 轮廓逻辑属性 =====\n\n' +
                '【outline 逻辑属性】\n' +
                '  outline-inline-start: 2px;    /* 行内起点轮廓宽 */\n' +
                '  outline-inline-end: 2px;      /* 行内终点轮廓宽 */\n' +
                '  outline-block-start: 2px;     /* 块起点轮廓宽 */\n' +
                '  outline-block-end: 2px;       /* 块终点轮廓宽 */\n\n' +
                '  outline-inline: 2px;          /* 行内方向两边简写 */\n' +
                '  outline-block: 2px;           /* 块方向两边简写 */\n\n' +
                '【outline-color / outline-style 逻辑版本】\n' +
                '  outline-color: #f59e0b;       /* outline-color 无逻辑版本（颜色不分方向）*/\n' +
                '  outline-style: dashed;        /* outline-style 无逻辑版本（样式不分方向）*/\n' +
                '  → 仅 outline 的宽度有逻辑属性（outline-inline-start 等）\n\n' +
                '【outline vs border 区别】\n' +
                '  border：占用布局空间（影响元素尺寸）\n' +
                '  outline：不占用布局空间（绘制在 border 外，不影响元素尺寸）\n' +
                '  → outline 常用于焦点高亮（:focus），不挤压内容\n\n' +
                '【实战：焦点高亮（rtl 适配）】\n' +
                '  .focusable:focus {\n' +
                '    outline-inline-start: 2px;   /* 行内起点轮廓 */\n' +
                '    outline-block-start: 2px;    /* 块起点轮廓 */\n' +
                '    outline-style: dashed;\n' +
                '    outline-color: #f59e0b;\n' +
                '  }\n' +
                '  /* ltr：左 + 上 轮廓；rtl：右 + 上 轮廓（自动适配）*/\n\n' +
                '【与 border 逻辑属性的对比】\n' +
                '  border-inline-start：占用布局（影响 padding/border box）\n' +
                '  outline-inline-start：不占布局（绘制在 border 外）\n' +
                '  → 需要不影响布局的高亮用 outline，需要参与布局的用 border\n\n' +
                '【浏览器支持】\n' +
                '  outline-inline-start / outline-block-start 等较新（Chrome 94+ / Firefox 66+ / Safari 16.4+）\n' +
                '  outline 的逻辑属性支持晚于 border 的逻辑属性\n' +
                `  当前环境 CSS.supports('outline-inline-start','2px') = ${caps.outlineInlineStart}；CSS.supports('outline-block-start','2px') = ${caps.outlineBlockStart}（jsdom 不一定识别，仅供参考）。` });
        this._addLog('outline', `展示轮廓逻辑属性（outlineInlineStart=${caps.outlineInlineStart}）`);
    }
    _showMarginPaddingShorthand() {
        const caps = this._caps();
        this.setState({ boxModelInfo: '===== margin / padding 逻辑简写 =====\n\n' +
                '【margin 逻辑简写】\n' +
                '  margin-inline: 10px;          /* = margin-inline-start:10px; margin-inline-end:10px; */\n' +
                '  margin-inline: 10px 20px;     /* = margin-inline-start:10px; margin-inline-end:20px; */\n' +
                '  margin-block: 10px;           /* = margin-block-start:10px; margin-block-end:10px; */\n' +
                '  margin-block: 10px 20px;      /* = margin-block-start:10px; margin-block-end:20px; */\n\n' +
                '【padding 逻辑简写】\n' +
                '  padding-inline: 16px;         /* = padding-inline-start:16px; padding-inline-end:16px; */\n' +
                '  padding-inline: 16px 8px;     /* = padding-inline-start:16px; padding-inline-end:8px; */\n' +
                '  padding-block: 12px;          /* = padding-block-start:12px; padding-block-end:12px; */\n' +
                '  padding-block: 12px 8px;      /* = padding-block-start:12px; padding-block-end:8px; */\n\n' +
                '【与物理简写对比】\n' +
                '  margin: 10px 20px;            /* 物理简写：top/bottom:10px; left/right:20px */\n' +
                '  margin-inline: 10px 20px;     /* 逻辑简写：start:10px; end:20px（rtl 自动翻转）*/\n' +
                '  margin-block: 10px 20px;      /* 逻辑简写：block-start:10px; block-end:20px */\n\n' +
                '【映射规则（horizontal-tb + ltr）】\n' +
                '  margin-inline  = margin-left + margin-right\n' +
                '  margin-block   = margin-top + margin-bottom\n' +
                '  padding-inline = padding-left + padding-right\n' +
                '  padding-block  = padding-top + padding-bottom\n\n' +
                '【rtl 下自动翻转】\n' +
                '  margin-inline: 10px 20px;\n' +
                '  ltr：margin-left:10px; margin-right:20px;\n' +
                '  rtl：margin-right:10px; margin-left:20px;  ← start/end 互换！\n\n' +
                '【vertical-rl 下映射】\n' +
                '  margin-inline  = margin-top + margin-bottom   /* inline 变垂直 */\n' +
                '  margin-block   = margin-right + margin-left   /* block 变水平 */\n' +
                '  → 一套逻辑简写适配横/竖排\n\n' +
                '【实战：卡片间距（rtl/竖排自动适配）】\n' +
                '  .card {\n' +
                '    padding-block: 12px;      /* 块方向 padding（ltr=上下）*/\n' +
                '    padding-inline: 16px;     /* 行内方向 padding（ltr=左右）*/\n' +
                '    margin-block-end: 8px;    /* 块终点 margin（ltr=下边距）*/\n' +
                '  }\n' +
                '  /* ltr：上下 padding 12、左右 padding 16、下边距 8 */\n' +
                '  /* rtl：上下 padding 12、左右 padding 16（自动翻转）、下边距 8 */\n' +
                '  /* vertical-rl：左右 padding 12、上下 padding 16、右边距 8（block-end=left）*/\n\n' +
                '【为何用逻辑简写而非物理 margin/padding】\n' +
                '  1. 国际化：rtl/竖排场景自动适配，无需 :dir() 分支\n' +
                '  2. 语义清晰：margin-block-end 表达「块终点边距」，比 margin-bottom 更通用\n' +
                '  3. 组件库友好：一套样式适配所有书写模式（React Aria / Radix 默认用逻辑属性）\n\n' +
                `当前环境 CSS.supports('margin-inline','10px') = ${caps.marginInline}；CSS.supports('margin-block','10px') = ${caps.marginBlock}；CSS.supports('padding-inline','10px') = ${caps.paddingInline}；CSS.supports('padding-block','10px') = ${caps.paddingBlock}。` });
        this._addLog('shorthand', `展示 margin/padding 逻辑简写（marginInline=${caps.marginInline}, paddingBlock=${caps.paddingBlock}）`);
    }
    _renderCard6() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '6. 逻辑属性与盒模型',
            extra: h('div', { class: 'flex gap-xs' }, ...this._capTags([['border-start-start-radius', caps.borderRadiusLogical], ['margin-inline', caps.marginInline]]), h(Tag, { color: 'primary' }, '边框/圆角'), h(Tag, { color: 'info' }, '简写')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '边框逻辑属性（border-inline-start-width/border-block-start-width/border-inline-color）；圆角逻辑属性（border-start-start-radius/border-start-end-radius/border-end-start-radius/border-end-end-radius，start-end 对应 block/inline）；轮廓逻辑属性（outline-inline-start/outline-block-start）；margin-inline/margin-block 简写（start+end）；padding-inline/padding-block 简写。实战：卡片在 rtl/竖排下边框、圆角、间距自动适配。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('边框逻辑属性', { type: 'primary', size: 'sm', onClick: () => this._showBorderLogical() }), this._btn('圆角逻辑属性', { size: 'sm', onClick: () => this._showRadiusLogical() }), this._btn('轮廓逻辑属性', { size: 'sm', onClick: () => this._showOutlineLogical() }), this._btn('margin/padding 简写', { size: 'sm', onClick: () => this._showMarginPaddingShorthand() })),
                h('div', { class: 'fs-sm text-secondary' }, '逻辑盒模型演示（border-inline-start / border-start-start-radius / padding-block 等）：'),
                h('div', { class: 'css-bm-card mt-xs' }, h('div', {}, '卡片 1（ltr，border-inline-start 蓝色、对角圆角、padding-block/padding-inline）')),
                h('div', { class: 'css-bm-card rtl mt-xs' }, h('div', {}, '卡片 2（rtl，border-inline-start 自动到右侧并变红）')),
                h('div', { class: 'css-bm-outline mt-xs' }, '轮廓元素（outline-inline-start/outline-block-start，dashed 黄色）'),
                h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.boxModelInfo || '（点击「边框逻辑属性」或「圆角逻辑属性」）')),
                h(Alert, { type: 'info', message: '逻辑盒模型让边框/圆角/间距在 rtl/竖排下自动适配', description: 'border-inline-start 在 ltr=左边框、rtl=右边框；border-start-start-radius 在 ltr=左上、rtl=右上。margin-inline/padding-block 简写随书写模式自动翻转。国际化组件库优先用逻辑盒模型。jsdom 不模拟，演示仅展示代码片段。' }),
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
        return h('div', { class: 'api-lab-page css-logical-layout-page' }, h('h2', { class: 'section-title' }, 'CSS 逻辑属性与布局'), h('p', { class: 'fs-sm text-secondary mb-md' }, '本页演示 CSS 逻辑属性基础（物理 vs 逻辑、inset 简写、writing-mode/direction 自动适配）、方向感知布局（direction:rtl、:dir() 伪类、unicode-bidi）、writing-mode 与流相对映射（block-size/inline-size）、CSS Subgrid、CSS Masonry 瀑布流、逻辑盒模型（边框/圆角/轮廓/简写）。所有特性通过 CSS.supports 能力检测，不可用时仅记日志，绝不抛异常。jsdom 中 CSS 渲染不可用，所有演示通过 CSS 代码片段说明。'), s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderLogPanel());
    }
}
//# sourceMappingURL=CSSLogicalLayoutPage.js.map