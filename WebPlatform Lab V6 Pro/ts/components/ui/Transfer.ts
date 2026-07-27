// Transfer.ts —— 穿梭框（参考 antd Transfer）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import type { Props, State } from '../../core/types.js';

export interface TransferItem {
  key: string;
  title: string;
  description?: string;
  disabled?: boolean;
}

export interface TransferProps extends Props {
  dataSource?: TransferItem[];
  targetKeys?: string[];
  selectedKeys?: string[];
  onChange?: (targetKeys: string[], moveKeys: string[], direction: 'right' | 'left') => void;
  onSelectChange?: (sourceSelectedKeys: string[], targetSelectedKeys: string[]) => void;
  titles?: [string, string];
  operations?: [string, string];
  showSearch?: boolean;
  filterOption?: (input: string, item: TransferItem) => boolean;
  render?: (item: TransferItem) => Node | string;
  listStyle?: Record<string, string>;
}

export interface TransferState extends State {
  targetKeys: string[];
  sourceSelected: Set<string>;
  targetSelected: Set<string>;
  sourceSearch: string;
  targetSearch: string;
}

const DEFAULT_FILTER = (input: string, item: TransferItem): boolean =>
  (item.title || '').toLowerCase().includes(String(input).toLowerCase());

/**
 * 穿梭框
 * props:
 *   - dataSource: Array<{ key, title, description, disabled }>
 *   - targetKeys: Array<string>（已移至右侧的 key）
 *   - selectedKeys: Array<string>（当前勾选的 key）
 *   - onChange: (targetKeys, moveKeys, direction) => void
 *   - onSelectChange: (sourceSelectedKeys, targetSelectedKeys) => void
 *   - titles: [string, string]（默认 ['源', '目标']）
 *   - operations: [string, string]（默认 ['>', '<']）
 *   - showSearch: boolean
 *   - filterOption: (input, item) => boolean
 *   - render: (item) => DOM | string（自定义列表项渲染）
 *   - listStyle: object
 */
export class Transfer extends Component {
  declare props: TransferProps;
  declare state: TransferState;

  initialState(): TransferState {
    return {
      targetKeys: [...(this.props.targetKeys || [])],
      // 拆分为左侧、右侧各自选中
      sourceSelected: new Set(),
      targetSelected: new Set(),
      sourceSearch: '',
      targetSearch: '',
    };
  }

  /** 左侧数据 = 不在 targetKeys 的项 */
  _sourceData(): TransferItem[] {
    const target = new Set(this.state.targetKeys);
    return (this.props.dataSource || [])
      .filter((item) => !target.has(item.key))
      .filter((item) => this._filter(this.state.sourceSearch, item));
  }

  /** 右侧数据 = 在 targetKeys 的项 */
  _targetData(): TransferItem[] {
    const target = new Set(this.state.targetKeys);
    return (this.props.dataSource || [])
      .filter((item) => target.has(item.key))
      .filter((item) => this._filter(this.state.targetSearch, item));
  }

  _filter(input: string, item: TransferItem): boolean {
    if (!this.props.showSearch || !input) return true;
    const fn = this.props.filterOption || DEFAULT_FILTER;
    return fn(input, item);
  }

  _toggle(side: 'source' | 'target', key: string, checked: boolean): void {
    const setKey = side === 'source' ? 'sourceSelected' : 'targetSelected';
    const next = new Set(this.state[setKey]);
    if (checked) next.add(key); else next.delete(key);
    this.setState({ [setKey]: next });
    this.props.onSelectChange?.(
      Array.from(this.state.sourceSelected),
      Array.from(this.state.targetSelected),
    );
  }

  /** 把左侧选中的移到右侧（direction='right'）或反之 */
  _move(direction: 'right' | 'left'): void {
    const fromSet = direction === 'right' ? this.state.sourceSelected : this.state.targetSelected;
    if (!fromSet.size) return;
    const moveKeys = Array.from(fromSet);
    const nextTarget = new Set(this.state.targetKeys);
    moveKeys.forEach((k) => (direction === 'right' ? nextTarget.add(k) : nextTarget.delete(k)));
    const targetKeys = Array.from(nextTarget);
    this.setState({
      targetKeys,
      sourceSelected: new Set(),
      targetSelected: new Set(),
    });
    this.props.onChange?.(targetKeys, moveKeys, direction);
  }

  _renderItem(item: TransferItem, side: 'source' | 'target'): Node {
    const selected = side === 'source' ? this.state.sourceSelected.has(item.key) : this.state.targetSelected.has(item.key);
    const custom = this.props.render?.(item);
    return h('li', {
      class: ['transfer__item', item.disabled && 'is-disabled', selected && 'is-checked'].filter(Boolean).join(' '),
      onClick: () => { if (!item.disabled) this._toggle(side, item.key, !selected); },
    },
      h('span', {
        class: ['transfer__checkbox', selected && 'is-checked', item.disabled && 'is-disabled'].filter(Boolean).join(' '),
      }),
      h('span', { class: 'transfer__item-content' },
        custom != null ? custom : h('span', { class: 'transfer__item-label' },
          h('span', { class: 'transfer__item-title' }, item.title),
          item.description && h('span', { class: 'transfer__item-desc' }, item.description),
        ),
      ),
    );
  }

