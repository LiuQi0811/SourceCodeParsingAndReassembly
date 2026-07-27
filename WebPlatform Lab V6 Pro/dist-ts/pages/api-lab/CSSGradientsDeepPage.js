// =====================================================================
// CSSGradientsDeepPage.js —— CSS Gradients 渐变完整深度实验室
// 演示 CSS Images Module Level 4 渐变全套能力：
//   1. linear-gradient() —— 线性渐变
//      linear-gradient(<angle>|<side-or-corner>, <color-stop>+)
//      角度 0deg=向上 / 90deg=向右 / 180deg=向下（默认）
//      to top|to right|to bottom|to left|to top right
//      颜色停止点 <color> <position>，多色默认均匀分布
//   2. radial-gradient() —— 径向渐变
//      radial-gradient([shape] [size] [at position], <color-stop>+)
//      shape: circle|ellipse；size: closest-side|farthest-corner|contain|cover
//      position: at center|at top|at 50% 50%
//   3. conic-gradient() —— 锥形渐变
//      conic-gradient([from angle] [at position], <color-stop>+)
//      from 0deg、at center；饼图/色轮/雷达图；与 transform: rotate 协同
//   4. repeating-linear/radial/conic-gradient() —— 重复渐变
//      repeating-linear-gradient(45deg, #3b82f6 0, #3b82f6 10px, #fff 10px, #fff 20px)
//      条纹图案、棋盘格、波纹
//   5. 颜色停止点 (Color Stops) 高级
//      双位置 <color> <pos1> <pos2>（硬过渡）、transparent、currentColor
//      渐变提示 (gradient hint) <position>、硬边缘（同位置两色）
//   6. color-interpolation-method 颜色插值
//      in srgb|in srgb-linear|in display-p3|in oklab|in oklch|in lab|in lch
//      hue-interpolation-method: shorter|longer|increasing|decreasing
//      in oklch longer hue 完整色相环渐变
//   7. 多层渐变叠加与 mix-blend-mode
//      多层 background-image 叠加（先写的在上层）
//      background-blend-mode: multiply|screen|overlay|...
//      渐变 + 图片混合；复杂图案（网格/斑点/光晕）
//   8. 实战模式与陷阱
//      渐变文字 background-clip:text、渐变边框、动画渐变 background-size hack
//      霓虹按钮、网格背景、棋盘格、立体球体、陷阱清单
// 说明：jsdom 不做真实渲染，但 CSS.supports 可探测属性支持；
//       注入演示样式 + 完整代码示例，真实浏览器可查看效果。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class CSSGradientsDeepPage extends Page {
    _inited = false;
    _dynamicStyles = [];
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            linearInfo: '', // Card 1：linear-gradient() 线性渐变
            radialInfo: '', // Card 2：radial-gradient() 径向渐变
            conicInfo: '', // Card 3：conic-gradient() 锥形渐变
            repeatingInfo: '', // Card 4：repeating-* 重复渐变
            colorStopsInfo: '', // Card 5：颜色停止点高级
            interpolationInfo: '', // Card 6：color-interpolation-method
            layeredInfo: '', // Card 7：多层叠加与 mix-blend-mode
            patternInfo: '', // Card 8：实战模式与陷阱
        };
    }
    componentDidMount() {
        if (this._inited)
            return;
        this._inited = true;
        this._dynamicStyles = [];
        const f = this._flags();
        const c = (ok) => ok ? '✓' : '✗';
        const parts = [
            `linear-gradient() ${c(f.linearGradient)}`,
            `radial-gradient() ${c(f.radialGradient)}`,
            `conic-gradient() ${c(f.conicGradient)}`,
            `repeating-linear-gradient() ${c(f.repeatingLinear)}`,
            `repeating-radial-gradient() ${c(f.repeatingRadial)}`,
            `repeating-conic-gradient() ${c(f.repeatingConic)}`,
            `oklch 颜色插值 ${c(f.oklchInterpolation)}`,
        ];
        const summary = f.css
            ? `CSS Gradients 能力检测：${parts.join(' · ')}。jsdom 不做真实渲染，但 CSS.supports 可探测属性支持；按钮点击注入演示样式 + 完整代码示例，真实浏览器可查看效果。`
            : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击仅记日志说明，不会抛异常。';
        this.setState({ capsSummary: summary });
        this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!f.conicGradient)
            this._addLog('warn', 'conic-gradient() 不可用（Chrome 69+/Firefox 83+/Safari 12.1+）');
        if (!f.oklchInterpolation)
            this._addLog('warn', 'oklch 颜色插值不可用（Chrome 111+ / CSS Color L4）');
        this._injectBaseStyles();
    }
    componentWillUnmount() {
        for (const style of this._dynamicStyles) {
            try {
                style.parentNode && style.parentNode.removeChild(style);
            }
            catch { /* noop */ }
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
        return items.map(([label, ok]) => h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
    }
    _injectStyle(id, css) {
        const existing = document.getElementById(id);
        if (existing)
            existing.remove();
        const style = document.createElement('style');
        style.id = id;
        style.textContent = css;
        document.head.appendChild(style);
        this._dynamicStyles.push(style);
    }
    _injectBaseStyles() {
        this._injectStyle('css-gr-base', `
      .gr-demo {
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
      }
      .gr-linear {
        height: 80px;
        border-radius: 8px;
        margin: 8px 0;
        background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%);
      }
      .gr-radial {
        height: 120px;
        border-radius: 8px;
        margin: 8px 0;
        background: radial-gradient(circle at center, #fbbf24, #ef4444 70%, #7f1d1d);
      }
      .gr-conic {
        height: 120px;
        width: 120px;
        border-radius: 50%;
        margin: 8px 0;
        background: conic-gradient(from 0deg, #ef4444, #f59e0b, #10b981, #3b82f6, #8b5cf6, #ec4899, #ef4444);
      }
      .gr-repeating {
        height: 80px;
        border-radius: 8px;
        margin: 8px 0;
        background: repeating-linear-gradient(45deg, #3b82f6 0, #3b82f6 10px, #ffffff 10px, #ffffff 20px);
      }
      .gr-colorstops {
        height: 60px;
        border-radius: 8px;
        margin: 8px 0;
        background: linear-gradient(to right, #3b82f6 0% 20%, #10b981 50% 50%, #ef4444 80% 100%);
      }
      .gr-interp {
        height: 60px;
        border-radius: 8px;
        margin: 8px 0;
        background: linear-gradient(in oklch, #3b82f6, #ef4444);
      }
      .gr-layered {
        height: 80px;
        border-radius: 8px;
        margin: 8px 0;
        background-image:
          radial-gradient(circle at 20% 30%, rgba(255,255,255,0.6), transparent 40%),
          radial-gradient(circle at 80% 70%, rgba(255,255,255,0.4), transparent 40%),
          linear-gradient(135deg, #3b82f6, #8b5cf6);
      }
      .gr-pattern {
        height: 100px;
        border-radius: 8px;
        margin: 8px 0;
        background-image:
          linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px);
        background-size: 20px 20px;
        background-color: #1e40af;
      }
      .gr-checker {
        height: 100px;
        border-radius: 8px;
        margin: 8px 0;
        background-image:
          linear-gradient(45deg, #cbd5e1 25%, transparent 25%),
          linear-gradient(-45deg, #cbd5e1 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #cbd5e1 75%),
          linear-gradient(-45deg, transparent 75%, #cbd5e1 75%);
        background-size: 30px 30px;
        background-position: 0 0, 0 15px, 15px -15px, -15px 0;
        background-color: #f8fafc;
      }
      .gr-text {
        font-size: 32px;
        font-weight: 800;
        margin: 8px 0;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }
      .gr-sphere {
        width: 100px;
        height: 100px;
        border-radius: 50%;
        margin: 8px 0;
        background: radial-gradient(circle at 30% 30%, #93c5fd, #1e40af 70%, #0c1e4d);
        box-shadow: inset -10px -10px 20px rgba(0,0,0,0.4);
      }
      .gr-output {
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
    _flags() {
        const hasCSS = typeof CSS !== 'undefined';
        const supportsPV = (p, v) => {
            try {
                return hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v);
            }
            catch {
                return false;
            }
        };
        return {
            css: hasCSS,
            supports: hasCSS && typeof CSS.supports === 'function',
            linearGradient: supportsPV('background-image', 'linear-gradient(red, blue)'),
            radialGradient: supportsPV('background-image', 'radial-gradient(red, blue)'),
            conicGradient: supportsPV('background-image', 'conic-gradient(red, blue)'),
            repeatingLinear: supportsPV('background-image', 'repeating-linear-gradient(red, blue)'),
            repeatingRadial: supportsPV('background-image', 'repeating-radial-gradient(red, blue)'),
            repeatingConic: supportsPV('background-image', 'repeating-conic-gradient(red, blue)'),
            oklchInterpolation: supportsPV('background', 'linear-gradient(in oklch, red, blue)'),
        };
    }
    // ===================== Card 1：linear-gradient() 线性渐变 =====================
    _runLinearDemo() {
        const f = this._flags();
        this._injectStyle('gr-linear-demo', `
      .gr-linear-host {
        padding: 16px;
        background: linear-gradient(135deg, #dbeafe, #ede9fe);
        border-radius: 8px;
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .gr-lin-1 { width: 120px; height: 60px; border-radius: 6px; background: linear-gradient(to right, #ef4444, #f59e0b); }
      .gr-lin-2 { width: 120px; height: 60px; border-radius: 6px; background: linear-gradient(45deg, #3b82f6, #8b5cf6, #ec4899); }
      .gr-lin-3 { width: 120px; height: 60px; border-radius: 6px; background: linear-gradient(90deg, #10b981 0%, #34d399 30%, #6ee7b7 100%); }
      .gr-lin-4 { width: 120px; height: 60px; border-radius: 6px; background: linear-gradient(0deg, #1e3a8a, transparent); }
    `);
        const info = [
            '===== linear-gradient() 线性渐变 =====',
            '',
            '【语法】',
            '  linear-gradient([ <angle> | <side-or-corner> ,] <color-stop>+)',
            '  /* 至少两个颜色停止点；方向可省略（默认 to bottom） */',
            '',
            '【角度单位 deg：0deg=向上，顺时针递增】',
            '  0deg    → 向上（等价 to top）',
            '  90deg   → 向右（等价 to right）',
            '  180deg  → 向下（等价 to bottom，默认）',
            '  270deg  → 向左（等价 to left）',
            '  45deg   → 右上方向对角线',
            '  135deg  → 右下方向对角线',
            '  /* 角度比 to 关键字更精细，可写任意值如 37deg */',
            '  /* 注意：0deg 在渐变里是「向上」，与 transform: rotate(0deg) 不同 */',
            '',
            '【side-or-corner 关键字方向】',
            '  to top          = 0deg',
            '  to right        = 90deg',
            '  to bottom       = 180deg（默认）',
            '  to left         = 270deg',
            '  to top right    → 指向右上角的对角线',
            '  to bottom left  → 指向左下角的对角线',
            '  /* 组合方向按容器对角线渐变；正方形容器上 to top right ≈ 45deg */',
            '  /* 关键字必须带 to 前缀（旧语法 top/right 不带 to 已废弃） */',
            '',
            '【颜色停止点 <color-stop>】',
            '  <color> <position>',
            '  position 可选：长度（px）或百分比（%）',
            '  linear-gradient(to right, red 0%, blue 100%)',
            '  linear-gradient(to right, red 50px, blue 200px)',
            '  /* 省略位置时浏览器自动均匀分布 */',
            '',
            '【多色停止点：默认均匀分布】',
            '  linear-gradient(to right, red, yellow, green, blue)',
            '  /* 4 色 → 自动均分到 0%, 33.3%, 66.7%, 100% */',
            '  linear-gradient(to right, red 10%, blue 90%)',
            '  /* 10% 前纯红，90% 后纯蓝，中间过渡 */',
            '  linear-gradient(to right, red, green 30%, blue)',
            '  /* red 自动 0%，blue 自动 100%，green 显式 30% */',
            '',
            '【位置前移/后移：颜色硬切】',
            '  linear-gradient(to right, red 0% 30%, blue 30% 100%)',
            '  /* 0%-30% 全红，30% 处硬切到蓝 → 见 Card 5 双位置 */',
            '',
            '【浏览器支持】',
            `  linear-gradient(): ${f.linearGradient ? '✓' : '✗'} (IE10+/所有现代浏览器)`,
            '',
            '【常见陷阱】',
            '  1. 角度方向：0deg 是向上而非向右（与 transform: rotate 0deg 不同）',
            '  2. to 关键字必须加 to 前缀，旧语法（省略 to）会被忽略',
            '  3. 颜色停止点位置超出 100% 仍参与插值，但视觉被容器裁切',
            '  4. 渐变无法直接 transition（需用 background-size hack，见 Card 8）',
            '  5. transparent 关键字实际是 rgba(0,0,0,0)，可能与下一色产生灰边',
            '     → 改用 rgba 显式指定同色相透明，如 rgba(59,130,246,0)',
        ].join('\n');
        this.setState({ linearInfo: info });
        this._addLog('css', `linear-gradient() 演示完成；supports=${f.linearGradient}`);
    }
    _renderCard1() {
        const s = this.state;
        const f = this._flags();
        const code = [
            '/* linear-gradient() 语法 */',
            'background: linear-gradient(',
            '  <angle> | <side-or-corner>,',
            '  <color-stop>+',
            ');',
            '',
            '/* 角度示例：0deg=向上，90deg=向右 */',
            'background: linear-gradient(135deg, #3b82f6, #8b5cf6);',
            'background: linear-gradient(to right, red, yellow, green);',
            'background: linear-gradient(0deg, blue, transparent);',
        ].join('\n');
        const card = new Card({
            title: '1. linear-gradient() —— 线性渐变',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['linear-gradient()', f.linearGradient]]), h(Tag, { color: 'primary' }, 'Images L4')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'linear-gradient(<angle>|<side-or-corner>, <color-stop>+) 线性渐变。角度 0deg=向上、90deg=向右、180deg=向下（默认）、270deg=向左，顺时针递增；关键字 to top|to right|to bottom|to left|to top right（须带 to 前缀）。颜色停止点 <color> <position> 可省略位置，多色默认均匀分布（如 4 色自动 0%/33.3%/66.7%/100%）。注意 0deg 在渐变里是向上，与 transform: rotate(0deg) 方向约定不同。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 linear-gradient 演示', { type: 'primary', size: 'sm', onClick: () => this._runLinearDemo() })),
                h('div', { class: 'gr-linear' }),
                h('pre', { class: 'code-block' }, h('code', {}, code)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.linearInfo || '（点击按钮查看 linear-gradient() 完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 2：radial-gradient() 径向渐变 =====================
    _runRadialDemo() {
        const f = this._flags();
        this._injectStyle('gr-radial-demo', `
      .gr-radial-host { padding: 16px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; }
      .gr-rad-1 { width: 110px; height: 110px; border-radius: 8px; background: radial-gradient(circle, #fbbf24, #ef4444); }
      .gr-rad-2 { width: 110px; height: 110px; border-radius: 8px; background: radial-gradient(circle closest-side, #34d399, #065f46); }
      .gr-rad-3 { width: 110px; height: 110px; border-radius: 8px; background: radial-gradient(farthest-corner at 70% 30%, #60a5fa, #1e3a8a); }
      .gr-rad-4 { width: 140px; height: 80px; border-radius: 8px; background: radial-gradient(ellipse at top, #f472b6, transparent 70%); }
    `);
        const info = [
            '===== radial-gradient() 径向渐变 =====',
            '',
            '【语法】',
            '  radial-gradient([ <ending-shape> || <size> ]? [ at <position> ]?, <color-stop>+)',
            '  /* ending-shape + size + at position 三组均可省略 */',
            '  /* 默认：ellipse farthest-corner at center */',
            '',
            '【shape 形状：circle | ellipse】',
            '  radial-gradient(circle, red, blue)        /* 正圆 */',
            '  radial-gradient(ellipse, red, blue)       /* 椭圆（默认），随容器宽高拉伸 */',
            '  /* circle 接受一个长度半径；ellipse 接受两个长度（水平/垂直）*/',
            '  radial-gradient(circle 50px, red, blue)',
            '  radial-gradient(ellipse 100px 60px, red, blue)',
            '',
            '【size 尺寸关键字】',
            '  closest-side     /* 半径=到最近边的距离 */',
            '  farthest-side    /* 半径=到最远边的距离 */',
            '  closest-corner   /* 半径=到最近角的距离 */',
            '  farthest-corner  /* 半径=到最远角的距离（默认）*/',
            '',
            '  /* 等价别名（CSS Images L4）*/',
            '  contain  = closest-side',
            '  cover    = farthest-corner',
            '',
            '  radial-gradient(circle closest-side, red, blue)',
            '  radial-gradient(ellipse farthest-corner, red, blue)',
            '',
            '【position 位置：at <position>】',
            '  radial-gradient(circle at center, red, blue)',
            '  radial-gradient(circle at top, red, blue)',
            '  radial-gradient(circle at 50% 50%, red, blue)',
            '  radial-gradient(circle at 30% 70%, red, blue)',
            '  radial-gradient(circle at 20px 30px, red, blue)',
            '  /* 与 background-position 语法一致 */',
            '',
            '【组合示例】',
            '  radial-gradient(circle closest-side at 70% 30%, #60a5fa, #1e3a8a)',
            '  radial-gradient(ellipse 80% 60% at top, #f472b6, transparent 70%)',
            '',
            '【多层径向渐变叠加】',
            '  background:',
            '    radial-gradient(circle at 20% 30%, rgba(255,255,255,0.6), transparent 40%),',
            '    radial-gradient(circle at 80% 70%, rgba(0,0,0,0.3), transparent 40%),',
            '    #3b82f6;',
            '',
            '【浏览器支持】',
            `  radial-gradient(): ${f.radialGradient ? '✓' : '✗'} (IE10+/所有现代浏览器)`,
            '',
            '【常见陷阱】',
            '  1. circle 与容器宽高无关（始终正圆），ellipse 会拉伸适配容器',
            '  2. closest-side/farthest-corner 基于容器几何计算，响应式下表现稳定',
            '  3. position 与 size 用 at 关键字连接，顺序不能颠倒',
            '  4. 单色径向渐变（如 radial-gradient(circle, red, red)）不会渲染圆形',
            '  5. transparent 同样可能产生灰边，建议用 rgba 同色相透明',
        ].join('\n');
        this.setState({ radialInfo: info });
        this._addLog('css', `radial-gradient() 演示完成；supports=${f.radialGradient}`);
    }
    _renderCard2() {
        const s = this.state;
        const f = this._flags();
        const code = [
            '/* radial-gradient() 语法 */',
            'background: radial-gradient(',
            '  [shape] [size] [at position],',
            '  <color-stop>+',
            ');',
            '',
            '/* 示例 */',
            'background: radial-gradient(circle, #fbbf24, #ef4444);',
            'background: radial-gradient(closest-side at 70% 30%, #60a5fa, #1e3a8a);',
            'background: radial-gradient(ellipse at top, #f472b6, transparent 70%);',
        ].join('\n');
        const card = new Card({
            title: '2. radial-gradient() —— 径向渐变',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['radial-gradient()', f.radialGradient]]), h(Tag, { color: 'primary' }, 'Images L4')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'radial-gradient([shape] [size] [at position], <color-stop>+) 径向渐变。shape: circle（正圆）|ellipse（椭圆，默认随容器拉伸）；size: closest-side|farthest-side|closest-corner|farthest-corner（默认），CSS L4 别名 contain=closest-side、cover=farthest-corner，也可用 <length> 或 <percentage>；position: at center|at top|at 50% 50%|at 20px 30px（与 background-position 语法一致）。默认 ellipse farthest-corner at center。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 radial-gradient 演示', { type: 'primary', size: 'sm', onClick: () => this._runRadialDemo() })),
                h('div', { class: 'gr-radial' }),
                h('pre', { class: 'code-block' }, h('code', {}, code)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.radialInfo || '（点击按钮查看 radial-gradient() 完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 3：conic-gradient() 锥形渐变 =====================
    _runConicDemo() {
        const f = this._flags();
        this._injectStyle('gr-conic-demo', `
      .gr-conic-host { padding: 16px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; display: flex; flex-wrap: wrap; gap: 12px; }
      .gr-con-1 { width: 110px; height: 110px; border-radius: 50%; background: conic-gradient(from 0deg, #ef4444, #f59e0b, #10b981, #3b82f6, #ef4444); }
      .gr-con-2 { width: 110px; height: 110px; border-radius: 50%; background: conic-gradient(#3b82f6 0 25%, #10b981 0 50%, #f59e0b 0 75%, #ef4444 0 100%); }
      .gr-con-3 { width: 110px; height: 110px; border-radius: 50%; background: conic-gradient(from 45deg at 50% 50%, #8b5cf6, #ec4899, #f59e0b, #8b5cf6); }
      .gr-con-4 { width: 110px; height: 110px; border-radius: 50%; background: conic-gradient(from 0deg, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%)); }
    `);
        const info = [
            '===== conic-gradient() 锥形渐变 =====',
            '',
            '【语法】',
            '  conic-gradient([ from <angle> ]? [ at <position> ]?, <color-stop>+)',
            '  /* 颜色沿圆周（中心射线）方向变化，而非沿直线 */',
            '  /* 默认：from 0deg at center */',
            '',
            '【from angle：起始角度】',
            '  conic-gradient(from 0deg, red, yellow, green, blue, red)',
            '  /* 0deg 起始方向是正上方（12 点钟），顺时针旋转 */',
            '  conic-gradient(from 90deg, red, blue)   /* 从正右方（3 点钟）开始 */',
            '  conic-gradient(from 45deg, red, blue)   /* 从右上 45° 开始 */',
            '',
            '【at position：中心位置】',
            '  conic-gradient(at center, red, blue)',
            '  conic-gradient(at 30% 70%, red, blue)',
            '  conic-gradient(from 0deg at top left, red, blue)',
            '',
            '【颜色停止点用角度/百分比】',
            '  conic-gradient(red 0deg, yellow 90deg, green 180deg, blue 270deg, red 360deg)',
            '  conic-gradient(red 0%, blue 25%, green 50%, orange 75%, red 100%)',
            '  /* 100% = 360deg，一圈完整 */',
            '',
            '【饼图：硬切颜色（双位置/单值停止点）】',
            '  /* L4 单值 + 链式停止点语法 */',
            '  conic-gradient(#3b82f6 0 25%, #10b981 0 50%, #f59e0b 0 75%, #ef4444 0 100%)',
            '  /* 每段「0 上限」自动接续上一段终点，实现硬切饼图 */',
            '',
            '  /* 传统双位置写法 */',
            '  conic-gradient(#3b82f6 0% 25%, #10b981 25% 50%, #f59e0b 50% 75%, #ef4444 75% 100%)',
            '',
            '【色轮：完整色相环】',
            '  conic-gradient(',
            '    hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%),',
            '    hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%)',
            '  )',
            '',
            '【雷达图：与 transform: rotate 协同】',
            '  .radar {',
            '    background: conic-gradient(from 0deg, transparent 0deg 60deg, rgba(59,130,246,0.4) 60deg 120deg, transparent 120deg 360deg);',
            '    transform: rotate(0deg);',
            '    animation: gr-radar-spin 4s linear infinite;',
            '  }',
            '  @keyframes gr-radar-spin { to { transform: rotate(360deg); } }',
            '  /* 用 transform 旋转容器实现雷达扫描效果 */',
            '',
            '【浏览器支持】',
            `  conic-gradient(): ${f.conicGradient ? '✓' : '✗'} (Chrome 69+/Firefox 83+/Safari 12.1+)`,
            '',
            '【常见陷阱】',
            '  1. conic 起始 0deg 在正上方（12 点钟），与 linear 的 0deg=向上一致但语义不同',
            '  2. conic 颜色沿圆周变化，不是沿半径（radial 才是沿半径）',
            '  3. 首尾颜色不同时会出现一条硬切线 → 首尾用同色闭合',
            '  4. conic 不接受 shape/size 参数（中心是点而非圆）',
            '  5. 配合 border-radius: 50% 才能呈现圆形色轮/饼图',
        ].join('\n');
        this.setState({ conicInfo: info });
        this._addLog('css', `conic-gradient() 演示完成；supports=${f.conicGradient}`);
    }
    _renderCard3() {
        const s = this.state;
        const f = this._flags();
        const code = [
            '/* conic-gradient() 语法 */',
            'background: conic-gradient(',
            '  [from angle] [at position],',
            '  <color-stop>+',
            ');',
            '',
            '/* 色轮示例：0deg 起始在正上方，顺时针 */',
            'background: conic-gradient(from 0deg, #ef4444, #f59e0b, #10b981, #3b82f6, #ef4444);',
            '/* 饼图：硬切颜色 */',
            'background: conic-gradient(#3b82f6 0 25%, #10b981 0 50%, #f59e0b 0 75%, #ef4444 0 100%);',
        ].join('\n');
        const card = new Card({
            title: '3. conic-gradient() —— 锥形渐变',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['conic-gradient()', f.conicGradient]]), h(Tag, { color: 'primary' }, 'Images L4')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'conic-gradient([from angle] [at position], <color-stop>+) 锥形渐变，颜色沿圆周方向变化。from 0deg 起始方向为正上方（12 点钟），顺时针旋转；at center 设中心位置。应用：饼图（双位置/单值链式停止点硬切）、色轮（hsl 色相环）、雷达图（配合 transform: rotate 旋转容器扫描）。首尾颜色不同会出现硬切线 → 用同色闭合。Chrome 69+/Firefox 83+/Safari 12.1+ 支持。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 conic-gradient 演示', { type: 'primary', size: 'sm', onClick: () => this._runConicDemo() })),
                h('div', { class: 'gr-conic' }),
                h('pre', { class: 'code-block' }, h('code', {}, code)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.conicInfo || '（点击按钮查看 conic-gradient() 完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 4：repeating-linear/radial/conic-gradient() =====================
    _runRepeatingDemo() {
        const f = this._flags();
        this._injectStyle('gr-repeating-demo', `
      .gr-rep-host { padding: 16px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; }
      .gr-rep-1 { width: 160px; height: 70px; border-radius: 6px; background: repeating-linear-gradient(45deg, #3b82f6 0, #3b82f6 10px, #fff 10px, #fff 20px); }
      .gr-rep-2 { width: 120px; height: 120px; border-radius: 6px; background: repeating-radial-gradient(circle, #fbbf24 0 10px, #ef4444 10px 20px); }
      .gr-rep-3 { width: 120px; height: 120px; border-radius: 50%; background: repeating-conic-gradient(#3b82f6 0deg 30deg, #ec4899 30deg 60deg); }
      .gr-rep-4 { width: 160px; height: 70px; border-radius: 6px; background: repeating-linear-gradient(90deg, #10b981 0 5px, transparent 5px 15px); }
    `);
        const info = [
            '===== repeating-linear/radial/conic-gradient() 重复渐变 =====',
            '',
            '【语法：与普通渐变相同，但停止点会无限重复】',
            '  repeating-linear-gradient(<angle>|<side-or-corner>, <color-stop>+)',
            '  repeating-radial-gradient([shape] [size] [at position], <color-stop>+)',
            '  repeating-conic-gradient([from angle] [at position], <color-stop>+)',
            '',
            '  /* 重复周期 = 最后一个停止点位置 - 第一个停止点位置 */',
            '  /* 该周期内的渐变图案沿整个方向无限平铺 */',
            '',
            '【经典条纹：repeating-linear-gradient】',
            '  repeating-linear-gradient(45deg, #3b82f6 0, #3b82f6 10px, #fff 10px, #fff 20px)',
            '  /* 蓝 10px + 白 10px，周期 20px，沿 45° 方向无限重复 */',
            '',
            '  /* 简写：单值链式停止点（L4）*/',
            '  repeating-linear-gradient(45deg, #3b82f6 0 10px, #fff 0 20px)',
            '',
            '【棋盘格：两层 repeating-linear-gradient 叠加】',
            '  background:',
            '    repeating-linear-gradient(0deg, #cbd5e1 0 25%, transparent 0 50%),',
            '    repeating-linear-gradient(90deg, #cbd5e1 0 25%, transparent 0 50%),',
            '    #f8fafc;',
            '  background-size: 40px 40px;',
            '  /* 两层正交条纹叠加形成棋盘 */',
            '',
            '  /* 另一种棋盘：4 层 45°/-45° 组合 */',
            '  background-image:',
            '    linear-gradient(45deg, #cbd5e1 25%, transparent 25%),',
            '    linear-gradient(-45deg, #cbd5e1 25%, transparent 25%),',
            '    linear-gradient(45deg, transparent 75%, #cbd5e1 75%),',
            '    linear-gradient(-45deg, transparent 75%, #cbd5e1 75%);',
            '  background-size: 30px 30px;',
            '',
            '【波纹：repeating-radial-gradient】',
            '  repeating-radial-gradient(circle, #fbbf24 0 10px, #ef4444 10px 20px)',
            '  /* 同心圆波纹，周期 20px */',
            '',
            '【放射条纹：repeating-conic-gradient】',
            '  repeating-conic-gradient(#3b82f6 0deg 30deg, #ec4899 30deg 60deg)',
            '  /* 每 60° 一组（蓝 30° + 粉 30°），无限放射 */',
            '',
            '【虚线/点阵网格】',
            '  background:',
            '    repeating-linear-gradient(0deg, transparent 0 14px, #3b82f6 14px 15px),',
            '    repeating-linear-gradient(90deg, transparent 0 14px, #3b82f6 14px 15px);',
            '  /* 横竖各画 1px 线，间隔 15px，形成网格 */',
            '',
            '【浏览器支持】',
            `  repeating-linear-gradient(): ${f.repeatingLinear ? '✓' : '✗'} (IE10+)`,
            `  repeating-radial-gradient(): ${f.repeatingRadial ? '✓' : '✗'} (IE10+)`,
            `  repeating-conic-gradient(): ${f.repeatingConic ? '✓' : '✗'} (Chrome 69+/Firefox 83+)`,
            '',
            '【常见陷阱】',
            '  1. 重复周期 = 末停止点位置 - 首停止点位置；首位置必须 < 末位置才会重复',
            '  2. 像素值必须精确：repeating-linear-gradient(45deg, ... 10px ... 20px) 周期 20px',
            '     若周期非整数像素在高 DPI 屏会模糊 → 用整数 px 或 background-size 控制',
            '  3. repeating 与 background-size 协同可控制图案缩放',
            '  4. 渐变两端颜色相同时 repeating 不会出现接缝（首尾连续）',
            '  5. repeating-conic 周期用 deg，0-360deg 之外会自动模 360',
        ].join('\n');
        this.setState({ repeatingInfo: info });
        this._addLog('css', `repeating-* 演示完成；supports=${f.repeatingLinear}/${f.repeatingRadial}/${f.repeatingConic}`);
    }
    _renderCard4() {
        const s = this.state;
        const f = this._flags();
        const code = [
            '/* repeating-linear-gradient 条纹 */',
            'background: repeating-linear-gradient(45deg,',
            '  #3b82f6 0, #3b82f6 10px, #fff 10px, #fff 20px);',
            '',
            '/* repeating-radial-gradient 波纹 */',
            'background: repeating-radial-gradient(circle,',
            '  #fbbf24 0 10px, #ef4444 10px 20px);',
            '',
            '/* repeating-conic-gradient 放射条纹 */',
            'background: repeating-conic-gradient(',
            '  #3b82f6 0deg 30deg, #ec4899 30deg 60deg);',
        ].join('\n');
        const card = new Card({
            title: '4. repeating-linear/radial/conic-gradient() —— 重复渐变',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['repeating-linear', f.repeatingLinear],
                ['repeating-conic', f.repeatingConic],
            ]), h(Tag, { color: 'primary' }, '图案')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'repeating-linear/radial/conic-gradient() 重复渐变，语法与普通渐变相同，但停止点图案会无限平铺。重复周期 = 末停止点位置 - 首停止点位置。经典条纹：repeating-linear-gradient(45deg, #3b82f6 0, #3b82f6 10px, #fff 10px, #fff 20px)。应用：条纹图案、棋盘格（两层正交叠加）、波纹（repeating-radial）、放射条纹（repeating-conic）。像素值需精确，高 DPI 屏用整数 px 避免模糊。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 repeating 演示', { type: 'primary', size: 'sm', onClick: () => this._runRepeatingDemo() })),
                h('div', { class: 'gr-repeating' }),
                h('pre', { class: 'code-block' }, h('code', {}, code)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.repeatingInfo || '（点击按钮查看 repeating-* 完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 5：颜色停止点 (Color Stops) 高级 =====================
    _runColorStopsDemo() {
        const f = this._flags();
        this._injectStyle('gr-colorstops-demo', `
      .gr-cs-host { padding: 16px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
      .gr-cs-1 { height: 40px; border-radius: 6px; background: linear-gradient(to right, #3b82f6 0% 20%, #10b981 50% 50%, #ef4444 80% 100%); }
      .gr-cs-2 { height: 40px; border-radius: 6px; background: linear-gradient(to right, #3b82f6, #ef4444 50%); }
      .gr-cs-hint { height: 40px; border-radius: 6px; background: linear-gradient(to right, #3b82f6, 25%, #ef4444); }
      .gr-cs-hard { height: 40px; border-radius: 6px; background: linear-gradient(to right, #3b82f6 50%, #ef4444 50%); }
      .gr-cs-trans { height: 40px; border-radius: 6px; background: linear-gradient(to right, rgba(59,130,246,0), #3b82f6); }
      .gr-cs-cur { height: 40px; border-radius: 6px; color: #10b981; background: linear-gradient(to right, currentColor, #ef4444); }
    `);
        const info = [
            '===== 颜色停止点 (Color Stops) 高级 =====',
            '',
            '【基础停止点：<color> <position>】',
            '  linear-gradient(to right, red 0%, blue 100%)',
            '  linear-gradient(to right, red 50px, blue 200px)',
            '  /* position 可省略，浏览器自动均匀分布 */',
            '',
            '【双位置停止点：<color> <pos1> <pos2>（硬过渡）】',
            '  /* 一个颜色指定两个位置，区间内为纯色 */',
            '  linear-gradient(to right, #3b82f6 0% 20%, #10b981 50% 50%, #ef4444 80% 100%)',
            '  /* 0-20% 纯蓝，20-50% 蓝→绿过渡，50% 处纯绿硬切，50-80% 绿→红，80-100% 纯红 */',
            '',
            '  /* 双位置同值 = 硬边缘 */',
            '  linear-gradient(to right, #3b82f6 50%, #ef4444 50%)',
            '  /* 50% 处直接从蓝切到红，无过渡 */',
            '',
            '【单值链式停止点（CSS Images L4）】',
            '  conic-gradient(#3b82f6 0 25%, #10b981 0 50%, #f59e0b 0 75%, #ef4444 0 100%)',
            '  /* 「0 上限」自动接续上一段终点，实现饼图硬切 */',
            '',
            '【transparent 关键字】',
            '  linear-gradient(to right, transparent, #3b82f6)',
            '  /* 注意：transparent 实际是 rgba(0,0,0,0)，与下一色插值会产生灰边 */',
            '  /* 解决：用同色相透明，避免黑→彩色过渡 */',
            '  linear-gradient(to right, rgba(59,130,246,0), #3b82f6)',
            '',
            '【currentColor 关键字】',
            '  .box {',
            '    color: #10b981;',
            '    background: linear-gradient(to right, currentColor, #ef4444);',
            '  }',
            '  /* currentColor 取元素当前 color 计算值，修改 color 即改渐变 */',
            '',
            '【渐变提示 (gradient hint)：<position>】',
            '  /* 在两个颜色之间插入一个纯位置，指定插值中点 */',
            '  linear-gradient(to right, #3b82f6, 25%, #ef4444)',
            '  /* 25% 是提示，两色在 25% 处达到中点（而非默认 50%）*/',
            '  /* 提示位置越偏，该侧颜色保持越久 */',
            '',
            '  linear-gradient(to right, #3b82f6, 75%, #ef4444)',
            '  /* 蓝色保持更久，75% 才到中点 */',
            '',
            '【硬边缘：同位置两色】',
            '  linear-gradient(to right, #3b82f6 50%, #ef4444 50%)',
            '  /* 50% 处直接硬切，无过渡区域 */',
            '  /* 适合做分割线、双色块 */',
            '',
            '【浏览器支持】',
            `  双位置停止点: ✓ (Chrome 71+/Firefox 64+/Safari 12.1+)`,
            `  gradient hint: ✓ (Chrome 71+/Firefox 64+/Safari 12.1+)`,
            '',
            '【常见陷阱】',
            '  1. transparent 的灰边问题：本质是 rgba(0,0,0,0) 与彩色插值',
            '     → 用 rgba(<同色>,0) 替代 transparent',
            '  2. 双位置 pos1 > pos2 会被浏览器规范化为 pos1=pos2（硬切）',
            '  3. gradient hint 只能放在两个颜色之间，不能在首尾',
            '  4. 提示位置超出 [0%,100%] 会被夹紧',
            '  5. 停止点位置可超出 100%（如 120%），仍参与插值但视觉裁切',
        ].join('\n');
        this.setState({ colorStopsInfo: info });
        this._addLog('css', '颜色停止点高级演示完成');
    }
    _renderCard5() {
        const s = this.state;
        const f = this._flags();
        const code = [
            '/* 双位置硬过渡 */',
            'background: linear-gradient(to right,',
            '  #3b82f6 0% 20%, #10b981 50% 50%, #ef4444 80% 100%);',
            '',
            '/* 渐变提示：25% 处为中点 */',
            'background: linear-gradient(to right, #3b82f6, 25%, #ef4444);',
            '',
            '/* 硬边缘：同位置两色 */',
            'background: linear-gradient(to right, #3b82f6 50%, #ef4444 50%);',
        ].join('\n');
        const card = new Card({
            title: '5. 颜色停止点 (Color Stops) 高级',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: 'primary' }, 'Color Stops'), h(Tag, { color: f.linearGradient ? 'success' : 'error' }, `双位置 ${f.linearGradient ? '✓' : '✗'}`)),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '颜色停止点高级用法。双位置 <color> <pos1> <pos2> 实现硬过渡（区间内纯色）；同位置两色（#3b82f6 50%, #ef4444 50%）实现硬边缘。transparent 关键字实际是 rgba(0,0,0,0)，与彩色插值产生灰边 → 用 rgba 同色相透明替代。currentColor 取元素 color 计算值。渐变提示 (gradient hint) 在两色间插入纯位置指定中点（如 linear-gradient(to right, blue, 25%, red) 让 25% 处为中点）。单值链式停止点（L4）用于饼图硬切。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 color stops 演示', { type: 'primary', size: 'sm', onClick: () => this._runColorStopsDemo() })),
                h('div', { class: 'gr-colorstops' }),
                h('pre', { class: 'code-block' }, h('code', {}, code)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.colorStopsInfo || '（点击按钮查看颜色停止点高级用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 6：color-interpolation-method 颜色插值 =====================
    _runInterpolationDemo() {
        const f = this._flags();
        const info = [
            '===== color-interpolation-method 颜色插值 =====',
            '',
            '【语法：在渐变函数中插入 in <color-space>】',
            '  linear-gradient(in <color-space>, <color-stop>+)',
            '  linear-gradient(in <color-space> <hue-method>, <color-stop>+)',
            '',
            '【color-space 颜色空间】',
            '  in srgb            /* 默认 sRGB（与不加 in 相同）*/',
            '  in srgb-linear     /* 线性 sRGB，物理亮度空间 */',
            '  in display-p3      /* Display P3 广色域 */',
            '  in a98-rgb         /* Adobe RGB */',
            '  in prophoto-rgb    /* ProPhoto RGB */',
            '  in rec2020         /* Rec2020 广色域 */',
            '  in oklab           /* OKLab 感知均匀空间（推荐）*/',
            '  in oklch           /* OKLCH 圆柱空间（色相/饱和/明度）*/',
            '  in lab             /* CIE Lab */',
            '  in lch             /* LCH 圆柱空间 */',
            '',
            '  /* oklab/oklch 是现代推荐：感知更均匀，过渡更自然，无 sRGB 的灰带 */',
            '',
            '【hue-interpolation-method 色相插值方法（仅 oklch/lch）】',
            '  shorter hue    /* 走较短色相弧（默认）*/',
            '  longer hue     /* 走较长色相弧（绕远路）*/',
            '  increasing hue /* 色相递增方向 */',
            '  decreasing hue /* 色相递减方向 */',
            '',
            '【in oklch longer hue 完整色相环渐变】',
            '  /* 走长弧实现完整色相环，颜色更丰富 */',
            '  linear-gradient(in oklch longer hue, #3b82f6, #ef4444)',
            '  /* 从蓝到红，走长弧经过 绿→黄→橙，而非短弧经过紫 */',
            '',
            '  /* 完整色相环（首尾同色 + longer hue）*/',
            '  conic-gradient(in oklch longer hue, hsl(0 100% 50%), hsl(360 100% 50%))',
            '',
            '【sRGB vs oklab 对比】',
            '  /* sRGB：蓝→红 中间会出现暗灰带（sRGB 非线性）*/',
            '  linear-gradient(in srgb, #3b82f6, #ef4444)',
            '',
            '  /* oklab：中间过渡更平滑自然，无灰带 */',
            '  linear-gradient(in oklab, #3b82f6, #ef4444)',
            '',
            '【display-p3 广色域渐变】',
            '  /* 在支持 P3 的显示器上呈现更饱和的颜色 */',
            '  linear-gradient(in display-p3, color(display-p3 0 1 0), color(display-p3 1 0 0))',
            '',
            '【在所有渐变函数中通用】',
            '  radial-gradient(in oklab, #3b82f6, #ef4444)',
            '  conic-gradient(in oklch longer hue, #3b82f6, #ec4899)',
            '  repeating-linear-gradient(in oklab, #3b82f6 0 10px, #ef4444 10px 20px)',
            '',
            '【浏览器支持】',
            `  in oklch 颜色插值: ${f.oklchInterpolation ? '✓' : '✗'} (Chrome 111+/Safari 16.2+/Firefox 113+)`,
            '',
            '【常见陷阱】',
            '  1. sRGB 默认空间在蓝↔红等互补色过渡时会出现灰带，oklab/oklch 更优',
            '  2. longer hue 必须配合色相空间（oklch/lch），srgb 系列无色相概念',
            '  3. 浏览器支持差异大：oklch 在旧浏览器会忽略整个渐变 → 加 fallback',
            '  4. display-p3 仅在广色域显示器与支持浏览器才生效',
            '  5. 不同色彩空间插值结果差异明显，设计时需明确指定',
        ].join('\n');
        this.setState({ interpolationInfo: info });
        this._addLog('css', `color-interpolation 演示完成；oklch supports=${f.oklchInterpolation}`);
    }
    _renderCard6() {
        const s = this.state;
        const f = this._flags();
        const code = [
            '/* 颜色空间插值 */',
            'background: linear-gradient(in oklab, #3b82f6, #ef4444);',
            '',
            '/* 走长弧实现完整色相环 */',
            'background: linear-gradient(in oklch longer hue, #3b82f6, #ef4444);',
            '',
            '/* 色相插值方法 */',
            '/* shorter hue | longer hue | increasing hue | decreasing hue */',
            'background: conic-gradient(in oklch longer hue, hsl(0 100% 50%), hsl(360 100% 50%));',
        ].join('\n');
        const card = new Card({
            title: '6. color-interpolation-method —— 颜色插值',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['in oklch', f.oklchInterpolation]]), h(Tag, { color: 'primary' }, 'Color L4')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'color-interpolation-method 用 in <color-space> 指定渐变颜色插值空间：in srgb（默认）/ in srgb-linear / in display-p3 / in a98-rgb / in prophoto-rgb / in rec2020 / in oklab / in oklch / in lab / in lch。oklab/oklch 是现代推荐（感知均匀、无 sRGB 灰带）。hue-interpolation-method: shorter|longer|increasing|decreasing 控制色相弧方向（仅 oklch/lch）。in oklch longer hue 走长弧实现完整色相环渐变。Chrome 111+/Safari 16.2+/Firefox 113+ 支持。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 interpolation 演示', { type: 'primary', size: 'sm', onClick: () => this._runInterpolationDemo() })),
                h('div', { class: 'gr-interp' }),
                h('pre', { class: 'code-block' }, h('code', {}, code)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.interpolationInfo || '（点击按钮查看 color-interpolation-method 完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 7：多层渐变叠加与 mix-blend-mode =====================
    _runLayeredDemo() {
        const f = this._flags();
        const info = [
            '===== 多层渐变叠加与 mix-blend-mode =====',
            '',
            '【多层 background-image 叠加：先写的在上层】',
            '  background-image:',
            '    radial-gradient(circle at 20% 30%, rgba(255,255,255,0.6), transparent 40%),',
            '    radial-gradient(circle at 80% 70%, rgba(255,255,255,0.4), transparent 40%),',
            '    linear-gradient(135deg, #3b82f6, #8b5cf6);',
            '  /* 写在最前的渲染在最上层，最后写的在最底层 */',
            '  /* 与 z-index 无关，仅按声明顺序堆叠 */',
            '',
            '【background 简写：多层用逗号分隔】',
            '  background:',
            '    linear-gradient(to right, rgba(255,0,0,0.3), transparent),',
            '    linear-gradient(to bottom, rgba(0,0,255,0.3), transparent),',
            '    #1e40af;',
            '  /* 最后一项通常是纯色背景色（最底层）*/',
            '',
            '【background-blend-mode：层间混合】',
            '  background-image: linear-gradient(to right, #3b82f6, #ef4444), url("bg.jpg");',
            '  background-blend-mode: multiply;',
            '  /* 渐变层与图片层用 multiply 混合 */',
            '',
            '【background-blend-mode 取值（同 mix-blend-mode）】',
            '  normal | multiply | screen | overlay | darken | lighten |',
            '  color-dodge | color-burn | hard-light | soft-light |',
            '  difference | exclusion | hue | saturation | color | luminosity',
            '',
            '  /* 多层可分别指定 */',
            '  background-blend-mode: multiply, screen, normal;',
            '',
            '【mix-blend-mode vs background-blend-mode】',
            '  background-blend-mode：仅混合该元素自身的多层 background-image',
            '  mix-blend-mode：混合该元素与其背后内容（父元素/兄弟元素）',
            '',
            '  /* mix-blend-mode 示例 */',
            '  .overlay {',
            '    position: absolute;',
            '    background: linear-gradient(45deg, #3b82f6, #ec4899);',
            '    mix-blend-mode: screen;',
            '  }',
            '',
            '【渐变 + 图片混合】',
            '  .hero {',
            '    background-image:',
            '      linear-gradient(to bottom, rgba(30,64,175,0.7), rgba(30,64,175,0.2)),',
            '      url("hero.jpg");',
            '    background-blend-mode: overlay;',
            '    /* 渐变作为遮罩与图片混合，实现暗角/调色 */',
            '  }',
            '',
            '【复杂图案 1：网格】',
            '  background-image:',
            '    linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),',
            '    linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px);',
            '  background-size: 20px 20px;',
            '  background-color: #1e40af;',
            '',
            '【复杂图案 2：斑点/光晕】',
            '  background-image:',
            '    radial-gradient(circle at 20% 30%, rgba(139,92,246,0.6), transparent 40%),',
            '    radial-gradient(circle at 80% 70%, rgba(236,72,153,0.5), transparent 40%),',
            '    radial-gradient(circle at 50% 50%, rgba(59,130,246,0.4), transparent 50%);',
            '  background-color: #0f172a;',
            '',
            '【复杂图案 3：光晕/聚光灯】',
            '  background:',
            '    radial-gradient(circle at 50% 0%, rgba(59,130,246,0.5), transparent 60%),',
            '    radial-gradient(circle at 50% 100%, rgba(236,72,153,0.3), transparent 60%),',
            '    #0f172a;',
            '',
            '【isolation: isolate 隔离混合层级】',
            '  .container { isolation: isolate; }',
            '  /* 子元素的 mix-blend-mode 只在容器内混合，不渗透到祖先 */',
            '',
            '【浏览器支持】',
            `  多层 background: ${f.linearGradient ? '✓' : '✗'} (所有现代浏览器)`,
            `  background-blend-mode: ${f.linearGradient ? '✓' : '✗'} (Chrome 35+/Firefox 30+/Safari 8+)`,
            '',
            '【常见陷阱】',
            '  1. 声明顺序即堆叠顺序：先写的在上层，与直觉相反',
            '  2. background-blend-mode 只混合本元素多层背景，不影响兄弟元素',
            '  3. 多层 background-size/background-position 也要用逗号分别指定',
            '  4. mix-blend-mode 会与背后所有内容混合，需 isolation 隔离',
            '  5. 纯色背景应放最后一层（最底），否则会盖住渐变',
        ].join('\n');
        this.setState({ layeredInfo: info });
        this._addLog('css', '多层叠加与 blend-mode 演示完成');
    }
    _renderCard7() {
        const s = this.state;
        const f = this._flags();
        const code = [
            '/* 多层叠加：先写的在上层 */',
            'background-image:',
            '  radial-gradient(circle at 20% 30%, rgba(255,255,255,0.6), transparent 40%),',
            '  radial-gradient(circle at 80% 70%, rgba(255,255,255,0.4), transparent 40%),',
            '  linear-gradient(135deg, #3b82f6, #8b5cf6);',
            '',
            '/* background-blend-mode 层间混合 */',
            'background-blend-mode: multiply, screen, normal;',
        ].join('\n');
        const card = new Card({
            title: '7. 多层渐变叠加与 mix-blend-mode',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: 'primary' }, 'Blend'), h(Tag, { color: f.linearGradient ? 'success' : 'error' }, `blend-mode ${f.linearGradient ? '✓' : '✗'}`)),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '多层 background-image 叠加：先写的渲染在上层（与 z-index 无关，按声明顺序堆叠）。background-blend-mode 控制本元素多层背景间混合（multiply|screen|overlay|darken|lighten|color-dodge|color-burn|hard-light|soft-light|difference|exclusion|hue|saturation|color|luminosity），多层可分别指定。与 mix-blend-mode 区别：background-blend-mode 仅混合本元素背景层，mix-blend-mode 混合元素与背后内容（需 isolation: isolate 隔离）。渐变+图片混合实现暗角/调色；多层 radial 叠加实现斑点/光晕复杂图案。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 layered 演示', { type: 'primary', size: 'sm', onClick: () => this._runLayeredDemo() })),
                h('div', { class: 'gr-layered' }),
                h('pre', { class: 'code-block' }, h('code', {}, code)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.layeredInfo || '（点击按钮查看多层叠加与 mix-blend-mode 完整用法）')),
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
            '【模式 1：渐变文字（background-clip: text）】',
            '  .gradient-text {',
            '    background: linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899);',
            '    -webkit-background-clip: text;   /* Safari/Chrome 需要 -webkit- */',
            '    background-clip: text;',
            '    color: transparent;              /* 文字颜色透明，露出背景渐变 */',
            '  }',
            '  /* 必须设置 color: transparent，否则文字遮住渐变 */',
            '',
            '【模式 2：渐变边框（border-image）】',
            '  .gradient-border {',
            '    border: 4px solid;',
            '    border-image: linear-gradient(135deg, #3b82f6, #ec4899) 1;',
            '    /* border-image-slice: 1 让整个边框用渐变填充 */',
            '  }',
            '  /* 注意：border-image 不支持 border-radius 圆角 */',
            '',
            '【模式 2b：渐变边框（mask + background，支持圆角）】',
            '  .gradient-border-radius {',
            '    background:',
            '      linear-gradient(white, white) padding-box,',
            '      linear-gradient(135deg, #3b82f6, #ec4899) border-box;',
            '    border: 4px solid transparent;',
            '    border-radius: 12px;',
            '  }',
            '  /* padding-box 白色填充内容区，border-box 渐变作边框 */',
            '',
            '【模式 3：动画渐变（background-size: 200% + background-position 移动）】',
            '  /* 渐变无法直接 transition，用 background-position hack */',
            '  .animated-gradient {',
            '    background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899, #3b82f6);',
            '    background-size: 200% 100%;',
            '    animation: gr-shift 3s linear infinite;',
            '  }',
            '  @keyframes gr-shift {',
            '    from { background-position: 0% 0%; }',
            '    to   { background-position: 200% 0%; }',
            '  }',
            '  /* 渐变首尾同色 + 200% 宽度 + 平移实现无缝循环 */',
            '',
            '【模式 4：霓虹按钮（多层 box-shadow + 渐变）】',
            '  .neon-btn {',
            '    background: linear-gradient(135deg, #3b82f6, #8b5cf6);',
            '    box-shadow:',
            '      0 0 5px #3b82f6,',
            '      0 0 20px rgba(59,130,246,0.5),',
            '      0 0 40px rgba(139,92,246,0.3);',
            '    transition: box-shadow 0.3s ease;',
            '  }',
            '  .neon-btn:hover {',
            '    box-shadow:',
            '      0 0 10px #3b82f6,',
            '      0 0 30px rgba(59,130,246,0.7),',
            '      0 0 60px rgba(139,92,246,0.5);',
            '  }',
            '',
            '【模式 5：网格背景图案】',
            '  .grid-bg {',
            '    background-image:',
            '      linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),',
            '      linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px);',
            '    background-size: 20px 20px;',
            '    background-color: #1e40af;',
            '  }',
            '',
            '【模式 6：棋盘格】',
            '  .checker-bg {',
            '    background-image:',
            '      linear-gradient(45deg, #cbd5e1 25%, transparent 25%),',
            '      linear-gradient(-45deg, #cbd5e1 25%, transparent 25%),',
            '      linear-gradient(45deg, transparent 75%, #cbd5e1 75%),',
            '      linear-gradient(-45deg, transparent 75%, #cbd5e1 75%);',
            '    background-size: 30px 30px;',
            '    background-position: 0 0, 0 15px, 15px -15px, -15px 0;',
            '    background-color: #f8fafc;',
            '  }',
            '',
            '【模式 7：立体球体（radial + inset shadow）】',
            '  .sphere {',
            '    width: 100px;',
            '    height: 100px;',
            '    border-radius: 50%;',
            '    background: radial-gradient(circle at 30% 30%, #93c5fd, #1e40af 70%, #0c1e4d);',
            '    box-shadow: inset -10px -10px 20px rgba(0,0,0,0.4);',
            '  }',
            '  /* 高光在左上 30%/30%，暗部用 inset shadow 加深右下 */',
            '',
            '【陷阱清单】',
            '  1. conic-gradient 角度方向：0deg 起始在正上方（12 点钟），顺时针；',
            '     与 linear-gradient 0deg=向上一致，但与 transform: rotate(0deg) 不同',
            '  2. 渐变无法直接 transition：',
            '     background-image 在两个渐变间过渡无效（浏览器不支持插值）',
            '     → 用 background-size + background-position hack（见模式 3）',
            '     → 或用 CSS 变量 + @property 注册类型实现颜色变量过渡',
            '       @property --c1 { syntax: "<color>"; inherits: false; initial-value: #3b82f6; }',
            '       .box { background: linear-gradient(var(--c1), #ef4444); transition: --c1 0.5s; }',
            '  3. repeating 无限图案需精确像素：',
            '     repeating-linear-gradient(45deg, ... 10px ... 20px) 周期 20px',
            '     非整数像素在高 DPI 屏模糊 → 用整数 px + background-size 控制',
            '  4. oklch 插值浏览器支持差异大：',
            '     旧浏览器会忽略整个渐变 → 先写 fallback 再写 oklch 版本',
            '     .box { background: linear-gradient(#3b82f6, #ef4444); }',
            '     .box { background: linear-gradient(in oklab, #3b82f6, #ef4444); }',
            '  5. transparent 灰边：实际是 rgba(0,0,0,0)，与彩色插值产生灰带',
            '     → 用 rgba(<同色>,0) 替代',
            '  6. background-clip: text 必须 color: transparent 才显示渐变',
            '     且需 -webkit-background-clip: text 兼容 Safari/旧 Chrome',
            '  7. border-image 不支持 border-radius 圆角 → 用 mask/background 双层方案',
            '  8. 多层 background 声明顺序：先写的在上层，纯色放最后一层',
            '',
            '【浏览器支持】',
            `  linear/radial-gradient: ${f.linearGradient ? '✓' : '✗'} (IE10+)`,
            `  conic-gradient: ${f.conicGradient ? '✓' : '✗'} (Chrome 69+/Firefox 83+)`,
            `  in oklch 插值: ${f.oklchInterpolation ? '✓' : '✗'} (Chrome 111+/Safari 16.2+/Firefox 113+)`,
            `  background-clip: text: ${f.linearGradient ? '✓' : '✗'} (-webkit- 前缀所有现代浏览器)`,
            '',
            '【资源】',
            '  - CSS Images Level 4：https://drafts.csswg.org/css-images-4/',
            '  - CSS Color Level 4：https://drafts.csswg.org/css-color-4/',
            '  - MDN linear-gradient：https://developer.mozilla.org/docs/Web/CSS/gradient/linear-gradient',
            '  - CSS Gradient 工具：https://cssgradient.io/',
            '  - Lea Verou 渐变工具：https://www.gradientmagic.com/',
        ].join('\n');
        this.setState({ patternInfo: info });
        this._addLog('css', '实战模式与陷阱演示完成');
    }
    _renderCard8() {
        const s = this.state;
        const f = this._flags();
        const code = [
            '/* 渐变文字 */',
            '.text { background: linear-gradient(135deg, #3b82f6, #ec4899);',
            '  -webkit-background-clip: text; background-clip: text; color: transparent; }',
            '',
            '/* 动画渐变（background-size hack）*/',
            '.anim { background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899, #3b82f6);',
            '  background-size: 200% 100%; animation: shift 3s linear infinite; }',
            '@keyframes shift { from { background-position: 0% 0%; } to { background-position: 200% 0%; } }',
        ].join('\n');
        const card = new Card({
            title: '8. 实战模式与陷阱（渐变文字 / 边框 / 动画 / 霓虹 / 网格 / 棋盘格 / 球体 / 陷阱清单）',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: 'primary' }, '实战'), h(Tag, { color: f.conicGradient ? 'success' : 'error' }, `conic ${f.conicGradient ? '✓' : '✗'}`)),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '实战模式：渐变文字（background-clip:text + color:transparent）、渐变边框（border-image 或 mask+background 双层支持圆角）、动画渐变（background-size:200% + background-position 平移，渐变无法直接 transition）、霓虹按钮（多层 box-shadow）、网格背景、棋盘格、立体球体（radial-gradient + inset shadow）。陷阱清单：conic 0deg 起始正上方、渐变无法 transition 需 hack、repeating 需精确像素、oklch 插值浏览器支持差异需 fallback、transparent 灰边、background-clip:text 需 color:transparent、border-image 不支持圆角、多层声明顺序先写在上层。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行实战模式演示', { type: 'primary', size: 'sm', onClick: () => this._runPatternDemo() })),
                h('div', { class: 'gr-text' }, '渐变文字 Gradient'),
                h('div', { class: 'gr-checker' }),
                h('div', { class: 'gr-sphere' }),
                h('pre', { class: 'code-block' }, h('code', {}, code)),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } }, h('code', {}, s.patternInfo || '（点击按钮查看实战模式与陷阱完整代码）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    _renderLogPanel() {
        const s = this.state;
        if (!s.logs || s.logs.length === 0)
            return '';
        return h(Card, { title: '运行日志' }, h('div', { class: 'log-list' }, ...s.logs.map((log) => h('div', { class: `log-item log-${log.type}` }, h('span', { class: 'log-time' }, log.time), h('span', { class: 'log-content' }, log.content)))));
    }
    renderPage() {
        const s = this.state;
        return [
            h('h2', { class: 'section-title' }, 'CSS Gradients 渐变完整深度实验室'),
            h(Alert, {
                type: 'info',
                message: 'CSS Images Module Level 4 —— 渐变全套能力',
                description: '演示 CSS Gradients 完整体系：linear-gradient()（角度 0deg=向上/90deg=向右、to 关键字方向、颜色停止点与默认均匀分布）、radial-gradient()（shape circle|ellipse、size closest-side|farthest-corner|contain|cover、at position）、conic-gradient()（from angle 起始正上方、at center、饼图/色轮/雷达图与 transform:rotate 协同）、repeating-linear/radial/conic-gradient()（重复渐变、条纹/棋盘格/波纹）、颜色停止点高级（双位置硬过渡、transparent 灰边、currentColor、gradient hint 渐变提示、硬边缘）、color-interpolation-method（in srgb|oklab|oklch|display-p3 等颜色空间、hue-interpolation-method shorter|longer|increasing|decreasing、in oklch longer hue 完整色相环）、多层叠加与 mix-blend-mode（background-image 堆叠顺序、background-blend-mode 层间混合、渐变+图片混合、复杂图案）、实战模式与陷阱（渐变文字 background-clip:text、渐变边框、动画渐变 background-size hack、霓虹按钮、网格/棋盘格/球体、conic 角度方向/渐变无法 transition/repeating 精确像素/oklch 支持）。用 CSS.supports() 检测，jsdom 不做真实渲染但流程完整。',
            }),
            s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
            h('div', { class: 'feature-grid' }, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderCard7(), this._renderCard8()),
            this._renderLogPanel(),
        ];
    }
}
//# sourceMappingURL=CSSGradientsDeepPage.js.map