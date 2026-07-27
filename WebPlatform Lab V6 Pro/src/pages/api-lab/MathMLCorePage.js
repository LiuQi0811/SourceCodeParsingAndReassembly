// =====================================================================
// MathMLCorePage.js —— MathML Core 数学公式渲染 完整 实验室
// 演示 W3C MathML Core 数学公式标记语言的全套能力：
//   1. 概述与动机：数学公式 Web 渲染需求 / MathML 历史（MathML 1/2/3 →
//      Core）/ MathML Core W3C Math WG / vs MathJax/KaTeX（JS 渲染）/
//      vs SVG（不同领域）/ 浏览器支持 Chrome 109+ / Firefox / Safari 全
//      主流稳定 / 与 HTML 集成
//   2. <math> 根元素：<math display="block|inline"> / 块级 vs 行内 /
//      xmlns 命名空间 / 与 HTML 解析器集成 / 字符编码 Unicode 数学符号
//   3. 基础元素：<mi> 标识符 / <mn> 数字 / <mo> 运算符 / <ms> 字符串 /
//      <mtext> 文本 / <mspace> 空格 / <mrow> 分组 / 属性
//      mathvariant/mathsize/mathcolor
//   4. 分数与根式：<mfrac> 分数 / <msqrt> 平方根 / <mroot> n 次根 /
//      bevelled 属性 / 分子分母布局 / 根式索引位置
//   5. 脚本元素：<msub> 下标 / <msup> 上标 / <msubsup> 上下标 /
//      <munder> 下限 / <mover> 上限 / <munderover> 上下限 /
//      <mmultiscripts> 多重脚本 / 求和积分上下限
//   6. 矩阵与表格：<mtable> 矩阵 / <mtr> 行 / <mtd> 单元 / columnalign/
//      rowalign 对齐 / <mfrac> 与矩阵嵌套 / determinant/transpose 表示
//   7. 实战：常用公式渲染：二次方程求根公式 / 勾股定理 / 欧拉公式 /
//      积分公式 / 矩阵乘法 / 与 LaTeX 命令对比 / MathJax 迁移
//   8. 陷阱与最佳实践：CSS 样式 math-style / math-depth / math-shift /
//      字体回退（Latin Modern Math）/ 与 KaTeX 性能对比 / 可访问性 aria /
//      copy-paste / DevTools 调试 / 嵌入 HTML 注意事项
// 说明：MathML 是标记语言非 JS API，能力检测用 DOM（createElement /
//       createElementNS）+ CSS.supports。jsdom 通常不实现 MathMLElement，
//       createElement('math') 返回 HTMLUnknownElement，统一兜底返回 false。
//       所有特性调用前做能力检测（safe(()=>...) 包裹），不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。注入演示样式 + 完整代码示例，
//       真实浏览器（Chrome 109+ / Firefox / Safari 全主流稳定）可查看公式渲染。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// MathML 命名空间常量（createElementNS 用）
const MATHML_NS = 'http://www.w3.org/1998/Math/MathML';

