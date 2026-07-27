// GraphicsPage.js —— 图形与渲染 API 实验室
// 演示 MDN：WebGL（着色器/缓冲区/uniform/动画）、SVG（DOM 操作/属性/渐变）、
//           OffscreenCanvas、ImageBitmap
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// SVG 命名空间常量
const SVG_NS = 'http://www.w3.org/2000/svg';

// ===================== WebGL 着色器源码 =====================

// 基础三角形：顶点着色器（位置 + 顶点色）
const VERT_SRC_BASIC = `
attribute vec2 aPosition;
attribute vec3 aColor;
varying vec3 vColor;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
  vColor = aColor;
}
`;

// 基础三角形：片段着色器（顶点色 × uniform 颜色）
const FRAG_SRC_BASIC = `
precision mediump float;
varying vec3 vColor;
uniform vec4 uColor;
void main() {
  gl_FragColor = vec4(vColor, 1.0) * uColor;
}
`;

// 3D 立方体：顶点着色器（modelView / projection 矩阵变换）
const VERT_SRC_3D = `
attribute vec3 aPosition;
attribute vec3 aColor;
uniform mat4 uModelView;
uniform mat4 uProjection;
varying vec3 vColor;
void main() {
  gl_Position = uProjection * uModelView * vec4(aPosition, 1.0);
  vColor = aColor;
}
`;

// 3D 立方体：片段着色器（随时间脉动的颜色）
const FRAG_SRC_3D = `
precision mediump float;
varying vec3 vColor;
uniform float uTime;
void main() {
  float pulse = 0.7 + 0.3 * sin(uTime * 2.0);
  gl_FragColor = vec4(vColor * pulse, 1.0);
}
`;

// ===================== 4x4 矩阵工具（列主序，WebGL 约定） =====================

// 单位矩阵
function mat4Identity() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

// 矩阵乘法 a × b
function mat4Multiply(a, b) {
  const out = new Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[k * 4 + r] * b[c * 4 + k];
      }
      out[c * 4 + r] = sum;
    }
  }
  return out;
}

// 透视投影矩阵
function mat4Perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ];
}

// 平移（返回 M × T）
function mat4Translate(m, x, y, z) {
  const out = m.slice();
  out[12] = m[0] * x + m[4] * y + m[8] * z + m[12];
  out[13] = m[1] * x + m[5] * y + m[9] * z + m[13];
  out[14] = m[2] * x + m[6] * y + m[10] * z + m[14];
  out[15] = m[3] * x + m[7] * y + m[11] * z + m[15];
  return out;
}

