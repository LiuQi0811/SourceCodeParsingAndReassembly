// Timeline.ts —— 垂直时间线组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
export class Timeline extends Component {
    render() {
        const { items = [], mode = 'left' } = this.props;
        return h('div', { class: `timeline timeline--${mode}` }, ...items.map((item) => this._renderItem(item)));
    }
    /** 渲染单个时间线节点 */
    _renderItem(item) {
        const { color = 'blue', dot = null, label = null, children = null, timestamp = null, } = item || {};
        const headClasses = [
            'timeline__item-head',
            `timeline__item-head--${color}`,
        ].join(' ');
        return h('div', { class: 'timeline__item' }, 
        // 竖向连接线
        h('div', { class: 'timeline__item-tail' }), 
        // 节点圆点（可传入自定义内容）
        h('div', { class: headClasses }, dot), 
        // 内容区：标签 + 主体 + 时间戳
        h('div', { class: 'timeline__item-content' }, label != null && h('div', { class: 'timeline__item-label' }, label), children != null && h('div', { class: 'timeline__item-body' }, children), timestamp != null && h('div', { class: 'timeline__item-time' }, timestamp)));
    }
}
//# sourceMappingURL=Timeline.js.map