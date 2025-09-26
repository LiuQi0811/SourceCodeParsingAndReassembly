/**
 * Document.ts
 * @author LiuQi
 *
 * 安全导出浏览器中的 document 对象，兼容非浏览器环境（如 Node.js 或服务端渲染 SSR）。
 *
 * 导出的 document 类型为 Document | undefined：
 * - 在浏览器中，值为 window.document（即真实的 DOM 文档对象）。
 * - 在非浏览器环境（如 Node.js），值为 undefined。
 *
 * 该导出用于在 TypeScript 项目中安全地引用 document，避免直接访问 window.document
 * 导致的运行时错误（如在服务端环境中 window 未定义）。
 *
 * 使用前请先判断 document 是否为 undefined，例如：
 * if (document) {
 *   // 安全使用 document 对象
 * }
 *
 * 注意：此 document 是模块内导出的常量，与全局的 window.document 不冲突。
 */
export const document: Document | undefined =
    typeof window !== "undefined" ? window.document : undefined; // 安全地导出 document，兼容浏览器和 Node.js
