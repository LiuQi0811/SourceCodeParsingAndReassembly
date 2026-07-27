// =====================================================================
// CSSCascadeInheritanceDeepPage.js —— CSS 层叠、继承与自定义属性 深度 实验室
// 完整覆盖 CSS Cascading & Inheritance Level 4 + CSS Custom Properties
// Level 1 + CSS Houdini @property，是决定「为什么这条样式最终生效」的
// 底层规则集合，掌握后能精准调试任意 CSS 冲突、设计可维护的样式系统：
//   1. 层叠算法（Cascade Algorithm）8 个阶段
//      Origin & Importance → Context → Element-Attached → Layers →
//      Specificity → Order of Appearance → Transition/Animation → Defaulting
//   2. Specificity 选择器权重 (a, b, c)
//      a = ID 数量，b = 类/属性/伪类数量，c = 元素/伪元素数量
//      :is()/:matches() 取最大值，:where() 始终为 0,0,0
//      内联样式 = 1,0,0,0，!important 不参与 specificity 计算
//   3. 继承机制
//      可继承属性（color/font-*/text-*）沿 DOM 树向下传递
//      inherit/initial/unset/revert/revert-layer 控制继承关键字
//      all 属性同时重置所有属性
//   4. @layer Cascade Layers
//      @layer name { ... } 声明层，先声明的层优先
//      未分层样式优先级高于所有 @layer
//      @import "x.css" layer(name); 导入到指定层
//   5. CSS Custom Properties 基础
//      --name: value; 定义，var(--name) 使用
//      作用域与继承：定义在 :root 全局，定义在元素上仅子树可用
//      与 Sass/Less 预处理器变量的区别（运行时 vs 编译时）
//   6. var() 函数与 fallback
//      var(--name, fallback) fallback 语法
//      fallback 可以是另一个 var()：var(--a, var(--b, default))
//      --name: ;（空值）算"已定义"，fallback 不触发
//      var() 不能用于属性名，只能用于值
//   7. @property 注册类型化自定义属性
//      @property --name { syntax; inherits; initial-value; }
//      syntax: '<length>' | '<color>' | '<number>' | '<percentage>' | '<angle>' | '<time>' | '<resolution>' | '<url>' | '*'
//      注册后可动画化（未注册变量不可平滑动画）
//      JS 注册：CSS.registerProperty({ name, syntax, inherits, initialValue })
//   8. 实战模式与调试技巧
//      主题切换、组件设计系统、动态计算、类型化变量动画
//      @layer 组织大型项目、:where() 零权重重置、all: unset 重置第三方样式
//      getComputedStyle / setProperty / CSS.supports 调试技巧
// 说明：jsdom 不做真实布局，但 CSS.supports 可探测属性/选择器支持；
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

interface CSSCascadeInheritanceDeepPageCaps {
  css: boolean;
  supports: boolean;
  customProperty: boolean;
  varFunction: boolean;
  inherit: boolean;
  initial: boolean;
  unset: boolean;
  revert: boolean;
  revertLayer: boolean;
  all: boolean;
  atLayer: boolean;
  atProperty: boolean;
  where: boolean;
  is: boolean;
}

export interface CSSCascadeInheritanceDeepPageProps extends Props {}

export interface CSSCascadeInheritanceDeepPageState extends State {
  logs: LogEntry[];
  capsSummary: string;
  cascadeInfo: string;
  specificityInfo: string;
  inheritanceInfo: string;
  layerInfo: string;
  customPropInfo: string;
  varFnInfo: string;
  propertyInfo: string;
  patternInfo: string;
}

export class CSSCascadeInheritanceDeepPage extends Page {
  declare props: CSSCascadeInheritanceDeepPageProps;
  declare state: CSSCascadeInheritanceDeepPageState;

  _inited: boolean = false;
  declare _destroyed: boolean;
  _dynamicStyles!: any[];


  initialState(): CSSCascadeInheritanceDeepPageState {
    return {
      logs: [],
      capsSummary: '',
      cascadeInfo: '',         // Card 1：层叠算法 8 阶段
      specificityInfo: '',     // Card 2：选择器权重计算
      inheritanceInfo: '',     // Card 3：继承机制
      layerInfo: '',           // Card 4：@layer Cascade Layers
      customPropInfo: '',      // Card 5：CSS 变量基础
      varFnInfo: '',           // Card 6：var() 与 fallback
      propertyInfo: '',        // Card 7：@property 注册
      patternInfo: '',         // Card 8：实战模式与调试
    };
  }

