// =====================================================================
// CSSHoudiniPage.js —— CSS Houdini 与现代 CSS 实验室
// 演示 MDN：
//   1. CSS Houdini（可编程 CSS）
//      - Worklets：CSS.paintWorklet / layoutWorklet / animationWorklet 的 addModule
//      - Paint Worklet：registerPaint / inputProperties / inputArguments / paint()
//      - Properties & Values API：CSS.registerProperty({ name, syntax, inherits, initialValue })
//      - Typed OM：attributeStyleMap.set/get、computedStyleMap、CSSUnitValue、CSS.px/percent
//      - Animation Worklet：registerAnimator / animate() / WorkletAnimation
//   2. 现代 CSS 选择器与特性
//      - :has() / :is() / :where() / :not()（CSS Selectors Level 4）
//      - Container Queries：container-type / container-name / @container / cqw 等
//      - Cascade Layers：@layer 声明与定义、层优先级
//      - CSS Color Module Level 4/5：color() / oklch() / color-mix()
//      - CSS Nesting 原生嵌套 / scroll-driven animations
// 说明：CSS Houdini 把 CSS 引擎底层暴露给 JS。所有 API 调用前做 typeof 能力检测，
//       不可用时仅记日志（_addLog('warn', ...)）绝不抛异常。jsdom 不做真实 CSS 渲染，
//       但 CSS.supports 等部分 API 可能可用，统一 typeof 检测。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { Props, State } from '../../core/types.js';
import type { ButtonProps } from '../../components/ui/Button.js';

interface LogEntry { type: string; content: string; time: string; }

interface CSSHoudiniPageCaps {
  css: boolean;
  registerProperty: boolean;
  paintWorklet: boolean;
  layoutWorklet: boolean;
  animationWorklet: boolean;
  supports: boolean;
  cssPx: boolean;
  cssPercent: boolean;
  cssNumber: boolean;
  attributeStyleMap: boolean;
  computedStyleMap: boolean;
}

export interface CSSHoudiniPageProps extends Props {}

export interface CSSHoudiniPageState extends State {
  logs: LogEntry[];
  capsSummary: string;
  propertyInfo: string;
  paintInfo: string;
  typedOMInfo: string;
  selectorInfo: string;
  containerInfo: string;
  layerInfo: string;
}

export class CSSHoudiniPage extends Page {
  declare props: CSSHoudiniPageProps;
  declare state: CSSHoudiniPageState;

  _inited: boolean = false;
  declare _destroyed: boolean;
  _dynamicStyles!: any[];
  _dynamicNodes!: any[];
  _registeredProps!: any[];


  // —— 初始 state ——
  initialState(): CSSHoudiniPageState {
    return {
      logs: [],
      capsSummary: '',
      // Card 1：CSS.registerProperty
      propertyInfo: '',
      // Card 2：Paint Worklet
      paintInfo: '',
      // Card 3：CSS Typed OM
      typedOMInfo: '',
      // Card 4：:has() / :is() / :where() 选择器
      selectorInfo: '',
      // Card 5：Container Queries
      containerInfo: '',
      // Card 6：@layer 级联层
      layerInfo: '',
    };
  }

  // —— 生命周期 ——
  componentDidMount(): void {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._dynamicStyles = [];    // 动态创建并插入 head 的 <style> 元素列表
    this._dynamicNodes = [];     // 动态创建并 appendChild 到 body 的元素列表
    this._registeredProps = [];  // 已注册的自定义属性名列表

    // 一次性能力检测：CSS Houdini 全家桶
    const caps = this._caps();
    const c = (ok: boolean) => ok ? '✓' : '✗';
    const parts = [
      `CSS ${c(caps.css)}`, `registerProperty ${c(caps.registerProperty)}`,
      `paintWorklet ${c(caps.paintWorklet)}`, `layoutWorklet ${c(caps.layoutWorklet)}`,
      `animationWorklet ${c(caps.animationWorklet)}`, `supports ${c(caps.supports)}`,
      `CSS.px ${c(caps.cssPx)}`, `attributeStyleMap ${c(caps.attributeStyleMap)}`,
      `computedStyleMap ${c(caps.computedStyleMap)}`,
    ];

    const summary = caps.css
      ? `CSS Houdini 能力检测：${parts.join(' · ')}。jsdom 不做真实 CSS 渲染，但 CSS.supports 通常可用，可检测 :has() / container-type 等；registerProperty / paintWorklet / Typed OM 多数不可用，按钮将仅记日志说明。在真实浏览器中打开可完整演示。`
      : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。';

    this.setState({ capsSummary: summary });
    this._addLog(caps.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!caps.registerProperty) this._addLog('warn', 'CSS.registerProperty 不可用（Properties & Values API）');
    if (!caps.paintWorklet) this._addLog('warn', 'CSS.paintWorklet 不可用（Paint Worklet）');
    if (!caps.attributeStyleMap) this._addLog('warn', 'element.attributeStyleMap 不可用（CSS Typed OM）');
  }

  componentWillUnmount(): void {
    // 移除动态创建的 <style> 元素与 appendChild 到 body 的元素，便于 GC
    for (const style of this._dynamicStyles) {
      try { style.parentNode && style.parentNode.removeChild(style); } catch { /* noop */ }
    }
    for (const node of this._dynamicNodes) {
      try { node.parentNode && node.parentNode.removeChild(node); } catch { /* noop */ }
    }
    this._dynamicStyles = [];
    this._dynamicNodes = [];
    this._registeredProps = [];
  }

  // —— 日志 / 按钮辅助 ——
  _addLog(type: string, content: string): void {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label: string, opts: ButtonProps): Node | string {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render() as Node;
  }

