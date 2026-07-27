// =====================================================================
// WebMIDINFCGamepadPage.js —— 设备通信与输入 API 实验室
// 演示 MDN：
//   1. Web MIDI API                —— navigator.requestMIDIAccess / MIDIAccess / MIDIInput / MIDIOutput
//   2. Web NFC API                  —— NDEFReader / NDEFMessage / NDEFRecord
//   3. Gamepad API 游戏手柄         —— navigator.getGamepads / Gamepad / GamepadButton / vibrationActuator
//   4. WebOTP API 一次性密码        —— navigator.credentials.get({ otp }) / OTPCredential
//   5. Compute Pressure API 计算压力 —— PressureObserver / PressureRecord
//   6. Digital Goods API 数字商品   —— window.digitalGoods / DigitalGoodsService
// 说明：本页聚焦 NativeInteropPage / HardwareDevicesPage 未深入展开的 6 类设备通信 / 输入 API。
//       所有 API 调用前做 typeof 能力检测，不可用时仅记日志，绝不抛异常。
//       jsdom 中 requestMIDIAccess / window.digitalGoods 通常 undefined；
//       PressureObserver / NDEFReader / getGamepads / OTPCredential 由 single_page_test.mjs polyfill。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime, errInfo } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class WebMIDINFCGamepadPage extends Page {
    _gamepadTimer;
    _gpConnUnbind;
    _gpDiscUnbind;
    _gpLogTs;
    _inited;
    _midiAccess;
    _nfcAbort;
    _nfcReader;
    _otpAbort;
    _pressureObserver;
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            midiInfo: '', // Card 1：Web MIDI API
            nfcInfo: '', // Card 2：Web NFC API
            gamepadInfo: '', // Card 3：Gamepad API 游戏手柄
            otpInfo: '', // Card 4：WebOTP API 一次性密码
            pressureInfo: '', // Card 5：Compute Pressure API 计算压力
            digitalGoodsInfo: '', // Card 6：Digital Goods API 数字商品
        };
    }
    componentDidMount() {
        // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
        if (this._inited)
            return;
        this._inited = true;
        // 一次性初始化各实例引用（componentWillUnmount 中释放）
        this._midiAccess = null; // Card 1 MIDIAccess
        this._nfcReader = null; // Card 2 NDEFReader
        this._nfcAbort = null; // Card 2 AbortController
        this._gamepadTimer = null; // Card 3 gamepad 轮询定时器
        this._gpConnUnbind = null; // Card 3 gamepadconnected 解绑
        this._gpDiscUnbind = null; // Card 3 gamepaddisconnected 解绑
        this._otpAbort = null; // Card 4 OTP AbortController
        this._pressureObserver = null; // Card 5 PressureObserver
        // 一次性能力检测：设备通信 / 输入全家桶
        const nav = typeof navigator !== 'undefined' ? navigator : null;
        const win = typeof window !== 'undefined' ? window : null;
        const caps = {
            midi: typeof nav.requestMIDIAccess === 'function',
            nfc: typeof win.NDEFReader !== 'undefined',
            gamepad: typeof nav.getGamepads === 'function',
            otp: typeof nav.credentials?.get === 'function' && typeof win.OTPCredential !== 'undefined',
            pressure: typeof win.PressureObserver !== 'undefined',
            digitalGoods: typeof win.digitalGoods !== 'undefined',
        };
        const parts = [
            `Web MIDI ${caps.midi ? '✓' : '✗'}`, `Web NFC ${caps.nfc ? '✓' : '✗'}`,
            `Gamepad ${caps.gamepad ? '✓' : '✗'}`, `WebOTP ${caps.otp ? '✓' : '✗'}`,
            `Pressure ${caps.pressure ? '✓' : '✗'}`, `DigitalGoods ${caps.digitalGoods ? '✓' : '✗'}`,
        ];
        const anyAvailable = caps.midi || caps.nfc || caps.gamepad || caps.otp || caps.pressure || caps.digitalGoods;
        const summary = anyAvailable
            ? `设备通信 / 输入能力检测：${parts.join(' · ')}。jsdom 中 requestMIDIAccess 与 window.digitalGoods 通常不可用（需真实浏览器 + 真实硬件 / Play Billing）；PressureObserver / NDEFReader / getGamepads / OTPCredential 由 single_page_test.mjs 提供 polyfill，可演示 API 形态但不触发真实硬件事件。`
            : '当前环境不支持任何设备通信 / 输入 API（typeof 检测均为 false）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。';
        this.setState({ capsSummary: summary });
        this._addLog(anyAvailable ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!caps.midi)
            this._addLog('warn', 'Web MIDI 不可用（typeof navigator.requestMIDIAccess !== "function"，jsdom 无此 API）');
        if (!caps.digitalGoods)
            this._addLog('warn', 'Digital Goods API 不可用（typeof window.digitalGoods === "undefined"，仅 Android Chrome + Play Billing）');
        // 注册 gamepadconnected / gamepaddisconnected 监听
        if (caps.gamepad && typeof win.addEventListener === 'function') {
            this._gpConnUnbind = this.on(win, 'gamepadconnected', (e) => {
                const gp = (e && e.gamepad) || {};
                this._addLog('pad', `gamepadconnected → index=${gp.index} id=${gp.id} buttons=${(gp.buttons || []).length}`);
            });
            this._gpDiscUnbind = this.on(win, 'gamepaddisconnected', (e) => {
                const gp = (e && e.gamepad) || {};
                this._addLog('pad', `gamepaddisconnected → index=${gp.index} id=${gp.id}`);
            });
        }
    }
    componentWillUnmount() {
        // 1. 释放 MIDI access（解除 statechange 监听）
        if (this._midiAccess) {
            try {
                this._midiAccess.onstatechange = null;
            }
            catch { /* noop */ }
            this._midiAccess = null;
        }
        // 2. 停止 NFC scan（AbortController.abort）
        if (this._nfcAbort) {
            try {
                this._nfcAbort.abort();
            }
            catch { /* noop */ }
            this._nfcAbort = null;
        }
        if (this._nfcReader) {
            try {
                this._nfcReader.onreading = null;
            }
            catch { /* noop */ }
            try {
                this._nfcReader.onreadingerror = null;
            }
            catch { /* noop */ }
            this._nfcReader = null;
        }
        // 3. 断开 PressureObserver
        if (this._pressureObserver) {
            try {
                this._pressureObserver.disconnect();
            }
            catch { /* noop */ }
            this._pressureObserver = null;
        }
        // 4. 停止 gamepad 轮询定时器
        if (this._gamepadTimer) {
            try {
                clearInterval(this._gamepadTimer);
            }
            catch { /* noop */ }
            this._gamepadTimer = null;
        }
        // 5. 解绑 gamepadconnected / gamepaddisconnected
        if (this._gpConnUnbind) {
            try {
                this._gpConnUnbind();
            }
            catch { /* noop */ }
            this._gpConnUnbind = null;
        }
        if (this._gpDiscUnbind) {
            try {
                this._gpDiscUnbind();
            }
            catch { /* noop */ }
            this._gpDiscUnbind = null;
        }
        // 6. 取消 OTP 请求
        if (this._otpAbort) {
            try {
                this._otpAbort.abort();
            }
            catch { /* noop */ }
            this._otpAbort = null;
        }
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
    // 单个能力检测（返回 boolean），用于 handler 内守卫与按钮 disabled
    _has(api) {
        const nav = typeof navigator !== 'undefined' ? navigator : null;
        const win = typeof window !== 'undefined' ? window : null;
        switch (api) {
            case 'midi': return typeof nav.requestMIDIAccess === 'function';
            case 'nfc': return typeof win.NDEFReader !== 'undefined';
            case 'gamepad': return typeof nav.getGamepads === 'function';
            case 'otp': return typeof nav.credentials?.get === 'function' && typeof win.OTPCredential !== 'undefined';
            case 'pressure': return typeof win.PressureObserver !== 'undefined';
            case 'digitalGoods': return typeof win.digitalGoods !== 'undefined';
            default: return false;
        }
    }
    // 把能力项渲染为 Tag 组件数组：items = [['MIDI', true], ['NFC', false], ...]
    _caps(items) {
        return items.map(([name, ok]) => h(Tag, { color: ok ? 'success' : 'error' }, `${name} ${ok ? '✓' : '✗'}`));
    }
    // =================== Card 1：Web MIDI API ===================
    async _midiRequest() {
        if (!this._has('midi')) {
            this.setState({ midiInfo: 'Web MIDI 不可用（typeof navigator.requestMIDIAccess !== "function"）。\n\n' +
                    "用法：const access = await navigator.requestMIDIAccess({ sysex: false });\naccess.inputs / .outputs（Map）· .sysexEnabled · .onstatechange\n" +
                    'MIDIInput.onmidimessage → e.data (Uint8Array [status, data1, data2])\nMIDIOutput.send(data, timestamp) / .clear()\n\n点击「消息格式 / sysex」查看完整 MIDI 协议说明。' });
            this._addLog('warn', 'Web MIDI 不可用（typeof navigator.requestMIDIAccess !== "function"），已记录用法');
            return;
        }
        try {
            const access = await navigator.requestMIDIAccess({ sysex: false });
            this._midiAccess = access;
            const inputs = [];
            const outputs = [];
            access.inputs.forEach((p) => inputs.push({ name: p.name, manufacturer: p.manufacturer, state: p.state }));
            access.outputs.forEach((p) => outputs.push({ name: p.name, manufacturer: p.manufacturer, state: p.state }));
            access.onstatechange = (e) => {
                const port = e.port || {};
                this._addLog('midi', `onstatechange → ${port.name || '?'} state=${port.state} connection=${port.connection}`);
            };
            if (access.inputs.size > 0) {
                const firstIn = access.inputs.values().next().value;
                firstIn.onmidimessage = (e) => {
                    const d = e.data;
                    this._addLog('midi', `onmidimessage → [${d[0]}, ${d[1]}, ${d[2]}] (Uint8Array, ${d.length} 字节)`);
                };
            }
            const list = (inputs.length ? inputs.map((p) => `[in]  ${p.name || '?'} | ${p.manufacturer || '-'} | state=${p.state}`).join('\n') + '\n' : '') +
                (outputs.length ? outputs.map((p) => `[out] ${p.name || '?'} | ${p.manufacturer || '-'} | state=${p.state}`).join('\n') + '\n' : '') +
                (inputs.length === 0 && outputs.length === 0 ? '（jsdom 无真实 MIDI 设备，inputs/outputs 均为空 Map）\n' : '');
            this.setState({ midiInfo: 'navigator.requestMIDIAccess({ sysex: false }) → MIDIAccess：\n' +
                    `  access.sysexEnabled = ${access.sysexEnabled}\n  access.inputs.size = ${inputs.length}（MIDIInput Map）\n` +
                    `  access.outputs.size = ${outputs.length}（MIDIOutput Map）\n  access.onstatechange 已绑定（设备插拔时触发）\n\n` +
                    list +
                    '首个 input 的 onmidimessage 已绑定（真实硬件按键时记录 [status, data1, data2]）。' });
            this._addLog('midi', `requestMIDIAccess({sysex:false}) → inputs=${inputs.length} outputs=${outputs.length} sysexEnabled=${access.sysexEnabled}`);
        }
        catch (err) {
            this._addLog('warn', `requestMIDIAccess 失败：${errInfo(err).name || 'Error'} — ${errInfo(err).message || ''}`);
        }
    }
    _midiExplain() {
        this.setState({ midiInfo: '===== MIDI 消息格式与 sysex 权限 =====\n\n' +
                '【MIDIAccess】.inputs / .outputs（Map）· .sysexEnabled（bool）· .onstatechange = (e: any) => e.port\n' +
                '【MIDIInput】.name / .manufacturer / .state / .type / .onmidimessage（e.data 为 Uint8Array [status, data1, data2]）\n' +
                '【MIDIOutput】.send(data, timestamp) / .clear()\n  output.send([0x90, 60, 100]);  output.send([0x80, 60, 0], performance.now()+500);\n\n' +
                '【状态字节 status byte（0x80-0xEF，高 4 位命令 + 低 4 位通道）】\n  0x8n Note Off  ·  0x9n Note On（data2=0 视为 Note Off）\n' +
                '  0xBn Control Change  ·  0xCn Program Change（无 data2）  ·  0xEn Pitch Bend（14 位）\n  通道 0-15（低 4 位）；音高 0-127（中央 C=60）；力度 0-127；data1/data2 均 0-127\n\n' +
                '【sysex 系统专有消息】需 requestMIDIAccess({ sysex: true })，浏览器弹权限框授权；sysexEnabled 反映结果。\n  消息以 0xF0 开头、0xF7 结尾，中间为厂商自定义字节，可任意长度。' });
        this._addLog('midi', '已展示 MIDI 消息格式（status byte / channel / note / velocity）与 sysex 权限说明');
    }
    _midiSendDemo() {
        if (!this._has('midi')) {
            this._addLog('warn', 'Web MIDI 不可用，无法演示 send 用法');
            return;
        }
        this.setState({ midiInfo: 'MIDIOutput.send 演示字节序列（中央 C = 60，力度 100）：\n\n' +
                'output.send([0x90, 60, 100]);                          // 1. Note On：通道 0，中央 C，力度 100\n' +
                "output.send([0x80, 60, 0], performance.now() + 500);   // 2. 0.5s 后 Note Off\n" +
                'output.send([0xB0, 7, 80]);                            // 3. CC：控制器 7（主音量）= 80\noutput.send([0xC0, 0]);                                // 4. PC：程序 0（钢琴）\n' +
                'output.send([0xE0, 0x00, 0x40]);                       // 5. Pitch Bend：向上弯曲 1/4\noutput.clear();                                        // 清空已排队未发送消息\n\n' +
                'send 第二参数 timestamp 为 DOMHighResTimeStamp（performance.now() 基准），省略则立即发送。\njsdom 无真实 output，需在浏览器 + MIDI 设备中验证。' });
        this._addLog('midi', '已展示 MIDIOutput.send 典型字节序列（Note On/Off/CC/PC/Pitch Bend）');
    }
    _renderCard1() {
        const s = this.state;
        const ok = this._has('midi');
        const card = new Card({
            title: '1. Web MIDI API',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['requestMIDIAccess', ok]]), h(Tag, { color: 'primary' }, 'MIDIAccess / Input / Output')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'navigator.requestMIDIAccess({ sysex }) 返回 Promise<MIDIAccess>。MIDIAccess 含 .inputs / .outputs（Map）、.onstatechange、.sysexEnabled。MIDIInput 监听 .onmidimessage 取 e.data（Uint8Array [status, data1, data2]）；MIDIOutput 提供 .send(data, timestamp) / .clear()。状态字节高 4 位命令（0x8 Note Off / 0x9 Note On / 0xB CC / 0xC PC / 0xE Pitch Bend），低 4 位通道（0-15）；音高与力度均为 0-127。sysex 需显式授权。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('请求 MIDI 访问', { type: 'primary', size: 'sm', disabled: !ok, onClick: () => this._midiRequest() }), this._btn('消息格式 / sysex', { size: 'sm', onClick: () => this._midiExplain() }), this._btn('send 字节演示', { size: 'sm', disabled: !ok, onClick: () => this._midiSendDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, 'MIDI 访问 / 用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } }, h('code', {}, s.midiInfo || '（点击「请求 MIDI 访问」或对应说明按钮）')),
                h(Alert, {
                    type: 'info',
                    message: 'sysex 权限需用户显式授权',
                    description: 'requestMIDIAccess({ sysex: true }) 会弹权限框请求系统专有消息（厂商自定义字节，0xF0 开头 0xF7 结尾）。access.sysexEnabled 反映授权结果。jsdom 无真实 MIDI，所有 send 仅在浏览器 + MIDI 设备中生效。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 2：Web NFC API ===================
    async _nfcScan() {
        if (!this._has('nfc')) {
            this.setState({ nfcInfo: 'Web NFC 不可用（typeof NDEFReader === "undefined"）。\n\n' +
                    "用法：const reader = new NDEFReader();\nreader.onreading = (e: any) => { e.serialNumber; e.message.records[] };\n" +
                    'reader.scan({ signal }) → Promise；AbortController.abort() 停止\nreader.write(message, { overwrite, signal }) 写入 NDEF 消息\n\n点击「构造 NDEF 消息」查看 NDEFRecord 字段与解码方法。' });
            this._addLog('warn', 'Web NFC 不可用（typeof NDEFReader === "undefined"），已记录用法');
            return;
        }
        try {
            if (this._nfcAbort) {
                try {
                    this._nfcAbort.abort();
                }
                catch { /* noop */ }
            }
            const reader = new NDEFReader();
            this._nfcReader = reader;
            this._nfcAbort = new AbortController();
            reader.onreading = (event) => {
                const records = (event.message && event.message.records) || [];
                this._addLog('nfc', `onreading → serialNumber=${event.serialNumber} records=${records.length}`);
                records.forEach((r, i) => {
                    this._addLog('nfc', `record#${i} recordType=${r.recordType} mediaType=${r.mediaType || '-'}`);
                });
            };
            reader.onreadingerror = () => { this._addLog('warn', 'NFC onreadingerror → 无法读取标签'); };
            await reader.scan({ signal: this._nfcAbort.signal });
            this.setState({ nfcInfo: '已创建 NDEFReader 并开始扫描：\n  new NDEFReader() → reader\n  reader.onreading 已绑定（取 event.serialNumber / event.message.records）\n' +
                    '  reader.onreadingerror 已绑定\n  reader.scan({ signal: AbortSignal }) → Promise（开始监听）\n  AbortController 已创建，卸载或重扫时 abort() 停止\n\n' +
                    '说明：jsdom polyfill 的 scan() 立即 resolve，无真实标签靠近；\n  真实 Android Chrome 中需 HTTPS + 用户手势 + NFC 标签物理靠近。' });
            this._addLog('nfc', 'NDEFReader.scan({ signal }) 已调用，等待标签靠近（jsdom 无真实事件）');
        }
        catch (err) {
            this._addLog('warn', `NFC scan 失败：${errInfo(err).name || 'Error'} — ${errInfo(err).message || ''}`);
        }
    }
    _nfcBuildMessage() {
        if (!this._has('nfc')) {
            this._addLog('warn', 'Web NFC 不可用，无法构造 NDEFMessage');
            return;
        }
        try {
            let built = false;
            let recordInfo = '';
            try {
                const msg = new NDEFMessage({ records: [{ recordType: 'text', data: 'Hello NFC' }] });
                built = true;
                const recs = msg.records || [];
                recordInfo = recs.map((r, i) => `record#${i}: recordType=${r.recordType} mediaType=${r.mediaType || '-'} id=${r.id || '-'}`).join('\n');
            }
            catch (e) {
                recordInfo = `（NDEFMessage 构造在此环境抛 ${errInfo(e).name}，仅展示用法）`;
            }
            this.setState({ nfcInfo: "构造示例 NDEF 消息：\n\nnew NDEFMessage({ records: [{ recordType: 'text', data: 'Hello NFC' }] })\n\n" +
                    `构造结果：${built ? '成功' : '失败'}\n${recordInfo}\n\n` +
                    '【NDEFRecord 字段 / 方法】\n  .recordType：\'empty\' | \'text\' | \'url\' | \'smart-poster\' | \'absolute-url\' | \'mime\' | \'unknown\'\n' +
                    '  .mediaType：MIME 类型（mime / absolute-url 记录用）\n  .id：记录 id（可选）\n  .toRecords()：拆分子记录（smart-poster 等）\n' +
                    '  .toText()：解码为文本字符串\n  .toJSON()：序列化为 JSON\n  .toDataURL()：解码为 data: URL（mime 记录）\n\n' +
                    '【reader.write(message, { overwrite, signal })】\n  await reader.write(\'Hello NFC\', { overwrite: false, signal: ac.signal });\n  overwrite:false 时标签已有内容会拒绝写入；signal 用于取消。' });
            this._addLog('nfc', `构造 NDEFMessage({records:[{recordType:'text',data:'Hello NFC'}]}) → ${built ? '成功' : '失败（仅说明）'}`);
        }
        catch (err) {
            this._addLog('warn', `构造 NDEFMessage 失败：${errInfo(err).name || 'Error'} — ${errInfo(err).message || ''}`);
        }
    }
    async _nfcWriteDemo() {
        if (!this._has('nfc')) {
            this._addLog('warn', 'Web NFC 不可用，无法演示 write');
            return;
        }
        try {
            const writer = new NDEFReader();
            const msg = 'Hello from API Lab';
            this._addLog('nfc', `NDEFReader.write('${msg}', { overwrite: false }) 调用中…`);
            await writer.write(msg, { overwrite: false });
            this.setState({ nfcInfo: `NDEFReader.write 演示：\n\n  writer.write('${msg}', { overwrite: false }) → Promise\n  jsdom polyfill 直接 resolve（无真实标签）\n\n` +
                    '【write 签名】write(message, options?)\n  message：字符串 / BufferSource / NDEFMessageInit（{ records: [...] }）\n' +
                    '  options.overwrite：bool，false 时标签已有内容会抛 AbortError\n  options.signal：AbortSignal，用于取消写入\n\n注意：真实环境需 HTTPS + Android Chrome + NFC 标签靠近；overwrite:false 防误覆盖。' });
            this._addLog('nfc', `write('${msg}') → polyfill resolve 成功`);
        }
        catch (err) {
            this._addLog('warn', `NFC write 失败：${errInfo(err).name || 'Error'} — ${errInfo(err).message || ''}`);
        }
    }
    _renderCard2() {
        const s = this.state;
        const ok = this._has('nfc');
        const card = new Card({
            title: '2. Web NFC API',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['NDEFReader', ok]]), h(Tag, { color: 'primary' }, 'NDEFMessage / Record')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, "new NDEFReader() 构造。reader.scan({ signal }) 返回 Promise 开始监听标签；reader.write(message, { overwrite, signal }) 写入 NDEF 消息。reader.onreading = (e: any) => 取 e.serialNumber / e.message（NDEFMessage）；e.message.records 是 NDEFRecord 数组，recordType 含 'empty'|'text'|'url'|'smart-poster'|'absolute-url'|'mime'|'unknown'，可调用 toRecords() / toText() / toJSON() / toDataURL() 解码。仅 Android Chrome 可用。"),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('NFC 扫描', { type: 'primary', size: 'sm', disabled: !ok, onClick: () => this._nfcScan() }), this._btn('构造 NDEF 消息', { size: 'sm', disabled: !ok, onClick: () => this._nfcBuildMessage() }), this._btn('write 演示', { size: 'sm', disabled: !ok, onClick: () => this._nfcWriteDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, 'NFC 状态 / 用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } }, h('code', {}, s.nfcInfo || '（点击「NFC 扫描」或对应演示按钮）')),
                h(Alert, {
                    type: 'warning',
                    message: 'Web NFC 仅 Android Chrome 可用',
                    description: '需 HTTPS + 用户手势 + 物理靠近 NFC 标签。write 的 overwrite:false 防误覆盖已有内容；scan 的 signal 用于取消监听。jsdom polyfill 的 scan/write 直接 resolve，无真实硬件事件。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 3：Gamepad API 游戏手柄 ===================
    _gamepadScan() {
        if (!this._has('gamepad')) {
            this._addLog('warn', 'Gamepad API 不可用（typeof navigator.getGamepads !== "function"）');
            return;
        }
        let pads = [];
        try {
            pads = Array.from(navigator.getGamepads() || []);
        }
        catch {
            pads = [];
        }
        const connected = pads.filter((p) => p);
        const list = connected.length
            ? connected.map((gp) => `#${gp.index} id="${gp.id}" connected=${gp.connected} mapping="${gp.mapping}"\n  axes=[${gp.axes ? Array.from(gp.axes).map((a) => a.toFixed(2)).join(', ') : ''}] (${gp.axes ? gp.axes.length : 0} 轴)\n` +
                `  buttons=${gp.buttons ? gp.buttons.length : 0} 个 timestamp=${gp.timestamp}\n  vibrationActuator=${gp.vibrationActuator ? '存在' : '无'}`).join('\n')
            : '（jsdom polyfill 返回 [null,null,null,null]，无真实手柄；按下手柄任意键后才会出现在 getGamepads）';
        this.setState({ gamepadInfo: 'navigator.getGamepads() 扫描结果：\n' +
                `  返回数组长度 = ${pads.length}（标准始终为 4，含 null 槽位）\n  已连接手柄数 = ${connected.length}\n\n` + list });
        this._addLog('pad', `getGamepads() → ${pads.length} 槽位，已连接 ${connected.length} 个手柄`);
        if (connected.length > 0 && !this._gamepadTimer) {
            this._gamepadTimer = setInterval(() => this._gamepadPoll(), 100);
        }
    }
    _gamepadPoll() {
        if (!this._has('gamepad'))
            return;
        let pads = [];
        try {
            pads = Array.from(navigator.getGamepads() || []).filter((p) => p);
        }
        catch {
            return;
        }
        if (pads.length === 0)
            return;
        const gp = pads[0];
        const now = Date.now();
        if (!this._gpLogTs || now - this._gpLogTs >= 1000) {
            this._gpLogTs = now;
            this._addLog('pad', `轮询 #${gp.index} axes=[${gp.axes ? Array.from(gp.axes).map((a) => a.toFixed(2)).join(',') : ''}] buttons=${gp.buttons ? gp.buttons.length : 0}`);
        }
    }
    _gamepadStop() {
        if (this._gamepadTimer) {
            clearInterval(this._gamepadTimer);
            this._gamepadTimer = null;
        }
        this._addLog('pad', '已停止 gamepad 轮询');
    }
    _gamepadLayout() {
        this.setState({ gamepadInfo: '===== Gamepad 标准映射按键布局（mapping === "standard"）=====\n\n' +
                '【Gamepad 字段】\n  .id 厂商/产品字符串（含 vendor/product id）· .index 槽位 0-3 · .connected bool\n  .timestamp 单调递增，输入变化时更新（用于差分检测）\n' +
                '  .axes Float32Array -1 到 1 · .buttons GamepadButton[]\n  .mapping "standard" | "" | "xr-standard" · .vibrationActuator GamepadHapticActuator\n\n' +
                '【GamepadButton 字段】.pressed bool · .touched bool · .value 0-1（模拟扳机键按压深度）\n\n' +
                '【standard 按键索引】\n  0=A / Xbox X        1=B / Xbox Circle    2=X / Xbox Square   3=Y / Xbox Triangle\n' +
                '  4=左肩键 LB          5=右肩键 RB           6=左扳机 LT          7=右扳机 RT\n  8=Select/Back       9=Start/Forward      10=左摇杆按下 L3     11=右摇杆按下 R3\n' +
                '  12=方向键上 ↑        13=方向键下 ↓         14=方向键左 ←        15=方向键右 →\n  16=Home/Guide/PS\n\n' +
                '【axes 索引】0=左摇杆 X  1=左摇杆 Y  2=右摇杆 X  3=右摇杆 Y\n\n' +
                '【vibrationActuator】.playEffect(type, options) → Promise<"complete"|"interrupted">\n' +
                "  type='dual-rumble'；options={ duration, startDelay, strongMagnitude(0-1), weakMagnitude(0-1) }\n  strongMagnitude=大马达（低频），weakMagnitude=小马达（高频）" });
        this._addLog('pad', '已展示 Gamepad standard 映射按键布局（0-16）与 axes/buttons/vibrationActuator 字段');
    }
    async _gamepadRumble() {
        if (!this._has('gamepad')) {
            this._addLog('warn', 'Gamepad API 不可用，无法触发振动');
            return;
        }
        let pads = [];
        try {
            pads = Array.from(navigator.getGamepads() || []).filter((p) => p);
        }
        catch {
            pads = [];
        }
        if (pads.length === 0) {
            this.setState({ gamepadInfo: 'GamepadHapticActuator 振动用法（无真实手柄，仅说明）：\n\n' +
                    "const actuator = navigator.getGamepads().filter((p: any) =>p)[0].vibrationActuator;\nawait actuator.playEffect('dual-rumble', {\n" +
                    '  duration: 500, startDelay: 0,\n  strongMagnitude: 1.0,  // 大马达（低频）0-1\n  weakMagnitude: 1.0,    // 小马达（高频）0-1\n});  // 返回 "complete" 或 "interrupted"\n\n' +
                    '说明：jsdom polyfill getGamepads 返回全 null，需浏览器 + 真实手柄；\n  按下手柄任意键后才会出现在 getGamepads，再调用 playEffect。' });
            this._addLog('warn', '未检测到已连接手柄（jsdom 全 null），已记录振动用法');
            return;
        }
        const gp = pads[0];
        const actuator = gp.vibrationActuator;
        if (!actuator || typeof actuator.playEffect !== 'function') {
            this._addLog('warn', `手柄 #${gp.index} 不支持 vibrationActuator`);
            return;
        }
        try {
            const result = await actuator.playEffect('dual-rumble', {
                duration: 500, startDelay: 0, strongMagnitude: 1.0, weakMagnitude: 1.0,
            });
            this._addLog('pad', `playEffect('dual-rumble', {duration:500, strong:1.0, weak:1.0}) → ${result}`);
            this.setState({ gamepadInfo: `GamepadHapticActuator.playEffect 演示：\n\n  手柄 #${gp.index} id="${gp.id}"\n` +
                    `  actuator.playEffect('dual-rumble', { duration:500, strongMagnitude:1.0, weakMagnitude:1.0 })\n  → 返回 "${result}"\n\n` +
                    'dual-rumble：strongMagnitude 控制大马达（低频隆隆），weakMagnitude 控制小马达（高频嗡嗡）。' });
        }
        catch (err) {
            this._addLog('warn', `playEffect 失败：${errInfo(err).name || 'Error'} — ${errInfo(err).message || ''}`);
        }
    }
    _renderCard3() {
        const s = this.state;
        const ok = this._has('gamepad');
        const card = new Card({
            title: '3. Gamepad API 游戏手柄',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['getGamepads', ok]]), h(Tag, { color: 'primary' }, 'Gamepad / Button / Actuator')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'navigator.getGamepads() 返回 Array<Gamepad|null>（始终长度 4）。Gamepad 含 .id / .index / .connected / .timestamp（输入变化时更新）/ .axes（Float32Array -1 到 1）/ .buttons（GamepadButton[]）/ .mapping（"standard"|""|"xr-standard"）/ .vibrationActuator。GamepadButton 含 .pressed / .touched / .value（0-1 模拟扳机）。window 监听 gamepadconnected / gamepaddisconnected。振动通过 vibrationActuator.playEffect("dual-rumble", { duration, startDelay, strongMagnitude, weakMagnitude })。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('扫描手柄', { type: 'primary', size: 'sm', disabled: !ok, onClick: () => this._gamepadScan() }), this._btn('停止轮询', { danger: true, size: 'sm', disabled: !ok, onClick: () => this._gamepadStop() }), this._btn('标准按键布局', { size: 'sm', onClick: () => this._gamepadLayout() }), this._btn('模拟振动', { type: 'primary', size: 'sm', disabled: !ok, onClick: () => this._gamepadRumble() })),
                h('div', { class: 'fs-sm text-secondary' }, '手柄扫描 / 布局 / 振动：'),
                h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } }, h('code', {}, s.gamepadInfo || '（点击「扫描手柄」或「标准按键布局」）')),
                h(Alert, {
                    type: 'info',
                    message: '手柄需按键激活后才出现在 getGamepads',
                    description: '浏览器为省电未按键的手柄不报告；首次按键触发 gamepadconnected 事件后 getGamepads 才返回该实例。timestamp 单调递增，可用于差分检测输入变化（值未变则 timestamp 不变）。standard 映射按键 0-16、axes 0-3 为统一布局。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 4：WebOTP API 一次性密码 ===================
    async _otpRequest() {
        if (!this._has('otp')) {
            this.setState({ otpInfo: 'WebOTP 不可用（credentials.get 或 OTPCredential 缺失）。\n\n' +
                    "用法：const cred = await navigator.credentials.get({ otp: { transport: ['sms'] }, signal: ac.signal });\nOTPCredential：.code（OTP 字符串）/ .type === \"otp\"\n" +
                    'SMS 格式：@example.com #12345 Your code is 123456\n\n点击「SMS 格式说明」查看完整格式与表单集成。' });
            this._addLog('warn', 'WebOTP 不可用（credentials.get 或 OTPCredential 缺失），已记录用法');
            return;
        }
        if (this._otpAbort) {
            try {
                this._otpAbort.abort();
            }
            catch { /* noop */ }
        }
        const ac = new AbortController();
        this._otpAbort = ac;
        this._addLog('otp', "navigator.credentials.get({ otp: { transport:['sms'] } }) 调用中，等待 SMS…");
        try {
            const cred = await navigator.credentials.get({ otp: { transport: ['sms'] }, signal: ac.signal });
            if (cred) {
                this.setState({ otpInfo: 'navigator.credentials.get({ otp: { transport:["sms"] } }) → OTPCredential：\n\n' +
                        `  cred.type = ${cred.type}\n  cred.code = ${cred.code ? `"${cred.code}"` : 'null（无 SMS 或 polyfill 返回 null）'}\n\n` +
                        '【OTPCredential 字段】.type === "otp"（类型标识）· .code（OTP 字符串，如 "123456"，可直接填入表单）\n\n' +
                        '说明：jsdom polyfill 的 credentials.get 返回 null（无真实 SMS）；\n  真实环境需 HTTPS + 收到符合格式的 SMS 才会返回 OTPCredential。' });
                this._addLog('otp', `credentials.get → type=${cred.type} code=${cred.code || '(null)'}`);
            }
            else {
                this.setState({ otpInfo: 'navigator.credentials.get({ otp: { transport:["sms"] } }) → null\n\n返回 null 的可能原因：\n  - jsdom polyfill 直接返回 null（无真实 SMS）\n  - 未收到符合格式的 SMS（需 @origin #code 前缀）\n  - 用户拒绝或超时\n\n' +
                        '【真实环境要求】\n  1. 页面必须 HTTPS\n  2. SMS 格式：@example.com #12345 Your code is 123456\n     （@后为来源域名，#后为格式版本，正文含 OTP）\n  3. <input autocomplete="one-time-code" inputmode="numeric"> 接收' });
                this._addLog('warn', 'credentials.get → null（无 SMS / polyfill 返回 null）');
            }
        }
        catch (err) {
            this._addLog('warn', `credentials.get 失败：${errInfo(err).name || 'Error'} — ${errInfo(err).message || ''}`);
            this.setState({ otpInfo: `WebOTP 请求失败：${errInfo(err).name || 'Error'} — ${errInfo(err).message || ''}\n（AbortError 为主动取消，属正常）` });
        }
        finally {
            this._otpAbort = null;
        }
    }
    _otpExplain() {
        this.setState({ otpInfo: '===== WebOTP SMS 格式与表单集成 =====\n\n' +
                '【调用】navigator.credentials.get({ otp: { transport: ["sms"] } }) → Promise<OTPCredential>\n  transport 必须为 ["sms"]；signal 可选（AbortController 取消）\n\n' +
                '【SMS 格式要求】短信正文必须以如下前缀开头（浏览器据此识别来源与 OTP）：\n  @example.com #12345 Your code is 123456\n  ↑origin       ↑格式版本  ↑OTP（通常是 6 位数字）\n  @ 后域名必须与当前页面 origin 一致，否则浏览器不返回\n\n' +
                '【OTPCredential 结构】.type === "otp" · .code（OTP 字符串，如 "123456"）\n\n' +
                '【表单集成】\n  <input autocomplete="one-time-code" inputmode="numeric" maxlength="6">\n  - autocomplete="one-time-code"：浏览器识别为 OTP 输入框\n  - inputmode="numeric"：移动端弹数字键盘\n  - 收到 OTPCredential 后将 cred.code 填入 input.value 并提交\n\n' +
                '【AbortController 取消】\n  navigator.credentials.get({ otp:{transport:[\'sms\']}, signal: ac.signal });\n  ac.abort();  // 用户手动输入后取消等待，抛 AbortError\n\n' +
                '【兼容性】Android Chrome 84+；需 HTTPS；iOS Safari 不支持。' });
        this._addLog('otp', '已展示 WebOTP SMS 格式（@origin #code）、autocomplete/inputmode 与 AbortController 取消用法');
    }
    _renderCard4() {
        const s = this.state;
        const ok = this._has('otp');
        const card = new Card({
            title: '4. WebOTP API 一次性密码',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['credentials.get(otp)', ok]]), h(Tag, { color: 'primary' }, 'OTPCredential')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, "navigator.credentials.get({ otp: { transport: ['sms'] } }) 返回 Promise<OTPCredential>。OTPCredential 含 .code（OTP 字符串）与 .type === 'otp'。要求页面 HTTPS 且 SMS 以 @origin #code 前缀开头（如 @example.com #12345 Your code is 123456）。配合 <input autocomplete=\"one-time-code\" inputmode=\"numeric\"> 接收。AbortController.signal 取消等待。"),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('请求 OTP', { type: 'primary', size: 'sm', disabled: !ok, onClick: () => this._otpRequest() }), this._btn('SMS 格式说明', { size: 'sm', onClick: () => this._otpExplain() })),
                h('div', { class: 'fs-sm text-secondary' }, 'WebOTP 状态 / 用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } }, h('code', {}, s.otpInfo || '（点击「请求 OTP」或「SMS 格式说明」）')),
                h(Alert, {
                    type: 'info',
                    message: 'WebOTP 需 HTTPS + 符合格式的 SMS',
                    description: 'SMS 必须以 @<页面域名> #<格式版本> 开头，浏览器据此校验来源并提取 OTP。Android Chrome 84+ 支持，iOS Safari 不支持。jsdom polyfill 的 credentials.get 返回 null，仅演示调用流程。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 5：Compute Pressure API 计算压力 ===================
    _pressureStart() {
        if (!this._has('pressure')) {
            this.setState({ pressureInfo: 'Compute Pressure 不可用（typeof PressureObserver === "undefined"）。\n\n' +
                    "用法：const observer = new PressureObserver((changes: any) => {...}, { sampleRate: 1.0 });\nobserver.observe('cpu'); observer.disconnect(); observer.takeRecords();\n" +
                    'PressureRecord：.source / .state / .time / .averages / .maxes\nPressureObserver.knownSources → ["cpu","gpu"]\n\n点击「档位 / 场景说明」查看 4 档含义与使用场景。' });
            this._addLog('warn', 'PressureObserver 不可用（typeof PressureObserver === "undefined"），已记录用法');
            return;
        }
        try {
            if (this._pressureObserver) {
                try {
                    this._pressureObserver.disconnect();
                }
                catch { /* noop */ }
            }
            let observed = false;
            const observer = new PressureObserver((changes) => {
                const recs = Array.isArray(changes) ? changes : [];
                recs.forEach((rec) => {
                    this._addLog('pressure', `回调 → source=${rec.source} state=${rec.state} time=${rec.time}`);
                });
            }, { sampleRate: 1.0 });
            this._pressureObserver = observer;
            try {
                observer.observe('cpu');
                observed = true;
            }
            catch (e) {
                this._addLog('warn', `observe('cpu') 失败：${errInfo(e).name || 'Error'} — ${errInfo(e).message || ''}`);
            }
            const knownSources = PressureObserver.knownSources || PressureObserver.supportedSources || [];
            this.setState({ pressureInfo: '已创建 PressureObserver 并观察 cpu：\n\n  new PressureObserver(callback, { sampleRate: 1.0 })\n' +
                    `  observer.observe('cpu') → ${observed ? '已开始观察' : '失败（见日志）'}\n  callback 收到 (changes, observer)：changes 为 PressureRecord[]\n\n` +
                    '【PressureRecord 字段】\n  .source "cpu" | "gpu" · .state "nominal"|"fair"|"serious"|"critical"\n  .time 时间戳 · .averages 平均值数组 · .maxes 最大值数组\n\n' +
                    `【PressureObserver.knownSources】= [${Array.from(knownSources).join(', ')}]\n\n【其他方法】.unobserve(source) / .disconnect() / .takeRecords()\n\n` +
                    '说明：jsdom polyfill 不产生真实回调（无真实压力数据）；真实环境每达到 sampleRate 或档位变化时触发回调。' });
            this._addLog('pressure', `PressureObserver 已创建，observe('cpu')=${observed}，knownSources=[${Array.from(knownSources).join(',')}]`);
        }
        catch (err) {
            this._addLog('warn', `创建 PressureObserver 失败：${errInfo(err).name || 'Error'} — ${errInfo(err).message || ''}`);
        }
    }
    _pressureStop() {
        if (!this._pressureObserver) {
            this._addLog('warn', '无 PressureObserver 可断开');
            return;
        }
        try {
            this._pressureObserver.disconnect();
            this._addLog('pressure', 'PressureObserver.disconnect() 已断开');
            this.setState({ pressureInfo: 'PressureObserver 已 disconnect()，不再接收压力回调。重新点击「开始观察 cpu」可重建。' });
        }
        catch (err) {
            this._addLog('warn', `disconnect 失败：${errInfo(err).name || 'Error'} — ${errInfo(err).message || ''}`);
        }
        this._pressureObserver = null;
    }
    _pressureExplain() {
        this.setState({ pressureInfo: '===== Compute Pressure 档位与使用场景 =====\n\n' +
                '【PressureObserver 构造】new PressureObserver(callback, { sampleRate })\n  callback(changes: PressureRecord[], observer) · sampleRate 每秒最大回调次数（0-1）\n\n' +
                '【PressureRecord 字段】\n  .source "cpu" | "gpu" · .time 高精度时间戳 · .averages / .maxes 数组\n  .state 压力档位（4 档递增）：\n' +
                '    "nominal"  空闲，设备可承受更多负载\n    "fair"     负载较高但稳定，可继续\n    "serious"  负载很重，建议降级\n    "critical" 接近极限，应立即降级以免死机/掉帧\n\n' +
                '【observe / unobserve / disconnect / takeRecords】\n  observer.observe(\'cpu\');     // 开始观察 cpu\n  observer.unobserve(\'cpu\');   // 停止观察 cpu\n  observer.disconnect();       // 断开所有源\n  observer.takeRecords();      // 取出并清空积压记录\n\n' +
                '【静态属性】PressureObserver.knownSources → ["cpu", "gpu"]（部分实现叫 supportedSources）\n\n' +
                '【使用场景】\n  1. 自适应流媒体：serious/critical 时降低分辨率/帧率\n  2. 节流后台任务：nominal 时全速跑后台计算，critical 时暂停\n  3. 游戏画质动态调整：根据 cpu/gpu 压力降级特效\n  4. 避免设备过热降频：提前降负载而非被动等待\n\n' +
                '【隐私】不暴露精确利用率，仅 4 档模糊状态，保护用户隐私。' });
        this._addLog('pressure', '已展示 Compute Pressure 4 档（nominal/fair/serious/critical）与自适应场景说明');
    }
    _renderCard5() {
        const s = this.state;
        const ok = this._has('pressure');
        const card = new Card({
            title: '5. Compute Pressure API 计算压力',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['PressureObserver', ok]]), h(Tag, { color: 'primary' }, 'PressureRecord')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, "new PressureObserver(callback, { sampleRate }) 创建观察器。callback 收到 (changes, observer)，changes 为 PressureRecord[]。.observe('cpu'|'gpu') 开始观察，.unobserve(source) / .disconnect() / .takeRecords() 控制。PressureRecord 含 .source / .state（'nominal'|'fair'|'serious'|'critical'）/ .time / .averages / .maxes。静态 PressureObserver.knownSources 列已知源。用途：自适应流媒体画质、节流后台任务、游戏特效降级。"),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('开始观察 cpu', { type: 'primary', size: 'sm', disabled: !ok, onClick: () => this._pressureStart() }), this._btn('断开 observer', { danger: true, size: 'sm', disabled: !ok, onClick: () => this._pressureStop() }), this._btn('档位 / 场景说明', { size: 'sm', onClick: () => this._pressureExplain() })),
                h('div', { class: 'fs-sm text-secondary' }, 'Compute Pressure 状态 / 用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } }, h('code', {}, s.pressureInfo || '（点击「开始观察 cpu」或「档位说明」）')),
                h(Alert, {
                    type: 'info',
                    message: 'Compute Pressure 仅暴露 4 档模糊状态以保护隐私',
                    description: '不报告精确 CPU/GPU 利用率，仅 nominal/fair/serious/critical 四档，避免指纹追踪。single_page_test.mjs 提供 polyfill（observe/disconnect 可调用但无真实回调），真实浏览器需 Chrome 125+。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 6：Digital Goods API 数字商品 ===================
    _dgDetect() {
        const ok = this._has('digitalGoods');
        const dgs = typeof navigator !== 'undefined' ? (typeof navigator.digitalGoodsService !== 'undefined' ? '可用' : 'undefined') : 'undefined';
        this.setState({ digitalGoodsInfo: 'Digital Goods API 能力检测：\n\n' +
                `  typeof window.digitalGoods = ${ok ? 'object（可用）' : 'undefined（不可用）'}\n  typeof navigator.digitalGoodsService = ${dgs}\n\n` +
                '【入口】window.digitalGoods（DigitalGoodsService 实例）· navigator.digitalGoodsService（别名）\n\n' +
                '【DigitalGoodsService 方法】\n  .getPublisherName()              → Promise<string>（发行商名）\n  .listPurchases()                 → Promise<ItemDetails[]>（已购列表）\n' +
                '  .consume(purchaseToken)          → Promise（消费已购商品）\n  .purchase(item)                  → Promise<PurchaseResult>（发起购买）\n  .acknowledge(purchaseToken)      → Promise（确认购买，部分实现）\n\n' +
                '【ItemDetails 字段】.itemId / .title / .description / .price\n【PurchaseResult 字段】.purchaseToken / .itemDetails 等\n\n' +
                `当前环境：${ok ? '可用，可调用真实方法' : '不可用（仅 Android Chrome + Google Play Billing 提供）'}。\njsdom 中 window.digitalGoods 为 undefined，下方按钮仅记录流程说明。` });
        this._addLog('digitalGoods', `检测：window.digitalGoods=${ok ? '可用' : 'undefined'}, navigator.digitalGoodsService=${dgs}`);
    }
    _dgExplainFlow() {
        this.setState({ digitalGoodsInfo: '===== Digital Goods / Play Billing 集成流程 =====\n\n' +
                '【适用场景】PWA 内购（In-App Purchases），通过 Google Play Billing 接入 Android Chrome 安装的 PWA。\n\n' +
                '【前置：声明 payments-manifest】\n  <link rel="payments-manifest" href="/payments-manifest.json">\n  manifest.json 描述发行商与商品 ID 映射，供 Play 商店校验。\n\n' +
                '【典型购买流程】\n  const name = await window.digitalGoods.getPublisherName();  // 1. 获取发行商名\n' +
                "  const result = await window.digitalGoods.purchase({ itemId: 'sku_premium' });  // 2. 发起购买\n  await window.digitalGoods.acknowledge(result.purchaseToken);  // 3. 确认购买（订阅型）\n" +
                '  // 或一次性消费型：await window.digitalGoods.consume(result.purchaseToken);\n  const items = await window.digitalGoods.listPurchases();  // 4. 查询已购（恢复购买 / 校验权益）\n  // items: [{ itemId, title, description, price, purchaseToken, ... }]\n\n' +
                '【ItemDetails 结构】.itemId（SKU）· .title · .description · .price（含货币符号字符串）\n\n' +
                '【PaymentRequest 配合】\n  const req = new PaymentRequest(\n    [{ supportedMethods: \'https://play.google.com/billing\' }],\n    { displayItems: [...], total: {...} }\n  );\n' +
                '  const resp = await req.show();  // 弹 Play 支付 UI\n  resp.details.purchaseToken;     // 取得 token 后调 consume/acknowledge\n\n' +
                '【兼容性】仅 Android Chrome + 已安装 PWA + Play 商店；其他平台不可用。\n  <link rel="payments-manifest"> 是必需的入口声明。' });
        this._addLog('digitalGoods', '已展示 Digital Goods / Play Billing 集成流程（payments-manifest / purchase / consume / listPurchases）');
    }
    async _dgListPurchases() {
        if (!this._has('digitalGoods')) {
            this.setState({ digitalGoodsInfo: 'listPurchases 不可用（window.digitalGoods === undefined）。\n\n' +
                    '用法：const pub = await window.digitalGoods.getPublisherName();\n  const items = await window.digitalGoods.listPurchases();  // 恢复购买\n' +
                    '  await window.digitalGoods.consume(purchaseToken);  // 消费一次性商品\nItemDetails：.itemId / .title / .description / .price\n\n点击「Play Billing 流程」查看完整购买 / 确认 / 查询流程。' });
            this._addLog('warn', 'window.digitalGoods 不可用，已记录 listPurchases / consume 流程说明');
            return;
        }
        try {
            const publisher = await window.digitalGoods.getPublisherName();
            const purchases = await window.digitalGoods.listPurchases();
            const list = Array.isArray(purchases) ? purchases : [];
            const items = list.length
                ? list.map((it) => `  [${it.itemId}] ${it.title} | ${it.description || '-'} | ${it.price || '-'}`).join('\n')
                : '（无已购商品）';
            this.setState({ digitalGoodsInfo: `DigitalGoodsService 真实调用：\n\n  getPublisherName() → "${publisher}"\n  listPurchases() → ${list.length} 个已购商品\n\n` + items });
            this._addLog('digitalGoods', `getPublisherName="${publisher}", listPurchases → ${list.length} 项`);
        }
        catch (err) {
            this._addLog('warn', `Digital Goods 调用失败：${errInfo(err).name || 'Error'} — ${errInfo(err).message || ''}`);
        }
    }
    _renderCard6() {
        const s = this.state;
        const ok = this._has('digitalGoods');
        const card = new Card({
            title: '6. Digital Goods API 数字商品',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['digitalGoods', ok]]), h(Tag, { color: 'primary' }, 'Play Billing')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'window.digitalGoods / navigator.digitalGoodsService 提供 DigitalGoodsService。.getPublisherName() 返回发行商名；.listPurchases() 返回 ItemDetails[]；.consume(purchaseToken) 消费已购商品；.purchase(item) 发起购买返回 PurchaseResult。ItemDetails 含 .itemId / .title / .description / .price。配合 <link rel="payments-manifest"> 与 PaymentRequest（supportedMethods: https://play.google.com/billing）实现 PWA 内购（Google Play Billing 集成）。仅 Android Chrome 可用。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('检测能力', { type: 'primary', size: 'sm', onClick: () => this._dgDetect() }), this._btn('Play Billing 流程', { size: 'sm', onClick: () => this._dgExplainFlow() }), this._btn('listPurchases', { size: 'sm', disabled: !ok, onClick: () => this._dgListPurchases() })),
                h('div', { class: 'fs-sm text-secondary' }, 'Digital Goods 状态 / 用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } }, h('code', {}, s.digitalGoodsInfo || '（点击「检测能力」或「Play Billing 流程」）')),
                h(Alert, {
                    type: 'warning',
                    message: 'Digital Goods API 仅 Android Chrome + Play Billing 可用',
                    description: '需已安装的 PWA + Google Play 商店 + <link rel="payments-manifest"> 声明。配合 PaymentRequest(supportedMethods: "https://play.google.com/billing") 弹出 Play 支付 UI，取得 purchaseToken 后调 consume/acknowledge。jsdom 完全不可用。',
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
        return h('div', { class: 'api-lab-page midi-nfc-gamepad-page' }, h('h2', { class: 'section-title' }, '设备通信与输入 API 实验室'), h('p', { class: 'fs-sm text-secondary mb-md' }, 'Web MIDI / Web NFC / Gamepad / WebOTP / Compute Pressure / Digital Goods —— 6 类与外部设备 / 系统状态通信的 API。本页聚焦 NativeInteropPage 与 HardwareDevicesPage 未深入的消息格式、记录结构与购买流程。'), s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderLogPanel());
    }
}
//# sourceMappingURL=WebMIDINFCGamepadPage.js.map