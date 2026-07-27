// QRCode.js —— 二维码组件
// 注：不实现真实 QR 编码算法，仅绘制「三个定位角 + 基于内容哈希的伪随机模块」，
// 视觉上接近二维码，同 value 出图稳定。
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

// 模块数：标准 QR Version 1 为 21x21
const MODULES = 21;
const SVG_NS = 'http://www.w3.org/2000/svg';

export class QRCode extends Component {
  /** 基于字符串的伪随机数生成器：保证相同 value 出图一致 */
  _makeRng(seed) {
    let h = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }

  /** 判断坐标是否落在三个定位角区域 */
  _inFinder(i, j) {
    const inBox = (x, y) => x >= 0 && x < 7 && y >= 0 && y < 7;
    return inBox(i, j)
      || inBox(i - (MODULES - 7), j)
      || inBox(i, j - (MODULES - 7));
  }

  /** 绘制单个定位角（7x7：外框 + 内 3x3 实心） */
  _drawFinder(ctx, x, y, cell, color) {
    ctx.fillStyle = color;
    // 外框（上、下、左、右各一条）
    ctx.fillRect(x * cell, y * cell, 7 * cell, cell);
    ctx.fillRect(x * cell, (y + 6) * cell, 7 * cell, cell);
    ctx.fillRect(x * cell, y * cell, cell, 7 * cell);
    ctx.fillRect((x + 6) * cell, y * cell, cell, 7 * cell);
    // 内 3x3 实心方块
    ctx.fillRect((x + 2) * cell, (y + 2) * cell, 3 * cell, 3 * cell);
  }

  /** Canvas 绘制 */
  _drawCanvas(canvas) {
    const {
      value = '', size = 96, color = '#000', bgColor = '#fff',
      icon, iconSize, errorLevel = 'M',
    } = this.props;
    const ctx = canvas.getContext('2d');
    // 测试环境（jsdom）或浏览器禁用 canvas 时 ctx 可能为 null，
    // 直接返回避免报错；浏览器中正常绘制。
    if (!ctx) return;
    const cell = size / MODULES;

    // 背景
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = color;

    // 1. 三个定位角
    this._drawFinder(ctx, 0, 0, cell, color);
    this._drawFinder(ctx, MODULES - 7, 0, cell, color);
    this._drawFinder(ctx, 0, MODULES - 7, cell, color);

    // 2. 中心区域伪随机模块
    const rng = this._makeRng(value);
    for (let i = 0; i < MODULES; i++) {
      for (let j = 0; j < MODULES; j++) {
        if (this._inFinder(i, j)) continue;
        if (rng() > 0.5) ctx.fillRect(i * cell, j * cell, cell, cell);
      }
    }

    // 3. 中心图标（覆盖在二维码之上，带白底）
    if (icon) {
      const isize = iconSize || Math.floor(size * 0.2);
      const ix = (size - isize) / 2;
      const iy = (size - isize) / 2;
      ctx.fillStyle = bgColor;
      ctx.fillRect(ix - 2, iy - 2, isize + 4, isize + 4);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try { ctx.drawImage(img, ix, iy, isize, isize); } catch { /* noop */ }
      };
      img.src = icon;
    }
    // errorLevel 仅影响视觉提示，对示意出图无实际影响
    void errorLevel;
  }

  /** SVG 绘制：返回 <svg> 元素 */
  _renderSVG() {
    const {
      size = 96, color = '#000', bgColor = '#fff',
    } = this.props;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    const cell = size / MODULES;

    // 背景
    const bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('width', size);
    bg.setAttribute('height', size);
    bg.setAttribute('fill', bgColor);
    svg.appendChild(bg);

    // 定位角
    const drawFinder = (x, y) => {
      const outer = document.createElementNS(SVG_NS, 'rect');
      outer.setAttribute('x', x * cell);
      outer.setAttribute('y', y * cell);
      outer.setAttribute('width', 7 * cell);
      outer.setAttribute('height', 7 * cell);
      outer.setAttribute('fill', 'none');
      outer.setAttribute('stroke', color);
      outer.setAttribute('stroke-width', cell);
      svg.appendChild(outer);
      const inner = document.createElementNS(SVG_NS, 'rect');
      inner.setAttribute('x', (x + 2) * cell);
      inner.setAttribute('y', (y + 2) * cell);
      inner.setAttribute('width', 3 * cell);
      inner.setAttribute('height', 3 * cell);
      inner.setAttribute('fill', color);
      svg.appendChild(inner);
    };
    drawFinder(0, 0);
    drawFinder(MODULES - 7, 0);
    drawFinder(0, MODULES - 7);

    // 随机模块
    const rng = this._makeRng(this.props.value || '');
    for (let i = 0; i < MODULES; i++) {
      for (let j = 0; j < MODULES; j++) {
        if (this._inFinder(i, j)) continue;
        if (rng() > 0.5) {
          const r = document.createElementNS(SVG_NS, 'rect');
          r.setAttribute('x', i * cell);
          r.setAttribute('y', j * cell);
          r.setAttribute('width', cell);
          r.setAttribute('height', cell);
          r.setAttribute('fill', color);
          svg.appendChild(r);
        }
      }
    }
    return svg;
  }

  render() {
    const {
      type = 'canvas', size = 96, bordered = true, errorLevel = 'M',
    } = this.props;
    const classes = [
      'qrcode',
      `qrcode--${String(errorLevel).toLowerCase()}`,
      !bordered && 'qrcode--borderless',
    ].filter(Boolean).join(' ');

    if (type === 'svg') {
      return h('div', { class: classes }, this._renderSVG());
    }

    // Canvas 类型：render 期间直接绘制（canvas 上下文不依赖 DOM 挂载）
    const canvas = h('canvas', {
      width: size,
      height: size,
      style: { width: `${size}px`, height: `${size}px` },
    });
    this._drawCanvas(canvas);
    return h('div', { class: classes }, canvas);
  }
}
