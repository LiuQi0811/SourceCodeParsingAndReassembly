// IntlLocalizationPage.js —— 国际化与本地化 API 实验室
// 演示 MDN：Intl.DateTimeFormat、Intl.NumberFormat、Intl.PluralRules、
//           Intl.ListFormat、Intl.RelativeTimeFormat、Intl.DisplayNames、
//           Intl.Segmenter、Intl.Collator、Intl.Locale、
//           Sanitizer API、URLPattern API、Intl.MessageFormat / MF2
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import { Input } from '../../components/ui/Input.js';

// 多语言显示标签
const LOCALES = [
  { code: 'zh-CN', label: '中文（中国）' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'ja-JP', label: '日本語' },
  { code: 'ar-EG', label: 'العربية' },
  { code: 'de-DE', label: 'Deutsch' },
  { code: 'fr-FR', label: 'Français' },
  { code: 'ko-KR', label: '한국어' },
  { code: 'ru-RU', label: 'Русский' },
];

export class IntlLocalizationPage extends Page {
  initialState() {
    return {
      logs: [],
      // Card 1: DateTimeFormat
      dtLocale: 'zh-CN',
      dtStyle: 'full',
      dtResult: '',
      dtPartsResult: '',
      dtRangeResult: '',
      // Card 2: NumberFormat
      numInput: '1234567.89',
      numLocale: 'zh-CN',
      numStyle: 'currency',
      numResult: '',
      numPartsResult: '',
      // Card 3: 小型 Intl API
      pluralResult: '',
      listResult: '',
      relTimeResult: '',
      displayResult: '',
      // Card 4: Segmenter / Collator / Locale
      segInput: 'Hello 世界！你好，今天天气真好。人工智能 AI 是未来。',
      segGranularity: 'word',
      segResult: '',
      collatorResult: '',
      localeResult: '',
      // Card 5: Sanitizer
      sanitizeInput: '<img src=x onerror=alert(1)><script>alert(1)</script><b>safe</b> 文本 <a href="javascript:alert(1)">恶意链接</a> <i>斜体</i>',
      sanitizeOutput: '',
      sanitizeRaw: '',
      sanitizerSupported: typeof Sanitizer !== 'undefined',
      // Card 6: URLPattern
      urlPattern: '/users/:id(\\d+)/posts/:slug',
      urlTest: '/users/42/posts/hello-world',
      urlPatternSupported: typeof URLPattern !== 'undefined',
      urlPatternResult: '',
      // Card 7: Intl.MessageFormat / MF2
      messageFormatInfo: '',
      messageFormatResult: '',
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // 防止 setState 触发重渲染后再次进入 componentDidMount 导致指数级 rAF 爆炸
    if (this._demoInited) return;
    this._demoInited = true;
    // 启动时跑一遍各默认 demo，便于用户立刻看到效果
    this._runDateTime();
    this._runNumberFormat();
    this._runSegmenter();
    this._runSanitize();
    this._runUrlPattern();
    // Card 7: MessageFormat / MF2 能力检测
    const mf = this._flags();
    this.setState({
      messageFormatInfo: [
        `Intl.MessageFormat 构造器: ${mf.messageFormatCtor ? '✓' : '✗'}`,
        `.format() 方法: ${mf.formatMethod ? '✓' : '✗'}`,
        `要求: Chrome 124+ / Edge 124+（ECMA-402 Stage 3 提案 / ICU MessageFormat 2）`,
      ].join('\n'),
    });
    this._runMessageFormatDemo();
    if (!mf.messageFormatCtor) {
      this._addLog('err', '当前浏览器不支持 Intl.MessageFormat / MF2（建议 Chrome 124+）');
    }
    if (!this.state.sanitizerSupported) {
      this._addLog('err', '当前浏览器不支持 Sanitizer API（建议 Chrome 105+/Firefox 83+ 开发版）');
    }
    if (!this.state.urlPatternSupported) {
      this._addLog('err', '当前浏览器不支持 URLPattern API（建议 Chrome 95+ / Edge 95+）');
    }
  }

  componentWillUnmount() {
    // 这些 API 都是无状态的，无需清理
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

  // —— locale 选择器（共用） ——
  _localeSelect(value, onChange) {
    return h('select', {
      class: 'ant-input',
      style: { width: 'auto', padding: '4px 8px' },
      onChange: (e) => onChange(e.target.value),
    },
      ...LOCALES.map((l) => h('option', { value: l.code, selected: l.code === value }, `${l.label}（${l.code}）`)),
    );
  }

  // —— safe 包装：jsdom 不可用时返回 false，绝不抛异常 ——
  _safe(fn) {
    try { return fn(); } catch { return false; }
  }

  // —— 返回 Tag 数组：items = [[label, ok], ...]，展示能力状态（✓/✗） ——
  _caps(items) {
    return items.map(([label, ok]) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  // —— 返回 MessageFormat / MF2 能力标志（供 Card 7 显示） ——
  _flags() {
    return {
      intlAvailable: this._safe(() => typeof window !== 'undefined' && typeof window.Intl !== 'undefined'),
      messageFormatCtor: this._safe(() => typeof window !== 'undefined'
        && typeof window.Intl !== 'undefined'
        && typeof window.Intl.MessageFormat === 'function'),
      formatMethod: this._safe(() => typeof new Intl.MessageFormat('Hello {name}', 'en').format === 'function'),
    };
  }

  // =================== 1. Intl.DateTimeFormat ===================
  _runDateTime() {
    try {
      const { dtLocale, dtStyle } = this.state;
      const now = new Date();
      const opts = dtStyle === 'full'
        ? { dateStyle: 'full', timeStyle: 'medium' }
        : dtStyle === 'long'
          ? { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
          : dtStyle === 'short'
            ? { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }
            : { dateStyle: 'medium', timeStyle: 'short' };
      const fmt = new Intl.DateTimeFormat(dtLocale, opts);
      const result = fmt.format(now);
      this.setState({ dtResult: result });

      // formatToParts
      const parts = fmt.formatToParts(now);
      const partsStr = parts.map((p) => `${p.type}="${p.value}"`).join('  ');
      this.setState({ dtPartsResult: partsStr });

      // formatRange
      const start = now;
      const end = new Date(now.getTime() + 3 * 24 * 3600 * 1000);
      let rangeStr = '';
      try {
        rangeStr = new Intl.DateTimeFormat(dtLocale, { dateStyle: 'medium' }).formatRange(start, end);
      } catch (e) { rangeStr = `formatRange 不支持：${e.message}`; }
      this.setState({ dtRangeResult: rangeStr });

      this._addLog('intl', `DateTimeFormat(${dtLocale}, ${dtStyle}) → ${result}`);
    } catch (err) {
      this._addLog('err', `DateTimeFormat 失败：${err.message}`);
    }
  }

  // =================== 2. Intl.NumberFormat ===================
  _runNumberFormat() {
    try {
      const { numInput, numLocale, numStyle } = this.state;
      const n = Number(numInput);
      if (Number.isNaN(n)) {
        this._addLog('err', `非法数字输入：${numInput}`);
        return;
      }
      let opts = {};
      if (numStyle === 'currency') opts = { style: 'currency', currency: numLocale.startsWith('zh') ? 'CNY' : numLocale.startsWith('ja') ? 'JPY' : numLocale.startsWith('ru') ? 'RUB' : numLocale.startsWith('ko') ? 'KRW' : 'USD' };
      else if (numStyle === 'percent') opts = { style: 'percent' };
      else if (numStyle === 'unit') opts = { style: 'unit', unit: 'kilometer-per-hour' };
      else if (numStyle === 'compact') opts = { notation: 'compact', compactDisplay: 'short' };
      else if (numStyle === 'scientific') opts = { notation: 'scientific' };
      else opts = {};

      const fmt = new Intl.NumberFormat(numLocale, opts);
      const result = fmt.format(n);
      this.setState({ numResult: result });

      // formatToParts
      const parts = fmt.formatToParts(n);
      const partsStr = parts.map((p) => `${p.type}="${p.value}"`).join('  ');
      this.setState({ numPartsResult: partsStr });

      this._addLog('intl', `NumberFormat(${numLocale}, ${numStyle}) → ${result}`);
    } catch (err) {
      this._addLog('err', `NumberFormat 失败：${err.message}`);
    }
  }

  // =================== 3. PluralRules / ListFormat / RelativeTimeFormat / DisplayNames ===================
  _runPluralRules() {
    try {
      const lines = [];
      // 基数（cardinal）
      const cardEn = new Intl.PluralRules('en-US');
      const cardZh = new Intl.PluralRules('zh-CN');
      const cardRu = new Intl.PluralRules('ru-RU'); // 俄语有多种形式：one/few/many/other
      lines.push('【基数 plural】en-US: ' + [0, 1, 2, 5].map((n) => `${n}→${cardEn.select(n)}`).join(', '));
      lines.push('【基数 plural】zh-CN: ' + [0, 1, 2, 5].map((n) => `${n}→${cardZh.select(n)}`).join(', '));
      lines.push('【基数 plural】ru-RU: ' + [1, 2, 5, 21].map((n) => `${n}→${cardRu.select(n)}`).join(', '));

      // 序数（ordinal）
      const ordEn = new Intl.PluralRules('en-US', { type: 'ordinal' });
      const ordSuffix = { one: 'st', two: 'nd', few: 'rd', other: 'th' };
      lines.push('【序数 ordinal】en-US: ' + [1, 2, 3, 4, 11, 21, 22, 23].map((n) => `${n}${ordSuffix[ordEn.select(n)] || ''}`).join(', '));

      this.setState({ pluralResult: lines.join('\n') });
      this._addLog('intl', 'PluralRules 已生成基数 + 序数演示');
    } catch (err) {
      this._addLog('err', `PluralRules 失败：${err.message}`);
    }
  }

  _runListFormat() {
    try {
      const items = ['苹果', '香蕉', '橘子'];
      const lines = [];
      for (const locale of ['zh-CN', 'en-US', 'ja-JP']) {
        for (const type of ['conjunction', 'disjunction']) {
          for (const style of ['long', 'short', 'narrow']) {
            try {
              const fmt = new Intl.ListFormat(locale, { type, style });
              lines.push(`${locale} [${type}/${style}]: ${fmt.format(items)}`);
            } catch (e) { lines.push(`${locale} [${type}/${style}]: 不支持`); }
          }
        }
      }
      this.setState({ listResult: lines.join('\n') });
      this._addLog('intl', 'ListFormat 已生成 18 种组合演示');
    } catch (err) {
      this._addLog('err', `ListFormat 失败：${err.message}`);
    }
  }

  _runRelativeTime() {
    try {
      const lines = [];
      const units = ['year', 'month', 'week', 'day', 'hour', 'minute', 'second'];
      for (const locale of ['zh-CN', 'en-US', 'ja-JP']) {
        const fmt = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
        const row = units.map((u) => fmt.format(-1, u));
        lines.push(`${locale}（numeric:auto, -1）: ${row.join(' / ')}`);
      }
      // numeric: auto vs always
      const fmtAuto = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' });
      const fmtAlways = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'always' });
      lines.push(`\nzh-CN 0 day（auto）: ${fmtAuto.format(0, 'day')}`);
      lines.push(`zh-CN 0 day（always）: ${fmtAlways.format(0, 'day')}`);

      this.setState({ relTimeResult: lines.join('\n') });
      this._addLog('intl', 'RelativeTimeFormat 已生成相对时间演示');
    } catch (err) {
      this._addLog('err', `RelativeTimeFormat 失败：${err.message}`);
    }
  }

  _runDisplayNames() {
    try {
      const lines = [];
      const types = ['region', 'language', 'currency', 'script', 'calendar', 'dateTimeField'];
      for (const type of types) {
        try {
          const dn = new Intl.DisplayNames(['zh-CN'], { type });
          let samples;
          if (type === 'region') samples = ['US', 'CN', 'JP', 'FR'];
          else if (type === 'language') samples = ['en', 'zh', 'ja', 'fr'];
          else if (type === 'currency') samples = ['USD', 'CNY', 'JPY', 'EUR'];
          else if (type === 'script') samples = ['Latn', 'Hans', 'Hant', 'Cyrl'];
          else if (type === 'calendar') samples = ['gregory', 'chinese', 'islamic', 'hebrew'];
          else samples = ['year', 'month', 'day', 'hour'];
          const row = samples.map((s) => `${s}=${dn.of(s)}`).join(', ');
          lines.push(`【${type}】${row}`);
        } catch (e) { lines.push(`【${type}】不支持：${e.message}`); }
      }
      this.setState({ displayResult: lines.join('\n') });
      this._addLog('intl', 'DisplayNames 已生成 6 种类型演示');
    } catch (err) {
      this._addLog('err', `DisplayNames 失败：${err.message}`);
    }
  }

  // =================== 4. Segmenter / Collator / Locale ===================
  _runSegmenter() {
    try {
      if (typeof Intl.Segmenter === 'undefined') {
        this.setState({ segResult: 'Intl.Segmenter 不支持（建议 Chrome 87+）' });
        this._addLog('err', 'Intl.Segmenter 不支持');
        return;
      }
      const { segInput, segGranularity } = this.state;
      const segmenter = new Intl.Segmenter('zh', { granularity: segGranularity });
      const segments = Array.from(segmenter.segment(segInput));
      const lines = segments.map((s, i) => `[${i}] segment="${s.segment}"  isWordLike=${s.isWordLike ?? '-'}  index=${s.index}`);
      this.setState({ segResult: lines.join('\n') });
      this._addLog('intl', `Segmenter(granularity=${segGranularity}) 已分出 ${segments.length} 段`);
    } catch (err) {
      this._addLog('err', `Segmenter 失败：${err.message}`);
    }
  }

  _runCollator() {
    try {
      const lines = [];
      // numeric: true 让 "file10" > "file2"
      const files = ['file1', 'file10', 'file2', 'file20', 'file3'];
      const sortNumeric = [...files].sort(new Intl.Collator('en', { numeric: true }).compare);
      const sortLexical = [...files].sort(new Intl.Collator('en', { numeric: false }).compare);
      lines.push(`原始: ${files.join(', ')}`);
      lines.push(`numeric:true  → ${sortNumeric.join(', ')}`);
      lines.push(`numeric:false → ${sortLexical.join(', ')}`);

      // sensitivity: base 忽略大小写和重音
      const cBase = new Intl.Collator('en', { sensitivity: 'base' });
      const cAccent = new Intl.Collator('en', { sensitivity: 'accent' });
      const cCase = new Intl.Collator('en', { sensitivity: 'case' });
      lines.push(`\nsensitivity:base   "a" vs "A" → ${cBase.compare('a', 'A')}（0=相等）`);
      lines.push(`sensitivity:accent "a" vs "á" → ${cAccent.compare('a', 'á')}`);
      lines.push(`sensitivity:case   "a" vs "A" → ${cCase.compare('a', 'A')}`);

      // 中文拼音排序
      const zh = ['赵', '钱', '孙', '李', '周', '吴', '郑', '王'];
      const zhSorted = [...zh].sort(new Intl.Collator('zh-Hans-CN-u-co-pinyin').compare);
      lines.push(`\n中文拼音排序:`);
      lines.push(`原始: ${zh.join(' ')}`);
      lines.push(`拼音: ${zhSorted.join(' ')}`);

      this.setState({ collatorResult: lines.join('\n') });
      this._addLog('intl', 'Collator 已生成 numeric / sensitivity / 拼音排序演示');
    } catch (err) {
      this._addLog('err', `Collator 失败：${err.message}`);
    }
  }

  _runLocale() {
    try {
      const lines = [];
      // 含 Unicode 扩展的 locale
      const localeStr = 'zh-Hans-CN-u-nu-hanidec-ca-chinese-hc-h12';
      const loc = new Intl.Locale(localeStr);
      lines.push(`locale string: ${localeStr}`);
      lines.push(`language:       ${loc.language}`);
      lines.push(`script:         ${loc.script}`);
      lines.push(`region:         ${loc.region}`);
      lines.push(`baseName:       ${loc.baseName}`);
      lines.push(`calendar:       ${loc.calendar}`);
      lines.push(`numberingSystem: ${loc.numberingSystem}`);
      lines.push(`hourCycle:      ${loc.hourCycle}`);
      try { lines.push(`textInfo:       ${JSON.stringify(loc.textInfo)}`); } catch { lines.push('textInfo:       不支持'); }
      try { lines.push(`weekInfo:       ${JSON.stringify(loc.weekInfo)}`); } catch { lines.push('weekInfo:       不支持'); }
      try { lines.push(`calendars:      ${JSON.stringify(loc.calendars)}`); } catch { lines.push('calendars:      不支持'); }

      // 链式构造：minimize / maximize
      const min = new Intl.Locale('zh-Hans-CN', { region: 'CN' }).minimize();
      const max = new Intl.Locale('zh', { script: 'Hans', region: 'CN' }).maximize();
      lines.push(`\nminimize('zh-Hans-CN') → ${min.baseName}`);
      lines.push(`maximize('zh')         → ${max.baseName}`);

      this.setState({ localeResult: lines.join('\n') });
      this._addLog('intl', 'Intl.Locale 已生成解析与 minimize/maximize 演示');
    } catch (err) {
      this._addLog('err', `Intl.Locale 失败：${err.message}`);
    }
  }

  // =================== 5. Sanitizer API ===================
  _runSanitize() {
    const { sanitizeInput, sanitizerSupported } = this.state;
    if (!sanitizerSupported) {
      // 兜底：手工剥掉 script/onerror/javascript: —— 仅用于演示，绝不可在生产用
      let cleaned = sanitizeInput
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
        .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
        .replace(/javascript:/gi, '');
      this.setState({ sanitizeOutput: cleaned, sanitizeRaw: sanitizeInput });
      this._addLog('sanitize', 'Sanitizer 不支持，已用降级正则剥离 script/事件处理器');
      return;
    }
    try {
      // 自定义配置：仅允许 b/i/em/strong/a，a 仅允许 href
      const sanitizer = new Sanitizer({
        allowElements: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
        allowAttributes: { a: ['href'] },
        blockElements: ['script', 'img'],
        dropElements: ['script'],
      });
      // sanitizeFor 返回 sanitized 的 Element
      const div = sanitizer.sanitizeFor('div', sanitizeInput);
      this.setState({ sanitizeOutput: div.innerHTML, sanitizeRaw: sanitizeInput });
      this._addLog('sanitize', `已用 Sanitizer 净化（输出 ${div.innerHTML.length} 字符）`);
    } catch (err) {
      this._addLog('err', `Sanitizer 失败：${err.message}`);
    }
  }

  // =================== 6. URLPattern API ===================
  _runUrlPattern() {
    const { urlPattern, urlTest, urlPatternSupported } = this.state;
    if (!urlPatternSupported) {
      this.setState({ urlPatternResult: 'URLPattern 不支持（建议 Chrome 95+）' });
      this._addLog('err', 'URLPattern 不支持');
      return;
    }
    try {
      const pattern = new URLPattern({ pathname: urlPattern });
      const testResult = pattern.test({ pathname: urlTest });
      const lines = [];
      lines.push(`pattern:  ${urlPattern}`);
      lines.push(`test url: ${urlTest}`);
      lines.push(`test():   ${testResult}`);
      if (testResult) {
        const exec = pattern.exec({ pathname: urlTest });
        lines.push(`\nexec() 结果:`);
        lines.push(`pathname.input:    ${exec.pathname.input}`);
        lines.push(`pathname.groups:   ${JSON.stringify(exec.pathname.groups)}`);
      }
      this.setState({ urlPatternResult: lines.join('\n') });
      this._addLog('urlpattern', `URLPattern test(${urlTest}) → ${testResult}`);
    } catch (err) {
      this._addLog('err', `URLPattern 失败：${err.message}`);
    }
  }

  // =================== 7. Intl.MessageFormat / MF2 ===================
  _runMessageFormatDemo() {
    const flags = this._flags();
    if (!flags.messageFormatCtor) {
      this.setState({
        messageFormatResult: [
          'Intl.MessageFormat 不支持（建议 Chrome 124+，ECMA-402 Stage 3 提案 / ICU MF2）',
          '',
          '本演示需要原生 Intl.MessageFormat。下方「MF2 消息语法」与「实战示例」',
          '展示了预期行为；在支持的浏览器中点击「运行 MF2 演示」可看到真实输出。',
        ].join('\n'),
      });
      this._addLog('err', 'Intl.MessageFormat / MF2 不支持（建议 Chrome 124+）');
      return;
    }
    try {
      const lines = [];
      // 通用：优先用 format()，不可用则回退到 formatToParts()
      const fmt = (mf, values) => {
        if (typeof mf.format === 'function') return mf.format(values);
        return JSON.stringify(mf.formatToParts(values));
      };

      // 1. 简单变量插值
      const mf1 = new Intl.MessageFormat('Hello, {name}!', 'en');
      lines.push('【1. 简单变量 {name}】');
      lines.push('  模板: Hello, {name}!');
      lines.push(`  → ${fmt(mf1, { name: 'Alice' })}`);

      // 2. 复数 plural
      const mf2 = new Intl.MessageFormat(
        'You have {count, plural, one {# item} other {# items}}.', 'en',
      );
      lines.push('\n【2. 复数 plural】');
      lines.push('  模板: You have {count, plural, one {# item} other {# items}}.');
      [0, 1, 5].forEach((n) => {
        try { lines.push(`  count=${n}: ${fmt(mf2, { count: n })}`); }
        catch (e) { lines.push(`  count=${n}: 错误 ${e.message}`); }
      });

      // 3. 序数 selectordinal
      const mf3 = new Intl.MessageFormat(
        '{pos, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}', 'en',
      );
      lines.push('\n【3. 序数 selectordinal】');
      lines.push('  模板: {pos, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}');
      [1, 2, 3, 4, 11].forEach((n) => {
        try { lines.push(`  pos=${n}: ${fmt(mf3, { pos: n })}`); }
        catch (e) { lines.push(`  pos=${n}: 错误 ${e.message}`); }
      });

      // 4. 选择 select
      const mf4 = new Intl.MessageFormat(
        '{gender, select, male {he} female {she} other {they}}', 'en',
      );
      lines.push('\n【4. 选择 select】');
      lines.push('  模板: {gender, select, male {he} female {she} other {they}}');
      ['male', 'female', 'unknown'].forEach((g) => {
        try { lines.push(`  gender=${g}: ${fmt(mf4, { gender: g })}`); }
        catch (e) { lines.push(`  gender=${g}: 错误 ${e.message}`); }
      });

      // 5. 函数调用：number + currency
      try {
        const mf5 = new Intl.MessageFormat('Price: {price, number, ::currency/USD}', 'en');
        lines.push('\n【5. 函数 ::currency/USD】');
        lines.push('  模板: Price: {price, number, ::currency/USD}');
        lines.push(`  price=1234.56: ${fmt(mf5, { price: 1234.56 })}`);
      } catch (e) { lines.push(`\n【5. 函数 ::currency/USD】错误: ${e.message}`); }

      // 6. 函数调用：datetime + skeleton
      try {
        const mf6 = new Intl.MessageFormat('Today is {date, datetime, ::yMd}', 'en');
        lines.push('\n【6. 函数 ::yMd (datetime)】');
        lines.push('  模板: Today is {date, datetime, ::yMd}');
        lines.push(`  date=2024-06-01: ${fmt(mf6, { date: new Date('2024-06-01') })}`);
      } catch (e) { lines.push(`\n【6. 函数 ::yMd】错误: ${e.message}`); }

      this.setState({ messageFormatResult: lines.join('\n') });
      this._addLog('intl', 'Intl.MessageFormat / MF2 演示已生成（6 类语法）');
    } catch (err) {
      this._addLog('err', `Intl.MessageFormat 演示失败：${err.message}`);
    }
  }

  // —— Card 7：Intl.MessageFormat / MF2 专题卡 ——
  _renderCard9() {
    const flags = this._flags();
    return h(Card, {
      title: '7. Intl.MessageFormat / MF2 — 结构化消息（ECMA-402 Stage 3）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'MessageFormat'),
        h(Tag, { color: 'success' }, 'MF2'),
        h(Tag, { color: 'warning' }, 'Stage 3'),
      ),
    },
      h('div', { class: 'flex flex-col gap-sm' },
        h('p', { class: 'fs-sm text-secondary' },
          'Intl.MessageFormat 是 ICU MessageFormat 2（MF2）的 JS 原生实现，ECMA-402 Stage 3 提案，Chrome 124+ 起支持。与 ListFormat/PluralRules 等「单一功能」API 不同，MessageFormat 是「结构化消息」：一条消息内组合变量插值 / 复数 / 选择 / 函数调用，是 i18n 消息系统的基石。'),

        // 能力检测
        h('div', { class: 'flex gap-xs flex-wrap' },
          ...this._caps([
            ['Intl.MessageFormat', flags.messageFormatCtor],
            ['.format()', flags.formatMethod],
          ]),
        ),
        !flags.messageFormatCtor
          ? h(Alert, { type: 'warning', message: '当前浏览器不支持 Intl.MessageFormat / MF2（建议 Chrome 124+）。下方按钮可查看能力检测与降级说明。' })
          : null,
        h('pre', { class: 'code-block' }, this.state.messageFormatInfo || '—'),

        // MF2 消息语法
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'MF2 消息语法：'),
        h('pre', { class: 'code-block' }, [
          '// 构造：new Intl.MessageFormat(message, locales, options)',
          "const mf = new Intl.MessageFormat('Hello {name}', 'en');",
          'mf.formatToParts({ name: "Alice" });  // 字符串 + 变量 part 拆分',
          "mf.format({ name: 'Alice' });          // 拼好的字符串（若实现）",
          '',
          '{name}                                          // 简单变量插值',
          '{count, plural, one {item} other {items}}       // 复数（# 代表数值）',
          '{pos, selectordinal, one {#st} other {#th}}     // 序数',
          '{gender, select, male {he} female {she} other {they}}  // 选择',
          '{date, datetime, ::yMd}                         // 函数（datetime + skeleton）',
          '{price, number, ::currency/USD}                 // number + currency 选项',
        ].join('\n')),

        // MF2 vs MF1
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'MF2 vs MessageFormat 1：'),
        h('pre', { class: 'code-block' }, [
          'MF1 (messageformat 库)        MF2 (Intl.MessageFormat)',
          '─────────────────────────     ────────────────────────────',
          '社区库，非标准                  ECMA-402 Stage 3 标准化',
          '字符串模板 + JS DSL            函数式语法 (function, arg)',
          '自行实现复数/选择              复用 Intl.PluralRules / NumberFormat',
          '与 Intl API 平行              与 Intl API 深度集成',
          '需预编译为 JS                  浏览器原生运行时',
          '工具链成熟（@formatjs）        工具链建设中，长期统一',
        ].join('\n')),

        // i18n 实战
        h('div', { class: 'fs-sm text-secondary mt-sm' }, 'i18n 消息系统实战：'),
        h('pre', { class: 'code-block' }, [
          '// 翻译资源 JSON（按 locale 组织）',
          '{',
          '  "en": {',
          '    "greeting": "Hello, {name}!",',
          '    "items": "You have {count, plural, one {# item} other {# items}}"',
          '  },',
          '  "zh": {',
          '    "greeting": "你好，{name}！",',
          '    "items": "你有 {count, plural, other {# 件物品}}"',
          '  }',
          '}',
          '',
          '// 动态 locale 切换',
          'function t(locale, key, values) {',
          '  const mf = new Intl.MessageFormat(messages[locale][key], locale);',
          '  return mf.format(values);  // 富文本场景用 formatToParts',
          '}',
          '',
          '// 框架集成：',
          '// - React Intl (@formatjs/intl): 已对齐 MF2 资源格式',
          '// - Vue I18n v9+: message resolver 与 MF2 语法靠近',
          '// - vs i18next: 用自有插值 {{name}}，不直接复用 Intl；',
          '//   MF2 是原生标准，长期看会统一消息格式生态',
          '// - vs messageformat 库: MF1 实现，需预编译；',
          '//   Intl.MessageFormat 是运行时原生，无需编译步骤',
        ].join('\n')),

        // 运行按钮 + 结果
        h('div', { class: 'demo-row' },
          this._btn('运行 MF2 演示', { type: 'primary', size: 'sm', onClick: () => this._runMessageFormatDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '运行结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px' } }, this.state.messageFormatResult || '（点击「运行 MF2 演示」）'),
      ),
    );
  }

