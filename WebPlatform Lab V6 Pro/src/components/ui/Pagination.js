// Pagination.js —— 分页组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

export class Pagination extends Component {
  initialState() {
    return {
      current: this.props.current ?? 1,
      pageSize: this.props.pageSize ?? 10,
      jumperValue: '',
    };
  }

  /** 跳过 props 同步触发的冗余 rerender。
   *  Pagination 是"半受控"组件：goTo() 内部 setState 更新 state.current（视觉立即变化），
   *  然后 onChange 回调让父组件 setState({page})，父组件 rerender 时把新 page 作为
   *  props.current 传回 Pagination → registerChild 复用并触发 _rerender。
   *  但此时 state.current 已经是最新值，rerender 无意义。
   *  这里检测：若 nextProps.current 与 state.current 一致（且 pageSize 也一致），
   *  说明是"onChange 回流"导致的冗余 rerender，直接跳过。
   *  注意：total 仍需比较，搜索/过滤后 total 变化必须 rerender。 */
  shouldComponentUpdate(nextProps, nextState) {
    if (nextState !== this.state) return true; // 自身 setState 必须更新
    // props 驱动的 rerender：检查 current/pageSize/total 是否真的变了
    if (nextProps.total !== this.props.total) return true;
    if (Number(nextProps.current) !== this.state.current) return true;
    if (Number(nextProps.pageSize) !== this.state.pageSize) return true;
    return false;
  }

  /** 计算需要展示的页码序列（含 '...' 占位） */
  getPageNumbers() {
    const { total = 0 } = this.props;
    const totalPages = Math.max(1, Math.ceil(total / this.state.pageSize));
    const current = this.state.current;
    // 页数较少时全部展示
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    // 展示首尾、当前页及其相邻页，其余用省略号
    const set = new Set([1, totalPages, current, current - 1, current + 1]);
    const sorted = [...set].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
    const result = [];
    for (let i = 0; i < sorted.length; i++) {
      result.push(sorted[i]);
      if (i < sorted.length - 1 && sorted[i + 1] - sorted[i] > 1) result.push('...');
    }
    return result;
  }

  /** 跳转到指定页（自动夹取到有效区间） */
  goTo(page) {
    const { total = 0, onChange } = this.props;
    const totalPages = Math.max(1, Math.ceil(total / this.state.pageSize));
    const next = Math.min(Math.max(1, page), totalPages);
    if (next === this.state.current) return;
    this.setState({ current: next, jumperValue: '' });
    onChange?.(next, this.state.pageSize);
  }

  render() {
    const { total = 0, showTotal, showSizeChanger, showQuickJumper } = this.props;
    const { current, pageSize } = this.state;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const pages = this.getPageNumbers();

    return h('div', { class: 'pagination' },
      showTotal && h('span', { class: 'pagination__total' }, `共 ${total} 条`),
      // 上一页
      h('button', {
        type: 'button',
        class: ['pagination__item', current <= 1 && 'is-disabled'],
        disabled: current <= 1,
        onClick: () => this.goTo(current - 1),
      }, '‹'),
      // 页码按钮
      ...pages.map((p) => p === '...'
        ? h('span', { class: 'pagination__ellipsis' }, '...')
        : h('button', {
            type: 'button',
            class: ['pagination__item', p === current && 'pagination__item--active'],
            onClick: () => this.goTo(p),
          }, String(p)),
      ),
      // 下一页
      h('button', {
        type: 'button',
        class: ['pagination__item', current >= totalPages && 'is-disabled'],
        disabled: current >= totalPages,
        onClick: () => this.goTo(current + 1),
      }, '›'),
      // 每页条数选择器
      showSizeChanger && h('select', {
        class: 'pagination__size-changer',
        onChange: (e) => {
          const ps = Number(e.target.value);
          this.setState({ pageSize: ps, current: 1 });
          this.props.onChange?.(1, ps);
        },
      }, [10, 20, 50, 100].map((n) =>
        h('option', { value: n, selected: n === pageSize }, `${n} 条/页`),
      )),
      // 快速跳转
      showQuickJumper && h('span', { class: 'pagination__jumper-wrap' },
        '跳至',
        h('input', {
          class: 'pagination__jumper',
          value: this.state.jumperValue,
          onInput: (e) => { this.state.jumperValue = e.target.value; },
          onKeydown: (e) => {
            if (e.key === 'Enter') {
              const p = parseInt(this.state.jumperValue, 10);
              if (!Number.isNaN(p)) this.goTo(p);
            }
          },
        }),
        '页',
      ),
    );
  }
}
