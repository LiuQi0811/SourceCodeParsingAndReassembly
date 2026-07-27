// =====================================================================
// globals.d.ts —— 全局 Web API 类型声明（实验性 / 前缀 / 未在标准 lib 中暴露的 API）
// 仅用于让严格模式编译通过；所有声明均显式标注为 any 以避免误用强类型。
// =====================================================================

// —— 1) 未在标准 DOM lib 中暴露的「实验性 Web 平台 API」构造器 / 全局对象 ——
declare class BarcodeDetector {
  constructor(init?: { formats?: string[] });
  detect(source?: any): Promise<any[]>;
  static getSupportedFormats(): Promise<string[]>;
}
declare class PressureObserver {
  constructor(cb: (changes: any[]) => void, options?: any);
  observe(source: any, options?: any): Promise<void>;
  unobserve(source: any): void;
  disconnect(): void;
  static supportedSources: ReadonlyArray<string>;
  static knownSources: ReadonlyArray<string>;
  takeRecords?(): any[];
}
declare class CaptureController {
  constructor();
  forwardWheel?(el: HTMLElement): Promise<void>;
  setBehavior?(behavior: string): void;
}
declare class RestrictionTarget {
  static fromElement?(el: HTMLElement): Promise<RestrictionTarget>;
  static fromRect?(rect: any): Promise<RestrictionTarget>;
}
declare class IdleDetector {
  constructor(options?: any);
  start(options?: any): Promise<void>;
  stop?(): void;
  onstatechange: ((this: IdleDetector, ev: Event) => any) | null;
  onthreshold: ((this: IdleDetector, ev: Event) => any) | null;
  readonly userState: string;
  readonly screenState: string;
  threshold: number;
  addEventListener?(type: string, listener: any, options?: any): void;
  removeEventListener?(type: string, listener: any, options?: any): void;
  static requestPermission?(): Promise<string>;
}
declare class SpeechRecognition {
  constructor();
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
}
declare class webkitSpeechRecognition extends SpeechRecognition {}
declare class webkitAudioContext extends AudioContext {}

// —— Built-in AI APIs ——
declare class Translator {
  static create(options?: any): Promise<Translator>;
  translate(text: string, options?: any): Promise<string>;
  destroy?(): void;
}
declare class LanguageDetector {
  static create(options?: any): Promise<LanguageDetector>;
  detect(text: string): Promise<any[]>;
  destroy?(): void;
  static availability(options?: any): Promise<string>;
}
declare class LanguageModel {
  static create(options?: any): Promise<LanguageModel>;
  prompt(input: string | any, options?: any): Promise<string | any>;
  promptStreaming(input: string | any, options?: any): Promise<AsyncIterable<string>>;
  destroy?(): void;
  static availability(options?: any): Promise<string>;
}
declare class Summarizer {
  static create(options?: any): Promise<Summarizer>;
  summarize(input: string, options?: any): Promise<string>;
  summarizeStreaming(input: string, options?: any): Promise<AsyncIterable<string>>;
  destroy?(): void;
  static availability(options?: any): Promise<string>;
}
declare class Rewriter {
  static create(options?: any): Promise<Rewriter>;
  rewrite(input: string, options?: any): Promise<string>;
  rewriteStreaming(input: string, options?: any): Promise<AsyncIterable<string>>;
  destroy?(): void;
  static availability(options?: any): Promise<string>;
}
declare class Writer {
  static create(options?: any): Promise<Writer>;
  write(input: string, options?: any): Promise<string>;
  writeStreaming(input: string, options?: any): Promise<AsyncIterable<string>>;
  destroy?(): void;
  static availability(options?: any): Promise<string>;
}

// —— Credentials ——
declare class PasswordCredential {
  constructor(data: any);
  id: string;
  password: string;
  name?: string;
  iconURL?: string;
}
declare class OTPCredential {
  constructor(data?: any);
  code: string;
}

// —— WebNN ——
declare class MLGraphBuilder {
  constructor(context?: any);
  input(name: string, desc?: any): any;
  constant(desc: any, value?: any): any;
  build(output: any): any;
  add(a: any, b: any): any;
  sub(a: any, b: any): any;
  mul(a: any, b: any): any;
  div(a: any, b: any): any;
  matmul(a: any, b: any): any;
  relu(input: any): any;
  sigmoid(input: any): any;
  tanh(input: any): any;
  softmax(input: any): any;
  conv2d(input: any, filter: any, options?: any): any;
  averagePool2d(input: any, options?: any): any;
  maxPool2d(input: any, options?: any): any;
  reshape(input: any, shape: number[]): any;
  transpose(input: any, permutation: number[]): any;
  gemm(a: any, b: any, options?: any): any;
}
declare interface MLContext {}
declare interface MLGraph {}

