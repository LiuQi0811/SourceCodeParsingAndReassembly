// Table.ts —— 数据表格（排序 / 分页）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import type { Props, State } from '../../core/types.js';

export interface TableColumn {
  key: string;
  title: string;
  dataIndex: string;
  align?: 'left' | 'right' | 'center';
  sorter?: (a: any, b: any) => number;
  render?: (value: any, row: any) => Node | string;
}

export interface TableProps extends Props {
  columns?: TableColumn[];
  pagination?: boolean;
  rowKey?: string;
  dataSource?: any[];
  pageSize?: number;
  onRowClick?: (row: any, e: MouseEvent) => void;
}

export interface TableState extends State {
  data: any[];
  sortKey: string | null;
  sortOrder: 'asc' | 'desc' | null; // 'asc' | 'desc'
  page: number;
  pageSize: number;
}

export class Table extends Component {
  declare props: TableProps;
  declare state: TableState;

  initialState(): TableState {
    return {
      data: [...(this.props.dataSource || [])],
      sortKey: null,
      sortOrder: null,
      page: 1,
      pageSize: this.props.pageSize ?? 10,
    };
  }

  render(): Node | string {
    const { columns = [], pagination = true, rowKey = 'id' } = this.props;
    let data = [...this.state.data];

    // 排序
    if (this.state.sortKey && this.state.sortOrder) {
      const col = columns.find((c) => c.key === this.state.sortKey);
      if (col?.sorter) {
        const sorter = col.sorter;
        data.sort((a, b) => sorter(a, b) * (this.state.sortOrder === 'asc' ? 1 : -1));
      }
    }

    // 分页
    const total = data.length;
    const totalPages = Math.max(1, Math.ceil(total / this.state.pageSize));
    const currentPage = Math.min(this.state.page, totalPages);
    const pagedData = pagination
      ? data.slice((currentPage - 1) * this.state.pageSize, currentPage * this.state.pageSize)
      : data;

    return h('div', { class: 'table' },
      h('table', {},
        h('thead', {}, h('tr', {},
          ...columns.map((col) => {
            const sortable = !!col.sorter;
            const isAsc = this.state.sortKey === col.key && this.state.sortOrder === 'asc';
            const isDesc = this.state.sortKey === col.key && this.state.sortOrder === 'desc';
            return h('th', {
              class: [
                sortable && 'is-sortable',
                isAsc && 'is-asc',
                isDesc && 'is-desc',
              ].filter(Boolean).join(' '),
              onClick: () => { if (sortable) this._toggleSort(col.key); },
            },
              h('span', {}, col.title),
              sortable && h('span', { class: 'sort-icon' }, isAsc ? '▲' : isDesc ? '▼' : '⇅'),
            );
          }),
        )),
        h('tbody', {},
          ...pagedData.map((row) => h('tr', {
            key: row[rowKey],
            onClick: (e: MouseEvent) => this.props.onRowClick?.(row, e),
          },
            ...columns.map((col) => {
              const value = col.render ? col.render(row[col.dataIndex], row) : row[col.dataIndex];
              return h('td', { style: col.align ? { textAlign: col.align } : null }, value ?? '—');
            }),
          )),
        ),
      ),
      pagination && total > this.state.pageSize && this._renderPagination(currentPage, totalPages, total),
    );
  }

  _toggleSort(key: string): void {
    let order: 'asc' | 'desc' | null;
    if (this.state.sortKey === key) {
      order = this.state.sortOrder === 'asc' ? 'desc' : this.state.sortOrder === 'desc' ? null : 'asc';
    } else {
      order = 'asc';
    }
    this.setState({ sortKey: order ? key : null, sortOrder: order });
  }

  _renderPagination(current: number, total: number, totalItems: number): Node {
    const btn = (label: string | number, disabled: boolean, onClick: () => void): Node => h('button', {
      type: 'button',
      class: `btn btn--sm ${current === label ? 'btn--primary' : ''}`,
      disabled,
      onClick,
    }, String(label));

    const pages: Node[] = [];
    const maxBtns = 5;
    let start = Math.max(1, current - 2);
    let end = Math.min(total, start + maxBtns - 1);
    start = Math.max(1, end - maxBtns + 1);

    if (start > 1) { pages.push(btn(1, false, () => this.setState({ page: 1 }))); if (start > 2) pages.push(h('span', {}, '…')); }
    for (let i = start; i <= end; i++) pages.push(btn(i, false, () => this.setState({ page: i })));
    if (end < total) { if (end < total - 1) pages.push(h('span', {}, '…')); pages.push(btn(total, false, () => this.setState({ page: total }))); }

    return h('div', { class: 'flex items-center justify-between p-md' },
      h('span', { class: 'fs-sm text-tertiary' }, `共 ${totalItems} 条`),
      h('div', { class: 'flex items-center gap-xs' },
        btn('‹', current === 1, () => this.setState({ page: current - 1 })),
        ...pages,
        btn('›', current === total, () => this.setState({ page: current + 1 })),
      ),
    );
  }

  setData(data: any[]): void { this.setState({ data: [...data], page: 1 }); }
}
