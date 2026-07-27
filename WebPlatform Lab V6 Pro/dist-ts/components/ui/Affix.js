// Affix.ts —— 固钉组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
export class Affix extends Component {
    _scrollTarget = window;
    _onScroll = null;
    _origin = null;
    initialState() { return { fixed: false }; }
    componentDidMount() {
        const { target } = this.props;
        this._scrollTarget = target ? target() : window;
        this._onScroll = () => this._handleScroll();
        // 同时监听 window 与 target 的滚动，兼容两者
        this.on(this._scrollTarget, 'scroll', this._onScroll);
        this.on(window, 'scroll', this._onScroll, true);
        this.on(window, 'resize', this._onScroll);
        // 等布局稳定后首次检测
        requestAnimationFrame(() => this._handleScroll());
    }
    /** 读取内层内容元素 */
    _getInner() {
        return this.el?.querySelector('.affix__inner') || null;
    }
    /** 记录内层元素在未固定时的原始位置（固定后外层占位，避免页面跳动） */
    _captureOrigin(inner) {
        // 仅在非固定状态下采集，保证取到的是自然流中的位置
        if (this.state.fixed)
            return;
        const rect = inner.getBoundingClientRect();
        this._origin = {
            top: rect.top + window.scrollY,
            width: rect.width,
            height: rect.height,
        };
    }
    _handleScroll() {
        const { offsetTop, offsetBottom, onChange } = this.props;
        const inner = this._getInner();
        if (!inner)
            return;
        this._captureOrigin(inner);
        if (!this._origin)
            return;
        const scrollTop = window.scrollY || 0;
        let shouldFix = false;
        if (offsetTop != null) {
            // 滚动到原始位置低于视口 offsetTop 时固定
            shouldFix = this._origin.top - scrollTop <= offsetTop;
        }
        else if (offsetBottom != null) {
            // 视口底部与原始底部的距离小于 offsetBottom 时固定
            shouldFix = window.innerHeight + scrollTop - this._origin.top - this._origin.height <= offsetBottom;
        }
        if (shouldFix === this.state.fixed)
            return;
        this.state.fixed = shouldFix;
        if (shouldFix) {
            // 外层保留高度作为占位
            this.el.style.height = `${this._origin.height}px`;
            inner.classList.add('affix__inner--fixed');
            inner.style.position = 'fixed';
            inner.style.width = `${this._origin.width}px`;
            if (offsetTop != null)
                inner.style.top = `${offsetTop}px`;
            if (offsetBottom != null)
                inner.style.bottom = `${offsetBottom}px`;
        }
        else {
            this.el.style.height = '';
            inner.classList.remove('affix__inner--fixed');
            inner.style.position = '';
            inner.style.width = '';
            inner.style.top = '';
            inner.style.bottom = '';
        }
        onChange?.(shouldFix);
    }
    render() {
        return h('div', { class: 'affix' }, h('div', { class: 'affix__inner' }, this.props.children));
    }
}
//# sourceMappingURL=Affix.js.map