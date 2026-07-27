// =====================================================================
// CSSObjectModelPage.js —— CSS Object Model 实验室
// 演示 MDN / CSSOM：
//   1. element.style 内联样式 + CSSStyleDeclaration
//      —— style.property = value / setProperty(cssText, priority) /
//         cssText / removeProperty / getPropertyValue / getPropertyPriority /
//         length + [index] 遍历属性名
//   2. getComputedStyle 计算样式
//      —— window.getComputedStyle(el, pseudoElt?) / 读取伪元素 ::before /
//         计算值 vs 指定值 / getPropertyValue / computedStyleMap (Typed OM)
//   3. CSSStyleSheet + insertRule/deleteRule + cssRules
//      —— document.styleSheets / sheet.cssRules / sheet.rules(旧) /
//         insertRule(ruleText, index) / deleteRule(index) /
//         CSSStyleRule / CSSMediaRule / CSSKeyframesRule / CSSImportRule / CSSFontFaceRule
//   4. Constructable Stylesheets + adoptedStyleSheets
//      —— new CSSStyleSheet() / replaceSync / replace (Promise) /
//         insertRule / deleteRule / document.adoptedStyleSheets /
//         ShadowRoot.adoptedStyleSheets / addRule / removeRule (旧)
//   5. CSS.supports + CSS.escape + matchMedia + 规则匹配
//      —— CSS.supports(prop, val) / CSS.supports('(prop: val)') /
//         CSS.escape / element.matches / element.closest /
//         window.matchMedia -> MediaQueryList (matches, change 事件) /
//         querySelectorAll + :scope + :is/:where
// =====================================================================

import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { Props, State } from '../../core/types.js';

export interface CSSObjectModelPageProps extends Props {}

export interface CSSObjectModelPageState extends State {}

export class CSSObjectModelPage extends Page {
  declare props: CSSObjectModelPageProps;
  declare state: CSSObjectModelPageState;
  _constructSheet: any = null;
  _demoStyleEl: any = null;
  _dynStyleEl: any = null;
  _inited: boolean = false;
  _mql: any = null;
  _mqlHandler: any = null;
  initialState(): CSSObjectModelPageState {
    return {
      logs: [],
      capsSummary: '',
      inlineResult: '',         // Card 1: 内联样式操作结果
      computedResult: '',       // Card 2: 计算样式读取结果
      ruleList: '',             // Card 3: cssRules 列表与类型
      adoptStatus: '',          // Card 4: Constructable Stylesheet 状态
      supportsResult: '',       // Card 5: CSS.supports 检测结果
      mediaResult: '',          // Card 5: matchMedia 查询结果
    };
  }

  // —— 生命周期 ——
  componentDidMount(): void {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM。
    // 每次挂载都需要重建的演示（注入样式表 / 重置目标元素）放在守卫之前，
    // 一次性初始化（能力检测）放在守卫之后。
    // 引用在守卫前初始化，render() 中可能用到。
    this._dynStyleEl = null;       // Card 3 动态 <style> 元素引用
    this._constructSheet = null;   // Card 4 Constructable Stylesheet 引用
    this._mql = null;              // Card 5 MediaQueryList 引用
    this._mqlHandler = null;       // Card 5 matchMedia change 回调
    this._injectDemoStyles();

    if (this._inited) return;
    this._inited = true;

    // —— 一次性能力检测（全部用 typeof/in + try/catch，避免 jsdom 抛异常）——
    const cssDefined = typeof CSS !== 'undefined';
    const cssStyleSheetConstructable = typeof CSSStyleSheet !== 'undefined';
    let replaceSyncSupported = false;
    if (cssStyleSheetConstructable) {
      try {
        replaceSyncSupported = typeof CSSStyleSheet.prototype.replaceSync === 'function';
      } catch { replaceSyncSupported = false; }
    }
    let adoptedStyleSheetsSupported = false;
    try {
      adoptedStyleSheetsSupported = typeof document !== 'undefined'
        && typeof document.adoptedStyleSheets !== 'undefined';
    } catch { adoptedStyleSheetsSupported = false; }
    let cssSupportsSupported = false;
    if (cssDefined) {
      try { cssSupportsSupported = typeof CSS.supports === 'function'; }
      catch { cssSupportsSupported = false; }
    }
    let cssEscapeSupported = false;
    if (cssDefined) {
      try { cssEscapeSupported = typeof CSS.escape === 'function'; }
      catch { cssEscapeSupported = false; }
    }
    let matchMediaSupported = false;
    try {
      matchMediaSupported = typeof window !== 'undefined'
        && typeof window.matchMedia === 'function';
    } catch { matchMediaSupported = false; }

    const summary = '能力检测 → '
      + `CSS=${cssDefined}, CSSStyleSheet(构造)=${cssStyleSheetConstructable}, `
      + `replaceSync=${replaceSyncSupported}, adoptedStyleSheets=${adoptedStyleSheetsSupported}, `
      + `CSS.supports=${cssSupportsSupported}, CSS.escape=${cssEscapeSupported}, `
      + `matchMedia=${matchMediaSupported}`;

    this.setState({
      capsSummary: summary,
      logs: [...this.state.logs, { type: 'info', content: summary, time: formatTime() }].slice(-40),
    });
  }

