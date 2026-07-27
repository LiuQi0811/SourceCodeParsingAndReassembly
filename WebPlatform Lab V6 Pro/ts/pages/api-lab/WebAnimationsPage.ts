// =====================================================================
// WebAnimationsPage.js —— Web Animations 动画实验室
// 演示 MDN：Web Animations API（WAAPI）—— JS 命令式控制动画的标准 API，与 CSS 动画共享同一引擎。
//   1. element.animate() 基础 + 关键帧：keyframes（数组/对象）、options（duration|'auto'、iterations|
//      Infinity、direction、easing、fill、delay、endDelay、iterationStart、playbackRate）、cubic-bezier、fill:forwards。
//   2. Animation 对象控制：play/pause/reverse/cancel/finish/commitStyles/persist、currentTime/playbackRate/
//      playState/startTime/effect/timeline、finish/cancel/remove 事件。
//   3. KeyframeEffect + 序列动画：new KeyframeEffect(target, kf, opts)、new Animation(effect, timeline)、
//      CompositeOperation('replace'|'add'|'accumulate')、iterationComposite、delay 形成 wave。
//   4. getAnimations() + 动画监听：element/document.getAnimations()、persist() 防自动移除、finish/cancel/remove。
//   5. DocumentTimeline + CSS 互操作：document.timeline、new DocumentTimeline({originTime})、animation.timeline 切换、
//      CSS @keyframes 经 getAnimations() 被 JS 暂停/反向。
// 说明：所有 API 调用前做 typeof 能力检测，不可用 _addLog('warn', ...)，绝不抛异常；
//      jsdom 中 Element.prototype.animate 通常缺失，所有调用 try/catch + 能力检测。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { Props, State } from '../../core/types.js';

export interface WebAnimationsPageProps extends Props {}

export interface WebAnimationsPageState extends State {}

export class WebAnimationsPage extends Page {
  declare props: WebAnimationsPageProps;
  declare state: WebAnimationsPageState;
  _animCancelHandler: any = null;
  _animFinishHandler: any = null;
  _cssAnim: any = null;
  _inited: boolean = false;
  _injectedStyleEl: any = null;
  _mainAnim: any = null;
  _multiAnims: any = null;
  _rafId: any = null;
  _waveAnims: any = null;
  initialState(): WebAnimationsPageState {
    return {
      // 共享事件日志（所有卡片写入同一面板）
      logs: [],
      // 能力检测摘要（componentDidMount 中填充，渲染时非空才显示 Alert）
      capsSummary: '',
      // Card 2：主动画状态与当前时间
      animState: 'idle',      // 'idle' | 'running' | 'paused' | 'finished'
      currentTime: null,      // 当前 currentTime（ms）
      // Card 4：getAnimations 列表
      animCount: 0,
      getAnimList: [],
      // Card 5：CSS 动画状态
      cssAnimStatus: '未注入',
    };
  }

  componentDidMount(): void {
    // —— 幂等初始化实例引用（仅在首次未初始化时赋默认值；放在守卫之前，因首次 render 发生在
    //    componentDidMount 之前，render 中读取这些引用需安全；rerender 会再次触发
    //    componentDidMount，条件赋值避免重置已持有的动画句柄/轮询句柄，与 PerformanceAPIDeepPage 一致）——
    if (this._mainAnim === undefined) this._mainAnim = null;              // Card 2 主 Animation 句柄
    if (this._waveAnims === undefined) this._waveAnims = [];              // Card 3 wave / composite 动画集合
    if (this._multiAnims === undefined) this._multiAnims = [];            // Card 4 多动画集合
    if (this._cssAnim === undefined) this._cssAnim = null;                // Card 5 CSS 动画引用
    if (this._rafId === undefined) this._rafId = null;                    // Card 2 requestAnimationFrame 句柄
    if (this._injectedStyleEl === undefined) this._injectedStyleEl = null;// Card 5 注入的 <style> 元素
    if (this._animFinishHandler === undefined) this._animFinishHandler = null; // Card 2 finish 处理器
    if (this._animCancelHandler === undefined) this._animCancelHandler = null; // Card 2 cancel 处理器

    // ★★★ 关键守卫：必须存在！防止 setState → rerender → componentDidMount 死循环导致 OOM
    if (this._inited) return; this._inited = true;

    // —— 能力检测（仅 typeof 判定，绝不抛异常）——
    const animSupported = typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
    const animationSupported = typeof Animation !== 'undefined';
    const kfeSupported = typeof KeyframeEffect !== 'undefined';
    const getAnimSupported = typeof document !== 'undefined' && typeof document.getAnimations === 'function';
    const timelineSupported = typeof DocumentTimeline !== 'undefined';

    const summary =
      '能力检测：element.animate=' + (animSupported ? '✓' : '✗') +
      '，Animation=' + (animationSupported ? '✓' : '✗') +
      '，KeyframeEffect=' + (kfeSupported ? '✓' : '✗') +
      '，document.getAnimations=' + (getAnimSupported ? '✓' : '✗') +
      '，DocumentTimeline=' + (timelineSupported ? '✓' : '✗');
    this.setState({ capsSummary: summary });
    this._addLog('info', summary);

    // 不可用能力统一记录 warn
    const missing = [
      [animSupported, 'Element.prototype.animate 不可用（jsdom 通常缺失），element.animate 演示将跳过'],
      [animationSupported, 'Animation 构造器不可用，Animation 对象控制演示将跳过'],
      [kfeSupported, 'KeyframeEffect 不可用，独立关键帧效果演示将回退到 element.animate'],
      [getAnimSupported, 'document.getAnimations 不可用，全局动画列表演示将跳过'],
      [timelineSupported, 'DocumentTimeline 不可用，自定义时间轴演示将跳过'],
    ];
    missing.forEach(([ok, msg]: any) => { if (!ok) this._addLog('warn', msg); });
  }

