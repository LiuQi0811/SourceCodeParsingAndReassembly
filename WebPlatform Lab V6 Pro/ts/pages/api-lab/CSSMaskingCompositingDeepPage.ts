// =====================================================================
// CSSMaskingCompositingDeepPage.js —— CSS Masking & Compositing 遮罩与合成深度实验室
// 演示 CSS Masking Module Level 1 + SVG mask + 浏览器遮罩与合成能力
// 全套基础能力，是浏览器原生遮罩体系的核心：
//   1. mask 与 mask-image —— 遮罩图像基础
//      mask: <mask-layer># 简写；mask-image: none|<image>|<image-set>
//      alpha 通道决定可见性（黑透明/白不透明）
//      与 clip-path 区别（mask 用 alpha/luminance 渐变切边可羽化、clip-path 硬切边）
//      -webkit-mask-* 前缀历史与现状 Chrome 120+ 标准无前缀 Safari 仍需 -webkit-
//   2. mask-image 与多遮罩叠加 —— 与 background-image 同构 API
//      mask-image: url(mask.png)/linear-gradient()/radial-gradient()/image-set()
//      多重遮罩叠加逗号分隔（先写的在上层），SVG mask 元素引用 url(#svgMask)
//      mask-image vs mask-border-source 区别
//   3. mask-mode 与 mask-type —— 遮罩模式选择
//      mask-mode: match-source|alpha|luminance
//      match-source 默认自动选择（PNG 用 alpha、SVG 用 luminance）
//      alpha 模式使用图像 alpha 通道；luminance 模式使用图像亮度
//      mask-type 仅用于 SVG <mask> 元素 mask-type: luminance|alpha
//   4. mask-repeat/position/size/origin/clip —— 与 background-* 完全同构
//      mask-repeat: repeat|no-repeat|repeat-x|repeat-y|space|round
//      mask-size: auto|<length>|<percentage>|cover|contain
//      mask-origin: border-box|padding-box|content-box|fill-box|stroke-box|view-box
//      mask 简写顺序与 background 一致
//   5. mask-composite —— 合成运算
//      mask-composite: add|subtract|intersect|exclude
//      add 默认并集；subtract 旧减新；intersect 交集；exclude 对称差
//      多层 mask 从下往上合成；与 SVG mask-mode/mask-type 配合
//   6. mask-border —— 高级遮罩边框
//      mask-border: <source> <slice> <width> <outset> <repeat> <mode>
//      mask-border-mode: alpha|luminance；与 border-image 同构
//   7. SVG mask 元素 —— url() 引用
//      <mask id maskUnits maskContentUnits>；CSS mask-image: url(#svgMask)
//      maskUnits: userSpaceOnUse|objectBoundingBox
//   8. 实战模式与陷阱 —— 羽化/文字遮罩/不规则遮罩/动画/毛玻璃/调试
// 说明：jsdom 不做真实遮罩渲染，但 CSS.supports 可探测属性支持；
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

interface CSSMaskingCompositingDeepPageState extends State {
  logs: LogEntry[];
  capsSummary: string;
  overviewInfo: string;
  maskImageInfo: string;
  maskModeInfo: string;
  maskBoxPropsInfo: string;
  maskCompositeInfo: string;
  maskBorderInfo: string;
  svgMaskInfo: string;
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

export class CSSMaskingCompositingDeepPage extends Page {
  declare state: CSSMaskingCompositingDeepPageState;
  _inited: boolean = false;
  _dynamicStyles: HTMLStyleElement[] = [];


  initialState(): CSSMaskingCompositingDeepPageState {
    return {
      logs: [],
      capsSummary: '',
      overviewInfo: '',     // Card 1：CSS Masking 概述与 mask 基础
      maskImageInfo: '',    // Card 2：mask-image 与多遮罩叠加
      maskModeInfo: '',     // Card 3：mask-mode 与 mask-type
      maskBoxPropsInfo: '', // Card 4：mask-repeat/position/size/origin/clip
      maskCompositeInfo: '',// Card 5：mask-composite 与合成运算
      maskBorderInfo: '',   // Card 6：mask-border 高级遮罩边框
      svgMaskInfo: '',      // Card 7：SVG mask 元素与 url() 引用
      patternInfo: '',      // Card 8：实战模式与陷阱
    };
  }

