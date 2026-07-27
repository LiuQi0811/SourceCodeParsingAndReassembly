// =====================================================================
// CSSViewTransitionsDeepPage.js —— CSS View Transitions（同文档）深度实验室
// 演示 View Transitions API (L1) 同文档（Same-Document / SPA）场景：
//   1. document.startViewTransition(callback) —— 核心入口
//      返回 ViewTransition 对象，含 ready/updateCallbackDone/finished/skipped
//      四阶段流程：捕获旧快照 → 执行 callback → 捕获新快照 → 交叉淡入淡出
//      默认 250ms root 容器交叉淡入淡出，新旧状态都包裹
//   2. ::view-transition 伪元素树
//      ::view-transition（根容器，覆盖整个视口）
//      ::view-transition-group(name)（每个命名过渡元素组）
//      ::view-transition-image-pair(name)（新旧图像容器）
//      ::view-transition-old(name)（旧状态快照图像）
//      ::view-transition-new(name)（新状态快照图像）
//      未命名元素全部进入 root 组 ::view-transition-group(root)
//   3. view-transition-name —— 命名与独立过渡
//      view-transition-name: <custom-ident> | none
//      为元素分配唯一名称使其脱离 root 组独立过渡
//      名称必须全局唯一（重复会报错并 abort 过渡）
//   4. 自定义动画与 @keyframes 协同
//      ::view-transition-old(name)/::view-transition-new(name) 设置 animation
//      ViewTransition.ready.then(() => { /* 修改伪元素动画 */ })
//      skipTransition() 跳过过渡
//   5. ViewTransition.types —— 分类过渡
//      viewTransition.types = Set，配合 :active-view-transition-type(name) 伪类
//      document.startViewTransition({ update, types: ['slide'] }) 新签名
//      SPA 路由 forward/back 不同方向不同动画
//   6. SPA 路由集成实战
//      router.beforeEach 拦截 DOM 更新，startViewTransition 包裹
//      列表项过渡（每个 item 分配唯一 name）
//   7. 复杂场景与陷阱
//      列表/网格过渡、共享元素过渡、3D 翻转、形态变换、滚动位置保持
//      陷阱：name 全局唯一/旧元素删除需在 callback/iframe 不能触发/快照开销
//   8. vs Cross-Document View Transitions 与最佳实践
//      同文档 vs 跨文档（MPA）对比，跨文档用 @view-transition { navigation: auto }
//      最佳实践：渐进增强、prefers-reduced-motion、动画时长 200-400ms
// 说明：jsdom 不做真实快照/过渡，但 CSS.supports 可探测属性支持；
//       typeof document.startViewTransition === 'function' 检测 API；
//       注入演示样式 + 完整代码示例，真实浏览器可查看效果。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { Props, State } from '../../core/types.js';
import type { ButtonProps } from '../../components/ui/Button.js';

interface LogEntry { type: string; content: string; time: string; }

interface CSSViewTransitionsDeepPageCaps {
  css: boolean;
  supports: boolean;
  viewTransitions: boolean;
  viewTransitionName: boolean;
  viewTransitionPseudo: boolean;
  activeViewTransitionType: boolean;
  prefersReducedMotion: boolean;
}

export interface CSSViewTransitionsDeepPageProps extends Props {}

export interface CSSViewTransitionsDeepPageState extends State {
  logs: LogEntry[];
  capsSummary: string;
  overviewInfo: string;
  pseudoTreeInfo: string;
  nameInfo: string;
  customAnimInfo: string;
  typesInfo: string;
  spaInfo: string;
  complexInfo: string;
  bestPracticeInfo: string;
}

export class CSSViewTransitionsDeepPage extends Page {
  declare props: CSSViewTransitionsDeepPageProps;
  declare state: CSSViewTransitionsDeepPageState;

  _inited: boolean = false;
  declare _destroyed: boolean;
  _dynamicStyles!: any[];


  initialState(): CSSViewTransitionsDeepPageState {
    return {
      logs: [],
      capsSummary: '',
      overviewInfo: '',       // Card 1：View Transitions API 概述与基本流程
      pseudoTreeInfo: '',     // Card 2：::view-transition 伪元素树
      nameInfo: '',           // Card 3：view-transition-name 命名与独立过渡
      customAnimInfo: '',     // Card 4：自定义动画与 @keyframes 协同
      typesInfo: '',          // Card 5：ViewTransition.types 与分类过渡
      spaInfo: '',            // Card 6：SPA 路由集成实战
      complexInfo: '',        // Card 7：复杂场景与陷阱
      bestPracticeInfo: '',   // Card 8：vs Cross-Document 与最佳实践
    };
  }

  componentDidMount(): void {
    if (this._inited) return;
    this._inited = true;

    this._dynamicStyles = [];

    const f = this._flags();
    const c = (ok: boolean) => ok ? '✓' : '✗';
    const parts = [
      `startViewTransition ${c(f.viewTransitions)}`,
      `view-transition-name ${c(f.viewTransitionName)}`,
      `::view-transition-old ${c(f.viewTransitionPseudo)}`,
      `:active-view-transition-type ${c(f.activeViewTransitionType)}`,
      `prefers-reduced-motion ${c(f.prefersReducedMotion)}`,
    ];

    const summary = f.css
      ? `CSS View Transitions（同文档）能力检测：${parts.join(' · ')}。jsdom 不做真实快照/过渡，但 CSS.supports 可探测属性支持；按钮点击注入演示样式 + 完整代码示例，真实浏览器可查看效果。`
      : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击仅记日志说明，不会抛异常。';

    this.setState({ capsSummary: summary });
    this._addLog(f.viewTransitions ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.viewTransitions) this._addLog('info', 'View Transitions API 不可用（Chrome 111+/Safari 18+/Firefox 暂不支持）');
    if (!f.viewTransitionPseudo) this._addLog('warn', '::view-transition-* 伪元素不支持');
    if (!f.activeViewTransitionType) this._addLog('warn', ':active-view-transition-type() 不支持（Chrome 125+）');
    if (f.prefersReducedMotion) this._addLog('warn', '用户偏好减少动态效果（prefers-reduced-motion: reduce），应跳过过渡');

    this._injectBaseStyles();
  }

  componentWillUnmount(): void {
    for (const style of this._dynamicStyles) {
      try { style.parentNode && style.parentNode.removeChild(style); } catch { /* noop */ }
    }
    this._dynamicStyles = [];
  }

  // —— 辅助方法 ——

  _addLog(type: string, content: string): void {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label: string, opts: ButtonProps): Node | string {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render() as Node;
  }

