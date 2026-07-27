// =====================================================================
// CSSNestingScopeDeepPage.js —— CSS Nesting & @scope 嵌套与作用域深度实验室
// 演示 CSS Nesting Module Level 1 + CSS Cascading and Inheritance Level 6 @scope
// 浏览器原生嵌套与作用域规则体系核心：
//   1. CSS Nesting 基础与 & 父选择器
//      .parent { color: red; & .child { } & > .direct { } &:hover { } & + .sibling { } }
//      & 表示父选择器引用，任意层级嵌套
//      原生 vs Sass/LESS 预编译差异（运行时解析 vs 编译期字符串拼接）
//      Chrome 112+/Firefox 117+/Safari 16.5+；CSS.supports('selector', '& > a') 检测
//   2. 嵌套语法规则与解析顺序
//      嵌套选择器必须以 & / @ / : / . / # / [ / * 开头，否则需显式 &
//      复杂选择器嵌套 & .a + .b；组合器 & + &、& ~ &；伪元素 &::before
//      at-rule 直接嵌套 @media / @supports / @container 无需跳出
//      & 在选择器中间 .a & .b 父级嵌入
//   3. @scope 作用域规则基础
//      @scope (.host) { } 限定选择器只匹配 .host 内元素
//      @scope (.host) to (.limit) { } 甜甜圈模型 Donut Scope
//      作用域外不再受规则影响；与后代选择器 .host .child 的区别（作用域可被中断）
//   4. @scope 甜甜圈模型 Donut Scope 深潜
//      @scope (.article) to (.comments) { p { } }
//      .article 内 .comments 之外的 p 受规则影响，.comments 内 p 不受影响
//      多层 scope boundaries to (.a, .b, .c)
//      降低优先级避免深度选择器：@scope vs .article .body .content p specificity 一致但作用域更清晰
//   5. @scope 与 :scope 伪类
//      @scope 块内 :scope 引用作用域根元素
//      @scope (.card) { :scope { } :scope:hover { } :scope > .title { } }
//      :scope vs & 在 @scope 内的语义差异；作用域根的样式设置
//   6. CSS Nesting 与 @layer / @scope 协同
//      @layer base { .card { & .title { } } }
//      @layer components { @scope (.card) { } }
//      @scope (.host) { & .child { } }
//      三层结构 @layer（层次）+ @scope（作用域）+ Nesting（结构）
//   7. SCSS/Less 迁移与差异
//      原生 & 是选择器引用，SCSS & 是字符串拼接
//      SCSS @at-root 跳出嵌套；@mixin/@include 暂无原生等价（@property + @function 提案中）
//      SCSS interpolation #{}、控制指令 @if/@for/@each 原生不支持
//      迁移策略：渐进迁移 + PostCSS autoprefixer；构建工具链是否还需预处理器
//   8. 实战模式与陷阱
//      BEM 替代/组件库样式组织/主题切换 [data-theme="dark"] { & .card { } }
//      响应式嵌套 @media (max-width: 768px) {} 嵌套于组件内
//      状态机嵌套 &:hover/&.is-active/&[disabled]
//      陷阱清单：& 缺失导致整行被当作属性解析/嵌套深度过深难调试
//      /@scope 边界元素本身是否被包含（包含根边界排除终点）
//      /老浏览器降级需 autoprefixer/嵌套不创建新 specificity 但选择器组合仍计入
//      /原生 Nesting 与 Sass 产物差异（输出格式不同但语义等价）
//      /浏览器支持 Chrome 112+/FF 117+/Safari 16.5+ 较新
// 说明：jsdom 不做真实样式应用，但 CSS.supports 可探测能力；
//       注入演示样式 + 完整代码示例，真实浏览器可查看效果。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { Props, State } from '../../core/types.js';

interface LogEntry { type: string; content: string; time: string; }

interface CSSNestingScopeDeepPageState extends State {
  logs: LogEntry[];
  capsSummary: string;
  nestingBasicInfo: string;
  syntaxRulesInfo: string;
  scopeBasicInfo: string;
  donutScopeInfo: string;
  scopePseudoInfo: string;
  layerScopeInfo: string;
  scssMigrationInfo: string;
  patternInfo: string;
}

interface BtnOpts extends Props {
  type?: string;
  size?: string;
  disabled?: boolean;
  danger?: boolean;
  loading?: boolean;
  onClick: (e: MouseEvent) => void;
}

export class CSSNestingScopeDeepPage extends Page {
  declare state: CSSNestingScopeDeepPageState;
  _inited: boolean = false;
  _dynamicStyles: HTMLStyleElement[] = [];


  initialState(): CSSNestingScopeDeepPageState {
    return {
      logs: [],
      capsSummary: '',
      nestingBasicInfo: '',     // Card 1：CSS Nesting 基础与 & 父选择器
      syntaxRulesInfo: '',      // Card 2：嵌套语法规则与解析顺序
      scopeBasicInfo: '',       // Card 3：@scope 作用域规则基础
      donutScopeInfo: '',       // Card 4：@scope 甜甜圈模型 Donut Scope 深潜
      scopePseudoInfo: '',      // Card 5：@scope 与 :scope 伪类
      layerScopeInfo: '',       // Card 6：CSS Nesting 与 @layer / @scope 协同
      scssMigrationInfo: '',    // Card 7：SCSS/Less 迁移与差异
      patternInfo: '',          // Card 8：实战模式与陷阱
    };
  }

  componentDidMount(): void {
    if (this._inited) return;
    this._inited = true;

    this._dynamicStyles = [];

    const f = this._flags();
    const c = (ok: boolean) => ok ? '✓' : '✗';
    const parts = [
      `& 父选择器 ${c(f.nestingBasic)}`,
      `&:hover ${c(f.nestingHover)}`,
      `.a & .b ${c(f.nestingMiddle)}`,
      `:scope ${c(f.scopePseudo)}`,
      `@scope ${c(f.atScope)}`,
      `@layer ${c(f.atLayer)}`,
      `@container ${c(f.containerType)}`,
    ];

    const summary = f.css
      ? `CSS Nesting & @scope 能力检测：${parts.join(' · ')}。jsdom 不做真实样式应用，但 CSS.supports('selector', ...) 可探测能力；按钮点击注入演示样式 + 完整代码示例，真实浏览器可查看效果。`
      : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击仅记日志说明，不会抛异常。';

    this.setState({ capsSummary: summary });
    this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.nestingBasic) this._addLog('warn', 'CSS Nesting 不可用（Chrome 112+/Firefox 117+/Safari 16.5+）');
    if (!f.atScope) this._addLog('warn', '@scope 不可用（Chrome 118+/Safari 17.4+）');
    if (!f.atLayer) this._addLog('info', '@layer 不可用（Chrome 99+/Firefox 97+/Safari 15.4+）');

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

  _btn(label: string, opts: BtnOpts): Node {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render() as Node;
  }

