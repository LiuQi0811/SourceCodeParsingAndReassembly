/**
 * 作用：封装模块，避免全局污染，支持链式调用。
 *
 * 关键机制：
 *
 * koraJS 是入口函数。
 *
 * koraJS.fn 是原型对象，存放所有公共方法。
 *
 * initialize 是真正的构造函数，实例化后能访问 koraJS.fn 的方法。
 */
(function (global, factory) {
    "use strict";
    console.log("[IIFE] 使用箭头函数，模块系统封装开始");
    // 判断当前模块系统环境，支持 CommonJS / AMD / 浏览器全局
    if (typeof module === "object" && typeof module.exports === "object") {
        // Node.js 环境，支持 CommonJS 模块导出
        module.exports = global.document ? factory(global, true) // 如果有 document，说明是浏览器环境
            : function (D: any) {
                // 否则返回一个工厂函数，要求传入带有 document 的 window 对象
                if (!D.document) throw new Error("koraJS requires a window with a document");
                return factory(D);
            }
    } else {
        // 浏览器全局环境或其他，直接调用 factory(global)
        factory(global);
    }
})(typeof window !== 'undefined' ? window : this, function (window: any, noGlobal?: any) {
    "use strict";

    /**
     * TypeScript 类型定义：描述 koraJS 的整体结构
     *
     * koraJS 是一个函数，同时也是一个对象：
     * - 可被调用：koraJS(selector)
     * - 拥有 fn 属性：原型方法存放地
     * - 拥有 Extend 属性：扩展方法
     * - 允许通过字符串动态挂载属性/方法，比如 koraJS.自定义属性 = ...
     * @author LiuQi
     */
    interface KoraJS {
        (selector: any, context?: any): any; // koraJS 可被当作函数调用，如 koraJS('#id')

        [key: string]: any;// 允许通过字符串 key 动态挂载任意属性或方法
        fn: {
            initialize: new (selector: any, context?: any) => KoraJS; // 构造函数类，用于创建实例
            ready: new (fn: Function) => KoraJS; // （预留）DOM ready 回调构造函数
            extend: new () => KoraJS; // （预留）扩展方法构造函数
        };
        Extend: Function;  // 暴露的扩展方法，用于挂载工具方法
    }

    console.log("[Factory] 模块逻辑执行，global:", window);

    /**
     * koraJS 主函数体（IIFE 内部返回的模块主体）
     * 它是一个函数，同时通过原型链提供公共方法
     * @author LiuQi
     */
    const koraJS: KoraJS = (function (): KoraJS {
        /**
         * _koraJS 是实际的构造函数入口
         * 调用 koraJS(...) 时，实际是 new _koraJS.fn.initialize(...)
         */
        const _koraJS = function (selector: any, context?: any) {
            return new (_koraJS.fn.initialize)(selector, context); // 实例化真正的初始化类
        } as KoraJS;

        /**
         * _koraJS.fn 是原型对象，用于存放所有实例共享的方法
         */
        _koraJS.fn = {
            /**
             * initialize 是真正的“构造函数”类
             * 当你调用 new _koraJS.fn.initialize(selector) 时，会进入这里
             */
            initialize: function (this: KoraJS, selector: any, context?: any) {
                // initialize start .....
                if (!selector) return this;

                if (typeof selector === "string") {
                    console.warn(" // TODO typeof selector === \"string\" ");
                } else if (selector.nodeType) {
                    console.warn(" // TODO selector.nodeType ");
                } else if (isFunction(selector)) {
                    // 如果传入的是函数，可能是 ready 回调，或者是模块化加载函数
                    return koraJS.fn.ready !== undefined
                        ? new koraJS.fn.ready(selector) // 如果有 ready 构造函数，使用它
                        : selector(koraJS) // 否则直接调用该函数并传入 koraJS
                }
            } as any,
            /**
             * ready 方法（预留）
             * 目前只是占位，后续可实现 DOMContentLoaded 逻辑
             */
            ready: function (fn: Function) {
                console.warn(" READY !!!!! ", fn);
            } as any,
            /**
             * extend 方法（核心功能之一）
             * 用于扩展 koraJS 的静态方法
             */
            extend: function (extensions: any) {
                for (const key in extensions) {
                    if (extensions.hasOwnProperty(key)) {
                        koraJS[key] = extensions[key]; // 将扩展的属性/方法挂载到 koraJS 上
                    }
                }
            } as any
        };
        /**
         * 将 fn.extend 暴露为 koraJS 的静态方法 Extend
         * 用法：koraJS.Extend({ fn() { ... } })
         */
        _koraJS.Extend = _koraJS.fn.extend;
        /**
         * 原型继承：将 fn 设为 _koraJS.fn.initialize 的原型
         * 即：new _koraJS.fn.initialize() 的实例能访问 _koraJS.fn 上的属性和方法
         */
        _koraJS.fn.initialize.prototype = _koraJS.fn;
        // 返回最终的 koraJS 函数
        return _koraJS;
    })();

    /**
     * isFunction 是否函数
     * @param value
     */
    const isFunction = function (value: any) {
        return typeof value === "function"
            && typeof value.nodeType !== "number"
            && typeof value.item !== "function";
    }

    /**
     * 与外部模块系统（如 KoraUI）集成的逻辑
     * 如果存在 window.KoraUI 且定义了 definitionModule，则将 koraJS 暴露出去
     */
    typeof window.KoraUI === "object" && window.KoraUI.definitionModule(function (exports: Function) {
        window.KoraUI.K = koraJS;
        exports("koraJS", koraJS);
    });
    // 打印 fn，调试用
    console.warn(" KORA_JS_FN => ", koraJS.fn);
    // 返回模块的对外 API，即 koraJS 函数本身
    return koraJS;
});