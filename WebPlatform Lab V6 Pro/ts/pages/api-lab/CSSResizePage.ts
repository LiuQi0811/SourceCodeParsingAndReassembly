// =====================================================================
// CSSResizePage.js —— CSS Resize 属性 完整 实验室
// 演示 CSS UI Module Level 4 中 resize 属性的全套能力：
//   1. resize 属性概述 —— CSS UI Module Level 4 / resize 属性 / 与 overflow
//      必须配合 / 浏览器支持完整 / 默认 none / textarea UA 默认 resize: both
//   2. 值全集 —— none|both|horizontal|vertical|block|inline / 物理值 vs
//      逻辑值 / writing-mode 适配 / 默认 none
//   3. 与 overflow 协同 —— resize: both; overflow: auto; 必备组合 /
//      不同 overflow 值效果差异 / overflow: hidden 仍可 resize
//   4. min/max-width/height 约束 —— resize 范围限制 / 与 min-width/
//      max-width/min-height/max-height 协同 / 防止拖出布局
//   5. 逻辑值 block/inline —— resize: inline 横向 / resize: block 纵向 /
//      writing-mode 翻转 / Chrome 111+
//   6. ::-webkit-resizer 伪元素 —— Webkit 私有 / 隐藏 resize 手柄 /
//      自定义手柄样式 / 与 resize 协同
//   7. 实战场景 —— IDE 多面板布局 / 表格列宽调整 / 调试器面板 /
//      文本输入框自适应 / 与 JS 拖拽库对比
//   8. 陷阱与最佳实践 —— textarea 默认 resize: both / 移动端触摸支持 /
//      与 flexbox/grid 项目冲突 / ResizeObserver 监听拖拽尺寸 /
//      无障碍键盘等价
// 说明：所有特性调用前做 typeof / CSS.supports 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。jsdom 不做真实 CSS 渲染，
//       CSS.supports 通常可用；ResizeObserver 在 jsdom 通常不可用，统一兜底。
//       注入演示样式 + 完整代码示例，真实浏览器可查看可拖拽手柄效果。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { Props, State } from '../../core/types.js';

interface LogEntry { type: string; content: string; time: string; }

interface CSSResizePageState extends State {
  logs: LogEntry[];
  capsSummary: string;
  overviewInfo: string;
  valuesInfo: string;
  overflowInfo: string;
  constraintsInfo: string;
  logicalInfo: string;
  resizerInfo: string;
  patternsInfo: string;
  pitfallsInfo: string;
}

interface BtnOpts extends Props {
  type?: string;
  size?: string;
  disabled?: boolean;
  danger?: boolean;
  loading?: boolean;
  onClick: (e: MouseEvent) => void;
}

export class CSSResizePage extends Page {
  declare state: CSSResizePageState;
  _inited: boolean = false;
  _dynamicStyles: HTMLStyleElement[] = [];
  _resizeObservers: any = undefined as any;
  _resizeMode: string = '';
  _overflowMode: string = '';
  _logicalMode: string = '';
  _writingMode: string = '';
  _resizerHidden: boolean = false;
  _resizerCustom: boolean = false;


  // —— 初始 state ——
  initialState(): CSSResizePageState {
    return {
      logs: [],
      capsSummary: '',
      overviewInfo: '',      // Card 1：resize 属性概述
      valuesInfo: '',        // Card 2：值全集
      overflowInfo: '',      // Card 3：与 overflow 协同
      constraintsInfo: '',   // Card 4：min/max-width/height 约束
      logicalInfo: '',       // Card 5：逻辑值 block/inline
      resizerInfo: '',       // Card 6：::-webkit-resizer 伪元素
      patternsInfo: '',      // Card 7：实战场景
      pitfallsInfo: '',      // Card 8：陷阱与最佳实践
    };
  }

  // —— 生命周期 ——
  componentDidMount(): void {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._dynamicStyles = [];     // 动态创建并插入 head 的 <style> 元素列表
    this._resizeObservers = [];   // ResizeObserver 实例列表（componentWillUnmount 中断开）

    this._resizeMode = 'both';              // Card 1 / Card 2 当前 resize 值
    this._overflowMode = 'auto';            // Card 3 当前 overflow 值
    this._logicalMode = 'inline';           // Card 5 当前逻辑值（inline/block）
    this._writingMode = 'horizontal-tb';    // Card 5 当前 writing-mode
    this._resizerHidden = false;            // Card 6 ::-webkit-resizer 是否隐藏
    this._resizerCustom = false;            // Card 6 ::-webkit-resizer 是否自定义

    // 一次性能力检测：CSS resize 全家桶
    const f = this._flags();
    const c = (ok: boolean) => ok ? '✓' : '✗';
    const parts = [
      `CSS ${c(f.css)}`,
      `supports ${c(f.supports)}`,
      `resize:both ${c(f.resizeBoth)}`,
      `resize:horizontal ${c(f.resizeHorizontal)}`,
      `resize:vertical ${c(f.resizeVertical)}`,
      `resize:block ${c(f.resizeBlock)}`,
      `resize:inline ${c(f.resizeInline)}`,
      `ResizeObserver ${c(f.resizeObserver)}`,
      `::-webkit-resizer ${c(f.webkitResizer)}`,
    ];

    const summary = f.css
      ? `CSS Resize 属性能力检测：${parts.join(' · ')}。jsdom 不做真实 CSS 渲染，但 CSS.supports 通常可用；resize 5 个取值（both/horizontal/vertical/block/inline）现代浏览器支持完整（block/inline 为 CSS UI L4 逻辑值，Chrome 111+ 支持）。按钮点击注入演示样式 + 完整代码示例，真实浏览器可查看可拖拽手柄效果。`
      : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。';

    this.setState({ capsSummary: summary });
    this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.resizeBlock) this._addLog('warn', 'resize: block 不可用或 jsdom 未识别（CSS UI L4 逻辑值，Chrome 111+ / Firefox 119+ / Safari 16.4+ 支持）');
    if (!f.resizeInline) this._addLog('warn', 'resize: inline 不可用或 jsdom 未识别（CSS UI L4 逻辑值，Chrome 111+ / Firefox 119+ / Safari 16.4+ 支持）');
    if (!f.resizeObserver) this._addLog('warn', 'ResizeObserver 不可用（jsdom 通常不实现，现代浏览器全支持：Chrome 64+ / Firefox 69+ / Safari 13.1+）');