  componentDidMount(): void {
    if (this._inited) return;
    this._inited = true;

    this._dynamicStyles = [];

    const f = this._flags();
    const c = (ok: boolean) => ok ? '✓' : '✗';
    const parts = [
      `--var ${c(f.customProperty)}`,
      `var() ${c(f.varFunction)}`,
      `inherit ${c(f.inherit)}`,
      `initial ${c(f.initial)}`,
      `unset ${c(f.unset)}`,
      `revert ${c(f.revert)}`,
      `revert-layer ${c(f.revertLayer)}`,
      `all ${c(f.all)}`,
      `@layer ${c(f.atLayer)}`,
      `@property ${c(f.atProperty)}`,
      `:where() ${c(f.where)}`,
      `:is() ${c(f.is)}`,
    ];

    const summary = f.css
      ? `CSS Cascade & Inheritance & Custom Properties 能力检测：${parts.join(' · ')}。jsdom 不做真实布局，但 CSS.supports 可探测属性支持；按钮点击注入演示样式 + 完整代码示例，真实浏览器可查看效果。`
      : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击仅记日志说明，不会抛异常。';

    this.setState({ capsSummary: summary });
    this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.atLayer) this._addLog('warn', '@layer 不可用（Chrome 99+/Firefox 97+/Safari 15.4+）');
    if (!f.atProperty) this._addLog('warn', '@property 不可用（Chrome 85+/Firefox 128+/Safari 16.4+）');
    if (!f.revertLayer) this._addLog('warn', 'revert-layer 不可用（需 @layer 支持）');

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
    style.textContent = css;
    document.head.appendChild(style);
    this._dynamicStyles.push(style);
  }

  _injectBaseStyles(): void {
    this._injectStyle('css-cascade-base', `
      .ci-demo { padding: 14px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; margin-top: 10px; }
      .ci-origin-row { display: grid; grid-template-columns: 140px 1fr 1fr 1fr; gap: 4px; margin-top: 8px; font-size: 11px; }
      .ci-origin-row > div { padding: 6px 8px; border-radius: 4px; border: 1px solid #cbd5e1; background: #fff; }
      .ci-origin-row > div.ci-head { background: #1e293b; color: #fff; font-weight: 700; }
      .ci-origin-row > div.ci-win { background: #d1fae5; border-color: #10b981; font-weight: 700; }
      .ci-stage-list { counter-reset: stage; list-style: none; padding: 0; margin: 8px 0 0; }
      .ci-stage-list li {
        counter-increment: stage;
        padding: 6px 10px 6px 36px;
        position: relative;
        background: #f1f5f9;
        border-left: 3px solid #3b82f6;
        margin-bottom: 4px;
        border-radius: 0 4px 4px 0;
        font-size: 12px;
      }
      .ci-stage-list li::before {
        content: counter(stage);
        position: absolute;
        left: 8px; top: 50%;
        transform: translateY(-50%);
        width: 20px; height: 20px;
        background: #3b82f6; color: #fff;
        border-radius: 50%;
        text-align: center;
        line-height: 20px;
        font-size: 11px;
        font-weight: 700;
      }
      .ci-spec-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
      .ci-spec-table th, .ci-spec-table td { border: 1px solid #cbd5e1; padding: 4px 8px; text-align: left; }
      .ci-spec-table th { background: #1e293b; color: #fff; }
      .ci-spec-table tr:nth-child(even) td { background: #f8fafc; }
      .ci-inherit-box { padding: 10px; border: 2px dashed #6366f1; border-radius: 6px; margin-top: 8px; }
      .ci-inherit-child { padding: 8px; background: #e0e7ff; border-radius: 4px; margin-top: 6px; font-size: 12px; }
      .ci-layer-stack { display: flex; flex-direction: column-reverse; gap: 4px; margin-top: 8px; }
      .ci-layer-row { padding: 8px 12px; border-radius: 4px; font-size: 12px; color: #fff; font-weight: 600; }
      .ci-layer-row.ci-l1 { background: #1e40af; }
      .ci-layer-row.ci-l2 { background: #2563eb; }
      .ci-layer-row.ci-l3 { background: #3b82f6; }
      .ci-layer-row.ci-l4 { background: #60a5fa; color: #1e293b; }
      .ci-layer-row.ci-unlayered { background: #ef4444; }
      .ci-var-demo { padding: 12px; background: linear-gradient(135deg, #ddd6fe, #c4b5fd); border-radius: 6px; margin-top: 8px; color: #4c1d95; font-weight: 600; }
      .ci-prop-anim {
        height: 30px;
        background: linear-gradient(90deg, var(--ci-grad-start, #ef4444), var(--ci-grad-end, #3b82f6));
        border-radius: 4px;
        margin-top: 8px;
      }
    `);
  }

  _flags(): CSSCascadeInheritanceDeepPageCaps {
    const hasCSS = typeof CSS !== 'undefined';
    const supportsPV = (p: any,v: any) => {
      try { return hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v); }
      catch { return false; }
    };
    const supportsSel = (sel: any) => {
      try { return hasCSS && typeof CSS.supports === 'function' && CSS.supports(`selector(${sel})`); }
      catch { return false; }
    };
    return {
      css: hasCSS,
      supports: hasCSS && typeof CSS.supports === 'function',
      customProperty: supportsPV('--x', 'red'),
      varFunction: supportsPV('color', 'var(--x)'),
      inherit: supportsPV('color', 'inherit'),
      initial: supportsPV('color', 'initial'),
      unset: supportsPV('color', 'unset'),
      revert: supportsPV('color', 'revert'),
      revertLayer: supportsPV('color', 'revert-layer'),
      all: supportsPV('all', 'unset'),
      atLayer: supportsPV('@layer', 'x'),
      atProperty: supportsPV('@property', '--x'),
      where: supportsSel(':where(.x)'),
      is: supportsSel(':is(.x)'),
    };
  }

  // ===================== Card 1：层叠算法 8 阶段详解 =====================

  _runCascadeDemo(): void {
    const f = this._flags();
    const info = [
      '===== CSS 层叠算法（Cascade Algorithm）8 阶段详解 =====',
      '',
      '【动机】',
      '  当多条 CSS 规则同时作用于同一元素的同一属性时，浏览器需要一套',
      '  确定性的算法决定最终生效值。这套算法分 8 个阶段，按优先级从高到低，',
      '  前面阶段胜出者直接采用，不再看后续阶段。',
      '',
      '【8 个阶段（按优先级从高到低）】',
      '  1. Origin & Importance（来源与重要性）',
      '     - Author（开发者样式表）',
      '     - User（用户样式表，浏览器设置中的自定义）',
      '     - User Agent（浏览器默认样式表）',
      '     - !important 反转优先级：',
      '       User Agent !important > User !important > Author !important',
      '       > Author > User > User Agent',
      '',
      '  2. Context（上下文：Shadow DOM 隔离）',
      '     - Shadow DOM 内的样式不会泄漏到外部',
      '     - 外部样式也不会进入 Shadow DOM（除了可继承属性）',
      '     - 不同 Shadow Tree 之间互相隔离',
      '',
      '  3. Element-Attached Styles（元素附加样式：style 属性）',
      '     - <div style="color: red">',
      '     - 等同 1,0,0,0 的 specificity，比任何选择器都高',
      '     - 但仍受 Origin & Importance 限制（!important 仍可覆盖）',
      '     - svg presentation attributes 优先级最低（低于任何 CSS 规则）',
      '',
      '  4. Cascade Layers（@layer）',
      '     - 先声明的层优先级越高',
      '     - 未分层样式优先级高于所有 @layer（视为最后的匿名层）',
      '     - 详见 Card 4',
      '',
      '  5. Specificity（选择器权重）',
      '     - 三段式 (a, b, c)：ID/类属性伪类/元素伪元素',
      '     - 详见 Card 2',
      '',
      '  6. Order of Appearance（出现顺序）',
      '     - 同 origin、同 layer、同 specificity 时，后出现的胜出',
      '     - 后出现的 <style> 或 <link> 覆盖前者',
      '     - 注意：@import 的样式视为在 @import 出现的位置',
      '',
      '  7. Transition / Animation（过渡与动画）',
      '     - 正在运行的 animation 优先级最高（除 !important 规则）',
      '     - transition 仅在属性变化时临时胜出',
      '     - animation-fill-mode 也会影响最终值',
      '',
      '  8. Defaulting（默认值）',
      '     - 无任何规则匹配时，使用默认值',
      '     - inherit / initial / unset / revert / revert-layer 控制',
      '     - 详见 Card 3',
      '',
      '【完整优先级矩阵：Origin & Importance】',
      '  ┌──────────────────────┬─────────────────────────────┐',
      '  │ 优先级（高→低）      │ 来源                        │',
      '  ├──────────────────────┼─────────────────────────────┤',
      '  │ 1 (最高)             │ User Agent !important       │',
      '  │ 2                    │ User !important             │',
      '  │ 3                    │ Author !important           │',
      '  │ 4                    │ Author animation            │',
      '  │ 5                    │ Author inline (style)       │',
      '  │ 6                    │ Author @layer（按声明顺序） │',
      '  │ 7                    │ Author normal（未分层）     │',
      '  │ 8                    │ User normal                 │',
      '  │ 9                    │ User Agent normal           │',
      '  │ 10 (最低)            │ Defaulting（initial）       │',
      '  └──────────────────────┴─────────────────────────────┘',
      '',
      '【典型冲突示例】',
      '  /* Author normal */',
      '  .btn { color: blue; }',
      '',
      '  /* Author !important */',
      '  .btn { color: red !important; }',
      '',
      '  /* 内联样式 */',
      '  <button class="btn" style="color: green">按钮</button>',
      '',
      '  /* 最终：red !important 胜出',
      '     因为 !important 阶段优先于 Element-Attached 阶段 */',
      '',
      '【Origin 类型详解】',
      '  Author（开发者）：',
      '    - <style> 标签内的 CSS',
      '    - <link rel="stylesheet"> 引入的 CSS',
      '    - element.style 内联样式',
      '    - JS 设置 el.style.cssText / setProperty',
      '',
      '  User（用户）：',
      '    - 浏览器设置中的自定义样式（如 Chrome 的"自定义字体"）',
      '    - 浏览器扩展注入的 user 样式表',
      '    - 一般优先级低于 Author，但 !important 高于 Author !important',
      '',
      '  User Agent（浏览器默认）：',
      '    - 浏览器内置默认样式（如 <h1> 字体大、<a> 蓝色下划线）',
      '    - 优先级最低，但 !important 最高（如 :visited 隐私保护）',
      '',
      '【调试技巧】',
      '  Chrome DevTools → Elements → Styles 面板',
      '    - 按优先级从高到低显示所有规则',
      '    - 被覆盖的属性显示删除线',
      '    - 显示规则来源（author / user-agent / inline）',
      '    - 鼠标悬浮显示 specificity 值',
      '',
      '【浏览器支持】',
      `  inherit: ${f.inherit ? '✓' : '✗'}`,
      `  initial: ${f.initial ? '✓' : '✗'}`,
      `  unset: ${f.unset ? '✓' : '✗'}`,
      `  revert: ${f.revert ? '✓' : '✗'}`,
      `  revert-layer: ${f.revertLayer ? '✓' : '✗'}`,
      `  all: ${f.all ? '✓' : '✗'}`,
      '',
      '【规范】',
      '  CSS Cascading and Inheritance Level 4',
      '  https://www.w3.org/TR/css-cascade-4/',
      '  新增 revert-layer（Level 5）',
    ].join('\n');
    this.setState({ cascadeInfo: info });
    this._addLog('css', `层叠算法 8 阶段演示完成；inherit=${f.inherit}/unset=${f.unset}/revert=${f.revert}`);
  }

  _renderCard1(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. 层叠算法（Cascade Algorithm）—— 8 阶段优先级详解',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['inherit', f.inherit],
          ['initial', f.initial],
          ['unset', f.unset],
          ['revert', f.revert],
        ]),
        h(Tag, { color: 'primary' }, 'Cascade L4'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'CSS 层叠算法 8 个阶段按优先级从高到低：Origin & Importance（!important 反转优先级）→ Context（Shadow DOM 隔离）→ Element-Attached（style 属性）→ Layers（@layer）→ Specificity（选择器权重）→ Order of Appearance（出现顺序）→ Transition/Animation → Defaulting。前三阶段决定来源，后五阶段在同来源内进一步裁决。掌握后能精准预测任意 CSS 冲突的胜出规则。',
        ),
        h('div', { class: 'ci-demo' },
          h('div', { class: 'fs-sm text-secondary' }, 'Origin & Importance 优先级矩阵（高→低）：'),
          h('div', { class: 'ci-origin-row' },
            h('div', { class: 'ci-head' }, '优先级'),
            h('div', { class: 'ci-head' }, '来源'),
            h('div', { class: 'ci-head' }, '示例'),
            h('div', { class: 'ci-head' }, '说明'),
            h('div', {}, '1 (最高)'),
            h('div', {}, 'User Agent !important'),
            h('div', {}, ':visited 隐私'),
            h('div', {}, '浏览器强制'),
            h('div', {}, '2'),
            h('div', {}, 'User !important'),
            h('div', {}, '用户样式 !important'),
            h('div', {}, '扩展覆盖'),
            h('div', {}, '3'),
            h('div', {}, 'Author !important'),
            h('div', {}, '.x { !important }'),
            h('div', {}, '开发者强制'),
            h('div', {}, '4'),
            h('div', {}, 'Author animation'),
            h('div', {}, '@keyframes'),
            h('div', {}, '运行动画'),
            h('div', {}, '5'),
            h('div', {}, 'Author inline'),
            h('div', {}, 'style="..."'),
            h('div', {}, '1,0,0,0 权重'),
            h('div', {}, '6'),
            h('div', {}, 'Author @layer'),
            h('div', {}, '@layer x { }'),
            h('div', {}, '按层顺序'),
            h('div', {}, '7'),
            h('div', {}, 'Author normal'),
            h('div', {}, '.x { }'),
            h('div', {}, '未分层样式'),
            h('div', {}, '8'),
            h('div', {}, 'User normal'),
            h('div', {}, '用户设置'),
            h('div', {}, '一般低于开发者'),
            h('div', {}, '9'),
            h('div', {}, 'User Agent'),
            h('div', {}, '默认 h1/a'),
            h('div', {}, '浏览器默认'),
            h('div', {}, '10 (最低)'),
            h('div', {}, 'Defaulting'),
            h('div', {}, 'initial'),
            h('div', {}, '无规则匹配'),
          ),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('运行层叠算法演示', { type: 'primary', size: 'sm', onClick: () => this._runCascadeDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.cascadeInfo || '（点击按钮查看层叠算法 8 阶段完整解析）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 2：Specificity 选择器权重计算 =====================

  _runSpecificityDemo(): void {
    const f = this._flags();
    const info = [
      '===== Specificity 选择器权重计算 =====',
      '',
      '【三段式 (a, b, c)】',
      '  a: ID 选择器数量（#id）',
      '  b: 类 / 属性 / 伪类数量（.class / [attr] / :hover）',
      '  c: 元素 / 伪元素数量（div / ::before）',
      '',
      '  比较规则：从左到右逐段比较，a 大者胜；a 相同比 b；b 相同比 c',
      '  全部相同则进入 Order of Appearance（后出现的胜出）',
      '',
      '【不计入 specificity 的语法】',
      '  - 通配符 *：specificity = (0,0,0)',
      '  - 组合器 > + ~（子/相邻兄弟/一般兄弟）：不计',
      '  - :not() 本身不计，但括号内参数计',
      '  - :where() 始终为 (0,0,0)（设计为零权重）',
      '',
      '【:is() / :matches() / :where() 的 specificity 规则】',
      '  :is(.a, #b, .c)      // 取参数中最大 specificity = (1,0,0)',
      '  :matches(.a, #b)     // 同 :is()，已重命名为 :is()',
      '  :where(.a, #b, .c)   // 始终为 (0,0,0)，设计为零权重',
      '',
      '  应用：',
      '    /* 用 :where 写基础样式，子组件可轻易覆盖 */',
      '    :where(.card) .title { font-size: 16px; }    /* (0,0,1) */',
      '    .my-card .title { font-size: 20px; }          /* (0,2,0) 胜出 */',
      '',
      '【内联样式 style="..."】',
      '  - 等同 (1,0,0,0)（在 (a,b,c) 之外再加一段）',
      '  - 比任何选择器都高（除 !important）',
      '  - element.style.setProperty 也算内联样式',
      '',
      '【!important 与 specificity】',
      '  - !important 不参与 specificity 计算',
      '  - 而是在 Origin & Importance 阶段优先裁决',
      '  - 同为 !important 时再按 specificity 比较',
      '',
      '【计算示例】',
      '  *                            -> (0,0,0)',
      '  div                          -> (0,0,1)',
      '  ul li                        -> (0,0,2)',
      '  ul ol+li                     -> (0,0,3)',
      '  h1 + *[rel=up]               -> (0,1,1)',
      '  ul ol li.red                 -> (0,1,3)',
      '  li.red.level                 -> (0,2,1)',
      '  #x34y                        -> (1,0,0)',
      '  #s12:not(FOO)                -> (1,0,1)  // :not 不计，FOO 计',
      '  .foo :is(.bar, #baz)         -> (1,1,0)  // :is 取最大 #baz',
      '  .foo :where(.bar, #baz)      -> (0,1,0)  // :where 始终 0',
      '  #nav .item:hover a           -> (1,2,1)',
      '  #nav .item:hover a::before   -> (1,2,2)',
      '  div#a.b.c                    -> (1,2,1)',
      '  [type="text"]:focus          -> (0,2,0)',
      '  :nth-child(2n+1)             -> (0,1,1)',
      '  ::slotted(.item)             -> (0,1,0)  // Shadow DOM',
      '',
      '【完整对比表】',
      '  ┌────────────────────────────┬──────────────┐',
      '  │ 选择器                     │ Specificity  │',
      '  ├────────────────────────────┼──────────────┤',
      '  │ *                          │ (0,0,0)      │',
      '  │ li                         │ (0,0,1)      │',
      '  │ ul li                      │ (0,0,2)      │',
      '  │ ul ol+li                   │ (0,0,3)      │',
      '  │ h1 + *[rel=up]             │ (0,1,1)      │',
      '  │ ul ol li.red               │ (0,1,3)      │',
      '  │ li.red.level               │ (0,2,1)      │',
      '  │ #x34y                      │ (1,0,0)      │',
      '  │ #s12:not(FOO)              │ (1,0,1)      │',
      '  │ .foo :is(.bar, #baz)       │ (1,1,0)      │',
      '  │ .foo :where(.bar, #baz)    │ (0,1,0)      │',
      '  │ #nav .item:hover a         │ (1,2,1)      │',
      '  │ style="color:red"          │ (1,0,0,0)    │',
      '  └────────────────────────────┴──────────────┘',
      '',
      '【实战陷阱：避免 specificity 战争】',
      '  ❌ 反模式：层层叠加 ID 提升权重',
      '     #nav #menu .item { ... }   /* (2,1,0) */',
      '     #nav #menu #wrap .item { ... } /* (3,1,0) 覆盖前者 */',
      '',
      '  ✅ 正确做法：用 @layer 或 :where() 控制权重',
      '     @layer base { #nav .item { ... } }',
      '     .my-item { ... }  /* 未分层，自动覆盖 @layer */',
      '',
      '【调试技巧】',
      '  Chrome DevTools → Elements → Styles',
      '    - 每条规则左侧显示 specificity（如 0,1,2）',
      '    - 鼠标悬浮选择器可查看分解',
      '  JS 计算：',
      '    // 没有原生 API 直接获取 specificity',
      '    // 可用第三方库 specifity（npm i specificity）',
      '    import { calculate } from "specificity";',
      '    calculate("#nav .item:hover a"); // → "1,2,1"',
      '',
      '【浏览器支持】',
      `  :is(): ${f.is ? '✓' : '✗'} (Chrome 88+/Firefox 78+/Safari 14+)`,
      `  :where(): ${f.where ? '✓' : '✗'} (Chrome 88+/Firefox 78+/Safari 14+)`,
      '',
      '【规范】',
      '  CSS Selectors Level 4',
      '  https://www.w3.org/TR/selectors-4/#specificity-rules',
    ].join('\n');
    this.setState({ specificityInfo: info });
    this._addLog('css', `Specificity 演示完成；:is=${f.is}/:where=${f.where}`);
  }

  _renderCard2(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. Specificity —— 选择器权重 (a, b, c) 计算',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          [':is()', f.is],
          [':where()', f.where],
        ]),
        h(Tag, { color: 'primary' }, '权重'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Specificity 三段式 (a, b, c)：a = ID 选择器数量，b = 类/属性/伪类数量，c = 元素/伪元素数量。通配符 *、组合器 > + ~、:not() 本身不计，但括号内参数计。:is()/:matches() 取参数中最大 specificity，:where() 始终为 (0,0,0)（设计为零权重）。内联样式 = (1,0,0,0) 比任何选择器都高。!important 不参与 specificity 计算，而是在 Origin & Importance 阶段裁决。',
        ),
        h('div', { class: 'ci-demo' },
          h('table', { class: 'ci-spec-table' },
            h('thead', {},
              h('tr', {},
                h('th', {}, '选择器'),
                h('th', {}, 'a (ID)'),
                h('th', {}, 'b (类/属性/伪类)'),
                h('th', {}, 'c (元素/伪元素)'),
                h('th', {}, '总和'),
              ),
            ),
            h('tbody', {},
              h('tr', {}, h('td', {}, '*'), h('td', {}, '0'), h('td', {}, '0'), h('td', {}, '0'), h('td', {}, '0,0,0')),
              h('tr', {}, h('td', {}, 'div'), h('td', {}, '0'), h('td', {}, '0'), h('td', {}, '1'), h('td', {}, '0,0,1')),
              h('tr', {}, h('td', {}, '.item'), h('td', {}, '0'), h('td', {}, '1'), h('td', {}, '0'), h('td', {}, '0,1,0')),
              h('tr', {}, h('td', {}, '#nav'), h('td', {}, '1'), h('td', {}, '0'), h('td', {}, '0'), h('td', {}, '1,0,0')),
              h('tr', {}, h('td', {}, '#nav .item:hover a'), h('td', {}, '1'), h('td', {}, '2'), h('td', {}, '1'), h('td', {}, '1,2,1')),
              h('tr', {}, h('td', {}, ':where(.a, #b)'), h('td', {}, '0'), h('td', {}, '0'), h('td', {}, '0'), h('td', {}, '0,0,0')),
              h('tr', {}, h('td', {}, ':is(.a, #b)'), h('td', {}, '1'), h('td', {}, '0'), h('td', {}, '0'), h('td', {}, '1,0,0')),
              h('tr', {}, h('td', {}, 'style="..."'), h('td', {}, '1'), h('td', {}, '0'), h('td', {}, '0'), h('td', {}, '1,0,0,0')),
            ),
          ),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('运行 Specificity 演示', { type: 'primary', size: 'sm', onClick: () => this._runSpecificityDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.specificityInfo || '（点击按钮查看 Specificity 完整计算规则）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 3：继承（Inheritance）机制 =====================

  _runInheritanceDemo(): void {
    const f = this._flags();
    this._injectStyle('ci-inheritance-demo', `
      .ci-inh-parent {
        color: #1e40af;
        font-family: 'Courier New', monospace;
        font-size: 14px;
        line-height: 1.6;
        letter-spacing: 0.5px;
        border: 2px solid #6366f1;
        padding: 10px;
        border-radius: 6px;
      }
      .ci-inh-child-a {
        /* 不写 color/font-*，自动继承父元素 */
        background: #e0e7ff;
        padding: 6px;
        margin-top: 6px;
        border-radius: 4px;
      }
      .ci-inh-child-b {
        color: initial;       /* 重置为规范初始值 black */
        font-family: unset;   /* unset：可继承属性等同 inherit */
        background: #fef3c7;
        padding: 6px;
        margin-top: 6px;
        border-radius: 4px;
      }
      .ci-inh-child-c {
        color: revert;        /* 回退到浏览器默认（user-agent） */
        all: revert;          /* 全部回退到默认 */
        background: #fee2e2;
        padding: 6px;
        margin-top: 6px;
        border-radius: 4px;
      }
    `);
    const info = [
      '===== 继承（Inheritance）机制 =====',
      '',
      '【动机】',
      '  继承让父元素的某些属性自动传递给所有后代，避免每个元素重复声明。',
      '  比如设置 body 的 color，整个文档所有文字默认就是这个颜色。',
      '',
      '【可继承属性（Inherited Properties）】',
      '  文本相关：',
      '    color / font-family / font-size / font-weight / font-style',
      '    font-variant / font-stretch / line-height / letter-spacing',
      '    word-spacing / white-space / text-align / text-indent',
      '    text-transform / text-shadow / text-decoration-skip',
      '    direction / writing-mode / text-orientation / unicode-bidi',
      '    hyphens / tab-size / quotes / hanging-punctuation',
      '',
      '  列表与表格：',
      '    list-style / list-style-type / list-style-position / list-style-image',
      '    border-collapse / border-spacing / empty-cells / caption-side',
      '',
      '  其他：',
      '    visibility / cursor / pointer-events / caret-color',
      '    outline / outline-color / outline-style / outline-width',
      '    border-image-source / border-image-slice / etc',
      '    aspect-ratio / mix-blend-mode / isolation',
      '    image-rendering / page-break-* / column-count / etc',
      '',
      '【不可继承属性（Non-Inherited Properties）】',
      '  盒模型：',
      '    margin / margin-top / ... / padding / padding-top / ...',
      '    border / border-width / border-color / border-style',
      '    width / height / min-width / max-width / min-height / max-height',
      '    box-sizing / box-shadow / box-decoration-break',
      '',
      '  布局与定位：',
      '    display / position / top / right / bottom / left / z-index',
      '    float / clear / overflow / overflow-x / overflow-y',
      '    flex / flex-direction / flex-wrap / justify-content / align-items',
      '    grid / grid-template-* / grid-area / grid-gap',
      '    columns / column-width / column-gap',
      '',
      '  背景与装饰：',
      '    background / background-color / background-image',
      '    background-size / background-position / background-repeat',
      '    opacity / filter / transform / transition / animation',
      '',
      '【继承方向】',
      '  - 从父元素到子元素（沿 DOM 树向下）',
      '  - 不会向上继承（父不会受子影响）',
      '  - 兄弟元素之间不互相继承',
      '  - Shadow DOM 边界：宿主的可继承属性会进入 Shadow Tree',
      '',
      '【控制继承的关键字】',
      '  inherit：强制继承父元素值（即使默认不继承的属性也可用）',
      '    .box { border: inherit; }    /* 强制继承父的 border */',
      '',
      '  initial：重置为 CSS 规范定义的初始值',
      '    .x { color: initial; }       /* → black */',
      '    .y { display: initial; }     /* → inline */',
      '',
      '  unset：可继承属性等同 inherit，不可继承属性等同 initial',
      '    .box { color: unset; }       /* color 可继承 → inherit */',
      '    .box { border: unset; }      /* border 不可继承 → initial */',
      '    // 适合「重置但保留继承语义」场景',
      '',
      '  revert：回退到浏览器默认样式（User Agent 样式表）',
      '    .x { color: revert; }        /* 不是 initial，而是 UA 默认 */',
      '    h1 { font-size: revert; }    /* 恢复 h1 默认大字号 */',
      '',
      '  revert-layer：回退到上一级 @layer 的值（CSS Cascade Layers）',
      '    @layer base { .x { color: blue; } }',
      '    @layer app { .x { color: revert-layer; } }  /* → blue */',
      '',
      '【all 属性：同时重置所有属性（除 direction 和 unicode-bidi）】',
      '  .reset { all: unset; }       /* 所有属性 unset */',
      '  .reset { all: initial; }     /* 所有属性 initial */',
      '  .reset { all: revert; }      /* 所有属性 revert 到 UA */',
      '  .reset { all: revert-layer; } /* 所有属性 revert-layer */',
      '',
      '  应用场景：',
      '    - 重置第三方组件样式（all: unset 后重新自定义）',
      '    - 微内容隔离（如富文本编辑器中的内容块）',
      '    - Web Components 中重置宿主样式',
      '',
      '【应用场景】',
      '  1. 重置组件样式：all: unset 后重新定义',
      '  2. 暗黑模式切换：:root 设置 color，子树自动继承',
      '  3. 嵌套组件隔离：用 inherit 强制传递所需属性',
      '  4. 第三方库覆盖：revert 回退到默认再覆盖',
      '',
      '【继承陷阱】',
      '  - 在根元素设大量可继承属性会导致整树重新计算（性能问题）',
      '  - font-size 用 em 单位会叠加继承（父 1.2em + 子 1.2em = 1.44em）',
      '  - color: inherit 在 :root 上无意义（无父可继承）',
      '',
      '【调试技巧】',
      '  Chrome DevTools → Elements → Computed 面板',
      '    - 每个属性旁有「继承自 xxx」提示',
      '    - 折叠/展开查看继承链',
      '  console.log(getComputedStyle(el).color)',
      '',
      '【浏览器支持】',
      `  inherit: ${f.inherit ? '✓' : '✗'}`,
      `  initial: ${f.initial ? '✓' : '✗'}`,
      `  unset: ${f.unset ? '✓' : '✗'}`,
      `  revert: ${f.revert ? '✓' : '✗'} (Chrome 84+/Firefox 67+/Safari 9.1+)`,
      `  revert-layer: ${f.revertLayer ? '✓' : '✗'} (需 @layer 支持)`,
      `  all: ${f.all ? '✓' : '✗'}`,
    ].join('\n');
    this.setState({ inheritanceInfo: info });
    this._addLog('css', `继承机制演示完成；inherit=${f.inherit}/unset=${f.unset}/revert=${f.revert}`);
  }

  _renderCard3(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. 继承（Inheritance）机制 —— 沿 DOM 树向下传递',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['inherit', f.inherit],
          ['initial', f.initial],
          ['unset', f.unset],
          ['revert', f.revert],
          ['revert-layer', f.revertLayer],
          ['all', f.all],
        ]),
        h(Tag, { color: 'primary' }, '继承'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '继承让父元素的可继承属性（color/font-*/text-*/line-height/visibility/cursor/list-style/direction 等）自动传递给所有后代。不可继承属性（border/margin/padding/width/height/background/display/position 等）则不会传递。控制继承的关键字：inherit 强制继承 / initial 重置为规范初始值 / unset 可继承属性等同 inherit 不可继承等同 initial / revert 回退到 UA 默认 / revert-layer 回退到上一级 @layer。all 属性可同时重置所有属性。',
        ),
        h('div', { class: 'ci-demo' },
          h('div', { class: 'ci-inh-parent' },
            h('div', {}, '父元素（color: #1e40af, font-family: monospace, font-size: 14px）'),
            h('div', { class: 'ci-inh-child-a' }, '子元素 A：未设 color/font，自动继承父元素'),
            h('div', { class: 'ci-inh-child-b' }, '子元素 B：color: initial（→black）/ font-family: unset'),
            h('div', { class: 'ci-inh-child-c' }, '子元素 C：all: revert 全部回退到 UA 默认'),
          ),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('运行继承演示', { type: 'primary', size: 'sm', onClick: () => this._runInheritanceDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.inheritanceInfo || '（点击按钮查看继承机制完整解析）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 4：@layer Cascade Layers =====================

  _runLayerDemo(): void {
    const f = this._flags();
    this._injectStyle('ci-layer-demo', `
      @layer ci-base, ci-components, ci-utilities;

      @layer ci-base {
        .ci-layer-card {
          background: #f1f5f9 !important;
          padding: 10px !important;
          border-radius: 4px !important;
        }
      }

      @layer ci-components {
        .ci-layer-card {
          background: #dbeafe;
          padding: 16px;
          border-radius: 8px;
          color: #1e3a8a;
        }
      }

      @layer ci-utilities {
        .ci-layer-card {
          background: #bfdbfe;       /* 此层优先级最低，但 ci-utilities 在 ci-components 之后 */
          padding: 20px;
        }
      }

      /* 未分层样式优先级最高 */
      .ci-layer-card {
        background: #fef3c7;
        border: 2px solid #f59e0b;
      }
    `);
    const info = [
      '===== @layer Cascade Layers 级联层 =====',
      '',
      '【动机】',
      '  传统 CSS 通过 specificity 战争决定优先级，难以维护。',
      '  @layer 让开发者显式声明「层」，按层顺序决定优先级，',
      '  无需靠 ID 选择器或 !important 提升权重。',
      '',
      '【语法】',
      '  /* 1. 声明层顺序（仅声明，不写规则）*/',
      '  @layer name1, name2, name3;',
      '  /* 先声明的层优先级越高 */',
      '',
      '  /* 2. 在层内写规则 */',
      '  @layer name {',
      '    .x { color: red; }',
      '  }',
      '',
      '  /* 3. 也可直接同时声明并写规则 */',
      '  @layer name {',
      '    .x { ... }',
      '  }',
      '',
      '【层的优先级规则】',
      '  - 先声明的层优先级越高',
      '  - 未分层的样式优先级高于所有 @layer（视为最后的匿名层）',
      '  - 同一层内按 specificity 和出现顺序决定',
      '',
      '  示例：',
      '  @layer base, components, utilities;',
      '  /* 优先级：未分层 > base > components > utilities */',
      '',
      '【@import 导入到指定层】',
      '  @import "reset.css" layer(reset);',
      '  @import "tailwind.css" layer(framework);',
      '',
      '  /* 必须在所有其他规则之前 @import */',
      '  @layer reset, framework, base, components, utilities;',
      '  @import "reset.css" layer(reset);',
      '  @import "tailwind.css" layer(framework);',
      '',
      '【应用场景 1：第三方库样式隔离】',
      '  @layer reset, vendor, base, components, utilities;',
      '',
      '  @import "normalize.css" layer(reset);',
      '  @import "bootstrap.css" layer(vendor);',
      '',
      '  /* 业务代码无需 !important 即可覆盖 Bootstrap */',
      '  @layer base {',
      '    .btn { padding: 8px 16px; }  /* 覆盖 vendor 的 .btn */',
      '  }',
      '',
      '  /* 未分层样式优先级最高 */',
      '  .btn-special { padding: 12px 24px; }  /* 强制覆盖所有层 */',
      '',
      '【应用场景 2：设计系统分层】',
      '  @layer reset, base, components, utilities;',
      '',
      '  @layer reset {',
      '    *, *::before, *::after { box-sizing: border-box; }',
      '    body { margin: 0; }',
      '  }',
      '',
      '  @layer base {',
      '    /* 设计 token：颜色、字号、间距 */',
      '    :root { --color-primary: #3b82f6; }',
      '    body { font-family: system-ui; line-height: 1.6; }',
      '  }',
      '',
      '  @layer components {',
      '    .btn { ... }',
      '    .card { ... }',
      '  }',
      '',
      '  @layer utilities {',
      '    .text-center { text-align: center; }',
      '    .mt-4 { margin-top: 1rem; }',
      '  }',
      '',
      '  /* utilities 优先级最低，但业务可覆盖 */',
      '  /* 因为 utilities 是最后声明的层 */',
      '',
      '【应用场景 3：覆盖第三方样式无需 !important】',
      '  /* 第三方库样式 */',
      '  @import "third-party.css" layer(vendor);',
      '',
      '  /* 业务代码（未分层）自动覆盖 vendor 层 */',
      '  .third-party-component {',
      '    color: red;  /* 无需 !important */',
      '  }',
      '',
      '【revert-layer 在层内回退到上一层】',
      '  @layer base {',
      '    .btn { color: blue; }',
      '  }',
      '',
      '  @layer components {',
      '    .btn { color: revert-layer; }  /* → blue（base 层的值）*/',
      '  }',
      '',
      '  /* revert-layer 只能在 @layer 内使用 */',
      '  /* 未分层样式用 revert-layer 无效（无上一层可回退）*/',
      '',
      '【嵌套层】',
      '  @layer outer {',
      '    @layer inner {',
      '      .x { color: red; }',
      '    }',
      '  }',
      '  /* 引用：outer.inner */',
      '  @layer outer.inner {',
      '    .x { color: blue; }',
      '  }',
      '',
      '【浏览器支持】',
      `  @layer: ${f.atLayer ? '✓' : '✗'} (Chrome 99+/Firefox 97+/Safari 15.4+)`,
      `  revert-layer: ${f.revertLayer ? '✓' : '✗'}`,
      '',
      '【vs specificity 战争】',
      '  传统：',
      '    #nav .item { ... }           /* (1,1,0) */',
      '    #nav .item.item-active { ... } /* (1,2,0) 覆盖 */',
      '    #nav #menu .item { ... }     /* (2,1,0) 再覆盖 */',
      '    /* 越来越长，难以维护 */',
      '',
      '  @layer：',
      '    @layer base { .item { ... } }',
      '    @layer app { .item { ... } }  /* 自动覆盖 base，无需提权重 */',
      '',
      '【调试技巧】',
      '  Chrome DevTools → Elements → Styles',
      '    - 显示规则所在的 @layer',
      '    - 折叠/展开查看层结构',
      '',
      '【规范】',
      '  CSS Cascade Layers Level 5',
      '  https://www.w3.org/TR/css-cascade-5/#layering',
    ].join('\n');
    this.setState({ layerInfo: info });
    this._addLog('css', `@layer 演示完成；supports=${f.atLayer}/revert-layer=${f.revertLayer}`);
  }

  _renderCard4(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. @layer Cascade Layers —— 级联层组织大型项目样式',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['@layer', f.atLayer],
          ['revert-layer', f.revertLayer],
        ]),
        h(Tag, { color: 'primary' }, '级联层'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '@layer name { ... } 声明级联层，先声明的层优先级越高，未分层样式优先级最高（视为最后的匿名层）。@import "x.css" layer(name); 导入到指定层。revert-layer 在层内回退到上一层值。应用场景：第三方库隔离 layer(vendor)、设计系统分层 layer(reset, base, components, utilities)、覆盖第三方样式无需 !important。替代 specificity 战争的纯 CSS 方案。Chrome 99+/Firefox 97+/Safari 15.4+ 支持。',
        ),
        h('div', { class: 'ci-demo' },
          h('div', { class: 'fs-sm text-secondary' }, '层叠优先级（高→低）：'),
          h('div', { class: 'ci-layer-stack' },
            h('div', { class: 'ci-layer-row ci-unlayered' }, '未分层样式（最高优先级，视为最后的匿名层）'),
            h('div', { class: 'ci-layer-row ci-l1' }, '@layer base（第 1 声明，优先级最高）'),
            h('div', { class: 'ci-layer-row ci-l2' }, '@layer components（第 2 声明）'),
            h('div', { class: 'ci-layer-row ci-l3' }, '@layer utilities（第 3 声明）'),
            h('div', { class: 'ci-layer-row ci-l4' }, '@layer overrides（最后声明，优先级最低）'),
          ),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('运行 @layer 演示', { type: 'primary', size: 'sm', onClick: () => this._runLayerDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.layerInfo || '（点击按钮查看 @layer 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 5：CSS Custom Properties 基础 =====================

  _runCustomPropDemo(): void {
    const f = this._flags();
    this._injectStyle('ci-custom-prop-demo', `
      .ci-cp-root {
        --ci-primary: #3b82f6;
        --ci-spacing: 16px;
        --ci-radius: 8px;
        padding: var(--ci-spacing);
        background: var(--ci-primary);
        color: #fff;
        border-radius: var(--ci-radius);
      }
      .ci-cp-child {
        margin-top: var(--ci-spacing);
        padding: calc(var(--ci-spacing) / 2);
        background: rgba(255,255,255,0.2);
        border-radius: calc(var(--ci-radius) - 2px);
      }
      .ci-cp-theme-dark {
        --ci-primary: #1e40af;
        --ci-spacing: 20px;
        padding: var(--ci-spacing);
        background: var(--ci-primary);
        color: #fff;
        margin-top: 10px;
        border-radius: var(--ci-radius);
      }
    `);
    const info = [
      '===== CSS Custom Properties（CSS 变量）基础 =====',
      '',
      '【定义与使用】',
      '  /* 定义：必须以 -- 开头，区分大小写 */',
      '  :root {',
      '    --primary-color: #3b82f6;',
      '    --spacing: 16px;',
      '    --radius: 8px;',
      '  }',
      '',
      '  /* 使用：var() 函数 */',
      '  .btn {',
      '    background: var(--primary-color);',
      '    padding: var(--spacing);',
      '    border-radius: var(--radius);',
      '  }',
      '',
      '  /* 带 fallback */',
      '  .btn { color: var(--primary-color, #ccc); }',
      '',
      '【命名规则】',
      '  - 必须以 -- 开头（dashed-ident）',
      '  - 区分大小写：--Color 与 --color 是不同变量',
      '  - 后续字符：字母/数字/连字符/下划线，如 --my-var-1',
      '  - 不能用 CSS 关键字如 initial/inherit/unset/revert 作为值',
      '',
      '【作用域】',
      '  /* 全局作用域：定义在 :root */',
      '  :root {',
      '    --global-color: blue;   /* 整个文档可用 */',
      '  }',
      '',
      '  /* 局部作用域：定义在元素上 */',
      '  .card {',
      '    --card-padding: 16px;   /* 仅 .card 及其子树可用 */',
      '    padding: var(--card-padding);',
      '  }',
      '  .other {',
      '    padding: var(--card-padding);  /* 无效，--card-padding 不在此处定义 */',
      '  }',
      '',
      '【继承：CSS 变量默认继承】',
      '  :root { --base-size: 16px; }',
      '  body { font-size: var(--base-size); }    /* 继承自 :root */',
      '  .card { font-size: var(--base-size); }   /* 仍继承自 :root */',
      '',
      '  /* 子元素定义同名变量覆盖父级 */',
      '  .card { --base-size: 20px; }              /* .card 子树用 20px */',
      '  .card .title { font-size: var(--base-size); }  /* 20px */',
      '',
      '【与预处理器变量（Sass/Less）的区别】',
      '  ┌────────────────┬────────────────────┬────────────────────┐',
      '  │ 特性           │ CSS 变量           │ Sass/Less 变量     │',
      '  ├────────────────┼────────────────────┼────────────────────┤',
      '  │ 求值时机       │ 运行时             │ 编译时             │',
      '  │ 可动态修改     │ ✓ JS setProperty   │ ✗ 编译后固定       │',
      '  │ 作用域         │ DOM 树             │ 文件/块级          │',
      '  │ 继承           │ ✓ 沿 DOM 树向下    │ ✗ 无继承概念       │',
      '  │ 媒体查询       │ ✗ 不可用于条件     │ ✓ 可在 @media 内改 │',
      '  │ 类型化         │ @property 可注册   │ ✗ 无类型           │',
      '  │ 浏览器解析     │ ✓ 原生支持         │ 编译为静态值       │',
      '  └────────────────┴────────────────────┴────────────────────┘',
      '',
      '  /* Sass */',
      '  $primary: blue;',
      '  .btn { color: $primary; }  /* 编译后 color: blue */',
      '  /* JS 无法动态修改 $primary */',
      '',
      '  /* CSS 变量 */',
      '  :root { --primary: blue; }',
      '  .btn { color: var(--primary); }',
      '  /* JS: document.documentElement.style.setProperty("--primary", "red") */',
      '',
      '【CSS 变量能用于媒体查询条件吗？】',
      '  ❌ 不可直接用于 @media 条件',
      '     @media (min-width: var(--breakpoint)) { ... }  /* 无效 */',
      '',
      '  ✅ 可用 @custom-media 配合（CSS Media Queries Level 5 提案）',
      '     @custom-media --mobile (max-width: 768px);',
      '     @media (--mobile) { ... }',
      '     /* 但 @custom-media 浏览器支持有限，建议用 PostCSS 预处理 */',
      '',
      '  ✅ 实际做法：在 @media 内重新定义变量',
      '     :root { --padding: 16px; }',
      '     @media (max-width: 768px) {',
      '       :root { --padding: 8px; }  /* 响应式调整 */',
      '     }',
      '     .box { padding: var(--padding); }',
      '',
      '【注册与未注册变量】',
      '  未注册变量：',
      '    --x: 10px;',
      '    var(--x)         // 返回字符串 "10px"',
      '    calc(var(--x) * 2)  // calc 解析为 20px',
      '    // 但无法平滑动画（见下）',
      '',
      '  已注册变量（@property，见 Card 7）：',
      '    @property --x {',
      '      syntax: "<length>";',
      '      inherits: false;',
      '      initial-value: 0px;',
      '    }',
      '    // 浏览器知道是长度类型，可平滑动画',
      '',
      '【完整示例：主题切换】',
      '  :root {',
      '    --bg: #ffffff;',
      '    --text: #1f2937;',
      '    --primary: #3b82f6;',
      '  }',
      '',
      '  [data-theme="dark"] {',
      '    --bg: #1f2937;',
      '    --text: #f9fafb;',
      '    --primary: #60a5fa;',
      '  }',
      '',
      '  body {',
      '    background: var(--bg);',
      '    color: var(--text);',
      '  }',
      '  .btn { background: var(--primary); }',
      '',
      '  // JS: document.documentElement.dataset.theme = "dark"',
      '  // 整页瞬间切换，无需重新加载',
      '',
      '【浏览器支持】',
      `  --var: ${f.customProperty ? '✓' : '✗'} (Chrome 49+/Firefox 31+/Safari 9.1+)`,
      `  var(): ${f.varFunction ? '✓' : '✗'}`,
      '  全球使用率 > 97%（2025）',
      '',
      '【规范】',
      '  CSS Custom Properties for Cascading Variables Level 1',
      '  https://www.w3.org/TR/css-variables-1/',
    ].join('\n');
    this.setState({ customPropInfo: info });
    this._addLog('css', `CSS 变量基础演示完成；--var=${f.customProperty}/var()=${f.varFunction}`);
  }

  _renderCard5(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. CSS Custom Properties（CSS 变量）—— 基础与作用域',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['--var', f.customProperty],
          ['var()', f.varFunction],
        ]),
        h(Tag, { color: 'primary' }, '变量'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'CSS 变量：--name: value; 定义（必须以 -- 开头，区分大小写），var(--name) 或 var(--name, fallback) 使用。定义在 :root 全局可用，定义在元素上仅该元素子树可用。CSS 变量默认继承（沿 DOM 树向下）。与 Sass/Less 预处理器变量区别：CSS 变量运行时求值（可 JS 动态修改），Sass 编译时求值（不可动态修改）。不可直接用于 @media 条件，但可在 @media 内重新定义变量实现响应式。Chrome 49+/Firefox 31+/Safari 9.1+ 支持。',
        ),
        h('div', { class: 'ci-demo' },
          h('div', { class: 'ci-cp-root' },
            h('div', {}, '根元素：--ci-primary: #3b82f6, --ci-spacing: 16px'),
            h('div', { class: 'ci-cp-child' }, '子元素：自动继承父级变量，calc(var(--ci-spacing) / 2)'),
          ),
          h('div', { class: 'ci-cp-theme-dark' },
            '主题变体：--ci-primary: #1e40af, --ci-spacing: 20px',
          ),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('运行 CSS 变量演示', { type: 'primary', size: 'sm', onClick: () => this._runCustomPropDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.customPropInfo || '（点击按钮查看 CSS 变量基础完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 6：var() 函数与 fallback 深潜 =====================

  _runVarFnDemo(): void {
    const f = this._flags();
    const info = [
      '===== var() 函数与 fallback 深潜 =====',
      '',
      '【var() 函数语法】',
      '  var(<custom-property-name>, <declaration-value>?)',
      '',
      '  - <custom-property-name>：必须以 -- 开头',
      '  - <declaration-value>：fallback 值，可选',
      '',
      '【fallback 基本用法】',
      '  /* --undefined 未定义时用 fallback */',
      '  .x { color: var(--undefined, blue); }     /* → blue */',
      '',
      '  /* --defined 已定义时用定义值 */',
      '  :root { --defined: red; }',
      '  .x { color: var(--defined, blue); }       /* → red */',
      '',
      '【fallback 可以是另一个 var()】',
      '  /* 链式 fallback：依次尝试 */',
      '  .x {',
      '    color: var(--a, var(--b, var(--c, default)));',
      '    // 1. --a 未定义 → 尝试 --b',
      '    // 2. --b 未定义 → 尝试 --c',
      '    // 3. --c 未定义 → 用 default',
      '  }',
      '',
      '  /* 实战：主题色优先级 */',
      '  :root {',
      '    --brand-primary: #3b82f6;',
      '    --legacy-primary: #1e40af;',
      '  }',
      '  .btn {',
      '    background: var(--primary, var(--brand-primary, var(--legacy-primary, black)));',
      '  }',
      '',
      '【fallback 触发条件】',
      '  1. 变量未定义（最常见）',
      '  2. 变量值为无效值（如 --x: 1px solid，用于 color 时无效）',
      '',
      '  ⚠️ 注意：--name: ;（空值）算"已定义"，fallback 不触发',
      '     --x: ;',
      '     color: var(--x, blue);  /* → 空字符串，可能无效，但不用 blue */',
      '',
      '  ⚠️ 注意：--name: initial; 也是"已定义"',
      '     --x: initial;',
      '     color: var(--x, blue);  /* → initial，即 black，不用 blue */',
      '',
      '【var() 不能用于属性名，只能用于值】',
      '  ❌ 无效：',
      '     --prop: color;',
      '     .x { var(--prop): red; }    /* 语法错误 */',
      '',
      '  ✅ 有效：',
      '     --color: red;',
      '     .x { color: var(--color); } /* 正确 */',
      '',
      '  // 如果需要动态属性名，用 JS：',
      '  el.style.setProperty(propertyName, value);',
      '',
      '【var() 在 calc() 中】',
      '  :root {',
      '    --gap: 16px;',
      '    --cols: 3;',
      '  }',
      '',
      '  .grid {',
      '    gap: calc(var(--gap) * 2);            /* 32px */',
      '    grid-template-columns: repeat(var(--cols), 1fr);',
      '    width: calc(100% - var(--gap) * 2);',
      '  }',
      '',
      '  /* 但 var() 返回字符串，calc 解析时需要类型正确 */',
      '  --x: 10px;',
      '  calc(var(--x) * 2)        /* 20px，正确 */',
      '  --y: "10px";              /* 字符串 */',
      '  calc(var(--y) * 2)        /* 无效，calc 不识别 */',
      '',
      '【var() 与颜色函数】',
      '  :root {',
      '    --primary: #3b82f6;',
      '    --secondary: #ef4444;',
      '  }',
      '',
      '  /* color-mix 混合两种颜色 */',
      '  .gradient {',
      '    background: color-mix(in srgb, var(--primary), var(--secondary));',
      '    /* 50% blue + 50% red */',
      '  }',
      '',
      '  /* color-mix 按比例混合 */',
      '  .lighter {',
      '    background: color-mix(in srgb, var(--primary) 25%, white);',
      '  }',
      '',
      '  /* relative color（CSS Color Level 5）*/',
      '  .darken {',
      '    background: rgb(from var(--primary) calc(r * 0.5) g b);',
      '  }',
      '',
      '【var() 与自定义属性动画（仅注册变量可动画化）】',
      '  /* 未注册变量：不可平滑动画 */',
      '  --x: 0;',
      '  .box {',
      '    transform: translateX(var(--x)px);  /* 单位错误，应 calc(var(--x) * 1px) */',
      '    transition: transform 0.3s;',
      '  }',
      '  /* JS 改 --x 时 transform 跳变，不平滑 */',
      '',
      '  /* 已注册变量（@property）：可平滑动画 */',
      '  @property --x {',
      '    syntax: "<number>";',
      '    inherits: false;',
      '    initial-value: 0;',
      '  }',
      '  @keyframes move {',
      '    from { --x: 0; }',
      '    to { --x: 100; }',
      '  }',
      '  .box {',
      '    transform: translateX(calc(var(--x) * 1px));',
      '    animation: move 1s infinite;',
      '  }',
      '  /* 详见 Card 7 */',
      '',
      '【性能】',
      '  - var() 解析有微小开销，但现代浏览器优化良好',
      '  - 在大量元素上使用 var() 不会显著影响渲染性能',
      '  - 但深层嵌套 var() 链（var(var(var(...)))）可能略慢',
      '  - 动画属性上用未注册变量可能导致重排（无法 GPU 合成）',
      '',
      '【调试】',
      '  Chrome DevTools → Elements → Styles',
      '    - 鼠标悬浮 var(--x) 显示当前值',
      '    - Computed 面板显示变量继承链',
      '',
      '  JS 调试：',
      '    // 读取变量值',
      '    getComputedStyle(el).getPropertyValue("--x");  // "16px"',
      '',
      '    // 设置变量',
      '    el.style.setProperty("--x", "32px");',
      '',
      '    // 删除变量',
      '    el.style.removeProperty("--x");',
      '',
      '    // 检测支持',
      '    CSS.supports("--x", "red");  // true',
      '',
      '【常见陷阱】',
      '  1. 循环引用：--a: var(--a); 无效，浏览器忽略',
      '  2. 单位错误：--x: 10; width: var(--x); 无效（需 var(--x)px 或 calc(var(--x) * 1px)）',
      '  3. fallback 不触发空值：--x: ; 时 var(--x, default) 不用 default',
      '  4. URL 不支持：var() 不能用于 url() 参数（早期限制，新版本支持）',
      '',
      '【浏览器支持】',
      `  var() with fallback: ${f.varFunction ? '✓' : '✗'}`,
      '  color-mix(): Chrome 111+/Firefox 113+/Safari 16.2+',
      '',
      '【规范】',
      '  CSS Custom Properties Level 1',
      '  https://www.w3.org/TR/css-variables-1/#using-variables',
    ].join('\n');
    this.setState({ varFnInfo: info });
    this._addLog('css', `var() 函数演示完成；supports=${f.varFunction}`);
  }

  _renderCard6(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. var() 函数与 fallback —— 链式降级与颜色函数',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['var()', f.varFunction]]),
        h(Tag, { color: 'primary' }, '函数'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'var(--name, fallback) 的 fallback 在 --name 未定义或无效时使用，可以是另一个 var() 实现链式降级：var(--a, var(--b, default))。注意 --name: ;（空值）算"已定义"，fallback 不触发。var() 不能用于属性名，只能用于值。可在 calc() 中计算：calc(var(--gap) * 2)。可与 color-mix 等颜色函数配合。性能开销微小，现代浏览器优化良好。Chrome DevTools 鼠标悬浮 var() 显示当前值。',
        ),
        h('div', { class: 'ci-var-demo' },
          'var(--ci-primary, #ccc) 链式降级：var(--a, var(--b, var(--c, default)))',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('运行 var() 函数演示', { type: 'primary', size: 'sm', onClick: () => this._runVarFnDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.varFnInfo || '（点击按钮查看 var() 函数完整深潜）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 7：@property 注册类型化自定义属性 =====================

  _runPropertyDemo(): void {
    const f = this._flags();
    this._injectStyle('ci-property-demo', `
      @property --ci-grad-start {
        syntax: '<color>';
        inherits: false;
        initial-value: #ef4444;
      }
      @property --ci-grad-end {
        syntax: '<color>';
        inherits: false;
        initial-value: #3b82f6;
      }
      @keyframes ci-grad-anim {
        0%   { --ci-grad-start: #ef4444; --ci-grad-end: #3b82f6; }
        50%  { --ci-grad-start: #f59e0b; --ci-grad-end: #8b5cf6; }
        100% { --ci-grad-start: #ef4444; --ci-grad-end: #3b82f6; }
      }
      .ci-prop-anim {
        animation: ci-grad-anim 4s linear infinite;
      }
    `);
    const info = [
      '===== @property 注册类型化自定义属性 =====',
      '',
      '【动机】',
      '  未注册的 CSS 变量是字符串，浏览器不知道类型，无法平滑动画。',
      '  @property 注册类型化变量，浏览器知道类型后可正确插值与动画。',
      '',
      '【@property 语法】',
      '  @property <custom-property-name> {',
      '    syntax: <syntax>;          // 类型',
      '    inherits: <boolean>;        // 是否继承',
      '    initial-value: <value>;     // 初始值',
      '  }',
      '',
      '  示例：',
      '  @property --my-color {',
      '    syntax: "<color>";',
      '    inherits: false;',
      '    initial-value: #c0ffee;',
      '  }',
      '',
      '【syntax 类型详解】',
      '  <length>        // 长度：px/em/rem/vw/vh 等',
      '    initial-value: 0px;',
      '',
      '  <color>         // 颜色：#hex/rgb()/hsl()/named 等',
      '    initial-value: #000000;',
      '',
      '  <number>        // 数字：1/1.5/-2 等',
      '    initial-value: 0;',
      '',
      '  <percentage>    // 百分比：50%/0% 等',
      '    initial-value: 0%;',
      '',
      '  <angle>         // 角度：deg/turn/rad/grad',
      '    initial-value: 0deg;',
      '',
      '  <time>          // 时间：s/ms',
      '    initial-value: 0s;',
      '',
      '  <resolution>    // 分辨率：dppx/dpi/dpcm',
      '    initial-value: 1dppx;',
      '',
      '  <url>           // URL：url(...)',
      '    initial-value: url("data:,"); // 必须有效 URL',
      '',
      '  *               // 任意值（等同未注册）',
      '    // 无 initial-value',
      '',
      '  /* 多值语法 */',
      '  syntax: "<length>+"        // 一个或多个长度',
      '    initial-value: 0px 0px;',
      '  syntax: "<color>#"         // 逗号分隔的颜色列表',
      '    initial-value: #000, #fff;',
      '  syntax: "<length> | <percentage>"  // 二选一',
      '    initial-value: 0px;',
      '',
      '  /* 带范围（CSS Values Level 4 提案）*/',
      '  syntax: "<length 0..100px>"  // 0 到 100px',
      '',
      '【inherits：是否继承】',
      '  @property --x {',
      '    syntax: "<color>";',
      '    inherits: true;            // 子树继承',
      '    initial-value: blue;',
      '  }',
      '  /* inherits: true 时 :root 定义全树可用 */',
      '  /* inherits: false 时仅在定义元素上可用 */',
      '',
      '【initial-value：必须符合 syntax】',
      '  @property --x {',
      '    syntax: "<length>";',
      '    inherits: false;',
      '    initial-value: 16px;       // 必须是有效长度',
      '  }',
      '',
      '  ⚠️ syntax 为 * 时不能有 initial-value',
      '     @property --x {',
      '       syntax: "*";',
      '       inherits: false;',
      '       // 无 initial-value',
      '     }',
      '',
      '【注册后的优势】',
      '  1. 类型安全：',
      '     // 浏览器知道类型，错误值会被拒绝',
      '     el.style.setProperty("--x", "abc");  // <length> 拒绝',
      '',
      '  2. 可动画化（最重要）：',
      '     @property --x {',
      '       syntax: "<number>";',
      '       inherits: false;',
      '       initial-value: 0;',
      '     }',
      '     @keyframes move {',
      '       from { --x: 0; }',
      '       to { --x: 100; }',
      '     }',
      '     .box {',
      '       animation: move 2s infinite;',
      '       transform: translateX(calc(var(--x) * 1px));',
      '     }',
      '     /* 浏览器在每帧插值 --x，实现平滑动画 */',
      '',
      '  3. 浏览器知道如何解析和插值：',
      '     // 颜色插值：在 RGB 或 HSL 空间平滑过渡',
      '     @property --c {',
      '       syntax: "<color>";',
      '       inherits: false;',
      '       initial-value: red;',
      '     }',
      '     @keyframes colorShift {',
      '       from { --c: red; }',
      '       to { --c: blue; }',
      '     }',
      '     .box { background: var(--c); animation: colorShift 2s infinite; }',
      '',
      '【JS 注册：CSS.registerProperty】',
      '  if ("registerProperty" in CSS) {',
      '    CSS.registerProperty({',
      '      name: "--my-color",',
      '      syntax: "<color>",',
      '      inherits: false,',
      '      initialValue: "#c0ffee",',
      '    });',
      '  }',
      '',
      '  // 与 @property 等价，但可在 JS 中动态注册',
      '  // 注意：注册后不可修改（一次性的）',
      '',
      '【实战 1：可动画渐变】',
      '  @property --grad-angle {',
      '    syntax: "<angle>";',
      '    inherits: false;',
      '    initial-value: 0deg;',
      '  }',
      '  @keyframes spin {',
      '    to { --grad-angle: 360deg; }',
      '  }',
      '  .gradient {',
      '    background: linear-gradient(var(--grad-angle), red, blue);',
      '    animation: spin 3s linear infinite;',
      '  }',
      '  /* 渐变角度平滑旋转 */',
      '',
      '【实战 2：可动画 transform-origin】',
      '  @property --tx {',
      '    syntax: "<length>";',
      '    inherits: false;',
      '    initial-value: 0px;',
      '  }',
      '  @keyframes slide {',
      '    from { --tx: 0px; }',
      '    to { --tx: 200px; }',
      '  }',
      '  .box {',
      '    transform: translateX(var(--tx));',
      '    animation: slide 2s infinite alternate;',
      '  }',
      '',
      '【实战 3：可动画文字阴影】',
      '  @property --shadow-x {',
      '    syntax: "<length>";',
      '    inherits: false;',
      '    initial-value: 0px;',
      '  }',
      '  @keyframes shake {',
      '    0%, 100% { --shadow-x: 0px; }',
      '    25% { --shadow-x: -2px; }',
      '    75% { --shadow-x: 2px; }',
      '  }',
      '  .text {',
      '    text-shadow: var(--shadow-x) 0 red;',
      '    animation: shake 0.5s infinite;',
      '  }',
      '',
      '【浏览器支持】',
      `  @property: ${f.atProperty ? '✓' : '✗'} (Chrome 85+/Firefox 128+/Safari 16.4+)`,
      '  CSS.registerProperty: 同上',
      '',
      '【渐进增强】',
      '  @supports (background: paint(test)) {',
      '    /* 支持 Houdini，可注册 @property */',
      '  }',
      '  @supports not (background: paint(test)) {',
      '    /* 不支持，降级为 JS 动画或静态值 */',
      '  }',
      '',
      '【规范】',
      '  CSS Properties and Values API Level 1 (Houdini)',
      '  https://www.w3.org/TR/css-properties-values-api-1/',
    ].join('\n');
    this.setState({ propertyInfo: info });
    this._addLog('css', `@property 演示完成；supports=${f.atProperty}`);
  }

  _renderCard7(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. @property —— 注册类型化自定义属性（Houdini）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['@property', f.atProperty]]),
        h(Tag, { color: 'primary' }, 'Houdini'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '@property --name { syntax; inherits; initial-value; } 注册类型化自定义属性，浏览器知道类型后可平滑动画。syntax 支持 <length>/<color>/<number>/<percentage>/<angle>/<time>/<resolution>/<url>/*，多值用 + 或 # 修饰，二选用 | 分隔。inherits 控制继承。initial-value 必须符合 syntax（syntax 为 * 时不可设）。注册后优势：类型安全、可动画化（未注册变量不可平滑动画）、浏览器正确插值。JS 用 CSS.registerProperty() 动态注册。Chrome 85+/Firefox 128+/Safari 16.4+ 支持。',
        ),
        h('div', { class: 'ci-demo' },
          h('div', { class: 'fs-sm text-secondary' }, '@property 注册 --ci-grad-start/--ci-grad-end 为 <color> 类型，可平滑动画渐变：'),
          h('div', { class: 'ci-prop-anim' }),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('运行 @property 演示', { type: 'primary', size: 'sm', onClick: () => this._runPropertyDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.propertyInfo || '（点击按钮查看 @property 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 8：实战模式与调试技巧 =====================

  _runPatternDemo(): void {
    const f = this._flags();
    const info = [
      '===== 实战模式与调试技巧 =====',
      '',
      '【模式 1：主题切换（light/dark）】',
      '  :root {',
      '    --bg: #ffffff;',
      '    --text: #1f2937;',
      '    --primary: #3b82f6;',
      '    --primary-hover: #2563eb;',
      '    --border: #e5e7eb;',
      '  }',
      '',
      '  [data-theme="dark"] {',
      '    --bg: #1f2937;',
      '    --text: #f9fafb;',
      '    --primary: #60a5fa;',
      '    --primary-hover: #93c5fd;',
      '    --border: #374151;',
      '  }',
      '',
      '  body {',
      '    background: var(--bg);',
      '    color: var(--text);',
      '    transition: background 0.3s, color 0.3s;',
      '  }',
      '  .btn {',
      '    background: var(--primary);',
      '    border: 1px solid var(--border);',
      '  }',
      '  .btn:hover { background: var(--primary-hover); }',
      '',
      '  // JS 切换：',
      '  document.documentElement.dataset.theme = "dark";',
      '  // 整页瞬间切换主题',
      '',
      '【模式 2：组件设计系统（变量分层）】',
      '  :root {',
      '    /* 间距 scale */',
      '    --space-1: 4px;',
      '    --space-2: 8px;',
      '    --space-3: 16px;',
      '    --space-4: 24px;',
      '    --space-5: 32px;',
      '',
      '    /* 颜色 scale */',
      '    --color-primary-50: #eff6ff;',
      '    --color-primary-500: #3b82f6;',
      '    --color-primary-900: #1e3a8a;',
      '',
      '    /* 字号 scale */',
      '    --text-sm: 12px;',
      '    --text-base: 14px;',
      '    --text-lg: 16px;',
      '    --text-xl: 20px;',
      '',
      '    /* z-index 层级 */',
      '    --z-dropdown: 1000;',
      '    --z-modal: 2000;',
      '    --z-toast: 3000;',
      '  }',
      '',
      '  .card {',
      '    padding: var(--space-3);',
      '    background: var(--color-primary-50);',
      '    font-size: var(--text-base);',
      '  }',
      '',
      '【模式 3：动态计算（calc + var）】',
      '  :root {',
      '    --sidebar-width: 240px;',
      '    --content-max: 1200px;',
      '  }',
      '',
      '  .layout {',
      '    display: grid;',
      '    grid-template-columns: var(--sidebar-width) 1fr;',
      '    /* 主内容最大宽度 = 视口 - 侧边栏 - 边距 */',
      '    --content-width: calc(100vw - var(--sidebar-width) - 48px);',
      '  }',
      '',
      '  .main {',
      '    width: min(var(--content-width), var(--content-max));',
      '    margin: 0 auto;',
      '  }',
      '',
      '  /* 响应式：小屏隐藏侧边栏 */',
      '  @media (max-width: 768px) {',
      '    :root { --sidebar-width: 0px; }',
      '  }',
      '',
      '【模式 4：类型化变量动画（@property + animation）】',
      '  @property --angle {',
      '    syntax: "<angle>";',
      '    inherits: false;',
      '    initial-value: 0deg;',
      '  }',
      '',
      '  @keyframes shimmer {',
      '    to { --angle: 360deg; }',
      '  }',
      '',
      '  .shimmer-btn {',
      '    background: linear-gradient(var(--angle), transparent 30%, rgba(255,255,255,0.5) 50%, transparent 70%),',
      '                var(--primary);',
      '    animation: shimmer 2s linear infinite;',
      '  }',
      '  /* 按钮表面有光泽流动效果，@property 让角度平滑插值 */',
      '',
      '【模式 5：@layer 组织大型项目样式】',
      '  /* styles.css */',
      '  @layer reset, base, components, utilities;',
      '',
      '  @import "normalize.css" layer(reset);',
      '',
      '  @layer base {',
      '    :root {',
      '      --primary: #3b82f6;',
      '      --text: #1f2937;',
      '    }',
      '    body {',
      '      font-family: system-ui;',
      '      color: var(--text);',
      '    }',
      '  }',
      '',
      '  @layer components {',
      '    .btn { padding: 8px 16px; border-radius: 4px; }',
      '    .card { padding: 16px; }',
      '  }',
      '',
      '  @layer utilities {',
      '    .text-center { text-align: center; }',
      '    .mt-4 { margin-top: var(--space-4); }',
      '  }',
      '',
      '  /* 业务代码（未分层）自动覆盖所有层 */',
      '  .my-page .btn { background: var(--primary); }',
      '',
      '【模式 6：:where() 零权重重置】',
      '  /* 基础样式用 :where()，specificity = (0,0,0) */',
      '  :where(button, input, select, textarea) {',
      '    font: inherit;',
      '    color: inherit;',
      '    padding: 6px 10px;',
      '    border: 1px solid #ccc;',
      '    border-radius: 4px;',
      '  }',
      '',
      '  /* 业务样式可轻易覆盖 */',
      '  .my-btn {                  /* (0,1,0) > (0,0,0) */',
      '    padding: 12px 24px;',
      '    border: none;',
      '  }',
      '',
      '  /* 对比不用 :where() */',
      '  button, input, select, textarea {  /* (0,0,1) */',
      '    padding: 6px 10px;',
      '  }',
      '  /* 业务要覆盖需 .my-btn { padding: 12px 24px !important; } 或更高权重 */',
      '',
      '【模式 7：all: unset 重置第三方样式】',
      '  /* 完全重置某个第三方组件 */',
      '  .third-party-widget {',
      '    all: unset;             /* 重置所有属性 */',
      '    display: block;         /* 重新定义所需 */',
      '    box-sizing: border-box;',
      '    /* ... 自定义样式 ... */',
      '  }',
      '',
      '  /* 注意：all: unset 会重置 display 等，需重新声明 */',
      '  /* direction 和 unicode-bidi 不会被 all 重置 */',
      '',
      '【继承陷阱：避免在根元素设大量可继承属性】',
      '  ❌ 反模式：',
      '  :root {',
      '    font-size: 16px;',
      '    color: #333;',
      '    font-family: ...;',
      '    line-height: 1.6;',
      '    letter-spacing: 0.5px;',
      '    /* ... 大量可继承属性 ... */',
      '  }',
      '  /* 任何元素修改都会触发整树继承重算 */',
      '',
      '  ✅ 正确做法：',
      '  body {',
      '    font-size: 16px;',
      '    color: #333;',
      '  }',
      '  /* 子组件按需覆盖，不依赖根继承 */',
      '',
      '【调试技巧 1：Chrome DevTools Computed 面板】',
      '  Elements → 选中元素 → Computed 面板',
      '    - 查看每个属性的最终计算值',
      '    - 折叠/展开查看继承链（继承自 xxx）',
      '    - 筛选可继承属性',
      '',
      '【调试技巧 2：JS 读取变量值】',
      '  const el = document.querySelector(".card");',
      '  const styles = getComputedStyle(el);',
      '',
      '  // 读取自定义属性',
      '  const primary = styles.getPropertyValue("--primary");',
      '  console.log(primary);  // " #3b82f6" 或 "#3b82f6"',
      '',
      '  // 注意：返回字符串，可能有前导空格',
      '  const trimmed = primary.trim();',
      '',
      '  // 读取常规属性',
      '  const color = styles.color;  // "rgb(59, 130, 246)"',
      '',
      '【调试技巧 3：JS 动态修改变量】',
      '  const root = document.documentElement;',
      '',
      '  // 设置变量',
      '  root.style.setProperty("--primary", "#ef4444");',
      '',
      '  // 读取变量',
      '  const current = getComputedStyle(root).getPropertyValue("--primary");',
      '',
      '  // 删除变量',
      '  root.style.removeProperty("--primary");',
      '',
      '  // 批量切换主题',
      '  function setTheme(theme) {',
      '    for (const [key, value] of (Object as any).entries(theme)) {',
      '      root.style.setProperty(`--${key}`, value);',
      '    }',
      '  }',
      '',
      '【调试技巧 4：CSS.supports 检测变量支持】',
      '  // 检测 CSS 变量',
      '  CSS.supports("--x", "red");           // true',
      '  CSS.supports("color", "var(--x)");    // true',
      '',
      '  // 检测 @property',
      '  CSS.supports("@property", "--x");     // true (Chrome 85+)',
      '',
      '  // 检测 @layer',
      '  CSS.supports("@layer", "x");          // true (Chrome 99+)',
      '',
      '  // 渐进增强',
      '  if (CSS.supports("--x", "red")) {',
      '    // 使用 CSS 变量',
      '  } else {',
      '    // 降级到静态值',
      '  }',
      '',
      '【性能优化】',
      '  1. 避免深层嵌套 var() 链：',
      '     ❌ var(--a, var(--b, var(--c, var(--d))))',
      '     ✅ 直接定义最终值',
      '',
      '  2. 避免在动画属性上用未注册变量：',
      '     ❌ animation 中改未注册 var()（不平滑，每帧重排）',
      '     ✅ @property 注册后用 animation（GPU 合成）',
      '',
      '  3. 避免在根元素设大量可继承属性（前面提过）',
      '',
      '  4. 使用 will-change 提示浏览器：',
      '     .animated { will-change: transform, --angle; }',
      '',
      '【浏览器兼容性速查】',
      '  ┌──────────────────┬──────────┬──────────┬──────────┐',
      '  │ 特性             │ Chrome   │ Firefox  │ Safari   │',
      '  ├──────────────────┼──────────┼──────────┼──────────┤',
      '  │ --var / var()    │ 49+      │ 31+      │ 9.1+     │',
      '  │ inherit/initial  │ 全部     │ 全部     │ 全部     │',
      '  │ unset            │ 41+      │ 27+      │ 9.1+     │',
      '  │ revert           │ 84+      │ 67+      │ 9.1+     │',
      '  │ all              │ 37+      │ 27+      │ 9.1+     │',
      '  │ @layer           │ 99+      │ 97+      │ 15.4+    │',
      '  │ @property        │ 85+      │ 128+     │ 16.4+    │',
      '  │ :is()            │ 88+      │ 78+      │ 14+      │',
      '  │ :where()         │ 88+      │ 78+      │ 14+      │',
      '  │ color-mix()      │ 111+     │ 113+     │ 16.2+    │',
      '  └──────────────────┴──────────┴──────────┴──────────┘',
      '',
      '【现代 CSS 变量最佳实践】',
      '  1. 设计 token 用 CSS 变量定义在 :root',
      '  2. 组件局部变量定义在组件根元素',
      '  3. 主题切换用 [data-theme] 覆盖 :root 变量',
      '  4. 大型项目用 @layer 组织层级',
      '  5. 基础样式用 :where() 保持零权重',
      '  6. 动画变量用 @property 注册',
      '  7. 第三方样式隔离用 @layer(vendor)',
      '  8. 重置组件用 all: unset',
      '  9. 避免在动画属性用未注册变量',
      '  10. 用 CSS.supports() 做渐进增强',
      '',
      '【资源】',
      '  - 规范：https://www.w3.org/TR/css-variables-1/',
      '  - 规范：https://www.w3.org/TR/css-cascade-5/',
      '  - 规范：https://www.w3.org/TR/css-properties-values-api-1/',
      '  - MDN: https://developer.mozilla.org/docs/Web/CSS/--*',
      '  - MDN: https://developer.mozilla.org/docs/Web/CSS/var()',
      '  - MDN: https://developer.mozilla.org/docs/Web/CSS/@property',
      '  - MDN: https://developer.mozilla.org/docs/Web/CSS/@layer',
    ].join('\n');
    this.setState({ patternInfo: info });
    this._addLog('css', '实战模式与调试技巧演示完成');
  }

  _renderCard8(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 实战模式与调试技巧（主题切换 / 设计系统 / @layer 组织 / 调试）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, '实战'),
        h(Tag, { color: f.atLayer ? 'success' : 'error' }, `@layer ${f.atLayer ? '✓' : '✗'}`),
        h(Tag, { color: f.atProperty ? 'success' : 'error' }, `@property ${f.atProperty ? '✓' : '✗'}`),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '完整实战模式：主题切换（light/dark，:root 变量 + [data-theme] 覆盖）/ 组件设计系统（变量分层 spacing/color/font/z-index）/ 动态计算（calc + var 响应式）/ 类型化变量动画（@property + animation 平滑过渡）/ @layer 组织大型项目（reset/base/components/utilities）/ :where() 零权重重置 / all: unset 重置第三方样式 / 继承陷阱避免。调试：Chrome DevTools Computed 查看继承链、getComputedStyle().getPropertyValue()、element.style.setProperty() 动态修改、CSS.supports() 检测。性能优化与浏览器兼容性速查。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行实战模式演示', { type: 'primary', size: 'sm', onClick: () => this._runPatternDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.patternInfo || '（点击按钮查看实战模式与调试技巧完整代码）')),
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
      h('h2', { class: 'section-title' }, 'CSS 层叠、继承与自定义属性 深度实验室'),

      h(Alert, {
        type: 'info',
        message: 'CSS Cascading & Inheritance Level 4 + Custom Properties + @property 深度',
        description: '演示决定「为什么这条样式最终生效」的底层规则：层叠算法 8 阶段（Origin & Importance / Context / Element-Attached / Layers / Specificity / Order of Appearance / Transition-Animation / Defaulting）、Specificity 选择器权重 (a,b,c) 计算（:is()/:where() 规则）、继承机制（inherit/initial/unset/revert/revert-layer + all 属性）、@layer Cascade Layers 级联层组织、CSS Custom Properties 基础与作用域、var() 函数与 fallback 链式降级、@property 注册类型化变量实现可动画渐变、实战模式（主题切换/设计系统/@layer 组织/:where() 零权重/all: unset 重置）与调试技巧（getComputedStyle/setProperty/CSS.supports）。用 CSS.supports() 检测，jsdom 不做真实布局但流程完整。',
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
