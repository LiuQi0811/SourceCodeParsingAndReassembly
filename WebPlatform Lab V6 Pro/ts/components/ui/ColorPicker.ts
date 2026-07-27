// ColorPicker.ts —— 颜色选择器（参考 antd ColorPicker，原生 input[type=color] + canvas 简易实现）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { mountDropdown, isClickInside } from './_portal.js';
import type { Props, State } from '../../core/types.js';

interface RGB { r: number; g: number; b: number; }
interface HSV { h: number; s: number; v: number; }

interface ColorPresetGroup {
  label?: Node | string;
  colors?: string[];
}

/** hex -> { r, g, b } */
function hexToRgb(hex: string): RGB {
  const m = String(hex).replace('#', '').match(/^([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return { r: 0, g: 0, b: 0 };
  let s = m[1];
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
}

/** { r, g, b } -> hex */
function rgbToHex({ r, g, b }: RGB): string {
  const to = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** { r, g, b } -> { h, s, v } */
function rgbToHsv({ r, g, b }: RGB): HSV {
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
function hsvToRgb({ h, s, v }: HSV): RGB {
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
function formatColor(hex: string, format: string): string {
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
export interface ColorPickerProps extends Props {
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  onChange?: (hex: string, colorObj: { hex: string; rgb: RGB; hsv: HSV }) => void;
  showText?: boolean;
  format?: string;
  presets?: ColorPresetGroup[];
}

export interface ColorPickerState extends State {
  open: boolean;
  hex: string;
}

export class ColorPicker extends Component {
  declare props: ColorPickerProps;
  declare state: ColorPickerState;
  _outsideHandler: ((e: Event) => void) | null = null;
  _dropdownEl: HTMLElement | null = null;
  _portalCleanup: (() => void) | null = null;
  _satRAF: number | null = null;
  _hueRAF: number | null = null;
  _lastSatKey: string | null = null;
  _lastHueKey: string | null = null;
  _satDragging: boolean = false;
  _hueDragging: boolean = false;

  initialState(): ColorPickerState {
    const v = this.props.value || this.props.defaultValue || '#1677ff';
    return { open: false, hex: v };
  }

  componentDidMount(): void {
    this._outsideHandler = (e: Event) => {
      if (this.state.open && !isClickInside(e, this.el as HTMLElement | null, this._dropdownEl)) this._setOpen(false);
    };
    document.addEventListener('click', this._outsideHandler);
  }

  componentWillUnmount(): void {
    if (this._outsideHandler) document.removeEventListener('click', this._outsideHandler);
    this._closePortal();
    if (this._satRAF) { cancelAnimationFrame(this._satRAF); this._satRAF = null; }
    if (this._hueRAF) { cancelAnimationFrame(this._hueRAF); this._hueRAF = null; }
  }

  _setOpen(open: boolean): void {
    if (open) {
      // setState 同步触发 _rerender，末尾 componentDidUpdate 完成 portal
      this.setState({ open: true });
    } else {
      this.setState({ open: false });
      this._closePortal();
    }
  }

  /** 重渲染后重新 portal，避免 body 旧 panel 变孤儿（根因 B） */
  componentDidUpdate(): void {
    if (this.state.open && this.el) {
      this._closePortal();
      this._openPortal();
    }
  }

  _openPortal(): void {
    this._closePortal();
    if (!this.state.open || !this.el) return;
    const panel = (this.el as Element).querySelector<HTMLElement>('.colorpicker__panel');
    const trigger = (this.el as Element).querySelector<HTMLElement>('.colorpicker__trigger') || (this.el as Element).querySelector<HTMLElement>('.colorpicker__swatch');
    if (panel && trigger) {
      this._dropdownEl = panel;
      this._portalCleanup = mountDropdown(panel, trigger);
    }
  }

  _closePortal(): void {
    this._portalCleanup?.();
    this._portalCleanup = null;
    this._dropdownEl = null;
  }

  _setHex(hex: string): void {
    this.setState({ hex });
    const rgb = hexToRgb(hex);
    const hsv = rgbToHsv(rgb);
    this.props.onChange?.(hex, { hex, rgb, hsv });
  }

  /** 由 HSV 反算 hex 并更新。
   *  拖动期间走此路径：直接改 state + 操作 DOM，不触发 setState/rerender，
   *  避免 rerender 重建 saturation/hue 元素导致拖拽中断、坐标坍缩。
   *  拖动结束（pointerup）时再 setState 做最终同步。 */
  _setHsv(h: number, s: number, v: number): void {
    const rgb = hsvToRgb({ h, s, v });
    const hex = rgbToHex(rgb);
    this.state.hex = hex;
    this._paintColor(hex, h, s, v);
    this.props.onChange?.(hex, { hex, rgb, hsv: { h, s, v } });
  }

  /** 直接操作 DOM 更新颜色显示（拖动期间避免 rerender） */
  _paintColor(hex: string, h: number, s: number, v: number): void {
    const panel = this._dropdownEl;
    // saturation 游标
    const satCursor = panel?.querySelector<HTMLElement>('.colorpicker__saturation-cursor');
    if (satCursor) {
      satCursor.style.left = `${s * 100}%`;
      satCursor.style.top = `${(1 - v) * 100}%`;
    }
    // saturation 背景（随色相变化）
    const sat = panel?.querySelector<HTMLElement>('.colorpicker__saturation');
    if (sat) sat.style.background = `hsl(${h}, 100%, 50%)`;
    // hue 滑块 thumb
    const hueThumb = panel?.querySelector<HTMLElement>('.colorpicker__hue-thumb');
    if (hueThumb) hueThumb.style.left = `${(h / 360) * 100}%`;
    // 触发器色块
    const swatch = (this.el as Element | null)?.querySelector<HTMLElement>('.colorpicker__swatch');
    if (swatch) swatch.style.background = hex;
    // hex 输入框
    const hexInput = panel?.querySelector<HTMLInputElement>('.colorpicker__hex-input');
    if (hexInput) hexInput.value = hex;
    // 原生 color input
    const nativeInput = panel?.querySelector<HTMLInputElement>('.colorpicker__native');
    if (nativeInput) nativeInput.value = hex;
  }

  /** 渲染饱和度方块：用 canvas 绘制 SV 平面，监听拖拽 */
  _renderSaturation(hsv: HSV): HTMLElement {
    const wrap = h('div', {
      class: 'colorpicker__saturation',
      style: { background: `hsl(${hsv.h}, 100%, 50%)` },
    }) as HTMLElement;
    // 用 pointer 事件统一鼠标/触摸，rAF 节流 + 值变化判断
    const handlePointer = (e: PointerEvent): void => {
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
        // 从 state.hex 反算当前 hsv，避免闭包 hsv.h 在 hue 拖动后过期
        const cur = rgbToHsv(hexToRgb(this.state.hex));
        this._setHsv(cur.h, s, v);
      });
    };
    const onMove = (e: Event): void => { if (this._satDragging) handlePointer(e as PointerEvent); };
    const onUp = (): void => {
      this._satDragging = false;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      // 拖动结束做最终同步：setState 触发 rerender 重建面板为最终状态
      this.setState({ hex: this.state.hex });
    };
    wrap.addEventListener('pointerdown', (e: PointerEvent) => {
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
  _renderHue(hsv: HSV): HTMLElement {
    const slider = h('div', { class: 'colorpicker__hue' }) as HTMLElement;
    const thumb = h('div', {
      class: 'colorpicker__hue-thumb',
      style: { left: `${(hsv.h / 360) * 100}%` },
    });
    slider.appendChild(thumb);
    // rAF 节流 + 值变化判断
    const handlePointer = (e: PointerEvent): void => {
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
    const onMove = (e: Event): void => { if (this._hueDragging) handlePointer(e as PointerEvent); };
    const onUp = (): void => {
      this._hueDragging = false;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      // 拖动结束做最终同步：setState 触发 rerender 重建面板为最终状态
      this.setState({ hex: this.state.hex });
    };
    slider.addEventListener('pointerdown', (e: PointerEvent) => {
      this._hueDragging = true;
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      handlePointer(e);
      e.preventDefault();
    });
    return slider;
  }

  _renderPanel(): Node {
    const rgb = hexToRgb(this.state.hex);
    const hsv = rgbToHsv(rgb);
    const { format = 'hex', showText = false, presets = [] } = this.props;
    const display = formatColor(this.state.hex, format);
    return h('div', { class: 'colorpicker__panel', role: 'dialog', onClick: (e: MouseEvent) => e.stopPropagation() },
      this._renderSaturation(hsv),
      this._renderHue(hsv),
      h('div', { class: 'colorpicker__inputs' },
        h('input', {
          type: 'text',
          class: 'colorpicker__hex-input',
          value: this.state.hex,
          onChange: (e: Event) => {
            const v = (e.target as HTMLInputElement).value;
            if (/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(v) && v.toLowerCase() !== this.state.hex.toLowerCase()) this._setHex(v);
          },
        }),
        showText && h('span', { class: 'colorpicker__display' }, display),
        h('input', {
          type: 'color',
          class: 'colorpicker__native',
          value: this.state.hex,
          onInput: (e: Event) => {
            const v = (e.target as HTMLInputElement).value;
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

  render(): Node | string {
    const { disabled = false, showText = false, format = 'hex' } = this.props;
    const display = formatColor(this.state.hex, format);
    const root = h('div', { class: `colorpicker ${this.state.open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}` },
      h('div', {
        class: 'colorpicker__trigger',
        tabindex: disabled ? '-1' : '0',
        role: 'combobox',
        'aria-expanded': String(this.state.open),
        'aria-haspopup': 'dialog',
        onClick: (e: MouseEvent) => {
          // 阻止冒泡到 document 的 outside 处理器（同 DatePicker/Cascader）
          e.stopPropagation();
          if (!disabled) this._setOpen(!this.state.open);
        },
        onKeyDown: (e: KeyboardEvent) => {
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

  getValue(): string { return this.state.hex; }
  setValue(v: string): void { this.setState({ hex: v }); }
}