  componentWillUnmount(): void {
    // 清理 Card 2：停止轮询 + 解绑事件 + cancel 主动画
    this._stopAnimPoll();
    this._detachMainAnimListeners();
    try { if (this._mainAnim) { try { this._mainAnim.cancel(); } catch { /* noop */ } this._mainAnim = null; } } catch { /* noop */ }
    // 清理 Card 3 / Card 4：wave / composite / 多动画逐个 cancel（共享同一清理模式）
    const cancelAll = (arr: any) => {
      try {
        if (Array.isArray(arr)) arr.forEach((a: any) => { try { a && a.cancel && a.cancel(); } catch { /* noop */ } });
      } catch { /* noop */ }
      return [];
    };
    this._waveAnims = cancelAll(this._waveAnims);
    this._multiAnims = cancelAll(this._multiAnims);
    // 清理 Card 5：移除注入的 <style> 元素
    try {
      if (this._injectedStyleEl && this._injectedStyleEl.parentNode) {
        this._injectedStyleEl.parentNode.removeChild(this._injectedStyleEl);
      }
      this._injectedStyleEl = null;
    } catch { /* noop */ }
    this._cssAnim = null;
  }

  // —— 共享日志方法 ——
  _addLog(type: any, content: any) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  // —— 按钮工厂：创建 Button 实例并注册为子组件 ——
  _btn(label: any, opts: any) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // —— Card 工厂：new Card({title, desc, extra, children}) + registerChild + render ——
  _card(title: any, desc: any, extra: any, children: any) {
    const kids: any[] = [];
    if (desc) kids.push(h('p', { class: 'fs-sm text-secondary' }, desc));
    const arr = Array.isArray(children) ? children : (children ? [children] : []);
    kids.push(...arr);
    const card = new Card({ title, desc, extra, children: kids });
    this.registerChild(card);
    return card.render();
  }

