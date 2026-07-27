// TimePicker.ts —— 时间选择器（参考 antd TimePicker）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { mountDropdown, isClickInside } from './_portal.js';
import type { Props, State } from '../../core/types.js';

interface Time {
  h: number;
  m: number;
  s: number;
}

type TimePart = 'h' | 'm' | 's';

const pad = (n: number): string => String(n).padStart(2, '0');

/** 解析字符串/Date 为 { h, m, s } */
function parseTime(v: Date | string | null | undefined): Time | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return { h: v.getHours(), m: v.getMinutes(), s: v.getSeconds() };
  // 支持 "HH:mm:ss" / "HH:mm"
  const m = String(v).match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return null;
  return { h: +m[1], m: +m[2], s: m[3] != null ? +m[3] : 0 };
}

/** 按 format 格式化（HH:mm:ss / HH:mm） */
function formatTime(t: Time | null, format: string = 'HH:mm:ss', use12Hours: boolean = false): string {
  if (!t) return '';
  let h = t.h; const suffix = use12Hours ? (h < 12 ? ' AM' : ' PM') : '';
  if (use12Hours) { h = h % 12; if (h === 0) h = 12; }
  const base = format
    .replace('HH', pad(h))
    .replace('mm', pad(t.m))
    .replace('ss', pad(t.s));
  return base + suffix;
}

export interface TimePickerProps extends Props {
  value?: Date | string;
  defaultValue?: Date | string;
  format?: string;
  use12Hours?: boolean;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  onChange?: (time: Time | null, timeString: string) => void;
  hourStep?: number;
  minuteStep?: number;
  secondStep?: number;
}

export interface TimePickerState extends State {
  open: boolean;
  time: Time | null;
}

/**
 * 时间选择器
 * props:
 *   - value: Date | 'HH:mm:ss' | 'HH:mm'
 *   - format: string（默认 'HH:mm:ss'）
 *   - use12Hours: boolean
 *   - placeholder, disabled, allowClear
 *   - onChange: (time, timeString) => void
 *   - hourStep / minuteStep / secondStep: number（默认 1）
 */
export class TimePicker extends Component {
  declare props: TimePickerProps;
  declare state: TimePickerState;
  _outsideHandler: ((e: Event) => void) | null = null;
  _dropdownEl: HTMLElement | null = null;
  _portalCleanup: (() => void) | null = null;

  initialState(): TimePickerState {
    const t = parseTime(this.props.value ?? this.props.defaultValue);
    return { open: false, time: t };
  }

  componentDidMount(): void {
    this._outsideHandler = (e: Event) => {
      if (this.state.open && !isClickInside(e, this.el as HTMLElement | null, this._dropdownEl)) this._setOpen(false);
    };
    document.addEventListener('click', this._outsideHandler);
  }

  componentWillUnmount(): void {
    if (this._outsideHandler) document.removeEventListener('click', this._outsideHandler);
    this._closePortal();
  }

  _setOpen(open: boolean): void {
    if (open) {
      // setState 同步触发 _rerender，末尾 componentDidUpdate 完成 portal
      this.setState({ open: true });
    } else {
      this.setState({ open: false });
      this._closePortal();
    }
  }

  /** 重渲染后重新 portal，避免 body 旧 panel 变孤儿（根因 B） */
  componentDidUpdate(): void {
    if (this.state.open && this.el) {
      this._closePortal();
      this._openPortal();
    }
  }

  _openPortal(): void {
    this._closePortal();
    if (!this.state.open || !this.el) return;
    const panel = (this.el as Element).querySelector('.timepicker__panel') as HTMLElement | null;
    const trigger = (this.el as Element).querySelector('.timepicker__trigger') as HTMLElement | null;
    if (panel && trigger) {
      this._dropdownEl = panel;
      this._portalCleanup = mountDropdown(panel, trigger);
    }
  }

  _closePortal(): void {
    this._portalCleanup?.();
    this._portalCleanup = null;
    this._dropdownEl = null;
  }

  _now(): Time {
    const d = new Date();
    return { h: d.getHours(), m: d.getMinutes(), s: d.getSeconds() };
  }

