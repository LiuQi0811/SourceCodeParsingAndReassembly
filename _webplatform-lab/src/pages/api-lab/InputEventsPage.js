// InputEventsPage.js —— 输入事件系统 API 实验室
// 演示 MDN：Pointer Events（统一指针）、Touch Events（触摸）、
//           Keyboard Events（键盘 key/code/location）、Gamepad API（游戏手柄）、
//           InputDeviceCapabilities + 事件模型对比
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// 日志类型 → 标签 CSS 类映射
const LOG_TAG_CLASS = {
  pointer: 'push',
  touch: 'pop',
  key: 'mutate',
  gamepad: 'perf',
  compare: 'lc',
  info: 'info',
  error: 'error',
};

// Mouse / Touch / Pointer 事件模型对比表数据
const COMPARISON_TABLE = [
  { feature: '事件名', mouse: 'mousedown/move/up', touch: 'touchstart/move/end', pointer: 'pointerdown/move/up' },
  { feature: '多点触控', mouse: '✗', touch: '✓ (touches)', pointer: '✓ (pointerId)' },
  { feature: '压力检测', mouse: '✗', touch: 'force', pointer: 'pressure' },
  { feature: '倾斜角', mouse: '✗', touch: '✗', pointer: 'tiltX / tiltY' },
  { feature: '指针类型', mouse: '✗', touch: '✗', pointer: 'pointerType' },
  { feature: '接触区域', mouse: '✗', touch: 'radiusX/Y', pointer: 'width / height' },
  { feature: '统一接口', mouse: '✗', touch: '✗', pointer: '✓' },
];

// 对比表表头样式
const TH_STYLE = {
  padding: '8px 10px',
  textAlign: 'left',
  borderBottom: '2px solid var(--color-border)',
  background: 'var(--color-bg-spotlight)',
  fontSize: '13px',
};

// 对比表单元格样式
const TD_STYLE = {
  padding: '8px 10px',
  borderBottom: '1px solid var(--color-border-secondary)',
  fontSize: '13px',
};

export class InputEventsPage extends Page {
  initialState() {
    return {
      logs: [],
      pointerInfo: '尚未在区域内操作',
      pointerTrail: [],
      touchInfo: '设备不支持触摸事件或尚未触摸',
      touchTrail: [],
      keyInfo: '点击下方区域并按键',
      keyHistory: [],
      gamepadConnected: false,
      gamepadInfo: '未连接游戏手柄',
      gamepadState: null,
      eventComparison: [],
    };
  }

  componentDidMount() {
    // —— 1. Pointer Events ——
    this._setupPointer();
    // —— 2. Touch Events ——
    this._setupTouch();
    // —— 3. Keyboard Events ——
    this._setupKeyboard();
    // —— 4. Gamepad API ——
    this._setupGamepad();
    // —— 5. 事件对比 ——
    this._setupComparison();
  }

  componentWillUnmount() {
    // 取消游戏手柄轮询
    if (this._gamepadRaf) {
      cancelAnimationFrame(this._gamepadRaf);
      this._gamepadRaf = null;
    }
    // 清理对比批量刷新定时器
    if (this._compareFlushTimer) {
      clearTimeout(this._compareFlushTimer);
      this._compareFlushTimer = null;
    }
    // 注：通过 this.on() 注册的事件监听由基类 destroy 统一移除
  }

  _addLog(type, content) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // ==================== 1. Pointer Events ====================

  _setupPointer() {
    const area = this.$('.pointer-area');
    if (!area) return;
    this._pointerArea = area;
    this._pointerPoints = this._pointerPoints || [];
    this._lastPointerMoveState = 0;
    this._initPointerCanvas();

    // 监听五种指针事件
    this.on(area, 'pointerdown', (e) => this._onPointerDown(e));
    this.on(area, 'pointermove', (e) => this._onPointerMove(e));
    this.on(area, 'pointerup', (e) => this._onPointerEvent(e, 'pointerup'));
    this.on(area, 'pointercancel', (e) => this._onPointerEvent(e, 'pointercancel'));
    this.on(area, 'pointerleave', (e) => this._onPointerEvent(e, 'pointerleave'));
  }

