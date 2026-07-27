// Progress.ts / Empty.js / Skeleton.js / Divider.js
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import type { Props, State } from '../../core/types.js';

export interface ProgressProps extends Props {
  percent?: number;
  status?: string;
  showInfo?: boolean;
  strokeColor?: string;
}

export interface ProgressState extends State {
  percent: number;
}

export class Progress extends Component {
  declare props: ProgressProps;
  declare state: ProgressState;

  initialState(): ProgressState { return { percent: this.props.percent ?? 0 }; }
  render(): Node | string {
    const { status = 'active', showInfo = true, strokeColor } = this.props;
    const p = Math.max(0, Math.min(100, this.state.percent));
    const cls = status !== 'active' ? `progress--${status}` : '';
    const bar = h('div', {
      class: 'progress__bar',
      style: { width: `${p}%`, ...(strokeColor ? { background: strokeColor } : {}) },
    });
    return h('div', { class: 'flex items-center gap-sm' },
      h('div', { class: `progress flex-1 ${cls}` }, bar),
      showInfo && h('span', { class: 'fs-sm text-secondary text-mono' }, `${Math.round(p)}%`),
    );
  }
  setPercent(v: number): void { this.setState({ percent: v }); }
}

export interface EmptyProps extends Props {
  description?: string;
}

export class Empty extends Component {
  declare props: EmptyProps;

  render(): Node | string {
    const { description = '暂无数据' } = this.props;
    return h('div', { class: 'empty' },
      h('div', { class: 'empty__icon' }, '∅'),
      h('p', {}, description),
    );
  }
}

export interface SkeletonProps extends Props {
  lines?: number;
  height?: number;
  width?: string;
}

export class Skeleton extends Component {
  declare props: SkeletonProps;

  render(): Node | string {
    const { lines = 3, height = 16, width = '100%' } = this.props;
    return h('div', { class: 'flex flex-col gap-sm' },
      ...Array.from({ length: lines }, (_, i) => h('div', {
        class: 'skeleton',
        style: { height: `${height}px`, width: i === lines - 1 ? '60%' : width },
      })),
    );
  }
}

export interface DividerProps extends Props {
  label?: string;
  dashed?: boolean;
}

export class Divider extends Component {
  declare props: DividerProps;

  render(): Node | string {
    const { label, dashed = false } = this.props;
    if (!label) return h('hr', { class: 'divider', style: dashed ? { borderTopStyle: 'dashed' } : null });
    return h('div', { class: 'flex items-center gap-md my-md' },
      h('div', { style: { flex: 1, height: '1px', background: 'var(--color-border-secondary)' } }),
      h('span', { class: 'fs-sm text-tertiary' }, label),
      h('div', { style: { flex: 1, height: '1px', background: 'var(--color-border-secondary)' } }),
    );
  }
}