  // —— 日志面板渲染（所有卡片共享）——
  _renderLogPanel() {
    const s = this.state;
    return h('div', { class: 'log-panel' },
      h('div', { class: 'log-panel__header' }, '事件日志'),
      s.logs.length === 0
        ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
        : s.logs.map((log: any) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  // —— 安全获取 DOM 元素（每次重新 getElementById，避免 rerender 后旧引用失效）——
  _el(id: any) {
    try { return (document.getElementById(id) as any); } catch { return null; }
  }

  // —— 演示方块（inline style，避免依赖额外注入样式）——
  _demoBox(id: any, extra: any) {
    return h('div', {
      id,
      class: 'wa-demo-box',
      style: Object.assign({
        width: '56px',
        height: '56px',
        borderRadius: '8px',
        background: 'var(--color-primary, #1677ff)',
        color: '#fff',
        fontSize: '11px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '10px 0',
        willChange: 'transform, opacity',
      }, extra || {}),
    }, id);
  }

  // 简易一次性事件绑定（用于 finish 监听等）
  _attachOnce(anim: any, type: any, handler: any) {
    try {
      if (anim && typeof anim.addEventListener === 'function') {
        anim.addEventListener(type, handler, { once: true });
      }
    } catch { /* noop */ }
  }

  // =================================================================
  // Card 1：element.animate() 基础 + 关键帧
  // =================================================================

  // 播放淡入 + 位移（cubic-bezier 回弹缓动）
  _playFadeMove() {
    if (typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function') {
      this._addLog('warn', 'element.animate 不可用，无法播放淡入位移动画');
      return;
    }
    const el = this._el('wa-box-1');
    if (!el) { this._addLog('warn', '未找到演示元素 #wa-box-1'); return; }
    try {
      const anim = el.animate(
        [
          { opacity: 0, transform: 'translateX(-120px) rotate(0deg)' },
          { opacity: 1, transform: 'translateX(0) rotate(360deg)' },
        ],
        { duration: 1200, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'none' },
      );
      this._addLog('animate', '播放淡入+位移（cubic-bezier(0.34,1.56,0.64,1) 回弹缓动），duration=1200ms');
      this._attachOnce(anim, 'finish', () => this._addLog('animate', '淡入位移动画 finish'));
    } catch (err: any) {
      this._addLog('warn', 'animate 调用失败：' + (err && err.message));
    }
  }

  // alternate-reverse 无限弹跳
  _playBounce() {
    if (typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function') {
      this._addLog('warn', 'element.animate 不可用，无法播放弹跳动画');
      return;
    }
    const el = this._el('wa-box-1');
    if (!el) { this._addLog('warn', '未找到演示元素 #wa-box-1'); return; }
    try {
      const anim = el.animate(
        [{ transform: 'translateY(0)' }, { transform: 'translateY(-60px)' }],
        { duration: 600, iterations: Infinity, direction: 'alternate-reverse', easing: 'ease-in-out' },
      );
      this._waveAnims.push(anim); // 存入集合以便卸载时清理
      this._addLog('animate', '播放 alternate-reverse 无限弹跳（iterations=Infinity）');
    } catch (err: any) {
      this._addLog('warn', 'animate 调用失败：' + (err && err.message));
    }
  }

  // fill:forwards 保持终态
  _playFillForwards() {
    if (typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function') {
      this._addLog('warn', 'element.animate 不可用，无法播放 fill 演示');
      return;
    }
    const el = this._el('wa-box-1');
    if (!el) { this._addLog('warn', '未找到演示元素 #wa-box-1'); return; }
    try {
      const anim = el.animate(
        [
          { transform: 'scale(1)', backgroundColor: 'rgb(22, 119, 255)' },
          { transform: 'scale(1.6)', backgroundColor: 'rgb(255, 77, 79)' },
        ],
        { duration: 1000, fill: 'forwards', easing: 'ease' },
      );
      this._addLog('animate', '播放 fill:forwards 动画，结束后将保持终态（scale 1.6 / 红色）');
      this._attachOnce(anim, 'finish', () => this._addLog('animate', 'fill:forwards 动画 finish，终态已保留'));
    } catch (err: any) {
      this._addLog('warn', 'animate 调用失败：' + (err && err.message));
    }
  }

  _renderCard1() {
    return this._card(
      'Card 1 · element.animate() 基础 + 关键帧',
      'element.animate(keyframes, options) 返回 Animation。keyframes 可为数组形式 ' +
      '[{opacity:0, transform:\'translateX(-100px)\'}, {opacity:1, transform:\'none\'}] 或对象形式 ' +
      '{offset:[0,0.5,1], opacity:[0,0.5,1]}；options 含 duration(ms)|\'auto\'、iterations|Infinity、' +
      'direction(\'normal\'|\'reverse\'|\'alternate\'|\'alternate-reverse\')、easing、fill、delay、endDelay、' +
      'iterationStart、playbackRate。',
      h(Tag, { color: 'primary' }, 'animate()'),
      [
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('播放淡入+位移（cubic-bezier）', { type: 'primary', size: 'sm', onClick: () => this._playFadeMove() }),
          this._btn('alternate-reverse 无限弹跳', { size: 'sm', onClick: () => this._playBounce() }),
          this._btn('fill:forwards 保持终态', { size: 'sm', onClick: () => this._playFillForwards() }),
        ),
        this._demoBox('wa-box-1', undefined),
        h('pre', { class: 'code-block mt-md' },
`// 数组形式关键帧 + cubic-bezier 回弹缓动
el.animate(
  [{ opacity: 0, transform: 'translateX(-120px)' },
   { opacity: 1, transform: 'translateX(0)' }],
  { duration: 1200, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
);
// 对象形式关键帧
el.animate(
  { offset: [0, 0.5, 1], opacity: [0, 0.5, 1] },
  { duration: 1000, iterations: Infinity, direction: 'alternate-reverse' }
);
// fill: 'none' | 'forwards' | 'backwards' | 'both' | 'auto'
el.animate([...], { duration: 1000, fill: 'forwards' });`),
      ],
    );
  }

  // =================================================================
  // Card 2：Animation 对象控制（play/pause/reverse/cancel/finish/commitStyles）
  // =================================================================

  _ensureMainAnim() {
    if (this._mainAnim) return this._mainAnim;
    if (typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function') {
      this._addLog('warn', 'element.animate 不可用，无法创建主动画');
      return null as any;
    }
    const el = this._el('wa-box-2');
    if (!el) { this._addLog('warn', '未找到演示元素 #wa-box-2'); return null; }
    try {
      const anim = el.animate(
        [
          { transform: 'translateX(0) rotate(0deg)', backgroundColor: 'rgb(22, 119, 255)' },
          { transform: 'translateX(180px) rotate(180deg)', backgroundColor: 'rgb(82, 196, 26)' },
          { transform: 'translateX(0) rotate(360deg)', backgroundColor: 'rgb(22, 119, 255)' },
        ],
        { duration: 6000, iterations: 2, easing: 'linear', fill: 'none' },
      );
      this._mainAnim = anim;
      this._attachMainAnimListeners();
      this._addLog('anim', '创建主动画：duration=6000ms，iterations=2，linear');
      this._syncMainState();
      return anim;
    } catch (err: any) {
      this._addLog('warn', '创建主动画失败：' + (err && err.message));
      return null as any;
    }
  }

  _attachMainAnimListeners() {
    const anim = this._mainAnim;
    if (!anim) return;
    this._detachMainAnimListeners();
    try {
      this._animFinishHandler = () => { this._addLog('state', '主动画 finish 事件触发'); this._syncMainState(); };
      this._animCancelHandler = () => { this._addLog('state', '主动画 cancel 事件触发'); this._syncMainState(); };
      if (typeof anim.addEventListener === 'function') {
        anim.addEventListener('finish', this._animFinishHandler);
        anim.addEventListener('cancel', this._animCancelHandler);
      }
    } catch { /* noop */ }
  }

  _detachMainAnimListeners() {
    const anim = this._mainAnim;
    try {
      if (anim && typeof anim.removeEventListener === 'function') {
        if (this._animFinishHandler) anim.removeEventListener('finish', this._animFinishHandler);
        if (this._animCancelHandler) anim.removeEventListener('cancel', this._animCancelHandler);
      }
    } catch { /* noop */ }
    this._animFinishHandler = this._animCancelHandler = null;
  }

  _syncMainState() {
    const anim = this._mainAnim;
    if (!anim) { this.setState({ animState: 'idle', currentTime: null }); return; }
    let st = 'idle'; let ct = null;
    try { st = anim.playState || 'idle'; } catch { /* noop */ }
    try { ct = anim.currentTime; } catch { /* noop */ }
    this.setState({ animState: st, currentTime: ct });
  }

  // requestAnimationFrame 轮询更新 currentTime / playState
  _startAnimPoll() {
    this._stopAnimPoll();
    const tick = () => {
      this._rafId = null;
      const anim = this._mainAnim;
      if (!anim) return;
      let st = 'idle', ct = null;
      try { st = anim.playState || 'idle'; ct = anim.currentTime; } catch { /* noop */ }
      this.setState({ animState: st, currentTime: ct });
      // 仅在 running 时持续轮询；paused/finished/idle 停止以避免无谓 rerender
      if (st === 'running' && typeof requestAnimationFrame === 'function') {
        this._rafId = requestAnimationFrame(tick);
      }
    };
    if (typeof requestAnimationFrame === 'function') this._rafId = requestAnimationFrame(tick);
    else tick();
  }

  _stopAnimPoll() {
    try {
      if (this._rafId != null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this._rafId);
      }
    } catch { /* noop */ }
    this._rafId = null;
  }

  _playMain() {
    const anim = this._ensureMainAnim();
    if (!anim) return;
    try {
      anim.play();
      this._addLog('anim', 'play()：开始 / 恢复播放');
      this._syncMainState();
      this._startAnimPoll();
    } catch (err: any) {
      this._addLog('warn', 'play 失败：' + (err && err.message));
    }
  }

  _pauseMain() {
    const anim = this._mainAnim;
    if (!anim) { this._addLog('warn', '主动画尚未创建，请先 play'); return; }
    try { anim.pause(); this._addLog('anim', 'pause()：已暂停'); this._syncMainState(); }
    catch (err: any) { this._addLog('warn', 'pause 失败：' + (err && err.message)); }
  }

  _reverseMain() {
    const anim = this._mainAnim;
    if (!anim) { this._addLog('warn', '主动画尚未创建，请先 play'); return; }
    try {
      anim.reverse();
      this._addLog('anim', 'reverse()：反向播放（playbackRate 取反）');
      this._syncMainState();
      this._startAnimPoll();
    } catch (err: any) { this._addLog('warn', 'reverse 失败：' + (err && err.message)); }
  }

  _finishMain() {
    const anim = this._mainAnim;
    if (!anim) { this._addLog('warn', '主动画尚未创建，请先 play'); return; }
    try { anim.finish(); this._addLog('anim', 'finish()：跳到动画终点'); this._syncMainState(); }
    catch (err: any) { this._addLog('warn', 'finish 失败：' + (err && err.message)); }
  }

  _cancelMain() {
    const anim = this._mainAnim;
    if (!anim) { this._addLog('warn', '主动画尚未创建'); return; }
    try { anim.cancel(); this._addLog('anim', 'cancel()：已取消并清除效果'); this._syncMainState(); }
    catch (err: any) { this._addLog('warn', 'cancel 失败：' + (err && err.message)); }
  }

  _commitStylesMain() {
    const anim = this._mainAnim;
    if (!anim) { this._addLog('warn', '主动画尚未创建，请先 play'); return; }
    if (typeof anim.commitStyles !== 'function') {
      this._addLog('warn', 'Animation.commitStyles 不可用（需较新浏览器）');
      return;
    }
    try {
      anim.commitStyles();
      this._addLog('anim', 'commitStyles()：已将计算样式提交到 inline style');
      try { anim.cancel(); } catch { /* noop */ }
      this._addLog('state', 'commitStyles 后 cancel()，inline style 保留终态视觉');
      this._syncMainState();
    } catch (err: any) { this._addLog('warn', 'commitStyles 失败：' + (err && err.message)); }
  }

  _renderCard2() {
    const s = this.state;
    const ct = s.currentTime;
    return this._card(
      'Card 2 · Animation 对象控制（play/pause/reverse/cancel/finish/commitStyles）',
      'const anim = element.animate(...) 返回 Animation 对象。属性：currentTime、playbackRate、' +
      'playState(\'idle\'|\'running\'|\'paused\'|\'finished\')、startTime、effect（KeyframeEffect）、timeline；' +
      '方法：play/pause/reverse/cancel/finish/commitStyles/persist；事件：finish、cancel、remove。',
      h(Tag, { color: s.animState === 'running' ? 'success' : (s.animState === 'paused' ? 'warning' : 'default') },
        'playState: ' + s.animState),
      [
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-sm' },
          h(Tag, { color: 'primary' }, 'currentTime: ' + (ct != null ? Number(ct).toFixed(1) + ' ms' : '—')),
          h(Tag, { color: 'default' }, '主动画：' + (this._mainAnim ? '已创建' : '未创建')),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('play', { type: 'primary', size: 'sm', onClick: () => this._playMain() }),
          this._btn('pause', { size: 'sm', onClick: () => this._pauseMain() }),
          this._btn('reverse', { size: 'sm', onClick: () => this._reverseMain() }),
          this._btn('finish（跳到终点）', { size: 'sm', onClick: () => this._finishMain() }),
          this._btn('cancel', { size: 'sm', danger: true, onClick: () => this._cancelMain() }),
          this._btn('commitStyles 后 cancel', { size: 'sm', onClick: () => this._commitStylesMain() }),
        ),
        this._demoBox('wa-box-2', undefined),
        h('pre', { class: 'code-block mt-md' },
`const anim = el.animate(keyframes, { duration: 6000, iterations: 2 });
anim.playState;      // 'idle' | 'running' | 'paused' | 'finished'
anim.currentTime;    // 当前时间(ms)，可读写
anim.playbackRate;   // 播放速率，reverse() 会取反
anim.play();         // 开始 / 恢复
anim.pause();        // 暂停
anim.reverse();      // 反向（playbackRate *= -1 并 play）
anim.finish();       // 跳到终点
anim.cancel();       // 取消并清除效果
anim.commitStyles(); // 把计算样式写入 inline style（随后可 cancel 保留视觉）
anim.addEventListener('finish', (e: any) => { /* ... */ });
anim.addEventListener('cancel', (e: any) => { /* ... */ });`),
      ],
    );
  }

