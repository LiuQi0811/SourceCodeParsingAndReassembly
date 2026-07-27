// =====================================================================
// RealtimeCommsPage.ts —— 实时通信 API 实验室
// 演示 MDN：RTCPeerConnection、RTCDataChannel、WebTransport（HTTP/3）、
//           RTCStatsReport（getStats）、WritableStream / ReadableStream
// 说明：WebRTC 部分使用同页面内两个 RTCPeerConnection 进行本地回环
//       演示（无需信令服务器）；WebTransport 侧重能力检测与优雅降级。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime, errInfo } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import { Input } from '../../components/ui/Input.js';
// STUN 服务器配置（Google 公共 STUN，用于 ICE 候选收集）
const RTC_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
// WebTransport 能力检测清单（逐项 typeof 探测）
const WT_FEATURES = [
    'WebTransport',
    'WebTransportError',
    'WebTransportBidirectionalStream',
    'WebTransportDatagramDuplexStream',
    'WebTransportSendStream',
    'WebTransportReceiveStream',
];
export class RealtimeCommsPage extends Page {
    _wtChecked = false;
    _pc1 = null;
    _pc2 = null;
    _dc = null;
    _dc2 = null;
    _transport = null;
    // —— 初始 state ——
    initialState() {
        return {
            logs: [],
            rtcState: 'idle',
            dcState: 'idle',
            iceState: '—',
            signalingState: '—',
            connState: '—',
            messages: [],
            chatInput: '',
            wtSupported: false,
            wtSupportDetail: {},
            wtState: 'idle',
            statsInfo: '',
            statsEntries: [],
            dcInfo: [],
        };
    }
    // —— 生命周期 ——
    componentDidMount() {
        // 仅做 WebTransport 能力检测，不自动创建 RTCPeerConnection（由用户点击触发）
        if (this._wtChecked)
            return; // 防止 _rerender 后重复进入导致 rAF 链爆炸
        this._wtChecked = true;
        this._checkWtSupport();
    }
    componentWillUnmount() {
        // 关闭数据通道
        this._closeDc();
        // 关闭两条 RTCPeerConnection
        this._closePc1();
        this._closePc2();
        // 关闭 WebTransport
        this._closeWt();
    }
    // —— 日志辅助（与项目其它页一致，最多保留 40 条）——
    _addLog(type, content) {
        this.setState({
            logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40),
        });
    }
    // —— 按钮辅助（统一注册子组件，便于销毁）——
    _btn(label, opts) {
        const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
        this.registerChild(btn);
        return btn.render();
    }
    // =================== Card 1：WebRTC 数据通道本地回环 ===================
    // 建立 pc1 ↔ pc2 本地回环连接，并完成 offer/answer 握手
    async _startWebRTC() {
        if (typeof RTCPeerConnection === 'undefined') {
            this._addLog('err', '当前浏览器不支持 RTCPeerConnection');
            return;
        }
        if (this._pc1) {
            this._addLog('rtc', '连接已存在，请先点击「断开」');
            return;
        }
        try {
            this.setState({ rtcState: 'connecting', dcState: 'connecting' });
            this._addLog('rtc', '创建 pc1 / pc2（iceServers: stun.l.google.com:19302）');
            const pc1 = new RTCPeerConnection({ iceServers: RTC_ICE_SERVERS });
            const pc2 = new RTCPeerConnection({ iceServers: RTC_ICE_SERVERS });
            this._pc1 = pc1;
            this._pc2 = pc2;
            // —— ICE 候选交换：本页内直接互投（模拟信令服务器转发）——
            pc1.onicecandidate = (e) => {
                if (e.candidate) {
                    this._addLog('rtc', 'pc1 → pc2 传递 ICE candidate');
                    pc2.addIceCandidate(e.candidate).catch((err) => this._addLog('err', `pc2.addIceCandidate 失败：${errInfo(err).message}`));
                }
            };
            pc2.onicecandidate = (e) => {
                if (e.candidate) {
                    this._addLog('rtc', 'pc2 → pc1 传递 ICE candidate');
                    pc1.addIceCandidate(e.candidate).catch((err) => this._addLog('err', `pc1.addIceCandidate 失败：${errInfo(err).message}`));
                }
            };
            // —— 连接 / ICE / 信令状态变化日志 ——
            pc1.onconnectionstatechange = () => this._logConn('pc1', pc1);
            pc2.onconnectionstatechange = () => this._logConn('pc2', pc2);
            pc1.oniceconnectionstatechange = () => this._logIce('pc1', pc1);
            pc2.oniceconnectionstatechange = () => this._logIce('pc2', pc2);
            pc1.onsignalingstatechange = () => this._logSignaling('pc1', pc1);
            pc2.onsignalingstatechange = () => this._logSignaling('pc2', pc2);
            // —— pc1 主动创建数据通道 ——
            const dc = pc1.createDataChannel('chat');
            this._dc = dc;
            this._setupChannel(dc, false);
            // —— pc2 监听数据通道到达 ——
            pc2.ondatachannel = (e) => {
                this._addLog('dc', `pc2.ondatachannel：收到通道「${e.channel.label}」`);
                this._dc2 = e.channel;
                this._setupChannel(e.channel, true);
            };
            // —— SDP offer / answer 握手流程 ——
            this._addLog('offer', 'pc1.createOffer() ...');
            const offer = await pc1.createOffer();
            await pc1.setLocalDescription(offer);
            this._addLog('offer', `pc1.setLocalDescription(type=${offer.type})`);
            await pc2.setRemoteDescription(offer);
            this._addLog('offer', 'pc2.setRemoteDescription(offer)');
            this._addLog('answer', 'pc2.createAnswer() ...');
            const answer = await pc2.createAnswer();
            await pc2.setLocalDescription(answer);
            this._addLog('answer', `pc2.setLocalDescription(type=${answer.type})`);
            await pc1.setRemoteDescription(answer);
            this._addLog('answer', 'pc1.setRemoteDescription(answer) —— 握手完成');
        }
        catch (err) {
            this._addLog('err', `WebRTC 建连失败：${errInfo(err).message}`);
            this.setState({ rtcState: 'error' });
        }
    }
    // 绑定数据通道事件（统一设置 binaryType=arraybuffer，便于按字节长度统计）
    _setupChannel(dc, isReceiver) {
        try {
            dc.binaryType = 'arraybuffer';
        }
        catch { /* noop */ }
        dc.onopen = () => {
            this._addLog('dc', `${isReceiver ? 'pc2' : 'pc1'} 通道「${dc.label}」已打开 (readyState=${dc.readyState})`);
            this.setState({ dcState: 'open', rtcState: 'connected' });
            this._refreshDcInfo();
        };
        dc.onclose = () => {
            this._addLog('dc', `${isReceiver ? 'pc2' : 'pc1'} 通道「${dc.label}」已关闭 (readyState=${dc.readyState})`);
            if (!isReceiver)
                this.setState({ dcState: 'closed' });
        };
        dc.onerror = (e) => {
            this._addLog('err', `数据通道错误：${e?.error?.message || 'unknown'}`);
        };
        dc.onmessage = (e) => {
            const isBinary = typeof e.data !== 'string';
            const size = isBinary ? (e.data.byteLength ?? 0) : 0;
            const text = isBinary ? `[binary ${size} 字节]` : e.data;
            if (isReceiver) {
                // pc2 收到 pc1 发来的消息
                this._addLog('dc', `pc2 收到：${text}`);
                this.setState({
                    messages: [...this.state.messages, { dir: 'recv', text, time: formatTime() }].slice(-30),
                });
                // pc2 回显文本消息，演示双向通信（二进制不回显）
                if (dc.readyState === 'open' && !isBinary) {
                    try {
                        dc.send(text);
                        this._addLog('dc', `pc2 回显：${text}`);
                    }
                    catch (err) {
                        this._addLog('err', `pc2 回显失败：${errInfo(err).message}`);
                    }
                }
            }
            else {
                // pc1 收到 pc2 的回显
                this._addLog('dc', `pc1 收到回显：${text}`);
                this.setState({
                    messages: [...this.state.messages, { dir: 'echo', text, time: formatTime() }].slice(-30),
                });
            }
        };
    }
    _logConn(who, pc) {
        this._addLog('rtc', `${who}.connectionState = ${pc.connectionState}`);
        this.setState({ connState: pc.connectionState });
    }
    _logIce(who, pc) {
        this._addLog('rtc', `${who}.iceConnectionState = ${pc.iceConnectionState}`);
        this.setState({ iceState: pc.iceConnectionState });
    }
    _logSignaling(who, pc) {
        this._addLog('rtc', `${who}.signalingState = ${pc.signalingState}`);
        this.setState({ signalingState: pc.signalingState });
    }
    // 发送聊天消息（经 pc1 → pc2 → pc1 回显）
    _sendChat(text) {
        const msg = (text || this.state.chatInput || '').trim();
        if (!msg)
            return;
        if (!this._dc || this._dc.readyState !== 'open') {
            this._addLog('err', '发送失败：数据通道未打开');
            return;
        }
        try {
            this._dc.send(msg);
            this._addLog('dc', `pc1 已发送：${msg}`);
            this.setState({
                messages: [...this.state.messages, { dir: 'send', text: msg, time: formatTime() }].slice(-30),
                chatInput: '',
            });
        }
        catch (err) {
            this._addLog('err', `发送失败：${errInfo(err).message}`);
        }
    }
    // 断开所有 RTCPeerConnection 与数据通道
    _disconnectRTC() {
        this._closeDc();
        this._closePc1();
        this._closePc2();
        this.setState({
            rtcState: 'closed',
            dcState: 'closed',
            connState: 'closed',
            iceState: 'closed',
            signalingState: 'closed',
        });
        this._addLog('rtc', '已断开所有 RTCPeerConnection 与数据通道');
    }
    _closeDc() {
        if (this._dc) {
            try {
                this._dc.close();
            }
            catch { /* noop */ }
            this._dc = null;
        }
        if (this._dc2) {
            try {
                this._dc2.close();
            }
            catch { /* noop */ }
            this._dc2 = null;
        }
    }
    _closePc1() {
        if (this._pc1) {
            try {
                this._pc1.close();
            }
            catch { /* noop */ }
            this._pc1 = null;
        }
    }
    _closePc2() {
        if (this._pc2) {
            try {
                this._pc2.close();
            }
            catch { /* noop */ }
            this._pc2 = null;
        }
    }
    // =================== Card 2：WebTransport（HTTP/3）===================
    // 逐项 typeof 检测 WebTransport 系列 API
    _checkWtSupport() {
        const detail = {};
        for (const name of WT_FEATURES) {
            try {
                detail[name] = typeof globalThis[name] !== 'undefined';
            }
            catch {
                detail[name] = false;
            }
        }
        const supportedCount = Object.values(detail).filter(Boolean).length;
        this.setState({ wtSupported: detail.WebTransport, wtSupportDetail: detail });
        this._addLog('wt', `WebTransport 能力检测：${supportedCount}/${WT_FEATURES.length} 项可用`);
    }
    // 尝试连接（带 5s 超时保护，example.com 通常不可达，用于演示调用与降级）
    async _tryWtConnect() {
        if (!this.state.wtSupported) {
            this._addLog('err', '当前浏览器不支持 WebTransport，无法连接');
            return;
        }
        try {
            this.setState({ wtState: 'connecting' });
            this._addLog('wt', '尝试 new WebTransport("https://example.com") ...');
            const transport = new globalThis.WebTransport('https://example.com');
            this._transport = transport;
            // ready 带超时保护，避免长时间挂起
            const timeout = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('连接超时（5s）')), 5000);
            });
            await Promise.race([transport.ready, timeout]);
            this.setState({ wtState: 'ready' });
            this._addLog('wt', 'transport.ready 已 resolved（连接成功）');
        }
        catch (err) {
            this._addLog('err', `WebTransport 连接失败：${errInfo(err).message}`);
            this.setState({ wtState: 'failed' });
            this._closeWt();
        }
    }
    // 演示单向流 / 双向流 / 数据报 API（未连接时仅打印调用形式）
    async _demoWtStreams() {
        if (!this._transport || this.state.wtState !== 'ready') {
            this._addLog('wt', '（未连接）createUnidirectionalStream() → WritableStream');
            this._addLog('wt', '（未连接）createBidirectionalStream() → { readable, writable }');
            this._addLog('wt', '（未连接）datagrams.readable / datagrams.writable');
            return;
        }
        // 单向流：写入一条消息后关闭
        try {
            const writable = await this._transport.createUnidirectionalStream();
            const writer = writable.getWriter();
            const data = new TextEncoder().encode('hello webtransport');
            await writer.write(data);
            await writer.close();
            this._addLog('wt', `createUnidirectionalStream：已写入 ${data.byteLength} 字节并关闭`);
        }
        catch (err) {
            this._addLog('err', `单向流写入失败：${errInfo(err).message}`);
        }
        // 双向流：读 + 写
        try {
            const bidi = await this._transport.createBidirectionalStream();
            this._addLog('wt', `createBidirectionalStream：readable=${!!bidi.readable}, writable=${!!bidi.writable}`);
        }
        catch (err) {
            this._addLog('err', `双向流创建失败：${errInfo(err).message}`);
        }
        // 数据报（不可靠传输）
        try {
            const dg = this._transport.datagrams;
            this._addLog('wt', `datagrams：readable=${!!dg?.readable}, writable=${!!dg?.writable}`);
        }
        catch (err) {
            this._addLog('err', `datagrams 访问失败：${errInfo(err).message}`);
        }
    }
    _closeWt() {
        if (this._transport) {
            try {
                this._transport.close();
            }
            catch { /* noop */ }
            this._transport = null;
            this._addLog('wt', 'WebTransport 已关闭');
            this.setState({ wtState: 'closed' });
        }
    }
    // =================== Card 3：RTCDataChannel 深度剖析 + 统计 ===================
    // 重建数据通道（先断开再建连）
    _recreateChannel() {
        this._disconnectRTC();
        this._startWebRTC();
    }
    // 刷新数据通道属性快照
    _refreshDcInfo() {
        const dc = this._dc;
        if (!dc) {
            this._addLog('dc', '尚无数据通道可检查，请先建立连接');
            this.setState({ dcInfo: [] });
            return;
        }
        const info = [
            { label: 'label', value: String(dc.label) },
            { label: 'id', value: dc.id == null ? 'null' : String(dc.id) },
            { label: 'ordered', value: String(dc.ordered) },
            { label: 'maxRetransmits', value: dc.maxRetransmits == null ? 'null' : String(dc.maxRetransmits) },
            { label: 'maxPacketLifeTime', value: dc.maxPacketLifeTime == null ? 'null' : String(dc.maxPacketLifeTime) },
            { label: 'negotiated', value: String(dc.negotiated) },
            { label: 'protocol', value: dc.protocol || '(空)' },
            { label: 'bufferedAmount', value: String(dc.bufferedAmount) },
            { label: 'bufferedAmountLowThreshold', value: String(dc.bufferedAmountLowThreshold) },
            { label: 'readyState', value: String(dc.readyState) },
        ];
        this.setState({ dcInfo: info });
        this._addLog('dc', `已刷新通道属性`);
    }
    // 发送二进制（Uint8Array）
    _sendBinary() {
        if (!this._dc || this._dc.readyState !== 'open') {
            this._addLog('err', '发送失败：数据通道未打开');
            return;
        }
        try {
            // "Hello!" 的 ASCII 字节
            const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x21]);
            this._dc.send(bytes);
            this._addLog('dc', `pc1 已发送二进制：${bytes.byteLength} 字节`);
            this.setState({
                messages: [...this.state.messages, { dir: 'send', text: `[binary ${bytes.byteLength} 字节]`, time: formatTime() }].slice(-30),
            });
        }
        catch (err) {
            this._addLog('err', `二进制发送失败：${errInfo(err).message}`);
        }
    }
    // 设置背压阈值并注册 onbufferedamountlow 回调
    _setupBackpressure() {
        const dc = this._dc;
        if (!dc || dc.readyState !== 'open') {
            this._addLog('err', '设置失败：数据通道未打开');
            return;
        }
        try {
            dc.bufferedAmountLowThreshold = 64;
            dc.onbufferedamountlow = () => {
                this._addLog('dc', `onbufferedamountlow 触发（bufferedAmount=${dc.bufferedAmount}）`);
            };
            this._addLog('dc', `已设置 bufferedAmountLowThreshold=${dc.bufferedAmountLowThreshold}，背压回调就绪`);
        }
        catch (err) {
            this._addLog('err', `背压设置失败：${errInfo(err).message}`);
        }
    }
    // 调用 pc1.getStats() 并过滤 inbound-rtp / outbound-rtp / data-channel 条目
    async _refreshStats() {
        const pc = this._pc1;
        if (!pc) {
            this._addLog('err', '尚无 RTCPeerConnection，无法获取统计');
            return;
        }
        try {
            this._addLog('dc', 'pc1.getStats() ...');
            const report = await pc.getStats();
            const entries = [];
            // RTCStatsReport 是 Map，可用 for...of 遍历 [id, stat]
            for (const [id, stat] of report) {
                if (stat.type === 'inbound-rtp' || stat.type === 'outbound-rtp' || stat.type === 'data-channel') {
                    entries.push({
                        type: stat.type,
                        id: String(id).slice(0, 12),
                        bytesSent: stat.bytesSent ?? '—',
                        bytesReceived: stat.bytesReceived ?? '—',
                        messagesSent: stat.messagesSent ?? '—',
                        messagesReceived: stat.messagesReceived ?? '—',
                    });
                }
            }
            this.setState({
                statsEntries: entries,
                statsInfo: `RTCStatsReport 共 ${report.size} 条，过滤出 ${entries.length} 条（inbound-rtp / outbound-rtp / data-channel）`,
            });
            this._addLog('dc', `getStats 完成：${report.size} 条 → 过滤 ${entries.length} 条`);
        }
        catch (err) {
            this._addLog('err', `getStats 失败：${errInfo(err).message}`);
        }
    }
    // —— 状态小芯片（label + value）——
    _stateChip(label, value) {
        return h('div', { class: 'flex items-center gap-xs' }, h('span', { class: 'text-tertiary' }, `${label}:`), h('span', { class: 'fw-medium' }, String(value)));
    }
    // =================== 渲染 ===================
    renderPage() {
        // —— 聊天输入框（直接写 state，避免每次按键触发重渲染）——
        const chatInput = new Input({
            value: this.state.chatInput,
            size: 'sm',
            style: { width: '260px' },
            placeholder: '输入消息并发送（pc1 → pc2 → pc1 回显）',
            onPressEnter: () => this._sendChat(),
            onChange: (v) => { this.state.chatInput = v; },
        });
        this.registerChild(chatInput);
        return [
            h('h2', { class: 'section-title' }, '实时通信 API 实验室'),
            h(Alert, {
                type: 'info',
                message: 'WebRTC · RTCDataChannel · WebTransport',
                description: '三大实时通信 API 综合演示。WebRTC 采用同页双连接本地回环（无需信令服务器）；WebTransport 侧重能力检测与优雅降级；底部为统一事件日志面板。',
            }),
            // ============ Card 1：WebRTC 数据通道本地回环 ============
            h(Card, {
                title: '1. WebRTC 数据通道 —— 本地回环演示',
                extra: h('div', { class: 'flex items-center gap-xs' }, h(Tag, { color: 'primary' }, 'RTCPeerConnection'), h(Tag, { color: 'success' }, 'RTCDataChannel')),
            }, h('div', { class: 'flex flex-col gap-sm' }, h('p', { class: 'fs-sm text-secondary' }, '同页面内创建 pc1 / pc2 两个 RTCPeerConnection，通过 onicecandidate 互投 ICE 候选，并以 createOffer / createAnswer 完成 SDP 握手。pc1 主动 createDataChannel，pc2 经 ondatachannel 接收，构成无信令服务器的本地回环。'), h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('建立连接', { type: 'primary', size: 'sm', onClick: () => this._startWebRTC() }), this._btn('断开', { danger: true, size: 'sm', onClick: () => this._disconnectRTC() })), 
            // 状态显示
            h('div', { class: 'flex flex-wrap gap-sm fs-sm' }, this._stateChip('RTC', this.state.rtcState), this._stateChip('DC', this.state.dcState), this._stateChip('ICE', this.state.iceState), this._stateChip('Signaling', this.state.signalingState), this._stateChip('Conn', this.state.connState)), 
            // 聊天区
            h('div', { class: 'flex items-center gap-sm flex-wrap' }, chatInput.render(), this._btn('发送', { type: 'primary', size: 'sm', onClick: () => this._sendChat() })), 
            // 消息记录
            this.state.messages.length === 0
                ? h('div', { class: 'fs-sm text-tertiary' }, '（暂无消息，建立连接后发送试试）')
                : h('div', { class: 'log-panel' }, ...this.state.messages.map((m) => h('div', { class: 'log-panel__line' }, h('span', { class: 'log-panel__time' }, m.time), h('span', { class: `log-panel__tag log-panel__tag--${m.dir === 'send' ? 'push' : m.dir === 'recv' ? 'pop' : 'info'}` }, m.dir === 'send' ? 'SEND' : m.dir === 'recv' ? 'RECV' : 'ECHO'), h('span', {}, m.text)))))),
            // ============ Card 2：WebTransport（HTTP/3）============
            h(Card, {
                title: '2. WebTransport（基于 HTTP/3）',
                extra: h(Tag, { color: this.state.wtSupported ? 'success' : 'warning' }, this.state.wtSupported ? '已支持' : '未支持'),
            }, h('div', { class: 'flex flex-col gap-sm' }, h('p', { class: 'fs-sm text-secondary' }, 'WebTransport 基于 HTTP/3（QUIC），提供低延迟的客户端-服务器通信，支持单向流、双向流与不可靠数据报。该 API 较新，需先做能力检测；无可靠公共测试服务器，故仅做连接尝试与优雅降级。'), !this.state.wtSupported
                ? h(Alert, {
                    type: 'warning',
                    message: '当前浏览器不支持 WebTransport',
                    description: '可使用 Chrome 97+ 等支持 HTTP/3 WebTransport 的浏览器体验完整功能。',
                })
                : null, 
            // 能力清单
            h('div', { class: 'flex flex-col gap-xs' }, ...Object.entries(this.state.wtSupportDetail).map(([name, ok]) => h('div', { class: 'flex items-center gap-sm fs-sm' }, h('span', { class: `tag ${ok ? 'tag--success' : 'tag--default'}` }, ok ? '✓' : '✕'), h('span', { class: ok ? 'fw-medium' : 'text-tertiary' }, name)))), h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行支持检测', { size: 'sm', onClick: () => this._checkWtSupport() }), this._btn('尝试连接', { type: 'primary', size: 'sm', disabled: !this.state.wtSupported, onClick: () => this._tryWtConnect() }), this._btn('演示流 API', { size: 'sm', disabled: !this.state.wtSupported, onClick: () => this._demoWtStreams() }), this._btn('关闭', { danger: true, size: 'sm', onClick: () => this._closeWt() })), h('div', { class: 'fs-sm text-secondary' }, `连接状态：${this.state.wtState}`))),
            // ============ Card 3：RTCDataChannel 深度剖析 + 统计 ============
            h(Card, {
                title: '3. RTCDataChannel 深度剖析 + 统计',
                extra: h('div', { class: 'flex items-center gap-xs' }, h(Tag, { color: 'primary' }, 'RTCDataChannel'), h(Tag, { color: 'warning' }, 'RTCStatsReport')),
            }, h('div', { class: 'flex flex-col gap-sm' }, h('p', { class: 'fs-sm text-secondary' }, '深入剖析数据通道对象属性（label/id/ordered/maxRetransmits 等）、背压处理（bufferedAmountLowThreshold + onbufferedamountlow）、文本与二进制发送，并通过 RTCPeerConnection.getStats() 获取 RTCStatsReport，过滤 inbound-rtp / outbound-rtp / data-channel 条目。'), h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('重新创建通道', { type: 'primary', size: 'sm', onClick: () => this._recreateChannel() }), this._btn('刷新通道属性', { size: 'sm', onClick: () => this._refreshDcInfo() }), this._btn('发送二进制', { size: 'sm', onClick: () => this._sendBinary() }), this._btn('设置背压阈值', { size: 'sm', onClick: () => this._setupBackpressure() }), this._btn('刷新统计', { size: 'sm', onClick: () => this._refreshStats() })), 
            // 通道属性
            h('div', { class: 'fs-sm text-secondary' }, '数据通道属性：'), this.state.dcInfo.length === 0
                ? h('div', { class: 'fs-sm text-tertiary' }, '（建立连接后点击「刷新通道属性」）')
                : h('div', { class: 'flex flex-col gap-xs' }, ...this.state.dcInfo.map((item) => h('div', { class: 'api-metric' }, h('span', { class: 'fs-sm text-secondary', style: { minWidth: '180px' } }, item.label), h('span', { class: 'fw-medium fs-sm' }, item.value)))), 
            // 统计
            h('div', { class: 'fs-sm text-secondary mt-sm' }, 'RTCStatsReport：'), h('div', { class: 'fs-sm text-tertiary' }, this.state.statsInfo || '（点击「刷新统计」获取 getStats() 结果）'), this.state.statsEntries.length === 0
                ? null
                : h('div', { class: 'flex flex-col gap-xs mt-xs' }, ...this.state.statsEntries.map((s) => h('div', { class: 'api-metric' }, h('span', { class: 'tag tag--primary', style: { minWidth: '90px' } }, s.type), h('span', { class: 'fs-sm text-tertiary', style: { minWidth: '120px' } }, s.id), h('span', { class: 'fs-sm' }, `sent=${s.bytesSent}B/${s.messagesSent}msg`), h('span', { class: 'fs-sm' }, `recv=${s.bytesReceived}B/${s.messagesReceived}msg`)))))),
            // ============ 日志面板 ============
            h(Card, {
                title: '事件日志',
                extra: h(Tag, { color: 'primary' }, `${this.state.logs.length} 条`),
            }, this.state.logs.length === 0
                ? h('div', { class: 'fs-sm text-tertiary' }, '（暂无日志）')
                : h('div', { class: 'log-panel' }, ...this.state.logs.map((log) => h('div', { class: 'log-panel__line' }, h('span', { class: 'log-panel__time' }, log.time), h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type), h('span', {}, log.content))))),
        ];
    }
}
//# sourceMappingURL=RealtimeCommsPage.js.map