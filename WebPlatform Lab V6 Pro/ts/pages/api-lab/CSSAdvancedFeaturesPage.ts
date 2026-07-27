// =====================================================================
// CSSAdvancedFeaturesPage.js —— CSS 高级特性 实验室
// 演示 MDN CSS 高级特性：
//   1. CSS Anchor Positioning —— anchor-name / anchor-default / anchor-scroll /
//      anchor-scope / position-area / position-try / inset-area(已弃用名)
//   2. Scroll-driven Animations —— scroll-timeline / view-timeline /
//      animation-timeline / timeline-scope / animation-range +
//      AnimationTimeline / ScrollTimeline / ViewTimeline JS 接口
//   3. @scope at-rule —— @scope (.root) to (.limit) { ... } 作用域、
//      下边界（:scope to .stop）、邻近规则（proximity）
//   4. :state() 伪类 —— customElements.define + ElementInternals.states +
//      :state(...) 匹配（target / internalTarget）
//   5. CSS Triage / Cascade Layers —— @layer / layer() / revert-layer /
//      @property / @container（容器查询）
//   6. CSS Custom Functions & @function —— @function / @if/@else（CSS Functions
//      and Mixins 模块，极新）+ calc() 数学函数 abs/sign/mod/rem/round/sin/cos/
//      tan/pow/sqrt/hypot/log/exp/atan2/pi()/e()
// 说明：所有特性调用前做 typeof / CSS.supports 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。jsdom 不做真实 CSS 渲染，但
//       CSS.supports / CSSStyleSheet.replaceSync 等部分 API 可能可用，统一 try/catch。
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

interface CSSAdvancedFeaturesPageCaps {
  css: boolean;
  supports: boolean;
  anchor: boolean;
  positionArea: boolean;
  positionTry: boolean;
  insetArea: boolean;
  animationTimeline: boolean;
  scrollTimeline: boolean;
  viewTimeline: boolean;
  animationTimelineInterface: boolean;
  scope: boolean;
  customElements: boolean;
  elementInternals: boolean;
  statePseudo: boolean;
  layer: boolean;
  property: boolean;
  container: boolean;
  cssFunction: boolean;
  mathAbs: boolean;
  mathSign: boolean;
  mathRound: boolean;
  mathMod: boolean;
  mathRem: boolean;
  mathSin: boolean;
  mathCos: boolean;
  mathTan: boolean;
  mathPow: boolean;
  mathSqrt: boolean;
  mathHypot: boolean;
  mathLog: boolean;
  mathExp: boolean;
  mathAtan2: boolean;
  mathPi: boolean;
  mathE: boolean;
}

export interface CSSAdvancedFeaturesPageProps extends Props {}

export interface CSSAdvancedFeaturesPageState extends State {
  logs: LogEntry[];
  capsSummary: string;
  anchorInfo: string;
  scrollTimelineInfo: string;
  scopeInfo: string;
  stateInfo: string;
  layerInfo: string;
  functionInfo: string;
}

export class CSSAdvancedFeaturesPage extends Page {
  declare props: CSSAdvancedFeaturesPageProps;
  declare state: CSSAdvancedFeaturesPageState;

  _inited: boolean = false;
  declare _destroyed: boolean;
  _dynamicStyles!: any[];
  _dynamicNodes!: any[];
  _customElDefined!: boolean;
  _internals!: any;
  _i!: any;


  // —— 初始 state ——
  initialState(): CSSAdvancedFeaturesPageState {
    return {
      logs: [],
      capsSummary: '',
      // Card 1：CSS Anchor Positioning
      anchorInfo: '',
      // Card 2：Scroll-driven Animations
      scrollTimelineInfo: '',
      // Card 3：@scope at-rule
      scopeInfo: '',
      // Card 4：:state() 伪类
      stateInfo: '',
      // Card 5：CSS Triage / Cascade Layers
      layerInfo: '',
      // Card 6：CSS Custom Functions & @function
      functionInfo: '',
    };
  }

