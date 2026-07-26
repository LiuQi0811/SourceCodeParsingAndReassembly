// =====================================================================
// CSSWritingModesPage.js —— CSS Writing Modes Level 3/4 完整实验室
// 演示 W3C CSS Writing Modes Module Level 3/4 书写模式特性：
//   1. 概述与动机：水平 vs 垂直排版 / LTR vs RTL / CJK（中日韩）竖排需求 /
//      阿拉伯/希伯来 RTL / 蒙古文竖排 / CSS Writing Modes Level 3/4 标准 /
//      浏览器支持 Chrome 48+ / Firefox 41+ / Safari 10.1+ 全部稳定
//   2. writing-mode 属性：horizontal-tb / vertical-rl / vertical-lr /
//      sideways-rl / sideways-lr / TB（top-bottom）/ RL（right-left）/
//      物理方向 vs 逻辑方向 / sideways 仅 Firefox 支持
//   3. direction 与 unicode-bidi：direction: ltr / rtl / unicode-bidi:
//      normal / embed / isolate / isolate-override / plaintext / bidi 算法 /
//      双向文本嵌入 / 阿拉伯数字与拉丁字母混合
//   4. text-orientation 属性：mixed / upright / sideways / vertical-tb 中
//      CJK 直立 vs 拉丁旋转 / 文字方向重置 / 与 writing-mode 协同 /
//      蒙古文 upright
//   5. 逻辑属性基础：block-size / inline-size / margin-block / margin-inline /
//      padding-block / padding-inline / inset-block-start / 与物理属性映射 /
//      writing-mode 翻转
//   6. 嵌套 writing-mode 与混合方向：父容器 horizontal-tb 子容器 vertical-rl /
//      横排表格中竖排标题 / 混合方向排版 / 逻辑属性自适应 / 媒体查询切换
//   7. 实战：中日韩竖排文学：古诗竖排 / 报纸版式 / 漫画竖排（manga）/
//      与 Ruby 注音协同 / 竖排表单输入 / 中文标点直排处理
//   8. 实战：多语言国际化：阿拉伯语 RTL 切换 / 希伯来文 / 双向 URL /
//      国际化设计系统 / logical properties 全套替换物理属性 /
//      DevTools 调试 bidi
// 说明：所有特性调用前做 typeof / CSS.supports 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。jsdom 不做真实 CSS 渲染，
//       CSS.supports 通常可用；writing-mode / direction / text-orientation
//       系列属性 jsdom 通常识别为合法语法但无真实排版，统一 try/catch 兜底。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class CSSWritingModesPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      overviewInfo: '',          // Card 1：概述与动机
      writingModeInfo: '',       // Card 2：writing-mode 属性
      directionBidiInfo: '',     // Card 3：direction 与 unicode-bidi
      textOrientationInfo: '',   // Card 4：text-orientation 属性
      logicalPropsInfo: '',      // Card 5：逻辑属性基础
      nestingInfo: '',           // Card 6：嵌套 writing-mode 与混合方向
      cjkVerticalInfo: '',       // Card 7：实战：中日韩竖排文学
      i18nInfo: '',              // Card 8：实战：多语言国际化
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._dynamicStyles = [];                // 动态创建并插入 head 的 <style> 元素列表
    this._writingMode = 'horizontal-tb';     // Card 2 当前 writing-mode
    this._direction = 'ltr';                 // Card 3 当前 direction
    this._unicodeBidi = 'normal';            // Card 3 当前 unicode-bidi
    this._textOrientation = 'mixed';         // Card 4 当前 text-orientation

    // 一次性能力检测：CSS Writing Modes 全家桶
    const f = this._flags();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `CSS ${c(f.css)}`,
      `supports ${c(f.supports)}`,
      `writing-mode:horizontal-tb ${c(f.wmHorizontalTb)}`,
      `writing-mode:vertical-rl ${c(f.wmVerticalRl)}`,
      `writing-mode:vertical-lr ${c(f.wmVerticalLr)}`,
      `writing-mode:sideways-rl ${c(f.wmSidewaysRl)}`,
      `direction:rtl ${c(f.directionRtl)}`,
      `unicode-bidi:isolate ${c(f.unicodeBidiIsolate)}`,
      `text-orientation:mixed ${c(f.textOrientationMixed)}`,
      `text-orientation:upright ${c(f.textOrientationUpright)}`,
      `text-orientation:sideways ${c(f.textOrientationSideways)}`,
    ];

    const summary = f.css
      ? `CSS Writing Modes Module Level 3/4 能力检测：${parts.join(' · ')}。jsdom 不做真实 CSS 渲染，但 CSS.supports 通常可用；writing-mode / direction / unicode-bidi / text-orientation 四大属性现代浏览器支持完整（Chrome 48+ / Firefox 41+ / Safari 10.1+）。sideways-rl/sideways-lr 仅 Firefox 支持。按钮点击注入演示样式 + 完整代码示例，真实浏览器可查看竖排/RTL 排版效果。`
      : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。';

    this.setState({ capsSummary: summary });
    this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.wmVerticalRl) this._addLog('warn', 'writing-mode: vertical-rl 不可用或 jsdom 未识别（Chrome 48+ / Firefox 41+ / Safari 10.1+ 全部稳定）');
    if (!f.wmSidewaysRl) this._addLog('warn', 'writing-mode: sideways-rl 仅 Firefox 支持（CSS Writing Modes L4，Chrome/Safari 未实现）');
    if (!f.textOrientationUpright) this._addLog('warn', 'text-orientation: upright 不可用或 jsdom 未识别（Chrome 48+ / Firefox 41+ / Safari 10.1+）');

    // 一次性注入全部演示样式（仅一次；rerender 不会移除 head 中的 style）
    this._injectBaseStyles();
  }

  componentWillUnmount() {
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
  // 用 safe 包裹：jsdom 不可用时返回 false，绝不抛异常
  _flags() {
    const safe = (fn) => { try { return fn(); } catch { return false; } };
    const hasCSS = safe(() => typeof CSS !== 'undefined');
    const supportsPV = (p, v) => safe(() => hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v));
    return {
      css: hasCSS,
      supports: safe(() => hasCSS && typeof CSS.supports === 'function'),
      wmHorizontalTb: supportsPV('writing-mode', 'horizontal-tb'),
      wmVerticalRl: supportsPV('writing-mode', 'vertical-rl'),
      wmVerticalLr: supportsPV('writing-mode', 'vertical-lr'),
      wmSidewaysRl: supportsPV('writing-mode', 'sideways-rl'),
      wmSidewaysLr: supportsPV('writing-mode', 'sideways-lr'),
      directionRtl: supportsPV('direction', 'rtl'),
      unicodeBidiIsolate: supportsPV('unicode-bidi', 'isolate'),
      textOrientationMixed: supportsPV('text-orientation', 'mixed'),
      textOrientationUpright: supportsPV('text-orientation', 'upright'),
      textOrientationSideways: supportsPV('text-orientation', 'sideways'),
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

  // —— 一次性注入全部基础演示样式 ——
  _injectBaseStyles() {
    this._injectStyle('css-writing-modes-demo', `
      /* ===== 通用 wm 舞台 ===== */
      .wm-stage {
        margin-top: 10px;
        padding: 12px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
      }
      /* ===== Card 2：writing-mode 演示 ===== */
      .wm-demo {
        padding: 16px;
        background: #dbeafe;
        border: 2px solid #3b82f6;
        color: #1e3a8a;
        border-radius: 6px;
        font-size: 16px;
        line-height: 1.8;
        writing-mode: horizontal-tb;
        min-height: 80px;
      }
      /* ===== Card 3：direction / unicode-bidi 演示 ===== */
      .bidi-stage {
        padding: 12px;
        background: #fef3c7;
        border: 2px solid #f59e0b;
        color: #78350f;
        border-radius: 6px;
        font-size: 16px;
        line-height: 1.8;
      }
      .bidi-stage .bidi-demo {
        direction: ltr;
        unicode-bidi: normal;
        padding: 8px;
        background: #fff;
        border-radius: 4px;
        margin-top: 6px;
      }
      /* ===== Card 4：text-orientation 演示 ===== */
      .to-stage {
        padding: 12px;
        background: #dcfce7;
        border: 2px solid #10b981;
        color: #064e3b;
        border-radius: 6px;
        font-size: 16px;
        line-height: 1.8;
      }
      .to-stage .to-demo {
        writing-mode: vertical-rl;
        text-orientation: mixed;
        padding: 12px;
        background: #fff;
        border-radius: 4px;
        margin-top: 6px;
        height: 200px;
      }
      /* ===== Card 5：逻辑属性演示 ===== */
      .logical-stage {
        padding: 12px;
        background: #ede9fe;
        border: 2px solid #8b5cf6;
        color: #4c1d95;
        border-radius: 6px;
      }
      .logical-stage .logical-box {
        inline-size: 200px;
        block-size: 100px;
        margin-block: 10px;
        margin-inline: 20px;
        padding-block: 8px;
        padding-inline: 12px;
        background: #fff;
        border-radius: 4px;
        font-size: 13px;
      }
      /* ===== Card 6：嵌套 writing-mode ===== */
      .nesting-stage {
        padding: 12px;
        background: #fee2e2;
        border: 2px solid #ef4444;
        color: #7f1d1d;
        border-radius: 6px;
      }
      .nesting-stage .parent-h {
        writing-mode: horizontal-tb;
        padding: 10px;
        background: #fff;
        border-radius: 4px;
      }
      .nesting-stage .child-v {
        writing-mode: vertical-rl;
        display: inline-block;
        padding: 8px;
        background: #fef3c7;
        border: 1px solid #f59e0b;
        border-radius: 3px;
        height: 120px;
        margin: 0 8px;
        font-size: 14px;
      }
      /* ===== Card 7：古诗竖排 ===== */
      .poem-stage {
        padding: 16px;
        background: #fffbeb;
        border: 2px solid #d97706;
        border-radius: 6px;
      }
      .poem-stage .poem {
        writing-mode: vertical-rl;
        text-orientation: upright;
        font-family: 'STKaiti', 'KaiTi', serif;
        font-size: 18px;
        line-height: 2;
        height: 240px;
        letter-spacing: 4px;
      }
      .poem-stage .poem .line {
        margin-inline-end: 20px;
      }
      /* ===== Card 8：RTL 国际化 ===== */
      .i18n-stage {
        padding: 12px;
        background: #e0e7ff;
        border: 2px solid #6366f1;
        color: #312e81;
        border-radius: 6px;
      }
      .i18n-stage .rtl-demo {
        direction: rtl;
        unicode-bidi: isolate;
        padding: 10px;
        background: #fff;
        border-radius: 4px;
        font-size: 16px;
        margin-top: 6px;
      }
      .i18n-stage .ltr-demo {
        direction: ltr;
        padding: 10px;
        background: #fff;
        border-radius: 4px;
        font-size: 16px;
        margin-top: 6px;
      }
      /* ===== 输出区 ===== */
      .wm-output {
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
      return `===== CSS Writing Modes Module 概述 =====\n` +
        `\n` +
        `【规范归属】\n` +
        `  CSS Writing Modes Module Level 3（W3C Recommendation）\n` +
        `  CSS Writing Modes Module Level 4（Working Draft，新增 sideways）\n` +
        `  规范地址：https://www.w3.org/TR/css-writing-modes-3/\n` +
        `            https://www.w3.org/TR/css-writing-modes-4/\n` +
        `\n` +
        `【核心动机】\n` +
        `  水平 vs 垂直排版：英文/中文横排 vs 古中文/日文竖排\n` +
        `  LTR vs RTL：英文/中文从左到右 vs 阿拉伯/希伯来从右到左\n` +
        `  CJK（中日韩）竖排需求：古籍、报纸、漫画（manga）\n` +
        `  蒙古文竖排：蒙古文传统从上到下、从左到右（vertical-lr）\n` +
        `\n` +
        `【四大核心属性】\n` +
        `  1. writing-mode        定义块流动方向（horizontal-tb / vertical-rl / vertical-lr）\n` +
        `  2. direction            定义行内流动方向（ltr / rtl）\n` +
        `  3. unicode-bidi         控制双向文本（bidi）算法（normal / isolate / plaintext 等）\n` +
        `  4. text-orientation     定义竖排时字符方向（mixed / upright / sideways）\n` +
        `\n` +
        `【能力检测】\n` +
        `  CSS.supports('writing-mode','horizontal-tb') = ${f.wmHorizontalTb}\n` +
        `  CSS.supports('writing-mode','vertical-rl') = ${f.wmVerticalRl}\n` +
        `  CSS.supports('writing-mode','vertical-lr') = ${f.wmVerticalLr}\n` +
        `  CSS.supports('writing-mode','sideways-rl') = ${f.wmSidewaysRl}\n` +
        `  CSS.supports('direction','rtl') = ${f.directionRtl}\n` +
        `  CSS.supports('unicode-bidi','isolate') = ${f.unicodeBidiIsolate}\n` +
        `  CSS.supports('text-orientation','mixed') = ${f.textOrientationMixed}\n` +
        `  CSS.supports('text-orientation','upright') = ${f.textOrientationUpright}\n` +
        `  CSS.supports('text-orientation','sideways') = ${f.textOrientationSideways}\n` +
        `\n` +
        `【浏览器支持】\n` +
        `  writing-mode: horizontal-tb / vertical-rl / vertical-lr\n` +
        `    Chrome 48+ / Firefox 41+ / Safari 10.1+ / Edge 79+ 全部稳定\n` +
        `  writing-mode: sideways-rl / sideways-lr\n` +
        `    仅 Firefox 支持（CSS Writing Modes L4，Chrome/Safari 未实现）\n` +
        `  direction / unicode-bidi\n` +
        `    全部浏览器支持（CSS2 起就有，CSS Writing Modes L3 重新定义）\n` +
        `  text-orientation: mixed / upright / sideways\n` +
        `    Chrome 48+ / Firefox 41+ / Safari 10.1+ 全部稳定\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  <style>\n` +
        `    /* 古中文竖排（从右到左）*/\n` +
        `    .vertical-rl-text {\n` +
        `      writing-mode: vertical-rl;\n` +
        `      text-orientation: upright;  /* CJK 字符直立 */\n` +
        `      height: 300px;\n` +
        `    }\n` +
        `\n` +
        `    /* 阿拉伯语 RTL */\n` +
        `    .arabic-text {\n` +
        `      direction: rtl;\n` +
        `      unicode-bidi: isolate;\n` +
        `    }\n` +
        `\n` +
        `    /* 蒙古文竖排（从左到右）*/\n` +
        `    .mongolian-text {\n` +
        `      writing-mode: vertical-lr;\n` +
        `      text-orientation: sideways;\n` +
        `    }\n` +
        `  </style>`;
    } catch (err) {
      return `读取概述信息失败：${err.name} - ${err.message}`;
    }
  }

  _runOverviewDemo() {
    this.setState({ overviewInfo: this._readOverviewInfo() });
    this._addLog('info', `概述演示：CSS Writing Modes L3/4，vertical-rl=${this._flags().wmVerticalRl}`);
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. 概述与动机 —— CSS Writing Modes Level 3/4',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['vertical-rl', f.wmVerticalRl],
          ['direction:rtl', f.directionRtl],
          ['text-orientation', f.textOrientationMixed],
        ]),
        h(Tag, { color: 'primary' }, 'L3 REC / L4 WD'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'CSS Writing Modes Module Level 3/4 解决多语言排版：水平 vs 垂直（英文横排 vs 古中文/日文竖排）、LTR vs RTL（英文/中文 vs 阿拉伯/希伯来）、CJK 竖排需求（古籍、报纸、漫画）、蒙古文竖排（vertical-lr）。四大核心属性：writing-mode（块流动方向）、direction（行内流动方向）、unicode-bidi（双向文本算法）、text-orientation（竖排字符方向）。浏览器支持完整：Chrome 48+ / Firefox 41+ / Safari 10.1+ 全部稳定，sideways-rl/sideways-lr 仅 Firefox 支持（L4）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取概述信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runOverviewDemo() }),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.overviewInfo || '（点击「读取概述信息」查看 CSS Writing Modes 全景）')),
        h(Alert, {
          type: 'info',
          message: 'CSS Writing Modes 让 Web 支持全球语言排版',
          description: '规范定义于 CSS Writing Modes Module Level 3（REC）/ Level 4（WD）。四大核心属性：writing-mode（块流动方向）、direction（行内方向 LTR/RTL）、unicode-bidi（双向文本算法）、text-orientation（竖排字符方向）。支持水平/垂直排版、LTR/RTL、CJK 竖排、蒙古文等全球语言。Chrome 48+ / Firefox 41+ / Safari 10.1+ 全部稳定。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：writing-mode 属性 ===================

  _readWritingModeInfo() {
    const f = this._flags();
    try {
      const demo = this.el && this.el.querySelector('.wm-demo');
      let computed = '(未渲染)';
      if (demo) {
        computed = window.getComputedStyle(demo).getPropertyValue('writing-mode') || '(空)';
      }
      return `===== writing-mode 属性 =====\n` +
        `\n` +
        `【语法】\n` +
        `  writing-mode: horizontal-tb | vertical-rl | vertical-lr | sideways-rl | sideways-lr\n` +
        `\n` +
        `【取值详解】\n` +
        `  horizontal-tb  —— 水平从上到下（默认）：块从上到下，行内从左到右\n` +
        `                    适合：英文、中文（现代横排）\n` +
        `  vertical-rl    —— 垂直从右到左：块从右到左，行内从上到下\n` +
        `                    适合：古中文、日文、传统报纸、漫画（manga）\n` +
        `  vertical-lr    —— 垂直从左到右：块从左到右，行内从上到下\n` +
        `                    适合：蒙古文、满文（传统从左到右竖排）\n` +
        `  sideways-rl    —— 顺时针旋转 90° 从右到左（L4 新增）\n` +
        `                    所有字符旋转 90°（含 CJK），仅 Firefox 支持\n` +
        `  sideways-lr    —— 逆时针旋转 90° 从左到右（L4 新增）\n` +
        `                    所有字符旋转 -90°，仅 Firefox 支持\n` +
        `\n` +
        `【物理方向 vs 逻辑方向】\n` +
        `  writing-mode 定义"块流动方向"（block flow direction）\n` +
        `  块方向（block）：新块元素堆叠的方向\n` +
        `    horizontal-tb：块从上到下（block = 垂直）\n` +
        `    vertical-rl：块从右到左（block = 水平）\n` +
        `  行内方向（inline）：行内文字流动方向\n` +
        `    horizontal-tb：行内从左到右（inline = 水平）\n` +
        `    vertical-rl：行内从上到下（inline = 垂直）\n` +
        `\n` +
        `【TB / RL / LR 含义】\n` +
        `  TB = top-bottom（上到下）\n` +
        `  RL = right-left（右到左）\n` +
        `  LR = left-right（左到右）\n` +
        `  horizontal-tb：水平行 + 块从上到下\n` +
        `  vertical-rl：垂直行 + 块从右到左\n` +
        `  vertical-lr：垂直行 + 块从左到右\n` +
        `\n` +
        `【sideways vs vertical 区别】\n` +
        `  vertical-rl/lr：CJK 字符直立，拉丁字符自然旋转（配合 text-orientation）\n` +
        `  sideways-rl/lr：所有字符强制旋转 90°（含 CJK）\n` +
        `  sideways 仅 Firefox 支持，生产环境用 vertical + text-orientation: sideways 替代\n` +
        `\n` +
        `【当前演示元素】\n` +
        `  .wm-demo { writing-mode: ${this._writingMode}; }\n` +
        `    writing-mode 计算值="${computed}"\n` +
        `  CSS.supports('writing-mode','horizontal-tb') = ${f.wmHorizontalTb}\n` +
        `  CSS.supports('writing-mode','vertical-rl') = ${f.wmVerticalRl}\n` +
        `  CSS.supports('writing-mode','vertical-lr') = ${f.wmVerticalLr}\n` +
        `  CSS.supports('writing-mode','sideways-rl') = ${f.wmSidewaysRl}\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  /* 默认横排 */\n` +
        `  .horizontal { writing-mode: horizontal-tb; }\n` +
        `\n` +
        `  /* 古中文竖排（从右到左，传统古籍版式）*/\n` +
        `  .classical-vertical {\n` +
        `    writing-mode: vertical-rl;\n` +
        `    text-orientation: upright;  /* CJK 直立 */\n` +
        `    height: 400px;\n` +
        `  }\n` +
        `\n` +
        `  /* 蒙古文竖排（从左到右）*/\n` +
        `  .mongolian {\n` +
        `    writing-mode: vertical-lr;\n` +
        `    text-orientation: sideways;  /* 蒙古文旋转 */\n` +
        `  }\n` +
        `\n` +
        `  /* 横排表格中竖排标题 */\n` +
        `  th.vertical-header {\n` +
        `    writing-mode: vertical-rl;\n` +
        `    text-orientation: mixed;\n` +
        `  }`;
    } catch (err) {
      return `读取 writing-mode 信息失败：${err.name} - ${err.message}`;
    }
  }

  _setWritingMode(mode) {
    this._writingMode = mode;
    this._injectStyle('css-wm-dynamic', `.wm-demo { writing-mode: ${mode}; }`);
    this.setState({ writingModeInfo: this._readWritingModeInfo() });
    const desc = {
      'horizontal-tb': '水平从上到下（默认）',
      'vertical-rl': '垂直从右到左（古中文/日文）',
      'vertical-lr': '垂直从左到右（蒙古文）',
      'sideways-rl': '顺时针旋转 90°（仅 Firefox）',
      'sideways-lr': '逆时针旋转 90°（仅 Firefox）',
    }[mode];
    this._addLog('writing-mode', `切换 writing-mode → ${mode}（${desc}）`);
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. writing-mode 属性 —— horizontal-tb / vertical-rl / vertical-lr / sideways',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['horizontal-tb', f.wmHorizontalTb],
          ['vertical-rl', f.wmVerticalRl],
          ['vertical-lr', f.wmVerticalLr],
          ['sideways-rl', f.wmSidewaysRl],
        ]),
        h(Tag, { color: 'primary' }, '块流动方向'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'writing-mode 定义块流动方向：horizontal-tb（默认水平从上到下，适合英文/现代中文）、vertical-rl（垂直从右到左，古中文/日文/报纸/漫画）、vertical-lr（垂直从左到右，蒙古文/满文）、sideways-rl/sideways-lr（L4 新增，所有字符旋转 90°，仅 Firefox 支持）。vertical-rl/lr 让 CJK 字符直立、拉丁字符自然旋转（配合 text-orientation），sideways 强制所有字符旋转。浏览器支持：Chrome 48+ / Firefox 41+ / Safari 10.1+ 全部稳定，sideways 仅 Firefox。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ writingModeInfo: this._readWritingModeInfo() }) }),
          this._btn('horizontal-tb', { size: 'sm', disabled: !f.wmHorizontalTb, onClick: () => this._setWritingMode('horizontal-tb') }),
          this._btn('vertical-rl', { size: 'sm', disabled: !f.wmVerticalRl, onClick: () => this._setWritingMode('vertical-rl') }),
          this._btn('vertical-lr', { size: 'sm', disabled: !f.wmVerticalLr, onClick: () => this._setWritingMode('vertical-lr') }),
          this._btn('sideways-rl', { size: 'sm', disabled: !f.wmSidewaysRl, onClick: () => this._setWritingMode('sideways-rl') }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '演示元素（当前 writing-mode: ' + this._writingMode + '）：'),
        h('div', { class: 'wm-demo' },
          '床前明月光，疑是地上霜。举头望明月，低头思故乡。——李白《静夜思》',
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.writingModeInfo || '（点击按钮切换 writing-mode 查看说明）')),
        h(Alert, {
          type: 'info',
          message: 'vertical-rl 适合古中文/日文竖排，vertical-lr 适合蒙古文',
          description: 'writing-mode 定义块流动方向：horizontal-tb（默认横排）、vertical-rl（古中文/日文/漫画从右到左）、vertical-lr（蒙古文从左到右）、sideways-rl/lr（L4 新增强制旋转，仅 Firefox）。vertical 让 CJK 直立、拉丁旋转（配合 text-orientation），sideways 强制所有字符旋转。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：direction 与 unicode-bidi ===================

  _readDirectionBidiInfo() {
    const f = this._flags();
    try {
      const demo = this.el && this.el.querySelector('.bidi-demo');
      let computedDir = '(未渲染)';
      let computedBidi = '(未渲染)';
      if (demo) {
        const cs = window.getComputedStyle(demo);
        computedDir = cs.getPropertyValue('direction') || '(空)';
        computedBidi = cs.getPropertyValue('unicode-bidi') || '(空)';
      }
      return `===== direction 与 unicode-bidi =====\n` +
        `\n` +
        `【direction 属性】\n` +
        `  direction: ltr | rtl\n` +
        `  作用：定义行内流动方向（左到右 / 右到左）\n` +
        `    ltr：左到右（默认，英文/中文/数字）\n` +
        `    rtl：右到左（阿拉伯语、希伯来语）\n` +
        `  注意：direction 还影响块元素的对齐默认值（如 text-align: start）\n` +
        `\n` +
        `【unicode-bidi 属性】\n` +
        `  unicode-bidi: normal | embed | isolate | isolate-override | plaintext | bidi-override\n` +
        `    normal：默认，按 bidi 算法自然处理\n` +
        `    embed：插入双向嵌入（影响子元素方向）\n` +
        `    isolate：隔离双向文本（子元素不影响外部 bidi）\n` +
        `    isolate-override：隔离 + 覆盖方向\n` +
        `    plaintext：按内容自动判断方向（不继承父级 direction）\n` +
        `    bidi-override：强制覆盖 bidi 算法（已废弃，用 isolate-override）\n` +
        `\n` +
        `【bidi 算法】\n` +
        `  Unicode Bidirectional Algorithm（UAX #9）自动处理混合方向文本\n` +
        `  根据字符的 bidi 类别（强/弱/中性）决定显示顺序\n` +
        `  强字符：拉丁字母（LTR）、阿拉伯/希伯来字母（RTL）\n` +
        `  弱字符：数字（继承上下文方向）\n` +
        `  中性字符：标点、空格（按上下文决定）\n` +
        `\n` +
        `【双向文本嵌入场景】\n` +
        `  阿拉伯语中嵌入英文：مرحبا Hello 世界\n` +
        `    英文 Hello 应保持 LTR，阿拉伯语保持 RTL\n` +
        `    用 unicode-bidi: isolate 隔离英文段，防止 bidi 错乱\n` +
        `  英文中嵌入阿拉伯语：Hello مرحبا World\n` +
        `    阿拉伯语应保持 RTL，用 unicode-bidi: isolate 隔离\n` +
        `\n` +
        `【阿拉伯数字与拉丁字母混合】\n` +
        `  数字（0-9）在 bidi 算法中是"弱"字符，继承上下文方向\n` +
        `  在 RTL 上下文中，数字仍按 LTR 显示（数字本身从左到右）\n` +
        `  如：ارقام 1234 → 显示为 ارقام 1234（数字内部 LTR）\n` +
        `\n` +
        `【当前演示元素】\n` +
        `  .bidi-demo { direction: ${this._direction}; unicode-bidi: ${this._unicodeBidi}; }\n` +
        `    direction 计算值="${computedDir}"\n` +
        `    unicode-bidi 计算值="${computedBidi}"\n` +
        `  CSS.supports('direction','rtl') = ${f.directionRtl}\n` +
        `  CSS.supports('unicode-bidi','isolate') = ${f.unicodeBidiIsolate}\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  /* 阿拉伯语段落 RTL */\n` +
        `  .arabic {\n` +
        `    direction: rtl;\n` +
        `    unicode-bidi: isolate;\n` +
        `    text-align: start;  /* RTL 时 = right */\n` +
        `  }\n` +
        `\n` +
        `  /* 英文中嵌入阿拉伯语 */\n` +
        `  .en-with-ar {\n` +
        `    direction: ltr;\n` +
        `  }\n` +
        `  .en-with-ar .ar-embed {\n` +
        `    direction: rtl;\n` +
        `    unicode-bidi: isolate;  /* 隔离阿拉伯语段 */\n` +
        `  }\n` +
        `\n` +
        `  /* 用户输入自动判断方向（plaintext）*/\n` +
        `  .user-input {\n` +
        `    unicode-bidi: plaintext;  /* 按内容自动判断 LTR/RTL */\n` +
        `  }`;
    } catch (err) {
      return `读取 direction/unicode-bidi 信息失败：${err.name} - ${err.message}`;
    }
  }

  _setDirection(mode) {
    this._direction = mode;
    this._injectStyle('css-direction-dynamic', `.bidi-demo { direction: ${mode}; unicode-bidi: ${this._unicodeBidi}; }`);
    this.setState({ directionBidiInfo: this._readDirectionBidiInfo() });
    this._addLog('direction', `切换 direction → ${mode}`);
  }

  _setUnicodeBidi(mode) {
    this._unicodeBidi = mode;
    this._injectStyle('css-bidi-dynamic', `.bidi-demo { direction: ${this._direction}; unicode-bidi: ${mode}; }`);
    this.setState({ directionBidiInfo: this._readDirectionBidiInfo() });
    this._addLog('bidi', `切换 unicode-bidi → ${mode}`);
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. direction 与 unicode-bidi —— LTR/RTL 与双向文本算法',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['direction:rtl', f.directionRtl],
          ['unicode-bidi:isolate', f.unicodeBidiIsolate],
        ]),
        h(Tag, { color: 'primary' }, 'bidi 算法'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'direction 定义行内流动方向（ltr 左到右 / rtl 右到左，阿拉伯/希伯来语）。unicode-bidi 控制双向文本算法：normal（默认）/ embed（嵌入）/ isolate（隔离，防止子元素影响外部 bidi）/ isolate-override / plaintext（按内容自动判断方向）。bidi 算法（UAX #9）按字符 bidi 类别（强/弱/中性）处理混合方向文本，数字是弱字符继承上下文方向。常见场景：阿拉伯语中嵌入英文用 isolate 隔离，用户输入用 plaintext 自动判断方向。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ directionBidiInfo: this._readDirectionBidiInfo() }) }),
          this._btn('dir: ltr', { size: 'sm', disabled: !f.directionRtl, onClick: () => this._setDirection('ltr') }),
          this._btn('dir: rtl', { size: 'sm', disabled: !f.directionRtl, onClick: () => this._setDirection('rtl') }),
          this._btn('bidi: normal', { size: 'sm', disabled: !f.unicodeBidiIsolate, onClick: () => this._setUnicodeBidi('normal') }),
          this._btn('bidi: isolate', { size: 'sm', disabled: !f.unicodeBidiIsolate, onClick: () => this._setUnicodeBidi('isolate') }),
          this._btn('bidi: plaintext', { size: 'sm', disabled: !f.unicodeBidiIsolate, onClick: () => this._setUnicodeBidi('plaintext') }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '双向文本演示（direction: ' + this._direction + ' / unicode-bidi: ' + this._unicodeBidi + '）：'),
        h('div', { class: 'bidi-stage' },
          h('div', { class: 'bidi-demo' },
            'مرحبا بالعالم Hello 世界 1234 — 双向文本测试',
          ),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.directionBidiInfo || '（点击按钮切换 direction / unicode-bidi 查看说明）')),
        h(Alert, {
          type: 'info',
          message: 'unicode-bidi: isolate 隔离双向文本，plaintext 按内容自动判断',
          description: 'direction: rtl 让阿拉伯/希伯来语从右到左。unicode-bidi: isolate 隔离子元素防止 bidi 错乱（如英文中嵌入阿拉伯语）。plaintext 让用户输入按内容自动判断方向（不继承父级 direction）。数字是弱字符继承上下文方向。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：text-orientation 属性 ===================

  _readTextOrientationInfo() {
    const f = this._flags();
    try {
      const demo = this.el && this.el.querySelector('.to-demo');
      let computed = '(未渲染)';
      if (demo) {
        computed = window.getComputedStyle(demo).getPropertyValue('text-orientation') || '(空)';
      }
      return `===== text-orientation 属性 =====\n` +
        `\n` +
        `【语法】\n` +
        `  text-orientation: mixed | upright | sideways\n` +
        `  仅在 writing-mode: vertical-* 时生效（horizontal-tb 时无效果）\n` +
        `\n` +
        `【取值详解】\n` +
        `  mixed     —— 默认：CJK 字符直立，拉丁字母/数字自然旋转 90°\n` +
        `                适合：竖排混排（中文+英文+数字）\n` +
        `                CJK（中日韩）字符直立显示，其他字符旋转\n` +
        `  upright   —— 所有字符直立（含拉丁字母/数字）\n` +
        `                适合：纯 CJK 竖排（古籍、书法）\n` +
        `                拉丁字母也直立（如 "A" 直立而非旋转）\n` +
        `                蒙古文也用 upright（蒙古文字母直立）\n` +
        `  sideways  —— 所有字符强制旋转 90°（含 CJK）\n` +
        `                适合：横排标题旋转（如表格竖排表头）\n` +
        `                CJK 字符也旋转 90°（与 writing-mode: sideways 等价）\n` +
        `\n` +
        `【vertical-rl 中 CJK 直立 vs 拉丁旋转】\n` +
        `  text-orientation: mixed（默认）\n` +
        `    CJK 字符：直立（如"床"直立显示）\n` +
        `    拉丁字母：旋转 90° 顺时针（如"A"旋转）\n` +
        `    数字：旋转 90° 顺时针\n` +
        `  text-orientation: upright\n` +
        `    所有字符直立（含拉丁字母和数字）\n` +
        `    "Hello" 显示为 H、e、l、l、o 各自直立堆叠\n` +
        `  text-orientation: sideways\n` +
        `    所有字符旋转 90°（含 CJK）\n` +
        `    "床" 旋转 90° 显示\n` +
        `\n` +
        `【文字方向重置】\n` +
        `  text-orientation 影响 text-combine-upright（横排组合数字）\n` +
        `  如中文竖排中"2024年"的"2024"用 text-combine-upright: all 横排显示\n` +
        `\n` +
        `【与 writing-mode 协同】\n` +
        `  text-orientation 仅在 vertical-* writing-mode 下生效\n` +
        `  horizontal-tb 时 text-orientation 无效（已是水平）\n` +
        `  常见组合：\n` +
        `    writing-mode: vertical-rl + text-orientation: mixed（默认竖排混排）\n` +
        `    writing-mode: vertical-rl + text-orientation: upright（纯 CJK 古籍）\n` +
        `    writing-mode: vertical-rl + text-orientation: sideways（旋转标题）\n` +
        `\n` +
        `【蒙古文 upright】\n` +
        `  蒙古文传统竖排，字母直立（不旋转）\n` +
        `  writing-mode: vertical-lr + text-orientation: upright\n` +
        `  蒙古文字母按竖排直立显示，符合传统书写习惯\n` +
        `\n` +
        `【当前演示元素】\n` +
        `  .to-demo { writing-mode: vertical-rl; text-orientation: ${this._textOrientation}; }\n` +
        `    text-orientation 计算值="${computed}"\n` +
        `  CSS.supports('text-orientation','mixed') = ${f.textOrientationMixed}\n` +
        `  CSS.supports('text-orientation','upright') = ${f.textOrientationUpright}\n` +
        `  CSS.supports('text-orientation','sideways') = ${f.textOrientationSideways}\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  /* 竖排混排（CJK 直立 + 拉丁旋转）*/\n` +
        `  .vertical-mixed {\n` +
        `    writing-mode: vertical-rl;\n` +
        `    text-orientation: mixed;     /* 默认 */\n` +
        `  }\n` +
        `\n` +
        `  /* 纯 CJK 古籍（所有字符直立）*/\n` +
        `  .classical-upright {\n` +
        `    writing-mode: vertical-rl;\n` +
        `    text-orientation: upright;   /* 拉丁也直立 */\n` +
        `  }\n` +
        `\n` +
        `  /* 表格竖排表头（所有字符旋转）*/\n` +
        `  th.rotated-header {\n` +
        `    writing-mode: vertical-rl;\n` +
        `    text-orientation: sideways;  /* CJK 也旋转 */\n` +
        `  }\n` +
        `\n` +
        `  /* 蒙古文竖排 */\n` +
        `  .mongolian {\n` +
        `    writing-mode: vertical-lr;\n` +
        `    text-orientation: upright;   /* 蒙古文字母直立 */\n` +
        `  }`;
    } catch (err) {
      return `读取 text-orientation 信息失败：${err.name} - ${err.message}`;
    }
  }

  _setTextOrientation(mode) {
    this._textOrientation = mode;
    this._injectStyle('css-to-dynamic', `.to-demo { writing-mode: vertical-rl; text-orientation: ${mode}; }`);
    this.setState({ textOrientationInfo: this._readTextOrientationInfo() });
    const desc = {
      mixed: 'CJK 直立 + 拉丁旋转（默认）',
      upright: '所有字符直立（含拉丁）',
      sideways: '所有字符旋转 90°（含 CJK）',
    }[mode];
    this._addLog('text-orientation', `切换 text-orientation → ${mode}（${desc}）`);
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. text-orientation 属性 —— mixed / upright / sideways',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['mixed', f.textOrientationMixed],
          ['upright', f.textOrientationUpright],
          ['sideways', f.textOrientationSideways],
        ]),
        h(Tag, { color: 'primary' }, '竖排字符方向'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'text-orientation 定义竖排时字符方向（仅在 writing-mode: vertical-* 生效）：mixed（默认，CJK 直立 + 拉丁/数字旋转 90°，适合竖排混排）、upright（所有字符直立含拉丁，适合纯 CJK 古籍/蒙古文）、sideways（所有字符旋转 90° 含 CJK，适合表格竖排表头）。与 writing-mode 协同：vertical-rl + mixed 默认竖排混排，vertical-rl + upright 纯 CJK 古籍，vertical-rl + sideways 旋转标题。蒙古文用 vertical-lr + upright（字母直立符合传统）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ textOrientationInfo: this._readTextOrientationInfo() }) }),
          this._btn('mixed', { size: 'sm', disabled: !f.textOrientationMixed, onClick: () => this._setTextOrientation('mixed') }),
          this._btn('upright', { size: 'sm', disabled: !f.textOrientationUpright, onClick: () => this._setTextOrientation('upright') }),
          this._btn('sideways', { size: 'sm', disabled: !f.textOrientationSideways, onClick: () => this._setTextOrientation('sideways') }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '竖排演示（writing-mode: vertical-rl + text-orientation: ' + this._textOrientation + '）：'),
        h('div', { class: 'to-stage' },
          h('div', { class: 'to-demo' },
            '床前明月光 Hello 2024',
          ),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.textOrientationInfo || '（点击按钮切换 text-orientation 查看说明）')),
        h(Alert, {
          type: 'info',
          message: 'mixed 让 CJK 直立 + 拉丁旋转，upright 让所有字符直立',
          description: 'text-orientation 仅在 vertical-* writing-mode 生效。mixed（默认）CJK 直立 + 拉丁旋转，适合竖排混排。upright 所有字符直立（含拉丁），适合纯 CJK 古籍/蒙古文。sideways 所有字符旋转 90°（含 CJK），适合表格竖排表头。蒙古文用 vertical-lr + upright。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：逻辑属性基础 ===================

  _readLogicalPropsInfo() {
    const f = this._flags();
    try {
      const box = this.el && this.el.querySelector('.logical-box');
      let computedIS = '(未渲染)';
      let computedBS = '(未渲染)';
      if (box) {
        const cs = window.getComputedStyle(box);
        computedIS = cs.getPropertyValue('inline-size') || '(空)';
        computedBS = cs.getPropertyValue('block-size') || '(空)';
      }
      return `===== 逻辑属性基础 =====\n` +
        `\n` +
        `【逻辑属性 vs 物理属性】\n` +
        `  物理属性：相对屏幕物理方向（top/right/bottom/left、width/height）\n` +
        `    不随 writing-mode / direction 变化\n` +
        `  逻辑属性：相对书写方向（block/inline、start/end）\n` +
        `    随 writing-mode / direction 自动翻转\n` +
        `\n` +
        `【尺寸逻辑属性】\n` +
        `  inline-size  ≡ width（horizontal-tb）/ height（vertical-rl）\n` +
        `  block-size   ≡ height（horizontal-tb）/ width（vertical-rl）\n` +
        `  min-inline-size / max-inline-size / min-block-size / max-block-size\n` +
        `\n` +
        `【外边距逻辑属性】\n` +
        `  margin-block          —— 块方向外边距（= margin-top + margin-bottom in horizontal-tb）\n` +
        `  margin-inline         —— 行内方向外边距（= margin-left + margin-right）\n` +
        `  margin-block-start    —— 块方向起始（= margin-top in horizontal-tb）\n` +
        `  margin-block-end      —— 块方向结束（= margin-bottom）\n` +
        `  margin-inline-start   —— 行内方向起始（= margin-left in LTR / margin-right in RTL）\n` +
        `  margin-inline-end     —— 行内方向结束\n` +
        `\n` +
        `【内边距逻辑属性】\n` +
        `  padding-block / padding-inline\n` +
        `  padding-block-start / padding-block-end\n` +
        `  padding-inline-start / padding-inline-end\n` +
        `\n` +
        `【定位逻辑属性】\n` +
        `  inset-block-start    ≡ top（horizontal-tb）/ right（vertical-rl）\n` +
        `  inset-block-end      ≡ bottom / left\n` +
        `  inset-inline-start   ≡ left（LTR）/ right（RTL）\n` +
        `  inset-inline-end     ≡ right（LTR）/ left（RTL）\n` +
        `  inset-block / inset-inline（简写）\n` +
        `\n` +
        `【与物理属性映射（horizontal-tb + LTR）】\n` +
        `  逻辑属性              | 物理属性\n` +
        `  ----------------------|----------------\n` +
        `  inline-size           | width\n` +
        `  block-size            | height\n` +
        `  margin-block-start    | margin-top\n` +
        `  margin-block-end      | margin-bottom\n` +
        `  margin-inline-start   | margin-left\n` +
        `  margin-inline-end     | margin-right\n` +
        `  inset-block-start     | top\n` +
        `  inset-inline-start    | left\n` +
        `\n` +
        `【writing-mode 翻转】\n` +
        `  writing-mode: vertical-rl 时：\n` +
        `    inline-size  ≡ height（行内 = 垂直）\n` +
        `    block-size   ≡ width（块 = 水平）\n` +
        `    margin-block-start ≡ margin-right\n` +
        `    margin-inline-start ≡ margin-top\n` +
        `  direction: rtl 时：\n` +
        `    margin-inline-start ≡ margin-right\n` +
        `    margin-inline-end ≡ margin-left\n` +
        `\n` +
        `【当前演示元素】\n` +
        `  .logical-box {\n` +
        `    inline-size: 200px;        /* 计算值="${computedIS}" */\n` +
        `    block-size: 100px;         /* 计算值="${computedBS}" */\n` +
        `    margin-block: 10px;\n` +
        `    margin-inline: 20px;\n` +
        `    padding-block: 8px;\n` +
        `    padding-inline: 12px;\n` +
        `  }\n` +
        `\n` +
        `【完整代码示例】\n` +
        `  /* 国际化友好：用逻辑属性适配 RTL/竖排 */\n` +
        `  .i18n-card {\n` +
        `    inline-size: 300px;          /* 替代 width */\n` +
        `    block-size: 200px;           /* 替代 height */\n` +
        `    margin-block-start: 16px;    /* 替代 margin-top */\n` +
        `    margin-inline-start: 20px;   /* 替代 margin-left（RTL 自动翻转）*/\n` +
        `    padding-inline: 12px;\n` +
        `    inset-block-start: 0;        /* 替代 top */\n` +
        `    inset-inline-start: 0;       /* 替代 left（RTL 自动翻转）*/\n` +
        `  }\n` +
        `\n` +
        `【为何使用逻辑属性】\n` +
        `  1. 国际化：RTL/竖排自动适配，无需为每种语言写 CSS\n` +
        `  2. 维护性：一套样式适配所有 writing-mode / direction\n` +
        `  3. 未来-proof：CSS Logical Properties 是规范方向`;
    } catch (err) {
      return `读取逻辑属性信息失败：${err.name} - ${err.message}`;
    }
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. 逻辑属性基础 —— block-size / inline-size / margin-block / inset-block',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['inline-size', f.wmHorizontalTb],
          ['block-size', f.wmHorizontalTb],
        ]),
        h(Tag, { color: 'primary' }, '逻辑属性'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '逻辑属性相对书写方向（block/inline、start/end），随 writing-mode / direction 自动翻转，替代物理属性（top/right/bottom/left、width/height）。尺寸：inline-size/block-size。外边距：margin-block/inline、margin-block-start/end、margin-inline-start/end。内边距：padding-block/inline 系列。定位：inset-block-start/end、inset-inline-start/end。horizontal-tb + LTR 时 inline-size=width、margin-inline-start=margin-left；vertical-rl 时翻转；RTL 时 inline-start/end 翻转。优势：国际化自动适配，一套样式适配所有书写方向。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ logicalPropsInfo: this._readLogicalPropsInfo() }) }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '逻辑属性演示元素：'),
        h('div', { class: 'logical-stage' },
          h('div', { class: 'logical-box' },
            'inline-size: 200px\nblock-size: 100px\nmargin-block: 10px / margin-inline: 20px\npadding-block: 8px / padding-inline: 12px',
          ),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.logicalPropsInfo || '（点击按钮查看逻辑属性完整说明）')),
        h(Alert, {
          type: 'info',
          message: '逻辑属性随 writing-mode / direction 自动翻转，国际化友好',
          description: '逻辑属性替代物理属性：inline-size/block-size（替代 width/height）、margin-block/inline（替代 margin-top/right/bottom/left）、inset-block/inline（替代 top/right/bottom/left）。horizontal-tb + LTR 时映射到物理属性；vertical-rl 时 block/inline 翻转；RTL 时 start/end 翻转。一套样式适配所有书写方向。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：嵌套 writing-mode 与混合方向 ===================

  _readNestingInfo() {
    const f = this._flags();
    try {
      return `===== 嵌套 writing-mode 与混合方向 =====\n` +
        `\n` +
        `【场景 1：父容器 horizontal-tb 子容器 vertical-rl】\n` +
        `  横排正文中嵌入竖排引用（如古诗引用）\n` +
        `  .parent { writing-mode: horizontal-tb; }\n` +
        `  .parent .vertical-quote {\n` +
        `    writing-mode: vertical-rl;\n` +
        `    text-orientation: upright;\n` +
        `    display: inline-block;  /* 行内块让竖排与横排共存 */\n` +
        `    height: 150px;\n` +
        `  }\n` +
        `\n` +
        `【场景 2：横排表格中竖排标题】\n` +
        `  表头 th 竖排显示，节省横向空间\n` +
        `  table { writing-mode: horizontal-tb; }\n` +
        `  th.vertical-header {\n` +
        `    writing-mode: vertical-rl;\n` +
        `    text-orientation: mixed;\n` +
        `    height: 120px;\n` +
        `    min-inline-size: 40px;  /* 竖排时 inline-size = 高度 */\n` +
        `  }\n` +
        `\n` +
        `【场景 3：混合方向排版】\n` +
        `  正文横排 + 标题竖排 + 阿拉伯语 RTL\n` +
        `  .article { writing-mode: horizontal-tb; }\n` +
        `  .article h1 { writing-mode: vertical-rl; }  /* 标题竖排 */\n` +
        `  .article .ar-section { direction: rtl; }    /* 阿拉伯语 RTL */\n` +
        `\n` +
        `【场景 4：逻辑属性自适应】\n` +
        `  嵌套 writing-mode 时，逻辑属性自动适配各层级方向\n` +
        `  .parent { writing-mode: horizontal-tb; padding-inline: 20px; }\n` +
        `    /* parent 的 padding-inline = 左右各 20px */\n` +
        `  .parent .child { writing-mode: vertical-rl; padding-inline: 10px; }\n` +
        `    /* child 的 padding-inline = 上下各 10px（因 child 行内 = 垂直）*/\n` +
        `  逻辑属性让嵌套不同 writing-mode 的元素各自动适配\n` +
        `\n` +
        `【场景 5：媒体查询切换 writing-mode】\n` +
        `  响应式：桌面横排，移动端竖排\n` +
        `  .article { writing-mode: horizontal-tb; }\n` +
        `  @media (max-width: 768px) {\n` +
        `    .article { writing-mode: vertical-rl; }  /* 移动端竖排 */\n` +
        `    .article { text-orientation: mixed; }\n` +
        `  }\n` +
        `\n` +
        `【能力检测】\n` +
        `  writing-mode: vertical-rl 支持 = ${f.wmVerticalRl}\n` +
        `  writing-mode: vertical-lr 支持 = ${f.wmVerticalLr}`;
    } catch (err) {
      return `读取嵌套 writing-mode 信息失败：${err.name} - ${err.message}`;
    }
  }

  _runNestingDemo() {
    this.setState({ nestingInfo: this._readNestingInfo() });
    this._addLog('nesting', `嵌套 writing-mode 演示：vertical-rl=${this._flags().wmVerticalRl}`);
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. 嵌套 writing-mode 与混合方向 —— 父横子竖 / 表格标题 / 逻辑属性自适应',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['vertical-rl', f.wmVerticalRl], ['vertical-lr', f.wmVerticalLr]]),
        h(Tag, { color: 'primary' }, '5 大场景'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '嵌套 writing-mode 五大场景：父容器 horizontal-tb 子容器 vertical-rl（横排正文嵌入竖排引用，用 display: inline-block 共存）、横排表格中竖排标题（th 设 vertical-rl 节省横向空间）、混合方向排版（正文横排 + 标题竖排 + 阿拉伯语 RTL）、逻辑属性自适应（嵌套不同 writing-mode 时 padding-inline/margin-block 各自适配方向）、媒体查询切换 writing-mode（桌面横排、移动端竖排）。逻辑属性让嵌套场景各层级自动适配方向。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取嵌套信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runNestingDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '父横子竖嵌套演示：'),
        h('div', { class: 'nesting-stage' },
          h('div', { class: 'parent-h' },
            '这是横排正文（horizontal-tb）。',
            h('span', { class: 'child-v' }, '竖排子元素 vertical-rl'),
            '继续横排正文，竖排子元素用 inline-block 与横排共存。',
          ),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.nestingInfo || '（点击按钮查看 5 大嵌套场景完整代码）')),
        h(Alert, {
          type: 'info',
          message: '嵌套 writing-mode 时逻辑属性各层级自动适配方向',
          description: '父容器 horizontal-tb + 子容器 vertical-rl 时，子容器的 padding-inline 自动变为上下方向（因子容器行内 = 垂直）。display: inline-block 让竖排子元素与横排正文共存。横排表格 th 设 vertical-rl 节省横向空间。媒体查询可响应式切换 writing-mode。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 7：实战：中日韩竖排文学 ===================

  _readCjkVerticalInfo() {
    const f = this._flags();
    try {
      return `===== 实战：中日韩竖排文学 =====\n` +
        `\n` +
        `【场景 1：古诗竖排】\n` +
        `  .poem {\n` +
        `    writing-mode: vertical-rl;\n` +
        `    text-orientation: upright;  /* CJK 直立 */\n` +
        `    font-family: 'STKaiti', 'KaiTi', serif;\n` +
        `    font-size: 24px;\n` +
        `    line-height: 2;\n` +
        `    height: 400px;\n` +
        `    letter-spacing: 4px;        /* 字间距 */\n` +
        `  }\n` +
        `  /* 每句一行（从右到左）*/\n` +
        `  .poem .line { margin-inline-end: 30px; }\n` +
        `\n` +
        `【场景 2：报纸版式】\n` +
        `  传统报纸竖排标题 + 横排正文\n` +
        `  .newspaper h1 {\n` +
        `    writing-mode: vertical-rl;\n` +
        `    text-orientation: upright;\n` +
        `    font-size: 36px;\n` +
        `    height: 300px;\n` +
        `  }\n` +
        `  .newspaper .content { writing-mode: horizontal-tb; }\n` +
        `\n` +
        `【场景 3：漫画竖排（manga）】\n` +
        `  日式漫画传统从右到左竖排\n` +
        `  .manga {\n` +
        `    writing-mode: vertical-rl;\n` +
        `    text-orientation: mixed;    /* 假名直立 + 拉丁旋转 */\n` +
        `    font-family: 'YuMincho', serif;\n` +
        `    direction: ltr;             /* 强制 LTR 防止数字翻转 */\n` +
        `  }\n` +
        `\n` +
        `【场景 4：与 Ruby 注音协同】\n` +
        `  <ruby> 横排注音 + 竖排正文\n` +
        `  .vertical-with-ruby {\n` +
        `    writing-mode: vertical-rl;\n` +
        `    text-orientation: upright;\n` +
        `  }\n` +
        `  /* HTML：*/\n` +
        `  <ruby>漢<rt>かん</rt>字<rt>じ</rt></ruby>\n` +
        `  竖排时 ruby 注音自动旋转到字符右侧\n` +
        `\n` +
        `【场景 5：竖排表单输入】\n` +
        `  input/textarea 竖排输入\n` +
        `  input.vertical {\n` +
        `    writing-mode: vertical-rl;\n` +
        `    text-orientation: upright;\n` +
        `    height: 200px;\n` +
        `    width: 40px;\n` +
        `  }\n` +
        `  textarea.vertical {\n` +
        `    writing-mode: vertical-rl;\n` +
        `    text-orientation: upright;\n` +
        `    height: 300px;\n` +
        `    width: 200px;\n` +
        `  }\n` +
        `\n` +
        `【场景 6：中文标点直排处理】\n` +
        `  竖排时标点符号需特殊处理（直排标点）\n` +
        `  CSS 提供 text-spacing-trim / text-combine-upright\n` +
        `  常见标点：，。、；：？！""''（）\n` +
        `  竖排时标点旋转到字符右上角（默认行为）\n` +
        `  .vertical-punct {\n` +
        `    writing-mode: vertical-rl;\n` +
        `    text-orientation: upright;\n` +
        `    /* 标点自动旋转到合适位置 */\n` +
        `  }\n` +
        `\n` +
        `【能力检测】\n` +
        `  writing-mode: vertical-rl 支持 = ${f.wmVerticalRl}\n` +
        `  text-orientation: upright 支持 = ${f.textOrientationUpright}`;
    } catch (err) {
      return `读取中日韩竖排文学信息失败：${err.name} - ${err.message}`;
    }
  }

  _runCjkVerticalDemo() {
    this.setState({ cjkVerticalInfo: this._readCjkVerticalInfo() });
    this._addLog('cjk', `中日韩竖排文学演示：vertical-rl=${this._flags().wmVerticalRl}`);
  }

  _renderCard7() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. 实战：中日韩竖排文学 —— 古诗 / 报纸 / 漫画 / Ruby / 表单 / 标点',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['vertical-rl', f.wmVerticalRl], ['upright', f.textOrientationUpright]]),
        h(Tag, { color: 'primary' }, '6 大场景'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '中日韩竖排文学六大场景：古诗竖排（vertical-rl + text-orientation: upright + 楷体 + letter-spacing）、报纸版式（竖排标题 + 横排正文）、漫画竖排 manga（vertical-rl + mixed 假名直立 + 拉丁旋转）、与 Ruby 注音协同（<ruby> 竖排时注音自动到字符右侧）、竖排表单输入（input/textarea 设 vertical-rl）、中文标点直排处理（标点自动旋转到右上角）。配合 text-combine-upright 让横排数字在竖排中组合显示。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取实战信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runCjkVerticalDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '古诗竖排演示（writing-mode: vertical-rl + text-orientation: upright）：'),
        h('div', { class: 'poem-stage' },
          h('div', { class: 'poem' },
            h('div', { class: 'line' }, '床前明月光，'),
            h('div', { class: 'line' }, '疑是地上霜。'),
            h('div', { class: 'line' }, '举头望明月，'),
            h('div', { class: 'line' }, '低头思故乡。'),
          ),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.cjkVerticalInfo || '（点击按钮查看 6 大竖排文学场景完整代码）')),
        h(Alert, {
          type: 'info',
          message: '古诗竖排用 vertical-rl + upright + 楷体 + letter-spacing',
          description: '古诗竖排：writing-mode: vertical-rl + text-orientation: upright（CJK 直立）+ font-family 楷体 + letter-spacing 字间距 + 每句 margin-inline-end 分行。漫画 manga 用 mixed（假名直立 + 拉丁旋转）。Ruby 注音竖排时自动到字符右侧。表单 input/textarea 也可竖排输入。标点自动旋转到右上角。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 8：实战：多语言国际化 ===================

  _readI18nInfo() {
    const f = this._flags();
    try {
      return `===== 实战：多语言国际化 =====\n` +
        `\n` +
        `【场景 1：阿拉伯语 RTL 切换】\n` +
        `  html[dir="rtl"] 或 html[lang="ar"]\n` +
        `  html[lang="ar"] body {\n` +
        `    direction: rtl;\n` +
        `    text-align: start;   /* RTL 时 = right */\n` +
        `  }\n` +
        `  /* 用逻辑属性自动适配 */\n` +
        `  .card {\n` +
        `    margin-inline-start: 20px;  /* LTR = left, RTL = right */\n` +
        `    padding-inline: 16px;\n` +
        `    inset-inline-start: 0;\n` +
        `  }\n` +
        `\n` +
        `【场景 2：希伯来文 RTL】\n` +
        `  希伯来文也是 RTL（与阿拉伯语相同处理）\n` +
        `  html[lang="he"] body { direction: rtl; }\n` +
        `  数字（如电话号码）用 unicode-bidi: isolate 防止翻转\n` +
        `\n` +
        `【场景 3：双向 URL】\n` +
        `  URL 中混合拉丁字母 + 阿拉伯字符\n` +
        `  .url {\n` +
        `    unicode-bidi: plaintext;  /* 按内容自动判断方向 */\n` +
        `    direction: ltr;           /* URL 默认 LTR */\n` +
        `  }\n` +
        `  防止 bidi 算法错误翻转 URL 中的斜杠和点\n` +
        `\n` +
        `【场景 4：国际化设计系统】\n` +
        `  设计系统用逻辑属性 + CSS 变量适配多语言\n` +
        `  :root {\n` +
        `    --space-inline-start: 20px;\n` +
        `    --space-block-start: 16px;\n` +
        `  }\n` +
        `  .component {\n` +
        `    margin-inline-start: var(--space-inline-start);\n` +
        `    margin-block-start: var(--space-block-start);\n` +
        `  }\n` +
        `  /* RTL 时无需改 CSS，逻辑属性自动翻转 */\n` +
        `\n` +
        `【场景 5：logical properties 全套替换物理属性】\n` +
        `  物理属性          → 逻辑属性\n` +
        `  width             → inline-size\n` +
        `  height            → block-size\n` +
        `  margin-top        → margin-block-start\n` +
        `  margin-left       → margin-inline-start\n` +
        `  padding-left      → padding-inline-start\n` +
        `  top               → inset-block-start\n` +
        `  left              → inset-inline-start\n` +
        `  text-align: left  → text-align: start\n` +
        `  text-align: right → text-align: end\n` +
        `  float: left       → float: inline-start\n` +
        `  float: right      → float: inline-end\n` +
        `  clear: left       → clear: inline-start\n` +
        `\n` +
        `【场景 6：DevTools 调试 bidi】\n` +
        `  Chrome DevTools：\n` +
        `    Elements 面板 → Computed → 查看 direction / unicode-bidi 计算值\n` +
        `    可视化 bidi 嵌入层级（需启用实验功能）\n` +
        `  Firefox DevTools：\n` +
        `    更强大的 bidi 调试：显示 bidi 嵌入层级\n` +
        `    Layout 面板查看 writing-mode / direction\n` +
        `\n` +
        `【能力检测】\n` +
        `  direction: rtl 支持 = ${f.directionRtl}\n` +
        `  unicode-bidi: isolate 支持 = ${f.unicodeBidiIsolate}`;
    } catch (err) {
      return `读取多语言国际化信息失败：${err.name} - ${err.message}`;
    }
  }

  _runI18nDemo() {
    this.setState({ i18nInfo: this._readI18nInfo() });
    this._addLog('i18n', `多语言国际化演示：direction:rtl=${this._flags().directionRtl}`);
  }

  _renderCard8() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 实战：多语言国际化 —— 阿拉伯/希伯来 RTL / 双向 URL / 设计系统 / DevTools',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['direction:rtl', f.directionRtl], ['unicode-bidi:isolate', f.unicodeBidiIsolate]]),
        h(Tag, { color: 'primary' }, '6 大场景'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '多语言国际化六大场景：阿拉伯语 RTL 切换（html[lang="ar"] + direction: rtl + 逻辑属性自动适配）、希伯来文 RTL（同阿拉伯语处理，数字用 isolate 防翻转）、双向 URL（unicode-bidi: plaintext + direction: ltr 防 bidi 错误翻转斜杠点）、国际化设计系统（逻辑属性 + CSS 变量，一套样式适配所有语言）、logical properties 全套替换物理属性（width→inline-size、margin-left→margin-inline-start、text-align: left→start 等）、DevTools 调试 bidi（Chrome Computed 查看计算值，Firefox 显示 bidi 嵌入层级）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取国际化信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runI18nDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'RTL vs LTR 对比演示：'),
        h('div', { class: 'i18n-stage' },
          h('div', { class: 'ltr-demo' },
            'LTR（左到右）：Hello World 1234 — 默认方向，从左到右阅读',
          ),
          h('div', { class: 'rtl-demo' },
            'RTL（右到左）：مرحبا بالعالم 1234 — 阿拉伯语方向，从右到左阅读',
          ),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.i18nInfo || '（点击按钮查看 6 大国际化场景完整代码）')),
        h(Alert, {
          type: 'info',
          message: '用逻辑属性 + direction: rtl 实现一套样式适配所有语言',
          description: '国际化最佳实践：用逻辑属性（inline-size/margin-inline-start/inset-inline-start）替代物理属性，direction: rtl 切换阿拉伯/希伯来语，逻辑属性自动翻转无需改 CSS。URL 用 unicode-bidi: plaintext + direction: ltr 防 bidi 错误。设计系统用逻辑属性 + CSS 变量，一套样式适配 LTR/RTL/竖排。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== 日志面板（按时间倒序，最新在上）===================

  _renderLogPanel() {
    const s = this.state;
    const reversed = [...s.logs].reverse();   // 按时间倒序：最新日志在最上方
    return h('div', { class: 'log-panel' },
      h('div', { class: 'log-panel__header' },
        '事件日志（按时间倒序）',
        h(Tag, { color: 'primary' }, `${s.logs.length} 条`),
      ),
      reversed.length === 0
        ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
        : reversed.map((log) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  // =================== 整页渲染 ===================

  render() {
    const s = this.state;
    return h('div', { class: 'api-lab-page css-writing-modes-page' },
      h('h2', { class: 'section-title' }, 'CSS Writing Modes Level 3/4 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页演示 CSS Writing Modes Module Level 3/4 书写模式：writing-mode 属性（horizontal-tb / vertical-rl / vertical-lr / sideways）、direction 与 unicode-bidi（LTR/RTL + bidi 算法 + 双向文本嵌入）、text-orientation 属性（mixed CJK 直立 / upright 全直立 / sideways 全旋转）、逻辑属性基础（inline-size / block-size / margin-block / inset-block）、嵌套 writing-mode 与混合方向（父横子竖 / 表格竖排标题 / 逻辑属性自适应）、中日韩竖排文学（古诗 / 报纸 / 漫画 / Ruby / 表单 / 标点）、多语言国际化（阿拉伯/希伯来 RTL / 双向 URL / 设计系统 / logical properties 全套替换）。所有特性通过 typeof / CSS.supports 能力检测，不可用时仅记日志，绝不抛异常。'),
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
