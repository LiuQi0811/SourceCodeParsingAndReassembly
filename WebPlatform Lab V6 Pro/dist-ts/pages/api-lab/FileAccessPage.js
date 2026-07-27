// FileAccessPage.js —— 文件访问 Web API 实验室
// 演示 MDN：File System Access API（showOpenFilePicker / showSaveFilePicker / showDirectoryPicker、
//           FileSystemFileHandle / FileSystemDirectoryHandle、createWritable、entries、queryPermission）、
//           File API（File / FileList、file.text / arrayBuffer / slice / stream、DataTransfer 拖放）、
//           FileReader（readAsText / readAsArrayBuffer / readAsDataURL、事件 / readyState / abort）、
//           TextEncoder / TextDecoder / TextEncoderStream / TextDecoderStream（编码与流式编解码）、
//           Blob / URL.createObjectURL / revokeObjectURL / new File（无服务端生成下载）
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
// TextDecoder 常见编码标签（演示 decode 支持多种历史编码，encode 仅支持 UTF-8）
const DECODER_LABELS = ['utf-8', 'utf-16le', 'utf-16be', 'gbk', 'shift_jis', 'big5', 'euc-kr'];
export class FileAccessPage extends Page {
    _fileReader = null;
    _inited = false;
    initialState() {
        const w = typeof window !== 'undefined' ? window : {};
        return {
            logs: [],
            // —— Card 1: File System Access API ——
            fsaOpen: 'showOpenFilePicker' in w,
            fsaSave: 'showSaveFilePicker' in w,
            fsaDir: 'showDirectoryPicker' in w,
            fileHandle: null,
            fileName: '',
            fileContent: '',
            saveContent: 'Hello, File System Access API!\n你好，文件系统访问 API！',
            dirHandle: null,
            dirName: '',
            dirEntries: [],
            permStatus: '未查询',
            // —— Card 2: File API + 拖放 ——
            pickedFiles: [],
            dropActive: false,
            firstFileText: '',
            // —— Card 3: FileReader ——
            hasFileReader: typeof FileReader !== 'undefined',
            fileReaderProgress: 0,
            fileReaderResult: '',
            fileReaderReadyState: 0,
            fileReaderDataUrl: '',
            fileReaderIsImage: false,
            // —— Card 4: TextEncoder / TextDecoder ——
            hasTextEncoder: typeof TextEncoder !== 'undefined',
            hasTextDecoder: typeof TextDecoder !== 'undefined',
            hasTextEncoderStream: typeof TextEncoderStream !== 'undefined',
            hasTextDecoderStream: typeof TextDecoderStream !== 'undefined',
            encodeInput: '你好，世界！Hello World 🌍',
            encodeBytes: '',
            encodeRoundtrip: '',
            encodeByteLen: 0,
            encodeCharLen: 0,
            streamRoundtrip: '',
            // —— Card 5: Blob + URL.createObjectURL ——
            hasBlob: typeof Blob !== 'undefined',
            hasUrl: typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function',
            hasFile: typeof File !== 'undefined',
            blobText: '这是 Blob 内容\n第二行\n可用作无服务端下载',
            blobUrl: '',
            blobSize: 0,
            blobType: 'text/plain',
        };
    }
    // —— 生命周期 ——
    componentDidMount() {
        // 关键守卫：防止 setState => rerender => componentDidMount 死循环（历史 OOM 根因）
        if (this._inited)
            return;
        this._inited = true;
        const s = this.state;
        this._addLog('fsa', `能力检测：FSA(open=${s.fsaOpen}/save=${s.fsaSave}/dir=${s.fsaDir})；FileReader=${s.hasFileReader}；`
            + `编解码=${s.hasTextEncoder}/${s.hasTextDecoder}；流式编解码=${s.hasTextEncoderStream}/${s.hasTextDecoderStream}；`
            + `Blob=${s.hasBlob}/URL=${s.hasUrl}/File=${s.hasFile}`);
        // 拖放采用 document 委托 + this.on：元素在重渲染后被替换仍能保留绑定，且卸载时自动解绑
        this.on(document, 'dragover', (e) => {
            if (e.target && e.target.closest && e.target.closest('.drop-zone')) {
                e.preventDefault(); // 必须 preventDefault 才能触发后续 drop
                if (!this.state.dropActive)
                    this.setState({ dropActive: true });
            }
        });
        this.on(document, 'drop', (e) => {
            const zone = e.target && e.target.closest && e.target.closest('.drop-zone');
            if (!zone)
                return;
            e.preventDefault();
            this._handleDrop(e);
        });
        this.on(document, 'dragleave', (e) => {
            // relatedTarget 为空表示离开窗口，复位高亮
            if (this.state.dropActive && !e.relatedTarget)
                this.setState({ dropActive: false });
        });
    }
    componentWillUnmount() {
        // 中止可能进行中的 FileReader
        if (this._fileReader) {
            try {
                this._fileReader.abort();
            }
            catch { /* noop */ }
            this._fileReader = null;
        }
        // 释放 object URL，避免内存泄漏
        if (this.state.blobUrl) {
            try {
                URL.revokeObjectURL(this.state.blobUrl);
            }
            catch { /* noop */ }
        }
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
    // 统一处理 picker 异常：AbortError（用户取消）记为信息，其余记为错误
    _handlePickerError(err, action) {
        if (err && err.name === 'AbortError') {
            this._addLog('fsa', `${action}：用户取消（AbortError）`);
        }
        else {
            this._addLog('err', `${action}异常：${err?.name || 'Error'} - ${err?.message || err}`);
        }
    }
    // =================== 1. File System Access API ===================
    async _openFile() {
        if (!this.state.fsaOpen)
            return this._addLog('err', 'showOpenFilePicker 不可用');
        this._addLog('fsa', '【打开文件】调用 showOpenFilePicker({ types: text/plain })');
        try {
            const [handle] = await window.showOpenFilePicker({
                types: [{ description: '文本文件', accept: { 'text/plain': ['.txt', '.md', '.json', '.csv', '.log'] } }],
                multiple: false,
            });
            const file = await handle.getFile(); // FileSystemFileHandle -> File
            const text = await file.text(); // File.text() -> Promise<string>
            this.setState({ fileHandle: handle, fileName: file.name, fileContent: text });
            this._addLog('fsa', `已打开 ${file.name}（${file.size}B / ${file.type || '未知类型'}），读取 ${text.length} 字符`);
        }
        catch (err) {
            this._handlePickerError(err, '打开文件');
        }
    }
    async _saveFile() {
        if (!this.state.fsaSave)
            return this._addLog('err', 'showSaveFilePicker 不可用');
        const content = this.$('.fsa-save-textarea')?.value ?? this.state.saveContent;
        this._addLog('fsa', `【保存文件】调用 showSaveFilePicker()，内容 ${content.length} 字符`);
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: 'fsa-demo.txt',
                types: [{ description: '文本文件', accept: { 'text/plain': ['.txt'] } }],
            });
            const writable = await handle.createWritable(); // FileSystemWritableFileStream
            await writable.write(content);
            await writable.close();
            this.setState({ saveContent: content });
            const byteLen = new TextEncoder().encode(content).byteLength;
            this._addLog('fsa', `已写入 ${handle.name}（${byteLen} 字节），writable 已 close()`);
        }
        catch (err) {
            this._handlePickerError(err, '保存文件');
        }
    }
    async _openDir() {
        if (!this.state.fsaDir)
            return this._addLog('err', 'showDirectoryPicker 不可用');
        this._addLog('fsa', '【打开目录】调用 showDirectoryPicker()');
        try {
            const dirHandle = await window.showDirectoryPicker();
            const entries = [];
            // for await 遍历一层 + 递归一层子目录，避免深层遍历卡顿；全部收集后一次性 setState
            for await (const [name, handle] of dirHandle.entries()) {
                entries.push({ name, kind: handle.kind, depth: 0 });
                if (handle.kind === 'directory') {
                    try {
                        for await (const [subName, subHandle] of handle.entries()) {
                            entries.push({ name: subName, kind: subHandle.kind, depth: 1, parent: name });
                        }
                    }
                    catch (subErr) {
                        entries.push({ name: `(读取失败: ${subErr.message})`, kind: 'error', depth: 1, parent: name });
                    }
                }
            }
            entries.sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name));
            this.setState({ dirHandle, dirName: dirHandle.name, dirEntries: entries });
            this._addLog('fsa', `已打开目录 ${dirHandle.name}，共 ${entries.length} 个条目（含一层子目录）`);
        }
        catch (err) {
            this._handlePickerError(err, '打开目录');
        }
    }
    async _createFileInDir() {
        if (!this.state.dirHandle)
            return this._addLog('err', '请先打开一个目录');
        try {
            const name = `fsa-${Date.now().toString(36)}.txt`;
            // getFileHandle(name, { create: true }) 在目录中创建新文件句柄
            const fileHandle = await this.state.dirHandle.getFileHandle(name, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(`由 File System Access API 创建：${new Date().toISOString()}`);
            await writable.close();
            this._addLog('fsa', `在 ${this.state.dirName} 中创建文件 ${name}（create:true）并写入内容`);
            this._openDir(); // 刷新条目列表
        }
        catch (err) {
            this._handlePickerError(err, '创建文件');
        }
    }
    async _removeFirstEntry() {
        if (!this.state.dirHandle)
            return this._addLog('err', '请先打开一个目录');
        const first = this.state.dirEntries.find((e) => e.depth === 0 && e.kind !== 'error');
        if (!first)
            return this._addLog('err', '目录中没有可删除的条目');
        try {
            await this.state.dirHandle.removeEntry(first.name);
            this._addLog('fsa', `已 removeEntry(${first.name})`);
            this._openDir();
        }
        catch (err) {
            this._handlePickerError(err, '删除条目');
        }
    }
    async _queryPerm(mode) {
        const handle = this.state.fileHandle || this.state.dirHandle;
        if (!handle)
            return this._addLog('err', '请先打开文件或目录');
        try {
            const perm = await handle.queryPermission({ mode });
            this.setState({ permStatus: `queryPermission(${mode}) => ${perm}` });
            this._addLog('fsa', `queryPermission({ mode: '${mode}' }) => ${perm}`);
        }
        catch (err) {
            this._addLog('err', `queryPermission 异常：${err.message}`);
        }
    }
    async _requestPerm(mode) {
        const handle = this.state.fileHandle || this.state.dirHandle;
        if (!handle)
            return this._addLog('err', '请先打开文件或目录');
        try {
            const perm = await handle.requestPermission({ mode });
            this.setState({ permStatus: `requestPermission(${mode}) => ${perm}` });
            this._addLog('fsa', `requestPermission({ mode: '${mode}' }) => ${perm}`);
        }
        catch (err) {
            this._addLog('err', `requestPermission 异常：${err.message}`);
        }
    }
    // =================== 2. File API + 拖放 ===================
    _onFilePick(e) {
        this._ingestFiles(e.target.files, 'input');
    }
    _ingestFiles(files, source) {
        if (!files || files.length === 0)
            return this._addLog('file', `${source} 未提供文件`);
        // FileList -> 数组化，提取属性；保留原始 File 引用以便后续读取
        const list = Array.from(files).map((f) => ({
            name: f.name, size: f.size, type: f.type || '(空)',
            lastModified: f.lastModified,
            lastModifiedDate: new Date(f.lastModified).toLocaleString('zh-CN'),
            _file: f,
        }));
        this.setState({ pickedFiles: list });
        this._addLog('file', `${source} 接收 ${list.length} 个文件：${list.map((f) => f.name).join(', ')}`);
    }
    _handleDrop(e) {
        this.setState({ dropActive: false });
        const files = e.dataTransfer?.files;
        const types = e.dataTransfer?.types;
        this._addLog('file', `drop 事件：dataTransfer.types=[${(types || []).join(',')}]，files=${files?.length || 0}`);
        this._ingestFiles(files, 'drop');
    }
    async _readFirstAsText() {
        const f = this.state.pickedFiles[0];
        if (!f)
            return this._addLog('err', '没有可读取的文件');
        try {
            this._addLog('file', `读取 ${f.name}（file.text()）...`);
            const text = await f._file.text(); // File.text() 返回 Promise<string>
            this.setState({ firstFileText: text.slice(0, 2000) });
            this._addLog('file', `${f.name} 读取完成，共 ${text.length} 字符（预览前 2000）`);
        }
        catch (err) {
            this._addLog('err', `file.text() 异常：${err.message}`);
        }
    }
    // =================== 3. FileReader（回调式） ===================
    _startFileReader(method) {
        if (!this.state.hasFileReader)
            return this._addLog('err', 'FileReader 不可用');
        const f = this.state.pickedFiles[0];
        if (!f)
            return this._addLog('err', '请先在上方 Card 2 选择或拖入一个文件');
        // 中止上一个 reader，避免事件串扰
        if (this._fileReader) {
            try {
                this._fileReader.abort();
            }
            catch { /* noop */ }
        }
        const reader = new FileReader();
        this._fileReader = reader;
        this.setState({ fileReaderProgress: 0, fileReaderResult: '', fileReaderDataUrl: '', fileReaderIsImage: false, fileReaderReadyState: 0 });
        this._addLog('reader', `FileReader.${method}(${f.name}, ${f.size}B) 开始`);
        // 通过 this.on 绑定事件，卸载时自动解绑；reader 是 EventTarget，重渲染不影响其绑定
        this.on(reader, 'loadstart', () => {
            this.setState({ fileReaderReadyState: 1 });
            this._addLog('reader', 'onloadstart：readyState=LOADING(1)');
        });
        this.on(reader, 'progress', (ev) => {
            const pct = ev.total ? Math.round((ev.loaded / ev.total) * 100) : 0;
            this.setState({ fileReaderProgress: pct });
        });
        this.on(reader, 'load', () => {
            this.setState({ fileReaderReadyState: 2 });
            this._addLog('reader', `onload：readyState=DONE(2)，result 类型=${typeof reader.result}，长度=${String(reader.result).length}`);
        });
        this.on(reader, 'loadend', () => {
            const result = reader.result;
            const isImg = method === 'readAsDataURL' && f.type.startsWith('image/');
            this.setState({
                fileReaderReadyState: 2, fileReaderProgress: 100,
                fileReaderResult: method === 'readAsArrayBuffer' ? `(ArrayBuffer, ${result?.byteLength || 0} 字节)` : String(result).slice(0, 2000),
                fileReaderDataUrl: isImg ? result : '', fileReaderIsImage: isImg,
            });
            this._addLog('reader', `onloadend：${method} 完成${isImg ? '（图片，已生成 data URL 并预览）' : ''}`);
        });
        this.on(reader, 'error', () => this._addLog('err', `onerror：${reader.error?.name} - ${reader.error?.message}`));
        this.on(reader, 'abort', () => this._addLog('reader', 'onabort：读取被中止'));
        try {
            if (method === 'readAsText')
                reader.readAsText(f._file, 'utf-8');
            else if (method === 'readAsArrayBuffer')
                reader.readAsArrayBuffer(f._file);
            else if (method === 'readAsDataURL')
                reader.readAsDataURL(f._file);
        }
        catch (err) {
            this._addLog('err', `FileReader.${method} 异常：${err.message}`);
        }
    }
    _abortFileReader() {
        if (!this._fileReader)
            return this._addLog('reader', '当前没有进行中的 FileReader');
        try {
            this._fileReader.abort(); // 触发 onabort + onloadend
            this._addLog('reader', '已调用 reader.abort()');
        }
        catch (err) {
            this._addLog('err', `abort 异常：${err.message}`);
        }
    }
    // =================== 4. TextEncoder / TextDecoder ===================
    _runEncodeDecode() {
        if (!this.state.hasTextEncoder || !this.state.hasTextDecoder) {
            return this._addLog('err', 'TextEncoder/TextDecoder 不可用');
        }
        try {
            const input = this.$('.encode-textarea')?.value ?? this.state.encodeInput;
            const encoder = new TextEncoder();
            const bytes = encoder.encode(input); // string -> Uint8Array（仅 UTF-8）
            // encodeInto 演示：写入预分配缓冲区，返回 { read, written }
            const target = new Uint8Array(bytes.length * 2);
            const into = encoder.encodeInto(input, target);
            // 十六进制 dump（前 64 字节）
            const hex = Array.from(bytes.slice(0, 64))
                .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
                .join(' ');
            const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: false });
            const roundtrip = decoder.decode(bytes); // Uint8Array -> string
            this.setState({
                encodeInput: input, encodeBytes: hex + (bytes.length > 64 ? ` ... (共 ${bytes.length} 字节)` : ''),
                encodeRoundtrip: roundtrip, encodeByteLen: bytes.length, encodeCharLen: input.length,
            });
            this._addLog('encode', `编码：${input.length} 字符 => ${bytes.length} 字节；encodeInto => { read: ${into.read}, written: ${into.written} }；解码回环一致=${roundtrip === input}`);
        }
        catch (err) {
            this._addLog('err', `编码/解码异常：${err.message}`);
        }
    }
    async _runStreamRoundtrip() {
        if (!this.state.hasTextEncoderStream || !this.state.hasTextDecoderStream) {
            return this._addLog('err', 'TextEncoderStream / TextDecoderStream 不可用');
        }
        try {
            const chunks = ['第一块 ', '第二块 ', '第三块🌍', '完结'];
            this._addLog('encode', `【流式回环】ReadableStream<${chunks.length} chunk> → TextEncoderStream → TextDecoderStream`);
            const source = new ReadableStream({
                start(controller) {
                    chunks.forEach((c) => controller.enqueue(c));
                    controller.close();
                },
            });
            // TransformStream 串联：string -> bytes -> string
            const piped = source.pipeThrough(new TextEncoderStream()).pipeThrough(new TextDecoderStream());
            const reader = piped.getReader();
            let collected = '', count = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                collected += value;
                count++;
                this._addLog('encode', `流式 chunk#${count} = ${JSON.stringify(value)}`);
            }
            this.setState({ streamRoundtrip: collected });
            this._addLog('encode', `流式回环完成：${count} chunk，拼接=${JSON.stringify(collected)}，与原输入一致=${collected === chunks.join('')}`);
        }
        catch (err) {
            this._addLog('err', `流式回环异常：${err.message}`);
        }
    }
    _testDecoderLabels() {
        if (!this.state.hasTextDecoder)
            return this._addLog('err', 'TextDecoder 不可用');
        const sample = new TextEncoder().encode('ABC');
        const results = [];
        for (const label of DECODER_LABELS) {
            try {
                const dec = new TextDecoder(label, { fatal: false });
                results.push(`${label}=>${JSON.stringify(dec.decode(sample))}`);
            }
            catch (err) {
                results.push(`${label}=>[不支持: ${err.name}]`);
            }
        }
        this._addLog('encode', `TextDecoder 编码标签测试：${results.join(' | ')}`);
    }
    // =================== 5. Blob + URL.createObjectURL ===================
    _buildBlobUrl() {
        if (!this.state.hasBlob || !this.state.hasUrl) {
            return this._addLog('err', 'Blob 或 URL.createObjectURL 不可用');
        }
        try {
            const text = this.$('.blob-textarea')?.value ?? this.state.blobText;
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            // 撤销旧的 object URL，避免泄漏
            if (this.state.blobUrl) {
                try {
                    URL.revokeObjectURL(this.state.blobUrl);
                }
                catch { /* noop */ }
            }
            const url = URL.createObjectURL(blob);
            this.setState({ blobText: text, blobUrl: url, blobSize: blob.size, blobType: blob.type });
            this._addLog('file', `Blob 已创建：${blob.size} 字节 / ${blob.type}，object URL=${url.slice(0, 50)}...`);
        }
        catch (err) {
            this._addLog('err', `createObjectURL 异常：${err.message}`);
        }
    }
    _sliceBlob() {
        if (!this.state.hasBlob)
            return this._addLog('err', 'Blob 不可用');
        try {
            const text = this.$('.blob-textarea')?.value ?? this.state.blobText;
            const blob = new Blob([text], { type: 'text/plain' });
            const slice = blob.slice(0, Math.min(10, blob.size), 'text/plain');
            this._addLog('file', `blob.slice(0, 10) => ${slice.size} 字节（原 ${blob.size}，type=${slice.type}）`);
        }
        catch (err) {
            this._addLog('err', `blob.slice 异常：${err.message}`);
        }
    }
    _downloadJsonBlob() {
        if (!this.state.hasBlob)
            return this._addLog('err', 'Blob 不可用');
        try {
            const payload = {
                source: 'api-lab FileAccessPage',
                ts: Date.now(),
                message: '通过 Blob + a[download] 触发的无服务端下载',
                nested: { ok: true, arr: [1, 2, 3] },
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `api-lab-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click(); // 程序化点击触发下载
            a.remove();
            // 下载触发后即可释放
            setTimeout(() => { try {
                URL.revokeObjectURL(url);
            }
            catch { /* noop */ } }, 1000);
            this._addLog('file', `JSON Blob 下载已触发：${blob.size} 字节，文件名=${a.download}`);
        }
        catch (err) {
            this._addLog('err', `JSON Blob 下载异常：${err.message}`);
        }
    }
    _constructFile() {
        if (!this.state.hasFile)
            return this._addLog('err', 'File 构造不可用');
        try {
            // new File 继承 Blob，parts 可为字符串/ArrayBuffer/Blob
            const file = new File(['Hello File!', '\n第二行'], `constructed-${Date.now()}.txt`, {
                type: 'text/plain',
                lastModified: Date.now(),
            });
            this._addLog('file', `new File() => ${file.name}，${file.size} 字节，type=${file.type}，File instanceof Blob=${file instanceof Blob}`);
        }
        catch (err) {
            this._addLog('err', `File 构造异常：${err.message}`);
        }
    }
    // =================== 渲染 ===================
    renderPage() {
        const s = this.state;
        const hasFsaAny = s.fsaOpen || s.fsaSave || s.fsaDir;
        return [
            h('h2', { class: 'section-title' }, '文件访问 Web API 实验室'),
            h(Alert, {
                type: 'info',
                message: 'File System Access API / File API / FileReader / TextEncoder-Decoder / Blob+URL',
                description: '五大文件相关 Web API 综合演示。File System Access API 需安全上下文（HTTPS/localhost）与用户手势；所有操作日志输出在页面底部日志面板。',
            }),
            // ============ 1. File System Access API ============
            h(Card, {
                title: '1. File System Access API（打开 / 保存 / 目录选择器）',
                extra: h(Tag, { color: 'primary' }, 'FSA'),
            }, h('div', { class: 'flex flex-col gap-sm' }, h('p', { class: 'fs-sm text-secondary' }, '(window as any).showOpenFilePicker / showSaveFilePicker / showDirectoryPicker 返回 FileSystemHandle，可跨会话持有。handle.getFile().text() 读取；createWritable().write().close() 写入；for await...of 遍历目录；getFileHandle/getDirectoryHandle({create:true}) 创建；removeEntry 删除；queryPermission/requestPermission 申请持久权限。'), h('div', { class: 'flex items-center gap-sm flex-wrap' }, h(Tag, { color: s.fsaOpen ? 'success' : 'warning' }, s.fsaOpen ? 'showOpenFilePicker ✓' : 'showOpenFilePicker ✗'), h(Tag, { color: s.fsaSave ? 'success' : 'warning' }, s.fsaSave ? 'showSaveFilePicker ✓' : 'showSaveFilePicker ✗'), h(Tag, { color: s.fsaDir ? 'success' : 'warning' }, s.fsaDir ? 'showDirectoryPicker ✓' : 'showDirectoryPicker ✗')), !hasFsaAny
                ? h(Alert, { type: 'warning', message: '当前环境不支持 File System Access API（需 Chromium 系浏览器 + 安全上下文）' })
                : h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('打开文件', { type: 'primary', size: 'sm', onClick: () => this._openFile(), disabled: !s.fsaOpen }), this._btn('保存文件', { type: 'primary', size: 'sm', onClick: () => this._saveFile(), disabled: !s.fsaSave }), this._btn('打开目录', { type: 'primary', size: 'sm', onClick: () => this._openDir(), disabled: !s.fsaDir }), this._btn('目录中新建文件', { size: 'sm', onClick: () => this._createFileInDir(), disabled: !s.dirHandle }), this._btn('删除首条目', { danger: true, size: 'sm', onClick: () => this._removeFirstEntry(), disabled: !s.dirHandle }), this._btn('queryPermission(read)', { size: 'sm', onClick: () => this._queryPerm('read'), disabled: !(s.fileHandle || s.dirHandle) }), this._btn('requestPermission(rw)', { size: 'sm', onClick: () => this._requestPerm('readwrite'), disabled: !(s.fileHandle || s.dirHandle) })), h('div', { class: 'flex flex-col gap-xs' }, h('div', { class: 'fs-sm fw-medium' }, '保存内容（编辑后点「保存文件」写入）：'), h('textarea', { class: 'fsa-save-textarea', rows: 4, onInput: (e) => { this.state.saveContent = e.target.value; } }, s.saveContent)), s.fileName && h('div', { class: 'flex flex-col gap-xs' }, h('div', { class: 'fs-sm fw-medium' }, `已打开文件：${s.fileName}`), h('pre', { class: 'code-block', style: { whiteSpace: 'pre-wrap', wordBreak: 'break-all' } }, s.fileContent.slice(0, 1000) + (s.fileContent.length > 1000 ? '\n...(截断)' : ''))), s.dirName && h('div', { class: 'flex flex-col gap-xs' }, h('div', { class: 'fs-sm fw-medium' }, `目录：${s.dirName}（${s.dirEntries.length} 条目）`), h('div', { class: 'log-panel' }, s.dirEntries.length === 0
                ? h('div', { class: 'log-panel__line' }, h('span', {}, '（空目录）'))
                : s.dirEntries.map((e) => h('div', { class: 'log-panel__line' }, h('span', { class: `log-panel__tag log-panel__tag--${e.kind === 'directory' ? 'dir' : e.kind === 'file' ? 'file' : 'err'}` }, e.kind === 'directory' ? 'DIR' : e.kind === 'file' ? 'FILE' : 'ERR'), h('span', { style: { paddingLeft: `${e.depth * 18}px` } }, `${e.parent ? '└ ' : ''}${e.name}`))))), s.permStatus && h('div', { class: 'fs-sm text-tertiary' }, `权限：${s.permStatus}`))),
            // ============ 2. File API + 拖放 ============
            h(Card, {
                title: '2. File API + 拖放文件（input[type=file] / DataTransfer）',
                extra: h(Tag, { color: 'primary' }, 'File'),
            }, h('div', { class: 'flex flex-col gap-sm' }, h('p', { class: 'fs-sm text-secondary' }, '<input type="file"> 的 .files 是 FileList；File 继承 Blob，含 name/size/type/lastModified。方法：text() / arrayBuffer() / slice() / stream()。拖放通过 dataTransfer.files 获取，dragover 必须 preventDefault 才能触发 drop。'), h('div', { class: 'flex items-center gap-sm flex-wrap' }, h('input', { type: 'file', accept: 'image/*,text/*,.json,.csv,.txt', multiple: true, onChange: (e) => this._onFilePick(e) }), this._btn('读取首个文件为文本', { type: 'primary', size: 'sm', onClick: () => this._readFirstAsText(), disabled: s.pickedFiles.length === 0 })), h('div', {
                class: 'drop-zone' + (s.dropActive ? ' drop-zone--active' : ''),
                style: {
                    border: `2px dashed ${s.dropActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    borderRadius: '8px', padding: '24px', textAlign: 'center',
                    background: s.dropActive ? 'var(--color-primary-bg)' : 'var(--color-fill)', transition: 'all 0.15s',
                },
            }, h('div', { class: 'fs-sm text-secondary' }, `将文件拖放到此处（dragover 已 preventDefault，当前状态：${s.dropActive ? '拖入中' : '空闲'}）`)), s.pickedFiles.length === 0
                ? h('div', { class: 'fs-sm text-tertiary' }, '（暂未选择文件）')
                : h('table', { class: 'data-table', style: { width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' } }, h('thead', {}, h('tr', {}, h('th', { style: thStyle }, '名称'), h('th', { style: thStyle }, '大小(B)'), h('th', { style: thStyle }, '类型'), h('th', { style: thStyle }, 'lastModified'))), h('tbody', {}, ...s.pickedFiles.map((f) => h('tr', {}, h('td', { style: tdStyle }, f.name), h('td', { style: tdStyle }, String(f.size)), h('td', { style: tdStyle }, f.type), h('td', { style: tdStyle }, f.lastModifiedDate))))), s.firstFileText && h('div', { class: 'flex flex-col gap-xs' }, h('div', { class: 'fs-sm fw-medium' }, '首个文件文本预览（前 2000 字符）：'), h('pre', { class: 'code-block', style: { whiteSpace: 'pre-wrap', wordBreak: 'break-all' } }, s.firstFileText)))),
            // ============ 3. FileReader ============
            h(Card, {
                title: '3. FileReader API（回调式遗留读取器）',
                extra: h(Tag, { color: s.hasFileReader ? 'success' : 'warning' }, s.hasFileReader ? 'FileReader ✓' : 'FileReader ✗'),
            }, h('div', { class: 'flex flex-col gap-sm' }, h('p', { class: 'fs-sm text-secondary' }, 'new FileReader() 提供回调式读取：readAsText / readAsArrayBuffer / readAsDataURL / readAsBinaryString。事件 onloadstart/onprogress/onload/onloadend/onerror/onabort；readyState 0=EMPTY/1=LOADING/2=DONE；abort() 中止。需先用上方 Card 2 选择文件。'), !s.hasFileReader
                ? h(Alert, { type: 'warning', message: '当前环境不支持 FileReader' })
                : h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('readAsText', { type: 'primary', size: 'sm', onClick: () => this._startFileReader('readAsText'), disabled: s.pickedFiles.length === 0 }), this._btn('readAsArrayBuffer', { type: 'primary', size: 'sm', onClick: () => this._startFileReader('readAsArrayBuffer'), disabled: s.pickedFiles.length === 0 }), this._btn('readAsDataURL', { type: 'primary', size: 'sm', onClick: () => this._startFileReader('readAsDataURL'), disabled: s.pickedFiles.length === 0 }), this._btn('abort()', { danger: true, size: 'sm', onClick: () => this._abortFileReader() })), h('div', { class: 'flex items-center gap-sm' }, h('span', { class: 'fs-sm text-secondary' }, '进度：'), h('div', { style: { flex: '1', height: '8px', background: 'var(--color-fill)', borderRadius: '4px', overflow: 'hidden' } }, h('div', { style: { height: '100%', width: `${s.fileReaderProgress}%`, background: 'var(--color-primary)', transition: 'width 0.2s' } })), h('span', { class: 'fs-sm fw-medium' }, `${s.fileReaderProgress}%`), h('span', { class: 'fs-sm text-tertiary' }, `readyState=${s.fileReaderReadyState}`)), s.fileReaderIsImage && s.fileReaderDataUrl && h('div', { class: 'flex flex-col gap-xs' }, h('div', { class: 'fs-sm fw-medium' }, 'data URL 图片预览：'), h('img', { src: s.fileReaderDataUrl, alt: 'preview', style: { maxWidth: '320px', maxHeight: '240px' } })), s.fileReaderResult && h('div', { class: 'flex flex-col gap-xs' }, h('div', { class: 'fs-sm fw-medium' }, '读取结果（截断 2000 字符）：'), h('pre', { class: 'code-block', style: { whiteSpace: 'pre-wrap', wordBreak: 'break-all' } }, s.fileReaderResult)))),
            // ============ 4. TextEncoder / TextDecoder ============
            h(Card, {
                title: '4. TextEncoder / TextDecoder + 编码流',
                extra: h(Tag, { color: 'primary' }, 'Codec'),
            }, h('div', { class: 'flex flex-col gap-sm' }, h('p', { class: 'fs-sm text-secondary' }, 'new TextEncoder().encode(str) => Uint8Array（仅 UTF-8）；encodeInto(str, u8) 返回 {read, written}。new TextDecoder(label, {fatal, ignoreBOM}).decode(u8, {stream}) 支持多种编码标签。TextEncoderStream / TextDecoderStream 是 TransformStream，可管道串联做流式编解码。'), h('div', { class: 'flex items-center gap-sm flex-wrap' }, h(Tag, { color: s.hasTextEncoder ? 'success' : 'warning' }, s.hasTextEncoder ? 'TextEncoder ✓' : 'TextEncoder ✗'), h(Tag, { color: s.hasTextDecoder ? 'success' : 'warning' }, s.hasTextDecoder ? 'TextDecoder ✓' : 'TextDecoder ✗'), h(Tag, { color: s.hasTextEncoderStream ? 'success' : 'warning' }, s.hasTextEncoderStream ? 'TextEncoderStream ✓' : '✗'), h(Tag, { color: s.hasTextDecoderStream ? 'success' : 'warning' }, s.hasTextDecoderStream ? 'TextDecoderStream ✓' : '✗')), h('div', { class: 'flex flex-col gap-xs' }, h('div', { class: 'fs-sm fw-medium' }, '输入文本（CJK + Emoji 演示字节 vs 字符差异）：'), h('textarea', { class: 'encode-textarea', rows: 3, onInput: (e) => { this.state.encodeInput = e.target.value; } }, s.encodeInput)), h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('编码 → 十六进制 → 解码回环', { type: 'primary', size: 'sm', onClick: () => this._runEncodeDecode(), disabled: !(s.hasTextEncoder && s.hasTextDecoder) }), this._btn('流式回环', { type: 'primary', size: 'sm', onClick: () => this._runStreamRoundtrip(), disabled: !(s.hasTextEncoderStream && s.hasTextDecoderStream) }), this._btn('TextDecoder 编码标签测试', { size: 'sm', onClick: () => this._testDecoderLabels(), disabled: !s.hasTextDecoder })), s.encodeBytes && h('div', { class: 'flex flex-col gap-xs' }, h('div', { class: 'fs-sm fw-medium' }, `UTF-8 字节（${s.encodeCharLen} 字符 => ${s.encodeByteLen} 字节）：`), h('pre', { class: 'code-block', style: { whiteSpace: 'pre-wrap', wordBreak: 'break-all' } }, s.encodeBytes), h('div', { class: 'fs-sm text-secondary' }, `解码回环：${s.encodeRoundtrip}`)), s.streamRoundtrip && h('div', { class: 'flex flex-col gap-xs' }, h('div', { class: 'fs-sm fw-medium' }, '流式回环拼接结果：'), h('pre', { class: 'code-block', style: { whiteSpace: 'pre-wrap', wordBreak: 'break-all' } }, s.streamRoundtrip)))),
            // ============ 5. Blob + URL.createObjectURL ============
            h(Card, {
                title: '5. Blob + URL.createObjectURL + File 构造',
                extra: h(Tag, { color: 'primary' }, 'Blob'),
            }, h('div', { class: 'flex flex-col gap-sm' }, h('p', { class: 'fs-sm text-secondary' }, 'new Blob([parts], {type}) 可由字符串/ArrayBuffer/TypedArray/Blob 组合；.size/.type/.slice()/.text()/.arrayBuffer()/.stream()。URL.createObjectURL(blob) 生成 blob: URL，revokeObjectURL 释放。new File([parts], name, {type, lastModified}) 继承 Blob，可结合 a[download] 实现无服务端下载。'), !(s.hasBlob && s.hasUrl)
                ? h(Alert, { type: 'warning', message: 'Blob 或 URL.createObjectURL 不可用' })
                : h('div', { class: 'flex flex-col gap-xs' }, h('div', { class: 'fs-sm fw-medium' }, 'Blob 内容：'), h('textarea', { class: 'blob-textarea', rows: 4, onInput: (e) => { this.state.blobText = e.target.value; } }, s.blobText), h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('生成 object URL', { type: 'primary', size: 'sm', onClick: () => this._buildBlobUrl() }), this._btn('blob.slice(0,10)', { size: 'sm', onClick: () => this._sliceBlob() }), this._btn('下载 JSON Blob', { type: 'primary', size: 'sm', onClick: () => this._downloadJsonBlob() }), this._btn('new File() 构造', { size: 'sm', onClick: () => this._constructFile(), disabled: !s.hasFile })), s.blobUrl && h('div', { class: 'flex flex-col gap-xs' }, h('div', { class: 'fs-sm text-secondary' }, `Blob：${s.blobSize} 字节 / ${s.blobType}`), h('a', { href: s.blobUrl, download: 'blob-demo.txt', class: 'btn btn--primary btn--sm' }, '下载 Blob（a[download]）'))))),
            // ============ 日志面板 ============
            h(Card, {
                title: '事件日志',
                extra: h(Tag, { color: 'primary' }, `${s.logs.length} 条`),
            }, s.logs.length === 0
                ? h('div', { class: 'fs-sm text-tertiary' }, '（暂无日志）')
                : h('div', { class: 'log-panel' }, ...s.logs.map((log) => h('div', { class: 'log-panel__line' }, h('span', { class: 'log-panel__time' }, log.time), h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type), h('span', {}, log.content))))),
        ];
    }
}
// 表格单元格内联样式（项目无 .data-table 样式，用内联保证可读）
const thStyle = { borderBottom: '1px solid var(--color-border)', textAlign: 'left', padding: '4px 8px' }, tdStyle = { borderBottom: '1px solid var(--color-border)', padding: '4px 8px' };
//# sourceMappingURL=FileAccessPage.js.map