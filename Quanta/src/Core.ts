/**
 * Core.ts
 * @author LiuQi
 */
let version = "@VERSION",
    rhtmlSuffix = /HTML$/i,
    /**
     * _Quanta 定义一个本地的 _Quanta 引用副本
     * @author LiuQi
     */
    _Quanta = function (selector?: any, context?: any) {
        // _Quanta 对象实际上只是 initialize 构造函数「增强后的版本」
        // 如果调用 _Quanta（比如 new _Quanta()），则需要 initialize 构造函数（如果没有包含 initialize，则允许抛出错误）
        return new _Quanta.fn.initialize(selector, context);
    } as { // 用类型断言 声明函数属性
        (selector?: any, context?: any): any;
        fn?: any;
        prototype?: any;
        extend?: any;
    };
_Quanta.fn = _Quanta.prototype = {
    // 当前正在使用的 Quanta 版本
    Quanta: version,
    constructor: _Quanta,
    // _Quanta 对象的默认长度是 0
    length: 0
};
/**
 * _Quanta.extend
 * @author LiuQi
 */
_Quanta.extend = _Quanta.fn.extend = function () {
    let options, name, copy,
        target: IArguments | any = arguments[0] || {},
        i: number = 1,
        length: number = arguments.length,
        deep: boolean = false;
    // Handle a deep copy situation (处理深拷贝的情况)
    if (typeof target === "boolean") {

    }
    // Handle case when target is a string or something (possible in deep copy) (处理目标为字符串或其他类型的情况（深拷贝中可能出现）)
    if (typeof target !== "object" && typeof target !== "function") {

    }
    // Extend _Quanta itself if only one argument is passed (如果只传入一个参数，则扩展 _Quanta 本身)
    if (i == length) {
        target = this;
        i--;
    }
    for (; i < length; i++) {
        // Only deal with non-null/undefined values (仅处理非 null/undefined 的值)
        if ((options = arguments[i]) !== null) {
            // Extend the base object ( 扩展基对象)
            for (let name in options) {
                copy = options[name];
                // Prevent Object.prototype pollution (防止 Object.prototype 污染)
                // Prevent never-ending loop (防止无限循环)
                if (name === "__proto__" || target === copy) {
                    continue;
                }
                // Recurse if we're merging plain objects or arrays ( 如果合并的是普通对象或数组，则递归处理)
                // TODO ......
                if (deep) {
                    console.warn(" Recurse if we're merging plain objects or arrays ");
                } else if (copy !== undefined) { // 对象不为空 直接处理
                    target[name] = copy; // 函数方法关键处理 比如 Extend({ 自定义的函数})
                }
            }
        }
    }
    // Return the modified object ( 返回修改后的对象)
    return target;
};
export {_Quanta, _Quanta as _Q};