// =====================================================================
// CSSContainerStyleQueriesPage.js —— CSS 容器样式查询 实验室
// 演示 MDN / CSS Container Queries Level 3（Style Queries）：
//   1. 尺寸查询 vs 样式查询（Size vs Style Queries）——
//      尺寸查询：container-type: inline-size + @container (min-width: 300px) 按容器尺寸响应；
//      样式查询：container-type: style（或默认）+ @container style(--theme: dark) 按自定义属性值响应；
//      container-name: sidebar + @container sidebar (min-width: 300px) 命名容器限定；
//      区别：尺寸查询触发重排（布局），样式查询仅计算样式（不触发布局），性能更好；
//      container-type: size（双维度，慎用易递归）vs inline-size（仅宽度）vs style（仅样式，不建立尺寸 containment）。
//   2. 查询自定义属性（Querying Custom Properties）——
//      @container style(--active: 1) 查询布尔型；@container style(--theme: dark) 查询字符串；
//      @container style(--count: 5) 查询数值；@container style(--theme: dark) and style(--compact: 1) 多条件 AND；
//      容器需先设置 --theme: dark，子元素用 @container style(--theme: dark) { ... } 响应；
//      浏览器支持：Chrome 111+，CSS.supports('@container style(--x: 1)') 检测。
//   3. 后代样式查询（Descendant Style Queries）——
//      样式查询只能查询「容器自身」的样式，不能直接查询后代元素；
//      模式：容器设置 --state: active，后代通过 @container style(--state: active) 响应祖先容器状态；
//      与 :has() 选择器对比：:has() 查询后代结构，样式查询查询容器自身属性；
//      实战模式：卡片容器 --variant: primary，内部按钮/标题/图标通过样式查询适配变体。
//   4. 与 @property 注册属性协同（Registered Properties）——
//      @property --hue { syntax: '<angle>'; initial-value: 0deg; inherits: true; } 或 CSS.registerProperty()；
//      注册属性让自定义属性可被动画/过渡，且类型安全；
//      样式查询注册属性：@container style(--hue: 180deg) 查询带类型的属性；
//      未注册属性查询时按字符串比较，注册后按类型比较（如 <length>、<color>、<integer>）；
//      与 @starting-style、transition-behavior: allow-discrete 协同实现变体切换动画。
//   5. 无尺寸 containment 的纯样式响应 ——
//      container-type: style 不建立尺寸 containment（不影响布局）；
//      可用于「主题切换」：容器设置 --theme: dark，所有后代无需 media query 即可响应；
//      vs prefers-color-scheme 媒体查询：样式查询是组件级（容器作用域），媒体查询是全局级；
//      vs :root 自定义属性 + 类名切换：样式查询更声明式，组件可独立主题化（嵌套组件可不同主题）。
//   6. 浏览器支持与渐进增强 ——
//      @supports container: style(--x) { ... } 或 CSS.supports('@container style(--x: 1)') 检测；
//      不支持时回退：用类名 + 普通选择器，或用 :has() 替代；
//      各浏览器版本：Chrome 111+（2023.3）、Safari 17.2+（2023.12）、Firefox 暂不支持（截至 2024）；
//      与 @container 尺寸查询（Chrome 105+/Safari 16+）的关系：样式查询是尺寸查询的扩展。
// 说明：jsdom 中 CSS 渲染不可用，CSS.supports 可能不可靠或缺失；所有演示通过展示 CSS 代码片段说明，
//       无法真实渲染样式查询的视觉效果。所有调用前做能力检测（try/catch 包裹 CSS.supports），
//       不可用仅记日志，绝不抛异常。视觉演示需在真实浏览器查看。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { Props, State } from '../../core/types.js';

interface LogEntry { type: string; content: string; time: string; }

interface CSSContainerStyleQueriesPageState extends State {
  logs: LogEntry[];
  capsSummary: string;
  sizeVsStyleInfo: string;
  customPropInfo: string;
  descendantInfo: string;
  registeredPropsInfo: string;
  pureStyleInfo: string;
  supportInfo: string;
}

interface BtnOpts extends Props {
  type?: string;
  size?: string;
  disabled?: boolean;
  danger?: boolean;
  loading?: boolean;
  onClick: (e: MouseEvent) => void;
}

export class CSSContainerStyleQueriesPage extends Page {
  declare state: CSSContainerStyleQueriesPageState;
  _inited: boolean = false;
  _styleEl: HTMLStyleElement | null = null;


  // —— 初始 state ——
  initialState(): CSSContainerStyleQueriesPageState {
    return {
      logs: [],
      capsSummary: '',
      sizeVsStyleInfo: '',     // Card 1：尺寸查询 vs 样式查询
      customPropInfo: '',      // Card 2：查询自定义属性
      descendantInfo: '',      // Card 3：后代样式查询
      registeredPropsInfo: '', // Card 4：与 @property 注册属性协同
      pureStyleInfo: '',       // Card 5：无尺寸 containment 的纯样式响应
      supportInfo: '',         // Card 6：浏览器支持与渐进增强
    };
  }

  // —— 生命周期 ——
  componentDidMount(): void {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._styleEl = null;           // 动态插入的 <style> 引用

    // 一次性能力检测：容器尺寸查询 + 容器样式查询 + 注册属性
    const caps = this._caps();
    const parts = [
      `CSS.supports ${caps.cssSupports ? '✓' : '✗'}`,
      `@container (size) ${caps.containerSize ? '✓' : '✗'}`,
      `@container style() ${caps.containerStyle ? '✓' : '✗'}`,
      `container-type:inline-size ${caps.containerTypeInline ? '✓' : '✗'}`,
      `container-type:style ${caps.containerTypeStyle ? '✓' : '✗'}`,
      `container-name ${caps.containerName ? '✓' : '✗'}`,
      `@property ${caps.atProperty ? '✓' : '✗'}`,
      `CSS.registerProperty ${caps.registerProperty ? '✓' : '✗'}`,
    ];
    const anyAvailable = caps.cssSupports;
    const summary = anyAvailable
      ? `CSS 容器样式查询能力检测：${parts.join(' · ')}。jsdom 中 CSS.supports 通常可用但仅做语法检查（不真实渲染），样式查询的视觉效果需在真实浏览器查看。可执行的演示将以 CSS.supports 真实探测，并展示 CSS 代码片段说明，缺失特性仅记日志。`
      : '当前环境 CSS.supports 不可用（jsdom 部分版本缺失或受限）；所有按钮点击将仅展示 CSS 代码片段说明，不会抛异常。在真实浏览器（Chrome 111+ 支持样式查询）中打开可执行真实探测。';

    this.setState({ capsSummary: summary });
    this._addLog(anyAvailable ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!caps.cssSupports) this._addLog('warn', 'CSS.supports 不可用（jsdom 部分版本缺失），所有检测降级为仅说明');
    if (!caps.containerStyle) this._addLog('warn', '@container style(--x: 1) 不支持（Chrome 111+ / Safari 17.2+，jsdom 不模拟）');
    if (!caps.containerTypeStyle) this._addLog('warn', 'container-type: style 不支持（Chrome 111+）');
    if (!caps.containerTypeInline) this._addLog('warn', 'container-type: inline-size 不支持（Chrome 105+ / Safari 16+）');
    if (!caps.registerProperty) this._addLog('warn', 'CSS.registerProperty 不支持（Chrome 85+）');
    if (!caps.atProperty) this._addLog('warn', '@property at-rule 不支持或 jsdom 未识别（Chrome 85+）');

    // 一次性注入演示样式（仅一次；rerender 不会移除 head 中的 style）
    this._injectDemoStyle();
  }