  renderPage() {
    return [
      h('h2', { class: 'section-title' }, '国际化 / 本地化 / 字符串 API 实验室'),
      h('p', { class: 'text-secondary mb-lg' },
        '演示 Intl 全家桶（DateTimeFormat / NumberFormat / PluralRules / ListFormat / RelativeTimeFormat / DisplayNames / Segmenter / Collator / Locale / MessageFormat MF2）、Sanitizer API、URLPattern API。'),

      // ============ 1. Intl.DateTimeFormat ============
      h(Card, {
        title: '1. Intl.DateTimeFormat — 日期/时间格式化',
        extra: h('div', { class: 'flex gap-xs' },
          h(Tag, { color: 'primary' }, 'DateTimeFormat'),
          h(Tag, { color: 'success' }, 'formatToParts'),
          h(Tag, { color: 'warning' }, 'formatRange'),
        ),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            '根据 locale 与 options 把 Date 格式化为字符串；formatToParts 暴露每个字段；formatRange 处理区间。'),
          h('div', { class: 'demo-row' },
            h('span', { class: 'demo-row__label' }, 'Locale'),
            this._localeSelect(this.state.dtLocale, (v) => { this.setState({ dtLocale: v }); }),
          ),
          h('div', { class: 'demo-row' },
            h('span', { class: 'demo-row__label' }, '样式'),
            h('select', {
              class: 'ant-input', style: { width: 'auto', padding: '4px 8px' },
              onChange: (e) => this.setState({ dtStyle: e.target.value }),
            },
              h('option', { value: 'full', selected: this.state.dtStyle === 'full' }, 'full（dateStyle+timeStyle）'),
              h('option', { value: 'long', selected: this.state.dtStyle === 'long' }, 'long（字段化）'),
              h('option', { value: 'medium', selected: this.state.dtStyle === 'medium' }, 'medium'),
              h('option', { value: 'short', selected: this.state.dtStyle === 'short' }, 'short（hour12:false）'),
            ),
            this._btn('格式化', { type: 'primary', size: 'sm', onClick: () => this._runDateTime() }),
          ),
          h('div', { class: 'fs-sm text-secondary' }, '结果：'),
          h('div', { class: 'api-metric', style: { fontSize: '24px' } }, this.state.dtResult || '—'),
          h('div', { class: 'fs-sm text-secondary mt-sm' }, 'formatToParts：'),
          h('pre', { class: 'code-block' }, this.state.dtPartsResult || '—'),
          h('div', { class: 'fs-sm text-secondary mt-sm' }, 'formatRange（now → now+3d）：'),
          h('pre', { class: 'code-block' }, this.state.dtRangeResult || '—'),
        ),
      ),

      // ============ 2. Intl.NumberFormat ============
      h(Card, {
        title: '2. Intl.NumberFormat — 数字 / 货币 / 百分比 / 单位',
        extra: h('div', { class: 'flex gap-xs' },
          h(Tag, { color: 'primary' }, 'NumberFormat'),
          h(Tag, { color: 'success' }, 'compact'),
          h(Tag, { color: 'warning' }, 'currency'),
        ),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            '支持 style: decimal / currency / percent / unit；notation: standard / scientific / compact；signDisplay / useGrouping 等。'),
          h('div', { class: 'demo-row' },
            h('span', { class: 'demo-row__label' }, '数字'),
            h(Input, {
              value: this.state.numInput,
              style: { width: '180px' },
              onInput: (e) => this.setState({ numInput: e.target.value }),
            }),
          ),
          h('div', { class: 'demo-row' },
            h('span', { class: 'demo-row__label' }, 'Locale'),
            this._localeSelect(this.state.numLocale, (v) => { this.setState({ numLocale: v }); }),
          ),
          h('div', { class: 'demo-row' },
            h('span', { class: 'demo-row__label' }, '样式'),
            h('select', {
              class: 'ant-input', style: { width: 'auto', padding: '4px 8px' },
              onChange: (e) => this.setState({ numStyle: e.target.value }),
            },
              ['currency', 'decimal', 'percent', 'unit', 'compact', 'scientific'].map((s) =>
                h('option', { value: s, selected: this.state.numStyle === s }, s),
              ),
            ),
            this._btn('格式化', { type: 'primary', size: 'sm', onClick: () => this._runNumberFormat() }),
          ),
          h('div', { class: 'fs-sm text-secondary' }, '结果：'),
          h('div', { class: 'api-metric', style: { fontSize: '28px' } }, this.state.numResult || '—'),
          h('div', { class: 'fs-sm text-secondary mt-sm' }, 'formatToParts：'),
          h('pre', { class: 'code-block' }, this.state.numPartsResult || '—'),
        ),
      ),

