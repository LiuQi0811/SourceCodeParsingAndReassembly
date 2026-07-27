// =====================================================================
// EditingInputEventsPage.js —— 编辑与输入事件深入 实验室
// 演示 MDN：
//   1. InputEvent 与 beforeinput 事件 —— inputType / data / dataTransfer / getTargetRanges
//   2. contentEditable 与设计模式 —— contentEditable / designMode / isContentEditable
//   3. execCommand 命令（已废弃但广泛兼容）—— bold/italic/formatBlock/queryCommand*
//   4. UndoManager 撤销栈 —— undoManager / UndoTransaction / undo/redo
//   5. Selection 与 Range 在编辑中的应用 —— getSelection / Range.surroundContents
//   6. 自定义编辑命令与 beforeinput 拦截 —— preventDefault + getTargetRanges + dataTransfer
// 说明：beforeinput 可取消（preventDefault）→ DOM 变化 → input 不可取消。
//       InputEvent.getTargetRanges 仅在 beforeinput 中可用（返回 StaticRange[]）。
//       execCommand 已废弃但仍广泛兼容；新代码应使用 beforeinput + getTargetRanges。
//       UndoManager 浏览器支持有限，多数浏览器通过 execCommand('undo'/'redo') 实现。
//       所有 API 调用前做 typeof 能力检测，jsdom 中 Selection/Range 操作可能返回 null，
//       用 try/catch + null 检查保护，绝不抛异常。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
// 可编辑演示区共享样式
const DEMO_EDIT_STYLE = { minHeight: '40px', padding: '8px', border: '1px solid var(--color-border)', borderRadius: '4px' };
export class EditingInputEventsPage extends Page {
    _beforeInputHandler = null;
    _editableEl = null;
    _inited = false;
    _inputHandler = null;
    _interceptBeforeInputHandler = null;
    _interceptEl = null;
    _plainEl = null;
    _plainInputHandler = null;
    _richEl = null;
    _richInputHandler = null;
    _selectionChangeHandler = null;
    // —— 初始 state ——
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            inputEventInfo: '', // Card 1：InputEvent 与 beforeinput 事件
            contentEditableInfo: '', // Card 2：contentEditable 与设计模式
            execCommandInfo: '', // Card 3：execCommand 命令（已废弃但广泛兼容）
            undoManagerInfo: '', // Card 4：UndoManager 撤销栈
            selectionInfo: '', // Card 5：Selection 与 Range 在编辑中的应用
            interceptInfo: '', // Card 6：自定义编辑命令与 beforeinput 拦截
        };
    }
    // —— 生命周期 ——
    componentDidMount() {
        // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
        if (this._inited)
            return;
        this._inited = true;
        // 一次性初始化各实例引用（componentWillUnmount 中释放）
        this._editableEl = null; // Card 1 contenteditable 宿主
        this._plainEl = null; // Card 2 plaintext-only 宿主
        this._richEl = null; // Card 2/3 contenteditable=true 宿主
        this._interceptEl = null; // Card 6 拦截宿主
        this._beforeInputHandler = null; // Card 1 beforeinput 处理函数
        this._inputHandler = null; // Card 1 input 处理函数
        this._plainInputHandler = null; // Card 2 plain input 处理函数
        this._richInputHandler = null; // Card 3 rich input 处理函数
        this._interceptBeforeInputHandler = null; // Card 6 beforeinput 拦截处理函数
        this._selectionChangeHandler = null; // document selectionchange 处理函数
        // 一次性能力检测：编辑与输入事件全家桶
        const caps = this._detectCaps();
        const parts = [
            `InputEvent ${caps.inputEvent ? '✓' : '✗'}`,
            `execCommand ${caps.execCommand ? '✓' : '✗'}`,
            `getSelection ${caps.selection ? '✓' : '✗'}`,
            `createRange ${caps.createRange ? '✓' : '✗'}`,
            `Range ${caps.range ? '✓' : '✗'}`,
            `undoManager ${caps.undoManager ? '✓' : '✗'}`,
            `queryCommandSupported ${caps.queryCommand ? '✓' : '✗'}`,
        ];
        const anyAvailable = caps.inputEvent || caps.execCommand || caps.selection;
        const summary = anyAvailable
            ? `编辑与输入事件能力检测：${parts.join(' · ')}。jsdom 中 InputEvent / execCommand / getSelection 通常存在但 Selection/Range 操作可能返回 null（用 try/catch 保护）；undoManager 浏览器支持有限（多数无）。contenteditable 可创建但真实输入需浏览器；本页通过派发合成 InputEvent 演示事件流。`
            : `编辑与输入事件能力检测：${parts.join(' · ')}。当前环境不支持 InputEvent / execCommand / getSelection；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。`;
        this.setState({ capsSummary: summary });
        this._addLog(anyAvailable ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!caps.inputEvent)
            this._addLog('warn', 'InputEvent 不可用（typeof undefined），无法派发合成事件');
        if (!caps.undoManager)
            this._addLog('warn', 'document.undoManager 不可用（浏览器支持有限），将用 execCommand("undo"/"redo") 演示');
        // 创建事件处理函数（引用稳定，便于 removeEventListener）
        this._beforeInputHandler = (e) => {
            try {
                const inputType = e.inputType || '(未知)';
                const data = e.data == null ? '(null)' : JSON.stringify(e.data);
                let ranges = '[]';
                if (typeof e.getTargetRanges === 'function') {
                    try {
                        ranges = `${e.getTargetRanges().length} 个 StaticRange`;
                    }
                    catch { /* noop */ }
                }
                this._addLog('input', `beforeinput：inputType=${inputType}，data=${data}，isComposing=${!!e.isComposing}，targetRanges=${ranges}`);
            }
            catch { /* noop */ }
        };
        this._inputHandler = (e) => {
            try {
                this._addLog('input', `input 事件触发：inputType=${e.inputType || '(未知)'}，data=${e.data == null ? '(null)' : JSON.stringify(e.data)}`);
            }
            catch { /* noop */ }
        };
        this._plainInputHandler = (e) => {
            try {
                this._addLog('edit', `plaintext-only input：inputType=${e.inputType || '(未知)'}（已剥离格式）`);
            }
            catch { /* noop */ }
        };
        this._richInputHandler = (e) => {
            try {
                this._addLog('edit', `rich input：inputType=${e.inputType || '(未知)'}`);
            }
            catch { /* noop */ }
        };
        this._interceptBeforeInputHandler = (e) => {
            // Card 6：拦截 insertFromPaste / insertFromDrop，preventDefault 后插入净化纯文本
            try {
                if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') {
                    let raw = '';
                    if (e.dataTransfer && typeof e.dataTransfer.getData === 'function') {
                        try {
                            raw = e.dataTransfer.getData('text/plain') || '';
                        }
                        catch { /* noop */ }
                    }
                    const sanitized = raw.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
                    e.preventDefault();
                    if (caps.execCommand && this._interceptEl) {
                        try {
                            document.execCommand('insertText', false, sanitized);
                        }
                        catch { /* noop */ }
                    }
                    this._addLog('intercept', `拦截 ${e.inputType}：原始=${JSON.stringify(raw).slice(0, 40)}，净化=${JSON.stringify(sanitized).slice(0, 40)}，已 preventDefault 并插入纯文本`);
                    this.setState({ interceptInfo: `已拦截 ${e.inputType}：\n` +
                            `  原始内容（text/plain）：${JSON.stringify(raw).slice(0, 200)}\n` +
                            `  净化后（去 HTML / 压缩空白）：${JSON.stringify(sanitized).slice(0, 200)}\n` +
                            '  已调用 e.preventDefault() 取消默认粘贴\n' +
                            (caps.execCommand ? '  已通过 document.execCommand("insertText", false, sanitized) 插入纯文本' : '  execCommand 不可用，仅 preventDefault') });
                }
                else {
                    this._addLog('intercept', `beforeinput 放行：inputType=${e.inputType}（仅拦截 insertFromPaste/insertFromDrop）`);
                }
            }
            catch { /* noop */ }
        };
        this._selectionChangeHandler = () => {
            if (!this._detectCaps().selection)
                return;
            try {
                const sel = window.getSelection();
                if (!sel || sel.isCollapsed)
                    return;
                const text = sel.toString();
                if (!text)
                    return;
                let rangeInfo = '(无 Range)';
                if (sel.rangeCount > 0) {
                    const r = sel.getRangeAt(0);
                    rangeInfo = `startOffset=${r.startOffset}, endOffset=${r.endOffset}, collapsed=${r.collapsed}`;
                }
                this._addLog('select', `selectionchange：选区="${text.slice(0, 30)}"，${rangeInfo}`);
            }
            catch { /* noop */ }
        };
        // 注册 document 级 selectionchange（this.on 自动在 destroy 时解绑）
        if (caps.selection && typeof document !== 'undefined') {
            this.on(document, 'selectionchange', this._selectionChangeHandler);
        }
        // 给当前 render 出的可编辑元素附加监听（首次；后续 rerender 由 h() 的 on prop 自动附加）
        this._attachEditableListeners();
    }
    // 把 beforeinput / input 监听附加到当前 render 树中的可编辑元素
    _attachEditableListeners() {
        if (!this.el)
            return;
        const attach = (selector, type, handler) => {
            try {
                const el = this.el.querySelector(selector);
                if (el && handler)
                    el.addEventListener(type, handler);
                return el || null;
            }
            catch { /* noop */ }
            return null;
        };
        this._editableEl = attach('[data-editable="card1"]', 'beforeinput', this._beforeInputHandler);
        attach('[data-editable="card1"]', 'input', this._inputHandler);
        this._plainEl = attach('[data-editable="card2-plain"]', 'input', this._plainInputHandler);
        this._richEl = attach('[data-editable="card2-rich"]', 'input', this._richInputHandler);
        attach('[data-editable="card3-rich"]', 'input', this._richInputHandler);
        this._interceptEl = attach('[data-editable="card6"]', 'beforeinput', this._interceptBeforeInputHandler);
    }
    componentWillUnmount() {
        // 移除可编辑元素的事件监听（try/catch 每一项；优先用当前 render 树中的元素）
        const q = (sel) => { try {
            return this.el ? this.el.querySelector(sel) : null;
        }
        catch {
            return null;
        } };
        const detach = (sel, type, handler) => {
            const el = q(sel);
            if (el && handler) {
                try {
                    el.removeEventListener(type, handler);
                }
                catch { /* noop */ }
            }
        };
        detach('[data-editable="card1"]', 'beforeinput', this._beforeInputHandler);
        detach('[data-editable="card1"]', 'input', this._inputHandler);
        detach('[data-editable="card2-plain"]', 'input', this._plainInputHandler);
        detach('[data-editable="card2-rich"]', 'input', this._richInputHandler);
        detach('[data-editable="card3-rich"]', 'input', this._richInputHandler);
        detach('[data-editable="card6"]', 'beforeinput', this._interceptBeforeInputHandler);
        // 移除 document 级 selectionchange（this.on 已自动解绑，此处兜底）
        if (this._selectionChangeHandler && typeof document !== 'undefined') {
            try {
                document.removeEventListener('selectionchange', this._selectionChangeHandler);
            }
            catch { /* noop */ }
        }
        // 释放引用
        this._editableEl = this._plainEl = this._richEl = this._interceptEl = null;
        this._beforeInputHandler = this._inputHandler = this._plainInputHandler = this._richInputHandler = null;
        this._interceptBeforeInputHandler = this._selectionChangeHandler = null;
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
    // 能力检测（返回布尔对象，render 时调用，开销可忽略）
    _detectCaps() {
        const hasDoc = typeof document !== 'undefined';
        return {
            inputEvent: typeof InputEvent !== 'undefined',
            execCommand: hasDoc && typeof document.execCommand === 'function',
            selection: typeof window !== 'undefined' && typeof window.getSelection === 'function',
            createRange: hasDoc && typeof document.createRange === 'function',
            range: typeof Range !== 'undefined',
            undoManager: hasDoc && !!document.undoManager,
            queryCommand: hasDoc && typeof document.queryCommandSupported === 'function',
        };
    }
    // 返回 Tag[] 数组展示能力状态（✓/✗）
    _caps(items) {
        return items.map((it) => h(Tag, { color: it.ok ? 'success' : 'error' }, `${it.label} ${it.ok ? '✓' : '✗'}`));
    }
    // =================== Card 1：InputEvent 与 beforeinput 事件 ===================
    _showInputTypeList() {
        this.setState({ inputEventInfo: '===== InputEvent.inputType 完整类型清单（约 30 种）=====\n\n' +
                '【插入类】insertText（普通文本）/ insertReplacementText（替换/自动纠正）/ insertFromPaste / insertFromDrop（粘贴/拖放）\n' +
                '  insertFromYank / insertTranspose / insertCompositionText / insertFromComposition（IME 组合输入）\n' +
                '  insertParagraph / insertLineBreak（段落/换行）/ insertOrderedList / insertUnorderedList / insertHorizontalRule / insertLink\n' +
                '【删除类】deleteContentBackward / deleteContentForward（前/后删除）/ deleteByCut / deleteByDrag / deleteWordBackward / deleteWordForward（按词）\n' +
                '  deleteSoftLineBackward/Forward / deleteHardLineBackward/Forward（软/硬行删除）\n' +
                '【格式类】formatBold / formatItalic / formatUnderline / formatStrikeThrough / formatSuperscript / formatSubscript\n' +
                '  formatJustifyFull/Center/Left/Right / formatIndent / formatOutdent / formatSetBlockTextDirection\n' +
                '  formatBackColor / formatFontColor / formatFontName\n' +
                '【历史类】historyUndo / historyRedo（撤销/重做）  【其他】setContent（设置全部内容）\n\n' +
                '===== InputEvent 关键属性 =====\n' +
                '  .inputType —— 类型字符串；.data —— 插入/删除的字符串（可能为 null）\n' +
                '  .dataTransfer —— DataTransfer（粘贴/拖放携带数据）；.isComposing —— IME 组合中\n' +
                '  .getTargetRanges() —— StaticRange[]，仅 beforeinput 可用，input 事件中返回空\n\n' +
                '===== 事件触发顺序 =====\n  beforeinput（cancelable，可 preventDefault）→ DOM 变化 → input（不可取消）' });
        this._addLog('input', '已展示 InputEvent.inputType 完整清单与属性');
    }
    _dispatchBeforeInput() {
        const caps = this._detectCaps();
        if (!caps.inputEvent) {
            this._addLog('warn', 'InputEvent 不可用，无法派发合成事件');
            return;
        }
        const target = (this.el && this.el.querySelector('[data-editable="card1"]')) || this._editableEl;
        if (!target) {
            this._addLog('warn', '未找到 Card1 可编辑元素');
            return;
        }
        try {
            const ev = new InputEvent('beforeinput', {
                inputType: 'insertText', data: '你好', cancelable: true, bubbles: true,
            });
            target.dispatchEvent(ev);
            this._addLog('input', '已派发合成 InputEvent("beforeinput", insertText, "你好")，查看事件日志');
            this.setState({ inputEventInfo: '已派发合成 InputEvent 演示 beforeinput 流程：\n' +
                    '  ev = new InputEvent("beforeinput", { inputType: "insertText", data: "你好", cancelable: true })\n' +
                    '  target.dispatchEvent(ev)\n' +
                    '  → beforeinput 监听器触发，记录 inputType / data / targetRanges\n' +
                    '  → 随后派发 input 事件（真实浏览器中由 DOM 变化自动触发）\n\n' +
                    '说明：合成事件的 getTargetRanges() 返回空数组（无真实编辑意图）。真实浏览器中输入时，getTargetRanges 返回将被影响的 StaticRange[]。' });
        }
        catch (err) {
            this._addLog('warn', `派发 InputEvent 失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard1() {
        const s = this.state;
        const caps = this._detectCaps();
        const card = new Card({
            title: '1. InputEvent 与 beforeinput 事件',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                { label: 'InputEvent', ok: caps.inputEvent },
                { label: 'beforeinput', ok: caps.inputEvent },
            ]), h(Tag, { color: 'primary' }, 'inputType / data')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'InputEvent 继承 UIEvent。属性：.inputType（约 30 种类型字符串，如 insertText / insertFromPaste / deleteContentBackward / formatBold / historyUndo）、.data（插入/删除的字符串）、.dataTransfer（粘贴/拖放的 DataTransfer）、.isComposing（IME 组合中）。.getTargetRanges() 返回 StaticRange[]（将被影响的范围，仅 beforeinput 可用，input 事件中为空）。事件顺序：beforeinput（可 preventDefault）→ DOM 变化 → input（不可取消）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('inputType 清单', { type: 'primary', size: 'sm', onClick: () => this._showInputTypeList() }), this._btn('派发 beforeinput', { size: 'sm', disabled: !caps.inputEvent, onClick: () => this._dispatchBeforeInput() })),
                h('div', { class: 'fs-sm text-secondary' }, '可编辑区域（真实浏览器中输入会触发 beforeinput/input）：'),
                h('div', { contentEditable: 'true', class: 'demo-editable', dataset: { editable: 'card1' },
                    onbeforeinput: this._beforeInputHandler, oninput: this._inputHandler, style: DEMO_EDIT_STYLE }, '在此输入文本观察 beforeinput/input 事件流'),
                h('div', { class: 'fs-sm text-secondary' }, 'InputEvent 详情：'),
                h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.inputEventInfo || '（点击「inputType 清单」或「派发 beforeinput」）')),
                h(Alert, { type: 'info', message: 'getTargetRanges 仅在 beforeinput 中可用',
                    description: 'beforeinput 事件可调用 event.getTargetRanges() 获取将被影响的 StaticRange[]，配合 preventDefault 可实现自定义编辑。input 事件中 getTargetRanges 返回空数组（DOM 已变化）。' }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 2：contentEditable 与设计模式 ===================
    _detectContentEditable() {
        const caps = this._detectCaps();
        const rich = (this.el && this.el.querySelector('[data-editable="card2-rich"]')) || this._richEl;
        const plain = (this.el && this.el.querySelector('[data-editable="card2-plain"]')) || this._plainEl;
        let richEditable = '(无元素)', plainEditable = '(无元素)';
        let designMode = '(无 document)';
        try {
            if (rich)
                richEditable = String(rich.isContentEditable);
        }
        catch { /* noop */ }
        try {
            if (plain)
                plainEditable = String(plain.isContentEditable);
        }
        catch { /* noop */ }
        try {
            if (typeof document !== 'undefined')
                designMode = document.designMode || 'off';
        }
        catch { /* noop */ }
        this.setState({ contentEditableInfo: 'contentEditable / designMode 检测：\n\n' +
                `  Card2 rich（contentEditable="true"）：isContentEditable = ${richEditable}\n` +
                `  Card2 plain（contentEditable="plaintext-only"）：isContentEditable = ${plainEditable}\n` +
                `  document.designMode = ${designMode}\n\n` +
                '===== contentEditable 取值 =====\n' +
                '  "true" —— 可编辑（富文本，保留粘贴的 HTML 格式）；"false" —— 不可编辑\n' +
                '  "plaintext-only" —— 仅纯文本编辑（剥离粘贴 HTML，适合代码编辑器）；"inherit" —— 继承父元素（默认）\n\n' +
                '===== HTMLElement.isContentEditable =====\n' +
                '  只读布尔属性，反映元素当前是否可编辑（综合考虑 contentEditable 与 designMode）\n\n' +
                '===== document.designMode =====\n' +
                '  "on"/"off"：使整个文档可编辑（影响所有元素，不限于某个 contenteditable）\n' +
                '  与 contentEditable 的区别：designMode 全局生效，contentEditable 针对单个元素' });
        this._addLog('edit', `检测：rich.isContentEditable=${richEditable}，plain.isContentEditable=${plainEditable}，designMode=${designMode}`);
    }
    _showPasteDiff() {
        this.setState({ contentEditableInfo: '===== contentEditable="true" vs "plaintext-only" 粘贴对比 =====\n\n' +
                '场景：从网页/Word 复制富文本 "<b>粗体</b> <i>斜体</i> 普通"，分别粘贴到两个 div：\n\n' +
                '【contentEditable="true"】（富文本，保留格式）\n' +
                '  粘贴后 innerHTML = "<b>粗体</b> <i>斜体</i> 普通"，显示：粗体(加粗) 斜体(倾斜) 普通\n' +
                '  说明：保留所有 HTML 标签与样式，粘贴的格式原样插入\n\n' +
                '【contentEditable="plaintext-only"】（纯文本，剥离格式）\n' +
                '  粘贴后 textContent = "粗体 斜体 普通"，显示：粗体 斜体 普通（无任何格式）\n' +
                '  说明：自动剥离 HTML 标签，仅插入纯文本，适合代码编辑器/标题输入\n\n' +
                '===== 设计模式对比 =====\n' +
                '  document.designMode="on"：整个 document 可编辑（含所有元素，等同全局 contentEditable）\n' +
                '  element.contentEditable="true"：仅该元素及其子树可编辑\n' +
                '  用途：富文本编辑器用 contentEditable（局部）；全页演示/文档批注用 designMode（全局）\n\n' +
                '代码示例：richDiv.contentEditable="true"（富文本）；plainDiv.contentEditable="plaintext-only"（纯文本，需降级检测）；\n' +
                '  document.designMode="on"（全文档可编辑）；console.log(el.isContentEditable) 读取当前可编辑状态' });
        this._addLog('edit', '已展示 contentEditable="true" vs "plaintext-only" 粘贴格式差异');
    }
    _renderCard2() {
        const s = this.state;
        const caps = this._detectCaps();
        const card = new Card({
            title: '2. contentEditable 与设计模式',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: 'primary' }, 'contentEditable'), h(Tag, { color: 'warning' }, 'designMode')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'element.contentEditable = "true" | "false" | "plaintext-only" | "inherit" 控制元素可编辑性；document.designMode = "on" | "off" 使整个文档可编辑；HTMLElement.isContentEditable（只读）反映当前状态。contentEditable="plaintext-only" 剥离粘贴的 HTML 格式（适合代码编辑器）；designMode 全局生效，contentEditable 针对单个元素。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('检测 isContentEditable', { type: 'primary', size: 'sm', disabled: !caps.execCommand, onClick: () => this._detectContentEditable() }), this._btn('粘贴格式对比', { size: 'sm', onClick: () => this._showPasteDiff() })),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, h('div', { style: { flex: '1', minWidth: '180px' } }, h('div', { class: 'fs-sm text-secondary mb-xs' }, 'contentEditable="true"（富文本）：'), h('div', { contentEditable: 'true', class: 'demo-editable', dataset: { editable: 'card2-rich' },
                    oninput: this._richInputHandler, style: DEMO_EDIT_STYLE }, '粘贴富文本会保留格式')), h('div', { style: { flex: '1', minWidth: '180px' } }, h('div', { class: 'fs-sm text-secondary mb-xs' }, 'contentEditable="plaintext-only"（纯文本）：'), h('div', { contentEditable: 'plaintext-only', class: 'demo-editable', dataset: { editable: 'card2-plain' },
                    oninput: this._plainInputHandler, style: DEMO_EDIT_STYLE }, '粘贴富文本会剥离格式'))),
                h('div', { class: 'fs-sm text-secondary' }, 'contentEditable / designMode 详情：'),
                h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.contentEditableInfo || '（点击「检测 isContentEditable」或「粘贴格式对比」）')),
                h(Alert, { type: 'warning', message: 'plaintext-only 兼容性有限',
                    description: 'contentEditable="plaintext-only" 在 Chrome / Edge 支持，Firefox 早期不支持（会回退为不可编辑或 true）。生产环境需检测：try { el.contentEditable = "plaintext-only"; } catch / 检查 isContentEditable 是否为 true。designMode="on" 会使整个文档可编辑，谨慎使用。' }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 3：execCommand 命令（已废弃但广泛兼容）===================
    _runExecCommand(cmd, value = null) {
        const caps = this._detectCaps();
        if (!caps.execCommand) {
            this._addLog('warn', `document.execCommand 不可用，无法执行 ${cmd}`);
            return;
        }
        let result = '(异常)', enabled = '(未知)', supported = '(未知)', stateVal = '(未知)';
        try {
            if (typeof document.queryCommandSupported === 'function')
                supported = String(document.queryCommandSupported(cmd));
            if (typeof document.queryCommandEnabled === 'function')
                enabled = String(document.queryCommandEnabled(cmd));
            result = String(document.execCommand(cmd, false, value));
            if (typeof document.queryCommandValue === 'function')
                stateVal = String(document.queryCommandValue(cmd));
        }
        catch (err) {
            result = `异常：${err.name}`;
        }
        this._addLog('exec', `execCommand("${cmd}"${value ? `, "${value}"` : ''}) = ${result}（supported=${supported}, enabled=${enabled}, value=${stateVal}）`);
        this.setState({ execCommandInfo: `document.execCommand("${cmd}"${value ? `, false, "${value}"` : ', false, null'}) 演示：\n\n` +
                `  返回值（execCommand）= ${result}\n` +
                `  queryCommandSupported("${cmd}") = ${supported}\n  queryCommandEnabled("${cmd}") = ${enabled}\n  queryCommandValue("${cmd}") = ${stateVal}\n\n` +
                '说明：execCommand 返回布尔表示命令是否成功执行；jsdom 中大多返回 false（无真实编辑上下文）。\n' +
                '  真实浏览器中需先 focus 到 contenteditable 元素并选中文本，命令才生效。' });
    }
    _showExecCommandList() {
        this.setState({ execCommandInfo: '===== document.execCommand(commandId, showUI=false, value=null) 命令清单 =====\n\n' +
                '【格式类】bold / italic / underline / strikeThrough / subscript / superscript\n' +
                '【插入类】insertText / insertHTML / insertImage(url) / insertOrderedList / insertUnorderedList\n' +
                '【块级】formatBlock("<h1>"|"<blockquote>"|"<p>"|"<pre>") —— 改变块级标签\n' +
                '【链接】createLink(url) / unlink  【样式】foreColor(color) / hiliteColor(color) / fontName(name) / fontSize(1-7)\n' +
                '【对齐】justifyLeft/Center/Right/Full  【缩进】indent / outdent\n' +
                '【剪贴板】copy / cut / paste（paste 常被禁）  【选区】selectAll / delete  【历史】undo / redo\n' +
                '【配置】styleWithCSS(bool) / useCSS(bool) / defaultParagraphSeparator("div"|"p")\n\n' +
                '===== 查询 API =====\n' +
                '  queryCommandSupported(cmd) —— 是否支持；queryCommandEnabled(cmd) —— 当前是否可用\n' +
                '  queryCommandValue(cmd) —— 当前值（如 foreColor 返回颜色）；queryCommandState(cmd) —— 状态\n\n' +
                '===== 状态 =====\n' +
                '  ⚠️ DEPRECATED（已废弃）：MDN 标记废弃，但仍广泛兼容（所有浏览器支持）\n' +
                '  新代码应使用 InputEvent.getTargetRanges + beforeinput 实现自定义编辑\n' +
                '  富文本编辑器（Quill / ProseMirror / Slate）已转向自管数据模型 + 自渲染' });
        this._addLog('exec', '已展示 execCommand 命令清单与查询 API');
    }
    _renderCard3() {
        const s = this.state;
        const caps = this._detectCaps();
        const card = new Card({
            title: '3. execCommand 命令（已废弃但广泛兼容）',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                { label: 'execCommand', ok: caps.execCommand },
                { label: 'queryCommand', ok: caps.queryCommand },
            ]), h(Tag, { color: 'warning' }, 'DEPRECATED')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'document.execCommand(commandId, showUI=false, value=null) 执行编辑命令：bold / italic / underline / insertText / insertHTML / formatBlock("<h1>") / createLink / foreColor / justifyLeft / insertOrderedList / undo / redo 等。配套查询：queryCommandSupported / queryCommandEnabled / queryCommandValue / queryCommandState。⚠️ 已废弃但仍广泛兼容；新代码应使用 beforeinput + getTargetRanges。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('命令清单', { type: 'primary', size: 'sm', onClick: () => this._showExecCommandList() }), this._btn('Bold', { size: 'sm', disabled: !caps.execCommand, onClick: () => this._runExecCommand('bold') }), this._btn('Italic', { size: 'sm', disabled: !caps.execCommand, onClick: () => this._runExecCommand('italic') }), this._btn('Underline', { size: 'sm', disabled: !caps.execCommand, onClick: () => this._runExecCommand('underline') }), this._btn('插入有序列表', { size: 'sm', disabled: !caps.execCommand, onClick: () => this._runExecCommand('insertOrderedList') }), this._btn('formatBlock H1', { size: 'sm', disabled: !caps.execCommand, onClick: () => this._runExecCommand('formatBlock', '<h1>') }), this._btn('queryCommandState', { size: 'sm', disabled: !caps.execCommand, onClick: () => this._runExecCommand('bold') })),
                h('div', { class: 'fs-sm text-secondary' }, '富文本编辑区（真实浏览器中先选中文本再点命令）：'),
                h('div', { contentEditable: 'true', class: 'demo-editable', dataset: { editable: 'card3-rich' },
                    oninput: this._richInputHandler, style: DEMO_EDIT_STYLE }, '选中这段文字后点击 Bold / Italic / formatBlock 等命令'),
                h('div', { class: 'fs-sm text-secondary' }, 'execCommand 结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.execCommandInfo || '（点击「命令清单」或任意命令按钮）')),
                h(Alert, { type: 'warning', message: 'execCommand 已废弃，新代码勿用',
                    description: 'MDN 将 document.execCommand 标记为 Deprecated。copy / cut / paste 用 navigator.clipboard 替代；富文本编辑推荐 contenteditable + Selection/Range + beforeinput（InputEvent.getTargetRanges），或使用成熟编辑器（ProseMirror / Slate / Lexical）自管数据模型。execCommand 的 formatBlock 需传 "<h1>" 带尖括号的形式。' }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 4：UndoManager 撤销栈 ===================
    _detectUndoManager() {
        const caps = this._detectCaps();
        const hasDocUm = caps.undoManager;
        let elUm = false;
        try {
            const el = this.el && this.el.querySelector('[data-editable="card3-rich"]');
            if (el && 'undoManager' in el)
                elUm = !!el.undoManager;
        }
        catch { /* noop */ }
        this.setState({ undoManagerInfo: '===== UndoManager 能力检测 =====\n\n' +
                `  document.undoManager 可用：${hasDocUm ? '是 ✓' : '否 ✗（多数浏览器未实现）'}\n` +
                `  element.undoManager 可用：${elUm ? '是 ✓' : '否 ✗（需 undoscope 属性，无浏览器支持）'}\n\n` +
                '===== UndoManager API（规范定义，支持有限）=====\n' +
                '  .item(index) —— 按索引取事务；.length —— 事务总数；.position —— 当前位置\n' +
                '  .add(transaction, merge) —— 压入自定义事务；.remove(index, count) —— 移除；.clear() —— 清空\n' +
                '  .undo() / .redo() —— 撤销/重做一步；.canUndo / .canRedo —— 是否可撤销/重做（只读）；.onundo / .onredo —— 回调\n\n' +
                '===== UndoTransaction 接口（自定义事务）=====\n' +
                '  label —— 事务标签；apply() —— 应用；unapply() —— 回滚；reapply() —— 重新应用\n\n' +
                '===== 现状 =====\n' +
                '  ⚠️ 浏览器支持极有限：document.undoManager 多为 undefined；element.undoManager 需 undoscope 属性，无浏览器实现。\n' +
                '  多数浏览器通过 execCommand("undo"/"redo") 内部管理撤销栈（栈深度不可直接访问）。\n' +
                '  现代编辑器（ProseMirror / Slate）自管撤销栈，不依赖浏览器原生 UndoManager。' });
        this._addLog('undo', `UndoManager 检测：document.undoManager=${hasDocUm}，element.undoManager=${elUm}`);
    }
    _demoExecUndoRedo() {
        const caps = this._detectCaps();
        if (!caps.execCommand) {
            this._addLog('warn', 'execCommand 不可用，无法演示 undo/redo');
            return;
        }
        let undoResult = '(异常)', redoResult = '(异常)', stateUndo = '(未知)', stateRedo = '(未知)';
        try {
            undoResult = String(document.execCommand('undo', false, null));
        }
        catch (e) {
            undoResult = `异常：${e.name}`;
        }
        try {
            redoResult = String(document.execCommand('redo', false, null));
        }
        catch (e) {
            redoResult = `异常：${e.name}`;
        }
        try {
            if (caps.queryCommand) {
                stateUndo = String(document.queryCommandSupported('undo'));
                stateRedo = String(document.queryCommandSupported('redo'));
            }
        }
        catch { /* noop */ }
        this._addLog('undo', `execCommand("undo")=${undoResult}，execCommand("redo")=${redoResult}`);
        this.setState({ undoManagerInfo: 'execCommand("undo" / "redo") 演示（浏览器内部撤销栈）：\n\n' +
                `  document.execCommand("undo")  = ${undoResult}\n  document.execCommand("redo")  = ${redoResult}\n` +
                `  queryCommandSupported("undo") = ${stateUndo}\n  queryCommandSupported("redo") = ${stateRedo}\n\n` +
                '说明：execCommand("undo"/"redo") 操作浏览器内部撤销栈，栈深度不可直接访问。jsdom 中通常返回 false（无真实编辑历史）；真实浏览器中需先有编辑操作才能 undo。\n\n' +
                '===== 原生 UndoManager 不可用时的替代方案 =====\n' +
                '  1. execCommand("undo"/"redo")：依赖浏览器内部撤销栈（黑盒，栈深度不可访问）\n' +
                '  2. 自管撤销栈：编辑器记录每次操作（beforeinput 拦截），实现 apply/unapply\n' +
                '  3. 使用成熟编辑器框架：ProseMirror history / Slate History / Lexical History\n\n' +
                '===== 自管撤销栈示例（伪代码）=====\n' +
                '  const undoStack = [], redoStack = [];\n' +
                '  el.addEventListener("beforeinput", (e: any) => {\n' +
                '    undoStack.push({ type: e.inputType, data: e.data, ranges: e.getTargetRanges() });\n' +
                '    redoStack.length = 0; // 新操作清空 redo\n  });\n' +
                '  function undo() { redoStack.push(undoStack.pop()); /* 回滚 */ }\n' +
                '  function redo() { undoStack.push(redoStack.pop()); /* 重做 */ }' });
    }
    _renderCard4() {
        const s = this.state;
        const caps = this._detectCaps();
        const card = new Card({
            title: '4. UndoManager 撤销栈',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([{ label: 'undoManager', ok: caps.undoManager }]), h(Tag, { color: caps.undoManager ? 'success' : 'warning' }, caps.undoManager ? '原生可用' : '需降级')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'element.undoManager（需 undoscope 属性，无浏览器支持）或 document.undoManager：.item/.length/.position/.add(transaction, merge)/.remove/.clear/.undo/.redo/.canUndo/.canRedo/.onundo/.onredo。UndoTransaction 接口（label/apply/unapply/reapply）支持自定义事务。⚠️ 浏览器支持极有限，多数通过 execCommand("undo"/"redo") 内部管理撤销栈（栈深度不可直接访问）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('检测 undoManager', { type: 'primary', size: 'sm', onClick: () => this._detectUndoManager() }), this._btn('execCommand undo/redo', { size: 'sm', disabled: !caps.execCommand, onClick: () => this._demoExecUndoRedo() })),
                h('div', { class: 'fs-sm text-secondary' }, 'UndoManager / 撤销栈详情：'),
                h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.undoManagerInfo || '（点击「检测 undoManager」或「execCommand undo/redo」）')),
                h(Alert, { type: 'warning', message: 'UndoManager 浏览器支持极有限',
                    description: 'document.undoManager 多为 undefined；element.undoManager 需 undoscope 属性，当前无浏览器实现。生产环境应自管撤销栈（beforeinput 拦截记录操作）或使用成熟编辑器的 history 模块（ProseMirror history / Slate History / Lexical History）。execCommand("undo"/"redo") 可用但栈深度不可访问。' }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 5：Selection 与 Range 在编辑中的应用 ===================
    _readSelection() {
        const caps = this._detectCaps();
        if (!caps.selection) {
            this._addLog('warn', 'window.getSelection 不可用');
            return;
        }
        try {
            const sel = window.getSelection();
            if (!sel) {
                this._addLog('warn', 'getSelection() 返回 null');
                return;
            }
            const text = sel.toString();
            const lines = [
                '===== window.getSelection() 读取 =====\n',
                `  selection.toString() = ${JSON.stringify(text)}，rangeCount = ${sel.rangeCount}`,
                `  isCollapsed = ${sel.isCollapsed}，type = ${sel.type}`,
            ];
            if (sel.rangeCount > 0) {
                const r = sel.getRangeAt(0);
                lines.push(`  Range: startOffset=${r.startOffset}, endOffset=${r.endOffset}, collapsed=${r.collapsed}`);
            }
            lines.push('', '===== Selection API =====', '  .rangeCount / .getRangeAt(i) / .addRange / .removeAllRanges / .removeRange / .collapse(node, offset) / .extend(node, offset)', '  .selectAllChildren(node) / .deleteFromDocument() / .toString() / .anchorNode / .anchorOffset / .focusNode / .focusOffset / .isCollapsed / .type');
            this.setState({ selectionInfo: lines.join('\n') });
            this._addLog('select', `读取选区：toString=${JSON.stringify(text).slice(0, 30)}，rangeCount=${sel.rangeCount}`);
        }
        catch (err) {
            this._addLog('warn', `读取选区失败：${err.name} - ${err.message}`);
        }
    }
    _surroundWithStrong() {
        const caps = this._detectCaps();
        if (!caps.selection || !caps.range) {
            this._addLog('warn', 'Selection / Range 不可用');
            return;
        }
        try {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
                this._addLog('warn', '无选区或选区已折叠，无法 surroundContents（请先在浏览器中选中文字）');
                this.setState({ selectionInfo: 'Range.surroundContents() 演示（需先选中文本）：\n\n' +
                        '  const sel = window.getSelection();\n  const range = sel.getRangeAt(0);\n' +
                        '  const strong = document.createElement("strong");\n  range.surroundContents(strong);  // 把选区内容包进 <strong>\n\n' +
                        '说明：surroundContents 要求选区不跨越部分选中的元素边界，否则抛 InvalidStateError。当前 jsdom 无真实选区（isCollapsed=true），请在浏览器中选中文字后点击。\n\n' +
                        '===== Range API 清单 =====\n' +
                        '  .setStart(node, offset) / .setEnd(node, offset) / .selectNode(node) / .selectNodeContents(node)\n' +
                        '  .collapse(toStart)  .cloneContents() → DocumentFragment（复制）  .extractContents() → DocumentFragment（移动）\n' +
                        '  .deleteContents() → 删除选区内容  .insertNode(node) → 在选区起点插入  .surroundContents(node) → 用 node 包裹选区\n' +
                        '  .getBoundingClientRect() / .getClientRects()' });
                return;
            }
            const range = sel.getRangeAt(0);
            const strong = document.createElement('strong');
            range.surroundContents(strong);
            this._addLog('select', `surroundContents(<strong>) 成功，包裹文本="${sel.toString().slice(0, 30)}"`);
            this.setState({ selectionInfo: `Range.surroundContents() 成功：\n  已把选区 "${sel.toString().slice(0, 30)}" 包裹进 <strong> 标签\n\n` +
                    '代码：\n  const range = sel.getRangeAt(0);\n  const strong = document.createElement("strong");\n  range.surroundContents(strong);' });
        }
        catch (err) {
            this._addLog('warn', `surroundContents 失败：${err.name} - ${err.message}（选区跨越元素边界会抛 InvalidStateError）`);
        }
    }
    _demoCreateRange() {
        const caps = this._detectCaps();
        if (!caps.createRange) {
            this._addLog('warn', 'document.createRange 不可用');
            return;
        }
        try {
            const range = document.createRange();
            const host = this.el && this.el.querySelector('[data-editable="card3-rich"]');
            let extractResult = '(无宿主)';
            if (host && host.firstChild) {
                range.selectNodeContents(host);
                const cloned = range.cloneContents();
                const extracted = range.extractContents();
                extractResult = `cloneContents=${cloned.childNodes.length} 节点，extractContents=${extracted.childNodes.length} 节点（已移动）`;
                // 还原：把 extract 的内容插回
                try {
                    range.insertNode(extracted);
                }
                catch { /* noop */ }
            }
            this.setState({ selectionInfo: 'document.createRange() 与 Range 操作演示：\n\n' +
                    `  const range = document.createRange() → ${range ? 'Range 实例 ✓' : 'null ✗'}\n` +
                    '  range.selectNodeContents(host) —— 选中宿主全部内容\n' +
                    '  range.cloneContents() —— 复制为 DocumentFragment（保留原内容）；range.extractContents() —— 移动为 DocumentFragment（原位置删除）\n' +
                    '  range.insertNode(node) —— 在 range 起点插入节点；range.deleteContents() —— 删除选区\n' +
                    '  range.surroundContents(node) —— 用节点包裹选区；range.collapse(toStart) —— 折叠\n\n' +
                    `本次结果：${extractResult}\n\n` +
                    '===== Selection 配合 Range =====\n' +
                    '  const sel = window.getSelection();\n' +
                    '  sel.removeAllRanges(); sel.addRange(range);  // 把 Range 设为当前选区\n  sel.deleteFromDocument();  // 删除选区内容' });
            this._addLog('select', `createRange 演示：${extractResult}`);
        }
        catch (err) {
            this._addLog('warn', `createRange 演示失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard5() {
        const s = this.state;
        const caps = this._detectCaps();
        const card = new Card({
            title: '5. Selection 与 Range 在编辑中的应用',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                { label: 'getSelection', ok: caps.selection },
                { label: 'createRange', ok: caps.createRange },
            ]), h(Tag, { color: 'primary' }, 'surroundContents')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'window.getSelection() 返回 Selection：.rangeCount / .getRangeAt(i) / .addRange / .removeAllRanges / .collapse(node, offset) / .extend / .selectAllChildren / .deleteFromDocument / .toString / .anchorNode / .focusNode / .isCollapsed / .type。document.createRange() 返回 Range：.setStart / .setEnd / .selectNode / .selectNodeContents / .collapse / .cloneContents / .extractContents / .deleteContents / .insertNode / .surroundContents / .getBoundingClientRect。selectionchange 事件（document 级）在选区变化时触发。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取选区', { type: 'primary', size: 'sm', disabled: !caps.selection, onClick: () => this._readSelection() }), this._btn('surroundContents <strong>', { size: 'sm', disabled: !caps.selection || !caps.range, onClick: () => this._surroundWithStrong() }), this._btn('createRange 演示', { size: 'sm', disabled: !caps.createRange, onClick: () => this._demoCreateRange() })),
                h('div', { class: 'fs-sm text-secondary' }, '提示：在上方 Card3 富文本区选中文字后点击「读取选区」或「surroundContents」。document 已监听 selectionchange 事件。'),
                h('div', { class: 'fs-sm text-secondary' }, 'Selection / Range 详情：'),
                h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.selectionInfo || '（点击「读取选区」或「surroundContents」）')),
                h(Alert, { type: 'info', message: 'selectionchange 是 document 级事件',
                    description: '选区变化（包括 contenteditable 内的选区）会触发 document 的 selectionchange 事件。本页已在 componentDidMount 中注册监听，选区非折叠时记录选区文本与 Range 偏移。surroundContents 要求选区不跨越部分选中的元素边界，否则抛 InvalidStateError，可改用 extractContents + insertNode 实现。' }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 6：自定义编辑命令与 beforeinput 拦截 ===================
    _dispatchPaste() {
        const caps = this._detectCaps();
        if (!caps.inputEvent) {
            this._addLog('warn', 'InputEvent 不可用，无法派发合成 paste 事件');
            return;
        }
        const target = (this.el && this.el.querySelector('[data-editable="card6"]')) || this._interceptEl;
        if (!target) {
            this._addLog('warn', '未找到 Card6 拦截宿主');
            return;
        }
        try {
            // 构造带 dataTransfer 的 InputEvent（模拟粘贴）
            let dataTransfer = null;
            try {
                dataTransfer = new DataTransfer();
            }
            catch { /* jsdom 可能无 DataTransfer */ }
            if (dataTransfer)
                dataTransfer.setData('text/plain', '<b>粗体</b> <script>alert(1)</script> 普通文本');
            const ev = new InputEvent('beforeinput', {
                inputType: 'insertFromPaste', data: null, dataTransfer, cancelable: true, bubbles: true,
            });
            target.dispatchEvent(ev);
            this._addLog('intercept', '已派发合成 insertFromPaste 事件，拦截器将净化并插入纯文本');
            if (!dataTransfer) {
                this.setState({ interceptInfo: '已派发合成 insertFromPaste（但 DataTransfer 不可用，dataTransfer=null）：\n' +
                        '  ev = new InputEvent("beforeinput", { inputType: "insertFromPaste", dataTransfer: null })\n' +
                        '  target.dispatchEvent(ev)\n\n' +
                        '说明：jsdom 可能无 DataTransfer 构造器，导致 dataTransfer 为 null。拦截器检测到 dataTransfer 为 null 时，净化结果为空字符串。\n' +
                        '  真实浏览器粘贴时，dataTransfer.getData("text/plain") 返回剪贴板纯文本。' });
            }
        }
        catch (err) {
            this._addLog('warn', `派发 insertFromPaste 失败：${err.name} - ${err.message}`);
        }
    }
    _showInterceptGuide() {
        this.setState({ interceptInfo: '===== beforeinput 拦截：现代自定义编辑方案 =====\n\n' +
                '原理：监听 beforeinput，检查 e.inputType，调用 e.preventDefault() 取消默认行为，\n' +
                '      然后用 e.getTargetRanges() 拿到将被影响的 StaticRange[]，手动应用自定义逻辑。\n\n' +
                '===== 典型用例 =====\n' +
                '  1. 自动补全：拦截 insertText，输入触发字符（@ / #）时弹出建议下拉\n' +
                '  2. @mention：拦截并显示用户列表，选中后插入链接\n' +
                '  3. emoji 选择器：拦截 : 触发 emoji 输入面板\n' +
                '  4. linkify：拦截空格输入，检测前一个词是否为 URL，自动转为链接\n' +
                '  5. 粘贴净化：拦截 insertFromPaste/insertFromDrop，从 dataTransfer 提取纯文本\n\n' +
                '===== 粘贴净化代码（本卡片实现）=====\n' +
                '  el.addEventListener("beforeinput", (e: any) => {\n' +
                '    if (e.inputType === "insertFromPaste" || e.inputType === "insertFromDrop") {\n' +
                '      const raw = e.dataTransfer.getData("text/plain") || "";\n' +
                '      const sanitized = raw.replace(/<[^>]*>/g, "").replace(/\\s+/g, " ").trim();\n' +
                '      e.preventDefault();  // 取消默认粘贴\n' +
                '      document.execCommand("insertText", false, sanitized);  // 插入净化后纯文本\n' +
                '    }\n  });\n\n' +
                '===== getTargetRanges / dataTransfer =====\n' +
                '  e.getTargetRanges() —— StaticRange[]（将被影响的范围），手动对其应用变更\n' +
                '  e.dataTransfer.getData("text/plain") —— 纯文本；getData("text/html") —— HTML（白名单过滤）\n' +
                '  e.dataTransfer.files —— 拖放的文件列表。合成事件可用 new DataTransfer() 构造并 setData。' });
        this._addLog('intercept', '已展示 beforeinput 拦截自定义编辑方案');
    }
    _renderCard6() {
        const s = this.state;
        const caps = this._detectCaps();
        const card = new Card({
            title: '6. 自定义编辑命令与 beforeinput 拦截',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([{ label: 'InputEvent', ok: caps.inputEvent }]), h(Tag, { color: 'primary' }, 'preventDefault + getTargetRanges')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '现代自定义编辑方案：监听 beforeinput，检查 e.inputType，调用 e.preventDefault() 取消默认，用 e.getTargetRanges() 拿到 StaticRange[] 手动应用变更。用例：自动补全、@mention、emoji 选择器、linkify、粘贴净化。e.dataTransfer.getData("text/plain"/"text/html") 读取粘贴/拖放内容，净化后插入。本卡片拦截 insertFromPaste，preventDefault 后用 execCommand("insertText") 插入净化纯文本。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('拦截方案说明', { type: 'primary', size: 'sm', onClick: () => this._showInterceptGuide() }), this._btn('派发 insertFromPaste', { size: 'sm', disabled: !caps.inputEvent, onClick: () => this._dispatchPaste() })),
                h('div', { class: 'fs-sm text-secondary' }, '拦截宿主（粘贴富文本将被净化为纯文本）：'),
                h('div', { contentEditable: 'true', class: 'demo-editable', dataset: { editable: 'card6' },
                    onbeforeinput: this._interceptBeforeInputHandler, style: DEMO_EDIT_STYLE }, '此区域已注册 beforeinput 拦截，粘贴内容会被净化'),
                h('div', { class: 'fs-sm text-secondary' }, '拦截详情：'),
                h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.interceptInfo || '（点击「拦截方案说明」或「派发 insertFromPaste」）')),
                h(Alert, { type: 'info', message: 'beforeinput + getTargetRanges 是现代编辑器的基础',
                    description: '相比已废弃的 execCommand，beforeinput 提供可取消的编辑意图（inputType + data + targetRanges），使自定义编辑器（ProseMirror / Slate / Lexical）能精确控制每次变更。preventDefault 后需手动应用变更（getTargetRanges 返回的 StaticRange[] 指示将受影响的范围）。' }),
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
        return h('div', { class: 'page api-lab-page editing-input-events-page' }, h('h2', { class: 'section-title' }, '编辑与输入事件深入 实验室'), h('p', { class: 'fs-sm text-secondary mb-md' }, '深入演示编辑与输入事件全家桶：InputEvent 与 beforeinput（inputType / getTargetRanges）、contentEditable / designMode、execCommand（已废弃）、UndoManager、Selection / Range、beforeinput 拦截自定义编辑。所有 API 调用前做 typeof 能力检测，jsdom 中 Selection/Range 可能返回 null，用 try/catch 保护。'), s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderLogPanel());
    }
}
//# sourceMappingURL=EditingInputEventsPage.js.map