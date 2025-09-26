/**
 * Class2type.ts
 * @author LiuQi
 *
 * 该模块导出一个 class2type 对象，用于存储对象类型标识符（如 "[object String]"）
 * 到可读类型名称（如 "string"）的映射关系。
 *
 * 通常与 Object.prototype.toString.call(value) 方法配合使用，
 * 以更准确地检测变量的真实类型（尤其对内置对象如 Array、Date 等）。
 *
 * 当前导出的是一个空的映射对象，需要填充具体的类型映射数据。
 */
export const class2type: { [key: string]: string } = {}; // 类型安全的类名-类型映射表
