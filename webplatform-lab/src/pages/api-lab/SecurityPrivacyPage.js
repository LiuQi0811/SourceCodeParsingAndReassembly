// =====================================================================
// SecurityPrivacyPage.js —— Web 安全与隐私 API 实验室
// 演示 MDN：
//   1. Content Security Policy (CSP) + Subresource Integrity (SRI)
//        —— securitypolicyviolation 事件 / SecurityPolicyViolationEvent
//   2. Cross-Origin 隔离机制 —— CORS / COOP / COEP / CORP / crossOriginIsolated
//   3. Storage Access API + Permissions Policy —— hasStorageAccess / requestStorageAccess / permissions.query
//   4. Trusted Types + Sanitizer API —— trustedTypes.createPolicy / new Sanitizer / setHTML
//   5. Cookie 与 Privacy Sandbox —— Set-Cookie 属性 / Topics / Protected Audience / Fetch Metadata
//   6. Permissions Policy 专题 —— 原 Feature Policy / Permissions-Policy HTTP 头 / iframe allow /
//        document.featurePolicy / document.policy / 第三方 iframe 沙箱 / 自家策略 / 陷阱
// 安全说明：本页只展示防御机制（如何启用、如何读取、如何监听），
//           不演示任何真实 XSS 攻击或绕过手法。
// 兼容性：jsdom 中绝大多数安全 API 不可用；所有调用前均做 typeof / in
//         能力检测，不可用时仅记日志，绝不抛异常。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// —— 示例常量（HTTP 头 / meta 标签 / 代码片段，仅在 <pre><code> 中展示）——

const CSP_META_EXAMPLE =
`<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self' 'nonce-abc123' 'sha256-...';
               style-src 'self' 'unsafe-inline';
               img-src 'self' data: https:;
               connect-src 'self' https://api.example.com;
               font-src 'self' https://fonts.gstatic.com;
               media-src 'self';
               frame-src 'none';
               object-src 'none';
               manifest-src 'self';
               worker-src 'self';
               report-uri /csp-report;
               report-to csp-endpoint">`;

const SRI_EXAMPLE =
`<!-- script/link 标签的 SRI 完整示例 -->
<script src="https://cdn.example.com/lib.js"
        integrity="sha384-OvE5z53C+k8YPPLn8F9k+6xJ7vB..."
        crossorigin="anonymous"></script>

<link rel="stylesheet"
      href="https://cdn.example.com/style.css"
      integrity="sha384-..."
      crossorigin="anonymous">`;

const CSP_REPORT_EXAMPLE =
`// report-uri / report-to 端点接收 POST application/csp-report
POST /csp-report HTTP/1.1
Content-Type: application/csp-report

{
  "csp-report": {
    "document-uri": "https://app.example.com/page",
    "violated-directive": "script-src-elem",
    "effective-directive": "script-src-elem",
    "blocked-uri": "https://evil.example.com/attack.js",
    "line-number": 42,
    "column-number": 8,
    "source-file": "https://app.example.com/page",
    "disposition": "enforce",
    "original-policy": "default-src 'self'; script-src 'self'..."
  }
}`;

const COOP_COEP_EXAMPLE =
`# Cross-Origin Isolation 所需的响应头
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
# 资源端需声明 CORP（否则会被 COEP 阻止加载）：
Cross-Origin-Resource-Policy: same-origin

# 启用后浏览器解锁以下高精度 API：
#   self.crossOriginIsolated === true
#   new SharedArrayBuffer(...)
#   performance.measureUserAgentSpecificMemory()`;

const CORS_FETCH_EXAMPLE =
`// 跨域 fetch 的标准配置
fetch('https://api.example.com/data', {
  mode: 'cors',            // 'cors' | 'no-cors' | 'same-origin'
  credentials: 'include',  // 'omit' | 'same-origin' | 'include'
  headers: { 'X-Custom': 'value' }, // 非简单头会触发预检
})
// 服务端响应需返回以下头：
//   Access-Control-Allow-Origin: https://app.example.com  (或 *)
//   Access-Control-Allow-Credentials: true  (include 时不能用 *)
//   Access-Control-Allow-Headers: X-Custom
//   Access-Control-Allow-Methods: GET, POST, OPTIONS
//   Access-Control-Max-Age: 86400`;

const PERMISSIONS_POLICY_EXAMPLE =
`# Permissions-Policy HTTP 头（替代已弃用的 Feature-Policy）
Permissions-Policy: camera=(self "https://trusted.example.com"),
                    microphone=(),
                    geolocation=(self),
                    fullscreen=*,
                    payment=(self "https://checkout.example.com")

<!-- iframe allow 属性（粒度更细，可按源授权） -->
<iframe src="https://embed.example.com"
        allow="camera; microphone; geolocation"
        allowfullscreen></iframe>`;

// —— 以下为 Card 9（Permissions Policy 专题）使用的深度示例 ——

const PP_HTTP_HEADER_SYNTAX =
`# Permissions-Policy HTTP 头语法（取代已弃用的 Feature-Policy）
Permissions-Policy: camera=(self "https://trusted.example.com"),
                    geolocation=(),
                    microphone=*,
                    payment=(self "https://checkout.example.com"),
                    usb=(),
                    web-share=self

# 语法要点：
#   - 多特性之间用逗号 , 分隔
#   - 每个特性名后跟 = 与括号化的源列表 (origin1 origin2 ...)
#   - 源列表关键词：
#       self                 仅同源
#       *                    所有源（开放授权）
#       ()                   空列表（即 none，全禁用）
#       "https://a.com"      显式源（推荐加双引号）
#       https://a.com        显式源（部分浏览器也接受不加引号）
#   - 源之间用空格分隔，整体用 ( ) 包裹 → 形成「嵌套括号」
#   - 未列出的特性按各特性的浏览器默认值（多数为 self）处理
#   - 旧 Feature-Policy 头已弃用：语法为逗号分隔源、整体不括号化
#       Feature-Policy: camera 'self' https://trusted.example.com; microphone 'none'
#     迁移到新头时需把分号分隔特性改为逗号，源列表加括号`;

const PP_IFRAME_ALLOW_ATTR =
`# iframe allow 属性：粒度比 HTTP 头更细，可针对单个 iframe 授权
<iframe src="https://embed.example.com"
        allow="camera; microphone; geolocation; fullscreen"
        allowfullscreen></iframe>

# allow 与 HTTP 头协同关系：
#   1) HTTP 头 Permissions-Policy 是顶层策略基线
#   2) iframe allow 只能在基线允许的范围内进一步放行
#   3) iframe allow 不能解除 HTTP 头中显式禁用（ () ）的特性
#   4) srcdoc iframe 也可用 allow；其继承父文档策略基线
#   5) 多特性用分号 ; 或空格分隔（推荐分号更清晰）
#
# 旧属性 → 新特性名映射：
allowfullscreen   →  fullscreen      # 历史遗留属性，新代码用 allow="fullscreen"
allowpayment      →  payment          # 已弃用别名，避免使用
allowusermedia    →  camera; microphone  # 已弃用别名`;

const PP_FEATURES_LIST =
`# Permissions Policy 支持的特性全集（50+ 项，节选）
# 媒体 / 输入 / 显示：
camera, microphone, geolocation, display-capture, fullscreen,
picture-in-picture, autoplay, encrypted-media, gamepad
# 支付 / 通信 / 剪贴板：
payment, web-share, web-share-file, clipboard-read, clipboard-write,
storage-access
# 设备传感器：
accelerometer, gyroscope, magnetometer, ambient-light-sensor, sensors
# 蓝牙 / USB / HID / 串口 / NFC：
usb, bluetooth, hid, serial, nfc
# 自动化 / 唤醒 / 字体：
screen-wake-lock, idle-detection, local-fonts
# 性能 / 脚本 / 域行为：
sync-script (禁用同步 <script src>), document-domain,
compute-pressure, unoptimized-images, layout-animations
# 游戏 / XR：
xr-spatial-tracking
# WebAuthn：
publickey-credentials-get, publickey-credentials-create
# 窗口管理 / 输入：
window-management, virtual-keyboard
# Privacy Sandbox（与 Card 5 呼应）：
attribution-reporting, browsing-topics,
join-ad-interest-group, run-ad-auction
# 注：约 50+ 特性，部分仍在实验阶段；
#     完整列表见 https://github.com/w3c/webappsec-permissions-policy/blob/main/features.md`;

