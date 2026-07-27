// Sidebar.ts —— 侧边栏
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { store } from '../../core/Store.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';
// 根据当前路由动态生成菜单
function getMenuForPath(path) {
    if (path.startsWith('/components')) {
        return [
            { group: '组件分类' },
            { path: '/components/basic', label: '基础组件', icon: '◍' },
            { path: '/components/general', label: '通用组件', icon: '◈' },
            { path: '/components/navigation', label: '导航组件', icon: '↹' },
            { path: '/components/form', label: '表单组件', icon: '▦' },
            { path: '/components/data', label: '数据展示', icon: '▤' },
            { path: '/components/feedback', label: '反馈组件', icon: '✦' },
        ];
    }
    if (path.startsWith('/api-lab')) {
        return [
            { group: 'MDN Web API' },
            { path: '/api-lab/history', label: 'History API', icon: '↹' },
            { path: '/api-lab/storage', label: 'Storage', icon: '⛁' },
            { path: '/api-lab/fetch', label: 'Fetch', icon: '⇅' },
            { path: '/api-lab/canvas', label: 'Canvas', icon: '◐' },
            { path: '/api-lab/worker', label: 'Web Worker', icon: '⚙' },
            { path: '/api-lab/observer', label: 'Observer', icon: '◉' },
            { path: '/api-lab/media', label: '多媒体 API', icon: '♪' },
            { path: '/api-lab/advanced', label: '高级 API', icon: '✦' },
            { path: '/api-lab/environment', label: '环境与设备', icon: '◍' },
            { path: '/api-lab/web-components', label: 'Web Components', icon: '◈' },
            { path: '/api-lab/text-media', label: '文本与多媒体', icon: '✎' },
            { path: '/api-lab/modern-js', label: '现代 ES 特性', icon: '★' },
            { path: '/api-lab/input-events', label: '输入事件系统', icon: '✥' },
            { path: '/api-lab/graphics', label: '图形与渲染', icon: '◰' },
            { path: '/api-lab/streams', label: 'Streams 与网络', icon: '∿' },
            { path: '/api-lab/realtime', label: '实时通信', icon: '⟷' },
            { path: '/api-lab/sensors', label: '设备传感器', icon: '⊕' },
            { path: '/api-lab/intl', label: '国际化与本地化', icon: '⌖' },
            { path: '/api-lab/file-access', label: '文件访问', icon: '▤' },
            { path: '/api-lab/background', label: '后台服务', icon: '◷' },
            { path: '/api-lab/native-interop', label: '硬件互操作', icon: '⊟' },
            { path: '/api-lab/webassembly', label: 'WebAssembly', icon: '⊞' },
            { path: '/api-lab/modern-dom', label: '现代 DOM 平台', icon: '⎔' },
            { path: '/api-lab/advanced-graphics', label: '高级图形', icon: '◐' },
            { path: '/api-lab/concurrency', label: '并发与通信', icon: '⇶' },
            { path: '/api-lab/identity', label: '身份与支付', icon: '⚿' },
            { path: '/api-lab/advanced-webaudio', label: 'Web Audio 深入', icon: '♫' },
            { path: '/api-lab/advanced-media', label: '媒体扩展', icon: '🎞' },
            { path: '/api-lab/dom-traversal', label: 'DOM 遍历', icon: '⌗' },
            { path: '/api-lab/pwa-modern', label: 'PWA 现代平台', icon: '⌂' },
            { path: '/api-lab/js-runtime', label: 'JS 运行时', icon: '⌥' },
            { path: '/api-lab/modern-css', label: '现代 CSS', icon: '◍' },
            { path: '/api-lab/security-privacy', label: '安全与隐私', icon: '⛨' },
            { path: '/api-lab/advanced-storage', label: '高级存储', icon: '⛁' },
            { path: '/api-lab/webcrypto', label: 'Web Crypto', icon: '⚿' },
            { path: '/api-lab/performance', label: 'Performance', icon: '⏱' },
            { path: '/api-lab/a11y-interaction', label: '无障碍交互', icon: '♿' },
            { path: '/api-lab/text-encoding', label: '编码与 i18n', icon: 'Ǣ' },
            { path: '/api-lab/web-animations', label: 'Web Animations', icon: '⏵' },
            { path: '/api-lab/css-om', label: 'CSS Object Model', icon: '◈' },
            { path: '/api-lab/dom-parsing', label: 'DOM 解析/XPath', icon: '⌑' },
            { path: '/api-lab/advanced-observer', label: '高级观察器', icon: '◉' },
            { path: '/api-lab/canvas-deep', label: 'Canvas 深度', icon: '▦' },
            { path: '/api-lab/svg-deep', label: 'SVG 深度', icon: '✦' },
            { path: '/api-lab/service-worker', label: 'Service Worker', icon: '⚙' },
            { path: '/api-lab/web-components-deep', label: 'Web Components', icon: '⬚' },
            { path: '/api-lab/hardware-devices', label: '硬件设备', icon: '🖲' },
            { path: '/api-lab/file-system-access', label: '文件系统', icon: '▿' },
            { path: '/api-lab/streams-fetch', label: '流与 Fetch', icon: '≋' },
            { path: '/api-lab/window-manager', label: '窗口管理', icon: '▦' },
            { path: '/api-lab/async-cookbook', label: '异步手册', icon: '⟳' },
            { path: '/api-lab/drag-drop', label: '拖拽深度', icon: '⇿' },
            { path: '/api-lab/selection-clipboard', label: '选区剪贴板', icon: '✂' },
            { path: '/api-lab/speech-codecs', label: '语音编解码', icon: '☊' },
            { path: '/api-lab/webgpu-transitions', label: 'WebGPU', icon: '◆' },
            { path: '/api-lab/css-houdini', label: 'CSS Houdini', icon: '⬡' },
            { path: '/api-lab/advanced-network', label: '高级网络', icon: '⇄' },
            { path: '/api-lab/scheduler-tasks', label: '任务调度', icon: '⏱' },
            { path: '/api-lab/navigation-api', label: 'Navigation', icon: '⇉' },
            { path: '/api-lab/share-contacts', label: '分享联系人', icon: '↗' },
            { path: '/api-lab/advanced-input', label: '高级输入', icon: '⌨' },
            { path: '/api-lab/shared-memory', label: '共享内存', icon: '⧖' },
            { path: '/api-lab/barcode-screen', label: '条码屏幕', icon: '▤' },
            { path: '/api-lab/reporting-trusted', label: '报告可信', icon: '⛨' },
            { path: '/api-lab/es2024', label: 'ES2024', icon: '★' },
            { path: '/api-lab/webgpu-compute', label: 'GPU 计算', icon: '◈' },
            { path: '/api-lab/worker-advanced', label: 'Worker 高级', icon: '⚙' },
            { path: '/api-lab/storage-access', label: '存储多源', icon: '🗄' },
            { path: '/api-lab/webauthn', label: 'WebAuthn', icon: '⚿' },
            { path: '/api-lab/webrtc-deep', label: 'WebRTC 深入', icon: '◉' },
            { path: '/api-lab/css-advanced-features', label: 'CSS 高级', icon: '⌖' },
            { path: '/api-lab/payment-fedcm', label: '支付 FedCM', icon: '₿' },
            { path: '/api-lab/url-encoding-deep', label: 'URL 编码', icon: '⌘' },
            { path: '/api-lab/builtin-ai', label: '内置 AI', icon: '✦' },
            { path: '/api-lab/privacy-sandbox-deep', label: '隐私沙盒', icon: '⬡' },
            { path: '/api-lab/window-pip-viewport', label: '画中画视口', icon: '⊞' },
            { path: '/api-lab/midi-nfc-gamepad', label: 'MIDI/NFC', icon: '♪' },
            { path: '/api-lab/local-fonts-deep', label: '本地字体', icon: '🔠' },
            { path: '/api-lab/editing-input-events', label: '编辑事件', icon: '✎' },
            { path: '/api-lab/speculation-rules', label: '推测规则', icon: '⏵' },
            { path: '/api-lab/content-index-offline', label: '内容索引', icon: '♽' },
            { path: '/api-lab/css-scroll-layout', label: 'CSS 滚动', icon: '⇄' },
            { path: '/api-lab/storage-buckets-cookie-store', label: '存储桶', icon: '🍪' },
            { path: '/api-lab/soft-navigation', label: '软导航', icon: '↪' },
            { path: '/api-lab/webgl-advanced', label: 'WebGL2', icon: '◬' },
            { path: '/api-lab/view-transitions-l2', label: '跨文档过渡', icon: '⇆' },
            { path: '/api-lab/css-text-advanced', label: 'CSS 文本', icon: '¶' },
            { path: '/api-lab/fetch-later', label: 'fetchLater', icon: '⤓' },
            { path: '/api-lab/web-components-advanced', label: 'WC 高级', icon: '⬔' },
            { path: '/api-lab/intersection-observer-v2', label: 'IO v2', icon: '◉' },
            { path: '/api-lab/web-locks', label: 'Web Locks', icon: '🔒' },
            { path: '/api-lab/css-starting-style', label: '@starting-style', icon: '⤬' },
            { path: '/api-lab/webgpu-storage-texture', label: 'GPU Storage', icon: '▦' },
            { path: '/api-lab/webgpu-render-pipeline', label: 'GPU 渲染管线', icon: '◢' },
            { path: '/api-lab/css-container-style-queries', label: '容器样式查询', icon: '◈' },
            { path: '/api-lab/css-logical-layout', label: '逻辑布局', icon: '⇋' },
            { path: '/api-lab/canvas-recording', label: 'Canvas 录制', icon: '⏺' },
            { path: '/api-lab/css-media-user-preference', label: '偏好媒体查询', icon: '♿' },
            { path: '/api-lab/invoker-api', label: 'Invoker API', icon: '⚡' },
            { path: '/api-lab/form-api-deep', label: '表单 API', icon: '✎' },
            { path: '/api-lab/css-visual-effects', label: 'CSS 视觉效果', icon: '◑' },
            { path: '/api-lab/modern-html', label: '现代 HTML 全局属性', icon: '◍' },
            { path: '/api-lab/capture-advanced', label: '高级屏幕捕获与剪贴板', icon: '◍' },
            { path: '/api-lab/edit-context-activation', label: 'EditContext 与用户激活', icon: '◍' },
            { path: '/api-lab/css-form-color', label: 'CSS 表单伪类与颜色空间', icon: '◍' },
            { path: '/api-lab/modern-js-modules', label: '现代 JS 与模块系统', icon: '◍' },
            { path: '/api-lab/scroll-events', label: '滚动事件与滚动条', icon: '◍' },
            { path: '/api-lab/temporal-api', label: 'Temporal 日期时间 API', icon: '◍' },
            { path: '/api-lab/es2025-language', label: 'ES2025 语言新特性', icon: '◍' },
            { path: '/api-lab/webassembly-advanced', label: 'WebAssembly 高级 Proposal', icon: '◍' },
            { path: '/api-lab/experimental-web-apis', label: '实验/边缘 Web API', icon: '◍' },
            { path: '/api-lab/css-advanced-properties', label: 'CSS 高级属性', icon: '◍' },
            { path: '/api-lab/ui-extensions-api', label: 'UI 扩展与浏览器扩展 API', icon: '◍' },
            { path: '/api-lab/webgpu-advanced-extensions', label: 'WebGPU 高级扩展与 GPU-Driven 渲染', icon: '◍' },
            { path: '/api-lab/css-conditional-level5', label: 'CSS 条件规则 Level 5 与未来提案', icon: '◍' },
            { path: '/api-lab/advanced-web-platform', label: 'Web 平台高级特性补遗', icon: '◍' },
            { path: '/api-lab/css-viewport-units-multicol', label: 'CSS 视口/容器单位与多栏布局', icon: '◍' },
            { path: '/api-lab/css-generated-content-lists', label: 'CSS 生成内容与列表样式', icon: '◍' },
            { path: '/api-lab/customizable-select', label: '可定制 Select API（OpenUI）', icon: '◍' },
            { path: '/api-lab/html-modern-interactive', label: '现代 HTML 交互/语义元素', icon: '◍' },
            { path: '/api-lab/css-font-typography-deep', label: 'CSS 字体与排版高级', icon: '◍' },
            { path: '/api-lab/css-anchor-positioning-deep', label: 'CSS Anchor Positioning 深度', icon: '◍' },
            { path: '/api-lab/css-custom-highlight', label: 'CSS Custom Highlight API', icon: '◍' },
            { path: '/api-lab/css-flexbox-deep', label: 'CSS Flexbox 完整深度', icon: '◍' },
            { path: '/api-lab/css-grid-deep', label: 'CSS Grid 完整深度', icon: '◍' },
            { path: '/api-lab/css-transforms-3d-deep', label: 'CSS Transforms & 3D 深度', icon: '◍' },
            { path: '/api-lab/css-transitions-animations', label: 'CSS Transitions & Animations', icon: '◍' },
            { path: '/api-lab/css-box-model-positioning', label: 'CSS 盒模型与定位', icon: '◍' },
            { path: '/api-lab/css-cascade-inheritance-deep', label: 'CSS 级联继承与自定义属性', icon: '◍' },
            { path: '/api-lab/css-backgrounds-borders-shadows-deep', label: 'CSS 背景/边框/阴影深度', icon: '◍' },
            { path: '/api-lab/css-gradients-deep', label: 'CSS 渐变完整深度', icon: '◍' },
            { path: '/api-lab/css-scroll-driven-animations-deep', label: 'CSS 滚动驱动动画', icon: '◍' },
            { path: '/api-lab/css-clip-path-deep', label: 'CSS clip-path 剪裁深度', icon: '◍' },
            { path: '/api-lab/css-nesting-scope-deep', label: 'CSS 嵌套与作用域', icon: '◍' },
            { path: '/api-lab/css-view-transitions-deep', label: 'CSS 视图过渡（同文档）', icon: '◍' },
            { path: '/api-lab/css-masking-compositing-deep', label: 'CSS 遮罩与合成', icon: '◍' },
            { path: '/api-lab/web-notifications-push-deep', label: 'Web 通知与推送', icon: '◍' },
            { path: '/api-lab/css-houdini-worklets-deep', label: 'CSS Houdini Worklets', icon: '◍' },
            { path: '/api-lab/web-speech-api-deep', label: 'Web Speech 语音合成与识别', icon: '◍' },
            { path: '/api-lab/pointer-touch-events-deep', label: 'Pointer & Touch 事件', icon: '◍' },
            { path: '/api-lab/rtc-encoded-transform', label: 'RTCEncodedTransform', icon: '◍' },
            { path: '/api-lab/css-table-layout-deep', label: 'CSS Table Layout', icon: '◍' },
            { path: '/api-lab/spatial-audio-deep', label: 'Spatial Audio', icon: '◍' },
            { path: '/api-lab/web-smart-card-api', label: 'Web Smart Card API', icon: '◍' },
            { path: '/api-lab/writing-suggestions-api', label: 'Writing Suggestions API', icon: '◍' },
            { path: '/api-lab/css-ruby-deep', label: 'CSS Ruby 注音排版', icon: '◍' },
            { path: '/api-lab/dom-parts-api', label: 'DOM Parts API', icon: '◍' },
            { path: '/api-lab/async-context', label: 'AsyncContext 异步上下文', icon: '◍' },
            { path: '/api-lab/websocket-stream', label: 'WebSocketStream 背压', icon: '◍' },
            { path: '/api-lab/html-media-element-advanced', label: 'HTMLMediaElement 高级', icon: '◍' },
            { path: '/api-lab/webxr-advanced', label: 'WebXR 高级特性', icon: '◍' },
            { path: '/api-lab/intl-enumeration', label: 'Intl Enumeration', icon: '◍' },
            { path: '/api-lab/css-inline-layout', label: 'CSS Inline Layout', icon: '◍' },
            { path: '/api-lab/css-resize', label: 'CSS Resize', icon: '◍' },
            { path: '/api-lab/media-track-constraints', label: 'MediaTrackConstraints', icon: '◍' },
            { path: '/api-lab/webtransport', label: 'WebTransport HTTP/3', icon: '◍' },
            { path: '/api-lab/webnn-api', label: 'WebNN API 神经网络推理', icon: '◍' },
            { path: '/api-lab/webassembly-gc-control-flow', label: 'WASM GC/EH/Tail Call 提案', icon: '◍' },
            { path: '/api-lab/css-color-hdr-deep', label: 'CSS Color Level 4/5 与 HDR', icon: '◍' },
            { path: '/api-lab/css-cascade-layers', label: 'CSS Cascade Layers @layer', icon: '◍' },
            { path: '/api-lab/css-performance-layout', label: 'CSS Containment + Content Visibility + Masonry', icon: '◍' },
            { path: '/api-lab/css-scroll-snap', label: 'CSS Scroll Snap Module', icon: '◍' },
            { path: '/api-lab/css-writing-modes', label: 'CSS Writing Modes Level 3/4', icon: '◍' },
            { path: '/api-lab/css-counter-styles', label: 'CSS Counter Styles @counter-style', icon: '◍' },
            { path: '/api-lab/css-functions-deep', label: 'CSS Easing + Math Functions', icon: '◍' },
            { path: '/api-lab/media-streaming-drm', label: 'MSE + EME 流媒体与 DRM', icon: '◍' },
            { path: '/api-lab/web-translation-api', label: 'Translation + Language Detector API', icon: '◍' },
            { path: '/api-lab/compression-streams', label: 'Compression Streams API', icon: '◍' },
            { path: '/api-lab/sanitizer-api', label: 'Sanitizer API HTML 净化', icon: '◍' },
            { path: '/api-lab/webcodecs-api', label: 'WebCodecs API 编解码管线', icon: '◍' },
            { path: '/api-lab/compute-pressure-api', label: 'Compute Pressure API', icon: '◍' },
            { path: '/api-lab/css-shapes', label: 'CSS Shapes Module Level 1', icon: '◍' },
            { path: '/api-lab/pointer-lock-api', label: 'Pointer Lock API 鼠标锁定', icon: '◍' },
            { path: '/api-lab/web-otp-api', label: 'WebOTP API 短信验证码', icon: '◍' },
            { path: '/api-lab/decorators-resource-management', label: 'TC39 装饰器与资源管理', icon: '◍' },
            { path: '/api-lab/css-motion-path', label: 'CSS Motion Path Module Level 1', icon: '◍' },
            { path: '/api-lab/media-session-api', label: 'Media Session API 媒体会话', icon: '◍' },
            { path: '/api-lab/mathml-core', label: 'MathML Core 数学公式渲染', icon: '◍' },
        ];
    }
    return [];
}
export class Sidebar extends Component {
    _unsubAfter = null;
    _unsubToggle = null;
    initialState() {
        return {
            collapsed: store.get('app', 'sidebarCollapsed'),
            open: store.get('app', 'sidebarOpen'),
            // 关键修复：刷新页面时 router.start() 同步触发首次 ROUTER_AFTER，
            // 而 componentDidMount 用 requestAnimationFrame 异步订阅，会错过该事件。
            // 这里直接从 window.location.pathname 读取真实路径，确保刷新后菜单立即正确渲染。
            currentPath: (typeof window !== 'undefined' && window.location?.pathname) || '/',
        };
    }
    render() {
        const items = getMenuForPath(this.state.currentPath);
        if (items.length === 0)
            return h('aside', { 'aria-hidden': 'true' }); // 占位，保持网格稳定
        const classes = [
            'app-sidebar',
            this.state.collapsed ? 'is-collapsed' : '',
            this.state.open ? 'is-open' : '',
        ].filter(Boolean).join(' ');
        return h('aside', { class: classes, 'aria-label': '页面导航' }, ...items.map((item) => {
            if (item.group) {
                return h('div', { class: 'app-sidebar__group-title' }, item.group);
            }
            const active = this._isActive(item.path);
            return h('a', {
                class: `app-sidebar__item ${active ? 'is-active' : ''}`,
                href: item.path,
                'aria-current': active ? 'page' : undefined,
                onClick: (e) => {
                    e.preventDefault();
                    this.props.router?.push(item.path);
                    store.commit('app', 'closeSidebar');
                },
            }, h('span', { class: 'app-sidebar__item-icon', 'aria-hidden': 'true' }, item.icon), h('span', { class: 'app-sidebar__item-label' }, item.label));
        }));
    }
    _isActive(path) {
        return this.state.currentPath === path;
    }
    componentDidMount() {
        this._unsubAfter = eventBus.on(EVENTS.ROUTER_AFTER, ({ to }) => {
            this.setState({ currentPath: to.path });
        });
        this._unsubToggle = eventBus.on(EVENTS.SIDEBAR_TOGGLE, () => {
            this.setState({
                collapsed: store.get('app', 'sidebarCollapsed'),
                open: store.get('app', 'sidebarOpen'),
            });
        });
    }
    componentWillUnmount() {
        this._unsubAfter?.();
        this._unsubToggle?.();
    }
}
//# sourceMappingURL=Sidebar.js.map