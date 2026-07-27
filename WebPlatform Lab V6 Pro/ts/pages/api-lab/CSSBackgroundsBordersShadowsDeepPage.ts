// =====================================================================
// CSSBackgroundsBordersShadowsDeepPage.js —— CSS Backgrounds / Borders / Shadows 深潜实验室
// 演示 CSS Backgrounds Module + Borders Module + Box Shadow / Outline 体系：
//   1. 多重背景 (Multiple Backgrounds)
//      background-image: url(a), url(b), linear-gradient(...);
//      background 简写 + 各分项属性（color/image/repeat/attachment/position/size/origin/clip）
//      层叠顺序：先写的在上层；background-color 在最底层
//      background-blend-mode 协同：multiply/screen/overlay/...
//   2. background-clip / background-origin / background-size
//      background-clip: border-box | padding-box | content-box | text（渐变文字）
//      background-origin 起始原点（border-box/padding-box/content-box）
//      background-size: cover | contain | <length> | <percentage>
//      background-attachment: scroll | fixed | local
//   3. border-radius 复杂圆角
//      单值/双值/三值/四值语法；'/' 分隔水平垂直半径（椭圆角）
//      border-top-left-radius 等分项；不规则形状；百分比圆角
//   4. border-image
//      border-image-source | slice | width | outset | repeat | 简写
//      border-image-repeat: stretch | repeat | round | space
//      九宫格切片原理；与 border 协同
//   5. box-shadow 多层阴影
//      box-shadow: h-offset v-offset blur spread color inset
//      多层叠加（逗号分隔）；inset 内阴影；spread 扩散
//      性能注意事项（大模糊半径触发重绘）；与 filter: drop-shadow() 对比
//   6. box-decoration-break
//      box-decoration-break: slice | clone
//      多行内联元素的边框/背景/阴影断行处理；clone 每行独立绘制
//   7. outline 与 outline-offset
//      outline: width style color；outline-offset（可负值）
//      不占布局空间；不触发 reflow；用于无障碍焦点环（:focus-visible）
//   8. 实战模式与陷阱
//      渐变文字（background-clip:text）/ 多层背景叠加图案 / 阴影立体感 / 毛玻璃卡片
//      霓虹光晕 / 按钮 hover 阴影动画 / 焦点环无障碍 / 陷阱清单
// 说明：jsdom 不做真实渲染，但 CSS.supports 可探测属性支持；
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

interface CSSBackgroundsBordersShadowsDeepPageCaps {
  css: boolean;
  supports: boolean;
  multipleBackgrounds: boolean;
  bgClipText: boolean;
  bgOrigin: boolean;
  bgSize: boolean;
  bgAttachmentLocal: boolean;
  borderRadius: boolean;
  borderRadiusPercent: boolean;
  borderImage: boolean;
  borderImageRepeat: boolean;
  boxShadow: boolean;
  boxShadowInset: boolean;
  boxDecoBreak: boolean;
  outline: boolean;
  outlineOffset: boolean;
  blendMode: boolean;
  backdropFilter: boolean;
  dropShadow: boolean;
}

export interface CSSBackgroundsBordersShadowsDeepPageProps extends Props {}

export interface CSSBackgroundsBordersShadowsDeepPageState extends State {
  logs: LogEntry[];
  capsSummary: string;
  multipleBgsInfo: string;
  bgClipInfo: string;
  borderRadiusInfo: string;
  borderImageInfo: string;
  boxShadowInfo: string;
  boxDecoInfo: string;
  outlineInfo: string;
  patternInfo: string;
}

export class CSSBackgroundsBordersShadowsDeepPage extends Page {
  declare props: CSSBackgroundsBordersShadowsDeepPageProps;
  declare state: CSSBackgroundsBordersShadowsDeepPageState;

  _inited: boolean = false;
  declare _destroyed: boolean;
  _dynamicStyles!: any[];


  initialState(): CSSBackgroundsBordersShadowsDeepPageState {
    return {
      logs: [],
      capsSummary: '',
      multipleBgsInfo: '',   // Card 1：多重背景与 background-blend-mode
      bgClipInfo: '',        // Card 2：background-clip / origin / size / attachment
      borderRadiusInfo: '',  // Card 3：border-radius 复杂圆角
      borderImageInfo: '',   // Card 4：border-image 与九宫格切片
      boxShadowInfo: '',     // Card 5：box-shadow 多层阴影
      boxDecoInfo: '',       // Card 6：box-decoration-break
      outlineInfo: '',       // Card 7：outline 与 outline-offset
      patternInfo: '',       // Card 8：实战模式与陷阱
    };
  }

