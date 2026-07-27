// Tabs.js —— 标签页组件
// 遵循 WAI-ARIA Tabs 模式：
//   - tablist / tab / tabpanel 三件套
//   - 活动 tab tabindex=0，其余 -1（roving tabindex）
//   - ←/→ 在 tab 间切换，Home/End 跳到首/末
//   - tab 与 panel 通过 aria-controls / aria-labelledby 双向关联
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

export class Tabs extends Component {
  initialState() { return { active: this.props.active ?? this.props.items?.[0]?.key }; }

  render() {
    const { items = [] } = this.props;
    const activeItem = items.find((it) => it.key === this.state.active) || items[0];
    const activeKey = activeItem?.key;

    // 给每个 tab 一个稳定的 id，便于 aria-controls / aria-labelledby 互指
    const baseId = this._id || (this._id = `tabs-${Math.random().toString(36).slice(2, 9)}`);

    return h('div', { class: 'tabs' },
      h('div', { class: 'tabs__nav', role: 'tablist', 'aria-label': this.props.ariaLabel },
        ...items.map((it) => {
          const selected = it.key === activeKey;
          return h('button', {
            type: 'button',
            class: `tabs__tab ${selected ? 'is-active' : ''}`,
            role: 'tab',
            id: `${baseId}-tab-${it.key}`,
            'aria-selected': String(selected),
            'aria-controls': `${baseId}-panel-${it.key}`,
            tabindex: selected ? '0' : '-1',
            onClick: () => this._select(it.key),
            onKeyDown: (e) => this._onTabKeyDown(e, it.key),
          }, it.label);
        }),
      ),
      h('div', {
        class: 'tabs__panel',
        role: 'tabpanel',
        id: `${baseId}-panel-${activeKey}`,
        'aria-labelledby': `${baseId}-tab-${activeKey}`,
        tabindex: '0',
      },
        activeItem && (typeof activeItem.content === 'function' ? activeItem.content() : activeItem.content),
      ),
    );
  }

  _select(key) {
    if (key === this.state.active) return;
    const { items = [] } = this.props;
    const oldKey = this.state.active;
    this.state.active = key;
    // 直接操作 DOM 切换 tab，不触发 setState/rerender
    const baseId = this._id;
    if (this.el && baseId) {
      const oldTab = this.el.querySelector(`#${baseId}-tab-${oldKey}`);
      const newTab = this.el.querySelector(`#${baseId}-tab-${key}`);
      if (oldTab) {
        oldTab.classList.remove('is-active');
        oldTab.setAttribute('aria-selected', 'false');
        oldTab.tabIndex = -1;
      }
      if (newTab) {
        newTab.classList.add('is-active');
        newTab.setAttribute('aria-selected', 'true');
        newTab.tabIndex = 0;
      }
      // 替换 panel 内容
      const panel = this.el.querySelector('.tabs__panel');
      const activeItem = items.find((it) => it.key === key) || items[0];
      if (panel && activeItem) {
        panel.id = `${baseId}-panel-${key}`;
        panel.setAttribute('aria-labelledby', `${baseId}-tab-${key}`);
        panel.replaceChildren(
          typeof activeItem.content === 'function' ? activeItem.content() : activeItem.content
        );
      }
    }
    this.props.onChange?.(key);
  }

  /** 键盘导航：←/→ 切换 tab，Home/End 跳首末，焦点跟随选中项 */
  _onTabKeyDown(e, currentKey) {
    const items = this.props.items || [];
    if (items.length === 0) return;
    const idx = items.findIndex((it) => it.key === currentKey);
    if (idx < 0) return;

    let nextIdx = null;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % items.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + items.length) % items.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = items.length - 1;

    if (nextIdx === null) return;
    e.preventDefault();
    const nextKey = items[nextIdx].key;
    this._select(nextKey);
    // 焦点跟随：不 rerender 后可同步 focus
    const baseId = this._id;
    this.el?.querySelector(`#${baseId}-tab-${nextKey}`)?.focus();
  }

  setActive(key) { this._select(key); }
}
