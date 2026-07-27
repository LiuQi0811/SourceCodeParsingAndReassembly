// =====================================================================
// WebRTCDeepPage.js —— WebRTC 深入 实验室
// 演示 MDN：
//   1. RTCPeerConnection 配置与生命周期 —— new RTCPeerConnection(configuration)
//      iceServers / iceTransportPolicy / bundlePolicy / rtcpMuxPolicy；
//      connectionState / iceConnectionState / signalingState 生命周期
//   2. Offer/Answer 协商 —— createOffer / createAnswer /
//      setLocalDescription / setRemoteDescription 全流程 SDP 交换
//   3. ICE 候选协商 —— onicecandidate / addIceCandidate / oniceconnectionstatechange
//   4. MediaStream 媒体接入 —— getUserMedia / addTrack / removeTrack / ontrack / getSenders / getReceivers
//   5. DataChannel 数据通道 —— createDataChannel(label, options) /
//      ordered / maxRetransmits / maxPacketLifeTime / negotiated / id；
//      onopen / onmessage / onclose / onerror / binaryType / bufferedAmount / bufferedAmountLowThreshold
//   6. getStats 统计与会话管理 —— getStats() / RTCStatsReport / RTCStats 类型
//      （candidate-pair / inbound-rtp / outbound-rtp / remote-inbound-rtp /
//      remote-outbound-rtp / data-channel / transport / candidate / codec）；
//      getConfiguration / setConfiguration / restartIce / close
// 说明：WebRTC 用于浏览器间 P2P 音视频 / 数据通信。本页用同页内两个 RTCPeerConnection
//       （pc1 / pc2）模拟信令服务器完成本地回环演示。所有 API 调用前做 typeof 能力检测，
//       不可用时仅记日志（_addLog('warn', ...)），绝不抛异常。jsdom 无真实摄像头 / 麦克风，
//       getUserMedia 会失败用 try/catch 兜底；集成测试已注入 mock RTCPeerConnection
//       （createOffer / createAnswer / setLocalDescription / setRemoteDescription /
//       addIceCandidate / createDataChannel / getStats），可演示 API 表面。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class WebRTCDeepPage extends Page {
    _dc1;
    _dc2;
    _inited;
    _mediaStream;
    _pc1;
    _pc2;
    // —— 初始 state ——
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            pcLifecycle: '', // Card 1：RTCPeerConnection 配置与生命周期
            offerAnswer: '', // Card 2：Offer/Answer 协商
            iceInfo: '', // Card 3：ICE 候选协商
            mediaInfo: '', // Card 4：MediaStream 媒体接入
            dcInfo: '', // Card 5：DataChannel 数据通道
            statsInfo: '', // Card 6：getStats 统计与会话管理
        };
    }
    // —— 生命周期 ——
    componentDidMount() {
        // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
        if (this._inited)
            return;
        this._inited = true;
        // 一次性初始化各实例引用（componentWillUnmount 中释放）
        this._pc1 = null; // Card 1/2/3/5/6 pc1 引用
        this._pc2 = null; // Card 1/2/3 pc2 引用
        this._dc1 = null; // Card 5 pc1 上的数据通道
        this._dc2 = null; // Card 5 pc2 上接收到的数据通道
        this._mediaStream = null; // Card 4 getUserMedia 返回的流
        // 一次性能力检测：WebRTC 全家桶
        const hasRTCPC = typeof RTCPeerConnection !== 'undefined';
        const hasRTCDC = typeof RTCDataChannel !== 'undefined';
        const hasMediaDevices = typeof navigator !== 'undefined' && typeof navigator.mediaDevices !== 'undefined';
        const hasGetUserMedia = hasMediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';
        const hasRTCStatsReport = typeof RTCStatsReport !== 'undefined';
        const hasMediaStream = typeof MediaStream !== 'undefined';
        const hasRTCRtpSender = typeof RTCRtpSender !== 'undefined';
        const hasRTCRtpReceiver = typeof RTCRtpReceiver !== 'undefined';
        const parts = [
            `RTCPeerConnection ${hasRTCPC ? '✓' : '✗'}`, `RTCDataChannel ${hasRTCDC ? '✓' : '✗'}`,
            `mediaDevices ${hasMediaDevices ? '✓' : '✗'}`, `getUserMedia ${hasGetUserMedia ? '✓' : '✗'}`,
            `RTCStatsReport ${hasRTCStatsReport ? '✓' : '✗'}`, `MediaStream ${hasMediaStream ? '✓' : '✗'}`,
            `RTCRtpSender ${hasRTCRtpSender ? '✓' : '✗'}`, `RTCRtpReceiver ${hasRTCRtpReceiver ? '✓' : '✗'}`,
        ];
        const anyAvailable = hasRTCPC;
        const summary = anyAvailable
            ? `WebRTC 能力检测：${parts.join(' · ')}。jsdom 中集成测试已注入 mock RTCPeerConnection（createOffer/createAnswer/setLocalDescription/setRemoteDescription/addIceCandidate/createDataChannel/getStats），可执行 API 表面演示；但无真实 ICE / 摄像头 / 麦克风，getUserMedia 会失败，用 try/catch 兜底。真实浏览器中可完整演示 P2P 音视频与数据通信。`
            : '当前环境不支持 RTCPeerConnection（typeof 为 "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器中打开可完整演示。';
        this.setState({ capsSummary: summary });
        this._addLog(anyAvailable ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!hasGetUserMedia)
            this._addLog('warn', 'navigator.mediaDevices.getUserMedia 不可用（jsdom 无摄像头 / 麦克风），Card 4 将以 mock 演示');
        if (!hasRTCStatsReport)
            this._addLog('warn', 'RTCStatsReport 构造器不可用（getStats 返回的 Map 仍可遍历）');
    }
    componentWillUnmount() {
        // 释放数据通道
        if (this._dc1) {
            try {
                this._dc1.close();
            }
            catch { /* noop */ }
            this._dc1 = null;
        }
        if (this._dc2) {
            try {
                this._dc2.close();
            }
            catch { /* noop */ }
            this._dc2 = null;
        }
        // 关闭两条 RTCPeerConnection
        if (this._pc1) {
            try {
                this._pc1.close();
            }
            catch { /* noop */ }
            this._pc1 = null;
        }
        if (this._pc2) {
            try {
                this._pc2.close();
            }
            catch { /* noop */ }
            this._pc2 = null;
        }
        // 停止 MediaStream 所有 track
        if (this._mediaStream) {
            try {
                const tracks = typeof this._mediaStream.getTracks === 'function' ? this._mediaStream.getTracks() : [];
                for (const t of tracks) {
                    try {
                        t.stop();
                    }
                    catch { /* noop */ }
                }
            }
            catch { /* noop */ }
            this._mediaStream = null;
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
    // —— 能力检测 Tag 组件（items: [{ key, ok }]，返回 Tag 元素数组）——
    _caps(items) {
        return items.map((it) => h(Tag, { color: it.ok ? 'success' : 'error' }, `${it.key} ${it.ok ? '✓' : '✗'}`));
    }
    // —— 同步能力检测（render 时调用，开销可忽略）——
    _capFlags() {
        const hasMD = typeof navigator !== 'undefined' && typeof navigator.mediaDevices !== 'undefined';
        return {
            rtcpc: typeof RTCPeerConnection !== 'undefined',
            rtcdc: typeof RTCDataChannel !== 'undefined',
            mediaDevices: hasMD,
            getUserMedia: hasMD && typeof navigator.mediaDevices.getUserMedia === 'function',
            rtcStatsReport: typeof RTCStatsReport !== 'undefined',
            mediaStream: typeof MediaStream !== 'undefined',
            rtpSender: typeof RTCRtpSender !== 'undefined',
            rtpReceiver: typeof RTCRtpReceiver !== 'undefined',
        };
    }
    // 安全读取对象属性（防御性）
    _safeGet(obj, key) { try {
        return obj[key];
    }
    catch {
        return undefined;
    } }
    // =================== Card 1：RTCPeerConnection 配置与生命周期 ===================
    _createPeerConnections() {
        const caps = this._capFlags();
        if (!caps.rtcpc) {
            this._addLog('warn', 'RTCPeerConnection 不可用（typeof undefined）');
            this.setState({ pcLifecycle: 'RTCPeerConnection 用法（测试环境不可用，仅说明）：\n\n' +
                    "const pc = new RTCPeerConnection({\n" +
                    "  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],\n" +
                    "  iceTransportPolicy: 'all' | 'relay',\n" +
                    "  bundlePolicy: 'balanced' | 'max-compat' | 'max-bundle',\n" +
                    "  rtcpMuxPolicy: 'require' | 'negotiate',\n" +
                    '});\n\n' +
                    'pc.connectionState      // new | connecting | connected | disconnected | failed | closed\n' +
                    'pc.iceConnectionState   // new | checking | connected | completed | disconnected | failed | closed\n' +
                    'pc.signalingState       // stable | have-local-offer | have-remote-offer | have-local-pranswer | have-remote-pranswer | closed\n' +
                    'pc.onconnectionstatechange / pc.oniceconnectionstatechange / pc.onsignalingstatechange' });
            return;
        }
        try {
            if (this._pc1) {
                try {
                    this._pc1.close();
                }
                catch { /* noop */ }
            }
            if (this._pc2) {
                try {
                    this._pc2.close();
                }
                catch { /* noop */ }
            }
            const config = {
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
                iceTransportPolicy: 'all',
                bundlePolicy: 'balanced',
                rtcpMuxPolicy: 'require',
            };
            const pc1 = new RTCPeerConnection(config);
            const pc2 = new RTCPeerConnection(config);
            this._pc1 = pc1;
            this._pc2 = pc2;
            // 绑定状态变化事件（mock 不会主动触发，但绑定 API 表面）
            const logState = (who, pc) => this._addLog('rtc', `${who}.connectionState=${pc.connectionState}, iceConnectionState=${pc.iceConnectionState}, signalingState=${pc.signalingState}`);
            const bindState = (pc, who) => {
                try {
                    pc.onconnectionstatechange = () => logState(who, pc);
                }
                catch { /* noop */ }
                try {
                    pc.oniceconnectionstatechange = () => logState(who, pc);
                }
                catch { /* noop */ }
                try {
                    pc.onsignalingstatechange = () => logState(who, pc);
                }
                catch { /* noop */ }
            };
            bindState(pc1, 'pc1');
            bindState(pc2, 'pc2');
            // 读取 getConfiguration（mock 可能未实现，兜底用传入 config）
            let cfgText = '（getConfiguration 不可用，仅显示传入配置）';
            if (typeof pc1.getConfiguration === 'function') {
                try {
                    const cfg = pc1.getConfiguration();
                    cfgText = `iceServers: ${JSON.stringify(cfg.iceServers || config.iceServers)}\n` +
                        `  iceTransportPolicy: ${cfg.iceTransportPolicy || config.iceTransportPolicy}\n` +
                        `  bundlePolicy: ${cfg.bundlePolicy || config.bundlePolicy}\n` +
                        `  rtcpMuxPolicy: ${cfg.rtcpMuxPolicy || config.rtcpMuxPolicy}`;
                }
                catch { /* 用默认 cfgText */ }
            }
            this.setState({ pcLifecycle: '已创建 pc1 / pc2（configuration 配置）：\n' +
                    '  new RTCPeerConnection({ iceServers, iceTransportPolicy, bundlePolicy, rtcpMuxPolicy } as any)\n' +
                    `  pc1.connectionState = ${pc1.connectionState}\n` +
                    `  pc1.iceConnectionState = ${pc1.iceConnectionState}\n` +
                    `  pc1.signalingState = ${pc1.signalingState}\n` +
                    `  pc2.connectionState = ${pc2.connectionState}\n` +
                    `  pc2.iceConnectionState = ${pc2.iceConnectionState}\n` +
                    `  pc2.signalingState = ${pc2.signalingState}\n\n` +
                    `getConfiguration() 返回：\n  ${cfgText}\n\n` +
                    '生命周期状态机：\n  connectionState:    new → connecting → connected → disconnected → failed → closed\n' +
                    '  iceConnectionState: new → checking → connected → completed → disconnected → failed → closed\n' +
                    '  signalingState:     stable → have-local-offer / have-remote-offer → stable\n\n' +
                    '状态变化事件已绑定（on*statechange），后续 Offer/Answer 与 ICE 协商将触发状态迁移。' });
            this._addLog('rtc', `已创建 pc1 / pc2，pc1.signalingState=${pc1.signalingState}, iceConnectionState=${pc1.iceConnectionState}`);
        }
        catch (err) {
            this._addLog('warn', `创建 RTCPeerConnection 失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard1() {
        const s = this.state;
        const caps = this._capFlags();
        const card = new Card({
            title: '1. RTCPeerConnection 配置与生命周期',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([{ key: 'RTCPeerConnection', ok: caps.rtcpc }]), h(Tag, { color: 'primary' }, 'configuration / states')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'new RTCPeerConnection(configuration) 接受 iceServers（STUN/TURN 服务器列表）、iceTransportPolicy（all/relay）、bundlePolicy（balanced/max-compat/max-bundle）、rtcpMuxPolicy（require/negotiate）。每个连接维护三套状态：connectionState（整体）、iceConnectionState（ICE 层）、signalingState（信令层）。本卡片创建 pc1 / pc2 并绑定状态变化事件，后续卡片在此基础上完成协商。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('创建 pc1/pc2', { type: 'primary', size: 'sm', disabled: !caps.rtcpc, onClick: () => this._createPeerConnections() })),
                h('div', { class: 'fs-sm text-secondary' }, 'RTCPeerConnection 配置与状态：'),
                h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.pcLifecycle || '（点击「创建 pc1/pc2」开始演示）')),
                h(Alert, {
                    type: 'info',
                    message: '三套状态机对应不同抽象层',
                    description: 'connectionState 是整体连接状态；iceConnectionState 是 ICE 候选交换层的连接状态；signalingState 是 SDP 协商状态。三者独立迁移，需分别监听对应 on*statechange 事件。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 2：Offer/Answer 协商 ===================
    async _performOfferAnswer() {
        const caps = this._capFlags();
        if (!caps.rtcpc) {
            this._addLog('warn', 'RTCPeerConnection 不可用');
            return;
        }
        if (!this._pc1 || !this._pc2) {
            this._addLog('warn', '请先点击 Card 1 的「创建 pc1/pc2」');
            return;
        }
        try {
            const pc1 = this._pc1;
            const pc2 = this._pc2;
            const steps = ['开始 Offer/Answer 协商流程：\n'];
            steps.push('1) pc1.createOffer() ...');
            this._addLog('offer', 'pc1.createOffer() ...');
            const offer = await pc1.createOffer();
            steps.push(`   offer.type = ${offer.type}, offer.sdp = ${JSON.stringify(offer.sdp).slice(0, 60)}`);
            steps.push('2) pc1.setLocalDescription(offer) ...');
            this._addLog('offer', `pc1.setLocalDescription(type=${offer.type})`);
            await pc1.setLocalDescription(offer);
            steps.push(`   pc1.signalingState = ${pc1.signalingState}（应为 have-local-offer）`);
            steps.push('3) pc2.setRemoteDescription(offer) ...');
            this._addLog('offer', 'pc2.setRemoteDescription(offer)');
            await pc2.setRemoteDescription(offer);
            steps.push(`   pc2.signalingState = ${pc2.signalingState}（应为 have-remote-offer）`);
            steps.push('4) pc2.createAnswer() ...');
            this._addLog('answer', 'pc2.createAnswer() ...');
            const answer = await pc2.createAnswer();
            steps.push(`   answer.type = ${answer.type}, answer.sdp = ${JSON.stringify(answer.sdp).slice(0, 60)}`);
            steps.push('5) pc2.setLocalDescription(answer) ...');
            this._addLog('answer', `pc2.setLocalDescription(type=${answer.type})`);
            await pc2.setLocalDescription(answer);
            steps.push(`   pc2.signalingState = ${pc2.signalingState}（应回到 stable）`);
            steps.push('6) pc1.setRemoteDescription(answer) ...');
            this._addLog('answer', 'pc1.setRemoteDescription(answer) —— 握手完成');
            await pc1.setRemoteDescription(answer);
            steps.push(`   pc1.signalingState = ${pc1.signalingState}（应回到 stable）`);
            steps.push('\n完整 SDP 交换六步完成。pc1 与 pc2 的 signalingState 均回到 stable。');
            this.setState({ offerAnswer: steps.join('\n') });
            this._addLog('answer', `Offer/Answer 协商完成，pc1.signalingState=${pc1.signalingState}, pc2.signalingState=${pc2.signalingState}`);
        }
        catch (err) {
            this._addLog('warn', `Offer/Answer 协商失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard2() {
        const s = this.state;
        const caps = this._capFlags();
        const card = new Card({
            title: '2. Offer/Answer 协商',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([{ key: 'createOffer', ok: caps.rtcpc }, { key: 'createAnswer', ok: caps.rtcpc }]), h(Tag, { color: 'primary' }, 'SDP 交换')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'SDP（Session Description Protocol）协商是 WebRTC 握手核心：呼叫方 createOffer() 生成 Offer SDP，setLocalDescription() 设为本地描述后经信令通道发给被叫；被叫 setRemoteDescription() 设为远端描述，createAnswer() 生成 Answer SDP，setLocalDescription() 后回传；呼叫方 setRemoteDescription() 完成握手。本页用同页 pc1 / pc2 模拟信令转发，演示完整六步流程。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('执行 Offer/Answer', { type: 'primary', size: 'sm', disabled: !caps.rtcpc, onClick: () => this._performOfferAnswer() })),
                h('div', { class: 'fs-sm text-secondary' }, 'Offer/Answer 协商步骤与状态：'),
                h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.offerAnswer || '（请先在 Card 1 创建 pc1/pc2，再点击「执行 Offer/Answer」）')),
                h(Alert, {
                    type: 'warning',
                    message: 'SDP 协商是完美回环（perfect negotiation）的基础',
                    description: 'offer / answer 必须成对，setLocalDescription 与 setRemoteDescription 顺序不能颠倒。glare（双方同时发起 offer）时需用 rollback 退回 stable 后重试。SDP 中包含编解码器、ICE 候选、媒体方向等关键信息。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 3：ICE 候选协商 ===================
    async _wireIceCandidates() {
        const caps = this._capFlags();
        if (!caps.rtcpc) {
            this._addLog('warn', 'RTCPeerConnection 不可用');
            return;
        }
        if (!this._pc1 || !this._pc2) {
            this._addLog('warn', '请先点击 Card 1 的「创建 pc1/pc2」');
            return;
        }
        try {
            const pc1 = this._pc1;
            const pc2 = this._pc2;
            // 通用 ICE 候选交换处理（pcFrom.onicecandidate → pcTo.addIceCandidate）
            const bindIce = (pcFrom, pcTo, fromName, toName, counter) => {
                try {
                    pcFrom.onicecandidate = (e) => {
                        if (e.candidate) {
                            counter.n += 1;
                            const candTxt = typeof e.candidate.candidate === 'string' ? e.candidate.candidate.slice(0, 50) : '(无 candidate 字符串)';
                            this._addLog('ice', `${fromName} onicecandidate #${counter.n}：${candTxt}`);
                            pcTo.addIceCandidate(e.candidate).catch((err) => this._addLog('warn', `${toName}.addIceCandidate 失败：${err.message}`));
                        }
                        else {
                            this._addLog('ice', `${fromName} onicecandidate：candidate=null（ICE 收集完成）`);
                        }
                    };
                }
                catch { /* noop */ }
            };
            bindIce(pc1, pc2, 'pc1', 'pc2', { n: 0 });
            bindIce(pc2, pc1, 'pc2', 'pc1', { n: 0 });
            // 手动注入 mock candidate 演示 addIceCandidate API 表面（mock 不会主动触发 onicecandidate）
            const mockCandidate = {
                candidate: 'candidate:842163049 1 udp 1677729535 192.0.2.3 9 typ srflx', sdpMid: '0', sdpMLineIndex: 0,
            };
            const tryAdd = async (pc, who) => {
                try {
                    await pc.addIceCandidate(mockCandidate);
                    this._addLog('ice', `${who}.addIceCandidate(mockCandidate) 成功（演示 API 表面）`);
                    return true;
                }
                catch (err) {
                    this._addLog('warn', `${who}.addIceCandidate(mockCandidate) 失败：${err.message}`);
                    return false;
                }
            };
            const added2 = await tryAdd(pc2, 'pc2');
            const added1 = await tryAdd(pc1, 'pc1');
            this.setState({ iceInfo: '已绑定 ICE 候选交换回调（同页内直接互投，模拟信令服务器转发）：\n' +
                    '  pc1.onicecandidate = (e: any) => pc2.addIceCandidate(e.candidate)\n' +
                    '  pc2.onicecandidate = (e: any) => pc1.addIceCandidate(e.candidate)\n\n' +
                    'ICE 候选对象结构（RTCIceCandidateInit）：\n' +
                    '  { candidate: "candidate:...typ srflx", sdpMid: "0", sdpMLineIndex: 0 }\n' +
                    '  candidate 字符串：candidate:<id> <component> <proto> <priority> <addr> <port> typ <type>\n' +
                    '  typ 类型：host（主机）/ srflx（服务器反射）/ prflx（对等反射）/ relay（中继）\n\n' +
                    `手动注入 mock candidate 演示 addIceCandidate：\n` +
                    `  pc2.addIceCandidate(mockCandidate) → ${added2 ? '成功' : '失败'}\n` +
                    `  pc1.addIceCandidate(mockCandidate) → ${added1 ? '成功' : '失败'}\n\n` +
                    'ICE 收集流程（真实浏览器）：\n  1) setLocalDescription 后浏览器异步收集 ICE 候选\n' +
                    '  2) 每收集到一个触发 onicecandidate（e.candidate 非空）\n' +
                    '  3) 收集完成触发 onicecandidate（e.candidate === null，end-of-candidates）\n' +
                    '  4) 对端通过 addIceCandidate(candidate) 添加候选\n' +
                    '  5) 候选连通后 oniceconnectionstatechange 迁移到 connected\n\n' +
                    '说明：mock 环境不会主动触发 onicecandidate，故手动注入候选演示 API 表面。' });
            this._addLog('ice', `已绑定 onicecandidate 互投 + 注入 mock candidate（pc1=${added1}, pc2=${added2}）`);
        }
        catch (err) {
            this._addLog('warn', `ICE 候选绑定失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard3() {
        const s = this.state;
        const caps = this._capFlags();
        const card = new Card({
            title: '3. ICE 候选协商',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([{ key: 'onicecandidate', ok: caps.rtcpc }, { key: 'addIceCandidate', ok: caps.rtcpc }]), h(Tag, { color: 'primary' }, 'trickle ICE')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'ICE（Interactive Connectivity Establishment）协商负责在 NAT / 防火墙后建立 P2P 连接。浏览器通过 STUN/TURN 服务器收集候选（host / srflx / prflx / relay），每收集到一个触发 onicecandidate 事件，e.candidate 经信令通道发给对端，对端调用 addIceCandidate(candidate) 添加。Trickle ICE 允许边收集边交换，无需等全部完成。oniceconnectionstatechange 反映 ICE 层连接状态迁移。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('绑定 ICE 互投 + 注入候选', { type: 'primary', size: 'sm', disabled: !caps.rtcpc, onClick: () => this._wireIceCandidates() })),
                h('div', { class: 'fs-sm text-secondary' }, 'ICE 候选协商状态：'),
                h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.iceInfo || '（请先在 Card 1 创建 pc1/pc2，再点击「绑定 ICE 互投」）')),
                h(Alert, {
                    type: 'info',
                    message: 'ICE 候选类型决定连接质量',
                    description: 'host 直连最快但 NAT 后不可达；srflx 经 STUN 反射，多数场景可用；relay 经 TURN 中继最可靠但耗带宽。iceTransportPolicy:"relay" 强制仅用中继候选（隐私 / 严格 NAT 场景）。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 4：MediaStream 媒体接入 ===================
    async _demoMediaStream() {
        const caps = this._capFlags();
        if (!caps.rtcpc) {
            this._addLog('warn', 'RTCPeerConnection 不可用');
            this.setState({ mediaInfo: 'RTCPeerConnection 不可用，无法演示 MediaStream 接入。' });
            return;
        }
        if (!this._pc1) {
            this._addLog('warn', '请先点击 Card 1 的「创建 pc1/pc2」');
            return;
        }
        const pc1 = this._pc1;
        const lines = ['MediaStream 媒体接入演示：\n'];
        // 1) 尝试 getUserMedia（jsdom 无摄像头，会失败）
        if (!caps.getUserMedia) {
            lines.push('1) navigator.mediaDevices.getUserMedia 不可用（typeof undefined）');
            lines.push('   jsdom 无摄像头 / 麦克风，跳过真实采集，用 mock MediaStream 演示 addTrack API 表面\n');
            this._addLog('warn', 'getUserMedia 不可用（jsdom 无摄像头 / 麦克风）');
        }
        else {
            lines.push('1) navigator.mediaDevices.getUserMedia({ video: true, audio: true }) ...');
            this._addLog('media', 'getUserMedia({ video, audio }) ...');
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                this._mediaStream = stream;
                const vTracks = typeof stream.getVideoTracks === 'function' ? stream.getVideoTracks() : [];
                const aTracks = typeof stream.getAudioTracks === 'function' ? stream.getAudioTracks() : [];
                lines.push(`   成功：video tracks = ${vTracks.length}, audio tracks = ${aTracks.length}`);
                this._addLog('media', `getUserMedia 成功：video=${vTracks.length}, audio=${aTracks.length}`);
            }
            catch (err) {
                lines.push(`   失败：${err.name} - ${err.message}`);
                this._addLog('warn', `getUserMedia 失败：${err.name} - ${err.message}（jsdom 无真实设备，已兜底）`);
            }
            lines.push('');
        }
        // 2) ontrack 事件绑定（pc1 监听对端 track 到达）
        try {
            pc1.ontrack = (e) => {
                this._addLog('media', `pc1.ontrack：track=${e.track?.kind || '?'}, streams=${e.streams?.length || 0}`);
            };
            lines.push('2) pc1.ontrack 已绑定（接收对端 track 到达事件）');
        }
        catch (err) {
            lines.push(`2) 绑定 pc1.ontrack 失败：${err.message}`);
        }
        // 3) 构造 mock MediaStreamTrack，演示 addTrack / removeTrack API 表面
        const mockTrack = {
            kind: 'video', id: 'mock-track-001', label: 'mock-camera', enabled: true, muted: false, readyState: 'live',
            stop() { this.readyState = 'ended'; }, addEventListener() { }, removeEventListener() { }, onmute: null, onunmute: null, onended: null,
        };
        const mockStream = caps.mediaStream && typeof MediaStream === 'function'
            ? (() => { try {
                return new MediaStream();
            }
            catch {
                return { addTrack() { }, removeTrack() { }, getTracks() { return []; } };
            } })()
            : { addTrack() { }, removeTrack() { }, getTracks() { return []; } };
        let addTrackOk = false, removeTrackOk = false, sendersCount = '—', receiversCount = '—';
        if (typeof pc1.addTrack === 'function') {
            try {
                const sender = pc1.addTrack(mockTrack, mockStream);
                addTrackOk = true;
                this._addLog('media', `pc1.addTrack(mockTrack, mockStream) 成功，返回 sender=${sender ? typeof sender : 'null'}`);
                lines.push('3) pc1.addTrack(mockTrack, mockStream) 成功（mock track，演示 API 表面）');
            }
            catch (err) {
                lines.push(`3) pc1.addTrack 失败：${err.message}`);
                this._addLog('warn', `addTrack 失败：${err.message}`);
            }
        }
        else {
            lines.push('3) pc1.addTrack 不可用（typeof undefined，mock 未实现）');
            this._addLog('warn', 'pc1.addTrack 不可用（mock 未实现 addTrack）');
        }
        if (typeof pc1.getSenders === 'function') {
            try {
                const s = pc1.getSenders();
                sendersCount = Array.isArray(s) ? String(s.length) : '?';
                lines.push(`   pc1.getSenders() → ${sendersCount} 个 RTCRtpSender`);
            }
            catch (err) {
                lines.push(`   pc1.getSenders() 失败：${err.message}`);
            }
        }
        else {
            lines.push('   pc1.getSenders 不可用（typeof undefined）');
        }
        if (typeof pc1.getReceivers === 'function') {
            try {
                const r = pc1.getReceivers();
                receiversCount = Array.isArray(r) ? String(r.length) : '?';
                lines.push(`   pc1.getReceivers() → ${receiversCount} 个 RTCRtpReceiver`);
            }
            catch (err) {
                lines.push(`   pc1.getReceivers() 失败：${err.message}`);
            }
        }
        else {
            lines.push('   pc1.getReceivers 不可用（typeof undefined）');
        }
        if (addTrackOk && typeof pc1.removeTrack === 'function') {
            try {
                pc1.removeTrack(null);
                removeTrackOk = true;
                lines.push('4) pc1.removeTrack(sender) 已调用（演示 API 表面）');
            }
            catch (err) {
                lines.push(`4) pc1.removeTrack 失败：${err.message}`);
            }
        }
        else {
            lines.push('4) pc1.removeTrack 不可用或 addTrack 未成功');
        }
        lines.push('\nAPI 概览：\n  navigator.mediaDevices.getUserMedia({ video, audio }) → Promise<MediaStream>\n' +
            '  pc.addTrack(track, stream) → RTCRtpSender（加入本地媒体）\n' +
            '  pc.removeTrack(sender) → 移除已添加的 sender\n' +
            '  pc.ontrack = (e: any) => { e.track, e.streams, e.receiver, e.transceiver }\n' +
            '  pc.getSenders() → RTCRtpSender[]（本地发送的 track）\n' +
            '  pc.getReceivers() → RTCRtpReceiver[]（远端接收的 track）\n' +
            '  MediaStream.getTracks() / getVideoTracks() / getAudioTracks() / track.stop()');
        this.setState({ mediaInfo: lines.join('\n') });
        this._addLog('media', `媒体接入演示完成：addTrack=${addTrackOk}, removeTrack=${removeTrackOk}, senders=${sendersCount}, receivers=${receiversCount}`);
    }
    _renderCard4() {
        const s = this.state;
        const caps = this._capFlags();
        const card = new Card({
            title: '4. MediaStream 媒体接入',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([{ key: 'getUserMedia', ok: caps.getUserMedia }, { key: 'addTrack', ok: caps.rtcpc }]), h(Tag, { color: 'primary' }, 'video / audio')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'navigator.mediaDevices.getUserMedia({ video, audio }) 请求摄像头 / 麦克风权限并返回 MediaStream；pc.addTrack(track, stream) 把媒体加入连接（返回 RTCRtpSender），pc.removeTrack(sender) 移除；pc.ontrack 接收对端 track 到达事件；pc.getSenders() / getReceivers() 列出本地发送与远端接收的 track。jsdom 无真实设备，getUserMedia 会失败，用 try/catch 兜底并以 mock track 演示 addTrack API 表面。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('演示媒体接入', { type: 'primary', size: 'sm', disabled: !caps.rtcpc, onClick: () => this._demoMediaStream() })),
                h('div', { class: 'fs-sm text-secondary' }, 'MediaStream 接入状态：'),
                h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.mediaInfo || '（请先在 Card 1 创建 pc1/pc2，再点击「演示媒体接入」）')),
                h(Alert, {
                    type: 'warning',
                    message: 'getUserMedia 需要 HTTPS 或 localhost 与用户授权',
                    description: '非安全上下文（HTTP 非 localhost）中 navigator.mediaDevices 为 undefined；用户拒绝授权或无设备会抛 NotReadableError / NotFoundError。MediaStreamTrack.stop() 释放设备；track.enabled = false 静音但不停采集。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 5：DataChannel 数据通道 ===================
    _demoDataChannel() {
        const caps = this._capFlags();
        if (!caps.rtcpc) {
            this._addLog('warn', 'RTCPeerConnection 不可用');
            this.setState({ dcInfo: 'RTCPeerConnection 不可用，无法演示 DataChannel。' });
            return;
        }
        if (!this._pc1) {
            this._addLog('warn', '请先点击 Card 1 的「创建 pc1/pc2」');
            return;
        }
        const pc1 = this._pc1;
        const pc2 = this._pc2;
        try {
            if (this._dc1) {
                try {
                    this._dc1.close();
                }
                catch { /* noop */ }
            }
            if (this._dc2) {
                try {
                    this._dc2.close();
                }
                catch { /* noop */ }
            }
            this._dc1 = null;
            this._dc2 = null;
            // createDataChannel(label, options)
            const dcOptions = {
                ordered: true, maxRetransmits: 3, negotiated: false, protocol: 'json',
                // ordered:false=UDP 乱序; maxRetransmits 与 maxPacketLifeTime 互斥; negotiated:true 需带 id
            };
            const dc = typeof pc1.createDataChannel === 'function' ? pc1.createDataChannel('chat', dcOptions) : null;
            if (!dc) {
                this._addLog('warn', 'pc1.createDataChannel 不可用（typeof undefined）');
                this.setState({ dcInfo: 'pc1.createDataChannel 不可用（typeof undefined），无法演示数据通道。' });
                return;
            }
            this._dc1 = dc;
            // 绑定事件（mock 不会主动触发，但绑定 API 表面）
            try {
                dc.binaryType = 'arraybuffer';
            }
            catch { /* noop */ }
            try {
                dc.onopen = () => this._addLog('dc', `dc.onopen：通道「${dc.label}」已打开 (readyState=${dc.readyState})`);
            }
            catch { /* noop */ }
            try {
                dc.onmessage = (e) => { const text = typeof e.data !== 'string' ? `[binary ${(e.data?.byteLength ?? 0)} 字节]` : e.data; this._addLog('dc', `dc.onmessage 收到：${text}`); };
            }
            catch { /* noop */ }
            try {
                dc.onclose = () => this._addLog('dc', `dc.onclose：通道「${dc.label}」已关闭 (readyState=${dc.readyState})`);
            }
            catch { /* noop */ }
            try {
                dc.onerror = (e) => this._addLog('warn', `dc.onerror：${e?.error?.message || 'unknown'}`);
            }
            catch { /* noop */ }
            try {
                dc.onbufferedamountlow = () => this._addLog('dc', `dc.onbufferedamountlow 触发（bufferedAmount=${dc.bufferedAmount}）`);
            }
            catch { /* noop */ }
            // pc2 监听 ondatachannel
            if (pc2) {
                try {
                    pc2.ondatachannel = (e) => { this._addLog('dc', `pc2.ondatachannel：收到通道「${e.channel?.label || '?'}」`); this._dc2 = e.channel; };
                }
                catch { /* noop */ }
            }
            // 尝试发送测试消息（mock 状态可能未 open，用 try/catch 兜底）
            let sentOk = false;
            try {
                if (typeof dc.send === 'function' && dc.readyState === 'open') {
                    dc.send('hello from pc1');
                    sentOk = true;
                    this._addLog('dc', `dc.send('hello from pc1') 成功`);
                }
                else {
                    this._addLog('dc', `dc.readyState=${dc.readyState}，未发送（需 open 才能发送）`);
                }
            }
            catch (err) {
                this._addLog('warn', `dc.send 失败：${err.message}（mock 通道未完全建立）`);
            }
            // 收集通道属性快照
            const get = (k) => this._safeGet(dc, k);
            const nullable = (k) => get(k) == null ? 'null' : get(k);
            const props = [
                `label = ${get('label')}`, `id = ${nullable('id')}`, `ordered = ${get('ordered')}`,
                `maxRetransmits = ${nullable('maxRetransmits')}`, `maxPacketLifeTime = ${nullable('maxPacketLifeTime')}`,
                `negotiated = ${get('negotiated')}`, `protocol = ${get('protocol') || '(空)'}`,
                `binaryType = ${get('binaryType')}`, `bufferedAmount = ${get('bufferedAmount')}`,
                `bufferedAmountLowThreshold = ${get('bufferedAmountLowThreshold')}`, `readyState = ${get('readyState')}`,
            ];
            this.setState({ dcInfo: '已创建数据通道：\n' +
                    `  pc1.createDataChannel('chat', { ordered, maxRetransmits, negotiated, protocol })\n` +
                    `  dc.label = ${get('label')}\n` +
                    `  dc.readyState = ${get('readyState')}\n` +
                    `  dc.binaryType = ${get('binaryType')}（设为 arraybuffer 以接收二进制）\n\n` +
                    `事件绑定：dc.onopen / dc.onmessage / dc.onclose / dc.onerror / dc.onbufferedamountlow\n` +
                    (pc2 ? `  pc2.ondatachannel（接收对端创建的通道）\n` : '') +
                    '\n' +
                    `测试发送：${sentOk ? '成功（dc.send("hello from pc1")）' : '未发送（readyState 非 open）'}\n\n` +
                    `通道属性快照：\n  ${props.join('\n  ')}\n\n` +
                    'DataChannel options 说明：\n  ordered: true 保证顺序（false=UDP 风格乱序）\n' +
                    '  maxRetransmits: N 最多重传 N 次（与 maxPacketLifeTime 互斥）\n' +
                    '  maxPacketLifeTime: ms 消息最大生存时间（与 maxRetransmits 互斥）\n' +
                    '  negotiated: true 时带外协商，需双方指定相同 id\n  id: 通道标识（negotiated:true 时必填）\n\n' +
                    '背压处理：\n  dc.bufferedAmount：已缓冲未发送的字节数\n' +
                    '  dc.bufferedAmountLowThreshold：阈值，低于时触发 onbufferedamountlow\n' +
                    '  应用：发送大文件时检查 bufferedAmount，超阈值则暂停发送' });
            this._addLog('dc', `数据通道「${get('label')}」已创建，readyState=${get('readyState')}，事件已绑定`);
        }
        catch (err) {
            this._addLog('warn', `数据通道演示失败：${err.name} - ${err.message}`);
        }
    }
    _renderCard5() {
        const s = this.state;
        const caps = this._capFlags();
        const card = new Card({
            title: '5. DataChannel 数据通道',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([{ key: 'createDataChannel', ok: caps.rtcpc }, { key: 'RTCDataChannel', ok: caps.rtcdc }]), h(Tag, { color: 'primary' }, 'P2P 数据')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'pc.createDataChannel(label, options) 创建 P2P 数据通道：options 接受 ordered（顺序保证）、maxRetransmits（最大重传次数，与 maxPacketLifeTime 互斥）、negotiated（带外协商，需指定 id）、protocol。事件 onopen / onmessage / onclose / onerror；binaryType（blob|arraybuffer）控制二进制接收格式；bufferedAmount / bufferedAmountLowThreshold + onbufferedamountlow 处理背压。通道基于 SCTP over DTLS，提供可靠 / 不可选两种传输模式。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('创建数据通道', { type: 'primary', size: 'sm', disabled: !caps.rtcpc, onClick: () => this._demoDataChannel() })),
                h('div', { class: 'fs-sm text-secondary' }, '数据通道状态与属性：'),
                h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.dcInfo || '（请先在 Card 1 创建 pc1/pc2，再点击「创建数据通道」）')),
                h(Alert, {
                    type: 'info',
                    message: 'DataChannel 是 WebRTC 的可靠 P2P 数据传输',
                    description: '相比 WebSocket（经服务器中转），DataChannel 直连两端延迟更低。ordered:true + maxRetransmits 提供 TCP 风格可靠有序；ordered:false + 无重传提供 UDP 风格低延迟。背压通过 bufferedAmount 监控，避免发送过快导致内存膨胀。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== Card 6：getStats 统计与会话管理 ===================
    async _demoStatsAndSession() {
        const caps = this._capFlags();
        if (!caps.rtcpc) {
            this._addLog('warn', 'RTCPeerConnection 不可用');
            this.setState({ statsInfo: 'RTCPeerConnection 不可用，无法演示 getStats。' });
            return;
        }
        if (!this._pc1) {
            this._addLog('warn', '请先点击 Card 1 的「创建 pc1/pc2」');
            return;
        }
        const pc1 = this._pc1;
        const lines = ['getStats 统计与会话管理演示：\n'];
        // 1) getStats() → Promise<RTCStatsReport>（Map）
        if (typeof pc1.getStats === 'function') {
            try {
                this._addLog('stats', 'pc1.getStats() ...');
                const report = await pc1.getStats();
                const size = typeof report.size === 'number' ? report.size : '—';
                lines.push(`1) pc1.getStats() → RTCStatsReport（Map），size = ${size}`);
                // RTCStatsReport 是 Map，用 for...of 遍历 [id, stat]
                const typeCounts = {};
                const samples = [];
                try {
                    for (const [id, stat] of report) {
                        const t = stat?.type || 'unknown';
                        (typeCounts[t]) = ((typeCounts[t]) || 0) + 1;
                        if (samples.length < 3)
                            samples.push(`  [${t}] ${String(id).slice(0, 12)}: ${JSON.stringify(stat).slice(0, 80)}`);
                    }
                }
                catch (err) {
                    lines.push(`   遍历失败：${err.message}`);
                }
                const knownTypes = ['candidate-pair', 'inbound-rtp', 'outbound-rtp', 'remote-inbound-rtp',
                    'remote-outbound-rtp', 'data-channel', 'transport', 'candidate', 'codec',
                    'peer-connection', 'stream', 'track', 'certificates', 'ice-server'];
                lines.push('\nRTCStats 类型分布：');
                for (const t of knownTypes) {
                    const n = (typeCounts[t]) || 0;
                    if (n > 0)
                        lines.push(`  ${t}: ${n}`);
                }
                const others = Object.keys(typeCounts).filter((k) => !knownTypes.includes(k));
                if (others.length)
                    lines.push(`  其它: ${others.map((k) => `${k}=${(typeCounts[k])}`).join(', ')}`);
                lines.push('\n样本（前 3 条）：');
                lines.push(...samples);
                this._addLog('stats', `getStats 完成：${size} 条，类型 ${Object.keys(typeCounts).join('/') || '无'}`);
            }
            catch (err) {
                lines.push(`1) getStats 失败：${err.name} - ${err.message}`);
                this._addLog('warn', `getStats 失败：${err.message}`);
            }
        }
        else {
            lines.push('1) pc1.getStats 不可用（typeof undefined）');
            this._addLog('warn', 'pc1.getStats 不可用');
        }
        // 2) getConfiguration() / setConfiguration()
        lines.push('\n2) 会话配置管理：');
        if (typeof pc1.getConfiguration === 'function') {
            try {
                const cfg = pc1.getConfiguration();
                lines.push(`   getConfiguration(): iceServers=${JSON.stringify(cfg?.iceServers || [])}, bundlePolicy=${cfg?.bundlePolicy || '—'}`);
            }
            catch (err) {
                lines.push(`   getConfiguration 失败：${err.message}`);
            }
        }
        else {
            lines.push('   getConfiguration 不可用（typeof undefined）');
        }
        if (typeof pc1.setConfiguration === 'function') {
            try {
                pc1.setConfiguration({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }], iceTransportPolicy: 'all' });
                lines.push('   setConfiguration({...}) 成功（可热更新 iceServers / 策略，不重启连接）');
                this._addLog('stats', 'pc1.setConfiguration({...}) 成功');
            }
            catch (err) {
                lines.push(`   setConfiguration 失败：${err.message}`);
            }
        }
        else {
            lines.push('   setConfiguration 不可用（需先 setLocalDescription）');
        }
        // 3) restartIce()
        lines.push('\n3) ICE 重启：');
        if (typeof pc1.restartIce === 'function') {
            try {
                pc1.restartIce();
                lines.push('   pc1.restartIce() 已调用（标记需重新收集 ICE 候选，下次 createOffer 携带 iceRestart）');
                this._addLog('stats', 'pc1.restartIce() 已调用');
            }
            catch (err) {
                lines.push(`   restartIce 失败：${err.message}`);
            }
        }
        else {
            lines.push('   restartIce 不可用（typeof undefined）');
        }
        // 4) close() 会话关闭（不真正调用，避免影响后续卡片；仅说明）
        lines.push('\n4) 会话关闭 close()：\n   pc.close() → 关闭连接，connectionState 迁移到 closed\n   触发 onconnectionstatechange / oniceconnectionstatechange\n   说明：本演示不真正调用 close()，避免影响后续卡片；componentWillUnmount 会自动释放');
        lines.push('\nAPI 概览：\n  pc.getStats() → Promise<RTCStatsReport>（Map<id, RTCStats>）\n' +
            '  RTCStats 字段：id / type / timestamp / 各 type 专属字段\n' +
            '  RTCStats 类型：candidate-pair / inbound-rtp / outbound-rtp / remote-inbound-rtp /\n' +
            '    remote-outbound-rtp / data-channel / transport / candidate / codec / peer-connection / stream / track\n' +
            '  pc.getConfiguration() → RTCConfiguration\n  pc.setConfiguration(config) → 热更新（需先 setLocalDescription）\n' +
            '  pc.restartIce() → 标记 ICE 重启\n  pc.close() → 关闭会话');
        this.setState({ statsInfo: lines.join('\n') });
        this._addLog('stats', '统计与会话管理演示完成');
    }
    _renderCard6() {
        const s = this.state;
        const caps = this._capFlags();
        const card = new Card({
            title: '6. getStats 统计与会话管理',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([{ key: 'getStats', ok: caps.rtcpc }, { key: 'RTCStatsReport', ok: caps.rtcStatsReport }]), h(Tag, { color: 'primary' }, 'RTCStats / session')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'pc.getStats() 返回 Promise<RTCStatsReport>，是一个 Map<id, RTCStats>，包含各类统计：candidate-pair（ICE 候选对）、inbound-rtp / outbound-rtp（收发 RTP）、remote-inbound-rtp / remote-outbound-rtp（远端收发）、data-channel（数据通道）、transport（传输）、candidate（候选）、codec（编解码器）。每条统计含 id / type / timestamp 及 type 专属字段。配合 getConfiguration / setConfiguration / restartIce / close 完成会话管理。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('刷新统计 + 会话管理', { type: 'primary', size: 'sm', disabled: !caps.rtcpc, onClick: () => this._demoStatsAndSession() })),
                h('div', { class: 'fs-sm text-secondary' }, 'getStats 结果与会话管理：'),
                h('pre', { class: 'code-block', style: { maxHeight: '360px', overflow: 'auto' } }, h('code', {}, s.statsInfo || '（请先在 Card 1 创建 pc1/pc2，再点击「刷新统计 + 会话管理」）')),
                h(Alert, {
                    type: 'info',
                    message: 'getStats 是 WebRTC 监控与调优的核心',
                    description: '通过定期轮询 getStats 可获取丢包率（packetsLost）、往返时延（roundTripTime）、抖动（jitter）、码率（bytesSent / bytesReceived），用于网络质量监控与自适应码率。setConfiguration 可在不重启连接的前提下更新 STUN/TURN 服务器；restartIce 触发 ICE 重启以应对网络变更。',
                }),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // =================== 日志面板 ===================
    _renderLogPanel() {
        const s = this.state;
        return h('div', { class: 'log-panel' }, h('div', { class: 'log-panel__header' }, '事件日志', h(Tag, { color: 'primary' }, `${s.logs.length} 条`)), s.logs.length === 0
            ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
            : s.logs.map((log) => h('div', { class: 'log-panel__line' }, h('span', { class: 'log-panel__time' }, log.time), h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type), h('span', { class: 'log-panel__content' }, log.content))));
    }
    // =================== 整页渲染 ===================
    render() {
        const s = this.state;
        return h('div', { class: 'page api-lab-page webrtc-deep-page' }, h('h2', { class: 'section-title' }, 'WebRTC 深入 实验室'), h('p', { class: 'fs-sm text-secondary mb-md' }, 'WebRTC 用于浏览器间 P2P 音视频与数据通信。本页演示 RTCPeerConnection 配置与生命周期、Offer/Answer 协商、ICE 候选交换、MediaStream 媒体接入、DataChannel 数据通道与 getStats 统计。'), s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderLogPanel());
    }
}
//# sourceMappingURL=WebRTCDeepPage.js.map