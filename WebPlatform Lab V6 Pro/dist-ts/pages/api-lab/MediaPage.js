// MediaPage.ts —— 多媒体 API 实验室：Geolocation / Clipboard / Drag&Drop / Web Audio / Notification / File
// 演示 MDN：navigator.geolocation、Clipboard API、DragEvent、AudioContext、AnalyserNode、Notification、FileReader
import { Page } from '../../core/Component.js';
import { h, formatTime, copyText, errInfo } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import { message } from '../../components/ui/Message.js';
export class MediaPage extends Page {
    _audioRaf = null;
    _audioCtx = null;
    _oscillator = null;
    _gain = null;
    _analyser = null;
    initialState() {
        return {
            geo: null, geoError: null,
            clipboard: '',
            droppedFiles: [],
            audioRunning: false,
            audioFreq: 0,
            notifPermission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
            events: [],
        };
    }
    componentWillUnmount() {
        if (this._audioRaf != null)
            cancelAnimationFrame(this._audioRaf);
        // 部分环境（如 jsdom/mock）的 AudioContext 可能没有 close 方法，做能力检测避免抛错
        if (this._audioCtx && typeof this._audioCtx.close === 'function') {
            try {
                this._audioCtx.close();
            }
            catch { /* noop */ }
        }
    }
    componentDidMount() {
        this._setupDnd(this.$('.dnd-area'));
    }
    _addLog(type, content) {
        this.setState((s) => ({
            ...s,
            events: [...(s.events || []), { type, content, time: formatTime() }].slice(-25),
        }));
    }
    _btn(label, opts) {
        const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
        this.registerChild(btn);
        return btn.render();
    }
    // —— Geolocation ——
    _getGeo() {
        if (!navigator.geolocation) {
            message.error('当前浏览器不支持 Geolocation');
            return;
        }
        this._addLog('push', 'geolocation.getCurrentPosition ...');
        navigator.geolocation.getCurrentPosition((pos) => {
            const { latitude, longitude, accuracy, altitude, speed } = pos.coords;
            this.setState({
                geo: { latitude, longitude, accuracy, altitude, speed },
                geoError: null,
            });
            this._addLog('info', `定位成功：${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
            message.success('定位成功');
        }, (err) => {
            this.setState({ geoError: `${err.code}: ${err.message}` });
            this._addLog('error', `定位失败：${err.message}`);
            message.error(`定位失败：${err.message}`);
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    }
    // —— Clipboard ——
    async _writeClipboard() {
        const ok = await copyText(this.state.clipboard);
        if (ok) {
            message.success('已写入剪贴板');
            this._addLog('info', `clipboard.writeText(${this.state.clipboard.length} 字符)`);
        }
        else {
            message.error('写入失败');
        }
    }
    async _readClipboard() {
        try {
            if (!navigator.clipboard?.readText) {
                message.warning('当前环境不支持 clipboard.readText');
                return;
            }
            const text = await navigator.clipboard.readText();
            this.setState({ clipboard: text });
            message.success(`读取成功（${text.length} 字符）`);
            this._addLog('info', `clipboard.readText → ${text.length} 字符`);
        }
        catch (err) {
            const info = errInfo(err);
            message.error(`读取失败：${info.message}`);
            this._addLog('error', `读取失败：${info.message}`);
        }
    }
    // —— Drag & Drop ——
    _setupDnd(target) {
        if (!target)
            return;
        this.on(target, 'dragover', (e) => {
            const de = e;
            de.preventDefault();
            if (de.dataTransfer)
                de.dataTransfer.dropEffect = 'copy';
            target.classList.add('is-dragover');
        });
        this.on(target, 'dragleave', () => target.classList.remove('is-dragover'));
        this.on(target, 'drop', (e) => {
            const de = e;
            de.preventDefault();
            target.classList.remove('is-dragover');
            if (!de.dataTransfer)
                return;
            const files = Array.from(de.dataTransfer.files);
            const items = files.map((f) => ({
                name: f.name, size: f.size, type: f.type, lastModified: new Date(f.lastModified).toLocaleString(),
            }));
            this.setState({ droppedFiles: [...this.state.droppedFiles, ...items].slice(-10) });
            this._addLog('info', `drop ${files.length} 个文件`);
            // 读第一个文本文件
            const textFile = files.find((f) => f.type.startsWith('text/'));
            if (textFile) {
                const reader = new FileReader();
                reader.onload = () => {
                    this._addLog('info', `FileReader 读取 ${textFile.name}：${String(reader.result).slice(0, 80)}...`);
                };
                reader.readAsText(textFile);
            }
        });
    }
    // —— Web Audio ——
    _toggleAudio() {
        if (this.state.audioRunning) {
            if (this._audioRaf != null)
                cancelAnimationFrame(this._audioRaf);
            this._oscillator?.stop();
            this._audioCtx?.suspend();
            this.setState({ audioRunning: false });
            this._addLog('error', 'audio paused');
            return;
        }
        try {
            const Ctor = window.AudioContext || window.webkitAudioContext;
            this._audioCtx = this._audioCtx || new Ctor();
            if (this._audioCtx.state === 'suspended')
                this._audioCtx.resume();
            // 振荡器 + 增益 + 分析器
            this._oscillator = this._audioCtx.createOscillator();
            this._gain = this._audioCtx.createGain();
            this._analyser = this._audioCtx.createAnalyser();
            this._analyser.fftSize = 256;
            this._oscillator.type = 'sine';
            this._oscillator.frequency.value = 440;
            this._gain.gain.value = 0.1;
            this._oscillator.connect(this._gain);
            this._gain.connect(this._analyser);
            this._analyser.connect(this._audioCtx.destination);
            this._oscillator.start();
            // 频谱可视化
            const bufferLen = this._analyser.frequencyBinCount;
            const data = new Uint8Array(bufferLen);
            const canvas = this.$('#audio-canvas');
            const ctx = canvas?.getContext('2d');
            const step = () => {
                if (!this._analyser)
                    return;
                this._analyser.getByteFrequencyData(data);
                if (ctx && canvas) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    const barW = canvas.width / bufferLen;
                    for (let i = 0; i < bufferLen; i++) {
                        const v = data[i] / 255;
                        const h = v * canvas.height;
                        ctx.fillStyle = `hsl(${(i / bufferLen) * 240}, 80%, ${30 + v * 40}%)`;
                        ctx.fillRect(i * barW, canvas.height - h, barW - 1, h);
                    }
                }
                // 找峰值频率
                let maxIdx = 0, maxVal = 0;
                for (let i = 0; i < bufferLen; i++) {
                    if (data[i] > maxVal) {
                        maxVal = data[i];
                        maxIdx = i;
                    }
                }
                const freq = maxIdx * (this._audioCtx.sampleRate / this._analyser.fftSize);
                // 注意：不要在 rAF 循环里调用 setState，否则每帧都会触发整页 _rerender，
                // 导致 #audio-canvas 被重建、AnalyserNode 连接丢失、整页卡片闪烁卡顿。
                // 与 HomePage._drawDonut 同源问题：直接写 DOM 即可。
                const freqLabel = this.$('#audio-freq-label');
                if (freqLabel)
                    freqLabel.textContent = `峰值 ${Math.round(freq)}Hz`;
                this._audioRaf = requestAnimationFrame(step);
            };
            this._audioRaf = requestAnimationFrame(step);
            this.setState({ audioRunning: true });
            this._addLog('push', 'audio start 440Hz sine');
        }
        catch (err) {
            const info = errInfo(err);
            message.error(`音频失败：${info.message}`);
            this._addLog('error', info.message);
        }
    }
    // —— Notification ——
    async _requestNotif() {
        if (typeof Notification === 'undefined' || typeof Notification.requestPermission !== 'function') {
            message.warning('当前浏览器不支持 Notification.requestPermission');
            this._addLog('warn', 'Notification.requestPermission 不可用');
            return;
        }
        const perm = await Notification.requestPermission();
        this.setState({ notifPermission: perm });
        this._addLog('info', `Notification.requestPermission → ${perm}`);
        if (perm === 'granted') {
            new Notification('原生 SPA', {
                body: '通知权限已开启，来自 navigator.Notification API',
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
            });
            message.success('已发送系统通知');
        }
    }
    renderPage() {
        const clipboardInput = new Input({
            value: this.state.clipboard, placeholder: '输入要复制的文本',
            onChange: (v) => { this.state.clipboard = v; },
        });
        this.registerChild(clipboardInput);
        return [
            h('h2', { class: 'section-title' }, '多媒体 API 实验室'),
            h(Alert, {
                type: 'info',
                message: 'Geolocation / Clipboard / Drag&Drop / Web Audio / Notification',
                description: '部分 API 需要 HTTPS 或用户授权。本页所有按钮均会真实调用对应原生 API。',
            }),
            h('div', { class: 'feature-grid mt-lg' }, 
            // Geolocation
            h(Card, { title: 'Geolocation 地理位置' }, h('div', { class: 'flex flex-col gap-sm' }, this._btn('获取当前位置', { type: 'primary', size: 'sm', onClick: () => this._getGeo() }), this.state.geoError ? h('div', { class: 'alert alert--error' }, this.state.geoError) : '', this.state.geo ? h('div', { class: 'fs-sm' }, h('div', {}, h('strong', {}, '纬度：'), this.state.geo.latitude.toFixed(6)), h('div', {}, h('strong', {}, '经度：'), this.state.geo.longitude.toFixed(6)), h('div', {}, h('strong', {}, '精度：'), `${this.state.geo.accuracy.toFixed(0)}m`), h('div', {}, h('strong', {}, '海拔：'), this.state.geo.altitude ?? 'N/A')) : '')), 
            // Clipboard
            h(Card, { title: 'Clipboard 剪贴板' }, h('div', { class: 'flex flex-col gap-sm' }, clipboardInput.render(), h('div', { class: 'flex gap-sm' }, this._btn('写入剪贴板', { type: 'primary', size: 'sm', onClick: () => this._writeClipboard() }), this._btn('读取剪贴板', { size: 'sm', onClick: () => this._readClipboard() })), h('p', { class: 'fs-sm text-tertiary' }, 'navigator.clipboard.writeText / readText。读取需要用户授权。'))), 
            // Notification
            h(Card, { title: 'Notification 通知' }, h('div', { class: 'flex flex-col gap-sm' }, h('div', { class: 'flex items-center gap-sm' }, h('span', { class: 'fs-sm' }, '权限：'), h(Tag, {
                color: this.state.notifPermission === 'granted' ? 'success'
                    : this.state.notifPermission === 'denied' ? 'error' : 'warning',
            }, this.state.notifPermission)), this._btn('请求权限并发送通知', {
                type: 'primary', size: 'sm',
                onClick: () => this._requestNotif(),
                disabled: this.state.notifPermission === 'denied',
            })))),
            // Drag & Drop
            h(Card, { title: 'Drag & Drop 拖放 + FileReader' }, h('p', { class: 'fs-sm text-secondary' }, '将本地文件拖入下方区域。演示 dataTransfer.files、FileReader.readAsText。'), h('div', {
                class: 'dnd-area',
            }, h('div', { class: 'dnd-area__hint' }, '拖放文件到此区域')), (this.state.droppedFiles || []).length > 0 ? h('div', { class: 'mt-sm' }, h('div', { class: 'fs-sm text-secondary mb-sm' }, `已接收 ${(this.state.droppedFiles || []).length} 个文件：`), h('div', { class: 'log-panel' }, ...(this.state.droppedFiles || []).map((f, i) => h('div', { class: 'log-panel__line' }, h('span', { class: 'log-panel__tag log-panel__tag--push' }, String(i + 1)), h('span', {}, `${f.name}  (${f.size} bytes, ${f.type || '未知类型'})  ·  ${f.lastModified}`))))) : ''),
            // Web Audio
            h(Card, { title: 'Web Audio 振荡器 + 频谱分析', extra: h(Tag, { color: this.state.audioRunning ? 'success' : 'default' }, h('span', { id: 'audio-freq-label' }, this.state.audioRunning ? `峰值 ${this.state.audioFreq}Hz` : '已停止')) }, h('div', { class: 'flex flex-col gap-sm' }, h('div', { class: 'flex gap-sm' }, this._btn(this.state.audioRunning ? '停止' : '启动 440Hz 正弦波', {
                type: 'primary', size: 'sm', onClick: () => this._toggleAudio(),
            })), h('canvas', { id: 'audio-canvas', class: 'canvas-stage', style: { width: '100%', height: '120px' }, width: 600, height: 120 }), h('p', { class: 'fs-sm text-tertiary' }, 'OscillatorNode → GainNode → AnalyserNode → destination。AnalyserNode.getByteFrequencyData 实时频谱。'))),
            // 事件日志
            h(Card, { title: '事件日志', extra: h('span', { class: 'fs-sm text-tertiary' }, '实时') }),
            h('div', { class: 'log-panel' }, ...this.state.events.map((log) => h('div', { class: 'log-panel__line' }, h('span', { class: 'log-panel__time' }, log.time), h('span', { class: `log-panel__tag log-panel__tag--${log.type === 'info' ? 'push' : log.type}` }, log.type), h('span', {}, log.content)))),
        ];
    }
}
//# sourceMappingURL=MediaPage.js.map