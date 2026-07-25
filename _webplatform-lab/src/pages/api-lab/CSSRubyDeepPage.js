// =====================================================================
// CSSRubyDeepPage.js —— CSS Ruby 注音排版 实验室
// 演示 CSS Ruby Annotation Layout Module Level 1 + HTML <ruby>/<rt>/<rp>/
//   <rb>/<rtc> 元素（注音排版：拼音 / 振假名 / 谚文注音 / 注音符号）：
//   1. ruby HTML 元素语义 —— <ruby>/<rt>/<rp>/<rb>/<rtc> 元素语义 + 浏览器
//      UA 默认样式（ruby/ruby-base/ruby-text/ruby-text-container 内部 display 值）
//      + 单注音（每字一音）/ 复合注音（多字共享一注音 + <rb>）/ <rtc> 双层注音
//   2. ruby-position —— over（上方，默认）/ under（下方，中文教育副标读音）/
//      inter-character（字符之间，繁体注音 ㄅㄆㄇㄈ 专用）+ writing-mode 协同
//      （vertical-rl 下 over=右）+ Safari 旧版 -webkit-ruby-position 兼容
//   3. ruby-align —— start（起始对齐）/ center（居中，默认）/ space-between
//      （两端对齐）/ space-around（分散对齐）+ 双值语法（基础/注音分别对齐）
//   4. ruby-merge —— separate（默认，每字独立）/ collapse（多字合并为一基底，
//      适合日语熟字訓如「今日=kyō」）/ auto（CJK 合并/拉丁独立）+ ruby-overhang
//      —— auto（默认，注音悬挂到相邻字符，不影响行高）/ none（不悬挂，精确排版）
//   5. 双层注音 —— 拼音+注音、汉字+罗马字、汉字+韩文谚文 + <rtc> 嵌套结构
//      + <rb> 元素（草案）+ 嵌套 <ruby> 替代方案（兼容性更广）
//   6. CJK 排版协同 —— text-spacing-trim（标点挤压）/ line-break: strict
//      （标点不顶头）/ letter-spacing（字距）/ 字号比例约定（注音约正文 1/2~1/3）
//   7. 实战：教育网站字典卡片 —— 汉字 + 拼音 + 五笔 + 部首 + 释义 + Ruby 与
//      垂直排版（writing-mode: vertical-rl + ruby-position: over，竖排时 over=右）
//   8. 可访问性与降级 —— 屏幕阅读器朗读规则（NVDA/VoiceOver/JAWS）、<rp> 隐藏
//      括号降级、role="ruby"/aria-label、浏览器支持矩阵、@supports / JS polyfill
// 说明：所有特性调用前做 typeof / CSS.supports 能力检测，不可用时仅记日志
//       （_addLog('warn', ...)），绝不抛异常。jsdom 不做真实 CSS 渲染，
//       CSS.supports 通常可用；ruby-position / ruby-align 较新浏览器支持，
//       ruby-merge / ruby-overhang 仍实验性，jsdom 可能不识别，统一 try/catch 兜底。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class CSSRubyDeepPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      // Card 1：ruby HTML 元素语义
      rubySemanticInfo: '',
      // Card 2：ruby-position
      rubyPositionInfo: '',
      // Card 3：ruby-align
      rubyAlignInfo: '',
      // Card 4：ruby-merge + ruby-overhang
      rubyMergeInfo: '',
      // Card 5：双层注音
      doubleRubyInfo: '',
      // Card 6：CJK 排版协同
      cjkComboInfo: '',
      // Card 7：实战：字典卡片
      dictCardInfo: '',
      // Card 8：可访问性与降级
      a11yFallbackInfo: '',
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._dynamicStyles = [];     // 动态创建并插入 head 的 <style> 元素列表
    this._rubyPosition = 'over';  // Card 2 当前 ruby-position 值
    this._rubyAlign = 'center';   // Card 3 当前 ruby-align 值
    this._rubyMerge = 'separate'; // Card 4 当前 ruby-merge 值
    this._overhang = 'auto';      // Card 4 当前 ruby-overhang 值
    this._trimOn = false;         // Card 6 text-spacing-trim 是否开启
    this._verticalMode = false;   // Card 7 writing-mode 是否竖排

    // 一次性能力检测：CSS Ruby Annotation Layout Module 全家桶
    const f = this._flags();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `CSS ${c(f.css)}`, `supports ${c(f.supports)}`,
      `ruby-position ${c(f.rubyPosition)}`,
      `ruby-align ${c(f.rubyAlign)}`,
      `ruby-merge ${c(f.rubyMerge)}`,
      `ruby-overhang ${c(f.rubyOverhang)}`,
      `display:ruby ${c(f.displayRuby)}`,
      `display:ruby-base ${c(f.displayRubyBase)}`,
      `display:ruby-text ${c(f.displayRubyText)}`,
    ];

    const summary = f.css
      ? `CSS Ruby 注音排版特性能力检测：${parts.join(' · ')}。jsdom 不做真实 CSS 渲染，CSS.supports 通常可用；ruby-* 系列属性浏览器采纳差异较大（ruby-position / ruby-align 主流浏览器支持；ruby-merge / ruby-overhang 仍实验性；<rb>/<rtc> 草案元素），按钮将注入演示样式并展示完整代码示例；真实浏览器可查看注音排版效果。`
      : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。';

    this.setState({ capsSummary: summary });
    this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.rubyPosition) this._addLog('warn', 'ruby-position 不可用或 jsdom 未识别（CSS Ruby Module；Chrome/Firefox 支持，Safari 旧版需 -webkit- 前缀）');
    if (!f.rubyAlign) this._addLog('warn', 'ruby-align 不可用或 jsdom 未识别（start/center/space-between/space-around）');
    if (!f.rubyMerge) this._addLog('warn', 'ruby-merge 不可用或 jsdom 未识别（separate/collapse/auto，复合注音关键属性，仍实验性）');
    if (!f.rubyOverhang) this._addLog('warn', 'ruby-overhang 不可用或 jsdom 未识别（注音悬挂到相邻字符，仍实验性）');
    if (!f.displayRuby) this._addLog('warn', 'display: ruby 不可用或 jsdom 未识别（<ruby> 内部 display 值）');

    // 一次性注入全部演示样式（仅一次；rerender 不会移除 head 中的 style）
    this._injectDemoStyles();
  }

  componentWillUnmount() {
    // 移除动态创建的 <style> 元素，便于 GC
    for (const style of this._dynamicStyles) {
      try { style.parentNode && style.parentNode.removeChild(style); } catch { /* noop */ }
    }
    this._dynamicStyles = [];
  }

  // —— 日志 / 按钮辅助 ——

  _addLog(type, content) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // 返回 Tag 数组：items = [[label, ok], ...]，展示能力状态（✓/✗）
  _caps(items) {
    return items.map(([label, ok]) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  // 返回布尔能力对象（供 capsSummary / 按钮 disabled 使用）
  _flags() {
    const hasCSS = typeof CSS !== 'undefined';
    const supportsPV = (p, v) => {
      try { return hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v); }
      catch { return false; }
    };
    return {
      css: hasCSS,
      supports: hasCSS && typeof CSS.supports === 'function',
      // Card 2/3/4/5
      rubyPosition: supportsPV('ruby-position', 'over') || supportsPV('ruby-position', 'under'),
      rubyAlign: supportsPV('ruby-align', 'center'),
      rubyMerge: supportsPV('ruby-merge', 'separate') || supportsPV('ruby-merge', 'collapse'),
      rubyOverhang: supportsPV('ruby-overhang', 'auto') || supportsPV('ruby-overhang', 'none'),
      // 内部 display 值（<ruby>/<rb>/<rt>/<rtc>）
      displayRuby: supportsPV('display', 'ruby'),
      displayRubyBase: supportsPV('display', 'ruby-base'),
      displayRubyText: supportsPV('display', 'ruby-text'),
    };
  }

  // —— 注入一个 <style>，跟踪到 this._dynamicStyles ——
  _injectStyle(id, css) {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
    this._dynamicStyles.push(style);
  }

  // —— 动态注入所有演示样式 ——
  _injectDemoStyles() {
    this._injectStyle('css-ruby-demo', `
      /* ===== Card 1: ruby HTML 元素语义 ===== */
      .ruby-stage { padding: 8px 12px; border-left: 3px solid var(--color-border, #ccc);
        background: var(--color-bg-spotlight, #f5f5f5); border-radius: 4px; margin-top: 8px;
        font-size: 22px; line-height: 2.4; }
      .ruby-stage rt { font-size: 12px; color: var(--color-primary, #1677ff); }
      .ruby-stage rb { display: ruby-base; }
      /* ===== Card 2: ruby-position ===== */
      .ruby-pos-demo { ruby-position: over; -webkit-ruby-position: before; }
      /* ===== Card 3: ruby-align ===== */
      .ruby-align-demo { ruby-align: center; }
      /* ===== Card 4: ruby-merge / ruby-overhang ===== */
      .ruby-merge-demo { ruby-merge: separate; }
      .ruby-merge-collapse { ruby-merge: collapse; }
      .ruby-overhang-demo { ruby-overhang: auto; }
      /* ===== Card 5: 双层注音 ===== */
      .ruby-double { line-height: 2.6; }
      .ruby-double rtc:first-of-type { ruby-position: over; color: var(--color-primary, #1677ff); font-size: 11px; }
      .ruby-double rtc:last-of-type { ruby-position: under; color: var(--color-success, #10b981); font-size: 11px; }
      .ruby-double rt { font-size: 12px; color: var(--color-primary, #1677ff); }
      /* ===== Card 6: CJK 排版协同 ===== */
      .ruby-cjk { font-size: 22px; line-height: 2.6; letter-spacing: 0.05em; }
      .ruby-cjk rt { font-size: 11px; letter-spacing: 0; color: var(--color-primary, #1677ff); }
      /* ===== Card 7: 字典卡片 ===== */
      .dict-card { padding: 16px; border: 1px solid var(--color-border, #ccc);
        border-radius: 8px; background: var(--color-bg-spotlight, #fafafa); margin-top: 8px; }
      .dict-card .word { font-size: 36px; font-weight: 700; }
      .dict-card .word rt { font-size: 12px; color: var(--color-primary, #1677ff); }
      .dict-card .meta { font-size: 13px; color: var(--color-text-secondary, #888); margin-top: 4px; }
      .dict-vertical { writing-mode: horizontal-tb; text-orientation: mixed;
        padding: 8px; border: 1px dashed var(--color-border, #ccc); border-radius: 4px;
        margin-top: 8px; font-size: 20px; line-height: 2.4; background: var(--color-bg-spotlight, #f5f5f5);
        ruby-position: over; -webkit-ruby-position: before; }
      .dict-vertical rt { font-size: 11px; color: var(--color-primary, #1677ff); }
      /* ===== Card 8: 可访问性与降级 ===== */
      .a11y-ruby { font-size: 22px; line-height: 2.4; }
      .a11y-ruby rt { font-size: 12px; color: var(--color-primary, #1677ff); }
      .a11y-ruby rp { color: var(--color-text-tertiary, #aaa); }
      .a11y-ruby rb { display: ruby-base; }
    `);
  }

  // =================== Card 1：ruby HTML 元素语义 ===================

  _readRubySemanticInfo() {
    const f = this._flags();
    try {
      const stage = this.el && this.el.querySelector('.ruby-stage');
      let rtDisplay = '(未渲染)';
      if (stage) {
        const rt = stage.querySelector('rt');
        if (rt) rtDisplay = window.getComputedStyle(rt).getPropertyValue('display') || '(空)';
      }
      return `ruby HTML 元素语义演示：\n` +
        `  <ruby> 内部 <rt> 的 display 计算值="${rtDisplay}"\n` +
        `  CSS.supports('display','ruby') = ${f.displayRuby}\n` +
        `  CSS.supports('display','ruby-base') = ${f.displayRubyBase}\n` +
        `  CSS.supports('display','ruby-text') = ${f.displayRubyText}\n\n` +
        '说明：\n' +
        '  <ruby>  —— 注音容器（display: ruby），包裹汉字与注音\n' +
        '  <rb>    —— ruby base，注音的「基底」（一个汉字）；草案元素，可省略\n' +
        '  <rt>    —— ruby text，注音本身（display: ruby-text）；拼音/振假名/谚文注音\n' +
        '  <rp>    —— ruby parenthesis，<ruby> 不支持时的「回退括号」（默认 display: none）\n' +
        '  <rtc>   —— ruby text container，双层注音的第二层容器（草案）\n\n' +
        '浏览器 UA 默认样式（HTML 规范）：\n' +
        '  ruby  { display: ruby; text-indent: 0; }\n' +
        '  rb    { display: ruby-base; unicode-bidi: isolate; }\n' +
        '  rt    { display: ruby-text; unicode-bidi: isolate; font-size: 50%; }\n' +
        '  rp    { display: none; }   /* 支持时隐藏，不支持时显示括号 */\n' +
        '  rtc   { display: ruby-text-container; }\n\n' +
        '单注音（每字一音）：\n' +
        '  <ruby>漢<rt>かん</rt>字<rt>じ</rt></ruby>\n' +
        '  <ruby>东<rt>dōng</rt>京<rt>jīng</rt></ruby>\n\n' +
        '复合注音（多字共享一注音，配合 ruby-merge: collapse）：\n' +
        '  <ruby style="ruby-merge: collapse;"><rb>今日</rb><rt>kyō</rt></ruby>\n\n' +
        '双层注音（<rtc> 草案元素）：\n' +
        '  <ruby>\n' +
        '    <rb>東京</rb>\n' +
        '    <rtc><rt>Tōkyō</rt></rtc>\n' +
        '    <rtc><rt>とうきょう</rt></rtc>\n' +
        '  </ruby>\n\n' +
        '<rp> 回退括号（旧浏览器不支持 <ruby> 时显示）：\n' +
        '  <ruby>漢<rp>（</rp><rt>かん</rt><rp>）</rp>字<rp>（</rp><rt>じ</rt><rp>）</rp></ruby>\n' +
        '  支持的浏览器：显示「漢(かん)字(じ)」（<rp> 隐藏，注音在上方）\n' +
        '  不支持的浏览器：显示「漢（かん）字（じ）」（<rp> 显示括号，注音作为正文）';
    } catch (err) {
      return `读取 ruby 元素语义信息失败：${err.name} - ${err.message}`;
    }
  }

  _runRubySemanticDemo() {
    this.setState({ rubySemanticInfo: this._readRubySemanticInfo() });
    const f = this._flags();
    this._addLog('ruby', `ruby 元素语义演示：display:ruby=${f.displayRuby}, display:ruby-text=${f.displayRubyText}`);
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. ruby HTML 元素语义 —— <ruby>/<rb>/<rt>/<rp>/<rtc>',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['display:ruby', f.displayRuby], ['display:ruby-base', f.displayRubyBase], ['display:ruby-text', f.displayRubyText]]),
        h(Tag, { color: 'primary' }, 'HTML Ruby'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '<ruby> 是注音容器（display: ruby），<rt> 是注音（display: ruby-text，默认 font-size 50%），<rb> 是基底（草案），<rp> 是不支持 <ruby> 时的回退括号（默认 display: none），<rtc> 是双层注音的第二层容器（草案）。HTML 规范定义了完整的 UA 默认样式：ruby/ruby-base/ruby-text/ruby-text-container 四个内部 display 值。单注音每字一音；双注音用 <rtc> 嵌套两层；复合注音用 <rb> 包多字 + ruby-merge: collapse。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取语义信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runRubySemanticDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '单注音（拼音 / 振假名，每字一音）：'),
        h('div', { class: 'ruby-stage' },
          h('ruby', {}, '东', h('rt', {}, 'dōng'), '京', h('rt', {}, 'jīng'), ' · ',
            h('ruby', {}, '漢', h('rt', {}, 'かん'), '字', h('rt', {}, 'じ'))),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '复合注音（<rb>多字 + 整词注音，配合 ruby-merge: collapse）：'),
        h('div', { class: 'ruby-stage ruby-merge-collapse' },
          h('ruby', {}, h('rb', {}, '今日'), h('rt', {}, 'kyō'), ' · ',
            h('rb', {}, '明日'), h('rt', {}, 'asu')),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '<rp> 回退括号（不支持 <ruby> 时显示「漢（かん）字（じ）」）：'),
        h('div', { class: 'ruby-stage' },
          h('ruby', {}, '漢', h('rp', {}, '（'), h('rt', {}, 'かん'), h('rp', {}, '）'),
            '字', h('rp', {}, '（'), h('rt', {}, 'じ'), h('rp', {}, '）')),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '360px', overflow: 'auto' } },
          h('code', {}, s.rubySemanticInfo || '（点击「读取语义信息」查看 ruby 元素语义与 UA 默认样式）')),
        h(Alert, {
          type: 'info',
          message: '<rp> 是 Ruby 的优雅降级方案',
          description: '支持的浏览器隐藏 <rp>（display: none）只显示注音；不支持的浏览器显示 <rp> 括号使注音作为正文括号注释（如「漢（かん）字（じ）」），不影响阅读。<rb> 与 <rtc> 仍是草案元素，Chrome/Firefox 部分支持，Safari 支持较好。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：ruby-position ===================

  _readRubyPositionInfo() {
    const f = this._flags();
    try {
      const stage = this.el && this.el.querySelector('.ruby-pos-demo');
      let pos = '(未渲染)';
      if (stage) {
        pos = window.getComputedStyle(stage).getPropertyValue('ruby-position') || '(空)';
      }
      return `ruby-position 演示：\n` +
        `  .ruby-pos-demo { ruby-position: ${this._rubyPosition}; }\n` +
        `  ruby-position 计算值="${pos}"\n` +
        `  CSS.supports('ruby-position','over') = ${f.rubyPosition}\n\n` +
        '说明：\n' +
        '  ruby-position: over | under | inter-character | alternate\n' +
        '    over             —— 注音位于主文「上方」（horizontal-tb 默认值）\n' +
        '    under            —— 注音位于主文「下方」（适合副标读音，中文教育常见）\n' +
        '    inter-character  —— 注音位于字符之间（繁体中文注音 ㄅㄆㄇㄈ 专用，注音置于字符右侧）\n' +
        '    alternate        —— 双层注音时交替（over 与 under 交替，草案）\n\n' +
        '与 writing-mode 协同：\n' +
        '  horizontal-tb（默认水平）：over=上方，under=下方\n' +
        '  vertical-rl（竖排从右到左）：over=「右」侧，under=「左」侧（注音位于竖排汉字的右/左）\n' +
        '  vertical-lr（竖排从左到右）：over=左侧，under=右侧\n\n' +
        '浏览器差异：\n' +
        '  Chrome / Firefox / Edge：ruby-position over/under 支持（Chrome 38+），inter-character 较新\n' +
        '  Safari：早期仅支持 -webkit-ruby-position: before|after（before≈over, after≈under）\n' +
        '  生产建议：同时写 -webkit-ruby-position: before 兼容旧 Safari\n\n' +
        'CSS 代码示例：\n' +
        '  .pinyin-top    { ruby-position: over;  -webkit-ruby-position: before; }\n' +
        '  .pinyin-bottom { ruby-position: under; -webkit-ruby-position: after;  }\n' +
        '  .bopomofo      { ruby-position: inter-character; }   /* 繁体注音 ㄅㄆㄇㄈ */\n' +
        '  .vertical-rl .ruby-top { writing-mode: vertical-rl; ruby-position: over; }';
    } catch (err) {
      return `读取 ruby-position 信息失败：${err.name} - ${err.message}`;
    }
  }

  _setRubyPosition(mode) {
    this._rubyPosition = mode;
    const webkitMap = { over: 'before', under: 'after', 'inter-character': 'before' };
    this._injectStyle('css-ruby-position-demo',
      `.ruby-pos-demo { ruby-position: ${mode}; -webkit-ruby-position: ${webkitMap[mode] || 'before'}; }`);
    this.setState({ rubyPositionInfo: this._readRubyPositionInfo() });
    const desc = { over: '注音在主文上方', under: '注音在主文下方', 'inter-character': '注音在字符之间（注音符号专用）' }[mode];
    this._addLog('pos', `切换 ruby-position → ${mode}（${desc}）`);
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. ruby-position —— 注音位置（over/under/inter-character）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['ruby-position', f.rubyPosition]]),
        h(Tag, { color: 'primary' }, '与 writing-mode 协同'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'ruby-position 控制注音相对主文的位置：over（默认，水平时注音在上方）、under（注音在下方，中文教育常见，用于副标读音）、inter-character（注音在字符之间，繁体中文注音 ㄅㄆㄇㄈ 专用）。与 writing-mode 协同：竖排（vertical-rl）时 over 对应「右侧」。Safari 早期仅支持 -webkit-ruby-position: before|after（before≈over, after≈under），生产建议同时写前缀。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ rubyPositionInfo: this._readRubyPositionInfo() }) }),
          this._btn('over（上方）', { size: 'sm', disabled: !f.rubyPosition, onClick: () => this._setRubyPosition('over') }),
          this._btn('under（下方）', { size: 'sm', disabled: !f.rubyPosition, onClick: () => this._setRubyPosition('under') }),
          this._btn('inter-character', { size: 'sm', disabled: !f.rubyPosition, onClick: () => this._setRubyPosition('inter-character') }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '注音位置演示（当前 ruby-position = ' + this._rubyPosition + '）：'),
        h('div', { class: 'ruby-stage ruby-pos-demo' },
          h('ruby', {}, '汉', h('rt', {}, 'hàn'), '语', h('rt', {}, 'yǔ'), '拼', h('rt', {}, 'pīn'), '音', h('rt', {}, 'yīn')),
        ),
        h('p', { class: 'fs-sm text-tertiary mt-sm' },
          '真实浏览器中切换可看到注音从上方移到下方；inter-character 主要用于繁体注音符号（如「ㄅㄆㄇㄈ」），将注音置于字符右侧。'),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, s.rubyPositionInfo || '（点击按钮切换 ruby-position）')),
        h(Alert, {
          type: 'info',
          message: 'Safari 旧版需 -webkit-ruby-position: before|after',
          description: 'before ≈ over（上方），after ≈ under（下方）。inter-character 与 alternate 仍是较新值（Chrome/Firefox 较新版本完整支持），生产环境建议同时写前缀兼容旧 Safari。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：ruby-align ===================

  _readRubyAlignInfo() {
    const f = this._flags();
    try {
      const stage = this.el && this.el.querySelector('.ruby-align-demo');
      let align = '(未渲染)';
      if (stage) {
        align = window.getComputedStyle(stage).getPropertyValue('ruby-align') || '(空)';
      }
      return `ruby-align 演示：\n` +
        `  .ruby-align-demo { ruby-align: ${this._rubyAlign}; }\n` +
        `  ruby-align 计算值="${align}"\n` +
        `  CSS.supports('ruby-align','center') = ${f.rubyAlign}\n\n` +
        '说明：\n' +
        '  ruby-align: start | center | space-between | space-around\n' +
        '    start         —— 注音与主文「起始」对齐（左对齐，适合日语，注音紧贴汉字左侧）\n' +
        '    center        —— 注音在主文「上方居中」（默认值，注音相对汉字水平居中）\n' +
        '    space-between —— 注音在主文区「两端对齐」（首尾对齐，中间均分，注音较长时铺满）\n' +
        '    space-around  —— 注音在主文区「分散对齐」（每字两侧等距空白，类似 text-align: justify）\n\n' +
        '双值语法（草案，CSS Ruby L1）：ruby-align: <basic> <ruby-text>\n' +
        '  ruby-align: start end;                  —— 基础区 start 对齐，注音区 end 对齐\n' +
        '  ruby-align: center space-between;       —— 分别控制基础与注音\n\n' +
        '与 text-align 区别：\n' +
        '  text-align 控制行内整体对齐；ruby-align 控制注音相对基底（<rb>）的对齐\n' +
        '  注音短于汉字时：center 居中；start 起始对齐；注音长于汉字时：space-* 分布\n\n' +
        'CSS 代码示例：\n' +
        '  /* 注音居中（默认，最常用）*/\n' +
        '  .pinyin { ruby-align: center; }\n' +
        '  /* 注音起始对齐（日语振假名习惯）*/\n' +
        '  .furigana { ruby-align: start; }\n' +
        '  /* 注音两端对齐（长注音铺满）*/\n' +
        '  .spread { ruby-align: space-between; }\n' +
        '  /* 注音分散对齐 */\n' +
        '  .justify { ruby-align: space-around; }';
    } catch (err) {
      return `读取 ruby-align 信息失败：${err.name} - ${err.message}`;
    }
  }

  _setRubyAlign(mode) {
    this._rubyAlign = mode;
    this._injectStyle('css-ruby-align-demo', `.ruby-align-demo { ruby-align: ${mode}; }`);
    this.setState({ rubyAlignInfo: this._readRubyAlignInfo() });
    const desc = { start: '起始对齐（左对齐）', center: '居中对齐（默认）', 'space-between': '两端对齐', 'space-around': '分散对齐' }[mode];
    this._addLog('align', `切换 ruby-align → ${mode}（${desc}）`);
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. ruby-align —— 注音对齐（start/center/space-between/space-around）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['ruby-align', f.rubyAlign]]),
        h(Tag, { color: 'primary' }, '注音相对基底对齐'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'ruby-align 控制注音相对基底（<rb>）的对齐：start（起始对齐，左对齐，日语振假名习惯）、center（居中，默认）、space-between（两端对齐，首尾对齐中间均分）、space-around（分散对齐，每字两侧等距空白）。草案双值语法 ruby-align: <basic> <ruby-text> 分别控制基础与注音区对齐。与 text-align 区别：text-align 控制行内整体，ruby-align 控制注音相对基底。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ rubyAlignInfo: this._readRubyAlignInfo() }) }),
          this._btn('start', { size: 'sm', disabled: !f.rubyAlign, onClick: () => this._setRubyAlign('start') }),
          this._btn('center', { size: 'sm', disabled: !f.rubyAlign, onClick: () => this._setRubyAlign('center') }),
          this._btn('space-between', { size: 'sm', disabled: !f.rubyAlign, onClick: () => this._setRubyAlign('space-between') }),
          this._btn('space-around', { size: 'sm', disabled: !f.rubyAlign, onClick: () => this._setRubyAlign('space-around') }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '注音对齐演示（当前 ruby-align = ' + this._rubyAlign + '；注音较短时差异细微）：'),
        h('div', { class: 'ruby-stage ruby-align-demo' },
          h('ruby', {}, h('rb', {}, '东'), h('rt', {}, 'dōng'),
            h('rb', {}, '京'), h('rt', {}, 'jīng'),
            h('rb', {}, '塔'), h('rt', {}, 'tǎ')),
        ),
        h('p', { class: 'fs-sm text-tertiary mt-sm' },
          '注音短于汉字时：center 居中、start 起始；注音长于汉字时：space-between 两端对齐、space-around 分散。真实浏览器可看到注音相对汉字的对齐变化。'),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, s.rubyAlignInfo || '（点击按钮切换 ruby-align）')),
        h(Alert, {
          type: 'info',
          message: 'center 是默认值；space-between/space-around 在长注音时效果明显',
          description: '短注音（如「东(dōng)」）各值差异小；长注音配多字基底时 space-between 首尾对齐、space-around 分散。草案双值语法 ruby-align: start end 分别控制基底与注音区对齐，浏览器采纳尚不完整。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：ruby-merge + ruby-overhang ===================

  _readRubyMergeInfo() {
    const f = this._flags();
    try {
      const mergeStage = this.el && this.el.querySelector('.ruby-merge-demo');
      const overhangStage = this.el && this.el.querySelector('.ruby-overhang-demo');
      const readComp = (el, prop) => {
        if (!el) return '(未渲染)';
        return window.getComputedStyle(el).getPropertyValue(prop) || '(空)';
      };
      return `ruby-merge 与 ruby-overhang 演示：\n` +
        `  .ruby-merge-demo { ruby-merge: ${this._rubyMerge}; }\n` +
        `    ruby-merge 计算值="${readComp(mergeStage, 'ruby-merge')}"\n` +
        `  .ruby-overhang-demo { ruby-overhang: ${this._overhang}; }\n` +
        `    ruby-overhang 计算值="${readComp(overhangStage, 'ruby-overhang')}"\n` +
        `  CSS.supports('ruby-merge','collapse') = ${f.rubyMerge}\n` +
        `  CSS.supports('ruby-overhang','auto') = ${f.rubyOverhang}\n\n` +
        '说明：\n' +
        '  ruby-merge: separate | collapse | auto —— 复合注音（多字共享一注音）的合并方式\n' +
        '    separate（默认）—— 每个 <rb> 独立对齐其 <rt>（一对一对齐，注音不跨字）\n' +
        '    collapse        —— 多个 <rb> 合并为一个基底，注音跨整个合并区域（如「今日」配「kyō」整体居中）\n' +
        '    auto            —— 浏览器自动决定（CJK 字符 collapse，拉丁字符 separate）\n\n' +
        '  ruby-overhang: auto | none —— 注音是否「悬挂」到相邻字符（超出基底宽度时）\n' +
        '    auto（默认）—— 注音超出基底宽度时悬挂到相邻字符上方（不影响行高）\n' +
        '    none          —— 注音不悬挂，限制在基底宽度内（可能挤压注音）\n\n' +
        'CSS 代码示例：\n' +
        '  /* 复合注音：多字共享一注音 */\n' +
        '  .word-reading { ruby-merge: collapse; }\n' +
        '  <ruby style="ruby-merge: collapse;"><rb>今日</rb><rt>kyō</rt></ruby>\n' +
        '  /* 注音不悬挂到相邻字符（精确版式）*/\n' +
        '  .no-overhang { ruby-overhang: none; }\n' +
        '  /* 自动：CJK 字符合并，拉丁字符独立 */\n' +
        '  .auto-merge { ruby-merge: auto; }\n\n' +
        '使用场景：\n' +
        '  ruby-merge: collapse —— 日语「熟字訓」（如「今日=kyō」「大人=otona」），整词配整注音\n' +
        '  ruby-overhang: none  —— 精确排版（教育课本），避免注音悬挂到相邻字符造成混淆';
    } catch (err) {
      return `读取 ruby-merge 信息失败：${err.name} - ${err.message}`;
    }
  }

  _setRubyMerge(mode) {
    this._rubyMerge = mode;
    this._injectStyle('css-ruby-merge-demo', `.ruby-merge-demo { ruby-merge: ${mode}; }`);
    this.setState({ rubyMergeInfo: this._readRubyMergeInfo() });
    const desc = { separate: '每字独立对齐（默认）', collapse: '多字合并为一基底', auto: 'CJK 合并 / 拉丁独立' }[mode];
    this._addLog('merge', `切换 ruby-merge → ${mode}（${desc}）`);
  }

  _setOverhang(mode) {
    this._overhang = mode;
    this._injectStyle('css-ruby-overhang-demo', `.ruby-overhang-demo { ruby-overhang: ${mode}; }`);
    this.setState({ rubyMergeInfo: this._readRubyMergeInfo() });
    const desc = { auto: '注音悬挂到相邻字符（默认）', none: '注音不悬挂（限制在基底内）' }[mode];
    this._addLog('overhang', `切换 ruby-overhang → ${mode}（${desc}）`);
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. ruby-merge + ruby-overhang —— 复合注音与注音悬挂',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['ruby-merge', f.rubyMerge], ['ruby-overhang', f.rubyOverhang]]),
        h(Tag, { color: 'primary' }, '复合注音关键'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'ruby-merge 控制复合注音（多字共享一注音）的合并方式：separate（默认，每字独立对齐）、collapse（多字合并为一基底，注音跨整个区域，适合日语熟字訓如「今日=kyō」）、auto（CJK 合并/拉丁独立）。ruby-overhang 控制注音是否悬挂到相邻字符：auto（默认，超出基底宽度时悬挂，不影响行高）、none（不悬挂，限制在基底内，适合精确教育排版）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ rubyMergeInfo: this._readRubyMergeInfo() }) }),
          this._btn('merge: separate', { size: 'sm', disabled: !f.rubyMerge, onClick: () => this._setRubyMerge('separate') }),
          this._btn('merge: collapse', { size: 'sm', disabled: !f.rubyMerge, onClick: () => this._setRubyMerge('collapse') }),
          this._btn('merge: auto', { size: 'sm', disabled: !f.rubyMerge, onClick: () => this._setRubyMerge('auto') }),
          this._btn('overhang: auto', { size: 'sm', disabled: !f.rubyOverhang, onClick: () => this._setOverhang('auto') }),
          this._btn('overhang: none', { size: 'sm', disabled: !f.rubyOverhang, onClick: () => this._setOverhang('none') }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '复合注音演示（ruby-merge = ' + this._rubyMerge + '；多字配整词读音）：'),
        h('div', { class: 'ruby-stage ruby-merge-demo' },
          h('ruby', {}, h('rb', {}, '今日'), h('rt', {}, 'kyō'), ' · ',
            h('rb', {}, '大人'), h('rt', {}, 'otona'), ' · ',
            h('rb', {}, '土産'), h('rt', {}, 'miyage')),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '注音悬挂演示（ruby-overhang = ' + this._overhang + '；注音长于基底时差异明显）：'),
        h('div', { class: 'ruby-stage ruby-overhang-demo' },
          h('ruby', {}, '漢', h('rt', {}, 'kanji-ruby-long'), '字', h('rt', {}, 'ji'), '排', h('rt', {}, 'pái'), '版', h('rt', {}, 'bǎn')),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '340px', overflow: 'auto' } },
          h('code', {}, s.rubyMergeInfo || '（点击按钮切换 ruby-merge / ruby-overhang）')),
        h(Alert, {
          type: 'warning',
          message: 'ruby-merge 与 ruby-overhang 仍是较新/实验性特性',
          description: 'ruby-merge: collapse 适合日语「熟字訓」（整词配整注音）；ruby-overhang: none 适合教育课本精确排版。Chrome/Firefox 较新版本支持，Safari 部分支持。生产环境建议测试目标浏览器，必要时用 JS 重组 <rb>/<rt> 结构兜底。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：双层注音 ===================

  _readDoubleRubyInfo() {
    const f = this._flags();
    try {
      return `双层注音演示：\n` +
        `  CSS.supports('display','ruby-text') ≈ ${f.displayRubyText}\n` +
        `  ruby-position 支持 = ${f.rubyPosition}\n\n` +
        '说明：\n' +
        '  双层注音（complex ruby）：一个基底配两层注音，常见组合：\n' +
        '    1. 拼音 + 注音（汉字上方拼音，下方注音 ㄅㄆㄇㄈ）\n' +
        '    2. 汉字 + 罗马字（日语：上方振假名，下方罗马字）\n' +
        '    3. 汉字 + 韩文谚文注音（汉字 + 한글 발음）\n\n' +
        '结构：<rtc> 包裹第二层注音（草案元素），配合 ruby-position: over/under：\n' +
        '  <ruby>\n' +
        '    <rb>東</rb><rb>京</rb>\n' +
        '    <rtc ruby-position="over"><rt>Tōkyō</rt></rtc>      <!-- 第一层：罗马字 -->\n' +
        '    <rtc ruby-position="under"><rt>とうきょう</rt></rtc>  <!-- 第二层：振假名 -->\n' +
        '  </ruby>\n\n' +
        '  <rb> 是 ruby base 元素（草案），显式标注基底；不写时浏览器按文本节点拆分\n' +
        '  <rtc> 是 ruby text container（草案），包裹一层 <rt>，可用 ruby-position 属性分别指定位置\n\n' +
        '替代方案（无 <rtc> 时，用嵌套 <ruby>，兼容性更好但语义较弱）：\n' +
        '  <ruby>\n' +
        '    <ruby>東<rt>Tōkyō</rt></ruby>\n' +
        '    <rt>とうきょう</rt>\n' +
        '  </ruby>\n' +
        '  —— 内层 <ruby> 是第一层注音，外层 <rt> 是第二层\n\n' +
        'CSS 代码示例：\n' +
        '  ruby rtc:first-of-type { ruby-position: over;  color: #1677ff; font-size: 11px; }\n' +
        '  ruby rtc:last-of-type  { ruby-position: under; color: #10b981; font-size: 11px; }\n' +
        '  ruby rb { ruby-position: center; }\n\n' +
        '浏览器支持：\n' +
        '  <rb>/<rtc> 仍是草案元素，Chrome/Firefox 部分支持，Safari 支持较好\n' +
        '  生产可用：嵌套 <ruby> 方案兼容性最广，<rtc> 方案语义最规范';
    } catch (err) {
      return `读取双层注音信息失败：${err.name} - ${err.message}`;
    }
  }

  _runDoubleRubyDemo() {
    this.setState({ doubleRubyInfo: this._readDoubleRubyInfo() });
    this._addLog('double', `双层注音演示：ruby-position=${this._flags().rubyPosition}, display:ruby-text=${this._flags().displayRubyText}`);
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. 双层注音 —— <rtc>/<rb> 嵌套结构（拼音+注音、汉字+罗马字）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['ruby-position', f.rubyPosition], ['display:ruby-text', f.displayRubyText]]),
        h(Tag, { color: 'primary' }, 'complex-ruby'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '双层注音（complex ruby）让一个基底配两层注音：拼音+注音（汉字上方拼音、下方注音 ㄅㄆㄇㄈ）、汉字+罗马字（日语：上方振假名、下方罗马字）、汉字+韩文谚文。结构用 <rtc>（草案）包裹第二层 <rt>，配合 ruby-position: over/under 分别指定位置。<rb>（草案）显式标注基底。兼容性更广的替代方案是嵌套 <ruby>（内层第一层、外层 <rt> 第二层）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取双层注音信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runDoubleRubyDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '<rtc> 双层结构（汉字 + 罗马字 + 振假名）：'),
        h('div', { class: 'ruby-stage ruby-double' },
          h('ruby', {},
            h('rb', {}, '東'), h('rb', {}, '京'),
            h('rtc', {}, h('rt', {}, 'Tōkyō')),
            h('rtc', {}, h('rt', {}, 'とうきょう'))),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '嵌套 <ruby> 替代方案（兼容性更广；内层拼音 + 外层罗马字）：'),
        h('div', { class: 'ruby-stage ruby-double' },
          h('ruby', {},
            h('ruby', {}, '東', h('rt', {}, 'dōng'), '京', h('rt', {}, 'jīng')),
            h('rt', {}, 'Tōkyō')),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '380px', overflow: 'auto' } },
          h('code', {}, s.doubleRubyInfo || '（点击「读取双层注音信息」查看 <rtc>/<rb> 嵌套结构）')),
        h(Alert, {
          type: 'info',
          message: '<rb>/<rtc> 是草案元素；生产可用嵌套 <ruby> 兜底',
          description: '<rb> 显式标注基底，<rtc> 包裹第二层注音；语义最规范但 Chrome/Firefox 仅部分支持。嵌套 <ruby> 方案（内层第一层、外层 <rt> 第二层）兼容性更广，但语义较弱。教育网站需双层注音时优先嵌套方案，<rtc> 方案渐进增强。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：CJK 排版协同 ===================

  _readCJKComboInfo() {
    const f = this._flags();
    try {
      const stage = this.el && this.el.querySelector('.ruby-cjk');
      let trim = '(未渲染)';
      if (stage) {
        trim = window.getComputedStyle(stage).getPropertyValue('text-spacing-trim') || '(空)';
      }
      return `CJK 排版协同演示：\n` +
        `  .ruby-cjk { text-spacing-trim: ${this._trimOn ? 'space-first trim-adjacent' : 'normal'}; line-break: ${this._trimOn ? 'strict' : 'auto'} }\n` +
        `    text-spacing-trim 计算值="${trim}"\n` +
        `  ruby-position 支持 = ${f.rubyPosition}\n\n` +
        '说明：\n' +
        '  Ruby 注音排版与 CJK 文本属性协同：\n\n' +
        '  1. text-spacing-trim —— CJK 全角标点挤压\n' +
        '     注音段落的标点（句号、逗号）应挤压（trim-start 去行首句号空白），\n' +
        '     避免注音标点顶头影响美观。注音 <rt> 内通常无标点。\n\n' +
        '  2. line-break: strict —— CJK 行尾标点严格度\n' +
        '     strict：禁止标点在行首（句号、逗号不顶头）；loose：宽松\n' +
        '     注音正文应 strict，避免标点破坏注音对齐\n\n' +
        '  3. letter-spacing —— 字间距\n' +
        '     <ruby> 整体可设字距；但 <rt> 注音通常 letter-spacing: 0（注音紧凑）\n' +
        '     正文 letter-spacing: 0.05em-0.1em（CJK 略松提升可读性）\n\n' +
        '  4. 字号比例约定（行业惯例）：\n' +
        '     正文 16px → 注音 8px（1/2）\n' +
        '     正文 20px → 注音 10px（1/2）\n' +
        '     正文 24px → 注音 8-10px（1/3 ~ 1/2.4）\n' +
        '     一般：注音 ≈ 正文 1/2 ~ 1/3；UA 默认 <rt> font-size: 50%\n' +
        '     教育课本注音略大（1/2），出版物略小（1/3）\n\n' +
        '  5. line-height —— 行高\n' +
        '     注音段落 line-height 应足够大（2.0-2.8），给注音留空间\n' +
        '     行高过小：注音与上下行正文重叠\n\n' +
        'CSS 代码示例：\n' +
        '  .pinyin-text {\n' +
        '    font-size: 22px;\n' +
        '    line-height: 2.6;        /* 给注音留空间 */\n' +
        '    letter-spacing: 0.05em;  /* CJK 略松 */\n' +
        '    text-spacing-trim: space-first trim-adjacent;  /* 标点挤压 */\n' +
        '    line-break: strict;      /* 标点不顶头 */\n' +
        '  }\n' +
        '  .pinyin-text rt {\n' +
        '    font-size: 11px;         /* 约正文 1/2 */\n' +
        '    letter-spacing: 0;       /* 注音紧凑 */\n' +
        '  }';
    } catch (err) {
      return `读取 CJK 协同信息失败：${err.name} - ${err.message}`;
    }
  }

  _toggleTrim() {
    this._trimOn = !this._trimOn;
    const trimVal = this._trimOn ? 'space-first trim-adjacent' : 'normal';
    const lbVal = this._trimOn ? 'strict' : 'auto';
    this._injectStyle('css-ruby-cjk-trim',
      `.ruby-cjk { text-spacing-trim: ${trimVal}; line-break: ${lbVal}; }`);
    this.setState({ cjkComboInfo: this._readCJKComboInfo() });
    this._addLog('cjk', `切换 text-spacing-trim → ${trimVal}（${this._trimOn ? '挤压标点 + strict 行尾' : '默认'}）`);
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. CJK 排版协同 —— text-spacing-trim / line-break / 字号比例',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['ruby-position', f.rubyPosition]]),
        h(Tag, { color: 'primary' }, '注音约正文 1/2~1/3'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Ruby 注音排版与 CJK 文本属性协同：text-spacing-trim 挤压全角标点（避免注音标点顶头）、line-break: strict 禁止标点行首、letter-spacing 控制字距（正文略松 0.05em，注音紧凑 0）、字号比例约定（注音约正文 1/2~1/3，UA 默认 <rt> font-size: 50%）、line-height 足够大（2.0-2.8）给注音留空间避免与上下行重叠。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取 CJK 协同信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ cjkComboInfo: this._readCJKComboInfo() }) }),
          this._btn(`text-spacing-trim（${this._trimOn ? '开启挤压' : '默认'}）`, { size: 'sm', onClick: () => this._toggleTrim() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '注音段落（正文 22px，注音 11px，line-height 2.6）：'),
        h('div', { class: 'ruby-cjk' },
          h('ruby', {}, '汉', h('rt', {}, 'hàn'), '语', h('rt', {}, 'yǔ'), '拼', h('rt', {}, 'pīn'), '音', h('rt', {}, 'yīn'),
            '是', h('rt', {}, 'shì'), '中', h('rt', {}, 'zhōng'), '文', h('rt', {}, 'wén'), '排', h('rt', {}, 'pái'), '版', h('rt', {}, 'bǎn'),
            '的', h('rt', {}, 'de'), '重', h('rt', {}, 'zhòng'), '要', h('rt', {}, 'yào'), '组', h('rt', {}, 'zǔ'), '成', h('rt', {}, 'chéng'),
            '部', h('rt', {}, 'bù'), '分', h('rt', {}, 'fēn'), '。', h('rt', {}, '。')),
        ),
        h('p', { class: 'fs-sm text-tertiary mt-sm' },
          '正文 22px，注音 11px（约 1/2），line-height 2.6 给注音留空间。开启 text-spacing-trim 后句号不再顶头。'),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '380px', overflow: 'auto' } },
          h('code', {}, s.cjkComboInfo || '（点击按钮查看 CJK 排版协同完整说明）')),
        h(Alert, {
          type: 'info',
          message: '注音 ≈ 正文 1/2~1/3；line-height ≥ 2.0 避免注音重叠',
          description: '行业惯例：教育课本注音略大（1/2），出版物略小（1/3）。line-height 过小会导致注音与上下行正文重叠。text-spacing-trim 与 line-break: strict 是 CJK 标点排版关键，但浏览器采纳缓慢（Chrome 128+ 部分支持 text-spacing-trim）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 7：实战：字典卡片 ===================

  _readDictCardInfo() {
    const f = this._flags();
    try {
      const vertical = this.el && this.el.querySelector('.dict-vertical');
      let wm = '(未渲染)';
      if (vertical) {
        wm = window.getComputedStyle(vertical).getPropertyValue('writing-mode') || '(空)';
      }
      return `实战：字典卡片演示：\n` +
        `  .dict-vertical { writing-mode: ${this._verticalMode ? 'vertical-rl' : 'horizontal-tb'}; ruby-position: over; }\n` +
        `    writing-mode 计算值="${wm}"\n` +
        `  ruby-position 支持 = ${f.rubyPosition}\n\n` +
        '说明：\n' +
        '  教育网站字典卡片：汉字 + 拼音 + 五笔 + 部首 + 释义\n' +
        '  结构：\n' +
        '    <div class="dict-card">\n' +
        '      <div class="word"><ruby>汉<rt>hàn</rt></ruby></div>\n' +
        '      <div class="meta">部首：氵 · 五笔：IC · 笔画：5</div>\n' +
        '      <div class="meaning">1. 汉族；2. 男子；3. 银河（星汉）</div>\n' +
        '    </div>\n\n' +
        '  Ruby 与垂直排版协同：\n' +
        '    writing-mode: vertical-rl + ruby-position: over\n' +
        '    竖排时 over 对应「右侧」（注音在竖排汉字右侧）\n' +
        '    适合中文古籍、书法、传统日文排版\n\n' +
        'CSS 代码示例：\n' +
        '  .dict-card {\n' +
        '    padding: 16px; border: 1px solid #ccc; border-radius: 8px;\n' +
        '    background: #fafafa;\n' +
        '  }\n' +
        '  .dict-card .word { font-size: 36px; font-weight: 700; }\n' +
        '  .dict-card .word rt { font-size: 12px; color: #1677ff; }   /* 约正文 1/3 */\n' +
        '  .dict-card .meta { font-size: 13px; color: #888; margin-top: 4px; }\n' +
        '  /* 垂直排版（古籍/书法）*/\n' +
        '  .dict-vertical {\n' +
        '    writing-mode: vertical-rl;\n' +
        '    text-orientation: mixed;\n' +
        '    ruby-position: over;   /* 竖排时 over=右侧 */\n' +
        '    max-height: 220px;\n' +
        '    font-size: 20px;\n' +
        '  }\n' +
        '  .dict-vertical rt { font-size: 11px; }\n\n' +
        '协同属性：\n' +
        '  writing-mode: vertical-rl     —— 竖排从右到左\n' +
        '  text-orientation: mixed       —— CJK 字符直立，拉丁字符旋转\n' +
        '  ruby-position: over           —— 竖排时注音在右侧\n' +
        '  font-feature-settings: "palt" —— CJK 比例字宽（可选）';
    } catch (err) {
      return `读取字典卡片信息失败：${err.name} - ${err.message}`;
    }
  }

  _toggleVertical() {
    this._verticalMode = !this._verticalMode;
    const wm = this._verticalMode ? 'vertical-rl' : 'horizontal-tb';
    this._injectStyle('css-dict-vertical',
      `.dict-vertical { writing-mode: ${wm}; -webkit-writing-mode: ${wm}; text-orientation: mixed; ruby-position: over; -webkit-ruby-position: before; max-height: ${this._verticalMode ? '220px' : 'none'}; }`);
    this.setState({ dictCardInfo: this._readDictCardInfo() });
    this._addLog('dict', `切换字典卡片 writing-mode → ${wm}（${this._verticalMode ? '竖排（注音在右）' : '横排（注音在上）'}）`);
  }

  _renderCard7() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. 实战：教育网站字典卡片（汉字+拼音+五笔）+ Ruby 垂直排版',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['ruby-position', f.rubyPosition], ['ruby-align', f.rubyAlign]]),
        h(Tag, { color: 'primary' }, 'writing-mode 协同'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '实战：教育网站字典卡片包含汉字 + 拼音 + 五笔 + 部首 + 释义。Ruby 与垂直排版协同：writing-mode: vertical-rl + ruby-position: over（竖排时 over 对应「右侧」），适合中文古籍、书法、传统日文排版。配合 text-orientation: mixed 让 CJK 字符直立、拉丁字符旋转。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取字典卡片信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this.setState({ dictCardInfo: this._readDictCardInfo() }) }),
          this._btn(`writing-mode（${this._verticalMode ? 'vertical-rl 竖排' : 'horizontal-tb 横排'}）`, { size: 'sm', onClick: () => this._toggleVertical() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '字典卡片（汉字 + 拼音 + 五笔 + 部首 + 释义）：'),
        h('div', { class: 'dict-card' },
          h('div', { class: 'word' },
            h('ruby', {}, '汉', h('rt', {}, 'hàn'))),
          h('div', { class: 'meta' }, '部首：氵 · 五笔：IC · 笔画：5 · 注音：ㄏㄢˋ'),
          h('div', { class: 'meta', style: { marginTop: '4px' } }, '释义：'),
          h('div', { style: { fontSize: '14px', lineHeight: '1.8' } },
            '1. 汉族，中华民族的统称；2. 男子，如「男子汉」；3. 银河，如「星汉灿烂」；4. 朝代名（汉朝）；5. 语言（汉语）。'),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'Ruby 与垂直排版（writing-mode: vertical-rl + ruby-position: over，竖排时注音在右）：'),
        h('div', { class: 'dict-vertical' },
          h('ruby', {}, '春', h('rt', {}, 'chūn'), '眠', h('rt', {}, 'mián'), '不', h('rt', {}, 'bù'), '觉', h('rt', {}, 'jué'), '晓', h('rt', {}, 'xiǎo')),
        ),
        h('p', { class: 'fs-sm text-tertiary mt-sm' },
          '竖排时 ruby-position: over 让注音位于竖排汉字「右侧」（横排时为上方）。适合古诗、古籍、书法排版。'),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '400px', overflow: 'auto' } },
          h('code', {}, s.dictCardInfo || '（点击按钮查看字典卡片完整代码与说明）')),
        h(Alert, {
          type: 'info',
          message: 'writing-mode: vertical-rl + ruby-position: over 是古籍排版标配',
          description: '横排时 over=上方（默认）；竖排时 over=右侧。text-orientation: mixed 让 CJK 字符直立、拉丁字符旋转 90°。教育网站字典卡片可同时展示拼音、五笔、部首、释义，是 Ruby 最实用的场景之一。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 8：可访问性与降级 ===================

  _readA11yFallbackInfo() {
    const f = this._flags();
    try {
      return `Ruby 可访问性与降级演示：\n` +
        `  CSS.supports('display','ruby') = ${f.displayRuby}\n` +
        `  CSS.supports('display','ruby-text') = ${f.displayRubyText}\n\n` +
        '说明：\n\n' +
        '【屏幕阅读器朗读规则】\n' +
        '  屏幕阅读器（NVDA/VoiceOver/JAWS）朗读 <ruby> 的规则因浏览器与阅读器而异：\n' +
        '    1. 默认：朗读基底（汉字），<rt> 注音可能被忽略或重复朗读\n' +
        '    2. 部分：朗读基底 + 注音（如「汉字 かんじ」），适合学习者\n' +
        '    3. aria-label：用 aria-label 显式指定朗读顺序，最可控\n\n' +
        '【<rp> 隐藏括号降级】\n' +
        '  <ruby>漢<rp>（</rp><rt>かん</rt><rp>）</rp>字<rp>（</rp><rt>じ</rt><rp>）</rp></ruby>\n' +
        '  支持的浏览器：<rp> display: none，显示「漢(かん)字(じ)」（注音在上方）\n' +
        '  不支持的浏览器：<rp> 显示括号，<rt> 作为正文，显示「漢（かん）字（じ）」\n' +
        '  → 优雅降级：旧浏览器仍可阅读，仅失去注音视觉效果\n\n' +
        '【role="ruby" 与 aria-label】\n' +
        '  <ruby> 元素隐含 role="ruby"，但部分旧屏幕阅读器不识别\n' +
        '  显式标注：\n' +
        '    <ruby role="ruby" aria-label="汉字，读音 hàn yǔ">\n' +
        '      <rb>汉</rb><rt>hàn</rt><rb>语</rb><rt>yǔ</rt>\n' +
        '    </ruby>\n' +
        '  aria-label 提供完整朗读文本，屏幕阅读器整体朗读而非逐字\n\n' +
        '【浏览器支持矩阵（截至 2025）】\n' +
        '  Chrome 38+      : <ruby>/<rt>/<rp> 支持；ruby-position over/under 支持\n' +
        '  Firefox 38+     : <ruby>/<rt>/<rp> 支持；ruby-* 属性支持较完整\n' +
        '  Safari 5.1+     : <ruby>/<rt>/<rp> 支持；早期仅 -webkit-ruby-position\n' +
        '  Edge (Chromium) : 同 Chrome\n' +
        '  <rb>/<rtc>      : 草案元素，Chrome/Firefox 部分支持，Safari 较好\n' +
        '  ruby-merge      : Chrome/Firefox 较新版本支持，Safari 部分支持\n' +
        '  ruby-overhang   : 仍实验性，采纳缓慢\n' +
        '  ruby-align      : 主流浏览器支持 start/center，space-* 较新\n\n' +
        '【降级策略】\n' +
        '  1. <rp> 括号：旧浏览器显示「漢（かん）字（じ）」，最简单优雅\n' +
        '  2. CSS @supports：渐进增强\n' +
        '     @supports (display: ruby) {\n' +
        '       .fallback-paren { display: none; }   /* 支持 ruby 时隐藏括号 */\n' +
        '     }\n' +
        '     @supports not (display: ruby) {\n' +
        '       .ruby-text { display: inline; font-size: 0.7em; color: #888; }\n' +
        '     }\n' +
        '  3. JS 检测 + polyfill：\n' +
        '     if (!CSS.supports("display", "ruby")) {\n' +
        '       // 用 JS 重组 <rt> 为括号形式\n' +
        '       document.querySelectorAll("rt").forEach(rt => {\n' +
        '         const text = rt.textContent;\n' +
        '         rt.outerHTML = "（" + text + "）";\n' +
        '       });\n' +
        '     }\n' +
        '  4. aria-label 兜底：保证屏幕阅读器朗读正确';
    } catch (err) {
      return `读取可访问性信息失败：${err.name} - ${err.message}`;
    }
  }

  _runA11yDemo() {
    this.setState({ a11yFallbackInfo: this._readA11yFallbackInfo() });
    const f = this._flags();
    this._addLog('a11y', `可访问性演示：display:ruby=${f.displayRuby}, display:ruby-text=${f.displayRubyText}`);
  }

  _renderCard8() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 可访问性与降级 —— 屏幕阅读器 / <rp> 括号 / 浏览器矩阵',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['display:ruby', f.displayRuby], ['display:ruby-text', f.displayRubyText]]),
        h(Tag, { color: 'primary' }, 'A11y & Fallback'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Ruby 可访问性：屏幕阅读器（NVDA/VoiceOver/JAWS）朗读 <ruby> 规则因浏览器而异（默认朗读基底，<rt> 可能被忽略或重复；可用 aria-label 显式指定朗读顺序）。<ruby> 元素隐含 role="ruby"，旧阅读器可用显式 role="ruby" + aria-label 兜底。<rp> 括号是优雅降级方案：支持时 display: none 隐藏，不支持时显示括号使注音作为正文。降级策略：<rp> 括号 → CSS @supports 渐进增强 → JS 检测 polyfill → aria-label 兜底。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('读取可访问性信息', { type: 'primary', size: 'sm', disabled: !f.css, onClick: () => this._runA11yDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'role="ruby" + aria-label（屏幕阅读器整体朗读「汉字，读音 hàn yǔ」）：'),
        h('div', { class: 'ruby-stage a11y-ruby' },
          h('ruby', { role: 'ruby', 'aria-label': '汉字，读音 hàn yǔ' },
            h('rb', {}, '汉'), h('rt', {}, 'hàn'),
            h('rb', {}, '语'), h('rt', {}, 'yǔ')),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '<rp> 括号降级（不支持 <ruby> 时显示「漢（かん）字（じ）」）：'),
        h('div', { class: 'ruby-stage a11y-ruby' },
          h('ruby', {},
            '漢', h('rp', {}, '（'), h('rt', {}, 'かん'), h('rp', {}, '）'),
            '字', h('rp', {}, '（'), h('rt', {}, 'じ'), h('rp', {}, '）')),
        ),
        h('pre', { class: 'code-block mt-sm', style: { maxHeight: '440px', overflow: 'auto' } },
          h('code', {}, s.a11yFallbackInfo || '（点击「读取可访问性信息」查看屏幕阅读器规则与降级策略）')),
        h(Alert, {
          type: 'success',
          message: '<rp> 是 Ruby 优雅降级方案；aria-label 保证屏幕阅读器朗读',
          description: '<rp> 括号让不支持 <ruby> 的浏览器仍可阅读（注音作为正文括号注释）。aria-label 显式指定朗读顺序，避免屏幕阅读器重复或遗漏 <rt>。@supports 与 JS polyfill 是渐进增强方案。Chrome/Firefox/Safari/Edge 均支持 <ruby>/<rt>/<rp>；<rb>/<rtc>/ruby-merge/ruby-overhang 仍是较新/实验性特性。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== 日志面板 ===================

  _renderLogPanel() {
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

  render() {
    const s = this.state;
    return h('div', { class: 'api-lab-page css-ruby-deep-page' },
      h('h2', { class: 'section-title' }, 'CSS Ruby 注音排版 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页演示 CSS Ruby Annotation Layout Module 与 HTML <ruby>/<rt>/<rp>/<rb>/<rtc> 元素：ruby-position（over/under/inter-character）、ruby-align（start/center/space-between/space-around）、ruby-merge（separate/collapse/auto）、ruby-overhang（auto/none）、双层注音（<rtc>/<rb>）、CJK 排版协同（text-spacing-trim/line-break/字号比例）、实战字典卡片（汉字+拼音+五笔+垂直排版）、可访问性与降级（屏幕阅读器/<rp> 括号/@supports）。所有特性通过 typeof / CSS.supports 能力检测，不可用时仅记日志，绝不抛异常。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderCard6(),
      this._renderCard7(),
      this._renderCard8(),
      this._renderLogPanel(),
    );
  }
}
