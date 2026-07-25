// =====================================================================
// ModernCSSPage.js —— 现代 CSS 平台特性实验室
// 演示 MDN / 现代 CSS 平台特性：
//   1. @layer Cascade Layers（级联层）—— 命名层、声明顺序优先级、
//      !important 反转规则、@import layer(name)
//   2. @scope 与 :has() 选择器 —— 作用域规则、:scope、关系伪类（父选择器）
//   3. color-mix() / 相对颜色 / light-dark() —— srgb/oklch 混色、
//      from <color> 派生、color-scheme 自动明暗、prefers-color-scheme
//   4. CSS Nesting（原生嵌套）—— & 父选择器引用、嵌套 @media、与 SCSS 区别
//   5. 三角函数 / text-wrap / 其他新特性 —— sin/cos/tan/pow/sqrt/hypot、
//      text-wrap: balance/pretty/stable、@starting-style、
//      transition-behavior: allow-discrete、interpolate-size、field-sizing
// =====================================================================

import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class ModernCSSPage extends Page {
  initialState() {
    return {
      logs: [],
      // —— 能力检测结果 ——
      layerSupported: false,
      scopeSupported: false,
      hasSupported: false,
      colorMixSupported: false,
      relativeColorSupported: false,
      lightDarkSupported: false,
      nestingSupported: false,
      trigSupported: false,
      textWrapSupported: false,
      startingStyleSupported: false,
      transitionBehaviorSupported: false,
      interpolateSizeSupported: false,
      fieldSizingSupported: false,
      // —— 演示状态 ——
      layerOrder: 'normal',        // @layer 演示：'normal' | 'reversed'
      layerImportantOn: false,     // 是否注入 !important 演示
      hasActiveChild: false,       // :has() 演示：是否给子元素加 .active
      colorScheme: 'light',        // light-dark() 演示：'light' | 'dark'
      nestActive: false,           // CSS Nesting 演示：.nest-card.active 切换
      startingVisible: false,      // @starting-style 演示：元素是否已显示
      trigRadius: 80,              // 三角函数演示：圆半径(px)
      trigAngleOffset: 0,          // 三角函数演示：起始角度(deg)
    };
  }

  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    this._injectedStyles = [];

    // —— 能力检测（全部用 try/catch，避免 jsdom 抛异常）——
    // check(prop, val) 检测属性值；check('@rule') 检测 @ 规则；check('selector(s)') 检测选择器
    const check = (a, b) => {
      try {
        if (typeof CSS === 'undefined') return false;
        if (a.startsWith('@')) return CSS.supports(a);
        if (a === 'selector') return CSS.supports(`selector(${b})`);
        return CSS.supports(a, b);
      } catch { return false; }
    };
    const layerSupported = check('@layer base');
    const scopeSupported = check('@scope');
    const hasSupported = check('selector', ':has(*)');
    const colorMixSupported = check('color', 'color-mix(in srgb, red, blue)');
    const relativeColorSupported = check('color', 'rgb(from red r g b)');
    const lightDarkSupported = check('color', 'light-dark(white, black)');
    const nestingSupported = check('selector', '&.a');
    const trigSupported = check('width', 'calc(sin(45deg) * 10px)');
    const textWrapSupported = check('text-wrap', 'balance');
    const startingStyleSupported = check('@starting-style');
    const transitionBehaviorSupported = check('transition-behavior', 'allow-discrete');
    const interpolateSizeSupported = check('interpolate-size', 'allow-keywords');
    const fieldSizingSupported = check('field-sizing', 'content');

    const summary = '特性检测 → '
      + `@layer=${layerSupported}, @scope=${scopeSupported}, :has=${hasSupported}, `
      + `color-mix=${colorMixSupported}, 相对颜色=${relativeColorSupported}, light-dark=${lightDarkSupported}, `
      + `Nesting=${nestingSupported}, 三角函数=${trigSupported}, text-wrap=${textWrapSupported}, `
      + `@starting-style=${startingStyleSupported}, transition-behavior=${transitionBehaviorSupported}, `
      + `interpolate-size=${interpolateSizeSupported}, field-sizing=${fieldSizingSupported}`;

    // —— 单次 setState：写入能力检测结果 + 初始日志，避免多次 rerender ——
    this.setState({
      layerSupported, scopeSupported, hasSupported,
      colorMixSupported, relativeColorSupported, lightDarkSupported,
      nestingSupported, trigSupported, textWrapSupported,
      startingStyleSupported, transitionBehaviorSupported,
      interpolateSizeSupported, fieldSizingSupported,
      logs: [...this.state.logs, { type: 'info', content: summary, time: formatTime() }].slice(-40),
    });

    // —— 注入演示 CSS（仅一次；style 元素在 <head> 中，rerender 不会移除）——
    this._injectDemoStyles();
  }

  componentWillUnmount() {
    // 清理：移除所有注入的 <style> 元素
    if (Array.isArray(this._injectedStyles)) {
      this._injectedStyles.forEach((el) => el?.remove());
      this._injectedStyles = [];
    }
    // 还原 color-scheme（避免影响其他页面）
    try { document.documentElement.style.colorScheme = ''; } catch { /* noop */ }
  }

  _addLog(type, content) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // —— 注入一个 <style>，跟踪到 this._injectedStyles ——
  _injectStyle(id, textContent) {
    // 若已存在同 id 的 style（rerender 后再次注入），先移除旧引用
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = textContent;
    document.head.appendChild(style);
    this._injectedStyles.push(style);
    return style;
  }

  // —— 动态注入所有演示样式：@layer / @scope / :has / color-mix /
  //    相对颜色 / light-dark / CSS Nesting / text-wrap / @starting-style / 三角函数 ——
  _injectDemoStyles() {
    this._injectStyle('modern-css-demo-style', `
      /* ===== Card 1: @layer Cascade Layers ===== */
      /* 正常顺序：base < theme —— theme 后声明，优先级更高，覆盖 base */
      .layer-demo-box {
        padding: var(--spacing-sm) var(--spacing-md);
        border-radius: var(--radius-base);
        border: 1px solid var(--color-border);
        margin-top: var(--spacing-xs);
        font-size: var(--font-size-sm);
        transition: all 0.2s;
      }
      @layer layer-base, layer-theme;
      @layer layer-base {
        .layer-target {
          background: var(--color-warning-bg);
          color: var(--color-warning);
          border-color: var(--color-warning);
        }
      }
      @layer layer-theme {
        .layer-target {
          background: var(--color-primary-bg);
          color: var(--color-primary);
          border-color: var(--color-primary);
        }
      }
      /* 反转顺序与 !important 演示由 _applyLayerOrder / _toggleLayerImportant 动态注入 */

      /* ===== Card 2: @scope 与 :has() ===== */
      .has-demo {
        padding: var(--spacing-md);
        border: 2px solid var(--color-border);
        border-radius: var(--radius-base);
        background: var(--color-bg-container);
        transition: all 0.25s;
      }
      .has-demo:has(.has-child.active) {
        background: var(--color-primary-bg);
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px var(--color-primary-bg-hover);
      }
      .has-child {
        display: inline-block;
        padding: var(--spacing-xs) var(--spacing-md);
        margin: var(--spacing-xs) var(--spacing-xs) 0 0;
        border-radius: var(--radius-base);
        background: var(--color-bg-spotlight);
        font-size: var(--font-size-sm);
        transition: all 0.2s;
      }
      .has-child.active {
        background: var(--color-primary);
        color: #fff;
      }
      .scope-host {
        padding: var(--spacing-md);
        border: 1px dashed var(--color-border);
        border-radius: var(--radius-base);
        margin-top: var(--spacing-sm);
      }
      .scope-host p { margin: var(--spacing-xs) 0; }
      /* @scope：仅影响 .scope-host 内、.scope-limit 之外的 <p> */
      @scope (.scope-host) to (.scope-limit) {
        p { color: var(--color-primary); font-weight: 600; }
      }
      .scope-limit {
        margin-top: var(--spacing-sm);
        padding: var(--spacing-sm);
        border-top: 1px dashed var(--color-border-secondary);
      }
      .scope-limit p { color: var(--color-text-secondary); font-weight: normal; }

      /* ===== Card 3: color-mix / 相对颜色 / light-dark ===== */
      .mix-row {
        display: flex;
        gap: var(--spacing-xs);
        margin-top: var(--spacing-sm);
        align-items: flex-end;
      }
      .mix-swatch {
        flex: 1;
        height: 60px;
        border-radius: var(--radius-base);
        border: 1px solid var(--color-border);
        position: relative;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        font-size: var(--font-size-xs);
        color: #fff;
        padding-bottom: 2px;
        text-shadow: 0 1px 2px rgba(0,0,0,.6);
      }
      .mix-swatch--r1 { background: color-mix(in srgb, #ff4d4f, #1677ff 20%); }
      .mix-swatch--r2 { background: color-mix(in srgb, #ff4d4f, #1677ff 40%); }
      .mix-swatch--r3 { background: color-mix(in srgb, #ff4d4f, #1677ff 50%); }
      .mix-swatch--r4 { background: color-mix(in srgb, #ff4d4f, #1677ff 60%); }
      .mix-swatch--r5 { background: color-mix(in srgb, #ff4d4f, #1677ff 80%); }
      .rel-box {
        width: 70px; height: 70px;
        border-radius: var(--radius-base);
        display: flex; align-items: center; justify-content: center;
        color: #fff; font-size: var(--font-size-xs); text-align: center;
        margin: 0 var(--spacing-xs);
      }
      .rel-base { background: #1677ff; }
      .rel-lighter { background: rgb(from #1677ff calc(r + 60) g b); }
      .rel-darker { background: rgb(from #1677ff calc(r - 60) calc(g - 30) b); }
      .rel-alpha { background: rgb(from #1677ff r g b / 0.4); border: 2px dashed var(--color-primary); }
      .light-dark-demo {
        padding: var(--spacing-md);
        border-radius: var(--radius-base);
        border: 1px solid light-dark(var(--color-border), #444);
        background: light-dark(#ffffff, #1f1f1f);
        color: light-dark(rgba(0,0,0,.88), rgba(255,255,255,.85));
        transition: all 0.3s;
        margin-top: var(--spacing-sm);
      }

      /* ===== Card 4: CSS Nesting ===== */
      .nest-card {
        padding: var(--spacing-md);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-base);
        background: var(--color-bg-container);
        transition: all 0.25s;
        & .nest-title { font-weight: bold; color: var(--color-text); margin: 0 0 var(--spacing-xs) 0; }
        & .nest-desc { color: var(--color-text-secondary); font-size: var(--font-size-sm); margin: 0; }
        &.active {
          border-color: var(--color-primary);
          background: var(--color-primary-bg);
          & .nest-title { color: var(--color-primary); }
          & .nest-desc { color: var(--color-primary); }
        }
        @media (max-width: 600px) {
          padding: var(--spacing-sm);
          & .nest-title { font-size: var(--font-size-sm); }
        }
      }

      /* ===== Card 5: text-wrap / @starting-style / field-sizing ===== */
      .tw-balance {
        text-wrap: balance;
        max-width: 320px;
        padding: var(--spacing-sm);
        border-left: 3px solid var(--color-primary);
        background: var(--color-primary-bg);
        border-radius: var(--radius-sm);
        margin-top: var(--spacing-sm);
      }
      .tw-pretty {
        text-wrap: pretty;
        max-width: 320px;
        padding: var(--spacing-sm);
        border-left: 3px solid var(--color-success);
        background: var(--color-success-bg);
        border-radius: var(--radius-sm);
        margin-top: var(--spacing-sm);
      }
      .tw-normal {
        text-wrap: wrap;
        max-width: 320px;
        padding: var(--spacing-sm);
        border-left: 3px solid var(--color-border);
        background: var(--color-bg-spotlight);
        border-radius: var(--radius-sm);
        margin-top: var(--spacing-sm);
      }
      /* @starting-style：元素首次出现时从透明/缩小过渡到正常 */
      .ss-target {
        width: 100%;
        padding: var(--spacing-md);
        border-radius: var(--radius-base);
        background: var(--color-primary-bg);
        color: var(--color-primary);
        border: 1px solid var(--color-primary);
        margin-top: var(--spacing-sm);
        opacity: 1;
        transform: scale(1);
        transition: opacity 0.5s, transform 0.5s, display 0.5s allow-discrete;
      }
      @starting-style {
        .ss-target { opacity: 0; transform: scale(0.8); }
      }
      /* field-sizing：textarea 跟随内容自动增高 */
      .fs-textarea {
        width: 100%;
        padding: var(--spacing-sm);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-base);
        font-size: var(--font-size-sm);
        field-sizing: content;
        min-height: 40px;
      }
      /* 三角函数圆形排列容器 */
      .trig-stage {
        position: relative;
        width: 240px;
        height: 240px;
        margin: var(--spacing-sm) auto;
        border: 1px dashed var(--color-border);
        border-radius: 50%;
        background: radial-gradient(circle, var(--color-bg-spotlight) 0%, transparent 70%);
      }
      .trig-dot {
        position: absolute;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: var(--color-primary);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--font-size-sm);
        font-weight: bold;
        box-shadow: var(--shadow-base);
        transition: background 0.2s;
      }
    `);
  }

  // ============================================================
  // Card 1: @layer Cascade Layers
  // ============================================================

  _toggleLayerOrder() {
    const next = this.state.layerOrder === 'normal' ? 'reversed' : 'normal';
    this.setState({ layerOrder: next });
    // 通过修改 .layer-target 父容器的 class 切换 layer 声明顺序的覆盖效果。
    // 由于 @layer 顺序在样式表初始化时已确定，这里用「重新注入 style」模拟切换。
    this._applyLayerOrder(next);
    this._addLog('info', `@layer 顺序切换 → ${next === 'normal' ? 'base, theme（theme 优先）' : 'theme, base（base 优先）'}`);
  }

  // 重新注入 layer 部分 CSS 来切换声明顺序
  _applyLayerOrder(order) {
    const styleId = 'modern-css-layer-order';
    const css = order === 'reversed'
      ? `@layer layer-theme, layer-base;
         @layer layer-base { .layer-target { background: var(--color-warning-bg) !important; color: var(--color-warning) !important; border-color: var(--color-warning) !important; } }
         @layer layer-theme { .layer-target { background: var(--color-primary-bg); color: var(--color-primary); border-color: var(--color-primary); } }`
      : `@layer layer-base, layer-theme;
         @layer layer-base { .layer-target { background: var(--color-warning-bg); color: var(--color-warning); border-color: var(--color-warning); } }
         @layer layer-theme { .layer-target { background: var(--color-primary-bg); color: var(--color-primary); border-color: var(--color-primary); } }`;
    this._injectStyle(styleId, css);
  }

  _toggleLayerImportant() {
    const next = !this.state.layerImportantOn;
    this.setState({ layerImportantOn: next });
    // !important 在 layer 中反转：先声明的层 !important 优先级更高
    const styleId = 'modern-css-layer-important';
    if (next) {
      // layer-base 先声明，其 !important 优先级更高，覆盖 layer-theme
      const css = `@layer layer-base, layer-theme;
        @layer layer-base { .layer-target { background: var(--color-warning) !important; color: #fff !important; } }
        @layer layer-theme { .layer-target { background: var(--color-primary) !important; color: #fff !important; } }`;
      this._injectStyle(styleId, css);
      this._addLog('info', '注入 !important → base 层先声明，其 !important 优先级反转更高（变橙色）');
    } else {
      this._injectStyle(styleId, '');
      this._addLog('info', '移除 !important 注入');
    }
  }

  _renderLayerCard() {
    const s = this.state;
    return h(Card, {
      title: '1. @layer Cascade Layers（级联层）',
      extra: h(Tag, { color: s.layerSupported ? 'success' : 'error' },
        s.layerSupported ? '已支持' : '未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        '@layer 用于显式分组 CSS 规则并控制级联优先级。声明顺序决定优先级：后声明的层优先级更高。!important 在 layer 中反转：先声明的层 !important 优先级更高。可用 @import url() layer(name); 把外部样式表归入指定层。'),
      !s.layerSupported && h(Alert, {
        type: 'warning',
        message: '当前浏览器不支持 @layer',
        description: 'CSS.supports("@layer base") 返回 false。Chrome 99+ / Firefox 97+ / Safari 15.4+ 支持。jsdom 不支持，但页面不会报错。',
      }),
      h('div', { class: 'flex gap-sm mt-sm flex-wrap' },
        this._btn(`切换层顺序（当前：${s.layerOrder === 'normal' ? 'base → theme' : 'theme → base'}）`, {
          type: 'primary', size: 'sm', onClick: () => this._toggleLayerOrder(),
        }),
        this._btn(`${s.layerImportantOn ? '移除' : '注入'} !important 反转`, {
          size: 'sm', danger: s.layerImportantOn,
          onClick: () => this._toggleLayerImportant(),
        }),
      ),
      h('div', { class: 'layer-demo-box layer-target' },
        `目标元素 .layer-target —— 当前层顺序：${s.layerOrder === 'normal' ? 'base, theme（theme 覆盖 base → 蓝色）' : 'theme, base（base 覆盖 theme → 橙色）'}${s.layerImportantOn ? '；!important 已注入（先声明的 base 层 !important 优先级更高 → 橙色）' : ''}`),
      h('p', { class: 'fs-sm text-tertiary mt-sm' },
        '正常规则：后声明的层优先级更高（theme 后声明 → 覆盖 base）。点击「注入 !important」后规则反转：先声明的 base 层的 !important 反而优先级最高，强制变橙色。'),
      h('pre', { class: 'code-block mt-sm' }, `@layer base, theme;          /* 声明顺序：base < theme */
@layer base  { .box { background: orange; } }
@layer theme { .box { background: blue; } }  /* theme 后声明 → 覆盖 base */

/* !important 反转：先声明的层 !important 优先级更高 */
@layer base  { .box { background: orange !important; } } /* ← 胜出 */
@layer theme { .box { background: blue   !important; } }

/* 把外部样式表归入层 */
@import url("reset.css") layer(reset);`),
    );
  }

  // ============================================================
  // Card 2: @scope 与 :has() 选择器
  // ============================================================

  _toggleHasChild() {
    const next = !this.state.hasActiveChild;
    this.setState({ hasActiveChild: next });
    this._addLog('info', `:has() 演示 → 子元素 ${next ? '添加' : '移除'} .active 类，父容器样式${next ? '变化（变蓝、加阴影）' : '恢复'}`);
  }

  _renderScopeHasCard() {
    const s = this.state;
    return h(Card, {
      title: '2. @scope 与 :has() 选择器',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: s.scopeSupported ? 'success' : 'error' }, s.scopeSupported ? '@scope 已支持' : '@scope 未支持'),
        h(Tag, { color: s.hasSupported ? 'success' : 'error' }, s.hasSupported ? ':has 已支持' : ':has 未支持'),
      ),
    },
      h('p', { class: 'fs-sm text-secondary' },
        ':has() 是 CSS 首个真正的「父选择器」，根据子元素状态选择父元素；@scope (.host) to (.limit) { ... } 限定规则仅作用于 host 内、limit 之外的元素，避免全局污染。:scope 关键字引用当前作用域根。'),
      (!s.scopeSupported || !s.hasSupported) && h(Alert, {
        type: 'warning',
        message: '部分特性当前浏览器不支持',
        description: `@scope: ${s.scopeSupported ? '已支持' : '未支持（Chrome 118+ 实验）'}。:has(): ${s.hasSupported ? '已支持' : '未支持（Chrome 105+ / Safari 15.4+ / Firefox 121+）'}。jsdom 中两者均返回 false。`,
      }),

      h('h4', { class: 'fs-md mt-sm', style: { fontWeight: 'bold' } }, ':has() 演示'),
      h('div', { class: 'flex gap-sm mt-sm' },
        this._btn(`子元素 ${s.hasActiveChild ? '取消 .active' : '加 .active'}`, {
          type: 'primary', size: 'sm', onClick: () => this._toggleHasChild(),
        }),
      ),
      h('div', { class: 'has-demo mt-sm' },
        h('div', { class: 'fs-sm text-secondary' }, '父容器 .has-demo —— 当子元素含 .active 时通过 :has(.has-child.active) 变蓝并加阴影'),
        h('span', {
          class: `has-child${s.hasActiveChild ? ' active' : ''}`,
        }, `子元素 A${s.hasActiveChild ? '（active）' : ''}`),
        h('span', { class: 'has-child' }, '子元素 B（恒非 active）'),
      ),

      h('h4', { class: 'fs-md mt-sm', style: { fontWeight: 'bold' } }, '@scope 演示'),
      h('div', { class: 'scope-host' },
        h('p', {}, '@scope (.scope-host) to (.scope-limit) 内的 <p> —— 被作用域规则染成蓝色加粗'),
        h('p', {}, '这是另一段受作用域影响的 <p>，同样变蓝'),
        h('div', { class: 'scope-limit' },
          h('p', {}, '.scope-limit 之内的 <p> —— 不受 @scope 影响，保持默认样式'),
        ),
      ),
      h('pre', { class: 'code-block mt-sm' }, `/* :has() 父选择器 */
form:has(input:invalid) { border-color: red; }
.card:has(.badge) { border-left: 4px solid gold; }

/* @scope 限定作用域 */
@scope (.scope-host) to (.scope-limit) {
  p { color: blue; font-weight: 600; }
  :scope > h4 { border-bottom: 1px solid; }
}

/* @scope 也可写在样式表外，独立使用 */
@scope (.article) {
  img { max-width: 100%; }
}`),
    );
  }

  // ============================================================
  // Card 3: color-mix() / 相对颜色 / light-dark()
  // ============================================================

  _toggleColorScheme() {
    const next = this.state.colorScheme === 'light' ? 'dark' : 'light';
    this.setState({ colorScheme: next });
    // 通过设置 :root 的 color-scheme 切换 light-dark() 取值
    try { document.documentElement.style.colorScheme = next; } catch { /* noop */ }
    this._addLog('info', `color-scheme 切换 → ${next}（document.documentElement.style.colorScheme = '${next}'），light-dark() 自动取${next === 'dark' ? '第二参数' : '第一参数'}`);
  }

  _renderColorCard() {
    const s = this.state;
    return h(Card, {
      title: '3. color-mix() / 相对颜色 / light-dark()',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: s.colorMixSupported ? 'success' : 'error' }, s.colorMixSupported ? 'color-mix' : 'color-mix ✕'),
        h(Tag, { color: s.relativeColorSupported ? 'success' : 'error' }, s.relativeColorSupported ? '相对颜色' : '相对颜色 ✕'),
        h(Tag, { color: s.lightDarkSupported ? 'success' : 'error' }, s.lightDarkSupported ? 'light-dark' : 'light-dark ✕'),
      ),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'color-mix(in srgb|oklch, c1, c2 N%) 按比例混合两色；相对颜色 rgb(from c r g b) 从现有颜色派生（可对 r/g/b 做 calc）；light-dark(light, dark) 根据 color-scheme 自动取值，配合 prefers-color-scheme 媒体查询实现主题切换。'),
      (!s.colorMixSupported || !s.relativeColorSupported || !s.lightDarkSupported) && h(Alert, {
        type: 'warning',
        message: '部分特性当前浏览器不支持',
        description: `color-mix: ${s.colorMixSupported ? '已支持' : '未支持（Chrome 111+）'}。相对颜色: ${s.relativeColorSupported ? '已支持' : '未支持（Chrome 119+）'}。light-dark(): ${s.lightDarkSupported ? '已支持' : '未支持（Chrome 123+）'}。jsdom 中均返回 false。`,
      }),

      h('h4', { class: 'fs-md mt-sm', style: { fontWeight: 'bold' } }, 'color-mix() —— 红 + 蓝（5 个比例）'),
      h('div', { class: 'mix-row' },
        h('div', { class: 'mix-swatch mix-swatch--r1' }, '20%'),
        h('div', { class: 'mix-swatch mix-swatch--r2' }, '40%'),
        h('div', { class: 'mix-swatch mix-swatch--r3' }, '50%'),
        h('div', { class: 'mix-swatch mix-swatch--r4' }, '60%'),
        h('div', { class: 'mix-swatch mix-swatch--r5' }, '80%'),
      ),
      h('p', { class: 'fs-sm text-tertiary mt-sm' },
        'color-mix(in srgb, #ff4d4f, #1677ff N%) —— N 为蓝色占比。in oklch 模式更符合人眼感知（混合更平滑）。'),

      h('h4', { class: 'fs-md mt-sm', style: { fontWeight: 'bold' } }, '相对颜色 —— from #1677ff 派生'),
      h('div', { class: 'flex mt-sm', style: { flexWrap: 'wrap' } },
        h('div', { class: 'rel-box rel-base' }, '基色'),
        h('div', { class: 'rel-box rel-lighter' }, 'lighter\nr+60'),
        h('div', { class: 'rel-box rel-darker' }, 'darker\nr-60 g-30'),
        h('div', { class: 'rel-box rel-alpha' }, 'alpha\n/0.4'),
      ),
      h('p', { class: 'fs-sm text-tertiary mt-sm' },
        'rgb(from #1677ff calc(r + 60) g b) —— 派生亮色；rgb(from #1677ff r g b / 0.4) —— 派生半透明色。也可用 hsl() / oklch() 派生。'),

      h('h4', { class: 'fs-md mt-sm', style: { fontWeight: 'bold' } }, 'light-dark() —— 配合 color-scheme'),
      h('div', { class: 'flex gap-sm mt-sm' },
        this._btn(`切换 color-scheme（当前：${s.colorScheme}）`, {
          type: 'primary', size: 'sm', onClick: () => this._toggleColorScheme(),
        }),
      ),
      h('div', { class: 'light-dark-demo' },
        `当前 color-scheme = ${s.colorScheme}。light-dark(#fff, #1f1f1f) 取${s.colorScheme === 'dark' ? '第二参数（深色）' : '第一参数（浅色）'}。背景 / 边框 / 文字色均由 light-dark() 计算。`),
      h('p', { class: 'fs-sm text-tertiary mt-sm' },
        'prefers-color-scheme 媒体查询会自动设置 color-scheme；也可手动设置 :root { color-scheme: light | dark | light dark }。'),
      h('pre', { class: 'code-block mt-sm' }, `/* color-mix */
background: color-mix(in srgb, red, blue 50%);
background: color-mix(in oklch, #ff4d4f, #1677ff 60%);

/* 相对颜色：from <color> 派生 */
background: rgb(from #1677ff calc(r + 60) g b);      /* 提亮 */
background: oklch(from var(--base) calc(l + 0.1) c h);

/* light-dark + color-scheme */
:root { color-scheme: light dark; }
.card {
  background: light-dark(#ffffff, #1f1f1f);
  color: light-dark(rgba(0,0,0,.88), rgba(255,255,255,.85));
}
@media (prefers-color-scheme: dark) {
  :root { color-scheme: dark; }
}`),
    );
  }

  // ============================================================
  // Card 4: CSS Nesting
  // ============================================================

  _toggleNestActive() {
    const next = !this.state.nestActive;
    this.setState({ nestActive: next });
    this._addLog('info', `CSS Nesting 演示 → .nest-card ${next ? '添加' : '移除'} .active 类，嵌套的 & .nest-title 与 &.active 规则${next ? '生效（变蓝）' : '恢复'}`);
  }

  _renderNestingCard() {
    const s = this.state;
    return h(Card, {
      title: '4. CSS Nesting（原生嵌套）',
      extra: h(Tag, { color: s.nestingSupported ? 'success' : 'error' },
        s.nestingSupported ? '已支持' : '未支持'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        '原生 CSS 嵌套用 & 引用父选择器，不再需要 SCSS / Less 等预处理器。可嵌套 @media / @supports 等规则。注意：原生嵌套中 & 必须出现在选择器开头（如 &.active、& .child），与 SCSS 的 & 可任意位置略有差异。'),
      !s.nestingSupported && h(Alert, {
        type: 'warning',
        message: '当前浏览器可能不支持 CSS Nesting',
        description: 'CSS.supports("selector(&.a)") 返回 false。Chrome 112+ / Firefox 117+ / Safari 16.5+ 支持。jsdom 不支持，但页面不报错。',
      }),
      h('div', { class: 'flex gap-sm mt-sm' },
        this._btn(`.nest-card ${s.nestActive ? '取消 .active' : '加 .active'}`, {
          type: 'primary', size: 'sm', onClick: () => this._toggleNestActive(),
        }),
      ),
      h('div', { class: `nest-card mt-sm${s.nestActive ? ' active' : ''}` },
        h('div', { class: 'nest-title' }, '嵌套卡片标题（.nest-title）'),
        h('div', { class: 'nest-desc' },
          `样式由原生嵌套 & .nest-title / &.active 应用。当前 ${s.nestActive ? 'active（蓝边、蓝字）' : '非 active（默认灰）'}。嵌套 @media (max-width:600px) 还会缩小内边距。`),
      ),
      h('p', { class: 'fs-sm text-tertiary mt-sm' },
        '与 SCSS 区别：SCSS 在编译期展开为逗号分隔选择器；原生 CSS 由浏览器解析，& 必须是相对父级的引用，且嵌套层级过深时性能略降。'),
      h('pre', { class: 'code-block mt-sm' }, `.nest-card {
  padding: 16px;
  border: 1px solid #ddd;

  & .nest-title { font-weight: bold; }   /* .nest-card .nest-title */
  & .nest-desc  { color: #666; }

  &.active {                               /* .nest-card.active */
    border-color: blue;
    & .nest-title { color: blue; }         /* 嵌套二层 */
  }

  @media (max-width: 600px) {              /* 嵌套 @media */
    padding: 8px;
  }
}`),
    );
  }

  // ============================================================
  // Card 5: 三角函数 / text-wrap / 其他新特性
  // ============================================================

  // 用 Math.sin / Math.cos 计算圆形排列位置（CSS 三角函数 jsdom 不渲染，
  // 此处用 JS 计算并通过 element.style.left/top 设置，真实浏览器中也可用 calc(sin() * R)）
  _layoutTrigDots() {
    const stage = this.$('#trig-stage');
    if (!stage) return;
    const R = this.state.trigRadius;
    const offset = this.state.trigAngleOffset; // deg
    const N = 5;
    const dots = stage.querySelectorAll('.trig-dot');
    dots.forEach((dot, i) => {
      // 角度（弧度）：均分 360°，从顶部 -90° 起算，再加偏移
      const angle = ((-90 + (360 / N) * i + offset) * Math.PI) / 180;
      // sin/cos 对应 x/y（圆心 120,120，半径 R）
      const x = 120 + R * Math.cos(angle) - 18; // 18 = dot 宽度 / 2
      const y = 120 + R * Math.sin(angle) - 18;
      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
    });
  }

  _rotateTrig() {
    const next = this.state.trigAngleOffset + 72;
    this.setState({ trigAngleOffset: next });
    // setState 后 DOM 重建，需在下一帧重新布局
    requestAnimationFrame(() => {
      this._layoutTrigDots();
      this._addLog('info', `三角函数重排 → 角度偏移 ${next}°（用 Math.sin/cos 计算 x/y，等价于 CSS calc(cos(angle) * R)）`);
    });
  }

  _changeTrigRadius(delta) {
    const next = Math.max(20, Math.min(100, this.state.trigRadius + delta));
    this.setState({ trigRadius: next });
    requestAnimationFrame(() => {
      this._layoutTrigDots();
      this._addLog('info', `三角函数半径 → ${next}px（R = ${next}，cos/sin 计算坐标）`);
    });
  }

  _toggleStartingStyle() {
    const next = !this.state.startingVisible;
    this.setState({ startingVisible: next });
    this._addLog('info', `@starting-style 演示 → ${next ? '显示（首次出现从透明+缩小过渡到正常）' : '隐藏（过渡到透明后 display:none）'}`);
  }

  // componentDidMount 后布局一次三角函数圆点（避免 setState 死循环，仅 _inited 后调用）
  _initTrigLayoutIfReady() {
    if (!this._inited) return;
    requestAnimationFrame(() => this._layoutTrigDots());
  }

  _renderTrigTextWrapCard() {
    const s = this.state;
    return h(Card, {
      title: '5. 三角函数 / text-wrap / 其他新特性',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: s.trigSupported ? 'success' : 'error' }, s.trigSupported ? '三角函数' : '三角函数 ✕'),
        h(Tag, { color: s.textWrapSupported ? 'success' : 'error' }, s.textWrapSupported ? 'text-wrap' : 'text-wrap ✕'),
        h(Tag, { color: s.startingStyleSupported ? 'success' : 'error' }, s.startingStyleSupported ? '@starting-style' : '@starting-style ✕'),
      ),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'CSS 三角函数：sin() / cos() / tan() / asin() / acos() / atan() / atan2()，以及 pow() / sqrt() / hypot() / log() / exp() / abs() / sign()。角度单位 deg / rad / turn / grad 可互转。配合 calc() 可实现纯 CSS 几何布局。'),

      // —— 三角函数演示：圆形排列 5 个点 ——
      h('h4', { class: 'fs-md mt-sm', style: { fontWeight: 'bold' } }, '三角函数 sin/cos —— 圆形排列 5 个点'),
      !s.trigSupported && h(Alert, {
        type: 'warning',
        message: '当前浏览器不支持 CSS 三角函数',
        description: 'CSS.supports("width", "calc(sin(45deg) * 10px)") 返回 false。Chrome 111+ / Firefox 118+ / Safari 15.4+ 支持。下面用 JS 的 Math.sin/cos 计算位置后通过 element.style.left/top 设置，可在 jsdom 中工作；真实浏览器中也可直接用 CSS calc(cos(var(--a)) * R)。',
      }),
      h('div', { class: 'flex gap-sm mt-sm' },
        this._btn('旋转 72°', { type: 'primary', size: 'sm', onClick: () => this._rotateTrig() }),
        this._btn('半径 +10', { size: 'sm', onClick: () => this._changeTrigRadius(10) }),
        this._btn('半径 -10', { size: 'sm', onClick: () => this._changeTrigRadius(-10) }),
      ),
      h('div', {
        id: 'trig-stage',
        class: 'trig-stage',
        // 渲染后下一帧布局一次（_initTrigLayoutIfReady 内部用 rAF，安全）
      },
        ...[0, 1, 2, 3, 4].map((i) => h('div', { class: 'trig-dot' }, `${i + 1}`)),
      ),
      h('p', { class: 'fs-sm text-tertiary mt-sm' },
        `5 个点均匀分布在半径 ${s.trigRadius}px 的圆上，起始角度偏移 ${s.trigAngleOffset}°。计算公式：x = cx + R*cos(θ), y = cy + R*sin(θ)。`),
      h('pre', { class: 'code-block mt-sm' }, `/* 纯 CSS 三角函数圆形排列 */
.dot {
  --angle: calc(${s.trigAngleOffset || -90}deg + (72deg * var(--i)));
  position: absolute;
  left: calc(120px + ${s.trigRadius}px * cos(var(--angle)) - 18px);
  top:  calc(120px + ${s.trigRadius}px * sin(var(--angle)) - 18px);
}

/* 其他数学函数 */
width: calc(hypot(3px, 4px));       /* 5px */
width: calc(pow(2, 10));            /* 1024 */
width: calc(sqrt(144));             /* 12 */
transform: rotate(atan2(1, 1));     /* 45deg */`),

      // —— text-wrap 演示 ——
      h('h4', { class: 'fs-md mt-sm', style: { fontWeight: 'bold' } }, 'text-wrap: balance / pretty'),
      !s.textWrapSupported && h(Alert, {
        type: 'warning',
        message: '当前浏览器不支持 text-wrap',
        description: 'CSS.supports("text-wrap", "balance") 返回 false。Chrome 114+ 支持 balance，Chrome 117+ 支持 pretty。jsdom 不支持。',
      }),
      h('div', { class: 'tw-balance' },
        'text-wrap: balance —— 标题文本自动均衡换行，避免最后一行只剩一个字。本段会尽量让每行长度接近。'),
      h('div', { class: 'tw-pretty' },
        'text-wrap: pretty —— 段落文本智能换行，避免孤行（最后一行单字）和断点不美观。适合正文段落。'),
      h('div', { class: 'tw-normal' },
        'text-wrap: wrap（默认）—— 普通换行，由浏览器按宽度自动断行，可能出现孤行或不平衡的换行。'),
      h('p', { class: 'fs-sm text-tertiary mt-sm' },
        'text-wrap-mode: wrap|nowrap 控制是否换行；text-wrap-style: balance|pretty|stable|nowrap 控制换行算法（二者可分开设置）。'),

      // —— @starting-style 演示 ——
      h('h4', { class: 'fs-md mt-sm', style: { fontWeight: 'bold' } }, '@starting-style + transition-behavior: allow-discrete'),
      !s.startingStyleSupported && h(Alert, {
        type: 'warning',
        message: '当前浏览器不支持 @starting-style',
        description: `@starting-style: ${s.startingStyleSupported ? '已支持' : '未支持（Chrome 117+）'}。transition-behavior: ${s.transitionBehaviorSupported ? '已支持' : '未支持（Chrome 117+）'}。jsdom 不渲染 CSS，动画不可见。`,
      }),
      h('div', { class: 'flex gap-sm mt-sm' },
        this._btn(`${s.startingVisible ? '隐藏' : '显示'} 元素`, {
          type: 'primary', size: 'sm', onClick: () => this._toggleStartingStyle(),
        }),
      ),
      s.startingVisible && h('div', { class: 'ss-target' },
        '@starting-style 让元素首次出现时从透明 + 缩小 0.8 过渡到正常。配合 transition-behavior: allow-discrete 还能过渡 display 属性（隐藏时先过渡再 display:none）。'),
      h('p', { class: 'fs-sm text-tertiary mt-sm' },
        'interpolate-size: allow-keywords 可让 height: auto 也能被过渡（不再需要测量高度）。field-sizing: content 让 textarea/input 跟随内容自动调整大小（下方 textarea 演示）。'),

      // —— field-sizing 演示 ——
      h('h4', { class: 'fs-md mt-sm', style: { fontWeight: 'bold' } }, 'field-sizing: content —— textarea 自适应高度'),
      !s.fieldSizingSupported && h(Alert, {
        type: 'warning',
        message: '当前浏览器不支持 field-sizing',
        description: 'CSS.supports("field-sizing", "content") 返回 false。Chrome 123+ 支持。jsdom 不支持，textarea 不会自动增高。',
      }),
      h('textarea', {
        class: 'fs-textarea',
        placeholder: '在此输入多行文字，textarea 会自动增高（field-sizing: content）…',
        rows: '2',
        oninput: (e) => {
          // 真实浏览器中 field-sizing: content 自动处理；这里兜底也用 JS 调整高度
          if (!s.fieldSizingSupported) {
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }
        },
      }),

      h('h4', { class: 'fs-md mt-sm', style: { fontWeight: 'bold' } }, '能力检测汇总'),
      h('div', { class: 'fs-sm mt-sm', style: { lineHeight: '1.8' } },
        h('div', {}, `三角函数 sin/cos/...: ${s.trigSupported ? '✓ 已支持' : '✗ 未支持'}`),
        h('div', {}, `text-wrap (balance/pretty): ${s.textWrapSupported ? '✓ 已支持' : '✗ 未支持'}`),
        h('div', {}, `@starting-style: ${s.startingStyleSupported ? '✓ 已支持' : '✗ 未支持'}`),
        h('div', {}, `transition-behavior: allow-discrete: ${s.transitionBehaviorSupported ? '✓ 已支持' : '✗ 未支持'}`),
        h('div', {}, `interpolate-size: allow-keywords: ${s.interpolateSizeSupported ? '✓ 已支持' : '✗ 未支持'}`),
        h('div', {}, `field-sizing: content: ${s.fieldSizingSupported ? '✓ 已支持' : '✗ 未支持'}`),
      ),
      h('pre', { class: 'code-block mt-sm' }, `/* @starting-style：元素首次出现时的初始样式 */
.ss-target {
  opacity: 1;
  transition: opacity 0.5s, display 0.5s allow-discrete;
}
@starting-style {
  .ss-target { opacity: 0; }
}

/* interpolate-size：让 auto 也能过渡 */
.collapsible {
  interpolate-size: allow-keywords;
  height: auto;
  transition: height 0.3s;
}
.collapsible.closed { height: 0; }

/* field-sizing：表单跟随内容 */
textarea { field-sizing: content; min-height: 2em; }`),
    );
  }

  // ============================================================
  // 日志面板
  // ============================================================

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

  // ============================================================
  // 页面渲染入口
  // ============================================================

  renderPage() {
    // 渲染后下一帧布局三角函数圆点（_inited 后才执行，安全）
    this._initTrigLayoutIfReady();
    return [
      h('h2', { class: 'section-title' }, '现代 CSS 平台特性实验室'),

      h(Alert, {
        type: 'info',
        message: '现代 CSS 平台特性',
        description: '演示 @layer 级联层、@scope 与 :has() 选择器、color-mix() / 相对颜色 / light-dark()、CSS Nesting 原生嵌套、三角函数 / text-wrap / @starting-style / field-sizing 等新特性。所有特性通过 CSS.supports() 检测，不支持时显示提示但不报错。由于 jsdom 不渲染 CSS，所有视觉演示需在真实浏览器中查看效果。',
      }),

      this._renderLayerCard(),
      this._renderScopeHasCard(),
      this._renderColorCard(),
      this._renderNestingCard(),
      this._renderTrigTextWrapCard(),

      this._renderLogPanel(),
    ];
  }
}
