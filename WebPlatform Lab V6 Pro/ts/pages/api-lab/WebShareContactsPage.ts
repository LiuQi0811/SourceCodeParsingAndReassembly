// =====================================================================
// WebShareContactsPage.js —— Web Share / Contacts / Badging / WebOTP / Credential 实验室
// 演示 MDN：
//   1. Web Share API —— navigator.share（基础分享 title/text/url）
//   2. Web Share Level 2 —— navigator.canShare / canShare({ files }) 能力检测
//   3. Web Share Level 2 文件分享 —— navigator.share({ files: File[] })
//   4. Contact Picker API —— navigator.contacts.select / getProperties（联系人选择器）
//   5. Badging API —— navigator.setAppBadge / clearAppBadge（应用图标徽章）
//   6. WebOTP + Credential Management —— credentials.get({ otp }) / create / store / preventSilentAccess
// 说明：这些 API 大多需要 HTTPS + 用户手势，部分仅 PWA 安装后或 Android Chrome 可用。
//       所有 API 调用前做 typeof 能力检测，不可用时仅记日志（_addLog('warn', ...)），绝不抛异常。
//       jsdom/Node 中 navigator.share / canShare / contacts / setAppBadge 等大多 undefined；
//       File 构造器在 jsdom 中可用，故文件对象可真实创建。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { State } from '../../core/types.js';

interface WebShareContactsPageState extends State {
  logs: any;
  capsSummary: any;
  shareInfo: any;
  canShareInfo: any;
  fileShareInfo: any;
  contactsInfo: any;
  badgeInfo: any;
  credInfo: any;
}

export class WebShareContactsPage extends Page {
  declare state: WebShareContactsPageState;
  _inited!: boolean;
  _otpController!: any | null;
  _otpTimer!: ReturnType<typeof setTimeout> | number | null;

  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      // Card 1：navigator.share 基础分享
      shareInfo: '',
      // Card 2：navigator.canShare 能力检测
      canShareInfo: '',
      // Card 3：Web Share Level 2 文件分享
      fileShareInfo: '',
      // Card 4：Contact Picker API
      contactsInfo: '',
      // Card 5：Badging API
      badgeInfo: '',
      // Card 6：WebOTP + Credential Management
      credInfo: '',
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._otpController = null;     // Card 6 WebOTP 监听的 AbortController
    this._otpTimer = null;          // Card 6 WebOTP 超时定时器

    // 一次性能力检测：Web Share / Contacts / Badging / Credential 全家桶
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const hasShare = !!nav && typeof nav.share === 'function';
    const hasCanShare = !!nav && typeof nav.canShare === 'function';
    const hasContacts = !!nav && !!nav.contacts && typeof nav.contacts.select === 'function';
    const hasGetProps = !!nav && !!nav.contacts && typeof nav.contacts.getProperties === 'function';
    const hasSetBadge = !!nav && typeof nav.setAppBadge === 'function';
    const hasClearBadge = !!nav && typeof nav.clearAppBadge === 'function';
    const hasCredentials = !!nav && !!nav.credentials && typeof nav.credentials.get === 'function';
    const hasOtpCred = typeof OTPCredential !== 'undefined';
    const hasPwdCred = typeof PasswordCredential !== 'undefined';
    const hasFile = typeof File !== 'undefined';

    const mark = (b: any) => b ? '✓' : '✗';
    const parts = [
      `share ${mark(hasShare)}`, `canShare ${mark(hasCanShare)}`,
      `contacts.select ${mark(hasContacts)}`, `contacts.getProperties ${mark(hasGetProps)}`,
      `setAppBadge ${mark(hasSetBadge)}`, `clearAppBadge ${mark(hasClearBadge)}`,
      `credentials.get ${mark(hasCredentials)}`,
      `OTPCredential ${mark(hasOtpCred)}`, `PasswordCredential ${mark(hasPwdCred)}`,
      `File ${mark(hasFile)}`,
    ];

    const anyAvail = hasShare || hasCanShare || hasContacts || hasSetBadge || hasCredentials;
    const summary = anyAvail
      ? `Web Share / Contacts / Badging / Credential 能力检测：${parts.join(' · ')}。已检测到的 API 可在当前环境真实调用；未检测到的 API 点击按钮仅记日志说明，不会抛异常。`
      : `Web Share / Contacts / Badging / Credential 能力检测：${parts.join(' · ')}。当前测试环境（jsdom/Node）这些 API 大多不可用（navigator.share / canShare / contacts / setAppBadge / clearAppBadge / credentials 均为 undefined），点击按钮仅记日志说明，需真实浏览器 + HTTPS + 用户手势方可完整演示。File 构造器在 jsdom 中可用，故 Card 3 文件对象可真实创建。`;

