// =====================================================================
// EditContextActivationPage.js —— EditContext 与用户激活 实验室
// 演示 2024-2025 浏览器两大文本输入/权限原语：
//   1. User Activation API —— navigator.userActivation 统一描述用户激活状态：
//      hasBeenActive（粘性激活：本次会话曾激活过，置位后不再回落），
//      isActive（瞬时激活：最近几秒内发生过用户手势，会随时间衰减）。
//      是 Clipboard/Fullscreen/PiP/WebShare/屏幕捕获等权限敏感 API 的
//      统一前置判断，避免 try/catch 反复试错。
//   2. EditContext 基础 —— new EditContext() 构造，element.editContext = ctx
//      绑定到任意元素；ctx.updateText/updateSelection/updateCompositionRange
//      由作者完全控制 DOM 渲染；作为 contentEditable 的现代替代，
//      原生接收 IME/虚拟键盘/手写输入。CodeMirror/Monaco/Google Docs 已采用。
//   3. EditContext 事件 —— textupdate（文本变更：updateRangeStart/End、text、
//      selectionStart/End）、textformatupdate（IME 强调样式如中文输入下划线：
//      getTextFormats()）、characterboundsupdate（请求字符边界用于绘制光标：
//      rangeStart/End）、compositionstart/end（IME 组合开始/结束）。
//   4. EditContext vs contentEditable 对比 —— 渲染控制/IME 支持/性能/复杂度/
//      适用场景的决策矩阵。
//   5. 用户激活与权限 API 协同 —— 依赖用户激活的 API 清单（clipboard.read/write、
//      fullscreen、PiP、WebShare、getDisplayMedia、Keyboard.lock、WakeLock），
//      激活消耗规则（部分消耗瞬时激活、部分不消耗），
//      Transient vs Sticky vs Activated state 三态模型，
//      用 navigator.userActivation 预检避免 try/catch。
// 说明：所有特性调用前做 typeof/in 能力检测，不可用时仅记日志，绝不抛异常。
//       jsdom/Node 下 navigator.userActivation 与 EditContext 多半不存在，
//       能力检测 + 日志兜底即可，真实浏览器方可观测事件回调。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class EditContextActivationPage extends Page {
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      activationState: '',
      editContextInfo: '',
      editContextEvents: '',
      matrixInfo: '',
      permissionInfo: '',
    };
  }

  componentDidMount() {
    if (this._inited) return;
    this._inited = true;

    this._injectedStyles = [];
    this._ecInstance = null;
    this._ecBound = false;
    this._ecEventsAttached = false;

    const caps = this._caps();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `navigator.userActivation ${c(caps.userActivation)}`,
      `EditContext ${c(caps.editContext)}`,
      `element.editContext ${c(caps.editContextOnElement)}`,
      `clipboard.read ${c(caps.clipboardRead)}`,
      `fullscreen ${c(caps.fullscreen)}`,
      `wakeLock ${c(caps.wakeLock)}`,
      `webShare ${c(caps.webShare)}`,
    ];

    const summary = `EditContext 与用户激活能力检测：${parts.join(' · ')}。`
      + 'jsdom/Node 下 navigator.userActivation 与 EditContext 多半不可用，'
      + '真实浏览器方可观测事件回调与激活状态变化。';

    this.setState({
      capsSummary: summary,
      logs: [...this.state.logs, { type: 'info', content: `能力检测：${parts.join('，')}`, time: formatTime() }].slice(-40),
    });

    if (!caps.userActivation) this._addLog('warn', 'navigator.userActivation 不可用（Chrome 72+），演示仅记日志');
    if (!caps.editContext) this._addLog('warn', 'EditContext 不可用（Chrome 121+），演示仅记日志');
    if (caps.editContext && !caps.editContextOnElement) this._addLog('warn', 'EditContext 存在但 element.editContext 绑定未实现');

    this._injectDemoStyles();
  }

  componentWillUnmount() {
    if (Array.isArray(this._injectedStyles)) {
      this._injectedStyles.forEach((el) => el?.remove());
      this._injectedStyles = [];
    }
    // 解除 EditContext 绑定与事件监听引用，避免泄漏
    try {
      if (this._ecInstance && typeof this._ecInstance === 'object') {
        this._ecInstance = null;
      }
    } catch { /* noop */ }
    this._ecBound = false;
    this._ecEventsAttached = false;
  }

  _addLog(type, content) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  _injectStyle(id, textContent) {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = textContent;
    document.head.appendChild(style);
    this._injectedStyles.push(style);
    return style;
  }

  _caps() {
    let userActivation = false;
    try { userActivation = typeof navigator !== 'undefined' && navigator.userActivation !== undefined; } catch { userActivation = false; }
    let editContext = false;
    try { editContext = typeof EditContext !== 'undefined'; } catch { editContext = false; }
    let editContextOnElement = false;
    try { editContextOnElement = typeof HTMLElement !== 'undefined' && 'editContext' in HTMLElement.prototype; } catch { editContextOnElement = false; }
    let clipboardRead = false;
    try { clipboardRead = typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.read === 'function'; } catch { clipboardRead = false; }
    let fullscreen = false;
    try { fullscreen = typeof document !== 'undefined' && typeof document.documentElement.requestFullscreen === 'function'; } catch { fullscreen = false; }
    let wakeLock = false;
    try { wakeLock = typeof navigator !== 'undefined' && navigator.wakeLock !== undefined; } catch { wakeLock = false; }
    let webShare = false;
    try { webShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'; } catch { webShare = false; }
    return {
      userActivation, editContext, editContextOnElement,
      clipboardRead, fullscreen, wakeLock, webShare,
    };
  }

  _injectDemoStyles() {
    this._injectStyle('ec-activation-demo', `
      .ec-demo-box { border: 1px dashed #cbd5e1; border-radius: 6px; padding: 12px; margin-top: 8px; background: #fff; }
      .ec-edit-canvas {
        border: 1px solid #94a3b8; border-radius: 6px; min-height: 60px; padding: 10px;
        background: #f8fafc; color: #0f172a; outline: none; font-family: ui-monospace, monospace;
        white-space: pre-wrap; word-break: break-all; margin-top: 8px;
      }
      .ec-edit-canvas:focus { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,.15); }
      .ec-matrix { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
      .ec-matrix th, .ec-matrix td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; vertical-align: top; }
      .ec-matrix thead th { background: #f1f5f9; color: #1e293b; font-weight: 600; }
      .ec-matrix tbody tr:nth-child(even) { background: #fafbfc; }
      .ec-matrix .ec-col-dim { width: 22%; font-weight: 600; color: #334155; background: #f8fafc; }
      .ec-activation-badge {
        display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px;
        border-radius: 999px; font-size: 12px; font-weight: 600; border: 1px solid transparent;
      }
      .ec-activation-badge--active { background: #dcfce7; color: #166534; border-color: #86efac; }
      .ec-activation-badge--inactive { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
      .ec-activation-badge--unknown { background: #f1f5f9; color: #475569; border-color: #cbd5e1; }
      .ec-perm-list { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
      .ec-perm-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 6px; background: #fff; }
      .ec-perm-row code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 12px; color: #1e40af; }
    `);
  }

  // ============ Card 1：User Activation API ============

  _checkActivation() {
    // 此按钮的点击本身即用户手势，调用后真实浏览器中 hasBeenActive 应为 true
    const caps = this._caps();
    if (!caps.userActivation) {
      this._addLog('warn', 'navigator.userActivation 不可用，仅说明：hasBeenActive=会话曾激活（粘性），isActive=最近数秒内手势（瞬时）');
      this.setState({ activationState: '当前环境不支持 navigator.userActivation（仅记日志）' });
      return;
    }
    try {
      const ua = navigator.userActivation;
      const sticky = ua.hasBeenActive;
      const transient = ua.isActive;
      this._addLog('info', `userActivation → hasBeenActive=${sticky}（粘性）, isActive=${transient}（瞬时）`);
      this.setState({
        activationState: `当前激活状态：hasBeenActive=${sticky}（粘性/会话曾激活） · isActive=${transient}（瞬时/最近数秒内手势）`,
      });
    } catch (err) {
      this._addLog('warn', '读取 userActivation 失败：' + (err && err.message));
    }
  }

  _triggerGesture() {
    // 该 onClick 由用户点击触发，本身就是一次"用户激活"手势
    this._addLog('info', '已触发用户手势（按钮点击即用户激活）—— 真实浏览器中此后 hasBeenActive 将置 true、isActive 短暂为 true');
    const caps = this._caps();
    if (!caps.userActivation) {
      this.setState({ activationState: '不支持 userActivation：点击后理论上 hasBeenActive=true（本次会话已激活），isActive=true（瞬时）' });
      return;
    }
    try {
      const ua = navigator.userActivation;
      const sticky = ua.hasBeenActive;
      const transient = ua.isActive;
      this._addLog('info', `手势后 userActivation → hasBeenActive=${sticky}, isActive=${transient}`);
      this.setState({
        activationState: `手势后状态：hasBeenActive=${sticky}（点击后应为 true） · isActive=${transient}（瞬时，数秒后回落）`,
      });
    } catch (err) {
      this._addLog('warn', '读取 userActivation 失败：' + (err && err.message));
    }
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const badgeColor = caps.userActivation ? 'success' : 'error';
    return h(Card, {
      title: 'Card 1 · User Activation API',
      extra: h(Tag, { color: badgeColor }, caps.userActivation ? '已支持' : '未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'navigator.userActivation 统一描述用户激活状态：hasBeenActive（粘性激活——本次会话曾激活过，置位后不再回落）；' +
        'isActive（瞬时激活——最近数秒内发生过用户手势，会随时间衰减）。' +
        '是 Clipboard/Fullscreen/PiP/WebShare/屏幕捕获等权限敏感 API 的统一前置判断，避免 try/catch 反复试错。'),
      h('div', { class: 'ec-demo-box' },
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          caps.userActivation
            ? h('span', { class: 'ec-activation-badge ec-activation-badge--active' }, 'hasBeenActive: 运行时读取')
            : h('span', { class: 'ec-activation-badge ec-activation-badge--unknown' }, 'hasBeenActive: 不可用'),
          caps.userActivation
            ? h('span', { class: 'ec-activation-badge ec-activation-badge--active' }, 'isActive: 运行时读取')
            : h('span', { class: 'ec-activation-badge ec-activation-badge--unknown' }, 'isActive: 不可用'),
        ),
        h('p', { class: 'fs-sm text-secondary mt-sm' },
          '展示规则：页面加载后 hasBeenActive=false；点击下方任意按钮（即用户手势）后变 true 并保持；' +
          'isActive 仅在最近数秒内有手势时为 true，随后回落为 false。'),
      ),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('检查激活状态', { type: 'primary', size: 'sm', onClick: () => this._checkActivation() }),
        this._btn('触发手势（模拟点击）', { type: 'default', size: 'sm', onClick: () => this._triggerGesture() }),
      ),
      s.activationState ? h('p', { class: 'fs-sm mt-sm text-secondary' }, s.activationState) : null,
      h('pre', { class: 'code-block mt-md' },
`// 粘性 vs 瞬时
if (navigator.userActivation.hasBeenActive) { /* 会话曾激活：可做一次性授权 */ }
if (navigator.userActivation.isActive) { /* 瞬时激活：可调用消耗型 API */ }
// 权限敏感 API 前置判断，避免 try/catch 反复试错`),
    );
  }

  // ============ Card 2：EditContext 基础 ============

  _createEditContext() {
    const caps = this._caps();
    if (!caps.editContext) {
      this._addLog('warn', 'EditContext 不可用（Chrome 121+），仅说明：new EditContext() → element.editContext = ctx → ctx.updateText()');
      this.setState({ editContextInfo: '当前环境不支持 EditContext（仅记日志）' });
      return;
    }
    const host = this.$('#ec-edit-canvas');
    if (!host) { this._addLog('warn', '未找到 EditContext 宿主元素'); return; }
    try {
      const ctx = new EditContext();
      // 绑定到任意元素（div），该元素即成为文本输入宿主
      if (caps.editContextOnElement) {
        host.editContext = ctx;
        this._ecBound = true;
      } else {
        this._addLog('warn', 'element.editContext 绑定未实现，仅创建实例');
      }
      this._ecInstance = ctx;
      // 作者完全控制 DOM 渲染：updateText 设置文本与可控范围
      if (typeof ctx.updateText === 'function') {
        ctx.updateText('Hello EditContext', 0, 0);
      }
      if (typeof ctx.updateSelection === 'function') {
        ctx.updateSelection(0, 0);
      }
      if (typeof ctx.updateCompositionRange === 'function') {
        ctx.updateCompositionRange(0, 0);
      }
      this._addLog('info', `EditContext 已创建${this._ecBound ? '并绑定到 #ec-edit-canvas' : '（绑定未实现）'}，updateText/updateSelection/updateCompositionRange 已调用`);
      this.setState({
        editContextInfo: `EditContext 已创建${this._ecBound ? '并绑定' : '（绑定未实现）'}；'Hello EditContext' 已写入（作者负责渲染 DOM）`,
      });
      // 同步把文本渲染到宿主 div，演示"作者完全控制渲染"
      try { host.textContent = 'Hello EditContext'; } catch { /* noop */ }
    } catch (err) {
      this._addLog('warn', '创建 EditContext 失败：' + (err && err.message));
    }
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    return h(Card, {
      title: 'Card 2 · EditContext 基础',
      extra: h(Tag, { color: caps.editContext ? 'success' : 'error' }, caps.editContext ? '已支持' : '未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'new EditContext() 构造；element.editContext = ctx 绑定到任意元素；ctx.updateText(text, start, end) 更新文本；' +
        'ctx.updateSelection(start, end) 更新选区；ctx.updateCompositionRange(start, end) 更新 IME 组合范围。' +
        '作为 contentEditable 的现代替代，作者完全控制 DOM 渲染；原生接收 IME/虚拟键盘/手写输入。'),
      h('div', { class: 'ec-demo-box' },
        h('p', { class: 'fs-sm text-secondary' }, '下面是一个普通 div，绑定 EditContext 后由作者控制渲染：'),
        h('div', { id: 'ec-edit-canvas', class: 'ec-edit-canvas', tabindex: '0' },
          '（点击"创建 EditContext 并绑定"后这里会显示初始文本）'),
      ),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('创建 EditContext 并绑定', { type: 'primary', size: 'sm', onClick: () => this._createEditContext() }),
        caps.editContextOnElement ? h(Tag, { color: 'success' }, 'element.editContext ✓') : h(Tag, { color: 'error' }, 'element.editContext ✗'),
      ),
      s.editContextInfo ? h('p', { class: 'fs-sm mt-sm text-secondary' }, s.editContextInfo) : null,
      h('pre', { class: 'code-block mt-md' },
`const ctx = new EditContext();
hostDiv.editContext = ctx;          // 绑定到任意元素
ctx.updateText('Hello', 0, 0);      // 文本与变更范围
ctx.updateSelection(0, 5);          // 选区
ctx.updateCompositionRange(0, 0);   // IME 组合范围
// 作者负责把文本渲染到 DOM；浏览器负责 IME/虚拟键盘事件分发`),
    );
  }

  // ============ Card 3：EditContext 事件 ============

  _attachEditContextEvents() {
    const caps = this._caps();
    if (!caps.editContext) {
      this._addLog('warn', 'EditContext 不可用，仅说明事件签名：textupdate/textformatupdate/characterboundsupdate/compositionstart/end');
      this.setState({ editContextEvents: '当前环境不支持 EditContext（事件签名见代码块）' });
      return;
    }
    // 若尚未创建实例，先创建一个用于演示绑定
    if (!this._ecInstance) {
      try {
        this._ecInstance = new EditContext();
        const host = this.$('#ec-edit-canvas');
        if (host && caps.editContextOnElement) {
          host.editContext = this._ecInstance;
          this._ecBound = true;
        }
      } catch (err) {
        this._addLog('warn', '创建 EditContext 失败：' + (err && err.message));
        return;
      }
    }
    if (this._ecEventsAttached) {
      this._addLog('info', '事件监听已存在，无需重复注册');
      return;
    }
    const ctx = this._ecInstance;
    try {
      // EditContext 是 EventTarget，事件直接在实例上监听
      if (typeof ctx.addEventListener === 'function') {
        ctx.addEventListener('textupdate', (e) => {
          this._addLog('info',
            `textupdate → updateRangeStart=${e.updateRangeStart} updateRangeEnd=${e.updateRangeEnd} text="${e.text}" selectionStart=${e.selectionStart} selectionEnd=${e.selectionEnd}`);
        });
        ctx.addEventListener('textformatupdate', (e) => {
          let formats = '(无法读取)';
          try { formats = JSON.stringify(e.getTextFormats()); } catch { formats = '(getTextFormats 不可用)'; }
          this._addLog('info', `textformatupdate → getTextFormats()=${formats}（IME 强调样式如下划线）`);
        });
        ctx.addEventListener('characterboundsupdate', (e) => {
          this._addLog('info', `characterboundsupdate → rangeStart=${e.rangeStart} rangeEnd=${e.rangeEnd}（请求字符边界用于绘制光标）`);
        });
        ctx.addEventListener('compositionstart', () => {
          this._addLog('info', 'compositionstart → IME 组合开始');
        });
        ctx.addEventListener('compositionend', () => {
          this._addLog('info', 'compositionend → IME 组合结束');
        });
        this._ecEventsAttached = true;
        this._addLog('info', '已在 EditContext 上注册 textupdate/textformatupdate/characterboundsupdate/compositionstart/compositionend 监听');
        this.setState({ editContextEvents: '事件已注册：textupdate / textformatupdate / characterboundsupdate / compositionstart / compositionend（真实浏览器中输入文本可观测回调）' });
      } else {
        this._addLog('warn', 'EditContext 不支持 addEventListener（非 EventTarget）');
      }
    } catch (err) {
      this._addLog('warn', '注册事件失败：' + (err && err.message));
    }
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    return h(Card, {
      title: 'Card 3 · EditContext 事件',
      extra: h(Tag, { color: caps.editContext ? 'success' : 'error' }, caps.editContext ? '已支持' : '未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'textupdate 事件（e.updateRangeStart/End、e.text、e.selectionStart/End——文本变更）；' +
        'textformatupdate 事件（e.getTextFormats()——IME 强调样式如中文输入下划线）；' +
        'characterboundsupdate 事件（e.rangeStart/End——请求字符边界用于绘制光标）；' +
        'compositionstart/end 事件（IME 组合开始/结束）。'),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('注册事件监听', { type: 'primary', size: 'sm', onClick: () => this._attachEditContextEvents() }),
        this._ecEventsAttached ? h(Tag, { color: 'success' }, '已注册') : h(Tag, { color: 'default' }, '未注册'),
      ),
      s.editContextEvents ? h('p', { class: 'fs-sm mt-sm text-secondary' }, s.editContextEvents) : null,
      h('pre', { class: 'code-block mt-md' },
`ctx.addEventListener('textupdate', e => {
  // e.updateRangeStart / e.updateRangeEnd / e.text / e.selectionStart / e.selectionEnd
});
ctx.addEventListener('textformatupdate', e => {
  e.getTextFormats(); // IME 强调样式（下划线/背景色）
});
ctx.addEventListener('characterboundsupdate', e => {
  // e.rangeStart / e.rangeEnd —— 请求字符边界用于绘制光标
});
ctx.addEventListener('compositionstart', e => {});
ctx.addEventListener('compositionend', e => {});`),
    );
  }

  // ============ Card 4：EditContext vs contentEditable 对比 ============

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const rows = [
      { dim: '渲染控制', ec: '作者完全控制 DOM（自绘文本/光标/选区）', ce: '浏览器控制，作者通过 execCommand 或 Selection 间接操作' },
      { dim: 'IME 支持', ec: '原生事件（textformatupdate/characterboundsupdate），中文/日文输入法友好', ce: '依赖浏览器 hack，组合输入行为不一致' },
      { dim: '性能', ec: '无强制重排，作者按需渲染，适合大文档', ce: '每次输入触发 DOM 重排，大文档卡顿' },
      { dim: '复杂度', ec: '需自己渲染文本/光标/选区，上手成本高', ce: '开箱即用，contenteditable="true" 即可编辑' },
      { dim: '适用场景', ec: 'CodeMirror / Monaco / Google Docs 等高性能编辑器', ce: '简单富文本、评论框、笔记应用' },
    ];
    return h(Card, {
      title: 'Card 4 · EditContext vs contentEditable 对比',
      extra: h(Tag, { color: caps.editContext ? 'success' : 'error' }, caps.editContext ? 'EC 已支持' : 'EC 未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'EditContext 把"文本输入"与"DOM 渲染"解耦：浏览器负责 IME/虚拟键盘/手写事件分发，作者负责渲染；' +
        'contentEditable 把两者耦合，简单但难做高性能编辑器。下表为决策矩阵。'),
      h('table', { class: 'ec-matrix' },
        h('thead', {},
          h('tr', {},
            h('th', { class: 'ec-col-dim' }, '维度'),
            h('th', {}, 'EditContext'),
            h('th', {}, 'contentEditable'),
          ),
        ),
        h('tbody', {},
          rows.map((r) => h('tr', {},
            h('td', { class: 'ec-col-dim' }, r.dim),
            h('td', {}, r.ec),
            h('td', {}, r.ce),
          )),
        ),
      ),
      h('p', { class: 'fs-sm mt-sm text-secondary' },
        s.matrixInfo || '决策建议：需要高性能/大文档/复杂 IME 支持 → EditContext；需要快速搭建简单富文本 → contentEditable。'),
      h('pre', { class: 'code-block mt-md' },
`// EditContext：作者全控渲染
const ctx = new EditContext();
host.editContext = ctx;
ctx.addEventListener('textupdate', e => {
  host.textContent = ctx.text; // 自行渲染
});

// contentEditable：浏览器控渲染
<div contenteditable="true">可直接编辑</div>`),
    );
  }

  // ============ Card 5：用户激活与权限 API 协同 ============

  _preflightPermission(apiName) {
    const caps = this._caps();
    if (!caps.userActivation) {
      this._addLog('warn', `userActivation 不可用，无法为 ${apiName} 做预检（真实浏览器可用 navigator.userActivation 预检避免 try/catch）`);
      return;
    }
    try {
      const ua = navigator.userActivation;
      const ok = ua.isActive || ua.hasBeenActive;
      this._addLog('info', `${apiName} 预检：isActive=${ua.isActive} hasBeenActive=${ua.hasBeenActive} → ${ok ? '可尝试调用' : '需用户手势'}`);
      this.setState({ permissionInfo: `${apiName} 预检结果：isActive=${ua.isActive} · hasBeenActive=${ua.hasBeenActive} → ${ok ? '可调用' : '需先触发用户手势'}` });
    } catch (err) {
      this._addLog('warn', `${apiName} 预检失败：` + (err && err.message));
    }
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const perms = [
      { name: 'clipboard.read', code: 'navigator.clipboard.read()', cap: caps.clipboardRead, consume: '消耗瞬时激活' },
      { name: 'clipboard.write', code: 'navigator.clipboard.writeText()', cap: caps.clipboardRead, consume: '消耗瞬时激活（部分浏览器粘性即可）' },
      { name: 'fullscreen', code: 'el.requestFullscreen()', cap: caps.fullscreen, consume: '消耗瞬时激活（粘性后可退出）' },
      { name: 'PiP', code: 'video.requestPictureInPicture()', cap: typeof document !== 'undefined' && typeof document.pictureInPictureEnabled === 'boolean' ? document.pictureInPictureEnabled : false, consume: '消耗瞬时激活' },
      { name: 'WebShare', code: 'navigator.share()', cap: caps.webShare, consume: '消耗瞬时激活' },
      { name: 'getDisplayMedia', code: 'navigator.mediaDevices.getDisplayMedia()', cap: typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function', consume: '消耗瞬时激活（需持续手势）' },
      { name: 'Keyboard.lock', code: 'Keyboard.lock([...])', cap: typeof Keyboard !== 'undefined' && typeof Keyboard.lock === 'function', consume: '消耗瞬时激活' },
      { name: 'WakeLock', code: 'navigator.wakeLock.request("screen")', cap: caps.wakeLock, consume: '不消耗激活（需页面可见）' },
    ];
    return h(Card, {
      title: 'Card 5 · 用户激活与权限 API 协同',
      extra: h(Tag, { color: caps.userActivation ? 'success' : 'error' }, caps.userActivation ? '预检可用' : '预检不可用'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        '依赖用户激活的 API：clipboard.read/write、fullscreen、PiP、WebShare、getDisplayMedia、Keyboard.lock、WakeLock。' +
        '激活消耗规则：部分 API 消耗瞬时激活（调用后 isActive 回落），部分不消耗（如 WakeLock）。' +
        '三态模型：Transient activation（瞬时，数秒）vs Sticky activation（粘性，会话级）vs Activated state（已激活）。' +
        '用 navigator.userActivation 预检可避免 try/catch 反复试错。'),
      h('div', { class: 'ec-perm-list' },
        perms.map((p) => h('div', { class: 'ec-perm-row' },
          h('code', {}, p.code),
          h(Tag, { color: p.cap ? 'success' : 'error' }, p.cap ? '已支持' : '未支持'),
          h('span', { class: 'fs-sm text-secondary' }, p.consume),
          this._btn('预检', { type: 'default', size: 'sm', onClick: () => this._preflightPermission(p.name) }),
        )),
      ),
      s.permissionInfo ? h('p', { class: 'fs-sm mt-sm text-secondary' }, s.permissionInfo) : null,
      h('pre', { class: 'code-block mt-md' },
`// 三态模型
// Transient activation: 瞬时，最近数秒内有手势（isActive）
// Sticky activation:    粘性，会话曾激活（hasBeenActive）
// Activated state:      已激活（粘性后保持）

// 预检避免 try/catch 反复试错
if (navigator.userActivation.isActive) {
  await navigator.clipboard.read();      // 消耗瞬时激活
}
if (navigator.userActivation.hasBeenActive) {
  await navigator.wakeLock.request('screen'); // 不消耗激活，粘性即可
}`),
    );
  }

  // ============ 日志面板 ============

  _renderLogPanel() {
    const s = this.state;
    return h(Card, {
      title: '事件日志',
      extra: h('span', { class: 'fs-sm text-tertiary' }, `${s.logs.length} 条`),
    },
      h('div', { class: 'log-panel' },
        s.logs.length === 0
          ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
          : s.logs.map((log) => h('div', { class: 'log-panel__line' },
              h('span', { class: 'log-panel__time' }, log.time),
              h('span', { class: `log-panel__tag log-panel__tag--${log.type === 'error' ? 'error' : 'info'}` }, log.type),
              h('span', { class: 'log-panel__content' }, log.content),
            )),
      ),
    );
  }

  renderPage() {
    const s = this.state;
    return [
      h('h2', { class: 'section-title' }, 'EditContext 与用户激活 实验室'),

      h(Alert, {
        type: 'info',
        message: 'EditContext 与用户激活',
        description: '演示 navigator.userActivation（hasBeenActive 粘性 / isActive 瞬时）、EditContext 基础（updateText/updateSelection/updateCompositionRange）、EditContext 事件（textupdate/textformatupdate/characterboundsupdate/composition）、EditContext vs contentEditable 决策矩阵、用户激活与权限 API 协同（clipboard/fullscreen/PiP/WebShare/getDisplayMedia/Keyboard.lock/WakeLock）。所有特性通过能力检测，不支持时记日志不报错；jsdom/Node 下多数 API 不存在，真实浏览器方可观测事件回调与激活状态变化。',
      }),

      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,

      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),

      this._renderLogPanel(),
    ];
  }
}
