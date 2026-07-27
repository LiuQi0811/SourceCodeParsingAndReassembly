// =====================================================================
// CSSStartingStylePage.js —— CSS @starting-style 与过渡实验室
// 演示 MDN / CSS Working Draft：
//   1. @starting-style 规则 —— 定义元素「起始样式」（首次出现时的过渡起点）；
//      语法 `@starting-style { .popover { opacity: 0; transform: scale(0.9); } }`；
//      解决 display:none → display:block 时浏览器跳过 first frame、过渡无法触发的问题；
//      嵌套在规则内或外均可（Chrome 117+ 支持 .open 内 @starting-style 嵌套写法）。
//   2. transition-behavior: allow-discrete —— 默认 display 是 discrete 属性（瞬变，不参与过渡）；
//      `transition: display 0.3s allow-discrete` 或 `transition-behavior: allow-discrete` 让 display 在过渡期间保持中间值；
//      进入：display none→block + opacity 0→1；退出：display block→none（保持可过渡状态到过渡结束才真正 none）。
//   3. interpolate-size: allow-keywords —— 传统 height/width: auto 不能插值（只能 fixed 长度）；
//      `:root { interpolate-size: allow-keywords; }` 允许 auto/min-content/max-content/fit-content 关键字参与过渡；
//      `.acc { height: 0; transition: height 0.3s; } .acc.open { height: auto; }`（无需 JS 测量高度）；
//      Chrome 129+ 支持；与 calc-size() 协同（calc-size(auto, size + 10px)）。
//   4. display 过渡完整模式 —— popover/tooltip 进入退出过渡组合：
//      `.popover { display: none; opacity: 0; transform: scale(0.9);
//        transition: display 0.3s allow-discrete, opacity 0.3s, transform 0.3s;
//        @starting-style { opacity: 0; transform: scale(0.9); } }
//      .popover.open { display: block; opacity: 1; transform: scale(1);
//        @starting-style { opacity: 0; transform: scale(0.9); } }`；
//      进入：@starting-style 提供 opacity:0 起点 → opacity:1；退出：display 保持 block 到过渡结束才 none。
//   5. 与 Web Animations API / View Transitions 协同 —— @starting-style 是「declarative 进入过渡」；
//      WAAPI 是「imperative 程序化动画」；View Transitions 是「DOM 切换快照过渡」；
//      决策：单元素进入/退出 → @starting-style；运行时动态动画 → WAAPI；DOM 结构变化 → View Transitions。
//   6. 浏览器支持与 polyfill 策略 —— @starting-style（Chrome 117+ / Safari 17.5+ / Firefox 129+）、
//      transition-behavior（Chrome 117+）、interpolate-size（Chrome 129+）；
//      polyfill：无法完美 polyfill（依赖浏览器渲染时机）；降级策略：不支持时元素立即显隐（无过渡，仍可用）；
//      JS 模拟：requestAnimationFrame + class toggle 模拟 first frame；@supports 渐进增强。
// 说明：jsdom 中 CSS 渲染不可用，CSS.supports 可能不可靠或缺失；所有演示通过展示 CSS 代码片段说明，无法真实渲染过渡效果。
//       所有调用前做能力检测（try/catch 包裹 CSS.supports），不可用仅记日志，绝不抛异常。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class CSSStartingStylePage extends Page {
    _inited = false;
    _rafIds = [];
    _styleEl = null;
    // —— 初始 state ——
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            startingStyleInfo: '', // Card 1：@starting-style 基础
            transitionBehaviorInfo: '', // Card 2：transition-behavior: allow-discrete
            interpolateSizeInfo: '', // Card 3：interpolate-size: allow-keywords
            displayTransitionInfo: '', // Card 4：display 过渡完整模式
            synergyInfo: '', // Card 5：与 Web Animations API / View Transitions 协同
            supportInfo: '', // Card 6：浏览器支持与 polyfill 策略
        };
    }
    // —— 生命周期 ——
    componentDidMount() {
        // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
        if (this._inited)
            return;
        this._inited = true;
        // 一次性初始化各实例引用（componentWillUnmount 中释放）
        this._rafIds = []; // 模拟 polyfill 时注册的 requestAnimationFrame 句柄
        this._styleEl = null; // 动态插入的 <style> 引用（如真实注入演示样式）
        // 一次性能力检测：@starting-style + transition-behavior + interpolate-size
        const caps = this._caps();
        const parts = [
            `@starting-style ${caps.startingStyle ? '✓' : '✗'}`,
            `transition-behavior ${caps.transitionBehavior ? '✓' : '✗'}`,
            `interpolate-size ${caps.interpolateSize ? '✓' : '✗'}`,
            `CSS.supports ${caps.cssSupports ? '✓' : '✗'}`,
        ];
        const anyAvailable = caps.cssSupports;
        const summary = anyAvailable
            ? `CSS 过渡新特性能力检测：${parts.join(' · ')}。jsdom 中 CSS.supports 通常可用但仅做语法检查（不真实渲染），CSS 渲染与过渡时机不可用。可执行的演示将以 CSS.supports 真实探测，并展示 CSS 代码片段说明，缺失特性仅记日志。`
            : '当前环境 CSS.supports 不可用（jsdom 部分版本缺失或受限）；所有按钮点击将仅展示 CSS 代码片段说明，不会抛异常。在真实浏览器（Chrome 129+ 完整支持）中打开可执行真实探测。';
        this.setState({ capsSummary: summary });
        this._addLog(anyAvailable ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!caps.cssSupports)
            this._addLog('warn', 'CSS.supports 不可用（jsdom 部分版本缺失），所有检测降级为仅说明');
        if (!caps.startingStyle)
            this._addLog('warn', '@starting-style 不支持（Chrome 117+ / Safari 17.5+ / Firefox 129+，jsdom 不模拟）');
        if (!caps.transitionBehavior)
            this._addLog('warn', 'transition-behavior: allow-discrete 不支持（Chrome 117+）');
        if (!caps.interpolateSize)
            this._addLog('warn', 'interpolate-size: allow-keywords 不支持（Chrome 129+）');
    }
    componentWillUnmount() {
        // 1. 取消所有未执行的 requestAnimationFrame 句柄（polyfill 模拟时注册）
        for (const id of this._rafIds || []) {
            try {
                if (typeof cancelAnimationFrame === 'function')
                    cancelAnimationFrame(id);
            }
            catch { /* noop */ }
        }
        this._rafIds = [];
        // 2. 移除动态注入的 <style> 元素（若存在）
        try {
            if (this._styleEl && this._styleEl.parentNode) {
                this._styleEl.parentNode.removeChild(this._styleEl);
            }
        }
        catch { /* noop */ }
        this._styleEl = null;
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
        const cssSupports = typeof CSS !== 'undefined' && typeof CSS.supports === 'function';
        let startingStyle = false;
        let transitionBehavior = false;
        let interpolateSize = false;
        if (cssSupports) {
            try {
                startingStyle = CSS.supports('@starting-style { div { opacity: 0 } }');
            }
            catch { /* jsdom CSS.supports 不识别 at-rule */ }
            try {
                transitionBehavior = CSS.supports('transition-behavior: allow-discrete');
            }
            catch { /* noop */ }
            try {
                interpolateSize = CSS.supports('interpolate-size: allow-keywords');
            }
            catch { /* noop */ }
        }
        return { cssSupports, startingStyle, transitionBehavior, interpolateSize };
    }
    // =================== Card 1：@starting-style 基础 ===================
    _showStartingStyleCaps() {
        const caps = this._caps();
        this.setState({ startingStyleInfo: '===== @starting-style 能力检测 =====\n\n' +
                `  CSS.supports                                : ${caps.cssSupports ? 'function（可用）' : 'undefined（不可用）'}\n` +
                `  CSS.supports('@starting-style {...}')       : ${caps.startingStyle ? 'true（支持）' : 'false / 不可识别'}\n\n` +
                "语法：@starting-style { <selector> { <declarations> } }\n" +
                "示例：@starting-style { .popover { opacity: 0; transform: scale(0.9); } }\n\n" +
                '用途：定义元素「首次出现时的过渡起点」。当元素从 display:none 进入 display:block 时，浏览器跳过 first frame，' +
                '常规 transition 无法触发；@starting-style 显式提供起点样式，让浏览器从该起点过渡到当前样式。\n\n' +
                '注：jsdom 中 CSS.supports 可能不识别 at-rule 语法（返回 false 或抛错），不代表真实浏览器不支持。' });
        this._addLog('caps', `@starting-style 检测：cssSupports=${caps.cssSupports}, startingStyle=${caps.startingStyle}`);
    }
    _showStartingStyleSyntax() {
        this.setState({ startingStyleInfo: '===== @starting-style 语法 =====\n\n' +
                '/* 方式 1：独立 @starting-style 块 */\n' +
                '.popover {\n' +
                '  opacity: 1;\n' +
                '  transform: scale(1);\n' +
                '  transition: opacity 0.3s, transform 0.3s;\n' +
                '}\n' +
                '@starting-style {\n' +
                '  .popover {\n' +
                '    opacity: 0;\n' +
                '    transform: scale(0.9);\n' +
                '  }\n' +
                '}\n\n' +
                '/* 方式 2：嵌套在规则内（Chrome 117+）*/\n' +
                '.popover {\n' +
                '  opacity: 1;\n' +
                '  transition: opacity 0.3s;\n' +
                '  @starting-style {\n' +
                '    opacity: 0;\n' +
                '  }\n' +
                '}\n\n' +
                '语义：浏览器在元素首次进入 displayed 状态时，从 @starting-style 声明的值过渡到当前规则值。' +
                '若元素本就在文档中（display 一直为 block），@starting-style 不生效（无首次出现）。' });
        this._addLog('syntax', '已展示 @starting-style 语法（独立块 + 嵌套两种写法）');
    }
    _compareWithWithout() {
        const caps = this._caps();
        this.setState({ startingStyleInfo: '===== 无 @starting-style vs 有 @starting-style 对比 =====\n\n' +
                '【无 @starting-style】\n' +
                '  .popover { display: none; opacity: 0; transition: opacity 0.3s; }\n' +
                '  .popover.open { display: block; opacity: 1; }\n' +
                '  现象：classList.add("open") → display: none → block（瞬变，浏览器跳过 first frame）→ opacity 直接 1，无过渡\n' +
                '  原因：display 从 none 切到 block 时，浏览器在第一帧直接渲染终态，transition 找不到起点\n\n' +
                '【有 @starting-style】\n' +
                '  .popover { display: none; opacity: 0; transition: opacity 0.3s; }\n' +
                '  .popover.open {\n' +
                '    display: block; opacity: 1;\n' +
                '    @starting-style { opacity: 0; }\n' +
                '  }\n' +
                '  现象：classList.add("open") → display: block + opacity 从 @starting-style 的 0 过渡到规则的 1\n' +
                '  原因：@starting-style 提供了 opacity 的显式起点，浏览器从 0 过渡到 1\n\n' +
                `当前环境 CSS.supports('@starting-style') = ${caps.startingStyle}（jsdom 不一定识别 at-rule，仅供参考）。` });
        this._addLog('compare', `对比无/有 @starting-style（当前检测 startingStyle=${caps.startingStyle}）`);
    }
    _explainFirstFrame() {
        this.setState({ startingStyleInfo: '===== First Frame 问题详解 =====\n\n' +
                '问题描述：\n' +
                '  当元素从 display:none 切换到 display:block 时，浏览器需要在「第一帧」把元素纳入渲染树。\n' +
                '  常规 transition 需要「上一帧值 → 当前帧值」两个采样点才能插值；但 display:none 的元素\n' +
                '  上一帧不存在，浏览器只能取「切到 block 后的第一帧」作为起点，导致过渡跳过（直接到终态）。\n\n' +
                '历史方案（JS hack）：\n' +
                '  el.style.display = "block";\n' +
                '  requestAnimationFrame(() => {\n' +
                '    requestAnimationFrame(() => {\n' +
                '      el.classList.add("open");  // 双 rAF 强制刷新 first frame\n' +
                '    });\n' +
                '  });\n\n' +
                '现代方案（@starting-style）：\n' +
                '  浏览器原生知道「这是首次出现」，从 @starting-style 声明的值开始过渡，无需 JS。\n' +
                '  适用：popover API、<dialog> showModal、CSS-only 折叠面板、tooltip 显隐。\n\n' +
                '限制：@starting-style 仅解决「进入」过渡；退出过渡（block → none）需配合 transition-behavior: allow-discrete（见 Card 2/4）。' });
        this._addLog('explain', '已展示 first frame 问题与历史/现代方案对比');
    }
    _renderCard1() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '1. @starting-style 基础',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.startingStyle ? 'success' : 'error' }, caps.startingStyle ? '@starting-style ✓' : '@starting-style ✗'), h(Tag, { color: 'primary' }, 'first frame'), h(Tag, { color: 'info' }, 'declarative 进入过渡')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '@starting-style 规则定义元素「起始样式」（首次出现时的过渡起点）。当元素从 display:none 进入 display:block 时，浏览器跳过 first frame，常规 transition 无法触发；@starting-style 显式提供起点，让浏览器从该起点过渡到当前样式。语法：@starting-style { .popover { opacity: 0; transform: scale(0.9); } }。仅解决「进入」过渡，退出需配合 transition-behavior: allow-discrete。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('能力检测', { type: 'primary', size: 'sm', onClick: () => this._showStartingStyleCaps() }), this._btn('展示语法', { size: 'sm', onClick: () => this._showStartingStyleSyntax() }), this._btn('对比无/有', { size: 'sm', onClick: () => this._compareWithWithout() }), this._btn('first frame 问题', { size: 'sm', onClick: () => this._explainFirstFrame() })),
                h('div', { class: 'fs-sm text-secondary' }, '@starting-style 状态 / 语法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.startingStyleInfo || '（点击「能力检测」或「展示语法」）')),
                h(Alert, { type: 'info', message: '@starting-style 是 declarative 的元素首次出现过渡方案', description: '相比 requestAnimationFrame 双 rAF 的 JS hack，@starting-style 让浏览器原生理解「首次出现」语义，从声明的起点过渡到当前样式。Chrome 117+ / Safari 17.5+ / Firefox 129+ 支持。jsdom 不模拟 CSS 渲染，演示仅展示代码片段。' }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 2：transition-behavior: allow-discrete ===================
    _showTransitionBehavior() {
        const caps = this._caps();
        this.setState({ transitionBehaviorInfo: '===== transition-behavior: allow-discrete 语法 =====\n\n' +
                '/* 写法 1：作为 transition 简写的一部分 */\n' +
                '.popover {\n' +
                '  transition: display 0.3s allow-discrete, opacity 0.3s;\n' +
                '}\n\n' +
                '/* 写法 2：独立属性 */\n' +
                '.popover {\n' +
                '  transition: display 0.3s, opacity 0.3s;\n' +
                '  transition-behavior: allow-discrete;\n' +
                '}\n\n' +
                '取值：normal（默认，discrete 属性不参与过渡） | allow-discrete（允许 discrete 属性参与过渡）\n\n' +
                '生效的 discrete 属性：display、visibility（部分浏览器已支持插值）、overlay 等。\n' +
                '语义：display 在过渡期间保持「中间值」（不是瞬变 none↔block），让 opacity/transform 等可插值属性有时间完成过渡。\n' +
                '退出时：display 从 block 过渡到 none 期间，元素仍可被渲染（opacity 从 1 → 0 完成后，display 才真正变 none）。' });
        this._addLog('syntax', `展示 transition-behavior 语法（当前检测 transitionBehavior=${caps.transitionBehavior}）`);
    }
    _compareDefaultVsAllowDiscrete() {
        const caps = this._caps();
        this.setState({ transitionBehaviorInfo: '===== 默认（normal）vs allow-discrete 对比 =====\n\n' +
                '【默认 transition-behavior: normal】\n' +
                '  .popover { display: none; opacity: 0; transition: display 0.3s, opacity 0.3s; }\n' +
                '  .popover.open { display: block; opacity: 1; }\n' +
                '  进入：display 瞬变 none→block（discrete 不过渡），opacity 因 first frame 跳过 → 无过渡\n' +
                '  退出：display 瞬变 block→none（元素立即消失），opacity 无机会过渡 → 无过渡\n\n' +
                '【transition-behavior: allow-discrete】\n' +
                '  .popover { display: none; opacity: 0;\n' +
                '    transition: display 0.3s allow-discrete, opacity 0.3s; }\n' +
                '  .popover.open { display: block; opacity: 1;\n' +
                '    @starting-style { opacity: 0; } }\n' +
                '  进入：display 在 0.3s 内「保持可渲染中间态」+ opacity 从 @starting-style 0 → 1（配合 @starting-style 才有起点）\n' +
                '  退出：display 在 0.3s 内「保持 block 到过渡结束」+ opacity 从 1 → 0，过渡结束后 display 才真正 none\n\n' +
                `当前环境 CSS.supports('transition-behavior: allow-discrete') = ${caps.transitionBehavior}（jsdom 不一定识别，仅供参考）。` });
        this._addLog('compare', `对比默认 vs allow-discrete（当前检测 transitionBehavior=${caps.transitionBehavior}）`);
    }
    _explainDiscrete() {
        this.setState({ transitionBehaviorInfo: '===== Discrete 属性详解 =====\n\n' +
                'CSS 属性插值类型：\n' +
                '  - continuous（连续）：opacity, transform, color, width 等，可在任意值间插值\n' +
                '  - discrete（离散）：display, visibility, position 等，值不连续，默认「瞬变」（直接切换不插值）\n\n' +
                'discrete 属性的过渡语义（allow-discrete 启用后）：\n' +
                '  - 不是「在 0.3s 内从 none 平滑变到 block」（display 无中间态）\n' +
                '  - 而是「在过渡期间保持中间值」——进入时立即变 block（让元素可渲染），退出时保持 block 直到过渡结束才变 none\n' +
                '  - 这样可插值属性（opacity/transform）才有时间完成过渡\n\n' +
                '为什么 display 需要特殊处理：\n' +
                '  display:none 的元素不参与渲染（无 box），其他属性无法过渡；allow-discrete 让退出过渡期间\n' +
                '  display 保持 block，使 opacity/transform 能从 1/100% 过渡到 0/scale(0.9)，结束后才真正移除。\n\n' +
                '与 visibility 的区别：visibility 已可部分插值（visible ↔ hidden 在过渡中点切换），allow-discrete 让 display 拥有类似语义。' });
        this._addLog('explain', '已展示 discrete 属性插值语义');
    }
    _explainEnterExitTransition() {
        this.setState({ transitionBehaviorInfo: '===== 进入 / 退出过渡流程（allow-discrete） =====\n\n' +
                '【进入过渡】（.open 类添加，display: none → block）\n' +
                '  1. 元素 display 切到 block（allow-discrete 让 discrete 立即应用，进入「可渲染」状态）\n' +
                '  2. opacity 从 @starting-style 的 0 过渡到规则的 1（@starting-style 提供起点）\n' +
                '  3. 0.3s 后过渡完成，元素稳定在 opacity: 1\n' +
                '  关键：进入过渡必须配合 @starting-style，否则 opacity 无起点\n\n' +
                '【退出过渡】（.open 类移除，display: block → none）\n' +
                '  1. opacity 从当前 1 过渡到规则的 0（已有上一帧值，无需 @starting-style）\n' +
                '  2. allow-discrete 让 display 保持 block 到 0.3s 过渡结束（discrete 在过渡末尾才应用）\n' +
                '  3. 过渡结束后 display 切到 none，元素真正移除\n' +
                '  关键：退出过渡依赖 allow-discrete，否则 display 瞬变导致 opacity 无机会过渡\n\n' +
                '完整组合（见 Card 4）：@starting-style 处理进入起点，transition-behavior: allow-discrete 处理退出期间的 display 保持。' });
        this._addLog('explain', '已展示进入/退出过渡流程（allow-discrete + @starting-style 协同）');
    }
    _renderCard2() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '2. transition-behavior: allow-discrete',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.transitionBehavior ? 'success' : 'error' }, caps.transitionBehavior ? 'allow-discrete ✓' : 'allow-discrete ✗'), h(Tag, { color: 'primary' }, 'discrete 属性'), h(Tag, { color: 'warning' }, '退出过渡关键')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '默认 display 是 discrete 属性（瞬变，不参与过渡）；transition-behavior: allow-discrete 配合 transition: display 0.3s 让 display 在过渡期间保持中间值。进入：display none→block + opacity 0→1（配合 @starting-style）；退出：display block→none（保持可过渡状态到过渡结束才真正 none）。是退出过渡的关键，与 @starting-style 协同实现完整进入/退出动画。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('展示 transition-behavior', { type: 'primary', size: 'sm', onClick: () => this._showTransitionBehavior() }), this._btn('对比默认 vs allow-discrete', { size: 'sm', onClick: () => this._compareDefaultVsAllowDiscrete() }), this._btn('discrete 属性说明', { size: 'sm', onClick: () => this._explainDiscrete() }), this._btn('进入/退出流程', { size: 'sm', onClick: () => this._explainEnterExitTransition() })),
                h('div', { class: 'fs-sm text-secondary' }, 'transition-behavior 状态：'),
                h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.transitionBehaviorInfo || '（点击「展示 transition-behavior」或「对比默认 vs allow-discrete」）')),
                h(Alert, { type: 'info', message: 'allow-discrete 是退出过渡的关键', description: '退出时若 display 瞬变为 none，opacity/transform 无机会过渡；allow-discrete 让 display 保持 block 到过渡结束才 none，使退出动画可完成。Chrome 117+ 支持。jsdom 不模拟，演示仅展示代码片段。' }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 3：interpolate-size: allow-keywords ===================
    _showInterpolateSize() {
        const caps = this._caps();
        this.setState({ interpolateSizeInfo: '===== interpolate-size: allow-keywords 语法 =====\n\n' +
                '/* 全局开启（推荐放在 :root）*/\n' +
                ':root {\n' +
                '  interpolate-size: allow-keywords;\n' +
                '}\n\n' +
                '/* 折叠面板：无需 JS 测量高度 */\n' +
                '.accordion-content {\n' +
                '  height: 0;\n' +
                '  transition: height 0.3s;\n' +
                '}\n' +
                '.accordion-content.open {\n' +
                '  height: auto;  /* 之前不可插值，allow-keywords 后可 */\n' +
                '}\n\n' +
                '取值：\n' +
                '  - numeric-only（默认）：仅允许数值长度插值（height: 100px → 200px 可，100px → auto 不可）\n' +
                '  - allow-keywords：允许 auto / min-content / max-content / fit-content / stretch 等关键字插值\n\n' +
                '生效的属性：height, width, min-height, min-width, max-height, max-width, block-size, inline-size 等 sizing 属性。\n\n' +
                `当前环境 CSS.supports('interpolate-size: allow-keywords') = ${caps.interpolateSize}（jsdom 不一定识别，仅供参考）。` });
        this._addLog('syntax', `展示 interpolate-size 语法（当前检测 interpolateSize=${caps.interpolateSize}）`);
    }
    _compareFixedVsAuto() {
        this.setState({ interpolateSizeInfo: '===== fixed 长度 vs auto 关键字过渡对比 =====\n\n' +
                '【传统方案：JS 测量高度（fixed 长度）】\n' +
                '  function open(el) {\n' +
                '    el.style.height = el.scrollHeight + "px";  // JS 测量真实高度\n' +
                '    el.addEventListener("transitionend", () => {\n' +
                '      el.style.height = "auto";  // 过渡结束后改回 auto（响应内容变化）\n' +
                '    }, { once: true });\n' +
                '  }\n' +
                '  问题：需 JS 测量；内容变化时高度不自动更新（除非再测）；嵌套折叠面板递归测量复杂\n\n' +
                '【现代方案：interpolate-size: allow-keywords】\n' +
                '  :root { interpolate-size: allow-keywords; }\n' +
                '  .acc { height: 0; transition: height 0.3s; }\n' +
                '  .acc.open { height: auto; }\n' +
                '  优势：纯 CSS，浏览器原生处理 auto 插值；内容变化时自动重算；嵌套面板天然支持\n\n' +
                '插值语义：浏览器在过渡期间用 calc-size(auto) 计算每帧的真实高度（基于内容布局），从 0 平滑过渡到 auto。\n' +
                '兼容性：Chrome 129+ 完整支持；旧浏览器降级为「瞬变」（无过渡但仍可用）。' });
        this._addLog('compare', '对比 fixed 长度 vs auto 关键字过渡方案');
    }
    _showCalcSize() {
        this.setState({ interpolateSizeInfo: '===== calc-size() 函数详解 =====\n\n' +
                'calc-size() 是配合 interpolate-size 的计算函数，可对「关键字尺寸」做算术运算：\n\n' +
                '  /* 基础：取 auto 的尺寸值 */\n' +
                '  height: calc-size(auto);\n' +
                '\n' +
                '  /* 运算：auto 高度 + 10px */\n' +
                '  height: calc-size(auto, size + 10px);\n' +
                '\n' +
                '  /* 嵌套：fit-content 高度减去 padding */\n' +
                '  height: calc-size(fit-content, size - 20px);\n' +
                '\n' +
                '  /* 过渡：从 0 过渡到 auto + 10px */\n' +
                '  .acc { height: 0; transition: height 0.3s; }\n' +
                '  .acc.open { height: calc-size(auto, size + 10px); }\n' +
                '\n' +
                'size 关键字：在 calc-size() 第二个参数中代表「第一个参数（关键字）解析出的具体长度值」。\n' +
                '用途：在 auto 基础上做微调（如多留 10px 内边距）、响应式布局关键字尺寸的过渡。\n\n' +
                '注：calc-size() 与 interpolate-size 同期（Chrome 129+）；旧浏览器不识别该函数会忽略整条声明。' });
        this._addLog('syntax', '已展示 calc-size() 函数用法');
    }
    _showInterpolateSizeSupport() {
        const caps = this._caps();
        this.setState({ interpolateSizeInfo: '===== interpolate-size 浏览器支持 =====\n\n' +
                '浏览器          | 版本       | 支持状态\n' +
                '----------------|------------|------------------\n' +
                'Chrome          | 129+       | 完整支持（allow-keywords + calc-size）\n' +
                'Edge            | 129+       | 完整支持（与 Chrome 同步）\n' +
                'Safari          | 17.4+（部分）/ 待定 | 待完整支持\n' +
                'Firefox         | 待定       | 待支持（截至 2025 年初未完整）\n' +
                'jsdom           | -          | 不模拟（CSS 渲染不可用）\n\n' +
                '特性检测：\n' +
                "  CSS.supports('interpolate-size: allow-keywords')\n" +
                "  CSS.supports('height: calc-size(auto)')\n\n" +
                `当前环境检测结果：interpolateSize = ${caps.interpolateSize}\n\n` +
                '渐进增强：不支持时元素高度瞬变（无过渡但仍可用，accordion 仍可开合），不影响功能；支持时获得平滑过渡。' });
        this._addLog('support', `展示 interpolate-size 浏览器支持表（当前检测=${caps.interpolateSize}）`);
    }
    _renderCard3() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '3. interpolate-size: allow-keywords',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.interpolateSize ? 'success' : 'error' }, caps.interpolateSize ? 'allow-keywords ✓' : 'allow-keywords ✗'), h(Tag, { color: 'primary' }, 'auto 插值'), h(Tag, { color: 'info' }, 'calc-size()')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '传统 height/width: auto 不能插值（只能 fixed 长度）；interpolate-size: allow-keywords 允许 auto/min-content/max-content/fit-content 关键字参与过渡。用法：:root { interpolate-size: allow-keywords; } .acc { height: 0; transition: height 0.3s; } .acc.open { height: auto; }（无需 JS 测量高度）。Chrome 129+；与 calc-size() 协同（calc-size(auto, size + 10px)）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('展示 interpolate-size', { type: 'primary', size: 'sm', onClick: () => this._showInterpolateSize() }), this._btn('对比 fixed vs auto', { size: 'sm', onClick: () => this._compareFixedVsAuto() }), this._btn('展示 calc-size', { size: 'sm', onClick: () => this._showCalcSize() }), this._btn('浏览器支持', { size: 'sm', onClick: () => this._showInterpolateSizeSupport() })),
                h('div', { class: 'fs-sm text-secondary' }, 'interpolate-size 状态：'),
                h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.interpolateSizeInfo || '（点击「展示 interpolate-size」或「对比 fixed vs auto」）')),
                h(Alert, { type: 'info', message: 'interpolate-size 让 auto 关键字可插值，告别 JS 测量高度', description: '配合 calc-size() 可在 auto 基础上做算术微调。Chrome 129+ 完整支持；旧浏览器降级为瞬变（功能仍可用）。jsdom 不模拟，演示仅展示代码片段。' }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 4：display 过渡完整模式 ===================
    _showFullPattern() {
        this.setState({ displayTransitionInfo: '===== display 过渡完整模式（popover / tooltip） =====\n\n' +
                '/* 默认（隐藏）状态 */\n' +
                '.popover {\n' +
                '  display: none;\n' +
                '  opacity: 0;\n' +
                '  transform: scale(0.9);\n' +
                '  transition: display 0.3s allow-discrete,\n' +
                '              opacity 0.3s,\n' +
                '              transform 0.3s;\n' +
                '  @starting-style {\n' +
                '    opacity: 0;\n' +
                '    transform: scale(0.9);\n' +
                '  }\n' +
                '}\n\n' +
                '/* 打开状态 */\n' +
                '.popover.open {\n' +
                '  display: block;\n' +
                '  opacity: 1;\n' +
                '  transform: scale(1);\n' +
                '  @starting-style {\n' +
                '    opacity: 0;\n' +
                '    transform: scale(0.9);\n' +
                '  }\n' +
                '}\n\n' +
                '三要素协同：\n' +
                '  1. transition: display 0.3s allow-discrete —— display 参与 discrete 过渡\n' +
                '  2. .popover 内 @starting-style —— 定义「从隐藏首次进入 .popover 时」的起点（一般用不到，因 display:none 时不渲染）\n' +
                '  3. .popover.open 内 @starting-style —— 定义「从 .popover 进入 .popover.open 时」的起点（opacity:0 → 1，transform:scale(0.9) → scale(1)）\n\n' +
                '注意：.popover.open 内的 @starting-style 是关键，它让进入过渡有起点；.popover 内的 @starting-style 用于「首次挂载」场景（如 SSR 后首次显示）。' });
        this._addLog('pattern', '已展示 display 过渡完整模式（popover 三要素）');
    }
    _explainEnterFlow() {
        this.setState({ displayTransitionInfo: '===== 进入流程（.open 类添加）详解 =====\n\n' +
                '时间线：\n' +
                '  t=0     classList.add("open")\n' +
                '  t=0+    浏览器读取 .popover.open 规则：display: block + opacity: 1 + transform: scale(1)\n' +
                '  t=0+    display 从 none → block（allow-discrete：discrete 立即应用，元素进入渲染树）\n' +
                '  t=0+    opacity 起点 = .popover.open 内 @starting-style 的 0（首次出现的过渡起点）\n' +
                '  t=0+    transform 起点 = .popover.open 内 @starting-style 的 scale(0.9)\n' +
                '  t=0→0.3s  opacity 从 0 → 1 插值，transform 从 scale(0.9) → scale(1) 插值\n' +
                '  t=0.3s  过渡完成，元素稳定在 opacity:1, transform:scale(1)\n\n' +
                '关键点：\n' +
                '  - @starting-style 提供 opacity/transform 的「起点值」，否则 first frame 问题导致跳过过渡\n' +
                '  - allow-discrete 让 display 立即变 block（让元素可渲染），不是「平滑过渡 display 值」\n' +
                '  - 若无 allow-discrete，display 瞬变 block 后，opacity 因 first frame 仍跳过 → 仍需 @starting-style + allow-discrete 双管齐下\n\n' +
                'JS 触发：popoverEl.classList.add("open"); （无需 rAF hack）' });
        this._addLog('explain', '已展示进入流程时间线');
    }
    _explainExitFlow() {
        this.setState({ displayTransitionInfo: '===== 退出流程（.open 类移除）详解 =====\n\n' +
                '时间线：\n' +
                '  t=0     classList.remove("open")\n' +
                '  t=0+    浏览器读取 .popover 规则：display: none + opacity: 0 + transform: scale(0.9)\n' +
                '  t=0+    opacity 当前值 = 1，目标值 = 0（已有上一帧值，无需 @starting-style）\n' +
                '  t=0+    transform 当前值 = scale(1)，目标值 = scale(0.9)\n' +
                '  t=0+    display 目标值 = none，但 allow-discrete 让 display「保持 block 到过渡结束」\n' +
                '  t=0→0.3s  opacity 从 1 → 0 插值，transform 从 scale(1) → scale(0.9) 插值（元素仍可见，display 仍 block）\n' +
                '  t=0.3s  过渡结束，display 才真正切到 none（元素移出渲染树）\n\n' +
                '关键点：\n' +
                '  - 退出过渡不需要 @starting-style（已有上一帧值作为起点）\n' +
                '  - allow-discrete 是退出过渡的关键：让 display 保持 block 到过渡末尾，opacity/transform 才有时间过渡\n' +
                '  - 若无 allow-discrete，display 瞬变 none，元素立即消失，opacity 无机会过渡 → 退出无动画\n\n' +
                'JS 触发：popoverEl.classList.remove("open"); （无需 setTimeout hack）' });
        this._addLog('explain', '已展示退出流程时间线');
    }
    _comparePopoverApi() {
        this.setState({ displayTransitionInfo: '===== 完整模式 vs popover API 原生过渡对比 =====\n\n' +
                '【完整模式（手动 display + 类切换）】\n' +
                '  <div class="popover">...</div>\n' +
                '  button.onclick = () => popover.classList.toggle("open");\n' +
                '  优点：完全可控；可与任意显示逻辑组合；支持 SSR 首次出现\n' +
                '  缺点：需手动管理状态；点击外部关闭需自实现；无 :popover-open 伪类\n\n' +
                '【popover API 原生过渡（HTML attribute + CSS）】\n' +
                '  <button popovertarget="mypopover">Open</button>\n' +
                '  <div id="mypopover" popover>...</div>\n' +
                '  CSS:\n' +
                '    #mypopover {\n' +
                '      opacity: 0; transform: scale(0.9);\n' +
                '      transition: display 0.3s allow-discrete,\n' +
                '                  overlay 0.3s allow-discrete,\n' +
                '                  opacity 0.3s, transform 0.3s;\n' +
                '      @starting-style { opacity: 0; transform: scale(0.9); }\n' +
                '    }\n' +
                '    #mypopover:popover-open {\n' +
                '      opacity: 1; transform: scale(1);\n' +
                '      @starting-style { opacity: 0; transform: scale(0.9); }\n' +
                '    }\n' +
                '  优点：原生 Light Dismiss（点击外部/Esc 关闭）；顶层渲染（top layer）避免 z-index 战争；:popover-open 伪类\n' +
                '  缺点：仅 popover 场景；overlay 需额外 allow-discrete\n\n' +
                '结论：popover 场景优先用 popover API；自定义显隐逻辑用完整模式。两者 CSS 写法几乎一致，仅触发方式不同。' });
        this._addLog('compare', '已对比完整模式 vs popover API 原生过渡');
    }
    _renderCard4() {
        const s = this.state;
        const card = new Card({
            title: '4. display 过渡完整模式',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: 'primary' }, '@starting-style + allow-discrete'), h(Tag, { color: 'warning' }, '进入/退出双过渡'), h(Tag, { color: 'info' }, 'popover 友好')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '完整 popover/tooltip 进入退出过渡组合：.popover 内 transition: display 0.3s allow-discrete + opacity/transform；.popover.open 内 display:block + opacity:1 + transform:scale(1) + @starting-style 提供起点。进入：@starting-style 提供 opacity:0 起点 → opacity:1；退出：display 保持 block 到过渡结束才 none。与 popover API :popover-open 伪类写法几乎一致，仅触发方式不同。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('展示完整模式', { type: 'primary', size: 'sm', onClick: () => this._showFullPattern() }), this._btn('进入流程', { size: 'sm', onClick: () => this._explainEnterFlow() }), this._btn('退出流程', { size: 'sm', onClick: () => this._explainExitFlow() }), this._btn('对比 popover API', { size: 'sm', onClick: () => this._comparePopoverApi() })),
                h('div', { class: 'fs-sm text-secondary' }, '完整模式状态：'),
                h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.displayTransitionInfo || '（点击「展示完整模式」或「进入流程」）')),
                h(Alert, { type: 'info', message: '@starting-style + allow-discrete 是进入/退出双过渡的完整解', description: '进入需 @starting-style 提供起点（first frame）；退出需 allow-discrete 保持 display:block 到过渡结束。二者协同实现纯 CSS 的完整显隐动画，无需 JS rAF hack。' }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 5：与 Web Animations API / View Transitions 协同 ===================
    _showThreeWayCompare() {
        this.setState({ synergyInfo: '===== @starting-style vs Web Animations API vs View Transitions =====\n\n' +
                '维度         | @starting-style            | Web Animations API (WAAPI)  | View Transitions\n' +
                '-------------|----------------------------|-----------------------------|---------------------------\n' +
                '范式         | declarative（CSS）         | imperative（JS）            | declarative + 快照\n' +
                '触发         | 类切换 / 属性变化          | element.animate(keyframes)  | document.startViewTransition()\n' +
                '动画对象     | 单元素显隐                 | 任意元素 / 关键帧           | DOM 切换前后快照\n' +
                '复杂度       | 低（纯 CSS）               | 中（JS 控制关键帧）         | 中（捕获 + 自定义动画）\n' +
                'first frame  | 原生支持（@starting-style）| 需 JS 显式管理              | 快照机制（无此问题）\n' +
                'display 过渡 | 配合 allow-discrete        | 需手动管理 display 时机     | 不适用（快照切换）\n' +
                '性能         | 浏览器原生优化             | 浏览器优化（compositor）    | GPU 合成快照\n' +
                '可中断       | 是（类切换）               | 是（Animation.cancel/finish)| 是（skipTransition）\n' +
                '用例         | popover/tooltip/accordion | 复杂关键帧 / 物理动画       | 路由切换 / 列表重排\n\n' +
                '三者不互斥，可组合使用：@starting-style 处理单元素显隐，WAAPI 处理动态动画，View Transitions 处理整页切换。' });
        this._addLog('compare', '已展示三方案对比表');
    }
    _startingStyleWithWAAPI() {
        this.setState({ synergyInfo: '===== @starting-style + Web Animations API 协同 =====\n\n' +
                '场景：popover 用 @starting-style 进入过渡，但需在进入后追加 WAAPI 关键帧动画（如弹跳效果）。\n\n' +
                'CSS（@starting-style 处理进入过渡）：\n' +
                '  .popover {\n' +
                '    display: none; opacity: 0;\n' +
                '    transition: display 0.3s allow-discrete, opacity 0.3s;\n' +
                '  }\n' +
                '  .popover.open {\n' +
                '    display: block; opacity: 1;\n' +
                '    @starting-style { opacity: 0; }\n' +
                '  }\n\n' +
                'JS（过渡结束后追加 WAAPI 动画）：\n' +
                '  popover.classList.add("open");\n' +
                '  popover.addEventListener("transitionend", () => {\n' +
                '    popover.animate(\n' +
                '      [{ transform: "scale(1)" }, { transform: "scale(1.1)" }, { transform: "scale(1)" }],\n' +
                '      { duration: 300, iterations: 1 }\n' +
                '    );\n' +
                '  }, { once: true });\n\n' +
                '协同要点：\n' +
                '  - @starting-style 负责「显隐过渡」（first frame 问题）\n' +
                '  - WAAPI 负责「动态关键帧」（运行时计算的复杂动画）\n' +
                '  - 用 transitionend 事件衔接，避免动画冲突\n' +
                '  - WAAPI 的 Animation 对象可 cancel/finish，灵活控制' });
        this._addLog('synergy', '已展示 @starting-style + WAAPI 协同');
    }
    _startingStyleWithViewTransitions() {
        this.setState({ synergyInfo: '===== @starting-style + View Transitions 协同 =====\n\n' +
                '场景：路由切换时，用 View Transitions 处理整页快照过渡，同时新页面内的 popover 用 @starting-style 处理首次出现过渡。\n\n' +
                'JS（启动 View Transition）：\n' +
                '  document.startViewTransition(() => {\n' +
                '    // 切换 DOM（如路由变化）\n' +
                '    swapPageContent(newPage);\n' +
                '    // 新页面内的 popover 在 View Transition 后首次出现\n' +
                '    requestAnimationFrame(() => newPopover.classList.add("open"));\n' +
                '  });\n\n' +
                'CSS（View Transitions 快照 + @starting-style 进入过渡）：\n' +
                '  /* View Transitions 默认动画 */\n' +
                '  ::view-transition-old(root),\n' +
                '  ::view-transition-new(root) {\n' +
                '    animation-duration: 0.3s;\n' +
                '  }\n' +
                '  /* 新页面 popover 的进入过渡（@starting-style）*/\n' +
                '  .popover {\n' +
                '    display: none; opacity: 0;\n' +
                '    transition: display 0.3s allow-discrete, opacity 0.3s;\n' +
                '  }\n' +
                '  .popover.open {\n' +
                '    display: block; opacity: 1;\n' +
                '    @starting-style { opacity: 0; }\n' +
                '  }\n\n' +
                '协同要点：\n' +
                '  - View Transitions 处理「DOM 结构变化」的整页过渡（旧页 → 新页快照）\n' +
                '  - @starting-style 处理「新页面内单元素」的首次出现过渡\n' +
                '  - 两者作用域不同：View Transitions 在 top layer（快照），@starting-style 在正常文档流\n' +
                '  - 用 requestAnimationFrame 确保 View Transition 捕获快照后再触发 popover 进入' });
        this._addLog('synergy', '已展示 @starting-style + View Transitions 协同');
    }
    _showDecisionMatrix() {
        this.setState({ synergyInfo: '===== 进入/退出动画方案决策矩阵 =====\n\n' +
                '场景                          | 推荐方案                | 理由\n' +
                '------------------------------|-------------------------|----------------------------------------\n' +
                '单元素显隐（popover/tooltip） | @starting-style         | 纯 CSS，处理 first frame，配合 allow-discrete 退出\n' +
                '折叠面板高度过渡              | interpolate-size        | auto 关键字插值，无需 JS 测量\n' +
                '运行时动态关键帧              | WAAPI                   | element.animate(keyframes) 灵活控制\n' +
                '物理动画（弹簧/惯性）         | WAAPI + easing          | 自定义缓动函数，可中断\n' +
                '路由切换 / 列表重排           | View Transitions        | DOM 结构变化，快照过渡\n' +
                '拖拽排序动画                  | View Transitions / FLIP | 位置变化的平滑过渡\n' +
                '复杂多元素编排                | WAAPI（AnimationGroup） | 时序控制，Promise 衔接\n\n' +
                '决策树：\n' +
                '  1. 是否 DOM 结构变化（增删/位置变）？→ 是：View Transitions\n' +
                '  2. 是否单元素显隐（display 切换）？→ 是：@starting-style + allow-discrete\n' +
                '  3. 是否高度/宽度 auto 过渡？→ 是：interpolate-size: allow-keywords\n' +
                '  4. 是否运行时动态关键帧？→ 是：WAAPI\n' +
                '  5. 组合需求 → 多方案协同（如 @starting-style + WAAPI 追加动画）\n\n' +
                '关键：三者解决不同维度问题，不互斥；优先用 declarative（CSS），复杂场景才上 imperative（WAAPI）。' });
        this._addLog('decision', '已展示进入/退出动画方案决策矩阵');
    }
    _renderCard5() {
        const s = this.state;
        const card = new Card({
            title: '5. 与 Web Animations API / View Transitions 协同',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: 'primary' }, '@starting-style'), h(Tag, { color: 'warning' }, 'WAAPI'), h(Tag, { color: 'info' }, 'View Transitions')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '@starting-style 是「declarative 进入过渡」；Web Animations API 是「imperative 程序化动画」；View Transitions 是「DOM 切换快照过渡」。协同：@starting-style 处理元素显隐；WAAPI 处理复杂关键帧；View Transitions 处理整页切换。决策：单元素进入/退出 → @starting-style；运行时动态动画 → WAAPI；DOM 结构变化 → View Transitions。三者不互斥，可组合使用。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('三方案对比表', { type: 'primary', size: 'sm', onClick: () => this._showThreeWayCompare() }), this._btn('@starting-style + WAAPI', { size: 'sm', onClick: () => this._startingStyleWithWAAPI() }), this._btn('@starting-style + View Transitions', { size: 'sm', onClick: () => this._startingStyleWithViewTransitions() }), this._btn('决策矩阵', { size: 'sm', onClick: () => this._showDecisionMatrix() })),
                h('div', { class: 'fs-sm text-secondary' }, '协同方案：'),
                h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.synergyInfo || '（点击「三方案对比表」或「决策矩阵」）')),
                h(Alert, { type: 'info', message: '三种动画方案解决不同维度问题，可组合使用', description: '@starting-style 处理显隐（declarative），WAAPI 处理动态关键帧（imperative），View Transitions 处理 DOM 切换（快照）。优先 declarative，复杂场景才上 imperative。' }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 6：浏览器支持与 polyfill 策略 ===================
    _showBrowserSupportTable() {
        const caps = this._caps();
        this.setState({ supportInfo: '===== 浏览器支持总表 =====\n\n' +
                '特性                          | Chrome  | Edge    | Safari      | Firefox     | jsdom\n' +
                '------------------------------|---------|---------|-------------|-------------|-------\n' +
                '@starting-style               | 117+    | 117+    | 17.5+       | 129+        | ✗\n' +
                'transition-behavior: allow-discrete | 117+ | 117+ | 17.5+（部分）| 待定        | ✗\n' +
                'interpolate-size: allow-keywords | 129+ | 129+  | 待定        | 待定        | ✗\n' +
                'calc-size()                   | 129+    | 129+    | 待定        | 待定        | ✗\n' +
                'popover API（配合用）         | 114+    | 114+    | 17+         | 待定        | ✗\n\n' +
                '特性检测：\n' +
                `  CSS.supports('@starting-style { div { opacity: 0 } }')  = ${caps.startingStyle}\n` +
                `  CSS.supports('transition-behavior: allow-discrete')     = ${caps.transitionBehavior}\n` +
                `  CSS.supports('interpolate-size: allow-keywords')        = ${caps.interpolateSize}\n\n` +
                '注：Chrome 117 首次支持 @starting-style 与 allow-discrete；Chrome 129 完整支持 interpolate-size 与 calc-size。' +
                'Safari 17.5 部分支持；Firefox 129+ 支持 @starting-style。jsdom 不模拟任何 CSS 渲染特性。' });
        this._addLog('support', `展示浏览器支持表（startingStyle=${caps.startingStyle}, transitionBehavior=${caps.transitionBehavior}, interpolateSize=${caps.interpolateSize}）`);
    }
    _showFallbackStrategy() {
        this.setState({ supportInfo: '===== 降级策略（不支持时） =====\n\n' +
                '核心原则：CSS 过渡是「增强」而非「必需」，不支持时功能仍可用，仅无动画。\n\n' +
                '策略 1：自然降级（推荐）\n' +
                '  不支持 @starting-style：元素进入时 opacity 直接 1（无过渡，但显示正常）\n' +
                '  不支持 allow-discrete：display 瞬变，元素立即显隐（无过渡，但功能正常）\n' +
                '  不支持 interpolate-size：height: 0 ↔ auto 瞬变（accordion 仍可开合，无平滑动画）\n' +
                '  实现：什么都不做，CSS 自动降级（不识别的属性/规则被忽略）\n\n' +
                '策略 2：@supports 条件样式\n' +
                '  @supports (transition-behavior: allow-discrete) {\n' +
                '    /* 仅支持时启用过渡相关样式 */\n' +
                '    .popover { transition: display 0.3s allow-discrete, opacity 0.3s; }\n' +
                '  }\n' +
                '  @supports not (transition-behavior: allow-discrete) {\n' +
                '    /* 不支持时的备选（如简化为 opacity 过渡，display 用 JS 控制）*/\n' +
                '    .popover { transition: opacity 0.3s; }\n' +
                '  }\n\n' +
                '策略 3：渐进增强\n' +
                '  - 基础功能：display: none/block 切换（所有浏览器可用）\n' +
                '  - 增强 1：opacity/transform 过渡（支持 allow-discrete 的浏览器获得完整动画）\n' +
                '  - 增强 2：interpolate-size 让 accordion 平滑开合（Chrome 129+）\n' +
                '  - 检测：@supports 或 CSS.supports() 动态判断' });
        this._addLog('fallback', '已展示降级策略（自然降级 + @supports + 渐进增强）');
    }
    _showJSPolyfill() {
        this.setState({ supportInfo: '===== JS 模拟 polyfill（requestAnimationFrame 双 rAF） =====\n\n' +
                '为何无法完美 polyfill：\n' +
                '  - @starting-style 依赖浏览器渲染时机的内部钩子（first frame 检测）\n' +
                '  - allow-discrete 依赖浏览器对 discrete 属性过渡的内部处理\n' +
                '  - 这些是浏览器引擎层能力，JS 无法精确模拟，只能近似\n\n' +
                '近似 polyfill（双 rAF 强制刷新 first frame）：\n' +
                '  function showWithTransition(el) {\n' +
                '    el.style.display = "block";\n' +
                '    // 双 rAF：第一帧让浏览器把 display:block 纳入渲染树，第二帧才添加 .open 触发过渡\n' +
                '    requestAnimationFrame(() => {\n' +
                '      requestAnimationFrame(() => {\n' +
                '        el.classList.add("open");\n' +
                '      });\n' +
                '    });\n' +
                '  }\n' +
                '  function hideWithTransition(el) {\n' +
                '    el.classList.remove("open");\n' +
                '    // 退出过渡：监听 transitionend 后再设 display:none\n' +
                '    el.addEventListener("transitionend", function handler() {\n' +
                '      el.removeEventListener("transitionend", handler);\n' +
                '      el.style.display = "none";\n' +
                '    });\n' +
                '  }\n\n' +
                'polyfill 局限：\n' +
                '  - 双 rAF 时机不完美（某些场景需单 rAF + getComputedStyle 强制 reflow）\n' +
                '  - 退出 transitionend 可能因多个属性触发多次，需去重\n' +
                '  - 不支持嵌套 @starting-style（首次挂载场景）\n' +
                '  - 性能不如原生（多次 reflow）\n\n' +
                '推荐：仅在必须支持旧浏览器时使用 polyfill；现代浏览器用原生 @starting-style 更优。' });
        this._addLog('polyfill', '已展示 JS 模拟 polyfill（双 rAF + transitionend）');
    }
    _showSupportsProgressive() {
        const caps = this._caps();
        this.setState({ supportInfo: '===== @supports 渐进增强实战 =====\n\n' +
                'CSS 内联检测（推荐）：\n' +
                '  /* 基础样式（所有浏览器）*/\n' +
                '  .popover {\n' +
                '    display: none;\n' +
                '    opacity: 0;\n' +
                '  }\n' +
                '  .popover.open {\n' +
                '    display: block;\n' +
                '    opacity: 1;\n' +
                '  }\n\n' +
                '  /* 支持时增强（@starting-style + allow-discrete）*/\n' +
                '  @supports (transition-behavior: allow-discrete) {\n' +
                '    .popover {\n' +
                '      transition: display 0.3s allow-discrete, opacity 0.3s, transform 0.3s;\n' +
                '      transform: scale(0.9);\n' +
                '    }\n' +
                '    .popover.open {\n' +
                '      transform: scale(1);\n' +
                '      @starting-style {\n' +
                '        opacity: 0;\n' +
                '        transform: scale(0.9);\n' +
                '      }\n' +
                '    }\n' +
                '  }\n\n' +
                '  /* 支持 interpolate-size 时进一步增强 accordion */\n' +
                '  @supports (interpolate-size: allow-keywords) {\n' +
                '    :root { interpolate-size: allow-keywords; }\n' +
                '    .accordion { transition: height 0.3s; }\n' +
                '    .accordion.open { height: auto; }\n' +
                '  }\n\n' +
                'JS 动态检测（用于条件逻辑）：\n' +
                '  if (CSS.supports("transition-behavior: allow-discrete")) {\n' +
                '    el.classList.add("open");  // 原生过渡\n' +
                '  } else {\n' +
                '    showWithTransitionPolyfill(el);  // 双 rAF polyfill\n' +
                '  }\n\n' +
                `当前环境检测结果（仅供参考）：\n` +
                `  @starting-style      : ${caps.startingStyle}\n` +
                `  transition-behavior  : ${caps.transitionBehavior}\n` +
                `  interpolate-size     : ${caps.interpolateSize}\n\n` +
                '结论：渐进增强让代码在所有浏览器可用，支持时获得最佳体验。优先 @supports（CSS 内联），JS 检测用于条件逻辑。' });
        this._addLog('progressive', '已展示 @supports 渐进增强实战');
    }
    _renderCard6() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '6. 浏览器支持与 polyfill 策略',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.startingStyle ? 'success' : 'error' }, caps.startingStyle ? '@starting-style ✓' : '@starting-style ✗'), h(Tag, { color: caps.transitionBehavior ? 'success' : 'error' }, caps.transitionBehavior ? 'allow-discrete ✓' : 'allow-discrete ✗'), h(Tag, { color: caps.interpolateSize ? 'success' : 'error' }, caps.interpolateSize ? 'interpolate-size ✓' : 'interpolate-size ✗'), h(Tag, { color: 'primary' }, 'polyfill')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '@starting-style（Chrome 117+ / Safari 17.5+ / Firefox 129+）、transition-behavior（Chrome 117+）、interpolate-size（Chrome 129+）。polyfill：无法完美 polyfill（依赖浏览器渲染时机）；降级策略：不支持时元素立即显隐（无过渡，仍可用）；JS 模拟（requestAnimationFrame + class toggle 模拟 first frame）；@supports 渐进增强。检测：CSS.supports(\'@starting-style {...}\') / CSS.supports(\'transition-behavior: allow-discrete\') / CSS.supports(\'interpolate-size: allow-keywords\')。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('浏览器支持表', { type: 'primary', size: 'sm', onClick: () => this._showBrowserSupportTable() }), this._btn('降级策略', { size: 'sm', onClick: () => this._showFallbackStrategy() }), this._btn('JS 模拟 polyfill', { size: 'sm', onClick: () => this._showJSPolyfill() }), this._btn('@supports 渐进增强', { size: 'sm', onClick: () => this._showSupportsProgressive() })),
                h('div', { class: 'fs-sm text-secondary' }, '支持与 polyfill 策略：'),
                h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.supportInfo || '（点击「浏览器支持表」或「降级策略」）')),
                h(Alert, { type: 'warning', message: 'CSS 过渡新特性无法完美 polyfill，依赖渐进增强', description: '不支持时功能仍可用（无动画）；@supports 条件加载增强样式；JS 双 rAF 仅作近似 polyfill。优先用原生特性，旧浏览器自然降级。jsdom 不模拟，演示仅展示代码片段。' }),
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
        return h('div', { class: 'api-lab-page css-starting-style-page' }, h('h2', { class: 'section-title' }, 'CSS @starting-style 与过渡实验室'), h('p', { class: 'fs-sm text-secondary mb-md' }, '本页演示 CSS @starting-style（元素首次出现过渡）、transition-behavior: allow-discrete（discrete 属性过渡）、interpolate-size: allow-keywords（auto 关键字插值）、display 过渡完整模式、与 Web Animations API / View Transitions 协同，以及浏览器支持与 polyfill 策略。jsdom 中 CSS 渲染不可用，所有演示通过 CSS 代码片段说明。'), s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderLogPanel());
    }
}
//# sourceMappingURL=CSSStartingStylePage.js.map