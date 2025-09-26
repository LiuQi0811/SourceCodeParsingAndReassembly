/**
 * ToString.ts
 * @author LiuQi
 * 该模块导出了一个名为 toString 的函数，该函数实际引用了从 ./Class2type.js 导入的 class2type 对象的 toString 属性。
 */
import {class2type} from './Class2type.js';

export const toString: () => string = class2type.toString;