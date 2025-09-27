/**
 * ToType.ts
 * @author LiuQi
 *
 * 该模块导出一个函数 toType，用于精准地获取任意值的类型字符串表示。
 * 相比原生 typeof 操作符，toType 能够更准确地识别对象的具体类型，
 * 比如区分数组（"array"）、日期（"date"）、正则（"regexp"）等内置对象，
 * 而不仅仅是返回通用的 "object"。
 *
 * 实现原理：
 * 1. 对于 null 和 undefined，直接返回其字符串形式 "null" 和 "undefined"。
 * 2. 对于对象类型（typeof value === 'object'），通过调用 Object.prototype.toString.call(value)
 *    获取其内部类型标识（如 "[object Array]"），再通过 class2type 映射表查找对应的可读类型名，
 *    比如 "array"、"date"、"regexp" 等。如果查找不到，则返回默认值 "object"。
 * 3. 对于其他基本类型（如 string、number、boolean 等），直接返回 typeof value 的结果。
 *
 * 依赖：
 * - class2type：一个类型映射表对象，将 "[object Xxx]" 映射为可读的类型字符串（如 "array"）。
 * - toString：引用自 Object.prototype.toString 的方法，用于获取对象的内部类型标签。
 *
 * 返回值：
 * - 始终返回一个表示类型的字符串，比如 "string"、"number"、"array"、"date"、"object"、"null"、"undefined" 等。
 *
 * 使用场景：
 * - 在需要精确判断变量类型（尤其是内置对象类型）时使用，比如区分数组与普通对象、日期对象等。
 * - 适用于工具函数、类型检查、表单验证、日志输出等场景。
 *
 * 注意事项：
 * - 参数 value 的类型为 any，意味着可以传入任意值，但建议在实际项目中按需约束类型。
 * - class2type 映射表需要预先正确初始化（如包含 "[object Array]": "array" 等键值对），否则可能返回 "object"。
 */
import {class2type} from '../variable/Class2type.js';
import {toString} from '../variable/ToString.js';

export function toType(value: any) {
    if (value == null) return value + "";
    return typeof value === "object"
        ? class2type[toString.call(value)] || "object"
        : typeof value;
}