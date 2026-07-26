// InputNumber.js —— 数字输入框（参考 antd InputNumber）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

/**
 * 数字输入框
 * props:
 *   - value, defaultValue, min, max, step
 *   - precision: 小数位数
 *   - disabled, autoFocus
 *   - formatter: (value) => string  展示格式化
 *   - parser: (string) => value    解析输入
 *   - onChange: (value) => void
 *   - size: 'small' | 'middle' | 'large'
 *   - controls: boolean（默认 true，是否显示增减按钮）
 *   - keyboard: boolean（默认 true，键盘上下键调整）
 */
export class InputNumber extends Component {
  initialState() {
    const v = this.props.value ?? this.props.defaultValue ?? null;
    return { value: v, inputStr: v == null ? '' : String(v), focused: false };
  }

  _clamp(v) {
    if (v == null || Number.isNaN(v)) return v;
    const { min, max } = this.props;
    let r = v;
    if (typeof min === 'number') r = Math.max(min, r);
    if (typeof max === 'number') r = Math.min(max, r);
    return r;
  }

  _applyPrecision(v) {
    if (v == null || Number.isNaN(v)) return v;
    const { precision } = this.props;
    if (typeof precision === 'number' && precision >= 0) {
      return Number(v.toFixed(precision));
    }
    return v;
  }

  _getStep() {
    const step = Number(this.props.step);
    return Number.isFinite(step) && step > 0 ? step : 1;
  }

  _setValue(raw, fireChange = true) {
    let v = raw;
    if (typeof this.props.parser === 'function') {
      v = this.props.parser(String(raw));
    }
    if (typeof v === 'string') {
      v = v === '' ? null : Number(v);
    }
    if (v != null && Number.isNaN(v)) return;
    v = this._applyPrecision(this._clamp(v));
    this.setState({ value: v, inputStr: v == null ? '' : String(v) });
    if (fireChange) this.props.onChange?.(v);
  }

  _stepBy(delta) {
    const cur = typeof this.state.value === 'number' ? this.state.value : 0;
    const step = this._getStep();
    this._setValue(cur + step * delta);
  }

  _onInput(e) {
    const raw = e.target.value;
    // 仅暂存输入字符串，不立即触发 onChange（避免输入 "1." 时被规范化为 1）
    this.setState({ inputStr: raw });
  }

  _onBlur() {
    this.setState({ focused: false });
    // 失焦时规范化并提交
    this._setValue(this.state.inputStr);
  }

  _onFocus() {
    this.setState({ focused: true });
  }

  _onKeyDown(e) {
    if (this.props.keyboard === false) return;
    if (e.key === 'ArrowUp') { e.preventDefault(); this._stepBy(1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); this._stepBy(-1); }
    else if (e.key === 'Enter') { this._setValue(this.state.inputStr); }
  }

  _formatDisplay(v) {
    if (v == null) return '';
    if (typeof this.props.formatter === 'function') return this.props.formatter(v);
    return String(v);
  }

  render() {
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
      onInput: (e) => this._onInput(e),
      onFocus: () => this._onFocus(),
      onBlur: () => this._onBlur(),
      onKeyDown: (e) => this._onKeyDown(e),
    });
    this._inputEl = input;

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
        onClick: (e) => { e.preventDefault(); if (!disabled) this._stepBy(-1); },
      }, '−'),
      input,
      controls && h('button', {
        type: 'button',
        class: 'input-number__handler input-number__handler--up',
        tabindex: '-1',
        'aria-label': '增加',
        disabled,
        onClick: (e) => { e.preventDefault(); if (!disabled) this._stepBy(1); },
      }, '+'),
    );
  }

  getValue() { return this.state.value; }
  setValue(v) { this._setValue(v, false); }
  focus() { this._inputEl?.focus(); }
  blur() { this._inputEl?.blur(); }
}
