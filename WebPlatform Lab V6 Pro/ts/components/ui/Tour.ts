// Tour.ts —— 漫游引导组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { mountDropdown } from './_portal.js';
import type { Props, State } from '../../core/types.js';

type TourPlacement = 'top' | 'bottom' | 'left' | 'right';

/** 单步引导定义 */
export interface TourStep {
  title?: Node | string;
  description?: Node | string;
  cover?: Node | string;
  target?: string | HTMLElement | (() => HTMLElement | null);
  placement?: TourPlacement;
}

export interface TourProps extends Props {
  open?: boolean;
  current?: number;
  steps?: TourStep[];
  arrow?: boolean;
  type?: string;
  onClose?: (current: number) => void;
}

export interface TourState extends State {
  current: number;
}

export class Tour extends Component {
  declare props: TourProps;
  declare state: TourState;
  _card: HTMLElement | null = null;
  _portalRAF: number | null = null;
  _portalCleanup: (() => void) | null = null;

  initialState(): TourState { return { current: this.props.current ?? 0 }; }

  componentDidMount(): void {
    // 键盘支持：Esc 关闭、← 上一步、→ 下一步
    this.on(window, 'keydown', (e: Event) => {
      const ke = e as KeyboardEvent;
      if (!this.props.open) return;
      if (ke.key === 'Escape') this._handleClose();
      else if (ke.key === 'ArrowLeft') this._handlePrev();
      else if (ke.key === 'ArrowRight') this._handleNext();
    });
  }

  componentWillUnmount(): void {
    this._closePortal();
  }

  /** 把引导卡片 portal 到 document.body，避免被祖先 overflow:hidden 裁剪 */
  _openPortal(): void {
    this._closePortal();
    this._portalRAF = requestAnimationFrame(() => {
      if (!this.props.open || !this._card || !this._card.isConnected) return;
      const step = this.props.steps?.[Math.min(this.state.current, (this.props.steps?.length || 0) - 1)];
      const targetEl = this._getTargetEl(step);
      const placement = step?.placement || 'bottom';
      const card = this._card;
      if (targetEl) {
        // 有目标：portal 到 body 并按目标定位（支持 top/bottom 翻转）
        this._portalCleanup = mountDropdown(card, targetEl, {
          placement: placement === 'top' ? 'top' : 'bottom',
          gap: 12,
          zIndex: 1001,
        });
        // mountDropdown 默认按 trigger 左上对齐，这里按 placement 精细调整
        this._positionCard(card, targetEl, placement);
      } else {
        // 无目标：portal 到 body 并居中显示
        if (card.parentElement !== document.body) {
          document.body.appendChild(card);
        }
        card.style.position = 'absolute';
        card.style.zIndex = '1001';
        card.style.left = '50%';
        card.style.top = '50%';
        card.style.transform = 'translate(-50%, -50%)';
        // 自定义 cleanup：从 body 移除 card
        this._portalCleanup = () => {
          if (card.parentElement === document.body) {
            card.remove();
          }
        };
      }
    });
  }

  _closePortal(): void {
    if (this._portalRAF) { cancelAnimationFrame(this._portalRAF); this._portalRAF = null; }
    this._portalCleanup?.();
    this._portalCleanup = null;
    // 兜底：确保 card 从 body 移除（防止 RAF 未执行就关闭的情况）
    if (this._card && this._card.parentElement === document.body) {
      this._card.remove();
    }
  }

  _handleClose(): void {
    this.props.onClose?.(this.state.current);
  }

  _handleNext(): void {
    const { steps = [] } = this.props;
    if (this.state.current < steps.length - 1) {
      this.setState({ current: this.state.current + 1 });
    } else {
      this._handleClose();
    }
  }

  _handlePrev(): void {
    if (this.state.current > 0) {
      this.setState({ current: this.state.current - 1 });
    }
  }

  /** 解析步骤目标元素：支持选择器字符串 / 函数 / DOM 节点 */
  _getTargetEl(step: TourStep | undefined): HTMLElement | null {
    if (!step?.target) return null;
    if (typeof step.target === 'string') return document.querySelector<HTMLElement>(step.target);
    if (typeof step.target === 'function') return step.target();
    return step.target;
  }

