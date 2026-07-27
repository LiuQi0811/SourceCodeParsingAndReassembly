// Flex.ts —— 弹性布局组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import type { Props } from '../../core/types.js';

const GAP_SIZE_MAP: Record<string, number> = { small: 8, middle: 16, large: 24 };

const JUSTIFY_MAP: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  'space-around': 'space-around',
  'space-between': 'space-between',
  'space-evenly': 'space-evenly',
};

const ALIGN_MAP: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
};

/** Flex.item 返回的标记对象 */
export interface FlexItemMarker {
  __flexItem: true;
  content: Node | string;
  flex?: string | number;
}

export interface FlexProps extends Props {
  vertical?: boolean;
  wrap?: boolean;
  justify?: string;
  align?: string;
  gap?: string | number;
  className?: string;
  children?: any;
}

/** 解析 gap：预设字符串 / 数字 / 字符串 */
function resolveGap(gap: string | number | undefined): string {
  if (gap == null) return '';
  if (typeof gap === 'number') return `${gap}px`;
  if (typeof gap === 'string' && GAP_SIZE_MAP[gap] != null) return `${GAP_SIZE_MAP[gap]}px`;
  return String(gap);
}

/** 弹性布局：支持 vertical/wrap/justify/align/gap，子项用 .flex__item 包裹 */
export class Flex extends Component {
  declare props: FlexProps;

  render(): Node | string {
    const {
      vertical = false, wrap = false,
      justify, align, gap,
      className = '', children,
    } = this.props;

    const classes = [
      'flex',
      vertical && 'flex--vertical',
      wrap && 'flex--wrap',
      justify && `flex--justify-${justify}`,
      align && `flex--align-${align}`,
      className,
    ];

    const style: Record<string, string> = {
      display: 'flex',
      flexDirection: vertical ? 'column' : 'row',
      flexWrap: wrap ? 'wrap' : 'nowrap',
    };
    if (justify) style.justifyContent = JUSTIFY_MAP[justify] || justify;
    if (align) style.alignItems = ALIGN_MAP[align] || align;
    const gapValue = resolveGap(gap);
    if (gapValue) style.gap = gapValue;

    const kids = (Array.isArray(children) ? children : [children])
      .filter((c) => c != null && c !== false && c !== true)
      .map((child) => {
        // 支持 Flex.item(content, flex) 创建带 flex 属性的子项
        if (child && typeof child === 'object' && (child as FlexItemMarker).__flexItem) {
          const marker = child as FlexItemMarker;
          const itemStyle: Record<string, string> | null = marker.flex != null ? { flex: String(marker.flex) } : null;
          return h('div', { class: 'flex__item', style: itemStyle }, marker.content);
        }
        return h('div', { class: 'flex__item' }, child);
      });

    return h('div', { class: classes, style }, ...kids);
  }

  /**
   * 创建带可选 flex 属性的子项。
   * 用法：h(Flex, {}, Flex.item(h(Button, {}, 'OK'), '1'), Flex.item(h(Button, {}, 'Cancel')))
   * @param content 子内容
   * @param flex CSS flex 简写值，如 '1' / '0 0 200px'
   */
  static item(content: Node | string, flex?: string | number): FlexItemMarker {
    return { __flexItem: true, content, flex };
  }
}
