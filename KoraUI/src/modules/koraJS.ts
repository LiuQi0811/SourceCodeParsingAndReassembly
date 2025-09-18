/**
 * 作用：封装模块，避免全局污染，支持链式调用。
 *
 * 关键机制：
 *
 * koraJS 是入口函数。
 *
 * koraJS.fn 是原型对象，存放所有公共方法。
 *
 * init 是真正的构造函数，实例化后能访问 koraJS.fn 的方法。
 */
(function (global, factory) {
    "use strict";
    console.log("[IIFE] 使用箭头函数，模块系统封装开始");
    if (typeof module === "object" && typeof module.exports === "object") {
        module.exports = global.document ? factory(global, true)
            : function (D: any) {
                if (!D.document) throw new Error("koraJS requires a window with a document");
                return factory(D);
            }
    } else {
        factory(global);
    }
})(typeof window !== 'undefined' ? window : this, function (window: any, noGlobal?: any) {
    "use strict";

    interface KoraJS {
        (selector: any, context?: any): any;

        fn: {
            initialize: new (selector: any, context?: any) => KoraJS;
        };
    }

    console.log("[Factory] 模块逻辑执行，global:", window);
    const koraJS: KoraJS = (function (): KoraJS {
        const _koraJS = function (selector: any, context?: any) {
            return new (_koraJS.fn.initialize)(selector, context);
        } as KoraJS;
        _koraJS.fn = {
            initialize: function (this: KoraJS, selector: any, context?: any) {
                // 初始化逻辑
                console.error(" csh project......")
            } as any
        };
        _koraJS.fn.initialize.prototype = _koraJS.fn;
        return _koraJS;
    })();

    typeof window.KoraUI === "object" && window.KoraUI.definitionModule(function (exports: Function) {
        window.KoraUI.K = koraJS;
        exports("koraJS", koraJS);
    });
    // 返回模块对外暴露的 API
    return koraJS;
});