  _select(part: TimePart, val: number): void {
    const t: Time = { ...(this.state.time || this._now()) };
    // 应用 step 取整
    const step = part === 'h' ? (this.props.hourStep || 1)
      : part === 'm' ? (this.props.minuteStep || 1) : (this.props.secondStep || 1);
    t[part] = Math.round(val / step) * step;
    if (this.props.use12Hours && part === 'h') {
      // 12 小时制不限制 0-12，但暂未维护 PM 状态，简化为直接保留
    }
    this.setState({ time: t });
    this.props.onChange?.(t, formatTime(t, this.props.format || 'HH:mm:ss', this.props.use12Hours));
  }

  _confirm(): void {
    this.setState({ open: false });
    this._closePortal();
    if (this.state.time) {
      this.props.onChange?.(this.state.time, formatTime(this.state.time, this.props.format || 'HH:mm:ss', this.props.use12Hours));
    }
  }

  _clear(e: MouseEvent): void {
    e.stopPropagation();
    this.setState({ time: null, open: false });
    this._closePortal();
    this.props.onChange?.(null, '');
  }

  /** 渲染单列：时/分/秒 */
  _renderColumn(part: TimePart, max: number, label: string): Node {
    const cur = this.state.time ? this.state.time[part] : -1;
    const step = part === 'h' ? (this.props.hourStep || 1)
      : part === 'm' ? (this.props.minuteStep || 1) : (this.props.secondStep || 1);
    const items: Node[] = [];
    for (let i = 0; i < max; i += step) {
      const idx = i;
      items.push(h('div', {
        class: `timepicker__option ${idx === cur ? 'is-selected' : ''}`,
        onClick: () => this._select(part, idx),
      }, pad(i)));
    }
    return h('div', { class: 'timepicker__column' },
      h('div', { class: 'timepicker__column-label' }, label),
      h('div', { class: 'timepicker__column-list' }, ...items),
    );
  }

  _renderPanel(): Node {
    const use12Hours = this.props.use12Hours;
    const hMax = use12Hours ? 12 : 24;
    return h('div', { class: 'timepicker__panel', role: 'dialog', onClick: (e: MouseEvent) => e.stopPropagation() },
      h('div', { class: 'timepicker__columns' },
        this._renderColumn('h', hMax, '时'),
        this._renderColumn('m', 60, '分'),
        this._renderColumn('s', 60, '秒'),
      ),
      h('div', { class: 'timepicker__footer' },
        h('button', {
          type: 'button', class: 'timepicker__btn timepicker__btn--now',
          onClick: () => { const t = this._now(); this.setState({ time: t }); this.props.onChange?.(t, formatTime(t, this.props.format || 'HH:mm:ss', use12Hours)); },
        }, '此刻'),
        h('button', { type: 'button', class: 'timepicker__btn timepicker__btn--ok', onClick: () => this._confirm() }, '确定'),
      ),
    );
  }

  render(): Node | string {
    const { placeholder = '请选择时间', disabled = false, allowClear = false, format = 'HH:mm:ss' } = this.props;
    const text = this.state.time ? formatTime(this.state.time, format, this.props.use12Hours) : '';
    const root = h('div', { class: `timepicker ${this.state.open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}` },
      h('div', {
        class: 'timepicker__trigger',
        tabindex: disabled ? '-1' : '0',
        role: 'combobox',
        'aria-expanded': String(this.state.open),
        'aria-haspopup': 'dialog',
        onClick: (e: MouseEvent) => {
          // 阻止冒泡到 document 的 outside 处理器（同 DatePicker/Cascader/ColorPicker）
          e.stopPropagation();
          if (!disabled) this._setOpen(!this.state.open);
        },
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === 'Escape' && this.state.open) this._setOpen(false);
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!disabled) this._setOpen(!this.state.open); }
        },
      },
        h('span', { class: text ? '' : 'text-tertiary' }, text || placeholder),
        h('span', { class: 'timepicker__icon', 'aria-hidden': 'true' }, '⏰'),
        allowClear && text && h('span', {
          class: 'timepicker__clear', role: 'button', 'aria-label': '清除',
          onClick: (e: MouseEvent) => this._clear(e),
        }, '×'),
      ),
    );
    if (this.state.open && !disabled) root.appendChild(this._renderPanel());
    return root;
  }

  getValue(): Time | null { return this.state.time; }
  setValue(v: Date | string | null | undefined): void { this.setState({ time: parseTime(v) }); }
}
