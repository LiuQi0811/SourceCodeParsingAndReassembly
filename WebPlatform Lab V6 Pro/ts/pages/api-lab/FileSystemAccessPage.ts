// =====================================================================
// FileSystemAccessPage.js —— 文件系统访问 API 实验室
// 演示 MDN：
//   1. File System Access API —— showOpenFilePicker / showSaveFilePicker /
//      showDirectoryPicker、FileSystemFileHandle / FileSystemDirectoryHandle、
//      FileSystemWritableFileStream（write/seek/truncate/close）、getFile/createWritable、
//      entries() 异步迭代器、getFileHandle / removeEntry。
//   2. File / Blob API —— new File / new Blob、size/type/text/arrayBuffer/stream/slice、
//      URL.createObjectURL / revokeObjectURL。
//   3. FileReader + FileReaderSync + 数据 URL —— readAsText/ArrayBuffer/DataURL/BinaryString、
//      onloadstart/progress/load/error/loadend/abort、result/error/readyState、abort()、
//      FileReaderSync（仅 Worker）、data:[<mediatype>][;base64],<data>。
// 说明：File System Access API 在 jsdom 不可用，演示返回 mock 句柄并记日志，绝不抛异常；
//       File/Blob/FileReader 在 jsdom 通常可用，演示真实操作。
// =====================================================================
import { Page } from '../../core/Component.js';

declare const Buffer: any;
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { Props, State } from '../../core/types.js';

export interface FileSystemAccessPageProps extends Props {}

export interface FileSystemAccessPageState extends State {}

export class FileSystemAccessPage extends Page {
  declare props: FileSystemAccessPageProps;
  declare state: FileSystemAccessPageState;
  _blobText: any = null;
  _currentBlob: any = null;
  _destroyed: any = null;
  _dirHandle: any = null;
  _fileReader: any = null;
  _inited: boolean = false;
  _mockDirHandle: any = null;
  _mockFileHandle: any = null;
  _mockSaveHandle: any = null;
  _pickedHandle: any = null;
  _saveContent: any = null;
  _saveHandle: any = null;
  initialState(): FileSystemAccessPageState {
    return {
      logs: [],
      capsSummary: '',
      // Card 1: showOpenFilePicker —— 已打开文件信息
      openedFile: null, // { name, size, type, text }
      // Card 2: showSaveFilePicker + FileSystemWritableFileStream —— 已保存文件信息
      savedFile: null,  // { name, size, content }
      // Card 3: showDirectoryPicker + 递归遍历 —— 目录树
      dirTree: null,    // { name, entries: [{ name, kind, depth, path }] }
      // Card 4: File / Blob API —— Blob 信息
      blobInfo: null,   // { size, type, url, text, arrayBuffer, slice }
      // Card 5: FileReader + 数据 URL —— 读取结果
      readerResult: null, // { readyState, progress, result, dataUrl, isImage, method }
    };
  }

  // =================== 生命周期 ===================
  componentDidMount(): void {
    // 关键守卫：防止 setState => rerender => componentDidMount 死循环（历史 OOM 根因）
    if (this._inited) return;
    this._inited = true;

    // 资源引用（componentWillUnmount 时清理）
    this._pickedHandle = null;   // 真实 FileSystemFileHandle（打开文件）
    this._mockFileHandle = null; // mock FileSystemFileHandle（能力不可用时）
    this._saveHandle = null;     // 真实 FileSystemFileHandle（保存）
    this._mockSaveHandle = null; // mock 保存句柄
    this._dirHandle = null;      // 真实 FileSystemDirectoryHandle
    this._mockDirHandle = null;  // mock 目录句柄
    this._currentBlob = null;    // Card 4 当前 Blob 引用
    this._fileReader = null;     // Card 5 当前 FileReader

    // —— 能力检测：typeof 各 API，记录 capsSummary ——
    const w = typeof window !== 'undefined' ? window : ({} as any);
    const mark = (ok: any) => (ok ? '✓' : '✗');
    const hasOpen = typeof w.showOpenFilePicker === 'function';
    const hasSave = typeof w.showSaveFilePicker === 'function';
    const hasDir = typeof w.showDirectoryPicker === 'function';
    const hasBlob = typeof Blob !== 'undefined';
    const hasFile = typeof File !== 'undefined';
    const hasFileReader = typeof FileReader !== 'undefined';
    const hasFh = typeof FileSystemFileHandle !== 'undefined';
    const hasDh = typeof FileSystemDirectoryHandle !== 'undefined';
    const hasWfs = typeof FileSystemWritableFileStream !== 'undefined';

    const caps = [
      `showOpenFilePicker ${mark(hasOpen)}`,
      `showSaveFilePicker ${mark(hasSave)}`,
      `showDirectoryPicker ${mark(hasDir)}`,
      `Blob ${mark(hasBlob)}`,
      `File ${mark(hasFile)}`,
      `FileReader ${mark(hasFileReader)}`,
      `FileSystemFileHandle ${mark(hasFh)}`,
      `FileSystemDirectoryHandle ${mark(hasDh)}`,
      `FileSystemWritableFileStream ${mark(hasWfs)}`,
    ];
    this.setState({ capsSummary: '能力检测：' + caps.join('  ·  ') });

    // 缺失项记录到日志（warn，绝不抛异常）
    if (!hasOpen || !hasSave || !hasDir) {
      this._addLog('warn',
        'File System Access API 部分不可用（需 Chromium 系浏览器 + 安全上下文 HTTPS/localhost）；'
        + 'Card 1/2/3 演示将返回 mock 句柄');
    }
    if (!hasBlob || !hasFile) {
      this._addLog('warn', 'Blob / File 构造器不可用，Card 4 演示将降级');
    }
    if (!hasFileReader) {
      this._addLog('warn', 'FileReader 不可用，Card 5 演示将降级');
    }
    if (!hasFh || !hasDh || !hasWfs) {
      this._addLog('warn',
        'FileSystemFileHandle / FileSystemDirectoryHandle / FileSystemWritableFileStream 类型在当前环境缺失');
    }
  }