// —— WebGPU namespace enums（部分浏览器未在 lib.dom 中暴露）——
declare const GPUBufferUsage: {
  MAP_READ: number; MAP_WRITE: number; COPY_SRC: number; COPY_DST: number;
  INDEX: number; VERTEX: number; UNIFORM: number; STORAGE: number;
  INDIRECT: number; QUERY_RESOLVE: number;
};
declare const GPUTextureUsage: {
  COPY_SRC: number; COPY_DST: number; TEXTURE_BINDING: number;
  STORAGE_BINDING: number; RENDER_ATTACHMENT: number;
};

// —— WebXR ——
declare class XRSession { /* opaque, accessed via any */ }
declare class XRAnchor { /* opaque */ }
declare class XRHitTestResult { /* opaque */ }
declare class XRHitTestSource { /* opaque */ }
declare class XRLayer { /* opaque */ }
declare class XRProjectionLayer { /* opaque */ }
declare class XRQuadLayer { /* opaque */ }
declare class XRCylinderLayer { /* opaque */ }
declare class XREquirectLayer { /* opaque */ }
declare class XRCubeLayer { /* opaque */ }
declare class XRWebGLLayer {
  constructor(session: any, context: any, options?: any);
}
declare interface XRDOMOverlayState { root: HTMLElement; }

// —— DOM Parts API ——
declare class Part { /* opaque */ }
declare class ChildNodePart extends Part {}
declare class AttrPart extends Part {}
declare class BooleanPart extends Part {}
declare class EventPart extends Part {}
declare class PropertyPart extends Part {}
declare class PartGroup extends Part {}
declare class DocumentPartRoot extends Part {}
declare class TemplateInstance { /* opaque */ }

// —— ShadowRealm (ES2025) ——
declare class ShadowRealm {
  constructor();
  evaluate(sourceText: string): any;
  importValue(specifier: string, bindingName: string): Promise<any>;
}

// —— SuppressedError / DisposableStack (ES2024-2025) ——
declare class SuppressedError extends Error {
  constructor(error: any, suppressed: any, message?: string);
  error: any;
  suppressed: any;
}
declare class DisposableStack implements AsyncDisposable, Disposable {
  constructor();
  use<T>(value: T | null | undefined): T;
  adopt<T>(value: T, onDispose: (value: T) => void): T;
  defer(onDispose: () => void): void;
  move(): DisposableStack;
  disposeAsync?(): Promise<void>;
  [Symbol.dispose](): void;
  [Symbol.asyncDispose](): Promise<void>;
}

// —— SharedStruct / Float16Array ——
declare const SharedStruct: any;
declare class Float16Array {
  constructor(length?: number | any[]);
  static BYTES_PER_ELEMENT: number;
  length: number;
  [index: number]: number;
  buffer: ArrayBufferLike;
  set(values: ArrayLike<number>, offset?: number): void;
  subarray(begin?: number, end?: number): Float16Array;
}

// —— WebSocketStream ——
declare class WebSocketStream {
  constructor(url: string | URL, options?: any);
  readonly url: string;
  readonly closed: Promise<{ code: number; reason: string }>;
  readonly opened: Promise<{ readable: any; writable: any; extensions: string; protocol: string }>;
  close(closeInfo?: { code?: number; reason?: string }): void;
}

// —— Web MIDI / NFC ——
declare class NDEFReader {
  constructor();
  scan(options?: any): Promise<void>;
  write(message: any, options?: any): Promise<void>;
  onreading: ((this: NDEFReader, ev: Event) => any) | null;
  onreadingerror: ((this: NDEFReader, ev: Event) => any) | null;
}
declare interface NDEFMessage { records: any[]; }

// —— Houdini Worklet Animation ——
declare class WorkletAnimation {
  constructor(name: string, keyframes: any[], timelines?: any[], options?: any);
  play(): void;
  cancel(): void;
}

// —— MediaStreamTrackGenerator ——
declare class MediaStreamTrackGenerator {
  constructor(options?: any);
  readonly kind: string;
  readonly track: any;
  writable: any;
}

