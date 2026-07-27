// =====================================================================
// CSSFormColorPage.js —— CSS 表单伪类与颜色空间 实验室
// 演示 MDN 2023-2025 CSS 表单伪类与颜色空间特性：
//   1. :user-valid / :user-invalid 伪类 —— 区别于 :valid/:invalid（页面加载即
//      匹配），:user-valid/:user-invalid 仅在用户已交互（blur 或修改）后才匹配，
//      解决"页面一加载就一片红"痛点（Chrome 119+/Edge 119+）
//   2. text-underline-offset / text-decoration-thickness —— 像素级控制下划线
//      偏移与粗细，避开下行字母（g/y/p）；配合 text-decoration-skip-ink: none|auto|all
//   3. CSS Containment (contain) —— contain: layout|paint|size|style|strict(=layout
//      paint size)|content(=layout paint)|inline-size；隔离元素重排/重绘/尺寸/
//      样式计算范围；是 content-visibility 生效前提；对长列表/虚拟滚动/卡片网格
//      /广告 iframe 性能关键
//   4. CSS color() 函数与 color-space —— color(display-p3 1 0 0) 显式声明颜色
//      空间；oklch()/lab()/lch()/oklab() 感知均匀颜色空间；Display P3/sRGB/rec2020
//      色域；color-mix(in oklch, ...)；渐变 color-interpolation-method
//   5. 相对颜色与 color-mix 进阶 —— rgb(from red r g b / calc(a+0.1)) 相对颜色
//      from 语法；color-mix(in srgb, red, blue 40%)；light-dark() 函数
//   6. prefers-color-scheme 与 color-scheme 协同 —— @media (prefers-color-scheme:
//      dark) + color-scheme: light dark 声明 + light-dark() 函数；matchMedia JS
//      检测；vs 手动 .dark 类
// 说明：所有特性调用前做 typeof / CSS.supports 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。jsdom 不做真实 CSS 渲染，但
//       CSS.supports 通常可用；:user-invalid / color() / oklch() / light-dark() /
//       contain 等较新特性 jsdom 可能不识别，统一 try/catch 兜底。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { Props, State } from '../../core/types.js';

interface LogEntry { type: string; content: string; time: string; }

interface CSSFormColorPageState extends State {
  logs: LogEntry[];
  capsSummary: string;
  userValidInfo: string;
  underlineInfo: string;
  containInfo: string;
  colorFnInfo: string;
  colorMixInfo: string;
  schemeInfo: string;
}

interface BtnOpts extends Props {
  type?: string;
  size?: string;
  disabled?: boolean;
  danger?: boolean;
  loading?: boolean;
  onClick: (e: MouseEvent) => void;
}

export class CSSFormColorPage extends Page {
  declare state: CSSFormColorPageState;
  _inited: boolean = false;
  _injectedStyles: any[] = [];
  _containMode: string = '';
  _darkSimOn: boolean = false;


  // —— 初始 state ——
  initialState(): CSSFormColorPageState {
    return {
      logs: [],
      capsSummary: '',
      // Card 1：:user-valid / :user-invalid
      userValidInfo: '',
      // Card 2：text-underline-offset / text-decoration-thickness
      underlineInfo: '',
      // Card 3：CSS Containment
      containInfo: '',
      // Card 4：color() 函数与 color-space
      colorFnInfo: '',
      // Card 5：相对颜色与 color-mix 进阶
      colorMixInfo: '',
      // Card 6：prefers-color-scheme 与 color-scheme
      schemeInfo: '',
    };
  }

  // —— 生命周期 ——
  componentDidMount(): void {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._injectedStyles = [];
    this._containMode = 'strict';     // Card 3 当前 contain 值
    this._darkSimOn = false;          // Card 6 是否手动模拟深色

    // 一次性能力检测：表单伪类 + 颜色空间全家桶
    const caps = this._caps();
    const c = (ok: boolean) => ok ? '✓' : '✗';
    const parts = [
      `CSS ${c(caps.css)}`, `supports ${c(caps.supports)}`,
      `:user-invalid ${c(caps.userValid)}`,
      `text-underline-offset ${c(caps.underlineOffset)}`,
      `text-decoration-thickness ${c(caps.decorationThickness)}`,
      `text-decoration-skip-ink ${c(caps.skipInk)}`,
      `contain:strict ${c(caps.contain)}`,
      `contain:layout ${c(caps.containLayout)}`,
      `contain:paint ${c(caps.containPaint)}`,
      `color() ${c(caps.colorFn)}`,
      `oklch() ${c(caps.oklch)}`,
      `color-mix() ${c(caps.colorMix)}`,
      `light-dark() ${c(caps.lightDark)}`,
      `rgb(from...) ${c(caps.relativeColor)}`,
      `prefers-color-scheme ${c(caps.prefersColorScheme)}`,
    ];

    const summary = caps.css
      ? `CSS 表单伪类与颜色空间能力检测：${parts.join(' · ')}。jsdom 不做真实 CSS 渲染，但 CSS.supports 通常可用；:user-invalid / color() / oklch() / light-dark() / contain 等较新特性 jsdom 可能不识别，按钮将仅记日志说明。在真实浏览器中打开可完整演示。`
      : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。';

    this.setState({ capsSummary: summary });
    this._addLog(caps.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!caps.userValid) this._addLog('warn', ':user-invalid 不可用或 jsdom 未识别（Chrome 119+/Edge 119+），演示仅记日志');
    if (!caps.colorFn) this._addLog('warn', 'color(display-p3 ...) 不可用或 jsdom 未识别（Chrome 111+），演示仅记日志');
    if (!caps.oklch) this._addLog('warn', 'oklch() 不可用或 jsdom 未识别（Chrome 111+），演示仅记日志');
    if (!caps.lightDark) this._addLog('warn', 'light-dark() 不可用或 jsdom 未识别（Chrome 123+），演示仅记日志');

    // 一次性注入全部演示样式（仅一次；rerender 不会移除 head 中的 style）
    this._injectDemoStyles();
  }