  // =================================================================
  // Card 3：KeyframeEffect + 序列动画（wave / composite）
  // =================================================================

  // 创建 wave 序列动画：3 个 box 错开 delay
  _createWave() {
    if (typeof KeyframeEffect === 'undefined' || typeof Animation === 'undefined') {
      this._addLog('warn', 'KeyframeEffect / Animation 不可用，回退到 element.animate + delay');
      this._createWaveFallback();
      return;
    }
    const ids = ['wa-box-3a', 'wa-box-3b', 'wa-box-3c'];
    const els = ids.map((id: any) => this._el(id));
    if (els.some((e: any) => !e)) { this._addLog('warn', '未找到演示元素（wa-box-3a/3b/3c）'); return; }
    this._cancelWaveAnims();
    try {
      const keyframes = [
        { transform: 'translateY(0)', backgroundColor: 'rgb(22, 119, 255)' },
        { transform: 'translateY(-40px)', backgroundColor: 'rgb(82, 196, 26)' },
        { transform: 'translateY(0)', backgroundColor: 'rgb(22, 119, 255)' },
      ];
      const opts = { duration: 900, easing: 'ease-in-out', iterations: Infinity, fill: 'both' };
      let timeline = null;
      try { timeline = typeof document !== 'undefined' ? document.timeline : null; } catch { timeline = null; }
      els.forEach((el: any, i: any) => {
        try {
          const effect = new KeyframeEffect(el, keyframes, { ...opts, delay: i * 200 } as any);
          const anim = timeline ? new Animation(effect, timeline) : new Animation(effect);
          anim.play();
          this._waveAnims.push(anim);
          this._addLog('wave', `box[${i}] KeyframeEffect + new Animation，delay=${i * 200}ms`);
        } catch (err: any) {
          this._addLog('warn', `box[${i}] 创建失败：` + (err && err.message));
        }
      });
      this._addLog('kfe', 'wave 序列已启动（3 个 KeyframeEffect + Animation，错开 200ms）');
    } catch (err: any) {
      this._addLog('warn', 'wave 创建失败：' + (err && err.message));
    }
  }