const PP_FEATUREPOLICY_JS_API =
`# document.featurePolicy / document.policy JS API
// —— 旧 API（Chrome 仍保留，逐步迁移到 document.policy）——
document.featurePolicy.allowedFeatures()
// => ['camera', 'microphone', 'geolocation', ...]
//    当前文档（顶层）允许使用的特性清单

document.featurePolicy.allowsFeature('camera')
// => true | false（默认对当前文档源判定）

document.featurePolicy.allowsFeature('camera', 'https://other.example.com')
// => true | false（指定 origin 时按其源判定）

document.featurePolicy.features()
// => 浏览器认知的全部特性名清单（与文档策略无关，仅是「全集」）

document.featurePolicy.getAllowlistForFeature('camera')
// => ['self', 'https://trusted.example.com']
//    当前文档对此特性的允许源列表

// —— 新 API（PermissionsPolicy，标准化中）——
document.policy.allowedFeatures()
document.policy.allowsFeature(feature, origin)
document.policy.getAllowlistForFeature(feature)

# 浏览器支持差异：
# - Chrome / Edge 同时支持 document.featurePolicy 与 iframe.permissionsPolicy
# - Firefox 仅部分实现；Safari 较新版本逐步加入
# - 新版 document.policy 仍在标准化中，多数浏览器尚未稳定支持
# - jsdom 中上述 API 均不可用`;

const PP_THIRD_PARTY_SANDBOX =
`# 实战 1：第三方 iframe 沙箱（嵌入不可信内容）
# 1) HTTP 头基线（顶层页面）：禁用全部强力特性，仅允许 self
Permissions-Policy: camera=(), microphone=(), usb=(), bluetooth=(),
                    geolocation=(), payment=(), web-share=(),
                    clipboard-write=(), display-capture=(),
                    sync-script=()

# 2) iframe 自身再约束（与 sandbox 协同）：
<iframe src="https://untrusted.example.com/widget"
        sandbox="allow-scripts"
        allow="fullscreen"
        referrerpolicy="no-referrer"
        csp="default-src 'none'; script-src 'self'"></iframe>

# 3) 配合 CSP frame-src 限制可嵌入的来源：
Content-Security-Policy: frame-src 'self' https://untrusted.example.com;

# sandbox 与 allow 的区别：
#   sandbox   —— HTML 属性，关闭 JS / 表单 / 弹窗 / 同源等基础能力
#   allow(PP) —— HTML 属性，关闭 camera / mic / usb 等设备/隐私类特性
#   两者协同：sandbox 关闭「能力面」，PP 关闭「设备/隐私特性面」`;

const PP_OWN_PAGE_STRATEGY =
`# 实战 2：自家页面策略（禁用强力特性 + 第三方分析白名单）
Permissions-Policy: camera=(self),
                    microphone=(self),
                    geolocation=(self),
                    payment=(self "https://checkout.example.com"),
                    usb=(),
                    bluetooth=(),
                    sync-script=(),                  # 禁止同步 <script src>
                    clipboard-read=(),
                    clipboard-write=(self),
                    browsing-topics=(self "https://analytics.example.com"),
                    join-ad-interest-group=(),
                    run-ad-auction=()

# 与 COOP / COEP 协同（参见 Card 2）：
#   - PP 控制特性授权（哪些 API 可调用）
#   - COOP/COEP 控制跨域隔离（是否达到 crossOriginIsolated）
#   - 启用 crossOriginIsolated 后，SharedArrayBuffer 等高精度 API 才可用
#   - PP 可进一步限制这些特性仅在 self 源启用
#   - 三层叠加：
#       CSP      —— 控制资源来源（script-src/img-src/...）
#       COOP/COEP —— 控制跨域隔离
#       PP       —— 控制特性授权`;

const PP_PITFALLS =
`# Permissions Policy 常见陷阱
1) 特性名映射（旧属性 → 新特性）：
   allowfullscreen → fullscreen
   allowpayment   → payment（已弃用别名）
   内联样式不在 PP 范围 → 用 CSP style-src 控制

2) 与 sandbox 的区别：
   sandbox 是 HTML 属性，控制基础能力（JS/表单/弹窗/同源）
   PP 控制设备/隐私类 API；二者协同而非替代

3) report-only 模式（仅上报不拦截）：
   Permissions-Policy-Report-Only: camera=()
   需配合 Reporting-Endpoints 头指定上报目标：
   Reporting-Endpoints: pp-endpoint="https://app.example.com/report"

4) 浏览器特性支持差异：
   - 同一特性在 Chrome/Firefox/Safari 的默认值与可配置性不同
   - 实验特性（如 idle-detection、local-fonts）需 origin trial
   - 移动端部分特性不支持

5) DevTools 查看 Permissions-Policy 头：
   Chrome DevTools → Network → 选中主文档请求 → Response Headers
   查看 Permissions-Policy 头是否生效；Application 面板也可看

6) iframe allow 与 HTTP 头的优先级：
   HTTP 头是基线；iframe allow 只能在基线内进一步放行
   若 HTTP 头 camera=()，则 iframe allow="camera" 也无效

7) 第三方 iframe 继承：
   子 iframe 默认继承父文档策略；可在 iframe 上覆盖
   但父策略禁用 ( () ) 的特性子 iframe 无法重新启用`;

const SET_COOKIE_EXAMPLE =
`# 完整 Set-Cookie 头示例（含所有现代属性）
Set-Cookie: session=abc123; Domain=.example.com; Path=/;
            Max-Age=86400;
            Expires=Fri, 23 Jul 2026 07:00:00 GMT;
            Secure; HttpOnly; SameSite=Lax; Partitioned

# 属性含义：
#   HttpOnly    - JS 不可读（防 XSS 偷取）
#   Secure      - 仅 HTTPS 传输
#   SameSite    - Strict(完全禁第三方) | Lax(导航带) | None(需 Secure)
#   Partitioned - 第三方 Cookie 按 top-level site 隔离（CHIP）`;

const FETCH_METADATA_EXAMPLE =
`# Fetch Metadata 请求头（浏览器自动附加，JS 无法伪造）
Sec-Fetch-Site: cross-site    # same-origin | same-site | cross-site | none
Sec-Fetch-Mode: cors          # cors | no-cors | navigate | websocket
Sec-Fetch-Dest: empty         # document | script | style | image | ...
Sec-Fetch-User: ?1            # 仅用户触发导航时附加（?1/?0）

# 服务端可据此校验：跨站 + mode=navigate + top-level 的请求需拒绝`;

// SameSite 取值对比（Card 5 展示）
const SAMESITE_COMPARISON =
`# SameSite 属性三档对比：
SameSite=Strict  - 完全禁止跨站携带（即使点击外站链接也不带 Cookie）
SameSite=Lax     - 仅顶层导航 GET 请求带 Cookie（Chrome 默认值）
SameSite=None    - 允许跨站携带（必须同时 Secure，仅 HTTPS）
# 未指定 SameSite 时现代浏览器默认按 Lax 处理`;

// 常见 CSP 指令速查（Card 1 展示）
const CSP_DIRECTIVES_TABLE =
`# 常见 CSP 指令速查：
default-src    - 所有资源的默认回退
script-src     - JavaScript 来源
style-src      - 样式表来源
img-src        - 图片来源
connect-src    - fetch/XHR/WebSocket 连接目标
font-src       - 字体来源
media-src      - 音视频来源
frame-src      - iframe 来源
object-src     - <object>/<embed> 来源
manifest-src   - Web App Manifest 来源
worker-src     - Worker/SharedWorker 来源
base-uri       - <base> 标签允许的 URI
form-action    - 表单提交目标
frame-ancestors - 哪些源可以 embed 本页（防点击劫持）
report-uri / report-to - 违规上报端点
require-trusted-types-for 'script' - 强制启用 Trusted Types
# 来源关键词：
#   'self'       仅同源
#   'none'       全部拒绝
#   'unsafe-inline'  允许内联（不推荐）
#   'unsafe-eval'    允许 eval（不推荐）
#   'nonce-xxx'      按 nonce 放行
#   'sha256-xxx'      按 hash 放行`;