export class MathMLCorePage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      overviewInfo: '',         // Card 1：概述与动机
      mathRootInfo: '',         // Card 2：<math> 根元素
      basicElementsInfo: '',    // Card 3：基础元素
      fracRootInfo: '',         // Card 4：分数与根式
      scriptsInfo: '',          // Card 5：脚本元素
      matrixInfo: '',           // Card 6：矩阵与表格
      formulasInfo: '',         // Card 7：实战：常用公式渲染
      pitfallsInfo: '',         // Card 8：陷阱与最佳实践
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._dynamicStyles = [];          // 动态创建并插入 head 的 <style> 元素列表
    this._mathDisplayMode = 'inline';  // Card 2 当前 <math display> 值
    this._mathVariantMode = 'normal';  // Card 3 当前 mathvariant 值
    this._fracBevelled = false;        // Card 4 是否开启 bevelled 分数
    this._formulaIndex = 0;            // Card 7 当前展示的公式索引

    // 一次性能力检测：MathML Core 全家桶
    const f = this._flags();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      'MathMLElement ' + c(f.mathMLElement),
      'MathMLElement ctor ' + c(f.mathMLElementCtor),
      'math NS element ' + c(f.mathNSElement),
      'math-style CSS ' + c(f.mathStyleCSS),
      'mfrac as HTMLElement ' + c(f.mfracHTMLElement),
    ];

    const summary = f.mathMLElement
      ? 'MathML Core 能力检测：' + parts.join(' · ') + '。当前环境支持 MathMLElement，可在真实浏览器渲染数学公式。MathML Core 由 W3C Math WG 维护，Chrome 109+ / Firefox / Safari 全主流稳定。'
      : 'MathML Core 能力检测：' + parts.join(' · ') + '。jsdom 通常不实现 MathMLElement（createElement("math") 返回 HTMLUnknownElement），按钮点击将仅记日志说明 + 注入演示样式。在真实浏览器（Chrome 109+ / Firefox / Safari）中打开可查看完整公式渲染。';

    this.setState({ capsSummary: summary });
    this._addLog(f.mathMLElement ? 'info' : 'warn', '能力检测：' + parts.join('，'));
    if (!f.mathMLElement) this._addLog('warn', 'MathMLElement 不可用（jsdom 通常不实现，Chrome 109+ / Firefox / Safari 全主流稳定）');
    if (!f.mathMLElementCtor) this._addLog('warn', 'window.MathMLElement 构造函数不可用（Chrome 109+ / Firefox / Safari 支持）');
    if (!f.mathStyleCSS) this._addLog('warn', 'CSS.supports("math-style","normal") 不可用（Chrome 109+ / Firefox 117+ / Safari 16.4+ 支持）');

    // 一次性注入全部演示样式（仅一次；rerender 不会移除 head 中的 style）
    this._injectBaseStyles();
  }

  componentWillUnmount() {
    // 移除动态创建的 <style> 元素，便于 GC
    for (const style of this._dynamicStyles) {
      try { style.parentNode && style.parentNode.removeChild(style); } catch { /* noop */ }
    }
    this._dynamicStyles = [];
  }

  // —— 日志 / 按钮辅助 ——

  _addLog(type, content) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // 返回 Tag 数组：items = [[label, ok], ...]，展示能力状态（✓/✗）
  _caps(items) {
    return items.map(([label, ok]) =>
      h(Tag, { color: ok ? 'success' : 'error' }, label + ' ' + (ok ? '✓' : '✗')));
  }

  // 返回布尔能力对象（供 capsSummary / 按钮 disabled 使用）
  // 用 safe 包裹：jsdom 不可用时返回 false，绝不抛异常
  // 注意：MathML 是标记语言非 JS API，用 DOM（createElement / createElementNS）检测
  _flags() {
    const safe = (fn) => { try { return fn(); } catch { return false; } };
    return {
      // 通过 createElement('math').constructor.name 检测 MathMLElement 实现
      mathMLElement: safe(() => {
        try {
          const el = document.createElement('math');
          return !!(el.constructor && el.constructor.name === 'MathMLElement');
        } catch { return false; }
      }),
      // 通过 typeof window.MathMLElement 检测构造函数
      mathMLElementCtor: safe(() => typeof window.MathMLElement !== 'undefined'),
      // 通过 createElementNS 创建 MathML 命名空间元素检测
      mathNSElement: safe(() => {
        try {
          const el = document.createElementNS(MATHML_NS, 'math');
          return el instanceof window.HTMLElement || el instanceof window.MathMLElement;
        } catch { return false; }
      }),
      // CSS.supports('math-style', 'normal') 检测 MathML CSS 属性
      mathStyleCSS: safe(() => typeof CSS !== 'undefined' &&
        typeof CSS.supports === 'function' && CSS.supports('math-style', 'normal')),
      // createElement('mfrac') instanceof HTMLElement 检测（HTML 解析器集成）
      mfracHTMLElement: safe(() => {
        try {
          return typeof document !== 'undefined' &&
            document.createElement('mfrac') instanceof window.HTMLElement;
        } catch { return false; }
      }),
    };
  }

  // —— 注入一个 <style>，跟踪到 this._dynamicStyles ——
  _injectStyle(id, textContent) {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = textContent;
    document.head.appendChild(style);
    this._dynamicStyles.push(style);
    return style;
  }

  // —— 一次性注入全部基础演示样式 ——
  _injectBaseStyles() {
    this._injectStyle('mathml-core-demo', `
      /* ===== 通用 stage ===== */
      .mathml-stage {
        margin-top: 10px;
        padding: 12px 16px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font-size: 16px;
        line-height: 1.8;
      }
      /* MathML 元素样式兜底（jsdom 或不支持时仍能可读） */
      math {
        font-family: 'Latin Modern Math', 'STIX Two Math', 'Cambria Math',
                     'Times New Roman', serif;
      }
      /* ===== Card 2：<math display> 演示 ===== */
      .mathml-display-stage math[display="block"] {
        display: block;
        text-align: center;
        margin: 8px 0;
        font-size: 18px;
      }
      .mathml-display-stage math[display="inline"] {
        display: inline;
        font-size: 16px;
      }
      /* ===== Card 3：基础元素 ===== */
      .mathml-basic-stage mi { font-style: italic; }
      .mathml-basic-stage mn { font-style: normal; }
      .mathml-basic-stage mo { font-style: normal; padding: 0 2px; }
      /* mathvariant 演示 */
      .mathml-basic-stage mi[mathvariant="bold"] { font-style: normal; font-weight: 700; }
      .mathml-basic-stage mi[mathvariant="double-struck"] {
        font-style: normal; font-weight: 700; color: #2563eb;
      }
      .mathml-basic-stage mi[mathvariant="fraktur"] {
        font-family: 'UnifrakturMaguntia', cursive; font-style: normal;
      }
      /* ===== Card 4：分数与根式 ===== */
      .mathml-frac-stage mfrac { padding: 2px 0; }
      .mathml-frac-stage mfrac[bevelled="true"] {
        /* bevelled 分数（斜线分数）— MathML Core 不支持 bevelled，
           但部分实现仍识别，浏览器降级为水平分数 */
        display: inline-block;
      }
      .mathml-frac-stage msqrt, .mathml-frac-stage mroot {
        padding: 2px 4px;
      }
      /* ===== Card 5：脚本元素 ===== */
      .mathml-scripts-stage msub, .mathml-scripts-stage msup,
      .mathml-scripts-stage msubsup,
      .mathml-scripts-stage munder, .mathml-scripts-stage mover,
      .mathml-scripts-stage munderover {
        padding: 0 2px;
      }
      /* ===== Card 6：矩阵与表格 ===== */
      .mathml-matrix-stage mtable {
        border-collapse: collapse;
      }
      .mathml-matrix-stage mtd {
        padding: 2px 6px;
        text-align: center;
      }
      /* 矩阵括号视觉模拟（MathML Core 用 <mo> 括号）*/
      .mathml-matrix-stage .matrix-bracket {
        font-size: 32px;
        line-height: 1;
        vertical-align: middle;
        color: #475569;
      }
      /* ===== Card 7：实战公式 ===== */
      .mathml-formulas-stage {
        background: #fff;
        border-left: 3px solid #3b82f6;
        padding: 12px 16px;
      }
      .mathml-formulas-stage .formula-item {
        margin: 8px 0;
        padding: 8px 0;
        border-bottom: 1px dashed #e2e8f0;
      }
      .mathml-formulas-stage .formula-item:last-child { border-bottom: none; }
      .mathml-formulas-stage .formula-name {
        font-size: 13px;
        color: #64748b;
        margin-bottom: 4px;
      }
      .mathml-formulas-stage math {
        font-size: 18px;
      }
      /* ===== Card 8：陷阱 ===== */
      .mathml-pitfalls-stage {
        background: #fffbeb;
        border-left: 3px solid #f59e0b;
        padding: 8px 12px;
        font-size: 14px;
      }
      /* math-style CSS 演示 */
      .mathml-pitfalls-stage .math-style-normal math { math-style: normal; }
      .mathml-pitfalls-stage .math-style-compact math { math-style: compact; }
      /* ===== 输出区 ===== */
      .mathml-output {
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
      /* 兜底：不支持 MathML 时让 math 元素仍可见 */
      .mathml-fallback math {
        display: inline-block;
        font-family: 'Cambria Math', 'Times New Roman', serif;
        font-size: 16px;
      }
      .mathml-fallback mrow { display: inline; }
      .mathml-fallback mfrac {
        display: inline-block;
        vertical-align: middle;
        text-align: center;
        padding: 0 4px;
      }
      .mathml-fallback msqrt {
        display: inline-block;
        border-top: 1px solid currentColor;
        padding: 2px 4px 0;
      }
    `);
  }

  // =================== Card 1：概述与动机 ===================

  _readOverviewInfo() {
    const f = this._flags();
    try {
      return '===== MathML Core 概述与动机 =====\n' +
        '\n' +
        '【数学公式 Web 渲染需求】\n' +
        '  教育 / 科研 / 文档站点需要渲染数学公式：\n' +
        '    在线教育（Khan Academy / Coursera 数学课）\n' +
        '    学术论文（arXiv / Wiki / 博客）\n' +
        '    技术文档（Mathematics / Physics / Engineering）\n' +
        '  传统方案：图片（不可选中 / 不可搜索 / 不可缩放）/ JS 库（MathJax / KaTeX）\n' +
        '\n' +
        '【MathML 历史】\n' +
        '  MathML 1.0（1999）—— W3C 首版推荐\n' +
        '  MathML 2.0（2003）—— 增加内容标记 + 更多元素\n' +
        '  MathML 3.0（2010）—— 完整规范（含 MathML-Presentation / MathML-Content）\n' +
        '  MathML Core（2022+）—— 精简子集，专注于浏览器渲染，与 HTML/CSS 集成\n' +
        '    W3C Math Working Group 维护\n' +
        '    规范地址：https://www.w3.org/TR/mathml-core/\n' +
        '\n' +
        '【MathML Core vs 完整 MathML 3】\n' +
        '  MathML Core 只包含浏览器渲染必需的子集：\n' +
        '    ✓ Presentation 元素（<math>/<mi>/<mn>/<mo>/<mfrac>/<msqrt> 等）\n' +
        '    ✓ 与 HTML 解析器 / CSS / DOM 集成\n' +
        '    ✓ 基本布局算法（分数 / 根式 / 上下标 / 矩阵）\n' +
        '  排除：\n' +
        '    ✗ Content MathML（语义标记，被 OpenMath 替代）\n' +
        '    ✗ 复杂的绑定元素（<mbind> / <mstyle> 部分功能）\n' +
        '    ✗ 链接 / 交互（用 HTML <a> 包裹替代）\n' +
        '\n' +
        '【vs MathJax / KaTeX（JS 渲染）】\n' +
        '  MathJax / KaTeX：JS 库，运行时解析 LaTeX / MathML 转 HTML+CSS / SVG\n' +
        '    优点：跨浏览器兼容（包括老浏览器）/ 支持 LaTeX 命令 / 控制精细\n' +
        '    缺点：JS 依赖（增加 bundle 体积）/ 渲染延迟（首屏需 JS 执行）/\n' +
        '           部分高级布局用 CSS hack 不精确\n' +
        '  MathML Core：浏览器原生支持，无需 JS\n' +
        '    优点：零 JS 依赖 / 浏览器原生渲染（性能更好）/ 与 DOM 完全集成\n' +
        '           可选中 / 可搜索 / 可缩放（矢量）/ 可访问性（aria）\n' +
        '    缺点：不支持 LaTeX 命令（需用 MathML 标记）/ 老浏览器不支持\n' +
        '\n' +
        '【vs SVG（不同领域）】\n' +
        '  SVG：通用矢量图形（图标 / 图表 / 路径动画）\n' +
        '  MathML：专为数学公式设计（语义化元素 + 数学布局算法）\n' +
        '  两者互补：MathML 渲染公式，SVG 绘制几何图形 / 函数图像\n' +
        '\n' +
        '【与 HTML 集成】\n' +
        '  MathML 元素可直接嵌入 HTML（无需命名空间，HTML 解析器自动识别）：\n' +
        '    <p>勾股定理：<math><msup><mi>a</mi><mn>2</mn></msup> + ...</math></p>\n' +
        '  HTML 解析器将 <math> 及其子元素识别为 MathMLElement（继承自 Element）\n' +
        '  可与 HTML 元素混排，CSS 可样式化（math-style / math-depth / math-shift）\n' +
        '\n' +
        '【当前能力检测】\n' +
        '  MathMLElement       = ' + f.mathMLElement + '\n' +
        '  MathMLElement ctor  = ' + f.mathMLElementCtor + '\n' +
        '  math NS element     = ' + f.mathNSElement + '\n' +
        '  math-style CSS      = ' + f.mathStyleCSS + '\n' +
        '  mfrac HTMLElement   = ' + f.mfracHTMLElement + '\n' +
        '\n' +
        '【浏览器支持】\n' +
        '  Chrome 109+（2023-01）—— MathML Core 全功能支持（历史长期不支持）\n' +
        '  Firefox —— MathML 1.0 起支持（Firefox 1+），MathML Core 兼容\n' +
        '  Safari 5.1+ —— 长期支持 MathML\n' +
        '  Edge 79+ —— 基于 Chromium，与 Chrome 同步支持\n' +
        '  注意：Chrome 109 之前需 MathJax/KaTeX 兜底\n' +
        '\n' +
        '【完整代码示例】\n' +
        '  <!-- 行内公式 -->\n' +
        '  <p>圆面积公式：<math><mi>A</mi><mo>=</mo><mi>π</mi>' +
        '<msup><mi>r</mi><mn>2</mn></msup></math></p>\n' +
        '\n' +
        '  <!-- 块级公式 -->\n' +
        '  <math display="block">\n' +
        '    <mi>E</mi><mo>=</mo><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup>\n' +
        '  </math>\n' +
        '\n' +
        '  <!-- 分数 -->\n' +
        '  <math><mfrac><mn>1</mn><mn>2</mn></mfrac></math>\n' +
        '\n' +
        '  <!-- 平方根 -->\n' +
        '  <math><msqrt><mn>2</mn></msqrt></math>';
    } catch (err) {
      return '读取 MathML Core 概述信息失败：' + err.name + ' - ' + err.message;
    }
  }

  _runOverviewDemo() {
    this.setState({ overviewInfo: this._readOverviewInfo() });
    const f = this._flags();
    this._addLog('overview', 'MathML Core 概述演示：MathMLElement=' + f.mathMLElement + ', math-style CSS=' + f.mathStyleCSS);
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. 概述与动机 —— MathML Core 浏览器原生数学渲染',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['MathMLElement', f.mathMLElement],
          ['math-style CSS', f.mathStyleCSS],
        ]),
        h(Tag, { color: 'primary' }, 'W3C Math WG'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'MathML Core 由 W3C Math Working Group 维护，是 MathML 3 的精简子集，专注浏览器渲染。历史：MathML 1.0（1999）/ 2.0（2003）/ 3.0（2010）→ Core（2022+）。vs MathJax/KaTeX（JS 库，跨浏览器但需 JS 依赖 + 渲染延迟）：MathML Core 浏览器原生支持，零 JS 依赖、性能更好、与 DOM 完全集成（可选中 / 可搜索 / 可缩放 / 可访问性）。vs SVG：SVG 通用矢量图形，MathML 专为数学公式设计，两者互补。浏览器支持：Chrome 109+ / Firefox / Safari 全主流稳定，Chrome 109 之前需 MathJax/KaTeX 兜底。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取概述信息', { type: 'primary', size: 'sm', onClick: () => this._runOverviewDemo() }),
        ),
        h('div', { class: 'mathml-stage mathml-fallback' },
          h('div', {}, '勾股定理（行内）：'),
          h('math', {},
            h('msup', {}, h('mi', {}, 'a'), h('mn', {}, '2')),
            h('mo', {}, '+'),
            h('msup', {}, h('mi', {}, 'b'), h('mn', {}, '2')),
            h('mo', {}, '='),
            h('msup', {}, h('mi', {}, 'c'), h('mn', {}, '2')),
          ),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.overviewInfo || '（点击「读取概述信息」查看 MathML Core 全景与代码示例）')),
        h(Alert, {
          type: 'info',
          message: 'MathML Core 是浏览器原生数学渲染，零 JS 依赖、性能更好',
          description: 'MathML Core 是 MathML 3 精简子集，专注浏览器渲染。Chrome 109+ / Firefox / Safari 全主流稳定。vs MathJax/KaTeX（JS 库）：原生支持无需 JS、性能更好、与 DOM 完全集成，但不支持 LaTeX 命令（需用 MathML 标记），老浏览器（Chrome < 109）需 JS 库兜底。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：<math> 根元素 ===================

  _readMathRootInfo() {
    const f = this._flags();
    try {
      let liveInfo = '(未读取)';
      if (f.mathMLElement) {
        try {
          const el = this.el && this.el.querySelector('.mathml-display-stage math');
          if (el) {
            liveInfo = JSON.stringify({
              tagName: el.tagName.toLowerCase(),
              constructorName: el.constructor.name,
              displayAttr: el.getAttribute('display'),
              computedDisplay: window.getComputedStyle(el).getPropertyValue('display') || '(空)',
            }, null, 2);
          }
        } catch (e) {
          liveInfo = '读取失败：' + e.name + ' - ' + e.message;
        }
      }
      return '===== <math> 根元素 =====\n' +
        '\n' +
        '【元素与属性】\n' +
        '  <math> 是 MathML 公式的根元素，每个公式必须以 <math> 包裹\n' +
        '  核心属性：\n' +
        '    display = "inline"（默认）| "block"\n' +
        '      inline —— 行内公式（与文字混排，不换行，紧凑布局）\n' +
        '      block  —— 块级公式（独占一行，居中，较大字号）\n' +
        '    alttext —— 公式的文本描述（备用，可访问性 + 复制粘贴）\n' +
        '    xmlns   —— MathML 命名空间（HTML 中可省略，XML / XHTML 中必须）\n' +
        '\n' +
        '【块级 vs 行内】\n' +
        '  display="inline"（默认）：\n' +
        '    行内显示，与文字基线对齐，紧凑布局\n' +
        '    适合短公式嵌入文字（如"圆面积 A=πr²"）\n' +
        '    CSS 默认 display: inline / math-style: compact\n' +
        '  display="block"：\n' +
        '    独占一行，居中对齐（默认），较大字号\n' +
        '    适合重要公式独占一行（如论文中的公式编号）\n' +
        '    CSS 默认 display: block / math-style: normal\n' +
        '\n' +
        '【xmlns 命名空间】\n' +
        '  MathML 命名空间：http://www.w3.org/1998/Math/MathML\n' +
        '  HTML 解析器（text/html）：自动将 <math> 及子元素识别为 MathML 命名空间\n' +
        '    即 HTML 中可省略 xmlns，直接 <math>...</math>\n' +
        '  XML / XHTML 解析器：必须显式声明命名空间：\n' +
        '    <math xmlns="http://www.w3.org/1998/Math/MathML">...</math>\n' +
        '  JS createElementNS 创建：\n' +
        '    const m = document.createElementNS(\n' +
        '      "http://www.w3.org/1998/Math/MathML", "math");\n' +
        '\n' +
        '【与 HTML 解析器集成】\n' +
        '  HTML 解析器将 <math> 及子元素（<mi>/<mn>/<mo>/<mfrac> 等）\n' +
        '    识别为 MathMLElement（继承自 Element，非 HTMLElement）\n' +
        '  MathMLElement 与 HTMLElement 类似但有差异：\n' +
        '    支持 attribute 设置（如 mathvariant / mathsize / mathcolor）\n' +
        '    可用 CSS 样式化（math-style / math-depth / math-shift）\n' +
        '    可与 HTML 元素混排（<p>内嵌 <math>）\n' +
        '\n' +
        '【字符编码：Unicode 数学符号】\n' +
        '  MathML 使用 Unicode 编码数学符号，无需特殊字体（数学字体回退即可）：\n' +
        '    希腊字母：α β γ δ ε ζ η θ ι κ λ μ ν ξ ο π ρ σ τ υ φ χ ψ ω\n' +
        '              Α Β Γ Δ Ε Ζ Η Θ Ι Κ Λ Μ Ν Ξ Ο Π Ρ Σ Τ Υ Φ Χ Ψ Ω\n' +
        '    运算符：± × ÷ ≠ ≤ ≥ ≈ ∞ ∑ ∏ ∫ ∂ ∇ √ ∛ ∜\n' +
        '    集合：∈ ∉ ⊂ ⊆ ⊃ ⊇ ∪ ∩ ∅ ∀ ∃\n' +
        '    箭头：→ ← ↔ ⇒ ⇐ ⇔ ↑ ↓ ↦\n' +
        '  在 <mi>/<mo>/<mtext> 中直接写 Unicode 字符即可\n' +
        '\n' +
        '【当前演示元素】\n' +
        '  <math display="' + this._mathDisplayMode + '">...</math>\n' +
        '  实时状态：\n' +
        liveInfo + '\n' +
        '\n' +
        '【完整代码示例】\n' +
        '  <!-- 行内公式 -->\n' +
        '  <p>能量公式 <math><mi>E</mi><mo>=</mo><mi>m</mi>' +
        '<msup><mi>c</mi><mn>2</mn></msup></math> 揭示了质能关系。</p>\n' +
        '\n' +
        '  <!-- 块级公式（独占一行） -->\n' +
        '  <math display="block">\n' +
        '    <mi>E</mi><mo>=</mo><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup>\n' +
        '  </math>\n' +
        '\n' +
        '  <!-- XML / XHTML 必须声明命名空间 -->\n' +
        '  <math xmlns="http://www.w3.org/1998/Math/MathML">\n' +
        '    <mi>x</mi><mo>+</mo><mn>1</mn>\n' +
        '  </math>\n' +
        '\n' +
        '  <!-- JS 动态创建 -->\n' +
        '  const math = document.createElementNS(\n' +
        '    "http://www.w3.org/1998/Math/MathML", "math");\n' +
        '  math.setAttribute("display", "block");\n' +
        '  const mi = document.createElementNS(\n' +
        '    "http://www.w3.org/1998/Math/MathML", "mi");\n' +
        '  mi.textContent = "x";\n' +
        '  math.appendChild(mi);\n' +
        '  document.body.appendChild(math);';
    } catch (err) {
      return '读取 <math> 根元素信息失败：' + err.name + ' - ' + err.message;
    }
  }

  _setMathDisplayMode(mode) {
    this._mathDisplayMode = mode;
    const stage = this.el && this.el.querySelector('.mathml-display-stage math');
    if (stage) {
      try { stage.setAttribute('display', mode); } catch { /* noop */ }
    }
    this.setState({ mathRootInfo: this._readMathRootInfo() });
    const desc = {
      inline: '行内公式（与文字混排，紧凑）',
      block: '块级公式（独占一行，居中，较大）',
    }[mode];
    this._addLog('mathroot', '切换 <math display> → ' + mode + '（' + desc + '）');
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. <math> 根元素 —— display / xmlns / Unicode 字符',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['MathMLElement', f.mathMLElement],
          ['math NS element', f.mathNSElement],
        ]),
        h(Tag, { color: 'primary' }, 'Chrome 109+'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '<math> 是 MathML 公式根元素，必须包裹每个公式。核心属性 display="inline"（默认，行内与文字混排，紧凑）| "block"（独占一行居中，较大字号）。xmlns 命名空间：http://www.w3.org/1998/Math/MathML，HTML 中可省略（解析器自动识别），XML/XHTML 必须显式声明。与 HTML 解析器集成：HTML 解析器将 <math> 及子元素识别为 MathMLElement（继承自 Element，非 HTMLElement），可与 HTML 元素混排。字符编码：Unicode 数学符号（希腊字母 α β γ / 运算符 ± × ÷ ≠ ≤ ≥ ∞ ∑ ∫ / 集合 ∈ ⊂ ∪ ∩ / 箭头 → ⇒），在 <mi>/<mo>/<mtext> 中直接写 Unicode 字符即可。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取信息', { type: 'primary', size: 'sm', onClick: () => this.setState({ mathRootInfo: this._readMathRootInfo() }) }),
          this._btn('display: inline', { size: 'sm', onClick: () => this._setMathDisplayMode('inline') }),
          this._btn('display: block', { size: 'sm', onClick: () => this._setMathDisplayMode('block') }),
        ),
        h('div', { class: 'mathml-display-stage mathml-stage mathml-fallback' },
          h('div', { class: 'fs-sm text-secondary' }, '当前 display=' + this._mathDisplayMode + '：'),
          h('math', { display: this._mathDisplayMode },
            h('mi', {}, 'E'),
            h('mo', {}, '='),
            h('mi', {}, 'm'),
            h('msup', {}, h('mi', {}, 'c'), h('mn', {}, '2')),
          ),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.mathRootInfo || '（点击按钮切换 <math display> 查看说明）')),
        h(Alert, {
          type: 'info',
          message: 'display="inline" 行内紧凑，display="block" 独占一行居中',
          description: 'HTML 中可省略 xmlns（解析器自动识别 MathML 命名空间）；XML/XHTML 必须显式声明 xmlns="http://www.w3.org/1998/Math/MathML"。MathMLElement 继承自 Element 而非 HTMLElement，但可与 HTML 元素混排。Unicode 字符直接写无需特殊字体。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：基础元素 ===================

  _readBasicElementsInfo() {
    const f = this._flags();
    try {
      let liveInfo = '(未读取)';
      if (f.mathMLElement) {
        try {
          const stage = this.el && this.el.querySelector('.mathml-basic-stage');
          if (stage) {
            const mi = stage.querySelector('mi');
            const mn = stage.querySelector('mn');
            const mo = stage.querySelector('mo');
            liveInfo = JSON.stringify({
              mi_constructor: mi ? mi.constructor.name : '(无)',
              mn_constructor: mn ? mn.constructor.name : '(无)',
              mo_constructor: mo ? mo.constructor.name : '(无)',
              mi_mathvariant: mi ? mi.getAttribute('mathvariant') : '(无)',
            }, null, 2);
          }
        } catch (e) {
          liveInfo = '读取失败：' + e.name + ' - ' + e.message;
        }
      }
      return '===== MathML 基础元素 =====\n' +
        '\n' +
        '【基础元素全集】\n' +
        '  <mi>   —— 标识符（identifier），变量名 / 函数名 / 常量名\n' +
        '            默认 italic（斜体），如 <mi>x</mi> 渲染为 x（斜体）\n' +
        '            多字符时默认 upright（直立），如 <mi>sin</mi> 渲染为 sin\n' +
        '  <mn>   —— 数字（number），如 <mn>2</mn> / <mn>3.14</mn> / <mn>1/2</mn>\n' +
        '            默认 upright（直立），无斜体\n' +
        '  <mo>   —— 运算符（operator），如 <mo>+</mo> / <mo>=</mo> / <mo>≤</mo>\n' +
        '            自动处理前导 / 后继空格（如 a + b 而非 a+b）\n' +
        '            支持 form 属性：prefix | infix | postfix\n' +
        '              （影响运算符位置与空格，如 -(负号) vs -(减号)）\n' +
        '  <ms>   —— 字符串（string literal），如 <ms>"hello"</ms>\n' +
        '            默认带引号（引号样式可由 lquote / rquote 属性控制）\n' +
        '  <mtext> —— 文本（任意文本，非数学语义），如 <mtext>if</mtext>\n' +
        '            用于在公式中嵌入说明文字\n' +
        '  <mspace> —— 空格（无内容，仅占位），用 width / height / depth 控制尺寸\n' +
        '            如 <mspace width="1em"/> 插入 1em 空格\n' +
        '  <mrow>  —— 分组（group），将多个元素视为一个整体\n' +
        '            用于明确优先级，如 (a + b) × c\n' +
        '            <mrow><mi>a</mi><mo>+</mo><mi>b</mi></mrow>\n' +
        '\n' +
        '【公共属性】\n' +
        '  mathvariant —— 字体变体\n' +
        '    normal        —— 正常（直立）\n' +
        '    italic        —— 斜体（<mi> 默认）\n' +
        '    bold          —— 粗体\n' +
        '    bold-italic   —— 粗斜体\n' +
        '    double-struck —— 双线体（如 ℝ ℕ ℤ ℚ ℂ，数学集合常用）\n' +
        '    fraktur       —— 哥特体（如 𝔄 𝔅 𝔆）\n' +
        '    script        —— 花体（如 𝒜 𝓑 𝒞）\n' +
        '    sans-serif    —— 无衬线\n' +
        '    monospace     —— 等宽\n' +
        '  mathsize —— 字号（如 "12pt" / "1.2em" / "120%"）\n' +
        '  mathcolor —— 颜色（如 "red" / "#ff0000"）\n' +
        '\n' +
        '【当前演示】\n' +
        '  当前 mathvariant = ' + this._mathVariantMode + '\n' +
        '  实时状态：\n' +
        liveInfo + '\n' +
        '\n' +
        '【完整代码示例】\n' +
        '  <math>\n' +
        '    <mi>x</mi>            <!-- 变量 x（斜体） -->\n' +
        '    <mo>+</mo>            <!-- 加号 -->\n' +
        '    <mn>1</mn>            <!-- 数字 1 -->\n' +
        '  </math>\n' +
        '\n' +
        '  <!-- mathvariant 演示 -->\n' +
        '  <math>\n' +
        '    <mi mathvariant="normal">x</mi>      <!-- 直立 -->\n' +
        '    <mi mathvariant="bold">v</mi>         <!-- 粗体（向量常用） -->\n' +
        '    <mi mathvariant="double-struck">R</mi> <!-- ℝ 实数集 -->\n' +
        '    <mi mathvariant="fraktur">g</mi>      <!-- 哥特体 -->\n' +
        '  </math>\n' +
        '\n' +
        '  <!-- mrow 分组 -->\n' +
        '  <math>\n' +
        '    <mrow>\n' +
        '      <mo>(</mo>\n' +
        '      <mi>a</mi><mo>+</mo><mi>b</mi>\n' +
        '      <mo>)</mo>\n' +
        '    </mrow>\n' +
        '    <mo>×</mo>\n' +
        '    <mi>c</mi>\n' +
        '  </math>\n' +
        '\n' +
        '  <!-- mtext 嵌入文字 -->\n' +
        '  <math>\n' +
        '    <mi>x</mi><mo>=</mo>\n' +
        '    <mtext>if</mtext>\n' +
        '    <mi>x</mi><mo>></mo><mn>0</mn>\n' +
        '  </math>\n' +
        '\n' +
        '  <!-- mspace 空格 -->\n' +
        '  <math>\n' +
        '    <mi>a</mi>\n' +
        '    <mspace width="1em"/>\n' +
        '    <mi>b</mi>\n' +
        '  </math>';
    } catch (err) {
      return '读取基础元素信息失败：' + err.name + ' - ' + err.message;
    }
  }

  _setMathVariant(mode) {
    this._mathVariantMode = mode;
    const stage = this.el && this.el.querySelector('.mathml-basic-stage');
    if (stage) {
      try {
        const targets = stage.querySelectorAll('mi.mathvariant-target');
        for (const t of targets) t.setAttribute('mathvariant', mode);
      } catch { /* noop */ }
    }
    this.setState({ basicElementsInfo: this._readBasicElementsInfo() });
    this._addLog('basic', '切换 mathvariant → ' + mode);
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. 基础元素 —— mi / mn / mo / ms / mtext / mspace / mrow',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['MathMLElement', f.mathMLElement]]),
        h(Tag, { color: 'primary' }, '7 大基础元素'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '基础元素：<mi>（标识符，默认斜体，多字符直立如 sin）/ <mn>（数字，直立）/ <mo>（运算符，自动空格 + form 属性 prefix/infix/postfix）/ <ms>（字符串字面量，带引号）/ <mtext>（任意文本，非数学语义）/ <mspace>（空格，width/height/depth）/ <mrow>（分组，明确优先级）。公共属性：mathvariant（normal/italic/bold/bold-italic/double-struck ℝ/fraktur 𝔄/script 𝒜/sans-serif/monospace）、mathsize、mathcolor。double-struck 常用于数学集合（ℝ ℕ ℤ ℚ ℂ），bold 常用于向量。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取信息', { type: 'primary', size: 'sm', onClick: () => this.setState({ basicElementsInfo: this._readBasicElementsInfo() }) }),
          this._btn('normal', { size: 'sm', onClick: () => this._setMathVariant('normal') }),
          this._btn('italic', { size: 'sm', onClick: () => this._setMathVariant('italic') }),
          this._btn('bold', { size: 'sm', onClick: () => this._setMathVariant('bold') }),
          this._btn('double-struck', { size: 'sm', onClick: () => this._setMathVariant('double-struck') }),
          this._btn('fraktur', { size: 'sm', onClick: () => this._setMathVariant('fraktur') }),
        ),
        h('div', { class: 'mathml-basic-stage mathml-stage mathml-fallback' },
          h('div', {}, '基础元素演示（mathvariant=' + this._mathVariantMode + '）：'),
          h('math', {},
            h('mi', { class: 'mathvariant-target', mathvariant: this._mathVariantMode }, 'x'),
            h('mo', {}, '+'),
            h('mn', {}, '1'),
            h('mo', {}, '='),
            h('mi', { class: 'mathvariant-target', mathvariant: this._mathVariantMode }, 'y'),
          ),
          h('div', { style: { marginTop: '6px' } },
            '分组 (a+b)×c：',
            h('math', {},
              h('mrow', {},
                h('mo', {}, '('),
                h('mi', {}, 'a'),
                h('mo', {}, '+'),
                h('mi', {}, 'b'),
                h('mo', {}, ')'),
              ),
              h('mo', {}, '×'),
              h('mi', {}, 'c'),
            ),
          ),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.basicElementsInfo || '（点击按钮切换 mathvariant 查看说明）')),
        h(Alert, {
          type: 'info',
          message: 'mathvariant 控制字体变体：double-struck 用于集合 ℝ，bold 用于向量',
          description: '<mi> 单字符默认斜体（变量），多字符默认直立（函数名 sin/cos/log）。<mo> 自动处理前导 / 后继空格，form 属性影响位置（prefix 负号 vs infix 减号）。<mrow> 分组明确优先级，常配合括号使用。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：分数与根式 ===================

  _readFracRootInfo() {
    const f = this._flags();
    try {
      let liveInfo = '(未读取)';
      if (f.mathMLElement) {
        try {
          const stage = this.el && this.el.querySelector('.mathml-frac-stage');
          if (stage) {
            const mfrac = stage.querySelector('mfrac');
            liveInfo = JSON.stringify({
              mfrac_constructor: mfrac ? mfrac.constructor.name : '(无)',
              mfrac_bevelled: mfrac ? mfrac.getAttribute('bevelled') : '(无)',
              msqrt_constructor: stage.querySelector('msqrt')
                ? stage.querySelector('msqrt').constructor.name : '(无)',
            }, null, 2);
          }
        } catch (e) {
          liveInfo = '读取失败：' + e.name + ' - ' + e.message;
        }
      }
      return '===== 分数与根式 =====\n' +
        '\n' +
        '【分数：<mfrac>】\n' +
        '  <mfrac> 分子 分母 </mfrac>\n' +
        '  两个子元素：第一个是分子，第二个是分母\n' +
        '  渲染为水平分数线，分子在上，分母在下\n' +
        '  属性：\n' +
        '    bevelled = "true" | "false"（默认 false）\n' +
        '      true  —— 斜线分数（如 1/2，分子在右上，分母在左下，斜线分隔）\n' +
        '      false —— 水平分数（默认，分子在上分母在下，水平线分隔）\n' +
        '      注意：MathML Core 不支持 bevelled（仅 MathML 3 支持），\n' +
        '            Core 浏览器降级为水平分数或忽略\n' +
        '    linethickness —— 分数线粗细（如 "1px" / "0" / "thick"）\n' +
        '    numalign      —— 分子对齐：left | center | right\n' +
        '    denomalign    —— 分母对齐：left | center | right\n' +
        '\n' +
        '【平方根：<msqrt>】\n' +
        '  <msqrt> 被开方数 </msqrt>\n' +
        '  单个子元素（多个元素自动包裹到 <mrow>）\n' +
        '  渲染为 √ 加上上方水平线 + 被开方数\n' +
        '  无属性（指数固定为 2，不显示）\n' +
        '\n' +
        '【n 次根：<mroot>】\n' +
        '  <mroot> 被开方数 指数 </mroot>\n' +
        '  两个子元素：第一个是被开方数，第二个是指数（显示在左上角）\n' +
        '  渲染为 ⁿ√ 加上上方水平线 + 被开方数，指数在左上角\n' +
        '  与 <msqrt> 区别：<msqrt> 是 <mroot> 指数为 2 的特例（不显示指数）\n' +
        '\n' +
        '【分子分母布局】\n' +
        '  默认水平分数：分子在上，分母在下，水平线居中分隔\n' +
        '  分子分母自动缩小字号（约 0.75em）以适应分数高度\n' +
        '  嵌套分数：<mfrac><mfrac>...</mfrac><mn>2</mn></mfrac> 多层分数\n' +
        '  与 <mrow> 配合：分子或分母是复杂表达式时用 <mrow> 分组\n' +
        '\n' +
        '【根式索引位置】\n' +
        '  <mroot> 的索引（第二个子元素）显示在左上角，自动缩小字号\n' +
        '  常见用法：\n' +
        '    <mroot><mn>8</mn><mn>3</mn></mroot>  —— 三次根号 8 = 2\n' +
        '    <mroot><mi>x</mi><mi>n</mi></mroot>  —— n 次根号 x\n' +
        '\n' +
        '【当前演示】\n' +
        '  bevelled = ' + this._fracBevelled + '\n' +
        '  实时状态：\n' +
        liveInfo + '\n' +
        '\n' +
        '【完整代码示例】\n' +
        '  <!-- 水平分数 -->\n' +
        '  <math>\n' +
        '    <mfrac>\n' +
        '      <mn>1</mn>\n' +
        '      <mn>2</mn>\n' +
        '    </mfrac>\n' +
        '  </math>\n' +
        '\n' +
        '  <!-- 斜线分数（MathML Core 不支持，降级为水平） -->\n' +
        '  <math>\n' +
        '    <mfrac bevelled="true">\n' +
        '      <mn>1</mn>\n' +
        '      <mn>2</mn>\n' +
        '    </mfrac>\n' +
        '  </math>\n' +
        '\n' +
        '  <!-- 复杂分数：分子为 a+b，分母为 c+d -->\n' +
        '  <math>\n' +
        '    <mfrac>\n' +
        '      <mrow><mi>a</mi><mo>+</mo><mi>b</mi></mrow>\n' +
        '      <mrow><mi>c</mi><mo>+</mo><mi>d</mi></mrow>\n' +
        '    </mfrac>\n' +
        '  </math>\n' +
        '\n' +
        '  <!-- 平方根 -->\n' +
        '  <math>\n' +
        '    <msqrt>\n' +
        '      <msup><mi>x</mi><mn>2</mn></msup>\n' +
        '      <mo>+</mo>\n' +
        '      <msup><mi>y</mi><mn>2</mn></msup>\n' +
        '    </msqrt>\n' +
        '  </math>\n' +
        '\n' +
        '  <!-- n 次根（三次根号 8） -->\n' +
        '  <math>\n' +
        '    <mroot>\n' +
        '      <mn>8</mn>\n' +
        '      <mn>3</mn>\n' +
        '    </mroot>\n' +
        '  </math>\n' +
        '\n' +
        '  <!-- 嵌套分数 -->\n' +
        '  <math>\n' +
        '    <mfrac>\n' +
        '      <mfrac><mn>1</mn><mn>2</mn></mfrac>\n' +
        '      <mn>3</mn>\n' +
        '    </mfrac>\n' +
        '  </math>';
    } catch (err) {
      return '读取分数与根式信息失败：' + err.name + ' - ' + err.message;
    }
  }

  _toggleFracBevelled() {
    this._fracBevelled = !this._fracBevelled;
    const stage = this.el && this.el.querySelector('.mathml-frac-stage');
    if (stage) {
      try {
        const mfrac = stage.querySelector('mfrac');
        if (mfrac) {
          if (this._fracBevelled) mfrac.setAttribute('bevelled', 'true');
          else mfrac.removeAttribute('bevelled');
        }
      } catch { /* noop */ }
    }
    this.setState({ fracRootInfo: this._readFracRootInfo() });
    this._addLog('frac', '切换 bevelled → ' + this._fracBevelled + '（' +
      (this._fracBevelled ? '斜线分数（Core 不支持，降级）' : '水平分数（默认）') + '）');
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. 分数与根式 —— mfrac / msqrt / mroot',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['MathMLElement', f.mathMLElement]]),
        h(Tag, { color: 'primary' }, 'bevelled / n 次根'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '分数 <mfrac> 分子 分母 </mfrac>：水平分数线（默认），分子在上分母在下，自动缩小字号约 0.75em。属性 bevelled="true" 斜线分数（MathML Core 不支持，降级为水平）、linethickness 分数线粗细、numalign/denomalign 对齐。平方根 <msqrt> 单子元素，渲染 √ + 上方水平线 + 被开方数，无属性（指数固定 2 不显示）。n 次根 <mroot> 被开方数 指数 </mroot>，两子元素，指数显示在左上角自动缩小，与 <msqrt> 区别是 <msqrt> 是 <mroot> 指数为 2 的特例。嵌套分数与 <mrow> 配合组织复杂表达式。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取信息', { type: 'primary', size: 'sm', onClick: () => this.setState({ fracRootInfo: this._readFracRootInfo() }) }),
          this._btn('bevelled（' + (this._fracBevelled ? '已开启' : '关闭') + '）', { size: 'sm', onClick: () => this._toggleFracBevelled() }),
        ),
        h('div', { class: 'mathml-frac-stage mathml-stage mathml-fallback' },
          h('div', {}, '分数演示：'),
          h('math', {},
            h('mfrac', { bevelled: this._fracBevelled ? 'true' : null },
              h('mrow', {}, h('mi', {}, 'a'), h('mo', {}, '+'), h('mi', {}, 'b')),
              h('mrow', {}, h('mi', {}, 'c'), h('mo', {}, '+'), h('mi', {}, 'd')),
            ),
          ),
          h('div', { style: { marginTop: '6px' } }, '平方根 / n 次根演示：'),
          h('math', {},
            h('msqrt', {},
              h('msup', {}, h('mi', {}, 'x'), h('mn', {}, '2')),
              h('mo', {}, '+'),
              h('msup', {}, h('mi', {}, 'y'), h('mn', {}, '2')),
            ),
            h('mo', {}, '='),
            h('mroot', {}, h('mn', {}, '8'), h('mn', {}, '3')),
          ),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.fracRootInfo || '（点击按钮切换 bevelled 查看说明）')),
        h(Alert, {
          type: 'warning',
          message: 'bevelled 属性 MathML Core 不支持，仅 MathML 3 完整支持',
          description: 'Core 浏览器对 bevelled="true" 降级为水平分数或忽略。生产中斜线分数建议用 <mo>/</mo> 手动布局（如 <mn>1</mn><mo>/</mo><mn>2</mn>）。<msqrt> 是 <mroot> 指数为 2 的特例（不显示指数），<mroot> 用于显示 n 次根（指数在左上角）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：脚本元素 ===================

  _readScriptsInfo() {
    const f = this._flags();
    try {
      let liveInfo = '(未读取)';
      if (f.mathMLElement) {
        try {
          const stage = this.el && this.el.querySelector('.mathml-scripts-stage');
          if (stage) {
            const msub = stage.querySelector('msub');
            const munderover = stage.querySelector('munderover');
            liveInfo = JSON.stringify({
              msub_constructor: msub ? msub.constructor.name : '(无)',
              munderover_constructor: munderover ? munderover.constructor.name : '(无)',
            }, null, 2);
          }
        } catch (e) {
          liveInfo = '读取失败：' + e.name + ' - ' + e.message;
        }
      }
      return '===== 脚本元素 =====\n' +
        '\n' +
        '【脚本元素全集】\n' +
        '  <msub>        —— 下标（base subscript），如 x_i\n' +
        '  <msup>        —— 上标（base superscript），如 x²\n' +
        '  <msubsup>     —— 上下标（base subscript superscript），如 x_i²\n' +
        '  <munder>      —— 下限（base underscript），如 x̲（在正下方）\n' +
        '  <mover>       —— 上限（base overscript），如 x̄（在正上方）\n' +
        '  <munderover>  —— 上下限（base underscript overscript），如 ∑_i^n\n' +
        '  <mmultiscripts> —— 多重脚本（前置 / 后置 / 多个上下标）\n' +
        '\n' +
        '【语法】\n' +
        '  <msub> base subscript </msub>\n' +
        '  <msup> base superscript </msup>\n' +
        '  <msubsup> base subscript superscript </msubsup>\n' +
        '  <munder> base underscript </munder>\n' +
        '  <mover> base overscript </mover>\n' +
        '  <munderover> base underscript overscript </munderover>\n' +
        '\n' +
        '【msub/msup vs munder/mover 区别】\n' +
        '  <msub>/<msup>：脚本在 base 的右下 / 右上（角标位置）\n' +
        '    适合：变量下标（x_i）/ 上标（x²）\n' +
        '    脚本较小（约 0.7em），基线对齐到 base\n' +
        '  <munder>/<mover>：脚本在 base 的正下方 / 正上方（极限位置）\n' +
        '    适合：求和符号上下限（∑_i^n）/ 积分上下限 / 向量箭头（x̄）\n' +
        '    脚本与 base 居中对齐，水平排列\n' +
        '\n' +
        '【求和积分上下限】\n' +
        '  求和符号 ∑ 的上下限用 <munderover>：\n' +
        '    <math>\n' +
        '      <munderover>\n' +
        '        <mo>∑</mo>\n' +
        '        <mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow>\n' +
        '        <mi>n</mi>\n' +
        '      </munderover>\n' +
        '      <msub><mi>x</mi><mi>i</mi></msub>\n' +
        '    </math>\n' +
        '    渲染为：∑(i=1 到 n) x_i\n' +
        '  积分符号 ∫ 的上下限用 <munderover> 或 <msubsup>：\n' +
        '    <math>\n' +
        '      <msubsup>\n' +
        '        <mo>∫</mo>\n' +
        '        <mn>0</mn>\n' +
        '        <mi>∞</mi>\n' +
        '      </msubsup>\n' +
        '      <msup><mi>x</mi><mn>2</mn></msup>\n' +
        '      <mi>dx</mi>\n' +
        '    </math>\n' +
        '    渲染为：∫(0 到 ∞) x² dx\n' +
        '\n' +
        '【<mmultiscripts> 多重脚本】\n' +
        '  用于张量等需要多个上下标的场景：\n' +
        '    <mmultiscripts> base\n' +
        '      (subscript superscript)*\n' +
        '      <mprescripts/>\n' +
        '      (presubscript presuperscript)*\n' +
        '    </mmultiscripts>\n' +
        '  示例（张量）：\n' +
        '    <mmultiscripts>\n' +
        '      <mi>T</mi>\n' +
        '      <mi>i</mi>      <!-- 后置下标 -->\n' +
        '      <mi>j</mi>      <!-- 后置上标 -->\n' +
        '      <mprescripts/>\n' +
        '      <mi>k</mi>      <!-- 前置下标 -->\n' +
        '      <mi>l</mi>      <!-- 前置上标 -->\n' +
        '    </mmultiscripts>\n' +
        '    渲染为：ₖˡTᵢʲ（前置与后置脚本同时存在）\n' +
        '\n' +
        '【当前演示】\n' +
        '  实时状态：\n' +
        liveInfo + '\n' +
        '\n' +
        '【完整代码示例】\n' +
        '  <!-- 下标 x_i -->\n' +
        '  <math><msub><mi>x</mi><mi>i</mi></msub></math>\n' +
        '\n' +
        '  <!-- 上标 x² -->\n' +
        '  <math><msup><mi>x</mi><mn>2</mn></msup></math>\n' +
        '\n' +
        '  <!-- 上下标 x_i² -->\n' +
        '  <math>\n' +
        '    <msubsup>\n' +
        '      <mi>x</mi>\n' +
        '      <mi>i</mi>\n' +
        '      <mn>2</mn>\n' +
        '    </msubsup>\n' +
        '  </math>\n' +
        '\n' +
        '  <!-- 求和 ∑(i=1, n) x_i -->\n' +
        '  <math>\n' +
        '    <munderover>\n' +
        '      <mo>∑</mo>\n' +
        '      <mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow>\n' +
        '      <mi>n</mi>\n' +
        '    </munderover>\n' +
        '    <msub><mi>x</mi><mi>i</mi></msub>\n' +
        '  </math>\n' +
        '\n' +
        '  <!-- 积分 ∫(0, ∞) x² dx -->\n' +
        '  <math>\n' +
        '    <msubsup>\n' +
        '      <mo>∫</mo>\n' +
        '      <mn>0</mn>\n' +
        '      <mi>∞</mi>\n' +
        '    </msubsup>\n' +
        '    <msup><mi>x</mi><mn>2</mn></msup>\n' +
        '    <mi>dx</mi>\n' +
        '  </math>\n' +
        '\n' +
        '  <!-- 向量箭头 x̄ -->\n' +
        '  <math><mover><mi>x</mi><mo>̄</mo></mover></math>\n' +
        '\n' +
        '  <!-- 张量多重脚本 -->\n' +
        '  <math>\n' +
        '    <mmultiscripts>\n' +
        '      <mi>T</mi>\n' +
        '      <mi>i</mi><mi>j</mi>\n' +
        '      <mprescripts/>\n' +
        '      <mi>k</mi><mi>l</mi>\n' +
        '    </mmultiscripts>\n' +
        '  </math>';
    } catch (err) {
      return '读取脚本元素信息失败：' + err.name + ' - ' + err.message;
    }
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. 脚本元素 —— msub / msup / munder / mover / mmultiscripts',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['MathMLElement', f.mathMLElement]]),
        h(Tag, { color: 'primary' }, '7 大脚本元素'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '脚本元素全集：<msub> 下标（base 右下角）/ <msup> 上标（base 右上角）/ <msubsup> 上下标（如 x_i²）/ <munder> 下限（base 正下方）/ <mover> 上限（base 正上方，如向量箭头 x̄）/ <munderover> 上下限（如 ∑_i^n）/ <mmultiscripts> 多重脚本（张量，含 <mprescripts> 前置脚本）。msub/msup 是角标位置（变量下标 x_i、上标 x²），munder/mover 是极限位置（求和积分上下限、向量箭头），居中对齐。求和符号用 <munderover>，积分用 <msubsup>（角标位置）或 <munderover>（极限位置）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取脚本元素信息', { type: 'primary', size: 'sm', onClick: () => this.setState({ scriptsInfo: this._readScriptsInfo() }) }),
        ),
        h('div', { class: 'mathml-scripts-stage mathml-stage mathml-fallback' },
          h('div', {}, '下标 / 上标 / 上下标：'),
          h('math', {},
            h('msub', {}, h('mi', {}, 'x'), h('mi', {}, 'i')),
            h('mo', {}, '+'),
            h('msup', {}, h('mi', {}, 'x'), h('mn', {}, '2')),
            h('mo', {}, '+'),
            h('msubsup', {}, h('mi', {}, 'x'), h('mi', {}, 'i'), h('mn', {}, '2')),
          ),
          h('div', { style: { marginTop: '6px' } }, '求和 / 积分（上下限）：'),
          h('math', {},
            h('munderover', {},
              h('mo', {}, '∑'),
              h('mrow', {}, h('mi', {}, 'i'), h('mo', {}, '='), h('mn', {}, '1')),
              h('mi', {}, 'n'),
            ),
            h('msub', {}, h('mi', {}, 'x'), h('mi', {}, 'i')),
            h('mo', {}, '+'),
            h('msubsup', {},
              h('mo', {}, '∫'),
              h('mn', {}, '0'),
              h('mi', {}, '∞'),
            ),
            h('msup', {}, h('mi', {}, 'x'), h('mn', {}, '2')),
            h('mi', {}, 'dx'),
          ),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.scriptsInfo || '（点击「读取脚本元素信息」查看 7 大脚本元素与代码示例）')),
        h(Alert, {
          type: 'info',
          message: 'msub/msup 是角标位置，munder/mover 是极限位置（正下 / 正上方）',
          description: '变量下标（x_i）/ 上标（x²）用 msub/msup（角标，约 0.7em，右下 / 右上）；求和符号上下限（∑_i^n）/ 向量箭头（x̄）用 munder/mover/munderover（极限位置，居中对齐）。求和用 <munderover>，积分用 <msubsup>。张量用 <mmultiscripts> + <mprescripts>。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：矩阵与表格 ===================

  _readMatrixInfo() {
    const f = this._flags();
    try {
      let liveInfo = '(未读取)';
      if (f.mathMLElement) {
        try {
          const stage = this.el && this.el.querySelector('.mathml-matrix-stage');
          if (stage) {
            const mtable = stage.querySelector('mtable');
            liveInfo = JSON.stringify({
              mtable_constructor: mtable ? mtable.constructor.name : '(无)',
              mtr_count: stage.querySelectorAll('mtr').length,
              mtd_count: stage.querySelectorAll('mtd').length,
            }, null, 2);
          }
        } catch (e) {
          liveInfo = '读取失败：' + e.name + ' - ' + e.message;
        }
      }
      return '===== 矩阵与表格 =====\n' +
        '\n' +
        '【表格元素全集】\n' +
        '  <mtable> —— 矩阵 / 表格容器\n' +
        '  <mtr>    —— 行（table row）\n' +
        '  <mtd>    —— 单元格（table data）\n' +
        '  类似 HTML <table>/<tr>/<td>，但专为数学布局设计\n' +
        '\n' +
        '【基本结构】\n' +
        '  <mtable>\n' +
        '    <mtr>\n' +
        '      <mtd>...</mtd>\n' +
        '      <mtd>...</mtd>\n' +
        '    </mtr>\n' +
        '    <mtr>...</mtr>\n' +
        '  </mtable>\n' +
        '\n' +
        '【对齐属性】\n' +
        '  <mtable> 属性：\n' +
        '    columnalign —— 全表列对齐：left | center | right（可多个值，如 "center left"）\n' +
        '    rowalign    —— 全表行对齐：top | baseline | center | bottom | axis\n' +
        '    align       —— 表格相对环境的对齐：axis | baseline | center | top | bottom\n' +
        '    rowlines / columnlines —— 行 / 列分隔线：none | solid | dashed\n' +
        '    frame       —— 外框：none | solid | dashed\n' +
        '  <mtd> 属性（覆盖 <mtable>）：\n' +
        '    columnalign —— 单元格列对齐\n' +
        '    rowalign    —— 单元格行对齐\n' +
        '    colspan / rowspan —— 合并单元格（类似 HTML）\n' +
        '\n' +
        '【矩阵表示（带括号）】\n' +
        '  数学中矩阵通常带圆括号或方括号，用 <mo> 括号 + <mtable>：\n' +
        '    <math>\n' +
        '      <mo>(</mo>\n' +
        '      <mtable>\n' +
        '        <mtr>\n' +
        '          <mtd><mi>a</mi></mtd>\n' +
        '          <mtd><mi>b</mi></td>\n' +
        '        </mtr>\n' +
        '        <mtr>\n' +
        '          <mtd><mi>c</mi></mtd>\n' +
        '          <mtd><mi>d</mi></mtd>\n' +
        '        </mtr>\n' +
        '      </mtable>\n' +
        '      <mo>)</mo>\n' +
        '    </math>\n' +
        '    渲染为带圆括号的 2×2 矩阵\n' +
        '  注意：MathML Core 不自动拉伸括号，需 CSS 或浏览器自动处理\n' +
        '\n' +
        '【<mfrac> 与矩阵嵌套】\n' +
        '  矩阵元素可以是分数等复杂表达式：\n' +
        '    <mtd>\n' +
        '      <mfrac><mn>1</mn><mn>2</mn></mfrac>\n' +
        '    </mtd>\n' +
        '  分数自动缩小以适应单元格\n' +
        '\n' +
        '【determinant / transpose 表示】\n' +
        '  行列式（determinant）：用 |...| 包裹矩阵（垂直线代替圆括号）\n' +
        '    <math>\n' +
        '      <mo>|</mo>\n' +
        '      <mtable>...</mtable>\n' +
        '      <mo>|</mo>\n' +
        '    </math>\n' +
        '    渲染为 |A|（矩阵 A 的行列式）\n' +
        '  转置（transpose）：用上标 T\n' +
        '    <msup><mi>A</mi><mi>T</mi></msup>\n' +
        '    渲染为 Aᵀ（矩阵 A 的转置）\n' +
        '\n' +
        '【当前演示】\n' +
        '  实时状态：\n' +
        liveInfo + '\n' +
        '\n' +
        '【完整代码示例】\n' +
        '  <!-- 2×2 矩阵带圆括号 -->\n' +
        '  <math>\n' +
        '    <mo>(</mo>\n' +
        '    <mtable>\n' +
        '      <mtr>\n' +
        '        <mtd><mi>a</mi></mtd>\n' +
        '        <mtd><mi>b</mi></mtd>\n' +
        '      </mtr>\n' +
        '      <mtr>\n' +
        '        <mtd><mi>c</mi></mtd>\n' +
        '        <mtd><mi>d</mi></mtd>\n' +
        '      </mtr>\n' +
        '    </mtable>\n' +
        '    <mo>)</mo>\n' +
        '  </math>\n' +
        '\n' +
        '  <!-- 矩阵元素为分数 -->\n' +
        '  <math>\n' +
        '    <mo>(</mo>\n' +
        '    <mtable>\n' +
        '      <mtr>\n' +
        '        <mtd><mfrac><mn>1</mn><mn>2</mn></mfrac></mtd>\n' +
        '        <mtd><mn>0</mn></mtd>\n' +
        '      </mtr>\n' +
        '      <mtr>\n' +
        '        <mtd><mn>0</mn></mtd>\n' +
        '        <mtd><mfrac><mn>1</mn><mn>3</mn></mfrac></mtd>\n' +
        '      </mtr>\n' +
        '    </mtable>\n' +
        '    <mo>)</mo>\n' +
        '  </math>\n' +
        '\n' +
        '  <!-- 行列式 |A| -->\n' +
        '  <math>\n' +
        '    <mo>|</mo>\n' +
        '    <mtable>\n' +
        '      <mtr><mtd><mi>a</mi></mtd><mtd><mi>b</mi></mtd></mtr>\n' +
        '      <mtr><mtd><mi>c</mi></mtd><mtd><mi>d</mi></mtd></mtr>\n' +
        '    </mtable>\n' +
        '    <mo>|</mo>\n' +
        '  </math>\n' +
        '\n' +
        '  <!-- 列对齐：右对齐第一列，居中第二列 -->\n' +
        '  <mtable columnalign="right center">\n' +
        '    <mtr><mtd>123</mtd><mtd>x</mtd></mtr>\n' +
        '    <mtr><mtd>4</mtd><mtd>y</mtd></mtr>\n' +
        '  </mtable>\n' +
        '\n' +
        '  <!-- 转置矩阵 Aᵀ -->\n' +
        '  <math>\n' +
        '    <msup><mi>A</mi><mi>T</mi></msup>\n' +
        '  </math>';
    } catch (err) {
      return '读取矩阵与表格信息失败：' + err.name + ' - ' + err.message;
    }
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. 矩阵与表格 —— mtable / mtr / mtd / 对齐 / 嵌套',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['MathMLElement', f.mathMLElement]]),
        h(Tag, { color: 'primary' }, '矩阵 / 行列式 / 转置'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '表格元素：<mtable>（矩阵 / 表格容器）/ <mtr>（行）/ <mtd>（单元格），类似 HTML table/tr/td 但专为数学布局。<mtable> 属性：columnalign（列对齐 left/center/right，可多值）/ rowalign（行对齐）/ align（表格相对环境对齐）/ rowlines/columnlines（分隔线）/ frame（外框）。<mtd> 覆盖属性 + colspan/ rowspan 合并。矩阵带括号：用 <mo>(</mo> + <mtable> + <mo>)</mo>。行列式用 <mo>|</mo> 包裹。转置用 <msup><mi>A</mi><mi>T</mi></msup>。<mfrac> 与矩阵嵌套时分数自动缩小适应单元格。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取矩阵信息', { type: 'primary', size: 'sm', onClick: () => this.setState({ matrixInfo: this._readMatrixInfo() }) }),
        ),
        h('div', { class: 'mathml-matrix-stage mathml-stage mathml-fallback' },
          h('div', {}, '2×2 矩阵（圆括号）：'),
          h('math', {},
            h('mo', { class: 'matrix-bracket' }, '('),
            h('mtable', {},
              h('mtr', {},
                h('mtd', {}, h('mi', {}, 'a')),
                h('mtd', {}, h('mi', {}, 'b')),
              ),
              h('mtr', {},
                h('mtd', {}, h('mi', {}, 'c')),
                h('mtd', {}, h('mi', {}, 'd')),
              ),
            ),
            h('mo', { class: 'matrix-bracket' }, ')'),
          ),
          h('div', { style: { marginTop: '6px' } }, '行列式 |A| 与转置 Aᵀ：'),
          h('math', {},
            h('mo', { class: 'matrix-bracket' }, '|'),
            h('mtable', {},
              h('mtr', {}, h('mtd', {}, h('mi', {}, 'a')), h('mtd', {}, h('mi', {}, 'b'))),
              h('mtr', {}, h('mtd', {}, h('mi', {}, 'c')), h('mtd', {}, h('mi', {}, 'd'))),
            ),
            h('mo', { class: 'matrix-bracket' }, '|'),
            h('mo', {}, '='),
            h('msup', {}, h('mi', {}, 'A'), h('mi', {}, 'T')),
          ),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.matrixInfo || '（点击「读取矩阵信息」查看矩阵 / 行列式 / 转置完整代码）')),
        h(Alert, {
          type: 'info',
          message: '矩阵用 <mo>(</mo> + <mtable> + <mo>)</mo>，行列式用 |...| 包裹',
          description: '<mtable> 类似 HTML <table> 但专为数学布局，columnalign 控制列对齐（可多值如 "right center"）。矩阵带括号需手动用 <mo> 添加（Core 不自动拉伸括号，依赖浏览器实现）。行列式用 <mo>|</mo> 替代圆括号。转置用上标 T（<msup><mi>A</mi><mi>T</mi></msup>）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 7：实战：常用公式渲染 ===================

  _readFormulasInfo() {
    const f = this._flags();
    try {
      return '===== 实战：常用公式渲染 =====\n' +
        '\n' +
        '【公式清单】\n' +
        '  1. 二次方程求根公式：x = (-b ± √(b² - 4ac)) / 2a\n' +
        '  2. 勾股定理：a² + b² = c²\n' +
        '  3. 欧拉公式：e^(iπ) + 1 = 0\n' +
        '  4. 积分公式：∫(0 到 ∞) e^(-x²) dx = √π / 2\n' +
        '  5. 矩阵乘法：C = A × B（2×2 矩阵）\n' +
        '\n' +
        '【公式 1：二次方程求根公式】\n' +
        '  MathML：\n' +
        '    <math display="block">\n' +
        '      <mi>x</mi><mo>=</mo>\n' +
        '      <mfrac>\n' +
        '        <mrow>\n' +
        '          <mo>-</mo><mi>b</mi>\n' +
        '          <mo>±</mo>\n' +
        '          <msqrt>\n' +
        '            <msup><mi>b</mi><mn>2</mn></msup>\n' +
        '            <mo>-</mo>\n' +
        '            <mn>4</mn><mi>a</mi><mi>c</mi>\n' +
        '          </msqrt>\n' +
        '        </mrow>\n' +
        '        <mrow><mn>2</mn><mi>a</mi></mrow>\n' +
        '      </mfrac>\n' +
        '    </math>\n' +
        '\n' +
        '  LaTeX 等价：\n' +
        '    x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\n' +
        '\n' +
        '【公式 2：勾股定理】\n' +
        '  MathML：\n' +
        '    <math>\n' +
        '      <msup><mi>a</mi><mn>2</mn></msup>\n' +
        '      <mo>+</mo>\n' +
        '      <msup><mi>b</mi><mn>2</mn></msup>\n' +
        '      <mo>=</mo>\n' +
        '      <msup><mi>c</mi><mn>2</mn></msup>\n' +
        '    </math>\n' +
        '\n' +
        '  LaTeX：a^2 + b^2 = c^2\n' +
        '\n' +
        '【公式 3：欧拉公式】\n' +
        '  MathML：\n' +
        '    <math>\n' +
        '      <msup><mi>e</mi>\n' +
        '        <mrow><mi>i</mi><mi>π</mi></mrow>\n' +
        '      </msup>\n' +
        '      <mo>+</mo>\n' +
        '      <mn>1</mn>\n' +
        '      <mo>=</mo>\n' +
        '      <mn>0</mn>\n' +
        '    </math>\n' +
        '\n' +
        '  LaTeX：e^{i\\pi} + 1 = 0\n' +
        '\n' +
        '【公式 4：积分公式】\n' +
        '  MathML：\n' +
        '    <math>\n' +
        '      <msubsup>\n' +
        '        <mo>∫</mo>\n' +
        '        <mn>0</mn>\n' +
        '        <mi>∞</mi>\n' +
        '      </msubsup>\n' +
        '      <msup><mi>e</mi>\n' +
        '        <mrow><mo>-</mo><msup><mi>x</mi><mn>2</mn></msup></mrow>\n' +
        '      </msup>\n' +
        '      <mi>dx</mi>\n' +
        '      <mo>=</mo>\n' +
        '      <mfrac>\n' +
        '        <msqrt><mi>π</mi></msqrt>\n' +
        '        <mn>2</mn>\n' +
        '      </mfrac>\n' +
        '    </math>\n' +
        '\n' +
        '  LaTeX：\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}\n' +
        '\n' +
        '【公式 5：矩阵乘法】\n' +
        '  MathML：\n' +
        '    <math>\n' +
        '      <mrow>\n' +
        '        <mo>(</mo>\n' +
        '        <mtable>\n' +
        '          <mtr><mtd><mi>a</mi></mtd><mtd><mi>b</mi></mtd></mtr>\n' +
        '          <mtr><mtd><mi>c</mi></mtd><mtd><mi>d</mi></mtd></mtr>\n' +
        '        </mtable>\n' +
        '        <mo>)</mo>\n' +
        '      </mrow>\n' +
        '      <mo>×</mo>\n' +
        '      <mrow>\n' +
        '        <mo>(</mo>\n' +
        '        <mtable>\n' +
        '          <mtr><mtd><mi>e</mi></mtd><mtd><mi>f</mi></mtd></mtr>\n' +
        '          <mtr><mtd><mi>g</mi></mtd><mtd><mi>h</mi></mtd></mtr>\n' +
        '        </mtable>\n' +
        '        <mo>)</mo>\n' +
        '      </mrow>\n' +
        '    </math>\n' +
        '\n' +
        '  LaTeX：\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix} \\times\n' +
        '         \\begin{pmatrix} e & f \\\\ g & h \\end{pmatrix}\n' +
        '\n' +
        '【与 LaTeX 命令对比】\n' +
        '  LaTeX：\\frac{}{} \\sqrt{} \\sum_{}^{} \\int_{}^{} \\begin{matrix}\n' +
        '  MathML：<mfrac><msqrt><munderover><msubsup><mtable>\n' +
        '  LaTeX 更简洁（命令式），MathML 更冗长但语义明确（标记式）\n' +
        '  转换：可用工具（如 LaTeX-to-MathML）自动转换\n' +
        '\n' +
        '【MathJax 迁移】\n' +
        '  MathJax 配置可直接渲染 MathML：\n' +
        '    MathJax = { tex: { ... }, options: { renderActions: { ... } } };\n' +
        '  迁移步骤：\n' +
        '    1. 检测浏览器 MathML 支持：if (window.MathMLElement)\n' +
        '    2. 支持：直接用 <math> 标记，无需 MathJax\n' +
        '    3. 不支持（Chrome < 109）：保留 MathJax 兜底\n' +
        '    4. 渐进增强：现代浏览器零 JS，老浏览器降级 MathJax\n' +
        '\n' +
        '【当前演示】\n' +
        '  当前公式索引 = ' + this._formulaIndex + '\n' +
        '  MathMLElement = ' + f.mathMLElement;
    } catch (err) {
      return '读取常用公式渲染信息失败：' + err.name + ' - ' + err.message;
    }
  }

  _setFormulaIndex(i) {
    this._formulaIndex = i;
    this.setState({ formulasInfo: this._readFormulasInfo() });
    const names = ['二次方程求根公式', '勾股定理', '欧拉公式', '积分公式', '矩阵乘法'];
    this._addLog('formula', '切换公式 → ' + i + '（' + names[i] + '）');
  }

  _renderFormulaByIndex(i) {
    // 返回 h('math', ...) 表示对应公式
    if (i === 0) {
      // 二次方程求根公式
      return h('math', { display: 'block' },
        h('mi', {}, 'x'), h('mo', {}, '='),
        h('mfrac', {},
          h('mrow', {},
            h('mo', {}, '-'), h('mi', {}, 'b'),
            h('mo', {}, '±'),
            h('msqrt', {},
              h('msup', {}, h('mi', {}, 'b'), h('mn', {}, '2')),
              h('mo', {}, '-'),
              h('mn', {}, '4'), h('mi', {}, 'a'), h('mi', {}, 'c'),
            ),
          ),
          h('mrow', {}, h('mn', {}, '2'), h('mi', {}, 'a')),
        ),
      );
    }
    if (i === 1) {
      // 勾股定理
      return h('math', { display: 'block' },
        h('msup', {}, h('mi', {}, 'a'), h('mn', {}, '2')),
        h('mo', {}, '+'),
        h('msup', {}, h('mi', {}, 'b'), h('mn', {}, '2')),
        h('mo', {}, '='),
        h('msup', {}, h('mi', {}, 'c'), h('mn', {}, '2')),
      );
    }
    if (i === 2) {
      // 欧拉公式
      return h('math', { display: 'block' },
        h('msup', {}, h('mi', {}, 'e'),
          h('mrow', {}, h('mi', {}, 'i'), h('mi', {}, 'π'))),
        h('mo', {}, '+'),
        h('mn', {}, '1'),
        h('mo', {}, '='),
        h('mn', {}, '0'),
      );
    }
    if (i === 3) {
      // 积分公式
      return h('math', { display: 'block' },
        h('msubsup', {}, h('mo', {}, '∫'), h('mn', {}, '0'), h('mi', {}, '∞')),
        h('msup', {}, h('mi', {}, 'e'),
          h('mrow', {}, h('mo', {}, '-'),
            h('msup', {}, h('mi', {}, 'x'), h('mn', {}, '2')))),
        h('mi', {}, 'dx'),
        h('mo', {}, '='),
        h('mfrac', {},
          h('msqrt', {}, h('mi', {}, 'π')),
          h('mn', {}, '2')),
      );
    }
    // i === 4：矩阵乘法
    return h('math', { display: 'block' },
      h('mrow', {},
        h('mo', {}, '('),
        h('mtable', {},
          h('mtr', {}, h('mtd', {}, h('mi', {}, 'a')), h('mtd', {}, h('mi', {}, 'b'))),
          h('mtr', {}, h('mtd', {}, h('mi', {}, 'c')), h('mtd', {}, h('mi', {}, 'd'))),
        ),
        h('mo', {}, ')'),
      ),
      h('mo', {}, '×'),
      h('mrow', {},
        h('mo', {}, '('),
        h('mtable', {},
          h('mtr', {}, h('mtd', {}, h('mi', {}, 'e')), h('mtd', {}, h('mi', {}, 'f'))),
          h('mtr', {}, h('mtd', {}, h('mi', {}, 'g')), h('mtd', {}, h('mi', {}, 'h'))),
        ),
        h('mo', {}, ')'),
      ),
    );
  }

  _renderCard7() {
    const s = this.state;
    const f = this._flags();
    const formulaNames = [
      '1. 二次方程求根公式',
      '2. 勾股定理',
      '3. 欧拉公式',
      '4. 积分公式',
      '5. 矩阵乘法',
    ];
    const card = new Card({
      title: '7. 实战：常用公式渲染 —— 求根 / 勾股 / 欧拉 / 积分 / 矩阵',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['MathMLElement', f.mathMLElement]]),
        h(Tag, { color: 'primary' }, '5 大公式 + LaTeX 对比'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '常用公式实战：二次方程求根公式（x = (-b ± √(b²-4ac)) / 2a，用 <mfrac> + <msqrt>）/ 勾股定理（a² + b² = c²，用 <msup>）/ 欧拉公式（e^(iπ) + 1 = 0，用 <msup> + <mrow>）/ 积分公式（∫(0,∞) e^(-x²) dx = √π/2，用 <msubsup> + <msqrt> + <mfrac>）/ 矩阵乘法（<mtable> + <mo> 括号）。与 LaTeX 命令对比：LaTeX 更简洁（命令式），MathML 更冗长但语义明确（标记式），可用工具自动转换。MathJax 迁移：检测 window.MathMLElement 渐进增强，老浏览器（Chrome < 109）保留 MathJax 兜底。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取公式信息', { type: 'primary', size: 'sm', onClick: () => this.setState({ formulasInfo: this._readFormulasInfo() }) }),
          ...formulaNames.map((name, i) =>
            this._btn(name, { size: 'sm', onClick: () => this._setFormulaIndex(i) })),
        ),
        h('div', { class: 'mathml-formulas-stage mathml-stage mathml-fallback' },
          h('div', { class: 'formula-name' }, '当前公式：' + formulaNames[this._formulaIndex]),
          h('div', { class: 'formula-item' },
            this._renderFormulaByIndex(this._formulaIndex),
          ),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.formulasInfo || '（点击公式按钮切换并查看 MathML + LaTeX 对比代码）')),
        h(Alert, {
          type: 'info',
          message: 'LaTeX 命令简洁但需 JS 库，MathML 标记冗长但浏览器原生',
          description: 'LaTeX（\\frac{}{} \\sqrt{} \\sum_{}^{}）需 MathJax/KaTeX 渲染；MathML（<mfrac><msqrt><munderover>）浏览器原生支持但冗长。可用工具自动转换。MathJax 迁移：检测 MathMLElement 渐进增强，老浏览器保留 MathJax 兜底。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 8：陷阱与最佳实践 ===================

  _readPitfallsInfo() {
    const f = this._flags();
    try {
      return '===== MathML Core 陷阱与最佳实践 =====\n' +
        '\n' +
        '【陷阱 1：CSS 样式 math-style / math-depth / math-shift】\n' +
        '  MathML Core 引入三个 CSS 属性控制数学布局：\n' +
        '    math-style: normal | compact\n' +
        '      normal  —— 正常布局（display="block" 默认，较大字号）\n' +
        '      compact —— 紧凑布局（display="inline" 默认，较小字号）\n' +
        '      可手动覆盖：math[display="block"] { math-style: compact; }\n' +
        '    math-depth: <integer>\n' +
        '      数学深度（类似 font-weight 的层级），影响嵌套公式的字号缩放\n' +
        '      默认 0，嵌套分数 / 上下标自动增加 math-depth\n' +
        '      可手动设置：mi { math-depth: 1; }\n' +
        '    math-shift: normal | shift\n' +
        '      数学移位（上标 / 下标的垂直移位）\n' +
        '      normal —— 默认移位\n' +
        '      shift  —— 增加移位（如某些数学风格的上下标更高）\n' +
        '  浏览器支持：Chrome 109+ / Firefox 117+ / Safari 16.4+\n' +
        '  检测：CSS.supports("math-style", "normal")\n' +
        '\n' +
        '【陷阱 2：字体回退（Latin Modern Math）】\n' +
        '  MathML 渲染依赖数学字体（包含数学符号 + 字体特性）\n' +
        '  推荐字体栈：\n' +
        '    math {\n' +
        '      font-family: "Latin Modern Math", "STIX Two Math",\n' +
        '                   "Cambria Math", "Times New Roman", serif;\n' +
        '    }\n' +
        '  常见数学字体：\n' +
        '    Latin Modern Math —— LaTeX 默认数学字体（推荐）\n' +
        '    STIX Two Math     —— STIX 项目（开源，覆盖广）\n' +
        '    Cambria Math      —— Windows 默认数学字体\n' +
        '    TeX Gyre Termes Math —— Times 风格数学字体\n' +
        '  缺失数学字体时浏览器回退到普通字体，部分符号渲染异常\n' +
        '  解决：\n' +
        '    1. @font-face 加载 Latin Modern Math（WOFF2 约 200KB）\n' +
        '    2. 检测字体加载：document.fonts.load("1em Latin Modern Math")\n' +
        '    3. 降级：用 Unicode 字符 + 普通字体（视觉效果略差）\n' +
        '\n' +
        '【陷阱 3：与 KaTeX 性能对比】\n' +
        '  原生 MathML：\n' +
        '    ✓ 零 JS 依赖（不增加 bundle）\n' +
        '    ✓ 浏览器原生渲染（首屏无需等待 JS）\n' +
        '    ✓ 与 DOM 完全集成（可选中 / 可搜索 / 可访问性）\n' +
        '    ✗ 老浏览器不支持（Chrome < 109 需兜底）\n' +
        '    ✗ 不支持 LaTeX 命令（需用 MathML 标记或转换工具）\n' +
        '  KaTeX：\n' +
        '    ✓ 跨浏览器兼容（包括 IE11）\n' +
        '    ✓ 支持 LaTeX 命令（开发者熟悉）\n' +
        '    ✓ 渲染速度快（同步渲染，无需重排）\n' +
        '    ✗ JS 依赖（增加 bundle 约 280KB）\n' +
        '    ✗ 部分 MathML 特性不完整（如 <mmultiscripts>）\n' +
        '  选型建议：\n' +
        '    现代浏览器为主 → 原生 MathML（渐进增强 + KaTeX 兜底）\n' +
        '    需兼容老浏览器 → KaTeX / MathJax\n' +
        '    需要 LaTeX 命令 → KaTeX + 工具转 MathML 输出\n' +
        '\n' +
        '【陷阱 4：可访问性 aria】\n' +
        '  MathML 元素默认无 aria 语义，屏幕阅读器读取困难\n' +
        '  解决：\n' +
        '    1. <math alttext="x 平方加 1"> 提供 alt 文本\n' +
        '    2. 用 <mtext> 嵌入可读描述（如 <mtext>方程</mtext>）\n' +
        '    3. 外层用 aria-label：\n' +
        '       <math aria-label="x 平方加 1 等于 2">...</math>\n' +
        '    4. 关联 <annotation> 元素（MathML 完整规范的注解）\n' +
        '       <math>\n' +
        '         <mi>x</mi><mo>+</mo><mn>1</mn>\n' +
        '         <annotation-xml encoding="text">\n' +
        '           x plus 1\n' +
        '         </annotation-xml>\n' +
        '       </math>\n' +
        '\n' +
        '【陷阱 5：copy-paste 复制粘贴】\n' +
        '  复制 MathML 公式时浏览器行为不一致：\n' +
        '    Chrome —— 复制为 MathML 源码（粘贴到富文本编辑器保留结构）\n' +
        '    Firefox —— 复制为 MathML + alttext\n' +
        '    Safari —— 复制为图片（部分版本）\n' +
        '  解决：\n' +
        '    1. 提供"复制 LaTeX"按钮（用工具 MathML → LaTeX）\n' +
        '    2. 提供"复制 MathML 源码"按钮（手动复制 <math>...</math>）\n' +
        '    3. 提供"复制为图片"按钮（用 SVG/PNG 截图）\n' +
        '\n' +
        '【陷阱 6：DevTools 调试】\n' +
        '  Chrome DevTools 元素面板：\n' +
        '    ✓ 显示 <math> 及子元素为 MathMLElement\n' +
        '    ✓ 可查看 / 编辑属性（mathvariant / display 等）\n' +
        '    ✓ 可查看计算样式（math-style / math-depth）\n' +
        '    ✗ 不显示 MathML 特有的布局算法（如分数 / 根式的内部布局）\n' +
        '  调试技巧：\n' +
        '    1. 临时加 border：math { outline: 1px solid red; }\n' +
        '    2. 用 console.dir(document.querySelector("math")) 查看完整属性\n' +
        '    3. 检测 math-style：getComputedStyle(el).mathStyle\n' +
        '\n' +
        '【陷阱 7：嵌入 HTML 注意事项】\n' +
        '  MathML 嵌入 HTML 时注意：\n' +
        '    1. <math> 必须是公式根（不能裸 <mi>/<mn> 等）\n' +
        '    2. HTML 解析器对未知 MathML 元素容忍（不报错但可能不渲染）\n' +
        '    3. <mtext> 内可嵌入 HTML 行内元素（<a>/<span> 等）\n' +
        '       <mtext><a href="#">参见</a></mtext>\n' +
        '    4. CSS 选择器：math mi { ... }（注意命名空间，HTML 中可省略）\n' +
        '    5. <math> 不能嵌套 <math>（每个公式独立）\n' +
        '    6. 行内公式避免过大（影响行高），用 display="inline" + math-style: compact\n' +
        '\n' +
        '【最佳实践清单】\n' +
        '  ✓ 能力检测：if (window.MathMLElement) 用原生，否则降级 MathJax/KaTeX\n' +
        '  ✓ 字体回退：font-family 包含 Latin Modern Math / STIX Two Math / Cambria Math\n' +
        '  ✓ 用 @font-face 加载数学字体（WOFF2）\n' +
        '  ✓ 行内公式 display="inline"（紧凑，不破坏行高）\n' +
        '  ✓ 块级公式 display="block"（独占一行，居中）\n' +
        '  ✓ 复杂表达式用 <mrow> 分组明确优先级\n' +
        '  ✓ 提供 alttext / aria-label 增强可访问性\n' +
        '  ✓ 提供"复制 LaTeX / MathML 源码"按钮（解决 copy-paste 不一致）\n' +
        '  ✓ 渐进增强：现代浏览器原生渲染 + 老浏览器 MathJax 兜底\n' +
        '  ✓ CSS 用 math-style / math-depth / math-shift 控制布局（Chrome 109+）\n' +
        '  ✓ DevTools 调试：临时 border + console.dir 查看属性\n' +
        '\n' +
        '【能力检测汇总】\n' +
        '  MathMLElement       = ' + f.mathMLElement + '\n' +
        '  MathMLElement ctor  = ' + f.mathMLElementCtor + '\n' +
        '  math NS element     = ' + f.mathNSElement + '\n' +
        '  math-style CSS      = ' + f.mathStyleCSS + '\n' +
        '  mfrac HTMLElement   = ' + f.mfracHTMLElement;
    } catch (err) {
      return '读取陷阱与最佳实践信息失败：' + err.name + ' - ' + err.message;
    }
  }

  _runPitfallsDemo() {
    this.setState({ pitfallsInfo: this._readPitfallsInfo() });
    const f = this._flags();
    this._addLog('pitfalls', '陷阱与最佳实践演示完成；MathMLElement=' + f.mathMLElement + ', math-style CSS=' + f.mathStyleCSS);
  }

  _renderCard8() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 陷阱与最佳实践 —— math-style / 字体 / KaTeX / a11y / 调试',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['MathMLElement', f.mathMLElement],
          ['math-style CSS', f.mathStyleCSS],
        ]),
        h(Tag, { color: 'warning' }, '7 大陷阱'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '七大陷阱：CSS 样式 math-style（normal/compact）/ math-depth（嵌套层级）/ math-shift（上下标移位），Chrome 109+/Firefox 117+/Safari 16.4+ 支持；字体回退（Latin Modern Math / STIX Two Math / Cambria Math，缺失时符号渲染异常，用 @font-face 加载）；与 KaTeX 性能对比（原生零 JS 但老浏览器不支持，KaTeX 跨浏览器但需 JS 依赖）；可访问性 aria（alttext / aria-label / annotation-xml）；copy-paste 不一致（提供复制 LaTeX/MathML 源码/图片按钮）；DevTools 调试（MathMLElement + math-style 计算样式 + 临时 border）；嵌入 HTML 注意事项（<math> 必须是根 / <mtext> 内嵌 HTML / 不能嵌套 <math>）。最佳实践清单 11 条覆盖能力检测、字体回退、display 选择、<mrow> 分组、可访问性、copy-paste、渐进增强、CSS 控制、DevTools 调试。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行陷阱与最佳实践演示', { type: 'primary', size: 'sm', onClick: () => this._runPitfallsDemo() }),
        ),
        h('div', { class: 'mathml-pitfalls-stage' },
          h('div', { class: 'fs-sm text-secondary' }, 'math-style 演示（normal vs compact）：'),
          h('div', { class: 'math-style-normal', style: { marginTop: '6px' } },
            h('math', { display: 'block' },
              h('msup', {}, h('mi', {}, 'x'), h('mn', {}, '2')),
              h('mo', {}, '+'),
              h('mn', {}, '1'),
            ),
          ),
          h('div', { class: 'math-style-compact', style: { marginTop: '4px' } },
            h('math', { display: 'block' },
              h('msup', {}, h('mi', {}, 'x'), h('mn', {}, '2')),
              h('mo', {}, '+'),
              h('mn', {}, '1'),
            ),
          ),
          h('div', { style: { marginTop: '6px', fontSize: '12px', color: '#92400e' } },
            'math-style: normal 较大字号，compact 紧凑（Chrome 109+/Firefox 117+/Safari 16.4+ 支持）'),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.pitfallsInfo || '（点击按钮查看 7 大陷阱与 11 条最佳实践完整说明）')),
        h(Alert, {
          type: 'warning',
          message: '字体回退 + 渐进增强是 MathML 生产使用的关键',
          description: '七大陷阱：math-style CSS（Chrome 109+）、字体回退（Latin Modern Math @font-face）、KaTeX 性能对比（零 JS vs 跨浏览器）、可访问性（alttext/aria-label）、copy-paste（提供复制按钮）、DevTools 调试、嵌入 HTML 注意事项。最佳实践 11 条：能力检测 + 字体回退 + display 选择 + <mrow> 分组 + 可访问性 + copy-paste + 渐进增强（老浏览器 MathJax 兜底）+ CSS 控制 + DevTools 调试。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== 日志面板 ===================

  _renderLogPanel() {
    const s = this.state;
    const reversed = [...s.logs].reverse();   // 按时间倒序：最新日志在最上方
    return h('div', { class: 'log-panel' },
      h('div', { class: 'log-panel__header' },
        '事件日志（按时间倒序）',
        h(Tag, { color: 'primary' }, s.logs.length + ' 条'),
      ),
      reversed.length === 0
        ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
        : reversed.map((log) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: 'log-panel__tag log-panel__tag--' + log.type }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  // =================== 渲染入口 ===================

  render() {
    const s = this.state;
    return h('div', { class: 'api-lab-page mathml-core-page' },
      h('h2', { class: 'section-title' }, 'MathML Core 数学公式渲染完整实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页演示 W3C MathML Core 数学公式标记语言全套能力：<math> 根元素（display/xmlns/Unicode 字符）、基础元素（mi/mn/mo/ms/mtext/mspace/mrow + mathvariant）、分数与根式（mfrac/msqrt/mroot + bevelled）、脚本元素（msub/msup/msubsup/munder/mover/munderover/mmultiscripts）、矩阵与表格（mtable/mtr/mtd + 对齐 + 行列式/转置）、实战常用公式（求根/勾股/欧拉/积分/矩阵乘法 + LaTeX 对比 + MathJax 迁移）、陷阱与最佳实践（math-style/math-depth CSS、字体回退、KaTeX 对比、aria、copy-paste、DevTools 调试）。MathML 是标记语言非 JS API，用 DOM createElement + CSS.supports 能力检测，不可用时仅记日志，绝不抛异常。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderCard6(),
      this._renderCard7(),
      this._renderCard8(),
      this._renderLogPanel(),
    );
  }
}