  componentDidMount(): void {
    if (this._inited) return;
    this._inited = true;

    this._dynamicStyles = [];

    const f = this._flags();
    const c = (ok: boolean) => ok ? '✓' : '✗';
    const parts = [
      `mask ${c(f.mask)}`,
      `mask-image ${c(f.maskImage)}`,
      `mask-mode ${c(f.maskMode)}`,
      `mask-composite ${c(f.maskComposite)}`,
      `mask-border-source ${c(f.maskBorderSource)}`,
      `mask-type ${c(f.maskType)}`,
    ];

    const summary = f.css
      ? `CSS Masking & Compositing 能力检测：${parts.join(' · ')}。jsdom 不做真实遮罩渲染，但 CSS.supports 可探测属性支持；按钮点击注入演示样式 + 完整代码示例，真实浏览器可查看效果。`
      : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击仅记日志说明，不会抛异常。';

    this.setState({ capsSummary: summary });
    this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.maskMode) this._addLog('warn', 'mask-mode 不可用（Chrome 120+ 标准无前缀）');
    if (!f.maskBorderSource) this._addLog('warn', 'mask-border 浏览器支持有限（Chrome 部分支持，Firefox 实验性）');
    if (!f.maskComposite) this._addLog('info', 'mask-composite 部分浏览器需 -webkit- 前缀（Safari）');

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
    this._injectStyle('css-mk-base', `
      .mk-demo {
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
      }
      .mk-box {
        width: 100px;
        height: 100px;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 700;
        font-size: 12px;
      }
      .mk-feather {
        -webkit-mask: linear-gradient(black, transparent);
                mask: linear-gradient(black, transparent);
      }
      .mk-radial {
        -webkit-mask: radial-gradient(circle, black 40%, transparent 70%);
                mask: radial-gradient(circle, black 40%, transparent 70%);
      }
      .mk-multi {
        -webkit-mask:
          linear-gradient(black, transparent),
          linear-gradient(transparent, black);
                mask:
          linear-gradient(black, transparent),
          linear-gradient(transparent, black);
      }
      .mk-text-mask {
        font-size: 36px;
        font-weight: 900;
        background: linear-gradient(135deg, #3b82f6, #ec4899, #f59e0b);
        -webkit-background-clip: text;
                background-clip: text;
        color: transparent;
        -webkit-mask: linear-gradient(black 50%, transparent);
                mask: linear-gradient(black 50%, transparent);
        padding: 8px 16px;
      }
      .mk-composite-add {
        -webkit-mask:
          radial-gradient(circle at 30% 50%, black 30%, transparent 30%),
          radial-gradient(circle at 70% 50%, black 30%, transparent 30%);
        -webkit-mask-composite: source-over;
                mask:
          radial-gradient(circle at 30% 50%, black 30%, transparent 30%),
          radial-gradient(circle at 70% 50%, black 30%, transparent 30%);
                mask-composite: add;
      }
      .mk-composite-intersect {
        -webkit-mask:
          radial-gradient(circle at 30% 50%, black 40%, transparent 40%),
          radial-gradient(circle at 70% 50%, black 40%, transparent 40%);
        -webkit-mask-composite: source-in;
                mask:
          radial-gradient(circle at 30% 50%, black 40%, transparent 40%),
          radial-gradient(circle at 70% 50%, black 40%, transparent 40%);
                mask-composite: intersect;
      }
      .mk-composite-exclude {
        -webkit-mask:
          radial-gradient(circle at 35% 50%, black 35%, transparent 35%),
          radial-gradient(circle at 65% 50%, black 35%, transparent 35%);
        -webkit-mask-composite: xor;
                mask:
          radial-gradient(circle at 35% 50%, black 35%, transparent 35%),
          radial-gradient(circle at 65% 50%, black 35%, transparent 35%);
                mask-composite: exclude;
      }
      .mk-svg-host {
        padding: 12px;
        background: #f1f5f9;
        border-radius: 8px;
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
      }
      .mk-svg-circle {
        width: 100px;
        height: 100px;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="black"/></svg>') no-repeat center / contain;
                mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="black"/></svg>') no-repeat center / contain;
      }
      .mk-svg-complex {
        width: 140px;
        height: 100px;
        background: linear-gradient(135deg, #ef4444, #f59e0b);
        -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="140" height="100"><path d="M20,50 Q70,10 120,50 Q70,90 20,50 Z" fill="black"/></svg>') no-repeat center / contain;
                mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="140" height="100"><path d="M20,50 Q70,10 120,50 Q70,90 20,50 Z" fill="black"/></svg>') no-repeat center / contain;
      }
      .mk-border-host {
        padding: 12px;
        background: #f1f5f9;
        border-radius: 8px;
        margin-top: 10px;
      }
      .mk-border-demo {
        width: 120px;
        height: 80px;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        -webkit-mask-border: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect x="0" y="0" width="40" height="40" fill="black"/></svg>') 10 / 10px / 0 stretch;
                mask-border: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect x="0" y="0" width="40" height="40" fill="black"/></svg>') 10 / 10px / 0 stretch;
      }
      .mk-pattern-host {
        padding: 12px;
        background: linear-gradient(135deg, #dbeafe, #ede9fe);
        border-radius: 8px;
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
      }
      .mk-feather-edge {
        width: 120px;
        height: 80px;
        background: linear-gradient(90deg, #ef4444, #f59e0b);
        -webkit-mask: radial-gradient(ellipse at center, black 50%, transparent 80%);
                mask: radial-gradient(ellipse at center, black 50%, transparent 80%);
      }
      .mk-fade-hover {
        width: 100px;
        height: 100px;
        background: linear-gradient(135deg, #10b981, #34d399);
        -webkit-mask: linear-gradient(black, black);
                mask: linear-gradient(black, black);
        transition: mask 0.4s ease, -webkit-mask 0.4s ease;
        cursor: pointer;
      }
      .mk-fade-hover:hover {
        -webkit-mask: linear-gradient(black, transparent);
                mask: linear-gradient(black, transparent);
      }
      .mk-glass {
        width: 140px;
        height: 80px;
        background: rgba(255, 255, 255, 0.25);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        -webkit-mask: linear-gradient(black, transparent);
                mask: linear-gradient(black, transparent);
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.4);
      }
      .mk-output {
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

  _flags(): any {
    const hasCSS = typeof CSS !== 'undefined';
    const supportsPV = (p: string, v: string) => {
      try { return hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v); }
      catch { return false; }
    };
    return {
      css: hasCSS,
      supports: hasCSS && typeof CSS.supports === 'function',
      mask: supportsPV('mask', 'linear-gradient(black, transparent)'),
      maskImage: supportsPV('mask-image', 'linear-gradient(black, transparent)'),
      maskMode: supportsPV('mask-mode', 'alpha'),
      maskComposite: supportsPV('mask-composite', 'subtract'),
      maskBorderSource: supportsPV('mask-border-source', 'url(x)'),
      maskType: supportsPV('mask-type', 'alpha'),
    };
  }

  // ===================== Card 1：CSS Masking 概述与 mask 基础 =====================

  _runOverviewDemo(): void {
    const f = this._flags();
    this._injectStyle('mk-overview-demo', `
      .mk-overview-host {
        padding: 16px;
        background: linear-gradient(135deg, #dbeafe, #ede9fe);
        border-radius: 8px;
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
      }
      .mk-overview-box {
        width: 100px;
        height: 100px;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 700;
        font-size: 11px;
      }
      .mk-overview-alpha {
        -webkit-mask: linear-gradient(black, transparent);
                mask: linear-gradient(black, transparent);
      }
      .mk-overview-radial {
        -webkit-mask: radial-gradient(circle, black 50%, transparent 80%);
                mask: radial-gradient(circle, black 50%, transparent 80%);
      }
    `);
    const info = [
      '===== CSS Masking 概述与 mask 基础 =====',
      '',
      '【规范：CSS Masking Module Level 1】',
      '  W3C 规范：https://drafts.fxtf.org/css-masking-1/',
      '  两类能力：',
      '    1. mask / mask-image —— 像素级遮罩（用图像的 alpha/luminance 控制可见性）',
      '    2. clip-path —— 矢量级剪切（用几何路径硬切边）',
      '',
      '【mask 简写语法】',
      '  mask: <mask-layer>#',
      '  /* <mask-layer> = <mask-position> [/<mask-size>]? <mask-repeat>?',
      '                   <mask-origin> <mask-clip> <mask-composite> <mask-mode> <mask-image> */',
      '  mask: linear-gradient(black, transparent);                  // 单层',
      '  mask: url(mask.png), linear-gradient(black, transparent);   // 多层逗号分隔',
      '  mask: none;                                                 // 无遮罩',
      '',
      '【mask-image 取值】',
      '  mask-image: none;                                          // 默认，无遮罩',
      '  mask-image: url(mask.png);                                 // 图像源',
      '  mask-image: linear-gradient(black, transparent);           // 渐变',
      '  mask-image: radial-gradient(circle, black 50%, transparent 70%);',
      '  mask-image: image-set(url(mask.png) 1x, url(mask@2x.png) 2x);  // 响应式',
      '  mask-image: url(#svgMask);                                 // SVG mask 元素引用',
      '  mask-image: url(mask.png), linear-gradient(black, transparent);  // 多遮罩叠加',
      '',
      '【alpha 通道决定可见性（默认 mask-mode: match-source → 多数为 alpha）】',
      '  - alpha = 1（不透明）→ 该像素完全可见',
      '  - alpha = 0（透明）→ 该像素完全不可见',
      '  - 0 < alpha < 1 → 该像素半透明（羽化效果）',
      '  - 渐变黑白：黑色 alpha=1（可见），透明 alpha=0（不可见）',
      '  - 注意：alpha 通道的颜色不重要，只看 alpha 值',
      '',
      '【luminance 模式：亮度决定可见性】',
      '  mask-mode: luminance;',
      '  - 白色（亮度高）→ 完全可见',
      '  - 黑色（亮度低）→ 完全不可见',
      '  - 灰色 → 半透明',
      '  - 适用于彩色 SVG 遮罩（无 alpha 通道时）',
      '',
      '【mask vs clip-path 区别】',
      '  mask（像素级遮罩）：',
      '    + 用图像 alpha/luminance 控制可见性',
      '    + 支持渐变实现羽化边缘（柔和过渡）',
      '    + 支持任意形状（包括位图）',
      '    + 多层叠加合成',
      '    - 性能略低（需解码遮罩图像）',
      '    - 浏览器兼容性需注意（Safari 需 -webkit-）',
      '  clip-path（矢量级剪切）：',
      '    + 用几何路径硬切边',
      '    + 性能更好（GPU 友好）',
      '    + 形状定义清晰（path/polygon/circle）',
      '    - 不支持羽化边缘（硬切边）',
      '    - 不支持多层叠加',
      '',
      '  决策：羽化用 mask，硬切用 clip-path',
      '',
      '【-webkit-mask-* 前缀历史与现状】',
      '  - 早期 WebKit/Blink 实现使用 -webkit- 前缀（2012 起）',
      '  - Chrome 120+（2023-12）开始支持标准无前缀 mask/mask-image/mask-mode',
      '  - Safari 至今（17/18）仍需 -webkit- 前缀',
      '  - Firefox 早支持标准无前缀',
      '  - 实战：双写 -webkit-mask 和 mask 保证兼容',
      '',
      '  /* 兼容性写法 */',
      '  .feather {',
      '    -webkit-mask: linear-gradient(black, transparent);',
      '            mask: linear-gradient(black, transparent);',
      '  }',
      '',
      '【浏览器支持矩阵】',
      '  - Chrome 120+：标准无前缀 mask 全套（mask/mask-image/mask-mode/mask-composite）',
      '  - Safari 4+：仅 -webkit-mask-* 前缀（至今未支持标准无前缀）',
      '  - Firefox 53+：标准无前缀 mask 全套',
      '  - Edge 79+（Chromium）：同 Chrome',
      '  - mask-border：Chrome 部分支持（仅 source/slice/width），Firefox 实验性，Safari 不支持',
      '',
      '【浏览器支持】',
      `  mask: ${f.mask ? '✓' : '✗'} (Chrome 120+ 标准无前缀)`,
      `  mask-image: ${f.maskImage ? '✓' : '✗'}`,
      `  -webkit-mask: 历史前缀 Safari 仍需`,
      '',
      '【常见陷阱】',
      '  1. mask 不影响布局，元素仍占原空间（与 visibility 类似）',
      '  2. mask 区域外的内容不可见但仍可被点击（除非 pointer-events: none）',
      '  3. mask-image 性能开销：大图解码耗时，建议用渐变或小图',
      '  4. mask-mode 选择对 SVG 影响大：alpha 通道缺失时用 luminance',
      '  5. Safari 必须加 -webkit- 前缀（至今未支持标准无前缀）',
      '  6. mask 与 clip-path 可同时使用，但 mask 会先应用',
    ].join('\n');
    this.setState({ overviewInfo: info });
    this._addLog('css', `mask 基础演示完成；supports=${f.mask}/${f.maskImage}`);
  }

  _renderCard1(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. CSS Masking 概述与 mask 基础',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['mask', f.mask],
          ['mask-image', f.maskImage],
        ]),
        h(Tag, { color: 'primary' }, 'Masking L1'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'mask: <mask-layer># 简写遮罩属性。mask-image: none|<image>|<image-set> 指定遮罩图像，alpha 通道决定可见性（黑色不透明可见/透明不可见）。与 clip-path 区别：mask 用 alpha/luminance 渐变切边可羽化，clip-path 硬切边。-webkit-mask-* 前缀历史：Chrome 120+ 标准无前缀，Safari 仍需 -webkit-，Firefox 早支持无前缀。实战双写保证兼容。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 mask 基础演示', { type: 'primary', size: 'sm', onClick: () => this._runOverviewDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, `.feather {
  -webkit-mask: linear-gradient(black, transparent);
          mask: linear-gradient(black, transparent);
}

.radial-mask {
  -webkit-mask: radial-gradient(circle, black 50%, transparent 80%);
          mask: radial-gradient(circle, black 50%, transparent 80%);
}

/* 多层遮罩 */
.multi-mask {
  -webkit-mask:
    linear-gradient(black, transparent),
    linear-gradient(transparent, black);
          mask:
    linear-gradient(black, transparent),
    linear-gradient(transparent, black);
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '可视化演示（线性 + 径向遮罩）：'),
        h('div', { class: 'mk-overview-host' },
          h('div', { class: 'mk-overview-box' }, '原图'),
          h('div', { class: 'mk-overview-box mk-overview-alpha' }, '线性遮罩'),
          h('div', { class: 'mk-overview-box mk-overview-radial' }, '径向遮罩'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.overviewInfo || '（点击按钮查看 mask 基础完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 2：mask-image 与多遮罩叠加 =====================

  _runMaskImageDemo(): void {
    const f = this._flags();
    this._injectStyle('mk-mask-image-demo', `
      .mk-mi-host {
        padding: 16px;
        background: linear-gradient(135deg, #fef3c7, #fce7f3);
        border-radius: 8px;
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
      }
      .mk-mi-box {
        width: 100px;
        height: 100px;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 700;
        font-size: 11px;
      }
      .mk-mi-linear {
        -webkit-mask: linear-gradient(135deg, black 30%, transparent 70%);
                mask: linear-gradient(135deg, black 30%, transparent 70%);
      }
      .mk-mi-radial {
        -webkit-mask: radial-gradient(circle at 30% 30%, black 30%, transparent 60%);
                mask: radial-gradient(circle at 30% 30%, black 30%, transparent 60%);
      }
      .mk-mi-multi {
        -webkit-mask:
          radial-gradient(circle at 30% 50%, black 25%, transparent 25%),
          radial-gradient(circle at 70% 50%, black 25%, transparent 25%),
          linear-gradient(black, black);
        -webkit-mask-composite: source-over;
                mask:
          radial-gradient(circle at 30% 50%, black 25%, transparent 25%),
          radial-gradient(circle at 70% 50%, black 25%, transparent 25%),
          linear-gradient(black, black);
                mask-composite: subtract;
      }
      .mk-mi-svg {
        -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><polygon points="50,10 90,90 10,90" fill="black"/></svg>') no-repeat center / contain;
                mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><polygon points="50,10 90,90 10,90" fill="black"/></svg>') no-repeat center / contain;
      }
    `);
    const info = [
      '===== mask-image 与多遮罩叠加 =====',
      '',
      '【mask-image 取值类型】',
      '  mask-image: none;                              // 默认无遮罩',
      '  mask-image: url(mask.png);                     // 位图遮罩',
      '  mask-image: url(#svgMask);                     // SVG mask 元素引用',
      '  mask-image: linear-gradient(black, transparent);       // 线性渐变',
      '  mask-image: radial-gradient(circle, black, transparent); // 径向渐变',
      '  mask-image: conic-gradient(black, transparent, black);  // 锥形渐变',
      '  mask-image: image-set(url(mask.png) 1x, url(mask@2x.png) 2x);  // 响应式',
      '',
      '【image-set() 响应式遮罩】',
      '  mask-image: image-set(',
      '    url(mask.png) 1x,',
      '    url(mask@2x.png) 2x,',
      '    url(mask@3x.png) 3x',
      '  );',
      '  // 浏览器按设备像素比选择最合适的图像',
      '',
      '【多重遮罩叠加：逗号分隔（先写的在上层）】',
      '  mask-image:',
      '    radial-gradient(circle at 30% 50%, black 25%, transparent 25%),',
      '    radial-gradient(circle at 70% 50%, black 25%, transparent 25%),',
      '    linear-gradient(black, black);',
      '  /* 第一个 mask 在最上层，最后一个在最下层 */',
      '  /* 配合 mask-composite 控制合成方式 */',
      '',
      '【与 background-image 同构 API】',
      '  mask-image       ↔ background-image',
      '  mask-position    ↔ background-position',
      '  mask-size        ↔ background-size',
      '  mask-repeat      ↔ background-repeat',
      '  mask-origin      ↔ background-origin',
      '  mask-clip        ↔ background-clip',
      '  mask-attachment  ↔ background-attachment',
      '  mask-composite   ↔ background-blend-mode（语义不同）',
      '',
      '  /* 凡是 background-* 支持的图像类型，mask-* 都支持 */',
      '  /* 包括多图层逗号分隔、渐变、image-set()、url() 等 */',
      '',
      '【mask 配合渐变实现羽化边缘】',
      '  .feather-edge {',
      '    -webkit-mask: radial-gradient(ellipse at center, black 50%, transparent 80%);',
      '            mask: radial-gradient(ellipse at center, black 50%, transparent 80%);',
      '  }',
      '  /* 50%-80% 之间是 alpha 渐变区域，形成柔和羽化 */',
      '  /* clip-path 做不到这种羽化效果 */',
      '',
      '【SVG mask 元素引用：mask-image: url(#svgMask)】',
      '  <!-- HTML 内联 SVG -->',
      '  <svg width="0" height="0">',
      '    <defs>',
      '      <mask id="svgMask">',
      '        <circle cx="50" cy="50" r="40" fill="white"/>',
      '      </mask>',
      '    </defs>',
      '  </svg>',
      '',
      '  /* CSS 引用 SVG mask */',
      '  .masked {',
      '    mask-image: url(#svgMask);',
      '    /* 仅 Chrome/Firefox 支持，Safari 需 -webkit- */',
      '  }',
      '',
      '【mask-image vs mask-border-source 区别】',
      '  mask-image：',
      '    + 整张图像作为遮罩（不切片）',
      '    + 支持多层叠加',
      '    + 支持渐变/image-set()/SVG mask 元素',
      '    + 浏览器支持好（Chrome 120+ 无前缀）',
      '  mask-border-source：',
      '    + 九宫格切片遮罩（类似 border-image）',
      '    + 仅单层（无叠加）',
      '    + 配合 mask-border-slice/width/repeat',
      '    + 浏览器支持有限（Chrome 部分支持，Firefox 实验性）',
      '',
      '【实战：用 SVG path 做复杂遮罩】',
      '  .heart {',
      "    -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><path d=\"M50,80 C20,50 0,30 30,15 C45,5 50,20 50,25 C50,20 55,5 70,15 C100,30 80,50 50,80 Z\" fill=\"black\"/></svg>') no-repeat center / contain;",
      "            mask: url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><path d=\"M50,80 C20,50 0,30 30,15 C45,5 50,20 50,25 C50,20 55,5 70,15 C100,30 80,50 50,80 Z\" fill=\"black\"/></svg>') no-repeat center / contain;",
      '  }',
      '',
      '【浏览器支持】',
      `  mask-image: ${f.maskImage ? '✓' : '✗'} (Chrome 120+ 标准无前缀)`,
      '  image-set(): 现代浏览器普遍支持',
      '  SVG mask 元素引用 url(#id): Chrome/Firefox 支持，Safari 需 -webkit-',
      '',
      '【常见陷阱】',
      '  1. 多层 mask 叠加顺序：先写的在上层（与 background-image 相反直觉）',
      '  2. SVG mask 引用要求 mask 元素在同一文档内（跨文档支持有限）',
      '  3. mask-image: url() 加载失败时元素完全不可见（无声失败）',
      '  4. image-set() 中的图像分辨率差异可能造成视觉跳变',
      '  5. 渐变 mask 的硬停（hard stop）会有锯齿，需配合 % 缓冲区',
    ].join('\n');
    this.setState({ maskImageInfo: info });
    this._addLog('css', `mask-image 演示完成；supports=${f.maskImage}`);
  }

  _renderCard2(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. mask-image 与多遮罩叠加',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['mask-image', f.maskImage]]),
        h(Tag, { color: 'primary' }, '多遮罩'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'mask-image: url(mask.png)/linear-gradient()/radial-gradient()/image-set() 指定遮罩图像。多重遮罩叠加逗号分隔（先写的在上层），与 background-image 同构 API。mask 配合渐变实现羽化边缘。SVG mask 元素引用 mask-image: url(#svgMask)。mask-image（整张遮罩）vs mask-border-source（九宫格切片遮罩）区别。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 mask-image 演示', { type: 'primary', size: 'sm', onClick: () => this._runMaskImageDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, `/* 多层遮罩叠加（先写的在上层） */
.multi {
  -webkit-mask:
    radial-gradient(circle at 30% 50%, black 25%, transparent 25%),
    radial-gradient(circle at 70% 50%, black 25%, transparent 25%),
    linear-gradient(black, black);
          mask:
    radial-gradient(circle at 30% 50%, black 25%, transparent 25%),
    radial-gradient(circle at 70% 50%, black 25%, transparent 25%),
    linear-gradient(black, black);
}

/* SVG mask 元素引用 */
.svg-ref {
  -webkit-mask: url(#svgMask);
          mask: url(#svgMask);
}

/* image-set() 响应式 */
.retina {
  -webkit-mask: image-set(url(mask.png) 1x, url(mask@2x.png) 2x);
          mask: image-set(url(mask.png) 1x, url(mask@2x.png) 2x);
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '可视化演示（线性/径向/多层/SVG）：'),
        h('div', { class: 'mk-mi-host' },
          h('div', { class: 'mk-mi-box mk-mi-linear' }, '线性'),
          h('div', { class: 'mk-mi-box mk-mi-radial' }, '径向'),
          h('div', { class: 'mk-mi-box mk-mi-multi' }, '多层'),
          h('div', { class: 'mk-mi-box mk-mi-svg' }, 'SVG'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.maskImageInfo || '（点击按钮查看 mask-image 多遮罩完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 3：mask-mode 与 mask-type =====================

  _runMaskModeDemo(): void {
    const f = this._flags();
    this._injectStyle('mk-mask-mode-demo', `
      .mk-mm-host {
        padding: 16px;
        background: linear-gradient(135deg, #d1fae5, #dbeafe);
        border-radius: 8px;
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
      }
      .mk-mm-box {
        width: 100px;
        height: 100px;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 700;
        font-size: 11px;
      }
      .mk-mm-alpha {
        -webkit-mask: linear-gradient(black, transparent);
        -webkit-mask-mode: alpha;
                mask: linear-gradient(black, transparent);
                mask-mode: alpha;
      }
      .mk-mm-luminance {
        -webkit-mask: linear-gradient(white, black);
        -webkit-mask-mode: luminance;
                mask: linear-gradient(white, black);
                mask-mode: luminance;
      }
    `);
    const info = [
      '===== mask-mode 与 mask-type =====',
      '',
      '【mask-mode：CSS 遮罩模式（用于 CSS mask-image）】',
      '  mask-mode: match-source;   // 默认，根据图像类型自动选择',
      '  mask-mode: alpha;          // 使用图像 alpha 通道',
      '  mask-mode: luminance;      // 使用图像亮度',
      '  mask-mode: match-source, alpha;  // 多层分别指定',
      '',
      '【match-source 默认行为（自动选择）】',
      '  - PNG/WebP 等位图 → alpha 模式',
      '  - SVG mask 元素 → luminance 模式（历史兼容 SVG 1.1 默认）',
      '  - 渐变 → alpha 模式',
      '  - 大多数场景 match-source 都能正确选择，无需显式指定',
      '',
      '【alpha 模式：使用图像 alpha 通道】',
      '  mask-mode: alpha;',
      '  - alpha = 1（不透明）→ 像素完全可见',
      '  - alpha = 0（透明）→ 像素完全不可见',
      '  - 适用于：PNG 透明背景、渐变（黑色不透明）',
      '  - 渐变中颜色不重要，只看 alpha',
      '  - linear-gradient(black, transparent) → alpha 1→0 渐变',
      '',
      '【luminance 模式：使用图像亮度】',
      '  mask-mode: luminance;',
      '  - 白色（亮度高）→ 完全可见',
      '  - 黑色（亮度低）→ 完全不可见',
      '  - 灰色 → 半透明',
      '  - 适用于：彩色 SVG 遮罩（无 alpha 通道或 alpha 全 1）',
      '  - linear-gradient(white, black) → 亮度 1→0 渐变',
      '  - 注意：luminance 模式下颜色重要，与 alpha 模式相反',
      '',
      '【alpha vs luminance 对比】',
      '  alpha 模式：',
      '    mask-image: linear-gradient(black, transparent);',
      '    mask-mode: alpha;  // black.alpha=1 可见，transparent.alpha=0 不可见',
      '    /* 结果：从可见渐变到不可见 */',
      '',
      '  luminance 模式：',
      '    mask-image: linear-gradient(white, black);',
      '    mask-mode: luminance;  // white 亮可见，black 暗不可见',
      '    /* 结果：从可见渐变到不可见 */',
      '  /* 同样视觉效果，但语义不同：alpha 看 alpha 通道，luminance 看颜色亮度 */',
      '',
      '【mask-type：仅用于 SVG <mask> 元素】',
      '  <mask id="m" mask-type="luminance">',
      '    <rect fill="white" .../>',
      '  </mask>',
      '  mask-type: luminance;   // SVG <mask> 元素属性（CSS 也可设）',
      '  mask-type: alpha;       // SVG <mask> 元素属性',
      '  /* mask-type 仅作用于 SVG <mask> 元素本身，不影响 CSS mask-image */',
      '  /* SVG 1.1 默认 mask-type: luminance（maskUnits 默认 objectBoundingBox）*/',
      '',
      '【mask-mode vs mask-type 关键区别】',
      '  mask-mode：',
      '    + 作用于 CSS mask-image（HTML 元素的遮罩）',
      '    + 取值：match-source | alpha | luminance',
      '    + 浏览器：Chrome 120+/Firefox 53+（标准无前缀）',
      '  mask-type：',
      '    + 仅作用于 SVG <mask> 元素（定义 SVG mask 的渲染模式）',
      '    + 取值：luminance | alpha（无 match-source）',
      '    + 浏览器：Chrome/Firefox/Safari 均支持',
      '',
      '【实战：彩色 SVG 遮罩用 luminance】',
      '  <!-- SVG mask 元素（彩色填充无 alpha） -->',
      '  <svg width="0" height="0">',
      '    <defs>',
      '      <mask id="colorMask" mask-type="luminance">',
      '        <rect width="100" height="100" fill="black"/>',
      '        <circle cx="50" cy="50" r="40" fill="white"/>',
      '      </mask>',
      '    </defs>',
      '  </svg>',
      '',
      '  .target {',
      '    mask-image: url(#colorMask);',
      '    mask-mode: luminance;  /* 显式指定（match-source 也能自动判断） */',
      '  }',
      '',
      '【模式选择对视觉效果的影响】',
      '  - 同一张图，alpha 模式与 luminance 模式可能产生完全不同效果',
      '  - 彩色 PNG（如红绿蓝条纹）alpha 全 1 时：',
      '    alpha 模式 → 整张可见',
      '    luminance 模式 → 红绿蓝亮度不同产生条纹遮罩',
      '  - 用错模式可能导致遮罩不生效（图全可见或全不可见）',
      '',
      '【浏览器支持】',
      `  mask-mode: ${f.maskMode ? '✓' : '✗'} (Chrome 120+ 标准无前缀)`,
      `  mask-type: ${f.maskType ? '✓' : '✗'} (Chrome/Firefox/Safari 支持 SVG mask 元素)`,
      '  - Safari 至今不支持 CSS mask-mode（仅 -webkit-mask-* 有限支持）',
      '',
      '【常见陷阱】',
      '  1. mask-mode 仅作用于 CSS mask-image，不影响 SVG <mask> 元素',
      '  2. mask-type 仅作用于 SVG <mask> 元素，不影响 CSS mask-image',
      '  3. match-source 对某些图像类型判断可能不符合预期，建议显式指定',
      '  4. luminance 模式下颜色重要：白色可见、黑色不可见（与 alpha 模式相反）',
      '  5. Safari 不支持 mask-mode，需用 SVG <mask> mask-type 代替',
      '  6. 多层 mask 可分别指定 mask-mode 逗号分隔',
    ].join('\n');
    this.setState({ maskModeInfo: info });
    this._addLog('css', `mask-mode 演示完成；supports=${f.maskMode}/${f.maskType}`);
  }

  _renderCard3(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. mask-mode 与 mask-type（遮罩模式选择）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['mask-mode', f.maskMode],
          ['mask-type', f.maskType],
        ]),
        h(Tag, { color: 'primary' }, '模式'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'mask-mode: match-source|alpha|luminance 三种模式。match-source 默认根据图像类型自动选择（PNG 用 alpha、SVG 用 luminance）。alpha 模式使用图像 alpha 通道，luminance 模式使用图像亮度（白色不透明黑色透明）。mask-type 仅用于 SVG <mask> 元素 mask-type: luminance|alpha（无 match-source）。实战：彩色 SVG 遮罩用 luminance。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 mask-mode 演示', { type: 'primary', size: 'sm', onClick: () => this._runMaskModeDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, `/* alpha 模式：使用图像 alpha 通道 */
.alpha-mask {
  -webkit-mask: linear-gradient(black, transparent);
  -webkit-mask-mode: alpha;
          mask: linear-gradient(black, transparent);
          mask-mode: alpha;
}

/* luminance 模式：使用图像亮度 */
.lum-mask {
  -webkit-mask: linear-gradient(white, black);
  -webkit-mask-mode: luminance;
          mask: linear-gradient(white, black);
          mask-mode: luminance;
}

/* SVG <mask> 元素的 mask-type */
<mask id="m" mask-type="luminance">
  <rect fill="white" .../>
</mask>`)),
        h('div', { class: 'fs-sm text-secondary' }, '可视化演示（alpha vs luminance）：'),
        h('div', { class: 'mk-mm-host' },
          h('div', { class: 'mk-mm-box' }, '原图'),
          h('div', { class: 'mk-mm-box mk-mm-alpha' }, 'alpha'),
          h('div', { class: 'mk-mm-box mk-mm-luminance' }, 'luminance'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.maskModeInfo || '（点击按钮查看 mask-mode 与 mask-type 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 4：mask-repeat/position/size/origin/clip =====================

  _runMaskBoxPropsDemo(): void {
    const f = this._flags();
    this._injectStyle('mk-mask-box-demo', `
      .mk-mb-host {
        padding: 16px;
        background: #f1f5f9;
        border-radius: 8px;
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
      }
      .mk-mb-box {
        width: 120px;
        height: 80px;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        border: 4px solid #1e40af;
        padding: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 700;
        font-size: 11px;
      }
      .mk-mb-repeat {
        -webkit-mask: radial-gradient(circle, black 10px, transparent 11px);
                mask: radial-gradient(circle, black 10px, transparent 11px);
        -webkit-mask-size: 30px 30px;
                mask-size: 30px 30px;
      }
      .mk-mb-no-repeat {
        -webkit-mask: radial-gradient(circle, black 30px, transparent 31px);
                mask: radial-gradient(circle, black 30px, transparent 31px);
        -webkit-mask-repeat: no-repeat;
                mask-repeat: no-repeat;
        -webkit-mask-position: center;
                mask-position: center;
      }
      .mk-mb-cover {
        -webkit-mask: radial-gradient(circle, black 30%, transparent 70%);
                mask: radial-gradient(circle, black 30%, transparent 70%);
        -webkit-mask-size: cover;
                mask-size: cover;
      }
      .mk-mb-position {
        -webkit-mask: radial-gradient(circle, black 20px, transparent 21px);
                mask: radial-gradient(circle, black 20px, transparent 21px);
        -webkit-mask-repeat: no-repeat;
                mask-repeat: no-repeat;
        -webkit-mask-position: 20% 50%;
                mask-position: 20% 50%;
      }
    `);
    const info = [
      '===== mask-repeat / mask-position / mask-size / mask-origin / mask-clip =====',
      '',
      '【与 background-* 完全同构的 API】',
      '  mask-repeat     ↔ background-repeat',
      '  mask-position   ↔ background-position',
      '  mask-size       ↔ background-size',
      '  mask-origin     ↔ background-origin',
      '  mask-clip       ↔ background-clip',
      '  mask-attachment ↔ background-attachment',
      '  /* 凡是 background-* 支持的取值，mask-* 都支持 */',
      '',
      '【mask-repeat：遮罩重复方式】',
      '  mask-repeat: repeat;       // 默认，x+y 方向都重复',
      '  mask-repeat: no-repeat;    // 不重复',
      '  mask-repeat: repeat-x;     // 仅 x 方向重复',
      '  mask-repeat: repeat-y;     // 仅 y 方向重复',
      '  mask-repeat: space;        // 重复且均匀分布（不留半图）',
      '  mask-repeat: round;        // 重复并缩放以完整填充',
      '  mask-repeat: repeat no-repeat;  // 双值：x 方向 repeat，y 方向 no-repeat',
      '',
      '【mask-position：遮罩位置】',
      '  mask-position: center;          // 默认，居中',
      '  mask-position: top left;        // 左上角',
      '  mask-position: 50% 50%;         // 百分比',
      '  mask-position: 20px 30px;       // 绝对长度',
      '  mask-position: right 20px bottom 10px;  // 关键字 + 偏移',
      '  mask-position: 25% 75%;         // x=25%, y=75%',
      '',
      '【mask-size：遮罩尺寸】',
      '  mask-size: auto;           // 默认，原图大小',
      '  mask-size: 100px 80px;     // 绝对尺寸（宽 高）',
      '  mask-size: 50% 100%;       // 相对容器尺寸',
      '  mask-size: cover;          // 等比缩放覆盖容器（可能裁剪）',
      '  mask-size: contain;        // 等比缩放完整显示（可能留白）',
      '  mask-size: 200% auto;      // 宽 200%，高自适应',
      '',
      '【mask-origin：遮罩定位参考框】',
      '  mask-origin: border-box;     // 默认，相对 border 框',
      '  mask-origin: padding-box;    // 相对 padding 框',
      '  mask-origin: content-box;    // 相对 content 框',
      '  mask-origin: fill-box;       // SVG：相对对象边界框',
      '  mask-origin: stroke-box;     // SVG：相对描边边界框',
      '  mask-origin: view-box;       // SVG：相对 viewBox',
      '  /* mask-origin 决定 mask-position 与 mask-size 的参考系 */',
      '',
      '【mask-clip：遮罩剪切区域】',
      '  mask-clip: border-box;       // 默认，剪切到 border 框',
      '  mask-clip: padding-box;      // 剪切到 padding 框',
      '  mask-clip: content-box;      // 剪切到 content 框',
      '  mask-clip: fill-box;         // SVG：剪切到对象边界框',
      '  mask-clip: stroke-box;       // SVG：剪切到描边边界框',
      '  mask-clip: view-box;         // SVG：剪切到 viewBox',
      '  mask-clip: no-clip;          // 不剪切（遮罩可溢出）',
      '  /* mask-clip 决定遮罩在哪个范围内有效 */',
      '',
      '【mask-origin vs mask-clip 区别】',
      '  mask-origin：决定 mask-position/mask-size 的参考框（"画布起点"）',
      '  mask-clip：决定遮罩的剪切区域（"画布边界"）',
      '  /* 两者通常相同，但可分别指定实现特殊效果 */',
      '',
      '  .demo {',
      '    mask-origin: padding-box;   // 遮罩从 padding 框开始定位',
      '    mask-clip: border-box;      // 但可剪切到 border 框（含边框）',
      '  }',
      '',
      '【mask 简写顺序与 background 一致】',
      '  mask: <mask-image> <mask-position> / <mask-size> <mask-repeat> <mask-origin> <mask-clip> <mask-composite> <mask-mode>;',
      '  /* 类似 background 简写 */',
      '  mask: url(mask.png) no-repeat center / cover;',
      '  mask: linear-gradient(black, transparent) repeat center / 100% 100%;',
      '',
      '【多层 mask 各属性可分别指定（逗号分隔）】',
      '  mask-image:',
      '    radial-gradient(circle, black 30%, transparent 70%),',
      '    linear-gradient(black, transparent);',
      '  mask-repeat: no-repeat, no-repeat;',
      '  mask-position: 20% 50%, center;',
      '  mask-size: 50% 50%, 100% 100%;',
      '  /* 每层 mask 对应一组属性值，逗号分隔 */',
      '',
      '【mask-attachment：遮罩滚动方式（支持有限）】',
      '  mask-attachment: scroll;     // 默认，随元素滚动',
      '  mask-attachment: fixed;      // 固定在视口',
      '  /* 类似 background-attachment，浏览器支持有限 */',
      '',
      '【实战：网格点状遮罩（mask-repeat + mask-size）】',
      '  .dotted {',
      '    -webkit-mask: radial-gradient(circle, black 5px, transparent 6px);',
      '            mask: radial-gradient(circle, black 5px, transparent 6px);',
      '    -webkit-mask-size: 20px 20px;',
      '            mask-size: 20px 20px;',
      '    /* 自动重复形成网格点状遮罩 */',
      '  }',
      '',
      '【浏览器支持】',
      `  mask-repeat/position/size/origin/clip: ${f.mask ? '✓' : '✗'} (Chrome 120+ 无前缀)`,
      '  fill-box/stroke-box/view-box: SVG 上下文中支持',
      '  no-clip: 浏览器支持有限',
      '',
      '【常见陷阱】',
      '  1. mask-origin 默认 border-box（与 background-origin 默认 padding-box 不同）',
      '  2. mask-clip 默认 border-box（与 background-clip 默认 border-box 相同）',
      '  3. mask-size 单值时是宽度，高度自适应（与 background-size 一致）',
      '  4. mask-position 双值时第一个是 x，第二个是 y（与 background-position 一致）',
      '  5. 简写中 mask-size 必须跟在 mask-position 后面用 / 分隔',
      '  6. 多层 mask 属性值数量不匹配时，浏览器会循环复用',
    ].join('\n');
    this.setState({ maskBoxPropsInfo: info });
    this._addLog('css', `mask 盒模型属性演示完成；supports=${f.mask}`);
  }

  _renderCard4(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. mask-repeat / position / size / origin / clip（与 background-* 同构）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['mask', f.mask]]),
        h(Tag, { color: 'primary' }, '同构 API'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '与 background-* 完全同构的 API：mask-repeat: repeat|no-repeat|repeat-x|repeat-y|space|round；mask-position: <position>（中心/角/百分比）；mask-size: auto|<length>|<percentage>|cover|contain；mask-origin: border-box|padding-box|content-box|fill-box|stroke-box|view-box；mask-clip 同 mask-origin 但影响剪切区域。mask 简写顺序与 background 一致。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 mask 盒模型演示', { type: 'primary', size: 'sm', onClick: () => this._runMaskBoxPropsDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, `/* 重复网格遮罩 */
.grid-mask {
  -webkit-mask: radial-gradient(circle, black 5px, transparent 6px);
          mask: radial-gradient(circle, black 5px, transparent 6px);
  -webkit-mask-size: 20px 20px;
          mask-size: 20px 20px;
}

/* 单个居中遮罩 */
.center-mask {
  -webkit-mask: radial-gradient(circle, black 30%, transparent 70%);
          mask: radial-gradient(circle, black 30%, transparent 70%);
  -webkit-mask-repeat: no-repeat;
          mask-repeat: no-repeat;
  -webkit-mask-position: center;
          mask-position: center;
  -webkit-mask-size: cover;
          mask-size: cover;
}

/* 简写：image position/size repeat origin clip */
.shorthand {
  mask: url(mask.png) center / cover no-repeat border-box;
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '可视化演示（repeat/no-repeat/cover/position）：'),
        h('div', { class: 'mk-mb-host' },
          h('div', { class: 'mk-mb-box mk-mb-repeat' }, 'repeat'),
          h('div', { class: 'mk-mb-box mk-mb-no-repeat' }, 'no-repeat'),
          h('div', { class: 'mk-mb-box mk-mb-cover' }, 'cover'),
          h('div', { class: 'mk-mb-box mk-mb-position' }, 'position'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.maskBoxPropsInfo || '（点击按钮查看 mask 盒模型属性完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 5：mask-composite 与合成运算 =====================

  _runMaskCompositeDemo(): void {
    const f = this._flags();
    this._injectStyle('mk-mask-composite-demo', `
      .mk-mc-host {
        padding: 16px;
        background: linear-gradient(135deg, #fce7f3, #dbeafe);
        border-radius: 8px;
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
      }
      .mk-mc-box {
        width: 100px;
        height: 100px;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 700;
        font-size: 11px;
      }
      .mk-mc-add {
        -webkit-mask:
          radial-gradient(circle at 30% 50%, black 30%, transparent 30%),
          radial-gradient(circle at 70% 50%, black 30%, transparent 30%);
        -webkit-mask-composite: source-over;
                mask:
          radial-gradient(circle at 30% 50%, black 30%, transparent 30%),
          radial-gradient(circle at 70% 50%, black 30%, transparent 30%);
                mask-composite: add;
      }
      .mk-mc-subtract {
        -webkit-mask:
          radial-gradient(circle at 70% 50%, black 30%, transparent 30%),
          radial-gradient(circle at 30% 50%, black 30%, transparent 30%);
        -webkit-mask-composite: source-out;
                mask:
          radial-gradient(circle at 50% 50%, black 45%, transparent 45%),
          radial-gradient(circle at 50% 50%, black 25%, transparent 25%);
                mask-composite: subtract;
      }
      .mk-mc-intersect {
        -webkit-mask:
          radial-gradient(circle at 35% 50%, black 35%, transparent 35%),
          radial-gradient(circle at 65% 50%, black 35%, transparent 35%);
        -webkit-mask-composite: source-in;
                mask:
          radial-gradient(circle at 35% 50%, black 35%, transparent 35%),
          radial-gradient(circle at 65% 50%, black 35%, transparent 35%);
                mask-composite: intersect;
      }
      .mk-mc-exclude {
        -webkit-mask:
          radial-gradient(circle at 35% 50%, black 35%, transparent 35%),
          radial-gradient(circle at 65% 50%, black 35%, transparent 35%);
        -webkit-mask-composite: xor;
                mask:
          radial-gradient(circle at 35% 50%, black 35%, transparent 35%),
          radial-gradient(circle at 65% 50%, black 35%, transparent 35%);
                mask-composite: exclude;
      }
    `);
    const info = [
      '===== mask-composite 与合成运算 =====',
      '',
      '【mask-composite 取值（标准）】',
      '  mask-composite: add;         // 默认，新旧遮罩并集',
      '  mask-composite: subtract;    // 旧遮罩减新遮罩',
      '  mask-composite: intersect;   // 新旧遮罩交集',
      '  mask-composite: exclude;     // 对称差（异或）',
      '',
      '【-webkit-mask-composite 取值（旧 WebKit 语法）】',
      '  -webkit-mask-composite: source-over;    // = add',
      '  -webkit-mask-composite: source-out;     // = subtract',
      '  -webkit-mask-composite: source-in;      // = intersect',
      '  -webkit-mask-composite: xor;            // = exclude',
      '  /* Safari 仅支持 -webkit-mask-composite 旧语法 */',
      '  /* Chrome/Firefox 支持标准 mask-composite */',
      '',
      '【四种合成运算详解】',
      '  假设有两层遮罩 A（下层）和 B（上层）：',
      '',
      '  add（并集 A∪B）：',
      '    - A 或 B 任一可见的区域都可见',
      '    - 视觉：两个圆叠加，叠加重叠区也可见',
      '',
      '  subtract（差集 A-B）：',
      '    - A 可见但 B 不可见的区域可见',
      '    - B 像在 A 上"挖洞"',
      '    - 视觉：A 减去 B 的部分',
      '',
      '  intersect（交集 A∩B）：',
      '    - A 和 B 都可见的区域才可见',
      '    - 视觉：仅两圆重叠部分',
      '',
      '  exclude（对称差 A⊕B）：',
      '    - A 或 B 可见但不能同时可见的区域',
      '    - 视觉：两圆去掉重叠部分',
      '',
      '【多层 mask 的合成顺序：从下往上】',
      '  mask-image:',
      '    layer1,   // 最下层',
      '    layer2,   // 上层，与 layer1 合成',
      '    layer3;   // 最上层，与 (layer1 op layer2) 合成',
      '  mask-composite:',
      '    add,      // layer1 默认 add',
      '    subtract, // layer2 与 layer1 用 subtract',
      '    intersect;// layer3 与之前结果用 intersect',
      '  /* 第一个 mask-composite 值通常无意义（无前层可合成） */',
      '  /* 实际从第二个开始生效 */',
      '',
      '【与 SVG mask-mode / mask-type 配合】',
      '  SVG <mask> 元素内部合成：',
      '    <mask id="m">',
      '      <rect fill="white" .../>           <!-- 整体可见 -->',
      '      <circle fill="black" .../>          <!-- 挖洞 -->',
      '    </mask>',
      '    <!-- SVG mask 元素内部默认 luminance 模式 -->',
      '    <!-- 白色可见、黑色不可见，相当于 subtract 效果 -->',
      '',
      '  CSS mask-composite 多层：',
      '    mask-image:',
      '      radial-gradient(circle, black 40%, transparent 40%),  /* 大圆 */',
      '      radial-gradient(circle, black 20%, transparent 20%);  /* 小圆 */',
      '    mask-composite: add, subtract;  /* 小圆从大圆中挖洞 */',
      '',
      '【实战：复杂遮罩叠加效果】',
      '  /* 圆形 + 矩形交集 */',
      '  .intersect-shape {',
      '    -webkit-mask:',
      '      radial-gradient(circle, black 40%, transparent 40%),',
      '      linear-gradient(black, black);',
      '    -webkit-mask-composite: source-in;',
      '            mask:',
      '      radial-gradient(circle, black 40%, transparent 40%),',
      '      linear-gradient(black, black);',
      '            mask-composite: intersect;',
      '  }',
      '',
      '  /* 十字形异或（两个矩形叠加形成十字） */',
      '  .cross-shape {',
      '    -webkit-mask:',
      '      linear-gradient(black, black) 0 50% / 100% 20% no-repeat,',
      '      linear-gradient(black, black) 50% 0 / 20% 100% no-repeat;',
      '    -webkit-mask-composite: source-over;',
      '            mask:',
      '      linear-gradient(black, black) 0 50% / 100% 20% no-repeat,',
      '      linear-gradient(black, black) 50% 0 / 20% 100% no-repeat;',
      '            mask-composite: add;',
      '    /* 用 add 合成两个矩形形成十字形 */',
      '  }',
      '',
      '  /* 圆环（大圆减中圆） */',
      '  .ring {',
      '    -webkit-mask:',
      '      radial-gradient(circle, black 40%, transparent 40%),',
      '      radial-gradient(circle, black 20%, transparent 20%);',
      '    -webkit-mask-composite: source-out;',
      '            mask:',
      '      radial-gradient(circle, black 40%, transparent 40%),',
      '      radial-gradient(circle, black 20%, transparent 20%);',
      '            mask-composite: subtract;',
      '  }',
      '',
      '【mask-composite vs background-blend-mode 区别】',
      '  mask-composite：',
      '    + 作用于多层遮罩之间的合成',
      '    + 控制元素内容的可见区域',
      '    + 取值：add/subtract/intersect/exclude',
      '    + 结果影响元素 alpha',
      '  background-blend-mode：',
      '    + 作用于多层背景图像之间的混合',
      '    + 控制背景图像颜色混合方式',
      '    + 取值：multiply/screen/overlay/...（17 种）',
      '    + 结果影响背景颜色',
      '  /* 两者语义完全不同：mask-composite 是 alpha 合成，background-blend-mode 是颜色混合 */',
      '',
      '【浏览器支持】',
      `  mask-composite: ${f.maskComposite ? '✓' : '✗'} (Chrome 120+/Firefox 53+ 标准无前缀)`,
      '  -webkit-mask-composite: Safari 4+（旧语法 source-over/source-in/source-out/xor）',
      '',
      '【常见陷阱】',
      '  1. Safari 仅支持 -webkit-mask-composite 旧语法（source-over/source-in/source-out/xor）',
      '  2. 第一个 mask-composite 值通常无意义（无前层可合成）',
      '  3. 合成顺序从下往上，需理解层级关系',
      '  4. subtract 是 A 减 B（旧减新），不是 B 减 A',
      '  5. exclude 是对称差（异或），不是简单的"排除"',
      '  6. 多层合成时建议逐层测试，避免一次性复杂合成',
    ].join('\n');
    this.setState({ maskCompositeInfo: info });
    this._addLog('css', `mask-composite 演示完成；supports=${f.maskComposite}`);
  }

  _renderCard5(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. mask-composite 与合成运算（add / subtract / intersect / exclude）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['mask-composite', f.maskComposite]]),
        h(Tag, { color: 'primary' }, '合成'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'mask-composite: add|subtract|intersect|exclude 四种合成运算。add 默认新旧遮罩并集，subtract 旧遮罩减新遮罩，intersect 交集，exclude 对称差（异或）。多层 mask 合成顺序从下往上。与 SVG mask-mode/mask-type 配合。实战：圆环（subtract）、十字形（add）、复杂遮罩叠加。mask-composite（alpha 合成）vs background-blend-mode（颜色混合）区别。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 mask-composite 演示', { type: 'primary', size: 'sm', onClick: () => this._runMaskCompositeDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, `/* 圆环：大圆减中圆 */
.ring {
  -webkit-mask:
    radial-gradient(circle, black 40%, transparent 40%),
    radial-gradient(circle, black 20%, transparent 20%);
  -webkit-mask-composite: source-out;
          mask:
    radial-gradient(circle, black 40%, transparent 40%),
    radial-gradient(circle, black 20%, transparent 20%);
          mask-composite: subtract;
}

/* 十字形：两个矩形 add */
.cross {
  -webkit-mask:
    linear-gradient(black, black) 0 50% / 100% 20% no-repeat,
    linear-gradient(black, black) 50% 0 / 20% 100% no-repeat;
  -webkit-mask-composite: source-over;
          mask-composite: add;
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '可视化演示（add/subtract/intersect/exclude）：'),
        h('div', { class: 'mk-mc-host' },
          h('div', { class: 'mk-mc-box mk-mc-add' }, 'add'),
          h('div', { class: 'mk-mc-box mk-mc-subtract' }, 'subtract'),
          h('div', { class: 'mk-mc-box mk-mc-intersect' }, 'intersect'),
          h('div', { class: 'mk-mc-box mk-mc-exclude' }, 'exclude'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.maskCompositeInfo || '（点击按钮查看 mask-composite 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 6：mask-border 高级遮罩边框 =====================

  _runMaskBorderDemo(): void {
    const f = this._flags();
    this._injectStyle('mk-mask-border-demo', `
      .mk-mbd-host {
        padding: 16px;
        background: #f1f5f9;
        border-radius: 8px;
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
      }
      .mk-mbd-box {
        width: 120px;
        height: 80px;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 700;
        font-size: 11px;
      }
      .mk-mbd-stretch {
        -webkit-mask-box: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect x="0" y="0" width="40" height="40" fill="black"/></svg>') 10 / 10px / 0 stretch;
                mask-border: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect x="0" y="0" width="40" height="40" fill="black"/></svg>') 10 / 10px / 0 stretch;
      }
      .mk-mbd-repeat {
        -webkit-mask-box: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect x="0" y="0" width="40" height="40" fill="black"/></svg>') 10 / 10px / 0 repeat;
                mask-border: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect x="0" y="0" width="40" height="40" fill="black"/></svg>') 10 / 10px / 0 repeat;
      }
    `);
    const info = [
      '===== mask-border 高级遮罩边框 =====',
      '',
      '【mask-border 简写语法】',
      '  mask-border: <source> <slice> <width> <outset> <repeat> <mode>;',
      '  /* 类似 border-image 简写 */',
      '  mask-border: url(mask.png) 25 / 20px / 0 stretch alpha;',
      '',
      '【mask-border 各子属性】',
      '  mask-border-source: url(mask.png);       // 遮罩源图像',
      '  mask-border-slice: 25;                   // 九宫格切片（数值/百分比）',
      '  mask-border-width: 20px;                 // 边框遮罩宽度',
      '  mask-border-outset: 0;                   // 边框遮罩外延',
      '  mask-border-repeat: stretch;             // 重复方式',
      '  mask-border-mode: alpha;                 // 模式：alpha | luminance',
      '',
      '【mask-border-source：遮罩源】',
      '  mask-border-source: url(mask.png);',
      '  mask-border-source: url(border.svg);',
      '  mask-border-source: none;                // 默认，无遮罩',
      '  /* 同 mask-image，支持 url()/渐变/image-set() 等 */',
      '  /* 但通常用位图或 SVG 实现九宫格切片 */',
      '',
      '【mask-border-slice：九宫格切片】',
      '  mask-border-slice: 25;                   // 四边各切 25%（数值）',
      '  mask-border-slice: 25 30 25 30;          // 上右下左分别切',
      '  mask-border-slice: 25% fill;             // 百分比 + fill（填充中心）',
      '  /* 数值单位：像素（默认，不带单位）或百分比 */',
      '  /* fill 关键字：保留中心部分（默认丢弃） */',
      '',
      '  切片示意（25% 切）：',
      '    +----+------+----+',
      '    | TL |  T   | TR |   TL/TR/BL/BR: 四角',
      '    +----+------+----+   T/B/L/R: 四边',
      '    | L  |  C   | R   |   C: 中心（fill 时保留）',
      '    +----+------+----+',
      '    | BL |  B   | BR |',
      '    +----+------+----+',
      '',
      '【mask-border-width：边框遮罩宽度】',
      '  mask-border-width: 20px;                 // 四边相同',
      '  mask-border-width: 20px 30px;            // 垂直/水平',
      '  mask-border-width: 20px 30px 40px 50px;  // 上右下左',
      '  mask-border-width: auto;                 // 默认，等于 slice 值',
      '',
      '【mask-border-outset：边框遮罩外延】',
      '  mask-border-outset: 0;                   // 默认，不外延',
      '  mask-border-outset: 10px;                // 四边外延 10px',
      '  mask-border-outset: 10px 20px;           // 垂直/水平',
      '  /* outset 让遮罩边框超出元素边界 */',
      '',
      '【mask-border-repeat：重复方式】',
      '  mask-border-repeat: stretch;             // 默认，拉伸',
      '  mask-border-repeat: repeat;              // 重复（可能裁剪）',
      '  mask-border-repeat: round;               // 重复并缩放（完整填充）',
      '  mask-border-repeat: space;               // 重复并均匀分布',
      '  mask-border-repeat: stretch repeat;      // 水平 stretch，垂直 repeat',
      '',
      '【mask-border-mode：模式】',
      '  mask-border-mode: alpha;                 // 默认，使用 alpha 通道',
      '  mask-border-mode: luminance;             // 使用亮度',
      '  /* 同 mask-mode，但仅 alpha/luminance 两种 */',
      '',
      '【应用：复杂边框遮罩效果】',
      '  .frame {',
      '    -webkit-mask-border: url(frame.png) 25 / 20px / 0 stretch;',
      '            mask-border: url(frame.png) 25 / 20px / 0 stretch;',
      '  }',
      '  /* 实现「不规则的镂空边框」效果 */',
      '  /* 与 border-image 区别：mask-border 是遮罩（控制可见性），border-image 是边框图像 */',
      '',
      '【与 border-image 完全同构的 API】',
      '  mask-border-source  ↔ border-image-source',
      '  mask-border-slice   ↔ border-image-slice',
      '  mask-border-width   ↔ border-image-width',
      '  mask-border-outset  ↔ border-image-outset',
      '  mask-border-repeat  ↔ border-image-repeat',
      '  /* 唯一区别：mask-border 多了 mask-border-mode（border-image 无此属性） */',
      '',
      '【mask-border vs border-image 区别】',
      '  mask-border：',
      '    + 用图像 alpha/luminance 控制元素可见性',
      '    + 可实现镂空效果（中间透明）',
      '    + 不影响元素布局',
      '    - 浏览器支持有限',
      '  border-image：',
      '    + 用图像作为边框装饰',
      '    + 不影响元素内容可见性',
      '    + 浏览器支持好',
      '    - 只能装饰边框，不能镂空内容',
      '',
      '【浏览器支持（有限）】',
      `  mask-border-source: ${f.maskBorderSource ? '✓' : '✗'}`,
      '  - Chrome：部分支持（仅 source/slice/width/repeat，不支持 outset/mode）',
      '  - Firefox：实验性（about:config 开启）',
      '  - Safari：不支持',
      '  - 实战：建议用 border-image 或 mask-image + 九宫格图代替',
      '',
      '【替代方案：用 mask-image 模拟九宫格】',
      '  /* 用 mask-image + mask-repeat 实现类似效果 */',
      '  .frame-fallback {',
      '    -webkit-mask: url(frame.png) no-repeat;',
      '            mask: url(frame.png) no-repeat;',
      '    -webkit-mask-size: 100% 100%;',
      '            mask-size: 100% 100%;',
      '  }',
      '',
      '【常见陷阱】',
      '  1. mask-border 浏览器支持有限，生产环境慎用',
      '  2. Chrome 仅部分支持（不支持 outset/mode）',
      '  3. Safari 完全不支持 mask-border（需 -webkit-mask-box-image 旧前缀）',
      '  4. mask-border-mode 默认 alpha，与 mask-mode 默认 match-source 不同',
      '  5. mask-border-slice 数值不带单位（默认像素），百分比带 %',
      '  6. mask-border 与 mask-image 同时设置时，mask-border 优先',
    ].join('\n');
    this.setState({ maskBorderInfo: info });
    this._addLog('css', `mask-border 演示完成；supports=${f.maskBorderSource}`);
  }

  _renderCard6(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. mask-border 高级遮罩边框（九宫格切片）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['mask-border-source', f.maskBorderSource]]),
        h(Tag, { color: 'warning' }, '支持有限'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'mask-border: <source> <slice> <width> <outset> <repeat> <mode> 简写。mask-border-source 遮罩源，mask-border-slice 九宫格切片，mask-border-width/outset/repeat 与 border-image 同构，mask-border-mode: alpha|luminance。应用：复杂边框遮罩效果。浏览器支持有限（Chrome 部分支持、Firefox 实验性、Safari 不支持）。与 border-image 区别：mask-border 是遮罩（控制可见性），border-image 是边框装饰。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 mask-border 演示', { type: 'primary', size: 'sm', onClick: () => this._runMaskBorderDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, `/* 完整简写 */
.frame {
  -webkit-mask-border: url(frame.png) 25 / 20px / 0 stretch alpha;
          mask-border: url(frame.png) 25 / 20px / 0 stretch alpha;
}

/* 分属性写 */
.frame-detail {
  -webkit-mask-border-source: url(frame.png);
          mask-border-source: url(frame.png);
  -webkit-mask-border-slice: 25 fill;
          mask-border-slice: 25 fill;
  -webkit-mask-border-width: 20px;
          mask-border-width: 20px;
  -webkit-mask-border-repeat: round;
          mask-border-repeat: round;
  -webkit-mask-border-mode: alpha;
          mask-border-mode: alpha;
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '可视化演示（stretch vs repeat）：'),
        h('div', { class: 'mk-mbd-host' },
          h('div', { class: 'mk-mbd-box mk-mbd-stretch' }, 'stretch'),
          h('div', { class: 'mk-mbd-box mk-mbd-repeat' }, 'repeat'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.maskBorderInfo || '（点击按钮查看 mask-border 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 7：SVG mask 元素与 url() 引用 =====================

  _runSvgMaskDemo(): void {
    const f = this._flags();
    this._injectStyle('mk-svg-mask-demo', `
      .mk-sm-host {
        padding: 16px;
        background: linear-gradient(135deg, #fef3c7, #dbeafe);
        border-radius: 8px;
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
      }
      .mk-sm-box {
        width: 120px;
        height: 80px;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 700;
        font-size: 11px;
      }
      .mk-sm-circle {
        -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><circle cx="60" cy="40" r="30" fill="black"/></svg>') no-repeat center / contain;
                mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><circle cx="60" cy="40" r="30" fill="black"/></svg>') no-repeat center / contain;
      }
      .mk-sm-rect {
        -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect x="20" y="10" width="80" height="60" fill="black"/></svg>') no-repeat center / contain;
                mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect x="20" y="10" width="80" height="60" fill="black"/></svg>') no-repeat center / contain;
      }
      .mk-sm-path {
        -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><path d="M60,10 L110,70 L10,70 Z" fill="black"/></svg>') no-repeat center / contain;
                mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><path d="M60,10 L110,70 L10,70 Z" fill="black"/></svg>') no-repeat center / contain;
      }
      .mk-sm-complex {
        -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><g fill="black"><circle cx="30" cy="40" r="20"/><circle cx="60" cy="40" r="20"/><circle cx="90" cy="40" r="20"/></g></svg>') no-repeat center / contain;
                mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><g fill="black"><circle cx="30" cy="40" r="20"/><circle cx="60" cy="40" r="20"/><circle cx="90" cy="40" r="20"/></g></svg>') no-repeat center / contain;
      }
    `);
    const info = [
      '===== SVG mask 元素与 url() 引用 =====',
      '',
      '【SVG <mask> 元素基础】',
      '  <svg width="0" height="0">',
      '    <defs>',
      '      <mask id="myMask">',
      '        <rect width="100" height="100" fill="black"/>',
      '        <circle cx="50" cy="50" r="40" fill="white"/>',
      '      </mask>',
      '    </defs>',
      '  </svg>',
      '  <!-- mask 元素必须在 <defs> 内定义 -->',
      '  <!-- 默认 mask-type: luminance（白色可见，黑色不可见） -->',
      '',
      '【mask 元素属性：maskUnits】',
      '  <mask id="m" maskUnits="userSpaceOnUse">',
      '    <!-- 内容坐标用用户坐标系（如 cx="50" cy="50" 是绝对像素） -->',
      '  </mask>',
      '',
      '  <mask id="m" maskUnits="objectBoundingBox">',
      '    <!-- 内容坐标归一化到 0-1（如 cx="0.5" cy="0.5" 是中心） -->',
      '  </mask>',
      '',
      '  maskUnits 取值：',
      '    userSpaceOnUse       // 用户坐标系（默认值）',
      '    objectBoundingBox    // 0-1 归一化（相对目标元素）',
      '',
      '【mask 元素属性：maskContentUnits】',
      '  <mask id="m" maskContentUnits="userSpaceOnUse">',
      '    <!-- 遮罩内容的坐标系 -->',
      '  </mask>',
      '',
      '  maskContentUnits 取值：',
      '    userSpaceOnUse       // 默认，用户坐标系',
      '    objectBoundingBox    // 0-1 归一化',
      '',
      '  maskUnits vs maskContentUnits 区别：',
      '    maskUnits：决定 mask 元素本身的几何属性（x/y/width/height）坐标系',
      '    maskContentUnits：决定 mask 内部子元素（circle/rect）的坐标系',
      '',
      '【SVG 内引用：mask="url(#id)"】',
      '  <svg width="200" height="200">',
      '    <defs>',
      '      <mask id="circleMask">',
      '        <circle cx="100" cy="100" r="80" fill="white"/>',
      '      </mask>',
      '    </defs>',
      '    <rect width="200" height="200" fill="blue" mask="url(#circleMask)"/>',
      '  </svg>',
      '  <!-- SVG 元素通过 mask="url(#id)" 属性引用 mask -->',
      '',
      '【CSS 引用：mask-image: url(#svgMask)】',
      '  <!-- HTML 内联 SVG -->',
      '  <svg width="0" height="0" style="position:absolute">',
      '    <defs>',
      '      <mask id="htmlMask">',
      '        <circle cx="50" cy="50" r="40" fill="white"/>',
      '      </mask>',
      '    </defs>',
      '  </svg>',
      '',
      '  <div class="masked">HTML 元素</div>',
      '',
      '  /* CSS 引用 SVG mask */',
      '  .masked {',
      '    -webkit-mask-image: url(#htmlMask);',
      '            mask-image: url(#htmlMask);',
      '  }',
      '  /* Chrome/Firefox 支持，Safari 需 -webkit- */',
      '',
      '【mask 元素内可放任意 SVG 图形】',
      '  <mask id="complex">',
      '    <rect width="100" height="100" fill="black"/>          <!-- 黑色背景（不可见） -->',
      '    <circle cx="50" cy="50" r="40" fill="white"/>           <!-- 白色圆（可见） -->',
      '    <rect x="20" y="20" width="20" height="20" fill="black"/> <!-- 黑色矩形（挖洞） -->',
      '  </mask>',
      '  <!-- 复杂遮罩图形：圆环（圆减矩形） -->',
      '',
      '【mask 元素内可放渐变】',
      '  <svg>',
      '    <defs>',
      '      <linearGradient id="fadeGrad" x1="0" y1="0" x2="1" y2="0">',
      '        <stop offset="0%" stop-color="white"/>',
      '        <stop offset="100%" stop-color="black"/>',
      '      </linearGradient>',
      '      <mask id="fadeMask">',
      '        <rect width="100" height="100" fill="url(#fadeGrad)"/>',
      '      </mask>',
      '    </defs>',
      '  </svg>',
      '  <!-- mask 内用渐变实现羽化遮罩 -->',
      '',
      '【复杂遮罩图形定义示例】',
      '  <!-- 心形遮罩 -->',
      '  <mask id="heartMask" maskUnits="userSpaceOnUse">',
      '    <path d="M50,80 C20,50 0,30 30,15 C45,5 50,20 50,25 ',
      '             C50,20 55,5 70,15 C100,30 80,50 50,80 Z" fill="white"/>',
      '  </mask>',
      '',
      '  <!-- 文字遮罩 -->',
      '  <mask id="textMask" maskUnits="userSpaceOnUse">',
      '    <text x="50" y="50" font-size="40" fill="white">ABC</text>',
      '  </mask>',
      '',
      '【SVG mask vs CSS mask-image 优劣】',
      '  SVG <mask> 元素：',
      '    + 可定义复杂矢量遮罩（任意 SVG 图形/路径/文字）',
      '    + 支持渐变、嵌套 mask',
      '    + 跨 HTML 与 SVG 使用',
      '    + 浏览器支持好（所有现代浏览器）',
      '    - 需在文档内定义 SVG（占空间）',
      '    - maskUnits/maskContentUnits 概念复杂',
      '  CSS mask-image：',
      '    + 写法简洁（一行 CSS）',
      '    + 支持多层叠加合成',
      '    + 与 background-* 同构易学',
      '    + 无需 SVG 文档',
      '    - 复杂形状需用 data URL（写法冗长）',
      '    - Safari 需 -webkit- 前缀',
      '    - Chrome 120+ 才标准无前缀',
      '',
      '【实战：复杂遮罩图形定义】',
      '  <!-- 圆环遮罩（大圆减小圆） -->',
      '  <mask id="ringMask" maskUnits="userSpaceOnUse">',
      '    <circle cx="50" cy="50" r="40" fill="white"/>',
      '    <circle cx="50" cy="50" r="20" fill="black"/>',
      '  </mask>',
      '  <!-- 白色大圆可见，黑色小圆挖洞 → 圆环 -->',
      '',
      '  <!-- 多形状组合 -->',
      '  <mask id="multiShapeMask" maskUnits="userSpaceOnUse">',
      '    <circle cx="30" cy="50" r="25" fill="white"/>',
      '    <rect x="50" y="20" width="50" height="60" fill="white"/>',
      '    <circle cx="80" cy="50" r="25" fill="white"/>',
      '  </mask>',
      '',
      '【浏览器支持】',
      `  mask-type: ${f.maskType ? '✓' : '✗'} (SVG mask 元素属性)`,
      '  SVG <mask> 元素：所有现代浏览器支持',
      '  CSS mask-image: url(#id)：Chrome/Firefox 支持，Safari 需 -webkit-',
      '  maskUnits/maskContentUnits：所有现代浏览器支持',
      '',
      '【常见陷阱】',
      '  1. SVG mask 必须在 <defs> 内定义',
      '  2. SVG mask 默认 mask-type: luminance（白色可见，与 CSS alpha 模式相反）',
      '  3. maskUnits 默认 objectBoundingBox（坐标 0-1），maskContentUnits 默认 userSpaceOnUse',
      '  4. maskUnits 与 maskContentUnits 默认值不同，易混淆',
      '  5. CSS mask-image: url(#id) 引用要求 mask 元素在同一文档内',
      '  6. mask 元素本身不显示（仅作为遮罩定义），需通过 mask="url(#id)" 引用',
      '  7. SVG mask 内文字遮罩需指定 font-size/font-family',
    ].join('\n');
    this.setState({ svgMaskInfo: info });
    this._addLog('css', `SVG mask 演示完成；supports=${f.maskType}`);
  }

  _renderCard7(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. SVG mask 元素与 url() 引用',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['mask-type', f.maskType]]),
        h(Tag, { color: 'primary' }, 'SVG mask'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'SVG <mask id="x" maskUnits="userSpaceOnUse|objectBoundingBox" maskContentUnits> 元素。mask="url(#x)" SVG 内引用，CSS mask-image: url(#svgMask) HTML 引用 SVG mask。maskUnits 坐标系（userSpaceOnUse 用户坐标/objectBoundingBox 0-1 归一化），maskContentUnits 遮罩内容坐标系。SVG mask 内可放任意图形（rect/circle/path/渐变/文字）。SVG mask vs CSS mask-image 优劣对比。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 SVG mask 演示', { type: 'primary', size: 'sm', onClick: () => this._runSvgMaskDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, `<!-- SVG mask 元素定义 -->
<svg width="0" height="0">
  <defs>
    <mask id="circleMask" maskUnits="userSpaceOnUse">
      <circle cx="50" cy="50" r="40" fill="white"/>
    </mask>
  </defs>
</svg>

<!-- SVG 内引用 -->
<rect width="100" height="100" fill="blue"
      mask="url(#circleMask)"/>

<!-- CSS 引用（HTML 元素） -->
<div class="masked">HTML</div>
<style>
  .masked {
    -webkit-mask-image: url(#circleMask);
            mask-image: url(#circleMask);
  }
</style>`)),
        h('div', { class: 'fs-sm text-secondary' }, '可视化演示（SVG data URL mask：circle/rect/path/complex）：'),
        h('div', { class: 'mk-sm-host' },
          h('div', { class: 'mk-sm-box mk-sm-circle' }, 'circle'),
          h('div', { class: 'mk-sm-box mk-sm-rect' }, 'rect'),
          h('div', { class: 'mk-sm-box mk-sm-path' }, 'path'),
          h('div', { class: 'mk-sm-box mk-sm-complex' }, 'complex'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.svgMaskInfo || '（点击按钮查看 SVG mask 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // ===================== Card 8：实战模式与陷阱 =====================

  _runPatternDemo(): void {
    const f = this._flags();
    this._injectStyle('mk-pattern-demo', `
      .mk-pt-host {
        padding: 16px;
        background: linear-gradient(135deg, #dbeafe, #ede9fe);
        border-radius: 8px;
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
      }
      .mk-pt-box {
        width: 100px;
        height: 100px;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 700;
        font-size: 11px;
      }
      .mk-pt-feather {
        -webkit-mask: radial-gradient(ellipse at center, black 50%, transparent 80%);
                mask: radial-gradient(ellipse at center, black 50%, transparent 80%);
      }
      .mk-pt-text {
        font-size: 36px;
        font-weight: 900;
        background: linear-gradient(135deg, #3b82f6, #ec4899, #f59e0b);
        -webkit-background-clip: text;
                background-clip: text;
        color: transparent;
        -webkit-mask: linear-gradient(black 50%, transparent);
                mask: linear-gradient(black 50%, transparent);
        padding: 8px 16px;
      }
      .mk-pt-irregular {
        -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path d="M50,10 L90,90 L10,90 Z" fill="black"/></svg>') no-repeat center / contain;
                mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path d="M50,10 L90,90 L10,90 Z" fill="black"/></svg>') no-repeat center / contain;
      }
      .mk-pt-fade {
        width: 100px;
        height: 100px;
        background: linear-gradient(135deg, #10b981, #34d399);
        -webkit-mask: linear-gradient(black, black);
                mask: linear-gradient(black, black);
        transition: mask 0.4s ease, -webkit-mask 0.4s ease;
        cursor: pointer;
      }
      .mk-pt-fade:hover {
        -webkit-mask: linear-gradient(black, transparent);
                mask: linear-gradient(black, transparent);
      }
      .mk-pt-glass {
        width: 140px;
        height: 80px;
        background: rgba(255, 255, 255, 0.25);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        -webkit-mask: linear-gradient(black, transparent);
                mask: linear-gradient(black, transparent);
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.4);
      }
    `);
    const info = [
      '===== 实战模式与陷阱 =====',
      '',
      '【模式 1：羽化边缘（mask-image: radial-gradient）】',
      '  .feather {',
      '    -webkit-mask: radial-gradient(ellipse at center, black 50%, transparent 80%);',
      '            mask: radial-gradient(ellipse at center, black 50%, transparent 80%);',
      '  }',
      '  /* 50%-80% 是 alpha 渐变区，形成柔和羽化 */',
      '  /* 适合：图像淡入背景、卡片柔和过渡 */',
      '',
      '【模式 2：文字遮罩（mask-image: linear-gradient + background-clip: text）】',
      '  .gradient-text {',
      '    font-size: 36px;',
      '    font-weight: 900;',
      '    background: linear-gradient(135deg, #3b82f6, #ec4899, #f59e0b);',
      '    -webkit-background-clip: text;',
      '            background-clip: text;',
      '    color: transparent;                  /* 文字透明显示背景 */',
      '    -webkit-mask: linear-gradient(black 50%, transparent);',
      '            mask: linear-gradient(black 50%, transparent);  /* 文字底部淡出 */',
      '  }',
      '  /* 渐变文字 + 底部羽化淡出 */',
      '',
      '【模式 3：不规则遮罩（SVG mask 元素 / data URL）】',
      '  .triangle {',
      "    -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100\" height=\"100\"><path d=\"M50,10 L90,90 L10,90 Z\" fill=\"black\"/></svg>') no-repeat center / contain;",
      "            mask: url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100\" height=\"100\"><path d=\"M50,10 L90,90 L10,90 Z\" fill=\"black\"/></svg>') no-repeat center / contain;",
      '  }',
      '  /* 用 SVG path 实现任意形状遮罩 */',
      '  /* 复杂形状比 clip-path:polygon 更精确（支持曲线） */',
      '',
      '【模式 4：遮罩动画（mask-position 动画 / @keyframes）】',
      '  /* mask-position 动画（光扫过效果） */',
      '  .shine {',
      '    -webkit-mask: linear-gradient(120deg, transparent 30%, black 50%, transparent 70%);',
      '            mask: linear-gradient(120deg, transparent 30%, black 50%, transparent 70%);',
      '    -webkit-mask-size: 300% 100%;',
      '            mask-size: 300% 100%;',
      '    animation: shine 2s linear infinite;',
      '  }',
      '  @keyframes shine {',
      '    from { -webkit-mask-position: 200% 0; mask-position: 200% 0; }',
      '    to   { -webkit-mask-position: -100% 0; mask-position: -100% 0; }',
      '  }',
      '  /* 实现光带扫过文字/图像的高光效果 */',
      '',
      '  /* mask 渐变动画（直接动画 mask 属性，需 @property 注册类型） */',
      '  @property --mask-pos {',
      '    syntax: "<percentage>";',
      '    inherits: false;',
      '    initial-value: 0%;',
      '  }',
      '  .anim-mask {',
      '    -webkit-mask: linear-gradient(black var(--mask-pos), transparent);',
      '            mask: linear-gradient(black var(--mask-pos), transparent);',
      '    transition: --mask-pos 0.5s ease;',
      '  }',
      '  .anim-mask:hover { --mask-pos: 100%; }',
      '',
      '【模式 5：图像渐隐（mask 配合 hover）】',
      '  .fade-image {',
      '    -webkit-mask: linear-gradient(black, black);',
      '            mask: linear-gradient(black, black);',
      '    transition: mask 0.4s ease, -webkit-mask 0.4s ease;',
      '  }',
      '  .fade-image:hover {',
      '    -webkit-mask: linear-gradient(black, transparent);',
      '            mask: linear-gradient(black, transparent);',
      '  }',
      '  /* 默认完全可见，hover 时底部淡出 */',
      '',
      '【模式 6：毛玻璃遮罩（backdrop-filter + mask）】',
      '  .glass {',
      '    background: rgba(255, 255, 255, 0.25);',
      '    backdrop-filter: blur(8px);',
      '    -webkit-backdrop-filter: blur(8px);',
      '    -webkit-mask: linear-gradient(black, transparent);',
      '            mask: linear-gradient(black, transparent);',
      '    border-radius: 8px;',
      '    border: 1px solid rgba(255, 255, 255, 0.4);',
      '  }',
      '  /* 毛玻璃面板 + 底部羽化过渡 */',
      '  /* 注意：backdrop-filter 与 mask 配合可能在某些浏览器有性能问题 */',
      '',
      '【模式 7：网格点状遮罩（mask-repeat + mask-size）】',
      '  .dotted {',
      '    -webkit-mask: radial-gradient(circle, black 3px, transparent 4px);',
      '            mask: radial-gradient(circle, black 3px, transparent 4px);',
      '    -webkit-mask-size: 16px 16px;',
      '            mask-size: 16px 16px;',
      '  }',
      '  /* 自动重复形成网格点状遮罩 */',
      '  /* 适合：背景纹理、装饰效果 */',
      '',
      '【模式 8：圆环遮罩（mask-composite: subtract）】',
      '  .ring {',
      '    -webkit-mask:',
      '      radial-gradient(circle, black 40%, transparent 40%),',
      '      radial-gradient(circle, black 20%, transparent 20%);',
      '    -webkit-mask-composite: source-out;',
      '            mask:',
      '      radial-gradient(circle, black 40%, transparent 40%),',
      '      radial-gradient(circle, black 20%, transparent 20%);',
      '            mask-composite: subtract;',
      '  }',
      '  /* 大圆减小圆 = 圆环 */',
      '',
      '【模式 9：滚动渐隐（scroll-driven + mask）】',
      '  /* 配合 scroll-timeline（Chrome 115+） */',
      '  .scroll-fade {',
      '    -webkit-mask: linear-gradient(black, black, transparent);',
      '            mask: linear-gradient(black, black, transparent);',
      '    -webkit-mask-size: 100% 200%;',
      '            mask-size: 100% 200%;',
      '    animation: scroll-fade linear;',
      '    animation-timeline: scroll();',
      '  }',
      '  @keyframes scroll-fade {',
      '    from { -webkit-mask-position: 0 0; mask-position: 0 0; }',
      '    to   { -webkit-mask-position: 0 100%; mask-position: 0 100%; }',
      '  }',
      '  /* 滚动时元素渐隐渐显 */',
      '',
      '【陷阱清单：mask 使用注意事项】',
      '  1. mask 不影响布局，元素仍占原空间（与 visibility 类似）',
      '     → 看不见的内容仍占位置，可能影响布局感知',
      '     → 与 display:none 区别：display 真正移除，mask 只隐藏视觉',
      '  2. mask-image 性能：大图解码开销',
      '     → 优先用渐变（GPU 友好）而非位图',
      '     → 大 PNG 解码耗时，影响首屏渲染',
      '     → 用 SVG 矢量图代替位图（小且清晰）',
      '  3. mask-mode 选择对 SVG 影响大',
      '     → alpha 模式：PNG 透明背景的图正常',
      '     → luminance 模式：彩色 SVG 无 alpha 时用',
      '     → 选错模式遮罩可能完全不生效（全可见或全不可见）',
      '  4. mask-composite 计算复杂需理解层级',
      '     → 多层 mask 从下往上合成',
      '     → subtract 是旧减新（不是新减旧）',
      '     → exclude 是对称差（异或），不是简单排除',
      '     → 建议逐层测试，避免一次性复杂合成',
      '  5. mask-border 浏览器支持有限',
      '     → Chrome 仅部分支持（不支持 outset/mode）',
      '     → Firefox 实验性，Safari 不支持',
      '     → 生产环境慎用，建议用 border-image 或 mask-image 替代',
      '  6. -webkit- 前缀兼容性 Safari',
      '     → Safari 至今不支持标准无前缀 mask-*',
      '     → 必须双写 -webkit-mask-* 和 mask-*',
      '     → -webkit-mask-composite 用旧语法（source-over 等）',
      '  7. mask vs clip-path 决策',
      '     → 羽化边缘/柔和过渡用 mask',
      '     → 硬切边/几何形状用 clip-path',
      '     → clip-path 性能更好（GPU 友好）',
      '     → mask 支持位图和任意图像（clip-path 仅几何路径）',
      '  8. mask 与 pointer-events',
      '     → mask 区域外内容不可见但仍可点击',
      '     → 需配合 pointer-events: none 禁用交互',
      '  9. mask 加载失败无声',
      '     → mask-image: url() 加载失败时元素完全不可见',
      '     → 无错误提示，需检查 Network 面板',
      '',
      '【调试技巧】',
      '  1. Chrome DevTools → Elements → Styles 查看 mask 属性',
      '  2. DevTools → Layers 面板查看合成层（mask 触发新层）',
      '  3. 临时移除 mask 验证：document.querySelector(".el").style.mask = "none"',
      '  4. 用半透明背景检查 mask 区域：background: rgba(255, 0, 0, 0.5)',
      '  5. 渐变 mask 调试：先加 -webkit-mask-repeat: no-repeat 检查单图位置',
      '  6. 多层 mask 调试：逐层添加，观察每层效果',
      '  7. SVG mask 调试：先单独显示 SVG mask 元素，再应用到目标',
      '  8. 浏览器支持检测：CSS.supports("mask-image", "linear-gradient(black, transparent)")',
      '',
      '【资源】',
      '  - CSS Masking 规范：https://drafts.fxtf.org/css-masking-1/',
      '  - MDN mask：https://developer.mozilla.org/docs/Web/CSS/mask',
      '  - mask-composite 详解：https://developer.mozilla.org/docs/Web/CSS/mask-composite',
      '  - SVG mask 元素：https://developer.mozilla.org/docs/Web/SVG/Element/mask',
      '  - Can I Use mask-image：https://caniuse.com/css-masks',
      '  - CSS Masking 指南：https://web.dev/articles/css-masking',
    ].join('\n');
    this.setState({ patternInfo: info });
    this._addLog('css', '实战模式与陷阱演示完成');
  }

  _renderCard8(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 实战模式与陷阱（羽化/文字遮罩/不规则遮罩/动画/毛玻璃/调试）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, '实战'),
        h(Tag, { color: f.mask ? 'success' : 'error' }, `mask ${f.mask ? '✓' : '✗'}`),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '羽化边缘（mask-image: radial-gradient）/ 文字遮罩（mask-image: linear-gradient 配合 background-clip:text）/ 不规则遮罩（SVG mask 元素）/ 遮罩动画（mask-position 动画 / @keyframes）/ 图像渐隐（mask 配合 hover）/ 毛玻璃遮罩（backdrop-filter + mask）。陷阱清单：mask 不影响布局仍占原空间 / mask-image 性能（大图解码开销）/ mask-mode 选择对 SVG 影响大 / mask-composite 计算复杂需理解层级 / mask-border 浏览器支持有限 / -webkit- 前缀兼容性 Safari / mask vs clip-path 决策（羽化用 mask 硬切用 clip-path）/ 调试技巧。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行实战模式演示', { type: 'primary', size: 'sm', onClick: () => this._runPatternDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, `/* 羽化边缘 */
.feather {
  -webkit-mask: radial-gradient(ellipse at center, black 50%, transparent 80%);
          mask: radial-gradient(ellipse at center, black 50%, transparent 80%);
}

/* 文字遮罩（渐变文字 + 底部淡出） */
.text-mask {
  font-size: 36px; font-weight: 900;
  background: linear-gradient(135deg, #3b82f6, #ec4899);
  -webkit-background-clip: text;
          background-clip: text;
  color: transparent;
  -webkit-mask: linear-gradient(black 50%, transparent);
          mask: linear-gradient(black 50%, transparent);
}

/* 遮罩动画：光扫过 */
.shine {
  -webkit-mask: linear-gradient(120deg, transparent 30%, black 50%, transparent 70%);
          mask: linear-gradient(120deg, transparent 30%, black 50%, transparent 70%);
  -webkit-mask-size: 300% 100%;
          mask-size: 300% 100%;
  animation: shine 2s linear infinite;
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '可视化演示（羽化/文字/不规则/hover 渐隐/毛玻璃）：'),
        h('div', { class: 'mk-pt-host' },
          h('div', { class: 'mk-pt-box mk-pt-feather' }, '羽化'),
          h('div', { class: 'mk-pt-text' }, 'MASK'),
          h('div', { class: 'mk-pt-box mk-pt-irregular' }, '三角'),
          h('div', { class: 'mk-pt-box mk-pt-fade' }, 'hover'),
          h('div', { class: 'mk-pt-glass' }, 'glass'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.patternInfo || '（点击按钮查看实战模式与陷阱完整指南）')),
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
      h('h2', { class: 'section-title' }, 'CSS Masking & Compositing 遮罩与合成深度实验室'),

      h(Alert, {
        type: 'info',
        message: 'CSS Masking Module Level 1 + SVG mask + 浏览器遮罩与合成 —— 像素级遮罩体系',
        description: '演示 CSS Masking 全套能力：mask 简写与 mask-image 基础（alpha 通道决定可见性，黑透明/白不透明）、mask-image 多遮罩叠加（与 background-image 同构 API，逗号分隔先写在上层，渐变/SVG/image-set() 多源）、mask-mode 与 mask-type（match-source/alpha/luminance 三种模式，match-source 自动选择，mask-type 仅 SVG <mask> 元素）、mask-repeat/position/size/origin/clip（与 background-* 完全同构，mask-origin 默认 border-box 含 fill-box/stroke-box/view-box SVG 框）、mask-composite 合成运算（add/subtract/intersect/exclude 四种，从下往上合成，-webkit-mask-composite 旧语法 Safari 兼容）、mask-border 高级遮罩边框（九宫格切片与 border-image 同构，浏览器支持有限）、SVG mask 元素与 url() 引用（maskUnits/maskContentUnits 坐标系，CSS mask-image: url(#id) HTML 引用 SVG mask）、实战模式（羽化边缘/文字遮罩/不规则遮罩/遮罩动画/图像渐隐/毛玻璃遮罩）与陷阱清单（mask 不影响布局/性能/mask-mode 选择/mask-composite 层级/mask-border 支持/-webkit- 前缀/mask vs clip-path 决策/调试技巧）。用 CSS.supports() 检测，jsdom 不做真实遮罩渲染但流程完整。',
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
