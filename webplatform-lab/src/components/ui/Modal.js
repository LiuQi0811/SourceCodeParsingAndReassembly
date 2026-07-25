// Modal.js —— 模态框组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

export class Modal extends Component {
  initialState() { return { open: !!this.props.open }; }

  render() {
    const { title, children, footer = null, width = 520, maskClosable = true } = this.props;
    if (!this.state.open) return h('div', { style: { display: 'none' } });

    return h('div', { class: 'modal-mask', onClick: (e) => {
      if (maskClosable && e.target === e.currentTarget) this.close();
    }},
      h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', style: { width: `${width}px` } },
        h('div', { class: 'modal__head' },
          h('span', {}, title),
          h('span', { class: 'modal__close', onClick: () => this.close() }, '×'),
        ),
        h('div', { class: 'modal__body' }, children),
        footer !== null && h('div', { class: 'modal__foot' },
          footer || [
            h('button', { class: 'btn', onClick: () => this.close() }, '取消'),
            h('button', { class: 'btn btn--primary', onClick: () => this._onOk() }, '确定'),
          ],
        ),
      ),
    );
  }

  componentDidMount() {
    // ESC 关闭
    this._escHandler = (e) => { if (e.key === 'Escape' && this.state.open) this.close(); };
    document.addEventListener('keydown', this._escHandler);
    // 锁定 body 滚动
    document.body.style.overflow = 'hidden';
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this._escHandler);
    document.body.style.overflow = '';
  }

  open() { this.setState({ open: true }); }
  close() {
    this.setState({ open: false });
    this.props.onClose?.();
  }

  _onOk() {
    const result = this.props.onOk?.();
    if (result !== false) this.close();
  }
}

/** 命令式确认弹窗（工厂模式） */
export function confirm(options) {
  return new Promise((resolve) => {
    const modal = new Modal({
      title: options.title || '提示',
      width: options.width || 416,
      onOk: () => { resolve(true); return true; },
      onClose: () => resolve(false),
      footer: [
        h('button', { class: 'btn', onClick: () => { modal.close(); resolve(false); } }, options.cancelText || '取消'),
        h('button', { class: `btn ${options.danger ? 'btn--danger' : 'btn--primary'}`, onClick: () => { modal.close(); resolve(true); } }, options.okText || '确定'),
      ],
      children: options.content,
    });
    modal.open();
    modal.mount(document.body);
  });
}
