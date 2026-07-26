// =====================================================================
// CSSClipPathDeepPage.js —— CSS clip-path 剪裁路径深度实验室
// 演示 CSS Masking Module Level 1：clip-path / clip-rule / SVG <clipPath>
//   1. clip-path 概述与基本形状 —— <basic-shape>|<clip-source>|<geometry-box>|none
//      basic-shape: circle()|ellipse()|inset()|polygon()|path()
//      与 overflow:hidden 对比、与 mask 区别（硬切边 vs alpha/luminance 渐变切）
//   2. circle() / ellipse() —— 圆与椭圆剪裁
//      circle([<shape-radius>? [at <position>]?])
//      radius: <length>|<percentage>|closest-side|farthest-side
//      ellipse([<rx> <ry>? [at <position>]?])
//   3. inset() —— 内嵌矩形
//      inset(<length-percentage>{1,4} [round <border-radius>]? )
//      四值语法 上 右 下 左、round 圆角剪裁
//   4. polygon() —— 多边形
//      polygon(<fill-rule>?, <length-percentage> <length-percentage>)
//      fill-rule: nonzero|evenodd、星形/箭头/三角形
//   5. path() —— SVG 路径
//      path(<fill-rule>?, <string>)、M/L/C/Q/Z 命令、心形/波浪
//      path() vs url(#clipPath) SVG 引用
//   6. geometry-box —— 几何盒
//      clip-path: <basic-shape> <geometry-box>
//      margin-box|border-box|padding-box|content-box|fill-box|stroke-box|view-box|none
//   7. clip-rule 与 url(#clipPath) SVG 引用
//      SVG <clipPath> 元素、clipPathUnits: userSpaceOnUse|objectBoundingBox
//      clip-rule: nonzero|evenodd
//   8. 实战模式与陷阱 —— 圆形头像/箭头标签/波浪分隔/文字遮罩动画/
//      clipped 视频/图片/卡片斜角 + 陷阱清单
//   9. object-view-box —— 替换元素视图裁剪（<img>/<video> 专用）
//      CSSWG 提案、Chrome 124+ 支持、与 object-fit 协同（先裁剪再缩放）
//      vs clip-path 区别（仅裁剪内容不影响盒模型）、图像缩略图/视频去黑边/
//      响应式裁剪 + 陷阱清单（仅 replaced element 生效/降级到 clip-path）
// 说明：jsdom 不做真实渲染，但 CSS.supports 可探测属性支持；
//       注入演示样式 + 完整代码示例，真实浏览器可查看剪裁效果。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class CSSClipPathDeepPage extends Page {
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      overviewInfo: '',     // Card 1：clip-path 概述与基本形状
      circleInfo: '',       // Card 2：circle() / ellipse()
      insetInfo: '',        // Card 3：inset() 内嵌矩形
      polygonInfo: '',      // Card 4：polygon() 多边形
      pathInfo: '',         // Card 5：path() SVG 路径
      geometryBoxInfo: '',  // Card 6：geometry-box 几何盒
      svgClipInfo: '',      // Card 7：clip-rule 与 url(#clipPath)
      patternInfo: '',      // Card 8：实战模式与陷阱
      objectViewBoxInfo: '', // Card 9：object-view-box 替换元素视图裁剪
    };
  }

  componentDidMount() {
    if (this._inited) return;
    this._inited = true;

    this._dynamicStyles = [];

    const f = this._flags();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `circle() ${c(f.circle)}`,
      `ellipse() ${c(f.ellipse)}`,
      `inset() ${c(f.inset)}`,
      `polygon() ${c(f.polygon)}`,
      `path() ${c(f.path)}`,
      `geometry-box ${c(f.geometryBox)}`,
      `url(#clip) ${c(f.urlClip)}`,
      `object-view-box ${c(f.ovbInset || f.ovbCircle || f.ovbNone)}`,
    ];

    const summary = f.css
      ? `CSS clip-path 能力检测：${parts.join(' · ')}。jsdom 不做真实渲染，但 CSS.supports 可探测属性支持；按钮点击注入演示样式 + 完整代码示例，真实浏览器可查看剪裁效果。`
      : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击仅记日志说明，不会抛异常。';

    this.setState({ capsSummary: summary });
    this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.path) this._addLog('warn', 'path() 不可用（Chrome 88+/Firefox 71+/Safari 13.1+ 才支持 path() 作为 basic-shape）');
    if (!f.geometryBox) this._addLog('warn', 'geometry-box 不可用（旧 Safari 兼容性问题，需 -webkit-clip-path 前缀）');
    if (!f.urlClip) this._addLog('info', 'url(#clip) SVG 引用支持探测返回 false（实际浏览器通常支持，jsdom 限制）');
    if (!f.ovbInset && !f.ovbCircle && !f.ovbNone) this._addLog('warn', 'object-view-box 不可用（仅 Chrome 124+ 支持，Safari/Firefox 未实现，可降级到 clip-path）');

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
    this._injectStyle('css-cp-base', `
      .cp-demo {
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
      }
      .cp-box {
        width: 90px;
        height: 90px;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 700;
        font-size: 11px;
        margin: 4px;
      }
      .cp-circle { clip-path: circle(50% at 50% 50%); }
      .cp-ellipse { clip-path: ellipse(50% 35% at 50% 50%); }
      .cp-inset { clip-path: inset(15% 10% 15% 10%); }
      .cp-inset-round { clip-path: inset(10% round 50%); }
      .cp-triangle { clip-path: polygon(50% 0%, 100% 100%, 0% 100%); }
      .cp-star { clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%); }
      .cp-arrow { clip-path: polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%); }
      .cp-heart { clip-path: path('M50,80 C20,60 5,40 5,25 C5,12 15,5 25,5 C35,5 45,12 50,20 C55,12 65,5 75,5 C85,5 95,12 95,25 C95,40 80,60 50,80 Z'); }
      .cp-wave { clip-path: polygon(0% 30%, 10% 45%, 20% 15%, 30% 45%, 40% 15%, 50% 45%, 60% 15%, 70% 45%, 80% 15%, 90% 45%, 100% 30%, 100% 100%, 0% 100%); }
      .cp-geo-border {
        clip-path: circle(50% at center) border-box;
        background: #3b82f6;
      }
      .cp-geo-content {
        clip-path: circle(50% at center) content-box;
        background: #10b981;
        padding: 20px;
        box-sizing: content-box;
      }
      .cp-avatar {
        width: 80px;
        height: 80px;
        border-radius: 0;
        clip-path: circle(50%);
        background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="%23f59e0b"/><circle cx="40" cy="32" r="14" fill="%23fff"/><path d="M14,72 C14,52 26,46 40,46 C54,46 66,52 66,72 Z" fill="%23fff"/></svg>') center/cover;
      }
      .cp-card-bevel {
        width: 110px;
        height: 64px;
        background: linear-gradient(135deg, #ef4444, #f59e0b);
        clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
      }
      .cp-text-mask {
        font-size: 28px;
        font-weight: 900;
        background: linear-gradient(90deg, #3b82f6, #ec4899, #3b82f6);
        background-size: 200% auto;
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        animation: cp-shimmer 3s linear infinite;
        display: inline-block;
      }
      @keyframes cp-shimmer {
        from { background-position: 0% center; }
        to   { background-position: 200% center; }
      }
      .cp-output {
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
      .cp-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
        gap: 8px;
        margin-top: 10px;
      }
      .cp-grid-cell {
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 8px;
        text-align: center;
      }
      .cp-grid-label {
        font-size: 11px;
        color: #475569;
        margin-bottom: 4px;
      }
      .cp-ovb-img {
        width: 120px;
        height: 80px;
        object-fit: cover;
        border: 2px dashed #94a3b8;
        background: #e2e8f0;
      }
      .cp-ovb-inset { object-view-box: inset(10% 10% 10% 10%); }
      .cp-ovb-circle { object-view-box: circle(50% at center); }
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
      circle: supportsPV('clip-path', 'circle(50%)'),
      ellipse: supportsPV('clip-path', 'ellipse(50% 50%)'),
      inset: supportsPV('clip-path', 'inset(10%)'),
      polygon: supportsPV('clip-path', 'polygon(0 0, 100% 0, 100% 100%)'),
      path: supportsPV('clip-path', 'path("M0,0 L100,0 L100,100 Z")'),
      geometryBox: supportsPV('clip-path', 'circle(50% at center) border-box'),
      urlClip: supportsPV('clip-path', 'url(#clip)'),
      // object-view-box（CSSWG 提案，仅 Chrome 124+ 支持）
      ovbInset: supportsPV('object-view-box', 'inset(10%)'),
      ovbCircle: supportsPV('object-view-box', 'circle()'),
      ovbNone: supportsPV('object-view-box', 'none'),
    };
  }

  // ===================== Card 1：clip-path 概述与基本形状 =====================

  _runOverviewDemo() {
    const f = this._flags();
    const info = [
      '===== CSS clip-path 概述与基本形状 =====',
      '',
      '【语法总览】',
      '  clip-path: <basic-shape> | <clip-source> | <geometry-box> | none',
      '',
      '  /* 四类取值 */',
      '  <basic-shape>   : circle() | ellipse() | inset() | polygon() | path()',
      '  <clip-source>   : url(#clipPathId)  /* 引用 SVG <clipPath> 元素 */',
      '  <geometry-box>  : margin-box | border-box | padding-box | content-box |',
      '                    fill-box | stroke-box | view-box',
      '  none            : 不剪裁（默认）',
      '',
      '【basic-shape 五种基本形状函数】',
      '  circle()   圆形     clip-path: circle(50% at 50% 50%);',
      '  ellipse()  椭圆     clip-path: ellipse(50% 35% at center);',
      '  inset()    内嵌矩形 clip-path: inset(10% round 5px);',
      '  polygon()  多边形   clip-path: polygon(50% 0%, 100% 100%, 0% 100%);',
      '  path()     SVG 路径 clip-path: path("M0,0 L100,0 L100,100 Z");',
      '',
      '【clip-path vs overflow: hidden —— 本质区别】',
      '  overflow: hidden',
      '    - 仅裁剪超出 padding-box 的内容（基于矩形盒）',
      '    - 不能裁出圆形/多边形等任意形状',
      '    - 影响滚动行为（auto/scroll 时显示滚动条）',
      '    - 子元素绝对定位仍可能溢出（除非设 overflow:clip）',
      '',
      '  clip-path',
      '    - 可裁出任意形状（圆/椭圆/多边形/SVG 路径）',
      '    - 不影响布局，元素仍占据原空间（仅视觉裁剪）',
      '    - 不影响滚动行为',
      '    - 裁剪区域之外的子元素/内容完全不可见且不可交互',
      '    - pointer-events 仅在裁剪区域内有效',
      '',
      '【clip-path vs mask —— 硬切边 vs 渐变切】',
      '  clip-path: 硬切边（hard edge）',
      '    - 边界是锐利的，要么完全显示要么完全隐藏',
      '    - 不支持半透明/羽化过渡',
      '    - 性能好，GPU 友好',
      '    - 适合：圆形头像、多边形按钮、几何形状',
      '',
      '  mask / mask-image: alpha/luminance 渐变切',
      '    - mask-image: url(mask.png)  按 alpha 通道渐变显示',
      '    - mask-mode: alpha | luminance | match-source',
      '    - 边界可羽化、渐变、半透明',
      '    - 适合：羽化边缘、渐变蒙版、不规则柔和过渡',
      '',
      '  /* mask 示例 */',
      '  .masked {',
      '    -webkit-mask-image: linear-gradient(to bottom, black 50%, transparent);',
      '    mask-image: linear-gradient(to bottom, black 50%, transparent);',
      '  }',
      '',
      '【clip-path 的视觉行为】',
      '  1. 元素布局不变（仍占原空间，不影响周边元素）',
      '  2. 裁剪区域外内容完全隐藏（包括边框、背景、子元素）',
      '  3. 裁剪区域外不响应指针事件（点击穿透到下层）',
      '  4. 可作用于任何元素（含 SVG/图片/视频/Canvas）',
      '  5. 不会触发 layout（仅 paint/composite）',
      '',
      '【初始值与继承】',
      '  clip-path 初始值: none',
      '  非继承属性（不会传给子元素，但子元素在父裁剪区域内才可见）',
      '  适用元素: 所有（SVG 中 svg/defs/g/symbol/use/clipPath 等例外）',
      '',
      '【浏览器支持】',
      `  circle()/ellipse()/inset()/polygon(): ${f.circle ? '✓' : '✗'} (IE 不支持，Edge 12+/所有现代浏览器)`,
      `  path(): ${f.path ? '✓' : '✗'} (Chrome 88+/Firefox 71+/Safari 13.1+)`,
      `  geometry-box: ${f.geometryBox ? '✓' : '✗'} (Chrome 55+/Firefox 55+/Safari 部分支持)`,
      `  url(#clipPath): ${f.urlClip ? '✓' : '✗'} (所有现代浏览器，含 IE9+)`,
      '',
      '【前缀与兼容】',
      '  /* 现代浏览器 */',
      '  .clip { clip-path: circle(50%); }',
      '  /* 旧 Safari/WebKit 兼容 */',
      '  .clip { -webkit-clip-path: circle(50%); clip-path: circle(50%); }',
      '',
      '【常见陷阱】',
      '  1. clip-path 不影响布局，元素仍占原空间（裁剪不等于隐藏）',
      '  2. clip-path: none 是默认值，覆盖时显式声明',
      '  3. clip-rule 仅对 url(#clipPath) 引用生效，对 basic-shape 无效',
      '  4. path() 在部分浏览器需字符串参数（双引号或单引号包裹）',
      '  5. 旧 iOS Safari 13- 不支持 path() 与 geometry-box',
    ].join('\n');
    this.setState({ overviewInfo: info });
    this._addLog('css', `clip-path 概述演示完成；supports=${f.circle}/${f.path}/${f.geometryBox}`);
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const code = [
      '/* clip-path 语法总览 */',
      'clip-path: <basic-shape> | <clip-source> | <geometry-box> | none;',
      '',
      '/* basic-shape 五种函数 */',
      'clip-path: circle(50% at 50% 50%);',
      'clip-path: ellipse(50% 35% at center);',
      'clip-path: inset(10% round 5px);',
      'clip-path: polygon(50% 0%, 100% 100%, 0% 100%);',
      'clip-path: path("M0,0 L100,0 L100,100 Z");',
      '',
      '/* geometry-box 修饰 */',
      'clip-path: circle(50% at center) border-box;',
      '',
      '/* SVG 引用 */',
      'clip-path: url(#myClip);',
    ].join('\n');
    const card = new Card({
      title: '1. clip-path 概述与基本形状 —— <basic-shape>|<clip-source>|<geometry-box>|none',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['basic-shape', f.circle],
          ['path()', f.path],
          ['geometry-box', f.geometryBox],
        ]),
        h(Tag, { color: 'primary' }, 'Masking L1'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'clip-path: <basic-shape>|<clip-source>|<geometry-box>|none。basic-shape 含 circle()/ellipse()/inset()/polygon()/path() 五种函数。与 overflow:hidden 对比：overflow 仅矩形裁剪基于 padding-box，clip-path 可裁任意形状且不影响布局。与 mask 区别：clip-path 硬切边（锐利边界），mask 用 alpha/luminance 通道渐变切（可羽化）。裁剪区域外内容完全隐藏且不响应指针事件。Chrome/Edge/Firefox 全支持，Safari 部分需 -webkit- 前缀，path() 需 Chrome 88+。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 clip-path 概述演示', { type: 'primary', size: 'sm', onClick: () => this._runOverviewDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, code)),
        h('div', { class: 'fs-sm text-secondary' }, '可视化剪裁效果：'),
        h('div', { class: 'cp-demo' },
          h('div', { class: 'cp-box cp-circle' }, 'circle'),
          h('div', { class: 'cp-box cp-inset' }, 'inset'),
          h('div', { class: 'cp-box cp-triangle' }, 'triangle'),
          h('div', { class: 'cp-box cp-star' }, 'star'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.overviewInfo || '（点击按钮查看 clip-path 概述与基本形状完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 2：circle() / ellipse() =====================

  _runCircleDemo() {
    const f = this._flags();
    const info = [
      '===== circle() / ellipse() 圆与椭圆剪裁 =====',
      '',
      '【circle() 语法】',
      '  circle( [<shape-radius>? [at <position>]?] )',
      '',
      '  /* 三种形式 */',
      '  circle()                    /* 默认半径 closest-side，居中 */',
      '  circle(50%)                 /* 半径 50%，居中 */',
      '  circle(50% at 50% 50%)      /* 半径 50%，圆心在 (50%, 50%) */',
      '  circle(at top left)         /* 半径默认 closest-side，圆心在左上角 */',
      '',
      '【shape-radius 取值】',
      '  <length>       circle(50px)       固定长度',
      '  <percentage>   circle(50%)        相对参考盒（默认 closest-side 计算）',
      '  closest-side   距离圆心最近的边（默认值）',
      '  farthest-side  距离圆心最远的边',
      '',
      '  /* closest-side 详解 */',
      '  /* 圆心到参考盒四条边距离的最小值作为半径 */',
      '  /* 圆心在中心时 closest-side = 50% 短边 */',
      '  .a { clip-path: circle(closest-side at 50% 50%); }',
      '',
      '  /* farthest-side 详解 */',
      '  /* 圆心到参考盒四条边距离的最大值作为半径 */',
      '  .b { clip-path: circle(farthest-side at 50% 50%); }',
      '',
      '【position 圆心定位】',
      '  circle(50% at center)         /* 居中（默认）*/',
      '  circle(50% at 50% 50%)        /* 显式居中 */',
      '  circle(50% at top left)       /* 左上角 */',
      '  circle(50% at top right)      /* 右上角 */',
      '  circle(50% at bottom center)  /* 底部居中 */',
      '  circle(50% at 25% 75%)        /* 自定义坐标 */',
      '  circle(50% at 30px 40px)      /* 绝对坐标 */',
      '',
      '【position 语法（与 background-position 一致）】',
      '  1-4 个值组合：',
      '    center | left | right | top | bottom | <percentage> | <length>',
      '  at center              = at 50% 50%',
      '  at top left            = at 0% 0%',
      '  at 25% 75%             显式百分比',
      '  at right 20%           水平靠右，垂直 20%',
      '',
      '【ellipse() 语法】',
      '  ellipse( [<shape-radius>{2}? [at <position>]?] )',
      '',
      '  /* rx 水平半径，ry 垂直半径 */',
      '  ellipse()                    /* 默认 closest-side closest-side，居中 */',
      '  ellipse(50% 50%)             /* rx=50% ry=50%，居中（= circle）*/',
      '  ellipse(50% 35% at center)   /* rx=50% ry=35%，居中 */',
      '  ellipse(closest-side farthest-side at 50% 50%)',
      '',
      '【ellipse rx/ry 取值】',
      '  rx: <length> | <percentage> | closest-side | farthest-side',
      '  ry: <length> | <percentage> | closest-side | farthest-side',
      '',
      '  /* 椭圆 vs 圆：ellipse 接受两个半径，circle 接受一个 */',
      '  /* circle(50%) ≈ ellipse(50% 50%) 当 rx == ry 时为正圆 */',
      '',
      '【实战示例：圆形头像】',
      '  .avatar {',
      '    width: 80px;',
      '    height: 80px;',
      '    clip-path: circle(50% at 50% 50%);',
      '    /* 或等价：clip-path: circle(closest-side); */',
      '  }',
      '  /* 比 border-radius: 50% 更彻底：裁剪子元素与图片溢出 */',
      '',
      '【实战示例：椭圆胶囊】',
      '  .pill {',
      '    clip-path: ellipse(50% 50% at center);',
      '  }',
      '',
      '【实战示例：局部放大镜圆形视口】',
      '  .magnifier {',
      '    clip-path: circle(60px at var(--mx, 50%) var(--my, 50%));',
      '    /* 配合 JS 更新 --mx/--my 跟随鼠标 */',
      '  }',
      '',
      '【circle() 可动画：半径与圆心都可过渡】',
      '  .reveal {',
      '    clip-path: circle(0% at 50% 50%);',
      '    transition: clip-path 0.6s ease;',
      '  }',
      '  .reveal.open {',
      '    clip-path: circle(75% at 50% 50%);',
      '  }',
      '  /* 从中心向外圆形展开（View Transitions 常用）*/',
      '',
      '【浏览器支持】',
      `  circle(): ${f.circle ? '✓' : '✗'} (Chrome 55+/Firefox 55+/Safari 10.1+)`,
      `  ellipse(): ${f.ellipse ? '✓' : '✗'} (同上)`,
      '',
      '【常见陷阱】',
      '  1. circle(50%) 中 50% 是相对参考盒最短边还是长边？',
      '     → closest-side（默认）= 最短边距离；需明确语义时用 closest-side/farthest-side',
      '  2. 圆心 at 后缺省时默认 center',
      '  3. ellipse 必须两个半径，省略一个会用默认 closest-side',
      '  4. 非方形元素用 circle(50%) 得到的圆可能不是正圆',
      '     → 用 circle(closest-side) 保证正圆',
      '  5. 动画时圆心位置变化会触发重绘但不会重排',
    ].join('\n');
    this.setState({ circleInfo: info });
    this._addLog('css', `circle()/ellipse() 演示完成；supports=${f.circle}/${f.ellipse}`);
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const code = [
      '/* circle() 圆形剪裁 */',
      'clip-path: circle(50% at 50% 50%);',
      'clip-path: circle(closest-side at center);',
      'clip-path: circle(60px at top left);',
      '',
      '/* ellipse() 椭圆剪裁 */',
      'clip-path: ellipse(50% 35% at center);',
      'clip-path: ellipse(closest-side farthest-side at 50% 50%);',
      '',
      '/* 圆形展开动画 */',
      '.reveal {',
      '  clip-path: circle(0% at 50% 50%);',
      '  transition: clip-path 0.6s ease;',
      '}',
      '.reveal.open { clip-path: circle(75% at 50% 50%); }',
    ].join('\n');
    const card = new Card({
      title: '2. circle() / ellipse() —— 圆与椭圆剪裁',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['circle()', f.circle],
          ['ellipse()', f.ellipse],
        ]),
        h(Tag, { color: 'primary' }, 'basic-shape'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'circle([<shape-radius>? [at <position>]?]) 圆形剪裁，radius 取 <length>|<percentage>|closest-side|farthest-side，position 圆心定位（center/50% 50%/top left）。ellipse([<rx> <ry>? [at <position>]?]) 椭圆剪裁，rx 水平半径 ry 垂直半径。closest-side 取圆心到最近边距离，farthest-side 取最远边。circle(50%) 在非方形元素上可能非正圆，用 circle(closest-side) 保证正圆。圆形展开动画（View Transitions 常用）：clip-path: circle(0% → 75%)。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 circle/ellipse 演示', { type: 'primary', size: 'sm', onClick: () => this._runCircleDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, code)),
        h('div', { class: 'fs-sm text-secondary' }, '可视化剪裁效果：'),
        h('div', { class: 'cp-demo' },
          h('div', { class: 'cp-box cp-circle' }, 'circle 50%'),
          h('div', { class: 'cp-box cp-ellipse' }, 'ellipse'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.circleInfo || '（点击按钮查看 circle()/ellipse() 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 3：inset() 内嵌矩形 =====================

  _runInsetDemo() {
    const f = this._flags();
    const info = [
      '===== inset() 内嵌矩形剪裁 =====',
      '',
      '【inset() 语法】',
      '  inset( <length-percentage>{1,4} [round <border-radius>]? )',
      '',
      '  /* 1-4 个边距值 + 可选 round 圆角 */',
      '  inset(10%)                  /* 四边都缩进 10% */',
      '  inset(10% 20%)              /* 上下 10%，左右 20% */',
      '  inset(10% 20% 30%)          /* 上 10%，左右 20%，下 30% */',
      '  inset(10% 20% 30% 40%)      /* 上 右 下 左（顺时针）*/',
      '  inset(10% round 50%)        /* 缩进 10% + 圆角 50% */',
      '',
      '【四值语法（与 margin/padding 一致，顺时针 上 右 下 左）】',
      '  inset(top right bottom left)',
      '',
      '  1 个值：inset(10%)           四边都 10%',
      '  2 个值：inset(10% 20%)       上下 10%，左右 20%',
      '  3 个值：inset(10% 20% 30%)   上 10%，左右 20%，下 30%',
      '  4 个值：inset(10% 20% 30% 40%)  上 右 下 左',
      '',
      '【round 圆角剪裁】',
      '  inset(10% round 50%)         /* 缩进 10% + 圆角 50%（胶囊形）*/',
      '  inset(5% round 20px)         /* 缩进 5% + 圆角 20px */',
      '  inset(0 round 25% / 50%)     /* 圆角椭圆（rx / ry 分隔）*/',
      '  inset(0 round 10px 20px 30px 40px)  /* 四角不同半径 */',
      '',
      '  /* round 取值与 border-radius 完全一致 */',
      '  round <length-percentage>{1,4} [ / <length-percentage>{1,4} ]?',
      '',
      '【inset() 与 border-radius 对比】',
      '  border-radius: 50%',
      '    - 仅圆角化背景与边框，子元素仍可能溢出圆角',
      '    - 需要 overflow: hidden 才能裁剪子元素',
      '    - 影响布局参与计算',
      '',
      '  clip-path: inset(0 round 50%)',
      '    - 强制裁剪所有内容（含子元素）到圆角内',
      '    - 不影响布局',
      '    - 圆角外内容不可见且不可交互',
      '',
      '【实战示例：圆角矩形卡片】',
      '  .card {',
      '    clip-path: inset(0 round 16px);',
      '    /* 比 border-radius:16px + overflow:hidden 更彻底 */',
      '  }',
      '',
      '【实战示例：胶囊按钮】',
      '  .pill {',
      '    clip-path: inset(0 round 999px);',
      '    /* 等价 border-radius:999px 但强制裁剪 */',
      '  }',
      '',
      '【实战示例：缩进视口（露出边框）】',
      '  .framed {',
      '    clip-path: inset(5% round 8px);',
      '    /* 四周留 5% 透明边，配合背景色做边框效果 */',
      '  }',
      '',
      '【inset() 可动画：边距可过渡】',
      '  .expand {',
      '    clip-path: inset(50% 50% 50% 50%);  /* 收缩到中心点 */',
      '    transition: clip-path 0.5s ease;',
      '  }',
      '  .expand.open {',
      '    clip-path: inset(0% 0% 0% 0%);  /* 展开到全尺寸 */',
      '  }',
      '  /* 从中心向外展开的矩形动画 */',
      '',
      '【inset() 与 polygon() 对比】',
      '  inset(10%)            矩形，4 个参数',
      '  polygon(0 0, 100% 0, 100% 100%, 0 100%)  等价 inset(0)',
      '  /* 矩形场景优先用 inset()，更简洁且支持 round 圆角 */',
      '',
      '【浏览器支持】',
      `  inset(): ${f.inset ? '✓' : '✗'} (Chrome 55+/Firefox 55+/Safari 10.1+)`,
      '',
      '【常见陷阱】',
      '  1. inset() 的值是「缩进量」不是「保留量」',
      '     → inset(10%) 表示四边缩进 10%，保留 80% 区域',
      '  2. round 圆角与 border-radius 语法一致，但仅作用于裁剪边界',
      '  3. inset(50%) 收缩到中心一条线（视觉消失）',
      '  4. inset(100%) 完全消失（保留 0 区域）',
      '  5. round 后的圆角是裁剪圆角，不影响实际盒模型圆角',
    ].join('\n');
    this.setState({ insetInfo: info });
    this._addLog('css', `inset() 演示完成；supports=${f.inset}`);
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const code = [
      '/* inset() 内嵌矩形 */',
      'clip-path: inset(10%);              /* 四边缩进 10% */',
      'clip-path: inset(10% 20% 30% 40%);  /* 上 右 下 左 */',
      '',
      '/* round 圆角剪裁 */',
      'clip-path: inset(10% round 50%);    /* 圆角矩形 */',
      'clip-path: inset(0 round 999px);    /* 胶囊 */',
      'clip-path: inset(0 round 10px / 20px);  /* 椭圆圆角 */',
      '',
      '/* 中心展开动画 */',
      '.expand { clip-path: inset(50%); transition: clip-path 0.5s; }',
      '.expand.open { clip-path: inset(0%); }',
    ].join('\n');
    const card = new Card({
      title: '3. inset() —— 内嵌矩形与 round 圆角剪裁',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['inset()', f.inset]]),
        h(Tag, { color: 'primary' }, 'basic-shape'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'inset(<length-percentage>{1,4} [round <border-radius>]?) 内嵌矩形剪裁。四值语法顺时针 上 右 下 左（与 margin 一致）。round 圆角剪裁与 border-radius 语法一致但仅作用于裁剪边界，比 border-radius + overflow:hidden 更彻底（强制裁剪子元素）。inset(10%) 是缩进量不是保留量。圆角矩形 inset(0 round 16px)、胶囊 inset(0 round 999px)。中心展开动画 inset(50% → 0%)。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 inset 演示', { type: 'primary', size: 'sm', onClick: () => this._runInsetDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, code)),
        h('div', { class: 'fs-sm text-secondary' }, '可视化剪裁效果：'),
        h('div', { class: 'cp-demo' },
          h('div', { class: 'cp-box cp-inset' }, 'inset 10%/15%'),
          h('div', { class: 'cp-box cp-inset-round' }, 'inset round'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.insetInfo || '（点击按钮查看 inset() 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 4：polygon() 多边形 =====================

  _runPolygonDemo() {
    const f = this._flags();
    const info = [
      '===== polygon() 多边形剪裁 =====',
      '',
      '【polygon() 语法】',
      '  polygon( <fill-rule>?, <length-percentage> <length-percentage># )',
      '',
      '  /* fill-rule 可选 + 至少 3 个顶点坐标 */',
      '  polygon(50% 0%, 100% 100%, 0% 100%)              /* 三角形 */',
      '  polygon(nonzero, 50% 0%, 100% 100%, 0% 100%)     /* 显式 fill-rule */',
      '  polygon(evenodd, ...)                             /* evenodd 填充规则 */',
      '',
      '【fill-rule 填充规则】',
      '  nonzero  默认值，非零环绕规则（外环+1，内环-1，非零即填充）',
      '  evenodd  奇偶规则（射线穿边奇数次填充）',
      '',
      '  /* 自相交多边形时两者结果不同 */',
      '  /* 普通凸多边形两者结果一致 */',
      '  /* 五角星等带「内孔」的形状用 evenodd 可镂空中心 */',
      '',
      '【顶点坐标语法】',
      '  每个顶点两个值：x y（水平 垂直）',
      '  <length-percentage> 支持百分比与长度',
      '  百分比相对参考盒（默认 border-box）',
      '',
      '  polygon(0 0, 100% 0, 100% 100%, 0 100%)  /* 矩形（= inset(0)）*/',
      '  polygon(50% 0%, 100% 100%, 0% 100%)      /* 三角形 */',
      '  polygon(0 0, 100% 50%, 0 100%)           /* 左指箭头 */',
      '',
      '【常见形状示例】',
      '',
      '  /* 三角形（向下）*/',
      '  .triangle-down { clip-path: polygon(50% 0%, 100% 100%, 0% 100%); }',
      '',
      '  /* 三角形（向上）*/',
      '  .triangle-up { clip-path: polygon(50% 100%, 0 0, 100% 0); }',
      '',
      '  /* 五角星 */',
      '  .star {',
      '    clip-path: polygon(',
      '      50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%,',
      '      50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%',
      '    );',
      '  }',
      '',
      '  /* 右指箭头 */',
      '  .arrow-right {',
      '    clip-path: polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%);',
      '  }',
      '',
      '  /* 梯形 */',
      '  .trapezoid { clip-path: polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%); }',
      '',
      '  /* 菱形 */',
      '  .diamond { clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%); }',
      '',
      '  /* 六边形 */',
      '  .hexagon {',
      '    clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);',
      '  }',
      '',
      '  /* 八边形 */',
      '  .octagon {',
      '    clip-path: polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%);',
      '  }',
      '',
      '  /* 消息气泡（带尾巴）*/',
      '  .speech-bubble {',
      '    clip-path: polygon(0% 0%, 100% 0%, 100% 70%, 60% 70%, 50% 100%, 40% 70%, 0% 70%);',
      '  }',
      '',
      '【polygon() 可动画：顶点数相同才能过渡】',
      '  .morph {',
      '    clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%);',
      '    transition: clip-path 0.5s ease;',
      '  }',
      '  .morph.shape2 {',
      '    clip-path: polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%);',
      '    /* 顶点数相同（4 个），可平滑过渡 */',
      '  }',
      '',
      '  /* 错误：顶点数不同无法动画 */',
      '  .a { clip-path: polygon(0 0, 100% 0, 100% 100%); }      /* 3 顶点 */',
      '  .b { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); } /* 4 顶点 */',
      '  /* a → b 不会平滑过渡（顶点数变化不可插值）*/',
      '',
      '【polygon() 配合 CSS 变量动态变形】',
      '  .flexible {',
      '    clip-path: polygon(',
      '      var(--p1) 0%,',
      '      var(--p2) 0%,',
      '      100% 100%,',
      '      0% 100%',
      '    );',
      '  }',
      '  // JS：element.style.setProperty("--p1", "20%")',
      '',
      '【浏览器支持】',
      `  polygon(): ${f.polygon ? '✓' : '✗'} (Chrome 55+/Firefox 55+/Safari 10.1+)`,
      '',
      '【常见陷阱】',
      '  1. 顶点数变化不可动画（必须保持顶点数一致）',
      '     → 想变形时用相同顶点数 + 不同坐标',
      '  2. 自相交多边形按 fill-rule 填充，默认 nonzero',
      '  3. 顶点顺序决定形状（顺时针 vs 逆时针影响 fill-rule 计算）',
      '  4. 百分比相对 border-box（默认），可用 geometry-box 修改参考盒',
      '  5. 至少 3 个顶点，否则形状无效',
      '  6. 复杂形状（如带曲线）用 path() 而非 polygon()',
    ].join('\n');
    this.setState({ polygonInfo: info });
    this._addLog('css', `polygon() 演示完成；supports=${f.polygon}`);
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const code = [
      '/* polygon() 多边形 */',
      'clip-path: polygon(50% 0%, 100% 100%, 0% 100%);  /* 三角形 */',
      'clip-path: polygon(nonzero, ...);  /* 显式 fill-rule */',
      '',
      '/* 五角星 */',
      'clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%,',
      '  79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);',
      '',
      '/* 右指箭头 */',
      'clip-path: polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%,',
      '  60% 100%, 60% 80%, 0% 80%);',
      '',
      '/* 顶点数相同时可动画过渡 */',
      '.morph { transition: clip-path 0.5s; }',
    ].join('\n');
    const card = new Card({
      title: '4. polygon() —— 多边形与 fill-rule 填充规则',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['polygon()', f.polygon]]),
        h(Tag, { color: 'primary' }, 'basic-shape'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'polygon(<fill-rule>?, <length-percentage> <length-percentage>) 多边形剪裁，至少 3 个顶点。fill-rule: nonzero（默认，非零环绕）|evenodd（奇偶，自相交时可镂空中心）。顶点坐标 x y 百分比相对 border-box。常见形状：三角形/五角星/箭头/梯形/菱形/六边形/八边形/消息气泡。可动画但顶点数必须相同（顶点数变化不可插值）。配合 CSS 变量可动态变形。复杂曲线形状用 path()。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 polygon 演示', { type: 'primary', size: 'sm', onClick: () => this._runPolygonDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, code)),
        h('div', { class: 'fs-sm text-secondary' }, '可视化剪裁效果：'),
        h('div', { class: 'cp-demo' },
          h('div', { class: 'cp-box cp-triangle' }, 'triangle'),
          h('div', { class: 'cp-box cp-star' }, 'star'),
          h('div', { class: 'cp-box cp-arrow' }, 'arrow'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.polygonInfo || '（点击按钮查看 polygon() 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 5：path() SVG 路径 =====================

  _runPathDemo() {
    const f = this._flags();
    const info = [
      '===== path() SVG 路径剪裁 =====',
      '',
      '【path() 语法】',
      '  path( [<fill-rule>?,] <string> )',
      '',
      '  /* string 是 SVG path 的 d 属性语法 */',
      '  path("M0,0 L100,0 L100,100 Z")',
      '  path(nonzero, "M0,0 L100,0 L100,100 Z")',
      '  path(evenodd, "M0,0 L100,0 L100,100 Z")',
      '',
      '【SVG path 命令（d 属性语法）】',
      '  M x,y   moveto       移动到（起点）',
      '  L x,y   lineto       画直线到',
      '  H x     horizontal   水平线到',
      '  V y     vertical     垂直线到',
      '  C x1,y1 x2,y2 x,y    curveto       三次贝塞尔曲线',
      '  Q x1,y1 x,y          quadratic     二次贝塞尔曲线',
      '  S x2,y2 x,y          smooth curveto 平滑三次贝塞尔',
      '  T x,y                smooth quadratic 平滑二次贝塞尔',
      '  A rx ry rot large sweep x,y  arc   椭圆弧',
      '  Z                    closepath     闭合路径',
      '',
      '  /* 大写命令用绝对坐标，小写命令用相对坐标 */',
      '  /* M 50,50 = 绝对移动到 (50,50) */',
      '  /* m 50,50 = 相对移动 (50,50)（从当前位置偏移）*/',
      '',
      '【path() 心形示例】',
      '  .heart {',
      '    clip-path: path(',
      '      "M50,80 C20,60 5,40 5,25 C5,12 15,5 25,5 " +',
      '      "C35,5 45,12 50,20 C55,12 65,5 75,5 " +',
      '      "C85,5 95,12 95,25 C95,40 80,60 50,80 Z"',
      '    );',
      '  }',
      '  // 100x100 坐标系，C 命令绘制贝塞尔曲线形成心形',
      '',
      '【path() 波浪示例】',
      '  .wave {',
      '    clip-path: path(',
      '      "M0,30 Q25,10 50,30 T100,30 L100,100 L0,100 Z"',
      '    );',
      '  }',
      '  // Q 二次贝塞尔，T 平滑延续，形成波浪上边',
      '',
      '【path() 三次贝塞尔复杂形状】',
      '  .blob {',
      '    clip-path: path(',
      '      "M50,0 C80,0 100,30 100,50 C100,80 70,100 50,100 " +',
      '      "C20,100 0,70 0,50 C0,20 25,0 50,0 Z"',
      '    );',
      '  }',
      '',
      '【path() 坐标系：默认相对元素自身尺寸】',
      '  path() 中的坐标是「用户单位」',
      '  默认映射到元素的 border-box（100,100 不一定是百分比）',
      '  → 元素 200x100 时 path("M100,50 ...") 中 100 是水平中点',
      '',
      '  /* 想用百分比语义需配合 geometry-box 或用 polygon() */',
      '  /* path() 不支持百分比，坐标必须是绝对数值 */',
      '',
      '【path() vs url(#clipPath) SVG 引用】',
      '',
      '  path()（CSS 内联）',
      '    + 纯 CSS 实现，无需 SVG 标记',
      '    + 可直接在样式表中声明',
      '    + 可配合 CSS 变量动态生成（部分浏览器）',
      '    - 坐标是绝对值，不能百分比自适应',
      '    - 不可动画（path 字符串不可插值）',
      '    - 复杂路径字符串维护困难',
      '',
      '  url(#clipPath)（SVG 引用）',
      '    + clipPathUnits: objectBoundingBox 可用 0-1 比例自适应',
      '    + 可在 SVG 中用 <path>/<circle>/<rect> 组合复杂形状',
      '    + 可被多个元素复用',
      '    + 支持 clip-rule 填充规则',
      '    - 需在 DOM 中定义 <clipPath> 元素',
      '    - 跨文档引用受限',
      '',
      '【path() 字符串拼接与变量】',
      '  /* 现代浏览器支持 CSS 变量替换字符串片段（实验性）*/',
      '  .dynamic {',
      '    --d: "M0,0 L100,0 L100,100 Z";',
      '    clip-path: path(var(--d));',
      '  }',
      '  /* 注：部分浏览器对 path() 内 var() 支持有限 */',
      '',
      '【浏览器支持】',
      `  path(): ${f.path ? '✓' : '✗'} (Chrome 88+/Firefox 71+/Safari 13.1+)`,
      '  较 circle()/polygon() 晚支持，旧浏览器需降级',
      '',
      '【常见陷阱】',
      '  1. path() 不可动画：path 字符串无法插值',
      '     → 想动画用 polygon（顶点数相同）或 url(#clipPath) 切换',
      '  2. path() 坐标是绝对值，不能百分比自适应元素尺寸',
      '     → 自适应形状用 polygon() 或 url(#clipPath) + objectBoundingBox',
      '  3. path() 字符串必须用引号包裹（" 或 \')',
      '  4. 复杂 path 字符串易出错，建议用 SVG 编辑器导出',
      '  5. path() 中的坐标系原点在元素 border-box 左上角',
      '  6. 路径未闭合（缺 Z）可能导致填充异常',
    ].join('\n');
    this.setState({ pathInfo: info });
    this._addLog('css', `path() 演示完成；supports=${f.path}`);
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const code = [
      '/* path() SVG 路径剪裁 */',
      'clip-path: path("M0,0 L100,0 L100,100 Z");',
      'clip-path: path(evenodd, "M50,0 L100,100 L0,100 Z");',
      '',
      '/* 心形（贝塞尔曲线）*/',
      'clip-path: path("M50,80 C20,60 5,40 5,25 C5,12 15,5 25,5',
      '  C35,5 45,12 50,20 C55,12 65,5 75,5 C85,5 95,12 95,25',
      '  C95,40 80,60 50,80 Z");',
      '',
      '/* 波浪（二次贝塞尔）*/',
      'clip-path: path("M0,30 Q25,10 50,30 T100,30 L100,100 L0,100 Z");',
      '',
      '/* 注意：path() 不可动画，坐标为绝对值 */',
    ].join('\n');
    const card = new Card({
      title: '5. path() —— SVG 路径剪裁（M/L/C/Q/Z 命令）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['path()', f.path]]),
        h(Tag, { color: 'primary' }, 'basic-shape'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'path(<fill-rule>?, <string>) SVG 路径剪裁，string 引用 SVG path d 属性语法。命令：M 移动/L 直线/H 水平/V 垂直/C 三次贝塞尔/Q 二次贝塞尔/S 平滑三次/T 平滑二次/A 椭圆弧/Z 闭合。大写绝对坐标，小写相对坐标。可绘制心形/波浪/blob 等复杂形状。path() vs url(#clipPath)：path() 纯 CSS 无需 SVG 标记但坐标绝对值不可百分比自适应且不可动画；url(#clipPath) 可 objectBoundingBox 自适应且支持 clip-rule。Chrome 88+/Firefox 71+/Safari 13.1+。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 path 演示', { type: 'primary', size: 'sm', onClick: () => this._runPathDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, code)),
        h('div', { class: 'fs-sm text-secondary' }, '可视化剪裁效果（心形 path）：'),
        h('div', { class: 'cp-demo' },
          h('div', { class: 'cp-box cp-heart' }, 'heart'),
          h('div', { class: 'cp-box cp-wave' }, 'wave'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.pathInfo || '（点击按钮查看 path() 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 6：geometry-box 几何盒 =====================

  _runGeometryBoxDemo() {
    const f = this._flags();
    const info = [
      '===== geometry-box 几何盒修饰 =====',
      '',
      '【语法】',
      '  clip-path: <basic-shape> <geometry-box>?',
      '',
      '  /* basic-shape 后可跟一个 geometry-box 修饰参考盒 */',
      '  clip-path: circle(50% at center) border-box;',
      '  clip-path: circle(50%) padding-box;',
      '  clip-path: circle(50%) content-box;',
      '  clip-path: circle(50%) margin-box;',
      '',
      '【geometry-box 取值（8 种）】',
      '  margin-box    外边距盒（含 margin）',
      '  border-box    边框盒（含 border，默认）',
      '  padding-box   内边距盒（含 padding）',
      '  content-box   内容盒（仅内容区）',
      '  fill-box      SVG 对象边界框（SVG 专用）',
      '  stroke-box    SVG 描边边界框（SVG 专用）',
      '  view-box      SVG 视口盒（SVG 专用）',
      '  none          无参考盒（= border-box）',
      '',
      '【盒模型层级（由外到内）】',
      '  margin-box ⊃ border-box ⊃ padding-box ⊃ content-box',
      '',
      '  元素 100x100，margin:10, border:5, padding:10 时：',
      '    margin-box   120x120（含 margin）',
      '    border-box   100x100（默认参考盒）',
      '    padding-box   90x90 （去 border）',
      '    content-box   70x70 （去 border + padding）',
      '',
      '【shape 相对盒模型计算】',
      '  circle(50% at center) border-box',
      '    → 50% 相对 border-box 计算，圆心在 border-box 中心',
      '',
      '  circle(50% at center) content-box',
      '    → 50% 相对 content-box 计算，圆心在 content-box 中心',
      '    → 圆裁剪区域更小（仅内容区）',
      '',
      '  polygon(50% 0%, ...) padding-box',
      '    → 顶点坐标百分比相对 padding-box 计算',
      '',
      '【不同 geometry-box 的视觉效果】',
      '  .a { clip-path: circle(50%) border-box; }   /* 圆覆盖到边框 */',
      '  .b { clip-path: circle(50%) padding-box; }  /* 圆覆盖到 padding */',
      '  .c { clip-path: circle(50%) content-box; }  /* 圆仅覆盖内容区 */',
      '  .d { clip-path: circle(50%) margin-box; }   /* 圆超出到 margin */',
      '',
      '【与 SVG 协同（fill-box/stroke-box/view-box）】',
      '  fill-box    SVG 元素的「对象边界框」',
      '              对于 <rect>/<circle> 等是几何边界',
      '              对于 <g> 是子元素并集边界',
      '',
      '  stroke-box  SVG 元素的「描边边界框」（含描边宽度）',
      '              规范较新，浏览器支持有限',
      '',
      '  view-box    SVG 根元素的 viewBox 属性定义的坐标系',
      '              clip-path: circle(50%) view-box 适合 SVG 内部剪裁',
      '',
      '  /* SVG 内部使用 geometry-box 示例 */',
      '  svg .clipped {',
      '    clip-path: circle(50% at center) fill-box;',
      '  }',
      '',
      '【仅 geometry-box 无 basic-shape 的特殊情况】',
      '  clip-path: padding-box;   /* 等价 inset(0) padding-box */',
      '  clip-path: content-box;   /* 等价 inset(0) content-box */',
      '  /* 规范允许仅写 geometry-box，作为矩形裁剪 */',
      '  /* 浏览器支持不一，建议显式写 inset(0) <box> */',
      '',
      '【实战：内容区圆形裁剪（保留 padding 显示）】',
      '  .badge {',
      '    padding: 12px;',
      '    background: #3b82f6;',
      '    clip-path: circle(50% at center) content-box;',
      '    /* padding 区域不被裁剪（外圈方形边），内容区圆形 */',
      '  }',
      '',
      '【实战：边框外裁剪（margin-box 让圆超出）】',
      '  .floating {',
      '    margin: 10px;',
      '    clip-path: circle(60%) margin-box;',
      '    /* 圆形超出元素边界进入 margin 区域 */',
      '  }',
      '',
      '【浏览器支持】',
      `  geometry-box: ${f.geometryBox ? '✓' : '✗'} (Chrome 55+/Firefox 55+)`,
      '  fill-box/stroke-box/view-box：SVG 场景支持',
      '  Safari 对部分 geometry-box 支持不完整',
      '',
      '【常见陷阱】',
      '  1. 默认 geometry-box 是 border-box，省略时按 border-box 计算',
      '  2. content-box 会让裁剪区域变小（去 border + padding）',
      '  3. margin-box 让裁剪区域超出元素边界（含 margin）',
      '     → 但 margin 区域本无背景，需配合背景设置',
      '  4. SVG 中使用 margin-box/border-box 等无意义，应用 fill-box/view-box',
      '  5. 不同浏览器对 fill-box/stroke-box 实现差异较大',
      '  6. 旧 Safari 不支持 geometry-box，需 -webkit-clip-path 前缀',
    ].join('\n');
    this.setState({ geometryBoxInfo: info });
    this._addLog('css', `geometry-box 演示完成；supports=${f.geometryBox}`);
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const code = [
      '/* geometry-box 修饰参考盒 */',
      'clip-path: circle(50% at center) border-box;   /* 默认 */',
      'clip-path: circle(50% at center) padding-box;',
      'clip-path: circle(50% at center) content-box;',
      'clip-path: circle(50% at center) margin-box;',
      '',
      '/* SVG 专用 geometry-box */',
      'clip-path: circle(50%) fill-box;',
      'clip-path: circle(50%) stroke-box;',
      'clip-path: circle(50%) view-box;',
      '',
      '/* 仅 geometry-box（等价 inset(0) <box>）*/',
      'clip-path: padding-box;',
    ].join('\n');
    const card = new Card({
      title: '6. geometry-box —— 几何盒修饰（margin/border/padding/content/fill/stroke/view-box）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['geometry-box', f.geometryBox]]),
        h(Tag, { color: 'primary' }, 'Masking L1'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'clip-path: <basic-shape> <geometry-box> 修饰参考盒。8 种取值：margin-box（含 margin）/border-box（默认，含 border）/padding-box（含 padding）/content-box（仅内容）/fill-box（SVG 对象边界）/stroke-box（SVG 描边边界）/view-box（SVG 视口）/none。shape 相对参考盒计算百分比与圆心。盒模型层级 margin-box ⊃ border-box ⊃ padding-box ⊃ content-box。SVG 场景用 fill-box/view-box。Safari 部分支持需 -webkit- 前缀。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 geometry-box 演示', { type: 'primary', size: 'sm', onClick: () => this._runGeometryBoxDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, code)),
        h('div', { class: 'fs-sm text-secondary' }, '可视化剪裁效果（border-box vs content-box）：'),
        h('div', { class: 'cp-demo' },
          h('div', { class: 'cp-box cp-geo-border' }, 'border-box'),
          h('div', { class: 'cp-box cp-geo-content' }, 'content-box'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.geometryBoxInfo || '（点击按钮查看 geometry-box 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 7：clip-rule 与 url(#clipPath) SVG 引用 =====================

  _runSvgClipDemo() {
    const f = this._flags();
    const info = [
      '===== clip-rule 与 url(#clipPath) SVG 引用 =====',
      '',
      '【SVG <clipPath> 元素】',
      '  <svg width="0" height="0" style="position:absolute">',
      '    <defs>',
      '      <clipPath id="myClip">',
      '        <circle cx="50" cy="50" r="40"/>',
      '        <rect x="0" y="0" width="50" height="50"/>',
      '      </clipPath>',
      '    </defs>',
      '  </svg>',
      '',
      '  /* CSS 引用 */',
      '  .clipped { clip-path: url(#myClip); }',
      '',
      '【clipPathUnits 坐标系】',
      '  userSpaceOnUse（默认）',
      '    - 子元素坐标用「用户空间」绝对值',
      '    - 如 <circle cx="50" cy="50" r="40"/> 是绝对像素',
      '    - 适合固定尺寸剪裁',
      '',
      '  objectBoundingBox',
      '    - 子元素坐标用 0-1 比例（相对元素边界框）',
      '    - 如 <circle cx="0.5" cy="0.5" r="0.4"/> 是 50%/50%/40%',
      '    - 适合自适应尺寸剪裁',
      '',
      '  /* objectBoundingBox 示例 */',
      '  <clipPath id="adaptive" clipPathUnits="objectBoundingBox">',
      '    <circle cx="0.5" cy="0.5" r="0.5"/>',
      '  </clipPath>',
      '  /* 任意尺寸元素引用都是正圆裁剪 */',
      '',
      '【clip-rule 填充规则】',
      '  clip-rule: nonzero（默认）  非零环绕规则',
      '  clip-rule: evenodd          奇偶规则',
      '',
      '  /* clip-rule 作用于 <clipPath> 内的子元素 */',
      '  /* 仅对 url(#clipPath) 引用生效，对 basic-shape 无效 */',
      '  <clipPath id="star" clip-rule="evenodd">',
      '    <polygon points="50,5 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35"/>',
      '  </clipPath>',
      '',
      '【SVG 内复杂剪裁路径定义】',
      '  <!-- 多形状组合剪裁 -->',
      '  <clipPath id="compound">',
      '    <circle cx="30" cy="50" r="30"/>',
      '    <rect x="50" y="20" width="50" height="60"/>',
      '    <path d="M100,50 L150,20 L150,80 Z"/>',
      '  </clipPath>',
      '  <!-- 三个形状的并集作为剪裁区域 -->',
      '',
      '  <!-- 文字剪裁 -->',
      '  <clipPath id="textClip">',
      '    <text x="0" y="50" font-size="40" font-weight="bold">CLIP</text>',
      '  </clipPath>',
      '  .text-mask { clip-path: url(#textClip); }',
      '  <!-- 元素内容仅在文字笔画范围内可见 -->',
      '',
      '【CSS clip-rule 属性（独立于 clip-path）】',
      '  /* CSS 中可单独声明 clip-rule */',
      '  .clipped {',
      '    clip-path: url(#myClip);',
      '    clip-rule: evenodd;',
      '  }',
      '  /* 覆盖 <clipPath> 的 clip-rule 属性 */',
      '',
      '【url(#clipPath) vs basic-shape 对比】',
      '',
      '  url(#clipPath)',
      '    + 支持任意 SVG 形状组合（circle/rect/path/text 混合）',
      '    + clipPathUnits: objectBoundingBox 可自适应',
      '    + clip-rule 控制 fill-rule',
      '    + 可被多元素复用',
      '    + 支持文字剪裁',
      '    - 需在 DOM 中定义 <clipPath>',
      '    - 跨文档引用（url(foreign.svg#clip)）支持有限',
      '',
      '  basic-shape (circle/polygon/path)',
      '    + 纯 CSS，无需 SVG 标记',
      '    + 可直接在样式表声明',
      '    + path() 可绘制复杂曲线',
      '    - path() 坐标绝对值不可自适应',
      '    - path() 不可动画',
      '    - 无 clip-rule（fill-rule 内联在函数中）',
      '',
      '【跨文档 SVG 引用（受限）】',
      '  /* 同文档引用 */',
      '  clip-path: url(#myClip);',
      '',
      '  /* 跨文档引用（部分浏览器支持）*/',
      '  clip-path: url(assets/clips.svg#myClip);',
      '  /* Firefox 支持较好，Chrome/Safari 受限 */',
      '',
      '【实战：可复用圆形剪裁】',
      '  <svg width="0" height="0">',
      '    <defs>',
      '      <clipPath id="circleClip" clipPathUnits="objectBoundingBox">',
      '        <circle cx="0.5" cy="0.5" r="0.5"/>',
      '      </clipPath>',
      '    </defs>',
      '  </svg>',
      '  .avatar-1, .avatar-2, .avatar-3 {',
      '    clip-path: url(#circleClip);',
      '  }',
      '  /* 三个头像元素共享同一剪裁定义，自适应各自尺寸 */',
      '',
      '【浏览器支持】',
      `  url(#clipPath): ${f.urlClip ? '✓' : '✗'} (所有现代浏览器，含 IE9+)`,
      '  clipPathUnits: objectBoundingBox：全支持',
      '  clip-rule: 全支持',
      '  跨文档 url(file.svg#id)：Firefox 支持，Chrome/Safari 受限',
      '',
      '【常见陷阱】',
      '  1. <clipPath> 必须在 <defs> 内（规范要求，否则部分浏览器不识别）',
      '  2. clipPathUnits 默认 userSpaceOnUse（绝对坐标）',
      '     → 想自适应用 objectBoundingBox（0-1 比例）',
      '  3. clip-rule 仅对 url(#clipPath) 生效，对 basic-shape 无效',
      '  4. <clipPath> 子元素的 fill/stroke 不影响剪裁（仅几何形状有效）',
      '  5. 引用不存在的 id 时元素不裁剪（静默失败）',
      '  6. SVG <clipPath> 需挂载到 DOM（display:none 的 svg 也可）',
    ].join('\n');
    this.setState({ svgClipInfo: info });
    this._addLog('css', `clip-rule/url(#clipPath) 演示完成；supports=${f.urlClip}`);
  }

  _renderCard7() {
    const s = this.state;
    const f = this._flags();
    const code = [
      '/* SVG <clipPath> 定义 */',
      '<svg width="0" height="0" style="position:absolute">',
      '  <defs>',
      '    <clipPath id="myClip" clipPathUnits="objectBoundingBox">',
      '      <circle cx="0.5" cy="0.5" r="0.5"/>',
      '    </clipPath>',
      '  </defs>',
      '</svg>',
      '',
      '/* CSS 引用 */',
      '.clipped { clip-path: url(#myClip); }',
      '.clipped-alt { clip-path: url(#myClip); clip-rule: evenodd; }',
      '',
      '/* 复杂组合剪裁（多形状并集）*/',
      '<clipPath id="compound">',
      '  <circle cx="30" cy="50" r="30"/>',
      '  <rect x="50" y="20" width="50" height="60"/>',
      '</clipPath>',
    ].join('\n');
    const card = new Card({
      title: '7. clip-rule 与 url(#clipPath) SVG 引用（clipPathUnits / 复杂剪裁）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['url(#clip)', f.urlClip]]),
        h(Tag, { color: 'primary' }, 'SVG Masking'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'SVG <clipPath> 元素定义剪裁路径，clip-path: url(#myClip) 引用。clipPathUnits: userSpaceOnUse（默认，绝对坐标）|objectBoundingBox（0-1 比例自适应）。clip-rule: nonzero（默认）|evenodd 填充规则，仅对 url(#clipPath) 生效对 basic-shape 无效。SVG 内可组合多形状（circle/rect/path/text）并集作为剪裁区域。文字剪裁 url(#textClip) 实现文字遮罩。可被多元素复用。所有现代浏览器含 IE9+ 支持。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 SVG clip 演示', { type: 'primary', size: 'sm', onClick: () => this._runSvgClipDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, code)),
        h('div', { class: 'fs-sm text-secondary' }, '可视化剪裁效果（url(#clipPath) 圆形）：'),
        h('div', { class: 'cp-demo' },
          h('div', { class: 'cp-box cp-circle' }, 'url clip'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.svgClipInfo || '（点击按钮查看 clip-rule 与 url(#clipPath) 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 8：实战模式与陷阱 =====================

  _runPatternDemo() {
    const f = this._flags();
    const info = [
      '===== 实战模式与陷阱清单 =====',
      '',
      '【模式 1：圆形头像（clip-path vs border-radius）】',
      '  /* 方案 A：clip-path: circle() */',
      '  .avatar-clip {',
      '    width: 80px;',
      '    height: 80px;',
      '    clip-path: circle(50% at 50% 50%);',
      '    /* 或 circle(closest-side) 保证正圆 */',
      '  }',
      '',
      '  /* 方案 B：border-radius: 50% */',
      '  .avatar-radius {',
      '    width: 80px;',
      '    height: 80px;',
      '    border-radius: 50%;',
      '    overflow: hidden;   /* 需配合 overflow 裁剪子元素 */',
      '  }',
      '',
      '  /* 对比 */',
      '  clip-path: 强制裁剪所有内容（含子元素），不影响布局',
      '  border-radius: 需 overflow:hidden 才裁剪子元素，影响滚动',
      '  → 纯图片头像两者皆可；含子元素用 clip-path 更彻底',
      '',
      '【模式 2：箭头标签（polygon）】',
      '  .tag-arrow {',
      '    padding: 6px 16px 6px 24px;',
      '    background: #3b82f6;',
      '    color: #fff;',
      '    clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 8% 50%);',
      '    /* 左侧三角缺口形成箭头标签 */',
      '  }',
      '',
      '【模式 3：波浪分隔（path 或 polygon）】',
      '  .wave-divider {',
      '    height: 60px;',
      '    background: #3b82f6;',
      '    clip-path: path("M0,30 Q25,10 50,30 T100,30 L100,60 L0,60 Z");',
      '  }',
      '  /* 或用 polygon 锯齿 */',
      '  .zigzag {',
      '    clip-path: polygon(',
      '      0% 30%, 10% 60%, 20% 30%, 30% 60%, 40% 30%,',
      '      50% 60%, 60% 30%, 70% 60%, 80% 30%, 90% 60%,',
      '      100% 30%, 100% 100%, 0% 100%',
      '    );',
      '  }',
      '',
      '【模式 4：文字遮罩动画（clip-path 配合 animation）】',
      '  /* 方案 A：clip-path 圆形展开 */',
      '  .text-reveal {',
      '    clip-path: circle(0% at 0% 50%);',
      '    animation: reveal 2s ease forwards;',
      '  }',
      '  @keyframes reveal {',
      '    to { clip-path: circle(150% at 100% 50%); }',
      '  }',
      '  /* 文字从左向右圆形展开显示 */',
      '',
      '  /* 方案 B：background-clip: text + 渐变动画 */',
      '  .shimmer {',
      '    background: linear-gradient(90deg, #3b82f6, #ec4899, #3b82f6);',
      '    background-size: 200% auto;',
      '    -webkit-background-clip: text;',
      '    background-clip: text;',
      '    color: transparent;',
      '    animation: shimmer 3s linear infinite;',
      '  }',
      '  @keyframes shimmer {',
      '    to { background-position: 200% center; }',
      '  }',
      '',
      '【模式 5：clipped 视频/图片】',
      '  /* 圆形视频 */',
      '  .video-circle video {',
      '    clip-path: circle(50%);',
      '    /* 视频内容裁剪为圆形 */',
      '  }',
      '',
      '  /* 多边形图片框 */',
      '  .img-hexagon img {',
      '    clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);',
      '  }',
      '',
      '  /* 不规则形状图片 */',
      '  .img-blob img {',
      '    clip-path: path("M50,0 C80,0 100,30 100,50 C100,80 70,100 50,100 C20,100 0,70 0,50 C0,20 25,0 50,0 Z");',
      '  }',
      '',
      '【模式 6：卡片斜角（polygon 切角）】',
      '  .card-bevel {',
      '    clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%);',
      '    /* 右上角斜切 14px */',
      '  }',
      '',
      '  /* 双斜角 */',
      '  .card-double {',
      '    clip-path: polygon(0 14px, 14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px));',
      '  }',
      '',
      '【模式 7：View Transitions 圆形展开（clip-path 经典用法）】',
      '  function navigate() {',
      '    const transition = document.startViewTransition(() => {',
      '      updateDOM();',
      '    });',
      '    transition.ready.then(() => {',
      '      document.documentElement.animate(',
      '        [',
      '          { clipPath: "circle(0% at 50% 50%)" },',
      '          { clipPath: "circle(100% at 50% 50%)" }',
      '        ],',
      '        { duration: 500, easing: "ease-in-out",',
      '          pseudoElement: "::view-transition-new(root)" }',
      '      );',
      '    });',
      '  }',
      '  /* clip-path: circle() 是 View Transitions 圆形展开的核心 */',
      '',
      '【模式 8：tooltip 三角尾巴（polygon）】',
      '  .tooltip-tail {',
      '    clip-path: polygon(50% 0%, 0% 100%, 100% 100%);',
      '    width: 12px;',
      '    height: 8px;',
      '    background: #1e293b;',
      '  }',
      '',
      '【模式 9：渐变蒙版边缘（clip-path + mask 配合）】',
      '  .faded {',
      '    clip-path: inset(0 round 16px);',
      '    mask-image: linear-gradient(to bottom, black 70%, transparent);',
      '    -webkit-mask-image: linear-gradient(to bottom, black 70%, transparent);',
      '  }',
      '  /* clip-path 硬切圆角 + mask 渐变羽化底部 */',
      '',
      '【陷阱清单】',
      '',
      '  1. clip-path 不影响布局，元素仍占原空间',
      '     → 裁剪不等于 display:none，周边元素不会重排',
      '     → 想真正隐藏并释放空间用 display:none 或 visibility:hidden',
      '',
      '  2. clip-path 无法 transition 除非形状参数兼容',
      '     → circle(0% → 50%) 可动画（同为 circle，半径插值）',
      '     → circle(50%) → polygon(...) 不可动画（不同函数）',
      '',
      '  3. polygon() 点数变化不可动画',
      '     → polygon(3 点) → polygon(4 点) 不可插值',
      '     → 必须保持顶点数一致，仅坐标变化可动画',
      '',
      '  4. path() 不可动画',
      '     → path 字符串无法插值',
      '     → 想动画用 polygon 或 url(#clipPath) 切换',
      '',
      '  5. border-box vs content-box 差异',
      '     → 默认 border-box（含 border）',
      '     → content-box 时裁剪区域去 border + padding，圆更小',
      '     → 不同 box 视觉差异明显，需明确指定',
      '',
      '  6. 旧 -webkit-clip-path 前缀',
      '     → iOS Safari 9- 需 -webkit-clip-path',
      '     → 现代浏览器已无需前缀，但兼容旧设备建议双写',
      '     → -webkit-clip-path: circle(50%); clip-path: circle(50%);',
      '',
      '  7. Safari 兼容性',
      '     → path() 需 Safari 13.1+',
      '     → geometry-box 部分支持',
      '     → clipPathUnits: objectBoundingBox 全支持',
      '',
      '  8. 裁剪区域外不响应 pointer-events',
      '     → 点击穿透到下层元素（不同于 visibility:hidden）',
      '     → 想保留点击区域用透明 background + clip-path 视觉裁剪',
      '',
      '  9. clip-path 与 filter 组合顺序',
      '     → filter 在 clip-path 之后应用（先裁剪再滤镜）',
      '     → 滤镜可能扩展可见区域超出裁剪边界',
      '',
      '  10. 性能：clip-path 触发 paint 不触发 layout',
      '      → 比 transform/opacity 略慢但优于 width/height',
      '      → 动画时配合 will-change: clip-path 提示浏览器',
      '',
      '【浏览器支持总览】',
      `  circle/ellipse/inset/polygon: ${f.circle ? '✓' : '✗'} (Chrome 55+/Firefox 55+/Safari 10.1+)`,
      `  path(): ${f.path ? '✓' : '✗'} (Chrome 88+/Firefox 71+/Safari 13.1+)`,
      `  geometry-box: ${f.geometryBox ? '✓' : '✗'} (Chrome 55+/Firefox 55+/Safari 部分)`,
      `  url(#clipPath): ${f.urlClip ? '✓' : '✗'} (所有现代浏览器，含 IE9+)`,
      '',
      '【资源】',
      '  - CSS Masking Module Level 1：https://drafts.fxtf.org/css-masking-1/',
      '  - clip-path MDN：https://developer.mozilla.org/docs/Web/CSS/clip-path',
      '  - Clippy 在线生成器：https://bennettfeely.com/clippy/',
      '  - SVG clipPath MDN：https://developer.mozilla.org/docs/Web/SVG/Element/clipPath',
    ].join('\n');
    this.setState({ patternInfo: info });
    this._addLog('css', '实战模式与陷阱演示完成');
  }

  _renderCard8() {
    const s = this.state;
    const f = this._flags();
    const code = [
      '/* 圆形头像 */',
      '.avatar { clip-path: circle(50%); }',
      '',
      '/* 箭头标签 */',
      '.tag { clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 8% 50%); }',
      '',
      '/* 波浪分隔 */',
      '.wave { clip-path: path("M0,30 Q25,10 50,30 T100,30 L100,60 L0,60 Z"); }',
      '',
      '/* 卡片斜角 */',
      '.bevel { clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%); }',
      '',
      '/* View Transitions 圆形展开 */',
      'document.documentElement.animate([',
      '  { clipPath: "circle(0% at 50% 50%)" },',
      '  { clipPath: "circle(100% at 50% 50%)" }',
      '], { pseudoElement: "::view-transition-new(root)" });',
    ].join('\n');
    const card = new Card({
      title: '8. 实战模式与陷阱清单（头像/箭头/波浪/文字遮罩/斜角/View Transitions）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, '实战'),
        h(Tag, { color: f.circle ? 'success' : 'error' }, `clip-path ${f.circle ? '✓' : '✗'}`),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '9 种实战模式：圆形头像（clip-path: circle() vs border-radius:50%）、箭头标签（polygon 缺口）、波浪分隔（path 贝塞尔/polygon 锯齿）、文字遮罩动画（clip-path 圆形展开 + background-clip:text 渐变）、clipped 视频/图片、卡片斜角（polygon 切角）、View Transitions 圆形展开（clip-path: circle() 经典）、tooltip 尾巴、渐变蒙版边缘。陷阱清单 10 条：不影响布局仍占原空间/无法 transition 除非形状参数兼容/polygon 点数变化不可动画/path() 不可动画/border-box vs content-box 差异/旧 -webkit-clip-path 前缀/Safari 兼容性/裁剪外不响应 pointer-events/filter 组合顺序/性能触发 paint。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行实战模式演示', { type: 'primary', size: 'sm', onClick: () => this._runPatternDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, code)),
        h('div', { class: 'fs-sm text-secondary' }, '可视化效果：圆形头像 / 卡片斜角 / 文字遮罩动画'),
        h('div', { class: 'cp-demo' },
          h('div', { class: 'cp-avatar' }),
          h('div', { class: 'cp-card-bevel' }, 'BEVEL'),
          h('div', { class: 'cp-text-mask' }, 'CLIP PATH'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.patternInfo || '（点击按钮查看 9 种实战模式与 10 条陷阱清单完整代码）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 9：object-view-box 替换元素视图裁剪 =====================

  _runObjectViewBoxDemo() {
    const f = this._flags();
    const ovb = f.ovbInset || f.ovbCircle || f.ovbNone;
    const info = [
      '===== object-view-box 替换元素视图裁剪 =====',
      '',
      '【概述】',
      '  object-view-box 是 CSSWG 提案中的新属性（csswg-drafts#8530）',
      '  类似 clip-path，但专用于 <img>/<video> 等 replaced element 的视图裁剪',
      '  仅裁剪替换元素的内容（图像/视频帧），不影响元素盒模型布局',
      '  与 object-fit 协同工作：先裁剪内容，再由 object-fit 缩放',
      '',
      '  /* 浏览器支持 */',
      `  Chrome 124+ 支持（${ovb ? '✓ 当前环境检测到支持' : '✗ 当前环境不支持'}）`,
      '  Safari / Firefox 暂未实现（截至 2024 年）',
      '  可通过 @supports 降级到 clip-path',
      '',
      '【基本语法】',
      '  object-view-box: <basic-shape> | none',
      '  默认值: none（不裁剪）',
      '',
      '  /* 接受 <basic-shape> 函数，与 clip-path 共用语法 */',
      '  object-view-box: inset(10% 10% 10% 10%);   /* 内嵌矩形裁剪 */',
      '  object-view-box: circle(50% at center);     /* 圆形裁剪 */',
      '  object-view-box: ellipse(50% 35%);          /* 椭圆裁剪 */',
      '  object-view-box: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%);  /* 多边形 */',
      '',
      '  /* 与 clip-path 的 basic-shape 语法完全一致 */',
      '  /* circle()/ellipse()/inset()/polygon() 均可使用 */',
      '  /* path() 支持视实现而定 */',
      '',
      '【与 object-fit 协同 —— 先裁剪再缩放】',
      '  object-fit 控制内容如何缩放填充元素盒',
      '  object-view-box 控制裁剪内容区域',
      '  二者组合：先按 object-view-box 裁剪图像，再按 object-fit 缩放到元素盒',
      '',
      '  object-fit 取值：',
      '    fill       拉伸填满（默认，破坏比例）',
      '    contain    完整显示（留白）',
      '    cover      覆盖填满（裁剪溢出）',
      '    none       原始尺寸',
      '    scale-down 取 none 与 contain 中较小者',
      '',
      '  /* 组合示例：先裁剪中心 60% 区域，再 cover 填满 */',
      '  .thumb {',
      '    width: 120px;',
      '    height: 120px;',
      '    object-fit: cover;',
      '    object-view-box: inset(20% 20% 20% 20%);',
      '  }',
      '',
      '【与 object-position 协同】',
      '  object-position 控制裁剪后内容在元素盒内的位置',
      '  优先级：object-view-box 裁剪 → object-fit 缩放 → object-position 定位',
      '',
      '  .img {',
      '    object-fit: cover;',
      '    object-view-box: inset(10%);',
      '    object-position: center top;  /* 裁剪后内容靠上居中 */',
      '  }',
      '',
      '【object-view-box vs clip-path —— 核心区别】',
      '',
      '  object-view-box',
      '    + 仅影响 replaced element 的内容渲染（图像/视频帧）',
      '    + 不影响元素盒模型（边框/背景/outline 仍完整显示）',
      '    + 与 object-fit/object-position 协同（先裁剪再缩放）',
      '    + 不创建新的 stacking context（部分实现差异）',
      '    + 性能更优（仅裁剪内容，不触发额外合成层）',
      '    - 仅作用于 <img>/<video>/<canvas>/<iframe> 等 replaced element',
      '    - 浏览器支持有限（Chrome 124+，Safari/Firefox 未实现）',
      '',
      '  clip-path',
      '    + 影响整个元素（含边框、背景、子元素、outline）',
      '    + 作用于任何元素（含 div/span/SVG）',
      '    + 创建新的 stacking context',
      '    + 浏览器支持广泛（Chrome 55+/Firefox 55+/Safari 10.1+）',
      '    - 裁剪边框与背景（无法保留元素装饰）',
      '    - 与 object-fit 无协同（裁剪基于元素盒，非内容）',
      '',
      '  /* 对比示例 */',
      '  /* clip-path 会裁掉边框，object-view-box 仅裁剪图像内容 */',
      '  .a { clip-path: inset(10%); }              /* 边框也被裁剪 */',
      '  .b { object-view-box: inset(10%); }        /* 边框保留，仅图像裁剪 */',
      '',
      '【实战 1：图像缩略图裁剪】',
      '  /* 图片裁剪为方形缩略图（先裁中心区域再 cover 缩放）*/',
      '  .thumbnail {',
      '    width: 100px;',
      '    height: 100px;',
      '    object-fit: cover;',
      '    object-view-box: inset(15% 15% 15% 15%);',
      '    /* 裁掉图像四周 15%，再 cover 填满 100x100 */',
      '  }',
      '',
      '  /* 圆形头像（仅图像裁圆，边框保留）*/',
      '  .avatar-img {',
      '    width: 80px;',
      '    height: 80px;',
      '    border: 3px solid #3b82f6;',
      '    border-radius: 50%;',
      '    object-fit: cover;',
      '    object-view-box: circle(50% at center);',
      '    /* 图像裁为圆形，外圈边框完整显示 */',
      '  }',
      '',
      '  /* 响应式图像裁剪：不同视口裁剪不同区域 */',
      '  .responsive {',
      '    object-fit: cover;',
      '    object-view-box: inset(0 25% 0 25%);  /* 默认裁左右，保留中心 */',
      '  }',
      '  @media (max-width: 768px) {',
      '    .responsive {',
      '      object-view-box: inset(25% 0 25% 0);  /* 移动端裁上下 */',
      '    }',
      '  }',
      '',
      '  /* 与 <picture> + srcset 协同 */',
      '  <picture>',
      '    <source srcset="wide.jpg" media="(min-width: 1024px)">',
      '    <img src="narrow.jpg" class="responsive">',
      '  </picture>',
      '  /* srcset 选择不同图像源，object-view-box 统一裁剪策略 */',
      '',
      '【实战 2：视频播放器裁剪】',
      '  /* 视频去黑边（letterbox 区域）*/',
      '  .video-cropped video {',
      '    width: 100%;',
      '    height: auto;',
      '    object-fit: cover;',
      '    object-view-box: inset(8% 0 8% 0);  /* 裁掉上下黑边 */',
      '  }',
      '',
      '  /* 16:9 → 4:3 裁剪（裁掉左右）*/',
      '  .video-43 video {',
      '    aspect-ratio: 4 / 3;',
      '    object-fit: cover;',
      '    object-view-box: inset(0 12.5% 0 12.5%);  /* 裁掉左右各 12.5% */',
      '  }',
      '',
      '  /* 实时裁剪切换（JS 动态更新）*/',
      '  const video = document.querySelector("video");',
      '  function cropTo(ratio) {',
      '    if (ratio === "16:9") {',
      '      video.style.objectViewBox = "inset(0)";',
      '    } else if (ratio === "4:3") {',
      '      video.style.objectViewBox = "inset(0 12.5%)";',
      '    } else if (ratio === "1:1") {',
      '      video.style.objectViewBox = "inset(22% 12.5%)";',
      '    }',
      '  }',
      '',
      '  /* 性能考虑：object-view-box 裁剪由 GPU 合成，性能优于 clip-path */',
      '  /* 视频实时裁剪不会触发 layout，仅 paint/composite */',
      '  /* 大量视频裁剪时仍需注意内存与解码开销 */',
      '',
      '【陷阱清单】',
      '',
      '  1. 仅 replaced element 生效',
      '     → <img>/<video>/<canvas>/<iframe> 等替换元素',
      '     → <div>/<span> 等非替换元素无效（用 clip-path 替代）',
      '',
      '  2. 浏览器支持有限',
      '     → 仅 Chrome 124+ 支持',
      '     → Safari/Firefox 暂未实现',
      '     → 生产环境必须降级',
      '',
      '  3. 降级到 clip-path',
      '     /* 现代浏览器用 object-view-box，旧浏览器降级 clip-path */',
      '     .img {',
      '       clip-path: inset(10%);  /* 降级方案 */',
      '     }',
      '     @supports (object-view-box: inset(10%)) {',
      '       .img {',
      '         clip-path: none;',
      '         object-view-box: inset(10%);',
      '       }',
      '     }',
      '',
      '  4. 与 object-position 优先级',
      '     → object-view-box 先裁剪内容',
      '     → object-fit 再缩放裁剪后内容',
      '     → object-position 最后定位',
      '     → 顺序错误会导致裁剪位置不符合预期',
      '',
      '  5. DevTools 调试',
      '     → Chrome DevTools Styles 面板可查看 object-view-box',
      '     → 裁剪区域无法直接可视化（不像 clip-path 有 overlay）',
      '     → 需配合 object-fit 观察',
      '',
      '  6. 与 object-fit: contain 的交互',
      '     → contain 保留比例留白，object-view-box 裁剪后再 contain',
      '     → 裁剪改变了内容比例，contain 行为可能出乎预期',
      '',
      '【浏览器支持总览】',
      `  object-view-box: inset(): ${f.ovbInset ? '✓' : '✗'}`,
      `  object-view-box: circle(): ${f.ovbCircle ? '✓' : '✗'}`,
      `  object-view-box: none: ${f.ovbNone ? '✓' : '✗'}`,
      '  实际支持：Chrome 124+（2024 年 5 月起）',
      '  Safari/Firefox：暂未实现',
      '',
      '【资源】',
      '  - CSSWG 提案：https://github.com/w3c/csswg-drafts/issues/8530',
      '  - MDN object-view-box：https://developer.mozilla.org/docs/Web/CSS/object-view-box',
    ].join('\n');
    this.setState({ objectViewBoxInfo: info });
    this._addLog('css', `object-view-box 演示完成；supports=${f.ovbInset}/${f.ovbCircle}/${f.ovbNone}`);
  }

  _renderCard9() {
    const s = this.state;
    const f = this._flags();
    const ovb = f.ovbInset || f.ovbCircle || f.ovbNone;
    const code = [
      '/* object-view-box 基本语法 */',
      'object-view-box: none;                    /* 默认，不裁剪 */',
      'object-view-box: inset(10% 10% 10% 10%);  /* 内嵌矩形 */',
      'object-view-box: circle(50% at center);   /* 圆形 */',
      'object-view-box: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%);',
      '',
      '/* 与 object-fit 协同：先裁剪再缩放 */',
      '.thumb {',
      '  width: 120px;',
      '  height: 120px;',
      '  object-fit: cover;',
      '  object-view-box: inset(20%);',
      '}',
      '',
      '/* 降级到 clip-path */',
      '.img { clip-path: inset(10%); }',
      '@supports (object-view-box: inset(10%)) {',
      '  .img { clip-path: none; object-view-box: inset(10%); }',
      '}',
    ].join('\n');
    const card = new Card({
      title: '9. object-view-box —— 替换元素视图裁剪（<img>/<video> 专用，Chrome 124+）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['inset()', f.ovbInset],
          ['circle()', f.ovbCircle],
          ['none', f.ovbNone],
        ]),
        h(Tag, { color: 'primary' }, 'CSSWG 提案'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'object-view-box: <basic-shape>|none，CSSWG 提案新属性，专用于 <img>/<video> 等 replaced element 的视图裁剪。接受 inset()/circle()/ellipse()/polygon() 等 basic-shape（与 clip-path 共用语法），默认值 none。与 object-fit 协同：先按 object-view-box 裁剪内容，再由 object-fit 缩放填充元素盒，object-position 定位。vs clip-path：object-view-box 仅裁剪替换元素内容（不影响边框/背景/盒模型），clip-path 裁剪整个元素。仅 Chrome 124+ 支持，Safari/Firefox 未实现，需 @supports 降级到 clip-path。实战：图像方形缩略图、圆形头像、视频去黑边、16:9→4:3 裁剪、响应式裁剪。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 object-view-box 演示', { type: 'primary', size: 'sm', onClick: () => this._runObjectViewBoxDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, code)),
        h('div', { class: 'fs-sm text-secondary' }, '可视化效果（object-view-box 仅作用于 img/video，下方 img 示意）：'),
        h('div', { class: 'cp-demo' },
          h('img', { class: 'cp-ovb-img cp-ovb-inset', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="%23f59e0b"/><circle cx="120" cy="60" r="40" fill="%23fff"/><rect x="40" y="110" width="160" height="20" fill="%23fff"/></svg>', alt: 'ovb inset' }),
          h('img', { class: 'cp-ovb-img cp-ovb-circle', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="%233b82f6"/><circle cx="120" cy="80" r="50" fill="%23fff"/></svg>', alt: 'ovb circle' }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.objectViewBoxInfo || '（点击按钮查看 object-view-box 完整用法）')),
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
      h('h2', { class: 'section-title' }, 'CSS clip-path 剪裁路径深度实验室'),

      h(Alert, {
        type: 'info',
        message: 'CSS Masking Module Level 1 —— clip-path / clip-rule / SVG <clipPath> 剪裁路径体系',
        description: '演示 clip-path 概述与基本形状（<basic-shape>|<clip-source>|<geometry-box>|none，circle/ellipse/inset/polygon/path 五种函数，与 overflow:hidden 对比，与 mask 区别硬切边 vs alpha/luminance 渐变切）、circle()/ellipse() 圆与椭圆（shape-radius: closest-side/farthest-side，position 圆心定位）、inset() 内嵌矩形（四值语法 上 右 下 左 + round 圆角剪裁）、polygon() 多边形（fill-rule: nonzero/evenodd，星形/箭头/三角形，顶点数相同才可动画）、path() SVG 路径（M/L/C/Q/Z 命令，心形/波浪，vs url(#clipPath) 对比）、geometry-box 几何盒（margin/border/padding/content/fill/stroke/view-box，shape 相对盒模型计算）、clip-rule 与 url(#clipPath) SVG 引用（<clipPath> 元素，clipPathUnits: userSpaceOnUse/objectBoundingBox，clip-rule，复杂组合剪裁与文字剪裁）、实战模式与陷阱（圆形头像/箭头标签/波浪分隔/文字遮罩动画/clipped 视频/卡片斜角/View Transitions 圆形展开 + 10 条陷阱清单：不影响布局/形状参数兼容才可 transition/polygon 点数变化不可动画/path() 不可动画/border-box vs content-box/-webkit- 前缀/Safari 兼容性）、object-view-box 替换元素视图裁剪（CSSWG 提案，专用于 <img>/<video> 等 replaced element，与 object-fit 协同先裁剪再缩放，vs clip-path 区别仅裁剪内容不影响盒模型，Chrome 124+ 支持需 @supports 降级，图像缩略图/视频去黑边/响应式裁剪实战 + 6 条陷阱清单）。用 CSS.supports() 检测，jsdom 不做真实渲染但流程完整。',
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