  componentWillUnmount(): void {
    // 移除 Card 3 动态注入的 <style> 元素
    if (this._dynStyleEl) {
      try { this._dynStyleEl.remove(); } catch { /* noop */ }
      this._dynStyleEl = null;
    }
    // 移除 Card 1/2 演示样式（注入到 <head>）
    if (this._demoStyleEl) {
      try { this._demoStyleEl.remove(); } catch { /* noop */ }
      this._demoStyleEl = null;
    }
    // Card 4 Constructable Stylesheet 引用置空（从 adoptedStyleSheets 中移除）
    if (this._constructSheet) {
      try {
        if (typeof document !== 'undefined'
          && Array.isArray(document.adoptedStyleSheets)) {
          document.adoptedStyleSheets = document.adoptedStyleSheets
            .filter((s: any) => s !== this._constructSheet);
        }
      } catch { /* noop */ }
      this._constructSheet = null;
    }
    // Card 5 移除 MediaQueryList change 事件
    if (this._mql && this._mqlHandler) {
      try {
        if (typeof this._mql.removeEventListener === 'function') {
          this._mql.removeEventListener('change', this._mqlHandler);
        } else if (typeof this._mql.removeListener === 'function') {
          this._mql.removeListener(this._mqlHandler);
        }
      } catch { /* noop */ }
    }
    this._mql = null;
    this._mqlHandler = null;
    // 其余通过 this.on() 注册的事件监听由 Component.destroy 统一解绑
  }

