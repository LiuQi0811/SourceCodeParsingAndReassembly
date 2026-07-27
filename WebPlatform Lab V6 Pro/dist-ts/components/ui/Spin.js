// Spin.ts —— 加载中旋转器
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
export class Spin extends Component {
    render() {
        const { size = 'middle', tip, spinning = true, children } = this.props;
        // 非加载状态：仅渲染子内容容器
        if (!spinning) {
            return h('div', { class: 'spin-wrapper' }, ...(Array.isArray(children) ? children : [children]));
        }
        // 加载中：渲染旋转点 + 可选提示文字
        return h('div', { class: `spin spin--${size}`, role: 'status', 'aria-live': 'polite' }, h('span', { class: 'spin__dot' }), tip && h('span', { class: 'spin__tip' }, tip));
    }
}
//# sourceMappingURL=Spin.js.map