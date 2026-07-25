// =====================================================================
// WritingSuggestionsAPIPage.js —— Writing Suggestions API 内置 AI 写作建议实验室
// 演示 Built-in AI 系列：WritingSuggestions（输入框内联片段建议 / 输入框补全）
//   1. API 定位与可用性 —— 与 Writer/Rewriter/Prompt 的边界
//      （内联片段建议 vs 段落改写）+ availability() 三态门控
//      （available/downloadable/no）+ create() 实例化 + 浏览器支持
//   2. WritingSuggestionsCreateOptions —— task（compose/rewrite/suggest）、
//      tone、length、format、systemPrompt、initialPrompts 配置详解
//   3. prompt() 一次性同步建议 —— create() + prompt(text, { signal })
//      + WritingSuggestion.result + 中止与超时（AbortController）
//   4. promptStreaming() 流式输出 —— promptStreaming(text)
//      + ReadableStream 流式 token 输出 + for await 异步迭代消费 + 取消流
//   5. countTokens 上下文预算 —— countTokens(text) 上下文预算管理
//      + tokensLimit/tokensSoFar + 长上下文截断策略
//   6. 表单输入框智能占位符 —— 实战：占位文本动态生成 + 输入联想下拉
//      （debounce + AbortController.any 取消上次请求）
//   7. contenteditable 编辑器内联补全 —— 实战：灰色预览 + Tab 接受/Esc 拒绝
//      + 与 EditContext 协同 + 历史上下文维护
//   8. 隐私与降级 —— 端侧 vs 云端 download 状态 + destroy() 资源释放
//      + 与 EditContext/Composition 事件冲突处理 + 与 Writer API 决策矩阵
// 说明：WritingSuggestions API 为 Chrome 138+ 实验能力（Built-in AI 系列），
//       需 HTTPS + 用户开启 chrome://flags + 模型下载。jsdom/Node 中
//       polyfill 不包含此 API，typeof 检测全部为 false / "undefined"，
//       所有调用前做能力检测，不可用时仅记日志（_addLog('warn', ...)）
//       + 设置 info 文本，绝不抛异常。在真实 Chrome 138+ 浏览器中可完整演示。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class WritingSuggestionsAPIPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      apiInfo: '',       // Card 1：API 定位与可用性
      optionsInfo: '',   // Card 2：WritingSuggestionsCreateOptions
      promptInfo: '',    // Card 3：prompt() 一次性同步建议
      streamInfo: '',    // Card 4：promptStreaming() 流式输出
      tokensInfo: '',    // Card 5：countTokens 上下文预算
      formInfo: '',      // Card 6：表单输入框智能占位符
      editorInfo: '',    // Card 7：contenteditable 编辑器内联补全
      privacyInfo: '',   // Card 8：隐私与降级
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._ws = null;                // Card 1/3/4 共享 WritingSuggestions 实例
    this._promptAbort = null;       // Card 3 prompt 中止 AbortController
    this._streamController = null;  // Card 4 流式取消 AbortController
    this._debounceTimer = null;     // Card 6 联想下拉防抖定时器
    this._formAbort = null;         // Card 6 表单联想 AbortController
    this._editorCtx = [];           // Card 7 历史上下文数组（最近 N 轮建议）
    this._dynamicStyles = [];

    // 一次性能力检测：WritingSuggestions 全家桶 + 周边（AbortController.any / EditContext）
    const caps = this._caps();
    const parts = [
      `navigator.writingSuggestions ${caps.ws ? '✓' : '✗'}`,
      `WritingSuggestions ${caps.ctor ? '✓' : '✗'}`,
      `WritingSuggestion ${caps.suggestion ? '✓' : '✗'}`,
      `AbortController.any ${caps.abortAny ? '✓' : '✗'}`,
      `EditContext ${caps.editContext ? '✓' : '✗'}`,
    ];
    const anyAvailable = caps.ws || caps.ctor;
    const summary = anyAvailable
      ? `Writing Suggestions API 能力检测：${parts.join(' · ')}。当前环境支持，可执行真实演示；其余按钮点击将仅记日志说明。`
      : `Writing Suggestions API 能力检测：${parts.join(' · ')}。该 API 为 Chrome 138+ Built-in AI 系列实验能力，需 HTTPS + chrome://flags 开启 + 模型下载；jsdom/Node 的 polyfill 不包含它们（typeof 均为 "undefined"），所有按钮点击将仅记日志说明用法与浏览器支持状态，不会抛异常。在真实 Chrome 138+ 浏览器中打开可完整演示。`;
    this.setState({ capsSummary: summary });
    this._addLog(anyAvailable ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!caps.ws) this._addLog('warn', 'navigator.writingSuggestions 不可用（Chrome 138+ 实验）');
    if (!caps.ctor) this._addLog('warn', 'WritingSuggestions 构造器不可用（typeof undefined）');
    if (!caps.suggestion) this._addLog('warn', 'WritingSuggestion 类型不可用');
    if (!caps.abortAny) this._addLog('warn', 'AbortController.any 不可用（Chrome 116+，用于多 signal 合并取消）');
    if (!caps.editContext) this._addLog('warn', 'EditContext 不可用（与内联补全协同，Chrome 138+）');

    this._injectBaseStyles();
  }

  componentWillUnmount() {
    // 中止 pending 请求（每个 try/catch，避免互相影响）
    const abort = (controller) => {
      if (controller) {
        try { controller.abort(); } catch { /* noop */ }
      }
    };
    abort(this._promptAbort);
    abort(this._streamController);
    abort(this._formAbort);
    this._promptAbort = this._streamController = this._formAbort = null;

    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }

    // 销毁 WritingSuggestions 实例（若已创建）
    if (this._ws && typeof this._ws.destroy === 'function') {
      try { this._ws.destroy(); } catch { /* noop */ }
      this._ws = null;
    }

    // 移除动态注入的样式
    for (const style of this._dynamicStyles) {
      try { style.parentNode && style.parentNode.removeChild(style); } catch { /* noop */ }
    }
    this._dynamicStyles = [];
    this._editorCtx = [];
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
    const safe = (fn) => { try { return fn(); } catch { return false; } };
    return {
      ws: safe(() => typeof navigator !== 'undefined' && !!navigator.writingSuggestions),
      ctor: safe(() => typeof WritingSuggestions !== 'undefined'),
      suggestion: safe(() => typeof WritingSuggestion !== 'undefined'),
      abortAny: safe(() => typeof AbortController !== 'undefined' &&
        typeof AbortController.any === 'function'),
      editContext: safe(() => typeof EditContext !== 'undefined'),
    };
  }

  // —— 同步能力检测（返回 Tag 数组，用于卡片右上角徽章）——
  _flags(items) {
    return items.map(([label, ok]) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  // —— 动态样式注入 ——
  _injectStyle(id, css) {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
    this._dynamicStyles.push(style);
  }

  _injectBaseStyles() {
    this._injectStyle('wsug-base', `
      .wsug-demo { padding: 16px; background: #f8fafc; border: 1px solid #cbd5e1;
        border-radius: 8px; margin-top: 10px; }
      .wsug-ghost { color: #94a3b8; }
      .wsug-editor { min-height: 120px; border: 1px solid #cbd5e1; border-radius: 8px;
        padding: 10px; outline: none; background: #fff; line-height: 1.6; }
      .wsug-editor:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }
      .wsug-completion { color: #94a3b8; background: #f8fafc; }
      .wsug-input { width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1;
        border-radius: 6px; font-size: 14px; box-sizing: border-box; }
      .wsug-input:focus { border-color: #3b82f6; outline: none;
        box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }
      .wsug-suggest-list { margin-top: 6px; border: 1px solid #e2e8f0;
        border-radius: 6px; overflow: hidden; background: #fff; }
      .wsug-suggest-item { padding: 6px 12px; font-size: 13px;
        border-bottom: 1px solid #f1f5f9; cursor: pointer; }
      .wsug-suggest-item:last-child { border-bottom: none; }
      .wsug-suggest-item:hover { background: #eff6ff; }
      .wsug-kbd { display: inline-block; padding: 1px 6px; border-radius: 4px;
        background: #f1f5f9; border: 1px solid #cbd5e1; font-family: monospace;
        font-size: 11px; }
      .wsug-matrix { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 8px; margin-top: 10px; }
      .wsug-matrix-cell { background: #fff; border: 1px solid #e2e8f0;
        border-radius: 6px; padding: 8px; font-size: 12px; }
      .wsug-matrix-cell--yes { border-color: #86efac; background: #f0fdf4; }
      .wsug-matrix-cell--no { border-color: #fca5a5; background: #fef2f2; }
      .wsug-pill { display: inline-block; padding: 1px 8px; border-radius: 10px;
        font-size: 11px; font-weight: 600; margin-right: 4px; }
      .wsug-pill--compose { background: #dbeafe; color: #1e40af; }
      .wsug-pill--rewrite { background: #fef3c7; color: #92400e; }
      .wsug-pill--suggest { background: #dcfce7; color: #166534; }
    `);
  }

  // =================== Card 1：API 定位与可用性 ===================

  // 检测 navigator.writingSuggestions.availability 并说明三态门控
  async _checkApi() {
    const caps = this._caps();
    if (!caps.ws && !caps.ctor) {
      this.setState({ apiInfo:
        'WritingSuggestions API 用法（测试环境不可用，仅说明）：\n\n' +
        '// 1. 静态：检查可用性（返回 Availability 三态）\n' +
        "const status = await navigator.writingSuggestions.availability();\n" +
        "// 'available' | 'downloadable' | 'no'\n\n" +
        '// 2. 创建实例（若 status=downloadable 会触发模型下载，monitor 回调上报进度）\n' +
        "const ws = await navigator.writingSuggestions.create({\n" +
        "  task: 'compose',\n" +
        "  monitor: (downloadProgress) => console.log(downloadProgress),\n" +
        '});\nws.destroy();   // 释放\n\n' +
        '说明：Chrome 138+ 提供（Built-in AI 系列），多数环境需在 chrome://flags\n' +
        '  开启 Built-in AI 并下载模型；本环境 navigator.writingSuggestions 与\n' +
        '  typeof WritingSuggestions 均为 undefined，仅记录用法。' });
      this._addLog('warn', 'WritingSuggestions 不可用（typeof undefined），已记录用法');
      return;
    }
    try {
      this._addLog('info', '检测 navigator.writingSuggestions.availability()…');
      const availability = (typeof navigator.writingSuggestions.availability === 'function')
        ? await navigator.writingSuggestions.availability()
        : 'unknown';
      this.setState({ apiInfo:
        `navigator.writingSuggestions.availability() = ${JSON.stringify(availability)}\n\n` +
        'Availability 三态含义：\n' +
        "  'available'   —— 模型已就绪，可直接 create\n" +
        "  'downloadable' —— 可下载，create 时通过 monitor 回调上报下载进度\n" +
        "  'no'          —— 当前环境/语言不支持，应做降级\n\n" +
        '点击「创建实例」调用 create({ task: "compose" }) 实例化。' });
      this._addLog('wsug', `availability() = ${availability}`);
    } catch (err) {
      this._addLog('warn', `availability 失败：${err.name} - ${err.message}`);
    }
  }

  // 创建 WritingSuggestions 实例（compose 任务）
  async _createInstance() {
    const caps = this._caps();
    if (!caps.ws && !caps.ctor) {
      this._addLog('warn', 'WritingSuggestions 不可用，无法创建实例');
      return;
    }
    try {
      if (this._ws && typeof this._ws.destroy === 'function') {
        try { this._ws.destroy(); } catch { /* noop */ }
      }
      this._addLog('info', '开始创建 WritingSuggestions（task=compose），若需下载模型会通过 monitor 回调上报进度…');
      const factory = navigator.writingSuggestions;
      const ws = await factory.create({
        task: 'compose',
        monitor: (p) => {
          this._addLog('wsug', `模型下载进度：${typeof p === 'number' ? Math.round(p * 100) + '%' : JSON.stringify(p)}`);
        },
      });
      this._ws = ws;
      this.setState({ apiInfo:
        "navigator.writingSuggestions.create({ task: 'compose', monitor }) → WritingSuggestions 实例\n" +
        '  monitor 回调接收 downloadProgress（下载进度）\n\n' +
        '实例方法：\n' +
        '  ws.prompt(text, { signal })             —— 一次性同步建议（见 Card 3）\n' +
        '  ws.promptStreaming(text, { signal })    —— 流式建议（见 Card 4）\n' +
        '  ws.countTokens(text)                    —— token 预算（见 Card 5）\n' +
        '  ws.tokensLimit / ws.tokensSoFar         —— 预算上下文\n' +
        '  ws.destroy()                             —— 释放\n\n' +
        '实例已创建，后续卡片可复用此实例执行 prompt/promptStreaming/countTokens。' });
      this._addLog('wsug', 'WritingSuggestions 实例已创建（task=compose）');
    } catch (err) {
      this._addLog('warn', `WritingSuggestions 创建失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. API 定位与可用性 —— 与 Writer/Rewriter/Prompt 的边界',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.ws ? 'success' : 'error' }, caps.ws ? 'navigator.writingSuggestions ✓' : 'navigator.writingSuggestions ✗'),
        h(Tag, { color: 'primary' }, 'Chrome 138+'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'WritingSuggestions API 提供「输入框内联片段建议」（input 预测补全），定位在表单/编辑器内联补全场景，与 Writer/Rewriter（段落级改写）和 Prompt/LanguageModel（通用对话）边界清晰。navigator.writingSuggestions.availability() 返回三态 Availability（available / downloadable / no）；create({ task, monitor }) 返回 Promise<WritingSuggestions>，实例方法 prompt / promptStreaming / countTokens，destroy() 释放。Chrome 138+ 提供（Built-in AI 系列），多数环境需 chrome://flags 开启 + 模型下载。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测 availability', { type: 'primary', size: 'sm', disabled: !caps.ws && !caps.ctor, onClick: () => this._checkApi() }),
          this._btn('创建实例', { size: 'sm', disabled: !caps.ws && !caps.ctor, onClick: () => this._createInstance() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'API 定位与可用性：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, s.apiInfo || '（点击「检测 availability」或「创建实例」）')),
        h(Alert, {
          type: 'info',
          message: 'WritingSuggestions = 内联片段建议；Writer/Rewriter = 段落级改写',
          description: 'WritingSuggestions 用于输入框内联补全（短片段、低延迟、随输入触发），输出的是「补全片段」而非整段改写。Writer API 用于整段撰写（compose）、Rewriter 用于整段改写（rewrite）、Prompt/LanguageModel 用于通用对话。三者底层都走 Built-in AI 模型，但 API 形态与适用场景不同。本卡片先做能力检测与实例化。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：WritingSuggestionsCreateOptions ===================

  _showOptions() {
    const caps = this._caps();
    if (!caps.ws && !caps.ctor) {
      this.setState({ optionsInfo:
        'WritingSuggestionsCreateOptions 字段清单（测试环境不可用，仅说明）：\n\n' +
        "navigator.writingSuggestions.create({\n" +
        "  task: 'compose',           // 'compose' | 'rewrite' | 'suggest'\n" +
        "  tone: 'professional',      // 'neutral' | 'as-is' | 'more-formal' | 'more-casual'\n" +
        "  length: 'short',           // 'as-is' | 'short' | 'medium' | 'long'\n" +
        "  format: 'markdown',        // 'as-is' | 'plain-text' | 'markdown'\n" +
        "  systemPrompt: '...',       // 自定义系统提示词（覆盖默认）\n" +
        "  initialPrompts: [          // 初始上下文（多轮会话记忆）\n" +
        "    { role: 'system',    content: '你是邮件助手' },\n" +
        "    { role: 'user',      content: '示例：写一封请假邮件' },\n" +
        "    { role: 'assistant', content: '尊敬的领导…' },\n" +
        "  ],\n" +
        "  monitor: (p) => {},        // 模型下载进度回调\n" +
        "});\n\n" +
        '说明：Chrome 138+ 提供；本环境不可用，仅记录字段说明。' });
      this._addLog('warn', 'WritingSuggestions 不可用，已记录 CreateOptions 字段说明');
      return;
    }
    this.setState({ optionsInfo:
      '===== WritingSuggestionsCreateOptions 字段详解 =====\n\n' +
      '【task：任务类型（核心字段，决定输出形态）】\n' +
      "  'compose' —— 续写补全（默认），输入文本作为前缀，输出补全后缀\n" +
      "  'rewrite' —— 改写已输入文本（基于 tone/length/format 改写整段）\n" +
      "  'suggest' —— 生成多个建议片段（候选项列表）\n\n" +
      '【tone：语气】\n' +
      "  'neutral' | 'as-is' | 'more-formal' | 'more-casual'\n\n" +
      '【length：长度】\n' +
      "  'as-is' | 'short' | 'medium' | 'long'\n\n" +
      '【format：输出格式】\n' +
      "  'as-is' | 'plain-text' | 'markdown'\n\n" +
      '【systemPrompt：自定义系统提示词】\n' +
      '  覆盖默认系统提示词；为空时使用浏览器内置默认\n\n' +
      '【initialPrompts：初始上下文（多轮会话记忆）】\n' +
      "  数组，每项 { role: 'system'|'user'|'assistant', content: string }\n" +
      '  用于注入业务上下文、few-shot 示例、用户身份等\n\n' +
      '【monitor：下载进度回调】\n' +
      '  (downloadProgress: number) => void，仅在 downloadable 时触发\n' });
    this._addLog('wsug', '已列出 WritingSuggestionsCreateOptions 字段说明');
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. WritingSuggestionsCreateOptions —— task / tone / length / format / systemPrompt / initialPrompts',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._flags([['create()', caps.ws || caps.ctor]]),
        h(Tag, { color: 'primary' }, '配置'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'create() 接受 WritingSuggestionsCreateOptions 对象：task（compose 续写 / rewrite 改写 / suggest 候选）、tone（语气：neutral/as-is/more-formal/more-casual）、length（长度：as-is/short/medium/long）、format（格式：as-is/plain-text/markdown）、systemPrompt（自定义系统提示词，覆盖默认）、initialPrompts（初始上下文数组，支持 system/user/assistant 三种 role，用于多轮会话与 few-shot 示例）、monitor（模型下载进度回调）。task 决定输出形态，tone/length/format 仅对 rewrite 任务有意义。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('查看 CreateOptions 字段', { type: 'primary', size: 'sm', onClick: () => this._showOptions() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '420px', overflow: 'auto' } },
          h('code', {}, `// compose 续写：输入作前缀，输出补全后缀
const ws = await navigator.writingSuggestions.create({
  task: 'compose',
  tone: 'professional',
  length: 'short',
  format: 'plain-text',
  initialPrompts: [
    { role: 'system',    content: '你是企业邮件助手，语气正式' },
    { role: 'user',      content: '请帮我写一封请假邮件' },
    { role: 'assistant', content: '尊敬的领导：因个人事务…' },
  ],
});

// rewrite 改写：基于 tone/length/format 改写整段
const rewriter = await navigator.writingSuggestions.create({
  task: 'rewrite',
  tone: 'more-formal',
  length: 'medium',
  format: 'markdown',
});

// suggest 候选：生成多个建议片段（候选项列表）
const suggester = await navigator.writingSuggestions.create({
  task: 'suggest',
  systemPrompt: '为搜索框生成 3 个补全建议',
});`)),
        h('div', { class: 'fs-sm text-secondary' }, '字段说明：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, s.optionsInfo || '（点击「查看 CreateOptions 字段」）')),
        h(Alert, {
          type: 'warning',
          message: 'tone/length/format 仅对 rewrite 任务有意义；compose 任务忽略它们',
          description: 'compose 任务以输入文本为前缀，输出补全后缀，tone/length/format 不影响。rewrite 任务基于这些字段改写整段文本。suggest 任务输出多个候选片段（候选项列表），用于搜索框/下拉联想场景。initialPrompts 的 role 必须为 system/user/assistant 之一。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：prompt() 一次性同步建议 ===================

  async _runPrompt() {
    const caps = this._caps();
    if (!caps.ws && !caps.ctor) {
      this.setState({ promptInfo:
        'prompt() 一次性同步建议用法（测试环境不可用，仅说明）：\n\n' +
        "const ws = await navigator.writingSuggestions.create({\n" +
        "  task: 'compose',\n" +
        "  tone: 'professional',\n" +
        "});\n" +
        "const ac = new AbortController();\n" +
        "// 超时自动中止\n" +
        "const timer = setTimeout(() => ac.abort(), 3000);\n" +
        "try {\n" +
        "  const suggestion = await ws.prompt('完成这封邮件', { signal: ac.signal });\n" +
        "  // suggestion: WritingSuggestion\n" +
        "  console.log(suggestion.result);   // 建议文本\n" +
        "} catch (err) {\n" +
        "  if (err.name === 'AbortError') console.log('已中止或超时');\n" +
        "  else throw err;\n" +
        "} finally {\n" +
        "  clearTimeout(timer);\n" +
        "  ws.destroy();\n" +
        "}\n\n" +
        '说明：prompt 返回 WritingSuggestion 对象，访问 .result 取建议文本；\n' +
        '  signal 来自 AbortController，abort() 触发 AbortError；本环境不可用。' });
      this._addLog('warn', 'WritingSuggestions 不可用，已记录 prompt() 用法');
      return;
    }
    try {
      if (!this._ws) {
        this._addLog('info', '尚未创建实例，自动创建 task=compose 实例…');
        await this._createInstance();
      }
      const ws = this._ws;
      const ac = new AbortController();
      this._promptAbort = ac;
      const timer = setTimeout(() => ac.abort(), 3000);
      const input = '完成这封邮件：尊敬的领导，我因个人事务需要请假三天，';
      this._addLog('wsug', `prompt("${input}") 调用中…`);
      const suggestion = await ws.prompt(input, { signal: ac.signal });
      clearTimeout(timer);
      this._promptAbort = null;
      const result = suggestion && typeof suggestion.result === 'string' ? suggestion.result : String(suggestion);
      this.setState({ promptInfo:
        `ws.prompt('${input}', { signal }) → WritingSuggestion\n\n` +
        `suggestion.result = "${result}"\n\n` +
        '说明：\n' +
        '  - prompt 返回 WritingSuggestion 对象，访问 .result 取建议文本\n' +
        '  - signal 来自 AbortController，abort() 触发 AbortError\n' +
        '  - 超时策略：setTimeout + ac.abort()，3 秒未返回自动中止' });
      this._addLog('wsug', `prompt 结果：${result}`);
    } catch (err) {
      if (err.name === 'AbortError') {
        this._addLog('warn', 'prompt 已中止或超时（AbortError）');
      } else {
        this._addLog('warn', `prompt 失败：${err.name} - ${err.message}`);
      }
    }
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. prompt() 一次性同步建议 —— create + signal + WritingSuggestion.result',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.suggestion ? 'success' : 'error' }, caps.suggestion ? 'WritingSuggestion ✓' : 'WritingSuggestion ✗'),
        h(Tag, { color: 'primary' }, '一次性'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'create() 后调用 ws.prompt(text, { signal }) 返回 Promise<WritingSuggestion>，访问 .result 取建议文本。signal 来自 AbortController，abort() 触发 AbortError；超时策略：setTimeout + ac.abort()，N 秒未返回自动中止。prompt 一次性同步返回完整建议，适合低延迟补全（如占位文本生成）。compose 任务下输入文本作为前缀，输出是补全后缀；rewrite 任务下输入是被改写的整段。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 prompt 演示', { type: 'primary', size: 'sm', disabled: !caps.ws && !caps.ctor, onClick: () => this._runPrompt() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '420px', overflow: 'auto' } },
          h('code', {}, `const ws = await navigator.writingSuggestions.create({
  task: 'compose',
  tone: 'professional',
});
const ac = new AbortController();
// 超时自动中止（3 秒）
const timer = setTimeout(() => ac.abort(), 3000);
try {
  const suggestion = await ws.prompt(
    '完成这封邮件：尊敬的领导，我因个人事务需要请假三天，',
    { signal: ac.signal }
  );
  // suggestion: WritingSuggestion
  console.log(suggestion.result);   // 建议文本
} catch (err) {
  if (err.name === 'AbortError') {
    console.log('已中止或超时');
  } else {
    throw err;
  }
} finally {
  clearTimeout(timer);
  ws.destroy();
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, s.promptInfo || '（点击「运行 prompt 演示」）')),
        h(Alert, {
          type: 'info',
          message: 'prompt 返回 WritingSuggestion 对象，访问 .result 取建议文本',
          description: 'WritingSuggestion 是 prompt 的返回值，包含 .result（建议文本字符串）。prompt 一次性同步返回完整建议；若需边生成边显示（token 流式输出），请用 promptStreaming（见 Card 4）。AbortController.signal 传入 prompt 可中止请求，abort() 触发 AbortError，需在 try/catch 中处理。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：promptStreaming() 流式输出 ===================

  async _runStreaming() {
    const caps = this._caps();
    if (!caps.ws && !caps.ctor) {
      this.setState({ streamInfo:
        'promptStreaming() 流式输出用法（测试环境不可用，仅说明）：\n\n' +
        "const ws = await navigator.writingSuggestions.create({ task: 'compose' });\n" +
        "const ac = new AbortController();\n" +
        "const stream = ws.promptStreaming('续写一段产品介绍', { signal: ac.signal });\n" +
        "// stream: ReadableStream（异步可迭代）\n" +
        "let full = '';\n" +
        "for await (const chunk of stream) {\n" +
        "  // chunk 是增量 token 片段\n" +
        "  full += chunk;\n" +
        "  // 实时渲染：appendChunkToDOM(chunk);\n" +
        "}\n" +
        "console.log('完整结果：', full);\n\n" +
        "// 取消流：ac.abort();  for await 会抛 AbortError\n" +
        "setTimeout(() => ac.abort(), 1500);\n\n" +
        '说明：promptStreaming 返回 ReadableStream，可异步迭代消费；\n' +
        '  每个 chunk 是增量 token，concat 得到完整文本；本环境不可用。' });
      this._addLog('warn', 'WritingSuggestions 不可用，已记录 promptStreaming() 用法');
      return;
    }
    try {
      if (!this._ws) {
        this._addLog('info', '尚未创建实例，自动创建 task=compose 实例…');
        await this._createInstance();
      }
      const ws = this._ws;
      const ac = new AbortController();
      this._streamController = ac;
      const input = '续写一段产品介绍：本产品是一款面向开发者的';
      this._addLog('wsug', `promptStreaming("${input}") 流式输出中…`);
      const stream = ws.promptStreaming(input, { signal: ac.signal });
      let full = '';
      const chunks = [];
      // ReadableStream 异步迭代（for await ... of）
      for await (const chunk of stream) {
        const piece = typeof chunk === 'string' ? chunk : String(chunk);
        full += piece;
        chunks.push(piece);
        this._addLog('wsug', `流式 chunk：${piece.length > 20 ? piece.slice(0, 20) + '…' : piece}`);
      }
      this._streamController = null;
      this.setState({ streamInfo:
        `ws.promptStreaming('${input}', { signal }) → ReadableStream\n\n` +
        `for await (const chunk of stream) 消费 ${chunks.length} 个 chunk：\n` +
        chunks.map((c, i) => `  [${i + 1}] ${c}`).join('\n') + '\n\n' +
        `完整结果：${full}\n\n` +
        '说明：\n' +
        '  - promptStreaming 返回 ReadableStream，可异步迭代（for await ... of）\n' +
        '  - 每个 chunk 是增量 token 片段，concat 得到完整文本\n' +
        '  - 取消流：ac.abort()，for await 会抛 AbortError\n' +
        '  - 适合实时打字机效果、长文本生成' });
      this._addLog('wsug', `promptStreaming 完成，共 ${chunks.length} 个 chunk`);
    } catch (err) {
      if (err.name === 'AbortError') {
        this._addLog('warn', 'promptStreaming 已取消（AbortError）');
      } else {
        this._addLog('warn', `promptStreaming 失败：${err.name} - ${err.message}`);
      }
    }
  }

  _cancelStreaming() {
    if (this._streamController) {
      try { this._streamController.abort(); } catch { /* noop */ }
      this._addLog('warn', '已调用 ac.abort() 取消流式输出');
    } else {
      this._addLog('warn', '当前无流式输出在进行');
    }
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. promptStreaming() 流式输出 —— ReadableStream + for await 异步迭代',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.ws ? 'success' : 'error' }, caps.ws ? 'stream ✓' : 'stream ✗'),
        h(Tag, { color: 'primary' }, '流式'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'ws.promptStreaming(text, { signal }) 返回 ReadableStream，可用 for await...of 异步迭代消费增量 token。每个 chunk 是增量片段，concat 得到完整文本。适合实时打字机效果、长文本生成。取消流：ac.abort()，for await 会抛 AbortError。与 prompt() 的区别：prompt 一次性同步返回完整结果，promptStreaming 边生成边返回（更早可见首字，体验更佳，适合编辑器内联补全场景）。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行流式演示', { type: 'primary', size: 'sm', disabled: !caps.ws && !caps.ctor, onClick: () => this._runStreaming() }),
          this._btn('取消流', { size: 'sm', onClick: () => this._cancelStreaming() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '480px', overflow: 'auto' } },
          h('code', {}, `const ws = await navigator.writingSuggestions.create({ task: 'compose' });
const ac = new AbortController();
const stream = ws.promptStreaming(
  '续写一段产品介绍',
  { signal: ac.signal }
);
// stream: ReadableStream（异步可迭代）

let full = '';
// for await 消费流式 token
for await (const chunk of stream) {
  // chunk 是增量 token 片段
  full += chunk;
  // 实时渲染：appendChunkToDOM(chunk);
  console.log('chunk:', chunk);
}
console.log('完整结果：', full);

// 取消流：ac.abort();  for await 会抛 AbortError
setTimeout(() => {
  if (stillGenerating) ac.abort();
}, 1500);

// try/catch 处理中止
try {
  for await (const chunk of stream) { full += chunk; }
} catch (err) {
  if (err.name === 'AbortError') console.log('已取消');
  else throw err;
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, s.streamInfo || '（点击「运行流式演示」）')),
        h(Alert, {
          type: 'info',
          message: 'promptStreaming 返回 ReadableStream，可异步迭代消费',
          description: 'ReadableStream 实现了 AsyncIterable 协议，可直接用 for await...of 消费。每个 chunk 是增量 token 片段。取消流：ac.abort()，for await 会抛 AbortError。与一次性 prompt 相比，流式更早可见首字（首字延迟低），适合编辑器内联补全、长文本生成、打字机效果等场景。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：countTokens 上下文预算 ===================

  async _runCountTokens() {
    const caps = this._caps();
    if (!caps.ws && !caps.ctor) {
      this.setState({ tokensInfo:
        'countTokens 上下文预算管理用法（测试环境不可用，仅说明）：\n\n' +
        "const ws = await navigator.writingSuggestions.create({ task: 'compose' });\n" +
        "const used = await ws.countTokens('一段需要计算 token 的文本');\n" +
        "// ws.tokensLimit   —— 模型上下文窗口上限（如 4096）\n" +
        "// ws.tokensSoFar   —— 已用 token 数（含 initialPrompts）\n" +
        "console.log(used, '/', ws.tokensLimit);\n\n" +
        "// 长上下文截断策略：保留最近 N 轮\n" +
        "function trimContext(history, ws) {\n" +
        "  while (history.length > 0 &&\n" +
        "         ws.tokensSoFar + await ws.countTokens(history[0].content) > ws.tokensLimit * 0.8) {\n" +
        "    history.shift();  // 丢弃最旧\n" +
        "  }\n" +
        "}\n\n" +
        '说明：countTokens 返回 Promise<number>；tokensLimit/tokensSoFar 是\n' +
        '  实例属性；本环境不可用。' });
      this._addLog('warn', 'WritingSuggestions 不可用，已记录 countTokens 用法');
      return;
    }
    try {
      if (!this._ws) {
        this._addLog('info', '尚未创建实例，自动创建 task=compose 实例…');
        await this._createInstance();
      }
      const ws = this._ws;
      const sample = '本产品是一款面向开发者的智能编辑器，支持语法高亮、自动补全、内置 AI 写作建议等功能。';
      const tokens = (typeof ws.countTokens === 'function')
        ? await ws.countTokens(sample)
        : '(未实现)';
      const limit = ws.tokensLimit ?? '(未知)';
      const soFar = ws.tokensSoFar ?? '(未知)';
      this.setState({ tokensInfo:
        `ws.countTokens('${sample.slice(0, 20)}…')\n` +
        `  → ${tokens} tokens\n\n` +
        `ws.tokensLimit = ${limit}    （模型上下文窗口上限）\n` +
        `ws.tokensSoFar  = ${soFar}    （已用 token，含 initialPrompts）\n\n` +
        '说明：\n' +
        '  - countTokens(text) 返回 Promise<number>，预估文本 token 数\n' +
        '  - tokensLimit 是模型上下文窗口上限（如 4096）\n' +
        '  - tokensSoFar 是当前会话已用 token（含 initialPrompts）\n' +
        '  - 长上下文截断策略：保留最近 N 轮，超 80% 上限则丢弃最旧' });
      this._addLog('wsug', `countTokens=${tokens}，limit=${limit}，soFar=${soFar}`);
    } catch (err) {
      this._addLog('warn', `countTokens 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. countTokens 上下文预算 —— tokensLimit / tokensSoFar 与截断策略',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.ws ? 'success' : 'error' }, caps.ws ? 'countTokens ✓' : 'countTokens ✗'),
        h(Tag, { color: 'primary' }, '预算'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'ws.countTokens(text) 返回 Promise<number>，预估文本 token 数；ws.tokensLimit 是模型上下文窗口上限（如 4096）；ws.tokensSoFar 是当前会话已用 token（含 initialPrompts）。长上下文截断策略：保留最近 N 轮上下文，当 tokensSoFar 超过 tokensLimit × 80% 时丢弃最旧一轮。countTokens 用于在 prompt/promptStreaming 前预估上下文占用，避免超限报错；多轮会话场景必备。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 countTokens 演示', { type: 'primary', size: 'sm', disabled: !caps.ws && !caps.ctor, onClick: () => this._runCountTokens() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '460px', overflow: 'auto' } },
          h('code', {}, `const ws = await navigator.writingSuggestions.create({ task: 'compose' });

const used = await ws.countTokens('一段需要计算 token 的文本');
// ws.tokensLimit   —— 模型上下文窗口上限（如 4096）
// ws.tokensSoFar   —— 已用 token 数（含 initialPrompts）
console.log(used, '/', ws.tokensLimit);

// 长上下文截断策略：保留最近 N 轮，超 80% 上限丢弃最旧
async function trimContext(history, ws) {
  while (history.length > 0) {
    const next = await ws.countTokens(history[0].content);
    if (ws.tokensSoFar + next > ws.tokensLimit * 0.8) {
      history.shift();   // 丢弃最旧一轮
    } else {
      break;
    }
  }
}

// prompt 前预估：避免超限报错
async function safePrompt(ws, text) {
  const need = await ws.countTokens(text);
  if (ws.tokensSoFar + need > ws.tokensLimit) {
    throw new Error('上下文超限，请清理历史');
  }
  return (await ws.prompt(text)).result;
}`)),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } },
          h('code', {}, s.tokensInfo || '（点击「运行 countTokens 演示」）')),
        h(Alert, {
          type: 'warning',
          message: 'tokensLimit/tokensSoFar 是实例属性，countTokens 是实例方法',
          description: 'tokensLimit 在 create 后即可读取（模型上下文窗口上限）。tokensSoFar 随会话进行累加（含 initialPrompts 与每次 prompt/promptStreaming 的输入输出）。countTokens 用于在调用前预估，避免超限。多轮会话场景建议保留最近 N 轮上下文，超 80% 上限则丢弃最旧。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：表单输入框智能占位符 ===================

  _runFormDemo() {
    const caps = this._caps();
    this._injectStyle('wsug-form-demo', `
      .wsug-form-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (!caps.ws && !caps.ctor) {
      this._addLog('warn', 'WritingSuggestions 不可用，跳过表单占位符真实演示（仅记日志）');
    } else {
      this._addLog('info', '检测到 WritingSuggestions 支持，开始表单占位符演示');
    }
    this.setState({ formInfo:
      '===== 表单输入框智能占位符实战 =====\n\n' +
      '【场景 1：占位文本动态生成】\n' +
      '  // 根据表单其他字段动态生成占位提示\n' +
      "  async function genPlaceholder(formType) {\n" +
      "    const ws = await navigator.writingSuggestions.create({\n" +
      "      task: 'compose',\n" +
      "      systemPrompt: `为${formType}生成一个简短占位提示`,\n" +
      "    });\n" +
      "    const ac = new AbortController();\n" +
      "    const timer = setTimeout(() => ac.abort(), 2000);\n" +
      "    try {\n" +
      "      const suggestion = await ws.prompt(`生成${formType}的占位提示`, { signal: ac.signal });\n" +
      "      return suggestion.result;\n" +
      "    } catch (e) { return formType + '…'; }\n" +
      "    finally { clearTimeout(timer); ws.destroy(); }\n" +
      "  }\n" +
      "  inputEl.placeholder = await genPlaceholder('请假原因');\n\n" +
      '【场景 2：输入联想下拉（debounce + AbortController.any 取消上次）】\n' +
      "  let pendingAC = null;        // 上次请求的 AbortController\n" +
      "  let ws = null;\n" +
      "  async function ensureWS() {\n" +
      "    if (!ws) ws = await navigator.writingSuggestions.create({ task: 'suggest' });\n" +
      "    return ws;\n" +
      "  }\n" +
      "  input.addEventListener('input', async (e) => {\n" +
      "    // 1. 取消上次请求\n" +
      "    if (pendingAC) pendingAC.abort();\n" +
      "    // 2. debounce 300ms\n" +
      "    clearTimeout(debounceTimer);\n" +
      "    debounceTimer = setTimeout(async () => {\n" +
      "      pendingAC = new AbortController();\n" +
      "      // AbortController.any 合并取消（用户输入 + 超时）\n" +
      "      const timeoutAC = new AbortController();\n" +
      "      const merged = AbortController.any([pendingAC, timeoutAC]);\n" +
      "      const t = setTimeout(() => timeoutAC.abort(), 1500);\n" +
      "      try {\n" +
      "        const inst = await ensureWS();\n" +
      "        const suggestion = await inst.prompt(e.target.value, { signal: merged.signal });\n" +
      "        showSuggestions(suggestion.result.split('\\n'));\n" +
      "      } catch (err) {\n" +
      "        if (err.name !== 'AbortError') console.error(err);\n" +
      "      } finally { clearTimeout(t); }\n" +
      "    }, 300);\n" +
      "  });\n\n" +
      '【AbortController.any 用法】\n' +
      "  // 合并多个 signal：任一 abort 即触发合并 signal abort\n" +
      "  const ac1 = new AbortController();   // 用户输入取消\n" +
      "  const ac2 = new AbortController();   // 超时取消\n" +
      "  const merged = AbortController.any([ac1, ac2]);\n" +
      "  fetch(url, { signal: merged.signal });\n" +
      "  // ac1.abort() 或 ac2.abort() 都会中止 fetch\n\n" +
      '【关键点】\n' +
      '  1. debounce 300ms 避免每次按键都请求\n' +
      '  2. AbortController.any 合并「用户输入取消」+「超时取消」两个 signal\n' +
      '  3. 复用 ws 实例（避免每次 create 开销）\n' +
      '  4. AbortError 静默处理（正常取消，非错误）\n' +
      '  5. 任务类型用 suggest（候选项列表）或 compose（单条补全）\n\n' +
      `【当前环境】navigator.writingSuggestions: ${caps.ws ? '✓' : '✗'}，AbortController.any: ${caps.abortAny ? '✓' : '✗'}` });
    this._addLog('wsug', `表单占位符演示完成；supports=${caps.ws || caps.ctor}，abortAny=${caps.abortAny}`);
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. 表单输入框智能占位符 —— debounce + AbortController.any',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._flags([['writingSuggestions', caps.ws || caps.ctor], ['AbortController.any', caps.abortAny]]),
        h(Tag, { color: 'primary' }, '表单实战'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '实战 1：占位文本动态生成 —— 根据表单其他字段（如 formType）调用 prompt 生成简短占位提示，超时降级到默认文本。实战 2：输入联想下拉 —— input 事件 debounce 300ms 后请求，AbortController.any 合并「用户输入取消」+「超时取消」两个 signal，任一 abort 即中止上次请求；复用 ws 实例避免 create 开销；AbortError 静默处理。任务类型用 suggest（候选项列表）或 compose（单条补全）。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行表单实战演示', { type: 'primary', size: 'sm', onClick: () => this._runFormDemo() }),
        ),
        h('div', { class: 'wsug-form-host' },
          h('input', { class: 'wsug-input', type: 'text', placeholder: '（演示输入框：在真实浏览器中可触发联想）', disabled: true }),
          h('div', { class: 'wsug-suggest-list', style: { marginTop: '6px' } },
            h('div', { class: 'wsug-suggest-item' }, '示例联想项 1'),
            h('div', { class: 'wsug-suggest-item' }, '示例联想项 2'),
            h('div', { class: 'wsug-suggest-item' }, '示例联想项 3'),
          ),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 输入联想下拉（debounce + AbortController.any）
let pendingAC = null;        // 上次请求的 AbortController
let ws = null;
const debounceTimer = { id: null };

async function ensureWS() {
  if (!ws) ws = await navigator.writingSuggestions.create({ task: 'suggest' });
  return ws;
}

input.addEventListener('input', async (e) => {
  // 1. 取消上次请求
  if (pendingAC) pendingAC.abort();
  // 2. debounce 300ms
  clearTimeout(debounceTimer.id);
  debounceTimer.id = setTimeout(async () => {
    pendingAC = new AbortController();
    // AbortController.any 合并取消（用户输入 + 超时）
    const timeoutAC = new AbortController();
    const merged = AbortController.any([pendingAC, timeoutAC]);
    const t = setTimeout(() => timeoutAC.abort(), 1500);
    try {
      const inst = await ensureWS();
      const suggestion = await inst.prompt(e.target.value, { signal: merged.signal });
      showSuggestions(suggestion.result.split('\\n'));
    } catch (err) {
      if (err.name !== 'AbortError') console.error(err);
    } finally { clearTimeout(t); }
  }, 300);
});`)),
        h('div', { class: 'fs-sm text-secondary' }, '完整说明：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.formInfo || '（点击「运行表单实战演示」）')),
        h(Alert, {
          type: 'info',
          message: 'AbortController.any 合并多个 signal，任一 abort 即触发合并 signal abort',
          description: 'AbortController.any([ac1, ac2]) 返回合并后的 AbortController，ac1 或 ac2 任一 abort 都会触发 merged.signal.abort。本场景合并「用户输入取消」（用户继续输入新字符）+「超时取消」（1500ms 未返回），避免旧请求占用模型与带宽。Chrome 116+ 支持。debounce 300ms 避免每次按键都请求，复用 ws 实例避免 create 开销。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 7：contenteditable 编辑器内联补全 ===================

  _runEditorDemo() {
    const caps = this._caps();
    this._injectStyle('wsug-editor-demo', `
      .wsug-editor-host { padding: 12px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
    `);
    if (!caps.ws && !caps.ctor) {
      this._addLog('warn', 'WritingSuggestions 不可用，跳过编辑器内联补全真实演示（仅记日志）');
    } else {
      this._addLog('info', '检测到 WritingSuggestions 支持，开始编辑器内联补全演示');
    }
    this.setState({ editorInfo:
      '===== contenteditable 编辑器内联补全实战 =====\n\n' +
      '【UI 效果：灰色预览 + Tab 接受 / Esc 拒绝】\n' +
      '  // 用户输入时，灰色文本预览补全；Tab 接受，Esc 拒绝\n' +
      "  // DOM 结构：contenteditable=true 容器，补全片段用 <span class='wsug-completion'>\n" +
      "  <div contenteditable='true' class='wsug-editor'>\n" +
      "    用户已输入文本<span class='wsug-completion'>灰色补全预览</span>\n" +
      "  </div>\n\n" +
      '【与 EditContext 协同（避免 IME / 重渲染干扰）】\n' +
      "  // EditContext 提供低层文本输入 API，不触发 DOM 重渲染\n" +
      "  // 适合 contenteditable 内联补全场景\n" +
      "  const ec = new EditContext({\n" +
      "    text: '',\n" +
      "    selectionStart: 0,\n" +
      "    selectionEnd: 0,\n" +
      "  });\n" +
      "  div.editContext = ec;  // 挂载到 contenteditable 元素\n" +
      "  ec.addEventListener('textinput', (e) => {\n" +
      "    // e.text: 新输入文本；e.rangeStart/End: 替换范围\n" +
      "    triggerCompletion(ec.text.slice(0, ec.selectionStart));\n" +
      "  });\n\n" +
      '【触发补全（debounce + 流式）】\n' +
      "  let pendingAC = null;\n" +
      "  let ws = null;\n" +
      "  async function ensureWS() {\n" +
      "    if (!ws) ws = await navigator.writingSuggestions.create({ task: 'compose' });\n" +
      "    return ws;\n" +
      "  }\n" +
      "  function triggerCompletion(prefix) {\n" +
      "    clearTimeout(debounceTimer);\n" +
      "    if (pendingAC) pendingAC.abort();\n" +
      "    debounceTimer = setTimeout(async () => {\n" +
      "      pendingAC = new AbortController();\n" +
      "      const inst = await ensureWS();\n" +
      "      const stream = inst.promptStreaming(prefix, { signal: pendingAC.signal });\n" +
      "      let ghost = '';\n" +
      "      try {\n" +
      "        for await (const chunk of stream) {\n" +
      "          ghost += chunk;\n" +
      "          renderGhost(ghost);  // 灰色预览增量更新\n" +
      "        }\n" +
      "      } catch (err) {\n" +
      "        if (err.name !== 'AbortError') console.error(err);\n" +
      "      }\n" +
      "    }, 250);\n" +
      "  }\n\n" +
      '【Tab 接受 / Esc 拒绝键盘事件】\n' +
      "  div.addEventListener('keydown', (e) => {\n" +
      "    if (e.key === 'Tab' && ghostText) {\n" +
      "      e.preventDefault();\n" +
      "      acceptGhost(ghostText);   // 插入到光标位置，清除灰色\n" +
      "      ghostText = '';\n" +
      "    } else if (e.key === 'Escape' && ghostText) {\n" +
      "      e.preventDefault();\n" +
      "      rejectGhost();            // 仅清除灰色预览\n" +
      "      ghostText = '';\n" +
      "    }\n" +
      "  });\n\n" +
      '【历史上下文维护（多轮）】\n' +
      "  // 维护最近 N 轮 prefix → suggestion 上下文\n" +
      "  const history = [];   // { prefix, suggestion }\n" +
      "  function pushHistory(prefix, suggestion) {\n" +
      "    history.push({ prefix, suggestion });\n" +
      "    if (history.length > 5) history.shift();  // 保留最近 5 轮\n" +
      "  }\n" +
      "  // 下次 create 时作为 initialPrompts 注入\n" +
      "  //   initialPrompts: history.flatMap(h => [\n" +
      "  //     { role: 'user',      content: h.prefix },\n" +
      "  //     { role: 'assistant', content: h.suggestion },\n" +
      "  //   ])\n\n" +
      '【与 Composition 事件冲突处理】\n' +
      "  // IME（中文/日文输入法）输入时 compositionstart→compositionupdate→compositionend\n" +
      "  // 期间不应触发补全（文本未确认）\n" +
      "  let composing = false;\n" +
      "  div.addEventListener('compositionstart', () => { composing = true; });\n" +
      "  div.addEventListener('compositionend', (e) => {\n" +
      "    composing = false;\n" +
      "    triggerCompletion(ec.text.slice(0, ec.selectionStart));\n" +
      "  });\n" +
      "  // textinput 事件中判断\n" +
      "  if (composing) return;  // 跳过补全\n\n" +
      '【关键点】\n' +
      '  1. EditContext 替代 input/keydown，避免 DOM 重渲染干扰\n' +
      '  2. 灰色预览用 <span contenteditable=false> 避免误删\n' +
      '  3. Tab 接受 / Esc 拒绝，preventDefault 阻止默认行为\n' +
      '  4. 流式更新灰色预览（体验更佳）\n' +
      '  5. Composition 事件期间跳过补全\n' +
      '  6. 历史上下文作为 initialPrompts 注入下一轮\n\n' +
      `【当前环境】navigator.writingSuggestions: ${caps.ws ? '✓' : '✗'}，EditContext: ${caps.editContext ? '✓' : '✗'}` });
    this._addLog('wsug', `编辑器内联补全演示完成；supports=${caps.ws || caps.ctor}，editContext=${caps.editContext}`);
  }

  _renderCard7() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '7. contenteditable 编辑器内联补全 —— 灰色预览 + Tab/Esc + EditContext',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._flags([['writingSuggestions', caps.ws || caps.ctor], ['EditContext', caps.editContext]]),
        h(Tag, { color: 'primary' }, '编辑器实战'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '实战：contenteditable 编辑器内联补全。用户输入时灰色文本预览补全，Tab 接受 / Esc 拒绝（preventDefault 阻止默认）。与 EditContext 协同（低层文本输入 API，避免 input/keydown 触发 DOM 重渲染干扰）。流式 promptStreaming 增量更新灰色预览。Composition 事件期间（IME 输入）跳过补全。历史上下文（最近 N 轮 prefix→suggestion）作为 initialPrompts 注入下一轮 create。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行编辑器实战演示', { type: 'primary', size: 'sm', onClick: () => this._runEditorDemo() }),
        ),
        h('div', { class: 'wsug-editor-host' },
          h('div', { class: 'wsug-editor', contenteditable: 'false' },
            '用户已输入文本',
            h('span', { class: 'wsug-completion' }, '灰色补全预览（Tab 接受 / Esc 拒绝）'),
          ),
          h('div', { class: 'fs-sm text-secondary', style: { marginTop: '6px' } },
            h('span', { class: 'wsug-kbd' }, 'Tab'),
            ' 接受补全　',
            h('span', { class: 'wsug-kbd' }, 'Esc'),
            ' 拒绝补全',
          ),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, `// 与 EditContext 协同（避免 IME / 重渲染干扰）
const ec = new EditContext({ text: '', selectionStart: 0, selectionEnd: 0 });
div.editContext = ec;   // 挂载到 contenteditable 元素
ec.addEventListener('textinput', (e) => {
  if (composing) return;   // IME 输入中跳过
  triggerCompletion(ec.text.slice(0, ec.selectionStart));
});

// 触发补全（debounce + 流式）
function triggerCompletion(prefix) {
  clearTimeout(debounceTimer);
  if (pendingAC) pendingAC.abort();
  debounceTimer = setTimeout(async () => {
    pendingAC = new AbortController();
    const inst = await ensureWS();
    const stream = inst.promptStreaming(prefix, { signal: pendingAC.signal });
    let ghost = '';
    try {
      for await (const chunk of stream) {
        ghost += chunk;
        renderGhost(ghost);   // 灰色预览增量更新
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error(err);
    }
  }, 250);
}

// Tab 接受 / Esc 拒绝
div.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' && ghostText) {
    e.preventDefault();
    acceptGhost(ghostText);
    ghostText = '';
  } else if (e.key === 'Escape' && ghostText) {
    e.preventDefault();
    rejectGhost();
    ghostText = '';
  }
});`)),
        h('div', { class: 'fs-sm text-secondary' }, '完整说明：'),
        h('pre', { class: 'code-block', style: { maxHeight: '560px', overflow: 'auto' } },
          h('code', {}, s.editorInfo || '（点击「运行编辑器实战演示」）')),
        h(Alert, {
          type: 'info',
          message: 'EditContext 提供低层文本输入 API，避免 contenteditable 重渲染干扰',
          description: 'EditContext 是 Chrome 138+ 的低层文本输入 API，挂载到 contenteditable 元素后，文本输入走 EditContext 而非直接修改 DOM，避免重渲染打断光标/补全预览。compositionstart/update/end 期间（IME 输入中文/日文）应跳过补全，待 compositionend 后再触发。灰色预览用 <span contenteditable=false> 包裹避免误删。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 8：隐私与降级 ===================

  _runPrivacyDemo() {
    const caps = this._caps();
    this.setState({ privacyInfo:
      '===== 隐私与降级策略 =====\n\n' +
      '【端侧 vs 云端模型 —— download 状态】\n' +
      "  const status = await navigator.writingSuggestions.availability();\n" +
      "  // 'available'   —— 端侧模型已下载，数据不出设备\n" +
      "  // 'downloadable' —— 可下载端侧模型（首次下载后离线可用）\n" +
      "  // 'no'          —— 不支持端侧，应降级到云端或第三方\n" +
      '  // 端侧模型：隐私友好（数据不离开设备），离线可用，但能力受限\n' +
      '  // 云端模型：能力强，但需联网且数据上传（隐私敏感场景慎用）\n\n' +
      '【destroy() 资源释放】\n' +
      "  // 每个实例持有模型句柄与上下文，不用时必须 destroy\n" +
      "  ws.destroy();   // 释放模型句柄与上下文\n" +
      "  // 长生命周期页面：页面卸载前 destroy 所有实例\n" +
      "  window.addEventListener('pagehide', () => {\n" +
      "    if (ws) ws.destroy();\n" +
      "  });\n\n" +
      '【与 EditContext / Composition 事件冲突处理】\n' +
      '  1. EditContext textinput 事件 vs input 事件：优先用 EditContext（低层，不重渲染）\n' +
      '  2. Composition 事件（IME）期间跳过补全：compositionstart→compositionend 之间\n' +
      '     文本未确认，触发补全会出错\n' +
      '  3. Tab 键冲突：Tab 既是补全接受键，也是焦点切换键；preventDefault 仅在\n' +
      '     有补全预览时阻止默认\n' +
      '  4. 光标位置：补全预览必须跟随光标，contenteditable 中需用 Selection API\n' +
      '     计算 Range，避免预览位置错乱\n\n' +
      '【与 Writer API 决策矩阵】\n' +
      '  场景                      推荐 API                 理由\n' +
      '  ─────────────────────────────────────────────────────────────────\n' +
      '  输入框内联补全（短片段）   WritingSuggestions        低延迟、随输入触发、片段补全\n' +
      '  邮件/文档整段撰写          Writer（task=compose）    段落级、需完整结构、用户主动触发\n' +
      '  整段语气改写               Writer（task=rewrite）    段落级改写、tone/length 控制\n' +
      '  已写段落改写               Rewriter                  基于 tone/length/format 改写\n' +
      '  通用对话/自由 prompt       Prompt / LanguageModel    无结构约束、多轮对话\n' +
      '  搜索框联想                 WritingSuggestions        suggest 任务、候选项列表\n' +
      '  contenteditable 内联补全   WritingSuggestions + EditContext  流式、灰色预览\n' +
      '  离线场景（隐私敏感）       WritingSuggestions（端侧） 数据不出设备\n' +
      '  云端能力（强模型）         第三方 API                availability=no 时降级\n\n' +
      '【降级方案（availability=no 时）】\n' +
      '  1. 第三方 LLM API（OpenAI / Anthropic / 本地 Ollama）\n' +
      '  2. 简单规则补全（基于历史输入字典，n-gram 模型）\n' +
      '  3. 静态占位文本（无 AI，仅 UI 提示）\n' +
      '  // 检测 + 降级示例\n' +
      "  async function getCompletion(text) {\n" +
      "    if (navigator.writingSuggestions) {\n" +
      "      const status = await navigator.writingSuggestions.availability();\n" +
      "      if (status !== 'no') {\n" +
      "        const ws = await navigator.writingSuggestions.create({ task: 'compose' });\n" +
      "        return (await ws.prompt(text)).result;\n" +
      "      }\n" +
      "    }\n" +
      "    // 降级到第三方\n" +
      "    const r = await fetch('/api/complete', { method: 'POST', body: text });\n" +
      "    return (await r.json()).text;\n" +
      "  }\n\n" +
      '【常见陷阱】\n' +
      '  1. 未 destroy 实例 → 模型句柄泄漏，长期运行内存增长\n' +
      '  2. availability=no 时不降级 → 直接抛错，用户体验差\n' +
      '  3. Composition 期间触发补全 → IME 文本未确认，补全出错\n' +
      '  4. Tab 键未 preventDefault → 焦点跳走，补全未接受\n' +
      '  5. 灰色预览位置错乱 → contenteditable 光标计算错误\n' +
      '  6. 长上下文超限未截断 → tokensLimit 报错\n' +
      '  7. 端侧 vs 云端未告知用户 → 隐私合规问题\n\n' +
      `【当前环境】navigator.writingSuggestions: ${caps.ws ? '✓' : '✗'}，EditContext: ${caps.editContext ? '✓' : '✗'}` });
    this._addLog('wsug', `隐私与降级演示完成；supports=${caps.ws || caps.ctor}，editContext=${caps.editContext}`);
  }

  _renderCard8() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '8. 隐私与降级 —— 端侧 vs 云端 / destroy / 决策矩阵',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.ws ? 'success' : 'error' }, caps.ws ? '端侧 ✓' : '端侧 ✗'),
        h(Tag, { color: 'primary' }, '隐私/降级'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '端侧 vs 云端模型：availability 返回 available/downloadable 时走端侧（数据不出设备，隐私友好，离线可用）；no 时降级到云端或第三方 LLM。destroy() 释放模型句柄与上下文，长生命周期页面卸载前必须 destroy 所有实例。与 EditContext/Composition 事件冲突处理：优先用 EditContext（低层，不重渲染）；IME Composition 期间跳过补全；Tab 键仅在预览存在时 preventDefault。与 Writer API 决策矩阵：内联补全用 WritingSuggestions、段落撰写用 Writer、整段改写用 Rewriter、通用对话用 Prompt/LanguageModel。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行隐私与降级演示', { type: 'primary', size: 'sm', onClick: () => this._runPrivacyDemo() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
        h('pre', { class: 'code-block', style: { maxHeight: '460px', overflow: 'auto' } },
          h('code', {}, `// 端侧 vs 云端 + 降级
async function getCompletion(text) {
  if (navigator.writingSuggestions) {
    const status = await navigator.writingSuggestions.availability();
    if (status !== 'no') {
      // 端侧模型：数据不出设备
      const ws = await navigator.writingSuggestions.create({ task: 'compose' });
      try {
        return (await ws.prompt(text)).result;
      } finally {
        ws.destroy();   // 释放资源
      }
    }
  }
  // 降级到第三方 LLM
  const r = await fetch('/api/complete', { method: 'POST', body: text });
  return (await r.json()).text;
}

// 页面卸载前 destroy 所有实例
window.addEventListener('pagehide', () => {
  if (ws) ws.destroy();
});`)),
        h('div', { class: 'fs-sm text-secondary' }, '决策矩阵与陷阱：'),
        h('pre', { class: 'code-block', style: { maxHeight: '560px', overflow: 'auto' } },
          h('code', {}, s.privacyInfo || '（点击「运行隐私与降级演示」）')),
        h(Alert, {
          type: 'warning',
          message: '端侧 vs 云端需告知用户；availability=no 时必须降级',
          description: '隐私合规要求：端侧模型数据不出设备（隐私友好），云端模型数据上传（需告知用户）。availability 返回 no 时必须降级到第三方 LLM 或简单规则补全，否则直接抛错体验差。每个 WritingSuggestions 实例持有模型句柄与上下文，不用时必须 destroy，长生命周期页面卸载前 destroy 所有实例避免泄漏。与 EditContext/Composition/Tab 键冲突需妥善处理。',
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
    return h('div', { class: 'api-lab-page writing-suggestions-page' },
      h('h2', { class: 'section-title' }, 'Writing Suggestions API 内置 AI 写作建议实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页演示 Built-in AI 系列的 Writing Suggestions API（输入框内联片段建议/补全）。该 API 为 Chrome 138+ 实验特性，需 HTTPS + chrome://flags 开启 + 模型下载；jsdom 环境不可用，所有按钮点击将仅记日志说明用法与支持状态。'),
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
