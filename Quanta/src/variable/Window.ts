/**
 * Window.ts
 * @author LiuQi
 *
 * 该模块用于安全地获取当前运行环境中的全局对象（浏览器中的 window 或服务端中的 globalThis），
 * 并将其导出为常量 _window，以便在跨平台（如 SSR、Node.js、浏览器）代码中统一使用。
 *
 * 实现方式：
 * - 通过 typeof window !== 'undefined' 判断当前是否为浏览器环境。
 * - 如果是浏览器，则 _window 为 window 对象；否则为 globalThis（通常是 Node.js 的全局对象）。
 *
 * 类型定义：
 * - WindowLike: 表示可能是 Window（浏览器全局对象）或 typeof globalThis（服务端全局对象）。
 *
 * 使用场景：
 * - 在需要兼容客户端和服务端渲染（SSR）、或不确定运行环境的情况下，
 *   安全地访问全局对象及其属性（如 window.document、globalThis.xxx）。
 *
 * 注意事项：
 * - _window 在浏览器中是 window，在 Node.js 中是 globalThis，二者 API 可能不同，使用前请做好环境判断。
 * - 推荐在使用 _window 的特定属性（如 document、navigator）前，先判断其是否存在。
 */
type WindowLike = Window | typeof globalThis;
export const _window: WindowLike = typeof window !== "undefined" ? window : globalThis;