export class SecurityPrivacyPage extends Page {
  initialState() {
    return {
      logs: [],
      // Card 1: CSP / SRI
      cspMetaFound: '',           // 检测到的 CSP meta content
      violationEvent: null,       // 最近一次 securitypolicyviolation 详情
      // Card 2: Cross-Origin
      crossOriginIsolated: null,  // self.crossOriginIsolated 值
      // Card 3: Storage Access & Permissions
      storageAccess: 'unknown',  // unknown | granted | denied
      permissionsStatus: {},      // { geolocation: 'prompt', ... }
      iframePPSupport: false,
      iframeAllowedFeatures: [],
      // Card 4: Trusted Types & Sanitizer
      ttSupport: false,
      ttPolicyCreated: false,
      sanitizerSupport: false,
      sanitizerOutput: '',        // sanitize 后的 HTML 文本
      // Card 5: Cookie & Privacy Sandbox
      currentCookie: '',
      topicsSupport: false,
      runAdAuctionSupport: false,
      joinAdInterestGroupSupport: false,
      // Card 9: Permissions Policy 专题
      permissionsPolicyInfo: null,   // _runPermissionsPolicyDemo() 探测结果
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 监听 securitypolicyviolation 事件（jsdom 中通常不触发，但浏览器会）
    if (typeof SecurityPolicyViolationEvent !== 'undefined' ||
        'onsecuritypolicyviolation' in document) {
      this._onSpv = (e) => {
        try {
          const info = {
            blockedURI: e.blockedURI,
            violatedDirective: e.violatedDirective,
            effectiveDirective: e.effectiveDirective,
            disposition: e.disposition,            // 'enforce' | 'report'
            lineNumber: e.lineNumber,
            columnNumber: e.columnNumber,
            sourceFile: e.sourceFile,
            originalPolicy: e.originalPolicy,
          };
          this.setState({ violationEvent: info });
          this._addLog('spv',
            `拦截违规：blocked=${info.blockedURI} directive=${info.violatedDirective} disposition=${info.disposition} @${info.lineNumber}:${info.columnNumber}`);
        } catch (err) {
          this._addLog('err', `securitypolicyviolation 处理异常：${err.message}`);
        }
      };
      try {
        document.addEventListener('securitypolicyviolation', this._onSpv);
        this._addLog('spv', 'securitypolicyviolation 事件监听已注册');
      } catch (err) {
        this._addLog('err', `securitypolicyviolation 监听注册失败：${err.message}`);
      }
    } else {
      this._addLog('spv', '当前环境不支持 SecurityPolicyViolationEvent');
    }

    // 一次性能力检测汇总（不触发 setState 循环）
    this._logCapabilities();

    // 一次性同步检测：CSP meta / crossOriginIsolated
    this._detectCspMeta();
    this._detectCrossOriginIsolated();
  }

  componentWillUnmount() {
    // 移除 securitypolicyviolation 监听（this.on 已自动跟踪的无需重复处理）
    if (this._onSpv) {
      try { document.removeEventListener('securitypolicyviolation', this._onSpv); }
      catch { /* noop */ }
    }
    this._onSpv = null;
  }

  // —— 日志 / 按钮 辅助 ——
  _addLog(type, content) {
    this.setState({
      logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40),
    });
  }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  _logCapabilities() {
    const caps = [
      ['SecurityPolicyViolationEvent', typeof SecurityPolicyViolationEvent !== 'undefined'],
      ['crossOriginIsolated', typeof self !== 'undefined' && !!self.crossOriginIsolated],
      ['document.hasStorageAccess', typeof document.hasStorageAccess === 'function'],
      ['document.requestStorageAccess', typeof document.requestStorageAccess === 'function'],
      ['navigator.permissions', !!(navigator.permissions && typeof navigator.permissions.query === 'function')],
      ['Permissions-Policy (iframe)', typeof HTMLIFrameElement !== 'undefined' && !!HTMLIFrameElement.prototype.permissionsPolicy],
      ['window.trustedTypes', typeof window.trustedTypes !== 'undefined'],
      ['Sanitizer', typeof window.Sanitizer !== 'undefined'],
      ['element.setHTML', typeof Element !== 'undefined' && typeof Element.prototype.setHTML === 'function'],
      ['navigator.browsingTopics', typeof navigator.browsingTopics === 'function'],
      ['navigator.runAdAuction', typeof navigator.runAdAuction === 'function'],
      ['navigator.joinAdInterestGroup', typeof navigator.joinAdInterestGroup === 'function'],
      ['cookieStore', 'cookieStore' in window && !!window.cookieStore],
      // Card 9: Permissions Policy JS API 能力检测
      ['document.featurePolicy', typeof document !== 'undefined' && typeof document.featurePolicy === 'object'],
      ['document.policy', typeof document !== 'undefined' && typeof document.policy === 'object'],
      ['document.featurePolicy.allowedFeatures', typeof document !== 'undefined' && !!document.featurePolicy && typeof document.featurePolicy.allowedFeatures === 'function'],
      ['document.featurePolicy.allowsFeature', typeof document !== 'undefined' && !!document.featurePolicy && typeof document.featurePolicy.allowsFeature === 'function'],
    ];
    const summary = caps.map(([n, ok]) => `${n}:${ok ? '✓' : '✗'}`).join('  ');
    this._addLog('info', `能力检测：${summary}`);
  }

  // =================== 1. CSP / SRI ===================

  _detectCspMeta() {
    try {
      const metas = document.querySelectorAll(
        'meta[http-equiv="Content-Security-Policy"], meta[http-equiv="content-security-policy"]'
      );
      if (!metas.length) {
        this.setState({ cspMetaFound: '' });
        this._addLog('spv', '未检测到 <meta http-equiv="Content-Security-Policy">（CSP 通常由服务端响应头下发）');
        return;
      }
      const contents = Array.from(metas).map((m) => m.getAttribute('content') || '').filter(Boolean);
      this.setState({ cspMetaFound: contents.join(' | ') });
      this._addLog('spv', `检测到 ${contents.length} 个 CSP meta 标签，content 长度=${contents.join('').length}`);
    } catch (err) {
      this._addLog('err', `CSP meta 检测异常：${err.message}`);
    }
  }

  // 用程序触发一个安全的「假违规」检测能力（仅当浏览器支持时，由实际 CSP 拦截产生事件）
  _probeViolationProbe() {
    // 这里不引入任何恶意资源；仅说明：要在真实浏览器观察 violation，
    // 需页面已配置 CSP 且发生违规（如加载被禁资源）。jsdom 中通常不触发。
    if (typeof SecurityPolicyViolationEvent === 'undefined' &&
        !('onsecuritypolicyviolation' in document)) {
      return this._addLog('spv', '当前环境不支持 SecurityPolicyViolationEvent（jsdom 限制）');
    }
    this._addLog('spv', '已在 componentDidMount 注册 securitypolicyviolation 监听；' +
      '真实违规由浏览器 CSP 引擎拦截资源时自动触发，JS 不能主动伪造。');
  }

  _clearViolation() {
    this.setState({ violationEvent: null });
    this._addLog('spv', '已清空缓存的 violation 事件详情');
  }

  // =================== 2. Cross-Origin 与隔离 ===================

