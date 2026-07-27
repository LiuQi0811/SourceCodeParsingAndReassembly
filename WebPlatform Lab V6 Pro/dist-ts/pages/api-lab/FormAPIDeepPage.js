// =====================================================================
// FormAPIDeepPage.js —— 表单 API 深度实验室
// 演示 MDN：
//   1. formdata 事件与 FormDataEvent —— form.addEventListener('formdata')
//      / FormDataEvent.formData / vs 传统 submit + new FormData(form) /
//      e.formData.append/delete / form.requestSubmit() vs form.submit()
//   2. Constraint Validation API —— element.checkValidity /
//      reportValidity / setCustomValidity / validity (ValidityState) /
//      validationMessage / willValidate / 自定义错误提示 UI
//   3. HTMLInputElement.showPicker() —— 程序化弹出 date/time/color 选择器 /
//      用户手势要求 / 适用类型 / 浏览器支持检测
//   4. FormData API 完整接口 —— new FormData(form?) / append / set /
//      get / getAll / has / delete / entries / keys / values /
//      手动构造上传文件 + 多值字段处理
//   5. 原生表单组件 —— <datalist>+<input list> / <progress> / <meter> /
//      <output> (for / value / defaultValue) / 实时计算器
//   6. 表单提交现代模式 —— form.requestSubmit(submitter?) vs form.submit() /
//      submitter 参数影响 formAction/formMethod 等 / form.elements /
//      form.elements.namedItem(name) / JS 验证后 requestSubmit 走完整事件链
// 说明：jsdom 中 FormDataEvent/showPicker/requestSubmit/reportValidity 可能
//       未实现或行为不同，全部调用前做 typeof/in 检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class FormAPIDeepPage extends Page {
    _calcForm = null;
    _calcHandler = null;
    _formdataForm = null;
    _formdataHandler = null;
    _inited = false;
    _invalidHandler = null;
    _pickerInput = null;
    _submitForm = null;
    _submitFormHandler = null;
    _submitFormdataHandler = null;
    _submitHandler = null;
    _validationInput = null;
    // —— 初始 state ——
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            // Card 1：formdata 事件与 FormDataEvent
            formdataInfo: '',
            // Card 2：Constraint Validation API
            validationInfo: '',
            // Card 3：showPicker
            showPickerInfo: '',
            // Card 4：FormData API 完整接口
            formDataInfo: '',
            // Card 5：原生表单组件
            nativeFormInfo: '',
            // Card 6：表单提交现代模式
            submitInfo: '',
            // Card 9：field-sizing 表单自适应
            fieldSizingInfo: '',
        };
    }
    // —— 生命周期 ——
    componentDidMount() {
        // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
        if (this._inited)
            return;
        this._inited = true;
        // 一次性初始化各实例引用（componentWillUnmount 中释放）
        this._formdataForm = null; // Card 1 表单元素
        this._formdataHandler = null; // Card 1 formdata 事件处理器
        this._submitHandler = null; // Card 1 submit 事件处理器
        this._validationInput = null; // Card 2 验证目标 input
        this._invalidHandler = null; // Card 2 invalid 事件处理器
        this._pickerInput = null; // Card 3 showPicker 目标 input
        this._calcForm = null; // Card 5 计算器表单
        this._calcHandler = null; // Card 5 input 事件处理器
        this._submitForm = null; // Card 6 提交演示表单
        this._submitFormHandler = null; // Card 6 submit 事件处理器
        this._submitFormdataHandler = null; // Card 6 formdata 事件处理器
        // 一次性能力检测：六组 API 全家桶
        const hasFormdataEvent = typeof window !== 'undefined' && 'FormDataEvent' in window;
        const hasFormDataEventCtor = typeof window !== 'undefined' && typeof FormDataEvent !== 'undefined';
        const hasCheckValidity = typeof document !== 'undefined'
            && typeof document.createElement('input').checkValidity === 'function';
        const hasReportValidity = typeof document !== 'undefined'
            && typeof document.createElement('input').reportValidity === 'function';
        const hasShowPicker = typeof HTMLInputElement !== 'undefined'
            && typeof HTMLInputElement.prototype.showPicker === 'function';
        const hasFormData = typeof FormData !== 'undefined';
        const hasRequestSubmit = typeof HTMLFormElement !== 'undefined'
            && typeof HTMLFormElement.prototype.requestSubmit === 'function';
        const hasValidityState = typeof ValidityState !== 'undefined';
        const parts = [];
        parts.push(`FormDataEvent ${hasFormdataEvent ? '✓' : '✗'}`);
        parts.push(`checkValidity ${hasCheckValidity ? '✓' : '✗'}`);
        parts.push(`reportValidity ${hasReportValidity ? '✓' : '✗'}`);
        parts.push(`showPicker ${hasShowPicker ? '✓' : '✗'}`);
        parts.push(`FormData ${hasFormData ? '✓' : '✗'}`);
        parts.push(`requestSubmit ${hasRequestSubmit ? '✓' : '✗'}`);
        parts.push(`ValidityState ${hasValidityState ? '✓' : '✗'}`);
        const anySupported = hasFormdataEvent || hasCheckValidity || hasReportValidity
            || hasShowPicker || hasFormData || hasRequestSubmit || hasValidityState;
        const summary = anySupported
            ? `表单 API 能力检测：${parts.join(' · ')}。当前环境部分 API 可用，可点击对应卡片按钮进行真实演示；未实现的 API 仍可点击按钮但仅记日志说明，不会抛异常。`
            : `表单 API 能力检测：${parts.join(' · ')}。当前环境（jsdom/Node）上述 API 全部未实现或未完整，所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器（桌面 Chrome / Edge / Firefox）中打开可完整演示。`;
        this.setState({ capsSummary: summary });
        this._addLog(anySupported ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!hasFormdataEvent)
            this._addLog('warn', 'FormDataEvent 不可用（需 Chrome 77+ / Firefox 72+，jsdom 未实现）');
        if (!hasReportValidity)
            this._addLog('warn', 'reportValidity 不可用（jsdom 可能未实现原生提示）');
        if (!hasShowPicker)
            this._addLog('warn', 'showPicker 不可用（需 Chrome 99+，jsdom 未实现）');
        if (!hasRequestSubmit)
            this._addLog('warn', 'requestSubmit 不可用（jsdom 可能未实现）');
        if (!hasValidityState)
            this._addLog('warn', 'ValidityState 不可用（jsdom 可能未实现完整 validity 对象）');
        // Card 9：field-sizing 能力检测
        let hasFieldSizing = false;
        try {
            hasFieldSizing = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('field-sizing', 'content');
        }
        catch {
            hasFieldSizing = false;
        }
        if (!hasFieldSizing)
            this._addLog('warn', 'CSS field-sizing: content 不可用（Chrome 123+，jsdom 不识别）');
    }
    componentWillUnmount() {
        // 移除事件监听器并释放引用，便于 GC，每个调用包 try/catch
        if (this._formdataForm && this._formdataHandler) {
            try {
                this._formdataForm.removeEventListener('formdata', this._formdataHandler);
            }
            catch { /* noop */ }
        }
        if (this._formdataForm && this._submitHandler) {
            try {
                this._formdataForm.removeEventListener('submit', this._submitHandler);
            }
            catch { /* noop */ }
        }
        if (this._validationInput && this._invalidHandler) {
            try {
                this._validationInput.removeEventListener('invalid', this._invalidHandler);
            }
            catch { /* noop */ }
        }
        if (this._calcForm && this._calcHandler) {
            try {
                this._calcForm.removeEventListener('input', this._calcHandler);
            }
            catch { /* noop */ }
        }
        if (this._submitForm && this._submitFormHandler) {
            try {
                this._submitForm.removeEventListener('submit', this._submitFormHandler);
            }
            catch { /* noop */ }
        }
        if (this._submitForm && this._submitFormdataHandler) {
            try {
                this._submitForm.removeEventListener('formdata', this._submitFormdataHandler);
            }
            catch { /* noop */ }
        }
        // 重置表单状态
        const resetForm = (form) => {
            if (form) {
                try {
                    form.reset();
                }
                catch { /* noop */ }
            }
        };
        resetForm(this._formdataForm);
        resetForm(this._calcForm);
        resetForm(this._submitForm);
        this._formdataForm = null;
        this._formdataHandler = null;
        this._submitHandler = null;
        this._validationInput = null;
        this._invalidHandler = null;
        this._pickerInput = null;
        this._calcForm = null;
        this._calcHandler = null;
        this._submitForm = null;
        this._submitFormHandler = null;
        this._submitFormdataHandler = null;
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
        const hasDoc = typeof document !== 'undefined';
        let inputProtoCheckValidity = false;
        let inputProtoReportValidity = false;
        if (hasDoc) {
            try {
                const el = document.createElement('input');
                inputProtoCheckValidity = typeof el.checkValidity === 'function';
                inputProtoReportValidity = typeof el.reportValidity === 'function';
            }
            catch { /* noop */ }
        }
        return {
            formdataEvent: typeof window !== 'undefined' && 'FormDataEvent' in window,
            formDataEventCtor: typeof window !== 'undefined' && typeof FormDataEvent !== 'undefined',
            checkValidity: inputProtoCheckValidity,
            reportValidity: inputProtoReportValidity,
            showPicker: typeof HTMLInputElement !== 'undefined'
                && typeof HTMLInputElement.prototype.showPicker === 'function',
            formData: typeof FormData !== 'undefined',
            requestSubmit: typeof HTMLFormElement !== 'undefined'
                && typeof HTMLFormElement.prototype.requestSubmit === 'function',
            validityState: typeof ValidityState !== 'undefined',
            document: hasDoc,
            formEl: typeof HTMLFormElement !== 'undefined',
            fieldSizing: (() => { try {
                return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('field-sizing', 'content');
            }
            catch {
                return false;
            } })(),
        };
    }
    // =================== Card 1：formdata 事件与 FormDataEvent ===================
    // 构造演示用 form 并挂载到 document.body（jsdom 中可见）
    _ensureFormdataForm() {
        const caps = this._caps();
        if (!caps.document) {
            this._addLog('warn', 'document 不可用，无法构造演示表单');
            return null;
        }
        if (this._formdataForm)
            return this._formdataForm;
        try {
            const form = document.createElement('form');
            form.innerHTML =
                '<input name="username" value="alice">' +
                    '<input name="email" value="alice@example.com">' +
                    '<input type="hidden" name="token" value="abc123">';
            document.body.appendChild(form);
            this._formdataForm = form;
            this._addLog('info', '已创建演示 form 并挂载到 document.body（含 username/email/token 字段）');
            return form;
        }
        catch (err) {
            this._addLog('warn', `创建演示 form 失败：${err.name} - ${err.message}`);
            return null;
        }
    }
    // 注册 formdata 事件监听器，在事件中 append / delete 字段
    _listenFormdataEvent() {
        const caps = this._caps();
        if (!caps.formdataEvent) {
            this._addLog('warn', 'FormDataEvent / formdata 事件不可用（需 Chrome 77+ / Firefox 72+，jsdom 未实现）');
            this.setState({
                formdataInfo: `formdata 事件能力检测：'FormDataEvent' in window = ${caps.formdataEvent}\n` +
                    `typeof FormDataEvent = ${caps.formDataEventCtor ? 'function' : 'undefined'}\n` +
                    `说明：formdata 事件在表单提交时触发（submit 之后、FormData 构造后、提交前），\n` +
                    `      回调 e.formData 是可修改的 FormData 对象，可 append 追加字段或 delete 删除字段。\n` +
                    `      jsdom 未实现该事件，演示将记日志说明；真实浏览器中可用 'FormDataEvent' in window 检测。`,
            });
            return;
        }
        const form = this._ensureFormdataForm();
        if (!form)
            return;
        try {
            // 先清理旧监听器
            if (this._formdataHandler) {
                try {
                    form.removeEventListener('formdata', this._formdataHandler);
                }
                catch { /* noop */ }
            }
            const handler = (e) => {
                // e 是 FormDataEvent，e.formData 是可修改的 FormData 对象
                try {
                    e.formData.append('extra', 'appended-by-formdata-event');
                    e.formData.delete('token');
                    const entries = [];
                    for (const [k, v] of e.formData.entries()) {
                        entries.push(`${k}=${v}`);
                    }
                    this._addLog('formdata', `formdata 事件触发：append('extra', ...) + delete('token')，最终字段=[${entries.join(', ')}]`);
                }
                catch (err) {
                    this._addLog('warn', `formdata 回调内操作失败：${err.name} - ${err.message}`);
                }
            };
            form.addEventListener('formdata', handler);
            this._formdataHandler = handler;
            this.setState({
                formdataInfo: `form.addEventListener('formdata', handler) 已注册 ✓\n` +
                    `handler(e) { e.formData.append('extra', 'appended-by-formdata-event'); e.formData.delete('token'); }\n` +
                    `'FormDataEvent' in window = ${caps.formdataEvent}，typeof FormDataEvent = ${caps.formDataEventCtor ? 'function' : 'undefined'}\n` +
                    `说明：formdata 事件在表单提交时触发，e.formData 是可修改的 FormData 对象；\n` +
                    `      vs 传统 submit 事件 + new FormData(form)：formdata 事件在构造 FormData 后、提交前触发，\n` +
                    `      可直接 append/delete 字段而无需重新构造。点击「requestSubmit 触发」可激活事件链。`,
            });
            this._addLog('formdata', '已注册 formdata 事件监听器，回调内将 append extra / delete token');
        }
        catch (err) {
            this._addLog('warn', `注册 formdata 监听失败：${err.name} - ${err.message}`);
        }
    }
    // requestSubmit 触发表单事件链（submit → formdata → 提交）
    _triggerRequestSubmit() {
        const caps = this._caps();
        if (!caps.requestSubmit) {
            this._addLog('warn', 'form.requestSubmit 不可用（jsdom 可能未实现）');
            this.setState({
                formdataInfo: `form.requestSubmit() 能力检测：HTMLFormElement.prototype.requestSubmit = ${caps.requestSubmit ? 'function' : 'undefined'}\n` +
                    `说明：requestSubmit() 程序化触发表单提交，会走完整事件链（submit → formdata → 提交）；\n` +
                    `      vs form.submit() 不触发表单事件、不触发验证、不走 formdata 事件。\n` +
                    `      jsdom 未实现 requestSubmit，演示将记日志说明。`,
            });
            return;
        }
        const form = this._ensureFormdataForm();
        if (!form)
            return;
        // 先确保 submit 事件被 preventDefault（避免 jsdom 默认提交报错）
        if (!this._submitHandler) {
            try {
                this._submitHandler = (e) => {
                    e.preventDefault();
                    this._addLog('formdata', 'submit 事件触发并 preventDefault（阻止默认提交，仅观察事件链）');
                };
                form.addEventListener('submit', this._submitHandler);
            }
            catch { /* noop */ }
        }
        try {
            this._addLog('formdata', '调用 form.requestSubmit() 触发 submit → formdata → 提交 事件链');
            form.requestSubmit(); // 程序化提交（触发表单事件链）
            this.setState({
                formdataInfo: `form.requestSubmit() 已调用 ✓\n` +
                    `事件链：submit 事件 → formdata 事件（在此 append/delete 字段）→ 实际提交\n` +
                    `vs form.submit()：submit() 不触发 submit 事件、不触发验证、不走 formdata 事件\n` +
                    `submitter 参数：form.requestSubmit(submitter?) 可指定提交按钮，\n` +
                    `      影响 formAction / formMethod / formEnctype / formNoValidate / formTarget\n` +
                    `说明：requestSubmit 是现代提交模式，走完整事件链；submit() 是底层直接提交。`,
            });
        }
        catch (err) {
            this._addLog('warn', `requestSubmit 失败：${err.name} - ${err.message}`);
        }
    }
    // 用 form.submit() 对比：不触发任何事件
    _triggerRawSubmit() {
        const caps = this._caps();
        if (!caps.formEl) {
            this._addLog('warn', 'HTMLFormElement 不可用');
            return;
        }
        const form = this._ensureFormdataForm();
        if (!form)
            return;
        try {
            // form.submit() 直接提交，不触发 submit/formdata 事件，也不做验证
            // jsdom 中 submit() 通常无副作用（无网络层），仅记录调用
            this._addLog('formdata', '调用 form.submit()（底层提交，不触发 submit/formdata 事件、不验证）');
            this.setState({
                formdataInfo: `form.submit() 已调用（jsdom 中无网络层，通常无副作用）\n` +
                    `对比：form.submit() 是底层方法，直接提交表单，不触发 submit 事件、\n` +
                    `      不触发 formdata 事件、不做约束验证（即使有 required 字段也直接提交）。\n` +
                    `      适用于「确认无误后绕过验证直接提交」场景，但常规情况应优先用 requestSubmit()。\n` +
                    `form.requestSubmit 是否可用：${caps.requestSubmit ? '✓' : '✗（jsdom 未实现）'}`,
            });
        }
        catch (err) {
            this._addLog('warn', `form.submit() 失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard1() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '1. formdata 事件与 FormDataEvent',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.formdataEvent ? 'success' : 'error' }, caps.formdataEvent ? 'FormDataEvent ✓' : '不可用'), h(Tag, { color: 'primary' }, 'formdata / requestSubmit')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'formdata 事件在表单提交时触发（submit 之后、FormData 构造后、提交前）。回调接收 FormDataEvent，其 formData 属性返回可修改的 FormData 对象，可直接 append 追加字段或 delete 删除字段，无需重新构造。vs 传统 submit 事件 + new FormData(form)：formdata 事件让你在提交前最后一刻修改数据。form.requestSubmit() 程序化触发表单提交（走完整事件链 submit → formdata → 提交），vs form.submit() 不触发表单事件、不验证、不走 formdata 事件。浏览器支持 Chrome 77+ / Firefox 72+，用 "FormDataEvent" in window 检测。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('注册 formdata 监听', { type: 'primary', size: 'sm', onClick: () => this._listenFormdataEvent() }), this._btn('requestSubmit 触发', { type: 'primary', size: 'sm', disabled: !caps.requestSubmit, onClick: () => this._triggerRequestSubmit() }), this._btn('form.submit() 对比', { size: 'sm', onClick: () => this._triggerRawSubmit() })),
                h('div', { class: 'fs-sm text-secondary' }, 'formdata 事件状态：'),
                h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } }, h('code', {}, s.formdataInfo || '（点击「注册 formdata 监听」然后「requestSubmit 触发」测试）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '130px', overflow: 'auto' } }, h('code', {}, `form.addEventListener('formdata', (e: any) => {
  e.formData.append('extra', 'value');   // 追加字段
  e.formData.delete('token');             // 删除字段
});
form.requestSubmit();   // 触发 submit → formdata → 提交
// vs form.submit()：不触发 submit/formdata 事件、不验证
if ('FormDataEvent' in window) { /* 支持 formdata 事件 */ }`)),
                h(Alert, {
                    type: 'info',
                    message: 'formdata 事件 vs 传统 submit + new FormData(form)',
                    description: '传统方式：submit 事件回调里 new FormData(form) 拿到只读快照；formdata 事件：在提交前最后一刻拿到可修改的 FormData，append/delete 后的版本会进入实际提交。form.requestSubmit() 是现代提交入口，submit() 是绕过验证的底层方法。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 2：Constraint Validation API ===================
    // 构造验证目标 input（带 required + pattern）
    _ensureValidationInput() {
        const caps = this._caps();
        if (!caps.document) {
            this._addLog('warn', 'document 不可用，无法构造验证 input');
            return null;
        }
        if (this._validationInput)
            return this._validationInput;
        try {
            const input = document.createElement('input');
            input.type = 'email';
            input.required = true;
            input.pattern = '[^@]+@[^@]+\\.[^@]+';
            input.value = '';
            input.placeholder = '请输入邮箱（演示 required/pattern）';
            document.body.appendChild(input);
            this._validationInput = input;
            this._addLog('info', '已创建验证目标 input（type=email, required, pattern）');
            return input;
        }
        catch (err) {
            this._addLog('warn', `创建验证 input 失败：${err.name} - ${err.message}`);
            return null;
        }
    }
    // checkValidity() / reportValidity() / validity / validationMessage / willValidate
    _runCheckValidity() {
        const caps = this._caps();
        if (!caps.checkValidity) {
            this._addLog('warn', 'element.checkValidity 不可用（jsdom 可能未实现）');
            this.setState({
                validationInfo: `checkValidity 能力检测：input.checkValidity = ${caps.checkValidity ? 'function' : 'undefined'}\n` +
                    `说明：checkValidity() 返回 boolean，触发 invalid 事件（不阻塞）；\n` +
                    `      reportValidity() 返回 boolean 并显示浏览器原生错误提示；\n` +
                    `      validity 返回 ValidityState 对象（valueMissing/typeMismatch/patternMismatch/...）。\n` +
                    `      jsdom 中可能未实现，演示将记日志说明。`,
            });
            return;
        }
        const input = this._ensureValidationInput();
        if (!input)
            return;
        try {
            // 先清空触发 required 失败
            input.value = '';
            const r1 = input.checkValidity(); // 返回 boolean，触发 invalid 事件（不阻塞）
            const msg1 = input.validationMessage;
            const willValidate = input.willValidate;
            let validityDump1 = '(validity 不可用)';
            if (caps.validityState && input.validity) {
                const v = input.validity;
                validityDump1 =
                    `valueMissing=${v.valueMissing}, typeMismatch=${v.typeMismatch}, ` +
                        `patternMismatch=${v.patternMismatch}, tooLong=${v.tooLong}, tooShort=${v.tooShort}, ` +
                        `rangeUnderflow=${v.rangeUnderflow}, rangeOverflow=${v.rangeOverflow}, ` +
                        `stepMismatch=${v.stepMismatch}, badInput=${v.badInput}, ` +
                        `customError=${v.customError}, valid=${v.valid}`;
            }
            // 再填入非法值（不匹配 pattern）
            input.value = 'not-an-email';
            const r2 = input.checkValidity();
            const msg2 = input.validationMessage;
            let validityDump2 = '(validity 不可用)';
            if (caps.validityState && input.validity) {
                const v = input.validity;
                validityDump2 = `valid=${v.valid}, typeMismatch=${v.typeMismatch}, patternMismatch=${v.patternMismatch}`;
            }
            // 最后填入合法值
            input.value = 'alice@example.com';
            const r3 = input.checkValidity();
            const msg3 = input.validationMessage;
            let validityDump3 = '(validity 不可用)';
            if (caps.validityState && input.validity) {
                validityDump3 = `valid=${input.validity.valid}`;
            }
            this.setState({
                validationInfo: `element.checkValidity() 演示 ✓\n` +
                    `willValidate = ${willValidate}（是否参与验证）\n\n` +
                    `① 空值（required 失败）：\n` +
                    `  checkValidity() = ${r1}，validationMessage = "${msg1}"\n` +
                    `  validity: ${validityDump1}\n\n` +
                    `② 非法值 "not-an-email"（pattern 失败）：\n` +
                    `  checkValidity() = ${r2}，validationMessage = "${msg2}"\n` +
                    `  validity: ${validityDump2}\n\n` +
                    `③ 合法值 "alice@example.com"：\n` +
                    `  checkValidity() = ${r3}，validationMessage = "${msg3}"\n` +
                    `  validity: ${validityDump3}\n\n` +
                    `说明：checkValidity 返回 boolean 并触发 invalid 事件（不显示原生提示）；\n` +
                    `      reportValidity 同样返回 boolean 但会显示浏览器原生错误提示；\n` +
                    `      validity 是 ValidityState 对象，含 valueMissing/typeMismatch/patternMismatch 等 11 个属性。`,
            });
            this._addLog('valid', `checkValidity 演示：空=${r1}, 非法=${r2}, 合法=${r3}，willValidate=${willValidate}`);
        }
        catch (err) {
            this._addLog('warn', `checkValidity 演示失败：${err.name} - ${err.message}`);
        }
    }
    // reportValidity() 显示原生错误提示
    _runReportValidity() {
        const caps = this._caps();
        if (!caps.reportValidity) {
            this._addLog('warn', 'element.reportValidity 不可用（jsdom 可能未实现原生提示）');
            return;
        }
        const input = this._ensureValidationInput();
        if (!input)
            return;
        try {
            input.value = 'bad-value';
            const r = input.reportValidity(); // 返回 boolean + 显示原生提示
            const msg = input.validationMessage;
            this.setState({
                validationInfo: `element.reportValidity() 演示 ✓\n` +
                    `input.value = "bad-value"（非法）\n` +
                    `reportValidity() = ${r}（false 表示验证失败）\n` +
                    `validationMessage = "${msg}"\n` +
                    `说明：reportValidity 与 checkValidity 都返回 boolean 并触发 invalid 事件，\n` +
                    `      区别：reportValidity 还会显示浏览器原生错误提示（气泡 UI）；\n` +
                    `      checkValidity 仅返回结果不显示提示。jsdom 中无 UI 层，效果同 checkValidity。`,
            });
            this._addLog('valid', `reportValidity 演示：返回 ${r}，msg="${msg}"`);
        }
        catch (err) {
            this._addLog('warn', `reportValidity 演示失败：${err.name} - ${err.message}`);
        }
    }
    // setCustomValidity(msg) 设置自定义错误消息（空串清除）
    _runSetCustomValidity() {
        const caps = this._caps();
        if (!caps.checkValidity) {
            this._addLog('warn', 'element.setCustomValidity 依赖 checkValidity，当前不可用');
            return;
        }
        const input = this._ensureValidationInput();
        if (!input)
            return;
        try {
            input.value = 'alice@example.com'; // 合法值
            input.setCustomValidity(''); // 先清除
            const beforeValid = input.checkValidity();
            const beforeMsg = input.validationMessage;
            input.setCustomValidity('此邮箱已被注册'); // 设置自定义错误
            const afterValid = input.checkValidity();
            const afterMsg = input.validationMessage;
            let customErrorFlag = '(validity 不可用)';
            if (caps.validityState && input.validity) {
                customErrorFlag = `customError=${input.validity.customError}, valid=${input.validity.valid}`;
            }
            input.setCustomValidity(''); // 清除（空串）
            const clearedValid = input.checkValidity();
            this.setState({
                validationInfo: `element.setCustomValidity(msg) 演示 ✓\n` +
                    `① 合法值 + setCustomValidity('')：checkValidity=${beforeValid}, msg="${beforeMsg}"\n` +
                    `② setCustomValidity('此邮箱已被注册')：checkValidity=${afterValid}, msg="${afterMsg}"\n` +
                    `   validity: ${customErrorFlag}\n` +
                    `③ setCustomValidity('') 清除：checkValidity=${clearedValid}\n\n` +
                    `说明：setCustomValidity(msg) 设置自定义错误消息（非空串则 customError=true, valid=false）；\n` +
                    `      setCustomValidity('') 空串清除自定义错误。常用于异步验证（如服务端查重）后提示。`,
            });
            this._addLog('valid', `setCustomValidity 演示：自定义后 valid=${afterValid}, 清除后 valid=${clearedValid}`);
        }
        catch (err) {
            this._addLog('warn', `setCustomValidity 演示失败：${err.name} - ${err.message}`);
        }
    }
    // 自定义错误提示 UI：监听 invalid 事件 + preventDefault + 自定义显示
    _runCustomInvalidUI() {
        const caps = this._caps();
        if (!caps.document) {
            this._addLog('warn', 'document 不可用');
            return;
        }
        const input = this._ensureValidationInput();
        if (!input)
            return;
        try {
            // 先清理旧监听器
            if (this._invalidHandler) {
                try {
                    input.removeEventListener('invalid', this._invalidHandler);
                }
                catch { /* noop */ }
            }
            const handler = (e) => {
                // preventDefault 阻止浏览器原生提示，改用自定义 UI
                e.preventDefault();
                const msg = input.validationMessage || '（验证失败）';
                this._addLog('valid', `invalid 事件触发并 preventDefault，自定义显示错误："${msg}"`);
            };
            input.addEventListener('invalid', handler);
            this._invalidHandler = handler;
            // 触发一次验证以激活 invalid 事件
            input.value = '';
            let triggered = false;
            try {
                const r = input.checkValidity();
                triggered = true;
                this._addLog('valid', `checkValidity 触发 invalid 事件（返回 ${r}）`);
            }
            catch (err) {
                this._addLog('warn', `触发 invalid 失败：${err.message}`);
            }
            this.setState({
                validationInfo: `自定义错误提示 UI 演示 ✓\n` +
                    `input.addEventListener('invalid', e => { e.preventDefault(); /* 自定义显示 */ })\n` +
                    `已注册 invalid 监听器，checkValidity 触发后回调被调用：${triggered ? '✓' : '✗'}\n\n` +
                    `说明：监听 invalid 事件 + preventDefault 可阻止浏览器原生提示，\n` +
                    `      转而用自定义 UI（如红框 + 文字）显示 validationMessage。\n` +
                    `      适合需要统一错误样式、做国际化或自定义动画的场景。\n` +
                    `      注意：preventDefault 仅阻止提示显示，不影响 checkValidity 返回值。`,
            });
        }
        catch (err) {
            this._addLog('warn', `自定义 invalid UI 演示失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard2() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '2. Constraint Validation API（约束验证 API）',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.checkValidity ? 'success' : 'error' }, caps.checkValidity ? 'checkValidity ✓' : '不可用'), h(Tag, { color: caps.reportValidity ? 'success' : 'warning' }, caps.reportValidity ? 'reportValidity ✓' : 'report ✗'), h(Tag, { color: caps.validityState ? 'success' : 'error' }, caps.validityState ? 'ValidityState ✓' : 'ValidityState ✗')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'Constraint Validation API 提供表单约束验证能力。element.checkValidity() 返回 boolean 并触发 invalid 事件（不显示提示）；element.reportValidity() 同样返回 boolean 但会显示浏览器原生错误提示；element.setCustomValidity(msg) 设置自定义错误消息（空串清除，customError=true 时 valid=false）；element.validity 返回 ValidityState 对象，含 valueMissing / typeMismatch / patternMismatch / tooLong / tooShort / rangeUnderflow / rangeOverflow / stepMismatch / badInput / customError / valid 共 11 个属性；element.validationMessage 返回当前错误消息字符串；element.willValidate 表示是否参与验证。监听 invalid 事件 + preventDefault 可自定义错误提示 UI。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('checkValidity + validity', { type: 'primary', size: 'sm', disabled: !caps.checkValidity, onClick: () => this._runCheckValidity() }), this._btn('reportValidity', { type: 'primary', size: 'sm', disabled: !caps.reportValidity, onClick: () => this._runReportValidity() }), this._btn('setCustomValidity', { size: 'sm', disabled: !caps.checkValidity, onClick: () => this._runSetCustomValidity() }), this._btn('自定义 invalid UI', { size: 'sm', disabled: !caps.checkValidity, onClick: () => this._runCustomInvalidUI() })),
                h('div', { class: 'fs-sm text-secondary' }, 'Validation 状态：'),
                h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } }, h('code', {}, s.validationInfo || '（点击「checkValidity + validity」开始）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '130px', overflow: 'auto' } }, h('code', {}, `input.addEventListener('invalid', (e: any) => {
  e.preventDefault();                      // 阻止原生提示
  showErrorUI(input.validationMessage);    // 自定义显示
});
if (!input.checkValidity()) { /* 验证失败 */ }
input.setCustomValidity('此邮箱已被注册');   // 异步验证后设置
input.setCustomValidity('');               // 清除（空串）
// validity 对象：valueMissing / typeMismatch / patternMismatch / valid ...`)),
                h(Alert, {
                    type: 'info',
                    message: 'checkValidity 与 reportValidity 的区别',
                    description: '两者都返回 boolean 并触发 invalid 事件；区别是 reportValidity 还会显示浏览器原生错误提示（气泡 UI），checkValidity 仅返回结果不显示提示。jsdom 无 UI 层，两者效果相同。setCustomValidity 设置自定义消息后，validationMessage 会返回该消息直到用空串清除。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 3：HTMLInputElement.showPicker() ===================
    // 构造 showPicker 演示 input（type=color）
    _ensurePickerInput() {
        const caps = this._caps();
        if (!caps.document) {
            this._addLog('warn', 'document 不可用，无法构造 picker input');
            return null;
        }
        if (this._pickerInput)
            return this._pickerInput;
        try {
            const input = document.createElement('input');
            input.type = 'color';
            input.value = '#3a7bd5';
            document.body.appendChild(input);
            this._pickerInput = input;
            this._addLog('info', '已创建 picker 演示 input（type=color）');
            return input;
        }
        catch (err) {
            this._addLog('warn', `创建 picker input 失败：${err.name} - ${err.message}`);
            return null;
        }
    }
    // input.showPicker() 程序化弹出选择器（必须在用户手势中调用）
    _callShowPicker() {
        const caps = this._caps();
        if (!caps.showPicker) {
            this._addLog('warn', 'HTMLInputElement.prototype.showPicker 不可用（需 Chrome 99+，jsdom 未实现）');
            this.setState({
                showPickerInfo: `showPicker 能力检测：'showPicker' in HTMLInputElement.prototype = ${caps.showPicker}\n` +
                    `说明：input.showPicker() 程序化弹出 date/time/color/month/week 选择器，\n` +
                    `      必须在用户手势（click 等）中调用，否则抛 DOMException（InvalidStateError 或 SecurityError）。\n` +
                    `      适用类型：date / month / week / time / datetime-local / color / file / range。\n` +
                    `      浏览器支持：Chrome 99+，用 'showPicker' in HTMLInputElement.prototype 检测。\n` +
                    `      jsdom 未实现，演示将记日志说明。`,
            });
            return;
        }
        const input = this._ensurePickerInput();
        if (!input)
            return;
        try {
            // 注意：showPicker 必须在用户手势中调用，按钮 onClick 是用户手势上下文
            input.showPicker();
            this.setState({
                showPickerInfo: `input.showPicker() 已调用 ✓\n` +
                    `input.type = "${input.type}"，input.value = "${input.value}"\n` +
                    `说明：showPicker() 程序化弹出选择器，必须在用户手势（click 等）中调用，\n` +
                    `      否则抛 DOMException（SecurityError）。适用类型：date/month/week/time/datetime-local/color/file/range。\n` +
                    `      vs 点击 input 原生弹出：showPicker 可在其他元素点击时触发选择器，\n` +
                    `      例如点击按钮弹出另一处 input 的颜色选择器。`,
            });
            this._addLog('picker', `showPicker() 调用成功，type=${input.type}`);
        }
        catch (err) {
            this._addLog('warn', `showPicker 失败：${err.name} - ${err.message}（可能非用户手势或类型不支持）`);
            this.setState({
                showPickerInfo: `input.showPicker() 抛出：${err.name} - ${err.message}\n` +
                    `说明：showPicker 必须在用户手势（click 等）中调用，\n` +
                    `      非手势调用抛 SecurityError；类型不匹配抛 NotSupportedError；\n` +
                    `      input 不可见或禁用抛 InvalidStateError。`,
            });
        }
    }
    // 检测各类型是否支持 showPicker
    _detectPickerTypes() {
        const caps = this._caps();
        if (!caps.document) {
            this._addLog('warn', 'document 不可用');
            return;
        }
        try {
            const types = ['date', 'month', 'week', 'time', 'datetime-local', 'color', 'file', 'range', 'text', 'email'];
            const lines = [`'showPicker' in HTMLInputElement.prototype = ${caps.showPicker}`];
            lines.push('各类型 input 是否支持 showPicker（通过 typeof input.showPicker === "function" 检测）：');
            for (const t of types) {
                try {
                    const el = document.createElement('input');
                    el.type = t;
                    const supported = caps.showPicker && typeof el.showPicker === 'function';
                    lines.push(`  type="${t.padEnd(15)}" supported=${supported}`);
                }
                catch (e) {
                    lines.push(`  type="${t}" 检测失败：${e.message}`);
                }
            }
            lines.push('');
            lines.push('说明：showPicker 适用类型：date / month / week / time / datetime-local / color / file / range；');
            lines.push('      text/email 等文本类型不支持（无原生选择器）。');
            lines.push('      浏览器支持：Chrome 99+，Firefox/Safari 部分支持或未实现。');
            this.setState({ showPickerInfo: lines.join('\n') });
            this._addLog('picker', `检测 ${types.length} 种 input 类型的 showPicker 支持（整体支持：${caps.showPicker}）`);
        }
        catch (err) {
            this._addLog('warn', `类型检测失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard3() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '3. HTMLInputElement.showPicker()（程序化弹出选择器）',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.showPicker ? 'success' : 'error' }, caps.showPicker ? 'showPicker ✓' : '不可用'), h(Tag, { color: 'primary' }, 'Chrome 99+')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'HTMLInputElement.showPicker() 程序化弹出 date / time / color / month / week / datetime-local / file / range 类型 input 的原生选择器。必须在用户手势（click 等）中调用，否则抛 DOMException（SecurityError）。vs 点击 input 原生弹出：showPicker 可在其他元素点击时触发选择器（如点按钮弹另一处 input 的颜色选择器）。浏览器支持 Chrome 99+，用 "showPicker" in HTMLInputElement.prototype 检测。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('showPicker() 弹出', { type: 'primary', size: 'sm', disabled: !caps.showPicker, onClick: () => this._callShowPicker() }), this._btn('检测各类型支持', { size: 'sm', onClick: () => this._detectPickerTypes() })),
                h('div', { class: 'fs-sm text-secondary' }, 'showPicker 状态：'),
                h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } }, h('code', {}, s.showPickerInfo || '（点击「showPicker() 弹出」或「检测各类型支持」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '120px', overflow: 'auto' } }, h('code', {}, `const colorInput = document.querySelector('input[type=color]');
button.addEventListener('click', () => {
  colorInput.showPicker();   // 用户手势中调用，弹出颜色选择器
});
if ('showPicker' in HTMLInputElement.prototype) { /* 支持 */ }
// 非用户手势调用抛 SecurityError；类型不匹配抛 NotSupportedError`)),
                h(Alert, {
                    type: 'warning',
                    message: 'showPicker 必须在用户手势中调用',
                    description: '由于安全考虑，showPicker() 必须在用户手势（click、keydown 等）触发的同步调用栈中执行，否则抛 SecurityError。这避免了页面在用户不知情时弹出选择器。jsdom 未实现该 API，typeof input.showPicker === "undefined"。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 4：FormData API 完整接口 ===================
    // 演示 FormData 完整接口：构造 / append / set / get / getAll / has / delete / entries / keys / values
    _demoFormDataBasics() {
        const caps = this._caps();
        if (!caps.formData) {
            this._addLog('warn', 'FormData 不可用（typeof FormData === "undefined"）');
            this.setState({
                formDataInfo: `FormData 能力检测：typeof FormData = ${caps.formData ? 'function' : 'undefined'}\n` +
                    `说明：FormData API 通常在 jsdom 中可用，若不可用则演示将记日志说明。\n` +
                    `      FormData 提供 append/set/get/getAll/has/delete/entries/keys/values 方法。`,
            });
            return;
        }
        try {
            // ① 不传 form 构造空 FormData
            const fd = new FormData();
            fd.append('name', 'alice');
            fd.append('name', 'bob'); // 同名多值
            fd.append('age', '30');
            fd.set('age', '31'); // set 覆盖同名
            const getFirst = fd.get('name'); // get 取第一个
            const getAll = fd.getAll('name'); // getAll 取全部
            const hasName = fd.has('name');
            const hasXyz = fd.has('xyz');
            // entries / keys / values 迭代
            const entriesArr = Array.from(fd.entries());
            const keysArr = Array.from(fd.keys());
            const valuesArr = Array.from(fd.values());
            // delete
            fd.delete('age');
            const afterDelete = fd.has('age');
            this.setState({
                formDataInfo: `FormData API 完整接口演示 ✓\n\n` +
                    `① new FormData()（无参构造空 FormData）\n` +
                    `② fd.append('name', 'alice') + fd.append('name', 'bob')（同名多值）\n` +
                    `③ fd.set('age', '30') + fd.set('age', '31')（set 覆盖同名）\n\n` +
                    `fd.get('name') = "${getFirst}"（get 取第一个）\n` +
                    `fd.getAll('name') = ${JSON.stringify(getAll)}（getAll 取全部）\n` +
                    `fd.has('name') = ${hasName}，fd.has('xyz') = ${hasXyz}\n\n` +
                    `(fd as any).entries() → ${JSON.stringify(entriesArr)}\n` +
                    `(fd as any).keys() → ${JSON.stringify(keysArr)}\n` +
                    `(fd as any).values() → ${JSON.stringify(valuesArr)}\n\n` +
                    `fd.delete('age') 后 fd.has('age') = ${afterDelete}\n\n` +
                    `说明：append 同名追加（多值），set 同名覆盖；get 取第一个，getAll 取全部；\n` +
                    `      has 检查存在，delete 删除；entries/keys/values 返回迭代器（用 Array.from 转数组）。`,
            });
            this._addLog('formdata', `FormData 基础演示：get=${getFirst}, getAll 长度=${getAll.length}, delete 后 has=${afterDelete}`);
        }
        catch (err) {
            this._addLog('warn', `FormData 基础演示失败：${err.name} - ${err.message}`);
        }
    }
    // 用 form 元素构造 FormData（自动提取字段）
    _demoFormDataFromForm() {
        const caps = this._caps();
        if (!caps.formData) {
            this._addLog('warn', 'FormData 不可用');
            return;
        }
        if (!caps.document) {
            this._addLog('warn', 'document 不可用');
            return;
        }
        try {
            // 构造含字段的 form
            const form = document.createElement('form');
            form.innerHTML =
                '<input name="username" value="alice">' +
                    '<input name="email" value="alice@example.com">' +
                    '<input type="checkbox" name="hobby" value="reading" checked>' +
                    '<input type="checkbox" name="hobby" value="coding" checked>' +
                    '<input type="checkbox" name="hobby" value="music">' +
                    '<select name="city"><option value="sh" selected>上海</option><option value="bj">北京</option></select>';
            const fd = new FormData(form); // 传 form 自动提取字段
            const entries = Array.from(fd.entries());
            const hobbyAll = fd.getAll('hobby'); // 多值字段（checked 的 checkbox）
            this.setState({
                formDataInfo: `new FormData(form) 演示 ✓（传 form 自动提取字段）\n` +
                    `form 含：username / email / hobby(checkbox ×3, 2 个 checked) / city(select)\n\n` +
                    `(FormData as any).entries() 输出：\n${entries.map((([k, v]) => `  ${k} = ${v}`)).join('\n')}\n\n` +
                    `fd.getAll('hobby') = ${JSON.stringify(hobbyAll)}（仅 checked 的 checkbox 被提取）\n\n` +
                    `说明：new FormData(form) 自动提取所有命名控件（input/select/textarea）的值；\n` +
                    `      checkbox 仅提取 checked 的；radio 仅提取选中的；button 不提取；\n` +
                    `      file 类型提取为 File 对象（无选中则为空）。`,
            });
            this._addLog('formdata', `FormData(form) 演示：提取 ${entries.length} 个字段，hobby 多值长度=${hobbyAll.length}`);
        }
        catch (err) {
            this._addLog('warn', `FormData(form) 演示失败：${err.name} - ${err.message}`);
        }
    }
    // 手动构造 FormData 上传文件 + 多值字段处理
    _demoFormDataFileUpload() {
        const caps = this._caps();
        if (!caps.formData) {
            this._addLog('warn', 'FormData 不可用，无法演示文件上传构造');
            return;
        }
        try {
            // 构造模拟文件（Blob 代替 File，FormData.append 接受 Blob）
            const fileContent = '模拟文件内容：Hello FormData 文件上传演示';
            const blob = new Blob([fileContent], { type: 'text/plain' });
            const fd = new FormData();
            // append(name, value) / append(name, blob, filename)
            fd.append('title', '我的文件标题');
            fd.append('tags', 'js');
            fd.append('tags', 'formdata'); // 多值字段
            fd.append('tags', 'upload');
            fd.append('file', blob, 'demo.txt'); // 文件字段（blob + filename）
            // 读取文件字段
            const fileEntry = fd.get('file');
            const fileName = fileEntry && typeof fileEntry.name === 'string' ? fileEntry.name : '(无 name 属性)';
            const fileType = fileEntry && typeof fileEntry.type === 'string' ? fileEntry.type : '(无 type)';
            const fileSize = fileEntry && typeof fileEntry.size === 'number' ? fileEntry.size : '(无 size)';
            const tagsAll = fd.getAll('tags');
            const keysArr = Array.from(fd.keys());
            // FormData 没有 size 属性，但可用 entries 遍历计数
            let count = 0;
            for (const _ of fd.entries())
                count++; // eslint-disable-line no-unused-vars
            this.setState({
                formDataInfo: `手动构造 FormData 上传文件演示 ✓\n\n` +
                    `① new Blob([content], { type: 'text/plain' }) 构造模拟文件\n` +
                    `② fd.append('title', '我的文件标题')（普通字段）\n` +
                    `③ fd.append('tags', 'js') + ('tags', 'formdata') + ('tags', 'upload')（多值字段）\n` +
                    `④ fd.append('file', blob, 'demo.txt')（文件字段，blob + filename）\n\n` +
                    `fd.get('file') → ${fileEntry ? fileEntry.constructor.name : 'null'}\n` +
                    `  name = "${fileName}"，type = "${fileType}"，size = ${fileSize}\n` +
                    `fd.getAll('tags') = ${JSON.stringify(tagsAll)}（多值字段）\n` +
                    `(fd as any).keys() = ${JSON.stringify(keysArr)}\n` +
                    `FormData 字段总数（遍历 entries 计数）= ${count}\n\n` +
                    `说明：append(name, blob, filename) 用于上传文件（也可用 File 对象）；\n` +
                    `      FormData 没有 size 属性，需遍历 entries 计数；\n` +
                    `      fetch('/api', { method: 'POST', body: fd }) 会自动设置 multipart/form-data Content-Type。`,
            });
            this._addLog('formdata', `文件上传 FormData 构造：tags 长度=${tagsAll.length}, file size=${fileSize}, 字段总数=${count}`);
        }
        catch (err) {
            this._addLog('warn', `FormData 文件上传演示失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard4() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '4. FormData API 完整接口',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.formData ? 'success' : 'error' }, caps.formData ? 'FormData ✓' : '不可用'), h(Tag, { color: 'primary' }, 'append / set / get / entries')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'FormData API 表示表单数据键值对。new FormData(form?) 构造，传 form 元素则自动提取所有命名控件字段（checkbox 仅 checked、radio 仅选中、file 为 File 对象）。append(name, value) / append(name, blob, filename) 追加（同名多值）；set(name, value) 设置（覆盖同名）；get(name) 取第一个 / getAll(name) 取全部；has(name) 检查存在 / delete(name) 删除；entries() / keys() / values() 返回迭代器。FormData 没有 size 属性，需遍历 entries 计数。手动构造 FormData 可用于 fetch 上传文件（body: fd 自动设 multipart/form-data）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('基础接口演示', { type: 'primary', size: 'sm', disabled: !caps.formData, onClick: () => this._demoFormDataBasics() }), this._btn('new FormData(form)', { type: 'primary', size: 'sm', disabled: !caps.formData, onClick: () => this._demoFormDataFromForm() }), this._btn('手动构造上传文件', { size: 'sm', disabled: !caps.formData, onClick: () => this._demoFormDataFileUpload() })),
                h('div', { class: 'fs-sm text-secondary' }, 'FormData 状态：'),
                h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } }, h('code', {}, s.formDataInfo || '（点击「基础接口演示」开始）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '130px', overflow: 'auto' } }, h('code', {}, `const fd = new FormData(form);              // 自动提取字段
fd.append('tags', 'js'); fd.append('tags', 'web');  // 同名多值
fd.getAll('tags');                          // ['js', 'web']
fd.set('title', '新标题');                  // 覆盖同名
fd.append('file', blob, 'demo.txt');        // 文件字段
fetch('/api', { method: 'POST', body: fd }); // 自动 multipart/form-data
for (const [k, v] of (fd as any).entries()) { /* 遍历 */ }`)),
                h(Alert, {
                    type: 'info',
                    message: 'FormData 没有 size 属性',
                    description: '与 Map/Set 不同，FormData 没有 size 属性。若需统计字段数，用 Array.from((fd as any).entries()).length 或遍历计数。append 同名追加多值，set 同名覆盖；get 取第一个，getAll 取全部。fetch 以 FormData 为 body 时浏览器自动设置 Content-Type: multipart/form-data; boundary=...，无需手动设置。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 5：原生表单组件（datalist/progress/meter/output）===================
    // 演示 datalist / progress / meter / output 元素的属性与行为
    _demoNativeComponents() {
        const caps = this._caps();
        if (!caps.document) {
            this._addLog('warn', 'document 不可用，无法演示原生表单组件');
            return;
        }
        try {
            const lines = ['原生表单组件属性检测：'];
            // ① datalist + input list
            try {
                const dl = document.createElement('datalist');
                dl.id = 'fruits';
                dl.innerHTML = '<option value="apple"><option value="banana"><option value="cherry">';
                const input = document.createElement('input');
                input.setAttribute('list', 'fruits');
                const hasList = input.list !== undefined;
                const listAttr = input.getAttribute('list');
                lines.push(`① <datalist id="fruits"> + <input list="fruits">：input.list 属性存在=${hasList}，list 属性值="${listAttr}"`);
                lines.push(`   option 数量=${dl.options ? dl.options.length : '(无 options 集合)'}，原生自动补全无需 JS 库`);
            }
            catch (e) {
                lines.push(`① datalist 检测失败：${e.message}`);
            }
            // ② progress
            try {
                const prog = document.createElement('progress');
                prog.value = 0.7;
                prog.max = 1;
                const pos = prog.position; // value/max 比例
                lines.push(`② <progress value="0.7" max="1">：value=${prog.value}, max=${prog.max}, position=${pos}`);
                lines.push(`   position = value / max（无 value 时为 -1，表示不确定进度）；含可访问性语义（role=progressbar）`);
            }
            catch (e) {
                lines.push(`② progress 检测失败：${e.message}`);
            }
            // ③ meter
            try {
                const meter = document.createElement('meter');
                meter.value = 0.3;
                meter.min = 0;
                meter.max = 1;
                meter.low = 0.4;
                meter.high = 0.6;
                meter.optimum = 0.2;
                lines.push(`③ <meter value="0.3" min="0" max="1" low="0.4" high="0.6" optimum="0.2">：`);
                lines.push(`   value=${meter.value}, min=${meter.min}, max=${meter.max}, low=${meter.low}, high=${meter.high}, optimum=${meter.optimum}`);
                lines.push(`   low/high/optimum 决定颜色：value 在 optimum 区间为绿色，靠近 high/low 为黄色，超出为红色`);
            }
            catch (e) {
                lines.push(`③ meter 检测失败：${e.message}`);
            }
            // ④ output
            try {
                const out = document.createElement('output');
                out.setAttribute('for', 'a b');
                out.defaultValue = '0';
                out.value = '42';
                const hasFor = out.hasAttribute('for');
                const forVal = out.getAttribute('for');
                lines.push(`④ <output for="a b">：hasAttribute('for')=${hasFor}, for="${forVal}", value="${out.value}", defaultValue="${out.defaultValue}"`);
                lines.push(`   value 设置当前结果，defaultValue 是初始值；for 关联输入 id（空格分隔），用于语义关联`);
            }
            catch (e) {
                lines.push(`④ output 检测失败：${e.message}`);
            }
            lines.push('');
            lines.push('说明：<datalist>+<input list> 提供原生自动补全；<progress> 进度条；');
            lines.push('      <meter> 度量条（low/high/optimum 决定颜色）；<output> 计算结果展示元素。');
            this.setState({ nativeFormInfo: lines.join('\n') });
            this._addLog('native', '原生表单组件属性检测完成（datalist/progress/meter/output）');
        }
        catch (err) {
            this._addLog('warn', `原生组件检测失败：${err.name} - ${err.message}`);
        }
    }
    // 实时计算器：input + output + oninput
    _demoLiveCalculator() {
        const caps = this._caps();
        if (!caps.document) {
            this._addLog('warn', 'document 不可用，无法演示计算器');
            return;
        }
        try {
            // 先清理旧 form 与监听器
            if (this._calcForm && this._calcHandler) {
                try {
                    this._calcForm.removeEventListener('input', this._calcHandler);
                }
                catch { /* noop */ }
            }
            const form = document.createElement('form');
            form.id = 'calc-form';
            form.innerHTML =
                '<input type="number" name="a" value="6">' +
                    '<input type="number" name="b" value="7">' +
                    '<output name="result" for="a b"></output>';
            document.body.appendChild(form);
            this._calcForm = form;
            const out = form.elements.namedItem('result'); // form.elements.namedItem 取控件
            const aInput = form.elements.namedItem('a');
            const bInput = form.elements.namedItem('b');
            // 计算函数
            const compute = () => {
                const a = Number(aInput.value);
                const b = Number(bInput.value);
                const sum = (Number.isFinite(a) && Number.isFinite(b)) ? (a + b) : NaN;
                out.value = String(sum); // 设置 output.value
                return sum;
            };
            const initialSum = compute();
            // 注册 input 事件（事件委托到 form）
            const handler = (e) => {
                if (e.target && (e.target.name === 'a' || e.target.name === 'b')) {
                    const sum = compute();
                    this._addLog('native', `计算器 input 事件：a=${aInput.value}, b=${bInput.value}, sum=${sum}`);
                }
            };
            form.addEventListener('input', handler);
            this._calcHandler = handler;
            // 模拟一次输入变化（jsdom 中需手动改 value + dispatchEvent）
            try {
                aInput.value = '15';
                aInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            catch { /* noop */ }
            const finalSum = out.value;
            this.setState({
                nativeFormInfo: `实时计算器演示 ✓（input + output + oninput）\n\n` +
                    `form 含：input[name=a] + input[name=b] + output[name=result for="a b"]\n` +
                    `form.elements.namedItem('result') 取 output 控件 ✓\n` +
                    `初始 a=6, b=7 → output.value = "${initialSum}"\n` +
                    `模拟 a=15 → output.value = "${finalSum}"（input 事件触发重算）\n\n` +
                    `说明：output 元素的 value 属性存放计算结果；for="a b" 语义关联输入 id；\n` +
                    `      监听 form 的 input 事件（事件委托）即可实时更新 output.value。\n` +
                    `      form.elements.namedItem(name) 按 name 取控件（HTMLFormControlsCollection）。\n` +
                    `      区别于 setAttribute('value')：直接设 output.value 会同步 defaultValue 吗？\n` +
                    `      不会，output.value 仅设当前值，defaultValue 是初始值。`,
            });
            this._addLog('native', `计算器演示：初始 sum=${initialSum}, 改 a=15 后 sum=${finalSum}`);
        }
        catch (err) {
            this._addLog('warn', `计算器演示失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard5() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '5. 原生表单组件（datalist / progress / meter / output）',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.document ? 'success' : 'error' }, caps.document ? 'DOM ✓' : '不可用'), h(Tag, { color: 'primary' }, 'datalist / progress / meter / output')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '原生表单组件提供常用 UI 而无需 JS 库。<datalist id="..."> + <input list="..."> 实现原生自动补全（input.list 属性引用 datalist）；<progress value max> 进度条，position = value/max（无 value 时为 -1 表示不确定）；<meter value min max low high optimum> 度量条，low/high/optimum 决定颜色（value 在 optimum 区间绿、靠近边界黄、超出红）；<output for="a b"> 计算结果展示元素，for 关联输入 id（空格分隔），value 设当前结果、defaultValue 是初始值。常配合 input + oninput 实现实时计算器。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('组件属性检测', { type: 'primary', size: 'sm', disabled: !caps.document, onClick: () => this._demoNativeComponents() }), this._btn('实时计算器', { type: 'primary', size: 'sm', disabled: !caps.document, onClick: () => this._demoLiveCalculator() })),
                h('div', { class: 'fs-sm text-secondary' }, '原生组件状态：'),
                h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } }, h('code', {}, s.nativeFormInfo || '（点击「组件属性检测」或「实时计算器」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '130px', overflow: 'auto' } }, h('code', {}, `<datalist id="fruits">
  <option value="apple"><option value="banana">
</datalist>
<input list="fruits">                    <!-- 原生自动补全 -->

<progress value="0.7" max="1"></progress>  <!-- 进度条 -->
<meter value="0.3" min="0" max="1" low="0.4" high="0.6" optimum="0.2"></meter>

<form oninput="result.value = Number(a.value) + Number(b.value)">
  <input name="a"><input name="b">
  <output name="result" for="a b"></output>
</form>`)),
                h(Alert, {
                    type: 'info',
                    message: 'output.value 与 defaultValue 的区别',
                    description: 'output 元素的 value 属性存放当前计算结果，defaultValue 是初始值（页面加载时的值）。直接赋值 output.value 不影响 defaultValue；调用 form.reset() 会把 output.value 恢复为 defaultValue。<meter> 的 low/high/optimum 决定颜色区间，optimum 在哪一侧决定「好/坏」方向。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 6：表单提交现代模式（Modern Submit Patterns）===================
    // 构造提交演示 form
    _ensureSubmitForm() {
        const caps = this._caps();
        if (!caps.document) {
            this._addLog('warn', 'document 不可用，无法构造提交演示 form');
            return null;
        }
        if (this._submitForm)
            return this._submitForm;
        try {
            const form = document.createElement('form');
            form.innerHTML =
                '<input name="username" required placeholder="用户名（required）">' +
                    '<input type="email" name="email" required placeholder="邮箱（required）">' +
                    '<button type="submit" name="action" value="save">保存</button>' +
                    '<button type="submit" name="action" value="publish">发布</button>';
            document.body.appendChild(form);
            this._submitForm = form;
            this._addLog('info', '已创建提交演示 form（username/email 必填 + 两个 submit 按钮）');
            return form;
        }
        catch (err) {
            this._addLog('warn', `创建提交演示 form 失败：${err.name} - ${err.message}`);
            return null;
        }
    }
    // form.elements / form.elements.namedItem 演示
    _demoFormElements() {
        const caps = this._caps();
        if (!caps.document) {
            this._addLog('warn', 'document 不可用');
            return;
        }
        const form = this._ensureSubmitForm();
        if (!form)
            return;
        try {
            // form.elements：HTMLFormControlsCollection，访问所有控件
            const elements = form.elements;
            const count = elements.length;
            // 按 name 取控件（namedItem）
            const username = form.elements.namedItem('username');
            const email = form.elements.namedItem('email');
            // 同名多控件（两个 submit 按钮都 name="action"）→ namedItem 返回 RadioNodeList
            const actionList = form.elements.namedItem('action');
            const actionType = actionList ? actionList.constructor.name : 'null';
            const actionValues = [];
            if (actionList && typeof actionList.length === 'number') {
                for (let i = 0; i < actionList.length; i++) {
                    actionValues.push(actionList[i] ? actionList[i].value : '(空)');
                }
            }
            // 也支持索引访问
            const firstEl = elements[0] ? elements[0].name : '(无)';
            this.setState({
                submitInfo: `form.elements / namedItem 演示 ✓\n\n` +
                    `form.elements.length = ${count}（HTMLFormControlsCollection 包含所有命名控件）\n` +
                    `form.elements[0].name = "${firstEl}"（索引访问）\n` +
                    `form.elements.namedItem('username') = ${username ? username.constructor.name + '(name=' + username.name + ')' : 'null'}\n` +
                    `form.elements.namedItem('email') = ${email ? email.constructor.name + '(type=' + email.type + ')' : 'null'}\n` +
                    `form.elements.namedItem('action') = ${actionType}（同名多控件返回 RadioNodeList）\n` +
                    `  action values = ${JSON.stringify(actionValues)}\n\n` +
                    `说明：form.elements 是 HTMLFormControlsCollection，支持索引与 namedItem(name) 访问；\n` +
                    `      同名多控件（如多个 name="action" 的按钮）返回 RadioNodeList，可用 [i] 遍历或 .value 取选中值。`,
            });
            this._addLog('submit', `form.elements 演示：${count} 个控件，action 同名返回 ${actionType}`);
        }
        catch (err) {
            this._addLog('warn', `form.elements 演示失败：${err.name} - ${err.message}`);
        }
    }
    // requestSubmit(submitter?) vs submit() 对比演示
    _demoRequestSubmitVsSubmit() {
        const caps = this._caps();
        if (!caps.document) {
            this._addLog('warn', 'document 不可用');
            return;
        }
        const form = this._ensureSubmitForm();
        if (!form)
            return;
        // 注册 submit 与 formdata 监听器以观察事件链
        if (!this._submitFormHandler) {
            try {
                this._submitFormHandler = (e) => {
                    e.preventDefault();
                    this._addLog('submit', 'submit 事件触发并 preventDefault（观察事件链）');
                };
                form.addEventListener('submit', this._submitFormHandler);
            }
            catch { /* noop */ }
        }
        if (caps.formdataEvent && !this._submitFormdataHandler) {
            try {
                this._submitFormdataHandler = (e) => {
                    this._addLog('submit', 'formdata 事件触发（requestSubmit 走完整事件链）');
                };
                form.addEventListener('formdata', this._submitFormdataHandler);
            }
            catch { /* noop */ }
        }
        try {
            const lines = [];
            lines.push('requestSubmit(submitter?) vs submit() 对比：');
            // ① requestSubmit（不带 submitter）
            if (caps.requestSubmit) {
                try {
                    form.requestSubmit(); // 触发 submit → formdata → 提交
                    lines.push('① form.requestSubmit() 已调用 ✓ → 触发 submit 事件（+ formdata 事件，若支持）');
                }
                catch (e) {
                    lines.push(`① form.requestSubmit() 抛错：${e.name} - ${e.message}`);
                }
            }
            else {
                lines.push('① form.requestSubmit() 不可用（HTMLFormElement.prototype.requestSubmit 未实现）');
            }
            // ② requestSubmit(submitter)：指定提交按钮，影响 formAction/formMethod 等
            if (caps.requestSubmit) {
                try {
                    const publishBtn = form.elements.namedItem('action');
                    let submitter = null;
                    if (publishBtn && publishBtn.length >= 2)
                        submitter = publishBtn[1]; // 发布按钮
                    if (submitter) {
                        form.requestSubmit(submitter); // 指定 submitter
                        lines.push(`② form.requestSubmit(submitter) 已调用 ✓ → submitter = 发布按钮（value="${submitter.value}"）`);
                        lines.push(`   submitter 影响：formAction / formMethod / formEnctype / formNoValidate / formTarget`);
                    }
                    else {
                        lines.push('② 未找到 submit 按钮，跳过 submitter 演示');
                    }
                }
                catch (e) {
                    lines.push(`② form.requestSubmit(submitter) 抛错：${e.name} - ${e.message}`);
                }
            }
            // ③ form.submit()：底层直接提交，不触发任何事件
            try {
                form.submit(); // 不触发 submit/formdata 事件、不验证
                lines.push('③ form.submit() 已调用 → 不触发 submit/formdata 事件、不做约束验证');
            }
            catch (e) {
                lines.push(`③ form.submit() 抛错：${e.name} - ${e.message}`);
            }
            lines.push('');
            lines.push('说明：requestSubmit() 是现代提交入口，走完整事件链（submit → formdata → 提交），');
            lines.push('      会触发约束验证（required 等失败则不提交）；submit() 是底层方法，直接提交不触发事件、不验证。');
            lines.push('      requestSubmit(submitter) 的 submitter 参数影响 formAction/formMethod/formEnctype/formNoValidate/formTarget。');
            this.setState({ submitInfo: lines.join('\n') });
            this._addLog('submit', `requestSubmit vs submit 演示完成（requestSubmit 可用：${caps.requestSubmit}）`);
        }
        catch (err) {
            this._addLog('warn', `requestSubmit vs submit 演示失败：${err.name} - ${err.message}`);
        }
    }
    // JS 验证通过后 requestSubmit 提交（走完整事件链）
    _demoValidateThenSubmit() {
        const caps = this._caps();
        if (!caps.document) {
            this._addLog('warn', 'document 不可用');
            return;
        }
        if (!caps.requestSubmit) {
            this._addLog('warn', 'requestSubmit 不可用，无法演示「验证后提交」流程');
            this.setState({
                submitInfo: `JS 验证后 requestSubmit 演示：requestSubmit 不可用（${caps.requestSubmit ? '✓' : '✗'}）\n` +
                    `说明：现代提交流程——先 checkValidity() 验证，通过后 requestSubmit() 走完整事件链；\n` +
                    `      jsdom 中 requestSubmit 未实现，演示将记日志说明。`,
            });
            return;
        }
        const form = this._ensureSubmitForm();
        if (!form)
            return;
        try {
            const username = form.elements.namedItem('username');
            const email = form.elements.namedItem('email');
            const lines = ['JS 验证后 requestSubmit 提交演示：'];
            // ① 空值：验证失败，不提交
            try {
                username.value = '';
                email.value = '';
                const r1 = form.checkValidity(); // form 也有 checkValidity
                lines.push(`① 空值：form.checkValidity() = ${r1}（false，required 失败，不调用 requestSubmit）`);
                if (!r1)
                    lines.push('   → 验证失败，跳过提交，应提示用户填写必填字段');
            }
            catch (e) {
                lines.push(`① 验证失败抛错：${e.message}`);
            }
            // ② 合法值：验证通过，requestSubmit 走完整事件链
            try {
                username.value = 'alice';
                email.value = 'alice@example.com';
                const r2 = form.checkValidity();
                lines.push(`② 合法值：form.checkValidity() = ${r2}（true，验证通过）`);
                if (r2) {
                    // 确保 submit 监听器已注册（preventDefault 阻止 jsdom 提交报错）
                    if (!this._submitFormHandler) {
                        this._submitFormHandler = (e) => { e.preventDefault(); this._addLog('submit', 'submit 事件触发并 preventDefault'); };
                        try {
                            form.addEventListener('submit', this._submitFormHandler);
                        }
                        catch { /* noop */ }
                    }
                    form.requestSubmit(); // 走完整事件链
                    lines.push('   → form.requestSubmit() 已调用，触发 submit → formdata → 提交 事件链');
                }
            }
            catch (e) {
                lines.push(`② 验证后提交抛错：${e.name} - ${e.message}`);
            }
            lines.push('');
            lines.push('说明：现代提交流程——');
            lines.push('  1. 先 form.checkValidity() 或 input.checkValidity() 做约束验证');
            lines.push('  2. 验证通过后 form.requestSubmit() 走完整事件链（submit → formdata → 提交）');
            lines.push('  3. 可在 submit 事件回调里 preventDefault 改用 fetch/AJAX 提交');
            lines.push('  4. requestSubmit(submitter) 可指定提交按钮影响 formAction/formMethod 等');
            this.setState({ submitInfo: lines.join('\n') });
            this._addLog('submit', `验证后提交演示：空值验证失败跳过，合法值 requestSubmit 走事件链`);
        }
        catch (err) {
            this._addLog('warn', `验证后提交演示失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard6() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '6. 表单提交现代模式（Modern Submit Patterns）',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.requestSubmit ? 'success' : 'error' }, caps.requestSubmit ? 'requestSubmit ✓' : '不可用'), h(Tag, { color: 'primary' }, 'requestSubmit / submit / elements')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'form.requestSubmit(submitter?) 是现代表单提交入口，程序化触发表单事件链（submit → formdata → 提交），会执行约束验证（required 等失败则不提交）。vs form.submit() 底层直接提交，不触发 submit/formdata 事件、不做验证。submitter 参数指定提交按钮，影响 formAction / formMethod / formEnctype / formNoValidate / formTarget。form.elements 返回 HTMLFormControlsCollection 访问所有控件；form.elements.namedItem(name) 按 name 取控件，同名多控件返回 RadioNodeList。实战：JS 验证通过后 requestSubmit() 走完整事件链，可在 submit 回调 preventDefault 改用 fetch/AJAX 提交。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('form.elements / namedItem', { type: 'primary', size: 'sm', disabled: !caps.document, onClick: () => this._demoFormElements() }), this._btn('requestSubmit vs submit', { type: 'primary', size: 'sm', disabled: !caps.document, onClick: () => this._demoRequestSubmitVsSubmit() }), this._btn('验证后 requestSubmit', { size: 'sm', disabled: !caps.document, onClick: () => this._demoValidateThenSubmit() })),
                h('div', { class: 'fs-sm text-secondary' }, '提交模式状态：'),
                h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } }, h('code', {}, s.submitInfo || '（点击「form.elements / namedItem」开始）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } }, h('code', {}, `// JS 验证后 requestSubmit 走完整事件链
if (form.checkValidity()) {
  form.requestSubmit();              // 触发 submit → formdata → 提交
}
form.requestSubmit(submitterBtn);    // 指定 submitter，影响 formAction 等
form.submit();                       // 底层提交，不触发事件、不验证

// form.elements 访问控件
const els = form.elements;           // HTMLFormControlsCollection
const username = form.elements.namedItem('username');
const actionList = form.elements.namedItem('action'); // RadioNodeList`)),
                h(Alert, {
                    type: 'warning',
                    message: 'requestSubmit vs submit 的关键区别',
                    description: 'requestSubmit() 触发完整事件链（submit → formdata → 提交）并执行约束验证，验证失败则不提交；submit() 是底层方法，直接提交不触发任何事件、不做验证。现代代码应优先用 requestSubmit；submit() 仅在「确认无误后绕过验证直接提交」时使用。submitter 参数让一个表单支持多个提交动作（保存/发布/删除）。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 9：field-sizing 表单自适应 ===================
    _runFieldSizingDemo() {
        const caps = this._caps();
        const lines = [];
        lines.push('===== CSS field-sizing 表单自适应 =====');
        lines.push('');
        lines.push('【标准】CSS Working Group 2024 草案');
        lines.push('  - field-sizing: content 让表单字段按内容自动调整尺寸');
        lines.push('  - 适用于 textarea / input，告别 JS 自动撑高');
        lines.push('');
        lines.push('【取值】');
        lines.push('  field-sizing: content;   按内容自动尺寸（推荐）');
        lines.push('  field-sizing: fixed;     固定尺寸（默认，传统行为）');
        lines.push('');
        lines.push('【与 cols/rows 属性协同】');
        lines.push('  textarea { field-sizing: content; }');
        lines.push('  // 覆盖 cols/rows 默认值，随内容行数自动增高');
        lines.push('  // 删除内容时自动收缩');
        lines.push('');
        lines.push('【与 min-height/max-height 约束】');
        lines.push('  textarea {');
        lines.push('    field-sizing: content;');
        lines.push('    min-height: 80px;      /* 至少 4 行 */');
        lines.push('    max-height: 300px;     /* 超过出现滚动条 */');
        lines.push('  }');
        lines.push('  // content 在 [min-height, max-height] 范围内自适应');
        lines.push('');
        lines.push('【实战：自适应输入框】');
        lines.push('  /* HTML */');
        lines.push('  <textarea class="auto" placeholder="输入内容自动撑高"></textarea>');
        lines.push('  /* CSS */');
        lines.push('  .auto {');
        lines.push('    field-sizing: content;');
        lines.push('    min-height: 60px;');
        lines.push('    max-height: 240px;');
        lines.push('    resize: vertical;  /* 仍可手动拖拽 */');
        lines.push('  }');
        lines.push('  /* 无需 JS 监听 input 事件测量 scrollHeight */');
        lines.push('');
        lines.push('【input 类型支持】');
        lines.push('  input[type=text] { field-sizing: content; }  // 按字符宽度自适应');
        lines.push('  input[type=password] / [type=search] 同样适用');
        lines.push('  // 注意：number/range/date 等类型不适用 content');
        lines.push('');
        lines.push('【降级策略】');
        lines.push('  - 不支持 field-sizing：textarea 按 cols/rows 固定尺寸，需 JS fallback');
        lines.push('  // JS 降级：监听 input 事件手动设 height');
        lines.push('  textarea.addEventListener("input", () => {');
        lines.push('    textarea.style.height = "auto";');
        lines.push('    textarea.style.height = textarea.scrollHeight + "px";');
        lines.push('  });');
        lines.push('');
        lines.push('【当前环境能力检测】');
        lines.push('  CSS.supports("field-sizing", "content"): ' + (caps.fieldSizing ? '✓' : '✗'));
        lines.push('');
        lines.push('【浏览器支持】');
        lines.push('  Chrome 123+   ✓');
        lines.push('  Edge 123+     ✓');
        lines.push('  Firefox       未实现');
        lines.push('  Safari        未实现');
        lines.push('  jsdom         ✗（不识别该属性）');
        this.setState({ fieldSizingInfo: lines.join('\n') });
        if (!caps.fieldSizing) {
            this._addLog('warn', 'field-sizing: content 不可用（Chrome 123+），仅展示文档与代码示例');
        }
        else {
            this._addLog('info', 'field-sizing: content 可用，可体验表单自适应');
        }
    }
    _renderCard9() {
        const s = this.state;
        const caps = this._caps();
        const card = new Card({
            title: '9. CSS field-sizing —— 表单字段按内容自适应',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: caps.fieldSizing ? 'success' : 'error' }, caps.fieldSizing ? 'field-sizing ✓' : 'field-sizing ✗'), h(Tag, { color: 'primary' }, 'CSSWG 2024')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'field-sizing: content（CSSWG 2024）让 textarea/input 按内容自动调整尺寸，覆盖 cols/rows 默认值，告别 JS 监听 input 测量 scrollHeight 的传统方案。配合 min-height/max-height 约束自适应范围，超出出现滚动条。Chrome 123+ 支持，Firefox/Safari 未实现。降级：不支持时按 cols/rows 固定尺寸，用 JS input 事件手动设 height。jsdom 不识别该属性，演示仅展示文档与代码。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('展示 field-sizing 文档与代码', { type: 'primary', size: 'sm', onClick: () => this._runFieldSizingDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, 'field-sizing 文档与示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '520px', overflow: 'auto' } }, h('code', {}, s.fieldSizingInfo || '（点击按钮查看 field-sizing 完整文档与自适应输入框示例）')),
                h(Alert, {
                    type: 'info',
                    message: 'field-sizing: content 让表单字段告别 JS 自动撑高',
                    description: '声明 field-sizing: content 后，textarea 随内容行数自动增高/收缩，配合 min-height/max-height 约束范围。Chrome 123+ 支持。jsdom 不识别，演示仅展示文档。降级用 JS input 事件手动测量 scrollHeight。',
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
        return h('div', { class: 'page api-lab-page' }, h('h2', { class: 'section-title' }, '表单 API 深度'), h('p', { class: 'fs-sm text-secondary mb-md' }, '本页演示 formdata 事件与 FormDataEvent、Constraint Validation API（checkValidity/reportValidity/setCustomValidity/validity）、HTMLInputElement.showPicker()、FormData 完整接口、原生表单组件（datalist/progress/meter/output）、表单提交现代模式（requestSubmit vs submit）。所有 API 调用前做 typeof/in 检测，不可用时仅记日志。'), s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderCard9(), this._renderLogPanel());
    }
}
//# sourceMappingURL=FormAPIDeepPage.js.map