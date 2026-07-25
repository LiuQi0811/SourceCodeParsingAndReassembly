// =====================================================================
// IntlEnumerationPage.js —— Intl Enumeration API 实验室
// 演示 MDN：Intl.supportedValuesOf(category) 枚举 API（ECMA-402 第 13 章）
//   - 运行时获取浏览器/引擎支持的本地化数据列表，替代硬编码 moment-timezone
//     / cldr / unicode-flag-json 等静态数据，体积更小且随引擎更新而更新。
//   - 6 类标准 category（ECMA-402 规范定义，全部引擎一致）：
//       'calendar' | 'collation' | 'currency' | 'numberingSystem' | 'timeZone' | 'unit'
//   - 与 Intl.DateTimeFormat / NumberFormat / Locale / Collator / DisplayNames 协同：
//       枚举出的值可直接作为对应 Intl 构造器的选项，杜绝拼错或传入不支持项。
//   - 语言/文字/区域（language/script/region）子标签枚举不在本 API 范畴，
//       需结合 Intl.Locale + Intl.DisplayNames 或 BCP 47 静态注册表实现。
// 说明：Intl.supportedValuesOf 在 V8 9.9+（Node 18+ / Chrome 99+）、
//       Firefox 122+、Safari 17.4+ 可用。所有 API 调用前做能力检测
//       （typeof Intl.supportedValuesOf === 'function'），不可用时仅
//       _addLog('warn', ...) + 设置 info 文本，绝不抛异常。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// ECMA-402 规范定义的 6 类合法 category（按字母序，与规范一致）
const VALID_CATEGORIES = ['calendar', 'collation', 'currency', 'numberingSystem', 'timeZone', 'unit'];

// 旧浏览器降级用的静态最小数据集（仅演示用，生产请用 cldr 数据）
const FALLBACK_TIMEZONES = [
  'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Hong_Kong', 'Asia/Singapore', 'Asia/Seoul',
  'Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Europe/Moscow', 'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'America/Sao_Paulo', 'Australia/Sydney', 'Pacific/Auckland', 'UTC',
];

export class IntlEnumerationPage extends Page {
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      overviewInfo: '',       // Card 1：Intl Enumeration API 概述与能力检测
      timezoneInfo: '',       // Card 2：category: timeZone 时区枚举
      calnumInfo: '',         // Card 3：calendar / numberingSystem
      curunitInfo: '',        // Card 4：currency / unit
      langscriptInfo: '',     // Card 5：language / script / region
      collationInfo: '',      // Card 6：collation
      selectorInfo: '',       // Card 7：实战动态国际化选择器
      compatInfo: '',         // Card 8：兼容性与降级
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // 防止 setState 触发重渲染后再次进入 componentDidMount 导致指数级 rAF 爆炸
    if (this._inited) return;
    this._inited = true;

    this._dynamicStyles = [];

