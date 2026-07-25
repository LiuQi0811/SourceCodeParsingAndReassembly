// =====================================================================
// CSSShapesPage.js —— CSS Shapes Module Level 1 完整 实验室
// 演示 W3C CSS Shapes Module Level 1 文本环绕非矩形形状能力：
//   1. 概述与动机 —— 矩形排版局限 / 文本环绕非矩形形状需求（圆/多边形/图像）/
//      CSS Shapes Module Level 1 标准 / 浏览器支持 Chrome 37+/Firefox 62+/
//      Safari 11.1+ 全部稳定 / 与 clip-path 区别（shape-outside 影响布局，
//      clip-path 影响渲染）
//   2. shape-outside 基础 —— shape-outside: circle() / ellipse() / inset() /
//      polygon() / 紧贴浮动元素 / 必须配合 float / 与 margin-box 协同 /
//      内联内容围绕形状
//   3. circle() 与 ellipse() —— circle(50% at 50% 50%) /
//      circle(radius at cx cy) / ellipse(rx ry at cx cy) /
//      半径 closest-side/farthest-side / 圆心位置 / 单位
//   4. inset() 与 polygon() —— inset(10px round 20px) /
//      inset(top right bottom left round radius) /
//      polygon(0 0, 100% 0, 100% 100%, 0 100%) / 多边形顶点坐标 /
//      与 clip-path inset/polygon 共用语法
//   5. shape-margin 与 shape-image-threshold —— shape-margin: 20px 形状外边距 /
//      shape-image-threshold: 0.5 透明度阈值 / 与 PNG/Alpha 通道协同 /
//      形状边距与文字间距
//   6. 引用图像形状 —— shape-outside: url(image.png) / 形状由图像 Alpha 通道决定 /
//      shape-image-threshold 控制阈值 / 跨域图像限制 / 与 mask-image 区别
//   7. 实战：杂志式排版 —— 圆形头像文字环绕 / 多边形装饰元素环绕 /
//      不规则图像抠图环绕 / 与 float 协同 / 与 CSS Grid/Flexbox 协同
//      （Shapes 仅对浮动元素生效）
//   8. 陷阱与最佳实践 —— shape-outside 仅对浮动元素生效 / 必须设置 width/height /
//      形状参考盒模型（margin-box/border-box/padding-box/content-box）/
//      DevTools Shapes 编辑器 / 响应式适配 / 与 Writing Modes 协同 / 性能考虑
// 说明：所有特性调用前做 typeof / CSS.supports 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。jsdom 不做真实 CSS 渲染，
//       CSS.supports 通常可用；shape-outside / shape-margin / shape-image-threshold
//       现代浏览器全部稳定支持（Chrome 37+/Firefox 62+/Safari 11.1+）。
//       注入演示样式 + 完整代码示例，真实浏览器可查看文字环绕效果。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class CSSShapesPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      overviewInfo: '',        // Card 1：概述与动机
      shapeOutsideInfo: '',    // Card 2：shape-outside 基础
      circleInfo: '',          // Card 3：circle() 与 ellipse()
      insetPolygonInfo: '',    // Card 4：inset() 与 polygon()
      marginThresholdInfo: '', // Card 5：shape-margin 与 shape-image-threshold
      imageShapeInfo: '',      // Card 6：引用图像形状
      magazineInfo: '',        // Card 7：实战杂志式排版
      pitfallsInfo: '',        // Card 8：陷阱与最佳实践
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._dynamicStyles = [];     // 动态创建并插入 head 的 <style> 元素列表

    this._shapeOutsideMode = 'circle';       // Card 2 当前 shape-outside 形状
    this._circleMode = 'circle';             // Card 3 当前 circle/ellipse 模式
    this._circleRadius = '50%';              // Card 3 半径
    this._polygonMode = 'triangle';          // Card 4 当前多边形
    this._insetRound = '20px';               // Card 4 inset round
    this._shapeMargin = '20px';              // Card 5 shape-margin 值
    this._imageThreshold = '0.5';            // Card 5/6 shape-image-threshold
    this._boxModel = 'margin-box';           // Card 8 形状参考盒模型

    // 一次性能力检测：CSS Shapes 全家桶
    const f = this._flags();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `CSS ${c(f.css)}`,
      `supports ${c(f.supports)}`,
      `shape-outside:circle() ${c(f.circle)}`,
      `shape-outside:ellipse() ${c(f.ellipse)}`,
      `shape-outside:inset() ${c(f.inset)}`,
      `shape-outside:polygon() ${c(f.polygon)}`,
      `shape-margin ${c(f.shapeMargin)}`,
      `shape-image-threshold ${c(f.shapeImageThreshold)}`,
    ];

    const summary = f.css
      ? `CSS Shapes Module Level 1 能力检测：${parts.join(' · ')}。jsdom 不做真实 CSS 渲染，但 CSS.supports 通常可用；shape-outside / shape-margin / shape-image-threshold 现代浏览器全部稳定支持（Chrome 37+/Firefox 62+/Safari 11.1+）。按钮点击注入演示样式 + 完整代码示例，真实浏览器可查看文字环绕非矩形形状效果。`
      : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。';

    this.setState({ capsSummary: summary });
    this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.circle) this._addLog('warn', 'shape-outside: circle() 不可用或 jsdom 未识别（现代浏览器全支持：Chrome 37+/Firefox 62+/Safari 11.1+）');
    if (!f.polygon) this._addLog('warn', 'shape-outside: polygon() 不可用或 jsdom 未识别（现代浏览器全支持）');
    if (!f.shapeMargin) this._addLog('warn', 'shape-margin 不可用或 jsdom 未识别（现代浏览器全支持）');
    if (!f.shapeImageThreshold) this._addLog('warn', 'shape-image-threshold 不可用或 jsdom 未识别（现代浏览器全支持）');

    // 一次性注入全部演示样式（仅一次；rerender 不会移除 head 中的 style）
    this._injectDemoStyles();
  }

  componentWillUnmount() {
    this._destroyed = true;
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
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  // 返回布尔能力对象（供 capsSummary / 按钮 disabled 使用）
  // jsdom 不可用时 safe 返回 false，绝不抛异常
  _flags() {
    const safe = (fn) => { try { return fn(); } catch { return false; } };
    const hasCSS = safe(() => typeof CSS !== 'undefined');
    const supportsPV = (p, v) => {
      try { return hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v); }
      catch { return false; }
    };
    return {
      css: hasCSS,
      supports: hasCSS && safe(() => typeof CSS.supports === 'function'),
      circle: safe(() => typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('shape-outside', 'circle()')),
      ellipse: safe(() => typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('shape-outside', 'ellipse()')),
      inset: safe(() => typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('shape-outside', 'inset(10px round 20px)')),
      polygon: safe(() => typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('shape-outside', 'polygon(0 0, 100% 0, 100% 100%, 0 100%)')),
      shapeMargin: safe(() => typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('shape-margin', '20px')),
      shapeImageThreshold: safe(() => typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('shape-image-threshold', '0.5')),
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

  // —— 动态注入所有演示样式 ——
  _injectDemoStyles() {
    this._injectStyle('css-shapes-demo', `
      /* ===== 通用 Shapes 舞台 ===== */
      .shapes-stage {
        margin-top: 10px;
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        overflow: hidden;
        min-height: 200px;
      }
      /* ===== Card 2：shape-outside 基础 ===== */
      .shapes-stage .so-basic-text {
        font-size: 14px;
        line-height: 1.8;
        color: #334155;
        text-align: justify;
      }
      .shapes-stage .so-basic-shape {
        float: left;
        width: 120px;
        height: 120px;
        margin: 8px 12px 8px 0;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        border-radius: 50%;
        shape-outside: circle();
      }
      /* ===== Card 3：circle/ellipse ===== */
      .shapes-stage .so-circle {
        float: left;
        width: 140px;
        height: 140px;
        margin: 8px 12px 8px 0;
        background: #dbeafe;
        border: 2px solid #3b82f6;
        border-radius: 50%;
        shape-outside: circle(50% at 50% 50%);
      }
      .shapes-stage .so-ellipse {
        float: left;
        width: 180px;
        height: 100px;
        margin: 8px 12px 8px 0;
        background: #fef3c7;
        border: 2px solid #f59e0b;
        border-radius: 50%;
        shape-outside: ellipse(50% 50% at 50% 50%);
      }
      /* ===== Card 4：inset/polygon ===== */
      .shapes-stage .so-inset {
        float: left;
        width: 140px;
        height: 140px;
        margin: 8px 12px 8px 0;
        background: #dcfce7;
        border: 2px solid #10b981;
        shape-outside: inset(10px round 20px);
      }
      .shapes-stage .so-polygon {
        float: left;
        width: 140px;
        height: 140px;
        margin: 8px 12px 8px 0;
        background: #ede9fe;
        border: 2px solid #8b5cf6;
        clip-path: polygon(50% 0, 100% 100%, 0 100%);
        shape-outside: polygon(50% 0, 100% 100%, 0 100%);
      }
      .shapes-stage .so-polygon-diamond {
        float: left;
        width: 140px;
        height: 140px;
        margin: 8px 12px 8px 0;
        background: #fee2e2;
        border: 2px solid #ef4444;
        clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
        shape-outside: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
      }
      /* ===== Card 5：shape-margin / shape-image-threshold ===== */
      .shapes-stage .so-margin {
        float: left;
        width: 120px;
        height: 120px;
        margin: 8px 12px 8px 0;
        background: #e0e7ff;
        border: 2px solid #6366f1;
        border-radius: 50%;
        shape-outside: circle();
        shape-margin: 20px;
      }
      .shapes-stage .so-margin-text {
        font-size: 13px;
        line-height: 1.8;
        color: #312e81;
      }
      /* ===== Card 7：杂志式排版 ===== */
      .magazine-stage {
        margin-top: 10px;
        padding: 16px;
        background: #fffbeb;
        border: 1px solid #fbbf24;
        border-radius: 8px;
      }
      .magazine-stage .avatar {
        float: left;
        width: 100px;
        height: 100px;
        margin: 6px 14px 6px 0;
        background: linear-gradient(135deg, #f59e0b, #ef4444);
        border-radius: 50%;
        shape-outside: circle();
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 36px;
        font-weight: 700;
      }
      .magazine-stage .article {
        font-size: 14px;
        line-height: 1.9;
        color: #78350f;
        text-align: justify;
      }
      .magazine-stage .decor-polygon {
        float: right;
        width: 100px;
        height: 100px;
        margin: 6px 0 6px 14px;
        background: linear-gradient(135deg, #8b5cf6, #ec4899);
        clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
        shape-outside: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
      }
      /* ===== Card 8：盒模型示意 ===== */
      .boxmodel-stage {
        margin-top: 10px;
        padding: 16px;
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
      }
      .boxmodel-stage .bm-box {
        position: relative;
        width: 200px;
        height: 120px;
        margin: 20px;
        padding: 20px;
        border: 8px solid #3b82f6;
        background: #dbeafe;
        border-radius: 4px;
      }
      .boxmodel-stage .bm-label {
        position: absolute;
        font-size: 11px;
        color: #1e3a8a;
        font-family: monospace;
      }
      .boxmodel-stage .bm-margin { top: -16px; left: 0; }
      .boxmodel-stage .bm-border { top: 4px; left: 4px; }
      .boxmodel-stage .bm-padding { top: 16px; left: 16px; }
      .boxmodel-stage .bm-content { top: 32px; left: 32px; }
      /* ===== 输出区 ===== */
      .shapes-output {
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

  // =================== Card 1：概述与动机 ===================

  _readOverviewInfo() {
    const f = this._flags();
    try {
      return `===== CSS Shapes Module Level 1 概述 =====\n` +
        `\n` +
        `【规范归属】\n` +
        `  CSS Shapes Module Level 1 由 W3C CSS Working Group 制定\n` +
        `  规范地址：https://www.w3.org/TR/css-shapes-1/\n` +
        `  状态：Candidate Recommendation（稳定）\n` +
        `\n` +
        `【动机：矩形排版局限】\n` +
        `  传统 CSS 排版基于矩形盒模型，文本只能环绕矩形：\n` +
        `    float: left 的元素是矩形，文字环绕其矩形边界\n` +
        `    无法实现杂志风格的圆形头像环绕、多边形装饰环绕\n` +
        `    无法基于图像 Alpha 通道抠图环绕\n` +
        `  杂志/书籍排版需求：\n` +
        `    圆形头像 + 文字环绕\n` +
        `    不规则形状装饰 + 文字穿插\n` +
        `    图像抠图（如人物剪影）+ 文字环绕\n` +
        `\n` +
        `【CSS Shapes 提供】\n` +
        `  shape-outside —— 定义浮动元素外部的环绕形状\n` +
        `  shape-margin —— 形状外边距（文字与形状的最小距离）\n` +
        `  shape-image-threshold —— 图像形状的 Alpha 阈值\n` +
        `  形状函数：circle() / ellipse() / inset() / polygon()\n` +
        `  形状来源：基本形状函数 / 图像 url() / 盒模型（margin-box 等）\n` +
        `\n` +
        `【与 clip-path 区别】\n` +
        `  shape-outside：影响布局（决定内联内容如何环绕）\n` +
        `    只对浮动元素（float 非 none）生效\n` +
        `    改变的是文字流的环绕路径，不改变元素本身渲染\n` +
        `  clip-path：影响渲染（裁剪元素可见区域）\n` +
        `    对任意元素生效\n` +
        `    改变的是元素显示形状，不影响文字流\n` +
        `  两者常配合使用：shape-outside 定义环绕 + clip-path 裁剪视觉\n` +
        `\n` +
        `【浏览器支持】\n` +
        `  Chrome 37+（2014.08）—— 首次支持\n` +
        `  Edge 79+（Chromium 内核）\n` +
        `  Firefox 62+（2018.09）\n` +
        `  Safari 11.1+（2018.03）\n` +
        `  全部现代浏览器稳定支持\n` +
        `  jsdom —— 不做真实 CSS 渲染，CSS.supports 通常可用\n` +
        `\n` +
        `【能力检测】\n` +
        `  CSS.supports('shape-outside','circle()') = ${f.circle}\n` +
        `  CSS.supports('shape-outside','ellipse()') = ${f.ellipse}\n` +
        `  CSS.supports('shape-outside','inset(10px round 20px)') = ${f.inset}\n` +
        `  CSS.supports('shape-outside','polygon(0 0, 100% 0, 100% 100%, 0 100%)') = ${f.polygon}\n` +
        `  CSS.supports('shape-margin','20px') = ${f.shapeMargin}\n` +
        `  CSS.supports('shape-image-threshold','0.5') = ${f.shapeImageThreshold}\n` +
        `\n` +
        `【核心限制】\n` +
        `  ⚠ shape-outside 仅对浮动元素（float: left/right）生效\n` +
        `  ⚠ 浮动元素必须设置 width/height（否则无尺寸参考）\n` +
        `  ⚠ 不影响 flex/grid 子项（仅 float 生效）\n` +
        `  ⚠ shape-outside 定义外部环绕，shape-inside 未纳入 Level 1`;
    } catch (err) {
      return `读取 CSS Shapes 概述信息失败：${err.name} - ${err.message}`;
    }
  }

  _runOverviewDemo() {
    this.setState({ overviewInfo: this._readOverviewInfo() });
    const f = this._flags();
    this._addLog('info', `CSS Shapes 概述演示：circle=${f.circle}, polygon=${f.polygon}, shape-margin=${f.shapeMargin}`);
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. 概述与动机 —— 矩形排版局限 / CSS Shapes Level 1',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['shape-outside', f.circle],
          ['shape-margin', f.shapeMargin],
          ['shape-image-threshold', f.shapeImageThreshold],
        ]),
        h(Tag, { color: 'success' }, '全部稳定'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'CSS Shapes Module Level 1（W3C CR 稳定）弥补传统矩形排版局限，允许文本环绕非矩形形状（圆/椭圆/多边形/图像 Alpha 抠图）。提供 shape-outside（定义浮动元素外部环绕形状）、shape-margin（形状外边距）、shape-image-threshold（图像 Alpha 阈值）。与 clip-path 区别：shape-outside 影响布局（文字环绕路径），clip-path 影响渲染（元素可见区域），两者常配合使用。浏览器支持全部稳定（Chrome 37+/Firefox 62+/Safari 11.1+）。核心限制：仅对浮动元素（float 非 none）生效，必须设置 width/height，不影响 flex/grid 子项。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取概述信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runOverviewDemo() }),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.overviewInfo || '（点击「读取概述信息」查看 CSS Shapes Module Level 1 全景）')),
        h(Alert, {
          type: 'info',
          message: 'shape-outside 影响布局（文字环绕），clip-path 影响渲染（元素可见）',
          description: 'shape-outside 定义浮动元素外部环绕形状，决定内联内容如何环绕，不改变元素本身渲染。clip-path 裁剪元素可见区域，不影响文字流。两者常配合：shape-outside 定义环绕 + clip-path 裁剪视觉一致。核心限制：shape-outside 仅对 float 非 none 元素生效，必须设 width/height，不影响 flex/grid 子项。shape-inside 未纳入 Level 1。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：shape-outside 基础 ===================

  _readShapeOutsideInfo() {
    const f = this._flags();
    try {
      const stage = this.el && this.el.querySelector('.shapes-stage .so-basic-shape');
      let computed = '(未渲染)';
      if (stage) {
        computed = window.getComputedStyle(stage).getPropertyValue('shape-outside') || '(空)';
      }
      return `===== shape-outside 基础 =====\n` +
        `\n` +
        `【语法】\n` +
        `  shape-outside: none | [ <basic-shape> || <shape-box> ] | <image>\n` +
        `  <basic-shape>: circle() | ellipse() | inset() | polygon()\n` +
        `  <shape-box>: margin-box | border-box | padding-box | content-box\n` +
        `  <image>: url(image.png) | gradient 等\n` +
        `\n` +
        `【基本形状函数】\n` +
        `  circle()      —— 圆形\n` +
        `  ellipse()     —— 椭圆\n` +
        `  inset()       —— 矩形（可带圆角）\n` +
        `  polygon()     —— 多边形（任意顶点）\n` +
        `\n` +
        `【必须配合 float】\n` +
        `  ⚠ shape-outside 仅对浮动元素（float: left | right）生效\n` +
        `  float: none 的元素设置 shape-outside 无效\n` +
        `  flex/grid 子项不浮动，shape-outside 无效\n` +
        `  常见组合：\n` +
        `    .float-shape {\n` +
        `      float: left;\n` +
        `      width: 200px;\n` +
        `      height: 200px;\n` +
        `      shape-outside: circle();\n` +
        `    }\n` +
        `\n` +
        `【与 margin-box 协同】\n` +
        `  默认形状参考 margin-box（含 margin 的外边界）\n` +
        `  可显式指定：\n` +
        `    shape-outside: circle() margin-box;\n` +
        `    shape-outside: margin-box;  /* 直接用 margin-box 作为形状 */\n` +
        `  其他盒模型：border-box / padding-box / content-box\n` +
        `\n` +
        `【内联内容围绕形状】\n` +
        `  shape-outside 定义的形状决定后续内联内容（文字）的环绕路径\n` +
        `  文字会避开形状区域，沿形状边界流动\n` +
        `  仅影响同一 BFC 内、浮动元素之后的内联内容\n` +
        `\n` +
        `【当前演示元素】\n` +
        `  .so-basic-shape {\n` +
        `    float: left;\n` +
        `    width: 120px; height: 120px;\n` +
        `    shape-outside: circle();\n` +
        `    border-radius: 50%;\n` +
        `  }\n` +
        `  shape-outside 计算值="${computed}"\n` +
        `  CSS.supports('shape-outside','circle()') = ${f.circle}\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  <style>\n` +
        `    .article-with-circle {\n` +
        `      float: left;\n` +
        `      width: 200px;\n` +
        `      height: 200px;\n` +
        `      margin: 10px;\n` +
        `      background: linear-gradient(135deg, #3b82f6, #8b5cf6);\n` +
        `      border-radius: 50%;           /* 视觉为圆 */\n` +
        `      shape-outside: circle();       /* 文字环绕圆 */\n` +
        `    }\n` +
        `  </style>\n` +
        `  <div class="article-with-circle"></div>\n` +
        `  <p>这段文字会环绕上方的圆形浮动元素，沿圆形边界流动，\n` +
        `    实现杂志风格的排版效果。</p>`;
    } catch (err) {
      return `读取 shape-outside 基础信息失败：${err.name} - ${err.message}`;
    }
  }

  _runShapeOutsideDemo() {
    this.setState({ shapeOutsideInfo: this._readShapeOutsideInfo() });
    const f = this._flags();
    this._addLog('info', `shape-outside 基础演示：circle=${f.circle}（真实浏览器可见文字环绕圆形）`);
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. shape-outside 基础 —— circle/ellipse/inset/polygon + float',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['shape-outside', f.circle],
          ['float 协同', true],
        ]),
        h(Tag, { color: 'primary' }, '必须配合 float'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'shape-outside 定义浮动元素外部环绕形状，取值：none | [ <basic-shape> || <shape-box> ] | <image>。basic-shape 含 circle()/ellipse()/inset()/polygon()，shape-box 含 margin-box/border-box/padding-box/content-box，image 为 url() 或 gradient。⚠ 必须配合 float: left/right（float: none 无效，flex/grid 子项不浮动无效）。默认参考 margin-box，可显式 shape-outside: circle() margin-box。决定后续内联内容环绕路径，文字沿形状边界流动。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 shape-outside 演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runShapeOutsideDemo() }),
        ),
        h('div', { class: 'shapes-stage' },
          h('div', { class: 'so-basic-shape' }),
          h('div', { class: 'so-basic-text' },
            '这是一段演示文字，会环绕左侧的圆形浮动元素。CSS Shapes Module Level 1 让 Web 排版突破矩形限制，文字可以沿圆形、椭圆、多边形或图像 Alpha 通道的形状边界流动，实现杂志风格的精美排版。真实浏览器中可看到文字沿圆形边界流动的效果（jsdom 不做真实布局）。shape-outside 必须配合 float 使用，仅对浮动元素生效。'),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.shapeOutsideInfo || '（点击「运行 shape-outside 演示」查看完整说明）')),
        h(Alert, {
          type: 'warning',
          message: 'shape-outside 仅对 float 非 none 元素生效',
          description: 'float: none 的元素 shape-outside 无效；flex/grid 子项不浮动也无效。必须 float: left/right + 设置 width/height。常见组合：float: left + shape-outside: circle() + border-radius: 50%（视觉与环绕一致）。默认参考 margin-box，可显式指定其他盒模型。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：circle() 与 ellipse() ===================

  _readCircleInfo() {
    const f = this._flags();
    try {
      const stage = this.el && this.el.querySelector('.shapes-stage .so-circle');
      let computed = '(未渲染)';
      if (stage) {
        computed = window.getComputedStyle(stage).getPropertyValue('shape-outside') || '(空)';
      }
      return `===== circle() 与 ellipse() =====\n` +
        `\n` +
        `【circle() 语法】\n` +
        `  circle( [<shape-radius>] [at <position>] )\n` +
        `  <shape-radius>: <length> | <percentage> | closest-side | farthest-side\n` +
        `  <position>: <length> | <percentage> | left | center | right | top | bottom\n` +
        `\n` +
        `【circle() 取值】\n` +
        `  circle()                      —— 默认 circle(closest-side at center)\n` +
        `  circle(50%)                   —— 半径 50%（相对参考盒较短边）\n` +
        `  circle(50px)                  —— 半径 50px\n` +
        `  circle(50% at 50% 50%)        —— 半径 50%，圆心在中心\n` +
        `  circle(50px at 30px 30px)     —— 半径 50px，圆心 (30px, 30px)\n` +
        `  circle(closest-side at 50% 50%)  —— 半径到最近边\n` +
        `  circle(farthest-side at 50% 50%) —— 半径到最远边\n` +
        `\n` +
        `【closest-side / farthest-side】\n` +
        `  closest-side   —— 圆心到最近边的距离作为半径\n` +
        `  farthest-side  —— 圆心到最远边的距离作为半径\n` +
        `  示例：100x100 盒，圆心 (50,50)\n` +
        `    closest-side  = 50（到任意边）\n` +
        `    farthest-side = 50（同上，正方形）\n` +
        `  示例：200x100 盒，圆心 (100,50)\n` +
        `    closest-side  = 50（到上下边）\n` +
        `    farthest-side = 100（到左右边）\n` +
        `\n` +
        `【ellipse() 语法】\n` +
        `  ellipse( [<shape-radius>{2}] [at <position>] )\n` +
        `  两个半径：rx（水平）ry（垂直）\n` +
        `\n` +
        `【ellipse() 取值】\n` +
        `  ellipse()                     —— 默认 ellipse(closest-side closest-side at center)\n` +
        `  ellipse(50% 50% at 50% 50%)   —— rx=50%, ry=50%, 圆心中心\n` +
        `  ellipse(80px 40px at 50% 50%) —— rx=80px, ry=40px\n` +
        `  ellipse(closest-side farthest-side at 50% 50%)\n` +
        `\n` +
        `【圆心 position】\n` +
        `  at <length>    —— at 30px 40px（绝对位置）\n` +
        `  at <percentage> —— at 50% 50%（相对参考盒）\n` +
        `  at left top    —— at 0% 0%\n` +
        `  at center      —— at 50% 50%（默认）\n` +
        `  at right bottom —— at 100% 100%\n` +
        `\n` +
        `【单位】\n` +
        `  <length>: px, em, rem, vw, vh 等\n` +
        `  <percentage>: 相对参考盒尺寸（circle 相对较短边，ellipse rx 相对宽 ry 相对高）\n` +
        `\n` +
        `【当前演示】\n` +
        `  模式 = '${this._circleMode}'\n` +
        `  半径 = '${this._circleRadius}'\n` +
        `  .so-circle shape-outside 计算值="${computed}"\n` +
        `  CSS.supports('shape-outside','circle()') = ${f.circle}\n` +
        `  CSS.supports('shape-outside','ellipse()') = ${f.ellipse}\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  .circle-shape {\n` +
        `    float: left;\n` +
        `    width: 200px; height: 200px;\n` +
        `    shape-outside: circle(50% at 50% 50%);\n` +
        `    border-radius: 50%;\n` +
        `  }\n` +
        `  .ellipse-shape {\n` +
        `    float: left;\n` +
        `    width: 240px; height: 160px;\n` +
        `    shape-outside: ellipse(50% 50% at 50% 50%);\n` +
        `    border-radius: 50%;\n` +
        `  }\n` +
        `  .offset-circle {\n` +
        `    float: left;\n` +
        `    width: 200px; height: 200px;\n` +
        `    shape-outside: circle(50px at 30px 30px);  /* 小圆偏左上 */\n` +
        `  }`;
    } catch (err) {
      return `读取 circle/ellipse 信息失败：${err.name} - ${err.message}`;
    }
  }

  _setCircleMode(mode) {
    this._circleMode = mode;
    if (mode === 'circle') {
      this._injectStyle('css-shapes-circle-dynamic',
        `.shapes-stage .so-circle { shape-outside: circle(${this._circleRadius} at 50% 50%); }` +
        `.shapes-stage .so-ellipse { display: none; }`);
    } else {
      this._injectStyle('css-shapes-circle-dynamic',
        `.shapes-stage .so-ellipse { shape-outside: ellipse(50% 50% at 50% 50%); display: block; }` +
        `.shapes-stage .so-circle { display: none; }`);
    }
    this.setState({ circleInfo: this._readCircleInfo() });
    this._addLog('info', `切换 circle/ellipse 模式 → ${mode}（半径=${this._circleRadius}）`);
  }

  _setCircleRadius(radius) {
    this._circleRadius = radius;
    if (this._circleMode === 'circle') {
      this._injectStyle('css-shapes-circle-dynamic',
        `.shapes-stage .so-circle { shape-outside: circle(${radius} at 50% 50%); }`);
    }
    this.setState({ circleInfo: this._readCircleInfo() });
    this._addLog('info', `切换半径 → ${radius}`);
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. circle() 与 ellipse() —— 半径 closest-side/farthest-side',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['circle()', f.circle], ['ellipse()', f.ellipse]]),
        h(Tag, { color: 'primary' }, '圆/椭圆'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'circle([radius] [at position])：radius 支持 <length>/<percentage>/closest-side（圆心到最近边）/farthest-side（到最远边），position 支持 <length>/<percentage>/left|center|right|top|bottom。默认 circle(closest-side at center)。ellipse(rx ry [at position]) 两个半径 rx 水平 ry 垂直。percentage 相对参考盒（circle 相对较短边，ellipse rx 相对宽 ry 相对高）。circle(50% at 50% 50%) 是常见完整写法。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ circleInfo: this._readCircleInfo() }) }),
          this._btn('circle()', { size: 'sm', disabled: !f.circle, onClick: () => this._setCircleMode('circle') }),
          this._btn('ellipse()', { size: 'sm', disabled: !f.ellipse, onClick: () => this._setCircleMode('ellipse') }),
          this._btn('半径 50%', { size: 'sm', disabled: !f.circle, onClick: () => this._setCircleRadius('50%') }),
          this._btn('closest-side', { size: 'sm', disabled: !f.circle, onClick: () => this._setCircleRadius('closest-side') }),
          this._btn('farthest-side', { size: 'sm', disabled: !f.circle, onClick: () => this._setCircleRadius('farthest-side') }),
        ),
        h('div', { class: 'shapes-stage' },
          h('div', { class: 'so-circle' }),
          h('div', { class: 'so-ellipse', style: { display: this._circleMode === 'ellipse' ? 'block' : 'none' } }),
          h('div', { class: 'so-basic-text' },
            'circle() 与 ellipse() 演示文字。当前模式：' + this._circleMode + '，半径：' + this._circleRadius + '。真实浏览器中文字会沿圆形或椭圆边界流动。circle(50% at 50% 50%) 是最常见的圆形环绕写法，ellipse(50% 50% at 50% 50%) 用于椭圆。closest-side 和 farthest-side 是相对参考盒的智能半径，适合响应式布局。'),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.circleInfo || '（点击按钮切换 circle/ellipse 与半径）')),
        h(Alert, {
          type: 'info',
          message: 'circle(50% at 50% 50%) 是常见完整写法',
          description: 'radius 支持 closest-side（圆心到最近边）/farthest-side（到最远边），适合响应式（无需计算精确尺寸）。percentage 相对参考盒：circle 相对较短边，ellipse rx 相对宽 ry 相对高。position 默认 center（50% 50%），可 at 30px 30px 偏移圆心。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：inset() 与 polygon() ===================

  _readInsetPolygonInfo() {
    const f = this._flags();
    try {
      const insetEl = this.el && this.el.querySelector('.shapes-stage .so-inset');
      let insetComputed = '(未渲染)';
      if (insetEl) {
        insetComputed = window.getComputedStyle(insetEl).getPropertyValue('shape-outside') || '(空)';
      }
      return `===== inset() 与 polygon() =====\n` +
        `\n` +
        `【inset() 语法】\n` +
        `  inset( <length-percentage>{1,4} [round <border-radius>] )\n` +
        `  1-4 个边距值（同 margin/padding 语法）+ 可选 round 圆角\n` +
        `\n` +
        `【inset() 取值】\n` +
        `  inset(10px)                 —— 四边内缩 10px\n` +
        `  inset(10px 20px)            —— 上下 10px，左右 20px\n` +
        `  inset(10px 20px 30px 40px)  —— 上右下左\n` +
        `  inset(10px round 20px)      —— 内缩 10px，圆角 20px\n` +
        `  inset(10px round 20px 40px) —— 内缩 10px，圆角左上右下 20px 左下右上 40px\n` +
        `  inset(0 round 50%)          —— 无内缩，圆角 50%（圆形）\n` +
        `\n` +
        `【inset() 应用】\n` +
        `  适合矩形带圆角的环绕（如圆角卡片）\n` +
        `  与 border-radius 配合可实现圆形/胶囊形\n` +
        `  inset(0 round 50%) 等价 circle(50%)\n` +
        `\n` +
        `【polygon() 语法】\n` +
        `  polygon( [<fill-rule>,] [<shape-arg> <shape-arg>]# )\n` +
        `  <shape-arg>: <length> | <percentage>\n` +
        `  至少 3 个顶点（x y 对）\n` +
        `  <fill-rule>: nonzero（默认） | evenodd\n` +
        `\n` +
        `【polygon() 取值】\n` +
        `  polygon(0 0, 100% 0, 100% 100%, 0 100%)  —— 矩形（4 顶点）\n` +
        `  polygon(50% 0, 100% 100%, 0 100%)        —— 三角形\n` +
        `  polygon(50% 0, 100% 50%, 50% 100%, 0 50%) —— 菱形\n` +
        `  polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%) —— 五角星\n` +
        `\n` +
        `【多边形顶点坐标】\n` +
        `  坐标原点在参考盒左上角\n` +
        `  x 向右增，y 向下增\n` +
        `  <percentage> 相对参考盒宽/高\n` +
        `  <length> 绝对值\n` +
        `  顶点顺序：通常逆时针或顺时针均可（fill-rule 决定填充）\n` +
        `\n` +
        `【与 clip-path inset/polygon 共用语法】\n` +
        `  inset() 和 polygon() 语法在 shape-outside 和 clip-path 完全相同\n` +
        `  常配合使用让视觉与环绕一致：\n` +
        `    .star {\n` +
        `      float: left;\n` +
        `      width: 200px; height: 200px;\n` +
        `      background: gold;\n` +
        `      clip-path: polygon(50% 0, 61% 35%, 98% 35%, ...);\n` +
        `      shape-outside: polygon(50% 0, 61% 35%, 98% 35%, ...);\n` +
        `    }\n` +
        `\n` +
        `【当前演示】\n` +
        `  多边形模式 = '${this._polygonMode}'\n` +
        `  inset round = '${this._insetRound}'\n` +
        `  .so-inset shape-outside 计算值="${insetComputed}"\n` +
        `  CSS.supports('shape-outside','inset(10px round 20px)') = ${f.inset}\n` +
        `  CSS.supports('shape-outside','polygon(...)') = ${f.polygon}\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  .inset-rounded {\n` +
        `    float: left;\n` +
        `    width: 200px; height: 150px;\n` +
        `    shape-outside: inset(10px round 20px);\n` +
        `    border-radius: 20px;\n` +
        `  }\n` +
        `  .triangle {\n` +
        `    float: left;\n` +
        `    width: 200px; height: 200px;\n` +
        `    background: #8b5cf6;\n` +
        `    clip-path: polygon(50% 0, 100% 100%, 0 100%);\n` +
        `    shape-outside: polygon(50% 0, 100% 100%, 0 100%);\n` +
        `  }\n` +
        `  .diamond {\n` +
        `    float: left;\n` +
        `    width: 200px; height: 200px;\n` +
        `    background: #ef4444;\n` +
        `    clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);\n` +
        `    shape-outside: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);\n` +
        `  }`;
    } catch (err) {
      return `读取 inset/polygon 信息失败：${err.name} - ${err.message}`;
    }
  }

  _setPolygonMode(mode) {
    this._polygonMode = mode;
    if (mode === 'triangle') {
      this._injectStyle('css-shapes-polygon-dynamic',
        `.shapes-stage .so-polygon { display: block; clip-path: polygon(50% 0, 100% 100%, 0 100%); shape-outside: polygon(50% 0, 100% 100%, 0 100%); }` +
        `.shapes-stage .so-polygon-diamond { display: none; }`);
    } else if (mode === 'diamond') {
      this._injectStyle('css-shapes-polygon-dynamic',
        `.shapes-stage .so-polygon-diamond { display: block; clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); shape-outside: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }` +
        `.shapes-stage .so-polygon { display: none; }`);
    } else if (mode === 'inset') {
      this._injectStyle('css-shapes-polygon-dynamic',
        `.shapes-stage .so-inset { shape-outside: inset(10px round ${this._insetRound}); display: block; }` +
        `.shapes-stage .so-polygon { display: none; }` +
        `.shapes-stage .so-polygon-diamond { display: none; }`);
    }
    this.setState({ insetPolygonInfo: this._readInsetPolygonInfo() });
    this._addLog('info', `切换多边形模式 → ${mode}`);
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. inset() 与 polygon() —— 矩形圆角/多边形顶点',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['inset()', f.inset], ['polygon()', f.polygon]]),
        h(Tag, { color: 'primary' }, '与 clip-path 共用'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'inset(边距 [round 圆角])：1-4 个边距值（同 margin 语法）+ 可选 round 圆角。inset(10px round 20px) 内缩 10px 圆角 20px，inset(0 round 50%) 等价 circle(50%)。polygon(顶点列表)：至少 3 个 x y 顶点对，坐标原点参考盒左上角，percentage 相对宽/高。polygon(50% 0, 100% 100%, 0 100%) 三角形，polygon(50% 0, 100% 50%, 50% 100%, 0 50%) 菱形。inset()/polygon() 语法在 shape-outside 和 clip-path 完全相同，常配合让视觉与环绕一致。fill-rule: nonzero（默认）/evenodd。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ insetPolygonInfo: this._readInsetPolygonInfo() }) }),
          this._btn('inset 圆角', { size: 'sm', disabled: !f.inset, onClick: () => this._setPolygonMode('inset') }),
          this._btn('三角形', { size: 'sm', disabled: !f.polygon, onClick: () => this._setPolygonMode('triangle') }),
          this._btn('菱形', { size: 'sm', disabled: !f.polygon, onClick: () => this._setPolygonMode('diamond') }),
        ),
        h('div', { class: 'shapes-stage' },
          h('div', { class: 'so-inset', style: { display: this._polygonMode === 'inset' ? 'block' : 'none' } }),
          h('div', { class: 'so-polygon', style: { display: this._polygonMode === 'triangle' ? 'block' : 'none' } }),
          h('div', { class: 'so-polygon-diamond', style: { display: this._polygonMode === 'diamond' ? 'block' : 'none' } }),
          h('div', { class: 'so-basic-text' },
            'inset() 与 polygon() 演示文字。当前模式：' + this._polygonMode + '。真实浏览器中文字会沿矩形圆角、三角形或菱形边界流动。inset(10px round 20px) 适合圆角卡片环绕，polygon() 适合任意多边形装饰环绕。与 clip-path 共用语法，常配合使用让视觉裁剪与文字环绕一致。'),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.insetPolygonInfo || '（点击按钮切换 inset/三角形/菱形）')),
        h(Alert, {
          type: 'info',
          message: 'inset()/polygon() 语法在 shape-outside 和 clip-path 完全相同',
          description: '常配合使用：clip-path 裁剪视觉 + shape-outside 定义环绕，两者用相同 polygon() 让视觉与文字流一致。inset(0 round 50%) 等价 circle(50%)。polygon 顶点坐标原点在参考盒左上角，percentage 相对宽/高。fill-rule: nonzero（默认）/evenodd 影响自相交多边形填充。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：shape-margin 与 shape-image-threshold ===================

  _readMarginThresholdInfo() {
    const f = this._flags();
    try {
      const marginEl = this.el && this.el.querySelector('.shapes-stage .so-margin');
      let marginComputed = '(未渲染)';
      if (marginEl) {
        marginComputed = window.getComputedStyle(marginEl).getPropertyValue('shape-margin') || '(空)';
      }
      return `===== shape-margin 与 shape-image-threshold =====\n` +
        `\n` +
        `【shape-margin 形状外边距】\n` +
        `  shape-margin: <length-percentage>\n` +
        `  定义形状外边距：文字与形状边界的最小距离\n` +
        `  类似 margin 但作用于形状边界而非盒边界\n` +
        `\n` +
        `【shape-margin 取值】\n` +
        `  shape-margin: 20px       —— 文字距形状 20px\n` +
        `  shape-margin: 1em        —— 相对字号\n` +
        `  shape-margin: 5%         —— 相对参考盒宽度\n` +
        `  shape-margin: 0          —— 无外边距（默认）\n` +
        `\n` +
        `【shape-margin 效果】\n` +
        `  文字不紧贴形状边界，留出呼吸空间\n` +
        `  提升可读性（避免文字与形状重叠）\n` +
        `  与 margin 区别：\n` +
        `    margin —— 盒模型外边距（矩形）\n` +
        `    shape-margin —— 形状边界外边距（跟随形状轮廓）\n` +
        `  示例：圆形 shape-outside + shape-margin: 20px\n` +
        `    文字沿圆形外 20px 的同心圆流动\n` +
        `\n` +
        `【shape-image-threshold 透明度阈值】\n` +
        `  shape-image-threshold: <number>\n` +
        `  0.0 ~ 1.0，定义图像形状的 Alpha 阈值\n` +
        `  仅对 shape-outside: url(image) 生效\n` +
        `  像素 Alpha ≥ 阈值 → 形状内（文字避开）\n` +
        `  像素 Alpha < 阈值 → 形状外（文字可流入）\n` +
        `\n` +
        `【shape-image-threshold 取值】\n` +
        `  shape-image-threshold: 0.0   —— 仅完全不透明像素为形状（默认）\n` +
        `  shape-image-threshold: 0.5   —— Alpha ≥ 0.5 的像素为形状\n` +
        `  shape-image-threshold: 1.0   —— 所有像素为形状（含完全透明）\n` +
        `\n` +
        `【与 PNG/Alpha 通道协同】\n` +
        `  shape-outside: url(avatar.png) 配合 PNG Alpha 通道：\n` +
        `    PNG 透明区域 → Alpha = 0 → 形状外（文字流入）\n` +
        `    PNG 不透明区域 → Alpha = 1 → 形状内（文字避开）\n` +
        `  shape-image-threshold 控制阈值：\n` +
        `    0.0：仅完全不透明部分为形状\n` +
        `    0.5：半透明以上为形状（适合抗锯齿边缘）\n` +
        `\n` +
        `【形状边距与文字间距】\n` +
        `  shape-margin 控制文字与形状的距离\n` +
        `  文字内部间距由 line-height / letter-spacing 控制\n` +
        `  两者协同决定整体排版密度\n` +
        `\n` +
        `【当前演示】\n` +
        `  shape-margin = '${this._shapeMargin}'\n` +
        `  shape-image-threshold = '${this._imageThreshold}'\n` +
        `  .so-margin shape-margin 计算值="${marginComputed}"\n` +
        `  CSS.supports('shape-margin','20px') = ${f.shapeMargin}\n` +
        `  CSS.supports('shape-image-threshold','0.5') = ${f.shapeImageThreshold}\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  .shape-with-margin {\n` +
        `    float: left;\n` +
        `    width: 200px; height: 200px;\n` +
        `    shape-outside: circle();\n` +
        `    shape-margin: 20px;          /* 文字距圆形 20px */\n` +
        `    border-radius: 50%;\n` +
        `  }\n` +
        `  .image-shape {\n` +
        `    float: left;\n` +
        `    width: 200px; height: 200px;\n` +
        `    shape-outside: url(avatar.png);\n` +
        `    shape-image-threshold: 0.5;  /* Alpha ≥ 0.5 为形状 */\n` +
        `    shape-margin: 10px;\n` +
        `  }`;
    } catch (err) {
      return `读取 shape-margin/threshold 信息失败：${err.name} - ${err.message}`;
    }
  }

  _setShapeMargin(value) {
    this._shapeMargin = value;
    this._injectStyle('css-shapes-margin-dynamic',
      `.shapes-stage .so-margin { shape-margin: ${value}; }`);
    this.setState({ marginThresholdInfo: this._readMarginThresholdInfo() });
    this._addLog('info', `切换 shape-margin → ${value}`);
  }

  _setImageThreshold(value) {
    this._imageThreshold = value;
    this.setState({ marginThresholdInfo: this._readMarginThresholdInfo() });
    this._addLog('info', `切换 shape-image-threshold → ${value}`);
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. shape-margin 与 shape-image-threshold',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['shape-margin', f.shapeMargin], ['shape-image-threshold', f.shapeImageThreshold]]),
        h(Tag, { color: 'primary' }, 'Alpha 阈值'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'shape-margin: <length-percentage> 定义形状外边距（文字与形状边界最小距离，跟随形状轮廓非矩形）。shape-margin: 20px 让文字距圆形 20px 流动。shape-image-threshold: <number>（0.0-1.0）定义图像形状 Alpha 阈值，仅对 shape-outside: url(image) 生效。像素 Alpha ≥ 阈值为形状内（文字避开），< 阈值为形状外（文字流入）。0.0 默认（仅完全不透明），0.5 适合抗锯齿边缘。与 PNG Alpha 通道协同实现抠图环绕。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ marginThresholdInfo: this._readMarginThresholdInfo() }) }),
          this._btn('margin 0', { size: 'sm', disabled: !f.shapeMargin, onClick: () => this._setShapeMargin('0') }),
          this._btn('margin 10px', { size: 'sm', disabled: !f.shapeMargin, onClick: () => this._setShapeMargin('10px') }),
          this._btn('margin 20px', { size: 'sm', disabled: !f.shapeMargin, onClick: () => this._setShapeMargin('20px') }),
          this._btn('margin 40px', { size: 'sm', disabled: !f.shapeMargin, onClick: () => this._setShapeMargin('40px') }),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-sm' },
          h('span', { class: 'fs-sm text-secondary' }, 'shape-image-threshold：'),
          this._btn('0.0', { size: 'sm', disabled: !f.shapeImageThreshold, onClick: () => this._setImageThreshold('0.0') }),
          this._btn('0.5', { size: 'sm', disabled: !f.shapeImageThreshold, onClick: () => this._setImageThreshold('0.5') }),
          this._btn('1.0', { size: 'sm', disabled: !f.shapeImageThreshold, onClick: () => this._setImageThreshold('1.0') }),
        ),
        h('div', { class: 'shapes-stage' },
          h('div', { class: 'so-margin' }),
          h('div', { class: 'so-margin-text' },
            'shape-margin 演示文字。当前 shape-margin：' + this._shapeMargin + '。真实浏览器中文字会距圆形边界 ' + this._shapeMargin + ' 流动，留出呼吸空间提升可读性。shape-margin 跟随形状轮廓（圆形外为同心圆），与 margin（矩形盒外边距）不同。shape-image-threshold：' + this._imageThreshold + '（仅对 url() 图像形状生效）。'),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.marginThresholdInfo || '（点击按钮切换 shape-margin / threshold）')),
        h(Alert, {
          type: 'info',
          message: 'shape-margin 跟随形状轮廓（非矩形），shape-image-threshold 控制 Alpha 阈值',
          description: 'shape-margin 与 margin 区别：margin 是矩形盒外边距，shape-margin 跟随形状轮廓（圆形外为同心圆）。shape-image-threshold 仅对 url() 图像形状生效，0.0 默认（仅完全不透明像素），0.5 适合抗锯齿边缘（半透明以上为形状）。与 PNG Alpha 通道协同实现抠图环绕。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：引用图像形状 ===================

  _readImageShapeInfo() {
    const f = this._flags();
    try {
      return `===== 引用图像形状 shape-outside: url() =====\n` +
        `\n` +
        `【语法】\n` +
        `  shape-outside: <image>\n` +
        `  <image>: url(image.png) | gradient | cross-fade() | image-set()\n` +
        `  形状由图像 Alpha 通道决定\n` +
        `\n` +
        `【图像形状原理】\n` +
        `  shape-outside: url(avatar.png)\n` +
        `    浏览器解析图像每个像素的 Alpha 通道\n` +
        `    像素 Alpha ≥ shape-image-threshold → 形状内（文字避开）\n` +
        `    像素 Alpha < shape-image-threshold → 形状外（文字流入）\n` +
        `  适合：\n` +
        `    不规则抠图（人物剪影、物体轮廓）\n` +
        `    抗锯齿边缘的 PNG\n` +
        `    渐变（gradient 也作为图像）\n` +
        `\n` +
        `【shape-image-threshold 控制阈值】\n` +
        `  shape-image-threshold: 0.0  —— 仅完全不透明像素为形状\n` +
        `  shape-image-threshold: 0.5  —— Alpha ≥ 0.5 为形状（抗锯齿边缘）\n` +
        `  shape-image-threshold: 0.8  —— 仅高 Alpha 像素为形状\n` +
        `  阈值越高，形状越小（更多半透明像素被排除）\n` +
        `\n` +
        `【跨域图像限制】\n` +
        `  ⚠ 图像必须同源或 CORS 允许\n` +
        `  跨域图像若无 CORS 头，shape-outside 无效（安全限制）\n` +
        `  解决：服务器设置 Access-Control-Allow-Origin\n` +
        `  或使用 crossorigin="anonymous" 属性加载\n` +
        `\n` +
        `【与 mask-image 区别】\n` +
        `  shape-outside: url(image) —— 影响布局（文字环绕图像 Alpha 轮廓）\n` +
        `    不改变元素视觉（元素仍显示原图）\n` +
        `  mask-image: url(image) —— 影响渲染（按 Alpha 裁剪元素可见区域）\n` +
        `    改变元素视觉，不影响文字流\n` +
        `  两者常配合：\n` +
        `    .avatar {\n` +
        `      float: left;\n` +
        `      shape-outside: url(mask.png);  /* 文字环绕 */\n` +
        `      mask-image: url(mask.png);      /* 视觉裁剪 */\n` +
        `    }\n` +
        `\n` +
        `【gradient 作为图像形状】\n` +
        `  shape-outside: radial-gradient(circle, black 50%, transparent 50%);\n` +
        `  渐变也是图像，Alpha 通道决定形状\n` +
        `  radial-gradient 圆形 → 等价 circle()\n` +
        `  linear-gradient 矩形 → 意义不大（已是矩形）\n` +
        `  适合：无需外部图像文件，纯 CSS 实现形状\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  /* 人物剪影环绕 */\n` +
        `  .silhouette {\n` +
        `    float: left;\n` +
        `    width: 300px; height: 400px;\n` +
        `    shape-outside: url(person.png);   /* 人物剪影 PNG */\n` +
        `    shape-image-threshold: 0.5;        /* Alpha ≥ 0.5 */\n` +
        `    shape-margin: 15px;\n` +
        `  }\n` +
        `\n` +
        `  /* 渐变形状（无需外部图像）*/\n` +
        `  .gradient-shape {\n` +
        `    float: left;\n` +
        `    width: 200px; height: 200px;\n` +
        `    shape-outside: radial-gradient(circle, black 50%, transparent 50%);\n` +
        `  }\n` +
        `\n` +
        `  /* 配合 mask 视觉一致 */\n` +
        `  .avatar-with-mask {\n` +
        `    float: left;\n` +
        `    width: 200px; height: 200px;\n` +
        `    background: url(avatar.jpg);\n` +
        `    shape-outside: url(mask.png);\n` +
        `    mask-image: url(mask.png);\n` +
        `    shape-margin: 10px;\n` +
        `  }\n` +
        `\n` +
        `【能力检测】\n` +
        `  CSS.supports('shape-image-threshold','0.5') = ${f.shapeImageThreshold}\n` +
        `  当前 threshold = '${this._imageThreshold}'\n` +
        `\n` +
        `【浏览器支持】\n` +
        `  Chrome 37+ / Firefox 62+ / Safari 11.1+ —— 全部稳定支持\n` +
        `  jsdom —— 不做真实图像解析`;
    } catch (err) {
      return `读取图像形状信息失败：${err.name} - ${err.message}`;
    }
  }

  _runImageShapeDemo() {
    const f = this._flags();
    if (!f.shapeImageThreshold) {
      this._addLog('warn', `shape-image-threshold 不可用或 jsdom 未识别（现代浏览器全支持）`);
    } else {
      this._addLog('info', `图像形状演示：threshold=${this._imageThreshold}（真实浏览器可加载 PNG 抠图环绕）`);
    }
    this.setState({ imageShapeInfo: this._readImageShapeInfo() });
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. 引用图像形状 —— shape-outside: url() + Alpha 通道',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['shape-image-threshold', f.shapeImageThreshold]]),
        h(Tag, { color: 'primary' }, 'PNG 抠图'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'shape-outside: url(image.png) 引用图像，形状由 Alpha 通道决定（Alpha ≥ shape-image-threshold 为形状内文字避开，< 阈值为形状外文字流入）。适合不规则抠图（人物剪影、物体轮廓）、抗锯齿 PNG。gradient 也可作为图像（radial-gradient 等价 circle）。⚠ 跨域图像需 CORS 头或 crossorigin="anonymous"，否则无效。与 mask-image 区别：shape-outside 影响布局（文字环绕），mask-image 影响渲染（裁剪可见），常配合让视觉与环绕一致。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行图像形状演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runImageShapeDemo() }),
          this._btn('threshold 0.0', { size: 'sm', disabled: !f.shapeImageThreshold, onClick: () => this._setImageThreshold('0.0') }),
          this._btn('threshold 0.5', { size: 'sm', disabled: !f.shapeImageThreshold, onClick: () => this._setImageThreshold('0.5') }),
          this._btn('threshold 0.8', { size: 'sm', disabled: !f.shapeImageThreshold, onClick: () => this._setImageThreshold('0.8') }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '当前 shape-image-threshold：' + this._imageThreshold),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.imageShapeInfo || '（点击按钮查看图像形状完整说明与代码）')),
        h(Alert, {
          type: 'warning',
          message: '跨域图像需 CORS 头或 crossorigin="anonymous"，否则 shape-outside 无效',
          description: '安全限制：跨域图像无 CORS 头时 shape-outside 无效。服务器设 Access-Control-Allow-Origin 或 img crossorigin="anonymous"。与 mask-image 区别：shape-outside 影响布局（文字环绕 Alpha 轮廓，不改变视觉），mask-image 影响渲染（裁剪可见，不影响文字流）。常配合：shape-outside + mask-image 用同一 PNG 实现视觉与环绕一致。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 7：实战：杂志式排版 ===================

  _readMagazineInfo() {
    const f = this._flags();
    try {
      return `===== 实战：杂志式排版 =====\n` +
        `\n` +
        `【场景 1：圆形头像文字环绕】\n` +
        `  .avatar {\n` +
        `    float: left;\n` +
        `    width: 100px; height: 100px;\n` +
        `    margin: 6px 14px 6px 0;\n` +
        `    border-radius: 50%;\n` +
        `    shape-outside: circle();\n` +
        `    shape-margin: 8px;\n` +
        `    background: url(avatar.jpg) center/cover;\n` +
        `  }\n` +
        `\n` +
        `【场景 2：多边形装饰元素环绕】\n` +
        `  .decor-diamond {\n` +
        `    float: right;\n` +
        `    width: 120px; height: 120px;\n` +
        `    margin: 6px 0 6px 14px;\n` +
        `    background: linear-gradient(135deg, #8b5cf6, #ec4899);\n` +
        `    clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);\n` +
        `    shape-outside: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);\n` +
        `  }\n` +
        `\n` +
        `【场景 3：不规则图像抠图环绕】\n` +
        `  .silhouette {\n` +
        `    float: left;\n` +
        `    width: 250px; height: 350px;\n` +
        `    shape-outside: url(person-mask.png);\n` +
        `    shape-image-threshold: 0.5;\n` +
        `    shape-margin: 12px;\n` +
        `    background: url(person.jpg);\n` +
        `    mask-image: url(person-mask.png);\n` +
        `  }\n` +
        `\n` +
        `【与 float 协同】\n` +
        `  shape-outside 必须配合 float: left/right\n` +
        `  float: left —— 形状在左，文字在右环绕\n` +
        `  float: right —— 形状在右，文字在左环绕\n` +
        `  多个浮动形状可叠加（文字依次环绕）\n` +
        `\n` +
        `【与 CSS Grid/Flexbox 协同】\n` +
        `  ⚠ Shapes 仅对浮动元素生效，Grid/Flex 子项不浮动\n` +
        `  Grid/Flex 容器内的子项 shape-outside 无效\n` +
        `  解决：\n` +
        `    1. 在普通块级容器内用 float + shape-outside\n` +
        `    2. Grid/Flex 容器外单独创建浮动形状区域\n` +
        `    3. 用 CSS Exclusions（提案中）替代 float 限制\n` +
        `\n` +
        `【能力检测】\n` +
        `  shape-outside:circle() = ${f.circle}\n` +
        `  shape-outside:polygon() = ${f.polygon}\n` +
        `  shape-margin = ${f.shapeMargin}\n` +
        `  shape-image-threshold = ${f.shapeImageThreshold}`;
    } catch (err) {
      return `读取杂志排版信息失败：${err.name} - ${err.message}`;
    }
  }

  _runMagazineDemo() {
    const f = this._flags();
    this.setState({ magazineInfo: this._readMagazineInfo() });
    this._addLog('info', `杂志式排版演示：circle=${f.circle}, polygon=${f.polygon}（真实浏览器可见环绕效果）`);
  }

  _renderCard7() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. 实战 —— 杂志式排版（圆形头像/多边形/抠图环绕）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['shape-outside', f.circle],
          ['shape-margin', f.shapeMargin],
        ]),
        h(Tag, { color: 'primary' }, '3 大场景'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '杂志式排版三大场景：圆形头像文字环绕（float: left + shape-outside: circle() + border-radius: 50%）、多边形装饰元素环绕（float: right + polygon() + clip-path 配合）、不规则图像抠图环绕（shape-outside: url(mask.png) + shape-image-threshold + mask-image 配合）。与 float 协同：float: left 形状在左文字右环绕，float: right 反之。⚠ Shapes 仅对浮动元素生效，Grid/Flex 子项不浮动无效，需在普通块级容器内用 float。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行杂志排版演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runMagazineDemo() }),
        ),
        h('div', { class: 'magazine-stage' },
          h('div', { class: 'avatar' }, 'A'),
          h('div', { class: 'decor-polygon' }),
          h('div', { class: 'article' },
            '杂志式排版演示：圆形头像（A）浮动在左侧，文字沿圆形边界环绕；菱形装饰浮动在右侧，文字沿多边形边界穿插。CSS Shapes Module Level 1 让 Web 排版突破矩形限制，实现杂志、书籍、新闻报道的精美排版效果。真实浏览器中可看到文字沿圆形与菱形边界流动的效果。shape-outside 必须配合 float 使用，仅对浮动元素生效。多个浮动形状可叠加，文字依次环绕。注意：Shapes 不影响 Grid/Flex 子项，需在普通块级容器内使用 float。'),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.magazineInfo || '（点击按钮查看 3 大杂志排版场景代码）')),
        h(Alert, {
          type: 'info',
          message: 'Shapes 仅对浮动元素生效，Grid/Flex 子项无效',
          description: '场景 1：圆形头像 float: left + shape-outside: circle() + border-radius: 50%。场景 2：多边形装饰 float: right + polygon() + clip-path。场景 3：抠图 shape-outside: url(mask.png) + mask-image 配合。⚠ Grid/Flex 容器内子项不浮动，shape-outside 无效，需在普通块级容器内用 float。CSS Exclusions（提案中）将解除 float 限制。',
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
      return `===== CSS Shapes 陷阱与最佳实践 =====\n` +
        `\n` +
        `【陷阱 1：shape-outside 仅对浮动元素生效】\n` +
        `  ⚠ float: none 的元素 shape-outside 完全无效\n` +
        `  ⚠ position: absolute/fixed 的元素不浮动，无效\n` +
        `  ⚠ flex/grid 子项不浮动，无效\n` +
        `  正确用法：\n` +
        `    .shape { float: left; shape-outside: circle(); }\n` +
        `  错误用法：\n` +
        `    .shape { display: flex; shape-outside: circle(); }  /* 无效 */\n` +
        `    .shape { position: absolute; shape-outside: circle(); }  /* 无效 */\n` +
        `\n` +
        `【陷阱 2：必须设置 width/height】\n` +
        `  shape-outside 需要参考盒尺寸计算形状\n` +
        `  无 width/height 的浮动元素尺寸为 0，形状无意义\n` +
        `  正确：\n` +
        `    .shape { float: left; width: 200px; height: 200px; shape-outside: circle(); }\n` +
        `  错误：\n` +
        `    .shape { float: left; shape-outside: circle(); }  /* 无尺寸，无效 */\n` +
        `\n` +
        `【陷阱 3：形状参考盒模型】\n` +
        `  shape-outside 默认参考 margin-box（含 margin 外边界）\n` +
        `  可显式指定：\n` +
        `    shape-outside: circle() margin-box;    /* 含 margin */\n` +
        `    shape-outside: circle() border-box;    /* 含 border */\n` +
        `    shape-outside: circle() padding-box;   /* 含 padding */\n` +
        `    shape-outside: circle() content-box;   /* 仅内容 */\n` +
        `    shape-outside: margin-box;             /* 直接用盒作为形状 */\n` +
        `  形状坐标相对参考盒左上角\n` +
        `  percentage 相对参考盒尺寸\n` +
        `\n` +
        `【陷阱 4：DevTools Shapes 编辑器】\n` +
        `  Chrome DevTools 支持 Shapes 可视化编辑：\n` +
        `    1. 选中浮动元素\n` +
        `    2. Elements 面板 → Computed → shape-outside\n` +
        `    3. 点击形状图标可视化\n` +
        `    4. 拖拽顶点/圆心/半径实时调整\n` +
        `    5. 自动更新 CSS\n` +
        `  Firefox 也有类似 Shapes Editor\n` +
        `\n` +
        `【陷阱 5：响应式适配】\n` +
        `  shape-outside 用 percentage 可响应式：\n` +
        `    .shape { float: left; width: 30%; height: 200px; shape-outside: circle(50%); }\n` +
        `  小屏可隐藏形状：\n` +
        `    @media (max-width: 600px) {\n` +
        `      .shape { float: none; width: 100%; shape-outside: none; }\n` +
        `    }\n` +
        `  shape-margin 也可用 vw/em 响应式\n` +
        `\n` +
        `【陷阱 6：与 Writing Modes 协同】\n` +
        `  shape-outside 在 vertical-rl/lr 写作模式下仍生效\n` +
        `  但形状坐标相对参考盒（不随 writing-mode 翻转）\n` +
        `  竖排文字环绕形状时需调整坐标\n` +
        `  示例：vertical-rl 下 float: left 实际是顶部\n` +
        `\n` +
        `【陷阱 7：性能考虑】\n` +
        `  shape-outside 会触发更复杂的文字布局计算\n` +
        `  大量形状 + 长文本可能影响性能\n` +
        `  优化建议：\n` +
        `    ✓ 避免页面过多浮动形状（< 10 个）\n` +
        `    ✓ 形状尽量简单（circle 比 polygon 性能好）\n` +
        `    ✓ url() 图像形状会解码图像，避免大图\n` +
        `    ✓ 静态形状优于动态修改（避免布局抖动）\n` +
        `    ✓ will-change: shape-outside 提示浏览器优化（慎用）\n` +
        `\n` +
        `【最佳实践清单】\n` +
        `  ✓ shape-outside 仅用于 float: left/right 元素\n` +
        `  ✓ 必须设置 width/height\n` +
        `  ✓ 显式指定参考盒（margin-box/border-box/...）\n` +
        `  ✓ shape-outside + clip-path 用相同形状保持视觉一致\n` +
        `  ✓ shape-margin 留呼吸空间提升可读性\n` +
        `  ✓ shape-image-threshold 0.5 适合抗锯齿 PNG\n` +
        `  ✓ 跨域图像需 CORS 头或 crossorigin\n` +
        `  ✓ 响应式用 percentage + 媒体查询小屏隐藏\n` +
        `  ✓ 用 DevTools Shapes Editor 可视化调整\n` +
        `  ✓ 避免过多形状（性能）\n` +
        `\n` +
        `【能力检测】\n` +
        `  shape-outside:circle() = ${f.circle}\n` +
        `  shape-outside:ellipse() = ${f.ellipse}\n` +
        `  shape-outside:inset() = ${f.inset}\n` +
        `  shape-outside:polygon() = ${f.polygon}\n` +
        `  shape-margin = ${f.shapeMargin}\n` +
        `  shape-image-threshold = ${f.shapeImageThreshold}`;
    } catch (err) {
      return `读取陷阱与最佳实践信息失败：${err.name} - ${err.message}`;
    }
  }

  _runPitfallsDemo() {
    const f = this._flags();
    this.setState({ pitfallsInfo: this._readPitfallsInfo() });
    this._addLog('info', `陷阱与最佳实践演示：circle=${f.circle}, polygon=${f.polygon}, shape-margin=${f.shapeMargin}`);
  }

  _setBoxModel(box) {
    this._boxModel = box;
    this.setState({ pitfallsInfo: this._readPitfallsInfo() });
    this._addLog('info', `切换形状参考盒模型 → ${box}`);
  }

  _renderCard8() {
    const s = this.state;
    const f = this._flags();
    const boxes = ['margin-box', 'border-box', 'padding-box', 'content-box'];
    const card = new Card({
      title: '8. 陷阱与最佳实践 —— float/尺寸/盒模型/DevTools/响应式',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['shape-outside', f.circle],
          ['shape-margin', f.shapeMargin],
        ]),
        h(Tag, { color: 'warning' }, '7 大陷阱'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '七大陷阱：shape-outside 仅对浮动元素生效（float: none/absolute/flex/grid 无效）；必须设置 width/height（否则参考盒尺寸 0）；形状参考盒模型（默认 margin-box，可 border-box/padding-box/content-box，显式 shape-outside: circle() margin-box）；DevTools Shapes Editor 可视化拖拽（Chrome/Firefox）；响应式适配（percentage + 媒体查询小屏 float: none）；与 Writing Modes 协同（坐标不随 writing-mode 翻转）；性能考虑（< 10 个形状、circle 优于 polygon、避免大图 url）。最佳实践 10 条。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行陷阱与最佳实践演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runPitfallsDemo() }),
          ...boxes.map((box) =>
            this._btn(box, { size: 'sm', onClick: () => this._setBoxModel(box) })),
        ),
        h('div', { class: 'boxmodel-stage' },
          h('div', { class: 'bm-box' },
            h('div', { class: 'bm-label bm-margin' }, 'margin-box（默认）'),
            h('div', { class: 'bm-label bm-border' }, 'border-box'),
            h('div', { class: 'bm-label bm-padding' }, 'padding-box'),
            h('div', { class: 'bm-label bm-content' }, 'content-box'),
          ),
          h('div', { class: 'fs-sm text-secondary', style: { marginTop: '8px' } },
            '当前参考盒：' + this._boxModel + '（形状坐标相对该盒左上角，percentage 相对该盒尺寸）'),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.pitfallsInfo || '（点击按钮查看 7 大陷阱与 10 条最佳实践）')),
        h(Alert, {
          type: 'warning',
          message: 'shape-outside 仅对 float 元素生效；必须设 width/height；默认参考 margin-box',
          description: '陷阱清单：float: none/absolute/flex/grid 无效；无 width/height 参考盒尺寸 0；参考盒默认 margin-box（可 border-box/padding-box/content-box）；DevTools Shapes Editor 可视化；响应式用 percentage + 媒体查询；writing-mode 不翻转坐标；性能（< 10 形状、circle 优于 polygon、避免大图）。最佳实践：float + width/height + 显式盒模型 + clip-path 配合 + shape-margin + threshold 0.5 + CORS + 响应式 + DevTools + 性能。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== 日志面板 ===================

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

  // =================== 渲染入口 ===================

  render() {
    const s = this.state;
    return h('div', { class: 'api-lab-page css-shapes-page' },
      h('h2', { class: 'section-title' }, 'CSS Shapes Module Level 1 完整实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页演示 W3C CSS Shapes Module Level 1 文本环绕非矩形形状：shape-outside 基础（circle/ellipse/inset/polygon + float）、circle() 与 ellipse()（closest-side/farthest-side）、inset() 与 polygon()（与 clip-path 共用语法）、shape-margin 与 shape-image-threshold（Alpha 阈值）、引用图像形状（url() + PNG 抠图 + CORS）、杂志式排版实战（圆形头像/多边形/抠图环绕）、陷阱与最佳实践（float/尺寸/盒模型/DevTools/响应式/性能）。所有特性通过 CSS.supports 能力检测，不可用时仅记日志，绝不抛异常。jsdom 不做真实布局，真实浏览器可查看文字环绕效果。'),
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