  // —— 生命周期 ——
  componentDidMount(): void {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._dynamicStyles = [];   // 动态创建并插入 head 的 <style> 元素列表
    this._dynamicNodes = [];    // 动态创建并 appendChild 到 body 的元素列表
    this._customElDefined = false; // Card 4 自定义元素是否已注册（一经 define 无法 undefine）

    // 一次性能力检测：CSS 高级特性全家桶
    const f = this._flags();
    const c = (ok: boolean) => ok ? '✓' : '✗';
    const parts = [
      `CSS ${c(f.css)}`, `supports ${c(f.supports)}`,
      `anchor-name ${c(f.anchor)}`, `position-area ${c(f.positionArea)}`,
      `animation-timeline ${c(f.animationTimeline)}`, `ScrollTimeline ${c(f.scrollTimeline)}`,
      `@scope ${c(f.scope)}`, `:state() ${c(f.statePseudo)}`,
      `@layer ${c(f.layer)}`, `@property ${c(f.property)}`, `@container ${c(f.container)}`,
      `@function ${c(f.cssFunction)}`, `数学函数 ${c(f.mathSin)}`,
    ];

    const summary = f.css
      ? `CSS 高级特性能力检测：${parts.join(' · ')}。jsdom 不做真实 CSS 渲染，但 CSS.supports / CSSStyleSheet.replaceSync 通常可用；Anchor / Scroll-driven / @scope / @function 等较新特性多数不可用，按钮将仅记日志说明。在真实浏览器中打开可完整演示。`
      : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。';

    this.setState({ capsSummary: summary });
    this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.anchor) this._addLog('warn', 'anchor-name 不可用（CSS Anchor Positioning，Chrome 125+）');
    if (!f.animationTimeline) this._addLog('warn', 'animation-timeline: scroll() 不可用（Scroll-driven Animations，Chrome 115+）');
    if (!f.scope) this._addLog('warn', '@scope 不可用（Chrome 118+）');
    if (!f.statePseudo) this._addLog('warn', ':state() 伪类不可用或无法检测（Chrome 125+）');
    if (!f.cssFunction) this._addLog('warn', '@function 不可用（CSS Functions and Mixins，实验性，尚未广泛支持）');
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
    // 自定义元素一经 customElements.define 无法 undefine，仅清理引用标记
    this._customElDefined = false;
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

