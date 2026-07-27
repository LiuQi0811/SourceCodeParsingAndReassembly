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
    // 直接更新 state 字段，不触发 setState/rerender：
    // setState 会触发 _rerender 重建整个 Transfer DOM（两侧列表 + 操作按钮 + 搜索框），
    // 导致正在交互的 item 被销毁重建 → 闪屏。
    this.state[setKey] = next;
    this._syncToggleDom(side, key);
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
    // 直接更新三个 state 字段，不触发 setState/rerender，避免重建整个 Transfer 闪屏。
    this.state.targetKeys = targetKeys;
    this.state.sourceSelected = new Set();
    this.state.targetSelected = new Set();
    // 复用已有的 _refreshList 重建两侧列表 body（局部重建，搜索框不失焦）
    this._refreshList('source');
    this._refreshList('target');
    this._syncOperationButtons();
    this.props.onChange?.(targetKeys, moveKeys, direction);
  }

  /** 同步单个 item 勾选状态：切 li/checkbox 的 is-checked + header 计数 + 操作按钮 */
  _syncToggleDom(side, key) {
    if (!this.el) return;
    const listEl = this._getListEl(side);
    if (!listEl) return;
    const setKey = side === 'source' ? 'sourceSelected' : 'targetSelected';
    const isChecked = this.state[setKey].has(key);
    const itemEl = listEl.querySelector(`.transfer__item[data-key="${key}"]`);
    if (itemEl) {
      itemEl.classList.toggle('is-checked', isChecked);
      const checkbox = itemEl.querySelector(':scope > .transfer__checkbox');
      if (checkbox) checkbox.classList.toggle('is-checked', isChecked);
    }
    this._syncHeaderCount(side);
    this._syncOperationButtons();
  }

  /** 取某侧列表根元素（source 为第 0 个，target 为第 1 个） */
  _getListEl(side) {
    if (!this.el) return null;
    const lists = this.el.querySelectorAll('.transfer__list');
    return lists[side === 'source' ? 0 : 1] || null;
  }

  /** 同步某侧 header 选中计数文本 */
  _syncHeaderCount(side) {
    const listEl = this._getListEl(side);
    if (!listEl) return;
    const titleEl = listEl.querySelector('.transfer__list-title');
    if (!titleEl) return;
    const title = (this.props.titles || ['源', '目标'])[side === 'source' ? 0 : 1];
    const data = side === 'source' ? this._sourceData() : this._targetData();
    const selectedCount = side === 'source' ? this.state.sourceSelected.size : this.state.targetSelected.size;
    titleEl.textContent = `${selectedKeys(selectedCount, data.filter((i) => !i.disabled).length)} ${title}`;
  }

  /** 同步操作按钮 is-disabled 状态 */
  _syncOperationButtons() {
    if (!this.el) return;
    const canToRight = this.state.sourceSelected.size > 0;
    const canToLeft = this.state.targetSelected.size > 0;
    const buttons = this.el.querySelectorAll('.transfer__btn');
    if (buttons[0]) {
      buttons[0].classList.toggle('is-disabled', !canToRight);
      buttons[0].disabled = !canToRight;
    }
    if (buttons[1]) {
      buttons[1].classList.toggle('is-disabled', !canToLeft);
      buttons[1].disabled = !canToLeft;
    }
  }

  _renderItem(item, side) {
    const selected = side === 'source' ? this.state.sourceSelected.has(item.key) : this.state.targetSelected.has(item.key);
    const custom = this.props.render?.(item);
    return h('li', {
      class: ['transfer__item', item.disabled && 'is-disabled', selected && 'is-checked'].filter(Boolean).join(' '),
      'data-key': item.key,
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
            // 直接更新 state 字段，不触发 setState/rerender（避免重建整个 Transfer 闪屏）。
            // 复用 _refreshList 批量重建该侧列表 body + header 计数。
            this.state[setKey] = next;
            this._refreshList(side);
            this._syncOperationButtons();
          },
        }),
        h('span', { class: 'transfer__list-title' }, `${selectedKeys(selectedCount, data.filter(i=>!i.disabled).length)} ${title}`),
      ),
      showSearch && h('div', { class: 'transfer__search' },
        h('input', {
          type: 'text', class: 'transfer__search-input',
          placeholder: '搜索', value: search,
          // 直接改 state + 只刷新对应侧列表，不调 setState 重建整个 Transfer（否则搜索框失焦）
          onInput: (e) => {
            const key = side === 'source' ? 'sourceSearch' : 'targetSearch';
            this.state[key] = e.target.value;
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
  _refreshList(side) {
    if (!this.el) return;
    // 两块列表（source/target）按顺序出现，operation 是兄弟节点不影响索引
    const lists = this.el.querySelectorAll('.transfer__list');
    const listEl = lists[side === 'source' ? 0 : 1];
    if (!listEl) return;
    const data = side === 'source' ? this._sourceData() : this._targetData();
    const body = listEl.querySelector('.transfer__list-body');
    if (!body) return;
    body.innerHTML = '';
    data.forEach((item) => body.appendChild(this._renderItem(item, side)));
    if (data.length === 0) {
      body.appendChild(h('li', { class: 'transfer__empty' }, '无数据'));
    }
    // 同步 header 选中计数
    const titleEl = listEl.querySelector('.transfer__list-title');
    if (titleEl) {
      const title = (this.props.titles || ['源', '目标'])[side === 'source' ? 0 : 1];
      const selectedCount = side === 'source' ? this.state.sourceSelected.size : this.state.targetSelected.size;
      titleEl.textContent = `${selectedKeys(selectedCount, data.filter((i) => !i.disabled).length)} ${title}`;
    }
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
