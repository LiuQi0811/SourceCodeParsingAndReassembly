/**
 * 配置接口，定义了系统或模块的配置选项
 */
interface Config {
    /**
     * 超时时间（单位：毫秒）
     * 用于设置请求、操作或任务的超时限制
     */
    timeout: number;
    /**
     * 是否启用调试模式
     * 当设置为 true 时，会输出详细的调试信息
     */
    debugMode: boolean;
    /**
     * 版本标识
     * 通常用于标识当前配置或系统的版本
     * 注意：此字段可能仅用于标识用途，不一定是布尔值（根据实际需求可能需要调整类型）
     */
    version: boolean;
    /**
     * 可选的基础目录路径
     * 如果未提供，则可能使用默认路径或其他方式确定目录
     */
    dir?: string;
}

/**
 * 定义全局对象 KoraUIGlobal 的类型
 */
declare const KoraUIGlobal: {
    dir?: string; // KoraUIGlobal.dir 可能存在，也可能是 undefined
};

/**
 * 扩展 window 对象的类型定义，明确 KoraUIGlobal 的结构
 */
interface Window {
    KoraUIGlobal?: {
        dir?: string; // 扩展 window 对象，明确 LAYUI_GLOBAL 的结构
    };
}

/**
 * 扩展 HTMLScriptElement 类型，添加 readyState 属性
 */
interface HTMLScriptElement {
    readyState?: 'loading' | 'interactive' | 'complete'; // 定义可能的 readyState 值
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
    // 定义一个空的 Class 构造函数
    // 目前 Class 内部没有具体实现，可能是一个占位符或待扩展的基类
    const Class = function () {
        // Class 构造函数体（当前为空）
    };
    // 定义配置对象 config，类型为 Config 接口
    // 包含超时时间、调试模式、版本标识等配置项
    const config: Config = {
        timeout: 10, // 超时时间（单位：毫秒），默认值为 10
        debugMode: false, // 是否启用调试模式，默认关闭
        version: false // 版本标识（布尔值），当前未启用版本控制
    };
    // 在 Class 的原型上定义 use 方法
    // 该方法用于加载模块，接收四个参数：
    // - mods: 模块标识（类型暂定为 any，需根据实际需求明确）
    // - callback: 回调函数（类型暂定为 Function，需根据实际需求明确）
    // - exports: 导出对象（类型暂定为 any，需根据实际需求明确）
    // - from: 来源标识（类型暂定为 any，需根据实际需求明确）
    Class.prototype.use = function (mods: any, callback: Function, exports: any, from: any): void {
        console.error(" USE ", "use is ..........", getPath)
    };
    // 定义全局对象 GLOBAL，并初始化为 window.KoraUIGlobal 或空对象
    // 如果 window.KoraUIGlobal 存在，则使用它；否则使用空对象 {}
    // 这种写法确保了 GLOBAL 对象至少是一个对象，避免访问未定义属性时报错
    const GLOBAL: { dir?: string } = window.KoraUIGlobal || {};

    /**
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

    // 将 KoraUI 实例挂载到 window 对象上，使其成为全局可访问的对象
    // @ts-ignore 用于忽略 TypeScript 的类型检查错误（如果存在）
    // 这里可能是为了避免 TypeScript 报错（如 KoraUI 未在全局声明）
    window.KoraUI = new Class();

    // 打印错误日志，输出当前文档中的所有 <script> 标签
    // 这可能是为了调试目的，检查脚本加载情况
    console.error("KoraUI .....", document.getElementsByTagName("script"));
})(window); // 立即执行函数，传入 window 对象作为参数