  /** 计算引导卡片定位：相对目标元素按 placement 摆放；无目标时居中 */
  _positionCard(cardEl: HTMLElement | null, targetEl: HTMLElement | null, placement: TourPlacement): void {
    if (!cardEl) return;
    if (!targetEl) {
      cardEl.style.left = '50%';
      cardEl.style.top = '50%';
      cardEl.style.transform = 'translate(-50%, -50%)';
      return;
    }
    const rect = targetEl.getBoundingClientRect();
    const cw = cardEl.offsetWidth;
    const ch = cardEl.offsetHeight;
    const gap = 12;
    const scrollX = window.scrollX || 0;
    const scrollY = window.scrollY || 0;
    let left: number, top: number;
    switch (placement) {
      case 'top': left = rect.left + rect.width / 2 - cw / 2; top = rect.top - ch - gap; break;
      case 'bottom': left = rect.left + rect.width / 2 - cw / 2; top = rect.bottom + gap; break;
      case 'left': left = rect.left - cw - gap; top = rect.top + rect.height / 2 - ch / 2; break;
      case 'right': left = rect.right + gap; top = rect.top + rect.height / 2 - ch / 2; break;
      default: left = rect.right + gap; top = rect.top;
    }
    cardEl.style.transform = '';
    // 边界保护：避免卡片贴出视口
    cardEl.style.left = `${Math.max(8, left + scrollX)}px`;
    cardEl.style.top = `${Math.max(8, top + scrollY)}px`;
  }

  /** 渲染遮罩：有目标用 box-shadow 镂空高亮，无目标整屏遮罩 */
  _renderOverlay(targetEl: HTMLElement | null): Node {
    if (!targetEl) {
      return h('div', {
        class: 'tour__mask',
        style: { position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.45)', pointerEvents: 'none', zIndex: '1000' },
      });
    }
    const rect = targetEl.getBoundingClientRect();
    const pad = 8;
    return h('div', {
      class: 'tour__highlight',
      style: {
        position: 'fixed',
        left: `${rect.left - pad}px`,
        top: `${rect.top - pad}px`,
        width: `${rect.width + pad * 2}px`,
        height: `${rect.height + pad * 2}px`,
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
        borderRadius: '4px',
        pointerEvents: 'none',
        zIndex: '1000',
      },
    });
  }

  render(): Node | string {
    const { open, steps = [], arrow = true, type = 'default' } = this.props;
    if (!open || steps.length === 0) {
      // 关闭时清理 portal 到 body 的引导卡片
      this._closePortal();
      return h('div', { class: 'tour', style: 'display:none;' });
    }

    const idx = Math.min(this.state.current, steps.length - 1);
    const step = steps[idx];
    const targetEl = this._getTargetEl(step);
    const placement = step.placement || 'bottom';

    const overlay = this._renderOverlay(targetEl);

    const card = h('div', {
      class: [
        'tour__card',
        `tour__card--${type}`,
        arrow && 'tour__card--arrow',
        `tour__card--${placement}`,
      ].filter(Boolean).join(' '),
      role: 'dialog',
      'aria-modal': 'false',
      style: 'position:absolute;z-index:1001;',
    },
      step.cover && h('div', { class: 'tour__cover' }, step.cover),
      h('div', { class: 'tour__head' },
        step.title && h('div', { class: 'tour__title' }, step.title),
        h('button', {
          type: 'button',
          class: 'tour__close',
          'aria-label': '关闭引导',
          onClick: () => this._handleClose(),
        }, '×'),
      ),
      step.description && h('div', { class: 'tour__description' }, step.description),
      h('div', { class: 'tour__foot' },
        // 指示器：圆点序列，激活项高亮
        h('div', { class: 'tour__indicator' },
          ...steps.map((_, i) => h('span', {
            class: ['tour__dot', i === idx && 'tour__dot--active'].filter(Boolean).join(' '),
          })),
        ),
        h('div', { class: 'tour__buttons' },
          idx > 0 && h('button', {
            type: 'button',
            class: 'btn',
            onClick: () => this._handlePrev(),
          }, '上一步'),
          h('button', {
            type: 'button',
            class: 'btn btn--primary',
            onClick: () => this._handleNext(),
          }, idx === steps.length - 1 ? '完成' : '下一步'),
        ),
      ),
    );

    // 挂载后 portal 引导卡片到 body 并按目标位置定位
    // （避免祖先 overflow:hidden 裁剪；每次重渲染都会重新调度）
    this._card = card as HTMLElement;
    this._openPortal();

    return h('div', { class: 'tour' }, overlay, card);
  }
}