    const f = this._flags();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `Intl.supportedValuesOf ${c(f.supportedValuesOf)}`,
      `Intl.Locale ${c(f.intlLocale)}`,
      `Intl.DisplayNames ${c(f.displayNames)}`,
      `Intl.Collator ${c(f.collator)}`,
    ];

    const summary = f.supportedValuesOf
      ? `Intl Enumeration API 能力检测：${parts.join(' · ')}。当前环境（Node/浏览器引擎）原生支持 Intl.supportedValuesOf，6 类 category 均可真实枚举，本页所有演示按钮点击将展示真实运行结果。`
      : `Intl Enumeration API 能力检测：${parts.join(' · ')}。当前环境不支持 Intl.supportedValuesOf（需 Chrome 99+/Firefox 122+/Safari 17.4+/Node 18+），演示将展示静态示例与降级方案，不会抛异常。`;

    this.setState({ capsSummary: summary });
    this._addLog(f.supportedValuesOf ? 'intl' : 'warn', `能力检测：${parts.join('，')}`);
    if (!f.supportedValuesOf) {
      this._addLog('warn', 'Intl.supportedValuesOf 不可用（建议升级到 Chrome 99+/Firefox 122+/Safari 17.4+/Node 18+）');
    }
    if (!f.intlLocale) this._addLog('warn', 'Intl.Locale 不可用（建议 Chrome 74+/Firefox 75+/Safari 14.1+）');
    if (!f.displayNames) this._addLog('warn', 'Intl.DisplayNames 不可用（建议 Chrome 81+/Firefox 86+/Safari 14.1+）');
    if (!f.collator) this._addLog('warn', 'Intl.Collator 不可用（广泛支持，仅极老引擎缺失）');

    this._injectBaseStyles();
  }

  componentWillUnmount() {
    for (const style of this._dynamicStyles) {
      try { style.parentNode && style.parentNode.removeChild(style); } catch { /* noop */ }
    }
    this._dynamicStyles = [];
  }

  // —— 辅助方法 ——

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

  _flags() {
    const safe = (fn) => {
      try { return fn(); } catch { return false; }
    };
    return {
      supportedValuesOf: safe(() => typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function'),
      intlLocale: safe(() => typeof Intl !== 'undefined' && typeof Intl.Locale === 'function'),
      displayNames: safe(() => typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'),
      collator: safe(() => typeof Intl !== 'undefined' && typeof Intl.Collator === 'function'),
    };
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

  // 安全枚举：失败返回 null（不抛异常）
  _safeEnum(category) {
    try {
      if (typeof Intl === 'undefined' || typeof Intl.supportedValuesOf !== 'function') return null;
      const v = Intl.supportedValuesOf(category);
      return Array.isArray(v) ? v : null;
    } catch {
      return null;
    }
  }

  _injectBaseStyles() {
    this._injectStyle('intl-enum-base', `
      .intl-enum-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
      .intl-enum-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; max-height: 180px; overflow: auto; padding: 6px; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; }
      .intl-enum-tag {
        display: inline-block;
        padding: 2px 8px;
        background: #eff6ff;
        color: #1e40af;
        border: 1px solid #bfdbfe;
        border-radius: 10px;
        font-size: 11px;
        font-family: 'SFMono-Regular', Consolas, monospace;
        white-space: nowrap;
      }
      .intl-enum-tag--hi { background: #fef3c7; color: #92400e; border-color: #fde68a; }
      .intl-enum-tag--ok { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
      .intl-enum-matrix { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; margin-top: 10px; }
      .intl-enum-matrix-cell { background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; font-size: 12px; }
      .intl-enum-matrix-cell b { color: #1e293b; font-size: 14px; display: block; margin-bottom: 2px; }
      .intl-enum-matrix-cell span { color: #64748b; }
      .intl-enum-selector {
        margin-top: 10px;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 8px;
      }
      .intl-enum-selector label { display: block; font-size: 11px; color: #64748b; margin-bottom: 2px; }
      .intl-enum-selector select {
        width: 100%; padding: 4px 8px; border: 1px solid #cbd5e1;
        border-radius: 4px; background: #fff; font-size: 12px;
      }
    `);
  }

  // ===================== Card 1：Intl Enumeration API 概述与能力检测 =====================

  _runOverviewDemo() {
    const f = this._flags();
    this._injectStyle('intl-enum-overview', `
      .intl-enum-overview-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);

    // 真实枚举每个 category 的数量
    const counts = {};
    for (const cat of VALID_CATEGORIES) {
      const v = this._safeEnum(cat);
      counts[cat] = v === null ? '不可用' : v.length;
    }

    const info = [
      '===== Intl Enumeration API 概述与能力检测 =====',
      '',
      '【API 签名】',
      '  // ECMA-402 第 13 章：返回当前引擎支持的本地化数据数组',
      '  Intl.supportedValuesOf(category: string): string[]',
      '',
      '  // category 取值（ECMA-402 规范定义的 6 类，按字母序）',
      "  'calendar'        // 历法：buddhist / chinese / coptic / ethiopic / gregory / ...",
      "  'collation'       // 排序规则：pinyin / stroke / emoji / compat / ...",
      "  'currency'        // ISO 4217 货币代码：USD / CNY / JPY / EUR / ...",
      "  'numberingSystem' // 编号系统：arab / latn / hans / fullwide / ...",
      "  'timeZone'        // IANA 时区：Asia/Shanghai / America/New_York / ...",
      "  'unit'            // 计量单位：meter / kilogram / celsius / byte / ...",
      '',
      '【动机：替代硬编码数据】',
      '  旧方案：moment-timezone 打包 ~200KB 时区数据；cldr-numbers 全量货币/编号系统',
      '  新方案：Intl.supportedValuesOf 运行时枚举，零打包体积，随引擎 ICU 数据更新',
      '  优势：',
      '    1. 体积：前端 bundle 不再内嵌时区/货币/单位静态表',
      '    2. 时效：引擎 ICU 升级后自动获得新数据（如新增货币）',
      '    3. 一致：与 Intl 构造器实际接受值完全对齐，杜绝拼错',
      '    4. 国际化：直接驱动 <select> 选择器，无需第三方库',
      '',
      '【能力检测代码】',
      "  const ok = typeof Intl !== 'undefined'",
      "          && typeof Intl.supportedValuesOf === 'function';",
      '  if (!ok) {',
      '    // 降级：使用静态数据或 @formatjs/intl-utils polyfill',
      '    return FALLBACK_TIMEZONES;',
      '  }',
      "  const tz = Intl.supportedValuesOf('timeZone');",
      "  // ['Asia/Shanghai', 'America/New_York', 'Europe/London', ...]",
      '',
      '【与 Intl.DateTimeFormat.supportedLocalesOf 的区别】',
      '  - supportedLocalesOf(locales)：检测「哪些 locale 标签被 DateTimeFormat 接受」',
      '    输入是 locale 数组，输出是其子集，粒度在 locale 级别',
      "  - supportedValuesOf('timeZone')：枚举「当前引擎支持的全部时区」",
      '    无输入，输出是完整列表，粒度在 category 项级别',
      '  - 二者互补：前者筛 locale，后者枚举 category 内的值',
      '',
      '【浏览器/引擎支持矩阵】',
      '  引擎/浏览器        supportedValuesOf   备注',
      '  V8 9.9+（Chrome 99+）  ✓              2022-03 起',
      '  Node 18+（V8 9.9+）    ✓              内置 full ICU',
      '  Firefox 122+           ✓              2024-01 起',
      '  Safari 17.4+           ✓              2024-03 起',
      '  iOS Safari 17.4+       ✓              同 Safari',
      '  Deno 1.18+             ✓              V8 内核',
      '  Bun 1.0+               ✓              JavaScriptCore 已支持',
      '  旧引擎                 ✗              需 polyfill 或静态降级',
      '',
      '【当前环境真实枚举结果】',
      ...VALID_CATEGORIES.map((cat) => `  ${cat.padEnd(18)} → ${counts[cat]} 项`),
      '',
      '【常见陷阱】',
      '  1. language / script / region 不是规范 category，调用会抛 RangeError',
      '     → 枚举语言需用 Intl.DisplayNames({ type: "language" }) + 静态 BCP 47 注册表',
      '  2. 返回数组顺序由实现决定，不应依赖排序（如需排序自行 sort）',
      '  3. 时区列表可能随 ICU 版本变化，不应硬编码索引取特定时区',
      '  4. 某些引擎（早期 Safari）返回的 currency 可能不含历史货币，需校验',
      '  5. unit 仅返回简单单位，复合单位（kilometer-per-hour）需用 -per- 拼接',
    ].join('\n');
    this.setState({ overviewInfo: info });
    this._addLog('intl', `能力检测完成：6 类 category 真实枚举 → ${VALID_CATEGORIES.map((c) => `${c}=${counts[c]}`).join('，')}`);
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. Intl Enumeration API 概述与能力检测 —— 替代硬编码国际化数据',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['supportedValuesOf', f.supportedValuesOf],
          ['Intl.Locale', f.intlLocale],
        ]),
        h(Tag, { color: 'primary' }, '概述'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Intl.supportedValuesOf(category) 是 ECMA-402 第 13 章定义的枚举 API，运行时返回当前引擎支持的本地化数据列表（IANA 时区 / ISO 4217 货币 / 历法 / 编号系统 / 计量单位 / 排序规则）。动机是替代硬编码 moment-timezone / cldr 等静态数据：零打包体积、随引擎 ICU 更新、与 Intl 构造器实际接受值完全对齐。规范定义 6 类合法 category，language/script/region 不在其中（会抛 RangeError）。浏览器支持：Chrome 99+/Firefox 122+/Safari 17.4+/Node 18+。能力检测用 typeof Intl.supportedValuesOf === \'function\'，不可用时降级到静态数据或 @formatjs polyfill。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行能力检测演示', { type: 'primary', size: 'sm', onClick: () => this._runOverviewDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// ECMA-402 第 13 章：Intl Enumeration API
Intl.supportedValuesOf(category: string): string[]

// 6 类规范 category
const calendars   = Intl.supportedValuesOf('calendar');
const collations  = Intl.supportedValuesOf('collation');
const currencies  = Intl.supportedValuesOf('currency');
const numberings  = Intl.supportedValuesOf('numberingSystem');
const timezones   = Intl.supportedValuesOf('timeZone');
const units       = Intl.supportedValuesOf('unit');

// 能力检测（旧浏览器降级）
const ok = typeof Intl !== 'undefined'
        && typeof Intl.supportedValuesOf === 'function';
const tz = ok ? Intl.supportedValuesOf('timeZone') : FALLBACK_TIMEZONES;
// ['Asia/Shanghai', 'America/New_York', 'Europe/London', ...]

// 与 supportedLocalesOf 的区别：
//   supportedLocalesOf(locales) 筛 locale 标签
//   supportedValuesOf('timeZone') 枚举 category 内全部项`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.overviewInfo || '（点击按钮查看 Intl Enumeration API 概述与能力检测完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 2：category: timeZone 时区枚举 =====================

  _runTimezoneDemo() {
    const f = this._flags();
    this._injectStyle('intl-enum-tz', `
      .intl-enum-tz-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);

    // 真实枚举时区
    const tzs = this._safeEnum('timeZone');
    let sample = tzs ? tzs.slice(0, 8) : FALLBACK_TIMEZONES.slice(0, 8);
    const total = tzs ? tzs.length : FALLBACK_TIMEZONES.length;

    // 按区域分组（取斜杠前缀）
    let regionGroup = '';
    if (tzs) {
      const groups = {};
      for (const tz of tzs) {
        const region = tz.includes('/') ? tz.split('/')[0] : 'Other';
        groups[region] = (groups[region] || 0) + 1;
      }
      const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]);
      regionGroup = sorted.slice(0, 12).map(([r, n]) => `  ${r.padEnd(20)} ${n}`).join('\n');
    }

    // 实战：检测当前 locale 默认时区
    let defaultTz = '';
    try {
      defaultTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) { defaultTz = `（解析失败：${e.message}）`; }

    if (!f.supportedValuesOf) {
      this._addLog('warn', 'Intl.supportedValuesOf 不可用，时区枚举降级到 FALLBACK_TIMEZONES（仅 18 项示例）');
    }

    const info = [
      '===== category: timeZone —— IANA 时区枚举 =====',
      '',
      '【API 调用】',
      "  const timezones = Intl.supportedValuesOf('timeZone');",
      `  // 当前环境共 ${total} 个时区`,
      `  // 前 8 项示例：${JSON.stringify(sample)}`,
      '',
      '【返回值特征】',
      '  - IANA 时区数据库标识（tzdata），如 Asia/Shanghai、America/New_York',
      '  - 不含已废弃别名（如 Asia/Calcutta 已合并为 Asia/Kolkata）',
      '  - 顺序由实现决定，不保证字母序（如需排序请自行 sort）',
      '  - 随 ICU/tzdata 版本更新，可能新增或调整（如时区改革）',
      '',
      '【与 Intl.DateTimeFormat.supportedLocalesOf 的区别】',
      '  // supportedLocalesOf：筛 locale 标签（locale 级别）',
      "  Intl.DateTimeFormat.supportedLocalesOf(['zh-CN', 'xx-YY'])",
      "  // → ['zh-CN']  （xx-YY 不支持被过滤）",
      '',
      '  // supportedValuesOf：枚举 category 全部值（项级别）',
      "  Intl.supportedValuesOf('timeZone')",
      "  // → ['Africa/Abidjan', ..., 'Asia/Shanghai', ..., 'UTC']",
      '',
      '【当前 locale 默认时区】',
      "  Intl.DateTimeFormat().resolvedOptions().timeZone",
      `  // → '${defaultTz}'`,
      '',
      '【实战：动态时区选择器】',
      '  // 替代硬编码 <option>Asia/Shanghai</option> 列表',
      "  const sel = document.createElement('select');",
      "  Intl.supportedValuesOf('timeZone').forEach((tz) => {",
      "    const opt = new Option(tz, tz);",
      "    sel.add(opt);",
      '  });',
      "  sel.value = Intl.DateTimeFormat().resolvedOptions().timeZone;",
      '  sel.onchange = (e) => renderTime(new Date(), e.target.value);',
      '',
      '【按区域分组的时区分布（前 12 大区域）】',
      regionGroup || '  （枚举不可用，无分组数据）',
      '',
      '【用枚举值驱动 DateTimeFormat】',
      "  const tz = 'America/New_York';",
      '  // 校验该时区是否被引擎支持（避免 RangeError）',
      "  const ok = Intl.supportedValuesOf('timeZone').includes(tz);",
      '  if (!ok) throw new Error(`不支持的时区: ${tz}`);',
      '  new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());',
    ].join('\n');
    this.setState({ timezoneInfo: info });
    this._addLog('intl', `timeZone 枚举完成：共 ${total} 项，当前默认时区 ${defaultTz}`);

    // 真实标签云渲染
    if (tzs) {
      const tagCloud = this.el?.querySelector('#intl-enum-tz-tags');
      if (tagCloud) {
        tagCloud.innerHTML = '';
        tzs.slice(0, 60).forEach((tz) => {
          const tag = document.createElement('span');
          tag.className = 'intl-enum-tag' + (tz === defaultTz ? ' intl-enum-tag--ok' : '');
          tag.textContent = tz;
          tagCloud.appendChild(tag);
        });
      }
    }
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. category: timeZone —— IANA 时区枚举与动态时区选择器',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['timeZone', f.supportedValuesOf]]),
        h(Tag, { color: 'primary' }, 'timeZone'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          "Intl.supportedValuesOf('timeZone') 返回当前引擎支持的全部 IANA 时区标识（如 Asia/Shanghai、America/New_York、Europe/London）。与 Intl.DateTimeFormat.supportedLocalesOf 的区别：前者筛 locale 标签（locale 级别），后者枚举 category 内全部项（项级别），二者互补。实战价值：替代硬编码 <option> 列表，运行时填充时区选择器，并校验用户传入时区是否被引擎支持以避免 RangeError。配合 Intl.DateTimeFormat().resolvedOptions().timeZone 可定位当前默认时区。",
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('枚举时区 + 选择器实战', { type: 'primary', size: 'sm', onClick: () => this._runTimezoneDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 枚举 IANA 时区
const timezones = Intl.supportedValuesOf('timeZone');
// ['Africa/Abidjan', 'Africa/Accra', ..., 'Asia/Shanghai', ...]

// 当前默认时区
const myTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

// 动态时区选择器（替代硬编码 <option>）
const sel = document.createElement('select');
timezones.forEach((tz) => sel.add(new Option(tz, tz)));
sel.value = myTz;
sel.onchange = (e) => {
  // 校验 + 用该时区格式化
  new Intl.DateTimeFormat('en-US', { timeZone: e.target.value })
    .format(new Date());
};

// 与 supportedLocalesOf 的区别
Intl.DateTimeFormat.supportedLocalesOf(['zh-CN', 'xx-YY']);
// → ['zh-CN']  （筛 locale 标签，非枚举时区）`)),
        h('div', { class: 'fs-sm text-secondary' }, '前 60 项时区标签云：'),
        h('div', { id: 'intl-enum-tz-tags', class: 'intl-enum-tags' },
          h('span', { class: 'fs-sm text-secondary' }, '（点击按钮加载真实时区标签）'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.timezoneInfo || '（点击按钮查看 timeZone 枚举与动态选择器完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 3：calendar / numberingSystem =====================

  _runCalNumDemo() {
    const f = this._flags();
    this._injectStyle('intl-enum-calnum', `
      .intl-enum-calnum-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);

    const cals = this._safeEnum('calendar');
    const nums = this._safeEnum('numberingSystem');

    if (!f.supportedValuesOf) {
      this._addLog('warn', 'Intl.supportedValuesOf 不可用，calendar/numberingSystem 枚举降级到静态示例');
    }

    // 真实演示：用枚举出的 calendar 与 numberingSystem 驱动 DateTimeFormat
    let demoCalLines = [];
    if (cals) {
      const sampleCals = ['buddhist', 'chinese', 'coptic', 'ethiopic', 'hebrew', 'islamic', 'persian', 'iso8601'].filter((c) => cals.includes(c));
      for (const cal of sampleCals.slice(0, 5)) {
        try {
          const s = new Intl.DateTimeFormat('zh-CN', { calendar: cal, dateStyle: 'long' }).format(new Date());
          demoCalLines.push(`  ${cal.padEnd(10)} → ${s}`);
        } catch (e) {
          demoCalLines.push(`  ${cal.padEnd(10)} → （格式化失败：${e.message}）`);
        }
      }
    }

    let demoNumLines = [];
    if (nums) {
      const sampleNums = ['arab', 'latn', 'hans', 'fullwide', 'beng', 'thai'].filter((n) => nums.includes(n));
      for (const num of sampleNums) {
        try {
          const s = new Intl.NumberFormat('zh-CN', { numberingSystem: num }).format(1234567.89);
          demoNumLines.push(`  ${num.padEnd(10)} → ${s}`);
        } catch (e) {
          demoNumLines.push(`  ${num.padEnd(10)} → （格式化失败：${e.message}）`);
        }
      }
    }

    const info = [
      '===== calendar / numberingSystem —— 历法与编号系统枚举 =====',
      '',
      '【API 调用】',
      "  const calendars = Intl.supportedValuesOf('calendar');",
      `  // 当前环境共 ${cals ? cals.length : '不可用'} 个历法`,
      `  // 示例：${cals ? JSON.stringify(cals.slice(0, 10)) : '需 Chrome 99+/Node 18+'}`,
      '',
      "  const numberings = Intl.supportedValuesOf('numberingSystem');",
      `  // 当前环境共 ${nums ? nums.length : '不可用'} 个编号系统`,
      `  // 示例：${nums ? JSON.stringify(nums.slice(0, 10)) : '需 Chrome 99+/Node 18+'}`,
      '',
      '【历法（calendar）常见值】',
      '  gregory   公历（默认，西方通用）',
      '  chinese   中国农历',
      '  buddhist  佛历（泰国等，比公历早 543 年）',
      '  islamic   伊斯兰历（沙特等）',
      '  hebrew    希伯来历（以色列）',
      '  persian   波斯历（伊朗/阿富汗）',
      '  ethiopic  埃塞俄比亚历',
      '  coptic    科普特历（埃及基督教）',
      '  iso8601   ISO 8601 标准（等同 gregory 但周计算规则不同）',
      '  japanese  日本年号历（令和/平成/...）',
      '',
      '【编号系统（numberingSystem）常见值】',
      '  latn      拉丁数字 0-9（西方/中文默认）',
      '  arab      阿拉伯-印度数字 ٠-٩',
      '  arabext   扩展阿拉伯数字 ۰-۹（波斯/乌尔都）',
      '  hans      简体中文数字 一二三',
      '  hant      繁体中文数字 壹貳參',
      '  fullwide  全角数字 ０１２３',
      '  beng      孟加拉数字 ০-৯',
      '  thai      泰国数字 ๐-๙',
      '  deva      天城文数字 ०-९（印地语）',
      '',
      '【与 Intl.Locale 选项协同】',
      "  // 通过 Locale 指定 calendar / numberingSystem",
      "  const loc = new Intl.Locale('zh-CN-u-ca-chinese-nu-hans');",
      "  //   -u-ca-chinese  历法 = chinese",
      "  //   -nu-hans       编号系统 = hans",
      '  loc.calendar;        // "chinese"',
      '  loc.numberingSystem; // "hans"',
      '',
      "  // 直接传给 DateTimeFormat / NumberFormat",
      "  new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { dateStyle: 'long' })",
      "    .format(new Date());",
      "  new Intl.NumberFormat('zh-CN-u-nu-hans').format(12345);",
      '',
      '【用枚举值校验选项合法性】',
      "  function safeCalendar(cal) {",
      "    const all = Intl.supportedValuesOf('calendar');",
      '    return all.includes(cal) ? cal : "gregory";',
      '  }',
      "  new Intl.DateTimeFormat('zh-CN', { calendar: safeCalendar(userCal) });",
      '',
      '【当前环境真实格式化演示】',
      '【历法格式化（dateStyle:long, locale:zh-CN）】',
      ...demoCalLines.length ? demoCalLines : ['  （枚举不可用，无演示）'],
      '',
      '【编号系统格式化（Number: 1234567.89, locale:zh-CN）】',
      ...demoNumLines.length ? demoNumLines : ['  （枚举不可用，无演示）'],
    ].join('\n');
    this.setState({ calnumInfo: info });
    this._addLog('intl', `calendar=${cals ? cals.length : 0} 项，numberingSystem=${nums ? nums.length : 0} 项，已生成真实格式化演示`);

    // 标签云渲染
    const calCloud = this.el?.querySelector('#intl-enum-cal-tags');
    if (calCloud && cals) {
      calCloud.innerHTML = '';
      cals.forEach((c) => {
        const tag = document.createElement('span');
        tag.className = 'intl-enum-tag';
        tag.textContent = c;
        calCloud.appendChild(tag);
      });
    }
    const numCloud = this.el?.querySelector('#intl-enum-num-tags');
    if (numCloud && nums) {
      numCloud.innerHTML = '';
      nums.forEach((n) => {
        const tag = document.createElement('span');
        tag.className = 'intl-enum-tag';
        tag.textContent = n;
        numCloud.appendChild(tag);
      });
    }
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. calendar / numberingSystem —— 历法与编号系统枚举',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['calendar', f.supportedValuesOf],
          ['numberingSystem', f.supportedValuesOf],
        ]),
        h(Tag, { color: 'primary' }, 'calendar/nu'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          "Intl.supportedValuesOf('calendar') 枚举历法（buddhist/chinese/coptic/ethiopic/gregory/hebrew/islamic/persian/japanese/iso8601 等），Intl.supportedValuesOf('numberingSystem') 枚举编号系统（arab/latn/hans/hant/fullwide/beng/thai/deva 等）。与 Intl.Locale 协同：new Intl.Locale('zh-CN-u-ca-chinese-nu-hans') 通过 -u-ca- 与 -nu- 扩展键指定历法/编号系统，并可直接作为 DateTimeFormat/NumberFormat 的 locale 参数。枚举值可用于校验用户选项合法性，避免 RangeError。",
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('枚举历法/编号 + 格式化演示', { type: 'primary', size: 'sm', onClick: () => this._runCalNumDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 枚举历法与编号系统
const calendars = Intl.supportedValuesOf('calendar');
const numberings = Intl.supportedValuesOf('numberingSystem');

// 与 Intl.Locale 协同（-u-ca- 历法、-nu- 编号系统）
const loc = new Intl.Locale('zh-CN-u-ca-chinese-nu-hans');
loc.calendar;        // 'chinese'
loc.numberingSystem; // 'hans'

// 直接驱动 DateTimeFormat / NumberFormat
new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { dateStyle: 'long' })
  .format(new Date());   // 农历日期
new Intl.NumberFormat('zh-CN-u-nu-hans')
  .format(1234567.89);   // 一百二十三万四千五百六十七点八九

// 校验用户传入的选项合法性
function safeCalendar(cal) {
  const all = Intl.supportedValuesOf('calendar');
  return all.includes(cal) ? cal : 'gregory';
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '历法标签云：'),
        h('div', { id: 'intl-enum-cal-tags', class: 'intl-enum-tags' },
          h('span', { class: 'fs-sm text-secondary' }, '（点击按钮加载）'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '编号系统标签云：'),
        h('div', { id: 'intl-enum-num-tags', class: 'intl-enum-tags' },
          h('span', { class: 'fs-sm text-secondary' }, '（点击按钮加载）'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.calnumInfo || '（点击按钮查看 calendar/numberingSystem 枚举与协同完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 4：currency / unit =====================

  _runCurUnitDemo() {
    const f = this._flags();
    this._injectStyle('intl-enum-curunit', `
      .intl-enum-curunit-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);

    const curs = this._safeEnum('currency');
    const units = this._safeEnum('unit');

    if (!f.supportedValuesOf) {
      this._addLog('warn', 'Intl.supportedValuesOf 不可用，currency/unit 枚举降级到静态示例');
    }

    // 真实货币格式化演示
    let curLines = [];
    const sampleCurs = ['USD', 'CNY', 'JPY', 'EUR', 'GBP', 'KRW', 'RUB', 'INR'];
    for (const cur of sampleCurs) {
      if (curs && !curs.includes(cur)) continue;
      try {
        const s1 = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: cur }).format(1234.56);
        const s2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(1234.56);
        curLines.push(`  ${cur}  zh-CN → ${s1.padEnd(20)}  en-US → ${s2}`);
      } catch (e) {
        curLines.push(`  ${cur}  （格式化失败：${e.message}）`);
      }
    }

    // 真实单位格式化演示
    let unitLines = [];
    const sampleUnits = [
      { unit: 'kilometer', value: 42.195 },
      { unit: 'kilogram', value: 3.5 },
      { unit: 'celsius', value: 36.6 },
      { unit: 'percent', value: 0.85 },
      { unit: 'byte', value: 4096 },
      { unit: 'liter', value: 1.5 },
    ];
    for (const { unit, value } of sampleUnits) {
      if (units && !units.includes(unit)) continue;
      try {
        const s = new Intl.NumberFormat('zh-CN', { style: 'unit', unit, unitDisplay: 'long' }).format(value);
        unitLines.push(`  ${unit.padEnd(14)} ${String(value).padStart(8)} → ${s}`);
      } catch (e) {
        unitLines.push(`  ${unit.padEnd(14)} （格式化失败：${e.message}）`);
      }
    }

    // 复合单位演示（kilometer-per-hour）
    let compoundLine = '';
    try {
      compoundLine = new Intl.NumberFormat('zh-CN', { style: 'unit', unit: 'kilometer-per-hour' }).format(120);
    } catch (e) { compoundLine = `（失败：${e.message}）`; }

    const info = [
      '===== currency / unit —— ISO 4217 货币与计量单位枚举 =====',
      '',
      '【API 调用】',
      "  const currencies = Intl.supportedValuesOf('currency');",
      `  // 当前环境共 ${curs ? curs.length : '不可用'} 个 ISO 4217 货币`,
      `  // 示例：${curs ? JSON.stringify(curs.slice(0, 10)) : '需 Chrome 99+/Node 18+'}`,
      '',
      "  const units = Intl.supportedValuesOf('unit');",
      `  // 当前环境共 ${units ? units.length : '不可用'} 个计量单位`,
      `  // 示例：${units ? JSON.stringify(units.slice(0, 10)) : '需 Chrome 99+/Node 18+'}`,
      '',
      '【ISO 4217 货币代码】',
      '  USD 美元 / CNY 人民币 / JPY 日元 / EUR 欧元 / GBP 英镑',
      '  KRW 韩元 / RUB 俄罗斯卢布 / INR 印度卢比 / CHF 瑞士法郎',
      '  每个代码 3 字母大写，由 ISO 4217 标准维护，ICU 定期同步',
      '',
      '【计量单位（unit）分类】',
      '  长度：meter / kilometer / centimeter / mile / foot / inch',
      '  重量：gram / kilogram / ounce / pound / ton',
      '  温度：celsius / fahrenheit',
      '  面积：acre / hectare / square-meter',
      '  体积：liter / milliliter / gallon / cubic-meter',
      '  数据：bit / byte / kilobit / kilobyte / megabyte / gigabyte',
      '  速度：kilometer-per-hour / mile-per-hour / meter-per-second（复合单位）',
      '  其他：percent / degree / millimeter-of-mercury',
      '',
      '【与 NumberFormat 配合】',
      "  new Intl.NumberFormat('zh-CN', {",
      "    style: 'currency', currency: 'CNY',",
      "  }).format(1234.56);  // ¥1,234.56",
      '',
      "  new Intl.NumberFormat('en-US', {",
      "    style: 'currency', currency: 'USD',",
      "  }).format(1234.56);  // $1,234.56",
      '',
      "  new Intl.NumberFormat('zh-CN', {",
      "    style: 'unit', unit: 'celsius',",
      "    unitDisplay: 'long',  // 'short'|'narrow'|'long'",
      "  }).format(36.6);  // 36.6 摄氏度",
      '',
      '【复合单位（用 -per- 拼接）】',
      "  new Intl.NumberFormat('zh-CN', {",
      "    style: 'unit', unit: 'kilometer-per-hour',",
      "  }).format(120);  // 120 公里/小时",
      `  // 当前环境演示 → ${compoundLine}`,
      '',
      '【用枚举校验货币/单位合法性】',
      "  function safeCurrency(code) {",
      "    const all = Intl.supportedValuesOf('currency');",
      '    return all.includes(code) ? code : "USD";',
      '  }',
      "  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: safeCurrency(userCode) });",
      '',
      '【当前环境真实货币格式化演示】',
      ...curLines.length ? curLines : ['  （枚举不可用，无演示）'],
      '',
      '【当前环境真实单位格式化演示】',
      ...unitLines.length ? unitLines : ['  （枚举不可用，无演示）'],
    ].join('\n');
    this.setState({ curunitInfo: info });
    this._addLog('intl', `currency=${curs ? curs.length : 0} 项，unit=${units ? units.length : 0} 项，已生成真实格式化演示`);
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. currency / unit —— ISO 4217 货币与计量单位枚举',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['currency', f.supportedValuesOf],
          ['unit', f.supportedValuesOf],
        ]),
        h(Tag, { color: 'primary' }, 'currency/unit'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          "Intl.supportedValuesOf('currency') 枚举 ISO 4217 三字母货币代码（USD/CNY/JPY/EUR/GBP/KRW 等），Intl.supportedValuesOf('unit') 枚举计量单位（长度 meter/kilometer、重量 kilogram、温度 celsius、数据 byte、速度 kilometer-per-hour 复合单位等）。与 Intl.NumberFormat 配合：style:'currency' + currency 选项、style:'unit' + unit + unitDisplay 选项。复合单位用 -per- 拼接（kilometer-per-hour）。枚举值用于校验用户传入合法性，避免 RangeError。",
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('枚举货币/单位 + 格式化演示', { type: 'primary', size: 'sm', onClick: () => this._runCurUnitDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 枚举货币与单位
const currencies = Intl.supportedValuesOf('currency');
const units = Intl.supportedValuesOf('unit');

// 与 NumberFormat 配合 —— 货币
new Intl.NumberFormat('zh-CN', {
  style: 'currency', currency: 'CNY',
}).format(1234.56);  // ¥1,234.56

new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD',
}).format(1234.56);  // $1,234.56

// 与 NumberFormat 配合 —— 单位
new Intl.NumberFormat('zh-CN', {
  style: 'unit', unit: 'celsius',
  unitDisplay: 'long',  // 'short' | 'narrow' | 'long'
}).format(36.6);  // 36.6 摄氏度

// 复合单位用 -per- 拼接
new Intl.NumberFormat('zh-CN', {
  style: 'unit', unit: 'kilometer-per-hour',
}).format(120);  // 120 公里/小时

// 枚举校验合法性，避免 RangeError
function safeCurrency(code) {
  const all = Intl.supportedValuesOf('currency');
  return all.includes(code) ? code : 'USD';
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.curunitInfo || '（点击按钮查看 currency/unit 枚举与 NumberFormat 配合完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 5：language / script / region（不在规范内，需降级） =====================

  _runLangScriptDemo() {
    const f = this._flags();
    this._injectStyle('intl-enum-lang', `
      .intl-enum-lang-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);

    // 关键演示：language/script/region 不是规范 category，会抛 RangeError
    const probeResults = {};
    for (const cat of ['language', 'script', 'region']) {
      try {
        if (typeof Intl === 'undefined' || typeof Intl.supportedValuesOf !== 'function') {
          probeResults[cat] = { ok: false, error: 'supportedValuesOf 不可用' };
        } else {
          const v = Intl.supportedValuesOf(cat);
          probeResults[cat] = { ok: true, count: Array.isArray(v) ? v.length : 0 };
        }
      } catch (e) {
        probeResults[cat] = { ok: false, error: `${e.name}: ${e.message}` };
      }
    }

    // 用 Intl.DisplayNames 枚举语言/区域（替代方案）
    let displayNamesLines = [];
    if (f.displayNames) {
      const sampleLangs = ['zh', 'en', 'ja', 'ko', 'ar', 'ru', 'de', 'fr', 'es', 'pt'];
      const sampleRegions = ['CN', 'US', 'JP', 'KR', 'GB', 'FR', 'DE', 'BR', 'IN', 'RU'];
      try {
        const dnLang = new Intl.DisplayNames(['zh-CN'], { type: 'language' });
        displayNamesLines.push('【Intl.DisplayNames({type:"language"}) 语言显示名（中文）】');
        for (const l of sampleLangs) {
          try { displayNamesLines.push(`  ${l.padEnd(4)} → ${dnLang.of(l)}`); }
          catch (e) { displayNamesLines.push(`  ${l.padEnd(4)} → （失败：${e.message}）`); }
        }
        const dnRegion = new Intl.DisplayNames(['zh-CN'], { type: 'region' });
        displayNamesLines.push('');
        displayNamesLines.push('【Intl.DisplayNames({type:"region"}) 区域显示名（中文）】');
        for (const r of sampleRegions) {
          try { displayNamesLines.push(`  ${r.padEnd(4)} → ${dnRegion.of(r)}`); }
          catch (e) { displayNamesLines.push(`  ${r.padEnd(4)} → （失败：${e.message}）`); }
        }
      } catch (e) {
        displayNamesLines.push(`DisplayNames 创建失败：${e.message}`);
      }
    }

    // 用 Intl.Locale 协同：maximize/minimize 推算语言/文字/区域
    let localeLines = [];
    if (f.intlLocale) {
      try {
        const loc = new Intl.Locale('zh-CN');
        localeLines.push(`【Intl.Locale('zh-CN') 协同】`);
        localeLines.push(`  language: ${loc.language}`);
        localeLines.push(`  script:   ${loc.script || '（未指定）'}`);
        localeLines.push(`  region:   ${loc.region || '（未指定）'}`);
        const max = loc.maximize();
        localeLines.push(`  maximize(): language=${max.language}, script=${max.script}, region=${max.region}`);
        const min = loc.minimize();
        localeLines.push(`  minimize(): language=${min.language}, script=${min.script || '—'}, region=${min.region || '—'}`);
      } catch (e) {
        localeLines.push(`Intl.Locale 协同失败：${e.message}`);
      }
    }

    const info = [
      '===== language / script / region —— 非规范 category 的正确处理 =====',
      '',
      '【关键事实：这三类不是 Intl.supportedValuesOf 的合法 category】',
      '  ECMA-402 规范只定义了 6 类 category：',
      '    calendar / collation / currency / numberingSystem / timeZone / unit',
      '  language / script / region 不在其中，调用会抛 RangeError: Invalid key',
      '',
      '【当前环境实测（try/catch 不抛异常）】',
      ...Object.entries(probeResults).map(([cat, r]) =>
        `  ${cat.padEnd(10)} → ${r.ok ? `✓ 返回 ${r.count} 项` : `✗ ${r.error}`}`),
      '',
      '【为什么这三类不在 API 范畴】',
      '  - 语言/文字/区域子标签数量极多（BCP 47 注册表数千项）',
      '  - 引擎并不维护「全量 BCP 47 注册表」，只维护 ICU 内已加载的 locale',
      '  - 子标签组合爆炸（zh-Hans-CN、zh-Hant-TW、zh-Latn-pinyin...）',
      '  - 规范设计者认为枚举意义不大，应由 Intl.Locale + Intl.DisplayNames 处理',
      '',
      '【正确做法 1：Intl.DisplayNames 枚举已知子标签的显示名】',
      "  // 不是枚举列表，而是把已知子标签翻译成本地化名称",
      "  const dn = new Intl.DisplayNames(['zh-CN'], { type: 'language' });",
      "  dn.of('zh');   // '中文'",
      "  dn.of('en');   // '英语'",
      "  dn.of('ja');   // '日语'",
      '',
      "  const dnRegion = new Intl.DisplayNames(['zh-CN'], { type: 'region' });",
      "  dnRegion.of('CN');  // '中国'",
      "  dnRegion.of('US');  // '美国'",
      '',
      '【正确做法 2：Intl.Locale 解析与 maximize/minimize】',
      "  const loc = new Intl.Locale('zh-CN');",
      "  loc.language; // 'zh'",
      "  loc.script;   // undefined（未指定）",
      "  loc.region;   // 'CN'",
      '',
      "  // maximize() 补全 LikelySubtags（推测最可能子标签）",
      "  loc.maximize();",
      "  // → Locale { language: 'zh', script: 'Hans', region: 'CN' }",
      '',
      "  // minimize() 移除可推断子标签",
      "  new Intl.Locale('zh-Hans-CN').minimize();",
      "  // → Locale { language: 'zh' }",
      '',
      '【正确做法 3：静态 BCP 47 注册表（如需完整枚举）】',
      '  // npm i bcp-47 / iana-language-subtag-registry',
      '  import bcp47 from "bcp-47";',
      '  // 或前端打包 unicode-org json 数据',
      '',
      '【实战：语言选择器构建（DisplayNames + 静态语言码）】',
      '  const KNOWN_LANGS = ["zh","en","ja","ko","ar","ru","de","fr","es","pt",',
      '                       "it","hi","vi","th","tr","nl","pl","sv","he","fa"];',
      '  const dn = new Intl.DisplayNames(["zh-CN"], { type: "language" });',
      '  const sel = document.createElement("select");',
      '  KNOWN_LANGS.forEach((code) => {',
      '    sel.add(new Option(dn.of(code), code));  // 显示中文，值为 BCP 47',
      '  });',
      '',
      '【当前环境真实 DisplayNames 演示】',
      ...displayNamesLines.length ? displayNamesLines : ['  （DisplayNames 不可用，需 Chrome 81+/Node 14+）'],
      '',
      '【当前环境真实 Intl.Locale 协同演示】',
      ...localeLines.length ? localeLines : ['  （Intl.Locale 不可用，需 Chrome 74+/Node 12+）'],
    ].join('\n');
    this.setState({ langscriptInfo: info });

    // 记录三类不支持的 warn
    for (const [cat, r] of Object.entries(probeResults)) {
      if (!r.ok) this._addLog('warn', `category '${cat}' 不在 ECMA-402 规范内：${r.error}（请用 Intl.DisplayNames / Intl.Locale 替代）`);
    }
    if (f.displayNames) this._addLog('intl', '已用 Intl.DisplayNames 生成语言/区域显示名演示');
    if (f.intlLocale) this._addLog('intl', '已用 Intl.Locale maximize/minimize 生成子标签协同演示');
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. language / script / region —— 非规范 category 的正确处理与降级',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['supportedValuesOf', f.supportedValuesOf],
          ['DisplayNames', f.displayNames],
          ['Intl.Locale', f.intlLocale],
        ]),
        h(Tag, { color: 'warning' }, '非规范'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          "关键事实：language / script / region 不是 Intl.supportedValuesOf 的合法 category，调用会抛 RangeError: Invalid key（ECMA-402 仅定义 6 类：calendar/collation/currency/numberingSystem/timeZone/unit）。原因：BCP 47 子标签数量极多且组合爆炸，引擎不维护全量注册表。正确做法：用 Intl.DisplayNames({type:'language'|'region'|'script'}) 翻译已知子标签的显示名，用 Intl.Locale 解析 locale 字符串并通过 maximize()/minimize() 推算 LikelySubtags，需完整枚举则用静态 BCP 47 注册表（bcp-47 / iana-language-subtag-registry）。本卡演示 try/catch 安全探测 + DisplayNames + Locale 协同的真实降级方案。",
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('探测三类 + 降级方案演示', { type: 'primary', size: 'sm', onClick: () => this._runLangScriptDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// language/script/region 不是规范 category，调用抛 RangeError
try {
  Intl.supportedValuesOf('language');  // ❌ RangeError: Invalid key
} catch (e) {
  console.warn(e.message);  // 正确处理：降级
}

// 正确做法 1：Intl.DisplayNames 翻译已知子标签
const dnLang = new Intl.DisplayNames(['zh-CN'], { type: 'language' });
dnLang.of('zh');  // '中文'
dnLang.of('en');  // '英语'

const dnRegion = new Intl.DisplayNames(['zh-CN'], { type: 'region' });
dnRegion.of('CN');  // '中国'
dnRegion.of('US');  // '美国'

// 正确做法 2：Intl.Locale 解析 + maximize/minimize
const loc = new Intl.Locale('zh-CN');
loc.language;  // 'zh'
loc.region;    // 'CN'
loc.maximize();   // 补全 → { language:'zh', script:'Hans', region:'CN' }
new Intl.Locale('zh-Hans-CN').minimize();  // 精简 → { language:'zh' }

// 正确做法 3：静态 BCP 47 注册表（如需完整枚举）
//   npm i bcp-47 / iana-language-subtag-registry`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.langscriptInfo || '（点击按钮查看 language/script/region 非规范 category 的正确处理完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 6：collation =====================

  _runCollationDemo() {
    const f = this._flags();
    this._injectStyle('intl-enum-collation', `
      .intl-enum-collation-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);

    const collations = this._safeEnum('collation');

    if (!f.supportedValuesOf) {
      this._addLog('warn', 'Intl.supportedValuesOf 不可用，collation 枚举降级到静态示例');
    }

    // 真实演示：用不同 collation 排序
    const sample = ['张三', '李四', '王五', '阿强', '赵六', '陈七', '奥迪', '宝马'];
    const sampleEn = ['café', 'Cafe', 'apple', 'Apple', 'École', 'banana', 'Zebra', 'zebra'];
    let collatorLines = [];
    const tryCollations = ['pinyin', 'stroke', 'big5han', 'gb2312', 'emoji', 'eor', 'standard'];
    for (const col of tryCollations) {
      if (collations && !collations.includes(col)) continue;
      try {
        const coll = new Intl.Collator('zh-CN', { collation: col });
        const sorted = [...sample].sort(coll.compare);
        collatorLines.push(`  zh-CN [${col.padEnd(10)}] → ${sorted.join(' / ')}`);
      } catch (e) {
        collatorLines.push(`  zh-CN [${col.padEnd(10)}] → （失败：${e.message}）`);
      }
    }
    // 英文大小写/重音演示
    let enLines = [];
    try {
      const collStandard = new Intl.Collator('en-US', { collation: 'standard', sensitivity: 'base' });
      enLines.push(`  en-US [standard, sensitivity:base] → ${[...sampleEn].sort(collStandard.compare).join(' / ')}`);
    } catch (e) { enLines.push(`  en-US standard 失败：${e.message}`); }
    try {
      const collCase = new Intl.Collator('en-US', { collation: 'case', sensitivity: 'case' });
      enLines.push(`  en-US [case,      sensitivity:case] → ${[...sampleEn].sort(collCase.compare).join(' / ')}`);
    } catch (e) { enLines.push(`  en-US case 失败：${e.message}`); }

    const info = [
      '===== collation —— 排序规则枚举与 Collator 配合 =====',
      '',
      '【API 调用】',
      "  const collations = Intl.supportedValuesOf('collation');",
      `  // 当前环境共 ${collations ? collations.length : '不可用'} 个排序规则`,
      `  // 示例：${collations ? JSON.stringify(collations) : '需 Chrome 99+/Node 18+'}`,
      '',
      '【常见排序规则（collation）】',
      '  standard  默认排序（CLDR 标准，区分大小写/重音）',
      '  pinyin    拼音排序（中文按 a-z 拼音字母序）',
      '  stroke    笔画排序（中文按笔画数）',
      '  zhuyin    注音排序（台湾地区）',
      '  big5han   Big5 编码序（台湾传统）',
      '  gb2312    GB2312 编码序（中国大陆传统）',
      '  emoji     表情符号排序（按 emoji 数据字典）',
      '  eor       European Ordering Rules（欧洲多语言排序）',
      '  compat    兼容旧排序（向后兼容）',
      '  dict      字典序（电话簿风格）',
      '  phonebk   电话簿序（德语等特殊处理）',
      '',
      '【与 Intl.Collator 配合】',
      "  const coll = new Intl.Collator('zh-CN', {",
      "    collation: 'pinyin',      // 按拼音排序",
      "    sensitivity: 'variant',   // 'base'|'accent'|'case'|'variant'",
      "    numeric: true,            // 数字感知：file2 < file10",
      "    caseFirst: 'false',       // 'upper'|'lower'|'false'",
      "  });",
      '  [...items].sort(coll.compare);',
      '',
      '【pinyin vs stroke vs big5han 对比】',
      '  - pinyin：按拼音字母序（张 zhang → 赵 zhao）',
      '  - stroke：按笔画数序（简单的在前）',
      '  - big5han：按 Big5 编码序（台湾常用字优先）',
      '  - gb2312：按 GB2312 编码序（大陆常用字优先）',
      '',
      '【多语言排序实战】',
      '  // 中文按拼音、英文按 base sensitivity',
      "  function makeSorter(locale, collation) {",
      "    return new Intl.Collator(locale, { collation, numeric: true }).compare;",
      '  }',
      "  const sortByZh = makeSorter('zh-CN', 'pinyin');",
      "  const sortByEn = makeSorter('en-US', 'standard');",
      '',
      '【sensitivity 选项详解】',
      '  base       仅区分基本字母（a=A=á=Á）',
      '  accent     区分重音但不区分大小写（a=A, á≠a）',
      '  case       区分大小写但不区分重音（a≠A, á=a）',
      '  variant    区分所有差异（默认，最严格）',
      '',
      '【numeric 选项：数字感知排序】',
      '  const items = ["file1","file2","file10","file20"];',
      "  new Intl.Collator('en', { numeric: false }).compare;",
      '  // file1 < file10 < file2 < file20  （字典序）',
      "  new Intl.Collator('en', { numeric: true }).compare;",
      '  // file1 < file2 < file10 < file20  （数字序）',
      '',
      '【当前环境真实中文排序演示（sample: 张三/李四/王五/阿强/赵六/陈七/奥迪/宝马）】',
      ...collatorLines.length ? collatorLines : ['  （枚举不可用，无演示）'],
      '',
      '【当前环境真实英文排序演示（含重音/大小写）】',
      ...enLines.length ? enLines : ['  （枚举不可用，无演示）'],
    ].join('\n');
    this.setState({ collationInfo: info });
    this._addLog('intl', `collation 枚举完成：${collations ? collations.length : 0} 项，已生成中英文真实排序演示`);
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. collation —— 排序规则枚举与 Collator 多语言排序',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['collation', f.supportedValuesOf],
          ['Collator', f.collator],
        ]),
        h(Tag, { color: 'primary' }, 'collation'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          "Intl.supportedValuesOf('collation') 枚举排序规则（pinyin 拼音序 / stroke 笔画序 / zhuyin 注音序 / big5han Big5 序 / gb2312 国标序 / emoji 表情序 / eor 欧洲序 / standard 默认 / dict 字典序 / phonebk 电话簿序 等）。与 Intl.Collator 配合：new Intl.Collator(locale, { collation, sensitivity, numeric, caseFirst })，sensitivity 取 base/accent/case/variant 控制区分粒度，numeric:true 实现数字感知排序（file2 < file10）。多语言排序：按 locale 切换 collation 实现中文拼音/英文 base 等不同排序策略。",
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('枚举 collation + 中英文排序演示', { type: 'primary', size: 'sm', onClick: () => this._runCollationDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 枚举排序规则
const collations = Intl.supportedValuesOf('collation');
// ['compat', 'dict', 'emoji', 'eor', 'phonebk', 'pinyin', 'standard', ...]

// 与 Intl.Collator 配合
const coll = new Intl.Collator('zh-CN', {
  collation: 'pinyin',      // 拼音排序
  sensitivity: 'variant',   // 'base'|'accent'|'case'|'variant'
  numeric: true,            // 数字感知：file2 < file10
  caseFirst: 'false',       // 'upper'|'lower'|'false'
});
[...items].sort(coll.compare);

// pinyin vs stroke vs big5han 对比
'张三'.localeCompare('赵六', 'zh-CN', { collation: 'pinyin' });  // 按 zhang < zhao
'张三'.localeCompare('赵六', 'zh-CN', { collation: 'stroke' });  // 按笔画数

// 多语言排序工厂
function makeSorter(locale, collation) {
  return new Intl.Collator(locale, { collation, numeric: true }).compare;
}
const sortByZh = makeSorter('zh-CN', 'pinyin');
const sortByEn = makeSorter('en-US', 'standard');

// numeric 数字感知
const items = ['file1', 'file2', 'file10', 'file20'];
items.sort(new Intl.Collator('en', { numeric: true }).compare);
// → ['file1', 'file2', 'file10', 'file20']`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.collationInfo || '（点击按钮查看 collation 枚举与 Collator 多语言排序完整说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 7：实战动态国际化选择器 =====================

  _runSelectorDemo() {
    const f = this._flags();
    this._injectStyle('intl-enum-selector', `
      .intl-enum-selector-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);

    const tzs = this._safeEnum('timeZone');
    const cals = this._safeEnum('calendar');
    const curs = this._safeEnum('currency');

    // 实战：渲染动态选择器 + 持久化偏好
    let prefsLine = '';
    try {
      const defaults = {
        locale: 'zh-CN',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        calendar: 'gregory',
        currency: 'CNY',
        numberingSystem: 'latn',
      };
      prefsLine = JSON.stringify(defaults, null, 2);
    } catch (e) { prefsLine = `（失败：${e.message}）`; }

    // 用 Locale.maximize/minimize 推断偏好
    let maximizeLine = '';
    if (f.intlLocale) {
      try {
        const loc = new Intl.Locale('zh');
        const max = loc.maximize();
        maximizeLine = `Locale('zh').maximize() → language=${max.language}, script=${max.script}, region=${max.region}`;
      } catch (e) { maximizeLine = `失败：${e.message}`; }
    }

    if (!f.supportedValuesOf) {
      this._addLog('warn', 'Intl.supportedValuesOf 不可用，选择器降级到 FALLBACK 数据集');
    }

    const info = [
      '===== 实战动态国际化选择器 + 用户偏好持久化 =====',
      '',
      '【场景：多语言应用的用户偏好设置面板】',
      '  用户可选时区 / 历法 / 货币 / 编号系统，选择后：',
      '  1. 持久化到 localStorage',
      '  2. 用枚举值校验合法性（避免 RangeError）',
      '  3. 应用到 Intl.DateTimeFormat / NumberFormat',
      '  4. 旧浏览器检测能力降级到静态数据',
      '',
      '【枚举数据来源（运行时）】',
      `  timeZone:   ${tzs ? tzs.length : '不可用（降级到 FALLBACK_TIMEZONES）'} 项`,
      `  calendar:   ${cals ? cals.length : '不可用'} 项`,
      `  currency:   ${curs ? curs.length : '不可用'} 项`,
      '',
      '【完整实现代码】',
      "  // 1. 能力检测 + 降级",
      "  const tzList = (typeof Intl.supportedValuesOf === 'function')",
      "    ? Intl.supportedValuesOf('timeZone')",
      '    : FALLBACK_TIMEZONES;',
      '',
      "  const calList = (typeof Intl.supportedValuesOf === 'function')",
      "    ? Intl.supportedValuesOf('calendar')",
      "    : ['gregory', 'chinese', 'buddhist', 'islamic'];",
      '',
      "  const curList = (typeof Intl.supportedValuesOf === 'function')",
      "    ? Intl.supportedValuesOf('currency')",
      "    : ['CNY', 'USD', 'JPY', 'EUR', 'GBP'];",
      '',
      '  // 2. 加载已持久化的用户偏好（带合法性校验）',
      "  const saved = JSON.parse(localStorage.getItem('i18n-prefs') || '{}');",
      "  const prefs = {",
      "    locale:          saved.locale          || navigator.language || 'zh-CN',",
      "    timeZone:        tzList.includes(saved.timeZone) ? saved.timeZone : Intl.DateTimeFormat().resolvedOptions().timeZone,",
      "    calendar:        calList.includes(saved.calendar) ? saved.calendar : 'gregory',",
      "    currency:        curList.includes(saved.currency) ? saved.currency : 'CNY',",
      "    numberingSystem: saved.numberingSystem || 'latn',",
      '  };',
      '',
      '  // 3. 渲染选择器（option 来自枚举值）',
      '  function buildSelect(list, value, onChange) {',
      '    const sel = document.createElement("select");',
      '    list.forEach((v) => sel.add(new Option(v, v, false, v === value)));',
      '    sel.onchange = (e) => {',
      '      onChange(e.target.value);',
      "      localStorage.setItem('i18n-prefs', JSON.stringify(prefs));",
      '    };',
      '    return sel;',
      '  }',
      '',
      '  // 4. 应用偏好到 Intl 构造器',
      '  function applyPrefs() {',
      '    const dtf = new Intl.DateTimeFormat(prefs.locale, {',
      '      timeZone: prefs.timeZone,',
      '      calendar: prefs.calendar,',
      '      numberingSystem: prefs.numberingSystem,',
      '      dateStyle: "full", timeStyle: "medium",',
      '    });',
      '    const nf = new Intl.NumberFormat(prefs.locale, {',
      '      style: "currency", currency: prefs.currency,',
      '    });',
      '    return {',
      '      time: dtf.format(new Date()),',
      '      money: nf.format(1234.56),',
      '    };',
      '  }',
      '',
      '【默认偏好（结合 Intl.DateTimeFormat.resolvedOptions）】',
      '  ' + prefsLine.split('\n').join('\n  '),
      '',
      '【与 Intl.Locale.maximize()/minimize() 协同】',
      '  // 推断用户最可能的完整 locale（LikelySubtags 算法）',
      "  const loc = new Intl.Locale(navigator.language || 'zh');",
      '  const full = loc.maximize();  // 补全 script + region',
      '  // 例：zh → zh-Hans-CN（简体中文-中国）',
      '  // 用补全后的 locale 渲染选择器默认值',
      `  ${maximizeLine || '（Intl.Locale 不可用）'}`,
      '',
      '【检测能力降级清单】',
      '  ✓ supportedValuesOf 可用  → 全部选择器用真实枚举值',
      '  ✗ supportedValuesOf 不可用 → 时区用 FALLBACK_TIMEZONES（18 项）',
      '  ✗ supportedValuesOf 不可用 → 历法用 ["gregory","chinese","buddhist","islamic"]',
      '  ✗ supportedValuesOf 不可用 → 货币用 ["CNY","USD","JPY","EUR","GBP"]',
      '  ✗ Intl.Locale 不可用       → 不调用 maximize/minimize，直接用 navigator.language',
      '  ✗ Intl.DisplayNames 不可用 → 选择器显示原始代码而非本地化名称',
      '',
      '【当前环境真实应用演示】',
      (() => {
        try {
          const prefs = {
            locale: 'zh-CN',
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            calendar: 'gregory',
            currency: 'CNY',
            numberingSystem: 'latn',
          };
          const dtf = new Intl.DateTimeFormat(prefs.locale, {
            timeZone: prefs.timeZone, calendar: prefs.calendar,
            numberingSystem: prefs.numberingSystem, dateStyle: 'full', timeStyle: 'medium',
          });
          const nf = new Intl.NumberFormat(prefs.locale, { style: 'currency', currency: prefs.currency });
          return [
            `  偏好: ${JSON.stringify(prefs)}`,
            `  时间: ${dtf.format(new Date())}`,
            `  货币: ${nf.format(1234.56)}`,
          ].join('\n');
        } catch (e) { return `  （应用失败：${e.message}）`; }
      })(),
    ].join('\n');
    this.setState({ selectorInfo: info });
    this._addLog('intl', `动态国际化选择器演示完成：tz=${tzs ? tzs.length : '降级'} cal=${cals ? cals.length : '降级'} cur=${curs ? curs.length : '降级'}`);

    // 真实渲染选择器到 DOM
    const host = this.el?.querySelector('#intl-enum-selector-host');
    if (host) {
      host.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.className = 'intl-enum-selector';

      const buildSelect = (label, list, value) => {
        const div = document.createElement('div');
        const lab = document.createElement('label');
        lab.textContent = label;
        div.appendChild(lab);
        const sel = document.createElement('select');
        const safeList = list || FALLBACK_TIMEZONES;
        safeList.slice(0, 200).forEach((v) => {
          const opt = document.createElement('option');
          opt.value = v; opt.textContent = v;
          if (v === value) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.onchange = (e) => this._addLog('intl', `${label} 选中: ${e.target.value}`);
        div.appendChild(sel);
        return div;
      };

      try {
        const myTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        wrap.appendChild(buildSelect('时区 (timeZone)', tzs, myTz));
        wrap.appendChild(buildSelect('历法 (calendar)', cals, 'gregory'));
        wrap.appendChild(buildSelect('货币 (currency)', curs, 'CNY'));
        wrap.appendChild(buildSelect('编号 (numberingSystem)', this._safeEnum('numberingSystem'), 'latn'));
      } catch (e) {
        wrap.appendChild(Object.assign(document.createElement('div'), { textContent: `渲染失败：${e.message}` }));
      }
      host.appendChild(wrap);
    }
  }

  _renderCard7() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '7. 实战动态国际化选择器 —— 时区/日历/货币选择 + 偏好持久化 + 降级',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([
          ['supportedValuesOf', f.supportedValuesOf],
          ['Intl.Locale', f.intlLocale],
        ]),
        h(Tag, { color: 'primary' }, '实战'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '实战场景：多语言应用的用户偏好设置面板，动态选择时区/历法/货币/编号系统。完整流程：① 能力检测 + 降级（supportedValuesOf 不可用时用 FALLBACK 静态数据）；② 从 localStorage 加载已持久化偏好，并用枚举值校验合法性（避免 RangeError）；③ 渲染选择器（option 来自枚举值）；④ 应用偏好到 Intl.DateTimeFormat/NumberFormat。与 Intl.Locale.maximize()/minimize() 协同：用 LikelySubtags 算法从 navigator.language 推断最可能的完整 locale（如 zh → zh-Hans-CN）作为选择器默认值。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('渲染动态选择器 + 应用偏好', { type: 'primary', size: 'sm', onClick: () => this._runSelectorDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '真实渲染的选择器（点击按钮加载，option 来自枚举值）：'),
        h('div', { id: 'intl-enum-selector-host', class: 'intl-enum-selector-host' },
          h('span', { class: 'fs-sm text-secondary' }, '（点击按钮动态渲染时区/历法/货币/编号选择器）'),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 1. 能力检测 + 降级
const tzList = (typeof Intl.supportedValuesOf === 'function')
  ? Intl.supportedValuesOf('timeZone')
  : FALLBACK_TIMEZONES;
const calList = (typeof Intl.supportedValuesOf === 'function')
  ? Intl.supportedValuesOf('calendar')
  : ['gregory', 'chinese', 'buddhist', 'islamic'];

// 2. 加载持久化偏好 + 合法性校验
const saved = JSON.parse(localStorage.getItem('i18n-prefs') || '{}');
const prefs = {
  timeZone: tzList.includes(saved.timeZone)
    ? saved.timeZone
    : Intl.DateTimeFormat().resolvedOptions().timeZone,
  calendar: calList.includes(saved.calendar) ? saved.calendar : 'gregory',
  currency: curList.includes(saved.currency) ? saved.currency : 'CNY',
};

// 3. 渲染选择器（option 来自枚举值）
function buildSelect(list, value, onChange) {
  const sel = document.createElement('select');
  list.forEach((v) => sel.add(new Option(v, v, false, v === value)));
  sel.onchange = (e) => {
    onChange(e.target.value);
    localStorage.setItem('i18n-prefs', JSON.stringify(prefs));
  };
  return sel;
}

// 4. 与 Intl.Locale.maximize() 协同推断默认 locale
const full = new Intl.Locale(navigator.language || 'zh').maximize();
// zh → zh-Hans-CN（LikelySubtags 补全）

// 5. 应用偏好到 Intl 构造器
new Intl.DateTimeFormat(prefs.locale, {
  timeZone: prefs.timeZone, calendar: prefs.calendar,
  dateStyle: 'full', timeStyle: 'medium',
}).format(new Date());`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.selectorInfo || '（点击按钮查看动态国际化选择器完整实战说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== Card 8：兼容性与降级 =====================

  _runCompatDemo() {
    const f = this._flags();
    this._injectStyle('intl-enum-compat', `
      .intl-enum-compat-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);

    // 真实检测当前环境的降级路径
    const safe = (fn) => { try { return fn(); } catch { return false; } };
    const fallbackChecks = [
      ['supportedValuesOf', f.supportedValuesOf],
      ['Intl.DateTimeFormat.supportedLocalesOf', safe(() => typeof Intl.DateTimeFormat.supportedLocalesOf === 'function')],
      ['Intl.NumberFormat.supportedLocalesOf', safe(() => typeof Intl.NumberFormat.supportedLocalesOf === 'function')],
      ['Intl.Locale', f.intlLocale],
      ['Intl.DisplayNames', f.displayNames],
    ];

    const info = [
      '===== 兼容性与降级方案 =====',
      '',
      '【浏览器/引擎支持矩阵】',
      '  引擎/浏览器        supportedValuesOf   发布时间      备注',
      '  V8 9.9+ (Chrome 99)     ✓              2022-03      桌面 + Android',
      '  Node.js 18+ (V8 9.9)    ✓              2022-04      full-icu 默认',
      '  Deno 1.18+              ✓              2022-01      V8 内核',
      '  Bun 1.0+                ✓              2023-09      JSC 已支持',
      '  Firefox 122+            ✓              2024-01      长期 flag 后默认',
      '  Safari 17.4+            ✓              2024-03      macOS 14.4+',
      '  iOS Safari 17.4+        ✓              2024-03      iOS 17.4+',
      '  Chrome 98-              ✗                           需 polyfill 或降级',
      '  Firefox 121-            ✗                           需 polyfill 或降级',
      '  Safari 17.3-            ✗                           需 polyfill 或降级',
      '  Node 16- (V8 9.4)       ✗                           需 small-icu 升级',
      '',
      '【当前环境降级能力检测】',
      ...fallbackChecks.map(([name, ok]) => `  ${name.padEnd(40)} ${ok ? '✓ 可用' : '✗ 不可用'}`),
      '',
      '【降级方案 1：Intl.DateTimeFormat.supportedLocalesOf（旧浏览器广泛支持）】',
      '  // 不枚举具体值，但能检测 locale 是否被支持',
      "  Intl.DateTimeFormat.supportedLocalesOf(['zh-CN', 'xx-YY']);",
      "  // → ['zh-CN']  （xx-YY 不支持被过滤）",
      '',
      '  // 局限：只能筛 locale，不能枚举 timeZone / currency / unit 等',
      '  // 用途：用户传入 locale 时校验，配合静态数据使用',
      '',
      '【降级方案 2：静态数据回退（FALLBACK 数据集）】',
      '  // 打包最小静态数据集（体积远小于全量 cldr）',
      '  const FALLBACK_TIMEZONES = [',
      "    'Asia/Shanghai', 'Asia/Tokyo', 'Europe/London',",
      "    'America/New_York', 'America/Los_Angeles', 'UTC',",
      '    // ... 仅覆盖业务需要的常用时区',
      '  ];',
      '',
      '  const FALLBACK_CURRENCIES = [',
      "    'CNY', 'USD', 'JPY', 'EUR', 'GBP', 'KRW',",
      '    // ... 仅覆盖业务需要的常用货币',
      '  ];',
      '',
      '  // 统一封装：枚举 + 降级',
      "  function enumOrFallback(category, fallback) {",
      '    try {',
      "      if (typeof Intl.supportedValuesOf === 'function') {",
      '        const v = Intl.supportedValuesOf(category);',
      '        if (Array.isArray(v) && v.length) return v;',
      '      }',
      '    } catch { /* 降级 */ }',
      '    return fallback;',
      '  }',
      '',
      "  const tz = enumOrFallback('timeZone', FALLBACK_TIMEZONES);",
      "  const cur = enumOrFallback('currency', FALLBACK_CURRENCIES);",
      '',
      '【降级方案 3：@formatjs/intl-utils polyfill（生产推荐）】',
      '  // npm i @formatjs/intl-utils',
      '  //   自动注入 Intl.supportedValuesOf polyfill（基于 cldr 数据）',
      '  import "@formatjs/intl-utils/polyfill";',
      '  // 之后 Intl.supportedValuesOf 全环境可用',
      '',
      '  // 或动态 polyfill（按需加载）',
      '  if (typeof Intl.supportedValuesOf !== "function") {',
      '    await import("@formatjs/intl-utils/polyfill");',
      '  }',
      '  const tz = Intl.supportedValuesOf("timeZone");',
      '',
      '【降级方案 4：CDN polyfill（polyfill.io 风格）',
      '  // 旧方案（注意 polyfill.io 已不可信，2024 年安全事件）',
      '  // 推荐用 cdnjs / unpkg 自托管 polyfill',
      '  <script src="https://unpkg.com/@formatjs/intl-utils@latest/polyfill.min.js"></script>',
      '',
      '【降级方案 5：服务端 BCP 47 注册表 API（极少数场景）',
      '  // 自建后端服务，从 iana-language-subtag-registry 提供数据',
      '  fetch("/api/i18n/timezones").then(r => r.json());',
      '  // 适合：需要与服务端时区/货币数据库同步的场景',
      '',
      '【生产实践：渐进增强 + 特性检测】',
      '  // 1. 优先用 Intl.supportedValuesOf（零体积、随引擎更新）',
      '  // 2. 不支持时用 @formatjs polyfill（~50KB，全量 cldr）',
      '  // 3. polyfill 也不加载时用 FALLBACK 静态数据（业务子集）',
      '  // 4. 永远做 try/catch + typeof 检测，绝不抛异常到用户',
      '',
      '【常见兼容性陷阱】',
      '  1. Safari 17.3- 完全无 supportedValuesOf，iOS 老设备占比高需 polyfill',
      '  2. Firefox 长期 flag，122 才默认开启（2024 前 Firefox 用户基本无）',
      '  3. Node 16 small-icu 模式下 timeZone 可能不全，需 full-icu 构建',
      '  4. 返回值顺序因引擎而异，绝不能依赖索引取特定值',
      '  5. 某些引擎的 currency 不含历史已废止货币（如 ITL 意大利里拉）',
      '  6. polyfill.io 域名 2024-06 被植入恶意代码，必须改用自托管',
      '  7. unit 复合单位（kilometer-per-hour）不在枚举返回值里，需自行拼接',
    ].join('\n');
    this.setState({ compatInfo: info });
    this._addLog('intl', `兼容性检测完成：supportedValuesOf=${f.supportedValuesOf ? '✓' : '✗'}，降级路径已就绪`);
  }

  _renderCard8() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '8. 兼容性与降级 —— 旧浏览器 polyfill + 静态数据回退',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: f.supportedValuesOf ? 'success' : 'error' }, `supportedValuesOf ${f.supportedValuesOf ? '✓' : '✗'}`),
        h(Tag, { color: 'primary' }, '兼容性'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '浏览器支持矩阵：Chrome 99+/Firefox 122+/Safari 17.4+/Node 18+ 原生支持，旧浏览器需降级。5 大降级方案：① Intl.DateTimeFormat.supportedLocalesOf（旧浏览器广泛支持，仅筛 locale）；② 静态数据回退（打包最小 FALLBACK 数据集，体积远小于全量 cldr）；③ @formatjs/intl-utils polyfill（生产推荐，~50KB 全量 cldr）；④ CDN polyfill（注意 polyfill.io 2024-06 安全事件，改用 unpkg 自托管）；⑤ 服务端 BCP 47 注册表 API（极少数场景）。生产实践：渐进增强 + 特性检测，永远 try/catch + typeof 检测，绝不抛异常到用户。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行兼容性检测 + 降级方案演示', { type: 'primary', size: 'sm', onClick: () => this._runCompatDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 统一封装：枚举 + 降级 + try/catch
function enumOrFallback(category, fallback) {
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      const v = Intl.supportedValuesOf(category);
      if (Array.isArray(v) && v.length) return v;
    }
  } catch { /* 降级 */ }
  return fallback;
}
const tz = enumOrFallback('timeZone', FALLBACK_TIMEZONES);
const cur = enumOrFallback('currency', FALLBACK_CURRENCIES);

// 旧浏览器降级：Intl.DateTimeFormat.supportedLocalesOf（仅筛 locale）
Intl.DateTimeFormat.supportedLocalesOf(['zh-CN', 'xx-YY']); // ['zh-CN']

// @formatjs/intl-utils polyfill（生产推荐）
if (typeof Intl.supportedValuesOf !== 'function') {
  await import('@formatjs/intl-utils/polyfill');
}
Intl.supportedValuesOf('timeZone'); // polyfill 后全环境可用

// 浏览器支持矩阵：
//   Chrome 99+ / Firefox 122+ / Safari 17.4+ / Node 18+ → 原生
//   其他 → polyfill 或 FALLBACK 静态数据`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } },
          h('code', {}, s.compatInfo || '（点击按钮查看兼容性与降级方案完整清单）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // ===================== 日志面板 =====================

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
      h('h2', { class: 'section-title' }, 'Intl Enumeration API 实验室 —— Intl.supportedValuesOf'),

      h(Alert, {
        type: 'info',
        message: 'Intl.supportedValuesOf —— 运行时枚举引擎支持的本地化数据（IANA 时区 / ISO 4217 货币 / 历法 / 编号系统 / 计量单位 / 排序规则）',
        description: '演示 ECMA-402 第 13 章 Intl Enumeration API：6 类规范 category 枚举（calendar/collation/currency/numberingSystem/timeZone/unit，含与 Intl.DateTimeFormat/NumberFormat/Locale/Collator/DisplayNames 协同）、timeZone 时区枚举与动态选择器（与 supportedLocalesOf 区别）、calendar/numberingSystem 历法与编号系统（-u-ca-/-nu- 扩展键）、currency/unit ISO 4217 货币与计量单位（含 kilometer-per-hour 复合单位）、language/script/region 非规范 category 的正确处理（RangeError 降级到 DisplayNames + Locale.maximize/minimize）、collation 排序规则与 Collator 多语言排序（pinyin/stroke/emoji/sensitivity/numeric）、实战动态国际化选择器（时区+历法+货币+编号 + localStorage 持久化 + LikelySubtags 推断 + 检测能力降级）、兼容性与降级（5 大方案：supportedLocalesOf/静态 FALLBACK/@formatjs polyfill/CDN/服务端 BCP 47 + 浏览器支持矩阵 Chrome 99+/Firefox 122+/Safari 17.4+/Node 18+）。所有 API 调用前做 typeof 检测，不可用时仅 _addLog("warn") + 设置 info 文本，绝不抛异常。现代 Node.js 可真实枚举，演示结果反映当前环境真实数据。',
      }),

      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,

      h('div', { class: 'feature-grid' },
        this._renderCard1(),
        this._renderCard2(),
        this._renderCard3(),
        this._renderCard4(),
        this._renderCard5(),
        this._renderCard6(),
        this._renderCard7(),
        this._renderCard8(),
      ),

      this._renderLogPanel(),
    ];
  }
}
