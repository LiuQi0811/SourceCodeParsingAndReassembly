// =====================================================================
// CSSAdvancedPropertiesPage.js —— CSS 高级属性 实验室
// 演示 MDN / CSSWG 2024-2025 尚未在前序页面覆盖的 CSS 高级属性与函数：
//   1. attr() 增强（CSS Values Level 5）—— attr(name <type>, <fallback>)
//      多类型 <length>/<color>/<url>/<number>/<percentage>/<angle>/<time>/
//      <resolution>/<integer>/"*"  + 多值 <length>+ / <color>#  + fallback
//      默认 attr() 仅支持 content 字符串，Level 5 可在任意属性中使用并带类型
//   2. CSS Carousels（CSSWG 2024 提案）—— carousel-* 属性族 +
//      scroll-marker / scroll-buttons / carousel-snapping 等 +
//      ::carousel-content / ::carousel-prev / ::carousel-next 等伪元素
//      纯 CSS 实现轮播图（自动滚动+分页+方向键+触屏滑动），无需 JS
//   3. CSS zoom 属性 —— zoom: <number>|<percentage>|normal|reset
//      与 transform: scale() 的关键差异：zoom 影响布局（占据缩放后空间）
//      vs scale 仅视觉变换（不占空间）；zoom 不创建合成层
//      历史上仅 IE/Edge/Chrome 支持，Firefox 126+ 起支持
//   4. CSS env() 与 viewport-fit —— env(safe-area-inset-*) /
//      env(titlebar-area-*) / env(viewport-*) / constant() 旧前缀 /
//      <meta name="viewport" content="viewport-fit=cover"> 协同；
//      用于刘海屏 / 折叠屏 / PWA 桌面窗口控制
//   5. CSS Masking 高级 —— mask / mask-image / mask-mode / mask-repeat /
//      mask-position / mask-clip / mask-origin / mask-size / mask-composite /
//      mask-border（与 background-* 同构）+ mask-type: alpha|luminance
//   6. CSS 高级伪类全家桶 —— :modal / :popover-open / :fullscreen /
//      :picture-in-picture / :target-within / :dir() / :defined /
//      :nth-child(an+b of S) 子选择增强 / 媒体伪类 :playing / :paused /
//      :seeking / :buffering / :muted / :volume-locked
// 说明：所有特性调用前做 typeof / CSS.supports 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。jsdom 不做真实 CSS 渲染，但
//       CSS.supports / CSSStyleSheet.replaceSync 等部分 API 可能可用，统一 try/catch。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class CSSAdvancedPropertiesPage extends Page {
    _inited = false;
    _dynamicStyles;
    _dynamicNodes;
    // —— 初始 state ——
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            // Card 1：attr() 增强
            attrInfo: '',
            // Card 2：CSS Carousels
            carouselInfo: '',
            // Card 3：CSS zoom 属性
            zoomInfo: '',
            // Card 4：CSS env() / viewport-fit
            envInfo: '',
            // Card 5：CSS Masking 高级
            maskInfo: '',
            // Card 6：CSS 高级伪类
            pseudoInfo: '',
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
        this._dynamicNodes = []; // 动态创建并 appendChild 到 body 的元素列表
        // 一次性能力检测：CSS 高级属性全家桶
        const f = this._flags();
        const c = (ok) => ok ? '✓' : '✗';
        const parts = [
            `CSS ${c(f.css)}`, `supports ${c(f.supports)}`,
            `attr(<type>) ${c(f.attrTyped)}`, `attr+fallback ${c(f.attrFallback)}`,
            `carousel-* ${c(f.carousel)}`, `scroll-marker ${c(f.scrollMarker)}`,
            `zoom ${c(f.zoom)}`, `env() ${c(f.env)}`, `constant() ${c(f.constant)}`,
            `mask-image ${c(f.maskImage)}`, `mask-composite ${c(f.maskComposite)}`,
            `mask-border ${c(f.maskBorder)}`,
            `:modal ${c(f.modal)}`, `:popover-open ${c(f.popoverOpen)}`, `:fullscreen ${c(f.fullscreen)}`,
            `:nth-child(of) ${c(f.nthChildOf)}`, `:dir() ${c(f.dir)}`,
        ];
        const summary = f.css
            ? `CSS 高级属性能力检测：${parts.join(' · ')}。jsdom 不做真实 CSS 渲染，但 CSS.supports 通常可用；attr() 类型化、carousel-*、zoom、env()、mask-*、:modal 等较新特性 jsdom 可能不识别，按钮将仅记日志说明。在真实浏览器中打开可完整演示。`
            : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。';
        this.setState({ capsSummary: summary });
        this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!f.attrTyped)
            this._addLog('warn', 'attr() 类型化语法不可用（CSS Values Level 5，仅 Chrome Canary 实验）');
        if (!f.carousel)
            this._addLog('warn', 'carousel-* 不可用（CSSWG 2024 提案，尚未在任何浏览器稳定支持）');
        if (!f.zoom)
            this._addLog('warn', 'zoom 属性不可用或 jsdom 未识别（Chrome/Edge/Safari 早已支持，Firefox 126+）');
        if (!f.env)
            this._addLog('warn', 'env() 不可用或 jsdom 未识别（Chrome/Safari/Firefox 已稳定）');
        if (!f.maskImage)
            this._addLog('warn', 'mask-image 不可用或 jsdom 未识别（Chrome 120+ 标准语法，无需 -webkit- 前缀）');
        if (!f.modal)
            this._addLog('warn', ':modal 伪类不可用或 jsdom 未识别（Chrome 111+ / Firefox 116+ / Safari 16.4+）');
        if (!f.nthChildOf)
            this._addLog('warn', ':nth-child(an+b of S) 不可用或 jsdom 未识别（Chrome 111+）');
    }
    componentWillUnmount() {
        // 移除动态创建的 <style> 元素与 appendChild 到 body 的元素，便于 GC
        for (const style of this._dynamicStyles) {
            try {
                style.parentNode && style.parentNode.removeChild(style);
            }
            catch { /* noop */ }
        }
        for (const node of this._dynamicNodes) {
            try {
                node.parentNode && node.parentNode.removeChild(node);
            }
            catch { /* noop */ }
        }
        this._dynamicStyles = [];
        this._dynamicNodes = [];
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
        return items.map(([label, ok]) => h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
    }
    // 返回布尔能力对象（供 capsSummary / 按钮 disabled 使用）
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
        return {
            css: hasCSS,
            supports: hasCSS && typeof CSS.supports === 'function',
            // —— Card 1: attr() 类型化 ——
            attrTyped: supportsPV('width', 'attr(data-w <length>)'),
            attrLength: supportsPV('width', 'attr(data-w length)'),
            attrColor: supportsPV('color', 'attr(data-c <color>)'),
            attrFallback: supportsPV('width', 'attr(data-w <length>, 100px)'),
            attrMulti: supportsPV('width', 'attr(data-w <length>+)'),
            attrString: supportsPV('content', 'attr(data-label)'),
            // —— Card 2: CSS Carousels ——
            carousel: supportsPV('carousel', 'auto'),
            carouselDirection: supportsPV('carousel-direction', 'inline'),
            carouselLoop: supportsPV('carousel-loop', 'on'),
            carouselSnapping: supportsPV('carousel-snapping', 'mandatory'),
            scrollMarker: supportsPV('scroll-marker', 'on'),
            scrollMarkerGroup: supportsPV('scroll-marker-group', 'after'),
            scrollButtons: supportsPV('scroll-buttons', 'inline'),
            // —— Card 3: zoom ——
            zoom: supportsPV('zoom', '1.5'),
            zoomNormal: supportsPV('zoom', 'normal'),
            zoomReset: supportsPV('zoom', 'reset'),
            // —— Card 4: env() / constant() ——
            env: supportsPV('width', 'env(safe-area-inset-left)'),
            envTitlebar: supportsPV('width', 'env(titlebar-area-x)'),
            envViewport: supportsPV('width', 'env(viewport-segment-width)'),
            constant: supportsPV('width', 'constant(safe-area-inset-left)'),
            // —— Card 5: Masking ——
            maskImage: supportsPV('mask-image', 'linear-gradient(black, transparent)'),
            maskMode: supportsPV('mask-mode', 'alpha'),
            maskComposite: supportsPV('mask-composite', 'subtract'),
            maskBorder: supportsPV('mask-border-source', 'linear-gradient(black, transparent)'),
            maskType: supportsCond('@supports selector(::-webkit-mask)'),
            // —— Card 6: 高级伪类 ——
            modal: supportsCond('selector(:modal)'),
            popoverOpen: supportsCond('selector(:popover-open)'),
            fullscreen: supportsCond('selector(:fullscreen)'),
            pictureInPicture: supportsCond('selector(:picture-in-picture)'),
            targetWithin: supportsCond('selector(:target-within)'),
            dir: supportsCond('selector(:dir(rtl))'),
            defined: supportsCond('selector(:defined)'),
            nthChildOf: supportsCond('selector(:nth-child(2n of .item))'),
            playing: supportsCond('selector(:playing)'),
            paused: supportsCond('selector(:paused)'),
            seeking: supportsCond('selector(:seeking)'),
            muted: supportsCond('selector(:muted)'),
        };
    }
    // =================== Card 1：attr() 增强（CSS Values Level 5） ===================
    _runAttrDemo() {
        const f = this._flags();
        try {
            const style = document.createElement('style');
            style.textContent =
                '.cap-attr-box { width: attr(data-w <length>, 80px); height: 40px; color: attr(data-c <color>, #3b82f6); background: #f1f5f9; margin-top: 8px; display: flex; align-items: center; justify-content: center; border-radius: 4px; }\n' +
                    '.cap-attr-box::after { content: attr(data-label); }\n' +
                    '.cap-attr-multi { width: attr(data-w <length>+, 100px); }';
            document.head.appendChild(style);
            this._dynamicStyles.push(style);
            const box = document.createElement('div');
            box.className = 'cap-attr-box';
            box.setAttribute('data-w', '160px');
            box.setAttribute('data-c', '#ef4444');
            box.setAttribute('data-label', 'attr() 类型化演示');
            document.body.appendChild(box);
            this._dynamicNodes.push(box);
            const widthVal = window.getComputedStyle(box).getPropertyValue('width');
            const colorVal = window.getComputedStyle(box).getPropertyValue('color');
            const contentVal = window.getComputedStyle(box, '::after').getPropertyValue('content');
            this.setState({ attrInfo: 'attr() 增强（CSS Values Level 5）演示：\n' +
                    '  .cap-attr-box { width: attr(data-w <length>, 80px); color: attr(data-c <color>, #3b82f6); }\n' +
                    '  .cap-attr-box::after { content: attr(data-label); }\n' +
                    `  元素 data-w="160px" data-c="#ef4444" data-label="attr() 类型化演示"\n` +
                    `  width 计算值="${widthVal}"（理想 160px；jsdom 不渲染可能为空）\n` +
                    `  color 计算值="${colorVal}"（理想 rgb(239, 68, 68)）\n` +
                    `  ::after content 计算值="${contentVal}"（理想 "attr() 类型化演示"）\n` +
                    `  CSS.supports('width','attr(data-w <length>)') = ${f.attrTyped}\n` +
                    `  attr(<length>) = ${f.attrLength}; attr(<color>) = ${f.attrColor}; attr+fallback = ${f.attrFallback}\n` +
                    `  attr(<length>+) 多值 = ${f.attrMulti}; attr() content 字符串 = ${f.attrString}\n\n` +
                    '语法：attr(<custom-ident> <type>? , <fallback>?)\n' +
                    '  <type> 取值：<length> / <color> / <url> / <number> / <percentage> / <angle> / <time> / <resolution> / <integer> / "*" / <type>+ / <type>#\n' +
                    '  多值用 <length>+ 或 <color># 表示空格/逗号分隔的列表\n' +
                    '  <fallback> 在属性缺失或类型不匹配时使用\n\n' +
                    '历史：CSS Values Level 3 中 attr() 仅支持 content 属性且仅字符串；\n' +
                    '  Level 5 扩展到任意属性 + 类型 + fallback（Chrome Canary 实验，截至 2025 主流尚未稳定）。' });
            this._addLog('attr', `attr() 演示：width="${widthVal}", color="${colorVal}", typed=${f.attrTyped}`);
        }
        catch (err) {
            this._addLog('warn', `attr() 演示失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard1() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '1. attr() 增强（CSS Values Level 5）',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['attr(<type>)', f.attrTyped], ['attr+fallback', f.attrFallback], ['attr(<color>)', f.attrColor]]), h(Tag, { color: 'primary' }, '类型化 / fallback')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'attr() 增强让 CSS 属性值直接读取 HTML 属性，并支持类型推断与 fallback。语法：attr(<name> <type>?, <fallback>?)。<type> 取值：<length>/<color>/<url>/<number>/<percentage>/<angle>/<time>/<resolution>/<integer>/"*"/<type>+（多值）/ <type>#（逗号列表）。历史 Level 3 仅支持 content 字符串；Level 5 扩展到任意属性 + 类型 + fallback。让数据驱动样式无需 JS 中转。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 attr() 演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runAttrDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, 'attr() 演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } }, h('code', {}, s.attrInfo || '（点击「运行 attr() 演示」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } }, h('code', {}, `.box {
  width:  attr(data-width <length>, 100px);     /* 类型化读取 */
  color:  attr(data-color  <color>,  #333);     /* 颜色类型 */
  --gap:  attr(data-gap    <length>+, 8px 16px);/* 多值列表 */
}
.icon::before { content: attr(data-icon); }     /* 传统字符串用法 */

/* 不支持时降级：先写默认值，再用 @supports 增强 */
.box { width: 100px; }
@supports (width: attr(data-w <length>)) {
  .box { width: attr(data-w <length>, 100px); }
}`)),
                h(Alert, {
                    type: 'warning',
                    message: 'attr() 类型化属 CSS Values Level 5 实验特性，主流浏览器尚未稳定支持',
                    description: '截至 2025 年仅 Chrome Canary 实验支持 attr(<type>)；其他浏览器降级为 attr() 仅支持 content 字符串。检测：CSS.supports(\'width\', \'attr(data-w <length>)\')。生产环境需 @supports 增强并提供降级值。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 2：CSS Carousels（CSSWG 2024 提案） ===================
    _runCarouselDemo() {
        const f = this._flags();
        let replaceResult = '未执行';
        try {
            if (typeof CSSStyleSheet !== 'undefined') {
                try {
                    const sheet = new CSSStyleSheet();
                    sheet.replaceSync('.cap-carousel { carousel: auto; carousel-direction: inline; carousel-loop: on; carousel-snapping: mandatory; } ' +
                        '.cap-carousel::scroll-marker-group { display: flex; gap: 4px; } ' +
                        '.cap-carousel::scroll-marker { width: 8px; height: 8px; border-radius: 50%; background: #cbd5e1; } ' +
                        '.cap-carousel::scroll-marker:current { background: #3b82f6; }');
                    replaceResult = 'replaceSync 成功（carousel-* 解析通过）';
                }
                catch (e) {
                    replaceResult = `replaceSync 抛错：${e.name} - ${e.message}（carousel-* 不支持）`;
                }
            }
            else {
                replaceResult = 'CSSStyleSheet 不可用（typeof undefined）';
            }
            const host = document.createElement('div');
            host.className = 'cap-carousel';
            host.setAttribute('carousel', 'auto');
            host.innerHTML =
                '<div class="cap-carousel-track">' +
                    Array.from({ length: 5 }, (_, i) => `<div class="cap-carousel-slide">Slide ${i + 1}</div>`).join('') +
                    '</div>';
            document.body.appendChild(host);
            this._dynamicNodes.push(host);
            const carouselVal = window.getComputedStyle(host).getPropertyValue('carousel');
            this.setState({ carouselInfo: 'CSS Carousels（CSSWG 2024 提案）演示：\n' +
                    `  CSSStyleSheet.replaceSync('carousel-*...') → ${replaceResult}\n` +
                    `  CSS.supports('carousel','auto') = ${f.carousel}\n` +
                    `  carousel-direction = ${f.carouselDirection}; carousel-loop = ${f.carouselLoop}; carousel-snapping = ${f.carouselSnapping}\n` +
                    `  scroll-marker = ${f.scrollMarker}; scroll-marker-group = ${f.scrollMarkerGroup}; scroll-buttons = ${f.scrollButtons}\n` +
                    `  元素 carousel 属性计算值="${carouselVal}"\n\n` +
                    '属性族：\n' +
                    '  carousel: auto | none —— 启用轮播（简写）\n' +
                    '  carousel-direction: inline | block —— 滚动方向\n' +
                    '  carousel-loop: on | off —— 是否循环\n' +
                    '  carousel-snapping: none | proximity | mandatory —— 捕捉严格度\n' +
                    '  scroll-marker: on | off —— 是否生成分页指示器\n' +
                    '  scroll-marker-group: before | after —— 分页指示器位置\n' +
                    '  scroll-buttons: none | inline | block —— 是否生成前进/后退按钮\n\n' +
                    '伪元素：::carousel-content / ::carousel-prev / ::carousel-next /\n' +
                    '  ::scroll-marker-group / ::scroll-marker / ::scroll-button-*\n' +
                    '  :current 标记当前激活的 scroll-marker\n\n' +
                    '键盘/触屏：方向键翻页、触屏滑动、Tab 焦点循环 —— 全部原生支持。\n' +
                    '截至 2025 年仍处提案阶段，无浏览器稳定支持；先用 CSS Scroll Snap + JS 降级。' });
            this._addLog('carousel', `Carousel 演示：replaceSync=${replaceResult.indexOf('成功') >= 0}, 支持=${f.carousel}`);
        }
        catch (err) {
            this._addLog('warn', `Carousel 演示失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard2() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '2. CSS Carousels（CSSWG 2024 提案）',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['carousel-*', f.carousel], ['scroll-marker', f.scrollMarker], ['scroll-buttons', f.scrollButtons]]), h(Tag, { color: 'primary' }, '纯 CSS 轮播')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'CSS Carousels 提案让纯 CSS 实现轮播图：carousel-* 属性族（carousel / carousel-direction / carousel-loop / carousel-snapping）控制行为；scroll-marker / scroll-marker-group 生成分页指示器；scroll-buttons 生成前进/后退按钮；::carousel-content / ::scroll-marker / ::scroll-button-* 等伪元素由浏览器自动生成。键盘方向键、触屏滑动、Tab 焦点循环全部原生支持，无需 JS。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 Carousel 演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runCarouselDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, 'Carousel 演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.carouselInfo || '（点击「运行 Carousel 演示」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } }, h('code', {}, `<div carousel="auto">
  <div class="track">
    <div class="slide">1</div>
    <div class="slide">2</div>
    <div class="slide">3</div>
  </div>
</div>

[carousel] {
  carousel-direction: inline;
  carousel-loop: on;
  carousel-snapping: mandatory;
  scroll-marker: on;            /* 自动分页指示器 */
  scroll-marker-group: after;
  scroll-buttons: inline;       /* 自动前进/后退按钮 */
}
[carousel]::scroll-marker { width: 8px; height: 8px; border-radius: 50%; }
[carousel]::scroll-marker:current { background: #3b82f6; }`)),
                h(Alert, {
                    type: 'warning',
                    message: 'CSS Carousels 仍处 CSSWG 2024 提案阶段，无浏览器稳定支持',
                    description: '当前生产环境需用 CSS Scroll Snap（scroll-snap-type / scroll-snap-align）+ JS 实现分页指示器与按钮。CSS Carousels 一旦落地将大幅减少轮播组件代码量。检测：CSS.supports(\'carousel\', \'auto\')。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 3：CSS zoom 属性 ===================
    _runZoomDemo() {
        const f = this._flags();
        try {
            // 创建对比演示：zoom vs transform: scale()
            const host = document.createElement('div');
            host.style.cssText = 'display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;';
            host.innerHTML =
                '<div class="cap-zoom-box" style="zoom:1.5;background:#dbeafe;padding:8px;border-radius:4px;">' +
                    '<div style="background:#3b82f6;color:#fff;padding:4px 8px;border-radius:2px;">zoom: 1.5（占布局空间）</div>' +
                    '<div style="margin-top:4px;">后续元素被推到缩放后位置</div>' +
                    '</div>' +
                    '<div class="cap-zoom-box" style="transform:scale(1.5);transform-origin:top left;background:#dcfce7;padding:8px;border-radius:4px;">' +
                    '<div style="background:#16a34a;color:#fff;padding:4px 8px;border-radius:2px;">transform: scale(1.5)（不占布局空间）</div>' +
                    '<div style="margin-top:4px;">后续元素重叠在原位置</div>' +
                    '</div>';
            document.body.appendChild(host);
            this._dynamicNodes.push(host);
            const zoomBox = host.children[0];
            const scaleBox = host.children[1];
            const zoomVal = window.getComputedStyle(zoomBox).getPropertyValue('zoom');
            const transformVal = window.getComputedStyle(scaleBox).getPropertyValue('transform');
            // 测试 zoom 是否影响 getBoundingClientRect 尺寸
            const zoomRect = zoomBox.getBoundingClientRect();
            const scaleRect = scaleBox.getBoundingClientRect();
            this.setState({ zoomInfo: 'CSS zoom 属性演示：\n' +
                    '  .zoom-box { zoom: 1.5; } —— 影响布局，占据缩放后空间\n' +
                    '  .scale-box { transform: scale(1.5); transform-origin: top left; } —— 仅视觉变换\n' +
                    `  zoom 计算值="${zoomVal}"\n` +
                    `  transform 计算值="${transformVal}"\n` +
                    `  zoom-box getBoundingClientRect: width=${zoomRect.width}, height=${zoomRect.height}\n` +
                    `  scale-box getBoundingClientRect: width=${scaleRect.width}, height=${scaleRect.height}\n` +
                    `  （zoom 影响 rect 尺寸；transform: scale 也影响 rect 但不影响布局流）\n\n` +
                    `  CSS.supports('zoom','1.5') = ${f.zoom}; zoom:normal = ${f.zoomNormal}; zoom:reset = ${f.zoomReset}\n\n` +
                    '语法：zoom: <number> | <percentage> | normal | reset\n' +
                    '  <number>: 1.5 = 放大 1.5 倍；0.5 = 缩小一半\n' +
                    '  <percentage>: 150% = 等价 1.5\n' +
                    '  normal: 等价 1.0\n' +
                    '  reset: 重置用户代理缩放（仅 Chrome 110+，用于响应用户缩放操作）\n\n' +
                    'zoom vs transform: scale() 对比：\n' +
                    '  ┌─────────────────┬──────────────────────────┬────────────────────────────┐\n' +
                    '  │ 维度            │ zoom: 1.5                │ transform: scale(1.5)      │\n' +
                    '  ├─────────────────┼──────────────────────────┼────────────────────────────┤\n' +
                    '  │ 影响布局        │ ✓ 占据缩放后空间         │ ✗ 仅视觉，不占空间         │\n' +
                    '  │ 后续元素位置    │ 推到缩放后位置           │ 重叠在原位置               │\n' +
                    '  │ 子元素事件区域  │ ✓ 跟随缩放               │ ✓ 跟随缩放                 │\n' +
                    '  │ 创建合成层      │ ✗ 不创建（性能成本较低） │ ✓ 创建（GPU 加速）         │\n' +
                    '  │ 可动画          │ ✓ 可参与 transition      │ ✓ 可参与 transition        │\n' +
                    '  │ 文本字距        │ ✓ 重新排版               │ ✗ 像素缩放（可能模糊）     │\n' +
                    '  │ 浏览器支持      │ Chrome/Edge/Safari 历史  │ 全主流                     │\n' +
                    '  │                 │ + Firefox 126+（2024）   │                            │\n' +
                    '  └─────────────────┴──────────────────────────┴────────────────────────────┘\n\n' +
                    '用途：响应式整体缩放、可访问性放大、调试预览；vs scale 不重排文本更清晰。' });
            this._addLog('zoom', `zoom 演示：zoom="${zoomVal}", 支持=${f.zoom}, rect.width=${zoomRect.width}`);
        }
        catch (err) {
            this._addLog('warn', `zoom 演示失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard3() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '3. CSS zoom 属性',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['zoom', f.zoom], ['zoom:reset', f.zoomReset]]), h(Tag, { color: 'primary' }, 'vs transform: scale()')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'zoom 属性让元素整体缩放并影响布局（占据缩放后空间），与 transform: scale() 仅做视觉变换不占空间形成关键差异。语法：zoom: <number> | <percentage> | normal | reset。reset 值（Chrome 110+）用于响应用户缩放操作。历史上仅 IE/Edge/Chrome/Safari 支持，Firefox 126+（2024）起正式支持，现已全主流可用。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 zoom 演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runZoomDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, 'zoom 演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.zoomInfo || '（点击「运行 zoom 演示」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } }, h('code', {}, `.container { zoom: 1.25; }              /* 整体放大 1.25 倍，影响布局 */
.thumbnail { zoom: 0.5; }              /* 缩略图缩小一半 */
.accessible { zoom: 1.5; }             /* 无障碍放大 */

/* vs transform: scale() */
.visual-only { transform: scale(1.5); transform-origin: top left; }

/* reset 值：响应浏览器用户缩放（仅 Chrome 110+） */
html { zoom: reset; }

/* 检测 */
if (CSS.supports('zoom', '1.5')) { /* 安全使用 zoom */ }`)),
                h(Alert, {
                    type: 'info',
                    message: 'zoom 影响布局，transform: scale() 仅视觉',
                    description: 'zoom 让后续元素被推到缩放后位置，文本重新排版更清晰；transform: scale() 不占空间、创建合成层 GPU 加速、像素缩放可能模糊。Firefox 126+（2024.5）正式支持 zoom，至此全主流可用。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 4：CSS env() / viewport-fit ===================
    _runEnvDemo() {
        const f = this._flags();
        try {
            const host = document.createElement('div');
            host.style.cssText = 'padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); background:#fef3c7; margin-top:8px; border-radius:4px; min-height:60px; display:flex;align-items:center;justify-content:center;';
            host.textContent = 'env(safe-area-inset-*) 安全区演示';
            document.body.appendChild(host);
            this._dynamicNodes.push(host);
            // 读取计算值
            const paddingTop = window.getComputedStyle(host).getPropertyValue('padding-top');
            const paddingLeft = window.getComputedStyle(host).getPropertyValue('padding-left');
            this.setState({ envInfo: 'CSS env() 与 viewport-fit 演示：\n' +
                    '  .safe-box { padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); }\n' +
                    `  padding-top 计算值="${paddingTop}"（理想 0px 或环境值；jsdom 不渲染可能为空）\n` +
                    `  padding-left 计算值="${paddingLeft}"\n\n` +
                    `  CSS.supports('width','env(safe-area-inset-left)') = ${f.env}\n` +
                    `  env(titlebar-area-x) = ${f.envTitlebar}\n` +
                    `  env(viewport-segment-width) = ${f.envViewport}\n` +
                    `  constant() 旧前缀 = ${f.constant}\n\n` +
                    'env() 变量族：\n' +
                    '  env(safe-area-inset-top/right/bottom/left) —— 刘海屏/折叠屏安全区边距\n' +
                    '  env(titlebar-area-x/y/width/height) —— PWA 桌面窗口标题栏拖拽区\n' +
                    '  env(viewport-segment-width/height) —— 折叠屏双屏尺寸\n' +
                    '  env(viewport-segment-x/y) —— 折叠屏铰链位置\n' +
                    '  env(keyboard-inset-height) —— 虚拟键盘高度（Chrome 101+）\n\n' +
                    '前置条件：<meta name="viewport" content="viewport-fit=cover">\n' +
                    '  viewport-fit: auto | contain | cover\n' +
                    '  cover 让 web 内容延伸到屏幕边缘（包括刘海区），用 env(safe-area-inset-*) 避让\n' +
                    '  contain（默认）让 web 内容限制在安全区内\n\n' +
                    'constant() 旧前缀：iOS < 11.2 使用 constant(safe-area-inset-*)，新版本用 env()。\n' +
                    '  兼容写法：constant() 与 env() 同时声明，env() 覆盖前者。\n\n' +
                    '用途：iPhone 刘海避让、折叠屏铰链区不显示内容、PWA 桌面应用自定义标题栏、\n' +
                    '  移动端虚拟键盘弹出后避让输入框。' });
            this._addLog('env', `env() 演示：padding-top="${paddingTop}", 支持=${f.env}, constant=${f.constant}`);
        }
        catch (err) {
            this._addLog('warn', `env() 演示失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard4() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '4. CSS env() / viewport-fit',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['env()', f.env], ['constant()', f.constant], ['titlebar-area', f.envTitlebar]]), h(Tag, { color: 'primary' }, '刘海屏 / 折叠屏 / PWA')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'env() 读取浏览器环境变量，主要用于响应刘海屏 / 折叠屏 / PWA 桌面窗口的环境边距。env(safe-area-inset-*) 提供安全区边距；env(titlebar-area-*) 用于 PWA 桌面应用自定义标题栏拖拽区；env(viewport-segment-*) 用于折叠屏双屏尺寸与铰链位置；env(keyboard-inset-height) 用于虚拟键盘避让。前置：HTML <meta name="viewport" content="viewport-fit=cover">。constant() 是 iOS < 11.2 的旧前缀。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 env() 演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runEnvDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, 'env() 演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.envInfo || '（点击「运行 env() 演示」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '200px', overflow: 'auto' } }, h('code', {}, `<!-- HTML head 中 -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">

/* CSS：避让刘海屏 */
.safe-area {
  padding-top:    constant(safe-area-inset-top);    /* iOS < 11.2 */
  padding-top:    env(safe-area-inset-top);          /* 标准 */
  padding-right:  env(safe-area-inset-right);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left:   env(safe-area-inset-left);
}

/* PWA 桌面应用自定义标题栏 */
.app-titlebar {
  -webkit-app-region: drag;
  width:  env(titlebar-area-width);
  height: env(titlebar-area-height);
  x:      env(titlebar-area-x);
  y:      env(titlebar-area-y);
}

/* 折叠屏：根据铰链位置调整布局 */
@media (vertical-viewport-segments: 2) {
  .foldable { display: grid; grid-template-columns:
    env(viewport-segment-left 0 width) 1fr env(viewport-segment-right 0 width); }
}

/* 检测 */
if (CSS.supports('padding-top', 'env(safe-area-inset-top)')) { /* env() 可用 */ }`)),
                h(Alert, {
                    type: 'info',
                    message: 'env() 配合 viewport-fit=cover 应对刘海屏 / 折叠屏 / PWA 桌面窗口',
                    description: 'constant() 是 iOS 11.0-11.2 旧前缀，env() 是标准。同时声明两者保持向后兼容（env() 覆盖 constant()）。Chrome 69+ / Safari 11.2+ / Firefox 65+ 支持 env()。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 5：CSS Masking 高级 ===================
    _runMaskDemo() {
        const f = this._flags();
        try {
            const style = document.createElement('style');
            const svgCircleMask = 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ccircle cx=%2250%22 cy=%2250%22 r=%2240%22 fill=%22black%22/%3E%3C/svg%3E")';
            style.textContent =
                '.cap-mask-row { display:flex; gap:12px; flex-wrap:wrap; margin-top:8px; }\n' +
                    '.cap-mask-box { width: 120px; height: 80px; display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;border-radius:4px; }\n' +
                    '.cap-mask-gradient { background: linear-gradient(135deg,#3b82f6,#8b5cf6); -webkit-mask-image: linear-gradient(to right, black 50%, transparent); mask-image: linear-gradient(to right, black 50%, transparent); -webkit-mask-mode: alpha; mask-mode: alpha; }\n' +
                    '.cap-mask-repeat { background:#ef4444; -webkit-mask-image: radial-gradient(circle 10px at center, black); mask-image: radial-gradient(circle 10px at center, black); -webkit-mask-repeat: repeat; mask-repeat: repeat; -webkit-mask-size: 30px 30px; mask-size: 30px 30px; }\n' +
                    '.cap-mask-composite { background:#10b981; -webkit-mask-image: linear-gradient(black, transparent), linear-gradient(transparent, black); mask-image: linear-gradient(black, transparent), linear-gradient(transparent, black); -webkit-mask-composite: source-in; mask-composite: intersect; }\n' +
                    '.cap-mask-svg { background:#f59e0b; -webkit-mask-image: ' + svgCircleMask + '; mask-image: ' + svgCircleMask + '; -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; }';
            document.head.appendChild(style);
            this._dynamicStyles.push(style);
            const host = document.createElement('div');
            host.className = 'cap-mask-row';
            host.innerHTML =
                '<div class="cap-mask-box cap-mask-gradient">渐变蒙版</div>' +
                    '<div class="cap-mask-box cap-mask-repeat">重复圆点</div>' +
                    '<div class="cap-mask-box cap-mask-composite">复合 intersect</div>' +
                    '<div class="cap-mask-box cap-mask-svg">SVG 蒙版</div>';
            document.body.appendChild(host);
            this._dynamicNodes.push(host);
            const g = host.querySelector('.cap-mask-gradient');
            const maskImageVal = window.getComputedStyle(g).getPropertyValue('mask-image');
            const webkitMaskImageVal = window.getComputedStyle(g).getPropertyValue('-webkit-mask-image');
            const maskModeVal = window.getComputedStyle(g).getPropertyValue('mask-mode');
            const maskCompositeVal = window.getComputedStyle(host.querySelector('.cap-mask-composite')).getPropertyValue('mask-composite');
            this.setState({ maskInfo: 'CSS Masking 高级演示：\n' +
                    '  已注入 4 种 mask 演示：渐变 / 重复圆点 / 复合 intersect / SVG 圆形蒙版\n' +
                    `  mask-image 计算值="${maskImageVal}"\n` +
                    `  -webkit-mask-image 计算值="${webkitMaskImageVal}"\n` +
                    `  mask-mode 计算值="${maskModeVal}"\n` +
                    `  mask-composite 计算值="${maskCompositeVal}"\n\n` +
                    `  CSS.supports('mask-image','linear-gradient(black, transparent)') = ${f.maskImage}\n` +
                    `  mask-mode = ${f.maskMode}; mask-composite = ${f.maskComposite}; mask-border = ${f.maskBorder}\n\n` +
                    'mask-* 属性族（与 background-* 同构）：\n' +
                    '  mask: <mask-image> <mask-position> / <mask-size> <mask-repeat> <mask-origin> <mask-clip> <mask-composite> <mask-mode>（简写）\n' +
                    '  mask-image: none | <image> | <image># —— 蒙版图像（渐变 / url() / SVG）\n' +
                    '  mask-mode: alpha | luminance | match-source —— 蒙版通道（alpha 透明度 / luminance 亮度）\n' +
                    '  mask-repeat: repeat | no-repeat | space | round | repeat-x | repeat-y\n' +
                    '  mask-position: <position>（与 background-position 同语法）\n' +
                    '  mask-size: auto | <length> | <percentage> | cover | contain\n' +
                    '  mask-origin: border-box | padding-box | content-box | fill-box | stroke-box | view-box\n' +
                    '  mask-clip: 同 mask-origin —— 蒙版裁剪到哪个盒\n' +
                    '  mask-composite: add | subtract | intersect | exclude —— 多个 mask 的合成方式\n\n' +
                    'mask-border（CSS Masking Level 2，部分浏览器支持）：\n' +
                    '  mask-border-source / mask-border-slice / mask-border-width / mask-border-outset / mask-border-repeat / mask-border-mode\n\n' +
                    'SVG 元素：mask-type: alpha | luminance 控制 <mask> 元素如何应用\n\n' +
                    '兼容性：Chrome 120+（2023.12）起标准语法无需 -webkit- 前缀；Safari 仍需 -webkit-；\n' +
                    '  Firefox 53+ 早已支持标准语法。生产环境建议同时声明 -webkit- 与标准属性。' });
            this._addLog('mask', `Mask 演示：mask-image="${maskImageVal}", 支持=${f.maskImage}, composite=${f.maskComposite}`);
        }
        catch (err) {
            this._addLog('warn', `Mask 演示失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard5() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '5. CSS Masking 高级',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['mask-image', f.maskImage], ['mask-mode', f.maskMode], ['mask-composite', f.maskComposite], ['mask-border', f.maskBorder]]), h(Tag, { color: 'primary' }, '与 background-* 同构')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'CSS Masking 通过 mask-* 属性族（与 background-* 同构）实现图像蒙版：mask-image / mask-mode / mask-repeat / mask-position / mask-size / mask-origin / mask-clip / mask-composite。mask-mode: alpha|luminance|match-source 决定用蒙版图像的 alpha 通道还是亮度作为遮罩；mask-composite: add|subtract|intersect|exclude 控制多个蒙版的合成方式。Chrome 120+（2023.12）起标准语法无需 -webkit- 前缀；Safari 仍需 -webkit-；Firefox 53+ 早已支持。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 Mask 演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runMaskDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, 'Mask 演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '340px', overflow: 'auto' } }, h('code', {}, s.maskInfo || '（点击「运行 Mask 演示」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } }, h('code', {}, `.fade-out {
  -webkit-mask-image: linear-gradient(to bottom, black 50%, transparent);
          mask-image: linear-gradient(to bottom, black 50%, transparent);
  -webkit-mask-mode: alpha;
          mask-mode: alpha;
}

.dot-pattern {
  -webkit-mask-image: radial-gradient(circle 5px at center, black);
          mask-image: radial-gradient(circle 5px at center, black);
  -webkit-mask-size: 20px 20px;
          mask-size: 20px 20px;
  -webkit-mask-repeat: repeat;
          mask-repeat: repeat;
}

/* 多蒙版合成：intersect 交集显示 */
.cross {
  -webkit-mask-image: linear-gradient(black, transparent),
                     linear-gradient(transparent, black);
          mask-image: linear-gradient(black, transparent),
                     linear-gradient(transparent, black);
  -webkit-mask-composite: source-in;
          mask-composite: intersect;
}

/* SVG 图像蒙版 */
.svg-mask {
  -webkit-mask-image: url("data:image/svg+xml,...");
          mask-image: url("data:image/svg+xml,...");
}`)),
                h(Alert, {
                    type: 'info',
                    message: 'mask-* 与 background-* 同构，迁移成本低',
                    description: 'Chrome 120+ 起标准 mask-* 无需前缀；Safari 仍需 -webkit-mask-*。生产环境同时声明两套保持兼容。mask-mode: luminance 让 PNG 黑白图作蒙版（如老式 PS 蒙版）；alpha 用图像透明度。mask-composite 让多个蒙版做布尔运算。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 6：CSS 高级伪类全家桶 ===================
    _runPseudoDemo() {
        const f = this._flags();
        try {
            const host = document.createElement('div');
            host.style.cssText = 'margin-top:8px;';
            host.innerHTML =
                '<dialog class="cap-pseudo-dialog" style="border:1px solid #cbd5e1;padding:12px;border-radius:4px;"><p>dialog 元素（showModal 后匹配 :modal）</p><form method="dialog"><button>关闭</button></form></dialog>' +
                    '<div id="cap-pseudo-popover" popover="auto" style="background:#1e293b;color:#fff;padding:8px;border-radius:4px;">popover（显示时匹配 :popover-open）</div>' +
                    '<div class="cap-pseudo-list">' +
                    Array.from({ length: 6 }, (_, i) => `<div class="cap-pseudo-item ${i % 2 === 0 ? 'even' : 'odd'}">Item ${i + 1}</div>`).join('') +
                    '</div>';
            document.body.appendChild(host);
            this._dynamicNodes.push(host);
            // 尝试 showModal 检测 :modal 匹配（jsdom 可能不支持）
            let modalMatches = false, popoverMatches = false;
            try {
                const dlg = host.querySelector('.cap-pseudo-dialog');
                if (dlg && typeof dlg.showModal === 'function') {
                    // jsdom 中 showModal 可能抛错；真实浏览器会显示模态
                    try {
                        dlg.showModal();
                        modalMatches = dlg.matches(':modal');
                    }
                    catch { /* noop */ }
                }
            }
            catch { /* noop */ }
            try {
                const pop = host.querySelector('#cap-pseudo-popover');
                if (pop && typeof pop.showPopover === 'function') {
                    try {
                        pop.showPopover();
                        popoverMatches = pop.matches(':popover-open');
                    }
                    catch { /* noop */ }
                }
            }
            catch { /* noop */ }
            // :nth-child(2n of .even) 选择性匹配测试
            let nthChildOfMatches = 0;
            try {
                nthChildOfMatches = host.querySelectorAll('.cap-pseudo-list :nth-child(2n of .even)').length;
            }
            catch { /* jsdom 可能不支持 of 语法，querySelector 抛 SyntaxError */ }
            this.setState({ pseudoInfo: 'CSS 高级伪类全家桶演示：\n' +
                    `  :modal 匹配 = ${modalMatches}（dialog.showModal() 后匹配）\n` +
                    `  :popover-open 匹配 = ${popoverMatches}（showPopover() 后匹配）\n` +
                    `  :nth-child(2n of .even) 匹配数量 = ${nthChildOfMatches}（理想 3，jsdom 可能不支持 of 语法）\n\n` +
                    `  CSS.supports 检测：\n` +
                    `    :modal             = ${f.modal}\n` +
                    `    :popover-open      = ${f.popoverOpen}\n` +
                    `    :fullscreen        = ${f.fullscreen}\n` +
                    `    :picture-in-picture= ${f.pictureInPicture}\n` +
                    `    :target-within     = ${f.targetWithin}\n` +
                    `    :dir()             = ${f.dir}\n` +
                    `    :defined           = ${f.defined}\n` +
                    `    :nth-child(of)     = ${f.nthChildOf}\n` +
                    `    :playing / :paused = ${f.playing} / ${f.paused}\n` +
                    `    :seeking / :muted  = ${f.seeking} / ${f.muted}\n\n` +
                    '伪类族分类：\n' +
                    '  ┌──────────────────────┬──────────────────────────────────────┐\n' +
                    '  │ 伪类                 │ 匹配条件 / 用途                      │\n' +
                    '  ├──────────────────────┼──────────────────────────────────────┤\n' +
                    '  │ :modal               │ dialog.showModal() 显示的模态框       │\n' +
                    '  │ :popover-open        │ showPopover() 显示的 popover         │\n' +
                    '  │ :fullscreen          │ requestFullscreen() 全屏元素          │\n' +
                    '  │ :picture-in-picture  │ 视频请求画中画                        │\n' +
                    '  │ :target-within       │ 后代含 :target 元素（:target 父版）   │\n' +
                    '  │ :dir(rtl|ltr)        │ 文本方向匹配（vs [dir] 属性选择器）   │\n' +
                    '  │ :defined             │ 已 customElements.define 的自定义元素 │\n' +
                    '  │ :nth-child(an+b of S)│ 仅在 S 选择器匹配的子元素中计数       │\n' +
                    '  ├──────────────────────┼──────────────────────────────────────┤\n' +
                    '  │ :playing             │ 媒体正在播放                          │\n' +
                    '  │ :paused              │ 媒体已暂停                            │\n' +
                    '  │ :seeking             │ 媒体正在 seek                         │\n' +
                    '  │ :buffering           │ 媒体正在缓冲                          │\n' +
                    '  │ :muted               │ 媒体已静音                            │\n' +
                    '  │ :volume-locked       │ 媒体音量被锁定（无法调节）            │\n' +
                    '  └──────────────────────┴──────────────────────────────────────┘\n\n' +
                    ':nth-child(an+b of S) 用法：\n' +
                    '  li:nth-child(2n of .item) { ... } —— 仅在 .item 类的 li 中每隔一个选中\n' +
                    '  vs li.item:nth-child(2n) —— 后者先选所有 li 的偶数位再过滤 .item，结果不同\n' +
                    '  用途：在动态过滤列表中保持斑马纹、跳过隐藏项计数。\n\n' +
                    ':dir() vs [dir] 属性：\n' +
                    '  [dir="rtl"] 仅匹配显式声明 dir 属性的元素；\n' +
                    '  :dir(rtl) 匹配实际计算方向（含继承）。更准确。\n\n' +
                    ':defined 用法：\n' +
                    '  customElements.define 前自定义元素为 :not(:defined)，可显示加载占位：\n' +
                    '  my-element:not(:defined) { display: block; min-height: 100px; background: #f1f5f9; }\n' +
                    '  my-element:defined { animation: fade-in 0.3s; }' });
            this._addLog('pseudo', `伪类演示：modal=${modalMatches}, popover=${popoverMatches}, nth-child(of)=${nthChildOfMatches}`);
        }
        catch (err) {
            this._addLog('warn', `伪类演示失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard6() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '6. CSS 高级伪类全家桶',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([[':modal', f.modal], [':popover-open', f.popoverOpen], [':nth-child(of)', f.nthChildOf], [':dir()', f.dir]]), h(Tag, { color: 'primary' }, 'modal / media / selector')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'CSS 高级伪类覆盖三类：交互状态（:modal / :popover-open / :fullscreen / :picture-in-picture）、选择器增强（:target-within / :dir() / :defined / :nth-child(an+b of S)）、媒体状态（:playing / :paused / :seeking / :buffering / :muted / :volume-locked）。:nth-child(of S) 仅在 S 匹配的子元素中计数（vs :nth-child 先选再过滤）；:dir() 匹配计算方向（vs [dir] 属性选择器仅匹配显式声明）；:defined 区分自定义元素是否已注册，常用于加载占位样式。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行伪类演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runPseudoDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '伪类演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '360px', overflow: 'auto' } }, h('code', {}, s.pseudoInfo || '（点击「运行伪类演示」）')),
                h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
                h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } }, h('code', {}, `/* 模态框样式（仅 showModal 触发） */
dialog:modal { border: 2px solid #3b82f6; box-shadow: 0 20px 40px rgba(0,0,0,.3); }
dialog:modal::backdrop { background: rgba(0,0,0,.5); }

/* popover 显示样式 */
[popover]:popover-open { animation: pop-in 0.2s; }

/* 全屏视频样式 */
video:fullscreen { background: black; }

/* 媒体播放状态 */
video:playing { outline: 2px solid #10b981; }
video:paused { outline: 2px solid #f59e0b; }
video:buffering::after { content: "加载中..."; }

/* :nth-child(an+b of S) —— 仅在 .visible 项中斑马纹 */
li:nth-child(2n of .visible) { background: #f1f5f9; }

/* :dir() —— RTL 自动适配 */
blockquote:dir(rtl) { border-right: 4px solid #3b82f6; border-left: 0; padding-right: 12px; }

/* :defined —— 自定义元素加载占位 */
my-widget:not(:defined) { display: block; min-height: 100px; background: #f1f5f9; }
my-widget:defined { animation: fade-in 0.3s; }`)),
                h(Alert, {
                    type: 'info',
                    message: ':nth-child(of S) 与 :dir() 是选择器 Level 4 重要增强',
                    description: ':nth-child(an+b of S) 解决动态过滤列表斑马纹问题；:dir() 匹配计算方向（含继承），比 [dir] 属性选择器更准确；:defined 区分自定义元素注册前后，常用于加载占位；:modal / :popover-open / :fullscreen 与对应 JS API 协同；媒体伪类（:playing/:paused/:seeking/:buffering/:muted）让媒体播放器状态纯 CSS 表达。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== 日志面板 ===================
    _renderLogPanel() {
        const s = this.state;
        return h('div', { class: 'log-panel' }, h('div', { class: 'log-panel__header' }, '事件日志', h(Tag, { color: 'primary' }, `${s.logs.length} 条`)), s.logs.length === 0
            ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
            : s.logs.map((log) => h('div', { class: 'log-panel__line' }, h('span', { class: 'log-panel__time' }, log.time), h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type), h('span', { class: 'log-panel__content' }, log.content))));
    }
    // =================== 整页渲染 ===================
    render() {
        const s = this.state;
        return h('div', { class: 'api-lab-page css-advanced-properties-page' }, h('h2', { class: 'section-title' }, 'CSS 高级属性 实验室'), h('p', { class: 'fs-sm text-secondary mb-md' }, '本页演示 attr() 类型化（CSS Values Level 5）、CSS Carousels 提案、CSS zoom 属性、env() 与 viewport-fit、CSS Masking 高级、CSS 高级伪类全家桶（:modal / :popover-open / :nth-child(of) / :dir() / 媒体伪类等）。所有特性通过 typeof / CSS.supports 能力检测，不可用时仅记日志，绝不抛异常。'), s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderLogPanel());
    }
}
//# sourceMappingURL=CSSAdvancedPropertiesPage.js.map