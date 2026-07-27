// =====================================================================
// ModernJSModulesPage.js —— 现代 JS 与模块系统 实验室
// 演示 2023-2025 JavaScript 语言与模块加载生态的新增/增强原语：
//   1. Promise.try (ES2025) —— Promise.try(fn) 把同步或会抛错的函数包装为
//      Promise，正确捕获 fn 内同步抛错（vs new Promise(resolve=>resolve(fn()))
//      旧写法某些情况会变成未捕获异常）；是 Lodash _.attempt / Bluebird
//      Promise.try 的官方标准化。Chrome 128+/Firefox 129+/Safari 18+
//   2. Import Maps —— <script type="importmap"> JSON（imports/scopes）；
//      bare module specifier（如 import "react"）解析到 URL；可跳过打包工具
//      直接用 ES Modules；微前端/CDN 依赖映射事实标准
//   3. Import Attributes —— import x from './data.json' with { type: 'json' }；
//      import mod from './mod.wasm' with { type: 'webassembly' }；with 关键字
//      替代旧 assert；声明模块类型供浏览器安全加载
//   4. ShadowRoot.getHTML() / Element.getHTML() 序列化 —— 把 Shadow DOM
//      输出为带 <template shadowrootmode="open"> 的 Declarative Shadow DOM
//      字符串；是 SSR/组件缓存/复制粘贴的关键缺口（innerHTML 丢失 Shadow 树）。
//      Chrome 125+/Firefox 128+
//   5. 现代模块加载生态对比 —— Import Maps / Import Attributes / dynamic import()
//      / Module Workers / Top-level await / JSON modules / CSS modules 文本表格
// 说明：所有特性调用前做 typeof/in 能力检测，不可用时仅记日志，绝不抛异常。
//       jsdom 中 importmap 检测不准、dynamic import 是语法非全局、top-level await
//       仅 module 上下文可用，均以日志说明兜底。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class ModernJSModulesPage extends Page {
    _inited;
    _injectedStyles;
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            promiseTryInfo: '',
            importMapsInfo: '',
            importAttrsInfo: '',
            getHtmlInfo: '',
            matrixInfo: '',
        };
    }
    componentDidMount() {
        if (this._inited)
            return;
        this._inited = true;
        this._injectedStyles = [];
        const caps = this._caps();
        const c = (ok) => ok ? '已支持' : '未支持';
        const parts = [
            `Promise.try ${c(caps.promiseTry)}`,
            `Import Maps ${c(caps.importMaps)}`,
            `Element.getHTML ${c(caps.getHTML)}`,
            `attachShadow ${c(caps.shadowRoot)}`,
            `dynamic import ${c(caps.dynamicImport)}`,
            `top-level await ${c(caps.topLevelAwait)}`,
        ];
        const summary = '现代 JS 与模块系统能力检测：' + parts.join(' · ') + '。'
            + 'jsdom 中 importmap 检测不准、dynamic import 是语法非全局、top-level await 仅 module 上下文可用，点击按钮查看演示。';
        this.setState({
            capsSummary: summary,
            logs: [...this.state.logs, { type: 'info', content: '能力检测：' + parts.join('，'), time: formatTime() }].slice(-40),
        });
        if (!caps.promiseTry)
            this._addLog('warn', 'Promise.try 不可用（Chrome 128+/Firefox 129+/Safari 18+），演示仅记日志');
        if (!caps.getHTML)
            this._addLog('warn', 'Element.getHTML 不可用（Chrome 125+/Firefox 128+），演示仅记日志');
        if (!caps.shadowRoot)
            this._addLog('warn', 'attachShadow 不可用，序列化演示仅记日志');
        if (!caps.importMaps)
            this._addLog('warn', 'Import Maps 检测在 jsdom 中不准（HTMLScriptElement.prototype.type 仅作存在性判断），需真实浏览器验证');
        this._addLog('info', 'dynamic import 是语法而非全局函数，无法用 typeof 直接检测；这里直接设为 true 并说明。top-level await 仅 module 上下文可用。');
        this._injectDemoStyles();
    }
    componentWillUnmount() {
        if (Array.isArray(this._injectedStyles)) {
            this._injectedStyles.forEach((el) => el?.remove());
            this._injectedStyles = [];
        }
    }
    _addLog(type, content) {
        this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
    }
    _btn(label, opts) {
        const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
        this.registerChild(btn);
        return btn.render();
    }
    _injectStyle(id, textContent) {
        const existing = document.getElementById(id);
        if (existing)
            existing.remove();
        const style = document.createElement('style');
        style.id = id;
        style.textContent = textContent;
        document.head.appendChild(style);
        this._injectedStyles.push(style);
        return style;
    }
    _caps() {
        let promiseTry = false;
        try {
            promiseTry = typeof Promise !== 'undefined' && typeof Promise.try === 'function';
        }
        catch {
            promiseTry = false;
        }
        let importMaps = false;
        try {
            importMaps = typeof HTMLScriptElement !== 'undefined' && 'type' in HTMLScriptElement.prototype;
        }
        catch {
            importMaps = false;
        }
        let getHTML = false;
        try {
            getHTML = typeof Element !== 'undefined' && typeof Element.prototype.getHTML === 'function';
        }
        catch {
            getHTML = false;
        }
        let shadowRoot = false;
        try {
            shadowRoot = typeof Element !== 'undefined' && typeof Element.prototype.attachShadow === 'function';
        }
        catch {
            shadowRoot = false;
        }
        // dynamic import 是语法而非全局函数，无法用 typeof 直接检测
        let dynamicImport = true;
        try {
            new Function('return typeof import');
        }
        catch {
            dynamicImport = false;
        }
        // top-level await 仅 module 上下文可用，无法在普通脚本检测，直接设 false 并记日志
        let topLevelAwait = false;
        return { promiseTry, importMaps, getHTML, shadowRoot, dynamicImport, topLevelAwait };
    }
    _injectDemoStyles() {
        this._injectStyle('modern-js-modules-demo', `
      .mj-demo-box { border: 1px dashed #cbd5e1; border-radius: 6px; padding: 12px; margin-top: 8px; background: #fff; }
      .mj-json-block { background: #0f172a; color: #e2e8f0; border-radius: 6px; padding: 12px; margin-top: 8px; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px; line-height: 1.6; overflow: auto; }
      .mj-json-block .mj-json-key { color: #93c5fd; }
      .mj-json-block .mj-json-str { color: #fcd34d; }
      .mj-shadow-host { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; margin-top: 8px; background: #f8fafc; }
      .mj-output { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
      .mj-output-row { display: flex; gap: 12px; align-items: flex-start; }
      .mj-output-label { min-width: 96px; font-weight: 600; color: #1e40af; font-size: 12px; }
      .mj-output-value { flex: 1; background: #0f172a; color: #e2e8f0; border-radius: 4px; padding: 8px; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; }
      .mj-matrix { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
      .mj-matrix th, .mj-matrix td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: top; }
      .mj-matrix thead th { background: #f1f5f9; color: #0f172a; font-weight: 600; }
      .mj-matrix tbody tr:nth-child(even) { background: #f8fafc; }
      .mj-matrix td.mj-feature { font-weight: 600; color: #1e40af; white-space: nowrap; }
    `);
    }
    // ============ Card 1：Promise.try (ES2025) ============
    _runPromiseTry() {
        const caps = this._caps();
        if (!caps.promiseTry) {
            this._addLog('warn', 'Promise.try 不可用（Chrome 128+/Firefox 129+/Safari 18+），仅说明：Promise.try(fn) 把同步或会抛错的函数包装为 Promise，正确捕获 fn 内同步抛错，是 Lodash _.attempt / Bluebird Promise.try 的官方标准化');
            this.setState({ promiseTryInfo: '不可用：需 Chrome 128+/Firefox 129+/Safari 18+，仅记日志说明' });
            return;
        }
        const lines = [];
        // 情况 1：同步抛错
        Promise.try(() => { throw new Error('同步抛错示例'); })
            .then(() => { this._addLog('warn', '情况1 不该走到 then'); })
            .catch((e) => {
            lines.push('情况1 同步抛错 → 被 .catch 捕获：' + e.message);
            this._addLog('info', 'Promise.try 情况1：同步抛错被 .catch 正确捕获（' + e.message + '）');
        })
            .finally(() => {
            // 情况 2：同步返回值
            Promise.try(() => 42)
                .then((v) => {
                lines.push('情况2 同步返回值 → .then 收到：' + v);
                this._addLog('info', 'Promise.try 情况2：同步返回值 ' + v + ' 被 .then 收到');
            })
                .finally(() => {
                // 情况 3：异步返回 Promise
                Promise.try(() => new Promise((resolve) => setTimeout(() => resolve('async'), 0)))
                    .then((v) => {
                    lines.push('情况3 异步返回 Promise → .then 收到：' + v);
                    this._addLog('info', 'Promise.try 情况3：异步 Promise 值 "' + v + '" 被 .then 收到');
                    this.setState({ promiseTryInfo: lines.join('\n') });
                });
            });
        });
    }
    _renderCard1() {
        const caps = this._caps();
        const s = this.state;
        return h(Card, {
            title: 'Card 1 · Promise.try (ES2025)',
            extra: h(Tag, { color: caps.promiseTry ? 'success' : 'error' }, caps.promiseTry ? '已支持' : '未支持'),
        }, h('p', { class: 'fs-sm text-secondary' }, 'Promise.try(fn) 把同步或会抛错的函数包装为 Promise，正确捕获 fn 内同步抛错（vs new Promise(resolve=>resolve(fn())) 旧写法某些情况变成未捕获异常）；是 Lodash _.attempt / Bluebird Promise.try 的官方标准化。'), h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' }, this._btn('运行 Promise.try', { type: 'primary', size: 'sm', onClick: () => this._runPromiseTry() })), s.promiseTryInfo ? h('pre', { class: 'code-block mt-md' }, s.promiseTryInfo) : null, h('pre', { class: 'code-block mt-md' }, `// 旧写法：fn 内同步抛错可能变成未捕获异常
new Promise(resolve => resolve(fn()));
// ES2025 标准化
Promise.try(fn).then((v: any) => ...).catch((e: any) => ...);
// 情况1：同步抛错 → 被 catch 捕获
// 情况2：同步返回值 → then 收到
// 情况3：异步返回 Promise → then 收到 unwrapped 值`));
    }
    // ============ Card 2：Import Maps ============
    _resolveImportMap() {
        // 简版 importmap 解析器：查找 imports 字段匹配 bare specifier
        const importMap = {
            imports: {
                react: 'https://esm.sh/react@18.3.1',
                'react-dom': 'https://esm.sh/react-dom@18.3.1',
                lodash: 'https://esm.sh/lodash@4.17.21',
                'lodash/': 'https://esm.sh/lodash@4.17.21/',
                'my-app/': '/src/modules/',
            },
            scopes: {
                '/vendor/': {
                    react: 'https://esm.sh/react@17.0.2',
                },
            },
        };
        const cases = [
            'react',
            'lodash/get',
            'lodash',
            'my-app/utils/helper.js',
            'vue',
        ];
        const resolve = (specifier) => {
            try {
                // 完全匹配
                if ((importMap.imports[specifier]))
                    return (importMap.imports[specifier]);
                // 前缀映射（带尾斜杠）
                for (const key of Object.keys(importMap.imports)) {
                    if (key.endsWith('/') && specifier.startsWith(key)) {
                        return (importMap.imports[key]) + specifier.slice(key.length);
                    }
                }
                // 未匹配：返回原 specifier（浏览器会作为相对/绝对 URL 处理）
                return specifier + '（未映射，浏览器按 URL 处理）';
            }
            catch (err) {
                return '解析失败：' + (err && err.message);
            }
        };
        const lines = cases.map((sp) => sp + '  →  ' + resolve(sp));
        this._addLog('info', 'Import Maps 解析演示：手动实现简版解析器（查找 imports 字段匹配 bare specifier），共 ' + cases.length + ' 个用例');
        this.setState({ importMapsInfo: lines.join('\n') });
    }
    _renderCard2() {
        const caps = this._caps();
        const s = this.state;
        return h(Card, {
            title: 'Card 2 · Import Maps',
            extra: h(Tag, { color: caps.importMaps ? 'success' : 'error' }, caps.importMaps ? '已支持' : '未支持'),
        }, h('p', { class: 'fs-sm text-secondary' }, '<script type="importmap"> JSON（imports/scopes）；bare module specifier（如 import "react"）解析到 URL；可跳过打包工具直接用 ES Modules；微前端/CDN 依赖映射事实标准。jsdom 不支持 importmap 检测，仅记日志说明。'), h('div', { class: 'mj-json-block' }, `{
  "imports": {
    "react": "https://esm.sh/react@18.3.1",
    "react-dom": "https://esm.sh/react-dom@18.3.1",
    "lodash": "https://esm.sh/lodash@4.17.21",
    "lodash/": "https://esm.sh/lodash@4.17.21/",
    "my-app/": "/src/modules/"
  },
  "scopes": {
    "/vendor/": { "react": "https://esm.sh/react@17.0.2" }
  }
}`), h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' }, this._btn('解析演示', { type: 'primary', size: 'sm', onClick: () => this._resolveImportMap() })), s.importMapsInfo ? h('pre', { class: 'code-block mt-md' }, s.importMapsInfo) : null, h('pre', { class: 'code-block mt-md' }, `<script type="importmap">
{ "imports": { "react": "https://esm.sh/react@18" } }
</script>
<script type="module">
import React from "react";   // bare specifier → 解析到 esm.sh
</script>`));
    }
    // ============ Card 3：Import Attributes ============
    _testImportAttrs() {
        // Import Attributes 是语法层面特性，无法直接检测
        // 用 try/catch 动态 import 测试是否支持，但 jsdom 不支持模块加载，仅记日志
        const caps = this._caps();
        this._addLog('info', 'Import Attributes 是语法层面特性，无法用 typeof/in 检测。用 try/catch 动态 import 可间接探测，但 jsdom 不支持模块加载，这里仅记日志说明。');
        this.setState({ importAttrsInfo: 'with { type: "json" } / with { type: "webassembly" } 是语法层面特性，需真实浏览器或支持 ESM 的运行时验证。' });
        // 尝试动态 import 探测（在 jsdom 中会失败，仅作能力探测示例）
        try {
            if (caps.dynamicImport) {
                // 不真正执行以避免污染，仅说明可用
                this._addLog('info', '检测到 dynamic import 语法可用（语法非全局），可尝试 import("./x.json", { with: { type: "json" } }) 验证');
            }
        }
        catch (err) {
            this._addLog('warn', 'dynamic import 探测失败：' + (err && err.message));
        }
    }
    _renderCard3() {
        const s = this.state;
        return h(Card, {
            title: 'Card 3 · Import Attributes',
            extra: h(Tag, { color: 'default' }, '语法层面'),
        }, h('p', { class: 'fs-sm text-secondary' }, 'import x from "./data.json" with { type: "json" }；import mod from "./mod.wasm" with { type: "webassembly" }；with 关键字替代旧 assert；声明模块类型供浏览器安全加载。能力检测：无法直接检测（语法层面），用 try/catch 动态 import 测试或记日志说明。'), h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' }, this._btn('说明 Import Attributes', { type: 'primary', size: 'sm', onClick: () => this._testImportAttrs() })), s.importAttrsInfo ? h('p', { class: 'fs-sm mt-sm text-secondary' }, s.importAttrsInfo) : null, h('pre', { class: 'code-block mt-md' }, `// 新语法 with（推荐）
import data from './data.json' with { type: 'json' };
import mod from './mod.wasm' with { type: 'webassembly' };

// 旧语法 assert（已废弃）
import data from './data.json' assert { type: 'json' };
import type { State } from '../../core/types.js';

// with vs assert：
// - assert 已被 TC39 标记废弃
// - with 语义更清晰，且支持运行时修改
// - 浏览器仅对未声明类型的模块拒绝执行（安全）`));
    }
    // ============ Card 4：ShadowRoot.getHTML() / Element.getHTML() ============
    _serializeShadowDOM() {
        const caps = this._caps();
        if (!caps.getHTML) {
            this._addLog('warn', 'Element.getHTML 不可用（Chrome 125+/Firefox 128+），仅说明：getHTML({ serializableShadowRoots, shadowRoots }) 把 Shadow DOM 输出为带 <template shadowrootmode="open"> 的 Declarative Shadow DOM 字符串');
            this.setState({ getHtmlInfo: '不可用：需 Chrome 125+/Firefox 128+，仅记日志说明。innerHTML 序列化会丢失 Shadow 树。' });
            return;
        }
        if (!caps.shadowRoot) {
            this._addLog('warn', 'attachShadow 不可用，无法创建 shadow root 演示');
            return;
        }
        const host = this.$('#mj-shadow-host');
        if (!host) {
            this._addLog('warn', '未找到 shadow host 元素');
            return;
        }
        try {
            // 清理旧 shadow
            if (host.shadowRoot) { /* 已有 open shadow，无需重建 */ }
            else {
                host.attachShadow({ mode: 'open' });
            }
            const sr = host.shadowRoot;
            sr.innerHTML = '<style>.inner{color:#0f766e;font-weight:600;}</style><p class="inner">Shadow DOM 内容</p>';
            const innerHtml = host.innerHTML;
            let outer = '';
            try {
                outer = host.getHTML({ serializableShadowRoots: true });
            }
            catch (e) {
                this._addLog('warn', 'getHTML 调用失败：' + (e && e.message));
            }
            this._addLog('info', 'getHTML 序列化完成：innerHTML 长度=' + innerHtml.length + '，getHTML 长度=' + outer.length);
            this.setState({ getHtmlInfo: 'innerHTML:\n' + innerHtml + '\n\ngetHTML({serializableShadowRoots:true}):\n' + outer });
        }
        catch (err) {
            this._addLog('warn', '序列化失败：' + (err && err.message));
        }
    }
    _renderCard4() {
        const caps = this._caps();
        const s = this.state;
        return h(Card, {
            title: 'Card 4 · ShadowRoot.getHTML() / Element.getHTML() 序列化',
            extra: h(Tag, { color: caps.getHTML ? 'success' : 'error' }, caps.getHTML ? '已支持' : '未支持'),
        }, h('p', { class: 'fs-sm text-secondary' }, 'ShadowRoot.getHTML({ serializableShadowRoots, shadowRoots }) 把 Shadow DOM 输出为带 <template shadowrootmode="open"> 的 Declarative Shadow DOM 字符串；Element.getHTML() 同；是 SSR/组件缓存/复制粘贴的关键缺口（innerHTML 序列化丢失 Shadow 树）。Chrome 125+/Firefox 128+。'), h('div', { id: 'mj-shadow-host', class: 'mj-shadow-host' }, h('p', { class: 'fs-sm' }, 'shadow host 容器：点击下方按钮将在此 attachShadow 并序列化对比。')), h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' }, this._btn('序列化 Shadow DOM', { type: 'primary', size: 'sm', onClick: () => this._serializeShadowDOM() }), h(Tag, { color: caps.shadowRoot ? 'success' : 'error' }, caps.shadowRoot ? 'attachShadow 已支持' : 'attachShadow 未支持')), s.getHtmlInfo ? h('pre', { class: 'code-block mt-md' }, s.getHtmlInfo) : null, h('pre', { class: 'code-block mt-md' }, `const host = document.querySelector('#x');
host.attachShadow({ mode: 'open' } as any);
host.shadowRoot.innerHTML = '<p>shadow</p>';

host.innerHTML;        // 空字符串（丢失 shadow 树）
host.getHTML({
  serializableShadowRoots: true
});
// <div id="x"><template shadowrootmode="open"><p>shadow</p></template></div>`));
    }
    // ============ Card 5：现代模块加载生态对比 ============
    _renderCard5() {
        const caps = this._caps();
        const rows = [
            ['Import Maps', 'bare specifier 解析到 URL', 'Chrome 89+/Firefox 108+/Safari 16.4+', '微前端、CDN 依赖、跳过打包工具直接用 ESM'],
            ['Import Attributes', 'with { type } 声明模块类型', 'Chrome 126+/Firefox 128+/Safari 17.4+', 'JSON/WASM 模块安全加载，替代废弃的 assert'],
            ['dynamic import()', '运行时按需加载模块', '全主流已稳定', '路由懒加载、按需引入、code-splitting'],
            ['Module Workers', 'new Worker(url, { type: "module" })', 'Chrome 80+/Firefox 114+/Safari 15+', 'Worker 内可用 import/export ESM'],
            ['Top-level await', '模块顶层直接 await', 'Chrome 89+/Firefox 89+/Safari 15+', '模块初始化期等待异步资源（如配置加载）'],
            ['JSON modules', 'import j from "./x.json" with {type:"json"}', 'Chrome 91+/Firefox 128+/Safari 17.4+', '静态导入 JSON 数据，无需 fetch'],
            ['CSS modules', 'import styles from "./x.css"', 'Chrome 93+/Firefox 93+/Safari 16.4+', '带作用域的样式导入，CSS 类名局部化'],
        ];
        return h(Card, {
            title: 'Card 5 · 现代模块加载生态对比',
            extra: h(Tag, { color: caps.dynamicImport ? 'success' : 'error' }, caps.dynamicImport ? 'dynamic import 可用' : '不可用'),
        }, h('p', { class: 'fs-sm text-secondary' }, '现代 JS 模块加载生态各有分工：Import Maps 做 specifier 解析、Import Attributes 做类型声明、dynamic import 做按需加载、Module Workers 让 Worker 也能用 ESM、Top-level await 让模块初始化可异步、JSON/CSS modules 静态导入非 JS 资源。'), h('table', { class: 'mj-matrix' }, h('thead', {}, h('tr', {}, h('th', {}, '特性'), h('th', {}, '作用'), h('th', {}, '浏览器支持'), h('th', {}, '典型场景'))), h('tbody', {}, rows.map((r) => h('tr', {}, h('td', { class: 'mj-feature' }, r[0]), h('td', {}, r[1]), h('td', {}, r[2]), h('td', {}, r[3]))))), h('pre', { class: 'code-block mt-md' }, `// 综合：importmap + import attributes + dynamic import + top-level await
<script type="importmap">
{ "imports": { "react": "https://esm.sh/react@18" } }
</script>
<script type="module">
  import React from "react";                    // Import Maps
  import cfg from "./config.json" with { type: "json" };  // Import Attributes
  const mod = await import("./lazy.js");        // dynamic import + top-level await
</script>`));
    }
    // ============ 日志面板 ============
    _renderLogPanel() {
        const s = this.state;
        return h(Card, {
            title: '事件日志',
            extra: h('span', { class: 'fs-sm text-tertiary' }, s.logs.length + ' 条'),
        }, h('div', { class: 'log-panel' }, s.logs.length === 0
            ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
            : s.logs.map((log) => h('div', { class: 'log-panel__line' }, h('span', { class: 'log-panel__time' }, log.time), h('span', { class: 'log-panel__tag log-panel__tag--' + (log.type === 'error' ? 'error' : 'info') }, log.type), h('span', { class: 'log-panel__content' }, log.content)))));
    }
    renderPage() {
        const s = this.state;
        return [
            h('h2', { class: 'section-title' }, '现代 JS 与模块系统 实验室'),
            h(Alert, {
                type: 'info',
                message: '现代 JS 与模块系统',
                description: '演示 Promise.try (ES2025)、Import Maps、Import Attributes、ShadowRoot.getHTML() / Element.getHTML() 序列化、现代模块加载生态对比等 2023-2025 现代 JS 与模块系统原语。所有特性通过能力检测，不支持时记日志不报错。jsdom 中 importmap 检测不准、dynamic import 是语法非全局、top-level await 仅 module 上下文可用，均以日志说明兜底。',
            }),
            s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
            this._renderCard1(),
            this._renderCard2(),
            this._renderCard3(),
            this._renderCard4(),
            this._renderCard5(),
            this._renderLogPanel(),
        ];
    }
}
//# sourceMappingURL=ModernJSModulesPage.js.map