  _detectCrossOriginIsolated() {
    try {
      const iso = typeof self !== 'undefined' ? !!self.crossOriginIsolated : false;
      this.setState({ crossOriginIsolated: iso });
      this._addLog('cors',
        `self.crossOriginIsolated = ${iso}（${iso ? '已隔离，可用 SAB / measureUserAgentSpecificMemory' : '未隔离，需配置 COOP+COEP 头'}）`);
    } catch (err) {
      this._addLog('err', `crossOriginIsolated 检测异常：${err.message}`);
    }
  }

  _showCorsUsage() {
    // 仅展示 API 用法，不实际发起跨域请求
    this._addLog('cors', 'fetch 跨域用法：mode="cors" | credentials="include|same-origin|omit"');
    this._addLog('cors', '非简单请求（自定义头/非简单方法/非简单 Content-Type）会先发 OPTIONS 预检');
    this._addLog('cors', '服务端需返回 Access-Control-Allow-Origin/Headers/Methods/Credentials');
  }

  // =================== 3. Storage Access & Permissions Policy ===================

  async _checkStorageAccess() {
    if (typeof document.hasStorageAccess !== 'function') {
      this._addLog('perm', '当前环境不支持 document.hasStorageAccess()（jsdom 限制）');
      return;
    }
    try {
      const has = await document.hasStorageAccess();
      this.setState({ storageAccess: has ? 'granted' : 'denied' });
      this._addLog('perm', `document.hasStorageAccess() => ${has}`);
    } catch (err) {
      this._addLog('err', `hasStorageAccess 异常：${err.message}`);
    }
  }

  async _requestStorageAccess() {
    if (typeof document.requestStorageAccess !== 'function') {
      this._addLog('perm', '当前环境不支持 document.requestStorageAccess()（需第三方 iframe + HTTPS）');
      return;
    }
    try {
      await document.requestStorageAccess();
      this.setState({ storageAccess: 'granted' });
      this._addLog('perm', 'document.requestStorageAccess() => granted（用户已授权）');
    } catch (err) {
      this.setState({ storageAccess: 'denied' });
      this._addLog('perm', `requestStorageAccess 被拒绝或失败：${err.name} - ${err.message}`);
    }
  }

  _checkIframePermissionsPolicy() {
    const supported = typeof HTMLIFrameElement !== 'undefined' &&
      !!HTMLIFrameElement.prototype.permissionsPolicy;
    if (!supported) {
      this.setState({ iframePPSupport: false, iframeAllowedFeatures: [] });
      this._addLog('perm', '当前环境不支持 iframe.permissionsPolicy API');
      return;
    }
    try {
      const iframe = document.createElement('iframe');
      const pp = iframe.permissionsPolicy;
      const features = typeof pp.allowedFeatures === 'function' ? pp.allowedFeatures() : [];
      this.setState({ iframePPSupport: true, iframeAllowedFeatures: features });
      this._addLog('perm', `iframe.permissionsPolicy.allowedFeatures() => 共 ${features.length} 个`);
    } catch (err) {
      this._addLog('err', `permissionsPolicy 检测异常：${err.message}`);
    }
  }

  _checkAllowsFeature() {
    const supported = typeof HTMLIFrameElement !== 'undefined' &&
      !!HTMLIFrameElement.prototype.permissionsPolicy;
    if (!supported) {
      return this._addLog('perm', 'iframe.permissionsPolicy 不可用，无法调用 allowsFeature()');
    }
    try {
      const iframe = document.createElement('iframe');
      iframe.allow = 'camera; microphone; geolocation';
      const pp = iframe.permissionsPolicy;
      const probes = [
        ['camera', undefined],
        ['microphone', undefined],
        ['geolocation', undefined],
        ['camera', 'https://trusted.example.com'],
        ['camera', 'https://evil.example.com'],
        ['fullscreen', undefined],
      ];
      const lines = probes.map(([feature, origin]) => {
        let allowed = false;
        try {
          allowed = typeof pp.allowsFeature === 'function'
            ? pp.allowsFeature(feature, origin)
            : false;
        } catch (e) {
          allowed = `err:${e.name}`;
        }
        return `${feature}${origin ? ` @${origin}` : ''} = ${allowed}`;
      });
      this._addLog('perm', `allowsFeature 探测：${lines.join(' | ')}`);
    } catch (err) {
      this._addLog('err', `allowsFeature 检测异常：${err.message}`);
    }
  }

  async _queryPermissions() {
    if (!navigator.permissions || typeof navigator.permissions.query !== 'function') {
      this._addLog('perm', '当前环境不支持 navigator.permissions.query()');
      return;
    }
    const names = ['geolocation', 'camera', 'microphone', 'notifications'];
    const result = {};
    for (const name of names) {
      try {
        const status = await navigator.permissions.query({ name });
        result[name] = status.state; // 'granted' | 'denied' | 'prompt'
        // 监听变化（一次性）
        status.onchange = () => {
          this._addLog('perm', `权限 ${name} 状态变更 => ${status.state}`);
        };
      } catch (err) {
        result[name] = 'unsupported';
        this._addLog('perm', `query(${name}) 失败：${err.name}`);
      }
    }
    this.setState({ permissionsStatus: result });
    const summary = Object.entries(result).map(([k, v]) => `${k}=${v}`).join(', ');
    this._addLog('perm', `permissions.query 汇总：${summary}`);
  }

  // =================== 6. Permissions Policy 专题 ===================

  // 探测 document.featurePolicy / document.policy 全部 JS API
  // 覆盖：allowedFeatures / allowsFeature(feature, origin) / features / getAllowlistForFeature
  // iframe.permissionsPolicy 已在 _checkIframePermissionsPolicy / _checkAllowsFeature 演示，
  // 本方法聚焦 document 层 API，并把结果存入 state.permissionsPolicyInfo 供 Card 9 展示。
  _runPermissionsPolicyDemo() {
    const info = {
      hasFeaturePolicy: false,
      hasPolicy: false,
      allowedFeatures: null,   // document.featurePolicy.allowedFeatures()
      features: null,          // document.featurePolicy.features() —— 全集
      allowlist: {},           // { camera: [...], microphone: [...], ... }
      allowsFeature: {},       // { camera: { self, trusted, evil }, ... }
      iframePP: false,
      notes: [],
    };
    try {
      info.hasFeaturePolicy = typeof document !== 'undefined' &&
        typeof document.featurePolicy === 'object' && document.featurePolicy !== null;
      info.hasPolicy = typeof document !== 'undefined' &&
        typeof document.policy === 'object' && document.policy !== null;

      if (info.hasFeaturePolicy) {
        // allowedFeatures()：当前文档允许使用的特性清单
        try {
          info.allowedFeatures = typeof document.featurePolicy.allowedFeatures === 'function'
            ? document.featurePolicy.allowedFeatures() : null;
        } catch (e) { info.notes.push(`allowedFeatures err:${e.name}`); }
        // features()：浏览器认知的全部特性名（与策略无关，仅全集）
        try {
          info.features = typeof document.featurePolicy.features === 'function'
            ? document.featurePolicy.features() : null;
        } catch (e) { info.notes.push(`features err:${e.name}`); }
        // 探测几个常见特性的允许源列表与按源 allowsFeature 判定
        const probes = ['camera', 'microphone', 'geolocation', 'fullscreen', 'payment', 'usb'];
        for (const f of probes) {
          try {
            if (typeof document.featurePolicy.getAllowlistForFeature === 'function') {
              info.allowlist[f] = document.featurePolicy.getAllowlistForFeature(f);
            }
          } catch (e) { info.allowlist[f] = `err:${e.name}`; }
          const perOrigin = {};
          for (const origin of [undefined, 'https://trusted.example.com', 'https://evil.example.com']) {
            try {
              perOrigin[origin || 'self'] = typeof document.featurePolicy.allowsFeature === 'function'
                ? document.featurePolicy.allowsFeature(f, origin) : 'no-fn';
            } catch (e) { perOrigin[origin || 'self'] = `err:${e.name}`; }
          }
          info.allowsFeature[f] = perOrigin;
        }
      }

      info.iframePP = typeof HTMLIFrameElement !== 'undefined' &&
        !!HTMLIFrameElement.prototype.permissionsPolicy;

      this.setState({ permissionsPolicyInfo: info });
      this._addLog('perm',
        `PP 演示：featurePolicy=${info.hasFeaturePolicy ? '✓' : '✗'} ` +
        `policy=${info.hasPolicy ? '✓' : '✗'} ` +
        `allowedFeatures=${info.allowedFeatures ? info.allowedFeatures.length : 'N/A'} ` +
        `features=${info.features ? info.features.length : 'N/A'} ` +
        `iframe.permissionsPolicy=${info.iframePP ? '✓' : '✗'}`);
      if (!info.hasFeaturePolicy && !info.hasPolicy) {
        this._addLog('perm', '当前环境无 document.featurePolicy / document.policy（jsdom 限制；Chrome 已支持 document.featurePolicy）');
      }
    } catch (err) {
      this._addLog('err', `Permissions Policy 演示异常：${err.message}`);
    }
  }

