// =====================================================================
// PointerLockAPIPage.ts —— Pointer Lock API 鼠标锁定 完整实验室
// 演示 W3C Pointer Lock API（前 Mouse Lock API）的全套能力：
//   1. 概述与动机 —— 鼠标移出视口限制 / 3D FPS 游戏需求 / 全景/沉浸式
//      体验 / Pointer Lock API W3C / 浏览器支持 Chrome 22+/Firefox 14+
//      /Safari 10.1+ 全部稳定多年 / 与 Fullscreen API 协同
//   2. requestPointerLock 基础 —— element.requestPointerLock() / 返回
//      Promise（新版本）/ 旧版本无返回值 + pointerlockchange 事件 /
//      document.pointerLockElement / 必须用户手势触发 / 安全上下文
//   3. document.exitPointerLock —— document.exitPointerLock() / 解除锁定
//      / pointerlockchange 事件 / pointerlockerror 事件 / 错误原因
//   4. pointerlockchange 与 pointerlockerror 事件 —— document.
//      addEventListener('pointerlockchange', cb) / document.
//      pointerLockElement 当前锁定元素 / pointerlockerror 锁定失败 /
//      与 mousemove 配合
//   5. movementX/movementY —— mousemove 事件 e.movementX / e.movementY
//      / 锁定后鼠标相对位移 / 无边界限制 / 与 clientX/clientY 区别 /
//      高频更新
//   6. 实战：第一人称 3D 相机控制 —— requestPointerLock + mousemove
//      movementX/Y → 旋转相机 / pitch/yaw 计算 / 与 WebGL/WebGPU 协同
//      / 反转 Y 轴
//   7. 实战：全景图/360° 图片浏览 —— 拖拽锁定浏览全景 / 全屏 + 指针锁定
//      / 与 DeviceOrientation API 移动端对比 / 虚拟现实场景
//   8. 陷阱与最佳实践 —— 必须用户手势（click 后调用）/ Esc 键系统强制
//      解锁 / 标签页失焦自动解锁 / 与 Fullscreen API 协同 / 无障碍
//      （键盘等价）/ iOS Safari 不支持 / 安全考虑（防钓鱼）
// 说明：所有特性调用前做 typeof / 'xxx' in document 能力检测，不可用时
//       仅记日志（_addLog('warn', ...)），绝不抛异常。jsdom 不实现
//       Pointer Lock，所有能力检测统一兜底返回 false；真实浏览器
//       （Chrome/Firefox/Safari/Edge）全支持。注入演示样式 + 完整代码
//       示例，真实浏览器可查看指针锁定效果与 movementX/Y 事件流。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { Props, State } from '../../core/types.js';
import type { ButtonProps } from '../../components/ui/Button.js';

interface LogEntry {
  type: string;
  content: string;
  time: string;
}

interface MovementSample {
  x: number;
  y: number;
  cx: number;
  cy: number;
}

interface PointerLockCaps {
  requestPointerLock: boolean;
  exitPointerLock: boolean;
  pointerLockElement: boolean;
  movement: boolean;
  lockChangeEvent: boolean;
  fullscreen: boolean;
  secureContext: boolean;
}

type ListenerEntry = [EventTarget, string, EventListener];

export interface PointerLockAPIPageProps extends Props {}

export interface PointerLockAPIPageState extends State {
  logs: LogEntry[];
  capsSummary: string;
  overviewInfo: string;
  requestInfo: string;
  exitInfo: string;
  eventsInfo: string;
  movementInfo: string;
  fpsInfo: string;
  panoramaInfo: string;
  pitfallsInfo: string;
}

export class PointerLockAPIPage extends Page {
  declare props: PointerLockAPIPageProps;
  declare state: PointerLockAPIPageState;

  _inited: boolean = false;
  _dynamicStyles: HTMLStyleElement[] = [];
  _lockListeners: ListenerEntry[] = [];
  _moveListeners: ListenerEntry[] = [];
  _locked: boolean = false;
  _movementSamples: MovementSample[] = [];
  _yaw: number = 0;
  _pitch: number = 0;
  _panoAngle: number = 0;

  // —— 初始 state ——
  initialState(): PointerLockAPIPageState {
    return {
      logs: [],
      capsSummary: '',
      overviewInfo: '',         // Card 1：概述与动机
      requestInfo: '',          // Card 2：requestPointerLock 基础
      exitInfo: '',             // Card 3：document.exitPointerLock
      eventsInfo: '',           // Card 4：pointerlockchange/error 事件
      movementInfo: '',         // Card 5：movementX/movementY
      fpsInfo: '',              // Card 6：第一人称 3D 相机控制
      panoramaInfo: '',         // Card 7：全景图/360° 图片浏览
      pitfallsInfo: '',         // Card 8：陷阱与最佳实践
    };
  }

  // —— 生命周期 ——
  componentDidMount(): void {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._dynamicStyles = [];        // 动态创建并插入 head 的 <style> 元素列表
    this._lockListeners = [];        // 注册的 document 事件监听器（卸载时移除）
    this._moveListeners = [];        // 注册的 mousemove 监听器
    this._locked = false;            // 当前是否处于指针锁定状态
    this._movementSamples = [];      // Card 5 mousemove 采样
    this._yaw = 0;                   // Card 6 yaw 偏航角
    this._pitch = 0;                 // Card 6 pitch 俯仰角
    this._panoAngle = 0;             // Card 7 全景偏移角

    // 一次性能力检测：Pointer Lock API 全家桶
    const f = this._flags();
    const c = (ok: boolean): string => ok ? '✓' : '✗';
    const parts = [
      `requestPointerLock ${c(f.requestPointerLock)}`,
      `exitPointerLock ${c(f.exitPointerLock)}`,
      `pointerLockElement ${c(f.pointerLockElement)}`,
      `movementX/Y ${c(f.movement)}`,
      `pointerlockchange ${c(f.lockChangeEvent)}`,
      `Fullscreen API ${c(f.fullscreen)}`,
      `SecureContext ${c(f.secureContext)}`,
    ];

    const summary = f.requestPointerLock
      ? `Pointer Lock API 能力检测：${parts.join(' · ')}。jsdom 不实现 Pointer Lock，所有检测统一兜底返回 false；真实浏览器（Chrome 22+/Firefox 14+/Safari 10.1+）全支持。点击「运行演示」按钮在真实浏览器中将请求指针锁定（需用户手势触发），movementX/Y 事件将实时记录。`
      : '当前环境不支持 Pointer Lock API（jsdom 不实现，或非安全上下文）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器（HTTPS 或 localhost）中打开可完整演示。';

    this.setState({ capsSummary: summary });
    this._addLog(f.requestPointerLock ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.requestPointerLock) this._addLog('warn', 'Element.prototype.requestPointerLock 不可用（jsdom 不实现；真实浏览器 Chrome 22+/Firefox 14+/Safari 10.1+ 全支持，需安全上下文 HTTPS/localhost）');
    if (!f.movement) this._addLog('warn', 'movementX/movementY 不可用（PointerEvent.movementX，锁定后提供无边界相对位移；jsdom 不实现）');
    if (!f.secureContext) this._addLog('warn', '当前非安全上下文（window.isSecureContext=false），Pointer Lock 在非安全上下文被禁用');

    // 注册 document 级 pointerlockchange/error 监听（仅一次）
    this._setupDocumentListeners();

    // 一次性注入全部演示样式（仅一次；rerender 不会移除 head 中的 style）
    this._injectBaseStyles();
  }

  componentWillUnmount(): void {
    this._destroyed = true;
    // 移除动态创建的 <style> 元素，便于 GC
    for(const style of this._dynamicStyles) {
      try { style.parentNode && style.parentNode.removeChild(style); } catch { /* noop */ }
    }
    this._dynamicStyles = [];
    // 移除 document 事件监听器，避免内存泄漏
    for(const [target, type, fn] of this._lockListeners) {
      try { target.removeEventListener(type, fn); } catch { /* noop */ }
    }
    this._lockListeners = [];
    for(const [target, type, fn] of this._moveListeners) {
      try { target.removeEventListener(type, fn); } catch { /* noop */ }
    }
    this._moveListeners = [];
    // 退出指针锁定（若处于锁定状态）
    if(this._locked) {
      try { document.exitPointerLock && document.exitPointerLock(); } catch { /* noop */ }
    }
  }

  // —— 日志 / 按钮辅助 ——

