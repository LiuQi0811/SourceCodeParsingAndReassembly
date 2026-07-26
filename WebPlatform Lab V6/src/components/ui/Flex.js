// Flex.js —— 弹性布局组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

const GAP_SIZE_MAP = { small: 8, middle: 16, large: 24 };

const JUSTIFY_MAP = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  'space-around': 'space-around',
  'space-between': 'space-between',
  'space-evenly': 'space-evenly',
};

const ALIGN_MAP = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
};

/** 解析 gap：预设字符串 / 数字 / 字符串 */
function resolveGap(gap) {
  if (gap == null) return '';
  if (typeof gap === 'number') return `${gap}px`;
  if (typeof gap === 'string' && GAP_SIZE_MAP[gap] != null) return `${GAP_SIZE_MAP[gap]}px`;
  return String(gap);
}

/** 弹性布局：支持 vertical/wrap/justify/align/gap，子项用 .flex__item 包裹 */
export class Flex extends Component {
  render() {
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

    const style = {
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
        if (child && typeof child === 'object' && child.__flexItem) {
          const itemStyle = child.flex != null ? { flex: String(child.flex) } : null;
          return h('div', { class: 'flex__item', style: itemStyle }, child.content);
        }
        return h('div', { class: 'flex__item' }, child);
      });

    return h('div', { class: classes, style }, ...kids);
  }
}

/**
 * 创建带可选 flex 属性的子项。
 * 用法：h(Flex, {}, Flex.item(h(Button, {}, 'OK'), '1'), Flex.item(h(Button, {}, 'Cancel')))
 * @param {*} content 子内容
 * @param {string|number} [flex] CSS flex 简写值，如 '1' / '0 0 200px'
 */
Flex.item = function item(content, flex) {
  return { __flexItem: true, content, flex };
};
