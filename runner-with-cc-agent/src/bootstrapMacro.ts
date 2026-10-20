// 导入项目根目录下 package.json 文件，读取包基础信息（版本号、包名等）
import pkg from '../package.json';

/**
 * MacroConfig 构建宏配置类型定义
 * 用于存放编译期/运行期注入的全局常量，这类常量一般在打包阶段替换真实值
 * @property VERSION 项目版本号，取自 package.json
 * @property BUILD_TIME 构建打包时间，打包脚本编译时注入，默认空字符串
 * @property PACKAGE_URL 项目包地址/包名
 * @property NATIVE_PACKAGE_URL 原生相关包地址/包名
 * @property VERSION_CHANGELOG 版本更新日志链接
 * @property ISSUES_EXPLAINER 问题反馈 Issue 提交地址说明文本
 * @property FEEDBACK_CHANNEL 反馈渠道标识，例如 github
 */
type MacroConfig = {
    VERSION: string;
    BUILD_TIME: string;
    PACKAGE_URL: string;
    NATIVE_PACKAGE_URL: string;
    VERSION_CHANGELOG: string;
    ISSUES_EXPLAINER: string;
    FEEDBACK_CHANNEL: string;
}

/**
 * defaultMacro 宏配置默认值
 * 当打包工具没有注入全局 MACRO 变量时，使用这套兜底默认配置
 */
const defaultMacro: MacroConfig = {
    // 从 package.json 读取版本号
    VERSION: pkg.version,
    // 构建时间，打包脚本编译时填充，运行时默认空串
    BUILD_TIME: "",
    // 项目包地址默认使用 package.json 的包名
    PACKAGE_URL: pkg.name,
    // 原生包地址默认使用 package.json 的包名
    NATIVE_PACKAGE_URL: pkg.name,
    // 版本更新日志链接，默认空
    VERSION_CHANGELOG: "",
    // Issue 提交说明文本，指向 GitHub issue 地址
    ISSUES_EXPLAINER: "file an issue at https://github.com/anthropics/claude-code/issues",
    // 反馈渠道标记：github
    FEEDBACK_CHANNEL: "github"
}

/**
 * ensureBootstrapMacro 初始化全局宏变量 MACRO
 * 启动引导函数：保证全局环境一定存在 MACRO 对象
 * 如果全局不存在 MACRO，则挂载默认配置到 globalThis
 * globalThis: 浏览器/Node.js 通用全局对象（兼容多环境）
 *
 * 类型断言：扩展 globalThis 类型，新增 MACRO 属性，消除 TS 类型报错
 * 适用场景：打包工具（Vite/Webpack/Rollup）编译注入宏变量；未打包调试环境使用兜底默认值
 */
export function ensureBootstrapMacro(): void{
    // 判断全局对象上是否已经存在 MACRO
    if(!("MACRO" in globalThis)){
        // 类型断言：告诉 TS，当前 globalThis 包含 MACRO 属性，类型为 MacroConfig
        // **`;(globalThis as ...)` 前面的分号**
        // 是 JS 自动分号补全 (ASI) 的防御写法，防止上一行代码没有分号时，和本行 `()` 函数调用合并，造成语法错误
        ;(globalThis as typeof globalThis & {MACRO: MacroConfig}).MACRO = defaultMacro;
    }
}