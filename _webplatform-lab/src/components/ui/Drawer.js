// Drawer.js —— 抽屉组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { _lockBody, _unlockBody } from './Modal.js';

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
    if (this.state.open) {
      _lockBody();
      this._bindEsc();
    }
  }

  componentWillUnmount() {
    this._unbindEsc();
    if (this.state.open) _unlockBody();
  }

  _bindEsc() {
    if (this._escHandler) return;
    this._escHandler = (e) => { if (e.key === 'Escape' && this.state.open) this.close(); };
    document.addEventListener('keydown', this._escHandler);
  }

  _unbindEsc() {
    if (!this._escHandler) return;
    document.removeEventListener('keydown', this._escHandler);
    this._escHandler = null;
  }

  open() {
    if (this.state.open) return;
    this.setState({ open: true });
    // 仅在已挂载时加锁；未挂载时由 mount()->componentDidMount 按 state.open 加锁，
    // 避免 open() 与 componentDidMount 重复计数导致 close() 后 body 仍被锁。
    if (this._mounted) {
      _lockBody();
      this._bindEsc();
    }
    this.props.onOpen?.();
  }

  close() {
    if (!this.state.open) return;
    this.setState({ open: false });
    _unlockBody();
    this._unbindEsc();
    this.props.onClose?.();
  }
}
