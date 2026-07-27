// Segmented.ts —— 分段控制器（iOS 风格分段选择）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import type { Props, State } from '../../core/types.js';

export interface SegmentedOption {
  value: any;
  label: Node | string;
  disabled?: boolean;
}

export interface SegmentedProps extends Props {
  options?: SegmentedOption[];
  defaultValue?: any;
  value?: any;
  block?: boolean;
  onChange?: (value: any) => void;
}

export interface SegmentedState extends State {
  value: any;
}

export class Segmented extends Component {
  declare props: SegmentedProps;
  declare state: SegmentedState;

  initialState(): SegmentedState {
    return { value: this.props.value ?? this.props.defaultValue };
  }

  render(): Node | string {
    const { options = [], block = false } = this.props;
    const { value } = this.state;
    const count = options.length;
    const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));

    // 滑动指示器：宽度按等分计算，通过 transform 平移到选中项位置
    const thumb: Node | null = count > 0 ? h('div', {
      class: 'segmented__thumb',
      style: {
        width: `${100 / count}%`,
        transform: `translateX(${selectedIndex * 100}%)`,
      },
    }) : null;

    return h('div', {
      class: ['segmented', block && 'segmented--block'],
    },
      thumb,
      ...options.map((opt) => {
        const selected = opt.value === value;
        return h('div', {
          class: [
            'segmented__item',
            selected && 'segmented__item--selected',
            opt.disabled && 'is-disabled',
          ],
          onClick: () => {
            if (opt.disabled || selected) return;
            this.setState({ value: opt.value });
            this.props.onChange?.(opt.value);
          },
        }, opt.label);
      }),
    );
  }

  getValue(): any { return this.state.value; }
  setValue(v: any): void { this.setState({ value: v }); }
}
