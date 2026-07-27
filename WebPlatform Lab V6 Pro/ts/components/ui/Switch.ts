// Switch.ts / Checkbox.js / Radio.js —— 开关类组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import type { Props } from '../../core/types.js';

export interface SwitchProps extends Props {
  disabled?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

export class Switch extends Component {
  declare props: SwitchProps;
  declare state: { checked: boolean };

  initialState(): { checked: boolean } { return { checked: !!this.props.checked }; }
  render(): Node | string {
    const { disabled = false } = this.props;
    return h('span', {
      class: `switch ${this.state.checked ? 'is-checked' : ''} ${disabled ? 'is-disabled' : ''}`,
      role: 'switch', 'aria-checked': String(this.state.checked),
      onClick: () => {
        if (disabled) return;
        this.setState({ checked: !this.state.checked });
        this.props.onChange?.(!this.state.checked);
      },
    });
  }
  toggle(): void { this.setState({ checked: !this.state.checked }); }
  getValue(): boolean { return this.state.checked; }
}

export interface CheckboxProps extends Props {
  label?: Node | string;
  disabled?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

export class Checkbox extends Component {
  declare props: CheckboxProps;
  declare state: { checked: boolean };

  initialState(): { checked: boolean } { return { checked: !!this.props.checked }; }
  render(): Node | string {
    const { label, disabled = false } = this.props;
    return h('label', {
      class: `checkbox ${this.state.checked ? 'is-checked' : ''} ${disabled ? 'is-disabled' : ''}`,
      onClick: (e: MouseEvent) => {
        if (disabled) return;
        e.preventDefault();
        this.setState({ checked: !this.state.checked });
        this.props.onChange?.(this.state.checked);
      },
    },
      h('span', { class: 'checkbox__box' }),
      label && h('span', {}, label),
    );
  }
  getValue(): boolean { return this.state.checked; }
}

export interface RadioProps extends Props {
  label?: Node | string;
  disabled?: boolean;
  checked?: boolean;
  value?: any;
  onChange?: (value: any) => void;
}

export class Radio extends Component {
  declare props: RadioProps;
  declare state: { checked: boolean };

  initialState(): { checked: boolean } { return { checked: !!this.props.checked }; }
  render(): Node | string {
    const { label, disabled = false } = this.props;
    return h('label', {
      class: `radio ${this.state.checked ? 'is-checked' : ''} ${disabled ? 'is-disabled' : ''}`,
      onClick: (e: MouseEvent) => {
        if (disabled) return;
        e.preventDefault();
        if (!this.state.checked) {
          this.setState({ checked: true });
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
export interface RadioGroupProps extends Props {
  options?: { label: string; value: any }[];
  value?: any;
  onChange?: (value: any) => void;
}

export class RadioGroup extends Component {
  declare props: RadioGroupProps;
  declare state: { value: any };

  initialState(): { value: any } { return { value: this.props.value ?? null }; }
  render(): Node | string {
    const { options = [] } = this.props;
    return h('div', { class: 'flex gap-md flex-wrap' },
      ...options.map((opt) => {
        const radio = new Radio({
          label: opt.label, value: opt.value,
          checked: this.state.value === opt.value,
          onChange: (v: any) => {
            this.setState({ value: v });
            this.props.onChange?.(v);
            this._rerender();
          },
        });
        this.registerChild(radio);
        return radio.render();
      }),
    );
  }
  getValue(): any { return this.state.value; }
}
