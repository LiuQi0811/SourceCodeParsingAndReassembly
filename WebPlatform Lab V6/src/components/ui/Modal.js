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

// —— 焦点陷阱：弹层打开后把焦点收进弹层、Tab 在内部循环、关闭后归还 ——
// 可见且可聚焦元素的选择器（与 WAI-ARIA 实践一致）
const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'textarea:not([disabled])',
  'input:not([disabled])', 'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * 在容器内查找可聚焦元素（按 DOM 顺序）。
 * @param {HTMLElement} container
 * @returns {HTMLElement[]}
 */
function _findFocusable(container) {
  if (!container) return [];
  const getCS = (typeof window !== 'undefined' && window.getComputedStyle)
    ? (el) => window.getComputedStyle(el)
    : null;
  return Array.from(container.querySelectorAll(FOCUSABLE)).filter((el) => {
    if (el.hasAttribute('disabled')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    // 排除 display:none / visibility:hidden
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0 && getCS) {
      const cs = getCS(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    }
    return true;
  });
}

/**
 * 给弹层（Modal/Drawer）安装焦点陷阱。
 * 返回一个清理函数：解开 keydown 监听并把焦点归还给触发元素。
 *
 * @param {HTMLElement} dialogEl 弹层根节点（含 role=dialog）
 * @param {HTMLElement} triggerEl 打开弹层的触发元素（关闭后归还焦点）
 * @returns {() => void} cleanup
 */
export function _trapFocus(dialogEl, triggerEl) {
  if (!dialogEl) return () => {};

  // 1) 进入即聚焦首个可聚焦元素（让读屏/键盘用户立刻处于弹层内）
  const focusables = _findFocusable(dialogEl);
  const initial = focusables[0] || dialogEl;
  // 给容器本身加 tabindex=-1，便于无 focusable 子元素时也能聚焦
  if (!dialogEl.hasAttribute('tabindex')) dialogEl.setAttribute('tabindex', '-1');
  // 推迟到下一帧，避免与挂载期的 layout 冲突
  requestAnimationFrame(() => {
    try { initial.focus(); }
    catch { /* noop */ }
  });

  // 2) Tab 循环：在首/末元素之间往返
  const onKeyDown = (e) => {
    if (e.key !== 'Tab') return;
    const list = _findFocusable(dialogEl);
    if (list.length === 0) {
      e.preventDefault();
      dialogEl.focus();
      return;
    }
    const first = list[0];
    const last = list[list.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      // Shift+Tab：在首元素上 → 跳到末元素
      if (active === first || !dialogEl.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab：在末元素上 → 跳回首元素
      if (active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  dialogEl.addEventListener('keydown', onKeyDown);

  // 3) 清理：解绑监听 + 归还焦点给触发元素
  return () => {
    dialogEl.removeEventListener('keydown', onKeyDown);
    try { triggerEl?.focus?.(); }
    catch { /* noop */ }
  };
}

export class Modal extends Component {
  initialState() { return { open: !!this.props.open }; }

  render() {
    // footer 语义：
    //   undefined（未传）→ 渲染默认 [取消, 确定] 按钮
    //   null             → 不渲染 footer
    //   数组/节点         → 自定义 footer
    const { title, children, footer, width = 520, maskClosable = true } = this.props;
    if (!this.state.open) return h('div', { style: { display: 'none' } });

    const footerEl = footer === null
      ? null
      : h('div', { class: 'modal__foot' },
          footer || [
            h('button', { type: 'button', class: 'btn', onClick: () => this.close() }, '取消'),
            h('button', { type: 'button', class: 'btn btn--primary', onClick: () => this._onOk() }, '确定'),
          ],
        );

    return h('div', { class: 'modal-mask', onClick: (e) => {
      if (maskClosable && e.target === e.currentTarget) this.close();
    }},
      h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true',
        'aria-label': typeof title === 'string' ? title : undefined,
        style: { width: `${width}px` } },
        h('div', { class: 'modal__head' },
          h('span', {}, title),
          h('button', { type: 'button', class: 'modal__close', 'aria-label': '关闭',
            onClick: () => this.close() }, '×'),
        ),
        h('div', { class: 'modal__body' }, children),
        footerEl,
      ),
    );
  }

  componentDidMount() {
    // 初始就处于打开状态时锁定 body 与 ESC、装焦点陷阱
    if (this.state.open) {
      _lockBody();
      this._bindEsc();
      this._installTrap();
    }
  }

  componentWillUnmount() {
    // 安全兜底：卸载时确保释放锁与监听
    this._unbindEsc();
    this._teardownTrap();
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

  /** 安装焦点陷阱：记录触发元素 + 绑定 Tab 循环 */
  _installTrap() {
    // 只在首次安装时记录触发元素，避免重复 open 不覆盖
    if (!this._triggerEl) {
      this._triggerEl = document.activeElement;
    }
    // 旧的（若有）先清掉再装新的，避免重复绑定
    this._teardownTrap();
    const dialogEl = this.el?.querySelector('[role="dialog"]') || this.el;
    this._trapCleanup = _trapFocus(dialogEl, this._triggerEl);
  }

  _teardownTrap() {
    if (this._trapCleanup) {
      this._trapCleanup();
      this._trapCleanup = null;
    }
  }

  open() {
    if (this.state.open) return;
    this.setState({ open: true });
    // 仅在已挂载时加锁；未挂载时由 mount()->componentDidMount 按 state.open 加锁，
    // 避免 open() 与 componentDidMount 重复计数导致 close() 后 body 仍被锁。
    if (this._mounted) {
      _lockBody();
      this._bindEsc();
      // 重渲染后 this.el 已是新节点，需在下一帧装陷阱（DOM 已就位）
      requestAnimationFrame(() => this._installTrap());
    }
    this.props.onOpen?.();
  }

  close() {
    if (!this.state.open) return;
    this.setState({ open: false });
    _unlockBody();
    this._unbindEsc();
    this._teardownTrap();
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
        h('button', { type: 'button', class: 'btn', onClick: () => finish(false) }, options.cancelText || '取消'),
        h('button', { type: 'button', class: `btn ${options.danger ? 'btn--danger' : 'btn--primary'}`, onClick: () => finish(true) }, options.okText || '确定'),
      ],
      children: options.content,
    });
    modal.open();
    modal.mount(document.body);
  });
}
