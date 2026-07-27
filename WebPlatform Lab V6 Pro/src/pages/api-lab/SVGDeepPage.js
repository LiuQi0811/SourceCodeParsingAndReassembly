// =====================================================================
// SVGDeepPage.js —— SVG 矢量图形深度实验室
// 演示 MDN：
//   1. SVG DOM 创建与命名空间（createElementNS / setAttributeNS / viewBox / preserveAspectRatio）
//   2. SVGPathElement 路径几何（getTotalLength / getPointAtLength / pathLength / 命令集）
//   3. SVGTransform 变换 + SMIL 动画（transform.baseVal / animateTransform / beginElement / endElement）
//   4. SVG 滤镜 filter（feGaussianBlur / feColorMatrix / feOffset / feMerge）
//   5. clipPath 剪裁 + mask 蒙版（clip-path / mask / clip-rule / clipPathUnits / maskContentUnits）
// 兼容性：jsdom 中 createElementNS 可创建元素、SVGPathElement 类型存在，但 getTotalLength/
//   getPointAtLength 可能返回 0 或抛 Not implemented；滤镜/clipPath/mask 只是 DOM 结构存在不会
//   真正渲染；SMIL beginElement/endElement 在 jsdom 不支持。所有调用前 typeof 检测 + try/catch。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// SVG 与 xlink 命名空间常量
const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

// 路径命令速查表（Card 2 展示）
const PATH_COMMANDS_TABLE = [
  { cmd: 'M / m', name: 'moveto',         desc: '移动画笔到指定点；小写为相对坐标' },
  { cmd: 'L / l', name: 'lineto',         desc: '画直线到指定点' },
  { cmd: 'H / h', name: 'horizontal',     desc: '画水平线到指定 x 坐标' },
  { cmd: 'V / v', name: 'vertical',       desc: '画垂直线到指定 y 坐标' },
  { cmd: 'C / c', name: 'cubic bezier',   desc: '三次贝塞尔曲线（两个控制点 + 终点）' },
  { cmd: 'Q / q', name: 'quadratic',      desc: '二次贝塞尔曲线（一个控制点 + 终点）' },
  { cmd: 'S / s', name: 'smooth cubic',   desc: '平滑三次贝塞尔（控制点自动对称）' },
  { cmd: 'T / t', name: 'smooth quad',    desc: '平滑二次贝塞尔（控制点自动对称）' },
  { cmd: 'A / a', name: 'arc',            desc: '椭圆弧（rx ry x-axis-rotation large-arc sweep x y）' },
  { cmd: 'Z / z', name: 'closepath',      desc: '闭合路径回到起点' },
];

// 安全创建带命名空间的 SVG 元素
function svgEl(tag) {
  return document.createElementNS(SVG_NS, tag);
}