  _createWaveFallback() {
    if (typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function') {
      this._addLog('warn', 'element.animate 也不可用，wave 演示跳过');
      return;
    }
    const ids = ['wa-box-3a', 'wa-box-3b', 'wa-box-3c'];
    const els = ids.map((id: any) => this._el(id));
    if (els.some((e: any) => !e)) return;
    this._cancelWaveAnims();
    els.forEach((el: any, i: any) => {
      try {
        const anim = el.animate(
          [{ transform: 'translateY(0)' }, { transform: 'translateY(-40px)' }, { transform: 'translateY(0)' }],
          { duration: 900, delay: i * 200, iterations: Infinity, easing: 'ease-in-out' },
        );
        this._waveAnims.push(anim);
      } catch (err: any) {
        this._addLog('warn', `box[${i}] animate 回退失败：` + (err && err.message));
      }
    });
    this._addLog('wave', 'wave 序列已启动（回退 element.animate + delay）');
  }

  // composite:'add' 叠加旋转动画演示
  _compositeRotate() {
    if (typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function') {
      this._addLog('warn', 'element.animate 不可用，无法演示 composite');
      return;
    }
    const el = this._el('wa-box-3a');
    if (!el) { this._addLog('warn', '未找到演示元素 #wa-box-3a'); return; }
    try {
      // 基础位移动画（replace，fill:forwards 保留）
      const base = el.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(60px)' }],
        { duration: 1500, fill: 'forwards', easing: 'ease-out', composite: 'replace' },
      );
      this._waveAnims.push(base);
      this._addLog('kfe', '基础位移动画（composite:replace，fill:forwards）');
      // 叠加旋转动画（composite:add，与位移 transform 累加）
      const rot = el.animate(
        [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
        { duration: 1500, iterations: Infinity, easing: 'linear', composite: 'add' },
      );
      this._waveAnims.push(rot);
      this._addLog('kfe', '叠加旋转动画（composite:add，与位移 transform 累加）');
      this._addLog('wave', 'CompositeOperation 演示：replace 位移 + add 旋转 = 平移并自转');
    } catch (err: any) {
      this._addLog('warn', 'composite 演示失败：' + (err && err.message));
    }
  }

