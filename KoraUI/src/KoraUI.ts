/**
 * 内置模块配置接口
 * 定义了系统内置的几个核心模块名称
 */
interface BuiltinModules {
    /**
     * Kora 元素模块名称
     * 用于标识元素操作相关的核心模块
     */
    koraElement: string;
    /**
     * Kora 弹层模块名称
     * 用于标识弹层/对话框相关的核心模块
     */
    koraLayer: string;
    /**
     * Kora 工具模块名称
     * 用于标识工具函数相关的核心模块
     */
    koraUtil: string;

    /**
     * Kora ALl
     */
    koraAll: string;
    koraJS: string;
    /**
     * Kora  聚合标识
     * 功能性的，非真实模块
     */
    "koraUI.all": string

}


/**
 * 系统配置接口
 * 定义了整个系统或模块的配置选项
 */
interface Config {
    /**
     * 超时时间配置
     * 单位：毫秒(ms)
     * 用于设置请求、操作或任务的超时限制
     */
    timeout: number;
    /**
     * 调试模式开关
     * 当设置为 true 时，系统会输出详细的调试信息
     * 用于开发环境的问题排查
     */
    debugMode: boolean;
    /**
     * 版本标识
     * 通常用于标识当前配置或系统的版本号
     * 注意：根据实际需求可能需要调整类型(当前定义为boolean可能有误)
     */
    enabledVersion: boolean;
    version: string;
    /**
     * 基础目录路径配置
     * 可选配置项，如果未提供则使用默认路径
     * 用于指定某些资源的基础存放位置
     */
    dir?: string;
    /**
     * 内置模块配置
     * 可选配置项，包含系统内置的核心模块名称
     */
    builtin?: BuiltinModules;
    /**
     * 主机地址配置
     * 可选配置项，用于指定服务主机地址
     */
    host?: string;
    base?: string;
}

/**
 * Cache_ 缓存系统接口定义
 * 用于规范缓存数据的结构和组织方式
 */
interface Cache_ {
    /**
     * 模块缓存对象
     * 用于存储已加载的模块信息
     * 键值对形式：模块标识符 -> 模块数据
     */
    modules: {
        [key: string]: any;  // 使用索引签名表示可以存储任意字符串键和任意类型的值
    };

    /**
     * 状态缓存对象
     * 用于存储系统或模块的状态信息
     * 键值对形式：状态标识符 -> 状态数据
     */
    status: {
        [key: string]: any;  // 使用索引签名表示可以存储任意字符串键和任意类型的值
    };

    /**
     * 事件缓存对象
     * 用于存储事件监听器或事件相关数据
     * 键值对形式：事件名称 -> 事件数据/监听器
     */
    event: {
        [key: string]: any;  // 使用索引签名表示可以存储任意字符串键和任意类型的值
    };

    /**
     * 回调函数缓存对象
     * 用于存储回调函数引用
     * 键值对形式：回调标识符 -> 回调函数
     */
    callback: {
        [key: string]: Function;  // 明确指定值为函数类型
    };
}

/**
 * 扩展 HTMLScriptElement 类型，添加 readyState 属性
 */
interface HTMLScriptElement {
    readyState?: "loading" | "interactive" | "complete"; // 定义可能的 readyState 值
}

/**
 * IClass Class 拓展接口 TS this支持
 */
interface IClass {
    koraVersion: string;
}

/**
 * 立即执行函数表达式 (IIFE)，接收 window 对象作为参数，并显式声明其类型为 Window & typeof globalThis
 * 这种写法确保了在函数内部可以安全地访问 window 和全局对象 (globalThis) 的属性和方法
 *
 */
