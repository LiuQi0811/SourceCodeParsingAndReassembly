// Transfer.js —— 穿梭框（参考 antd Transfer）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

const DEFAULT_FILTER = (input, item) => (item.title || '').toLowerCase().includes(String(input).toLowerCase());

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
  initialState() {
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
  _sourceData() {
    const target = new Set(this.state.targetKeys);
    return (this.props.dataSource || [])
      .filter((item) => !target.has(item.key))
      .filter((item) => this._filter(this.state.sourceSearch, item));
  }

  /** 右侧数据 = 在 targetKeys 的项 */
  _targetData() {
    const target = new Set(this.state.targetKeys);
    return (this.props.dataSource || [])
      .filter((item) => target.has(item.key))
      .filter((item) => this._filter(this.state.targetSearch, item));
  }

  _filter(input, item) {
    if (!this.props.showSearch || !input) return true;
    const fn = this.props.filterOption || DEFAULT_FILTER;
    return fn(input, item);
  }

  _toggle(side, key, checked) {
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
  _move(direction) {
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

  _renderItem(item, side) {
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

  _renderList(side, data, search) {
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
        h('span', { class: 'transfer__list-title' }, `${selectedKeys(selectedCount, data.filter(i=>!i.disabled).length)} ${title}`),
      ),
      showSearch && h('div', { class: 'transfer__search' },
        h('input', {
          type: 'text', class: 'transfer__search-input',
          placeholder: '搜索', value: search,
          onInput: (e) => this.setState({ [side === 'source' ? 'sourceSearch' : 'targetSearch']: e.target.value }),
        }),
      ),
      h('ul', { class: 'transfer__list-body' },
        ...data.map((item) => this._renderItem(item, side)),
        data.length === 0 && h('li', { class: 'transfer__empty' }, '无数据'),
      ),
    );
  }

  render() {
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

  getTargetKeys() { return [...this.state.targetKeys]; }
  setTargetKeys(keys) { this.setState({ targetKeys: [...keys] }); }
}

/** 拼接选中计数：{selected}/{total} */
function selectedKeys(selected, total) {
  return `${selected}/${total}`;
}
