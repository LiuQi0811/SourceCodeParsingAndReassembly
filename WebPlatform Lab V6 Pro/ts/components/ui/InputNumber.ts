// InputNumber.ts —— 数字输入框（参考 antd InputNumber）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import type { Props, State } from '../../core/types.js';

export interface InputNumberProps extends Props {
  value?: number | null;
  defaultValue?: number | null;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  formatter?: (value: number) => string;
  parser?: (str: string) => number | string;
  onChange?: (value: number | null) => void;
  size?: 'small' | 'middle' | 'large';
  controls?: boolean;
  keyboard?: boolean;
  placeholder?: string;
}

export interface InputNumberState extends State {
  value: number | null;
  inputStr: string;
  focused: boolean;
}

export class InputNumber extends Component {
  declare props: InputNumberProps;
  declare state: InputNumberState;
  _inputEl: HTMLInputElement | null = null;

  initialState(): InputNumberState {
    const v = this.props.value ?? this.props.defaultValue ?? null;
    return { value: v, inputStr: v == null ? '' : String(v), focused: false };
  }

  _clamp(v: number | null): number | null {
    if (v == null || Number.isNaN(v)) return v;
    const { min, max } = this.props;
    let r = v;
    if (typeof min === 'number') r = Math.max(min, r);
    if (typeof max === 'number') r = Math.min(max, r);
    return r;
  }

  _applyPrecision(v: number | null): number | null {
    if (v == null || Number.isNaN(v)) return v;
    const { precision } = this.props;
    if (typeof precision === 'number' && precision >= 0) {
      return Number(v.toFixed(precision));
    }
    return v;
  }

  _getStep(): number {
    const step = Number(this.props.step);
    return Number.isFinite(step) && step > 0 ? step : 1;
  }

  // 直接改 state + 同步 DOM，不触发 rerender（避免 input 重建丢失光标/焦点）
  _setValue(raw: number | string | null, fireChange = true): void {
    let v: number | string | null = raw;
    if (typeof this.props.parser === 'function') {
      v = this.props.parser(String(raw));
    }
    if (typeof v === 'string') {
      v = v === '' ? null : Number(v);
    }
    if (v != null && Number.isNaN(v as number)) return;
    const clamped = this._applyPrecision(this._clamp(v as number | null));
    this.state.value = clamped;
    this.state.inputStr = clamped == null ? '' : String(clamped);
    // 非聚焦状态下才同步显示值（聚焦时让用户继续编辑）
    if (!this.state.focused && this._inputEl) {
      this._inputEl.value = this._formatDisplay(clamped);
    }
    if (fireChange) this.props.onChange?.(clamped);
  }

  _stepBy(delta: number): void {
    const cur = typeof this.state.value === 'number' ? this.state.value : 0;
    const step = this._getStep();
    this._setValue(cur + step * delta);
  }

  _formatDisplay(v: number | null): string {
    if (v == null) return '';
    if (typeof this.props.formatter === 'function') return this.props.formatter(v);
    return String(v);
  }

  render(): Node | string {
    const {
      disabled = false, size = 'middle', controls = true,
      placeholder = '', autoFocus = false,
    } = this.props;

    const displayStr = this.state.focused
      ? this.state.inputStr
      : this._formatDisplay(this.state.value);

    const input = h('input', {
      class: 'input-number__input',
      type: 'text',
      inputmode: 'decimal',
      placeholder,
      disabled,
      value: displayStr,
      autofocus: autoFocus,
      // 输入时直接改 state 字段，不触发 setState（避免 input 重建丢光标）
      onInput: (e: Event) => {
        this.state.inputStr = (e.target as HTMLInputElement).value;
      },
      onFocus: (e: FocusEvent) => {
        this.state.focused = true;
        (e.target as HTMLElement).classList.add('is-focused');
      },
      onBlur: (e: FocusEvent) => {
        this.state.focused = false;
        (e.target as HTMLElement).classList.remove('is-focused');
        // 失焦时规范化并提交
        this._setValue(this.state.inputStr);
      },
      onKeyDown: (e: KeyboardEvent) => {
        if (this.props.keyboard === false) return;
        if (e.key === 'ArrowUp') { e.preventDefault(); this._stepBy(1); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); this._stepBy(-1); }
        else if (e.key === 'Enter') { this._setValue(this.state.inputStr); }
      },
    });
    this._inputEl = input as HTMLInputElement;

    const classes = [
      'input-number',
      `input-number--${size}`,
      disabled && 'is-disabled',
    ].filter(Boolean).join(' ');

    return h('div', { class: classes },
      controls && h('button', {
        type: 'button',
        class: 'input-number__handler input-number__handler--down',
        tabindex: '-1',
        'aria-label': '减小',
        disabled,
        onClick: (e: MouseEvent) => { e.preventDefault(); if (!disabled) this._stepBy(-1); },
      }, '−'),
      input,
      controls && h('button', {
        type: 'button',
        class: 'input-number__handler input-number__handler--up',
        tabindex: '-1',
        'aria-label': '增加',
        disabled,
        onClick: (e: MouseEvent) => { e.preventDefault(); if (!disabled) this._stepBy(1); },
      }, '+'),
    );
  }

  getValue(): number | null { return this.state.value; }
  setValue(v: number | string | null): void { this._setValue(v, false); }
  focus(): void { this._inputEl?.focus(); }
  blur(): void { this._inputEl?.blur(); }
}
