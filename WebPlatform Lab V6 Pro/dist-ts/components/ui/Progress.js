// Progress.ts / Empty.js / Skeleton.js / Divider.js
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
export class Progress extends Component {
    initialState() { return { percent: this.props.percent ?? 0 }; }
    render() {
        const { status = 'active', showInfo = true, strokeColor } = this.props;
        const p = Math.max(0, Math.min(100, this.state.percent));
        const cls = status !== 'active' ? `progress--${status}` : '';
        const bar = h('div', {
            class: 'progress__bar',
            style: { width: `${p}%`, ...(strokeColor ? { background: strokeColor } : {}) },
        });
        return h('div', { class: 'flex items-center gap-sm' }, h('div', { class: `progress flex-1 ${cls}` }, bar), showInfo && h('span', { class: 'fs-sm text-secondary text-mono' }, `${Math.round(p)}%`));
    }
    setPercent(v) { this.setState({ percent: v }); }
}
export class Empty extends Component {
    render() {
        const { description = '暂无数据' } = this.props;
        return h('div', { class: 'empty' }, h('div', { class: 'empty__icon' }, '∅'), h('p', {}, description));
    }
}
export class Skeleton extends Component {
    render() {
        const { lines = 3, height = 16, width = '100%' } = this.props;
        return h('div', { class: 'flex flex-col gap-sm' }, ...Array.from({ length: lines }, (_, i) => h('div', {
            class: 'skeleton',
            style: { height: `${height}px`, width: i === lines - 1 ? '60%' : width },
        })));
    }
}
export class Divider extends Component {
    render() {
        const { label, dashed = false } = this.props;
        if (!label)
            return h('hr', { class: 'divider', style: dashed ? { borderTopStyle: 'dashed' } : null });
        return h('div', { class: 'flex items-center gap-md my-md' }, h('div', { style: { flex: 1, height: '1px', background: 'var(--color-border-secondary)' } }), h('span', { class: 'fs-sm text-tertiary' }, label), h('div', { style: { flex: 1, height: '1px', background: 'var(--color-border-secondary)' } }));
    }
}
//# sourceMappingURL=Progress.js.map