// —— 2) Window / Navigator / Document / Screen 实验性属性扩展 ——
interface Window {
  documentPictureInPicture?: any;
  visualViewport?: any;
  webkitSpeechRecognition?: any;
  webkitAudioContext?: typeof AudioContext;
  SpeechRecognition?: any;
  ai?: any;
  ml?: any;
  sharedStruct?: any;
  trustedTypes?: any;
  getScreenDetails?: () => Promise<any>;
  sharedStorage?: any;
  launchQueue?: any;
  digitalGoods?: any;
  LanguageDetector?: any;
  Translator?: any;
  Summarizer?: any;
  LanguageModel?: any;
  Writer?: any;
  Rewriter?: any;
  MLGraphBuilder?: any;
  MLContext?: any;
  MLGraph?: any;
  MLCompiledModel?: any;
  WebTransportSendStream?: any;
  WebTransportReceiveStream?: any;
  NDEFReader?: any;
  OTPCredential?: any;
  PressureObserver?: any;
  digitalGoodsService?: any;
  scheduler?: any;
  AbsoluteOrientationSensor?: any;
  RelativeOrientationSensor?: any;
  Gyroscope?: any;
  Accelerometer?: any;
  GravitySensor?: any;
  LinearAccelerationSensor?: any;
  Magnetometer?: any;
  AmbientLightSensor?: any;
  BarcodeDetector?: any;
  CaptureController?: any;
  EyeDropper?: any;
  FaceDetector?: any;
  TextDetector?: any;
  IdleDetector?: any;
  USB?: any;
  Serial?: any;
  Bluetooth?: any;
  HID?: any;
  Crypto?: any;
  documentPictureInPicture?: any;
}
interface Navigator {
  wakeLock?: any;
  virtualKeyboard?: any;
  ai?: any;
  ml?: any;
  midi?: { requestAccess: (sysex: boolean) => Promise<any> };
  usb?: any;
  serial?: any;
  hid?: any;
  bluetooth?: any;
  clipboard?: any;
  credentials?: any;
  geolocation?: any;
  mediaDevices?: any;
  gpu?: any;
  xr?: any;
  lockScreen?: any;
  managed?: any;
  deviceMemory?: number;
  contacts?: any;
  connection?: any;
  windowControlsOverlay?: any;
  presentation?: any;
  ink?: any;
  userAgentData?: any;
  taintEnabled?: any;
  globalPrivacyControl?: any;
  scheduling?: any;
  serviceWorker?: any;
  storage?: any;
  storageBuckets?: any;
  keyboard?: any;
  smartCard?: any;
  browsingTopics?: any;
  audioSession?: any;
  highDynamicRange?: any;
  runAdAuction?(config?: any): Promise<any>;
  joinAdInterestGroup?(config?: any): Promise<void>;
  leaveAdInterestGroup?(config?: any): Promise<void>;
  digitalGoodsService?: any;
  requestMIDIAccess?(options?: any): Promise<any>;
  getGamepads?(): any[];
  setSinkId?(sinkId: string): Promise<void>;
  wakeLock?: any;
  presentation?: any;
}
interface Screen {
  orientation?: any;
  isExtended?: boolean;
}
interface Document {
  pictureInPictureElement?: Element | null;
  pictureInPictureEnabled?: boolean;
  exitPictureInPicture?(): Promise<void>;
  pictureInPictureElement?: Element | null;
  featurePolicy?: any;
  policy?: any;
  permissions?: any;
  domain?: string;
}
interface HTMLIFrameElement {
  permissionsPolicy?: any;
  featurePolicy?: any;
}
interface Performance {
  measureUserAgentSpecificMemory?: () => Promise<any>;
}
interface HTMLCanvasElement {
  captureStream?(frameRate?: number): MediaStream;
  transferControlToOffscreen?(): OffscreenCanvas;
}
interface HTMLMediaElement {
  captureStream?(): MediaStream;
}
interface MediaRecorder {
  requestData?(): void;
}
interface Crypto {
  getRandomValues?<T extends ArrayBufferView>(array: T): T;
}
interface HTMLTemplateElement {
  createInstance?(options?: any): any;
}
interface HTMLDivElement {
  getPartRoot?(): any;
}
interface CSSRule {
  name?: string;
}
interface Credential {
  code?: string;
}
// NOTE: HTMLCanvasElement / HTMLMediaElement augmentation intentionally omitted;
// calls to .captureStream() etc. on canvas/video are typed via `any` casts at call sites.
interface HTMLElement {
  requestPictureInPicture?(): Promise<any>;
  toggleOpen?(open?: boolean): void;
  attachInternals?(): ElementInternals;
}
interface Element {
  attachInternals?(): ElementInternals;
  dataset?: any;
  style?: any;
  value?: any;
  offsetWidth?: number;
  offsetHeight?: number;
  offsetTop?: number;
  offsetLeft?: number;
  href?: string;
  scrollIntoViewIfNeeded?(centerIfNeeded?: boolean): void;
  attributeStyleMap?: any;
  getPartRoot?(): any;
  createChildNodePart?(node: Node, ref?: Node | null): any;
  width?: number;
  height?: number;
  getContext?(contextId: string, ...args: any[]): any;
  showModal?(): void;
  showPopover?(): void;
  hidePopover?(): void;
  setSinkId?(sinkId: string): Promise<void>;
  processCallback?(...args: any[]): void;
}
interface HTMLTemplateElement {
  processCallback?(...args: any[]): void;
}
interface RadioNodeList {
  value: any;
}
interface CaptureController {
  cropTo?(rect: any): Promise<void>;
  setFocus?(focus: any): void;
  setDisplaySurface?(surface: any): void;
}
interface Headers {
  getAll?(name: string): string[];
}
interface PerformanceEntry {
  responseStart?: number;
  responseEnd?: number;
  requestStart?: number;
  domComplete?: number;
  domContentLoadedEventEnd?: number;
  domContentLoadedEventStart?: number;
  loadEventEnd?: number;
  loadEventStart?: number;
  transferSize?: number;
  encodedBodySize?: number;
  decodedBodySize?: number;
  initiatorType?: string;
  nextHopProtocol?: string;
}
interface ImageDecodeResult {
  codedWidth?: number;
  codedHeight?: number;
  format?: any;
  timestamp?: number;
  duration?: number;
  allocationSize?: any;
  close?(): void;
}
interface ImageTrack {
  type?: string;
}
interface RTCRtpSender {
  createEncodedStreams?(): any;
  createEncodedAudioStreams?(): any;
  createEncodedVideoStreams?(): any;
}
interface RTCRtpScriptTransform {
  name?: string;
}
interface PermissionDescriptor {
  name?: any;
}
interface CredentialRequestOptions {
  otp?: any;
}
interface CredentialCreationOptions {
  password?: any;
}
interface FormDataEntryValue {
  type?: string;
  size?: number;
  name?: string;
}
interface Request {
  duplex?: any;
}
interface MediaTrackSettings {
  cursor?: string;
}
interface CookieListItem {
  domain?: string;
  path?: string;
}
interface Event {
  data?: any;
  origin?: string;
  window?: Window;
}
interface VideoEncoder {
  static isTypeSupported?(type: string): boolean;
}
interface VideoDecoder {
  static isTypeSupported?(type: string): boolean;
}
interface PublicKeyCredential {
  static isExternalSignalCTAPBridgingAvailable?(): Promise<boolean>;
}
interface ElementDefinitionOptions {
  formAssociated?: boolean;
}
interface CSS {
  numericOutputValues?: any;
  highlight?(highlights: Record<string, any>): void;
  registerProperty?(definition: any): void;
  paintWorklet?: { addModule: (url: string) => Promise<void> };
  animationWorklet?: { addModule: (url: string) => Promise<void> };
  layoutWorklet?: { addModule: (url: string) => Promise<void> };
  supportsProperty?(property: string): boolean;
  supports?(property: string, value: string): boolean;
  supports?(conditionText: string): boolean;
}
interface GlobalEventHandlers {
  onscrollend?: ((this: Window, ev: Event) => any) | null;
  onpointerrawupdate?: ((this: Window, ev: Event) => any) | null;
}

interface MediaSession {
  cameraAction?: string;
}
interface MediaTrackSupportedConstraints {
  voiceIsolation?: boolean;
  latency?: boolean;
}
interface Navigator {
  unregisterProtocolHandler?(scheme: string, url: string): Promise<void>;
  registerProtocolHandler?(scheme: string, url: string): Promise<void>;
}
interface PerformanceEntry {
  type?: string;
}

// —— 3) fetchLater global function (Fetch Later API) ——
declare function fetchLater(input: any, init?: any): any;