  componentWillUnmount(): void {
    // 释放 object URL，避免内存泄漏
    if (this.state.blobInfo && this.state.blobInfo.url) {
      try { URL.revokeObjectURL(this.state.blobInfo.url); } catch { /* noop */ }
    }
    // 移除 reader.onload 等事件监听并中止可能进行中的读取
    if (this._fileReader) {
      const r = this._fileReader;
      try {
        r.onloadstart = null;
        r.onprogress = null;
        r.onload = null;
        r.onerror = null;
        r.onloadend = null;
        r.onabort = null;
        r.abort();
      } catch { /* noop */ }
      this._fileReader = null;
    }
  }

  // =================== 通用辅助 ===================
  _addLog(type: any, content: any) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label: any, opts: any) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  _card(title: any, desc: any, extra: any, children: any) {
    // Card 用法：new Card({ title, desc, extra, children }); this.registerChild(card); return card.render()
    // desc 同时渲染为首段说明（Card 本身不消费 desc 属性，这里前置一个 <p> 保证可见）
    const kids = Array.isArray(children) ? children : [children];
    const body = desc ? [h('p', { class: 'fs-sm text-secondary' }, desc), ...kids] : kids;
    const card = new Card({ title, desc, extra, children: body });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 1: showOpenFilePicker ===================

  // 打开文件选择器：能力可用时调用真实 API，否则返回 mock FileSystemFileHandle
  async _openFilePicker() {
    const w = typeof window !== 'undefined' ? window : ({} as any);
    if (typeof w.showOpenFilePicker !== 'function') {
      // 不可用：返回 mock handle 并记 warn（绝不抛异常）
      this._addLog('warn', 'showOpenFilePicker 不可用，返回 mock FileSystemFileHandle');
      try {
        const mockFile = new File(
          ['Hello, File System Access API!\n这是 mock 文件内容。\n第三行示例。'],
          'mock-doc.txt',
          { type: 'text/plain', lastModified: Date.now() }
        );
        this._mockFileHandle = this._makeMockFileHandle(mockFile);
        this._addLog('pick',
          `mock showOpenFilePicker({ multiple:false, types:[text/plain] }) → [${this._mockFileHandle.name}]（kind=${this._mockFileHandle.kind}）`);
      } catch (err: any) {
        this._addLog('warn', `构造 mock handle 失败：${err?.message || err}`);
      }
      return;
    }
    this._addLog('pick', '调用 showOpenFilePicker({ multiple:false, types:[text/plain], excludeAcceptAllOption:false })');
    try {
      const [handle] = await w.showOpenFilePicker({
        multiple: false,
        types: [{
          description: '文本文件',
          accept: { 'text/plain': ['.txt', '.md', '.json', '.csv', '.log'] },
        }],
        excludeAcceptAllOption: false,
      });
      this._pickedHandle = handle;
      this._mockFileHandle = null;
      this._addLog('pick', `已选择 ${handle.name}（kind=${handle.kind}）`);
    } catch (err: any) {
      // AbortError（用户取消）记为信息，其余记 warn
      if (err && err.name === 'AbortError') {
        this._addLog('pick', '用户取消选择（AbortError）');
      } else {
        this._addLog('warn', `showOpenFilePicker 异常：${err?.name || 'Error'} - ${err?.message || err}`);
      }
    }
  }

  // 读取文件内容：handle.getFile().text()
  async _readFileContent() {
    const handle = this._pickedHandle || this._mockFileHandle;
    if (!handle) {
      this._addLog('warn', '请先点击「打开文件选择器」获取文件句柄');
      return;
    }
    if (typeof handle.getFile !== 'function') {
      this._addLog('warn', '当前句柄不支持 getFile()');
      return;
    }
    try {
      this._addLog('read', `handle.getFile().text() 读取 ${handle.name} ...`);
      const file = await handle.getFile();        // FileSystemFileHandle → File
      const text = await file.text();             // File.text() → Promise<string>
      this.setState({
        openedFile: { name: file.name, size: file.size, type: file.type || '(空)', text },
      });
      this._addLog('read',
        `读取完成：${file.name}（${file.size}B / ${file.type || '未知类型'}），共 ${text.length} 字符`);
    } catch (err: any) {
      this._addLog('warn', `读取文件异常：${err?.message || err}`);
    }
  }

  // 构造 mock FileSystemFileHandle（jsdom 无 FSA 时用于演示）
  _makeMockFileHandle(file: any) {
    return {
      name: file.name,
      kind: 'file',
      getFile: async () => file,
      // createWritable 返回 mock FileSystemWritableFileStream
      createWritable: async (_opts: any) => {
        let buffer = '';
        return {
          write: async (data: any) => { if (typeof data === 'string') buffer += data; },
          seek: async (_pos: any) => { /* mock：seek 不改变追加语义 */ },
          truncate: async (_size: any) => { buffer = buffer.slice(0, _size); },
          close: async () => { /* mock：close 空操作 */ },
          _getBuffer: () => buffer,
        };
      },
    };
  }

  // =================== Card 2: showSaveFilePicker + FileSystemWritableFileStream ===================
  // 保存文件：能力可用时调用 showSaveFilePicker，否则返回 mock handle
  async _saveFilePicker() {
    const w = typeof window !== 'undefined' ? window : ({} as any);
    if (typeof w.showSaveFilePicker !== 'function') {
      this._addLog('warn', 'showSaveFilePicker 不可用，返回 mock FileSystemFileHandle');
      try {
        const mockFile = new File([''], 'mock-save.txt', { type: 'text/plain' });
        this._mockSaveHandle = this._makeMockFileHandle(mockFile);
        this._addLog('save',
          `mock showSaveFilePicker({ suggestedName:'fsa-save.txt', types:[text/plain] }) → ${this._mockSaveHandle.name}`);
      } catch (err: any) {
        this._addLog('warn', `构造 mock 保存句柄失败：${err?.message || err}`);
      }
      return;
    }
    this._addLog('save', '调用 showSaveFilePicker({ suggestedName, types })');
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: 'fsa-save.txt',
        types: [{
          description: '文本文件',
          accept: { 'text/plain': ['.txt'] },
        }],
      });
      this._saveHandle = handle;
      this._mockSaveHandle = null;
      this._addLog('save', `已选择保存目标 ${handle.name}（kind=${handle.kind}）`);
    } catch (err: any) {
      if (err && err.name === 'AbortError') {
        this._addLog('save', '用户取消保存（AbortError）');
      } else {
        this._addLog('warn', `showSaveFilePicker 异常：${err?.message || err}`);
      }
    }
  }

  // 写入并 close：handle.createWritable({ keepExistingData:false }) → write → seek/truncate → close
  async _writeAndClose() {
    const handle = this._saveHandle || this._mockSaveHandle;
    if (!handle) {
      this._addLog('warn', '请先点击「保存文件」选择写入目标');
      return;
    }
    if (typeof handle.createWritable !== 'function') {
      this._addLog('warn', '当前句柄不支持 createWritable()');
      return;
    }
    // 从 DOM 读取待写入内容（onInput 不触发 setState，避免重渲染失焦）
    const content = (this.$('.fsa-save-textarea') as any)?.value
      ?? 'Hello, File System Access API!\n这是写入测试内容。';
    try {
      this._addLog('write',
        `handle.createWritable({ keepExistingData:false }) → write(${content.length} 字符) → seek/truncate → close()`);
      // keepExistingData:false（默认）会清空原文件，从 0 开始写
      const stream = await handle.createWritable({ keepExistingData: false });
      await stream.write(content);
      // 演示 seek / truncate API（不影响最终内容，仅展示调用）
      try { await stream.seek(0); } catch { /* 某些实现可能限制 */ }
      try { await stream.truncate(content.length); } catch { /* noop */ }
      await stream.close();                       // 必须 close 才会落盘
      const byteLen = typeof TextEncoder !== 'undefined'
        ? new TextEncoder().encode(content).byteLength
        : content.length;
      this.setState({ savedFile: { name: handle.name, size: byteLen, content } });
      this._addLog('write', `已写入 ${handle.name}（${byteLen} 字节），FileSystemWritableFileStream.close() 完成`);
    } catch (err: any) {
      this._addLog('warn', `写入异常：${err?.message || err}`);
    }
  }

  // =================== Card 3: showDirectoryPicker + 递归遍历 ===================

  // 打开目录：能力可用时调用 showDirectoryPicker，否则返回 mock 目录句柄
  async _openDirPicker() {
    const w = typeof window !== 'undefined' ? window : ({} as any);
    if (typeof w.showDirectoryPicker !== 'function') {
      this._addLog('warn', 'showDirectoryPicker 不可用，返回 mock FileSystemDirectoryHandle');
      this._mockDirHandle = this._makeMockDirHandle();
      this._addLog('dir',
        `mock showDirectoryPicker({ mode:'read' }) → ${this._mockDirHandle.name}（kind=${this._mockDirHandle.kind}）`);
      return;
    }
    this._addLog('dir', '调用 showDirectoryPicker({ mode:"read" })');
    try {
      const handle = await w.showDirectoryPicker({ mode: 'read' });
      this._dirHandle = handle;
      this._mockDirHandle = null;
      this._addLog('dir', `已选择目录 ${handle.name}（kind=${handle.kind}）`);
    } catch (err: any) {
      if (err && err.name === 'AbortError') {
        this._addLog('dir', '用户取消选择目录（AbortError）');
      } else {
        this._addLog('warn', `showDirectoryPicker 异常：${err?.message || err}`);
      }
    }
  }

  // 递归遍历：for await (const [name, h] of (dir as any).entries()) 异步迭代器
  async _walkDirectory() {
    const handle = this._dirHandle || this._mockDirHandle;
    if (!handle) {
      this._addLog('warn', '请先点击「打开目录」获取目录句柄');
      return;
    }
    if (typeof handle.entries !== 'function') {
      this._addLog('warn', '当前句柄不支持 entries()');
      return;
    }
    try {
      this._addLog('walk', `for await (const [name, h] of ${handle.name}.entries()) 递归遍历（深度≤2）...`);
      const entries: any[] = [];
      // 异步递归：限制深度避免深层目录卡顿
      const walk = async (dirHandle: any, depth: any, prefix: any) => {
        for await (const [name, h] of (dirHandle as any).entries()) {
          entries.push({ name, kind: h.kind, depth, path: prefix + name });
          if (h.kind === 'directory' && depth < 2) {
            try {
              await walk(h, depth + 1, prefix + name + '/');
            } catch (e: any) {
              entries.push({ name: `(读取失败: ${e.message})`, kind: 'error', depth: depth + 1, path: prefix });
            }
          }
        }
      };
      await walk(handle, 0, '');
      this.setState({ dirTree: { name: handle.name, entries } });
      const fileCount = entries.filter((e: any) => e.kind === 'file').length;
      const dirCount = entries.filter((e: any) => e.kind === 'directory').length;
      this._addLog('walk',
        `遍历完成：${entries.length} 条目（文件 ${fileCount} / 目录 ${dirCount}，深度≤2）`);
    } catch (err: any) {
      this._addLog('warn', `目录遍历异常：${err?.message || err}`);
    }
  }

  // 构造 mock FileSystemDirectoryHandle（jsdom 无 FSA 时演示递归遍历，entries() 返回异步迭代器）
  _makeMockDirHandle() {
    const build = (name: any, tree: any) => {
      const handle = { name, kind: tree.kind };
      if (tree.kind === 'directory') {
        (handle as any).entries = () => {
          const items = (Object as any).entries(tree.children || {});
          return {
            async *[Symbol.asyncIterator]() {
              for (const [childName, childTree] of items) {
                yield [childName, build(childName, childTree)];
              }
            },
          };
        };
        // getFileHandle / removeEntry 演示签名（mock 实现简化）
        (handle as any).getFileHandle = async (n: any, _opts: any) => build(n, { kind: 'file' });
        (handle as any).removeEntry = async (_n: any, _opts: any) => { /* mock：空操作 */ };
        (handle as any).values = (handle as any).entries;
        (handle as any).keys = () => ({ async *[Symbol.asyncIterator]() {
          for (const k of (Object as any).keys(tree.children || {})) yield k;
        } });
      }
      return handle;
    };
    return build('mock-project', {
      kind: 'directory',
      children: {
        'README.md': { kind: 'file' },
        'package.json': { kind: 'file' },
        'src': { kind: 'directory', children: {
          'index.js': { kind: 'file' },
          'app.js': { kind: 'file' },
          'utils': { kind: 'directory', children: {
            'format.js': { kind: 'file' },
            'helpers.js': { kind: 'file' },
          } },
        } },
        'public': { kind: 'directory', children: {
          'index.html': { kind: 'file' },
          'favicon.ico': { kind: 'file' },
        } },
        '.gitignore': { kind: 'file' },
      },
    });
  }

  // =================== Card 4: File / Blob API ===================

  // 创建 Blob：new Blob([data], { type })，并生成 object URL
  _createBlob() {
    if (typeof Blob === 'undefined') {
      this._addLog('warn', 'Blob 构造器不可用');
      return;
    }
    try {
      const text = (this.$('.fsa-blob-textarea') as any)?.value
        ?? 'Hello Blob\n第二行\n含中文与 emoji 🌍';
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      // 释放旧的 object URL，避免内存泄漏
      if (this.state.blobInfo && this.state.blobInfo.url) {
        try { URL.revokeObjectURL(this.state.blobInfo.url); } catch { /* noop */ }
      }
      let url = '';
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        url = URL.createObjectURL(blob);
      }
      this._currentBlob = blob;
      this.setState({
        blobInfo: {
          size: blob.size, type: blob.type, url,
          text: '', arrayBuffer: '', slice: '',
        },
      });
      this._addLog('blob',
        `new Blob([text], { type }) → ${blob.size} 字节 / ${blob.type}`
        + `${url ? '，URL.createObjectURL 已生成 blob: URL' : '（URL.createObjectURL 不可用）'}`);
    } catch (err: any) {
      this._addLog('warn', `创建 Blob 异常：${err?.message || err}`);
    }
  }

  // 读取 text：blob.text() → Promise<string>
  async _readBlobText() {
    const blob = this._currentBlob;
    if (!blob) {
      this._addLog('warn', '请先点击「创建 Blob」');
      return;
    }
    if (typeof blob.text !== 'function') {
      this._addLog('warn', '当前 Blob 不支持 text()');
      return;
    }
    try {
      this._addLog('blob', 'blob.text() 读取 ...');
      const text = await blob.text();
      this.setState({ blobInfo: { ...this.state.blobInfo, text } });
      this._addLog('blob', `blob.text() → ${text.length} 字符：${JSON.stringify(text.slice(0, 40))}`);
    } catch (err: any) {
      this._addLog('warn', `blob.text() 异常：${err?.message || err}`);
    }
  }

  // 读取 arrayBuffer：blob.arrayBuffer() → Promise<ArrayBuffer>
  async _readBlobArrayBuffer() {
    const blob = this._currentBlob;
    if (!blob) {
      this._addLog('warn', '请先点击「创建 Blob」');
      return;
    }
    if (typeof blob.arrayBuffer !== 'function') {
      this._addLog('warn', '当前 Blob 不支持 arrayBuffer()');
      return;
    }
    try {
      this._addLog('blob', 'blob.arrayBuffer() 读取 ...');
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      // 十六进制 dump（前 32 字节）
      const hex = Array.from(bytes.slice(0, 32))
        .map((b: any) => b.toString(16).padStart(2, '0').toUpperCase())
        .join(' ');
      this.setState({
        blobInfo: {
          ...this.state.blobInfo,
          arrayBuffer: `${(buf as any).byteLength} 字节；hex(前32): ${hex}${(buf as any).byteLength > 32 ? ' ...' : ''}`,
        },
      });
      this._addLog('blob', `blob.arrayBuffer() → ${(buf as any).byteLength} 字节`);
    } catch (err: any) {
      this._addLog('warn', `blob.arrayBuffer() 异常：${err?.message || err}`);
    }
  }

  // slice：blob.slice(start, end, contentType) → Blob
  _sliceBlob() {
    const blob = this._currentBlob;
    if (!blob) {
      this._addLog('warn', '请先点击「创建 Blob」');
      return;
    }
    if (typeof blob.slice !== 'function') {
      this._addLog('warn', '当前 Blob 不支持 slice()');
      return;
    }
    try {
      const end = Math.min(10, blob.size);
      const slice = blob.slice(0, end, 'text/plain');
      this._addLog('slice',
        `blob.slice(0, ${end}, 'text/plain') → ${slice.size} 字节（原 ${blob.size}，type=${slice.type}）`);
      // 异步读取 slice 内容展示
      slice.text().then((t: any) => {
        if (this._destroyed) return;
        this.setState({
          blobInfo: { ...this.state.blobInfo, slice: `${slice.size} 字节，内容: ${JSON.stringify(t)}` },
        });
        this._addLog('slice', `slice.text() → ${JSON.stringify(t)}`);
      }).catch((err: any) => {
        if (this._destroyed) return;
        this._addLog('warn', `slice.text() 异常：${err?.message || err}`);
      });
    } catch (err: any) {
      this._addLog('warn', `blob.slice 异常：${err?.message || err}`);
    }
  }

  // new File 构造：File 继承 Blob，含 name/lastModified
  _newFileConstruct() {
    if (typeof File === 'undefined') {
      this._addLog('warn', 'File 构造器不可用');
      return;
    }
    try {
      const file = new File(
        ['Hello File!', '\n第二行'],
        `constructed-${Date.now().toString(36)}.txt`,
        { type: 'text/plain', lastModified: Date.now() }
      );
      const isBlob = typeof Blob !== 'undefined' && (file instanceof Blob);
      this._addLog('blob',
        `new File([parts], name, { type, lastModified }) → ${file.name}，${file.size}B，type=${file.type}，File instanceof Blob = ${isBlob}`);
    } catch (err: any) {
      this._addLog('warn', `File 构造异常：${err?.message || err}`);
    }
  }

  // =================== Card 5: FileReader + FileReaderSync + 数据 URL ===================

  // readAsDataURL：用 FileReader 读取小图片生成 data URL（格式 data:[<mediatype>][;base64],<data>）
  _readAsDataURL() {
    if (typeof FileReader === 'undefined') {
      this._addLog('warn', 'FileReader 不可用');
      return;
    }
    // 构造一个小图片 Blob（1x1 透明 PNG，base64 解码）
    let imgBlob;
    try {
      const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const bin = typeof atob === 'function'
        ? atob(pngBase64)
        : '\x89PNG\r\n\x1a\n';
      const bytes = Uint8Array.from(bin, (c: any) => c.charCodeAt(0));
      imgBlob = new Blob([bytes], { type: 'image/png' });
    } catch (err: any) {
      this._addLog('warn', `构造图片 Blob 失败，回退文本：${err?.message || err}`);
      try {
        imgBlob = new Blob(['fallback text content'], { type: 'text/plain' });
      } catch (e: any) {
        this._addLog('warn', `回退 Blob 构造失败：${e?.message || e}`);
        return;
      }
    }

    // 中止上一个 reader，避免事件串扰
    if (this._fileReader) {
      try { this._fileReader.abort(); } catch { /* noop */ }
    }
    const reader = new FileReader();
    this._fileReader = reader;
    this.setState({
      readerResult: { readyState: 0, progress: 0, result: '', dataUrl: '', isImage: false, method: 'readAsDataURL' },
    });
    this._addLog('reader', `new FileReader() → readAsDataURL(blob, ${imgBlob.size}B / ${imgBlob.type}) 开始`);

    // 通过直接属性赋值绑定事件（componentWillUnmount 时置 null 清理）
    reader.onloadstart = () => {
      if (this._destroyed) return;
      this.setState({ readerResult: { ...this.state.readerResult, readyState: 1 } });
      this._addLog('progress', 'onloadstart：readyState=LOADING(1)');
    };
    reader.onprogress = (ev: any) => {
      if (this._destroyed) return;
      const pct = ev.total ? Math.round((ev.loaded / ev.total) * 100) : 0;
      this.setState({ readerResult: { ...this.state.readerResult, progress: pct } });
    };
    reader.onload = () => {
      if (this._destroyed) return;
      this.setState({ readerResult: { ...this.state.readerResult, readyState: 2 } });
      this._addLog('reader',
        `onload：readyState=DONE(2)，result 类型=${typeof reader.result}，长度=${String(reader.result).length}`);
    };
    reader.onloadend = () => {
      if (this._destroyed) return;
      const result = reader.result;
      const isImage = typeof result === 'string' && result.startsWith('data:image/');
      this.setState({
        readerResult: {
          readyState: 2, progress: 100,
          result: String(result).slice(0, 120),
          dataUrl: isImage ? result : '',
          isImage,
          method: 'readAsDataURL',
        },
      });
      this._addLog('dataurl',
        `onloadend：readAsDataURL 完成${isImage ? '（图片，已生成 data:image/png;base64,...）' : ''}，前缀=${String(result).slice(0, 30)}...`);
    };
    reader.onerror = () => {
      if (this._destroyed) return;
      this._addLog('warn', `onerror：${reader.error?.name || 'Error'} - ${reader.error?.message || ''}`);
    };
    reader.onabort = () => {
      if (this._destroyed) return;
      this._addLog('reader', 'onabort：读取被中止');
    };

    try {
      reader.readAsDataURL(imgBlob);
    } catch (err: any) {
      this._addLog('warn', `readAsDataURL 异常：${err?.message || err}`);
    }
  }

  // abort 演示：读取较大 Blob 后立即 abort()（小 blob 瞬间完成无法中止，需较大数据量停留在 LOADING）
  _abortDemo() {
    if (typeof FileReader === 'undefined') {
      this._addLog('warn', 'FileReader 不可用');
      return;
    }
    let bigBlob;
    try {
      // 构造 ~512KB 文本 Blob，确保读取过程可被 abort 中断
      const chunk = 'A'.repeat(1024);
      const parts: any[] = [];
      for (let i = 0; i < 512; i++) parts.push(chunk);
      bigBlob = new Blob(parts, { type: 'text/plain' });
    } catch (err: any) {
      this._addLog('warn', `构造大 Blob 失败：${err?.message || err}`);
      return;
    }

    if (this._fileReader) {
      try { this._fileReader.abort(); } catch { /* noop */ }
    }
    const reader = new FileReader();
    this._fileReader = reader;
    this.setState({
      readerResult: { readyState: 0, progress: 0, result: '', dataUrl: '', isImage: false, method: 'readAsText (abort 演示)' },
    });
    this._addLog('reader', `abort 演示：readAsText(${bigBlob.size}B) 后立即 reader.abort()`);

    reader.onloadstart = () => {
      if (this._destroyed) return;
      this._addLog('progress', 'onloadstart：readyState=LOADING(1)');
    };
    reader.onprogress = (ev: any) => {
      if (this._destroyed) return;
      const pct = ev.total ? Math.round((ev.loaded / ev.total) * 100) : 0;
      this._addLog('progress', `onprogress：${pct}% (${ev.loaded}/${ev.total})`);
    };
    reader.onabort = () => {
      if (this._destroyed) return;
      this._addLog('reader', `onabort：读取已中止（readyState=${reader.readyState}）`);
    };
    reader.onloadend = () => {
      if (this._destroyed) return;
      this._addLog('reader', `onloadend：终止结束（readyState=${reader.readyState}，result=${reader.result === null ? 'null' : '已生成'}）`);
    };
    reader.onerror = () => {
      if (this._destroyed) return;
      this._addLog('warn', `onerror：${reader.error?.name || 'Error'}`);
    };

    try {
      reader.readAsText(bigBlob, 'utf-8');
      // 下一 tick 中止：onabort / onloadend 会触发，onload 不会触发
      setTimeout(() => {
        try { reader.abort(); } catch { /* noop */ }
      }, 0);
    } catch (err: any) {
      this._addLog('warn', `abort 演示异常：${err?.message || err}`);
    }
  }

  // 检测 FileReaderSync（仅 Worker 内可用，主线程通常 undefined）
  _checkFileReaderSync() {
    if (typeof FileReaderSync !== 'undefined') {
      this._addLog('reader',
        `FileReaderSync 可用（typeof = ${typeof FileReaderSync}），仅 Worker 内可同步调用 readAsText 等`);
    } else {
      this._addLog('warn',
        'FileReaderSync 不可用（仅 Worker 内可用，主线程无此构造器；同步阻塞读取会冻结 UI）');
    }
  }

  _renderCard1() {
    const s = this.state;
    return this._card(
      '1. File System Access API — showOpenFilePicker',
      '(window as any).showOpenFilePicker({ multiple, types, excludeAcceptAllOption }) → Promise<FileSystemFileHandle[]>；'
      + 'FileSystemFileHandle：name / kind("file") / getFile() → Promise<File> / createWritable() → Promise<FileSystemWritableFileStream>。',
      h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'showOpenFilePicker'),
        h(Tag, { color: 'success' }, 'FileSystemFileHandle'),
        h(Tag, { color: 'warning' }, 'getFile()'),
      ),
      [
        h('div', { class: 'flex gap-sm flex-wrap' },
          this._btn('打开文件选择器', { type: 'primary', size: 'sm', onClick: () => this._openFilePicker() }),
          this._btn('读取文件内容', { type: 'primary', size: 'sm', onClick: () => this._readFileContent() }),
        ),
        s.openedFile
          ? h('div', { class: 'flex flex-col gap-xs mt-sm' },
              h('div', { class: 'fs-sm fw-medium' },
                `已读取：${s.openedFile.name}（${s.openedFile.size}B / ${s.openedFile.type}）`),
              h('pre', { class: 'code-block', style: { whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '180px', overflow: 'auto' } },
                s.openedFile.text.slice(0, 1000) + (s.openedFile.text.length > 1000 ? '\n...(截断)' : '')),
            )
          : h('div', { class: 'fs-sm text-tertiary mt-sm' }, '（点击「打开文件选择器」后「读取文件内容」；能力不可用时返回 mock 句柄）'),
      ],
    );
  }

  _renderCard2() {
    const s = this.state;
    return this._card(
      '2. showSaveFilePicker + FileSystemWritableFileStream',
      '(window as any).showSaveFilePicker({ suggestedName, types }) → Promise<FileSystemFileHandle>；'
      + 'handle.createWritable({ keepExistingData }) → Promise<FileSystemWritableFileStream>；'
      + 'stream.write(textOrBlobOrBuffer) / seek(position) / truncate(size) / close()；keepExistingData:false（默认）会清空。',
      h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'showSaveFilePicker'),
        h(Tag, { color: 'success' }, 'createWritable'),
        h(Tag, { color: 'warning' }, 'write/seek/truncate/close'),
      ),
      [
        h('div', { class: 'flex flex-col gap-xs' },
          h('div', { class: 'fs-sm fw-medium' }, '待写入内容（编辑后点「写入并 close」）：'),
          h('textarea', {
            class: 'fsa-save-textarea',
            rows: 3,
            onInput: (e: any) => { this._saveContent = e.target.value; },
          }, 'Hello, File System Access API!\n这是写入测试内容。'),
        ),
        h('div', { class: 'flex gap-sm flex-wrap' },
          this._btn('保存文件', { type: 'primary', size: 'sm', onClick: () => this._saveFilePicker() }),
          this._btn('写入并 close', { type: 'primary', size: 'sm', onClick: () => this._writeAndClose() }),
        ),
        s.savedFile
          ? h('div', { class: 'flex flex-col gap-xs mt-sm' },
              h('div', { class: 'fs-sm fw-medium' }, `已写入：${s.savedFile.name}（${s.savedFile.size} 字节）`),
              h('pre', { class: 'code-block', style: { whiteSpace: 'pre-wrap', wordBreak: 'break-all' } }, s.savedFile.content),
            )
          : h('div', { class: 'fs-sm text-tertiary mt-sm' }, '（点击「保存文件」选择目标后「写入并 close」）'),
      ],
    );
  }

  _renderCard3() {
    const s = this.state;
    return this._card(
      '3. showDirectoryPicker + 递归遍历',
      '(window as any).showDirectoryPicker({ mode }) → Promise<FileSystemDirectoryHandle>；'
      + '(dir as any).entries() / values() / keys() 异步迭代器；getFileHandle(name,{create:true}) / removeEntry(name,{recursive:true})；'
      + 'for await (const [name, handle] of (dir as any).entries()) 递归遍历，handle.kind === "file" / "directory"。',
      h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'showDirectoryPicker'),
        h(Tag, { color: 'success' }, 'entries()'),
        h(Tag, { color: 'warning' }, 'for await'),
      ),
      [
        h('div', { class: 'flex gap-sm flex-wrap' },
          this._btn('打开目录', { type: 'primary', size: 'sm', onClick: () => this._openDirPicker() }),
          this._btn('递归遍历', { type: 'primary', size: 'sm', onClick: () => this._walkDirectory() }),
        ),
        s.dirTree
          ? h('div', { class: 'flex flex-col gap-xs mt-sm' },
              h('div', { class: 'fs-sm fw-medium' }, `目录：${s.dirTree.name}（${s.dirTree.entries.length} 条目）`),
              h('div', { class: 'log-panel', style: { maxHeight: '280px', overflow: 'auto' } },
                s.dirTree.entries.map((e: any) => h('div', { class: 'log-panel__line' },
                  h('span', {
                    class: `log-panel__tag log-panel__tag--${e.kind === 'directory' ? 'dir' : e.kind === 'file' ? 'file' : 'err'}`,
                  }, e.kind === 'directory' ? 'DIR' : e.kind === 'file' ? 'FILE' : 'ERR'),
                  h('span', { style: { paddingLeft: `${e.depth * 18}px` } }, e.path || e.name),
                )),
              ),
            )
          : h('div', { class: 'fs-sm text-tertiary mt-sm' }, '（点击「打开目录」后「递归遍历」；能力不可用时返回 mock 目录树）'),
      ],
    );
  }

  _renderCard4() {
    const s = this.state;
    const bi = s.blobInfo;
    return this._card(
      '4. File / Blob API',
      'new File([bits], name, { type, lastModified })；new Blob([data], { type })；'
      + 'blob.size / blob.type；blob.text() → Promise<string> / arrayBuffer() → Promise<ArrayBuffer> / stream() → ReadableStream；'
      + 'blob.slice(start, end, contentType)；URL.createObjectURL(blob) / revokeObjectURL(url)。',
      h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'Blob'),
        h(Tag, { color: 'success' }, 'File'),
        h(Tag, { color: 'warning' }, 'createObjectURL'),
      ),
      [
        h('div', { class: 'flex flex-col gap-xs' },
          h('div', { class: 'fs-sm fw-medium' }, 'Blob 内容：'),
          h('textarea', {
            class: 'fsa-blob-textarea',
            rows: 3,
            onInput: (e: any) => { this._blobText = e.target.value; },
          }, 'Hello Blob\n第二行\n含中文与 emoji 🌍'),
        ),
        h('div', { class: 'flex gap-sm flex-wrap' },
          this._btn('创建 Blob', { type: 'primary', size: 'sm', onClick: () => this._createBlob() }),
          this._btn('读取 text', { type: 'primary', size: 'sm', onClick: () => this._readBlobText() }),
          this._btn('读取 arrayBuffer', { type: 'primary', size: 'sm', onClick: () => this._readBlobArrayBuffer() }),
          this._btn('slice', { size: 'sm', onClick: () => this._sliceBlob() }),
          this._btn('new File()', { size: 'sm', onClick: () => this._newFileConstruct() }),
        ),
        bi
          ? h('div', { class: 'flex flex-col gap-xs mt-sm' },
              h('div', { class: 'fs-sm text-secondary' },
                `Blob：${bi.size} 字节 / ${bi.type}${bi.url ? '，object URL 已生成' : '（URL.createObjectURL 不可用）'}`),
              bi.text && h('div', { class: 'fs-sm' }, `blob.text() → ${JSON.stringify(bi.text.slice(0, 60))}`),
              bi.arrayBuffer && h('div', { class: 'fs-sm', style: { wordBreak: 'break-all' } }, `blob.arrayBuffer() → ${bi.arrayBuffer}`),
              bi.slice && h('div', { class: 'fs-sm' }, `blob.slice() → ${bi.slice}`),
            )
          : h('div', { class: 'fs-sm text-tertiary mt-sm' }, '（点击「创建 Blob」后可读取 text / arrayBuffer / slice）'),
      ],
    );
  }

  _renderCard5() {
    const s = this.state;
    const rr = s.readerResult;
    return this._card(
      '5. FileReader + FileReaderSync + 数据 URL',
      'new FileReader()；readAsText(blob, encoding) / readAsArrayBuffer(blob) / readAsDataURL(blob) / readAsBinaryString(blob)；'
      + '事件 onloadstart / onprogress / onload / onerror / onloadend / onabort；result / error / readyState(0 EMPTY/1 LOADING/2 DONE)；'
      + 'abort()；FileReaderSync（仅 Worker）为同步版；数据 URL 格式 data:[<mediatype>][;base64],<data>。',
      h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'FileReader'),
        h(Tag, { color: 'success' }, 'readAsDataURL'),
        h(Tag, { color: 'warning' }, 'FileReaderSync'),
      ),
      [
        h('div', { class: 'flex gap-sm flex-wrap' },
          this._btn('readAsDataURL', { type: 'primary', size: 'sm', onClick: () => this._readAsDataURL() }),
          this._btn('abort 演示', { danger: true, size: 'sm', onClick: () => this._abortDemo() }),
          this._btn('检测 FileReaderSync', { size: 'sm', onClick: () => this._checkFileReaderSync() }),
        ),
        rr
          ? h('div', { class: 'flex flex-col gap-xs mt-sm' },
              h('div', { class: 'flex items-center gap-sm' },
                h('span', { class: 'fs-sm text-secondary' }, '进度：'),
                h('div', { style: { flex: '1', height: '8px', background: 'var(--color-fill)', borderRadius: '4px', overflow: 'hidden' } },
                  h('div', { style: { height: '100%', width: `${rr.progress}%`, background: 'var(--color-primary)', transition: 'width 0.2s' } })),
                h('span', { class: 'fs-sm fw-medium' }, `${rr.progress}%`),
                h('span', { class: 'fs-sm text-tertiary' }, `readyState=${rr.readyState}`),
                h('span', { class: 'fs-sm text-tertiary' }, `(${rr.method})`),
              ),
              rr.isImage && rr.dataUrl && h('div', { class: 'flex flex-col gap-xs' },
                h('div', { class: 'fs-sm fw-medium' }, 'data URL 图片预览：'),
                h('img', {
                  src: rr.dataUrl, alt: 'preview',
                  style: { maxWidth: '320px', maxHeight: '240px', border: '1px solid var(--color-border)' },
                }),
              ),
              rr.result && h('div', { class: 'flex flex-col gap-xs' },
                h('div', { class: 'fs-sm fw-medium' }, '读取结果（截断 120 字符）：'),
                h('pre', { class: 'code-block', style: { whiteSpace: 'pre-wrap', wordBreak: 'break-all' } }, rr.result),
              ),
            )
          : h('div', { class: 'fs-sm text-tertiary mt-sm' }, '（点击「readAsDataURL」读取小图片生成 data URL）'),
      ],
    );
  }

  // =================== 日志面板 ===================
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

  // =================== 主渲染 ===================
  render() {
    const s = this.state;
    return h('div', { class: 'page api-lab-page' },
      h('h2', { class: 'section-title' }, '文件系统访问 API 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        'File System Access API 让 Web 直接读写本地文件；File/Blob/FileReader 是处理二进制数据的基石。本页演示文件选择/保存/目录遍历与二进制读写。'),
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
