// DatePicker.ts —— 日期选择器（参考 antd DatePicker，含 RangePicker）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { mountDropdown, isClickInside } from './_portal.js';
import type { Props, State } from '../../core/types.js';

const WEEK_DAYS: string[] = ['日', '一', '二', '三', '四', '五', '六'];
const MONTH_NAMES: string[] = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

/** 将任意输入归一化为 Date 实例 */
function toDate(v: Date | string | null | undefined): Date | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return new Date(v.getTime());
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 按 format token 格式化（仅支持 YYYY MM DD HH mm ss） */
function formatDate(date: Date | null, format: string = 'YYYY-MM-DD'): string {
  if (!date) return '';
  const pad = (n: number): string => String(n).padStart(2, '0');
  return format
    .replace('YYYY', String(date.getFullYear()))
    .replace('MM', pad(date.getMonth() + 1))
    .replace('DD', pad(date.getDate()))
    .replace('HH', pad(date.getHours()))
    .replace('mm', pad(date.getMinutes()))
    .replace('ss', pad(date.getSeconds()));
}

/** 日期唯一键（不含时分秒） */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

interface CalendarCell {
  date: Date;
  inMonth: boolean;
}

export interface DatePickerProps extends Props {
  value?: Date | string;
  defaultValue?: Date | string;
  format?: string;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  showToday?: boolean;
  onChange?: (date: Date | null, dateString: string) => void;
}

export interface DatePickerState extends State {
  open: boolean;
  value: Date | null;
  // 视图所在月份：取值所在月，无值时取今天
  viewDate: Date;
}

/**
 * 日期选择器
 * props:
 *   - value: Date | string
 *   - defaultValue
 *   - format: string（默认 'YYYY-MM-DD'）
 *   - placeholder: string
 *   - disabled: boolean
 *   - allowClear: boolean
 *   - showToday: boolean
 *   - onChange: (date, dateString) => void
 */
export class DatePicker extends Component {
  declare props: DatePickerProps;
  declare state: DatePickerState;
  _outsideHandler: ((e: Event) => void) | null = null;
  _dropdownEl: HTMLElement | null = null;
  _portalCleanup: (() => void) | null = null;

  initialState(): DatePickerState {
    const v = toDate(this.props.value ?? this.props.defaultValue);
    return {
      open: false,
      value: v,
      // 视图所在月份：取值所在月，无值时取今天
      viewDate: v ? new Date(v.getFullYear(), v.getMonth(), 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    };
  }

  componentDidMount(): void {
    this._outsideHandler = (e: Event) => {
      if (this.state.open && !isClickInside(e, this.el as HTMLElement | null, this._dropdownEl)) {
        this._setOpen(false);
      }
    };
    document.addEventListener('click', this._outsideHandler);
  }

  componentWillUnmount(): void {
    if (this._outsideHandler) document.removeEventListener('click', this._outsideHandler);
    this._closePortal();
  }

  _setOpen(open: boolean): void {
    // 打开时把视图月份对齐到当前值/今天
    if (open) {
      const base = this.state.value || new Date();
      // setState 同步触发 _rerender，末尾 componentDidUpdate 完成 portal
      this.setState({ open: true, viewDate: new Date(base.getFullYear(), base.getMonth(), 1) });
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
    const panel = (this.el as Element).querySelector('.datepicker__panel') as HTMLElement | null;
    const trigger = (this.el as Element).querySelector('.datepicker__trigger') as HTMLElement | null;
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

  _select(date: Date): void {
    // 保留原有时分秒（若有的话）
    if (this.state.value) {
      date.setHours(this.state.value.getHours(), this.state.value.getMinutes(), this.state.value.getSeconds());
    }
    this.setState({ value: date, open: false });
    this._closePortal();
    this.props.onChange?.(date, formatDate(date, this.props.format || 'YYYY-MM-DD'));
  }

  _goToday(): void {
    const today = new Date();
    this._select(today);
  }

  _clear(e: MouseEvent): void {
    e.stopPropagation();
    this.setState({ value: null, open: false });
    this._closePortal();
    this.props.onChange?.(null, '');
  }

  _changeMonth(delta: number): void {
    const d = new Date(this.state.viewDate);
    d.setMonth(d.getMonth() + delta);
    this.setState({ viewDate: d });
  }

  _changeYear(delta: number): void {
    const d = new Date(this.state.viewDate);
    d.setFullYear(d.getFullYear() + delta);
    this.setState({ viewDate: d });
  }

  /** 渲染日历面板 */
  _renderPanel(): Node {
    const viewDate = this.state.viewDate;
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const today = new Date();
    const todayK = dateKey(today);
    const selectedK = this.state.value ? dateKey(this.state.value) : null;

    const startWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: CalendarCell[] = [];
    for (let i = startWeekday - 1; i >= 0; i--) {
      cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(year, month, d), inMonth: true });
    }
    while (cells.length < 42) {
      const last = cells[cells.length - 1].date;
      cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false });
    }

