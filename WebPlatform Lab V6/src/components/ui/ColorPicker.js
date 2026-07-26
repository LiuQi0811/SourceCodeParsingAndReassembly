// ColorPicker.js —— 颜色选择器（参考 antd ColorPicker，原生 input[type=color] + canvas 简易实现）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { mountDropdown, isClickInside } from './_portal.js';

/** hex -> { r, g, b } */
function hexToRgb(hex) {
  const m = String(hex).replace('#', '').match(/^([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return { r: 0, g: 0, b: 0 };
  let s = m[1];
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
}

/** { r, g, b } -> hex */
function rgbToHex({ r, g, b }) {
  const to = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** { r, g, b } -> { h, s, v } */
function rgbToHsv({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

/** { h, s, v } -> { r, g, b } */
function hsvToRgb({ h, s, v }) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

/** 按目标格式输出颜色字符串 */
function formatColor(hex, format) {
  if (format === 'hex') return hex;
  const rgb = hexToRgb(hex);
  if (format === 'rgb') return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  if (format === 'hsb') {
    const hsv = rgbToHsv(rgb);
    return `hsb(${Math.round(hsv.h)}, ${Math.round(hsv.s * 100)}%, ${Math.round(hsv.v * 100)}%)`;
  }
  return hex;
}

/**
 * 颜色选择器
 * props:
 *   - value: hex 字符串
 *   - defaultValue
 *   - disabled
 *   - onChange: (hex, colorObj) => void
 *   - showText: boolean（触发器显示颜色值）
 *   - format: 'hex' | 'rgb' | 'hsb'（仅影响显示）
 *   - presets: Array<{ label, colors: string[] }>
 */
export class ColorPicker extends Component {
  initialState() {
    const v = this.props.value || this.props.defaultValue || '#1677ff';
    return { open: false, hex: v };
  }

  componentDidMount() {
    this._outsideHandler = (e) => {
      if (this.state.open && !isClickInside(e, this.el, this._dropdownEl)) this._setOpen(false);
    };
    document.addEventListener('click', this._outsideHandler);
  }

  componentWillUnmount() {
    document.removeEventListener('click', this._outsideHandler);
    this._closePortal();
    if (this._satRAF) { cancelAnimationFrame(this._satRAF); this._satRAF = null; }
    if (this._hueRAF) { cancelAnimationFrame(this._hueRAF); this._hueRAF = null; }
  }

  _setOpen(open) {
    if (open) {
      this.setState({ open: true });
      this._openPortal();
    } else {
      this.setState({ open: false });
      this._closePortal();
    }
  }

  _openPortal() {
    this._closePortal();
    this._portalRAF = requestAnimationFrame(() => {
      if (!this.state.open || !this.el) return;
      const panel = this.el.querySelector('.colorpicker__panel');
      const trigger = this.el.querySelector('.colorpicker__trigger') || this.el.querySelector('.colorpicker__swatch');
      if (panel && trigger) {
        this._dropdownEl = panel;
        this._portalCleanup = mountDropdown(panel, trigger);
      }
    });
  }

  _closePortal() {
    if (this._portalRAF) { cancelAnimationFrame(this._portalRAF); this._portalRAF = null; }
    this._portalCleanup?.();
    this._portalCleanup = null;
    this._dropdownEl = null;
  }

  _setHex(hex) {
    this.setState({ hex });
    const rgb = hexToRgb(hex);
    const hsv = rgbToHsv(rgb);
    this.props.onChange?.(hex, { hex, rgb, hsv });
  }

  /** 由 HSV 反算 hex 并更新 */
  _setHsv(h, s, v) {
    const rgb = hsvToRgb({ h, s, v });
    this._setHex(rgbToHex(rgb));
  }

  /** 渲染饱和度方块：用 canvas 绘制 SV 平面，监听拖拽 */
  _renderSaturation(hsv) {
    const wrap = h('div', {
      class: 'colorpicker__saturation',
      style: { background: `hsl(${hsv.h}, 100%, 50%)` },
    });
    // 用 pointer 事件统一鼠标/触摸，rAF 节流 + 值变化判断
    const handlePointer = (e) => {
      const rect = wrap.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      const s = x / rect.width;
      const v = 1 - y / rect.height;
      // 值变化判断（量化到 1/1000 避免浮点抖动）
      const key = `${s.toFixed(3)},${v.toFixed(3)}`;
      if (key === this._lastSatKey) return;
      this._lastSatKey = key;
      if (this._satRAF) return;
      this._satRAF = requestAnimationFrame(() => {
        this._satRAF = null;
        this._setHsv(hsv.h, s, v);
      });
    };
    const onMove = (e) => { if (this._satDragging) handlePointer(e); };
    const onUp = () => {
      this._satDragging = false;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    wrap.addEventListener('pointerdown', (e) => {
      this._satDragging = true;
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      handlePointer(e);
      e.preventDefault();
    });
    const cursor = h('div', {
      class: 'colorpicker__saturation-cursor',
      style: { left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` },
    });
    wrap.appendChild(cursor);
    return wrap;
  }

  /** 渲染色相滑块 */
  _renderHue(hsv) {
    const slider = h('div', { class: 'colorpicker__hue' });
    const thumb = h('div', {
      class: 'colorpicker__hue-thumb',
      style: { left: `${(hsv.h / 360) * 100}%` },
    });
    slider.appendChild(thumb);
    // rAF 节流 + 值变化判断
    const handlePointer = (e) => {
      const rect = slider.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const h = (x / rect.width) * 360;
      const key = h.toFixed(2);
      if (key === this._lastHueKey) return;
      this._lastHueKey = key;
      if (this._hueRAF) return;
      this._hueRAF = requestAnimationFrame(() => {
        this._hueRAF = null;
        const cur = rgbToHsv(hexToRgb(this.state.hex));
        this._setHsv(h, cur.s, cur.v);
      });
    };
    const onMove = (e) => { if (this._hueDragging) handlePointer(e); };
    const onUp = () => {
      this._hueDragging = false;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    slider.addEventListener('pointerdown', (e) => {
      this._hueDragging = true;
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      handlePointer(e);
      e.preventDefault();
    });
    return slider;
  }

  _renderPanel() {
    const rgb = hexToRgb(this.state.hex);
    const hsv = rgbToHsv(rgb);
    const { format = 'hex', showText = false, presets = [] } = this.props;
    const display = formatColor(this.state.hex, format);
    return h('div', { class: 'colorpicker__panel', role: 'dialog', onClick: (e) => e.stopPropagation() },
      this._renderSaturation(hsv),
      this._renderHue(hsv),
      h('div', { class: 'colorpicker__inputs' },
        h('input', {
          type: 'text',
          class: 'colorpicker__hex-input',
          value: this.state.hex,
          onChange: (e) => {
            const v = e.target.value;
            if (/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(v) && v.toLowerCase() !== this.state.hex.toLowerCase()) this._setHex(v);
          },
        }),
        showText && h('span', { class: 'colorpicker__display' }, display),
        h('input', {
          type: 'color',
          class: 'colorpicker__native',
          value: this.state.hex,
          onInput: (e) => {
            const v = e.target.value;
            if (v.toLowerCase() !== this.state.hex.toLowerCase()) this._setHex(v);
          },
        }),
      ),
      presets.length > 0 && h('div', { class: 'colorpicker__presets' },
        ...presets.map((group) => h('div', { class: 'colorpicker__preset-group' },
          group.label && h('div', { class: 'colorpicker__preset-label' }, group.label),
          h('div', { class: 'colorpicker__preset-colors' },
            ...(group.colors || []).map((c) => h('button', {
              type: 'button',
              class: ['colorpicker__preset-color', c.toLowerCase() === this.state.hex.toLowerCase() && 'is-active'].filter(Boolean).join(' '),
              style: { background: c },
              title: c,
              onClick: () => this._setHex(c),
            })),
          ),
        )),
      ),
    );
  }

  render() {
    const { disabled = false, showText = false, format = 'hex' } = this.props;
    const display = formatColor(this.state.hex, format);
    const root = h('div', { class: `colorpicker ${this.state.open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}` },
      h('div', {
        class: 'colorpicker__trigger',
        tabindex: disabled ? '-1' : '0',
        role: 'combobox',
        'aria-expanded': String(this.state.open),
        'aria-haspopup': 'dialog',
        onClick: (e) => {
          // 阻止冒泡到 document 的 outside 处理器（同 DatePicker/Cascader）
          e.stopPropagation();
          if (!disabled) this._setOpen(!this.state.open);
        },
        onKeyDown: (e) => {
          if (e.key === 'Escape' && this.state.open) this._setOpen(false);
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!disabled) this._setOpen(!this.state.open); }
        },
      },
        h('span', { class: 'colorpicker__swatch', style: { background: this.state.hex } }),
        showText && h('span', { class: 'colorpicker__trigger-text' }, display),
      ),
    );
    if (this.state.open && !disabled) root.appendChild(this._renderPanel());
    return root;
  }

  getValue() { return this.state.hex; }
  setValue(v) { this.setState({ hex: v }); }
}