  // =================== 4. Trusted Types & Sanitizer API ===================

  _checkTrustedTypes() {
    if (typeof window.trustedTypes === 'undefined') {
      this.setState({ ttSupport: false, ttPolicyCreated: false });
      this._addLog('tt', '当前环境不支持 window.trustedTypes（jsdom 限制；Chrome 已支持）');
      return;
    }
    this.setState({ ttSupport: true });
    this._addLog('tt', 'window.trustedTypes 已检测到');
    try {
      // 创建一个最小化的 policy：createHTML 接收字符串，返回 TrustedHTML
      // 实际项目中应在此调用 DOMPurify 等净化器
      const policy = window.trustedTypes.createPolicy('api-lab-tt', {
        createHTML: (s) => s.replace(/<script>/gi, '&lt;script&gt;'),
      });
      // 用 policy.createHTML 得到 TrustedHTML 实例
      const trusted = policy.createHTML('<b>safe</b>');
      this.setState({ ttPolicyCreated: true });
      this._addLog('tt', `createPolicy('api-lab-tt') 成功；createHTML => ${String(trusted).slice(0, 40)}`);
      // 尝试用 TrustedHTML 设置 innerHTML（启用 require-trusted-types-for 时才会强制校验）
      const target = this.$('.tt-demo-target');
      if (target) {
        target.innerHTML = trusted;
        this._addLog('tt', '已用 TrustedHTML 设置 .tt-demo-target 的 innerHTML');
      }
    } catch (err) {
      this._addLog('err', `createPolicy 异常：${err.name} - ${err.message}`);
    }
  }

  _sanitizerDemo() {
    if (typeof window.Sanitizer === 'undefined') {
      this.setState({ sanitizerSupport: false, sanitizerOutput: '' });
      this._addLog('san', '当前环境不支持 new Sanitizer()（jsdom 限制；Firefox/Chrome 已支持）');
      return;
    }
    this.setState({ sanitizerSupport: true });
    try {
      // 自定义允许/拒绝清单
      const sanitizer = new window.Sanitizer({
        allowElements: ['b', 'i', 'p', 'span', 'div', 'br', 'strong', 'em'],
        allowAttributes: { '*': ['class'] },
        dropElements: ['script', 'iframe', 'object', 'embed'],
        dropAttributes: { '*': ['onerror', 'onload', 'onclick'] },
      });
      const input =
        '<p>正常段落</p><script>alert(1)</script><img src=x onerror="alert(2)"><b>加粗</b>';
      // 方式 1：sanitize 返回 DocumentFragment
      const fragment = sanitizer.sanitize(input);
      const text = new XMLSerializer().serializeToString(fragment);
      this.setState({ sanitizerOutput: text });
      this._addLog('san', `sanitize() 完成；输入长度=${input.length}，输出=${text}`);
      // 方式 2：element.setHTML（若支持）—— 安全设置 innerHTML
      const target = this.$('.san-demo-target');
      if (target && typeof target.setHTML === 'function') {
        target.setHTML(input, { sanitizer });
        this._addLog('san', 'element.setHTML(html, { sanitizer }) 已调用（<script>/onerror 等被剥离）');
      } else {
        this._addLog('san', 'element.setHTML 不可用，仅演示 sanitize()');
      }
    } catch (err) {
      this._addLog('err', `Sanitizer 演示异常：${err.name} - ${err.message}`);
    }
  }

  // =================== 5. Cookie & Privacy Sandbox ===================

  _showCurrentCookie() {
    try {
      const raw = document.cookie || '';
      this.setState({ currentCookie: raw });
      this._addLog('cookie', `document.cookie => "${raw || '(空)'}"（HttpOnly Cookie 不在 JS 可见范围）`);
    } catch (err) {
      this._addLog('err', `读取 document.cookie 异常：${err.message}`);
    }
  }

  _checkPrivacySandbox() {
    const topics = typeof navigator.browsingTopics === 'function';
    const auction = typeof navigator.runAdAuction === 'function';
    const join = typeof navigator.joinAdInterestGroup === 'function';
    this.setState({
      topicsSupport: topics,
      runAdAuctionSupport: auction,
      joinAdInterestGroupSupport: join,
    });
    this._addLog('ps', `Privacy Sandbox：browsingTopics=${topics} runAdAuction=${auction} joinAdInterestGroup=${join}`);
    this._addLog('ps', '说明：Privacy Sandbox 多为实验性 API，需 HTTPS + 用户开启 Privacy Sandbox 试用');
  }

  async _tryBrowsingTopics() {
    if (typeof navigator.browsingTopics !== 'function') {
      return this._addLog('ps', 'navigator.browsingTopics() 不可用');
    }
    try {
      const topics = await navigator.browsingTopics();
      this._addLog('ps', `browsingTopics() => ${JSON.stringify(topics)}`);
    } catch (err) {
      this._addLog('ps', `browsingTopics 失败（多为权限/上下文限制）：${err.message}`);
    }
  }

  _showFetchMetadataInfo() {
    this._addLog('ps', 'Sec-Fetch-Site/Mode/Dest/User 由浏览器自动附加到所有 fetch 请求');
    this._addLog('ps', 'JS 无法伪造这些头；服务端应校验 Sec-Fetch-Site 防止跨站 CSRF');
  }