  _addLog(type: string, content: string): void {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label: string, opts: ButtonProps): Node | string {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // 返回 Tag 数组：items = [[label, ok], ...]，展示能力状态（✓/✗）
    _caps(items?: [string, boolean][]): any {
    return items!.map(([label, ok]: any) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  // 返回布尔能力对象（供 capsSummary / 按钮 disabled 使用）
  // 用 safe(()=>...) 包裹，jsdom 不可用时返回 false
  _flags(): PointerLockCaps {
    const safe = (fn: () => boolean): boolean => { try { return fn(); } catch { return false; } };
    return {
      requestPointerLock: safe(() => typeof Element !== 'undefined' && typeof Element.prototype.requestPointerLock === 'function'),
      exitPointerLock: safe(() => typeof document !== 'undefined' && typeof document.exitPointerLock === 'function'),
      pointerLockElement: safe(() => typeof document !== 'undefined' && 'pointerLockElement' in document),
      movement: safe(() => typeof PointerEvent !== 'undefined' && 'movementX' in PointerEvent.prototype),
      lockChangeEvent: safe(() => typeof window !== 'undefined' && (typeof (window as any).onpointerlockchange !== 'undefined' || 'pointerlockchange' in document)),
      fullscreen: safe(() => typeof Element !== 'undefined' && typeof Element.prototype.requestFullscreen === 'function'),
      secureContext: safe(() => typeof window !== 'undefined' && window.isSecureContext === true),
    };
  }

  // —— 注入一个 <style>，跟踪到 this._dynamicStyles ——
  _injectStyle(id: string, textContent: string): HTMLStyleElement {
    const existing = (document.getElementById(id) as any);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = textContent;
    document.head.appendChild(style);
    this._dynamicStyles.push(style);
    return style;
  }

  // —— 注册 document 级 pointerlockchange/error 监听 ——
  _setupDocumentListeners(): void {
    if (typeof document === 'undefined' || !document.addEventListener) return;
    const onChange = (): void => {
      const lockedEl = document.pointerLockElement;
      this._locked = !!lockedEl;
      const tag = lockedEl ? (lockedEl.id || lockedEl.className || 'element') : 'null';
      this._addLog('info', `pointerlockchange 触发：document.pointerLockElement = ${tag}（${this._locked ? '已锁定' : '已解锁'}）`);
      const out = (this.el as any as Element | null)?.querySelector('.pl-lock-state');
      if (out) out.textContent = '当前锁定状态：' + (this._locked ? '已锁定（document.pointerLockElement = ' + tag + '）' : '未锁定');
    };
    const onError = (): void => {
      this._addLog('warn', 'pointerlockerror 触发：指针锁定失败（用户拒绝/系统策略/安全上下文/无效元素）');
      const out = (this.el as any as Element | null)?.querySelector('.pl-lock-state');
      if (out) out.textContent = '当前锁定状态：锁定失败（pointerlockerror）';
    };
    try {
      document.addEventListener('pointerlockchange', onChange);
      this._lockListeners.push([document, 'pointerlockchange', onChange]);
    } catch { /* noop */ }
    try {
      document.addEventListener('pointerlockerror', onError);
      this._lockListeners.push([document, 'pointerlockerror', onError]);
    } catch { /* noop */ }
  }

  // —— 动态注入所有演示样式 ——
  _injectBaseStyles(): void {
    this._injectStyle('pointer-lock-demo', `
      /* ===== 通用舞台 ===== */
      .pl-stage {
        margin-top: 10px;
        padding: 12px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
      }
      /* ===== Card 2：requestPointerLock 目标元素 ===== */
      .pl-target {
        width: 240px;
        height: 120px;
        padding: 10px;
        background: #dbeafe;
        border: 2px solid #3b82f6;
        color: #1e3a8a;
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        white-space: pre-wrap;
        user-select: none;
      }
      .pl-target.pl-active { background: #bfdbfe; border-color: #1d4ed8; }
      /* ===== Card 5：movement 采样区 ===== */
      .pl-move-area {
        width: 100%;
        height: 140px;
        padding: 10px;
        background: #fef3c7;
        border: 2px dashed #f59e0b;
        color: #78350f;
        border-radius: 6px;
        font-size: 13px;
        overflow: auto;
        white-space: pre-wrap;
        cursor: crosshair;
      }
      /* ===== Card 6：3D 相机视口 ===== */
      .pl-viewport {
        position: relative;
        width: 100%;
        height: 220px;
        background: linear-gradient(180deg, #0f172a 0%, #1e3a8a 60%, #0f172a 100%);
        border: 2px solid #3b82f6;
        border-radius: 6px;
        overflow: hidden;
        cursor: pointer;
      }
      .pl-viewport .pl-crosshair {
        position: absolute;
        left: 50%; top: 50%;
        transform: translate(-50%, -50%);
        color: #fbbf24;
        font-size: 24px;
        text-shadow: 0 0 6px #000;
      }
      .pl-viewport .pl-hud {
        position: absolute;
        top: 8px; left: 8px;
        color: #93c5fd;
        font-family: monospace;
        font-size: 12px;
        text-shadow: 0 0 4px #000;
      }
      .pl-viewport .pl-cube {
        position: absolute;
        color: #e2e8f0;
        font-size: 28px;
        text-shadow: 0 0 6px #3b82f6;
      }
      /* ===== Card 7：全景图 ===== */
      .pl-panorama {
        position: relative;
        width: 100%;
        height: 200px;
        background: linear-gradient(90deg, #7c2d12 0%, #b45309 25%, #15803d 50%, #1e40af 75%, #6b21a8 100%);
        border: 2px solid #8b5cf6;
        border-radius: 6px;
        overflow: hidden;
        cursor: grab;
      }
      .pl-panorama.pl-grabbing { cursor: grabbing; }
      .pl-panorama .pl-pano-marker {
        position: absolute;
        top: 50%;
        color: #fff;
        font-size: 18px;
        text-shadow: 0 0 4px #000;
        transform: translateY(-50%);
      }
      .pl-panorama .pl-pano-hud {
        position: absolute;
        bottom: 8px; left: 8px;
        color: #fff;
        font-family: monospace;
        font-size: 12px;
        text-shadow: 0 0 4px #000;
        background: rgba(0,0,0,0.4);
        padding: 2px 6px;
        border-radius: 3px;
      }
      /* ===== 输出区 ===== */
      .pl-output {
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 4px;
        padding: 8px;
        font-family: monospace;
        font-size: 11px;
        white-space: pre-wrap;
        word-break: break-all;
        margin-top: 8px;
        min-height: 24px;
      }
      .pl-lock-state {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 4px;
        background: #e2e8f0;
        color: #0f172a;
        font-size: 12px;
        font-family: monospace;
      }
    `);
  }

  // —— 真实调用 element.requestPointerLock（带能力检测）——
  _tryRequestLock(el: Element | null): void {
    const f = this._flags();
    if(!f.requestPointerLock) {
      this._addLog('warn', 'requestPointerLock 不可用（jsdom 不实现 / 非安全上下文），跳过锁定请求');
      return;
    }
    if(!el) {
      this._addLog('warn', 'requestPointerLock：未找到目标元素');
      return;
    }
    try {
      const ret: unknown = el.requestPointerLock();
      // 新版本返回 Promise，旧版本无返回值
      if (ret && typeof (ret as any).then === 'function') {
        (ret as Promise<void>).then(() => {
          this._addLog('info', 'requestPointerLock Promise 已 resolve（锁定成功）');
        }).catch((err: unknown) => {
          const e = err as Error;
          this._addLog('warn', `requestPointerLock Promise rejected：${e && e.name ? e.name : 'Error'} - ${e && e.message ? e.message : ''}`);
        });
        this._addLog('info', 'requestPointerLock 已调用（返回 Promise，等待 resolve/reject）');
      } else {
        this._addLog('info', 'requestPointerLock 已调用（旧版本无返回值，等待 pointerlockchange 事件）');
      }
    } catch (err: any) {
      const e = err as Error;
      this._addLog('warn', `requestPointerLock 调用异常：${e.name} - ${e.message}`);
    }
  }

  // —— 真实调用 document.exitPointerLock（带能力检测）——
  _tryExitLock(): void {
    const f = this._flags();
    if(!f.exitPointerLock) {
      this._addLog('warn', 'document.exitPointerLock 不可用（jsdom 不实现），跳过解锁请求');
      return;
    }
    try {
      document.exitPointerLock();
      this._addLog('info', 'exitPointerLock 已调用（等待 pointerlockchange 事件）');
    } catch (err: any) {
      const e = err as Error;
      this._addLog('warn', `exitPointerLock 调用异常：${e.name} - ${e.message}`);
    }
  }

  // =================== Card 1：概述与动机 ===================

  _readOverviewInfo(): string {
    const f = this._flags();
    try {
      return `===== Pointer Lock API 概述与动机 =====\n` +
        `\n` +
        `【规范归属】\n` +
        `  Pointer Lock API（前 Mouse Lock API），W3C 规范\n` +
        `  规范地址：https://w3c.github.io/pointerlock/\n` +
        `  历史名称：Mouse Lock API → 现名 Pointer Lock API\n` +
        `\n` +
        `【核心动机】\n` +
        `  传统鼠标交互受限于视口边界：鼠标移出窗口即丢失追踪\n` +
        `  3D FPS 游戏需要持续旋转视角，鼠标必须无边界移动\n` +
        `  全景图/360° 图片浏览需要持续拖拽，无边界面板\n` +
        `  沉浸式 WebXR/虚拟现实场景需要隐藏光标 + 持续追踪\n` +
        `  Pointer Lock 把鼠标"锁定"到指定元素，移除边界限制\n` +
        `\n` +
        `【与 Fullscreen API 协同】\n` +
        `  Pointer Lock 常与 Fullscreen API 配合实现沉浸式体验\n` +
        `  典型流程：requestFullscreen() → requestPointerLock()\n` +
        `  两者独立，但全屏后锁定更自然（避免视觉干扰）\n` +
        `\n` +
        `【浏览器支持】\n` +
        `  Chrome 22+ / Edge 79+ / Firefox 14+ / Safari 10.1+ / Opera 16+\n` +
        `  全部稳定多年（2012-2017 起支持），无需 prefix（旧版需 webkit/moz）\n` +
        `  iOS Safari 不支持（移动端无鼠标概念，用 DeviceOrientation 替代）\n` +
        `  必须安全上下文（HTTPS 或 localhost）\n` +
        `\n` +
        `【当前环境能力检测】\n` +
        `  requestPointerLock    = ${f.requestPointerLock}\n` +
        `  exitPointerLock       = ${f.exitPointerLock}\n` +
        `  pointerLockElement    = ${f.pointerLockElement}\n` +
        `  movementX/Y           = ${f.movement}\n` +
        `  pointerlockchange     = ${f.lockChangeEvent}\n` +
        `  Fullscreen API        = ${f.fullscreen}\n` +
        `  SecureContext         = ${f.secureContext}\n` +
        `\n` +
        `【核心 API 一览】\n` +
        `  element.requestPointerLock()           // 请求锁定（用户手势触发）\n` +
        `  document.exitPointerLock()             // 解除锁定\n` +
        `  document.pointerLockElement            // 当前锁定元素（null 或 Element）\n` +
        `  document.addEventListener('pointerlockchange', cb)\n` +
        `  document.addEventListener('pointerlockerror', cb)\n` +
        `  // mousemove 事件新增 movementX / movementY 属性\n` +
        `  element.addEventListener('mousemove', e => {\n` +
        `    console.log(e.movementX, e.movementY);  // 锁定后相对位移\n` +
        `  });\n` +
        `\n` +
        `【完整代码示例：最小可运行】\n` +
        `  const target = document.querySelector('#stage');\n` +
        `  target.addEventListener('click', () => {\n` +
        `    // 必须在用户手势（click）内调用，否则被浏览器拒绝\n` +
        `    target.requestPointerLock();\n` +
        `  });\n` +
        `  document.addEventListener('pointerlockchange', () => {\n` +
        `    if (document.pointerLockElement === target) {\n` +
        `      console.log('已锁定，开始监听 mousemove');\n` +
        `    } else {\n` +
        `      console.log('已解锁');\n` +
        `    }\n` +
        `  });\n` +
        `  document.addEventListener('pointerlockerror', () => {\n` +
        `    console.warn('锁定失败');\n` +
        `  });`;
    } catch (err: any) {
      const e = err as Error;
      return `读取 Pointer Lock 概述信息失败：${e.name} - ${e.message}`;
    }
  }

  _runOverviewDemo(): void {
    this.setState({ overviewInfo: this._readOverviewInfo() });
    this._addLog('info', `Pointer Lock 概述演示：requestPointerLock=${this._flags().requestPointerLock}, secureContext=${this._flags().secureContext}`);
  }

  _renderCard1(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. 概述与动机 —— Pointer Lock API（前 Mouse Lock API）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['requestPointerLock', f.requestPointerLock],
          ['movementX/Y', f.movement],
          ['SecureContext', f.secureContext],
        ]),
        h(Tag, { color: 'primary' }, 'W3C 规范'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Pointer Lock API（前 Mouse Lock API，W3C 规范）将鼠标锁定到指定元素，移除视口边界限制，鼠标可无限移动。核心动机：3D FPS 游戏持续旋转视角、全景图/360° 浏览持续拖拽、沉浸式 WebXR 场景。浏览器支持 Chrome 22+/Firefox 14+/Safari 10.1+ 全部稳定多年，必须安全上下文（HTTPS/localhost），iOS Safari 不支持（移动端用 DeviceOrientation 替代）。常与 Fullscreen API 协同实现沉浸式体验。锁定后 mousemove 事件新增 movementX/movementY 属性提供无边界相对位移。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行演示', { type: 'primary', size: 'sm', onClick: () => this._runOverviewDemo() }),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.overviewInfo || '（点击「运行演示」查看 Pointer Lock API 完整说明）')),
        h(Alert, {
          type: 'info',
          message: 'Pointer Lock 移除鼠标视口边界限制，常与 Fullscreen API 协同',
          description: '传统鼠标受视口边界限制，移出窗口即丢失追踪。Pointer Lock 把鼠标锁定到指定元素，可无限移动，常用于 3D FPS 游戏、全景图浏览、WebXR 沉浸式场景。必须安全上下文（HTTPS/localhost），必须用户手势触发。iOS Safari 不支持（移动端用 DeviceOrientation API 替代）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 2：requestPointerLock 基础 ===================

  _readRequestInfo(): string {
    const f = this._flags();
    try {
      const target = (this.el as any as Element | null)?.querySelector('.pl-target');
      let supportsPromise = '(未检测)';
      if(target && f.requestPointerLock) {
        try {
          // 不实际调用，仅检测返回值类型特征（requestPointerLock.length 等）
          supportsPromise = '现代浏览器返回 Promise，旧版本无返回值';
        } catch { supportsPromise = '(检测失败)'; }
      }
      return `===== requestPointerLock 基础 =====\n` +
        `\n` +
        `【API 签名】\n` +
        `  element.requestPointerLock()  // 返回 Promise<void>（新版）或 undefined（旧版）\n` +
        `  Element.prototype.requestPointerLock 可用 = ${f.requestPointerLock}\n` +
        `  返回值特征：${supportsPromise}\n` +
        `\n` +
        `【调用约束】\n` +
        `  1. 必须在用户手势（click/keydown 等）触发的事件循环内调用\n` +
        `     非用户手势调用会被浏览器拒绝（触发 pointerlockerror）\n` +
        `  2. 必须安全上下文（window.isSecureContext === true）\n` +
        `     即 HTTPS 或 localhost，http:// 远端会被禁用\n` +
        `  3. 元素必须已连接到 DOM（document.contains(el) === true）\n` +
        `  4. 同一时刻只能锁定一个元素（再次锁定会先解锁旧的）\n` +
        `\n` +
        `【返回 Promise（新版）vs 无返回值（旧版）】\n` +
        `  Chrome 89+ / Firefox 50+ 返回 Promise，可 await：\n` +
        `    await el.requestPointerLock();\n` +
        `    console.log('锁定成功');\n` +
        `  旧版本（Firefox < 50, Safari 旧版）无返回值，依赖 pointerlockchange 事件\n` +
        `  兼容写法：\n` +
        `    const ret = el.requestPointerLock();\n` +
        `    if (ret && typeof ret.then === 'function') {\n` +
        `      ret.then(onLocked).catch (onError: any);\n` +
        `    } else {\n` +
        `      // 旧版本，等 pointerlockchange 事件\n` +
        `      document.addEventListener('pointerlockchange', onLocked, { once: true });\n` +
        `    }\n` +
        `\n` +
        `【锁定成功后】\n` +
        `  document.pointerLockElement === el  // true\n` +
        `  触发 pointerlockchange 事件\n` +
        `  光标隐藏，鼠标移动产生 mousemove 事件 + movementX/movementY\n` +
        `  clientX/clientY 不再变化（锁定在屏幕中心或上次位置）\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  const stage = document.querySelector('#stage');\n` +
        `  stage.addEventListener('click', () => {\n` +
        `    // ★ 用户手势内调用\n` +
        `    if (!document.pointerLockElement) {\n` +
        `      const ret = stage.requestPointerLock();\n` +
        `      if (ret && ret.catch) ret.catch((err: any) => console.warn(err));\n` +
        `    }\n` +
        `  });\n` +
        `\n` +
        `【陷阱】\n` +
        `  ✗ 非用户手势调用 → pointerlockerror（如 setTimeout 内直接调用）\n` +
        `  ✗ 非安全上下文 → API 存在但调用被拒\n` +
        `  ✗ 元素未连接 DOM → 抛 InvalidStateError\n` +
        `  ✗ 旧版本不返回 Promise，await undefined 不会报错但不 resolve`;
    } catch (err: any) {
      const e = err as Error;
      return `读取 requestPointerLock 信息失败：${e.name} - ${e.message}`;
    }
  }

  _runRequestDemo(): void {
    const f = this._flags();
    this.setState({ requestInfo: this._readRequestInfo() });
    const target = (this.el as any as Element | null)?.querySelector('.pl-target') ?? null;
    this._tryRequestLock(target);
    if (target) target.classList.toggle('pl-active', !!this._locked);
  }

  _renderCard2(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. requestPointerLock 基础 —— 元素锁定请求',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['requestPointerLock', f.requestPointerLock], ['SecureContext', f.secureContext]]),
        h(Tag, { color: 'warning' }, '需用户手势'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'element.requestPointerLock() 请求将鼠标锁定到该元素。新版浏览器（Chrome 89+/Firefox 50+）返回 Promise<void>，旧版本无返回值（依赖 pointerlockchange 事件）。调用约束：必须在用户手势（click/keydown）事件循环内调用、必须安全上下文（HTTPS/localhost）、元素必须已连接到 DOM、同一时刻只能锁定一个元素。锁定成功后 document.pointerLockElement === el，光标隐藏，鼠标移动产生 mousemove + movementX/movementY。非用户手势调用会触发 pointerlockerror。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('请求锁定', { type: 'primary', size: 'sm', disabled: !f.requestPointerLock, onClick: () => this._runRequestDemo() }),
          this._btn('读取信息', { size: 'sm', onClick: () => this.setState({ requestInfo: this._readRequestInfo() }) }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '点击下方元素请求指针锁定（真实浏览器需用户手势触发）：'),
        h('div', { class: 'pl-target', onClick: (e: Event) => this._runRequestDemo() },
          '点击我请求 Pointer Lock\n（真实浏览器将锁定鼠标到此元素）\n当前锁定状态见下方',
        ),
        h('div', { class: 'mt-sm' }, h('span', { class: 'pl-lock-state' }, '当前锁定状态：' + (this._locked ? '已锁定' : '未锁定'))),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.requestInfo || '（点击「请求锁定」或「读取信息」查看 requestPointerLock 完整说明）')),
        h(Alert, {
          type: 'warning',
          message: '必须在用户手势（click）内调用，否则触发 pointerlockerror',
          description: '非用户手势调用（如 setTimeout 内）会被浏览器拒绝。必须安全上下文（window.isSecureContext === true）。元素必须已连接 DOM（document.contains(el)）。新版返回 Promise，旧版本无返回值需监听 pointerlockchange。兼容写法：检测 ret.then 是否为函数。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 3：document.exitPointerLock ===================

  _readExitInfo(): string {
    const f = this._flags();
    try {
      return `===== document.exitPointerLock 解除锁定 =====\n` +
        `\n` +
        `【API 签名】\n` +
        `  document.exitPointerLock()  // 无返回值（undefined）\n` +
        `  document.exitPointerLock 可用 = ${f.exitPointerLock}\n` +
        `\n` +
        `【解除锁定】\n` +
        `  调用后触发 pointerlockchange 事件\n` +
        `  document.pointerLockElement 变为 null\n` +
        `  光标恢复显示，鼠标恢复正常边界行为\n` +
        `  movementX/movementY 不再产生（仅锁定期间有效）\n` +
        `\n` +
        `【自动解锁场景】\n` +
        `  1. 用户按下 Esc 键 —— 浏览器系统强制解锁（无法阻止）\n` +
        `     且 Esc 解锁后浏览器会进入"短期锁定期"（约 1 秒），\n` +
        `     期间 requestPointerLock 会被静默拒绝（防钓鱼/防滥用）\n` +
        `  2. 标签页失焦（切换标签页/最小化/切换应用）—— 自动解锁\n` +
        `  3. 锁定元素被移出 DOM —— 自动解锁\n` +
        `  4. 调用 document.exitPointerLock() —— 主动解锁\n` +
        `\n` +
        `【pointerlockerror 错误原因】\n` +
        `  - 用户拒绝（部分浏览器有权限提示）\n` +
        `  - 系统策略（如企业管理策略禁用）\n` +
        `  - 非安全上下文（http:// 远端）\n` +
        `  - 非用户手势触发（setTimeout 内调用）\n` +
        `  - Esc 解锁后的短期锁定期内再次请求\n` +
        `  - 元素未连接 DOM 或不可见\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  const exitBtn = document.querySelector('#exit');\n` +
        `  exitBtn.addEventListener('click', () => {\n` +
        `    if (document.pointerLockElement) {\n` +
        `      document.exitPointerLock();\n` +
        `    }\n` +
        `  });\n` +
        `\n` +
        `  document.addEventListener('pointerlockchange', () => {\n` +
        `    if (!document.pointerLockElement) {\n` +
        `      console.log('已解锁（用户按 Esc 或主动调用 exitPointerLock）');\n` +
        `    }\n` +
        `  });\n` +
        `\n` +
        `【陷阱】\n` +
        `  ✗ Esc 解锁后立即重新 requestPointerLock 会被静默拒绝\n` +
        `     需等待约 1 秒"短期锁定期"结束（防钓鱼）\n` +
        `  ✗ exitPointerLock 无返回值，不能 await\n` +
        `  ✗ 非锁定状态调用 exitPointerLock 不报错也无效果`;
    } catch (err: any) {
      const e = err as Error;
      return `读取 exitPointerLock 信息失败：${e.name} - ${e.message}`;
    }
  }

  _runExitDemo(): void {
    const f = this._flags();
    this.setState({ exitInfo: this._readExitInfo() });
    this._tryExitLock();
    const target = (this.el as any as Element | null)?.querySelector('.pl-target');
    if (target) target.classList.remove('pl-active');
  }

  _renderCard3(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. document.exitPointerLock —— 解除锁定',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['exitPointerLock', f.exitPointerLock]]),
        h(Tag, { color: 'error' }, 'Esc 强制解锁'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'document.exitPointerLock() 主动解除指针锁定，无返回值。调用后触发 pointerlockchange 事件，document.pointerLockElement 变为 null，光标恢复显示。自动解锁场景：用户按 Esc 键（浏览器系统强制解锁，且 Esc 后进入约 1 秒"短期锁定期"防钓鱼）、标签页失焦（切换/最小化）、锁定元素移出 DOM、主动调用 exitPointerLock。pointerlockerror 错误原因：用户拒绝/系统策略/非安全上下文/非用户手势/Esc 锁定期内再请求/元素未连接 DOM。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('解除锁定', { type: 'primary', size: 'sm', disabled: !f.exitPointerLock, onClick: () => this._runExitDemo() }),
          this._btn('读取信息', { size: 'sm', onClick: () => this.setState({ exitInfo: this._readExitInfo() }) }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '当前锁定状态（点击「解除锁定」主动解锁）：'),
        h('div', {}, h('span', { class: 'pl-lock-state' }, '当前锁定状态：' + (this._locked ? '已锁定' : '未锁定'))),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.exitInfo || '（点击「解除锁定」或「读取信息」查看 exitPointerLock 完整说明）')),
        h(Alert, {
          type: 'warning',
          message: 'Esc 解锁后约 1 秒内 requestPointerLock 会被静默拒绝（防钓鱼）',
          description: '用户按 Esc 系统强制解锁，无法阻止。Esc 后浏览器进入"短期锁定期"（约 1 秒），期间再次 requestPointerLock 会被静默拒绝（pointerlockerror），防止恶意页面钓鱼锁定。exitPointerLock 无返回值不能 await，非锁定状态调用不报错也无效果。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 4：pointerlockchange 与 pointerlockerror 事件 ===================

  _readEventsInfo(): string {
    const f = this._flags();
    try {
      return `===== pointerlockchange 与 pointerlockerror 事件 =====\n` +
        `\n` +
        `【事件类型】\n` +
        `  pointerlockchange  —— 锁定状态变化（锁定/解锁均触发）\n` +
        `  pointerlockerror   —— 锁定请求失败\n` +
        `  两者均注册在 document 上（非 element 上）\n` +
        `  pointerlockchange 事件可用 = ${f.lockChangeEvent}\n` +
        `\n` +
        `【注册方式】\n` +
        `  document.addEventListener($1, (e: any) => {\n` +
        `    const locked = document.pointerLockElement;\n` +
        `    if (locked) {\n` +
        `      console.log('已锁定到', locked);\n` +
        `    } else {\n` +
        `      console.log('已解锁');\n` +
        `    }\n` +
        `  });\n` +
        `\n` +
        `  document.addEventListener($1, (e: any) => {\n` +
        `    console.warn('锁定失败（用户拒绝/系统策略/非安全上下文）');\n` +
        `  });\n` +
        `\n` +
        `【document.pointerLockElement】\n` +
        `  当前被锁定的元素引用，未锁定时为 null\n` +
        `  锁定期间 === 请求锁定的 element\n` +
        `  解锁后变为 null（pointerlockchange 触发时已是新值）\n` +
        `  'pointerLockElement' in document = ${f.pointerLockElement}\n` +
        `\n` +
        `【与 mousemove 配合】\n` +
        `  锁定前：mousemove 的 clientX/clientY 随鼠标位置变化\n` +
        `  锁定后：clientX/clientY 锁定（不再变化），movementX/Y 持续更新\n` +
        `  推荐模式：在 pointerlockchange 锁定时注册 mousemove，解锁时移除\n` +
        `\n` +
        `  document.addEventListener('pointerlockchange', () => {\n` +
        `    if (document.pointerLockElement === stage) {\n` +
        `      document.addEventListener('mousemove', onMouseMove);\n` +
        `    } else {\n` +
        `      document.removeEventListener('mousemove', onMouseMove);\n` +
        `    }\n` +
        `  });\n` +
        `\n` +
        `【完整代码示例：状态机】\n` +
        `  let isLocked = false;\n` +
        `  document.addEventListener('pointerlockchange', () => {\n` +
        `    isLocked = !!document.pointerLockElement;\n` +
        `    updateUI(isLocked);\n` +
        `  });\n` +
        `  document.addEventListener('pointerlockerror', () => {\n` +
        `    showToast('锁定失败，请重试');\n` +
        `  });\n` +
        `\n` +
        `【陷阱】\n` +
        `  ✗ 事件注册在 document，不是 element（常见误用）\n` +
        `  ✗ pointerlockchange 触发时 pointerLockElement 已是新值\n` +
        `  ✗ pointerlockerror 无错误详情（仅通知失败，不区分原因）`;
    } catch (err: any) {
      const e = err as Error;
      return `读取 pointerlock 事件信息失败：${e.name} - ${e.message}`;
    }
  }

  _runEventsDemo(): void {
    const f = this._flags();
    this.setState({ eventsInfo: this._readEventsInfo() });
    this._addLog('info', `事件监听已注册：pointerlockchange=${f.lockChangeEvent}, pointerLockElement=${f.pointerLockElement}（document 级监听在 componentDidMount 已注册）`);
  }

  _renderCard4(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. pointerlockchange 与 pointerlockerror 事件',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['pointerlockchange', f.lockChangeEvent], ['pointerLockElement', f.pointerLockElement]]),
        h(Tag, { color: 'primary' }, 'document 级事件'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'pointerlockchange 与 pointerlockerror 事件均注册在 document 上（非 element）。pointerlockchange 在锁定/解锁时均触发，通过 document.pointerLockElement 判断当前状态（null 或元素引用）。pointerlockerror 在锁定失败时触发，无错误详情。推荐模式：在 pointerlockchange 锁定时注册 mousemove，解锁时移除，避免非锁定期间收到无效 movementX/Y。pointerlockchange 触发时 pointerLockElement 已是新值。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行演示', { type: 'primary', size: 'sm', onClick: () => this._runEventsDemo() }),
        ),
        h('div', { class: 'pl-stage' },
          h('div', { class: 'fs-sm text-secondary' }, 'document 级监听已在 componentDidMount 注册（真实浏览器锁定/解锁将更新下方状态）：'),
          h('div', { class: 'mt-sm' }, h('span', { class: 'pl-lock-state pl-lock-state-live' }, '当前锁定状态：' + (this._locked ? '已锁定' : '未锁定'))),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.eventsInfo || '（点击「运行演示」查看 pointerlock 事件完整说明）')),
        h(Alert, {
          type: 'info',
          message: '事件注册在 document 上，pointerlockchange 触发时 pointerLockElement 已是新值',
          description: 'pointerlockchange/error 均为 document 级事件（非 element）。推荐：pointerlockchange 锁定时注册 mousemove，解锁时移除，避免无效 movementX/Y。pointerlockerror 无错误详情，仅通知失败。pointerLockElement 在事件触发时已是新值（null 或元素）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 5：movementX/movementY ===================

  _readMovementInfo(): string {
    const f = this._flags();
    try {
      const samples = this._movementSamples;
      const sampleStr = samples.length === 0
        ? '（暂无采样，真实浏览器锁定后在下方区域移动鼠标将记录 movementX/Y）'
        : samples.map((s: any, i: number) => '  [' + i + '] movementX=' + s.x + ' movementY=' + s.y + ' clientX=' + s.cx + ' clientY=' + s.cy).join('\n');
      return `===== movementX / movementY 相对位移 =====\n` +
        `\n` +
        `【属性定义】\n` +
        `  MouseEvent.movementX / MouseEvent.movementY\n` +
        `  鼠标相对上次 mousemove 事件的位移（像素）\n` +
        `  PointerEvent.prototype 含 movementX = ${f.movement}\n` +
        `\n` +
        `【锁定前 vs 锁定后】\n` +
        `  锁定前：movementX/Y = 当前 clientX/Y - 上次 clientX/Y\n` +
        `    鼠标到达视口边界后 movementX/Y 归零（无法继续移动）\n` +
        `  锁定后：movementX/Y 持续更新，clientX/Y 锁定不变\n` +
        `    鼠标可无限移动（无边界限制），movementX/Y 可任意累积\n` +
        `\n` +
        `【与 clientX/clientY 区别】\n` +
        `  clientX/clientY：相对视口的绝对坐标（锁定后不变）\n` +
        `  movementX/Y：相对上次事件的位移增量（锁定后持续更新）\n` +
        `  3D 相机控制只用 movementX/Y（绝对坐标无意义）\n` +
        `\n` +
        `【高频更新】\n` +
        `  mousemove 是高频事件（鼠标移动每秒可触发数十至上百次）\n` +
        `  movementX/Y 在锁定期间持续累积，适合连续旋转/拖拽\n` +
        `  建议节流/批量处理（如 requestAnimationFrame 合并）\n` +
        `\n` +
        `【当前采样（最近 8 条）】\n` +
        `${sampleStr}\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  document.addEventListener('pointerlockchange', () => {\n` +
        `    if (document.pointerLockElement === stage) {\n` +
        `      document.addEventListener('mousemove', onMove);\n` +
        `    } else {\n` +
        `      document.removeEventListener('mousemove', onMove);\n` +
        `    }\n` +
        `  });\n` +
        `\n` +
        `  function onMove(e) {\n` +
        `    // 锁定后 clientX/Y 不变，用 movementX/Y\n` +
        `    console.log('dx=' + e.movementX, 'dy=' + e.movementY);\n` +
        `    yaw += e.movementX * sensitivity;\n` +
        `    pitch += e.movementY * sensitivity;\n` +
        `  }\n` +
        `\n` +
        `【陷阱】\n` +
        `  ✗ 非锁定时 movementX/Y 受视口边界限制（到边归零）\n` +
        `  ✗ 高频事件需节流，否则性能问题\n` +
        `  ✗ 部分浏览器 movementX/Y 在非 PointerEvent 上也可用（MouseEvent）`;
    } catch (err: any) {
      const e = err as Error;
      return `读取 movementX/Y 信息失败：${e.name} - ${e.message}`;
    }
  }

  _setupMovementListener(): void {
    const f = this._flags();
    const area = (this.el as any as Element | null)?.querySelector('.pl-move-area');
    if(!area) {
      this._addLog('warn', 'movement 监听：未找到 .pl-move-area 元素');
      return;
    }
    // 移除旧监听
    for(const [t, type, fn] of this._moveListeners) {
      try { t.removeEventListener(type, fn); } catch { /* noop */ }
    }
    this._moveListeners = [];
    const onMove = (e: Event): void => {
      const me = e as MouseEvent;
      const x = me.movementX || 0;
      const y = me.movementY || 0;
      this._movementSamples.push({ x, y, cx: me.clientX, cy: me.clientY });
      if (this._movementSamples.length > 8) this._movementSamples.shift();
      const out = (this.el as any as Element | null)?.querySelector('.pl-move-output');
      if(out) {
        const last = this._movementSamples[this._movementSamples.length - 1];
        out.textContent = '最近一次 mousemove：movementX=' + last.x + ' movementY=' + last.y + ' clientX=' + last.cx + ' clientY=' + last.cy + '\n（锁定后 clientX/Y 不变，movementX/Y 持续更新）';
      }
    };
    try {
      area.addEventListener('mousemove', onMove);
      this._moveListeners.push([area, 'mousemove', onMove]);
      this._addLog('info', 'mousemove 监听已绑定到 .pl-move-area（移动鼠标查看 movementX/Y）');
    } catch (err: any) {
      const e = err as Error;
      this._addLog('warn', `mousemove 监听绑定失败：${e.name} - ${e.message}`);
    }
  }

  _runMovementDemo(): void {
    const f = this._flags();
    this.setState({ movementInfo: this._readMovementInfo() });
    this._setupMovementListener();
    if (!f.movement) this._addLog('warn', 'movementX/Y 不可用（jsdom 不实现 PointerEvent.movementX），真实浏览器可观察');
  }

  _renderCard5(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. movementX / movementY —— 锁定后相对位移',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['movementX/Y', f.movement]]),
        h(Tag, { color: 'primary' }, '高频更新'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'MouseEvent.movementX/movementY 是相对上次 mousemove 事件的位移增量。锁定前受视口边界限制（到边归零），锁定后持续更新无边界限制，clientX/clientY 锁定不变。3D 相机控制只用 movementX/Y（绝对坐标无意义）。高频事件（每秒数十至上百次），建议 requestAnimationFrame 合并。推荐模式：pointerlockchange 锁定时注册 mousemove，解锁时移除。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行演示', { type: 'primary', size: 'sm', onClick: () => this._runMovementDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '在下方区域移动鼠标查看 movementX/Y（真实浏览器锁定后无边界）：'),
        h('div', { class: 'pl-move-area' },
          '移动鼠标到此区域\nmovementX/Y 将实时记录\n（jsdom 不触发 mousemove，真实浏览器可观察）',
        ),
        h('div', { class: 'pl-output pl-move-output' }, '等待 mousemove 事件...'),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.movementInfo || '（点击「运行演示」查看 movementX/Y 完整说明与采样）')),
        h(Alert, {
          type: 'info',
          message: '锁定后 clientX/Y 不变，movementX/Y 持续更新无边界',
          description: 'movementX/Y 是相对位移增量。锁定前受视口边界限制（到边归零），锁定后无边界可无限累积。3D 相机控制只用 movementX/Y。高频事件需 requestAnimationFrame 节流。pointerlockchange 锁定时注册 mousemove，解锁时移除，避免无效事件。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 6：实战 - 第一人称 3D 相机控制 ===================

  _readFpsInfo(): string {
    const f = this._flags();
    try {
      return `===== 实战：第一人称 3D 相机控制 =====\n` +
        `\n` +
        `【场景】\n` +
        `  FPS 游戏第一人称视角：鼠标移动 → 相机旋转（yaw/pitch）\n` +
        `  鼠标向右移 → 视角向右转（yaw 增大）\n` +
        `  鼠标向下移 → 视角向下看（pitch 增大，反转 Y 轴）\n` +
        `\n` +
        `【pitch / yaw 计算】\n` +
        `  yaw   += e.movementX * sensitivity   // 偏航（左右转）\n` +
        `  pitch -= e.movementY * sensitivity   // 俯仰（上下看，反转 Y）\n` +
        `  pitch = clamp(pitch, -Math.PI/2, Math.PI/2)  // 防止翻转\n` +
        `  sensitivity 通常 0.002 ~ 0.005\n` +
        `\n` +
        `【与 WebGL/WebGPU 协同】\n` +
        `  相机矩阵 = perspective * view * model\n` +
        `  view 矩阵由 yaw/pitch 计算（lookAt 或四元数）\n` +
        `  每帧 requestAnimationFrame 中更新 view 矩阵并渲染\n` +
        `\n` +
        `【当前相机状态】\n` +
        `  yaw   = ${(this._yaw as any).toFixed(3)} rad (${(this._yaw * 180 / Math.PI).toFixed(1)}°)\n` +
        `  pitch = ${(this._pitch as any).toFixed(3)} rad (${(this._pitch * 180 / Math.PI).toFixed(1)}°)\n` +
        `  movementX/Y 可用 = ${f.movement}\n` +
        `\n` +
        `【完整代码示例：WebGL 第一人称相机】\n` +
        `  const canvas = document.querySelector('canvas');\n` +
        `  let yaw = 0, pitch = 0;\n` +
        `  const sensitivity = 0.003;\n` +
        `\n` +
        `  canvas.addEventListener('click', () => {\n` +
        `    canvas.requestPointerLock();\n` +
        `  });\n` +
        `\n` +
        `  document.addEventListener('pointerlockchange', () => {\n` +
        `    if (document.pointerLockElement === canvas) {\n` +
        `      document.addEventListener('mousemove', onMouseMove);\n` +
        `    } else {\n` +
        `      document.removeEventListener('mousemove', onMouseMove);\n` +
        `    }\n` +
        `  });\n` +
        `\n` +
        `  function onMouseMove(e) {\n` +
        `    yaw += e.movementX * sensitivity;\n` +
        `    pitch -= e.movementY * sensitivity;  // 反转 Y 轴\n` +
        `    pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));\n` +
        `  }\n` +
        `\n` +
        `  // 渲染循环\n` +
        `  function render() {\n` +
        `    // 用 yaw/pitch 计算 view 矩阵（四元数或 lookAt）\n` +
        `    const view = mat4.fromYawPitch(yaw, pitch);\n` +
        `    gl.uniformMatrix4fv(viewLoc, false, view);\n` +
        `    gl.drawArrays(gl.TRIANGLES, 0, count);\n` +
        `    requestAnimationFrame(render);\n` +
        `  }\n` +
        `  render();\n` +
        `\n` +
        `【反转 Y 轴原理】\n` +
        `  屏幕坐标 Y 向下增大，但相机俯仰"向下看"应为 pitch 减小\n` +
        `  所以 pitch -= movementY（反转），符合直觉\n` +
        `  部分游戏提供"反转 Y 轴"选项（飞行模拟器默认反转）\n` +
        `\n` +
        `【陷阱】\n` +
        `  ✗ 不 clamp pitch 会导致视角翻转（万向锁）\n` +
        `  ✗ sensitivity 过大相机抖动，过小响应迟钝\n` +
        `  ✗ requestAnimationFrame 内更新矩阵，不要在 mousemove 内直接渲染`;
    } catch (err: any) {
      const e = err as Error;
      return `读取 3D 相机控制信息失败：${e.name} - ${e.message}`;
    }
  }

  _setupFpsCamera(): void {
    const f = this._flags();
    const viewport = (this.el as any as Element | null)?.querySelector('.pl-viewport');
    if(!viewport) {
      this._addLog('warn', '3D 相机：未找到 .pl-viewport 元素');
      return;
    }
    // 移除旧 mousemove
    for(const [t, type, fn] of this._moveListeners) {
      try { t.removeEventListener(type, fn); } catch { /* noop */ }
    }
    this._moveListeners = [];
    const onMove = (e: Event): void => {
      const me = e as MouseEvent;
      const sensitivity = 0.005;
      this._yaw += (me.movementX || 0) * sensitivity;
      this._pitch -= (me.movementY || 0) * sensitivity;
      const half = Math.PI / 2 - 0.01;
      this._pitch = Math.max(-half, Math.min(half, this._pitch));
      this._updateFpsView();
    };
    try {
      viewport.addEventListener('mousemove', onMove);
      this._moveListeners.push([viewport, 'mousemove', onMove]);
    } catch (err: any) {
      const e = err as Error;
      this._addLog('warn', `3D 相机 mousemove 绑定失败：${e.name} - ${e.message}`);
    }
    // 点击请求锁定
    viewport.addEventListener('click', () => this._tryRequestLock(viewport));
    this._updateFpsView();
  }

  _updateFpsView(): void {
    const hud = (this.el as any as Element | null)?.querySelector('.pl-viewport .pl-hud');
    if(hud) {
      hud.textContent = 'yaw=' + (this._yaw as any).toFixed(2) + ' (' + (this._yaw * 180 / Math.PI).toFixed(0) + '°)  pitch=' + (this._pitch as any).toFixed(2) + ' (' + (this._pitch * 180 / Math.PI).toFixed(0) + '°)';
    }
    const cube = (this.el as any as Element | null)?.querySelector('.pl-viewport .pl-cube') as HTMLElement | null;
    if(cube) {
      // 简单视觉：用 yaw 横向偏移，pitch 纵向偏移
      const x = 50 + (Math.sin(this._yaw) * 40);
      const y = 50 + (this._pitch * 30);
      cube.style.left = x + '%';
      cube.style.top = y + '%';
      cube.style.transform = 'translate(-50%, -50%)';
    }
  }

  _runFpsDemo(): void {
    const f = this._flags();
    this.setState({ fpsInfo: this._readFpsInfo() });
    this._setupFpsCamera();
    this._addLog('info', `3D 相机演示已启动：yaw=${(this._yaw as any).toFixed(2)}, pitch=${(this._pitch as any).toFixed(2)}（点击视口请求锁定，移动鼠标旋转视角）`);
    if (!f.movement) this._addLog('warn', 'movementX/Y 不可用（jsdom 不实现），相机视角不会更新；真实浏览器可观察');
  }

  _renderCard6(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. 实战：第一人称 3D 相机控制',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['requestPointerLock', f.requestPointerLock], ['movementX/Y', f.movement]]),
        h(Tag, { color: 'primary' }, 'WebGL/WebGPU 协同'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'FPS 游戏第一人称视角：requestPointerLock + mousemove movementX/Y → 旋转相机。yaw += movementX * sensitivity（偏航左右转），pitch -= movementY * sensitivity（俯仰，反转 Y 轴符合直觉），pitch 需 clamp 到 [-π/2, π/2] 防翻转。与 WebGL/WebGPU 协同：每帧 requestAnimationFrame 用 yaw/pitch 计算 view 矩阵并渲染。sensitivity 通常 0.002~0.005。反转 Y 轴原理：屏幕 Y 向下增大，但向下看 pitch 应减小。陷阱：不 clamp pitch 导致万向锁、sensitivity 过大抖动、不要在 mousemove 内直接渲染。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行演示', { type: 'primary', size: 'sm', onClick: () => this._runFpsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '点击视口请求锁定，移动鼠标旋转视角（yaw/pitch 实时更新）：'),
        h('div', { class: 'pl-viewport' },
          h('div', { class: 'pl-hud' }, 'yaw=0.00 (0°)  pitch=0.00 (0°)'),
          h('div', { class: 'pl-cube' }, '◆'),
          h('div', { class: 'pl-crosshair' }, '+'),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.fpsInfo || '（点击「运行演示」查看 3D 相机控制完整代码）')),
        h(Alert, {
          type: 'info',
          message: 'pitch 需 clamp 防翻转，requestAnimationFrame 内更新矩阵而非 mousemove 内',
          description: 'yaw += movementX * sensitivity，pitch -= movementY * sensitivity（反转 Y 轴）。pitch clamp 到 [-π/2, π/2] 防万向锁。sensitivity 0.002~0.005。渲染在 requestAnimationFrame 内更新 view 矩阵，不在 mousemove 内直接渲染（避免高频重绘）。与 WebGL/WebGPU view 矩阵协同。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 7：实战 - 全景图/360° 图片浏览 ===================

  _readPanoramaInfo(): string {
    const f = this._flags();
    try {
      return `===== 实战：全景图 / 360° 图片浏览 =====\n` +
        `\n` +
        `【场景】\n` +
        `  全景图浏览：鼠标拖拽 → 水平/垂直滚动全景图\n` +
        `  360° 图片：指针锁定后移动鼠标 → 持续浏览（无需拖拽）\n` +
        `  全屏 + 指针锁定 = 沉浸式全景体验\n` +
        `\n` +
        `【实现模式：拖拽 vs 指针锁定】\n` +
        `  拖拽模式：mousedown 锁定 + mousemove 滚动 + mouseup 解锁\n` +
        `    适合偶尔浏览，用户主动控制\n` +
        `  指针锁定模式：click 锁定 + mousemove 持续滚动 + Esc 解锁\n` +
        `    适合沉浸式浏览，鼠标可无限移动\n` +
        `\n` +
        `【当前全景偏移】\n` +
        `  angle = ${(this._panoAngle as any).toFixed(1)}°\n` +
        `  requestPointerLock 可用 = ${f.requestPointerLock}\n` +
        `\n` +
        `【完整代码示例：360° 图片浏览】\n` +
        `  const pano = document.querySelector('.panorama');\n` +
        `  let offset = 0;\n` +
        `\n` +
        `  pano.addEventListener('click', () => {\n` +
        `    if (document.pointerLockElement === pano) {\n` +
        `      document.exitPointerLock();\n` +
        `    } else {\n` +
        `      pano.requestPointerLock();\n` +
        `    }\n` +
        `  });\n` +
        `\n` +
        `  document.addEventListener('pointerlockchange', () => {\n` +
        `    if (document.pointerLockElement === pano) {\n` +
        `      document.addEventListener('mousemove', onMove);\n` +
        `    } else {\n` +
        `      document.removeEventListener('mousemove', onMove);\n` +
        `    }\n` +
        `  });\n` +
        `\n` +
        `  function onMove(e) {\n` +
        `    offset += e.movementX * 0.3;  // 水平滚动\n` +
        `    offset = offset % 360;        // 循环\n` +
        `    pano.style.backgroundPositionX = offset + 'px';\n` +
        `  }\n` +
        `\n` +
        `【与 DeviceOrientation API 移动端对比】\n` +
        `  桌面端：Pointer Lock + mousemove movementX/Y\n` +
        `  移动端：DeviceOrientation API（deviceorientation 事件 gamma/beta）\n` +
        `    移动端无鼠标，通过设备朝向控制视角\n` +
        `  iOS Safari 不支持 Pointer Lock，移动端必须用 DeviceOrientation\n` +
        `\n` +
        `【虚拟现实场景】\n` +
        `  WebXR API（VR/AR）：pointerlock 不适用，WebXR 有独立输入系统\n` +
        `  但 WebXR 之前的简易 VR（Cardboard 风格）可用 Pointer Lock\n` +
        `  全景图 + Pointer Lock 是 WebXR 之前的常用方案\n` +
        `\n` +
        `【陷阱】\n` +
        `  ✗ 全景图需循环（offset % 360 或 background-repeat: repeat-x）\n` +
        `  ✗ 移动端 iOS Safari 不支持 Pointer Lock，需 DeviceOrientation 降级\n` +
        `  ✗ 全屏 + 锁定顺序：先 requestFullscreen 再 requestPointerLock\n` +
        `  ✗ 用户按 Esc 退出锁定后需提供 UI 重新进入`;
    } catch (err: any) {
      const e = err as Error;
      return `读取全景图浏览信息失败：${e.name} - ${e.message}`;
    }
  }

  _setupPanorama(): void {
    const f = this._flags();
    const pano = (this.el as any as Element | null)?.querySelector('.pl-panorama');
    if(!pano) {
      this._addLog('warn', '全景图：未找到 .pl-panorama 元素');
      return;
    }
    // 移除旧 mousemove（注意区分 fps 的监听）
    const existing = this._moveListeners.filter(([t]: any) => t === pano);
    for(const [t, type, fn] of existing) {
      try { t.removeEventListener(type, fn); } catch { /* noop */ }
    }
    this._moveListeners = this._moveListeners.filter(([t]: any) => t !== pano);
    const onMove = (e: Event): void => {
      const me = e as MouseEvent;
      this._panoAngle += (me.movementX || 0) * 0.3;
      this._panoAngle = this._panoAngle % 360;
      this._updatePanoramaView();
    };
    try {
      pano.addEventListener('mousemove', onMove);
      this._moveListeners.push([pano, 'mousemove', onMove]);
    } catch (err: any) {
      const e = err as Error;
      this._addLog('warn', `全景图 mousemove 绑定失败：${e.name} - ${e.message}`);
    }
    pano.addEventListener('click', () => {
      pano.classList.toggle('pl-grabbing');
      this._tryRequestLock(pano);
    });
    this._updatePanoramaView();
  }

  _updatePanoramaView(): void {
    const marker = (this.el as any as Element | null)?.querySelector('.pl-pano-marker') as HTMLElement | null;
    const hud = (this.el as any as Element | null)?.querySelector('.pl-pano-hud');
    if(marker) {
      // 0-360° 映射到 0-100% 宽度
      const pos = ((this._panoAngle % 360) + 360) % 360 / 360 * 100;
      marker.style.left = pos + '%';
    }
    if(hud) {
      hud.textContent = '偏移角度：' + (this._panoAngle as any).toFixed(1) + '°';
    }
  }

  _runPanoramaDemo(): void {
    const f = this._flags();
    this.setState({ panoramaInfo: this._readPanoramaInfo() });
    this._setupPanorama();
    this._addLog('info', `全景图演示已启动：angle=${(this._panoAngle as any).toFixed(1)}°（点击全景图请求锁定，移动鼠标浏览）`);
    if (!f.movement) this._addLog('warn', 'movementX/Y 不可用（jsdom 不实现），全景图不会滚动；真实浏览器可观察');
  }

  _renderCard7(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. 实战：全景图 / 360° 图片浏览',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['requestPointerLock', f.requestPointerLock], ['Fullscreen', f.fullscreen]]),
        h(Tag, { color: 'primary' }, '全屏 + 锁定'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '全景图/360° 图片浏览：拖拽锁定浏览全景，全屏 + 指针锁定 = 沉浸式体验。实现模式：拖拽（mousedown 锁定 + mousemove 滚动 + mouseup 解锁）适合偶尔浏览；指针锁定（click 锁定 + mousemove 持续滚动 + Esc 解锁）适合沉浸式浏览。与 DeviceOrientation API 移动端对比：桌面端用 Pointer Lock + mousemove，移动端用 DeviceOrientation（gamma/beta），iOS Safari 不支持 Pointer Lock 必须降级。虚拟现实场景：WebXR API 有独立输入系统，但 WebXR 之前的简易 VR（Cardboard 风格）可用 Pointer Lock。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行演示', { type: 'primary', size: 'sm', onClick: () => this._runPanoramaDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '点击全景图请求锁定，移动鼠标浏览（水平偏移实时更新）：'),
        h('div', { class: 'pl-panorama' },
          h('div', { class: 'pl-pano-marker' }, '▼'),
          h('div', { class: 'pl-pano-hud' }, '偏移角度：0.0°'),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.panoramaInfo || '（点击「运行演示」查看全景图浏览完整代码）')),
        h(Alert, {
          type: 'info',
          message: '移动端 iOS Safari 不支持 Pointer Lock，需 DeviceOrientation API 降级',
          description: '桌面端用 Pointer Lock + mousemove movementX/Y，移动端用 DeviceOrientation（deviceorientation 事件 gamma/beta 角度）。全景图需循环（offset % 360 或 background-repeat: repeat-x）。全屏 + 锁定顺序：先 requestFullscreen 再 requestPointerLock。WebXR API 有独立输入系统，简易 VR（Cardboard 风格）可用 Pointer Lock。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 8：陷阱与最佳实践 ===================

  _readPitfallsInfo(): string {
    const f = this._flags();
    try {
      return `===== Pointer Lock 陷阱与最佳实践 =====\n` +
        `\n` +
        `【陷阱 1：必须用户手势触发】\n` +
        `  requestPointerLock 必须在用户手势（click/keydown）事件循环内调用\n` +
        `  非用户手势（setTimeout/setInterval/Promise.then 内）调用会被拒绝\n` +
        `  触发 pointerlockerror 事件\n` +
        `  解决：在 click 事件回调内调用\n` +
        `  代码：\n` +
        `    btn.addEventListener('click', () => {\n` +
        `      el.requestPointerLock();  // ✓ 用户手势内\n` +
        `    });\n` +
        `    setTimeout(() => el.requestPointerLock(), 100);  // ✗ 被拒绝\n` +
        `\n` +
        `【陷阱 2：Esc 键系统强制解锁 + 短期锁定期】\n` +
        `  用户按 Esc 浏览器系统强制解锁，无法阻止\n` +
        `  Esc 解锁后进入约 1 秒"短期锁定期"\n` +
        `  期间 requestPointerLock 被静默拒绝（pointerlockerror）\n` +
        `  防钓鱼设计：防止恶意页面连续锁定\n` +
        `  解决：监听 pointerlockchange，解锁后禁用按钮 1 秒\n` +
        `\n` +
        `【陷阱 3：标签页失焦自动解锁】\n` +
        `  切换标签页/最小化/Alt+Tab 切换应用 → 自动解锁\n` +
        `  blur 事件触发，pointerLockElement 变 null\n` +
        `  解决：监听 pointerlockchange，重新聚焦后提示用户重新锁定\n` +
        `\n` +
        `【陷阱 4：与 Fullscreen API 协同】\n` +
        `  全屏 + 锁定顺序：先 requestFullscreen 再 requestPointerLock\n` +
        `  requestFullscreen 也需用户手势，且返回 Promise\n` +
        `  代码：\n` +
        `    btn.addEventListener('click', async () => {\n` +
        `      await el.requestFullscreen();       // 先全屏\n` +
        `      el.requestPointerLock();            // 再锁定\n` +
        `    });\n` +
        `  注意：全屏退出时也会自动解锁\n` +
        `\n` +
        `【陷阱 5：无障碍（键盘等价）】\n` +
        `  Pointer Lock 是鼠标专属，键盘用户无法操作\n` +
        `  WCAG 要求提供键盘等价\n` +
        `  解决：方向键控制视角（ArrowLeft/Right 控制 yaw，ArrowUp/Down 控制 pitch）\n` +
        `  代码：\n` +
        `    document.addEventListener($1, (e: any) => {\n` +
        `      const step = 0.05;\n` +
        `      if (e.key === 'ArrowLeft')  yaw -= step;\n` +
        `      if (e.key === 'ArrowRight') yaw += step;\n` +
        `      if (e.key === 'ArrowUp')    pitch += step;\n` +
        `      if (e.key === 'ArrowDown')  pitch -= step;\n` +
        `    });\n` +
        `\n` +
        `【陷阱 6：iOS Safari 不支持】\n` +
        `  iOS Safari 完全不支持 Pointer Lock API\n` +
        `  移动端无鼠标概念，用 DeviceOrientation API 替代\n` +
        `  检测：if (!('requestPointerLock' in Element.prototype)) → 降级\n` +
        `  降级：拖拽 + touch 事件 或 DeviceOrientation\n` +
        `\n` +
        `【陷阱 7：安全考虑（防钓鱼）】\n` +
        `  恶意页面可能用 Pointer Lock 钓鱼（锁定后伪造 UI）\n` +
        `  浏览器防护：\n` +
        `    - 必须用户手势触发（防自动锁定）\n` +
        `    - Esc 键强制解锁（用户始终可逃逸）\n` +
        `    - 短期锁定期（Esc 后 1 秒内拒绝）\n` +
        `    - 失焦自动解锁（切换标签页逃逸）\n` +
        `  开发者：锁定前明确告知用户（如"点击进入沉浸模式，按 Esc 退出"）\n` +
        `\n` +
        `【最佳实践清单】\n` +
        `  ✓ 必须用户手势（click）内调用 requestPointerLock\n` +
        `  ✓ 监听 pointerlockchange + pointerlockerror 处理状态\n` +
        `  ✓ Esc 解锁后禁用按钮 1 秒（短期锁定期）\n` +
        `  ✓ 全屏 + 锁定：先 requestFullscreen 再 requestPointerLock\n` +
        `  ✓ 提供键盘等价（方向键控制视角）满足无障碍\n` +
        `  ✓ iOS Safari 降级到 DeviceOrientation / 拖拽 + touch\n` +
        `  ✓ mousemove 在 pointerlockchange 锁定时注册，解锁时移除\n` +
        `  ✓ pitch clamp 防翻转（[-π/2, π/2]）\n` +
        `  ✓ 渲染在 requestAnimationFrame 内，不在 mousemove 内\n` +
        `  ✓ 锁定前告知用户（"按 Esc 退出"）防钓鱼\n` +
        `\n` +
        `  requestPointerLock 可用 = ${f.requestPointerLock}\n` +
        `  SecureContext = ${f.secureContext}`;
    } catch (err: any) {
      const e = err as Error;
      return `读取陷阱与最佳实践信息失败：${e.name} - ${e.message}`;
    }
  }

  _runPitfallsDemo(): void {
    this.setState({ pitfallsInfo: this._readPitfallsInfo() });
    this._addLog('info', `陷阱与最佳实践演示完成；requestPointerLock=${this._flags().requestPointerLock}, secureContext=${this._flags().secureContext}`);
  }

  _renderCard8(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 陷阱与最佳实践 —— 用户手势/Esc/失焦/全屏/无障碍/iOS/安全',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['requestPointerLock', f.requestPointerLock], ['SecureContext', f.secureContext]]),
        h(Tag, { color: 'warning' }, '7 大陷阱'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '七大陷阱：必须用户手势触发（非手势调用被拒，触发 pointerlockerror）；Esc 键系统强制解锁 + 约 1 秒短期锁定期（防钓鱼）；标签页失焦自动解锁（切换/最小化）；与 Fullscreen API 协同（先全屏再锁定）；无障碍键盘等价（方向键控制 yaw/pitch）；iOS Safari 不支持（降级 DeviceOrientation/拖拽+touch）；安全考虑（钓鱼防护：用户手势/Esc 逃逸/短期锁定期/失焦解锁）。最佳实践清单 10 条覆盖用户手势、事件监听、Esc 锁定期、全屏顺序、键盘等价、iOS 降级、mousemove 生命周期、pitch clamp、渲染时机、防钓鱼告知。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行演示', { type: 'primary', size: 'sm', onClick: () => this._runPitfallsDemo() }),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.pitfallsInfo || '（点击「运行演示」查看 7 大陷阱与 10 条最佳实践完整说明）')),
        h(Alert, {
          type: 'warning',
          message: '必须用户手势触发；Esc 解锁后 1 秒短期锁定期；iOS Safari 不支持',
          description: '陷阱清单：用户手势触发（非手势被拒）；Esc 强制解锁 + 短期锁定期（防钓鱼）；失焦自动解锁；全屏先于锁定；键盘等价（方向键）；iOS Safari 降级 DeviceOrientation；安全钓鱼防护。最佳实践：click 内调用、监听事件、Esc 禁用 1 秒、全屏顺序、键盘等价、iOS 降级、mousemove 生命周期、pitch clamp、rAF 渲染、锁定前告知用户。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== 日志面板（按时间倒序）===================

  _renderLogPanel(): Node | null {
    const s = this.state;
    if (!s.logs || s.logs.length === 0) return null;
    const reversed = [...s.logs].reverse();
    return h(Card, { title: '运行日志（按时间倒序）' },
      h('div', { class: 'log-list' },
        ...reversed.map((log: any) =>
          h('div', { class: `log-item log-${log.type}` },
            h('span', { class: 'log-time' }, log.time),
            h('span', { class: 'log-content' }, log.content),
          ),
        ),
      ),
    );
  }

  // =================== 渲染入口 ===================

  render(): Node {
    const s = this.state;
    return h('div', { class: 'api-lab-page pointer-lock-api-page' },
      h('h2', { class: 'section-title' }, 'Pointer Lock API 鼠标锁定完整实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页演示 Pointer Lock API（前 Mouse Lock API，W3C 规范）全套能力：概述与动机、requestPointerLock 基础（用户手势/Promise/安全上下文）、document.exitPointerLock、pointerlockchange/error 事件、movementX/Y 相对位移、第一人称 3D 相机控制实战、全景图/360° 浏览实战、陷阱与最佳实践。所有特性通过 typeof / in 能力检测，不可用时仅记日志，绝不抛异常。jsdom 不实现 Pointer Lock，真实浏览器（Chrome 22+/Firefox 14+/Safari 10.1+）全支持。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null as any,

      h('div', { class: 'feature-grid' },
        this._renderCard1(),
        this._renderCard2(),
        this._renderCard3(),
        this._renderCard4(),
        this._renderCard5(),
        this._renderCard6(),
        this._renderCard7(),
        this._renderCard8(),
      ),

      this._renderLogPanel(),
    );
  }
}