export class SVGDeepPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],                // 共享事件日志
      capsSummary: '',         // 能力检测摘要（componentDidMount 中填充，非空才显示 Alert）
      pathLength: '',          // Card 2 路径总长度文本
      pointList: '',           // Card 2 沿路径取点结果
      filterStatus: '未应用',   // Card 4 当前滤镜状态
      clipStatus: '未应用',     // Card 5 当前剪裁 / 蒙版状态
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // —— 幂等初始化实例引用（render 在 componentDidMount 之前执行，需安全读取；rerender 会
    //    再次触发 componentDidMount，条件赋值避免重置已持有的句柄，与 WebAnimationsPage 一致）——
    if (this._smilAnim === undefined) this._smilAnim = null;          // Card 3 SMIL <animateTransform> 引用
    if (this._rafId === undefined) this._rafId = null;                // requestAnimationFrame 句柄
    if (this._viewBoxScale === undefined) this._viewBoxScale = 1;    // Card 1 当前 viewBox 缩放系数
    if (this._currentFilter === undefined) this._currentFilter = null; // Card 4 当前应用的 filter id
    if (this._filterDefs === undefined) this._filterDefs = null;     // Card 4 filter <defs> 引用
    if (this._clipDef === undefined) this._clipDef = null;           // Card 5 clipPath 引用
    if (this._maskDef === undefined) this._maskDef = null;           // Card 5 mask 引用

    // ★★★ 关键守卫：必须存在！否则 setState → rerender → componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // —— 能力检测（仅 typeof 判定，绝不抛异常）——
    const createNsSupported = typeof document !== 'undefined'
      && typeof document.createElementNS === 'function';
    const svgPathSupported = typeof SVGPathElement !== 'undefined';
    const svgTransformSupported = typeof SVGTransform !== 'undefined';
    const svgElementSupported = typeof SVGElement !== 'undefined';

    const summary = '能力检测：document.createElementNS=' + (createNsSupported ? '✓' : '✗')
      + '，SVGPathElement=' + (svgPathSupported ? '✓' : '✗')
      + '，SVGTransform=' + (svgTransformSupported ? '✓' : '✗')
      + '，SVGElement=' + (svgElementSupported ? '✓' : '✗')
      + '（注：jsdom 中 SVG 元素可创建，但 getTotalLength / 滤镜渲染 / SMIL beginElement 多为 stub）';
    this.setState({ capsSummary: summary });
    this._addLog('info', summary);

    // 不可用能力统一记录 warn
    const missing = [
      [createNsSupported, 'document.createElementNS 不可用，SVG DOM 创建演示将跳过'],
      [svgPathSupported, 'SVGPathElement 类型不可用，路径几何演示将回退'],
      [svgTransformSupported, 'SVGTransform 不可用，变换 API 演示将回退'],
      [svgElementSupported, 'SVGElement 不可用，SVG 操作受限'],
    ];
    missing.forEach(([ok, msg]) => { if (!ok) this._addLog('warn', msg); });
  }

  componentWillUnmount() {
    // 清理 requestAnimationFrame 句柄
    if (this._rafId != null) {
      try { cancelAnimationFrame(this._rafId); } catch { /* noop */ }
      this._rafId = null;
    }
    // 清理各类 DOM 句柄引用（元素随页面卸载移除，这里只清句柄便于 GC）
    this._smilAnim = null;
    this._filterDefs = null;
    this._clipDef = null;
    this._maskDef = null;
    this._currentFilter = null;
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

  // 安全获取 DOM 元素（每次重新 getElementById，避免 rerender 后旧引用失效）
  _el(id) {
    try { return document.getElementById(id); } catch { return null; }
  }

  // —— 同步能力检测（render 时调用，开销可忽略）——
  _caps() {
    return {
      createNs: typeof document !== 'undefined' && typeof document.createElementNS === 'function',
      svgPath: typeof SVGPathElement !== 'undefined',
      svgTransform: typeof SVGTransform !== 'undefined',
      svgElement: typeof SVGElement !== 'undefined',
    };
  }

  // 演示容器内联样式（避免依赖额外注入样式）
  _demoHostStyle() {
    return {
      minHeight: '180px',
      padding: '8px',
      border: '1px dashed #444',
      borderRadius: '6px',
      background: '#0f0f1a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      flexWrap: 'wrap',
    };
  }

  // 动态创建 svg + rect + circle + path 并插入演示区
  _createSvgElements() {
    if (!this._caps().createNs) {
      this._addLog('warn', 'document.createElementNS 不可用，无法创建 SVG 元素');
      return;
    }
    const host = this._el('svg-dom-host');
    if (!host) { this._addLog('warn', '未找到演示容器 #svg-dom-host'); return; }
    try {
      // 清空旧内容
      while (host.firstChild) host.removeChild(host.firstChild);
      // 创建 <svg> 根元素（命名空间必须显式传入，否则被当作未知 HTML 元素）
      const svg = svgEl('svg');
      svg.setAttribute('width', '320');
      svg.setAttribute('height', '160');
      svg.setAttribute('viewBox', '0 0 320 160');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      // 矩形 rect
      const rect = svgEl('rect');
      rect.setAttribute('x', '20');
      rect.setAttribute('y', '20');
      rect.setAttribute('width', '80');
      rect.setAttribute('height', '50');
      rect.setAttribute('fill', '#1677ff');
      rect.setAttribute('stroke', '#0958d9');
      rect.setAttribute('stroke-width', '2');
      // 圆形 circle
      const circle = svgEl('circle');
      circle.setAttribute('cx', '200');
      circle.setAttribute('cy', '60');
      circle.setAttribute('r', '30');
      circle.setAttribute('fill', '#52c41a');
      // 路径 path（三角形，演示 M / L / Z 命令）
      const path = svgEl('path');
      path.setAttribute('d', 'M260 30 L300 90 L220 90 Z');
      path.setAttribute('fill', '#faad14');
      svg.append(rect, circle, path);
      host.appendChild(svg);
      // 演示 setAttributeNS 设置命名空间属性（xlink:href），与 setAttribute 区别
      try {
        const use = svgEl('use');
        use.setAttributeNS(XLINK_NS, 'href', '#unused');
        this._addLog('ns', 'setAttributeNS(XLINK_NS, "href", url) 演示成功（xlink:href 命名空间属性）');
        use.remove();
      } catch (err) {
        this._addLog('ns', 'setAttributeNS 演示失败：' + (err && err.message));
      }
      this._viewBoxScale = 1;
      this._addLog('svg', '已用 createElementNS(SVG_NS, "svg"/"rect"/"circle"/"path") 创建并插入 3 个图元（矩形+圆形+三角形）');
      this._addLog('ns', 'SVG 与 HTML DOM 区别：属性值均为字符串；命名空间属性（如 xlink:href）需用 setAttributeNS 设置，setAttribute 不带命名空间会失效');
    } catch (err) {
      this._addLog('err', '创建 SVG 元素失败：' + (err && err.message));
    }
  }

  // 修改 viewBox 缩放（在 1x / 0.5x / 2x 之间循环，实现镜头推拉）
  _modifyViewBox() {
    if (!this._caps().createNs) {
      this._addLog('warn', 'document.createElementNS 不可用');
      return;
    }
    const svg = this._el('svg-dom-host')?.querySelector('svg');
    if (!svg) { this._addLog('warn', '请先点击「动态创建 SVG 元素」'); return; }
    try {
      // 缩放系数循环：1 → 0.5 → 2 → 1
      this._viewBoxScale = this._viewBoxScale === 1 ? 0.5 : (this._viewBoxScale === 0.5 ? 2 : 1);
      const s = this._viewBoxScale;
      // viewBox="minX minY width height"：缩小可视区域 = 放大内容（zoom in）
      const vb = `${160 - 160 / s} ${80 - 80 / s} ${320 / s} ${160 / s}`;
      svg.setAttribute('viewBox', vb);
      this._addLog('svg', `viewBox 改为 "${vb}"（缩放系数 ${s}x，preserveAspectRatio=xMidYMid meet）`);
      this._addLog('ns', 'viewBox="minX minY width height" 定义用户坐标系；缩小 width/height 即放大可见内容');
    } catch (err) {
      this._addLog('err', '修改 viewBox 失败：' + (err && err.message));
    }
  }

  // 确保 Card 2 演示路径已存在；返回 { svg, path } 或 null
  _ensurePath() {
    if (!this._caps().createNs || !this._caps().svgPath) return null;
    const host = this._el('svg-path-host');
    if (!host) return null;
    let svg = host.querySelector('svg');
    if (!svg) {
      svg = svgEl('svg');
      svg.setAttribute('width', '320');
      svg.setAttribute('height', '180');
      svg.setAttribute('viewBox', '0 0 320 180');
      host.appendChild(svg);
    }
    let path = svg.querySelector('path.svg-path-demo');
    if (!path) {
      path = svgEl('path');
      path.setAttribute('class', 'svg-path-demo');
      // 复杂路径：M + C 三次贝塞尔 + S 平滑三次 + A 椭圆弧 + Z 闭合
      path.setAttribute('d', 'M20 140 C 60 40, 120 40, 160 100 S 260 200, 300 60 A 30 30 0 1 1 280 140 Z');
      path.setAttribute('fill', 'rgba(22,119,255,0.15)');
      path.setAttribute('stroke', '#1677ff');
      path.setAttribute('stroke-width', '2');
      svg.appendChild(path);
    }
    return { svg, path };
  }

  // 计算路径总长度 getTotalLength
  _computePathLength() {
    const caps = this._caps();
    if (!caps.createNs || !caps.svgPath) {
      this._addLog('warn', 'createElementNS 或 SVGPathElement 不可用，无法计算路径长度');
      return;
    }
    const ref = this._ensurePath();
    if (!ref) { this._addLog('warn', '未找到演示容器 #svg-path-host'); return; }
    try {
      const { path } = ref;
      // pathLength 属性可设为规范化值（不影响几何，仅作为 getPointAtLength 的归一化参考）
      try { path.pathLength = 1000; } catch { /* jsdom 可能只读 */ }
      // 关键：getTotalLength() 在 jsdom 通常抛 Not implemented 或返回 0
      const total = (typeof path.getTotalLength === 'function') ? path.getTotalLength() : 0;
      const lenStr = (typeof total === 'number' && total > 0)
        ? total.toFixed(2) + ' 用户单位'
        : '0（jsdom 未实现几何计算，浏览器中可得真实长度）';
      this.setState({ pathLength: lenStr });
      this._addLog('path', '路径命令：M → C(三次贝塞尔) → S(平滑三次) → A(椭圆弧) → Z(闭合)');
      this._addLog('len', `path.getTotalLength() = ${lenStr}；pathLength 属性=${path.pathLength ?? '—'}（可设为规范化值）`);
    } catch (err) {
      this._addLog('err', 'getTotalLength 调用失败：' + (err && err.message));
      this.setState({ pathLength: '调用失败：' + (err && err.message) });
    }
  }

  // 沿路径取 5 个等距点并画标记
  _samplePathPoints() {
    const caps = this._caps();
    if (!caps.createNs || !caps.svgPath) {
      this._addLog('warn', 'createElementNS 或 SVGPathElement 不可用，无法取点');
      return;
    }
    const ref = this._ensurePath();
    if (!ref) { this._addLog('warn', '未找到演示容器 #svg-path-host'); return; }
    try {
      const { svg, path } = ref;
      if (typeof path.getTotalLength !== 'function' || typeof path.getPointAtLength !== 'function') {
        this._addLog('warn', 'getPointAtLength / getTotalLength 方法不可用（jsdom 限制）');
        return;
      }
      const total = path.getTotalLength();
      if (!total || total <= 0) {
        this._addLog('warn', 'getTotalLength 返回 0（jsdom 未实现几何计算），无法沿路径取点');
        this.setState({ pointList: 'getTotalLength=0，jsdom 未实现几何计算' });
        return;
      }
      // 沿路径取 N 个等距点并画红色标记圆
      const N = 5;
      const markersOld = svg.querySelectorAll('circle.path-marker');
      markersOld.forEach((m) => m.remove());
      const points = [];
      for (let i = 0; i < N; i++) {
        const d = (total * i) / (N - 1);
        const pt = path.getPointAtLength(d);
        points.push(`#${i + 1} @${d.toFixed(1)} → (${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`);
        const marker = svgEl('circle');
        marker.setAttribute('class', 'path-marker');
        marker.setAttribute('cx', String(pt.x));
        marker.setAttribute('cy', String(pt.y));
        marker.setAttribute('r', '4');
        marker.setAttribute('fill', '#ff4d4f');
        svg.appendChild(marker);
      }
      const list = points.join('\n');
      this.setState({ pointList: list });
      this._addLog('path', `沿路径取 ${N} 个等距点（getPointAtLength），已用红色圆点标记`);
      this._addLog('len', points.join(' | '));
    } catch (err) {
      this._addLog('err', 'getPointAtLength 调用失败：' + (err && err.message));
      this.setState({ pointList: '调用失败：' + (err && err.message) });
    }
  }

  // 插入 <animateTransform> 让矩形旋转，演示 SVGTransformList 与 SMIL
  _addSmilRotation() {
    const caps = this._caps();
    if (!caps.createNs) {
      this._addLog('warn', 'document.createElementNS 不可用，无法创建 SMIL 元素');
      return;
    }
    const host = this._el('svg-smil-host');
    if (!host) { this._addLog('warn', '未找到演示容器 #svg-smil-host'); return; }
    try {
      // 重建以保证干净状态
      while (host.firstChild) host.removeChild(host.firstChild);
      const svg = svgEl('svg');
      svg.setAttribute('width', '320');
      svg.setAttribute('height', '180');
      svg.setAttribute('viewBox', '0 0 320 180');

      const rect = svgEl('rect');
      rect.setAttribute('x', '110');
      rect.setAttribute('y', '50');
      rect.setAttribute('width', '100');
      rect.setAttribute('height', '60');
      rect.setAttribute('fill', '#722ed1');
      rect.setAttribute('rx', '8');
      // 旋转中心：rect 中心 (160, 80)
      rect.setAttribute('transform', 'rotate(0 160 80)');
      svg.appendChild(rect);

      // 演示 SVGTransformList：通过 baseVal 编程式添加 transform
      try {
        if (caps.svgTransform && rect.transform && typeof rect.transform.baseVal !== 'undefined'
          && typeof svg.createSVGTransform === 'function') {
          const tfList = rect.transform.baseVal;
          const tf = svg.createSVGTransform();
          if (tf) {
            tf.setTranslate(0, 0);
            tfList.appendItem(tf);
            tfList.consolidate();
            this._addLog('transform', 'transform.baseVal.appendItem + consolidate 已合并变换列表（编程式 SVGTransform）');
          }
        } else {
          this._addLog('transform', 'SVGTransformList / createSVGTransform 不可用（jsdom 限制），仅用 transform 属性');
        }
      } catch (err2) {
        this._addLog('transform', 'SVGTransformList 操作失败：' + (err2 && err2.message));
      }

      // 创建 <animateTransform> SMIL 动画元素
      const anim = svgEl('animateTransform');
      anim.setAttribute('attributeName', 'transform');
      anim.setAttribute('type', 'rotate');
      anim.setAttribute('from', '0 160 80');
      anim.setAttribute('to', '360 160 80');
      anim.setAttribute('dur', '2s');
      anim.setAttribute('repeatCount', 'indefinite');
      rect.appendChild(anim);
      this._smilAnim = anim;
      host.appendChild(svg);

      this._addLog('smil', '已插入 <animateTransform>（type=rotate, from=0 160 80, to=360 160 80, dur=2s, repeatCount=indefinite）');
      this._addLog('transform', 'SVGTransform 类型：translate(x,y) / rotate(angle,cx,cy) / scale(sx,sy) / skewX / skewY / matrix(a,b,c,d,e,f)');
      this._addLog('smil', 'SMIL 四类：<animate> / <animateTransform> / <animateMotion> / <set>；jsdom 不会真正播放，浏览器中可用 beginElement 启动');
    } catch (err) {
      this._addLog('err', '添加 SMIL 动画失败：' + (err && err.message));
    }
  }

  // beginElement 启动 SMIL 动画
  _beginSmil() {
    if (!this._smilAnim) {
      this._addLog('warn', '请先点击「添加 SMIL 旋转动画」创建 animateTransform 元素');
      return;
    }
    try {
      if (typeof this._smilAnim.beginElement !== 'function') {
        this._addLog('warn', 'beginElement 不可用（jsdom 不支持 SMIL 控制方法），浏览器中可启动动画');
        return;
      }
      this._smilAnim.beginElement();
      this._addLog('smil', 'animateTransform.beginElement() 已调用，动画启动（浏览器中矩形开始旋转）');
    } catch (err) {
      this._addLog('err', 'beginElement 失败：' + (err && err.message));
    }
  }

  // endElement 停止 SMIL 动画
  _endSmil() {
    if (!this._smilAnim) {
      this._addLog('warn', '请先点击「添加 SMIL 旋转动画」');
      return;
    }
    try {
      if (typeof this._smilAnim.endElement !== 'function') {
        this._addLog('warn', 'endElement 不可用（jsdom 不支持 SMIL 控制方法），浏览器中可停止动画');
        return;
      }
      this._smilAnim.endElement();
      this._addLog('smil', 'animateTransform.endElement() 已调用，动画停止');
    } catch (err) {
      this._addLog('err', 'endElement 失败：' + (err && err.message));
    }
  }

  // 确保滤镜演示宿主已存在，返回 svg
  _ensureFilterHost() {
    const host = this._el('svg-filter-host');
    if (!host) return null;
    let svg = host.querySelector('svg');
    if (!svg) {
      svg = svgEl('svg');
      svg.setAttribute('width', '320');
      svg.setAttribute('height', '180');
      svg.setAttribute('viewBox', '0 0 320 180');
      // defs 容器放滤镜定义
      const defs = svgEl('defs');
      svg.appendChild(defs);
      this._filterDefs = defs;
      // 目标矩形（被滤镜作用）
      const rect = svgEl('rect');
      rect.setAttribute('id', 'svg-filter-rect');
      rect.setAttribute('x', '90');
      rect.setAttribute('y', '50');
      rect.setAttribute('width', '140');
      rect.setAttribute('height', '80');
      rect.setAttribute('fill', '#13c2c2');
      rect.setAttribute('rx', '6');
      svg.appendChild(rect);
      host.appendChild(svg);
    } else {
      this._filterDefs = svg.querySelector('defs');
    }
    return svg;
  }

  // 清空 defs 中所有滤镜定义并移除 rect 的 filter 属性
  _clearFilters() {
    const host = this._el('svg-filter-host');
    const svg = host?.querySelector('svg');
    const defs = svg?.querySelector('defs');
    if (defs) {
      try { while (defs.firstChild) defs.removeChild(defs.firstChild); } catch { /* noop */ }
    }
    this._filterDefs = defs;
    const rect = this._el('svg-filter-rect');
    if (rect) {
      try { rect.removeAttribute('filter'); } catch { /* noop */ }
    }
    this._currentFilter = null;
  }

  // 应用高斯模糊 feGaussianBlur
  _applyBlur() {
    if (!this._caps().createNs) {
      this._addLog('warn', 'document.createElementNS 不可用，无法构造滤镜');
      return;
    }
    const svg = this._ensureFilterHost();
    if (!svg) { this._addLog('warn', '未找到演示容器 #svg-filter-host'); return; }
    try {
      this._clearFilters();
      // <filter id><feGaussianBlur in="SourceGraphic" stdDeviation="3"/></filter>
      const filter = svgEl('filter');
      filter.setAttribute('id', 'svg-blur-filter');
      filter.setAttribute('x', '-20%');
      filter.setAttribute('y', '-20%');
      filter.setAttribute('width', '140%');
      filter.setAttribute('height', '140%');
      const blur = svgEl('feGaussianBlur');
      blur.setAttribute('in', 'SourceGraphic');
      blur.setAttribute('stdDeviation', '3');
      filter.appendChild(blur);
      this._filterDefs.appendChild(filter);
      const rect = this._el('svg-filter-rect');
      rect.setAttribute('filter', 'url(#svg-blur-filter)');
      this._currentFilter = 'blur';
      this.setState({ filterStatus: '高斯模糊 (feGaussianBlur stdDeviation=3)' });
      this._addLog('filter', '已构造 <filter><feGaussianBlur in="SourceGraphic" stdDeviation="3"/></filter> 并应用 url(#svg-blur-filter)');
      this._addLog('blur', 'feGaussianBlur.stdDeviation 越大越模糊；滤镜区域需用 x/y/width/height 扩展否则边缘裁切');
    } catch (err) {
      this._addLog('err', '应用高斯模糊失败：' + (err && err.message));
    }
  }

  // 应用阴影滤镜（feOffset + feGaussianBlur + feColorMatrix + feMerge）
  _applyShadow() {
    if (!this._caps().createNs) {
      this._addLog('warn', 'document.createElementNS 不可用，无法构造滤镜');
      return;
    }
    const svg = this._ensureFilterHost();
    if (!svg) { this._addLog('warn', '未找到演示容器 #svg-filter-host'); return; }
    try {
      this._clearFilters();
      // 阴影管线：feOffset 偏移 → feGaussianBlur 模糊 → feColorMatrix 染色 → feMerge 合并原图与阴影
      const filter = svgEl('filter');
      filter.setAttribute('id', 'svg-shadow-filter');
      filter.setAttribute('x', '-20%');
      filter.setAttribute('y', '-20%');
      filter.setAttribute('width', '140%');
      filter.setAttribute('height', '140%');
      const offset = svgEl('feOffset');
      offset.setAttribute('in', 'SourceAlpha');
      offset.setAttribute('dx', '5');
      offset.setAttribute('dy', '5');
      offset.setAttribute('result', 'offset');
      const blur = svgEl('feGaussianBlur');
      blur.setAttribute('in', 'offset');
      blur.setAttribute('stdDeviation', '2');
      blur.setAttribute('result', 'blur');
      // feColorMatrix 把阴影染成半透明黑（演示颜色矩阵 4x5）
      const colorMatrix = svgEl('feColorMatrix');
      colorMatrix.setAttribute('in', 'blur');
      colorMatrix.setAttribute('type', 'matrix');
      colorMatrix.setAttribute('values', '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0');
      colorMatrix.setAttribute('result', 'shadow');
      const merge = svgEl('feMerge');
      const node1 = svgEl('feMergeNode');
      node1.setAttribute('in', 'shadow');
      const node2 = svgEl('feMergeNode');
      node2.setAttribute('in', 'SourceGraphic');
      merge.appendChild(node1);
      merge.appendChild(node2);
      filter.append(offset, blur, colorMatrix, merge);
      this._filterDefs.appendChild(filter);
      const rect = this._el('svg-filter-rect');
      rect.setAttribute('filter', 'url(#svg-shadow-filter)');
      this._currentFilter = 'shadow';
      this.setState({ filterStatus: '阴影 (feOffset+feGaussianBlur+feColorMatrix+feMerge)' });
      this._addLog('filter', '已构造阴影滤镜：feOffset(dx=5,dy=5) → feGaussianBlur(2) → feColorMatrix(半透明黑) → feMerge 合并');
      this._addLog('blur', 'feColorMatrix type="matrix" values 是 4x5 矩阵（RGBA 各一行 + 偏移）；feMerge 合并多个输入，feMergeNode in 指定输入源');
    } catch (err) {
      this._addLog('err', '应用阴影滤镜失败：' + (err && err.message));
    }
  }

  // 移除滤镜
  _removeFilter() {
    if (!this._caps().createNs) {
      this._addLog('warn', 'document.createElementNS 不可用');
      return;
    }
    try {
      this._clearFilters();
      this.setState({ filterStatus: '未应用' });
      this._addLog('filter', '已移除 filter 属性与 defs 中所有滤镜定义');
    } catch (err) {
      this._addLog('err', '移除滤镜失败：' + (err && err.message));
    }
  }

  // 确保剪裁 / 蒙版演示宿主已存在，返回 svg
  _ensureClipHost() {
    const host = this._el('svg-clip-host');
    if (!host) return null;
    let svg = host.querySelector('svg');
    if (!svg) {
      svg = svgEl('svg');
      svg.setAttribute('width', '320');
      svg.setAttribute('height', '180');
      svg.setAttribute('viewBox', '0 0 320 180');
      const defs = svgEl('defs');
      svg.appendChild(defs);
      // 目标矩形（彩色块，演示被剪裁 / 蒙版的图元）
      const rect = svgEl('rect');
      rect.setAttribute('id', 'svg-clip-rect');
      rect.setAttribute('x', '60');
      rect.setAttribute('y', '30');
      rect.setAttribute('width', '200');
      rect.setAttribute('height', '120');
      rect.setAttribute('fill', '#fa8c16');
      svg.appendChild(rect);
      host.appendChild(svg);
    }
    return svg;
  }

  // 清空 defs 中所有 clipPath / mask / 渐变定义并移除 rect 的属性
  _clearClipDefs() {
    const svg = this._ensureClipHost();
    if (!svg) return;
    const defs = svg.querySelector('defs');
    if (defs) {
      try { while (defs.firstChild) defs.removeChild(defs.firstChild); } catch { /* noop */ }
    }
    this._clipDef = null;
    this._maskDef = null;
    const rect = this._el('svg-clip-rect');
    if (rect) {
      try { rect.removeAttribute('clip-path'); rect.removeAttribute('mask'); } catch { /* noop */ }
    }
  }

  // 应用 clipPath 圆形剪裁
  _applyClip() {
    if (!this._caps().createNs) {
      this._addLog('warn', 'document.createElementNS 不可用，无法构造 clipPath');
      return;
    }
    const svg = this._ensureClipHost();
    if (!svg) { this._addLog('warn', '未找到演示容器 #svg-clip-host'); return; }
    try {
      this._clearClipDefs();
      const defs = svg.querySelector('defs');
      // <clipPath id="myClip"><circle/></clipPath>
      const clip = svgEl('clipPath');
      clip.setAttribute('id', 'svg-circle-clip');
      clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
      const circle = svgEl('circle');
      circle.setAttribute('cx', '160');
      circle.setAttribute('cy', '90');
      circle.setAttribute('r', '60');
      // 演示 clip-rule
      circle.setAttribute('clip-rule', 'evenodd');
      clip.appendChild(circle);
      defs.appendChild(clip);
      this._clipDef = clip;
      const rect = this._el('svg-clip-rect');
      rect.setAttribute('clip-path', 'url(#svg-circle-clip)');
      this.setState({ clipStatus: 'clipPath 圆形剪裁 (clip-rule=evenodd)' });
      this._addLog('clip', '已构造 <clipPath id><circle r=60/></clipPath>，应用 clip-path="url(#svg-circle-clip)" 把矩形剪成圆形');
      this._addLog('clip', 'clipPathUnits=userSpaceOnUse（默认）| objectBoundingBox；clip-rule=evenodd|nonzero 控制自交路径填充规则');
    } catch (err) {
      this._addLog('err', '应用 clipPath 失败：' + (err && err.message));
    }
  }

  // 应用 mask 渐变蒙版（白显黑隐）
  _applyMask() {
    if (!this._caps().createNs) {
      this._addLog('warn', 'document.createElementNS 不可用，无法构造 mask');
      return;
    }
    const svg = this._ensureClipHost();
    if (!svg) { this._addLog('warn', '未找到演示容器 #svg-clip-host'); return; }
    try {
      this._clearClipDefs();
      const defs = svg.querySelector('defs');
      // 线性渐变（蒙版用白→黑实现渐变透明）
      const grad = svgEl('linearGradient');
      grad.setAttribute('id', 'svg-mask-grad');
      grad.setAttribute('x1', '0');
      grad.setAttribute('y1', '0');
      grad.setAttribute('x2', '1');
      grad.setAttribute('y2', '0');
      const stop1 = svgEl('stop');
      stop1.setAttribute('offset', '0%');
      stop1.setAttribute('stop-color', '#ffffff');
      const stop2 = svgEl('stop');
      stop2.setAttribute('offset', '100%');
      stop2.setAttribute('stop-color', '#000000');
      grad.appendChild(stop1);
      grad.appendChild(stop2);
      defs.appendChild(grad);
      // <mask id="myMask"><rect fill="url(#grad)"/></mask>（白显黑隐）
      const mask = svgEl('mask');
      mask.setAttribute('id', 'svg-grad-mask');
      mask.setAttribute('maskContentUnits', 'userSpaceOnUse');
      const maskRect = svgEl('rect');
      maskRect.setAttribute('x', '60');
      maskRect.setAttribute('y', '30');
      maskRect.setAttribute('width', '200');
      maskRect.setAttribute('height', '120');
      maskRect.setAttribute('fill', 'url(#svg-mask-grad)');
      mask.appendChild(maskRect);
      defs.appendChild(mask);
      this._maskDef = mask;
      const rect = this._el('svg-clip-rect');
      rect.setAttribute('mask', 'url(#svg-grad-mask)');
      this.setState({ clipStatus: 'mask 渐变蒙版 (白显黑隐)' });
      this._addLog('mask', '已构造 <mask id><rect fill="url(#渐变)"/></mask>，应用 mask="url(#svg-grad-mask)" 做渐变透明');
      this._addLog('mask', 'mask 约定：白色=完全显示、黑色=完全隐藏、灰度=半透明；maskContentUnits=userSpaceOnUse(默认) | objectBoundingBox');
    } catch (err) {
      this._addLog('err', '应用 mask 失败：' + (err && err.message));
    }
  }

  // 移除剪裁 / 蒙版
  _removeClipMask() {
    if (!this._caps().createNs) {
      this._addLog('warn', 'document.createElementNS 不可用');
      return;
    }
    try {
      this._clearClipDefs();
      this.setState({ clipStatus: '未应用' });
      this._addLog('clip', '已移除 clip-path / mask 属性与 defs 中所有 clipPath / mask / 渐变定义');
    } catch (err) {
      this._addLog('err', '移除剪裁 / 蒙版失败：' + (err && err.message));
    }
  }

  _renderCard1() {
    const caps = this._caps();
    const card = new Card({
      title: '1. SVG DOM 创建与命名空间',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.createNs ? 'success' : 'warning' }, caps.createNs ? 'createElementNS 可用' : '不可用'),
        h(Tag, { color: 'primary' }, 'svg / rect / circle / path'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' }, 'document.createElementNS("http://www.w3.org/2000/svg", "svg") 创建 SVG 根元素（必须显式传入命名空间，否则被当作未知 HTML 元素）；rect/circle/path/line/text/g/defs 同样用 createElementNS 创建，再 setAttribute 设置 width/height/x/y/cx/cy/r/fill/stroke（属性值均为字符串）。viewBox="minX minY W H" 定义用户坐标系、preserveAspectRatio 控制对齐。与 HTML DOM 区别：属性是字符串、命名空间属性（如 xlink:href）需用 setAttributeNS 设置。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('动态创建 SVG 元素并插入演示区', { type: 'primary', size: 'sm', disabled: !caps.createNs, onClick: () => this._createSvgElements() }),
          this._btn('修改 viewBox 缩放', { size: 'sm', disabled: !caps.createNs, onClick: () => this._modifyViewBox() }),
        ),
        h('div', { id: 'svg-dom-host', style: this._demoHostStyle() }, h('div', { class: 'fs-sm text-secondary' }, '（点击「动态创建 SVG 元素」生成 rect+circle+path）')),
        h(Alert, {
          type: 'info',
          message: '命名空间属性必须用 setAttributeNS',
          description: '如 xlink:href 需 setAttributeNS("http://www.w3.org/1999/xlink", "href", url)；仅 setAttribute("xlink:href", url) 在严格解析下不生效。HTML DOM 用属性赋值（el.width=320），SVG 属性赋值常被忽略，应统一用 setAttribute。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. SVGPathElement 路径几何',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.svgPath ? 'success' : 'warning' }, caps.svgPath ? 'SVGPathElement 可用' : '不可用'),
        h(Tag, { color: 'primary' }, 'getTotalLength / getPointAtLength'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' }, 'path.setAttribute("d", "M10 10 L 90 90 C ...") 设置路径数据；path.getTotalLength() 返回路径总长度（用户单位）；path.getPointAtLength(distance) 返回 {x, y} 路径上指定距离的点；path.pathLength 可设为规范化值。命令：M(moveto)/L(lineto)/H/V/C(cubic bezier)/Q(quadratic)/S/T/A(arc)/Z(close)。注：getTotalLength/getPointAtLength 在 jsdom 通常返回 0 或抛 Not implemented。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('计算路径总长', { type: 'primary', size: 'sm', disabled: !caps.createNs || !caps.svgPath, onClick: () => this._computePathLength() }),
          this._btn('沿路径取 5 个点', { size: 'sm', disabled: !caps.createNs || !caps.svgPath, onClick: () => this._samplePathPoints() }),
        ),
        h('div', { id: 'svg-path-host', style: this._demoHostStyle() }, h('div', { class: 'fs-sm text-secondary' }, '（点击「计算路径总长」生成复杂路径演示）')),
        h('div', { class: 'fs-sm text-secondary' }, '路径总长度 getTotalLength()：'),
        h('pre', { class: 'code-block', style: { maxHeight: '60px', overflow: 'auto' } },
          h('code', {}, s.pathLength || '（点击「计算路径总长」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '沿路径取 5 个等距点 getPointAtLength()：'),
        h('pre', { class: 'code-block', style: { maxHeight: '120px', overflow: 'auto' } },
          h('code', {}, s.pointList || '（点击「沿路径取 5 个点」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '路径命令速查表（命令 | 名称 | 说明）：'),
        h('div', { class: 'table-wrap', style: { overflowX: 'auto' } },
          h('table', { class: 'data-table', style: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' } },
            h('thead', {},
              h('tr', {},
                h('th', { style: thStyle }, '命令'),
                h('th', { style: thStyle }, '名称'),
                h('th', { style: thStyle }, '说明'),
              ),
            ),
            h('tbody', {},
              ...PATH_COMMANDS_TABLE.map((r) => h('tr', {},
                h('td', { style: tdStyle }, h('code', {}, r.cmd)),
                h('td', { style: tdStyle }, r.name),
                h('td', { style: tdStyle }, r.desc),
              )),
            ),
          ),
        ),
        h(Alert, {
          type: 'info',
          message: 'getPointAtLength 用于路径动画与轨迹跟随',
          description: '沿路径按距离取点可驱动元素沿任意路径运动（<animateMotion> 内部即用此机制）；pathLength 属性可设为规范化值（如 100），便于用百分比的距离寻址。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard3() {
    const caps = this._caps();
    const card = new Card({
      title: '3. SVGTransform 变换 + SMIL 动画',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.svgTransform ? 'success' : 'warning' }, caps.svgTransform ? 'SVGTransform 可用' : '不可用'),
        h(Tag, { color: 'primary' }, 'animateTransform'),
        h(Tag, { color: 'warning' }, 'SMIL'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' }, 'SVGTransformList / element.transform.baseVal：appendItem / createSVGTransform / consolidate 程序化操作变换列表。变换类型：transform="translate(x,y) rotate(angle) scale(sx,sy) skewX skewY matrix(a,b,c,d,e,f)"。SMIL 动画四类：<animate>/<animateTransform>/<animateMotion>/<set>；animateTransform: attributeName="transform" type="rotate" from="0" to="360" dur="2s" repeatCount="indefinite"。beginElement()/endElement() 程序控制启停。注：jsdom 中 <animate> 可创建插入但 beginElement/endElement 不支持。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('添加 SMIL 旋转动画', { type: 'primary', size: 'sm', disabled: !caps.createNs, onClick: () => this._addSmilRotation() }),
          this._btn('beginElement 启动', { size: 'sm', disabled: !caps.createNs, onClick: () => this._beginSmil() }),
          this._btn('endElement 停止', { size: 'sm', disabled: !caps.createNs, onClick: () => this._endSmil() }),
        ),
        h('div', { id: 'svg-smil-host', style: this._demoHostStyle() }, h('div', { class: 'fs-sm text-secondary' }, '（点击「添加 SMIL 旋转动画」插入 animateTransform）')),
        h(Alert, {
          type: 'warning',
          message: 'SMIL 在部分浏览器（Chrome/Firefox）支持，Edge/Safari 部分支持',
          description: '现代动画推荐 Web Animations API（element.animate）或 CSS @keyframes；SMIL 的优势是声明式嵌入 SVG 且可随 SVG 文件导出。beginElement/endElement 让 JS 能命令式控制 SMIL 时间轴。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. SVG 滤镜（filter + feGaussianBlur + feColorMatrix）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.createNs ? 'success' : 'warning' }, caps.createNs ? 'DOM 可用' : '不可用'),
        h(Tag, { color: 'primary' }, 'filter / feGaussianBlur / feColorMatrix'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' }, '<filter id="..."> 容器内组合多个图元级滤镜：<feGaussianBlur stdDeviation="3"> 高斯模糊、<feColorMatrix type="matrix" values="..."> 颜色矩阵(4x5 RGBA)、<feOffset dx="5" dy="5"> 偏移(阴影)、<feMerge><feMergeNode> 合并、<feComponentTransfer> 通道传输、<feComposite>/<feBlend> 合成。element.setAttribute("filter", "url(#myFilter)") 应用。注：jsdom 中滤镜只是 DOM 结构存在不会真正渲染，但 DOM 操作本身可执行。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('应用高斯模糊', { type: 'primary', size: 'sm', disabled: !caps.createNs, onClick: () => this._applyBlur() }),
          this._btn('应用阴影滤镜', { type: 'primary', size: 'sm', disabled: !caps.createNs, onClick: () => this._applyShadow() }),
          this._btn('移除滤镜', { size: 'sm', disabled: !caps.createNs, onClick: () => this._removeFilter() }),
          h(Tag, { color: s.filterStatus === '未应用' ? 'default' : 'success' }, `当前：${s.filterStatus}`),
        ),
        h('div', { id: 'svg-filter-host', style: this._demoHostStyle() }, h('div', { class: 'fs-sm text-secondary' }, '（点击按钮应用滤镜到青色矩形）')),
        h(Alert, {
          type: 'info',
          message: '滤镜管线通过 result / in 串联',
          description: '每个 fe* 用 result="name" 命名输出，后续 fe* 用 in="name" 引用；SourceGraphic / SourceAlpha 是内置输入。feMerge 把多个输入按顺序叠加，常用于阴影 + 原图合成。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. clipPath 剪裁 + mask 蒙版',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.createNs ? 'success' : 'warning' }, caps.createNs ? 'DOM 可用' : '不可用'),
        h(Tag, { color: 'primary' }, 'clipPath / mask'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' }, '<clipPath id="..."><rect/></clipPath> 定义剪裁路径，element.setAttribute("clip-path", "url(#myClip)") 应用——剪裁是硬边界(内外二值)。<mask id="..."><rect fill="white"/></mask> 定义蒙版(白色显示、黑色隐藏、灰度半透明)，setAttribute("mask", "url(#myMask)") 应用——蒙版支持软边渐变。clipPathUnits/maskContentUnits 控制坐标系(userSpaceOnUse|objectBoundingBox)；clip-rule="evenodd|nonzero" 控制自交路径填充规则。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('应用 clipPath 圆形剪裁', { type: 'primary', size: 'sm', disabled: !caps.createNs, onClick: () => this._applyClip() }),
          this._btn('应用 mask 渐变蒙版', { type: 'primary', size: 'sm', disabled: !caps.createNs, onClick: () => this._applyMask() }),
          this._btn('移除剪裁/蒙版', { size: 'sm', disabled: !caps.createNs, onClick: () => this._removeClipMask() }),
          h(Tag, { color: s.clipStatus === '未应用' ? 'default' : 'success' }, `当前：${s.clipStatus}`),
        ),
        h('div', { id: 'svg-clip-host', style: this._demoHostStyle() }, h('div', { class: 'fs-sm text-secondary' }, '（点击按钮应用 clipPath / mask 到橙色矩形）')),
        h(Alert, {
          type: 'info',
          message: 'clipPath 是硬剪裁，mask 是软蒙版',
          description: 'clipPath 用路径做二值剪裁（边界分明）；mask 用亮度/alpha 做连续透明度（可渐变）。clipPath 嵌入 <clipPath>，mask 嵌入 <mask>，二者均放在 <defs> 中并通过 url(#id) 引用。',
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
      h('h2', { class: 'section-title' }, 'SVG 矢量图形深度实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '演示 SVG DOM：createElementNS 命名空间 / SVGPathElement 路径几何(getTotalLength/getPointAtLength) / SVGTransform+SMIL 动画 / filter 滤镜(feGaussianBlur/feColorMatrix) / clipPath+mask 剪裁蒙版。'),
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

// 表格内联样式（与项目 .data-table 样式互补，保证未加载样式时也可见）
const thStyle = {
  padding: '6px 10px', textAlign: 'left', borderBottom: '2px solid #444',
  background: '#1e1e2e', color: '#cdd6f4', whiteSpace: 'nowrap',
};
const tdStyle = {
  padding: '6px 10px', borderBottom: '1px solid #333', verticalAlign: 'top',
  color: '#cdd6f4',
};
