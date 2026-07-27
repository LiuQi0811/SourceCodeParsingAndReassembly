// =====================================================================
// DeviceSensorsPage.ts —— 设备传感器与定位 API 实验室
// 演示 MDN：
//   1. Geolocation API                —— navigator.geolocation
//   2. Device Orientation & Motion    —— deviceorientation / devicemotion 事件
//   3. Generic Sensor API             —— Accelerometer / Gyroscope /
//                                        AmbientLightSensor / Magnetometer 等
//   4. Barcode Detection API          —— BarcodeDetector
//   5. Permissions API                —— navigator.permissions
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { Props, State } from '../../core/types.js';

// 要探测的 Generic Sensor 构造器名称（多为 Chromium 实验性 API）
const SENSOR_CTOR_NAMES: string[] = [
  'Accelerometer',
  'Gyroscope',
  'LinearAccelerationSensor',
  'GravitySensor',
  'AbsoluteOrientationSensor',
  'RelativeOrientationSensor',
  'AmbientLightSensor',
  'Magnetometer',
];

// 要并行查询的权限名称（部分名称在某些浏览器会抛 TypeError，需 try/catch）
const PERMISSION_NAMES: string[] = [
  'geolocation',
  'notifications',
  'camera',
  'microphone',
  'accelerometer',
  'background-sync',
  'persistent-storage',
];

// GeolocationPositionError 错误码映射
const GEO_ERR_MAP: Record<number, string> = {
  1: 'PERMISSION_DENIED（用户拒绝）',
  2: 'POSITION_UNAVAILABLE（位置不可用）',
  3: 'TIMEOUT（超时）',
};

// 地理坐标快照
interface GeoCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

// 方向数值
interface OrientValues {
  alpha: number;
  beta: number;
  gamma: number;
}

// 加速度数值
interface AccelValues {
  x: number;
  y: number;
  z: number;
}

// 能力检测结果
interface Capabilities {
  geo: boolean;
  orient: boolean;
  permissions: boolean;
  barcode: boolean;
}

// 权限查询结果项
interface PermissionItem {
  name: string;
  state: string;
  note: string;
}

export interface DeviceSensorsPageProps extends Props {}

export interface DeviceSensorsLog {
  type: string;
  content: string;
  time: string;
}

export interface DeviceSensorsPageState extends State {
  logs: DeviceSensorsLog[];
  geoCoords: GeoCoords | null;
  geoWatching: boolean;
  orientationActive: boolean;
  orientValues: OrientValues;
  sensorSupport: Record<string, boolean>;
  accelValues: AccelValues;
  accelActive: boolean;
  barcodeResult: string;
  barcodeFormats: string[];
  permissionsList: PermissionItem[];
  capabilities: Capabilities;
}

export class DeviceSensorsPage extends Page {
  declare props: DeviceSensorsPageProps;
  declare state: DeviceSensorsPageState;
  _sensorChecked: boolean = false;
  _geoWatchId: number | null = null;
  _orientUnbind: (() => void) | null = null;
  _motionUnbind: (() => void) | null = null;
  _lastOrientTs: number = 0;
  _lastOrientLogTs: number = 0;
  _lastMotionTs: number = 0;
  _accelSensor: any = null;
  _barcodeFormats: string[] | null = null;
  _permStatuses: PermissionStatus[] | null = null;

  initialState(): DeviceSensorsPageState {
    return {
      logs: [],
      geoCoords: null,
      geoWatching: false,
      orientationActive: false,
      orientValues: { alpha: 0, beta: 0, gamma: 0 },
      sensorSupport: {},
      accelValues: { x: 0, y: 0, z: 0 },
      accelActive: false,
      barcodeResult: '',
      barcodeFormats: [],
      permissionsList: [],
      capabilities: { geo: false, orient: false, permissions: false, barcode: false },
    };
  }

