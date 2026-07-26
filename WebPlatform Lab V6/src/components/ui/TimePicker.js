// TimePicker.js —— 时间选择器（参考 antd TimePicker）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { mountDropdown, isClickInside } from './_portal.js';

const pad = (n) => String(n).padStart(2, '0');

/** 解析字符串/Date 为 { h, m, s } */
function parseTime(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return { h: v.getHours(), m: v.getMinutes(), s: v.getSeconds() };
  // 支持 "HH:mm:ss" / "HH:mm"
  const m = String(v).match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return null;
  return { h: +m[1], m: +m[2], s: m[3] != null ? +m[3] : 0 };
}

/** 按 format 格式化（HH:mm:ss / HH:mm） */
function formatTime(t, format = 'HH:mm:ss', use12Hours = false) {
  if (!t) return '';
  let h = t.h; const suffix = use12Hours ? (h < 12 ? ' AM' : ' PM') : '';
  if (use12Hours) { h = h % 12; if (h === 0) h = 12; }
  const base = format
    .replace('HH', pad(h))
    .replace('mm', pad(t.m))
    .replace('ss', pad(t.s));
  return base + suffix;
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
  initialState() {
    const t = parseTime(this.props.value ?? this.props.defaultValue);
    return { open: false, time: t };
  }

  componentDidMount() {
    this._outsideHandler = (e) => {
      if (this.state.open && !isClickInside(e, this.el, this._dropdownEl)) this._setOpen(false);
    };
    document.addEventListener('click', this._outsideHandler);
  }

  componentWillUnmount() {
    document.removeEventListener('click', this._outsideHandler);
    this._closePortal();
  }

  _setOpen(open) {
    if (open) {
      this.setState({ open: true });
      this._openPortal();
    } else {
      this.setState({ open: false });
      this._closePortal();
    }
  }

  _openPortal() {
    this._closePortal();
    this._portalRAF = requestAnimationFrame(() => {
      if (!this.state.open || !this.el) return;
      const panel = this.el.querySelector('.timepicker__panel');
      const trigger = this.el.querySelector('.timepicker__trigger');
      if (panel && trigger) {
        this._dropdownEl = panel;
        this._portalCleanup = mountDropdown(panel, trigger);
      }
    });
  }

  _closePortal() {
    if (this._portalRAF) { cancelAnimationFrame(this._portalRAF); this._portalRAF = null; }
    this._portalCleanup?.();
    this._portalCleanup = null;
    this._dropdownEl = null;
  }

  _now() {
    const d = new Date();
    return { h: d.getHours(), m: d.getMinutes(), s: d.getSeconds() };
  }

  _select(part, val) {
    const t = { ...(this.state.time || this._now()) };
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

  _confirm() {
    this.setState({ open: false });
    this._closePortal();
    if (this.state.time) {
      this.props.onChange?.(this.state.time, formatTime(this.state.time, this.props.format || 'HH:mm:ss', this.props.use12Hours));
    }
  }

  _clear(e) {
    e.stopPropagation();
    this.setState({ time: null, open: false });
    this._closePortal();
    this.props.onChange?.(null, '');
  }

  /** 渲染单列：时/分/秒 */
  _renderColumn(part, max, label) {
    const cur = this.state.time ? this.state.time[part] : -1;
    const step = part === 'h' ? (this.props.hourStep || 1)
      : part === 'm' ? (this.props.minuteStep || 1) : (this.props.secondStep || 1);
    const items = [];
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

  _renderPanel() {
    const use12Hours = this.props.use12Hours;
    const hMax = use12Hours ? 12 : 24;
    return h('div', { class: 'timepicker__panel', role: 'dialog', onClick: (e) => e.stopPropagation() },
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

  render() {
    const { placeholder = '请选择时间', disabled = false, allowClear = false, format = 'HH:mm:ss' } = this.props;
    const text = this.state.time ? formatTime(this.state.time, format, this.props.use12Hours) : '';
    const root = h('div', { class: `timepicker ${this.state.open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}` },
      h('div', {
        class: 'timepicker__trigger',
        tabindex: disabled ? '-1' : '0',
        role: 'combobox',
        'aria-expanded': String(this.state.open),
        'aria-haspopup': 'dialog',
        onClick: (e) => {
          // 阻止冒泡到 document 的 outside 处理器（同 DatePicker/Cascader/ColorPicker）
          e.stopPropagation();
          if (!disabled) this._setOpen(!this.state.open);
        },
        onKeyDown: (e) => {
          if (e.key === 'Escape' && this.state.open) this._setOpen(false);
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!disabled) this._setOpen(!this.state.open); }
        },
      },
        h('span', { class: text ? '' : 'text-tertiary' }, text || placeholder),
        h('span', { class: 'timepicker__icon', 'aria-hidden': 'true' }, '⏰'),
        allowClear && text && h('span', {
          class: 'timepicker__clear', role: 'button', 'aria-label': '清除',
          onClick: (e) => this._clear(e),
        }, '×'),
      ),
    );
    if (this.state.open && !disabled) root.appendChild(this._renderPanel());
    return root;
  }

  getValue() { return this.state.time; }
  setValue(v) { this.setState({ time: parseTime(v) }); }
}
