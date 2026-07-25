// =====================================================================
// TemporalAPIPage.js —— Temporal API 实验室
// 演示（TC39 Stage 3 提案，Chrome 130+ 已发布，旨在替代 Date）：
//   1. Temporal.Now —— 当前时刻入口（instant / zonedDateTimeISO /
//      plainDateISO / plainTimeISO / timezone）
//   2. PlainDate / PlainTime / PlainDateTime —— 无时区日期时间
//      （构造、year/month/day 等属性、with / add / subtract /
//      until / since）
//   3. ZonedDateTime —— 带时区的日期时间
//      （from / 构造、timeZoneId / offset / toInstant / toPlainDateTime /
//      withTimeZone 时区转换、与 Date.toISOString 对比）
//   4. Duration —— 时间段
//      （构造 P1Y2M3DT4H5M、from、add / subtract / round / total /
//      negated / abs、与 PlainDate.add 配合）
//   5. Instant —— 绝对时间点（UTC 纳秒精度）
//      （from / fromEpochSeconds/Milliseconds/Microseconds/Nanoseconds、
//      add / subtract / until / since / toZonedDateTimeISO / toString、
//      纳秒精度 vs Date 毫秒精度）
//   6. 解析、格式化、比较与 vs Date 对比
//      （from 字符串/对象/overflow、toLocaleString / toString /
//      与 Intl.DateTimeFormat 协同、compare 静态方法排序、
//      until/since 算差值、vs Date 对比表）
// 说明：Temporal 为 TC39 Stage 3 提案，Chrome 130+ / 较新 V8 已内置，
//       但 jsdom/Node 通常不可用。所有 API 调用前做 typeof 能力检测，
//       不可用时仅记日志（_addLog('warn', ...)），绝不抛异常。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class TemporalAPIPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      nowResult: '',            // Card 1：Temporal.Now
      plainResult: '',          // Card 2：PlainDate/PlainTime/PlainDateTime
      zdtResult: '',            // Card 3：ZonedDateTime
      durationResult: '',       // Card 4：Duration
      instantResult: '',        // Card 5：Instant
      parseResult: '',          // Card 6：解析、格式化、比较与 vs Date 对比
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    const caps = this._caps();
    const parts = [
      `Temporal 全局 ${caps.temporal ? '✓' : '✗'}`,
      `Temporal.Now ${caps.now ? '✓' : '✗'}`,
      `Temporal.PlainDate ${caps.plainDate ? '✓' : '✗'}`,
      `Temporal.PlainTime ${caps.plainTime ? '✓' : '✗'}`,
      `Temporal.PlainDateTime ${caps.plainDateTime ? '✓' : '✗'}`,
      `Temporal.ZonedDateTime ${caps.zonedDateTime ? '✓' : '✗'}`,
      `Temporal.Duration ${caps.duration ? '✓' : '✗'}`,
      `Temporal.Instant ${caps.instant ? '✓' : '✗'}`,
    ];
    const allOK = caps.temporal && caps.now && caps.plainDate && caps.plainTime &&
      caps.plainDateTime && caps.zonedDateTime && caps.duration && caps.instant;
    const summary = allOK
      ? `Temporal 能力检测：${parts.join(' · ')}。当前环境已内置 Temporal（Chrome 130+ / 较新 V8），所有按钮可真实演示。`
      : `Temporal 能力检测：${parts.join(' · ')}。Temporal 为 TC39 Stage 3 提案，需 Chrome 130+ 或较新 V8；jsdom/Node 通常不可用，不可用的按钮点击将仅记日志说明，不会抛异常。`;

    this.setState({ capsSummary: summary });
    this._addLog(allOK ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!caps.temporal) this._addLog('warn', 'Temporal 全局对象不可用（typeof Temporal === "undefined"），需 Chrome 130+ / 较新 V8。可用 polyfill：@js-temporal/polyfill');
    if (caps.temporal && !caps.now) this._addLog('warn', 'Temporal.Now 不可用');
    if (caps.temporal && !caps.zonedDateTime) this._addLog('warn', 'Temporal.ZonedDateTime 不可用');
  }

  componentWillUnmount() {
    // 释放实例引用，便于 GC
    this._inited = null;
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

  // —— 同步能力检测（render 时调用，开销可忽略）——
  _caps() {
    const temporal = typeof Temporal !== 'undefined';
    // PlainDate/PlainTime/.../Instant/Duration 均为构造函数
    const hasCtor = (key) => {
      try { return temporal && key in Temporal && typeof Temporal[key] === 'function'; }
      catch { return false; }
    };
    // Temporal.Now 是命名空间对象（类似 Math），非函数，需特殊检测
    const hasNow = () => {
      try {
        return temporal && 'Now' in Temporal &&
          typeof Temporal.Now === 'object' && Temporal.Now !== null &&
          typeof Temporal.Now.instant === 'function';
      } catch { return false; }
    };
    return {
      temporal,
      now: hasNow(),
      plainDate: hasCtor('PlainDate'),
      plainTime: hasCtor('PlainTime'),
      plainDateTime: hasCtor('PlainDateTime'),
      zonedDateTime: hasCtor('ZonedDateTime'),
      duration: hasCtor('Duration'),
      instant: hasCtor('Instant'),
    };
  }

  // =================== Card 1：Temporal.Now —— 当前时刻入口 ===================

  _nowDemo() {
    const caps = this._caps();
    if (!caps.now) {
      this._addLog('warn', 'Temporal.Now 不可用（typeof Temporal === "undefined" 或 Temporal.Now 不存在），需 Chrome 130+。可安装 @js-temporal/polyfill。');
      return;
    }
    try {
      const instant = Temporal.Now.instant();                   // 当前 Instant（UTC 纳秒）
      const zdt = Temporal.Now.zonedDateTimeISO();               // 当前时区 ZonedDateTime
      const pd = Temporal.Now.plainDateISO();                    // 当前 ISO PlainDate
      const pt = Temporal.Now.plainTimeISO();                    // 当前 ISO PlainTime
      // 获取系统时区：规范为 timeZoneISO()（返回 TimeZone 对象），部分 polyfill 用 timeZoneId()（返回字符串）
      let tzDesc;
      if (typeof Temporal.Now.timeZoneISO === 'function') {
        tzDesc = `${Temporal.Now.timeZoneISO().id}（TimeZone 对象，via timeZoneISO()）`;
      } else if (typeof Temporal.Now.timeZoneId === 'function') {
        tzDesc = `${Temporal.Now.timeZoneId()}（字符串，via timeZoneId()）`;
      } else {
        tzDesc = `${zdt.timeZoneId}（从 zdt.timeZoneId 取得）`;
      }
      const legacyNow = new Date();
      this.setState({
        nowResult:
          `Temporal.Now.instant()        → ${instant.toString()}\n` +
          `  epochMilliseconds = ${instant.epochMilliseconds}，epochNanoseconds = ${instant.epochNanoseconds}\n\n` +
          `Temporal.Now.zonedDateTimeISO() → ${zdt.toString()}\n` +
          `  timeZoneId = ${zdt.timeZoneId}，offset = ${zdt.offset}\n\n` +
          `Temporal.Now.plainDateISO()  → ${pd.toString()}（year=${pd.year}，month=${pd.month}，day=${pd.day}）\n` +
          `Temporal.Now.plainTimeISO()  → ${pt.toString()}（hour=${pt.hour}，minute=${pt.minute}，second=${pt.second}）\n\n` +
          `系统时区 → ${tzDesc}\n\n` +
          `vs new Date() = ${legacyNow.toISOString()}\n` +
          `  Date 毫秒精度；Temporal 不可变 + 纳秒精度 + 时区明确。`,
      });
      this._addLog('now', `Temporal.Now.instant() = ${instant.toString().slice(0, 24)}…；时区=${zdt.timeZoneId}`);
    } catch (err) {
      this._addLog('warn', `Temporal.Now 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. Temporal.Now —— 当前时刻入口',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.now ? 'success' : 'error' }, caps.now ? 'Temporal.Now ✓' : '不可用'),
        h(Tag, { color: 'primary' }, '纳秒精度'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Temporal.Now 是获取"当前时刻"的统一入口，提供 5 个方法：instant() 返回 UTC 绝对时间点（Instant，纳秒精度）；zonedDateTimeISO() 返回带系统时区的 ZonedDateTime；plainDateISO() / plainTimeISO() 返回无时区的纯日期/纯时间；timeZoneISO() 返回系统时区对象（部分 polyfill 提供 timeZoneId() 返回字符串）。与 new Date() 相比：Temporal 全部类型不可变、纳秒精度、时区显式声明。检测方式：typeof Temporal !== "undefined" && "Now" in Temporal。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('获取当前时刻', { type: 'primary', size: 'sm', disabled: !caps.now, onClick: () => this._nowDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Temporal.Now 输出：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, s.nowResult || '（点击按钮演示 Temporal.Now；不可用时仅记日志说明）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } },
          h('code', {},
`const inst = Temporal.Now.instant();          // Instant（UTC 纳秒）
const zdt  = Temporal.Now.zonedDateTimeISO(); // 带系统时区
const pd   = Temporal.Now.plainDateISO();     // PlainDate（无时区）
const pt   = Temporal.Now.plainTimeISO();     // PlainTime（无时区）
Temporal.Now.timeZoneISO();  // 规范：返回 TimeZone 对象（.id）
Temporal.Now.timeZoneId();   // 部分 polyfill：直接返回时区字符串
inst.epochNanoseconds;       // 纳秒（Date 仅毫秒）`)),
        h(Alert, {
          type: 'info',
          message: 'Temporal.Now vs new Date()：不可变、纳秒精度、时区显式',
          description: 'new Date() 返回可变对象（setHours 等会改原值）、仅毫秒精度、隐含系统时区易导致跨时区 bug。Temporal.Now.instant() 返回不可变 Instant，纳秒精度，时区信息通过 zonedDateTimeISO() 显式携带。所有 Temporal 类型都是不可变的——修改操作返回新实例。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：PlainDate / PlainTime / PlainDateTime ===================

  _plainDemo() {
    const caps = this._caps();
    if (!caps.plainDate || !caps.plainTime || !caps.plainDateTime) {
      this._addLog('warn', 'Temporal.PlainDate / PlainTime / PlainDateTime 不可用，需 Chrome 130+。这三个类型表示"无时区"的日期/时间/日期时间，适合生日、日历事件等不依赖时区的场景。');
      return;
    }
    try {
      const xmas = new Temporal.PlainDate(2024, 12, 25);              // 2024-12-25
      const time = new Temporal.PlainTime(10, 30, 0);                 // 10:30:00
      const dt = new Temporal.PlainDateTime(2024, 12, 25, 10, 30);    // 2024-12-25T10:30
      // 属性
      const props = `year=${xmas.year}，month=${xmas.month}，day=${xmas.day}，monthCode=${xmas.monthCode}，dayOfWeek=${xmas.dayOfWeek}，dayOfYear=${xmas.dayOfYear}`;
      // with：不可变更新
      const nextYear = xmas.with({ year: 2025 });                     // 2025-12-25
      const isSameRef = xmas === nextYear;                            // false（新实例）
      // add / subtract：加/减 Duration
      const plusWeek = xmas.add(new Temporal.Duration(0, 0, 0, 7));   // 2025-01-01
      const minusDay = xmas.subtract(new Temporal.Duration(0, 0, 0, 1)); // 2024-12-24
      // until / since：算 Duration
      const newYear = new Temporal.PlainDate(2025, 1, 1);
      const untilDays = xmas.until(newYear, { largestUnit: 'day' });  // P7D（7 天）
      const sinceDays = newYear.since(xmas, { largestUnit: 'day' });  // P7D
      this.setState({
        plainResult:
          `new Temporal.PlainDate(2024, 12, 25) → ${xmas.toString()}\n` +
          `  属性：${props}\n\n` +
          `new Temporal.PlainTime(10, 30, 0) → ${time.toString()}\n` +
          `  hour=${time.hour}，minute=${time.minute}，second=${time.second}\n\n` +
          `new Temporal.PlainDateTime(2024, 12, 25, 10, 30) → ${dt.toString()}\n\n` +
          `with({ year: 2025 }) → ${nextYear.toString()}（原 xmas=${xmas.toString()} 不变，同引用=${isSameRef}）\n\n` +
          `add(P7D) → ${plusWeek.toString()}\n` +
          `subtract(P1D) → ${minusDay.toString()}\n\n` +
          `until(2025-01-01, { largestUnit:'day' }) → ${untilDays.toString()}\n` +
          `since(2025-01-01, { largestUnit:'day' }) → ${sinceDays.toString()}\n\n` +
          `说明：Plain* 类型不带时区，适合"日历事件"（生日、节假日）。\n` +
          `  with/add/subtract/until/since 均返回新实例，原对象不变（不可变）。`,
      });
      this._addLog('plain', `PlainDate(2024,12,25).with({year:2025}) = ${nextYear.toString()}；add(P7D) = ${plusWeek.toString()}`);
    } catch (err) {
      this._addLog('warn', `Plain* 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. PlainDate / PlainTime / PlainDateTime —— 无时区日期时间',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.plainDate ? 'success' : 'error' }, caps.plainDate ? 'PlainDate ✓' : 'PlainDate ✗'),
        h(Tag, { color: caps.plainDateTime ? 'success' : 'error' }, caps.plainDateTime ? 'PlainDateTime ✓' : 'PlainDateTime ✗'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '三个"无时区"类型：PlainDate（年月日）、PlainTime（时分秒）、PlainDateTime（年月日时分秒）。构造：new Temporal.PlainDate(year, month, day)。属性：year / month / day / hour / minute / second / monthCode / dayOfWeek / dayOfYear。方法：with(partial) 不可变更新返回新实例；add(Duration) / subtract(Duration) 加减；until(other, options) / since(other, options) 计算 Duration（largestUnit 控制最大单位）。检测：typeof Temporal !== "undefined" && "PlainDate" in Temporal。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('创建并操作 PlainDate', { type: 'primary', size: 'sm', disabled: !caps.plainDate || !caps.plainTime || !caps.plainDateTime, onClick: () => this._plainDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Plain* 演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.plainResult || '（点击按钮演示 PlainDate / PlainTime / PlainDateTime）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } },
          h('code', {},
`const xmas = new Temporal.PlainDate(2024, 12, 25);
xmas.year; xmas.month; xmas.day;            // 2024, 12, 25
xmas.with({ year: 2025 });                  // 2025-12-25（新实例）
xmas.add(new Temporal.Duration(0,0,0,7));   // 2025-01-01（+7 天）
xmas.until(new Temporal.PlainDate(2025,1,1),
  { largestUnit: 'day' });                  // P7D（差 7 天）`)),
        h(Alert, {
          type: 'warning',
          message: 'Plain* 类型不带时区，与 Instant 不可直接运算',
          description: 'PlainDate/PlainTime/PlainDateTime 表示"墙钟时间"（wall time），不带时区，所以无法直接转 epoch。要表示绝对时刻需用 ZonedDateTime 或 Instant。until/since 返回 Duration，可用 largestUnit: \'day\' / \'hour\' 等控制最大单位，避免默认纳秒精度导致冗长输出。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：ZonedDateTime —— 带时区的日期时间 ===================

  _zdtDemo() {
    const caps = this._caps();
    if (!caps.zonedDateTime) {
      this._addLog('warn', 'Temporal.ZonedDateTime 不可用，需 Chrome 130+。该类型同时携带时刻 + 时区，是 Temporal 中功能最完整的日期时间类型，能正确处理夏令时与历史时区变更。');
      return;
    }
    try {
      const zdt = Temporal.ZonedDateTime.from('2024-12-25T10:30:00[Asia/Shanghai]');
      const props = `timeZoneId=${zdt.timeZoneId}，offset=${zdt.offset}，year=${zdt.year}，hour=${zdt.hour}`;
      const inst = zdt.toInstant();                                  // 转 Instant
      const pdt = zdt.toPlainDateTime();                             // 转 PlainDateTime（丢时区）
      // 时区转换：上海 → 纽约
      const nyZdt = zdt.withTimeZone('America/New_York');
      // 与 Date.toISOString 对比
      const legacyIso = new Date(zdt.toInstant().epochMilliseconds).toISOString();
      this.setState({
        zdtResult:
          `Temporal.ZonedDateTime.from('2024-12-25T10:30:00[Asia/Shanghai]')\n` +
          `  toString() = ${zdt.toString()}\n` +
          `  ${props}\n\n` +
          `toInstant() → ${inst.toString()}（绝对时刻）\n` +
          `toPlainDateTime() → ${pdt.toString()}（丢时区）\n\n` +
          `withTimeZone('America/New_York') → ${nyZdt.toString()}\n` +
          `  上海 10:30 = 纽约 ${nyZdt.hour}:${String(nyZdt.minute).padStart(2, '0')}（${nyZdt.offset}）\n\n` +
          `vs Date.toISOString() = ${legacyIso}\n` +
          `  Date 输出 UTC（Z 结尾），丢失原时区；ZonedDateTime 保留时区 + 偏移。\n\n` +
          `说明：ZonedDateTime 同时携带"时刻 + 时区"，能正确处理夏令时（DST）\n` +
          `  与历史时区变更。toString() 格式为 ISO 8601 扩展：[时区名] 后缀。`,
      });
      this._addLog('zdt', `ZonedDateTime 上海→纽约：${zdt.hour}:${zdt.minute} → ${nyZdt.hour}:${nyZdt.minute}（${nyZdt.offset}）`);
    } catch (err) {
      this._addLog('warn', `ZonedDateTime 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. ZonedDateTime —— 带时区的日期时间',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.zonedDateTime ? 'success' : 'error' }, caps.zonedDateTime ? 'ZonedDateTime ✓' : '不可用'),
        h(Tag, { color: 'primary' }, '时区感知'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'ZonedDateTime 同时携带"绝对时刻 + 时区"，是 Temporal 中功能最完整的日期时间类型。创建：Temporal.ZonedDateTime.from("2024-12-25T10:30:00[Asia/Shanghai]") 或 new Temporal.ZonedDateTime(epochNs, timeZone)。属性：timeZoneId / offset / year / month / day / hour 等。方法：toInstant() 转绝对时刻；toPlainDateTime() 丢时区转纯日期时间；withTimeZone(tz) 转换时区（保持同一时刻，仅改变显示）；toString() 输出 ISO 8601 扩展格式（带 [时区名] 后缀）。能正确处理夏令时（DST）与历史时区变更。检测：typeof Temporal !== "undefined" && "ZonedDateTime" in Temporal。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('时区转换演示', { type: 'primary', size: 'sm', disabled: !caps.zonedDateTime, onClick: () => this._zdtDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'ZonedDateTime 演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.zdtResult || '（点击按钮演示 ZonedDateTime 时区转换）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } },
          h('code', {},
`const zdt = Temporal.ZonedDateTime.from(
  '2024-12-25T10:30:00[Asia/Shanghai]');
zdt.timeZoneId;   // 'Asia/Shanghai'
zdt.offset;       // '+08:00'
zdt.toInstant();  // 绝对时刻
// 时区转换：同一时刻，不同显示
zdt.withTimeZone('America/New_York'); // 2024-12-24T21:30:00-05:00[America/New_York]
// 与 Date 对比
new Date(zdt.toInstant().epochMilliseconds).toISOString(); // UTC，丢时区`)),
        h(Alert, {
          type: 'warning',
          message: 'ZonedDateTime 能正确处理夏令时，是跨时区应用的首选',
          description: 'Date 隐含系统时区且无法显式声明，跨时区计算极易出 bug（如"加上 1 天"在 DST 切换日会偏 23/25 小时）。ZonedDateTime.withTimeZone 保持同一绝对时刻仅改显示；add/subtract 按"日历日"而非"86400 秒"运算，DST 切换日也能正确处理。toString() 的 [时区名] 后缀让时区信息可序列化、可往返。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：Duration —— 时间段 ===================

  _durationDemo() {
    const caps = this._caps();
    if (!caps.duration) {
      this._addLog('warn', 'Temporal.Duration 不可用，需 Chrome 130+。Duration 表示"时间段"（年月周日时分秒纳秒），是不可变的、可与 PlainDate/Instant 配合做算术的核心类型。');
      return;
    }
    try {
      const d1 = new Temporal.Duration(1, 2, 0, 3, 4, 5);   // 1年2月3天4时5分（无秒）
      const d2 = Temporal.Duration.from('P1Y2M3DT4H5M');    // 同上（ISO 8601 duration）
      const eq = d1.toString() === d2.toString();            // true
      // add / subtract：用仅含精确单位的 Duration（4h5m），避免日历单位需 relativeTo 的限制
      const exactDur = new Temporal.Duration(0, 0, 0, 0, 4, 5);  // 4 时 5 分（精确单位）
      const sum = exactDur.add(new Temporal.Duration(0, 0, 0, 0, 0, 1));      // +1 分钟 → 4h6m
      const diff = exactDur.subtract(new Temporal.Duration(0, 0, 0, 0, 0, 1)); // -1 分钟 → 4h4m
      // round：规范化/取整（25h70m → 1 天 2 小时 10 分钟）；仅精确单位，无需 relativeTo
      const messy = new Temporal.Duration(0, 0, 0, 0, 25, 70);   // 25h70m
      const rounded = messy.round({ largestUnit: 'day', smallestUnit: 'minute' }); // P1DT2H10M
      // total：转换单位为单一数值；d1 含日历单位（年/月），需 relativeTo 参考点
      const relTo = new Temporal.PlainDate(2024, 1, 1);
      const totalHours = d1.total({ unit: 'hour', relativeTo: relTo }); // 总小时数（浮点）
      // negated / abs（无需 relativeTo，仅取反符号）
      const neg = d1.negated();                                  // -P1Y2M3DT4H5M
      const absNeg = neg.abs();                                  // P1Y2M3DT4H5M
      // 与 PlainDate.add 配合（PlainDate 知道日历，可直接加含日历单位的 Duration）
      let withDateLine = '';
      if (caps.plainDate) {
        const base = new Temporal.PlainDate(2024, 1, 1);
        const after = base.add(d1);
        withDateLine = `\n与 PlainDate.add 配合：\n  new PlainDate(2024,1,1).add(d1) = ${after.toString()}`;
      }
      this.setState({
        durationResult:
          `new Temporal.Duration(1,2,0,3,4,5) → ${d1.toString()}\n` +
          `  构造参数顺序：年,月,周,日,时,分（秒可省略，第 3 个为周，0 表示无）\n\n` +
          `Duration.from('P1Y2M3DT4H5M') → ${d2.toString()}（与构造相同=${eq}）\n` +
          `  ISO 8601 duration 格式：P[n]Y[n]M[n]DT[n]H[n]M[n]S\n\n` +
          `add / subtract（用仅含精确单位的 4h5m Duration，避免日历单位需 relativeTo）：\n` +
          `  new Duration(0,0,0,0,4,5).add(P1M)      → ${sum.toString()}（+1 分钟）\n` +
          `  new Duration(0,0,0,0,4,5).subtract(P1M) → ${diff.toString()}（-1 分钟）\n\n` +
          `round（规范化 25h70m，仅精确单位无需 relativeTo）：\n` +
          `  new Duration(0,0,0,0,25,70).round({ largestUnit:'day', smallestUnit:'minute' }) → ${rounded.toString()}\n\n` +
          `total（d1 含年/月，需 relativeTo 参考点确定实际长度）：\n` +
          `  d1.total({ unit:'hour', relativeTo: PlainDate(2024,1,1) }) → ${totalHours.toFixed(2)}（总小时数）\n\n` +
          `negated() → ${neg.toString()}\n` +
          `abs()（对 negated 取绝对值）→ ${absNeg.toString()}${withDateLine}\n\n` +
          `说明：Duration 是"时间段"，可加到 PlainDate/PlainDateTime/Instant/ZonedDateTime。\n` +
          `  含日历单位（年/月/周）的 Duration 长度不固定（1 月 = 28~31 天），故 total/round 需传\n` +
          `  relativeTo 参考点；Duration.add/subtract 若含日历单位也需 relativeTo（此处改用精确单位演示）。\n` +
          `  negated/abs 仅取反符号，不涉及计算，无需 relativeTo。`,
      });
      this._addLog('dur', `Duration d1=${d1.toString()}；round(25h70m)=${rounded.toString()}；total(hour)=${totalHours.toFixed(2)}`);
    } catch (err) {
      this._addLog('warn', `Duration 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. Duration —— 时间段',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.duration ? 'success' : 'error' }, caps.duration ? 'Duration ✓' : '不可用'),
        h(Tag, { color: 'primary' }, '年月周日时分秒'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Temporal.Duration 表示"时间段"，由 years / months / weeks / days / hours / minutes / seconds / milliseconds / microseconds / nanoseconds 组成。构造：new Temporal.Duration(years, months, weeks, days, hours, minutes, seconds) 或 Temporal.Duration.from("P1Y2M3DT4H5M")（ISO 8601）。方法：add / subtract 拼接；round({ largestUnit, smallestUnit }) 规范化（如 25 小时进位为 1 天 1 小时）；total({ unit }) 转单一单位浮点值；negated() 取负；abs() 取绝对值。Duration 可作为 PlainDate.add / Instant.add 等的参数。检测：typeof Temporal !== "undefined" && "Duration" in Temporal。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('Duration 运算', { type: 'primary', size: 'sm', disabled: !caps.duration, onClick: () => this._durationDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Duration 演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.durationResult || '（点击按钮演示 Duration 运算）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } },
          h('code', {},
`const d = new Temporal.Duration(1, 2, 0, 3, 4, 5, 6); // 1年2月3天4时5分6秒
Temporal.Duration.from('P1Y2M3DT4H5M');               // ISO 8601
d.add(new Temporal.Duration(0,0,0,0,1));              // +1h
new Temporal.Duration(0,0,0,0,25,70)
  .round({ largestUnit:'day', smallestUnit:'minute' }); // P1DT2H10M
d.total({ unit:'hour' });                              // 总小时（浮点）
d.negated(); d.abs();                                  // 取负 / 绝对值
new Temporal.PlainDate(2024,1,1).add(d);              // 与日期配合`)),
        h(Alert, {
          type: 'info',
          message: 'Duration 解决了"日历日 vs 86400 秒"的歧义',
          description: '传统 Date 加 1 天用 +86400000 毫秒，但在夏令时切换日会偏 23/25 小时。Temporal.Duration 区分"日历单位"（年月日）与"精确单位"（时分秒纳秒）：加到 PlainDate 时按日历日推进；加到 ZonedDateTime 时按当地时间推进（自动处理 DST）；加到 Instant 时仅能用精确单位。round 用于规范化（进位），total 用于换算单一单位。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：Instant —— 绝对时间点 ===================

  _instantDemo() {
    const caps = this._caps();
    if (!caps.instant) {
      this._addLog('warn', 'Temporal.Instant 不可用，需 Chrome 130+。Instant 表示 UTC 绝对时刻（纳秒精度），是与 Date 时戳最接近的 Temporal 类型，但精度更高且不可变。');
      return;
    }
    try {
      const inst = Temporal.Instant.from('2024-12-25T00:00:00Z');     // UTC 0 点
      // 从各类 epoch 创建（逐个检测方法是否存在，部分实现/旧 polyfill 可能缺某些方法）
      const epochLines = [];
      const epochInstants = [];
      const epochMethods = [
        ['fromEpochSeconds',      () => Temporal.Instant.fromEpochSeconds(0)],
        ['fromEpochMilliseconds', () => Temporal.Instant.fromEpochMilliseconds(0)],
        ['fromEpochMicroseconds', () => Temporal.Instant.fromEpochMicroseconds(BigInt(0))],
        ['fromEpochNanoseconds',  () => Temporal.Instant.fromEpochNanoseconds(BigInt(0))],
      ];
      for (const [name, fn] of epochMethods) {
        if (typeof Temporal.Instant[name] === 'function') {
          const i = fn();
          epochInstants.push(i);
          epochLines.push(`  ${name}(0) = ${i.toString()}`);
        } else {
          epochLines.push(`  ${name}（当前实现未提供）`);
        }
      }
      const sameEpoch = epochInstants.length >= 2 &&
        epochInstants.slice(1).every((i) => i.equals(epochInstants[0]));
      // 纳秒精度验证（Date 仅毫秒）
      const nanoInst = Temporal.Instant.fromEpochNanoseconds(BigInt('1703462400000000123'));
      const nanoStr = nanoInst.toString();                              // 含纳秒小数
      // add / subtract（仅精确单位 Duration；传入年/月/周/日会抛 RangeError）
      const plus1h = inst.add(new Temporal.Duration(0, 0, 0, 0, 1));  // +1 小时
      const minus1h = inst.subtract(new Temporal.Duration(0, 0, 0, 0, 1));
      // until / since（用 +24 小时而非 +1 天，因 Instant 不接受日历单位）
      const later = inst.add(new Temporal.Duration(0, 0, 0, 0, 24));  // +24 小时
      const untilDur = inst.until(later, { largestUnit: 'hour' });    // PT24H
      const sinceDur = later.since(inst, { largestUnit: 'hour' });    // PT24H
      // toZonedDateTimeISO + toString
      const zdt = inst.toZonedDateTimeISO('Asia/Shanghai');
      const shanghaiStr = zdt.toString();                              // 含 +08:00 与 [时区]
      this.setState({
        instantResult:
          `Temporal.Instant.from('2024-12-25T00:00:00Z') → ${inst.toString()}\n` +
          `  epochMilliseconds = ${inst.epochMilliseconds}\n` +
          `  epochNanoseconds  = ${inst.epochNanoseconds}（BigInt，纳秒精度）\n\n` +
          `从各类 epoch 创建（逐个检测可用性）：\n` +
          `${epochLines.join('\n')}\n` +
          `  各 epoch 方法结果 equals 相同 = ${sameEpoch}\n\n` +
          `纳秒精度验证：fromEpochNanoseconds(1703462400000000123n)\n` +
          `  toString() = ${nanoStr}（含纳秒小数；Date 仅毫秒会丢失 123ns）\n\n` +
          `add(PT1H)    → ${plus1h.toString()}\n` +
          `subtract(PT1H) → ${minus1h.toString()}\n` +
          `until(+24h, { largestUnit:'hour' }) → ${untilDur.toString()}\n` +
          `since(+24h, { largestUnit:'hour' }) → ${sinceDur.toString()}\n\n` +
          `toZonedDateTimeISO('Asia/Shanghai') → ${shanghaiStr}\n` +
          `  toString() 带时区偏移 + [时区名]\n\n` +
          `说明：Instant 是 UTC 绝对时刻，纳秒精度（BigInt epochNanoseconds）。\n` +
          `  add/subtract 仅接受精确单位 Duration（年月日等日历单位会抛错，因 Instant 无时区无法解释）。\n` +
          `  要做日历运算先 toZonedDateTimeISO(tz) 转 ZonedDateTime。`,
      });
      this._addLog('inst', `Instant 纳秒=${nanoStr.slice(-12)}；+1h=${plus1h.toString()}；上海=${shanghaiStr}`);
    } catch (err) {
      this._addLog('warn', `Instant 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. Instant —— 绝对时间点（UTC 纳秒精度）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.instant ? 'success' : 'error' }, caps.instant ? 'Instant ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'BigInt 纳秒'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Temporal.Instant 表示 UTC 绝对时刻（纳秒精度，epochNanoseconds 为 BigInt）。创建：Temporal.Instant.from("2024-12-25T00:00:00Z")（必须带 Z 或偏移）；fromEpochSeconds / fromEpochMilliseconds / fromEpochMicroseconds / fromEpochNanoseconds(n) 从数值/BigInt 创建。方法：add(Duration) / subtract(Duration) 加减（仅精确单位，年月日等日历单位会抛错，因 Instant 无时区）；until / since 算 Duration；toZonedDateTimeISO(tz) 转带时区的 ZonedDateTime；toString() 输出 UTC ISO 8601。与 Date 时戳最接近，但精度更高（纳秒 vs 毫秒）且不可变。检测：typeof Temporal !== "undefined" && "Instant" in Temporal。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('Instant 操作', { type: 'primary', size: 'sm', disabled: !caps.instant, onClick: () => this._instantDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Instant 演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.instantResult || '（点击按钮演示 Instant 操作）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`const inst = Temporal.Instant.from('2024-12-25T00:00:00Z');
inst.epochNanoseconds;        // BigInt，纳秒精度
Temporal.Instant.fromEpochMilliseconds(0);  // 1970-01-01T00:00:00Z
Temporal.Instant.fromEpochNanoseconds(0n);
inst.add(new Temporal.Duration(0,0,0,0,1));  // +1h（仅精确单位）
inst.until(later, { largestUnit:'hour' });   // PT24H
inst.toZonedDateTimeISO('Asia/Shanghai');    // 转带时区
// 纳秒精度：Date 仅毫秒，Instant 用 BigInt 存纳秒`)),
        h(Alert, {
          type: 'warning',
          message: 'Instant 无时区，做日历运算需先转 ZonedDateTime',
          description: 'Instant.add(Duration) 仅接受"精确单位"（时/分/秒/毫秒/微秒/纳秒），传入年/月/日等"日历单位"会抛 RangeError——因为 Instant 不知道这些单位对应的实际时长（一个月可能是 28~31 天）。要做日历运算先 toZonedDateTimeISO(tz) 转 ZonedDateTime，再用其 add/subtract。纳秒精度通过 BigInt 实现，避免 Date 的毫秒上限与精度损失。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：解析、格式化、比较与 vs Date 对比 ===================

  _parseFormatCompare() {
    const caps = this._caps();
    if (!caps.plainDate || !caps.zonedDateTime) {
      this._addLog('warn', 'Temporal.PlainDate / ZonedDateTime 不可用，无法演示解析/格式化/比较。需 Chrome 130+。');
      return;
    }
    try {
      // —— 解析 ——
      const fromStr = Temporal.PlainDate.from('2024-12-25');               // 字符串
      const fromObj = Temporal.PlainDate.from({ year: 2024, month: 12, day: 25 }); // 对象
      const same = fromStr.equals(fromObj);
      // overflow 仅对"对象输入"的越界字段生效；字符串输入先经 ISO 解析，非法日期直接抛错
      let rejectLine = '';
      try {
        Temporal.PlainDate.from({ year: 2024, month: 13, day: 40 }, { overflow: 'reject' }); // 抛错
      } catch (e) {
        rejectLine = `\nfrom({year:2024,month:13,day:40}, { overflow:'reject' }) → ${e.name}（越界字段被拒绝）`;
      }
      const constrained = Temporal.PlainDate.from(
        { year: 2024, month: 13, day: 40 }, { overflow: 'constrain' }); // 钳制：月13→12，日40→31
      // —— 格式化 ——（与 Intl.DateTimeFormat 协同；format 接受 Date 或数值，故用 epochMilliseconds 转换）
      const zdt = Temporal.ZonedDateTime.from('2024-12-25T10:30:00[Asia/Shanghai]');
      const epochMs = zdt.toInstant().epochMilliseconds;
      const zhFull = new Intl.DateTimeFormat('zh-CN',
        { dateStyle: 'full', timeStyle: 'long', timeZone: zdt.timeZoneId }).format(new Date(epochMs));
      const enFull = new Intl.DateTimeFormat('en-US',
        { dateStyle: 'full', timeZone: zdt.timeZoneId }).format(new Date(epochMs));
      const locStr = zdt.toLocaleString('zh-CN', { dateStyle: 'long' });
      // —— 比较 ——
      const d1 = new Temporal.PlainDate(2024, 3, 15);
      const d2 = new Temporal.PlainDate(2024, 6, 1);
      const d3 = new Temporal.PlainDate(2024, 1, 10);
      const sorted = [d1, d2, d3].sort(Temporal.PlainDate.compare);        // 按 compare 静态方法排序
      const cmp12 = Temporal.PlainDate.compare(d1, d2);                    // -1（d1 < d2）
      const untilDays = d1.until(d2, { largestUnit: 'day' });              // P78D
      this.setState({
        parseResult:
          `【解析】Temporal.PlainDate.from(...)\n` +
          `  from('2024-12-25')              = ${fromStr.toString()}\n` +
          `  from({year:2024,month:12,day:25}) = ${fromObj.toString()}（equals 字符串版=${same}）\n` +
          `  from({year:2024,month:13,day:40}, { overflow:'constrain' }) = ${constrained.toString()}（月13→12，日40→31）${rejectLine}\n` +
          `  ※ overflow 仅对对象输入的越界字段生效；字符串输入先经 ISO 解析，非法日期直接抛错\n\n` +
          `【格式化】与 Intl.DateTimeFormat 协同\n` +
          `  ZonedDateTime.from('2024-12-25T10:30:00[Asia/Shanghai]')\n` +
          `  Intl.DateTimeFormat('zh-CN', {dateStyle:'full', timeStyle:'long',\n` +
          `    timeZone: zdt.timeZoneId}).format(new Date(zdt.toInstant().epochMilliseconds))\n` +
          `    = ${zhFull}\n` +
          `  Intl.DateTimeFormat('en-US', {dateStyle:'full',\n` +
          `    timeZone: zdt.timeZoneId}).format(new Date(epochMs))\n` +
          `    = ${enFull}\n` +
          `  zdt.toLocaleString('zh-CN', {dateStyle:'long'}) = ${locStr}\n\n` +
          `【比较】Temporal.PlainDate.compare(a, b) → -1/0/1\n` +
          `  d1=${d1.toString()}，d2=${d2.toString()}，d3=${d3.toString()}\n` +
          `  compare(d1, d2) = ${cmp12}（d1 < d2）\n` +
          `  [d1,d2,d3].sort(Temporal.PlainDate.compare) = [${sorted.map((d) => d.toString()).join(', ')}]\n` +
          `  d1.until(d2, { largestUnit:'day' }) = ${untilDays.toString()}\n\n` +
          `【vs Date 对比表】\n` +
          `  不可变：Temporal ✓（所有类型）｜ Date ✗（setHours 等改原值）\n` +
          `  时区：Temporal 显式（ZonedDateTime）｜ Date 隐含系统时区\n` +
          `  精度：Temporal 纳秒（BigInt）｜ Date 毫秒\n` +
          `  国际化：Temporal 与 Intl 协同，时区感知｜ Date.toISOString 仅 UTC\n` +
          `  算术：Temporal.add/subtract/until/since + Duration｜ Date 手动 +ms，DST 易错\n` +
          `  解析：Temporal.from 严格 + overflow 选项｜ Date.parse 各引擎实现不一`,
      });
      this._addLog('parse', `解析与格式化：zh full="${zhFull}"；compare 排序后=[${sorted.map((d) => d.toString()).join(',')}]`);
    } catch (err) {
      this._addLog('warn', `解析/格式化/比较演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. 解析、格式化、比较与 vs Date 对比',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.plainDate && caps.zonedDateTime ? 'success' : 'error' },
          caps.plainDate && caps.zonedDateTime ? 'from/compare ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'Intl 协同'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '解析：Temporal.PlainDate.from("2024-12-25") 接受字符串或对象；from(obj, { overflow: "reject" | "constrain" }) 控制对象输入的越界字段——reject 抛错，constrain 自动钳制（如 {month:13,day:40} → 12-31）。注意：overflow 仅对对象输入生效，字符串输入先经 ISO 解析，非法日期直接抛错。格式化：toString() 输出 ISO 8601；toLocaleString(locale, options) 本地化；与 Intl.DateTimeFormat 协同——format 接受 Date/数值，故用 new Date(zdt.toInstant().epochMilliseconds) 转换，配合 timeZone 选项输出时区感知的本地化字符串。比较：Temporal.PlainDate.compare(a, b) 返回 -1/0/1，可直接作为 Array.sort 比较器；until/since 计算 Duration。检测：typeof Temporal !== "undefined" && "PlainDate" in Temporal。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('解析与格式化', { type: 'primary', size: 'sm', disabled: !caps.plainDate || !caps.zonedDateTime, onClick: () => this._parseFormatCompare() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '解析 / 格式化 / 比较结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, s.parseResult || '（点击按钮演示解析、格式化、比较与 vs Date 对比）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '170px', overflow: 'auto' } },
          h('code', {},
`// 解析：字符串 / 对象 / overflow（overflow 仅对对象输入的越界字段生效）
Temporal.PlainDate.from('2024-12-25');
Temporal.PlainDate.from({ year:2024, month:12, day:25 });
Temporal.PlainDate.from({ year:2024, month:13, day:40 },
  { overflow:'reject' });    // 抛 RangeError（越界字段）
Temporal.PlainDate.from({ year:2024, month:13, day:40 },
  { overflow:'constrain' }); // 钳制为 2024-12-31
// 格式化：与 Intl 协同（format 接受 Date/数值，故用 epochMilliseconds 转换）
const zdt = Temporal.ZonedDateTime.from('2024-12-25T10:30:00[Asia/Shanghai]');
new Intl.DateTimeFormat('zh-CN',
  { dateStyle:'full', timeStyle:'long', timeZone: zdt.timeZoneId })
  .format(new Date(zdt.toInstant().epochMilliseconds));
zdt.toLocaleString('zh-CN', { dateStyle:'long' });
// 比较：compare 静态方法作排序器
[d1,d2,d3].sort(Temporal.PlainDate.compare);
Temporal.PlainDate.compare(d1, d2); // -1/0/1`)),
        h(Alert, {
          type: 'info',
          message: 'Temporal 设计目标：替代 Date，解决时区/不可变/精度/算术四大痛点',
          description: 'Date 的设计缺陷：可变（易被意外修改）、隐含系统时区（跨时区 bug 频发）、仅毫秒精度、算术需手动 +86400000（DST 出错）、解析各引擎实现不一。Temporal 用类型系统分离"墙钟时间"（Plain*）与"绝对时刻"（Instant/ZonedDateTime），所有类型不可变、纳秒精度、时区显式、与 Intl 协同。from 的 overflow 选项让解析行为可预测（reject 或 constrain），对比 Date.parse 的引擎差异。TC39 Stage 3，Chrome 130+ 已内置。',
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
    return h('div', { class: 'page api-lab-page' },
      h('h2', { class: 'section-title' }, 'Temporal API 实验室（TC39 Stage 3，替代 Date）'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页演示 Temporal API：Temporal.Now、PlainDate/PlainTime/PlainDateTime、ZonedDateTime、Duration、Instant，以及解析/格式化/比较。Temporal 是 TC39 Stage 3 提案，Chrome 130+ / 较新 V8 已内置，旨在替代 Date。jsdom/Node 通常不可用，不可用的按钮点击仅记日志说明，不会抛异常。可用 polyfill：@js-temporal/polyfill。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
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
