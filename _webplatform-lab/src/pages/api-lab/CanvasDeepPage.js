// =====================================================================
// CanvasDeepPage.js —— Canvas 2D 深度实验室
// 演示 MDN：
//   1. Path2D 路径对象：new Path2D() / new Path2D(svgString) / new Path2D(anotherPath)；
//      方法 moveTo/lineTo/arc/arcTo/rect/ellipse/bezierCurveTo/quadraticCurveTo/closePath；
//      ctx.fill(path)/stroke(path)/isPointInPath/isPointInStroke/clip(path)；优势：路径可
//      复用、可序列化、性能优化（GPU 缓存）。
//   2. 像素操作 getImageData / putImageData / createImageData：ImageData.data 是
//      Uint8ClampedArray（RGBA 四通道，每像素 4 字节，值 0-255）；演示灰度化 / 反色 /
//      亮度调整等逐像素处理。
//   3. globalCompositeOperation 合成模式：source-over / multiply / screen / overlay /
//      darken / lighten / difference / xor / copy 等 12 种；两个圆形叠加切换合成模式。
//   4. drawImage 图像绘制 + 坐标变换：drawImage 三种重载；image 源可为 HTMLImageElement /
//      HTMLCanvasElement / OffscreenCanvas / ImageBitmap / SVGImageElement / VideoFrame；
//      ctx.transform(a,b,c,d,e,f) 矩阵 / setTransform / scale / rotate / translate；save/restore 嵌套。
//   5. createPattern + createLinearGradient/RadialGradient/ConicGradient +
//      gradient.addColorStop(offset, color)；4 种填充并排对比。
// 兼容性：jsdom 中 getContext 返回的对象含 fillRect/arc/beginPath/fill/stroke/save/restore/
//   translate/rotate/fillText/createLinearGradient 等，但 Path2D / getImageData / putImageData /
//   createImageData / drawImage / transform / setTransform / isPointInPath / isPointInStroke /
//   clip / createPattern / globalCompositeOperation 可能缺失；所有调用前均做 typeof / in
//   能力检测，不可用时 _addLog('warn', ...)，绝不抛异常。建议在 _getCtx(id) 辅助方法中获取并校验。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// 合成模式列表（Card 3 循环切换 12 种较常用模式）
const COMPOSITE_MODES = [
  'source-over', 'destination-over', 'multiply', 'screen',
  'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn',
  'hard-light', 'soft-light', 'difference',
];

