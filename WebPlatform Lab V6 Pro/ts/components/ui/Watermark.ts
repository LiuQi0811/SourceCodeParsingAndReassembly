// Watermark.ts —— 水印组件
// 用 canvas 渲染单个水印单元并转 dataURL，作为绝对定位层的 background-image 平铺；
// 子内容正常渲染在水印层之下（层通过 pointer-events:none 不阻断交互）。
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import type { Props } from '../../core/types.js';

interface WatermarkFont {
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: string;
  fontWeight?: string;
}

export interface WatermarkProps extends Props {
  content?: string | string[];
  rotate?: number;
  font?: WatermarkFont;
  gap?: [number, number] | number[];
  offset?: [number, number] | number[];
  width?: number;
  height?: number;
  z?: number;
  inherit?: boolean;
  children?: Node | string | (Node | string)[];
}

export class Watermark extends Component {
  declare props: WatermarkProps;

  /** 生成单个水印单元的 dataURL */
  _makeWatermarkUrl(width: number, height: number): string | null {
    const {
      content = '', rotate = -22, font = {},
    } = this.props;
    const {
      color = 'rgba(0,0,0,0.15)', fontSize = 14, fontFamily = 'sans-serif',
      fontStyle = 'normal', fontWeight = 'normal',
    } = font;

    const lines: string[] = Array.isArray(content) ? content.filter(Boolean) : (content ? [content] : []);
    if (lines.length === 0) return null;

    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = color;
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    // 平移到中心后旋转
    ctx.translate(width / 2, height / 2);
    ctx.rotate((rotate * Math.PI) / 180);
    // 多行垂直居中排列
    const lineHeight = fontSize * 1.2;
    const totalH = lineHeight * lines.length;
    lines.forEach((line, i) => {
      const y = i * lineHeight - totalH / 2 + lineHeight / 2;
      ctx.fillText(String(line), 0, y);
    });
    return canvas.toDataURL();
  }

  render(): Node | string {
    const {
      content = '', gap = [100, 100], offset = [],
      width = 120, height = 64, z = 9, inherit = true,
      children,
    } = this.props;

    const url = this._makeWatermarkUrl(width, height);
    // offset 未提供时默认为 gap 的一半（与 antd 行为一致）
    const offsetX = offset[0] ?? gap[0] / 2;
    const offsetY = offset[1] ?? gap[1] / 2;

    // 水印层样式：绝对定位覆盖整个容器，背景平铺
    const layerStyle: Record<string, string> = {
      position: 'absolute',
      inset: '0',
      zIndex: String(z),
      pointerEvents: 'none',
      backgroundRepeat: 'repeat',
      backgroundPosition: `${offsetX}px ${offsetY}px`,
    };
    if (url) {
      layerStyle.backgroundImage = `url(${url})`;
      layerStyle.backgroundSize = `${gap[0] + width}px ${gap[1] + height}px`;
    }

    const kids = Array.isArray(children) ? children : (children ? [children] : []);

    return h('div', {
      class: 'watermark',
      style: { position: 'relative' },
      'data-inherit': inherit ? 'true' : 'false',
    },
      ...kids,
      h('div', { class: 'watermark__layer', style: layerStyle, 'aria-hidden': 'true' }),
    );
  }
}
