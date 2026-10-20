/**
 * 项目入口引导文件
 * 作用：初始化全局宏变量，再异步加载CLI主入口
 * 适配 Bun + TypeScript 环境，配合前面 bootstrapMacro.ts 的全局MACRO配置
 */

// 从 bootstrapMacro 模块导入全局宏初始化函数
import {ensureBootstrapMacro} from './bootstrapMacro';

// 执行初始化：检查全局 globalThis 是否存在 MACRO 对象，不存在则注入默认宏配置
// MACRO 里面包含版本号、构建时间、仓库地址、反馈渠道等编译期/运行期常量
ensureBootstrapMacro();

// 异步动态导入 CLI 主业务入口文件
// 使用 await import 而不是顶层直接 import 的目的：
// 1. 保证执行顺序：先完成 ensureBootstrapMacro 全局变量注入，再加载cli业务代码
// 2. 业务代码 entrypoints/cli.tsx 内部可以直接读取 globalThis.MACRO
// 3. 静态import会提升到代码最前面执行，会出现MACRO还没初始化就被业务代码访问的bug
await import('./entrypoints/cli.tsx');