    return h('div', { class: 'datepicker__panel', role: 'dialog', onClick: (e: MouseEvent) => e.stopPropagation() },
      h('div', { class: 'datepicker__header' },
        h('button', { type: 'button', class: 'datepicker__btn', onClick: () => this._changeYear(-1) }, '«'),
        h('button', { type: 'button', class: 'datepicker__btn', onClick: () => this._changeMonth(-1) }, '‹'),
        h('span', { class: 'datepicker__title' }, `${year}年 ${MONTH_NAMES[month]}`),
        h('button', { type: 'button', class: 'datepicker__btn', onClick: () => this._changeMonth(1) }, '›'),
        h('button', { type: 'button', class: 'datepicker__btn', onClick: () => this._changeYear(1) }, '»'),
      ),
      h('div', { class: 'datepicker__weekdays' },
        ...WEEK_DAYS.map((w) => h('div', { class: 'datepicker__weekday' }, w)),
      ),
      h('div', { class: 'datepicker__cells' },
        ...cells.map((cell) => {
          const k = dateKey(cell.date);
          const classes = [
            'datepicker__cell',
            !cell.inMonth && 'datepicker__cell--other',
            k === todayK && 'is-today',
            k === selectedK && 'is-selected',
          ].filter(Boolean).join(' ');
          return h('div', {
            class: classes,
            onClick: () => this._select(cell.date),
          }, cell.date.getDate());
        }),
      ),
      this.props.showToday && h('div', { class: 'datepicker__footer' },
        h('button', { type: 'button', class: 'datepicker__today-btn', onClick: () => this._goToday() }, '今天'),
      ),
    );
  }

  render(): Node | string {
    const { placeholder = '请选择日期', disabled = false, allowClear = false, format = 'YYYY-MM-DD' } = this.props;
    const text = this.state.value ? formatDate(this.state.value, format) : '';
    const root = h('div', {
      class: `datepicker ${this.state.open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`,
    },
      h('div', {
        class: 'datepicker__trigger',
        tabindex: disabled ? '-1' : '0',
        role: 'combobox',
        'aria-expanded': String(this.state.open),
        'aria-haspopup': 'dialog',
        onClick: (e: MouseEvent) => {
          // 阻止冒泡到 document 的 outside 处理器：
          // setState 触发同步 rerender 替换 trigger 节点后，
          // 原事件 target 变为游离节点，outsideHandler 会误判为外部点击而立即关闭。
          e.stopPropagation();
          if (!disabled) this._setOpen(!this.state.open);
        },
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === 'Escape' && this.state.open) this._setOpen(false);
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!disabled) this._setOpen(!this.state.open); }
        },
      },
        h('span', { class: text ? '' : 'text-tertiary' }, text || placeholder),
        h('span', { class: 'datepicker__icon', 'aria-hidden': 'true' }, '📅'),
        allowClear && text && h('span', {
          class: 'datepicker__clear',
          role: 'button',
          'aria-label': '清除',
          onClick: (e: MouseEvent) => this._clear(e),
        }, '×'),
      ),
    );
    if (this.state.open && !disabled) root.appendChild(this._renderPanel());
    return root;
  }

  getValue(): Date | null { return this.state.value; }
  setValue(v: Date | string | null | undefined): void {
    const d = toDate(v);
    this.setState({ value: d, viewDate: d ? new Date(d.getFullYear(), d.getMonth(), 1) : this.state.viewDate });
  }
}

export interface RangePickerProps extends Props {
  value?: Array<Date | string | null>;
  defaultValue?: Array<Date | string | null>;
  format?: string;
  placeholder?: [string, string] | string;
  disabled?: boolean;
  allowClear?: boolean;
  onChange?: (dates: [Date | null, Date | null], dateStrings: [string, string]) => void;
}

export interface RangePickerState extends State {
  open: boolean;
  start: Date | null;
  end: Date | null;
  // 待选阶段：'start' | 'end'，首次点击选 start，再次点击选 end
  selecting: 'start' | 'end';
  viewDate: Date;
}

/**
 * 范围日期选择器
 * props:
 *   - value: [Date, Date] | [string, string]
 *   - format, placeholder: [string, string], disabled, allowClear, onChange
 */
export class RangePicker extends Component {
  declare props: RangePickerProps;
  declare state: RangePickerState;
  _outsideHandler: ((e: Event) => void) | null = null;
  _dropdownEl: HTMLElement | null = null;
  _portalCleanup: (() => void) | null = null;

