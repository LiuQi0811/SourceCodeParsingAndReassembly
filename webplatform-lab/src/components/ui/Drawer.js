// Drawer.js —— 抽屉组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

export class Drawer extends Component {
  initialState() { return { open: !!this.props.open }; }

  render() {
    const { title, children, width = 420, maskClosable = true } = this.props;
    if (!this.state.open) return h('div', { style: { display: 'none' } });

    return h('div', {},
      h('div', { class: 'drawer-mask', onClick: () => { if (maskClosable) this.close(); }}),
      h('div', { class: 'drawer', role: 'dialog', style: { width: `${width}px` } },
        h('div', { class: 'drawer__head' },
          h('span', {}, title),
          h('span', { class: 'modal__close', onClick: () => this.close() }, '×'),
        ),
        h('div', { class: 'drawer__body' }, children),
      ),
    );
  }

  componentDidMount() {
    document.body.style.overflow = 'hidden';
    this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this._escHandler);
  }

  componentWillUnmount() {
    document.body.style.overflow = '';
    document.removeEventListener('keydown', this._escHandler);
  }

  open() { this.setState({ open: true }); this.props.onOpen?.(); }
  close() { this.setState({ open: false }); this.props.onClose?.(); }
}