  // =================== 渲染 ===================
  renderPage() {
    const s = this.state;
    const hasSpv = typeof SecurityPolicyViolationEvent !== 'undefined' ||
      ('onsecuritypolicyviolation' in document);
    const hasCOI = typeof self !== 'undefined' && typeof self.crossOriginIsolated !== 'undefined';
    const hasStorageAccess = typeof document.hasStorageAccess === 'function';
    const hasRequestStorageAccess = typeof document.requestStorageAccess === 'function';
    const hasPermissions = !!(navigator.permissions && typeof navigator.permissions.query === 'function');
    const hasIframePP = typeof HTMLIFrameElement !== 'undefined' &&
      !!HTMLIFrameElement.prototype.permissionsPolicy;
    const hasTT = typeof window.trustedTypes !== 'undefined';
    const hasSanitizer = typeof window.Sanitizer !== 'undefined';
    const hasSetHTML = typeof Element !== 'undefined' && typeof Element.prototype.setHTML === 'function';

    const permEntries = Object.entries(s.permissionsStatus);

    return [
      h('h2', { class: 'section-title' }, 'Web 安全与隐私 API 实验室'),

      h(Alert, {
        type: 'info',
        message: 'CSP / SRI / CORS / COOP / COEP / Storage Access / Permissions Policy / Trusted Types / Sanitizer / Privacy Sandbox',
        description: '演示 Web 安全与隐私防御类 API。这些 API 大多通过 HTTP 头或 meta 标签启用，JS 主要用于读取、监听 violation、能力检测与查询权限。jsdom 中多数 API 不可用，所有调用前均做能力检测，不可用时仅记日志。底部为事件日志面板。',
      }),

      // ============ 1. CSP & SRI ============
      h(Card, {
        title: '1. Content Security Policy (CSP) 与 Subresource Integrity (SRI)',
        extra: h('div', { class: 'flex gap-xs' },
          h(Tag, { color: hasSpv ? 'success' : 'default' }, hasSpv ? 'SPV 可用' : 'SPV 不可用'),
          h(Tag, { color: 'warning' }, 'HTTP 头/meta'),
        ),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'CSP 通过 <meta http-equiv="Content-Security-Policy"> 或响应头 Content-Security-Policy 下发；指令包括 default-src / script-src / style-src / img-src / connect-src / font-src / media-src / frame-src / object-src / manifest-src / worker-src；来源关键词：\'self\' / \'none\' / \'unsafe-inline\' / \'unsafe-eval\' / nonce-xxx / sha256-xxx；report-uri / report-to 配置报告端点。SRI 通过 <script integrity="sha256-..." crossorigin="anonymous"> 让浏览器校验资源 hash，不匹配则拒绝加载。'),
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            this._btn('检测 CSP meta', { type: 'primary', size: 'sm', onClick: () => this._detectCspMeta() }),
            this._btn('说明 violation 触发', { size: 'sm', onClick: () => this._probeViolationProbe() }),
            this._btn('清空 violation 缓存', { size: 'sm', onClick: () => this._clearViolation() }),
          ),
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            h(Tag, { color: s.cspMetaFound ? 'success' : 'default' },
              s.cspMetaFound ? '已检测到 CSP meta' : '未检测到 CSP meta'),
            h(Tag, { color: 'info' }, ' disposition: enforce | report'),
          ),
          s.cspMetaFound && h('pre', { class: 'code-block', style: { maxHeight: '80px' } },
            h('code', {}, s.cspMetaFound)),
          h('div', { class: 'fs-sm text-secondary' }, 'CSP meta 标签示例（default-src + 各类 src 指令 + report）：'),
          h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
            h('code', {}, CSP_META_EXAMPLE)),
          h('div', { class: 'fs-sm text-secondary' }, 'SRI script/link 标签示例：'),
          h('pre', { class: 'code-block', style: { maxHeight: '120px', overflow: 'auto' } },
            h('code', {}, SRI_EXAMPLE)),
          h('div', { class: 'fs-sm text-secondary' }, 'securitypolicyviolation 事件捕获字段与 report-uri 报告格式：'),
          h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
            h('code', {}, CSP_REPORT_EXAMPLE)),
          h('div', { class: 'fs-sm text-secondary' }, '常见 CSP 指令与来源关键词速查：'),
          h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
            h('code', {}, CSP_DIRECTIVES_TABLE)),
          s.violationEvent && h('div', { class: 'alert alert--warning', style: { fontSize: '12px' } },
            h('div', {},
              h('div', { class: 'fw-medium' }, '最近一次 SecurityPolicyViolationEvent：'),
              h('div', { class: 'fs-sm' },
                `blockedURI=${s.violationEvent.blockedURI}`),
              h('div', { class: 'fs-sm' },
                `violatedDirective=${s.violationEvent.violatedDirective} effectiveDirective=${s.violationEvent.effectiveDirective}`),
              h('div', { class: 'fs-sm' },
                `disposition=${s.violationEvent.disposition} @${s.violationEvent.lineNumber}:${s.violationEvent.columnNumber}`),
              h('div', { class: 'fs-sm', style: { wordBreak: 'break-all' } },
                `sourceFile=${s.violationEvent.sourceFile}`),
              s.violationEvent.originalPolicy && h('div', { class: 'fs-sm', style: { wordBreak: 'break-all' } },
                `originalPolicy=${String(s.violationEvent.originalPolicy).slice(0, 120)}...`),
            ),
          ),
          h(Alert, {
            type: 'info',
            message: 'CSP / SRI 是服务端 / HTML 配置',
            description: 'JS 无法动态修改已下发的 CSP；只能在客户端监听 securitypolicyviolation 事件并上报。SRI 的 integrity 值需在构建期由服务端计算并写入 HTML。',
          }),
        ),
      ),

      // ============ 2. Cross-Origin & Isolation ============
      h(Card, {
        title: '2. Cross-Origin 与隔离机制（CORS / COOP / COEP / CORP）',
        extra: h('div', { class: 'flex gap-xs' },
          h(Tag, { color: hasCOI ? 'success' : 'default' },
            s.crossOriginIsolated ? '已隔离' : '未隔离'),
          h(Tag, { color: 'warning' }, 'HTTP 头'),
        ),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'fetch 的 mode 取值 cors | no-cors | same-origin；credentials 取值 omit | same-origin | include；简单请求直接发送，非简单请求（自定义头/PUT/PATCH/非简单 Content-Type）先发 OPTIONS 预检。Cross-Origin Isolation 需配置 COOP: same-origin + COEP: require-corp，资源端声明 CORP: same-origin；启用后 self.crossOriginIsolated === true，可解锁 SharedArrayBuffer 与 performance.measureUserAgentSpecificMemory。'),
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            this._btn('检测 crossOriginIsolated', { type: 'primary', size: 'sm', onClick: () => this._detectCrossOriginIsolated() }),
            this._btn('查看 CORS fetch 用法', { size: 'sm', onClick: () => this._showCorsUsage() }),
          ),
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            h(Tag, { color: 'primary' },
              `self.crossOriginIsolated = ${s.crossOriginIsolated}`),
            h(Tag, { color: s.crossOriginIsolated ? 'success' : 'warning' },
              s.crossOriginIsolated ? 'SAB 可用' : '需 COOP+COEP'),
          ),
          h('div', { class: 'fs-sm text-secondary' }, 'COOP / COEP / CORP HTTP 头示例：'),
          h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
            h('code', {}, COOP_COEP_EXAMPLE)),
          h('div', { class: 'fs-sm text-secondary' }, 'fetch 跨域配置（mode / credentials / 预检）与服务端响应头：'),
          h('pre', { class: 'code-block', style: { maxHeight: '200px', overflow: 'auto' } },
            h('code', {}, CORS_FETCH_EXAMPLE)),
          h(Alert, {
            type: 'info',
            message: 'CORS / COOP / COEP / CORP 均为 HTTP 响应头',
            description: '这些机制不能通过 JS 配置；前端只能读取 self.crossOriginIsolated、通过 fetch 的 mode/credentials 表达意图，实际策略由服务端响应头决定。',
          }),
        ),
      ),

      // ============ 3. Storage Access & Permissions Policy ============
      h(Card, {
        title: '3. Storage Access API 与 Permissions Policy',
        extra: h('div', { class: 'flex gap-xs' },
          h(Tag, { color: hasPermissions ? 'success' : 'default' }, hasPermissions ? 'permissions 可用' : 'permissions 不可用'),
          h(Tag, { color: hasIframePP ? 'success' : 'default' }, hasIframePP ? 'PP 可用' : 'PP 不可用'),
        ),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'Storage Access API：document.hasStorageAccess() 返回 Promise<boolean>，document.requestStorageAccess() 请求第一方 Cookie 访问权限（弹出提示），适用于第三方 iframe。Permissions Policy（原 Feature Policy，已弃用）通过 Permissions-Policy HTTP 头或 iframe allow 属性控制能力授权；navigator.permissions.query({ name }) 返回 { state: granted|denied|prompt }；iframe.permissionsPolicy.allowedFeatures() 列出 iframe 当前可用的特性。'),
          h('div', { class: 'fs-sm text-secondary' }, 'Storage Access API：'),
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            this._btn('hasStorageAccess()', { type: 'primary', size: 'sm', onClick: () => this._checkStorageAccess() }),
            this._btn('requestStorageAccess()', { size: 'sm', onClick: () => this._requestStorageAccess() }),
            h(Tag, { color: s.storageAccess === 'granted' ? 'success' : s.storageAccess === 'denied' ? 'warning' : 'default' },
              `storageAccess: ${s.storageAccess}`),
          ),
          h(Alert, {
            type: 'warning',
            message: 'Storage Access API 需第三方 iframe 上下文 + HTTPS',
            description: '在第一方顶层页面调用 hasStorageAccess 通常返回 true；jsdom 中不可用，调用将记日志说明。',
          }),
          h('div', { class: 'fs-sm text-secondary' }, 'Permissions Policy：'),
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            this._btn('检测 iframe.permissionsPolicy', { type: 'primary', size: 'sm', onClick: () => this._checkIframePermissionsPolicy() }),
            this._btn('allowsFeature 探测', { size: 'sm', onClick: () => this._checkAllowsFeature() }),
            this._btn('查询 4 个权限', { type: 'primary', size: 'sm', onClick: () => this._queryPermissions() }),
          ),
          permEntries.length > 0
            ? h('div', { class: 'flex items-center gap-xs flex-wrap' },
                ...permEntries.map(([name, state]) =>
                  h(Tag, { color: state === 'granted' ? 'success' : state === 'denied' ? 'error' : state === 'unsupported' ? 'default' : 'warning' },
                    `${name}: ${state}`)),
              )
            : h('div', { class: 'fs-sm text-tertiary' }, '（暂未查询权限，点击「查询 4 个权限」）'),
          s.iframeAllowedFeatures.length > 0 && h('div', { class: 'fs-sm text-tertiary', style: { wordBreak: 'break-all' } },
            `iframe.permissionsPolicy.allowedFeatures() => [${s.iframeAllowedFeatures.slice(0, 12).join(', ')}${s.iframeAllowedFeatures.length > 12 ? '...' : ''}]`),
          h('div', { class: 'fs-sm text-secondary' }, 'Permissions-Policy HTTP 头与 iframe allow 属性示例：'),
          h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
            h('code', {}, PERMISSIONS_POLICY_EXAMPLE)),
          h(Alert, {
            type: 'info',
            message: 'Feature-Policy 已弃用，改用 Permissions-Policy',
            description: '老版本浏览器使用 Feature-Policy 头，语法为逗号分隔；新版统一为 Permissions-Policy: feature=(origin1 origin2)，且支持 iframe allow 属性。',
          }),
        ),
      ),

      // ============ 4. Trusted Types & Sanitizer API ============
      h(Card, {
        title: '4. Trusted Types 与 Sanitizer API',
        extra: h('div', { class: 'flex gap-xs' },
          h(Tag, { color: hasTT ? 'success' : 'default' }, hasTT ? 'TT 可用' : 'TT 不可用'),
          h(Tag, { color: hasSanitizer ? 'success' : 'default' }, hasSanitizer ? 'Sanitizer 可用' : 'Sanitizer 不可用'),
          h(Tag, { color: 'warning' }, '防御性'),
        ),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'Trusted Types 防止 DOM XSS：要求 innerHTML / insertAdjacentHTML / eval 等接收 TrustedHTML 而非字符串。trustedTypes.createPolicy(name, { createHTML }) 创建策略；policy.createHTML(str) 返回 TrustedHTML。配合 CSP: require-trusted-types-for \'script\' 强制启用。Sanitizer API：new Sanitizer({ allowElements, allowAttributes, dropElements, dropAttributes }) 创建净化器；sanitizer.sanitize(input) 返回 DocumentFragment；element.setHTML(html, { sanitizer }) 安全设置 innerHTML（自动剥离危险节点）。'),
          h('div', { class: 'fs-sm text-secondary' }, 'Trusted Types 演示：'),
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            this._btn('检测 + 创建 policy', { type: 'primary', size: 'sm', onClick: () => this._checkTrustedTypes() }),
            h(Tag, { color: s.ttSupport ? 'success' : 'default' }, s.ttSupport ? 'trustedTypes 已检测' : 'trustedTypes 不可用'),
            h(Tag, { color: s.ttPolicyCreated ? 'success' : 'default' }, s.ttPolicyCreated ? 'policy 已创建' : 'policy 未创建'),
          ),
          h('div', { class: 'tt-demo-target', style: { padding: '8px', border: '1px dashed #555', minHeight: '24px', fontSize: '13px' } },
            '（TrustedHTML 输出将显示在此处）'),
          h('div', { class: 'fs-sm text-secondary' }, 'Sanitizer API 演示（输入含 <script> 与 onerror，将被剥离）：'),
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            this._btn('运行 Sanitizer 演示', { type: 'primary', size: 'sm', onClick: () => this._sanitizerDemo() }),
            h(Tag, { color: hasSanitizer ? 'success' : 'default' }, hasSanitizer ? 'Sanitizer 可用' : 'Sanitizer 不可用'),
            h(Tag, { color: hasSetHTML ? 'success' : 'default' }, hasSetHTML ? 'setHTML 可用' : 'setHTML 不可用'),
          ),
          h('div', { class: 'san-demo-target', style: { padding: '8px', border: '1px dashed #555', minHeight: '24px', fontSize: '13px' } },
            '（setHTML 安全输出将显示在此处）'),
          s.sanitizerOutput && h('pre', { class: 'code-block', style: { maxHeight: '80px', overflow: 'auto' } },
            h('code', {}, `sanitize 输出：${s.sanitizerOutput}`)),
          h(Alert, {
            type: 'info',
            message: 'Trusted Types 与 Sanitizer 是 XSS 的纵深防御层',
            description: 'Trusted Types 要求所有 sink 接收白名单工厂产出的 TrustedHTML；Sanitizer 在赋值前剥离 script/事件属性等危险节点。两者可叠加使用，但不能替代输入校验与服务端转义。',
          }),
        ),
      ),

      // ============ 5. Cookie & Privacy Sandbox ============
      h(Card, {
        title: '5. Cookie 与 Privacy Sandbox',
        extra: h('div', { class: 'flex gap-xs' },
          h(Tag, { color: 'success' }, 'Cookie'),
          h(Tag, { color: 'warning' }, '实验性'),
        ),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'Cookie 属性：HttpOnly（JS 不可读）、Secure（仅 HTTPS）、SameSite=Strict|Lax|None（需 Secure）、Partitioned（CHIP 第三方隔离）。document.cookie 读写非 HttpOnly Cookie；cookieStore API 提供 get/set/delete/getAll。Privacy Sandbox：Topics API（browsingTopics 推断兴趣）、Protected Audience API（原 FLEDGE，runAdAuction/joinAdInterestGroup）、Attribution Reporting、Storage Partitioning。Fetch Metadata 头（Sec-Fetch-Site/Mode/Dest/User）由浏览器自动附加，JS 无法伪造，服务端可据此防 CSRF。'),
          h('div', { class: 'fs-sm text-secondary' }, 'Cookie：'),
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            this._btn('读取 document.cookie', { type: 'primary', size: 'sm', onClick: () => this._showCurrentCookie() }),
            h(Tag, { color: s.currentCookie ? 'success' : 'default' }, s.currentCookie ? '有非 HttpOnly Cookie' : '(空或仅 HttpOnly)'),
          ),
          s.currentCookie && h('pre', { class: 'code-block', style: { maxHeight: '60px', overflow: 'auto' } },
            h('code', {}, s.currentCookie)),
          h('div', { class: 'fs-sm text-secondary' }, '完整 Set-Cookie 头示例（含所有现代属性）：'),
          h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } },
            h('code', {}, SET_COOKIE_EXAMPLE)),
          h('div', { class: 'fs-sm text-secondary' }, 'SameSite 三档取值对比（防 CSRF 关键属性）：'),
          h('pre', { class: 'code-block', style: { maxHeight: '120px', overflow: 'auto' } },
            h('code', {}, SAMESITE_COMPARISON)),
          h('div', { class: 'fs-sm text-secondary' }, 'Privacy Sandbox 能力检测：'),
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            this._btn('检测 Privacy Sandbox', { type: 'primary', size: 'sm', onClick: () => this._checkPrivacySandbox() }),
            this._btn('尝试 browsingTopics()', { size: 'sm', onClick: () => this._tryBrowsingTopics() }),
          ),
          h('div', { class: 'flex items-center gap-xs flex-wrap' },
            h(Tag, { color: s.topicsSupport ? 'success' : 'default' }, `browsingTopics: ${s.topicsSupport ? '✓' : '✗'}`),
            h(Tag, { color: s.runAdAuctionSupport ? 'success' : 'default' }, `runAdAuction: ${s.runAdAuctionSupport ? '✓' : '✗'}`),
            h(Tag, { color: s.joinAdInterestGroupSupport ? 'success' : 'default' }, `joinAdInterestGroup: ${s.joinAdInterestGroupSupport ? '✓' : '✗'}`),
          ),
          h('div', { class: 'fs-sm text-secondary' }, 'Fetch Metadata 请求头（浏览器自动附加，防 CSRF）：'),
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            this._btn('说明 Fetch Metadata', { size: 'sm', onClick: () => this._showFetchMetadataInfo() }),
          ),
          h('pre', { class: 'code-block', style: { maxHeight: '160px', overflow: 'auto' } },
            h('code', {}, FETCH_METADATA_EXAMPLE)),
          h(Alert, {
            type: 'warning',
            message: 'Privacy Sandbox 多为实验性 API',
            description: 'Topics API / Protected Audience / Attribution Reporting 仍在 Chromium 试用阶段，需 HTTPS + 用户在浏览器设置中开启 Privacy Sandbox 试用；非 Chromium 内核通常不可用。Fetch Metadata 头由浏览器自动附加，无需 JS 配置。',
          }),
        ),
      ),

      // ============ 9. Permissions Policy 专题 ============
      this._renderCard9(),

      // ============ 日志面板 ============
      this._renderLogPanel(),
    ];
  }

  // Card 9：Permissions Policy 专题（原 Feature Policy 深度）
  // 与 Card 3 的关系：Card 3 仅简要演示 iframe.permissionsPolicy；本卡为深度专题，
  // 覆盖 HTTP 头语法、iframe allow、特性全集、document.featurePolicy JS API、
  // 第三方 iframe 沙箱、自家页面策略与陷阱。
  _renderCard9() {
    const s = this.state;
    const hasFeaturePolicy = typeof document !== 'undefined' &&
      typeof document.featurePolicy === 'object' && document.featurePolicy !== null;
    const hasPolicy = typeof document !== 'undefined' &&
      typeof document.policy === 'object' && document.policy !== null;
    const info = s.permissionsPolicyInfo;

    const card = new Card({
      title: '9. Permissions Policy 专题（原 Feature Policy 深度）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: hasFeaturePolicy ? 'success' : 'default' },
          hasFeaturePolicy ? 'featurePolicy 可用' : 'featurePolicy 不可用'),
        h(Tag, { color: hasPolicy ? 'success' : 'default' },
          hasPolicy ? 'policy 可用' : 'policy 不可用'),
        h(Tag, { color: 'warning' }, 'HTTP 头/iframe allow'),
      ),
    },
      h('div', { class: 'flex flex-col gap-sm' },
        h('p', { class: 'fs-sm text-secondary' },
          'Permissions Policy（原 Feature Policy，已改名）通过 Permissions-Policy HTTP 头或 iframe allow 属性，按源声明式启用/禁用强力特性（camera/microphone/usb/payment 等）。所有主流浏览器均可用；老语法 Feature-Policy 头已弃用。本卡演示 document.featurePolicy / document.policy JS API 与第三方 iframe 沙箱实战。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('运行 PP 演示', { type: 'primary', size: 'sm', onClick: () => this._runPermissionsPolicyDemo() }),
          h(Tag, { color: 'info' }, 'document.featurePolicy / document.policy'),
        ),
        info && h('div', { class: 'flex items-center gap-xs flex-wrap' },
          h(Tag, { color: info.hasFeaturePolicy ? 'success' : 'default' },
            `document.featurePolicy: ${info.hasFeaturePolicy ? '✓' : '✗'}`),
          h(Tag, { color: info.hasPolicy ? 'success' : 'default' },
            `document.policy: ${info.hasPolicy ? '✓' : '✗'}`),
          h(Tag, { color: info.iframePP ? 'success' : 'default' },
            `iframe.permissionsPolicy: ${info.iframePP ? '✓' : '✗'}`),
        ),
        info && info.allowedFeatures && h('div', { class: 'fs-sm text-tertiary', style: { wordBreak: 'break-all' } },
          `document.featurePolicy.allowedFeatures() => [${(info.allowedFeatures || []).slice(0, 12).join(', ')}${(info.allowedFeatures || []).length > 12 ? '...' : ''}]`),
        info && info.features && h('div', { class: 'fs-sm text-tertiary', style: { wordBreak: 'break-all' } },
          `document.featurePolicy.features() => 共 ${(info.features || []).length} 项（浏览器认知全集）`),
        info && Object.keys(info.allowlist).length > 0 && h('div', { class: 'fs-sm text-tertiary', style: { wordBreak: 'break-all' } },
          `getAllowlistForFeature：${Object.entries(info.allowlist).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' | ')}`),
        info && Object.keys(info.allowsFeature).length > 0 && h('div', { class: 'fs-sm text-tertiary', style: { wordBreak: 'break-all' } },
          `allowsFeature 探测：${Object.entries(info.allowsFeature).map(([f, per]) =>
            `${f}{self=${per.self},trusted=${per['https://trusted.example.com']},evil=${per['https://evil.example.com']}}`).join(' | ')}`),
        h('div', { class: 'fs-sm text-secondary' }, 'Permissions-Policy HTTP 头语法（逗号分隔多特性 / self|none|*|源 / 嵌套括号）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } },
          h('code', {}, PP_HTTP_HEADER_SYNTAX)),
        h('div', { class: 'fs-sm text-secondary' }, 'iframe allow 属性（与 HTTP 头协同，allowfullscreen → fullscreen 映射，srcdoc 继承基线）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, PP_IFRAME_ALLOW_ATTR)),
        h('div', { class: 'fs-sm text-secondary' }, '特性列表全集（约 50+ 项，节选）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, PP_FEATURES_LIST)),
        h('div', { class: 'fs-sm text-secondary' }, 'document.featurePolicy / document.policy JS API（allowedFeatures / allowsFeature / features / getAllowlistForFeature，浏览器支持差异）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, PP_FEATUREPOLICY_JS_API)),
        h('div', { class: 'fs-sm text-secondary' }, '实战 1：第三方 iframe 沙箱（嵌入不可信内容 / 禁用 camera/mic/usb / 仅允许必要特性 / 与 sandbox 协同 / CSP frame-src）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, PP_THIRD_PARTY_SANDBOX)),
        h('div', { class: 'fs-sm text-secondary' }, '实战 2：自家页面策略（禁用同步 script / 限制 camera 仅 self / 第三方分析白名单 / 与 COOP/COEP 协同）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, PP_OWN_PAGE_STRATEGY)),
        h('div', { class: 'fs-sm text-secondary' }, '陷阱（特性名映射 / 与 sandbox 区别 / report-only / 浏览器差异 / DevTools Network 查看头 / iframe allow 与 HTTP 头优先级）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, PP_PITFALLS)),
        h(Alert, {
          type: 'info',
          message: 'Permissions Policy 与 Card 3 的关系',
          description: 'Card 3 仅简要演示 iframe.permissionsPolicy 与 storageAccess；本卡为深度专题，覆盖 HTTP 头语法、iframe allow、特性全集、document.featurePolicy JS API、第三方沙箱、自家策略与陷阱。两者互补，不重复演示同一 API。',
        }),
      ),
    );
    this.registerChild(card);
    return card.render();
  }

  _renderLogPanel() {
    const s = this.state;
    const card = new Card({
      title: '事件日志',
      extra: h(Tag, { color: 'primary' }, `${s.logs.length} 条`),
    }, s.logs.length === 0
      ? h('div', { class: 'log-panel__empty fs-sm text-tertiary' }, '（暂无日志）')
      : h('div', { class: 'log-panel' },
          h('div', { class: 'log-panel__header' }, '事件日志'),
          ...s.logs.map((log) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
        ));
    this.registerChild(card);
    return card.render();
  }
}