  _renderList(side: 'source' | 'target', data: TransferItem[], search: string): Node {
    const { showSearch, listStyle } = this.props;
    const title = (this.props.titles || ['源', '目标'])[side === 'source' ? 0 : 1];
    const selectedCount = side === 'source' ? this.state.sourceSelected.size : this.state.targetSelected.size;
    return h('div', { class: 'transfer__list', style: listStyle || null },
      h('div', { class: 'transfer__list-header' },
        h('span', { class: 'transfer__checkbox',
          onClick: () => {
            const setKey = side === 'source' ? 'sourceSelected' : 'targetSelected';
            const allKeys = data.filter((i) => !i.disabled).map((i) => i.key);
            const allSelected = allKeys.length > 0 && allKeys.every((k) => this.state[setKey].has(k));
            const next = new Set(allSelected ? [] : allKeys);
            this.setState({ [setKey]: next });
          },
        }),
        h('span', { class: 'transfer__list-title' }, `${selectedKeys(selectedCount, data.filter((i) => !i.disabled).length)} ${title}`),
      ),
      showSearch && h('div', { class: 'transfer__search' },
        h('input', {
          type: 'text', class: 'transfer__search-input',
          placeholder: '搜索', value: search,
          // 直接改 state + 只刷新对应侧列表，不调 setState 重建整个 Transfer（否则搜索框失焦）
          onInput: (e: Event) => {
            const key = side === 'source' ? 'sourceSearch' : 'targetSearch';
            (this.state as any)[key] = (e.target as HTMLInputElement).value;
            this._refreshList(side);
          },
        }),
      ),
      h('ul', { class: 'transfer__list-body' },
        ...data.map((item) => this._renderItem(item, side)),
        data.length === 0 && h('li', { class: 'transfer__empty' }, '无数据'),
      ),
    );
  }

  /** 重新渲染某侧列表项（搜索框 onInput 时不重建整个 Transfer，避免搜索框失焦） */
  _refreshList(side: 'source' | 'target'): void {
    if (!this.el) return;
    // 两块列表（source/target）按顺序出现，operation 是兄弟节点不影响索引
    const lists = (this.el as Element).querySelectorAll<HTMLElement>('.transfer__list');
    const listEl = lists[side === 'source' ? 0 : 1];
    if (!listEl) return;
    const data = side === 'source' ? this._sourceData() : this._targetData();
    const body = listEl.querySelector<HTMLElement>('.transfer__list-body');
    if (!body) return;
    body.innerHTML = '';
    data.forEach((item) => body.appendChild(this._renderItem(item, side) as Node));
    if (data.length === 0) {
      body.appendChild(h('li', { class: 'transfer__empty' }, '无数据') as Node);
    }
    // 同步 header 选中计数
    const titleEl = listEl.querySelector<HTMLElement>('.transfer__list-title');
    if (titleEl) {
      const title = (this.props.titles || ['源', '目标'])[side === 'source' ? 0 : 1];
      const selectedCount = side === 'source' ? this.state.sourceSelected.size : this.state.targetSelected.size;
      titleEl.textContent = `${selectedKeys(selectedCount, data.filter((i) => !i.disabled).length)} ${title}`;
    }
  }

  render(): Node | string {
    const sourceData = this._sourceData();
    const targetData = this._targetData();
    const ops = this.props.operations || ['>', '<'];
    const canToRight = this.state.sourceSelected.size > 0;
    const canToLeft = this.state.targetSelected.size > 0;
    return h('div', { class: 'transfer' },
      this._renderList('source', sourceData, this.state.sourceSearch),
      h('div', { class: 'transfer__operation' },
        h('button', {
          type: 'button',
          class: ['transfer__btn', !canToRight && 'is-disabled'].filter(Boolean).join(' '),
          disabled: !canToRight,
          onClick: () => this._move('right'),
        }, ops[0]),
        h('button', {
          type: 'button',
          class: ['transfer__btn', !canToLeft && 'is-disabled'].filter(Boolean).join(' '),
          disabled: !canToLeft,
          onClick: () => this._move('left'),
        }, ops[1]),
      ),
      this._renderList('target', targetData, this.state.targetSearch),
    );
  }

  getTargetKeys(): string[] { return [...this.state.targetKeys]; }
  setTargetKeys(keys: string[]): void { this.setState({ targetKeys: [...keys] }); }
}

/** 拼接选中计数：{selected}/{total} */
function selectedKeys(selected: number, total: number): string {
  return `${selected}/${total}`;
}
