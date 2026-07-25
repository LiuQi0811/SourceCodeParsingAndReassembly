// =====================================================================
// HardwareDevicesPage.js —— 硬件设备 API 实验室
// 演示 MDN：Gamepad / WebHID / Web Serial / WebUSB / Web Bluetooth + Web NFC
// 多数 API 需要 HTTPS、用户手势与显式权限，且大量仅 Chromium 内核可用。
// jsdom 环境下这些 API 均不存在，本页通过 typeof/in 检测后给出 warn 提示，
// 并以 mock 数据演示返回结构，绝不抛异常。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// —— mock 数据：API 不可用（如 jsdom）时用于演示返回结构，均带 [MOCK] 标记 ——
const MOCK_HID_DEVICES = [
  { vendorId: 0x054c, productId: 0x09c2, name: 'Sony DualShock 4 [MOCK]', opened: false, collections: [{ usagePage: 1, usage: 0x9001 }] },
  { vendorId: 0x045e, productId: 0x02fd, name: 'Xbox Wireless Controller [MOCK]', opened: false, collections: [{ usagePage: 1, usage: 0x9005 }] },
];

const MOCK_SERIAL_PORT = {
  _mock: true,
  _opened: false,
  _baudRate: 0,
  usbVendorId: 0x1a86,
  usbProductId: 0x7523,
  get readable() { return null; },
  get writable() { return null; },
  getInfo() { return { usbVendorId: this.usbVendorId, usbProductId: this.usbProductId }; },
  async open(opts) { this._opened = true; this._baudRate = (opts && opts.baudRate) || 9600; return undefined; },
  async close() { this._opened = false; return undefined; },
};

const MOCK_USB_DEVICES = [
  {
    productName: 'Arduino Uno [MOCK]',
    manufacturerName: 'Arduino LLC',
    serialNumber: '95431303338351F0D1A1',
    vendorId: 0x2341,
    productId: 0x0043,
    opened: false,
    configurations: [{ configurationValue: 1, interfaces: [{ interfaceNumber: 0, alternates: [] }] }],
  },
];

const MOCK_BT_DEVICE = {
  id: 'bt/mock/heart-rate-001',
  name: 'Heart Rate Monitor [MOCK]',
  gatt: {
    connected: false,
    connect() { this.connected = true; return Promise.resolve(this); },
    disconnect() { this.connected = false; },
  },
  watchingAdvertisements: false,
};