  _cancelWaveAnims() {
    try {
      if (Array.isArray(this._waveAnims)) {
        this._waveAnims.forEach((a: any) => { try { a && a.cancel && a.cancel(); } catch { /* noop */ } });
      }
    } catch { /* noop */ }
    this._waveAnims = [];
  }

  _renderCard3() {
    return this._card(
      'Card 3 · KeyframeEffect + 序列动画（wave / composite）',
      'new KeyframeEffect(target, keyframes, options) 独立创建关键帧效果；new Animation(effect, timeline) ' +
      '用效果创建动画。CompositeOperation: \'replace\' | \'add\' | \'accumulate\'（多动画叠加）；' +
      'iterationComposite: \'replace\' | \'accumulate\'（每次迭代累加）。多元素用 delay 错开形成序列。',
      h(Tag, { color: 'success' }, 'KeyframeEffect'),
      [
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('创建 wave 序列动画', { type: 'primary', size: 'sm', onClick: () => this._createWave() }),
          this._btn('composite:add 叠加旋转', { size: 'sm', onClick: () => this._compositeRotate() }),
          this._btn('停止 wave / composite', {
            size: 'sm', danger: true, onClick: () => {
              this._cancelWaveAnims();
              this._addLog('wave', '已停止所有 wave / composite 动画');
            },
          }),
        ),
        h('div', { class: 'flex items-center mt-md', style: { gap: '24px' } },
          this._demoBox('wa-box-3a', undefined),
          this._demoBox('wa-box-3b', { background: 'var(--color-success, #52c41a)' }),
          this._demoBox('wa-box-3c', { background: 'var(--color-warning, #faad14)' }),
        ),
        h('pre', { class: 'code-block mt-md' },
`const effect = new KeyframeEffect(el, keyframes, {
  duration: 900, delay: 200, iterations: Infinity, easing: 'ease-in-out',
} as any);
const anim = new Animation(effect, document.timeline);
anim.play();
// CompositeOperation：多动画如何叠加
el.animate([...], { composite: 'replace' });     // 覆盖（默认）
el.animate([...], { composite: 'add' });         // 累加（如位移 + 旋转）
el.animate([...], { composite: 'accumulate' });  // 累乘
// iterationComposite：每次迭代是否累加
el.animate([...], { iterationComposite: 'accumulate' });`),
      ],
    );
  }

  // =================================================================
  // Card 4：getAnimations() + 动画监听
  // =================================================================

  _applyThreeAnims() {
    if (typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function') {
      this._addLog('warn', 'element.animate 不可用，无法施加动画');
      return;
    }
    const el = this._el('wa-box-4');
    if (!el) { this._addLog('warn', '未找到演示元素 #wa-box-4'); return; }
    this._cancelMultiAnims();
    try {
      const a1 = el.animate(
        [{ opacity: 1 }, { opacity: 0.3 }, { opacity: 1 }],
        { duration: 1500, iterations: Infinity, easing: 'ease-in-out' },
      );
      const a2 = el.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }],
        { duration: 2000, iterations: Infinity, easing: 'ease-in-out' },
      );
      const a3 = el.animate(
        [{ backgroundColor: 'rgb(22,119,255)' }, { backgroundColor: 'rgb(255,77,79)' }, { backgroundColor: 'rgb(22,119,255)' }],
        { duration: 2500, iterations: Infinity, easing: 'linear' },
      );
      this._multiAnims.push(a1, a2, a3);
      this._addLog('get', '已对 #wa-box-4 施加 3 个动画（opacity / scale / background）');
      this._listElementAnims(el);
    } catch (err: any) {
      this._addLog('warn', '施加动画失败：' + (err && err.message));
    }
  }

  _listElementAnims(el: any) {
    if (!el) return;
    if (typeof el.getAnimations !== 'function') {
      this._addLog('warn', 'element.getAnimations 不可用');
      return;
    }
    try {
      const anims = el.getAnimations() || [];
      const list = anims.map((a: any, i: any) => {
        let st = 'idle'; let ct = null; let composite = '—';
        try { st = a.playState || 'idle'; } catch { /* noop */ }
        try { ct = a.currentTime; } catch { /* noop */ }
        try { composite = (a.effect && a.effect.composite) || '—'; } catch { /* noop */ }
        return { idx: i, playState: st, currentTime: ct, composite };
      });
      this.setState({ animCount: list.length, getAnimList: list });
      this._addLog('list', `element.getAnimations() 共 ${list.length} 个动画`);
    } catch (err: any) {
      this._addLog('warn', 'getAnimations 读取失败：' + (err && err.message));
    }
  }

  _persistAnim() {
    if (!this._multiAnims || this._multiAnims.length === 0) {
      this._addLog('warn', '请先点击「施加 3 个动画」');
      return;
    }
    const anim = this._multiAnims[0];
    if (typeof anim.persist !== 'function') {
      this._addLog('warn', 'Animation.persist 不可用');
      return;
    }
    try {
      anim.persist();
      this._addLog('get', '已对首个动画调用 persist()，防止 fill 动画被自动回收');
      this._listElementAnims(this._el('wa-box-4'));
    } catch (err: any) {
      this._addLog('warn', 'persist 失败：' + (err && err.message));
    }
  }

  _listDocAnims() {
    if (typeof document === 'undefined' || typeof document.getAnimations !== 'function') {
      this._addLog('warn', 'document.getAnimations 不可用');
      return;
    }
    try {
      const anims = document.getAnimations() || [];
      const list = anims.map((a: any, i: any) => {
        let st = 'idle'; let ct = null; let target = '—';
        try { st = a.playState || 'idle'; } catch { /* noop */ }
        try { ct = a.currentTime; } catch { /* noop */ }
        try {
          const t = a.effect && a.effect.target;
          target = t ? (t.id || t.tagName || '—') : '—';
        } catch { /* noop */ }
        return { idx: i, playState: st, currentTime: ct, target };
      });
      this.setState({ animCount: list.length, getAnimList: list });
      this._addLog('list', `document.getAnimations() 全局共 ${list.length} 个动画`);
    } catch (err: any) {
      this._addLog('warn', 'document.getAnimations 读取失败：' + (err && err.message));
    }
  }

  _cancelMultiAnims() {
    try {
      if (Array.isArray(this._multiAnims)) {
        this._multiAnims.forEach((a: any) => { try { a && a.cancel && a.cancel(); } catch { /* noop */ } });
      }
    } catch { /* noop */ }
    this._multiAnims = [];
  }

  _renderAnimList() {
    const list = this.state.getAnimList;
    if (!list || list.length === 0) {
      return h('div', { class: 'log-panel__empty' }, '（暂无动画列表，点击上方按钮读取）');
    }
    const TD = { padding: '4px 8px', borderBottom: '1px solid var(--color-border, #f0f0f0)', fontSize: '12px' };
    const TH = { padding: '4px 8px', borderBottom: '1px solid var(--color-border, #eee)', textAlign: 'left', fontSize: '12px' };
    const hasTarget = list.some((x: any) => x.target != null);
    const rows = list.map((x: any) => h('tr', {},
      h('td', { style: TD }, String(x.idx)),
      h('td', { style: TD }, x.playState),
      h('td', { style: TD }, x.currentTime != null ? Number(x.currentTime).toFixed(1) + ' ms' : '—'),
      h('td', { style: TD }, hasTarget ? (x.target || '—') : (x.composite || '—')),
    ));
    return h('table', { style: { width: '100%', borderCollapse: 'collapse', marginTop: '8px' } },
      h('thead', {}, h('tr', {},
        h('th', { style: TH }, '#'),
        h('th', { style: TH }, 'playState'),
        h('th', { style: TH }, 'currentTime'),
        h('th', { style: TH }, hasTarget ? 'target' : 'composite'),
      )),
      h('tbody', {}, ...rows),
    );
  }

  _renderCard4() {
    const s = this.state;
    return this._card(
      'Card 4 · getAnimations() + 动画监听',
      'element.getAnimations() 返回当前作用于元素的 Animation[]；document.getAnimations() 返回页面所有动画。' +
      'Animation.persist() 防止 fill:forwards 动画被自动回收；可监听 finish/cancel/remove 事件。',
      h(Tag, { color: 'primary' }, '动画数: ' + s.animCount),
      [
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('施加 3 个动画 → getAnimations 列出', { type: 'primary', size: 'sm', onClick: () => this._applyThreeAnims() }),
          this._btn('persist 一个动画', { size: 'sm', onClick: () => this._persistAnim() }),
          this._btn('document.getAnimations 全局列表', { size: 'sm', onClick: () => this._listDocAnims() }),
          this._btn('清理多动画', {
            size: 'sm', danger: true, onClick: () => {
              this._cancelMultiAnims();
              this.setState({ animCount: 0, getAnimList: [] });
              this._addLog('get', '已清理 #wa-box-4 上的多动画');
            },
          }),
        ),
        this._demoBox('wa-box-4', undefined),
        h('div', { class: 'mt-md' }, this._renderAnimList()),
        h('pre', { class: 'code-block mt-md' },
`el.getAnimations();        // 作用于 el 的所有 Animation[]
document.getAnimations();  // 页面所有 Animation[]
anim.persist();            // 防止 fill 动画被自动移除
anim.addEventListener('finish', (e: any) => { /* ... */ });
anim.addEventListener('cancel', (e: any) => { /* ... */ });
anim.addEventListener('remove', (e: any) => { /* 自动移除时触发 */ });`),
      ],
    );
  }

  // =================================================================
  // Card 5：DocumentTimeline + 自定义 timeline + 与 CSS 动画互操作
  // =================================================================

  _injectCssSpin() {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      this._addLog('warn', 'document 不可用，无法注入 CSS 动画');
      return;
    }
    // 若已注入，先移除重建
    try {
      if (this._injectedStyleEl && this._injectedStyleEl.parentNode) {
        this._injectedStyleEl.parentNode.removeChild(this._injectedStyleEl);
      }
    } catch { /* noop */ }
    this._injectedStyleEl = null;
    this._cssAnim = null;
    try {
      const style = document.createElement('style');
      style.id = 'wa-css-spin-style';
      style.textContent =
        '@keyframes wa-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }' +
        '.wa-spin-anim { animation: wa-spin 2s linear infinite; }';
      document.head.appendChild(style);
      this._injectedStyleEl = style;
      const el = this._el('wa-box-5');
      if (el) el.classList.add('wa-spin-anim');
      this.setState({ cssAnimStatus: '已注入 @keyframes spin（2s linear infinite）' });
      this._addLog('css', '已注入 <style> @keyframes wa-spin 并给 #wa-box-5 加 .wa-spin-anim');
      this._captureCssAnim();
    } catch (err: any) {
      this._addLog('warn', '注入 CSS 动画失败：' + (err && err.message));
    }
  }

  _captureCssAnim() {
    const el = this._el('wa-box-5');
    if (!el || typeof el.getAnimations !== 'function') return null;
    try {
      const anims = el.getAnimations() || [];
      let target = null;
      for (const a of anims) {
        let name = '';
        try { name = a.animationName || ''; } catch { name = ''; }
        target = a;
        if (name === 'wa-spin') break;
      }
      this._cssAnim = target;
      return target;
    } catch { /* noop */ }
    return null as any;
  }

  _pauseCssAnim() {
    this._controlCssAnim('pause', '已 pause CSS 动画', 'pause CSS 动画失败');
  }

  _reverseCssAnim() {
    this._controlCssAnim('reverse', '已 reverse CSS 动画', 'reverse CSS 动画失败');
  }

  // 拦截 CSS 动画并调用指定方法（pause / reverse）
  _controlCssAnim(method: any, okStatus: any, errLabel: any) {
    const el = this._el('wa-box-5');
    if (!el) { this._addLog('warn', '未找到演示元素 #wa-box-5'); return; }
    if (typeof el.getAnimations !== 'function') {
      this._addLog('warn', 'element.getAnimations 不可用，无法拦截 CSS 动画');
      return;
    }
    try {
      const anims = el.getAnimations() || [];
      if (anims.length === 0) {
        this._addLog('warn', '未发现 CSS 动画，请先点击「注入 CSS @keyframes spin」');
        return;
      }
      const anim = anims[0];
      anim[method]();
      this._cssAnim = anim;
      this._addLog('css', `JS 拦截 CSS 动画并 ${method}()：` + (anim.animationName || '(css anim)'));
      this.setState({ cssAnimStatus: okStatus });
    } catch (err: any) {
      this._addLog('warn', errLabel + '：' + (err && err.message));
    }
  }

  _renderCard5() {
    const s = this.state;
    const hasTimeline = typeof DocumentTimeline !== 'undefined';
    return this._card(
      'Card 5 · DocumentTimeline + 自定义 timeline + 与 CSS 动画互操作',
      'document.timeline 为默认时间轴；new DocumentTimeline({ originTime }) 自定义时间起点；' +
      'animation.timeline = customTimeline 切换时间轴。CSS @keyframes 定义的动画也出现在 getAnimations() 中，' +
      '可被 JS pause()/reverse() 控制——WAAPI 与 CSS 动画共享同一引擎。',
      h(Tag, { color: hasTimeline ? 'success' : 'warning' }, s.cssAnimStatus),
      [
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          h(Tag, { color: 'primary' }, 'DocumentTimeline: ' + (hasTimeline ? '✓' : '✗')),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('注入 CSS @keyframes spin 动画', { type: 'primary', size: 'sm', onClick: () => this._injectCssSpin() }),
          this._btn('JS 拦截并 pause CSS 动画', { size: 'sm', onClick: () => this._pauseCssAnim() }),
          this._btn('reverse CSS 动画', { size: 'sm', onClick: () => this._reverseCssAnim() }),
        ),
        this._demoBox('wa-box-5', { background: 'var(--color-success, #52c41a)' }),
        h('pre', { class: 'code-block mt-md' },
`// 默认时间轴
document.timeline;
// 自定义时间起点
const tl = new DocumentTimeline({ originTime: 0 });
animation.timeline = tl;            // 切换时间轴
// CSS @keyframes 与 WAAPI 互操作
// <style>@keyframes wa-spin { to { transform: rotate(360deg); } }</style>
// el.classList.add('wa-spin-anim');
const cssAnim = el.getAnimations()[0]; // 拿到 CSS 动画
cssAnim.pause();    // JS 暂停 CSS 动画
cssAnim.reverse();  // JS 反向 CSS 动画`),
      ],
    );
  }

  // =================================================================
  // 整页渲染
  // =================================================================

  render() {
    const s = this.state;
    return h('div', { class: 'page api-lab-page' },
      h('h2', { class: 'section-title' }, 'Web Animations 动画实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '演示 Web Animations API（WAAPI）：element.animate 关键帧 / Animation 控制 / ' +
        'KeyframeEffect + 序列动画 / getAnimations / DocumentTimeline 与 CSS 互操作。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null as any,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderLogPanel(),
    );
  }
}