  componentDidMount(): void {
    if (this._inited) return;
    this._inited = true;

    this._dynamicStyles = [];

    const f = this._flags();
    const c = (ok: boolean) => ok ? '✓' : '✗';
    const parts = [
      `multiple backgrounds ${c(f.multipleBackgrounds)}`,
      `background-clip: text ${c(f.bgClipText)}`,
      `background-origin ${c(f.bgOrigin)}`,
      `background-size ${c(f.bgSize)}`,
      `background-attachment: local ${c(f.bgAttachmentLocal)}`,
      `border-radius ${c(f.borderRadius)}`,
      `border-image ${c(f.borderImage)}`,
      `box-shadow ${c(f.boxShadow)}`,
      `box-shadow: inset ${c(f.boxShadowInset)}`,
      `box-decoration-break: clone ${c(f.boxDecoBreak)}`,
      `outline ${c(f.outline)}`,
      `outline-offset ${c(f.outlineOffset)}`,
      `background-blend-mode ${c(f.blendMode)}`,
      `backdrop-filter ${c(f.backdropFilter)}`,
      `filter: drop-shadow() ${c(f.dropShadow)}`,
    ];

    const summary = f.css
      ? `CSS Backgrounds/Borders/Shadows 能力检测：${parts.join(' · ')}。jsdom 不做真实渲染，但 CSS.supports 可探测属性支持；按钮点击注入演示样式 + 完整代码示例，真实浏览器可查看效果。`
      : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击仅记日志说明，不会抛异常。';

    this.setState({ capsSummary: summary });
    this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.bgClipText) this._addLog('warn', 'background-clip: text 不可用（需 -webkit- 前缀，渐变文字场景常用）');
    if (!f.backdropFilter) this._addLog('warn', 'backdrop-filter 不可用（毛玻璃效果需前缀或后备）');
    if (!f.boxDecoBreak) this._addLog('info', 'box-decoration-break: clone 在 Firefox 用 -webkit- 前缀');
    if (!f.borderImage) this._addLog('info', 'border-image 切片单位/浏览器支持差异较大');

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
    this._injectStyle('css-bbs-base', `
      .bb-demo {
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
      }
      .bb-box {
        width: 80px;
        height: 80px;
        background: #3b82f6;
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 700;
        font-size: 12px;
        margin: 8px;
      }
      .bb-multi-bg {
        width: 200px;
        height: 80px;
        border: 4px dotted #1e40af;
        padding: 10px;
        color: #fff;
        font-weight: 700;
        background-image:
          linear-gradient(rgba(59, 130, 246, 0.7), rgba(139, 92, 246, 0.7)),
          radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.5), transparent 40%),
          linear-gradient(45deg, #ef4444 25%, transparent 25%, transparent 75%, #ef4444 75%),
          linear-gradient(45deg, #ef4444 25%, transparent 25%, transparent 75%, #ef4444 75%);
        background-position: 0 0, 0 0, 0 0, 20px 20px;
        background-size: auto, auto, 40px 40px, 40px 40px;
        background-color: #10b981;
        background-blend-mode: overlay, normal, normal, normal;
        margin: 8px;
      }
      .bb-clip-text {
        font-size: 28px;
        font-weight: 800;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        margin: 8px;
      }
      .bb-radius-mix {
        width: 80px;
        height: 80px;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        border-radius: 10px 30px 50px 70px / 20px 40px 60px 80px;
        margin: 8px;
        display: inline-block;
      }
      .bb-radius-circle {
        width: 80px;
        height: 80px;
        background: #10b981;
        border-radius: 50%;
        margin: 8px;
        display: inline-block;
      }
      .bb-radius-percent {
        width: 120px;
        height: 60px;
        background: #f59e0b;
        border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
        margin: 8px;
        display: inline-block;
      }
      .bb-shadow-multi {
        width: 100px;
        height: 60px;
        background: #fff;
        margin: 24px 8px;
        border-radius: 6px;
        box-shadow:
          0 1px 1px rgba(0, 0, 0, 0.08),
          0 2px 2px rgba(0, 0, 0, 0.06),
          0 4px 4px rgba(0, 0, 0, 0.05),
          0 8px 8px rgba(0, 0, 0, 0.04),
          0 16px 32px rgba(0, 0, 0, 0.10);
        display: inline-block;
      }
      .bb-shadow-inset {
        width: 100px;
        height: 60px;
        background: #f1f5f9;
        margin: 24px 8px;
        border-radius: 6px;
        box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.25);
        display: inline-block;
      }
      .bb-shadow-neon {
        width: 100px;
        height: 60px;
        background: #0f172a;
        color: #22d3ee;
        text-align: center;
        line-height: 60px;
        font-weight: 700;
        margin: 24px 8px;
        border-radius: 6px;
        box-shadow:
          0 0 5px #22d3ee,
          0 0 10px #22d3ee,
          0 0 20px #22d3ee,
          0 0 40px #06b6d4,
          0 0 80px #06b6d4;
        display: inline-block;
      }
      .bb-deco-clone {
        background: #3b82f6;
        color: #fff;
        padding: 4px 8px;
        border-radius: 6px;
        -webkit-box-decoration-break: clone;
        box-decoration-break: clone;
        line-height: 1.8;
        max-width: 200px;
        margin: 8px;
        display: inline;
      }
      .bb-outline-btn {
        padding: 8px 16px;
        background: #3b82f6;
        color: #fff;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        margin: 8px;
      }
      .bb-outline-btn:focus-visible {
        outline: 3px solid #f59e0b;
        outline-offset: 3px;
      }
      .bb-glass {
        width: 160px;
        height: 80px;
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 12px;
        margin: 16px 8px;
        display: inline-block;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      }
      .bb-output {
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

  _flags(): CSSBackgroundsBordersShadowsDeepPageCaps {
    const hasCSS = typeof CSS !== 'undefined';
    const supportsPV = (p: any,v: any) => {
      try { return hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v); }
      catch { return false; }
    };
    return {
      css: hasCSS,
      supports: hasCSS && typeof CSS.supports === 'function',
      multipleBackgrounds: supportsPV('background-image', 'linear-gradient(red, blue), linear-gradient(green, yellow)'),
      bgClipText: supportsPV('background-clip', 'text') || supportsPV('-webkit-background-clip', 'text'),
      bgOrigin: supportsPV('background-origin', 'content-box'),
      bgSize: supportsPV('background-size', 'cover'),
      bgAttachmentLocal: supportsPV('background-attachment', 'local'),
      borderRadius: supportsPV('border-radius', '10px'),
      borderRadiusPercent: supportsPV('border-radius', '50%'),
      borderImage: supportsPV('border-image', 'url(x) 30 fill') || supportsPV('border-image-source', 'url(x)'),
      borderImageRepeat: supportsPV('border-image-repeat', 'round'),
      boxShadow: supportsPV('box-shadow', '1px 2px 3px black'),
      boxShadowInset: supportsPV('box-shadow', 'inset 1px 2px 3px black'),
      boxDecoBreak: supportsPV('box-decoration-break', 'clone'),
      outline: supportsPV('outline', '2px solid blue'),
      outlineOffset: supportsPV('outline-offset', '2px'),
      blendMode: supportsPV('background-blend-mode', 'multiply'),
      backdropFilter: supportsPV('backdrop-filter', 'blur(4px)') || supportsPV('-webkit-backdrop-filter', 'blur(4px)'),
      dropShadow: supportsPV('filter', 'drop-shadow(2px 2px 2px black)'),
    };
  }

  // ===================== Card 1：多重背景与 background-blend-mode =====================

  _runMultipleBgsDemo(): void {
    const f = this._flags();
    this._injectStyle('bb-multi-bg-demo', `
      .bb-multi-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
      .bb-multi-stack {
        width: 240px;
        height: 100px;
        padding: 12px;
        color: #fff;
        font-weight: 700;
        background-image:
          url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="10" fill="%23ffffff" opacity="0.6"/></svg>'),
          linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(139, 92, 246, 0.9)),
          radial-gradient(circle at 30% 30%, #ec4899, transparent 50%);
        background-repeat: repeat, no-repeat, no-repeat;
        background-position: 0 0, 0 0, 0 0;
        background-size: 40px 40px, cover, cover;
        background-color: #0f172a;
        background-blend-mode: overlay, normal, normal;
        margin: 8px;
        border-radius: 6px;
      }
      .bb-blend-mode-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 8px;
        margin-top: 10px;
      }
      .bb-blend-cell {
        width: 100%;
        height: 60px;
        background: linear-gradient(135deg, #3b82f6, #ec4899), #10b981;
        background-blend-mode: multiply;
        color: #fff;
        font-size: 10px;
        line-height: 60px;
        text-align: center;
        border-radius: 4px;
      }
    `);
    const info = [
      '===== 多重背景 (Multiple Backgrounds) =====',
      '',
      '【background-image 多层叠加：逗号分隔】',
      '  .box {',
      '    background-image:',
      '      url(top.png),                          /* 第 1 层（最上） */',
      '      url(mid.png),                          /* 第 2 层 */',
      '      linear-gradient(to bottom, red, blue), /* 第 3 层 */',
      '      url(bottom.png);                       /* 第 4 层（最下，但仍在 background-color 之上）*/',
      '    background-color: #fff;                  /* 最底层（color 不可多层）*/',
      '  }',
      '',
      '  /* 层叠顺序规则：先写的在上层（与 z-index 相反）*/',
      '  /* background-color 永远在最底层，且只能单值 */',
      '',
      '【background 简写：每层用逗号分隔】',
      '  .box {',
      '    background:',
      '      url(a.png) no-repeat center / cover,    /* 第 1 层：image repeat position / size */',
      '      url(b.png) repeat-x left top / contain, /* 第 2 层 */',
      '      linear-gradient(red, blue);             /* 第 3 层 */',
      '    /* 注意：background-color 只能写在最后一层（最底层）*/',
      '  }',
      '  /* 简写中 position 与 size 用 / 分隔：position / size */',
      '',
      '【各分项属性（每个都可多层逗号分隔）】',
      '  background-color:    #fff;        /* 只能单值，永远在最底层 */',
      '  background-image:    url(a), url(b), linear-gradient(...);',
      '  background-repeat:   no-repeat, repeat, repeat-x;',
      '  background-attachment: scroll, fixed, local;',
      '  background-position: center, left top, 50% 50%;',
      '  background-size:     cover, contain, 100px 80px;',
      '  background-origin:   padding-box, border-box, content-box;',
      '  background-clip:     border-box, padding-box, content-box;',
      '  background-blend-mode: multiply, normal, screen;',
      '',
      '【层叠顺序可视化】',
      '  ┌─────────────────────────┐',
      '  │ 第 1 层 background-image │ ← 最上层（先写的）',
      '  ├─────────────────────────┤',
      '  │ 第 2 层 background-image │',
      '  ├─────────────────────────┤',
      '  │ 第 3 层 background-image │',
      '  ├─────────────────────────┤',
      '  │ background-color         │ ← 最底层（不可多层）',
      '  └─────────────────────────┘',
      '',
      '【每层数量必须一致或单值（少数情况可单值应用到所有层）】',
      '  /* 错误：层数不匹配 */',
      '  background-image: url(a), url(b), url(c);',
      '  background-repeat: no-repeat, repeat;  /* 3 vs 2，行为依赖实现 */',
      '',
      '  /* 正确：单值应用到所有层 */',
      '  background-image: url(a), url(b);',
      '  background-repeat: no-repeat;  /* 两层都用 no-repeat */',
      '',
      '【background-color 与多层 image 的关系】',
      '  - background-color 永远在最底层',
      '  - image 各层透明部分会透出下层',
      '  - 最后一层 image 的透明部分会透出 background-color',
      '  - background-color 不能写在 background-image 列表中（只能单独属性）',
      '',
      '【background-blend-mode 协同：混合多层背景】',
      '  background-blend-mode: normal | multiply | screen | overlay |',
      '                        darken | lighten | color-dodge | color-burn |',
      '                        hard-light | soft-light | difference | exclusion |',
      '                        hue | saturation | color | luminosity;',
      '',
      '  /* 每层 image 与下层（含 color）混合，逗号分隔对应每层 */',
      '  .blend {',
      '    background-image:',
      '      linear-gradient(rgba(255, 0, 0, 0.5), rgba(0, 0, 255, 0.5)),',
      '      url(texture.png);',
      '    background-color: #fff;',
      '    background-blend-mode: multiply, normal;',
      '    /* 第 1 层 gradient 与第 2 层 image 用 multiply 混合 */',
      '    /* 第 2 层 image 与 background-color 用 normal 混合 */',
      '  }',
      '',
      '【常见混合模式说明】',
      '  normal       不混合（默认）',
      '  multiply     正片叠底（颜色相乘，变暗）',
      '  screen       滤色（颜色反相相乘后反相，变亮）',
      '  overlay      叠加（multiply 与 screen 组合）',
      '  darken/lighten 取较暗/较亮值',
      '  color-dodge/color-burn 颜色减淡/加深',
      '  difference  差值（取颜色差的绝对值）',
      '  exclusion   排除（类似 difference 但对比度较低）',
      '  hue/saturation/color/luminosity 色相/饱和度/颜色/明度',
      '',
      '【background-blend-mode 与 mix-blend-mode 区别】',
      '  background-blend-mode：在同一元素的多层 background-image 之间混合',
      '  mix-blend-mode：       在不同元素之间（元素与下层元素）混合',
      '',
      '【实战示例：纹理叠加渐变】',
      '  .texture-bg {',
      '    background-image:',
      '      url(noise.png),                              /* 纹理层 */',
      '      linear-gradient(135deg, #3b82f6, #ec4899);   /* 渐变层 */',
      '    background-blend-mode: overlay, normal;        /* 纹理用 overlay 与下层混合 */',
      '    background-size: 200px 200px, cover;',
      '  }',
      '',
      '【实战示例：纸张效果（gradients 叠加）】',
      '  .paper {',
      '    background-color: #f5f0e6;',
      '    background-image:',
      '      radial-gradient(circle at 25% 25%, rgba(0,0,0,0.05) 0%, transparent 50%),',
      '      radial-gradient(circle at 75% 75%, rgba(0,0,0,0.05) 0%, transparent 50%);',
      '  }',
      '',
      '【浏览器支持】',
      `  多重背景: ${f.multipleBackgrounds ? '✓' : '✗'} (IE9+/所有现代浏览器)`,
      `  background-blend-mode: ${f.blendMode ? '✓' : '✗'} (Chrome 35+/Firefox 30+/Safari 6.1+)`,
      '',
      '【常见陷阱】',
      '  1. background-color 只能单值，写在 background-image 多层里会被忽略',
      '  2. background 简写中省略的子属性会用默认值覆盖原值',
      '     → 用简写后再写分项属性需注意顺序',
      '  3. background-position 与 background-size 在简写中用 / 分隔',
      '     → background: url(x) center / cover;（不是 center cover）',
      '  4. 多层 background-image 层叠顺序是「先写的在上层」',
      '     → 与 z-index 相反，容易混淆',
      '  5. 透明 PNG 叠加时若下层非 background-color 会透出',
      '  6. background-blend-mode 的层数应与 background-image 层数一致',
    ].join('\n');
    this.setState({ multipleBgsInfo: info });
    this._addLog('css', `多重背景演示完成；multipleBgs=${f.multipleBackgrounds}/blendMode=${f.blendMode}`);
  }

  _renderCard1(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. 多重背景 (Multiple Backgrounds) —— 层叠与混合',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['multiple backgrounds', f.multipleBackgrounds],
          ['blend-mode', f.blendMode],
        ]),
        h(Tag, { color: 'primary' }, 'Backgrounds L3'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'background-image: url(a), url(b), linear-gradient(...) 多层叠加，先写的在上层，background-color 永远最底层且单值。background 简写每层用逗号分隔，position 与 size 用 / 分隔。各分项属性（color/image/repeat/attachment/position/size/origin/clip）可多层逗号对应。background-blend-mode: multiply/screen/overlay/... 在同一元素多层 image 间混合，与 mix-blend-mode（跨元素）区别。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行多重背景演示', { type: 'primary', size: 'sm', onClick: () => this._runMultipleBgsDemo() }),
        ),
        h('div', { class: 'bb-multi-bg' }, '多层叠加 + blend-mode'),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.multipleBgsInfo || '（点击按钮查看多重背景完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 2：background-clip / origin / size / attachment =====================

  _runBgClipDemo(): void {
    const f = this._flags();
    const info = [
      '===== background-clip / background-origin / background-size / attachment =====',
      '',
      '【background-clip：背景裁剪区域】',
      '  background-clip: border-box;     /* 默认：背景延伸到 border 外缘 */',
      '  background-clip: padding-box;    /* 背景延伸到 padding 外缘（不含 border）*/',
      '  background-clip: content-box;    /* 背景仅延伸到 content（不含 padding）*/',
      '  background-clip: text;           /* 背景裁剪为文字形状（渐变文字！）*/',
      '',
      '  /* 注意：border-box 时若 border 是半透明会看到背景透出 */',
      '  /* padding-box 适合避免 border 与背景重叠 */',
      '',
      '【background-clip: text 实现渐变文字（最常用）】',
      '  .gradient-text {',
      '    background: linear-gradient(135deg, #3b82f6, #ec4899);',
      '    -webkit-background-clip: text;  /* Safari/旧 Chrome 必需前缀 */',
      '    background-clip: text;',
      '    color: transparent;             /* 文字透明露出背景 */',
      '    /* 或 -webkit-text-fill-color: transparent; 兼容性更好 */',
      '  }',
      '',
      '  /* 关键三件套：*/',
      '  /* 1. background 设置渐变或图片 */',
      '  /* 2. -webkit-background-clip: text */',
      '  /* 3. color: transparent 或 -webkit-text-fill-color: transparent */',
      '',
      '  /* 兼容性：-webkit-background-clip: text 必须（Firefox 49+ 也支持 -webkit- 前缀）*/',
      '  /* 标准无前缀 background-clip: text 仅 Chrome 120+ 完整支持 */',
      '',
      '【background-origin：背景定位原点（影响 background-position）】',
      '  background-origin: padding-box;   /* 默认：position 相对 padding-box 计算 */',
      '  background-origin: border-box;    /* 相对 border-box 计算（含 border）*/',
      '  background-origin: content-box;   /* 相对 content 计算（不含 padding）*/',
      '',
      '  /* 注意：background-origin 与 background-clip 区别 */',
      '  /* background-origin：背景「定位」原点（position 起点）*/',
      '  /* background-clip：背景「绘制」区域（裁剪范围）*/',
      '  /* background-clip: text 时 background-origin 不生效 */',
      '',
      '【background-origin 与 background-position 协同】',
      '  .box {',
      '    background-image: url(sprite.png);',
      '    background-position: 0 0;       /* 起点取决于 origin */',
      '    background-origin: content-box; /* 从 content 区域左上角开始定位 */',
      '    background-clip: padding-box;   /* 但裁剪到 padding-box */',
      '  }',
      '',
      '【background-size：背景图尺寸】',
      '  background-size: auto;        /* 默认：图片原始尺寸 */',
      '  background-size: 200px 100px; /* 指定宽高 */',
      '  background-size: 50% 50%;    /* 相对容器的百分比 */',
      '  background-size: cover;       /* 等比缩放铺满容器（可能裁剪）*/',
      '  background-size: contain;     /* 等比缩放完整显示（可能留白）*/',
      '',
      '  /* cover vs contain 区别 */',
      '  cover   完全覆盖容器（图片可能被裁剪，无留白）',
      '  contain 完整显示图片（容器可能留白，无裁剪）',
      '',
      '  /* 双值：宽 高 */',
      '  background-size: 100px auto;   /* 宽 100px，高自动（保持比例）*/',
      '  background-size: auto 100px;   /* 高 100px，宽自动 */',
      '',
      '【background-size 与 background-position 在简写中用 / 分隔】',
      '  background: url(x) center top / cover;   /* position / size */',
      '  background: url(x) 50% 50% / 200px 100px;',
      '  /* 简写中 position 必须在 size 之前，用 / 分隔 */',
      '',
      '【background-attachment：背景滚动行为】',
      '  background-attachment: scroll;  /* 默认：随页面滚动，不随元素内容滚动 */',
      '  background-attachment: fixed;   /* 固定在视口（视差效果）*/',
      '  background-attachment: local;   /* 随元素内容滚动（容器内滚动条）*/',
      '',
      '  /* 三种行为详解 */',
      '  scroll  页面滚动时背景跟随页面，但元素内部滚动条不影响背景',
      '  fixed   背景固定在视口位置，不随任何滚动移动（视差/吸顶背景）',
      '  local   背景随元素内容滚动（适合带滚动条的容器）',
      '',
      '【background-attachment: fixed 的视差效果】',
      '  .hero {',
      '    background-image: url(big-bg.jpg);',
      '    background-attachment: fixed;  /* 滚动时背景固定，文字浮动感 */',
      '    background-size: cover;',
      '    background-position: center;',
      '    height: 100vh;',
      '  }',
      '  /* 注意：移动端 iOS Safari 对 fixed 支持有限，常退化为 scroll */',
      '',
      '【background-attachment: local 的容器内滚动】',
      '  .scroll-box {',
      '    height: 200px;',
      '    overflow: auto;',
      '    background-image: url(pattern.png);',
      '    background-attachment: local;  /* 内容滚动时背景跟随 */',
      '    background-size: 50px 50px;',
      '  }',
      '',
      '【background-repeat 速查（与 size 协同）】',
      '  background-repeat: repeat;     /* 默认：双向平铺 */',
      '  background-repeat: repeat-x;   /* 仅水平 */',
      '  background-repeat: repeat-y;   /* 仅垂直 */',
      '  background-repeat: no-repeat;  /* 不平铺 */',
      '  background-repeat: space;      /* 平铺但保持间距（不裁剪）*/',
      '  background-repeat: round;      /* 平铺并缩放到整数倍（不裁剪）*/',
      '  /* 双值：水平 垂直，如 repeat no-repeat */',
      '',
      '【多层背景时 background-clip/origin/size 可分别指定】',
      '  .box {',
      '    background-image: url(a), url(b);',
      '    background-clip: padding-box, border-box;',
      '    background-origin: content-box, padding-box;',
      '    background-size: cover, contain;',
      '  }',
      '',
      '【浏览器支持】',
      `  background-clip: text: ${f.bgClipText ? '✓' : '✗'} (需 -webkit- 前缀，全浏览器支持)`,
      `  background-origin: ${f.bgOrigin ? '✓' : '✗'} (IE9+)`,
      `  background-size: ${f.bgSize ? '✓' : '✗'} (IE9+)`,
      `  background-attachment: local: ${f.bgAttachmentLocal ? '✓' : '✗'} (IE9+，移动端 fixed 兼容差)`,
      '',
      '【常见陷阱】',
      '  1. background-clip: text 必须配 -webkit- 前缀（旧浏览器兼容）',
      '  2. background-clip: text 时必须 color: transparent（否则文字遮住背景）',
      '  3. background-origin 影响定位，background-clip 影响裁剪，两者独立',
      '  4. background-size 在 background 简写中必须在 position 后用 / 分隔',
      '     → background: url(x) center / cover;（写 url(x) cover 会报错）',
      '  5. background-attachment: fixed 在 iOS Safari 上常被忽略',
      '     → 改用 position: sticky + transform 模拟视差',
      '  6. background-clip: text 的文字仍可被选中，但选区颜色透明（需 -webkit-text-fill-color）',
    ].join('\n');
    this.setState({ bgClipInfo: info });
    this._addLog('css', `background-clip/origin/size 演示完成；clip:text=${f.bgClipText}/origin=${f.bgOrigin}/local=${f.bgAttachmentLocal}`);
  }

  _renderCard2(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. background-clip / background-origin / background-size / attachment',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['clip: text', f.bgClipText],
          ['origin', f.bgOrigin],
          ['size', f.bgSize],
          ['attachment: local', f.bgAttachmentLocal],
        ]),
        h(Tag, { color: 'primary' }, 'Backgrounds L3'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'background-clip: border-box|padding-box|content-box|text（text 实现渐变文字，需 -webkit- 前缀 + color: transparent）。background-origin: border-box|padding-box|content-box 决定 background-position 起始原点（与 clip 区别：origin 定位起点，clip 裁剪范围）。background-size: cover|contain|<length>|<percentage>，cover 铺满可能裁剪，contain 完整可能留白。background-attachment: scroll|fixed|local，fixed 视差/local 容器内滚动。简写中 position / size 用 / 分隔。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 clip/origin/size 演示', { type: 'primary', size: 'sm', onClick: () => this._runBgClipDemo() }),
        ),
        h('div', { class: 'bb-clip-text' }, '渐变文字 GRADIENT'),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.bgClipInfo || '（点击按钮查看 background-clip/origin/size/attachment 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 3：border-radius 复杂圆角 =====================

  _runBorderRadiusDemo(): void {
    const f = this._flags();
    this._injectStyle('bb-radius-demo', `
      .bb-radius-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; display: flex; flex-wrap: wrap; align-items: center; }
      .bb-radius-1 { width: 60px; height: 60px; background: #3b82f6; border-radius: 10px; margin: 8px; display: inline-block; }
      .bb-radius-2 { width: 60px; height: 60px; background: #10b981; border-radius: 10px 30px; margin: 8px; display: inline-block; }
      .bb-radius-3 { width: 60px; height: 60px; background: #f59e0b; border-radius: 10px 30px 50px; margin: 8px; display: inline-block; }
      .bb-radius-4 { width: 60px; height: 60px; background: #ef4444; border-radius: 10px 30px 50px 70px; margin: 8px; display: inline-block; }
      .bb-radius-ellipse { width: 100px; height: 60px; background: #8b5cf6; border-radius: 50px / 30px; margin: 8px; display: inline-block; }
      .bb-radius-leaf { width: 100px; height: 100px; background: #ec4899; border-radius: 0 100%; margin: 8px; display: inline-block; }
    `);
    const info = [
      '===== border-radius 复杂圆角 =====',
      '',
      '【单值/双值/三值/四值语法】',
      '  border-radius: 10px;                  /* 单值：四角都 10px */',
      '  border-radius: 10px 30px;             /* 双值：左上右下 10px，右上左下 30px */',
      '  border-radius: 10px 30px 50px;        /* 三值：左上 / 右上左下 / 右下 */',
      '  border-radius: 10px 30px 50px 70px;   /* 四值：左上 / 右上 / 右下 / 左下 */',
      '',
      '  /* 顺序：从左上顺时针（左上 → 右上 → 右下 → 左下）*/',
      '  /* 缺失值取对角值（如三值缺左下，取右上的值）*/',
      '',
      '【四角方位对照】',
      '     左上 ──┬── 右上',
      '           │',
      '     左下 ──┴── 右下',
      '',
      '  border-radius: TL TR BR BL;',
      '  /* TL=top-left, TR=top-right, BR=bottom-right, BL=bottom-left */',
      '',
      '【"/" 分隔水平垂直半径（椭圆角）】',
      '  border-radius: 50px / 30px;',
      '  /* 水平半径 50px / 垂直半径 30px → 椭圆形圆角 */',
      '',
      '  /* 各角可独立指定水平/垂直 */',
      '  border-radius: 10px 30px 50px 70px / 20px 40px 60px 80px;',
      '  /* 左上水平 10px 垂直 20px，右上水平 30px 垂直 40px，... */',
      '',
      '  /* 简写规则：/ 前是水平半径列表，/ 后是垂直半径列表 */',
      '  /* 若 / 后省略，垂直半径 = 水平半径（圆形角）*/',
      '',
      '【分项属性：四个角独立控制】',
      '  border-top-left-radius:     10px 20px;     /* 水平 垂直 */',
      '  border-top-right-radius:    30px;',
      '  border-bottom-right-radius: 50px;',
      '  border-bottom-left-radius:  70px;',
      '',
      '  /* 分项属性不接受单值/双值/三值/四值简写 */',
      '  /* 每个分项最多两个值：水平 垂直 */',
      '  /* 顺序：先水平后垂直 */',
      '',
      '【圆形（border-radius: 50%）】',
      '  .circle {',
      '    width: 100px;',
      '    height: 100px;',
      '    border-radius: 50%;  /* 50% = 圆形（宽高相等时）*/',
      '  }',
      '  /* 50% 是相对元素宽高的百分比，因此椭圆元素 50% 变椭圆 */',
      '',
      '【百分比圆角（不规则形状）】',
      '  .blob {',
      '    width: 200px;',
      '    height: 200px;',
      '    border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;',
      '    /* 不规则水滴/blob 形状 */',
      '  }',
      '',
      '  /* 百分比相对元素宽（水平）和高（垂直）*/',
      '  /* 适合做装饰性不规则形状（如 blob/水滴/树叶）*/',
      '',
      '【常见不规则形状】',
      '  /* 叶子形状（半圆）*/',
      '  .leaf {',
      '    border-radius: 0 100%;  /* 右下 100%，其他 0 */',
      '    /* = border-radius: 0 0 100% 0; 但双值写法 */',
      '  }',
      '',
      '  /* 水滴形状 */',
      '  .drop {',
      '    border-radius: 0 50% 50% 50%;',
      '    transform: rotate(-45deg);',
      '  }',
      '',
      '  /* 蛋形 */',
      '  .egg {',
      '    width: 100px;',
      '    height: 140px;',
      '    border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;',
      '  }',
      '',
      '【border-radius 与 border 协同】',
      '  /* border 在圆角内侧也会跟随圆角 */',
      '  .box {',
      '    border: 4px solid #3b82f6;',
      '    border-radius: 20px;  /* border 也变圆 */',
      '  }',
      '',
      '  /* border 与 background-clip 协同 */',
      '  .dotted {',
      '    border: 4px dotted #1e40af;',
      '    border-radius: 10px;',
      '    background-clip: padding-box;  /* 背景不溢出 border */',
      '  }',
      '',
      '【大圆角与小尺寸的边界情况】',
      '  /* 圆角半径超过元素尺寸时自动夹取 */',
      '  .small {',
      '    width: 50px;',
      '    height: 50px;',
      '    border-radius: 100px;  /* 实际变成圆形（半径被夹取到 25px）*/',
      '  }',
      '',
      '  /* 椭圆角半径之和不超过边长（避免变形）*/',
      '  .row {',
      '    width: 100px;',
      '    height: 50px;',
      '    border-radius: 60px / 30px;  /* 水平 60px > 边长一半 50px，会按比例缩小 */',
      '  }',
      '',
      '【border-radius 不影响 outline/box-shadow（仅裁剪 background/border）】',
      '  .box {',
      '    border-radius: 20px;',
      '    box-shadow: 0 0 0 4px red;  /* 阴影会跟随圆角（外阴影按圆角）*/',
      '    outline: 4px solid blue;    /* outline 不跟随圆角（仍是矩形）*/',
      '  }',
      '  /* 注意：outline 不跟随 border-radius，仍是矩形轮廓 */',
      '',
      '【浏览器支持】',
      `  border-radius: ${f.borderRadius ? '✓' : '✗'} (IE9+/所有现代浏览器)`,
      `  border-radius: 50%: ${f.borderRadiusPercent ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. 顺序是「左上 → 右上 → 右下 → 左下」顺时针，容易记错',
      '  2. / 分隔水平垂直半径，不是空格',
      '  3. 分项属性不接受 1/2/3/4 值简写，最多两个值（水平 垂直）',
      '  4. outline 不跟随 border-radius（仍是矩形轮廓）',
      '     → 焦点环需用 box-shadow: 0 0 0 3px ... 模拟圆角环',
      '  5. border-radius 50% 在 width≠height 时是椭圆而非圆',
      '  6. table 的 border-radius 在 border-collapse: collapse 时无效',
      '     → 改用 border-collapse: separate',
    ].join('\n');
    this.setState({ borderRadiusInfo: info });
    this._addLog('css', `border-radius 演示完成；supports=${f.borderRadius}/${f.borderRadiusPercent}`);
  }

  _renderCard3(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. border-radius 复杂圆角 —— 单/双/三/四值 + 椭圆角',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['border-radius', f.borderRadius],
          ['50%', f.borderRadiusPercent],
        ]),
        h(Tag, { color: 'primary' }, 'Borders L3'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'border-radius: 1/2/3/4 值语法（左上/右上/右下/左下顺时针，缺失取对角）。"/" 分隔水平/垂直半径实现椭圆角：border-radius: 50px / 30px。分项属性 border-top-left-radius 等（最多两值水平垂直）。百分比圆角（50% 圆形 / 不规则 blob）。outline 不跟随圆角（仍是矩形），table border-collapse: collapse 时圆角无效。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 border-radius 演示', { type: 'primary', size: 'sm', onClick: () => this._runBorderRadiusDemo() }),
        ),
        h('div', { class: 'bb-radius-mix' }),
        h('div', { class: 'bb-radius-circle' }),
        h('div', { class: 'bb-radius-percent' }),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.borderRadiusInfo || '（点击按钮查看 border-radius 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 4：border-image 与九宫格切片 =====================

  _runBorderImageDemo(): void {
    const f = this._flags();
    this._injectStyle('bb-border-image-demo', `
      .bb-bi-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
      .bb-bi-box {
        border: 20px solid transparent;
        border-image-source: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="60" height="60" fill="%23fbbf24"/><rect width="20" height="20" fill="%23ef4444"/><rect x="40" width="20" height="20" fill="%23ef4444"/><rect y="40" width="20" height="20" fill="%23ef4444"/><rect x="40" y="40" width="20" height="20" fill="%23ef4444"/><circle cx="30" cy="30" r="6" fill="%23fff"/></svg>');
        border-image-slice: 20 fill;
        border-image-repeat: round;
        border-image-width: 20px;
        padding: 12px;
        margin: 8px;
        display: inline-block;
      }
      .bb-bi-stretch {
        border: 15px solid transparent;
        border-image-source: linear-gradient(45deg, #3b82f6, #ec4899);
        border-image-slice: 1;
        border-image-repeat: stretch;
        padding: 12px;
        margin: 8px;
        display: inline-block;
      }
    `);
    const info = [
      '===== border-image 与九宫格切片 =====',
      '',
      '【border-image 简写语法】',
      '  border-image: <source> <slice> / <width> / <outset> <repeat>;',
      '  /* 完整示例：*/',
      '  border-image: url(border.png) 30 fill / 20px / 0 round;',
      '',
      '【各分项属性】',
      '  border-image-source:   url(border.png);  /* 图片源 */',
      '  border-image-slice:    30 fill;          /* 切片数值（无单位）*/',
      '  border-image-width:    20px;             /* 边框宽度 */',
      '  border-image-outset:   0;                /* 边框外延 */',
      '  border-image-repeat:   round;            /* 重复方式 */',
      '',
      '【border-image-source：图片来源】',
      '  border-image-source: url(border.png);',
      '  border-image-source: linear-gradient(45deg, red, blue);  /* 渐变也可 */',
      '  border-image-source: none;  /* 默认，禁用 border-image */',
      '',
      '【border-image-slice：九宫格切片（无单位！）】',
      '  border-image-slice: 30;          /* 4 边各切 30px */',
      '  border-image-slice: 10 20;       /* 上下 10 左右 20 */',
      '  border-image-slice: 10 20 30;    /* 上 10 左右 20 下 30 */',
      '  border-image-slice: 10 20 30 40; /* 上 10 右 20 下 30 左 40 */',
      '  border-image-slice: 30 fill;     /* fill 切片填入中间区域 */',
      '',
      '  /* 关键：slice 数值无单位（不是 px）*/',
      '  /* 数值是图片像素的绝对值（1 = 1 像素）*/',
      '  /* 也可用百分比：border-image-slice: 30%;（相对图片尺寸）*/',
      '',
      '【九宫格切片原理】',
      '  切片把图片分成 9 块：4 角 + 4 边 + 1 中心',
      '',
      '    ┌───┬─────────┬───┐',
      '    │ 1 │    2    │ 3 │   1=左上角 2=上边 3=右上角',
      '    ├───┼─────────┼───┤',
      '    │ 4 │    5    │ 6 │   4=左边 5=中心 6=右边',
      '    ├───┼─────────┼───┤',
      '    │ 7 │    8    │ 9 │   7=左下角 8=下边 9=右下角',
      '    └───┴─────────┴───┘',
      '',
      '  - 4 角（1/3/7/9）：直接放置到边框对应位置（不缩放不重复）',
      '  - 4 边（2/4/6/8）：根据 repeat 模式拉伸/平铺',
      '  - 中心（5）：默认丢弃，fill 关键字时填入元素内容区',
      '',
      '【border-image-width：边框宽度】',
      '  border-image-width: 20px;          /* 固定像素 */',
      '  border-image-width: 1;             /* 数字 = border-width 的倍数 */',
      '  border-image-width: 10%;           /* 相对元素尺寸百分比 */',
      '  border-image-width: auto;          /* 自动（取 slice 对应的图片像素）*/',
      '',
      '  /* 注意：border-image-width 不影响布局，border-width 才影响 */',
      '  /* 通常需要先设 border: 20px solid transparent 占位 */',
      '',
      '【border-image-outset：边框外延（向外扩展）】',
      '  border-image-outset: 0;            /* 默认：与 border 重合 */',
      '  border-image-outset: 10px;         /* 向外延伸 10px */',
      '  border-image-outset: 10px 20px;    /* 上下 10 左右 20 */',
      '  /* outset 会让 border-image 溢出 border-box */',
      '',
      '【border-image-repeat：4 边重复方式】',
      '  border-image-repeat: stretch;   /* 默认：拉伸（可能变形）*/',
      '  border-image-repeat: repeat;    /* 平铺（可能裁剪边缘）*/',
      '  border-image-repeat: round;     /* 平铺并缩放到整数倍（不裁剪）*/',
      '  border-image-repeat: space;     /* 平铺保持间距（不裁剪）*/',
      '',
      '  /* 双值：水平 垂直 */',
      '  border-image-repeat: round stretch;',
      '',
      '  /* repeat vs round vs space 区别 */',
      '  repeat  原尺寸平铺，末尾可能裁剪',
      '  round   缩放到刚好整数倍平铺（不裁剪，可能变形）',
      '  space   原尺寸平铺，剩余空间均分到间隙（不裁剪不变形）',
      '',
      '【border-image 与 border 协同】',
      '  .box {',
      '    /* border 用于占位（透明）*/',
      '    border: 20px solid transparent;',
      '    /* border-image 替换 border 样式 */',
      '    border-image: url(border.png) 30 round;',
      '    /* 注意：border-style 必须 solid 或存在，否则不显示 */',
      '    /* border-color 在 border-image 后被覆盖 */',
      '  }',
      '',
      '  /* border-image 优先级高于 border-color/style */',
      '  /* border-width 仍影响布局（决定边框占据空间）*/',
      '',
      '【用渐变做 border-image（无需图片）】',
      '  .gradient-border {',
      '    border: 4px solid transparent;',
      '    border-image-source: linear-gradient(45deg, #3b82f6, #ec4899);',
      '    border-image-slice: 1;   /* 切 1 像素，整张图作为边框 */',
      '  }',
      '  /* slice: 1 让渐变图片整体填充边框（4 角和 4 边都是渐变）*/',
      '',
      '【实战：圆角边框 + 渐变（注意：border-image 不支持 border-radius）】',
      '  /* border-image 与 border-radius 不兼容 */',
      '  /* border-radius 在 border-image 时被忽略 */',
      '  /* 解决方案：用两层 div，外层渐变背景，内层实色背景留出 1px 边距 */',
      '  .gradient-border-rounded {',
      '    background: linear-gradient(45deg, #3b82f6, #ec4899);',
      '    padding: 2px;  /* 作为边框宽度 */',
      '    border-radius: 12px;',
      '  }',
      '  .gradient-border-rounded > .inner {',
      '    background: #fff;',
      '    border-radius: 10px;',
      '    padding: 12px;',
      '  }',
      '',
      '【浏览器支持】',
      `  border-image: ${f.borderImage ? '✓' : '✗'} (IE11 部分支持/所有现代浏览器)`,
      `  border-image-repeat: ${f.borderImageRepeat ? '✓' : '✗'}`,
      '',
      '【常见陷阱】',
      '  1. border-image-slice 数值无单位（不是 px）',
      '     → border-image-slice: 30（不是 30px）',
      '  2. border-image 必须先设置 border-width（透明占位）',
      '     → 否则 border-image 不显示',
      '  3. border-image 不支持 border-radius（圆角被忽略）',
      '     → 渐变边框配圆角需用两层 div 模拟',
      '  4. fill 关键字让中心区域填充图片，不加则中心透明',
      '  5. slice 数值超过图片一半会导致 9 块重叠（不可预期）',
      '  6. IE11 不支持 outset 与部分 repeat 模式',
    ].join('\n');
    this.setState({ borderImageInfo: info });
    this._addLog('css', `border-image 演示完成；supports=${f.borderImage}/${f.borderImageRepeat}`);
  }

  _renderCard4(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. border-image —— 九宫格切片与边框图像',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['border-image', f.borderImage],
          ['repeat', f.borderImageRepeat],
        ]),
        h(Tag, { color: 'primary' }, 'Borders L3'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'border-image: source slice / width / outset repeat 简写。border-image-slice 九宫格切片（无单位！1=1像素），4 角直接放置、4 边按 repeat 拉伸/平铺、中心默认丢弃（fill 关键字填充）。border-image-repeat: stretch|repeat|round|space。border-image 优先级高于 border-color/style，但必须先设 border-width 占位。不支持 border-radius（渐变圆角边框需两层 div 模拟）。渐变也可作为 source。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 border-image 演示', { type: 'primary', size: 'sm', onClick: () => this._runBorderImageDemo() }),
        ),
        h('div', { class: 'bb-bi-box' }, '九宫格切片'),
        h('div', { class: 'bb-bi-stretch' }, '渐变边框'),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.borderImageInfo || '（点击按钮查看 border-image 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 5：box-shadow 多层阴影 =====================

  _runBoxShadowDemo(): void {
    const f = this._flags();
    const info = [
      '===== box-shadow 多层阴影 =====',
      '',
      '【box-shadow 语法】',
      '  box-shadow: <h-offset> <v-offset> <blur> <spread> <color> inset;',
      '  /* h-offset：水平偏移（正数向右，负数向左）*/',
      '  /* v-offset：垂直偏移（正数向下，负数向上）*/',
      '  /* blur：     模糊半径（0 = 实色，越大越模糊）*/',
      '  /* spread：   扩散半径（正数扩大，负数缩小阴影尺寸）*/',
      '  /* color：    阴影颜色 */',
      '  /* inset：    内阴影（可选关键字，写最前或最后）*/',
      '',
      '  /* 最简：仅偏移 + 颜色 */',
      '  box-shadow: 4px 4px black;',
      '',
      '  /* 加模糊 */',
      '  box-shadow: 4px 4px 8px rgba(0, 0, 0, 0.3);',
      '',
      '  /* 加扩散 */',
      '  box-shadow: 4px 4px 8px 2px rgba(0, 0, 0, 0.3);',
      '',
      '  /* 内阴影 */',
      '  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.25);',
      '',
      '【多层叠加：逗号分隔】',
      '  /* 多层阴影：先写的在上层（与多重背景一致）*/',
      '  box-shadow:',
      '    0 1px 1px rgba(0, 0, 0, 0.08),   /* 第 1 层（细线）*/',
      '    0 2px 2px rgba(0, 0, 0, 0.06),   /* 第 2 层 */',
      '    0 4px 4px rgba(0, 0, 0, 0.05),   /* 第 3 层 */',
      '    0 8px 8px rgba(0, 0, 0, 0.04),   /* 第 4 层 */',
      '    0 16px 32px rgba(0, 0, 0, 0.10); /* 第 5 层（最外层大模糊）*/',
      '',
      '  /* Material Design 阴影分级原理：多层小模糊叠加模拟真实物理 */',
      '',
      '【inset 内阴影】',
      '  .inset-shadow {',
      '    box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.25);',
      '    /* 阴影绘制在元素内部（凹陷效果）*/',
      '  }',
      '',
      '  /* inset + outset 混合 */',
      '  .mix-shadow {',
      '    box-shadow:',
      '      0 4px 8px rgba(0, 0, 0, 0.2),       /* 外阴影 */',
      '      inset 0 1px 0 rgba(255, 255, 255, 0.5); /* 内高光 */',
      '  }',
      '',
      '【spread 扩散半径：调整阴影尺寸】',
      '  /* spread 正数：阴影变大 */',
      '  box-shadow: 0 0 0 4px black;  /* 4px 实心环（无模糊无偏移）*/',
      '  /* 等价于 4px 黑色边框，但不占布局空间！*/',
      '',
      '  /* spread 负数：阴影变小 */',
      '  box-shadow: 4px 4px 8px -2px black;',
      '',
      '  /* 用 spread + 0 偏移 + 0 模糊做 ring 效果（焦点环）*/',
      '  .focus-ring {',
      '    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5);',
      '  }',
      '',
      '【无偏移无模糊的实心环（焦点环常用）】',
      '  box-shadow: 0 0 0 3px #3b82f6;',
      '  /* 等价于 3px 蓝色环，跟随 border-radius */',
      '  /* 比 outline 更灵活（outline 不跟随 border-radius）*/',
      '',
      '【霓虹光晕（多层 box-shadow 模拟发光）】',
      '  .neon {',
      '    background: #0f172a;',
      '    color: #22d3ee;',
      '    box-shadow:',
      '      0 0 5px #22d3ee,',
      '      0 0 10px #22d3ee,',
      '      0 0 20px #22d3ee,',
      '      0 0 40px #06b6d4,',
      '      0 0 80px #06b6d4;',
      '  }',
      '  /* 多层不同模糊半径模拟光晕扩散 */',
      '',
      '【阴影立体感（多层不同 blur）】',
      '  /* 真实物理阴影：小模糊锐利 + 大模糊柔和 */',
      '  .realistic-shadow {',
      '    box-shadow:',
      '      0 1px 2px rgba(0, 0, 0, 0.07),   /* 锐利接触阴影 */',
      '      0 2px 4px rgba(0, 0, 0, 0.07),',
      '      0 4px 8px rgba(0, 0, 0, 0.07),',
      '      0 8px 16px rgba(0, 0, 0, 0.07),',
      '      0 16px 32px rgba(0, 0, 0, 0.07),',
      '      0 32px 64px rgba(0, 0, 0, 0.07);  /* 远距离柔和阴影 */',
      '  }',
      '',
      '【box-shadow 性能注意事项】',
      '  - 大模糊半径（>100px）会触发重绘，影响性能',
      '  - 多层叠加（>5 层）会增加 paint 时间',
      '  - box-shadow 触发 paint 阶段（不触发 layout）',
      '  - 滚动时多层大模糊阴影会导致掉帧',
      '  - will-change: box-shadow 可提示浏览器优化（但慎用）',
      '',
      '  /* 性能优化建议 */',
      '  - 模糊半径控制在 30px 以内',
      '  - 层数控制在 3 层以内',
      '  - 滚动列表避免大模糊阴影',
      '  - 用 filter: drop-shadow() 替代部分场景',
      '',
      '【box-shadow vs filter: drop-shadow() 对比】',
      '  box-shadow',
      '    + 性能较好（仅 paint）',
      '    + 支持多层叠加',
      '    + 支持 inset 内阴影',
      '    + 支持 spread 扩散',
      '    - 不跟随元素形状（按矩形 box 计算）',
      '    - 不跟随透明 PNG 形状',
      '',
      '  filter: drop-shadow()',
      '    + 跟随元素实际形状（含透明部分）',
      '    + 适合 SVG/PNG 透明图标的阴影',
      '    - 性能较差（需重新计算 alpha 通道）',
      '    - 不支持 inset',
      '    - 不支持多层（语法上支持但语义不同）',
      '    - 模糊半径通常比 box-shadow 慢',
      '',
      '  /* drop-shadow 跟随透明 PNG 形状 */',
      '  .icon {',
      '    filter: drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.3));',
      '    /* 阴影跟随 PNG 的非透明部分（如不规则图标）*/',
      '  }',
      '',
      '  /* drop-shadow 跟随 SVG 形状 */',
      '  .svg-shadow {',
      '    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.2));',
      '  }',
      '',
      '【box-shadow 与 border-radius 协同】',
      '  .rounded-shadow {',
      '    border-radius: 12px;',
      '    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);',
      '    /* 阴影跟随圆角（box-shadow 自动适配 border-radius）*/',
      '  }',
      '',
      '【box-shadow 与 transform 协同】',
      '  /* hover 时阴影变化（避免 layout）*/',
      '  .card {',
      '    transition: transform 0.3s, box-shadow 0.3s;',
      '    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);',
      '  }',
      '  .card:hover {',
      '    transform: translateY(-4px);  /* 上移 */',
      '    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.2);  /* 阴影变大 */',
      '  }',
      '',
      '【浏览器支持】',
      `  box-shadow: ${f.boxShadow ? '✓' : '✗'} (IE9+/所有现代浏览器)`,
      `  box-shadow: inset: ${f.boxShadowInset ? '✓' : '✗'}`,
      `  filter: drop-shadow(): ${f.dropShadow ? '✓' : '✗'} (IE 不支持)`,
      '',
      '【常见陷阱】',
      '  1. 大模糊半径（>100px）会触发重绘，影响滚动性能',
      '     → 滚动场景控制 blur 在 30px 以内',
      '  2. inset 写在中间会被解析为颜色（必须最前或最后）',
      '  3. spread 0 + blur 0 + offset 0 时 box-shadow 不显示',
      '  4. box-shadow 不跟随透明 PNG 形状（用 drop-shadow）',
      '  5. 多层阴影顺序：先写的在上层（与多重背景一致）',
      '  6. box-shadow 会跟随 border-radius 但不跟随 border-image',
      '  7. transition: box-shadow 性能不如 transform/opacity',
      '     → 大量元素同时变化时考虑用伪元素 + opacity 替代',
    ].join('\n');
    this.setState({ boxShadowInfo: info });
    this._addLog('css', `box-shadow 演示完成；supports=${f.boxShadow}/${f.boxShadowInset}/dropShadow=${f.dropShadow}`);
  }

  _renderCard5(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. box-shadow 多层阴影 —— inset / spread / 性能与 drop-shadow 对比',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['box-shadow', f.boxShadow],
          ['inset', f.boxShadowInset],
          ['drop-shadow()', f.dropShadow],
        ]),
        h(Tag, { color: 'primary' }, 'Visual L3'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'box-shadow: h-offset v-offset blur spread color inset，多层用逗号分隔（先写在上层），inset 内阴影，spread 扩散（0 0 0 3px 实心环做焦点环）。多层不同 blur 模拟真实物理阴影与霓虹光晕。性能：大模糊半径触发重绘，控制在 30px 内、3 层内。filter: drop-shadow() 跟随透明 PNG/SVG 形状但不支持 inset/spread，性能略差。box-shadow 跟随 border-radius 但不跟随 border-image。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 box-shadow 演示', { type: 'primary', size: 'sm', onClick: () => this._runBoxShadowDemo() }),
        ),
        h('div', { class: 'bb-shadow-multi' }),
        h('div', { class: 'bb-shadow-inset' }),
        h('div', { class: 'bb-shadow-neon' }, 'NEON'),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.boxShadowInfo || '（点击按钮查看 box-shadow 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 6：box-decoration-break =====================

  _runBoxDecoDemo(): void {
    const f = this._flags();
    const info = [
      '===== box-decoration-break =====',
      '',
      '【语法】',
      '  box-decoration-break: slice;   /* 默认：盒子被切分，边框/背景只画整体 */',
      '  box-decoration-break: clone;   /* 每行/每段独立绘制完整边框/背景/阴影 */',
      '',
      '  /* 浏览器前缀（Firefox 仍需 -webkit- 前缀）*/',
      '  -webkit-box-decoration-break: clone;',
      '  box-decoration-break: clone;',
      '',
      '【作用对象：分行的内联元素 / 分段的盒子】',
      '  - 内联元素跨多行时（如 <span> 包含长文本自动换行）',
      '  - 多列布局中的元素分段',
      '  - 分页打印时元素跨页',
      '',
      '【slice（默认）：盒子整体被切分】',
      '  /* 行内元素跨行时，背景/边框/阴影被切成多段 */',
      '  /* 但边框只在第一行开头和最后一行结尾绘制（中间行无左右边框）*/',
      '  /* 背景: 第一行从 padding 开始，最后一行到 padding 结束 */',
      '  /* 视觉上像是一个盒子被切开 */',
      '  .inline-box {',
      '    background: #3b82f6;',
      '    color: #fff;',
      '    padding: 4px 8px;',
      '    border-radius: 6px;',
      '    /* 默认 slice：换行时圆角只在首尾 */',
      '  }',
      '',
      '【clone：每行/每段独立绘制】',
      '  .inline-box-clone {',
      '    background: #3b82f6;',
      '    color: #fff;',
      '    padding: 4px 8px;',
      '    border-radius: 6px;',
      '    -webkit-box-decoration-break: clone;',
      '    box-decoration-break: clone;',
      '    /* 每一行都独立绘制完整背景、边框、圆角 */',
      '    /* 像是多个独立小盒子拼接 */',
      '  }',
      '',
      '【slice vs clone 视觉对比】',
      '  slice（默认）：',
      '    ┌──────────────┐',
      '    │ 第一行文本     │',
      '    │ 第二行文本     │  ← 中间行无左右边框，背景延伸',
      '    │ 第三行文本     │',
      '    └──────────────┘',
      '    /* 整体像一个被切开的盒子 */',
      '',
      '  clone：',
      '    ┌────────┐ ┌────────┐',
      '    │ 第一行 │ │ 第二行 │  ← 每行独立完整边框/圆角',
      '    └────────┘ └────────┘',
      '    /* 像是多个独立小标签 */',
      '',
      '【影响范围：背景/边框/圆角/阴影/外边距/内边距】',
      '  clone 时每行独立绘制：',
      '    - background（含多层 background-image）',
      '    - border（4 边完整绘制）',
      '    - border-radius（每行 4 个角都有圆角）',
      '    - box-shadow（每行独立阴影）',
      '    - padding（每行完整 padding）',
      '    - margin（每行左右 margin 独立）',
      '',
      '  slice 时整体绘制：',
      '    - 边框仅在首行左和末行右绘制',
      '    - 圆角仅在首行左角和末行右角绘制',
      '    - 阴影按整体盒子绘制',
      '    - padding 仅在首行左和末行右生效',
      '',
      '【实战：多行高亮标签（clone 最常用）】',
      '  /* 多行的高亮关键词标签 */',
      '  .highlight {',
      '    background: linear-gradient(180deg, #fef3c7, #fde68a);',
      '    padding: 2px 6px;',
      '    border-radius: 4px;',
      '    box-decoration-break: clone;',
      '    -webkit-box-decoration-break: clone;',
      '    /* 关键词跨行时每行都是独立的高亮标签 */',
      '  }',
      '',
      '  <p>这是一段很长的文本，<span class="highlight">关键词跨多行</span>也保持每个标签独立。</p>',
      '',
      '【实战：多行代码块背景】',
      '  .code-inline {',
      '    background: #0f172a;',
      '    color: #e2e8f0;',
      '    padding: 2px 6px;',
      '    border-radius: 4px;',
      '    font-family: monospace;',
      '    -webkit-box-decoration-break: clone;',
      '    box-decoration-break: clone;',
      '  }',
      '',
      '【实战：每行独立的链接背景】',
      '  /* 链接跨行时每行独立显示背景（常见于文章内链接）*/',
      '  .article-link {',
      '    background: rgba(59, 130, 246, 0.1);',
      '    padding: 2px 4px;',
      '    -webkit-box-decoration-break: clone;',
      '    box-decoration-break: clone;',
      '    /* 文章中的链接跨行时每行都是独立背景块 */',
      '  }',
      '',
      '【多列布局中的 clone】',
      '  .multi-col {',
      '    column-count: 3;',
      '  }',
      '  .multi-col .item {',
      '    break-inside: avoid;',
      '    border: 2px solid #3b82f6;',
      '    border-radius: 8px;',
      '    padding: 8px;',
      '    -webkit-box-decoration-break: clone;',
      '    box-decoration-break: clone;',
      '    /* 元素跨列时每列独立绘制边框 */',
      '  }',
      '',
      '【打印分页中的 clone】',
      '  @media print {',
      '    .avoid-break {',
      '      break-inside: avoid;',
      '    }',
      '    /* 元素跨页时 box-decoration-break: clone 让每页独立绘制 */',
      '  }',
      '',
      '【浏览器支持】',
      `  box-decoration-break: clone: ${f.boxDecoBreak ? '✓' : '✗'}`,
      '  Chrome/Edge/Safari: 完整支持（标准属性）',
      '  Firefox: 仅支持 -webkit- 前缀（截至 2024）',
      '  IE: 不支持',
      '',
      '【常见陷阱】',
      '  1. Firefox 仅支持 -webkit-box-decoration-break（必须加前缀）',
      '     → 同时写 -webkit- 和标准属性',
      '  2. clone 时每行 padding 都生效，可能导致视觉拥挤',
      '  3. clone 仅对 inline 元素跨行有效（block 元素不分行）',
      '  4. slice 是默认值，多数场景不需要显式声明',
      '  5. clone 会增加 paint 开销（每行独立绘制）',
      '  6. 检查 IE 退化为 slice（功能可用但无 clone 效果）',
    ].join('\n');
    this.setState({ boxDecoInfo: info });
    this._addLog('css', `box-decoration-break 演示完成；supports=${f.boxDecoBreak}`);
  }

  _renderCard6(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. box-decoration-break —— 多行内联元素的边框/背景/阴影断行',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['clone', f.boxDecoBreak]]),
        h(Tag, { color: 'primary' }, 'Visual L3'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'box-decoration-break: slice|clone 控制内联元素跨多行时边框/背景/阴影的绘制方式。slice（默认）：整体切开，边框/圆角仅在首行左和末行右绘制。clone：每行独立绘制完整边框、背景、圆角、阴影（像多个独立小标签拼接）。Firefox 仅支持 -webkit- 前缀。最常用场景：多行高亮关键词标签、文章内链接背景、代码内联背景。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 box-decoration-break 演示', { type: 'primary', size: 'sm', onClick: () => this._runBoxDecoDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'clone 演示（多行内联）：'),
        h('p', { style: { maxWidth: '200px', lineHeight: '1.8' } },
          '这是一段较长的文字用来测试 box-decoration-break 的 clone 效果，',
          h('span', { class: 'bb-deco-clone' }, '这段高亮关键词会跨多行，每行都独立绘制完整背景和圆角'),
          '，看效果。',
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.boxDecoInfo || '（点击按钮查看 box-decoration-break 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 7：outline 与 outline-offset =====================

  _runOutlineDemo(): void {
    const f = this._flags();
    const info = [
      '===== outline 与 outline-offset =====',
      '',
      '【outline 简写语法】',
      '  outline: <width> <style> <color>;',
      '  /* 类似 border 但不占布局空间 */',
      '',
      '  outline: 2px solid blue;',
      '  outline: 3px dashed red;',
      '  outline: none;            /* 移除轮廓 */',
      '',
      '【outline 分项属性】',
      '  outline-width: 2px;',
      '  outline-style: solid;     /* solid/dashed/dotted/double/groove/... */',
      '  outline-color: blue;',
      '  outline-offset: 4px;      /* 距离 border 的偏移（可正可负）*/',
      '',
      '【outline-style 取值】',
      '  none       无轮廓',
      '  solid      实线（最常用）',
      '  dashed     虚线',
      '  dotted     点线',
      '  double     双线',
      '  groove     3D 凹槽',
      '  ridge      3D 凸脊',
      '  inset      3D 内嵌',
      '  outset     3D 外凸',
      '  auto       浏览器自动（默认，常见为细虚线）',
      '',
      '【outline 与 border 的关键区别】',
      '  ┌─────────────────────────────────┐',
      '  │ outline 不占布局空间             │  ← 关键！',
      '  │ outline 不影响元素尺寸           │',
      '  │ outline 不触发 reflow            │',
      '  │ outline 不跟随 border-radius    │  ← 仍是矩形',
      '  │ outline 不支持单边（仅整体）     │',
      '  │ outline-offset 可正可负         │',
      '  └─────────────────────────────────┘',
      '',
      '  border 占布局空间（影响元素尺寸）',
      '  border 触发 reflow',
      '  border 跟随 border-radius',
      '  border 支持单边（border-top 等）',
      '',
      '【outline-offset：距 border 的偏移】',
      '  outline-offset: 0;        /* 默认：紧贴 border */',
      '  outline-offset: 4px;      /* 向外偏移 4px（轮廓与 border 之间有间隙）*/',
      '  outline-offset: -4px;     /* 向内偏移 4px（轮廓画在元素内部）*/',
      '',
      '  /* 正偏移：轮廓在元素外（常见焦点环）*/',
      '  .focus-out {',
      '    outline: 3px solid #3b82f6;',
      '    outline-offset: 3px;  /* 轮廓距元素 3px */',
      '  }',
      '',
      '  /* 负偏移：轮廓在元素内 */',
      '  .focus-in {',
      '    outline: 3px solid #3b82f6;',
      '    outline-offset: -3px;  /* 轮廓画在元素内 3px 处 */',
      '  }',
      '',
      '【outline 不占布局空间的意义】',
      '  /* 设置 outline 后元素尺寸不变 */',
      '  /* 不会推动相邻元素 */',
      '  /* 适合动态显示/隐藏的焦点环 */',
      '',
      '  .btn {',
      '    width: 100px;',
      '    height: 40px;',
      '    /* 加 outline 后元素仍是 100x40，不挤压相邻元素 */',
      '    outline: 3px solid #f59e0b;',
      '    outline-offset: 2px;',
      '  }',
      '',
      '【outline 不触发 reflow 的性能意义】',
      '  - outline 变化仅触发 paint，不触发 layout',
      '  - 适合频繁切换的场景（如 :focus 切换）',
      '  - 而 border 变化会触发 layout（影响性能）',
      '',
      '【无障碍焦点环：:focus-visible（推荐！）】',
      '  /* :focus-visible 仅在键盘焦点时显示轮廓 */',
      '  /* 鼠标点击不显示（用户体验更好）*/',
      '  .btn:focus-visible {',
      '    outline: 3px solid #3b82f6;',
      '    outline-offset: 2px;',
      '  }',
      '',
      '  /* 鼠标点击 :focus 但不 :focus-visible */',
      '  /* 键盘 Tab :focus 且 :focus-visible */',
      '  /* :focus-visible 是现代焦点环的最佳实践 */',
      '',
      '【全局焦点环重置（保持无障碍）】',
      '  /* 错误：直接移除 outline（无障碍灾难）*/',
      '  *:focus { outline: none; }  /* ❌ 屏幕阅读器用户找不到焦点 */',
      '',
      '  /* 正确：仅在 :focus 时移除，:focus-visible 时恢复 */',
      '  *:focus { outline: none; }',
      '  *:focus-visible {',
      '    outline: 3px solid #3b82f6;',
      '    outline-offset: 2px;',
      '  }',
      '',
      '【outline 不跟随 border-radius 的解决方案】',
      '  /* outline 仍是矩形，圆角元素焦点环不美观 */',
      '  /* 方案 1：用 box-shadow 替代（跟随圆角）*/',
      '  .btn:focus-visible {',
      '    outline: none;',
      '    box-shadow: 0 0 0 3px #3b82f6;  /* 跟随 border-radius */',
      '  }',
      '',
      '  /* 方案 2：保留 outline + outline-offset 模拟间距 */',
      '  .btn {',
      '    border-radius: 8px;',
      '  }',
      '  .btn:focus-visible {',
      '    outline: 3px solid #3b82f6;',
      '    outline-offset: 2px;',
      '    /* outline 仍是矩形，但 offset 让轮廓离圆角远一点 */',
      '  }',
      '',
      '【Firefox 焦点环 -moz-focusring（旧版兼容）*/',
      '  /* Firefox 旧版用 :-moz-focusring */',
      '  .btn:-moz-focusring {',
      '    outline: 3px solid #3b82f6;',
      '  }',
      '  /* 现代 Firefox 已支持 :focus-visible */',
      '',
      '【实战：自定义焦点环颜色（高对比度）】',
      '  /* 在深色背景下用亮色焦点环 */',
      '  .dark-btn:focus-visible {',
      '    outline: 3px solid #fbbf24;',
      '    outline-offset: 2px;',
      '  }',
      '',
      '【实战：动画过渡焦点环 */',
      '  /* outline 不支持 transition（border-width 才支持）*/',
      '  /* 用 box-shadow 模拟过渡 */',
      '  .btn {',
      '    transition: box-shadow 0.2s;',
      '  }',
      '  .btn:focus-visible {',
      '    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5);',
      '  }',
      '',
      '【outline 与 box-shadow 焦点环对比】',
      '  outline',
      '    + 不占布局空间',
      '    + 不触发 reflow',
      '    + 浏览器默认焦点行为',
      '    - 不跟随 border-radius',
      '    - 不支持 transition',
      '',
      '  box-shadow: 0 0 0 3px ...',
      '    + 跟随 border-radius',
      '    + 支持 transition',
      '    + 可多层叠加（多层光环）',
      '    - 占 paint 开销（但同样不触发 layout）',
      '    - 半透明阴影可能不如 outline 清晰',
      '',
      '【浏览器支持】',
      `  outline: ${f.outline ? '✓' : '✗'} (IE8+/所有现代浏览器)`,
      `  outline-offset: ${f.outlineOffset ? '✓' : '✗'} (IE 不支持，所有现代浏览器支持)`,
      '  :focus-visible: 全现代浏览器支持 (Chrome 86+/Firefox 88+/Safari 15.4+)',
      '',
      '【常见陷阱】',
      '  1. outline 不跟随 border-radius（仍是矩形）',
      '     → 圆角元素用 box-shadow: 0 0 0 3px ... 替代',
      '  2. outline-offset 在 IE 不支持',
      '  3. *:focus { outline: none; } 会破坏无障碍',
      '     → 必须配 :focus-visible 恢复',
      '  4. outline 不支持单边（只能整体设置）',
      '  5. outline 不支持 transition（border-width 才支持）',
      '  6. outline-offset 负值让轮廓画在元素内（用于内嵌焦点环）',
      '  7. 移除 outline 前确保有替代焦点指示（box-shadow 或自定义）',
    ].join('\n');
    this.setState({ outlineInfo: info });
    this._addLog('css', `outline 演示完成；supports=${f.outline}/${f.outlineOffset}`);
  }

  _renderCard7(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. outline 与 outline-offset —— 不占布局的轮廓与焦点环',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['outline', f.outline],
          ['outline-offset', f.outlineOffset],
        ]),
        h(Tag, { color: 'primary' }, 'A11y'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'outline: width style color 简写，类似 border 但不占布局空间、不触发 reflow、不跟随 border-radius、不支持单边。outline-offset 可正可负（正向画在元素外，负向画在元素内）。:focus-visible 仅在键盘焦点时显示轮廓（现代无障碍焦点环最佳实践）。outline 不支持 transition，需过渡时用 box-shadow: 0 0 0 3px ... 替代（跟随圆角）。*:focus { outline: none } 会破坏无障碍，必须配 :focus-visible 恢复。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 outline 演示', { type: 'primary', size: 'sm', onClick: () => this._runOutlineDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '用 Tab 键聚焦下方按钮查看 :focus-visible：'),
        h('button', { class: 'bb-outline-btn', type: 'button' }, 'Focus Me (Tab)'),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.outlineInfo || '（点击按钮查看 outline 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 8：实战模式与陷阱 =====================

  _runPatternDemo(): void {
    const f = this._flags();
    const info = [
      '===== 实战模式与陷阱清单 =====',
      '',
      '【模式 1：渐变文字（background-clip: text）】',
      '  .gradient-text {',
      '    background: linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899);',
      '    -webkit-background-clip: text;   /* 必须 -webkit- 前缀 */',
      '    background-clip: text;',
      '    color: transparent;              /* 文字透明露出背景 */',
      '    /* 或 -webkit-text-fill-color: transparent; 兼容性更好 */',
      '  }',
      '',
      '  /* 动画渐变文字 */',
      '  @keyframes gradient-flow {',
      '    0%   { background-position: 0% 50%; }',
      '    100% { background-position: 200% 50%; }',
      '  }',
      '  .animated-gradient-text {',
      '    background: linear-gradient(90deg, #3b82f6, #ec4899, #f59e0b, #3b82f6);',
      '    background-size: 200% auto;',
      '    -webkit-background-clip: text;',
      '    background-clip: text;',
      '    color: transparent;',
      '    animation: gradient-flow 3s linear infinite;',
      '  }',
      '',
      '【模式 2：多层背景叠加图案（纹理 + 渐变）】',
      '  .pattern-bg {',
      '    background-color: #1e40af;',
      '    background-image:',
      '      url(noise.png),                                     /* 纹理层 */',
      '      radial-gradient(circle at 25% 25%, #3b82f6 0%, transparent 50%),',
      '      radial-gradient(circle at 75% 75%, #ec4899 0%, transparent 50%),',
      '      linear-gradient(135deg, #1e40af, #0f172a);',
      '    background-blend-mode: overlay, normal, normal, normal;',
      '    background-size: 200px 200px, cover, cover, cover;',
      '  }',
      '',
      '【模式 3：阴影立体感（多层不同 blur）】',
      '  /* 真实物理阴影：小模糊锐利接触 + 大模糊柔和扩散 */',
      '  .realistic-card {',
      '    background: #fff;',
      '    border-radius: 12px;',
      '    box-shadow:',
      '      0 1px 2px rgba(0, 0, 0, 0.05),       /* 锐利接触阴影 */',
      '      0 4px 8px rgba(0, 0, 0, 0.05),',
      '      0 12px 24px rgba(0, 0, 0, 0.05),',
      '      0 24px 48px rgba(0, 0, 0, 0.08);     /* 远距离柔和阴影 */',
      '  }',
      '',
      '【模式 4：毛玻璃卡片（backdrop-filter + border）】',
      '  .glass-card {',
      '    background: rgba(255, 255, 255, 0.2);   /* 半透明背景 */',
      '    backdrop-filter: blur(8px);              /* 毛玻璃模糊 */',
      '    -webkit-backdrop-filter: blur(8px);      /* Safari 前缀 */',
      '    border: 1px solid rgba(255, 255, 255, 0.3);  /* 半透明边框增加层次 */',
      '    border-radius: 12px;',
      '    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);',
      '  }',
      '',
      '  /* backdrop-filter 兼容性：*/',
      '  /* Chrome 76+/Firefox 103+/Safari 9+（需 -webkit- 前缀）*/',
      '  /* 后备：背景半透明色块（无模糊但仍有玻璃感）*/',
      '',
      '【模式 5：霓虹光晕（多层 box-shadow）】',
      '  .neon-text {',
      '    color: #fff;',
      '    text-shadow:',
      '      0 0 5px #22d3ee,',
      '      0 0 10px #22d3ee,',
      '      0 0 20px #22d3ee,',
      '      0 0 40px #06b6d4;',
      '  }',
      '',
      '  .neon-box {',
      '    background: #0f172a;',
      '    color: #22d3ee;',
      '    border: 1px solid #22d3ee;',
      '    box-shadow:',
      '      0 0 5px #22d3ee,',
      '      0 0 10px #22d3ee,',
      '      0 0 20px #22d3ee,',
      '      0 0 40px #06b6d4,',
      '      0 0 80px #06b6d4;  /* 最外层大模糊光晕 */',
      '    /* 多层不同模糊半径模拟光晕扩散效果 */',
      '  }',
      '',
      '  /* 霓虹闪烁动画 */',
      '  @keyframes neon-flicker {',
      '    0%, 100% { opacity: 1; }',
      '    50%      { opacity: 0.8; }',
      '  }',
      '  .neon-flicker { animation: neon-flicker 0.5s infinite; }',
      '',
      '【模式 6：按钮 hover 阴影动画】',
      '  .btn {',
      '    background: #3b82f6;',
      '    color: #fff;',
      '    padding: 10px 20px;',
      '    border-radius: 6px;',
      '    border: none;',
      '    cursor: pointer;',
      '    /* 仅过渡 transform/box-shadow（不触发 layout）*/',
      '    transition: transform 0.2s ease, box-shadow 0.2s ease;',
      '    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);',
      '  }',
      '  .btn:hover {',
      '    transform: translateY(-2px);   /* 上移 */',
      '    box-shadow: 0 8px 16px rgba(59, 130, 246, 0.4);  /* 阴影变大变深 */',
      '  }',
      '  .btn:active {',
      '    transform: translateY(0);      /* 按下复位 */',
      '    box-shadow: 0 1px 2px rgba(59, 130, 246, 0.3);   /* 阴影变小 */',
      '  }',
      '',
      '【模式 7：焦点环无障碍（:focus-visible + box-shadow）】',
      '  .btn {',
      '    border-radius: 8px;',
      '    /* 鼠标点击不显示轮廓 */',
      '    transition: box-shadow 0.2s;',
      '  }',
      '  /* 键盘 Tab 时显示焦点环 */',
      '  .btn:focus-visible {',
      '    outline: none;',
      '    box-shadow: 0 0 0 3px #fff, 0 0 0 6px #3b82f6;',
      '    /* 双层 box-shadow：白色内环 + 蓝色外环 */',
      '    /* 跟随 border-radius，比 outline 更美观 */',
      '  }',
      '',
      '【模式 8：渐变边框（两层 div 模拟，圆角兼容）】',
      '  /* border-image 不支持 border-radius，用两层 div 模拟 */',
      '  .gradient-border {',
      '    background: linear-gradient(135deg, #3b82f6, #ec4899);',
      '    padding: 2px;          /* 边框宽度 */',
      '    border-radius: 12px;   /* 外层圆角 */',
      '  }',
      '  .gradient-border > .inner {',
      '    background: #fff;',
      '    border-radius: 10px;   /* 内层圆角（外层 - padding）*/',
      '    padding: 16px;',
      '  }',
      '',
      '【模式 9：纸张/噪声纹理叠加】',
      '  .paper {',
      '    background-color: #f5f0e6;',
      '    background-image:',
      '      url(data:image/svg+xml;base64,...),  /* SVG 噪声 */',
      '      radial-gradient(circle at 20% 30%, rgba(0,0,0,0.03) 0%, transparent 50%),',
      '      radial-gradient(circle at 80% 70%, rgba(0,0,0,0.03) 0%, transparent 50%);',
      '    background-blend-mode: multiply, normal, normal;',
      '  }',
      '',
      '【模式 10：双色调滤镜（mix-blend-mode + 多层背景）】',
      '  .duotone {',
      '    background-image: url(photo.jpg), linear-gradient(135deg, #3b82f6, #ec4899);',
      '    background-blend-mode: lighten, normal;',
      '    /* 照片与渐变混合实现双色调效果 */',
      '  }',
      '',
      '===== 陷阱清单 =====',
      '',
      '【陷阱 1：background-clip: text 必须 -webkit- 前缀】',
      '  /* 错误：仅写标准属性 */',
      '  .text { background-clip: text; color: transparent; }  /* Safari 不显示 */',
      '',
      '  /* 正确：同时写 -webkit- 前缀 */',
      '  .text {',
      '    -webkit-background-clip: text;',
      '    background-clip: text;',
      '    color: transparent;',
      '    /* 或 -webkit-text-fill-color: transparent; */',
      '  }',
      '',
      '【陷阱 2：box-shadow 大模糊半径性能差】',
      '  /* 避免在滚动列表用大模糊 */',
      '  .scroll-item {',
      '    box-shadow: 0 0 100px rgba(0, 0, 0, 0.3);  /* ❌ 大模糊触发重绘 */',
      '  }',
      '',
      '  /* 改为小模糊多层叠加 */',
      '  .scroll-item {',
      '    box-shadow:',
      '      0 2px 4px rgba(0, 0, 0, 0.1),',
      '      0 8px 16px rgba(0, 0, 0, 0.1);   /* ✓ 模糊在 30px 内 */',
      '  }',
      '',
      '【陷阱 3：border-image slice 数值无单位】',
      '  /* 错误：写成 px */',
      '  border-image-slice: 30px;  /* ❌ 无效 */',
      '',
      '  /* 正确：无单位（1 = 1 像素）*/',
      '  border-image-slice: 30;    /* ✓ */',
      '',
      '  /* 也可用百分比 */',
      '  border-image-slice: 30%;   /* 相对图片尺寸 */',
      '',
      '【陷阱 4：outline 不影响布局，但样式仍按矩形】',
      '  /* outline 不跟随 border-radius */',
      '  .rounded {',
      '    border-radius: 50%;',
      '    outline: 3px solid blue;  /* 仍是矩形轮廓 */',
      '  }',
      '',
      '  /* 解决：用 box-shadow 替代 */',
      '  .rounded:focus-visible {',
      '    outline: none;',
      '    box-shadow: 0 0 0 3px blue;  /* 跟随圆角 */',
      '  }',
      '',
      '【陷阱 5：*:focus { outline: none } 破坏无障碍】',
      '  /* 错误：全局移除 outline */',
      '  *:focus { outline: none; }  /* ❌ 屏幕阅读器用户找不到焦点 */',
      '',
      '  /* 正确：保留 :focus-visible 焦点环 */',
      '  *:focus:not(:focus-visible) { outline: none; }',
      '  *:focus-visible {',
      '    outline: 3px solid #3b82f6;',
      '    outline-offset: 2px;',
      '  }',
      '',
      '【陷阱 6：background-blend-mode 层数不匹配】',
      '  /* 错误：blend-mode 数量与 image 不一致 */',
      '  background-image: url(a), url(b), url(c);',
      '  background-blend-mode: multiply, normal;  /* ❌ 3 vs 2 */',
      '',
      '  /* 正确：层数对应或单值应用到所有层 */',
      '  background-image: url(a), url(b), url(c);',
      '  background-blend-mode: multiply, normal, screen;  /* ✓ */',
      '',
      '【陷阱 7：border-radius 在 table border-collapse: collapse 无效】',
      '  /* 错误 */',
      '  table {',
      '    border-collapse: collapse;  /* 圆角无效 */',
      '    border-radius: 8px;',
      '  }',
      '',
      '  /* 正确：用 separate */',
      '  table {',
      '    border-collapse: separate;',
      '    border-spacing: 0;',
      '    border-radius: 8px;',
      '    overflow: hidden;  /* 配合 overflow 让圆角生效 */',
      '  }',
      '',
      '【陷阱 8：backdrop-filter 兼容性】',
      '  /* Firefox < 103 不支持 */',
      '  /* Safari 需 -webkit- 前缀 */',
      '  /* 后备：半透明背景（无模糊但仍有玻璃感）*/',
      '  .glass {',
      '    background: rgba(255, 255, 255, 0.7);  /* 后备 */',
      '    backdrop-filter: blur(8px);',
      '    -webkit-backdrop-filter: blur(8px);',
      '  }',
      '  /* @supports 检测后增强 */',
      '  @supports (backdrop-filter: blur(8px)) {',
      '    .glass { background: rgba(255, 255, 255, 0.2); }',
      '  }',
      '',
      '【陷阱 9：border-image 必须先设 border-width 占位】',
      '  /* 错误：未设 border-width，border-image 不显示 */',
      '  .box { border-image: url(x) 30 round; }  /* ❌ */',
      '',
      '  /* 正确：先设透明 border 占位 */',
      '  .box {',
      '    border: 20px solid transparent;  /* ✓ 占位 */',
      '    border-image: url(x) 30 round;',
      '  }',
      '',
      '【陷阱 10：多层 background 简写中 position / size 顺序】',
      '  /* 错误：position 与 size 用空格 */',
      '  background: url(x) center cover;  /* ❌ 解析失败 */',
      '',
      '  /* 正确：用 / 分隔 position / size */',
      '  background: url(x) center / cover;  /* ✓ */',
      '',
      '【浏览器支持汇总】',
      `  background-clip: text: ${f.bgClipText ? '✓' : '✗'} (需 -webkit- 前缀)`,
      `  background-blend-mode: ${f.blendMode ? '✓' : '✗'}`,
      `  backdrop-filter: ${f.backdropFilter ? '✓' : '✗'} (Safari 需 -webkit- 前缀)`,
      `  filter: drop-shadow(): ${f.dropShadow ? '✓' : '✗'}`,
      `  border-image: ${f.borderImage ? '✓' : '✗'}`,
      `  box-decoration-break: clone: ${f.boxDecoBreak ? '✓' : '✗'} (Firefox 需 -webkit- 前缀)`,
      `  outline-offset: ${f.outlineOffset ? '✓' : '✗'} (IE 不支持)`,
      '',
      '【资源】',
      '  - CSS Backgrounds L3 规范：https://drafts.csswg.org/css-backgrounds-3/',
      '  - CSS Compositing 规范：https://drafts.fxtf.org/compositing-1/',
      '  - backdrop-filter MDN：https://developer.mozilla.org/docs/Web/CSS/backdrop-filter',
      '  - :focus-visible MDN：https://developer.mozilla.org/docs/Web/CSS/:focus-visible',
    ].join('\n');
    this.setState({ patternInfo: info });
    this._addLog('css', '实战模式与陷阱演示完成');
  }

  _renderCard8(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 实战模式与陷阱清单（渐变文字/毛玻璃/霓虹/焦点环/陷阱）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, '实战'),
        h(Tag, { color: f.bgClipText ? 'success' : 'error' }, `clip:text ${f.bgClipText ? '✓' : '✗'}`),
        h(Tag, { color: f.backdropFilter ? 'success' : 'error' }, `backdrop ${f.backdropFilter ? '✓' : '✗'}`),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '10 种实战模式 + 10 个陷阱清单。模式：渐变文字（background-clip:text + -webkit- 前缀）/ 多层背景叠加图案（background-blend-mode）/ 阴影立体感（多层不同 blur）/ 毛玻璃卡片（backdrop-filter+border）/ 霓虹光晕（多层 box-shadow 多层模糊）/ 按钮 hover 阴影动画（transform + box-shadow 过渡）/ 焦点环无障碍（:focus-visible + 双层 box-shadow）/ 渐变边框圆角（两层 div 模拟）/ 纸张纹理 / 双色调滤镜。陷阱：clip:text 必须 -webkit- / 大模糊性能 / slice 无单位 / outline 不跟随圆角 / *:focus 破坏无障碍 / blend-mode 层数匹配 / table 圆角 / backdrop-filter 兼容 / border-image 占位 / position / size 顺序。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行实战模式与陷阱演示', { type: 'primary', size: 'sm', onClick: () => this._runPatternDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '毛玻璃卡片：'),
        h('div', { class: 'bb-glass' }),
        h('div', { class: 'fs-sm text-secondary' }, '霓虹光晕：'),
        h('div', { class: 'bb-shadow-neon' }, 'NEON'),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.patternInfo || '（点击按钮查看 10 种实战模式 + 10 个陷阱清单）')),
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
      h('h2', { class: 'section-title' }, 'CSS Backgrounds / Borders / Shadows 深潜实验室'),

      h(Alert, {
        type: 'info',
        message: 'CSS Backgrounds Module + Borders Module + Box Shadow / Outline —— 浏览器原生装饰体系',
        description: '演示多重背景（background-image 多层叠加 + background 简写 + 各分项属性 + 层叠顺序 + background-blend-mode 协同）、background-clip/origin/size/attachment（text 渐变文字 + cover/contain + local/fixed 视差）、border-radius 复杂圆角（单/双/三/四值 + 椭圆角 / 分隔 + 百分比不规则形状）、border-image（九宫格切片原理 + slice 无单位 + repeat 模式 + 与 border 协同 + 不支持 border-radius）、box-shadow 多层阴影（inset 内阴影 + spread 扩散 + 多层不同 blur 立体感 + 性能注意 + drop-shadow 对比）、box-decoration-break（slice/clone 多行内联绘制）、outline 与 outline-offset（不占布局 + 不触发 reflow + :focus-visible 无障碍焦点环）、10 种实战模式（渐变文字/毛玻璃/霓虹/焦点环/渐变边框）+ 10 个陷阱清单。用 CSS.supports() 检测，jsdom 不做真实渲染但流程完整。',
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
