// Space.ts —— 间距组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
const SIZE_MAP = { small: 8, middle: 16, large: 24 };
const ALIGN_MAP = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    baseline: 'baseline',
};
/** 间距组件：在子项之间添加统一间距，子项用 .space__item 包裹 */
export class Space extends Component {
    render() {
        const { size = 'small', direction = 'horizontal', align, wrap = false, split, className = '', children, } = this.props;
        // size 支持预设字符串或数字像素值
        const sizeValue = SIZE_MAP[size] ?? (typeof size === 'number' ? size : 8);
        const gap = typeof sizeValue === 'number' ? `${sizeValue}px` : String(sizeValue);
        const kids = (Array.isArray(children) ? children : [children])
            .filter((c) => c != null && c !== false && c !== true);
        const classes = [
            'space',
            `space--${direction}`,
            wrap && 'space--wrap',
            align && `space--align-${align}`,
            className,
        ];
        const style = {
            display: 'flex',
            flexDirection: direction === 'vertical' ? 'column' : 'row',
            flexWrap: wrap ? 'wrap' : 'nowrap',
            gap,
        };
        if (align)
            style.alignItems = ALIGN_MAP[align] || align;
        // 子项逐个包裹 .space__item；若提供 split，在项之间插入分隔符
        const items = [];
        kids.forEach((child, idx) => {
            items.push(h('div', { class: 'space__item' }, child));
            if (split != null && idx < kids.length - 1) {
                items.push(h('span', { class: 'space__split' }, split));
            }
        });
        return h('div', { class: classes, style }, ...items);
    }
}
//# sourceMappingURL=Space.js.map