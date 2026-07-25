// =====================================================================
// DragDropDeepPage.js —— HTML Drag and Drop API 深度实验室
// 演示 MDN：
//   1. DragEvent 与拖拽生命周期 —— dragstart / drag / dragend /
//      dragenter / dragover / dragleave / drop（7 个事件 + dataTransfer）
//   2. DataTransfer —— setData / getData / clearData / types / files / items
//   3. DataTransferItemList / DataTransferItem —— kind / type /
//      getAsString(callback) / getAsString 异步回调 / getAsFile()
//   4. effectAllowed + dropEffect —— 8 种 effectAllowed × 4 种 dropEffect
//   5. setDragImage —— 自定义拖拽图像（setDragImage(element, xOffset, yOffset)）
//   6. 文件拖入模拟 —— dataTransfer.files / items，读取 File 名/大小/类型
//   7. 跨文档拖拽 + 安全 —— text/uri-list / text/html 多格式
//   8. DataTransfer 构造器（独立使用）—— new DataTransfer() / items.add / remove / clear
// 说明：HTML 拖放 API 让元素可拖拽（draggable="true"）并在放置区交换数据。
//       jsdom 中 DragEvent / DataTransfer 实现不完整，必须 typeof 检测；
//       不可用时所有演示改为记日志说明"测试环境不支持，请用真实浏览器"，绝不抛异常。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// effectAllowed 合法取值（共 8 种）：none / copy / move / link / copyMove / copyLink / linkMove / all
const EFFECT_ALLOWED_VALUES = ['none', 'copy', 'move', 'link', 'copyMove', 'copyLink', 'linkMove', 'all'];
// dropEffect 合法取值（共 4 种）：none / copy / move / link
const DROP_EFFECT_VALUES = ['none', 'copy', 'move', 'link'];