  _caps(): any;
  _caps(items: [string, boolean][]): Node[];
  _caps(items?: [string, boolean][]): any {
    return items!.map(([label, ok]: [string, boolean]) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  _injectStyle(id: any,css: any) {
    const existing = (document.getElementById(id) as any);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
    this._dynamicStyles.push(style);
  }

  _injectBaseStyles(): void {
    this._injectStyle('css-ns-base', `
      .ns-demo {
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
      }
      /* 原生 CSS Nesting 演示 */
      .ns-parent {
        color: #1e40af;
        font-weight: 600;
        padding: 8px;
        border: 1px dashed #93c5fd;
        border-radius: 6px;
        & .child {
          color: #ef4444;
          font-weight: 400;
          padding: 4px 8px;
        }
        & > .direct {
          color: #10b981;
        }
        &:hover {
          background: #fef3c7;
        }
        & + .sibling {
          color: #8b5cf6;
        }
      }
      .ns-host {
        background: #f1f5f9;
        padding: 12px;
        border-radius: 6px;
        border: 1px solid #cbd5e1;
      }
      /* @scope + :scope 演示（若支持） */
      .ns-card {
        background: #fff;
        padding: 12px;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        & .ns-card-title {
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 4px;
        }
        & .ns-card-body {
          color: #475569;
          font-size: 13px;
        }
        &:hover {
          border-color: #3b82f6;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
        }
      }
      .ns-output {
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
      .ns-box {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 6px 12px;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        color: #fff;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        margin: 4px;
      }
      .ns-state {
        display: inline-flex;
        align-items: center;
        padding: 6px 12px;
        background: #e0e7ff;
        color: #3730a3;
        border-radius: 6px;
        font-size: 12px;
        margin: 4px;
        transition: all 0.2s ease;
        &:hover {
          background: #c7d2fe;
        }
        &.is-active {
          background: #3b82f6;
          color: #fff;
        }
        &[disabled] {
          background: #e5e7eb;
          color: #9ca3af;
          cursor: not-allowed;
        }
      }
    `);
  }

  _flags(): any {
    const hasCSS = typeof CSS !== 'undefined';
    const supportsSel = (sel: any) => {
      try { return hasCSS && typeof CSS.supports === 'function' && CSS.supports('selector', sel); }
      catch { return false; }
    };
    const supportsPV = (p: string, v: string) => {
      try { return hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v); }
      catch { return false; }
    };
    const testAtRule = (cssText: any) => {
      try {
        if (typeof CSSStyleSheet === 'undefined') return false;
        const sheet = new CSSStyleSheet();
        sheet.insertRule(cssText, 0);
        return true;
      } catch { return false; }
    };
    return {
      css: hasCSS,
      supports: hasCSS && typeof CSS.supports === 'function',
      nestingBasic: supportsSel('& > a'),
      nestingHover: supportsSel('&:hover'),
      nestingMiddle: supportsSel('.a & .b'),
      scopePseudo: supportsSel(':scope'),
      atScope: testAtRule('@scope (.ns-host) { p { color: red; } }'),
      atLayer: testAtRule('@layer ns-base { .ns-demo { color: red; } }'),
      containerType: supportsPV('container-type', 'inline-size'),
    };
  }

  // ===================== Card 1：CSS Nesting 基础与 & 父选择器 =====================

  _runNestingBasicDemo(): void {
    const f = this._flags();
    this._injectStyle('ns-nesting-basic-demo', `
      .ns-nb-host {
        padding: 12px;
        background: linear-gradient(135deg, #dbeafe, #ede9fe);
        border-radius: 8px;
        margin-top: 10px;
      }
      .ns-nb-parent {
        color: #1e40af;
        font-weight: 600;
        padding: 8px;
        border: 1px dashed #93c5fd;
        border-radius: 6px;
        & .child {
          color: #ef4444;
          font-weight: 400;
          padding: 4px 8px;
          border-left: 3px solid #ef4444;
        }
        & > .direct {
          color: #10b981;
          font-weight: 600;
        }
        &:hover {
          background: #fef3c7;
          border-color: #f59e0b;
        }
        & + .sibling {
          color: #8b5cf6;
          font-style: italic;
        }
      }
    `);
    const info = [
      '===== CSS Nesting 基础与 & 父选择器 =====',
      '',
      '【基础语法：& 表示父选择器引用】',
      '  .parent {',
      '    color: red;',
      '    & .child { color: blue; }        /* 等价 .parent .child */',
      '    & > .direct { color: green; }    /* 等价 .parent > .direct */',
      '    &:hover { background: yellow; }  /* 等价 .parent:hover */',
      '    & + .sibling { color: purple; }  /* 等价 .parent + .sibling */',
      '  }',
      '',
      '【& 的本质：编译期替换为父选择器字符串】',
      '  /* 嵌套前的父选择器是什么，& 就代表什么 */',
      '  .foo {',
      '    & .bar { }       /* .foo .bar */',
      '    &.bar { }         /* .foo.bar（紧贴，无空格）*/',
      '    &:hover { }       /* .foo:hover */',
      '    &::before { }     /* .foo::before */',
      '  }',
      '  /* &:hover 中 & 紧贴 :hover 表示「父选择器本身 hover」*/',
      '  /* & .child 中 & 后有空格表示「父选择器下的 .child 后代」*/',
      '',
      '【嵌套任意层级】',
      '  .grandparent {',
      '    color: black;',
      '    & .parent {',
      '      color: blue;',
      '      & .child {',
      '        color: red;',
      '        & .grandchild {',
      '          color: green;',
      '        }',
      '      }',
      '    }',
      '  }',
      '  /* 等价：',
      '     .grandparent { color: black; }',
      '     .grandparent .parent { color: blue; }',
      '     .grandparent .parent .child { color: red; }',
      '     .grandparent .parent .child .grandchild { color: green; }',
      '  */',
      '',
      '【原生 Nesting vs Sass/LESS 预编译差异】',
      '  原生 CSS Nesting：',
      '    + 浏览器原生支持，无需构建工具',
      '    + 运行时解析，CSSOM 直接处理',
      '    + & 是「选择器引用」，浏览器理解父子关系',
      '    + 支持 :is()/:where() 等现代选择器特性',
      '    - 浏览器支持较新（Chrome 112+/FF 117+/Safari 16.5+）',
      '',
      '  Sass/LESS：',
      '    + 编译期字符串拼接，输出标准 CSS',
      '    + 兼容所有浏览器（编译后是普通 CSS）',
      '    - & 是「字符串替换」，不理解选择器语义',
      '    - 需要构建步骤（node-sass/dart-sass/less）',
      '    - 复杂嵌套可能产生冗长的选择器输出',
      '',
      '  /* 原生与 SCSS 输出格式差异：*/',
      '  /* 原生：浏览器内部展开为 :is(.parent) .child 形式 */',
      '  /* SCSS：编译为 .parent .child 字符串拼接 */',
      '  /* 语义等价，但 specificity 计算可能略有差异（:is() 取最大）*/',
      '',
      '【原生 Nesting 的 :is() 包装规则】',
      '  /* 原生 Nesting 在某些场景会自动用 :is() 包装 */',
      '  .a, .b {',
      '    & .c { }  /* 等价 :is(.a, .b) .c，而非 .a .c, .b .c */',
      '  }',
      '  /* :is() 的 specificity 取其参数中最大的 specificity */',
      '  /* SCSS 则展开为 .a .c, .b .c 两条独立规则 */',
      '',
      '【浏览器支持】',
      `  CSS.supports('selector', '& > a'): ${f.nestingBasic ? '✓' : '✗'}`,
      '  Chrome 112+（2023-04）',
      '  Firefox 117+（2023-08）',
      '  Safari 16.5+（2023-04）',
      '  Edge 112+',
      '  // 旧浏览器需 PostCSS autoprefixer 或 postcss-nesting 转译',
      '',
      '【能力检测：CSS.supports(\'selector\', ...)】',
      '  // 检测原生 Nesting 支持',
      "  const supportsNesting = CSS.supports('selector', '& > a');",
      '  // 返回 true 表示浏览器原生支持 & 嵌套',
      '  // 可用于渐进增强：不支持时加载预处理器产物',
      '',
      '  // 检测 & 在选择器中间',
      "  const supportsMiddle = CSS.supports('selector', '.a & .b');",
      '',
      '【常见陷阱】',
      '  1. & 与子选择器之间是否带空格决定语义',
      '     & .child → 后代选择器（带空格）',
      '     &.child → 复合选择器（无空格，父同时具备 .child）',
      '  2. & 不可省略（除非嵌套选择器以 : . # [ * 开头，见 Card 2）',
      '  3. 嵌套过深会导致选择器过长且 specificity 升高',
      '     → 建议不超过 3 层',
      '  4. 原生 Nesting 与 SCSS 输出格式不同，迁移需测试 specificity',
    ].join('\n');
    this.setState({ nestingBasicInfo: info });
    this._addLog('css', `CSS Nesting 基础演示完成；supports=${f.nestingBasic}`);
  }

  _renderCard1(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. CSS Nesting 基础与 & 父选择器',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['& > a', f.nestingBasic],
          ['&:hover', f.nestingHover],
        ]),
        h(Tag, { color: 'primary' }, 'Nesting L1'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'CSS Nesting Module Level 1：.parent { color: red; & .child { } & > .direct { } &:hover { } & + .sibling { } }。& 表示父选择器引用，可嵌套任意层级。原生 vs Sass/LESS 预编译差异：原生是浏览器运行时解析、& 是选择器引用；Sass 是编译期字符串拼接。Chrome 112+/Firefox 117+/Safari 16.5+ 支持。CSS.supports(\'selector\', \'& > a\') 检测能力。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 Nesting 基础演示', { type: 'primary', size: 'sm', onClick: () => this._runNestingBasicDemo() }),
        ),
        h('div', { class: 'ns-nb-host' },
          h('div', { class: 'ns-nb-parent' },
            'parent',
            h('div', { class: 'child' }, 'child（后代）'),
            h('div', { class: 'direct' }, 'direct（直接子元素）'),
          ),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, `.parent {
  color: red;
  & .child { color: blue; }       /* .parent .child */
  & > .direct { color: green; }   /* .parent > .direct */
  &:hover { background: yellow; } /* .parent:hover */
  & + .sibling { color: purple; } /* .parent + .sibling */
  /* & 紧贴 = 复合选择器；& 带空格 = 后代选择器 */
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '完整参考：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.nestingBasicInfo || '（点击按钮查看 CSS Nesting 基础与 & 父选择器完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 2：嵌套语法规则与解析顺序 =====================

  _runSyntaxRulesDemo(): void {
    const f = this._flags();
    this._injectStyle('ns-syntax-rules-demo', `
      .ns-sr-host {
        padding: 12px;
        background: #f0f9ff;
        border-radius: 8px;
        margin-top: 10px;
      }
      .ns-sr-target {
        position: relative;
        padding: 12px;
        background: #fff;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        &::before {
          content: '★';
          color: #f59e0b;
          margin-right: 6px;
        }
        &.is-active {
          border-color: #3b82f6;
          background: #eff6ff;
        }
        @media (max-width: 768px) {
          padding: 8px;
          font-size: 12px;
        }
        @container (min-width: 400px) {
          padding: 16px;
        }
      }
      .ns-sr-a {
        color: #1e40af;
        & + & {
          margin-top: 8px;
          border-top: 1px dashed #93c5fd;
          padding-top: 8px;
        }
      }
    `);
    const info = [
      '===== 嵌套语法规则与解析顺序 =====',
      '',
      '【规则 1：嵌套选择器必须以特定字符开头，否则需显式 &】',
      '  // 以下字符开头的嵌套选择器可省略 &：',
      '  //   &  @  :  .  #  [  *',
      '  // 其他开头（如标签名 a、div）必须用 & 显式引用父选择器',
      '',
      '  .parent {',
      '    .child { }        /* 合法：以 . 开头 */',
      '    #id { }           /* 合法：以 # 开头 */',
      '    :hover { }        /* 合法：以 : 开头（但语义不明，建议 &:hover）*/',
      '    [data-x] { }      /* 合法：以 [ 开头 */',
      '    * { }             /* 合法：以 * 开头 */',
      '    /* 标签名开头必须用 & */',
      '    & span { }        /* 合法：& 引用父，等价 .parent span */',
      '    span { }          /* ❌ 非法：会被当作属性 span 解析 */',
      '  }',
      '',
      '【规则 2：复杂选择器嵌套 & .a + .b】',
      '  .parent {',
      '    & .a + .b { }     /* .parent .a + .b */',
      '    & > .a ~ .b { }   /* .parent > .a ~ .b */',
      '    & .a & .b { }     /* .parent .a .parent .b（& 出现两次）*/',
      '  }',
      '',
      '【规则 3：组合器使用 & + &、& ~ &】',
      '  .item {',
      '    & + & { }         /* .item + .item：相邻兄弟 */',
      '    & ~ & { }         /* .item ~ .item：一般兄弟 */',
      '  }',
      '  /* 常用于列表项间距、状态切换 */',
      '  .list-item {',
      '    & + & { margin-top: 8px; }  /* 列表项之间加间距 */',
      '  }',
      '',
      '【规则 4：嵌套伪元素 &::before】',
      '  .card {',
      '    &::before {       /* .card::before */',
      '      content: "";',
      '      display: block;',
      '    }',
      '    &::after {        /* .card::after */',
      '      content: "";',
      '      clear: both;',
      '    }',
      '  }',
      '  /* & 紧贴 ::before 表示父元素的伪元素 */',
      '',
      '【规则 5：嵌套 at-rule @media / @supports / @container 直接嵌套】',
      '  .card {',
      '    padding: 16px;',
      '    @media (max-width: 768px) {',
      '      padding: 8px;       /* 嵌套在 .card 内，无需跳出 */',
      '    }',
      '    @supports (backdrop-filter: blur(10px)) {',
      '      backdrop-filter: blur(10px);',
      '    }',
      '    @container (min-width: 400px) {',
      '      padding: 24px;      /* 容器查询嵌套 */',
      '    }',
      '  }',
      '  /* at-rule 内部仍可继续嵌套普通规则 */',
      '  .card {',
      '    @media (max-width: 768px) {',
      '      & .title { font-size: 12px; }  /* at-rule 内再嵌套 */',
      '    }',
      '  }',
      '',
      '【规则 6：& 在选择器中间 .a & .b 父级嵌入】',
      '  .parent {',
      '    .a & .b { }      /* .a .parent .b：& 被替换到中间位置 */',
      '  }',
      '  /* 常用于「在特定祖先下修改当前组件」场景 */',
      '  .my-component {',
      '    .sidebar & {       /* .sidebar .my-component */',
      '      width: 200px;',
      '    }',
      '    .modal & {         /* .modal .my-component */',
      '      position: absolute;',
      '    }',
      '  }',
      '  /* SCSS 中常见模式，原生 Nesting 完全支持 */',
      '',
      '【解析顺序：从外到内逐层展开】',
      '  .a {',
      '    color: red;',
      '    & .b {',
      '      color: blue;',
      '      & .c {',
      '        color: green;',
      '      }',
      '    }',
      '  }',
      '  /* 浏览器解析顺序：*/',
      '  /* 1. .a { color: red; } */',
      '  /* 2. .a .b { color: blue; } */',
      '  /* 3. .a .b .c { color: green; } */',
      '  /* 每层 & 替换为当前累积的父选择器 */',
      '',
      '【原生 Nesting 的 :is() 包装行为】',
      '  /* 当父选择器是选择器列表时，原生用 :is() 包装 */',
      '  .a, .b {',
      '    & .c { }   /* :is(.a, .b) .c */',
      '  }',
      '  /* SCSS 展开为两条：.a .c, .b .c */',
      '  /* specificity 不同：:is(.a, .b) 取最大 specificity */',
      '',
      '【相对选择器 vs 绝对选择器】',
      '  /* 嵌套内的选择器是「相对」的，相对父选择器 */',
      '  .parent {',
      '    & .child { }   /* 相对：.parent .child */',
      '  }',
      '  /* 顶层规则是「绝对」的 */',
      '  .global { }      /* 绝对：.global */',
      '',
      '【浏览器支持】',
      `  &:hover 嵌套: ${f.nestingHover ? '✓' : '✗'}`,
      `  .a & .b 中间嵌套: ${f.nestingMiddle ? '✓' : '✗'}`,
      `  @container 嵌套: ${f.containerType ? '✓' : '✗'}`,
      '  // Chrome 112+/FF 117+/Safari 16.5+ 完整支持',
      '',
      '【常见陷阱】',
      '  1. 标签名开头必须用 &（a, div, span 等不能直接嵌套）',
      '     .parent { a { } }      /* ❌ 非法，a 被当作属性 */',
      '     .parent { & a { } }    /* ✓ 合法 */',
      '  2. & 在选择器中间时，注意 specificity 计算',
      '  3. at-rule 嵌套不会创建新作用域，属性会合并到外层规则',
      '  4. 复杂组合器 & + & 在原生中可能产生 :is(.item + .item) 形式',
    ].join('\n');
    this.setState({ syntaxRulesInfo: info });
    this._addLog('css', `嵌套语法规则演示完成；supports=${f.nestingHover}/${f.nestingMiddle}`);
  }

  _renderCard2(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. 嵌套语法规则与解析顺序',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['.a & .b', f.nestingMiddle],
          ['@container', f.containerType],
        ]),
        h(Tag, { color: 'primary' }, '语法规则'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '嵌套选择器必须以 & / @ / : / . / # / [ / * 开头否则需显式 &（如标签名 a 必须写 & a）。复杂选择器嵌套 & .a + .b；组合器 & + &、& ~ &；伪元素 &::before；at-rule 直接嵌套 @media / @supports / @container 无需跳出；& 在选择器中间 .a & .b 父级嵌入。解析顺序从外到内逐层展开，& 替换为累积父选择器。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行语法规则演示', { type: 'primary', size: 'sm', onClick: () => this._runSyntaxRulesDemo() }),
        ),
        h('div', { class: 'ns-sr-host' },
          h('div', { class: 'ns-sr-target is-active' }, 'target（is-active + ::before）'),
          h('div', { class: 'ns-sr-a' }, 'item A（& + & 应用间距）'),
          h('div', { class: 'ns-sr-a' }, 'item B（& + & 应用间距）'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, `.card {
  &::before { content: ""; }
  &.is-active { border-color: blue; }
  @media (max-width: 768px) {
    padding: 8px;       /* at-rule 直接嵌套 */
    & .title { font-size: 12px; }
  }
  /* 标签名必须用 & */
  & span { color: gray; }
  /* & 在中间 */
  .sidebar & { width: 200px; }
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '完整参考：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.syntaxRulesInfo || '（点击按钮查看嵌套语法规则与解析顺序完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 3：@scope 作用域规则基础 =====================

  _runScopeBasicDemo(): void {
    const f = this._flags();
    this._injectStyle('ns-scope-basic-demo', `
      .ns-sb-host {
        padding: 12px;
        background: #fef3c7;
        border-radius: 8px;
        margin-top: 10px;
      }
      .ns-sb-outside {
        padding: 8px;
        background: #fee2e2;
        border-radius: 6px;
        color: #991b1b;
        margin-bottom: 8px;
      }
      .ns-sb-target {
        padding: 8px;
        background: #dbeafe;
        border-radius: 6px;
        color: #1e40af;
      }
    `);
    const info = [
      '===== @scope 作用域规则基础 =====',
      '',
      '【基础语法：@scope (<scope-start>) { } 】',
      '  @scope (.host) {',
      '    p { color: red; }            /* 仅匹配 .host 内的 p */',
      '    .child { color: blue; }      /* 仅匹配 .host 内的 .child */',
      '    a { text-decoration: none; }',
      '  }',
      '  /* @scope 限定其内部所有选择器只匹配 .host 子树内的元素 */',
      '  /* .host 外的 p / .child / a 不受影响 */',
      '',
      '【@scope 的作用：限定选择器作用范围】',
      '  /* 问题：.title 选择器会匹配全局所有 .title */',
      '  .title { color: red; }   /* 影响所有 .title，包括其他组件 */',
      '',
      '  /* 解决：用 @scope 限定 */',
      '  @scope (.card) {',
      '    .title { color: red; }   /* 仅 .card 内的 .title */',
      '  }',
      '  /* 其他组件的 .title 不受影响 */',
      '',
      '【scope-start：作用域起点（根边界）】',
      '  /* 单选择器 */',
      '  @scope (.card) { }',
      '',
      '  /* 选择器列表 */',
      '  @scope (.card, .panel) { }   /* 任一匹配即作为作用域根 */',
      '',
      '  /* 复杂选择器 */',
      '  @scope (.container > .card) { }',
      '',
      '【甜甜圈模型 Donut Scope：@scope (.host) to (.limit) { }】',
      '  /* 从 .host 开始到 .limit 结束，排除 .limit 子树 */',
      '  @scope (.article) to (.comments) {',
      '    p { color: black; }   /* .article 内 .comments 之外的 p */',
      '  }',
      '  /* .comments 内的 p 不受规则影响（被 .limit 中断）*/',
      '  /* 形如甜甜圈：外圈受规则，中间洞不受规则 */',
      '',
      '  /* scope-end：作用域终点（边界，排除其子树）*/',
      '  @scope (.article) to (.comments, .sidebar) {',
      '    p { }   /* .article 内 .comments 和 .sidebar 之外的 p */',
      '  }',
      '  /* 多个 scope-end 用逗号分隔 */',
      '',
      '【作用域可被中断（与后代选择器的关键区别）】',
      '  /* 后代选择器 .host .child 会匹配 .host 内所有层级的 .child */',
      '  .host .child { color: red; }',
      '  /* 即使 .child 嵌套在 .limit 内也匹配 */',
      '',
      '  /* @scope 可被 scope-end 中断 */',
      '  @scope (.host) to (.limit) {',
      '    .child { color: red; }   /* .limit 内的 .child 不匹配 */',
      '  }',
      '  /* 这就是 Donut Scope 的核心价值 */',
      '',
      '【@scope vs 后代选择器 .host .child】',
      '  .host .child { }                /* 后代选择器，无法中断 */',
      '  @scope (.host) { .child { } }   /* @scope，可被 to() 中断 */',
      '',
      '  // specificity 对比：',
      '  //   .host .child        → (0,2,0)',
      '  //   @scope (.host) .child → (0,2,0)  /* @scope 不计入 specificity */',
      '  // 两者 specificity 相同，但 @scope 可被中断',
      '',
      '【@scope 不计入 specificity】',
      '  /* @scope (.host) { .child { } } 的 specificity = .child 的 specificity */',
      '  /* 但 scope-start (.host) 会计入（作为 :scope 上下文）*/',
      '  /* 实际 specificity：.host .child → (0,2,0) */',
      '  /* 与直接写 .host .child 一致 */',
      '',
      '【@scope 内可使用 & 嵌套】',
      '  @scope (.card) {',
      '    & .title { }        /* .card .title */',
      '    &:hover { }         /* .card:hover */',
      '    & > .body { }',
      '  }',
      '  /* & 引用 scope-start 选择器 */',
      '',
      '【浏览器支持】',
      `  @scope: ${f.atScope ? '✓' : '✗'}`,
      '  Chrome 118+（2023-10）',
      '  Safari 17.4+（2024-03）',
      '  Firefox 暂未支持（截至 2024 年）',
      '  // 较新特性，需检测后使用',
      '',
      '【常见陷阱】',
      '  1. scope-end 是「边界」，其子树被排除，但边界元素本身仍属于作用域',
      '  2. @scope 不可嵌套 @scope（每个 @scope 独立）',
      '  3. scope-start 必须是有效选择器，不能是 * （需具体元素）',
      '  4. @scope 内的 :scope 引用作用域根，详见 Card 5',
      '  5. Firefox 暂未支持，需检测或预处理器降级',
    ].join('\n');
    this.setState({ scopeBasicInfo: info });
    this._addLog('css', `@scope 基础演示完成；supports=${f.atScope}`);
  }

  _renderCard3(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. @scope 作用域规则基础',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['@scope', f.atScope]]),
        h(Tag, { color: 'primary' }, 'Cascading L6'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '@scope (.host) { } 限定选择器只匹配 .host 内元素。@scope (.host) to (.limit) { } 甜甜圈模型 Donut Scope —— 从 .host 开始到 .limit 结束排除中间子树。作用域外不再受规则影响。与后代选择器 .host .child 的区别：作用域可被 scope-end 中断，后代选择器无法中断。@scope 不计入 specificity（与 .host .child 一致）。Chrome 118+/Safari 17.4+ 支持。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 @scope 基础演示', { type: 'primary', size: 'sm', onClick: () => this._runScopeBasicDemo() }),
        ),
        h('div', { class: 'ns-sb-host' },
          h('div', { class: 'ns-sb-outside' }, 'outside .host（不受 @scope 影响）'),
          h('div', { class: 'ns-sb-target' }, '.host 内元素（受 @scope 影响）'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, `@scope (.card) {
  .title { color: red; }     /* 仅 .card 内 .title */
  .body { color: gray; }
}
/* Donut Scope：排除 .comments 子树 */
@scope (.article) to (.comments) {
  p { color: black; }        /* .article 内 .comments 之外的 p */
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '完整参考：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.scopeBasicInfo || '（点击按钮查看 @scope 作用域规则基础完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 4：@scope 甜甜圈模型 Donut Scope 深潜 =====================

  _runDonutScopeDemo(): void {
    const f = this._flags();
    this._injectStyle('ns-donut-scope-demo', `
      .ns-ds-host {
        padding: 12px;
        background: #ecfdf5;
        border-radius: 8px;
        margin-top: 10px;
      }
      .ns-ds-article {
        padding: 8px;
        background: #d1fae5;
        border-radius: 6px;
      }
      .ns-ds-comments {
        padding: 8px;
        background: #fee2e2;
        border-radius: 6px;
        margin-top: 6px;
      }
    `);
    const info = [
      '===== @scope 甜甜圈模型 Donut Scope 深潜 =====',
      '',
      '【Donut Scope 概念】',
      '  /* 甜甜圈：外圈受规则，中间洞不受规则 */',
      '  @scope (.article) to (.comments) {',
      '    p { color: black; }',
      '  }',
      '  /* .article 是 scope-start（外圈）*/',
      '  /* .comments 是 scope-end（中间洞）*/',
      '  /* .article 内、.comments 之外的 p 受规则影响 */',
      '  /* .comments 内的 p 不受规则影响 */',
      '',
      '【结构示意】',
      '  <article class="article">          ← scope-start',
      '    <p>这段受规则影响（外圈）</p>',
      '    <div class="comments">           ← scope-end（边界）',
      '      <p>这段不受规则影响（洞）</p>',
      '      <div>',
      '        <p>这段也不受规则影响（洞内更深）</p>',
      '      </div>',
      '    </div>',
      '    <p>这段受规则影响（外圈，洞外）</p>',
      '  </article>',
      '',
      '【边界元素本身的归属】',
      '  /* scope-start（.article）：包含在作用域内 */',
      '  @scope (.article) to (.comments) {',
      '    :scope { border: 1px solid; }   /* .article 本身受规则 */',
      '  }',
      '',
      '  /* scope-end（.comments）：不包含在作用域内 */',
      '  @scope (.article) to (.comments) {',
      '    .comments { }   /* ❌ 不匹配，.comments 已超出作用域 */',
      '  }',
      '  /* scope-end 是「边界」，从其开始（含）排除 */',
      '',
      '【多层 scope boundaries：to (.a, .b, .c)】',
      '  @scope (.article) to (.comments, .sidebar, .footer) {',
      '    p { color: black; }',
      '  }',
      '  /* .article 内 .comments / .sidebar / .footer 之外的 p 受规则影响 */',
      '  /* 三个边界子树都被排除 */',
      '  /* 适合「文章主体样式，排除侧边栏/评论/页脚」场景 */',
      '',
      '【降低优先级避免深度选择器】',
      '  /* 问题：深度选择器 specificity 高，难以覆盖 */',
      '  .article .body .content p { color: black; }   /* (0,3,1) */',
      '  /* 后续想覆盖需更高 specificity 或 !important */',
      '',
      '  /* @scope 方案：specificity 更低，更易覆盖 */',
      '  @scope (.article) to (.comments) {',
      '    p { color: black; }   /* (0,0,1) + scope 上下文 */',
      '  }',
      '  /* specificity 计算更清晰，避免选择器战争 */',
      '',
      '【@scope vs .article .body .content p specificity 对比】',
      '  .article .body .content p   → (0,3,1)',
      '  @scope (.article) p         → 约 (0,1,1)（scope-start 计入 :scope 上下文）',
      '  /* specificity 一致但作用域更清晰的说法不准确 */',
      '  /* 实际上 @scope 能用更短的选择器达到同样的限定效果 */',
      '  /* 避免了 .article .body .content p 这种冗长链 */',
      '',
      '【实战：文章排版限定作用域】',
      '  @scope (.prose) to (.callout, .code-block) {',
      '    h2 { font-size: 1.5em; margin-top: 1.5em; }',
      '    p { line-height: 1.7; margin: 1em 0; }',
      '    a { color: #3b82f6; text-decoration: underline; }',
      '    ul { padding-left: 1.5em; }',
      '    /* .callout 和 .code-block 内的元素不受影响 */',
      '  }',
      '  /* 适合博客/文档系统，主体样式不影响嵌入组件 */',
      '',
      '【实战：组件库样式隔离】',
      '  @scope (.my-component) to (.my-component .third-party) {',
      '    /* 组件样式不污染第三方嵌入内容 */',
      '    .button { background: blue; }',
      '    .input { border: 1px solid; }',
      '  }',
      '',
      '【scope-end 可以是相对选择器】',
      '  @scope (.article) to (.comments, [data-skip]) {',
      '    p { }',
      '  }',
      '  /* 任何带 data-skip 属性的元素都作为边界 */',
      '',
      '【嵌套 @scope 不允许】',
      '  /* ❌ 错误：@scope 不能嵌套 @scope */',
      '  @scope (.a) {',
      '    @scope (.b) { }   /* 语法错误 */',
      '  }',
      '  /* 每个作用域独立定义 */',
      '',
      '【浏览器支持】',
      `  @scope with to(): ${f.atScope ? '✓' : '✗'}`,
      '  Chrome 118+（完整支持 scope-end）',
      '  Safari 17.4+',
      '  Firefox 暂未支持',
      '',
      '【常见陷阱】',
      '  1. scope-end 是「边界元素」本身及其整个子树都被排除',
      '  2. scope-end 元素本身不匹配作用域内规则',
      '  3. 多个 scope-end 用逗号分隔，任一匹配即排除',
      '  4. Donut Scope 不能用后代选择器模拟（后代选择器无法中断）',
      '  5. specificity 计算需注意 :scope 上下文的影响',
      '  6. Firefox 暂未支持，生产环境需检测或 BEM 替代',
    ].join('\n');
    this.setState({ donutScopeInfo: info });
    this._addLog('css', `Donut Scope 演示完成；supports=${f.atScope}`);
  }

  _renderCard4(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. @scope 甜甜圈模型 Donut Scope 深潜',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['@scope to()', f.atScope]]),
        h(Tag, { color: 'primary' }, 'Donut'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '@scope (.article) to (.comments) { p { } } —— .article 内 .comments 之外的 p 受规则影响，.comments 内 p 不受影响。多层 scope boundaries to (.a, .b, .c)。降低优先级避免深度选择器：@scope vs .article .body .content p，作用域更清晰，specificity 计算更明确。包含根边界（scope-start），排除终点（scope-end）。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 Donut Scope 演示', { type: 'primary', size: 'sm', onClick: () => this._runDonutScopeDemo() }),
        ),
        h('div', { class: 'ns-ds-host' },
          h('div', { class: 'ns-ds-article' },
            'article（scope-start，受规则）',
            h('div', { class: 'ns-ds-comments' }, 'comments（scope-end，不受规则）'),
          ),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, `@scope (.article) to (.comments) {
  p { color: black; }
  /* .article 内 .comments 之外的 p 受规则 */
  /* .comments 内的 p 不受影响 */
}
/* 多层边界 */
@scope (.article) to (.comments, .sidebar, .footer) {
  p { line-height: 1.7; }
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '完整参考：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.donutScopeInfo || '（点击按钮查看 Donut Scope 甜甜圈模型完整深潜）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 5：@scope 与 :scope 伪类 =====================

  _runScopePseudoDemo(): void {
    const f = this._flags();
    this._injectStyle('ns-scope-pseudo-demo', `
      .ns-sp-host {
        padding: 12px;
        background: #fce7f3;
        border-radius: 8px;
        margin-top: 10px;
      }
      .ns-sp-card {
        padding: 12px;
        background: #fff;
        border: 2px solid #e2e8f0;
        border-radius: 6px;
        transition: border-color 0.2s;
      }
    `);
    const info = [
      '===== @scope 与 :scope 伪类 =====',
      '',
      '【:scope 伪类：引用当前作用域根元素】',
      '  /* 在 @scope 块内，:scope 引用 scope-start 匹配的元素 */',
      '  @scope (.card) {',
      '    :scope {                  /* 引用 .card 本身 */',
      '      border: 1px solid;',
      '      padding: 16px;',
      '    }',
      '    :scope:hover {            /* .card:hover */',
      '      border-color: blue;',
      '    }',
      '    :scope > .title {         /* .card > .title（直接子元素）*/',
      '      font-size: 1.2em;',
      '    }',
      '    :scope .body {            /* .card .body（后代）*/',
      '      color: gray;',
      '    }',
      '  }',
      '',
      '【:scope vs & 在 @scope 内的语义差异】',
      '  @scope (.card) {',
      '    :scope { }        /* 引用作用域根 .card */',
      '    & { }             /* 也引用 .card，但语义不同 */',
      '  }',
      '',
      '  // :scope 是「伪类」，明确表示「当前作用域根」',
      '  // & 是「父选择器引用」，是字符串替换',
      '  // 在 @scope 内，两者都引用 scope-start，但：',
      '  //   :scope:hover → .card:hover（伪类语法，specificity (0,2,0)）',
      '  //   &:hover      → .card:hover（字符串拼接，specificity (0,2,0)）',
      '  // 结果等价，但 :scope 更明确表达「作用域根」语义',
      '',
      '【:scope 的 specificity】',
      '  :scope 的 specificity 等同于 :is(.scope-start) 或类选择器 (0,1,0)',
      '  /* @scope (.card) { :scope { } } 的 specificity = (0,1,0) */',
      '  /* 但实际包含 scope-start 上下文，约 (0,2,0) */',
      '',
      '【作用域根的样式设置】',
      '  /* 直接用 :scope 设置作用域根本身样式 */',
      '  @scope (.panel) {',
      '    :scope {',
      '      display: flex;',
      '      flex-direction: column;',
      '      gap: 12px;',
      '      padding: 20px;',
      '      background: #f8fafc;',
      '    }',
      '    :scope[data-variant="primary"] {',
      '      background: #dbeafe;',
      '    }',
      '  }',
      '',
      '【:scope 在 querySelector 中的历史用法】',
      '  // :scope 在 querySelector 中表示「调用方法的元素」',
      '  const card = document.querySelector(".card");',
      '  card.querySelector(":scope > .title");  // 仅查直接子元素 .title',
      '  // 不带 :scope 时 .title 会匹配所有后代',
      '',
      '  // 在 @scope 中，:scope 语义升级为「作用域根」',
      '',
      '【:scope 与 & 组合使用】',
      '  @scope (.card) {',
      '    :scope {                  /* .card */',
      '      border: 1px solid;',
      '    }',
      '    &.is-active {             /* .card.is-active */',
      '      border-color: blue;',
      '    }',
      '    :scope.is-active {        /* .card.is-active，等价 */',
      '      border-color: blue;',
      '    }',
      '  }',
      '',
      '【@scope 外的 :scope】',
      '  /* 不在 @scope 内时，:scope 行为退化 */',
      '  /* 在 :has()、querySelector 等场景中表示「调用上下文」*/',
      '  .parent :scope .child { }   /* :scope 在普通 CSS 中较少使用 */',
      '  /* 在 @scope 内才是「作用域根」语义 */',
      '',
      '【实战：组件根样式与子元素样式统一管理】',
      '  @scope (.my-component) {',
      '    :scope {',
      '      display: grid;',
      '      grid-template-columns: 1fr 3fr;',
      '      gap: 16px;',
      '    }',
      '    :scope > header {         /* 直接子元素 header */',
      '      grid-column: 1 / -1;',
      '    }',
      '    :scope > main {           /* 直接子元素 main */',
      '      padding: 16px;',
      '    }',
      '    :scope[data-theme="dark"] {',
      '      background: #1e293b;',
      '      color: #e2e8f0;',
      '    }',
      '  }',
      '',
      '【浏览器支持】',
      `  :scope 伪类: ${f.scopePseudo ? '✓' : '✗'}`,
      `  @scope 内 :scope: ${f.atScope ? '✓' : '✗'}`,
      '  // :scope 伪类 Chrome 27+/Firefox 32+/Safari 7+（老特性）',
      '  // @scope 内 :scope 语义需要 Chrome 118+/Safari 17.4+',
      '',
      '【常见陷阱】',
      '  1. :scope 在 @scope 内才是「作用域根」，否则语义不同',
      '  2. :scope 与 & 在 @scope 内结果等价但语义不同',
      '  3. :scope 的 specificity 计算需注意 scope-start 上下文',
      '  4. 不要混淆 querySelector 中的 :scope 与 @scope 中的 :scope',
      '  5. 旧浏览器 :scope 在 querySelector 中支持，但 @scope 不支持',
    ].join('\n');
    this.setState({ scopePseudoInfo: info });
    this._addLog('css', `@scope :scope 演示完成；supports=${f.scopePseudo}/${f.atScope}`);
  }

  _renderCard5(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. @scope 与 :scope 伪类',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          [':scope', f.scopePseudo],
          ['@scope', f.atScope],
        ]),
        h(Tag, { color: 'primary' }, ':scope'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '@scope 块内 :scope 引用作用域根元素。@scope (.card) { :scope { } :scope:hover { } :scope > .title { } }。:scope vs & 在 @scope 内的语义差异：:scope 是伪类明确表示作用域根，& 是字符串替换；结果等价但语义不同。作用域根的样式设置直接用 :scope 选择器。:scope 伪类 Chrome 27+/Firefox 32+/Safari 7+，@scope 内 :scope 语义需 Chrome 118+/Safari 17.4+。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 :scope 演示', { type: 'primary', size: 'sm', onClick: () => this._runScopePseudoDemo() }),
        ),
        h('div', { class: 'ns-sp-host' },
          h('div', { class: 'ns-sp-card' }, ':scope 引用 .card（作用域根）'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, `@scope (.card) {
  :scope {                /* .card 本身 */
    border: 1px solid;
    padding: 16px;
  }
  :scope:hover {          /* .card:hover */
    border-color: blue;
  }
  :scope > .title {       /* .card > .title */
    font-size: 1.2em;
  }
  /* &:hover 等价 :scope:hover 但语义不同 */
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '完整参考：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.scopePseudoInfo || '（点击按钮查看 @scope 与 :scope 伪类完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 6：CSS Nesting 与 @layer / @scope 协同 =====================

  _runLayerScopeDemo(): void {
    const f = this._flags();
    this._injectStyle('ns-layer-scope-demo', `
      .ns-ls-host {
        padding: 12px;
        background: #f5f3ff;
        border-radius: 8px;
        margin-top: 10px;
      }
    `);
    const info = [
      '===== CSS Nesting 与 @layer / @scope 协同 =====',
      '',
      '【三层结构：@layer（层次）+ @scope（作用域）+ Nesting（结构）】',
      '  // @layer：控制样式表的「优先级层次」（cascade layer）',
      '  // @scope：控制样式的「作用范围」（scope）',
      '  // Nesting：控制样式的「结构组织」（组件内聚）',
      '  // 三者正交，可组合使用',
      '',
      '【嵌套与 @layer 结合】',
      '  @layer base {',
      '    .card {',
      '      & .title {              /* base 层中的嵌套 */',
      '        font-size: 1em;',
      '      }',
      '      & .body {',
      '        line-height: 1.5;',
      '      }',
      '    }',
      '  }',
      '  /* 嵌套在 @layer 内正常工作 */',
      '  /* @layer 控制整体优先级，嵌套控制组件结构 */',
      '',
      '【@scope 与 @layer 结合】',
      '  @layer components {',
      '    @scope (.card) {',
      '      .title { color: red; }',
      '      .body { color: gray; }',
      '    }',
      '  }',
      '  /* @scope 在 @layer 内，作用域限定 + 层次优先级 */',
      '  /* components 层的 .card 内 .title 才匹配 */',
      '',
      '【@scope 内嵌套】',
      '  @scope (.host) {',
      '    & .child {                /* .host .child */',
      '      color: red;',
      '    }',
      '    &:hover {                 /* .host:hover */',
      '      background: yellow;',
      '    }',
      '    & > .direct {             /* .host > .direct */',
      '      color: green;',
      '    }',
      '  }',
      '  /* @scope 内 & 引用 scope-start 选择器 */',
      '  /* 与普通嵌套语法一致 */',
      '',
      '【完整三层组合示例】',
      '  /* 1. 声明层次顺序（优先级从低到高）*/',
      '  @layer reset, base, components, utilities;',
      '',
      '  /* 2. reset 层 */',
      '  @layer reset {',
      '    * { margin: 0; padding: 0; box-sizing: border-box; }',
      '  }',
      '',
      '  /* 3. base 层 + 嵌套 */',
      '  @layer base {',
      '    body {',
      '      font-family: system-ui;',
      '      & .container {',
      '        max-width: 1200px;',
      '        margin: 0 auto;',
      '      }',
      '    }',
      '  }',
      '',
      '  /* 4. components 层 + @scope + 嵌套 */',
      '  @layer components {',
      '    @scope (.card) {',
      '      :scope {                /* .card */',
      '        border: 1px solid;',
      '        padding: 16px;',
      '      }',
      '      & .title {              /* .card .title */',
      '        font-weight: bold;',
      '      }',
      '      & .body {',
      '        color: gray;',
      '      }',
      '    }',
      '  }',
      '',
      '  /* 5. utilities 层（最高优先级）*/',
      '  @layer utilities {',
      '    .text-center { text-align: center; }',
      '    .mt-4 { margin-top: 1rem; }',
      '  }',
      '',
      '【@layer 层次优先级规则】',
      '  // 后声明的 layer 优先级高于先声明的',
      '  // @layer a, b, c; → c > b > a',
      '  // 未声明 layer 的样式优先级最高（高于所有 layer）',
      '  // 同一 layer 内按源码顺序',
      '',
      '【组织大型样式表的三层结构】',
      '  // @layer：解决「样式表之间的优先级」问题',
      '  //   - 框架样式放低优先级 layer',
      '  //   - 业务样式放高优先级 layer',
      '  //   - 避免样式冲突时用 !important',
      '',
      '  // @scope：解决「选择器作用范围」问题',
      '  //   - 组件样式限定在组件内',
      '  //   - 避免污染其他组件',
      '   ',
      '  // Nesting：解决「样式结构组织」问题',
      '  //   - 组件相关样式聚合在一处',
      '  //   - 提高可维护性',
      '  //   - 减少选择器重复',
      '',
      '【实战：组件库样式架构】',
      '  @layer theme, components, overrides;',
      '',
      '  @layer theme {',
      '    :root {',
      '      --color-primary: #3b82f6;',
      '      --spacing-base: 8px;',
      '    }',
      '  }',
      '',
      '  @layer components {',
      '    @scope (.btn) {',
      '      :scope {',
      '        display: inline-flex;',
      '        padding: calc(var(--spacing-base) * 1) calc(var(--spacing-base) * 2);',
      '        background: var(--color-primary);',
      '        color: white;',
      '        &:hover {',
      '          opacity: 0.9;',
      '        }',
      '        &[disabled] {',
      '          opacity: 0.5;',
      '          cursor: not-allowed;',
      '        }',
      '      }',
      '    }',
      '  }',
      '',
      '  @layer overrides {',
      '    /* 业务覆盖，优先级最高 */',
      '    .btn-custom {',
      '      & .icon { margin-right: 4px; }',
      '    }',
      '  }',
      '',
      '【浏览器支持】',
      `  @layer: ${f.atLayer ? '✓' : '✗'} (Chrome 99+/Firefox 97+/Safari 15.4+)`,
      `  @scope: ${f.atScope ? '✓' : '✗'} (Chrome 118+/Safari 17.4+)`,
      `  Nesting: ${f.nestingBasic ? '✓' : '✗'} (Chrome 112+/FF 117+/Safari 16.5+)`,
      `  @container: ${f.containerType ? '✓' : '✗'} (Chrome 105+/Safari 16+)`,
      '  // 三者组合需 Chrome 118+ 完整支持',
      '',
      '【常见陷阱】',
      '  1. @layer 顺序声明必须在使用前',
      '  2. 未声明 layer 的样式优先级最高，可能意外覆盖',
      '  3. @scope 内嵌套时 & 引用 scope-start，不是外层选择器',
      '  4. 三者组合时优先级：@layer 层次 > specificity > 源码顺序',
      '  5. Firefox 暂不支持 @scope，组合使用需检测',
    ].join('\n');
    this.setState({ layerScopeInfo: info });
    this._addLog('css', `@layer + @scope + Nesting 协同演示完成；supports=${f.atLayer}/${f.atScope}/${f.nestingBasic}`);
  }

  _renderCard6(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. CSS Nesting 与 @layer / @scope 协同',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['@layer', f.atLayer],
          ['@scope', f.atScope],
          ['Nesting', f.nestingBasic],
        ]),
        h(Tag, { color: 'primary' }, '三层协同'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '嵌套可与 @layer 结合 @layer base { .card { & .title { } } }。@scope 可与 @layer 结合 @layer components { @scope (.card) { } }。@scope 内嵌套 @scope (.host) { & .child { } }。组织大型样式表的三层结构：@layer（层次优先级）+ @scope（作用域范围）+ Nesting（结构组织），三者正交可组合。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行三层协同演示', { type: 'primary', size: 'sm', onClick: () => this._runLayerScopeDemo() }),
        ),
        h('div', { class: 'ns-ls-host' },
          h('div', { class: 'ns-card' },
            h('div', { class: 'ns-card-title' }, '组件库样式架构示例'),
            h('div', { class: 'ns-card-body' }, '@layer theme/components/overrides + @scope + Nesting'),
          ),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, `@layer reset, base, components, utilities;

@layer components {
  @scope (.card) {
    :scope { border: 1px solid; }
    & .title { font-weight: bold; }  /* 嵌套 */
    & .body { color: gray; }
  }
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '完整参考：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.layerScopeInfo || '（点击按钮查看 Nesting 与 @layer / @scope 协同完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 7：SCSS/Less 迁移与差异 =====================

  _runScssMigrationDemo(): void {
    const f = this._flags();
    const info = [
      '===== SCSS/Less 迁移与差异 =====',
      '',
      '【核心差异：& 在 SCSS 中是字符串拼接，原生中是选择器引用】',
      '  // SCSS：& 是字符串替换',
      '  .parent {',
      '    &__child { color: red; }    // 编译为 .parent__child（BEM）',
      '    &--modifier { }             // .parent--modifier',
      '    &:hover { }                 // .parent:hover',
      '  }',
      '  // SCSS 可以用 & 拼接字符串（如 BEM 命名）',
      '',
      '  // 原生 Nesting：& 是选择器引用，不能拼接字符串',
      '  .parent {',
      '    & .child { }              /* .parent .child ✓ */',
      '    &:hover { }               /* .parent:hover ✓ */',
      '    &__child { }              /* ❌ 无效，& 不能拼接 __child */',
      '  }',
      '  // 原生 & 必须作为完整选择器出现，不能拼接成新标识符',
      '',
      '【SCSS @at-root 跳出嵌套】',
      '  // SCSS：@at-root 让规则跳出嵌套上下文',
      '  .parent {',
      '    & .child { color: red; }',
      '    @at-root .global-rule {    // 编译为 .global-rule（不带 .parent）',
      '      color: blue;',
      '    }',
      '  }',
      '',
      '  // 原生 Nesting：无 @at-root 等价',
      '  .parent {',
      '    & .child { }',
      '    /* 想写全局规则必须跳出 .parent 块 */',
      '  }',
      '  .global-rule { color: blue; }   // 单独写',
      '',
      '【SCSS @mixin / @include 暂无原生等价】',
      '  // SCSS：定义可复用样式块',
      '  @mixin button-style($color) {',
      '    background: $color;',
      '    &:hover { background: darken($color, 10%); }',
      '  }',
      '  .btn-primary { @include button-style(blue); }',
      '  .btn-danger { @include button-style(red); }',
      '',
      '  // 原生 CSS 暂无 @mixin 等价',
      '  // 替代方案：',
      '  //   1. CSS 自定义属性（CSS Variables）',
      '  //      .btn { background: var(--btn-color); }',
      '  //      .btn-primary { --btn-color: blue; }',
      '  //   2. @property 注册类型化变量（CSS Houdini）',
      '  //      @property --btn-color { syntax: "<color>"; ... }',
      '  //   3. @function 提案中（CSS Functions Level 1，未来）',
      '',
      '【SCSS interpolation #{} 原生不支持】',
      '  // SCSS：#{} 插值，可在选择器/属性名/值中嵌入变量',
      '  $prefix: "btn";',
      '  .#{$prefix}-primary { }      // .btn-primary',
      '  .#{$prefix}-danger { }',
      '  margin-#{$side}: 10px;       // 动态属性名',
      '',
      '  // 原生 CSS：不支持 #{} 插值',
      '  // 选择器名不能动态生成',
      '  // 替代：用 CSS 自定义属性 + 类名约定',
      '',
      '【SCSS 控制指令 @if / @for / @each 原生不支持】',
      '  // SCSS：循环生成样式',
      '  @for $i from 1 through 12 {',
      '    .col-#{$i} { width: percentage($i / 12); }',
      '  }',
      '  // 生成 .col-1 到 .col-12',
      '',
      '  @each $name, $color in (primary: blue, danger: red) {',
      '    .btn-#{$name} { background: $color; }',
      '  }',
      '',
      '  // 原生 CSS：不支持控制指令',
      '  // 替代方案：',
      '  //   1. 预处理器（仍用 SCSS/Less）',
      '  //   2. JS 生成样式（CSSStyleSheet.insertRule）',
      '  //   3. CSS 自定义属性 + calc() 模拟部分场景',
      '  //   4. @property + var() 组合',
      '',
      '【SCSS 函数 darken() / lighten() 原生不支持】',
      '  // SCSS：颜色函数',
      '  $primary: #3b82f6;',
      '  .btn { background: darken($primary, 10%); }',
      '',
      '  // 原生 CSS：使用 color-mix()（CSS Color Level 5）',
      '  .btn { background: color-mix(in srgb, var(--primary), black 10%); }',
      '  // 或 relative color syntax（CSS Color Level 5）',
      '  .btn { background: rgb(from var(--primary) calc(r - 25) g b); }',
      '',
      '【迁移策略：渐进迁移 + PostCSS autoprefixer】',
      '  // 1. 检测原生支持',
      '  if (CSS.supports(\'selector\', \'& > a\')) {',
      '    // 加载原生 Nesting 样式表',
      '  } else {',
      '    // 加载 SCSS 编译产物',
      '  }',
      '',
      '  // 2. PostCSS postcss-nesting 转译',
      '  //    postcss.config.js:',
      '  //    module.exports = {',
      '  //      plugins: [require("postcss-nesting")]',
      '  //    };',
      '  //    将原生 Nesting 转为兼容 CSS',
      '',
      '  // 3. autoprefixer 处理浏览器前缀',
      '',
      '【构建工具链是否还需预处理器？】',
      '  // 视项目需求而定：',
      '  //   - 仅用嵌套：原生足够，PostCSS 转译降级',
      '  //   - 需要 @mixin / 函数 / 循环：仍需 SCSS',
      '  //   - 需要 BEM 字符串拼接（&__child）：仍需 SCSS',
      '  //   - 简单项目：原生 + CSS Variables 足够',
      '  //   - 大型项目：仍推荐 SCSS（生态成熟）',
      '',
      '【原生 Nesting 与 SCSS 输出格式差异】',
      '  // 输入：',
      '  .a, .b { & .c { } }',
      '',
      '  // SCSS 输出：',
      '  .a .c, .b .c { }',
      '',
      '  // 原生 Nesting 浏览器内部展开：',
      '  :is(.a, .b) .c { }',
      '  // specificity 不同：:is() 取最大，SCSS 是独立规则',
      '',
      '【SCSS @use / @import 模块系统】',
      '  // SCSS：模块化样式',
      '  @use "variables" as *;       // 引入变量',
      '  @use "mixins" as *;          // 引入 mixin',
      '  // 原生 CSS：用 @import（已废弃）或 CSS Modules',
      '  // 现代方案：构建工具（webpack/vite）处理 @import',
      '',
      '【浏览器支持】',
      `  原生 Nesting: ${f.nestingBasic ? '✓' : '✗'} (Chrome 112+/FF 117+/Safari 16.5+)`,
      '  SCSS/Less：所有浏览器（编译后是标准 CSS）',
      '  // 迁移时需考虑兼容性，旧浏览器仍需预处理器',
      '',
      '【迁移清单】',
      '  1. 检测目标浏览器是否支持原生 Nesting',
      '  2. 评估是否需要 @mixin / 函数 / 循环',
      '  3. BEM 命名是否依赖 & 字符串拼接',
      '  4. 配置 PostCSS postcss-nesting 降级方案',
      '  5. 测试 specificity 差异（:is() 包装）',
      '  6. 渐进迁移：新组件用原生，旧组件保留 SCSS',
      '',
      '【常见陷阱】',
      '  1. & 不能拼接字符串（BEM __ 修饰符无法用原生 & 实现）',
      '  2. 原生 Nesting 的 :is() 包装导致 specificity 与 SCSS 不同',
      '  3. @mixin / 函数无原生等价，需重构为 CSS Variables',
      '  4. 控制指令（@for/@each）无原生等价，需 JS 或预处理器',
      '  5. 迁移时需测试所有浏览器目标',
    ].join('\n');
    this.setState({ scssMigrationInfo: info });
    this._addLog('css', `SCSS/Less 迁移差异演示完成；原生 supports=${f.nestingBasic}`);
  }

  _renderCard7(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. SCSS/Less 迁移与差异',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['原生 Nesting', f.nestingBasic]]),
        h(Tag, { color: 'primary' }, '迁移'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '原生 Nesting 与 SCSS 的差异：& 在 SCSS 中是字符串拼接（可 BEM &__child），原生中是选择器引用（不能拼接字符串）。SCSS @at-root 跳出嵌套无原生等价。SCSS @mixin/@include 暂无原生等价（@property + @function 提案中）。SCSS interpolation #{}、控制指令 @if/@for/@each 原生不支持（需 JS 或预处理器）。迁移策略：渐进迁移 + PostCSS postcss-nesting autoprefixer。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 SCSS 迁移演示', { type: 'primary', size: 'sm', onClick: () => this._runScssMigrationDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, `/* SCSS: & 可拼接字符串（BEM） */
.parent {
  &__child { }        /* .parent__child */
  &--modifier { }     /* .parent--modifier */
}
/* 原生: & 不能拼接 */
.parent {
  & .child { }        /* .parent .child ✓ */
  /* &__child { } */  /* ❌ 无效 */
}
/* @mixin 用 CSS Variables 替代 */
.btn { background: var(--btn-color); }
.btn-primary { --btn-color: blue; }`)),
        h('div', { class: 'fs-sm text-secondary' }, '完整参考：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.scssMigrationInfo || '（点击按钮查看 SCSS/Less 迁移与差异完整指南）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 8：实战模式与陷阱 =====================

  _runPatternDemo(): void {
    const f = this._flags();
    this._injectStyle('ns-pattern-demo', `
      .ns-pt-host {
        padding: 12px;
        background: #fff7ed;
        border-radius: 8px;
        margin-top: 10px;
      }
      [data-theme="dark"] .ns-pt-card {
        background: #1e293b;
        color: #e2e8f0;
        & .title { color: #fbbf24; }
      }
      .ns-pt-card {
        background: #fff;
        padding: 12px;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        & .title { font-weight: 700; color: #1e293b; }
        & .body { color: #475569; }
        @media (max-width: 768px) {
          padding: 8px;
          font-size: 12px;
        }
      }
    `);
    const info = [
      '===== 实战模式与陷阱 =====',
      '',
      '【模式 1：BEM 替代（嵌套实现模块化）】',
      '  /* BEM: .card__title, .card--featured, .card__title--large */',
      '  /* 原生 Nesting 替代方案：用嵌套 + 子选择器 */',
      '  .card {',
      '    padding: 16px;',
      '    border: 1px solid;',
      '    & .title {              /* 替代 .card__title */',
      '      font-weight: bold;',
      '      font-size: 1.2em;',
      '    }',
      '    & .body {               /* 替代 .card__body */',
      '      color: gray;',
      '    }',
      '    &.featured {            /* 替代 .card--featured */',
      '      border-color: gold;',
      '      background: #fffbeb;',
      '    }',
      '    & .title.large {        /* 替代 .card__title--large */',
      '      font-size: 1.5em;',
      '    }',
      '  }',
      '  // 优势：无需 BEM 命名约定，结构清晰',
      '  // 注意：原生 & 不能拼接 __ 字符串，需用子选择器',
      '',
      '【模式 2：组件库样式组织】',
      '  /* 组件样式聚合在一处，提高可维护性 */',
      '  .my-button {',
      '    display: inline-flex;',
      '    padding: 8px 16px;',
      '    border-radius: 4px;',
      '    cursor: pointer;',
      '',
      '    & .icon {',
      '      margin-right: 4px;',
      '    }',
      '',
      '    &:hover {',
      '      opacity: 0.9;',
      '    }',
      '',
      '    &:focus-visible {',
      '      outline: 2px solid currentColor;',
      '      outline-offset: 2px;',
      '    }',
      '',
      '    &[disabled] {',
      '      opacity: 0.5;',
      '      cursor: not-allowed;',
      '    }',
      '',
      '    &.size-sm { padding: 4px 8px; font-size: 12px; }',
      '    &.size-lg { padding: 12px 24px; font-size: 16px; }',
      '',
      '    &.variant-primary {',
      '      background: blue;',
      '      color: white;',
      '      &:hover { background: darkblue; }',
      '    }',
      '    &.variant-danger {',
      '      background: red;',
      '      color: white;',
      '      &:hover { background: darkred; }',
      '    }',
      '  }',
      '',
      '【模式 3：主题切换嵌套】',
      '  /* 用属性选择器嵌套实现主题切换 */',
      '  [data-theme="dark"] {',
      '    & .card {',
      '      background: #1e293b;',
      '      color: #e2e8f0;',
      '      & .title { color: #fbbf24; }',
      '    }',
      '    & .btn {',
      '      background: #3b82f6;',
      '      &:hover { background: #2563eb; }',
      '    }',
      '  }',
      '',
      '  [data-theme="light"] {',
      '    & .card {',
      '      background: #fff;',
      '      color: #1e293b;',
      '    }',
      '  }',
      '  // JS: document.documentElement.setAttribute("data-theme", "dark")',
      '',
      '【模式 4：响应式嵌套 @media 嵌套于组件内】',
      '  /* 传统：响应式样式与组件样式分离，难维护 */',
      '  .card { padding: 16px; }',
      '  @media (max-width: 768px) { .card { padding: 8px; } }',
      '',
      '  /* 嵌套：响应式样式聚合在组件内 */',
      '  .card {',
      '    padding: 16px;',
      '    & .title { font-size: 1.2em; }',
      '    @media (max-width: 768px) {',
      '      padding: 8px;',
      '      & .title { font-size: 1em; }',
      '      & .body { display: none; }   /* 移动端隐藏 */',
      '    }',
      '    @media (max-width: 480px) {',
      '      padding: 4px;',
      '    }',
      '  }',
      '  // 优势：组件所有样式（含响应式）聚合，便于维护',
      '',
      '【模式 5：状态机嵌套】',
      '  /* 用嵌套组织元素的各种状态 */',
      '  .tab {',
      '    padding: 8px 16px;',
      '    color: gray;',
      '    transition: all 0.2s;',
      '',
      '    &:hover {',
      '      color: #3b82f6;',
      '      background: #eff6ff;',
      '    }',
      '',
      '    &.is-active {',
      '      color: white;',
      '      background: #3b82f6;',
      '      font-weight: bold;',
      '    }',
      '',
      '    &.is-disabled,',
      '    &[disabled] {',
      '      color: #d1d5db;',
      '      cursor: not-allowed;',
      '      &:hover {',
      '        color: #d1d5db;     /* 禁用时不响应 hover */',
      '        background: transparent;',
      '      }',
      '    }',
      '',
      '    &[data-loading="true"] {',
      '      &::after {',
      '        content: "⏳";',
      '        margin-left: 4px;',
      '      }',
      '    }',
      '  }',
      '',
      '【陷阱清单】',
      '',
      '  1. & 缺失导致整行被当作属性解析',
      '     .parent { a { } }      /* ❌ a 被当作属性名 */',
      '     .parent { & a { } }    /* ✓ 正确 */',
      '     // 浏览器会忽略无效声明，不会报错',
      '',
      '  2. 嵌套深度过深难调试',
      '     .a { & .b { & .c { & .d { & .e { } } } } }',
      '     // 选择器：.a .b .c .d .e，specificity (0,5,0)',
      '     // 难以覆盖，调试困难',
      '     // 建议：不超过 3 层',
      '',
      '  3. @scope 边界元素本身是否被包含',
      '     // scope-start：包含在作用域内（可用 :scope 选中）',
      '     // scope-end：不包含在作用域内（从其开始排除）',
      '     @scope (.article) to (.comments) {',
      '       :scope { }         /* .article 本身，✓ 匹配 */',
      '       .comments { }      /* ❌ 不匹配，.comments 已超出 */',
      '     }',
      '',
      '  4. 老浏览器降级需 autoprefixer',
      '     // Chrome < 112 / FF < 117 / Safari < 16.5 不支持原生 Nesting',
      '     // 需 PostCSS postcss-nesting 转译为标准 CSS',
      '     // 或检测后加载 SCSS 编译产物',
      '',
      '  5. 嵌套不创建新 specificity 但选择器组合仍计入',
      '     .parent {',
      '       & .child { }    /* specificity = .parent .child = (0,2,0) */',
      '       &:hover { }     /* specificity = .parent:hover = (0,2,0) */',
      '     }',
      '     // 嵌套本身不增加 specificity，但组合的选择器会计入',
      '',
      '  6. 原生 Nesting 与 Sass 产物差异',
      '     // 输入：.a, .b { & .c { } }',
      '     // SCSS 输出：.a .c, .b .c（两条规则）',
      '     // 原生展开：:is(.a, .b) .c（一条规则，:is 包装）',
      '     // 语义等价，但 specificity 计算不同',
      '     // :is(.a, .b) 取最大 specificity，SCSS 是独立规则',
      '',
      '  7. 浏览器支持较新',
      '     // Chrome 112+ / FF 117+ / Safari 16.5+（2023 年）',
      '     // @scope 更新：Chrome 118+ / Safari 17.4+',
      '     // 生产环境需评估目标用户浏览器分布',
      '',
      '【实战综合示例：可维护的组件库】',
      '  /* 使用 @layer + @scope + Nesting 三层结构 */',
      '  @layer components;',
      '',
      '  @layer components {',
      '    @scope (.data-table) {',
      '      :scope {',
      '        width: 100%;',
      '        border-collapse: collapse;',
      '      }',
      '      & thead {',
      '        background: #f1f5f9;',
      '        & th {',
      '          padding: 12px;',
      '          text-align: left;',
      '          font-weight: 600;',
      '        }',
      '      }',
      '      & tbody {',
      '        & tr {',
      '          border-bottom: 1px solid #e2e8f0;',
      '          &:hover { background: #f8fafc; }',
      '          &:nth-child(even) { background: #fafafa; }',
      '        }',
      '        & td { padding: 12px; }',
      '      }',
      '      @media (max-width: 768px) {',
      '        & thead { display: none; }',
      '        & tbody tr {',
      '          display: block;',
      '          margin-bottom: 12px;',
      '        }',
      '      }',
      '    }',
      '  }',
      '',
      '【浏览器支持】',
      `  原生 Nesting: ${f.nestingBasic ? '✓' : '✗'} (Chrome 112+/FF 117+/Safari 16.5+)`,
      `  @scope: ${f.atScope ? '✓' : '✗'} (Chrome 118+/Safari 17.4+)`,
      `  @layer: ${f.atLayer ? '✓' : '✗'} (Chrome 99+/FF 97+/Safari 15.4+)`,
      '',
      '【资源】',
      '  - CSS Nesting Module Level 1：https://drafts.csswg.org/css-nesting-1/',
      '  - CSS Cascading Level 6 @scope：https://drafts.csswg.org/css-cascade-6/',
      '  - CSS @layer 规范：https://drafts.csswg.org/css-cascade-5/',
      '  - postcss-nesting：https://github.com/csstools/postcss-plugins',
      '  - MDN CSS Nesting：https://developer.mozilla.org/docs/Web/CSS/CSS_nesting',
      '  - MDN @scope：https://developer.mozilla.org/docs/Web/CSS/@scope',
    ].join('\n');
    this.setState({ patternInfo: info });
    this._addLog('css', '实战模式与陷阱演示完成');
  }

  _renderCard8(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 实战模式与陷阱（BEM 替代 / 组件库 / 主题切换 / 响应式 / 状态机 / 陷阱清单）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, '实战'),
        h(Tag, { color: f.nestingBasic ? 'success' : 'error' }, `Nesting ${f.nestingBasic ? '✓' : '✗'}`),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'BEM 替代（嵌套实现模块化）/ 组件库样式组织 / 主题切换嵌套 [data-theme="dark"] { & .card { } } / 响应式嵌套 @media (max-width: 768px) { } 嵌套于组件内 / 状态机嵌套 &:hover/&.is-active/&[disabled]。陷阱清单：& 缺失导致整行被当作属性解析 / 嵌套深度过深难调试 / @scope 边界元素本身是否被包含（包含根边界排除终点）/ 老浏览器降级需 autoprefixer / 嵌套不创建新 specificity 但选择器组合仍计入 / 原生 Nesting 与 Sass 产物差异 / 浏览器支持 Chrome 112+/FF 117+/Safari 16.5+ 较新。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行实战模式演示', { type: 'primary', size: 'sm', onClick: () => this._runPatternDemo() }),
        ),
        h('div', { class: 'ns-pt-host' },
          h('div', { class: 'ns-pt-card' },
            h('div', { class: 'title' }, '组件库样式示例'),
            h('div', { class: 'body' }, '@media + &:hover + &.is-active'),
          ),
          h('span', { class: 'ns-state' }, 'hover'),
          h('span', { class: 'ns-state is-active' }, 'is-active'),
          h('span', { class: 'ns-state', disabled: true }, 'disabled'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, `/* 主题切换嵌套 */
[data-theme="dark"] {
  & .card {
    background: #1e293b;
    & .title { color: #fbbf24; }
  }
}
/* 响应式嵌套于组件内 */
.card {
  padding: 16px;
  @media (max-width: 768px) {
    padding: 8px;          /* 嵌套在组件内 */
    & .body { display: none; }
  }
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '完整参考：'),
        h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.patternInfo || '（点击按钮查看实战模式与陷阱完整代码）')),
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
        ...s.logs.map((log: LogEntry) =>
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
      h('h2', { class: 'section-title' }, 'CSS Nesting & @scope 嵌套与作用域深度实验室'),

      h(Alert, {
        type: 'info',
        message: 'CSS Nesting Module Level 1 + CSS Cascading and Inheritance Level 6 @scope —— 浏览器原生嵌套与作用域规则体系',
        description: '演示 CSS Nesting 基础与 & 父选择器（.parent { & .child { } & > .direct { } &:hover { } & + .sibling { } }，& 是选择器引用 vs SCSS 字符串拼接）、嵌套语法规则与解析顺序（必须以 &/@/:/./#/[/* 开头否则需 &，复杂选择器 & .a + .b，组合器 & + &、& ~ &，伪元素 &::before，at-rule @media/@supports/@container 直接嵌套，& 在中间 .a & .b）、@scope 作用域规则基础（@scope (.host) { } 限定范围，@scope (.host) to (.limit) { } Donut Scope，与后代选择器区别可中断）、@scope Donut Scope 深潜（.article to (.comments) 排除子树，多层 to (.a, .b, .c)，降低优先级避免深度选择器）、@scope 与 :scope 伪类（:scope 引用作用域根，vs & 语义差异，作用域根样式设置）、CSS Nesting 与 @layer / @scope 协同（三层结构 @layer 层次 + @scope 作用域 + Nesting 结构）、SCSS/Less 迁移与差异（& 字符串拼接 vs 选择器引用，@at-root/@mixin/#{} 控制指令无原生等价，迁移策略 PostCSS）、实战模式与陷阱（BEM 替代/组件库/主题切换/响应式/状态机，& 缺失/嵌套过深/@scope 边界/降级需 autoprefixer/浏览器支持 Chrome 112+/FF 117+/Safari 16.5+）。用 CSS.supports(\'selector\', ...) 检测，jsdom 不做真实样式应用但流程完整。',
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