((window: Window & typeof globalThis): void => {
    'use strict'; // 启用严格模式，帮助捕获常见错误（如未声明变量、只读属性赋值等）
    // 从 window 对象中显式获取 document 和 location 对象，并声明其类型
    const document: Document = window.document; // document 对象，用于操作 DOM
    const location: Location = window.location; // location 对象，用于获取或操作当前 URL

    // 定义配置对象 config，类型为 Config 接口
    // 包含超时时间、调试模式、版本标识等配置项
    const config: Config = {
        timeout: 10, // 超时时间（单位：毫秒），默认值为 10
        debugMode: false, // 是否启用调试模式，默认关闭
        enabledVersion: false, // 版本标识（布尔值），当前未启用版本控制
        version: "6.7.0"
    };

    /**
     * cache 初始化缓存对象
     * 创建一个符合 Cache_ 接口规范的空缓存结构
     */
    const cache: Cache_ = {
        /**
         * 初始化模块缓存
         * 初始为空对象，后续可动态添加模块缓存
         */
        modules: {},
        /**
         * 初始化状态缓存
         * 初始为空对象，后续可动态添加状态数据
         */
        status: {},
        /**
         * 初始化事件缓存
         * 初始为空对象，后续可动态添加事件监听
         */
        event: {},
        /**
         * 初始化事件缓存
         * 初始为空对象，后续可动态添加事件监听
         */
        callback: {}
    };

    // 定义一个空的 Class 构造函数
    // 目前 Class 内部没有具体实现，可能是一个占位符或待扩展的基类
    const Class = function (this: IClass) {
        // Class 构造函数体（当前为空）
        this.koraVersion = "6.7.0";
    };


    // 定义全局对象 GLOBAL，并初始化为 window.KoraUIGlobal 或空对象
    // 如果 window.KoraUIGlobal 存在，则使用它；否则使用空对象 {}
    // 这种写法确保了 GLOBAL 对象至少是一个对象，避免访问未定义属性时报错
    // @ts-ignore
    const GLOBAL: { dir?: string } = window.KoraUIGlobal || {};

    /**
     * getPath 获取 KoraUI 所在目录
     *  定义 getPath 函数的返回值类型为字符串
     *  该函数用于动态获取当前脚本所在的目录路径
     */
    const getPath: string = (function (): string {
        // 定义 jsPath 变量，用于存储当前脚本的路径，初始值为空字符串
        let jsPath: string = "";

        // 如果 document.currentScript 存在且其标签名为 'SCRIPT'，直接使用其 src 属性
        // document.currentScript 是浏览器提供的属性，指向当前正在执行的 <script> 标签
        if (document.currentScript && document.currentScript.tagName.toUpperCase() === "SCRIPT") {
            // 检查 currentScript 是否有 src 属性（避免访问未定义属性）
            if ("src" in document.currentScript) {
                // 如果存在 src 属性，则将其值赋给 jsPath
                jsPath = document.currentScript.src;
            }
        } else {
            // 备选方案：如果 document.currentScript 不可用，则通过遍历所有 <script> 标签查找路径
            // document.getElementsByTagName('script') 返回一个 HTMLCollection，包含所有 <script> 标签
            const scripts: HTMLCollectionOf<HTMLScriptElement> = document.getElementsByTagName("script");
            const last: number = scripts.length - 1; // 获取最后一个 <script> 标签的索引
            let src: string | undefined; // 定义 src 变量，用于存储找到的脚本路径

            // 从后向前遍历 <script> 标签（从最后一个到第二个，索引从 last 到 1）
            // 这种遍历方式是为了找到最近加载的、状态为 'interactive' 的脚本
            for (let i: number = last; i > 0; i--) {
                // 检查当前 <script> 标签的 readyState 是否为 'interactive'
                // readyState 表示脚本的加载状态：
                // 'loading'：正在加载
                // 'interactive'：已加载完成，但尚未执行完毕
                // 'complete'：已加载并执行完毕
                if (scripts[i].readyState === "interactive") {
                    // 如果找到状态为 'interactive' 的脚本，则将其 src 赋值给 src 并跳出循环
                    src = scripts[i].src;
                    break;
                }
            }

            // 如果找到了符合条件的脚本路径（src 有值），则使用它；
            // 否则使用最后一个 <script> 标签的 src 作为备用路径
            // 注意：这里需要确保 scripts 集合不为空，否则访问 scripts[last] 会导致运行时错误
            if (scripts.length === 0) {
                // 如果 scripts 集合为空（理论上不应该发生），抛出错误提示
                throw new Error("No script tags found in the document");
            }
            // 将找到的路径（src 或 scripts[last].src）赋值给 jsPath
            jsPath = src || scripts[last].src;
        }

        // 返回 config.dir 或 jsPath 的目录部分（去掉文件名）
        // 同时将结果赋值给 config.dir，确保 config.dir 始终有值
        // jsPath.substring(0, jsPath.lastIndexOf('/') + 1) 用于提取路径的目录部分：
        // 例如，jsPath 为 "/path/to/script.js"，则结果为 "/path/to/"
        const directoryPath: string = GLOBAL.dir || jsPath.substring(0, jsPath.lastIndexOf('/') + 1);
        config.dir = directoryPath; // 将计算出的目录路径赋值给 config.dir

        return directoryPath; // 返回最终的目录路径
    })();

    /**
     * errorMessage 输出错误信息到控制台
     * @param message 错误消息
     * @param type 控制台方法类型，默认为 'log'
     */
    const errorMessage = function (message: string, type?: "log" | "warn" | "error" | "info" | "debug"): void {
        type = type || "log";
        window.console && console[type] && console[type]("KoraUI error hint: " + message);
    };

    // 创建内置模块配置对象
    const builtInModule: BuiltinModules = {
        /**
         * Kora 元素模块的标准名称
         */
        koraElement: "koraElement",
        /**
         * Kora 弹层模块的标准名称
         */
        koraLayer: "koraLayer",
        /**
         * Kora 工具模块的标准名称
         */
        koraUtil: "koraUtil",
        /**
         * Kora ALL
         */
        koraAll: "koraOmni-",
        koraJS: "koraJS",
        /**
         * Kora 聚合标识（功能性的，非真实模块）
         */
        "koraUI.all": "koraUI.all"
    };
    // 将内置模块配置赋值给 config 对象的 builtin 属性
    config.builtin = builtInModule;

    /**
     * 低版本浏览器兼容性检测
     * 检测当前浏览器是否支持 Object.assign 方法
     *
     * Object.assign 是 ES6 引入的 API，用于对象合并
     * 旧版浏览器（如 IE11 及以下）可能不支持此方法
     */
    if (typeof Object.assign !== "function") {
        // 如果当前环境不支持 Object.assign 方法
        console.error("当前浏览器不支持 Object.assign 方法！typeof Object.assign !== 'function'");
        // 这里可以添加 polyfill 或降级处理方案
        // 例如引入第三方 polyfill 或实现一个简易的替代方案
    }

    /**
     * onNodeLoad 节点加载回调函数
     * 用于给某个 DOM 元素（如 <script>、<img> 等）绑定加载完成（load）和加载失败（error）的事件监听，
     * 并兼容旧版 IE 的 attachEvent 方式（主要用于 IE8 及以下）。
     *
     * @param node 加载的 DOM 节点元素，类型为 HTMLElement（比如 <script>、<img> 等）
     * @param done 加载成功时触发的回调函数，参数为事件对象 Event；可以为 null
     * @param error 加载失败时触发的回调函数，参数为事件对象 Event；可以为 null
     */
    const onNodeLoad = function (node: HTMLElement,// 当前要监听加载事件的 DOM 节点，比如 <script> 或 <img>
                                 done: ((event: Event) => void) | null, // 加载成功时的回调，可选
                                 error: ((event: Event) => void) | null // 加载失败时的回调，可选
    ): void {
        console.error("节点加载触发中 ........");
        console.error("当前节点:", node);

        /**
         * completed 加载完成事件的处理函数
         * 当监听到 'load' 事件，或者某些元素（如 IE 中的 <script>）的 readyState 变为 'complete' 或 'loaded' 时触发
         * @param e 事件对象，类型为 Event
         */
        const completed = (e: Event): void => {
            const readyRegExp = /^(complete|loaded)$/; // 匹配 readyState 值为 'complete' 或 'loaded' 的正则
            // 尝试将事件源 e.currentTarget 断言为 HTMLElement | null
            const target = e.currentTarget as HTMLElement | null;
            // 判断是否为 'load' 事件，或者 target 存在并且有 readyState 属性，且其值为 'complete' 或 'loaded'
            if (
                e.type === "load" || // 标准的 load 事件
                (target && 'readyState' in target && readyRegExp.test((target as { readyState: string }).readyState)) // 针对某些元素如 <script> 的 readyState
            ) {
                removeListener();// 移除所有监听器，防止重复触发
                // 如果传入了 done 回调函数，则执行它
                typeof done === "function" && done(e);
            }
        };

        /**
         * onError 加载失败事件的处理函数
         * 当监听到 'error' 事件时触发
         * @param e 事件对象，类型为 Event
         */
        const onError = (e: Event): void => {
            removeListener(); // 移除监听器
            // 如果传入了 error 回调函数，则执行它
            typeof error === "function" && error(e);
        };

        /**
         * removeListener 移除事件监听器
         * 根据当前环境（是否支持 detachEvent），决定使用 detachEvent（IE8 及以下）还是 removeEventListener（现代浏览器）
         */
        const removeListener = (): void => {
            if ((node as any).detachEvent) {
                // 如果 node 有 detachEvent 方法（仅限 IE8 及以下，且通常是 window/document）
                // 注意：这里的类型断言 (node as any) 是为了绕过 TypeScript 的类型检查
                // 实际项目中建议更严格地判断 node 是否为 Window 或 Document
                (node as any).detachEvent("onreadystatechange", completed);// 移除 IE 的 onreadystatechange 事件
            } else {
                // 标准浏览器（包括 IE9+ 和所有现代浏览器）使用 removeEventListener 移除事件
                node.removeEventListener("load", completed, false);// 移除 load 事件
                node.removeEventListener("error", completed, false);// 移除 error 事件
            }
        };

        /**
         * 判断当前是否为 IE8 及以下环境
         * 通过判断 node 是否有 attachEvent 方法，并且该方法是原生代码（非被覆盖的）
         * 注意：IE11 已经移除了 attachEvent，所以这个判断在 IE11+ 会返回 false
         */
        if (
            // 检查是否是 IE8 及以下（通过判断 attachEvent 是否存在）
            // 注意：IE11 已经移除了 attachEvent，所以这个判断在 IE11+ 会直接返回 false
            (node as any).attachEvent &&
            !((node as any).attachEvent.toString && (node as any).attachEvent.toString().indexOf("[native code]") < 0)// 判断 attachEvent 是否是原生方法（避免被覆盖）
        ) {
            // 仅适用于 IE8 及以下，使用 attachEvent
            // 如果是 IE8 及以下，则使用 attachEvent 绑定 onreadystatechange 事件
            // 注意：这里的类型断言 (node as any) 是为了绕过 TypeScript 类型检查
            (node as any).attachEvent("onreadystatechange", completed);
        } else {
            // 现代浏览器（包括 IE11+）使用 addEventListener
            // 否则，使用标准的 addEventListener 绑定 load 和 error 事件（适用于现代浏览器，包括 IE9+ 和 IE11+）
            node.addEventListener("load", completed, false);// 监听 load 事件
            node.addEventListener("error", onError, false); // 监听 error 事件
        }
    };


    // 将配置对象和缓存对象合并，临时存储信息
    // 使用Object.assign进行浅拷贝合并
    Class.prototype.temporaryCacheInformation = Object.assign({}, config, cache);

    /**
     * globalConfig 设置全局配置
     * @param options 配置选项对象
     */
    Class.prototype.globalConfig = function (options: Record<string, any>) {
        console.error(" globalConfig ", "全局配置");
    };

    /**
     * definitionModule 定义模块及其依赖关系
     * 该方法用于定义一个模块（module），并指定其依赖项（dependencies），
     * 在依赖加载完成后，通过回调函数执行模块初始化逻辑，比如将模块接口挂载到全局对象。
     *
     * @param dependencies 模块的依赖项，类型为字符串或函数的数组，比如 ['dep1', 'dep2']，或者 []
     * @param callback 模块定义完成后的回调函数，用于在模块加载后执行初始化逻辑
     *                 回调函数接收两个可选参数：module（模块名）、exports（模块导出内容）
     */
    Class.prototype.definitionModule = function (dependencies: Array<string | Function>, callback: (module?: any, exports?: any) => void) {
        console.error(" definitionModule ", "定义模块 ", dependencies);
        console.error(" definitionModule ", "回调函数 ", callback);
        // 定义一个内部函数 useCallback，用于封装模块注册与回调逻辑
        const useCallback = () => {
            alert(" Use Callback")
            /**
             * setModule：将模块的导出内容挂载到 window.KoraUI 上，并标记模块状态为已完成
             * @param module 模块名称（字符串）
             * @param exports 模块导出的内容（对象、函数等）
             */
            const setModule = function (module: any, exports: any) {
                window.KoraUI[module] = exports; // 将模块接口赋值在KoraUI
                cache.status[module] = true; //  标记模块注册完成
            };
            // 如果传入的 callback 是函数，则执行它，并传入一个新的函数
            typeof callback === "function" && callback(function (module: any, exports: any): void {
                setModule(module, exports); // 调用 setModule，注册模块
                cache.callback[module] = function () {
                    callback(setModule); // 缓存回调
                }
            });
            return this;// 支持链式调用
        };
        // 如果 dependencies 是函数
        if (typeof dependencies === "function") {
            callback = dependencies;
            dependencies = [];
        }
        // 调用 this.useModules，传入依赖、回调、以及模块类型标识
        this.useModules(dependencies, useCallback, null, "definitionModule");
        return this;// 支持链式调用
    };

    // 在 Class 的原型上定义 useModules 方法
    // 该方法用于加载模块，接收四个参数：
    // - modules: 模块标识，可以是字符串、函数或字符串数组（比如模块名、或直接传入回调函数）
    // - callback: 模块加载成功后的回调函数（可选）
    // - exports: 导出对象，用于收集已加载模块的引用（类型暂定为 any[]，建议后续明确）
    // - from: 来源标识，标识模块加载的上下文或方式（类型暂定为 any，建议后续明确）
    Class.prototype.useModules = function (
        modules: string | Function | string[],// 模块标识：可以是字符串、函数或者字符串数组
        callback: Function | undefined, // 加载完成后的回调函数，可选
        exports: any[] = [],// 已加载模块的导出对象数组，默认为空数组
        from: any = {} // 标识模块加载来源，比如 'define' 或其他上下文，默认为空对象
    ): void {
        const _this = this;
        // 设置模块加载的基础路径 dir，优先使用 config.dir，否则使用 getPath（可能是一个函数或字符串）
        let dir: string = config.dir = config.dir ? config.dir : getPath;
        // 对 modules 参数进行标准化处理，统一转为字符串数组，便于后续遍历处理
        modules = (function (): string[] {
            if (typeof modules === "string") {
                // 如果 modules 是字符串，比如 "koraUI"，则转为单元素数组
                return [modules];
            } else if (typeof modules === "function") {
                // 如果传入的第一个参数是函数，则认为是把该函数当作回调，赋值给 callback
                callback = modules;
                // 并默认加载一个特殊模块 "koraAll"（可能是全部模块的集合）
                return ["koraAll"]
            }
            // 如果 modules 已经是数组，则直接使用
            return modules as string[];
        })();
        // 如果未配置 config.host（模块加载的基础域名/主机地址），则尝试从 dir 中解析，否则使用当前页面的 host
        if (!config.host) {
            const dirMatch = dir.match(/\/\/([\s\S]+?)\//);
            config.host = dirMatch ? dirMatch[0] : "//" + location.host + "/";
        }
        // 如果没有传入任何模块，或者传入的是空数组，则直接返回当前 Class 实例（支持链式调用）
        if (!modules) return _this;
        if (window.koraJS && window.koraJS.fn.on) {
            console.warn("window.koraJS  存在...... ");
        }
        console.error(" TODO ..... ", " koraJS 逻辑计算", window);
        // 如果未传入 exports，则初始化为空数组，用于存储已加载模块的引用
        exports = exports || [];
        // 如果传入的是多个模块，取第一个模块作为当前要处理的模块；否则直接使用 modules（字符串情况）
        const module: string = Array.isArray(modules) ? modules[0] : modules;

        // 从 this.recordAllModules 中获取当前模块的元信息（比如模块路径、是否外部模块、API 等）
        const moduleInfo: any = _this.recordAllModules[module];
        // 判断当前模块是否为外部模块：即 moduleInfo 是否是一个非空对象
        const isExternalModule: boolean = typeof moduleInfo === "object" && moduleInfo !== null;
        /**
         * onCallBack 模块加载成功后触发的回调函数
         */
        const onCallBack = function () {
            exports.push(window.KoraUI[module]);
            modules.length > 1
                ? _this.useModules(modules.slice(1), callback, exports, from)
                : (typeof callback === "function" && function () {
                    // TODO 保证文档加载完毕再执行回调
                    callback.apply(window.KoraUI, exports);
                }());
            console.warn(" use Module onCallBack 触发了回调 ", window.KoraUI);// 打印 KoraUI 对象，调试用
        };
        /**
         * pollingCallback 轮询模块加载状态的函数
         * 用于定时检查某个模块是否已经加载完成（比如通过检测 window[xxx] 或 cache.status[module]）
         * 如果超时仍未加载，则调用错误处理；如果加载完成，则触发 onCallBack
         */
        const pollingCallback = function (): void {
            console.error(" 触发了轮询回调 ", window.KoraUI, module);// 打印轮询触发日志
            let timeout: number = 0; // 超时计数器，单位为秒
            const delay: number = 5; // 每次轮询的间隔时间，单位毫秒
            /**
             * 内部立即执行的轮询函数
             */
            (function poll(): void {
                timeout++; // 每次调用增加超时计数
                /// 超过最大超时时间限制，则调用错误回调，提示模块无效
                if (timeout > config.timeout * 1000 / delay) {
                    return errorMessage(module + " is not a valid module", "error");
                }
                // 判断模块是否已加载完成：
                // - 如果是外部模块，则判断 window[moduleInfo.api] 是否被挂载到 window.KoraUI[module]
                // - 如果是内部模块，则判断 cache.status[module] 是否为真
                (isExternalModule ? window.KoraUI[module] = window[moduleInfo.api] : cache.status[module])
                    ? onCallBack() // 加载完成，触发回调
                    : setTimeout(poll, delay);// 未加载完成，继续轮询
            })();
        };
        // 如果模块为空，或者内置模块 koraUI.all 已加载且当前模块是内置模块，则直接触发回调并返回
        if (modules.length === 0 || (window.KoraUI["koraUI.all"] && builtInModule[module as keyof typeof builtInModule])) {
            return onCallBack(), _this;// 触发回调，并返回当前实例以支持链式调用
        }
        // 判断当前模块是外部模块还是内部模块，获取模块资源路径
        let modelSrc: string = isExternalModule
            ? moduleInfo.src // 外部模块：从 moduleInfo 中获取 src（可能是 JS 文件路径）
            : moduleInfo; // 内部模块：可能直接是路径或其他标识
        // 判断是否是内置模块，用于拼接基础路径
        const basePath: string | undefined = builtInModule[module as keyof typeof builtInModule]
            ? (dir + "modules/") // 如果是内置模块，拼接模块目录路径
            : (modelSrc ? "" : config.base);// 否则，如果 modelSrc 存在则不加前缀，否则使用 config.base
        // 如果未获取到模块路径，则默认使用模块名作为路径
        if (!modelSrc) {
            modelSrc = module;
        }
        // 清理模块路径中的空格和多余的 .js 后缀等字符
        modelSrc = modelSrc.replace(/\s/g, "")
            .replace(/\.js[^\/\.]*$/, "");
        // 拼接完整的模块 JS 文件 URL
        const fileUrl: string = basePath + modelSrc + ".js";
        // 如果模块已缓存且已挂载到 window.KoraUI，则更新缓存中的模块路径
        if (cache.modules[module] && window.KoraUI[module]) {
            cache.modules[module] = fileUrl;
        }
        // 如果模块尚未加载过，则动态创建 <script> 标签加载该模块
        if (!cache.modules[module]) {
            console.error(" 首次加载 模块"); // 打印首次加载日志
            const head: HTMLElement = document.getElementsByTagName("head")[0]; // 获取 <head> 元素
            const node: HTMLScriptElement = document.createElement("script"); // 创建 <script> 标签
            node.async = true; // 异步加载
            node.charset = "UTF-8"; // 设置字符集
            // 拼接模块 JS 文件的完整 URL，可包含版本号参数（用于缓存控制）
            node.src = fileUrl + function () {
                const version: string | number = config.enabledVersion === true ? config.version || (new Date().getTime()) // 如果启用版本控制，使用 config.version 或当前时间戳
                    : (config.version || "") // 否则使用 config.version 或空字符串
                return version ? ("?v=" + version) : ""; // 拼接 ?v=xxx 参数
            }();
            // 将 <script> 标签插入到 <head> 中，开始加载模块
            head.appendChild(node);
            // 监听模块加载完成事件
            onNodeLoad(node, (): void => {
                // 加载成功后，从 DOM 中移除 <script> 标签，并触发轮询回调以检测模块是否真正可用
                head.removeChild(node);
                pollingCallback();
            }, (): void => {
                // 加载失败后，移除 <script> 标签
                head.removeChild(node);
            });
            // 缓存当前模块的加载路径
            cache.modules[module] = fileUrl;
        } else {
            // 如果模块已经加载过，则直接触发轮询回调检测模块状态
            console.error(" 非首次加载....")
            pollingCallback();
        }
        // 返回当前 Class 实例，支持链式调用
        return _this;
    };

    /**
     * recordAllModules 记录所有内置模块（浅拷贝）
     * 将内置模块对象 builtInModule 进行浅拷贝后赋值给 Class.prototype.recordAllModules
     */
    Class.prototype.recordAllModules = Object.assign({}, builtInModule);

    /**
     * expansionModule 拓展模块功能
     * @param modules 要拓展的模块集合
     */
    Class.prototype.expansionModule = function (modules: any): void {
        console.error(" expansionModule ", " 拓展模块");
    };

    /**
     * discardTheSpecifiedModule 弃用指定模块
     * @param modules 要弃用的模块集合
     */
    Class.prototype.discardTheSpecifiedModule = function (modules: any): void {
        console.error(" discardTheSpecifiedModule ", " 弃用模块");
    };

    /**
     * getNodeAttributeStyleValues 获取节点样式属性值
     * @param node DOM节点元素
     * @param name 样式属性名称
     */
    Class.prototype.getNodeAttributeStyleValues = function (node: HTMLElement, name: string): void {
        console.error("getNodeAttributeStyleValues ", " 获取节点style");
    };

    /**
     * cssExternalLoader CSS外部加载器
     * @param href CSS文件链接地址
     * @param callback 加载完成回调
     * @param id 加载器标识
     */
    Class.prototype.cssExternalLoader = function (href: string, callback: Function, id: string | number): void {
        console.error("cssExternalLoader ", "CSS 外部加载器");
    };

    /**
     * cssInternalLoader CSS内部加载器
     * @param moduleName 模块名称
     * @param callback 加载完成回调
     * @param id 加载器标识
     */
    Class.prototype.cssInternalLoader = function (moduleName: string, callback: Function, id: string | number): void {
        console.error("cssInternalLoader ", "CSS 内部加载器");
    };

    /**
     * executeDefinitionModuleCallbackFactory 获取执行定义模块时的回调函数工厂（向下兼容）
     */
    Class.prototype.executeDefinitionModuleCallbackFactory = function (): void {
        console.error("executeDefinitionModuleCallbackFactory ", "获取执行定义模块时的回调函数，factory 为向下兼容");
    };

    /**
     * imagePreload 图片预加载
     * @param url 图片URL地址
     * @param callback 加载成功回调
     * @param error 加载失败回调
     */
    Class.prototype.imagePreload = function (url: string, callback: Function, error: Function): void {
        console.error("imagePreload ", "图片预加载");
    };

    /**
     * routeResolution 路由解析 - location.hash 方式
     * @param hash hash路由地址
     */
    Class.prototype.routeResolution = Class.prototype.hash = function (hash: string): void {
        console.error("routeResolution ", "location.hash 路由解析");
    };

    /**
     * urlResolution URL解析
     * @param href URL地址
     */
    Class.prototype.urlResolution = Class.prototype.hash = function (href: string): void {
        console.error("routeResolution ", "URL 解析");
    };

    /**
     * localPersistentStorage 本地持久化存储
     * @param tableName 存储表名
     * @param settings 存储配置
     * @param storage 存储对象
     */
    Class.prototype.localPersistentStorage = function (tableName: string, settings: any, storage: Storage): void {
        console.error("localPersistentStorage ", "本地持久存储");
    };

    /**
     * localTemporaryStorage s本地临时存储
     * @param tableName 存储表名
     * @param settings 存储配置
     */
    Class.prototype.localTemporaryStorage = function (tableName: string, settings: any): void {
        console.error("localTemporaryStorage ", "本地临时存储");
    };

    /**
     * equipmentInformation 设备信息获取
     * @param key 设备信息键名
     */
    Class.prototype.equipmentInformation = function (key: string): any {
        // 获取当前浏览器的用户代理字符串（User Agent String），并将其转换为小写形式
        // 用户代理字符串包含了浏览器的名称、版本、操作系统等信息，常用于浏览器检测
        const userAgent: string = navigator.userAgent.toLowerCase();
        /**
         * 定义一个名为 getVersion 的函数，用于从 userAgent 字符串中提取指定标签（如浏览器名称）对应的版本号
         * @param label {@link string} 要匹配的标签名称，比如 "chrome"、"safari"、"edge" 等，类型为字符串
         */
        const getVersion = function (label: string): string | false {
            // 构建一个正则表达式，用于从 userAgent 中匹配类似 "Chrome/120.0.0.0" 这样的字符串
            // 正则含义：
            //   label + "/" ：匹配传入的标签后跟一个斜杠，比如 "chrome/"
            //   ([^\s\_\-]+) ：捕获组，匹配一个或多个字符，这些字符不能是空格(\s)、下划线(_)或连字符(-)
            //                  目的是匹配版本号，比如 "120.0.0.0"
            const regExp = new RegExp(label + "/([^\\s\\_\\-]+)");
            // 使用正则表达式在 userAgent 中进行匹配
            // userAgent.match(regExp) 返回一个匹配结果数组，如果没有匹配到，则返回 null
            // 为了防止 null 导致的报错，使用 || [] 将 null 转为空数组
            // 然后通过 [1] 取出正则中第一个捕获组的内容，也就是版本号部分
            // 如果没有匹配到，label 最终会是 undefined
            label = (userAgent.match(regExp) || [])[1];
            // 如果成功提取到了版本号（label 有值），则返回该版本号；否则返回 false
            return label || false;
        }
        // 定义一个变量 result，它的类型可以是空对象 {} 或任意类型 any，
        // 初始值是一个包含多个检测结果的对象
        let result: {} | any = {
            // 检测操作系统类型，通过正则匹配 userAgent 字符串来判断
            os: function () {
                if (/windows/.test(userAgent)) {
                    return "windows"; // 匹配到 windows，返回 "windows"
                } else if (/linux/.test(userAgent)) {
                    return "linux";  // 匹配到 linux，返回 "linux"
                } else if (/iphone|ipod|ipad|ios/.test(userAgent)) {
                    return "ios"; // 匹配到 iphone、ipod、ipad 或 ios，返回 "ios"
                } else if (/mac/.test(userAgent)) {
                    return "mac"; // 匹配到 mac，返回 "mac"
                }
            }(), // 立即执行函数，将返回值赋给 os
            // 检测是否为 IE 浏览器，以及其版本号
            ie: function () {
                // 判断是否存在 ActiveXObject（IE 特有）或者全局是否有 ActiveXObject 属性
                return (!!window.ActiveXObject || "ActiveXObject" in window)
                    ? ((userAgent.match(/msie\s(\d+)/) || [])[1] || "11") // 如果是 IE，尝试从 userAgent 中提取版本号，如 msie 10，取数字部分；如果没有匹配到，默认返回 "11"
                    : false; // 不是 IE，返回 false
            }(),// 立即执行函数，将返回值赋给 ie
            // 获取微信浏览器的版本信息，调用了一个名为 getVersion 的函数，参数是 "micromessenger"
            wechat: getVersion("micromessenger")
        };
        // 如果传入了 key 参数，并且 result 中没有该 key 对应的值（即 result[key] 为假值）
        if (key && !result[key]) {
            // 则调用 getVersion 函数，传入 key，将返回的版本信息赋值给 result[key]
            result[key] = getVersion(key);
        }
        // 移动设备
        // 检测是否为 Android 设备：如果 userAgent 中包含 android，则为 true
        result.android = /android/.test(userAgent);
        // 将之前 os 检测中返回的 "ios" 字符串，转换为布尔值 true（表示是 iOS 设备）
        result.ios = result.ios === "ios";
        // 判断是否为移动设备：只要 是 android 或 ios 其中之一，就是移动设备
        result.mobile = (result.android || result.ios);
        // 最终返回这个包含操作系统、浏览器、设备类型等信息的对象
        return result;
    };

    /**
     * prompt 通用提示功能
     */
    Class.prototype.prompt = function (): { errorMessage: Function } {
        return {
            errorMessage: errorMessage
        };
    };

    /**
     * typeofRefinement 类型细化检查
     * 该方法用于对任意值进行更细致的类型判断，特别是在基础 `typeof` 操作不够精确时（比如 object / function 类型），
     * 通过 Object.prototype.toString 获取更准确的内部类型标识，比如 Array、Date、RegExp 等。
     * @param operand 要检查的操作数（任意类型的值）
     * @returns 返回一个表示操作数类型的字符串，比如 "string"、"number"、"array"、"date"、"object" 等
     */
    Class.prototype.typeofRefinement = Class.prototype.type = function (operand: any) {
        // 如果操作数是 null，直接返回字符串 "null"（因为 typeof null === "object"，这是 JS 历史遗留问题）
        if (operand === null) return String(operand); // 返回 "null"
        // 如果操作数是 object 类型 或 function 类型，则进行更深入的类型判断
        return (
            typeof operand === "object"
            ||
            typeof operand === "function")
            // 如果是 object 或 function，使用 Object.prototype.toString.call 获取标准类型标签
            ? function () {
                // 调用 Object.prototype.toString 方法，得到类似 "[object Array]"、"[object Date]" 的字符串
                let prototype: any = Object.prototype
                    .toString
                    .call(operand)
                    .match(/\s(.+)\]$/) || [];  // 正则提取中间的类型单词，比如 "Array"、"Date"
                // 从正则匹配结果中取出类型名，如果没有匹配到，默认为 "Object"
                const classType: string = "Function|Array|Date|RegExp|Object|Error|Symbol";
                prototype = prototype[1] || "Object"; // 比如得到 "Array"，或者默认 "Object"
                // 定义我们关心的内置类型，用正则去匹配 prototype（即刚取出的类型名）
                // 如果匹配成功，返回对应的小写类型名，比如 "array"、"date"、"regexp" 等
                // 如果没匹配上，就返回通用的 "object"
                return new RegExp("\\b(" + classType + ")\\b")
                    .test(prototype)
                    ? prototype.toLowerCase() // 比如 "Array" -> "array"
                    : "object"; // 默认返回 "object"
            }()
            : typeof operand;  // 如果不是 object 也不是 function，直接返回 JS 原生的 typeof 结果，比如 "string"、"number"、"boolean" 等
    };

    /**
     * arrayStructure / isArray 检查对象是否为数组或类数组结构
     * 该方法用于判断传入的任意值是否是一个数组（Array）或类数组对象（array-like object）。
     *
     * 所谓类数组对象，是指具有数字索引和 length 属性的对象，比如：
     *   - { 0: 'a', 1: 'b', length: 2 }
     *   - arguments 对象
     *   - DOM 集合（如 NodeList、HTMLCollection）
     *   - 或者自定义的对象模拟数组结构
     *
     * 该方法不仅会检查是否是原生的数组（通过 this.type === 'array'），
     * 还会检查是否是具有合法 length 属性、并且索引可访问的类数组对象。
     *
     * @param arbitrary 任意类型的值，可以是数组、对象、类数组、null、undefined 等
     * @returns 返回一个布尔值：
     *           - true：如果 arbitrary 是一个数组，或者是一个合法的类数组对象
     *           - false：如果 arbitrary 不是数组，也不是合法的类数组对象，或者为 null / undefined / window 等特殊情况
     */
    Class.prototype.arrayStructure = Class.prototype.isArray = function (arbitrary: any): boolean {
        // 调用 this.type(arbitrary)，返回该值的细化类型，比如 "array"、"object"、"string" 等
        const structType = this.type(arbitrary);
        // 如果 arbitrary 是假值（如 null、undefined、false）、
        // 或者它不是对象类型（typeof !== 'object'）、
        // 或者它是 window 对象（特殊全局对象，不是数组也不是类数组），
        // 则直接返回 false
        if (!arbitrary
            || (typeof arbitrary !== "object")
            || arbitrary === window) return false;
        // 检查该对象是否具有 "length" 属性，并获取其 length 值
        const arrayLen = "length" in arbitrary && arbitrary.length;
        // 判断条件汇总：
        // 1. structType === 'array' → 通过 type 方法判断它确实是数组（最直接的判断）
        // 2. arrayLen === 0         → 如果 length 为 0，可能是一个空数组或空类数组（合理存在）
        // 3. (typeof arrayLen === 'number' && arrayLen > 0 && (arrayLen - 1) in arbitrary)
        //    → 如果 length 是一个大于 0 的数字，并且该对象的索引 0, 1, ..., length-1 至少存在一个可访问的（验证类数组结构的合法性）
        return structType === "array"
            || arrayLen === 0
            || (typeof arrayLen === "number"
                && arrayLen > 0
                && (arrayLen - 1) in arbitrary);
    };

    /**
     * traverseEach 遍历每个元素
     * @param arbitrary 任意集合，可以是一个数组、对象、类数组等
     * @param fn 遍历回调函数，用于对每个元素/属性执行自定义逻辑
     * @returns 返回当前 Class 的实例（支持链式调用），即 this
     */
    Class.prototype.traverseEach = function (arbitrary: any, fn: Function): any {
        // 定义一个内部回调函数 callback
        // 它尝试调用传入的 fn，并将 this 绑定到 value[key]（通常是值本身），并传入 key 和 value[key]
        const callback = function (key: any, value: any) {
            // fn.call(value[key], key, value[key]) 的含义是：
            // - 将 fn 的 this 上下文绑定为 value[key]（即当前值）
            // - 并传入两个参数：key（键名）、value[key]（键对应的值）
            return fn.call(value[key], key, value[key]);
        }
        // 如果传入的 fn 不是一个函数，则直接返回当前实例（this），不执行遍历
        if (typeof fn !== "function") return this;
        // 如果没有传入 arbitrary（比如是 undefined 或 null），则默认设置为一个空数组 []
        arbitrary = arbitrary || [];
        // 判断 arbitrary 是否是一个数组（通过你之前定义的 this.isArray 方法）
        if (this.isArray(arbitrary)) {
            alert(" 数组结构");
        } else {
            // 如果不是数组，则认为它是一个对象（或类数组、类对象），使用 for...in 遍历它的可枚举属性
            for (let arbitraryKey in arbitrary) {
                // 调用 callback(arbitraryKey, arbitrary)
                if (callback(arbitraryKey, arbitrary)) break;
            }
        }
        // 返回当前实例
        return this;
    };

    /**
     * sort 排序功能
     * @param arbitraryArray 待排序数组
     * @param key 排序键名
     * @param description 排序描述/规则
     * @param noClone 是否不克隆数组
     */
    Class.prototype.sort = function (arbitraryArray: any[], key: string, description: any, noClone: boolean): void {
        console.error("sort ", "排序");
    };

    /**
     * preventEvents 阻止事件冒泡
     * @param arbitraryEvent 事件对象
     */
    Class.prototype.preventEvents = function (arbitraryEvent: any): void {
        console.error("preventEvents ", "阻止事件冒泡");
    };

    /**
     * moduleEvents 模块事件绑定
     * @param moduleName 模块名称
     * @param events 事件集合
     * @param callback 事件回调
     */
    Class.prototype.moduleEvents = function (moduleName: string, events: any, callback: Function): void {
        console.error("moduleEvents ", "模块事件");
    };

    /**
     * executeEvents 执行事件
     * @param moduleName 模块名称
     * @param events 事件集合
     * @param params 事件参数
     * @param fn 事件执行函数
     */
    Class.prototype.executeEvents = function (moduleName: string, events: any, params: any, fn: Function): void {
        console.error("executeEvents ", "执行事件");
    };

    /**
     * addEvents 添加事件监听
     * @param events 事件集合
     * @param moduleName 模块名称
     * @param callback 事件回调
     */
    Class.prototype.addEvents = function (events: any, moduleName: string, callback: Function): void {
        console.error("addEvents ", "添加事件");
    };

    /**
     * removeEvents 移除事件监听
     * @param events 事件集合
     * @param moduleName 模块名称
     */
    Class.prototype.removeEvents = function (events: any, moduleName: string): void {
        console.error("removeEvents ", "移除事件");
    };

    /**
     * debounce 函数防抖处理
     * @param func 要防抖的函数
     * @param delayed 延迟时间(毫秒)
     */
    Class.prototype.debounce = function (func: Function, delayed: number): void {
        console.error("debounce ", "防抖");
    };

    /**
     * throttle 函数节流处理
     * @param func 要节流的函数
     * @param delayed 节流时间间隔(毫秒)
     */
    Class.prototype.throttle = function (func: Function, delayed: number) {
        console.error("throttle ", "节流");
    };

    // 将 KoraUI 实例挂载到 window 对象上，使其成为全局可访问的对象
    // @ts-ignore 用于忽略 TypeScript 的类型检查错误（如果存在）
    // 这里可能是为了避免 TypeScript 报错（如 KoraUI 未在全局声明）
    window.KoraUI = new Class();

    // 打印错误日志，输出当前文档中的所有 <script> 标签
    // 这可能是为了调试目的，检查脚本加载情况
    console.error("KoraUI .....", document.getElementsByTagName("script"));
})(window); // 立即执行函数，传入 window 对象作为参数





