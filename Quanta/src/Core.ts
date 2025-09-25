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
    let target: IArguments = arguments[0] || {};
    console.warn(" EX", target, typeof target);
    return target;
};
export {_Quanta, _Quanta as _Q};