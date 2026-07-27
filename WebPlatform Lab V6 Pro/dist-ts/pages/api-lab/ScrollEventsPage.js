// =====================================================================
// ScrollEventsPage.js —— 滚动事件与滚动条 实验室
// 演示 MDN 2023-2025 滚动相关 API 与滚动条新特性：
//   1. scrollend 事件 —— Element.scrollend / Document.scrollend 事件，
//      仅在滚动完全停止（惯性/动画结束）触发一次，解决 scroll 事件抖动和高频回调问题；
//      vs scroll 事件（滚动过程持续触发）
//   2. scroll 事件 vs scrollend 对比 —— scroll 高频（每帧多次）需节流/rAF，
//      scrollend 低频（滚动结束一次），展示防抖/throttle/rAF 方案
//   3. scrollbar-gutter —— auto | stable | both-edges；强制保留滚动条槽位，
//      消除内容宽度跳变与布局抖动（CLF 问题）；stable 始终预留空间，both-edges 两侧对称
//   4. 滚动相关事件全家桶 —— scroll / scrollend / wheel / gesture*（已废弃）
//      / pointermove 滚动；passive: true 提升滚动性能
//   5. 滚动编程式控制回顾 —— scrollTo/scrollBy/scrollIntoView options({behavior,
//      block, inline})；scrollIntoViewIfNeeded；overscroll-behavior: contain
// 说明：所有特性调用前做 typeof/in/属性检测，不可用时仅记日志，绝不抛异常。
//       jsdom 无真实滚动，onscrollend 属性检测可用但事件需真实浏览器，
//       用 dispatchEvent(new Event('scrollend')) 模拟派发以演示回调。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class ScrollEventsPage extends Page {
    _inited = false;
    _injectedStyles;
    _scrollCount;
    _scrollendCount;
    _compareScrollCount;
    _compareScrollendCount;
    _gutterValue;
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            scrollendInfo: '',
            compareInfo: '',
            gutterInfo: '',
            matrixInfo: '',
            programInfo: '',
        };
    }
    componentDidMount() {
        if (this._inited)
            return;
        this._inited = true;
        this._injectedStyles = [];
        // 计数器放在实例上，避免 rerender 重置（rerender 会重建 DOM 元素重置 textContent，
        // 但实例字段保留）；显示时手动写回 DOM
        this._scrollCount = 0;
        this._scrollendCount = 0;
        this._compareScrollCount = 0;
        this._compareScrollendCount = 0;
        this._gutterValue = 'auto';
        const caps = this._caps();
        const c = (ok) => ok ? '✓' : '✗';
        const parts = [
            `scrollend ${c(caps.scrollend)}`,
            `scroll ${c(caps.scroll)}`,
            `wheel ${c(caps.wheel)}`,
            `scrollbar-gutter ${c(caps.scrollbarGutter)}`,
            `smooth-scroll ${c(caps.smoothScroll)}`,
            `passive(option) ${c(caps.passive)}`,
        ];
        const summary = '滚动事件与滚动条能力检测：' + parts.join(' · ')
            + '。jsdom 无真实滚动，onscrollend 属性检测可用但事件需真实浏览器；'
            + '可点击"模拟派发 scrollend"按钮 dispatchEvent 演示回调。';
        this.setState({
            capsSummary: summary,
            logs: [...this.state.logs, { type: 'info', content: `能力检测：${parts.join('，')}`, time: formatTime() }].slice(-40),
        });
        if (!caps.scrollend)
            this._addLog('warn', 'scrollend 事件不支持（Chrome 114+，需真实浏览器），可用模拟派发演示回调');
        if (!caps.scrollbarGutter)
            this._addLog('warn', 'scrollbar-gutter: stable 不支持（Chrome 94+），仅说明用法');
        if (!caps.smoothScroll)
            this._addLog('warn', 'scrollTo/scrollIntoView smooth 不支持，仅说明用法');
        if (caps.passive)
            this._addLog('info', 'addEventListener 第三参 passive:true 是选项（非特性），可手动指定提升滚动性能');
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
        let scrollend = false;
        try {
            scrollend = typeof window !== 'undefined'
                && ('onscrollend' in window
                    || (typeof Element !== 'undefined' && 'onscrollend' in Element.prototype));
        }
        catch {
            scrollend = false;
        }
        let scroll = false;
        try {
            scroll = typeof window !== 'undefined' && 'onscroll' in window;
        }
        catch {
            scroll = false;
        }
        let wheel = false;
        try {
            wheel = typeof window !== 'undefined' && 'onwheel' in window;
        }
        catch {
            wheel = false;
        }
        let scrollbarGutter = false;
        try {
            scrollbarGutter = typeof CSS !== 'undefined'
                && typeof CSS.supports === 'function'
                && CSS.supports('scrollbar-gutter', 'stable');
        }
        catch {
            scrollbarGutter = false;
        }
        let smoothScroll = false;
        try {
            smoothScroll = typeof Element !== 'undefined'
                && typeof Element.prototype.scrollIntoView === 'function'
                && typeof Element.prototype.scrollTo === 'function';
        }
        catch {
            smoothScroll = false;
        }
        let passive = false;
        try {
            passive = typeof window !== 'undefined' && typeof window.addEventListener === 'function';
        }
        catch {
            passive = false;
        }
        return { scrollend, scroll, wheel, scrollbarGutter, smoothScroll, passive };
    }
    _injectDemoStyles() {
        this._injectStyle('scroll-events-demo', `
      .se-scroll-box { height: 200px; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; background: #fff; }
      .se-scroll-box p { margin: 0 0 12px 0; line-height: 1.6; font-size: 13px; color: #475569; }
      .se-counter { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 8px; }
      .se-counter-item { padding: 6px 12px; border-radius: 6px; background: #f1f5f9; font-size: 13px; }
      .se-counter-item b { color: #1e40af; }
      .se-counter-item--end b { color: #0f766e; }
      .se-gutter-compare { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
      .se-gutter-compare > div { flex: 1; min-width: 220px; }
      .se-gutter-pane { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; background: #fff; }
      .se-gutter-pane h4 { margin: 0 0 6px 0; font-size: 13px; color: #1e293b; }
      .se-gutter-pane .se-scroll-box { height: 140px; }
      .se-gutter-stable { scrollbar-gutter: stable; }
      .se-gutter-both-edges { scrollbar-gutter: both-edges; }
      .se-matrix { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
      .se-matrix th, .se-matrix td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
      .se-matrix th { background: #f8fafc; color: #1e293b; }
      .se-matrix td:first-child { color: #1e40af; font-weight: 600; white-space: nowrap; }
      .se-demo-box { border: 1px dashed #cbd5e1; border-radius: 6px; padding: 12px; margin-top: 8px; background: #fff; }
    `);
    }
    // ============ Card 1：scrollend 事件 ============
    _dispatchScrollend() {
        const box = this.$('#se-scrollend-box');
        if (!box) {
            this._addLog('warn', '未找到滚动容器');
            return;
        }
        try {
            const ev = new Event('scrollend', { bubbles: true });
            box.dispatchEvent(ev);
            this._addLog('info', '已通过 dispatchEvent(new Event("scrollend")) 模拟派发 scrollend 事件');
        }
        catch (err) {
            this._addLog('warn', '派发 scrollend 失败：' + (err && err.message));
        }
    }
    _renderCard1() {
        const s = this.state;
        const caps = this._caps();
        // 计数器写入实例字段后同步到 DOM（避免 rerender 重置）
        const onScroll = () => {
            this._scrollCount++;
            const el = this.$('#se-scroll-count');
            if (el)
                el.textContent = String(this._scrollCount);
        };
        const onScrollend = () => {
            this._scrollendCount++;
            const el = this.$('#se-scrollend-count');
            if (el)
                el.textContent = String(this._scrollendCount);
            this._addLog('scrollend', `scrollend 触发 #${this._scrollendCount}：滚动已完全停止（惯性/动画结束）`);
            this.setState({ scrollendInfo: `scroll 累计=${this._scrollCount}，scrollend 累计=${this._scrollendCount}（仅在滚动停止后触发）` });
        };
        const paras = Array.from({ length: 20 }, (_, i) => h('p', {}, `段落 ${i + 1}：滚动事件实验室。scrollend 仅在滚动完全停止后触发一次，避免 scroll 高频回调。`));
        return h(Card, {
            title: 'Card 1 · scrollend 事件',
            extra: h(Tag, { color: caps.scrollend ? 'success' : 'error' }, caps.scrollend ? '已支持' : '未支持'),
        }, h('p', { class: 'fs-sm text-secondary' }, 'Element.scrollend / Document.scrollend 事件：仅在滚动完全停止（惯性/动画结束）触发一次，' +
            '解决 scroll 事件抖动与高频回调问题。vs scroll 事件（滚动过程持续触发，每帧多次）。' +
            '能力检测：\'onscrollend\' in window 或 Element.prototype。'), h('div', { class: 'se-demo-box' }, h('div', {
            id: 'se-scrollend-box', class: 'se-scroll-box',
            onscroll: onScroll,
            onscrollend: onScrollend,
        }, paras), h('div', { class: 'se-counter' }, h('div', { class: 'se-counter-item' }, 'scroll 触发次数：', h('b', { id: 'se-scroll-count' }, '0')), h('div', { class: 'se-counter-item se-counter-item--end' }, 'scrollend 触发次数：', h('b', { id: 'se-scrollend-count' }, '0')))), h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' }, this._btn('模拟派发 scrollend', { type: 'primary', size: 'sm', onClick: () => this._dispatchScrollend() }), h(Tag, { color: 'default' }, 'jsdom 需手动 dispatch')), s.scrollendInfo ? h('p', { class: 'fs-sm mt-sm text-secondary' }, s.scrollendInfo) : null, h('pre', { class: 'code-block mt-md' }, `el.addEventListener('scrollend', e => { /* 滚动真正停止 */ });
// vs scroll（滚动过程持续触发，每帧多次）
// onscrollend 属性绑定或 addEventListener 均可
// Chrome 114+ / Edge 114+；Safari/Firefox 部分`));
    }
    // ============ Card 2：scroll 事件 vs scrollend 对比 ============
    _dispatchCompareScrollend() {
        const box = this.$('#se-compare-box');
        if (!box) {
            this._addLog('warn', '未找到对比容器');
            return;
        }
        try {
            box.dispatchEvent(new Event('scrollend', { bubbles: true }));
            this._addLog('info', '已模拟派发 scrollend（对比容器）');
        }
        catch (err) {
            this._addLog('warn', '派发失败：' + (err && err.message));
        }
    }
    _simulateCompareScroll() {
        const box = this.$('#se-compare-box');
        if (!box) {
            this._addLog('warn', '未找到对比容器');
            return;
        }
        try {
            // jsdom 无真实滚动，模拟连续触发 scroll 事件以演示高频
            let n = 0;
            const tick = () => {
                n++;
                this._compareScrollCount++;
                const el = this.$('#se-compare-scroll-count');
                if (el)
                    el.textContent = String(this._compareScrollCount);
                if (n < 5) {
                    setTimeout(tick, 30);
                }
                else {
                    this._addLog('info', `模拟连续 5 次 scroll 触发（高频演示），累计=${this._compareScrollCount}`);
                    this.setState({ compareInfo: `scroll 高频累计=${this._compareScrollCount}（每帧多次），scrollend 累计=${this._compareScrollendCount}（滚动结束一次）` });
                }
            };
            tick();
        }
        catch (err) {
            this._addLog('warn', '模拟失败：' + (err && err.message));
        }
    }
    _renderCard2() {
        const s = this.state;
        const onScroll = () => {
            this._compareScrollCount++;
            const el = this.$('#se-compare-scroll-count');
            if (el)
                el.textContent = String(this._compareScrollCount);
        };
        const onScrollend = () => {
            this._compareScrollendCount++;
            const el = this.$('#se-compare-scrollend-count');
            if (el)
                el.textContent = String(this._compareScrollendCount);
            this.setState({ compareInfo: `scroll 高频累计=${this._compareScrollCount}，scrollend 累计=${this._compareScrollendCount}（一次滚动周期仅触发 1 次）` });
        };
        const paras = Array.from({ length: 20 }, (_, i) => h('p', {}, `对比段 ${i + 1}：scroll 在滚动过程持续触发，scrollend 在滚动停止后触发一次。`));
        return h(Card, {
            title: 'Card 2 · scroll 事件 vs scrollend 对比',
            extra: h(Tag, { color: this._caps().scroll ? 'success' : 'error' }, this._caps().scroll ? '已支持' : '未支持'),
        }, h('p', { class: 'fs-sm text-secondary' }, 'scroll 事件在滚动过程持续触发（每帧多次），需节流/rAF/防抖避免卡顿；' +
            'scrollend 仅在滚动结束触发一次，天然低频。对比同一容器的两个事件触发次数。'), h('div', { class: 'se-demo-box' }, h('div', {
            id: 'se-compare-box', class: 'se-scroll-box',
            onscroll: onScroll,
            onscrollend: onScrollend,
        }, paras), h('div', { class: 'se-counter' }, h('div', { class: 'se-counter-item' }, 'scroll 触发：', h('b', { id: 'se-compare-scroll-count' }, '0')), h('div', { class: 'se-counter-item se-counter-item--end' }, 'scrollend 触发：', h('b', { id: 'se-compare-scrollend-count' }, '0')))), h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' }, this._btn('模拟连续 scroll', { type: 'default', size: 'sm', onClick: () => this._simulateCompareScroll() }), this._btn('模拟派发 scrollend', { type: 'primary', size: 'sm', onClick: () => this._dispatchCompareScrollend() })), s.compareInfo ? h('p', { class: 'fs-sm mt-sm text-secondary' }, s.compareInfo) : null, h('pre', { class: 'code-block mt-md' }, `// 方案一：rAF 节流
let ticking = false;
el.addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { handle(); ticking = false; });
});
// 方案二：throttle（固定间隔）
function throttle(fn, ms) {
  let last = 0;
  return (...a) => {
    const now = Date.now();
    if (now - last >= ms) { last = now; fn(...a); }
  };
}
// 方案三：scrollend（无需节流，滚动结束触发一次）
el.addEventListener('scrollend', handle);`));
    }
    // ============ Card 3：scrollbar-gutter ============
    _toggleGutter() {
        const order = ['auto', 'stable', 'both-edges'];
        const cur = this._gutterValue;
        const next = order[(order.indexOf(cur) + 1) % order.length];
        this._gutterValue = next;
        if (!this._caps().scrollbarGutter) {
            this._addLog('warn', `scrollbar-gutter: ${next} 不支持（CSS.supports 检测未通过），仅切换值说明用法`);
            this.setState({ gutterInfo: `当前值：scrollbar-gutter: ${next}（不支持，仅说明）` });
            return;
        }
        const panes = [this.$('#se-gutter-a'), this.$('#se-gutter-b')];
        panes.forEach((p) => {
            if (!p)
                return;
            try {
                p.style.scrollbarGutter = next;
            }
            catch { /* noop */ }
        });
        this._addLog('info', `scrollbar-gutter 已切换 → ${next}（${next === 'auto' ? '默认按需显示' : next === 'stable' ? '始终预留滚动条空间' : '两侧对称预留'}）`);
        this.setState({ gutterInfo: `当前值：scrollbar-gutter: ${next}（${next === 'auto' ? '按需显示，内容宽度会跳变' : next === 'stable' ? '始终预留空间，消除布局抖动' : '两侧对称预留'}）` });
    }
    _renderCard3() {
        const s = this.state;
        const caps = this._caps();
        const mkParas = (label) => Array.from({ length: 12 }, (_, i) => h('p', {}, `${label} 段 ${i + 1}：内容溢出产生滚动条。`));
        return h(Card, {
            title: 'Card 3 · scrollbar-gutter',
            extra: h(Tag, { color: caps.scrollbarGutter ? 'success' : 'error' }, caps.scrollbarGutter ? '已支持' : '未支持'),
        }, h('p', { class: 'fs-sm text-secondary' }, 'scrollbar-gutter: auto | stable | both-edges；强制保留滚动条槽位，消除内容宽度跳变与布局抖动（CLF 问题）。' +
            'stable 始终预留空间，both-edges 两侧对称。能力检测：CSS.supports(\'scrollbar-gutter\', \'stable\')。'), h('div', { class: 'se-gutter-compare' }, h('div', { class: 'se-gutter-pane' }, h('h4', {}, 'gutter: auto（按需）'), h('div', { id: 'se-gutter-a', class: 'se-scroll-box' }, mkParas('A'))), h('div', { class: 'se-gutter-pane' }, h('h4', {}, 'gutter: stable（预留）'), h('div', { id: 'se-gutter-b', class: 'se-scroll-box se-gutter-stable' }, mkParas('B')))), h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' }, this._btn('切换 gutter 值', { type: 'primary', size: 'sm', onClick: () => this._toggleGutter() }), h(Tag, { color: 'default' }, 'auto → stable → both-edges')), s.gutterInfo ? h('p', { class: 'fs-sm mt-sm text-secondary' }, s.gutterInfo) : null, h('pre', { class: 'code-block mt-md' }, `.scroll-box { scrollbar-gutter: stable; }