  // —— 同步能力检测（render 时调用，开销可忽略）——
  _caps(): CSSHoudiniPageCaps {
    const hasCSS = typeof CSS !== 'undefined';
    const hasFn = (n: any) => hasCSS && typeof ((CSS as any)[(n as any)]) === 'function';
    const hasProp = (n: any) => hasCSS && typeof ((CSS as any)[(n as any)]) !== 'undefined';
    return {
      css: hasCSS,
      registerProperty: hasFn('registerProperty'),
      paintWorklet: hasProp('paintWorklet') && typeof (CSS as any).paintWorklet.addModule === 'function',
      layoutWorklet: hasProp('layoutWorklet'),
      animationWorklet: hasProp('animationWorklet'),
      supports: hasFn('supports'),
      cssPx: hasFn('px'),
      cssPercent: hasFn('percent'),
      cssNumber: hasFn('number'),
      attributeStyleMap: typeof Element !== 'undefined' && typeof Element.prototype.attributeStyleMap !== 'undefined',
      computedStyleMap: typeof Element !== 'undefined' && typeof Element.prototype.computedStyleMap === 'function',
    };
  }

  // =================== Card 1：CSS.registerProperty ===================

  // CSS.registerProperty({ name, syntax, inherits, initialValue }) → 注册自定义属性
  _registerProperty(): void {
    const caps = this._caps();
    if (!caps.registerProperty) {
      this._addLog('warn', 'CSS.registerProperty 不可用（Properties & Values API）');
      this.setState({
        propertyInfo:
          'CSS.registerProperty 不可用\n' +
          '当前环境 typeof CSS.registerProperty !== "function"（jsdom 无 Properties & Values API）。\n' +
          '说明：registerProperty 需 Chromium 系浏览器，注册后自定义属性才能正确参与动画/过渡。',
      });
      return;
    }
    try {
      // 注册 --my-color：syntax='<color>'，不继承，初值 #3b82f6
      CSS.registerProperty({
        name: '--my-color',
        syntax: '<color>',
        inherits: false,
        initialValue: '#3b82f6',
      });
      this._registeredProps.push('--my-color');
      // 再注册一个 <length> 类型属性（参与过渡演示）
      CSS.registerProperty({
        name: '--my-radius',
        syntax: '<length>',
        inherits: true,
        initialValue: '8px',
      });
      this._registeredProps.push('--my-radius');
      this.setState({
        propertyInfo:
          'CSS.registerProperty({ name, syntax, inherits, initialValue }) ✓\n' +
          '已注册：--my-color（syntax: <color>，inherits: false，initialValue: #3b82f6）\n' +
          '已注册：--my-radius（syntax: <length>，inherits: true，initialValue: 8px）\n\n' +
          '说明：注册后的属性可正确参与 @keyframes / transition；未注册的 --var 默认视为 *\n' +
          '（语法宽松，但无法平滑过渡）。点击「syntax 取值表」查看完整取值列表。',
      });
      this._addLog('register', 'registerProperty 成功：--my-color (<color>)、--my-radius (<length>)');
    } catch (err: any) {
      this._addLog('warn', `registerProperty 失败：${err.name} - ${err.message}（可能已注册或 syntax 非法）`);
      this.setState({ propertyInfo: `registerProperty 失败：${err.name} - ${err.message}\n（同一属性重复注册会抛错；syntax 必须是规范定义的值）` });
    }
  }

  // CSS.supports(prop, value) / CSS.supports(condition) → 检测语法支持
  _detectSyntax(): void {
    const caps = this._caps();
    if (!caps.supports) {
      this._addLog('warn', 'CSS.supports 不可用');
      return;
    }
    try {
      // CSS.supports(prop, value) 检测自定义属性 / Paint / 现代颜色 / 容器查询单位
      const sp = (p: any, v: any) => `CSS.supports('${p}', '${v}') = ${CSS.supports(p, v)}`;
      const results = [
        sp('color', 'var(--my-color)'),
        sp('--my-color', '#ff0000'),
        sp('background', 'paint(my-paint)'),
        sp('color', 'oklch(70% 0.15 145)'),
        sp('color', 'color(display-p3 1 0 0)'),
        sp('color', 'color-mix(in srgb, red 50%, blue)'),
        sp('width', '10cqw'),
      ];
      this.setState({
        propertyInfo:
          `CSS.supports(prop, value) / CSS.supports(condition) → boolean\n${results.join('\n')}\n\n` +
          `说明：CSS.supports 是同步能力检测标准；color-mix / oklch / color() 属于 CSS Color Module Level 4/5。`,
      });
      this._addLog('supports', `syntax 检测完成：${results.length} 项`);
    } catch (err: any) {
      this._addLog('warn', `supports 检测失败：${err.name} - ${err.message}`);
    }
  }

  // 演示 registerProperty 的多种 syntax 配置（文本展示）
  _showSyntaxList(): void {
    this.setState({
      propertyInfo:
        'CSS.registerProperty 各 syntax 取值与含义：\n' +
        '  <length> / <color> / <percentage> / <number> / <integer> / <angle> / <time>\n' +
        '  <length+>   —— 空格分隔的长度列表（+ 表示多个）\n' +
        '  <color>#    —— 逗号分隔的颜色列表（# 表示多个）\n' +
        '  *           —— 任意值（不参与动画/过渡解析）\n\n' +
        '示例：\n' +
        "CSS.registerProperty({ name: '--grad-stops', syntax: '<color>#', inherits: false, initialValue: 'red, blue' });\n" +
        "CSS.registerProperty({ name: '--gap', syntax: '<length+>', inherits: true, initialValue: '8px 16px' });\n\n" +
        '关键点：inherits 决定是否沿 DOM 树继承；initialValue 必须符合 syntax 否则抛 SyntaxError；\n' +
        '同名属性重复注册抛 DOMException。',
    });
    this._addLog('info', '展示了 registerProperty 的 syntax 取值表');
  }

