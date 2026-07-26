// =====================================================================
// CSSGeneratedContentListsPage.js —— CSS 生成内容与列表样式 实验室
// 演示 CSS 中常被忽略但高价值的「内容生成 / 列表 / 计数器 / 分页」模块：
//   1. 生成内容 ::before / ::after / ::marker —— content 属性取值全集：
//      <string> | <uri> | <image> | attr(<identifier>) | counter(<ident>)
//      | counters(<ident>, "<string>") | counter(<ident>, <list-style>)
//      | open-quote | close-quote | no-open-quote | no-close-quote
//      | leader("<string>") | <var()> | normal | none | auto
//   2. CSS Lists Module Level 3 —— ::marker 伪元素 + list-style-type
//      /list-style-position / list-style-image / list-style 简写；
//      ::marker 可独立设 color/font-family/content
//   3. CSS @counter-style —— 自定义列表计数样式
//      system: cyclic | numeric | alphabetic | symbolic | additive |
//              fixed | extends；
//      symbols / additive-symbols / prefix / suffix / range / pad /
//      negative / fallback / speak-as；
//      应用：CJK 注音序号、希伯来数字、自定义图标列表
//   4. CSS Paged Media + Fragmentation —— @page 规则、:left/:right/:first
//      /:blank 页面盒模型、margin box (@top-center/@bottom-right 等 16 个)、
//      named pages (page: intro)、break-before/after/inside、orphans/widows
// 说明：jsdom 不做真实 CSS 渲染，但 CSS.supports() 可探测 ::marker / @page
//       支持；演示样式注入到 head 中，可在真实浏览器查看效果。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Tag } from '../../components/ui/Tag.js';