  componentWillUnmount(): void {
    // 移除动态注入的 <style> 元素（若存在）
    try {
      if (this._styleEl && this._styleEl.parentNode) {
        this._styleEl.parentNode.removeChild(this._styleEl);
      }
    } catch { /* noop */ }
    this._styleEl = null;
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

  // —— 同步能力检测（render 时调用，开销可忽略）——
  _caps(): any {
    const cssSupports = typeof CSS !== 'undefined' && typeof CSS.supports === 'function';
    let containerSize = false;
    let containerStyle = false;
    let containerTypeInline = false;
    let containerTypeStyle = false;
    let containerTypeSize = false;
    let containerName = false;
    let registerProperty = false;
    let atProperty = false;
    if (cssSupports) {
      try { containerSize = CSS.supports('@container (min-width: 1px)'); } catch { /* jsdom 不识别 at-rule */ }
      try { containerStyle = CSS.supports('@container style(--x: 1)'); } catch { /* noop */ }
      try { containerTypeInline = CSS.supports('container-type: inline-size'); } catch { /* noop */ }
      try { containerTypeStyle = CSS.supports('container-type: style'); } catch { /* noop */ }
      try { containerTypeSize = CSS.supports('container-type: size'); } catch { /* noop */ }
      try { containerName = CSS.supports('container-name: sidebar'); } catch { /* noop */ }
      try { registerProperty = typeof CSS !== 'undefined' && typeof CSS.registerProperty === 'function'; } catch { /* noop */ }
      try { atProperty = CSS.supports('@property --x { syntax: "<length>"; inherits: false; initial-value: 0px; }'); } catch { /* noop */ }
    }
    return {
      cssSupports, containerSize, containerStyle,
      containerTypeInline, containerTypeStyle, containerTypeSize,
      containerName, registerProperty, atProperty,
    };
  }

  // —— 注入演示用 <style> 标签到 document.head ——
  _injectDemoStyle(): void {
    const id = 'css-container-style-queries-demo';
    try {
      const existing = (document.getElementById(id) as any);
      if (existing) existing.remove();
      const style = document.createElement('style');
      style.id = id;
      style.textContent = `
        /* ===== Card 1: 尺寸查询 vs 样式查询 ===== */
        .csq-size-host {
          container-type: inline-size;
          container-name: sizecard;
          border: 1px dashed var(--color-border, #ccc);
          padding: 8px; resize: horizontal; overflow: auto;
          max-width: 100%; min-width: 120px;
        }
        .csq-size-child { padding: 8px; background: var(--color-primary-bg, #e6f0ff); border-radius: 4px; }
        @container sizecard (min-width: 300px) {
          .csq-size-child { background: var(--color-success-bg, #e6f9ee); font-weight: bold; }
        }
        .csq-style-host {
          container-type: style;
          border: 1px dashed var(--color-border, #ccc);
          padding: 8px;
        }
        .csq-style-child { padding: 8px; background: var(--color-bg-spotlight, #f5f5f5); border-radius: 4px; color: #333; }
        @container style(--theme: dark) {
          .csq-style-child { background: #1a1a1a; color: #fff; }
        }

        /* ===== Card 2: 查询自定义属性 ===== */
        .csq-cp-host { container-type: style; border: 1px dashed var(--color-border, #ccc); padding: 8px; }
        .csq-cp-item { padding: 8px; margin: 4px 0; border-radius: 4px; background: #eee; }
        @container style(--active: 1) { .csq-cp-item.is-active { background: var(--color-success-bg, #e6f9ee); } }
        @container style(--theme: dark) { .csq-cp-item.is-theme { background: #333; color: #fff; } }
        @container style(--count: 5) { .csq-cp-item.is-count { border: 2px solid #4a90d9; } }
        @container style(--theme: dark) and style(--compact: 1) {
          .csq-cp-item.is-multi { padding: 4px; font-size: 12px; background: #222; color: #fff; }
        }

        /* ===== Card 3: 后代样式查询 ===== */
        .csq-desc-host { container-type: style; border: 1px dashed var(--color-border, #ccc); padding: 8px; }
        .csq-desc-title { font-size: 16px; margin: 4px 0; }
        .csq-desc-btn { padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; background: #ccc; }
        .csq-desc-icon { display: inline-block; width: 16px; height: 16px; margin-right: 4px; background: #888; border-radius: 2px; }
        @container style(--variant: primary) {
          .csq-desc-title { color: #4a90d9; }
          .csq-desc-btn { background: #4a90d9; color: #fff; }
          .csq-desc-icon { background: #4a90d9; }
        }
        @container style(--variant: danger) {
          .csq-desc-title { color: #ef4444; }
          .csq-desc-btn { background: #ef4444; color: #fff; }
          .csq-desc-icon { background: #ef4444; }
        }

        /* ===== Card 4: 与 @property 注册属性协同 ===== */
        @property --hue {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: true;
        }
        .csq-prop-host { container-type: style; border: 1px dashed var(--color-border, #ccc); padding: 8px; }
        .csq-prop-box { width: 60px; height: 60px; border-radius: 4px; background: hsl(var(--hue, 0deg), 70%, 50%); transition: --hue 0.3s; }
        @container style(--hue: 180deg) { .csq-prop-box { outline: 2px solid #000; } }

        /* ===== Card 5: 无尺寸 containment 的纯样式响应 ===== */
        .csq-theme-host { container-type: style; border: 1px dashed var(--color-border, #ccc); padding: 8px; }
        .csq-theme-card { padding: 12px; border-radius: 6px; background: #fff; color: #333; }
        .csq-theme-text { margin: 4px 0; }
        .csq-theme-nested { container-type: style; padding: 8px; border-radius: 4px; background: #f0f0f0; }
        @container style(--theme: dark) {
          .csq-theme-card { background: #1a1a1a; color: #fff; }
          .csq-theme-text { color: #ccc; }
        }
        @container style(--theme: light) {
          .csq-theme-card { background: #fff; color: #333; }
          .csq-theme-text { color: #666; }
        }
      `;
      document.head.appendChild(style);
      this._styleEl = style;
    } catch (err: any) {
      this._addLog('warn', `注入演示样式失败：${err.name} - ${err.message}`);
    }
  }

  // =================== Card 1：尺寸查询 vs 样式查询 ===================

  _showSizeVsStyleDiff(): void {
    const caps = this._caps();
    this.setState({ sizeVsStyleInfo:
      '===== 尺寸查询 vs 样式查询 对比 =====\n\n' +
      '【尺寸查询（Size Queries）】\n' +
      '  .host { container-type: inline-size; }\n' +
      '  @container (min-width: 300px) { .child { ... } }\n' +
      '  响应对象：容器的「尺寸」（width / height / inline-size / block-size）\n' +
      '  触发时机：容器尺寸变化（窗口缩放、父级布局变化、resize）\n' +
      '  性能：触发重排（reflow），浏览器需重新计算布局\n' +
      '  支持版本：Chrome 105+ / Safari 16+ / Firefox 110+\n\n' +
      '【样式查询（Style Queries）】\n' +
      '  .host { container-type: style; }  /* 或默认（不设 container-type）*/\n' +
      '  @container style(--theme: dark) { .child { ... } }\n' +
      '  响应对象：容器的「自定义属性值」（--theme、--active 等）\n' +
      '  触发时机：容器自定义属性值变化（JS 设置、类切换、继承变化）\n' +
      '  性能：仅计算样式（style recalc），不触发布局重排，性能更好\n' +
      '  支持版本：Chrome 111+ / Safari 17.2+（Firefox 暂不支持）\n\n' +
      '核心区别：\n' +
      '  - 尺寸查询 = 「布局驱动」的响应式（容器多大 → 子元素怎么布局）\n' +
      '  - 样式查询 = 「状态驱动」的响应式（容器什么状态 → 子元素什么样式）\n' +
      '  - 样式查询不依赖尺寸变化，即使容器尺寸不变也能响应（如主题切换）\n\n' +
      `当前环境检测：containerSize=${caps.containerSize}, containerStyle=${caps.containerStyle}（jsdom 不一定识别 at-rule，仅供参考）。` });
    this._addLog('compare', `对比尺寸 vs 样式查询（size=${caps.containerSize}, style=${caps.containerStyle}）`);
  }

  _showContainerTypeOptions(): void {
    const caps = this._caps();
    this.setState({ sizeVsStyleInfo:
      '===== container-type 取值详解 =====\n\n' +
      'container-type: normal | inline-size | size | style\n\n' +
      '【normal（默认）】\n' +
      '  不建立容器查询上下文（不能作为 @container 的查询目标）\n' +
      '  用途：显式取消继承的 container-type\n\n' +
      '【inline-size】（最常用）\n' +
      '  按行内尺寸（宽度）查询，建立 inline-size containment\n' +
      '  @container (min-width: 300px) 仅按宽度响应\n' +
      '  支持：Chrome 105+ / Safari 16+\n' +
      `  CSS.supports('container-type: inline-size') = ${caps.containerTypeInline}\n\n` +
      '【size】（双维度，慎用）\n' +
      '  按双维度（宽度 + 高度）查询，建立 size containment\n' +
      '  @container (min-width: 300px) and (min-height: 200px)\n' +
      '  风险：容器自身高度依赖子内容时，size containment 会导致高度无法计算 → 递归/塌陷\n' +
      '  建议：仅在容器高度被外部固定（如 100vh、固定 px）时使用\n' +
      `  CSS.supports('container-type: size') = ${caps.containerTypeSize}\n\n` +
      '【style】（样式查询专用）\n' +
      '  按样式（自定义属性值）查询，不建立尺寸 containment（不影响布局）\n' +
      '  @container style(--theme: dark)\n' +
      '  关键：style 不创建尺寸 containment，因此不会导致布局重排\n' +
      '  支持：Chrome 111+（与样式查询同期）\n' +
      `  CSS.supports('container-type: style') = ${caps.containerTypeStyle}\n\n` +
      '选择建议：\n' +
      '  - 需要按尺寸响应 → inline-size（绝大多场景）\n' +
      '  - 需要按状态/主题响应 → style（或省略 container-type，默认即可查询 style）\n' +
      '  - 需要双维度尺寸 → size（仅当容器尺寸不依赖内容时）' });
    this._addLog('explain', `展示 container-type 取值（inline=${caps.containerTypeInline}, size=${caps.containerTypeSize}, style=${caps.containerTypeStyle}）`);
  }

  _showNamedContainer(): void {
    const caps = this._caps();
    this.setState({ sizeVsStyleInfo:
      '===== 命名容器（container-name） =====\n\n' +
      '语法：\n' +
      '  .sidebar { container-type: inline-size; container-name: sidebar; }\n' +
      '  .main   { container-type: inline-size; container-name: main; }\n\n' +
      '  /* 精确匹配命名容器 */\n' +
      '  @container sidebar (min-width: 300px) { .sidebar .widget { ... } }\n' +
      '  @container main (min-width: 600px) { .main .widget { ... } }\n\n' +
      '为何需要命名：\n' +
      '  - 嵌套容器场景：父容器 .layout（name: layout）内嵌 .card（name: card），\n' +
      '    子元素同时被两层容器包裹；不命名时 @container 会匹配「最近的」容器\n' +
      '  - 用 @container <name> (condition) 精确指定查询哪一层容器\n' +
      '  - 避免误匹配：多个容器同时存在时，命名让查询目标明确\n\n' +
      '命名规则：\n' +
      '  - container-name: <custom-ident>（CSS 标识符，不能以数字开头）\n' +
      '  - 可多个：container-name: sidebar panel（空格分隔，匹配任一即可）\n' +
      '  - 特殊值 none：清除命名\n\n' +
      '命名 + 样式查询组合：\n' +
      '  .sidebar { container-type: style; container-name: sidebar; }\n' +
      '  @container sidebar style(--theme: dark) { .sidebar .widget { ... } }\n\n' +
      `CSS.supports('container-name: sidebar') = ${caps.containerName}\n` +
      `CSS.supports('@container (min-width: 1px)') = ${caps.containerSize}（基础尺寸查询）` });
    this._addLog('syntax', `展示命名容器（container-name 支持=${caps.containerName}）`);
  }

  _showPerformanceDiff(): void {
    this.setState({ sizeVsStyleInfo:
      '===== 性能差异：尺寸查询 vs 样式查询 =====\n\n' +
      '【尺寸查询的性能成本】\n' +
      '  触发：容器尺寸变化（resize / 父级布局变化）\n' +
      '  浏览器流程：\n' +
      '    1. 重新计算布局（Layout / Reflow）—— 计算所有元素几何位置\n' +
      '    2. 重新计算样式（Style Recalc）—— 应用 @container 规则\n' +
      '    3. 重新绘制（Paint）—— 重绘变化区域\n' +
      '    4. 合成（Composite）—— GPU 合成层\n' +
      '  成本：高（Layout 是最昂贵的渲染阶段之一）\n' +
      '  频率：每次尺寸变化都触发（resize 可能高频）\n\n' +
      '【样式查询的性能成本】\n' +
      '  触发：容器自定义属性值变化（JS 设置 style、类切换、继承变化）\n' +
      '  浏览器流程：\n' +
      '    1. 重新计算样式（Style Recalc）—— 仅计算样式（container-type: style 不建立尺寸 containment）\n' +
      '    2. 重新绘制（Paint）—— 重绘变化区域\n' +
      '    3. 合成（Composite）\n' +
      '  成本：低（跳过 Layout 阶段，仅 Style Recalc + Paint）\n' +
      '  频率：仅当自定义属性变化时触发（通常低频）\n\n' +
      '为何样式查询更轻量：\n' +
      '  - container-type: style 不建立尺寸 containment，不影响布局计算\n' +
      '  - 样式查询响应的是「属性值」而非「几何尺寸」，浏览器无需重排\n' +
      '  - 主题切换、状态变化等场景用样式查询比尺寸查询更高效\n\n' +
      '实战建议：\n' +
      '  - 响应式布局（宽度变化）→ 尺寸查询（inline-size）\n' +
      '  - 主题/状态切换（属性变化）→ 样式查询（style）\n' +
      '  - 高频交互（如拖拽改变尺寸）→ 慎用尺寸查询（可能性能瓶颈），优先 transform/opacity' });
    this._addLog('explain', '已展示尺寸 vs 样式查询的性能差异');
  }

  _renderCard1(): Node | string {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. 尺寸查询 vs 样式查询（Size vs Style Queries）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.containerSize ? 'success' : 'error' }, caps.containerSize ? 'size query ✓' : 'size query ✗'),
        h(Tag, { color: caps.containerStyle ? 'success' : 'error' }, caps.containerStyle ? 'style query ✓' : 'style query ✗'),
        h(Tag, { color: 'primary' }, 'container-type'),
        h(Tag, { color: 'info' }, '性能差异')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '尺寸查询：container-type: inline-size + @container (min-width: 300px) 按容器尺寸响应（触发重排）。样式查询：container-type: style + @container style(--theme: dark) 按自定义属性值响应（仅计算样式，不重排，性能更好）。container-name: sidebar + @container sidebar (min-width: 300px) 命名容器限定。container-type: size（双维度，慎用易递归）vs inline-size（仅宽度）vs style（仅样式，不建立尺寸 containment）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('尺寸 vs 样式对比', { type: 'primary', size: 'sm', onClick: () => this._showSizeVsStyleDiff() }),
          this._btn('container-type 取值', { size: 'sm', onClick: () => this._showContainerTypeOptions() }),
          this._btn('命名容器', { size: 'sm', onClick: () => this._showNamedContainer() }),
          this._btn('性能差异', { size: 'sm', onClick: () => this._showPerformanceDiff() })),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '尺寸查询容器（拖动右下角调整宽度，>300px 变绿加粗）：'),
        h('div', { class: 'csq-size-host mt-xs' },
          h('div', { class: 'csq-size-child' }, '尺寸查询子元素（@container sizecard (min-width: 300px)）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '样式查询容器（container-type: style，需 JS 设置 --theme: dark 才变深色）：'),
        h('div', { class: 'csq-style-host mt-xs' },
          h('div', { class: 'csq-style-child' }, '样式查询子元素（@container style(--theme: dark)）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '尺寸 vs 样式查询说明：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.sizeVsStyleInfo || '（点击「尺寸 vs 样式对比」或「container-type 取值」）')),
        h(Alert, { type: 'info', message: '样式查询仅计算样式不重排，性能优于尺寸查询', description: 'container-type: style 不建立尺寸 containment，主题/状态切换用样式查询比尺寸查询更高效。容器尺寸变化才用尺寸查询（inline-size 最常用；size 双维度慎用易递归）。命名容器 container-name 让嵌套场景查询目标明确。jsdom 不模拟渲染，演示仅展示代码片段。' }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 2：查询自定义属性 ===================

  _showCustomPropQuery(): void {
    const caps = this._caps();
    this.setState({ customPropInfo:
      '===== 查询自定义属性语法 =====\n\n' +
      '基础语法：@container style(<custom-property>: <value>) { ... }\n\n' +
      '【查询布尔型自定义属性】\n' +
      '  .host { container-type: style; --active: 1; }\n' +
      '  @container style(--active: 1) { .child { font-weight: bold; } }\n' +
      '  说明：CSS 无真正布尔类型，用 1/0 或 on/off 字符串模拟；查询时按字符串比较\n\n' +
      '【查询字符串值】\n' +
      '  .host { --theme: dark; }\n' +
      '  @container style(--theme: dark) { .child { background: #1a1a1a; color: #fff; } }\n' +
      '  @container style(--theme: light) { .child { background: #fff; color: #333; } }\n' +
      '  说明：最常见用法，按主题/变体字符串响应\n\n' +
      '【查询数值】\n' +
      '  .host { --count: 5; }\n' +
      '  @container style(--count: 5) { .child { border: 2px solid #4a90d9; } }\n' +
      '  说明：未注册的 --count 按字符串比较（"5" === "5"）；注册 <integer> 后按数值比较\n\n' +
      '查询规则：\n' +
      '  - 容器必须先设置该自定义属性（直接设置或继承）\n' +
      '  - 子元素通过 @container style(...) 响应「容器自身」的属性值\n' +
      '  - 不能查询后代元素的属性（仅查询容器自身，见 Card 3）\n' +
      '  - 未注册属性按字符串比较（区分大小写）\n\n' +
      `浏览器支持：Chrome 111+（2023.3）/ Safari 17.2+（2023.12）/ Firefox 暂不支持\n` +
      `CSS.supports('@container style(--x: 1)') = ${caps.containerStyle}（jsdom 不一定识别 at-rule，仅供参考）` });
    this._addLog('syntax', `展示查询自定义属性语法（style 支持=${caps.containerStyle}）`);
  }

  _showMultiConditionAnd(): void {
    this.setState({ customPropInfo:
      '===== 多条件 AND 查询 =====\n\n' +
      '语法：@container style(<prop1>: <val1>) and style(<prop2>: <val2>) { ... }\n\n' +
      '示例：主题 + 紧凑模式双条件\n' +
      '  .host {\n' +
      '    container-type: style;\n' +
      '    --theme: dark;\n' +
      '    --compact: 1;\n' +
      '  }\n' +
      '  @container style(--theme: dark) and style(--compact: 1) {\n' +
      '    .child {\n' +
      '      padding: 4px;       /* 紧凑模式缩小内边距 */\n' +
      '      font-size: 12px;    /* 紧凑模式缩小字号 */\n' +
      '      background: #222;   /* 深色主题背景 */\n' +
      '      color: #fff;        /* 深色主题文字 */\n' +
      '    }\n' +
      '  }\n\n' +
      '多条件组合规则：\n' +
      '  - and：所有条件都满足才匹配\n' +
      '  - not：取反（@container not style(--theme: dark)）\n' +
      '  - or：用逗号分隔（@container style(--a: 1), style(--b: 2)）\n' +
      '  - 混合：style(...) and style(...) or style(...)（and 优先级高于 or）\n\n' +
      '与尺寸查询混合：\n' +
      '  @container (min-width: 300px) and style(--theme: dark) {\n' +
      '    /* 容器宽度 >= 300px 且主题为 dark 时生效 */\n' +
      '    .child { ... }\n' +
      '  }\n' +
      '  注意：混合查询需容器同时声明 container-type: inline-size style（Chrome 111+）\n\n' +
      '实战场景：\n' +
      '  - 主题 + 尺寸双维度响应（dark + 宽屏 → 紧凑深色布局）\n' +
      '  - 变体 + 状态双维度响应（primary + active → 高亮主色按钮）\n' +
      '  - 设备 + 偏好双维度响应（mobile + compact → 极简模式）' });
    this._addLog('syntax', '已展示多条件 AND 查询（含尺寸混合）');
  }

  _showCustomPropSupport(): void {
    const caps = this._caps();
    this.setState({ customPropInfo:
      '===== 浏览器支持检测 =====\n\n' +
      '特性检测方式：\n\n' +
      '【方式 1：CSS.supports()】\n' +
      "  CSS.supports('@container style(--x: 1)')\n" +
      '  返回 true 表示支持样式查询语法\n' +
      `  当前环境检测结果：${caps.containerStyle}\n\n` +
      '【方式 2：@supports 规则】\n' +
      '  @supports container: style(--x: 1) {\n' +
      '    /* 支持样式查询时生效的样式 */\n' +
      '    .enhanced { ... }\n' +
      '  }\n' +
      '  @supports not (container: style(--x: 1)) {\n' +
      '    /* 不支持时的回退样式 */\n' +
      '    .fallback { ... }\n' +
      '  }\n\n' +
      '【方式 3：JS 动态检测】\n' +
      '  if (CSS.supports("@container style(--x: 1)")) {\n' +
      '    el.classList.add("supports-style-queries");\n' +
      '  } else {\n' +
      '    el.classList.add("no-style-queries");\n' +
      '  }\n\n' +
      '浏览器支持详情：\n' +
      '  浏览器          | 版本       | 支持状态\n' +
      '  ----------------|------------|------------------\n' +
      '  Chrome          | 111+       | 完整支持（2023.3 发布）\n' +
      '  Edge            | 111+       | 完整支持（与 Chrome 同步）\n' +
      '  Safari          | 17.2+      | 完整支持（2023.12 发布）\n' +
      '  Safari iOS      | 17.2+      | 完整支持\n' +
      '  Firefox         | 暂不支持   | 截至 2024 年初未实现（about:config 可试 flag）\n' +
      '  jsdom           | -          | 不模拟（CSS 渲染不可用）\n\n' +
      '注：CSS.supports() 在 jsdom 中可能返回 false（不识别 at-rule），不代表真实浏览器不支持。' });
    this._addLog('support', `展示浏览器支持检测（style=${caps.containerStyle}）`);
  }

  _showCustomPropPitfall(): void {
    this.setState({ customPropInfo:
      '===== 容器属性设置陷阱 =====\n\n' +
      '陷阱 1：未在容器上设置自定义属性\n' +
      '  /* 错误：--theme 设在子元素上，容器查询不到 */\n' +
      '  .host { container-type: style; }\n' +
      '  .child { --theme: dark; }\n' +
      '  @container style(--theme: dark) { .child { ... } }  /* 不生效！*/\n\n' +
      '  /* 正确：--theme 设在容器上 */\n' +
      '  .host { container-type: style; --theme: dark; }\n' +
      '  @container style(--theme: dark) { .child { ... } }  /* 生效 */\n\n' +
      '陷阱 2：自定义属性未继承到容器\n' +
      '  --theme 默认 inherits: true（自定义属性默认继承）\n' +
      '  若用 @property 注册时设 inherits: false，则不会从父级继承到容器\n' +
      '  解决：在容器上显式设置 --theme，或注册时设 inherits: true\n\n' +
      '陷阱 3：容器查询的是「计算值」而非「指定值」\n' +
      '  .host { --theme: dark; --theme: light; }  /* 后者覆盖 */\n' +
      '  @container style(--theme: dark) { ... }   /* 不生效，计算值是 light */\n\n' +
      '陷阱 4：未注册属性的字符串比较区分大小写\n' +
      '  .host { --theme: Dark; }\n' +
      '  @container style(--theme: dark) { ... }   /* 不生效，"Dark" !== "dark" */\n' +
      '  解决：统一命名约定（全小写），或注册属性（部分类型不区分大小写）\n\n' +
      '陷阱 5：container-type 未声明时无法查询\n' +
      '  .host { --theme: dark; }  /* 未设 container-type */\n' +
      '  @container style(--theme: dark) { ... }  /* 不生效，.host 不是容器 */\n' +
      '  解决：显式设 container-type: style（或 inline-size，但尺寸 containment 会影响布局）\n\n' +
      '调试技巧：\n' +
      '  - 用 getComputedStyle(host).getPropertyValue("--theme") 检查容器属性值\n' +
      '  - 用 CSS.supports("@container style(--x: 1)") 确认浏览器支持\n' +
      '  - 浏览器 DevTools 的 Container 标签可查看容器查询上下文' });
    this._addLog('pitfall', '已展示容器属性设置陷阱');
  }

  _renderCard2(): Node | string {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. 查询自定义属性（Querying Custom Properties）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.containerStyle ? 'success' : 'error' }, caps.containerStyle ? 'style() ✓' : 'style() ✗'),
        h(Tag, { color: 'primary' }, '布尔/字符串/数值'),
        h(Tag, { color: 'warning' }, '多条件 AND'),
        h(Tag, { color: 'info' }, '陷阱')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '@container style(--active: 1) 查询布尔型；@container style(--theme: dark) 查询字符串；@container style(--count: 5) 查询数值；@container style(--theme: dark) and style(--compact: 1) 多条件 AND。容器需先设置 --theme: dark，子元素用 @container style(--theme: dark) { ... } 响应。浏览器支持：Chrome 111+，CSS.supports("@container style(--x: 1)") 检测。未注册属性按字符串比较（区分大小写）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('查询语法', { type: 'primary', size: 'sm', onClick: () => this._showCustomPropQuery() }),
          this._btn('多条件 AND', { size: 'sm', onClick: () => this._showMultiConditionAnd() }),
          this._btn('浏览器支持检测', { size: 'sm', onClick: () => this._showCustomPropSupport() }),
          this._btn('容器属性陷阱', { size: 'sm', onClick: () => this._showCustomPropPitfall() })),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '样式查询容器（CSS 已声明，需 JS 在 .csq-cp-host 上设置 --active/--theme/--count 才生效）：'),
        h('div', { class: 'csq-cp-host mt-xs' },
          h('div', { class: 'csq-cp-item is-active' }, 'is-active（@container style(--active: 1)）'),
          h('div', { class: 'csq-cp-item is-theme' }, 'is-theme（@container style(--theme: dark)）'),
          h('div', { class: 'csq-cp-item is-count' }, 'is-count（@container style(--count: 5)）'),
          h('div', { class: 'csq-cp-item is-multi' }, 'is-multi（@container style(--theme: dark) and style(--compact: 1)）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '查询自定义属性说明：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.customPropInfo || '（点击「查询语法」或「多条件 AND」）')),
        h(Alert, { type: 'info', message: '样式查询按容器自定义属性值响应，支持布尔/字符串/数值/多条件', description: '容器需先设置自定义属性（直接设或继承），子元素通过 @container style(...) 响应。未注册属性按字符串比较（区分大小写）。多条件用 and 连接，可与尺寸查询混合。Chrome 111+ / Safari 17.2+ 支持，Firefox 暂不支持。' }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 3：后代样式查询 ===================

  _showDescendantPattern(): void {
    this.setState({ descendantInfo:
      '===== 后代样式查询模式 =====\n\n' +
      '核心规则：样式查询只能查询「容器自身」的样式，不能直接查询后代元素。\n\n' +
      '错误理解（无法实现）：\n' +
      '  .card { container-type: style; }\n' +
      '  .card .button { --state: active; }\n' +
      '  /* 试图查询后代 .button 的 --state —— 不可能！*/\n' +
      '  @container style(--state: active) { ... }  /* 查询的是 .card 的 --state，不是 .button 的 */\n\n' +
      '正确模式：在容器上设置状态属性，后代响应容器状态\n' +
      '  .card {\n' +
      '    container-type: style;\n' +
      '    --state: active;  /* 状态设在容器上 */\n' +
      '  }\n' +
      '  /* 后代元素响应容器（祖先）的 --state */\n' +
      '  @container style(--state: active) {\n' +
      '    .card .title { font-weight: bold; }\n' +
      '    .card .button { background: #4a90d9; }\n' +
      '    .card .icon { color: #4a90d9; }\n' +
      '  }\n\n' +
      'JS 触发状态变化：\n' +
      '  cardEl.style.setProperty("--state", "active");\n' +
      '  // 或通过类切换：cardEl.classList.add("is-active"); 配合 CSS 类设 --state\n' +
      '  // .card.is-active { --state: active; }\n\n' +
      '为何如此设计：\n' +
      '  - 容器查询的「容器」是查询上下文的根，子元素只能感知容器自身\n' +
      '  - 若允许查询后代，会破坏 CSS 的「自上而下」级联模型，导致循环依赖\n' +
      '  - 实际模式：状态「提升」到容器，后代统一响应（类似 React 的 state 提升到父组件）\n\n' +
      '嵌套容器：\n' +
      '  .outer { container-type: style; --theme: dark; container-name: outer; }\n' +
      '  .inner { container-type: style; --theme: light; container-name: inner; }\n' +
      '  @container outer style(--theme: dark) { /* 响应外层 dark */ }\n' +
      '  @container inner style(--theme: light) { /* 响应内层 light */ }\n' +
      '  嵌套组件可独立主题化（外层 dark、内层 light 共存）' });
    this._addLog('pattern', '已展示后代样式查询模式（状态提升到容器）');
  }

  _compareWithHas(): void {
    this.setState({ descendantInfo:
      '===== 样式查询 vs :has() 选择器 对比 =====\n\n' +
      '【样式查询 @container style(...)】\n' +
      '  查询对象：容器「自身」的自定义属性值\n' +
      '  作用域：容器内的所有后代（通过 @container 规则块）\n' +
      '  语法：.card { container-type: style; --variant: primary; } \n' +
      '        @container style(--variant: primary) { .card .btn { ... } }\n' +
      '  优势：声明式；性能好（仅 style recalc）；可查询任意自定义属性\n' +
      '  劣势：需在容器上显式设属性；不能直接查询后代结构\n\n' +
      '【:has() 选择器】\n' +
      '  查询对象：元素的「后代结构」（是否有匹配的子元素）\n' +
      '  作用域：匹配 :has() 的元素自身及其后代（通过选择器）\n' +
      '  语法：.card:has(.button.is-active) { ... }  /* .card 内有 .button.is-active 时 */\n' +
      '  优势：可直接查询后代结构；无需自定义属性；CSS 选择器原生\n' +
      '  劣势：性能开销（需遍历子树）；不能查询「值」（只能查「存在性」）\n\n' +
      '维度         | @container style(...)         | :has()\n' +
      '-------------|-------------------------------|---------------------------\n' +
      '查询对象     | 容器自身的自定义属性值        | 后代元素的结构/存在性\n' +
      '触发方式     | 容器属性值变化                | 后代元素增删/类变化\n' +
      '性能         | 高（仅 style recalc）         | 中（需遍历子树匹配）\n' +
      '声明位置     | @container 规则块             | 选择器内 :has()\n' +
      '查询值类型   | 任意值（字符串/数值/布尔）    | 仅存在性（有/无）\n' +
      '需自定义属性 | 是（容器上设 --x）            | 否（直接查后代选择器）\n' +
      '支持版本     | Chrome 111+ / Safari 17.2+    | Chrome 105+ / Safari 15.4+\n\n' +
      '选择建议：\n' +
      '  - 查询「容器状态/主题」（如 --theme: dark）→ 样式查询\n' +
      '  - 查询「后代是否存在某元素/类」（如 .card:has(.icon)）→ :has()\n' +
      '  - 二者可组合：.card:has(.button) { --has-button: 1; } 然后 @container style(--has-button: 1)\n' +
      '    （用 :has() 设置容器属性，再用样式查询响应 —— 但略显冗余，通常直接用 :has() 即可）' });
    this._addLog('compare', '已对比样式查询 vs :has() 选择器');
  }

  _showVariantPattern(): void {
    this.setState({ descendantInfo:
      '===== 变体适配实战模式 =====\n\n' +
      '场景：卡片组件有多种变体（primary / danger / success），内部按钮、标题、图标需根据变体适配样式。\n\n' +
      '传统方案（类名 + 后代选择器）：\n' +
      '  .card.primary .title { color: #4a90d9; }\n' +
      '  .card.primary .button { background: #4a90d9; }\n' +
      '  .card.primary .icon { color: #4a90d9; }\n' +
      '  .card.danger .title { color: #ef4444; }\n' +
      '  .card.danger .button { background: #ef4444; }\n' +
      '  .card.danger .icon { color: #ef4444; }\n' +
      '  问题：变体多时选择器爆炸；新增变体需改多处；嵌套组件难独立主题化\n\n' +
      '样式查询方案（声明式，组件级主题）：\n' +
      '  .card {\n' +
      '    container-type: style;\n' +
      '    /* JS 或类切换设置 --variant */\n' +
      '  }\n' +
      '  .card.primary { --variant: primary; }\n' +
      '  .card.danger { --variant: danger; }\n' +
      '  .card.success { --variant: success; }\n\n' +
      '  @container style(--variant: primary) {\n' +
      '    .title { color: #4a90d9; }\n' +
      '    .button { background: #4a90d9; color: #fff; }\n' +
      '    .icon { color: #4a90d9; }\n' +
      '  }\n' +
      '  @container style(--variant: danger) {\n' +
      '    .title { color: #ef4444; }\n' +
      '    .button { background: #ef4444; color: #fff; }\n' +
      '    .icon { color: #ef4444; }\n' +
      '  }\n' +
      '  @container style(--variant: success) {\n' +
      '    .title { color: #10b981; }\n' +
      '    .button { background: #10b981; color: #fff; }\n' +
      '    .icon { color: #10b981; }\n' +
      '  }\n\n' +
      '优势：\n' +
      '  1. 变体集中管理：每个 @container 块内是该变体的完整样式集\n' +
      '  2. 新增变体仅需加一个 @container 块，不动现有代码\n' +
      '  3. 嵌套独立：外层 .card.primary 内可嵌套 .card.danger，各自独立适配（容器作用域隔离）\n' +
      '  4. JS 控制简单：cardEl.style.setProperty("--variant", "primary") 即可切换\n\n' +
      'JS 切换示例：\n' +
      '  function setVariant(cardEl, variant) {\n' +
      '    cardEl.style.setProperty("--variant", variant);\n' +
      '  }\n' +
      '  setVariant(cardEl, "primary");  // 所有后代自动适配 primary 变体' });
    this._addLog('pattern', '已展示变体适配实战模式（卡片 --variant 主题化）');
  }

  _showDescendantLimit(): void {
    this.setState({ descendantInfo:
      '===== 后代样式查询的限制 =====\n\n' +
      '限制 1：只能查询容器自身属性，不能查询后代属性\n' +
      '  .card { container-type: style; }\n' +
      '  .card .badge { --count: 5; }\n' +
      '  @container style(--count: 5) { ... }  /* 查询 .card 的 --count，不是 .badge 的 */\n' +
      '  解决：把 --count 提升到 .card：.card { --count: 5; }\n\n' +
      '限制 2：不能查询「计算后」的样式属性（如 color、display）\n' +
      '  @container style(color: red) { ... }  /* 无效！只能查自定义属性 */\n' +
      '  @container style(display: flex) { ... }  /* 无效！*/\n' +
      '  说明：样式查询仅支持自定义属性（--*），不支持内置 CSS 属性\n' +
      '  变通：用自定义属性「镜像」内置属性，如 --display: flex，再查询 --display\n\n' +
      '限制 3：不能查询伪元素状态\n' +
      '  ::before { --state: active; }\n' +
      '  @container style(--state: active) { ... }  /* 无法查询伪元素的 --state */\n' +
      '  解决：在宿主元素上设 --state，伪元素继承\n\n' +
      '限制 4：未注册属性的值比较是字符串比较\n' +
      '  .host { --count: 05; }  /* 前导零 */\n' +
      '  @container style(--count: 5) { ... }  /* 不匹配，"05" !== "5" */\n' +
      '  解决：注册 @property --count { syntax: "<integer>"; ... } 后按数值比较\n\n' +
      '限制 5：不能在 @container 内重新定义容器属性\n' +
      '  @container style(--theme: dark) {\n' +
      '    .child { --theme: light; }  /* 无意义，--theme 是容器的，子元素设了也不影响容器查询 */\n' +
      '  }\n' +
      '  说明：子元素的自定义属性不会「冒泡」回容器；容器查询的是容器自身的计算值\n\n' +
      '总结：样式查询是「容器状态 → 后代响应」的单向模型，状态必须显式设在容器上。' });
    this._addLog('limit', '已展示后代样式查询的限制');
  }

  _renderCard3(): Node | string {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. 后代样式查询（Descendant Style Queries）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.containerStyle ? 'success' : 'error' }, caps.containerStyle ? 'descendant ✓' : 'descendant ✗'),
        h(Tag, { color: 'primary' }, '状态提升'),
        h(Tag, { color: 'warning' }, 'vs :has()'),
        h(Tag, { color: 'info' }, '变体适配')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '样式查询只能查询「容器自身」的样式，不能直接查询后代元素。模式：在容器上设置 --state: active，后代元素通过 @container style(--state: active) 响应祖先容器的状态。与 :has() 选择器对比：:has() 查询后代结构（存在性），样式查询查询容器自身属性（任意值）。实战模式：卡片容器 --variant: primary，内部按钮/标题/图标通过样式查询适配变体（嵌套组件可独立主题化）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('后代查询模式', { type: 'primary', size: 'sm', onClick: () => this._showDescendantPattern() }),
          this._btn('vs :has() 选择器', { size: 'sm', onClick: () => this._compareWithHas() }),
          this._btn('变体适配实战', { size: 'sm', onClick: () => this._showVariantPattern() }),
          this._btn('后代查询限制', { size: 'sm', onClick: () => this._showDescendantLimit() })),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '变体适配容器（CSS 声明 primary/danger 变体，需 JS 设置 --variant 才生效）：'),
        h('div', { class: 'csq-desc-host mt-xs' },
          h('div', { class: 'csq-desc-title' }, '卡片标题（@container style(--variant: ...) 响应）'),
          h('div', {},
            h('button', { class: 'csq-desc-btn', type: 'button' }, '按钮（变体适配）')),
          h('div', {},
            h('span', { class: 'csq-desc-icon' }), '图标 + 文本（变体适配）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '后代样式查询说明：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.descendantInfo || '（点击「后代查询模式」或「vs :has() 选择器」）')),
        h(Alert, { type: 'info', message: '样式查询查容器自身属性，:has() 查后代结构，二者互补', description: '状态必须提升到容器（类似 React state 提升），后代统一响应。变体适配实战：卡片 --variant: primary，内部按钮/标题/图标通过 @container style(--variant: primary) 适配。嵌套组件可独立主题化（外层 dark、内层 light 共存）。jsdom 不模拟渲染，演示仅展示代码片段。' }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 4：与 @property 注册属性协同 ===================

  _showRegisterProperty(): void {
    const caps = this._caps();
    this.setState({ registeredPropsInfo:
      '===== @property 注册属性 =====\n\n' +
      '【方式 1：@property at-rule（CSS）】\n' +
      '  @property --hue {\n' +
      '    syntax: "<angle>";\n' +
      '    initial-value: 0deg;\n' +
      '    inherits: true;\n' +
      '  }\n' +
      '  优势：声明式；浏览器解析时即注册；不依赖 JS\n' +
      `  支持：CSS.supports('@property --x { ... }') = ${caps.atProperty}\n\n` +
      '【方式 2：CSS.registerProperty()（JS）】\n' +
      '  CSS.registerProperty({\n' +
      '    name: "--hue",\n' +
      '    syntax: "<angle>",\n' +
      '    initialValue: "0deg",\n' +
      '    inherits: true,\n' +
      '  });\n' +
      '  优势：运行时动态注册；可根据条件注册不同属性\n' +
      `  支持：typeof CSS.registerProperty === "function" → ${caps.registerProperty}\n\n` +
      '属性字段：\n' +
      '  - syntax：值类型，如 "<length>" / "<color>" / "<integer>" / "<angle>" / "<number>" / "*" 等\n' +
      '  - initial-value：初始值（必须符合 syntax）\n' +
      '  - inherits：是否继承（true/false）\n\n' +
      '常用 syntax 类型：\n' +
      '  "<length>"      → 长度（px, em, rem, vh...）\n' +
      '  "<color>"       → 颜色（#fff, rgb(), hsl()...）\n' +
      '  "<integer>"     → 整数（无单位）\n' +
      '  "<number>"      → 数字（含小数）\n' +
      '  "<angle>"       → 角度（deg, rad, turn...）\n' +
      '  "<percentage>"  → 百分比\n' +
      '  "<length> | none"  → 长度或 none（多值用 | 分隔）\n' +
      '  "*"             → 任意值（通用语法，但不保证类型安全）\n\n' +
      '注册属性的好处：\n' +
      '  1. 类型安全：浏览器校验值是否符合 syntax，无效值回退到 initial-value\n' +
      '  2. 可动画/过渡：注册属性可在 transition/animation 中插值（如 --hue: 0deg → 180deg）\n' +
      '  3. 样式查询类型化：注册后样式查询按类型比较（见下方对比）' });
    this._addLog('syntax', `展示 @property 注册（atProperty=${caps.atProperty}, registerProperty=${caps.registerProperty}）`);
  }

  _showTypedQuery(): void {
    const caps = this._caps();
    this.setState({ registeredPropsInfo:
      '===== 类型化样式查询（注册属性） =====\n\n' +
      '注册属性后，样式查询按「类型」比较，而非字符串比较：\n\n' +
      '【注册 <angle> 类型】\n' +
      '  @property --hue {\n' +
      '    syntax: "<angle>";\n' +
      '    initial-value: 0deg;\n' +
      '    inherits: true;\n' +
      '  }\n' +
      '  .host { container-type: style; --hue: 180deg; }\n\n' +
      '  /* 类型化查询：180deg 匹配 0.5turn / 3.14159rad（同一角度）*/\n' +
      '  @container style(--hue: 180deg) { .child { ... } }\n' +
      '  @container style(--hue: 0.5turn) { .child { ... } }  /* 也匹配，因 0.5turn === 180deg */\n\n' +
      '【注册 <integer> 类型】\n' +
      '  @property --count {\n' +
      '    syntax: "<integer>";\n' +
      '    initial-value: 0;\n' +
      '    inherits: true;\n' +
      '  }\n' +
      '  .host { --count: 5; }\n' +
      '  @container style(--count: 5) { .child { ... } }  /* 数值比较，"05" 也匹配 */\n\n' +
      '【注册 <length> 类型】\n' +
      '  @property --gap {\n' +
      '    syntax: "<length>";\n' +
      '    initial-value: 0px;\n' +
      '    inherits: true;\n' +
      '  }\n' +
      '  .host { --gap: 10px; }\n' +
      '  @container style(--gap: 0.625rem) { .child { ... } }  /* 匹配，10px === 0.625rem（1rem=16px）*/\n\n' +
      '【注册 <color> 类型】\n' +
      '  @property --accent {\n' +
      '    syntax: "<color>";\n' +
      '    initial-value: #000;\n' +
      '    inherits: true;\n' +
      '  }\n' +
      '  .host { --accent: #ff0000; }\n' +
      '  @container style(--accent: red) { .child { ... } }  /* 匹配，#ff0000 === red */\n\n' +
      `当前环境：atProperty=${caps.atProperty}, containerStyle=${caps.containerStyle}（jsdom 不一定识别，仅供参考）` });
    this._addLog('syntax', '已展示类型化样式查询（注册属性按类型比较）');
  }

  _showStringVsTyped(): void {
    this.setState({ registeredPropsInfo:
      '===== 字符串比较 vs 类型比较 =====\n\n' +
      '【未注册属性：字符串比较】\n' +
      '  .host { --count: 5; }  /* 未注册 */\n' +
      '  @container style(--count: 5) { ... }   /* 匹配，"5" === "5" */\n' +
      '  @container style(--count: 05) { ... }  /* 不匹配，"5" !== "05" */\n' +
      '  @container style(--count: 5.0) { ... } /* 不匹配，"5" !== "5.0" */\n\n' +
      '【注册 <integer> 属性：数值比较】\n' +
      '  @property --count { syntax: "<integer>"; initial-value: 0; inherits: true; }\n' +
      '  .host { --count: 5; }\n' +
      '  @container style(--count: 5) { ... }    /* 匹配 */\n' +
      '  @container style(--count: 05) { ... }   /* 匹配，05 === 5（数值）*/\n' +
      '  @container style(--count: 5.0) { ... }  /* 不匹配，5.0 不是 <integer>（语法错误）*/\n\n' +
      '【颜色比较示例】\n' +
      '  未注册：.host { --accent: #ff0000; }\n' +
      '    @container style(--accent: red) { ... }      /* 不匹配，"#ff0000" !== "red" */\n' +
      '    @container style(--accent: #ff0000) { ... }  /* 匹配 */\n\n' +
      '  注册 <color>：@property --accent { syntax: "<color>"; ... }\n' +
      '    .host { --accent: #ff0000; }\n' +
      '    @container style(--accent: red) { ... }      /* 匹配，#ff0000 === red（颜色比较）*/\n' +
      '    @container style(--accent: rgb(255,0,0)) { ... }  /* 匹配 */\n\n' +
      '【长度比较示例】\n' +
      '  未注册：.host { --gap: 10px; }\n' +
      '    @container style(--gap: 0.625rem) { ... }  /* 不匹配，"10px" !== "0.625rem" */\n\n' +
      '  注册 <length>：@property --gap { syntax: "<length>"; ... }\n' +
      '    .host { --gap: 10px; }\n' +
      '    @container style(--gap: 0.625rem) { ... }  /* 匹配，10px === 0.625rem（1rem=16px）*/\n\n' +
      '结论：\n' +
      '  - 字符串/主题值（如 --theme: dark）→ 无需注册，字符串比较够用\n' +
      '  - 数值/长度/颜色/角度值 → 注册属性获得类型安全比较 + 可动画\n' +
      '  - 注册属性是样式查询的「进阶」用法，让查询更健壮（不依赖字符串字面量）' });
    this._addLog('compare', '已对比字符串比较 vs 类型比较');
  }

  _showStartingStyleSynergy(): void {
    this.setState({ registeredPropsInfo:
      '===== @property + @starting-style + allow-discrete 协同 =====\n\n' +
      '场景：变体切换时实现平滑动画（如 --variant 从 primary 过渡到 danger）。\n\n' +
      '【步骤 1：注册可动画的变体属性】\n' +
      '  /* 注意：syntax: "*" 通用语法不可动画；需具体类型如 <integer> <number> <color> */\n' +
      '  @property --variant-color {\n' +
      '    syntax: "<color>";\n' +
      '    initial-value: #4a90d9;\n' +
      '    inherits: true;\n' +
      '  }\n\n' +
      '【步骤 2：用注册属性定义变体颜色，并设 transition】\n' +
      '  .card {\n' +
      '    container-type: style;\n' +
      '    --variant-color: #4a90d9;  /* primary 默认 */\n' +
      '    transition: --variant-color 0.3s;  /* 注册属性可过渡！*/\n' +
      '  }\n' +
      '  .card.danger { --variant-color: #ef4444; }\n\n' +
      '  /* 变体颜色平滑过渡（0.3s 从蓝变红）*/\n' +
      '  @container style(--variant-color: #ef4444) {\n' +
      '    .button { background: #ef4444; }\n' +
      '  }\n' +
      '  /* 注意：样式查询匹配「当前值」，过渡期间值在变化，查询会「跳变」*/\n' +
      '  /* 若要过渡期间持续响应，需用 @property 注册 + transition + 样式查询的组合 */\n\n' +
      '【步骤 3：与 @starting-style 协同（元素首次出现）】\n' +
      '  .card {\n' +
      '    --variant-color: #4a90d9;\n' +
      '    transition: --variant-color 0.3s, opacity 0.3s, display 0.3s allow-discrete;\n' +
      '    @starting-style {\n' +
      '      --variant-color: #4a90d9;  /* 首次出现的起点 */\n' +
      '      opacity: 0;\n' +
      '    }\n' +
      '  }\n\n' +
      '【步骤 4：与 transition-behavior: allow-discrete 协同（display 过渡）】\n' +
      '  .card.hidden { display: none; }\n' +
      '  .card.visible {\n' +
      '    display: block;\n' +
      '    transition: display 0.3s allow-discrete, --variant-color 0.3s, opacity 0.3s;\n' +
      '    @starting-style { opacity: 0; --variant-color: #4a90d9; }\n' +
      '  }\n\n' +
      '协同要点：\n' +
      '  1. @property 注册让自定义属性可动画（关键！未注册属性不可插值）\n' +
      '  2. @starting-style 提供首次出现的过渡起点\n' +
      '  3. transition-behavior: allow-discrete 让 display 参与过渡（进入/退出）\n' +
      '  4. 样式查询响应容器属性值，配合过渡实现「状态平滑切换」\n\n' +
      '注：详见 CSSStartingStylePage 的 @starting-style / allow-discrete 卡片，本页仅展示与样式查询的协同。' });
    this._addLog('synergy', '已展示 @property + @starting-style + allow-discrete 协同');
  }

  _renderCard4(): Node | string {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. 与 @property 注册属性协同（Registered Properties）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.atProperty ? 'success' : 'error' }, caps.atProperty ? '@property ✓' : '@property ✗'),
        h(Tag, { color: caps.registerProperty ? 'success' : 'error' }, caps.registerProperty ? 'registerProperty ✓' : 'registerProperty ✗'),
        h(Tag, { color: 'primary' }, '类型安全'),
        h(Tag, { color: 'info' }, '可动画')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '@property --hue { syntax: "<angle>"; initial-value: 0deg; inherits: true; } 或 CSS.registerProperty() 注册属性，让自定义属性可被动画/过渡且类型安全。样式查询注册属性：@container style(--hue: 180deg) 查询带类型的属性。未注册属性按字符串比较（"5" !== "05"），注册后按类型比较（如 <length>、<color>、<integer>，10px === 0.625rem）。与 @starting-style、transition-behavior: allow-discrete 协同实现变体切换动画。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('@property 注册', { type: 'primary', size: 'sm', onClick: () => this._showRegisterProperty() }),
          this._btn('类型化查询', { size: 'sm', onClick: () => this._showTypedQuery() }),
          this._btn('字符串 vs 类型比较', { size: 'sm', onClick: () => this._showStringVsTyped() }),
          this._btn('与 @starting-style 协同', { size: 'sm', onClick: () => this._showStartingStyleSynergy() })),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '注册属性演示（@property --hue <angle>，CSS 已注入，真实浏览器中 box 颜色随 --hue 变化）：'),
        h('div', { class: 'csq-prop-host mt-xs' },
          h('div', { class: 'csq-prop-box' }, 'hsl(var(--hue))')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '注册属性协同说明：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.registeredPropsInfo || '（点击「@property 注册」或「类型化查询」）')),
        h(Alert, { type: 'info', message: '注册属性让样式查询类型安全 + 可动画，是进阶用法', description: '@property 注册后样式查询按类型比较（10px === 0.625rem），未注册按字符串比较。注册属性可在 transition/animation 中插值，配合 @starting-style + allow-discrete 实现变体切换动画。jsdom 不模拟渲染，演示仅展示代码片段。' }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 5：无尺寸 containment 的纯样式响应 ===================

  _showStyleContainerType(): void {
    const caps = this._caps();
    this.setState({ pureStyleInfo:
      '===== container-type: style 不建立尺寸 containment =====\n\n' +
      'container-type 取值的 containment 行为：\n\n' +
      '【inline-size】\n' +
      '  建立 inline-size containment：容器的行内尺寸（宽度）不受子内容影响\n' +
      '  即：子内容不能撑开容器的宽度（容器宽度由外部决定）\n' +
      '  影响：布局（宽度计算独立），可能触发重排\n\n' +
      '【size】\n' +
      '  建立 size containment：容器的双维度尺寸都不受子内容影响\n' +
      '  风险：若容器高度依赖子内容，会导致高度塌陷（size containment 让高度计算忽略子内容）\n\n' +
      '【style】\n' +
      '  不建立尺寸 containment！容器的尺寸仍由子内容决定（正常布局）\n' +
      '  仅建立「样式查询上下文」：允许子元素通过 @container style(...) 查询容器自定义属性\n' +
      '  关键优势：不影响布局，零布局副作用，仅用于样式响应\n\n' +
      '为何 style 不建立 containment：\n' +
      '  - 样式查询响应的是「属性值」，不需要尺寸隔离\n' +
      '  - 不建立 containment 意味着容器尺寸计算照常（子内容可撑开容器）\n' +
      '  - 因此样式查询不会触发布局重排（仅 style recalc）\n\n' +
      '对比表：\n' +
      '  container-type | 尺寸 containment | 布局影响 | 适用场景\n' +
      '  ----------------|-------------------|----------|---------------------\n' +
      '  normal         | 无                | 无       | 不作为容器\n' +
      '  inline-size    | 行内尺寸          | 有       | 尺寸查询（宽度响应）\n' +
      '  size           | 双维度            | 有（大） | 双维度尺寸查询（慎用）\n' +
      '  style          | 无                | 无       | 样式查询（主题/状态）\n\n' +
      `CSS.supports('container-type: style') = ${caps.containerTypeStyle}\n` +
      '结论：纯样式响应（主题切换）用 container-type: style，零布局副作用。' });
    this._addLog('explain', `展示 container-type: style 不建立尺寸 containment（支持=${caps.containerTypeStyle}）`);
  }

  _showThemeSwitch(): void {
    this.setState({ pureStyleInfo:
      '===== 主题切换模式（无 media query） =====\n\n' +
      '场景：组件级主题切换，无需 prefers-color-scheme 媒体查询，无需 :root 类名切换。\n\n' +
      'CSS 实现：\n' +
      '  .theme-host {\n' +
      '    container-type: style;\n' +
      '    /* 默认 light，JS 切换 --theme */\n' +
      '    --theme: light;\n' +
      '  }\n' +
      '  .theme-host.dark { --theme: dark; }\n\n' +
      '  /* 所有后代响应容器主题，无需 media query */\n' +
      '  @container style(--theme: dark) {\n' +
      '    .card { background: #1a1a1a; color: #fff; }\n' +
      '    .text { color: #ccc; }\n' +
      '    .border { border-color: #444; }\n' +
      '  }\n' +
      '  @container style(--theme: light) {\n' +
      '    .card { background: #fff; color: #333; }\n' +
      '    .text { color: #666; }\n' +
      '    .border { border-color: #ddd; }\n' +
      '  }\n\n' +
      'JS 切换：\n' +
      '  themeHost.classList.toggle("dark");\n' +
      '  // 或：themeHost.style.setProperty("--theme", "dark");\n\n' +
      '优势：\n' +
      '  1. 组件级作用域：每个 .theme-host 独立主题，互不影响\n' +
      '  2. 嵌套独立：外层 dark 内层 light 共存（嵌套组件可不同主题）\n' +
      '  3. 声明式：CSS 内 @container 块集中管理主题样式\n' +
      '  4. 无 media query：不依赖系统主题偏好，可任意切换\n' +
      '  5. 无布局副作用：container-type: style 不影响布局\n\n' +
      '嵌套主题示例：\n' +
      '  <div class="theme-host dark">        <!-- 外层 dark -->\n' +
      '    <div class="card">外层卡片（dark）</div>\n' +
      '    <div class="theme-host light">     <!-- 内层 light -->\n' +
      '      <div class="card">内层卡片（light）</div>\n' +
      '    </div>\n' +
      '  </div>\n' +
      '  外层卡片 dark，内层卡片 light —— 嵌套组件独立主题化' });
    this._addLog('pattern', '已展示主题切换模式（container-type: style 无 media query）');
  }

  _compareWithPrefersColorScheme(): void {
    this.setState({ pureStyleInfo:
      '===== 样式查询 vs prefers-color-scheme 媒体查询 =====\n\n' +
      '【prefers-color-scheme 媒体查询】\n' +
      '  @media (prefers-color-scheme: dark) {\n' +
      '    :root { --bg: #1a1a1a; --fg: #fff; }\n' +
      '    .card { background: var(--bg); color: var(--fg); }\n' +
      '  }\n' +
      '  作用域：全局级（整个 :root，影响所有元素）\n' +
      '  触发：系统主题偏好变化（用户切换 OS 暗色模式）\n' +
      '  粒度：全局（无法组件级独立主题）\n' +
      '  支持：所有现代浏览器（Chrome 76+ / Firefox 67+ / Safari 12.1+）\n\n' +
      '【样式查询 @container style(--theme)】\n' +
      '  .theme-host { container-type: style; --theme: dark; }\n' +
      '  @container style(--theme: dark) { .card { ... } }\n' +
      '  作用域：组件级（容器作用域，仅影响容器内后代）\n' +
      '  触发：容器 --theme 属性变化（JS 控制）\n' +
      '  粒度：组件级（每个容器独立主题，可嵌套不同主题）\n' +
      '  支持：Chrome 111+ / Safari 17.2+（Firefox 暂不支持）\n\n' +
      '对比表：\n' +
      '  维度          | prefers-color-scheme       | @container style(--theme)\n' +
      '  --------------|----------------------------|---------------------------\n' +
      '  作用域        | 全局（:root）              | 组件级（容器）\n' +
      '  触发方式      | 系统主题偏好               | JS 设置容器属性\n' +
      '  嵌套独立      | 不支持（全局统一）         | 支持（嵌套不同主题）\n' +
      '  用户控制      | OS 设置                    | 应用内切换\n' +
      '  性能          | 全局重算                   | 仅容器内重算\n' +
      '  浏览器支持    | 广泛                       | 较新（Chrome 111+）\n\n' +
      '选择建议：\n' +
      '  - 全站跟随系统主题 → prefers-color-scheme（全局 :root 切换）\n' +
      '  - 组件级独立主题 → 样式查询（容器作用域，可嵌套）\n' +
      '  - 组合：prefers-color-scheme 设默认主题，样式查询允许局部覆盖（如代码块始终 dark）' });
    this._addLog('compare', '已对比样式查询 vs prefers-color-scheme 媒体查询');
  }

  _compareWithRootCustomProp(): void {
    this.setState({ pureStyleInfo:
      '===== 样式查询 vs :root 自定义属性 + 类名切换 =====\n\n' +
      '【:root 自定义属性 + 类名切换（传统方案）】\n' +
      '  :root { --bg: #fff; --fg: #333; }\n' +
      '  :root.dark { --bg: #1a1a1a; --fg: #fff; }\n' +
      '  .card { background: var(--bg); color: var(--fg); }\n\n' +
      '  JS：document.documentElement.classList.toggle("dark");\n' +
      '  作用域：全局（:root，所有元素继承 --bg/--fg）\n' +
      '  优势：简单；广泛支持；var() 自动响应\n' +
      '  劣势：全局切换，无法组件级独立主题；嵌套组件无法不同主题\n\n' +
      '【样式查询（声明式组件级主题）】\n' +
      '  .theme-host { container-type: style; --theme: dark; }\n' +
      '  @container style(--theme: dark) {\n' +
      '    .card { background: #1a1a1a; color: #fff; }\n' +
      '  }\n\n' +
      '  JS：themeHost.style.setProperty("--theme", "dark");\n' +
      '  作用域：组件级（仅 .theme-host 内后代响应）\n' +
      '  优势：组件级独立；嵌套可不同主题；声明式集中管理\n' +
      '  劣势：浏览器支持较新（Chrome 111+）；需 container-type 声明\n\n' +
      '对比表：\n' +
      '  维度          | :root + 类名 + var()       | @container style()\n' +
      '  --------------|----------------------------|---------------------------\n' +
      '  作用域        | 全局（:root）              | 组件级（容器）\n' +
      '  嵌套独立      | 不支持（继承覆盖）         | 支持（容器隔离）\n' +
      '  样式定义      | 分散（var() 散落各处）     | 集中（@container 块内）\n' +
      '  触发方式      | 类名切换 :root             | 属性设置容器\n' +
      '  浏览器支持    | 广泛                       | 较新（Chrome 111+）\n' +
      '  代码量        | 少（var() 即可）           | 中（需 @container 块）\n\n' +
      '选择建议：\n' +
      '  - 简单全站主题 → :root + 类名 + var()（简单直接）\n' +
      '  - 组件库/可复用组件 → 样式查询（组件级独立，嵌套友好）\n' +
      '  - 渐进增强：基础用 :root + var()，增强用样式查询（@supports 检测）\n\n' +
      '关键区别：:root 方案是「属性继承 + var() 引用」，样式查询是「容器查询 + 集中规则块」。\n' +
      '前者分散（var() 散落），后者集中（@container 块内统一管理主题样式）。' });
    this._addLog('compare', '已对比样式查询 vs :root + 类名切换方案');
  }

  _renderCard5(): Node | string {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. 无尺寸 containment 的纯样式响应',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.containerTypeStyle ? 'success' : 'error' }, caps.containerTypeStyle ? 'container-type:style ✓' : 'container-type:style ✗'),
        h(Tag, { color: 'primary' }, '主题切换'),
        h(Tag, { color: 'warning' }, '组件级'),
        h(Tag, { color: 'info' }, '嵌套独立')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'container-type: style 不建立尺寸 containment（不影响布局），可用于「主题切换」：容器设置 --theme: dark，所有后代无需 media query 即可响应。vs prefers-color-scheme 媒体查询：样式查询是组件级（容器作用域），媒体查询是全局级。vs :root 自定义属性 + 类名切换：样式查询更声明式（@container 块集中管理），组件可独立主题化（嵌套组件可不同主题）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('container-type:style 特性', { type: 'primary', size: 'sm', onClick: () => this._showStyleContainerType() }),
          this._btn('主题切换模式', { size: 'sm', onClick: () => this._showThemeSwitch() }),
          this._btn('vs prefers-color-scheme', { size: 'sm', onClick: () => this._compareWithPrefersColorScheme() }),
          this._btn('vs :root + 类名', { size: 'sm', onClick: () => this._compareWithRootCustomProp() })),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '主题切换容器（container-type: style，需 JS 设置 --theme: dark/light 才切换）：'),
        h('div', { class: 'csq-theme-host mt-xs' },
          h('div', { class: 'csq-theme-card' },
            h('div', { class: 'csq-theme-text' }, '主题卡片（@container style(--theme: dark/light) 响应）'),
            h('div', { class: 'csq-theme-nested' }, '嵌套容器（可独立设不同主题）'))),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '纯样式响应说明：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.pureStyleInfo || '（点击「container-type:style 特性」或「主题切换模式」）')),
        h(Alert, { type: 'info', message: 'container-type: style 零布局副作用，组件级主题切换首选', description: '不建立尺寸 containment，主题切换仅 style recalc 不重排。组件级作用域让嵌套组件可独立主题化（外层 dark 内层 light 共存），优于全局 prefers-color-scheme 和 :root 类名切换。jsdom 不模拟渲染，演示仅展示代码片段。' }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 6：浏览器支持与渐进增强 ===================

  _showBrowserSupportTable(): void {
    const caps = this._caps();
    this.setState({ supportInfo:
      '===== 浏览器支持总表 =====\n\n' +
      '特性                              | Chrome  | Edge    | Safari      | Firefox     | jsdom\n' +
      '----------------------------------|---------|---------|-------------|-------------|-------\n' +
      '@container (size) 尺寸查询         | 105+    | 105+    | 16+         | 110+        | ✗\n' +
      '@container style() 样式查询        | 111+    | 111+    | 17.2+       | 暂不支持    | ✗\n' +
      'container-type: inline-size       | 105+    | 105+    | 16+         | 110+        | ✗\n' +
      'container-type: style             | 111+    | 111+    | 17.2+       | 暂不支持    | ✗\n' +
      'container-type: size              | 105+    | 105+    | 16+         | 110+        | ✗\n' +
      'container-name                    | 105+    | 105+    | 16+         | 110+        | ✗\n' +
      '@property at-rule                 | 85+     | 85+     | 16.4+       | 128+        | ✗\n' +
      'CSS.registerProperty()            | 78+     | 78+     | 16.4+       | 128+        | ✗\n\n' +
      '发布时间：\n' +
      '  Chrome 105（2022.9）：尺寸查询（container queries Level 3 部分实现）\n' +
      '  Chrome 111（2023.3）：样式查询（@container style()）\n' +
      '  Safari 16（2022.9）：尺寸查询\n' +
      '  Safari 17.2（2023.12）：样式查询\n' +
      '  Firefox 110（2023.2）：尺寸查询\n' +
      '  Firefox：截至 2024 年初未实现样式查询（about:config 可试 flag）\n\n' +
      '特性检测：\n' +
      `  CSS.supports('@container style(--x: 1)')      = ${caps.containerStyle}\n` +
      `  CSS.supports('container-type: style')         = ${caps.containerTypeStyle}\n` +
      `  CSS.supports('container-type: inline-size')   = ${caps.containerTypeInline}\n` +
      `  CSS.supports('container-name: sidebar')       = ${caps.containerName}\n` +
      `  CSS.supports('@property --x { ... }')         = ${caps.atProperty}\n` +
      `  typeof CSS.registerProperty === 'function'    = ${caps.registerProperty}\n\n` +
      '注：CSS.supports() 在 jsdom 中可能返回 false（不识别 at-rule），不代表真实浏览器不支持。' });
    this._addLog('support', `展示浏览器支持表（style=${caps.containerStyle}, atProperty=${caps.atProperty}）`);
  }

  _showFallbackStrategy(): void {
    this.setState({ supportInfo:
      '===== 降级策略（不支持样式查询时） =====\n\n' +
      '核心原则：样式查询是「增强」而非「必需」，不支持时功能仍可用，仅无组件级主题响应。\n\n' +
      '策略 1：类名 + 后代选择器（最通用回退）\n' +
      '  /* 基础样式（所有浏览器）*/\n' +
      '  .card.primary .title { color: #4a90d9; }\n' +
      '  .card.primary .button { background: #4a90d9; }\n' +
      '  .card.danger .title { color: #ef4444; }\n' +
      '  .card.danger .button { background: #ef4444; }\n\n' +
      '  /* 支持样式查询时增强（@supports 检测）*/\n' +
      '  @supports container: style(--x: 1) {\n' +
      '    .card { container-type: style; }\n' +
      '    .card.primary { --variant: primary; }\n' +
      '    .card.danger { --variant: danger; }\n' +
      '    @container style(--variant: primary) {\n' +
      '      .title { color: #4a90d9; }\n' +
      '      .button { background: #4a90d9; }\n' +
      '    }\n' +
      '    /* 隐藏基础类名样式（避免重复）*/\n' +
      '    .card.primary .title { color: revert; }\n' +
      '  }\n\n' +
      '策略 2：:has() 替代（Chrome 105+ / Safari 15.4+）\n' +
      '  /* 不支持样式查询但支持 :has() 时，用 :has() 查询后代结构 */\n' +
      '  @supports selector(:has(*)) and not (container: style(--x: 1)) {\n' +
      '    .card:has(.button.is-primary) .title { color: #4a90d9; }\n' +
      '    .card:has(.button.is-primary) .button { background: #4a90d9; }\n' +
      '  }\n' +
      '  限制：:has() 查询「存在性」而非「值」，不如样式查询灵活\n\n' +
      '策略 3：:root + 类名 + var() 全局回退\n' +
      '  /* 不支持样式查询时，用 :root 全局主题切换 */\n' +
      '  :root.dark { --card-bg: #1a1a1a; --card-fg: #fff; }\n' +
      '  .card { background: var(--card-bg, #fff); color: var(--card-fg, #333); }\n' +
      '  限制：全局切换，无法组件级独立主题\n\n' +
      '策略 4：JS 检测 + 条件逻辑\n' +
      '  if (CSS.supports("@container style(--x: 1)")) {\n' +
      '    cardEl.style.setProperty("--variant", "primary");  // 样式查询\n' +
      '  } else {\n' +
      '    cardEl.classList.add("primary");  // 类名回退\n' +
      '  }\n\n' +
      '推荐：策略 1（类名 + @supports 增强）最通用，基础功能所有浏览器可用，支持时获得组件级主题响应。' });
    this._addLog('fallback', '已展示降级策略（类名 + @supports 增强）');
  }

  _showSupportsDetection(): void {
    const caps = this._caps();
    this.setState({ supportInfo:
      '===== 特性检测方式 =====\n\n' +
      '【方式 1：CSS.supports() JS 检测】\n' +
      '  // 样式查询\n' +
      '  CSS.supports("@container style(--x: 1)")\n' +
      '  // 或\n' +
      '  CSS.supports("container: style(--x: 1)")\n' +
      `  当前结果：${caps.containerStyle}\n\n` +
      '  // container-type: style\n' +
      '  CSS.supports("container-type: style")\n' +
      `  当前结果：${caps.containerTypeStyle}\n\n` +
      '  // 尺寸查询\n' +
      '  CSS.supports("@container (min-width: 1px)")\n' +
      `  当前结果：${caps.containerSize}\n\n` +
      '  // @property\n' +
      '  CSS.supports(\'@property --x { syntax: "<length>"; inherits: false; initial-value: 0px; }\')\n' +
      `  当前结果：${caps.atProperty}\n\n` +
      '  // CSS.registerProperty\n' +
      '  typeof CSS.registerProperty === "function"\n' +
      `  当前结果：${caps.registerProperty}\n\n` +
      '【方式 2：@supports 规则 CSS 检测】\n' +
      '  @supports container: style(--x: 1) {\n' +
      '    /* 支持样式查询时生效 */\n' +
      '    .card { container-type: style; }\n' +
      '    @container style(--theme: dark) { .card { ... } }\n' +
      '  }\n' +
      '  @supports not (container: style(--x: 1)) {\n' +
      '    /* 不支持时的回退 */\n' +
      '    .card.dark { ... }\n' +
      '  }\n\n' +
      '【方式 3：组合检测（JS）】\n' +
      '  function detectContainerStyleQueries() {\n' +
      '    if (typeof CSS === "undefined" || typeof CSS.supports !== "function") return false;\n' +
      '    try {\n' +
      '      return CSS.supports("@container style(--x: 1)") ||\n' +
      '             CSS.supports("container: style(--x: 1)");\n' +
      '    } catch { return false; }\n' +
      '  }\n\n' +
      '注：CSS.supports() 对 at-rule 的支持因浏览器而异，部分旧版本可能不识别 @container 语法。\n' +
      '    container: style(--x: 1)（属性形式）比 @container style(--x: 1)（at-rule 形式）兼容性更好。\n\n' +
      '推荐：用 @supports 规则做 CSS 内联检测（渐进增强），用 CSS.supports() 做 JS 条件逻辑。' });
    this._addLog('detect', `展示特性检测方式（style=${caps.containerStyle}, containerTypeStyle=${caps.containerTypeStyle}）`);
  }

  _showSizeVsStyleRelation(): void {
    const caps = this._caps();
    this.setState({ supportInfo:
      '===== 样式查询与尺寸查询的关系 =====\n\n' +
      '历史与定位：\n' +
      '  - 容器查询（Container Queries）最初只有「尺寸查询」（Level 3 草案）\n' +
      '  - 样式查询（Style Queries）是容器查询的「扩展」，后期加入 Level 3 草案\n' +
      '  - 二者共享 container-type / container-name / @container 语法\n\n' +
      '语法对比：\n' +
      '  【尺寸查询】\n' +
      '    .host { container-type: inline-size; }\n' +
      '    @container (min-width: 300px) { .child { ... } }\n' +
      '    查询条件：尺寸（width / height）\n' +
      '    需要 container-type: inline-size 或 size（建立尺寸 containment）\n\n' +
      '  【样式查询】\n' +
      '    .host { container-type: style; }  /* 或省略，默认可查询 style */\n' +
      '    @container style(--theme: dark) { .child { ... } }\n' +
      '    查询条件：自定义属性值\n' +
      '    container-type: style（不建立尺寸 containment）\n\n' +
      '  【混合查询】\n' +
      '    .host { container-type: inline-size style; }  /* 同时声明 */\n' +
      '    @container (min-width: 300px) and style(--theme: dark) { .child { ... } }\n' +
      '    同时按尺寸和样式响应（Chrome 111+）\n\n' +
      '支持版本演进：\n' +
      '  Chrome 105（2022.9）：尺寸查询\n' +
      '  Chrome 111（2023.3）：样式查询\n' +
      '  Safari 16（2022.9）：尺寸查询\n' +
      '  Safari 17.2（2023.12）：样式查询\n' +
      '  Firefox 110（2023.2）：尺寸查询\n' +
      '  Firefox：样式查询暂不支持（截至 2024）\n\n' +
      '关系总结：\n' +
      '  - 样式查询是尺寸查询的「超集扩展」（共享语法，新增 style() 查询）\n' +
      '  - 支持样式查询的浏览器必然支持尺寸查询（前者依赖后者基础设施）\n' +
      '  - 反之不然：支持尺寸查询不一定支持样式查询（如 Firefox）\n\n' +
      `当前环境：containerSize=${caps.containerSize}, containerStyle=${caps.containerStyle}\n` +
      '（jsdom 不一定识别 at-rule，仅供参考；真实浏览器中 style=true 必然 size=true）' });
    this._addLog('relation', `展示样式查询与尺寸查询的关系（size=${caps.containerSize}, style=${caps.containerStyle}）`);
  }

  _renderCard6(): Node | string {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. 浏览器支持与渐进增强',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.containerStyle ? 'success' : 'error' }, caps.containerStyle ? 'style() ✓' : 'style() ✗'),
        h(Tag, { color: caps.containerSize ? 'success' : 'error' }, caps.containerSize ? 'size() ✓' : 'size() ✗'),
        h(Tag, { color: 'primary' }, '渐进增强'),
        h(Tag, { color: 'warning' }, 'Firefox ✗')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '@supports container: style(--x) { ... } 或 CSS.supports("@container style(--x: 1)") 检测。不支持时回退：用类名 + 普通选择器，或用 :has() 替代。各浏览器版本：Chrome 111+（2023.3）、Safari 17.2+（2023.12）、Firefox 暂不支持（截至 2024）。与 @container 尺寸查询（Chrome 105+/Safari 16+）的关系：样式查询是尺寸查询的扩展（共享语法，新增 style() 查询）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('浏览器支持表', { type: 'primary', size: 'sm', onClick: () => this._showBrowserSupportTable() }),
          this._btn('降级策略', { size: 'sm', onClick: () => this._showFallbackStrategy() }),
          this._btn('特性检测方式', { size: 'sm', onClick: () => this._showSupportsDetection() }),
          this._btn('与尺寸查询关系', { size: 'sm', onClick: () => this._showSizeVsStyleRelation() })),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '浏览器支持与渐进增强说明：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.supportInfo || '（点击「浏览器支持表」或「降级策略」）')),
        h(Alert, { type: 'warning', message: '样式查询浏览器支持较新（Chrome 111+），需渐进增强', description: '不支持时用类名 + 后代选择器回退（最通用），或 :has() 替代（查询存在性）。@supports 检测后条件加载样式查询增强。Firefox 暂不支持样式查询（截至 2024），但支持尺寸查询。jsdom 不模拟渲染，演示仅展示代码片段。' }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== 日志面板 ===================

  _renderLogPanel(): Node | string {
    const s = this.state;
    return h('div', { class: 'log-panel' },
      h('div', { class: 'log-panel__header' },
        '事件日志',
        h(Tag, { color: 'primary' }, `${s.logs.length} 条`),
      ),
      s.logs.length === 0
        ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
        : s.logs.map((log: LogEntry) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  // =================== 整页渲染 ===================

  render(): Node {
    const s = this.state;
    return h('div', { class: 'api-lab-page css-container-style-queries-page' },
      h('h2', { class: 'section-title' }, 'CSS 容器样式查询'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页演示 CSS 容器样式查询（Container Style Queries）：尺寸查询 vs 样式查询、查询自定义属性、后代样式查询、与 @property 注册属性协同、无尺寸 containment 的纯样式响应、浏览器支持与渐进增强。所有特性通过 typeof / CSS.supports 能力检测，不可用时仅记日志，绝不抛异常。jsdom 不模拟 CSS 渲染，视觉演示需在真实浏览器查看。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null as any,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderCard6(),
      this._renderLogPanel(),
    );
  }
}