export class HardwareDevicesPage extends Page {
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      gamepadList: [],
      hidDevices: [],
      serialPort: null,
      usbDevices: [],
      btDevice: null,
      nfcStatus: 'idle',
    };
  }

  componentDidMount() {
    // —— 一次性守卫（CRITICAL）：防止 setState → rerender → componentDidMount 无限循环 ——
    if (this._inited) return;
    this._inited = true;

    // —— 能力检测：typeof / in，jsdom 中以下 API 全部不存在 ——
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    const win = typeof window !== 'undefined' ? window : {};
    const caps = {
      gamepad: 'getGamepads' in nav && typeof nav.getGamepads === 'function',
      hid: 'hid' in nav,
      serial: 'serial' in nav,
      usb: 'usb' in nav,
      bluetooth: 'bluetooth' in nav,
      nfc: 'NDEFReader' in win || 'NFC' in win,
    };
    this._caps = caps;

    // 拼装能力摘要，写入 capsSummary 供顶部 Alert 展示
    const items = [
      ['Gamepad', caps.gamepad],
      ['WebHID', caps.hid],
      ['Serial', caps.serial],
      ['WebUSB', caps.usb],
      ['Bluetooth', caps.bluetooth],
      ['NFC', caps.nfc],
    ];
    const supported = items.filter(([, ok]) => ok).map(([n]) => n);
    const summary = '能力检测：' + items.map(([n, ok]) => `${n} ${ok ? '✓' : '✗'}`).join(' / ') +
      `（可用 ${supported.length}/${items.length}）`;
    this.setState({ capsSummary: summary });

    if (supported.length === 0) {
      this._addLog('warn', '当前环境（jsdom）不支持任何硬件设备 API，下方按钮将以 mock 数据演示返回结构');
    } else {
      this._addLog('pad', `硬件能力检测完成：可用 ${supported.length}/${items.length}（${supported.join(' / ')}）`);
    }

    // —— 注册全局硬件连接/断开事件（仅在对应 API 可用时绑定）——
    this._bindHardwareEvents();
  }

  // 绑定 navigator.bluetooth / serial / usb 的 connect/disconnect 与 window 的 gamepad 事件
  _bindHardwareEvents() {
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    // gamepad 连接/断开（window 事件，所有浏览器均存在 addEventListener）
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      this._gpConnUnbind = this.on(window, 'gamepadconnected', (e) => {
        const gp = (e && e.gamepad) || {};
        this._addLog('pad', `gamepadconnected → index=${gp.index} id=${gp.id} buttons=${(gp.buttons || []).length}`);
        this._gamepadScan();
      });
      this._gpDiscUnbind = this.on(window, 'gamepaddisconnected', (e) => {
        const gp = (e && e.gamepad) || {};
        this._addLog('pad', `gamepaddisconnected → index=${gp.index} id=${gp.id}`);
        this._gamepadScan();
      });
    }
    // bluetooth connect/disconnect
    if (this._caps && this._caps.bluetooth && typeof nav.bluetooth.addEventListener === 'function') {
      this._btConnUnbind = this.on(nav.bluetooth, 'connect', (e) => {
        this._addLog('bt', `bluetooth connect → ${(e.device && e.device.name) || 'BT 设备'}`);
      });
      this._btDiscUnbind = this.on(nav.bluetooth, 'disconnect', (e) => {
        this._addLog('bt', `bluetooth disconnect → ${(e.device && e.device.name) || 'BT 设备'}`);
      });
    }
    // serial connect/disconnect
    if (this._caps && this._caps.serial && typeof nav.serial.addEventListener === 'function') {
      this._serialConnUnbind = this.on(nav.serial, 'connect', () => {
        this._addLog('serial', 'serial connect → 端口已接入');
      });
      this._serialDiscUnbind = this.on(nav.serial, 'disconnect', () => {
        this._addLog('serial', 'serial disconnect → 端口已断开');
      });
    }
    // usb connect/disconnect
    if (this._caps && this._caps.usb && typeof nav.usb.addEventListener === 'function') {
      this._usbConnUnbind = this.on(nav.usb, 'connect', (e) => {
        this._addLog('usb', `usb connect → ${(e.device && e.device.productName) || 'USB 设备'}`);
      });
      this._usbDiscUnbind = this.on(nav.usb, 'disconnect', (e) => {
        this._addLog('usb', `usb disconnect → ${(e.device && e.device.productName) || 'USB 设备'}`);
      });
    }
  }

  componentWillUnmount() {
    // 1. 停止 gamepad 轮询定时器
    if (this._gamepadTimer) { clearInterval(this._gamepadTimer); this._gamepadTimer = null; }
    // 2. 解绑 gamepadconnected / gamepaddisconnected
    if (this._gpConnUnbind) { try { this._gpConnUnbind(); } catch { /* noop */ } this._gpConnUnbind = null; }
    if (this._gpDiscUnbind) { try { this._gpDiscUnbind(); } catch { /* noop */ } this._gpDiscUnbind = null; }
    // 3. 解绑 navigator.bluetooth connect/disconnect
    if (this._btConnUnbind) { try { this._btConnUnbind(); } catch { /* noop */ } this._btConnUnbind = null; }
    if (this._btDiscUnbind) { try { this._btDiscUnbind(); } catch { /* noop */ } this._btDiscUnbind = null; }
    // 4. 解绑 navigator.serial connect/disconnect
    if (this._serialConnUnbind) { try { this._serialConnUnbind(); } catch { /* noop */ } this._serialConnUnbind = null; }
    if (this._serialDiscUnbind) { try { this._serialDiscUnbind(); } catch { /* noop */ } this._serialDiscUnbind = null; }
    // 5. 解绑 navigator.usb connect/disconnect
    if (this._usbConnUnbind) { try { this._usbConnUnbind(); } catch { /* noop */ } this._usbConnUnbind = null; }
    if (this._usbDiscUnbind) { try { this._usbDiscUnbind(); } catch { /* noop */ } this._usbDiscUnbind = null; }
    // 6. 释放串口 reader 并关闭端口（mock 或真实）
    if (this._serialReader) {
      try { this._serialReader.cancel(); } catch { /* noop */ }
      try { this._serialReader.releaseLock(); } catch { /* noop */ }
      this._serialReader = null;
    }
    const port = this.state.serialPort;
    if (port) {
      try { if (port._opened || port.readable) port.close(); } catch { /* noop */ }
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

  _capTag(ok) {
    return ok ? h(Tag, { color: 'success' }, '支持') : h(Tag, { color: 'error' }, '不支持');
  }

  _kvRow(label, value, unit = '') {
    const text = value == null ? 'N/A' : `${value}${unit}`;
    return h('div', { class: 'flex items-center gap-sm' },
      h('span', { class: 'fs-sm text-secondary', style: { minWidth: '150px' } }, label),
      h('span', { class: 'fs-sm', style: { wordBreak: 'break-all' } }, text),
    );
  }

  // ============ Card 1: Gamepad API ============

  _gamepadScan() {
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    if (typeof nav.getGamepads !== 'function') {
      this._addLog('warn', '当前浏览器不支持 Gamepad API（navigator.getGamepads 不可用）');
      return;
    }
    let pads = [];
    try { pads = Array.from(nav.getGamepads() || []); } catch { pads = []; }
    const connected = pads.filter((p) => p);
    this.setState({ gamepadList: connected });
    this._addLog('pad', `getGamepads() → ${pads.length} 个槽位，已连接 ${connected.length} 个手柄`);
    // 若有手柄且未开启轮询，则开启 100ms 轮询
    if (connected.length > 0 && !this._gamepadTimer) {
      this._gamepadTimer = setInterval(() => this._gamepadPoll(), 100);
    }
  }

  _gamepadStop() {
    if (this._gamepadTimer) { clearInterval(this._gamepadTimer); this._gamepadTimer = null; }
    this.setState({ gamepadList: [] });
    this._addLog('pad', '已停止 gamepad 轮询');
  }

  // 轮询回调：读取 axes/buttons 实时值并刷新 state，日志每 ~1s 记一条避免刷屏
  _gamepadPoll() {
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    if (typeof nav.getGamepads !== 'function') return;
    let pads = [];
    try { pads = Array.from(nav.getGamepads() || []); } catch { return; }
    const connected = pads.filter((p) => p).map((gp) => ({
      index: gp.index,
      id: gp.id,
      connected: gp.connected,
      mapping: gp.mapping,
      timestamp: gp.timestamp,
      axes: gp.axes ? Array.from(gp.axes) : [],
      buttons: gp.buttons ? gp.buttons.map((b) => ({ pressed: b.pressed, touched: b.touched, value: b.value })) : [],
      hasActuator: !!(gp.vibrationActuator),
    }));
    this.setState({ gamepadList: connected });
    const now = Date.now();
    if (!this._gpLogTs || now - this._gpLogTs >= 1000) {
      this._gpLogTs = now;
      if (connected.length > 0) {
        const gp = connected[0];
        this._addLog('pad', `轮询 #${gp.index} axes=[${gp.axes.map((a) => a.toFixed(2)).join(',')}] buttons=${gp.buttons.length}`);
      }
    }
  }

  async _gamepadRumble() {
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    if (typeof nav.getGamepads !== 'function') {
      this._addLog('warn', '当前浏览器不支持 Gamepad API，无法触发振动');
      return;
    }
    let pads = [];
    try { pads = Array.from(nav.getGamepads() || []).filter((p) => p); } catch { pads = []; }
    if (pads.length === 0) {
      this._addLog('warn', '未检测到已连接手柄，无法振动');
      return;
    }
    const gp = pads[0];
    const actuator = gp.vibrationActuator;
    if (!actuator || typeof actuator.playEffect !== 'function') {
      this._addLog('warn', `手柄 #${gp.index} 不支持 vibrationActuator`);
      return;
    }
    try {
      await actuator.playEffect('dual-rumble', {
        duration: 500,
        weakMagnitude: 1.0,
        strongMagnitude: 1.0,
        startDelay: 0,
      });
      this._addLog('rumble', `playEffect('dual-rumble', {duration:500, weak:1.0, strong:1.0}) → 已触发`);
    } catch (err) {
      this._addLog('err', `playEffect 失败：${err.name || 'Error'} — ${err.message || ''}`);
    }
  }

  // ============ Card 2: WebHID API ============

  async _hidRequest() {
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    if (typeof nav.hid === 'undefined' || typeof nav.hid.requestDevice !== 'function') {
      this._addLog('warn', '当前浏览器不支持 WebHID（navigator.hid 不可用）');
      // 模拟：填充 mock 设备列表以演示返回结构
      this.setState({ hidDevices: MOCK_HID_DEVICES });
      this._addLog('hid', `（模拟）requestDevice → 返回 ${MOCK_HID_DEVICES.length} 个 mock 设备`);
      return;
    }
    try {
      const devices = await nav.hid.requestDevice({ filters: [{ vendorId: 0x054c, productId: 0x09c2 }] });
      this.setState({ hidDevices: devices });
      this._addLog('hid', `requestDevice({ filters:[{vendorId:0x054c,productId:0x09c2}] }) → ${devices.length} 个设备`);
      for (const d of devices) {
        this._addLog('report', `HIDDevice: name=${d.name} vid=0x${d.vendorId.toString(16)} pid=0x${d.productId.toString(16)} opened=${d.opened}`);
      }
    } catch (err) {
      this._addLog('err', `requestDevice 失败：${err.name || 'Error'} — ${err.message || ''}`);
    }
  }

  async _hidList() {
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    if (typeof nav.hid === 'undefined' || typeof nav.hid.getDevices !== 'function') {
      this._addLog('warn', '当前浏览器不支持 WebHID，getDevices() 不可用');
      return;
    }
    try {
      const devices = await nav.hid.getDevices();
      this.setState({ hidDevices: devices });
      this._addLog('hid', `getDevices() → ${devices.length} 个已授权设备`);
    } catch (err) {
      this._addLog('err', `getDevices 失败：${err.name || 'Error'} — ${err.message || ''}`);
    }
  }

  async _hidOpen(device) {
    if (!device) return;
    if (device._mock) {
      this._addLog('warn', 'mock 设备无法真正 open() / 接收 inputreport');
      return;
    }
    try {
      if (!device.opened) await device.open();
      this._addLog('hid', `device.open() → opened=${device.opened}`);
      this.on(device, 'inputreport', (e) => {
        const len = e.data && e.data.byteLength ? e.data.byteLength : 0;
        this._addLog('report', `inputreport → reportId=${e.reportId} dataLen=${len}`);
      });
    } catch (err) {
      this._addLog('err', `HID open 失败：${err.name || 'Error'} — ${err.message || ''}`);
    }
  }

  async _hidSendReport(device) {
    if (!device) return;
    if (device._mock) {
      this._addLog('warn', 'mock 设备无法真正 sendReport()');
      return;
    }
    try {
      if (!device.opened) await device.open();
      const data = new Uint8Array([0x01, 0x02, 0x03]);
      await device.sendReport(0x00, data);
      this._addLog('report', `sendReport(0x00, [0x01,0x02,0x03]) → 已发送 ${data.byteLength} 字节`);
    } catch (err) {
      this._addLog('err', `sendReport 失败：${err.name || 'Error'} — ${err.message || ''}`);
    }
  }

  async _hidReceiveFeature(device) {
    if (!device) return;
    if (device._mock) {
      this._addLog('warn', 'mock 设备无法真正 receiveFeatureReport()');
      return;
    }
    try {
      const dv = await device.receiveFeatureReport(0x01);
      this._addLog('report', `receiveFeatureReport(0x01) → ${dv.byteLength} 字节 (DataView)`);
    } catch (err) {
      this._addLog('err', `receiveFeatureReport 失败：${err.name || 'Error'} — ${err.message || ''}`);
    }
  }

  // ============ Card 3: Web Serial API ============

  async _serialRequest() {
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    if (typeof nav.serial === 'undefined' || typeof nav.serial.requestPort !== 'function') {
      this._addLog('warn', '当前浏览器不支持 Web Serial（navigator.serial 不可用）');
      // 模拟：填充 mock 端口演示返回结构
      this.setState({ serialPort: MOCK_SERIAL_PORT });
      this._addLog('serial', '（模拟）requestPort → 返回 1 个 mock 端口（CH340）');
      return;
    }
    try {
      const port = await nav.serial.requestPort({ filters: [{ usbVendorId: 0x1a86, usbProductId: 0x7523 }] });
      this.setState({ serialPort: port });
      this._addLog('serial', `requestPort({ filters:[{usbVendorId:0x1a86,usbProductId:0x7523}] }) → 已选择端口`);
    } catch (err) {
      this._addLog('err', `requestPort 失败：${err.name || 'Error'} — ${err.message || ''}`);
    }
  }

  async _serialOpen() {
    const port = this.state.serialPort;
    if (!port) {
      this._addLog('warn', '请先请求一个串口端口');
      return;
    }
    const opts = { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' };
    if (port._mock) {
      await port.open(opts);
      this._addLog('serial', `（模拟）port.open({baudRate:9600,dataBits:8,stopBits:1,parity:'none',flowControl:'none'}) → 已打开`);
      return;
    }
    try {
      await port.open(opts);
      const info = port.getInfo();
      this._addLog('serial', `port.open({baudRate:9600}) → usbVendorId=0x${(info.usbVendorId || 0).toString(16)} usbProductId=0x${(info.usbProductId || 0).toString(16)}`);
    } catch (err) {
      this._addLog('err', `port.open 失败：${err.name || 'Error'} — ${err.message || ''}`);
    }
  }

  async _serialWrite() {
    const port = this.state.serialPort;
    if (!port) {
      this._addLog('warn', '请先请求并打开串口');
      return;
    }
    if (port._mock) {
      this._addLog('serial', `（模拟）port.writable.write('AT\\r\\n') → 已写入 4 字节`);
      return;
    }
    try {
      if (!port.writable) {
        this._addLog('warn', '端口未打开或无可写流（port.writable 为 null）');
        return;
      }
      const writer = port.writable.getWriter();
      const data = new TextEncoder().encode('AT\r\n');
      await writer.write(data);
      writer.releaseLock();
      this._addLog('serial', `writable.getWriter().write('AT\\r\\n') → 已写入 ${data.length} 字节`);
    } catch (err) {
      this._addLog('err', `port.write 失败：${err.name || 'Error'} — ${err.message || ''}`);
    }
  }

  // 用 TextDecoderStream 串接 port.readable 逐行读取文本（不阻塞 UI）
  async _serialRead() {
    const port = this.state.serialPort;
    if (!port) {
      this._addLog('warn', '请先请求并打开串口');
      return;
    }
    if (port._mock) {
      this._addLog('serial', '（模拟）port.readable.pipeThrough(new TextDecoderStream()) → 已开启读取');
      return;
    }
    try {
      if (!port.readable) {
        this._addLog('warn', '端口未打开或无可读流（port.readable 为 null）');
        return;
      }
      const decoder = new TextDecoderStream();
      port.readable.pipeTo(decoder.writable).catch(() => { /* 端口关闭 */ });
      const reader = decoder.readable.getReader();
      this._serialReader = reader;
      this._addLog('serial', '已通过 TextDecoderStream 串接 port.readable，等待接收数据…');
      // 读取循环：错误或 done 时退出，避免阻塞
      (async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            this._addLog('serial', `reader.read() → "${value}" (${value.length} 字符)`);
          }
        } catch { /* reader 取消或端口关闭 */ }
        try { reader.releaseLock(); } catch { /* noop */ }
      })();
    } catch (err) {
      this._addLog('err', `port.read 失败：${err.name || 'Error'} — ${err.message || ''}`);
    }
  }

  // ============ Card 4: WebUSB API ============

  async _usbRequest() {
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    if (typeof nav.usb === 'undefined' || typeof nav.usb.requestDevice !== 'function') {
      this._addLog('warn', '当前浏览器不支持 WebUSB（navigator.usb 不可用）');
      this.setState({ usbDevices: MOCK_USB_DEVICES });
      this._addLog('usb', `（模拟）requestDevice → 返回 ${MOCK_USB_DEVICES.length} 个 mock 设备`);
      return;
    }
    try {
      const device = await nav.usb.requestDevice({ filters: [{ vendorId: 0x2341, productId: 0x0043 }] });
      this.setState({ usbDevices: [device] });
      this._addLog('usb', `requestDevice({ filters:[{vendorId:0x2341,productId:0x0043}] }) → ${device.productName || 'USB 设备'}`);
    } catch (err) {
      this._addLog('err', `requestDevice 失败：${err.name || 'Error'} — ${err.message || ''}`);
    }
  }

  async _usbList() {
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    if (typeof nav.usb === 'undefined' || typeof nav.usb.getDevices !== 'function') {
      this._addLog('warn', '当前浏览器不支持 WebUSB，getDevices() 不可用');
      return;
    }
    try {
      const devices = await nav.usb.getDevices();
      this.setState({ usbDevices: devices });
      this._addLog('usb', `getDevices() → ${devices.length} 个已授权设备`);
    } catch (err) {
      this._addLog('err', `getDevices 失败：${err.name || 'Error'} — ${err.message || ''}`);
    }
  }

  _usbShowMeta(device) {
    if (!device) {
      this._addLog('warn', '无 USB 设备可展示');
      return;
    }
    this._addLog('dev',
      `USBDevice: product=${device.productName || '-'} mfr=${device.manufacturerName || '-'} serial=${device.serialNumber || '-'} ` +
      `vid=0x${(device.vendorId || 0).toString(16)} pid=0x${(device.productId || 0).toString(16)} opened=${device.opened} configs=${(device.configurations || []).length}`);
  }

  async _usbOpen(device) {
    if (!device) return;
    if (device._mock) {
      this._addLog('warn', 'mock 设备无法真正 open() / claimInterface()');
      return;
    }
    try {
      if (!device.opened) await device.open();
      if (!device.configuration) await device.selectConfiguration(1);
      await device.claimInterface(0);
      this._addLog('usb', `open → selectConfiguration(1) → claimInterface(0)，opened=${device.opened}`);
    } catch (err) {
      this._addLog('err', `USB open 失败：${err.name || 'Error'} — ${err.message || ''}`);
    }
  }

  async _usbTransfer(device) {
    if (!device) return;
    if (device._mock) {
      this._addLog('warn', 'mock 设备无法真正 transferIn/transferOut');
      return;
    }
    try {
      const out = new Uint8Array([0x01, 0x02]);
      const resOut = await device.transferOut(1, out);
      this._addLog('dev', `transferOut(1, [0x01,0x02]) → status=${resOut.status} 已发送 ${out.byteLength} 字节`);
      const resIn = await device.transferIn(1, 64);
      this._addLog('dev', `transferIn(1, 64) → status=${resIn.status} 数据长度=${resIn.data ? resIn.data.byteLength : 0}`);
    } catch (err) {
      this._addLog('err', `USB transfer 失败：${err.name || 'Error'} — ${err.message || ''}`);
    }
  }

  // ============ Card 5: Web Bluetooth + Web NFC ============

  async _btRequest() {
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    if (typeof nav.bluetooth === 'undefined' || typeof nav.bluetooth.requestDevice !== 'function') {
      this._addLog('warn', '当前浏览器不支持 Web Bluetooth（navigator.bluetooth 不可用）');
      this.setState({ btDevice: MOCK_BT_DEVICE });
      this._addLog('bt', `（模拟）requestDevice → 返回 mock 蓝牙设备「${MOCK_BT_DEVICE.name}」`);
      return;
    }
    try {
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service', 'device_information', 'heart_rate'],
      });
      this.setState({ btDevice: device });
      this._addLog('bt', `requestDevice({ acceptAllDevices:true, optionalServices:[...] }) → ${device.name || 'BT 设备'} id=${device.id}`);
    } catch (err) {
      this._addLog('err', `requestDevice 失败：${err.name || 'Error'} — ${err.message || ''}`);
    }
  }

  async _btConnectGatt() {
    const device = this.state.btDevice;
    if (!device) {
      this._addLog('warn', '请先请求一个蓝牙设备');
      return;
    }
    if (device._mock || !device.gatt) {
      this._addLog('warn', 'mock 蓝牙设备无法真正建立 GATT 连接');
      return;
    }
    try {
      const server = await device.gatt.connect();
      this._addLog('gatt', `gatt.connect() → connected=${server.connected}`);
      const svc = await server.getPrimaryService('battery_service');
      this._addLog('gatt', `getPrimaryService('battery_service') → ${svc.uuid}`);
      const ch = await svc.getCharacteristic('battery_level');
      this._addLog('gatt', `getCharacteristic('battery_level') → ${ch.uuid}`);
      const dv = await ch.readValue();
      this._addLog('gatt', `readValue() → 电量=${dv.getUint8(0)}% (DataView)`);
    } catch (err) {
      this._addLog('err', `GATT 操作失败：${err.name || 'Error'} — ${err.message || ''}`);
    }
  }

  _btDisconnect() {
    const device = this.state.btDevice;
    if (!device || !device.gatt) {
      this._addLog('warn', '无可断开的蓝牙设备');
      return;
    }
    if (device._mock) {
      this._addLog('warn', 'mock 蓝牙设备无需断开');
      return;
    }
    try {
      device.gatt.disconnect();
      this._addLog('gatt', `gatt.disconnect() → connected=${device.gatt.connected}`);
    } catch (err) {
      this._addLog('err', `gatt.disconnect 失败：${err.name || 'Error'} — ${err.message || ''}`);
    }
  }

  async _nfcScan() {
    const win = typeof window !== 'undefined' ? window : {};
    if (typeof win.NDEFReader === 'undefined') {
      this._addLog('warn', '当前浏览器不支持 Web NFC（NDEFReader 不可用）');
      this.setState({ nfcStatus: 'unsupported' });
      return;
    }
    try {
      const reader = new NDEFReader();
      this._nfcReader = reader;
      this.setState({ nfcStatus: 'scanning' });
      this._addLog('nfc', 'NDEFReader.scan() 调用中，请将 NFC 标签靠近设备…');
      this.on(reader, 'reading', (e) => {
        const n = e.message && e.message.records ? e.message.records.length : 0;
        this._addLog('nfc', `reading → serialNumber=${e.serialNumber} records=${n}`);
      });
      this.on(reader, 'readingerror', () => {
        this._addLog('err', 'readingerror → 无法读取标签');
      });
      await reader.scan();
    } catch (err) {
      this.setState({ nfcStatus: 'idle' });
      this._addLog('err', `NFC scan 失败：${err.name || 'Error'} — ${err.message || ''}`);
    }
  }

  async _nfcWrite() {
    const win = typeof window !== 'undefined' ? window : {};
    if (typeof win.NDEFReader === 'undefined') {
      this._addLog('warn', '当前浏览器不支持 Web NFC（NDEFReader 不可用）');
      return;
    }
    const msg = this._nfcText || 'Hello from API Lab';
    try {
      const writer = new NDEFReader();
      this._addLog('nfc', `NDEFReader.write('${msg}', { overwrite: false }) 调用中…`);
      await writer.write(msg, { overwrite: false });
      this._addLog('nfc', `write() → 成功写入 "${msg}"`);
    } catch (err) {
      this._addLog('err', `NFC write 失败：${err.name || 'Error'} — ${err.message || ''}`);
    }
  }

  // ============ 渲染：5 个 Card + 日志面板 ============

  _renderCard1() {
    const caps = this._caps || {};
    const gamepadList = this.state.gamepadList || [];
    const card = new Card({
      title: '1. Gamepad API 手柄输入',
      desc: 'navigator.getGamepads 轮询手柄状态与振动反馈',
      extra: h('span', { class: 'flex items-center gap-xs' },
        h(Tag, { color: 'primary' }, 'navigator.getGamepads'),
        this._capTag(caps.gamepad),
      ),
      children: [
        h('p', { class: 'fs-sm text-tertiary' },
          'navigator.getGamepads() 返回 Gamepad 数组（可能含 null 槽位）；Gamepad 含 id / index / connected / timestamp / mapping(standard) / axes[] / buttons[]；GamepadButton 含 pressed / touched / value。window 监听 gamepadconnected / gamepaddisconnected 事件取 e.gamepad。振动通过 gamepad.vibrationActuator.playEffect(\'dual-rumble\', { duration, weakMagnitude, strongMagnitude }) 触发。'),
        !caps.gamepad && h(Alert, {
          type: 'warning',
          message: '当前浏览器不支持 Gamepad API',
          description: '桌面端通常需连接真实手柄并按键激活后才会出现在 getGamepads() 中。jsdom 环境下该 API 不存在。',
        }),
        h('div', { class: 'flex flex-wrap gap-sm' },
          this._btn('扫描手柄', { type: 'primary', size: 'sm', onClick: () => this._gamepadScan(), disabled: !caps.gamepad }),
          this._btn('停止轮询', { size: 'sm', danger: true, onClick: () => this._gamepadStop(), disabled: !caps.gamepad }),
          this._btn('模拟振动', { type: 'primary', size: 'sm', onClick: () => this._gamepadRumble(), disabled: !caps.gamepad }),
        ),
        gamepadList.length > 0
          ? h('div', { class: 'flex flex-col gap-xs' },
              ...gamepadList.map((gp) => h('div', { class: 'log-panel', style: { height: 'auto', padding: '8px' } },
                this._kvRow('index', gp.index),
                this._kvRow('id', gp.id),
                this._kvRow('connected', String(gp.connected)),
                this._kvRow('mapping', gp.mapping),
                this._kvRow('axes', gp.axes ? gp.axes.map((a) => a.toFixed(2)).join(', ') : '-'),
                this._kvRow('buttons', gp.buttons ? gp.buttons.length : 0),
                this._kvRow('vibrationActuator', String(!!gp.vibrationActuator)),
              )),
            )
          : h('p', { class: 'fs-sm text-tertiary' }, '（点击「扫描手柄」后，已连接手柄的实时 axes/buttons 会显示在这里）'),
        h('p', { class: 'fs-xs text-tertiary' }, '轮询以 100ms 间隔执行，日志每 ~1s 记一条避免刷屏；振动默认持续 500ms。'),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard2() {
    const caps = this._caps || {};
    const hidDevices = this.state.hidDevices || [];
    const card = new Card({
      title: '2. WebHID API 人机接口设备',
      desc: 'navigator.hid 请求与列举 HID 设备',
      extra: h('span', { class: 'flex items-center gap-xs' },
        h(Tag, { color: 'primary' }, 'navigator.hid'),
        this._capTag(caps.hid),
      ),
      children: [
        h('p', { class: 'fs-sm text-tertiary' },
          'navigator.hid.requestDevice({ filters:[{ vendorId, productId }] }) → Promise<HIDDevice[]>；getDevices() 返回已授权设备。HIDDevice 含 vendorId / productId / name / collections / opened，监听 connect/disconnect 事件。device.open()/close()，addEventListener(\'inputreport\', e => { e.data, e.device, e.reportId })；device.sendReport(reportId, data) / receiveFeatureReport(reportId)。'),
        !caps.hid && h(Alert, {
          type: 'warning',
          message: '当前浏览器不支持 WebHID',
          description: 'WebHID 仅 Chromium 内核可用，且需 HTTPS + 用户手势。jsdom 下不可用，按钮将以 mock 数据演示返回结构。',
        }),
        h('div', { class: 'flex flex-wrap gap-sm' },
          this._btn('请求 HID 设备', { type: 'primary', size: 'sm', onClick: () => this._hidRequest() }),
          this._btn('列出已授权设备', { size: 'sm', onClick: () => this._hidList(), disabled: !caps.hid }),
        ),
        hidDevices.length > 0
          ? h('div', { class: 'flex flex-col gap-xs' },
              ...hidDevices.map((d, i) => h('div', { class: 'log-panel', style: { height: 'auto', padding: '8px' } },
                this._kvRow(`HID #${i + 1} name`, d.name),
                this._kvRow('vendorId', '0x' + (d.vendorId || 0).toString(16)),
                this._kvRow('productId', '0x' + (d.productId || 0).toString(16)),
                this._kvRow('opened', String(d.opened)),
                this._kvRow('collections', (d.collections || []).length),
                this._btn('打开设备', { size: 'sm', onClick: () => this._hidOpen(d), disabled: !caps.hid }),
                this._btn('发送 report', { size: 'sm', onClick: () => this._hidSendReport(d), disabled: !caps.hid }),
                this._btn('读取 feature', { size: 'sm', onClick: () => this._hidReceiveFeature(d), disabled: !caps.hid }),
              )),
            )
          : h('p', { class: 'fs-sm text-tertiary' }, '（点击「请求 HID 设备」后，授权的设备列表会显示在这里）'),
        h('p', { class: 'fs-xs text-tertiary' }, '权限框取消会抛 NotFoundError/AbortError，本页统一捕获记入日志。open() 需真实硬件。'),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard3() {
    const caps = this._caps || {};
    const port = this.state.serialPort;
    let portInfo = null;
    if (port) {
      try { portInfo = port.getInfo(); } catch { portInfo = { usbVendorId: port.usbVendorId, usbProductId: port.usbProductId }; }
    }
    const card = new Card({
      title: '3. Web Serial API 串口通信',
      desc: 'navigator.serial 请求端口、打开与读写',
      extra: h('span', { class: 'flex items-center gap-xs' },
        h(Tag, { color: 'primary' }, 'navigator.serial'),
        this._capTag(caps.serial),
      ),
      children: [
        h('p', { class: 'fs-sm text-tertiary' },
          'navigator.serial.requestPort({ filters:[{ usbVendorId, usbProductId }] }) → Promise<SerialPort>；getPorts() 返回已授权端口。port.open({ baudRate, dataBits, stopBits, parity, flowControl }) 打开，close() 关闭，getInfo() 返回 { usbVendorId, usbProductId }。port.readable / writable 是 ReadableStream/WritableStream，可用 TextDecoderStream / TextEncoderStream 串接 port.readable.pipeThrough(new TextDecoderStream())。监听 navigator.serial 的 connect/disconnect 事件。'),
        !caps.serial && h(Alert, {
          type: 'warning',
          message: '当前浏览器不支持 Web Serial',
          description: 'Web Serial 仅 Chromium 内核可用，需 HTTPS + 用户手势。jsdom 下不可用，按钮将以 mock 端口演示。',
        }),
        h('div', { class: 'flex flex-wrap gap-sm' },
          this._btn('请求串口', { type: 'primary', size: 'sm', onClick: () => this._serialRequest() }),
          this._btn('打开端口 (9600,8,N,1)', { size: 'sm', onClick: () => this._serialOpen(), disabled: !port }),
          this._btn('写入数据', { size: 'sm', onClick: () => this._serialWrite(), disabled: !port }),
          this._btn('读取数据', { size: 'sm', onClick: () => this._serialRead(), disabled: !port }),
        ),
        port
          ? h('div', { class: 'log-panel', style: { height: 'auto', padding: '8px' } },
              this._kvRow('port type', port._mock ? 'mock (CH340)' : 'SerialPort'),
              this._kvRow('usbVendorId', portInfo && portInfo.usbVendorId ? '0x' + portInfo.usbVendorId.toString(16) : '-'),
              this._kvRow('usbProductId', portInfo && portInfo.usbProductId ? '0x' + portInfo.usbProductId.toString(16) : '-'),
              this._kvRow('readable', String(!!port.readable)),
              this._kvRow('writable', String(!!port.writable)),
            )
          : h('p', { class: 'fs-sm text-tertiary' }, '（点击「请求串口」后，端口信息会显示在这里）'),
        h('p', { class: 'fs-xs text-tertiary' }, '打开端口默认 baudRate=9600、dataBits=8、stopBits=1、parity=none、flowControl=none；写入演示发送 "AT\\r\\n"。'),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard4() {
    const caps = this._caps || {};
    const usbDevices = this.state.usbDevices || [];
    const card = new Card({
      title: '4. WebUSB API USB 设备',
      desc: 'navigator.usb 请求与列举 USB 设备',
      extra: h('span', { class: 'flex items-center gap-xs' },
        h(Tag, { color: 'primary' }, 'navigator.usb'),
        this._capTag(caps.usb),
      ),
      children: [
        h('p', { class: 'fs-sm text-tertiary' },
          'navigator.usb.requestDevice({ filters:[{ vendorId, productId, classCode, subclassCode, protocolCode }] }) → Promise<USBDevice>；getDevices() 返回已授权列表。USBDevice 含 productName / manufacturerName / serialNumber / vendorId / productId / configurations / opened。device.open() / selectConfiguration(configurationValue) / claimInterface(interfaceNumber) / transferIn(endpointNumber, length) / transferOut(endpointNumber, data)。监听 navigator.usb 的 connect/disconnect 事件。'),
        !caps.usb && h(Alert, {
          type: 'warning',
          message: '当前浏览器不支持 WebUSB',
          description: 'WebUSB 仅 Chromium 内核可用，需 HTTPS + 用户手势。jsdom 下不可用，按钮将以 mock 设备演示。',
        }),
        h('div', { class: 'flex flex-wrap gap-sm' },
          this._btn('请求 USB 设备', { type: 'primary', size: 'sm', onClick: () => this._usbRequest() }),
          this._btn('列出已授权设备', { size: 'sm', onClick: () => this._usbList(), disabled: !caps.usb }),
        ),
        usbDevices.length > 0
          ? h('div', { class: 'flex flex-col gap-xs' },
              ...usbDevices.map((d, i) => h('div', { class: 'log-panel', style: { height: 'auto', padding: '8px' } },
                this._kvRow(`USB #${i + 1} productName`, d.productName),
                this._kvRow('manufacturerName', d.manufacturerName),
                this._kvRow('serialNumber', d.serialNumber),
                this._kvRow('vendorId', '0x' + (d.vendorId || 0).toString(16)),
                this._kvRow('productId', '0x' + (d.productId || 0).toString(16)),
                this._kvRow('opened', String(d.opened)),
                this._kvRow('configurations', (d.configurations || []).length),
                this._btn('查看元数据', { size: 'sm', onClick: () => this._usbShowMeta(d) }),
                this._btn('声明接口', { size: 'sm', onClick: () => this._usbOpen(d), disabled: !caps.usb }),
                this._btn('端点传输', { size: 'sm', onClick: () => this._usbTransfer(d), disabled: !caps.usb }),
              )),
            )
          : h('p', { class: 'fs-sm text-tertiary' }, '（点击「请求 USB 设备」后，授权的设备元数据会显示在这里）'),
        h('p', { class: 'fs-xs text-tertiary' }, '典型传输流程：open → selectConfiguration → claimInterface → transferIn/transferOut。'),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard5() {
    const caps = this._caps || {};
    const btDevice = this.state.btDevice;
    const nfcStatus = this.state.nfcStatus;
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    const maxMsg = ('maxMessageSize' in nav) ? nav.maxMessageSize : undefined;
    const card = new Card({
      title: '5. Web Bluetooth + Web NFC 蓝牙与近场通讯',
      desc: 'navigator.bluetooth GATT 连接 / NDEFReader NFC 读写',
      extra: h('span', { class: 'flex items-center gap-xs' },
        h(Tag, { color: 'primary' }, 'navigator.bluetooth'), this._capTag(caps.bluetooth),
        h(Tag, { color: 'primary' }, 'NDEFReader'), this._capTag(caps.nfc),
      ),
      children: [
        h('p', { class: 'fs-sm text-tertiary' },
          'Web Bluetooth：navigator.bluetooth.requestDevice({ acceptAllDevices:true, optionalServices:[...] }) → Promise<BluetoothDevice>。BluetoothDevice 含 id / name / gatt / watchingAdvertisements。device.gatt.connect()/disconnect()/getPrimaryService(uuid)/getCharacteristics()；BluetoothRemoteGATTCharacteristic.readValue()/writeValue()/startNotifications()。'),
        h('p', { class: 'fs-sm text-tertiary' },
          'Web NFC：navigator.maxMessageSize（只读属性，返回单条 NDEF 消息最大字节数）；\'NDEFReader\' in window 检测；new NDEFReader()；reader.scan() → Promise；reader.addEventListener(\'reading\', e => { e.serialNumber, e.message.records[] })；reader.write(message, { overwrite:false })。'),
        (!caps.bluetooth || !caps.nfc) && h(Alert, {
          type: 'warning',
          message: '部分 API 不支持',
          description: `Bluetooth=${caps.bluetooth} / NFC=${caps.nfc}。Web NFC 仅 Android Chrome 可用。`,
        }),
        h('div', { class: 'flex flex-wrap gap-sm' },
          this._btn('请求蓝牙设备', { type: 'primary', size: 'sm', onClick: () => this._btRequest() }),
          this._btn('连接 GATT (电量)', { size: 'sm', onClick: () => this._btConnectGatt(), disabled: !btDevice || !caps.bluetooth }),
          this._btn('断开 GATT', { size: 'sm', danger: true, onClick: () => this._btDisconnect(), disabled: !btDevice || !caps.bluetooth }),
          this._btn('扫描 NFC', { type: 'primary', size: 'sm', onClick: () => this._nfcScan(), disabled: !caps.nfc }),
          this._btn('写入 NFC', { size: 'sm', onClick: () => this._nfcWrite(), disabled: !caps.nfc }),
        ),
        caps.nfc && h('input', {
          class: 'input input--sm',
          placeholder: '要写入 NFC 的文本（默认 Hello from API Lab）',
          onInput: (e) => { this._nfcText = e.target.value; },
          style: { flex: '1', minWidth: '200px' },
        }),
        h('div', { class: 'flex items-center gap-sm' },
          h('span', { class: 'fs-xs text-secondary' }, 'NFC 状态：'),
          h(Tag, { color: nfcStatus === 'scanning' ? 'warning' : (nfcStatus === 'unsupported' ? 'error' : 'default') }, nfcStatus),
          maxMsg != null && h('span', { class: 'fs-xs text-tertiary' }, `maxMessageSize=${maxMsg}`),
        ),
        btDevice
          ? h('div', { class: 'log-panel', style: { height: 'auto', padding: '8px' } },
              this._kvRow('BT name', btDevice.name),
              this._kvRow('id', btDevice.id),
              this._kvRow('gatt', btDevice.gatt ? 'BluetoothRemoteGATTServer' : 'N/A'),
              this._kvRow('watchingAdvertisements', String(!!btDevice.watchingAdvertisements)),
            )
          : h('p', { class: 'fs-sm text-tertiary' }, '（点击「请求蓝牙设备」后，设备信息会显示在这里）'),
        h('p', { class: 'fs-xs text-tertiary' }, '蓝牙典型流程：requestDevice → gatt.connect → getPrimaryService → getCharacteristic → readValue/startNotifications。'),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderLogPanel() {
    const card = new Card({
      title: '事件日志',
      desc: '硬件 API 调用与事件实时记录',
      extra: h('span', { class: 'fs-sm text-tertiary' }, '实时'),
      children: [
        h('div', { class: 'log-panel' },
          ...this.state.logs.map((log) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', {}, log.content),
          )),
        ),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  render() {
    const s = this.state;
    return h('div', { class: 'page api-lab-page' },
      h('h2', { class: 'section-title' }, '硬件设备 API 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '浏览器直连硬件：Gamepad 手柄 / HID 人机接口 / Serial 串口 / USB / Bluetooth 蓝牙 / NFC 近场通讯。本页演示能力检测、设备枚举与连接流程。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderLogPanel(),
    );
  }
}