/* auto：按需显示滚动条，内容宽度会跳变（CLF） */
/* stable：始终预留滚动条空间，避免布局抖动 */
/* both-edges：左右两侧对称预留 */
if (CSS.supports('scrollbar-gutter', 'stable')) { /* 安全使用 */ }`));
    }
    // ============ Card 4：滚动相关事件全家桶 ============
    _logMatrixEvent(name) {
        this._addLog('info', `${name} 事件已触发（参见下表对比）`);
        this.setState({ matrixInfo: `最近事件：${name}` });
    }
    _renderCard4() {
        const s = this.state;
        const caps = this._caps();
        const rows = [
            ['scroll', '元素布局滚动', '布局滚动（任何原因引起）', '高频，需 rAF/throttle 节流', caps.scroll ? '✓' : '✗'],
            ['scrollend', '元素/文档滚动结束', '惯性/动画结束后一次', '低频，无需节流', caps.scrollend ? '✓' : '✗'],
            ['wheel', '滚轮/触控板输入', '输入设备事件', '可 passive:true 提升性能', caps.wheel ? '✓' : '✗'],
            ['gesture*', '手势事件（已废弃）', '已弃用，仅 Safari 私有', '不要使用', '废弃'],
            ['pointermove', '指针移动', '触摸/鼠标/笔统一', '触摸滚动时被动触发', caps.wheel ? '✓' : '✗'],
        ];
        const mkWheel = () => {
            if (!caps.wheel) {
                this._addLog('warn', 'wheel 事件不支持，仅说明用法');
                return;
            }
            this._logMatrixEvent('wheel');
        };
        return h(Card, {
            title: 'Card 4 · 滚动相关事件全家桶',
            extra: h(Tag, { color: caps.wheel ? 'success' : 'error' }, caps.wheel ? '已支持' : '未支持'),
        }, h('p', { class: 'fs-sm text-secondary' }, '对比 scroll / scrollend / wheel / gesture*（已废弃）/ pointermove 滚动；' +
            'scroll 是布局滚动，wheel 是输入设备事件；passive: true 提升滚动性能；' +
            'addEventListener(\'scroll\', cb, { passive: true }) vs onscroll 属性。'), h('div', { class: 'se-demo-box' }, h('div', {
            id: 'se-matrix-box', class: 'se-scroll-box',
            onscroll: (_) => this._logMatrixEvent('scroll'),
            onscrollend: (_) => this._logMatrixEvent('scrollend'),
            onwheel: mkWheel,
            onpointermove: (e) => { if (e && e.pointerType === 'touch')
                this._logMatrixEvent('pointermove'); },
        }, Array.from({ length: 12 }, (_, i) => h('p', {}, `事件对比段 ${i + 1}：滚动/滚轮/触摸都会触发对应事件。`)))), h('table', { class: 'se-matrix' }, h('thead', {}, h('tr', {}, h('th', {}, '事件'), h('th', {}, '对象'), h('th', {}, '触发时机'), h('th', {}, '建议'), h('th', {}, '支持'))), h('tbody', {}, rows.map((r) => h('tr', {}, r.map((cell) => h('td', {}, cell)))))), h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' }, this._btn('模拟派发 scroll', { type: 'default', size: 'sm', onClick: () => { try {
                this.$('#se-matrix-box')?.dispatchEvent(new Event('scroll', { bubbles: true }));
            }
            catch { /* noop */ } } }), this._btn('模拟派发 scrollend', { type: 'default', size: 'sm', onClick: () => { try {
                this.$('#se-matrix-box')?.dispatchEvent(new Event('scrollend', { bubbles: true }));
            }
            catch { /* noop */ } } }), h(Tag, { color: caps.passive ? 'success' : 'error' }, caps.passive ? 'passive ✓' : 'passive ✗')), s.matrixInfo ? h('p', { class: 'fs-sm mt-sm text-secondary' }, s.matrixInfo) : null, h('pre', { class: 'code-block mt-md' }, `el.addEventListener('scroll', cb, { passive: true });  // 不阻塞滚动，提升性能
