// Switch.js / Checkbox.js / Radio.js —— 开关类组件
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
        if (disabled) return;
        this.state.checked = !this.state.checked;
        this.el.className = `switch ${this.state.checked ? 'is-checked' : ''} ${disabled ? 'is-disabled' : ''}`;
        this.el.setAttribute('aria-checked', String(this.state.checked));
        this.props.onChange?.(this.state.checked);
      },
    });
  }
  toggle() {
    this.state.checked = !this.state.checked;
    if (this.el) {
      this.el.className = `switch ${this.state.checked ? 'is-checked' : ''}`;
      this.el.setAttribute('aria-checked', String(this.state.checked));
    }
  }
  getValue() { return this.state.checked; }
}

export class Checkbox extends Component {
  initialState() { return { checked: !!this.props.checked }; }
  render() {
    const { label, disabled = false } = this.props;
    return h('label', {
      class: `checkbox ${this.state.checked ? 'is-checked' : ''} ${disabled ? 'is-disabled' : ''}`,
      onClick: (e) => {
        if (disabled) return;
        e.preventDefault();
        this.state.checked = !this.state.checked;
        this.el.className = `checkbox ${this.state.checked ? 'is-checked' : ''} ${disabled ? 'is-disabled' : ''}`;
        this.props.onChange?.(this.state.checked);
      },
    },
      h('span', { class: 'checkbox__box' }),
      label && h('span', {}, label),
    );
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
        if (disabled) return;
        e.preventDefault();
        if (!this.state.checked) {
          this.state.checked = true;
          this.el.className = `radio is-checked ${disabled ? 'is-disabled' : ''}`;
          this.props.onChange?.(this.props.value);
        }
      },
    },
      h('span', { class: 'radio__circle' }),
      label && h('span', {}, label),
    );
  }
}

/** Radio.Group：管理单选互斥 */
export class RadioGroup extends Component {
  initialState() { return { value: this.props.value ?? null }; }
  /** 直接操作 DOM 切换选中项，不触发 setState/rerender */
  _syncDom(newValue) {
    if (!this.el) return;
    const { options = [] } = this.props;
    const labels = this.el.querySelectorAll('.radio');
    labels.forEach((labelEl, i) => {
      const opt = options[i];
      if (!opt) return;
      const selected = opt.value === newValue;
      labelEl.classList.toggle('is-checked', selected);
    });
  }
  render() {
    const { options = [] } = this.props;
    return h('div', { class: 'flex gap-md flex-wrap' },
      ...options.map((opt) => {
        const radio = new Radio({
          label: opt.label, value: opt.value,
          checked: this.state.value === opt.value,
          onChange: (v) => {
            this.state.value = v;
            this._syncDom(v);
            this.props.onChange?.(v);
          },
        });
        this.registerChild(radio);
        return radio.render();
      }),
    );
  }
  getValue() { return this.state.value; }
}
