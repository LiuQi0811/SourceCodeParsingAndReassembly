// Breadcrumb.ts —— 面包屑导航组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
export class Breadcrumb extends Component {
    render() {
        const { items = [], separator = '/' } = this.props;
        const lastIndex = items.length - 1;
        return h('nav', { class: 'breadcrumb', 'aria-label': 'Breadcrumb' }, h('ol', { class: 'breadcrumb__list' }, ...items.map((item, index) => {
            const isLast = index === lastIndex;
            const label = item?.label ?? '';
            // 最后一项为当前页，不可点击
            const labelNode = isLast
                ? h('span', { class: 'breadcrumb__current', 'aria-current': 'page' }, label)
                : h('a', {
                    class: 'breadcrumb__link',
                    href: item.path || '#',
                    onClick: (e) => {
                        if (!item.onClick)
                            return;
                        e.preventDefault();
                        item.onClick(item, index, e);
                    },
                }, label);
            // 分隔符仅出现在非末尾项之后
            const sep = !isLast && h('span', {
                class: 'breadcrumb__separator',
                'aria-hidden': 'true',
            }, separator);
            return h('li', { class: 'breadcrumb__item' }, labelNode, sep);
        })));
    }
}
//# sourceMappingURL=Breadcrumb.js.map