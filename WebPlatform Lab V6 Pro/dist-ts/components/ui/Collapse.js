// Collapse.ts —— 折叠面板组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
export class Collapse extends Component {
    initialState() {
        const initial = this.props.activeKey || this.props.defaultActiveKey || [];
        return { activeKeys: new Set(initial) };
    }
    /** 切换某个面板的展开状态 */
    toggle(key) {
        const { accordion = false, onChange } = this.props;
        const next = new Set(this.state.activeKeys);
        if (next.has(key)) {
            next.delete(key);
        }
        else {
            // 手风琴模式：仅允许一个展开，先清空其余
            if (accordion)
                next.clear();
            next.add(key);
        }
        this.setState({ activeKeys: next });
        onChange?.(Array.from(next));
    }
    render() {
        const { items = [] } = this.props;
        return h('div', { class: 'collapse' }, ...items.map((item) => {
            const open = this.state.activeKeys.has(item.key);
            return h('div', {
                class: ['collapse__item', open && 'collapse__item--active'],
            }, h('div', {
                class: 'collapse__header',
                onClick: () => {
                    if (item.disabled)
                        return;
                    this.toggle(item.key);
                },
            }, h('span', { class: ['collapse__arrow', open && 'collapse__arrow--open'] }, '▶'), h('span', { class: 'collapse__label' }, item.label)), open && h('div', { class: 'collapse__content' }, item.children));
        }));
    }
}
//# sourceMappingURL=Collapse.js.map