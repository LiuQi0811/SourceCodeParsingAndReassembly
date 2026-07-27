// =====================================================================
// CSSTextAdvancedPage.js —— CSS Text Module Level 4 高级排版 实验室
// 演示 MDN CSS Text Module Level 4 / CSS Text Level 3 高级排版特性
//   （不与 ModernCSSPage / CSSScrollLayoutPage 重复：ModernCSSPage 仅在特性矩阵
//    检测 text-wrap: balance 支持但不深入文本属性，本页深入 CSS Text L4 全家桶）：
//   1. text-wrap 文本换行 —— wrap|nowrap|balance|pretty|stable，text-wrap-mode /
//      text-wrap-style 拆分长写属性；balance 限制约 6-8 行，pretty 异步渐进
//   2. text-spacing-trim 与 text-autospace —— CJK 标点挤压（避免句号顶头）、
//      中英文混排自动加空格；CJK 排版关键但浏览器采纳慢
//   3. hanging-punctuation 与 hyphens —— 标点悬挂到行首/行尾外，hyphens:auto
//      连字符断字 + hyphenate-character / hyphenate-limit-chars
//   4. text-box 与行高控制 —— text-box 简写 / text-box-trim / text-box-edge，
//      去除首末行半行距（half-leading），按钮文字精确居中
//   5. white-space-collapse 与换行控制 —— white-space-collapse / text-space-collapse /
//      white-space 简写 / word-break / overflow-wrap / line-break / letter-spacing
//   6. 文本选择与排版组合 —— user-select / ::selection / accent-color / caret-color /
//      field-sizing / text-align[-last] / text-justify / text-indent / tab-size /
//      unicode-bidi / writing-mode / direction
// 说明：所有特性调用前做 typeof / CSS.supports 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。jsdom 不做真实 CSS 渲染，
//       CSS.supports 通常可用；text-spacing-trim / text-autospace / text-box /
//       text-wrap-style 等较新属性 jsdom 可能不识别，统一 try/catch 兜底。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class CSSTextAdvancedPage extends Page {
    _inited = false;
    _dynamicStyles = [];
    _textWrapMode = '';
    _trimOn = false;
    _autospaceOn = false;
    _hangingOn = false;
    _hyphensOn = false;
    _textBoxOn = false;
    _breakMode = '';
    // —— 初始 state ——
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            // Card 1：text-wrap 文本换行
            textWrapInfo: '',
            // Card 2：text-spacing-trim 与 text-autospace
            textSpacingInfo: '',
            // Card 3：hanging-punctuation 与 hyphens
            hangingHyphensInfo: '',
            // Card 4：text-box 与行高控制
            textBoxInfo: '',
            // Card 5：white-space-collapse 与换行控制
            whiteSpaceCollapseInfo: '',
            // Card 6：文本选择与排版组合
            selectionComboInfo: '',
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
        this._textWrapMode = 'wrap'; // Card 1 当前 text-wrap 值
        this._trimOn = false; // Card 2 text-spacing-trim 是否开启
        this._autospaceOn = false; // Card 2 text-autospace 是否开启
        this._hangingOn = false; // Card 3 hanging-punctuation 是否开启
        this._hyphensOn = false; // Card 3 hyphens 是否开启
        this._textBoxOn = false; // Card 4 text-box 是否开启
        this._breakMode = 'normal'; // Card 5 当前换行模式
        // 一次性能力检测：CSS Text Module Level 4 全家桶
        const f = this._flags();
        const c = (ok) => ok ? '✓' : '✗';
        const parts = [
            `CSS ${c(f.css)}`, `supports ${c(f.supports)}`,
            `text-wrap ${c(f.textWrap)}`, `text-wrap-mode ${c(f.textWrapMode)}`,
            `text-wrap-style ${c(f.textWrapStyle)}`,
            `text-spacing-trim ${c(f.textSpacingTrim)}`, `text-autospace ${c(f.textAutospace)}`,
            `hanging-punctuation ${c(f.hangingPunctuation)}`, `hyphens ${c(f.hyphens)}`,
            `hyphenate-character ${c(f.hyphenateCharacter)}`, `hyphenate-limit-chars ${c(f.hyphenateLimitChars)}`,
            `text-box ${c(f.textBox)}`, `text-box-trim ${c(f.textBoxTrim)}`, `text-box-edge ${c(f.textBoxEdge)}`,
            `leading-trim ${c(f.leadingTrim)}`,
            `white-space-collapse ${c(f.whiteSpaceCollapse)}`, `text-space-collapse ${c(f.textSpaceCollapse)}`,
            `word-break ${c(f.wordBreak)}`, `overflow-wrap ${c(f.overflowWrap)}`, `line-break ${c(f.lineBreak)}`,
            `user-select ${c(f.userSelect)}`, `accent-color ${c(f.accentColor)}`, `caret-color ${c(f.caretColor)}`,
            `field-sizing ${c(f.fieldSizing)}`, `text-justify ${c(f.textJustify)}`,
            `text-indent ${c(f.textIndent)}`, `tab-size ${c(f.tabSize)}`,
            `unicode-bidi ${c(f.unicodeBidi)}`, `writing-mode ${c(f.writingMode)}`,
        ];
        const summary = f.css
            ? `CSS Text Module Level 4 特性能力检测：${parts.join(' · ')}。jsdom 不做真实 CSS 渲染，但 CSS.supports 通常可用；text-spacing-trim / text-autospace / text-box / text-wrap-style / hyphenate-limit-chars 等较新特性 jsdom 可能不识别，按钮将仅记日志说明。在真实浏览器中打开可完整演示。`
            : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。';
        this.setState({ capsSummary: summary });
        this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!f.textWrap)
            this._addLog('warn', 'text-wrap:balance 不可用或 jsdom 未识别（Chrome 114+ balance / Chrome 117+ pretty / stable）');
        if (!f.textSpacingTrim)
            this._addLog('warn', 'text-spacing-trim 不可用或 jsdom 未识别（CJK 标点挤压，Chrome 128+ 部分支持）');
        if (!f.textAutospace)
            this._addLog('warn', 'text-autospace 不可用或 jsdom 未识别（中英自动加空格，采纳缓慢）');
        if (!f.textBox)
            this._addLog('warn', 'text-box:trim-both cap 不可用或 jsdom 未识别（Chrome 129+ 部分支持）');
        if (!f.hangingPunctuation)
            this._addLog('warn', 'hanging-punctuation 不可用或 jsdom 未识别（Safari 已支持，Chrome/Firefox 仍实验性）');
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
            // Card 1
            textWrap: supportsPV('text-wrap', 'balance'),
            textWrapMode: supportsPV('text-wrap-mode', 'wrap'),
            textWrapStyle: supportsPV('text-wrap-style', 'balance'),
            // Card 2
            textSpacingTrim: supportsPV('text-spacing-trim', 'trim-start'),
            textAutospace: supportsPV('text-autospace', 'ideograph-alpha'),
            // Card 3
            hangingPunctuation: supportsPV('hanging-punctuation', 'first'),
            hyphens: supportsPV('hyphens', 'auto'),
            hyphenateCharacter: supportsPV('hyphenate-character', '-'),
            hyphenateLimitChars: supportsPV('hyphenate-limit-chars', '6 3 6'),
            // Card 4
            textBox: supportsPV('text-box', 'trim-both cap'),
            textBoxTrim: supportsPV('text-box-trim', 'trim-both'),
            textBoxEdge: supportsPV('text-box-edge', 'cap'),
            leadingTrim: supportsPV('leading-trim', 'both'),
            // Card 5
            whiteSpaceCollapse: supportsPV('white-space-collapse', 'preserve-spaces'),
            textSpaceCollapse: supportsPV('text-space-collapse', 'preserve-spaces'),
            wordBreak: supportsPV('word-break', 'break-all'),
            overflowWrap: supportsPV('overflow-wrap', 'anywhere'),
            lineBreak: supportsPV('line-break', 'strict'),
            // Card 6
            userSelect: supportsPV('user-select', 'contain'),
            accentColor: supportsPV('accent-color', 'red'),
            caretColor: supportsPV('caret-color', 'red'),
            fieldSizing: supportsPV('field-sizing', 'content'),
            textJustify: supportsPV('text-justify', 'inter-character'),
            textIndent: supportsPV('text-indent', '2em'),
            tabSize: supportsPV('tab-size', '4'),
            unicodeBidi: supportsPV('unicode-bidi', 'isolate'),
            writingMode: supportsPV('writing-mode', 'vertical-rl'),
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
        this._injectStyle('css-text-l4-demo', `
      /* ===== Card 1: text-wrap ===== */
      .text-wrap-stage { max-width: 360px; padding: 8px 12px; border-left: 3px solid var(--color-border, #ccc);
        background: var(--color-bg-spotlight, #f5f5f5); border-radius: 4px; margin-top: 8px; font-size: 14px;
        line-height: 1.6; }
      .text-wrap-stage h4 { margin: 0 0 6px 0; font-size: 18px; font-weight: 700; }
      /* ===== Card 2: text-spacing-trim / text-autospace ===== */
      .text-spacing-cn { max-width: 360px; padding: 8px 12px; border: 1px solid var(--color-border, #ccc);
        border-radius: 4px; margin-top: 8px; font-size: 14px; line-height: 1.8; }
      .text-spacing-mix { max-width: 360px; padding: 8px 12px; border: 1px dashed var(--color-border, #ccc);
        border-radius: 4px; margin-top: 8px; font-size: 14px; line-height: 1.8; }
      /* ===== Card 3: hanging-punctuation / hyphens ===== */
      .hang-punct-stage { max-width: 360px; padding: 8px 12px; border-left: 3px solid var(--color-primary, #1677ff);
        background: var(--color-primary-bg, #e6f0ff); border-radius: 4px; margin-top: 8px; font-size: 14px;
        line-height: 1.8; text-align: justify; }
      .hyphens-stage { max-width: 360px; padding: 8px 12px; border-left: 3px solid var(--color-success, #10b981);
        background: var(--color-success-bg, #e6f9ee); border-radius: 4px; margin-top: 8px; font-size: 14px;
        line-height: 1.8; }
      /* ===== Card 4: text-box ===== */
      .text-box-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; margin-top: 8px; }
      .text-box-btn { display: inline-flex; align-items: center; justify-content: center; height: 56px;
        padding: 0 20px; border: 2px solid var(--color-primary, #1677ff); background: var(--color-primary, #1677ff);
        color: #fff; border-radius: 8px; font-size: 16px; font-weight: 600; }
      .text-box-box { width: 90px; height: 56px; border: 1px dashed var(--color-border, #ccc);
        display: inline-flex; align-items: center; justify-content: center; }
      /* ===== Card 5: white-space-collapse / word-break ===== */
      .ws-collapse-url { width: 180px; border: 1px dashed var(--color-border, #ccc); padding: 6px;
        margin: 4px 4px 0 0; display: inline-block; vertical-align: top; font-size: 13px; word-break: normal; }
      .ws-collapse-cjk { max-width: 280px; border: 1px solid var(--color-border, #ccc); padding: 6px 8px;
        margin-top: 8px; font-size: 14px; line-height: 1.8; }
      /* ===== Card 6: selection / writing-mode / field-sizing ===== */
      .wm-vertical { writing-mode: vertical-rl; text-orientation: mixed; max-height: 160px;
        padding: 8px; border: 1px solid var(--color-border, #ccc); border-radius: 4px; margin-top: 8px;
        background: var(--color-bg-spotlight, #f5f5f5); }
      .fs-textarea { width: 100%; padding: 8px; border: 1px solid var(--color-border, #ccc);
        border-radius: 4px; font-size: 13px; field-sizing: content; min-height: 40px; }
      .sel-demo { padding: 8px 12px; border: 1px solid var(--color-border, #ccc); border-radius: 4px;
        margin-top: 8px; font-size: 14px; }
      .sel-demo ::selection { background: #1677ff; color: #fff; }
    `);
    }
    // =================== Card 1：text-wrap 文本换行 ===================
    _readTextWrapInfo() {
        const f = this._flags();
        try {
            const stage = this.el && this.el.querySelector('.text-wrap-stage h4');
            let computed = '(未渲染)';
            if (stage) {
                computed = window.getComputedStyle(stage).getPropertyValue('text-wrap') || '(空)';
            }
            return `text-wrap 文本换行演示：\n` +
                `  当前 .text-wrap-stage h4 { text-wrap: ${this._textWrapMode}; }\n` +
                `  text-wrap 计算值="${computed}"\n` +
                `  CSS.supports('text-wrap','balance') = ${f.textWrap}\n` +
                `  text-wrap-mode 支持 = ${f.textWrapMode}（wrap|nowrap 长写）\n` +
                `  text-wrap-style 支持 = ${f.textWrapStyle}（natural|balance|pretty|stable 长写）\n\n` +
                '说明：\n' +
                '  text-wrap: wrap（默认，溢出断行）| nowrap（不换行）| balance（平衡换行）| pretty（避免孤行）| stable（contenteditable 稳定）\n' +
                '    balance：浏览器选择最优断点，使最后一行不过短；适合标题；限制约 6-8 行（性能）\n' +
                '    pretty：避免 orphans/widows（孤行/寡行）；异步渐进处理；适合正文段落\n' +
                '    stable：用于 contenteditable，光标在底部输入时不重排上方已有行\n' +
                '  新拆分：text-wrap-mode: wrap|nowrap 控制是否换行；text-wrap-style: natural|balance|pretty|stable 控制算法\n' +
                '    white-space 简写 = text-space-collapse + text-wrap-mode（见 Card 5）';
        }
        catch (err) {
            return `读取 text-wrap 信息失败：${err.name} - ${err.message}`;
        }
    }
    _setTextWrap(mode) {
        this._textWrapMode = mode;
        this._injectStyle('css-text-wrap-mode', `.text-wrap-stage h4 { text-wrap: ${mode}; }`);
        this.setState({ textWrapInfo: this._readTextWrapInfo() });
        const desc = { wrap: '默认溢出断行', nowrap: '不换行', balance: '平衡换行（限 ~6-8 行）', pretty: '避免孤行（异步渐进）', stable: 'contenteditable 稳定' }[mode];
        this._addLog('textwrap', `切换 text-wrap → ${mode}（${desc}）`);
    }
    _runTextWrapDemo() {
        this.setState({ textWrapInfo: this._readTextWrapInfo() });
        this._addLog('textwrap', `text-wrap 演示：当前=${this._textWrapMode}，支持=${this._flags().textWrap}`);
    }
    _renderCard1() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '1. text-wrap 文本换行',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['text-wrap', f.textWrap], ['text-wrap-mode', f.textWrapMode], ['text-wrap-style', f.textWrapStyle]]), h(Tag, { color: 'primary' }, 'balance / pretty / stable')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'text-wrap 控制换行算法：wrap 默认溢出断行、nowrap 不换行、balance 平衡换行（浏览器选最优断点使最后一行不过短，适合标题，限约 6-8 行）、pretty 避免孤行（orphans/widows，异步渐进，适合正文）、stable 用于 contenteditable（光标在底部输入时不重排上方行）。新拆分 text-wrap-mode（wrap|nowrap）+ text-wrap-style（natural|balance|pretty|stable）两个长写属性。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runTextWrapDemo() }), this._btn('wrap', { size: 'sm', disabled: !f.textWrap, onClick: () => this._setTextWrap('wrap') }), this._btn('balance', { size: 'sm', disabled: !f.textWrap, onClick: () => this._setTextWrap('balance') }), this._btn('pretty', { size: 'sm', disabled: !f.textWrap, onClick: () => this._setTextWrap('pretty') })),
                h('div', { class: 'text-wrap-stage' }, h('h4', {}, 'CSS Text Module Level 4 文本换行演示标题（balance 让多行标题更平衡）'), h('div', {}, '当前 text-wrap = ' + this._textWrapMode + '。balance 限制约 6-8 行（性能）；pretty 异步渐进处理避免孤行；stable 用于 contenteditable。')),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '260px', overflow: 'auto' } }, h('code', {}, s.textWrapInfo || '（点击「读取信息」或切换 text-wrap 模式）')),
                h(Alert, {
                    type: 'info',
                    message: 'balance 适合标题，pretty 适合正文',
                    description: 'balance 因性能限制仅对约 6-8 行生效，过长文本回退到 wrap；pretty 是异步渐进算法，可能稍慢但避免孤行/寡行；stable 保证 contenteditable 中光标处输入不重排上方已存在行。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 2：text-spacing-trim 与 text-autospace ===================
    _readTextSpacingInfo() {
        const f = this._flags();
        try {
            const cn = this.el && this.el.querySelector('.text-spacing-cn');
            const mix = this.el && this.el.querySelector('.text-spacing-mix');
            const readComp = (el, prop) => {
                if (!el)
                    return '(未渲染)';
                return window.getComputedStyle(el).getPropertyValue(prop) || '(空)';
            };
            return `text-spacing-trim 与 text-autospace 演示：\n` +
                `  .text-spacing-cn { text-spacing-trim: ${this._trimOn ? 'normal' : 'space-first'} }\n` +
                `    text-spacing-trim 计算值="${readComp(cn, 'text-spacing-trim')}"\n` +
                `  .text-spacing-mix { text-autospace: ${this._autospaceOn ? 'ideograph-alpha ideograph-numeric' : 'no-autospace'} }\n` +
                `    text-autospace 计算值="${readComp(mix, 'text-autospace')}"\n` +
                `  CSS.supports('text-spacing-trim','trim-start') = ${f.textSpacingTrim}\n` +
                `  CSS.supports('text-autospace','ideograph-alpha') = ${f.textAutospace}\n\n` +
                '说明：\n' +
                '  text-spacing-trim: normal|trim-start|space-start|trim-end|space-end|trim-adjacent|space-adjacent|\n' +
                '                    no-compress|ideograph-numeric|ideograph-alpha|punctuation\n' +
                '    —— 全角标点挤压：去除句号/逗号等行首行尾全角空白（避免句号顶头），\n' +
                '      合并连续标点间距；CJK 排版关键属性（中文/日文/韩文）\n' +
                '  text-autospace: normal|no-autospace|ideograph-alpha|ideograph-numeric|<custom>\n' +
                '    —— CJK 与拉丁字母/数字之间自动插入空格（中英文混排自动加空格）\n' +
                '      ideograph-alpha：CJK 与拉丁字母间加空格\n' +
                '      ideograph-numeric：CJK 与数字间加空格\n\n' +
                '采纳现状：均为 CJK 排版关键但浏览器采纳缓慢（Chrome 128+ 部分支持 text-spacing-trim；\n' +
                '  text-autospace 采纳更慢），生产可用 JS 兜底（如 pangu.js）。';
        }
        catch (err) {
            return `读取 text-spacing 信息失败：${err.name} - ${err.message}`;
        }
    }
    _toggleTrim() {
        this._trimOn = !this._trimOn;
        const val = this._trimOn ? 'space-first trim-adjacent' : 'normal';
        this._injectStyle('css-text-spacing-trim', `.text-spacing-cn { text-spacing-trim: ${val}; }`);
        this.setState({ textSpacingInfo: this._readTextSpacingInfo() });
        this._addLog('spacing', `切换 text-spacing-trim → ${val}（${this._trimOn ? '挤压全角标点空白' : '默认不挤压'}）`);
    }
    _toggleAutospace() {
        this._autospaceOn = !this._autospaceOn;
        const val = this._autospaceOn ? 'ideograph-alpha ideograph-numeric' : 'no-autospace';
        this._injectStyle('css-text-autospace', `.text-spacing-mix { text-autospace: ${val}; }`);
        this.setState({ textSpacingInfo: this._readTextSpacingInfo() });
        this._addLog('spacing', `切换 text-autospace → ${val}（${this._autospaceOn ? 'CJK 与拉丁/数字间加空格' : '不加空格'}）`);
    }
    _renderCard2() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '2. text-spacing-trim 与 text-autospace',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['text-spacing-trim', f.textSpacingTrim], ['text-autospace', f.textAutospace]]), h(Tag, { color: 'primary' }, 'CJK 排版')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'text-spacing-trim 是 CJK 全角标点挤压属性：trim-start 去除行首全角标点空白（避免句号顶头），trim-end 去除行尾，trim-adjacent 合并连续标点间距。text-autospace 在 CJK 与拉丁字母/数字间自动插入空格（中英文混排自动加空格）：ideograph-alpha（CJK↔拉丁）、ideograph-numeric（CJK↔数字）。两者均为 CJK 排版关键属性但浏览器采纳缓慢，生产可用 JS 库（如 pangu.js）兜底。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn(`text-spacing-trim（${this._trimOn ? '开启挤压' : '默认'}）`, { type: 'primary', size: 'sm', disabled: !f.textSpacingTrim, onClick: () => this._toggleTrim() }), this._btn(`text-autospace（${this._autospaceOn ? '加空格' : '不加'}）`, { size: 'sm', disabled: !f.textAutospace, onClick: () => this._toggleAutospace() })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '中文段落（含全角标点，句号顶头问题）：'),
                h('div', { class: 'text-spacing-cn' }, '前端技术日新月异。CSS Text Module Level 4 引入了 text-spacing-trim 属性，用于控制 CJK 栫点。开启后，行首句号不再顶头，连续标点间距被合并。这是中文排版的关键属性。'),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '中英文混排（CJK 与拉丁/数字间）：'),
                h('div', { class: 'text-spacing-mix' }, '使用React 18与TypeScript 5构建应用，CSS Text L4的text-autospace会在中文与English 123之间自动加空格，避免挤在一起。'),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '260px', overflow: 'auto' } }, h('code', {}, s.textSpacingInfo || '（点击按钮切换 text-spacing-trim / text-autospace）')),
                h(Alert, {
                    type: 'warning',
                    message: 'CJK 排版关键属性，但浏览器采纳缓慢',
                    description: 'text-spacing-trim Chrome 128+ 部分支持；text-autospace 采纳更慢。生产环境建议用 pangu.js 等 JS 库兜底处理中英文之间空格。Safari 对部分 CJK 排版属性支持较早。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 3：hanging-punctuation 与 hyphens ===================
    _readHangHyphensInfo() {
        const f = this._flags();
        try {
            const hang = this.el && this.el.querySelector('.hang-punct-stage');
            const hyp = this.el && this.el.querySelector('.hyphens-stage');
            const readComp = (el, prop) => {
                if (!el)
                    return '(未渲染)';
                return window.getComputedStyle(el).getPropertyValue(prop) || '(空)';
            };
            return `hanging-punctuation 与 hyphens 演示：\n` +
                `  .hang-punct-stage { hanging-punctuation: ${this._hangingOn ? 'first last' : 'none'} }\n` +
                `    hanging-punctuation 计算值="${readComp(hang, 'hanging-punctuation')}"\n` +
                `  .hyphens-stage { hyphens: ${this._hyphensOn ? 'auto' : 'manual'}; lang="en" }\n` +
                `    hyphens 计算值="${readComp(hyp, 'hyphens')}"\n` +
                `    hyphenate-character 支持 = ${f.hyphenateCharacter}\n` +
                `    hyphenate-limit-chars 支持 = ${f.hyphenateLimitChars}\n` +
                `  CSS.supports('hanging-punctuation','first') = ${f.hangingPunctuation}\n` +
                `  CSS.supports('hyphens','auto') = ${f.hyphens}\n\n` +
                '说明：\n' +
                '  hanging-punctuation: none|first|last|force-end|allow-end —— 标点悬挂到文本框外\n' +
                '    first：行首标点悬挂到左边距外（如引号「"」不被挤到行内）\n' +
                '    last：行尾标点悬挂到右边距外\n' +
                '    force-end / allow-end：行尾换行处标点悬挂（force 强制，allow 仅在溢出时）\n' +
                '    影响文本对齐：让标点挂在文本框外，使正文边缘更整齐\n' +
                '  hyphens: none|manual|auto —— 连字符断字\n' +
                '    none：不断字；manual：仅在 &shy; 处断字；auto：自动断字（需 lang 属性 + 词典）\n' +
                '    auto 要求元素 lang="en"（或对应语言），浏览器按对应语言词典断字\n' +
                '  hyphenate-character: \'-\'|\'‐\'|<string> —— 自定义连字符字符\n' +
                '  hyphenate-limit-chars: [before] [after] [word-length] —— 断字最小字符数\n' +
                '    before/after：断字处前后最少字符；word-length：可断字的最小单词长度';
        }
        catch (err) {
            return `读取 hanging-punctuation/hyphens 信息失败：${err.name} - ${err.message}`;
        }
    }
    _toggleHanging() {
        this._hangingOn = !this._hangingOn;
        const val = this._hangingOn ? 'first last' : 'none';
        this._injectStyle('css-hang-punct', `.hang-punct-stage { hanging-punctuation: ${val}; }`);
        this.setState({ hangingHyphensInfo: this._readHangHyphensInfo() });
        this._addLog('hang', `切换 hanging-punctuation → ${val}（${this._hangingOn ? '首尾标点悬挂到外' : '不悬挂'}）`);
    }
    _toggleHyphens() {
        this._hyphensOn = !this._hyphensOn;
        const val = this._hyphensOn ? 'auto' : 'manual';
        this._injectStyle('css-hyphens', `.hyphens-stage { hyphens: ${val}; -webkit-hyphens: ${val}; }`);
        this.setState({ hangingHyphensInfo: this._readHangHyphensInfo() });
        this._addLog('hyphens', `切换 hyphens → ${val}（${this._hyphensOn ? '自动断字需 lang + 词典' : '仅 &shy; 处断字'}）`);
    }
    _renderCard3() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '3. hanging-punctuation 与 hyphens',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['hanging-punctuation', f.hangingPunctuation], ['hyphens', f.hyphens], ['hyphenate-limit-chars', f.hyphenateLimitChars]]), h(Tag, { color: 'primary' }, '标点悬挂 / 断字')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'hanging-punctuation 让标点悬挂到文本框外：first（行首标点悬挂到左边距外）、last（行尾标点悬挂到右边距外）、force-end/allow-end（换行处标点悬挂），影响文本对齐使正文边缘更整齐。hyphens: auto 自动断字（连字符断字）需配合 lang 属性（如 lang="en"）与浏览器对应语言词典；manual 仅在 &shy; 软连字符处断字。hyphenate-character 自定义连字符字符，hyphenate-limit-chars 控制断字处前后最小字符数与最小单词长度。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn(`hanging-punctuation（${this._hangingOn ? 'first last' : 'none'}）`, { type: 'primary', size: 'sm', disabled: !f.hangingPunctuation, onClick: () => this._toggleHanging() }), this._btn(`hyphens（${this._hyphensOn ? 'auto' : 'manual'}）`, { size: 'sm', disabled: !f.hyphens, onClick: () => this._toggleHyphens() })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '标点悬挂段落（hanging-punctuation: first last）：'),
                h('div', { class: 'hang-punct-stage' }, '「CSS Text Module Level 4」是 W3C 的文本排版规范。其中 hanging-punctuation 让行首引号悬挂到边距外，使正文边缘整齐。「开启后」行首标点不再挤进行内。'),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '自动断字段落（hyphens: auto，lang="en"）：'),
                h('div', { class: 'hyphens-stage', lang: 'en' }, 'The internationalization and localization features of modern browsers enable sophisticated typography. Long words like internationalization and responsibility can be hyphenated automatically when hyphens is set to auto and the correct lang attribute is provided.'),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.hangingHyphensInfo || '（点击按钮切换 hanging-punctuation / hyphens）')),
                h(Alert, {
                    type: 'info',
                    message: 'hyphens: auto 必须配合 lang 属性与浏览器词典',
                    description: '没有 lang="en"（或对应语言）属性，hyphens:auto 不生效——浏览器无法知道用哪种语言词典断字。Safari 对 hanging-punctuation 支持较早；Chrome/Firefox 仍实验性。hyphenate-limit-chars: 6 3 6 表示断字处前至少 6 字符、后至少 3 字符、单词至少 6 字符才断。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 4：text-box 与行高控制 ===================
    _readTextBoxInfo() {
        const f = this._flags();
        try {
            const btn = this.el && this.el.querySelector('.text-box-btn');
            const readComp = (el, prop) => {
                if (!el)
                    return '(未渲染)';
                return window.getComputedStyle(el).getPropertyValue(prop) || '(空)';
            };
            return `text-box 与行高控制演示：\n` +
                `  .text-box-btn { text-box: ${this._textBoxOn ? 'trim-both cap' : 'none'} }\n` +
                `    text-box 计算值="${readComp(btn, 'text-box')}"\n` +
                `    text-box-trim 计算值="${readComp(btn, 'text-box-trim')}"\n` +
                `    text-box-edge 计算值="${readComp(btn, 'text-box-edge')}"\n` +
                `  CSS.supports('text-box','trim-both cap') = ${f.textBox}\n` +
                `  text-box-trim 支持 = ${f.textBoxTrim}\n` +
                `  text-box-edge 支持 = ${f.textBoxEdge}\n` +
                `  leading-trim 支持（旧名）= ${f.leadingTrim}\n\n` +
                '说明：\n' +
                '  text-box 简写：text-box: trim | <trim> <text-edge>\n' +
                '  text-box-trim: none|trim-start|trim-end|trim-both —— 去除首/末行的半行距（half-leading）\n' +
                '    trim-start：去除首行上方半行距；trim-end：去除末行下方半行距；trim-both：首末都去除\n' +
                '  text-box-edge: auto|text|cap|ex|ideographic|ideographic-ink —— 文本框边缘定义\n' +
                '    auto=默认；text=文本基线；cap=大写字母高度；ex=x 高度；ideographic=表意文字边缘\n' +
                '  line-height: normal|<number>|<length>|<percentage> —— 行高\n' +
                '  leading-trim: normal|start|end|both —— text-box-trim 的旧名称（已被 text-box-trim 取代）\n\n' +
                'half-leading 概念：line-height 大于字号时，浏览器在每行文字上下各加 (line-height - font-size) / 2 的\n' +
                '  空白（半行距）。这导致按钮内文字无法精确垂直居中（上下都有半行距空白）。\n' +
                '  text-box: trim-both cap 去除首末半行距，使文字精确贴合容器边缘。';
        }
        catch (err) {
            return `读取 text-box 信息失败：${err.name} - ${err.message}`;
        }
    }
    _toggleTextBox() {
        this._textBoxOn = !this._textBoxOn;
        const val = this._textBoxOn ? 'trim-both cap' : 'none';
        this._injectStyle('css-text-box', `.text-box-btn { text-box: ${val}; -webkit-line-box-trim: ${this._textBoxOn ? 'both' : 'none'}; }`);
        this.setState({ textBoxInfo: this._readTextBoxInfo() });
        this._addLog('textbox', `切换 text-box → ${val}（${this._textBoxOn ? '去除首末半行距，文字精确居中' : '保留半行距'}）`);
    }
    _renderCard4() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '4. text-box 与行高控制',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['text-box', f.textBox], ['text-box-trim', f.textBoxTrim], ['text-box-edge', f.textBoxEdge]]), h(Tag, { color: 'primary' }, 'half-leading')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'text-box 是 CSS Inline Layout Level 3 新简写：text-box: <trim> <text-edge>。text-box-trim: none|trim-start|trim-end|trim-both 去除首/末行的半行距（half-leading）——line-height 大于字号时每行上下各加 (line-height - font-size)/2 空白，导致按钮文字无法精确垂直居中。text-box-edge: auto|text|cap|ex|ideographic|ideographic-ink 定义文本框边缘位置。text-box: trim-both cap 去除首末半行距使文字精确贴合容器。leading-trim 是旧名已被 text-box-trim 取代。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn(`text-box（${this._textBoxOn ? 'trim-both cap' : 'none'}）`, { type: 'primary', size: 'sm', disabled: !f.textBoxTrim, onClick: () => this._toggleTextBox() })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '按钮对比（左侧 trim 后精确居中，右侧虚线框显示容器边缘）：'),
                h('div', { class: 'text-box-row' }, h('button', { class: 'text-box-btn', type: 'button' }, '按钮文字'), h('div', { class: 'text-box-box' }, '容器')),
                h('p', { class: 'fs-sm text-tertiary mt-sm' }, '真实浏览器中开启 text-box: trim-both cap 后，按钮内文字精确贴合容器上下边缘（无半行距空白），垂直居中更精确。jsdom 不渲染，仅展示用法。'),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.textBoxInfo || '（点击按钮切换 text-box）')),
                h(Alert, {
                    type: 'info',
                    message: 'text-box 解决 line-height 半行距导致文字无法精确居中',
                    description: 'line-height: normal 通常 ≈ 1.2，每行上下各加约 0.1em 半行距空白。按钮、标签等需要文字精确垂直居中的场景，用 text-box: trim-both cap 去除半行距。text-box 是 Inline Layout Level 3 简写，Chrome 129+ 部分支持。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 5：white-space-collapse 与换行控制 ===================
    _readWSCollapseInfo() {
        const f = this._flags();
        try {
            const url1 = this.el && this.el.querySelector('.ws-collapse-url-breakall');
            const url2 = this.el && this.el.querySelector('.ws-collapse-url-overflow');
            const readComp = (el, prop) => {
                if (!el)
                    return '(未渲染)';
                return window.getComputedStyle(el).getPropertyValue(prop) || '(空)';
            };
            return `white-space-collapse 与换行控制演示：\n` +
                `  .ws-collapse-url-breakall { word-break: break-all }\n` +
                `    word-break 计算值="${readComp(url1, 'word-break')}"\n` +
                `  .ws-collapse-url-overflow { overflow-wrap: break-word }\n` +
                `    overflow-wrap 计算值="${readComp(url2, 'overflow-wrap')}"\n` +
                `  CSS.supports('white-space-collapse','preserve-spaces') = ${f.whiteSpaceCollapse}\n` +
                `  text-space-collapse 支持 = ${f.textSpaceCollapse}\n` +
                `  word-break 支持 = ${f.wordBreak}；overflow-wrap 支持 = ${f.overflowWrap}；line-break 支持 = ${f.lineBreak}\n\n` +
                '说明：\n' +
                '  white-space-collapse: collapse|discard|preserve|preserve-breaks|preserve-spaces|break-spaces —— 新长写属性\n' +
                '    取代 white-space 中折叠部分；collapse=折叠空白；preserve=保留；preserve-breaks=保留换行符；\n' +
                '    preserve-spaces=保留所有空白与制表符；break-spaces=保留且可在空白处断行\n' +
                '  text-space-collapse: collapse|preserve|preserve-breaks|preserve-spaces —— white-space-collapse 别名\n' +
                '  white-space 简写 = text-space-collapse + text-wrap-mode（组合两长写）\n' +
                '    pre=preserve+nowrap；nowrap=collapse+nowrap；pre-wrap=preserve+wrap；\n' +
                '    pre-line=preserve-breaks+wrap；break-spaces=preserve-spaces+wrap；normal=collapse+wrap\n' +
                '  word-break: normal|break-all|keep-all|break-word —— CJK/Non-CJK 断字\n' +
                '    break-all=任意字符间断（CJK 友好但破坏单词）；keep-all=CJK 字符间不断（Han 间不断）\n' +
                '  overflow-wrap: normal|break-word|anywhere —— 仅溢出时断\n' +
                '    break-word=仅无断点时断（不影响 min-content）；anywhere=任意位置断（影响 min-content 计算）\n' +
                '  line-break: auto|loose|normal|strict|anywhere —— CJK 行尾标点严格度\n' +
                '    strict=禁止标点在行首（如句号顶头）；loose=宽松（短文本/日文）\n' +
                '  word-spacing / letter-spacing —— 词间距 / 字间距';
        }
        catch (err) {
            return `读取 white-space-collapse 信息失败：${err.name} - ${err.message}`;
        }
    }
    _setBreakMode(mode) {
        this._breakMode = mode;
        const map = {
            normal: '.ws-collapse-url-breakall { word-break: normal; overflow-wrap: normal; } .ws-collapse-cjk { word-break: normal; }',
            breakall: '.ws-collapse-url-breakall { word-break: break-all; overflow-wrap: normal; } .ws-collapse-cjk { word-break: normal; }',
            overflow: '.ws-collapse-url-overflow { overflow-wrap: break-word; word-break: normal; } .ws-collapse-cjk { word-break: normal; }',
            keepall: '.ws-collapse-cjk { word-break: keep-all; } .ws-collapse-url-breakall { word-break: normal; overflow-wrap: normal; }',
        };
        this._injectStyle('css-ws-collapse-mode', (map[mode]) || map.normal);
        this.setState({ whiteSpaceCollapseInfo: this._readWSCollapseInfo() });
        const desc = { normal: '默认 normal', breakall: 'break-all 任意字符断', overflow: 'overflow-wrap:break-word 仅溢出断', keepall: 'keep-all CJK 不断' }[mode];
        this._addLog('ws', `切换换行模式 → ${mode}（${desc}）`);
    }
    _renderCard5() {
        const s = this.state;
        const f = this._flags();
        const longUrl = 'https://www.example.com/very/long/path/to/some/resource/that/will/overflow.html';
        const card = new Card({
            title: '5. white-space-collapse 与换行控制',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['white-space-collapse', f.whiteSpaceCollapse], ['word-break', f.wordBreak], ['overflow-wrap', f.overflowWrap]]), h(Tag, { color: 'primary' }, 'break-all / keep-all')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'white-space-collapse: collapse|discard|preserve|preserve-breaks|preserve-spaces|break-spaces 是取代 white-space 折叠部分的新长写属性；text-space-collapse 是其别名。white-space 现为简写 = text-space-collapse + text-wrap-mode（pre=preserve+nowrap、nowrap=collapse+nowrap、pre-wrap=preserve+wrap、pre-line=preserve-breaks+wrap、break-spaces=preserve-spaces+wrap、normal=collapse+wrap）。word-break: break-all 任意字符断（CJK 友好但破坏单词）、keep-all CJK 字符间不断（Han 间不断）。overflow-wrap: break-word 仅溢出时断、anywhere 影响min-content计算。line-break 控制 CJK 行尾标点严格度。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ whiteSpaceCollapseInfo: this._readWSCollapseInfo() }) }), this._btn('normal', { size: 'sm', onClick: () => this._setBreakMode('normal') }), this._btn('break-all', { size: 'sm', disabled: !f.wordBreak, onClick: () => this._setBreakMode('breakall') }), this._btn('overflow-wrap', { size: 'sm', disabled: !f.overflowWrap, onClick: () => this._setBreakMode('overflow') }), this._btn('keep-all', { size: 'sm', disabled: !f.wordBreak, onClick: () => this._setBreakMode('keepall') })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '长 URL（break-all vs overflow-wrap:break-word）：'),
                h('div', { class: 'mt-xs' }, h('div', { class: 'ws-collapse-url ws-collapse-url-breakall' }, longUrl), h('div', { class: 'ws-collapse-url ws-collapse-url-overflow' }, longUrl)),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, 'CJK 段落（keep-all 让汉字间不断行）：'),
                h('div', { class: 'ws-collapse-cjk' }, '层叠样式表是一种用来表现HTML或XML等文件样式的计算机语言。CSS Text Module Level 4 定义了文本排版相关属性。keep-all 模式下汉字之间不会断行，仅在标点或空格处换行。'),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '300px', overflow: 'auto' } }, h('code', {}, s.whiteSpaceCollapseInfo || '（点击按钮切换换行模式）')),
                h(Alert, {
                    type: 'info',
                    message: 'word-break:break-all 与 overflow-wrap:break-word 都能断长词，但语义不同',
                    description: 'break-all 任意字符间断（CJK 友好但破坏英文单词完整性）；break-word 仅在无断点溢出时断（保留单词完整性）；anywhere 影响min-content计算。keep-all 让汉字间不断行（仅 CJK 生效，适合中文段落）。line-break:strict 禁止标点在行首。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 6：文本选择与排版组合 ===================
    _readSelectionComboInfo() {
        const f = this._flags();
        try {
            const wm = this.el && this.el.querySelector('.wm-vertical');
            const fs = this.el && this.el.querySelector('.fs-textarea');
            const readComp = (el, prop) => {
                if (!el)
                    return '(未渲染)';
                return window.getComputedStyle(el).getPropertyValue(prop) || '(空)';
            };
            return `文本选择与排版组合 演示：\n` +
                `  .wm-vertical { writing-mode: vertical-rl; text-orientation: mixed; }\n` +
                `    writing-mode 计算值="${readComp(wm, 'writing-mode')}"\n` +
                `  .fs-textarea { field-sizing: content }\n` +
                `    field-sizing 计算值="${readComp(fs, 'field-sizing')}"\n` +
                `  user-select 支持 = ${f.userSelect}\n` +
                `  accent-color 支持 = ${f.accentColor}；caret-color 支持 = ${f.caretColor}\n` +
                `  field-sizing 支持 = ${f.fieldSizing}\n` +
                `  text-justify 支持 = ${f.textJustify}；text-indent 支持 = ${f.textIndent}；tab-size 支持 = ${f.tabSize}\n` +
                `  unicode-bidi 支持 = ${f.unicodeBidi}；writing-mode 支持 = ${f.writingMode}\n\n` +
                '说明（CSS Text L4 全家桶汇总）：\n' +
                '  user-select: none|auto|text|all|contain —— 控制文本是否可选\n' +
                '    none=不可选；all=整体选；contain=仅容器内可选\n' +
                '  ::selection 伪元素 —— 选中文字的 color / background-color\n' +
                '  accent-color: <color> —— 表单控件强调色（checkbox/radio/accent）\n' +
                '  caret-color: <color> —— 文本光标颜色（input/textarea）\n' +
                '  field-sizing: fixed|content —— textarea/input 跟随内容自动增高\n' +
                '  text-align: start|end|left|right|center|justify|match-parent + text-align-last —— 对齐\n' +
                '    start/end 是逻辑属性（随 direction 翻转）；match-parent 继承并按 direction 调整\n' +
                '  text-justify: auto|inter-character|inter-word|none —— justify 的具体方法\n' +
                '    inter-character=CJK 字符间分散；inter-word=英文单词间分散\n' +
                '  text-indent: <length> | hanging —— 首行缩进；hanging 反转（除首行外都缩进）\n' +
                '  tab-size: <number>|<length> —— Tab 字符宽度\n' +
                '  unicode-bidi: normal|embed|isolate|isolate-override|plaintext —— 双向文本控制\n' +
                '    isolate=隔离双向文本（防止影响外部）；plaintext=按内容自动判定方向\n' +
                '  writing-mode: horizontal-tb|vertical-rl|vertical-lr|sideways-rl|sideways-lr —— 书写方向\n' +
                '    vertical-rl=竖排从右到左（中文古籍）；vertical-lr=竖排从左到右\n' +
                '  direction: ltr|rtl —— 文本方向（ltr 左到右，rtl 右到左，阿拉伯/希伯来语）';
        }
        catch (err) {
            return `读取 文本选择/排版 信息失败：${err.name} - ${err.message}`;
        }
    }
    _runSelectionComboDemo() {
        this.setState({ selectionComboInfo: this._readSelectionComboInfo() });
        const f = this._flags();
        this._addLog('combo', `文本选择/排版组合演示：writing-mode=${f.writingMode}, field-sizing=${f.fieldSizing}, user-select=${f.userSelect}`);
    }
    _renderCard6() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '6. 文本选择与排版组合',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['user-select', f.userSelect], ['field-sizing', f.fieldSizing], ['writing-mode', f.writingMode], ['text-justify', f.textJustify]]), h(Tag, { color: 'primary' }, 'CSS Text L4 汇总')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '文本选择与排版组合：user-select 控制文本可选性、::selection 选中样式、accent-color 表单强调色、caret-color 光标色、field-sizing 表单自动增高、text-align[-last] 对齐、text-justify 分散对齐方法、text-indent 首行缩进、tab-size Tab 宽度、unicode-bidi 双向文本、writing-mode 书写方向（竖排）、direction 文本方向。本卡片汇总 CSS Text Module Level 4 全部特性检测。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取汇总信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runSelectionComboDemo() })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '竖排书写（writing-mode: vertical-rl; text-orientation: mixed）：'),
                h('div', { class: 'wm-vertical' }, 'CSS Text Module Level 4 竖排书写模式演示。vertical-rl 是中文古籍排版方向，从右到左竖排。'),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, 'field-sizing: content（textarea 跟随内容自动增高）：'),
                h('textarea', {
                    class: 'fs-textarea',
                    placeholder: '在此输入多行文字，textarea 会自动增高（field-sizing: content）…',
                    rows: '2',
                    oninput: (e) => {
                        if (!f.fieldSizing) {
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                        }
                    },
                }),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '文本选择（::selection 选中变蓝底白字）与 accent-color：'),
                h('div', { class: 'sel-demo' }, '选中这段文字查看 ::selection 效果（蓝底白字）。', h('label', { style: { display: 'inline-block', marginLeft: '12px' } }, h('input', { type: 'checkbox', style: { accentColor: '#1677ff', marginRight: '4px' } }), 'accent-color'), h('input', { type: 'text', placeholder: 'caret-color', style: { caretColor: '#ef4444', marginLeft: '12px' } })),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.selectionComboInfo || '（点击「读取汇总信息」查看 CSS Text L4 全家桶检测）')),
                h(Alert, {
                    type: 'info',
                    message: 'CSS Text Module Level 4 特性汇总',
                    description: 'text-wrap / text-spacing-trim / text-autospace / hanging-punctuation / hyphens / text-box / white-space-collapse / word-break / overflow-wrap / user-select / ::selection / accent-color / caret-color / field-sizing / text-align[-last] / text-justify / text-indent / tab-size / unicode-bidi / writing-mode / direction。多数新属性 jsdom 不识别，需真实浏览器验证；CJK 排版属性（text-spacing-trim / text-autospace / hanging-punctuation）采纳缓慢。',
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
        return h('div', { class: 'api-lab-page css-text-advanced-page' }, h('h2', { class: 'section-title' }, 'CSS Text Module Level 4 高级排版 实验室'), h('p', { class: 'fs-sm text-secondary mb-md' }, '本页演示 CSS Text Module Level 4 高级排版：text-wrap 换行、text-spacing-trim / text-autospace CJK 排版、hanging-punctuation 标点悬挂、hyphens 断字、text-box 半行距、white-space-collapse 与 word-break 换行控制、user-select / ::selection / writing-mode / field-sizing 文本选择与排版组合。所有特性通过 typeof / CSS.supports 能力检测，不可用时仅记日志，绝不抛异常。'), s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderLogPanel());
    }
}
//# sourceMappingURL=CSSTextAdvancedPage.js.map