  // 初始化指针画布：设置尺寸、2D context、样式，并重绘已有轨迹
  _initPointerCanvas() {
    const canvas = this.$('.pointer-canvas');
    if (!canvas) return;
    this._pointerCanvas = canvas;
    canvas.width = canvas.offsetWidth || 600;
    canvas.height = canvas.offsetHeight || 200;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1677ff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this._pointerCtx = ctx;
    this._redrawPointerTrail();
  }

  // 确保获取有效的 2D context（重渲染后画布会被替换）
  _ensurePointerCtx() {
    if (this._pointerCanvas && this._pointerCanvas.isConnected) return this._pointerCtx;
    this._initPointerCanvas();
    return this._pointerCtx;
  }

  // 从实例变量 _pointerPoints 重绘全部轨迹
  _redrawPointerTrail() {
    if (!this._pointerCtx || !this._pointerPoints) return;
    const ctx = this._pointerCtx;
    ctx.clearRect(0, 0, this._pointerCanvas.width, this._pointerCanvas.height);
    if (this._pointerPoints.length === 0) return;
    ctx.beginPath();
    this._pointerPoints.forEach((p, i) => {
      if (p.break || i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
  }

  // 计算指针相对于画布的坐标
  _pointerCoords(e) {
    const rect = this._pointerCanvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  _onPointerDown(e) {
    // setPointerCapture：将后续指针事件锁定到该元素，即使指针移出区域仍持续接收
    try { this._pointerArea.setPointerCapture(e.pointerId); } catch { /* noop */ }
    const { x, y } = this._pointerCoords(e);
    this._pointerPoints = this._pointerPoints || [];
    this._pointerPoints.push({ x, y, break: true });
    // 控制轨迹点数量
    if (this._pointerPoints.length > 1000) this._pointerPoints = this._pointerPoints.slice(-500);
    const ctx = this._ensurePointerCtx();
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
    this._updatePointerInfo(e, 'pointerdown');
    this._addLog('pointer', `pointerdown type=${e.pointerType} id=${e.pointerId} primary=${e.isPrimary}`);
  }

  _onPointerMove(e) {
    const ctx = this._ensurePointerCtx();
    if (!ctx) return;
    const { x, y } = this._pointerCoords(e);
    // 用 lineTo + stroke 绘制轨迹
    ctx.lineTo(x, y);
    ctx.stroke();
    this._pointerPoints = this._pointerPoints || [];
    this._pointerPoints.push({ x, y });
    if (this._pointerPoints.length > 1000) this._pointerPoints = this._pointerPoints.slice(-500);
    // 节流更新状态（避免高频 pointermove 导致频繁重渲染）
    const now = performance.now();
    if (now - this._lastPointerMoveState > 80) {
      this._lastPointerMoveState = now;
      this._updatePointerInfo(e, 'pointermove');
    }
  }

  _onPointerEvent(e, phase) {
    this._updatePointerInfo(e, phase);
    this._addLog('pointer', `${phase} id=${e.pointerId}`);
  }

  // 构建指针信息文本：pointerType / pointerId / isPrimary / pressure / tiltX/tiltY / width/height / clientX/clientY
  _updatePointerInfo(e, phase) {
    const info = [
      `[${phase}]`,
      `pointerType: ${e.pointerType}`,
      `pointerId: ${e.pointerId}`,
      `isPrimary: ${e.isPrimary}`,
      `pressure: ${e.pressure.toFixed(3)}`,
      `tiltX: ${e.tiltX}° / tiltY: ${e.tiltY}°`,
      `width × height: ${e.width.toFixed(1)} × ${e.height.toFixed(1)}`,
      `clientX: ${e.clientX}, clientY: ${e.clientY}`,
    ].join('\n');
    this.setState({
      pointerInfo: info,
      pointerTrail: [...this._pointerPoints].slice(-50),
    });
  }

  _clearPointerTrail() {
    this._pointerPoints = [];
    const ctx = this._ensurePointerCtx();
    if (ctx) ctx.clearRect(0, 0, this._pointerCanvas.width, this._pointerCanvas.height);
    this.setState({ pointerTrail: [] });
    this._addLog('pointer', '已清空指针轨迹');
  }

  // ==================== 2. Touch Events ====================

  _setupTouch() {
    const area = this.$('.touch-area');
    if (!area) return;
    // 能力检测：桌面浏览器可能无触摸事件
    const supported = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this._touchSupported = supported;
    if (!supported) return;

    this._touchArea = area;
    this._touchPoints = {}; // { identifier: [{x, y}, ...] }
    this._lastTouchMoveState = 0;
    this._initTouchCanvas();

    // 监听四种触摸事件
    this.on(area, 'touchstart', (e) => this._onTouchStart(e));
    this.on(area, 'touchmove', (e) => this._onTouchMove(e));
    this.on(area, 'touchend', (e) => this._onTouchEnd(e, 'touchend'));
    this.on(area, 'touchcancel', (e) => this._onTouchEnd(e, 'touchcancel'));
  }

  _initTouchCanvas() {
    const canvas = this.$('.touch-canvas');
    if (!canvas) return;
    this._touchCanvas = canvas;
    canvas.width = canvas.offsetWidth || 600;
    canvas.height = canvas.offsetHeight || 200;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this._touchCtx = ctx;
    // 多指触控用不同颜色区分
    this._touchColors = ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2'];
    this._redrawTouchTrail();
  }

  _ensureTouchCtx() {
    if (this._touchCanvas && this._touchCanvas.isConnected) return this._touchCtx;
    this._initTouchCanvas();
    return this._touchCtx;
  }

  // 重绘所有触摸轨迹（按 identifier 分色）
  _redrawTouchTrail() {
    if (!this._touchCtx || !this._touchPoints) return;
    const ctx = this._touchCtx;
    ctx.clearRect(0, 0, this._touchCanvas.width, this._touchCanvas.height);
    Object.entries(this._touchPoints).forEach(([id, points]) => {
      if (points.length === 0) return;
      const colorIdx = parseInt(id, 10) % this._touchColors.length;
      ctx.strokeStyle = this._touchColors[colorIdx];
      ctx.beginPath();
      points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    });
  }

  _touchCoords(touch) {
    const rect = this._touchCanvas.getBoundingClientRect();
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }

  _onTouchStart(e) {
    // 阻止默认行为（滚动、缩放等）
    e.preventDefault();
    Array.from(e.changedTouches).forEach((t) => {
      const { x, y } = this._touchCoords(t);
      this._touchPoints[t.identifier] = [{ x, y }];
    });
    this._updateTouchInfo(e, 'touchstart');
    this._addLog('touch', `touchstart touches=${e.touches.length} changed=${e.changedTouches.length} target=${e.targetTouches.length}`);
  }

  _onTouchMove(e) {
    e.preventDefault();
    Array.from(e.changedTouches).forEach((t) => {
      const { x, y } = this._touchCoords(t);
      if (!this._touchPoints[t.identifier]) this._touchPoints[t.identifier] = [];
      this._touchPoints[t.identifier].push({ x, y });
      // 用 lineTo + stroke 绘制当前线段
      const ctx = this._ensureTouchCtx();
      if (ctx) {
        const colorIdx = t.identifier % this._touchColors.length;
        ctx.strokeStyle = this._touchColors[colorIdx];
        const pts = this._touchPoints[t.identifier];
        if (pts.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      }
    });
    // 节流更新状态
    const now = performance.now();
    if (now - this._lastTouchMoveState > 80) {
      this._lastTouchMoveState = now;
      this._updateTouchInfo(e, 'touchmove');
    }
  }

  _onTouchEnd(e, phase) {
    Array.from(e.changedTouches).forEach((t) => {
      delete this._touchPoints[t.identifier];
    });
    this._updateTouchInfo(e, phase);
    this._addLog('touch', `${phase} remaining=${e.touches.length}`);
  }

  // 构建触摸信息：touches / changedTouches / targetTouches 区别，每个 touch 的 identifier/force/radius
  _updateTouchInfo(e, phase) {
    const touches = Array.from(e.touches);
    const changed = Array.from(e.changedTouches);
    const target = Array.from(e.targetTouches);
    const lines = [
      `[${phase}]`,
      `touches=${touches.length}  changedTouches=${changed.length}  targetTouches=${target.length}`,
    ];
    touches.forEach((t, i) => {
      lines.push(
        `  #${i} id=${t.identifier} (${t.clientX.toFixed(0)},${t.clientY.toFixed(0)}) force=${t.force.toFixed(2)} radius=${t.radiusX.toFixed(0)}×${t.radiusY.toFixed(0)}`,
      );
    });
    if (lines.length === 2) lines.push('  （当前无活跃触点）');
    // 收集所有轨迹点用于状态展示
    const allPoints = Object.values(this._touchPoints).flat();
    this.setState({
      touchInfo: lines.join('\n'),
      touchTrail: allPoints.slice(-50),
    });
  }

  _clearTouchTrail() {
    this._touchPoints = {};
    const ctx = this._ensureTouchCtx();
    if (ctx) ctx.clearRect(0, 0, this._touchCanvas.width, this._touchCanvas.height);
    this.setState({ touchTrail: [] });
    this._addLog('touch', '已清空触摸轨迹');
  }

  // ==================== 3. Keyboard Events ====================

  _setupKeyboard() {
    const area = this.$('.keyboard-area');
    if (!area) return;
    this._keyboardArea = area;
    // 重渲染后键盘区域会被替换，需要重新聚焦
    // _keyboardNeedsFocus 标记：仅在键盘交互后重新聚焦，避免抢占其他区域焦点
    if (this._keyboardNeedsFocus || !this._keyboardDidFocus) {
      try { area.focus({ preventScroll: true }); } catch { area.focus(); }
      this._keyboardDidFocus = true;
      this._keyboardNeedsFocus = false;
    }
    this.on(area, 'keydown', (e) => this._onKeyDown(e));
    this.on(area, 'keyup', (e) => this._onKeyUp(e));
  }

  _onKeyDown(e) {
    // 组合键检测：Ctrl+S 阻止浏览器默认保存行为
    let combo = '';
    if (e.ctrlKey && typeof e.key === 'string' && e.key.toLowerCase() === 's') {
      e.preventDefault();
      combo = '  → 已拦截 Ctrl+S（preventDefault）';
      this._addLog('key', `组合键 Ctrl+S 检测到，已 preventDefault`);
    }

    // key（逻辑键名）vs code（物理键码）：不同键盘布局下 code 相同但 key 可能不同
    const info = [
      `[keydown]`,
      `key: "${e.key}"    (逻辑键名，受布局影响)`,
      `code: "${e.code}"    (物理键码，布局无关)`,
      `keyCode: ${e.keyCode}    (已废弃，仅展示对比)`,
      `location: ${e.location}    (0=标准 1=左 2=右 3=数字键盘)`,
      `repeat: ${e.repeat}`,
      `修饰键: ctrl=${e.ctrlKey} shift=${e.shiftKey} alt=${e.altKey} meta=${e.metaKey}`,
      combo,
    ].join('\n');

    const histEntry = { key: e.key, code: e.code, time: formatTime() };
    this._keyboardNeedsFocus = true;
    this.setState({
      keyInfo: info,
      keyHistory: [...this.state.keyHistory, histEntry].slice(-12),
    });
    if (!e.repeat) {
      this._addLog('key', `keydown key="${e.key}" code="${e.code}" location=${e.location}`);
    }
  }

  _onKeyUp(e) {
    const info = [
      `[keyup]`,
      `key: "${e.key}"`,
      `code: "${e.code}"`,
      `keyCode: ${e.keyCode}`,
      `repeat: ${e.repeat}`,
    ].join('\n');
    this._keyboardNeedsFocus = true;
    this.setState({ keyInfo: info });
  }

  // ==================== 4. Gamepad API ====================

  _setupGamepad() {
    // 监听手柄连接/断开事件
    this.on(window, 'gamepadconnected', (e) => this._onGamepadConnected(e));
    this.on(window, 'gamepaddisconnected', (e) => this._onGamepadDisconnected(e));

    // 首次检查已连接的手柄（需用户先按下按钮才会出现在列表中）
    if (!this._gamepadInitChecked) {
      this._gamepadInitChecked = true;
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const connected = Array.from(pads).filter(Boolean);
      if (connected.length > 0) {
        this._onGamepadConnected({ gamepad: connected[0] });
      }
    }
  }

  _onGamepadConnected(e) {
    const pad = e.gamepad;
    const info = [
      `已连接游戏手柄`,
      `id: ${pad.id}`,
      `index: ${pad.index}`,
      `mapping: ${pad.mapping}`,
      `axes: ${pad.axes.length} 个`,
      `buttons: ${pad.buttons.length} 个`,
    ].join('\n');
    this.setState({ gamepadConnected: true, gamepadInfo: info });
    this._addLog('gamepad', `手柄已连接: ${pad.id}`);
    this._startGamepadPoll();
  }

  _onGamepadDisconnected(e) {
    this._stopGamepadPoll();
    this.setState({
      gamepadConnected: false,
      gamepadInfo: '未连接游戏手柄',
      gamepadState: null,
    });
    this._addLog('gamepad', `手柄已断开: ${e.gamepad.id}`);
  }

  // 手柄事件不会持续触发，需要用 requestAnimationFrame 轮询状态
  _startGamepadPoll() {
    if (this._gamepadRaf) return; // 已在轮询
    this._lastGamepadState = 0;
    const poll = () => {
      this._pollGamepad();
      this._gamepadRaf = requestAnimationFrame(poll);
    };
    this._gamepadRaf = requestAnimationFrame(poll);
  }

  _stopGamepadPoll() {
    if (this._gamepadRaf) {
      cancelAnimationFrame(this._gamepadRaf);
      this._gamepadRaf = null;
    }
  }

  _pollGamepad() {
    if (!this.state.gamepadConnected) return;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = Array.from(pads).find(Boolean);
    if (!pad) return;
    // 节流状态更新（约 10fps，避免高频重渲染影响性能）
    const now = performance.now();
    if (now - this._lastGamepadState < 100) return;
    this._lastGamepadState = now;
    this.setState({
      gamepadState: {
        id: pad.id,
        index: pad.index,
        mapping: pad.mapping,
        axes: Array.from(pad.axes),
        buttons: pad.buttons.map((b) => ({
          pressed: b.pressed,
          value: b.value,
          touched: b.touched,
        })),
      },
    });
  }

  // ==================== 5. InputDeviceCapabilities + 事件对比 ====================

  _setupComparison() {
    const area = this.$('.comparison-area');
    if (!area) return;
    this._compareBatch = [];
    this._preventDefaultCompare = false;

    // 同一区域同时监听 pointerdown / touchstart / mousedown，观察触发顺序
    this.on(area, 'pointerdown', (e) => this._onComparePointerDown(e));
    this.on(area, 'touchstart', (e) => this._onCompareTouchStart(e));
    this.on(area, 'mousedown', (e) => this._onCompareMouseDown(e));
  }

  _togglePreventDefault() {
    this._preventDefaultCompare = !this._preventDefaultCompare;
    this._addLog('compare', `preventDefault 已${this._preventDefaultCompare ? '开启' : '关闭'}（在 pointerdown 上阻止后续鼠标/触摸兼容事件）`);
  }

  // InputDeviceCapabilities：pointerType 的来源（部分浏览器支持）
  _getDeviceCapabilities(e) {
    const caps = e.sourceCapabilities;
    if (!caps) return '不支持 InputDeviceCapabilities';
    const parts = ['InputDeviceCapabilities'];
    if ('fireTouchEvents' in caps) parts.push(`fireTouchEvents=${caps.fireTouchEvents}`);
    return parts.join(' ');
  }

  // pointerdown 最先触发，作为每次交互的起点
  _onComparePointerDown(e) {
    this._compareBatchStart = performance.now();
    this._compareBatch = [{
      type: 'pointerdown',
      time: 0,
      device: e.pointerType,
      caps: this._getDeviceCapabilities(e),
    }];
    // 开启 preventDefault 时阻止后续兼容事件（mousedown/touchstart）
    if (this._preventDefaultCompare) {
      e.preventDefault();
      this._compareBatch[0].prevented = true;
    }
    clearTimeout(this._compareFlushTimer);
    this._compareFlushTimer = setTimeout(() => this._flushCompareBatch(), 300);
  }

  _onCompareTouchStart(e) {
    if (!this._compareBatch || this._compareBatch.length === 0) return;
    const t = performance.now() - this._compareBatchStart;
    this._compareBatch.push({ type: 'touchstart', time: t });
    if (this._preventDefaultCompare) e.preventDefault();
  }

  _onCompareMouseDown(e) {
    if (!this._compareBatch || this._compareBatch.length === 0) return;
    const t = performance.now() - this._compareBatchStart;
    this._compareBatch.push({ type: 'mousedown', time: t });
  }

  // 300ms 内无新事件则刷新批量结果到状态
  _flushCompareBatch() {
    if (!this._compareBatch || this._compareBatch.length === 0) return;
    const batch = [...this._compareBatch];
    this._compareBatch = [];
    const order = batch.map((b) => `${b.type}(${b.time.toFixed(1)}ms)`).join(' → ');
    this.setState({ eventComparison: batch });
    this._addLog('compare', `事件顺序: ${order}`);
  }

  // ==================== renderPage ====================

  renderPage() {
    const gs = this.state.gamepadState;
    // 触摸能力检测（每次渲染实时判断）
    const touchSupported = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    return [
      h('h2', { class: 'section-title' }, '输入事件系统 API 实验室'),

      h(Alert, {
        type: 'info',
        message: 'Pointer Events / Touch Events / Keyboard Events / Gamepad API / InputDeviceCapabilities',
        description: 'Pointer Events 统一了鼠标、触摸、手写笔；Touch Events 是早期触摸 API；Gamepad API 需连接手柄并轮询状态。所有区域均可真实交互。',
      }),

      // —— 1. Pointer Events ——
      h(Card, {
        title: 'Pointer Events 统一指针事件',
        extra: h(Tag, { color: 'primary' }, `${this.state.pointerTrail.length} 点`),
      },
        h('p', { class: 'fs-sm text-secondary' }, '在下方区域按下并拖动指针（鼠标 / 触摸 / 手写笔）。演示 pointerType / pointerId / isPrimary / pressure / tiltX·tiltY / width·height，以及 setPointerCapture 指针捕获与 canvas 轨迹绘制。'),
        h('div', { class: 'flex gap-sm mt-sm' },
          this._btn('清空轨迹', { size: 'sm', onClick: () => this._clearPointerTrail() }),
        ),
        h('div', {
          class: 'pointer-area',
          style: {
            height: '200px',
            border: '2px dashed var(--color-border)',
            borderRadius: 'var(--radius-base)',
            position: 'relative',
            overflow: 'hidden',
            touchAction: 'none',
            marginTop: 'var(--spacing-sm)',
          },
        },
          h('canvas', { class: 'pointer-canvas', style: { width: '100%', height: '100%', display: 'block' } }),
          h('div', { style: { position: 'absolute', top: '8px', left: '12px', color: 'var(--color-text-tertiary)', fontSize: '12px', pointerEvents: 'none' } }, 'pointer-area（在此交互）'),
        ),
        h('pre', { class: 'code-block mt-sm', style: { whiteSpace: 'pre-wrap', fontSize: '12px', margin: 0 } }, this.state.pointerInfo),
      ),

      // —— 2. Touch Events ——
      h(Card, {
        title: 'Touch Events 触摸事件',
        extra: h(Tag, { color: touchSupported ? 'success' : 'default' }, touchSupported ? '支持' : '不支持'),
      },
        h('p', { class: 'fs-sm text-secondary' }, 'Touch Events 是早期触摸 API，通过 touches / changedTouches / targetTouches 处理多指触控。现代推荐使用 Pointer Events 作为统一方案。'),
        !touchSupported
          ? h(Alert, { type: 'warning', message: '当前设备不支持触摸事件', description: "'ontouchstart' in window 检测为 false。需要触摸屏设备或开启浏览器 DevTools 触摸模拟。" })
          : h('div', {},
              h('div', { class: 'flex gap-sm mt-sm' },
                this._btn('清空轨迹', { size: 'sm', onClick: () => this._clearTouchTrail() }),
              ),
              h('div', {
                class: 'touch-area',
                style: {
                  height: '200px',
                  border: '2px dashed var(--color-border)',
                  borderRadius: 'var(--radius-base)',
                  position: 'relative',
                  overflow: 'hidden',
                  touchAction: 'none',
                  marginTop: 'var(--spacing-sm)',
                },
              },
                h('canvas', { class: 'touch-canvas', style: { width: '100%', height: '100%', display: 'block' } }),
                h('div', { style: { position: 'absolute', top: '8px', left: '12px', color: 'var(--color-text-tertiary)', fontSize: '12px', pointerEvents: 'none' } }, 'touch-area（多指触摸）'),
              ),
              h('pre', { class: 'code-block mt-sm', style: { whiteSpace: 'pre-wrap', fontSize: '12px', margin: 0 } }, this.state.touchInfo),
            ),
      ),

      // —— 3. Keyboard Events ——
      h(Card, {
        title: 'Keyboard Events 键盘事件',
        extra: h(Tag, { color: 'primary' }, `${this.state.keyHistory.length} 次`),
      },
        h('p', { class: 'fs-sm text-secondary' }, '点击下方区域聚焦后按键。演示 key（逻辑键名）vs code（物理键码）、location、repeat、修饰键，以及 Ctrl+S 组合键拦截。'),
        h('div', {
          class: 'keyboard-area',
          tabindex: '0',
          style: {
            height: '80px',
            border: '2px solid var(--color-primary)',
            borderRadius: 'var(--radius-base)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-primary)',
            marginTop: 'var(--spacing-sm)',
            outline: 'none',
            cursor: 'text',
            fontWeight: 600,
          },
        }, '点击此处聚焦，然后按任意键'),
        h('pre', { class: 'code-block mt-sm', style: { whiteSpace: 'pre-wrap', fontSize: '12px', margin: 0 } }, this.state.keyInfo),
        // 按键历史
        this.state.keyHistory.length > 0 && h('div', { class: 'log-panel mt-sm', style: { maxHeight: '120px' } },
          ...this.state.keyHistory.map((k) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, k.time),
            h('span', { class: 'log-panel__tag log-panel__tag--mutate' }, 'key'),
            h('span', {}, `key="${k.key}"  code="${k.code}"`),
          )),
        ),
      ),

      // —— 4. Gamepad API ——
      h(Card, {
        title: 'Gamepad API 游戏手柄',
        extra: h(Tag, { color: this.state.gamepadConnected ? 'success' : 'default' }, this.state.gamepadConnected ? '已连接' : '未连接'),
      },
        h('p', { class: 'fs-sm text-secondary' }, '连接手柄并按任意按钮触发 gamepadconnected 事件。手柄状态需要用 requestAnimationFrame 轮询（事件不会持续触发）。'),
        h('pre', { class: 'code-block mt-sm', style: { whiteSpace: 'pre-wrap', fontSize: '12px', margin: 0 } }, this.state.gamepadInfo),
        // 手柄状态可视化
        gs && h('div', { class: 'mt-sm' },
          // 摇杆轴值可视化
          h('div', { class: 'fs-sm text-secondary', style: { marginBottom: '4px' } }, 'Axes 摇杆轴值：'),
          h('div', { class: 'flex flex-col gap-sm' },
            ...gs.axes.map((v, i) => h('div', { class: 'flex items-center', style: { gap: '8px', fontSize: '12px' } },
              h('span', { style: { width: '60px', fontFamily: 'var(--font-family-mono)' } }, `Axis ${i}`),
              h('div', { style: { flex: '1', height: '8px', background: 'var(--color-bg-spotlight)', borderRadius: '4px', position: 'relative', overflow: 'hidden' } },
                h('div', { style: { position: 'absolute', left: '50%', top: '0', width: '1px', height: '100%', background: 'var(--color-border)' } }),
                h('div', { style: {
                  position: 'absolute',
                  left: `${50 + v * 50}%`,
                  top: '0',
                  width: '4px',
                  height: '100%',
                  background: 'var(--color-primary)',
                  borderRadius: '2px',
                  transform: 'translateX(-2px)',
                  transition: 'left 0.1s linear',
                } }),
              ),
              h('span', { style: { width: '50px', textAlign: 'right', fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-tertiary)' } }, v.toFixed(3)),
            )),
          ),
          // 按钮状态可视化
          h('div', { class: 'fs-sm text-secondary', style: { marginTop: '12px', marginBottom: '4px' } }, 'Buttons 按钮状态：'),
          h('div', { class: 'flex', style: { flexWrap: 'wrap', gap: '6px' } },
            ...gs.buttons.map((b, i) => h('div', {
              style: {
                width: '36px',
                height: '36px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontFamily: 'var(--font-family-mono)',
                border: b.pressed ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                background: b.pressed ? 'var(--color-primary)' : b.touched ? 'var(--color-primary-bg)' : 'var(--color-bg-spotlight)',
                color: b.pressed ? '#fff' : 'var(--color-text-secondary)',
                transition: 'all 0.1s',
              },
              title: `Button ${i}: pressed=${b.pressed} value=${b.value.toFixed(2)} touched=${b.touched}`,
            }, String(i))),
          ),
        ),
        !this.state.gamepadConnected && h('p', { class: 'fs-sm text-tertiary mt-sm' }, '提示：连接手柄后按下任意按钮，将触发 gamepadconnected 事件。'),
      ),

      // —— 5. InputDeviceCapabilities + 事件对比 ——
      h(Card, {
        title: 'InputDeviceCapabilities + 事件模型对比',
        extra: h(Tag, { color: this._preventDefaultCompare ? 'error' : 'default' }, this._preventDefaultCompare ? 'preventDefault 开' : 'preventDefault 关'),
      },
        h('p', { class: 'fs-sm text-secondary' }, '同一区域同时监听 pointerdown / touchstart / mousedown，观察事件触发顺序。开启 preventDefault 可在 pointerdown 上阻止后续兼容事件。'),
        h('div', { class: 'flex gap-sm mt-sm' },
          this._btn(this._preventDefaultCompare ? '关闭 preventDefault' : '开启 preventDefault', {
            size: 'sm',
            type: this._preventDefaultCompare ? 'default' : 'primary',
            onClick: () => this._togglePreventDefault(),
          }),
        ),
        h('div', {
          class: 'comparison-area',
          style: {
            height: '100px',
            border: '2px dashed var(--color-border)',
            borderRadius: 'var(--radius-base)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-tertiary)',
            marginTop: 'var(--spacing-sm)',
            touchAction: 'none',
            userSelect: 'none',
          },
        }, '在此区域按下鼠标 / 触摸 / 指针'),
        // 事件触发顺序
        this.state.eventComparison.length > 0 && h('div', { class: 'mt-sm' },
          h('div', { class: 'fs-sm text-secondary', style: { marginBottom: '4px' } }, '事件触发顺序：'),
          h('div', { class: 'flex', style: { gap: '8px', flexWrap: 'wrap' } },
            ...this.state.eventComparison.map((ev, i) => h(Tag, {
              color: ev.type === 'pointerdown' ? 'primary' : ev.type === 'touchstart' ? 'success' : 'warning',
            }, `${i + 1}. ${ev.type} (${ev.time.toFixed(1)}ms${ev.prevented ? ', 已阻止' : ''})`)),
          ),
        ),
        // 对比表
        h('div', { class: 'mt-lg' },
          h('div', { class: 'fs-sm text-secondary', style: { marginBottom: '4px' } }, 'Mouse / Touch / Pointer 事件模型对比：'),
          h('table', { style: { width: '100%', borderCollapse: 'collapse' } },
            h('thead', {},
              h('tr', {},
                h('th', { style: TH_STYLE }, '特性'),
                h('th', { style: TH_STYLE }, 'Mouse Events'),
                h('th', { style: TH_STYLE }, 'Touch Events'),
                h('th', { style: TH_STYLE }, 'Pointer Events'),
              ),
            ),
            h('tbody', {},
              ...COMPARISON_TABLE.map((row) => h('tr', {},
                h('td', { style: TD_STYLE }, h('strong', {}, row.feature)),
                h('td', { style: TD_STYLE }, row.mouse),
                h('td', { style: TD_STYLE }, row.touch),
                h('td', { style: TD_STYLE }, row.pointer),
              )),
            ),
          ),
        ),
      ),

      // —— 事件日志 ——
      h(Card, { title: '事件日志', extra: h('span', { class: 'fs-sm text-tertiary' }, '实时') }),
      h('div', { class: 'log-panel' },
        ...this.state.logs.map((log) => h('div', { class: 'log-panel__line' },
          h('span', { class: 'log-panel__time' }, log.time),
          h('span', { class: `log-panel__tag log-panel__tag--${LOG_TAG_CLASS[log.type] || 'info'}` }, log.type),
          h('span', {}, log.content),
        )),
      ),
    ];
  }
}