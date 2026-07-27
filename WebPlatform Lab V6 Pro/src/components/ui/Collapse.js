// Collapse.js —— 折叠面板组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

export class Collapse extends Component {
  initialState() {
    const initial = this.props.activeKey || this.props.defaultActiveKey || [];
    return { activeKeys: new Set(initial) };
  }

  /** 切换某个面板的展开状态 */
  toggle(key) {
    const { accordion = false, onChange } = this.props;
    const next = new Set(this.state.activeKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      // 手风琴模式：仅允许一个展开，先清空其余
      if (accordion) next.clear();
      next.add(key);
    }
    // 直接更新 state 字段，不触发 setState/rerender：
    // setState 会触发 _rerender 重建整个 Collapse DOM，
    // 导致正在交互的面板被销毁重建 → 闪屏。
    this.state.activeKeys = next;
    // 直接操作 DOM 更新视图
    this._syncDom();
    onChange?.(Array.from(next));
  }

  /** 直接操作 DOM 同步展开/折叠状态，不触发 rerender */
  _syncDom() {
    const { items = [] } = this.props;
    if (!this.el) return;
    const itemEls = this.el.querySelectorAll('.collapse__item');
    itemEls.forEach((itemEl, i) => {
      const item = items[i];
      if (!item) return;
      const open = this.state.activeKeys.has(item.key);
      itemEl.classList.toggle('collapse__item--active', open);
      const arrow = itemEl.querySelector('.collapse__arrow');
      if (arrow) arrow.classList.toggle('collapse__arrow--open', open);
      const content = itemEl.querySelector('.collapse__content');
      if (content) content.hidden = !open;
    });
  }

  render() {
    const { items = [] } = this.props;
    return h('div', { class: 'collapse' },
      ...items.map((item) => {
        const open = this.state.activeKeys.has(item.key);
        return h('div', {
          class: ['collapse__item', open && 'collapse__item--active'],
        },
          h('div', {
            class: 'collapse__header',
            onClick: () => {
              if (item.disabled) return;
              this.toggle(item.key);
            },
          },
            h('span', { class: ['collapse__arrow', open && 'collapse__arrow--open'] }, '▶'),
            h('span', { class: 'collapse__label' }, item.label),
          ),
          // 始终渲染 content，用 hidden 属性控制显隐：
          // 这样 toggle 时只需切 hidden 属性，无需重建 DOM（条件渲染会重建）。
          // h() 对 false 值属性会跳过设置，open=true 时 hidden 不生效（可见），
          // open=false 时 hidden=true 生效（隐藏）。
          h('div', { class: 'collapse__content', hidden: !open }, item.children),
        );
      }),
    );
  }
}
