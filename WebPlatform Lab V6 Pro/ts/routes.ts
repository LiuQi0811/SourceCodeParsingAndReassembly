// routes.ts —— 集中路由表配置
// 路由模式：history（基于 History API）
// 设计模式：命令模式（router.push/replace/go）+ 装饰器（beforeEach 守卫）
import { HomePage } from './pages/HomePage.js';
import { RouterPage } from './pages/RouterPage.js';
import { UserDetailPage } from './pages/UserDetailPage.js';
import { AboutPage } from './pages/AboutPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { ComponentsIndexPage } from './pages/components/ComponentsIndexPage.js';
import { BasicComponentsPage } from './pages/components/BasicComponentsPage.js';
import { FormComponentsPage } from './pages/components/FormComponentsPage.js';
import { DataComponentsPage } from './pages/components/DataComponentsPage.js';
import { FeedbackComponentsPage } from './pages/components/FeedbackComponentsPage.js';
import { GeneralComponentsPage } from './pages/components/GeneralComponentsPage.js';
import { NavigationComponentsPage } from './pages/components/NavigationComponentsPage.js';
import { ApiLabIndexPage } from './pages/api-lab/ApiLabIndexPage.js';
import { HistoryPage } from './pages/api-lab/HistoryPage.js';
import { StoragePage } from './pages/api-lab/StoragePage.js';
import { FetchPage } from './pages/api-lab/FetchPage.js';
import { CanvasPage } from './pages/api-lab/CanvasPage.js';
import { WorkerPage } from './pages/api-lab/WorkerPage.js';
import { ObserverPage } from './pages/api-lab/ObserverPage.js';
import { MediaPage } from './pages/api-lab/MediaPage.js';
import { AdvancedPage } from './pages/api-lab/AdvancedPage.js';
import { EnvironmentPage } from './pages/api-lab/EnvironmentPage.js';
import { WebComponentsPage } from './pages/api-lab/WebComponentsPage.js';
import { TextMediaPage } from './pages/api-lab/TextMediaPage.js';
import { ModernJSPage } from './pages/api-lab/ModernJSPage.js';
import { InputEventsPage } from './pages/api-lab/InputEventsPage.js';
import { GraphicsPage } from './pages/api-lab/GraphicsPage.js';
import { StreamsPage } from './pages/api-lab/StreamsPage.js';
import { RealtimeCommsPage } from './pages/api-lab/RealtimeCommsPage.js';
import { DeviceSensorsPage } from './pages/api-lab/DeviceSensorsPage.js';
import { IntlLocalizationPage } from './pages/api-lab/IntlLocalizationPage.js';
import { FileAccessPage } from './pages/api-lab/FileAccessPage.js';
import { BackgroundServicesPage } from './pages/api-lab/BackgroundServicesPage.js';
import { NativeInteropPage } from './pages/api-lab/NativeInteropPage.js';
import { WebAssemblyPage } from './pages/api-lab/WebAssemblyPage.js';
import { ModernDOMPage } from './pages/api-lab/ModernDOMPage.js';
import { AdvancedGraphicsPage } from './pages/api-lab/AdvancedGraphicsPage.js';
import { ConcurrencyPage } from './pages/api-lab/ConcurrencyPage.js';
import { IdentityPage } from './pages/api-lab/IdentityPage.js';
import { AdvancedWebAudioPage } from './pages/api-lab/AdvancedWebAudioPage.js';
import { AdvancedMediaPage } from './pages/api-lab/AdvancedMediaPage.js';
import { DOMTraversalPage } from './pages/api-lab/DOMTraversalPage.js';
import { PWAModernPage } from './pages/api-lab/PWAModernPage.js';
import { AdvancedJSRuntimePage } from './pages/api-lab/AdvancedJSRuntimePage.js';
import { ModernCSSPage } from './pages/api-lab/ModernCSSPage.js';
import { SecurityPrivacyPage } from './pages/api-lab/SecurityPrivacyPage.js';
import { AdvancedStoragePage } from './pages/api-lab/AdvancedStoragePage.js';
import { WebCryptoDeepPage } from './pages/api-lab/WebCryptoDeepPage.js';
import { PerformanceAPIDeepPage } from './pages/api-lab/PerformanceAPIDeepPage.js';
import { AccessibilityInteractionPage } from './pages/api-lab/AccessibilityInteractionPage.js';
import { TextEncodingIntlPage } from './pages/api-lab/TextEncodingIntlPage.js';
import { WebAnimationsPage } from './pages/api-lab/WebAnimationsPage.js';
import { CSSObjectModelPage } from './pages/api-lab/CSSObjectModelPage.js';
import { DOMParsersXPathPage } from './pages/api-lab/DOMParsersXPathPage.js';
import { AdvancedObserverPage } from './pages/api-lab/AdvancedObserverPage.js';
import { CanvasDeepPage } from './pages/api-lab/CanvasDeepPage.js';
import { SVGDeepPage } from './pages/api-lab/SVGDeepPage.js';
import { ServiceWorkerPage } from './pages/api-lab/ServiceWorkerPage.js';
import { WebComponentsDeepPage } from './pages/api-lab/WebComponentsDeepPage.js';
import { HardwareDevicesPage } from './pages/api-lab/HardwareDevicesPage.js';
import { FileSystemAccessPage } from './pages/api-lab/FileSystemAccessPage.js';
import { StreamsFetchDeepPage } from './pages/api-lab/StreamsFetchDeepPage.js';
import { WindowManagerPage } from './pages/api-lab/WindowManagerPage.js';
import { AsyncCookbookPage } from './pages/api-lab/AsyncCookbookPage.js';
import { DragDropDeepPage } from './pages/api-lab/DragDropDeepPage.js';
import { SelectionClipboardPage } from './pages/api-lab/SelectionClipboardPage.js';
import { SpeechCodecsPage } from './pages/api-lab/SpeechCodecsPage.js';
import { WebGPUViewTransitionsPage } from './pages/api-lab/WebGPUViewTransitionsPage.js';
import { CSSHoudiniPage } from './pages/api-lab/CSSHoudiniPage.js';
import { AdvancedNetworkPage } from './pages/api-lab/AdvancedNetworkPage.js';
import { SchedulerTasksPage } from './pages/api-lab/SchedulerTasksPage.js';
import { NavigationAPIDeepPage } from './pages/api-lab/NavigationAPIDeepPage.js';
import { WebShareContactsPage } from './pages/api-lab/WebShareContactsPage.js';
import { AdvancedInputPage } from './pages/api-lab/AdvancedInputPage.js';
import { SharedMemoryAtomicsPage } from './pages/api-lab/SharedMemoryAtomicsPage.js';
import { BarcodeScreenCapturePage } from './pages/api-lab/BarcodeScreenCapturePage.js';
import { ReportingTrustedTypesPage } from './pages/api-lab/ReportingTrustedTypesPage.js';
import { ModernES2024Page } from './pages/api-lab/ModernES2024Page.js';
import { WebGPUComputePage } from './pages/api-lab/WebGPUComputePage.js';
import { WorkerAdvancedPage } from './pages/api-lab/WorkerAdvancedPage.js';
import { StorageAccessMultiOriginPage } from './pages/api-lab/StorageAccessMultiOriginPage.js';
import { WebAuthDeepPage } from './pages/api-lab/WebAuthDeepPage.js';
import { WebRTCDeepPage } from './pages/api-lab/WebRTCDeepPage.js';
import { CSSAdvancedFeaturesPage } from './pages/api-lab/CSSAdvancedFeaturesPage.js';
import { PaymentFedCMPage } from './pages/api-lab/PaymentFedCMPage.js';
import { URLEncodingDeepPage } from './pages/api-lab/URLEncodingDeepPage.js';
import { BuiltInAIPage } from './pages/api-lab/BuiltInAIPage.js';
import { PrivacySandboxDeepPage } from './pages/api-lab/PrivacySandboxDeepPage.js';
import { WindowPiPViewportPage } from './pages/api-lab/WindowPiPViewportPage.js';
import { WebMIDINFCGamepadPage } from './pages/api-lab/WebMIDINFCGamepadPage.js';
import { LocalFontsDeepPage } from './pages/api-lab/LocalFontsDeepPage.js';
import { EditingInputEventsPage } from './pages/api-lab/EditingInputEventsPage.js';
import { SpeculationRulesFetchPriorityPage } from './pages/api-lab/SpeculationRulesFetchPriorityPage.js';
import { ContentIndexOfflinePage } from './pages/api-lab/ContentIndexOfflinePage.js';
import { CSSScrollLayoutPage } from './pages/api-lab/CSSScrollLayoutPage.js';
import { StorageBucketsCookieStorePage } from './pages/api-lab/StorageBucketsCookieStorePage.js';
import { SoftNavigationPage } from './pages/api-lab/SoftNavigationPage.js';
import { WebGLAdvancedPage } from './pages/api-lab/WebGLAdvancedPage.js';
import { ViewTransitionsL2Page } from './pages/api-lab/ViewTransitionsL2Page.js';
import { CSSTextAdvancedPage } from './pages/api-lab/CSSTextAdvancedPage.js';
import { FetchLaterAPIPage } from './pages/api-lab/FetchLaterAPIPage.js';
import { WebComponentsAdvancedPage } from './pages/api-lab/WebComponentsAdvancedPage.js';
import { IntersectionObserverV2Page } from './pages/api-lab/IntersectionObserverV2Page.js';
import { WebLocksAPIPage } from './pages/api-lab/WebLocksAPIPage.js';
import { CSSStartingStylePage } from './pages/api-lab/CSSStartingStylePage.js';
import { WebGPUStorageTexturePage } from './pages/api-lab/WebGPUStorageTexturePage.js';
import { WebGPURenderPipelinePage } from './pages/api-lab/WebGPURenderPipelinePage.js';
import { CSSContainerStyleQueriesPage } from './pages/api-lab/CSSContainerStyleQueriesPage.js';
import { CSSLogicalLayoutPage } from './pages/api-lab/CSSLogicalLayoutPage.js';
import { CanvasRecordingPage } from './pages/api-lab/CanvasRecordingPage.js';
import { CSSMediaUserPreferencePage } from './pages/api-lab/CSSMediaUserPreferencePage.js';
import { InvokerAPIPage } from './pages/api-lab/InvokerAPIPage.js';
import { FormAPIDeepPage } from './pages/api-lab/FormAPIDeepPage.js';
import { CSSVisualEffectsPage } from './pages/api-lab/CSSVisualEffectsPage.js';
import { ModernHTMLPage } from './pages/api-lab/ModernHTMLPage.js';
import { CaptureAdvancedPage } from './pages/api-lab/CaptureAdvancedPage.js';
import { EditContextActivationPage } from './pages/api-lab/EditContextActivationPage.js';
import { CSSFormColorPage } from './pages/api-lab/CSSFormColorPage.js';
import { ModernJSModulesPage } from './pages/api-lab/ModernJSModulesPage.js';
import { ScrollEventsPage } from './pages/api-lab/ScrollEventsPage.js';
import { TemporalAPIPage } from './pages/api-lab/TemporalAPIPage.js';
import { ES2025LanguagePage } from './pages/api-lab/ES2025LanguagePage.js';
import { WebAssemblyAdvancedPage } from './pages/api-lab/WebAssemblyAdvancedPage.js';
import { ExperimentalWebAPIsPage } from './pages/api-lab/ExperimentalWebAPIsPage.js';
import { CSSAdvancedPropertiesPage } from './pages/api-lab/CSSAdvancedPropertiesPage.js';
import { UIExtensionsAPIPage } from './pages/api-lab/UIExtensionsAPIPage.js';
import { WebGPUAdvancedExtensionsPage } from './pages/api-lab/WebGPUAdvancedExtensionsPage.js';
import { CSSConditionalLevel5Page } from './pages/api-lab/CSSConditionalLevel5Page.js';
import { AdvancedWebPlatformPage } from './pages/api-lab/AdvancedWebPlatformPage.js';
import { CSSViewportUnitsMulticolPage } from './pages/api-lab/CSSViewportUnitsMulticolPage.js';
import { CSSGeneratedContentListsPage } from './pages/api-lab/CSSGeneratedContentListsPage.js';
import { CustomizableSelectAPIPage } from './pages/api-lab/CustomizableSelectAPIPage.js';
import { HTMLModernInteractiveElementsPage } from './pages/api-lab/HTMLModernInteractiveElementsPage.js';
import { CSSFontTypographyDeepPage } from './pages/api-lab/CSSFontTypographyDeepPage.js';
import { CSSAnchorPositioningDeepPage } from './pages/api-lab/CSSAnchorPositioningDeepPage.js';
import { CSSCustomHighlightAPIPage } from './pages/api-lab/CSSCustomHighlightAPIPage.js';
import { CSSFlexboxDeepPage } from './pages/api-lab/CSSFlexboxDeepPage.js';
import { CSSGridDeepPage } from './pages/api-lab/CSSGridDeepPage.js';
import { CSSTransforms3DDeepPage } from './pages/api-lab/CSSTransforms3DDeepPage.js';
import { CSSTransitionsAnimationsPage } from './pages/api-lab/CSSTransitionsAnimationsPage.js';
import { CSSBoxModelPositioningPage } from './pages/api-lab/CSSBoxModelPositioningPage.js';
import { CSSCascadeInheritanceDeepPage } from './pages/api-lab/CSSCascadeInheritanceDeepPage.js';
import { CSSBackgroundsBordersShadowsDeepPage } from './pages/api-lab/CSSBackgroundsBordersShadowsDeepPage.js';
import { CSSGradientsDeepPage } from './pages/api-lab/CSSGradientsDeepPage.js';
import { CSSScrollDrivenAnimationsDeepPage } from './pages/api-lab/CSSScrollDrivenAnimationsDeepPage.js';
import { CSSClipPathDeepPage } from './pages/api-lab/CSSClipPathDeepPage.js';
import { CSSNestingScopeDeepPage } from './pages/api-lab/CSSNestingScopeDeepPage.js';
import { CSSViewTransitionsDeepPage } from './pages/api-lab/CSSViewTransitionsDeepPage.js';
import { CSSMaskingCompositingDeepPage } from './pages/api-lab/CSSMaskingCompositingDeepPage.js';
import { WebNotificationsPushDeepPage } from './pages/api-lab/WebNotificationsPushDeepPage.js';
import { CSSHoudiniWorkletsDeepPage } from './pages/api-lab/CSSHoudiniWorkletsDeepPage.js';
import { WebSpeechAPIDeepPage } from './pages/api-lab/WebSpeechAPIDeepPage.js';
import { PointerTouchEventsDeepPage } from './pages/api-lab/PointerTouchEventsDeepPage.js';
import { RTCEncodedTransformPage } from './pages/api-lab/RTCEncodedTransformPage.js';
import { CSSTableLayoutDeepPage } from './pages/api-lab/CSSTableLayoutDeepPage.js';
import { SpatialAudioDeepPage } from './pages/api-lab/SpatialAudioDeepPage.js';
import { WebSmartCardAPIPage } from './pages/api-lab/WebSmartCardAPIPage.js';
import { WritingSuggestionsAPIPage } from './pages/api-lab/WritingSuggestionsAPIPage.js';
import { CSSRubyDeepPage } from './pages/api-lab/CSSRubyDeepPage.js';
import { DOMPartsAPIPage } from './pages/api-lab/DOMPartsAPIPage.js';
import { AsyncContextPage } from './pages/api-lab/AsyncContextPage.js';
import { WebSocketStreamPage } from './pages/api-lab/WebSocketStreamPage.js';
import { HTMLMediaElementAdvancedPage } from './pages/api-lab/HTMLMediaElementAdvancedPage.js';
import { WebXRAdvancedPage } from './pages/api-lab/WebXRAdvancedPage.js';
import { IntlEnumerationPage } from './pages/api-lab/IntlEnumerationPage.js';
import { CSSInlineLayoutPage } from './pages/api-lab/CSSInlineLayoutPage.js';
import { CSSResizePage } from './pages/api-lab/CSSResizePage.js';
import { MediaTrackConstraintsPage } from './pages/api-lab/MediaTrackConstraintsPage.js';
import { WebTransportPage } from './pages/api-lab/WebTransportPage.js';
import { WebNNAPIPage } from './pages/api-lab/WebNNAPIPage.js';
import { WebAssemblyGcControlFlowPage } from './pages/api-lab/WebAssemblyGcControlFlowPage.js';
import { CSSColorHDRDeepPage } from './pages/api-lab/CSSColorHDRDeepPage.js';
import { CSSCascadeLayersPage } from './pages/api-lab/CSSCascadeLayersPage.js';
import { CSSPerformanceLayoutPage } from './pages/api-lab/CSSPerformanceLayoutPage.js';
import { CSSScrollSnapPage } from './pages/api-lab/CSSScrollSnapPage.js';
import { CSSWritingModesPage } from './pages/api-lab/CSSWritingModesPage.js';
import { CSSCounterStylesPage } from './pages/api-lab/CSSCounterStylesPage.js';
import { CSSFunctionsDeepPage } from './pages/api-lab/CSSFunctionsDeepPage.js';
import { MediaStreamingDRMPage } from './pages/api-lab/MediaStreamingDRMPage.js';
import { WebTranslationAPIPage } from './pages/api-lab/WebTranslationAPIPage.js';
import { CompressionStreamPage } from './pages/api-lab/CompressionStreamsPage.js';
import { SanitizerAPIPage } from './pages/api-lab/SanitizerAPIPage.js';
import { WebCodecsAPIPage } from './pages/api-lab/WebCodecsAPIPage.js';
import { ComputePressureAPIPage } from './pages/api-lab/ComputePressureAPIPage.js';
import { CSSShapesPage } from './pages/api-lab/CSSShapesPage.js';
import { PointerLockAPIPage } from './pages/api-lab/PointerLockAPIPage.js';
import { WebOTPAPIPage } from './pages/api-lab/WebOTPAPIPage.js';
import { DecoratorsResourceManagementPage } from './pages/api-lab/DecoratorsResourceManagementPage.js';
import { CSSMotionPathDeepPage } from './pages/api-lab/CSSMotionPathDeepPage.js';
import { MediaSessionAPIPage } from './pages/api-lab/MediaSessionAPIPage.js';
import { MathMLCorePage } from './pages/api-lab/MathMLCorePage.js';
import type { RouteConfig } from './core/types.js';