  componentWillUnmount(): void {
    // 移除动态创建的 <style> 元素，便于 GC
    if (Array.isArray(this._injectedStyles)) {
      this._injectedStyles.forEach((el) => { try { el && el.remove(); } catch { /* noop */ } });
      this._injectedStyles = [];
    }
  }

  // —— 日志 / 按钮辅助 ——

  _addLog(type: string, content: string): void {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label: string, opts: BtnOpts): Node {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render() as Node;
  }

  _injectStyle(id: string, textContent: string): HTMLStyleElement {
    const existing = (document.getElementById(id) as any);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = textContent;
    document.head.appendChild(style);
    this._injectedStyles.push(style);
    return style;
  }

  // 返回布尔能力对象（供 capsSummary / Card Tag 使用）
  _caps(): any {
    const hasCSS = typeof CSS !== 'undefined';
    const supportsPV = (p: string, v: string) => {
      try { return hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v); }
      catch { return false; }
    };
    let prefersColorScheme = false;
    try {
      prefersColorScheme = typeof window !== 'undefined' && window.matchMedia
        && window.matchMedia('(prefers-color-scheme: dark)').matches !== undefined;
    } catch { prefersColorScheme = false; }
    return {
      css: hasCSS,
      supports: hasCSS && typeof CSS.supports === 'function',
      // Card 1
      userValid: supportsPV('selector', ':user-invalid'),
      // Card 2
      underlineOffset: supportsPV('text-underline-offset', '5px'),
      decorationThickness: supportsPV('text-decoration-thickness', '2px'),
      skipInk: supportsPV('text-decoration-skip-ink', 'none'),
      // Card 3
      contain: supportsPV('contain', 'strict'),
      containLayout: supportsPV('contain', 'layout'),
      containPaint: supportsPV('contain', 'paint'),
      // Card 4
      colorFn: supportsPV('color', 'color(display-p3 1 0 0)'),
      oklch: supportsPV('color', 'oklch(50% 0.2 240)'),
      // Card 5
      colorMix: supportsPV('color', 'color-mix(in srgb, red, blue)'),
      lightDark: supportsPV('color', 'light-dark(red, blue)'),
      relativeColor: supportsPV('color', 'rgb(from red r g b)'),
      // Card 6
      prefersColorScheme,
    };
  }

  // —— 动态注入所有演示样式（前缀 .fc- 避免冲突）——
  _injectDemoStyles(): void {
    this._injectStyle('css-form-color-demo', `
      /* ===== Card 1: :user-valid / :user-invalid ===== */
      .fc-form { display: flex; flex-direction: column; gap: 10px; max-width: 360px; margin-top: 8px; }
      .fc-field { padding: 8px 10px; border: 2px solid #cbd5e1; border-radius: 6px; font-size: 14px; outline: none; transition: border-color .15s; }
      .fc-field:focus { border-color: #1677ff; }
      .fc-field:user-invalid { border-color: #ef4444; background: #fef2f2; }
      .fc-field:user-valid { border-color: #10b981; background: #f0fdf4; }
      .fc-field-hint { font-size: 12px; color: #64748b; margin-top: -4px; }
      /* ===== Card 2: text-underline-offset / text-decoration-thickness ===== */
      .fc-link-list { display: flex; flex-direction: column; gap: 12px; max-width: 360px; margin-top: 8px; font-size: 18px; line-height: 1.6; }
      .fc-link { text-decoration: underline; color: #1e40af; }
      .fc-link.offset-2 { text-underline-offset: 2px; }
      .fc-link.offset-5 { text-underline-offset: 5px; }
      .fc-link.thick-3 { text-decoration-thickness: 3px; text-underline-offset: 4px; }
      .fc-link.skip-ink-none { text-decoration-skip-ink: none; }
      .fc-link.skip-ink-all { text-decoration-skip-ink: all; }
      /* ===== Card 3: CSS Containment ===== */
      .fc-contain-stage { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px; align-items: flex-start; }
      .fc-contain-box { width: 200px; height: 90px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; overflow: auto; background: #fff; font-size: 12px; }
      .fc-contain-box.strict { contain: strict; }
      .fc-contain-box.layout { contain: layout; }
      .fc-contain-box.paint { contain: paint; }
      .fc-contain-box.content { contain: content; }
      .fc-contain-box.none { contain: none; }
      /* ===== Card 4: color() / color-space ===== */
      .fc-color-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; margin-top: 8px; }
      .fc-swatch { height: 56px; border-radius: 6px; display: flex; align-items: flex-end; padding: 4px 6px; font-size: 11px; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,.5); border: 1px solid rgba(0,0,0,.1); }
      .fc-swatch.p3-red { background: color(display-p3 1 0 0); }
      .fc-swatch.p3-green { background: color(display-p3 0 1 0); }
      .fc-swatch.oklch-blue { background: oklch(50% 0.2 240); }
      .fc-swatch.oklch-green { background: oklch(60% 0.15 145); }
      .fc-swatch.lab-yellow { background: lab(80% 40 80); }
      .fc-swatch.fallback-red { background: #ef4444; }
      .fc-swatch.fallback-blue { background: #3b82f6; }
      /* ===== Card 5: 相对颜色 / color-mix ===== */
      .fc-mix-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 6px; margin-top: 8px; }
      .fc-mix-swatch { height: 40px; border-radius: 4px; font-size: 10px; color: #fff; display: flex; align-items: center; justify-content: center; text-shadow: 0 1px 1px rgba(0,0,0,.4); border: 1px solid rgba(0,0,0,.1); }
      .fc-mix-swatch.mix-25 { background: color-mix(in srgb, red, blue 25%); }
      .fc-mix-swatch.mix-50 { background: color-mix(in srgb, red, blue 50%); }
      .fc-mix-swatch.mix-75 { background: color-mix(in srgb, red, blue 75%); }
      .fc-mix-swatch.mix-oklch { background: color-mix(in oklch, red, blue); }
      .fc-mix-swatch.rel-light { background: rgb(from red r g b / calc(a + 0.1)); }
      .fc-mix-swatch.rel-dark { background: rgb(from red calc(r - 50) g b); }
      /* ===== Card 6: prefers-color-scheme / color-scheme ===== */
      .fc-dark-card { color-scheme: light dark; padding: 14px; border-radius: 8px; border: 1px solid #cbd5e1; margin-top: 8px; background: light-dark(#ffffff, #1e293b); color: light-dark(#1e293b, #e2e8f0); transition: background .2s, color .2s; }
      .fc-dark-card.dark-sim { color-scheme: dark; }
      .fc-dark-card .fc-scheme-row { display: flex; gap: 12px; align-items: center; margin-top: 8px; }
      .fc-scheme-swatch { width: 28px; height: 28px; border-radius: 4px; background: light-dark(#1677ff, #60a5fa); border: 1px solid #cbd5e1; }
      .fc-scheme-text { background: light-dark(#f0f9ff, #0f172a); padding: 6px 10px; border-radius: 4px; font-size: 13px; }
    `);
  }

  // ============ Card 1：:user-valid / :user-invalid ============

  _checkUserInvalid() {
    const caps = this._caps();
    if (!caps.userValid) {
      this._addLog('warn', ':user-invalid 选择器不支持（Chrome 119+/Edge 119+），仅说明：仅在用户已交互（blur 或修改）后才匹配，vs :invalid 页面加载即匹配');
      return;
    }
    const form = (this.$('#fc-form') as any);
    if (!form) { this._addLog('warn', '未找到演示表单'); return; }
    let matched = 0;
    try {
      matched = form.querySelectorAll(':user-invalid').length;
    } catch (err: any) {
      this._addLog('warn', '查询 :user-invalid 失败（jsdom 可能不识别该选择器）：' + (err && err.message));
      return;
    }
    this._addLog('info', `:user-invalid 当前匹配 ${matched} 个字段（未交互前应为 0，blur 后才匹配）`);
    this.setState({ userValidInfo: `:user-invalid 匹配数 = ${matched}（仅用户已交互后才匹配，vs :valid/:invalid 页面加载即匹配一片红）` });
  }

  _simulateInteraction() {
    const req = (this.$('#fc-required') as any);
    const email = (this.$('#fc-email') as any);
    if (!req && !email) { this._addLog('warn', '未找到演示输入框'); return; }
    try {
      // 模拟用户交互：focus 然后 blur（:user-invalid 需要已交互状态）
      if (req) { req.focus(); req.blur(); }
      if (email) { email.focus(); email.blur(); }
      this._addLog('info', '已模拟用户交互（focus→blur）：现在 :user-invalid 应匹配无效字段（required 空或 email 非法）');
      this.setState({ userValidInfo: '已触发 blur 交互：:user-invalid 现在会匹配无效的 required/email 字段（有效字段则匹配 :user-valid）' });
    } catch (err: any) {
      this._addLog('warn', '模拟 blur 失败：' + (err && err.message));
    }
  }

  _renderCard1(): Node | string {
    const s = this.state;
    const caps = this._caps();
    return h(Card, {
      title: 'Card 1 · :user-valid / :user-invalid 伪类',
      extra: h(Tag, { color: caps.userValid ? 'success' : 'error' }, caps.userValid ? '已支持' : '未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        ':user-valid / :user-invalid 区别于 :valid / :invalid（页面加载即匹配），仅在用户已交互（blur 或修改）后才匹配，' +
        '解决"页面一加载就一片红"痛点。演示：required input + email input，未交互时 :user-invalid 不匹配，blur 后才匹配。'),
      h('form', { id: 'fc-form', class: 'fc-form', onsubmit: (e: any) => e.preventDefault() },
        h('div', {},
          h('input', {
            id: 'fc-required', class: 'fc-field', type: 'text',
            placeholder: 'required 字段（未填）', required: true,
          }),
          h('div', { class: 'fc-field-hint' }, 'required：未交互时不红，blur 后变红'),
        ),
        h('div', {},
          h('input', {
            id: 'fc-email', class: 'fc-field', type: 'email',
            placeholder: 'email 字段（输入非法邮箱）', value: 'not-an-email',
          }),
          h('div', { class: 'fc-field-hint' }, 'type=email：输入非法值，blur 后 :user-invalid 匹配'),
        ),
      ),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('查询 :user-invalid 匹配', { type: 'primary', size: 'sm', onClick: () => this._checkUserInvalid() }),
        this._btn('模拟用户 blur 交互', { type: 'default', size: 'sm', onClick: () => this._simulateInteraction() }),
      ),
      s.userValidInfo ? h('p', { class: 'fs-sm mt-sm text-secondary' }, s.userValidInfo) : null as any,
      h('pre', { class: 'code-block mt-md' },
`.field:user-invalid { border-color: red; }
/* vs :invalid（页面加载即匹配，一片红）*/
/* :user-invalid 仅在用户已 blur/修改后才匹配 */
/* 检测：CSS.supports('selector', ':user-invalid') */`),
    );
  }

  // ============ Card 2：text-underline-offset / text-decoration-thickness ============

  _readUnderlineInfo(): string {
    const caps = this._caps();
    try {
      const readComp = (sel: any,prop: any) => {
        const el = (this.$(sel) as any);
        if (!el || typeof window === 'undefined') return '(未渲染)';
        return window.getComputedStyle(el).getPropertyValue(prop) || '(空)';
      };
      const info = `text-underline-offset / text-decoration-thickness 计算值：\n` +
        `  .offset-2 → text-underline-offset="${readComp('#fc-link-offset-2', 'text-underline-offset')}"\n` +
        `  .offset-5 → text-underline-offset="${readComp('#fc-link-offset-5', 'text-underline-offset')}"\n` +
        `  .thick-3  → text-decoration-thickness="${readComp('#fc-link-thick-3', 'text-decoration-thickness')}"\n` +
        `  .skip-ink-none → text-decoration-skip-ink="${readComp('#fc-link-skip-none', 'text-decoration-skip-ink')}"\n` +
        `  .skip-ink-all  → text-decoration-skip-ink="${readComp('#fc-link-skip-all', 'text-decoration-skip-ink')}"\n` +
        `  CSS.supports: offset=${caps.underlineOffset} / thickness=${caps.decorationThickness} / skip-ink=${caps.skipInk}`;
      this.setState({ underlineInfo: info });
      this._addLog('info', '已读取下划线偏移/粗细/skip-ink 计算值');
    } catch (err: any) {
      this._addLog('warn', '读取下划线信息失败：' + (err && err.message));
    }
  return (undefined as any);
  }

  _renderCard2(): Node | string {
    const s = this.state;
    const caps = this._caps();
    return h(Card, {
      title: 'Card 2 · text-underline-offset / text-decoration-thickness',
      extra: h(Tag, { color: caps.underlineOffset ? 'success' : 'error' }, caps.underlineOffset ? '已支持' : '未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'text-underline-offset: auto|<length> 控制下划线偏移；text-decoration-thickness: auto|from-font|<length> 控制下划线粗细；' +
        '配合 text-decoration-skip-ink: none|auto|all 控制是否避让下行字母（g/y/p）。像素级控制下划线，避开下行字母。'),
      h('div', { class: 'fc-link-list' },
        h('a', { id: 'fc-link-offset-2', class: 'fc-link offset-2', href: '#', onclick: (e: any) => e.preventDefault() }, 'offset:2px（贴近基线）testing glyphs g y p'),
        h('a', { id: 'fc-link-offset-5', class: 'fc-link offset-5', href: '#', onclick: (e: any) => e.preventDefault() }, 'offset:5px（远离基线，避开下行字母）g y p'),
        h('a', { id: 'fc-link-thick-3', class: 'fc-link thick-3', href: '#', onclick: (e: any) => e.preventDefault() }, 'thickness:3px + offset:4px（粗下划线）g y p'),
        h('a', { id: 'fc-link-skip-none', class: 'fc-link skip-ink-none', href: '#', onclick: (e: any) => e.preventDefault() }, 'skip-ink:none（下划线穿过 g y p 连续）'),
        h('a', { id: 'fc-link-skip-all', class: 'fc-link skip-ink-all', href: '#', onclick: (e: any) => e.preventDefault() }, 'skip-ink:all（下划线在 g y p 处全部断开）'),
      ),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('读取计算值', { type: 'primary', size: 'sm', disabled: !caps.css, onClick: () => this._readUnderlineInfo() }),
        h(Tag, { color: caps.decorationThickness ? 'success' : 'error' }, caps.decorationThickness ? 'thickness ✓' : 'thickness ✗'),
        h(Tag, { color: caps.skipInk ? 'success' : 'error' }, caps.skipInk ? 'skip-ink ✓' : 'skip-ink ✗'),
      ),
      s.underlineInfo ? h('pre', { class: 'code-block mt-md', style: { maxHeight: '240px', overflow: 'auto' } }, s.underlineInfo) : null as any,
      h('pre', { class: 'code-block mt-md' },
`a { text-decoration: underline;
    text-underline-offset: 5px;        /* 偏移基线 */
    text-decoration-thickness: 2px;     /* 粗细 */
    text-decoration-skip-ink: none; }   /* 不避让下行字母 */`),
    );
  }

  // ============ Card 3：CSS Containment (contain) ============

  _setContainMode(mode: any) {
    const caps = this._caps();
    const box = (this.$('#fc-contain-box') as any);
    if (!box) { this._addLog('warn', '未找到 contain 演示容器'); return; }
    // 移除所有 contain 类，再添加目标
    try {
      ['strict', 'layout', 'paint', 'content', 'none'].forEach((m) => box.classList.remove(m));
      box.classList.add(mode);
      this._containMode = mode;
      const supported = (mode === 'strict') ? caps.contain
        : (mode === 'layout') ? caps.containLayout
        : (mode === 'paint') ? caps.containPaint
        : true;
      this._addLog(supported ? 'info' : 'warn',
        `contain → "${mode}"${supported ? '' : '（jsdom 可能未识别，仅说明）'}：隔离重排/重绘/尺寸范围，是 content-visibility 生效前提`);
      this.setState({
        containInfo: `contain: ${mode} —— ${
          ({ strict: 'layout+paint+size（完全隔离，子元素尺寸不影响外部）',
            layout: '隔离布局（子元素重排不外溢）',
            paint: '隔离绘制（子元素绘制不超出边界，可裁剪）',
            content: 'layout+paint（常用，安全）',
            none: '关闭 containment' } as Record<string, string>)[mode]
        }`,
      });
    } catch (err: any) {
      this._addLog('warn', '切换 contain 失败：' + (err && err.message));
    }
  }

  _renderCard3(): Node | string {
    const s = this.state;
    const caps = this._caps();
    return h(Card, {
      title: 'Card 3 · CSS Containment (contain)',
      extra: h(Tag, { color: caps.contain ? 'success' : 'error' }, caps.contain ? '已支持' : '未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'contain: layout|paint|size|style|strict(=layout paint size)|content(=layout paint)|inline-size；' +
        '隔离元素重排/重绘/尺寸/样式计算范围，是 content-visibility 生效前提。对长列表/虚拟滚动/卡片网格/广告 iframe 性能关键。'),
      h('div', { class: 'fc-contain-stage' },
        h('div', { id: 'fc-contain-box', class: 'fc-contain-box strict' },
          'contain:strict 容器。子元素重排/重绘被隔离，不影响外部布局。' +
          '长列表/虚拟滚动/卡片网格可用 contain 限制回流范围，提升性能。' +
          '配合 content-visibility:auto 可跳过屏幕外内容渲染。',
        ),
      ),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('strict', { type: 'primary', size: 'sm', onClick: () => this._setContainMode('strict') }),
        this._btn('layout', { size: 'sm', onClick: () => this._setContainMode('layout') }),
        this._btn('paint', { size: 'sm', onClick: () => this._setContainMode('paint') }),
        this._btn('content', { size: 'sm', onClick: () => this._setContainMode('content') }),
        this._btn('none', { size: 'sm', onClick: () => this._setContainMode('none') }),
      ),
      s.containInfo ? h('p', { class: 'fs-sm mt-sm text-secondary' }, s.containInfo) : null as any,
      h('pre', { class: 'code-block mt-md' },
`.contain-box { contain: strict; }
/* strict = layout + paint + size（完全隔离）*/
/* content = layout + paint（常用安全）*/
/* layout 隔离重排；paint 隔离重绘；size 子尺寸不影响外部 */
/* 是 content-visibility:auto 生效前提 */`),
    );
  }

  // ============ Card 4：CSS color() 函数与 color-space ============

  _readColorInfo(): string {
    const caps = this._caps();
    try {
      const readComp = (sel: any) => {
        const el = (this.$(sel) as any);
        if (!el || typeof window === 'undefined') return '(未渲染)';
        return window.getComputedStyle(el).getPropertyValue('background-color') || '(空)';
      };
      const info = `color() / color-space 计算值：\n` +
        `  .p3-red   (color(display-p3 1 0 0)) → "${readComp('#fc-swatch-p3-red')}"\n` +
        `  .p3-green (color(display-p3 0 1 0)) → "${readComp('#fc-swatch-p3-green')}"\n` +
        `  .oklch-blue  (oklch(50% 0.2 240)) → "${readComp('#fc-swatch-oklch-blue')}"\n` +
        `  .oklch-green (oklch(60% 0.15 145)) → "${readComp('#fc-swatch-oklch-green')}"\n` +
        `  .lab-yellow  (lab(80% 40 80)) → "${readComp('#fc-swatch-lab-yellow')}"\n\n` +
        `  CSS.supports: color()=${caps.colorFn} / oklch()=${caps.oklch}\n` +
        '说明：\n' +
        '  color(display-p3 1 0 0) —— 显式声明 Display P3 色域（广色域，比 sRGB 更鲜艳）\n' +
        '  oklch(L C H) / oklab(L a b) —— 感知均匀颜色空间（人眼亮度感知一致，调色更自然）\n' +
        '  lab() / lch() —— CIE Lab/Lch 颜色空间\n' +
        '  色域：sRGB（默认）/ display-p3 / rec2020 / a98-rgb / prophoto-rgb\n' +
        '  color-mix(in oklch, red, blue) / 渐变 linear-gradient(in oklch, ...)';
      this.setState({ colorFnInfo: info });
      this._addLog('info', '已读取 color()/oklch()/lab() 计算值');
    } catch (err: any) {
      this._addLog('warn', '读取颜色信息失败：' + (err && err.message));
    }
  return (undefined as any);
  }

  _renderCard4(): Node | string {
    const s = this.state;
    const caps = this._caps();
    return h(Card, {
      title: 'Card 4 · CSS color() 函数与 color-space',
      extra: h(Tag, { color: caps.colorFn ? 'success' : 'error' }, caps.colorFn ? '已支持' : '未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'color(display-p3 1 0 0) 显式声明颜色空间；oklch()/lab()/lch()/oklab() 感知均匀颜色空间；' +
        'Display P3/sRGB/rec2020 色域；color-mix(in oklch, ...)；渐变 color-interpolation-method。' +
        'P3 比 sRGB 更鲜艳，oklch 调色感知均匀。'),
      h('div', { class: 'fc-color-grid' },
        h('div', { id: 'fc-swatch-p3-red', class: 'fc-swatch p3-red' }, 'color(display-p3 1 0 0)'),
        h('div', { id: 'fc-swatch-p3-green', class: 'fc-swatch p3-green' }, 'color(display-p3 0 1 0)'),
        h('div', { id: 'fc-swatch-oklch-blue', class: 'fc-swatch oklch-blue' }, 'oklch(50% .2 240)'),
        h('div', { id: 'fc-swatch-oklch-green', class: 'fc-swatch oklch-green' }, 'oklch(60% .15 145)'),
        h('div', { id: 'fc-swatch-lab-yellow', class: 'fc-swatch lab-yellow' }, 'lab(80% 40 80)'),
      ),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('读取计算值', { type: 'primary', size: 'sm', disabled: !caps.css, onClick: () => this._readColorInfo() }),
        h(Tag, { color: caps.oklch ? 'success' : 'error' }, caps.oklch ? 'oklch ✓' : 'oklch ✗'),
      ),
      s.colorFnInfo ? h('pre', { class: 'code-block mt-md', style: { maxHeight: '280px', overflow: 'auto' } }, s.colorFnInfo) : null as any,
      h('pre', { class: 'code-block mt-md' },
`.swatch { background: color(display-p3 1 0 0); }   /* Display P3 广色域 */
.oklch   { background: oklch(50% 0.2 240); }        /* 感知均匀 */
.lab     { background: lab(80% 40 80); }
color-mix(in oklch, red, blue 40%)                  /* 颜色混合指定色彩空间 */
linear-gradient(in oklch, red, blue)                /* 渐变插值色彩空间 */`),
    );
  }

  // ============ Card 5：相对颜色与 color-mix 进阶 ============

  _readMixInfo(): string {
    const caps = this._caps();
    try {
      const readComp = (sel: any) => {
        const el = (this.$(sel) as any);
        if (!el || typeof window === 'undefined') return '(未渲染)';
        return window.getComputedStyle(el).getPropertyValue('background-color') || '(空)';
      };
      const info = `color-mix() / 相对颜色 计算值：\n` +
        `  .mix-25   (color-mix(in srgb, red, blue 25%)) → "${readComp('#fc-mix-25')}"\n` +
        `  .mix-50   (color-mix(in srgb, red, blue 50%)) → "${readComp('#fc-mix-50')}"\n` +
        `  .mix-75   (color-mix(in srgb, red, blue 75%)) → "${readComp('#fc-mix-75')}"\n` +
        `  .mix-oklch (color-mix(in oklch, red, blue))  → "${readComp('#fc-mix-oklch')}"\n` +
        `  .rel-light (rgb(from red r g b / calc(a+0.1))) → "${readComp('#fc-mix-rel-light')}"\n` +
        `  .rel-dark  (rgb(from red calc(r-50) g b))      → "${readComp('#fc-mix-rel-dark')}"\n\n` +
        `  CSS.supports: color-mix=${caps.colorMix} / light-dark=${caps.lightDark} / 相对颜色 rgb(from)=${caps.relativeColor}\n` +
        '说明：\n' +
        '  color-mix(in <色彩空间>, c1, c2 N%) —— 按比例混合，可指定 srgb/oklch/lab 等插值空间\n' +
        '  相对颜色 rgb(from <base> r g b / a) —— 基于 base 派生，可用 calc 改通道\n' +
        '    rgb(from red calc(r+50) g b)       —— 加红通道\n' +
        '    rgb(from red r g b / calc(a+0.1))  —— 提高透明度\n' +
        '  light-dark(lightVal, darkVal) —— 根据 color-scheme 自动切换（Card 6）';
      this.setState({ colorMixInfo: info });
      this._addLog('info', '已读取 color-mix()/相对颜色 计算值');
    } catch (err: any) {
      this._addLog('warn', '读取 color-mix 信息失败：' + (err && err.message));
    }
  return (undefined as any);
  }

  _renderCard5(): Node | string {
    const s = this.state;
    const caps = this._caps();
    return h(Card, {
      title: 'Card 5 · 相对颜色与 color-mix 进阶',
      extra: h(Tag, { color: caps.colorMix ? 'success' : 'error' }, caps.colorMix ? '已支持' : '未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'color-mix(in srgb, red, blue 40%) 按比例混合；相对颜色 from 语法 rgb(from red r g b / calc(a+0.1)) 基于基色派生；' +
        'light-dark(lightVal, darkVal) 根据 color-scheme 自动切换。展示调色板生成。'),
      h('div', { class: 'fs-sm text-secondary mt-sm' }, 'color-mix 红蓝混合比例：'),
      h('div', { class: 'fc-mix-grid' },
        h('div', { id: 'fc-mix-25', class: 'fc-mix-swatch mix-25' }, '25% blue'),
        h('div', { id: 'fc-mix-50', class: 'fc-mix-swatch mix-50' }, '50% blue'),
        h('div', { id: 'fc-mix-75', class: 'fc-mix-swatch mix-75' }, '75% blue'),
        h('div', { id: 'fc-mix-oklch', class: 'fc-mix-swatch mix-oklch' }, 'in oklch'),
      ),
      h('div', { class: 'fs-sm text-secondary mt-sm' }, '相对颜色 rgb(from ...) 派生：'),
      h('div', { class: 'fc-mix-grid' },
        h('div', { id: 'fc-mix-rel-light', class: 'fc-mix-swatch rel-light' }, 'calc(a+0.1)'),
        h('div', { id: 'fc-mix-rel-dark', class: 'fc-mix-swatch rel-dark' }, 'calc(r-50)'),
      ),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('读取计算值', { type: 'primary', size: 'sm', disabled: !caps.css, onClick: () => this._readMixInfo() }),
        h(Tag, { color: caps.relativeColor ? 'success' : 'error' }, caps.relativeColor ? 'rgb(from) ✓' : 'rgb(from) ✗'),
        h(Tag, { color: caps.lightDark ? 'success' : 'error' }, caps.lightDark ? 'light-dark ✓' : 'light-dark ✗'),
      ),
      s.colorMixInfo ? h('pre', { class: 'code-block mt-md', style: { maxHeight: '300px', overflow: 'auto' } }, s.colorMixInfo) : null as any,
      h('pre', { class: 'code-block mt-md' },
`.mix  { background: color-mix(in srgb, red, blue 40%); }
.rel  { background: rgb(from red r g b / calc(a + 0.1)); }
.dark { background: rgb(from red calc(r - 50) g b); }
/* color-mix 可指定 oklch/lab 等插值空间 */
/* 相对颜色用 from 关键字 + calc 改通道 */`),
    );
  }

  // ============ Card 6：prefers-color-scheme 与 color-scheme ============

  _readSchemeInfo(): string {
    const caps = this._caps();
    try {
      let darkNow = '(不可用)';
      let media = '(不可用)';
      if (caps.prefersColorScheme) {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        darkNow = mq.matches ? 'dark（深色）' : 'light（浅色）';
        media = mq.media;
      }
      const info = `prefers-color-scheme / color-scheme 检测：\n` +
        `  matchMedia('(prefers-color-scheme: dark)') 可用 = ${caps.prefersColorScheme}\n` +
        `  当前系统偏好 = ${darkNow}\n` +
        `  media = "${media}"\n` +
        `  CSS.supports: light-dark() = ${caps.lightDark}\n` +
        `  手动模拟深色 = ${this._darkSimOn ? '开启（color-scheme: dark）' : '关闭'}\n\n` +
        '说明：\n' +
        '  @media (prefers-color-scheme: dark) —— 系统深色模式媒体查询\n' +
        '  :root { color-scheme: light dark; } —— 声明支持深浅双模式（浏览器据此渲染表单控件/滚动条/Canvas 默认色）\n' +
        '  light-dark(lightVal, darkVal) —— 根据 color-scheme 自动取值（vs 手写 @media + CSS 变量）\n' +
        '  vs 手动 .dark 类切换：需 JS 管理 + 持久化 + 监听系统变化；color-scheme+light-dark 是声明式原生方案\n' +
        `  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => ...) —— 监听系统切换`;
      this.setState({ schemeInfo: info });
      this._addLog('info', `系统深色偏好检测：${darkNow}`);
    } catch (err: any) {
      this._addLog('warn', '读取 prefers-color-scheme 失败：' + (err && err.message));
    }
  return (undefined as any);
  }

  _toggleDarkSim(): void {
    const card = (this.$('#fc-dark-card') as any);
    if (!card) { this._addLog('warn', '未找到深色卡片元素'); return; }
    try {
      this._darkSimOn = !this._darkSimOn;
      if (this._darkSimOn) card.classList.add('dark-sim');
      else card.classList.remove('dark-sim');
      this._addLog('info', `手动模拟 ${this._darkSimOn ? '深色（color-scheme:dark）' : '浅色（color-scheme:light dark）'}：${this._darkSimOn ? 'light-dark() 将取 darkVal' : '随系统切换'}`);
      this.setState({ schemeInfo: `手动模拟：${this._darkSimOn ? '深色模式（light-dark 取第二参数）' : '跟随系统'}（vs .dark 类：声明式无需 JS 状态管理）` });
    } catch (err: any) {
      this._addLog('warn', '切换深色模拟失败：' + (err && err.message));
    }
  }

  _renderCard6(): Node | string {
    const s = this.state;
    const caps = this._caps();
    return h(Card, {
      title: 'Card 6 · prefers-color-scheme 与 color-scheme 协同',
      extra: h(Tag, { color: caps.prefersColorScheme ? 'success' : 'error' }, caps.prefersColorScheme ? '已支持' : '未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        '@media (prefers-color-scheme: dark) + color-scheme: light dark 声明 + light-dark() 函数；' +
        'matchMedia JS 检测系统偏好；vs 手动 .dark 类切换。展示一个随系统深浅色切换的卡片。'),
      h('div', {
        id: 'fc-dark-card', class: 'fc-dark-card',
      },
        h('p', { class: 'fs-sm', style: { margin: '0 0 6px 0' } },
          '本卡片背景/文字/控件使用 light-dark() 自动随 color-scheme 切换：浅色白底深字，深色深底浅字。'),
        h('div', { class: 'fc-scheme-row' },
          h('div', { class: 'fc-scheme-swatch' }),
          h('div', { class: 'fc-scheme-text' }, 'light-dark(#f0f9ff, #0f172a)'),
        ),
      ),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('检测系统偏好', { type: 'primary', size: 'sm', onClick: () => this._readSchemeInfo() }),
        this._btn('手动模拟深/浅', { type: 'default', size: 'sm', onClick: () => this._toggleDarkSim() }),
        h(Tag, { color: caps.lightDark ? 'success' : 'error' }, caps.lightDark ? 'light-dark ✓' : 'light-dark ✗'),
      ),
      s.schemeInfo ? h('pre', { class: 'code-block mt-md', style: { maxHeight: '300px', overflow: 'auto' } }, s.schemeInfo) : null as any,
      h('pre', { class: 'code-block mt-md' },
`:root { color-scheme: light dark; }
@media (prefers-color-scheme: dark) { body { background: #1e293b; } }
.card { background: light-dark(#fff, #1e293b); color: light-dark(#1e293b, #e2e8f0); }
const dark = matchMedia('(prefers-color-scheme: dark)').matches;
mq.addEventListener('change', e => /* 系统切换响应 */);`),
    );
  }

  // ============ 日志面板 ============

  _renderLogPanel(): Node | string {
    const s = this.state;
    return h(Card, {
      title: '事件日志',
      extra: h('span', { class: 'fs-sm text-tertiary' }, `${s.logs.length} 条`),
    },
      h('div', { class: 'log-panel' },
        s.logs.length === 0
          ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
          : s.logs.map((log: LogEntry) => h('div', { class: 'log-panel__line' },
              h('span', { class: 'log-panel__time' }, log.time),
              h('span', { class: `log-panel__tag log-panel__tag--${log.type === 'error' ? 'error' : 'info'}` }, log.type),
              h('span', { class: 'log-panel__content' }, log.content),
            )),
      ),
    );
  }

  renderPage(): Node | string | (Node | string)[] {
    const s = this.state;
    return [
      h('h2', { class: 'section-title' }, 'CSS 表单伪类与颜色空间 实验室'),

      h(Alert, {
        type: 'info',
        message: 'CSS 表单伪类与颜色空间',
        description: '演示 :user-valid/:user-invalid、text-underline-offset/text-decoration-thickness、CSS Containment (contain)、color() 函数与 color-space、相对颜色与 color-mix、prefers-color-scheme 与 color-scheme 协同等 2023-2025 现代 CSS 特性。所有特性通过 CSS.supports 能力检测，不支持时记日志不报错。jsdom 不做真实 CSS 渲染，CSS.supports 通常可用；:user-invalid/color()/oklch()/light-dark() 等较新特性 jsdom 可能不识别。',
      }),

      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null as any,

      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderCard6(),

      this._renderLogPanel(),
    ] as (Node | string)[];
  }
}
