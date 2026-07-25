// Tabs.js —— 标签页组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

export class Tabs extends Component {
  initialState() { return { active: this.props.active ?? this.props.items?.[0]?.key }; }

  render() {
    const { items = [] } = this.props;
    const activeItem = items.find((it) => it.key === this.state.active) || items[0];

    return h('div', { class: 'tabs' },
      h('div', { class: 'tabs__nav', role: 'tablist' },
        ...items.map((it) => h('div', {
          class: `tabs__tab ${it.key === this.state.active ? 'is-active' : ''}`,
          role: 'tab',
          onClick: () => {
            this.setState({ active: it.key });
            this.props.onChange?.(it.key);
          },
        }, it.label)),
      ),
      h('div', { class: 'tabs__panel' },
        activeItem && (typeof activeItem.content === 'function' ? activeItem.content() : activeItem.content),
      ),
    );
  }

  setActive(key) { this.setState({ active: key }); }
}
