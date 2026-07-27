// =====================================================================
// CSSFunctionsDeepPage.js —— CSS Easing + Math Functions 完整实验室
// 演示 CSS Easing Functions Level 1 + CSS Values and Units Level 4：
//   1. 概述与动机：CSS Easing Functions Level 1 + CSS Values and Units
//      Level 4 / 动画缓动函数标准化 / 数学函数计算能力 /
//      浏览器支持 Chrome 113+ / Firefox 113+ / Safari 13.1+ 全部稳定
//   2. cubic-bezier() 与 steps()：cubic-bezier(0.4, 0, 0.2, 1) / 标准
//      easing（ease/ease-in/ease-out/ease-in-out/linear）/ steps(4, end) /
//      steps(8, jump-start) / jump-start/jump-end/jump-none/jump-both / 阶梯动画
//   3. linear() 自定义缓动：linear(0, 0.25, 1 50%, 0.75, 1) / 自定义插值点 /
//      stop 参数 / 与 cubic-bezier 对比 / 复杂非线性缓动 / 输入输出点
//   4. calc() 与嵌套：calc(100% - 20px) / calc(50vw + 10em) / calc() 嵌套
//      calc() / 单位混合计算 / 与 var() 协同 / 浏览器解析时机
//   5. min()/max()/clamp()：min(100vw, 500px) / max(100px, 10vw) /
//      clamp(100px, 50vw, 500px) / 响应式字体大小 / 流式布局
//   6. 数学函数全集：abs() / sign() / round(down/up/to-zero/nearest) /
//      mod() / rem() / sin()/cos()/tan() / asin()/acos()/atan()/atan2() /
//      pow()/sqrt()/hypot() / exp()/log() / 三角与对数
//   7. 数学函数实战：圆周运动 transform: rotate(calc(sin(t) * 360deg)) /
//      弹簧动画 / 复杂路径 / SVG path 与 CSS math / 响应式设计 /
//      计算复杂布局
//   8. 陷阱与最佳实践：calc() 内运算符前后必须空格 / min/max 与媒体查询
//      取舍 / 性能考虑（动画中 calc）/ 浏览器降级 / DevTools 调试 /
//      与 @property @sin @cos 协同
// 说明：所有特性调用前做 typeof / CSS.supports 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。jsdom 不做真实 CSS 渲染，
//       CSS.supports 通常可用；CSS 数学函数 jsdom 通常识别为合法语法但无
//       真实计算，统一 try/catch 兜底。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class CSSFunctionsDeepPage extends Page {
    _inited = false;
    _dynamicStyles = [];
    _easingMode = '';
    _calcExpr = '';
    _clampExpr = '';
    // —— 初始 state ——
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            overviewInfo: '', // Card 1：概述与动机
            bezierStepsInfo: '', // Card 2：cubic-bezier() 与 steps()
            linearInfo: '', // Card 3：linear() 自定义缓动
            calcInfo: '', // Card 4：calc() 与嵌套
            minMaxClampInfo: '', // Card 5：min()/max()/clamp()
            mathFunctionsInfo: '', // Card 6：数学函数全集
            practiceInfo: '', // Card 7：数学函数实战
            pitfallsInfo: '', // Card 8：陷阱与最佳实践
            randomInfo: '', // Card 9：CSS random() 随机函数
        };
    }
    // —— 生命周期 ——
    componentDidMount() {
        // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
        if (this._inited)
            return;
        this._inited = true;
        // 一次性初始化各实例引用（componentWillUnmount 中释放）
        this._dynamicStyles = []; // 动态创建并插入 head 的 <style> 元素列表
        this._easingMode = 'cubic-bezier'; // Card 2 当前缓动模式
        this._calcExpr = '100% - 20px'; // Card 4 当前 calc 表达式
        this._clampExpr = '100px, 50vw, 500px'; // Card 5 当前 clamp 表达式
        // 一次性能力检测：CSS Easing + Math Functions 全家桶
        const f = this._flags();
        const c = (ok) => ok ? '✓' : '✗';
        const parts = [
            `CSS ${c(f.css)}`,
            `supports ${c(f.supports)}`,
            `cubic-bezier ${c(f.cubicBezier)}`,
            `steps ${c(f.steps)}`,
            `linear() ${c(f.linear)}`,
            `calc ${c(f.calc)}`,
            `min ${c(f.min)}`,
            `max ${c(f.max)}`,
            `clamp ${c(f.clamp)}`,
            `round ${c(f.round)}`,
            `mod ${c(f.mod)}`,
            `sin ${c(f.sin)}`,
            `pow ${c(f.pow)}`,
            `random ${c(f.random)}`,
        ];
        const summary = f.css
            ? `CSS Easing + Math Functions 能力检测：${parts.join(' · ')}。jsdom 不做真实 CSS 渲染，但 CSS.supports 通常可用；cubic-bezier/steps/calc/min/max/clamp 全部现代浏览器稳定支持（Chrome 113+ / Firefox 113+ / Safari 13.1+）。linear() / round() / mod() / sin() / pow() 等较新数学函数 Chrome 113+ / Firefox 113+ 支持。按钮点击注入演示样式 + 完整代码示例，真实浏览器可查看缓动与计算效果。`
            : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。';
        this.setState({ capsSummary: summary });
        this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!f.linear)
            this._addLog('warn', 'linear() 缓动函数不可用或 jsdom 未识别（Chrome 113+ / Firefox 113+ 较新，Safari 部分支持）');
        if (!f.round)
            this._addLog('warn', 'round() 数学函数不可用或 jsdom 未识别（Chrome 113+ / Firefox 113+ 较新）');
        if (!f.sin)
            this._addLog('warn', 'sin()/cos() 三角函数不可用或 jsdom 未识别（Chrome 113+ / Firefox 113+ 较新，CSS Values L4）');
        if (!f.random)
            this._addLog('warn', 'random() 随机函数不可用或 jsdom 未识别（CSS Values L5 草案，Chrome/Safari 实验性支持，Firefox 未实现）');
        // 一次性注入全部演示样式（仅一次；rerender 不会移除 head 中的 style）
        this._injectBaseStyles();
    }
    componentWillUnmount() {
        // 移除动态创建的 <style> 元素，便于 GC
        for (const style of this._dynamicStyles) {
            try {
                style.parentNode && style.parentNode.removeChild(style);
            }
            catch { /* noop */ }
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
    _caps(items) {
        return items.map(([label, ok]) => h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
    }
    // 返回布尔能力对象（供 capsSummary / 按钮 disabled 使用）
    // 用 safe 包裹：jsdom 不可用时返回 false，绝不抛异常
    _flags() {
        const safe = (fn) => { try {
            return fn();
        }
        catch {
            return false;
        } };
        const hasCSS = safe(() => typeof CSS !== 'undefined');
        const supportsPV = (p, v) => safe(() => hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v));
        return {
            css: hasCSS,
            supports: safe(() => hasCSS && typeof CSS.supports === 'function'),
            cubicBezier: supportsPV('transition-timing-function', 'cubic-bezier(0.4, 0, 0.2, 1)'),
            steps: supportsPV('transition-timing-function', 'steps(4, end)'),
            linear: supportsPV('transition-timing-function', 'linear(0, 0.5, 1)'),
            calc: supportsPV('width', 'calc(100% - 20px)'),
            min: supportsPV('width', 'min(100vw, 500px)'),
            max: supportsPV('width', 'max(100px, 10vw)'),
            clamp: supportsPV('width', 'clamp(100px, 50vw, 500px)'),
            round: supportsPV('width', 'round(2.5px, 1px)'),
            mod: supportsPV('width', 'mod(10px, 3px)'),
            sin: supportsPV('transform', 'rotate(sin(45deg))'),
            pow: supportsPV('width', 'pow(2px, 2)'),
            // Card 9：CSS random() —— CSS Values and Units Level 5（草案）
            random: supportsPV('width', 'random(0px, 100px)'),
            randomItem: supportsPV('width', 'random-item(--seed, 10px, 20px, 30px)'),
        };
    }
    // —— 注入一个 <style>，跟踪到 this._dynamicStyles ——
    _injectStyle(id, textContent) {
        const existing = document.getElementById(id);
        if (existing)
            existing.remove();
        const style = document.createElement('style');
        style.id = id;
        style.textContent = textContent;
        document.head.appendChild(style);
        this._dynamicStyles.push(style);
        return style;
    }
    // —— 一次性注入全部基础演示样式 ——
    _injectBaseStyles() {
        this._injectStyle('css-functions-demo', `
      /* ===== 通用函数舞台 ===== */
      .fn-stage {
        margin-top: 10px;
        padding: 12px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
      }
      /* ===== Card 2：cubic-bezier / steps 演示 ===== */
      .easing-stage {
        padding: 12px;
        background: #dbeafe;
        border: 2px solid #3b82f6;
        color: #1e3a8a;
        border-radius: 6px;
      }
      .easing-stage .easing-box {
        width: 60px;
        height: 60px;
        background: linear-gradient(135deg, #3b82f6, #1e40af);
        border-radius: 6px;
        margin: 8px 0;
        transition: transform 1s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .easing-stage .easing-box.moved { transform: translateX(200px); }
      .easing-stage .steps-box {
        width: 60px;
        height: 60px;
        background: linear-gradient(135deg, #10b981, #047857);
        border-radius: 6px;
        margin: 8px 0;
        transition: transform 1s steps(4, end);
      }
      .easing-stage .steps-box.moved { transform: translateX(200px); }
      /* ===== Card 4：calc() 演示 ===== */
      .calc-stage {
        padding: 12px;
        background: #fef3c7;
        border: 2px solid #f59e0b;
        color: #78350f;
        border-radius: 6px;
      }
      .calc-stage .calc-box {
        width: calc(100% - 20px);
        padding: 10px;
        background: #fff;
        border-radius: 4px;
        margin-top: 8px;
        font-size: 13px;
      }
      /* ===== Card 5：min/max/clamp 演示 ===== */
      .clamp-stage {
        padding: 12px;
        background: #dcfce7;
        border: 2px solid #10b981;
        color: #064e3b;
        border-radius: 6px;
      }
      .clamp-stage .clamp-box {
        width: clamp(100px, 50vw, 500px);
        padding: 10px;
        background: #fff;
        border-radius: 4px;
        margin-top: 8px;
        font-size: clamp(14px, 2vw, 20px);
      }
      /* ===== Card 7：圆周运动演示 ===== */
      .math-stage {
        padding: 12px;
        background: #ede9fe;
        border: 2px solid #8b5cf6;
        color: #4c1d95;
        border-radius: 6px;
      }
      .math-stage .orbit-container {
        position: relative;
        width: 200px;
        height: 200px;
        margin: 12px auto;
        border: 2px dashed #8b5cf6;
        border-radius: 50%;
      }
      .math-stage .orbit-center {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 12px;
        height: 12px;
        background: #8b5cf6;
        border-radius: 50%;
        transform: translate(-50%, -50%);
      }
      .math-stage .orbit-planet {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 20px;
        height: 20px;
        background: #f59e0b;
        border-radius: 50%;
        transform: translate(-50%, -50%) translateX(80px);
      }
      /* ===== 输出区 ===== */
      .fn-output {
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
            return `===== CSS Easing + Math Functions 概述 =====\n` +
                `\n` +
                `【规范归属】\n` +
                `  CSS Easing Functions Level 1（W3C Recommendation）\n` +
                `    规范地址：https://www.w3.org/TR/css-easing-1/\n` +
                `    定义：cubic-bezier() / steps() / linear()（L1 新增）\n` +
                `  CSS Values and Units Module Level 4（W3C Working Draft）\n` +
                `    规范地址：https://www.w3.org/TR/css-values-4/\n` +
                `    定义：calc() / min() / max() / clamp() / round() / mod() / rem() / sin() / cos() / pow() 等\n` +
                `\n` +
                `【核心动机】\n` +
                `  动画缓动函数标准化：\n` +
                `    早期仅 cubic-bezier() + steps() + 关键字（ease/ease-in/ease-out/ease-in-out/linear）\n` +
                `    CSS Easing L1 新增 linear() 支持任意非线性缓动\n` +
                `  数学函数计算能力：\n` +
                `    早期仅 calc() 简单四则运算\n` +
                `    CSS Values L4 新增 min/max/clamp/round/mod/rem/sin/cos/tan/asin/acos/atan/atan2/pow/sqrt/hypot/exp/log\n` +
                `    让 CSS 具备数学计算能力，无需 JS 辅助\n` +
                `\n` +
                `【两大函数家族】\n` +
                `  1. 缓动函数（Easing Functions）—— 用于 transition-timing-function / animation-timing-function\n` +
                `     cubic-bezier() / steps() / linear() + 关键字 ease/ease-in/ease-out/ease-in-out/linear\n` +
                `  2. 数学函数（Math Functions）—— 用于属性值计算\n` +
                `     calc() / min() / max() / clamp() / round() / mod() / rem()\n` +
                `     sin() / cos() / tan() / asin() / acos() / atan() / atan2()\n` +
                `     pow() / sqrt() / hypot() / exp() / log() / abs() / sign()\n` +
                `\n` +
                `【能力检测】\n` +
                `  CSS.supports('transition-timing-function','cubic-bezier(0.4, 0, 0.2, 1)') = ${f.cubicBezier}\n` +
                `  CSS.supports('transition-timing-function','steps(4, end)') = ${f.steps}\n` +
                `  CSS.supports('transition-timing-function','linear(0, 0.5, 1)') = ${f.linear}\n` +
                `  CSS.supports('width','calc(100% - 20px)') = ${f.calc}\n` +
                `  CSS.supports('width','min(100vw, 500px)') = ${f.min}\n` +
                `  CSS.supports('width','max(100px, 10vw)') = ${f.max}\n` +
                `  CSS.supports('width','clamp(100px, 50vw, 500px)') = ${f.clamp}\n` +
                `  CSS.supports('width','round(2.5px, 1px)') = ${f.round}\n` +
                `  CSS.supports('width','mod(10px, 3px)') = ${f.mod}\n` +
                `  CSS.supports('transform','rotate(sin(45deg))') = ${f.sin}\n` +
                `  CSS.supports('width','pow(2px, 2)') = ${f.pow}\n` +
                `\n` +
                `【浏览器支持】\n` +
                `  cubic-bezier() / steps() / calc() —— 全部现代浏览器支持\n` +
                `    Chrome 4+ / Firefox 4+ / Safari 6+ / Edge 79+（calc 略晚：Chrome 19+ / Firefox 16+）\n` +
                `  min() / max() / clamp() —— Chrome 79+ / Firefox 75+ / Safari 13.1+ / Edge 79+\n` +
                `  linear() / round() / mod() / rem() / sin() / cos() / pow() 等 —— 较新\n` +
                `    Chrome 113+ / Firefox 113+ / Safari 16.4+（CSS Values L4 数学函数）\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  <style>\n` +
                `    /* 缓动函数 */\n` +
                `    .animated {\n` +
                `      transition: transform 1s cubic-bezier(0.4, 0, 0.2, 1);\n` +
                `      /* 或 */\n` +
                `      transition: transform 1s linear(0, 0.25, 1 50%, 0.75, 1);\n` +
                `    }\n` +
                `\n` +
                `    /* 数学函数 */\n` +
                `    .responsive {\n` +
                `      width: calc(100% - 20px);\n` +
                `      font-size: clamp(14px, 2vw, 20px);\n` +
                `      margin: max(10px, 2vw);\n` +
                `    }\n` +
                `\n` +
                `    /* 圆周运动（CSS math）*/\n` +
                `    .planet {\n` +
                `      transform: rotate(calc(var(--angle) * 1deg)) translateX(80px);\n` +
                `      animation: orbit 4s linear infinite;\n` +
                `    }\n` +
                `  </style>`;
        }
        catch (err) {
            return `读取概述信息失败：${err.name} - ${err.message}`;
        }
    }
    _runOverviewDemo() {
        this.setState({ overviewInfo: this._readOverviewInfo() });
        this._addLog('info', `概述演示：CSS Easing L1 + Values L4，calc=${this._flags().calc}, sin=${this._flags().sin}`);
    }
    _renderCard1() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '1. 概述与动机 —— CSS Easing L1 + CSS Values L4',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['cubic-bezier', f.cubicBezier],
                ['calc', f.calc],
                ['clamp', f.clamp],
                ['sin', f.sin],
            ]), h(Tag, { color: 'primary' }, 'L1 REC + L4 WD')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'CSS Easing Functions Level 1（缓动函数标准化）+ CSS Values and Units Level 4（数学函数计算能力）。两大函数家族：缓动函数（cubic-bezier/steps/linear + ease 关键字，用于 transition/animation-timing-function）、数学函数（calc/min/max/clamp/round/mod/rem/sin/cos/tan/asin/acos/atan/atan2/pow/sqrt/hypot/exp/log/abs/sign，用于属性值计算）。浏览器支持：cubic-bezier/steps/calc 全浏览器稳定，min/max/clamp Chrome 79+/Safari 13.1+，linear/round/sin/pow 等数学函数 Chrome 113+/Firefox 113+/Safari 16.4+ 较新。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取概述信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runOverviewDemo() })),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.overviewInfo || '（点击「读取概述信息」查看 CSS Easing + Math Functions 全景）')),
                h(Alert, {
                    type: 'info',
                    message: 'CSS Easing L1 缓动函数 + CSS Values L4 数学函数让 CSS 具备计算能力',
                    description: '两大规范：CSS Easing Functions L1（cubic-bezier/steps/linear，缓动函数）、CSS Values and Units L4（calc/min/max/clamp/round/mod/sin/cos/pow 等，数学函数）。浏览器支持：cubic-bezier/steps/calc 全稳定，min/max/clamp Chrome 79+/Safari 13.1+，linear/round/sin/pow Chrome 113+/Firefox 113+ 较新。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 2：cubic-bezier() 与 steps() ===================
    _readBezierStepsInfo() {
        const f = this._flags();
        try {
            return `===== cubic-bezier() 与 steps() =====\n` +
                `\n` +
                `【cubic-bezier() 语法】\n` +
                `  cubic-bezier(<x1>, <y1>, <x2>, <y2>)\n` +
                `  四个参数定义贝塞尔曲线的两个控制点（P1, P2）\n` +
                `  P0 = (0, 0), P3 = (1, 1) 固定\n` +
                `  x1/x2 必须在 [0, 1] 范围内，y1/y2 可超出（产生回弹效果）\n` +
                `\n` +
                `【标准 easing 关键字（等价 cubic-bezier）】\n` +
                `  linear        ≡ cubic-bezier(0, 0, 1, 1)         线性匀速\n` +
                `  ease          ≡ cubic-bezier(0.25, 0.1, 0.25, 1) 默认，平滑\n` +
                `  ease-in       ≡ cubic-bezier(0.42, 0, 1, 1)      慢入快出\n` +
                `  ease-out      ≡ cubic-bezier(0, 0, 0.58, 1)      快入慢出\n` +
                `  ease-in-out   ≡ cubic-bezier(0.42, 0, 0.58, 1)   慢入慢出（两端慢）\n` +
                `\n` +
                `【常见自定义 cubic-bezier】\n` +
                `  Material Design：cubic-bezier(0.4, 0, 0.2, 1)（标准缓动）\n` +
                `  iOS 弹性：cubic-bezier(0.36, 1.56, 0.64, 1)（y2 > 1 产生回弹）\n` +
                `  Anticipate：cubic-bezier(0.5, -0.5, 0.5, 1.5)（y1 < 0 先回退）\n` +
                `\n` +
                `【steps() 语法】\n` +
                `  steps(<integer>, <step-position>?)\n` +
                `  <integer>：阶梯数（正整数）\n` +
                `  <step-position>：\n` +
                `    jump-start (或 start)：第一步在开始时跳跃\n` +
                `    jump-end (或 end)：最后一步在结束时跳跃（默认）\n` +
                `    jump-none：无跳跃（两端平滑，共 n+1 步）\n` +
                `    jump-both：两端都跳跃（共 n+1 步）\n` +
                `\n` +
                `【steps() 阶梯动画】\n` +
                `  steps(4, end)：4 步，每步 25%，最后一步在 100%\n` +
                `    0%→0, 25%→0, 25.01%→25%, 50%→25%, 50.01%→50%, ...\n` +
                `  steps(4, start)：4 步，第一步立即跳跃\n` +
                `    0%→25%, 25%→50%, 50%→75%, 75%→100%\n` +
                `  steps(8, jump-start)：8 步，开头跳跃\n` +
                `  常见用途：精灵图动画（sprite sheet）、打字机效果、像素艺术\n` +
                `\n` +
                `【jump-start / jump-end / jump-none / jump-both 区别】\n` +
                `  jump-start：开头跳跃（旧名 start）\n` +
                `  jump-end：结尾跳跃（旧名 end，默认）\n` +
                `  jump-none：无跳跃，n 步产生 n+1 个等距点（两端不跳）\n` +
                `  jump-both：两端都跳跃，n 步产生 n+1 个区间（共 n+1 步）\n` +
                `\n` +
                `【当前演示】\n` +
                `  当前缓动模式 = ${this._easingMode}\n` +
                `  CSS.supports('transition-timing-function','cubic-bezier(0.4, 0, 0.2, 1)') = ${f.cubicBezier}\n` +
                `  CSS.supports('transition-timing-function','steps(4, end)') = ${f.steps}\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  /* Material Design 标准缓动 */\n` +
                `  .material {\n` +
                `    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);\n` +
                `  }\n` +
                `\n` +
                `  /* iOS 弹性回弹 */\n` +
                `  .bouncy {\n` +
                `    transition: transform 0.5s cubic-bezier(0.36, 1.56, 0.64, 1);\n` +
                `  }\n` +
                `\n` +
                `  /* 阶梯动画（精灵图）*/\n` +
                `  .sprite {\n` +
                `    width: 64px; height: 64px;\n` +
                `    background: url(sprite.png) no-repeat;\n` +
                `    animation: walk 0.8s steps(8, end) infinite;\n` +
                `  }\n` +
                `  @keyframes walk {\n` +
                `    to { background-position: -512px 0; }  /* 8 帧 * 64px */\n` +
                `  }\n` +
                `\n` +
                `  /* 打字机效果 */\n` +
                `  .typewriter {\n` +
                `    overflow: hidden;\n` +
                `    white-space: nowrap;\n` +
                `    border-right: 2px solid;\n` +
                `    animation: typing 3s steps(20, end), blink 0.5s step-end infinite;\n` +
                `  }`;
        }
        catch (err) {
            return `读取 cubic-bezier/steps 信息失败：${err.name} - ${err.message}`;
        }
    }
    _setEasing(mode) {
        this._easingMode = mode;
        const map = {
            'cubic-bezier': '.easing-box { transition: transform 1s cubic-bezier(0.4, 0, 0.2, 1); } .steps-box { transition: transform 1s steps(4, end); }',
            'ease': '.easing-box { transition: transform 1s ease; } .steps-box { transition: transform 1s ease; }',
            'ease-in-out': '.easing-box { transition: transform 1s ease-in-out; } .steps-box { transition: transform 1s ease-in-out; }',
            'steps-start': '.easing-box { transition: transform 1s steps(4, start); } .steps-box { transition: transform 1s steps(8, jump-start); }',
            'steps-none': '.easing-box { transition: transform 1s steps(4, jump-none); } .steps-box { transition: transform 1s steps(4, jump-none); }',
        };
        this._injectStyle('css-easing-dynamic', (map[mode]) || map['cubic-bezier']);
        // 触发动画
        const box1 = this.el && this.el.querySelector('.easing-box');
        const box2 = this.el && this.el.querySelector('.steps-box');
        if (box1) {
            box1.classList.remove('moved');
            requestAnimationFrame(() => box1.classList.add('moved'));
        }
        if (box2) {
            box2.classList.remove('moved');
            requestAnimationFrame(() => box2.classList.add('moved'));
        }
        this.setState({ bezierStepsInfo: this._readBezierStepsInfo() });
        this._addLog('easing', `切换缓动模式 → ${mode}（点击运行观察动画差异）`);
    }
    _renderCard2() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '2. cubic-bezier() 与 steps() —— 贝塞尔曲线与阶梯动画',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['cubic-bezier', f.cubicBezier], ['steps', f.steps]]), h(Tag, { color: 'primary' }, '缓动函数')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'cubic-bezier(x1,y1,x2,y2) 定义贝塞尔曲线控制点（P0/P3 固定 0,0 / 1,1），x 范围 [0,1]，y 可超出产生回弹。标准关键字：linear/ease/ease-in/ease-out/ease-in-out（均等价特定 cubic-bezier）。steps(n, position) 阶梯动画：jump-start/jump-end(默认)/jump-none/jump-both。常见用途：Material Design cubic-bezier(0.4,0,0.2,1)、iOS 弹性 cubic-bezier(0.36,1.56,0.64,1)、精灵图动画 steps(8,end)、打字机效果 steps(20,end)。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ bezierStepsInfo: this._readBezierStepsInfo() }) }), this._btn('cubic-bezier', { size: 'sm', disabled: !f.cubicBezier, onClick: () => this._setEasing('cubic-bezier') }), this._btn('ease', { size: 'sm', disabled: !f.cubicBezier, onClick: () => this._setEasing('ease') }), this._btn('ease-in-out', { size: 'sm', disabled: !f.cubicBezier, onClick: () => this._setEasing('ease-in-out') }), this._btn('steps start', { size: 'sm', disabled: !f.steps, onClick: () => this._setEasing('steps-start') }), this._btn('steps none', { size: 'sm', disabled: !f.steps, onClick: () => this._setEasing('steps-none') })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '缓动演示（点击按钮触发动画，当前模式: ' + this._easingMode + '）：'),
                h('div', { class: 'easing-stage' }, h('div', { class: 'fs-sm' }, 'cubic-bezier 类缓动：'), h('div', { class: 'easing-box' }, ''), h('div', { class: 'fs-sm' }, 'steps 类阶梯动画：'), h('div', { class: 'steps-box' }, '')),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.bezierStepsInfo || '（点击按钮切换缓动模式查看说明）')),
                h(Alert, {
                    type: 'info',
                    message: 'cubic-bezier 适合平滑动画，steps 适合阶梯动画（精灵图/打字机）',
                    description: 'cubic-bezier(x1,y1,x2,y2) 贝塞尔曲线，y 可超出 [0,1] 产生回弹（iOS 弹性 cubic-bezier(0.36,1.56,0.64,1)）。steps(n, position) 阶梯动画：jump-start/jump-end(默认)/jump-none/jump-both。标准关键字 ease/ease-in/ease-out/ease-in-out 均等价特定 cubic-bezier。精灵图用 steps(8,end)，打字机用 steps(20,end)。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 3：linear() 自定义缓动 ===================
    _readLinearInfo() {
        const f = this._flags();
        try {
            return `===== linear() 自定义缓动 =====\n` +
                `\n` +
                `【linear() 语法】\n` +
                `  linear(<stop>, <stop>, ...)\n` +
                `  每个 stop 是：<number> [ <percentage> ]\n` +
                `    <number>：输出值（0-1，表示进度百分比）\n` +
                `    <percentage>：输入位置（0%-100%，可省略自动均匀分布）\n` +
                `\n` +
                `【示例解析】\n` +
                `  linear(0, 0.25, 1 50%, 0.75, 1)\n` +
                `    0%→0, ~25%→0.25, 50%→1, ~75%→0.75, 100%→1\n` +
                `    即：0% 和 25% 之间线性插值（0→0.25）\n` +
                `         25% 和 50% 之间线性插值（0.25→1）\n` +
                `         50% 和 75% 之间线性插值（1→0.75，下降！）\n` +
                `         75% 和 100% 之间线性插值（0.75→1）\n` +
                `    产生"先升后降再升"的非线性缓动\n` +
                `\n` +
                `【stop 参数详解】\n` +
                `  <number>：输出进度（0=开始，1=结束）\n` +
                `    可超出 [0,1] 产生回弹（如 1.2 表示超出 20%）\n` +
                `    可为负数产生回退（如 -0.1 表示先回退 10%）\n` +
                `  <percentage>：输入位置（时间百分比）\n` +
                `    可省略：自动均匀分布（如 linear(0, 0.5, 1) → 0%, 50%, 100%）\n` +
                `    可指定：linear(0, 0.5 30%, 1) → 0%, 30%, 100%\n` +
                `\n` +
                `【与 cubic-bezier 对比】\n` +
                `  cubic-bezier：4 参数定义曲线，仅一个 S 形\n` +
                `    适合：单一缓动曲线（ease/ease-in 等）\n` +
                `    局限：无法表示复杂非线性（如多段、回弹）\n` +
                `  linear()：任意数量的 stop，分段线性\n` +
                `    适合：复杂非线性缓动（多段、回弹、弹簧）\n` +
                `    优势：可表示任意分段线性函数\n` +
                `    劣势：分段线性（非平滑曲线，转折点有棱角）\n` +
                `\n` +
                `【复杂非线性缓动】\n` +
                `  弹簧效果（先超出再回弹）：\n` +
                `    linear(0, 0.8, 1.1, 0.95, 1)\n` +
                `    0%→0, 25%→0.8, 50%→1.1（超出）, 75%→0.95（回弹）, 100%→1\n` +
                `  多次回弹：\n` +
                `    linear(0, 1.2, 0.9, 1.05, 0.98, 1)\n` +
                `    0%→0, 20%→1.2, 40%→0.9, 60%→1.05, 80%→0.98, 100%→1\n` +
                `\n` +
                `【输入输出点】\n` +
                `  linear() 本质是"输入→输出"的映射表\n` +
                `  输入：时间百分比（0%-100%）\n` +
                `  输出：进度值（0-1，可超出）\n` +
                `  浏览器在相邻 stop 之间线性插值\n` +
                `\n` +
                `【能力检测】\n` +
                `  CSS.supports('transition-timing-function','linear(0, 0.5, 1)') = ${f.linear}\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  /* 自定义分段缓动 */\n` +
                `  .custom-easing {\n` +
                `    transition: transform 1s linear(0, 0.25, 1 50%, 0.75, 1);\n` +
                `  }\n` +
                `\n` +
                `  /* 弹簧回弹 */\n` +
                `  .spring {\n` +
                `    transition: transform 0.6s linear(0, 1.2 70%, 1);\n` +
                `    /* 0%→0, 70%→1.2（超出 20%）, 100%→1 */\n` +
                `  }\n` +
                `\n` +
                `  /* 多次回弹 */\n` +
                `  .bouncy {\n` +
                `    transition: transform 1s linear(0, 1.3, 0.85, 1.08, 0.97, 1);\n` +
                `  }\n` +
                `\n` +
                `【浏览器支持】\n` +
                `  linear() 较新：Chrome 113+ / Firefox 113+ / Safari 16.4+\n` +
                `  老浏览器不支持，回退为 linear（匀速）或 cubic-bezier`;
        }
        catch (err) {
            return `读取 linear() 信息失败：${err.name} - ${err.message}`;
        }
    }
    _renderCard3() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '3. linear() 自定义缓动 —— 任意非线性缓动函数',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['linear()', f.linear]]), h(Tag, { color: 'primary' }, 'CSS Easing L1')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'linear() 是 CSS Easing Functions L1 新增缓动函数，支持任意分段线性缓动：linear(<stop>, ...)，每个 stop 是 <number> [<percentage>]，number 是输出进度（0-1，可超出产生回弹），percentage 是输入位置（可省略自动均匀分布）。与 cubic-bezier 对比：cubic-bezier 仅单一 S 形曲线，linear() 可表示复杂非线性（多段、回弹、弹簧）。示例 linear(0, 0.25, 1 50%, 0.75, 1) 产生"先升后降再升"。弹簧效果 linear(0, 1.2 70%, 1) 先超出 20% 再回弹。浏览器支持：Chrome 113+ / Firefox 113+ / Safari 16.4+ 较新。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取 linear() 信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ linearInfo: this._readLinearInfo() }) })),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.linearInfo || '（点击按钮查看 linear() 自定义缓动完整说明）')),
                h(Alert, {
                    type: 'info',
                    message: 'linear() 支持任意分段线性缓动，可实现弹簧/回弹等复杂效果',
                    description: 'linear(<stop>, ...) 每个 stop 是 <number> [<percentage>]，number 输出进度（0-1 可超出回弹），percentage 输入位置（可省略自动分布）。与 cubic-bezier 对比：cubic-bezier 单一 S 形，linear() 任意分段线性。弹簧效果 linear(0, 1.2 70%, 1)。浏览器支持 Chrome 113+ / Firefox 113+ / Safari 16.4+ 较新。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 4：calc() 与嵌套 ===================
    _readCalcInfo() {
        const f = this._flags();
        try {
            const box = this.el && this.el.querySelector('.calc-box');
            let computed = '(未渲染)';
            if (box) {
                computed = window.getComputedStyle(box).getPropertyValue('width') || '(空)';
            }
            return `===== calc() 与嵌套 =====\n` +
                `\n` +
                `【calc() 语法】\n` +
                `  calc(<expression>)\n` +
                `  expression 支持：+ - * /\n` +
                `  ⚠ + 和 - 前后必须有空格（calc(100% - 20px) 而非 calc(100%-20px)）\n` +
                `  * 和 / 不要求空格（calc(2 * 3px) 或 calc(2*3px) 均可）\n` +
                `  除数不能为 0\n` +
                `\n` +
                `【单位混合计算】\n` +
                `  calc(100% - 20px)      百分比 - 像素\n` +
                `  calc(50vw + 10em)      视窗宽度 + em\n` +
                `  calc(100vh - 60px)     视窗高度 - 像素（全屏减导航）\n` +
                `  calc(10rem * 2)        rem 乘法\n` +
                `  calc(100% / 3)         百分比除法\n` +
                `\n` +
                `【calc() 嵌套 calc()】\n` +
                `  calc() 可嵌套：calc(calc(100% - 20px) / 2)\n` +
                `  现代浏览器支持嵌套（旧浏览器需扁平化）\n` +
                `  简化：calc((100% - 20px) / 2)（括号即可，无需嵌套 calc）\n` +
                `\n` +
                `【与 var() 协同】\n` +
                `  calc() 可与 var() 配合：calc(var(--gap) * 2)\n` +
                `  :root { --gap: 10px; }\n` +
                `  .box { padding: calc(var(--gap) * 2); }  /* 20px */\n` +
                `  实现 CSS 变量的数学运算\n` +
                `\n` +
                `【浏览器解析时机】\n` +
                `  calc() 在浏览器渲染时计算（非预编译）\n` +
                `  因此可使用运行时值（如 100% 相对父元素）\n` +
                `  与 JS 的区别：JS 在脚本执行时计算，calc() 在渲染时计算\n` +
                `\n` +
                `【当前演示元素】\n` +
                `  .calc-box { width: calc(${this._calcExpr}); }\n` +
                `    width 计算值="${computed}"\n` +
                `  CSS.supports('width','calc(100% - 20px)') = ${f.calc}\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  /* 全屏减固定导航 */\n` +
                `  .main {\n` +
                `    height: calc(100vh - 60px);  /* 视窗高度 - 导航高度 */\n` +
                `    width: calc(100% - 20px);   /* 父宽度 - 边距 */\n` +
                `  }\n` +
                `\n` +
                `  /* 与 var() 协同 */\n` +
                `  :root { --sidebar-width: 200px; }\n` +
                `  .content {\n` +
                `    margin-inline-start: calc(var(--sidebar-width) + 20px);\n` +
                `  }\n` +
                `\n` +
                `  /* 嵌套 calc()（或用括号）*/\n` +
                `  .nested {\n` +
                `    width: calc(calc(100% - 20px) / 2);\n` +
                `    /* 等价：width: calc((100% - 20px) / 2); */\n` +
                `  }\n` +
                `\n` +
                `【⚠ 空格陷阱】\n` +
                `  calc(100%-20px)    ❌ 错误（- 前后无空格，解析为无效）\n` +
                `  calc(100% - 20px)  ✓ 正确（- 前后有空格）\n` +
                `  calc(100%+20px)    ❌ 错误（+ 前后无空格）\n` +
                `  calc(100% + 20px)  ✓ 正确\n` +
                `  原因：+/- 可能被解析为正负号（如 calc(-5px) 是负值）\n` +
                `  */ 不要求空格：calc(2*3px) 和 calc(10px/2) 均可`;
        }
        catch (err) {
            return `读取 calc() 信息失败：${err.name} - ${err.message}`;
        }
    }
    _setCalc(expr) {
        this._calcExpr = expr;
        this._injectStyle('css-calc-dynamic', `.calc-box { width: calc(${expr}); }`);
        this.setState({ calcInfo: this._readCalcInfo() });
        this._addLog('calc', `切换 calc 表达式 → calc(${expr})`);
    }
    _renderCard4() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '4. calc() 与嵌套 —— 单位混合计算 / var() 协同',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['calc', f.calc]]), h(Tag, { color: 'primary' }, '四则运算')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'calc() 支持四则运算（+ - * /）与单位混合计算（calc(100% - 20px)、calc(50vw + 10em)）。⚠ + 和 - 前后必须有空格（calc(100%-20px) 错误，calc(100% - 20px) 正确），* 和 / 不要求空格。可嵌套 calc() 或用括号（calc((100% - 20px) / 2)）。与 var() 协同实现 CSS 变量数学运算（calc(var(--gap) * 2)）。浏览器渲染时计算（非预编译），可使用运行时值如 100%。全浏览器支持（Chrome 19+ / Firefox 16+ / Safari 6+）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ calcInfo: this._readCalcInfo() }) }), this._btn('100% - 20px', { size: 'sm', disabled: !f.calc, onClick: () => this._setCalc('100% - 20px') }), this._btn('50vw + 10em', { size: 'sm', disabled: !f.calc, onClick: () => this._setCalc('50vw + 10em') }), this._btn('100% / 3', { size: 'sm', disabled: !f.calc, onClick: () => this._setCalc('100% / 3') })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, 'calc() 演示（当前 calc(' + this._calcExpr + ')）：'),
                h('div', { class: 'calc-stage' }, h('div', { class: 'calc-box' }, 'width: calc(' + this._calcExpr + ')\n（真实浏览器查看计算后宽度）')),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.calcInfo || '（点击按钮切换 calc 表达式查看说明）')),
                h(Alert, {
                    type: 'warning',
                    message: 'calc() 内 + 和 - 前后必须有空格，* 和 / 不要求',
                    description: 'calc(100%-20px) 错误（- 前后无空格解析为无效），calc(100% - 20px) 正确。原因：+/- 可能被解析为正负号。*/ 不要求空格。可嵌套 calc() 或用括号。与 var() 协同实现 CSS 变量数学运算。渲染时计算可使用运行时值如 100%。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 5：min()/max()/clamp() ===================
    _readMinMaxClampInfo() {
        const f = this._flags();
        try {
            const box = this.el && this.el.querySelector('.clamp-box');
            let computedW = '(未渲染)';
            let computedFs = '(未渲染)';
            if (box) {
                const cs = window.getComputedStyle(box);
                computedW = cs.getPropertyValue('width') || '(空)';
                computedFs = cs.getPropertyValue('font-size') || '(空)';
            }
            return `===== min() / max() / clamp() =====\n` +
                `\n` +
                `【min() 语法】\n` +
                `  min(<value>, <value>, ...)  返回最小值\n` +
                `  示例：min(100vw, 500px)\n` +
                `    视窗 < 500px 时取 100vw，视窗 >= 500px 时取 500px\n` +
                `  适合：限制最大宽度（响应式防过宽）\n` +
                `\n` +
                `【max() 语法】\n` +
                `  max(<value>, <value>, ...)  返回最大值\n` +
                `  示例：max(100px, 10vw)\n` +
                `    视窗 < 1000px 时取 100px，视窗 >= 1000px 时取 10vw\n` +
                `  适合：保证最小宽度（响应式防过小）\n` +
                `\n` +
                `【clamp() 语法】\n` +
                `  clamp(<min>, <preferred>, <max>)\n` +
                `  返回 preferred，但限制在 [min, max] 范围内\n` +
                `  示例：clamp(100px, 50vw, 500px)\n` +
                `    50vw < 100px 时取 100px（最小）\n` +
                `    100px <= 50vw <= 500px 时取 50vw（首选）\n` +
                `    50vw > 500px 时取 500px（最大）\n` +
                `  适合：响应式字体大小、流式布局\n` +
                `\n` +
                `【响应式字体大小】\n` +
                `  font-size: clamp(14px, 2vw, 20px)\n` +
                `    小屏取 14px（最小可读）\n` +
                `    中屏取 2vw（流式缩放）\n` +
                `    大屏取 20px（最大不超）\n` +
                `  替代 @media 查询，更简洁\n` +
                `\n` +
                `【流式布局】\n` +
                `  width: clamp(300px, 80vw, 1200px)\n` +
                `    小屏 300px，中屏 80vw，大屏 1200px\n` +
                `  margin: max(20px, 5vw)\n` +
                `    保证最小 20px 边距\n` +
                `\n` +
                `【当前演示元素】\n` +
                `  .clamp-box {\n` +
                `    width: clamp(${this._clampExpr});\n` +
                `    font-size: clamp(14px, 2vw, 20px);\n` +
                `  }\n` +
                `    width 计算值="${computedW}"\n` +
                `    font-size 计算值="${computedFs}"\n` +
                `  CSS.supports('width','min(100vw, 500px)') = ${f.min}\n` +
                `  CSS.supports('width','max(100px, 10vw)') = ${f.max}\n` +
                `  CSS.supports('width','clamp(100px, 50vw, 500px)') = ${f.clamp}\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  /* 响应式字体 */\n` +
                `  h1 { font-size: clamp(24px, 5vw, 48px); }\n` +
                `  p { font-size: clamp(14px, 2vw, 18px); }\n` +
                `\n` +
                `  /* 流式容器 */\n` +
                `  .container {\n` +
                `    width: clamp(300px, 90vw, 1200px);\n` +
                `    margin-inline: auto;\n` +
                `    padding: clamp(10px, 3vw, 30px);\n` +
                `  }\n` +
                `\n` +
                `  /* 响应式间距 */\n` +
                `  .grid {\n` +
                `    gap: max(10px, 2vw);\n` +
                `    grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr));\n` +
                `  }\n` +
                `\n` +
                `【min/max 与媒体查询取舍】\n` +
                `  min/max/clamp 优势：\n` +
                `    ✓ 更简洁（无需多个 @media 断点）\n` +
                `    ✓ 流式过渡（无突变）\n` +
                `    ✓ 浏览器自动计算\n` +
                `  媒体查询优势：\n` +
                `    ✓ 可改变多个属性（min/max 仅单值）\n` +
                `    ✓ 可改变结构（如 grid 列数）\n` +
                `    ✓ 兼容性更好（IE9+）\n` +
                `  建议：单值响应式用 clamp，多属性变化用 @media`;
        }
        catch (err) {
            return `读取 min/max/clamp 信息失败：${err.name} - ${err.message}`;
        }
    }
    _setClamp(expr) {
        this._clampExpr = expr;
        this._injectStyle('css-clamp-dynamic', `.clamp-box { width: clamp(${expr}); }`);
        this.setState({ minMaxClampInfo: this._readMinMaxClampInfo() });
        this._addLog('clamp', `切换 clamp 表达式 → clamp(${expr})`);
    }
    _renderCard5() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '5. min() / max() / clamp() —— 响应式字体与流式布局',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['min', f.min], ['max', f.max], ['clamp', f.clamp]]), h(Tag, { color: 'primary' }, '极值函数')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'min(<v1>, <v2>, ...) 返回最小值（限制最大宽度），max(<v1>, <v2>, ...) 返回最大值（保证最小宽度），clamp(<min>, <preferred>, <max>) 限制首选值在 [min, max] 范围。响应式字体大小：font-size: clamp(14px, 2vw, 20px) 小屏 14px/中屏 2vw/大屏 20px，替代 @media 查询更简洁。流式布局：width: clamp(300px, 80vw, 1200px)。与媒体查询取舍：单值响应式用 clamp（流式无突变），多属性变化用 @media。浏览器支持：Chrome 79+ / Firefox 75+ / Safari 13.1+。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ minMaxClampInfo: this._readMinMaxClampInfo() }) }), this._btn('100px, 50vw, 500px', { size: 'sm', disabled: !f.clamp, onClick: () => this._setClamp('100px, 50vw, 500px') }), this._btn('200px, 80vw, 800px', { size: 'sm', disabled: !f.clamp, onClick: () => this._setClamp('200px, 80vw, 800px') })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, 'clamp() 演示（width: clamp(' + this._clampExpr + '), font-size: clamp(14px, 2vw, 20px)）：'),
                h('div', { class: 'clamp-stage' }, h('div', { class: 'clamp-box' }, '响应式宽度 + 字体\nwidth: clamp(' + this._clampExpr + ')\nfont-size: clamp(14px, 2vw, 20px)\n（缩放浏览器窗口观察变化）')),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.minMaxClampInfo || '（点击按钮切换 clamp 表达式查看说明）')),
                h(Alert, {
                    type: 'info',
                    message: 'clamp(min, preferred, max) 实现响应式字体/布局，替代部分 @media',
                    description: 'min() 返回最小值（限制最大宽度），max() 返回最大值（保证最小宽度），clamp(min, preferred, max) 限制首选值范围。响应式字体 font-size: clamp(14px, 2vw, 20px) 替代 @media。单值响应式用 clamp（流式无突变），多属性变化用 @media。Chrome 79+ / Firefox 75+ / Safari 13.1+。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 6：数学函数全集 ===================
    _readMathFunctionsInfo() {
        const f = this._flags();
        try {
            return `===== CSS 数学函数全集（CSS Values L4）=====\n` +
                `\n` +
                `【1. abs() —— 绝对值】\n` +
                `  abs(<value>)  返回绝对值\n` +
                `  示例：abs(-10px) = 10px\n` +
                `\n` +
                `【2. sign() —— 符号函数】\n` +
                `  sign(<value>)  返回 -1 / 0 / 1\n` +
                `  示例：sign(-5px) = -1, sign(0) = 0, sign(5px) = 1\n` +
                `\n` +
                `【3. round() —— 四舍五入】\n` +
                `  round(<mode>, <value>, <step>)\n` +
                `  mode: down / up / to-zero / nearest（默认）\n` +
                `  示例：round(2.5px, 1px) = 3px（nearest 默认）\n` +
                `        round(down, 2.5px, 1px) = 2px\n` +
                `        round(up, 2.1px, 1px) = 3px\n` +
                `        round(to-zero, -2.5px, 1px) = -2px\n` +
                `\n` +
                `【4. mod() —— 取模】\n` +
                `  mod(<value>, <divisor>)  返回模（结果符号同除数）\n` +
                `  示例：mod(10px, 3px) = 1px\n` +
                `        mod(-10px, 3px) = 2px（符号同除数）\n` +
                `\n` +
                `【5. rem() —— 取余】\n` +
                `  rem(<value>, <divisor>)  返回余数（结果符号同被除数）\n` +
                `  示例：rem(10px, 3px) = 1px\n` +
                `        rem(-10px, 3px) = -1px（符号同被除数）\n` +
                `  mod 与 rem 区别：负数处理不同\n` +
                `\n` +
                `【6. 三角函数 sin() / cos() / tan()】\n` +
                `  sin(<angle>)  返回正弦值（-1 到 1）\n` +
                `  cos(<angle>)  返回余弦值（-1 到 1）\n` +
                `  tan(<angle>)  返回正切值\n` +
                `  示例：sin(0deg) = 0, sin(90deg) = 1, sin(45deg) ≈ 0.707\n` +
                `        cos(0deg) = 1, cos(90deg) = 0\n` +
                `  单位：角度 deg / rad / turn / grad\n` +
                `\n` +
                `【7. 反三角函数 asin() / acos() / atan() / atan2()】\n` +
                `  asin(<number>)  返回反正弦（角度）\n` +
                `  acos(<number>)  返回反余弦\n` +
                `  atan(<number>)  返回反正切\n` +
                `  atan2(<y>, <x>)  返回反正切（两参数，确定象限）\n` +
                `  示例：asin(1) = 90deg, acos(0) = 90deg, atan(1) = 45deg\n` +
                `\n` +
                `【8. 幂函数 pow() / sqrt() / hypot()】\n` +
                `  pow(<base>, <exp>)  返回 base 的 exp 次幂\n` +
                `  sqrt(<value>)       返回平方根\n` +
                `  hypot(<v1>, <v2>, ...)  返回欧几里得范数（sqrt(v1²+v2²+...)）\n` +
                `  示例：pow(2, 3) = 8, sqrt(16) = 4, hypot(3, 4) = 5\n` +
                `\n` +
                `【9. 指数对数 exp() / log()】\n` +
                `  exp(<value>)  返回 e 的 value 次幂\n` +
                `  log(<value>, <base>?)  返回对数（默认自然对数 ln）\n` +
                `  示例：exp(0) = 1, exp(1) = e ≈ 2.718\n` +
                `        log(e) = 1, log(100, 10) = 2\n` +
                `\n` +
                `【能力检测】\n` +
                `  CSS.supports('width','round(2.5px, 1px)') = ${f.round}\n` +
                `  CSS.supports('width','mod(10px, 3px)') = ${f.mod}\n` +
                `  CSS.supports('transform','rotate(sin(45deg))') = ${f.sin}\n` +
                `  CSS.supports('width','pow(2px, 2)') = ${f.pow}\n` +
                `\n` +
                `【完整代码示例】\n` +
                `  /* 取模实现循环 */\n` +
                `  .cyclic {\n` +
                `    animation-delay: calc(mod(var(--i), 4) * 0.1s);\n` +
                `  }\n` +
                `\n` +
                `  /* 三角函数圆周运动 */\n` +
                `  .planet {\n` +
                `    transform:\n` +
                `      translate(calc(cos(var(--angle)) * 80px), calc(sin(var(--angle)) * 80px));\n` +
                `  }\n` +
                `\n` +
                `  /* 幂函数缩放 */\n` +
                `  .scaled {\n` +
                `    transform: scale(pow(2, var(--level)));\n` +
                `  }\n` +
                `\n` +
                `【浏览器支持】\n` +
                `  abs/sign/round/mod/rem/sin/cos/tan/pow/sqrt/hypot/exp/log\n` +
                `    Chrome 113+ / Firefox 113+ / Safari 16.4+（CSS Values L4，较新）\n` +
                `  老浏览器不支持，需 JS 辅助计算`;
        }
        catch (err) {
            return `读取数学函数全集信息失败：${err.name} - ${err.message}`;
        }
    }
    _renderCard6() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '6. 数学函数全集 —— abs/sign/round/mod/rem/sin/cos/tan/pow/sqrt/exp/log',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['round', f.round], ['mod', f.mod], ['sin', f.sin], ['pow', f.pow]]), h(Tag, { color: 'primary' }, 'CSS Values L4')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'CSS Values L4 数学函数全集：abs()（绝对值）、sign()（符号 -1/0/1）、round(mode, value, step)（四舍五入 down/up/to-zero/nearest）、mod()（取模，符号同除数）、rem()（取余，符号同被除数）、sin()/cos()/tan()（三角函数，角度 deg/rad/turn）、asin()/acos()/atan()/atan2()（反三角）、pow(base, exp)/sqrt()/hypot()（幂函数）、exp()/log()（指数对数）。让 CSS 具备完整数学计算能力，无需 JS 辅助。浏览器支持：Chrome 113+ / Firefox 113+ / Safari 16.4+ 较新。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取数学函数信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ mathFunctionsInfo: this._readMathFunctionsInfo() }) })),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.mathFunctionsInfo || '（点击按钮查看 CSS Values L4 数学函数全集）')),
                h(Alert, {
                    type: 'info',
                    message: 'CSS Values L4 让 CSS 具备完整数学计算能力（三角/幂/对数）',
                    description: '数学函数全集：abs/sign/round/mod/rem（基础运算）、sin/cos/tan/asin/acos/atan/atan2（三角函数）、pow/sqrt/hypot（幂函数）、exp/log（指数对数）。让 CSS 无需 JS 即可计算复杂表达式。浏览器支持 Chrome 113+ / Firefox 113+ / Safari 16.4+ 较新，老浏览器需 JS 辅助。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 7：数学函数实战 ===================
    _readPracticeInfo() {
        const f = this._flags();
        try {
            return `===== 数学函数实战 =====\n` +
                `\n` +
                `【场景 1：圆周运动 transform: rotate + translate】\n` +
                `  用 sin/cos 计算圆周位置\n` +
                `  @keyframes orbit {\n` +
                `    from { --angle: 0deg; }\n` +
                `    to { --angle: 360deg; }\n` +
                `  }\n` +
                `  .planet {\n` +
                `    --angle: 0deg;\n` +
                `    transform:\n` +
                `      translate(calc(cos(var(--angle)) * 80px), calc(sin(var(--angle)) * 80px));\n` +
                `    animation: orbit 4s linear infinite;\n` +
                `  }\n` +
                `  需要 @property 注册 --angle 为 <angle> 类型（否则不插值）\n` +
                `\n` +
                `【场景 2：弹簧动画】\n` +
                `  用 sin 实现衰减振荡\n` +
                `  @keyframes spring {\n` +
                `    0% { transform: translateX(0); }\n` +
                `    100% { transform: translateX(calc(sin(var(--t) * 8) * exp(calc(-1 * var(--t))) * 20px)); }\n` +
                `  }\n` +
                `  sin(8t) * exp(-t) 实现衰减振荡\n` +
                `\n` +
                `【场景 3：复杂路径】\n` +
                `  用三角函数计算 Lissajous 曲线\n` +
                `  transform:\n` +
                `    translate(\n` +
                `      calc(sin(var(--t) * 3) * 100px),\n` +
                `      calc(sin(var(--t) * 2) * 80px)\n` +
                `    );\n` +
                `  产生 3:2 Lissajous 图案\n` +
                `\n` +
                `【场景 4：SVG path 与 CSS math】\n` +
                `  SVG path 可用 CSS 变量 + calc() 计算\n` +
                `  <path d="M calc(var(--x)) calc(var(--y)) L ..." />\n` +
                `  ⚠ 部分浏览器对 SVG path 的 CSS math 支持有限\n` +
                `\n` +
                `【场景 5：响应式设计】\n` +
                `  用 clamp + calc 计算响应式尺寸\n` +
                `  .card {\n` +
                `    width: clamp(200px, calc(100% / 3 - 20px), 400px);\n` +
                `    padding: clamp(10px, calc(2vw + 5px), 30px);\n` +
                `  }\n` +
                `\n` +
                `【场景 6：计算复杂布局】\n` +
                `  用 min/max/clamp + mod 计算网格列数\n` +
                `  .grid {\n` +
                `    --cols: clamp(2, calc(floor(calc(100vw / 200px))), 6);\n` +
                `    grid-template-columns: repeat(var(--cols), 1fr);\n` +
                `  }\n` +
                `\n` +
                `【能力检测】\n` +
                `  sin/cos 支持 = ${f.sin}\n` +
                `  pow 支持 = ${f.pow}\n` +
                `  calc 支持 = ${f.calc}\n` +
                `\n` +
                `【完整代码示例：圆周运动】\n` +
                `  @property --angle {\n` +
                `    syntax: '<angle>';\n` +
                `    initial-value: 0deg;\n` +
                `    inherits: false;\n` +
                `  }\n` +
                `  .orbit-container {\n` +
                `    position: relative;\n` +
                `    width: 200px;\n` +
                `    height: 200px;\n` +
                `  }\n` +
                `  .planet {\n` +
                `    --angle: 0deg;\n` +
                `    position: absolute;\n` +
                `    top: 50%;\n` +
                `    left: 50%;\n` +
                `    transform:\n` +
                `      translate(-50%, -50%)\n` +
                `      translate(calc(cos(var(--angle)) * 80px), calc(sin(var(--angle)) * 80px));\n` +
                `    animation: orbit 4s linear infinite;\n` +
                `  }\n` +
                `  @keyframes orbit {\n` +
                `    to { --angle: 360deg; }\n` +
                `  }`;
        }
        catch (err) {
            return `读取数学函数实战信息失败：${err.name} - ${err.message}`;
        }
    }
    _runPracticeDemo() {
        this.setState({ practiceInfo: this._readPracticeInfo() });
        this._addLog('practice', `数学函数实战演示：sin=${this._flags().sin}, calc=${this._flags().calc}`);
    }
    _renderCard7() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '7. 数学函数实战 —— 圆周运动 / 弹簧 / 复杂路径 / 响应式 / 复杂布局',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['sin/cos', f.sin], ['pow', f.pow], ['calc', f.calc]]), h(Tag, { color: 'primary' }, '6 大场景')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '数学函数六大实战场景：圆周运动（transform: translate(calc(cos(angle) * r), calc(sin(angle) * r))，需 @property 注册 angle 为 <angle> 才能动画插值）、弹簧动画（sin(8t) * exp(-t) 衰减振荡）、复杂路径（Lissajous 曲线 sin(3t)/sin(2t)）、SVG path 与 CSS math（部分浏览器有限）、响应式设计（clamp + calc）、计算复杂布局（clamp + floor 计算网格列数）。配合 @property 注册自定义属性类型实现动画插值。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('读取实战信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runPracticeDemo() })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '圆周运动演示（transform: translate(calc(cos*sin) * 80px)，真实浏览器查看动画）：'),
                h('div', { class: 'math-stage' }, h('div', { class: 'orbit-container' }, h('div', { class: 'orbit-center' }, ''), h('div', { class: 'orbit-planet' }, '')), h('div', { class: 'fs-sm', style: { textAlign: 'center', marginTop: '8px' } }, '中心点 + 行星（真实浏览器中行星绕中心圆周运动）')),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } }, h('code', {}, s.practiceInfo || '（点击按钮查看 6 大数学函数实战场景完整代码）')),
                h(Alert, {
                    type: 'info',
                    message: '圆周运动用 sin/cos + @property 注册 angle 实现动画插值',
                    description: '圆周运动：transform: translate(calc(cos(var(--angle)) * 80px), calc(sin(var(--angle)) * 80px))。需 @property --angle { syntax: "<angle>"; } 注册才能动画插值。弹簧用 sin(8t)*exp(-t) 衰减振荡。Lissajous 曲线 sin(3t)/sin(2t)。配合 clamp/calc 实现响应式。Chrome 113+ / Firefox 113+ 支持。',
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
            return `===== CSS Easing + Math Functions 陷阱与最佳实践 =====\n` +
                `\n` +
                `【陷阱 1：calc() 内运算符前后必须空格】\n` +
                `  calc(100% - 20px)  ✓ 正确（- 前后有空格）\n` +
                `  calc(100%-20px)    ❌ 错误（- 前后无空格，解析为无效）\n` +
                `  calc(100%+20px)    ❌ 错误（+ 前后无空格）\n` +
                `  calc(2*3px)        ✓ 正确（* 不要求空格）\n` +
                `  calc(10px/2)       ✓ 正确（/ 不要求空格）\n` +
                `  原因：+/- 可能被解析为正负号（如 calc(-5px) 是负值）\n` +
                `  最佳实践：所有运算符前后都加空格（避免混淆）\n` +
                `\n` +
                `【陷阱 2：min/max 与媒体查询取舍】\n` +
                `  min/max/clamp 优势：\n` +
                `    ✓ 单值响应式更简洁（无需多个断点）\n` +
                `    ✓ 流式过渡（无突变）\n` +
                `  媒体查询优势：\n` +
                `    ✓ 可改变多个属性（min/max 仅单值）\n` +
                `    ✓ 可改变结构（如 grid 列数）\n` +
                `    ✓ 兼容性更好（IE9+）\n` +
                `  建议：单值响应式用 clamp，多属性变化用 @media\n` +
                `\n` +
                `【陷阱 3：性能考虑（动画中 calc）】\n` +
                `  动画中使用 calc() 可能影响性能：\n` +
                `    每帧都需重新计算 calc 表达式\n` +
                `    复杂嵌套 calc 增加计算开销\n` +
                `  建议：\n` +
                `    1. 动画属性尽量用固定值（非 calc）\n` +
                `    2. 必须用 calc 时简化表达式\n` +
                `    3. 用 will-change 提示浏览器优化\n` +
                `    4. 优先用 transform/opacity（GPU 加速）\n` +
                `\n` +
                `【陷阱 4：浏览器降级】\n` +
                `  cubic-bezier/steps/calc —— 全浏览器支持，无需降级\n` +
                `  min/max/clamp —— Chrome 79+ / Firefox 75+ / Safari 13.1+\n` +
                `    降级：用 @media 查询替代\n` +
                `  linear/round/mod/sin/pow 等 —— Chrome 113+ / Firefox 113+ / Safari 16.4+\n` +
                `    降级：用 JS 计算或 @media 查询\n` +
                `  检测：CSS.supports('width', 'clamp(100px, 50vw, 500px)')\n` +
                `\n` +
                `【陷阱 5：DevTools 调试】\n` +
                `  Chrome DevTools：\n` +
                `    Elements → Computed → 查看 calc/min/max/clamp 计算后值\n` +
                `    Animations 面板 → 查看缓动曲线可视化\n` +
                `    可调试 cubic-bezier 控制点（图形化编辑）\n` +
                `  Firefox DevTools：\n` +
                `    更强大：显示 calc 计算过程\n` +
                `    Animations 面板支持缓动曲线编辑\n` +
                `\n` +
                `【陷阱 6：与 @property 协同】\n` +
                `  CSS 自定义属性默认无类型，无法动画插值\n` +
                `  用 @property 注册类型：\n` +
                `    @property --angle {\n` +
                `      syntax: '<angle>';\n` +
                `      initial-value: 0deg;\n` +
                `      inherits: false;\n` +
                `    }\n` +
                `  注册后 --angle 可在 animation 中插值\n` +
                `  配合 sin/cos 实现圆周运动\n` +
                `  @property 支持：Chrome 85+ / Firefox 128+ / Safari 16.4+\n` +
                `\n` +
                `【陷阱 7：sin/cos 单位】\n` +
                `  sin/cos/tan 接受角度参数：deg / rad / turn / grad\n` +
                `  示例：sin(45deg) / sin(0.785rad) / sin(0.125turn) / sin(50grad)\n` +
                `  均等价 sin(45deg) ≈ 0.707\n` +
                `  返回值是无单位数字（-1 到 1）\n` +
                `  需乘以长度才能用于位置：calc(sin(45deg) * 80px)\n` +
                `\n` +
                `【最佳实践清单】\n` +
                `  ✓ calc() 内 +/- 前后必须空格（*/ 可省略）\n` +
                `  ✓ 单值响应式用 clamp，多属性变化用 @media\n` +
                `  ✓ 动画中尽量用固定值，必须用 calc 时简化\n` +
                `  ✓ 优先用 transform/opacity（GPU 加速）\n` +
                `  ✓ 检测浏览器支持：CSS.supports()\n` +
                `  ✓ 老浏览器用 @media 或 JS 降级\n` +
                `  ✓ 用 @property 注册自定义属性类型实现动画插值\n` +
                `  ✓ sin/cos 返回无单位数字，需乘以长度\n` +
                `  ✓ DevTools 调试 calc 计算值与缓动曲线\n` +
                `  ✓ 圆周运动用 transform + calc(sin/cos) + @property\n` +
                `\n` +
                `  calc 支持 = ${f.calc}\n` +
                `  clamp 支持 = ${f.clamp}\n` +
                `  sin 支持 = ${f.sin}\n` +
                `  pow 支持 = ${f.pow}`;
        }
        catch (err) {
            return `读取陷阱与最佳实践信息失败：${err.name} - ${err.message}`;
        }
    }
    _runPitfallsDemo() {
        this.setState({ pitfallsInfo: this._readPitfallsInfo() });
        this._addLog('pitfalls', `陷阱与最佳实践演示：calc=${this._flags().calc}, sin=${this._flags().sin}`);
    }
    _renderCard8() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '8. 陷阱与最佳实践 —— 空格 / min vs @media / 性能 / @property / DevTools',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['calc', f.calc], ['clamp', f.clamp], ['sin', f.sin]]), h(Tag, { color: 'warning' }, '7 大陷阱')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '七大陷阱：calc() 内 +/- 前后必须空格（*/ 可省略，原因 +/- 可能被解析为正负号）、min/max 与媒体查询取舍（单值用 clamp，多属性用 @media）、性能考虑（动画中 calc 每帧重算，简化表达式 + 用 transform/opacity GPU 加速）、浏览器降级（cubic-bezier/calc 全支持，clamp Chrome 79+，sin/pow Chrome 113+，老浏览器用 @media/JS 降级）、DevTools 调试（Chrome/Firefox Computed 查看 calc 值，Animations 面板编辑缓动曲线）、与 @property 协同（注册自定义属性类型实现动画插值，如圆周运动 --angle）、sin/cos 单位（接受 deg/rad/turn/grad，返回无单位数字需乘长度）。10 条最佳实践覆盖空格/响应式/性能/降级/调试。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行陷阱与最佳实践演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runPitfallsDemo() })),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } }, h('code', {}, s.pitfallsInfo || '（点击按钮查看 7 大陷阱与 10 条最佳实践完整说明）')),
                h(Alert, {
                    type: 'warning',
                    message: 'calc() 内 +/- 必须空格；动画中 calc 影响性能；@property 注册类型才能插值',
                    description: '陷阱清单：calc +/- 前后必须空格（*/ 可省略）、min/max vs @media 取舍（单值 clamp/多属性 @media）、动画 calc 性能（简化 + transform/opacity GPU）、浏览器降级（CSS.supports 检测 + @media/JS 兜底）、DevTools 调试（Computed + Animations）、@property 注册自定义属性类型（圆周运动 --angle）、sin/cos 单位（deg/rad 返回无单位数字需乘长度）。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 9：CSS random() 随机函数 ===================
    _runRandomDemo() {
        const f = this._flags();
        const info = 'CSS random() 随机函数完整说明：\n\n' +
            '【标准】CSS Values and Units Module Level 5（Editor\'s Draft，2024-2025）。\n' +
            '【浏览器支持】实验性：Chrome behind flag / Safari 部分实验 / Firefox 未实现；jsdom 不识别。\n\n' +
            '【核心函数】\n' +
            '  1. random()：返回指定范围内的随机值\n' +
            '     语法：random( <custom-ident>?, <calc-sum>, <calc-sum>, by <calc-sum>? )\n' +
            '     - 第 1 参数（可选）：custom-ident 作为种子（相同种子在同一计算中产生相同值）\n' +
            '     - 第 2 参数：from（最小值）\n' +
            '     - 第 3 参数：to（最大值）\n' +
            '     - 第 4 参数（可选，by 前缀）：步长（结果为步长的整数倍）\n' +
            '  2. random-item()：从列表中随机选取一个值\n' +
            '     语法：random-item( <custom-ident>?, <calc-sum># )\n\n' +
            '【用法示例】\n' +
            '  /* 随机宽度 100px ~ 500px */\n' +
            '  .box { width: random(100px, 500px); }\n\n' +
            '  /* 带种子的随机（同一种子 = 同一计算中相同值）*/\n' +
            '  .box { width: random(--my-seed, 100px, 500px); }\n\n' +
            '  /* 带步长的随机（0, 10, 20, ..., 100）*/\n' +
            '  .box { width: random(0px, 100px, by 10px); }\n\n' +
            '  /* 从列表随机选取颜色 */\n' +
            '  .box { color: random-item(--seed, red, green, blue); }\n\n' +
            '  /* 每个元素不同随机值（用 --n 变量）*/\n' +
            '  .box { --n: random(1, 100); width: calc(var(--n) * 1%); }\n\n' +
            '【与 Math.random() 对比】\n' +
            '  CSS random()：声明式，写在样式表中，浏览器渲染时计算，值在单次渲染中稳定（同一元素同一值）。\n' +
            '  Math.random()：命令式，JS 运行时调用，每次不同，需手动设置 inline style。\n' +
            '  优势：CSS random() 无需 JS，适合纯 CSS 生成艺术 / 粒子效果 / 随机布局。\n\n' +
            '【典型场景】\n' +
            '  - 生成艺术（Generative Art）：随机大小/颜色/位置生成独特图案。\n' +
            '  - 粒子效果：多个元素随机偏移，纯 CSS 动画。\n' +
            '  - 随机布局：瀑布流卡片随机高度，避免模板感。\n' +
            '  - A/B 测试样式：不同用户看到不同视觉变体（需种子）。\n\n' +
            '【能力检测】\n' +
            "  CSS.supports('width', 'random(0px, 100px)')   // random()\n" +
            "  CSS.supports('width', 'random-item(--s, 10px, 20px)')   // random-item()\n\n" +
            '【注意事项】\n' +
            '  - random() 为 Level 5 草案，API 可能变化，生产环境需降级。\n' +
            '  - 种子（custom-ident）保证同一计算中相同值，但不同渲染周期可能不同。\n' +
            '  - by 步长：结果为 from + n * step，n 为随机整数。\n' +
            '  - random-item() 列表至少 2 项，否则无意义。\n' +
            '  - 降级方案：用 Math.random() + CSS 自定义属性（--var）+ inline style 实现。';
        this.setState({ randomInfo: info });
        this._addLog('practice', `random() 演示：random=${f.random}, randomItem=${f.randomItem}`);
    }
    _renderCard9() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '9. CSS random() —— 声明式随机数生成（CSS Values L5 草案）',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['random()', f.random], ['random-item()', f.randomItem]]), h(Tag, { color: 'warning' }, 'L5 草案')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'CSS random() 是 CSS Values and Units Module Level 5（草案）引入的随机数函数，包含 random(from, to) 与 random-item(list) 两种形式。支持可选种子（custom-ident）保证同一计算中相同值，by 步长限定结果为整数倍。与 Math.random() 相比，random() 是声明式的，写在样式表中无需 JS，适合生成艺术、粒子效果、随机布局。浏览器支持：Chrome behind flag / Safari 部分实验 / Firefox 未实现；jsdom 不识别，能力检测返回 false。生产环境需用 Math.random() + CSS 自定义属性降级。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 random() 演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runRandomDemo() })),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, 'random() / random-item() 用法与场景：'),
                h('div', { class: 'fn-stage' }, h('div', { class: 'fs-sm', style: { marginBottom: '6px' } }, '示例：random() 生成随机宽度（真实浏览器 behind flag 可用，jsdom 仅展示用法）：'), h('div', { class: 'calc-stage' }, h('div', { class: 'fs-sm' }, 'width: random(100px, 500px)  // 100~500px 随机宽度'), h('div', { class: 'fs-sm', style: { marginTop: '4px' } }, 'color: random-item(--seed, #ef4444, #3b82f6, #10b981)  // 随机颜色'))),
                h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } }, h('code', {}, s.randomInfo || '（点击按钮查看 random() / random-item() 完整说明）')),
                h(Alert, {
                    type: 'warning',
                    message: 'random() 为 CSS Values L5 草案，Chrome behind flag / Firefox 未实现；生产环境需降级',
                    description: 'random() 返回 from~to 范围内的随机值；可选 custom-ident 种子保证同一计算中相同值；by 步长限定结果为整数倍。random-item() 从列表随机选取。降级方案：Math.random() + CSS 自定义属性（--var）+ inline style。注意：草案 API 可能变化，jsdom 不识别，能力检测返回 false。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== 日志面板（按时间倒序，最新在上）===================
    _renderLogPanel() {
        const s = this.state;
        const reversed = [...s.logs].reverse(); // 按时间倒序：最新日志在最上方
        return h('div', { class: 'log-panel' }, h('div', { class: 'log-panel__header' }, '事件日志（按时间倒序）', h(Tag, { color: 'primary' }, `${s.logs.length} 条`)), reversed.length === 0
            ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
            : reversed.map((log) => h('div', { class: 'log-panel__line' }, h('span', { class: 'log-panel__time' }, log.time), h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type), h('span', { class: 'log-panel__content' }, log.content))));
    }
    // =================== 整页渲染 ===================
    render() {
        const s = this.state;
        return h('div', { class: 'api-lab-page css-functions-deep-page' }, h('h2', { class: 'section-title' }, 'CSS Easing + Math Functions 实验室'), h('p', { class: 'fs-sm text-secondary mb-md' }, '本页演示 CSS Easing Functions Level 1 + CSS Values and Units Level 4：cubic-bezier() 与 steps()（贝塞尔曲线 + 阶梯动画 + ease 关键字）、linear() 自定义缓动（任意分段线性 + 弹簧回弹）、calc() 与嵌套（单位混合 + var() 协同 + 空格陷阱）、min()/max()/clamp()（响应式字体 + 流式布局）、数学函数全集（abs/sign/round/mod/rem/sin/cos/tan/pow/sqrt/exp/log）、数学函数实战（圆周运动 + 弹簧 + Lissajous + @property 协同）、陷阱与最佳实践（空格 / min vs @media / 性能 / 降级 / DevTools / sin 单位）。所有特性通过 typeof / CSS.supports 能力检测，不可用时仅记日志，绝不抛异常。'), s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderCard7(), this._renderCard8(), this._renderCard9(), this._renderLogPanel());
    }
}
//# sourceMappingURL=CSSFunctionsDeepPage.js.map