  componentDidMount(): void {
    // —— 一次性：同步能力检测（typeof）填充 sensorSupport 与 capabilities ——
    // 避免重渲染后重复执行（componentDidMount 在每次 _rerender 后都会再触发）。
    if (!this._sensorChecked) {
      this._sensorChecked = true;
      const support: Record<string, boolean> = {};
      for (const name of SENSOR_CTOR_NAMES) {
        try {
          support[name] = typeof (window as any)[name] !== 'undefined';
        } catch {
          support[name] = false;
        }
      }
      const capabilities: Capabilities = {
        geo: typeof navigator.geolocation !== 'undefined',
        orient: typeof window.DeviceOrientationEvent !== 'undefined',
        permissions: typeof navigator.permissions !== 'undefined',
        barcode: typeof (window as any).BarcodeDetector !== 'undefined',
      };
      const supported = SENSOR_CTOR_NAMES.filter((n) => support[n]);
      this.setState({ sensorSupport: support, capabilities });
      this._addLog(
        'sensor',
        `传感器能力检测完成：可用 ${supported.length}/${SENSOR_CTOR_NAMES.length}` +
          (supported.length ? `（${supported.join(' / ')}）` : ''),
      );
    }
  }

  componentWillUnmount(): void {
    // 1. 清理 Geolocation watch
    if (this._geoWatchId != null && typeof navigator.geolocation !== 'undefined') {
      try { navigator.geolocation.clearWatch(this._geoWatchId); } catch { /* noop */ }
      this._geoWatchId = null;
    }
    // 2. 移除 deviceorientation / devicemotion 监听
    //    （this.on 注册的会由基类 destroy 统一移除，这里显式调用 unbind 保险）
    if (this._orientUnbind) { try { this._orientUnbind(); } catch { /* noop */ } this._orientUnbind = null; }
    if (this._motionUnbind) { try { this._motionUnbind(); } catch { /* noop */ } this._motionUnbind = null; }
    // 3. 停止活跃的 Sensor 对象
    if (this._accelSensor) {
      try { this._accelSensor.stop(); } catch { /* noop */ }
      this._accelSensor = null;
    }
    // 4. 解绑 permission status 的 onchange
    if (this._permStatuses) {
      for (const ps of this._permStatuses) {
        try { ps.onchange = null; } catch { /* noop */ }
      }
      this._permStatuses = null;
    }
  }

  _addLog(type: string, content: string): void {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label: string, opts: Props): Node {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render() as Node;
  }

  _geoGet(): void {
    if (typeof navigator.geolocation === 'undefined') {
      this._addLog('err', '当前浏览器不支持 Geolocation API');
      return;
    }
    this._addLog('geo', 'getCurrentPosition() 调用中（enableHighAccuracy, timeout=5000ms）…');
    try {
      navigator.geolocation.getCurrentPosition(
        (pos: GeolocationPosition) => this._onGeoSuccess(pos, 'getCurrentPosition'),
        (err: GeolocationPositionError) => this._onGeoError(err),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
      );
    } catch (err: any) {
      this._addLog('err', `getCurrentPosition 调用失败：${err.message}`);
    }
  }