  initialState(): RangePickerState {
    const v = this.props.value || this.props.defaultValue;
    const arr: Array<Date | null> = Array.isArray(v) ? v.map(toDate) : [null, null];
    return {
      open: false,
      start: arr[0] || null,
      end: arr[1] || null,
      // 待选阶段：'start' | 'end'，首次点击选 start，再次点击选 end
      selecting: 'start',
      viewDate: arr[0] ? new Date(arr[0].getFullYear(), arr[0].getMonth(), 1) : new Date(),
    };
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
      const base = this.state.start || new Date();
      // setState 同步触发 _rerender，末尾 componentDidUpdate 完成 portal
      this.setState({ open: true, selecting: 'start', viewDate: new Date(base.getFullYear(), base.getMonth(), 1) });
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
    const panel = (this.el as Element).querySelector('.rangepicker__panel') as HTMLElement | null;
    const trigger = (this.el as Element).querySelector('.rangepicker__trigger') as HTMLElement | null
      || (this.el as Element).querySelector('.datepicker__trigger') as HTMLElement | null;
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

  _select(date: Date): void {
    if (this.state.selecting === 'start' || !this.state.start || (this.state.end && date < this.state.start)) {
      // 选起点（或重选起点）
      this.setState({ start: date, end: null, selecting: 'end' });
    } else {
      // 选终点
      let s = this.state.start; let e = date;
      if (date < s) [s, e] = [date, s];
      this.setState({ start: s, end: e, open: false, selecting: 'start' });
      this._closePortal();
      const fmt = this.props.format || 'YYYY-MM-DD';
      this.props.onChange?.([s, e], [formatDate(s, fmt), formatDate(e, fmt)]);
    }
  }

  _clear(e: MouseEvent): void {
    e.stopPropagation();
    this.setState({ start: null, end: null, open: false, selecting: 'start' });
    this._closePortal();
    this.props.onChange?.([null, null], ['', '']);
  }

  _changeMonth(delta: number): void {
    const d = new Date(this.state.viewDate);
    d.setMonth(d.getMonth() + delta);
    this.setState({ viewDate: d });
  }

  _renderPanel(): Node {
    const viewDate = this.state.viewDate;
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const todayK = dateKey(new Date());
    const startK = this.state.start ? dateKey(this.state.start) : null;
    const endK = this.state.end ? dateKey(this.state.end) : null;

    const startWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const cells: CalendarCell[] = [];
    for (let i = startWeekday - 1; i >= 0; i--) {
      cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d), inMonth: true });
    while (cells.length < 42) {
      const last = cells[cells.length - 1].date;
      cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false });
    }

    return h('div', { class: 'rangepicker__panel', role: 'dialog', onClick: (e: MouseEvent) => e.stopPropagation() },
      h('div', { class: 'datepicker__header' },
        h('button', { type: 'button', class: 'datepicker__btn', onClick: () => this._changeMonth(-1) }, '‹'),
        h('span', { class: 'datepicker__title' }, `${year}年 ${MONTH_NAMES[month]}`),
        h('button', { type: 'button', class: 'datepicker__btn', onClick: () => this._changeMonth(1) }, '›'),
      ),
      h('div', { class: 'datepicker__weekdays' },
        ...WEEK_DAYS.map((w) => h('div', { class: 'datepicker__weekday' }, w)),
      ),
      h('div', { class: 'datepicker__cells' },
        ...cells.map((cell) => {
          const k = dateKey(cell.date);
          const inRange = this.state.start && this.state.end
            && cell.date >= this.state.start && cell.date <= this.state.end;
          const classes = [
            'datepicker__cell',
            !cell.inMonth && 'datepicker__cell--other',
            k === todayK && 'is-today',
            k === startK && 'is-selected',
            k === endK && 'is-selected',
            inRange && 'is-in-range',
          ].filter(Boolean).join(' ');
          return h('div', { class: classes, onClick: () => this._select(cell.date) }, cell.date.getDate());
        }),
      ),
    );
  }

  render(): Node | string {
    const { placeholder = ['开始日期', '结束日期'], disabled = false, allowClear = false, format = 'YYYY-MM-DD' } = this.props;
    const ph: [string, string] = Array.isArray(placeholder) ? placeholder : [placeholder, placeholder];
    const startText = this.state.start ? formatDate(this.state.start, format) : '';
    const endText = this.state.end ? formatDate(this.state.end, format) : '';
    const root = h('div', { class: `rangepicker ${this.state.open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}` },
      h('div', {
        class: 'rangepicker__trigger',
        tabindex: disabled ? '-1' : '0',
        role: 'combobox',
        'aria-expanded': String(this.state.open),
        onClick: (e: MouseEvent) => {
          // 阻止冒泡到 document 的 outside 处理器（同 DatePicker）
          e.stopPropagation();
          if (!disabled) this._setOpen(!this.state.open);
        },
      },
        h('span', { class: startText ? '' : 'text-tertiary' }, startText || ph[0]),
        h('span', { class: 'rangepicker__separator' }, '~'),
        h('span', { class: endText ? '' : 'text-tertiary' }, endText || ph[1]),
        allowClear && (startText || endText) && h('span', {
          class: 'rangepicker__clear', role: 'button', 'aria-label': '清除',
          onClick: (e: MouseEvent) => this._clear(e),
        }, '×'),
      ),
    );
    if (this.state.open && !disabled) root.appendChild(this._renderPanel());
    return root;
  }

  getValue(): [Date | null, Date | null] { return [this.state.start, this.state.end]; }
  setValue(v: Array<Date | string | null> | null | undefined): void {
    const arr: Array<Date | null> = Array.isArray(v) ? v.map(toDate) : [null, null];
    this.setState({ start: arr[0], end: arr[1] });
  }
}
