// Rate.js —— 评分组件（支持半星、自定义字符、禁用）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

export class Rate extends Component {
  initialState() {
    return {
      value: this.props.value || 0,
      hoverValue: 0,
    };
  }

  /** 根据鼠标位置计算当前分值（支持半星） */
  _calcValue(e) {
    const { allowHalf = false } = this.props;
    const target = e.target.closest('.rate__star');
    if (!target) return 0;
    const index = Number(target.dataset.index);
    if (!allowHalf) return index;
    const rect = target.getBoundingClientRect();
    const isLeft = e.clientX - rect.left < rect.width / 2;
    return isLeft ? index - 0.5 : index;
  }

  /** 直接操作 DOM 更新星星显示（hover 时避免 setState/rerender 导致闪烁） */
  _paintStars(value) {
    const stars = this.el?.querySelectorAll('.rate__star');
    if (!stars) return;
    const { allowHalf = false, character = '★' } = this.props;
    const emptyChar = character === '★' ? '☆' : character;
    stars.forEach((star) => {
      const i = Number(star.dataset.index);
      const isFull = value >= i;
      const isHalf = allowHalf && !isFull && value >= i - 0.5;
      star.classList.remove('rate__star--full', 'rate__star--half', 'rate__star--empty');
      if (isFull) star.classList.add('rate__star--full');
      else if (isHalf) star.classList.add('rate__star--half');
      else star.classList.add('rate__star--empty');
      star.textContent = (isFull || isHalf) ? character : emptyChar;
    });
  }

  render() {
    const {
      count = 5, allowHalf = false, disabled = false,
      character = '★',
    } = this.props;
    const { value, hoverValue } = this.state;
    const displayValue = hoverValue || value;
    const emptyChar = character === '★' ? '☆' : character;

    const stars = [];
    for (let i = 1; i <= count; i++) {
      const isFull = displayValue >= i;
      const isHalf = allowHalf && !isFull && displayValue >= i - 0.5;
      const classes = ['rate__star'];
      if (isFull) classes.push('rate__star--full');
      else if (isHalf) classes.push('rate__star--half');
      else classes.push('rate__star--empty');
      stars.push(h('span', {
        class: classes,
        dataset: { index: String(i) },
      }, isFull || isHalf ? character : emptyChar));
    }

    return h('div', {
      class: ['rate', disabled && 'rate--disabled'],
      onMousemove: (e) => {
        if (disabled) return;
        const next = this._calcValue(e);
        // 未悬停在星星上时保持当前 hover 状态，避免间隙闪烁
        if (next === 0 || next === this.state.hoverValue) return;
        // 直接改 state + 操作 DOM，不触发 setState/rerender（高频 mousemove 会闪烁）
        this.state.hoverValue = next;
        this._paintStars(next);
      },
      onMouseleave: () => {
        if (disabled) return;
        if (this.state.hoverValue !== 0) {
          this.state.hoverValue = 0;
          this._paintStars(this.state.value);
        }
      },
      onClick: (e) => {
        if (disabled) return;
        const next = this._calcValue(e);
        if (next === 0) return;
        this.state.value = next;
        this.state.hoverValue = 0;
        this._paintStars(next);
        this.props.onChange?.(next);
      },
    }, ...stars);
  }

  getValue() { return this.state.value; }
  setValue(v) { this.setState({ value: v }); }
}
