// =====================================================================
// CSSFontTypographyDeepPage.js —— CSS 字体与排版高级特性 实验室
// 演示字体加载、OpenType 特性、可变字体、彩色字体、CJK 排版等高价值但
// 常被忽视的特性，覆盖现代 CSS Fonts Module Level 4/5 + CSS Text Module L4：
//   1. @font-palette-values + font-palette —— COLRv1 彩色字体调色板自定义
//      （Chrome 101+）让 emoji/图标字体的颜色可被开发者改写，替代 PNG/SVG 图标
//   2. font-synthesis-weight/style/small-caps —— 控制浏览器是否合成缺失字重/
//      斜体/小型大写字母；默认合成的伪斜体/伪粗在专业排版中常需禁用
//   3. @font-face 描述符全家桶 —— src/format()/tech()/local()、unicode-range
//      子集化、size-adjust + ascent-override/descent-override/line-gap-override
//      字体度量覆盖（解决 fallback 字体尺寸不匹配导致布局抖动）、font-display
//      加载策略（swap/fallback/optional/block）
//   4. font-feature-settings + @font-feature-values —— OpenType 特性深潜
//      （ligatures 连字、kerning 字偶距、small-caps 小型大写、stylistic sets
//      风格集、numerals 数字风格 tabular-nums/oldstyle-nums/proportional-nums、
//      swash 花体、contextual 上下文替代等）+ @font-feature-values 命名复用
//   5. font-variation-settings —— 可变字体（Variable Fonts）深潜
//      注册轴 wght/wdth/ital/slnt/opsz + 自定义轴（大写如 INFO/GRAD/CASL 等）
//      + font-weight/font-stretch/font-style 简写映射 + 多轴协同动画
//   6. CJK 排版特性 —— text-spacing-trim（CJK 标点压缩）、hanging-punctuation
//      （标点悬挂）、word-break: auto-phrase（日语形态学断词）、text-autospace
//      （CJK 与拉丁字符间自动加空隙）、line-break: strict/loose/anywhere、
//      overflow-wrap: anywhere、text-align: justify + text-justify: inter-character
// 说明：jsdom 不做真实 CSS 渲染，本页用 CSS.supports() + FontFace API 检测能力
//       并展示完整代码示例；真实浏览器可查看字体效果。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class CSSFontTypographyDeepPage extends Page {
    _inited = false;
    _dynamicStyles = [];
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            paletteInfo: '', // Card 1：@font-palette-values
            synthesisInfo: '', // Card 2：font-synthesis-*
            fontFaceInfo: '', // Card 3：@font-face 全家桶
            featureSettingsInfo: '', // Card 4：font-feature-settings
            variationInfo: '', // Card 5：font-variation-settings
            cjkInfo: '', // Card 6：CJK 排版
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
            `@font-palette-values ${c(f.palette)}`,
            `font-synthesis-weight ${c(f.synthWeight)}`,
            `font-synthesis-style ${c(f.synthStyle)}`,
            `font-synthesis-small-caps ${c(f.synthSmallCaps)}`,
            `unicode-range ${c(f.unicodeRange)}`,
            `size-adjust ${c(f.sizeAdjust)}`,
            `ascent-override ${c(f.ascentOverride)}`,
            `font-display ${c(f.fontDisplay)}`,
            `font-feature-settings ${c(f.featureSettings)}`,
            `@font-feature-values ${c(f.featureValues)}`,
            `font-variation-settings ${c(f.variationSettings)}`,
            `text-spacing-trim ${c(f.textSpacingTrim)}`,
            `hanging-punctuation ${c(f.hangingPunctuation)}`,
            `word-break:auto-phrase ${c(f.autoPhrase)}`,
            `text-autospace ${c(f.autospace)}`,
            `FontFace API ${c(f.fontFaceAPI)}`,
        ];
        const summary = f.css
            ? `CSS 字体排版能力检测：${parts.join(' · ')}。jsdom 不做真实渲染，按钮点击将注入演示样式 + 展示完整代码示例；真实浏览器可查看字体效果。`
            : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击仅记日志说明，不会抛异常。';
        this.setState({ capsSummary: summary });
        this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!f.palette)
            this._addLog('warn', '@font-palette-values 不可用（Chrome 101+ 才支持）');
        if (!f.variationSettings)
            this._addLog('warn', 'font-variation-settings 不可用（Chrome 62+ 才支持）');
        if (!f.autoPhrase)
            this._addLog('warn', 'word-break: auto-phrase 不可用（Chrome 119+ 才支持，日语形态学断词）');
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
            // Card 1
            palette: supportsPV('font-palette', 'dark') ||
                supportsPV('@font-palette-values', '--x'),
            // Card 2
            synthWeight: supportsPV('font-synthesis-weight', 'auto'),
            synthStyle: supportsPV('font-synthesis-style', 'auto'),
            synthSmallCaps: supportsPV('font-synthesis-small-caps', 'auto'),
            // Card 3
            unicodeRange: supportsPV('unicode-range', 'U+0-7F'),
            sizeAdjust: supportsPV('size-adjust', '100%'),
            ascentOverride: supportsPV('ascent-override', '90%'),
            descentOverride: supportsPV('descent-override', '20%'),
            lineGapOverride: supportsPV('line-gap-override', '0%'),
            fontDisplay: supportsPV('font-display', 'swap'),
            // Card 4
            featureSettings: supportsPV('font-feature-settings', '"liga" 1'),
            featureValues: supportsPV('@font-feature-values', '--x'),
            // Card 5
            variationSettings: supportsPV('font-variation-settings', '"wght" 400'),
            // Card 6
            textSpacingTrim: supportsPV('text-spacing-trim', 'space-all'),
            hangingPunctuation: supportsPV('hanging-punctuation', 'first'),
            autoPhrase: supportsPV('word-break', 'auto-phrase'),
            autospace: supportsPV('text-autospace', 'ideograph-alpha'),
            // FontFace API
            fontFaceAPI: typeof FontFace !== 'undefined',
        };
    }
    // ===================== Card 1：@font-palette-values =====================
    _runPaletteDemo() {
        const f = this._flags();
        this._injectStyle('css-palette-demo', `
      @font-face {
        font-family: "NotoColorEmoji";
        src: local("Noto Color Emoji");
      }
      /* 默认调色板 */
      .css-palette-demo .pd-default {
        font-family: "NotoColorEmoji", sans-serif;
        font-size: 48px;
      }
      /* 自定义调色板 1：暗色主题 */
      @font-palette-values --dark {
        font-family: "NotoColorEmoji";
        base-palette: 1;             /* 使用字体第 2 个内置调色板 */
      }
      .css-palette-demo .pd-dark {
        font-family: "NotoColorEmoji", sans-serif;
        font-palette: --dark;
        font-size: 48px;
      }
      /* 自定义调色板 2：改写特定颜色索引 */
      @font-palette-values --custom {
        font-family: "NotoColorEmoji";
        base-palette: 0;
        override-color: 0 #3b82f6;   /* 覆盖第 0 号颜色为蓝色 */
        override-color: 1 #ef4444;   /* 覆盖第 1 号颜色为红色 */
      }
      .css-palette-demo .pd-custom {
        font-family: "NotoColorEmoji", sans-serif;
        font-palette: --custom;
        font-size: 48px;
      }
    `);
        const info = [
            '===== @font-palette-values + font-palette —— COLRv1 彩色字体调色板 =====',
            '',
            '【动机】COLRv1 彩色字体（如 Noto Color Emoji、Bootstrap Icons、',
            '        Font Awesome 等）内置多套调色板，但传统 CSS 无法改写颜色',
            '        只能用字体内置的固定配色，深色模式下 emoji 看不清',
            '',
            '【语法】',
            '  @font-palette-values --<name> {',
            '    font-family: "<font-name>";     /* 必填，指定字体 */',
            '    base-palette: <integer>;        /* 选择字体内置的第几套调色板 */',
            '    override-color: <index> <color>; /* 覆盖特定颜色索引 */',
            '  }',
            '',
            '  .emoji-dark {',
            '    font-family: "NotoColorEmoji", sans-serif;',
            '    font-palette: --dark;            /* 应用自定义调色板 */',
            '  }',
            '',
            '【完整示例】',
            '  @font-face {',
            '    font-family: "NotoColorEmoji";',
            '    src: local("Noto Color Emoji");',
            '  }',
            '',
            '  @font-palette-values --dark {',
            '    font-family: "NotoColorEmoji";',
            '    base-palette: 1;                 /* 使用字体内置的暗色调色板 */',
            '  }',
            '',
            '  @font-palette-values --custom {',
            '    font-family: "NotoColorEmoji";',
            '    base-palette: 0;                 /* 基于第 0 套调色板 */',
            '    override-color: 0 #3b82f6;       /* 覆盖第 0 号颜色为蓝色 */',
            '    override-color: 1 #ef4444;       /* 覆盖第 1 号颜色为红色 */',
            '  }',
            '',
            '  .emoji-dark { font-palette: --dark; }',
            '  .emoji-custom { font-palette: --custom; }',
            '',
            '【调色板索引查询】',
            '  字体内置调色板的数量与每套的颜色索引由字体文件定义',
            '  Chrome DevTools → Elements → Computed 可查看当前应用的调色板',
            '  字体工具 fonttools (Python) 可解析 COLRv1 字体调色板',
            '',
            '【font-palette 取值】',
            '  normal       - 使用字体默认调色板（base-palette: 0）',
            '  light        - 使用字体的 light 调色板（如有）',
            '  dark         - 使用字体的 dark 调色板（如有）',
            '  --<name>     - 使用 @font-palette-values 定义的自定义调色板',
            '',
            '【配合 prefers-color-scheme 自动切换】',
            '  :root { font-palette: light; }',
            '  @media (prefers-color-scheme: dark) {',
            '    :root { font-palette: dark; }',
            '  }',
            '',
            '【应用场景】',
            '  1. Emoji 深色模式适配（默认黄脸在深色背景过亮）',
            '  2. 图标字体主题色定制（Bootstrap Icons 单色图标改色）',
            '  3. 品牌色统一（多个图标字体统一企业色）',
            '  4. 动态调色板（配合 JS 切换 font-palette 实现图标变色动画）',
            '',
            '【vs SVG/PNG 图标】',
            '  SVG/PNG：每个图标独立文件，改色需修改文件或用 mask',
            '  COLRv1 字体：所有图标在一个字体文件，调色板统一管理，',
            '              改色只需改 @font-palette-values，体积更小',
            '',
            `CSS.supports('font-palette', 'dark') = ${f.palette}`,
            '',
            '===== 状态（截至 2025）=====',
            '  Chrome 101+ / Edge 101+ / Firefox 107+ 支持',
            '  Safari 17.4+ 支持 COLRv1 字体渲染 + @font-palette-values',
            '  规范来源：https://www.w3.org/TR/css-fonts-4/#font-palette-values',
        ].join('\n');
        this.setState({ paletteInfo: info });
        this._addLog('css', `@font-palette-values 演示完成；supports=${f.palette}`);
    }
    _renderCard1() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '1. @font-palette-values + font-palette —— COLRv1 彩色字体调色板',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['@font-palette-values', f.palette]]), h(Tag, { color: 'primary' }, 'Fonts L4')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'COLRv1 彩色字体（Noto Color Emoji / Bootstrap Icons）内置多套调色板，@font-palette-values 让开发者改写调色板：base-palette 选择内置第 N 套调色板，override-color 覆盖特定颜色索引。font-palette 应用自定义调色板（normal/light/dark/--name）。配合 prefers-color-scheme 实现 Emoji 深色模式适配，替代 SVG/PNG 图标的繁琐改色方案。Chrome 101+ 支持。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 @font-palette-values 演示', { type: 'primary', size: 'sm', onClick: () => this._runPaletteDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.paletteInfo || '（点击按钮查看 @font-palette-values 完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 2：font-synthesis-* =====================
    _runSynthesisDemo() {
        const f = this._flags();
        this._injectStyle('css-synthesis-demo', `
      .css-synthesis-demo .sd-box {
        font-family: "Helvetica Neue", Arial, sans-serif;
        padding: 12px;
        margin: 8px 0;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
      }
      /* 默认：浏览器会合成缺失的字重/斜体 */
      .css-synthesis-demo .sd-default-bold { font-weight: 800; }
      .css-synthesis-demo .sd-default-italic { font-style: italic; }
      /* 禁用合成：缺失字重时不合成伪粗 */
      .css-synthesis-demo .sd-no-synth-bold {
        font-weight: 800;
        font-synthesis-weight: none;
      }
      /* 禁用斜体合成 */
      .css-synthesis-demo .sd-no-synth-italic {
        font-style: italic;
        font-synthesis-style: none;
      }
      /* 禁用小型大写字母合成 */
      .css-synthesis-demo .sd-no-synth-smallcaps {
        font-variant-caps: small-caps;
        font-synthesis-small-caps: none;
      }
    `);
        const info = [
            '===== font-synthesis-* —— 字体合成控制 =====',
            '',
            '【动机】当 CSS 请求字重 700（bold）但字体文件只有 400（regular）时，',
            '        浏览器会自动「合成」伪粗体（描边算法加粗），效果远不如真粗体',
            '        同理斜体缺失会合成「伪斜体」（倾斜变换），专业排版常需禁用',
            '',
            '【font-synthesis 简写】',
            '  font-synthesis: none;                          /* 禁用所有合成 */',
            '  font-synthesis: weight style;                  /* 允许粗体+斜体合成（默认）*/',
            '  font-synthesis: weight style small-caps;       /* L4 新增 small-caps */',
            '',
            '【单独控制属性（CSS Fonts L4）】',
            '  font-synthesis-weight: auto | none;',
            '    auto  - 缺失字重时合成伪粗（默认）',
            '    none  - 不合成，缺失字重回退到最接近的可用字重',
            '',
            '  font-synthesis-style: auto | none;',
            '    auto  - 缺失斜体时合成伪斜体（默认）',
            '    none  - 不合成，font-style: italic 回退到 oblique 或 regular',
            '',
            '  font-synthesis-small-caps: auto | none;',
            '    auto  - 缺失小型大写字母时合成（缩放算法）（默认）',
            '    none  - 不合成，font-variant-caps: small-caps 回退',
            '',
            '【示例】',
            '  /* 默认：合成伪粗 + 伪斜体 */',
            '  .default-bold { font-weight: 800; }            /* 字体无 800，合成伪粗 */',
            '  .default-italic { font-style: italic; }        /* 字体无 italic，合成伪斜 */',
            '',
            '  /* 专业排版：禁用合成，确保使用真粗体/真斜体 */',
            '  .pro {',
            '    font-synthesis: none;                        /* 禁用所有合成 */',
            '    font-weight: 800;                            /* 字体无 800，回退到 400 */',
            '    font-style: italic;                          /* 字体无 italic，回退 regular */',
            '  }',
            '',
            '  /* 仅禁用粗体合成，允许斜体合成 */',
            '  .mixed {',
            '    font-synthesis-weight: none;',
            '    font-synthesis-style: auto;',
            '  }',
            '',
            '【何时禁用合成】',
            '  1. 专业排版（出版/品牌官网）：伪粗/伪斜效果差，禁用并加载真字重',
            '  2. 设计系统：确保字体一致性，合成会导致字重不匹配',
            '  3. 性能：合成算法消耗 CPU，禁用可微优化（边际收益）',
            '  4. 可访问性：合成粗体对比度可能不达标（WCAG AA 4.5:1）',
            '',
            '【vs 加载真字重】',
            '  禁用合成后，缺失字重会回退到最接近的可用字重：',
            '    请求 700，字体有 400/900 → 回退到 900（更接近）',
            '    请求 300，字体有 400/700 → 回退到 400',
            '  最佳实践：用 @font-face 显式加载所需字重',
            '    @font-face { font-family: "Pro"; font-weight: 700; src: url(pro-700.woff2); }',
            '    @font-face { font-family: "Pro"; font-weight: 800; src: url(pro-800.woff2); }',
            '',
            `CSS.supports('font-synthesis-weight', 'auto') = ${f.synthWeight}`,
            `CSS.supports('font-synthesis-style', 'auto') = ${f.synthStyle}`,
            `CSS.supports('font-synthesis-small-caps', 'auto') = ${f.synthSmallCaps}`,
            '',
            '===== 状态（截至 2025）=====',
            '  font-synthesis（简写）全浏览器支持',
            '  font-synthesis-weight/style Chrome 97+/Firefox 113+/Safari 16.4+',
            '  font-synthesis-small-caps Chrome 120+/Safari 17.4+（Firefox 暂未实现）',
            '  规范来源：https://www.w3.org/TR/css-fonts-4/#font-synthesis',
        ].join('\n');
        this.setState({ synthesisInfo: info });
        this._addLog('css', `font-synthesis 演示完成；weight=${f.synthWeight}, style=${f.synthStyle}`);
    }
    _renderCard2() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '2. font-synthesis-weight/style/small-caps —— 字体合成控制',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['synth-weight', f.synthWeight],
                ['synth-style', f.synthStyle],
                ['synth-small-caps', f.synthSmallCaps],
            ]), h(Tag, { color: 'primary' }, 'Fonts L4')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '字体缺失某字重/斜体/小型大写时，浏览器默认会合成伪粗/伪斜/伪小型大写（效果差）。font-synthesis-weight/style/small-caps 分别控制是否合成（auto/none）。专业排版应禁用合成并加载真字重，确保设计一致性与 WCAG 对比度。font-synthesis 简写可一次性设置 weight style small-caps。Chrome 97+ 支持 weight/style，Chrome 120+ 支持 small-caps。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 font-synthesis 演示', { type: 'primary', size: 'sm', onClick: () => this._runSynthesisDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '480px', overflow: 'auto' } }, h('code', {}, s.synthesisInfo || '（点击按钮查看 font-synthesis 完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 3：@font-face 全家桶 =====================
    _runFontFaceDemo() {
        const f = this._flags();
        const info = [
            '===== @font-face 描述符全家桶 =====',
            '',
            '【基础语法】',
            '  @font-face {',
            '    font-family: "MyFont";         /* 必填：自定义字体名 */',
            '    src: url(font.woff2) format("woff2");  /* 必填：字体文件源 */',
            '    font-weight: 400;              /* 可选：字重范围 */',
            '    font-style: normal;            /* 可选：样式 */',
            '    font-display: swap;            /* 可选：加载策略 */',
            '    unicode-range: U+0-7F;         /* 可选：Unicode 子集 */',
            '    font-stretch: normal;          /* 可选：拉伸 */',
            '  }',
            '',
            '【src 描述符：format() + tech()】',
            '  src: url(font.woff2) format("woff2"),',
            '       url(font.woff) format("woff"),',
            '       local("Helvetica Neue Bold");   /* 优先使用本地字体 */',
            '',
            '  /* format() 取值（CSS Fonts L4 新增） */',
            '  format("woff2")         - WOFF 2.0（推荐，压缩率最高）',
            '  format("woff")          - WOFF 1.0',
            '  format("opentype")      - OTF',
            '  format("truetype")      - TTF',
            '  format("collection")    - TTC（字体集合）',
            '  format("woff2-variations") - 可变字体 WOFF2',
            '',
            '  /* tech() 描述符（L4 新增，更精确的能力检测） */',
            '  src: url(font.woff2) format("woff2") tech("color-COLRv1"),',
            '       url(font.svg) format("svg") tech("color-SVG");',
            '  tech 取值：',
            '    "variations"     - 可变字体',
            '    "color-COLRv0/v1" - COLR 彩色字体',
            '    "color-SVG"      - SVG 彩色字体',
            '    "color-CDLC/CBDT" - 位图彩色字体',
            '    "features-aat/open" - OpenType/AAT 特性',
            '',
            '【unicode-range —— 子集化】',
            '  /* 拉丁字符子集 */',
            '  @font-face {',
            '    font-family: "MyFont";',
            '    src: url(myfont-latin.woff2) format("woff2");',
            '    unicode-range: U+0000-00FF, U+0131, U+0152-0153;',
            '  }',
            '  /* CJK 字符子集 */',
            '  @font-face {',
            '    font-family: "MyFont";',
            '    src: url(myfont-cjk.woff2) format("woff2");',
            '    unicode-range: U+4E00-9FFF, U+3000-303F, U+FF00-FFEF;',
            '  }',
            '  浏览器仅加载页面用到的字符子集，大幅减少 CJK 字体体积',
            '',
            '【font-display —— 加载策略】',
            '  font-display: auto;       /* 浏览器决定（通常等同 block）*/',
            '  font-display: block;      /* 短期隐藏文本（3s），加载后切换 */',
            '  font-display: swap;       /* 立即显示 fallback，加载后切换（推荐）*/',
            '  font-display: fallback;   /* 短期 fallback（100ms），加载后切换 */',
            '  font-display: optional;   /* 短期 fallback（100ms），加载成功才用 */',
            '  时序：block = 3s 隐藏 + 无限 swap',
            '        swap = 0s 隐藏 + 无限 swap',
            '        fallback = 100ms 隐藏 + 3s swap',
            '        optional = 100ms 隐藏 + 0s swap',
            '',
            '【字体度量覆盖（CSS Fonts L4）—— 解决 fallback 抖动】',
            '  问题：fallback 字体（如 Arial）与目标字体度量不同，加载后高度',
            '        变化导致布局抖动（CLS）',
            '  方案：用 ascent-override/descent-override/line-gap-override 强制',
            '        fallback 字体模拟目标字体的度量',
            '  @font-face {',
            '    font-family: "MyFont-Fallback";',
            '    src: local("Arial");',
            '    ascent-override: 92%;          /* 上行高度 */',
            '    descent-override: 22%;         /* 下行高度 */',
            '    line-gap-override: 0%;         /* 行距 */',
            '    size-adjust: 98%;              /* 整体缩放（关键）*/',
            '  }',
            '  body {',
            '    font-family: "MyFont", "MyFont-Fallback", sans-serif;',
            '  }',
            '  说明：size-adjust 让 fallback 字体宽度匹配目标字体，',
            '        ascent/descent/line-gap 让高度匹配，加载后切换无抖动',
            '',
            '【FontFace API（JS 动态加载）】',
            '  const font = new FontFace("MyFont", "url(font.woff2)", {',
            '    style: "normal",',
            '    weight: "400"',
            '  });',
            '  await font.load();              // 加载字体',
            '  document.fonts.add(font);       // 加入字体集',
            '  // 现在 font-family: "MyFont" 可用',
            '',
            '  /* FontFaceSet API：检测字体加载状态 */',
            '  await document.fonts.ready;     // 所有字体加载完成',
            '  document.fonts.check("16px MyFont");  // 检查是否已加载',
            '',
            '【加载策略最佳实践】',
            '  1. 优先 WOFF2（压缩率最高）',
            '  2. preload 关键字体：<link rel="preload" href="font.woff2" as="font" type="font/woff2" crossorigin>',
            '  3. 子集化：用 unicode-range 拆分拉丁/CJK 子集',
            '  4. font-display: swap（正文）/ optional（装饰字体）',
            '  5. 度量覆盖：创建 fallback 字体 @font-face 模拟目标字体度量',
            '  6. 自托管字体（隐私 + 性能，避免 Google Fonts 第三方延迟）',
            '',
            `CSS.supports('unicode-range', 'U+0-7F') = ${f.unicodeRange}`,
            `CSS.supports('size-adjust', '100%') = ${f.sizeAdjust}`,
            `CSS.supports('ascent-override', '90%') = ${f.ascentOverride}`,
            `CSS.supports('font-display', 'swap') = ${f.fontDisplay}`,
            `FontFace API = ${f.fontFaceAPI}`,
            '',
            '===== 状态（截至 2025）=====',
            '  @font-face 基础全浏览器支持',
            '  tech() Chrome 108+/Firefox 暂未实现',
            '  size-adjust/ascent-override/descent-override Chrome 87+/Firefox 89+',
            '  FontFace API Chrome 35+/Firefox 41+/Safari 10+',
            '  规范来源：https://www.w3.org/TR/css-fonts-4/#font-face',
        ].join('\n');
        this.setState({ fontFaceInfo: info });
        this._addLog('css', `@font-face 演示完成；size-adjust=${f.sizeAdjust}, FontFace=${f.fontFaceAPI}`);
    }
    _renderCard3() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '3. @font-face 全家桶（src/format/tech/unicode-range/font-display/度量覆盖）',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['unicode-range', f.unicodeRange],
                ['size-adjust', f.sizeAdjust],
                ['ascent-override', f.ascentOverride],
                ['font-display', f.fontDisplay],
                ['FontFace API', f.fontFaceAPI],
            ]), h(Tag, { color: 'primary' }, 'Fonts L4')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '@font-face 全家桶：src 配 format()/tech() 精确指定字体格式与能力、unicode-range 子集化（仅加载用到的字符，CJK 字体体积优化关键）、font-display 加载策略（swap/fallback/optional 避免 FOIT）、字体度量覆盖（size-adjust + ascent/descent/line-gap-override 让 fallback 字体模拟目标字体度量，消除 CLS 布局抖动）、FontFace API（JS 动态加载 + document.fonts.ready 检测）。配合 preload + 自托管优化性能。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 @font-face 演示', { type: 'primary', size: 'sm', onClick: () => this._runFontFaceDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } }, h('code', {}, s.fontFaceInfo || '（点击按钮查看 @font-face 完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 4：font-feature-settings + @font-feature-values =====================
    _runFeatureSettingsDemo() {
        const f = this._flags();
        this._injectStyle('css-feature-demo', `
      .css-feature-demo .fd-box {
        font-family: "Fira Code", "JetBrains Mono", monospace;
        padding: 8px;
        margin: 6px 0;
        border-left: 3px solid #6366f1;
        background: #f8fafc;
      }
      /* 连字（liga/calt） */
      .css-feature-demo .fd-ligatures { font-feature-settings: "liga" 1, "calt" 1; }
      /* 禁用连字 */
      .css-feature-demo .fd-no-ligatures { font-feature-settings: "liga" 0, "calt" 0; }
      /* 小型大写 */
      .css-feature-demo .fd-small-caps { font-feature-settings: "smcp" 1; }
      /* 等宽数字（表格对齐） */
      .css-feature-demo .fd-tabular { font-feature-settings: "tnum" 1; }
      /* 旧式数字（text figure） */
      .css-feature-demo .fd-oldstyle { font-feature-settings: "onum" 1; }
      /* 风格集（stylistic set 1） */
      .css-feature-demo .fd-stylistic { font-feature-settings: "ss01" 1; }
      /* 花体（swash） */
      .css-feature-demo .fd-swash { font-feature-settings: "swsh" 1; }
    `);
        const info = [
            '===== font-feature-settings + @font-feature-values —— OpenType 特性深潜 =====',
            '',
            '【动机】OpenType 字体内置丰富的排版特性（连字/字偶距/小型大写/数字风格等），',
            '        传统 CSS 无法访问，font-feature-settings 是控制这些特性的钥匙',
            '',
            '【font-feature-settings 语法】',
            '  font-feature-settings: "<tag>" <0|1> [on|off];',
            '  多个特性逗号分隔',
            '  font-feature-settings: "liga" 1, "kern" 1, "tnum" 1;',
            '',
            '【常见 OpenType 特性 tag】',
            '  连字类：',
            '    liga   - 标准连字（fi/fl → 连字字形）',
            '    dlig   - discretionary 连字（装饰性，如 ct/st）',
            '    clig   - 上下文连字',
            '    calt   - 上下文替代（默认开启，影响如 → => 等）',
            '  字偶距：',
            '    kern   - 字偶距调整（kerning，默认开启）',
            '  大小写：',
            '    smcp   - 小型大写字母（Small Caps）',
            '    c2sc   - 大写转小型大写',
            '    pcap   - 小型大写（petite caps）',
            '  数字风格：',
            '    tnum   - 等宽数字（tabular nums，表格对齐）',
            '    pnum   - 比例数字（proportional nums，正文）',
            '    onum   - 旧式数字（oldstyle nums，有升降）',
            '    lnum   - 行宽数字（lining nums，齐线）',
            '    frac   - 自动分数（1/2 → ½）',
            '    sups   - 上标',
            '    subs   - 下标',
            '    zero   - 带斜线零（区分 O 与 0）',
            '  风格集：',
            '    ss01-ss20 - 风格集（Stylistic Sets，字体定义的备选字形）',
            '  花体：',
            '    swsh   - 花体（Swash，装饰性大写字母尾巴）',
            '    cswh   - 上下文花体',
            '  上下文替代：',
            '    calt   - 上下文替代（默认开启）',
            '    rclt   - 必需上下文替代',
            '  本地化：',
            '    locl   - 本地化字形（如塞尔维亚 Cyrillic 字形）',
            '',
            '【高级属性（推荐用属性而非 font-feature-settings）】',
            '  font-kerning: normal | none | auto;             /* kern */',
            '  font-variant-ligatures: common-ligatures;      /* liga+clig */',
            '  font-variant-ligatures: no-discretionary-ligatures; /* dlig 0 */',
            '  font-variant-caps: small-caps;                 /* smcp */',
            '  font-variant-numeric: tabular-nums;            /* tnum */',
            '  font-variant-numeric: oldstyle-nums;           /* onum */',
            '  font-variant-numeric: lining-nums;             /* lnum */',
            '  font-variant-numeric: diagonal-fractions;      /* frac */',
            '  优势：高级属性语义化，浏览器智能处理，优先使用',
            '',
            '【@font-feature-values —— 命名复用特性集】',
            '  动机：不同字体的 ss01 含义不同（A 字体的 ss01 是圆角 a，',
            '        B 字体的 ss01 是单层 g），CSS 难统一',
            '  方案：@font-feature-values 命名映射',
            '  @font-feature-values "FontA" {',
            '    @styleset {',
            '      rounded-a: 1;       /* FontA 的 ss01 命名为 rounded-a */',
            '    }',
            '  }',
            '  @font-feature-values "FontB" {',
            '    @styleset {',
            '      rounded-a: 1;       /* FontB 的 ss01 也命名为 rounded-a */',
            '    }',
            '  }',
            '  .text {',
            '    font-family: "FontA", "FontB";',
            '    font-variant-alternates: styleset(rounded-a);  /* 统一引用 */',
            '  }',
            '',
            '  /* @font-feature-values 子规则 */',
            '  @stylistic    - ss01-ss20 风格集',
            '  @styleset     - ss01-ss20 风格集（多值）',
            '  @character-variant - cv01-cv99 字符变体',
            '  @swash        - swsh 花体',
            '  @ornaments    - ornm 装饰',
            '  @annotation   - nalt 注解（如圈号）',
            '',
            '【应用场景】',
            '  1. 等宽编程字体（Fira Code/JetBrains Mono）：开启连字让 => -> !== 等显示为单字形',
            '  2. 金融数据表格：tabular-nums 确保数字列对齐',
            '  3. 标题设计：small-caps 替代大写字母，更优雅',
            '  4. 数学公式：frac 自动分数 + sups/subs 上下标',
            '  5. 多语言：locl 切换塞尔维亚/俄语 Cyrillic 字形',
            '',
            `CSS.supports('font-feature-settings', '"liga" 1') = ${f.featureSettings}`,
            `CSS.supports('@font-feature-values', '--x') = ${f.featureValues}`,
            '',
            '===== 状态（截至 2025）=====',
            '  font-feature-settings 全浏览器支持',
            '  @font-feature-values Chrome 111+/Firefox 34+/Safari 17.4+',
            '  font-variant-* 高级属性 Chrome 52+/Firefox 34+/Safari 9.1+',
            '  规范来源：https://www.w3.org/TR/css-fonts-4/#font-feature-props',
        ].join('\n');
        this.setState({ featureSettingsInfo: info });
        this._addLog('css', `font-feature-settings 演示完成；supports=${f.featureSettings}`);
    }
    _renderCard4() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '4. font-feature-settings + @font-feature-values —— OpenType 特性深潜',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['font-feature-settings', f.featureSettings], ['@font-feature-values', f.featureValues]]), h(Tag, { color: 'primary' }, 'OpenType')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'font-feature-settings 是访问 OpenType 字体特性的钥匙：liga/calt 连字（编程字体 => → 单字形）、kern 字偶距、smcp 小型大写、tnum/onum/lnum 数字风格（表格对齐/旧式/齐线）、frac 分数、ss01-ss20 风格集、swsh 花体、locl 本地化字形。推荐优先用语义化的 font-variant-* 高级属性。@font-feature-values 命名映射不同字体的特性集，统一引用。@font-feature-values 子规则 @stylistic/@styleset/@swash 等。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 font-feature-settings 演示', { type: 'primary', size: 'sm', onClick: () => this._runFeatureSettingsDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } }, h('code', {}, s.featureSettingsInfo || '（点击按钮查看 font-feature-settings 完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 5：font-variation-settings 可变字体 =====================
    _runVariationDemo() {
        const f = this._flags();
        this._injectStyle('css-variation-demo', `
      @font-face {
        font-family: "VariableFont";
        src: local("Inter"), local("Roboto Flex"), local("Noto Sans");
      }
      .css-variation-demo .vd-box {
        font-family: "VariableFont", sans-serif;
        padding: 12px;
        margin: 8px 0;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        transition: font-variation-settings 0.3s;
      }
      /* 注册轴：wght（字重） */
      .css-variation-demo .vd-thin { font-variation-settings: "wght" 100; }
      .css-variation-demo .vd-regular { font-variation-settings: "wght" 400; }
      .css-variation-demo .vd-bold { font-variation-settings: "wght" 800; }
      /* 注册轴：wdth（宽度） */
      .css-variation-demo .vd-condensed { font-variation-settings: "wght" 400, "wdth" 75; }
      .css-variation-demo .vd-expanded { font-variation-settings: "wght" 400, "wdth" 125; }
      /* 注册轴：ital（斜体）+ slnt（倾斜） */
      .css-variation-demo .vd-italic { font-variation-settings: "ital" 1; }
      .css-variation-demo .vd-slant { font-variation-settings: "slnt" -10; }
      /* 注册轴：opsz（视觉尺寸） */
      .css-variation-demo .vd-text { font-variation-settings: "opsz" 14; }
      .css-variation-demo .vd-display { font-variation-settings: "opsz" 60; }
      /* 自定义轴：大写命名（如 GRAD 等级 / CASL 随性 / SOFT 柔和 / MONO 等宽） */
      .css-variation-demo .vd-custom { font-variation-settings: "wght" 600, "GRAD" 100, "CASL" 1; }
      /* 多轴协同动画 */
      .css-variation-demo .vd-animated {
        font-variation-settings: "wght" 400, "wdth" 100;
        animation: vd-breathe 3s ease-in-out infinite;
      }
      @keyframes vd-breathe {
        0%, 100% { font-variation-settings: "wght" 300, "wdth" 110; }
        50%      { font-variation-settings: "wght" 700, "wdth" 90; }
      }
    `);
        const info = [
            '===== font-variation-settings —— 可变字体（Variable Fonts）深潜 =====',
            '',
            '【动机】传统字体：每个字重/宽度/样式是独立文件（400.woff2/700.woff2/...',
            '        可变字体：单个文件包含所有字重/宽度/样式，可无级调节',
            '  优势：',
            '    - 体积更小（一个文件 vs 多个文件）',
            '    - 无级调节（如 450 字重，传统只能 400/700）',
            '    - 可动画化（字重/宽度可平滑过渡）',
            '    - 视觉尺寸优化（opsz 轴根据字号自动调整字形）',
            '',
            '【font-variation-settings 语法】',
            '  font-variation-settings: "<axis>" <value>, "<axis>" <value>;',
            '  轴名 4 字符：小写 = 注册轴（标准化），大写 = 自定义轴（厂商定义）',
            '',
            '【注册轴（5 个标准化轴）】',
            '  wght - 字重（Weight）',
            '    范围：1-1000（如 100 thin / 400 regular / 700 bold / 900 black）',
            '    简写映射：font-weight: 700 ≡ font-variation-settings: "wght" 700',
            '',
            '  wdth - 宽度（Width）',
            '    范围：通常 50-125（如 75 condensed / 100 normal / 125 expanded）',
            '    简写映射：font-stretch: 75% ≡ font-variation-settings: "wdth" 75',
            '',
            '  ital - 斜体（Italic）',
            '    范围：0-1（0 直立 / 1 斜体，二值）',
            '    简写映射：font-style: italic ≡ font-variation-settings: "ital" 1',
            '',
            '  slnt - 倾斜（Slant）',
            '    范围：通常 -20 到 0 度（负值向左倾斜，与 ital 不同是连续值）',
            '    简写映射：font-style: oblique -10deg',
            '',
            '  opsz - 视觉尺寸（Optical Size）',
            '    范围：通常 8-144（小字号字形优化可读性，大字号优化美观）',
            '    简写映射：font-optical-sizing: auto（默认根据字号自动）',
            '    应用：标题用大 opsz（更精致），正文用小 opsz（更清晰）',
            '',
            '【自定义轴（厂商定义，大写命名）】',
            '  GRAD  - 等级（Grade），改变字重但不影响布局（适合暗色模式加粗）',
            '  CASL  - 随性（Casual），字形从正式到随意',
            '  SOFT  - 柔和（Softness），圆角程度',
            '  MONO  - 等宽（Monospace），字符宽度从比例到等宽',
            '  YOPQ  - y-高度（y-opacity），调整 x-height',
            '  查询字体支持的自定义轴：用 fonttools 或浏览器 DevTools',
            '',
            '【多轴协同示例】',
            '  /* 字重 600 + 宽度 90 + 视觉尺寸 60 */',
            '  .display {',
            '    font-variation-settings: "wght" 600, "wdth" 90, "opsz" 60;',
            '  }',
            '',
            '  /* 自定义轴：暗色模式用 GRAD 加粗（不影响布局）*/',
            '  @media (prefers-color-scheme: dark) {',
            '    body { font-variation-settings: "GRAD" 200; }',
            '  }',
            '',
            '【动画化】',
            '  /* 字重呼吸动画 */',
            '  @keyframes breathe {',
            '    0%, 100% { font-variation-settings: "wght" 300, "wdth" 110; }',
            '    50%      { font-variation-settings: "wght" 700, "wdth" 90; }',
            '  }',
            '  .title { animation: breathe 3s ease-in-out infinite; }',
            '',
            '  /* 鼠标悬停字重变化 */',
            '  .btn {',
            '    font-variation-settings: "wght" 400;',
            '    transition: font-variation-settings 0.2s;',
            '  }',
            '  .btn:hover { font-variation-settings: "wght" 700; }',
            '',
            '【简写属性 vs font-variation-settings】',
            '  font-weight: 700        ≡ "wght" 700',
            '  font-stretch: 75%       ≡ "wdth" 75',
            '  font-style: italic      ≡ "ital" 1',
            '  font-style: oblique 10  ≡ "slnt" -10',
            '  font-optical-sizing     ≡ "opsz"（auto 跟随 font-size）',
            '  注意：font-variation-settings 优先级高于简写，会覆盖简写',
            '        推荐用简写属性，仅在访问自定义轴时用 font-variation-settings',
            '',
            '【加载可变字体】',
            '  @font-face {',
            '    font-family: "Inter";',
            '    src: url(Inter.woff2) format("woff2-variations"),',
            '         url(Inter.woff2) format("woff2") tech("variations");',
            '    font-weight: 100 900;          /* 声明支持的字重范围 */',
            '    font-stretch: 75% 125%;        /* 声明宽度范围 */',
            '  }',
            '',
            '【可变字体资源】',
            '  - Google Fonts Variable（筛选 "Variable"）',
            '  - Axis Praxis（axis-praxis.org，可交互测试）',
            '  - Wakamai Fondue（wakamaifondue.com，分析字体支持的轴）',
            '',
            `CSS.supports('font-variation-settings', '"wght" 400') = ${f.variationSettings}`,
            '',
            '===== 状态（截至 2025）=====',
            '  font-variation-settings Chrome 62+/Firefox 62+/Safari 16.4+',
            '  font-optical-sizing Chrome 79+/Firefox 97+/Safari 16.4+',
            '  tech("variations") Chrome 108+',
            '  规范来源：https://www.w3.org/TR/css-fonts-4/#font-variation-props',
        ].join('\n');
        this.setState({ variationInfo: info });
        this._addLog('css', `font-variation-settings 演示完成；supports=${f.variationSettings}`);
    }
    _renderCard5() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '5. font-variation-settings —— 可变字体（Variable Fonts）深潜',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['font-variation-settings', f.variationSettings]]), h(Tag, { color: 'primary' }, '可变字体')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '可变字体单文件包含所有字重/宽度/样式，可无级调节与动画化。5 个注册轴：wght 字重 / wdth 宽度 / ital 斜体 / slnt 倾斜 / opsz 视觉尺寸（小字号清晰、大字号精致）。自定义轴大写命名（GRAD 等级暗色加粗不影响布局 / CASL 随性 / SOFT 柔和 / MONO 等宽）。font-weight/font-stretch/font-style 是简写映射，推荐用简写，自定义轴才用 font-variation-settings。配合 @keyframes 实现字重呼吸动画。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行可变字体演示', { type: 'primary', size: 'sm', onClick: () => this._runVariationDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } }, h('code', {}, s.variationInfo || '（点击按钮查看可变字体完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 6：CJK 排版特性 =====================
    _runCJKDemo() {
        const f = this._flags();
        this._injectStyle('css-cjk-demo', `
      .css-cjk-demo .cjk-box {
        font-family: "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif;
        padding: 12px;
        margin: 8px 0;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        line-height: 1.8;
      }
      /* text-spacing-trim：CJK 标点压缩 */
      .css-cjk-demo .cjk-trim { text-spacing-trim: space-all; }
      .css-cjk-demo .cjk-trim-none { text-spacing-trim: trim-none; }
      /* hanging-punctuation：标点悬挂 */
      .css-cjk-demo .cjk-hang { hanging-punctuation: first last; }
      /* word-break: auto-phrase：日语形态学断词 */
      .css-cjk-demo .cjk-auto-phrase { word-break: auto-phrase; }
      /* text-autospace：CJK 与拉丁字符间自动加空隙 */
      .css-cjk-demo .cjk-autospace { text-autospace: ideograph-alpha ideograph-numeric; }
      /* text-align: justify + text-justify: inter-character */
      .css-cjk-demo .cjk-justify {
        text-align: justify;
        text-justify: inter-character;
      }
    `);
        const info = [
            '===== CJK 排版特性（中文/日文/韩文）=====',
            '',
            '【1. text-spacing-trim —— CJK 标点压缩（CSS Text L4）】',
            '  动机：CJK 标点（，。、！？等）默认占全角宽度，连续标点或行首/行尾',
            '        标点会产生不美观的大空白（如「，」后接「（」会留巨大间隙）',
            '  方案：text-spacing-trim 控制标点压缩行为',
            '',
            '  text-spacing-trim: normal;             /* 默认：压缩连续标点 */',
            '  text-spacing-trim: space-none;          /* 不压缩，全角标点 */',
            '  text-spacing-trim: space-first;         /* 仅首行不压缩 */',
            '  text-spacing-trim: space-start;         /* 行首不压缩 */',
            '  text-spacing-trim: space-end;           /* 行尾不压缩 */',
            '  text-spacing-trim: space-all;           /* 所有位置都不压缩 */',
            '  text-spacing-trim: trim-start;          /* 压缩行首标点 */',
            '  text-spacing-trim: trim-end;            /* 压缩行尾标点 */',
            '  text-spacing-trim: trim-adjacent;       /* 压缩连续标点 */',
            '',
            '【2. hanging-punctuation —— 标点悬挂】',
            '  动机：行首/行尾的标点（如「，」「。」「『」「』」）破坏对齐',
            '        悬挂到行外可让正文边缘整齐',
            '  hanging-punctuation: none;              /* 默认不悬挂 */',
            '  hanging-punctuation: first;             /* 首行行首标点悬挂 */',
            '  hanging-punctuation: last;              /* 末行行尾标点悬挂 */',
            '  hanging-punctuation: force-end;         /* 行尾标点强制悬挂 */',
            '  hanging-punctuation: allow-end;         /* 行尾标点允许悬挂（不破坏对齐时）*/',
            '  hanging-punctuation: w00; w01; w02; w03; /* CJK 类别（提案）*/',
            '',
            '【3. word-break: auto-phrase —— 日语形态学断词（Chrome 119+）】',
            '  动机：日语无空格，长文本换行可能切断词组（如「プロフェッショナル」',
            '        被切断成「プロフェッショ」+「ナル」）',
            '  方案：word-break: auto-phrase 用形态学分析在词组边界换行',
            '',
            '  .japanese {',
            '    word-break: auto-phrase;              /* 形态学断词 */',
            '    line-break: strict;                   /* 严格换行规则 */',
            '  }',
            '  注：需浏览器内置形态学引擎（Vercue 引擎），目前仅 Chrome 119+ 支持',
            '      中文支持较弱（中文形态学更复杂），主要面向日语',
            '',
            '【4. text-autospace —— CJK 与拉丁字符间自动加空隙】',
            '  动机：CJK 字符与拉丁字符相邻时（如「中文ABC」）默认无间隙，',
            '        排版不美观，传统需手写空格「中文 ABC」',
            '  方案：text-autospace 自动在 CJK 与拉丁/数字间加空隙',
            '',
            '  text-autospace: normal;                 /* 默认行为 */',
            '  text-autospace: ideograph-alpha;        /* CJK 与拉丁字母间 */',
            '  text-autospace: ideograph-numeric;      /* CJK 与数字间 */',
            '  text-autospace: ideograph-alpha ideograph-numeric; /* 两者都加 */',
            '  text-autospace: no-autospace;           /* 不加空隙 */',
            '',
            '  示例：',
            '  <p>中文English数字123</p>',
            '  .mixed { text-autospace: ideograph-alpha ideograph-numeric; }',
            '  /* 渲染效果：中文 English 数字 123（视觉上有空隙，DOM 无空格）*/',
            '',
            '【5. line-break —— 换行严格度】',
            '  line-break: auto;       /* 浏览器决定（默认）*/',
            '  line-break: loose;      /* 宽松（短行如新闻标题）*/',
            '  line-break: normal;     /* 正常 */',
            '  line-break: strict;     /* 严格（避免标点行首，如「。」不在行首）*/',
            '  line-break: anywhere;   /* 任意位置换行（破坏词组，紧急情况用）*/',
            '',
            '【6. overflow-wrap vs word-break】',
            '  overflow-wrap: normal;     /* 默认，仅空格处换行 */',
            '  overflow-wrap: break-word; /* 长单词可断行（保留词完整性优先）*/',
            '  overflow-wrap: anywhere;   /* 任意位置断行（影响 min-content 计算）*/',
            '  word-break: break-all;     /* 任意字符断行（CJK 与非 CJK 都断）*/',
            '  word-break: keep-all;      /* CJK 词组不断行（中日韩按词换行）*/',
            '',
            '【7. text-align: justify + text-justify —— 两端对齐】',
            '  text-align: justify;',
            '  text-justify: inter-word;        /* 词间调整（拉丁文）*/',
            '  text-justify: inter-character;   /* 字间调整（CJK，原名 distribute）*/',
            '  text-justify: distribute;        /* 别名 inter-character（已弃用名）*/',
            '  text-justify: newspaper;         /* 报纸式（优先断字 + 字间调整）*/',
            '',
            '【8. 垂直排版（writing-mode）配合 CJK】',
            '  vertical-text {',
            '    writing-mode: vertical-rl;       /* 竖排从右到左（传统中文）*/',
            '    text-orientation: upright;       /* CJK 字符直立 */',
            '    text-orientation: mixed;         /* 拉丁字符侧躺（默认）*/',
            '    text-orientation: sideways;      /* 所有字符侧躺 */',
            '  }',
            '',
            '【9. 字距控制】',
            '  letter-spacing: 0.05em;            /* 字间距（CJK 也适用）*/',
            '  word-spacing: 0.1em;               /* 词间距（CJK 无词，对拉丁文有效）*/',
            '  text-spacing: trim-start;          /* 别名 text-spacing-trim（提案）*/',
            '',
            '【完整 CJK 排版示例】',
            '  .cjk-article {',
            '    font-family: "Noto Serif CJK SC", "Source Han Serif", serif;',
            '    line-height: 1.8;',
            '    text-align: justify;',
            '    text-justify: inter-character;',
            '    text-spacing-trim: space-all;',
            '    hanging-punctuation: first last;',
            '    text-autospace: ideograph-alpha ideograph-numeric;',
            '    line-break: strict;',
            '    overflow-wrap: break-word;',
            '  }',
            '',
            `检测结果：`,
            `  text-spacing-trim    = ${f.textSpacingTrim}`,
            `  hanging-punctuation  = ${f.hangingPunctuation}`,
            `  word-break:auto-phrase = ${f.autoPhrase}`,
            `  text-autospace       = ${f.autospace}`,
            '',
            '===== 状态（截至 2025）=====',
            '  text-spacing-trim Chrome 117+/Safari 17.4+（Firefox 暂未实现）',
            '  hanging-punctuation Safari 部分支持/Chrome 117+ 实验',
            '  word-break: auto-phrase Chrome 119+（仅日语）',
            '  text-autospace Chrome 119+ 实验',
            '  line-break/overflow-wrap/word-break 全浏览器支持',
            '  规范来源：https://www.w3.org/TR/css-text-4/',
        ].join('\n');
        this.setState({ cjkInfo: info });
        this._addLog('css', `CJK 排版演示完成；trim=${f.textSpacingTrim}, auto-phrase=${f.autoPhrase}`);
    }
    _renderCard6() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '6. CJK 排版特性（中文/日文/韩文）',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['text-spacing-trim', f.textSpacingTrim],
                ['hanging-punctuation', f.hangingPunctuation],
                ['auto-phrase', f.autoPhrase],
                ['text-autospace', f.autospace],
            ]), h(Tag, { color: 'primary' }, 'Text L4')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'CJK 排版特性：text-spacing-trim 标点压缩（行首/行尾/连续标点）、hanging-punctuation 标点悬挂（标点移到行外让正文边缘整齐）、word-break: auto-phrase 日语形态学断词（避免切断词组，Chrome 119+）、text-autospace CJK 与拉丁/数字间自动加空隙（替代手写空格）、line-break 严格度、overflow-wrap/word-break 断行策略、text-justify: inter-character 两端对齐字间调整、writing-mode 竖排配合 text-orientation。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 CJK 排版演示', { type: 'primary', size: 'sm', onClick: () => this._runCJKDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } }, h('code', {}, s.cjkInfo || '（点击按钮查看 CJK 排版完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // —— 日志面板 ——
    _renderLogPanel() {
        const s = this.state;
        if (!s.logs || s.logs.length === 0)
            return '';
        return h(Card, { title: '运行日志' }, h('div', { class: 'log-list' }, ...s.logs.map((log) => h('div', { class: `log-item log-${log.type}` }, h('span', { class: 'log-time' }, log.time), h('span', { class: 'log-content' }, log.content)))));
    }
    renderPage() {
        const s = this.state;
        return [
            h('h2', { class: 'section-title' }, 'CSS 字体与排版高级特性'),
            h(Alert, {
                type: 'info',
                message: 'CSS Fonts & Typography Deep —— 字体加载/OpenType/可变字体/彩色字体/CJK 排版',
                description: '演示 CSS Fonts Module L4/L5 与 CSS Text L4 的高价值特性：@font-palette-values + font-palette（COLRv1 彩色字体调色板自定义）、font-synthesis-weight/style/small-caps（合成控制）、@font-face 全家桶（src/format/tech/unicode-range 子集化/font-display 加载策略/size-adjust + ascent/descent/line-gap-override 度量覆盖消除 CLS）、font-feature-settings + @font-feature-values（OpenType 特性：连字/字偶距/小型大写/数字风格/风格集/花体）、font-variation-settings 可变字体（5 注册轴 wght/wdth/ital/slnt/opsz + 自定义轴 GRAD/CASL/SOFT/MONO）、CJK 排版（text-spacing-trim/hanging-punctuation/word-break: auto-phrase/text-autospace/line-break/text-justify: inter-character）。用 CSS.supports() + FontFace API 检测，jsdom 不做真实渲染但流程完整。',
            }),
            s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
            h('div', { class: 'feature-grid' }, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6()),
            this._renderLogPanel(),
        ];
    }
}
//# sourceMappingURL=CSSFontTypographyDeepPage.js.map