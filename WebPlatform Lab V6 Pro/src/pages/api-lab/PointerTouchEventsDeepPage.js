// =====================================================================
// PointerTouchEventsDeepPage.js —— Pointer & Touch Events 指针与触摸事件深度实验室
// 演示 W3C Pointer Events Level 2 + Touch Events API + 手势识别：
//   1. Pointer Events 概述与跨设备统一
//      pointerdown/move/up/cancel/over/out/enter/leave 统一鼠标/触摸/触控笔
//      pointerType: mouse|touch|pen 区分输入设备
//      一套代码兼容桌面（鼠标）+ 移动（触摸）+ 创意（触控笔）
//   2. PointerEvent 属性全集
//      pointerId/pointerType/width/height/pressure/tangentialPressure
//      tiltX/tiltY/twist/isPrimary/getCoalescedEvents/getPredictedEvents
//   3. setPointerCapture 与指针捕获
//      element.setPointerCapture(pointerId) 拖拽到元素外仍持续接收事件
//      releasePointerCapture/hasPointerCapture/gotpointercapture/lostpointercapture
//   4. Touch Events API（传统触摸）
//      touchstart/move/end/cancel + touches/targetTouches/changedTouches
//      Touch 对象 identifier/clientX/pageX/radiusX/rotationAngle/force
//   5. touch-action CSS 属性
//      auto/none/pan-x/pan-y/pin-zoom/manipulation 控制默认手势
//   6. 多点触控与手势识别
//      pinch 缩放/rotate 旋转/swipe 滑动/long press/double tap/drag
//      用 Map 缓存 pointerId → 状态，手势状态机设计
//   7. 触控笔与压感应用
//      pressure 映射画笔粗细/透明度，tiltX/tiltY 笔锋，twist 旋转
//      getCoalescedEvents() 高频采样点 + 贝塞尔曲线平滑
//   8. 实战模式与陷阱
//      拖拽/滑块/画板完整代码 + 降级方案 + 无障碍 + 陷阱清单
// 说明：jsdom 不模拟真实指针输入，但可检测 API 支持 + 注入演示样式
//       + 附加事件监听器；真实浏览器可查看交互效果。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class PointerTouchEventsDeepPage extends Page {
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      overviewInfo: '',    // Card 1：Pointer Events 概述与跨设备统一
      propsInfo: '',       // Card 2：PointerEvent 属性全集
      captureInfo: '',     // Card 3：setPointerCapture 与指针捕获
      touchApiInfo: '',    // Card 4：Touch Events API
      touchActionInfo: '', // Card 5：touch-action CSS 属性
      gestureInfo: '',     // Card 6：多点触控与手势识别
      penInfo: '',         // Card 7：触控笔与压感应用
      patternInfo: '',     // Card 8：实战模式与陷阱
    };
  }

  componentDidMount() {
    if (this._inited) return;
    this._inited = true;

    this._dynamicStyles = [];

    const f = this._flags();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `PointerEvent ${c(f.pointerEvent)}`,
      `TouchEvent ${c(f.touchEvent)}`,
      `ontouchstart ${c(f.ontouchstart)}`,
      `setPointerCapture ${c(f.setPointerCapture)}`,
      `touch-action:none ${c(f.touchAction)}`,
      `getCoalescedEvents ${c(f.getCoalescedEvents)}`,
      `hasPointerCapture ${c(f.hasPointerCapture)}`,
      `maxTouchPoints=${f.maxTouchPoints}`,
    ];

    const summary = f.pointerEvent || f.touchEvent
      ? `Pointer & Touch Events 能力检测：${parts.join(' · ')}。jsdom 不模拟真实指针输入，但可附加事件监听器 + 注入演示样式；真实浏览器（鼠标/触摸/触控笔）可查看完整交互效果。`
      : '当前环境不支持 PointerEvent 与 TouchEvent（typeof 均为 undefined）；所有按钮点击仅记日志说明，不会抛异常。';

    this.setState({ capsSummary: summary });
    this._addLog(f.pointerEvent ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.setPointerCapture) this._addLog('warn', 'setPointerCapture 不可用（拖拽到元素外会丢失事件）');
    if (!f.touchAction) this._addLog('warn', 'touch-action 不可用（无法禁用默认手势）');
    if (f.maxTouchPoints > 0) this._addLog('info', `设备支持触摸（maxTouchPoints=${f.maxTouchPoints}）`);

    this._injectBaseStyles();
  }

  componentWillUnmount() {
    for (const style of this._dynamicStyles) {
      try { style.parentNode && style.parentNode.removeChild(style); } catch { /* noop */ }
    }
    this._dynamicStyles = [];
  }

  // —— 辅助方法 ——

  _addLog(type, content) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  _caps(items) {
    return items.map(([label, ok]) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  _injectStyle(id, css) {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
    this._dynamicStyles.push(style);
  }

  _injectBaseStyles() {
    this._injectStyle('pt-base', `
      .pt-demo {
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
      }
      .pt-canvas {
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        display: block;
        margin-top: 8px;
        touch-action: none;
        cursor: crosshair;
      }
      .pt-slider {
        position: relative;
        width: 100%;
        max-width: 320px;
        height: 36px;
        margin-top: 10px;
        display: flex;
        align-items: center;
      }
      .pt-slider__track {
        position: relative;
        width: 100%;
        height: 6px;
        background: #e5e7eb;
        border-radius: 3px;
      }
      .pt-slider__fill {
        position: absolute;
        left: 0;
        top: 0;
        height: 100%;
        background: linear-gradient(90deg, #3b82f6, #8b5cf6);
        border-radius: 3px;
        width: 30%;
      }
      .pt-slider__thumb {
        position: absolute;
        top: 50%;
        left: 30%;
        width: 20px;
        height: 20px;
        background: #fff;
        border: 2px solid #3b82f6;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        cursor: grab;
        touch-action: none;
        box-shadow: 0 1px 4px rgba(0,0,0,0.2);
      }
      .pt-drag-host {
        position: relative;
        width: 100%;
        height: 140px;
        background: repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 10px, #e2e8f0 10px, #e2e8f0 20px);
        border: 1px dashed #94a3b8;
        border-radius: 8px;
        margin-top: 10px;
        overflow: hidden;
      }
      .pt-drag-box {
        position: absolute;
        top: 40px;
        left: 16px;
        width: 72px;
        height: 72px;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        border-radius: 10px;
        color: #fff;
        font-weight: 700;
        font-size: 12px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: grab;
        touch-action: none;
        user-select: none;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        will-change: transform;
      }
      .pt-gesture-viz {
        position: relative;
        width: 100%;
        height: 200px;
        background: #0f172a;
        border-radius: 8px;
        margin-top: 10px;
        overflow: hidden;
        touch-action: none;
        color: #e2e8f0;
        font-family: monospace;
        font-size: 11px;
      }
      .pt-gesture-viz__hint {
        position: absolute;
        top: 8px;
        left: 10px;
        color: #94a3b8;
        pointer-events: none;
      }
      .pt-status {
        margin-top: 8px;
        padding: 8px 10px;
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 4px;
        font-family: monospace;
        font-size: 11px;
        white-space: pre-wrap;
        word-break: break-all;
      }
      .pt-pen-readout {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 6px;
        margin-top: 8px;
      }
      .pt-pen-cell {
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 6px 8px;
        font-size: 11px;
        font-family: monospace;
      }
      .pt-output {
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 4px;
        padding: 8px;
        font-family: monospace;
        font-size: 11px;
        white-space: pre-wrap;
        word-break: break-all;
        margin-top: 8px;
      }
    `);
  }

  _flags() {
    const safe = (fn) => {
      try { return fn(); } catch { return false; }
    };
    return {
      pointerEvent: safe(() => typeof PointerEvent !== 'undefined'),
      touchEvent: safe(() => typeof TouchEvent !== 'undefined'),
      ontouchstart: safe(() => typeof window !== 'undefined' && 'ontouchstart' in window),
      setPointerCapture: safe(() => typeof Element !== 'undefined' && typeof Element.prototype.setPointerCapture === 'function'),
      hasPointerCapture: safe(() => typeof Element !== 'undefined' && typeof Element.prototype.hasPointerCapture === 'function'),
      releasePointerCapture: safe(() => typeof Element !== 'undefined' && typeof Element.prototype.releasePointerCapture === 'function'),
      getCoalescedEvents: safe(() => typeof PointerEvent !== 'undefined' && typeof PointerEvent.prototype.getCoalescedEvents === 'function'),
      getPredictedEvents: safe(() => typeof PointerEvent !== 'undefined' && typeof PointerEvent.prototype.getPredictedEvents === 'function'),
      touchAction: safe(() => typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('touch-action', 'none')),
      maxTouchPoints: safe(() => (typeof navigator !== 'undefined' && typeof navigator.maxTouchPoints === 'number') ? navigator.maxTouchPoints : 0) || 0,
    };
  }

  // ===================== Card 1：Pointer Events 概述与跨设备统一 =====================

  _runOverviewDemo() {
    const f = this._flags();
    this._injectStyle('pt-overview-demo', `
      .pt-ov-host {
        padding: 12px;
        background: linear-gradient(135deg, #dbeafe, #ede9fe);
        border-radius: 8px;
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }
      .pt-ov-pill {
        padding: 6px 12px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
        color: #fff;
        touch-action: none;
        cursor: pointer;
        user-select: none;
      }
      .pt-ov-mouse { background: #3b82f6; }
      .pt-ov-touch { background: #10b981; }
      .pt-ov-pen   { background: #f59e0b; }
    `);
    const info = [
      '===== Pointer Events 概述与跨设备统一 =====',
      '',
      '【W3C Pointer Events Level 2】',
      '  统一鼠标、触摸、触控笔三类输入设备为单一 API',
      '  规范：https://www.w3.org/TR/pointerevents3/（Level 2 / Level 3 草案）',
      '',
      '【8 个核心事件】',
      '  pointerdown      指针按下（对应 mousedown / touchstart）',
      '  pointermove      指针移动（对应 mousemove / touchmove）',
      '  pointerup        指针抬起（对应 mouseup / touchend）',
      '  pointercancel    指针被取消（系统打断如来电/手势冲突）',
      '  pointerover      指针进入元素（对应 mouseover）',
      '  pointerout       指针离开元素（对应 mouseout）',
      '  pointerenter     指针进入元素（不冒泡，对应 mouseenter）',
      '  pointerleave     指针离开元素（不冒泡，对应 mouseleave）',
      '',
      '【事件时序（一次按下-移动-抬起）】',
      '  pointerover → pointerenter → pointerdown → pointermove (×N)',
      '           → pointerup → pointerout → pointerleave',
      '  // pointercancel 可在任意时刻由系统插入（如触屏被来电打断）',
      '',
      '【pointerType 区分输入设备】',
      '  e.pointerType === "mouse"  // 鼠标',
      '  e.pointerType === "touch"  // 触摸（手指）',
      '  e.pointerType === "pen"    // 触控笔',
      '  // 统一一套事件处理，按需分支',
      '',
      '【与 Mouse Events / Touch Events 的关系：Pointer Events 是超集】',
      '  Mouse Events:    mousedown / mousemove / mouseup / mouseover / mouseout',
      '  Touch Events:    touchstart / touchmove / touchend / touchcancel',
      '  Pointer Events:  pointerdown / pointermove / pointerup / pointercancel / ...',
      '  // Pointer Events 覆盖鼠标 + 触摸 + 触控笔全部场景',
      '  // 浏览器仍会为鼠标触发 mousedown（兼容旧代码），可用 touch-action / e.preventDefault 控制',
      '',
      '【跨设备统一处理优势】',
      '  1. 一套代码兼容桌面（鼠标）+ 移动（触摸）+ 创意（触控笔）',
      '  2. 不必同时监听 mousedown + touchstart',
      '  3. 多指针天然支持（pointerId 跟踪每个指针）',
      '  4. 触控笔压力/倾斜等高级属性统一暴露',
      '  5. setPointerCapture 解决拖拽到元素外事件丢失',
      '',
      '【最小可用示例：一套事件兼容三类设备】',
      '  el.addEventListener("pointerdown", (e) => {',
      '    console.log("按下", e.pointerType, e.pointerId);',
      '    // mouse / touch / pen 三类设备都会触发',
      '  });',
      '  el.addEventListener("pointermove", (e) => {',
      '    draw(e.clientX, e.clientY);',
      '  });',
      '  el.addEventListener("pointerup", () => { ... });',
      '',
      '【按设备分支处理】',
      '  el.addEventListener("pointerdown", (e) => {',
      '    switch (e.pointerType) {',
      '      case "mouse": handleMouse(e); break;',
      '      case "touch": handleTouch(e); break;',
      '      case "pen":   handlePen(e);   break;',
      '    }',
      '  });',
      '',
      '【鼠标独有行为需注意】',
      '  - 鼠标有 hover（悬停），触摸/触控笔没有持续 hover',
      '  - 鼠标有 button/buttons 区分左/右/中键',
      '  - 鼠标单指针（pointerId 通常为 1，isPrimary 为 true）',
      '  - 触摸/触控笔支持多指针（每个手指一个 pointerId）',
      '',
      '【浏览器支持】',
      `  PointerEvent: ${f.pointerEvent ? '✓' : '✗'} (Chrome 55+ / Firefox 59+ / Safari 13+ / Edge 12+)`,
      `  ontouchstart: ${f.ontouchstart ? '✓' : '✗'} (设备支持触摸输入)`,
      `  navigator.maxTouchPoints: ${f.maxTouchPoints}`,
      '',
      '【常见陷阱】',
      '  1. iOS Safari 13+ 才支持 Pointer Events，旧版需 Touch Events 降级',
      '  2. pointercancel 必须处理，否则拖拽中被打断会"卡住"',
      '  3. 触摸默认会触发滚动/缩放，需 touch-action: none 配合',
      '  4. 鼠标的 pointermove 在悬停时也触发（不仅是按下时）',
      '  5. Firefox 早期版本不支持触控笔 tiltX/tiltY',
    ].join('\n');
    this.setState({ overviewInfo: info });
    this._addLog(f.pointerEvent ? 'info' : 'warn', `Pointer Events 演示完成；PointerEvent=${f.pointerEvent}/ontouchstart=${f.ontouchstart}`);
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const codeExample = [
      '// 一套 pointer 事件兼容鼠标/触摸/触控笔',
      'el.addEventListener("pointerdown", (e) => {',
      '  console.log(e.pointerType); // "mouse" | "touch" | "pen"',
      '  console.log(e.pointerId);   // 多指针唯一标识',
      '});',
      '// 浏览器自动为鼠标/触摸/触控笔触发 pointer 事件',
      '// 无需再分别写 mousedown 与 touchstart',
    ].join('\n');
    const card = new Card({
      title: '1. Pointer Events 概述与跨设备统一',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['PointerEvent', f.pointerEvent],
          ['ontouchstart', f.ontouchstart],
        ]),
        h(Tag, { color: 'primary' }, 'Pointer L2'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Pointer Events（W3C Pointer Events Level 2）将鼠标/触摸/触控笔统一为单一 API：pointerdown/pointermove/pointerup/pointercancel/pointerover/pointerout/pointerenter/pointerleave。它是 Mouse Events 与 Touch Events 的超集，通过 pointerType: mouse|touch|pen 区分输入设备。优势：一套代码兼容桌面+移动+创意设备，多指针天然支持（pointerId），触控笔压力/倾斜统一暴露。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行概述演示', { type: 'primary', size: 'sm', onClick: () => this._runOverviewDemo() }),
        ),
        h('div', { class: 'pt-ov-host' },
          h('div', { class: 'pt-ov-pill pt-ov-mouse' }, 'mouse 鼠标'),
          h('div', { class: 'pt-ov-pill pt-ov-touch' }, 'touch 触摸'),
          h('div', { class: 'pt-ov-pill pt-ov-pen' }, 'pen 触控笔'),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, codeExample)),
        h('div', { class: 'fs-sm text-secondary' }, '完整参考：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.overviewInfo || '（点击按钮查看 Pointer Events 概述完整参考）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 2：PointerEvent 属性全集 =====================

  _runPropsDemo() {
    const f = this._flags();
    this._injectStyle('pt-props-demo', `
      .pt-props-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    const info = [
      '===== PointerEvent 属性全集 =====',
      '',
      '【继承自 MouseEvent 的属性】',
      '  clientX / clientY     相对于视口的坐标',
      '  screenX / screenY     相对于屏幕的坐标',
      '  pageX / pageY         相对于文档的坐标（含滚动）',
      '  offsetX / offsetY     相对于目标元素的坐标',
      '  button / buttons      按下哪个按键（mouse）',
      '  ctrlKey/shiftKey/altKey/metaKey  修饰键',
      '  // PointerEvent extends MouseEvent，所有鼠标属性都可用',
      '',
      '【PointerEvent 独有属性】',
      '  pointerId      唯一标识符（多指针跟踪，整数）',
      '  pointerType    设备类型："mouse" | "touch" | "pen"',
      '  width          接触区域宽度（触屏有值，鼠标为 1）',
      '  height         接触区域高度（触屏有值，鼠标为 1）',
      '  pressure       压力 0-1（鼠标按住 0.5，松开 0；触控笔/触屏支持真实压力）',
      '  tangentialPressure  切向压力 0-1（触控笔高级）',
      '  tiltX          触控笔 X 轴倾斜角（-90 到 90）',
      '  tiltY          触控笔 Y 轴倾斜角（-90 到 90）',
      '  twist          触控笔绕自身轴线旋转角（0-359）',
      '  isPrimary      是否主指针（多点触控第一个为 primary）',
      '',
      '【pointerId：多指针跟踪】',
      '  // 每个指针（一个手指/一支笔/鼠标）有唯一 pointerId',
      '  el.addEventListener("pointerdown", (e) => {',
      '    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });',
      '  });',
      '  // 鼠标的 pointerId 通常固定为 1',
      '  // 触摸每个手指分配新 id；触控笔每支笔有独立 id',
      '',
      '【isPrimary：主指针标识】',
      '  // 多点触控中第一个按下的指针 isPrimary=true',
      '  // 后续指针 isPrimary=false',
      '  // 鼠标始终 isPrimary=true（单指针）',
      '  if (e.isPrimary) { /* 主指针逻辑，如单击/拖拽 */ }',
      '',
      '【width / height：接触区域（触屏）】',
      '  // 触屏手指接触是一个面，width/height 反映接触椭圆大小',
      '  // 鼠标为 1（点输入）',
      '  const r = Math.max(e.width, e.height) / 2;',
      '  ctx.arc(e.clientX, e.clientY, r, 0, Math.PI * 2);  // 画接触圆',
      '',
      '【pressure：压力 0-1】',
      '  // 鼠标：按下时 0.5，松开时 0（不支持真实压力）',
      '  // 触控笔/触屏：支持真实压力（0=无压力，1=最大压力）',
      '  if (e.pressure === 0.5 && e.pointerType === "mouse") {',
      '    // 鼠标按下的默认压力',
      '  }',
      '  const lineWidth = 0.5 + e.pressure * 10;  // 压感映射画笔粗细',
      '',
      '【tiltX / tiltY：触控笔倾斜角（-90 到 90）】',
      '  // 笔与屏幕垂直时 tiltX=0, tiltY=0',
      '  // 笔向右倾斜 tiltX 为正，向左为负',
      '  // 笔向前倾斜 tiltY 为正，向后为负',
      '  // 可模拟毛笔笔锋：tilt 越大笔锋越扁',
      '  if (e.pointerType === "pen") {',
      '    const tilt = Math.hypot(e.tiltX, e.tiltY);',
      '    ctx.lineWidth = baseWidth * (1 + tilt / 90);',
      '  }',
      '',
      '【twist：触控笔旋转角（0-359）】',
      '  // 笔绕自身轴线的旋转，马克笔/喷雾笔模拟',
      '  // 0=未旋转，359=接近一周',
      '',
      '【tangentialPressure：切向压力（0-1）】',
      '  // 高级触控笔的侧按键压力（如 Wacom 笔的侧滚轮）',
      '  // 普通设备通常为 0',
      '',
      '【getCoalescedEvents()：合并事件（高刷新率屏幕）】',
      '  // 120Hz 屏幕一帧内可能触发多次 pointermove',
      '  // 浏览器为性能合并为一次事件，但 getCoalescedEvents() 返回所有原始采样点',
      '  el.addEventListener("pointermove", (e) => {',
      '    const events = e.getCoalescedEvents();  // 含所有中间采样点',
      '    for (const c of events) {',
      '      ctx.lineTo(c.clientX, c.clientY);  // 绘制更平滑曲线',
      '    }',
      '    ctx.stroke();',
      '  });',
      '  // 绘画/签名板必备，否则高刷屏会丢点',
      '',
      '【getPredictedEvents()：预测事件（降低延迟感）】',
      '  // 浏览器基于近期轨迹预测未来几个采样点',
      '  // 适合实时绘制，减少从手移动到屏幕显示的延迟',
      '  const predicted = e.getPredictedEvents();',
      '  for (const p of predicted) {',
      '    // 先绘制预测点，下帧再修正',
      '  }',
      '',
      '【属性打印示例】',
      '  el.addEventListener("pointermove", (e) => {',
      '    console.log({',
      '      pointerId: e.pointerId,',
      '      pointerType: e.pointerType,',
      '      x: e.clientX, y: e.clientY,',
      '      pressure: e.pressure,',
      '      width: e.width, height: e.height,',
      '      tiltX: e.tiltX, tiltY: e.tiltY,',
      '      twist: e.twist,',
      '      isPrimary: e.isPrimary,',
      '    });',
      '  });',
      '',
      '【浏览器支持】',
      `  PointerEvent: ${f.pointerEvent ? '✓' : '✗'}`,
      `  getCoalescedEvents(): ${f.getCoalescedEvents ? '✓' : '✗'} (Chrome 58+ / Firefox 86+)`,
      `  getPredictedEvents(): ${f.getPredictedEvents ? '✓' : '✗'} (Chrome 77+)`,
      '',
      '【常见陷阱】',
      '  1. 鼠标的 pressure 始终是 0 或 0.5，不能用作真实压感',
      '  2. tiltX/tiltY/twist 仅触控笔有值，鼠标/触摸为 0',
      '  3. width/height 鼠标为 1，触摸为接触面，触控笔可能为 0 或 1',
      '  4. getCoalescedEvents 在 pointerup 上可能返回空数组',
      '  5. pointerId 在指针抬起后会被回收复用，不要长期缓存',
    ].join('\n');
    this.setState({ propsInfo: info });
    this._addLog(f.pointerEvent ? 'info' : 'warn', `PointerEvent 属性演示完成；getCoalescedEvents=${f.getCoalescedEvents}/getPredictedEvents=${f.getPredictedEvents}`);
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const codeExample = [
      'el.addEventListener("pointermove", (e) => {',
      '  console.log(e.pointerId, e.pointerType, e.pressure,',
      '    e.width, e.height, e.tiltX, e.tiltY, e.twist, e.isPrimary);',
      '  // 高刷屏：getCoalescedEvents 含更多原始采样点',
      '  for (const c of e.getCoalescedEvents()) drawPoint(c);',
      '});',
    ].join('\n');
    const card = new Card({
      title: '2. PointerEvent 属性全集（pointerId / pressure / tilt / coalesced）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['getCoalescedEvents', f.getCoalescedEvents],
          ['getPredictedEvents', f.getPredictedEvents],
        ]),
        h(Tag, { color: 'primary' }, '属性全集'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'PointerEvent 继承 MouseEvent（clientX/Y/screenX/Y/button 等），独有属性：pointerId 唯一标识（多指针跟踪）、pointerType 设备类型、width/height 接触区域（鼠标为 1）、pressure 压力 0-1（鼠标按住 0.5）、tangentialPressure 切向压力、tiltX/tiltY 触控笔倾斜角（-90 到 90）、twist 旋转角（0-359）、isPrimary 主指针。getCoalescedEvents() 返回高刷屏合并前的所有采样点（绘画必备），getPredictedEvents() 返回预测点（降延迟）。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行属性演示', { type: 'primary', size: 'sm', onClick: () => this._runPropsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, codeExample)),
        h('div', { class: 'fs-sm text-secondary' }, '完整参考：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.propsInfo || '（点击按钮查看 PointerEvent 属性全集完整参考）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 3：setPointerCapture 与指针捕获 =====================

  _runCaptureDemo() {
    const f = this._flags();
    this._addLog(f.setPointerCapture ? 'info' : 'warn', `拖拽监听已附加（setPointerCapture=${f.setPointerCapture}）；在方块上按下并拖动，移出边界仍持续触发`);
    const info = [
      '===== setPointerCapture 与指针捕获 =====',
      '',
      '【核心 API】',
      '  element.setPointerCapture(pointerId)     // 捕获指针',
      '  element.releasePointerCapture(pointerId) // 释放捕获',
      '  element.hasPointerCapture(pointerId)     // 检测是否已捕获',
      '',
      '【捕获效果】',
      '  // 调用 setPointerCapture 后，即使指针移出元素边界，',
      '  // 该元素仍持续接收 pointermove/pointerup 事件',
      '  // 直到调用 releasePointerCapture 或指针抬起',
      '',
      '【捕获相关事件】',
      '  gotpointercapture    // 元素获得捕获时触发',
      '  lostpointercapture   // 元素失去捕获时触发',
      '',
      '  el.addEventListener("gotpointercapture", () => {',
      '    console.log("已捕获指针");',
      '  });',
      '  el.addEventListener("lostpointercapture", () => {',
      '    console.log("已失去捕获");',
      '  });',
      '',
      '【应用场景 1：拖拽（drag）实现】',
      '  // 经典三段式：pointerdown 捕获 → pointermove 更新位置 → pointerup 释放',
      '  let startX, startY, originX = 0, originY = 0;',
      '  el.addEventListener("pointerdown", (e) => {',
      '    el.setPointerCapture(e.pointerId);  // 捕获，移出元素仍接收事件',
      '    startX = e.clientX;',
      '    startY = e.clientY;',
      '  });',
      '  el.addEventListener("pointermove", (e) => {',
      '    if (!el.hasPointerCapture(e.pointerId)) return;',
      '    const dx = e.clientX - startX;',
      '    const dy = e.clientY - startY;',
      '    el.style.transform = "translate(" + (originX + dx) + "px," + (originY + dy) + "px)";',
      '  });',
      '  el.addEventListener("pointerup", (e) => {',
      '    // setPointerCapture 会在 pointerup 时自动释放',
      '    // 也可显式 releasePointerCapture',
      '  });',
      '',
      '【应用场景 2：自定义滑块（slider）】',
      '  thumb.addEventListener("pointerdown", (e) => {',
      '    thumb.setPointerCapture(e.pointerId);',
      '  });',
      '  thumb.addEventListener("pointermove", (e) => {',
      '    if (!thumb.hasPointerCapture(e.pointerId)) return;',
      '    const rect = track.getBoundingClientRect();',
      '    const pct = (e.clientX - rect.left) / rect.width;',
      '    thumb.style.left = Math.min(1, Math.max(0, pct)) * 100 + "%";',
      '  });',
      '',
      '【应用场景 3：绘制画板（drawing canvas）】',
      '  // 捕获后即使指针移出 canvas 边界仍持续绘制',
      '  canvas.addEventListener("pointerdown", (e) => {',
      '    canvas.setPointerCapture(e.pointerId);',
      '    ctx.beginPath();',
      '    ctx.moveTo(e.clientX, e.clientY);',
      '  });',
      '',
      '【与 mouse capture（setCapture 已废弃）对比】',
      '  // 旧 IE：element.setCapture() / releaseCapture() —— 已废弃',
      '  // 现代：element.setPointerCapture(pointerId) —— 标准替代',
      '  // setPointerCapture 支持多指针（每个 pointerId 独立捕获）',
      '',
      '【解决拖拽到元素外事件丢失问题】',
      '  // 不用 setPointerCapture 时：',
      '  //   鼠标拖出元素 → pointermove 不再触发 → 拖拽卡住',
      '  //   需监听 document/window 的 mousemove/mouseup 兜底',
      '  // 用 setPointerCapture 后：',
      '  //   移出元素仍持续接收事件 → 代码简洁可靠',
      '',
      '【自动释放规则】',
      '  1. pointerup / pointercancel 触发时自动释放',
      '  2. 元素从 DOM 移除时自动释放',
      '  3. 显式 releasePointerCapture 释放',
      '  4. 同一 pointerId 重复 setPointerCapture 会转移捕获到新元素',
      '',
      '【浏览器支持】',
      `  setPointerCapture: ${f.setPointerCapture ? '✓' : '✗'} (Chrome 55+ / Firefox 59+ / Safari 13+)`,
      `  hasPointerCapture: ${f.hasPointerCapture ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. 必须用 e.pointerId（不是固定值），多指针各自捕获',
      '  2. pointercancel 时不会自动调用你的清理逻辑，需手动处理',
      '  3. 捕获后 pointerover/out 仍按几何位置触发，但 move/up 持续到捕获元素',
      '  4. 重复 setPointerCapture 不同元素会转移，原元素触发 lostpointercapture',
    ].join('\n');
    this.setState({ captureInfo: info });
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const statusEl = h('div', { class: 'pt-status' }, '拖拽演示：在方块上按下并拖动（鼠标/触摸/触控笔均可），拖出边界仍持续触发');
    const dragBox = h('div', { class: 'pt-drag-box', style: { touchAction: 'none' },
      onPointerDown: (e) => {
        try { if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
        this._dragStartX = e.clientX;
        this._dragStartY = e.clientY;
        this._dragOriginX = parseInt(e.currentTarget.dataset.x || '0', 10);
        this._dragOriginY = parseInt(e.currentTarget.dataset.y || '0', 10);
        statusEl.textContent = 'pointerdown pointerId=' + e.pointerId + ' type=' + (e.pointerType || '?') + ' 已捕获 setPointerCapture，拖动中（移出边界仍触发）';
      },
      onPointerMove: (e) => {
        if (this._dragStartX == null) return;
        const dx = e.clientX - this._dragStartX;
        const dy = e.clientY - this._dragStartY;
        const nx = this._dragOriginX + dx;
        const ny = this._dragOriginY + dy;
        e.currentTarget.style.transform = 'translate(' + nx + 'px,' + ny + 'px)';
        e.currentTarget.dataset.x = String(nx);
        e.currentTarget.dataset.y = String(ny);
      },
      onPointerUp: (e) => {
        try { if (e.currentTarget.releasePointerCapture) e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
        this._dragStartX = null;
        this._dragStartY = null;
        statusEl.textContent = 'pointerup pointerId=' + e.pointerId + ' 已释放捕获，拖拽结束';
      },
      onPointerCancel: (e) => {
        this._dragStartX = null;
        this._dragStartY = null;
        statusEl.textContent = 'pointercancel pointerId=' + e.pointerId + ' 系统打断（必须处理）';
      },
    }, '拖我');
    const codeExample = [
      '// 拖拽：pointerdown 捕获 → move 更新 → up 释放',
      'el.addEventListener("pointerdown", (e) => {',
      '  el.setPointerCapture(e.pointerId); // 移出元素仍接收',
      '});',
      'el.addEventListener("pointermove", (e) => {',
      '  if (!el.hasPointerCapture(e.pointerId)) return;',
      '  el.style.transform = "translate(" + dx + "px," + dy + "px)";',
      '});',
      '// pointerup 时自动释放',
    ].join('\n');
    const card = new Card({
      title: '3. setPointerCapture 与指针捕获（拖拽必备）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['setPointerCapture', f.setPointerCapture],
          ['hasPointerCapture', f.hasPointerCapture],
        ]),
        h(Tag, { color: 'primary' }, '指针捕获'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'element.setPointerCapture(pointerId) 捕获指针：即使指针移出元素边界仍持续接收 pointermove/pointerup。releasePointerCapture 释放、hasPointerCapture 检测、gotpointercapture/lostpointercapture 事件。应用：拖拽（pointerdown 捕获 → move 更新位置 → up 释放）、自定义滑块、画板。替代已废弃的 element.setCapture()，解决拖拽到元素外事件丢失问题。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行捕获演示', { type: 'primary', size: 'sm', onClick: () => this._runCaptureDemo() }),
        ),
        h('div', { class: 'pt-drag-host' }, dragBox),
        statusEl,
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, codeExample)),
        h('div', { class: 'fs-sm text-secondary' }, '完整参考：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.captureInfo || '（点击按钮查看 setPointerCapture 完整参考）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 4：Touch Events API（传统触摸） =====================

  _runTouchApiDemo() {
    const f = this._flags();
    this._addLog(f.touchEvent ? 'info' : 'warn', `Touch Events 演示完成；TouchEvent=${f.touchEvent}`);
    const info = [
      '===== Touch Events API（传统触摸） =====',
      '',
      '【4 个事件】',
      '  touchstart    手指触摸屏幕',
      '  touchmove     手指在屏幕移动',
      '  touchend      手指离开屏幕',
      '  touchcancel   触摸被取消（系统打断如来电/手势冲突）',
      '',
      '【三个 TouchList】',
      '  event.touches         当前屏幕上所有触摸点（所有手指）',
      '  event.targetTouches   当前目标元素上的触摸点',
      '  event.changedTouches  触发本次事件的触摸点',
      '  // touchstart: changedTouches = 新按下的手指',
      '  // touchmove:  changedTouches = 移动的手指',
      '  // touchend:   changedTouches = 抬起的手指（已不在 touches 中）',
      '',
      '【Touch 对象属性】',
      '  identifier    唯一标识（跟踪同一手指）',
      '  target        触摸目标元素（touchstart 时确定，不随移动改变）',
      '  clientX/Y     相对视口坐标',
      '  pageX/Y       相对文档坐标（含滚动）',
      '  screenX/Y     相对屏幕坐标',
      '  radiusX/Y     接触椭圆半径（触屏）',
      '  rotationAngle 接触椭圆旋转角',
      '  force         压力 0-1（部分设备支持）',
      '',
      '【基础示例：单指拖拽】',
      '  el.addEventListener("touchstart", (e) => {',
      '    const t = e.changedTouches[0];',
      '    startX = t.clientX; startY = t.clientY;',
      '    e.preventDefault(); // 阻止滚动',
      '  }, { passive: false });',
      '  el.addEventListener("touchmove", (e) => {',
      '    const t = e.changedTouches[0];',
      '    el.style.transform = "translate(" + (t.clientX - startX) + "px,0)";',
      '    e.preventDefault();',
      '  }, { passive: false });',
      '',
      '【多指跟踪：identifier】',
      '  const fingers = new Map();',
      '  el.addEventListener("touchstart", (e) => {',
      '    for (const t of e.changedTouches) {',
      '      fingers.set(t.identifier, { x: t.clientX, y: t.clientY });',
      '    }',
      '  });',
      '  el.addEventListener("touchmove", (e) => {',
      '    for (const t of e.changedTouches) {',
      '      const prev = fingers.get(t.identifier);',
      '      const dx = t.clientX - prev.x;',
      '      // ...',
      '      fingers.set(t.identifier, { x: t.clientX, y: t.clientY });',
      '    }',
      '  });',
      '  el.addEventListener("touchend", (e) => {',
      '    for (const t of e.changedTouches) fingers.delete(t.identifier);',
      '  });',
      '',
      '【event.preventDefault() 阻止默认行为】',
      '  // 触摸默认会触发滚动/双指缩放/双击放大等',
      '  // preventDefault 阻止这些默认行为',
      '  el.addEventListener("touchmove", (e) => {',
      '    e.preventDefault(); // 阻止页面滚动',
      '  }, { passive: false });  // 必须非被动才能 preventDefault',
      '',
      '【passive 监听与性能】',
      '  // passive: true 告诉浏览器不会 preventDefault，可立即滚动（性能好）',
      '  // 但 passive: true 时 preventDefault 无效（控制台警告）',
      '  document.addEventListener("touchstart", handler, { passive: true });',
      '  // 需阻止滚动时必须 passive: false',
      '',
      '【与 Pointer Events 对比】',
      '  Touch Events:',
      '    + 更早出现，iOS Safari 历史支持好',
      '    + touches/targetTouches/changedTouches 多指 API 直观',
      '    - 无触控笔压力/倾斜细节（force 部分设备）',
      '    - 鼠标需另写 mousedown',
      '    - 无 setPointerCapture',
      '  Pointer Events:',
      '    + 统一鼠标/触摸/触控笔',
      '    + pointerId 多指针 + setPointerCapture',
      '    + 触控笔 pressure/tilt/twist',
      '    - iOS Safari 13+ 才支持',
      '',
      '【target 不随移动改变】',
      '  // touchstart 时确定 target，之后手指移到其他元素上 target 仍不变',
      '  // 这与 mousemove 不同（mousemove 的 target 跟随位置）',
      '  // Pointer Events 默认也类似（除非用 setPointerCapture）',
      '',
      '【浏览器支持】',
      `  TouchEvent: ${f.touchEvent ? '✓' : '✗'} (所有移动浏览器 + 桌面触摸屏)`,
      `  ontouchstart: ${f.ontouchstart ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. touchend 时触摸点已离开屏幕，故在 changedTouches 而非 touches',
      '  2. passive: true 时 preventDefault 无效，需阻止滚动必须 passive: false',
      '  3. iOS 滚动惯性可能持续触发 touchmove，需用 touch-action 控制',
      '  4. 多指 target 都是最早触摸的元素（touchstart 时的 target）',
      '  5. Touch Events 与 Pointer Events 同时监听会重复触发（建议二选一）',
    ].join('\n');
    this.setState({ touchApiInfo: info });
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const codeExample = [
      'el.addEventListener("touchstart", (e) => {',
      '  for (const t of e.touches) console.log(t.identifier, t.clientX);',
      '  e.preventDefault(); // 阻止滚动/缩放（需 passive: false）',
      '}, { passive: false });',
      '// Touch 对象：identifier/target/clientX/pageX/radiusX/force',
    ].join('\n');
    const card = new Card({
      title: '4. Touch Events API（传统触摸事件）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['TouchEvent', f.touchEvent],
          ['ontouchstart', f.ontouchstart],
        ]),
        h(Tag, { color: 'primary' }, 'Touch L1'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Touch Events：touchstart/touchmove/touchend/touchcancel。三个 TouchList：touches（屏幕所有触摸点）、targetTouches（当前元素上）、changedTouches（触发本事件的）。Touch 对象属性：identifier（跟踪同一手指）/target/clientX/Y/pageX/Y/screenX/Y/radiusX/Y/rotationAngle/force。event.preventDefault() 阻止滚动/缩放（需 passive: false）。与 Pointer Events 对比：Touch Events 更早、iOS Safari 历史支持，但无触控笔压力细节，鼠标需另写。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 Touch API 演示', { type: 'primary', size: 'sm', onClick: () => this._runTouchApiDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, codeExample)),
        h('div', { class: 'fs-sm text-secondary' }, '完整参考：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.touchApiInfo || '（点击按钮查看 Touch Events API 完整参考）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 5：touch-action CSS 属性 =====================

  _runTouchActionDemo() {
    const f = this._flags();
    this._injectStyle('pt-touchaction-demo', `
      .pt-ta-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 8px;
        margin-top: 10px;
      }
      .pt-ta-cell {
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 10px;
        font-size: 11px;
        font-family: monospace;
      }
      .pt-ta-cell b { font-family: sans-serif; }
    `);
    const info = [
      '===== touch-action CSS 属性 =====',
      '',
      '【作用】',
      '  控制元素上哪些触摸手势由浏览器默认处理（滚动/缩放等）',
      '  设置后浏览器知道哪些手势交给 JS，可立即响应避免 300ms 延迟',
      '',
      '【取值全集】',
      '  touch-action: auto;             // 默认，浏览器处理所有手势',
      '  touch-action: none;             // 禁用所有默认手势（自定义手势必需）',
      '  touch-action: pan-x;            // 仅允许水平滚动',
      '  touch-action: pan-y;            // 仅允许垂直滚动',
      '  touch-action: pan-left;         // 仅允许向左滚动',
      '  touch-action: pan-right;        // 仅允许向右滚动',
      '  touch-action: pan-up;           // 仅允许向上滚动',
      '  touch-action: pan-down;         // 仅允许向下滚动',
      '  touch-action: pinch-zoom;       // 允许双指缩放',
      '  touch-action: manipulation;     // 仅允许滚动和缩放（禁用双击放大）',
      '',
      '【组合值】',
      '  touch-action: pan-x pan-y;      // 允许水平+垂直滚动（等价 auto 滚动部分）',
      '  touch-action: pan-x pinch-zoom; // 允许水平滚动 + 双指缩放',
      '  touch-action: none;             // 全禁用，完全自定义',
      '',
      '【各值应用场景】',
      '  /* 自定义手势（画板/拖拽）必须禁用所有默认手势 */',
      '  .canvas { touch-action: none; }',
      '',
      '  /* 水平轮播：仅允许水平滚动，禁用垂直滚动 */',
      '  .carousel { touch-action: pan-x; }',
      '',
      '  /* 垂直列表：仅允许垂直滚动 */',
      '  .scroll-list { touch-action: pan-y; }',
      '',
      '  /* 图片查看器：允许双指缩放 */',
      '  .image-viewer { touch-action: pinch-zoom; }',
      '',
      '  /* 按钮去 300ms 延迟：禁用双击放大但保留滚动 */',
      '  .button { touch-action: manipulation; }',
      '',
      '【与 Pointer Events 协同】',
      '  /* 实现自定义手势的标准流程：先设 touch-action: none 再用 pointer 事件 */',
      '  .gesture-area {',
      '    touch-action: none;  /* 禁用浏览器默认滚动/缩放 */',
      '  }',
      '  // 然后 JS 用 pointerdown/move/up 实现自定义拖拽/缩放',
      '  area.addEventListener("pointermove", (e) => {',
      '    // 不会因浏览器滚动而被打断',
      '  });',
      '',
      '【避免 300ms 点击延迟】',
      '  /* 早期移动浏览器为区分单击/双击，click 延迟 300ms */',
      '  /* 现代浏览器：设 touch-action: manipulation 即可消除 */',
      '  html { touch-action: manipulation; }',
      '  /* 或 viewport meta: width=device-width 即默认消除（现代浏览器）*/',
      '',
      '【pan-left/right/up/down 精细方向控制】',
      '  /* 仅允许单方向滚动，常用于：',
      '     - 抽屉菜单：仅允许向右拉开（pan-right）',
      '     - 下拉刷新：仅允许向下拉动（pan-down）*/',
      '  .drawer { touch-action: pan-right; }',
      '',
      '【继承与覆盖】',
      '  - touch-action 不继承（每个元素独立设置）',
      '  - 子元素设置会覆盖父元素在该子元素上的行为',
      '  - 默认值 auto：浏览器处理所有手势',
      '',
      '【浏览器支持】',
      `  touch-action: ${f.touchAction ? '✓' : '✗'} (Chrome 36+ / Firefox 52+ / Safari 13+)`,
      '  pan-left/right/up/down: Chrome 55+ / Safari 13+',
      '  pinch-zoom: Chrome 56+',
      '',
      '【常见陷阱】',
      '  1. 不设 touch-action: none 时，自定义拖拽会被浏览器滚动打断',
      '  2. iOS Safari 早期版本支持滞后（pan-left/right 需 13+）',
      '  3. touch-action 不影响鼠标行为（仅触摸）',
      '  4. 改 touch-action 不会重新触发已开始的触摸手势',
      '  5. manipulation 不禁用滚动，仅禁用双击放大（适合按钮）',
    ].join('\n');
    this.setState({ touchActionInfo: info });
    this._addLog(f.touchAction ? 'info' : 'warn', `touch-action 演示完成；supports=${f.touchAction}`);
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const codeExample = [
      '/* 禁用默认手势，用 pointer 事件自定义 */',
      '.canvas { touch-action: none; }',
      '/* 仅允许水平滚动（轮播） */',
      '.carousel { touch-action: pan-x; }',
      '/* 允许双指缩放（图片查看器） */',
      '.viewer { touch-action: pinch-zoom; }',
      '/* 禁用双击放大，消除 300ms 延迟（按钮） */',
      '.button { touch-action: manipulation; }',
    ].join('\n');
    const card = new Card({
      title: '5. touch-action CSS 属性（控制默认触摸手势）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['touch-action', f.touchAction]]),
        h(Tag, { color: 'primary' }, 'CSS 属性'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'touch-action: auto|none|pan-x|pan-y|pan-left|pan-right|pan-up|pan-down|pinch-zoom|manipulation 控制元素上哪些触摸手势由浏览器默认处理。none 禁用所有默认手势（自定义手势必需），pan-x/pan-y 仅允许水平/垂直滚动，pinch-zoom 允许双指缩放，manipulation 仅允许滚动和缩放（禁用双击放大，消除 300ms 延迟）。与 Pointer Events 协同：先设 touch-action: none 再用 pointer 事件实现自定义手势。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 touch-action 演示', { type: 'primary', size: 'sm', onClick: () => this._runTouchActionDemo() }),
        ),
        h('div', { class: 'pt-ta-grid' },
          h('div', { class: 'pt-ta-cell' }, [h('b', {}, 'none'), h('div', {}, '禁用所有默认手势')]),
          h('div', { class: 'pt-ta-cell' }, [h('b', {}, 'pan-x'), h('div', {}, '仅水平滚动')]),
          h('div', { class: 'pt-ta-cell' }, [h('b', {}, 'pan-y'), h('div', {}, '仅垂直滚动')]),
          h('div', { class: 'pt-ta-cell' }, [h('b', {}, 'pinch-zoom'), h('div', {}, '双指缩放')]),
          h('div', { class: 'pt-ta-cell' }, [h('b', {}, 'manipulation'), h('div', {}, '滚动+缩放，禁双击')]),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, codeExample)),
        h('div', { class: 'fs-sm text-secondary' }, '完整参考：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.touchActionInfo || '（点击按钮查看 touch-action 完整参考）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 6：多点触控与手势识别 =====================

  _runGestureDemo() {
    const f = this._flags();
    this._pointers = this._pointers || new Map();
    this._addLog(f.setPointerCapture ? 'info' : 'warn', '手势识别监听已附加；在下方区域触摸/拖动（多指需触摸屏），自动计算 pinch/rotate/drag');
    const info = [
      '===== 多点触控与手势识别 =====',
      '',
      '【多点触控跟踪：用 Map 缓存 pointerId → 状态】',
      '  const pointers = new Map();',
      '  el.addEventListener("pointerdown", (e) => {',
      '    el.setPointerCapture(e.pointerId);',
      '    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });',
      '  });',
      '  el.addEventListener("pointermove", (e) => {',
      '    if (!pointers.has(e.pointerId)) return;',
      '    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });',
      '    if (pointers.size === 2) handlePinchRotate(pointers);',
      '    else handleDrag(e);',
      '  });',
      '  el.addEventListener("pointerup", (e) => pointers.delete(e.pointerId));',
      '  // 注意：用 Map 不用普通对象（pointerId 可能冲突 Object 原型属性）',
      '',
      '【pinch 缩放手势：两指距离变化计算 scale】',
      '  let initialDist = 0;',
      '  function onTwoPointerDown(pointers) {',
      '    const [a, b] = [...pointers.values()];',
      '    initialDist = Math.hypot(b.x - a.x, b.y - a.y);',
      '  }',
      '  function onTwoPointerMove(pointers) {',
      '    const [a, b] = [...pointers.values()];',
      '    const dist = Math.hypot(b.x - a.x, b.y - a.y);',
      '    const scale = dist / initialDist;',
      '    el.style.transform = "scale(" + scale + ")";',
      '  }',
      '',
      '【rotate 旋转手势：两指角度变化计算 rotation】',
      '  let initialAngle = 0;',
      '  function onTwoPointerDown(pointers) {',
      '    const [a, b] = [...pointers.values()];',
      '    initialAngle = Math.atan2(b.y - a.y, b.x - a.x);',
      '  }',
      '  function onTwoPointerMove(pointers) {',
      '    const [a, b] = [...pointers.values()];',
      '    const angle = Math.atan2(b.y - a.y, b.x - a.x);',
      '    const rotation = angle - initialAngle;  // 弧度',
      '    el.style.transform += " rotate(" + rotation + "rad)";',
      '  }',
      '',
      '【pinch + rotate 组合：同时缩放和旋转】',
      '  function applyTransform(pointers) {',
      '    const [a, b] = [...pointers.values()];',
      '    const dist = Math.hypot(b.x - a.x, b.y - a.y);',
      '    const angle = Math.atan2(b.y - a.y, b.x - a.x);',
      '    const scale = dist / initialDist;',
      '    const rotation = angle - initialAngle;',
      '    el.style.transform =',
      '      "translate(" + cx + "px," + cy + "px)" +',
      '      " rotate(" + rotation + "rad)" +',
      '      " scale(" + scale + ")";',
      '  }',
      '',
      '【swipe 滑动手势：单指位移 + 速度阈值】',
      '  let startX, startY, startTime;',
      '  el.addEventListener("pointerdown", (e) => {',
      '    startX = e.clientX; startY = e.clientY; startTime = Date.now();',
      '  });',
      '  el.addEventListener("pointerup", (e) => {',
      '    const dx = e.clientX - startX;',
      '    const dy = e.clientY - startY;',
      '    const dt = Date.now() - startTime;',
      '    const speed = Math.hypot(dx, dy) / dt;  // px/ms',
      '    if (speed > 0.5 && Math.abs(dx) > 50) {',
      '      if (dx > 0) console.log("向右滑"); else console.log("向左滑");',
      '    }',
      '  });',
      '',
      '【long press 长按：pointerdown 后 setTimeout 检测未移动】',
      '  let pressTimer;',
      '  let startX, startY;',
      '  el.addEventListener("pointerdown", (e) => {',
      '    startX = e.clientX; startY = e.clientY;',
      '    pressTimer = setTimeout(() => {',
      '      console.log("长按触发");',
      '    }, 500);  // 500ms 长按阈值',
      '  });',
      '  el.addEventListener("pointermove", (e) => {',
      '    if (Math.hypot(e.clientX - startX, e.clientY - startY) > 10) {',
      '      clearTimeout(pressTimer);  // 移动超过 10px 取消长按',
      '    }',
      '  });',
      '  el.addEventListener("pointerup", () => clearTimeout(pressTimer));',
      '',
      '【double tap 双击：两次 pointerup 时间差】',
      '  let lastTap = 0;',
      '  el.addEventListener("pointerup", (e) => {',
      '    const now = Date.now();',
      '    if (now - lastTap < 300) {  // 300ms 内第二次',
      '      console.log("双击");',
      '      lastTap = 0;',
      '    } else {',
      '      lastTap = now;',
      '    }',
      '  });',
      '',
      '【drag 拖拽：pointerdown + pointermove 累计位移】',
      '  // 详见 Card 3 setPointerCapture 实现',
      '',
      '【手势状态机设计：idle → detecting → active → end】',
      '  const state = "idle";',
      '  // idle:      无指针',
      '  // detecting: 1 个指针，判断 tap/long press/swipe',
      '  // active:    手势识别完成（如 pinch/rotate/drag 进行中）',
      '  // end:       指针抬起，触发回调并回 idle',
      '',
      '  // 状态机伪代码',
      '  function transition(event, pointers) {',
      '    switch (state) {',
      '      case "idle":',
      '        if (pointers.size === 1) state = "detecting";',
      '        if (pointers.size === 2) { state = "active"; initPinch(pointers); }',
      '        break;',
      '      case "detecting":',
      '        if (pointers.size === 2) { state = "active"; initPinch(pointers); }',
      '        break;',
      '      case "active":',
      '        if (pointers.size < 2) { state = "end"; finalizeGesture(); }',
      '        break;',
      '    }',
      '  }',
      '',
      '【实战场景】',
      '  - 图片缩放旋转：pinch + rotate 组合 transform',
      '  - 画板多指：第一指画线，第二指缩放视图',
      '  - 卡片拖拽：单指 drag + 边界检测',
      '  - 地图：pan + pinch-zoom',
      '',
      '【浏览器支持】',
      `  PointerEvent 多指针: ${f.pointerEvent ? '✓' : '✗'}`,
      `  setPointerCapture: ${f.setPointerCapture ? '✓' : '✗'}`,
      `  maxTouchPoints: ${f.maxTouchPoints}`,
      '',
      '【常见陷阱】',
      '  1. 多指针状态管理用 Map 不用普通对象（避免原型属性冲突）',
      '  2. 鼠标单指针，pinch/rotate 需触摸屏或触控笔',
      '  3. pointercancel 必须清理 pointers Map，否则状态泄漏',
      '  4. 旋转角度需用 atan2（atan 在 90° 不连续）',
      '  5. 缩放/旋转中心通常取两指中点，否则会偏移',
    ].join('\n');
    this.setState({ gestureInfo: info });
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    this._pointers = this._pointers || new Map();
    const hintEl = h('div', { class: 'pt-gesture-viz__hint' }, '触摸/拖动此区域 · 多指需触摸屏');
    const statusEl = h('div', { class: 'pt-status' }, '手势识别：在下方深色区域按下并移动。单指=拖拽/swipe，双指(触摸屏)=pinch/rotate');
    const viz = h('div', { class: 'pt-gesture-viz', style: { touchAction: 'none' },
      onPointerDown: (e) => {
        try { if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
        this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        this._gestureInit = this._gestureInit || {};
        if (this._pointers.size === 2) {
          const [a, b] = [...this._pointers.values()];
          this._gestureInit.dist = Math.hypot(b.x - a.x, b.y - a.y);
          this._gestureInit.angle = Math.atan2(b.y - a.y, b.x - a.x);
        }
        statusEl.textContent = 'pointerdown id=' + e.pointerId + ' type=' + (e.pointerType || '?') + ' 当前指针数=' + this._pointers.size;
      },
      onPointerMove: (e) => {
        if (!this._pointers.has(e.pointerId)) return;
        this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this._pointers.size >= 2 && this._gestureInit && this._gestureInit.dist) {
          const [a, b] = [...this._pointers.values()];
          const dist = Math.hypot(b.x - a.x, b.y - a.y);
          const angle = Math.atan2(b.y - a.y, b.x - a.x);
          const scale = (dist / this._gestureInit.dist).toFixed(2);
          const rot = ((angle - this._gestureInit.angle) * 180 / Math.PI).toFixed(1);
          statusEl.textContent = 'pinch scale=' + scale + ' · rotate=' + rot + '° · 指针数=' + this._pointers.size;
        } else if (this._pointers.size === 1) {
          const p = [...this._pointers.values()][0];
          statusEl.textContent = 'drag/swipe 跟踪 x=' + Math.round(p.x) + ' y=' + Math.round(p.y) + ' · 指针数=1';
        }
      },
      onPointerUp: (e) => {
        this._pointers.delete(e.pointerId);
        if (this._pointers.size < 2) this._gestureInit = {};
        statusEl.textContent = 'pointerup id=' + e.pointerId + ' 剩余指针数=' + this._pointers.size + '（手势结束/降级）';
      },
      onPointerCancel: (e) => {
        this._pointers.delete(e.pointerId);
        this._gestureInit = {};
        statusEl.textContent = 'pointercancel id=' + e.pointerId + ' 系统打断，状态已清理';
      },
    }, hintEl);
    const codeExample = [
      '// 多点触控 + pinch/rotate 手势识别',
      'const pointers = new Map();',
      'let initDist = 0, initAngle = 0;',
      'el.addEventListener("pointerdown", (e) => {',
      '  el.setPointerCapture(e.pointerId);',
      '  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });',
      '  if (pointers.size === 2) {',
      '    const [a, b] = [...pointers.values()];',
      '    initDist = Math.hypot(b.x - a.x, b.y - a.y);',
      '    initAngle = Math.atan2(b.y - a.y, b.x - a.x);',
      '  }',
      '});',
      'el.addEventListener("pointermove", (e) => {',
      '  if (!pointers.has(e.pointerId)) return;',
      '  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });',
      '  if (pointers.size === 2) {',
      '    const [a, b] = [...pointers.values()];',
      '    const scale = Math.hypot(b.x-a.x, b.y-a.y) / initDist;',
      '    const rot = Math.atan2(b.y-a.y, b.x-a.x) - initAngle;',
      '    el.style.transform = "rotate(" + rot + "rad) scale(" + scale + ")";',
      '  }',
      '});',
      'el.addEventListener("pointerup", (e) => pointers.delete(e.pointerId));',
    ].join('\n');
    const card = new Card({
      title: '6. 多点触控与手势识别（pinch / rotate / swipe / long press / double tap）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['多指针', f.pointerEvent],
          ['maxTouchPoints', f.maxTouchPoints > 0],
        ]),
        h(Tag, { color: 'primary' }, '手势识别'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '多点触控跟踪用 Map 缓存 pointerId → 状态。pinch 缩放（两指距离变化计算 scale）、rotate 旋转（两指角度变化用 atan2 计算 rotation）、swipe 滑动（单指位移 + 速度阈值）、long press 长按（pointerdown 后 setTimeout 检测未移动）、double tap 双击（两次 pointerup 时间差）、drag 拖拽。手势状态机设计：idle → detecting → active → end。实战：图片缩放旋转、画板多指、卡片拖拽。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行手势识别演示', { type: 'primary', size: 'sm', onClick: () => this._runGestureDemo() }),
        ),
        viz,
        statusEl,
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '完整手势识别代码（pinch + rotate）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '460px', overflow: 'auto' } },
          h('code', {}, codeExample)),
        h('div', { class: 'fs-sm text-secondary' }, '完整参考：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.gestureInfo || '（点击按钮查看手势识别完整参考）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 7：触控笔与压感应用 =====================

  _runPenDemo() {
    const f = this._flags();
    this._addLog(f.getCoalescedEvents ? 'info' : 'warn', '画板监听已附加；用触控笔/鼠标在画布上绘制（触控笔支持压力/倾斜）');
    const info = [
      '===== 触控笔与压感应用 =====',
      '',
      '【识别触控笔】',
      '  el.addEventListener("pointerdown", (e) => {',
      '    if (e.pointerType !== "pen") return;  // 仅触控笔',
      '    startStroke(e);',
      '  });',
      '',
      '【pressure 压感（0-1）映射画笔粗细/透明度】',
      '  // 压力 0=无压力，1=最大压力',
      '  // 鼠标按住为 0.5，松开为 0；触控笔/触屏支持真实压力',
      '  el.addEventListener("pointermove", (e) => {',
      '    if (e.pointerType !== "pen") return;',
      '    const width = 0.5 + e.pressure * 12;  // 压感映射粗细',
      '    const alpha = 0.3 + e.pressure * 0.7;  // 压感映射透明度',
      '    ctx.lineWidth = width;',
      '    ctx.globalAlpha = alpha;',
      '    ctx.lineTo(e.clientX, e.clientY);',
      '    ctx.stroke();',
      '  });',
      '',
      '【tiltX / tiltY 倾斜角映射笔锋角度】',
      '  // tiltX/tiltY 范围 -90 到 90',
      '  // 笔垂直时为 0；倾斜越大笔锋越扁（模拟毛笔/铅笔）',
      '  el.addEventListener("pointermove", (e) => {',
      '    if (e.pointerType !== "pen") return;',
      '    const tilt = Math.hypot(e.tiltX, e.tiltY);  // 总倾斜度',
      '    const tiltAngle = Math.atan2(e.tiltY, e.tiltX);  // 倾斜方向',
      '    // 模拟毛笔：tilt 越大笔锋越宽越扁',
      '    ctx.lineWidth = (1 - tilt / 90) * 2 + e.pressure * 10;',
      '    // 笔锋方向旋转',
      '    ctx.save();',
      '    ctx.translate(e.clientX, e.clientY);',
      '    ctx.rotate(tiltAngle);',
      '    ctx.scale(1, 1 + tilt / 30);  // 椭圆笔锋',
      '    ctx.beginPath();',
      '    ctx.arc(0, 0, ctx.lineWidth / 2, 0, Math.PI * 2);',
      '    ctx.fill();',
      '    ctx.restore();',
      '  });',
      '',
      '【twist 旋转角（0-359）】',
      '  // 笔绕自身轴线旋转，马克笔/喷雾笔模拟',
      '  // 扁笔（如马克笔）旋转改变笔触方向',
      '  const angle = (e.twist || 0) * Math.PI / 180;',
      '  ctx.rotate(angle);',
      '',
      '【getCoalescedEvents() 获取高频采样点】',
      '  // 120Hz 屏幕一帧内多次 pointermove 被合并',
      '  // getCoalescedEvents() 返回所有原始采样点，绘制更平滑曲线',
      '  el.addEventListener("pointermove", (e) => {',
      '    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];',
      '    for (const c of events) {',
      '      ctx.lineTo(c.clientX, c.clientY);  // 逐点连线',
      '    }',
      '    ctx.stroke();  // 一次 stroke 所有点，性能更好',
      '  });',
      '  // 不用 getCoalescedEvents 在高刷屏会丢点，曲线断续',
      '',
      '【贝塞尔曲线平滑绘制】',
      '  // 用二次/三次贝塞尔曲线连接采样点，消除锯齿',
      '  let points = [];',
      '  el.addEventListener("pointermove", (e) => {',
      '    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];',
      '    for (const c of events) points.push({ x: c.clientX, y: c.clientY });',
      '    ctx.beginPath();',
      '    ctx.moveTo(points[0].x, points[0].y);',
      '    for (let i = 1; i < points.length - 1; i++) {',
      '      const mid = {',
      '        x: (points[i].x + points[i + 1].x) / 2,',
      '        y: (points[i].y + points[i + 1].y) / 2,',
      '      };',
      '      ctx.quadraticCurveTo(points[i].x, points[i].y, mid.x, mid.y);',
      '    }',
      '    ctx.stroke();',
      '  });',
      '',
      '【防抖算法】',
      '  // 简单移动平均：每个点用前后若干点平均',
      '  function smooth(points, window = 3) {',
      '    return points.map((p, i) => {',
      '      let sx = 0, sy = 0, n = 0;',
      '      for (let j = Math.max(0, i - window); j <= Math.min(points.length - 1, i + window); j++) {',
      '        sx += points[j].x; sy += points[j].y; n++;',
      '      }',
      '      return { x: sx / n, y: sy / n };',
      '    });',
      '  }',
      '',
      '【实战：签名板】',
      '  // 关键：getCoalescedEvents 平滑 + pressure 粗细 + 触摸/鼠标兼容',
      '  canvas.addEventListener("pointerdown", (e) => {',
      '    canvas.setPointerCapture(e.pointerId);',
      '    ctx.beginPath();',
      '    ctx.moveTo(e.clientX, e.clientY);',
      '  });',
      '  canvas.addEventListener("pointermove", (e) => {',
      '    if (!canvas.hasPointerCapture(e.pointerId)) return;',
      '    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];',
      '    for (const c of events) {',
      '      ctx.lineWidth = 0.5 + (c.pressure || 0.5) * 4;',
      '      ctx.lineTo(c.clientX, c.clientY);',
      '      ctx.stroke();',
      '    }',
      '  });',
      '',
      '【绘画应用（Procreate 风格）】',
      '  - 多笔刷：圆笔（恒粗细）/毛笔（压感粗细）/铅笔（压感透明度）',
      '  - 笔锋：tilt 映射椭圆笔触',
      '  - 平滑：贝塞尔 + getCoalescedEvents',
      '  - 撤销：每笔画存为路径对象，undo 出栈重绘',
      '',
      '【与 Apple Pencil / Surface Pen 对接】',
      '  - Apple Pencil：pressure + tiltX/tiltY + altitude/azimuth（Safari）',
      '  - Surface Pen：pressure + tilt（Edge/Chrome）',
      '  - Wacom：pressure + tilt + twist（部分型号）',
      '  // 统一通过 PointerEvent 的 pressure/tiltX/tiltY/twist 读取',
      '',
      '【浏览器支持】',
      `  PointerEvent: ${f.pointerEvent ? '✓' : '✗'}`,
      `  getCoalescedEvents: ${f.getCoalescedEvents ? '✓' : '✗'} (绘画平滑必备)`,
      `  tiltX/tiltY: ${f.pointerEvent ? '✓（触控笔设备）' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. 触控笔压感需设备支持，模拟器无压感',
      '  2. 鼠标 pressure 固定 0/0.5，不能用作真实压感（降级用速度模拟）',
      '  3. 不用 getCoalescedEvents 高刷屏曲线断续',
      '  4. tiltX/tiltY 鼠标/触摸为 0，需判断 pointerType === "pen"',
      '  5. iOS Safari 早期版本 coalesced 支持滞后',
    ].join('\n');
    this.setState({ penInfo: info });
  }

  _renderCard7() {
    const s = this.state;
    const f = this._flags();
    const readoutEl = h('div', { class: 'pt-pen-readout' },
      h('div', { class: 'pt-pen-cell' }, 'type: -'),
      h('div', { class: 'pt-pen-cell' }, 'pressure: -'),
      h('div', { class: 'pt-pen-cell' }, 'tiltX: -'),
      h('div', { class: 'pt-pen-cell' }, 'tiltY: -'),
      h('div', { class: 'pt-pen-cell' }, 'twist: -'),
      h('div', { class: 'pt-pen-cell' }, 'points: 0'),
    );
    let pointCount = 0;
    const canvas = h('canvas', { class: 'pt-canvas', width: 320, height: 180, style: { touchAction: 'none' },
      onPointerDown: (e) => {
        try { if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
        pointCount = 0;
        const ctx = e.currentTarget.getContext && e.currentTarget.getContext('2d');
        if (ctx) {
          ctx.beginPath();
          ctx.moveTo(e.offsetX, e.offsetY);
          ctx.lineWidth = 0.5 + (e.pressure || 0.5) * 4;
          ctx.strokeStyle = '#3b82f6';
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
        }
        pointCount += 1;
        this._updatePenReadout(readoutEl, e, pointCount);
      },
      onPointerMove: (e) => {
        try { if (e.currentTarget.hasPointerCapture && !e.currentTarget.hasPointerCapture(e.pointerId)) return; } catch { /* noop */ }
        const ctx = e.currentTarget.getContext && e.currentTarget.getContext('2d');
        if (ctx) {
          const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
          for (const c of events) {
            ctx.lineWidth = 0.5 + ((c.pressure == null ? e.pressure : c.pressure) || 0.5) * 4;
            ctx.lineTo(c.offsetX == null ? e.offsetX : c.offsetX, c.offsetY == null ? e.offsetY : c.offsetY);
            ctx.stroke();
          }
        }
        pointCount += 1;
        this._updatePenReadout(readoutEl, e, pointCount);
      },
      onPointerUp: (e) => {
        this._updatePenReadout(readoutEl, e, pointCount);
      },
      onPointerLeave: (e) => {
        // 不停止绘制（已 setPointerCapture），仅更新读数
      },
    });
    const codeExample = [
      '// 触控笔：pressure → 粗细，tilt → 笔锋',
      'el.addEventListener("pointermove", (e) => {',
      '  if (e.pointerType !== "pen") return;',
      '  ctx.lineWidth = 0.5 + e.pressure * 8; // 压感粗细',
      '  // getCoalescedEvents 高频采样点平滑曲线',
      '  for (const c of e.getCoalescedEvents()) {',
      '    ctx.lineTo(c.clientX, c.clientY); ctx.stroke();',
      '  }',
      '});',
    ].join('\n');
    const card = new Card({
      title: '7. 触控笔与压感应用（pressure / tilt / twist / coalesced）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['getCoalescedEvents', f.getCoalescedEvents],
          ['触控笔', f.pointerEvent],
        ]),
        h(Tag, { color: 'primary' }, '触控笔'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'pointerType: "pen" 识别触控笔。pressure 压感（0-1）映射画笔粗细/透明度，tiltX/tiltY 倾斜角（-90 到 90）映射笔锋角度（模拟毛笔/铅笔），twist 旋转（0-359，马克笔/喷雾）。getCoalescedEvents() 获取高频采样点（120Hz 屏幕绘制更平滑曲线），贝塞尔曲线二次平滑，移动平均防抖。实战：签名板、绘画应用（Procreate 风格）、手写笔记，对接 Apple Pencil/Surface Pen。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行触控笔演示', { type: 'primary', size: 'sm', onClick: () => this._runPenDemo() }),
        ),
        canvas,
        readoutEl,
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, codeExample)),
        h('div', { class: 'fs-sm text-secondary' }, '完整参考：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.penInfo || '（点击按钮查看触控笔与压感完整参考）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _updatePenReadout(readoutEl, e, count) {
    if (!readoutEl || !readoutEl.children || readoutEl.children.length < 6) return;
    try {
      const cells = readoutEl.children;
      cells[0].textContent = 'type: ' + (e.pointerType || '-');
      cells[1].textContent = 'pressure: ' + (e.pressure == null ? '-' : e.pressure.toFixed(2));
      cells[2].textContent = 'tiltX: ' + (e.tiltX == null ? '-' : e.tiltX);
      cells[3].textContent = 'tiltY: ' + (e.tiltY == null ? '-' : e.tiltY);
      cells[4].textContent = 'twist: ' + (e.twist == null ? '-' : e.twist);
      cells[5].textContent = 'points: ' + count;
    } catch { /* noop */ }
  }

  // ===================== Card 8：实战模式与陷阱 =====================

  _runPatternDemo() {
    const f = this._flags();
    this._addLog(f.setPointerCapture ? 'info' : 'warn', '滑块监听已附加；拖动下方滑块圆点（setPointerCapture 实现）');
    const info = [
      '===== 实战模式与陷阱 =====',
      '',
      '【模式 1：拖拽完整代码（setPointerCapture + transform）】',
      '  function makeDraggable(el) {',
      '    let sx, sy, ox = 0, oy = 0;',
      '    el.style.touchAction = "none";',
      '    el.addEventListener("pointerdown", (e) => {',
      '      el.setPointerCapture(e.pointerId);',
      '      sx = e.clientX; sy = e.clientY;',
      '      ox = parseFloat(el.dataset.x || 0);',
      '      oy = parseFloat(el.dataset.y || 0);',
      '    });',
      '    el.addEventListener("pointermove", (e) => {',
      '      if (!el.hasPointerCapture(e.pointerId)) return;',
      '      const nx = ox + e.clientX - sx;',
      '      const ny = oy + e.clientY - sy;',
      '      el.dataset.x = nx; el.dataset.y = ny;',
      '      el.style.transform = "translate(" + nx + "px," + ny + "px)";',
      '    });',
      '    el.addEventListener("pointerup", () => {}); // 自动释放',
      '  }',
      '',
      '【模式 2：自定义滑块】',
      '  function makeSlider(track, thumb) {',
      '    let dragging = false;',
      '    thumb.style.touchAction = "none";',
      '    const update = (clientX) => {',
      '      const rect = track.getBoundingClientRect();',
      '      const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));',
      '      thumb.style.left = (pct * 100) + "%";',
      '      track.dispatchEvent(new CustomEvent("change", { detail: pct }));',
      '    };',
      '    thumb.addEventListener("pointerdown", (e) => {',
      '      thumb.setPointerCapture(e.pointerId);',
      '      dragging = true;',
      '    });',
      '    thumb.addEventListener("pointermove", (e) => {',
      '      if (!dragging) return;',
      '      update(e.clientX);',
      '    });',
      '    thumb.addEventListener("pointerup", () => dragging = false);',
      '  }',
      '',
      '【模式 3：画板（canvas + pointer 事件 + 平滑曲线）】',
      '  // 详见 Card 7 触控笔压感绘制',
      '  canvas.style.touchAction = "none";',
      '  canvas.addEventListener("pointerdown", (e) => {',
      '    canvas.setPointerCapture(e.pointerId);',
      '    ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY);',
      '  });',
      '  canvas.addEventListener("pointermove", (e) => {',
      '    if (!canvas.hasPointerCapture(e.pointerId)) return;',
      '    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];',
      '    for (const c of events) ctx.lineTo(c.offsetX, c.offsetY);',
      '    ctx.stroke();',
      '  });',
      '',
      '【模式 4：手势识别库设计】',
      '  // 抽象 GestureRecognizer 基类',
      '  class GestureRecognizer {',
      '    onDown(e) {} onMove(e) {} onUp(e) {}',
      '  }',
      '  class PinchRecognizer extends GestureRecognizer { ... }',
      '  class SwipeRecognizer extends GestureRecognizer { ... }',
      '  // 绑定：注册多个识别器，pointer 事件分发给所有识别器',
      '  el.addEventListener("pointerdown", (e) => recognizers.forEach(r => r.onDown(e)));',
      '',
      '【模式 5：响应式交互（鼠标 vs 触摸差异处理）】',
      '  el.addEventListener("pointerdown", (e) => {',
      '    if (e.pointerType === "mouse") {',
      '      // 鼠标：支持 hover 预览、右键菜单',
      '    } else {',
      '      // 触摸/触控笔：无 hover，需长按替代右键',
      '    }',
      '  });',
      '',
      '【陷阱清单】',
      '  1. iOS Safari touch-action 支持滞后（pan-left/right 需 13+）',
      '  2. pointermove 高频触发需节流，或用 getCoalescedEvents 批处理',
      '  3. 300ms 点击延迟已基本消除，但仍需 touch-action: manipulation 保险',
      '  4. pointercancel 必须处理（系统打断如来电/手势冲突），否则状态泄漏',
      '  5. 多指针状态管理用 Map 不用普通对象（避免原型属性冲突）',
      '  6. passive: true 监听性能好但无法 preventDefault，需阻止滚动必须 passive: false',
      '  7. 触控笔压感需设备支持，模拟器/鼠标无真实压感',
      '  8. setPointerCapture 在 pointercancel 时不会自动调你的清理，需手动处理',
      '',
      '【降级方案：不支持 Pointer Events 用 mouse + touch 双监听】',
      '  if (window.PointerEvent) {',
      '    el.addEventListener("pointerdown", handler);',
      '  } else {',
      '    el.addEventListener("mousedown", handler);',
      '    el.addEventListener("touchstart", (e) => {',
      '      const t = e.changedTouches[0];',
      '      handler({ clientX: t.clientX, clientY: t.clientY, pointerId: t.identifier });',
      '    });',
      '  }',
      '',
      '【无障碍：手势需键盘等价操作】',
      '  - 拖拽：键盘 Tab 聚焦 + 方向键移动',
      '  - 滑块：原生 <input type="range"> 或 ARIA slider 角色 + 方向键',
      '  - 双指缩放：提供 + / - 按钮',
      '  - 滑动：提供导航按钮',
      '  // 手势是增强，不能是唯一交互方式',
      '',
      '  <div role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100"',
      '       aria-valuenow="30" onKeyDown={handleArrowKeys}>',
      '',
      '【性能：高频事件节流】',
      '  // pointermove 可能每秒触发数百次',
      '  // 方案 1：requestAnimationFrame 节流',
      '  let pending = false; let lastEvent;',
      '  el.addEventListener("pointermove", (e) => {',
      '    lastEvent = e;',
      '    if (pending) return;',
      '    pending = true;',
      '    requestAnimationFrame(() => {',
      '      handleMove(lastEvent);',
      '      pending = false;',
      '    });',
      '  });',
      '  // 方案 2：getCoalescedEvents 一次处理所有采样点（更平滑）',
      '',
      '【浏览器支持】',
      `  PointerEvent: ${f.pointerEvent ? '✓' : '✗'}`,
      `  setPointerCapture: ${f.setPointerCapture ? '✓' : '✗'}`,
      `  touch-action: ${f.touchAction ? '✓' : '✗'}`,
      '',
      '【资源】',
      '  - Pointer Events 规范：https://www.w3.org/TR/pointerevents3/',
      '  - Touch Events 规范：https://www.w3.org/TR/touch-events/',
      '  - MDN PointerEvent：https://developer.mozilla.org/docs/Web/API/PointerEvent',
      '  - MDN Touch Events：https://developer.mozilla.org/docs/Web/API/Touch_events',
      '  - 手势识别库：https://hammerjs.github.io/',
    ].join('\n');
    this.setState({ patternInfo: info });
  }

  _renderCard8() {
    const s = this.state;
    const f = this._flags();
    const sliderStatus = h('div', { class: 'pt-status' }, '滑块演示：拖动下方圆点（setPointerCapture 实现，移出轨道仍持续）');
    const fillEl = h('div', { class: 'pt-slider__fill' });
    const thumbEl = h('div', { class: 'pt-slider__thumb', style: { touchAction: 'none' },
      onPointerDown: (e) => {
        try { if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
        this._sliderDragging = true;
        sliderStatus.textContent = 'pointerdown 捕获 slider，拖动中...';
      },
      onPointerMove: (e) => {
        if (!this._sliderDragging) return;
        const track = e.currentTarget.parentElement;
        const trackRect = track.getBoundingClientRect();
        const thumbRect = e.currentTarget.getBoundingClientRect();
        const pct = Math.min(1, Math.max(0, (e.clientX - trackRect.left - thumbRect.width / 2) / (trackRect.width - thumbRect.width)));
        const pctStr = (pct * 100).toFixed(1);
        e.currentTarget.style.left = 'calc(' + pctStr + '% + ' + (thumbRect.width / 2) + 'px)';
        fillEl.style.width = pctStr + '%';
        sliderStatus.textContent = 'slider 值=' + pctStr + ' · pointerId=' + e.pointerId + ' type=' + (e.pointerType || '?');
      },
      onPointerUp: (e) => {
        this._sliderDragging = false;
        sliderStatus.textContent = 'pointerup 释放 slider，拖动结束';
      },
      onPointerCancel: (e) => {
        this._sliderDragging = false;
        sliderStatus.textContent = 'pointercancel slider 已清理';
      },
    });
    const trackEl = h('div', { class: 'pt-slider__track' }, fillEl, thumbEl);
    const codeExample = [
      '// 完整拖拽：setPointerCapture + transform',
      'function makeDraggable(el) {',
      '  let sx, sy, ox = 0, oy = 0;',
      '  el.style.touchAction = "none";',
      '  el.addEventListener("pointerdown", (e) => {',
      '    el.setPointerCapture(e.pointerId);',
      '    sx = e.clientX; sy = e.clientY;',
      '    ox = parseFloat(el.dataset.x || 0);',
      '  });',
      '  el.addEventListener("pointermove", (e) => {',
      '    if (!el.hasPointerCapture(e.pointerId)) return;',
      '    el.style.transform = "translate(" + (ox + e.clientX - sx) + "px,0)";',
      '  });',
      '}',
    ].join('\n');
    const card = new Card({
      title: '8. 实战模式与陷阱（拖拽 / 滑块 / 画板 / 降级 / 无障碍 / 陷阱清单）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, '实战'),
        h(Tag, { color: f.setPointerCapture ? 'success' : 'error' }, `setPointerCapture ${f.setPointerCapture ? '✓' : '✗'}`),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '完整模式：拖拽（setPointerCapture + transform）、自定义滑块、画板（canvas + pointer + 平滑曲线）、手势识别库设计、响应式交互（鼠标 vs 触摸差异）。陷阱清单：iOS Safari touch-action 滞后 / pointermove 高频需节流或 getCoalescedEvents / 300ms 延迟需 touch-action: manipulation / pointercancel 必须处理 / 多指针用 Map / passive: true 无法 preventDefault / 触控笔压感需设备支持。降级：不支持 Pointer Events 用 mouse + touch 双监听。无障碍：手势需键盘等价操作。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行实战模式演示', { type: 'primary', size: 'sm', onClick: () => this._runPatternDemo() }),
        ),
        h('div', { class: 'pt-slider' }, trackEl),
        sliderStatus,
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, codeExample)),
        h('div', { class: 'fs-sm text-secondary' }, '完整参考：'),
        h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.patternInfo || '（点击按钮查看实战模式与陷阱完整参考）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderLogPanel() {
    const s = this.state;
    if (!s.logs || s.logs.length === 0) return null;
    return h(Card, { title: '运行日志' },
      h('div', { class: 'log-list' },
        ...s.logs.map((log) =>
          h('div', { class: `log-item log-${log.type}` },
            h('span', { class: 'log-time' }, log.time),
            h('span', { class: 'log-content' }, log.content),
          ),
        ),
      ),
    );
  }

  renderPage() {
    const s = this.state;
    return [
      h('h2', { class: 'section-title' }, 'Pointer & Touch Events 指针与触摸事件深度实验室'),

      h(Alert, {
        type: 'info',
        message: 'Pointer Events Level 2 + Touch Events API + 手势识别 —— 跨设备统一输入处理',
        description: '演示 Pointer Events（W3C Pointer Events Level 2）统一鼠标/触摸/触控笔为单一 API（pointerdown/move/up/cancel/over/out/enter/leave，pointerType: mouse|touch|pen 区分设备）、PointerEvent 属性全集（pointerId 多指针跟踪/width/height 接触区域/pressure 压力 0-1/tiltX/tiltY 倾斜角/twist 旋转/isPrimary 主指针/getCoalescedEvents 高刷屏合并事件/getPredictedEvents 预测事件）、setPointerCapture 指针捕获（拖拽到元素外仍持续接收事件，替代废弃的 setCapture）、Touch Events API（touchstart/move/end/cancel + touches/targetTouches/changedTouches + Touch 对象 identifier/radiusX/force）、touch-action CSS 属性（auto/none/pan-x/pan-y/pin-zoom/manipulation 控制默认手势，消除 300ms 延迟）、多点触控与手势识别（pinch 缩放/rotate 旋转/swipe 滑动/long press/double tap/drag + 状态机 idle→detecting→active→end + 用 Map 缓存 pointerId）、触控笔与压感应用（pressure 映射粗细/tilt 映射笔锋/twist 旋转/getCoalescedEvents 平滑/贝塞尔曲线/签名板/Procreate 风格绘画/Apple Pencil/Surface Pen）、实战模式与陷阱（拖拽/滑块/画板完整代码 + 降级方案 mouse+touch 双监听 + 无障碍键盘等价 + 陷阱清单 iOS Safari 滞后/pointercancel 必处理/多指针用 Map/passive 性能）。用 typeof PointerEvent/TouchEvent + ontouchstart in window + Element.prototype.setPointerCapture + CSS.supports 检测，jsdom 不模拟真实指针输入但附加监听器 + 注入演示样式，真实浏览器可查看完整交互。',
      }),

      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,

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
    ];
  }
}
