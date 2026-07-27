// Calendar.ts —— 日历组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月'];
export class Calendar extends Component {
    initialState() {
        const { value, defaultValue } = this.props;
        const base = value || defaultValue || new Date();
        return {
            viewDate: new Date(base.getFullYear(), base.getMonth(), 1),
            selectedDate: value || defaultValue || null,
        };
    }
    /** 切换月份 */
    _changeMonth(delta) {
        const d = new Date(this.state.viewDate);
        d.setMonth(d.getMonth() + delta);
        this.setState({ viewDate: d });
        this.props.onPanelChange?.(d, this.props.mode || 'month');
    }
    /** 切换年份 */
    _changeYear(delta) {
        const d = new Date(this.state.viewDate);
        d.setFullYear(d.getFullYear() + delta);
        this.setState({ viewDate: d });
        this.props.onPanelChange?.(d, this.props.mode || 'month');
    }
    /** 回到今天 */
    _goToday() {
        const today = new Date();
        this.setState({ viewDate: new Date(today.getFullYear(), today.getMonth(), 1) });
        this._selectDate(today);
    }
    /** 日期是否落在合法范围内 */
    _isInValidRange(date) {
        const { validRange } = this.props;
        if (!validRange)
            return true;
        const [start, end] = validRange;
        const cmp = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        return cmp >= s && cmp <= e;
    }
    /** 选择某天 */
    _selectDate(date) {
        if (!this._isInValidRange(date))
            return;
        this.setState({ selectedDate: date });
        this.props.onSelect?.(date);
    }
    /** 日期唯一键 */
    _dateKey(d) {
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }
    /** 渲染头部（可自定义） */
    _renderHeader() {
        if (this.props.headerRender) {
            return this.props.headerRender(this.state.viewDate, this.props.mode || 'month');
        }
        const year = this.state.viewDate.getFullYear();
        const month = this.state.viewDate.getMonth();
        return h('div', { class: 'calendar__header' }, h('div', { class: 'calendar__nav' }, h('button', { type: 'button', class: 'calendar__btn calendar__btn--year', onClick: () => this._changeYear(-1) }, '«'), h('button', { type: 'button', class: 'calendar__btn calendar__btn--month', onClick: () => this._changeMonth(-1) }, '‹')), h('div', { class: 'calendar__title' }, h('span', { class: 'calendar__title-year' }, `${year}年`), h('span', { class: 'calendar__title-month' }, MONTH_NAMES[month])), h('div', { class: 'calendar__nav' }, h('button', { type: 'button', class: 'calendar__btn calendar__btn--month', onClick: () => this._changeMonth(1) }, '›'), h('button', { type: 'button', class: 'calendar__btn calendar__btn--year', onClick: () => this._changeYear(1) }, '»')));
    }
    /** 渲染月视图：7 列 × 6 行 网格 */
    _renderMonthView() {
        const viewDate = this.state.viewDate;
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const today = new Date();
        const todayKey = this._dateKey(today);
        const selectedKey = this.state.selectedDate ? this._dateKey(this.state.selectedDate) : null;
        // 当月起始星期与天数
        const startWeekday = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        const cells = [];
        // 上月填充
        for (let i = startWeekday - 1; i >= 0; i--) {
            cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), inMonth: false });
        }
        // 当月
        for (let d = 1; d <= daysInMonth; d++) {
            cells.push({ date: new Date(year, month, d), inMonth: true });
        }
        // 下月填充至 42 格（6 行）
        while (cells.length < 42) {
            const last = cells[cells.length - 1].date;
            cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false });
        }
        return h('div', { class: 'calendar__body' }, h('div', { class: 'calendar__weekdays' }, ...WEEK_DAYS.map((w) => h('div', { class: 'calendar__weekday' }, w))), h('div', { class: 'calendar__cells' }, ...cells.map((cell) => {
            const dateKey = this._dateKey(cell.date);
            const isToday = dateKey === todayKey;
            const isSelected = dateKey === selectedKey;
            const valid = this._isInValidRange(cell.date);
            const classes = [
                'calendar__cell',
                !cell.inMonth && 'calendar__cell--other-month',
                isToday && 'calendar__cell--today',
                isSelected && 'calendar__cell--selected',
                !valid && 'calendar__cell--disabled',
            ].filter(Boolean).join(' ');
            // 自定义单元格渲染
            const inner = this.props.dateCellRender
                ? this.props.dateCellRender(cell.date)
                : h('div', { class: 'calendar__date' }, cell.date.getDate());
            return h('div', {
                class: classes,
                role: 'gridcell',
                tabindex: valid ? '0' : '-1',
                'aria-selected': String(isSelected),
                'aria-disabled': String(!valid),
                onClick: () => valid && this._selectDate(cell.date),
                onKeyDown: (e) => {
                    if (!valid)
                        return;
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this._selectDate(cell.date);
                    }
                },
            }, inner);
        })));
    }
    render() {
        const { fullscreen = true, mode = 'month' } = this.props;
        const classes = [
            'calendar',
            `calendar--${mode}`,
            fullscreen ? 'calendar--fullscreen' : 'calendar--mini',
        ].join(' ');
        return h('div', { class: classes }, this._renderHeader(), mode === 'month' && this._renderMonthView());
    }
}
//# sourceMappingURL=Calendar.js.map