// =====================================================================
// CSSBoxModelPositioningPage.js —— CSS Box Model & Positioning 完整 实验室
// 演示 CSS 盒模型与定位系统的全套能力，覆盖布局核心知识：
//   1. box-sizing —— content-box（默认）/ border-box / inherit
//      全局重置 * { box-sizing: border-box; } 让尺寸计算直观
//   2. position 定位系统：static / relative / absolute / fixed / sticky
//      inset 简写（top right bottom left）+ z-index 堆叠
//      各 position 的 containing block 计算规则
//   3. position: sticky 深潜：阈值触发 / 父容器 overflow 限制 /
//      多级 sticky（嵌套表头/侧边栏）/ 与 fixed 区别
//   4. margin collapse 外边距合并：相邻块级 / 父子 / 空块 /
//      不合并的情况（浮动/绝对定位/flex/grid/BFC）/ 解决方案
//   5. BFC 块级格式化上下文：触发条件（float/abs/fixed/flow-root/
//      overflow != visible/contain 等）/ 作用（清浮动/阻 margin 合并/
//      阻浮动覆盖）/ display: flow-root vs overflow: hidden
//   6. float 与清除浮动：float 文字环绕 / clearfix hack /
//      现代 display: flow-root 方案 / shape-outside 自定义环绕形状
//   7. z-index 与堆叠上下文：形成条件（position+z-index/fixed/sticky/
//      opacity<1/transform/filter/will-change/isolation 等）/
//      堆叠顺序（背景→负 z-index→block→float→inline→0/auto→正 z-index）/
//      子元素 z-index 受父级堆叠上下文限制的陷阱
//   8. 实战模式与陷阱：居中布局大全 / sticky 页脚 / 侧边栏吸顶 /
//      模态框定位 / 文字环绕图片 / 多栏布局对比 / 常见陷阱清单
// 说明：jsdom 不做真实布局，但 CSS.supports 可探测属性支持；
//       注入演示样式 + 完整代码示例，真实浏览器可查看效果。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class CSSBoxModelPositioningPage extends Page {
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      boxSizingInfo: '',       // Card 1：box-sizing 与盒模型
      positionInfo: '',        // Card 2：position 定位系统全集
      stickyInfo: '',          // Card 3：position: sticky 深潜
      marginCollapseInfo: '',  // Card 4：margin collapse 外边距合并
      bfcInfo: '',             // Card 5：BFC 块级格式化上下文
      floatInfo: '',           // Card 6：float 与清除浮动
      zIndexInfo: '',          // Card 7：z-index 与堆叠上下文
      patternInfo: '',         // Card 8：实战模式与陷阱
      blockAlignContentInfo: '', // Card 9：块级上下文 align-content
    };
  }

  componentDidMount() {
    if (this._inited) return;
    this._inited = true;

    this._dynamicStyles = [];

    const f = this._flags();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `box-sizing ${c(f.boxSizing)}`,
      `position:sticky ${c(f.positionSticky)}`,
      `position:fixed ${c(f.positionFixed)}`,
      `inset ${c(f.inset)}`,
      `display:flow-root ${c(f.flowRoot)}`,
      `float:inline-start ${c(f.floatInlineStart)}`,
      `shape-outside ${c(f.shapeOutside)}`,
      `isolation ${c(f.isolation)}`,
      `contain ${c(f.contain)}`,
      `z-index ${c(f.zIndex)}`,
      `align-content ${c(f.alignContentCenter)}`,
    ];

    const summary = f.css
      ? `CSS Box Model & Positioning 能力检测：${parts.join(' · ')}。jsdom 不做真实布局，但 CSS.supports 可探测属性支持；按钮点击注入演示样式 + 完整代码示例，真实浏览器可查看效果。`
      : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击仅记日志说明，不会抛异常。';

    this.setState({ capsSummary: summary });
    this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.positionSticky) this._addLog('warn', 'position: sticky 不可用（IE 11 不支持，现代浏览器全支持）');
    if (!f.flowRoot) this._addLog('warn', 'display: flow-root 不可用（推荐清浮动方案，Chrome/Firefox/Edge/Safari 13+ 支持）');
    if (!f.shapeOutside) this._addLog('warn', 'shape-outside 不可用（自定义文字环绕形状，现代浏览器支持）');
    if (!f.alignContentCenter) this._addLog('warn', '块级容器 align-content 不可用（仅 Chrome 123+ 实现，Safari/Firefox 未实现）');

    this._injectBaseStyles();
  }

  componentWillUnmount() {
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

  _injectBaseStyles() {
    this._injectStyle('css-box-base', `
      .bm-demo {
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
      }
      .bm-box-sizing-compare {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-top: 10px;
      }
      .bm-box {
        padding: 16px;
        border: 4px solid #3b82f6;
        background: #dbeafe;
        color: #1e3a8a;
        border-radius: 4px;
        font-size: 12px;
        font-family: monospace;
        text-align: center;
      }
      .bm-box-content { width: 200px; box-sizing: content-box; }
      .bm-box-border  { width: 200px; box-sizing: border-box; }
      .bm-position-stage {
        position: relative;
        height: 220px;
        margin-top: 10px;
        padding: 12px;
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        overflow: hidden;
      }
      .bm-position-stage .bm-pos {
        padding: 8px 12px;
        background: #3b82f6;
        color: #fff;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
      }
      .bm-pos-relative { position: relative; top: 10px; left: 10px; background: #10b981; }
      .bm-pos-absolute { position: absolute; top: 8px; right: 8px; background: #ef4444; }
      .bm-pos-fixed    { position: fixed; bottom: 12px; right: 12px; background: #8b5cf6; z-index: 10; }
      .bm-pos-sticky   { position: sticky; top: 0; background: #f59e0b; margin-bottom: 4px; }
      .bm-sticky-scroll {
        height: 200px;
        overflow: auto;
        margin-top: 10px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 12px;
        background: #fef9c3;
      }
      .bm-sticky-header {
        position: sticky;
        top: 0;
        background: #f59e0b;
        color: #fff;
        padding: 8px;
        border-radius: 4px;
        font-weight: 700;
        margin-bottom: 8px;
      }
      .bm-margin-stage {
        padding: 0 16px 16px;
        margin-top: 10px;
        background: #f1f5f9;
        border-radius: 8px;
      }
      .bm-margin-box {
        padding: 12px;
        background: #dbeafe;
        border: 1px dashed #3b82f6;
        margin-top: 16px;
        margin-bottom: 16px;
        font-size: 12px;
        color: #1e3a8a;
      }
      .bm-margin-box.bm-bfc { overflow: hidden; }
      .bm-bfc-float {
        float: left;
        width: 80px;
        height: 80px;
        background: #ef4444;
        color: #fff;
        margin-right: 8px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
      }
      .bm-bfc-text {
        font-size: 12px;
        color: #475569;
        line-height: 1.6;
      }
      .bm-bfc-container.bm-no-bfc { background: #fef3c7; padding: 8px; border-radius: 6px; margin-top: 10px; }
      .bm-bfc-container.bm-flow-root { display: flow-root; background: #dcfce7; padding: 8px; border-radius: 6px; margin-top: 10px; }
      .bm-float-stage {
        margin-top: 10px;
        padding: 12px;
        background: #f1f5f9;
        border-radius: 8px;
      }
      .bm-float-img {
        float: left;
        width: 80px;
        height: 80px;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        border-radius: 8px;
        margin: 0 12px 4px 0;
        shape-outside: circle();
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 11px;
      }
      .bm-clearfix::after {
        content: '';
        display: table;
        clear: both;
      }
      .bm-z-index-stage {
        position: relative;
        margin-top: 10px;
        padding: 16px;
        background: #f1f5f9;
        border-radius: 8px;
        height: 160px;
      }
      .bm-z-layer {
        position: absolute;
        padding: 8px 12px;
        border-radius: 4px;
        color: #fff;
        font-size: 11px;
        font-weight: 600;
      }
      .bm-z-bg     { top: 0; left: 0; right: 0; bottom: 0; background: #cbd5e1; z-index: -1; display: flex; align-items: center; justify-content: center; color: #475569; }
      .bm-z-block  { top: 16px; left: 16px; background: #3b82f6; z-index: 1; }
      .bm-z-float  { top: 40px; left: 40px; background: #10b981; z-index: 2; }
      .bm-z-inline { top: 64px; left: 64px; background: #f59e0b; z-index: 3; }
      .bm-z-top    { top: 88px; left: 88px; background: #ef4444; z-index: 10; }
      .bm-trap-parent {
        position: relative;
        opacity: 0.99;
        margin-top: 10px;
        padding: 12px;
        background: #fef3c7;
        border-radius: 6px;
      }
      .bm-trap-modal {
        position: absolute;
        top: 8px;
        right: 8px;
        background: #ef4444;
        color: #fff;
        padding: 6px 10px;
        border-radius: 4px;
        font-size: 11px;
        z-index: 9999;
      }
      .bm-trap-sibling {
        position: relative;
        margin-top: 10px;
        background: #3b82f6;
        color: #fff;
        padding: 12px;
        border-radius: 6px;
        z-index: 2;
      }
      .bm-output {
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
      .bm-block-align-stage {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-top: 10px;
      }
      .bm-block-align-col {
        height: 230px;
        padding: 8px;
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        overflow: hidden;
      }
      .bm-block-align-col h5 {
        margin: 0 0 6px;
        font-size: 12px;
        color: #475569;
        font-family: monospace;
      }
      .bm-block-align-host {
        height: 180px;
        background: #fff;
        border: 1px dashed #94a3b8;
        border-radius: 6px;
        padding: 6px;
        overflow: hidden;
      }
      .bm-block-align-host.is-center         { align-content: center; }
      .bm-block-align-host.is-space-between  { align-content: space-between; }
      .bm-block-align-host.is-space-evenly   { align-content: space-evenly; }
      .bm-block-align-host.is-stretch        { align-content: stretch; }
      .bm-block-align-item {
        background: #3b82f6;
        color: #fff;
        padding: 6px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-family: monospace;
      }
      .bm-block-align-item.alt { background: #10b981; }
    `);
  }

  _flags() {
    const hasCSS = typeof CSS !== 'undefined';
    const supportsPV = (p, v) => {
      try { return hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v); }
      catch { return false; }
    };
    return {
      css: hasCSS,
      supports: hasCSS && typeof CSS.supports === 'function',
      boxSizing: supportsPV('box-sizing', 'border-box'),
      positionSticky: supportsPV('position', 'sticky'),
      positionFixed: supportsPV('position', 'fixed'),
      inset: supportsPV('inset', '10px'),
      flowRoot: supportsPV('display', 'flow-root'),
      floatInlineStart: supportsPV('float', 'inline-start'),
      shapeOutside: supportsPV('shape-outside', 'circle()'),
      isolation: supportsPV('isolation', 'isolate'),
      contain: supportsPV('contain', 'layout'),
      zIndex: supportsPV('z-index', '1'),
      alignContentCenter: supportsPV('align-content', 'center'),
      alignContentSpaceBetween: supportsPV('align-content', 'space-between'),
      alignContentSpaceEvenly: supportsPV('align-content', 'space-evenly'),
      alignContentStretch: supportsPV('align-content', 'stretch'),
    };
  }

  // ===================== Card 1：box-sizing 与盒模型 =====================

  _runBoxSizingDemo() {
    const f = this._flags();
    this._injectStyle('bm-box-sizing-demo', `
      .bm-box-sizing-host {
        padding: 16px;
        background: linear-gradient(135deg, #fef3c7, #fde68a);
        border-radius: 8px;
        margin-top: 10px;
      }
      .bm-box-sizing-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .bm-sizing-card {
        padding: 12px;
        background: #fff;
        border-radius: 6px;
        border: 1px solid #cbd5e1;
      }
      .bm-sizing-content {
        width: 200px;
        padding: 16px;
        border: 4px solid #3b82f6;
        background: #dbeafe;
        box-sizing: content-box;
        text-align: center;
        color: #1e3a8a;
        font-size: 12px;
      }
      .bm-sizing-border {
        width: 200px;
        padding: 16px;
        border: 4px solid #10b981;
        background: #d1fae5;
        box-sizing: border-box;
        text-align: center;
        color: #064e3b;
        font-size: 12px;
      }
    `);
    const info = [
      '===== CSS Box Model：box-sizing 与盒模型 =====',
      '',
      '【盒模型四层组成】',
      '  ┌───────────────────────────────────────┐',
      '  │              margin                    │',
      '  │   ┌───────────────────────────────┐   │',
      '  │   │           border               │   │',
      '  │   │   ┌───────────────────────┐   │   │',
      '  │   │   │      padding           │   │   │',
      '  │   │   │   ┌───────────────┐   │   │   │',
      '  │   │   │   │    content     │   │   │   │',
      '  │   │   │   │                 │   │   │   │',
      '  │   │   │   └───────────────┘   │   │   │',
      '  │   │   └───────────────────────┘   │   │',
      '  │   └───────────────────────────────┘   │',
      '  └───────────────────────────────────────┘',
      '',
      '  四层：content → padding → border → margin',
      '  注意：margin 在 box-sizing 计算外，仅作外间距',
      '',
      '【box-sizing 取值】',
      '  box-sizing: content-box;   // 默认：W3C 标准盒模型',
      '  box-sizing: border-box;    // IE 盒模型（推荐）',
      '  box-sizing: inherit;       // 继承父元素',
      '',
      '【content-box（默认）】',
      '  width/height 仅含 content 区域',
      '  padding 和 border 额外叠加在 width 之外',
      '  实际占用宽度 = width + padding-left + padding-right',
      '                       + border-left + border-right',
      '  示例：',
      '    width: 200px; padding: 16px; border: 4px solid;',
      '    实际渲染宽度 = 200 + 16*2 + 4*2 = 240px',
      '',
      '【border-box（推荐）】',
      '  width/height 含 content + padding + border',
      '  仅 margin 在外',
      '  实际占用宽度 = width + margin-left + margin-right',
      '  示例：',
      '    width: 200px; padding: 16px; border: 4px solid;',
      '    实际渲染宽度 = 200px（content 自动 = 200 - 32 - 8 = 160px）',
      '',
      '【全局重置推荐】',
      '  /* 1. 全部元素采用 border-box，避免计算烦恼 */',
      '  *, *::before, *::after {',
      '    box-sizing: border-box;',
      '  }',
      '',
      '  /* 2. 让 body 内继承也保持 border-box */',
      '  html { box-sizing: border-box; }',
      '  *, *::before, *::after { box-sizing: inherit; }',
      '',
      '【实际尺寸对比（width: 200px; padding: 16px; border: 4px）】',
      '  ┌─────────────────────────────┐',
      '  │ content-box                  │',
      '  │  ┌────────────────────────┐ │',
      '  │  │ border 4px                │ │',
      '  │  │  ┌───────────────────┐  │ │',
      '  │  │  │ padding 16px        │  │ │',
      '  │  │  │  ┌──────────────┐ │  │ │',
      '  │  │  │  │ content 200px │ │  │ │',
      '  │  │  │  └──────────────┘ │  │ │',
      '  │  │  └───────────────────┘  │ │',
      '  │  └────────────────────────┘ │',
      '  │  总宽 = 4+16+200+16+4 = 240px │',
      '  └─────────────────────────────┘',
      '',
      '  ┌─────────────────────────────┐',
      '  │ border-box                   │',
      '  │  ┌────────────────────────┐ │',
      '  │  │ border 4px                │ │',
      '  │  │  ┌───────────────────┐  │ │',
      '  │  │  │ padding 16px        │  │ │',
      '  │  │  │  ┌──────────────┐ │  │ │',
      '  │  │  │  │ content 160px│ │  │ │',
      '  │  │  │  └──────────────┘ │  │ │',
      '  │  │  └───────────────────┘  │ │',
      '  │  └────────────────────────┘ │',
      '  │  总宽 = 200px（width 直接含 border+padding） │',
      '  └─────────────────────────────┘',
      '',
      '【margin 不计入元素尺寸】',
      '  width: 200px; margin: 16px; box-sizing: border-box;',
      '  // 元素自身宽度 200px（border-box）',
      '  // 但占父级宽度 = 200 + 16*2 = 232px（margin 推开外部空间）',
      '  // margin 透明，不计入 getBoundingClientRect()',
      '',
      '【完整代码示例】',
      '  <style>',
      '    *, *::before, *::after { box-sizing: border-box; }',
      '    .content-box-demo {',
      '      width: 200px;',
      '      padding: 16px;',
      '      border: 4px solid #3b82f6;',
      '      background: #dbeafe;',
      '      box-sizing: content-box;  /* 实际宽 240px */',
      '    }',
      '    .border-box-demo {',
      '      width: 200px;',
      '      padding: 16px;',
      '      border: 4px solid #10b981;',
      '      background: #d1fae5;',
      '      box-sizing: border-box;   /* 实际宽 200px */',
      '    }',
      '  </style>',
      '  <div class="content-box-demo">content-box 实际宽 240px</div>',
      '  <div class="border-box-demo">border-box 实际宽 200px</div>',
      '',
      '【DevTools 调试】',
      '  Chrome DevTools → Elements → Computed → Box Model 可视化',
      '  蓝色 content / 绿色 padding / 黄色 border / 橙色 margin',
      '  可直接修改各值实时预览效果',
      '',
      '【浏览器支持】',
      `  box-sizing: ${f.boxSizing ? '✓' : '✗'} (全部浏览器支持)`,
      '  content-box / border-box 全部支持',
      '  IE 8+ 部分支持（需 -ms- 前缀，IE 8 默认是 content-box）',
      '  现代浏览器默认 content-box，全局重置建议 border-box',
    ].join('\n');
    this.setState({ boxSizingInfo: info });
    this._addLog('css', `box-sizing 演示完成；supports=${f.boxSizing}`);
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. box-sizing —— CSS 盒模型组成与尺寸计算',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['box-sizing', f.boxSizing]]),
        h(Tag, { color: 'primary' }, '盒模型基础'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'CSS 盒模型四层：content → padding → border → margin。content-box（默认）width/height 仅含 content，padding/border 额外加；border-box width/height 含 content+padding+border，仅 margin 在外。全局重置推荐 *, *::before, *::after { box-sizing: border-box; } 让尺寸计算直观。margin 不计入元素尺寸（仅视觉外推），box-sizing 全部浏览器支持。',
        ),
        h('div', { class: 'bm-box-sizing-compare' },
          h('div', { class: 'bm-box bm-box-content' }, 'content-box\nwidth=200 + 16+16 + 4+4 = 240px'),
          h('div', { class: 'bm-box bm-box-border' }, 'border-box\nwidth=200px（含 padding+border）'),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('运行 box-sizing 演示', { type: 'primary', size: 'sm', onClick: () => this._runBoxSizingDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.boxSizingInfo || '（点击按钮查看 box-sizing 与盒模型完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 2：position 定位系统全集 =====================

  _runPositionDemo() {
    const f = this._flags();
    const info = [
      '===== position 定位系统全集：static/relative/absolute/fixed/sticky =====',
      '',
      '【position 五种取值】',
      '  position: static;     // 默认，正常文档流，top/left/z-index 无效',
      '  position: relative;    // 相对自身原位置偏移，不脱离文档流',
      '  position: absolute;    // 脱离文档流，相对最近非 static 祖先定位',
      '  position: fixed;       // 脱离文档流，相对视口定位',
      '  position: sticky;      // 粘性定位，正常流 + 滚动到阈值变 fixed',
      '',
      '【static（默认）】',
      '  元素在正常文档流中按先后顺序排列',
      '  top/right/bottom/left/inset/z-index 都无效',
      '  不脱离文档流，不创建新的层叠上下文',
      '  示例：',
      '    .normal { position: static; top: 100px; }',
      '    // top: 100px 被忽略，元素仍在原位置',
      '',
      '【relative 相对定位】',
      '  相对自身在正常流中的原位置偏移',
      '  不脱离文档流，原位置仍占据空间（其他元素不挤过来）',
      '  可用于微调位置，也可作为 absolute 子元素的定位上下文',
      '  示例：',
      '    .offset {',
      '      position: relative;',
      '      top: 10px;        // 从原位置向下偏移 10px',
      '      left: 20px;       // 从原位置向右偏移 20px',
      '    }',
      '',
      '【absolute 绝对定位】',
      '  脱离文档流，原位置不再占据空间',
      '  相对最近的「非 static 祖先」定位（向上找）',
      '  若无任何非 static 祖先，则相对 initial containing block（视口）',
      '  常用模式：父元素 position: relative + 子元素 position: absolute',
      '  示例：',
      '    .parent { position: relative; }',
      '    .child {',
      '      position: absolute;',
      '      top: 0; right: 0;   // 紧贴父元素右上角',
      '    }',
      '',
      '【fixed 固定定位】',
      '  脱离文档流，相对视口（viewport）定位',
      '  滚动页面时保持固定位置（如顶部导航栏）',
      '  注意：transform / filter / will-change / perspective',
      '       会改变 containing block，使 fixed 相对该祖先而非视口',
      '  示例：',
      '    .navbar {',
      '      position: fixed;',
      '      top: 0; left: 0; right: 0;',
      '      height: 56px;',
      '      background: #1e40af;',
      '      z-index: 100;',
      '    }',
      '',
      '  // 陷阱：祖先有 transform 会让 fixed 失效',
      '  .ancestor { transform: translateZ(0); }',
      '  .fixed-child { position: fixed; }',
      '  // .fixed-child 不再相对视口，而是相对 .ancestor',
      '',
      '【sticky 粘性定位】',
      '  在正常文档流中，直到滚动到 top/left 阈值前表现为 relative',
      '  滚动到阈值后变 fixed（但仅在其父容器范围内）',
      '  父容器滚出视口时，sticky 自动解锁',
      '  必须设置 top/bottom/left/right 至少一个才生效',
      '  示例：',
      '    .header {',
      '      position: sticky;',
      '      top: 0;            // 滚到距顶 0px 时固定',
      '      z-index: 10;',
      '    }',
      '',
      '【inset 简写属性】',
      '  inset: <top> <right> <bottom> <left>;',
      '  类似 margin 简写：',
      '    inset: 0;          // top/right/bottom/left: 0',
      '    inset: 10px 20px;  // top/bottom: 10px; left/right: 20px',
      '    inset: 1px 2px 3px 4px;  // top right bottom left',
      '  等价于：top + right + bottom + left 同时设置',
      '  仅对非 static 的定位元素生效',
      '',
      '【z-index 与堆叠上下文】',
      '  z-index: auto(默认) | <integer>;',
      '  仅 position != static 生效（static 时 z-index 无效）',
      '  数值越大越靠上，相同则后渲染的覆盖先渲染的',
      '  z-index 创建新的堆叠上下文，影响子元素堆叠',
      '  详见 Card 7：z-index 与堆叠上下文',
      '',
      '【各 position 的 containing block 计算规则】',
      '  ┌──────────┬──────────────────────────────────────────────────┐',
      '  │ position │ containing block                                   │',
      '  ├──────────┼──────────────────────────────────────────────────┤',
      '  │ static   │ 最近的块容器祖先（无显式定位）                     │',
      '  │ relative │ 同 static，自身原位置                              │',
      '  │ absolute │ 最近的「非 static」祖先的 padding box              │',
      '  │ fixed    │ 视口（除非祖先有 transform/filter/perspective 等） │',
      '  │ sticky   │ 最近的滚动容器（祖先 overflow != visible）         │',
      '  └──────────┴──────────────────────────────────────────────────┘',
      '',
      '【完整代码示例：五种定位对比】',
      '  <style>',
      '    .stage { position: relative; height: 300px; overflow: hidden; }',
      '    .static    { position: static; }',
      '    .relative  { position: relative; top: 10px; left: 10px; }',
      '    .absolute  { position: absolute; top: 8px; right: 8px; }',
      '    .fixed     { position: fixed; bottom: 12px; right: 12px; }',
      '    .sticky    { position: sticky; top: 0; }',
      '  </style>',
      '  <div class="stage">',
      '    <div class="static">正常文档流</div>',
      '    <div class="relative">相对原位置偏移</div>',
      '    <div class="absolute">脱离流，贴右上角</div>',
      '    <div class="fixed">脱离流，贴视口右下角</div>',
      '    <div class="sticky">滚动到 top:0 时固定</div>',
      '  </div>',
      '',
      '【浏览器支持】',
      `  position: fixed: ${f.positionFixed ? '✓' : '✗'} (全部支持)`,
      `  position: sticky: ${f.positionSticky ? '✓' : '✗'} (IE 11 不支持，现代浏览器全支持)`,
      `  inset 简写: ${f.inset ? '✓' : '✗'} (Chrome 87+/Firefox 66+/Safari 14.1+)`,
    ].join('\n');
    this.setState({ positionInfo: info });
    this._addLog('css', `position 定位系统演示完成；supports=${f.positionSticky}/${f.positionFixed}/${f.inset}`);
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. position 定位系统全集 —— static/relative/absolute/fixed/sticky',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['position:fixed', f.positionFixed],
          ['position:sticky', f.positionSticky],
          ['inset', f.inset],
        ]),
        h(Tag, { color: 'primary' }, '定位系统'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'position 五种取值：static（默认，正常流，top/z-index 无效）/ relative（相对原位置偏移，不脱离流）/ absolute（脱离流，相对最近非 static 祖先）/ fixed（脱离流，相对视口，transform/filter 会改变 containing block）/ sticky（粘性，正常流+滚动阈值变 fixed）。inset 是 top/right/bottom/left 的简写。z-index 仅 position != static 生效。各 position 的 containing block 计算规则不同。',
        ),
        h('div', { class: 'bm-position-stage' },
          h('div', { class: 'bm-pos bm-pos-relative' }, 'relative (top:10 left:10)'),
          h('div', { class: 'bm-pos bm-pos-absolute' }, 'absolute (top:8 right:8)'),
          h('div', { class: 'bm-pos bm-pos-sticky' }, 'sticky (top:0)'),
          h('div', { class: 'bm-pos bm-pos-fixed' }, 'fixed (bottom:12 right:12)'),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('运行 position 演示', { type: 'primary', size: 'sm', onClick: () => this._runPositionDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.positionInfo || '（点击按钮查看 position 定位系统完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 3：position: sticky 深潜 =====================

  _runStickyDemo() {
    const f = this._flags();
    const info = [
      '===== position: sticky 深潜：粘性定位全解析 =====',
      '',
      '【基础：正常流 + 阈值触发】',
      '  position: sticky 在滚动到 top/bottom/left/right 阈值前表现为 relative',
      '  滚动到阈值后变 fixed，但仅在其父容器范围内',
      '  父容器滚出视口时，sticky 自动解锁回到正常流',
      '  示例：',
      '    .header {',
      '      position: sticky;',
      '      top: 0;            // 滚到距顶 0px 时固定',
      '      background: #fff;',
      '      z-index: 10;',
      '    }',
      '',
      '【必须设置 top/bottom/left/right 至少一个】',
      '  position: sticky;  /* 没有 top/bottom/left/right → 无效 */',
      '  position: sticky; top: 0;  /* ✓ 滚到顶部固定 */',
      '',
      '  // 滚动方向与有效属性的关系：',
      '  // 垂直滚动 → top / bottom 生效',
      '  // 水平滚动 → left / right 生效',
      '  // 通常只需设置一个（如 top: 0 表示滚到顶部时固定）',
      '',
      '【父容器 overflow 限制 sticky 范围】',
      '  // 父容器 overflow: hidden/auto/scroll 会限制 sticky 范围',
      '  .parent {',
      '    overflow: auto;     // 滚动容器',
      '    height: 400px;',
      '  }',
      '  .sticky-child {',
      '    position: sticky;',
      '    top: 0;            // 仅在 .parent 内固定',
      '  }',
      '',
      '  // 陷阱：祖先有 overflow: hidden 会让 sticky 失效或缩小范围',
      '  // 因为 sticky 的 containing block 是最近的可滚动祖先',
      '  // 若祖先 overflow: hidden 但无滚动条，sticky 仍可能不工作',
      '  // 解决：用 overflow: clip + overflow-clip-margin 或重构布局',
      '',
      '【sticky 元素在父容器内才有效】',
      '  // 父容器滚动到底（底部触底）→ sticky 解锁',
      '  <div class="parent">  <!-- 高度 400px，内容 800px -->',
      '    <div class="sticky">吸顶</div>',
      '    <div class="content">大量内容...</div>',
      '  </div>',
      '  // 当 .parent 顶部滚出视口时，.sticky 固定到 top: 0',
      '  // 当 .parent 底部接近视口顶时，.sticky 跟随 .parent 滚走',
      '',
      '【与 fixed 区别】',
      '  ┌────────────┬──────────────────────────────┬──────────────────────────────┐',
      '  │ 特性       │ position: fixed               │ position: sticky              │',
      '  ├────────────┼──────────────────────────────┼──────────────────────────────┤',
      '  │ 文档流     │ 脱离，原位置不占空间          │ 保留，原位置仍占空间          │',
      '  │ containing │ 视口（除非祖先有 transform）  │ 最近滚动容器                  │',
      '  │ 触发条件   │ 始终固定                      │ 滚动到阈值才固定              │',
      '  │ 范围       │ 全局固定（直到元素被移除）     │ 仅在父容器内                  │',
      '  │ 兼容性     │ 全部支持                      │ IE 11 不支持                  │',
      '  └────────────┴──────────────────────────────┴──────────────────────────────┘',
      '',
      '【多级 sticky（嵌套表头/侧边栏）】',
      '  // 表格多级表头：第一级 top:0，第二级 top:40px',
      '  thead .row1 { position: sticky; top: 0; }',
      '  thead .row2 { position: sticky; top: 40px; }',
      '',
      '  // 滚动时 row1 先固定到顶部，row2 固定到 40px 处',
      '  // 形成两层粘性表头',
      '',
      '  // 侧边栏多级吸顶：',
      '  .sidebar-section { position: sticky; top: 56px; }',
      '  .sidebar-subsection { position: sticky; top: 100px; }',
      '',
      '【实战：粘性表头】',
      '  <style>',
      '    .table-wrapper {',
      '      height: 300px;',
      '      overflow: auto;',
      '      border: 1px solid #cbd5e1;',
      '    }',
      '    table { width: 100%; border-collapse: collapse; }',
      '    thead th {',
      '      position: sticky;',
      '      top: 0;',
      '      background: #1e40af;',
      '      color: #fff;',
      '      padding: 8px;',
      '      z-index: 2;',
      '    }',
      '    tbody td { padding: 8px; border-bottom: 1px solid #e2e8f0; }',
      '  </style>',
      '  <div class="table-wrapper">',
      '    <table>',
      '      <thead><tr><th>姓名</th><th>年龄</th></tr></thead>',
      '      <tbody>',
      '        <tr><td>张三</td><td>20</td></tr>',
      '        <!-- ... 更多行 ... -->',
      '      </tbody>',
      '    </table>',
      '  </div>',
      '',
      '【实战：侧边栏吸顶】',
      '  .sidebar {',
      '    position: sticky;',
      '    top: 80px;          // 距顶部 80px（避开导航栏）',
      '    align-self: start;  // flex 容器内保持顶部对齐',
      '    max-height: calc(100vh - 80px);',
      '    overflow: auto;',
      '  }',
      '',
      '【实战：滚动进度条】',
      '  // 用 sticky 实现顶部进度条（结合 height 比例）',
      '  .progress-bar {',
      '    position: sticky;',
      '    top: 0;',
      '    height: 4px;',
      '    background: linear-gradient(to right, #3b82f6 var(--progress), transparent 0);',
      '    z-index: 100;',
      '  }',
      '  // 通过 JS 设置 --progress 变量（0% ~ 100%）',
      '',
      '【常见陷阱清单】',
      '  1. 父容器 overflow: hidden → sticky 失效（无滚动空间）',
      '  2. 父容器高度等于子元素 → sticky 无空间触发',
      '  3. 未设置 top/bottom/left/right → sticky 无效',
      '  4. 同级元素覆盖 → z-index 设置不当',
      '  5. flex 容器内 align-items: stretch → 子元素被拉伸',
      '     解决：align-items: flex-start 或 align-self: start',
      '  6. position: sticky 必须在「滚动容器」直接子元素上',
      '     （若嵌套层级过深可能行为异常）',
      '',
      '【浏览器支持】',
      `  position: sticky: ${f.positionSticky ? '✓' : '✗'} (IE 11 不支持，现代浏览器全支持)`,
      '  - Chrome 56+ / Firefox 32+ / Safari 13+ / Edge 16+ 完整支持',
      '  - iOS Safari 13+ 支持完整 sticky',
      '  - IE 11 完全不支持，需 polyfill（stickyfill 等库）',
      '  - 现代项目中 IE 11 已淘汰，可放心使用',
    ].join('\n');
    this.setState({ stickyInfo: info });
    this._addLog('css', `position: sticky 深潜演示完成；supports=${f.positionSticky}`);
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. position: sticky 深潜 —— 粘性定位与父容器限制',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['position:sticky', f.positionSticky]]),
        h(Tag, { color: 'primary' }, '粘性定位'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'position: sticky 在正常文档流中，直到滚动到 top/bottom/left/right 阈值前表现为 relative，到达阈值后变 fixed（但仅在其父容器范围内）。必须设置 top/bottom/left/right 至少一个才生效。父容器 overflow: hidden/auto/scroll 会限制 sticky 范围；父容器滚到底部时 sticky 解锁。与 fixed 区别：fixed 脱离文档流，sticky 保留原位置。支持多级 sticky（嵌套表头/侧边栏）。IE 11 不支持。',
        ),
        h('div', { class: 'bm-sticky-scroll' },
          h('div', { class: 'bm-sticky-header' }, '粘性表头 (top:0)'),
          h('div', { class: 'fs-sm' }, '滚动此容器查看表头吸顶效果（jsdom 不渲染真实滚动，浏览器可见）'),
          h('div', { class: 'fs-sm', style: { marginTop: '8px' } }, '内容行 1'),
          h('div', { class: 'fs-sm' }, '内容行 2'),
          h('div', { class: 'fs-sm' }, '内容行 3'),
          h('div', { class: 'fs-sm' }, '内容行 4'),
          h('div', { class: 'fs-sm' }, '内容行 5'),
          h('div', { class: 'fs-sm' }, '内容行 6'),
          h('div', { class: 'fs-sm' }, '内容行 7'),
          h('div', { class: 'fs-sm' }, '内容行 8'),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('运行 sticky 深潜演示', { type: 'primary', size: 'sm', onClick: () => this._runStickyDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.stickyInfo || '（点击按钮查看 position: sticky 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 4：margin collapse 外边距合并 =====================

  _runMarginCollapseDemo() {
    const f = this._flags();
    const info = [
      '===== margin collapse 外边距合并 =====',
      '',
      '【核心规则】',
      '  块级元素的垂直方向上 margin 会合并（取较大者）',
      '  仅垂直方向合并，水平方向不合并（writing-mode 影响方向）',
      '',
      '【场景 1：相邻块级元素垂直 margin 合并】',
      '  .a { margin-bottom: 20px; }',
      '  .b { margin-top: 30px; }',
      '  // a 和 b 之间的间距 = max(20, 30) = 30px（不是 50px）',
      '',
      '  <div class="a">上</div>',
      '  <div class="b">下</div>',
      '',
      '【场景 2：父元素与第一个/最后一个子元素 margin 合并】',
      '  // 父元素无 padding/border 时，第一个子元素的 margin-top 会穿透父元素',
      '  .parent { /* 无 padding/border */ }',
      '  .child { margin-top: 30px; }',
      '  // .child 的 margin-top 会「穿透」.parent，作用到 .parent 外部',
      '  // 视觉上看 .parent 顶部空了 30px，而非 .child 距 .parent 顶 30px',
      '',
      '  // 最后一个子元素同理：margin-bottom 会穿透父元素',
      '',
      '【场景 3：空块的上下 margin 合并】',
      '  // 高度为 0 的空块，上下 margin 会合并',
      '  .empty {',
      '    margin-top: 20px;',
      '    margin-bottom: 30px;',
      '    /* 无内容、无 padding/border、无高度 */',
      '  }',
      '  // 视觉上 .empty 占据 30px（合并后取较大者）',
      '',
      '【不合并的情况（重要）】',
      '  1. 浮动元素（float != none）',
      '     浮动元素的 margin 不与相邻元素合并',
      '',
      '  2. 绝对定位（position: absolute）',
      '     脱离文档流，margin 不与流内元素合并',
      '',
      '  3. flex / grid 项目的 margin 不合并',
      '     flex 容器内子项之间，margin 完全保留（不合并）',
      '     .flex-parent { display: flex; }',
      '     .flex-item-1 { margin-bottom: 20px; }',
      '     .flex-item-2 { margin-top: 30px; }',
      '     // 间距 = 20 + 30 = 50px（不合并）',
      '',
      '  4. inline-block 的 margin 不合并',
      '     inline-block 元素的垂直 margin 不与相邻块级合并',
      '',
      '  5. 父元素有 padding/border/inline-content 阻断',
      '     .parent { padding-top: 1px; }   // 阻断父子 margin 合并',
      '     .parent { border-top: 1px solid; }  // 同样阻断',
      '     .parent::before { content: ""; display: table; }  // 旧 clearfix 阻断',
      '',
      '  6. 父元素触发 BFC（overflow: hidden 等）',
      '     .parent { overflow: hidden; }  // BFC 阻断父子 margin 合并',
      '     .parent { display: flow-root; }  // 推荐，专为 BFC',
      '',
      '  7. 根元素（html）的 margin 不合并',
      '',
      '【解决方案汇总】',
      '  1. 用 padding 代替 margin',
      '     .section { padding-top: 30px; }  // 不会合并',
      '',
      '  2. 触发 BFC（父元素）',
      '     .parent { overflow: hidden; }   // 简单但会创建滚动容器',
      '     .parent { display: flow-root; }  // 推荐，专为 BFC',
      '',
      '  3. 用 flex 布局',
      '     .container { display: flex; flex-direction: column; gap: 30px; }',
      '     // flex 子项 margin 不合并，或直接用 gap',
      '',
      '  4. 用 grid 布局',
      '     .container { display: grid; gap: 30px; }',
      '     // 同样不合并，gap 更简洁',
      '',
      '【水平方向不合并】',
      '  .left { margin-right: 20px; }',
      '  .right { margin-left: 30px; }',
      '  // 水平方向间距 = 20 + 30 = 50px（不合并）',
      '  // 仅垂直方向（块向）合并，水平方向（行向）不合并',
      '',
      '【writing-mode 影响方向】',
      '  // 默认 writing-mode: horizontal-tb（水平从上到下）',
      '  // 垂直方向 = 块向（block direction）= top/bottom',
      '  // 水平方向 = 行向（inline direction）= left/right',
      '',
      '  // writing-mode: vertical-rl 时',
      '  // 块向 = 水平方向（right → left）',
      '  // 行向 = 垂直方向',
      '  // 此时 margin 合并发生在 left/right 而非 top/bottom',
      '',
      '【完整代码示例：BFC 阻断父子 margin 合并】',
      '  <style>',
      '    /* 不阻断（合并） */',
      '    .parent-no-bfc {',
      '      background: #fef3c7;',
      '      /* 无 padding/border/overflow */',
      '    }',
      '    .parent-no-bfc .child { margin-top: 30px; }',
      '    // .child 的 margin-top 穿透 .parent',
      '',
      '    /* 阻断（不合并） */',
      '    .parent-bfc {',
      '      background: #dcfce7;',
      '      display: flow-root;  // 触发 BFC',
      '    }',
      '    .parent-bfc .child { margin-top: 30px; }',
      '    // .child 的 margin-top 留在 .parent 内部',
      '  </style>',
      '',
      '【调试技巧】',
      '  Chrome DevTools → Elements → Computed → 查看盒模型可视化',
      '  若 margin 显示为虚线（穿透）则发生合并',
      '  实线则未合并',
      '',
      '【浏览器支持】',
      '  margin collapse 是 CSS2.1 规范，全部浏览器一致实现',
      '  display: flow-root 用于阻断合并：Chrome/Firefox/Edge/Safari 13+ 支持',
      `  display: flow-root: ${f.flowRoot ? '✓' : '✗'}`,
    ].join('\n');
    this.setState({ marginCollapseInfo: info });
    this._addLog('css', `margin collapse 演示完成；flow-root=${f.flowRoot}`);
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. margin collapse —— 外边距合并（取较大者）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['display:flow-root', f.flowRoot]]),
        h(Tag, { color: 'primary' }, 'margin 合并'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '块级元素垂直方向 margin 会合并（取较大者），仅垂直方向合并，水平方向不合并。三种场景：相邻块级元素、父元素与第一/最后一个子元素、空块的上下 margin。不合并情况：浮动元素/绝对定位/flex/grid 项目/inline-block/父元素有 padding/border/父元素触发 BFC。解决方案：用 padding 代替 margin / 触发 BFC（display: flow-root）/ 用 flex/grid + gap。writing-mode 影响合并方向。',
        ),
        h('div', { class: 'bm-margin-stage' },
          h('div', { class: 'bm-margin-box' },
            h('div', {}, '相邻块合并：margin-bottom 20 + margin-top 30 = 30px（取大者）'),
          ),
          h('div', { class: 'bm-margin-box bm-bfc' },
            h('div', {}, '父元素 overflow:hidden 阻断：margin 不穿透父元素'),
          ),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('运行 margin collapse 演示', { type: 'primary', size: 'sm', onClick: () => this._runMarginCollapseDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.marginCollapseInfo || '（点击按钮查看 margin collapse 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 5：BFC 块级格式化上下文 =====================

  _runBfcDemo() {
    const f = this._flags();
    const info = [
      '===== BFC 块级格式化上下文（Block Formatting Context）=====',
      '',
      '【概念】',
      '  BFC 是一个独立的渲染区域，内部元素的布局不影响外部',
      '  可理解为「创建了 BFC 的元素」内部形成隔离的盒子',
      '  常用于：清除浮动 / 阻止 margin 合并 / 阻止元素被浮动覆盖',
      '',
      '【触发 BFC 的条件】',
      '  1. float != none（left / right / inline-start / inline-end）',
      '  2. position: absolute / fixed',
      '  3. display: flow-root（推荐，专为 BFC 设计，无副作用）',
      '  4. display: inline-block / table-cell / table-caption',
      '  5. display: flex / inline-flex / grid / inline-grid',
      '     （注意：flex/grid 容器自身是 BFC，但其子项是 FFC/GFC）',
      '  6. overflow != visible（hidden / auto / scroll / clip）',
      '  7. contain: layout / content / strict',
      '  8. column-count / column-width 不为 auto',
      '  9. 根元素（html）默认创建初始 BFC',
      '',
      '  // 完整触发清单',
      '  .bfc-1 { float: left; }',
      '  .bfc-2 { position: absolute; }',
      '  .bfc-3 { display: flow-root; }    // 推荐',
      '  .bfc-4 { display: inline-block; }',
      '  .bfc-5 { display: flex; }',
      '  .bfc-6 { display: grid; }',
      '  .bfc-7 { display: table-cell; }',
      '  .bfc-8 { overflow: hidden; }     // 常用但有副作用',
      '  .bfc-9 { overflow: auto; }       // 可能出现滚动条',
      '  .bfc-10 { contain: layout; }     // 性能优化时用',
      '  .bfc-11 { column-count: 2; }',
      '',
      '【BFC 的作用 1：清除浮动】',
      '  // 父元素不触发 BFC 时，浮动子元素不占高度 → 父元素高度塌陷',
      '  .parent-no-bfc { /* 无 BFC */ }',
      '  .parent-no-bfc .float-child { float: left; }',
      '  // .parent-no-bfc 高度 = 0（不包含浮动子元素）',
      '',
      '  // 解决方案 1：父元素 overflow: hidden',
      '  .parent-1 { overflow: hidden; }  // 触发 BFC 包含浮动',
      '  // 副作用：可能裁剪超出内容（如阴影、绝对定位子元素）',
      '',
      '  // 解决方案 2：父元素 display: flow-root（推荐）',
      '  .parent-2 { display: flow-root; }  // 专为 BFC 设计',
      '  // 无副作用，不创建滚动容器',
      '',
      '【BFC 的作用 2：阻止 margin 合并】',
      '  // 父元素触发 BFC → 子元素 margin 不穿透父元素',
      '  .parent-bfc {',
      '    display: flow-root;  // 或 overflow: hidden',
      '  }',
      '  .parent-bfc .child { margin-top: 30px; }',
      '  // .child 的 margin-top 留在 .parent-bfc 内部',
      '',
      '【BFC 的作用 3：阻止元素被浮动覆盖】',
      '  // 浮动元素会覆盖正常流元素',
      '  .float-left { float: left; width: 100px; height: 100px; }',
      '  .normal { /* 无 BFC */ }',
      '  // .normal 会被 .float-left 覆盖（文字环绕效果）',
      '',
      '  // 解决：让 .normal 触发 BFC',
      '  .normal-bfc {',
      '    overflow: hidden;  // 或 display: flow-root',
      '  }',
      '  // .normal-bfc 不被 .float-left 覆盖，紧贴其右侧',
      '  // 常用于两栏自适应布局',
      '',
      '【display: flow-root vs overflow: hidden】',
      '  ┌─────────────────────┬──────────────────────────────────┐',
      '  │ 特性                │ 区别                              │',
      '  ├─────────────────────┼──────────────────────────────────┤',
      '  │ 触发 BFC            │ 都触发                            │',
      '  │ 滚动容器            │ overflow:hidden 创建；flow-root 不创建 │',
      '  │ 内容裁剪            │ overflow:hidden 裁剪超出；flow-root 不裁剪 │',
      '  │ 子元素阴影          │ overflow:hidden 裁剪阴影；flow-root 保留 │',
      '  │ 性能                │ flow-root 略优（无滚动相关计算）  │',
      '  │ 推荐度              │ flow-root > overflow:hidden      │',
      '  └─────────────────────┴──────────────────────────────────┘',
      '',
      '  // flow-root 是 CSS Display Module Level 3 专为 BFC 设计的值',
      '  // 语义清晰：display: flow-root 表示「创建 BFC 但无其他副作用」',
      '',
      '【与 IFC / GFC / FFC 的关系】',
      '  - BFC（Block Formatting Context）块级格式化上下文',
      '    block / list-item / table / flow-root / flex(grid 容器自身)',
      '  - IFC（Inline Formatting Context）行内格式化上下文',
      '    inline 元素内部形成 IFC，文字按基线对齐',
      '  - GFC（Grid Formatting Context）网格格式化上下文',
      '    display: grid / inline-grid 的直接子项',
      '  - FFC（Flex Formatting Context）弹性格式化上下文',
      '    display: flex / inline-flex 的直接子项',
      '',
      '  // 注意：flex/grid 容器自身是 BFC，但其直接子项是 FFC/GFC',
      '  // 所以 flex 子项的 margin 不合并（FFC 内不合并）',
      '',
      '【完整代码示例：清浮动 + 阻 margin 合并 + 阻浮动覆盖】',
      '  <style>',
      '    /* 1. 清除浮动 */',
      '    .clearfix { display: flow-root; }',
      '    .clearfix .float-item { float: left; width: 100px; margin: 4px; }',
      '',
      '    /* 2. 阻止 margin 合并 */',
      '    .parent { display: flow-root; }',
      '    .parent .child { margin-top: 30px; }  /* 不穿透 */',
      '',
      '    /* 3. 阻止浮动覆盖 */',
      '    .float-left { float: left; width: 100px; height: 100px; }',
      '    .normal { overflow: hidden; }  /* 紧贴 float-left 右侧 */',
      '  </style>',
      '',
      '  <div class="clearfix">',
      '    <div class="float-item">浮动项 1</div>',
      '    <div class="float-item">浮动项 2</div>',
      '  </div>',
      '',
      '【浏览器支持】',
      `  display: flow-root: ${f.flowRoot ? '✓' : '✗'} (Chrome 65+/Firefox 53+/Edge 79+/Safari 13+)`,
      '  overflow: hidden 触发 BFC：全部浏览器支持',
      '  contain: layout: Chrome 52+/Firefox 69+',
    ].join('\n');
    this.setState({ bfcInfo: info });
    this._addLog('css', `BFC 演示完成；flow-root=${f.flowRoot}/contain=${f.contain}`);
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. BFC 块级格式化上下文 —— 独立渲染区域',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['display:flow-root', f.flowRoot],
          ['contain', f.contain],
        ]),
        h(Tag, { color: 'primary' }, 'BFC'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'BFC 是独立的渲染区域，内部元素不影响外部。触发条件：float != none / position: absolute/fixed / display: flow-root（推荐）/ inline-block / flex / grid / overflow != visible / contain: layout / column-count。作用：清除浮动（父元素 overflow:hidden 或 display:flow-root）/ 阻止 margin 合并 / 阻止元素被浮动覆盖。display: flow-root 专为 BFC 设计，不创建滚动容器，优于 overflow: hidden。',
        ),
        h('div', { class: 'bm-bfc-container bm-no-bfc' },
          h('div', { class: 'bm-bfc-float' }, 'float'),
          h('div', { class: 'bm-bfc-text' }, '无 BFC：文字环绕浮动元素（被覆盖）'),
        ),
        h('div', { class: 'bm-bfc-container bm-flow-root' },
          h('div', { class: 'bm-bfc-float' }, 'float'),
          h('div', { class: 'bm-bfc-text' }, 'flow-root BFC：不被浮动覆盖，紧贴右侧'),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('运行 BFC 演示', { type: 'primary', size: 'sm', onClick: () => this._runBfcDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.bfcInfo || '（点击按钮查看 BFC 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 6：float 与清除浮动 =====================

  _runFloatDemo() {
    const f = this._flags();
    const info = [
      '===== float 与清除浮动 =====',
      '',
      '【float 取值】',
      '  float: none;          // 默认，不浮动',
      '  float: left;          // 左浮动',
      '  float: right;         // 右浮动',
      '  float: inline-start; // 行向起始（随 direction/writing-mode）',
      '  float: inline-end;   // 行向结束',
      '',
      '【float 行为】',
      '  1. 浮动元素脱离文档流，但仍影响文本流（文字环绕）',
      '  2. 浮动元素会向左/右移动，直到碰到容器边缘或其他浮动元素',
      '  3. 浮动元素不占父元素高度（父元素高度塌陷）',
      '  4. 浮动元素的 margin 不与相邻元素合并',
      '  5. 浮动元素会触发 BFC',
      '',
      '【float 的 containing block 行为】',
      '  浮动元素的 containing block 是最近的块级祖先',
      '  浮动元素的宽度默认按内容收缩（除非显式设置 width）',
      '  浮动元素不会与行内元素重叠（行内元素自动让出空间）',
      '',
      '【典型场景：文字环绕图片】',
      '  <style>',
      '    .article {',
      '      /* 父元素需触发 BFC 或用 clearfix 包含浮动 */',
      '      display: flow-root;',
      '    }',
      '    .article img {',
      '      float: left;',
      '      width: 200px;',
      '      margin: 0 16px 8px 0;',
      '      shape-outside: circle();  // 圆形环绕',
      '    }',
      '    .article p { line-height: 1.6; }',
      '  </style>',
      '  <div class="article">',
      '    <img src="photo.jpg" alt="图片" />',
      '    <p>这是环绕图片的文字，会自动避开浮动图片...</p>',
      '  </div>',
      '',
      '【清除浮动的方法】',
      '',
      '  方法 1：clear 属性（在下一个元素上）',
      '    .float-left { float: left; }',
      '    .next { clear: left; }   // 清除左浮动',
      '    .next { clear: both; }   // 清除两侧',
      '  // 缺点：需要额外的「下一个元素」，灵活性差',
      '',
      '  方法 2：clearfix hack（经典 ::after 方案）',
      '    .clearfix::after {',
      '      content: "";',
      '      display: table;     // 或 block',
      '      clear: both;',
      '    }',
      '    // 原理：::after 伪元素在父元素最后生成一个块级元素',
      '    //       用 clear: both 强制其在浮动元素下方',
      '    //       父元素为包含此伪元素，自动撑开高度',
      '    // 优点：兼容性好（IE 8+），无副作用',
      '    // 缺点：代码冗长，需理解原理',
      '',
      '  方法 3：父元素触发 BFC（现代方案）',
      '    .parent { overflow: hidden; }     // 触发 BFC',
      '    .parent { display: flow-root; }   // 推荐，专为 BFC',
      '  // 优点：一行 CSS，语义清晰',
      '  // 缺点：overflow:hidden 可能裁剪内容',
      '  //       flow-root 浏览器支持需 Safari 13+',
      '',
      '  方法 4：flow-root（最佳现代方案）',
      '    .parent { display: flow-root; }',
      '  // 专为清浮动设计，无副作用，语义清晰',
      '  // 等价于 clearfix 但更简洁',
      '',
      '【shape-outside 与 float 配合】',
      '  // shape-outside 定义文字环绕的形状（非矩形）',
      '  .float-circle {',
      '    float: left;',
      '    width: 200px;',
      '    height: 200px;',
      '    border-radius: 50%;',
      '    shape-outside: circle();    // 圆形环绕',
      '  }',
      '',
      '  .float-polygon {',
      '    float: left;',
      '    width: 300px;',
      '    height: 200px;',
      '    shape-outside: polygon(0 0, 100% 0, 80% 100%, 20% 100%);',
      '    // 梯形环绕',
      '  }',
      '',
      '  .float-image {',
      '    float: left;',
      '    width: 300px;',
      '    shape-outside: url(mask.png);  // 按图片 alpha 通道环绕',
      '  }',
      '',
      '  // shape-outside 取值：',
      '  //   circle() / ellipse() / inset() / polygon()',
      '  //   url() / path()',
      '  //   margin-box / border-box / padding-box / content-box',
      '',
      '【现代 CSS 中 float 的角色】',
      '  - 已被 flex / grid 替代用于布局',
      '  - 主要用于：文字环绕图片（shape-outside 配合）',
      '  - 历史用途：',
      '    float: left + width: 33% 实现三栏布局（已被 grid 替代）',
      '    float + clearfix 实现自适应布局（已被 flex 替代）',
      '  - 现代项目：仅用 float 做文字环绕，其他场景用 flex/grid',
      '',
      '【完整代码示例：现代清浮动 + 文字环绕】',
      '  <style>',
      '    /* 现代清浮动 */',
      '    .card-grid { display: flow-root; }',
      '    .card-grid .item {',
      '      float: left;',
      '      width: calc(33.33% - 16px);',
      '      margin: 8px;',
      '    }',
      '',
      '    /* 文字环绕图片 */',
      '    .article { display: flow-root; }',
      '    .article .cover {',
      '      float: left;',
      '      width: 200px;',
      '      height: 200px;',
      '      margin: 0 16px 8px 0;',
      '      border-radius: 50%;',
      '      shape-outside: circle();',
      '    }',
      '  </style>',
      '',
      '【浏览器支持】',
      '  float: 全部浏览器支持',
      `  float: inline-start/end: ${f.floatInlineStart ? '✓' : '✗'} (现代浏览器支持)`,
      `  shape-outside: ${f.shapeOutside ? '✓' : '✗'} (Chrome 37+/Firefox 62+/Safari 10.1+)`,
      `  display: flow-root: ${f.flowRoot ? '✓' : '✗'} (现代清浮动方案)`,
    ].join('\n');
    this.setState({ floatInfo: info });
    this._addLog('css', `float 演示完成；inline-start=${f.floatInlineStart}/shape-outside=${f.shapeOutside}`);
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. float 与清除浮动 —— 文字环绕与 clearfix',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['float:inline-start', f.floatInlineStart],
          ['shape-outside', f.shapeOutside],
          ['flow-root', f.flowRoot],
        ]),
        h(Tag, { color: 'primary' }, 'float'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'float: left/right/none/inline-start/inline-end 让元素脱离文档流但仍影响文本流（文字环绕）。清除浮动方法：clear 属性 / clearfix hack（::after { content:""; display:table; clear:both; }）/ 父元素触发 BFC（overflow:hidden 或 display:flow-root，推荐 flow-root）。shape-outside 配合 float 实现非矩形环绕（圆形/多边形/图片 alpha）。现代 CSS 中 float 主要用于文字环绕，布局已被 flex/grid 替代。',
        ),
        h('div', { class: 'bm-float-stage bm-clearfix' },
          h('div', { class: 'bm-float-img' }, 'float\n+ shape-outside\ncircle()'),
          h('div', { class: 'bm-bfc-text' },
            '浮动图片 + shape-outside: circle() 让文字以圆形环绕。这是 float 的现代用法，传统多栏布局已被 flex/grid 替代。父元素加 display: flow-root 或 clearfix::after 可清除浮动避免高度塌陷。',
          ),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('运行 float 演示', { type: 'primary', size: 'sm', onClick: () => this._runFloatDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.floatInfo || '（点击按钮查看 float 与清除浮动完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 7：z-index 与堆叠上下文 =====================

  _runZIndexDemo() {
    const f = this._flags();
    const info = [
      '===== z-index 与堆叠上下文（Stacking Context）=====',
      '',
      '【z-index 取值】',
      '  z-index: auto;     // 默认，等同 0 但不创建新堆叠上下文',
      '  z-index: <integer>; // 正/负/零整数',
      '  // 仅 position != static 生效（static 时 z-index 无效）',
      '  // flex/grid 子项的 z-index 也生效（不需 position）',
      '',
      '【堆叠上下文形成条件（重要）】',
      '  1. position != static 且 z-index != auto',
      '     .a { position: relative; z-index: 1; }  // 创建',
      '',
      '  2. position: fixed / sticky（无论 z-index 值）',
      '     .b { position: fixed; }  // 创建（即使 z-index: auto）',
      '     .c { position: sticky; top: 0; }  // 创建',
      '',
      '  3. opacity < 1',
      '     .d { opacity: 0.99; }  // 创建（陷阱：模态框被限制）',
      '',
      '  4. transform / filter / perspective / will-change != auto',
      '     .e { transform: translateZ(0); }  // 创建',
      '     .f { filter: blur(0); }  // 创建',
      '     .g { will-change: transform; }  // 创建',
      '',
      '  5. mix-blend-mode != normal',
      '     .h { mix-blend-mode: multiply; }  // 创建',
      '',
      '  6. isolation: isolate',
      '     .i { isolation: isolate; }  // 显式创建',
      '',
      '  7. display: flex / grid 子项且 z-index != auto',
      '     .flex-parent { display: flex; }',
      '     .flex-item { z-index: 1; }  // flex 子项创建',
      '',
      '  8. -webkit-overflow-scrolling: touch（iOS 旧版）',
      '  9. contain: layout / paint / strict / content',
      '  10. 根元素（html）默认创建初始堆叠上下文',
      '',
      '【堆叠顺序（同一上下文内，从下到上）】',
      '  1. 父堆叠上下文的背景和边框',
      '  2. 负 z-index 的子堆叠上下文（z-index: -1）',
      '  3. 块级子元素（block-level，非定位）',
      '  4. 浮动子元素（float）',
      '  5. 行内子元素（inline）',
      '  6. z-index: 0 / auto 的定位子元素',
      '  7. 正 z-index 的子堆叠上下文（z-index: 1, 2, ...）',
      '',
      '  // 口诀：背景 → 负 z → block → float → inline → 0/auto → 正 z',
      '',
      '【子元素的 z-index 仅在父堆叠上下文内有效】',
      '  // 子元素无法穿透父级堆叠上下文',
      '  <div class="parent" style="opacity: 0.99;">',
      '    <div class="child" style="z-index: 9999;">高 z-index</div>',
      '  </div>',
      '  <div class="sibling" style="z-index: 2;">低 z-index</div>',
      '',
      '  // .parent 因 opacity:0.99 创建堆叠上下文',
      '  // .child 的 z-index:9999 仅在 .parent 内有效',
      '  // .sibling 的 z-index:2 在外层（更高层）上下文',
      '  // → .sibling 仍会覆盖 .child（即使 9999 > 2）',
      '',
      '【常见陷阱：模态框被父级 opacity:0.99 限制 z-index】',
      '  // 错误：祖先有 opacity < 1',
      '  <div class="app" style="opacity: 0.99;">',
      '    <dialog class="modal" style="z-index: 9999;">',
      '      模态框内容',
      '    </dialog>',
      '  </div>',
      '  // .app 创建堆叠上下文，.modal 的 z-index:9999 仅在 .app 内',
      '  // 外部其他元素（z-index: 2）可能覆盖 .modal',
      '',
      '  // 正确：避免祖先创建堆叠上下文',
      '  <div class="app">  <!-- 移除 opacity:0.99 -->',
      '    <dialog class="modal" style="z-index: 9999;">',
      '      模态框内容',
      '    </dialog>',
      '  </div>',
      '  // 或用 isolation: isolate 显式创建独立上下文',
      '',
      '【调试技巧：Chrome DevTools 3D 视图】',
      '  Chrome DevTools → Elements → 右键元素 → "Show in Layers"',
      '  或 More tools → Layers 面板',
      '  可看到 3D 堆叠顺序，直观判断 z-index 失效原因',
      '  - 红色框：创建了新堆叠上下文',
      '  - 子元素在父级堆叠上下文内',
      '  - 父级堆叠上下文整体参与外层排序',
      '',
      '【堆叠上下文 vs 层叠顺序 vs 绘制顺序】',
      '  - 堆叠上下文（Stacking Context）：一个独立的堆叠环境',
      '    内部元素的 z-index 仅在上下文内排序',
      '  - 层叠顺序（Stacking Order）：同一上下文内的 7 层顺序',
      '    （背景 → 负 z → block → float → inline → 0/auto → 正 z）',
      '  - 绘制顺序（Paint Order）：浏览器实际绘制元素的顺序',
      '    后绘制的覆盖先绘制的',
      '',
      '【完整代码示例：堆叠顺序可视化】',
      '  <style>',
      '    .stage { position: relative; height: 200px; }',
      '    .bg     { position: absolute; inset: 0; background: #cbd5e1; z-index: -1; }',
      '    .block  { position: absolute; top: 16px; left: 16px; background: #3b82f6; z-index: 1; }',
      '    .float  { position: absolute; top: 40px; left: 40px; background: #10b981; z-index: 2; }',
      '    .inline { position: absolute; top: 64px; left: 64px; background: #f59e0b; z-index: 3; }',
      '    .top    { position: absolute; top: 88px; left: 88px; background: #ef4444; z-index: 10; }',
      '  </style>',
      '  <div class="stage">',
      '    <div class="bg">背景 z-index:-1</div>',
      '    <div class="block">block z:1</div>',
      '    <div class="float">float z:2</div>',
      '    <div class="inline">inline z:3</div>',
      '    <div class="top">top z:10</div>',
      '  </div>',
      '',
      '【陷阱案例：z-index 失效排查清单】',
      '  1. 检查 position 是否 != static（static 时 z-index 无效）',
      '  2. 检查祖先是否有 opacity < 1',
      '  3. 检查祖先是否有 transform / filter / will-change',
      '  4. 检查祖先是否有 isolation: isolate',
      '  5. 检查祖先是否有 mix-blend-mode != normal',
      '  6. 检查祖先是否有 contain: layout/paint/strict',
      '  7. 检查 z-index 值是否在父堆叠上下文内合理',
      '  8. 用 DevTools Layers 面板确认堆叠结构',
      '',
      '【浏览器支持】',
      `  z-index: ${f.zIndex ? '✓' : '✗'} (全部支持)`,
      `  isolation: ${f.isolation ? '✓' : '✗'} (Chrome 41+/Firefox 36+/Safari 8+)`,
      `  contain: ${f.contain ? '✓' : '✗'} (Chrome 52+/Firefox 69+)`,
      '  堆叠上下文规则是 CSS2.1 规范，全部浏览器一致实现',
    ].join('\n');
    this.setState({ zIndexInfo: info });
    this._addLog('css', `z-index 演示完成；z-index=${f.zIndex}/isolation=${f.isolation}/contain=${f.contain}`);
  }

  _renderCard7() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. z-index 与堆叠上下文 —— 层叠规则与陷阱',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['z-index', f.zIndex],
          ['isolation', f.isolation],
          ['contain', f.contain],
        ]),
        h(Tag, { color: 'primary' }, '堆叠上下文'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'z-index: auto(默认，等同 0 但不创建上下文) | integer。堆叠上下文形成条件：position!=static 且 z-index!=auto / position:fixed/sticky / opacity<1 / transform/filter/will-change!=auto / mix-blend-mode!=normal / isolation:isolate / flex/grid 子项 z-index!=auto。堆叠顺序（同上下文）：背景 → 负 z-index → block → float → inline → 0/auto → 正 z-index。子元素 z-index 仅在父堆叠上下文内有效，常见陷阱：模态框被父级 opacity:0.99 限制。',
        ),
        h('div', { class: 'bm-z-index-stage' },
          h('div', { class: 'bm-z-layer bm-z-bg' }, '背景 z-index:-1'),
          h('div', { class: 'bm-z-layer bm-z-block' }, 'block z:1'),
          h('div', { class: 'bm-z-layer bm-z-float' }, 'float z:2'),
          h('div', { class: 'bm-z-layer bm-z-inline' }, 'inline z:3'),
          h('div', { class: 'bm-z-layer bm-z-top' }, 'top z:10'),
        ),
        h('div', { class: 'bm-trap-parent' },
          h('div', { style: { fontSize: '12px', color: '#92400e' } }, '陷阱：父 opacity:0.99 创建堆叠上下文'),
          h('div', { class: 'bm-trap-modal' }, 'modal z:9999（被父限制）'),
        ),
        h('div', { class: 'bm-trap-sibling', style: { fontSize: '12px' } }, 'sibling z:2（外层覆盖 modal）'),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('运行 z-index 演示', { type: 'primary', size: 'sm', onClick: () => this._runZIndexDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.zIndexInfo || '（点击按钮查看 z-index 与堆叠上下文完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 8：实战模式与陷阱 =====================

  _runPatternDemo() {
    const f = this._flags();
    const info = [
      '===== CSS Box Model & Positioning 实战模式与陷阱 =====',
      '',
      '【场景 1：居中布局大全（多种方案对比）】',
      '',
      '  // 水平居中（行内元素）',
      '  .parent { text-align: center; }',
      '  .child { display: inline-block; }',
      '',
      '  // 水平居中（块级元素，定宽）',
      '  .child { width: 200px; margin: 0 auto; }',
      '',
      '  // 水平垂直居中（绝对定位 + transform，推荐）',
      '  .parent { position: relative; }',
      '  .child {',
      '    position: absolute;',
      '    top: 50%; left: 50%;',
      '    transform: translate(-50%, -50%);',
      '  }',
      '',
      '  // 水平垂直居中（flex，现代推荐）',
      '  .parent {',
      '    display: flex;',
      '    align-items: center;     // 垂直居中',
      '    justify-content: center; // 水平居中',
      '  }',
      '',
      '  // 水平垂直居中（grid，最简洁）',
      '  .parent { display: grid; place-items: center; }',
      '',
      '  // 水平垂直居中（绝对定位 + inset:0 + margin:auto）',
      '  .parent { position: relative; }',
      '  .child {',
      '    position: absolute;',
      '    inset: 0;            // top/right/bottom/left: 0',
      '    margin: auto;        // 自动分配剩余空间',
      '    width: 200px; height: 100px;  // 需定宽高',
      '  }',
      '',
      '【场景 2：sticky 页脚实现（两种方案）】',
      '',
      '  // 方案 1：min-height + flex column（推荐）',
      '  body {',
      '    min-height: 100vh;',
      '    display: flex;',
      '    flex-direction: column;',
      '  }',
      '  main { flex: 1; }     // 主内容区扩展',
      '  footer { /* 自动贴底 */ }',
      '',
      '  // 方案 2：sticky position',
      '  footer {',
      '    position: sticky;',
      '    top: 100vh;          // 滚动到底部时贴视口',
      '  }',
      '  // 方案 1 更直观，推荐',
      '',
      '【场景 3：侧边栏吸顶（position: sticky）】',
      '  .layout {',
      '    display: grid;',
      '    grid-template-columns: 240px 1fr;',
      '    gap: 24px;',
      '  }',
      '  .sidebar {',
      '    position: sticky;',
      '    top: 80px;            // 距顶 80px（避开导航栏）',
      '    align-self: start;    // 避免被 grid 拉伸',
      '    max-height: calc(100vh - 80px);',
      '    overflow: auto;',
      '  }',
      '',
      '【场景 4：模态框定位（fixed + 居中 + z-index）】',
      '  // 避免祖先创建堆叠上下文（opacity/transform/filter）',
      '  .modal-overlay {',
      '    position: fixed;',
      '    inset: 0;            // 全屏覆盖',
      '    background: rgba(0, 0, 0, 0.5);',
      '    display: flex;',
      '    align-items: center;',
      '    justify-content: center;',
      '    z-index: 1000;',
      '  }',
      '  .modal {',
      '    background: #fff;',
      '    padding: 24px;',
      '    border-radius: 8px;',
      '    max-width: 90vw;',
      '    max-height: 90vh;',
      '    overflow: auto;',
      '    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);',
      '  }',
      '  // 注意：.modal-overlay 必须直接挂在 body 下，',
      '  // 避免被祖先的 opacity/transform 限制 z-index',
      '  // 现代方案：用 <dialog> 元素 + showModal()',
      '',
      '【场景 5：文字环绕图片（float + shape-outside）】',
      '  .article { display: flow-root; }',
      '  .article .cover {',
      '    float: left;',
      '    width: 200px;',
      '    height: 200px;',
      '    margin: 0 16px 8px 0;',
      '    border-radius: 50%;',
      '    shape-outside: circle();',
      '  }',
      '  .article p { line-height: 1.6; }',
      '',
      '【场景 6：清除浮动现代方案（display: flow-root）】',
      '  // 旧方案：clearfix hack',
      '  .clearfix::after {',
      '    content: "";',
      '    display: table;',
      '    clear: both;',
      '  }',
      '',
      '  // 新方案：display: flow-root（推荐）',
      '  .container { display: flow-root; }',
      '  .container .float-item { float: left; }',
      '  // 一行 CSS，语义清晰，无副作用',
      '',
      '【场景 7：多栏布局对比（历史与现代）】',
      '',
      '  // 历史 1：float + width: 33%（已淘汰）',
      '  .col { float: left; width: 33.33%; }',
      '  .row::after { content: ""; display: table; clear: both; }',
      '  // 缺点：等高难、顺序难调、需 clearfix',
      '',
      '  // 历史 2：table 布局（已淘汰）',
      '  .row { display: table; width: 100%; }',
      '  .col { display: table-cell; }',
      '  // 缺点：语义错误、响应式难',
      '',
      '  // 现代 1：flex 一维布局',
      '  .row { display: flex; gap: 16px; }',
      '  .col { flex: 1; }  // 等宽',
      '  // 优点：简洁、等高、易响应式',
      '',
      '  // 现代 2：grid 二维布局（最强）',
      '  .grid {',
      '    display: grid;',
      '    grid-template-columns: repeat(3, 1fr);',
      '    gap: 16px;',
      '  }',
      '  // 优点：二维布局、命名区域、响应式内置',
      '',
      '【常见陷阱清单】',
      '',
      '  陷阱 1：margin 合并导致间距异常',
      '    现象：两个块级元素 margin-bottom:20 + margin-top:30 = 30px（取大者）',
      '    解决：用 padding / 触发 BFC / 用 flex + gap',
      '',
      '  陷阱 2：float 父元素高度塌陷',
      '    现象：父元素含浮动子元素，父元素高度 = 0',
      '    解决：父元素 display: flow-root 或 clearfix::after',
      '',
      '  陷阱 3：position: absolute 找错 containing block',
      '    现象：absolute 子元素相对视口而非父元素定位',
      '    原因：父元素未设 position: relative',
      '    解决：父元素加 position: relative',
      '',
      '  陷阱 4：z-index 失效因父级堆叠上下文',
      '    现象：z-index:9999 的子元素被 z-index:2 的兄弟覆盖',
      '    原因：父元素 opacity:0.99 / transform / filter 创建堆叠上下文',
      '    解决：移除祖先的 opacity/transform，或用 isolation: isolate',
      '',
      '  陷阱 5：sticky 不生效因父元素 overflow',
      '    现象：position: sticky; top:0 不吸顶',
      '    原因：祖先 overflow: hidden 但无滚动空间',
      '    解决：移除祖先 overflow，或用 overflow: clip + overflow-clip-margin',
      '',
      '  陷阱 6：fixed 被 transform 祖先限制',
      '    现象：position: fixed 不相对视口',
      '    原因：祖先有 transform/filter/will-change/perspective',
      '    解决：移除祖先 transform，或将 fixed 元素移到 body 下',
      '',
      '  陷阱 7：box-sizing 默认 content-box 尺寸异常',
      '    现象：width:200 + padding:16 + border:4 = 240px（非预期 200px）',
      '    解决：全局重置 * { box-sizing: border-box; }',
      '',
      '  陷阱 8：flex 子项 sticky 不吸顶',
      '    现象：flex 容器内 sticky 子元素不工作',
      '    原因：align-items: stretch（默认）将子元素拉伸',
      '    解决：align-items: flex-start 或子元素 align-self: start',
      '',
      '【浏览器兼容性速查】',
      '  - box-sizing: border-box 全部支持（IE 8+ 部分支持）',
      '  - position: fixed 全部支持',
      `  - position: sticky: ${f.positionSticky ? '✓' : '✗'} (IE 11 不支持)`,
      `  - inset 简写: ${f.inset ? '✓' : '✗'} (Chrome 87+/Safari 14.1+)`,
      `  - display: flow-root: ${f.flowRoot ? '✓' : '✗'} (现代浏览器支持)`,
      `  - shape-outside: ${f.shapeOutside ? '✓' : '✗'} (现代浏览器支持)`,
      `  - isolation: ${f.isolation ? '✓' : '✗'}`,
      `  - contain: ${f.contain ? '✓' : '✗'}`,
      '  - BFC 规则（overflow:hidden 触发）：全部支持',
      '  - 堆叠上下文规则：CSS2.1 规范，全部一致实现',
      '',
      '【Chrome DevTools Layout 调试技巧】',
      '  1. Elements → Computed → Box Model 可视化（content/padding/border/margin）',
      '  2. Elements → 选中元素 → Layout 面板（grid/flex 调试）',
      '  3. More tools → Layers 面板（3D 堆叠顺序）',
      '  4. 右键元素 → "Show in Layers" 快速跳转',
      '  5. Console 输入 getComputedStyle(el) 查看实际计算值',
      '  6. el.getBoundingClientRect() 查看实际渲染尺寸和位置',
      '  7. el.offsetParent 查看定位上下文（absolute 的 containing block）',
      '',
      '【资源】',
      '  - MDN Box Model: https://developer.mozilla.org/docs/Web/CSS/CSS_box_model',
      '  - MDN Position: https://developer.mozilla.org/docs/Web/CSS/position',
      '  - MDN z-index: https://developer.mozilla.org/docs/Web/CSS/z-index',
      '  - MDN float: https://developer.mozilla.org/docs/Web/CSS/float',
      '  - CSS Display Module Level 3: https://drafts.csswg.org/css-display-3/',
    ].join('\n');
    this.setState({ patternInfo: info });
    this._addLog('css', '实战模式与陷阱演示完成');
  }

  _renderCard8() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 实战模式与陷阱 —— 居中/sticky/fixed/模态框/清浮动',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, '实战'),
        h(Tag, { color: 'info' }, '8 大陷阱'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '完整实战模式：居中布局大全（margin:auto / transform / flex / grid / inset+margin）/ sticky 页脚（flex column + main flex:1）/ 侧边栏吸顶（sticky + align-self:start）/ 模态框定位（fixed + 居中 + z-index 堆叠上下文）/ 文字环绕图片（float + shape-outside）/ 清除浮动现代方案（display: flow-root）/ 多栏布局对比（float→table→flex→grid）。常见陷阱清单：margin 合并 / float 塌陷 / absolute 找错 containing block / z-index 失效 / sticky 不生效 / fixed 被 transform 限制 / box-sizing 默认值 / flex sticky 失效。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行实战模式演示', { type: 'primary', size: 'sm', onClick: () => this._runPatternDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.patternInfo || '（点击按钮查看实战模式与陷阱完整代码）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 9：块级上下文 align-content =====================

  _runBlockAlignContentDemo() {
    const f = this._flags();
    const supported = f.alignContentCenter || f.alignContentSpaceBetween || f.alignContentSpaceEvenly || f.alignContentStretch;
    const info = [
      '===== 块级上下文 align-content（Block Layout align-content）=====',
      '',
      '【概述】',
      '  CSS Box Alignment Module Level 3 将 align-content 从 Flex/Grid 扩展到',
      '  普通块级容器（block container）。Chrome 123+（2024-03 起）率先实现，',
      '  允许在「有剩余高度的块级容器」内分布块级子元素，无需借助 flex/grid。',
      '  Safari / Firefox 截至 2024 年底尚未实现（处于开发中）。',
      '',
      '  // 历史：align-content 原本仅适用于 Flex/Grid 容器',
      '  // Chrome 123+ 扩展到 block container（普通块级元素）',
      '  // 在块级容器中，align-content 控制块级子元素沿块向（block direction）的分布',
      '',
      '【与 Flex/Grid 的 align-content 区别】',
      '  ┌──────────────┬──────────────────────────────────────────────────────────┐',
      '  │ 容器类型     │ align-content 行为                                       │',
      '  ├──────────────┼──────────────────────────────────────────────────────────┤',
      '  │ Flex         │ 仅当 flex-wrap: wrap 多行时生效，分布多行（flex line）   │',
      '  │ Grid         │ 分布 grid 行（grid track），与 grid-template-rows 协同   │',
      '  │ Block        │ 分布所有块级子元素（任何块级容器，无需 flex/grid）       │',
      '  └──────────────┴──────────────────────────────────────────────────────────┘',
      '',
      '  // 三者语法相同（normal/start/end/center/space-* 等），但语义不同：',
      '  // - Flex：分布的是「行」（flex line）',
      '  // - Grid：分布的是「网格行」（grid track）',
      '  // - Block：分布的是「块级子元素」（block-level children）',
      '',
      '【块级容器 align-content 取值】',
      '  align-content: normal;          // 默认，等同 start',
      '  align-content: start;           // 子块紧贴容器块向起始端（vertical 时顶部）',
      '  align-content: end;             // 子块紧贴容器块向结束端（底部）',
      '  align-content: center;          // 子块整体居中（剩余空间上下平分）',
      '  align-content: space-between;   // 首尾贴边，中间均分',
      '  align-content: space-around;    // 每个子块上下各分一半空间',
      '  align-content: space-evenly;    // 所有间隙完全相等（含首尾）',
      '  align-content: stretch;         // 拉伸子块填满剩余空间（块级默认不拉伸）',
      '  align-content: baseline;        // 按基线对齐（块级上下文中较少用）',
      '',
      '  // 在块级容器中：仅当容器有剩余空间时生效',
      '  // 若容器高度 = 子元素总高度（无剩余），align-content 无可见效果',
      '',
      '【适用条件（必须全部满足）】',
      '  1. 容器必须是「块级容器」（block / inline-block / flow-root 等）',
      '     不能是 display: flex / grid（那是 Flex/Grid 的 align-content 语义）',
      '  2. 容器必须有「剩余高度」（height > 内容总高度）',
      '     如 height: 100vh / height: 400px / min-height 等',
      '  3. 仅对「块级子元素」生效',
      '     inline / inline-block 子元素不参与分布',
      '  4. 与 writing-mode 协同',
      '     默认 writing-mode: horizontal-tb → 块向 = 垂直方向',
      '     writing-mode: vertical-rl       → 块向 = 水平方向',
      '  5. 单行 / 多行块级容器均支持',
      '     单个子块也能居中（替代 flex 单元素垂直居中）',
      '',
      '【实战 1：垂直居中块级内容（替代 flex）】',
      '  /* 旧方案：display: flex + justify-content */',
      '  .old-hero {',
      '    display: flex;',
      '    flex-direction: column;',
      '    justify-content: center;',
      '    height: 100vh;',
      '  }',
      '',
      '  /* 新方案：align-content（块级容器）*/',
      '  .new-hero {',
      '    height: 100vh;',
      '    align-content: center;',
      '  }',
      '  /* 子元素仍是普通块级 div，无需改 display */',
      '',
      '  // 单元素垂直居中（最简）',
      '  .single-center {',
      '    height: 100vh;',
      '    align-content: center;',
      '  }',
      '  .single-center > .child { /* 普通块级子元素 */ }',
      '',
      '  // 多元素均匀分布',
      '  .multi-spread {',
      '    height: 100vh;',
      '    align-content: space-between;  /* 首尾贴边，中间均分 */',
      '  }',
      '',
      '【实战 2：Footer 置底（替代 sticky / flex column）】',
      '  /* 旧方案：min-height + flex column */',
      '  body {',
      '    min-height: 100vh;',
      '    display: flex;',
      '    flex-direction: column;',
      '  }',
      '  main { flex: 1; }',
      '  footer { /* 自动贴底 */ }',
      '',
      '  /* 新方案：align-content: space-between（块级容器）*/',
      '  body {',
      '    min-height: 100vh;',
      '    align-content: space-between;',
      '  }',
      '  main { /* 主内容顶部 */ }',
      '  footer { /* 自动贴底 */ }',
      '  /* main 顶部贴顶，footer 底部贴底，无需 flex/grid */',
      '',
      '  // 与 Grid 模板行对比',
      '  .grid-alt {',
      '    display: grid;',
      '    grid-template-rows: auto 1fr auto;  /* header / main / footer */',
      '    min-height: 100vh;',
      '  }',
      '  // Grid 方案需定义行模板；align-content 方案更轻量（保持块级流）',
      '',
      '【陷阱清单】',
      '  陷阱 1：浏览器支持有限',
      '    现象：Safari / Firefox 完全不生效',
      '    原因：仅 Chrome 123+（2024-03）实现，其他浏览器待跟进',
      '    解决：降级到 flex/grid，或用 @supports 渐进增强',
      '      @supports (align-content: center) {',
      '        .hero { align-content: center; }',
      '      }',
      '      @supports not (align-content: center) {',
      '        .hero { display: flex; flex-direction: column; justify-content: center; }',
      '      }',
      '',
      '  陷阱 2：必须有剩余空间',
      '    现象：align-content: center 无居中效果',
      '    原因：容器高度 = 子元素总高度（无剩余空间可分布）',
      '    解决：给容器设 height / min-height 大于内容总高',
      '',
      '  陷阱 3：与 overflow: auto 协同',
      '    现象：容器 overflow: auto + 内容溢出时 align-content 失效',
      '    原因：内容溢出后无剩余空间，分布规则不适用',
      '    解决：仅在内容不溢出时使用，溢出场景用 flex/grid',
      '',
      '  陷阱 4：与 Flex 容器冲突',
      '    现象：display: flex 容器上的 align-content 行为与预期不同',
      '    原因：Flex 容器走 Flex 的 align-content 语义（分布 flex line）',
      '    解决：块级 align-content 仅用于非 flex/grid 的块级容器',
      '',
      '  陷阱 5：降级到 Flex/Grid',
      '    若需兼容 Safari/Firefox，仍推荐 flex/grid 方案',
      '    块级 align-content 是「锦上添花」，非「雪中送炭」',
      '    现代项目可在 @supports 检测后渐进增强使用',
      '',
      '【完整代码示例：块级 align-content 四种值对比】',
      '  <style>',
      '    .stage {',
      '      display: grid;',
      '      grid-template-columns: 1fr 1fr;',
      '      gap: 12px;',
      '    }',
      '    .box {',
      '      height: 230px;',
      '      background: #f1f5f9;',
      '      border: 1px solid #cbd5e1;',
      '      border-radius: 8px;',
      '      padding: 8px;',
      '      overflow: hidden;',
      '    }',
      '    .box h5 { margin: 0 0 6px; font-size: 12px; color: #475569; }',
      '    .host {',
      '      height: 180px;',
      '      background: #fff;',
      '      border: 1px dashed #94a3b8;',
      '      border-radius: 6px;',
      '      padding: 6px;',
      '    }',
      '    .host.center         { align-content: center; }',
      '    .host.space-between  { align-content: space-between; }',
      '    .host.space-evenly   { align-content: space-evenly; }',
      '    .host.stretch        { align-content: stretch; }',
      '    .item {',
      '      background: #3b82f6;',
      '      color: #fff;',
      '      padding: 6px 8px;',
      '      border-radius: 4px;',
      '      font-size: 11px;',
      '    }',
      '    .item.alt { background: #10b981; }',
      '  </style>',
      '',
      '  <div class="stage">',
      '    <div class="box">',
      '      <h5>align-content: center</h5>',
      '      <div class="host center">',
      '        <div class="item">块 1</div>',
      '        <div class="item alt">块 2</div>',
      '        <div class="item">块 3</div>',
      '      </div>',
      '    </div>',
      '    <!-- ... space-between / space-evenly / stretch ... -->',
      '  </div>',
      '',
      '【浏览器支持】',
      `  align-content: center:        ${f.alignContentCenter ? '✓' : '✗'} (CSS.supports 检测)`,
      `  align-content: space-between: ${f.alignContentSpaceBetween ? '✓' : '✗'}`,
      `  align-content: space-evenly:  ${f.alignContentSpaceEvenly ? '✓' : '✗'}`,
      `  align-content: stretch:       ${f.alignContentStretch ? '✓' : '✗'}`,
      '  注意：CSS.supports 仅检测语法是否识别，不保证实际渲染生效',
      '  实际渲染支持：Chrome 123+ / Edge 123+（2024-03 起）',
      '  Safari / Firefox 截至 2024-12 仍未实现块级 align-content',
      '  详见：https://developer.mozilla.org/docs/Web/CSS/align-content',
      '  规范：CSS Box Alignment Module Level 3',
      '       https://drafts.csswg.org/css-align-3/',
    ].join('\n');
    this.setState({ blockAlignContentInfo: info });
    this._addLog('css', `块级 align-content 演示完成；center=${f.alignContentCenter}/space-between=${f.alignContentSpaceBetween}/space-evenly=${f.alignContentSpaceEvenly}/stretch=${f.alignContentStretch}`);
    if (!supported) this._addLog('warn', '块级 align-content 当前环境 CSS.supports 未识别（可能 Safari/Firefox 或 jsdom）');
  }

  _renderCard9() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '9. 块级上下文 align-content —— Block Layout 对齐分布',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['align-content:center', f.alignContentCenter],
          ['space-between', f.alignContentSpaceBetween],
          ['space-evenly', f.alignContentSpaceEvenly],
          ['stretch', f.alignContentStretch],
        ]),
        h(Tag, { color: 'primary' }, 'Box Alignment L3'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'CSS Box Alignment Module Level 3 将 align-content 从 Flex/Grid 扩展到普通块级容器（block container），Chrome 123+ 率先实现。取值：normal/start/end/center/space-between/space-around/space-evenly/stretch/baseline。适用条件：容器必须是块级容器（非 flex/grid）+ 有剩余高度 + 仅对块级子元素生效 + 与 writing-mode 协同。与 Flex（分布 flex line）/Grid（分布 grid track）语法相同语义不同。实战：垂直居中块级内容（替代 display:flex + justify-content）/ Footer 置底（min-height:100vh + align-content:space-between）。陷阱：仅 Chrome 123+ 支持，Safari/Firefox 未实现，需 @supports 渐进增强降级到 flex/grid。',
        ),
        h('div', { class: 'bm-block-align-stage' },
          h('div', { class: 'bm-block-align-col' },
            h('h5', {}, 'align-content: center'),
            h('div', { class: 'bm-block-align-host is-center' },
              h('div', { class: 'bm-block-align-item' }, '块 1'),
              h('div', { class: 'bm-block-align-item alt' }, '块 2'),
              h('div', { class: 'bm-block-align-item' }, '块 3'),
            ),
          ),
          h('div', { class: 'bm-block-align-col' },
            h('h5', {}, 'align-content: space-between'),
            h('div', { class: 'bm-block-align-host is-space-between' },
              h('div', { class: 'bm-block-align-item' }, '块 1'),
              h('div', { class: 'bm-block-align-item alt' }, '块 2'),
              h('div', { class: 'bm-block-align-item' }, '块 3'),
            ),
          ),
          h('div', { class: 'bm-block-align-col' },
            h('h5', {}, 'align-content: space-evenly'),
            h('div', { class: 'bm-block-align-host is-space-evenly' },
              h('div', { class: 'bm-block-align-item' }, '块 1'),
              h('div', { class: 'bm-block-align-item alt' }, '块 2'),
              h('div', { class: 'bm-block-align-item' }, '块 3'),
            ),
          ),
          h('div', { class: 'bm-block-align-col' },
            h('h5', {}, 'align-content: stretch'),
            h('div', { class: 'bm-block-align-host is-stretch' },
              h('div', { class: 'bm-block-align-item' }, '块 1'),
              h('div', { class: 'bm-block-align-item alt' }, '块 2'),
              h('div', { class: 'bm-block-align-item' }, '块 3'),
            ),
          ),
        ),
        h('div', { class: 'fs-sm text-secondary', style: { marginTop: '8px' } },
          '注：jsdom 不做真实布局，浏览器中可见 4 种 align-content 取值在块级容器内的分布差异（仅 Chrome 123+ 渲染生效）。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
          this._btn('运行块级 align-content 演示', { type: 'primary', size: 'sm', onClick: () => this._runBlockAlignContentDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.blockAlignContentInfo || '（点击按钮查看块级上下文 align-content 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

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

  renderPage() {
    const s = this.state;
    return [
      h('h2', { class: 'section-title' }, 'CSS Box Model & Positioning 完整实验室'),

      h(Alert, {
        type: 'info',
        message: 'CSS 盒模型与定位系统 —— 布局核心知识全集',
        description: '演示 CSS Box Model + Positioning + BFC + Margin Collapse 全套能力：box-sizing（content-box/border-box/全局重置）、position 定位系统（static/relative/absolute/fixed/sticky + inset + z-index + containing block）、position: sticky 深潜（阈值触发/父容器 overflow 限制/多级 sticky）、margin collapse（相邻/父子/空块/不合并情况/解决方案）、BFC 块级格式化上下文（触发条件/清浮动/阻 margin/阻浮动覆盖/flow-root vs overflow:hidden）、float 与清除浮动（clearfix/shape-outside）、z-index 与堆叠上下文（形成条件/堆叠顺序/陷阱）、实战模式（居中/sticky 页脚/侧边栏吸顶/模态框/多栏布局对比/8 大陷阱清单）、块级上下文 align-content（Box Alignment L3 扩展 / Chrome 123+ / 取值 center/space-*/stretch / 替代 flex 垂直居中 / Footer 置底 / @supports 渐进增强降级）。CSS.supports() 检测属性支持，jsdom 不做真实布局但流程完整。',
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
        this._renderCard9(),
      ),

      this._renderLogPanel(),
    ];
  }
}
