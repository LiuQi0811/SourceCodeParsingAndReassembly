// Modal.js —— 模态框组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

// body 滚动锁引用计数：支持多个 Modal/Drawer 同时打开，
// 只有最后一个关闭时才恢复 body 滚动，避免误判。
let _bodyLockCount = 0;
export function _lockBody() {
  _bodyLockCount += 1;
  if (_bodyLockCount === 1) document.body.style.overflow = 'hidden';
}
export function _unlockBody() {
  if (_bodyLockCount > 0) _bodyLockCount -= 1;
  if (_bodyLockCount === 0) document.body.style.overflow = '';
}

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
    // 初始就处于打开状态时锁定 body 与 ESC
    if (this.state.open) {
      _lockBody();
      this._bindEsc();
    }
  }

  componentWillUnmount() {
    // 安全兜底：卸载时确保释放锁与监听
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

  _onOk() {
    const result = this.props.onOk?.();
    if (result !== false) this.close();
  }
}

/** 命令式确认弹窗（工厂模式） */
export function confirm(options) {
  return new Promise((resolve) => {
    let settled = false;
    let modal;

    const finish = (val) => {
      if (settled) return;
      settled = true;
      resolve(val);
      // 关闭弹窗（会触发 onClose -> finish，但 settled 已置位，幂等）
      modal.close();
      // 等过渡动画后彻底销毁，移除残留在 body 中的 DOM
      setTimeout(() => { try { modal.destroy(); } catch { /* noop */ } }, 320);
    };

    modal = new Modal({
      title: options.title || '提示',
      width: options.width || 416,
      // 关闭（ESC/点遮罩/×）一律视为取消
      onClose: () => finish(false),
      footer: [
        h('button', { class: 'btn', onClick: () => finish(false) }, options.cancelText || '取消'),
        h('button', { class: `btn ${options.danger ? 'btn--danger' : 'btn--primary'}`, onClick: () => finish(true) }, options.okText || '确定'),
      ],
      children: options.content,
    });
    modal.open();
    modal.mount(document.body);
  });
}