export class CanvasDeepPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      // 共享事件日志（所有卡片写入同一面板）
      logs: [],
      // 能力检测摘要（componentDidMount 中填充，渲染时非空才显示 Alert）
      capsSummary: '',
      // Card 1：Path2D 命中测试结果
      hitResult: '尚未测试',
      // Card 2：像素处理结果摘要
      pixelResult: '尚未绘制',
      // Card 3：当前合成模式
      currentComposite: 'source-over',
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★ 初始化实例引用（render 中读取的引用须在守卫之前初始化；
    //   首次 render 已在 componentDidMount 前执行，此处幂等赋值保证安全）。
    //   注意：_starPath 需跨 rerender 保留（命中测试复用），故不在守卫前重置，
    //   以免日志触发的 rerender 把用户刚绘制的星形路径覆盖为 null。
    this._rafId = null;            // requestAnimationFrame 句柄（componentWillUnmount 防御性清理）

    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // —— 能力检测（绝不抛异常，仅 typeof / in 判定）——
    const caps = this._caps();
    const summary =
      '能力检测：HTMLCanvasElement=' + (caps.canvas ? '✓' : '✗') +
      '，Path2D=' + (caps.path2d ? '✓' : '✗') +
      '，getImageData=' + (caps.getImageData ? '✓' : '✗') +
      '，putImageData=' + (caps.putImageData ? '✓' : '✗') +
      '，drawImage=' + (caps.drawImage ? '✓' : '✗') +
      '，transform=' + (caps.transform ? '✓' : '✗') +
      '，globalCompositeOperation=' + (caps.globalCompositeOperation ? '✓' : '✗') +
      '，createPattern=' + (caps.createPattern ? '✓' : '✗') +
      '，ConicGradient=' + (caps.createConicGradient ? '✓' : '✗');
    this.setState({ capsSummary: summary });
    this._addLog('info', summary);

    if (!caps.canvas) {
      this._addLog('warn', 'HTMLCanvasElement 不可用，所有 Canvas 演示将仅记日志');
    } else {
      if (!caps.path2d) {
        this._addLog('warn', 'Path2D 不可用（jsdom 限制），Card 1 部分功能将跳过；在真实浏览器可完整演示');
      }
      if (!caps.getImageData || !caps.putImageData) {
        this._addLog('warn', 'getImageData/putImageData 不可用（jsdom 限制），Card 2 像素处理将跳过');
      }
      if (!caps.drawImage) {
        this._addLog('warn', 'drawImage 不可用（jsdom 限制），Card 4 drawImage 重载演示将跳过');
      }
      if (!caps.transform || !caps.setTransform) {
        this._addLog('warn', 'transform/setTransform 不可用（jsdom 限制），Card 4 矩阵变换将仅记日志');
      }
      if (!caps.globalCompositeOperation) {
        this._addLog('warn', 'globalCompositeOperation 不可写（jsdom 限制），Card 3 仅记录模式名，无视觉效果');
      }
      if (!caps.createPattern) {
        this._addLog('warn', 'createPattern 不可用（jsdom 限制），Card 5 pattern 填充将跳过');
      }
    }
  }

  componentWillUnmount() {
    // 取消尚未触发的 requestAnimationFrame（防御性清理；本页无连续动画，通常为 null）
    try {
      if (this._rafId != null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this._rafId);
      }
      this._rafId = null;
    } catch { /* noop */ }
    // 移除可能存在的实例引用（便于 GC）
    this._starPath = null;
  }

  // —— 辅助：同步能力检测（render 时也调用，开销可忽略；结果幂等）——
  _caps() {
    // 需要检测的 ctx 方法名（typeof 'function'）；globalCompositeOperation 用 in 判定
    const METHODS = [
      'getImageData', 'putImageData', 'createImageData', 'isPointInPath',
      'isPointInStroke', 'clip', 'drawImage', 'transform', 'setTransform',
      'scale', 'rotate', 'translate', 'save', 'restore', 'createPattern',
      'createLinearGradient', 'createRadialGradient', 'createConicGradient',
    ];
    const caps = { canvas: false, path2d: false, globalCompositeOperation: false };
    for (const m of METHODS) caps[m] = false;
    try {
      if (typeof HTMLCanvasElement === 'undefined' ||
        typeof document === 'undefined' ||
        typeof document.createElement !== 'function') {
        return caps;
      }
      const c = document.createElement('canvas');
      if (typeof c.getContext !== 'function') return caps;
      caps.canvas = true;
      const ctx = c.getContext('2d');
      if (!ctx) return caps;
      caps.path2d = typeof Path2D !== 'undefined';
      caps.globalCompositeOperation = 'globalCompositeOperation' in ctx;
      for (const m of METHODS) caps[m] = typeof ctx[m] === 'function';
    } catch { /* jsdom 等环境访问可能抛错 */ }
    return caps;
  }

  // —— 辅助：通过 DOM id 获取 canvas 2D context（带能力检测）——
  // 通过 document.getElementById 获取 canvas，避免 rerender 后旧引用失效
  _getCtx(id) {
    try {
      if (typeof document === 'undefined' ||
        typeof document.getElementById !== 'function') {
        return null;
      }
      const canvas = document.getElementById(id);
      if (!canvas || typeof canvas.getContext !== 'function') return null;
      const ctx = canvas.getContext('2d');
      return ctx || null;
    } catch {
      return null;
    }
  }

  // —— 辅助：创建离屏 canvas（带渐变 + 文字），作为 drawImage / createPattern 的 image 源 ——
  _makeOffscreen(size = 100) {
    try {
      if (typeof document === 'undefined' ||
        typeof document.createElement !== 'function') {
        return null;
      }
      const off = document.createElement('canvas');
      off.width = size;
      off.height = size;
      const octx = off.getContext('2d');
      if (!octx) return null;
      // 渐变背景
      if (typeof octx.createLinearGradient === 'function') {
        const g = octx.createLinearGradient(0, 0, size, size);
        g.addColorStop(0, '#1677ff');
        g.addColorStop(0.5, '#722ed1');
        g.addColorStop(1, '#ff4d4f');
        if ('fillStyle' in octx) octx.fillStyle = g;
      } else if ('fillStyle' in octx) {
        octx.fillStyle = '#722ed1';
      }
      if (typeof octx.fillRect === 'function') octx.fillRect(0, 0, size, size);
      // 居中文字
      if (typeof octx.fillText === 'function') {
        if ('font' in octx) octx.font = `bold ${Math.floor(size / 7)}px sans-serif`;
        if ('fillStyle' in octx) octx.fillStyle = '#ffffff';
        if (typeof octx.measureText === 'function') {
          const m = octx.measureText('IMG');
          octx.fillText('IMG', (size - m.width) / 2, size / 2);
        } else {
          octx.fillText('IMG', size * 0.3, size * 0.55);
        }
      }
      return off;
    } catch {
      return null;
    }
  }

  // —— 日志 / 按钮辅助 ——
  _addLog(type, content) {
    this.setState({
      logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40),
    });
  }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // =================== Card 1: Path2D 路径对象 ===================

  // 用 Path2D 构造一个星形路径，复用 fill + stroke
  _drawPathStar() {
    const caps = this._caps();
    if (!caps.path2d) {
      this._addLog('warn', 'Path2D 构造器不可用（jsdom 限制）；在 Chrome/Firefox/Edge 中打开可正常演示');
      return;
    }
    const ctx = this._getCtx('canvas-path2d');
    if (!ctx) {
      this._addLog('warn', 'canvas-path2d 元素不可用');
      return;
    }
    try {
      const cx = 160, cy = 100, R = 60, r = 28;
      // 演示 Path2D 第一种构造方式：new Path2D() 空路径 + 方法链
      // （另两种：new Path2D(svgPathString) / new Path2D(anotherPath) 见日志说明）
      const path = new Path2D();
      for (let i = 0; i < 10; i++) {
        const ang = (Math.PI / 5) * i - Math.PI / 2;
        const radius = i % 2 === 0 ? R : r;
        const x = cx + Math.cos(ang) * radius;
        const y = cy + Math.sin(ang) * radius;
        if (i === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      }
      path.closePath();
      this._starPath = path;  // 缓存以便 isPointInPath 命中测试 / clip 复用

      if (typeof ctx.clearRect === 'function') ctx.clearRect(0, 0, 320, 200);
      // 复用同一 Path2D 对象：fill + stroke
      if (typeof ctx.fill === 'function') {
        if ('fillStyle' in ctx) ctx.fillStyle = '#faad14';
        ctx.fill(path);
      }
      if (typeof ctx.stroke === 'function') {
        if ('strokeStyle' in ctx) ctx.strokeStyle = '#722ed1';
        if ('lineWidth' in ctx) ctx.lineWidth = 3;
        ctx.stroke(path);
      }
      this._addLog('path', `Path2D 星形已绘制（10 个顶点，外径 ${R}/内径 ${r}），同一路径 fill+stroke 复用`);
      this._addLog('path', 'Path2D 三种构造：new Path2D() / new Path2D(svgString) / new Path2D(anotherPath)');
      this._addLog('path', 'Path2D 优势：可复用、可序列化（SVG path 字符串）、性能优化（GPU 路径缓存）');
    } catch (err) {
      this._addLog('err', `Path2D 绘制失败：${err.name} - ${err.message}`);
    }
  }

  // isPointInPath / isPointInStroke 命中测试
  _testHit() {
    const caps = this._caps();
    if (!caps.path2d) {
      this._addLog('warn', 'Path2D 不可用，命中测试跳过');
      return;
    }
    if (!caps.isPointInPath && !caps.isPointInStroke) {
      this._addLog('warn', 'isPointInPath / isPointInStroke 不可用（jsdom 限制）');
      return;
    }
    if (!this._starPath) {
      this._addLog('warn', '请先点击「绘制 Path2D 星形」');
      return;
    }
    const ctx = this._getCtx('canvas-path2d');
    if (!ctx) {
      this._addLog('warn', 'canvas-path2d 元素不可用');
      return;
    }
    try {
      // 测试多个坐标点（含星形内部 / 边缘 / 外部）
      const points = [
        { x: 160, y: 100, label: '中心' },
        { x: 160, y: 50, label: '上方顶点' },
        { x: 30, y: 30, label: '左上角外' },
        { x: 300, y: 180, label: '右下角外' },
      ];
      const lines = [];
      for (const p of points) {
        let inPath = false, inStroke = false;
        if (caps.isPointInPath) {
          try { inPath = ctx.isPointInPath(this._starPath, p.x, p.y); } catch { /* noop */ }
        }
        if (caps.isPointInStroke) {
          try { inStroke = ctx.isPointInStroke(this._starPath, p.x, p.y); } catch { /* noop */ }
        }
        lines.push(`${p.label}(${p.x},${p.y}) path=${inPath ? '✓' : '✗'} stroke=${inStroke ? '✓' : '✗'}`);
      }
      const summary = lines.join('  |  ');
      this.setState({ hitResult: summary });
      this._addLog('path', `isPointInPath/isPointInStroke 命中测试 ${points.length} 点：${summary}`);
      this._addLog('path', '注：isPointInPath 测试是否在路径填充区内；isPointInStroke 测试是否落在描边线上（受 lineWidth 影响）');
    } catch (err) {
      this._addLog('err', `命中测试失败：${err.name} - ${err.message}`);
    }
  }

  // =================== Card 2: 像素操作 getImageData / putImageData / createImageData ===================

  // 绘制原图（彩色图元），为后续像素处理做准备
  _drawPixelOriginal() {
    const ctx = this._getCtx('canvas-pixel');
    if (!ctx) {
      this._addLog('warn', 'canvas-pixel 元素不可用');
      return;
    }
    try {
      if (typeof ctx.clearRect === 'function') ctx.clearRect(0, 0, 320, 200);
      // 红色矩形
      if ('fillStyle' in ctx) ctx.fillStyle = '#ff4d4f';
      if (typeof ctx.fillRect === 'function') ctx.fillRect(20, 20, 80, 80);
      // 绿色圆形
      if (typeof ctx.beginPath === 'function') ctx.beginPath();
      if (typeof ctx.arc === 'function') ctx.arc(200, 60, 40, 0, Math.PI * 2);
      if ('fillStyle' in ctx) ctx.fillStyle = '#52c41a';
      if (typeof ctx.fill === 'function') ctx.fill();
      // 蓝色矩形
      if ('fillStyle' in ctx) ctx.fillStyle = '#1677ff';
      if (typeof ctx.fillRect === 'function') ctx.fillRect(120, 120, 80, 60);
      // 黄色文字
      if ('fillStyle' in ctx) ctx.fillStyle = '#faad14';
      if ('font' in ctx) ctx.font = 'bold 20px sans-serif';
      if (typeof ctx.fillText === 'function') ctx.fillText('PIXEL', 30, 180);
      this.setState({ pixelResult: '已绘制原图（红矩形+绿圆+蓝矩形+黄字）' });
      this._addLog('image', '已绘制原图：红矩形(20,20,80,80) + 绿圆(200,60,r=40) + 蓝矩形(120,120,80,60) + 黄字"PIXEL"');
      this._addLog('pixel', '可点击「灰度化 / 反色 / 亮度调整」对 ImageData.data (Uint8ClampedArray) 做逐像素处理');
    } catch (err) {
      this._addLog('err', `绘制原图失败：${err.name} - ${err.message}`);
    }
  }

  // 通用像素处理：getImageData → 遍历 RGBA → putImageData 写回
  _processPixels(name, fn) {
    const caps = this._caps();
    if (!caps.getImageData || !caps.putImageData) {
      this._addLog('warn', 'getImageData/putImageData 不可用（jsdom 限制），像素处理跳过');
      return;
    }
    const ctx = this._getCtx('canvas-pixel');
    if (!ctx) {
      this._addLog('warn', 'canvas-pixel 元素不可用');
      return;
    }
    try {
      const img = ctx.getImageData(0, 0, 320, 200);
      const d = img.data;  // Uint8ClampedArray，每像素 4 字节 RGBA
      let touched = 0;
      for (let i = 0; i < d.length; i += 4) {
        // 跳过完全透明像素（避免处理空白区域）
        if (d[i + 3] === 0) continue;
        fn(d, i);
        touched++;
      }
      ctx.putImageData(img, 0, 0);
      this.setState({ pixelResult: `${name}：已处理 ${touched} 个非透明像素` });
      this._addLog('pixel', `${name}：遍历 ${d.length / 4} 像素（${d.length} 字节 RGBA），实际处理 ${touched} 非透明`);
    } catch (err) {
      this._addLog('err', `${name} 失败：${err.name} - ${err.message}`);
    }
  }

  // 灰度化：Y = 0.299R + 0.587G + 0.114B（ITU-R BT.601）
  _applyGrayscale() {
    this._processPixels('灰度化', (d, i) => {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = gray;
    });
    this._addLog('pixel', '灰度公式 Y = 0.299R + 0.587G + 0.114B（人眼对绿色最敏感，权重最大）');
  }

  // 反色：new = 255 - old（每通道独立）
  _applyInvert() {
    this._processPixels('反色', (d, i) => {
      d[i] = 255 - d[i];
      d[i + 1] = 255 - d[i + 1];
      d[i + 2] = 255 - d[i + 2];
    });
    this._addLog('pixel', '反色：new = 255 - old（每通道独立，alpha 不变）');
  }

  // 亮度调整：data[i] += delta；Uint8ClampedArray 自动 clamp 到 [0, 255]
  _applyBrightness() {
    const delta = 40;
    this._processPixels(`亮度调整 +${delta}`, (d, i) => {
      d[i] = d[i] + delta;
      d[i + 1] = d[i + 1] + delta;
      d[i + 2] = d[i + 2] + delta;
    });
    this._addLog('pixel', `亮度调整 +${delta}：data[i] += delta；Uint8ClampedArray 自动 clamp 到 [0,255]`);
  }

  // createImageData：构造全空 ImageData 并逐像素填入
  _createImageDataDemo() {
    const caps = this._caps();
    if (!caps.createImageData || !caps.putImageData) {
      this._addLog('warn', 'createImageData/putImageData 不可用（jsdom 限制）');
      return;
    }
    const ctx = this._getCtx('canvas-pixel');
    if (!ctx) {
      this._addLog('warn', 'canvas-pixel 元素不可用');
      return;
    }
    try {
      const w = 60, h = 60;
      const img = ctx.createImageData(w, h);  // 全透明黑
      const d = img.data;
      // 构造红蓝棋盘格
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const isRed = (((x >> 3) + (y >> 3)) & 1) === 0;
          d[i] = isRed ? 255 : 0;
          d[i + 1] = 0;
          d[i + 2] = isRed ? 0 : 255;
          d[i + 3] = 255;  // alpha
        }
      }
      ctx.putImageData(img, 240, 120);
      this.setState({ pixelResult: `createImageData(${w},${h}) 已写入 (240,120)` });
      this._addLog('image', `createImageData(${w}, ${h}) 构造 ${w * h} 像素 / ${d.length} 字节，红蓝棋盘写入 (240,120)`);
      this._addLog('image', 'createImageData(width, height) 创建全透明黑；createImageData(imageData) 按同尺寸创建');
    } catch (err) {
      this._addLog('err', `createImageData 失败：${err.name} - ${err.message}`);
    }
  }

  // =================== Card 3: globalCompositeOperation 合成模式 ===================

  // 循环切换 12 种合成模式：每次点击下一个
  _cycleComposite() {
    const ctx = this._getCtx('canvas-composite');
    if (!ctx) {
      this._addLog('warn', 'canvas-composite 元素不可用');
      return;
    }
    const caps = this._caps();
    try {
      const cur = this.state.currentComposite || 'source-over';
      let idx = COMPOSITE_MODES.indexOf(cur);
      if (idx < 0) idx = -1;
      idx = (idx + 1) % COMPOSITE_MODES.length;
      const next = COMPOSITE_MODES[idx];

      if (typeof ctx.clearRect === 'function') ctx.clearRect(0, 0, 320, 200);

      // 先以 source-over 画底层（destination）红色圆
      if (caps.globalCompositeOperation) ctx.globalCompositeOperation = 'source-over';
      if (typeof ctx.beginPath === 'function') ctx.beginPath();
      if (typeof ctx.arc === 'function') ctx.arc(120, 100, 60, 0, Math.PI * 2);
      if ('fillStyle' in ctx) ctx.fillStyle = '#ff4d4f';
      if (typeof ctx.fill === 'function') ctx.fill();

      // 切换合成模式后画上层（source）蓝色圆
      if (caps.globalCompositeOperation) ctx.globalCompositeOperation = next;
      if (typeof ctx.beginPath === 'function') ctx.beginPath();
      if (typeof ctx.arc === 'function') ctx.arc(200, 100, 60, 0, Math.PI * 2);
      if ('fillStyle' in ctx) ctx.fillStyle = '#1677ff';
      if (typeof ctx.fill === 'function') ctx.fill();

      // 恢复默认
      if (caps.globalCompositeOperation) ctx.globalCompositeOperation = 'source-over';

      this.setState({ currentComposite: next });
      this._addLog('composite', `切换合成模式 → ${next}（${idx + 1}/${COMPOSITE_MODES.length}）`);
      if (!caps.globalCompositeOperation) {
        this._addLog('warn', `当前环境 globalCompositeOperation 不可写（jsdom mock），实际视觉效果在真实浏览器可见`);
      } else {
        this._addLog('op', `红圆(destination) + 蓝圆(source) 在 "${next}" 模式下叠加`);
      }
    } catch (err) {
      this._addLog('err', `合成模式切换失败：${err.name} - ${err.message}`);
    }
  }

  // =================== Card 4: drawImage 图像绘制 + 坐标变换 ===================

  // drawImage 三种重载演示
  _drawImageScaled() {
    const caps = this._caps();
    if (!caps.drawImage) {
      this._addLog('warn', 'ctx.drawImage 不可用（jsdom 限制）');
      return;
    }
    const ctx = this._getCtx('canvas-drawimage');
    if (!ctx) {
      this._addLog('warn', 'canvas-drawimage 元素不可用');
      return;
    }
    try {
      const off = this._makeOffscreen(100);
      if (!off) {
        this._addLog('warn', '离屏 canvas 创建失败');
        return;
      }
      if (typeof ctx.clearRect === 'function') ctx.clearRect(0, 0, 320, 200);
      // 重载 1：drawImage(image, dx, dy) —— 1:1 原始尺寸
      ctx.drawImage(off, 10, 10);
      // 重载 2：drawImage(image, dx, dy, dw, dh) —— 缩放到 50×50
      ctx.drawImage(off, 130, 10, 50, 50);
      // 重载 3：drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh) —— 取源 (0,0,50,50) 放大到 (200,10,100,100)
      ctx.drawImage(off, 0, 0, 50, 50, 200, 10, 100, 100);
      this._addLog('draw', 'drawImage 三种重载：1:1 / 缩放 (dw,dh) / 局部源 (sx,sy,sw,sh,dx,dy,dw,dh)');
      this._addLog('draw', 'image 源类型：HTMLCanvasElement（本例）；亦可为 HTMLImageElement / OffscreenCanvas / ImageBitmap / SVGImageElement / VideoFrame');
    } catch (err) {
      this._addLog('err', `drawImage 失败：${err.name} - ${err.message}`);
    }
  }

  // transform(a, b, c, d, e, f) 矩阵旋转：围绕 (160,100) 旋转 45°
  _applyTransformRotate() {
    const caps = this._caps();
    if (!caps.transform || !caps.setTransform) {
      this._addLog('warn', 'transform/setTransform 不可用（jsdom 限制）');
      return;
    }
    const ctx = this._getCtx('canvas-drawimage');
    if (!ctx) {
      this._addLog('warn', 'canvas-drawimage 元素不可用');
      return;
    }
    try {
      if (typeof ctx.clearRect === 'function') ctx.clearRect(0, 0, 320, 200);
      // transform(a,b,c,d,e,f) 矩阵：[a c e; b d f; 0 0 1]
      // 围绕 (cx,cy) 旋转 θ 等价于：translate(cx,cy) → rotate(θ) → translate(-cx,-cy)
      // 复合矩阵：
      //   a = cosθ, b = sinθ, c = -sinθ, d = cosθ
      //   e = cx - cx·cosθ + cy·sinθ
      //   f = cy - cx·sinθ - cy·cosθ
      const ang = Math.PI / 4;  // 45°
      const cos = Math.cos(ang), sin = Math.sin(ang);
      const cx = 160, cy = 100;
      const e = cx - cx * cos + cy * sin;
      const f = cy - cx * sin - cy * cos;
      ctx.setTransform(1, 0, 0, 1, 0, 0);   // 先重置到单位矩阵
      ctx.transform(cos, sin, -sin, cos, e, f);
      if ('fillStyle' in ctx) ctx.fillStyle = '#1677ff';
      if (typeof ctx.fillRect === 'function') ctx.fillRect(120, 60, 80, 80);
      ctx.setTransform(1, 0, 0, 1, 0, 0);   // 恢复
      this._addLog('transform', `transform(${cos.toFixed(3)}, ${sin.toFixed(3)}, ${(-sin).toFixed(3)}, ${cos.toFixed(3)}, ${e.toFixed(1)}, ${f.toFixed(1)}) 围绕 (${cx},${cy}) 旋转 45°`);
      this._addLog('transform', '矩阵含义：a=水平缩放 b=垂直倾斜 c=水平倾斜 d=垂直缩放 e=水平平移 f=垂直平移');
      this._addLog('transform', 'setTransform(a,b,c,d,e,f) 先重置再变换；scale/rotate/translate 等价于 transform 的特例');
    } catch (err) {
      this._addLog('err', `transform 失败：${err.name} - ${err.message}`);
    }
  }

  // save / restore 嵌套：5 个旋转方块共享状态栈
  _nestedSaveRestore() {
    const caps = this._caps();
    if (!caps.save || !caps.restore) {
      this._addLog('warn', 'save/restore 不可用（jsdom 限制）');
      return;
    }
    const ctx = this._getCtx('canvas-drawimage');
    if (!ctx) {
      this._addLog('warn', 'canvas-drawimage 元素不可用');
      return;
    }
    try {
      if (typeof ctx.clearRect === 'function') ctx.clearRect(0, 0, 320, 200);
      ctx.save();                                  // L0 入栈
      if (caps.translate) ctx.translate(160, 100);  // 移到画布中心
      for (let i = 0; i < 5; i++) {
        ctx.save();                                // L1 入栈
        if (caps.rotate) ctx.rotate((Math.PI * 2 * i) / 5);
        if (caps.translate) ctx.translate(40, 0);
        if ('fillStyle' in ctx) ctx.fillStyle = `hsl(${i * 72}, 70%, 55%)`;
        if (typeof ctx.fillRect === 'function') ctx.fillRect(-15, -15, 30, 30);
        ctx.restore();                             // L1 出栈，回到中心
      }
      ctx.restore();                                // L0 出栈，回到原点
      this._addLog('transform', 'save/restore 嵌套：外层 translate(160,100) + 内层 5 次 rotate+translate，状态栈深度=2');
      this._addLog('transform', 'save 入栈：fillStyle/strokeStyle/lineWidth/transform/globalAlpha/globalCompositeOperation/font 等；restore 出栈恢复');
    } catch (err) {
      this._addLog('err', `save/restore 嵌套失败：${err.name} - ${err.message}`);
    }
  }

  // =================== Card 5: createPattern + 渐变 ===================

  // 4 种填充并排对比：pattern / linear / radial / conic
  _drawGradientsCompare() {
    const ctx = this._getCtx('canvas-gradients');
    if (!ctx) {
      this._addLog('warn', 'canvas-gradients 元素不可用');
      return;
    }
    const caps = this._caps();
    const drawn = [];
    try {
      if (typeof ctx.clearRect === 'function') ctx.clearRect(0, 0, 480, 200);

      // 1. createPattern(image, repetition)
      if (caps.createPattern) {
        const off = this._makeOffscreen(40);
        if (off) {
          const pattern = ctx.createPattern(off, 'repeat');
          if (pattern) {
            if ('fillStyle' in ctx) ctx.fillStyle = pattern;
            if (typeof ctx.fillRect === 'function') ctx.fillRect(10, 10, 100, 180);
            drawn.push('pattern(repeat)');
          }
        }
      } else {
        this._addLog('warn', 'createPattern 不可用（jsdom 限制），pattern 区域跳过');
      }

      // 2. createLinearGradient(x0, y0, x1, y1)
      if (caps.createLinearGradient) {
        const lg = ctx.createLinearGradient(120, 10, 220, 190);
        lg.addColorStop(0, '#1677ff');
        lg.addColorStop(0.5, '#722ed1');
        lg.addColorStop(1, '#ff4d4f');
        if ('fillStyle' in ctx) ctx.fillStyle = lg;
        if (typeof ctx.fillRect === 'function') ctx.fillRect(120, 10, 100, 180);
        drawn.push('linear');
      }

      // 3. createRadialGradient(x0, y0, r0, x1, y1, r1)
      if (caps.createRadialGradient) {
        const rg = ctx.createRadialGradient(280, 100, 5, 280, 100, 90);
        rg.addColorStop(0, '#ffffff');
        rg.addColorStop(0.5, '#52c41a');
        rg.addColorStop(1, 'rgba(82,196,26,0)');
        if ('fillStyle' in ctx) ctx.fillStyle = rg;
        if (typeof ctx.fillRect === 'function') ctx.fillRect(230, 10, 100, 180);
        drawn.push('radial');
      }

      // 4. createConicGradient(startAngle, x, y)
      if (caps.createConicGradient) {
        const cg = ctx.createConicGradient(0, 390, 100);
        cg.addColorStop(0, '#ff4d4f');
        cg.addColorStop(0.25, '#faad14');
        cg.addColorStop(0.5, '#52c41a');
        cg.addColorStop(0.75, '#1677ff');
        cg.addColorStop(1, '#ff4d4f');
        if ('fillStyle' in ctx) ctx.fillStyle = cg;
        if (typeof ctx.fillRect === 'function') ctx.fillRect(340, 10, 130, 180);
        drawn.push('conic');
      } else {
        this._addLog('warn', 'createConicGradient 不可用（较新浏览器，jsdom 限制），conic 区域跳过');
      }

      this._addLog('gradient', `已绘制 ${drawn.length} 种填充对比：${drawn.join(' / ')}`);
      this._addLog('pattern', 'createPattern(image, repetition) repetition: "repeat" | "repeat-x" | "repeat-y" | "no-repeat"');
      this._addLog('gradient', 'gradient.addColorStop(offset 0-1, color)；offset 越界抛 INDEX_SIZE_ERR；颜色格式错误抛 SYNTAX_ERR');
    } catch (err) {
      this._addLog('err', `渐变绘制失败：${err.name} - ${err.message}`);
    }
  }

  // =================== 渲染 ===================

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. Path2D 路径对象',
      desc: 'new Path2D() / new Path2D(pathString) / new Path2D(anotherPath)；方法 moveTo/lineTo/arc/arcTo/rect/ellipse/bezierCurveTo/quadraticCurveTo/closePath；ctx.fill(path)/stroke(path)/isPointInPath(path,x,y)/isPointInStroke(path,x,y)/clip(path)；优势：路径可复用、可序列化、性能优化（GPU 缓存）。',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.path2d ? 'success' : 'warning' }, caps.path2d ? 'Path2D 可用' : 'Path2D 不可用'),
        h(Tag, { color: caps.isPointInPath ? 'success' : 'default' }, caps.isPointInPath ? 'isPointInPath ✓' : 'isPointInPath ✗'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '演示：用 Path2D 构造一个 10 顶点星形路径，复用同一对象做 fill + stroke；isPointInPath / isPointInStroke 检测多个坐标是否命中路径。Path2D 把路径数据封装为对象，可在多处复用、跨 worker 序列化（OffscreenCanvas）、被浏览器 GPU 加速缓存。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('绘制 Path2D 星形', {
            type: 'primary', size: 'sm',
            disabled: !caps.path2d,
            onClick: () => this._drawPathStar(),
          }),
          this._btn('isPointInPath 命中测试', {
            size: 'sm',
            disabled: !caps.path2d,
            onClick: () => this._testHit(),
          }),
        ),
        h('canvas', {
          id: 'canvas-path2d', class: 'canvas-stage',
          style: { width: '320px', height: '200px', background: '#fff' },
        }),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '命中测试结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '80px', overflow: 'auto' } },
          h('code', {}, s.hitResult || '（点击「绘制 Path2D 星形」→「isPointInPath 命中测试」）')),
        h(Alert, {
          type: 'info',
          message: 'Path2D = 可复用的路径对象',
          description: '相比直接调用 ctx.beginPath/moveTo/lineTo，Path2D 把路径封装为独立对象，可被 fill / stroke / clip / isPointInPath / isPointInStroke 接受，便于跨绘制复用与跨线程传输。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const pixelDisabled = !caps.getImageData || !caps.putImageData;
    const card = new Card({
      title: '2. 像素操作 getImageData / putImageData / createImageData',
      desc: 'ctx.getImageData(sx, sy, sw, sh) → ImageData { data: Uint8ClampedArray, width, height }；ctx.putImageData(imageData, dx, dy, dirtyX?, dirtyY?, dirtyWidth?, dirtyHeight?)；ctx.createImageData(width, height) / createImageData(imageData)；data 为 RGBA 四通道，每像素 4 字节，值 0-255。',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.getImageData ? 'success' : 'warning' }, caps.getImageData ? 'getImageData ✓' : 'getImageData ✗'),
        h(Tag, { color: caps.putImageData ? 'success' : 'warning' }, caps.putImageData ? 'putImageData ✓' : 'putImageData ✗'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '演示：getImageData 读取像素 → 灰度化（Y = 0.299R + 0.587G + 0.114B）/ 反色（new = 255 - old）/ 亮度调整（data[i] += Δ，Uint8ClampedArray 自动 clamp）→ putImageData 写回。createImageData 构造全空 ImageData 并逐像素填入红蓝棋盘格。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('绘制原图', {
            type: 'primary', size: 'sm',
            onClick: () => this._drawPixelOriginal(),
          }),
          this._btn('灰度化', {
            size: 'sm',
            disabled: pixelDisabled,
            onClick: () => this._applyGrayscale(),
          }),
          this._btn('反色', {
            size: 'sm',
            disabled: pixelDisabled,
            onClick: () => this._applyInvert(),
          }),
          this._btn('亮度调整 +40', {
            size: 'sm',
            disabled: pixelDisabled,
            onClick: () => this._applyBrightness(),
          }),
          this._btn('createImageData 棋盘', {
            size: 'sm',
            disabled: !caps.createImageData || !caps.putImageData,
            onClick: () => this._createImageDataDemo(),
          }),
        ),
        h('canvas', {
          id: 'canvas-pixel', class: 'canvas-stage',
          style: { width: '320px', height: '200px', background: '#fff' },
        }),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, `处理结果：${s.pixelResult || '—'}`),
        h(Alert, {
          type: 'info',
          message: 'ImageData.data 是 Uint8ClampedArray',
          description: '每像素 4 字节 RGBA，值自动 clamp 到 [0, 255]（赋值 300 变 255，-10 变 0）。逐像素遍历性能开销大，复杂滤镜建议用 WebGL 或 OffscreenCanvas + Worker。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. globalCompositeOperation 合成模式',
      desc: 'ctx.globalCompositeOperation = "source-over"(默认) | "destination-over" | "multiply" | "screen" | "overlay" | "darken" | "lighten" | "color-dodge" | "color-burn" | "hard-light" | "soft-light" | "difference" | "exclusion" | "hue" | "saturation" | "color" | "luminosity" | "xor" | "copy"。',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.globalCompositeOperation ? 'success' : 'warning' },
          caps.globalCompositeOperation ? '可用' : '不可用'),
        h(Tag, { color: 'primary' }, `当前：${s.currentComposite || 'source-over'}`),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '演示：先画红色圆（destination），切换合成模式后再画蓝色圆（source），观察两圆重叠区域的混合效果。共 12 种常用模式循环切换。source-over 为默认（新图形覆盖旧）；multiply 模拟透明胶片叠加；difference 取差值；xor 重叠区域透明。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('循环切换 12 种合成模式', {
            type: 'primary', size: 'sm',
            onClick: () => this._cycleComposite(),
          }),
        ),
        h('canvas', {
          id: 'canvas-composite', class: 'canvas-stage',
          style: { width: '320px', height: '200px', background: '#fff' },
        }),
        h('div', { class: 'fs-sm text-secondary mt-sm' },
          `共 ${COMPOSITE_MODES.length} 种循环模式：${COMPOSITE_MODES.join(' / ')}`),
        h(Alert, {
          type: 'info',
          message: 'source 与 destination 的合成规则',
          description: 'source = 新绘制图形，destination = 已有画布内容。每个模式定义 source 与 destination 重叠像素的最终颜色，遵循 Porter-Duff 透明度合成或 W3C 颜色混合公式。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard4() {
    const caps = this._caps();
    const card = new Card({
      title: '4. drawImage 图像绘制 + 坐标变换',
      desc: 'ctx.drawImage(image, dx, dy) / drawImage(image, dx, dy, dw, dh) / drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh)；image 源：HTMLImageElement / HTMLCanvasElement / OffscreenCanvas / ImageBitmap / SVGImageElement / VideoFrame。ctx.transform(a,b,c,d,e,f) 矩阵；setTransform 重置后变换；scale / rotate / translate 为特例。save / restore 状态栈。',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.drawImage ? 'success' : 'warning' }, caps.drawImage ? 'drawImage ✓' : 'drawImage ✗'),
        h(Tag, { color: caps.transform ? 'success' : 'warning' }, caps.transform ? 'transform ✓' : 'transform ✗'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '演示：drawImage 三种重载（1:1 / 缩放 / 局部源放大），image 源用离屏 canvas（带渐变 + 文字）；transform 矩阵围绕 (160,100) 旋转 45°；save/restore 嵌套绘制 5 个旋转方块。save 入栈：fillStyle/strokeStyle/lineWidth/transform/globalAlpha/globalCompositeOperation/font 等；restore 出栈恢复。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('drawImage 缩放绘制', {
            type: 'primary', size: 'sm',
            disabled: !caps.drawImage,
            onClick: () => this._drawImageScaled(),
          }),
          this._btn('transform 旋转矩阵', {
            size: 'sm',
            disabled: !caps.transform || !caps.setTransform,
            onClick: () => this._applyTransformRotate(),
          }),
          this._btn('save/restore 嵌套', {
            size: 'sm',
            disabled: !caps.save || !caps.restore,
            onClick: () => this._nestedSaveRestore(),
          }),
        ),
        h('canvas', {
          id: 'canvas-drawimage', class: 'canvas-stage',
          style: { width: '320px', height: '200px', background: '#fff' },
        }),
        h(Alert, {
          type: 'info',
          message: 'transform 矩阵 [a c e; b d f; 0 0 1]',
          description: 'a=水平缩放 b=垂直倾斜 c=水平倾斜 d=垂直缩放 e=水平平移 f=垂直平移。scale(x,y)/rotate(θ)/translate(x,y) 等价于 transform 的特例；setTransform 先重置为单位矩阵再应用，常用于复位。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard5() {
    const caps = this._caps();
    const card = new Card({
      title: '5. createPattern + createLinearGradient/RadialGradient/ConicGradient + 渐变',
      desc: 'ctx.createPattern(image, repetition) repetition: "repeat"|"repeat-x"|"repeat-y"|"no-repeat"；ctx.createLinearGradient(x0,y0,x1,y1) → gradient.addColorStop(offset, color)；ctx.createRadialGradient(x0,y0,r0,x1,y1,r1)；ctx.createConicGradient(startAngle, x, y)；offset 取值 0-1。',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.createPattern ? 'success' : 'warning' }, caps.createPattern ? 'pattern ✓' : 'pattern ✗'),
        h(Tag, { color: caps.createConicGradient ? 'success' : 'warning' }, caps.createConicGradient ? 'conic ✓' : 'conic ✗'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '演示：4 种填充并排对比 —— createPattern（离屏 canvas 平铺）/ createLinearGradient（线性）/ createRadialGradient（径向，可造光晕）/ createConicGradient（圆锥，较新浏览器）。所有渐变通过 addColorStop(offset 0-1, color) 添加色标。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('绘制 4 种渐变并排对比', {
            type: 'primary', size: 'sm',
            onClick: () => this._drawGradientsCompare(),
          }),
        ),
        h('canvas', {
          id: 'canvas-gradients', class: 'canvas-stage',
          style: { width: '480px', height: '200px', background: '#fff' },
        }),
        h('div', { class: 'fs-sm text-secondary mt-sm' },
          '从左到右：pattern(repeat) → linear(120→220) → radial(280,100,r=5→90) → conic(390,100,0°→360°)'),
        h(Alert, {
          type: 'warning',
          message: 'addColorStop offset 必须在 [0, 1]',
          description: 'offset 越界抛 INDEX_SIZE_ERR；color 必须是有效 CSS 颜色字符串（如 "#fff" / "rgba(0,0,0,0.5)"），否则抛 SYNTAX_ERR。createConicGradient 较新，旧 Safari 可能不支持。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderLogPanel() {
    const s = this.state;
    return h('div', { class: 'log-panel' },
      h('div', { class: 'log-panel__header' }, '事件日志'),
      s.logs.length === 0
        ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
        : s.logs.map((log) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  render() {
    const s = this.state;
    return h('div', { class: 'page api-lab-page' },
      h('h2', { class: 'section-title' }, 'Canvas 2D 深度实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '演示 Canvas 2D 进阶：Path2D 路径对象 / 像素操作 / globalCompositeOperation 合成 / drawImage+坐标变换 / createPattern+渐变。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderLogPanel(),
    );
  }
}
