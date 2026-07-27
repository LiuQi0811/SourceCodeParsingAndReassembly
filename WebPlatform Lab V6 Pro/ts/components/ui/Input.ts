// Input.ts —— 输入框组件（支持 textarea / 受控）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import type { Props, State } from '../../core/types.js';

export interface InputProps extends Props {
  placeholder?: string;
  disabled?: boolean;
  size?: string;
  type?: string;
  error?: boolean;
  multiline?: boolean;
  addonBefore?: Node | string | null;
  addonAfter?: Node | string | null;
  rows?: number;
  value?: string;
  onChange?: (value: string, e: Event) => void;
  onFocus?: (e: FocusEvent) => void;
  onBlur?: (e: FocusEvent) => void;
  onPressEnter?: (e: KeyboardEvent) => void;
}

export interface InputState extends State {
  value: string;
  focused: boolean;
}

export class Input extends Component {
  declare props: InputProps;
  declare state: InputState;
  _inputEl: HTMLInputElement | HTMLTextAreaElement | null = null;

  initialState(): InputState {
    return { value: this.props.value ?? '', focused: false };
  }

  render(): Node | string {
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
      this.state.focused && 'is-focused',
    ].filter(Boolean).join(' ');

    // 所有事件用 inline handler，每次 render 都会重新绑定
    // 避免根因 A：componentDidMount 里 this.on() 注册的事件在 _rerender 后丢失
    // onInput 不触发 setState，避免 input 重建丢失光标
    const inputEl = multiline
      ? h('textarea', {
          class: classes, placeholder, disabled,
          rows: this.props.rows || 3,
          onInput: (e: Event) => {
            const target = e.target as HTMLInputElement | HTMLTextAreaElement;
            this.state.value = target.value;
            this.props.onChange?.(target.value, e);
          },
          onFocus: (e: FocusEvent) => {
            this.state.focused = true;
            (e.target as HTMLElement).classList.add('is-focused');
            this.props.onFocus?.(e);
          },
          onBlur: (e: FocusEvent) => {
            this.state.focused = false;
            (e.target as HTMLElement).classList.remove('is-focused');
            this.props.onBlur?.(e);
          },
          onKeyDown: (e: KeyboardEvent) => {
            if (e.key === 'Enter') this.props.onPressEnter?.(e);
          },
        }, this.state.value)
      : h('input', {
          class: classes, type, placeholder, disabled,
          value: this.state.value,
          onInput: (e: Event) => {
            const target = e.target as HTMLInputElement | HTMLTextAreaElement;
            this.state.value = target.value;
            this.props.onChange?.(target.value, e);
          },
          onFocus: (e: FocusEvent) => {
            this.state.focused = true;
            (e.target as HTMLElement).classList.add('is-focused');
            this.props.onFocus?.(e);
          },
          onBlur: (e: FocusEvent) => {
            this.state.focused = false;
            (e.target as HTMLElement).classList.remove('is-focused');
            this.props.onBlur?.(e);
          },
          onKeyDown: (e: KeyboardEvent) => {
            if (e.key === 'Enter') this.props.onPressEnter?.(e);
          },
        });

    this._inputEl = inputEl as HTMLInputElement | HTMLTextAreaElement;

    if (addonBefore || addonAfter) {
      return h('div', { class: 'input-group' },
        addonBefore && h('span', { class: 'input-group__addon' }, addonBefore),
        inputEl,
        addonAfter && h('span', { class: 'input-group__addon' }, addonAfter),
      );
    }
    return inputEl;
  }

  getValue(): string { return this.state.value; }
  setValue(v: string): void {
    this.state.value = v;
    if (this._inputEl) this._inputEl.value = v;
  }
}
