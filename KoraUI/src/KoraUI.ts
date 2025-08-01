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
    version: boolean;
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
 * 扩展 window 对象的类型定义，明确 KoraUIGlobal 的结构
 */
interface Window {
    KoraUIGlobal?: {
        dir?: string; // 扩展 window 对象，明确 KoraUIGlobal 的结构
    };
}

/**
 * 扩展 HTMLScriptElement 类型，添加 readyState 属性
 */
interface HTMLScriptElement {
    readyState?: 'loading' | 'interactive' | 'complete'; // 定义可能的 readyState 值
}

/**
 * 定义全局对象 KoraUIGlobal 的类型
 */
declare const KoraUIGlobal: {
    dir?: string; // KoraUIGlobal.dir 可能存在，也可能是 undefined
};

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
        version: false // 版本标识（布尔值），当前未启用版本控制
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
    const Class = function () {
        // Class 构造函数体（当前为空）
    };


    // 定义全局对象 GLOBAL，并初始化为 window.KoraUIGlobal 或空对象
    // 如果 window.KoraUIGlobal 存在，则使用它；否则使用空对象 {}
    // 这种写法确保了 GLOBAL 对象至少是一个对象，避免访问未定义属性时报错
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
        if (document.currentScript && document.currentScript.tagName.toUpperCase() === 'SCRIPT') {
            // 检查 currentScript 是否有 src 属性（避免访问未定义属性）
            if ("src" in document.currentScript) {
                // 如果存在 src 属性，则将其值赋给 jsPath
                jsPath = document.currentScript.src;
            }
        } else {
            // 备选方案：如果 document.currentScript 不可用，则通过遍历所有 <script> 标签查找路径
            // document.getElementsByTagName('script') 返回一个 HTMLCollection，包含所有 <script> 标签
            const scripts: HTMLCollectionOf<HTMLScriptElement> = document.getElementsByTagName('script');
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
        koraUtil: "koraUtil"
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
     * @param node 加载的DOM节点元素 (HTMLElement类型)
     * @param done 加载完成后的回调函数
     * @param error 加载失败时的回调函数
     */
    const onNodeLoad = function (node: HTMLElement, done: () => void, error: (error: Error) => void): void {
        console.error("节点加载触发中 ........");
        console.error("当前节点:", node);
        console.error("完成回调函数:", done);
        console.error("错误回调函数:", error);
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
     * @param dependencies 模块依赖数组
     * @param callback 模块定义完成后的回调函数
     */
    Class.prototype.definitionModule = function (dependencies: Array<string | Function>, callback: () => void): void {
        console.error(" definitionModule ", "定义模块");
    };

    // 在 Class 的原型上定义 useModules 方法
    // 该方法用于加载模块，接收四个参数：
    // - modules: 模块标识（类型暂定为 any，需根据实际需求明确）
    // - callback: 回调函数（类型暂定为 Function，需根据实际需求明确）
    // - exports: 导出对象（类型暂定为 any，需根据实际需求明确）
    // - from: 来源标识（类型暂定为 any，需根据实际需求明确）
    Class.prototype.useModules = function (modules: any, callback: Function, exports: any, from: any): void {
        let dir: string = config.dir = config.dir ? config.dir : getPath;
        modules = (function () {
            if (typeof modules === "string") {
                return [modules];
            } else if (typeof modules === "function") {
                callback = modules;
                return ["koraAll"]
            }
            return modules;
        })();

        if (!config.host) {
            config.host = (dir.match(/\/\/([\s\S]+?)\//) || ["//" + location.host + "/"])[0];
        }
        if (!modules) return this;

        exports = exports || [];
        const module = modules[0];
        console.error(" M ", module);
        const moduleInfo = this.recordAllModules[module];
        const isExternalModule = typeof moduleInfo === "object";
        const onCallBack = function () {
            console.error(" 触发了回调 ");
        };
        const pollingCallback = function () {
            console.error(" 触发了轮询回调 ");
        };
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
    Class.prototype.equipmentInformation = function (key: string): void {
        console.error("equipmentInformation ", "设备信息");
    };

    /**
     * prompt 通用提示功能
     */
    Class.prototype.prompt = function (): void {
        console.error("prompt ", "提示");
    };

    /**
     * typeofRefinement 类型细化检查
     * @param operand 要检查的操作数
     */
    Class.prototype.typeofRefinement = Class.prototype.type = function (operand: any): void {
        console.error("typeofRefinement ", "typeof 类型细化");
    };

    /**
     * arrayStructure 检查对象是否为数组结构
     * @param arbitrary 任意对象
     */
    Class.prototype.arrayStructure = Class.prototype.isArray = function (arbitrary: any): void {
        console.error("arrayStructure ", "对象是否具备数组结构");
    };

    /**
     * traverseEach 遍历每个元素
     * @param arbitrary 任意集合
     * @param fn 遍历回调函数
     */
    Class.prototype.traverseEach = function (arbitrary: any, fn: Function): void {
        console.error("traverseEach ", "遍历每个");
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