      // ============ 3. 小型 Intl API ============
      h(Card, {
        title: '3. PluralRules / ListFormat / RelativeTimeFormat / DisplayNames',
        extra: h('div', { class: 'flex gap-xs' },
          h(Tag, { color: 'primary' }, 'PluralRules'),
          h(Tag, { color: 'primary' }, 'ListFormat'),
          h(Tag, { color: 'primary' }, 'RelativeTimeFormat'),
          h(Tag, { color: 'primary' }, 'DisplayNames'),
        ),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'PluralRules：基数/序数规则（俄语有 few/many 等多形式）；ListFormat：列表连接词；RelativeTimeFormat：相对时间（昨天/明天）；DisplayNames：区域/语言/货币等本地化名称。'),
          h('div', { class: 'flex gap-sm flex-wrap' },
            this._btn('PluralRules', { type: 'primary', size: 'sm', onClick: () => this._runPluralRules() }),
            this._btn('ListFormat', { type: 'primary', size: 'sm', onClick: () => this._runListFormat() }),
            this._btn('RelativeTimeFormat', { type: 'primary', size: 'sm', onClick: () => this._runRelativeTime() }),
            this._btn('DisplayNames', { type: 'primary', size: 'sm', onClick: () => this._runDisplayNames() }),
          ),
          h('div', { class: 'fs-sm text-secondary' }, 'PluralRules 结果：'),
          h('pre', { class: 'code-block' }, this.state.pluralResult || '（点击 PluralRules）'),
          h('div', { class: 'fs-sm text-secondary mt-sm' }, 'ListFormat 结果：'),
          h('pre', { class: 'code-block' }, this.state.listResult || '（点击 ListFormat）'),
          h('div', { class: 'fs-sm text-secondary mt-sm' }, 'RelativeTimeFormat 结果：'),
          h('pre', { class: 'code-block' }, this.state.relTimeResult || '（点击 RelativeTimeFormat）'),
          h('div', { class: 'fs-sm text-secondary mt-sm' }, 'DisplayNames 结果：'),
          h('pre', { class: 'code-block' }, this.state.displayResult || '（点击 DisplayNames）'),
        ),
      ),

      // ============ 4. Segmenter / Collator / Locale ============
      h(Card, {
        title: '4. Intl.Segmenter / Intl.Collator / Intl.Locale',
        extra: h('div', { class: 'flex gap-xs' },
          h(Tag, { color: 'success' }, 'Segmenter'),
          h(Tag, { color: 'success' }, 'Collator'),
          h(Tag, { color: 'success' }, 'Locale'),
        ),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'Segmenter：按 grapheme / word / sentence 切分字符串（中日韩友好）；Collator：本地化字符串比较与排序（numeric/sensitivity/拼音）；Intl.Locale：解析 locale 与 Unicode 扩展。'),
          h('div', { class: 'demo-row' },
            h('span', { class: 'demo-row__label' }, '切分粒度'),
            h('select', {
              class: 'ant-input', style: { width: 'auto', padding: '4px 8px' },
              onChange: (e) => this.setState({ segGranularity: e.target.value }),
            },
              ['word', 'grapheme', 'sentence'].map((g) =>
                h('option', { value: g, selected: this.state.segGranularity === g }, g),
              ),
            ),
            this._btn('切分', { type: 'primary', size: 'sm', onClick: () => this._runSegmenter() }),
            this._btn('Collator', { type: 'primary', size: 'sm', onClick: () => this._runCollator() }),
            this._btn('Locale', { type: 'primary', size: 'sm', onClick: () => this._runLocale() }),
          ),
          h('div', { class: 'demo-row' },
            h('span', { class: 'demo-row__label' }, '切分输入'),
            h(Input, {
              value: this.state.segInput,
              style: { flex: '1', minWidth: '240px' },
              onInput: (e) => this.setState({ segInput: e.target.value }),
            }),
          ),
          h('div', { class: 'fs-sm text-secondary' }, 'Segmenter 结果（按行展示每段）：'),
          h('pre', { class: 'code-block', style: { maxHeight: '200px' } }, this.state.segResult || '—'),
          h('div', { class: 'fs-sm text-secondary mt-sm' }, 'Collator 结果：'),
          h('pre', { class: 'code-block' }, this.state.collatorResult || '（点击 Collator）'),
          h('div', { class: 'fs-sm text-secondary mt-sm' }, 'Intl.Locale 解析结果：'),
          h('pre', { class: 'code-block' }, this.state.localeResult || '（点击 Locale）'),
        ),
      ),

      // ============ 5. Sanitizer API ============
      h(Card, {
        title: '5. Sanitizer API — HTML 净化',
        extra: h(Tag, { color: 'warning' }, 'Sanitizer'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'Sanitizer API 在浏览器内原生净化 HTML，移除 script/事件处理器/javascript: 等危险内容，仅保留白名单元素与属性。sanitizeFor 返回 Element；Element.setHTML 是另一种用法。'),
          !this.state.sanitizerSupported
            ? h(Alert, { type: 'warning', message: '当前浏览器不支持 Sanitizer API，下方使用降级正则剥离（仅供演示，不可在生产用）' })
            : null,
          h('div', { class: 'demo-row' },
            h('span', { class: 'demo-row__label' }, '恶意 HTML'),
            h(Input, {
              value: this.state.sanitizeInput,
              style: { flex: '1', minWidth: '320px' },
              onInput: (e) => this.setState({ sanitizeInput: e.target.value }),
            }),
            this._btn('净化', { type: 'primary', size: 'sm', onClick: () => this._runSanitize() }),
          ),
          h('div', { class: 'fs-sm text-secondary' }, '原始 HTML（已转义显示）：'),
          h('pre', { class: 'code-block' }, this.state.sanitizeRaw || '—'),
          h('div', { class: 'fs-sm text-secondary mt-sm' }, '净化后 HTML（已安全渲染）：'),
          h('div', {
            class: 'code-block sanitize-output',
            style: { background: 'var(--color-bg-spotlight)', padding: 'var(--spacing-md)' },
            html: this.state.sanitizeOutput || '—',
          }),
        ),
      ),

      // ============ 6. URLPattern API ============
      h(Card, {
        title: '6. URLPattern API — URL 模式匹配',
        extra: h(Tag, { color: 'warning' }, 'URLPattern'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'URLPattern 类似 path-to-regexp，但支持 protocol/host/pathname 全字段；:name 命名组、:name(regex) 正则约束、* 通配；test() 返回布尔，exec() 返回分组详情。'),
          !this.state.urlPatternSupported
            ? h(Alert, { type: 'warning', message: '当前浏览器不支持 URLPattern API（建议 Chrome 95+ / Edge 95+）' })
            : null,
          h('div', { class: 'demo-row' },
            h('span', { class: 'demo-row__label' }, '模式'),
            h(Input, {
              value: this.state.urlPattern,
              style: { flex: '1', minWidth: '240px' },
              onInput: (e) => this.setState({ urlPattern: e.target.value }),
            }),
          ),
          h('div', { class: 'demo-row' },
            h('span', { class: 'demo-row__label' }, '测试 URL'),
            h(Input, {
              value: this.state.urlTest,
              style: { flex: '1', minWidth: '240px' },
              onInput: (e) => this.setState({ urlTest: e.target.value }),
            }),
            this._btn('匹配', { type: 'primary', size: 'sm', onClick: () => this._runUrlPattern() }),
          ),
          h('div', { class: 'fs-sm text-secondary' }, '结果：'),
          h('pre', { class: 'code-block' }, this.state.urlPatternResult || '—'),
        ),
      ),

      // ============ 7. Intl.MessageFormat / MF2 ============
      this._renderCard9(),

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