    // 一次性注入全部演示样式（仅一次；rerender 不会移除 head 中的 style）
    this._injectDemoStyles();
    // 延迟绑定 ResizeObserver（DOM 渲染后挂载）
    this._setupResizeObserver();
  }

  componentWillUnmount(): void {
    // 移除动态创建的 <style> 元素，便于 GC
    for (const style of this._dynamicStyles) {
      try { style.parentNode && style.parentNode.removeChild(style); } catch { /* noop */ }
    }
    this._dynamicStyles = [];
    // 断开所有 ResizeObserver，避免内存泄漏
    for (const ro of this._resizeObservers) {
      try { ro.disconnect(); } catch { /* noop */ }
    }
    this._resizeObservers = [];
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

  // 返回 Tag 数组：items = [[label, ok], ...]，展示能力状态（✓/✗）
  _caps(): any;
  _caps(items: [string, boolean][]): Node[];
  _caps(items?: [string, boolean][]): any {
    return items!.map(([label, ok]: [string, boolean]) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  // 返回布尔能力对象（供 capsSummary / 按钮 disabled 使用）
  _flags(): any {
    const hasCSS = typeof CSS !== 'undefined';
    const supportsPV = (p: string, v: string) => {
      try { return hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v); }
      catch { return false; }
    };
    return {
      css: hasCSS,
      supports: hasCSS && typeof CSS.supports === 'function',
      // resize 五个取值
      resizeBoth: supportsPV('resize', 'both'),
      resizeHorizontal: supportsPV('resize', 'horizontal'),
      resizeVertical: supportsPV('resize', 'vertical'),
      resizeBlock: supportsPV('resize', 'block'),
      resizeInline: supportsPV('resize', 'inline'),
      // ResizeObserver API
      resizeObserver: typeof ResizeObserver !== 'undefined',
      // ::-webkit-resizer 是 Webkit/Blink 私有伪元素，CSS.supports 无法探测
      // 仅在现代 Webkit/Blink 浏览器可用，Firefox 不支持；此处恒为 true 仅做展示
      webkitResizer: true,
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

  // —— 动态注入所有演示样式 ——
  _injectDemoStyles(): void {
    this._injectStyle('css-resize-demo', `
      /* ===== 通用 resize 舞台 ===== */
      .resize-stage {
        margin-top: 10px;
        padding: 12px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
      }
      /* ===== Card 1 / Card 2：可拖拽元素 ===== */
      .rs-box {
        width: 200px;
        height: 100px;
        padding: 10px;
        background: #dbeafe;
        border: 2px solid #3b82f6;
        color: #1e3a8a;
        border-radius: 6px;
        font-size: 13px;
        overflow: auto;
        resize: both;
        min-width: 80px;
        min-height: 60px;
        white-space: pre-wrap;
      }
      /* ===== Card 3：overflow 协同演示 ===== */
      .rs-overflow {
        width: 220px;
        height: 100px;
        padding: 10px;
        background: #fef3c7;
        border: 2px solid #f59e0b;
        color: #78350f;
        border-radius: 6px;
        font-size: 13px;
        resize: both;
        white-space: pre-wrap;
      }
      /* ===== Card 4：min/max 约束 ===== */
      .rs-constrained {
        width: 200px;
        height: 100px;
        padding: 10px;
        background: #dcfce7;
        border: 2px solid #10b981;
        color: #064e3b;
        border-radius: 6px;
        font-size: 13px;
        overflow: auto;
        resize: both;
        min-width: 100px;
        max-width: 500px;
        min-height: 80px;
        max-height: 400px;
        white-space: pre-wrap;
      }
      /* ===== Card 5：逻辑值 + writing-mode ===== */
      .rs-logical {
        width: 200px;
        height: 120px;
        padding: 10px;
        background: #ede9fe;
        border: 2px solid #8b5cf6;
        color: #4c1d95;
        border-radius: 6px;
        font-size: 13px;
        overflow: auto;
        resize: inline;
        white-space: pre-wrap;
      }
      .rs-vertical-rl { writing-mode: vertical-rl; }
      /* ===== Card 6：::-webkit-resizer 自定义 ===== */
      .rs-resizer {
        width: 200px;
        height: 100px;
        padding: 10px;
        background: #fee2e2;
        border: 2px solid #ef4444;
        color: #7f1d1d;
        border-radius: 6px;
        font-size: 13px;
        overflow: auto;
        resize: both;
        white-space: pre-wrap;
      }
      .rs-resizer.rs-hidden-handle::-webkit-resizer {
        display: none;
      }
      .rs-resizer.rs-custom-handle::-webkit-resizer {
        background: linear-gradient(135deg, #ef4444 50%, transparent 50%);
        background-color: #fef3c7;
      }
      /* ===== Card 7：IDE 面板布局 ===== */
      .rs-ide {
        display: flex;
        height: 200px;
        margin-top: 10px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        overflow: hidden;
      }
      .rs-ide-sidebar {
        width: 160px;
        padding: 8px;
        background: #1e293b;
        color: #e2e8f0;
        font-size: 12px;
        overflow: auto;
        resize: horizontal;
        min-width: 100px;
        max-width: 400px;
        white-space: pre-wrap;
      }
      .rs-ide-main {
        flex: 1;
        padding: 8px;
        background: #0f172a;
        color: #93c5fd;
        font-family: monospace;
        font-size: 12px;
        overflow: auto;
        white-space: pre-wrap;
      }
      .rs-ide-bottom-wrap {
        margin-top: 10px;
      }
      .rs-ide-bottom {
        height: 80px;
        padding: 8px;
        background: #1e293b;
        color: #fbbf24;
        font-family: monospace;
        font-size: 12px;
        overflow: auto;
        resize: vertical;
        min-height: 40px;
        max-height: 300px;
        border: 1px solid #475569;
        border-radius: 6px;
        white-space: pre-wrap;
      }
      /* ===== Card 8：textarea 演示 ===== */
      .rs-textarea {
        width: 100%;
        padding: 8px;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        font-size: 13px;
        min-height: 60px;
        resize: vertical;
        box-sizing: border-box;
      }
      .rs-textarea.rs-no-resize { resize: none; }
      /* ===== ResizeObserver 监听尺寸（Card 8）===== */
      .rs-observer-target {
        width: 200px;
        height: 80px;
        padding: 10px;
        background: #e0e7ff;
        border: 2px solid #6366f1;
        color: #312e81;
        border-radius: 6px;
        font-size: 13px;
        overflow: auto;
        resize: both;
        min-width: 80px;
        min-height: 50px;
        white-space: pre-wrap;
      }
      /* ===== 输出区 ===== */
      .rs-output {
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

  // —— ResizeObserver 监听拖拽尺寸（Card 8 演示）——
  _setupResizeObserver() {
    if (!this._flags().resizeObserver) {
      this._addLog('warn', 'ResizeObserver 不可用，跳过尺寸监听演示（jsdom 通常不实现）');
      return;
    }
    // 延迟到 DOM 渲染后挂载 observer
    requestAnimationFrame(() => {
      if (this._destroyed) return;
      const target = this.el && this.el.querySelector('.rs-observer-target');
      if (!target) {
        this._addLog('warn', 'ResizeObserver：未找到 .rs-observer-target 目标元素');
        return;
      }
      try {
        const ro = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const cr = entry.contentRect;
            const w = Math.round(cr.width);
            const h = Math.round(cr.height);
            const out = this.el && this.el.querySelector('.rs-observer-output');
            if (out) {
              out.textContent = `ResizeObserver 触发：\n  width = ${w}px\n  height = ${h}px\n  target = .rs-observer-target\n  time = ${formatTime()}`;
            }
          }
        });
        ro.observe(target);
        this._resizeObservers.push(ro);
        this._addLog('info', 'ResizeObserver 已绑定 .rs-observer-target，拖拽该元素将触发回调');
      } catch (err: any) {
        this._addLog('warn', `ResizeObserver 绑定失败：${err.name} - ${err.message}`);
      }
    });
  }

  // =================== Card 1：resize 属性概述 ===================

  _readOverviewInfo(): string {
    const f = this._flags();
    try {
      const box = this.el && this.el.querySelector('.rs-box');
      let computed = '(未渲染)';
      let computedOv = '(未渲染)';
      if (box) {
        computed = window.getComputedStyle(box).getPropertyValue('resize') || '(空)';
        computedOv = window.getComputedStyle(box).getPropertyValue('overflow') || '(空)';
      }
      return `===== CSS resize 属性概述 =====\n` +
        `\n` +
        `【规范归属】\n` +
        `  resize 属性定义于 CSS UI Module Level 4（W3C 规范）\n` +
        `  前身 CSS3 Basic User Interface Module（CSS3 UI）已包含 resize\n` +
        `  规范地址：https://www.w3.org/TR/css-ui-4/#resize\n` +
        `\n` +
        `【属性作用】\n` +
        `  resize 属性允许用户通过鼠标拖拽右下角手柄来调整元素尺寸\n` +
        `  常见场景：textarea 默认 resize: both；调试器面板；IDE 多面板；表格列宽\n` +
        `  与 JS 拖拽库（如 interact.js、jQuery UI resizable）相比，原生 resize 性能更好\n` +
        `\n` +
        `【与 overflow 必须配合】\n` +
        `  resize 属性要求 overflow 不为 visible 才能生效\n` +
        `  即 overflow: visible 时 resize 无效（手柄不显示）\n` +
        `  常见组合：resize: both; overflow: auto;（必备组合）\n` +
        `  overflow: hidden 也可 resize（内容超出隐藏但仍可拖拽）\n` +
        `\n` +
        `【当前演示元素】\n` +
        `  .rs-box { resize: ${this._resizeMode}; overflow: auto; }\n` +
        `    resize 计算值="${computed}"\n` +
        `    overflow 计算值="${computedOv}"\n` +
        `  CSS.supports('resize','both') = ${f.resizeBoth}\n` +
        `  CSS.supports('resize','horizontal') = ${f.resizeHorizontal}\n` +
        `  CSS.supports('resize','vertical') = ${f.resizeVertical}\n` +
        `  CSS.supports('resize','block') = ${f.resizeBlock}\n` +
        `  CSS.supports('resize','inline') = ${f.resizeInline}\n` +
        `\n` +
        `【浏览器支持】\n` +
        `  resize: both / horizontal / vertical —— 全部现代浏览器支持\n` +
        `    Chrome 1+ / Firefox 4+ / Safari 3+ / Edge 79+ / Opera 12.1+\n` +
        `  resize: block / inline —— CSS UI L4 逻辑值\n` +
        `    Chrome 111+ / Edge 111+ / Firefox 119+ / Safari 16.4+\n` +
        `  ::-webkit-resizer 伪元素 —— 仅 Webkit/Blink 支持（Chrome/Safari/Edge）\n` +
        `    Firefox 不支持（Gecko 无对应伪元素）\n` +
        `  ResizeObserver API —— 现代浏览器全支持\n` +
        `    Chrome 64+ / Firefox 69+ / Safari 13.1+ / Edge 79+\n` +
        `\n` +
        `【默认值】\n` +
        `  resize 默认值：none（不可拖拽）\n` +
        `  特例：textarea 元素 UA 默认 stylesheet 设置 resize: both\n` +
        `    所以 textarea 默认可拖拽，需显式 resize: none 关闭\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  <style>\n` +
        `    .resizable-box {\n` +
        `      resize: both;\n` +
        `      overflow: auto;\n` +
        `      width: 200px;\n` +
        `      height: 100px;\n` +
        `      min-width: 80px;\n` +
        `      min-height: 60px;\n` +
        `      padding: 10px;\n` +
        `      border: 2px solid #3b82f6;\n` +
        `      background: #dbeafe;\n` +
        `    }\n` +
        `  </style>\n` +
        `  <div class="resizable-box">拖拽右下角手柄调整尺寸</div>`;
    } catch (err: any) {
      return `读取 resize 概述信息失败：${err.name} - ${err.message}`;
    }
  }

  _runOverviewDemo(): void {
    this.setState({ overviewInfo: this._readOverviewInfo() });
    this._addLog('resize', `resize 概述演示：当前 resize=${this._resizeMode}，支持 both=${this._flags().resizeBoth}`);
  }

  _renderCard1(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. resize 属性概述 —— CSS UI Module Level 4',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['resize:both', f.resizeBoth], ['resize:block', f.resizeBlock], ['resize:inline', f.resizeInline]]),
        h(Tag, { color: 'primary' }, 'CSS UI L4'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'resize 属性定义于 CSS UI Module Level 4，允许用户通过鼠标拖拽右下角手柄调整元素尺寸。规范要求 overflow 不为 visible 才能生效（必备组合：resize: both; overflow: auto;）。resize: both/horizontal/vertical 全部现代浏览器支持；resize: block/inline 为 CSS UI L4 逻辑值，Chrome 111+ 支持。textarea 元素 UA 默认设置 resize: both，需显式 resize: none 关闭。::-webkit-resizer 伪元素仅 Webkit/Blink 支持可自定义手柄。ResizeObserver API 可监听拖拽尺寸变化。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取概述信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runOverviewDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '可拖拽元素（真实浏览器拖右下角手柄）：'),
        h('div', { class: 'rs-box' },
          '拖拽右下角手柄调整尺寸\n（jsdom 不渲染手柄，但 DOM 与样式正确）\n当前 resize: ' + this._resizeMode,
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.overviewInfo || '（点击「读取概述信息」查看 resize 属性完整说明）')),
        h(Alert, {
          type: 'info',
          message: 'resize 必须配合 overflow 非 visible 值',
          description: 'overflow: visible 时 resize 无效（手柄不显示）。必备组合 resize: both; overflow: auto;。overflow: hidden 也可 resize（内容超出隐藏但仍可拖拽）。textarea UA 默认 resize: both，需显式 resize: none 关闭。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 2：值全集 ===================

  _readValuesInfo(): string {
    const f = this._flags();
    try {
      const box = this.el && this.el.querySelector('.rs-box');
      let computed = '(未渲染)';
      if (box) {
        computed = window.getComputedStyle(box).getPropertyValue('resize') || '(空)';
      }
      return `===== CSS resize 值全集 =====\n` +
        `\n` +
        `【语法】\n` +
        `  resize: none | both | horizontal | vertical | block | inline\n` +
        `\n` +
        `【取值详解】\n` +
        `  none        —— 不可拖拽（默认值，textarea 例外 UA 默认 both）\n` +
        `  both        —— 横纵双向均可拖拽（手柄在右下角，呈双向箭头）\n` +
        `  horizontal  —— 仅横向拖拽（仅改变 width，手柄呈左右箭头）\n` +
        `  vertical    —— 仅纵向拖拽（仅改变 height，手柄呈上下箭头）\n` +
        `  block       —— 沿 block 方向拖拽（CSS UI L4 逻辑值）\n` +
        `                  默认 writing-mode: horizontal-tb 时 = vertical\n` +
        `                  writing-mode: vertical-rl/lr 时 = horizontal\n` +
        `  inline      —— 沿 inline 方向拖拽（CSS UI L4 逻辑值）\n` +
        `                  默认 writing-mode: horizontal-tb 时 = horizontal\n` +
        `                  writing-mode: vertical-rl/lr 时 = vertical\n` +
        `\n` +
        `【物理值 vs 逻辑值】\n` +
        `  物理值（horizontal/vertical）—— 始终相对物理屏幕方向\n` +
        `    horizontal 永远是横向（屏幕左右方向）\n` +
        `    vertical 永远是纵向（屏幕上下方向）\n` +
        `  逻辑值（block/inline）—— 相对书写方向（writing-mode）\n` +
        `    block：块流动方向（中文/英文默认从上到下，即 vertical）\n` +
        `    inline：行内流动方向（中文/英文默认从左到右，即 horizontal）\n` +
        `    writing-mode: vertical-rl 时，block = 横向，inline = 纵向\n` +
        `\n` +
        `【writing-mode 适配表】\n` +
        `  writing-mode            | block 等价 | inline 等价\n` +
        `  ------------------------|------------|------------\n` +
        `  horizontal-tb（默认）   | vertical   | horizontal\n` +
        `  vertical-rl             | horizontal | vertical\n` +
        `  vertical-lr             | horizontal | vertical\n` +
        `  sideways-rl             | horizontal | vertical\n` +
        `  sideways-lr             | horizontal | vertical\n` +
        `\n` +
        `【当前演示元素】\n` +
        `  .rs-box { resize: ${this._resizeMode}; overflow: auto; }\n` +
        `    resize 计算值="${computed}"\n` +
        `  CSS.supports 检测：\n` +
        `    resize:both       = ${f.resizeBoth}\n` +
        `    resize:horizontal = ${f.resizeHorizontal}\n` +
        `    resize:vertical   = ${f.resizeVertical}\n` +
        `    resize:block      = ${f.resizeBlock}（CSS UI L4，Chrome 111+）\n` +
        `    resize:inline     = ${f.resizeInline}（CSS UI L4，Chrome 111+）\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  .demo-none       { resize: none;       overflow: auto; }  /* 不可拖拽 */\n` +
        `  .demo-both       { resize: both;       overflow: auto; }  /* 横纵双向 */\n` +
        `  .demo-horizontal { resize: horizontal; overflow: auto; }  /* 仅横向 */\n` +
        `  .demo-vertical   { resize: vertical;   overflow: auto; }  /* 仅纵向 */\n` +
        `  .demo-block      { resize: block;      overflow: auto; }  /* 逻辑块方向 */\n` +
        `  .demo-inline     { resize: inline;     overflow: auto; }  /* 逻辑行方向 */\n` +
        `\n` +
        `  /* 纵排书写模式下逻辑值翻转 */\n` +
        `  .vertical-text {\n` +
        `    writing-mode: vertical-rl;\n` +
        `    resize: inline;  /* 此时 inline = 纵向拖拽 */\n` +
        `    overflow: auto;\n` +
        `  }`;
    } catch (err: any) {
      return `读取 resize 值全集信息失败：${err.name} - ${err.message}`;
    }
  }

  _setResizeMode(mode: any) {
    this._resizeMode = mode;
    this._injectStyle('css-resize-mode-dynamic', `.rs-box { resize: ${mode}; }`);
    this.setState({ valuesInfo: this._readValuesInfo() });
    const desc = ({
      none: '不可拖拽',
      both: '横纵双向',
      horizontal: '仅横向',
      vertical: '仅纵向',
      block: '逻辑块方向（默认 = vertical）',
      inline: '逻辑行方向（默认 = horizontal）',
    } as Record<string, string>)[mode];
    this._addLog('resize', `切换 resize → ${mode}（${desc}）`);
  }

  _renderCard2(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. resize 值全集 —— none|both|horizontal|vertical|block|inline',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['both', f.resizeBoth],
          ['horizontal', f.resizeHorizontal],
          ['vertical', f.resizeVertical],
          ['block', f.resizeBlock],
          ['inline', f.resizeInline],
        ]),
        h(Tag, { color: 'primary' }, '物理值 / 逻辑值'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'resize 取值：none（默认，不可拖拽）/ both（横纵双向）/ horizontal（仅横向）/ vertical（仅纵向）/ block（逻辑块方向）/ inline（逻辑行方向）。物理值 horizontal/vertical 始终相对物理屏幕方向；逻辑值 block/inline 相对书写方向（writing-mode）：horizontal-tb 时 block=vertical、inline=horizontal；vertical-rl/lr 时翻转。block/inline 为 CSS UI L4 逻辑值，Chrome 111+ / Firefox 119+ / Safari 16.4+ 支持。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('none', { size: 'sm', onClick: () => this._setResizeMode('none') }),
          this._btn('both', { type: 'primary', size: 'sm', disabled: !f.resizeBoth, onClick: () => this._setResizeMode('both') }),
          this._btn('horizontal', { size: 'sm', disabled: !f.resizeHorizontal, onClick: () => this._setResizeMode('horizontal') }),
          this._btn('vertical', { size: 'sm', disabled: !f.resizeVertical, onClick: () => this._setResizeMode('vertical') }),
          this._btn('block', { size: 'sm', disabled: !f.resizeBlock, onClick: () => this._setResizeMode('block') }),
          this._btn('inline', { size: 'sm', disabled: !f.resizeInline, onClick: () => this._setResizeMode('inline') }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '可拖拽元素（当前 resize: ' + this._resizeMode + '）：'),
        h('div', { class: 'rs-box' },
          '切换上方按钮观察不同 resize 取值\n当前 resize: ' + this._resizeMode + '\n（jsdom 不渲染手柄，DOM 与样式正确）',
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.valuesInfo || '（点击按钮切换 resize 取值并查看完整说明）')),
        h(Alert, {
          type: 'info',
          message: '逻辑值 block/inline 是 CSS UI L4 新增',
          description: 'block/inline 取值随 writing-mode 翻转：horizontal-tb（默认）时 block=vertical、inline=horizontal；vertical-rl/lr 时翻转。物理值 horizontal/vertical 不随 writing-mode 变化。逻辑值让竖排文字布局的拖拽行为更自然。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 3：与 overflow 协同 ===================

  _readOverflowInfo(): string {
    const f = this._flags();
    try {
      const ov = this.el && this.el.querySelector('.rs-overflow');
      let computedOv = '(未渲染)';
      let computedRz = '(未渲染)';
      if (ov) {
        computedOv = window.getComputedStyle(ov).getPropertyValue('overflow') || '(空)';
        computedRz = window.getComputedStyle(ov).getPropertyValue('resize') || '(空)';
      }
      return `===== CSS resize 与 overflow 协同 =====\n` +
        `\n` +
        `【必备组合】\n` +
        `  resize 必须配合 overflow 非 visible 值才能生效\n` +
        `  即 overflow: visible 时 resize 无效（手柄不显示）\n` +
        `  最常用组合：resize: both; overflow: auto;\n` +
        `\n` +
        `【不同 overflow 值的效果】\n` +
        `  overflow: visible —— resize 无效！手柄不显示，元素不可拖拽\n` +
        `  overflow: hidden  —— resize 有效；内容超出隐藏但仍可拖拽改变尺寸\n` +
        `  overflow: auto    —— resize 有效；内容超出自动出现滚动条（最常用）\n` +
        `  overflow: scroll  —— resize 有效；始终显示滚动条\n` +
        `  overflow: clip    —— resize 有效（CSS Overflow L3，与 hidden 类似但不可滚动）\n` +
        `  overflow-x / overflow-y —— 任一方向非 visible 即可触发 resize\n` +
        `\n` +
        `【overflow: visible 失效原理】\n` +
        `  浏览器在 overflow: visible 时不创建滚动容器，无溢出边界\n` +
        `  resize 手柄依赖滚动容器右下角作为视觉锚点\n` +
        `  因此 overflow: visible 时手柄无处附着，resize 无效\n` +
        `\n` +
        `【overflow: hidden 仍可 resize 的原因】\n` +
        `  overflow: hidden 创建了 BFC + 滚动容器（只是滚动条隐藏）\n` +
        `  resize 手柄附着在隐藏的滚动容器右下角，仍可拖拽\n` +
        `  拖拽后元素尺寸变化，超出部分仍被 hidden 裁剪\n` +
        `\n` +
        `【当前演示元素】\n` +
        `  .rs-overflow { resize: both; overflow: ${this._overflowMode}; }\n` +
        `    overflow 计算值="${computedOv}"\n` +
        `    resize 计算值="${computedRz}"\n` +
        `  CSS.supports('resize','both') = ${f.resizeBoth}\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  /* 必备组合：resize + overflow: auto */\n` +
        `  .resizable-auto {\n` +
        `    resize: both;\n` +
        `    overflow: auto;       /* 最常用，内容超出自动滚动 */\n` +
        `    width: 200px;\n` +
        `    height: 100px;\n` +
        `  }\n` +
        `\n` +
        `  /* overflow: hidden 仍可 resize */\n` +
        `  .resizable-hidden {\n` +
        `    resize: both;\n` +
        `    overflow: hidden;     /* 内容裁剪但可拖拽 */\n` +
        `    width: 200px;\n` +
        `    height: 100px;\n` +
        `  }\n` +
        `\n` +
        `  /* overflow: visible 时 resize 无效！*/\n` +
        `  .resizable-visible-invalid {\n` +
        `    resize: both;\n` +
        `    overflow: visible;    /* ⚠ resize 不生效，手柄不显示 */\n` +
        `    width: 200px;\n` +
        `    height: 100px;\n` +
        `  }\n` +
        `\n` +
        `  /* 分轴 overflow：任一非 visible 即可 */\n` +
        `  .resizable-x-hidden {\n` +
        `    resize: horizontal;   /* 仅横向拖拽 */\n` +
        `    overflow-x: hidden;   /* 横向裁剪 */\n` +
        `    overflow-y: auto;     /* 纵向滚动 */\n` +
        `    width: 200px;\n` +
        `    height: 100px;\n` +
        `  }`;
    } catch (err: any) {
      return `读取 overflow 协同信息失败：${err.name} - ${err.message}`;
    }
  }

  _setOverflowMode(mode: any) {
    this._overflowMode = mode;
    this._injectStyle('css-resize-overflow-dynamic', `.rs-overflow { overflow: ${mode}; }`);
    this.setState({ overflowInfo: this._readOverflowInfo() });
    const desc = ({
      visible: '⚠ resize 无效！手柄不显示',
      hidden: '内容裁剪但可拖拽',
      auto: '内容超出自动滚动（最常用）',
      scroll: '始终显示滚动条',
      clip: 'CSS Overflow L3，不可滚动但可拖拽',
    } as Record<string, string>)[mode];
    this._addLog('resize', `切换 overflow → ${mode}（${desc}）`);
  }

  _renderCard3(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. 与 overflow 协同 —— resize: both; overflow: auto; 必备组合',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['resize:both', f.resizeBoth]]),
        h(Tag, { color: 'warning' }, 'overflow 非 visible'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'resize 必须配合 overflow 非 visible 值才能生效：overflow: visible 时手柄不显示、resize 无效；overflow: hidden/auto/scroll/clip 均可触发 resize。最常用组合 resize: both; overflow: auto;（内容超出自动滚动）。overflow: hidden 仍可 resize（创建 BFC + 隐藏滚动容器，手柄附着其上）。分轴 overflow-x/overflow-y 任一非 visible 即可触发对应方向 resize。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('visible', { size: 'sm', danger: true, onClick: () => this._setOverflowMode('visible') }),
          this._btn('hidden', { size: 'sm', onClick: () => this._setOverflowMode('hidden') }),
          this._btn('auto', { type: 'primary', size: 'sm', onClick: () => this._setOverflowMode('auto') }),
          this._btn('scroll', { size: 'sm', onClick: () => this._setOverflowMode('scroll') }),
          this._btn('clip', { size: 'sm', onClick: () => this._setOverflowMode('clip') }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '可拖拽元素（当前 overflow: ' + this._overflowMode + '）：'),
        h('div', { class: 'rs-overflow' },
          '切换上方按钮观察不同 overflow 取值\n当前 overflow: ' + this._overflowMode + '\nresize: both（visible 时手柄不显示）\n\n这段内容较长用于触发滚动条测试：CSS Resize 与 overflow 必须协同工作，overflow: visible 时 resize 无效，overflow: hidden 仍可 resize。',
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.overflowInfo || '（点击按钮切换 overflow 取值并查看协同说明）')),
        h(Alert, {
          type: 'warning',
          message: 'overflow: visible 时 resize 完全无效',
          description: '浏览器在 overflow: visible 时不创建滚动容器，resize 手柄无视觉锚点附着。必备组合 resize: both; overflow: auto;。overflow: hidden 仍可 resize（隐藏滚动容器仍存在，手柄附着其右下角）。overflow: clip（CSS Overflow L3）也可 resize 但不可滚动。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 4：min/max-width/height 约束 ===================

  _readConstraintsInfo(): string {
    const f = this._flags();
    try {
      const c = this.el && this.el.querySelector('.rs-constrained');
      let computed = { minW: '(未渲染)', maxW: '(未渲染)', minH: '(未渲染)', maxH: '(未渲染)' };
      if (c) {
        const cs = window.getComputedStyle(c);
        computed = {
          minW: cs.getPropertyValue('min-width') || '(空)',
          maxW: cs.getPropertyValue('max-width') || '(空)',
          minH: cs.getPropertyValue('min-height') || '(空)',
          maxH: cs.getPropertyValue('max-height') || '(空)',
        };
      }
      return `===== CSS resize 与 min/max-width/height 约束 =====\n` +
        `\n` +
        `【约束原理】\n` +
        `  resize 拖拽改变的是元素的 width/height（inline style 设置）\n` +
        `  但 min-width/max-width/min-height/max-height 仍生效\n` +
        `  即拖拽不会突破 min/max 边界，防止元素被拖出布局\n` +
        `\n` +
        `【约束规则】\n` +
        `  width < min-width   → 实际渲染宽度 = min-width（拖拽不下去）\n` +
        `  width > max-width   → 实际渲染宽度 = max-width（拖拽不上去）\n` +
        `  height < min-height → 实际渲染高度 = min-height\n` +
        `  height > max-height → 实际渲染高度 = max-height\n` +
        `  优先级：min-width > max-width > width（CSS 规范）\n` +
        `\n` +
        `【当前演示元素】\n` +
        `  .rs-constrained {\n` +
        `    resize: both;\n` +
        `    overflow: auto;\n` +
        `    width: 200px;\n` +
        `    height: 100px;\n` +
        `    min-width: 100px;     /* 计算值="${computed.minW}" */\n` +
        `    max-width: 500px;     /* 计算值="${computed.maxW}" */\n` +
        `    min-height: 80px;     /* 计算值="${computed.minH}" */\n` +
        `    max-height: 400px;    /* 计算值="${computed.maxH}" */\n` +
        `  }\n` +
        `  CSS.supports('resize','both') = ${f.resizeBoth}\n` +
        `\n` +
        `【实际拖拽范围】\n` +
        `  宽度范围：100px（min-width） ≤ width ≤ 500px（max-width）\n` +
        `  高度范围：80px（min-height） ≤ height ≤ 400px（max-height）\n` +
        `  拖拽超出范围时，浏览器自动钳制到边界值\n` +
        `\n` +
        `【防止拖出布局的最佳实践】\n` +
        `  1. 始终设置 min-width/min-height（防止拖到 0 不可见）\n` +
        `  2. 设置 max-width/max-height（防止拖出父容器破坏布局）\n` +
        `  3. 父容器使用 flex/grid 时，子元素 resize 需配 flex-shrink: 0\n` +
        `  4. min/max 用相对单位（如 %、vw、vh）响应式适配\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  .resizable-panel {\n` +
        `    resize: both;\n` +
        `    overflow: auto;\n` +
        `    min-width: 100px;\n` +
        `    max-width: 500px;\n` +
        `    min-height: 80px;\n` +
        `    max-height: 400px;\n` +
        `    width: 200px;\n` +
        `    height: 100px;\n` +
        `    padding: 10px;\n` +
        `    border: 2px solid #10b981;\n` +
        `    background: #dcfce7;\n` +
        `  }\n` +
        `\n` +
        `  /* 父容器约束 + 子元素 resize */\n` +
        `  .parent {\n` +
        `    display: flex;\n` +
        `    gap: 12px;\n` +
        `    max-width: 800px;       /* 父容器最大宽度 */\n` +
        `  }\n` +
        `  .child-resizable {\n` +
        `    resize: horizontal;\n` +
        `    overflow: auto;\n` +
        `    min-width: 100px;\n` +
        `    max-width: 50%;         /* 不超过父容器一半 */\n` +
        `    flex-shrink: 0;         /* 防止 flex 压缩 */\n` +
        `  }\n` +
        `\n` +
        `【约束优先级陷阱】\n` +
        `  min-width 优先级高于 max-width：\n` +
        `    若 min-width: 300px; max-width: 200px; 实际渲染 = 300px\n` +
        `  因为 CSS 规范规定 min-width 优先，max-width 被钳制到 min-width\n` +
        `  resize 拖拽也受此规则约束：拖到 200px 时仍显示 300px`;
    } catch (err: any) {
      return `读取 min/max 约束信息失败：${err.name} - ${err.message}`;
    }
  }

  _runConstraintsDemo(): void {
    this.setState({ constraintsInfo: this._readConstraintsInfo() });
    this._addLog('resize', `min/max 约束演示：100-500px × 80-400px，支持 both=${this._flags().resizeBoth}`);
  }

  _renderCard4(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. min/max-width/height 约束 —— resize 范围限制',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['resize:both', f.resizeBoth]]),
        h(Tag, { color: 'success' }, '✓ 防拖出布局'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'resize 拖拽改变元素 width/height（inline style），但 min-width/max-width/min-height/max-height 仍生效，拖拽不会突破边界。约束规则：min-width > max-width > width（优先级），拖拽超出范围自动钳制到边界值。最佳实践：始终设置 min-width/min-height（防拖到 0 不可见）+ max-width/max-height（防拖出父容器破坏布局）；flex/grid 子元素需配 flex-shrink: 0；min/max 用相对单位响应式适配。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 min/max 约束演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runConstraintsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '可拖拽元素（拖拽范围 100-500px × 80-400px）：'),
        h('div', { class: 'rs-constrained' },
          '拖拽右下角手柄\nmin-width: 100px / max-width: 500px\nmin-height: 80px / max-height: 400px\n（拖拽不会突破 min/max 边界）',
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.constraintsInfo || '（点击按钮查看 min/max 约束完整说明）')),
        h(Alert, {
          type: 'info',
          message: 'min-width 优先级高于 max-width',
          description: 'CSS 规范规定 min-width > max-width > width。若 min-width: 300px; max-width: 200px;，实际渲染 300px（max-width 被钳制）。resize 拖拽也受此规则约束。最佳实践：min-width 防拖到 0，max-width 防拖出父容器。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 5：逻辑值 block/inline ===================

  _readLogicalInfo(): string {
    const f = this._flags();
    try {
      const lg = this.el && this.el.querySelector('.rs-logical');
      let computedRz = '(未渲染)';
      let computedWm = '(未渲染)';
      if (lg) {
        computedRz = window.getComputedStyle(lg).getPropertyValue('resize') || '(空)';
        computedWm = window.getComputedStyle(lg).getPropertyValue('writing-mode') || '(空)';
      }
      return `===== CSS resize 逻辑值 block/inline =====\n` +
        `\n` +
        `【逻辑值定义】\n` +
        `  resize: block  —— 沿 block 方向（块流动方向）拖拽\n` +
        `  resize: inline —— 沿 inline 方向（行内流动方向）拖拽\n` +
        `  两者均为 CSS UI Module Level 4 新增逻辑值\n` +
        `  随 writing-mode 自适应翻转，更符合多语言排版\n` +
        `\n` +
        `【writing-mode 适配表】\n` +
        `  writing-mode            | block 等价 | inline 等价\n` +
        `  ------------------------|------------|------------\n` +
        `  horizontal-tb（默认）   | vertical   | horizontal\n` +
        `  vertical-rl             | horizontal | vertical\n` +
        `  vertical-lr             | horizontal | vertical\n` +
        `\n` +
        `【默认 horizontal-tb 时】\n` +
        `  resize: block  ≡ resize: vertical（纵向拖拽，仅改 height）\n` +
        `  resize: inline ≡ resize: horizontal（横向拖拽，仅改 width）\n` +
        `\n` +
        `【vertical-rl 时（如古中文竖排）】\n` +
        `  resize: block  ≡ resize: horizontal（横向拖拽，仅改 width）\n` +
        `  resize: inline ≡ resize: vertical（纵向拖拽，仅改 height）\n` +
        `  即逻辑值随书写方向翻转，物理值不变\n` +
        `\n` +
        `【当前演示元素】\n` +
        `  .rs-logical { resize: ${this._logicalMode}; writing-mode: ${this._writingMode}; overflow: auto; }\n` +
        `    resize 计算值="${computedRz}"\n` +
        `    writing-mode 计算值="${computedWm}"\n` +
        `  CSS.supports('resize','block') = ${f.resizeBlock}\n` +
        `  CSS.supports('resize','inline') = ${f.resizeInline}\n` +
        `\n` +
        `【浏览器支持】\n` +
        `  resize: block / inline —— Chrome 111+ / Edge 111+ / Firefox 119+ / Safari 16.4+\n` +
        `  较新特性，老浏览器（Chrome < 111, Firefox < 119）不支持，回退为 none\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  /* 默认横排：inline = 横向 */\n` +
        `  .horizontal-text {\n` +
        `    writing-mode: horizontal-tb;\n` +
        `    resize: inline;       /* 等价 horizontal */\n` +
        `    overflow: auto;\n` +
        `    width: 200px;\n` +
        `    height: 100px;\n` +
        `  }\n` +
        `\n` +
        `  /* 竖排古中文：inline = 纵向（翻转）*/\n` +
        `  .vertical-rl-text {\n` +
        `    writing-mode: vertical-rl;\n` +
        `    resize: inline;       /* 等价 vertical（翻转！）*/\n` +
        `    overflow: auto;\n` +
        `    width: 100px;\n` +
        `    height: 200px;\n` +
        `  }\n` +
        `\n` +
        `  /* 块方向拖拽：默认 = 纵向 */\n` +
        `  .block-resize {\n` +
        `    writing-mode: horizontal-tb;\n` +
        `    resize: block;        /* 等价 vertical */\n` +
        `    overflow: auto;\n` +
        `  }\n` +
        `\n` +
        `【为何需要逻辑值】\n` +
        `  物理值 horizontal/vertical 在竖排文字下行为不变（永远横向/纵向）\n` +
        `  但用户在竖排布局中期望「行方向拖拽」对应行内方向\n` +
        `  逻辑值 block/inline 让拖拽行为与书写方向一致，更自然\n` +
        `  类似 inline-start/inline-end 等逻辑属性的设计理念`;
    } catch (err: any) {
      return `读取逻辑值信息失败：${err.name} - ${err.message}`;
    }
  }

  _setLogicalMode(mode: any) {
    this._logicalMode = mode;
    this._injectStyle('css-resize-logical-dynamic',
      `.rs-logical { resize: ${mode}; writing-mode: ${this._writingMode}; }`);
    this.setState({ logicalInfo: this._readLogicalInfo() });
    this._addLog('resize', `切换 resize 逻辑值 → ${mode}（writing-mode: ${this._writingMode}）`);
  }

  _setWritingMode(mode: any) {
    this._writingMode = mode;
    this._injectStyle('css-resize-wm-dynamic',
      `.rs-logical { resize: ${this._logicalMode}; writing-mode: ${mode}; }`);
    this.setState({ logicalInfo: this._readLogicalInfo() });
    this._addLog('resize', `切换 writing-mode → ${mode}（resize: ${this._logicalMode} 逻辑值随书写方向翻转）`);
  }

  _renderCard5(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. 逻辑值 block/inline —— writing-mode 适配（Chrome 111+）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['resize:block', f.resizeBlock], ['resize:inline', f.resizeInline]]),
        h(Tag, { color: 'primary' }, 'CSS UI L4 逻辑值'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'resize: block/inline 是 CSS UI L4 逻辑值，随 writing-mode 自适应翻转。默认 horizontal-tb 时 block=vertical、inline=horizontal；vertical-rl/lr 时翻转（block=horizontal、inline=vertical）。逻辑值让竖排古中文/日文布局的拖拽行为与书写方向一致，更自然。浏览器支持：Chrome 111+ / Edge 111+ / Firefox 119+ / Safari 16.4+，老浏览器回退为 none。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('resize: block', { type: 'primary', size: 'sm', disabled: !f.resizeBlock, onClick: () => this._setLogicalMode('block') }),
          this._btn('resize: inline', { size: 'sm', disabled: !f.resizeInline, onClick: () => this._setLogicalMode('inline') }),
          this._btn('horizontal-tb', { size: 'sm', onClick: () => this._setWritingMode('horizontal-tb') }),
          this._btn('vertical-rl', { size: 'sm', onClick: () => this._setWritingMode('vertical-rl') }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' },
          '当前 resize: ' + this._logicalMode + ' / writing-mode: ' + this._writingMode + '：'),
        h('div', { class: 'rs-logical' },
          '切换 resize 逻辑值与 writing-mode\n当前 resize: ' + this._logicalMode + '\nwriting-mode: ' + this._writingMode + '\n（竖排时逻辑值翻转，物理值不变）',
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.logicalInfo || '（点击按钮切换 resize 逻辑值 / writing-mode 查看说明）')),
        h(Alert, {
          type: 'warning',
          message: 'block/inline 是 CSS UI L4 较新逻辑值，老浏览器不支持',
          description: 'Chrome 111+ / Firefox 119+ / Safari 16.4+ 支持。老浏览器（Chrome < 111）回退为 none（不可拖拽）。需要兼容老浏览器时使用物理值 horizontal/vertical（但不随 writing-mode 翻转）。逻辑值设计理念同 inline-start/inline-end 等逻辑属性。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 6：::-webkit-resizer 伪元素 ===================

  _readResizerInfo(): string {
    const f = this._flags();
    try {
      const rs = this.el && this.el.querySelector('.rs-resizer');
      let computed = '(未渲染)';
      if (rs) {
        computed = window.getComputedStyle(rs).getPropertyValue('resize') || '(空)';
      }
      return `===== CSS ::-webkit-resizer 伪元素 =====\n` +
        `\n` +
        `【规范归属】\n` +
        `  ::-webkit-resizer 是 Webkit/Blink 私有伪元素（非标准）\n` +
        `  用于样式化滚动容器右下角的 resize 手柄\n` +
        `  仅 Chrome / Safari / Edge 等 Webkit/Blink 系浏览器支持\n` +
        `  Firefox（Gecko）不支持，无对应伪元素\n` +
        `\n` +
        `【基本用法】\n` +
        `  .resizable::-webkit-resizer {\n` +
        `    /* 自定义 resize 手柄样式 */\n` +
        `    background: transparent;        /* 透明背景 */\n` +
        `    background-color: #ef4444;      /* 自定义颜色 */\n` +
        `  }\n` +
        `\n` +
        `【隐藏 resize 手柄】\n` +
        `  .resizable-hidden::-webkit-resizer {\n` +
        `    display: none;                  /* 隐藏手柄（但 resize 仍可用）*/\n` +
        `  }\n` +
        `  ⚠ 注意：display: none 仅隐藏手柄视觉，resize 拖拽功能仍保留\n` +
        `    （手柄区域仍可点击拖拽，只是看不见）\n` +
        `\n` +
        `【自定义手柄样式】\n` +
        `  .resizable-custom::-webkit-resizer {\n` +
        `    background: linear-gradient(135deg, #ef4444 50%, transparent 50%);\n` +
        `    background-color: #fef3c7;\n` +
        `  }\n` +
        `  可设置 background / background-color / border 等\n` +
        `\n` +
        `【当前演示元素】\n` +
        `  .rs-resizer { resize: both; overflow: auto; }\n` +
        `  ${this._resizerHidden ? '  ::-webkit-resizer { display: none; }  /* 手柄隐藏 */\n' : ''}` +
        `  ${this._resizerCustom ? '  ::-webkit-resizer { background: linear-gradient(...); }  /* 自定义 */\n' : ''}` +
        `    resize 计算值="${computed}"\n` +
        `  CSS.supports('resize','both') = ${f.resizeBoth}\n` +
        `\n` +
        `【与 resize 协同】\n` +
        `  ::-webkit-resizer 仅对设置了 resize 非 none 且 overflow 非 visible 的元素生效\n` +
        `  即必须先有 resize: both/horizontal/vertical/block/inline + overflow: auto/hidden\n` +
        `  再用 ::-webkit-resizer 样式化手柄\n` +
        `\n` +
        `【跨浏览器兼容方案】\n` +
        `  Firefox 无 ::-webkit-resizer，需 JS 检测或接受默认手柄\n` +
        `  方案 1：UA 检测，仅 Webkit/Blink 应用自定义样式\n` +
        `  方案 2：用 JS 拖拽库（如 interact.js）跨浏览器自定义\n` +
        `  方案 3：接受默认手柄，仅用 resize 属性\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  /* 隐藏手柄（resize 仍可用）*/\n` +
        `  .resizable-hidden-handle {\n` +
        `    resize: both;\n` +
        `    overflow: auto;\n` +
        `  }\n` +
        `  .resizable-hidden-handle::-webkit-resizer {\n` +
        `    display: none;\n` +
        `  }\n` +
        `\n` +
        `  /* 自定义手柄（三角形渐变）*/\n` +
        `  .resizable-custom-handle {\n` +
        `    resize: both;\n` +
        `    overflow: auto;\n` +
        `  }\n` +
        `  .resizable-custom-handle::-webkit-resizer {\n` +
        `    background: linear-gradient(135deg, #ef4444 50%, transparent 50%);\n` +
        `    background-color: #fef3c7;\n` +
        `  }\n` +
        `\n` +
        `【⚠ 非标准警示】\n` +
        `  ::-webkit-resizer 是 Webkit 私有，非 W3C 标准\n` +
        `  生产环境慎用，Firefox 不支持\n` +
        `  长期方案应使用 CSS UI L4 的 resize-handle 等标准属性（仍在草案）`;
    } catch (err: any) {
      return `读取 ::-webkit-resizer 信息失败：${err.name} - ${err.message}`;
    }
  }

  _toggleResizerHidden(): void {
    this._resizerHidden = !this._resizerHidden;
    const el = this.el && this.el.querySelector('.rs-resizer');
    if (el) {
      el.classList.toggle('rs-hidden-handle', this._resizerHidden);
    }
    this.setState({ resizerInfo: this._readResizerInfo() });
    this._addLog('resize', `::-webkit-resizer display: ${this._resizerHidden ? 'none（隐藏手柄，resize 仍可用）' : 'default（显示手柄）'}`);
  }

  _toggleResizerCustom(): void {
    this._resizerCustom = !this._resizerCustom;
    const el = this.el && this.el.querySelector('.rs-resizer');
    if (el) {
      el.classList.toggle('rs-custom-handle', this._resizerCustom);
    }
    this.setState({ resizerInfo: this._readResizerInfo() });
    this._addLog('resize', `::-webkit-resizer 自定义样式: ${this._resizerCustom ? '开启（三角形渐变）' : '关闭（默认手柄）'}`);
  }

  _renderCard6(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. ::-webkit-resizer 伪元素 —— 隐藏/自定义 resize 手柄',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['::-webkit-resizer', f.webkitResizer], ['resize:both', f.resizeBoth]]),
        h(Tag, { color: 'warning' }, 'Webkit 私有'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '::-webkit-resizer 是 Webkit/Blink 私有伪元素（非标准），用于样式化滚动容器右下角的 resize 手柄。仅 Chrome/Safari/Edge 支持，Firefox 不支持。可隐藏手柄（display: none，但 resize 仍可用）或自定义手柄样式（background/background-color 等）。必须配合 resize 非 none + overflow 非 visible 才生效。跨浏览器兼容需 JS 检测或用 JS 拖拽库。长期方案应使用 CSS UI L4 标准属性（仍在草案）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn(`隐藏手柄（${this._resizerHidden ? '已隐藏' : '显示中'}）`, { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._toggleResizerHidden() }),
          this._btn(`自定义手柄（${this._resizerCustom ? '已开启' : '默认'}）`, { size: 'sm', disabled: !f.css, onClick: () => this._toggleResizerCustom() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '可拖拽元素（仅 Webkit/Blink 浏览器可见手柄变化）：'),
        h('div', { class: 'rs-resizer' },
          '拖拽右下角手柄\n::-webkit-resizer 当前：\n  hidden = ' + (this._resizerHidden ? '是' : '否') + '\n  custom = ' + (this._resizerCustom ? '是' : '否') + '\n（Firefox 不支持该伪元素）',
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.resizerInfo || '（点击按钮切换 ::-webkit-resizer 样式查看说明）')),
        h(Alert, {
          type: 'warning',
          message: '::-webkit-resizer 是 Webkit 私有，Firefox 不支持',
          description: '非 W3C 标准，仅 Chrome/Safari/Edge 等 Webkit/Blink 系浏览器支持。display: none 仅隐藏手柄视觉，resize 拖拽功能仍保留（手柄区域仍可点击）。跨浏览器自定义手柄需用 JS 拖拽库（如 interact.js）。长期方案应使用 CSS UI L4 标准属性（仍在草案）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 7：实战场景 ===================

  _readPatternsInfo(): string {
    const f = this._flags();
    try {
      return `===== CSS resize 实战场景 =====\n` +
        `\n` +
        `【场景 1：IDE 多面板布局】\n` +
        `  VSCode 风格：左侧文件树（resize: horizontal）+ 中间编辑器 + 底部终端（resize: vertical）\n` +
        `  各面板可独立拖拽调整尺寸，min/max 约束防止拖出布局\n` +
        `  代码：\n` +
        `    .ide-layout { display: flex; flex-direction: column; height: 100vh; }\n` +
        `    .ide-top { display: flex; flex: 1; overflow: hidden; }\n` +
        `    .ide-sidebar {\n` +
        `      resize: horizontal; overflow: auto;\n` +
        `      width: 200px; min-width: 120px; max-width: 400px;\n` +
        `      flex-shrink: 0;             /* 防 flex 压缩 */\n` +
        `    }\n` +
        `    .ide-editor { flex: 1; overflow: auto; }\n` +
        `    .ide-terminal {\n` +
        `      resize: vertical; overflow: auto;\n` +
        `      height: 120px; min-height: 40px; max-height: 60vh;\n` +
        `      flex-shrink: 0;\n` +
        `    }\n` +
        `\n` +
        `【场景 2：表格列宽调整】\n` +
        `  th 设置 resize: horizontal，用户可拖拽列宽\n` +
        `  ⚠ 原生 resize 在 th 上行为不稳定，通常用 JS 拖拽库（如 react-resizable）\n` +
        `  代码：\n` +
        `    th.resizable {\n` +
        `      resize: horizontal; overflow: hidden;\n` +
        `      min-width: 80px; max-width: 300px;\n` +
        `      position: relative;\n` +
        `    }\n` +
        `    /* 配合 JS 拖拽手柄更可控 */\n` +
        `    th .col-resizer {\n` +
        `      position: absolute; right: 0; top: 0; bottom: 0;\n` +
        `      width: 4px; cursor: col-resize;\n` +
        `      background: #cbd5e1;\n` +
        `    }\n` +
        `\n` +
        `【场景 3：调试器面板】\n` +
        `  Chrome DevTools 风格：左右分栏可拖拽\n` +
        `  代码：\n` +
        `    .devtools-split { display: flex; height: 100%; }\n` +
        `    .devtools-left {\n` +
        `      resize: horizontal; overflow: auto;\n` +
        `      width: 300px; min-width: 150px; max-width: 70%;\n` +
        `    }\n` +
        `    .devtools-right { flex: 1; overflow: auto; }\n` +
        `\n` +
        `【场景 4：文本输入框自适应】\n` +
        `  textarea 默认 resize: both，可限制为 vertical（仅纵向）\n` +
        `  防止横向拖拽破坏表单布局\n` +
        `  代码：\n` +
        `    textarea {\n` +
        `      resize: vertical;             /* 仅纵向，防横向破坏布局 */\n` +
        `      min-height: 80px; max-height: 400px;\n` +
        `      width: 100%; box-sizing: border-box;\n` +
        `    }\n` +
        `    textarea.disabled-resize { resize: none; }  /* 完全禁用 */\n` +
        `\n` +
        `【场景 5：与 JS 拖拽库对比】\n` +
        `  原生 resize 优点：\n` +
        `    ✓ 零依赖，浏览器原生支持\n` +
        `    ✓ 性能更好（无 JS 开销）\n` +
        `    ✓ 自动处理触摸/鼠标/键盘（部分）\n` +
        `    ✓ ResizeObserver 可监听尺寸变化\n` +
        `  原生 resize 缺点：\n` +
        `    ✗ 仅右下角手柄（JS 库可任意位置）\n` +
        `    ✗ 移动端触摸支持差（部分浏览器不支持）\n` +
        `    ✗ 无键盘等价（无障碍差）\n` +
        `    ✗ 手柄样式仅 ::-webkit-resizer 有限定制（且 Firefox 不支持）\n` +
        `  JS 库（interact.js / jQuery UI resizable / react-resizable）：\n` +
        `    ✓ 任意位置手柄（上下左右、四角）\n` +
        `    ✓ 完整触摸/键盘支持\n` +
        `    ✓ 自定义视觉反馈\n` +
        `    ✗ 依赖 JS 库，性能开销\n` +
        `    ✗ 实现复杂\n` +
        `\n` +
        `【选型建议】\n` +
        `  简单场景（textarea、单面板）→ 原生 resize\n` +
        `  复杂场景（多面板联动、列宽网格、触摸优先）→ JS 拖拽库\n` +
        `  混合方案：原生 resize + ResizeObserver 监听 + JS 增强\n` +
        `\n` +
        `  CSS.supports('resize','both') = ${f.resizeBoth}\n` +
        `  ResizeObserver 可用 = ${f.resizeObserver}`;
    } catch (err: any) {
      return `读取实战场景信息失败：${err.name} - ${err.message}`;
    }
  }

  _runPatternsDemo(): void {
    this.setState({ patternsInfo: this._readPatternsInfo() });
    this._addLog('resize', `实战场景演示完成；IDE 多面板 + 表格列宽 + 调试器 + textarea；ResizeObserver=${this._flags().resizeObserver}`);
  }

  _renderCard7(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. 实战场景 —— IDE 多面板 / 表格列宽 / 调试器 / textarea / JS 库对比',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['resize:both', f.resizeBoth], ['ResizeObserver', f.resizeObserver]]),
        h(Tag, { color: 'primary' }, '5 大场景'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '五大实战场景：IDE 多面板布局（sidebar resize: horizontal + terminal resize: vertical + flex-shrink: 0 防压缩）、表格列宽调整（th resize: horizontal，通常配合 JS 拖拽手柄更可控）、调试器面板（左右分栏可拖拽）、textarea 自适应（默认 both，限制为 vertical 防横向破坏布局）、与 JS 拖拽库对比（interact.js/jQuery UI/react-resizable 任意位置手柄 + 完整触摸/键盘支持）。选型建议：简单场景用原生 resize，复杂场景用 JS 库，混合方案原生 resize + ResizeObserver + JS 增强。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行实战场景演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runPatternsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'IDE 多面板布局演示（侧栏 resize: horizontal，底部 resize: vertical）：'),
        h('div', { class: 'rs-ide' },
          h('div', { class: 'rs-ide-sidebar' },
            '文件树\n  src/\n    pages/\n    components/\n  package.json\n\n← 拖右边界调整宽度 →',
          ),
          h('div', { class: 'rs-ide-main' },
            '// 编辑器主区域\nimport { Page } from \'../../core/Component.js\';\n\nclass Demo extends Page {\n  renderPage(): Node | string | (Node | string)[] {\n    return h(\'div\', {}, \'Hello\');\n  }\n}',
          ),
        ),
        h('div', { class: 'rs-ide-bottom-wrap' },
          h('div', { class: 'rs-ide-bottom' },
            '$ npm run build\n> building...\n✓ built in 1.23s\n\n↑ 拖上边界调整高度 ↓',
          ),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'textarea 自适应演示（resize: vertical 防横向破坏布局）：'),
        h('textarea', {
          class: 'rs-textarea',
          placeholder: '默认 resize: vertical，仅可纵向拖拽（防横向破坏表单布局）',
          rows: 3,
        }, ''),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.patternsInfo || '（点击按钮查看 5 大实战场景完整代码与对比）')),
        h(Alert, {
          type: 'info',
          message: '原生 resize 性能好但触摸/键盘支持差，复杂场景用 JS 库',
          description: '原生 resize 优点：零依赖、性能好、自动处理触摸/鼠标。缺点：仅右下角手柄、移动端触摸支持差、无键盘等价（无障碍差）、手柄定制有限。JS 库（interact.js/react-resizable）任意位置手柄 + 完整触摸/键盘 + 自定义视觉反馈，但依赖 JS。混合方案：原生 resize + ResizeObserver 监听 + JS 增强。',
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
      const ta = this.el && this.el.querySelector('.rs-textarea');
      let computedTa = '(未渲染)';
      if (ta) {
        computedTa = window.getComputedStyle(ta).getPropertyValue('resize') || '(空)';
      }
      return `===== CSS resize 陷阱与最佳实践 =====\n` +
        `\n` +
        `【陷阱 1：textarea 默认 resize: both】\n` +
        `  textarea 元素 UA 默认 stylesheet 设置 resize: both\n` +
        `  即默认可横纵双向拖拽，会破坏表单布局\n` +
        `  解决：显式 resize: vertical（仅纵向）或 resize: none（禁用）\n` +
        `  当前 .rs-textarea resize 计算值="${computedTa}"\n` +
        `  最佳实践：\n` +
        `    textarea { resize: vertical; min-height: 80px; max-height: 400px; }\n` +
        `\n` +
        `【陷阱 2：移动端触摸支持差】\n` +
        `  原生 resize 在移动端浏览器支持不一致：\n` +
        `    iOS Safari：部分版本不支持触摸拖拽（仅桌面端鼠标）\n` +
        `    Android Chrome：支持但手柄小，难触摸\n` +
        `  解决：移动端用 JS 拖拽库（如 react-draggable）或增强触摸事件\n` +
        `  检测：\n` +
        `    if (matchMedia('(pointer: coarse)').matches) {\n` +
        `      // 触摸设备，用 JS 拖拽库替代原生 resize\n` +
        `    }\n` +
        `\n` +
        `【陷阱 3：与 flexbox/grid 项目冲突】\n` +
        `  flex 子元素 resize 时，flex 算法可能覆盖拖拽尺寸\n` +
        `  原因：flex-shrink 默认 1，子元素会被压缩\n` +
        `  解决：flex-shrink: 0 防止压缩\n` +
        `  代码：\n` +
        `    .flex-resizable {\n` +
        `      resize: horizontal; overflow: auto;\n` +
        `      flex-shrink: 0;          /* 关键：防 flex 压缩 */\n` +
        `      min-width: 100px; max-width: 400px;\n` +
        `    }\n` +
        `  grid 项目类似：用 min-content/max-content 配合 minmax()\n` +
        `\n` +
        `【陷阱 4：ResizeObserver 监听拖拽尺寸】\n` +
        `  原生 resize 拖拽不触发 window resize 事件\n` +
        `  需用 ResizeObserver 监听元素尺寸变化\n` +
        `  代码：\n` +
        `    const ro = new ResizeObserver((entries) => {\n` +
        `      for (const entry of entries) {\n` +
        `        const { width, height } = entry.contentRect;\n` +
        `        console.log('元素尺寸变化：', width, height);\n` +
        `        // 可持久化到 localStorage 记住用户偏好\n` +
        `      }\n` +
        `    });\n` +
        `    ro.observe(document.querySelector('.resizable'));\n` +
        `  ⚠ 性能：ResizeObserver 回调在微任务执行，避免重布局\n` +
        `  ⚠ 内存：组件卸载时 ro.disconnect() 释放\n` +
        `  ResizeObserver 可用 = ${f.resizeObserver}\n` +
        `\n` +
        `【陷阱 5：无障碍键盘等价缺失】\n` +
        `  原生 resize 手柄仅鼠标/触摸可拖拽，键盘用户无法调整尺寸\n` +
        `  无 WCAG 键盘等价 API\n` +
        `  解决方案：\n` +
        `    1. 提供尺寸输入框（width/height number input）作为键盘等价\n` +
        `    2. 用 JS 库实现键盘拖拽（方向键调整尺寸）\n` +
        `    3. 提供「重置尺寸」「预设尺寸」按钮\n` +
        `  代码：\n` +
        `    <div class="resizable" tabindex="0"\n` +
        `         role="separator" aria-orientation="vertical"\n` +
        `         aria-valuenow="200" aria-valuemin="100" aria-valuemax="500"\n` +
        `         @keydown="onKeyResize">\n` +
        `      内容\n` +
        `    </div>\n` +
        `    onKeyResize(e) {\n` +
        `      const step = 10;\n` +
        `      if (e.key === 'ArrowLeft')  this.width -= step;\n` +
        `      if (e.key === 'ArrowRight') this.width += step;\n` +
        `    }\n` +
        `\n` +
        `【最佳实践清单】\n` +
        `  ✓ 始终设置 min-width/min-height + max-width/max-height\n` +
        `  ✓ textarea 默认设 resize: vertical 防横向破坏布局\n` +
        `  ✓ flex/grid 子元素加 flex-shrink: 0 防压缩\n` +
        `  ✓ ResizeObserver 监听尺寸变化，可持久化用户偏好\n` +
        `  ✓ 组件卸载时 ro.disconnect() 释放 ResizeObserver\n` +
        `  ✓ 移动端用 JS 拖拽库替代原生 resize（触摸支持差）\n` +
        `  ✓ 提供键盘等价（尺寸输入框 / 方向键）满足无障碍\n` +
        `  ✓ overflow 必须非 visible（必备组合 resize + overflow: auto）\n` +
        `  ✓ ::-webkit-resizer 跨浏览器兼容需 JS 检测\n` +
        `  ✓ 复杂多面板场景用 JS 拖拽库（interact.js / react-resizable）\n` +
        `\n` +
        `  CSS.supports('resize','both') = ${f.resizeBoth}\n` +
        `  ResizeObserver 可用 = ${f.resizeObserver}`;
    } catch (err: any) {
      return `读取陷阱与最佳实践信息失败：${err.name} - ${err.message}`;
    }
  }

  _runPitfallsDemo(): void {
    this.setState({ pitfallsInfo: this._readPitfallsInfo() });
    this._addLog('resize', `陷阱与最佳实践演示完成；ResizeObserver=${this._flags().resizeObserver}`);
  }

  _renderCard8(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 陷阱与最佳实践 —— textarea 默认/触摸/flex/ResizeObserver/无障碍',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['resize:both', f.resizeBoth], ['ResizeObserver', f.resizeObserver]]),
        h(Tag, { color: 'warning' }, '5 大陷阱'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '五大陷阱：textarea UA 默认 resize: both 破坏表单布局（解决：resize: vertical）；移动端触摸支持差（iOS Safari 部分不支持，解决：JS 拖拽库）；与 flexbox/grid 项目冲突（flex-shrink 默认 1 压缩，解决：flex-shrink: 0）；ResizeObserver 监听拖拽尺寸（原生 resize 不触发 window resize 事件，需 ResizeObserver，组件卸载时 disconnect 释放）；无障碍键盘等价缺失（仅鼠标/触摸，提供尺寸输入框/方向键）。最佳实践清单 10 条覆盖 min/max 约束、textarea 默认值、flex/grid 协同、ResizeObserver 生命周期、移动端兼容、无障碍等价。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行陷阱与最佳实践演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runPitfallsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'ResizeObserver 监听拖拽尺寸（拖拽下方元素观察输出）：'),
        h('div', { class: 'rs-observer-target' },
          '拖拽右下角手柄\nResizeObserver 将监听尺寸变化\n（jsdom 通常不实现 ResizeObserver，真实浏览器可观察）',
        ),
        h('div', { class: 'rs-output rs-observer-output' },
          f.resizeObserver
            ? '等待 ResizeObserver 回调（拖拽上方元素）...'
            : 'ResizeObserver 不可用（jsdom 通常不实现）。在真实浏览器中拖拽上方元素将触发回调，输出实时尺寸。',
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.pitfallsInfo || '（点击按钮查看 5 大陷阱与 10 条最佳实践完整说明）')),
        h(Alert, {
          type: 'warning',
          message: '原生 resize 无键盘等价，无障碍差；移动端触摸支持不一致',
          description: '陷阱清单：textarea UA 默认 resize: both（设 vertical）；移动端触摸支持差（用 JS 库）；flex/grid 子元素需 flex-shrink: 0；ResizeObserver 监听尺寸（卸载时 disconnect）；无键盘等价（提供尺寸输入框/方向键）。最佳实践：min/max 约束 + textarea 默认值 + flex 协同 + ResizeObserver 生命周期 + 移动端兼容 + 无障碍等价。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== 日志面板 ===================

  _renderLogPanel(): Node | string {
    const s = this.state;
    if (!s.logs || s.logs.length === 0) return '';
    return h(Card, { title: '运行日志' },
      h('div', { class: 'log-list' },
        ...s.logs.map((log: LogEntry) =>
          h('div', { class: `log-item log-${log.type}` },
            h('span', { class: 'log-time' }, log.time),
            h('span', { class: 'log-content' }, log.content),
          ),
        ),
      ),
    );
  }

  // =================== 渲染入口 ===================

  renderPage(): Node | string | (Node | string)[] {
    const s = this.state;
    return [
      h('h2', { class: 'section-title' }, 'CSS Resize 属性完整实验室'),

      h(Alert, {
        type: 'info',
        message: 'CSS Resize 属性 —— CSS UI Module Level 4 用户可拖拽调整尺寸',
        description: '演示 CSS resize 属性全套能力：resize 概述（CSS UI L4 / 与 overflow 必须配合 / 浏览器支持 / textarea UA 默认 both）、值全集（none|both|horizontal|vertical|block|inline / 物理值 vs 逻辑值 / writing-mode 适配）、与 overflow 协同（必备组合 resize + overflow: auto / overflow: hidden 仍可 resize / overflow: visible 无效）、min/max-width/height 约束（防拖出布局 / 优先级 min > max > width）、逻辑值 block/inline（writing-mode 翻转 / Chrome 111+）、::-webkit-resizer 伪元素（Webkit 私有 / 隐藏手柄 / 自定义样式）、实战场景（IDE 多面板 / 表格列宽 / 调试器 / textarea / JS 库对比）、陷阱与最佳实践（textarea 默认 / 触摸支持 / flex/grid 冲突 / ResizeObserver 监听 / 无障碍键盘等价）。CSS.supports() 检测属性支持，jsdom 不做真实布局但流程完整。',
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
    ];
  }
}
