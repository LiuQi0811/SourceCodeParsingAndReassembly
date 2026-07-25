// EnvironmentPage.js —— 环境与设备 API 实验室
// 演示 MDN：Page Visibility、requestIdleCallback、Fullscreen、Vibration、
//           Wake Lock、Battery、Network Information、Web Share
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class EnvironmentPage extends Page {
  initialState() {
    return {
      logs: [],
      visibilityState: document.visibilityState,
      isHidden: document.hidden,
      hiddenSince: null,
      idleResults: [],
      isFullscreen: false,
      fullscreenElement: null,
      batteryLevel: null,
      batteryCharging: null,
      batteryChargingTime: null,
      batteryDischargingTime: null,
      networkType: null,
      networkDownlink: null,
      networkRtt: null,
      networkSaveData: null,
      wakeLockActive: false,
      capabilities: {},
    };
  }

  componentDidMount() {
    // —— 一次性初始化：能力检测、全局事件、异步连接（避免重渲染后重复绑定）——
    if (!this._globalReady) {
      this._globalReady = true;

      // 能力检测：navigator.vibrate / wakeLock / getBattery / connection / share / fullscreen
      const capabilities = {
        pageVisibility: typeof document.visibilityState !== 'undefined',
        idleCallback: typeof window.requestIdleCallback === 'function',
        fullscreen: !!document.fullscreenEnabled,
        vibrate: typeof navigator.vibrate === 'function',
        wakeLock: !!navigator.wakeLock,
        battery: typeof navigator.getBattery === 'function',
        connection: !!navigator.connection,
        share: typeof navigator.share === 'function',
      };
      this.setState({ capabilities });

      // 全局事件（this.on 注册的监听由基类 destroy 统一移除）
      this.on(document, 'visibilitychange', () => this._onVisibilityChange());
      this.on(document, 'fullscreenchange', () => this._onFullscreenChange());

      const supported = Object.entries(capabilities).filter(([, v]) => v).map(([k]) => k);
      this._addLog('info', `环境检测完成，可用：${supported.join(' / ') || '无'}`);

      // 异步连接电池与网络
      this._initBattery();
      this._initNetwork();
    }

    // 每次重渲染后刷新全屏目标元素引用（h() 不支持 ref）
    this._fullscreenTarget = this.$('.fullscreen-target');
  }

  componentWillUnmount() {
    // 释放 WakeLock sentinel
    if (this._wakeSentinel) {
      try { this._wakeSentinel.release(); } catch { /* noop */ }
      this._wakeSentinel = null;
    }
    // 取消空闲回调
    if (this._idleHandle != null && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(this._idleHandle);
      this._idleHandle = null;
    }
    // 取消 requestAnimationFrame
    if (this._rafHandle) {
      cancelAnimationFrame(this._rafHandle);
      this._rafHandle = null;
    }
    // 注：通过 this.on() 注册的 document/window/battery/connection 监听
    // 由基类 Component.destroy() 统一移除，无需在此手动清理。
  }

  _addLog(type, content) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // —— 1. Page Visibility ——
  _onVisibilityChange() {
    const isHidden = document.hidden;
    const state = document.visibilityState;
    if (isHidden) {
      // 切到后台：记录时间戳
      this.setState({ isHidden, visibilityState: state, hiddenSince: Date.now() });
      this._addLog('info', `页面切到后台 (${state})`);
    } else {
      // 切回前台：计算离开时长
      let awaySec = 0;
      if (this.state.hiddenSince) {
        awaySec = (Date.now() - this.state.hiddenSince) / 1000;
      }
      this.setState({ isHidden, visibilityState: state, hiddenSince: null });
      this._addLog('info', awaySec > 0
        ? `页面回到前台，离开时长 ${awaySec.toFixed(2)}s`
        : `页面回到前台 (${state})`);
      // 若之前持有 WakeLock，回到前台后需重新请求（系统在后台会自动释放）
      if (this._wakeLockDesired && !this.state.wakeLockActive) {
        this._requestWakeLock();
      }
    }
  }

  // —— 2. requestIdleCallback ——
  _runIdleTask() {
    if (typeof window.requestIdleCallback === 'function') {
      this._idleHandle = window.requestIdleCallback((deadline) => {
        const remaining = deadline.timeRemaining();
        this._idleHandle = null;
        this.setState({
          idleResults: [...this.state.idleResults, {
            source: 'requestIdleCallback',
            timeRemaining: remaining,
            didTimeout: deadline.didTimeout,
            time: formatTime(),
          }].slice(-8),
        });
        this._addLog('info', `idle 触发：timeRemaining=${remaining.toFixed(1)}ms didTimeout=${deadline.didTimeout}`);
      });
      this._addLog('push', '已调度 requestIdleCallback（等待浏览器空闲）');
    } else {
      // Safari 不支持，降级到 setTimeout
      setTimeout(() => {
        this.setState({
          idleResults: [...this.state.idleResults, {
            source: 'setTimeout 兜底',
            timeRemaining: 0,
            didTimeout: false,
            time: formatTime(),
          }].slice(-8),
        });
        this._addLog('info', 'Safari 不支持 requestIdleCallback，已用 setTimeout 兜底');
      }, 0);
    }
  }

  _runRafTask() {
    this._rafHandle = requestAnimationFrame(() => {
      this._rafHandle = null;
      this.setState({
        idleResults: [...this.state.idleResults, {
          source: 'requestAnimationFrame',
          timeRemaining: 0,
          didTimeout: false,
          time: formatTime(),
        }].slice(-8),
      });
      this._addLog('pop', 'rAF 触发（高优先级，下一帧立即执行）');
    });
    this._addLog('push', '已调度 requestAnimationFrame');
  }

  _cancelIdle() {
    if (this._idleHandle != null && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(this._idleHandle);
      this._idleHandle = null;
      this._addLog('error', '已 cancelIdleCallback');
    } else {
      this._addLog('error', '无待执行的 idle 任务');
    }
  }

  // —— 3. Fullscreen ——
  _onFullscreenChange() {
    const el = document.fullscreenElement;
    this.setState({
      isFullscreen: !!el,
      fullscreenElement: el ? (el.className || el.tagName.toLowerCase()) : null,
    });
    this._addLog('info', el ? '进入全屏' : '退出全屏');
  }

  _enterFullscreen() {
    // 优先用已缓存引用，兜底重新查询，避免重渲染后引用失效
    const target = this._fullscreenTarget || this.$('.fullscreen-target');
    if (!target) return;
    try {
      const fn = target.requestFullscreen || target.webkitRequestFullscreen;
      if (fn) {
        fn.call(target);
        this._addLog('push', 'requestFullscreen()');
      } else {
        this._addLog('error', '当前浏览器不支持 Fullscreen API');
      }
    } catch (err) {
      this._addLog('error', `进入全屏失败：${err.message}`);
    }
  }

  _exitFullscreen() {
    try {
      const fn = document.exitFullscreen || document.webkitExitFullscreen;
      if (fn) {
        fn.call(document);
        this._addLog('push', 'exitFullscreen()');
      }
    } catch (err) {
      this._addLog('error', `退出全屏失败：${err.message}`);
    }
  }

  // —— 4. Vibration ——
  _vibrate(pattern) {
    if (typeof navigator.vibrate !== 'function') {
      this._addLog('error', '当前浏览器不支持 Vibration API');
      return;
    }
    try {
      const ok = navigator.vibrate(pattern);
      this._addLog('info', `vibrate(${JSON.stringify(pattern)}) → ${ok}`);
    } catch (err) {
      this._addLog('error', `vibrate 失败：${err.message}`);
    }
  }

  // —— 5. Screen Wake Lock ——
  async _requestWakeLock() {
    if (!navigator.wakeLock) {
      this._addLog('error', '当前浏览器不支持 Screen Wake Lock API');
      return;
    }
    this._wakeLockDesired = true;
    try {
      const sentinel = await navigator.wakeLock.request('screen');
      this._wakeSentinel = sentinel;
      sentinel.addEventListener('release', () => {
        this.setState({ wakeLockActive: false });
        this._addLog('error', 'WakeLock sentinel 已释放');
      });
      this.setState({ wakeLockActive: true });
      this._addLog('info', 'WakeLock 已激活 (screen)');
    } catch (err) {
      this.setState({ wakeLockActive: false });
      this._addLog('error', `WakeLock 请求失败：${err.message}`);
    }
  }

  _releaseWakeLock() {
    if (this._wakeSentinel) {
      try { this._wakeSentinel.release(); } catch { /* noop */ }
      this._wakeSentinel = null;
      this._wakeLockDesired = false;
      this._addLog('info', '已主动释放 WakeLock');
    } else {
      this._addLog('error', '当前未持有 WakeLock');
    }
  }

  // —— 6. Battery ——
  async _initBattery() {
    if (typeof navigator.getBattery !== 'function') return;
    try {
      const battery = await navigator.getBattery();
      this._battery = battery;
      const update = () => {
        this.setState({
          batteryLevel: battery.level,
          batteryCharging: battery.charging,
          batteryChargingTime: battery.chargingTime,
          batteryDischargingTime: battery.dischargingTime,
        });
      };
      update();
      this.on(battery, 'levelchange', update);
      this.on(battery, 'chargingchange', update);
      this.on(battery, 'chargingtimechange', update);
      this.on(battery, 'dischargingtimechange', update);
      this._addLog('info', `Battery API 已连接：${Math.round(battery.level * 100)}%`);
    } catch (err) {
      this._addLog('error', `Battery 初始化失败：${err.message}`);
    }
  }

  // —— 7. Network Information ——
  _initNetwork() {
    const conn = navigator.connection;
    if (!conn) return;
    const update = () => {
      this.setState({
        networkType: conn.effectiveType,
        networkDownlink: conn.downlink,
        networkRtt: conn.rtt,
        networkSaveData: conn.saveData,
      });
    };
    update();
    this.on(conn, 'change', update);
    this._addLog('info', `Network: ${conn.effectiveType} ${conn.downlink}Mbps rtt=${conn.rtt}ms`);
  }

  // —— 8. Web Share ——
  async _share() {
    if (typeof navigator.share !== 'function') {
      this._addLog('error', '当前浏览器不支持 Web Share API（需 HTTPS，多为移动端）');
      return;
    }
    try {
      await navigator.share({
        title: '环境与设备 API 实验室',
        text: '原生 SPA 演示 Page Visibility / WakeLock / Battery 等环境 API',
        url: window.location.href,
      });
      this._addLog('info', 'navigator.share 完成');
    } catch (err) {
      if (err.name === 'AbortError') {
        this._addLog('error', '用户取消了分享');
      } else {
        this._addLog('error', `分享失败：${err.message}`);
      }
    }
  }

  // —— 辅助：能力标签 ——
  _capTag(key) {
    return this.state.capabilities[key]
      ? h(Tag, { color: 'success' }, '支持')
      : h(Tag, { color: 'default' }, '不支持');
  }

  // —— 辅助：格式化电池时间 ——
  _formatBatteryTime(sec) {
    if (sec == null || !isFinite(sec) || sec === 0) return 'N/A';
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }

  renderPage() {
    const caps = this.state.capabilities;
    const batteryPct = this.state.batteryLevel != null
      ? Math.round(this.state.batteryLevel * 100) : null;

    return [
      h('h2', { class: 'section-title' }, '环境与设备 API 实验室'),

      h(Alert, {
        type: 'info',
        message: 'Page Visibility / requestIdleCallback / Fullscreen / Vibration / Wake Lock / Battery / Network / Web Share',
        description: '部分 API 需要 HTTPS、localhost 或移动端环境，且浏览器支持差异较大。所有按钮均会真实调用对应原生 API，结果写入下方日志。',
      }),

      h('div', { class: 'feature-grid mt-lg' },
        // 1. Page Visibility
        h(Card, { title: '1. Page Visibility 页面可见性', extra: this._capTag('pageVisibility') },
          h('div', { class: 'flex flex-col gap-sm' },
            h('div', { class: 'flex items-center gap-sm' },
              h('span', { class: 'fs-sm text-secondary' }, 'visibilityState：'),
              h(Tag, { color: this.state.isHidden ? 'warning' : 'success' }, this.state.visibilityState),
            ),
            h('div', { class: 'flex items-center gap-sm' },
              h('span', { class: 'fs-sm text-secondary' }, 'document.hidden：'),
              h(Tag, { color: this.state.isHidden ? 'error' : 'success' }, String(this.state.isHidden)),
            ),
            this.state.hiddenSince && h('div', { class: 'fs-sm text-tertiary' },
              `后台计时中，已离开 ${((Date.now() - this.state.hiddenSince) / 1000).toFixed(2)}s`),
            h('p', { class: 'fs-sm text-tertiary' },
              '监听 document.visibilitychange。切到其他标签页或最小化窗口时触发；切回会显示离开时长。'),
          ),
        ),

        // 2. requestIdleCallback
        h(Card, { title: '2. requestIdleCallback 空闲回调', extra: this._capTag('idleCallback') },
          h('div', { class: 'flex flex-col gap-sm' },
            h('div', { class: 'flex flex-wrap gap-sm' },
              this._btn('调度 idle 任务', { type: 'primary', size: 'sm', onClick: () => this._runIdleTask() }),
              this._btn('调度 rAF 任务', { size: 'sm', onClick: () => this._runRafTask() }),
              this._btn('cancelIdleCallback', { size: 'sm', danger: true, onClick: () => this._cancelIdle() }),
            ),
            this.state.idleResults.length > 0
              ? h('div', { class: 'log-panel', style: { maxHeight: '120px' } },
                  ...this.state.idleResults.map((r) => h('div', { class: 'log-panel__line' },
                    h('span', { class: 'log-panel__time' }, r.time),
                    h('span', { class: 'log-panel__tag log-panel__tag--push' }, r.source),
                    h('span', {}, `timeRemaining=${r.timeRemaining.toFixed(1)}ms didTimeout=${r.didTimeout}`),
                  )),
                )
              : h('p', { class: 'fs-sm text-tertiary' },
                  '对比 requestIdleCallback（低优先级，浏览器空闲时执行）与 requestAnimationFrame（下一帧执行）。Safari 不支持时降级为 setTimeout。'),
          ),
        ),

        // 3. Fullscreen
        h(Card, { title: '3. Fullscreen 全屏', extra: this._capTag('fullscreen') },
          h('div', { class: 'flex flex-col gap-sm' },
            h('div', { class: 'flex flex-wrap gap-sm' },
              this._btn('进入全屏', {
                type: 'primary', size: 'sm', onClick: () => this._enterFullscreen(),
                disabled: !caps.fullscreen || this.state.isFullscreen,
              }),
              this._btn('退出全屏', {
                size: 'sm', onClick: () => this._exitFullscreen(),
                disabled: !this.state.isFullscreen,
              }),
            ),
            h('div', { class: 'flex items-center gap-sm' },
              h('span', { class: 'fs-sm text-secondary' }, 'fullscreenElement：'),
              h(Tag, { color: this.state.isFullscreen ? 'success' : 'default' },
                this.state.fullscreenElement || 'null'),
            ),
            h('div', {
              class: 'fullscreen-target',
              style: {
                padding: '24px', borderRadius: '8px',
                background: 'linear-gradient(135deg, #1677ff, #722ed1)',
                color: '#fff', textAlign: 'center', fontWeight: 'bold',
              },
            }, '全屏目标容器 — 点击「进入全屏」可将此区域铺满屏幕'),
            h('p', { class: 'fs-sm text-tertiary' },
              '调用 element.requestFullscreen() 进入，document.exitFullscreen() 退出，监听 fullscreenchange 事件。'),
          ),
        ),

        // 4. Vibration
        h(Card, { title: '4. Vibration 震动', extra: this._capTag('vibrate') },
          h('div', { class: 'flex flex-col gap-sm' },
            h('div', { class: 'flex flex-wrap gap-sm' },
              this._btn('vibrate(200)', {
                type: 'primary', size: 'sm', onClick: () => this._vibrate(200),
                disabled: !caps.vibrate,
              }),
              this._btn('vibrate([200,100,200])', {
                size: 'sm', onClick: () => this._vibrate([200, 100, 200]),
                disabled: !caps.vibrate,
              }),
              this._btn('vibrate(0) 取消', {
                size: 'sm', danger: true, onClick: () => this._vibrate(0),
                disabled: !caps.vibrate,
              }),
            ),
            h('p', { class: 'fs-sm text-tertiary' },
              'navigator.vibrate(pattern)：单次震动或 [震动,暂停,震动...] 模式；vibrate(0) 取消。多为移动端支持。'),
          ),
        ),

        // 5. Screen Wake Lock
        h(Card, { title: '5. Screen Wake Lock 屏幕保持唤醒', extra: this._capTag('wakeLock') },
          h('div', { class: 'flex flex-col gap-sm' },
            h('div', { class: 'flex items-center gap-sm' },
              h('span', { class: 'fs-sm text-secondary' }, '状态：'),
              h(Tag, { color: this.state.wakeLockActive ? 'success' : 'default' },
                this.state.wakeLockActive ? '活跃' : '未激活'),
            ),
            h('div', { class: 'flex flex-wrap gap-sm' },
              this._btn('request(screen)', {
                type: 'primary', size: 'sm',
                onClick: () => this._requestWakeLock(),
                disabled: !caps.wakeLock || this.state.wakeLockActive,
              }),
              this._btn('release', {
                size: 'sm', danger: true,
                onClick: () => this._releaseWakeLock(),
                disabled: !this.state.wakeLockActive,
              }),
            ),
            h('p', { class: 'fs-sm text-tertiary' },
              'navigator.wakeLock.request("screen") 阻止屏幕熄灭。页面切后台时系统自动释放，切回前台会重新请求。需 HTTPS。'),
          ),
        ),

        // 6. Battery
        h(Card, { title: '6. Battery 电池', extra: this._capTag('battery') },
          h('div', { class: 'flex flex-col gap-sm' },
            batteryPct != null
              ? h('div', { class: 'api-metric', style: { fontSize: '36px' } }, `${batteryPct}%`)
              : h('div', { class: 'fs-sm text-tertiary' }, '（不支持或未连接）'),
            h('div', { class: 'fs-sm' },
              h('div', {}, h('strong', {}, '充电：'),
                this.state.batteryCharging == null ? 'N/A'
                  : h(Tag, { color: this.state.batteryCharging ? 'success' : 'default' },
                    String(this.state.batteryCharging))),
              h('div', { class: 'mt-sm' }, h('strong', {}, '充满还需：'),
                this._formatBatteryTime(this.state.batteryChargingTime)),
              h('div', {}, h('strong', {}, '放电时长：'),
                this._formatBatteryTime(this.state.batteryDischargingTime)),
            ),
            h('p', { class: 'fs-sm text-tertiary' },
              'navigator.getBattery() 返回 BatteryManager，监听 levelchange / chargingchange 事件。Firefox 已移除支持。'),
          ),
        ),

        // 7. Network Information
        h(Card, { title: '7. Network Information 网络信息', extra: this._capTag('connection') },
          h('div', { class: 'flex flex-col gap-sm' },
            this.state.networkType != null
              ? h('div', { class: 'flex items-center gap-sm' },
                  h('span', { class: 'fs-sm text-secondary' }, 'effectiveType：'),
                  h(Tag, { color: 'primary' }, this.state.networkType),
                )
              : h('div', { class: 'fs-sm text-tertiary' }, '（不支持）'),
            h('div', { class: 'fs-sm' },
              h('div', {}, h('strong', {}, '下行带宽：'),
                this.state.networkDownlink != null ? `${this.state.networkDownlink} Mbps` : 'N/A'),
              h('div', { class: 'mt-sm' }, h('strong', {}, '往返时延：'),
                this.state.networkRtt != null ? `${this.state.networkRtt} ms` : 'N/A'),
              h('div', {}, h('strong', {}, '省流模式：'),
                this.state.networkSaveData != null ? String(this.state.networkSaveData) : 'N/A'),
            ),
            h('p', { class: 'fs-sm text-tertiary' },
              'navigator.connection 读取 effectiveType / downlink / rtt / saveData，监听 change 事件。'),
          ),
        ),

        // 8. Web Share
        h(Card, { title: '8. Web Share 系统分享', extra: this._capTag('share') },
          h('div', { class: 'flex flex-col gap-sm' },
            this._btn('分享当前页面', {
              type: 'primary', size: 'sm', onClick: () => this._share(),
              disabled: !caps.share,
            }),
            h('p', { class: 'fs-sm text-tertiary' },
              `navigator.share({ title, text, url }) 调起系统分享面板。当前 URL：${window.location.href}`),
            h('p', { class: 'fs-sm text-tertiary' },
              '需 HTTPS 且多为移动端有效；桌面端 Chrome/Edge 亦可调用。'),
          ),
        ),
      ),

      // 事件日志
      h(Card, { title: '事件日志', extra: h('span', { class: 'fs-sm text-tertiary' }, '实时') },
        h('div', { class: 'log-panel' },
          ...this.state.logs.map((log) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', {}, log.content),
          )),
        ),
      ),
    ];
  }
}
