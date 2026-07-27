// Descriptions.ts —— 描述列表组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
/** 单个描述项：可单独使用，也可作为 Descriptions 的子组件 */
export class DescriptionsItem extends Component {
    render() {
        const { label, span = 1, children } = this.props;
        return h('div', { class: 'descriptions__item', 'data-span': span }, label != null && h('div', { class: 'descriptions__item-label' }, label), h('div', { class: 'descriptions__item-content' }, children));
    }
}
export class Descriptions extends Component {
    /** 收集所有条目（items 优先；否则从 children 中读取 DescriptionsItem 的 props） */
    _collectEntries() {
        const { items = [], children } = this.props;
        if (items.length > 0) {
            return items.map((it, i) => ({
                key: it.key ?? i,
                label: it.label,
                content: it.children,
                span: it.span ?? 1,
            }));
        }
        const kids = Array.isArray(children) ? children : (children ? [children] : []);
        return kids
            .filter((k) => !!k && 'props' in k && (k.props.label != null || k.props.children != null))
            .map((k, i) => ({
            key: k.props.key ?? i,
            label: k.props.label,
            content: k.props.children,
            span: k.props.span ?? 1,
        }));
    }
    /** 按行分组：每行总 span 不超过 column；不足则补占位 */
    _buildRows(entries, column) {
        const rows = [];
        let current = [];
        let used = 0;
        for (const entry of entries) {
            const span = Math.max(1, Math.min(entry.span, column));
            // 当前行装不下：换行
            if (used + span > column && current.length > 0) {
                rows.push(current);
                current = [];
                used = 0;
            }
            current.push({ ...entry, span });
            used += span;
            // 刚好填满：换行
            if (used >= column) {
                rows.push(current);
                current = [];
                used = 0;
            }
        }
        if (current.length > 0)
            rows.push(current);
        // 补齐行末空位（保持表格网格对齐）
        return rows.map((row) => {
            const total = row.reduce((s, e) => s + e.span, 0);
            if (total < column) {
                return [...row, { label: '', content: '', span: column - total, _placeholder: true }];
            }
            return row;
        });
    }
    render() {
        const { title, column = 3, border = false, size = 'default', layout = 'horizontal', colon = true, } = this.props;
        const entries = this._collectEntries();
        const rows = this._buildRows(entries, column);
        const classes = [
            'descriptions',
            `descriptions--${size}`,
            `descriptions--${layout}`,
            border && 'descriptions--border',
        ].filter(Boolean).join(' ');
        // 横向布局：label 与 content 同行；纵向布局：label 在上 content 在下
        const rowsEl = layout === 'horizontal'
            ? rows.map((row) => h('tr', { class: 'descriptions__row' }, ...row.flatMap((entry) => [
                h('th', { class: 'descriptions__label', colspan: 1 }, entry.label, colon && entry.label !== '' && h('span', { class: 'descriptions__colon' }, '：')),
                h('td', {
                    class: 'descriptions__content',
                    colspan: entry.span * 2 - 1,
                    'data-placeholder': entry._placeholder ? 'true' : null,
                }, entry.content),
            ])))
            : rows.flatMap((row) => row.flatMap((entry) => [
                h('tr', { class: 'descriptions__row' }, h('th', {
                    class: 'descriptions__label',
                    colspan: column * 2,
                    'data-placeholder': entry._placeholder ? 'true' : null,
                }, entry.label, colon && entry.label !== '' && h('span', { class: 'descriptions__colon' }, '：'))),
                h('tr', { class: 'descriptions__row' }, h('td', {
                    class: 'descriptions__content',
                    colspan: column * 2,
                    'data-placeholder': entry._placeholder ? 'true' : null,
                }, entry.content)),
            ]));
        return h('div', { class: classes }, title && h('div', { class: 'descriptions__header' }, h('div', { class: 'descriptions__title' }, title)), h('div', { class: 'descriptions__view' }, h('table', { class: 'descriptions__table' }, h('tbody', {}, ...rowsEl))));
    }
}
//# sourceMappingURL=Descriptions.js.map