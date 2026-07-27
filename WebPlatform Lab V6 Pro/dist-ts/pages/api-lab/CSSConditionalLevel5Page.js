// =====================================================================
// CSSConditionalLevel5Page.ts —— CSS 条件规则 Level 5 与未来提案 实验室
// 演示 CSS Conditional Rules Module Level 5（2024-2025 草案）及相关的
// 尚未在任何浏览器稳定支持的 CSS 未来提案特性：
//   1. @when / @else 通用条件规则 —— 统一 media/style/supports 三类条件
//      @when media(...) { } @else when style(...) { } @else { }
//      替代分散的 @media / @supports / @container style()，支持链式 else
//   2. @custom-media 自定义媒体查询别名 —— 命名复用复杂媒体查询
//      @custom-media --narrow-window (max-width: 30em);
//      @media (--narrow-window) { ... }
//   3. CSS if() 值函数 —— 在属性值中写条件表达式
//      width: if(style(--layout: horizontal): 100px; else: 100%);
//      width: if(media(min-width: 768px): 50vw; else: 100vw);
//      替代需要 @media 块的繁琐写法
//   4. CSS Custom Selectors :--name —— 自定义选择器别名（提案）
//      @custom-selector :--heading h1, h2, h3, h4, h5, h6;
//      @custom-selector :--enter :hover, :focus;
//      :--heading { ... }
//   5. CSS @apply 历史 + 与 @function 对比 ——
//      @apply --foo; 已弃用（Chrome 曾实现后移除），
//      替代方案：CSS @function 规则（mixins）+ CSS @property（类型化自定义属性）
//   6. CSS 条件规则演进时间线 —— Level 3 → Level 4 → Level 5 完整对比
//      @media / @supports / @import 条件 / @container / @when/@else
// 说明：所有特性均为提案阶段（截至 2025 年无浏览器稳定支持），
//       本页用 CSS.supports() 检测能力，不可用时仅记日志 + 展示代码示例。
//       jsdom 不做真实 CSS 渲染，但 CSS.supports 可能可用。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class CSSConditionalLevel5Page extends Page {
    _inited = false;
    _dynamicStyles = [];
    // —— 初始 state ——
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            whenInfo: '',
            customMediaInfo: '',
            ifFuncInfo: '',
            customSelInfo: '',
            applyInfo: '',
            timelineInfo: '',
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
        const f = this._flags();
        const c = (ok) => ok ? '✓' : '✗';
        const parts = [
            `CSS ${c(f.css)}`, `supports ${c(f.supports)}`,
            `@when ${c(f.when)}`, `@else ${c(f.elseRule)}`,
            `@custom-media ${c(f.customMedia)}`,
            `if() ${c(f.ifFunc)}`,
            `@custom-selector ${c(f.customSel)}`,
            `@apply ${c(f.apply)}`,
        ];
        const summary = f.css
            ? `CSS 条件规则 Level 5 能力检测：${parts.join(' · ')}。jsdom 不做真实 CSS 渲染，但 CSS.supports 通常可用；@when/@custom-media/if() 等提案特性 jsdom 必然不识别（截至 2025 无浏览器稳定支持），按钮将仅记日志说明 + 展示提案代码示例。`
            : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。';
        this.setState({ capsSummary: summary });
        this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!f.when)
            this._addLog('warn', '@when 不可用（CSS Conditional Level 5 提案，无浏览器支持）');
        if (!f.customMedia)
            this._addLog('warn', '@custom-media 不可用（CSS Media Queries Level 5 提案，无浏览器支持）');
        if (!f.ifFunc)
            this._addLog('warn', 'if() 值函数不可用（CSS Values Level 5 提案，无浏览器支持）');
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
    // 返回 Tag 数组：items = [[label, ok], ...]
    _caps(items) {
        return items.map(([label, ok]) => h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
    }
    // 返回布尔能力对象
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
        const supportsCond = (cond) => {
            try {
                return hasCSS && typeof CSS.supports === 'function' && CSS.supports(cond);
            }
            catch {
                return false;
            }
        };
        // 提案特性检测：CSS.supports('@when ...') / CSS.supports('@custom-media ...')
        // 注意：CSS.supports 对未知 at-rule 通常返回 false
        return {
            css: hasCSS,
            supports: hasCSS && typeof CSS.supports === 'function',
            // Card 1: @when / @else
            when: supportsCond('@when media(min-width: 0) { }'),
            elseRule: supportsCond('@else { }'),
            // Card 2: @custom-media
            customMedia: supportsCond('@custom-media --x (min-width: 0)'),
            // Card 3: if() 值函数
            ifFunc: supportsPV('width', 'if(style(--x: 1): 100px; else: 200px)'),
            ifMedia: supportsPV('width', 'if(media(min-width: 768px): 50vw; else: 100vw)'),
            // Card 4: @custom-selector
            customSel: supportsCond('@custom-selector :--h h1'),
            // Card 5: @apply（已弃用）
            apply: supportsPV('--x', '@apply --foo'), // 通常 false
            // 已稳定的条件规则（对照）
            media: supportsCond('@media (min-width: 0) { }'),
            supportsRule: supportsCond('@supports (color: red) { }'),
            containerStyle: supportsCond('@container (min-width: 0)'),
        };
    }
    // =================== Card 1：@when / @else 通用条件规则 ===================
    _demoWhenElse() {
        const f = this._flags();
        try {
            this.setState({ whenInfo: '===== @when / @else 通用条件规则（CSS Conditional Level 5 提案）=====\n\n' +
                    '动机：当前 CSS 有三类分散的条件规则：\n' +
                    '  @media (媒体查询) / @supports (特性查询) / @container (容器查询)\n' +
                    '  它们无法链式组合，导致重复嵌套：\n' +
                    '    @media (min-width: 768px) {\n' +
                    '      @supports (display: grid) { ... }  /* 嵌套两层 */\n' +
                    '    }\n\n' +
                    '@when 提案：统一三类条件 + 链式 @else\n' +
                    '  @when media(min-width: 1024px) and supports(display: grid) {\n' +
                    '    .layout { display: grid; grid-template-columns: 1fr 3fr; }\n' +
                    '  }\n' +
                    '  @else when media(min-width: 768px) {\n' +
                    '    .layout { display: flex; flex-direction: column; }\n' +
                    '  }\n' +
                    '  @else when style(--theme: dark) {  /* 读取自定义属性值 */\n' +
                    '    .layout { background: #1a1a1a; color: #f0f0f0; }\n' +
                    '  }\n' +
                    '  @else {\n' +
                    '    .layout { display: block; }  /* 兜底 */\n' +
                    '  }\n\n' +
                    '条件类型（@when 后可跟）：\n' +
                    '  media(...)   —— 媒体查询（等同 @media）\n' +
                    '  supports(...)—— 特性查询（等同 @supports）\n' +
                    '  style(...)   —— 自定义属性值查询（等同 @container style()）\n' +
                    '  可用 and / or / not 组合：media(...) and supports(...) and style(...)\n\n' +
                    '@else 链式：\n' +
                    '  @else when <条件> { ... }  —— 满足条件时执行\n' +
                    '  @else { ... }              —— 兜底（无条件）\n\n' +
                    '===== 与现有规则对比 =====\n' +
                    '  现有：@media + @supports + @container 各自独立，无法 else\n' +
                    '  @when：统一入口 + 链式 else，类似 if/elif/else 结构\n' +
                    '  渐进增强：@when 可与现有规则共存，浏览器忽略未知 at-rule\n\n' +
                    `CSS.supports('@when media(min-width: 0) { }') = ${f.when}\n` +
                    `CSS.supports('@else { }') = ${f.elseRule}\n\n` +
                    '===== 状态（截至 2025）=====\n' +
                    '  CSS Conditional Rules Module Level 5 草案阶段\n' +
                    '  无任何浏览器稳定支持（Chrome/Firefox/Safari 均未实现）\n' +
                    '  提案来源：https://drafts.csswg.org/css-conditional-5/' });
            this._addLog('when', `@when/@else 演示完成；supports=${f.when}`);
        }
        catch (err) {
            const e = err;
            this._addLog('warn', `@when 演示失败：${e.name} - ${e.message}`);
        }
    }
    _renderCard1() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '1. @when / @else 通用条件规则（CSS Conditional Level 5）',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['@when', f.when], ['@else', f.elseRule]]), h(Tag, { color: 'primary' }, '提案阶段')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '@when 是 CSS Conditional Level 5 提案的通用条件规则，统一 media/supports/style 三类条件查询并支持链式 @else：@when media(...) and supports(...) { } @else when style(...) { } @else { }。替代当前 @media/@supports/@container 分散且无法 else 的繁琐嵌套。条件类型：media()（媒体查询）/ supports()（特性查询）/ style()（自定义属性值查询），可用 and/or/not 组合。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('展示 @when/@else 用法', { type: 'primary', size: 'sm', onClick: () => this._demoWhenElse() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '460px', overflow: 'auto' } }, h('code', {}, s.whenInfo || '（点击按钮查看 @when/@else 完整用法）')),
                h(Alert, {
                    type: 'warning',
                    message: '@when/@else 属 CSS Conditional Level 5 提案，无浏览器稳定支持',
                    description: '截至 2025 年仅草案阶段，Chrome/Firefox/Safari 均未实现。生产环境需用 @media + @supports + @container 嵌套替代，或用 PostCSS 插件预编译。提案文档：drafts.csswg.org/css-conditional-5/',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 2：@custom-media 自定义媒体查询 ===================
    _demoCustomMedia() {
        const f = this._flags();
        try {
            this.setState({ customMediaInfo: '===== @custom-media 自定义媒体查询别名（CSS Media Queries Level 5 提案）=====\n\n' +
                    '动机：复杂媒体查询重复书写繁琐，且语义不清晰：\n' +
                    '  @media (min-width: 768px) and (max-width: 1024px) and (orientation: landscape) { ... }\n' +
                    '  /* 在多处重复这段查询时维护困难 */\n\n' +
                    '@custom-media 提案：命名复用媒体查询\n' +
                    '  @custom-media --tablet (min-width: 768px);\n' +
                    '  @custom-media --landscape (orientation: landscape);\n' +
                    '  @custom-media --tablet-landscape (--tablet) and (--landscape);\n\n' +
                    '  @media (--tablet) {                  /* 等同 (min-width: 768px) */\n' +
                    '    .sidebar { display: block; }\n' +
                    '  }\n' +
                    '  @media (--tablet-landscape) {        /* 组合别名 */\n' +
                    '    .layout { grid-template-columns: 1fr 2fr; }\n' +
                    '  }\n\n' +
                    '===== 命名规范 =====\n' +
                    '  必须以 -- 开头（与 CSS 自定义属性一致）\n' +
                    '  名称区分大小写\n' +
                    '  可在 @media / @import / @supports media() / @when media() 中使用\n\n' +
                    '===== 与现有方案对比 =====\n' +
                    '  现有：CSS 自定义属性 + @media（但自定义属性不能用于媒体查询条件本身）\n' +
                    '  @custom-media：直接命名媒体查询表达式，可在任何 @media 中复用\n' +
                    '  类比：Sass 的 $variables + @mixin，但原生 CSS 语义\n\n' +
                    '===== 组合与逻辑 =====\n' +
                    '  @custom-media --narrow (max-width: 30em);\n' +
                    '  @custom-media --wide not (--narrow);          /* 取反 */\n' +
                    '  @custom-media --medium (--wide) and (not (--narrow)); /* 组合 */\n\n' +
                    `CSS.supports('@custom-media --x (min-width: 0)') = ${f.customMedia}\n\n` +
                    '===== 状态（截至 2025）=====\n' +
                    '  CSS Media Queries Module Level 5 草案阶段\n' +
                    '  无浏览器稳定支持\n' +
                    '  提案来源：https://drafts.csswg.org/mediaqueries-5/#custom-mq' });
            this._addLog('cm', `@custom-media 演示完成；supports=${f.customMedia}`);
        }
        catch (err) {
            const e = err;
            this._addLog('warn', `@custom-media 演示失败：${e.name} - ${e.message}`);
        }
    }
    _renderCard2() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '2. @custom-media 自定义媒体查询别名',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['@custom-media', f.customMedia]]), h(Tag, { color: 'primary' }, 'Media Queries L5')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '@custom-media 让开发者命名复用复杂媒体查询表达式：@custom-media --tablet (min-width: 768px); 之后 @media (--tablet) { } 即可引用。支持组合（and/or/not）与嵌套别名。命名必须以 -- 开头（与 CSS 自定义属性一致）。替代 Sass 变量在媒体查询中的用法，提供原生语义化方案。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('展示 @custom-media 用法', { type: 'primary', size: 'sm', onClick: () => this._demoCustomMedia() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '420px', overflow: 'auto' } }, h('code', {}, s.customMediaInfo || '（点击按钮查看 @custom-media 完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 3：CSS if() 值函数 ===================
    _demoIfFunc() {
        const f = this._flags();
        try {
            // 尝试真实创建带 if() 的样式（jsdom 不支持，但演示流程）
            const style = document.createElement('style');
            style.textContent =
                '.cl-if-box { width: if(style(--layout: horizontal): 100px; else: 200px); }\n' +
                    '.cl-if-media { width: if(media(min-width: 768px): 50vw; else: 100vw); }';
            document.head.appendChild(style);
            this._dynamicStyles.push(style);
            this.setState({ ifFuncInfo: '===== CSS if() 值函数（CSS Values Level 5 提案）=====\n\n' +
                    '动机：当前 CSS 要在不同条件下设置不同属性值，必须用 @media 块包裹整个规则：\n' +
                    '  .box { width: 100vw; }                /* 默认值 */\n' +
                    '  @media (min-width: 768px) {\n' +
                    '    .box { width: 50vw; }              /* 覆盖 */\n' +
                    '  }\n' +
                    '  /* 同一选择器写两次，维护繁琐 */\n\n' +
                    'if() 提案：在属性值中直接写条件\n' +
                    '  .box {\n' +
                    '    width: if(media(min-width: 768px): 50vw; else: 100vw);\n' +
                    '  }\n' +
                    '  /* 一个声明搞定，无需 @media 块 */\n\n' +
                    '===== 语法 =====\n' +
                    '  if( <condition> : <true-value> ; else : <false-value> )\n' +
                    '  <condition> 类型：\n' +
                    '    media(...)   —— 媒体查询条件\n' +
                    '    style(...)   —— 自定义属性值条件（如 style(--theme: dark)）\n' +
                    '    supports(...)—— 特性查询条件\n\n' +
                    '===== 三类条件示例 =====\n' +
                    '  /* 媒体查询条件 */\n' +
                    '  .layout {\n' +
                    '    grid-template-columns:\n' +
                    '      if(media(min-width: 1024px): 1fr 3fr; else: 1fr);\n' +
                    '  }\n\n' +
                    '  /* 自定义属性值条件 */\n' +
                    '  :root { --theme: light; }\n' +
                    '  .card {\n' +
                    '    background: if(style(--theme: dark): #1a1a1a; else: #ffffff);\n' +
                    '    color: if(style(--theme: dark): #f0f0f0; else: #1a1a1a);\n' +
                    '  }\n\n' +
                    '  /* 特性查询条件 */\n' +
                    '  .fallback {\n' +
                    '    display: if(supports(display: grid): grid; else: flex);\n' +
                    '  }\n\n' +
                    '===== 嵌套 if() =====\n' +
                    '  .box {\n' +
                    '    width: if(media(min-width: 1024px): 25vw;\n' +
                    '          else: if(media(min-width: 768px): 50vw;\n' +
                    '                else: 100vw));\n' +
                    '  }\n\n' +
                    '===== 与 @when 对比 =====\n' +
                    '  @when：规则级条件（整个声明块）\n' +
                    '  if()：值级条件（单个属性值）\n' +
                    '  两者互补：@when 适合大块结构差异，if() 适合单个属性值差异\n\n' +
                    `CSS.supports('width', 'if(style(--x: 1): 100px; else: 200px)') = ${f.ifFunc}\n` +
                    `CSS.supports('width', 'if(media(min-width: 768px): 50vw; else: 100vw)') = ${f.ifMedia}\n\n` +
                    '===== 状态（截至 2025）=====\n' +
                    '  CSS Values and Units Module Level 5 草案阶段\n' +
                    '  无浏览器稳定支持\n' +
                    '  提案来源：https://drafts.csswg.org/css-values-5/#if-notation' });
            this._addLog('if', `if() 演示完成；supports=${f.ifFunc}`);
        }
        catch (err) {
            const e = err;
            this._addLog('warn', `if() 演示失败：${e.name} - ${e.message}`);
        }
    }
    _renderCard3() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '3. CSS if() 值函数（CSS Values Level 5）',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['if()', f.ifFunc], ['if(media)', f.ifMedia]]), h(Tag, { color: 'primary' }, 'Values L5')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'if() 是 CSS Values Level 5 提案的值级条件函数：if(<condition>: <true-value>; else: <false-value>) 在单个属性值中写条件，避免用 @media 块包裹整个规则。条件类型：media()（媒体查询）/ style()（自定义属性值）/ supports()（特性查询）。支持嵌套 if()。与 @when 互补：@when 是规则级条件（整个声明块），if() 是值级条件（单个属性值）。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('展示 if() 用法', { type: 'primary', size: 'sm', onClick: () => this._demoIfFunc() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '460px', overflow: 'auto' } }, h('code', {}, s.ifFuncInfo || '（点击按钮查看 if() 完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 4：CSS Custom Selectors ===================
    _demoCustomSel() {
        const f = this._flags();
        try {
            this.setState({ customSelInfo: '===== CSS Custom Selectors :--name（css-extensions 提案）=====\n\n' +
                    '动机：复杂选择器重复书写，语义不清晰：\n' +
                    '  h1, h2, h3, h4, h5, h6 { font-weight: 700; }  /* 标题选择器重复 */\n' +
                    '  a:hover, button:hover, .btn:hover { color: red; }  /* 交互元素 hover */\n\n' +
                    '@custom-selector 提案：命名复用选择器列表\n' +
                    '  @custom-selector :--heading h1, h2, h3, h4, h5, h6;\n' +
                    '  @custom-selector :--enter :hover, :focus;\n' +
                    '  @custom-selector :--button button, .btn, [role="button"];\n\n' +
                    '  :--heading { font-weight: 700; line-height: 1.2; }\n' +
                    '  a:--enter { color: red; }              /* 等同 a:hover, a:focus */\n' +
                    '  :--button:--enter { background: #eee; } /* 组合使用 */\n\n' +
                    '===== 命名规范 =====\n' +
                    '  必须以 :-- 开头（双连字符）\n' +
                    '  名称区分大小写\n' +
                    '  可在任何选择器位置使用（后代/子代/兄弟/组合）\n\n' +
                    '===== 与 :is() / :where() 对比 =====\n' +
                    '  :is(h1, h2, h3)      —— 内联选择器列表，无命名复用\n' +
                    '  :--heading            —— 命名别名，可跨文件复用\n' +
                    '  @custom-selector :--heading :is(h1, h2, h3, h4, h5, h6);\n' +
                    '  /* 两者可结合使用 */\n\n' +
                    '===== 与 Sass @function 对比 =====\n' +
                    '  Sass: @mixin heading { h1, h2, h3, ... } @include heading;\n' +
                    '  CSS:  @custom-selector :--heading h1, h2, h3, ...; :--heading { }\n' +
                    '  原生 CSS 语义，无需预处理器\n\n' +
                    `CSS.supports('@custom-selector :--h h1') = ${f.customSel}\n\n` +
                    '===== 状态（截至 2025）=====\n' +
                    '  css-extensions 提案（早期草案）\n' +
                    '  无浏览器稳定支持\n' +
                    '  提案来源：https://drafts.csswg.org/css-extensions/' });
            this._addLog('cs', `@custom-selector 演示完成；supports=${f.customSel}`);
        }
        catch (err) {
            const e = err;
            this._addLog('warn', `@custom-selector 演示失败：${e.name} - ${e.message}`);
        }
    }
    _renderCard4() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '4. CSS Custom Selectors :--name（css-extensions 提案）',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['@custom-selector', f.customSel]]), h(Tag, { color: 'primary' }, 'css-extensions')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '@custom-selector 让开发者命名复用选择器列表：@custom-selector :--heading h1, h2, h3, h4, h5, h6; 之后 :--heading { } 即可引用。命名必须以 :-- 开头（双连字符）。可在任何选择器位置使用并组合。与 :is()/:where() 互补——后者内联选择器列表无命名复用，@custom-selector 提供跨文件命名别名。替代 Sass @mixin 在选择器层面的用法。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('展示 @custom-selector 用法', { type: 'primary', size: 'sm', onClick: () => this._demoCustomSel() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '420px', overflow: 'auto' } }, h('code', {}, s.customSelInfo || '（点击按钮查看 @custom-selector 完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 5：@apply 历史 + 与 @function 对比 ===================
    _demoApplyHistory() {
        const f = this._flags();
        try {
            this.setState({ applyInfo: '===== CSS @apply 历史 + 与 @function 对比 =====\n\n' +
                    '===== @apply 简史（已弃用）=====\n' +
                    '  2015-2017：CSS Custom Properties Level 1 草案曾包含 @apply 规则，\n' +
                    '    允许把一组声明打包到自定义属性中复用：\n' +
                    '    :root {\n' +
                    '      --button-style: {\n' +
                    '        background: #3b82f6;\n' +
                    '        color: white;\n' +
                    '        padding: 8px 16px;\n' +
                    '        border-radius: 4px;\n' +
                    '      };\n' +
                    '    }\n' +
                    '    .btn { @apply --button-style; }   /* 复用整组声明 */\n\n' +
                    '  2017：Chrome 曾实现 @apply（flag 开启），但最终被移除\n' +
                    '  原因：\n' +
                    '    1. 与 CSS 自定义属性语义冲突（自定义属性应是单个值，不是声明块）\n' +
                    '    2. 可维护性差（重命名/查找困难，无类型检查）\n' +
                    '    3. 与 cascade 交互复杂（@apply 展开后如何参与层叠？）\n' +
                    '    4. 有更好的替代方案（@function mixins / CSS Modules）\n\n' +
                    '===== 替代方案 1：CSS @function mixins（CSSWG 2024 新提案）=====\n' +
                    '  @function --button-style($bg: #3b82f6, $color: white) {\n' +
                    '    background: $bg;\n' +
                    '    color: $color;\n' +
                    '    padding: 8px 16px;\n' +
                    '    border-radius: 4px;\n' +
                    '  }\n' +
                    '  .btn { @apply --button-style; }                /* 无参数 */\n' +
                    '  .btn-danger { @apply --button-style(#ef4444); } /* 带参数 */\n' +
                    '  优势：\n' +
                    '    · 支持参数（@apply 不支持）\n' +
                    '    · 类型检查（@property 定义参数类型）\n' +
                    '    · 与 cascade 语义清晰（展开为普通声明）\n\n' +
                    '===== 替代方案 2：CSS 自定义属性 + @property =====\n' +
                    '  :root {\n' +
                    '    --btn-bg: #3b82f6;\n' +
                    '    --btn-color: white;\n' +
                    '    --btn-padding: 8px 16px;\n' +
                    '  }\n' +
                    '  @property --btn-bg { syntax: "<color>"; inherits: false; initial-value: #3b82f6; }\n' +
                    '  .btn { background: var(--btn-bg); color: var(--btn-color); padding: var(--btn-padding); }\n' +
                    '  优势：\n' +
                    '    · 已稳定支持（所有现代浏览器）\n' +
                    '    · 可动画（@property 注册的类型化属性可参与过渡）\n' +
                    '  劣势：\n' +
                    '    · 每个属性单独定义，无法打包整组声明\n\n' +
                    '===== 替代方案 3：层叠层 @layer + 组件类 =====\n' +
                    '  @layer components {\n' +
                    '    .btn { background: #3b82f6; color: white; padding: 8px 16px; border-radius: 4px; }\n' +
                    '    .btn-danger { background: #ef4444; }\n' +
                    '  }\n' +
                    '  优势：原生 CSS，无需 @apply/@function\n' +
                    '  劣势：无参数化能力\n\n' +
                    `CSS.supports('--x', '@apply --foo') = ${f.apply}（必然 false，已弃用）\n\n` +
                    '===== 结论 =====\n' +
                    '  · @apply 已死，不要在生产使用\n' +
                    '  · 短期：用 @layer + 组件类 + 自定义属性\n' +
                    '  · 中期：等 @function mixins 落地（CSSWG 2024 提案）\n' +
                    '  · 工具链：Sass/Less/Stylus 的 @mixin 仍是当前最佳实践' });
            this._addLog('apply', `@apply 历史演示完成；supports=${f.apply}`);
        }
        catch (err) {
            const e = err;
            this._addLog('warn', `@apply 演示失败：${e.name} - ${e.message}`);
        }
    }
    _renderCard5() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '5. CSS @apply 历史 + 与 @function 对比',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['@apply', f.apply]]), h(Tag, { color: 'error' }, '已弃用')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '@apply 曾是 CSS Custom Properties Level 1 草案的特性，允许把一组声明打包到自定义属性中复用（@apply --button-style;）。Chrome 曾实现后移除。弃用原因：与自定义属性语义冲突、可维护性差、与 cascade 交互复杂。替代方案：CSS @function mixins（CSSWG 2024 新提案，支持参数）/ @property 类型化自定义属性 / @layer 层叠层 + 组件类。当前生产环境用 Sass @mixin 仍是最佳实践。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('展示 @apply 历史与替代方案', { type: 'primary', size: 'sm', onClick: () => this._demoApplyHistory() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.applyInfo || '（点击按钮查看 @apply 历史与替代方案对比）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 6：CSS 条件规则演进时间线 ===================
    _demoTimeline() {
        const f = this._flags();
        try {
            this.setState({ timelineInfo: '===== CSS 条件规则演进时间线（Level 3 → Level 5）=====\n\n' +
                    '===== Level 3（已稳定，全浏览器支持）=====\n' +
                    '  @media <media-query> { }              —— 媒体查询（响应式设计基石）\n' +
                    '    特性：width/height/orientation/resolution/color/prefers-color-scheme 等\n' +
                    '    示例：@media (min-width: 768px) { .grid { grid-template-columns: 1fr 1fr; } }\n\n' +
                    '  @supports <condition> { }             —— 特性查询（渐进增强）\n' +
                    '    特性：检测 CSS 属性/值是否支持\n' +
                    '    示例：@supports (display: grid) { .layout { display: grid; } }\n' +
                    '    逻辑：and / or / not\n' +
                    '    检测：CSS.supports("display", "grid") / CSS.supports("(display: grid)")\n\n' +
                    '  @import "url" <media-query>;         —— 条件导入\n' +
                    '    示例：@import "dark.css" (prefers-color-scheme: dark);\n\n' +
                    '===== Level 4（部分稳定，主流浏览器支持）=====\n' +
                    '  @media (hover: hover)                 —— 悬停能力查询（区分触屏/鼠标）\n' +
                    '  @media (pointer: fine|coarse|none)    —— 指针精度查询\n' +
                    '  @media (prefers-reduced-motion)       —— 减少动画偏好\n' +
                    '  @media (prefers-color-scheme: dark)   —— 深色模式偏好\n' +
                    '  @media (forced-colors: active)        —— 强制颜色模式（高对比度）\n' +
                    '  @media (dynamic-range: high)          —— HDR 显示能力\n' +
                    '  @media (color-gamut: p3/rec2020)      —— 色域查询\n' +
                    '  @supports selector(:has(+ *))         —— 选择器特性查询\n' +
                    '  @supports font-tech(color-COLRv1)     —— 字体技术查询\n\n' +
                    '===== Level 4.5：Container Queries（已稳定 Chrome 105+）=====\n' +
                    '  @container <name>? <query> { }        —— 容器查询（基于容器尺寸/样式）\n' +
                    '    size 查询：@container (min-width: 400px) { .card { grid-template-columns: 1fr 1fr; } }\n' +
                    '    style 查询：@container style(--theme: dark) { .card { background: #1a1a1a; } }\n' +
                    '    命名容器：container-type: inline-size; container-name: sidebar;\n' +
                    '    @container sidebar (min-width: 300px) { ... }\n\n' +
                    '===== Level 5（提案阶段，无浏览器支持）=====\n' +
                    '  @when <condition> { } @else when <cond> { } @else { }\n' +
                    '    —— 统一 media/supports/style 三类条件 + 链式 else\n' +
                    '    条件类型：media(...) / supports(...) / style(...)\n' +
                    '    组合：and / or / not\n\n' +
                    '  @custom-media --name <media-query>;   —— 自定义媒体查询别名\n' +
                    '    @media (--name) { ... }\n\n' +
                    '  if(<condition>: <true>; else: <false>) —— 值级条件函数\n' +
                    '    width: if(media(min-width: 768px): 50vw; else: 100vw);\n\n' +
                    '===== 检测结果对照 =====\n' +
                    `  @media 支持：${f.media ? '✓' : '✗'}（Level 3 已稳定）\n` +
                    `  @supports 支持：${f.supportsRule ? '✓' : '✗'}（Level 3 已稳定）\n` +
                    `  @container style() 支持：${f.containerStyle ? '✓' : '✗'}（Level 4.5 已稳定）\n` +
                    `  @when 支持：${f.when ? '✓' : '✗'}（Level 5 提案，无支持）\n` +
                    `  @custom-media 支持：${f.customMedia ? '✓' : '✗'}（Level 5 提案，无支持）\n` +
                    `  if() 支持：${f.ifFunc ? '✓' : '✗'}（Values Level 5 提案，无支持）\n\n` +
                    '===== 渐进增强策略 =====\n' +
                    '  1. 基础样式：用 Level 3 @media/@supports（全浏览器）\n' +
                    '  2. 增强样式：用 Level 4 容器查询/媒体特性（主流浏览器）\n' +
                    '  3. 未来样式：等 Level 5 落地后用 @when/if()（当前仅参考）\n' +
                    '  4. 检测：CSS.supports() 在运行时判断，不支持则降级到 @media 块' });
            this._addLog('tl', `演进时间线展示完成；media=${f.media}, when=${f.when}`);
        }
        catch (err) {
            const e = err;
            this._addLog('warn', `时间线演示失败：${e.name} - ${e.message}`);
        }
    }
    _renderCard6() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '6. CSS 条件规则演进时间线（Level 3 → Level 5）',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['@media', f.media], ['@supports', f.supportsRule], ['@container', f.containerStyle]]), h(Tag, { color: 'primary' }, '演进对比')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'CSS 条件规则从 Level 3 的 @media/@supports，到 Level 4 的 prefers-* 媒体特性 + @supports selector()/font-tech()，再到 Level 4.5 的 @container 容器查询（已稳定），最终演进到 Level 5 的 @when/@custom-media/if() 统一条件体系（提案阶段）。本卡片对比各 Level 的能力差异与浏览器支持情况，并提供渐进增强策略：基础样式用 Level 3、增强用 Level 4、未来用 Level 5。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('展示演进时间线', { type: 'primary', size: 'sm', onClick: () => this._demoTimeline() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '540px', overflow: 'auto' } }, h('code', {}, s.timelineInfo || '（点击按钮查看完整演进时间线）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // —— 日志面板 ——
    _renderLogPanel() {
        const s = this.state;
        if (!s.logs || s.logs.length === 0)
            return null;
        return h(Card, { title: '运行日志' }, h('div', { class: 'log-list' }, ...s.logs.map((log) => h('div', { class: `log-item log-${log.type}` }, h('span', { class: 'log-time' }, log.time), h('span', { class: 'log-content' }, log.content)))));
    }
    renderPage() {
        const s = this.state;
        return [
            h('h2', { class: 'section-title' }, 'CSS 条件规则 Level 5 与未来提案实验室'),
            h(Alert, {
                type: 'info',
                message: 'CSS Conditional Rules Module Level 5 及相关未来提案',
                description: '演示 CSS 条件规则的未来演进：@when/@else 通用条件规则（统一 media/supports/style 三类条件 + 链式 else）、@custom-media 自定义媒体查询别名（命名复用复杂媒体查询）、CSS if() 值函数（在属性值中写条件，避免 @media 块包裹）、@custom-selector :--name 自定义选择器别名、@apply 历史与替代方案对比（@function mixins / @property / @layer）、CSS 条件规则演进时间线（Level 3 → Level 5 完整对比 + 渐进增强策略）。所有特性均为提案阶段（截至 2025 无浏览器稳定支持），用 CSS.supports() 检测能力，不可用时仅展示代码示例。',
            }),
            s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
            this._renderCard1(),
            this._renderCard2(),
            this._renderCard3(),
            this._renderCard4(),
            this._renderCard5(),
            this._renderCard6(),
            this._renderLogPanel(),
        ];
    }
}
//# sourceMappingURL=CSSConditionalLevel5Page.js.map