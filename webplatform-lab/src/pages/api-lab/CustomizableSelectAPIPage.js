// =====================================================================
// CustomizableSelectAPIPage.js —— 可定制 <select> API 实验室
// 演示 OpenUI / HTML 规范草案中即将落地的「可定制 select」完整方案
// （Customizable Select，Chrome 130+ 起逐步落地，2025 年逐步铺开）：
//   1. <select> + appearance: base-select —— 不再依赖 OS 原生控件，
//      允许开发者完全用 CSS/DOM 控制按钮外观与下拉面板样式；
//      传统 appearance: auto（默认）= 浏览器原生阴影盒不可穿透
//   2. <button behavior="select"> + ::picker(select) 伪元素 ——
//      触发按钮由开发者提供标记，::picker(select) 控制下拉面板的
//      容器、动画、定位；支持 @starting-style 实现打开过渡
//   3. <selectedoption> 元素 —— 自动反映当前选中项内容，
//      无需 JS 监听 change 事件回填到按钮；常放在 button 内显示选中值
//   4. <option> 内嵌任意内容 —— 不再限制为纯文本，
//      可放 <img>/<svg>/<span class="badge"> 等富内容；
//      配合 ::checkmark / option:checked 实现自定义勾选标记
//   5. 与现有方案对比 —— 原生 <select>（不可定制但免费无障碍）/
//      自定义组件 + ARIA combobox（完全可控但需手写键盘/焦点/无障碍）/
//      可定制 select（原生语义 + 完全样式控制，最佳平衡）
//   6. 能力检测 + 渐进增强 —— CSS.supports('appearance: base-select') /
//      CSS.supports('selector(::picker(select))') / @supports 兜底降级到原生 select
// 说明：jsdom 不做真实渲染，本页用 CSS.supports() 探测能力并展示完整
//       代码示例与标记结构；真实浏览器（Chrome 130+）可查看交互效果。
// 参考文档：
//   https://open-ui.org/components/selectlike/
//   https://developer.chrome.com/blog/css-customizable-select
//   https://github.com/openui/open-ui/issues/702
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class CustomizableSelectAPIPage extends Page {
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      baseSelectInfo: '',       // Card 1：appearance: base-select 与触发按钮
      pickerInfo: '',           // Card 2：::picker(select) 下拉面板
      selectedOptionInfo: '',   // Card 3：<selectedoption> 反映选中项
      richOptionInfo: '',       // Card 4：<option> 富内容 + ::checkmark
      comparisonInfo: '',       // Card 5：与现有方案对比
      progressiveInfo: '',      // Card 6：能力检测 + 渐进增强
      demoHtml: '',             // 演示区 DOM 片段
    };
  }

  componentDidMount() {
    if (this._inited) return;
    this._inited = true;

    this._dynamicStyles = [];

    const f = this._flags();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `appearance:base-select ${c(f.baseSelect)}`,
      `::picker(select) ${c(f.picker)}`,
      `<selectedoption> ${c(f.selectedOption)}`,
      `behavior=select ${c(f.behaviorSelect)}`,
      `::checkmark ${c(f.checkmark)}`,
      `option:checked ${c(f.optionChecked)}`,
    ];

    const summary = f.css
      ? `可定制 <select> 能力检测：${parts.join(' · ')}。jsdom 不做真实渲染，按钮点击将注入演示样式 + 展示完整标记/代码示例；真实浏览器 Chrome 130+ 起逐步落地，2025 年逐步铺开；Firefox/Safari 暂未实现，需用原生 <select> 或自定义 ARIA combobox 降级。`
      : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击仅记日志说明，不会抛异常。';

    this.setState({ capsSummary: summary });
    this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.baseSelect) this._addLog('warn', 'appearance: base-select 不可用（Chrome 130+ 才支持，jsdom 必然不识别）');
    if (!f.picker) this._addLog('warn', '::picker(select) 不可用（Chrome 130+ 才支持）');
    if (!f.selectedOption) this._addLog('warn', '<selectedoption> 元素不可用（Chrome 130+ 才支持）');
  }

  componentWillUnmount() {
    for (const style of this._dynamicStyles) {
      try { style.parentNode && style.parentNode.removeChild(style); } catch { /* noop */ }
    }
    this._dynamicStyles = [];
  }

  // —— 日志 / 按钮 / 能力辅助 ——

  _addLog(type, content) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  _caps(items) {
    return items.map(([label, ok]) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  _injectStyle(id, css) {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
    this._dynamicStyles.push(style);
  }

  _flags() {
    const hasCSS = typeof CSS !== 'undefined';
    const supportsPV = (p, v) => {
      try { return hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v); }
      catch { return false; }
    };
    const supportsCond = (cond) => {
      try { return hasCSS && typeof CSS.supports === 'function' && CSS.supports(cond); }
      catch { return false; }
    };
    const supportsSel = (sel) => {
      try { return hasCSS && typeof CSS.supports === 'function' && typeof CSS.supports === 'function' && CSS.supports('selector(' + sel + ')'); }
      catch { return false; }
    };
    return {
      css: hasCSS,
      supports: hasCSS && typeof CSS.supports === 'function',
      // Card 1: appearance: base-select 与触发按钮
      baseSelect: supportsPV('appearance', 'base-select'),
      behaviorSelect: supportsCond('button[behavior="select"]'),
      // Card 2: ::picker(select)
      picker: supportsSel('::picker(select)'),
      pickerIcon: supportsSel('::picker-icon(select)'),
      // Card 3: <selectedoption>
      selectedOption: supportsSel('selectedoption'),
      // Card 4: ::checkmark + option:checked
      checkmark: supportsSel('::checkmark'),
      optionChecked: supportsSel('option:checked'),
      // 对比项
      nativeSelect: supportsPV('appearance', 'auto'),
      comboboxRole: supportsSel('[role="combobox"]'),
    };
  }

  // ===================== Card 1：appearance: base-select =====================

  _runBaseSelectDemo() {
    const f = this._flags();
    this._injectStyle('cs-base-select-demo', `
      .cs-demo-select {
        appearance: base-select; /* 关键：脱离 OS 原生样式，全面可控 */
        /* 兜底：旧浏览器不识别 base-select 时退回 auto（原生） */
        appearance: auto;
        appearance: base-select;

        padding: 0;             /* 清掉原生 padding 便于自定义 */
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        background: #fff;
        font-size: 14px;
        min-width: 220px;
      }
      /* 触发按钮：appearance: base-select 后，<button behavior="select"> 可被 CSS 控制 */
      .cs-demo-select button::after {
        content: "▾";
        margin-left: 8px;
        color: #64748b;
        transition: transform 0.2s;
      }
      .cs-demo-select:open button::after {
        transform: rotate(180deg);  /* 打开时翻转箭头 */
      }
      /* 旧写法（仍可用）：<select> 内的 <hr> 作为分隔符 */
      .cs-demo-select hr {
        border: 0;
        border-top: 1px solid #e2e8f0;
        margin: 4px 0;
      }
    `);
    const info = [
      '===== appearance: base-select —— 开启可定制模式 =====',
      '',
      '【动机】原生 <select> 长期痛点：',
      '  - appearance: auto（默认）下，下拉面板由 OS 绘制，CSS 完全无法穿透',
      '  - iOS Safari 下拉面板更是原生 picker view，连图标都加不了',
      '  - <option> 内容只能是纯文本，不能放 <img>/<svg>/<span class="badge">',
      '  - 业界只能用自定义 div + ARIA combobox 模拟，但键盘/焦点/无障碍成本高',
      '',
      '【新方案】appearance: base-select',
      '  select {',
      '    appearance: base-select;   /* 关键一行：脱离 OS 原生 */',
      '    /* 自定义按钮、边框、背景、字体 —— 全部可控 */',
      '    border: 1px solid #cbd5e1;',
      '    border-radius: 8px;',
      '    background: #fff;',
      '  }',
      '',
      '【触发按钮：两种写法】',
      '  写法 A（推荐）：显式 <button behavior="select">',
      '    <select>',
      '      <button behavior="select">',
      '        <selectedoption></selectedoption>  <!-- 反映选中项 -->',
      '        <span class="chevron">▾</span>',
      '      </button>',
      '      <option>苹果</option>',
      '      <option>橘子</option>',
      '    </select>',
      '',
      '  写法 B（默认）：未提供 button 时，浏览器自动生成默认按钮',
      '    <select><option>苹果</option><option>橘子</option></select>',
      '    默认按钮内含 <selectedoption>，可用 ::picker-icon 或 button::after 加箭头',
      '',
      '【:open 伪类 —— 反映打开状态】',
      '  select:open button::after { transform: rotate(180deg); }  /* 箭头翻转 */',
      '  select:open { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }   /* 打开阴影 */',
      '',
      '【与传统原生对比】',
      '  appearance: auto     → OS 原生（Windows/Mac/Linux 各不同，不可控）',
      '  appearance: none      → 去边框但下拉面板仍 OS 原生（半解决方案）',
      '  appearance: base-select → 完全脱离 OS，按钮 + 面板全可控（推荐）',
      '',
      '【兜底：旧浏览器降级】',
      '  appearance: auto;          /* 旧浏览器用 */',
      '  appearance: base-select;   /* 新浏览器覆盖 */',
      '  旧浏览器不识别 base-select 会忽略，回退到 auto（原生仍可用）',
      '',
      `CSS.supports('appearance', 'base-select') = ${f.baseSelect}`,
      `button[behavior="select"] 选择器支持 = ${f.behaviorSelect}`,
      '',
      '===== 状态（截至 2025）=====',
      '  Chrome 130+ 起逐步落地（behind flag → 默认启用）',
      '  Firefox / Safari 暂未实现，处于 polyfill 阶段',
      '  规范来源：https://open-ui.org/components/selectlike/',
    ].join('\n');
    this.setState({ baseSelectInfo: info });
    this._addLog('cs', `appearance:base-select 演示完成；supports=${f.baseSelect}`);
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. appearance: base-select —— 开启可定制 <select>',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['base-select', f.baseSelect], ['behavior=select', f.behaviorSelect]]),
        h(Tag, { color: 'primary' }, 'OpenUI 草案'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'appearance: base-select 是 OpenUI 提案的关键开关：让 <select> 脱离 OS 原生控件，按钮与下拉面板完全由 CSS 控制。配合 <button behavior="select"> 显式触发按钮（含 <selectedoption> 反映选中值）和 :open 伪类（反映打开状态），可彻底替代「自定义 div + ARIA combobox」的繁琐方案。旧浏览器降级到 appearance: auto（原生仍可用）。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 base-select 演示', { type: 'primary', size: 'sm', onClick: () => this._runBaseSelectDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '480px', overflow: 'auto' } },
          h('code', {}, s.baseSelectInfo || '（点击按钮查看 appearance: base-select 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 2：::picker(select) 下拉面板 =====================

  _runPickerDemo() {
    const f = this._flags();
    this._injectStyle('cs-picker-demo', `
      .cs-picker-demo-select {
        appearance: base-select;
      }
      /* ::picker(select) —— 下拉面板容器（替代 OS 原生 popup） */
      .cs-picker-demo-select::picker(select) {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        padding: 4px;
        /* 可控：min/max-width、动画、定位（默认 anchor 到 button） */
        min-width: 240px;
        max-height: 320px;
        overflow: auto;
      }
      /* 打开过渡：配合 @starting-style 实现「打开时从透明缩放进入」 */
      .cs-picker-demo-select::picker(select) {
        opacity: 1;
        transform: scaleY(1);
        transform-origin: top center;
        transition: opacity 0.15s, transform 0.15s;
      }
      @starting-style {
        .cs-picker-demo-select::picker(select) {
          opacity: 0;
          transform: scaleY(0.9);
        }
      }
      /* 选项样式完全可控 */
      .cs-picker-demo-select option {
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
      }
      .cs-picker-demo-select option:hover {
        background: #f1f5f9;
      }
      .cs-picker-demo-select option:checked {
        background: #dbeafe;
        color: #1e40af;
        font-weight: 600;
      }
      /* ::checkmark —— 默认勾选标记，可隐藏或自定义 */
      .cs-picker-demo-select option::checkmark {
        color: #2563eb;
      }
    `);
    const info = [
      '===== ::picker(select) —— 自定义下拉面板 =====',
      '',
      '【语法】::picker(select) 选中 <select> 的下拉面板伪元素',
      '  select::picker(select) {',
      '    background: #fff;',
      '    border: 1px solid #e2e8f0;',
      '    border-radius: 8px;',
      '    box-shadow: 0 8px 24px rgba(0,0,0,0.12);',
      '    padding: 4px;',
      '    min-width: 240px;',
      '    max-height: 320px;',
      '    overflow: auto;',
      '  }',
      '',
      '【打开过渡：@starting-style 配合】',
      '  问题：display: none → block 无法 transition（display 不可过渡）',
      '  方案：用 @starting-style 声明「打开瞬间的起始样式」',
      '  select::picker(select) {',
      '    opacity: 1; transform: scaleY(1);',
      '    transition: opacity 0.15s, transform 0.15s;',
      '    transform-origin: top center;',
      '  }',
      '  @starting-style {',
      '    select::picker(select) { opacity: 0; transform: scaleY(0.9); }',
      '  }',
      '  说明：@starting-style 让浏览器在元素首次出现时使用该初始值，',
      '        再过渡到正常值，实现 display 切换的平滑过渡',
      '',
      '【定位：默认 anchor 到 button】',
      '  下拉面板默认锚定到触发按钮，类似 <popover> + anchor positioning',
      '  可用 anchor-name / position-anchor 自定义锚点（CSS Anchor Positioning）',
      '  select::picker(select) {',
      '    position-anchor: --my-trigger;',
      '    top: anchor(bottom);',
      '    left: anchor(left);',
      '  }',
      '',
      '【选项样式】',
      '  option { padding: 8px 12px; border-radius: 4px; cursor: pointer; }',
      '  option:hover { background: #f1f5f9; }        /* hover 高亮 */',
      '  option:checked { background: #dbeafe; }      /* 选中态 */',
      '  option:checked::checkmark { color: #2563eb; }/* 勾选标记颜色 */',
      '  option:disabled { opacity: 0.5; }            /* 禁用项 */',
      '',
      '【:open 伪类 —— select 打开状态】',
      '  select:open { box-shadow: 0 0 0 3px rgba(59,130,246,0.3); }',
      '  select:not(:open) ::picker(select) { display: none; }  /* 隐藏面板 */',
      '',
      '【与传统自定义 dropdown 对比】',
      '  传统：用 <div popover> + anchor positioning + 自定义 listbox',
      '        需手写键盘导航（Arrow/Home/End/Type-ahead）、焦点管理、',
      '        activeOption 状态、outside-click 关闭、ESC 关闭等',
      '  ::picker(select)：原生 <select> 语义，键盘/焦点/无障碍全免费',
      '                    仅样式可控，开发成本接近 0',
      '',
      '【支持的相关伪元素】',
      '  ::picker(select)       - 面板容器',
      '  ::picker-icon(select)  - 面板图标（实验性，部分浏览器）',
      '  option::checkmark      - 选项勾选标记',
      '',
      `CSS.supports('selector(::picker(select))') = ${f.picker}`,
      `CSS.supports('selector(::picker-icon(select))') = ${f.pickerIcon}`,
      '',
      '===== 状态（截至 2025）=====',
      '  Chrome 130+ 起逐步落地 ::picker(select) + @starting-style 打开过渡',
      '  Firefox / Safari 暂未实现',
      '  规范来源：https://open-ui.org/components/selectlike/',
    ].join('\n');
    this.setState({ pickerInfo: info });
    this._addLog('cs', `::picker(select) 演示完成；supports=${f.picker}`);
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. ::picker(select) —— 自定义下拉面板',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['::picker(select)', f.picker], ['::picker-icon', f.pickerIcon]]),
        h(Tag, { color: 'primary' }, 'OpenUI 草案'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '::picker(select) 选中 <select> 的下拉面板伪元素，配合 @starting-style 实现打开过渡（解决 display: none→block 不可过渡问题）。面板默认锚定到触发按钮（可用 CSS Anchor Positioning 自定义）。option:hover/:checked/::checkmark 全可控。彻底替代「自定义 div popover + 手写键盘导航」的繁琐方案 —— 原生 select 语义 + 完全样式控制。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 ::picker(select) 演示', { type: 'primary', size: 'sm', onClick: () => this._runPickerDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.pickerInfo || '（点击按钮查看 ::picker(select) 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 3：<selectedoption> 反映选中项 =====================

  _runSelectedOptionDemo() {
    const f = this._flags();
    this._injectStyle('cs-selected-option-demo', `
      .cs-selopt-demo {
        appearance: base-select;
        min-width: 200px;
      }
      .cs-selopt-demo button {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        width: 100%;
        background: transparent;
        border: none;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }
      /* <selectedoption> 默认 inline，可改为 flex 承载富内容 */
      .cs-selopt-demo selectedoption {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex: 1;
      }
      .cs-selopt-demo button::after {
        content: "▾";
        color: #64748b;
        margin-left: auto;
      }
    `);
    const info = [
      '===== <selectedoption> —— 自动反映选中项 =====',
      '',
      '【动机】传统 <select> 按钮（appearance: auto）显示选中项的纯文本，',
      '        无法在按钮内显示富内容（如图标 + 文字 + 徽标）；',
      '        自定义组件需监听 change 事件，手动回填到按钮 innerHTML。',
      '',
      '【新方案】<selectedoption> 元素自动反映当前选中 <option> 的内容',
      '  <select>',
      '    <button behavior="select">',
      '      <selectedoption></selectedoption>  <!-- 自动反映选中项 -->',
      '      <span class="chevron">▾</span>',
      '    </button>',
      '    <option>',
      '      <img src="apple.png" alt="">',
      '      <span>苹果</span>',
      '      <span class="badge">3 个</span>',
      '    </option>',
      '    <option>',
      '      <img src="orange.png" alt="">',
      '      <span>橘子</span>',
      '    </option>',
      '  </select>',
      '  /* 选中「苹果」时，<selectedoption> 内自动渲染',
      '     <img src="apple.png"><span>苹果</span><span class="badge">3 个</span> */',
      '',
      '【关键特性】',
      '  1. 内容投影：选中 option 的子节点被克隆投影到 <selectedoption>',
      '  2. 实时更新：用户切换 option 时自动同步，无需 JS 监听 change',
      '  3. 保留样式：<selectedoption> 内的元素继承 option 的样式上下文',
      '  4. 可多次使用：按钮内可放多个 <selectedoption>，都会同步',
      '',
      '【样式控制】',
      '  selectedoption {',
      '    display: inline-flex;',
      '    align-items: center;',
      '    gap: 6px;',
      '    flex: 1;',
      '  }',
      '  /* 控制 option 内子元素的展示，例如隐藏徽标 */',
      '  selectedoption .badge { display: none; }',
      '',
      '【与 JS 监听对比】',
      '  传统：',
      '    select.addEventListener("change", (e) => {',
      '      const opt = e.target.selectedOptions[0];',
      '      button.innerHTML = opt.innerHTML;  // 手动回填',
      '    });',
      '  新方案：',
      '    <selectedoption></selectedoption>  // 声明式，零 JS',
      '',
      '【未选中状态】',
      '  <selectedoption> 在无选中时为空；可用 :empty 伪类显示占位：',
      '  selectedoption:empty::before {',
      '    content: "请选择...";',
      '    color: #94a3b8;',
      '  }',
      '',
      '【配合 placeholder option】',
      '  <option value="" disabled selected hidden>请选择...</option>',
      '  选中此项时 <selectedoption> 显示「请选择...」（灰字）',
      '',
      `CSS.supports('selector(selectedoption)') = ${f.selectedOption}`,
      '',
      '===== 状态（截至 2025）=====',
      '  Chrome 130+ 起逐步落地 <selectedoption> 元素',
      '  Firefox / Safari 暂未实现',
      '  规范来源：https://open-ui.org/components/selectlike/',
    ].join('\n');
    this.setState({ selectedOptionInfo: info });
    this._addLog('cs', `<selectedoption> 演示完成；supports=${f.selectedOption}`);
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. <selectedoption> —— 自动反映选中项',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['<selectedoption>', f.selectedOption]]),
        h(Tag, { color: 'primary' }, '声明式'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '<selectedoption> 是按钮内的特殊元素，自动克隆并投影当前选中 <option> 的子节点内容（含 <img>/<svg>/<span> 等富内容）。用户切换选项时自动同步，无需 JS 监听 change 事件回填。可放多个 <selectedoption>（都会同步），可用 :empty 伪类显示占位文字，配合 placeholder option 实现「请选择...」灰字效果。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 <selectedoption> 演示', { type: 'primary', size: 'sm', onClick: () => this._runSelectedOptionDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '460px', overflow: 'auto' } },
          h('code', {}, s.selectedOptionInfo || '（点击按钮查看 <selectedoption> 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 4：富内容 option + ::checkmark =====================

  _runRichOptionDemo() {
    const f = this._flags();
    this._injectStyle('cs-rich-option-demo', `
      .cs-rich-demo {
        appearance: base-select;
        min-width: 260px;
      }
      /* option 内可放任意 HTML：img/svg/span/badge 等 */
      .cs-rich-demo option {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 4px;
      }
      .cs-rich-demo option img {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        object-fit: cover;
      }
      .cs-rich-demo option .badge {
        margin-left: auto;
        background: #e0e7ff;
        color: #4338ca;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
      }
      /* ::checkmark —— 原生勾选标记，默认在选项右侧出现 */
      .cs-rich-demo option::checkmark {
        order: 2;             /* flex 排序到末尾 */
        color: #2563eb;
      }
      /* 隐藏默认勾选标记，用自定义图标替代 */
      .cs-rich-demo.no-default-check option::checkmark {
        display: none;
      }
      .cs-rich-demo.no-default-check option:checked::after {
        content: "✓";
        color: #22c55e;
        margin-left: auto;
        font-weight: 700;
      }
      /* <hr> 作为分隔符（optgroup 替代方案） */
      .cs-rich-demo hr {
        border: 0;
        border-top: 1px solid #e2e8f0;
        margin: 4px 0;
      }
    `);
    const info = [
      '===== <option> 富内容 + ::checkmark 勾选标记 =====',
      '',
      '【动机】传统 <option> 只能放纯文本，不能放图标/徽标/富内容',
      '        业界常被迫用 <optgroup> 分组，但分组标题也无法富化',
      '',
      '【新方案】<option> 内可放任意 HTML',
      '  <select>',
      '    <option value="apple">',
      '      <img src="apple.png" alt="">',
      '      <span>苹果</span>',
      '      <span class="badge">3 个</span>',
      '    </option>',
      '    <option value="orange">',
      '      <img src="orange.png" alt="">',
      '      <span>橘子</span>',
      '    </option>',
      '    <hr>  <!-- 分隔符，替代 optgroup -->',
      '    <option value="banana">',
      '      <img src="banana.png" alt="">',
      '      <span>香蕉</span>',
      '    </option>',
      '  </select>',
      '',
      '【option 样式可控】',
      '  option {',
      '    display: flex;            /* option 现在是 flex 容器 */',
      '    align-items: center;',
      '    gap: 8px;',
      '    padding: 8px 12px;',
      '    border-radius: 4px;',
      '  }',
      '  option img { width: 24px; height: 24px; border-radius: 50%; }',
      '  option .badge { margin-left: auto; ... }',
      '',
      '【::checkmark —— 勾选标记伪元素】',
      '  option::checkmark {',
      '    color: #2563eb;',
      '    order: 2;  /* flex 排序到末尾 */',
      '  }',
      '  /* 默认 ::checkmark 由浏览器绘制（通常 ✓ 或 ✓），可隐藏后自定义 */',
      '  option::checkmark { display: none; }',
      '  option:checked::after { content: "✓"; color: #22c55e; }',
      '',
      '【option 状态伪类】',
      '  option:checked     - 当前选中',
      '  option:hover       - 鼠标悬停',
      '  option:disabled    - 禁用',
      '  option:active      - 按下',
      '  option:focus       - 键盘聚焦（type-ahead 时）',
      '',
      '【分隔符 <hr>】',
      '  <hr> 作为 <option> 之间的分隔线，替代 <optgroup>',
      '  优点：可放任意位置（optgroup 只能嵌套 option），样式可控',
      '  缺点：无语义分组标题（可用 disabled option 替代）',
      '  <option disabled>—— 水果 ——</option>',
      '  <option>苹果</option>',
      '  <option>橘子</option>',
      '  <hr>',
      '  <option disabled>—— 蔬菜 ——</option>',
      '  <option>胡萝卜</option>',
      '',
      '【<optgroup> 仍可用】',
      '  <optgroup label="水果">',
      '    <option>苹果</option>',
      '    <option>橘子</option>',
      '  </optgroup>',
      '  optgroup::before { content: attr(label); font-weight: 600; }',
      '',
      `CSS.supports('selector(::checkmark)') = ${f.checkmark}`,
      `CSS.supports('selector(option:checked)') = ${f.optionChecked}`,
      '',
      '===== 状态（截至 2025）=====',
      '  Chrome 130+ 起支持 option 富内容 + ::checkmark',
      '  Firefox / Safari 暂未实现',
    ].join('\n');
    this.setState({ richOptionInfo: info });
    this._addLog('cs', `富内容 option 演示完成；checkmark=${f.checkmark}, option:checked=${f.optionChecked}`);
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. <option> 富内容 + ::checkmark 勾选标记',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['::checkmark', f.checkmark], ['option:checked', f.optionChecked]]),
        h(Tag, { color: 'primary' }, '富内容'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '可定制 <select> 下 <option> 不再限于纯文本，可内嵌 <img>/<svg>/<span class="badge"> 等任意 HTML，且 option 成为 flex 容器可定制布局。::checkmark 伪元素控制勾选标记（可隐藏后用 :checked::after 自定义）。<hr> 作为分隔符替代 <optgroup>，更灵活。option:hover/:checked/:disabled 等状态伪类全部可控。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行富内容 option 演示', { type: 'primary', size: 'sm', onClick: () => this._runRichOptionDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '480px', overflow: 'auto' } },
          h('code', {}, s.richOptionInfo || '（点击按钮查看富内容 option 完整用法）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 5：与现有方案对比 =====================

  _runComparisonDemo() {
    const f = this._flags();
    const info = [
      '===== 可定制 <select> 与现有方案对比 =====',
      '',
      '【方案 A：原生 <select>（appearance: auto）】',
      '  标记：<select><option>苹果</option></select>',
      '  优点：',
      '    - 零 JS、零额外 CSS',
      '    - 键盘导航全免费（Arrow/Home/End/Type-ahead/Enter/Esc）',
      '    - 移动端原生体验（iOS picker view、Android dropdown）',
      '    - 无障碍语义完善（role=listbox/option）',
      '  缺点：',
      '    - 下拉面板 OS 绘制，CSS 完全无法穿透',
      '    - <option> 只能纯文本，不能放图标/徽标',
      '    - iOS 下拉面板是 picker view，与其他平台体验割裂',
      '    - 按钮箭头不可定制',
      '',
      '【方案 B：自定义组件 + ARIA combobox】',
      '  标记：<div role="combobox" aria-expanded="false">',
      '         <button>选择...</button>',
      '         <div role="listbox">',
      '           <div role="option" aria-selected="true">苹果</div>',
      '         </div>',
      '       </div>',
      '  优点：',
      '    - 完全样式可控（按钮、面板、选项）',
      '    - 可放任意富内容',
      '    - 跨平台一致体验',
      '  缺点：',
      '    - 需手写键盘导航（Arrow/Home/End/Type-ahead/Enter/Esc）',
      '    - 需手写焦点管理（aria-activedescendant / roving tabindex）',
      '    - 需手写 outside-click 关闭、ESC 关闭',
      '    - 需手写 ARIA 属性同步（aria-expanded/aria-selected）',
      '    - 移动端键盘弹出/IME 处理复杂',
      '    - 无障碍测试成本高（NVDA/JAWS/VoiceOver 兼容性）',
      '    - 代码量通常 200-500 行（含状态机）',
      '',
      '【方案 C：可定制 <select>（appearance: base-select）★ 推荐】',
      '  标记：<select>',
      '         <button behavior="select">',
      '           <selectedoption></selectedoption>',
      '         </button>',
      '         <option><img src="..."><span>苹果</span></option>',
      '       </select>',
      '  优点（兼得 A + B）：',
      '    - 原生 <select> 语义：键盘/焦点/无障碍全免费',
      '    - 按钮与面板样式完全可控（::picker(select)）',
      '    - <option> 可放任意富内容',
      '    - <selectedoption> 声明式反映选中项，零 JS',
      '    - 跨平台一致（脱离 OS 原生）',
      '    - 与表单原生集成（form 数据、name/value、:valid/:invalid）',
      '  缺点：',
      '    - 浏览器支持有限（Chrome 130+，Firefox/Safari 未实现）',
      '    - 需 polyfill 或渐进增强（旧浏览器降级到 appearance: auto）',
      '',
      '【方案 D：第三方库（Radix/Headless UI/MUI/AntD Select）】',
      '  优点：开箱即用，跨浏览器一致',
      '  缺点：',
      '    - 包体积（10-50KB）',
      '    - 仍是自定义 ARIA combobox 实现，无障碍细节可能不完善',
      '    - 与原生表单集成需额外处理',
      '    - 升级成本',
      '',
      '【决策树】',
      '  是否需富内容/自定义样式？',
      '    否 → 方案 A（原生 <select>，最省事）',
      '    是 → 浏览器支持 Chrome 130+？',
      '           是 → 方案 C（可定制 <select>，最佳平衡）',
      '           否 → 团队能力足够且需精细控制？',
      '                  是 → 方案 B（自定义 ARIA combobox）',
      '                  否 → 方案 D（第三方库）',
      '',
      '【成本对比表】',
      '  方案      样式可控  富内容  键盘/无障碍  JS 代码  浏览器支持',
      '  A 原生     ✗         ✗       ✓ 免费       0 行     全部',
      '  B ARIA     ✓         ✓       需手写       200+行   全部',
      '  C 可定制   ✓         ✓       ✓ 免费       0 行     Chrome 130+',
      '  D 库       ✓         ✓       部分免费     10-50KB  全部',
      '',
      `检测结果：`,
      `  appearance: auto（原生）= ${f.nativeSelect}`,
      `  appearance: base-select（可定制）= ${f.baseSelect}`,
      `  [role="combobox"]（ARIA）= ${f.comboboxRole}`,
      '',
      '===== 状态（截至 2025）=====',
      '  Chrome 130+ 起逐步落地可定制 <select> 全部能力',
      '  Firefox / Safari 暂未实现，处于讨论阶段',
      '  生态：Radix UI / Headless UI 等库开始研究迁移路径',
    ].join('\n');
    this.setState({ comparisonInfo: info });
    this._addLog('cs', `方案对比展示完成；base-select=${f.baseSelect}`);
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. 与现有方案对比（原生 / ARIA combobox / 可定制 / 库）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['原生 auto', f.nativeSelect], ['ARIA combobox', f.comboboxRole]]),
        h(Tag, { color: 'primary' }, '决策树'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '对比四种 select 实现方案：原生 <select>（不可控但免费无障碍）、自定义 ARIA combobox（可控但需手写键盘/焦点）、可定制 <select>（原生语义 + 完全样式控制，最佳平衡）、第三方库（开箱即用但有体积与升级成本）。提供决策树：不需富内容用原生、需且支持 Chrome 130+ 用可定制、需但不支持用 ARIA 或库。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行方案对比演示', { type: 'primary', size: 'sm', onClick: () => this._runComparisonDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '540px', overflow: 'auto' } },
          h('code', {}, s.comparisonInfo || '（点击按钮查看方案对比与决策树）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 6：能力检测 + 渐进增强 =====================

  _runProgressiveDemo() {
    const f = this._flags();
    const info = [
      '===== 能力检测 + 渐进增强策略 =====',
      '',
      '【能力检测：CSS.supports()】',
      '  // 1. appearance: base-select 支持',
      '  const supportsBaseSelect = CSS.supports("appearance", "base-select");',
      '',
      '  // 2. ::picker(select) 伪元素支持',
      '  const supportsPicker = CSS.supports("selector(::picker(select))");',
      '',
      '  // 3. <selectedoption> 元素支持（DOM 检测）',
      '  const supportsSelectedOption =',
      '    document.createElement("selectedoption") instanceof',
      '      document.createElement("select").constructor.prototype.constructor',
      '      || customElements.get("selectedoption") !== undefined',
      '      // 简化：检测元素是否被解析为 HTMLSelectedOptionElement',
      '      || (function() {',
      '           const s = document.createElement("select");',
      '           s.innerHTML = "<button><selectedoption></selectedoption></button>";',
      '           return !!s.querySelector("selectedoption");',
      '         })();',
      '',
      '  // 4. ::checkmark 伪元素',
      '  const supportsCheckmark = CSS.supports("selector(::checkmark)");',
      '',
      '【渐进增强：@supports 块兜底】',
      '  /* 基础样式：所有浏览器可用（原生 <select>） */',
      '  select {',
      '    padding: 8px 12px;',
      '    border: 1px solid #cbd5e1;',
      '    border-radius: 4px;',
      '    font-size: 14px;',
      '  }',
      '',
      '  /* 增强：支持 base-select 时启用可定制模式 */',
      '  @supports (appearance: base-select) {',
      '    select {',
      '      appearance: base-select;',
      '      /* 自定义按钮、面板、选项 */',
      '    }',
      '    select::picker(select) {',
      '      background: #fff;',
      '      border-radius: 8px;',
      '      box-shadow: 0 8px 24px rgba(0,0,0,0.12);',
      '    }',
      '    select option {',
      '      padding: 8px 12px;',
      '      border-radius: 4px;',
      '    }',
      '    select option:hover { background: #f1f5f9; }',
      '    select option:checked { background: #dbeafe; }',
      '  }',
      '',
      '【HTML 渐进增强：按需提供 button 与 selectedoption】',
      '  <!-- 服务端渲染时始终提供 -->',
      '  <select name="fruit">',
      '    <button behavior="select" type="select-button">',
      '      <selectedoption></selectedoption>',
      '      <span aria-hidden="true">▾</span>',
      '    </button>',
      '    <option value="">请选择...</option>',
      '    <option value="apple">苹果</option>',
      '    <option value="orange">橘子</option>',
      '  </select>',
      '',
      '  /* 旧浏览器行为：',
      '     - <button behavior="select"> 被忽略（behavior 是新属性）',
      '     - <selectedoption> 作为未知元素显示（空，无样式）',
      '     - <select> 仍按 appearance: auto 原生渲染',
      '     - 表单提交时 name=fruit=value 正常工作',
      '     注意：<button> 在 <select> 内会被旧浏览器忽略，',
      '           <selectedoption> 会作为空 inline 元素显示，',
      '           需用 CSS 隐藏：selectedoption:not(:defined) { display: none; }',
      '           或检测后用 JS 移除未支持元素 */',
      '',
      '【JS Polyfill 策略（可选）】',
      '  if (!CSS.supports("appearance", "base-select")) {',
      '    // 加载 polyfill（如 select-polyfill 库）',
      '    import("select-polyfill").then(m => m.polyfill());',
      '    // 或降级到自定义 ARIA combobox 组件',
      '  }',
      '',
      '【功能开关：feature flag 平滑迁移】',
      '  const useCustomizableSelect =',
      '    CSS.supports("appearance", "base-select") &&',
      '    CSS.supports("selector(::picker(select))");',
      '',
      '  if (useCustomizableSelect) {',
      '    renderCustomizableSelect();  // 新方案',
      '  } else {',
      '    renderLegacySelect();        // 原生或自定义组件',
      '  }',
      '',
      '【可访问性注意事项】',
      '  - 可定制 <select> 仍保留原生 select 语义（role=listbox/option）',
      '  - 键盘导航：Arrow/Home/End/Type-ahead/Enter/Esc 全部免费',
      '  - 屏幕阅读器：NVDA/JAWS/VoiceOver 自动朗读选中项',
      '  - 不要在 ::picker(select) 内放 role/aria 干扰原生语义',
      '  - 富内容 <option> 需提供 alt 文本：<img alt="苹果图标">',
      '',
      '【当前环境检测结果】',
      `  appearance: auto    = ${f.nativeSelect}`,
      `  appearance: base-select = ${f.baseSelect}`,
      `  ::picker(select)   = ${f.picker}`,
      `  <selectedoption>   = ${f.selectedOption}`,
      `  ::checkmark        = ${f.checkmark}`,
      `  option:checked     = ${f.optionChecked}`,
      '',
      '===== 状态（截至 2025）=====',
      '  Chrome 130+ 起逐步落地',
      '  Firefox / Safari 暂未实现',
      '  建议：生产环境用 @supports 渐进增强，旧浏览器降级到原生 <select>',
      '       仍可用，等所有目标浏览器支持后切换到纯可定制方案',
    ].join('\n');
    this.setState({ progressiveInfo: info });
    this._addLog('cs', `渐进增强策略展示完成；base-select=${f.baseSelect}, picker=${f.picker}`);
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. 能力检测 + 渐进增强策略',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['base-select', f.baseSelect], ['::picker', f.picker], ['<selectedoption>', f.selectedOption]]),
        h(Tag, { color: 'primary' }, '@supports'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '用 CSS.supports() 检测 appearance: base-select / ::picker(select) / <selectedoption> / ::checkmark 支持，配合 @supports 块实现渐进增强：基础样式所有浏览器可用，支持时启用可定制模式。HTML 始终提供 <button behavior="select"> 与 <selectedoption>，旧浏览器忽略新元素并回退到原生 <select>，表单提交不受影响。可加 Polyfill 或功能开关平滑迁移。无障碍保留原生 select 语义，键盘/屏幕阅读器全免费。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行渐进增强演示', { type: 'primary', size: 'sm', onClick: () => this._runProgressiveDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '560px', overflow: 'auto' } },
          h('code', {}, s.progressiveInfo || '（点击按钮查看能力检测与渐进增强策略）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // —— 日志面板 ——
  _renderLogPanel() {
    const s = this.state;
    if (!s.logs || s.logs.length === 0) return null;
    return h(Card, { title: '运行日志' },
      h('div', { class: 'log-list' },
        ...s.logs.map((log) =>
          h('div', { class: `log-item log-${log.type}` },
            h('span', { class: 'log-time' }, log.time),
            h('span', { class: 'log-content' }, log.content),
          ),
        ),
      ),
    );
  }

  renderPage() {
    const s = this.state;
    return [
      h('h2', { class: 'section-title' }, '可定制 <select> API（OpenUI 草案）'),

      h(Alert, {
        type: 'info',
        message: 'Customizable Select —— 原生 <select> 的完全可定制化方案',
        description: '演示 OpenUI / HTML 规范草案的可定制 <select> 完整方案：appearance: base-select 开启脱离 OS 原生模式、<button behavior="select"> 显式触发按钮、::picker(select) 自定义下拉面板（配合 @starting-style 实现打开过渡）、<selectedoption> 自动反映选中项（零 JS）、<option> 富内容（img/svg/badge）+ ::checkmark 勾选标记、与现有方案对比（原生/ARIA combobox/库）及决策树、CSS.supports() 能力检测 + @supports 渐进增强策略。Chrome 130+ 起逐步落地，Firefox/Safari 暂未实现，本页用能力检测 + 代码示例展示，jsdom 不做真实渲染但流程完整。',
      }),

      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,

      h('div', { class: 'feature-grid' },
        this._renderCard1(),
        this._renderCard2(),
        this._renderCard3(),
        this._renderCard4(),
        this._renderCard5(),
        this._renderCard6(),
      ),

      this._renderLogPanel(),
    ];
  }
}