  // —— 日志 / 按钮辅助 ——
  _addLog(type: any, content: any) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label: any, opts: any) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // —— 注入演示样式（目标元素初始样式 + ::before 伪元素 + 本页专属日志标签配色）——
  _injectDemoStyles() {
    if (this._demoStyleEl) {
      try { this._demoStyleEl.remove(); } catch { /* noop */ }
    }
    const style = document.createElement('style');
    style.id = 'cssom-demo-style';
    style.textContent = `
      /* Card 1/2 共用目标元素 */
      .cssom-target {
        padding: var(--spacing-md);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-base);
        background: var(--color-bg-spotlight);
        color: var(--color-text);
        font-size: 14px;
        margin-top: var(--spacing-sm);
        transition: all 0.2s;
      }
      /* Card 2 ::before 伪元素 */
      .cssom-target::before {
        content: '⚡';
        margin-right: 6px;
        color: var(--color-primary);
      }
      /* Card 3 动态规则目标 */
      .cssom-dyn-target {
        padding: var(--spacing-md);
        border: 1px dashed var(--color-border);
        border-radius: var(--radius-base);
        margin-top: var(--spacing-sm);
        background: var(--color-bg-container);
      }
      /* Card 4 adopted 样式目标 */
      .cssom-adopt-target {
        padding: var(--spacing-md);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-base);
        margin-top: var(--spacing-sm);
      }
      /* Card 5 规则匹配容器 */
      .cssom-match-stage {
        padding: var(--spacing-md);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-base);
        margin-top: var(--spacing-sm);
      }
      .cssom-match-stage .item {
        padding: 4px 8px;
        margin: 2px 0;
        border-radius: var(--radius-sm);
        background: var(--color-bg-spotlight);
        font-size: 12px;
      }
      .cssom-match-stage .item.highlight { background: var(--color-primary-bg); color: var(--color-primary); }
      .cssom-match-stage .item.warning { background: var(--color-warning-bg); color: var(--color-warning); }
      /* 本页专属日志标签配色 */
      .log-panel__tag--inline { background: #1e4d8b; color: #4da3ff; }
      .log-panel__tag--computed { background: #1e3d5a; color: #8be9fd; }
      .log-panel__tag--sheet { background: #5a3d1e; color: #ffb86c; }
      .log-panel__tag--rule { background: #3a3d1e; color: #f1fa8c; }
      .log-panel__tag--cs { background: #1e5e3a; color: #50fa7b; }
      .log-panel__tag--adopt { background: #1e4d8b; color: #4da3ff; }
      .log-panel__tag--supports { background: #3a3d1e; color: #f1fa8c; }
      .log-panel__tag--match { background: #5a1e3d; color: #ff79c6; }
      .log-panel__tag--media { background: #5a1e3d; color: #ff79c6; }
    `;
    document.head.appendChild(style);
    this._demoStyleEl = style;
  }

  // ===================== Card 1: element.style 内联样式 =====================

  // setProperty 设置 color + important，演示优先级
  _inlineSetProperty() {
    const el = (this.$('.cssom-target') as any);
    if (!el) {
      this._addLog('warn', '未找到 .cssom-target 元素');
      return;
    }
    try {
      // setProperty(propertyName, value, priority) —— priority 为 'important' 或 ''
      el.style.setProperty('color', '#1677ff', 'important');
      el.style.setProperty('background-color', '#e6f4ff', 'important');
      el.style.setProperty('font-size', '18px');
      // 读取优先级：getPropertyPriority 返回 'important' 或 ''
      const priority = el.style.getPropertyPriority('color');
      const value = el.style.getPropertyValue('color');
      const result = `setProperty('color', '#1677ff', 'important') ✓\n`
        + `  getPropertyValue('color') = "${value}"\n`
        + `  getPropertyPriority('color') = "${priority}"\n`
        + `  setProperty('background-color', '#e6f4ff', 'important') ✓\n`
        + `  setProperty('font-size', '18px') ✓ (无 important)`;
      this.setState({ inlineResult: result });
      this._addLog('inline',
        `setProperty 设 color=${value} priority="${priority}"，背景蓝、字号 18px`);
    } catch (err: any) {
      this._addLog('error', `setProperty 失败：${err.message}`);
    }
  }

  // cssText 批量设置整个内联样式字符串
  _inlineCssText() {
    const el = (this.$('.cssom-target') as any);
    if (!el) {
      this._addLog('warn', '未找到 .cssom-target 元素');
      return;
    }
    try {
      // cssText 读写整个内联样式字符串（覆盖式）
      el.style.cssText = 'color: #fff; background-color: #fa541c; font-size: 20px; padding: 16px; border: 2px dashed #d4380d;';
      const ct = el.style.cssText;
      const result = `style.cssText = 'color: #fff; background-color: #fa541c; ...'\n`
        + `  读回 cssText = "${ct}"\n`
        + `  说明：cssText 整体覆盖，原内联样式被替换`;
      this.setState({ inlineResult: result });
      this._addLog('inline',
        `cssText 批量设置 → color=#fff, bg=#fa541c, font-size=20px (整体覆盖)`);
    } catch (err: any) {
      this._addLog('error', `cssText 失败：${err.message}`);
    }
  }

  // removeProperty 移除指定属性
  _inlineRemoveProperty() {
    const el = (this.$('.cssom-target') as any);
    if (!el) {
      this._addLog('warn', '未找到 .cssom-target 元素');
      return;
    }
    try {
      const before = el.style.cssText || '(空)';
      // removeProperty 返回被移除的旧值
      const removed = el.style.removeProperty('color');
      const after = el.style.cssText || '(空)';
      const result = `removeProperty('color') → 返回旧值="${removed}"\n`
        + `  操作前 cssText: ${before}\n`
        + `  操作后 cssText: ${after}`;
      this.setState({ inlineResult: result });
      this._addLog('inline',
        `removeProperty('color') → 旧值="${removed}"，剩余内联样式: ${after}`);
    } catch (err: any) {
      this._addLog('error', `removeProperty 失败：${err.message}`);
    }
  }

  // 遍历所有内联属性名（length + [index]）
  _inlineEnumerate() {
    const el = (this.$('.cssom-target') as any);
    if (!el) {
      this._addLog('warn', '未找到 .cssom-target 元素');
      return;
    }
    try {
      // CSSStyleDeclaration.length + [index] 遍历属性名（连字符形式）
      const decl = el.style;
      const len = typeof decl.length === 'number' ? decl.length : 0;
      const names: any[] = [];
      for (let i = 0; i < len; i++) {
        const name = decl[i]; // 形如 "color" / "background-color"
        if (name) names.push(name);
      }
      const result = `style.length = ${len}\n`
        + `  遍历 style[i] 取属性名：\n`
        + names.map((n: any, i: any) => `    [${i}] ${n} = "${decl.getPropertyValue(n)}"`).join('\n')
        + `\n  注：camelCase 写法（style.fontSize）与连字符写法（style.getPropertyValue('font-size')）等价`;
      this.setState({ inlineResult: result });
      this._addLog('inline',
        `遍历内联样式 → length=${len}，属性名: ${names.length ? names.join(', ') : '(空)'}`);
    } catch (err: any) {
      this._addLog('error', `遍历内联样式失败：${err.message}`);
    }
  }

  // ===================== Card 2: getComputedStyle 计算样式 =====================

  // 读取目标元素的最终计算样式
  _computedRead() {
    const el = (this.$('.cssom-target') as any);
    if (!el) {
      this._addLog('warn', '未找到 .cssom-target 元素');
      return;
    }
    if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
      this._addLog('warn', 'window.getComputedStyle 不可用');
      return;
    }
    try {
      // getComputedStyle 返回 CSSStyleDeclaration（只读，反映最终计算值）
      const cs = window.getComputedStyle(el);
      // 计算值 vs 指定值：color 总是 rgb()，length 总是 px
      const color = cs.getPropertyValue('color');
      const fontSize = cs.getPropertyValue('font-size');
      const display = cs.getPropertyValue('display');
      const margin = cs.getPropertyValue('margin');
      const result = `getComputedStyle(el) → CSSStyleDeclaration (只读)\n`
        + `  color        = "${color}"  (计算值，rgb() 形式)\n`
        + `  font-size    = "${fontSize}"  (计算值，px 形式)\n`
        + `  display      = "${display}"\n`
        + `  margin       = "${margin}"  (四个方向计算值)`;
      this.setState({ computedResult: result });
      this._addLog('computed',
        `getComputedStyle → color=${color}, font-size=${fontSize}, display=${display}`);
    } catch (err: any) {
      this._addLog('error', `getComputedStyle 失败：${err.message}`);
    }
  }

  // 读取伪元素 ::before 的 content
  _computedPseudo() {
    const el = (this.$('.cssom-target') as any);
    if (!el) {
      this._addLog('warn', '未找到 .cssom-target 元素');
      return;
    }
    if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
      this._addLog('warn', 'window.getComputedStyle 不可用');
      return;
    }
    try {
      // 第二参数传伪元素选择器（':before' / ':after' / ':hover' 等）
      const cs = window.getComputedStyle(el, '::before');
      const content = cs.getPropertyValue('content');
      const color = cs.getPropertyValue('color');
      const result = `getComputedStyle(el, '::before') → 伪元素计算样式\n`
        + `  content = "${content}"  (含引号；jsdom 可能返回 'none')\n`
        + `  color   = "${color}"\n`
        + `  注：jsdom 不渲染伪元素，可能返回 'none' / 空字符串`;
      this.setState({ computedResult: result });
      this._addLog('computed',
        `getComputedStyle(el, '::before') → content="${content}", color=${color}`);
    } catch (err: any) {
      this._addLog('error', `读取伪元素失败：${err.message}`);
    }
  }

  // computedStyleMap (CSS Typed OM)
  _computedStyleMap() {
    const el = (this.$('.cssom-target') as any);
    if (!el) {
      this._addLog('warn', '未找到 .cssom-target 元素');
      return;
    }
    if (typeof el.computedStyleMap !== 'function') {
      this._addLog('warn', 'element.computedStyleMap 不可用（CSS Typed OM，需 Chrome 87+）');
      this.setState({ computedResult: 'element.computedStyleMap 不可用（jsdom / 旧浏览器不支持 CSS Typed OM）' });
      return;
    }
    try {
      // computedStyleMap() 返回 StylePropertyMapReadOnly，get 返回 CSSUnitValue 等
      const map = el.computedStyleMap();
      const fs = map.get('font-size');
      const color = map.get('color');
      const fsStr = fs ? `CSSUnitValue{value:${fs.value}, unit:"${fs.unit}"}` : 'null';
      const colorStr = color ? `${color.constructor.name}{${color.toString()}}` : 'null';
      const result = `el.computedStyleMap() → StylePropertyMapReadOnly\n`
        + `  get('font-size') = ${fsStr}\n`
        + `  get('color')     = ${colorStr}\n`
        + `  注：Typed OM 返回 CSSUnitValue / CSSKeywordValue 等类型化对象，而非字符串`;
      this.setState({ computedResult: result });
      this._addLog('computed',
        `computedStyleMap() → font-size=${fsStr}, color=${colorStr}`);
    } catch (err: any) {
      this._addLog('error', `computedStyleMap 失败：${err.message}`);
    }
  }

  // ===================== Card 3: CSSStyleSheet + insertRule/deleteRule =====================

  // 获取或创建动态 <style> 元素的 sheet
  _getDynSheet() {
    if (this._dynStyleEl && this._dynStyleEl.parentNode) {
      return this._dynStyleEl.sheet || null;
    }
    try {
      const style = document.createElement('style');
      style.id = 'cssom-dyn-style';
      document.head.appendChild(style);
      this._dynStyleEl = style;
      this._addLog('sheet', '已创建 <style> 元素并注入 <head>（this._dynStyleEl 引用）');
      return style.sheet || null;
    } catch (err: any) {
      this._addLog('error', `创建 <style> 失败：${err.message}`);
      return null as any;
    }
  }

  // insertRule 注入规则
  _sheetInsertRule() {
    const sheet = this._getDynSheet();
    if (!sheet) {
      this._addLog('warn', 'CSSStyleSheet 不可用（sheet 为 null）');
      return;
    }
    if (typeof sheet.insertRule !== 'function') {
      this._addLog('warn', 'sheet.insertRule 不可用');
      return;
    }
    try {
      // insertRule(ruleText, index) —— index 默认 0，返回插入位置
      const ruleText = `.dynamic-rule { color: #ff4d4f; font-weight: bold; background: #fff1f0; padding: 4px 8px; border-radius: 4px; }`;
      const idx = sheet.insertRule(ruleText, sheet.cssRules ? sheet.cssRules.length : 0);
      // 同步给目标元素加 .dynamic-rule 类以便观察（jsdom 不渲染，仅日志记录）
      const target = (this.$('.cssom-dyn-target') as any);
      if (target) target.classList.add('dynamic-rule');
      this._addLog('rule',
        `insertRule("${ruleText.slice(0, 40)}...", ${idx}) → 返回 index=${idx}，cssRules.length=${sheet.cssRules.length}`);
      this._listCssRules();
    } catch (err: any) {
      this._addLog('error', `insertRule 失败：${err.message}`);
    }
  }

  // 列出 cssRules 类型
  _listCssRules() {
    const sheet = this._getDynSheet();
    if (!sheet) {
      this._addLog('warn', 'CSSStyleSheet 不可用');
      return;
    }
    try {
      const rules = sheet.cssRules || sheet.rules; // sheet.rules 为旧 API
      if (!rules) {
        this.setState({ ruleList: 'sheet.cssRules / sheet.rules 均为空或不可读' });
        this._addLog('rule', 'cssRules 不可读（jsdom 部分实现）');
        return;
      }
      const list: any[] = [];
      for (let i = 0; i < rules.length; i++) {
        const r = rules[i];
        // CSSRule 类型常量：1=STYLE_RULE, 4=MEDIA_RULE, 5=FONT_FACE_RULE,
        //                7=KEYFRAMES_RULE, 3=IMPORT_RULE
        const typeName = this._ruleTypeName(r);
        let detail = '';
        // CSSStyleRule 有 selectorText / style.cssText
        if (typeof r.selectorText === 'string') {
          detail = `selector="${r.selectorText}"`;
        }
        // CSSMediaRule 有 media.mediaText
        if (r.media && typeof r.media.mediaText === 'string') {
          detail = `media="${r.media.mediaText}"`;
        }
        // CSSKeyframesRule 有 name
        if (typeof r.name === 'string') {
          detail = `name="${r.name}"`;
        }
        list.push(`[${i}] ${typeName} ${detail}`.trim());
      }
      const result = `sheet.cssRules.length = ${rules.length}\n`
        + `  规则列表：\n`
        + list.map((l: any) => `    ${l}`).join('\n')
        + `\n  CSSRule 类型常量：1=STYLE_RULE, 4=MEDIA_RULE, 5=FONT_FACE_RULE, 7=KEYFRAMES_RULE, 3=IMPORT_RULE`;
      this.setState({ ruleList: result });
      this._addLog('rule',
        `列出 cssRules → 共 ${rules.length} 条：${list.slice(0, 5).join('; ')}${list.length > 5 ? ' ...' : ''}`);
    } catch (err: any) {
      this._addLog('error', `列出 cssRules 失败：${err.message}`);
    }
  }

  // CSSRule 类型名称映射
  _ruleTypeName(rule: any) {
    try {
      if (typeof CSSRule === 'undefined') return `type=${rule.type}`;
      const map = {
        [CSSRule.STYLE_RULE]: 'CSSStyleRule',
        [CSSRule.MEDIA_RULE]: 'CSSMediaRule',
        [CSSRule.FONT_FACE_RULE]: 'CSSFontFaceRule',
        [CSSRule.KEYFRAMES_RULE]: 'CSSKeyframesRule',
        [CSSRule.IMPORT_RULE]: 'CSSImportRule',
      };
      return (map as any)[rule.type] || `type=${rule.type}`;
    } catch {
      return `type=${rule.type}`;
    }
  }

  // deleteRule 移除最后一条
  _sheetDeleteRule() {
    const sheet = this._getDynSheet();
    if (!sheet) {
      this._addLog('warn', 'CSSStyleSheet 不可用');
      return;
    }
    if (typeof sheet.deleteRule !== 'function') {
      this._addLog('warn', 'sheet.deleteRule 不可用');
      return;
    }
    try {
      const rules = sheet.cssRules || sheet.rules;
      if (!rules || rules.length === 0) {
        this._addLog('warn', 'cssRules 为空，无规则可删除');
        return;
      }
      const idx = rules.length - 1;
      const removed = this._ruleTypeName(rules[idx]);
      sheet.deleteRule(idx);
      this._addLog('rule',
        `deleteRule(${idx}) → 移除 ${removed}，剩余 cssRules.length=${sheet.cssRules.length}`);
      this._listCssRules();
    } catch (err: any) {
      this._addLog('error', `deleteRule 失败：${err.message}`);
    }
  }

  // ===================== Card 4: Constructable Stylesheets + adoptedStyleSheets =====================

  // 创建 Constructable Stylesheet
  _createConstructSheet() {
    if (typeof CSSStyleSheet === 'undefined') {
      this._addLog('warn', 'CSSStyleSheet 构造器不可用（typeof CSSStyleSheet === "undefined"）');
      return;
    }
    if (typeof CSSStyleSheet.prototype.replaceSync !== 'function') {
      this._addLog('warn', 'CSSStyleSheet.prototype.replaceSync 不可用（需 Chrome 99+）');
      return;
    }
    try {
      // new CSSStyleSheet() —— 不依赖 DOM，构造独立样式表
      const sheet = new CSSStyleSheet();
      // replaceSync 同步替换内容
      sheet.replaceSync(`
        .cssom-adopt-target {
          background: #f6ffed;
          border-color: #52c41a;
          color: #389e0d;
          font-weight: bold;
        }
        .cs-badge {
          display: inline-block;
          padding: 2px 8px;
          background: #52c41a;
          color: #fff;
          border-radius: 10px;
          font-size: 12px;
          margin-left: 6px;
        }
      `);
      this._constructSheet = sheet;
      const result = `new CSSStyleSheet() ✓\n`
        + `  sheet.replaceSync(cssText) ✓ —— 注入 .cssom-adopt-target / .cs-badge 规则\n`
        + `  注：尚未应用到 document，需点击 "adoptedStyleSheets 应用到 document"`;
      this.setState({ adoptStatus: result });
      this._addLog('cs',
        `new CSSStyleSheet() + replaceSync() ✓ —— 构造样式表（不依赖 DOM），待 adopt`);
    } catch (err: any) {
      this._addLog('error', `创建 Constructable Stylesheet 失败：${err.message}`);
    }
  }

  // adoptedStyleSheets 应用到 document
  _adoptToDocument() {
    if (!this._constructSheet) {
      this._addLog('warn', '尚未创建 Constructable Stylesheet，请先点击 "创建 Constructable Stylesheet"');
      return;
    }
    if (typeof document === 'undefined' || typeof document.adoptedStyleSheets === 'undefined') {
      this._addLog('warn', 'document.adoptedStyleSheets 不可用（typeof undefined）');
      return;
    }
    try {
      // document.adoptedStyleSheets = [...] —— 应用到整个文档
      // 必须用新数组赋值（不可 push，部分实现要求冻结数组）
      const existing = Array.isArray(document.adoptedStyleSheets)
        ? document.adoptedStyleSheets.slice() : [];
      if (!existing.includes(this._constructSheet)) {
        existing.push(this._constructSheet);
      }
      document.adoptedStyleSheets = existing;
      // 同步给目标元素加 .cs-badge 子节点以便观察（jsdom 不渲染，仅日志记录）
      const target = (this.$('.cssom-adopt-target') as any);
      if (target && !target.querySelector('.cs-badge')) {
        const badge = document.createElement('span');
        badge.className = 'cs-badge';
        badge.textContent = 'adopted';
        target.appendChild(badge);
      }
      const result = `document.adoptedStyleSheets = [sheet] ✓\n`
        + `  adoptedStyleSheets.length = ${document.adoptedStyleSheets.length}\n`
        + `  ShadowRoot.adoptedStyleSheets 同理（应用于 Shadow DOM）\n`
        + `  注：jsdom 不渲染样式，规则已注入但视觉无变化；真实浏览器中生效`;
      this.setState({ adoptStatus: result });
      this._addLog('adopt',
        `document.adoptedStyleSheets 应用 ✓ —— length=${document.adoptedStyleSheets.length}`);
    } catch (err: any) {
      this._addLog('error', `adoptedStyleSheets 失败：${err.message}`);
    }
  }

  // 替换 Constructable Stylesheet 内容
  _replaceConstructSheet() {
    if (!this._constructSheet) {
      this._addLog('warn', '尚未创建 Constructable Stylesheet，请先点击 "创建 Constructable Stylesheet"');
      return;
    }
    const sheet = this._constructSheet;
    try {
      // replaceSync 同步替换
      sheet.replaceSync(`
        .cssom-adopt-target {
          background: #fff7e6;
          border-color: #fa8c16;
          color: #d4380d;
          font-weight: bold;
          border-style: dashed;
        }
        .cs-badge {
          display: inline-block;
          padding: 2px 8px;
          background: #fa8c16;
          color: #fff;
          border-radius: 10px;
          font-size: 12px;
          margin-left: 6px;
        }
      `);
      const result = `sheet.replaceSync(新 cssText) ✓ —— 内容已替换为橙色主题\n`
        + `  另有 sheet.replace(cssText) —— 异步，返回 Promise\n`
        + `  sheet.insertRule / sheet.deleteRule —— 同 CSSStyleSheet 接口\n`
        + `  sheet.addRule / sheet.removeRule —— 旧 API（已废弃）`;
      this.setState({ adoptStatus: result });
      this._addLog('cs',
        `replaceSync() ✓ —— 替换为橙色主题（同步）`);
      // 演示 sheet.replace 异步（返回 Promise）
      if (typeof sheet.replace === 'function') {
        try {
          const p = sheet.replace('.cssom-adopt-target { border-style: solid; }');
          if (p && typeof p.then === 'function') {
            p.then(() => {
              this._addLog('cs', `sheet.replace() Promise resolve ✓ —— 异步替换成功`);
            }).catch((e: any) => {
              this._addLog('warn', `sheet.replace() Promise reject: ${e && e.message}`);
            });
          }
        } catch (e: any) {
          this._addLog('warn', `sheet.replace 调用失败：${e && e.message}`);
        }
      }
    } catch (err: any) {
      this._addLog('error', `replaceSync 失败：${err.message}`);
    }
  }

  // ===================== Card 5: CSS.supports + CSS.escape + matchMedia + 规则匹配 =====================

  // CSS.supports 检测 grid/flex/lab/color-mix
  _supportsCheck() {
    if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') {
      this._addLog('warn', 'CSS.supports 不可用（typeof CSS.supports !== "function"）');
      this.setState({ supportsResult: 'CSS.supports 不可用' });
      return;
    }
    try {
      // CSS.supports(property, value) 或 CSS.supports('(property: value)')
      const checks = [
        ['display', 'grid', CSS.supports('display', 'grid')],
        ['display', 'flex', CSS.supports('display', 'flex')],
        ['color', 'lab(50% 40 30)', CSS.supports('color', 'lab(50% 40 30)')],
        ['color', 'color-mix(in srgb, red, blue)', CSS.supports('color', 'color-mix(in srgb, red, blue)')],
        ['(display: grid)', null, CSS.supports('(display: grid)')],
        ['(color: lab(50% 40 30))', null, CSS.supports('(color: lab(50% 40 30))')],
      ];
      const lines = checks.map(([p, v, ok]: any) => {
        const call = v === null ? `CSS.supports('${p}')` : `CSS.supports('${p}', '${v}')`;
        return `  ${ok ? '✓' : '✗'}  ${call}  →  ${ok}`;
      });
      const result = `CSS.supports 检测结果：\n${lines.join('\n')}\n`
        + `  注：jsdom 中 CSS.supports 已 polyfill 为返回 false`;
      this.setState({ supportsResult: result });
      this._addLog('supports',
        `supports 检测 → grid=${checks[0][2]}, flex=${checks[1][2]}, lab=${checks[2][2]}, color-mix=${checks[3][2]}`);
    } catch (err: any) {
      this._addLog('error', `CSS.supports 失败：${err.message}`);
    }
  }

  // element.matches 演示
  _matchesDemo() {
    const el = (this.$('.cssom-match-stage .item.highlight') as any);
    if (!el) {
      this._addLog('warn', '未找到 .item.highlight 元素');
      return;
    }
    if (typeof el.matches !== 'function') {
      this._addLog('warn', 'element.matches 不可用');
      return;
    }
    try {
      // CSS.escape 转义选择器中的特殊字符
      let escapeInfo = '';
      if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        const raw = 'a.b#c';
        const escaped = CSS.escape(raw);
        escapeInfo = `\n  CSS.escape('${raw}') = "${escaped}" —— 转义 . # 等特殊字符`;
      } else {
        escapeInfo = '\n  CSS.escape 不可用（typeof undefined）';
      }
      // element.matches(selector) 检查元素是否匹配选择器
      const m1 = el.matches('.item');
      const m2 = el.matches('.item.highlight');
      const m3 = el.matches('.item.warning');
      const m4 = el.matches(':is(.item):where(.highlight)');
      const result = `element.matches(selector) 检查元素是否匹配选择器：\n`
        + `  el.matches('.item')              = ${m1}\n`
        + `  el.matches('.item.highlight')    = ${m2}\n`
        + `  el.matches('.item.warning')      = ${m3}\n`
        + `  el.matches(':is(.item):where(.highlight)') = ${m4}`
        + escapeInfo;
      this.setState({ supportsResult: result });
      this._addLog('match',
        `matches → .item=${m1}, .item.highlight=${m2}, .item.warning=${m3}`);
    } catch (err: any) {
      this._addLog('error', `matches 失败：${err.message}`);
    }
  }

  // element.closest 演示
  _closestDemo() {
    const el = (this.$('.cssom-match-stage .item.highlight') as any);
    if (!el) {
      this._addLog('warn', '未找到 .item.highlight 元素');
      return;
    }
    if (typeof el.closest !== 'function') {
      this._addLog('warn', 'element.closest 不可用');
      return;
    }
    try {
      // element.closest(selector) 向上查找最近匹配祖先（含自身）
      const c1 = el.closest('.item');
      const c2 = el.closest('.cssom-match-stage');
      const c3 = el.closest('body');
      const c1info = c1 ? c1.className : 'null';
      const c2info = c2 ? c2.className : 'null';
      const c3info = c2 ? c3.tagName.toLowerCase() : 'null';
      // querySelectorAll + :scope + :is/:where 演示
      const stage = (this.$('.cssom-match-stage') as any);
      let scopeInfo = '';
      if (stage) {
        // :scope 限定查询根；:is/:where 接受选择器列表
        const scoped = stage.querySelectorAll(':scope > .item');
        const isMatch = stage.querySelectorAll(':is(.item.highlight, .item.warning)');
        const whereMatch = stage.querySelectorAll(':where(.item.highlight, .item.warning)');
        scopeInfo = `\n  stage.querySelectorAll(':scope > .item') → ${scoped.length} 个\n`
          + `  stage.querySelectorAll(':is(.item.highlight, .item.warning)') → ${isMatch.length} 个\n`
          + `  stage.querySelectorAll(':where(.item.highlight, .item.warning)') → ${whereMatch.length} 个\n`
          + `  注：:is 与 :where 区别——:where 优先级始终为 0，:is 取最高优先级参数`;
      }
      const result = `element.closest(selector) 向上查找最近匹配祖先：\n`
        + `  el.closest('.item')              = <${c1 ? c1.tagName.toLowerCase() : '?'} class="${c1info}">\n`
        + `  el.closest('.cssom-match-stage') = <${c2 ? c2.tagName.toLowerCase() : '?'} class="${c2info}">\n`
        + `  el.closest('body')               = <${c3info}>${scopeInfo}`;
      this.setState({ supportsResult: result });
      this._addLog('match',
        `closest → .item="${c1info}", .cssom-match-stage="${c2info}"`);
    } catch (err: any) {
      this._addLog('error', `closest 失败：${err.message}`);
    }
  }

  // matchMedia 演示
  _matchMediaDemo() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      this._addLog('warn', 'window.matchMedia 不可用');
      this.setState({ mediaResult: 'window.matchMedia 不可用' });
      return;
    }
    try {
      // 移除上一次的监听
      if (this._mql && this._mqlHandler) {
        try {
          if (typeof this._mql.removeEventListener === 'function') {
            this._mql.removeEventListener('change', this._mqlHandler);
          } else if (typeof this._mql.removeListener === 'function') {
            this._mql.removeListener(this._mqlHandler);
          }
        } catch { /* noop */ }
      }
      // window.matchMedia(query) → MediaQueryList（含 matches 属性 + change 事件）
      const query = '(prefers-color-scheme: dark)';
      const mql = window.matchMedia(query);
      this._mql = mql;
      // 注册 change 回调（this._mqlHandler 引用便于 componentWillUnmount 移除）
      this._mqlHandler = (e: any) => {
        this._addLog('media',
          `MediaQueryList change → matches=${e.matches}（prefers-color-scheme 切换为 ${e.matches ? 'dark' : 'light'}）`);
      };
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', this._mqlHandler);
      } else if (typeof mql.addListener === 'function') {
        mql.addListener(this._mqlHandler);
      }
      const result = `window.matchMedia('${query}') → MediaQueryList\n`
        + `  mql.matches = ${mql.matches}  (当前是否匹配)\n`
        + `  mql.media   = "${mql.media}"\n`
        + `  已注册 change 事件（系统主题切换时触发，jsdom 不会触发）\n`
        + `  注：componentWillUnmount 会 removeEventListener 防止泄漏`;
      this.setState({ mediaResult: result });
      this._addLog('media',
        `matchMedia('${query}') → matches=${mql.matches}，已注册 change 监听`);
    } catch (err: any) {
      this._addLog('error', `matchMedia 失败：${err.message}`);
    }
  }

  // ===================== Card 渲染 =====================

  _renderCard1() {
    const s = this.state;
    return h(Card, {
      title: '1. element.style 内联样式 + CSSStyleDeclaration',
      extra: h(Tag, { color: 'success' }, '稳定'),
    },
      h('div', { class: 'flex flex-col gap-sm' },
        h('p', { class: 'fs-sm text-secondary' },
          'element.style 是 CSSStyleDeclaration 实例，读写元素内联样式。style.property = value（camelCase）与 style.setProperty(property, value, priority) 等价，后者可设 important。style.cssText 读写整个内联样式字符串。removeProperty 返回旧值并移除属性。getPropertyValue / getPropertyPriority 读取值与优先级。style.length + style[index] 可遍历所有已设置属性名（连字符形式）。'),
        h('div', { class: 'flex gap-sm flex-wrap' },
          this._btn('setProperty 设 color+important', { type: 'primary', size: 'sm', onClick: () => this._inlineSetProperty() }),
          this._btn('cssText 批量设置', { size: 'sm', onClick: () => this._inlineCssText() }),
          this._btn('removeProperty 移除', { size: 'sm', onClick: () => this._inlineRemoveProperty() }),
          this._btn('遍历所有内联属性名', { size: 'sm', onClick: () => this._inlineEnumerate() }),
        ),
        h('div', { class: 'cssom-target' },
          '目标元素 .cssom-target —— 点击上方按钮通过 element.style 修改其内联样式（jsdom 不渲染，仅日志可见）'),
        s.inlineResult && h('pre', { class: 'code-block' }, s.inlineResult),
      ),
    );
  }

  _renderCard2() {
    const s = this.state;
    return h(Card, {
      title: '2. getComputedStyle 计算样式',
      extra: h(Tag, { color: 'success' }, '稳定'),
    },
      h('div', { class: 'flex flex-col gap-sm' },
        h('p', { class: 'fs-sm text-secondary' },
          'window.getComputedStyle(element, pseudoElt?) 返回 CSSStyleDeclaration（只读，反映最终计算值）。第二参数传 ":before"/":after"/":hover" 等可读取伪元素样式。计算值与指定值不同：color 总是 rgb() 形式，length 总是 px 形式。getPropertyValue 读取单个属性。element.computedStyleMap() 是 CSS Typed OM 接口，返回 StylePropertyMapReadOnly，get 返回 CSSUnitValue 等类型化对象。'),
        h('div', { class: 'flex gap-sm flex-wrap' },
          this._btn('读取计算样式', { type: 'primary', size: 'sm', onClick: () => this._computedRead() }),
          this._btn('读取伪元素 ::before', { size: 'sm', onClick: () => this._computedPseudo() }),
          this._btn('computedStyleMap Typed OM', { size: 'sm', onClick: () => this._computedStyleMap() }),
        ),
        h('div', { class: 'cssom-target' },
          '目标元素 .cssom-target —— 含 ::before 伪元素（content: ⚡），点击按钮读取其计算样式'),
        s.computedResult && h('pre', { class: 'code-block' }, s.computedResult),
      ),
    );
  }

  _renderCard3() {
    const s = this.state;
    return h(Card, {
      title: '3. CSSStyleSheet + insertRule/deleteRule + cssRules',
      extra: h(Tag, { color: 'success' }, '稳定'),
    },
      h('div', { class: 'flex flex-col gap-sm' },
        h('p', { class: 'fs-sm text-secondary' },
          'document.styleSheets 集合（只读 HTMLLinkElement/HTMLStyleElement 对应的 StyleSheet）。sheet.cssRules / sheet.rules（旧）返回 CSSRuleList。sheet.insertRule(ruleText, index) 插入规则并返回位置，sheet.deleteRule(index) 删除指定位置。CSSRule 子类型：CSSStyleRule（selectorText/style）、CSSMediaRule（media/mediaText）、CSSKeyframesRule（cssRules/findRule/appendRule/deleteRule）、CSSImportRule、CSSFontFaceRule 等。'),
        h('div', { class: 'flex gap-sm flex-wrap' },
          this._btn('insertRule 注入规则', { type: 'primary', size: 'sm', onClick: () => this._sheetInsertRule() }),
          this._btn('列出 cssRules 类型', { size: 'sm', onClick: () => this._listCssRules() }),
          this._btn('deleteRule 移除', { size: 'sm', danger: true, onClick: () => this._sheetDeleteRule() }),
        ),
        h('div', { class: 'cssom-dyn-target' },
          '动态规则目标 .cssom-dyn-target —— insertRule 注入 .dynamic-rule 后会同步加 class 以便观察'),
        s.ruleList && h('pre', { class: 'code-block' }, s.ruleList),
      ),
    );
  }

  _renderCard4() {
    const s = this.state;
    const constructable = typeof CSSStyleSheet !== 'undefined'
      && typeof CSSStyleSheet.prototype.replaceSync === 'function';
    const adopted = typeof document !== 'undefined'
      && typeof document.adoptedStyleSheets !== 'undefined';
    return h(Card, {
      title: '4. Constructable Stylesheets + adoptedStyleSheets',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: constructable ? 'success' : 'error' }, constructable ? 'CSSStyleSheet' : 'CSSStyleSheet ✕'),
        h(Tag, { color: adopted ? 'success' : 'error' }, adopted ? 'adoptedStyleSheets' : 'adoptedStyleSheets ✕'),
      ),
    },
      h('div', { class: 'flex flex-col gap-sm' },
        h('p', { class: 'fs-sm text-secondary' },
          'new CSSStyleSheet() 构造独立样式表（不依赖 DOM）。sheet.replaceSync(cssText) 同步替换内容，sheet.replace(cssText) 异步返回 Promise。sheet.insertRule / sheet.deleteRule 同 CSSStyleSheet 接口。document.adoptedStyleSheets = [sheet] 应用到整个文档，ShadowRoot.adoptedStyleSheets 应用于 Shadow DOM。sheet.addRule / sheet.removeRule 为旧 API（已废弃）。'),
        (!constructable || !adopted) && h(Alert, {
          type: 'warning',
          message: '部分能力当前环境不支持',
          description: `CSSStyleSheet 可构造 + replaceSync: ${constructable ? '已支持' : '未支持（jsdom 中 replaceSync 不可用）'}。document.adoptedStyleSheets: ${adopted ? '已支持' : '未支持'}。本页能力检测后将在不支持时记 warn 日志，不抛异常。`,
        }),
        h('div', { class: 'flex gap-sm flex-wrap' },
          this._btn('创建 Constructable Stylesheet', { type: 'primary', size: 'sm', onClick: () => this._createConstructSheet() }),
          this._btn('adoptedStyleSheets 应用到 document', { size: 'sm', onClick: () => this._adoptToDocument() }),
          this._btn('替换内容', { size: 'sm', onClick: () => this._replaceConstructSheet() }),
        ),
        h('div', { class: 'cssom-adopt-target' },
          'adopted 样式目标 .cssom-adopt-target —— adopt 后通过 adoptedStyleSheets 应用样式（jsdom 不渲染，真实浏览器生效）'),
        s.adoptStatus && h('pre', { class: 'code-block' }, s.adoptStatus),
      ),
    );
  }

  _renderCard5() {
    const s = this.state;
    return h(Card, {
      title: '5. CSS.supports + CSS.escape + matchMedia + CSS 规则匹配',
      extra: h(Tag, { color: 'success' }, '稳定'),
    },
      h('div', { class: 'flex flex-col gap-sm' },
        h('p', { class: 'fs-sm text-secondary' },
          'CSS.supports(property, value) 或 CSS.supports(\'(property: value)\') 检测浏览器是否支持某 CSS 特性，返回 boolean。CSS.escape(string) 转义选择器中的特殊字符（如 . # 等）。element.matches(selector) 检查元素是否匹配选择器。element.closest(selector) 向上查找最近匹配祖先。window.matchMedia(query) 返回 MediaQueryList（matches 属性 + change 事件）。querySelectorAll 配合 :scope / :is / :where 实现复杂选择器查询。'),
        h('div', { class: 'flex gap-sm flex-wrap' },
          this._btn('supports 检测 grid/flex/lab/color-mix', { type: 'primary', size: 'sm', onClick: () => this._supportsCheck() }),
          this._btn('matches 演示', { size: 'sm', onClick: () => this._matchesDemo() }),
          this._btn('closest 演示', { size: 'sm', onClick: () => this._closestDemo() }),
          this._btn("matchMedia '(prefers-color-scheme: dark)'", { size: 'sm', onClick: () => this._matchMediaDemo() }),
        ),
        h('div', { class: 'cssom-match-stage' },
          h('div', { class: 'item highlight' }, 'item.highlight（matches / closest 演示目标）'),
          h('div', { class: 'item warning' }, 'item.warning'),
          h('div', { class: 'item' }, 'item（普通）'),
        ),
        s.supportsResult && h('pre', { class: 'code-block' }, s.supportsResult),
        s.mediaResult && h('pre', { class: 'code-block' }, s.mediaResult),
      ),
    );
  }

  // ===================== 日志面板 =====================
  _renderLogPanel() {
    const s = this.state;
    return h('div', { class: 'log-panel' },
      h('div', { class: 'log-panel__header' }, '事件日志'),
      s.logs.length === 0
        ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
        : s.logs.map((log: any) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  // ===================== 渲染主结构 =====================
  render() {
    const s = this.state;
    return h('div', { class: 'page api-lab-page' },
      h('h2', { class: 'section-title' }, 'CSS Object Model 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' }, '演示 CSSOM：element.style 内联样式 / getComputedStyle 计算样式 / CSSStyleSheet 规则操作 / Constructable Stylesheets + adoptedStyleSheets / CSS.supports + matchMedia。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null as any,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderLogPanel(),
    );
  }
}
