// Switch.ts / Checkbox.js / Radio.js —— 开关类组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
export class Switch extends Component {
    initialState() { return { checked: !!this.props.checked }; }
    render() {
        const { disabled = false } = this.props;
        return h('span', {
            class: `switch ${this.state.checked ? 'is-checked' : ''} ${disabled ? 'is-disabled' : ''}`,
            role: 'switch', 'aria-checked': String(this.state.checked),
            onClick: () => {
                if (disabled)
                    return;
                this.setState({ checked: !this.state.checked });
                this.props.onChange?.(!this.state.checked);
            },
        });
    }
    toggle() { this.setState({ checked: !this.state.checked }); }
    getValue() { return this.state.checked; }
}
export class Checkbox extends Component {
    initialState() { return { checked: !!this.props.checked }; }
    render() {
        const { label, disabled = false } = this.props;
        return h('label', {
            class: `checkbox ${this.state.checked ? 'is-checked' : ''} ${disabled ? 'is-disabled' : ''}`,
            onClick: (e) => {
                if (disabled)
                    return;
                e.preventDefault();
                this.setState({ checked: !this.state.checked });
                this.props.onChange?.(this.state.checked);
            },
        }, h('span', { class: 'checkbox__box' }), label && h('span', {}, label));
    }
    getValue() { return this.state.checked; }
}
export class Radio extends Component {
    initialState() { return { checked: !!this.props.checked }; }
    render() {
        const { label, disabled = false } = this.props;
        return h('label', {
            class: `radio ${this.state.checked ? 'is-checked' : ''} ${disabled ? 'is-disabled' : ''}`,
            onClick: (e) => {
                if (disabled)
                    return;
                e.preventDefault();
                if (!this.state.checked) {
                    this.setState({ checked: true });
                    this.props.onChange?.(this.props.value);
                }
            },
        }, h('span', { class: 'radio__circle' }), label && h('span', {}, label));
    }
}
export class RadioGroup extends Component {
    initialState() { return { value: this.props.value ?? null }; }
    render() {
        const { options = [] } = this.props;
        return h('div', { class: 'flex gap-md flex-wrap' }, ...options.map((opt) => {
            const radio = new Radio({
                label: opt.label, value: opt.value,
                checked: this.state.value === opt.value,
                onChange: (v) => {
                    this.setState({ value: v });
                    this.props.onChange?.(v);
                    this._rerender();
                },
            });
            this.registerChild(radio);
            return radio.render();
        }));
    }
    getValue() { return this.state.value; }
}
//# sourceMappingURL=Switch.js.map