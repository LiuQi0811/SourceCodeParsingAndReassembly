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
})(typeof window !== "undefined" ? window : this, function (window: any, noGlobal?: any) {
    "use strict";

    /**
     * isFunction 是否函数
     * @param value
     * @author LiuQi
     */
    const isFunction = function (value: any) {
        return typeof value === "function"
            && typeof value.nodeType !== "number"
            && typeof value.item !== "function";
    }

    /**
     * isWindow
     * @param value
     * @author LiuQi
     */
    const isWindow = function (value: any) {
        return value !== null && value.window;
    }

    /**
     * toType
     * @param value
     * @author LiuQi
     */
    const toType = function (value: any) {
        if (value === null) return value + "";
    }

    /**
     * isArrayLike
     * @param value
     * @author LiuQi
     */
    const isArrayLike = function (value: any) {
        let length = !!value && "length" in value && value.length;
        let type = toType(value);
        if (isFunction(value) || isWindow(value)) return false;
        return type === "array"
            || length === 0
            || typeof length === "number" && length > 0 && (length - 1) in value;
    }

    /**
     * siblings
     * @author LiuQi
     */
    const siblings = function (node?: Node | null, element?: any) {
        const matches: Node[] = [];
        for (; node; node = node?.nextSibling) {
            if (node.nodeType === 1 && node !== element) {
                matches.push(node);
            }
        }
        return matches;
    }


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
        (selector?: any, context?: any): any; // koraJS 可被当作函数调用，如 koraJS('#id')

        [key: string]: any;// 允许通过字符串 key 动态挂载任意属性或方法
        fn: {
            initialize: new (selector: any, context?: any) => KoraJS; // 构造函数类，用于创建实例
            ready: new (fn: Function) => KoraJS; // （预留）DOM ready 回调构造函数
            koraEach: new (fn: Function) => KoraJS; // koraEach
            koraChildren: new (data: string) => KoraJS; // koraChildren
            koraPushStack: (element: Record<string, any>) => any;
            KoraJSConstructor: KoraJS;
            length: number;
            koraFind: (selector: Record<string, any>, context: Document, results: any, seed?: any) => any;
        };
        Extend: (extensions: Record<string, any>) => void;  // 暴露的扩展方法，用于挂载工具方法
        Each: (extensions: Record<string, any>) => void;  // 暴露的扩展方法，用于挂载工具方法
    }

    /**
     * createExtender  创建一个通用的“挂载器”，用于将方法挂载到 koraJS
     * @author LiuQi
     */
    const createExtender = function (target: any) {
        return function (extensions: Record<string, any>) {
            for (const key in extensions) {
                if (extensions.hasOwnProperty(key)) {
                    target[key] = extensions[key]; // 将扩展的属性/方法挂载到 koraJS 上
                }
            }
        }
    } as any;

    console.log("[Factory] 模块逻辑执行，global:", window);

    /**
     * koraJS 主函数体（IIFE 内部返回的模块主体）
     * 它是一个函数，同时通过原型链提供公共方法
     * @author LiuQi
     */
    const koraJS: KoraJS = (function (): KoraJS {
        // SIMPLE_IDENTIFIER_PATTERN
        const SIMPLE_IDENTIFIER_PATTERN: RegExp = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/;
        // TAG_OR_HASH_ID_PATTERN
        const TAG_OR_HASH_ID_PATTERN: RegExp = /^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]+))$/;
        /**
         * _koraJS 是实际的构造函数入口
         * 调用 koraJS(...) 时，实际是 new _koraJS.fn.initialize(...)
         */
        const _koraJS = function (selector: any, context?: any) {
            console.log(" KoraJS -> " ,selector, context);
            return new (_koraJS.fn.initialize)(selector, context); // 实例化真正的初始化类
        } as KoraJS;

        /**
         * _koraJS.fn 是原型对象，用于存放所有实例共享的方法
         */
        _koraJS.fn = {
            KoraJSConstructor: _koraJS,
            length: 0,
            /**
             * initialize 是真正的“构造函数”类
             * 当你调用 new _koraJS.fn.initialize(selector) 时，会进入这里
             */
            initialize: function (this: KoraJS, selector: any, context?: any) {
                let match;
                // initialize start .....
                if (!selector) return this;

                if (typeof selector === "string") {
                    if (selector[0] === "<"
                        && selector[selector.length - 1] === ">"
                        && selector.length >= 3
                    ) {
                        match = [null, selector, null];
                    } else {
                        match = TAG_OR_HASH_ID_PATTERN.exec(selector);
                    }
                    if (match && (match[1] || !context)) {
                        alert(1);
                    } else if (!context || context.koraJS) {
                        return (context || koraJS).find(selector);
                    } else {
                        alert(3);
                    }
                    console.warn(" // TODO typeof selector === \"string\" ", match, context);
                } else if (selector.nodeType) {
                    console.warn(" // TODO selector.nodeType ");
                } else if (isFunction(selector)) {
                    // 如果传入的是函数，可能是 ready 回调，或者是模块化加载函数
                    return _koraJS.fn.ready !== undefined
                        ? new _koraJS.fn.ready(selector) // 如果有 ready 构造函数，使用它
                        : selector(_koraJS) // 否则直接调用该函数并传入 koraJS
                }
            } as any,
            /**
             * ready 方法（预留）
             * 目前只是占位，后续可实现 DOMContentLoaded 逻辑
             */
            ready: function (fn: Function) {
                console.log(" READY !!!!! ", fn);
            } as any,
            /**
             * koraEach
             * @author LiuQi
             */
            koraEach: function (this: any, callback: Function) {
                return _koraJS.each(this, callback);
            } as any,
            /**
             * koraChildren
             * @author LiuQi
             */
            koraChildren: function (data: string) {
                return _koraJS.children(data);
            } as any,
            /**
             * koraPushStack
             * @author LiuQi
             */
            koraPushStack: function (elements: Record<string, any>) {
                return _koraJS.pushStack(elements);
            } as any,
            /**
             * koraFind
             * @param selector
             * @param context
             * @param results
             * @param seed
             * @author LiuQi
             */
            koraFind: function (selector: Record<string, any>, context: Document, results: any, seed: any) {
                let m;
                let i;
                let element;
                let nodeId;
                let match;
                let groups;
                let newSelector;
                let newContext = context && context.ownerDocument;
                let nodeType = context ? context.nodeType : 9;
                results = results || [];
                // 如果选择器或上下文无效，则提前从函数调用中返回​
                if (typeof selector !== "string"
                    || !selector
                    || nodeType !== 1 && nodeType !== 9 && nodeType !== 11) return results;
                // 尽量在 HTML 文档中优先使用“查找（find）操作的快捷方式”（而不是“过滤（filter）操作”）
                if (!seed) {
                }
                // TODO ......................
            }
        };
        /**
         * 将 fn.extend 暴露为 koraJS 的静态方法 Extend
         * 用法：koraJS.Extend({ fn() { ... } })
         */
        _koraJS.Extend = createExtender(_koraJS);
        _koraJS.Each = createExtender(_koraJS);
        /**
         * 原型继承：将 fn 设为 _koraJS.fn.initialize 的原型
         * 即：new _koraJS.fn.initialize() 的实例能访问 _koraJS.fn 上的属性和方法
         */
        _koraJS.fn.initialize.prototype = _koraJS.fn;
        // 返回最终的 koraJS 函数
        return _koraJS;
    })();

    /**
     *  Extend Related Core
     *  @author LiuQi
     */
    koraJS.Extend({
        /**
         * Deferred
         * @param fn
         * @constructor
         * @author LiuQi
         */
        Deferred: function (fn: Function) {
            let tuples: [(string | number)[], (string | number)[], (string | number)[]] = [
                ["notify", "progress", 2],
                ["resolve", "done", 0, "resolved"],
                ["reject", "fail", 1, "rejected"]
            ];
            const state: string = "pending";
            const promise = {};
        },
        /**
         * each
         * @param data
         * @param callback
         * @author LiuQi
         */
        each: function (data: any, callback: any) {
            let length;
            let i = 0;
            if (isArrayLike(data)) {
                length = data.length;
                for (; i < length; i++) {
                    if (callback.call(data[i], i, data[i]) === false) break;
                }
            } else {
                for (let key in data) {
                    if (callback.call(data[key], key, data[key]) === false) break;
                }
            }
            return data;
        },
        /**
         * find
         * @param selector
         * @author LiuQi
         */
        find: function (selector: Record<string, any>) {
            let i;
            let result;
            let length = this.length
            let self = this;
            if (typeof selector !== "string") {
                alert(" -----1")
            }
            result = this.pushStack([]);
            for (i = 0; i < length; i++) {
                koraJS.fn.koraFind(selector, self[i], result);
            }
        },
        /**
         * pushStack
         * @param elements
         * @author LiuQi
         */
        pushStack: function (elements: Record<string, any>) {
            let result = this.merge(koraJS.fn.KoraJSConstructor(), elements);
            result.preventObject = this;
            return result;
        },
        /**
         * merge
         * @param value
         * @param value_
         * @author LiuQi
         */
        merge: function (value: any, value_: any) {
            let length: number = +value_.length;
            let k: number = 0;
            let m: number = value.length;
            for (; k < length; k++) {
                value[m++] = value_[k];
            }
            value.length = m;
            return value;
        }
    });

    /**
     *  Each Related Core
     *  @author LiuQi
     */
    koraJS.Each({
        children: function (element: HTMLElement) {
            console.warn(" Element => ", element);
            return siblings(element.firstChild);
        }
    });

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
})
;