  _geoWatch(): void {
    if (typeof navigator.geolocation === 'undefined') {
      this._addLog('err', '当前浏览器不支持 Geolocation API');
      return;
    }
    if (this._geoWatchId != null) return;
    this._addLog('geo', 'watchPosition() 已启动');
    try {
      this._geoWatchId = navigator.geolocation.watchPosition(
        (pos: GeolocationPosition) => this._onGeoSuccess(pos, 'watchPosition'),
        (err: GeolocationPositionError) => this._onGeoError(err),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 1000 },
      );
      this.setState({ geoWatching: true });
    } catch (err: any) {
      this._addLog('err', `watchPosition 启动失败：${err.message}`);
    }
  }

  _geoStopWatch(): void {
    if (this._geoWatchId == null) {
      this._addLog('err', '当前没有进行中的 watchPosition');
      return;
    }
    try {
      navigator.geolocation.clearWatch(this._geoWatchId);
      this._addLog('geo', `clearWatch(${this._geoWatchId}) 已停止`);
    } catch (err: any) {
      this._addLog('err', `clearWatch 失败：${err.message}`);
    }
    this._geoWatchId = null;
    this.setState({ geoWatching: false });
  }

  _onGeoSuccess(pos: GeolocationPosition, source: string): void {
    const c = pos.coords;
    const coords: GeoCoords = {
      latitude: c.latitude, longitude: c.longitude, accuracy: c.accuracy,
      altitude: c.altitude, altitudeAccuracy: c.altitudeAccuracy,
      heading: c.heading, speed: c.speed, timestamp: pos.timestamp,
    };
    this.setState({ geoCoords: coords });
    this._addLog(
      'geo',
      `[${source}] lat=${(coords.latitude as any).toFixed(5)} lng=${(coords.longitude as any).toFixed(5)} ±${(coords.accuracy as any).toFixed(0)}m`,
    );
  }

  _onGeoError(err: GeolocationPositionError): void {
    const desc = GEO_ERR_MAP[err.code] || `未知错误（code=${err.code}）`;
    this._addLog('err', `Geolocation 错误：${desc}${err.message ? ' — ' + err.message : ''}`);
  }

  async _orientStart(): Promise<void> {
    if (typeof window.DeviceOrientationEvent === 'undefined') {
      this._addLog('err', '当前浏览器不支持 DeviceOrientationEvent');
      return;
    }
    if (this.state.orientationActive) return;
    try {
      // iOS 13+ 需在用户手势内请求权限
      if (typeof (window.DeviceOrientationEvent as any).requestPermission === 'function') {
        const res = await (window.DeviceOrientationEvent as any).requestPermission();
        if (res !== 'granted') {
          this._addLog('err', `DeviceOrientation 权限被拒绝：${res}`);
          return;
        }
        this._addLog('orient', 'DeviceOrientationEvent.requestPermission() → granted');
      }
      // devicemotion 同理（部分 iOS 版本也需要单独请求）
      if (typeof window.DeviceMotionEvent !== 'undefined' &&
          typeof (window.DeviceMotionEvent as any).requestPermission === 'function') {
        try {
          const rm = await (window.DeviceMotionEvent as any).requestPermission();
          this._addLog('orient', `DeviceMotionEvent.requestPermission() → ${rm}`);
        } catch (e: any) {
          this._addLog('err', `DeviceMotion 权限请求失败：${e.message}`);
        }
      }
      // 注册监听（this.on 返回 unbind 函数，停止时调用以移除）
      this._orientUnbind = this.on(window, 'deviceorientation', (e: Event) => this._onDeviceOrientation(e as DeviceOrientationEvent));
      this._motionUnbind = this.on(window, 'devicemotion', (e: Event) => this._onDeviceMotion(e as DeviceMotionEvent));
      this.setState({ orientationActive: true });
      this._addLog('orient', '已监听 deviceorientation / devicemotion');
    } catch (err: any) {
      this._addLog('err', `方向监听启动失败：${err.message}`);
    }
  }

  _orientStop(): void {
    if (!this.state.orientationActive) {
      this._addLog('err', '当前未在监听方向');
      return;
    }
    if (this._orientUnbind) { this._orientUnbind(); this._orientUnbind = null; }
    if (this._motionUnbind) { this._motionUnbind(); this._motionUnbind = null; }
    this._lastOrientTs = 0;
    this._lastOrientLogTs = 0;
    this._lastMotionTs = 0;
    this.setState({ orientationActive: false });
    this._addLog('orient', '已停止 deviceorientation / devicemotion 监听');
  }

  _onDeviceOrientation(e: DeviceOrientationEvent): void {
    // 节流：每 ~100ms（约 10 次/秒）更新一次 UI，避免高频 setState 卡顿
    const now = Date.now();
    if (this._lastOrientTs && now - this._lastOrientTs < 100) return;
    this._lastOrientTs = now;
    const alpha = e.alpha ?? 0;
    const beta = e.beta ?? 0;
    const gamma = e.gamma ?? 0;
    this.setState({ orientValues: { alpha, beta, gamma } });
    // 日志：每 ~1s 记一条，避免刷屏
    if (!this._lastOrientLogTs || now - this._lastOrientLogTs >= 1000) {
      this._lastOrientLogTs = now;
      this._addLog('orient',
        `alpha=${(alpha as any).toFixed(1)}° beta=${(beta as any).toFixed(1)}° gamma=${(gamma as any).toFixed(1)}° absolute=${e.absolute}`);
    }
  }

  _onDeviceMotion(e: DeviceMotionEvent): void {
    // 节流日志：每 ~500ms 记一条
    const now = Date.now();
    if (this._lastMotionTs && now - this._lastMotionTs < 500) return;
    this._lastMotionTs = now;
    const acc = e.accelerationIncludingGravity || {};
    const rate = e.rotationRate || {};
    this._addLog('orient',
      `devicemotion accG(x,y,z)=${((acc as any).x ?? 0).toFixed(1)},${((acc as any).y ?? 0).toFixed(1)},${((acc as any).z ?? 0).toFixed(1)} ` +
        `rot(α,β,γ)=${((rate as any).alpha ?? 0).toFixed(0)},${((rate as any).beta ?? 0).toFixed(0)},${((rate as any).gamma ?? 0).toFixed(0)} interval=${e.interval ?? '?'}`);
  }

  async _sensorCheckPermission(name: string): Promise<string> {
    if (typeof navigator.permissions === 'undefined') return 'unsupported';
    try {
      const status = await navigator.permissions.query({ name: name as PermissionName });
      return status.state;
    } catch (err: any) {
      return `error:${err.name}`;
    }
  }

  async _accelStart(): Promise<void> {
    if (typeof (window as any).Accelerometer === 'undefined') {
      this._addLog('err', '当前浏览器不支持 Accelerometer');
      return;
    }
    if (this._accelSensor) return;
    // 先查权限
    const perm = await this._sensorCheckPermission('accelerometer');
    this._addLog('sensor', `permissions.query({ name: 'accelerometer' }) → ${perm}`);
    if (perm === 'denied') {
      this._addLog('err', 'accelerometer 权限被拒绝');
      return;
    }
    try {
      const sensor = new (window as any).Accelerometer({ frequency: 10 }); // 10 Hz
      sensor.addEventListener('error', (e: any) => {
        const name = e.error ? e.error.name : 'UnknownError';
        const msg = e.error ? e.error.message : '';
        this._addLog('err', `Accelerometer error: ${name}${msg ? ' — ' + msg : ''}`);
      });
      sensor.addEventListener('reading', () => {
        this.setState({
          accelValues: { x: sensor.x ?? 0, y: sensor.y ?? 0, z: sensor.z ?? 0 },
          accelActive: !!sensor.activated,
        });
      });
      sensor.start();
      this._accelSensor = sensor;
      this.setState({ accelActive: true });
      this._addLog(
        'sensor',
        `Accelerometer.start() frequency=10Hz activated=${sensor.activated} hasReading=${sensor.hasReading}`,
      );
    } catch (err: any) {
      this._addLog('err', `Accelerometer 启动失败：${err.name} — ${err.message}`);
    }
  }

  _accelStop(): void {
    if (!this._accelSensor) {
      this._addLog('err', 'Accelerometer 未运行');
      return;
    }
    try {
      const s = this._accelSensor;
      s.stop();
      this._addLog('sensor',
        `Accelerometer.stop() activated=${s.activated} hasReading=${s.hasReading} timestamp=${s.timestamp ?? 'N/A'}`);
    } catch (err: any) {
      this._addLog('err', `Accelerometer 停止失败：${err.message}`);
    }
    this._accelSensor = null;
    this.setState({ accelActive: false, accelValues: { x: 0, y: 0, z: 0 } });
  }

  async _barcodeInitFormats(): Promise<void> {
    if (typeof (window as any).BarcodeDetector === 'undefined') {
      this._addLog('err', '当前浏览器不支持 BarcodeDetector');
      return;
    }
    try {
      const formats: string[] = await (window as any).BarcodeDetector.getSupportedFormats();
      this._barcodeFormats = formats;
      this.setState({ barcodeFormats: formats });
      this._addLog('barcode', `getSupportedFormats() → [${formats.join(', ')}]`);
    } catch (err: any) {
      this._addLog('err', `getSupportedFormats 失败：${err.message}`);
    }
  }

  async _barcodeDetect(file: File | undefined): Promise<void> {
    if (typeof (window as any).BarcodeDetector === 'undefined') {
      this._addLog('err', '当前浏览器不支持 BarcodeDetector');
      return;
    }
    if (!file) return;
    if (!this._barcodeFormats) await this._barcodeInitFormats();
    const canvas = this.$<HTMLCanvasElement>('.barcode-canvas');
    if (!canvas) {
      this._addLog('err', '未找到 canvas 元素');
      return;
    }
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('无法获取 2d 上下文');
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = async (): Promise<void> => {
        // 等比缩放到 canvas
        const maxW = 320;
        const scale = Math.min(1, maxW / (img.width || maxW));
        canvas.width = Math.round((img.width || maxW) * scale);
        canvas.height = Math.round((img.height || 240) * scale);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        try {
          const formats = (this._barcodeFormats && this._barcodeFormats.length)
            ? this._barcodeFormats.slice(0, 6)
            : ['qr_code', 'ean_13', 'code_128'];
          const detector = new (window as any).BarcodeDetector({ formats });
          const codes: any[] = await detector.detect(canvas);
          if (!codes.length) {
            this.setState({ barcodeResult: '未检测到条码' });
            this._addLog('barcode', `detect() → 0 条结果（已绘制 ${canvas.width}×${canvas.height}）`);
            return;
          }
          const lines = codes.map((c: any, i: number) => `#${i + 1} [${c.format}] ${c.rawValue}`);
          this.setState({ barcodeResult: lines.join('\n') });
          this._addLog('barcode', `detect() → ${codes.length} 条：${lines.join(' | ')}`);
        } catch (err: any) {
          this._addLog('err', `detect 失败：${err.name} — ${err.message}`);
          this.setState({ barcodeResult: `检测失败：${err.message}` });
        }
      };
      img.onerror = (): void => {
        URL.revokeObjectURL(url);
        this._addLog('err', '图片加载失败');
      };
      img.src = url;
    } catch (err: any) {
      this._addLog('err', `条码检测流程异常：${err.message}`);
    }
  }

  async _refreshPermissions(): Promise<void> {
    if (typeof navigator.permissions === 'undefined') {
      this._addLog('err', '当前浏览器不支持 Permissions API');
      return;
    }
    this._addLog('perm', '开始并行查询权限…');
    // 先解绑旧的 onchange
    if (this._permStatuses) {
      for (const ps of this._permStatuses) {
        try { ps.onchange = null; } catch { /* noop */ }
      }
    }
    this._permStatuses = [];
    const results: PermissionItem[] = await Promise.all(
      PERMISSION_NAMES.map(async (name): Promise<PermissionItem> => {
        try {
          const status = await navigator.permissions.query({ name: name as PermissionName });
          // 订阅 onchange，权限变化时更新对应行
          status.onchange = () => {
            this._addLog('perm', `权限「${name}」状态变化 → ${status.state}`);
            this.setState({
              permissionsList: this.state.permissionsList.map((p) =>
                p.name === name ? { ...p, state: status.state } : p,
              ),
            });
          };
          this._permStatuses!.push(status);
          return { name, state: status.state, note: '已订阅 onchange' };
        } catch (err: any) {
          return { name, state: 'unsupported', note: `${err.name}: ${err.message}` };
        }
      }),
    );
    this.setState({ permissionsList: results });
    this._addLog('perm', `权限查询完成：${results.length} 项，已订阅 onchange`);
  }

  _capTag(ok: boolean): Node {
    return ok
      ? h(Tag, { color: 'success' }, '支持')
      : h(Tag, { color: 'error' }, '不支持');
  }

  _permStateColor(state: string): string {
    if (state === 'granted') return 'success';
    if (state === 'denied') return 'error';
    if (state === 'prompt') return 'warning';
    return 'default';
  }

  // 渲染坐标 / 数值信息行（label + value）
  _kvRow(label: string, value: number | null | string, unit: string = ''): Node {
    const text = value == null ? 'N/A' : `${value}${unit}`;
    return h('div', { class: 'flex items-center gap-sm' },
      h('span', { class: 'fs-sm text-secondary', style: { minWidth: '120px' } }, label),
      h('span', { class: 'fs-sm' }, text),
    );
  }

  renderPage(): Node | string | (Node | string)[] {
    const caps = this.state.capabilities || { geo: false, orient: false, permissions: false, barcode: false };
    const sensorSupport = this.state.sensorSupport || {};
    const ov = this.state.orientValues;
    const av = this.state.accelValues;

    return [
      h('h2', { class: 'section-title' }, '设备传感器与定位 API 实验室'),

      h(Alert, {
        type: 'info',
        message: 'Geolocation / Device Orientation & Motion / Generic Sensor / Barcode Detector / Permissions',
        description: '本页演示设备传感器与权限相关 Web API。多数 API 需要 HTTPS、localhost 或移动端环境，浏览器支持差异较大。所有按钮均会真实调用对应原生 API，结果写入下方日志。',
      }),

      h('div', { class: 'feature-grid mt-lg' },

        // ============ 1. Geolocation ============
        h(Card, {
          title: '1. Geolocation 地理位置',
          extra: h('span', { class: 'flex items-center gap-xs' },
            h(Tag, { color: 'primary' }, 'navigator.geolocation'),
            this._capTag(caps.geo),
          ),
        },
          h('div', { class: 'flex flex-col gap-sm' },
            h('p', { class: 'fs-sm text-tertiary' },
              'getCurrentPosition(success, error, options) 单次定位；watchPosition 持续监听并返回 watchId，clearWatch(id) 停止。options 可设 enableHighAccuracy / timeout / maximumAge。position.coords 含 latitude、longitude、accuracy、altitude、altitudeAccuracy、heading、speed，position.timestamp 为采集时间戳。'),
            h('div', { class: 'flex flex-wrap gap-sm' },
              this._btn('获取定位', {
                type: 'primary', size: 'sm',
                onClick: () => this._geoGet(),
                disabled: !caps.geo,
              }),
              this._btn('开始监听', {
                size: 'sm',
                onClick: () => this._geoWatch(),
                disabled: !caps.geo || this.state.geoWatching,
              }),
              this._btn('停止监听', {
                size: 'sm', danger: true,
                onClick: () => this._geoStopWatch(),
                disabled: !this.state.geoWatching,
              }),
            ),
            this.state.geoCoords
              ? h('div', { class: 'log-panel', style: { height: 'auto', padding: '12px' } },
                  this._kvRow('latitude', (this.state.geoCoords.latitude as any).toFixed(6), '°'),
                  this._kvRow('longitude', (this.state.geoCoords.longitude as any).toFixed(6), '°'),
                  this._kvRow('accuracy', (this.state.geoCoords.accuracy as any).toFixed(1), 'm'),
                  this._kvRow('altitude', this.state.geoCoords.altitude, 'm'),
                  this._kvRow('altitudeAccuracy', this.state.geoCoords.altitudeAccuracy, 'm'),
                  this._kvRow('heading', this.state.geoCoords.heading, '°'),
                  this._kvRow('speed', this.state.geoCoords.speed, 'm/s'),
                  this._kvRow('timestamp', this.state.geoCoords.timestamp, 'ms'),
                )
              : h('p', { class: 'fs-sm text-tertiary' }, '（点击「获取定位」后，坐标会显示在这里）'),
            h('p', { class: 'fs-xs text-tertiary' },
              '错误码：1=PERMISSION_DENIED，2=POSITION_UNAVAILABLE，3=TIMEOUT。调用需用户授权，且通常要求 HTTPS。'),
          ),
        ),

        // ============ 2. Device Orientation & Motion ============
        h(Card, {
          title: '2. Device Orientation & Motion 设备方向与运动',
          extra: h('span', { class: 'flex items-center gap-xs' },
            h(Tag, { color: 'primary' }, 'deviceorientation'),
            this._capTag(caps.orient),
          ),
        },
          h('div', { class: 'flex flex-col gap-sm' },
            h('p', { class: 'fs-sm text-tertiary' },
              'deviceorientation 事件提供 alpha（罗盘方向 0-360）、beta（前后倾斜 -180~180）、gamma（左右倾斜 -90~90）、absolute。devicemotion 事件提供 accelerationIncludingGravity {x,y,z}、acceleration、rotationRate {alpha,beta,gamma}、interval。'),
            caps.orient === false ? h(Alert, {
              type: 'warning',
              message: '当前浏览器不支持 DeviceOrientationEvent',
              description: '桌面端通常无方向传感器，请使用移动设备访问。',
            }) : null,
            h(Alert, {
              type: 'info',
              message: 'iOS 13+ 权限提示',
              description: 'iOS Safari 中需先点击「开始方向监听」，由用户手势触发 DeviceOrientationEvent.requestPermission() 弹窗授权后才能收到事件。',
            }),
            h('div', { class: 'flex flex-wrap gap-sm' },
              this._btn('开始方向监听', {
                type: 'primary', size: 'sm',
                onClick: () => this._orientStart(),
                disabled: !caps.orient || this.state.orientationActive,
              }),
              this._btn('停止', {
                size: 'sm', danger: true,
                onClick: () => this._orientStop(),
                disabled: !this.state.orientationActive,
              }),
            ),
            h('div', { class: 'flex items-center gap-md' },
              h('div', {
                class: 'orient-compass',
                style: {
                  width: '80px', height: '80px', borderRadius: '8px',
                  background: 'linear-gradient(135deg, #1677ff, #52c41a)',
                  transform: `rotate(${ov.alpha}deg)`,
                  transition: 'transform 0.1s linear',
                  flexShrink: '0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                },
              }, h('span', {
                style: { color: '#fff', fontSize: '11px', display: 'block', textAlign: 'center', lineHeight: '80px' },
              }, 'N')),
              h('div', { class: 'fs-sm' },
                this._kvRow('alpha', (ov.alpha as any).toFixed(1), '°'),
                this._kvRow('beta', (ov.beta as any).toFixed(1), '°'),
                this._kvRow('gamma', (ov.gamma as any).toFixed(1), '°'),
              ),
            ),
            h('p', { class: 'fs-xs text-tertiary' },
              '左侧方块 transform: rotate(alpha) 跟随罗盘方向旋转。方向事件已节流至约 10 次/秒，devicemotion 日志每 500ms 一条。'),
          ),
        ),

        // ============ 3. Generic Sensor API ============
        h(Card, {
          title: '3. Generic Sensor API 通用传感器',
          extra: h('span', { class: 'flex items-center gap-xs' },
            h(Tag, { color: 'primary' }, 'Sensor APIs'),
            this._capTag(sensorSupport.Accelerometer),
          ),
        },
          h('div', { class: 'flex flex-col gap-sm' },
            h('p', { class: 'fs-sm text-tertiary' },
              'Generic Sensor API 将传感器抽象为对象：new Accelerometer({ frequency: 10 }) 构造，addEventListener(\'reading\') 读取 x/y/z，\'error\' 监听错误，start()/stop() 控制。sensor.activated / hasReading / timestamp 反映状态，可结合 navigator.permissions.query({ name: \'accelerometer\' }) 查权限。多为 Chromium 实验性支持。'),
            h('div', { class: 'flex flex-wrap gap-xs' },
              ...SENSOR_CTOR_NAMES.map((name: string) =>
                h('span', { class: 'flex items-center gap-xs' },
                  h('span', { class: 'fs-xs text-secondary' }, name),
                  sensorSupport[name]
                    ? h(Tag, { color: 'success' }, '支持')
                    : h(Tag, { color: 'error' }, '不支持'),
                )),
            ),
            h('div', { class: 'flex flex-wrap gap-sm' },
              this._btn('启动加速度计', {
                type: 'primary', size: 'sm',
                onClick: () => this._accelStart(),
                disabled: !sensorSupport.Accelerometer || this.state.accelActive,
              }),
              this._btn('停止', {
                size: 'sm', danger: true,
                onClick: () => this._accelStop(),
                disabled: !this.state.accelActive,
              }),
            ),
            h('div', { class: 'log-panel', style: { height: 'auto', padding: '12px' } },
              this._kvRow('x', (av.x as any).toFixed(3)),
              this._kvRow('y', (av.y as any).toFixed(3)),
              this._kvRow('z', (av.z as any).toFixed(3)),
              this._kvRow('activated', this.state.accelActive ? 'true' : 'false'),
            ),
            h('p', { class: 'fs-xs text-tertiary' },
              'Accelerometer 以 10Hz 采样；点击启动前会先查询 accelerometer 权限。其余传感器（Gyroscope / Magnetometer 等）API 用法一致。'),
          ),
        ),

        // ============ 4. Barcode Detection ============
        h(Card, {
          title: '4. Barcode Detection 条码检测',
          extra: h('span', { class: 'flex items-center gap-xs' },
            h(Tag, { color: 'primary' }, 'BarcodeDetector'),
            this._capTag(caps.barcode),
          ),
        },
          h('div', { class: 'flex flex-col gap-sm' },
            h('p', { class: 'fs-sm text-tertiary' },
              'BarcodeDetector.getSupportedFormats() 返回支持的格式数组；new BarcodeDetector({ formats: [...] }) 构造；detector.detect(canvasOrImage) 返回 [{ rawValue, boundingBox, cornerPoints, format }]。'),
            caps.barcode === false ? h(Alert, {
              type: 'warning',
              message: '当前浏览器不支持 BarcodeDetector',
              description: '该 API 仅在部分 Chromium 内核浏览器可用。详见 MDN：https://developer.mozilla.org/zh-CN/docs/Web/API/BarcodeDetector',
            }) : null,
            h('div', { class: 'flex flex-wrap gap-sm items-center' },
              this._btn('查询支持格式', {
                size: 'sm',
                onClick: () => this._barcodeInitFormats(),
                disabled: !caps.barcode,
              }),
              h('label', {
                class: 'btn btn--sm',
                style: {
                  cursor: caps.barcode ? 'pointer' : 'not-allowed',
                  opacity: caps.barcode ? 1 : 0.6,
                },
              },
                caps.barcode ? '选择图片检测' : '（不支持）',
                h('input', {
                  type: 'file',
                  accept: 'image/*',
                  disabled: !caps.barcode,
                  style: { display: 'none' },
                  onChange: (e: Event) => {
                    const target = e.target as HTMLInputElement;
                    const file = target.files && target.files[0];
                    this._barcodeDetect((file as any));
                  },
                }),
              ),
            ),
            this.state.barcodeFormats.length > 0
              ? h('p', { class: 'fs-xs text-tertiary' }, `已支持格式：${this.state.barcodeFormats.join(', ')}`)
              : null,
            h('canvas', {
              class: 'barcode-canvas',
              width: 320,
              height: 240,
              style: {
                background: '#1e1e1e', borderRadius: '8px',
                maxWidth: '100%', display: 'block',
              },
            }),
            this.state.barcodeResult
              ? h('div', { class: 'log-panel', style: { height: 'auto', padding: '12px', whiteSpace: 'pre-wrap' } },
                  this.state.barcodeResult)
              : h('p', { class: 'fs-sm text-tertiary' }, '（选择包含条码的图片后，检测结果会显示在这里）'),
          ),
        ),

        // ============ 5. Permissions API ============
        h(Card, {
          title: '5. Permissions API 权限查询',
          extra: h('span', { class: 'flex items-center gap-xs' },
            h(Tag, { color: 'primary' }, 'navigator.permissions'),
            this._capTag(caps.permissions),
          ),
        },
          h('div', { class: 'flex flex-col gap-sm' },
            h('p', { class: 'fs-sm text-tertiary' },
              'navigator.permissions.query({ name }) 返回 PermissionStatus { state, onchange }，状态为 granted / denied / prompt。监听 onchange 可捕获权限变化。部分权限名称在不支持时会抛 TypeError，需 try/catch。'),
            h('div', { class: 'flex flex-wrap gap-sm' },
              this._btn('刷新权限', {
                type: 'primary', size: 'sm',
                onClick: () => this._refreshPermissions(),
                disabled: !caps.permissions,
              }),
            ),
            this.state.permissionsList.length > 0
              ? h('div', { class: 'flex flex-col gap-xs' },
                  ...this.state.permissionsList.map((p: PermissionItem) =>
                    h('div', {
                      class: 'flex items-center gap-sm',
                      style: { padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' },
                    },
                      h('span', { class: 'fs-sm', style: { minWidth: '140px' } }, p.name),
                      h(Tag, { color: this._permStateColor(p.state) }, p.state),
                      h('span', { class: 'fs-xs text-tertiary' }, p.note),
                    )),
                )
              : h('p', { class: 'fs-sm text-tertiary' }, '（点击「刷新权限」查询 geolocation / notifications / camera / microphone / accelerometer / background-sync / persistent-storage）'),
          ),
        ),
      ),

      // 事件日志
      h(Card, { title: '事件日志', extra: h('span', { class: 'fs-sm text-tertiary' }, '实时') },
        h('div', { class: 'log-panel' },
          ...this.state.logs.map((log: DeviceSensorsLog) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', {}, log.content),
          )),
        ),
      ),
    ];
  }
}