export const routes: RouteConfig[] = [
  { path: '/', name: 'home', component: HomePage, meta: { title: '首页' } },
  {
    path: '/components', name: 'components', component: ComponentsIndexPage, meta: { title: '组件演示' },
  },
  { path: '/components/basic', name: 'components.basic', component: BasicComponentsPage, meta: { title: '基础组件' } },
  { path: '/components/form', name: 'components.form', component: FormComponentsPage, meta: { title: '表单组件' } },
  { path: '/components/data', name: 'components.data', component: DataComponentsPage, meta: { title: '数据展示' } },
  { path: '/components/feedback', name: 'components.feedback', component: FeedbackComponentsPage, meta: { title: '反馈组件' } },
  { path: '/components/general', name: 'components.general', component: GeneralComponentsPage, meta: { title: '通用组件' } },
  { path: '/components/navigation', name: 'components.navigation', component: NavigationComponentsPage, meta: { title: '导航组件' } },

  { path: '/router', name: 'router', component: RouterPage, meta: { title: '路由示例' } },
  { path: '/router/user/:id', name: 'router.user', component: UserDetailPage, meta: { title: '用户详情' } },
  // /router/secret 由 beforeEach 守卫拦截，重定向到 /about
  { path: '/router/secret', name: 'router.secret', component: NotFoundPage, meta: { title: '受限页面' } },

  { path: '/api-lab', name: 'api-lab', component: ApiLabIndexPage, meta: { title: 'API 实验室' } },
  { path: '/api-lab/history', name: 'api-lab.history', component: HistoryPage, meta: { title: 'History API' } },
  { path: '/api-lab/storage', name: 'api-lab.storage', component: StoragePage, meta: { title: 'Storage' } },
  { path: '/api-lab/fetch', name: 'api-lab.fetch', component: FetchPage, meta: { title: 'Fetch' } },
  { path: '/api-lab/canvas', name: 'api-lab.canvas', component: CanvasPage, meta: { title: 'Canvas' } },
  { path: '/api-lab/worker', name: 'api-lab.worker', component: WorkerPage, meta: { title: 'Web Worker' } },
  { path: '/api-lab/observer', name: 'api-lab.observer', component: ObserverPage, meta: { title: 'Observer' } },
  { path: '/api-lab/media', name: 'api-lab.media', component: MediaPage, meta: { title: '多媒体 API' } },
  { path: '/api-lab/advanced', name: 'api-lab.advanced', component: AdvancedPage, meta: { title: '高级 API' } },
  { path: '/api-lab/environment', name: 'api-lab.environment', component: EnvironmentPage, meta: { title: '环境与设备 API' } },
  { path: '/api-lab/web-components', name: 'api-lab.web-components', component: WebComponentsPage, meta: { title: 'Web Components' } },
  { path: '/api-lab/text-media', name: 'api-lab.text-media', component: TextMediaPage, meta: { title: '文本与多媒体 API' } },
  { path: '/api-lab/modern-js', name: 'api-lab.modern-js', component: ModernJSPage, meta: { title: '现代 ES 特性' } },
  { path: '/api-lab/input-events', name: 'api-lab.input-events', component: InputEventsPage, meta: { title: '输入事件系统' } },
  { path: '/api-lab/graphics', name: 'api-lab.graphics', component: GraphicsPage, meta: { title: '图形与渲染' } },
  { path: '/api-lab/streams', name: 'api-lab.streams', component: StreamsPage, meta: { title: 'Streams 与网络' } },
  { path: '/api-lab/realtime', name: 'api-lab.realtime', component: RealtimeCommsPage, meta: { title: '实时通信' } },
  { path: '/api-lab/sensors', name: 'api-lab.sensors', component: DeviceSensorsPage, meta: { title: '设备传感器' } },
  { path: '/api-lab/intl', name: 'api-lab.intl', component: IntlLocalizationPage, meta: { title: '国际化与本地化' } },
  { path: '/api-lab/file-access', name: 'api-lab.file-access', component: FileAccessPage, meta: { title: '文件访问' } },
  { path: '/api-lab/background', name: 'api-lab.background', component: BackgroundServicesPage, meta: { title: '后台服务' } },
  { path: '/api-lab/native-interop', name: 'api-lab.native-interop', component: NativeInteropPage, meta: { title: '硬件与原生互操作' } },
  { path: '/api-lab/webassembly', name: 'api-lab.webassembly', component: WebAssemblyPage, meta: { title: 'WebAssembly' } },
  { path: '/api-lab/modern-dom', name: 'api-lab.modern-dom', component: ModernDOMPage, meta: { title: '现代 DOM 平台' } },
  { path: '/api-lab/advanced-graphics', name: 'api-lab.advanced-graphics', component: AdvancedGraphicsPage, meta: { title: '高级图形与渲染' } },
  { path: '/api-lab/concurrency', name: 'api-lab.concurrency', component: ConcurrencyPage, meta: { title: '并发与通信' } },
  { path: '/api-lab/identity', name: 'api-lab.identity', component: IdentityPage, meta: { title: '身份认证与支付' } },
  { path: '/api-lab/advanced-webaudio', name: 'api-lab.advanced-webaudio', component: AdvancedWebAudioPage, meta: { title: 'Web Audio 深入' } },
  { path: '/api-lab/advanced-media', name: 'api-lab.advanced-media', component: AdvancedMediaPage, meta: { title: '媒体扩展' } },
  { path: '/api-lab/dom-traversal', name: 'api-lab.dom-traversal', component: DOMTraversalPage, meta: { title: 'DOM 遍历与事件' } },
  { path: '/api-lab/pwa-modern', name: 'api-lab.pwa-modern', component: PWAModernPage, meta: { title: 'PWA 与现代平台' } },
  { path: '/api-lab/js-runtime', name: 'api-lab.js-runtime', component: AdvancedJSRuntimePage, meta: { title: 'JS 运行时新特性' } },
  { path: '/api-lab/modern-css', name: 'api-lab.modern-css', component: ModernCSSPage, meta: { title: '现代 CSS 特性' } },
  { path: '/api-lab/security-privacy', name: 'api-lab.security-privacy', component: SecurityPrivacyPage, meta: { title: '安全与隐私' } },
  { path: '/api-lab/advanced-storage', name: 'api-lab.advanced-storage', component: AdvancedStoragePage, meta: { title: '高级存储' } },
  { path: '/api-lab/webcrypto', name: 'api-lab.webcrypto', component: WebCryptoDeepPage, meta: { title: 'Web Crypto 加密' } },
  { path: '/api-lab/performance', name: 'api-lab.performance', component: PerformanceAPIDeepPage, meta: { title: 'Performance 性能监控' } },
  { path: '/api-lab/a11y-interaction', name: 'api-lab.a11y-interaction', component: AccessibilityInteractionPage, meta: { title: '无障碍与交互' } },
  { path: '/api-lab/text-encoding', name: 'api-lab.text-encoding', component: TextEncodingIntlPage, meta: { title: '文本编码与国际化' } },
  { path: '/api-lab/web-animations', name: 'api-lab.web-animations', component: WebAnimationsPage, meta: { title: 'Web Animations 动画' } },
  { path: '/api-lab/css-om', name: 'api-lab.css-om', component: CSSObjectModelPage, meta: { title: 'CSS Object Model' } },
  { path: '/api-lab/dom-parsing', name: 'api-lab.dom-parsing', component: DOMParsersXPathPage, meta: { title: 'DOM 解析与 XPath' } },
  { path: '/api-lab/advanced-observer', name: 'api-lab.advanced-observer', component: AdvancedObserverPage, meta: { title: '高级观察器' } },
  { path: '/api-lab/canvas-deep', name: 'api-lab.canvas-deep', component: CanvasDeepPage, meta: { title: 'Canvas 2D 深度' } },
  { path: '/api-lab/svg-deep', name: 'api-lab.svg-deep', component: SVGDeepPage, meta: { title: 'SVG 矢量深度' } },
  { path: '/api-lab/service-worker', name: 'api-lab.service-worker', component: ServiceWorkerPage, meta: { title: 'Service Worker' } },
  { path: '/api-lab/web-components-deep', name: 'api-lab.web-components-deep', component: WebComponentsDeepPage, meta: { title: 'Web Components 深度' } },
  { path: '/api-lab/hardware-devices', name: 'api-lab.hardware-devices', component: HardwareDevicesPage, meta: { title: '硬件设备 API' } },
  { path: '/api-lab/file-system-access', name: 'api-lab.file-system-access', component: FileSystemAccessPage, meta: { title: '文件系统访问' } },
  { path: '/api-lab/streams-fetch', name: 'api-lab.streams-fetch', component: StreamsFetchDeepPage, meta: { title: '流与 Fetch 深度' } },
  { path: '/api-lab/window-manager', name: 'api-lab.window-manager', component: WindowManagerPage, meta: { title: '窗口管理' } },
  { path: '/api-lab/async-cookbook', name: 'api-lab.async-cookbook', component: AsyncCookbookPage, meta: { title: '异步编程手册' } },
  { path: '/api-lab/drag-drop', name: 'api-lab.drag-drop', component: DragDropDeepPage, meta: { title: '拖拽 API 深度' } },
  { path: '/api-lab/selection-clipboard', name: 'api-lab.selection-clipboard', component: SelectionClipboardPage, meta: { title: '选区与剪贴板' } },
  { path: '/api-lab/speech-codecs', name: 'api-lab.speech-codecs', component: SpeechCodecsPage, meta: { title: '语音与编解码' } },
  { path: '/api-lab/webgpu-transitions', name: 'api-lab.webgpu-transitions', component: WebGPUViewTransitionsPage, meta: { title: 'WebGPU 与过渡' } },
  { path: '/api-lab/css-houdini', name: 'api-lab.css-houdini', component: CSSHoudiniPage, meta: { title: 'CSS Houdini' } },
  { path: '/api-lab/advanced-network', name: 'api-lab.advanced-network', component: AdvancedNetworkPage, meta: { title: '高级网络 API' } },
  { path: '/api-lab/scheduler-tasks', name: 'api-lab.scheduler-tasks', component: SchedulerTasksPage, meta: { title: '任务调度与压力' } },
  { path: '/api-lab/navigation-api', name: 'api-lab.navigation-api', component: NavigationAPIDeepPage, meta: { title: 'Navigation API' } },
  { path: '/api-lab/share-contacts', name: 'api-lab.share-contacts', component: WebShareContactsPage, meta: { title: '分享与联系人' } },
  { path: '/api-lab/advanced-input', name: 'api-lab.advanced-input', component: AdvancedInputPage, meta: { title: '高级输入与取色' } },
  { path: '/api-lab/shared-memory', name: 'api-lab.shared-memory', component: SharedMemoryAtomicsPage, meta: { title: '共享内存与原子' } },
  { path: '/api-lab/barcode-screen', name: 'api-lab.barcode-screen', component: BarcodeScreenCapturePage, meta: { title: '条码与屏幕捕获' } },
  { path: '/api-lab/reporting-trusted', name: 'api-lab.reporting-trusted', component: ReportingTrustedTypesPage, meta: { title: '报告与可信类型' } },
  { path: '/api-lab/es2024', name: 'api-lab.es2024', component: ModernES2024Page, meta: { title: 'ES2024 新特性' } },
  { path: '/api-lab/webgpu-compute', name: 'api-lab.webgpu-compute', component: WebGPUComputePage, meta: { title: 'WebGPU 计算管线' } },
  { path: '/api-lab/worker-advanced', name: 'api-lab.worker-advanced', component: WorkerAdvancedPage, meta: { title: 'Worker 高级' } },
  { path: '/api-lab/storage-access', name: 'api-lab.storage-access', component: StorageAccessMultiOriginPage, meta: { title: '存储访问与多源' } },
  { path: '/api-lab/webauthn', name: 'api-lab.webauthn', component: WebAuthDeepPage, meta: { title: 'WebAuthn 深度' } },
  { path: '/api-lab/webrtc-deep', name: 'api-lab.webrtc-deep', component: WebRTCDeepPage, meta: { title: 'WebRTC 深入' } },
  { path: '/api-lab/css-advanced-features', name: 'api-lab.css-advanced-features', component: CSSAdvancedFeaturesPage, meta: { title: 'CSS 高级特性' } },
  { path: '/api-lab/payment-fedcm', name: 'api-lab.payment-fedcm', component: PaymentFedCMPage, meta: { title: '支付与 FedCM' } },
  { path: '/api-lab/url-encoding-deep', name: 'api-lab.url-encoding-deep', component: URLEncodingDeepPage, meta: { title: 'URL 与编码深入' } },
  { path: '/api-lab/builtin-ai', name: 'api-lab.builtin-ai', component: BuiltInAIPage, meta: { title: '内置 AI 与 WebNN' } },
  { path: '/api-lab/privacy-sandbox-deep', name: 'api-lab.privacy-sandbox-deep', component: PrivacySandboxDeepPage, meta: { title: '隐私沙盒深入' } },
  { path: '/api-lab/window-pip-viewport', name: 'api-lab.window-pip-viewport', component: WindowPiPViewportPage, meta: { title: '画中画与视口' } },
  { path: '/api-lab/midi-nfc-gamepad', name: 'api-lab.midi-nfc-gamepad', component: WebMIDINFCGamepadPage, meta: { title: 'MIDI/NFC/手柄' } },
  { path: '/api-lab/local-fonts-deep', name: 'api-lab.local-fonts-deep', component: LocalFontsDeepPage, meta: { title: '本地字体与加载' } },
  { path: '/api-lab/editing-input-events', name: 'api-lab.editing-input-events', component: EditingInputEventsPage, meta: { title: '编辑与输入事件' } },
  { path: '/api-lab/speculation-rules', name: 'api-lab.speculation-rules', component: SpeculationRulesFetchPriorityPage, meta: { title: '推测规则与优先级' } },
  { path: '/api-lab/content-index-offline', name: 'api-lab.content-index-offline', component: ContentIndexOfflinePage, meta: { title: '内容索引与离线' } },
  { path: '/api-lab/css-scroll-layout', name: 'api-lab.css-scroll-layout', component: CSSScrollLayoutPage, meta: { title: 'CSS 滚动与布局' } },
  { path: '/api-lab/storage-buckets-cookie-store', name: 'api-lab.storage-buckets-cookie-store', component: StorageBucketsCookieStorePage, meta: { title: '存储桶与 CookieStore' } },
  { path: '/api-lab/soft-navigation', name: 'api-lab.soft-navigation', component: SoftNavigationPage, meta: { title: '软导航' } },
  { path: '/api-lab/webgl-advanced', name: 'api-lab.webgl-advanced', component: WebGLAdvancedPage, meta: { title: 'WebGL2 高级特性' } },
  { path: '/api-lab/view-transitions-l2', name: 'api-lab.view-transitions-l2', component: ViewTransitionsL2Page, meta: { title: '跨文档视图过渡' } },
  { path: '/api-lab/css-text-advanced', name: 'api-lab.css-text-advanced', component: CSSTextAdvancedPage, meta: { title: 'CSS 文本高级排版' } },
  { path: '/api-lab/fetch-later', name: 'api-lab.fetch-later', component: FetchLaterAPIPage, meta: { title: 'fetchLater 与遥测' } },
  { path: '/api-lab/web-components-advanced', name: 'api-lab.web-components-advanced', component: WebComponentsAdvancedPage, meta: { title: 'Web Components 高级' } },
  { path: '/api-lab/intersection-observer-v2', name: 'api-lab.intersection-observer-v2', component: IntersectionObserverV2Page, meta: { title: 'IntersectionObserver v2' } },
  { path: '/api-lab/web-locks', name: 'api-lab.web-locks', component: WebLocksAPIPage, meta: { title: 'Web Locks API' } },
  { path: '/api-lab/css-starting-style', name: 'api-lab.css-starting-style', component: CSSStartingStylePage, meta: { title: 'CSS @starting-style' } },
  { path: '/api-lab/webgpu-storage-texture', name: 'api-lab.webgpu-storage-texture', component: WebGPUStorageTexturePage, meta: { title: 'WebGPU StorageTexture' } },
  { path: '/api-lab/webgpu-render-pipeline', name: 'api-lab.webgpu-render-pipeline', component: WebGPURenderPipelinePage, meta: { title: 'WebGPU 渲染管线' } },
  { path: '/api-lab/css-container-style-queries', name: 'api-lab.css-container-style-queries', component: CSSContainerStyleQueriesPage, meta: { title: 'CSS 容器样式查询' } },
  { path: '/api-lab/css-logical-layout', name: 'api-lab.css-logical-layout', component: CSSLogicalLayoutPage, meta: { title: 'CSS 逻辑属性与布局' } },
  { path: '/api-lab/canvas-recording', name: 'api-lab.canvas-recording', component: CanvasRecordingPage, meta: { title: 'Canvas 录制与媒体输出' } },
  { path: '/api-lab/css-media-user-preference', name: 'api-lab.css-media-user-preference', component: CSSMediaUserPreferencePage, meta: { title: 'CSS 用户偏好媒体查询' } },
  { path: '/api-lab/invoker-api', name: 'api-lab.invoker-api', component: InvokerAPIPage, meta: { title: 'Invoker 声明式交互' } },
  { path: '/api-lab/form-api-deep', name: 'api-lab.form-api-deep', component: FormAPIDeepPage, meta: { title: '表单 API 深度' } },
  { path: '/api-lab/css-visual-effects', name: 'api-lab.css-visual-effects', component: CSSVisualEffectsPage, meta: { title: 'CSS 视觉效果与合成' } },
  { path: '/api-lab/modern-html', name: 'api-lab.modern-html', component: ModernHTMLPage, meta: { title: '现代 HTML 全局属性' } },
  { path: '/api-lab/capture-advanced', name: 'api-lab.capture-advanced', component: CaptureAdvancedPage, meta: { title: '高级屏幕捕获与剪贴板' } },
  { path: '/api-lab/edit-context-activation', name: 'api-lab.edit-context-activation', component: EditContextActivationPage, meta: { title: 'EditContext 与用户激活' } },
  { path: '/api-lab/css-form-color', name: 'api-lab.css-form-color', component: CSSFormColorPage, meta: { title: 'CSS 表单伪类与颜色空间' } },
  { path: '/api-lab/modern-js-modules', name: 'api-lab.modern-js-modules', component: ModernJSModulesPage, meta: { title: '现代 JS 与模块系统' } },
  { path: '/api-lab/scroll-events', name: 'api-lab.scroll-events', component: ScrollEventsPage, meta: { title: '滚动事件与滚动条' } },
  { path: '/api-lab/temporal-api', name: 'api-lab.temporal-api', component: TemporalAPIPage, meta: { title: 'Temporal 日期时间 API' } },
  { path: '/api-lab/es2025-language', name: 'api-lab.es2025-language', component: ES2025LanguagePage, meta: { title: 'ES2025 语言新特性' } },
  { path: '/api-lab/webassembly-advanced', name: 'api-lab.webassembly-advanced', component: WebAssemblyAdvancedPage, meta: { title: 'WebAssembly 高级 Proposal' } },
  { path: '/api-lab/experimental-web-apis', name: 'api-lab.experimental-web-apis', component: ExperimentalWebAPIsPage, meta: { title: '实验/边缘 Web API' } },
  { path: '/api-lab/css-advanced-properties', name: 'api-lab.css-advanced-properties', component: CSSAdvancedPropertiesPage, meta: { title: 'CSS 高级属性' } },
  { path: '/api-lab/ui-extensions-api', name: 'api-lab.ui-extensions-api', component: UIExtensionsAPIPage, meta: { title: 'UI 扩展与浏览器扩展 API' } },
  { path: '/api-lab/webgpu-advanced-extensions', name: 'api-lab.webgpu-advanced-extensions', component: WebGPUAdvancedExtensionsPage, meta: { title: 'WebGPU 高级扩展与 GPU-Driven 渲染' } },
  { path: '/api-lab/css-conditional-level5', name: 'api-lab.css-conditional-level5', component: CSSConditionalLevel5Page, meta: { title: 'CSS 条件规则 Level 5 与未来提案' } },
  { path: '/api-lab/advanced-web-platform', name: 'api-lab.advanced-web-platform', component: AdvancedWebPlatformPage, meta: { title: 'Web 平台高级特性补遗' } },
  { path: '/api-lab/css-viewport-units-multicol', name: 'api-lab.css-viewport-units-multicol', component: CSSViewportUnitsMulticolPage, meta: { title: 'CSS 视口/容器单位与多栏布局' } },
  { path: '/api-lab/css-generated-content-lists', name: 'api-lab.css-generated-content-lists', component: CSSGeneratedContentListsPage, meta: { title: 'CSS 生成内容与列表样式' } },
  { path: '/api-lab/customizable-select', name: 'api-lab.customizable-select', component: CustomizableSelectAPIPage, meta: { title: '可定制 Select API（OpenUI）' } },
  { path: '/api-lab/html-modern-interactive', name: 'api-lab.html-modern-interactive', component: HTMLModernInteractiveElementsPage, meta: { title: '现代 HTML 交互/语义元素' } },
  { path: '/api-lab/css-font-typography-deep', name: 'api-lab.css-font-typography-deep', component: CSSFontTypographyDeepPage, meta: { title: 'CSS 字体与排版高级' } },
  { path: '/api-lab/css-anchor-positioning-deep', name: 'api-lab.css-anchor-positioning-deep', component: CSSAnchorPositioningDeepPage, meta: { title: 'CSS Anchor Positioning 深度' } },
  { path: '/api-lab/css-custom-highlight', name: 'api-lab.css-custom-highlight', component: CSSCustomHighlightAPIPage, meta: { title: 'CSS Custom Highlight API' } },
  { path: '/api-lab/css-flexbox-deep', name: 'api-lab.css-flexbox-deep', component: CSSFlexboxDeepPage, meta: { title: 'CSS Flexbox 完整深度' } },
  { path: '/api-lab/css-grid-deep', name: 'api-lab.css-grid-deep', component: CSSGridDeepPage, meta: { title: 'CSS Grid 完整深度' } },
  { path: '/api-lab/css-transforms-3d-deep', name: 'api-lab.css-transforms-3d-deep', component: CSSTransforms3DDeepPage, meta: { title: 'CSS Transforms & 3D 深度' } },
  { path: '/api-lab/css-transitions-animations', name: 'api-lab.css-transitions-animations', component: CSSTransitionsAnimationsPage, meta: { title: 'CSS Transitions & Animations' } },
  { path: '/api-lab/css-box-model-positioning', name: 'api-lab.css-box-model-positioning', component: CSSBoxModelPositioningPage, meta: { title: 'CSS 盒模型与定位' } },
  { path: '/api-lab/css-cascade-inheritance-deep', name: 'api-lab.css-cascade-inheritance-deep', component: CSSCascadeInheritanceDeepPage, meta: { title: 'CSS 级联继承与自定义属性' } },
  { path: '/api-lab/css-backgrounds-borders-shadows-deep', name: 'api-lab.css-backgrounds-borders-shadows-deep', component: CSSBackgroundsBordersShadowsDeepPage, meta: { title: 'CSS 背景/边框/阴影深度' } },
  { path: '/api-lab/css-gradients-deep', name: 'api-lab.css-gradients-deep', component: CSSGradientsDeepPage, meta: { title: 'CSS 渐变完整深度' } },
  { path: '/api-lab/css-scroll-driven-animations-deep', name: 'api-lab.css-scroll-driven-animations-deep', component: CSSScrollDrivenAnimationsDeepPage, meta: { title: 'CSS 滚动驱动动画' } },
  { path: '/api-lab/css-clip-path-deep', name: 'api-lab.css-clip-path-deep', component: CSSClipPathDeepPage, meta: { title: 'CSS clip-path 剪裁深度' } },
  { path: '/api-lab/css-nesting-scope-deep', name: 'api-lab.css-nesting-scope-deep', component: CSSNestingScopeDeepPage, meta: { title: 'CSS 嵌套与作用域' } },
  { path: '/api-lab/css-view-transitions-deep', name: 'api-lab.css-view-transitions-deep', component: CSSViewTransitionsDeepPage, meta: { title: 'CSS 视图过渡（同文档）' } },
  { path: '/api-lab/css-masking-compositing-deep', name: 'api-lab.css-masking-compositing-deep', component: CSSMaskingCompositingDeepPage, meta: { title: 'CSS 遮罩与合成' } },
  { path: '/api-lab/web-notifications-push-deep', name: 'api-lab.web-notifications-push-deep', component: WebNotificationsPushDeepPage, meta: { title: 'Web 通知与推送' } },
  { path: '/api-lab/css-houdini-worklets-deep', name: 'api-lab.css-houdini-worklets-deep', component: CSSHoudiniWorkletsDeepPage, meta: { title: 'CSS Houdini Worklets' } },
  { path: '/api-lab/web-speech-api-deep', name: 'api-lab.web-speech-api-deep', component: WebSpeechAPIDeepPage, meta: { title: 'Web Speech 语音合成与识别' } },
  { path: '/api-lab/pointer-touch-events-deep', name: 'api-lab.pointer-touch-events-deep', component: PointerTouchEventsDeepPage, meta: { title: 'Pointer & Touch 事件' } },
  { path: '/api-lab/rtc-encoded-transform', name: 'api-lab.rtc-encoded-transform', component: RTCEncodedTransformPage, meta: { title: 'RTCEncodedTransform' } },
  { path: '/api-lab/css-table-layout-deep', name: 'api-lab.css-table-layout-deep', component: CSSTableLayoutDeepPage, meta: { title: 'CSS Table Layout' } },
  { path: '/api-lab/spatial-audio-deep', name: 'api-lab.spatial-audio-deep', component: SpatialAudioDeepPage, meta: { title: 'Spatial Audio' } },
  { path: '/api-lab/web-smart-card-api', name: 'api-lab.web-smart-card-api', component: WebSmartCardAPIPage, meta: { title: 'Web Smart Card API' } },
  { path: '/api-lab/writing-suggestions-api', name: 'api-lab.writing-suggestions-api', component: WritingSuggestionsAPIPage, meta: { title: 'Writing Suggestions API' } },
  { path: '/api-lab/css-ruby-deep', name: 'api-lab.css-ruby-deep', component: CSSRubyDeepPage, meta: { title: 'CSS Ruby 注音排版' } },
  { path: '/api-lab/dom-parts-api', name: 'api-lab.dom-parts-api', component: DOMPartsAPIPage, meta: { title: 'DOM Parts API' } },
  { path: '/api-lab/async-context', name: 'api-lab.async-context', component: AsyncContextPage, meta: { title: 'AsyncContext 异步上下文' } },
  { path: '/api-lab/websocket-stream', name: 'api-lab.websocket-stream', component: WebSocketStreamPage, meta: { title: 'WebSocketStream 背压' } },
  { path: '/api-lab/html-media-element-advanced', name: 'api-lab.html-media-element-advanced', component: HTMLMediaElementAdvancedPage, meta: { title: 'HTMLMediaElement 高级' } },
  { path: '/api-lab/webxr-advanced', name: 'api-lab.webxr-advanced', component: WebXRAdvancedPage, meta: { title: 'WebXR 高级特性' } },
  { path: '/api-lab/intl-enumeration', name: 'api-lab.intl-enumeration', component: IntlEnumerationPage, meta: { title: 'Intl Enumeration' } },
  { path: '/api-lab/css-inline-layout', name: 'api-lab.css-inline-layout', component: CSSInlineLayoutPage, meta: { title: 'CSS Inline Layout' } },
  { path: '/api-lab/css-resize', name: 'api-lab.css-resize', component: CSSResizePage, meta: { title: 'CSS Resize' } },
  { path: '/api-lab/media-track-constraints', name: 'api-lab.media-track-constraints', component: MediaTrackConstraintsPage, meta: { title: 'MediaTrackConstraints' } },
  { path: '/api-lab/webtransport', name: 'api-lab.webtransport', component: WebTransportPage, meta: { title: 'WebTransport HTTP/3' } },
  { path: '/api-lab/webnn-api', name: 'api-lab.webnn-api', component: WebNNAPIPage, meta: { title: 'WebNN API 神经网络推理' } },
  { path: '/api-lab/webassembly-gc-control-flow', name: 'api-lab.webassembly-gc-control-flow', component: WebAssemblyGcControlFlowPage, meta: { title: 'WASM GC/EH/Tail Call 提案' } },
  { path: '/api-lab/css-color-hdr-deep', name: 'api-lab.css-color-hdr-deep', component: CSSColorHDRDeepPage, meta: { title: 'CSS Color Level 4/5 与 HDR' } },
  { path: '/api-lab/css-cascade-layers', name: 'api-lab.css-cascade-layers', component: CSSCascadeLayersPage, meta: { title: 'CSS Cascade Layers @layer' } },
  { path: '/api-lab/css-performance-layout', name: 'api-lab.css-performance-layout', component: CSSPerformanceLayoutPage, meta: { title: 'CSS Containment + Content Visibility + Masonry' } },
  { path: '/api-lab/css-scroll-snap', name: 'api-lab.css-scroll-snap', component: CSSScrollSnapPage, meta: { title: 'CSS Scroll Snap Module' } },
  { path: '/api-lab/css-writing-modes', name: 'api-lab.css-writing-modes', component: CSSWritingModesPage, meta: { title: 'CSS Writing Modes Level 3/4' } },
  { path: '/api-lab/css-counter-styles', name: 'api-lab.css-counter-styles', component: CSSCounterStylesPage, meta: { title: 'CSS Counter Styles @counter-style' } },
  { path: '/api-lab/css-functions-deep', name: 'api-lab.css-functions-deep', component: CSSFunctionsDeepPage, meta: { title: 'CSS Easing + Math Functions' } },
  { path: '/api-lab/media-streaming-drm', name: 'api-lab.media-streaming-drm', component: MediaStreamingDRMPage, meta: { title: 'MSE + EME 流媒体与 DRM' } },
  { path: '/api-lab/web-translation-api', name: 'api-lab.web-translation-api', component: WebTranslationAPIPage, meta: { title: 'Translation + Language Detector API' } },
  { path: '/api-lab/compression-streams', name: 'api-lab.compression-streams', component: CompressionStreamPage, meta: { title: 'Compression Streams API' } },
  { path: '/api-lab/sanitizer-api', name: 'api-lab.sanitizer-api', component: SanitizerAPIPage, meta: { title: 'Sanitizer API HTML 净化' } },
  { path: '/api-lab/webcodecs-api', name: 'api-lab.webcodecs-api', component: WebCodecsAPIPage, meta: { title: 'WebCodecs API 编解码管线' } },
  { path: '/api-lab/compute-pressure-api', name: 'api-lab.compute-pressure-api', component: ComputePressureAPIPage, meta: { title: 'Compute Pressure API' } },
  { path: '/api-lab/css-shapes', name: 'api-lab.css-shapes', component: CSSShapesPage, meta: { title: 'CSS Shapes Module Level 1' } },
  { path: '/api-lab/pointer-lock-api', name: 'api-lab.pointer-lock-api', component: PointerLockAPIPage, meta: { title: 'Pointer Lock API 鼠标锁定' } },
  { path: '/api-lab/web-otp-api', name: 'api-lab.web-otp-api', component: WebOTPAPIPage, meta: { title: 'WebOTP API 短信验证码' } },
  { path: '/api-lab/decorators-resource-management', name: 'api-lab.decorators-resource-management', component: DecoratorsResourceManagementPage, meta: { title: 'TC39 装饰器与资源管理' } },
  { path: '/api-lab/css-motion-path', name: 'api-lab.css-motion-path', component: CSSMotionPathDeepPage, meta: { title: 'CSS Motion Path Module Level 1' } },
  { path: '/api-lab/media-session-api', name: 'api-lab.media-session-api', component: MediaSessionAPIPage, meta: { title: 'Media Session API 媒体会话' } },
  { path: '/api-lab/mathml-core', name: 'api-lab.mathml-core', component: MathMLCorePage, meta: { title: 'MathML Core 数学公式渲染' } },

  { path: '/about', name: 'about', component: AboutPage, meta: { title: '关于' } },
  { path: '*', name: 'not-found', component: NotFoundPage, meta: { title: '404' } },
];