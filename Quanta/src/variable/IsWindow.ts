/**
 * IsWindow.ts
 * @author LiuQi
 *
 * 判断传入的值是否为浏览器环境中的 window 对象。
 *
 * 原理：在浏览器中，window 对象具有一个特殊的属性 window，且该属性指向自身，
 * 即 window.window === window 为 true。因此可通过这一特性判断对象是否为 window。
 *
 * 注意事项：
 * - 该函数仅在浏览器环境下有效，因为 window 对象是浏览器特有的全局对象。
 * - 如果传入值不是对象或为 null，函数将安全地返回 false。
 * - 不适用于 Node.js 等非浏览器环境（那里没有 window 对象）。
 */
export function isWindow(value: any): boolean {
    return value !== null && value === value.window;
}