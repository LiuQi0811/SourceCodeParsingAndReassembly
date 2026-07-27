// Slider.ts —— 滑动条组件（基于原生 range input，可联动数字输入）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import type { Props, State } from '../../core/types.js';

export interface SliderProps extends Props {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  showInput?: boolean;
  onChange?: (value: number) => void;
}

export interface SliderState extends State {
  value: number;
}

export class Slider extends Component {
  declare props: SliderProps;
  declare state: SliderState;

  initialState(): SliderState {
    return { value: this.props.value ?? 0 };
  }

  /** 将值夹取到 [min, max] 区间 */
  _clamp(v: number): number {
    const { min = 0, max = 100 } = this.props;
    return Math.min(Math.max(v, min), max);
  }

  render(): Node | string {
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
      // 拖动中：直接更新 state 字段 + 联动 DOM，不触发 setState。
      // 原因：setState 会触发 _rerender 重建整个 DOM（oldEl.replaceWith），
      // 导致正在被拖动的 input 被销毁重建，浏览器原生拖拽状态丢失，表现为闪屏/断掉。
      // 浏览器原生 range input 拖动时已自动更新自身 value 和 thumb 位置，无需重建 DOM。
      onInput: (e: Event) => {
        const v = Number((e.target as HTMLInputElement).value);
        if (v === this.state.value) return;
        this.state.value = v; // 直接改 state 字段，不触发 rerender
        const numEl = this.$('.slider__number-input') as HTMLInputElement | null;
        if (numEl) numEl.value = String(v); // 联动数字输入框
        this.props.onChange?.(v);
      },
    });

    const children: Node[] = [rangeInput];

    // 联动数字输入框：双向更新 value
    if (showInput) {
      children.push(h('input', {
        class: 'slider__number-input',
        type: 'number',
        min, max, step,
        value, disabled,
        onChange: (e: Event) => {
          const v = Number((e.target as HTMLInputElement).value);
          if (Number.isNaN(v)) return;
          const clamped = this._clamp(v);
          // 直接同步 range input 的 DOM value，不触发 rerender
          const rangeEl = this.$('.slider__input') as HTMLInputElement | null;
          if (rangeEl) rangeEl.value = String(clamped);
          this.state.value = clamped;
          this.props.onChange?.(clamped);
        },
      }));
    }

    return h('div', {
      class: ['slider', disabled && 'slider--disabled'],
    }, ...children);
  }

  getValue(): number { return this.state.value; }
  setValue(v: number): void {
    const clamped = this._clamp(v);
    this.state.value = clamped;
    // 直接同步 DOM，不触发 rerender
    const rangeEl = this.$('.slider__input') as HTMLInputElement | null;
    if (rangeEl) rangeEl.value = String(clamped);
    const numEl = this.$('.slider__number-input') as HTMLInputElement | null;
    if (numEl) numEl.value = String(clamped);
  }
}
