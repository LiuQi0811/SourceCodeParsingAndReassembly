// Slider.js —— 滑动条组件（基于原生 range input，可联动数字输入）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

export class Slider extends Component {
  initialState() {
    return { value: this.props.value ?? 0 };
  }

  /** 将值夹取到 [min, max] 区间 */
  _clamp(v) {
    const { min = 0, max = 100 } = this.props;
    return Math.min(Math.max(v, min), max);
  }

  render() {
    const {
      min = 0, max = 100, step = 1, disabled = false,
      showInput = false,
    } = this.props;
    const { value } = this.state;

    const rangeInput = h('input', {
      class: 'slider__input',
      type: 'range',
      min, max, step,
      value, disabled,
      onInput: (e) => {
        const v = Number(e.target.value);
        // 值变化判断：避免相同值重复 setState（range input 拖拽时同像素会反复触发）
        if (v === this.state.value) return;
        this.setState({ value: v });
        this.props.onChange?.(v);
      },
    });

    const children = [rangeInput];

    // 联动数字输入框：双向更新 value
    if (showInput) {
      children.push(h('input', {
        class: 'slider__number-input',
        type: 'number',
        min, max, step,
        value, disabled,
        onChange: (e) => {
          const v = Number(e.target.value);
          if (Number.isNaN(v)) return;
          const clamped = this._clamp(v);
          this.setState({ value: clamped });
          this.props.onChange?.(clamped);
        },
      }));
    }

    return h('div', {
      class: ['slider', disabled && 'slider--disabled'],
    }, ...children);
  }

  getValue() { return this.state.value; }
  setValue(v) { this.setState({ value: this._clamp(v) }); }
}