  _caps(items: any) {
    return items.map(([label, ok]: [any, any]) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  _injectStyle(id: string,css: any): void  {
    const existing = (document.getElementById(id) as any);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = id;
    // jsdom 等不支持 ::view-transition-* 伪元素的环境会抛错，降级吞掉仅记日志
    try {
      style.textContent = css;
      document.head.appendChild(style);
      this._dynamicStyles.push(style);
    } catch (e: any) {
      this._addLog('warn', `样式注入失败（环境不支持相关伪元素）：${e && e.message}`);
    }
  }

  // 安全触发视图过渡：不支持时直接执行 callback
  _runVT(callback: any): any  {
    if (typeof document !== 'undefined' && typeof document.startViewTransition === 'function') {
      try {
        return document.startViewTransition(callback);
      } catch (e: any) {
        this._addLog('warn', `startViewTransition 抛错：${e.message}；降级直接更新 DOM`);
        try { callback(); } catch { /* noop */ }
        return null as any;
      }
    } else {
      try { callback(); } catch { /* noop */ }
      this._addLog('info', 'View Transitions API 不可用，已直接更新 DOM');
      return null as any;
    }
  }

  _injectBaseStyles(): void {
    this._injectStyle('css-vt-deep-base', `
      .vt-demo {
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
      }
      .vt-box {
        width: 80px;
        height: 80px;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 700;
        font-size: 12px;
        margin: 8px;
      }
      .vt-stage {
        padding: 16px;
        background: #f1f5f9;
        border: 1px dashed #94a3b8;
        border-radius: 8px;
        margin-top: 10px;
        min-height: 120px;
        position: relative;
        overflow: hidden;
      }
      .vt-basic-box {
        width: 80px;
        height: 80px;
        background: #3b82f6;
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 700;
        font-size: 12px;
        margin: 8px;
        transition: background 0.3s ease, transform 0.3s ease;
      }
      .vt-basic-box--alt {
        background: #ef4444;
        transform: scale(1.3) rotate(15deg);
      }
      .vt-named-host {
        padding: 16px;
        background: #f1f5f9;
        border-radius: 8px;
        margin-top: 10px;
        min-height: 100px;
      }
      .vt-named-box {
        width: 60px;
        height: 60px;
        background: #10b981;
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 700;
        font-size: 11px;
        view-transition-name: vt-named-demo;
      }
      .vt-named-box--moved {
        margin-left: 200px;
        background: #f59e0b;
      }
      .vt-spa-host {
        padding: 16px;
        background: #f1f5f9;
        border-radius: 8px;
        margin-top: 10px;
        min-height: 100px;
        position: relative;
        overflow: hidden;
      }
      .vt-spa-page {
        padding: 12px;
        background: #fff;
        border-radius: 6px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      .vt-spa-page--active {
        border: 2px solid #3b82f6;
      }
      .vt-types-host {
        padding: 16px;
        background: #f1f5f9;
        border-radius: 8px;
        margin-top: 10px;
        position: relative;
        overflow: hidden;
        min-height: 100px;
      }
      .vt-types-card {
        padding: 16px;
        background: #fff;
        border-radius: 8px;
        border: 2px solid #3b82f6;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      @keyframes vt-named-out {
        to { opacity: 0; transform: scale(0.8); }
      }
      @keyframes vt-named-in {
        from { opacity: 0; transform: scale(1.2); }
        to { opacity: 1; transform: scale(1); }
      }
      @keyframes vt-fade-out {
        to { opacity: 0; transform: scale(0.95); }
      }
      @keyframes vt-fade-in {
        from { opacity: 0; transform: scale(1.05); }
        to { opacity: 1; transform: scale(1); }
      }
      @keyframes vt-slide-out-left {
        to { transform: translateX(-100%); opacity: 0; }
      }
      @keyframes vt-slide-in-right {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes vt-slide-out-right {
        to { transform: translateX(100%); opacity: 0; }
      }
      @keyframes vt-slide-in-left {
        from { transform: translateX(-100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .vt-output {
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
      .vt-tree {
        font-family: monospace;
        font-size: 12px;
        background: #0f172a;
        color: #e2e8f0;
        padding: 12px;
        border-radius: 6px;
        margin-top: 8px;
        white-space: pre;
        overflow-x: auto;
      }
    `);

    // —— ::view-transition-* 伪元素 CSS 仅在浏览器支持时注入（jsdom 等不支持会报 parse error）——
    const f = this._flags();
    if (f.viewTransitionPseudo) {
      this._injectStyle('css-vt-deep-pseudo', `
        ::view-transition-old(root) {
          animation-duration: 0.4s;
          animation-timing-function: ease-in-out;
        }
        ::view-transition-new(root) {
          animation-duration: 0.4s;
          animation-timing-function: ease-in-out;
        }
        ::view-transition-old(vt-named-demo) {
          animation: vt-named-out 0.4s ease-in forwards;
        }
        ::view-transition-new(vt-named-demo) {
          animation: vt-named-in 0.4s ease-out forwards;
        }
        ::view-transition-old(vt-custom) {
          animation: vt-fade-out 0.35s ease-in forwards;
        }
        ::view-transition-new(vt-custom) {
          animation: vt-fade-in 0.35s ease-out forwards;
        }
        ${f.activeViewTransitionType ? `
        :active-view-transition-type(slide-forward) {
          ::view-transition-old(root) {
            animation: vt-slide-out-left 0.4s ease-in forwards;
          }
          ::view-transition-new(root) {
            animation: vt-slide-in-right 0.4s ease-out forwards;
          }
        }
        :active-view-transition-type(slide-back) {
          ::view-transition-old(root) {
            animation: vt-slide-out-right 0.4s ease-in forwards;
          }
          ::view-transition-new(root) {
            animation: vt-slide-in-left 0.4s ease-out forwards;
          }
        }
        ` : ''}
      `);
    }
  }

  _flags(): CSSViewTransitionsDeepPageCaps {
    const hasCSS = typeof CSS !== 'undefined';
    const hasCSSSupports = hasCSS && typeof CSS.supports === 'function';
    const supportsStr = (s: any) => {
      try { return hasCSSSupports && CSS.supports(s); }
      catch { return false; }
    };
    const hasMatchMedia = typeof matchMedia === 'function';
    return {
      css: hasCSS,
      supports: hasCSSSupports,
      viewTransitions: typeof document !== 'undefined' && typeof document.startViewTransition === 'function',
      viewTransitionName: supportsStr('view-transition-name: x'),
      viewTransitionPseudo: supportsStr('selector(::view-transition-old)'),
      activeViewTransitionType: supportsStr('selector(:active-view-transition-type(x))'),
      prefersReducedMotion: hasMatchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  }

  // ===================== Card 1：View Transitions API 概述与基本流程 =====================

  _runOverviewDemo(): void {
    const f = this._flags();
    this._injectStyle('vt-overview-demo', `
      .vt-overview-highlight {
        background: #fef3c7;
        padding: 8px;
        border-radius: 4px;
        margin-top: 8px;
        font-size: 12px;
      }
      ::view-transition-old(root) {
        animation-duration: 0.4s;
        animation-timing-function: ease-in-out;
      }
      ::view-transition-new(root) {
        animation-duration: 0.4s;
        animation-timing-function: ease-in-out;
      }
    `);
    const info = [
      '===== View Transitions API 概述与基本流程 =====',
      '',
      '【核心 API：document.startViewTransition(callback)】',
      '  const transition = document.startViewTransition(() => {',
      '    // 在此回调中更新 DOM（添加/删除/修改元素）',
      '    updateDOM();',
      '  });',
      '  // 返回 ViewTransition 对象，含 4 个 Promise + 1 个方法',
      '',
      '【ViewTransition 对象：4 个 Promise + skipTransition()】',
      '  transition.updateCallbackDone  // Promise：callback 执行完毕（DOM 已更新）',
      '  transition.ready               // Promise：伪元素树已构建，动画即将开始',
      '  transition.finished            // Promise：动画完全结束',
      '  transition.skipped             // Promise：过渡被跳过时 resolve',
      '  transition.skipTransition()    // 方法：跳过动画（DOM 已更新但无过渡效果）',
      '',
      '【四阶段流程】',
      '  阶段 1：捕获旧状态快照',
      '    - 浏览器对当前 DOM 截图（pixel snapshot）',
      '    - ::view-transition-old(root) 持有该快照',
      '',
      '  阶段 2：执行 DOM 更新 callback',
      '    - 调用 startViewTransition 传入的 callback',
      '    - 在 callback 中修改 DOM（唯一应改 DOM 的地方）',
      '    - callback 可同步或异步（返回 Promise）',
      '',
      '  阶段 3：捕获新状态快照',
      '    - 浏览器对更新后的 DOM 截图',
      '    - ::view-transition-new(root) 持有该快照',
      '',
      '  阶段 4：交叉淡入淡出过渡',
      '    - old 快照 opacity 1->0，new 快照 opacity 0->1',
      '    - 默认 250ms，可被 CSS 覆盖',
      '    - root 容器覆盖整个视口，新旧状态都被包裹',
      '',
      '【Promise 时序】',
      '  startViewTransition(callback)',
      '    |',
      '    +-> updateCallbackDone  (callback 完成，DOM 已更新)',
      '           |',
      '           +-> ready  (伪元素树构建完成，动画开始)',
      '                  |',
      '                  +-> finished  (动画结束) 或 skipped (跳过)',
      '',
      '  // skipTransition() 后：updateCallbackDone 仍 resolve，',
      '  //   但 ready 会 reject，finished 等动画跳过后 resolve',
      '',
      '【默认动画：交叉淡入淡出（cross-fade）】',
      '  ::view-transition-old(root) {',
      '    animation: -ua-view-transition-fade-out 250ms ease;',
      '  }',
      '  ::view-transition-new(root) {',
      '    animation: -ua-view-transition-fade-in 250ms ease;',
      '  }',
      '  // 旧快照从 opacity:1 淡出到 0，新快照从 opacity:0 淡入到 1',
      '  // 整个 root 容器叠加在页面上方',
      '',
      '【与 CSS 动画协同：ready 后修改伪元素】',
      '  const t = document.startViewTransition(() => updateDOM());',
      '  t.ready.then(() => {',
      '    // 伪元素树已构建，可动态修改动画',
      '    document.documentElement.animate(',
      '      [',
      '        { clipPath: "circle(0% at 50% 50%)" },',
      '        { clipPath: "circle(100% at 50% 50%)" }',
      '      ],',
      '      {',
      '        duration: 500,',
      '        easing: "ease-in-out",',
      '        pseudoElement: "::view-transition-new(root)"',
      '      }',
      '    );',
      '  });',
      '',
      '【callback 可以是异步的】',
      '  const t = document.startViewTransition(async () => {',
      '    const data = await fetch("/api/data").then(r => r.json());',
      '    renderData(data);  // DOM 更新',
      '  });',
      '  // updateCallbackDone 等 await 完成后才 resolve',
      '  // 注意：callback 期间页面冻结交互，异步过长会卡顿',
      '',
      '【skipTransition()：跳过动画但保留 DOM 更新】',
      '  const t = document.startViewTransition(() => updateDOM());',
      '  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {',
      '    t.skipTransition();  // DOM 已更新，但无动画',
      '  }',
      '  // skipTransition 后 ready Promise 会 reject（用 .catch 处理）',
      '',
      '【渐进增强：不支持时直接更新 DOM】',
      '  function updateWithTransition() {',
      '    if (!document.startViewTransition) {',
      '      updateDOM();  // 不支持，直接更新',
      '      return;',
      '    }',
      '    document.startViewTransition(() => updateDOM());',
      '  }',
      '',
      '【浏览器支持】',
      `  startViewTransition: ${f.viewTransitions ? '✓' : '✗'} (Chrome 111+/Safari 18+/Firefox 暂不支持)`,
      '  Chrome 111+ (2023.03) 首次支持',
      '  Safari 18+ (2024.09) 支持',
      '  Firefox 暂不支持（截至 2025 仍在 flag 后）',
      '  // 检测：typeof document.startViewTransition === "function"',
      '',
      '【常见陷阱】',
      '  1. callback 中必须真正修改 DOM，否则新旧快照相同（无过渡效果）',
      '  2. callback 是异步时，期间用户交互被冻结（避免长时间操作）',
      '  3. ready Promise 在 skipTransition 后会 reject，需 .catch()',
      '  4. 多次连续 startViewTransition 会排队，可能跳过中间过渡',
      '  5. 过渡期间页面有 ::view-transition 覆盖层，pointer events 默认穿透',
      '  6. iframe 内不能触发顶层文档的过渡（只能过渡自身文档）',
    ].join('\n');
    this.setState({ overviewInfo: info });
    this._addLog('css', `View Transitions 概述演示完成；supports=${f.viewTransitions}`);
  }

  _toggleBasicBox(): void {
    const box = document.querySelector('.vt-basic-box');
    if (!box) { this._addLog('warn', '演示元素 .vt-basic-box 未找到'); return; }
    const cb = () => { box.classList.toggle('vt-basic-box--alt'); };
    const t = this._runVT(cb);
    if (t) {
      t.finished.then(() => this._addLog('info', '基础交叉淡入过渡 finished')).catch(() => this._addLog('warn', '过渡被跳过/取消'));
    }
  }

  _renderCard1(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. View Transitions API 概述与基本流程',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['startViewTransition', f.viewTransitions],
        ]),
        h(Tag, { color: 'primary' }, 'VT L1'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'document.startViewTransition(callback) 返回 ViewTransition 对象，含 updateCallbackDone/ready/finished/skipped 四个 Promise 与 skipTransition() 方法。四阶段流程：捕获旧状态快照 -> 执行 DOM 更新 callback -> 捕获新状态快照 -> 交叉淡入淡出过渡（默认 250ms root 容器）。ready 后可修改伪元素动画与 CSS 协同。callback 可异步（返回 Promise）。浏览器支持 Chrome 111+/Safari 18+/Firefox 暂不支持。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行概述演示', { type: 'primary', size: 'sm', onClick: () => this._runOverviewDemo() }),
          this._btn('切换盒子（触发过渡）', { type: 'default', size: 'sm', onClick: () => this._toggleBasicBox() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '交互演示（点击上方按钮触发 startViewTransition）：'),
        h('div', { class: 'vt-stage' },
          h('div', { class: 'vt-basic-box' }, 'BOX'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.overviewInfo || '（点击按钮查看 View Transitions API 概述完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 2：::view-transition 伪元素树 =====================

  _runPseudoTreeDemo(): void {
    const f = this._flags();
    this._injectStyle('vt-pseudo-tree-demo', `
      .vt-tree-node {
        color: #60a5fa;
        font-weight: 700;
      }
      ::view-transition-group(root) {
        animation-duration: 0.3s;
      }
      ::view-transition-image-pair(root) {
        isolation: auto;
      }
    `);
    const info = [
      '===== ::view-transition 伪元素树 =====',
      '',
      '【伪元素树整体结构】',
      '  ::view-transition                        <- 根容器，覆盖整个视口',
      '    |',
      '    +-- ::view-transition-group(root)      <- 未命名元素的过渡组',
      '    |     |',
      '    |     +-- ::view-transition-image-pair(root)',
      '    |           |',
      '    |           +-- ::view-transition-old(root)   <- 旧状态快照图像',
      '    |           +-- ::view-transition-new(root)   <- 新状态快照图像',
      '    |',
      '    +-- ::view-transition-group(header)    <- 命名元素 header 的过渡组',
      '          |',
      '          +-- ::view-transition-image-pair(header)',
      '                |',
      '                +-- ::view-transition-old(header)',
      '                +-- ::view-transition-new(header)',
      '',
      '【::view-transition —— 根容器】',
      '  ::view-transition {',
      '    position: fixed;',
      '    inset: 0;                /* 覆盖整个视口 */',
      '    z-index: 2147483646;     /* 顶层 */',
      '  }',
      '  // 过渡期间所有快照都在此容器内渲染',
      '  // 默认 pointer-events: none（点击穿透到下方页面）',
      '',
      '【::view-transition-group(name) —— 每个命名过渡元素组】',
      '  ::view-transition-group(root) {',
      '    /* 未命名元素全部进入 root 组 */',
      '    /* 默认动画：位置/尺寸平滑插值（如元素位移会动画过渡） */',
      '    animation-duration: 0.25s;',
      '    animation-timing-function: ease;',
      '  }',
      '  ::view-transition-group(header) {',
      '    /* view-transition-name: header 的元素独立成组 */',
      '    /* group 会动画其位置和尺寸变化 */',
      '  }',
      '  // group 持有旧新位置之间的插值（元素位移时 group 平滑移动）',
      '',
      '【::view-transition-image-pair(name) —— 新旧图像容器】',
      '  ::view-transition-image-pair(root) {',
      '    isolation: auto;         /* 创建层叠上下文，隔离新旧图像 */',
      '  }',
      '  // 包含 ::view-transition-old 和 ::view-transition-new',
      '  // 默认不参与动画，仅作容器',
      '',
      '【::view-transition-old(name) —— 旧状态快照图像】',
      '  ::view-transition-old(root) {',
      '    animation: -ua-view-transition-fade-out 0.25s ease;',
      '    /* 从 opacity:1 淡出到 opacity:0 */',
      '  }',
      '  // 这是旧 DOM 的像素快照（非真实 DOM，不可交互）',
      '',
      '【::view-transition-new(name) —— 新状态快照图像】',
      '  ::view-transition-new(root) {',
      '    animation: -ua-view-transition-fade-in 0.25s ease;',
      '    /* 从 opacity:0 淡入到 opacity:1 */',
      '  }',
      '  // 这是新 DOM 的像素快照',
      '',
      '【未命名元素 -> root 组】',
      '  // 没有声明 view-transition-name 的元素，',
      '  //   其旧/新快照全部进入 ::view-transition-group(root)',
      '  // root 组的 old/new 是整个视口的快照（非单个元素）',
      '  // 适合页面级整体淡入淡出',
      '',
      '【自定义伪元素动画】',
      '  ::view-transition-old(root) {',
      '    animation: my-fade-out 0.4s ease-in forwards;',
      '  }',
      '  ::view-transition-new(root) {',
      '    animation: my-fade-in 0.4s ease-out forwards;',
      '  }',
      '  @keyframes my-fade-out {',
      '    to { opacity: 0; transform: scale(0.95); }',
      '  }',
      '  @keyframes my-fade-in {',
      '    from { opacity: 0; transform: scale(1.05); }',
      '    to   { opacity: 1; transform: scale(1); }',
      '  }',
      '',
      '【禁用默认动画】',
      '  ::view-transition-old(root),',
      '  ::view-transition-new(root) {',
      '    animation: none;   /* 禁用默认淡入淡出 */',
      '  }',
      '  ::view-transition-group(root) {',
      '    animation: none;   /* 禁用位置插值 */',
      '  }',
      '  // 配合 JS 用 Web Animations API 自定义动画',
      '',
      '【伪元素层级 z-index】',
      '  ::view-transition                  z-index: 2147483646（最高）',
      '  ::view-transition-group(*)         继承自根',
      '  ::view-transition-image-pair(*)    隔离层叠上下文',
      '  ::view-transition-old(*)           默认在下层',
      '  ::view-transition-new(*)           默认在上层',
      '',
      '【浏览器支持】',
      `  ::view-transition-* 伪元素: ${f.viewTransitionPseudo ? '✓' : '✗'} (Chrome 111+/Safari 18+/Firefox 暂不支持)`,
      '  // 检测：CSS.supports("selector(::view-transition-old)")',
      '',
      '【常见陷阱】',
      '  1. 伪元素是像素快照，不是真实 DOM（不可交互、不响应事件）',
      '  2. old/new 默认 z-index 导致 new 在上，淡入时覆盖 old',
      '  3. group 的位置插值依赖新旧元素位置匹配（view-transition-name）',
      '  4. 修改伪元素 animation 需在 ready 之后（伪元素树已构建）',
      '  5. ::view-transition 根容器 pointer-events: none，过渡期间无法点击快照',
    ].join('\n');
    this.setState({ pseudoTreeInfo: info });
    this._addLog('css', `::view-transition 伪元素树演示完成；supports=${f.viewTransitionPseudo}`);
  }

  _renderCard2(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. ::view-transition 伪元素树 —— 过渡快照的 DOM 结构',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['::view-transition-old', f.viewTransitionPseudo]]),
        h(Tag, { color: 'primary' }, '伪元素树'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '::view-transition 根容器覆盖整个视口；::view-transition-group(name) 每个命名过渡元素组；::view-transition-image-pair(name) 包含新旧图像容器；::view-transition-old(name) 旧状态快照图像；::view-transition-new(name) 新状态快照图像。未命名元素全部进入 root 组 ::view-transition-group(root)。伪元素是像素快照非真实 DOM，默认动画 old 淡出 new 淡入。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行伪元素树演示', { type: 'primary', size: 'sm', onClick: () => this._runPseudoTreeDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '伪元素树结构：'),
        h('div', { class: 'vt-tree' },
          '::view-transition\n  |\n  +-- ::view-transition-group(root)\n  |     +-- ::view-transition-image-pair(root)\n  |           +-- ::view-transition-old(root)\n  |           +-- ::view-transition-new(root)\n  |\n  +-- ::view-transition-group(header)\n        +-- ::view-transition-image-pair(header)\n              +-- ::view-transition-old(header)\n              +-- ::view-transition-new(header)'),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.pseudoTreeInfo || '（点击按钮查看 ::view-transition 伪元素树完整结构）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 3：view-transition-name 命名与独立过渡 =====================

  _runNameDemo(): void {
    const f = this._flags();
    this._injectStyle('vt-name-demo', `
      .vt-named-box {
        view-transition-name: vt-named-demo;
      }
      ::view-transition-old(vt-named-demo) {
        animation: vt-named-out 0.4s ease-in forwards;
      }
      ::view-transition-new(vt-named-demo) {
        animation: vt-named-in 0.4s ease-out forwards;
      }
      @keyframes vt-named-out {
        to { opacity: 0; transform: scale(0.8); }
      }
      @keyframes vt-named-in {
        from { opacity: 0; transform: scale(1.2); }
        to { opacity: 1; transform: scale(1); }
      }
    `);
    const info = [
      '===== view-transition-name 命名与独立过渡 =====',
      '',
      '【语法】',
      '  view-transition-name: <custom-ident> | none',
      '  /* <custom-ident>: 自定义标识符（如 header, card-1, item-x） */',
      '  /* none: 默认值，不命名（进入 root 组） */',
      '',
      '【基本用法：为元素分配唯一名称】',
      '  .header {',
      '    view-transition-name: header;',
      '  }',
      '  .hero-image {',
      '    view-transition-name: hero;',
      '  }',
      '  /* 命名后该元素脱离 root 组，独立过渡 */',
      '  /* 浏览器单独为其捕获旧/新快照，独立交叉淡入淡出 */',
      '',
      '【名称必须全局唯一（关键约束！）】',
      '  /* 正确：每个元素不同名称 */',
      '  .card-1 { view-transition-name: card-1; }',
      '  .card-2 { view-transition-name: card-2; }',
      '  .card-3 { view-transition-name: card-3; }',
      '',
      '  /* 错误：两个元素同名 -> 报错并 abort 整个过渡 */',
      '  .a { view-transition-name: shared; }',
      '  .b { view-transition-name: shared; }  /* 重复！过渡 abort */',
      '  // 控制台报错：Did you mean to set view-transition-name: shared on one element?',
      '',
      '【列表项命名：动态分配唯一 name】',
      '  <li style="view-transition-name: item-0">Item 0</li>',
      '  <li style="view-transition-name: item-1">Item 1</li>',
      '  <li style="view-transition-name: item-2">Item 2</li>',
      '',
      '  /* JS 动态设置 */',
      '  items.forEach((item, i) => {',
      '    item.style.viewTransitionName = `item-${i}`;',
      '  });',
      '  // 列表项重排/删除/新增时，相同 name 的元素会平滑过渡位置',
      '',
      '【命名后独立交叉淡入淡出】',
      '  .hero {',
      '    view-transition-name: hero;',
      '  }',
      '  // 过渡时：',
      '  //   ::view-transition-group(hero) 单独持有 hero 的旧新快照',
      '  //   ::view-transition-old(hero) -> opacity 1->0',
      '  //   ::view-transition-new(hero) -> opacity 0->1',
      '  //   group 还会动画位置/尺寸变化（hero 移动时平滑跟随）',
      '',
      '【用途：元素位移/缩放/形态变化过渡】',
      '  /* 元素从位置 A 平滑移动到位置 B */',
      '  .avatar {',
      '    view-transition-name: avatar;',
      '  }',
      '  // 旧位置 -> 新位置：group 动画 left/top（实际是 transform）',
      '  // 适合：拖拽排序、网格重排、列表过滤',
      '',
      '【命名元素需有稳定 layout 才能匹配新旧状态】',
      '  // 新旧状态中同名元素的位置/尺寸由 group 插值',
      '  // 若新旧状态元素位置差异大，group 会平滑过渡',
      '  // 若旧状态无此 name 元素（新增），仅 new 快照淡入',
      '  // 若新状态无此 name 元素（删除），仅 old 快照淡出',
      '',
      '【动态 name：过渡前设置，过渡后清除】',
      '  // 模式：过渡开始前为元素设置 name，过渡结束后移除',
      '  function transitionItem(el) {',
      '    el.style.viewTransitionName = "item";',
      '    const t = document.startViewTransition(() => {',
      '      moveItem(el);',
      '    });',
      '    t.finished.finally(() => {',
      '      el.style.viewTransitionName = "";  // 清除避免冲突',
      '    });',
      '  }',
      '',
      '【none 值：显式不命名】',
      '  .no-transition {',
      '    view-transition-name: none;  /* 显式不参与独立过渡 */',
      '  }',
      '  // 该元素进入 root 组整体淡入淡出',
      '',
      '【浏览器支持】',
      `  view-transition-name: ${f.viewTransitionName ? '✓' : '✗'} (Chrome 111+/Safari 18+/Firefox 暂不支持)`,
      '  // 检测：CSS.supports("view-transition-name: x")',
      '',
      '【常见陷阱】',
      '  1. name 必须全局唯一，重复会 abort 整个过渡（控制台报错）',
      '  2. name 必须新旧状态都存在才独立过渡（否则只淡入或只淡出）',
      '  3. 旧元素删除需在 callback 中完成（callback 外删除无法捕获旧快照）',
      '  4. 未渲染元素（display:none）不可命名（快照为空）',
      '  5. 隐藏元素（visibility:hidden/opacity:0）快照可能为空',
      '  6. name 是 <custom-ident>，不能用引号、不能以数字开头',
      '  7. 大量命名元素快照开销大（每个 name 单独截图），影响性能',
      '  8. name 跨页面不持久（跨文档需 MPA + @view-transition）',
    ].join('\n');
    this.setState({ nameInfo: info });
    this._addLog('css', `view-transition-name 演示完成；supports=${f.viewTransitionName}`);
  }

  _moveNamedBox(): void {
    const box = document.querySelector('.vt-named-box');
    if (!box) { this._addLog('warn', '演示元素 .vt-named-box 未找到'); return; }
    const cb = () => { box.classList.toggle('vt-named-box--moved'); };
    const t = this._runVT(cb);
    if (t) {
      t.finished.then(() => this._addLog('info', '命名元素独立过渡 finished')).catch(() => this._addLog('warn', '过渡被跳过/取消'));
    }
  }

  _renderCard3(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. view-transition-name —— 命名与独立过渡',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['view-transition-name', f.viewTransitionName]]),
        h(Tag, { color: 'primary' }, '命名过渡'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'view-transition-name: <custom-ident> | none 为元素分配唯一名称使其脱离 root 组独立过渡。名称必须全局唯一（重复会报错并 abort 整个过渡）。命名后该元素的旧/新快照独立交叉淡入淡出，group 还会动画位置/尺寸变化。用于元素位移/缩放/形态变化过渡。命名元素需有稳定 layout 才能匹配新旧状态。列表项可动态分配唯一 name 实现重排过渡。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行命名演示', { type: 'primary', size: 'sm', onClick: () => this._runNameDemo() }),
          this._btn('移动命名盒子（独立过渡）', { type: 'default', size: 'sm', onClick: () => this._moveNamedBox() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '交互演示（盒子已设 view-transition-name: vt-named-demo）：'),
        h('div', { class: 'vt-named-host' },
          h('div', { class: 'vt-named-box' }, 'NAMED'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.nameInfo || '（点击按钮查看 view-transition-name 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 4：自定义动画与 @keyframes 协同 =====================

  _runCustomAnimDemo(): void {
    const f = this._flags();
    this._injectStyle('vt-custom-anim-demo', `
      ::view-transition-old(root) {
        animation: vt-fade-out 0.35s ease-in forwards;
      }
      ::view-transition-new(root) {
        animation: vt-fade-in 0.35s ease-out forwards;
      }
      @keyframes vt-fade-out {
        to { opacity: 0; transform: scale(0.95); }
      }
      @keyframes vt-fade-in {
        from { opacity: 0; transform: scale(1.05); }
        to { opacity: 1; transform: scale(1); }
      }
    `);
    const info = [
      '===== 自定义动画与 @keyframes 协同 =====',
      '',
      '【通过伪元素设置 animation 自定义过渡】',
      '  ::view-transition-old(root) {',
      '    animation: vt-fade-out 0.4s ease-in forwards;',
      '  }',
      '  ::view-transition-new(root) {',
      '    animation: vt-fade-in 0.4s ease-out forwards;',
      '  }',
      '',
      '  @keyframes vt-fade-out {',
      '    to { opacity: 0; transform: scale(0.9); }',
      '  }',
      '  @keyframes vt-fade-in {',
      '    from { opacity: 0; transform: scale(1.1); }',
      '    to   { opacity: 1; transform: scale(1); }',
      '  }',
      '  // 旧快照缩小淡出，新快照从放大状态淡入',
      '',
      '【新旧状态独立动画】',
      '  /* 旧快照向左滑出 */',
      '  ::view-transition-old(root) {',
      '    animation: slide-out-left 0.4s ease-in forwards;',
      '  }',
      '  @keyframes slide-out-left {',
      '    to { transform: translateX(-100%); opacity: 0; }',
      '  }',
      '',
      '  /* 新快照从右滑入 */',
      '  ::view-transition-new(root) {',
      '    animation: slide-in-right 0.4s ease-out forwards;',
      '  }',
      '  @keyframes slide-in-right {',
      '    from { transform: translateX(100%); opacity: 0; }',
      '    to   { transform: translateX(0); opacity: 1; }',
      '  }',
      '',
      '【配合 mix-blend-mode / filter 增强效果】',
      '  ::view-transition-old(root) {',
      '    animation: vt-blur-out 0.4s ease-in forwards;',
      '    mix-blend-mode: normal;',
      '  }',
      '  ::view-transition-new(root) {',
      '    animation: vt-blur-in 0.4s ease-out forwards;',
      '    mix-blend-mode: normal;',
      '  }',
      '  @keyframes vt-blur-out {',
      '    to { opacity: 0; filter: blur(10px); }',
      '  }',
      '  @keyframes vt-blur-in {',
      '    from { opacity: 0; filter: blur(10px); }',
      '    to   { opacity: 1; filter: blur(0); }',
      '  }',
      '',
      '【animation-duration / animation-timing-function 控制】',
      '  ::view-transition-old(root),',
      '  ::view-transition-new(root) {',
      '    animation-duration: 0.6s;                    /* 600ms */',
      '    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);',
      '    animation-fill-mode: forwards;',
      '  }',
      '',
      '【JS 动态修改伪元素动画：ViewTransition.ready】',
      '  const t = document.startViewTransition(() => updateDOM());',
      '  t.ready.then(() => {',
      '    // 伪元素树已构建，用 Web Animations API 替换动画',
      '    document.documentElement.animate(',
      '      [',
      '        { clipPath: "circle(0% at 50% 50%)" },',
      '        { clipPath: "circle(150% at 50% 50%)" }',
      '      ],',
      '      {',
      '        duration: 600,',
      '        easing: "ease-in-out",',
      '        pseudoElement: "::view-transition-new(root)"',
      '      }',
      '    );',
      '  });',
      '  // 注意：JS 动画会覆盖 CSS animation',
      '',
      '【圆形展开过渡（经典效果）】',
      '  function expandTransition(event) {',
      '    const x = event.clientX;',
      '    const y = event.clientY;',
      '    const endRadius = Math.hypot(',
      '      Math.max(x, innerWidth - x),',
      '      Math.max(y, innerHeight - y)',
      '    );',
      '    const t = document.startViewTransition(() => updateDOM());',
      '    t.ready.then(() => {',
      '      document.documentElement.animate(',
      '        [',
      '          { clipPath: `circle(0px at ${x}px ${y}px)` },',
      '          { clipPath: `circle(${endRadius}px at ${x}px ${y}px)` }',
      '        ],',
      '        {',
      '          duration: 500,',
      '          easing: "ease-in-out",',
      '          pseudoElement: "::view-transition-new(root)"',
      '        }',
      '      );',
      '    });',
      '  }',
      '',
      '【skipTransition()：跳过过渡】',
      '  const t = document.startViewTransition(() => updateDOM());',
      '  // 立即跳过：DOM 已更新但无动画',
      '  t.skipTransition();',
      '  // 常用于：prefers-reduced-motion 用户偏好、过渡出错兜底',
      '',
      '  t.ready.catch(() => {',
      '    console.log("过渡被跳过");',
      '  });',
      '',
      '【禁用默认动画 + 自定义】',
      '  /* 禁用所有默认动画 */',
      '  ::view-transition-old(root),',
      '  ::view-transition-new(root),',
      '  ::view-transition-group(root) {',
      '    animation: none;',
      '  }',
      '  /* 然后用 JS 完全自定义 */',
      '  t.ready.then(() => {',
      '    /* 自定义动画逻辑 */',
      '  });',
      '',
      '【命名元素的自定义动画】',
      '  .hero { view-transition-name: hero; }',
      '  ::view-transition-old(hero) {',
      '    animation: hero-out 0.5s ease-in forwards;',
      '  }',
      '  ::view-transition-new(hero) {',
      '    animation: hero-in 0.5s ease-out forwards;',
      '  }',
      '  // 不同 name 的元素可用不同动画',
      '',
      '【浏览器支持】',
      `  自定义伪元素动画: ${f.viewTransitionPseudo ? '✓' : '✗'} (Chrome 111+/Safari 18+/Firefox 暂不支持)`,
      '  Web Animations API pseudoElement 选项: Chrome 111+',
      '',
      '【常见陷阱】',
      '  1. CSS animation 在伪元素上需 !important 才能覆盖 UA 默认（部分浏览器）',
      '     → 用 animation 简写或更高优先级选择器',
      '  2. JS animate() 的 pseudoElement 选项必须在 ready 之后调用',
      '  3. skipTransition 后 ready reject，finished 仍 resolve（动画跳过）',
      '  4. animation-fill-mode: forwards 确保动画结束保持终态',
      '  5. clip-path 动画性能开销较大，复杂形状慎用',
      '  6. 多个伪元素同时动画可能造成层叠爆炸（limit 合成层数量）',
    ].join('\n');
    this.setState({ customAnimInfo: info });
    this._addLog('css', `自定义动画演示完成；supports=${f.viewTransitionPseudo}`);
  }

  _runCustomAnimTransition(): void {
    const box = document.querySelector('.vt-basic-box');
    if (!box) { this._addLog('warn', '演示元素 .vt-basic-box 未找到'); return; }
    const cb = () => { box.classList.toggle('vt-basic-box--alt'); };
    const t = this._runVT(cb);
    if (t) {
      t.ready.then(() => {
        try {
          document.documentElement.animate(
            [
              { clipPath: 'circle(0% at 50% 50%)' },
              { clipPath: 'circle(150% at 50% 50%)' },
            ],
            { duration: 500, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' },
          );
          this._addLog('info', '已通过 ready 注入圆形展开动画');
        } catch (e: any) {
          this._addLog('warn', `animate pseudoElement 失败：${e.message}`);
        }
      }).catch(() => this._addLog('warn', 'ready reject（过渡被跳过）'));
      t.finished.then(() => this._addLog('info', '自定义动画 finished')).catch(() => this._addLog('warn', '过渡被跳过/取消'));
    }
  }

  _renderCard4(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. 自定义动画与 @keyframes 协同',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['自定义动画', f.viewTransitionPseudo]]),
        h(Tag, { color: 'primary' }, '@keyframes'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '通过 ::view-transition-old(name)/::view-transition-new(name) 设置 animation 自定义过渡，@keyframes vt-fade-out { to { opacity: 0; transform: scale(0.9); } } 新旧状态独立动画。配合 mix-blend-mode/filter 增强效果。ViewTransition.ready.then(() => { /* 修改伪元素动画 */ }) 用 Web Animations API 动态修改（pseudoElement 选项）。skipTransition() 跳过过渡。经典效果：圆形展开（clip-path circle）。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行自定义动画演示', { type: 'primary', size: 'sm', onClick: () => this._runCustomAnimDemo() }),
          this._btn('圆形展开过渡（ready 注入）', { type: 'default', size: 'sm', onClick: () => this._runCustomAnimTransition() }),
        ),
        h('div', { class: 'vt-stage' },
          h('div', { class: 'vt-basic-box' }, 'CUSTOM'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.customAnimInfo || '（点击按钮查看自定义动画与 @keyframes 协同完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 5：ViewTransition.types 与分类过渡 =====================

  _runTypesDemo(): void {
    const f = this._flags();
    this._injectStyle('vt-types-demo', `
      :active-view-transition-type(slide-forward) {
        ::view-transition-old(root) {
          animation: vt-slide-out-left 0.4s ease-in forwards;
        }
        ::view-transition-new(root) {
          animation: vt-slide-in-right 0.4s ease-out forwards;
        }
      }
      :active-view-transition-type(slide-back) {
        ::view-transition-old(root) {
          animation: vt-slide-out-right 0.4s ease-in forwards;
        }
        ::view-transition-new(root) {
          animation: vt-slide-in-left 0.4s ease-out forwards;
        }
      }
      @keyframes vt-slide-out-left {
        to { transform: translateX(-100%); opacity: 0; }
      }
      @keyframes vt-slide-in-right {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes vt-slide-out-right {
        to { transform: translateX(100%); opacity: 0; }
      }
      @keyframes vt-slide-in-left {
        from { transform: translateX(-100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `);
    const info = [
      '===== ViewTransition.types 与分类过渡 =====',
      '',
      '【viewTransition.types —— 过渡类型标签 Set】',
      '  const t = document.startViewTransition(() => updateDOM());',
      '  (t as any).types = new Set(["slide", "forward"]);  // 设置类型标签',
      '  // types 是 Set<string>，可在 ready 前设置',
      '  // 设置后 :active-view-transition-type(name) 伪类匹配',
      '',
      '【新签名：startViewTransition({ update, types })】',
      '  const t = document.startViewTransition({',
      '    update: () => updateDOM(),       // DOM 更新回调',
      '    types: ["slide-forward"],         // 过渡类型',
      '  });',
      '  // Chrome 125+ 支持对象签名',
      '  // 等价于：const t = startViewTransition(cb); (t as any).types = new Set(["slide-forward"]);',
      '',
      '【:active-view-transition-type(name) 伪类】',
      '  /* 仅当过渡类型包含 slide-forward 时生效 */',
      '  :active-view-transition-type(slide-forward) {',
      '    ::view-transition-old(root) {',
      '      animation: slide-out-left 0.4s ease-in forwards;',
      '    }',
      '    ::view-transition-new(root) {',
      '      animation: slide-in-right 0.4s ease-out forwards;',
      '    }',
      '  }',
      '',
      '  /* 反向导航 */',
      '  :active-view-transition-type(slide-back) {',
      '    ::view-transition-old(root) {',
      '      animation: slide-out-right 0.4s ease-in forwards;',
      '    }',
      '    ::view-transition-new(root) {',
      '      animation: slide-in-left 0.4s ease-out forwards;',
      '    }',
      '  }',
      '',
      '  @keyframes slide-out-left  { to { transform: translateX(-100%); opacity: 0; } }',
      '  @keyframes slide-in-right  { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }',
      '  @keyframes slide-out-right { to { transform: translateX(100%); opacity: 0; } }',
      '  @keyframes slide-in-left   { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }',
      '',
      '【SPA 路由不同方向不同动画】',
      '  let navigationDirection = "forward";',
      '',
      '  function navigate(to) {',
      '    const isBack = historyStack.isBack(to);',
      '    const type = isBack ? "slide-back" : "slide-forward";',
      '    const t = document.startViewTransition({',
      '      update: () => renderRoute(to),',
      '      types: [type],',
      '    });',
      '  }',
      '  // forward：新页面从右滑入，旧页面左滑出',
      '  // back：新页面从左滑入，旧页面右滑出',
      '',
      '【类型化的好处：单一样式表声明所有过渡模式】',
      '  /* 一个 CSS 文件声明所有过渡模式，JS 只需设置 types */',
      '  :active-view-transition-type(fade) { ... }',
      '  :active-view-transition-type(slide-forward) { ... }',
      '  :active-view-transition-type(slide-back) { ... }',
      '  :active-view-transition-type(zoom) { ... }',
      '  :active-view-transition-type(expand) { ... }',
      '',
      '  // JS：',
      '  startViewTransition({',
      '    update: () => updateDOM(),',
      '    types: ["zoom"],   // 选择 zoom 过渡模式',
      '  });',
      '',
      '【:active-view-transition 伪类（无类型）】',
      '  /* 任何过渡进行中都匹配 */',
      '  :active-view-transition {',
      '    /* 可用于过渡期间禁用某些动画/样式 */',
      '  }',
      '  :active-view-transition-type(*) {',
      '    /* 匹配任意类型（实验性） */',
      '  }',
      '',
      '【动态修改 types】',
      '  const t = document.startViewTransition(() => updateDOM());',
      '  // ready 前可修改',
      '  t.types.add("extra-effect");',
      '  t.types.delete("default");',
      '  // ready 后修改无效（伪元素树已构建）',
      '',
      '【多类型组合】',
      '  (t as any).types = new Set(["slide", "highlight"]);',
      '  // 同时匹配 slide 和 highlight 的样式都生效',
      '  :active-view-transition-type(slide) { ... }',
      '  :active-view-transition-type(highlight) { ... }',
      '',
      '【浏览器支持】',
      `  :active-view-transition-type(): ${f.activeViewTransitionType ? '✓' : '✗'} (Chrome 125+)`,
      `  startViewTransition({ update, types }): ${f.viewTransitions ? '部分' : '✗'} (Chrome 125+ 对象签名)`,
      '  Safari 18+ 部分支持 types',
      '  Firefox 暂不支持',
      '  // 检测：CSS.supports("selector(:active-view-transition-type(x))")',
      '',
      '【常见陷阱】',
      '  1. types 必须在 ready 前设置，ready 后修改无效',
      '  2. 对象签名 { update, types } 在 Chrome 125+ 才支持，旧版需用 cb + t.types',
      '  3. :active-view-transition-type 仅在过渡期间生效（伪元素树存在时）',
      '  4. types 是 Set，重复 add 同一类型不会叠加',
      '  5. 类型名是 <custom-ident>，不能用引号、不能以数字开头',
      '  6. 未设置 types 时 :active-view-transition-type 不匹配任何类型',
    ].join('\n');
    this.setState({ typesInfo: info });
    this._addLog('css', `ViewTransition.types 演示完成；supports=${f.activeViewTransitionType}`);
  }

  _slideTypes(direction: any): void  {
    const host = document.querySelector('.vt-types-host') as HTMLElement;
    if (!host) { this._addLog('warn', '演示元素 .vt-types-host 未找到'); return; }
    const card = host.querySelector('.vt-types-card');
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    const idx = parseInt(host.dataset.idx || '0', 10);
    const nextIdx = direction === 'forward' ? (idx + 1) % colors.length : (idx - 1 + colors.length) % colors.length;
    const cb = () => {
      host.dataset.idx = String(nextIdx);
      if (card) {
        card.style.background = colors[nextIdx];
        card.textContent = `Page ${nextIdx + 1} / ${colors.length}`;
      }
    };
    const hasObjSig = typeof document !== 'undefined' && typeof document.startViewTransition === 'function';
    let t = null;
    if (hasObjSig) {
      try {
        t = document.startViewTransition({
          update: cb,
          types: [direction === 'forward' ? 'slide-forward' : 'slide-back'],
        });
      } catch (e: any) {
        // 旧版浏览器不支持对象签名，降级
        t = document.startViewTransition(cb);
        if (t && t.types) (t as any).types = new Set([direction === 'forward' ? 'slide-forward' : 'slide-back']);
      }
    } else {
      cb();
      this._addLog('info', 'View Transitions 不可用，直接更新');
      return;
    }
    if (t) {
      t.finished.then(() => this._addLog('info', `types=${direction} 过渡 finished`)).catch(() => this._addLog('warn', '过渡被跳过/取消'));
    }
  }

  _renderCard5(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. ViewTransition.types 与分类过渡',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([[':active-view-transition-type', f.activeViewTransitionType]]),
        h(Tag, { color: 'primary' }, 'types 分类'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'viewTransition.types = Set 设置过渡类型标签，配合 :active-view-transition-type(name) 伪类按类型应用不同动画。document.startViewTransition({ update, types: ["slide"] }) 新签名（Chrome 125+）。SPA 路由不同方向（forward/back）不同动画。类型化的好处：单一样式表声明所有过渡模式，JS 只需设置 types 选择模式。types 必须在 ready 前设置。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 types 演示', { type: 'primary', size: 'sm', onClick: () => this._runTypesDemo() }),
          this._btn('前进 slide-forward', { type: 'default', size: 'sm', onClick: () => this._slideTypes('forward') }),
          this._btn('后退 slide-back', { type: 'default', size: 'sm', onClick: () => this._slideTypes('back') }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '交互演示（点击前进/后退触发不同方向滑动过渡）：'),
        h('div', { class: 'vt-types-host', dataset: { idx: '0' } },
          h('div', { class: 'vt-types-card' }, 'Page 1 / 5'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.typesInfo || '（点击按钮查看 ViewTransition.types 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 6：SPA 路由集成实战 =====================

  _runSpaDemo(): any {
    const f = this._flags();
    this._injectStyle('vt-spa-demo', `
      .vt-spa-page {
        view-transition-name: vt-spa-content;
      }
      ::view-transition-old(vt-spa-content) {
        animation: vt-spa-out 0.35s ease-in forwards;
      }
      ::view-transition-new(vt-spa-content) {
        animation: vt-spa-in 0.35s ease-out forwards;
      }
      @keyframes vt-spa-out {
        to { opacity: 0; transform: translateY(-10px); }
      }
      @keyframes vt-spa-in {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `);
    const info = [
      '===== SPA 路由集成实战 =====',
      '',
      '【核心模式：路由 beforeEach 拦截 DOM 更新】',
      '  router.beforeEach(async (to) => {',
      '    // 1. 检测支持，不支持直接更新',
      '    if (!document.startViewTransition) {',
      '      await updateDOM(to);',
      '      return;',
      '    }',
      '    // 2. 用 startViewTransition 包裹 DOM 更新',
      '    const t = document.startViewTransition(async () => {',
      '      await updateDOM(to);',
      '    });',
      '    // 3. ready 后应用自定义动画',
      '    await t.ready;',
      '    applyAnimation(t, to);',
      '  });',
      '',
      '  async function updateDOM(to) {',
      '    const html = await fetch(to.path).then(r => r.text());',
      '    document.querySelector("#app").innerHTML = html;',
      '  }',
      '',
      '  function applyAnimation(t, to) {',
      '    const direction = to.meta.direction || "forward";',
      '    document.documentElement.animate(',
      '      direction === "forward"',
      '        ? [{ transform: "translateX(100%)" }, { transform: "translateX(0)" }]',
      '        : [{ transform: "translateX(-100%)" }, { transform: "translateX(0)" }],',
      '      {',
      '        duration: 400,',
      '        easing: "ease-in-out",',
      '        pseudoElement: "::view-transition-new(root)"',
      '      }',
      '    );',
      '  }',
      '',
      '【新旧状态元素匹配：view-transition-name（持久布局匹配）】',
      '  /* 路由切换时，相同 name 的元素会平滑过渡位置 */',
      '  .header {',
      '    view-transition-name: header;   /* 每个页面都有 header */',
      '  }',
      '  .sidebar {',
      '    view-transition-name: sidebar;  /* 每个页面都有 sidebar */',
      '  }',
      '  /* 页面切换时 header/sidebar 不淡入淡出，而是平滑保持 */',
      '  /* 仅内容区域淡入淡出 */',
      '',
      '【列表项过渡：每个 item 分配唯一 name】',
      '  <ul class="list">',
      '    <li style="view-transition-name: item-0">Item 0</li>',
      '    <li style="view-transition-name: item-1">Item 1</li>',
      '    <li style="view-transition-name: item-2">Item 2</li>',
      '  </ul>',
      '',
      '  // 过滤/排序时，相同 name 的 item 平滑移动到新位置',
      '  function filterList(query) {',
      '    const t = document.startViewTransition(() => {',
      '      items.forEach(item => {',
      '        item.style.display = item.textContent.includes(query) ? "" : "none";',
      '      });',
      '    });',
      '  }',
      '',
      '【导航方向感：types 分 forward/back】',
      '  let navDirection = "forward";',
      '',
      '  window.addEventListener("popstate", () => {',
      '    navDirection = "back";   // 浏览器后退',
      '  });',
      '',
      '  router.beforeEach((to) => {',
      '    const t = document.startViewTransition({',
      '      update: () => renderRoute(to),',
      '      types: [navDirection],  // forward | back',
      '    });',
      '    navDirection = "forward";  // 重置',
      '  });',
      '',
      '  /* CSS 按方向应用不同动画 */',
      '  :active-view-transition-type(forward) {',
      '    ::view-transition-new(root) {',
      '      animation: slide-in-right 0.4s ease-out;',
      '    }',
      '  }',
      '  :active-view-transition-type(back) {',
      '    ::view-transition-new(root) {',
      '      animation: slide-in-left 0.4s ease-out;',
      '    }',
      '  }',
      '',
      '【Vue Router 集成示例】',
      '  router.beforeEach((to, from) => {',
      '    return new Promise((resolve) => {',
      '      const t = document.startViewTransition(async () => {',
      '        await nextTick();   // 等 Vue 更新 DOM',
      '      });',
      '      t.finished.then(resolve);',
      '    });',
      '  });',
      '',
      '【React Router 集成示例】',
      '  function useViewTransitionNavigate() {',
      '    const navigate = useNavigate();',
      '    return (to) => {',
      '      if (!document.startViewTransition) { navigate(to); return; }',
      '      document.startViewTransition(() => {',
      '        navigate(to);',
      '      });',
      '    };',
      '  }',
      '',
      '【滚动位置保持】',
      '  // 过渡时浏览器默认保持滚动位置',
      '  // 若需重置滚动：在 callback 中设置',
      '  const t = document.startViewTransition(() => {',
      '    updateDOM(to);',
      '    window.scrollTo(0, 0);  // 重置到顶部',
      '  });',
      '',
      '【注意点】',
      '  - 未渲染元素（display:none）不可命名（快照为空）',
      '  - 隐藏元素（visibility:hidden/opacity:0）快照可能为空',
      '  - 路由切换前应确保新页面的 view-transition-name 元素已渲染',
      '  - 异步路由（懒加载）需在 callback 中 await 数据',
      '  - 过渡期间用户交互冻结，避免长时间 callback',
      '',
      '【浏览器支持】',
      `  startViewTransition: ${f.viewTransitions ? '✓' : '✗'} (Chrome 111+/Safari 18+/Firefox 暂不支持)`,
      `  对象签名 { update, types }: Chrome 125+`,
      '',
      '【常见陷阱】',
      '  1. DOM 更新必须在 callback 内，外部更新无法捕获新旧快照',
      '  2. 异步 callback 期间页面冻结，长操作（>200ms）会卡顿',
      '  3. view-transition-name 跨页面需一致才能匹配（A 页 header <-> B 页 header）',
      '  4. 列表项 name 必须稳定（用 ID 而非数组索引，避免重排错乱）',
      '  5. SSR/ hydration 阶段不要触发过渡（DOM 未稳定）',
      '  6. 过渡期间快速连续导航会排队，可能跳过中间过渡',
    ].join('\n');
    this.setState({ spaInfo: info });
    this._addLog('css', `SPA 路由集成演示完成；supports=${f.viewTransitions}`);
  }

  _navigateSpa(page: any): void  {
    const host = document.querySelector('.vt-spa-host') as HTMLElement;
    if (!host) { this._addLog('warn', '演示元素 .vt-spa-host 未找到'); return; }
    const current = parseInt(host.dataset.page || '1', 10);
    const direction = page > current ? 'forward' : 'back';
    const titles = { 1: '首页 Home', 2: '列表 List', 3: '详情 Detail' };
    const cb = () => {
      host.dataset.page = String(page);
      host.innerHTML = '';
      const div = document.createElement('div');
      div.className = 'vt-spa-page vt-spa-page--active';
      div.textContent = ((titles as any)[(page as any)]) || `Page ${page}`;
      host.appendChild(div);
    };
    const hasObjSig = typeof document !== 'undefined' && typeof document.startViewTransition === 'function';
    let t = null;
    if (hasObjSig) {
      try {
        t = document.startViewTransition({ update: cb, types: [`slide-${direction}`] });
      } catch (e: any) {
        t = document.startViewTransition(cb);
        if (t && t.types) (t as any).types = new Set([`slide-${direction}`]);
      }
    } else {
      cb();
      this._addLog('info', `SPA 导航到 ${((titles as any)[(page as any)])}（无过渡）`);
      return;
    }
    if (t) {
      t.finished.then(() => this._addLog('info', `SPA 导航到 ${((titles as any)[(page as any)])}（${direction}）finished`)).catch(() => this._addLog('warn', '过渡被跳过/取消'));
    }
  }

  _renderCard6(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. SPA 路由集成实战',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['SPA 集成', f.viewTransitions]]),
        h(Tag, { color: 'primary' }, '路由集成'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '路由 beforeEach 拦截 DOM 更新，router.beforeEach(async (to) => { const t = document.startViewTransition(async () => { await updateDOM(to); }); await t.ready; applyAnimation(t, to); })。新旧状态元素匹配通过 view-transition-name（持久布局匹配）。列表项过渡（每个 item 分配唯一 name）。导航方向感（types 分 forward/back）。注意点：未渲染元素不可命名、隐藏元素快照可能为空、DOM 更新必须在 callback 内。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 SPA 集成演示', { type: 'primary', size: 'sm', onClick: () => this._runSpaDemo() }),
          this._btn('首页', { type: 'default', size: 'sm', onClick: () => this._navigateSpa(1) }),
          this._btn('列表', { type: 'default', size: 'sm', onClick: () => this._navigateSpa(2) }),
          this._btn('详情', { type: 'default', size: 'sm', onClick: () => this._navigateSpa(3) }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '交互演示（模拟 SPA 路由切换，带方向感）：'),
        h('div', { class: 'vt-spa-host', dataset: { page: '1' } },
          h('div', { class: 'vt-spa-page vt-spa-page--active' }, '首页 Home'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.spaInfo || '（点击按钮查看 SPA 路由集成实战完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 7：复杂场景与陷阱 =====================

  _runComplexDemo(): void {
    const f = this._flags();
    this._injectStyle('vt-complex-demo', `
      .vt-flip-card {
        view-transition-name: vt-flip;
        perspective: 1000px;
      }
      ::view-transition-old(vt-flip) {
        animation: vt-flip-out 0.5s ease-in forwards;
      }
      ::view-transition-new(vt-flip) {
        animation: vt-flip-in 0.5s ease-out forwards;
      }
      @keyframes vt-flip-out {
        to { transform: rotateY(90deg); opacity: 0; }
      }
      @keyframes vt-flip-in {
        from { transform: rotateY(-90deg); opacity: 0; }
        to { transform: rotateY(0); opacity: 1; }
      }
    `);
    const info = [
      '===== 复杂场景与陷阱 =====',
      '',
      '【场景 1：列表/网格过渡（item 新增/删除/重排）】',
      '  <div class="grid">',
      '    <div style="view-transition-name: cell-0">A</div>',
      '    <div style="view-transition-name: cell-1">B</div>',
      '    <div style="view-transition-name: cell-2">C</div>',
      '  </div>',
      '',
      '  function shuffleGrid() {',
      '    const t = document.startViewTransition(() => {',
      '      // 重新排列 DOM 顺序',
      '      grid.append(...[...grid.children].sort(() => Math.random() - 0.5));',
      '    });',
      '  }',
      '  // 相同 name 的 cell 平滑移动到新位置（FLIP 效果）',
      '  // 新增 cell：仅 new 快照淡入',
      '  // 删除 cell：仅 old 快照淡出',
      '',
      '【场景 2：共享元素过渡（元素 A 变成元素 B）】',
      '  /* 列表页缩略图 -> 详情页大图，需相同 name */',
      '  /* 列表页 */',
      '  .thumb-1 { view-transition-name: shared-image; }',
      '',
      '  /* 详情页（导航后）*/',
      '  .hero-image { view-transition-name: shared-image; }',
      '',
      '  // 过渡时：shared-image 从缩略图位置/尺寸平滑过渡到大图',
      '  // group 动画位置和尺寸（如 left/top/width/height 的插值）',
      '  // 经典效果：列表 -> 详情的英雄元素过渡',
      '',
      '【场景 3：3D 翻转（rotateY 配合 perspective）】',
      '  .card {',
      '    view-transition-name: flip-card;',
      '    perspective: 1000px;',
      '  }',
      '  ::view-transition-old(flip-card) {',
      '    animation: flip-out 0.5s ease-in forwards;',
      '  }',
      '  ::view-transition-new(flip-card) {',
      '    animation: flip-in 0.5s ease-out forwards;',
      '  }',
      '  @keyframes flip-out {',
      '    to { transform: rotateY(90deg); opacity: 0; }',
      '  }',
      '  @keyframes flip-in {',
      '    from { transform: rotateY(-90deg); opacity: 0; }',
      '    to   { transform: rotateY(0); opacity: 1; }',
      '  }',
      '',
      '【场景 4：形态变换（圆形变方形）】',
      '  .shape {',
      '    view-transition-name: morph;',
      '  }',
      '  /* 默认 group 动画位置/尺寸，但 border-radius 不插值 */',
      '  /* 需用 JS 自定义动画 */',
      '  t.ready.then(() => {',
      '    document.documentElement.animate(',
      '      [{ borderRadius: "50%" }, { borderRadius: "0%" }],',
      '      {',
      '        duration: 400,',
      '        pseudoElement: "::view-transition-new(morph)"',
      '      }',
      '    );',
      '  });',
      '',
      '【场景 5：滚动位置保持】',
      '  // 默认过渡保持滚动位置',
      '  // 但若新旧页面长度不同，可能出现滚动跳跃',
      '  const t = document.startViewTransition(() => {',
      '    updateDOM();',
      '    // 强制重置滚动',
      '    window.scrollTo(0, savedScrollY);',
      '  });',
      '',
      '【场景 6：字体加载闪烁（FOIT/FOUT）】',
      '  // 过渡时新页面字体未加载完成 -> 快照用回退字体',
      '  // 解决：确保字体加载后再过渡',
      '  async function navigateWithFonts(to) {',
      '    await document.fonts.ready;  // 等字体加载',
      '    const t = document.startViewTransition(() => renderRoute(to));',
      '  }',
      '  // 或用 font-display: optional 避免闪烁',
      '',
      '【陷阱清单】',
      '  1. view-transition-name 必须全局唯一否则 abort',
      '     -> 两个元素同名，整个过渡 abort（控制台报错）',
      '',
      '  2. name 必须新旧状态都存在才独立过渡',
      '     -> 旧状态有 name 但新状态无 -> 仅 old 淡出',
      '     -> 新状态有 name 但旧状态无 -> 仅 new 淡入',
      '',
      '  3. 旧元素删除需在 callback 中完成',
      '     -> callback 外删除：旧快照已捕获不到被删元素',
      '     -> 正确：在 startViewTransition 的 callback 内 remove()',
      '',
      '  4. iframe 内不能触发顶层文档的过渡',
      '     -> iframe 只能过渡自身文档',
      '     -> 跨 frame 过渡不支持',
      '',
      '  5. 动画期间禁用 pointer events',
      '     -> ::view-transition 默认 pointer-events: none（穿透）',
      '     -> 但若设为 auto 会阻塞用户交互',
      '     -> 过渡期间避免依赖点击的交互',
      '',
      '  6. prefers-reduced-motion 降级',
      '     -> 用户偏好减少动态效果时应跳过过渡',
      '     -> if (matchMedia("(prefers-reduced-motion: reduce)").matches) {',
      '          updateDOM();  // 直接更新无过渡',
      '        } else {',
      '          document.startViewTransition(() => updateDOM());',
      '        }',
      '',
      '  7. Safari 支持滞后',
      '     -> Safari 18+ 才支持（2024.09）',
      '     -> iOS 18+ 支持',
      '     -> 旧 Safari 需降级到直接更新 DOM',
      '',
      '  8. 性能：大量命名元素快照开销大',
      '     -> 每个 view-transition-name 单独截图',
      '     -> 100 个命名元素 = 100 次截图 + 100 组伪元素',
      '     -> 限制命名元素数量（<20 个为宜）',
      '     -> 列表项命名仅对可见区域（虚拟滚动配合）',
      '',
      '【性能优化】',
      '  - 减少命名元素数量（仅对真正需要独立过渡的元素命名）',
      '  - callback 内避免长时间同步操作（<16ms）',
      '  - 使用 will-change: transform 提示浏览器',
      '  - 过渡动画用 transform/opacity（仅 composite）',
      '  - 避免在过渡期间触发新的过渡（排队）',
      '',
      '【浏览器支持】',
      `  View Transitions API: ${f.viewTransitions ? '✓' : '✗'} (Chrome 111+/Safari 18+/Firefox 暂不支持)`,
      '  复杂场景（3D/形态变换）依赖 Web Animations API pseudoElement',
      '',
      '【资源】',
      '  - View Transitions API 规范：https://drafts.csswg.org/css-view-transitions/',
      '  - MDN：https://developer.mozilla.org/docs/Web/API/View_Transitions_API',
      '  - Chrome 调试：DevTools -> Animations 面板查看伪元素动画',
    ].join('\n');
    this.setState({ complexInfo: info });
    this._addLog('css', `复杂场景与陷阱演示完成；supports=${f.viewTransitions}`);
  }

  _renderCard7(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. 复杂场景与陷阱（列表/共享元素/3D/形态变换/滚动/字体）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['复杂场景', f.viewTransitions]]),
        h(Tag, { color: 'primary' }, '陷阱清单'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '列表/网格过渡（item 新增/删除/重排，每个 item 分配唯一 name 实现平滑重排）。共享元素过渡（元素 A 变成元素 B，需相同 name，如列表缩略图到详情大图）。3D 翻转（rotateY 配合 perspective）。形态变换（圆形变方形，需 JS 自定义动画因 border-radius 不插值）。滚动位置保持。字体加载闪烁（FOIT/FOUT，用 document.fonts.ready）。陷阱清单：name 全局唯一/新旧状态都存在/旧元素删除需在 callback/iframe 不能触发/动画期间 pointer events/减少动画降级/Safari 滞后/性能快照开销大。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行复杂场景演示', { type: 'primary', size: 'sm', onClick: () => this._runComplexDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.complexInfo || '（点击按钮查看复杂场景与陷阱完整清单）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 8：vs Cross-Document View Transitions 与最佳实践 =====================

  _runBestPracticeDemo(): any {
    const f = this._flags();
    this._injectStyle('vt-best-practice-demo', `
      @media (prefers-reduced-motion: reduce) {
        ::view-transition-old(*),
        ::view-transition-new(*) {
          animation: none !important;
        }
      }
      ::view-transition-old(root),
      ::view-transition-new(root) {
        animation-duration: 300ms;
        animation-timing-function: ease-in-out;
      }
    `);
    const info = [
      '===== vs Cross-Document View Transitions 与最佳实践 =====',
      '',
      '【同文档（Same-Document / SPA）vs 跨文档（Cross-Document / MPA）】',
      '  同文档（L1，本页专注）：',
      '    - document.startViewTransition(callback)',
      '    - callback 内更新 DOM（SPA 路由切换）',
      '    - 单页面应用，无整页刷新',
      '    - Chrome 111+ / Safari 18+ / Firefox 暂不支持',
      '',
      '  跨文档（L2，已在 ViewTransitionsL2Page 覆盖）：',
      '    - @view-transition { navigation: auto; } 声明',
      '    - 多页面应用（MPA），整页导航',
      '    - pageswap / pagereveal 事件',
      '    - <meta name="view-transition"> / HTTP View-Transition 头',
      '    - Chrome 124+ 才支持',
      '',
      '【跨文档用 @view-transition { navigation: auto; }】',
      '  /* 在所有页面声明 */',
      '  @view-transition {',
      '    navigation: auto;   /* 启用跨文档过渡 */',
      '  }',
      '  // 配合 pageswap/pagereveal 事件自定义',
      '  // 详见 ViewTransitionsL2Page',
      '',
      '  /* 跨文档事件 */',
      '  window.addEventListener("pageswap", (e: any) => {',
      '    // 旧页面卸载时，设置 types',
      '    if (e.viewTransition) {',
      '      e.viewTransition.types = new Set(["slide"]);',
      '    }',
      '  });',
      '  window.addEventListener("pagereveal", (e: any) => {',
      '    // 新页面揭示时，可自定义动画',
      '    if (e.viewTransition) {',
      '      const t = e.viewTransition;',
      '      t.ready.then(() => { /* 自定义动画 */ });',
      '    }',
      '  });',
      '',
      '【本页专注同文档 SPA 场景】',
      '  - SPA 路由切换（Vue Router / React Router）',
      '  - 列表过滤/排序',
      '  - 主题切换（深色/浅色）',
      '  - 模态框/抽屉打开关闭',
      '  - 标签页切换',
      '  - 数据刷新（loading -> content）',
      '',
      '【最佳实践 1：渐进增强（无支持时直接更新 DOM）】',
      '  function safeUpdate(updateFn) {',
      '    if (typeof document.startViewTransition !== "function") {',
      '      updateFn();   // 不支持，直接更新',
      '      return;',
      '    }',
      '    document.startViewTransition(updateFn);',
      '  }',
      '  // 所有过渡入口都用此封装，确保降级',
      '',
      '【最佳实践 2：prefers-reduced-motion 尊重用户偏好】',
      '  function updateWithTransition(updateFn) {',
      '    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;',
      '    if (reduceMotion || !document.startViewTransition) {',
      '      updateFn();',
      '      return;',
      '    }',
      '    document.startViewTransition(updateFn);',
      '  }',
      '',
      '  /* CSS 层面也可降级 */',
      '  @media (prefers-reduced-motion: reduce) {',
      '    ::view-transition-old(*),',
      '    ::view-transition-new(*) {',
      '      animation: none !important;',
      '    }',
      '  }',
      '',
      '【最佳实践 3：动画时长 200-400ms】',
      '  ::view-transition-old(root),',
      '  ::view-transition-new(root) {',
      '    animation-duration: 300ms;   /* 推荐范围 200-400ms */',
      '    animation-timing-function: ease-in-out;',
      '  }',
      '  // 太短（<200ms）：用户感知不到过渡',
      '  // 太长（>400ms）：感觉迟钝、卡顿',
      '  // 250-350ms 是最佳区间',
      '',
      '【最佳实践 4：避免过度装饰】',
      '  - 不要为每个状态变化都加过渡（仅重要变化）',
      '  - 避免复杂 clip-path 动画（性能开销）',
      '  - 限制命名元素数量（<20）',
      '  - 过渡动画用 transform/opacity（GPU 友好）',
      '  - 同一时刻仅一个过渡（避免排队）',
      '',
      '【最佳实践 5：可访问性焦点管理】',
      '  // 过渡后需将焦点移到新内容',
      '  const t = document.startViewTransition(() => {',
      '    updateDOM();',
      '    const main = document.querySelector("#main");',
      '    main.focus();   // 焦点移到新内容',
      '  });',
      '  // 屏幕阅读器用户依赖焦点导航',
      '  // 过渡不应影响键盘导航顺序',
      '',
      '【最佳实践 6：调试技巧】',
      '  - DevTools -> Animations 面板：查看伪元素动画时间线',
      '  - DevTools -> Elements 面板：过渡期间可检查 ::view-transition-*',
      '  - DevTools -> Rendering 面板：勾选 "Emulate prefers-reduced-motion"',
      '  - 控制台：document.startViewTransition 时观察 console 报错（name 重复等）',
      '  - Performance 面板：录制过渡，查看快照/合成耗时',
      '',
      '  /* 调试：临时放慢动画 */',
      '  ::view-transition-old(*),',
      '  ::view-transition-new(*) {',
      '    animation-duration: 3s !important;   /* 放慢观察 */',
      '  }',
      '',
      '【最佳实践 7：性能预算】',
      '  - callback 执行 < 50ms（避免主线程阻塞）',
      '  - 命名元素 < 20 个（快照开销）',
      '  - 过渡动画总时长 < 500ms',
      '  - 过渡期间 GPU 内存增长 < 10MB',
      '  - 60fps 预算：每帧 16.67ms（快照捕获不应丢帧）',
      '',
      '【完整封装：生产级工具函数】',
      '  function withViewTransition(updateFn, options = {}) {',
      '    const { types = [], skipIfReduced = true } = options;',
      '    if (skipIfReduced && matchMedia("(prefers-reduced-motion: reduce)").matches) {',
      '      updateFn();',
      '      return Promise.resolve();',
      '    }',
      '    if (typeof document.startViewTransition !== "function") {',
      '      updateFn();',
      '      return Promise.resolve();',
      '    }',
      '    const t = document.startViewTransition(updateFn);',
      '    if (types.length && t.types) {',
      '      (t as any).types = new Set(types);',
      '    }',
      '    return t.finished.catch(() => { /* 跳过不算错误 */ });',
      '  }',
      '',
      '  // 使用：',
      '  await withViewTransition(() => renderRoute(to), { types: ["slide-forward"] });',
      '',
      '【浏览器支持总览】',
      `  同文档 L1 startViewTransition: ${f.viewTransitions ? '✓' : '✗'} (Chrome 111+/Safari 18+/Firefox 暂不支持)`,
      `  view-transition-name: ${f.viewTransitionName ? '✓' : '✗'}`,
      `  ::view-transition-*: ${f.viewTransitionPseudo ? '✓' : '✗'}`,
      `  :active-view-transition-type(): ${f.activeViewTransitionType ? '✓' : '✗'} (Chrome 125+)`,
      '  跨文档 L2 @view-transition: Chrome 124+',
      '  对象签名 { update, types }: Chrome 125+',
      '',
      '【资源】',
      '  - View Transitions L1 规范：https://drafts.csswg.org/css-view-transitions-1/',
      '  - View Transitions L2 规范：https://drafts.csswg.org/css-view-transitions-2/',
      '  - MDN View Transitions API：https://developer.mozilla.org/docs/Web/API/View_Transitions_API',
      '  - Chrome 调试：DevTools -> Animations 面板',
      '  - 跨文档详见 ViewTransitionsL2Page（pageswap/pagereveal/Navigation API）',
    ].join('\n');
    this.setState({ bestPracticeInfo: info });
    this._addLog('css', `最佳实践演示完成；supports=${f.viewTransitions}/${f.activeViewTransitionType}`);
  }

  _renderCard8(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. vs Cross-Document View Transitions 与最佳实践',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['同文档 L1', f.viewTransitions],
          ['跨文档 L2', false],
        ]),
        h(Tag, { color: 'primary' }, '最佳实践'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '同文档 vs 跨文档（MPA）对比：跨文档用 @view-transition { navigation: auto; } + pageswap/pagereveal 事件（已在 ViewTransitionsL2Page 覆盖），本页专注同文档 SPA 场景。最佳实践：渐进增强（无支持时直接更新 DOM）、prefers-reduced-motion 尊重用户偏好、动画时长 200-400ms、避免过度装饰、可访问性焦点管理、调试技巧（DevTools Animations 面板查看伪元素动画）、性能预算（callback <50ms、命名元素 <20、GPU 内存 <10MB）。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行最佳实践演示', { type: 'primary', size: 'sm', onClick: () => this._runBestPracticeDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.bestPracticeInfo || '（点击按钮查看 vs Cross-Document 与最佳实践完整指南）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  _renderLogPanel(): Node | string {
    const s = this.state;
    if (!s.logs || s.logs.length === 0) return '';
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

  renderPage(): Node | string | (Node | string)[] {
    const s = this.state;
    return [
      h('h2', { class: 'section-title' }, 'CSS View Transitions 视图过渡（同文档）深度实验室'),

      h(Alert, {
        type: 'info',
        message: 'View Transitions API (L1) 同文档（Same-Document / SPA）场景深度实验室',
        description: '演示 document.startViewTransition(callback) 核心入口（返回 ViewTransition 对象，含 ready/updateCallbackDone/finished/skipped Promise + skipTransition()，四阶段流程：捕获旧快照 -> 执行 callback -> 捕获新快照 -> 交叉淡入淡出）、::view-transition 伪元素树（::view-transition 根容器 / ::view-transition-group(name) / ::view-transition-image-pair(name) / ::view-transition-old(name) / ::view-transition-new(name)，未命名元素进入 root 组）、view-transition-name 命名与独立过渡（<custom-ident>|none，全局唯一约束，列表项动态命名）、自定义动画与 @keyframes 协同（伪元素 animation + ready 后 Web Animations API pseudoElement 选项 + skipTransition）、ViewTransition.types 分类过渡（types Set + :active-view-transition-type() 伪类 + 对象签名 { update, types }）、SPA 路由集成实战（beforeEach 拦截 + 列表项过渡 + 导航方向感）、复杂场景与陷阱（列表/网格/共享元素/3D 翻转/形态变换/滚动/字体/陷阱清单）、vs Cross-Document 与最佳实践（同文档 vs 跨文档 MPA 对比 + 渐进增强 + prefers-reduced-motion + 200-400ms 时长 + 调试技巧 + 性能预算）。用 CSS.supports() 与 typeof document.startViewTransition === "function" 检测，jsdom 不做真实快照但流程完整，真实浏览器可查看过渡效果。',
      }),

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
    
    ] as (Node | string)[];
  }
}