// 绕 X 轴旋转（返回 M × Rx）
function mat4RotateX(m, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const rot = [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
  return mat4Multiply(m, rot);
}

// 绕 Y 轴旋转（返回 M × Ry）
function mat4RotateY(m, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const rot = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
  return mat4Multiply(m, rot);
}

// ===================== SVG 辅助函数 =====================

// 使用 createElementNS 创建 SVG 元素并批量设置属性
function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// 随机十六进制颜色
function randomColor() {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}

export class GraphicsPage extends Page {
  initialState() {
    return {
      logs: [],
      webglInfo: '尚未初始化',
      webglSupported: true,
      webglColor: [1.0, 0.0, 0.0, 1.0],
      svgShapeCount: 0,
      svgShapes: [],
      offscreenSupported: typeof OffscreenCanvas !== 'undefined',
      offscreenResult: '',
      imageBitmapInfo: '',
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // 1. WebGL 基础：编译着色器、创建缓冲区、渲染三角形（仅首次初始化）
    if (!this._webglBasicReady) {
      this._webglBasicReady = this._initWebglBasic();
    }
    // 2. WebGL 进阶：启动 3D 旋转动画（仅首次初始化，避免重渲染泄漏多个 rAF 循环）
    if (!this._webgl3dReady) {
      this._webgl3dReady = this._initWebgl3d();
    }
    // 3. SVG：根据 state 重建所有形状
    this._renderSvgShapes();
    // 4. SVG：绑定点击监听（点击空白区域添加形状）
    if (!this._svgListenersReady) {
      this._svgListenersReady = true;
      this._setupSvgListeners();
    }
  }

  componentWillUnmount() {
    // 取消 3D 动画的 requestAnimationFrame
    if (this._webgl3dRaf) {
      cancelAnimationFrame(this._webgl3dRaf);
      this._webgl3dRaf = null;
    }
    // WebGL 上下文随 canvas 销毁，无需显式释放
    // SVG 监听器由 Component.destroy 统一解绑（_eventBindings）
  }

  // —— 日志辅助 ——
  _addLog(type, content) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  // —— 按钮辅助 ——
  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // ===================== 1. WebGL 基础 =====================

  // 编译单个着色器
  _compileShader(gl, type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`着色器编译失败: ${log}`);
    }
    return shader;
  }

  // 初始化 WebGL 基础场景：彩色三角形
  _initWebglBasic() {
    const canvas = this.$('.webgl-canvas');
    if (!canvas) return;
    const gl = canvas.getContext('webgl');
    if (!gl) {
      if (this.state.webglSupported) this.setState({ webglSupported: false });
      return;
    }

    // 编译顶点着色器与片段着色器，链接为 program
    const vs = this._compileShader(gl, gl.VERTEX_SHADER, VERT_SRC_BASIC);
    const fs = this._compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC_BASIC);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    // 顶点数据：位置(xy) + 颜色(rgb)，3 个顶点构成三角形
    const vertices = new Float32Array([
      // x,    y,   r,   g,   b
      0.0, 0.7, 1.0, 0.0, 0.0,
      -0.7, -0.5, 0.0, 1.0, 0.0,
      0.7, -0.5, 0.0, 0.0, 1.0,
    ]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // 设置 attribute 指针（vertexAttribPointer）
    const aPosition = gl.getAttribLocation(program, 'aPosition');
    const aColor = gl.getAttribLocation(program, 'aColor');
    const stride = 5 * 4; // 每顶点 5 个 float × 4 字节
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, stride, 2 * 4);

    // 传入 uniform 颜色
    const uColor = gl.getUniformLocation(program, 'uColor');
    gl.uniform4fv(uColor, this.state.webglColor);

    // 渲染：clearColor + clear + drawArrays
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.1, 0.15, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 通过 getParameter 获取 WebGL 上下文信息
    const info = [
      `VERSION: ${gl.getParameter(gl.VERSION)}`,
      `SHADING_LANGUAGE_VERSION: ${gl.getParameter(gl.SHADING_LANGUAGE_VERSION)}`,
      `VENDOR: ${gl.getParameter(gl.VENDOR)}`,
      `RENDERER: ${gl.getParameter(gl.RENDERER)}`,
    ].join('\n');
    // 仅在信息变化时更新 state，避免无限循环
    if (this.state.webglInfo !== info) {
      this.setState({ webglInfo: info });
    }
  }

  // 切换 uniform 颜色按钮
  _switchColor() {
    const palette = [
      [1.0, 0.0, 0.0, 1.0], // 红
      [0.0, 1.0, 0.0, 1.0], // 绿
      [0.0, 0.0, 1.0, 1.0], // 蓝
      [1.0, 1.0, 0.0, 1.0], // 黄
      [1.0, 0.0, 1.0, 1.0], // 紫
      [0.0, 1.0, 1.0, 1.0], // 青
    ];
    this._colorIdx = ((this._colorIdx ?? -1) + 1) % palette.length;
    const next = palette[this._colorIdx];
    this.setState({ webglColor: next });
    this._addLog('webgl', `uniform uColor 切换 → [${next.slice(0, 3).map((v) => v.toFixed(2)).join(', ')}]`);
  }

  // ===================== 2. WebGL 进阶（3D 旋转立方体） =====================

  _initWebgl3d() {
    // 取消旧的动画循环（rerender 后旧 canvas 已脱离 DOM）
    if (this._webgl3dRaf) {
      cancelAnimationFrame(this._webgl3dRaf);
      this._webgl3dRaf = null;
    }
    const canvas = this.$('.webgl-canvas-3d');
    if (!canvas) return;
    const gl = canvas.getContext('webgl');
    if (!gl) return;

    // 编译着色器并链接 program
    const vs = this._compileShader(gl, gl.VERTEX_SHADER, VERT_SRC_3D);
    const fs = this._compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC_3D);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    // 立方体顶点数据：6 面 × 4 顶点 = 24 顶点，每顶点 位置(xyz) + 颜色(rgb)
    const faces = [
      // 前（红）
      [-1, -1, 1, 1, 0, 0], [1, -1, 1, 1, 0, 0], [1, 1, 1, 1, 0, 0], [-1, 1, 1, 1, 0, 0],
      // 后（绿）
      [1, -1, -1, 0, 1, 0], [-1, -1, -1, 0, 1, 0], [-1, 1, -1, 0, 1, 0], [1, 1, -1, 0, 1, 0],
      // 上（蓝）
      [-1, 1, 1, 0, 0, 1], [1, 1, 1, 0, 0, 1], [1, 1, -1, 0, 0, 1], [-1, 1, -1, 0, 0, 1],
      // 下（黄）
      [-1, -1, -1, 1, 1, 0], [1, -1, -1, 1, 1, 0], [1, -1, 1, 1, 1, 0], [-1, -1, 1, 1, 1, 0],
      // 右（紫）
      [1, -1, 1, 1, 0, 1], [1, -1, -1, 1, 0, 1], [1, 1, -1, 1, 0, 1], [1, 1, 1, 1, 0, 1],
      // 左（青）
      [-1, -1, -1, 0, 1, 1], [-1, -1, 1, 0, 1, 1], [-1, 1, 1, 0, 1, 1], [-1, 1, -1, 0, 1, 1],
    ];
    const vertices = new Float32Array(faces.flat());
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // 索引缓冲区（drawElements）
    const indices = [];
    for (let i = 0; i < 6; i++) {
      const base = i * 4;
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    // attribute 指针
    const aPosition = gl.getAttribLocation(program, 'aPosition');
    const aColor = gl.getAttribLocation(program, 'aColor');
    const stride = 6 * 4; // 每顶点 6 个 float × 4 字节
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, stride, 3 * 4);

    // uniform 位置
    const uModelView = gl.getUniformLocation(program, 'uModelView');
    const uProjection = gl.getUniformLocation(program, 'uProjection');
    const uTime = gl.getUniformLocation(program, 'uTime');

    // 启用深度测试与背面剔除
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    // 投影矩阵（固定）
    const projection = mat4Perspective(Math.PI / 4, canvas.width / canvas.height, 0.1, 100);

    // 动画循环：requestAnimationFrame
    const start = performance.now();
    const loop = (now) => {
      const t = (now - start) / 1000;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.05, 0.05, 0.08, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // 手动计算 modelView 矩阵：平移 + 双轴旋转
      let mv = mat4Identity();
      mv = mat4Translate(mv, 0, 0, -5);
      mv = mat4RotateX(mv, t * 0.7);
      mv = mat4RotateY(mv, t * 1.0);

      // 传入 uniform 矩阵与时间
      gl.uniformMatrix4fv(uModelView, false, new Float32Array(mv));
      gl.uniformMatrix4fv(uProjection, false, new Float32Array(projection));
      gl.uniform1f(uTime, t);

      // drawElements 绘制立方体
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

      this._webgl3dRaf = requestAnimationFrame(loop);
    };
    this._webgl3dRaf = requestAnimationFrame(loop);
  }

  // ===================== 3. SVG DOM 操作 =====================

  // 根据 state.svgShapes 重建 SVG 内容（defs + 文本 + 形状）
  _renderSvgShapes() {
    const svg = this.$('.svg-canvas');
    if (!svg) return;
    // 清空现有内容
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    // 定义渐变（defs：linearGradient / radialGradient）
    const defs = svgEl('defs');
    const lg = svgEl('linearGradient', { id: 'svg-lg', x1: '0%', y1: '0%', x2: '100%', y2: '100%' });
    lg.appendChild(svgEl('stop', { offset: '0%', 'stop-color': '#1677ff' }));
    lg.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#722ed1' }));
    defs.appendChild(lg);
    const rg = svgEl('radialGradient', { id: 'svg-rg', cx: '50%', cy: '50%', r: '50%' });
    rg.appendChild(svgEl('stop', { offset: '0%', 'stop-color': '#ffffff' }));
    rg.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#52c41a' }));
    defs.appendChild(rg);
    svg.appendChild(defs);

    // 标题文本（text 元素）
    const title = svgEl('text', {
      x: '200', y: '24', 'text-anchor': 'middle',
      fill: 'currentColor', 'font-size': '13', 'font-weight': '600',
    });
    title.textContent = `SVG DOM 操作（${this.state.svgShapes.length} 个形状）`;
    svg.appendChild(title);

    // 根据 state.svgShapes 重建所有形状
    for (const shape of this.state.svgShapes) {
      svg.appendChild(this._createSvgShape(shape));
    }
  }

  // 创建单个 SVG 形状元素（含 SMIL 动画）
  _createSvgShape(shape) {
    const el = svgEl(shape.type, shape.attrs);
    if (shape.animate) {
      el.appendChild(svgEl('animate', shape.animate));
    }
    return el;
  }

  // 绑定 SVG 点击监听（点击空白区域添加形状）
  _setupSvgListeners() {
    const svg = this.$('.svg-canvas');
    if (!svg) return;
    this.on(svg, 'click', (e) => {
      // 仅在点击 SVG 空白处（非形状元素）时添加
      if (e.target === svg) this._addSvgShape();
    });
  }

  // 随机添加一个形状到 SVG
  _addSvgShape() {
    const types = ['circle', 'rect', 'line', 'path', 'polygon'];
    const type = types[Math.floor(Math.random() * types.length)];
    const x = Math.floor(Math.random() * 340) + 30;
    const y = Math.floor(Math.random() * 220) + 40;
    const fill = randomColor();
    const stroke = randomColor();
    // 随机决定是否使用渐变填充
    const useGradient = Math.random() < 0.3;
    const fillVal = useGradient ? 'url(#svg-lg)' : fill;
    let attrs = {};
    let animate = null;

    switch (type) {
      case 'circle':
        attrs = {
          cx: String(x), cy: String(y), r: String(Math.floor(Math.random() * 25) + 12),
          fill: fillVal, stroke, 'stroke-width': '2',
          transform: `translate(0,0) rotate(0)`,
        };
        animate = { attributeName: 'r', values: '12;32;12', dur: '2s', repeatCount: 'indefinite' };
        break;
      case 'rect':
        attrs = {
          x: String(x), y: String(y),
          width: String(Math.floor(Math.random() * 50) + 25),
          height: String(Math.floor(Math.random() * 50) + 25),
          fill: fillVal, stroke, 'stroke-width': '2',
          transform: `rotate(${Math.floor(Math.random() * 360)} ${x} ${y})`,
        };
        animate = { attributeName: 'opacity', values: '0.4;1;0.4', dur: '1.5s', repeatCount: 'indefinite' };
        break;
      case 'line':
        attrs = {
          x1: String(x), y1: String(y),
          x2: String(x + Math.floor(Math.random() * 80) - 40),
          y2: String(y + Math.floor(Math.random() * 80) - 40),
          stroke, 'stroke-width': '3', 'stroke-linecap': 'round',
        };
        break;
      case 'path':
        attrs = {
          d: `M ${x} ${y} Q ${x + 30} ${y - 40} ${x + 60} ${y} T ${x + 120} ${y}`,
          fill: 'none', stroke, 'stroke-width': '3', 'stroke-linecap': 'round',
        };
        break;
      case 'polygon': {
        const pts = [];
        const sides = Math.floor(Math.random() * 3) + 3; // 3-5 边
        const r = Math.floor(Math.random() * 25) + 15;
        for (let i = 0; i < sides; i++) {
          const a = (Math.PI * 2 * i) / sides - Math.PI / 2;
          pts.push(`${(x + r * Math.cos(a)).toFixed(0)},${(y + r * Math.sin(a)).toFixed(0)}`);
        }
        attrs = { points: pts.join(' '), fill: fillVal, stroke, 'stroke-width': '2' };
        animate = { attributeName: 'opacity', values: '0.5;1;0.5', dur: '2s', repeatCount: 'indefinite' };
        break;
      }
    }

    const shape = { type, attrs, animate };
    this.setState({
      svgShapes: [...this.state.svgShapes, shape],
      svgShapeCount: this.state.svgShapeCount + 1,
    });
    this._addLog('svg', `添加 ${type}（fill=${fillVal}）`);
  }

  // 清空 SVG 所有形状
  _clearSvg() {
    if (this.state.svgShapes.length === 0) {
      this._addLog('svg', 'SVG 已为空');
      return;
    }
    const n = this.state.svgShapes.length;
    this.setState({ svgShapes: [], svgShapeCount: 0 });
    this._addLog('svg', `清空 ${n} 个形状`);
  }

  // ===================== 4. OffscreenCanvas + ImageBitmap =====================

  // 演示：创建 OffscreenCanvas，主线程绘制，convertToBlob → createImageBitmap
  async _demoOffscreen() {
    if (!this.state.offscreenSupported) {
      this._addLog('offscreen', '当前环境不支持 OffscreenCanvas');
      return;
    }
    try {
      // 创建 OffscreenCanvas 并在主线程绘制
      const off = new OffscreenCanvas(200, 120);
      const ctx = off.getContext('2d');
      const lg = ctx.createLinearGradient(0, 0, 200, 0);
      lg.addColorStop(0, '#1677ff');
      lg.addColorStop(1, '#52c41a');
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, 200, 120);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText('OffscreenCanvas', 100, 60);

      // convertToBlob 转 Blob，再 createImageBitmap 转 ImageBitmap
      const blob = await off.convertToBlob({ type: 'image/png' });
      const bitmap = await createImageBitmap(blob);
      const result = `OffscreenCanvas(200×120) → convertToBlob → Blob(${blob.size}B, ${blob.type}) → createImageBitmap → ImageBitmap(${bitmap.width}×${bitmap.height})`;

      // 先更新 state 与日志（触发 rerender）
      this.setState({ offscreenResult: result, imageBitmapInfo: `ImageBitmap: ${bitmap.width}×${bitmap.height}` });
      this._addLog('offscreen', `OffscreenCanvas 绘制完成 → ImageBitmap(${bitmap.width}×${bitmap.height})`);

      // 再将 ImageBitmap 绘制到 rerender 后的新 canvas（持久到下次重渲染）
      const canvas = this.$('.offscreen-canvas');
      if (canvas) {
        const c2d = canvas.getContext('2d');
        c2d.clearRect(0, 0, canvas.width, canvas.height);
        c2d.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      }
      bitmap.close();
    } catch (err) {
      this._addLog('error', `OffscreenCanvas 演示失败：${err.message}`);
    }
  }

  // 演示：transferControlToOffscreen（canvas 控制权转移）
  _demoTransferControl() {
    const canvas = this.$('.offscreen-canvas');
    if (!canvas) return;
    if (typeof canvas.transferControlToOffscreen !== 'function') {
      this._addLog('offscreen', 'transferControlToOffscreen 不可用');
      return;
    }
    try {
      // 调用后主线程无法再通过 getContext 操作该 canvas
      const off = canvas.transferControlToOffscreen();
      const ctx = off.getContext('2d');
      ctx.fillStyle = '#722ed1';
      ctx.fillRect(0, 0, off.width, off.height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText('transferControlToOffscreen', off.width / 2, off.height / 2);
      this._addLog('offscreen', `transferControlToOffscreen 成功 → OffscreenCanvas(${off.width}×${off.height})，主线程已丧失 canvas 控制权`);
    } catch (err) {
      this._addLog('error', `transferControlToOffscreen 失败：${err.message}`);
    }
  }

  // 演示：createImageBitmap 从 Blob 创建位图
  async _demoImageBitmap() {
    try {
      // 使用临时 canvas 绘制内容，再 toBlob 转 Blob
      const tmp = document.createElement('canvas');
      tmp.width = 200; tmp.height = 120;
      const ctx = tmp.getContext('2d');
      const lg = ctx.createLinearGradient(0, 0, 200, 120);
      lg.addColorStop(0, '#faad14');
      lg.addColorStop(1, '#ff4d4f');
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, 200, 120);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText('createImageBitmap', 100, 60);

      // canvas.toBlob → createImageBitmap
      const blob = await new Promise((resolve) => tmp.toBlob(resolve, 'image/png'));
      const bitmap = await createImageBitmap(blob);

      // 先更新 state 与日志（触发 rerender）
      this.setState({ imageBitmapInfo: `ImageBitmap: ${bitmap.width}×${bitmap.height}，源 Blob: ${blob.size}B (${blob.type})` });
      this._addLog('offscreen', `createImageBitmap 完成 → ${bitmap.width}×${bitmap.height}，源 Blob ${blob.size}B`);

      // 再绘制到 rerender 后的新 canvas
      const canvas = this.$('.offscreen-canvas');
      if (canvas) {
        const c2d = canvas.getContext('2d');
        c2d.clearRect(0, 0, canvas.width, canvas.height);
        c2d.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      }
      bitmap.close();
    } catch (err) {
      this._addLog('error', `createImageBitmap 失败：${err.message}`);
    }
  }

  // ===================== 渲染 =====================

  // 构建 SVG 容器（必须用 createElementNS，h() 使用 document.createElement 无法创建 SVG 命名空间元素）
  _buildSvgContainer() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'svg-canvas');
    svg.setAttribute('width', '400');
    svg.setAttribute('height', '300');
    svg.setAttribute('viewBox', '0 0 400 300');
    return svg;
  }

  renderPage() {
    return [
      h('h2', { class: 'section-title' }, '图形与渲染 API 实验室'),

      h(Alert, {
        type: 'info',
        message: 'WebGL / SVG / OffscreenCanvas / ImageBitmap',
        description: '四大图形 API 综合演示：WebGL 着色器与缓冲区（三角形）、3D 旋转立方体（rAF + drawElements + 矩阵）、SVG DOM 动态操作与渐变、OffscreenCanvas 与 ImageBitmap 位图转换。',
      }),

      // ============ 1. WebGL 基础 ============
      h(Card, {
        title: '1. WebGL 基础（着色器 + 缓冲区 + 三角形）',
        extra: h(Tag, { color: this.state.webglSupported ? 'success' : 'error' }, this.state.webglSupported ? '已就绪' : '不支持'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'canvas.getContext(\'webgl\') 获取上下文，编写顶点/片段着色器（GLSL），编译链接为 program，创建 Float32Array 顶点缓冲区，vertexAttribPointer 设置属性指针，drawArrays 绘制彩色三角形。getParameter 读取版本/厂商/渲染器信息。'),
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            this._btn('切换 uniform 颜色', { type: 'primary', size: 'sm', onClick: () => this._switchColor() }),
            h('span', { class: 'fs-sm text-tertiary' },
              `当前 uColor: [${this.state.webglColor.slice(0, 3).map((v) => v.toFixed(2)).join(', ')}]`),
          ),
          h('canvas', { class: 'webgl-canvas', width: 400, height: 300 }),
          h('div', { class: 'fs-sm text-secondary mt-sm' }, 'WebGL 上下文信息（getParameter）：'),
          h('pre', { class: 'code-block' }, this.state.webglInfo),
        ),
      ),

      // ============ 2. WebGL 进阶 ============
      h(Card, {
        title: '2. WebGL 进阶（动画 + 3D 变换 + 深度测试）',
        extra: h(Tag, { color: 'primary' }, 'rAF + drawElements'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'requestAnimationFrame 驱动旋转动画，索引缓冲区（ELEMENT_ARRAY_BUFFER）+ drawElements 绘制立方体，手动计算 4×4 modelView/projection 矩阵，uniform 传入 uTime，gl.enable(DEPTH_TEST) 启用深度测试。'),
          h('canvas', { class: 'webgl-canvas-3d', width: 400, height: 300 }),
        ),
      ),

      // ============ 3. SVG DOM 操作 ============
      h(Card, {
        title: '3. SVG DOM 操作（动态创建与属性修改）',
        extra: h(Tag, { color: this.state.svgShapeCount > 0 ? 'success' : 'default' }, `${this.state.svgShapeCount} 形状`),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'document.createElementNS(\'http://www.w3.org/2000/svg\', tag) 创建 SVG 元素，setAttribute 设置 cx/cy/r/fill/stroke/transform 等属性，linearGradient/radialGradient 渐变，SMIL <animate> 动画。点击 SVG 空白处也可添加形状。'),
          h('div', { class: 'flex gap-sm' },
            this._btn('添加形状', { type: 'primary', size: 'sm', onClick: () => this._addSvgShape() }),
            this._btn('清空', { danger: true, size: 'sm', onClick: () => this._clearSvg() }),
          ),
          this._buildSvgContainer(),
        ),
      ),

      // ============ 4. OffscreenCanvas + ImageBitmap ============
      h(Card, {
        title: '4. OffscreenCanvas + ImageBitmap',
        extra: h(Tag, { color: this.state.offscreenSupported ? 'success' : 'error' }, this.state.offscreenSupported ? '支持' : '不支持'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            '检测 typeof OffscreenCanvas，主线程创建 OffscreenCanvas 绘制，convertToBlob 转 Blob，createImageBitmap 转 ImageBitmap。transferControlToOffscreen 将 canvas 控制权转移（最佳场景为 Worker，此处简化为主线程）。'),
          this.state.offscreenSupported
            ? h('div', { class: 'flex gap-sm flex-wrap' },
              this._btn('绘制 OffscreenCanvas', { type: 'primary', size: 'sm', onClick: () => this._demoOffscreen() }),
              this._btn('transferControlToOffscreen', { size: 'sm', onClick: () => this._demoTransferControl() }),
              this._btn('createImageBitmap', { size: 'sm', onClick: () => this._demoImageBitmap() }),
            )
            : h(Alert, { type: 'warning', message: '当前浏览器不支持 OffscreenCanvas', description: '可尝试在 Chrome / Edge 中查看本演示。' }),
          h('canvas', { class: 'offscreen-canvas', width: 400, height: 200 }),
          this.state.offscreenResult && h('div', { class: 'fs-sm text-secondary' }, this.state.offscreenResult),
          this.state.imageBitmapInfo && h('div', { class: 'fs-sm text-secondary' }, this.state.imageBitmapInfo),
        ),
      ),

      // ============ 日志面板 ============
      h(Card, {
        title: '事件日志',
        extra: h(Tag, { color: 'primary' }, `${this.state.logs.length} 条`),
      },
        this.state.logs.length === 0
          ? h('div', { class: 'fs-sm text-tertiary' }, '（暂无日志）')
          : h('div', { class: 'log-panel' },
            ...this.state.logs.map((log) => h('div', { class: 'log-panel__line' },
              h('span', { class: 'log-panel__time' }, log.time),
              h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
              h('span', {}, log.content),
            )),
          ),
      ),
    ];
  }
}
