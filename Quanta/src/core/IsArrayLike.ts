/**
 * IsArrayLike.ts
 * @author LiuQi
 *
 * 该模块导出一个函数 isArrayLike，用于判断一个值是否是“类数组”（array-like）对象。
 *
 * 什么是类数组对象？
 * - 不是真正的数组（Array），但具有数字索引和 length 属性，比如：
 *   - arguments 对象
 *   - NodeList
 *   - HTMLCollection
 *   - 字符串（String）
 *   - 普通对象（如 { length: 3 }）
 * - 类数组对象通常可以使用数字索引访问，且拥有一个 >= 0 的整数 length 属性。
 * 依赖：
 * - toType：用于更准确地判断 value 的类型（比如区分 array、object 等）。
 * - isWindow：用于排除 window 对象（避免误判）。
 * 返回值：
 * - boolean：如果 value 是类数组对象则返回 true，否则返回 false。
 */
import {toType} from './ToType.js';
import {isWindow} from '../variable/IsWindow.js';

export function isArrayLike(value: any) {
    let length: any = !!value && value.length,
        type: string = toType(value);
    if (typeof value === "function" || isWindow(value)) return false;
    return type === "array"
        || length === 0
        || typeof length === "number" && length > 0 && (length - 1);
}