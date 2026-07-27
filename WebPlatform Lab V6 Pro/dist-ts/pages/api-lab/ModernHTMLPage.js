// =====================================================================
// ModernHTMLPage.js —— 现代 HTML 全局属性 实验室
// 演示 MDN 2023-2025 HTML 新增/增强的全局属性与原语：
//   1. hidden="until-found" + beforematch 事件 —— 内容默认隐藏但可被
//      浏览器查找（Ctrl+F）命中时自动展开并滚动定位（SEO 友好的渐进披露），
//      beforematch 事件在展开前触发可做埋点/懒加载，vs hidden vs display:none
//   2. <details name="..."> 互斥手风琴 —— 同 name 的 details 同一时间只展开一个，
//      纯 HTML 无需 JS（Chrome 120+/Edge 120+），toggle 事件，vs 手写 JS 互斥
//   3. inert 全局属性 —— 一属性完成块级禁用：不可聚焦/不可编辑/不触发事件/
//      被 AT 跳过/不参与 Tab 序列，模态对话框遮罩、抽屉导航、加载中表单的标准做法，
//      vs pointer-events:none + aria-hidden + tabindex=-1 组合
//   4. loading="lazy" 原生懒加载 —— img/iframe 接近视口才加载（Chrome 121+ iframe），
//      fetchpriority=high|low|auto 精细控制资源抢占顺序，vs IntersectionObserver 懒加载
//   5. popover="hint" —— Popover API 的 hint 模式（轻量提示，点击外部即关闭，
//      不进顶层栈），vs popover="auto"/"manual"，commandfor 声明式触发回顾
//   6. <search> / <dialog> 语义元素 —— <search> 搜索区语义（Chrome 118+）、
//      <dialog> 原生模态 + ::backdrop、close 事件、returnValue、showModal vs show
// 说明：所有特性调用前做 typeof/in/属性检测，不可用时仅记日志，绝不抛异常。
//       jsdom 中 hidden/inert/loading/details 均为属性可读写（无渲染效果），
//       beforematch/toggle/close 事件需真实浏览器，能力检测+日志兜底。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class ModernHTMLPage extends Page {
    _beforematchAttached;
    _inited;
    _injectedStyles;
    _lazyToggle;
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            untilFoundState: '',
            accordionInfo: '',
            inertState: '',
            lazyInfo: '',
            popoverHintState: '',
            dialogInfo: '',
        };
    }
    componentDidMount() {
        if (this._inited)
            return;
        this._inited = true;
        this._injectedStyles = [];
        this._beforematchAttached = false;
        const caps = this._caps();
        const c = (ok) => ok ? '✓' : '✗';
        const parts = [
            `hidden=until-found ${c(caps.untilFound)}`,
            `beforematch ${c(caps.beforematch)}`,
            `<details name> ${c(caps.detailsName)}`,
            `inert ${c(caps.inert)}`,
            `loading=lazy(img) ${c(caps.loadingLazyImg)}`,
            `loading=lazy(iframe) ${c(caps.loadingLazyIframe)}`,
            `fetchpriority ${c(caps.fetchpriority)}`,
            `popover=hint ${c(caps.popoverHint)}`,
            `popover ${c(caps.popover)}`,
            `<search> ${c(caps.search)}`,
            `<dialog> ${c(caps.dialog)}`,
            `showModal ${c(caps.showModal)}`,
        ];
        const summary = `现代 HTML 全局属性能力检测：${parts.join(' · ')}。`
            + 'jsdom 中属性可读写但无渲染效果，事件需真实浏览器；点击按钮可读写属性并记日志。';
        this.setState({
            capsSummary: summary,
            logs: [...this.state.logs, { type: 'info', content: `能力检测：${parts.join('，')}`, time: formatTime() }].slice(-40),
        });
        if (!caps.untilFound)
            this._addLog('warn', 'hidden="until-found" 不可用（Chrome 102+），演示仅记日志');
        if (!caps.detailsName)
            this._addLog('warn', '<details name> 互斥手风琴不可用（Chrome 120+），演示仅记日志');
        if (!caps.inert)
            this._addLog('warn', 'inert 属性不可用（全主流 2022+ 已稳定），演示仅记日志');
        if (!caps.popoverHint)
            this._addLog('warn', 'popover="hint" 不可用（Chrome 114+），演示仅记日志');
        this._injectDemoStyles();
    }
    componentWillUnmount() {
        if (Array.isArray(this._injectedStyles)) {
            this._injectedStyles.forEach((el) => el?.remove());
            this._injectedStyles = [];
        }
    }
    _addLog(type, content) {
        this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
    }
    _btn(label, opts) {
        const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
        this.registerChild(btn);
        return btn.render();
    }
    _injectStyle(id, textContent) {
        const existing = document.getElementById(id);
        if (existing)
            existing.remove();
        const style = document.createElement('style');
        style.id = id;
        style.textContent = textContent;
        document.head.appendChild(style);
        this._injectedStyles.push(style);
        return style;
    }
    _caps() {
        let untilFound = false;
        try {
            const d = document.createElement('div');
            d.setAttribute('hidden', 'until-found');
            untilFound = (d.getAttribute('hidden') === 'until-found');
        }
        catch {
            untilFound = false;
        }
        let beforematch = false;
        try {
            beforematch = typeof window !== 'undefined' && ('onbeforematch' in window || (typeof document !== 'undefined' && document.body && 'onbeforematch' in document.body));
        }
        catch {
            beforematch = false;
        }
        let detailsName = false;
        try {
            const d = document.createElement('details');
            d.setAttribute('name', 'grp');
            detailsName = (typeof HTMLDetailsElement !== 'undefined' && 'name' in HTMLDetailsElement.prototype && d.getAttribute('name') === 'grp');
        }
        catch {
            detailsName = false;
        }
        let inert = false;
        try {
            inert = typeof HTMLElement !== 'undefined' && 'inert' in HTMLElement.prototype;
        }
        catch {
            inert = false;
        }
        let loadingLazyImg = false, loadingLazyIframe = false;
        try {
            loadingLazyImg = typeof HTMLImageElement !== 'undefined' && 'loading' in HTMLImageElement.prototype;
        }
        catch { /* noop */ }
        try {
            loadingLazyIframe = typeof HTMLIFrameElement !== 'undefined' && 'loading' in HTMLIFrameElement.prototype;
        }
        catch { /* noop */ }
        let fetchpriority = false;
        try {
            fetchpriority = typeof HTMLImageElement !== 'undefined' && 'fetchPriority' in HTMLImageElement.prototype;
        }
        catch {
            fetchpriority = false;
        }
        let popover = false, popoverHint = false;
        try {
            popover = typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover === 'function';
        }
        catch {
            popover = false;
        }
        try {
            if (popover) {
                const d = document.createElement('div');
                d.setAttribute('popover', 'hint');
                popoverHint = (d.getAttribute('popover') === 'hint');
            }
        }
        catch {
            popoverHint = false;
        }
        let search = false;
        try {
            search = typeof document !== 'undefined' && document.createElement('search') instanceof HTMLElement;
        }
        catch {
            search = false;
        }
        let dialog = false, showModal = false;
        try {
            dialog = typeof HTMLDialogElement !== 'undefined';
        }
        catch {
            dialog = false;
        }
        try {
            showModal = dialog && typeof HTMLDialogElement.prototype.showModal === 'function';
        }
        catch {
            showModal = false;
        }
        return {
            untilFound, beforematch, detailsName, inert,
            loadingLazyImg, loadingLazyIframe, fetchpriority,
            popoverHint, popover, search, dialog, showModal,
        };
    }
    _injectDemoStyles() {
        this._injectStyle('modern-html-demo', `
      .mh-demo-box { border: 1px dashed #cbd5e1; border-radius: 6px; padding: 12px; margin-top: 8px; background: #fff; }
      .mh-until-found { padding: 10px; background: #fef3c7; border-radius: 4px; margin-top: 8px; }
      .mh-until-found[hidden="until-found"] { display: none; }
      .mh-details-group { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
      .mh-details-group details { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; }
      .mh-details-group details summary { cursor: pointer; font-weight: 600; color: #1e40af; }
      .mh-details-group details[open] summary { color: #0f766e; }
      .mh-inert-stage { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px; align-items: flex-start; }
      .mh-inert-pane { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; min-width: 200px; }
      .mh-inert-pane[inert] { opacity: .5; background: #f1f5f9; }
      .mh-lazy-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; margin-top: 8px; }
      .mh-lazy-grid img { width: 100%; height: 80px; object-fit: cover; border-radius: 4px; background: #e2e8f0; }
      dialog.mh-dialog::backdrop { background: rgba(15,23,42,.55); }
      .mh-dialog { border-radius: 8px; border: 1px solid #cbd5e1; padding: 18px; max-width: 360px; }
      [popover].mh-hint { padding: 8px 12px; background: #1e293b; color: #fff; border-radius: 4px; font-size: 12px; border: none; }
    `);
    }
    // ============ Card 1：hidden="until-found" + beforematch ============
    _toggleUntilFound() {
        const el = this.$('#mh-until-found');
        if (!el) {
            this._addLog('warn', '未找到演示元素');
            return;
        }
        try {
            const cur = el.getAttribute('hidden');
            if (cur === 'until-found') {
                el.removeAttribute('hidden');
                this._addLog('info', '移除 hidden="until-found"，内容已显示');
                this.setState({ untilFoundState: '当前：已显示（移除 hidden）' });
            }
            else {
                el.setAttribute('hidden', 'until-found');
                this._addLog('info', '设置 hidden="until-found"：默认隐藏，但 Ctrl+F 命中关键词时会自动展开');
                this.setState({ untilFoundState: '当前：hidden="until-found"（Ctrl+F 可触发展开）' });
            }
        }
        catch (err) {
            this._addLog('warn', '操作失败：' + (err && err.message));
        }
    }
    _attachBeforematch() {
        const el = this.$('#mh-until-found');
        if (!el) {
            this._addLog('warn', '未找到演示元素');
            return;
        }
        if (!this._caps().beforematch) {
            this._addLog('warn', 'beforematch 事件不支持（需真实浏览器 Chrome 102+），仅说明用法：在 hidden="until-found" 元素被查找命中、即将展开前触发，可做埋点/懒加载');
            return;
        }
        if (this._beforematchAttached) {
            this._addLog('info', 'beforematch 监听已存在');
            return;
        }
        this._beforematchAttached = true;
        // 用 on* 属性绑定即可，无需手动 addEventListener（rerender 会重绑）
        this._addLog('info', 'beforematch 已通过 onbeforematch 绑定：用 Ctrl+F 搜索 "稀缺知识" 试试');
    }
    _renderCard1() {
        const s = this.state;
        return h(Card, {
            title: 'Card 1 · hidden="until-found" + beforematch',
            extra: h(Tag, { color: this._caps().untilFound ? 'success' : 'error' }, this._caps().untilFound ? '已支持' : '未支持'),
        }, h('p', { class: 'fs-sm text-secondary' }, 'hidden="until-found"：内容默认隐藏，但浏览器查找（Ctrl+F）命中时自动展开并滚动定位（SEO 友好的渐进披露）；' +
            'beforematch 事件在展开前触发，可做埋点/懒加载。vs hidden（彻底隐藏不可搜索）vs display:none。'), h('div', { class: 'mh-demo-box' }, h('div', {
            id: 'mh-until-found', class: 'mh-until-found',
            onbeforematch: (e) => {
                this._addLog('beforematch', 'beforematch 触发！内容即将展开（可在此埋点/懒加载）');
                this.setState({ untilFoundState: 'beforematch 已触发，内容展开' });
            },
        }, h('p', {}, '这是 hidden="until-found" 区域。设置后用 Ctrl+F 搜索 "稀缺知识" 即可触发展开。'), h('p', {}, '稀缺知识：beforematch 事件是 2022 年新增的渐进披露原语。'))), h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' }, this._btn('切换 hidden=until-found', { type: 'primary', size: 'sm', onClick: () => this._toggleUntilFound() }), this._btn('说明 beforematch', { type: 'default', size: 'sm', onClick: () => this._attachBeforematch() })), s.untilFoundState ? h('p', { class: 'fs-sm mt-sm text-secondary' }, s.untilFoundState) : null, h('pre', { class: 'code-block mt-md' }, `<div hidden="until-found">...</div>
el.addEventListener('beforematch', e => { /* 埋点/懒加载 */ });
// vs hidden（不可搜索） vs display:none（不占空间）`));
    }
    // ============ Card 2：<details name> 互斥手风琴 ============
    _renderCard2() {
        const s = this.state;
        const onToggle = (e) => {
            const d = e.target;
            this._addLog('info', `details[name=${d.getAttribute('name')}] toggle → open=${d.open}`);
            const grp = this.$('#mh-details-group');
            const openCount = grp ? grp.querySelectorAll('details[open]').length : 0;
            this.setState({ accordionInfo: `同 name 互斥：当前展开数量=${openCount}（同 name 仅 1 个可展开）` });
        };
        const mk = (summary, body) => h('details', { name: 'faq', ontoggle: onToggle }, h('summary', {}, summary), h('p', { class: 'fs-sm' }, body));
        return h(Card, {
            title: 'Card 2 · <details name> 互斥手风琴',
            extra: h(Tag, { color: this._caps().detailsName ? 'success' : 'error' }, this._caps().detailsName ? '已支持' : '未支持'),
        }, h('p', { class: 'fs-sm text-secondary' }, '<details name="grp">：同 name 的 details 同一时间只展开一个，纯 HTML 无需 JS（Chrome 120+）；' +
            'toggle 事件 + details.open 属性；vs 手写 JS 互斥逻辑。'), h('div', { id: 'mh-details-group', class: 'mh-details-group' }, mk('FAQ 1 · 什么是互斥手风琴？', '同 name 的 details 同时只展开一个，展开新的会自动关闭同组其他已展开的。'), mk('FAQ 2 · 浏览器支持？', 'Chrome 120+/Edge 120+ 已稳定；Safari 17.2+；Firefox 暂不支持。'), mk('FAQ 3 · 与 JS 方案对比？', '纯 HTML 声明式、可 SSR、无 JS 依赖、键盘可访问；JS 方案需手写状态管理。')), s.accordionInfo ? h('p', { class: 'fs-sm mt-sm text-secondary' }, s.accordionInfo) : null, h('pre', { class: 'code-block mt-md' }, `<details name="faq"><summary>Q1</summary>...</details>
<details name="faq"><summary>Q2</summary>...</details>
// 同 name 同时仅 1 个 open，纯 HTML`));
    }
    // ============ Card 3：inert 全局属性 ============
    _toggleInert() {
        const pane = this.$('#mh-inert-pane');
        if (!pane) {
            this._addLog('warn', '未找到 inert 演示面板');
            return;
        }
        if (!this._caps().inert) {
            this._addLog('warn', 'inert 属性不支持，仅说明：标记后元素及后代不可聚焦/编辑/点击，被 AT 跳过');
            return;
        }
        try {
            pane.inert = !pane.inert;
            this._addLog('info', `inert 已 ${pane.inert ? '开启（区块禁用）' : '关闭（恢复交互）'}`);
            this.setState({ inertState: `inert = ${pane.inert}（${pane.inert ? '区块禁用：不可聚焦/点击/编辑' : '正常交互'}）` });
        }
        catch (err) {
            this._addLog('warn', '操作失败：' + (err && err.message));
        }
    }
    _renderCard3() {
        const s = this.state;
        return h(Card, {
            title: 'Card 3 · inert 全局属性',
            extra: h(Tag, { color: this._caps().inert ? 'success' : 'error' }, this._caps().inert ? '已支持' : '未支持'),
        }, h('p', { class: 'fs-sm text-secondary' }, 'inert：一属性完成块级禁用——不可聚焦/编辑/点击、被屏幕阅读器跳过、不参与 Tab 序列。' +
            '模态对话框遮罩、抽屉导航、加载中表单的标准做法。' +
            'vs pointer-events:none + aria-hidden + tabindex=-1 组合。'), h('div', { class: 'mh-inert-stage' }, h('div', { id: 'mh-inert-pane', class: 'mh-inert-pane' }, h('p', { class: 'fs-sm' }, '可被 inert 的面板：'), h('p', {}, h('input', { placeholder: '输入框', class: 'input' })), h('p', {}, h('a', { href: '#', onclick: (e) => e.preventDefault() }, '一个链接')), h('p', {}, this._btn('按钮', { type: 'default', size: 'sm', onClick: () => this._addLog('info', '按钮被点击（若 inert 则无法点击）') })))), h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' }, this._btn('切换 inert', { type: 'primary', size: 'sm', onClick: () => this._toggleInert() })), s.inertState ? h('p', { class: 'fs-sm mt-sm text-secondary' }, s.inertState) : null, h('pre', { class: 'code-block mt-md' }, `<div inert>...整个区块禁用...</div>
// 不可聚焦/编辑/点击 + AT 跳过 + 不进 Tab 序列
// 模态遮罩：<div class="backdrop" inert>背景内容</div> + <dialog>`));
    }
    // ============ Card 4：loading="lazy" + fetchpriority ============
    _toggleLazyLoad() {
        if (!this._caps().loadingLazyImg && !this._caps().loadingLazyIframe) {
            this._addLog('warn', 'loading=lazy 不支持，仅说明：img/iframe 接近视口才加载，省带宽/提升 LCP');
            return;
        }
        this._lazyToggle = !this._lazyToggle;
        const mode = this._lazyToggle ? 'lazy' : 'eager';
        try {
            const imgs = this.$('#mh-lazy-grid img');
            imgs.forEach((img) => img.setAttribute('loading', mode));
            this._addLog('info', `已切换所有演示 img 的 loading → "${mode}"${this._lazyToggle ? '（接近视口才加载）' : '（立即加载）'}，共 ${imgs.length} 个`);
            this.setState({ lazyInfo: `loading="${mode}"（${this._lazyToggle ? '懒加载：接近视口才请求' : '立即加载'}）` });
        }
        catch (err) {
            this._addLog('warn', '操作失败：' + (err && err.message));
        }
    }
    _renderCard4() {
        const s = this.state;
        const caps = this._caps();
        return h(Card, {
            title: 'Card 4 · loading="lazy" + fetchpriority',
            extra: h(Tag, { color: caps.loadingLazyImg ? 'success' : 'error' }, caps.loadingLazyImg ? '已支持' : '未支持'),
        }, h('p', { class: 'fs-sm text-secondary' }, 'loading="lazy"：img/iframe 接近视口才加载（Chrome 121+ iframe 稳定）；' +
            'fetchpriority=high|low|auto 精细控制资源抢占顺序（LCP 图片用 high）。' +
            'vs IntersectionObserver 手写懒加载。'), h('div', { id: 'mh-lazy-grid', class: 'mh-lazy-grid' }, [1, 2, 3, 4].map((i) => h('img', {
            src: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='80'%3E%3Crect width='140' height='80' fill='%23${i % 2 ? '4a90d9' : '8b5cf6'}'/%3E%3Ctext x='70' y='45' text-anchor='middle' fill='%23fff' font-size='14'%3Eimg ${i}%3C/text%3E%3C/svg%3E`,
            loading: 'lazy',
            alt: `演示图 ${i}`,
        }))), h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' }, this._btn('切换 loading 模式', { type: 'primary', size: 'sm', onClick: () => this._toggleLazyLoad() }), h(Tag, { color: caps.fetchpriority ? 'success' : 'error' }, caps.fetchpriority ? 'fetchpriority ✓' : 'fetchpriority ✗')), s.lazyInfo ? h('p', { class: 'fs-sm mt-sm text-secondary' }, s.lazyInfo) : null, h('pre', { class: 'code-block mt-md' }, `<img loading="lazy" src="...">        // 接近视口才加载
<iframe loading="lazy" src="...">     // Chrome 121+
<img fetchpriority="high" src="hero">// LCP 图片高优先级
<img fetchpriority="low" src="...">   // 非关键低优先级`));
    }
    // ============ Card 5：popover="hint" ============
    _toggleHint() {
        if (!this._caps().popover) {
            this._addLog('warn', 'Popover API 不支持，仅说明：popover="hint" 轻量提示，点击外部即关闭，不进顶层栈');
            return;
        }
        const el = this.$('#mh-hint');
        if (!el) {
            this._addLog('warn', '未找到 hint 元素');
            return;
        }
        try {
            if (typeof el.togglePopover === 'function') {
                el.togglePopover();
                let isOpen = false;
                try {
                    isOpen = el.matches(':popover-open');
                }
                catch {
                    isOpen = el.hasAttribute('open');
                }
                this._addLog('info', `togglePopover() → open=${isOpen}`);
                this.setState({ popoverHintState: `popover hint 状态：${isOpen ? '已显示' : '已隐藏'}` });
            }
            else {
                this._addLog('warn', 'togglePopover 不可用');
            }
        }
        catch (err) {
            this._addLog('warn', '操作失败：' + (err && err.message));
        }
    }
    _renderCard5() {
        const s = this.state;
        const caps = this._caps();
        return h(Card, {
            title: 'Card 5 · popover="hint" 轻量提示',
            extra: h(Tag, { color: caps.popoverHint ? 'success' : 'error' }, caps.popoverHint ? '已支持' : '未支持'),
        }, h('p', { class: 'fs-sm text-secondary' }, 'popover="hint"：轻量提示模式，点击外部即关闭，不进顶层栈（vs popover="auto" 进栈且 Esc 关闭，vs "manual" 需手动关闭）。' +
            '适合 tooltip/简短提示。配合 commandfor 声明式触发。'), h('div', { class: 'mh-demo-box' }, h('div', { id: 'mh-hint', popover: 'hint', class: 'mh-hint' }, '这是一个 hint 提示：点击外部任意位置即可关闭。')), h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' }, this._btn('togglePopover()', { type: 'primary', size: 'sm', onClick: () => this._toggleHint() }), h(Tag, { color: 'default' }, 'vs auto/manual')), s.popoverHintState ? h('p', { class: 'fs-sm mt-sm text-secondary' }, s.popoverHintState) : null, h('pre', { class: 'code-block mt-md' }, `<div popover="hint">轻量提示</div>
// vs popover="auto"（进栈+Esc关闭）vs "manual"（手动关）
// :popover-open 伪类判断显示状态
<button commandfor="id" command="toggle-popover">触发</button>`));
    }
    // ============ Card 6：<search> / <dialog> 语义元素 ============
    _showDialog() {
        const dlg = this.$('#mh-dialog');
        if (!dlg) {
            this._addLog('warn', '未找到 dialog 元素');
            return;
        }
        if (!this._caps().showModal) {
            this._addLog('warn', 'showModal 不可用（需真实浏览器），仅说明：dialog.showModal() 原生模态+::backdrop+焦点陷阱');
            return;
        }
        try {
            if (dlg.open) {
                dlg.close('手动关闭');
            }
            else {
                dlg.showModal();
                this._addLog('info', 'dialog.showModal() 已调用（原生模态+::backdrop+焦点陷阱）');
                this.setState({ dialogInfo: 'dialog 已 showModal 打开（模态）' });
            }
        }
        catch (err) {
            this._addLog('warn', '操作失败：' + (err && err.message));
        }
    }
    _renderCard6() {
        const s = this.state;
        const caps = this._caps();
        return h(Card, {
            title: 'Card 6 · <search> / <dialog> 语义元素',
            extra: h(Tag, { color: caps.dialog ? 'success' : 'error' }, caps.dialog ? '已支持' : '未支持'),
        }, h('p', { class: 'fs-sm text-secondary' }, '<search>：搜索区语义元素（Chrome 118+），提升可访问性；' +
            '<dialog>：原生模态框，showModal() 模态+::backdrop+焦点陷阱+Esc 关闭，show() 非模态，' +
            'close(returnValue) + close 事件 + returnValue。'), h('div', { class: 'mh-demo-box' }, h('search', {}, h('p', { class: 'fs-sm' }, '<search> 语义容器：'), h('input', { class: 'input', placeholder: '搜索...', type: 'search' }))), h('dialog', {
            id: 'mh-dialog', class: 'mh-dialog',
            onclose: (e) => {
                this._addLog('info', `dialog close 事件 → returnValue="${e.target.returnValue}"`);
                this.setState({ dialogInfo: `dialog 关闭，returnValue="${e.target.returnValue}"` });
            },
        }, h('p', {}, '原生 dialog 模态框：showModal() 提供 ::backdrop + 焦点陷阱 + Esc 关闭。'), h('p', { class: 'fs-sm text-secondary' }, '点击下方按钮或按 Esc 关闭。'), h('div', { class: 'flex gap-sm mt-md' }, this._btn('关闭(returnValue=ok)', { type: 'primary', size: 'sm', onClick: () => { try {
                this.$('#mh-dialog')?.close('ok');
            }
            catch { /* noop */ } } }))), h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' }, this._btn('showModal() / close()', { type: 'primary', size: 'sm', onClick: () => this._showDialog() }), h(Tag, { color: caps.search ? 'success' : 'error' }, caps.search ? '<search> ✓' : '<search> ✗')), s.dialogInfo ? h('p', { class: 'fs-sm mt-sm text-secondary' }, s.dialogInfo) : null, h('pre', { class: 'code-block mt-md' }, `<search><input type="search"></search>
<dialog>...<form method="dialog"><button>关闭</button></form></dialog>
dlg.showModal();        // 模态 + ::backdrop + 焦点陷阱 + Esc
dlg.show();             // 非模态
dlg.close('returnValue');// returnValue 写回
dlg.addEventListener('close', e => dlg.returnValue);`));
    }
    // ============ 日志面板 ============
    _renderLogPanel() {
        const s = this.state;
        return h(Card, {
            title: '事件日志',
            extra: h('span', { class: 'fs-sm text-tertiary' }, `${s.logs.length} 条`),
        }, h('div', { class: 'log-panel' }, s.logs.length === 0
            ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
            : s.logs.map((log) => h('div', { class: 'log-panel__line' }, h('span', { class: 'log-panel__time' }, log.time), h('span', { class: `log-panel__tag log-panel__tag--${log.type === 'error' ? 'error' : 'info'}` }, log.type), h('span', { class: 'log-panel__content' }, log.content)))));
    }
    renderPage() {
        const s = this.state;
        return [
            h('h2', { class: 'section-title' }, '现代 HTML 全局属性 实验室'),
            h(Alert, {
                type: 'info',
                message: '现代 HTML 全局属性',
                description: '演示 hidden="until-found" + beforematch、<details name> 互斥手风琴、inert 块级禁用、loading="lazy" + fetchpriority、popover="hint"、<search>/<dialog> 语义元素等 2023-2025 现代 HTML 原语。所有特性通过属性检测/能力检测，不支持时记日志不报错。jsdom 中属性可读写但无渲染效果，事件需真实浏览器。',
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
//# sourceMappingURL=ModernHTMLPage.js.map