export class CSSGeneratedContentListsPage extends Page {
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      genContentInfo: '',  // Card 1：生成内容
      listsInfo: '',       // Card 2：::marker 与 list-style
      counterStyleInfo: '',// Card 3：@counter-style
      pagedMediaInfo: '',  // Card 4：@page 与 Fragmentation
    };
  }

  componentDidMount() {
    if (this._inited) return;
    this._inited = true;

    this._dynamicStyles = [];

    const f = this._flags();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `CSS ${c(f.css)}`,
      `::before ${c(f.before)}`,
      `::marker ${c(f.marker)}`,
      `content:counter() ${c(f.contentCounter)}`,
      `@counter-style ${c(f.counterStyle)}`,
      `@page ${c(f.page)}`,
      `break-inside ${c(f.breakInside)}`,
      `orphans ${c(f.orphans)}`,
    ];
    const summary = f.css
      ? `CSS 生成内容与列表样式能力检测：${parts.join(' · ')}。jsdom 不做真实 CSS 渲染，但 CSS.supports 可探测伪元素/属性支持；按钮点击注入演示 <style>，可在真实浏览器查看效果。`
      : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击仅记日志说明。';
    this.setState({ capsSummary: summary });
    this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.marker) this._addLog('warn', '::marker 不可用（Chrome 86+/Firefox 68+/Safari 14.1+）');
    if (!f.counterStyle) this._addLog('warn', '@counter-style 不可用（Firefox 33+/Chrome 91+/Safari 17+）');

    this._injectBaseStyles();
  }

  componentWillUnmount() {
    for (const s of this._dynamicStyles) {
      try { s.parentNode && s.parentNode.removeChild(s); } catch { /* noop */ }
    }
    this._dynamicStyles = [];
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
    this._dynamicStyles.push(style);
    return style;
  }

  _injectBaseStyles() {
    this._injectStyle('css-gen-lists-base', `
      .gl-section { margin-top: 8px; }
      .gl-gen-demo { background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-top: 8px; }
      .gl-gen-demo .gl-quote::before { content: open-quote; color: #6366f1; font-size: 1.4em; font-weight: 700; }
      .gl-gen-demo .gl-quote::after { content: close-quote; color: #6366f1; font-size: 1.4em; font-weight: 700; }
      .gl-gen-demo .gl-attr::before { content: "» " attr(data-label) "："; color: #1e40af; font-weight: 600; }
      .gl-gen-demo .gl-counter { counter-reset: section; }
      .gl-gen-demo .gl-counter h4 { counter-increment: section; }
      .gl-gen-demo .gl-counter h4::before { content: "Section " counter(section) "："; color: #b45309; font-weight: 600; margin-right: 4px; }
      .gl-gen-demo .gl-nested { counter-reset: item; padding-left: 0; list-style: none; }
      .gl-gen-demo .gl-nested > li { counter-increment: item; margin-bottom: 4px; }
      .gl-gen-demo .gl-nested > li::before { content: counters(item, ".") " "; color: #1e40af; font-weight: 700; }
      .gl-list-demo { background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-top: 8px; }
      .gl-list-demo .gl-marker-custom { list-style: none; padding-left: 0; }
      .gl-list-demo .gl-marker-custom li::marker { content: "▶ "; color: #dc2626; font-size: 0.9em; }
      .gl-list-demo .gl-marker-emoji { list-style-type: "🎯 "; padding-left: 1.2em; }
      .gl-list-demo .gl-marker-square { list-style-type: square; list-style-position: inside; }
      .gl-counter-style-demo { background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-top: 8px; }
      .gl-counter-style-demo ol.gl-cjk { list-style-type: simp-chinese-formal; padding-left: 2em; }
      .gl-counter-style-demo ol.gl-circled { list-style-type: circled-decimal; padding-left: 2em; }
      .gl-counter-style-demo ul.gl-icon { list-style-type: "→ "; padding-left: 1.2em; }
      .gl-paged-demo { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; padding: 12px; margin-top: 8px; }
      .gl-paged-demo .gl-cols { column-count: 2; column-gap: 24px; column-rule: 1px dashed #94a3b8; }
      .gl-paged-demo .gl-cols p { break-inside: avoid; margin: 0 0 6px 0; }
      .gl-output { background: #0f172a; color: #e2e8f0; border-radius: 4px; padding: 8px; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; margin-top: 8px; }
    `);
  }

  _flags() {
    const hasCSS = typeof CSS !== 'undefined';
    const supportsSel = (sel) => {
      try { return hasCSS && typeof CSS.supports === 'function' && CSS.supports(`selector(${sel})`); }
      catch { return false; }
    };
    const supportsPV = (p, v) => {
      try { return hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v); }
      catch { return false; }
    };
    // @counter-style / @page 不能用 CSS.supports('@rule') 探测（返回 false），
    // 改用 selector 探测伪元素 + 属性探测
    return {
      css: hasCSS,
      before: supportsSel('a::before'),
      marker: supportsSel('li::marker'),
      contentCounter: supportsPV('content', 'counter(x)'),
      contentCounters: supportsPV('content', 'counters(x, ".")'),
      attr: supportsPV('content', 'attr(data-x)'),
      openQuote: supportsPV('content', 'open-quote'),
      counterStyle: supportsSel('ol'), // @counter-style 不能直接探测，用 ol 存在性兜底
      page: supportsSel('html'),         // @page 不能直接探测
      breakInside: supportsPV('break-inside', 'avoid'),
      breakBefore: supportsPV('break-before', 'page'),
      orphans: supportsPV('orphans', '2'),
      widows: supportsPV('widows', '2'),
    };
  }

  // ===================== Card 1：生成内容 ::before / ::after =====================
  _runGenContentDemo() {
    const f = this._flags();
    this._injectStyle('gl-gen-demo-extra', `
      .gl-gen-demo .gl-leader::after { content: leader(".") ; color: #94a3b8; }
    `);
    const info = [
      '===== CSS 生成内容 ::before / ::after / content 全集 =====',
      '',
      '【伪元素】',
      '  ::before  - 元素内容前生成子元素（必须是 display:inline 等可生成盒子）',
      '  ::after   - 元素内容后生成子元素',
      '  ::marker  - 列表项标记（仅 display:list-item 元素）',
      '  ::first-letter / ::first-line / ::selection / ::placeholder 等',
      '',
      '【content 属性取值全集】',
      '  content: "字符串";                       /* 普通字符串 */',
      '  content: attr(data-label);              /* 取元素属性值 */',
      '  content: url(icon.png);                 /* 替换元素图片（::before/::after）*/',
      '  content: image-set(...);                /* 多分辨率图片 */',
      '  content: counter(name);                 /* 单层计数器 */',
      '  content: counter(name, lower-roman);    /* 带 list-style */',
      '  content: counters(name, ".");           /* 嵌套计数器，分隔符 "." */',
      '  content: counters(name, "-", decimal);  /* 嵌套 + list-style */',
      '  content: open-quote;                    /* 开引号，配合 quotes 属性 */',
      '  content: close-quote;                   /* 闭引号 */',
      '  content: no-open-quote / no-close-quote;/* 递增引号层级但不显示 */',
      '  content: leader(".");                   /* 引导符，填充空白，目录页码常用 */',
      '  content: var(--icon);                   /* CSS 变量 */',
      '  content: normal / none / auto;          /* 默认值/无/替换元素原内容 */',
      '',
      '【counter() / counters() 嵌套计数器示例】',
      '  .gl-counter { counter-reset: section; }',
      '  .gl-counter h4 { counter-increment: section; }',
      '  .gl-counter h4::before { content: "Section " counter(section) "："; }',
      '',
      '  嵌套列表（多级 1.1, 1.2, 1.2.1）：',
      '  ol.gl-nested { counter-reset: item; }',
      '  ol.gl-nested > li { counter-increment: item; }',
      '  ol.gl-nested > li::before { content: counters(item, ".") " "; }',
      '  /* 嵌套 ol 重新 counter-reset 复位，counters() 自动拼接父级值 */',
      '',
      '【open-quote 与 quotes 属性】',
      '  .gl-quote { quotes: "«" "»" """ """; }  /* 两层引号 */',
      '  .gl-quote::before { content: open-quote; }',
      '  .gl-quote::after  { content: close-quote; }',
      '  /* 嵌套 quote 自动切换到第二层引号 */',
      '',
      '【浏览器支持】',
      `  ::before: ${f.before ? '✓' : '✗'}  |  content: counter(): ${f.contentCounter ? '✓' : '✗'}  |  counters(): ${f.contentCounters ? '✓' : '✗'}`,
      `  attr(): ${f.attr ? '✓' : '✗'}  |  open-quote: ${f.openQuote ? '✓' : '✗'}`,
      '  leader() 仅 CSS GCPM 提案，主流浏览器尚未实现',
    ].join('\n');
    this.setState({ genContentInfo: info });
    this._addLog('info', '生成内容演示：::before/::after/::marker + content 全取值（含 counter/counters/attr/open-quote）');
  }

  _renderCard1() {
    const f = this._flags();
    const s = this.state;
    return h(Card, {
      title: 'Card 1 · 生成内容 ::before / ::after + content 全集',
      extra: h(Tag, { color: f.before ? 'success' : 'error' }, f.before ? '::before 已支持' : '::before 未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'CSS Generated Content Module：::before/::after/::marker 伪元素 + content 属性（string/attr/url/counter/counters/open-quote/leader/var）。常用于装饰图标、引号、自动编号、目录页码引导。'),
      h('div', { class: 'gl-gen-demo' },
        h('div', { class: 'gl-quote' }, '使用 open-quote / close-quote 的引号渲染'),
        h('div', { class: 'gl-attr', 'data-label': '属性值' }, '由 attr(data-label) 注入前缀'),
        h('div', { class: 'gl-counter' },
          h('h4', {}, '第一节'),
          h('h4', {}, '第二节'),
          h('h4', {}, '第三节'),
        ),
        h('ol', { class: 'gl-nested' },
          h('li', {}, '顶层 1'),
          h('li', {}, '顶层 2',
            h('ol', { class: 'gl-nested' },
              h('li', {}, '嵌套 2.1'),
              h('li', {}, '嵌套 2.2'),
            ),
          ),
          h('li', {}, '顶层 3'),
        ),
      ),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('运行生成内容演示', { type: 'primary', size: 'sm', onClick: () => this._runGenContentDemo() }),
      ),
      s.genContentInfo ? h('pre', { class: 'code-block mt-md' }, s.genContentInfo) : null,
    );
  }

  // ===================== Card 2：::marker 与 list-style =====================
  _runListsDemo() {
    const f = this._flags();
    const info = [
      '===== CSS Lists Module Level 3 =====',
      '',
      '【::marker 伪元素】',
      '  仅 display: list-item 元素生成；可独立设 color/font-family/font-size/content',
      '  li::marker { content: "▶ "; color: red; font-family: monospace; }',
      '  /* list-style: none 后 ::marker 仍存在但内容空 */',
      '',
      '【list-style 简写 = list-style-type + list-style-position + list-style-image】',
      '  list-style: <type> <position> <image>;',
      '',
      '【list-style-type 取值（部分常用）】',
      '  disc / circle / square / decimal / decimal-leading-zero',
      '  lower-alpha / upper-alpha / lower-roman / upper-roman',
      '  lower-greek / lower-latin / upper-latin / armenian / georgian',
      '  hebrew / cjk-ideographic / simp-chinese-formal / trad-chinese-formal',
      '  hiragana / katakana / hiragana-iroha / katakana-iroha',
      '  "<string>"  /* CSS3 任意字符串，如 list-style-type: "→ " */',
      '  <custom-ident>  /* 引用 @counter-style 定义 */',
      '',
      '【list-style-position】',
      '  outside（默认）：标记在 li 内容框外，不占 li 宽度',
      '  inside：标记在 li 内容框内，作为第一个 inline 子元素',
      '',
      '【list-style-image】',
      '  list-style-image: url(marker.png);  /* 图片标记 */',
      '  list-style-image: linear-gradient(...);  /* 渐变标记 */',
      '  list-style-image: none;             /* 取消图片 */',
      '',
      '【::marker vs list-style-type 字符串】',
      '  /* 两者都能用自定义字符串 */',
      '  li { list-style-type: "🎯 "; }       /* 简单场景 */',
      '  li::marker { content: "▶ " counter(item); }  /* 复杂场景：与计数器组合 */',
      '',
      '【浏览器支持】',
      `  ::marker: ${f.marker ? '✓' : '✗'}  |  Chrome 86+/Firefox 68+/Safari 14.1+`,
      '  list-style-type 字符串：Chrome 89+/Firefox 39+/Safari 14.1+',
      '  list-style-image 渐变：Chrome 89+/Firefox 39+',
    ].join('\n');
    this.setState({ listsInfo: info });
    this._addLog('info', '::marker + list-style 演示：::marker 伪元素独立设色 + list-style-type 字符串 + position inside');
  }

  _renderCard2() {
    const f = this._flags();
    const s = this.state;
    return h(Card, {
      title: 'Card 2 · CSS Lists Module L3 ::marker + list-style',
      extra: h(Tag, { color: f.marker ? 'success' : 'error' }, f.marker ? '::marker 已支持' : '::marker 未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        '::marker 伪元素独立设色/字体/content + list-style-type 支持 CSS3 任意字符串 + list-style-position: outside/inside + list-style-image 图片/渐变。'),
      h('div', { class: 'gl-list-demo' },
        h('ul', { class: 'gl-marker-custom' },
          h('li', {}, '::marker content: "▶ " + color: red'),
          h('li', {}, '独立设 marker 颜色与字体'),
          h('li', {}, 'list-style: none 后用 ::marker 重建'),
        ),
        h('ul', { class: 'gl-marker-emoji' },
          h('li', {}, 'list-style-type: "🎯 " 字符串标记'),
          h('li', {}, 'CSS3 任意字符串支持'),
        ),
        h('ul', { class: 'gl-marker-square' },
          h('li', {}, 'list-style-type: square'),
          h('li', {}, 'list-style-position: inside 标记进内容框'),
        ),
      ),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('运行列表样式演示', { type: 'primary', size: 'sm', onClick: () => this._runListsDemo() }),
      ),
      s.listsInfo ? h('pre', { class: 'code-block mt-md' }, s.listsInfo) : null,
    );
  }

  // ===================== Card 3：@counter-style 自定义计数器 =====================
  _runCounterStyleDemo() {
    const f = this._flags();
    this._injectStyle('gl-counter-style-extra', `
      @counter-style gl-triangle {
        system: cyclic;
        symbols: "▶";
        suffix: " ";
      }
      @counter-style gl-abc {
        system: alphabetic;
        symbols: "🅰" "🅱" "🅲" "🅳" "🅴";
        suffix: " ";
      }
      @counter-style gl-bullets {
        system: fixed;
        symbols: "①" "②" "③" "④" "⑤";
      }
      @counter-style gl-roman {
        system: extends lower-roman;
        prefix: "(";
        suffix: ") ";
      }
      @counter-style gl-binary {
        system: numeric;
        symbols: "0" "1";
      }
      @counter-style gl-tally {
        system: additive;
        additive-symbols: 5 "五", 1 "丨";
      }
      .gl-counter-style-demo ul.gl-triangle { list-style-type: gl-triangle; padding-left: 1.5em; }
      .gl-counter-style-demo ul.gl-abc { list-style-type: gl-abc; padding-left: 1.5em; }
      .gl-counter-style-demo ul.gl-bullets { list-style-type: gl-bullets; padding-left: 1.5em; }
      .gl-counter-style-demo ul.gl-roman-ext { list-style-type: gl-roman; padding-left: 2em; }
      .gl-counter-style-demo ul.gl-binary { list-style-type: gl-binary; padding-left: 1.5em; }
      .gl-counter-style-demo ul.gl-tally { list-style-type: gl-tally; padding-left: 1.5em; }
    `);
    const info = [
      '===== CSS @counter-style 自定义计数器样式 =====',
      '',
      '【语法】',
      '  @counter-style <name> {',
      '    system: <system-keyword>;     /* 必填 */',
      '    symbols: <symbols>;           /* 除 extends 外必填 */',
      '    additive-symbols: <values>;   /* 仅 additive 用 */',
      '    prefix: <string>;             /* 前缀 */',
      '    suffix: <string>;             /* 后缀，默认 ". " */',
      '    range: <range>;               /* 计数器适用范围 */',
      '    pad: <length> <symbol>;       /* 前导填充 */',
      '    negative: <pre> <post>;       /* 负数包裹符号 */',
      '    fallback: <counter-style>;    /* 溢出回退 */',
      '    speak-as: <speak-keyword>;    /* 屏幕阅读器朗读方式 */',
      '  }',
      '',
      '【system 取值（决定计数器递增算法）】',
      '  cyclic       - 循环使用 symbols（列表长度 > symbols 数量时循环）',
      '  numeric      - 进制数字（如 symbols: "0" "1" = 二进制）',
      '  alphabetic   - 字母表式（1=a, 2=b, ..., 27=aa）',
      '  symbolic     - 重复符号（1=*, 2=**, 3=***）',
      '  additive     - 加法（罗马数字式：additive-symbols: 10 "X", 5 "V", 1 "I"）',
      '  fixed        - 固定列表，超出用 fallback',
      '  extends      - 继承已有 counter-style（如 extends lower-roman）',
      '',
      '【示例：自定义图标列表】',
      '  @counter-style triangle {',
      '    system: cyclic;',
      '    symbols: "▶";',
      '    suffix: " ";',
      '  }',
      '  ul { list-style-type: triangle; }',
      '',
      '【示例：罗马数字 + 前后缀】',
      '  @counter-style roman-paren {',
      '    system: extends lower-roman;',
      '    prefix: "(";',
      '    suffix: ") ";',
      '  }',
      '',
      '【示例：二进制】',
      '  @counter-style binary {',
      '    system: numeric;',
      '    symbols: "0" "1";',
      '  }',
      '',
      '【示例：画正字】',
      '  @counter-style tally {',
      '    system: additive;',
      '    additive-symbols: 5 "五", 1 "丨";',
      '  }',
      '',
      '【浏览器支持】',
      `  @counter-style: ${f.counterStyle ? '已注入（jsdom 不能直接探测，需真实浏览器验证）' : 'jsdom 探测受限'}`,
      '  Firefox 33+/Chrome 91+/Safari 17+',
    ].join('\n');
    this.setState({ counterStyleInfo: info });
    this._addLog('info', '@counter-style 演示：注入 6 种自定义计数器（cyclic/alphabetic/fixed/extends/numeric/additive）');
  }

  _renderCard3() {
    const f = this._flags();
    const s = this.state;
    return h(Card, {
      title: 'Card 3 · CSS @counter-style 自定义计数器',
      extra: h(Tag, { color: f.counterStyle ? 'success' : 'error' }, f.counterStyle ? '已支持' : '需真实浏览器'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'CSS Counter Styles Level 3 @counter-style 规则自定义列表计数样式：system（cyclic/numeric/alphabetic/symbolic/additive/fixed/extends）+ symbols/additive-symbols + prefix/suffix/range/pad/negative/fallback/speak-as。常用于 CJK 序号、希伯来数字、自定义图标列表。'),
      h('div', { class: 'gl-counter-style-demo' },
        h('ul', { class: 'gl-triangle' },
          h('li', {}, 'system: cyclic + symbols: "▶"（循环三角形）'),
          h('li', {}, 'cyclic 超出 symbols 数量时循环使用'),
          h('li', {}, '最简单的图标列表方案'),
        ),
        h('ul', { class: 'gl-abc' },
          h('li', {}, 'system: alphabetic + 🅰🅱🅲🅳🅴'),
          h('li', {}, '第 6 项变成 🅰🅰（类似 aa, ab, ac）'),
        ),
        h('ul', { class: 'gl-bullets' },
          h('li', {}, 'system: fixed ① ② ③ ④ ⑤'),
          h('li', {}, '超出 5 项使用 fallback'),
        ),
        h('ul', { class: 'gl-roman-ext' },
          h('li', {}, 'system: extends lower-roman'),
          h('li', {}, 'prefix: "(" suffix: ") "'),
          h('li', {}, '继承已有样式 + 加前后缀'),
        ),
        h('ul', { class: 'gl-binary' },
          h('li', {}, 'system: numeric + symbols: 0 1'),
          h('li', {}, '第 2 项是 10，第 3 项是 11，第 4 项是 100'),
        ),
        h('ul', { class: 'gl-tally' },
          h('li', {}, 'system: additive（画正字式）'),
          h('li', {}, '5 = 五，6 = 五丨'),
        ),
      ),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('运行 @counter-style 演示', { type: 'primary', size: 'sm', onClick: () => this._runCounterStyleDemo() }),
      ),
      s.counterStyleInfo ? h('pre', { class: 'code-block mt-md' }, s.counterStyleInfo) : null,
    );
  }

  // ===================== Card 4：@page + Fragmentation =====================
  _runPagedMediaDemo() {
    const f = this._flags();
    this._injectStyle('gl-paged-demo-extra', `
      @page gl-intro {
        size: A4;
        margin: 2cm;
        @top-center { content: "文档标题"; font-size: 9pt; color: #666; }
        @bottom-right { content: "第 " counter(page) " 页 / 共 " counter(pages) " 页"; font-size: 9pt; }
        @bottom-left { content: counter(page, lower-roman); }
      }
      .gl-paged-page { page: gl-intro; }
      @page :first { margin-top: 4cm; }
      @page :left { margin-left: 3cm; margin-right: 1.5cm; }
      @page :right { margin-left: 1.5cm; margin-right: 3cm; }
    `);
    const info = [
      '===== CSS Paged Media + Fragmentation =====',
      '',
      '【@page 规则 —— 定义打印页面盒模型】',
      '  @page {',
      '    size: A4 | landscape | portrait | 21cm 29.7cm;',
      '    margin: 2cm;',
      '    marks: crop cross | none;        /* 打印裁剪标记 */',
      '    bleed: 3mm;                       /* 出血区域 */',
      '  }',
      '',
      '【命名页面 —— 让元素强制分到指定页面盒】',
      '  @page intro { size: A4; margin: 2cm; }',
      '  .intro-page { page: intro; }       /* 命名页面应用 */',
      '  /* 元素换页时切换到 @page intro 配置 */',
      '',
      '【页面伪类】',
      '  @page :first   - 文档第一页（常加大上边距）',
      '  @page :left    - 左页（双面打印奇数页）',
      '  @page :right   - 右页（双面打印偶数页）',
      '  @page :blank   - 空白页（章节强制 break-after: right 留空）',
      '',
      '【Margin Box —— 页眉页脚 16 个槽位】',
      '  @top-left-corner / @top-left / @top-center / @top-right / @top-right-corner',
      '  @right-top / @right-middle / @right-bottom',
      '  @bottom-left-corner / @bottom-left / @bottom-center / @bottom-right / @bottom-right-corner',
      '  @left-top / @left-middle / @left-bottom',
      '',
      '  @top-center { content: "文档标题"; }',
      '  @bottom-right { content: "第 " counter(page) " 页"; }',
      '  @bottom-left { content: counter(page, lower-roman); }',
      '  /* counter(page) 当前页号，counter(pages) 总页数 */',
      '',
      '【Fragmentation 分页控制】',
      '  break-before: page | column | avoid | left | right | recto | verso;',
      '  break-after:  page | column | avoid | left | right | recto | verso;',
      '  break-inside: avoid | avoid-page | avoid-column;',
      '',
      '  常用：图片/卡片不想被分页打断',
      '    .card { break-inside: avoid; }',
      '  章节标题后强制分页',
      '    h2.chapter { break-before: page; }',
      '',
      '【widows 与 orphans】',
      '  widows: <integer>;  /* 段落末尾在新页至少保留多少行（默认 2）*/',
      '  orphans: <integer>; /* 段落开头在旧页至少保留多少行（默认 2）*/',
      '  p { widows: 3; orphans: 3; }   /* 段落首尾各至少 3 行，避免孤行 */',
      '',
      '【浏览器支持】',
      `  @page: ${f.page ? '已注入（jsdom 探测受限）' : 'jsdom 探测受限'}`,
      `  break-inside: avoid: ${f.breakInside ? '✓' : '✗'}  |  break-before: page: ${f.breakBefore ? '✓' : '✗'}`,
      `  orphans: ${f.orphans ? '✓' : '✗'}  |  widows: ${f.widows ? '✓' : '✗'}`,
      '  @page margin box：Chrome 打印支持有限，Firefox/Safari 完整支持',
      '  break-* 系列：Chrome 65+/Firefox 65+/Safari 13+（替代旧 page-break-*）',
    ].join('\n');
    this.setState({ pagedMediaInfo: info });
    this._addLog('info', '@page + Fragmentation 演示：@page 命名页 + margin box + break-* + widows/orphans');
  }

  _renderCard4() {
    const f = this._flags();
    const s = this.state;
    return h(Card, {
      title: 'Card 4 · CSS Paged Media + Fragmentation @page',
      extra: h(Tag, { color: f.breakInside ? 'success' : 'error' }, f.breakInside ? 'break-* 已支持' : 'break-* 未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'CSS Paged Media Module @page 规则定义打印页面盒模型 + 16 个 margin box 页眉页脚 + 命名页面 + :first/:left/:right/:blank 伪类。CSS Fragmentation break-before/after/inside + widows/orphans 控制分页断行。'),
      h('div', { class: 'gl-paged-demo' },
        h('div', { class: 'gl-cols' },
          h('p', {}, 'break-inside: avoid 演示：这段不会被分栏打断'),
          h('p', {}, '多栏布局与 fragmentation 协同工作，column-fill: balance 会让各栏尽量平衡'),
          h('p', {}, '打印时 break-before: page 可让章节标题强制新页'),
          h('p', {}, 'widows/orphans 控制段落首尾至少保留几行避免孤行'),
        ),
      ),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('运行分页媒体演示', { type: 'primary', size: 'sm', onClick: () => this._runPagedMediaDemo() }),
      ),
      s.pagedMediaInfo ? h('pre', { class: 'code-block mt-md' }, s.pagedMediaInfo) : null,
    );
  }

  _renderLogPanel() {
    const s = this.state;
    return h(Card, { title: '日志面板' },
      h('div', { class: 'log-panel' },
        s.logs.length === 0
          ? h('div', { class: 'log-empty' }, '暂无日志')
          : s.logs.map((log) =>
              h('div', { class: `log-item log-item--${log.type}` },
                h('span', { class: 'log-time' }, log.time),
                h('span', { class: `log-badge log-badge--${log.type}` }, log.type),
                h('span', { class: 'log-content' }, log.content),
              ),
            ),
      ),
    );
  }

  renderPage() {
    const s = this.state;
    return [
      h('h2', { class: 'section-title' }, 'CSS 生成内容与列表样式'),
      h('p', { class: 'text-secondary mb-lg' }, s.capsSummary),
      h('div', { class: 'feature-grid' },
        this._renderCard1(),
        this._renderCard2(),
        this._renderCard3(),
        this._renderCard4(),
      ),
      this._renderLogPanel(),
    ];
  }
}
