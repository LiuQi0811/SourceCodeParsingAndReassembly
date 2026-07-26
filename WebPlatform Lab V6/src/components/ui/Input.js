// Input.js —— 输入框组件（支持 textarea / 受控）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

export class Input extends Component {
  initialState() {
    return { value: this.props.value ?? '', focused: false };
  }

  render() {
    const {
      placeholder = '', disabled = false, size = 'middle',
      type = 'text', error = false, multiline = false,
      addonBefore = null, addonAfter = null,
    } = this.props;

    const classes = [
      'input',
      size !== 'middle' && `input--${size}`,
      disabled && 'is-disabled',
      error && 'is-error',
    ].filter(Boolean).join(' ');

    const inputEl = multiline
      ? h('textarea', {
          class: classes, placeholder, disabled,
          rows: this.props.rows || 3,
        }, this.state.value)
      : h('input', {
          class: classes, type, placeholder, disabled,
          value: this.state.value,
        });

    this._inputEl = inputEl;

    if (addonBefore || addonAfter) {
      return h('div', { class: 'input-group' },
        addonBefore && h('span', { class: 'input-group__addon' }, addonBefore),
        inputEl,
        addonAfter && h('span', { class: 'input-group__addon' }, addonAfter),
      );
    }
    return inputEl;
  }

  componentDidMount() {
    if (!this._inputEl) return;
    this.on(this._inputEl, 'input', (e) => {
      this.state.value = e.target.value;
      this.props.onChange?.(e.target.value, e);
    });
    this.on(this._inputEl, 'focus', (e) => {
      this.setState({ focused: true });
      this.props.onFocus?.(e);
    });
    this.on(this._inputEl, 'blur', (e) => {
      this.setState({ focused: false });
      this.props.onBlur?.(e);
    });
    this.on(this._inputEl, 'keydown', (e) => {
      if (e.key === 'Enter') this.props.onPressEnter?.(e);
    });
  }

  getValue() { return this.state.value; }
  setValue(v) {
    this.setState({ value: v });
    if (this._inputEl) this._inputEl.value = v;
  }
}
