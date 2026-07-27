// Button.ts —— 按钮组件，演示多态（type/size 变体）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
export class Button extends Component {
    initialState() {
        return { loading: this.props.loading ?? false };
    }
    render() {
        const { type = 'default', size = 'middle', disabled = false, block = false, icon = null, danger = false, } = this.props;
        const classes = [
            'btn',
            type !== 'default' && `btn--${type}`,
            size !== 'middle' && `btn--${size}`,
            block && 'btn--block',
            icon && !this.props.children && 'btn--icon',
            this.state.loading && 'btn--loading',
            (disabled || this.state.loading) && 'is-disabled',
            danger && 'btn--danger',
        ].filter(Boolean);
        const children = [];
        if (this.state.loading) {
            children.push(h('span', { class: 'btn__spinner' }));
        }
        else if (icon) {
            children.push(icon);
        }
        if (this.props.children)
            children.push(this.props.children);
        return h('button', {
            class: classes.join(' '),
            type: 'button',
            disabled: disabled || this.state.loading,
            onClick: (e) => {
                if (disabled || this.state.loading)
                    return;
                this.props.onClick?.(e);
            },
        }, ...children);
    }
    setLoading(v) { this.setState({ loading: v }); }
}
//# sourceMappingURL=Button.js.map