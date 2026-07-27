// =====================================================================
// NativeInteropPage.ts —— 硬件与原生互操作 API 实验室
// 演示 MDN：
//   1. WebHID + WebUSB                 —— navigator.hid / navigator.usb
//   2. Web Serial + Web Bluetooth     —— navigator.serial / navigator.bluetooth
//   3. Web MIDI + Web NFC             —— navigator.requestMIDIAccess / NDEFReader
//   4. Contact Picker + EyeDropper + Virtual Keyboard
//   5. Screen Capture + Media Session —— getDisplayMedia / navigator.mediaSession
// 多数 API 需要 HTTPS、用户手势与显式权限，且大量仅 Chromium 内核可用。
// 无真实硬件 / 权限时多数调用会以 NotFoundError/AbortError/SecurityError 失败，属正常。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class NativeInteropPage extends Page {
    _inited = false;
    _captureStream = null;
    _videoEl = null;
    _hidOpened = null;
    _usbOpened = null;
    _serialOpened = null;
    _serialReader = null;
    _btGattServer = null;
    _midiAccess = null;
    _nfcReader = null;
    _nfcText = '';
    initialState() {
        return {
            logs: [],
            hidDevices: [],
            usbDevices: [],
            serialPorts: [],
            btDevice: null,
            midiInputs: [],
            midiOutputs: [],
            nfcStatus: 'idle',
            contacts: [],
            contactProps: [],
            eyeColor: '',
            captureStream: null,
            captureInfo: '',
            mediaSessionState: 'none',
        };
    }
    componentDidMount() {
        if (this._inited)
            return;
        this._inited = true;
    }
    componentWillUnmount() {
        if (this._captureStream) {
            try {
                for (const t of this._captureStream.getTracks())
                    t.stop();
            }
            catch { /* noop */ }
            this._captureStream = null;
        }
        if (this._hidOpened) {
            for (const d of this._hidOpened) {
                try {
                    if (d.opened)
                        d.close();
                }
                catch { /* noop */ }
            }
            this._hidOpened = null;
        }
        if (this._usbOpened) {
            for (const d of this._usbOpened) {
                try {
                    if (d.opened)
                        d.close();
                }
                catch { /* noop */ }
            }
            this._usbOpened = null;
        }
        if (this._serialOpened) {
            for (const p of this._serialOpened) {
                try {
                    if (p.readable)
                        p.close();
                }
                catch { /* noop */ }
            }
            this._serialOpened = null;
        }
        if (this._btGattServer) {
            try {
                if (this._btGattServer.connected)
                    this._btGattServer.disconnect();
            }
            catch { /* noop */ }
            this._btGattServer = null;
        }
        if (this._midiAccess) {
            try {
                this._midiAccess.onstatechange = null;
            }
            catch { /* noop */ }
            this._midiAccess = null;
        }
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
            try {
                navigator.mediaSession.metadata = null;
            }
            catch { /* noop */ }
            const cleanupActions = ['play', 'pause', 'previoustrack', 'nexttrack', 'seekbackward', 'seekforward'];
            for (const a of cleanupActions) {
                try {
                    navigator.mediaSession.setActionHandler(a, null);
                }
                catch { /* noop */ }
            }
        }
    }
    _addLog(type, content) {
        this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
    }
    _btn(label, opts) {
        const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
        this.registerChild(btn);
        return btn.render();
    }
    _caps() {
        const nav = typeof navigator !== 'undefined' ? navigator : null;
        const win = typeof window !== 'undefined' ? window : null;
        return {
            hid: 'hid' in nav,
            usb: 'usb' in nav,
            serial: 'serial' in nav,
            bluetooth: 'bluetooth' in nav,
            midi: 'requestMIDIAccess' in nav,
            nfc: 'NDEFReader' in win,
            contacts: 'contacts' in nav,
            eyeDropper: 'EyeDropper' in win,
            virtualKeyboard: 'virtualKeyboard' in nav,
            displayMedia: !!nav.mediaDevices && typeof nav.mediaDevices.getDisplayMedia === 'function',
            mediaSession: 'mediaSession' in nav,
        };
    }
    _capTag(ok) {
        return ok ? h(Tag, { color: 'success' }, '支持') : h(Tag, { color: 'error' }, '不支持');
    }
    _kvRow(label, value, unit = '') {
        const text = value == null ? 'N/A' : `${value}${unit}`;
        return h('div', { class: 'flex items-center gap-sm' }, h('span', { class: 'fs-sm text-secondary', style: { minWidth: '150px' } }, label), h('span', { class: 'fs-sm', style: { wordBreak: 'break-all' } }, text));
    }
    _logApiErr(tag, api, err) {
        const name = err && err.name ? err.name : 'Error';
        const msg = err && err.message ? err.message : String(err);
        this._addLog(tag, `${api} 失败：${name} — ${msg}`);
    }
    // ============ Card 1: WebHID ============
    async _hidRequest() {
        if (!this._caps().hid) {
            this._addLog('err', '当前浏览器不支持 WebHID');
            return;
        }
        try {
            const devices = await navigator.hid.requestDevice({ filters: [] });
            this.setState({ hidDevices: devices });
            this._addLog('hid', `requestDevice({ filters: [] }) → ${devices.length} 个设备`);
        }
        catch (err) {
            this._logApiErr('hid', 'requestDevice', err);
        }
    }
    async _hidList() {
        if (!this._caps().hid) {
            this._addLog('err', '当前浏览器不支持 WebHID');
            return;
        }
        try {
            const devices = await navigator.hid.getDevices();
            this.setState({ hidDevices: devices });
            this._addLog('hid', `getDevices() → ${devices.length} 个已配对设备`);
        }
        catch (err) {
            this._logApiErr('hid', 'getDevices', err);
        }
    }
    async _hidOpen(device) {
        try {
            if (!device.opened)
                await device.open();
            (this._hidOpened = this._hidOpened || []).push(device);
            this._addLog('hid', `HIDDevice.open() → opened=${device.opened} name=${device.name}`);
        }
        catch (err) {
            this._logApiErr('hid', 'open', err);
        }
    }
    // ============ Card 1: WebUSB ============
    async _usbRequest() {
        if (!this._caps().usb) {
            this._addLog('err', '当前浏览器不支持 WebUSB');
            return;
        }
        try {
            const device = await navigator.usb.requestDevice({ filters: [] });
            this.setState({ usbDevices: [device] });
            this._addLog('usb', `requestDevice({ filters: [] }) → ${device.productName || 'USB 设备'} (vid=0x${device.vendorId.toString(16)} pid=0x${device.productId.toString(16)})`);
        }
        catch (err) {
            this._logApiErr('usb', 'requestDevice', err);
        }
    }
    async _usbList() {
        if (!this._caps().usb) {
            this._addLog('err', '当前浏览器不支持 WebUSB');
            return;
        }
        try {
            const devices = await navigator.usb.getDevices();
            this.setState({ usbDevices: devices });
            this._addLog('usb', `getDevices() → ${devices.length} 个已配对设备`);
        }
        catch (err) {
            this._logApiErr('usb', 'getDevices', err);
        }
    }
    async _usbOpen(device) {
        try {
            if (!device.opened)
                await device.open();
            (this._usbOpened = this._usbOpened || []).push(device);
            const cfg = device.configuration;
            this._addLog('usb', `USBDevice.open() opened=${device.opened} config=${cfg ? cfg.configurationValue : 'none'}`);
        }
        catch (err) {
            this._logApiErr('usb', 'open', err);
        }
    }
    // ============ Card 2: Web Serial ============
    async _serialRequest() {
        if (!this._caps().serial) {
            this._addLog('err', '当前浏览器不支持 Web Serial');
            return;
        }
        try {
            const port = await navigator.serial.requestPort({ filters: [] });
            this.setState({ serialPorts: [port] });
            this._addLog('serial', `requestPort({ filters: [] }) → 已选择一个端口`);
        }
        catch (err) {
            this._logApiErr('serial', 'requestPort', err);
        }
    }
    async _serialList() {
        if (!this._caps().serial) {
            this._addLog('err', '当前浏览器不支持 Web Serial');
            return;
        }
        try {
            const ports = await navigator.serial.getPorts();
            this.setState({ serialPorts: ports });
            this._addLog('serial', `getPorts() → ${ports.length} 个可用端口`);
        }
        catch (err) {
            this._logApiErr('serial', 'getPorts', err);
        }
    }
    async _serialOpen(port) {
        try {
            await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
            (this._serialOpened = this._serialOpened || []).push(port);
            const info = port.getInfo();
            this._addLog('serial', `port.open({baudRate:9600}) usbVendorId=0x${(info.usbVendorId || 0).toString(16)} usbProductId=0x${(info.usbProductId || 0).toString(16)}`);
            this._serialRead(port);
        }
        catch (err) {
            this._logApiErr('serial', 'open', err);
        }
    }
    async _serialRead(port) {
        if (!port.readable)
            return;
        try {
            const reader = port.readable.getReader();
            this._serialReader = reader;
            this._addLog('serial', '已获取 readable reader，等待接收数据…');
            (async () => {
                try {
                    while (true) {
                        const { value, done } = await reader.read();
                        if (done)
                            break;
                        const arr = Array.from(value);
                        this._addLog('serial', `reader.read() → [${arr.slice(0, 16).join(', ')}${arr.length > 16 ? ', …' : ''}] (${arr.length} bytes)`);
                    }
                }
                catch { /* reader 取消或端口关闭 */ }
                try {
                    reader.releaseLock();
                }
                catch { /* noop */ }
            })();
        }
        catch (err) {
            this._logApiErr('serial', 'getReader', err);
        }
    }
    // ============ Card 2: Web Bluetooth ============
    async _btRequest() {
        if (!this._caps().bluetooth) {
            this._addLog('err', '当前浏览器不支持 Web Bluetooth');
            return;
        }
        try {
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ services: ['heart_rate'] }],
                optionalServices: ['battery_service', 'device_information'],
            });
            this.setState({ btDevice: device });
            this._addLog('bt', `requestDevice({ filters:[{services:['heart_rate']}] }) → ${device.name || 'BT 设备'} id=${device.id}`);
        }
        catch (err) {
            this._logApiErr('bt', 'requestDevice', err);
        }
    }
    async _btConnectGatt() {
        const device = this.state.btDevice;
        if (!device) {
            this._addLog('err', '请先选择蓝牙设备');
            return;
        }
        try {
            const server = await device.gatt.connect();
            this._btGattServer = server;
            this._addLog('bt', `device.gatt.connect() → connected=${server.connected}`);
            const svc = await server.getPrimaryService('heart_rate');
            this._addLog('bt', `getPrimaryService('heart_rate') → ${svc.uuid}`);
            const ch = await svc.getCharacteristic('heart_rate_measurement');
            this._addLog('bt', `getCharacteristic('heart_rate_measurement') → ${ch.uuid}`);
            this.on(ch, 'characteristicvaluechanged', (e) => {
                const target = e.target;
                const dv = target.value;
                const hr = dv.getUint8(1);
                this._addLog('bt', `characteristicvaluechanged → 心率=${hr} bpm (DataView)`);
            });
            await ch.startNotifications();
            this._addLog('bt', 'startNotifications() → 已订阅特征值变更');
            const dv = await ch.readValue();
            const hr = dv.getUint8(1);
            this._addLog('bt', `readValue() → 心率=${hr} bpm (DataView)`);
        }
        catch (err) {
            this._logApiErr('bt', 'gatt', err);
        }
    }
    // ============ Card 3: Web MIDI ============
    async _midiRequest() {
        if (!this._caps().midi) {
            this._addLog('err', '当前浏览器不支持 Web MIDI');
            return;
        }
        try {
            const access = await navigator.requestMIDIAccess({ sysex: false });
            this._midiAccess = access;
            const inputs = [];
            const outputs = [];
            access.inputs.forEach((p) => inputs.push({ id: p.id, name: p.name, manufacturer: p.manufacturer, state: p.state, type: p.type }));
            access.outputs.forEach((p) => outputs.push({ id: p.id, name: p.name, manufacturer: p.manufacturer, state: p.state, type: p.type }));
            this.setState({ midiInputs: inputs, midiOutputs: outputs });
            this._addLog('midi', `requestMIDIAccess({ sysex: false }) → inputs=${inputs.length} outputs=${outputs.length}`);
            access.onstatechange = (e) => {
                this._addLog('midi', `onstatechange → ${e.port.name} state=${e.port.state} connection=${e.port.connection}`);
            };
            if (access.inputs.size > 0) {
                const firstIn = access.inputs.values().next().value;
                firstIn.onmidimessage = (e) => {
                    const d = e.data;
                    this._addLog('midi', `midimessage → [${d[0]}, ${d[1]}, ${d[2]}] (Uint8Array)`);
                };
            }
        }
        catch (err) {
            this._logApiErr('midi', 'requestMIDIAccess', err);
        }
    }
    // ============ Card 3: Web NFC ============
    async _nfcScan() {
        if (!('NDEFReader' in window)) {
            this._addLog('err', '当前浏览器不支持 Web NFC');
            return;
        }
        try {
            const reader = new window.NDEFReader();
            this._nfcReader = reader;
            this.setState({ nfcStatus: 'scanning' });
            this._addLog('nfc', 'NDEFReader.scan() 调用中，请将 NFC 标签靠近设备…');
            reader.addEventListener('reading', (e) => {
                const n = e.message ? e.message.records.length : 0;
                this._addLog('nfc', `reading → serialNumber=${e.serialNumber} records=${n}`);
                if (e.message && e.message.records) {
                    e.message.records.forEach((r, i) => {
                        this._addLog('nfc', `record#${i} type=${r.recordType} media=${r.mediaType || '-'} dataLen=${r.data ? r.data.byteLength : 0}`);
                    });
                }
            });
            reader.addEventListener('readingerror', () => {
                this._addLog('err', 'readingerror → 无法读取标签');
            });
            await reader.scan();
        }
        catch (err) {
            this.setState({ nfcStatus: 'idle' });
            this._logApiErr('nfc', 'scan', err);
        }
    }
    async _nfcWrite() {
        if (!('NDEFReader' in window)) {
            this._addLog('err', '当前浏览器不支持 Web NFC');
            return;
        }
        const msg = this._nfcText || 'Hello from API Lab';
        try {
            const writer = new window.NDEFReader();
            this._addLog('nfc', `NDEFReader.write('${msg}', { overwrite: true }) 调用中…`);
            await writer.write(msg, { overwrite: true });
            this._addLog('nfc', `write() → 成功写入 "${msg}"`);
        }
        catch (err) {
            this._logApiErr('nfc', 'write', err);
        }
    }
    // ============ Card 4: Contact Picker ============
    async _contactsSelect() {
        if (!this._caps().contacts) {
            this._addLog('err', '当前浏览器不支持 Contact Picker API');
            return;
        }
        try {
            const contacts = await navigator.contacts.select(['name', 'email', 'tel'], { multiple: false });
            this.setState({ contacts });
            this._addLog('contact', `contacts.select(['name','email','tel'], {multiple:false}) → ${contacts.length} 个联系人`);
        }
        catch (err) {
            this._logApiErr('contact', 'select', err);
        }
    }
    async _contactsProps() {
        if (!this._caps().contacts) {
            this._addLog('err', '当前浏览器不支持 Contact Picker API');
            return;
        }
        try {
            const props = await navigator.contacts.getProperties();
            this.setState({ contactProps: props });
            this._addLog('contact', `getProperties() → [${props.join(', ')}]`);
        }
        catch (err) {
            this._logApiErr('contact', 'getProperties', err);
        }
    }
    // ============ Card 4: EyeDropper ============
    async _eyeOpen() {
        if (!('EyeDropper' in window)) {
            this._addLog('err', '当前浏览器不支持 EyeDropper API');
            return;
        }
        try {
            const ed = new window.EyeDropper();
            this._addLog('eye', 'EyeDropper.open() 调用中，请点击屏幕拾取像素颜色…');
            const res = await ed.open();
            this.setState({ eyeColor: res.sRGBHex });
            this._addLog('eye', `open() → sRGBHex=${res.sRGBHex}`);
        }
        catch (err) {
            this._logApiErr('eye', 'open', err);
        }
    }
    // ============ Card 4: Virtual Keyboard ============
    _vkShow() {
        if (!this._caps().virtualKeyboard) {
            this._addLog('err', '当前浏览器不支持 Virtual Keyboard API');
            return;
        }
        try {
            navigator.virtualKeyboard.show();
            this._addLog('vk', 'virtualKeyboard.show() 已调用（需 contenteditable/inputmode 与 manual 策略）');
        }
        catch (err) {
            this._logApiErr('vk', 'show', err);
        }
    }
    _vkHide() {
        if (!this._caps().virtualKeyboard) {
            this._addLog('err', '当前浏览器不支持 Virtual Keyboard API');
            return;
        }
        try {
            navigator.virtualKeyboard.hide();
            this._addLog('vk', 'virtualKeyboard.hide() 已调用');
        }
        catch (err) {
            this._logApiErr('vk', 'hide', err);
        }
    }
    // ============ Card 5: Screen Capture ============
    async _captureStart() {
        if (!this._caps().displayMedia) {
            this._addLog('err', '当前浏览器不支持 getDisplayMedia');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            this._captureStream = stream;
            const video = this.$('.js-screen-video');
            if (video) {
                this._videoEl = video;
                video.srcObject = stream;
            }
            const vtrack = stream.getVideoTracks()[0];
            const settings = vtrack ? vtrack.getSettings() : {};
            const info = `displaySurface=${settings.displaySurface || 'monitor'} ${settings.width || '?'}×${settings.height || '?'}@${settings.frameRate || '?'}fps`;
            this.setState({ captureStream: stream, captureInfo: info });
            if (vtrack) {
                vtrack.addEventListener('ended', () => {
                    this._addLog('screen', '用户在浏览器原生 UI 中停止了共享（track ended）');
                    this._captureStop();
                });
            }
            this._addLog('screen', `getDisplayMedia({ video:true, audio:true }) → ${info}`);
        }
        catch (err) {
            this._logApiErr('screen', 'getDisplayMedia', err);
        }
    }
    _captureStop() {
        if (!this._captureStream) {
            this._addLog('err', '当前没有进行中的屏幕捕获');
            return;
        }
        try {
            for (const t of this._captureStream.getTracks())
                t.stop();
            const video = this.$('.js-screen-video');
            if (video)
                video.srcObject = null;
            this._addLog('screen', '已停止屏幕捕获，所有 track.stop()');
        }
        catch (err) {
            this._addLog('err', `停止捕获失败：${err.message}`);
        }
        this._captureStream = null;
        this.setState({ captureStream: null, captureInfo: '' });
    }
    // ============ Card 5: Media Session ============
    _msSetup() {
        if (!this._caps().mediaSession) {
            this._addLog('err', '当前浏览器不支持 Media Session API');
            return;
        }
        try {
            const meta = { title: 'API 实验室示例曲目', artist: 'TRAE Demo', album: 'Native Interop Lab' };
            if (typeof window.MediaMetadata !== 'undefined') {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: meta.title, artist: meta.artist, album: meta.album,
                    artwork: [{ src: 'https://placehold.co/96x96/1677ff/ffffff/png', sizes: '96x96', type: 'image/png' }],
                });
            }
            const actions = ['play', 'pause', 'previoustrack', 'nexttrack', 'seekbackward', 'seekforward'];
            let ok = 0;
            for (const a of actions) {
                try {
                    navigator.mediaSession.setActionHandler(a, () => {
                        this._addLog('screen', `mediaSession action 触发：${a}`);
                    });
                    ok++;
                }
                catch (e) {
                    this._addLog('err', `setActionHandler('${a}') 失败：${e.name}`);
                }
            }
            try {
                navigator.mediaSession.playbackState = 'paused';
            }
            catch { /* noop */ }
            try {
                navigator.mediaSession.setPositionState({ duration: 200, position: 0, playbackRate: 1 });
            }
            catch { /* noop */ }
            this.setState({ mediaSessionState: 'paused' });
            this._addLog('screen', `MediaMetadata 已设置（${meta.title} - ${meta.artist}），注册 ${ok}/${actions.length} 个 actionHandler，playbackState=paused`);
        }
        catch (err) {
            this._addLog('err', `MediaSession 设置失败：${err.name} — ${err.message}`);
        }
    }
    _msSetState(state) {
        if (!this._caps().mediaSession) {
            this._addLog('err', '当前浏览器不支持 Media Session API');
            return;
        }
        try {
            navigator.mediaSession.playbackState = state;
        }
        catch { /* noop */ }
        this.setState({ mediaSessionState: state });
        this._addLog('screen', `mediaSession.playbackState → '${state}'`);
    }
    renderPage() {
        const caps = this._caps();
        const { hidDevices, usbDevices, serialPorts, btDevice, midiInputs, midiOutputs, nfcStatus, contacts, contactProps, eyeColor, captureStream, captureInfo, mediaSessionState, } = this.state;
        return [
            h('h2', { class: 'section-title' }, '硬件与原生互操作 API 实验室'),
            h(Alert, {
                type: 'info',
                message: 'WebHID / WebUSB / Web Serial / Web Bluetooth / Web MIDI / Web NFC / Contact Picker / EyeDropper / Virtual Keyboard / Screen Capture / Media Session',
                description: '本页演示连接硬件设备与原生平台特性的 Web API。多数 API 需要 HTTPS、用户手势触发与显式权限授权，且大量仅 Chromium 内核可用。所有按钮均会真实调用对应原生 API，结果写入下方日志。无真实硬件 / 权限时多数调用会以 NotFoundError/AbortError 失败，属正常现象。',
            }),
            h('div', { class: 'feature-grid mt-lg' }, 
            // ============ 1. WebHID + WebUSB ============
            h(Card, {
                title: '1. WebHID + WebUSB 人机接口与 USB 设备',
                extra: h('span', { class: 'flex items-center gap-xs' }, h(Tag, { color: 'primary' }, 'navigator.hid'), this._capTag(caps.hid), h(Tag, { color: 'primary' }, 'navigator.usb'), this._capTag(caps.usb)),
            }, h('div', { class: 'flex flex-col gap-sm' }, h('p', { class: 'fs-sm text-tertiary' }, 'WebHID：navigator.hid.requestDevice({ filters: [{ vendorId, productId }] }) 弹出浏览器授权框，返回 Promise<HIDDevice[]>；getDevices() 返回已配对设备。设备提供 open()/close()/sendReport(reportId, data)/sendFeatureReport()/receiveFeatureReport()，监听 inputreport 事件读取 e.data (DataView)、e.device、e.reportId。device.vendorId / productId / name / collections / opened 反映状态。'), h('p', { class: 'fs-sm text-tertiary' }, 'WebUSB：navigator.usb.requestDevice({ filters }) 返回 Promise<USBDevice>；getDevices() 返回已配对列表。设备提供 open()/close()/configuration、claimInterface(n)/releaseInterface()、transferIn(endpointNumber, length)/transferOut(endpointNumber, data)、controlTransferIn(setup, length)/controlTransferOut(setup, data)。device.vendorId / productId / productName / manufacturerName / serialNumber / configurations。'), (!caps.hid || !caps.usb) ? h(Alert, {
                type: 'warning',
                message: '部分 API 不支持',
                description: `WebHID=${caps.hid} / WebUSB=${caps.usb}，需 Chromium 内核 + HTTPS。详见 MDN WebHID / WebUSB 文档。`,
            }) : null, h('div', { class: 'flex flex-wrap gap-sm' }, this._btn('请求 HID 设备', { type: 'primary', size: 'sm', onClick: () => this._hidRequest(), disabled: !caps.hid }), this._btn('列出已配对 HID', { size: 'sm', onClick: () => this._hidList(), disabled: !caps.hid }), this._btn('请求 USB 设备', { type: 'primary', size: 'sm', onClick: () => this._usbRequest(), disabled: !caps.usb }), this._btn('列出已配对 USB', { size: 'sm', onClick: () => this._usbList(), disabled: !caps.usb })), hidDevices.length > 0 ? h('div', { class: 'flex flex-col gap-xs' }, ...hidDevices.map((d) => h('div', { class: 'log-panel', style: { height: 'auto', padding: '8px' } }, this._kvRow('HID name', d.name), this._kvRow('vendorId', '0x' + (d.vendorId || 0).toString(16)), this._kvRow('productId', '0x' + (d.productId || 0).toString(16)), this._kvRow('opened', String(d.opened)), this._kvRow('collections', (d.collections || []).length), this._btn('打开设备', { size: 'sm', onClick: () => this._hidOpen(d), disabled: !caps.hid || d.opened })))) : null, usbDevices.length > 0 ? h('div', { class: 'flex flex-col gap-xs' }, ...usbDevices.map((d) => h('div', { class: 'log-panel', style: { height: 'auto', padding: '8px' } }, this._kvRow('USB productName', d.productName), this._kvRow('manufacturerName', d.manufacturerName), this._kvRow('serialNumber', d.serialNumber), this._kvRow('vendorId', '0x' + (d.vendorId || 0).toString(16)), this._kvRow('productId', '0x' + (d.productId || 0).toString(16)), this._kvRow('opened', String(d.opened)), this._kvRow('configurations', (d.configurations || []).length), this._btn('打开设备', { size: 'sm', onClick: () => this._usbOpen(d), disabled: !caps.usb || d.opened })))) : null, h('p', { class: 'fs-xs text-tertiary' }, '权限框取消会抛 NotFoundError/AbortError，本页已统一捕获并记入日志。open()/close() 需真实硬件。'))), 
            // ============ 2. Web Serial + Web Bluetooth ============
            h(Card, {
                title: '2. Web Serial + Web Bluetooth 串口与蓝牙',
                extra: h('span', { class: 'flex items-center gap-xs' }, h(Tag, { color: 'primary' }, 'navigator.serial'), this._capTag(caps.serial), h(Tag, { color: 'primary' }, 'navigator.bluetooth'), this._capTag(caps.bluetooth)),
            }, h('div', { class: 'flex flex-col gap-sm' }, h('p', { class: 'fs-sm text-tertiary' }, 'Web Serial：navigator.serial.requestPort({ filters }) 返回 Promise<SerialPort>；getPorts() 返回可用端口。port.open({ baudRate, dataBits, stopBits, parity, flowControl }) 打开，port.readable / writable 是流，需用 reader/writer 收发字节；getInfo() 返回 { usbVendorId, usbProductId }；监听 connect / disconnect 事件。'), h('p', { class: 'fs-sm text-tertiary' }, `Web Bluetooth：navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }], optionalServices }) 返回 Promise<BluetoothDevice>。典型流程：device.gatt.connect() → server.getPrimaryService(uuid) → service.getCharacteristic(uuid) → characteristic.readValue() (DataView) / writeValue(data) / startNotifications()，监听 characteristicvaluechanged 取 e.target.value。`), (!caps.serial || !caps.bluetooth) ? h(Alert, {
                type: 'warning',
                message: '部分 API 不支持',
                description: `Web Serial=${caps.serial} / Web Bluetooth=${caps.bluetooth}，需 Chromium + HTTPS + 蓝牙/串口硬件。`,
            }) : null, h('div', { class: 'flex flex-wrap gap-sm' }, this._btn('请求串口', { type: 'primary', size: 'sm', onClick: () => this._serialRequest(), disabled: !caps.serial }), this._btn('列出可用串口', { size: 'sm', onClick: () => this._serialList(), disabled: !caps.serial }), this._btn('请求蓝牙设备', { type: 'primary', size: 'sm', onClick: () => this._btRequest(), disabled: !caps.bluetooth }), this._btn('连接 GATT (心率)', { size: 'sm', onClick: () => this._btConnectGatt(), disabled: !caps.bluetooth || !btDevice })), serialPorts.length > 0 ? h('div', { class: 'flex flex-col gap-xs' }, ...serialPorts.map((p, i) => {
                let info = {};
                try {
                    info = p.getInfo() || {};
                }
                catch { /* noop */ }
                return h('div', { class: 'log-panel', style: { height: 'auto', padding: '8px' } }, this._kvRow(`SerialPort #${i + 1}`, ''), this._kvRow('usbVendorId', info.usbVendorId ? '0x' + info.usbVendorId.toString(16) : '-'), this._kvRow('usbProductId', info.usbProductId ? '0x' + info.usbProductId.toString(16) : '-'), this._kvRow('readable', String(!!p.readable)), this._kvRow('writable', String(!!p.writable)), this._btn('打开端口 (9600,8,N,1)', { size: 'sm', onClick: () => this._serialOpen(p), disabled: !caps.serial }));
            })) : null, btDevice ? h('div', { class: 'log-panel', style: { height: 'auto', padding: '8px' } }, this._kvRow('BT name', btDevice.name), this._kvRow('id', btDevice.id), this._kvRow('gatt', btDevice.gatt ? 'BluetoothRemoteGATTServer' : 'N/A')) : null, h('p', { class: 'fs-xs text-tertiary' }, '蓝牙典型流程：requestDevice → gatt.connect → getPrimaryService → getCharacteristic → readValue/startNotifications。串口打开后会自动开启 readable reader 接收字节。'))), 
            // ============ 3. Web MIDI + Web NFC ============
            h(Card, {
                title: '3. Web MIDI + Web NFC MIDI 与近场通信',
                extra: h('span', { class: 'flex items-center gap-xs' }, h(Tag, { color: 'primary' }, 'requestMIDIAccess'), this._capTag(caps.midi), h(Tag, { color: 'primary' }, 'NDEFReader'), this._capTag(caps.nfc)),
            }, h('div', { class: 'flex flex-col gap-sm' }, h('p', { class: 'fs-sm text-tertiary' }, 'Web MIDI：navigator.requestMIDIAccess({ sysex: false }) 返回 Promise<MIDIAccess>。access.inputs / outputs 是 MIDIInput / MIDIOutput 的 Map。MIDIInput 监听 midimessage 取 e.data (Uint8Array [status, data1, data2])；MIDIOutput.send(data, timestamp) / clear()；access.onstatechange 监听设备插拔。'), h('p', { class: 'fs-sm text-tertiary' }, 'Web NFC：new NDEFReader() 构造。reader.scan({ signal }) 返回 Promise 开始扫描；监听 reading 取 e.serialNumber / e.message.records[]（{ recordType, mediaType, data, id, encoding, lang }）；readingerror 失败；reader.write(message, { overwrite }) 写入标签。'), (!caps.midi || !caps.nfc) ? h(Alert, {
                type: 'warning',
                message: '部分 API 不支持',
                description: `Web MIDI=${caps.midi} / Web NFC=${caps.nfc}，NFC 仅 Android Chrome 可用。`,
            }) : null, h('div', { class: 'flex flex-wrap gap-sm' }, this._btn('请求 MIDI 访问', { type: 'primary', size: 'sm', onClick: () => this._midiRequest(), disabled: !caps.midi }), this._btn('NFC 扫描', { type: 'primary', size: 'sm', onClick: () => this._nfcScan(), disabled: !caps.nfc }), this._btn('NFC 写入', { size: 'sm', onClick: () => this._nfcWrite(), disabled: !caps.nfc })), caps.nfc ? h('input', {
                class: 'input input--sm',
                placeholder: '要写入 NFC 的文本（默认 Hello from API Lab）',
                onInput: (e) => { this._nfcText = e.target.value; },
                style: { flex: '1', minWidth: '200px' },
            }) : null, h('div', { class: 'flex items-center gap-sm' }, h('span', { class: 'fs-xs text-secondary' }, 'NFC 状态：'), h(Tag, { color: nfcStatus === 'scanning' ? 'warning' : 'default' }, nfcStatus)), (midiInputs.length > 0 || midiOutputs.length > 0) ? h('div', { class: 'log-panel', style: { height: 'auto', padding: '8px' } }, this._kvRow('MIDI inputs', midiInputs.length), this._kvRow('MIDI outputs', midiOutputs.length), ...midiInputs.map((p) => this._kvRow(`[in] ${p.name}`, `${p.manufacturer || '-'} / ${p.state}`)), ...midiOutputs.map((p) => this._kvRow(`[out] ${p.name}`, `${p.manufacturer || '-'} / ${p.state}`))) : null)), 
            // ============ 4. Contact Picker + EyeDropper + Virtual Keyboard ============
            h(Card, {
                title: '4. Contact Picker + EyeDropper + Virtual Keyboard',
                extra: h('span', { class: 'flex items-center gap-xs' }, h(Tag, { color: 'primary' }, 'contacts'), this._capTag(caps.contacts), h(Tag, { color: 'primary' }, 'EyeDropper'), this._capTag(caps.eyeDropper), h(Tag, { color: 'primary' }, 'virtualKeyboard'), this._capTag(caps.virtualKeyboard)),
            }, h('div', { class: 'flex flex-col gap-sm' }, h('p', { class: 'fs-sm text-tertiary' }, 'Contact Picker：navigator.contacts.select([\'name\',\'email\',\'tel\'], { multiple }) 返回 Promise<ContactInfo[]>（需用户手势 + 安卓 Chrome）；getProperties() 返回可用属性数组。'), h('p', { class: 'fs-sm text-tertiary' }, 'EyeDropper：new EyeDropper() → open() 返回 Promise<{ sRGBHex }>，让用户从屏幕拾取像素颜色。Virtual Keyboard：navigator.virtualKeyboard.show()/hide()，overlaysContent 控制覆盖，geometrychange 事件取 boundingRect（需 virtualkeyboardpolicy=manual）。'), (!caps.contacts || !caps.eyeDropper || !caps.virtualKeyboard) ? h(Alert, {
                type: 'warning',
                message: '部分 API 不支持',
                description: `contacts=${caps.contacts} / eyeDropper=${caps.eyeDropper} / virtualKeyboard=${caps.virtualKeyboard}。`,
            }) : null, h('div', { class: 'flex flex-wrap gap-sm' }, this._btn('选择联系人', { type: 'primary', size: 'sm', onClick: () => this._contactsSelect(), disabled: !caps.contacts }), this._btn('查询可用属性', { size: 'sm', onClick: () => this._contactsProps(), disabled: !caps.contacts }), this._btn('屏幕拾色器', { type: 'primary', size: 'sm', onClick: () => this._eyeOpen(), disabled: !caps.eyeDropper }), this._btn('弹出虚拟键盘', { size: 'sm', onClick: () => this._vkShow(), disabled: !caps.virtualKeyboard }), this._btn('收起虚拟键盘', { size: 'sm', onClick: () => this._vkHide(), disabled: !caps.virtualKeyboard })), eyeColor ? h('div', { class: 'flex items-center gap-sm' }, h('span', { class: 'fs-sm text-secondary' }, '拾取的颜色：'), h('span', {
                style: {
                    display: 'inline-block', width: '32px', height: '32px',
                    backgroundColor: eyeColor, borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.2)', verticalAlign: 'middle',
                },
            }), h('code', { class: 'fs-sm' }, eyeColor)) : null, contacts.length > 0 ? h('div', { class: 'log-panel', style: { height: 'auto', padding: '8px' } }, this._kvRow('contacts count', contacts.length), ...contacts.map((c, i) => this._kvRow(`#${i + 1} name`, c.name ? (Array.isArray(c.name) ? c.name.join(' / ') : c.name) : '-')), ...contacts.map((c, i) => this._kvRow(`#${i + 1} email`, c.email ? (Array.isArray(c.email) ? c.email.join(' / ') : c.email) : '-'))) : null, contactProps.length > 0 ? h('p', { class: 'fs-xs text-tertiary' }, `ContactManager 可用属性：${contactProps.join(', ')}`) : null)), 
            // ============ 5. Screen Capture + Media Session ============
            h(Card, {
                title: '5. Screen Capture + Media Session 屏幕捕获与媒体会话',
                extra: h('span', { class: 'flex items-center gap-xs' }, h(Tag, { color: 'primary' }, 'getDisplayMedia'), this._capTag(caps.displayMedia), h(Tag, { color: 'primary' }, 'mediaSession'), this._capTag(caps.mediaSession)),
            }, h('div', { class: 'flex flex-col gap-sm' }, h('p', { class: 'fs-sm text-tertiary' }, 'Screen Capture：navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }) 返回 Promise<MediaStream>。stream.getVideoTracks()[0].getSettings() 返回 { displaySurface: \'monitor\'|\'window\'|\'browser\', width, height, frameRate }；监听 ended 事件；track.stop() 停止。'), h('p', { class: 'fs-sm text-tertiary' }, 'Media Session：navigator.mediaSession.metadata = new MediaMetadata({ title, artist, album, artwork:[{src,sizes,type}] })；setActionHandler(\'play\'|\'pause\'|\'previoustrack\'|\'nexttrack\'|\'seekbackward\'|\'seekforward\', handler)；playbackState (\'none\'|\'paused\'|\'playing\')；setPositionState({ duration, position, playbackRate })。'), (!caps.displayMedia || !caps.mediaSession) ? h(Alert, {
                type: 'warning',
                message: '部分 API 不支持',
                description: `getDisplayMedia=${caps.displayMedia} / mediaSession=${caps.mediaSession}。`,
            }) : null, h('div', { class: 'flex flex-wrap gap-sm' }, this._btn('开始屏幕捕获', { type: 'primary', size: 'sm', onClick: () => this._captureStart(), disabled: !caps.displayMedia || !!captureStream }), this._btn('停止捕获', { size: 'sm', danger: true, onClick: () => this._captureStop(), disabled: !captureStream }), this._btn('设置 MediaMetadata', { type: 'primary', size: 'sm', onClick: () => this._msSetup(), disabled: !caps.mediaSession }), this._btn('标记为播放中', { size: 'sm', onClick: () => this._msSetState('playing'), disabled: !caps.mediaSession }), this._btn('标记为暂停', { size: 'sm', onClick: () => this._msSetState('paused'), disabled: !caps.mediaSession })), h('video', {
                class: 'js-screen-video',
                autoplay: true, muted: true, playsInline: true,
                style: { width: '100%', maxHeight: '320px', background: '#1e1e1e', borderRadius: '8px', display: 'block' },
            }), captureInfo ? h('div', { class: 'log-panel', style: { height: 'auto', padding: '8px' } }, this._kvRow('capture status', captureStream ? 'streaming' : 'stopped'), this._kvRow('settings', captureInfo)) : null, caps.mediaSession ? h('div', { class: 'flex items-center gap-sm' }, h('span', { class: 'fs-sm text-secondary' }, 'mediaSession.playbackState：'), h(Tag, { color: mediaSessionState === 'playing' ? 'success' : (mediaSessionState === 'paused' ? 'warning' : 'default') }, mediaSessionState)) : null, h('p', { class: 'fs-xs text-tertiary' }, '捕获的流会显示在上方 <video> 中（autoplay muted）。停止后所有 track.stop()。设置 MediaMetadata 后系统媒体控件会显示标题/作者/封面。')))),
            // 事件日志
            h(Card, { title: '事件日志', extra: h('span', { class: 'fs-sm text-tertiary' }, '实时') }, h('div', { class: 'log-panel' }, ...this.state.logs.map((log) => h('div', { class: 'log-panel__line' }, h('span', { class: 'log-panel__time' }, log.time), h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type), h('span', {}, log.content))))),
        ];
    }
}
//# sourceMappingURL=NativeInteropPage.js.map