  _renderCard1(): Node | string {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. CSS.registerProperty（Properties & Values API）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.registerProperty ? 'success' : 'error' }, caps.registerProperty ? 'registerProperty ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'syntax / inherits'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'CSS.registerProperty({ name, syntax, inherits, initialValue }) 注册自定义属性，使其具有强类型语法、初始值与继承语义。注册后的属性可正确参与 @keyframes 动画与 transition 过渡（未注册的 --var 默认视为 * 语法，无法平滑插值）。syntax 取值如 <color> / <length> / <percentage> / <number> / <length+> / * 等。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('注册 --my-color', { type: 'primary', size: 'sm', disabled: !caps.registerProperty, onClick: () => this._registerProperty() }),
          this._btn('CSS.supports 检测', { type: 'primary', size: 'sm', disabled: !caps.supports, onClick: () => this._detectSyntax() }),
          this._btn('syntax 取值表', { size: 'sm', onClick: () => this._showSyntaxList() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '注册 / 检测结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, s.propertyInfo || '（点击「注册 --my-color」或「CSS.supports 检测」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } },
          h('code', {},
`// 注册强类型自定义属性
CSS.registerProperty({ name: '--my-color', syntax: '<color>', inherits: false, initialValue: '#3b82f6' });
// 注册后可平滑过渡（未注册的 --var 视为 *，无法插值）
.el { --my-color: #3b82f6; transition: --my-color 0.3s; }
.el:hover { --my-color: #ef4444; }
// CSS.supports 同步检测：oklch / 10cqw 等是否支持
CSS.supports('color', 'oklch(70% 0.15 145)'); CSS.supports('width', '10cqw');`)),
        h(Alert, {
          type: 'info',
          message: '注册后的自定义属性才能平滑过渡',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 2：Paint Worklet ===================

  // (CSS as any).paintWorklet.addModule(url) → Promise<void>：加载 Paint Worklet 模块
  async _addPaintModule() {
    const caps = this._caps();
    if (!caps.paintWorklet) {
      this._addLog('warn', '(CSS as any).paintWorklet.addModule 不可用（jsdom 无 Worklet 支持）');
      this.setState({
        paintInfo:
          '(CSS as any).paintWorklet.addModule(url) 不可用\n' +
          '当前环境 typeof (CSS as any).paintWorklet === "undefined"（jsdom 无 Worklet 支持）。\n' +
          '真实 Chromium 中：await (CSS as any).paintWorklet.addModule("./paint-worklet.js");\n' +
          '随后 CSS：background: paint(my-paint); Worklet 运行在独立线程，无法访问 window/document。',
      });
      return;
    }
    try {
      this._addLog('paint', '(CSS as any).paintWorklet.addModule() 可用，尝试加载 mock worklet…');
      // 真实环境用 URL 加载；此处用 data URL 模拟（实际 worklet 不支持 data URL，仅演示流程）
      const mockUrl = 'data:text/javascript,registerPaint("my-paint",class{static get inputProperties(){return[]}paint(ctx,geom){ctx.fillRect(0,0,geom.width,geom.height)}});';
      await (CSS as any).paintWorklet.addModule(mockUrl);
      this.setState({
        paintInfo:
          '(CSS as any).paintWorklet.addModule(url) → Promise<void> ✓\n' +
          `已加载 worklet：${mockUrl.slice(0, 60)}…\n` +
          '加载后 CSS 中可用 background: paint(my-paint) 调用。\n' +
          '说明：paintWorklet.addModule 接收 worklet 脚本 URL，脚本内用 registerPaint 注册绘制类。',
      });
      this._addLog('paint', 'paintWorklet.addModule 成功（mock data URL）');
    } catch (err: any) {
      this._addLog('warn', `paintWorklet.addModule 失败：${err.name} - ${err.message}`);
      this.setState({ paintInfo: `paintWorklet.addModule 失败：${err.name} - ${err.message}` });
    }
  }

  // 展示 registerPaint class 定义与 paint() 方法签名
  _showRegisterPaint(): any {
    this.setState({
      paintInfo:
        'registerPaint(name, class) —— 在 Paint Worklet 中注册绘制类\n\n' +
        'class 需实现：static get inputProperties() / inputArguments() / contextOptions()；\n' +
        'paint(ctx, geometry, properties, args)：ctx 绘制上下文、geometry { width, height }、\n' +
        'properties 输入属性 Typed OM 值、args paint() 传入参数。\n\n' +
        '示例 worklet 代码：\n' +
        'registerPaint("checker", class {\n' +
        '  static get inputProperties() { return ["--tile-size"]; }\n' +
        '  static get inputArguments() { return ["<color>"]; }\n' +
        '  paint(ctx, geom, props, args) {\n' +
        '    const size = (props.get("--tile-size") || { value: 20 }).value;\n' +
        '    const color = args[0].toString();\n' +
        '    for (let y=0;y<geom.height;y+=size) for (let x=0;x<geom.width;x+=size)\n' +
        '      if(((x/size)+(y/size))%2){ctx.fillStyle=color;ctx.fillRect(x,y,size,size);}\n' +
        '  }\n' +
        '});\n\n' +
        'CSS 用法：background: paint(checker, #3b82f6);  --tile-size: 16px;',
    });
    this._addLog('paint', '展示了 registerPaint class 定义与 paint() 签名');
  }

  // 展示 layoutWorklet / animationWorklet 概述
  _showWorkletOverview(): any {
    this.setState({
      paintInfo:
        'CSS Houdini 三大 Worklet 概述：\n\n' +
        '1. Paint Worklet —— (CSS as any).paintWorklet.addModule + registerPaint + paint()；CSS：background: paint(name)\n' +
        '2. Layout Worklet —— (CSS as any).layoutWorklet.addModule + registerLayout + layout()；CSS：display: layout(name)\n' +
        '3. Animation Worklet —— (CSS as any).animationWorklet.addModule + registerAnimator + animate()\n' +
        '   JS：new WorkletAnimation(name, effects, options).play()\n\n' +
        'Animation Worklet 示例：\n' +
        'registerAnimator("parallax", class {\n' +
        '  static get inputProperties() { return ["--scroll-factor"]; }\n' +
        '  animate(currentTime, effect) {\n' +
        '    const f = effect.target.computedStyleMap().get("--scroll-factor").value;\n' +
        '    effect.localTime = currentTime * f;\n' +
        '  }\n' +
        '});\n' +
        'new WorkletAnimation("parallax", [keyframeEffect], {}).play();',
    });
    this._addLog('info', '展示了三大 Worklet（Paint / Layout / Animation）概述');
  }

  _renderCard2(): Node | string {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. Paint Worklet（CSS Paint API）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.paintWorklet ? 'success' : 'error' }, caps.paintWorklet ? 'paintWorklet ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'registerPaint / paint()'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '(CSS as any).paintWorklet.addModule(url) 加载 Paint Worklet 模块；worklet 脚本内用 registerPaint(name, class) 注册绘制类，类需实现 static get inputProperties() / inputArguments() / contextOptions() 与 paint(ctx, geometry, properties, args) 方法。CSS 中用 background: paint(name, ...args) 调用。绘制在独立线程执行，输入属性变化时自动重绘。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('addModule', { type: 'primary', size: 'sm', disabled: !caps.paintWorklet, onClick: () => this._addPaintModule() }),
          this._btn('registerPaint 类', { type: 'primary', size: 'sm', onClick: () => this._showRegisterPaint() }),
          this._btn('三大 Worklet 概述', { size: 'sm', onClick: () => this._showWorkletOverview() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Paint Worklet 说明：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.paintInfo || '（点击「addModule」或「registerPaint 类」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`// paint-worklet.js（运行在 Worklet 线程）
registerPaint('circle', class {
  static get inputProperties() { return ['--radius']; }
  paint(ctx, geom, props) {
    const r = (props.get('--radius') || { value: 20 }).value;
    ctx.beginPath();
    ctx.arc(geom.width / 2, geom.height / 2, r, 0, Math.PI * 2);
    ctx.fill();
  }
});
await (CSS as any).paintWorklet.addModule('./paint-worklet.js');   // 主线程加载
.el { background: paint(circle); --radius: 30px; }        // CSS 调用`)),
        h(Alert, {
          type: 'warning',
          message: 'Worklet 运行在独立线程，无 window/document 访问',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 3：CSS Typed OM ===================

  // element.attributeStyleMap.set(prop, value) / .get(prop) —— 类型化内联样式读写
  _typedOMSetGet(): void {
    const caps = this._caps();
    if (!caps.attributeStyleMap) {
      this._addLog('warn', 'element.attributeStyleMap 不可用（CSS Typed OM，jsdom 无支持）');
      this.setState({
        typedOMInfo:
          'element.attributeStyleMap 不可用\n' +
          '当前环境 typeof Element.prototype.attributeStyleMap === "undefined"（jsdom 无 Typed OM）。\n\n' +
          '真实浏览器中：\n' +
          '  el.attributeStyleMap.set("width", CSS.px(100));   // 存 CSSUnitValue\n' +
          '  el.attributeStyleMap.get("width");  // → CSSUnitValue { value:100, unit:"px" }\n' +
          '与 el.style.width = "100px" 不同，Typed OM 保留类型信息，可直接做数学运算。',
      });
      return;
    }
    try {
      const el = document.createElement('div');
      // 用 Typed OM 写入
      el.attributeStyleMap.set('width', CSS.px(100));
      el.attributeStyleMap.set('height', CSS.px(50));
      el.attributeStyleMap.set('opacity', CSS.number(0.5));
      // 读取
      const w = el.attributeStyleMap.get('width');
      const op = el.attributeStyleMap.get('opacity');
      this.setState({
        typedOMInfo:
          `element.attributeStyleMap.set(prop, value) / .get(prop) ✓\n` +
          `set('width', CSS.px(100)) → get('width') = ${JSON.stringify(w)}\n` +
          `set('opacity', CSS.number(0.5)) → get('opacity') = ${JSON.stringify(op)}\n\n` +
          `说明：CSSUnitValue { value, unit } 保留单位；Typed OM 保留类型，无需手动 parse 字符串。`,
      });
      this._addLog('typedOM', `attributeStyleMap.set/get 成功：width=${JSON.stringify(w)}`);
    } catch (err: any) {
      this._addLog('warn', `attributeStyleMap 操作失败：${err.name} - ${err.message}`);
    }
  }

  // CSS.px(n) / CSS.percent(n) / CSS.number(n) 工厂方法
  _cssFactories(): void {
    const caps = this._caps();
    if (!caps.cssPx) {
      this._addLog('warn', 'CSS.px / CSS.percent 工厂方法不可用（Typed OM）');
      this.setState({
        typedOMInfo:
          'CSS.px / CSS.percent 工厂方法不可用\n' +
          '当前环境 typeof CSS.px !== "function"（Typed OM 工厂方法需 Chromium）。\n\n' +
          '真实浏览器中的 Typed OM 值工厂：\n' +
          '  CSS.px(10) → CSSUnitValue { value:10, unit:"px" }\n' +
          '  CSS.percent(50) / CSS.number(1.5) / CSS.em(2) / CSS.deg(90) / CSS.fr(2)\n\n' +
          '数学表达式（CSSMathValue 子类）：\n' +
          '  new CSSMathSum(CSS.px(10), CSS.px(20))   → 10px + 20px\n' +
          '  new CSSMathNegate(CSS.px(10)) / new CSSMathMax(CSS.px(10), CSS.px(20))',
      });
      return;
    }
    try {
      const px = CSS.px(10);
      const pct = caps.cssPercent ? CSS.percent(50) : null;
      const num = caps.cssNumber ? CSS.number(1.5) : null;
      let mathLine = '';
      // 尝试 CSSMathSum
      try {
        if (typeof CSSMathSum !== 'undefined') {
          const sum = new CSSMathSum(CSS.px(10), CSS.px(20));
          mathLine = `\nnew CSSMathSum(CSS.px(10), CSS.px(20)) = ${sum.toString()}`;
        }
      } catch (e: any) { mathLine = `\nCSSMathSum 不可用：${e.message}`; }
      this.setState({
        typedOMInfo:
          `CSS Typed OM 工厂方法 ✓\n` +
          `CSS.px(10) = ${JSON.stringify(px)}\n` +
          (pct ? `CSS.percent(50) = ${JSON.stringify(pct)}\n` : '') +
          (num ? `CSS.number(1.5) = ${JSON.stringify(num)}\n` : '') +
          `${mathLine}\n\n` +
          `说明：工厂返回 CSSUnitValue（带 value+unit）；CSSMathSum 等用于复合表达式，可程序化构造与运算。`,
      });
      this._addLog('factory', `工厂方法：px=${JSON.stringify(px)}, percent=${pct ? JSON.stringify(pct) : 'n/a'}`);
    } catch (err: any) {
      this._addLog('warn', `工厂方法失败：${err.name} - ${err.message}`);
    }
  }

  // element.computedStyleMap() —— 类型化计算样式
  _computedStyleMap(): void {
    const caps = this._caps();
    if (!caps.computedStyleMap) {
      this._addLog('warn', 'element.computedStyleMap() 不可用（Typed OM 计算样式）');
      this.setState({
        typedOMInfo:
          'element.computedStyleMap() 不可用\n' +
          '当前环境 typeof Element.prototype.computedStyleMap !== "function"。\n\n' +
          '真实浏览器中：\n' +
          '  const styles = el.computedStyleMap();\n' +
          '  styles.get("font-size");   // → CSSUnitValue { value:16, unit:"px" }\n' +
          '  for (const [prop, val] of styles) { ... }  // 可迭代\n\n' +
          '与 getComputedStyle 区别：后者返回字符串，Typed OM 返回类型化对象，\n' +
          '可直接取 .value / .unit，无需手动 parse，且支持数学表达式。',
      });
      return;
    }
    try {
      const el = document.createElement('div');
      document.body.appendChild(el);
      this._dynamicNodes.push(el);
      const styles = el.computedStyleMap();
      const entries = [];
      for (const [prop, val] of styles) {
        entries.push(`${prop} = ${val}`);
        if (entries.length >= 8) break;
      }
      this.setState({
        typedOMInfo:
          `element.computedStyleMap() → StylePropertyMap ✓\n` +
          `前 8 项计算样式：\n${entries.join('\n')}\n\n` +
          `说明：computedStyleMap 返回可迭代 StylePropertyMap，与 getComputedStyle 相比保留类型信息。`,
      });
      this._addLog('computed', `computedStyleMap 读取 ${entries.length} 项`);
    } catch (err: any) {
      this._addLog('warn', `computedStyleMap 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard3(): Node | string {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. CSS Typed Object Model（Typed OM）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.attributeStyleMap ? 'success' : 'error' }, caps.attributeStyleMap ? 'Typed OM ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'attributeStyleMap / computedStyleMap'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'CSS Typed OM 用类型化对象替代字符串表示 CSS 值。element.attributeStyleMap.set(prop, value) / .get(prop) 类型化读写内联样式；element.computedStyleMap() 返回可迭代的计算样式 StylePropertyMap。CSS.px(n) / CSS.percent(n) / CSS.number(n) 等工厂返回 CSSUnitValue；CSSMathSum / CSSMathProduct 等表示数学表达式。相比 el.style.width = "100px"，Typed OM 保留类型，避免字符串 parse。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('attributeStyleMap', { type: 'primary', size: 'sm', disabled: !caps.attributeStyleMap, onClick: () => this._typedOMSetGet() }),
          this._btn('CSS.px/percent 工厂', { type: 'primary', size: 'sm', disabled: !caps.cssPx, onClick: () => this._cssFactories() }),
          this._btn('computedStyleMap', { size: 'sm', disabled: !caps.computedStyleMap, onClick: () => this._computedStyleMap() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Typed OM 结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.typedOMInfo || '（点击「attributeStyleMap」或「CSS.px/percent 工厂」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`// 类型化内联样式读写
el.attributeStyleMap.set('width', CSS.px(100));
el.attributeStyleMap.get('width');   // CSSUnitValue { value:100, unit:'px' }
// 工厂方法与数学表达式
CSS.px(10); CSS.percent(50); new CSSMathSum(CSS.px(10), CSS.px(20));  // 10px+20px
// 类型化计算样式
el.computedStyleMap().get('font-size');  // CSSUnitValue { value:16, unit:'px' }
el.style.width = '100px';              // 字符串，需 parse
el.attributeStyleMap.get('width').value; // 直接 100`)),
        h(Alert, {
          type: 'info',
          message: 'Typed OM 保留类型，避免字符串 parse',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 4：:has() / :is() / :where() 选择器 ===================

  // CSS.supports('selector(...)') → 检测选择器支持
  _detectSelectors(): void {
    const caps = this._caps();
    if (!caps.supports) {
      this._addLog('warn', 'CSS.supports 不可用');
      return;
    }
    try {
      const sel = (s: any) => CSS.supports(`selector(${s})`);
      const results = [
        `:has(*)         = ${sel(':has(*)')}`,
        `:has(> .child)  = ${sel(':has(> .child)')}`,
        `:has(+ .sib)    = ${sel(':has(+ .sibling)')}`,
        `:has(~ .gen)    = ${sel(':has(~ .general)')}`,
        `a:has(img)      = ${sel('a:has(img)')}`,
        `:not(:has(p))   = ${sel('div:not(:has(p))')}`,
        `:is(h1,h2,h3)   = ${sel(':is(h1, h2, h3)')}`,
        `:where(h1,h2)   = ${sel(':where(h1, h2)')}`,
        `:not(.excl)     = ${sel(':not(.exclude)')}`,
      ];
      this.setState({
        selectorInfo:
          `CSS.supports('selector(...)') → boolean（Selectors Level 4 检测）\n${results.join('\n')}\n\n` +
          `说明：:has(rel) 关系选择器；:is(a,b,c) 匹配任一保持特异性；:where(a,b) 特异性为 0；:not(x) 取反。\n` +
          `:has() 关系语法：:has(> .child) 直接子、:has(+ .sibling) 相邻兄弟、:has(~ .general) 后续兄弟`,
      });
      this._addLog('selector', `选择器支持检测完成：${results.length} 项`);
    } catch (err: any) {
      this._addLog('warn', `选择器检测失败：${err.name} - ${err.message}`);
    }
  }

  // 实际创建 DOM 并用 querySelector 测试 :has() / :is() / :where() 匹配
  _testSelectors(): any {
    try {
      // 构造测试 DOM：section×2（其一含 img）+ article（含 h2）
      const host = document.createElement('div');
      host.innerHTML =
        '<section><p class="img-host"><img alt="x"></p></section>' +
        '<section><p>纯文本段落</p></section>' +
        '<article><h2>文章标题</h2></article>';
      document.body.appendChild(host);
      this._dynamicNodes.push(host);
      const lines: any[] = [];
      // 通用匹配测试：selector + 说明，返回命中数（抛错返回 -1）
      const match = (selector: any,desc: any) => {
        try {
          const n = host.querySelectorAll(selector).length;
          lines.push(`querySelectorAll('${selector}') → ${n} 个（${desc}）`);
          return n;
        } catch (err: any) {
          lines.push(`querySelectorAll('${selector}') → 抛错：${err.name}`);
          return -1;
        }
      };
      const hasCount = match('section:has(img)', '包含 img 的 section');
      const isCount = match(':is(h1, h2, h3)', '应匹配 h2');
      const whereCount = match(':where(p)', '应匹配所有 p');
      const notCount = match('p:not(.img-host)', '排除 img-host');
      this.setState({
        selectorInfo:
          `实际 DOM 匹配测试（host 内：section×2 + article×1，含 h2/p/img）\n${lines.join('\n')}\n\n` +
          `说明：querySelector 选择器可用与否取决于引擎实现，与 CSS.supports 可能不同步\n` +
          `（jsdom 常支持 :is/:where/:not 但不支持 :has）。特异性：:is(.a,#b) 取最高；:where(.a,#b) 永远 0`,
      });
      this._addLog('query', `DOM 匹配测试完成：:has=${hasCount}, :is=${isCount}, :where=${whereCount}, :not=${notCount}`);
    } catch (err: any) {
      this._addLog('warn', `DOM 匹配测试失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard4(): Node | string {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. :has() / :is() / :where() / :not() 选择器',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.supports ? 'success' : 'error' }, caps.supports ? 'CSS.supports ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'Selectors Level 4'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          ':has(rel) 是 CSS Selectors Level 4 的关系选择器，匹配包含指定子/兄弟元素的元素（:has(> .child) 直接子、:has(+ .sibling) 相邻兄弟、:has(~ .general) 后续兄弟）。:is(a,b,c) 匹配任一并保持特异性；:where(a,b) 匹配任一但特异性为 0（便于被覆盖）；:not(x) 取反。CSS.supports(\'selector(...)\') 可同步检测选择器是否被引擎支持。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('CSS.supports 检测', { type: 'primary', size: 'sm', disabled: !caps.supports, onClick: () => this._detectSelectors() }),
          this._btn('querySelector 实测', { type: 'primary', size: 'sm', onClick: () => this._testSelectors() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '选择器检测结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.selectorInfo || '（点击「CSS.supports 检测」或「querySelector 实测」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } },
          h('code', {},
`/* :has() 关系选择器 */
section:has(> img) { border: 2px solid blue; }   /* 含 img 子元素 */
a:has(img) { display: block; }                    /* 含 img 的链接 */
/* :is() / :where() 分组（特异性不同） */
:is(h1, h2, h3) { color: red; }      /* 特异性取最高 */
:where(h1, h2, h3) { color: red; }   /* 特异性永远 = 0 */
input:not([disabled]) { cursor: pointer; }       /* :not 取反 */`)),
        h(Alert, {
          type: 'info',
          message: ':is() 与 :where() 的特异性差异是关键',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 5：Container Queries ===================

  // CSS.supports('container-type') 检测 Container Queries 支持
  _detectContainer(): void {
    const caps = this._caps();
    if (!caps.supports) {
      this._addLog('warn', 'CSS.supports 不可用');
      return;
    }
    try {
      const ct = (v: any) => `container-type: ${v.padEnd(11)}= ${CSS.supports(`container-type: ${v}`)}`;
      const cq = (u: any) => `width: 10${u.padEnd(6)}             = ${CSS.supports('width', `10${u}`)}`;
      const results = [
        ct('size'), ct('inline-size'), ct('normal'),
        cq('cqw'), cq('cqi'), cq('cqmin'), cq('cqmax'),
      ];
      this.setState({
        containerInfo:
          `CSS.supports 检测 Container Queries 支持：\n${results.join('\n')}\n\n` +
          `容器查询单位：cqw/cqh（宽/高的 1%）、cqi/cqb（内联/块轴 1%）、cqmin/cqmax\n\n` +
          `container-type 取值：size（宽高都查，慎用）/ inline-size（仅内联，推荐）/ normal（默认不查）`,
      });
      this._addLog('container', `Container Queries 检测完成：${results.length} 项`);
    } catch (err: any) {
      this._addLog('warn', `Container 检测失败：${err.name} - ${err.message}`);
    }
  }

  // 动态创建带 container-type 的元素，并注入 @container 规则
  _createContainer(): void {
    try {
      // 创建容器元素
      const container = document.createElement('div');
      container.className = 'cq-demo';
      container.style.containerType = 'inline-size';
      container.style.containerName = 'my-box';
      container.style.width = '400px';
      container.style.border = '1px solid #ccc';
      container.style.padding = '10px';
      // 子元素（响应容器尺寸）
      const child = document.createElement('div');
      child.className = 'cq-child';
      child.textContent = '我是容器内的子元素，样式随容器查询变化';
      container.appendChild(child);
      document.body.appendChild(container);
      this._dynamicNodes.push(container);
      // 注入 @container 规则到 style 元素
      const style = document.createElement('style');
      style.textContent =
        '.cq-demo { container-type: inline-size; container-name: my-box; }\n' +
        '@container my-box (inline-size > 300px) { .cq-child { font-size: 24px; color: #3b82f6; font-weight: bold; } }\n' +
        '@container my-box (inline-size <= 300px) { .cq-child { font-size: 12px; color: #ef4444; } }';
      document.head.appendChild(style);
      this._dynamicStyles.push(style);
      // 尝试读取已注入的 cssRules
      let rulesInfo = '无法读取 cssRules';
      try {
        if (style.sheet && style.sheet.cssRules) {
          const rules = Array.from(style.sheet.cssRules).map((r) => r.cssText || r.constructor.name);
          rulesInfo = `sheet.cssRules 共 ${rules.length} 条：\n${rules.map((r) => '  • ' + r).join('\n')}`;
        }
      } catch (e: any) { rulesInfo = `读取 cssRules 抛错：${e.name}（jsdom 可能不解析 @container）`; }
      this.setState({
        containerInfo:
          `已创建容器元素（container-type: inline-size, container-name: my-box, width: 400px）✓\n` +
          `已注入 @container 规则到 <style> 元素 ✓\n` +
          `  @container my-box (inline-size > 300px) → 子元素 24px 蓝色加粗\n` +
          `  @container my-box (inline-size <= 300px) → 子元素 12px 红色\n\n` +
          `${rulesInfo}\n\n` +
          `说明：@container 基于组件自身容器尺寸（区别于 @media 基于视口），更利于组件化布局。`,
      });
      this._addLog('container', '已创建容器元素并注入 @container 规则');
    } catch (err: any) {
      this._addLog('warn', `创建容器失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard5(): Node | string {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. Container Queries（容器查询）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.supports ? 'success' : 'error' }, caps.supports ? 'supports ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'container-type / @container / cqw'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Container Queries 让组件根据自身容器尺寸（而非视口）响应样式。container-type: size | inline-size | normal 声明查询容器；container-name 命名容器；@container name (inline-size > Npx) { ... } 定义容器查询规则。容器查询单位 cqw/cqh/cqi/cqb/cqmin/cqmax 基于容器尺寸。相比 @media 基于视口，@container 基于组件容器，更适合组件化设计系统。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('CSS.supports 检测', { type: 'primary', size: 'sm', disabled: !caps.supports, onClick: () => this._detectContainer() }),
          this._btn('创建容器 + @container', { type: 'primary', size: 'sm', onClick: () => this._createContainer() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Container Queries 结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.containerInfo || '（点击「CSS.supports 检测」或「创建容器 + @container」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`.sidebar { container-type: inline-size; container-name: sidebar; }
@container sidebar (inline-size > 400px) { .widget { display: grid; grid-template-columns: 1fr 1fr; } }
@container sidebar (inline-size <= 400px) { .widget { display: block; } }
.title { font-size: 5cqw; }   /* 容器查询单位：容器宽度的 5% */
.card { padding: 2cqi; }       /* 内联轴的 2% */`)),
        h(Alert, {
          type: 'info',
          message: '@container 基于组件容器尺寸，区别于 @media 视口',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 6：@layer 级联层 ===================

  // 动态注入 @layer 规则到 style 元素，演示层优先级顺序
  _injectLayers(): void {
    try {
      const style = document.createElement('style');
      // 声明层顺序：base < components < utilities（后者优先级更高）
      style.textContent =
        '@layer base, components, utilities;\n' +
        '@layer base { .layer-demo { color: #ef4444; padding: 4px; } }\n' +
        '@layer components { .layer-demo { color: #3b82f6; padding: 8px; } }\n' +
        '@layer utilities { .layer-demo { color: #10b981; padding: 16px; } }\n' +
        '/* 未分层样式 —— 优先级高于所有分层样式 */\n' +
        '.layer-demo { color: #000; padding: 2px; }';
      document.head.appendChild(style);
      this._dynamicStyles.push(style);
      // 创建演示元素
      const el = document.createElement('div');
      el.className = 'layer-demo';
      el.textContent = '@layer 级联层演示元素';
      document.body.appendChild(el);
      this._dynamicNodes.push(el);
      // 读取 cssRules 检查层结构
      let rulesInfo = '无法读取 cssRules';
      try {
        if (style.sheet && style.sheet.cssRules) {
          const ruleTypes = Array.from(style.sheet.cssRules)
            .map((r) => `  • ${r.constructor.name}${r.name ? `(@layer ${r.name})` : ''}`);
          rulesInfo = `sheet.cssRules 共 ${ruleTypes.length} 条：\n${ruleTypes.join('\n')}`;
        }
      } catch (e: any) { rulesInfo = `读取 cssRules 抛错：${e.name}`; }
      this.setState({
        layerInfo:
          `已注入 @layer 规则 ✓\n` +
          `声明顺序：@layer base, components, utilities;\n` +
          `优先级：base < components < utilities < 未分层\n\n` +
          `各层对 .layer-demo 的 color：base→#ef4444(红)、components→#3b82f6(蓝)、\n` +
          `utilities→#10b981(绿，层内最高)、未分层→#000(黑，胜出所有层)\n` +
          `最终生效：未分层 #000（未分层样式优先级最高）\n\n` +
          `${rulesInfo}\n\n` +
          `说明：@layer 显式控制级联优先级，越后声明的层优先级越高，未分层样式永远胜出分层样式。`,
      });
      this._addLog('layer', '已注入 @layer 规则并创建演示元素');
    } catch (err: any) {
      this._addLog('warn', `注入 @layer 失败：${err.name} - ${err.message}`);
    }
  }

  // 检查注入的 @layer 规则结构（读取 sheet.cssRules）
  _inspectLayers(): void {
    const caps = this._caps();
    if (!caps.supports) {
      this._addLog('warn', 'CSS.supports 不可用');
      return;
    }
    try {
      // 检测 @layer 支持
      const layerSupported = CSS.supports('@layer base');
      // 找最近注入的 style 元素
      const style = this._dynamicStyles[this._dynamicStyles.length - 1];
      let rulesText = '';
      if (style && style.sheet) {
        try {
          rulesText = Array.from(style.sheet.cssRules).map((r: any, i: any) =>
            `  [${i}] ${(r as any).constructor.name}${((((r.name as any) as any) as any) as any) ? ` name="${r.name}"` : ''}${r.cssText ? `\n      cssText: ${r.cssText.slice(0, 80)}` : ''}`
          ).join('\n');
        } catch (e: any) {
          rulesText = `  读取 cssRules 抛错：${e.name} - ${e.message}`;
        }
      } else {
        rulesText = '  无可检查的 <style>（请先点击「注入 @layer」）';
      }
      this.setState({
        layerInfo:
          `CSS.supports('@layer base') = ${layerSupported}\n\n` +
          `@layer 规则内省（sheet.cssRules）：\n${rulesText}\n\n` +
          `@layer 语法：@layer name1, name2; 声明顺序；@layer name { ... } 定义内容；@layer { ... } 匿名层\n\n` +
          `优先级：!important 反转层顺序（base !important 胜过 utilities !important）；\n` +
          `未分层 !important > 分层 !important；同层内按特异性 / 源顺序比较`,
      });
      this._addLog('layer', `@layer 内省完成：supports=@layer ${layerSupported}`);
    } catch (err: any) {
      this._addLog('warn', `@layer 内省失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard6(): Node | string {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. @layer 级联层（Cascade Layers）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.supports ? 'success' : 'error' }, caps.supports ? 'supports ✓' : '不可用'),
        h(Tag, { color: 'primary' }, '@layer / 层优先级'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '@layer 声明级联层并显式控制优先级。@layer base, components, utilities; 声明层顺序（后者优先级更高）；@layer name { ... } 定义层内容。优先级规则：越后声明的层优先级越高；未分层样式优先级高于所有分层样式；!important 反转层顺序。@layer 让开发者摆脱特异性 hack，便于集成第三方 CSS（如把第三方样式放进低优先级层）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('注入 @layer 规则', { type: 'primary', size: 'sm', onClick: () => this._injectLayers() }),
          this._btn('内省 cssRules', { type: 'primary', size: 'sm', disabled: !caps.supports, onClick: () => this._inspectLayers() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '@layer 级联层结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, s.layerInfo || '（点击「注入 @layer 规则」或「内省 cssRules」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`/* 声明层顺序：base < components < utilities */
@layer base, components, utilities;
@layer base { * { box-sizing: border-box; } body { margin: 0; } }
@layer components { .btn { padding: 8px 16px; } }
@layer utilities { .text-center { text-align: center; } }  /* 优先级最高 */
.btn { color: red; }  /* 未分层 —— 永远胜过分层样式 */`)),
        h(Alert, {
          type: 'warning',
          message: '未分层样式优先级高于所有分层样式',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== 日志面板 ===================

  _renderLogPanel(): Node | string {
    const s = this.state;
    return h('div', { class: 'log-panel' },
      h('div', { class: 'log-panel__header' },
        '事件日志',
        h(Tag, { color: 'primary' }, `${s.logs.length} 条`),
      ),
      s.logs.length === 0
        ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
        : s.logs.map((log) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  // =================== 整页渲染 ===================

  render(): Node {
    const s = this.state;
    return h('div', { class: 'page api-lab-page' },
      h('h2', { class: 'section-title' }, 'CSS Houdini 与现代 CSS 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        'CSS Houdini 把 CSS 引擎底层暴露给 JS（Worklets / registerProperty / Typed OM）；现代 CSS 带来 :has() 选择器、Container Queries、@layer 级联层、oklch/color-mix 颜色等。本页演示 registerProperty、Paint Worklet、Typed OM、关系选择器、容器查询、级联层。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null as any,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderCard6(),
      this._renderLogPanel(),
    );
  }
}
