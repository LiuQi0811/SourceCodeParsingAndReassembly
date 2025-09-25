/**
 * Document.ts
 * @author LiuQi
 */
// 安全地导出 document，兼容浏览器和 Node.js
export const document: Document | undefined =
    typeof window !== 'undefined' ? window.document : undefined;