    this.setState({ capsSummary: summary });
    this._addLog(anyAvail ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!hasShare) this._addLog('warn', 'navigator.share 不可用（需 HTTPS + 用户手势）');
    if (!hasCanShare) this._addLog('warn', 'navigator.canShare 不可用（需 HTTPS 环境）');
    if (!hasContacts) this._addLog('warn', 'navigator.contacts 不可用（Contact Picker API 仅 Android Chrome 支持）');
    if (!hasSetBadge) this._addLog('warn', 'navigator.setAppBadge 不可用（Badging API 需 PWA 安装后有效）');
    if (!hasOtpCred) this._addLog('warn', 'OTPCredential 不可用（WebOTP 仅 Android Chrome 支持）');
    if (!hasPwdCred) this._addLog('warn', 'PasswordCredential 不可用（Credential Management 需真实浏览器 + HTTPS）');
  }

  componentWillUnmount() {
    // 释放 AbortController 与定时器，避免内存泄漏
    if (this._otpController) {
      try { this._otpController.abort(); } catch { /* noop */ }
      this._otpController = null;
    }
    if (this._otpTimer) {
      clearTimeout(this._otpTimer);
      this._otpTimer = null;
    }
  }

  // —— 日志 / 按钮辅助 ——
  _addLog(type: any, content: any){
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label: any, opts: any){
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // —— 同步能力检测（render 时调用，开销可忽略）——
  _caps() {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const cred = nav && nav.credentials;
    const f = (o: any, k: any) => !!o && typeof o[k] === 'function';
    return {
      share: f(nav, 'share'), canShare: f(nav, 'canShare'),
      contacts: !!nav && !!nav.contacts && f(nav.contacts, 'select'),
      getProps: !!nav && !!nav.contacts && f(nav.contacts, 'getProperties'),
      setBadge: f(nav, 'setAppBadge'), clearBadge: f(nav, 'clearAppBadge'),
      credentials: f(cred, 'get'), credStore: f(cred, 'store'),
      credCreate: f(cred, 'create'), preventSilent: f(cred, 'preventSilentAccess'),
      otpCred: typeof OTPCredential !== 'undefined',
      pwdCred: typeof PasswordCredential !== 'undefined',
      file: typeof File !== 'undefined',
      abortCtrl: typeof AbortController !== 'undefined',
    };
  }

  // =================== Card 1：navigator.share 基础分享 ===================

  // navigator.share({ title, text, url }) → Promise<void>
  // 必须在用户手势中调用；失败 AbortError 表示用户取消分享
  async _shareBasic() {
    if (!this._caps().share) {
      this._addLog('warn', 'navigator.share 不可用（测试环境不支持，需真实浏览器 + HTTPS + 用户手势）');
      return;
    }
    // 分享数据三件套：title / text / url
    const data = {
      title: 'Web Share API 演示',
      text: '这是一段通过 navigator.share 分享的文本',
      url: 'https://developer.mozilla.org/docs/Web/API/Navigator/share',
    };
    try {
      this._addLog('share', '调用 navigator.share({ title, text, url })…');
      await navigator.share(data);
      this.setState({
        shareInfo:
          `navigator.share({ title, text, url }) → Promise<void> ✓\n` +
          `分享数据：\n  title = ${data.title}\n  text = ${data.text}\n  url = ${data.url}\n` +
          `说明：share() 必须在用户手势（点击）中调用；AbortError 表示用户取消（属正常行为）。\n` +
          `常见错误：AbortError（取消）/ NotAllowedError（无权限或非用户手势）/ DataError（数据无效）`,
      });
      this._addLog('share', '分享成功（用户已确认分享）');
    } catch (err: any) {
      const aborted = err && err.name === 'AbortError';
      this.setState({
        shareInfo:
          `navigator.share 失败：${err.name} - ${err.message}\n` +
          `说明：${aborted ? '用户取消了分享（AbortError），属正常行为。' : '其他错误。'}\n` +
          `常见错误：AbortError（取消）/ NotAllowedError（无权限或非用户手势）/ DataError（数据无效）`,
      });
      this._addLog(aborted ? 'warn' : 'error', `share 失败：${err.name}（${aborted ? '用户取消' : err.message}）`);
    }
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. navigator.share 基础分享',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.share ? 'success' : 'error' }, caps.share ? 'share ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'title / text / url'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'navigator.share({ title, text, url }) → Promise<void> 调用系统原生分享面板，可分享到社交应用、邮件、复制到剪贴板等。必须在用户手势（点击事件）中调用，且需要 HTTPS 环境（localhost 除外）。成功 resolve 表示用户完成分享；失败 reject 中 AbortError 表示用户主动取消（属正常行为，不应作为错误处理）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('分享 title+text+url', { type: 'primary', size: 'sm', onClick: () => this._shareBasic() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '分享结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.shareInfo || '（点击「分享 title+text+url」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {},
`// 必须在点击事件回调中调用（用户手势）
button.addEventListener('click', async () => {
  try {
    await navigator.share({
      title: '标题',
      text: '描述文本',
      url: 'https://example.com',
    });
    console.log('分享成功');
  } catch (err: any) {
    if (err.name === 'AbortError') return; // 用户取消，正常
    console.error('分享失败', err);
  }
});`)),
        h(Alert, {
          type: 'warning',
          message: 'share 必须由用户手势触发',
          description: 'navigator.share() 只能在用户点击/按键等手势触发的回调中调用；如果在 setTimeout / Promise.then 等异步上下文中调用会抛 NotAllowedError。同时要求 HTTPS（localhost 除外）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：navigator.canShare 能力检测 ===================

  // navigator.canShare(data?) → boolean：检测能否分享，不实际触发面板
  _canShareBasic() {
    if (!this._caps().canShare) {
      this._addLog('warn', 'navigator.canShare 不可用（测试环境不支持，需真实浏览器 + HTTPS）');
      return;
    }
    try {
      // 检测不同分享数据类型是否可分享
      const textData = { text: '纯文本分享测试' };
      const urlData = { url: 'https://example.com' };
      const titleData = { title: '仅标题' };
      const combined = { title: '组合', text: '文本', url: 'https://example.com' };
      const r1 = navigator.canShare(textData);
      const r2 = navigator.canShare(urlData);
      const r3 = navigator.canShare(titleData);
      const r4 = navigator.canShare(combined);
      const r5 = navigator.canShare();   // 无参数：环境是否支持任意分享
      this.setState({
        canShareInfo:
          `navigator.canShare(data?) → boolean（检测能否分享，不实际触发）\n` +
          `canShare({ text }) = ${r1}\n` +
          `canShare({ url }) = ${r2}\n` +
          `canShare({ title }) = ${r3}\n` +
          `canShare({ title, text, url }) = ${r4}\n` +
          `canShare() = ${r5}（无参数：环境是否支持任意分享）\n` +
          `说明：canShare 用于在 UI 上灰掉不可用的分享按钮；返回 false 表示当前环境或数据类型不支持。`,
      });
      this._addLog('canShare', `canShare：text=${r1}，url=${r2}，title=${r3}，组合=${r4}，无参=${r5}`);
    } catch (err: any) {
      this._addLog('warn', `canShare 抛错：${err.name} - ${err.message}`);
    }
  }

  // navigator.canShare({ files: [...] }) → boolean：Web Share Level 2 文件类型检测
  _canShareFiles() {
    if (!this._caps().canShare) {
      this._addLog('warn', 'navigator.canShare 不可用');
      return;
    }
    if (!this._caps().file) {
      this._addLog('warn', 'File 构造器不可用');
      return;
    }
    try {
      // 创建不同 MIME 类型的文件用于检测
      const txt = new File(['hello world'], 'note.txt', { type: 'text/plain' });
      const json = new File(['{"k":1}'], 'data.json', { type: 'application/json' });
      const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'pixel.png', { type: 'image/png' });
      const jpg = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'photo.jpg', { type: 'image/jpeg' });
      const rTxt = navigator.canShare({ files: [txt] });
      const rJson = navigator.canShare({ files: [json] });
      const rPng = navigator.canShare({ files: [png] });
      const rJpg = navigator.canShare({ files: [jpg] });
      const rMulti = navigator.canShare({ files: [txt, png] });
      this.setState({
        canShareInfo:
          `navigator.canShare({ files: [...] }) → boolean（Web Share Level 2 文件类型检测）\n` +
          `canShare({ files: [note.txt] }) = ${rTxt}（text/plain）\n` +
          `canShare({ files: [data.json] }) = ${rJson}（application/json）\n` +
          `canShare({ files: [pixel.png] }) = ${rPng}（image/png）\n` +
          `canShare({ files: [photo.jpg] }) = ${rJpg}（image/jpeg）\n` +
          `canShare({ files: [note.txt, pixel.png] }) = ${rMulti}（多文件混合）\n` +
          `说明：canShare({ files }) 检测文件 MIME 是否可分享；不同浏览器支持的类型不同。`,
      });
      this._addLog('canShare', `文件检测：txt=${rTxt}，json=${rJson}，png=${rPng}，jpg=${rJpg}，多文件=${rMulti}`);
    } catch (err: any) {
      this._addLog('warn', `canShare({files}) 抛错：${err.name} - ${err.message}`);
    }
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. navigator.canShare 能力检测',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.canShare ? 'success' : 'error' }, caps.canShare ? 'canShare ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'Level 2 文件检测'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'navigator.canShare(data?) → boolean 仅检测能否分享，不实际触发分享面板。无参数时返回环境是否支持任意分享；传入 data 时检测特定数据类型是否可分享。Web Share Level 2 中 canShare({ files: [...] }) 可检测文件 MIME 类型是否可分享（不同浏览器支持的类型不同，如 image/png / image/jpeg / text/plain / application/json）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测纯文本/URL/标题', { type: 'primary', size: 'sm', disabled: !caps.canShare, onClick: () => this._canShareBasic() }),
          this._btn('检测文件类型', { type: 'primary', size: 'sm', disabled: !caps.canShare || !caps.file, onClick: () => this._canShareFiles() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'canShare 检测结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.canShareInfo || '（点击「检测纯文本/URL/标题」或「检测文件类型」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`// 用 canShare 灰掉不可用的分享按钮
const file = new File([blob], 'img.png', { type: 'image/png' });
const shareBtn = document.querySelector('#share');
shareBtn.disabled = !navigator.canShare?.({ files: [file] });

shareBtn.addEventListener('click', async () => {
  if (navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file] });
  }
});`)),
        h(Alert, {
          type: 'info',
          message: 'canShare 不触发分享面板',
          description: 'canShare 只做能力检测，不会弹出系统分享面板；常用于在 UI 上灰掉不可用的分享按钮，避免点击后才发现不支持。返回 false 的原因可能是：环境不支持、数据类型不支持、文件 MIME 不在白名单内。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：Web Share Level 2 文件分享 ===================

  // navigator.share({ files: [File], title, text }) → Promise<void>
  // 分享文本文件（new File 构造）
  async _shareTextFile() {
    if (!this._caps().share) {
      this._addLog('warn', 'navigator.share 不可用（测试环境不支持，需真实浏览器 + HTTPS）');
      return;
    }
    if (!this._caps().file) {
      this._addLog('warn', 'File 构造器不可用');
      return;
    }
    try {
      const content = 'Web Share Level 2 文件分享演示\n这是通过 navigator.share({ files }) 分享的文本文件。';
      const file = new File([content], 'web-share-demo.txt', { type: 'text/plain' });
      const canShare = this._caps().canShare ? navigator.canShare({ files: [file] }) : 'canShare 不可用';
      this._addLog('share', `调用 share({ files: [note.txt] })，canShare 预检=${canShare}`);
      await navigator.share({
        files: [file],
        title: '文本文件分享',
        text: '附上一个 .txt 文件',
      });
      this.setState({
        fileShareInfo:
          `navigator.share({ files: [File], title, text }) → Promise<void> ✓\n` +
          `File：web-share-demo.txt（type: text/plain，size: ${file.size}B）\n` +
          `canShare({ files: [file] }) 预检 = ${canShare}\n` +
          `说明：Web Share Level 2 支持分享 File 对象；title/text 可与 files 同时传入。File 可来自 new File() / <input type="file"> / fetch(blob)。`,
      });
      this._addLog('share', '文本文件分享成功');
    } catch (err: any) {
      const aborted = err && err.name === 'AbortError';
      this._addLog(aborted ? 'warn' : 'error', `文本文件分享失败：${err.name}（${aborted ? '用户取消' : err.message}）`);
      this.setState({ fileShareInfo: `文本文件分享失败：${err.name} - ${err.message}` });
    }
  }

  // 分享图片文件（构造极小 PNG 文件头演示 File 对象构造）
  async _shareImageFile() {
    if (!this._caps().share) {
      this._addLog('warn', 'navigator.share 不可用（测试环境不支持，需真实浏览器 + HTTPS）');
      return;
    }
    if (!this._caps().file) {
      this._addLog('warn', 'File 构造器不可用');
      return;
    }
    try {
      // 构造一个极小的 PNG 文件（仅文件头 + IHDR chunk 头，非真实可解码图片，仅演示 File 构造）
      const pngBytes = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG 签名
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk 头
      ]);
      const png = new File([pngBytes], 'pixel.png', { type: 'image/png' });
      const canShare = this._caps().canShare ? navigator.canShare({ files: [png] }) : 'canShare 不可用';
      this._addLog('share', `调用 share({ files: [pixel.png] })，canShare 预检=${canShare}`);
      await navigator.share({
        files: [png],
        title: '图片分享',
        text: '一张 PNG 图片',
      });
      this.setState({
        fileShareInfo:
          `navigator.share({ files: [PNG], title, text }) → Promise<void> ✓\n` +
          `File：pixel.png（type: image/png，size: ${png.size}B）\n` +
          `canShare({ files: [png] }) 预检 = ${canShare}\n` +
          `说明：图片分享常用于分享截图、相册图片等；多数浏览器支持 image/png / image/jpeg。实际项目应从 canvas.toBlob() 或 <input type="file"> 获取真实图片。`,
      });
      this._addLog('share', '图片文件分享成功');
    } catch (err: any) {
      const aborted = err && err.name === 'AbortError';
      this._addLog(aborted ? 'warn' : 'error', `图片分享失败：${err.name}（${aborted ? '用户取消' : err.message}）`);
      this.setState({ fileShareInfo: `图片分享失败：${err.name} - ${err.message}` });
    }
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. Web Share Level 2 文件分享',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.share ? 'success' : 'error' }, caps.share ? 'share(files) ✓' : '不可用'),
        h(Tag, { color: caps.file ? 'primary' : 'warning' }, caps.file ? 'File ✓' : 'File ✗'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Web Share Level 2 扩展了 navigator.share，支持 data.files: File[] 分享文件。文件可以是 image/png / image/jpeg / text/plain / application/json 等 MIME 类型。data.title / data.text 可与 files 同时传入作为附加信息。File 对象可通过 new File([content], name, { type }) 构造，也可来自 <input type="file"> 或 fetch/blob 转换。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('分享 .txt 文件', { type: 'primary', size: 'sm', disabled: !caps.share || !caps.file, onClick: () => this._shareTextFile() }),
          this._btn('分享 .png 图片', { type: 'primary', size: 'sm', disabled: !caps.share || !caps.file, onClick: () => this._shareImageFile() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '文件分享结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '200px', overflow: 'auto' } },
          h('code', {}, s.fileShareInfo || '（点击「分享 .txt 文件」或「分享 .png 图片」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {},
`// 从 <input type="file"> 获取文件并分享
const input = document.querySelector('input[type=file]');
input.addEventListener('change', async () => {
  const files = Array.from(input.files);
  if (navigator.canShare({ files })) {
    try {
      await navigator.share({
        files,
        title: '分享文件',
        text: '来自文件输入',
      });
    } catch (err: any) {
      if (err.name !== 'AbortError') console.error(err);
    }
  }
});

// 也可用 new File 构造
const f = new File(['hi'], 'a.txt', { type: 'text/plain' });`)),
        h(Alert, {
          type: 'warning',
          message: '文件分享需浏览器支持 Level 2',
          description: 'Web Share Level 2（文件分享）并非所有浏览器支持。调用前应先用 navigator.canShare({ files }) 预检；canShare 返回 false 时不应调用 share，否则会抛 NotAllowedError 或 DataError。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：Contact Picker API ===================

  // navigator.contacts.getProperties() → Promise<array>：检测设备支持的属性集合
  async _getContactProperties() {
    if (!this._caps().getProps) {
      this._addLog('warn', 'navigator.contacts.getProperties 不可用（Contact Picker API 仅 Android Chrome 支持，需 HTTPS）');
      return;
    }
    try {
      this._addLog('contacts', '调用 navigator.contacts.getProperties()…');
      const props = await navigator.contacts.getProperties();
      this.setState({
        contactsInfo:
          `navigator.contacts.getProperties() → Promise<string[]> ✓\n` +
          `返回支持的属性：${JSON.stringify(props)}\n` +
          `可用属性：'name' | 'email' | 'tel' | 'address' | 'icon'\n` +
          `说明：getProperties 用于在调用 select 前探测设备支持的属性集合。`,
      });
      this._addLog('contacts', `getProperties() = ${JSON.stringify(props)}`);
    } catch (err: any) {
      this._addLog('warn', `getProperties 失败：${err.name} - ${err.message}`);
      this.setState({ contactsInfo: `getProperties 失败：${err.name} - ${err.message}` });
    }
  }

  // navigator.contacts.select(properties, { multiple }) → Promise<array>
  // properties: ['name', 'email', 'tel', 'address', 'icon']
  async _selectContact() {
    if (!this._caps().contacts) {
      this._addLog('warn', 'navigator.contacts.select 不可用（Contact Picker API 仅 Android Chrome 支持，需 HTTPS + 用户手势）');
      return;
    }
    try {
      const properties = ['name', 'email', 'tel'];
      this._addLog('contacts', `调用 navigator.contacts.select(${JSON.stringify(properties)}, { multiple: false })…`);
      const contacts = await navigator.contacts.select(properties, { multiple: false });
      this.setState({
        contactsInfo:
          `navigator.contacts.select(['name','email','tel'], { multiple: false }) → Promise<array> ✓\n` +
          `返回联系人：${JSON.stringify(contacts, null, 2)}\n` +
          `multiple: false → 仅允许选 1 个；true → 可多选。\n` +
          `返回对象结构：{ name: [], email: [], tel: [], address: [], icon: [] }\n` +
          `      （每个属性都是数组，因为一个联系人可能存多个电话/邮箱）`,
      });
      this._addLog('contacts', `单选成功：返回 ${contacts.length} 个联系人`);
    } catch (err: any) {
      this._addLog('warn', `select 单选失败：${err.name} - ${err.message}`);
      this.setState({ contactsInfo: `select 单选失败：${err.name} - ${err.message}` });
    }
  }

  // 多选：multiple: true，含 address + icon
  async _selectMultipleContacts() {
    if (!this._caps().contacts) {
      this._addLog('warn', 'navigator.contacts.select 不可用');
      return;
    }
    try {
      const properties = ['name', 'email', 'tel', 'address', 'icon'];
      this._addLog('contacts', `调用 navigator.contacts.select(${JSON.stringify(properties)}, { multiple: true })…`);
      const contacts = await navigator.contacts.select(properties, { multiple: true });
      this.setState({
        contactsInfo:
          `navigator.contacts.select(['name','email','tel','address','icon'], { multiple: true }) → Promise<array> ✓\n` +
          `返回联系人（${contacts.length} 个）：${JSON.stringify(contacts, null, 2)}\n` +
          `multiple: true → 允许用户多选。\n` +
          `icon 属性返回的是 base64 编码的图片 data URL 数组（联系人头像）。`,
      });
      this._addLog('contacts', `多选成功：返回 ${contacts.length} 个联系人`);
    } catch (err: any) {
      this._addLog('warn', `select 多选失败：${err.name} - ${err.message}`);
      this.setState({ contactsInfo: `select 多选失败：${err.name} - ${err.message}` });
    }
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. Contact Picker API（联系人选择器）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.contacts ? 'success' : 'error' }, caps.contacts ? 'contacts ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'name/email/tel/address/icon'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'navigator.contacts.select(properties, options) → Promise<array> 弹出系统联系人选择器让用户选联系人。properties: ["name","email","tel","address","icon"] 指定要获取的字段；options.multiple: true 允许多选。navigator.contacts.getProperties() → Promise<array> 返回设备支持的属性集合。返回的联系人对象每个属性都是数组（如 { name: ["张三"], tel: ["13800138000"] }）。需 HTTPS + 用户手势，仅 Android Chrome 支持。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('getProperties', { type: 'primary', size: 'sm', disabled: !caps.getProps, onClick: () => this._getContactProperties() }),
          this._btn('select 单选', { type: 'primary', size: 'sm', disabled: !caps.contacts, onClick: () => this._selectContact() }),
          this._btn('select 多选', { size: 'sm', disabled: !caps.contacts, onClick: () => this._selectMultipleContacts() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '联系人选择结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.contactsInfo || '（点击「getProperties」或「select 单选/多选」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {},
`// 探测支持的属性
const props = await navigator.contacts.getProperties();

// 单选：获取 name + email + tel
const [contact] = await navigator.contacts.select(
  ['name', 'email', 'tel'],
  { multiple: false }
);
// contact = { name: ['张三'], email: ['zs@x.com'], tel: ['138...'] }

// 多选：包含地址和头像
const contacts = await navigator.contacts.select(
  ['name', 'email', 'tel', 'address', 'icon'],
  { multiple: true }
);
// contacts[0].icon[0] 是 base64 data URL`)),
        h(Alert, {
          type: 'warning',
          message: 'Contact Picker 仅 Android Chrome 支持',
          description: 'Contact Picker API 目前仅在 Android Chrome 上可用，需 HTTPS 环境且必须由用户手势触发。iOS Safari 与桌面浏览器均不支持。属性返回值为数组（用户可能存多个电话/邮箱）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：Badging API ===================

  // navigator.setAppBadge(count) → Promise<void>：设置数字徽章
  async _setBadgeNumber() {
    if (!this._caps().setBadge) {
      this._addLog('warn', 'navigator.setAppBadge 不可用（Badging API 需 PWA 安装后有效，测试环境不支持）');
      return;
    }
    try {
      this._addLog('badge', '调用 navigator.setAppBadge(5)…');
      await navigator.setAppBadge(5);
      this.setState({
        badgeInfo:
          `navigator.setAppBadge(5) → Promise<void> ✓\n` +
          `已设置应用图标角标数字为 5（模拟未读消息数）。\n` +
          `说明：setAppBadge(count) 在 PWA 应用图标上显示角标；\n` +
          `      count 省略则显示通用圆点（无数字）。仅在 PWA 安装后有效，普通网页无图标故不可见。`,
      });
      this._addLog('badge', 'setAppBadge(5) 成功');
    } catch (err: any) {
      this._addLog('warn', `setAppBadge(5) 失败：${err.name} - ${err.message}`);
      this.setState({ badgeInfo: `setAppBadge(5) 失败：${err.name} - ${err.message}` });
    }
  }

  // navigator.setAppBadge() → Promise<void>：无参，显示通用圆点
  async _setBadgeDot() {
    if (!this._caps().setBadge) {
      this._addLog('warn', 'navigator.setAppBadge 不可用');
      return;
    }
    try {
      this._addLog('badge', '调用 navigator.setAppBadge()（无参，显示通用圆点）…');
      await navigator.setAppBadge();
      this.setState({
        badgeInfo:
          `navigator.setAppBadge() → Promise<void> ✓\n` +
          `已设置应用图标角标为通用圆点（无数字）。\n` +
          `说明：省略 count 参数时显示一个无数字的圆点，\n` +
          `      用于「有更新但无具体计数」的提醒场景。`,
      });
      this._addLog('badge', 'setAppBadge() 通用圆点设置成功');
    } catch (err: any) {
      this._addLog('warn', `setAppBadge() 失败：${err.name} - ${err.message}`);
      this.setState({ badgeInfo: `setAppBadge() 失败：${err.name} - ${err.message}` });
    }
  }

  // navigator.clearAppBadge() → Promise<void>：清除角标
  async _clearBadge() {
    if (!this._caps().clearBadge) {
      this._addLog('warn', 'navigator.clearAppBadge 不可用');
      return;
    }
    try {
      this._addLog('badge', '调用 navigator.clearAppBadge()…');
      await navigator.clearAppBadge();
      this.setState({
        badgeInfo:
          `navigator.clearAppBadge() → Promise<void> ✓\n` +
          `已清除应用图标角标。\n` +
          `说明：clearAppBadge 清除角标（数字或圆标）；\n` +
          `      常用于用户点击查看消息后清零未读数。setAppBadge(0) 等效于清除。`,
      });
      this._addLog('badge', 'clearAppBadge() 成功');
    } catch (err: any) {
      this._addLog('warn', `clearAppBadge 失败：${err.name} - ${err.message}`);
      this.setState({ badgeInfo: `clearAppBadge 失败：${err.name} - ${err.message}` });
    }
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. Badging API（应用图标徽章）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.setBadge ? 'success' : 'error' }, caps.setBadge ? 'setAppBadge ✓' : '不可用'),
        h(Tag, { color: caps.clearBadge ? 'success' : 'error' }, caps.clearBadge ? 'clearAppBadge ✓' : '不可用'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'navigator.setAppBadge(count?) → Promise<void> 在 PWA 应用图标上显示角标（未读消息数）；count 省略则显示通用圆点（无数字）。navigator.clearAppBadge() → Promise<void> 清除角标。用途：邮件/消息应用提醒未读数、待办应用提醒未完成任务。仅在 PWA 安装后有效（普通网页无桌面图标，角标不可见）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('setAppBadge(5)', { type: 'primary', size: 'sm', disabled: !caps.setBadge, onClick: () => this._setBadgeNumber() }),
          this._btn('setAppBadge() 圆点', { type: 'primary', size: 'sm', disabled: !caps.setBadge, onClick: () => this._setBadgeDot() }),
          this._btn('clearAppBadge', { danger: true, size: 'sm', disabled: !caps.clearBadge, onClick: () => this._clearBadge() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '徽章操作结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {}, s.badgeInfo || '（点击「setAppBadge」或「clearAppBadge」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`// 收到新消息时设置未读数
async function onNewMessage(unreadCount: any) {
  try {
    await navigator.setAppBadge(unreadCount);
  } catch (err: any) {
    console.error('setAppBadge failed', err);
  }
}

// 用户查看消息后清零
async function onReadAll() {
  await navigator.clearAppBadge();
  // 或 setAppBadge(0) 也等效于清除
}

// 仅显示圆点（无具体数字）
await navigator.setAppBadge();`)),
        h(Alert, {
          type: 'info',
          message: 'Badging 仅在 PWA 安装后可见',
          description: 'Badging API 设置的角标显示在 PWA 桌面/任务栏图标上；普通网页（未安装为 PWA）调用不会抛错但角标不可见。Windows 上角标显示在图标右下角，macOS 上显示在图标右上角。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：WebOTP + Credential Management ===================

  // WebOTP：navigator.credentials.get({ otp: true, signal }) → Promise<OTPCredential>
  // 返回 OTPCredential 含 .code 属性；需 AbortController 取消监听
  async _receiveOtp() {
    if (!this._caps().credentials) {
      this._addLog('warn', 'navigator.credentials 不可用（测试环境不支持，WebOTP 需 Android Chrome + HTTPS + 短信特定格式）');
      return;
    }
    if (!this._caps().abortCtrl) {
      this._addLog('warn', 'AbortController 不可用（WebOTP 监听需 AbortController 取消）');
      return;
    }
    // 清理上一次的监听
    if (this._otpController) {
      try { this._otpController.abort(); } catch { /* noop */ }
    }
    if (this._otpTimer) clearTimeout(this._otpTimer);
    const controller = new AbortController();
    this._otpController = controller;
    try {
      this._addLog('otp', '调用 navigator.credentials.get({ otp: true, signal })（10s 后自动取消）…');
      // 10 秒后自动取消监听（避免无限等待）
      this._otpTimer = setTimeout(() => {
        try { controller.abort(); } catch { /* noop */ }
      }, 10000);
      const cred = await navigator.credentials.get({ otp: true, signal: controller.signal });
      this._otpTimer = null;
      this._otpController = null;
      const code = cred && cred.code ? cred.code : '(无 code)';
      const isOtp = this._caps().otpCred ? (cred instanceof OTPCredential) : 'OTPCredential 未定义';
      this.setState({
        credInfo:
          `navigator.credentials.get({ otp: true, signal }) → Promise<OTPCredential> ✓\n` +
          `返回凭证：${cred ? cred.constructor.name : 'null'}\n` +
          `cred.code = ${code}（验证码）\n` +
          `cred instanceof OTPCredential = ${isOtp}\n` +
          `说明：WebOTP 自动从短信解析验证码；短信需含 "@example.com #12345" 格式。\n` +
          `      AbortController 用于取消监听；配合 <input autocomplete="one-time-code"> 可自动填充。`,
      });
      this._addLog('otp', `收到 OTP：code=${code}（instanceof OTPCredential=${isOtp}）`);
    } catch (err: any) {
      this._otpTimer = null;
      this._otpController = null;
      const aborted = err && err.name === 'AbortError';
      this._addLog(aborted ? 'warn' : 'error', `WebOTP 失败：${err.name}（${aborted ? '已取消（超时或用户切换页面）' : err.message}）`);
      this.setState({
        credInfo:
          `navigator.credentials.get({ otp: true }) 失败：${err.name} - ${err.message}\n` +
          (aborted ? '已通过 AbortController 取消监听（10s 超时或用户切换页面）。\n' : '') +
          `说明：WebOTP 仅 Android Chrome 支持，需 HTTPS + 短信含 "@example.com #12345" 格式。`,
      });
    }
  }

  // 手动取消 WebOTP 监听
  _cancelOtp() {
    if (this._otpController) {
      try { this._otpController.abort(); } catch { /* noop */ }
      this._otpController = null;
      this._addLog('otp', '已手动调用 AbortController.abort() 取消 WebOTP 监听');
    } else {
      this._addLog('warn', '当前无 WebOTP 监听可取消');
    }
    if (this._otpTimer) {
      clearTimeout(this._otpTimer);
      this._otpTimer = null;
    }
  }

  // navigator.credentials.create({ password: { id, password } }) → PasswordCredential
  async _createPasswordCredential() {
    if (!this._caps().credCreate) {
      this._addLog('warn', 'navigator.credentials.create 不可用（Credential Management API 需真实浏览器 + HTTPS）');
      return;
    }
    try {
      // PasswordCredential：{ id, password }
      const cred = await navigator.credentials.create({
        password: { id: 'demo@example.com', password: 'p@ssw0rd-2026' },
      });
      const isPwd = this._caps().pwdCred ? (cred instanceof PasswordCredential) : 'PasswordCredential 未定义';
      this.setState({
        credInfo:
          `navigator.credentials.create({ password: { id, password } }) → PasswordCredential ✓\n` +
          `返回凭证：${cred ? cred.constructor.name : 'null'}\n` +
          `cred.id = ${cred && cred.id ? cred.id : '(无)'}\n` +
          `cred instanceof PasswordCredential = ${isPwd}\n` +
          `说明：create 用于构造 PasswordCredential / FederatedCredential 对象；之后可通过 store() 持久化到浏览器凭证管理器。`,
      });
      this._addLog('cred', `create PasswordCredential 成功：id=${cred && cred.id}，instanceof PasswordCredential=${isPwd}`);
    } catch (err: any) {
      this._addLog('warn', `create PasswordCredential 失败：${err.name} - ${err.message}`);
      this.setState({ credInfo: `create 失败：${err.name} - ${err.message}` });
    }
  }

  // navigator.credentials.store(credential) → Promise<Credential>：存储凭证
  async _storeCredential() {
    if (!this._caps().credStore || !this._caps().credCreate) {
      this._addLog('warn', 'navigator.credentials.store / create 不可用');
      return;
    }
    try {
      const cred = await navigator.credentials.create({
        password: { id: 'store@example.com', password: 'store-pwd' },
      });
      await navigator.credentials.store((cred as any));
      this.setState({
        credInfo:
          `navigator.credentials.store(credential) → Promise<Credential> ✓\n` +
          `已构造并存储 PasswordCredential（id: store@example.com）。\n` +
          `说明：store 把凭证保存到浏览器凭证管理器；下次 get({ password: true }) 时可自动填充。常用于登录成功后保存账号密码，实现下次自动登录。`,
      });
      this._addLog('cred', `store 成功：已存储 PasswordCredential（id=store@example.com）`);
    } catch (err: any) {
      this._addLog('warn', `store 失败：${err.name} - ${err.message}`);
      this.setState({ credInfo: `store 失败：${err.name} - ${err.message}` });
    }
  }

  // navigator.credentials.preventSilentAccess() → Promise<void>：阻止自动登录
  async _preventSilentAccess() {
    if (!this._caps().preventSilent) {
      this._addLog('warn', 'navigator.credentials.preventSilentAccess 不可用');
      return;
    }
    try {
      this._addLog('cred', '调用 navigator.credentials.preventSilentAccess()…');
      await navigator.credentials.preventSilentAccess();
      this.setState({
        credInfo:
          `navigator.credentials.preventSilentAccess() → Promise<void> ✓\n` +
          `已阻止下次自动登录（下次需用户显式确认才取凭证）。\n` +
          `说明：用户登出后调用，避免下次访问时自动登录；之后 get() 会要求用户手势或 mediator: 'required'。`,
      });
      this._addLog('cred', 'preventSilentAccess 成功');
    } catch (err: any) {
      this._addLog('warn', `preventSilentAccess 失败：${err.name} - ${err.message}`);
      this.setState({ credInfo: `preventSilentAccess 失败：${err.name} - ${err.message}` });
    }
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. WebOTP + Credential Management',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.credentials ? 'success' : 'error' }, caps.credentials ? 'credentials ✓' : '不可用'),
        h(Tag, { color: caps.otpCred ? 'primary' : 'warning' }, caps.otpCred ? 'OTPCredential ✓' : 'OTP ✗'),
        h(Tag, { color: caps.pwdCred ? 'primary' : 'warning' }, caps.pwdCred ? 'PasswordCredential ✓' : 'Pwd ✗'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'WebOTP：navigator.credentials.get({ otp: true }) → Promise<OTPCredential>，返回的 OTPCredential 含 .code（短信验证码）。需 AbortController 取消监听，配合 <input autocomplete="one-time-code"> 自动填充；仅 Android Chrome 支持，短信需含 "@example.com #12345" 格式。Credential Management：create({ password: { id, password } }) 构造 PasswordCredential；store(cred) 存储；get({ password: true }) 取出；preventSilentAccess() 阻止自动登录。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('监听短信 OTP', { type: 'primary', size: 'sm', disabled: !caps.credentials, onClick: () => this._receiveOtp() }),
          this._btn('取消 OTP 监听', { size: 'sm', onClick: () => this._cancelOtp() }),
          this._btn('create PasswordCredential', { type: 'primary', size: 'sm', disabled: !caps.credCreate, onClick: () => this._createPasswordCredential() }),
          this._btn('store 凭证', { size: 'sm', disabled: !caps.credStore || !caps.credCreate, onClick: () => this._storeCredential() }),
          this._btn('preventSilentAccess', { danger: true, size: 'sm', disabled: !caps.preventSilent, onClick: () => this._preventSilentAccess() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'WebOTP / Credential 结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.credInfo || '（点击「监听短信 OTP」或「create/store PasswordCredential」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {},
`// WebOTP：监听短信验证码（带超时取消）
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 30000);
try {
  const otp = await navigator.credentials.get({
    otp: true,
    signal: controller.signal,
  });
  document.querySelector('input[autocomplete="one-time-code"]').value = otp.code;
} catch (err: any) {
  if (err.name !== 'AbortError') console.error(err);
} finally {
  clearTimeout(timer);
}

// Credential Management：保存与读取账号
const cred = await navigator.credentials.create({
  password: { id: 'user@example.com', password: 'secret' },
});
await navigator.credentials.store(cred as any);             // 登录成功后存储

const stored = await navigator.credentials.get({ password: true }); // 下次自动填充
await navigator.credentials.preventSilentAccess();   // 登出后阻止自动登录`)),
        h(Alert, {
          type: 'warning',
          message: 'WebOTP 需特定短信格式 + Android Chrome',
          description: 'WebOTP API 仅 Android Chrome 支持，要求 HTTPS 且短信内容含 "@example.com #12345" 格式（@ 后是网站域名，# 后是验证码）。配合 <input autocomplete="one-time-code"> 可自动填充。Credential Management API 桌面/移动 Chrome 均支持，但需 HTTPS。',
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
        : s.logs.map((log: any) => h('div', { class: 'log-panel__line' },
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
      h('h2', { class: 'section-title' }, 'Web Share / Contacts / Badging / WebOTP / Credential 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页演示 Web Share API（基础分享 + 文件分享）、Contact Picker API（联系人选择器）、Badging API（应用图标徽章）、WebOTP（短信验证码自动填充）与 Credential Management API（凭证管理）。这些 API 大多需要 HTTPS + 用户手势，部分仅 PWA 安装后或 Android Chrome 可用。'),
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