export class DragDropDeepPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      // Card 1：拖拽生命周期
      lifecycleInfo: '',
      // Card 2：DataTransfer 数据格式
      formatsInfo: '',
      // Card 3：DataTransferItemList
      itemsInfo: '',
      // Card 4：effectAllowed + dropEffect
      effectsInfo: '',
      // Card 5：setDragImage
      dragImageInfo: '',
      // Card 6：文件拖入模拟
      fileInfo: '',
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._lifecycleDt = null;   // Card 1 模拟拖拽共享的 DataTransfer
    this._formatsDt = null;     // Card 2 演示多格式的 DataTransfer
    this._itemsDt = null;       // Card 3 演示 items 的 DataTransfer
    this._effectsDt = null;     // Card 4 演示 effect 的 DataTransfer
    this._dragImageEl = null;   // Card 5 临时拖拽图像元素
    this._fileDt = null;        // Card 6 模拟文件拖入的 DataTransfer

    // 一次性能力检测：HTML Drag and Drop 全家桶
    const hasDataTransfer = typeof DataTransfer !== 'undefined';
    const hasDragEvent = typeof DragEvent !== 'undefined';
    const hasDataTransferItem = typeof DataTransferItem !== 'undefined';
    const hasDataTransferItemList = typeof DataTransferItemList !== 'undefined';
    const hasFile = typeof File !== 'undefined';
    const hasFileList = typeof FileList !== 'undefined';

    const parts = [];
    parts.push(`DataTransfer ${hasDataTransfer ? '✓' : '✗'}`);
    parts.push(`DragEvent ${hasDragEvent ? '✓' : '✗'}`);
    parts.push(`DataTransferItem ${hasDataTransferItem ? '✓' : '✗'}`);
    parts.push(`DataTransferItemList ${hasDataTransferItemList ? '✓' : '✗'}`);
    parts.push(`File ${hasFile ? '✓' : '✗'}`);
    parts.push(`FileList ${hasFileList ? '✓' : '✗'}`);

    const summary = hasDataTransfer
      ? `HTML Drag and Drop 能力检测：${parts.join(' · ')}。当前环境（jsdom/Node）DataTransfer 构造器可用，可真实演示 setData/getData/types/items.add/remove/clear；DragEvent 构造器可能受限，本页用「模拟触发」按钮 dispatchEvent 触发，并在 dataTransfer 为空时手动挂载。在真实浏览器中可完整体验拖拽视觉效果。`
      : '当前环境不支持 DataTransfer（typeof DataTransfer === "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示拖拽生命周期与数据交换。';

    this.setState({ capsSummary: summary });
    this._addLog(hasDataTransfer ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!hasDragEvent) this._addLog('warn', 'DragEvent 构造器不可用，将退化为普通 Event 并手动挂 dataTransfer');
    if (!hasDataTransferItem) this._addLog('warn', 'DataTransferItem / DataTransferItemList 不可用（jsdom 可能未实现）');
    if (!hasFile) this._addLog('warn', 'File 构造器不可用（无法模拟文件拖入）');
  }

  componentWillUnmount() {
    // 释放 DataTransfer 引用与临时元素，便于 GC；移除临时拖拽图像元素
    this._lifecycleDt = null;
    this._formatsDt = null;
    this._itemsDt = null;
    this._effectsDt = null;
    this._fileDt = null;
    if (this._dragImageEl && this._dragImageEl.parentNode) {
      this._dragImageEl.parentNode.removeChild(this._dragImageEl);
    }
    this._dragImageEl = null;
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
    return {
      dataTransfer: typeof DataTransfer !== 'undefined',
      dragEvent: typeof DragEvent !== 'undefined',
      dataTransferItem: typeof DataTransferItem !== 'undefined',
      dataTransferItemList: typeof DataTransferItemList !== 'undefined',
      file: typeof File !== 'undefined',
    };
  }

  // —— 通用：创建一个携带 dataTransfer 的拖拽事件 ——
  // DragEvent 构造器不可用时退化为普通 Event，并尝试用 defineProperty 挂 dataTransfer
  _makeDragEvent(type, dt) {
    let ev = null;
    if (typeof DragEvent === 'function') {
      try {
        ev = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt || null });
      } catch (e) { ev = null; }
    }
    if (!ev) {
      ev = new Event(type, { bubbles: true, cancelable: true });
    }
    // 若 DragEvent 构造器忽略了 dataTransfer（jsdom 常见），手动挂载
    if (dt && (!ev.dataTransfer)) {
      try { Object.defineProperty(ev, 'dataTransfer', { value: dt, configurable: true }); }
      catch (e) { /* 退化失败：事件无 dataTransfer，仅记日志 */ }
    }
    return ev;
  }

  // —— 通用：把 DOMStringList / 数组 / 伪数组统一转成普通数组 ——
  _typesToList(types) {
    if (!types) return [];
    if (Array.isArray(types)) return types.slice();
    const out = [];
    for (let i = 0; i < types.length; i++) out.push(types[i]);
    return out;
  }

  // =================== Card 1：拖拽生命周期日志 ===================

  // 在源/目标元素上派发一个拖拽事件，并用 once 监听器记录日志
  _dispatchLifecycleEvent(target, type) {
    if (!this._caps().dataTransfer) {
      this._addLog('warn', 'DataTransfer 不可用，无法模拟拖拽事件');
      return;
    }
    try {
      if (!this._lifecycleDt) {
        this._lifecycleDt = new DataTransfer();
      }
      const dt = this._lifecycleDt;
      const role = target === 'source' ? '源元素' : '放置区';
      const handler = (e) => {
        let extra = '';
        if (e.type === 'dragstart' && e.dataTransfer) {
          try { e.dataTransfer.setData('text/plain', 'payload-42'); extra = ' · setData(text/plain, "payload-42")'; }
          catch (err) { extra = ' · setData 失败'; }
        }
        if (e.type === 'dragover' || e.type === 'dragenter' || e.type === 'drop') {
          try { e.preventDefault(); extra += ' · preventDefault()（允许放置）'; } catch (err) { /* noop */ }
        }
        if (e.type === 'drop' && e.dataTransfer) {
          let got = '';
          try { got = e.dataTransfer.getData('text/plain'); } catch (err) { got = '(读取失败)'; }
          extra += ` · getData("text/plain") = "${got}"`;
        }
        if (e.type === 'dragend') {
          const de = e.dataTransfer ? e.dataTransfer.dropEffect : '(无 dataTransfer)';
          extra += ` · dropEffect = ${de}`;
        }
        this._addLog(e.type, `${role} 触发 ${e.type}${extra}`);
      };
      const el = target === 'source' ? this.$('.dd-source') : this.$('.dd-drop');
      if (!el) { this._addLog('warn', `未找到 ${role} 元素`); return; }
      el.addEventListener(type, handler, { once: true });
      const ev = this._makeDragEvent(type, dt);
      el.dispatchEvent(ev);
    } catch (err) {
      this._addLog('warn', `派发 ${type} 失败：${err.name} - ${err.message}`);
    }
  }

  // 模拟完整拖拽流程：dragstart → drag×3 → dragenter → dragover → drop → dragend
  _runFullLifecycle() {
    if (!this._caps().dataTransfer) {
      this._addLog('warn', 'DataTransfer 不可用，无法模拟完整流程');
      return;
    }
    this._addLog('info', '—— 模拟完整拖拽流程开始 ——');
    // 重置共享 DataTransfer，保证每次流程干净
    try { this._lifecycleDt = new DataTransfer(); } catch (e) { this._lifecycleDt = null; }
    this._dispatchLifecycleEvent('source', 'dragstart');
    this._dispatchLifecycleEvent('source', 'drag');
    this._dispatchLifecycleEvent('source', 'drag');
    this._dispatchLifecycleEvent('source', 'drag');
    this._dispatchLifecycleEvent('drop', 'dragenter');
    this._dispatchLifecycleEvent('drop', 'dragover');
    this._dispatchLifecycleEvent('drop', 'drop');
    this._dispatchLifecycleEvent('source', 'dragend');
    this.setState({
      lifecycleInfo:
        `模拟完整拖拽生命周期（7 个事件）：\n` +
        `1. dragstart（源）   → setData(text/plain, "payload-42")\n` +
        `2. drag（源）       → 高频触发，这里手动派发 3 次\n` +
        `3. dragenter（目标）→ preventDefault() 允许放置\n` +
        `4. dragover（目标） → 必须 preventDefault 才能触发 drop\n` +
        `5. drop（目标）     → getData("text/plain") 读出载荷\n` +
        `6. dragend（源）    → 拖拽结束，读取 dropEffect\n\n` +
        `说明：dragenter/dragover/drop 必须 preventDefault 才能允许放置；\n` +
        `      drag 高频触发；dragend 无论是否放置成功都触发。`,
    });
    this._addLog('info', '—— 完整流程派发完毕，详见上方日志 ——');
  }

  _clearLifecycleDt() {
    if (!this._caps().dataTransfer) {
      this._addLog('warn', 'DataTransfer 不可用');
      return;
    }
    try {
      this._lifecycleDt = new DataTransfer();
      this._addLog('clear', '已重置共享 DataTransfer（new DataTransfer()）');
      this.setState({ lifecycleInfo: '已重置共享 DataTransfer，types 为空。可重新模拟拖拽流程。' });
    } catch (err) {
      this._addLog('warn', `重置 DataTransfer 失败：${err.message}`);
    }
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. 拖拽生命周期日志（DragEvent 7 事件）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.dragEvent ? 'success' : 'warning' }, caps.dragEvent ? 'DragEvent ✓' : 'DragEvent ✗'),
        h(Tag, { color: caps.dataTransfer ? 'success' : 'error' }, caps.dataTransfer ? 'DataTransfer ✓' : '不可用'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'HTML 拖放 7 个事件：dragstart（源开始拖拽，setData）/ drag（拖拽进行中，高频）/ dragend（源拖拽结束）；dragenter（进入目标，preventDefault 允许放置）/ dragover（悬停，必须 preventDefault 才能触发 drop）/ dragleave（离开目标）/ drop（在目标上释放）。draggable="true" 让元素可拖拽。jsdom 不模拟真实拖拽，故提供「模拟触发」按钮用 dispatchEvent 派发事件。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          h('div', {
            class: 'dd-source',
            draggable: true,
            style: { padding: '12px 16px', border: '2px dashed #1677ff', borderRadius: '6px', cursor: 'grab', userSelect: 'none', color: '#1677ff' },
          }, '⬆ 可拖拽源元素（draggable=true）'),
          h('div', {
            class: 'dd-drop',
            style: { padding: '12px 16px', border: '2px dashed #fa8c16', borderRadius: '6px', minHeight: '24px', minWidth: '140px', color: '#fa8c16', display: 'flex', alignItems: 'center' },
          }, '⬇ 放置区'),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-sm' },
          this._btn('模拟 dragstart', { type: 'primary', size: 'sm', disabled: !caps.dataTransfer, onClick: () => this._dispatchLifecycleEvent('source', 'dragstart') }),
          this._btn('模拟 drag', { size: 'sm', disabled: !caps.dataTransfer, onClick: () => this._dispatchLifecycleEvent('source', 'drag') }),
          this._btn('模拟 dragenter', { size: 'sm', disabled: !caps.dataTransfer, onClick: () => this._dispatchLifecycleEvent('drop', 'dragenter') }),
          this._btn('模拟 dragover', { size: 'sm', disabled: !caps.dataTransfer, onClick: () => this._dispatchLifecycleEvent('drop', 'dragover') }),
          this._btn('模拟 dragleave', { size: 'sm', disabled: !caps.dataTransfer, onClick: () => this._dispatchLifecycleEvent('drop', 'dragleave') }),
          this._btn('模拟 drop', { type: 'primary', size: 'sm', disabled: !caps.dataTransfer, onClick: () => this._dispatchLifecycleEvent('drop', 'drop') }),
          this._btn('模拟 dragend', { size: 'sm', disabled: !caps.dataTransfer, onClick: () => this._dispatchLifecycleEvent('source', 'dragend') }),
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap mt-xs' },
          this._btn('完整流程', { type: 'primary', size: 'sm', disabled: !caps.dataTransfer, onClick: () => this._runFullLifecycle() }),
          this._btn('重置 DataTransfer', { size: 'sm', disabled: !caps.dataTransfer, onClick: () => this._clearLifecycleDt() }),
        ),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '生命周期说明：'),
        h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
          h('code', {}, s.lifecycleInfo || '（点击「完整流程」或单独事件按钮）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`const src = document.querySelector('.source');   // draggable=true
const drop = document.querySelector('.drop');
src.addEventListener('dragstart', (e) => {
  e.dataTransfer.setData('text/plain', 'payload'); // 写入数据
  e.dataTransfer.effectAllowed = 'copy';
});
drop.addEventListener('dragover', (e) => e.preventDefault()); // 必须 preventDefault
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  const data = e.dataTransfer.getData('text/plain'); // 读出数据
});
src.addEventListener('dragend', () => console.log('拖拽结束'));`)),
        h(Alert, {
          type: 'info',
          message: 'dragover 必须 preventDefault 才能触发 drop',
          description: '浏览器默认禁止放置，dragenter / dragover 调用 e.preventDefault() 才允许后续 drop；否则 drop 事件不会触发。drag 高频触发（每次鼠标移动），dragend 无论放置是否成功都会在源元素上触发。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：DataTransfer 数据格式 ===================

  // new DataTransfer() 独立构造 + setData/getData 多格式 + types + clearData
  _demoDataTransferFormats() {
    if (!this._caps().dataTransfer) {
      this._addLog('warn', 'DataTransfer 不可用，无法演示多格式');
      return;
    }
    try {
      const dt = new DataTransfer();
      this._formatsDt = dt;

      // setData(format, data)：写入多种格式
      dt.setData('text/plain', '纯文本载荷');
      dt.setData('text/html', '<strong>富文本</strong>');
      dt.setData('text/uri-list', 'https://developer.mozilla.org/zh-CN/docs/Web/API/DataTransfer');

      const typesAfterSet = this._typesToList(dt.types);
      const plain = dt.getData('text/plain');
      const html = dt.getData('text/html');
      const uri = dt.getData('text/uri-list');
      const missing = dt.getData('application/json'); // 未写入的格式 → 空字符串

      // clearData(format)：仅清除指定格式
      let clearLine = '';
      try {
        dt.clearData('text/html');
        const typesAfterClear = this._typesToList(dt.types);
        clearLine = `\nclearData("text/html") 后 types = ${JSON.stringify(typesAfterClear)}（仅移除该格式）`;
      } catch (err) {
        clearLine = `\nclearData 失败：${err.message}`;
      }

      // clearData() 无参：清空所有格式
      let clearAllLine = '';
      try {
        dt.clearData();
        const typesAfterAll = this._typesToList(dt.types);
        clearAllLine = `\nclearData() 无参后 types = ${JSON.stringify(typesAfterAll)}（清空全部）`;
      } catch (err) {
        clearAllLine = `\nclearData() 无参失败：${err.message}`;
      }

      this.setState({
        formatsInfo:
          `new DataTransfer() → 独立 DataTransfer（无需事件即可用）\n` +
          `dt.setData("text/plain", "纯文本载荷")\n` +
          `dt.setData("text/html", "<strong>富文本</strong>")\n` +
          `dt.setData("text/uri-list", "https://.../DataTransfer")\n\n` +
          `dt.types = ${JSON.stringify(typesAfterSet)}（DOMStringList，当前存储的格式列表）\n` +
          `dt.getData("text/plain")  = "${plain}"\n` +
          `dt.getData("text/html")   = "${html}"\n` +
          `dt.getData("text/uri-list") = "${uri}"\n` +
          `dt.getData("application/json") = "${missing}"（未写入 → 空字符串）${clearLine}${clearAllLine}\n\n` +
          `说明：setData(format, data) 写入；getData(format) 读出；types 是只读的 DOMStringList；\n` +
          `      clearData(format) 移除单格式，clearData() 清空全部。常见格式：text/plain、text/html、text/uri-list、application/json。`,
      });
      this._addLog('formats', `写入 3 种格式，types=${JSON.stringify(typesAfterSet)}；getData 读取成功`);
    } catch (err) {
      this._addLog('warn', `演示多格式失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. DataTransfer 数据格式（setData / getData / clearData / types）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.dataTransfer ? 'success' : 'error' }, caps.dataTransfer ? 'DataTransfer ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'text/plain / html / uri-list'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'new DataTransfer() 可独立创建数据传输对象（无需在事件中）。dt.setData(format, data) 写入数据；dt.getData(format) 读出；dt.types 返回当前存储的格式列表（DOMStringList，只读）；dt.clearData(format) 移除单格式，dt.clearData() 无参清空全部。常见格式：text/plain（纯文本）、text/html（富文本）、text/uri-list（URL）、application/json。本卡片演示多格式写入与读取。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('演示多格式', { type: 'primary', size: 'sm', disabled: !caps.dataTransfer, onClick: () => this._demoDataTransferFormats() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'DataTransfer 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.formatsInfo || '（点击「演示多格式」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } },
          h('code', {},
`const dt = new DataTransfer();          // 独立构造
dt.setData('text/plain', '纯文本');
dt.setData('text/html', '<b>富文本</b>');
dt.setData('text/uri-list', 'https://mdn.example');
console.log(dt.types);                   // ['text/html','text/plain','text/uri-list']
dt.getData('text/plain');                // '纯文本'
dt.clearData('text/html');               // 仅移除 text/html
dt.clearData();                          // 清空全部`)),
        h(Alert, {
          type: 'info',
          message: 'getData 只能读取已写入的格式',
          description: 'getData(format) 对未写入的格式返回空字符串 ""。types 是只读 DOMStringList（不可直接赋值），需用 Array.from 或索引遍历。text/uri-list 可包含多行 URL，第一行若为 # 开头则为注释。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：DataTransferItemList ===================

  // dt.items.add(data, type) / dt.items.add(file) + getAsString 异步回调 + getAsFile()
  async _demoDataTransferItemList() {
    if (!this._caps().dataTransfer) {
      this._addLog('warn', 'DataTransfer 不可用，无法演示 items');
      return;
    }
    try {
      const dt = new DataTransfer();
      this._itemsDt = dt;

      const lines = [];
      const items = dt.items;
      const hasItemsApi = items && typeof items.add === 'function' && typeof items.length === 'number';

      if (!hasItemsApi) {
        lines.push('dt.items 不完整（无 add 方法或 length）—— jsdom 未实现 DataTransferItemList。');
        lines.push('在真实浏览器中可：items.add(data, type) 添加字符串项；items.add(file) 添加文件项。');
        this.setState({ itemsInfo: lines.join('\n') });
        this._addLog('warn', 'dt.items 不完整，DataTransferItemList 未实现');
        return;
      }

      // 添加 string item：items.add(data, type)
      try {
        items.add('字符串载荷-A', 'text/plain');
        items.add('https://mdn.example/page', 'text/uri-list');
        lines.push('items.add("字符串载荷-A", "text/plain")  → 添加 string item');
        lines.push('items.add("https://mdn.example/page", "text/uri-list") → 添加 string item');
      } catch (err) {
        lines.push(`items.add(string) 失败：${err.message}`);
      }

      // 添加 file item：items.add(file)
      let fileAdded = false;
      if (this._caps().file) {
        try {
          const file = new File(['file-content-xyz-789'], 'demo.txt', { type: 'text/plain' });
          items.add(file);
          fileAdded = true;
          lines.push('items.add(new File([...], "demo.txt"))  → 添加 file item');
        } catch (err) {
          lines.push(`items.add(file) 失败：${err.message}`);
        }
      }

      // 遍历 items：item.kind（'string'/'file'）+ item.type（MIME）
      lines.push('');
      lines.push(`items.length = ${items.length}`);
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item) { lines.push(`  item[${i}] = undefined`); continue; }
        lines.push(`  item[${i}] kind=${item.kind}  type="${item.type}"`);
      }

      // getAsString(callback)：异步读取 string item 的内容
      if (items.length > 0 && items[0] && items[0].kind === 'string' && typeof items[0].getAsString === 'function') {
        lines.push('');
        lines.push('items[0].getAsString(callback) —— 异步读取字符串内容…');
        await new Promise((resolve) => {
          let done = false;
          const finish = () => { if (!done) { done = true; resolve(); } };
          try {
            items[0].getAsString((str) => {
              lines.push(`  回调收到：getAsString → "${str}"`);
              this._addLog('items', `getAsString 异步回调收到："${str}"`);
              finish();
            });
          } catch (err) {
            lines.push(`  getAsString 抛错：${err.message}`);
            finish();
          }
          // jsdom 可能不调回调，加超时兜底
          setTimeout(finish, 200);
        });
      }

      // getAsFile()：file item 返回 File；string item 返回 null
      lines.push('');
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item || typeof item.getAsFile !== 'function') continue;
        if (item.kind === 'file') {
          try {
            const f = item.getAsFile();
            lines.push(`item[${i}].getAsFile() → ${f ? `${f.name}（${f.size}B，${f.type}）` : 'null'}（file item 返回 File）`);
          } catch (err) {
            lines.push(`item[${i}].getAsFile() 抛错：${err.message}`);
          }
        } else {
          const f = item.getAsFile();
          lines.push(`item[${i}].getAsFile() → ${f}（string item 返回 null）`);
        }
      }

      // items.remove(index)：移除某项
      if (typeof items.remove === 'function' && items.length > 0) {
        try {
          const before = items.length;
          items.remove(items.length - 1);
          lines.push('');
          lines.push(`items.remove(${before - 1}) → length ${before} → ${items.length}（移除末项）`);
        } catch (err) {
          lines.push(`items.remove 失败：${err.message}`);
        }
      }

      this.setState({ itemsInfo: lines.join('\n') });
      this._addLog('items', `演示 items 完成：fileAdded=${fileAdded}，最终 length=${items.length}`);
    } catch (err) {
      this._addLog('warn', `演示 items 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. DataTransferItemList / DataTransferItem',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.dataTransferItemList ? 'success' : 'warning' }, caps.dataTransferItemList ? 'ItemList ✓' : 'ItemList ✗'),
        h(Tag, { color: 'primary' }, 'getAsString / getAsFile'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'dataTransfer.items 是 DataTransferItemList，每个元素是 DataTransferItem。item.kind ∈ "string"（字符串）/"file"（文件）；item.type 是 MIME 类型。item.getAsString(callback) 异步读取 string 项内容（回调无返回值）；item.getAsFile() 对 file 项返回 File 对象、对 string 项返回 null。items.add(data, type) 添加字符串项、items.add(file) 添加文件项；items.remove(index) 移除项。与 dt.files 不同，items 可异步读取文件内容（拖入文件夹时）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('演示 items（异步）', { type: 'primary', size: 'sm', disabled: !caps.dataTransfer, onClick: () => this._demoDataTransferItemList() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'DataTransferItem 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, s.itemsInfo || '（点击「演示 items」—— 含异步回调，请稍候）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
          h('code', {},
`const dt = new DataTransfer();
dt.items.add('字符串', 'text/plain');           // string item
dt.items.add(new File(['c'], 'f.txt'));         // file item
for (const item of dt.items) {
  console.log(item.kind, item.type);            // 'string'/'file', MIME
  if (item.kind === 'string') {
    item.getAsString((s) => console.log(s));   // 异步回调
  } else {
    const f = item.getAsFile();                  // → File
  }
}
dt.items.remove(0);                             // 移除第 0 项`)),
        h(Alert, {
          type: 'warning',
          message: 'getAsString 是异步的',
          description: 'item.getAsString(callback) 不返回值，需在回调里取数据。读取大文件时应优先用 items（支持异步）而非 files（同步快照）。jsdom 可能未实现 DataTransferItemList，此时按钮仅记日志说明。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：effectAllowed + dropEffect ===================

  // 遍历 8 种 effectAllowed 与 4 种 dropEffect，记录可读性与约束
  _demoEffects() {
    if (!this._caps().dataTransfer) {
      this._addLog('warn', 'DataTransfer 不可用，无法演示 effect');
      return;
    }
    try {
      const dt = new DataTransfer();
      this._effectsDt = dt;

      const lines = [];
      lines.push('—— effectAllowed（在 dragstart 设置，约束允许的操作）——');
      for (const ea of EFFECT_ALLOWED_VALUES) {
        try {
          dt.effectAllowed = ea;
          const got = dt.effectAllowed;
          const ok = got === ea ? '✓' : `✗(实际=${got})`;
          lines.push(`  effectAllowed = "${ea}"  → 读取 = "${got}"  ${ok}`);
        } catch (err) {
          lines.push(`  effectAllowed = "${ea}"  → 失败：${err.message}`);
        }
      }

      lines.push('');
      lines.push('—— dropEffect（在 dragover/drop 设置，决定光标样式与最终操作）——');
      const cursorHint = {
        none: '禁止放置（🚫 光标）',
        copy: '复制（+ 号光标）',
        move: '移动（无附加光标）',
        link: '链接（箭头光标）',
      };
      for (const de of DROP_EFFECT_VALUES) {
        try {
          dt.dropEffect = de;
          const got = dt.dropEffect;
          const ok = got === de ? '✓' : `✗(实际=${got})`;
          lines.push(`  dropEffect = "${de}"  → 读取 = "${got}"  ${ok}  光标：${cursorHint[de]}`);
        } catch (err) {
          lines.push(`  dropEffect = "${de}"  → 失败：${err.message}`);
        }
      }

      lines.push('');
      lines.push('—— 约束：dropEffect 必须与 effectAllowed 兼容 ——');
      lines.push('effectAllowed=copy   允许 dropEffect ∈ {none, copy}');
      lines.push('effectAllowed=move   允许 dropEffect ∈ {none, move}');
      lines.push('effectAllowed=link   允许 dropEffect ∈ {none, link}');
      lines.push('effectAllowed=all    允许 dropEffect ∈ {none, copy, move, link}');
      lines.push('effectAllowed=none   只允许 dropEffect = none（禁止一切）');
      lines.push('dropEffect=copy      浏览器显示 + 号光标，dragend 时可知是复制');

      this.setState({
        effectsInfo:
          `effectAllowed 取值（8 种）：${EFFECT_ALLOWED_VALUES.join(' / ')}\n` +
          `dropEffect 取值（4 种）：${DROP_EFFECT_VALUES.join(' / ')}\n\n` +
          `${lines.join('\n')}\n\n` +
          `说明：effectAllowed 在 dragstart 设置（源端约束允许哪些操作）；dropEffect 在 dragover/drop 设置\n` +
          `      （目标端决定最终操作与光标）。dropEffect 必须是 effectAllowed 允许的子集，否则浏览器忽略。`,
      });
      this._addLog('effects', `遍历 ${EFFECT_ALLOWED_VALUES.length} 种 effectAllowed 与 ${DROP_EFFECT_VALUES.length} 种 dropEffect`);
    } catch (err) {
      this._addLog('warn', `演示 effect 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. effectAllowed + dropEffect（光标与操作约束）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.dataTransfer ? 'success' : 'error' }, caps.dataTransfer ? 'DataTransfer ✓' : '不可用'),
        h(Tag, { color: 'primary' }, '8 × 4 组合'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'e.dataTransfer.effectAllowed 在 dragstart 设置（源端约束允许的操作）：none / copy / move / link / copyMove / copyLink / linkMove / all（8 种）。e.dataTransfer.dropEffect 在 dragover / drop 设置（目标端决定最终操作与光标样式）：none / copy / move / link（4 种）。dropEffect 必须是 effectAllowed 允许的子集，否则浏览器忽略该设置。dropEffect 影响 dragend 时源端读取的值，从而决定是复制还是移动。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('遍历 effect 组合', { type: 'primary', size: 'sm', disabled: !caps.dataTransfer, onClick: () => this._demoEffects() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'effect 组合结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.effectsInfo || '（点击「遍历 effect 组合」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } },
          h('code', {},
`src.addEventListener('dragstart', (e) => {
  e.dataTransfer.effectAllowed = 'copyMove';   // 源端：允许复制或移动
});
drop.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';          // 目标端：决定为复制（+ 光标）
});
src.addEventListener('dragend', (e) => {
  console.log(e.dataTransfer.dropEffect);      // 'copy' / 'move' / 'none'
});`)),
        h(Alert, {
          type: 'info',
          message: 'dropEffect 与 effectAllowed 的约束关系',
          description: 'effectAllowed 限定允许的 dropEffect 集合：copy 只允许 none/copy；copyMove 允许 none/copy/move；all 允许全部 4 种。若 dropEffect 与 effectAllowed 不兼容，浏览器会忽略 dropEffect 设置。dropEffect=none 时显示禁止光标，drop 不会触发。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：setDragImage 自定义拖拽图像 ===================

  // 创建临时元素，调用 setDragImage(element, xOffset, yOffset)
  _demoSetDragImage() {
    if (!this._caps().dataTransfer) {
      this._addLog('warn', 'DataTransfer 不可用，无法演示 setDragImage');
      return;
    }
    try {
      const dt = new DataTransfer();
      this._effectsDt = dt;

      // 创建临时拖拽图像元素（真实浏览器中拖拽时会显示该元素的快照）
      let img = null;
      try {
        img = document.createElement('div');
        img.textContent = '🎨 自定义拖拽图像';
        img.style.cssText = 'display:inline-block;padding:8px 12px;background:#1677ff;color:#fff;border-radius:6px;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.2);';
        // 加入 DOM（部分浏览器要求元素已渲染才能生成快照）
        document.body.appendChild(img);
        this._dragImageEl = img;
      } catch (err) {
        this._addLog('warn', `创建临时元素失败：${err.message}`);
      }

      let called = false;
      let errorLine = '';
      if (img) {
        try {
          dt.setDragImage(img, 20, 20);   // setDragImage(element, xOffset, yOffset)
          called = true;
        } catch (err) {
          errorLine = `\nsetDragImage 抛错：${err.name} - ${err.message}`;
        }
      }

      this.setState({
        dragImageInfo:
          `e.dataTransfer.setDragImage(element, xOffset, yOffset)\n` +
          `参数：element=自定义元素（div 文本「🎨 自定义拖拽图像」），xOffset=20，yOffset=20\n` +
          `调用结果：${called ? '✓ 已调用（setDragImage 无返回值）' : '✗ 未调用'}${errorLine}\n\n` +
          `说明：setDragImage 在 dragstart 调用，用指定元素的快照替代浏览器默认拖拽图像。\n` +
          `      xOffset/yOffset 是鼠标相对于图像左上角的偏移（像素）。\n` +
          `      jsdom 无渲染引擎，无视觉效果；本演示仅验证 API 可调用。\n` +
          `      真实浏览器中拖拽时会显示该元素快照跟随鼠标移动。`,
      });
      this._addLog('image', `setDragImage(${called ? '已调用' : '失败'})：element=div，offset=(20,20)`);
    } catch (err) {
      this._addLog('warn', `演示 setDragImage 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard5() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '5. setDragImage 自定义拖拽图像',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.dataTransfer ? 'success' : 'error' }, caps.dataTransfer ? 'DataTransfer ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'setDragImage'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'e.dataTransfer.setDragImage(element, xOffset, yOffset) 在 dragstart 调用，用指定元素的快照替代浏览器默认的半透明源元素拖拽图像。element 可以是任意已渲染的 DOM 元素（含 canvas，可用 canvas.toDataURL 自绘）；xOffset / yOffset 是鼠标相对于图像左上角的偏移（像素）。jsdom 无渲染引擎，无视觉效果，仅验证 API 可调用。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('演示 setDragImage', { type: 'primary', size: 'sm', disabled: !caps.dataTransfer, onClick: () => this._demoSetDragImage() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'setDragImage 结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '200px', overflow: 'auto' } },
          h('code', {}, s.dragImageInfo || '（点击「演示 setDragImage」）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '150px', overflow: 'auto' } },
          h('code', {},
`src.addEventListener('dragstart', (e) => {
  e.dataTransfer.setData('text/plain', 'data');
  // 用 canvas 自绘拖拽图像
  const canvas = document.createElement('canvas');
  canvas.width = 120; canvas.height = 40;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1677ff';
  ctx.fillRect(0, 0, 120, 40);
  ctx.fillStyle = '#fff';
  ctx.fillText('拖拽中...', 10, 26);
  e.dataTransfer.setDragImage(canvas, 60, 20); // 偏移居中
});`)),
        h(Alert, {
          type: 'warning',
          message: 'jsdom 无视觉效果',
          description: 'setDragImage 依赖浏览器渲染引擎生成元素快照。jsdom 无渲染能力，调用 API 不会产生可见的拖拽图像，但能验证 API 是否可调用。在真实浏览器中可看到自定义图像跟随鼠标移动。元素需已加入 DOM 才能在部分浏览器中生成快照。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：文件拖入模拟 ===================

  // 模拟拖入文件，读取 dataTransfer.files 与 items，记日志 File 名/大小/类型
  async _demoFileDrop() {
    if (!this._caps().dataTransfer) {
      this._addLog('warn', 'DataTransfer 不可用，无法模拟文件拖入');
      return;
    }
    if (!this._caps().file) {
      this._addLog('warn', 'File 构造器不可用，无法创建模拟文件');
      return;
    }
    try {
      const dt = new DataTransfer();
      this._fileDt = dt;

      // 构造两个模拟 File（真实拖入时由系统填充 dataTransfer.files）
      const file1 = new File(['hello world file content'], 'note.txt', { type: 'text/plain' });
      const file2 = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'pic.png', { type: 'image/png' });

      const lines = [];
      lines.push('模拟拖入 2 个文件：note.txt（文本）/ pic.png（PNG 头字节）');

      // 通过 items.add(file) 添加文件项（会同步反映到 dt.files）
      const items = dt.items;
      let added = 0;
      if (items && typeof items.add === 'function') {
        try { items.add(file1); added++; } catch (e) { lines.push(`items.add(note.txt) 失败：${e.message}`); }
        try { items.add(file2); added++; } catch (e) { lines.push(`items.add(pic.png) 失败：${e.message}`); }
      } else {
        lines.push('dt.items 不可用（jsdom 未实现 DataTransferItemList），dt.files 将为空');
      }

      // 读取 dataTransfer.files（FileList，同步快照）
      const files = dt.files;
      lines.push('');
      lines.push(`dataTransfer.files（FileList）.length = ${files ? files.length : '(无 files)'}`);
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          lines.push(`  [${i}] name="${f.name}"  size=${f.size}B  type="${f.type}"  lastModified=${f.lastModified}`);
        }
      } else {
        lines.push('  （空 —— jsdom 未把 items.add(file) 同步到 files，真实浏览器会同步）');
      }

      // 通过 items 异步读取文件内容
      lines.push('');
      lines.push(`dataTransfer.items.length = ${items ? items.length : '(无 items)'}`);
      if (items && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (!item) continue;
          lines.push(`  item[${i}] kind=${item.kind}  type="${item.type}"`);
          if (item.kind === 'file' && typeof item.getAsFile === 'function') {
            try {
              const f = item.getAsFile();
              lines.push(`    getAsFile() → ${f ? `${f.name}（${f.size}B）` : 'null'}`);
              // 用 File.text() 异步读取文本内容
              if (f && typeof f.text === 'function') {
                const txt = await f.text();
                const preview = txt.length > 40 ? txt.slice(0, 40) + '…' : txt;
                lines.push(`    file.text() → "${preview}"（异步读取，File 继承自 Blob）`);
              }
            } catch (err) {
              lines.push(`    getAsFile/text 抛错：${err.message}`);
            }
          }
        }
      }

      this.setState({
        fileInfo:
          `new DataTransfer() → 模拟拖入文件\n` +
          `items.add(file) 成功添加 ${added} 个文件项\n\n` +
          `${lines.join('\n')}\n\n` +
          `说明：真实拖入文件时，系统自动填充 dataTransfer.files（FileList）与 dataTransfer.items\n` +
          `      （DataTransferItemList）。files 是同步快照；items 支持异步读取（getAsString / file.text()）。\n` +
          `      File 继承自 Blob，可用 .text() / .arrayBuffer() / .slice() 等方法读取内容。`,
      });
      this._addLog('files', `模拟拖入 ${added} 个文件，files.length=${files ? files.length : 0}`);
    } catch (err) {
      this._addLog('warn', `模拟文件拖入失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. 文件拖入模拟（dataTransfer.files / items）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.file ? 'success' : 'error' }, caps.file ? 'File ✓' : 'File ✗'),
        h(Tag, { color: caps.dataTransferItemList ? 'success' : 'warning' }, caps.dataTransferItemList ? 'ItemList ✓' : 'ItemList ✗'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '真实拖入文件时，系统自动填充 e.dataTransfer.files（FileList 同步快照）与 e.dataTransfer.items（DataTransferItemList，支持异步读取）。File 继承自 Blob，可用 file.text() / file.arrayBuffer() / file.slice() 读取内容。本卡片用 new File([...], name, { type }) 构造模拟文件，通过 items.add(file) 添加，再读回 files 与 items。jsdom 可能未把 items.add(file) 同步到 files，真实浏览器会同步。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('模拟拖入文件', { type: 'primary', size: 'sm', disabled: !caps.dataTransfer || !caps.file, onClick: () => this._demoFileDrop() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '文件拖入结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.fileInfo || '（点击「模拟拖入文件」—— 含异步读取，请稍候）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '170px', overflow: 'auto' } },
          h('code', {},
`drop.addEventListener('drop', async (e) => {
  e.preventDefault();
  const files = e.dataTransfer.files;          // FileList（同步）
  for (const f of files) {
    console.log(f.name, f.size, f.type);
    const text = await f.text();                // 异步读文本（File 继承 Blob）
  }
  // items 支持异步读取（可处理目录）
  for (const item of e.dataTransfer.items) {
    if (item.kind === 'file') {
      const f = item.getAsFile();
    }
  }
});`)),
        h(Alert, {
          type: 'info',
          message: 'files 是同步快照，items 支持异步',
          description: 'dataTransfer.files 是同步的 FileList 快照，适合已知文件类型的简单场景；dataTransfer.items 支持异步读取（getAsString / getAsFile），并能处理拖入的目录（webkitGetAsEntry）。File 继承自 Blob，所有 Blob 方法（text/arrayBuffer/slice/stream）均可用于读取内容。',
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
      h('h2', { class: 'section-title' }, 'HTML Drag and Drop API 深度实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        'HTML 拖放 API 让元素可拖拽（draggable="true"）并在放置区交换数据。本页演示 DragEvent 7 个生命周期事件、DataTransfer 多格式数据、DataTransferItemList 异步读取、effectAllowed/dropEffect 光标约束、setDragImage 自定义图像与文件拖入。'),
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