  // 返回 Tag 数组：items = [[label, ok], ...]，展示能力状态（✓/✗）
  _caps(items: any) {
    return items.map(([label, ok]: [any, any]) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  // 返回布尔能力对象（供 capsSummary / 按钮 disabled 使用）
  _flags(): CSSAdvancedFeaturesPageCaps {
    const hasCSS = typeof CSS !== 'undefined';
    const supportsPV = (p: any,v: any) => {
      try { return hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v); }
      catch { return false; }
    };
    const supportsCond = (cond: any) => {
      try { return hasCSS && typeof CSS.supports === 'function' && CSS.supports(cond); }
      catch { return false; }
    };
    return {
      css: hasCSS,
      supports: hasCSS && typeof CSS.supports === 'function',
      anchor: supportsPV('anchor-name', '--x'),
      positionArea: supportsPV('position-area', 'center'),
      positionTry: supportsPV('position-try', 'flip-block'),
      insetArea: supportsPV('inset-area', 'center'),
      animationTimeline: supportsPV('animation-timeline', 'scroll()'),
      scrollTimeline: typeof ScrollTimeline !== 'undefined',
      viewTimeline: typeof ViewTimeline !== 'undefined',
      animationTimelineInterface: typeof AnimationTimeline !== 'undefined',
      scope: supportsCond('@scope'),
      customElements: typeof customElements !== 'undefined',
      elementInternals: typeof ElementInternals !== 'undefined',
      statePseudo: supportsCond('selector(:state(checked))'),
      layer: supportsCond('@layer base'),
      property: supportsCond('@property --x'),
      container: supportsPV('container-type', 'inline-size'),
      cssFunction: supportsCond('@function --x'),
      mathAbs: supportsPV('width', 'calc(abs(-10) * 1px)'),
      mathSign: supportsPV('width', 'calc(sign(-5) * 1px)'),
      mathRound: supportsPV('width', 'calc(round(2.5, 1) * 1px)'),
      mathMod: supportsPV('width', 'calc(mod(10, 3) * 1px)'),
      mathRem: supportsPV('width', 'calc(rem(10, 3) * 1px)'),
      mathSin: supportsPV('width', 'calc(sin(45deg) * 1px)'),
      mathCos: supportsPV('width', 'calc(cos(45deg) * 1px)'),
      mathTan: supportsPV('width', 'calc(tan(45deg) * 1px)'),
      mathPow: supportsPV('width', 'calc(pow(2, 3) * 1px)'),
      mathSqrt: supportsPV('width', 'calc(sqrt(9) * 1px)'),
      mathHypot: supportsPV('width', 'calc(hypot(3px, 4px))'),
      mathLog: supportsPV('width', 'calc(log(e()) * 1px)'),
      mathExp: supportsPV('width', 'calc(exp(1) * 1px)'),
      mathAtan2: supportsPV('transform', 'rotate(atan2(1, 1))'),
      mathPi: supportsPV('width', 'calc(pi() * 1px)'),
      mathE: supportsPV('width', 'calc(e() * 1px)'),
    };
  }

  // =================== Card 1：CSS Anchor Positioning ===================

  _runAnchorDemo(): void {
    const f = this._flags();
    try {
      const host = document.createElement('div');
      host.style.cssText = 'position:relative;height:120px;border:1px dashed #ccc;margin-top:8px;padding:4px;';
      const anchor = document.createElement('div');
      anchor.textContent = '锚点';
      anchor.style.cssText = 'position:absolute;top:40px;left:20px;width:90px;height:30px;background:#3b82f6;color:#fff;text-align:center;line-height:30px;border-radius:4px;';
      try { anchor.style.setProperty('anchor-name', '--myanchor'); } catch { /* jsdom 拒绝未知属性 */ }
      const positioned = document.createElement('div');
      positioned.textContent = '定位元素';
      positioned.style.cssText = 'position:absolute;background:#ef4444;color:#fff;padding:2px 8px;border-radius:4px;';
      try { positioned.style.setProperty('top', 'anchor(--myanchor bottom)'); } catch { /* noop */ }
      try { positioned.style.setProperty('left', 'anchor(--myanchor left)'); } catch { /* noop */ }
      host.appendChild(anchor);
      host.appendChild(positioned);
      document.body.appendChild(host);
      this._dynamicNodes.push(host);

      const anchorNameSet = anchor.style.getPropertyValue('anchor-name');
      const topVal = window.getComputedStyle(positioned).getPropertyValue('top');
      const leftVal = window.getComputedStyle(positioned).getPropertyValue('left');
      this.setState({ anchorInfo:
        'CSS Anchor Positioning 演示：\n' +
        `  anchor.style.setProperty('anchor-name','--myanchor') → 读取值="${anchorNameSet}"\n` +
        `  positioned.style.top = 'anchor(--myanchor bottom)' → 计算值="${topVal}"\n` +
        `  positioned.style.left = 'anchor(--myanchor left)' → 计算值="${leftVal}"\n` +
        `  CSS.supports('anchor-name','--x') = ${f.anchor}\n` +
        `  position-area 支持 = ${f.positionArea}；position-try = ${f.positionTry}；inset-area(旧名) = ${f.insetArea}\n\n` +
        '说明：anchor-name 给元素命名锚点；定位元素用 top/left: anchor(--name bottom/left) 相对锚点定位，\n' +
        '  无需 JS 即可实现 tooltip / popover 跟随元素。anchor-default 指定默认锚点；anchor-scroll 控制\n' +
        '  滚动时锚点行为；anchor-scope 限定锚点查找范围；position-area 用网格区域定位；position-try 自动\n' +
        '  避让翻转。inset-area 为已弃用旧名，被 position-area 取代。jsdom 不渲染，计算值通常为空。' });
      this._addLog('anchor', `Anchor 演示：anchor-name="${anchorNameSet}", top="${topVal}", 支持=${f.anchor}`);
    } catch (err: any) {
      this._addLog('warn', `Anchor 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard1(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. CSS Anchor Positioning（锚点定位）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['anchor-name', f.anchor], ['position-area', f.positionArea], ['position-try', f.positionTry]]),
        h(Tag, { color: 'primary' }, 'tooltip / popover'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'CSS Anchor Positioning 让元素相对另一个「锚点」元素定位，无需 JS 计算坐标。anchor-name 给锚点命名（--x 形式）；定位元素用 top/left: anchor(--name side) 引用锚点边界；anchor-default 指定默认锚点；anchor-scroll 控制滚动行为；anchor-scope 限定查找范围；position-area 用网格区域定位；position-try 自动避让翻转（flip-block/flip-inline 等）。inset-area 是已弃用旧名，被 position-area 取代。适用于 tooltip / popover / 菜单跟随触发元素。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行锚点演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runAnchorDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Anchor 演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, s.anchorInfo || '（点击「运行锚点演示」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } },
          h('code', {},
`.anchor { anchor-name: --myanchor; }
.tooltip {
  position: absolute;
  top:    anchor(--myanchor bottom);   /* 锚点底边 */
  left:   anchor(--myanchor left);     /* 锚点左边 */
  position-try: flip-block flip-inline;/* 空间不足时翻转 */
}
@layer { .btn { anchor-default: --myanchor; } }   /* 默认锚点 */`)),
        h(Alert, {
          type: 'info',
          message: '锚点定位让 tooltip / popover 无需 JS 即可跟随元素',
          description: 'position-try 自动避让视口边界；anchor-scope 限定锚点查找范围避免跨组件污染。Chrome 125+ 支持。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 2：Scroll-driven Animations ===================

  _runScrollTimelineDemo(): void {
    const f = this._flags();
    try {
      const style = document.createElement('style');
      style.textContent =
        '.sda-stage { height: 120px; overflow-y: auto; border:1px solid #ccc; padding:8px; margin-top:8px; }\n' +
        '.sda-stage .filler { height: 400px; color:#666; }\n' +
        '.sda-progress { position: sticky; top: 0; height: 8px; background: linear-gradient(90deg,#3b82f6,#10b981); transform-origin: 0 0; transform: scaleX(0); }\n' +
        '@keyframes sda-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }\n' +
        '.sda-progress { animation: sda-grow linear; animation-timeline: scroll(); }';
      document.head.appendChild(style);
      this._dynamicStyles.push(style);

      const stage = document.createElement('div');
      stage.className = 'sda-stage';
      stage.innerHTML = '<div class="sda-progress"></div><div class="filler">向下滚动（真实浏览器中进度条随滚动增长）</div>';
      document.body.appendChild(stage);
      this._dynamicNodes.push(stage);

      const progress = stage.querySelector('.sda-progress');
      const tlVal = window.getComputedStyle((progress as any)).getPropertyValue('animation-timeline');
      this.setState({ scrollTimelineInfo:
        'Scroll-driven Animations 演示：\n' +
        `  已注入 .sda-progress { animation: sda-grow linear; animation-timeline: scroll(); }\n` +
        `  animation-timeline 计算值="${tlVal}"\n` +
        `  CSS.supports('animation-timeline','scroll()') = ${f.animationTimeline}\n` +
        `  typeof ScrollTimeline = ${f.scrollTimeline ? 'function' : 'undefined'}\n` +
        `  typeof ViewTimeline = ${f.viewTimeline ? 'function' : 'undefined'}\n` +
        `  typeof AnimationTimeline = ${f.animationTimelineInterface ? 'function' : 'undefined'}\n\n` +
        'JS 接口：\n' +
        '  new ScrollTimeline({ source: el, axis: "block" }) —— 滚动进度时间线\n' +
        '  new ViewTimeline({ subject: el, inset }) —— 元素进入视口时间线\n' +
        '  AnimationTimeline 是基类（DocumentTimeline / ScrollTimeline / ViewTimeline 的父类）\n\n' +
        'CSS 属性：scroll-timeline / view-timeline 声明时间线；animation-timeline: scroll()/view() 绑定；\n' +
        '  timeline-scope 跨子树扩展时间线作用域；animation-range: cover 0% 50% 限定动画区间。' });
      this._addLog('scroll', `Scroll-driven 演示：animation-timeline="${tlVal}", 支持=${f.animationTimeline}`);
    } catch (err: any) {
      this._addLog('warn', `Scroll-driven 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard2(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. Scroll-driven Animations（滚动驱动动画）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['animation-timeline', f.animationTimeline], ['ScrollTimeline', f.scrollTimeline], ['ViewTimeline', f.viewTimeline]]),
        h(Tag, { color: 'primary' }, 'scroll() / view()'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Scroll-driven Animations 让动画由滚动或元素进入视口驱动，无需 scroll 事件 + requestAnimationFrame。CSS：scroll-timeline / view-timeline 声明时间线；animation-timeline: scroll()/view() 绑定到动画；timeline-scope 跨子树扩展作用域；animation-range: cover 0% 50% 限定动画区间。JS：AnimationTimeline 基类、ScrollTimeline（{ source, axis }）、ViewTimeline（{ subject, inset }）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行滚动动画演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runScrollTimelineDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Scroll-driven 结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.scrollTimelineInfo || '（点击「运行滚动动画演示」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } },
          h('code', {},
`.scroller { scroll-timeline: --st; }     /* 声明滚动时间线 */
.bar { animation: grow linear; animation-timeline: --st; }
@keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
/* 元素进入视口时动画 */
.card { animation: reveal linear; animation-timeline: view(); animation-range: entry 0% cover 50%; }
/* JS：new ScrollTimeline({ source: el, axis: 'block' }); */`)),
        h(Alert, {
          type: 'info',
          message: '滚动驱动动画无需 scroll 事件，性能更优',
          description: 'animation-range 限定动画在滚动进度区间的哪一段触发（entry/exit/cover）。timeline-scope 让父元素可引用子树内声明的时间线。Chrome 115+ 支持。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 3：@scope at-rule ===================

  _runScopeDemo(): void {
    const f = this._flags();
    let replaceResult = '未执行';
    try {
      // 用 CSSStyleSheet.replaceSync 检测 @scope 解析能力
      if (typeof CSSStyleSheet !== 'undefined') {
        try {
          const sheet = new CSSStyleSheet();
          sheet.replaceSync('@scope (.scope-root) to (.scope-limit) { p { color: red; } }');
          replaceResult = 'replaceSync 成功（@scope 解析通过）';
        } catch (e: any) {
          replaceResult = `replaceSync 抛错：${e.name} - ${e.message}（@scope 不支持）`;
        }
      } else {
        replaceResult = 'CSSStyleSheet 不可用（typeof undefined）';
      }

      const host = document.createElement('div');
      host.className = 'scope-root';
      host.innerHTML = '<p>作用域内段落（应受规则影响）</p><div class="scope-limit"><p>下边界内段落（不受影响）</p></div>';
      document.body.appendChild(host);
      this._dynamicNodes.push(host);

      const style = document.createElement('style');
      style.textContent = '@scope (.scope-root) to (.scope-limit) { p { color: #3b82f6; font-weight: bold; } }';
      document.head.appendChild(style);
      this._dynamicStyles.push(style);

      const p1 = host.querySelector('p');
      const p1Color = window.getComputedStyle((p1 as any)).getPropertyValue('color');
      this.setState({ scopeInfo:
        '@scope at-rule 演示：\n' +
        `  CSSStyleSheet.replaceSync('@scope ...') → ${replaceResult}\n` +
        `  CSS.supports('@scope') = ${f.scope}\n` +
        `  作用域内 <p> 计算颜色="${p1Color}"\n\n` +
        '语法：@scope (.root) to (.limit) { ... }\n' +
        '  上边界 :scope = .root（规则仅作用于 .root 内）；下边界 .limit 之内不应用规则\n' +
        '  下边界写法：(.stop) 或 :scope to .stop（两种等价语法）\n' +
        '  邻近规则（proximity）：当多个 :scope 根匹配同一元素时，取 DOM 距离最近的根\n\n' +
        '用途：限定组件作用域，避免全局污染；比 BEM / scoped 属性更语义化，\n' +
        '  无需给每个元素加 data 属性或类名前缀。' });
      this._addLog('scope', `@scope 演示：replaceSync=${replaceResult.indexOf('成功') >= 0}, 支持=${f.scope}`);
    } catch (err: any) {
      this._addLog('warn', `@scope 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard3(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. @scope at-rule（作用域规则）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['@scope', f.scope]]),
        h(Tag, { color: 'primary' }, '上/下边界 / proximity'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '@scope (.root) to (.limit) { ... } 限定规则仅作用于 .root 内、.limit 之外的元素，避免全局污染。:scope 引用作用域根；下边界用 (.stop) 或 :scope to .stop 声明；邻近规则（proximity）在多个 :scope 匹配时取 DOM 距离最近的根。CSSStyleSheet.replaceSync 可同步检测 @scope 是否能被解析（不可用则抛错）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 @scope 演示', { type: 'primary', size: 'sm', onClick: () => this._runScopeDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '@scope 演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.scopeInfo || '（点击「运行 @scope 演示」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } },
          h('code', {},
`@scope (.card) to (.card-footer) {
  p { color: blue; }          /* 仅 .card 内、.card-footer 外的 p */
  :scope > h3 { border-bottom: 1px solid; }
}
/* 下边界两种等价写法 */
@scope (.article) to (.comments) { ... }
@scope (.article) { :scope to .comments { ... } }`)),
        h(Alert, {
          type: 'info',
          message: '@scope 用上下边界限定作用域，邻近规则取最近根',
          description: '相比 Shadow DOM（强隔离）@scope 更轻量，适合普通文档流组件化。Chrome 118+ 支持。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 4：:state() 伪类 ===================

  _runStateDemo(): void {
    const f = this._flags();
    if (!f.customElements) {
      this._addLog('warn', 'customElements 不可用，无法演示 :state()');
      this.setState({ stateInfo: 'customElements 不可用（typeof customElements === "undefined"）。:state() 需自定义元素 + ElementInternals.states。' });
      return;
    }
    try {
      const elName = 'css-lab-state-el';
      // 自定义元素一经 define 无法 undefine，用 get 判重避免重复注册抛错
      if (!customElements.get(elName)) {
        customElements.define(elName, class extends HTMLElement {
          _internals: any;
          constructor() {
            super();
            try { this._internals = this.attachInternals!(); }
            catch (e: any) { this._internals = null; } // jsdom 可能未实现 attachInternals
          }
          toggleOpen() {
            if (this._internals && this._internals.states) {
              if (this._internals.states.contains('open')) this._internals.states.remove('open');
              else this._internals.states.add('open');
            }
          }
        });
        this._customElDefined = true;
      }

      const style = document.createElement('style');
      style.textContent =
        `${elName} { color: #ef4444; display:inline-block; padding:4px 8px; border:1px solid #ddd; border-radius:4px; }\n` +
        `${elName}:state(open) { color: #10b981; font-weight: bold; border-color: #10b981; }`;
      document.head.appendChild(style);
      this._dynamicStyles.push(style);

      const el = document.createElement(elName);
      el.textContent = '自定义元素（已调用 states.add("open")）';
      document.body.appendChild(el);
      this._dynamicNodes.push(el);

      try { el.toggleOpen!(); } catch (e: any) { /* noop */ }
      const colorAfter = window.getComputedStyle(el as Element)!.getPropertyValue('color');
      this.setState({ stateInfo:
        ':state() 伪类演示：\n' +
        `  customElements.define('${elName}', ...) ✓\n` +
        `  ElementInternals 可用 = ${f.elementInternals}（attachInternals + .states）\n` +
        `  CSS.supports('selector(:state(checked))') = ${f.statePseudo}\n` +
        `  调用 states.add('open') 后计算颜色="${colorAfter}"（预期 :state(open) 命中 → 绿色 #10b981）\n\n` +
        '说明：\n' +
        '  自定义元素构造函数中 this.attachInternals() → ElementInternals\n' +
        '  this._internals.states 是 DOMTokenList：add / remove / contains / toggle\n' +
        '  CSS 用 :state(name) 匹配 states 中含 name 的元素\n' +
        '  target / internalTarget：:state 配合自定义元素受保护状态，\n' +
        '    不会被 attribute 反射，比 [data-*] 更语义化、更安全。' });
      this._addLog('state', `:state() 演示：states.add('open')，计算颜色="${colorAfter}"`);
    } catch (err: any) {
      this._addLog('warn', `:state() 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard4(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. :state() 伪类（自定义元素状态）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['customElements', f.customElements], ['ElementInternals', f.elementInternals], [':state()', f.statePseudo]]),
        h(Tag, { color: 'primary' }, 'target / internalTarget'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          ':state() 伪类匹配自定义元素的内置受保护状态。自定义元素在构造函数中 this.attachInternals() 获取 ElementInternals，其 .states 是 DOMTokenList，用 add/remove/contains/toggle 管理状态名。CSS 用 my-el:state(open) 匹配当前 states 含 open 的元素。与 [data-open] 区别：states 不会被 attribute 反射，外部无法直接篡改，更语义化、更安全。target / internalTarget 选择器配合 :state 可实现纯 CSS 的状态驱动样式。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 :state() 演示', { type: 'primary', size: 'sm', disabled: !f.customElements, onClick: () => this._runStateDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, ':state() 演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.stateInfo || '（点击「运行 :state() 演示」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`class MyEl extends HTMLElement {
  constructor() { super(); this._i = this.attachInternals(); }
  set open(v) { v ? this._i.states.add('open') : this._i.states.delete('open'); }
}
customElements.define('my-el', MyEl);
/* CSS：states 含 'open' 时命中 */
my-el:state(open) { color: green; }
my-el:state(loading) { opacity: .5; }`)),
        h(Alert, {
          type: 'info',
          message: ':state() 匹配 ElementInternals.states 受保护状态',
          description: 'states 是 DOMTokenList，不会反射到 attribute，外部无法直接改写。需 Chrome 125+ 且自定义元素需调用 attachInternals()。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 5：CSS Triage / Cascade Layers ===================

  _runLayerDemo(): void {
    const f = this._flags();
    try {
      const style = document.createElement('style');
      style.textContent =
        '@layer base, components;\n' +
        '@layer base { .css-layer-target { color: #ef4444; padding: 4px; } }\n' +
        '@layer components { .css-layer-target { color: #3b82f6; padding: 8px; } }\n' +
        '@property --css-lab-prop { syntax: "<length>"; inherits: false; initialValue: 0px; }\n' +
        '.css-layer-host { container-type: inline-size; }';
      document.head.appendChild(style);
      this._dynamicStyles.push(style);

      const el = document.createElement('div');
      el.className = 'css-layer-target';
      el.textContent = '级联层目标元素';
      document.body.appendChild(el);
      this._dynamicNodes.push(el);

      const colorVal = window.getComputedStyle(el as Element)!.getPropertyValue('color');
      let rulesInfo = '无法读取 cssRules';
      try {
        if (style.sheet && style.sheet.cssRules) {
          rulesInfo = Array.from(style.sheet.cssRules)
            .map((r) => `  • ${r.constructor.name}${r.name ? '(@layer ' + r.name + ')' : ''}`)
            .join('\n');
        }
      } catch (e: any) { rulesInfo = `读取 cssRules 抛错：${e.name}`; }

      this.setState({ layerInfo:
        'CSS Triage / Cascade Layers 演示：\n' +
        `  已注入 @layer base, components;（components 后声明 → 优先级更高）\n` +
        `  .css-layer-target 计算颜色="${colorVal}"（预期 components 层蓝色 #3b82f6 胜出）\n` +
        `  @layer 支持 = ${f.layer}\n` +
        `  @property 支持 = ${f.property}\n` +
        `  @container / container-type 支持 = ${f.container}\n\n` +
        `cssRules 结构：\n${rulesInfo}\n\n` +
        '说明：\n' +
        '  @layer base, components; 声明顺序，后者优先级更高；@layer name { ... } 定义层内容\n' +
        '  layer(name) 函数：@import url() layer(name); 把外部样式表归入指定层\n' +
        '  revert-layer 关键字：回退到上一层同名属性的级联值\n' +
        '  @property：注册强类型自定义属性（与 Houdini CSS.registerProperty 等价）\n' +
        '  @container：基于容器尺寸响应（container-type 声明查询容器，区别于 @media 视口）\n' +
        '  优先级总则：未分层样式 > 分层样式；!important 反转层顺序。' });
      this._addLog('layer', `@layer 演示：color="${colorVal}", @layer=${f.layer}, @property=${f.property}, @container=${f.container}`);
    } catch (err: any) {
      this._addLog('warn', `@layer 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard5(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. CSS Triage / Cascade Layers（级联层）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['@layer', f.layer], ['@property', f.property], ['@container', f.container]]),
        h(Tag, { color: 'primary' }, 'layer() / revert-layer'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Cascade Layers 用 @layer 显式控制级联优先级：@layer base, components; 声明顺序（后者优先级更高）；@layer name { ... } 定义层。layer(name) 函数配合 @import 把外部样式表归入层；revert-layer 关键字回退到上一层值。@property 注册强类型自定义属性（等价于 Houdini CSS.registerProperty）；@container 基于容器尺寸响应（区别于 @media 视口）。优先级总则：未分层样式 > 分层样式；!important 反转层顺序。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行级联层演示', { type: 'primary', size: 'sm', onClick: () => this._runLayerDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '级联层演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.layerInfo || '（点击「运行级联层演示」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`@layer base, components, utilities;     /* 声明顺序：base < components < utilities */
@layer base { * { box-sizing: border-box; } }
@layer components { .btn { padding: 8px; } }
@import url("reset.css") layer(reset);   /* layer() 归入层 */
.btn { color: red; }                      /* 未分层 → 永远胜过分层 */
@property --gap { syntax: "<length>"; inherits: true; initialValue: 8px; }
.box { container-type: inline-size; }
@container (inline-size > 400px) { .widget { display: grid; } }`)),
        h(Alert, {
          type: 'warning',
          message: '未分层样式优先级高于所有分层样式',
          description: '!important 反转层顺序：先声明的层 !important 优先级更高。revert-layer 可显式回退到上一层值。@property 让自定义属性强类型化、可参与动画。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render() as Node;
  }

  // =================== Card 6：CSS Custom Functions & @function ===================

  _runFunctionDemo(): any {
    const f = this._flags();
    try {
      const hasCSSStyleValue = typeof CSSStyleValue !== 'undefined' && typeof CSSStyleValue.parse === 'function';
      const tryParse = (prop: any,val: any) => {
        if (!hasCSSStyleValue) return null;
        try { return CSSStyleValue.parse(prop, val); }
        catch (e: any) { return `解析抛错：${e.name}`; }
      };
      const probes = [
        ['abs(-10)', 'width', 'calc(abs(-10) * 1px)', f.mathAbs],
        ['sign(-5)', 'width', 'calc(sign(-5) * 1px)', f.mathSign],
        ['round(2.5,1)', 'width', 'calc(round(2.5, 1) * 1px)', f.mathRound],
        ['mod(10,3)', 'width', 'calc(mod(10, 3) * 1px)', f.mathMod],
        ['rem(10,3)', 'width', 'calc(rem(10, 3) * 1px)', f.mathRem],
        ['sin(45deg)', 'width', 'calc(sin(45deg) * 1px)', f.mathSin],
        ['cos(45deg)', 'width', 'calc(cos(45deg) * 1px)', f.mathCos],
        ['tan(45deg)', 'width', 'calc(tan(45deg) * 1px)', f.mathTan],
        ['pow(2,3)', 'width', 'calc(pow(2, 3) * 1px)', f.mathPow],
        ['sqrt(9)', 'width', 'calc(sqrt(9) * 1px)', f.mathSqrt],
        ['hypot(3,4)', 'width', 'calc(hypot(3px, 4px))', f.mathHypot],
        ['log(e())', 'width', 'calc(log(e()) * 1px)', f.mathLog],
        ['exp(1)', 'width', 'calc(exp(1) * 1px)', f.mathExp],
        ['atan2(1,1)', 'transform', 'rotate(atan2(1, 1))', f.mathAtan2],
        ['pi()', 'width', 'calc(pi() * 1px)', f.mathPi],
        ['e()', 'width', 'calc(e() * 1px)', f.mathE],
      ];
      const tmp = document.createElement('div');
      document.body.appendChild(tmp);
      this._dynamicNodes.push(tmp);

      const results = probes.map(([name, prop, val, ok]: any) => {
        let readBack = '';
        try {
          tmp.style.setProperty(prop, val);
          readBack = tmp.style.getPropertyValue(prop) || '(被拒绝)';
          tmp.style.removeProperty(prop);
        } catch (e: any) { readBack = `设值抛错：${e.name}`; }
        const parsed = tryParse(prop, val);
        const parsedStr = parsed === null ? 'n/a' : (typeof parsed === 'string' ? parsed : parsed.toString());
        return `${String(name).padEnd(13)} 支持=${ok ? '✓' : '✗'}  style读回="${readBack}"  parse=${parsedStr}`;
      });

      this.setState({ functionInfo:
        'CSS Custom Functions & 数学函数 演示：\n' +
        `  @function 支持 = ${f.cssFunction}（CSS Functions and Mixins，实验性）\n` +
        `  CSSStyleValue.parse 可用 = ${hasCSSStyleValue}（Typed OM 类型化解析）\n\n` +
        results.join('\n') + '\n\n' +
        '说明：\n' +
        '  @function / @if / @else 属于 CSS Functions and Mixins 模块（实验性，极新，多数浏览器未支持）\n' +
        '  数学函数：abs/sign 取绝对值/符号；mod/rem 取模/取余（mod 结果跟随除数符号，rem 跟随被除数）；\n' +
        '    round 四舍五入（可带步长）；sin/cos/tan 三角；pow/sqrt/hypot 幂/平方根/直角边；\n' +
        '    log/exp 对数/指数；atan2(y,x) 反正切；pi()/e() 返回常量 π/e。\n' +
        '  用 CSSStyleValue.parse(prop, value) 可类型化解析（Typed OM），不可用时回退到 element.style 读回。' });
      this._addLog('function', `数学函数演示完成：${probes.length} 项，@function=${f.cssFunction}`);
    } catch (err: any) {
      this._addLog('warn', `数学函数演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard6(): Node | string {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. CSS Custom Functions & @function',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['@function', f.cssFunction], ['数学函数', f.mathSin], ['abs/sign', f.mathAbs]]),
        h(Tag, { color: 'primary' }, '@if / @else'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'CSS Functions and Mixins 模块引入 @function 定义可复用函数、@if/@else 条件分支（实验性，极新）。calc() 已支持丰富数学函数：abs/sign（绝对值/符号）、mod/rem（取模/取余，符号规则不同）、round（四舍五入，可带步长）、sin/cos/tan（三角）、pow/sqrt/hypot（幂/平方根/直角边）、log/exp（对数/指数）、atan2（反正切）、pi()/e()（常量）。可用 CSSStyleValue.parse(prop, value) 类型化解析（Typed OM），或直接 setProperty 后读回验证支持。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行函数演示', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runFunctionDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '函数 / 数学函数演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, s.functionInfo || '（点击「运行函数演示」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '170px', overflow: 'auto' } },
          h('code', {},
`/* @function（实验性，CSS Functions and Mixins） */
@function --gap($n) { @return calc($n * 4px); }
@function --size($w, $h) {
  @if $w > $h { @return $w; } @else { @return $h; }
}
.box { padding: --gap(2); width: --size(100px, 50px); }
/* calc() 数学函数 */
.w1 { width: calc(abs(-10px) + 5px); }      /* 15px */
.w2 { width: calc(hypot(3px, 4px)); }       /* 5px */
.w3 { width: calc(pi() * 10px); }           /* ≈31.4px */
.r  { transform: rotate(atan2(1, 1)); }     /* 45deg */`)),
        h(Alert, {
          type: 'warning',
          message: '@function / @if 属实验性模块，多数浏览器尚未支持',
          description: 'abs/sign/mod/rem/round/sin/cos/tan/pow/sqrt/hypot/log/exp/atan2/pi()/e() 等 calc 数学函数支持较广（Chrome 111+）；@function 仍处早期阶段。检测统一用 CSS.supports(prop, value)。',
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
    return h('div', { class: 'api-lab-page css-advanced-features-page' },
      h('h2', { class: 'section-title' }, 'CSS 高级特性 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页演示 CSS Anchor Positioning、Scroll-driven Animations、@scope 作用域、:state() 自定义元素状态、Cascade Layers / @property / @container、@function 与 calc 数学函数。所有特性通过 typeof / CSS.supports 能力检测，不可用时仅记日志，绝不抛异常。'),
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