el.addEventListener('wheel', cb, { passive: true });   // 同上
// vs onscroll 属性（无法指定 passive，浏览器按需优化）
// gesturestart/gesturechange/gestureend 已废弃，勿用
// pointermove（pointerType==='touch'）可识别触摸滚动`));
    }
    // ============ Card 5：滚动编程式控制回顾 ============
    _smoothScrollTo(pos) {
        const box = this.$('#se-program-box');
        if (!box) {
            this._addLog('warn', '未找到演示容器');
            return;
        }
        if (!this._caps().smoothScroll) {
            this._addLog('warn', 'scrollTo/scrollIntoView 不支持，仅说明用法：behavior:"smooth" 平滑滚动');
            return;
        }
        try {
            const target = pos === 'top' ? 0 : (box.scrollHeight - box.clientHeight);
            box.scrollTo({ top: target, behavior: 'smooth' });
            this._addLog('info', `scrollTo({ top: ${target}, behavior: "smooth" }) 已调用`);
            this.setState({ programInfo: `平滑滚动到${pos === 'top' ? '顶部' : '底部'}（scrollHeight=${box.scrollHeight}, clientHeight=${box.clientHeight}）` });
        }
        catch (err) {
            this._addLog('warn', '滚动失败：' + (err && err.message));
        }
    }
    _scrollByStep() {
        const box = this.$('#se-program-box');
        if (!box) {
            this._addLog('warn', '未找到演示容器');
            return;
        }
        if (!this._caps().smoothScroll) {
            this._addLog('warn', 'scrollBy 不支持，仅说明用法：scrollBy 相对滚动');
            return;
        }
        try {
            box.scrollBy({ top: 80, behavior: 'smooth' });
            this._addLog('info', 'scrollBy({ top: 80, behavior: "smooth" }) 已调用');
            this.setState({ programInfo: `相对滚动 80px（scrollTop=${box.scrollTop}, scrollHeight=${box.scrollHeight}）` });
        }
        catch (err) {
            this._addLog('warn', '滚动失败：' + (err && err.message));
        }
    }
    _scrollIntoViewDemo() {
        const target = this.$('#se-program-target');
        if (!target) {
            this._addLog('warn', '未找到目标元素');
            return;
        }
        if (!this._caps().smoothScroll) {
            this._addLog('warn', 'scrollIntoView 不支持，仅说明用法：{ behavior, block, inline }');
            return;
        }
        try {
            target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            this._addLog('info', 'scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" }) 已调用');
            this.setState({ programInfo: 'scrollIntoView 平滑滚动到目标元素中心' });
        }
        catch (err) {
            this._addLog('warn', '滚动失败：' + (err && err.message));
        }
    }
    _renderCard5() {
        const s = this.state;
        const caps = this._caps();
        const paras = Array.from({ length: 18 }, (_, i) => h('p', {}, `编程式段 ${i + 1}：scrollTo/scrollBy/scrollIntoView 配合 behavior:"smooth" 平滑滚动。`));
        paras.splice(9, 0, h('p', { id: 'se-program-target', style: 'color:#0f766e;font-weight:600;' }, '★ 目标元素：scrollIntoView 将滚动到这里。'));
        return h(Card, {
            title: 'Card 5 · 滚动编程式控制回顾',
            extra: h(Tag, { color: caps.smoothScroll ? 'success' : 'error' }, caps.smoothScroll ? '已支持' : '未支持'),
        }, h('p', { class: 'fs-sm text-secondary' }, 'scrollTo/scrollBy/scrollIntoView options({ behavior: "smooth"|"instant", block, inline })；' +
            'scrollIntoViewIfNeeded；overscroll-behavior: contain 阻止滚动链；' +
            'element.scrollTop/scrollLeft/scrollHeight/scrollWidth。'), h('div', { class: 'se-demo-box' }, h('div', { id: 'se-program-box', class: 'se-scroll-box', style: 'scrollbar-gutter: stable;' }, paras)), h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' }, this._btn('平滑到顶部', { type: 'default', size: 'sm', onClick: () => this._smoothScrollTo('top') }), this._btn('平滑到底部', { type: 'default', size: 'sm', onClick: () => this._smoothScrollTo('bottom') }), this._btn('scrollBy 80px', { type: 'default', size: 'sm', onClick: () => this._scrollByStep() }), this._btn('scrollIntoView 目标', { type: 'primary', size: 'sm', onClick: () => this._scrollIntoViewDemo() })), s.programInfo ? h('p', { class: 'fs-sm mt-sm text-secondary' }, s.programInfo) : null, h('pre', { class: 'code-block mt-md' }, `el.scrollTo({ top: 0, behavior: 'smooth' });          // 绝对位置
el.scrollBy({ top: 80, behavior: 'smooth' });         // 相对滚动
el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
el.scrollIntoViewIfNeeded(true);                       // 仅 Safari/Chromium
.scrollbar { overscroll-behavior: contain; }          // 阻止滚动链传播
el.scrollTop / scrollLeft / scrollHeight / scrollWidth`));
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
            h('h2', { class: 'section-title' }, '滚动事件与滚动条 实验室'),
            h(Alert, {
                type: 'info',
                message: '滚动事件与滚动条',
                description: '演示 scrollend 事件、scroll vs scrollend 对比、scrollbar-gutter、滚动事件全家桶、滚动编程式控制等 2023-2025 滚动相关特性。所有特性通过属性/CSS.supports 能力检测，不支持时记日志不报错。jsdom 无真实滚动，事件可用 dispatchEvent 模拟派发演示回调。',
            }),
            s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
            this._renderCard1(),
            this._renderCard2(),
            this._renderCard3(),
            this._renderCard4(),
            this._renderCard5(),
            this._renderLogPanel(),
        ];
    }
}
//# sourceMappingURL=ScrollEventsPage.js.map