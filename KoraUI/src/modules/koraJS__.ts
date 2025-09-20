/**
 * 作用：使用 ES6 Class 重构 koraJS，避免全局污染，支持链式调用。
 * 关键机制：
 * - KoraJS 是入口函数 / 类
 * - 使用 class Initialize 作为真正的构造函数
 * - 使用 static 方法扩展工具功能（如 Extend、Deferred）
 * - 支持模块化导出（CommonJS / AMD / 浏览器全局）
 */

(function (global, factory) {
    "use strict";
    console.log("[IIFE] 使用 Class 风格，模块系统封装开始");

    if (typeof module === "object" && typeof module.exports === "object") {
        // Node.js / CommonJS
        module.exports = global.document ? factory(global, true)
            : function (D: any) {
                if (!D.document) throw new Error("koraJS requires a window with a document");
                return factory(D);
            };
    } else {
        // 浏览器全局或其他
        factory(global);
    }
})(typeof window !== 'undefined' ? window : this, function (window: any, noGlobal?: any) {
    "use strict";

    // 工具：判断是否为函数
    const isFunction = (value: any): boolean => {
        return typeof value === "function" &&
            typeof value.nodeType !== "number" &&
            typeof value.item !== "function";
    };

    /**
     * KoraJS 主类（入口函数也是类）
     */
    class KoraJS {
        constructor(selector?: any, context?: any) {
            // 如果通过 new KoraJS(...) 调用，实际上会被工厂函数转成 new Initialize(...)
            // 这里可以留空，或者抛出提示，实际构造由内部的 Initialize 类处理
            if (new.target === KoraJS) {
                console.warn("请通过 koraJS(selector) 自动调用内部 Initialize 构造函数，而不是直接 new KoraJS()");
                return;
            }
        }

        /**
         * 静态方法：扩展工具方法（类似 jQuery.extend）
         */
        static Extend(extensions: Record<string, any>): void {
            for (const key in extensions) {
                if (extensions.hasOwnProperty(key)) {
                    (KoraJS as any)[key] = extensions[key];
                }
            }
        }

        /**
         * 静态方法：Deferred（简化实现，可后续完善 Promise 逻辑）
         */
        static Deferred(fn?: Function): void {
            console.warn("[KoraJS.Class] Deferred 方法（待完善 Promise 逻辑）");
            // 此处可以实现类似 jQuery.Deferred 的功能，比如基于 Promise
            // 暂时打印日志和占位
        }

        /**
         * 静态方法：E（占位工具方法）
         */
        static E(): void {
            console.warn("[KoraJS.Class] E 方法（占位）");
        }

        /**
         * 工具方法：判断是否是函数
         */
        static isFunction(value: any): boolean {
            return isFunction(value);
        }
    }

    /**
     * Initialize 类：真正的构造函数类，相当于原来的 _koraJS.fn.initialize
     * 用于实例化后提供链式调用和操作能力
     */
    class Initialize {
        constructor(selector?: any, context?: any) {
            if (!selector) return this;

            if (typeof selector === "string") {
                console.warn("[Initialize] selector 是字符串：", selector);
                // TODO: 可以在这里实现类似 jQuery 的选择器逻辑
            } else if (selector.nodeType) {
                console.warn("[Initialize] selector 是 DOM 节点：", selector);
                // TODO: 包装 DOM 节点
            } else if (KoraJS.isFunction(selector)) {
                console.warn("[Initialize] selector 是函数，可能为 ready 回调");
                // 可以在这里实现 DOM ready 逻辑，或者直接调用函数
                // 暂时直接调用
                selector(KoraJS);
            }
        }

        /**
         * 示例方法：可以继续添加如 .css(), .html() 等链式方法
         */
        public dummyMethod(): this {
            console.log("[Initialize] 调用了 dummyMethod，支持链式调用 this");
            return this;
        }
    }

    // 将 Initialize 作为 KoraJS 的实际构造入口
    // 即：koraJS(...) => new Initialize(...)
    const koraJS = function (selector?: any, context?: any): any {
        return new Initialize(selector, context);
    } as unknown as typeof KoraJS & { new (): never }; // 类型上做兼容，避免直接 new KoraJS()

    // 把静态方法拷贝到 koraJS 上（如 Extend, Deferred, E）
    Object.assign(koraJS, KoraJS);

    // 暴露 Extend 为静态工具（也可以直接用 KoraJS.Extend）
    koraJS.Extend = KoraJS.Extend.bind(KoraJS);
    koraJS.Deferred = KoraJS.Deferred.bind(KoraJS);
    koraJS.E = KoraJS.E.bind(KoraJS);

    // 可选：与外部模块系统集成（如 KoraUI）
    if (typeof window.KoraUI === "object" && window.KoraUI.definitionModule) {
        window.KoraUI.K = koraJS;
        window.KoraUI.definitionModule((exports: Function) => {
            window.KoraUI.K = koraJS;
            exports("koraJS", koraJS);
        });
    }

    // 打印调试信息
    console.warn("[KoraJS.Class] koraJS.fn 方法挂载完成（已重构为 Class）");
    console.warn("[KoraJS.Class] koraJS 实例化入口：koraJS(selector)", koraJS);

    // 返回对外暴露的 koraJS 函数
    return koraJS;
});