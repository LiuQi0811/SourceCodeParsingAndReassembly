import {rspack, type Configuration } from '@rspack/core';
import * as path from 'path';
import { readFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Target browsers, see: https://github.com/browserslist/browserslist
// 依照 https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts#browser_compatibility
const targets = ["chrome >= 120", "edge >= 120", "firefox >= 136"];
// 读取项目根目录package.json，获取版本号等项目信息
const packageConfig = JSON.parse(readFileSync("./package.json", "utf-8")) as { name: string, version: string };
// 获取命令行执行目录（项目根目录）
const dirname = path.resolve();
// 获取插件版本号
const version = packageConfig.version;
// 判断当前运行环境是否为开发环境，返回布尔值 true / false
const isDev = process.env.NODE_ENV === "development";
// 打包输出根目录 dist
const dist = path.join(dirname, "dist");
// 源码根目录 src
const src = path.join(dirname, "src");
// agent 默认开启；正式版屏蔽由 scripts/pack.js 按版本判断后通过 SC_DISABLE_AGENT 声明。
const enableAgent = process.env.SC_DISABLE_AGENT !== "true";

// chunkExcludeSet Set 对象，用于存储需要排除的 chunk 名称/文件，不进行分离
const chunkExcludeSet = new Set([
    "editor.worker",
    "json.worker",
    "ts.worker",
    "linter.worker",
    "service_worker",
    "content",
    "inject",
    "scripting",
    "common"
]);

console.log(dist);
export default {
    // 环境分支：开发环境 / 生产环境 差异化配置
    ...(isDev ? {
        watch: true, // 开启文件监听，代码修改自动重新打包
        mode: "development", // 开发模式：不压缩、保留注释、不混淆代码
        devtool: process.env.NO_MAP === "true" ? false : "inline-source-map", // 源码映射：NO_MAP=true则关闭map，否则行内source-map方便调试TSX
    } : {
        mode: "production", // 生产模式：开启代码压缩、混淆、Tree-Shaking
        devtool: false, // 生产环境关闭源码映射，减小包体积
    }),
    // Node环境模拟配置，浏览器扩展无Node环境，关闭__dirname/__filename模拟
    node: {
        __filename: false,
        __dirname: false
    },
    // 项目上下文根目录，所有相对路径以此为基准
    context: dirname,
    // 多入口配置：浏览器扩展由多个独立脚本组成，全部单独打包
    entry: {
        service_worker: `${src}/service_worker.ts`,  // MV3后台常驻服务线程，插件核心后台逻辑
        install: `${src}/pages/install/main.tsx`, // 插件安装引导页
    },
    // 打包产物输出配置
    output: {
        path: `${dist}/ext/src`, // JS代码输出目录 dist/ext/src
        filename: "[name].js", // 输出文件名和入口key同名，如service_worker.js
        clean: true // 每次打包自动清空旧dist目录，避免残留文件
    },
    // 资源编译规则：不同后缀文件交给对应loader处理
    module: {
        rules: [
            // TS/TSX/JS/JSX 文件，使用Rspack内置SWC极速编译
            {
                test: /\.(jsx?|tsx?)$/, // 匹配文件后缀
                use: [
                    {
                        loader: "builtin:swc-loader", // 使用Rspack内置SWC编译
                        options: {
                            jsc: {
                                externalHelpers: true, // 抽取公共辅助代码，减小单文件体积
                                parser: {
                                    syntax: "typescript", // 解析TS语法
                                    tsx: true, // 支持React TSX
                                    decorators: true, // 开启装饰器语法
                                },
                                transform: {
                                    react: {
                                        runtime: "automatic", // React17+自动导入jsx runtime，无需手动import React
                                        development: isDev, // 开发环境开启React调试提示
                                    }
                                }
                            },
                            env: {targets} // 根据目标浏览器降级JS语法
                        }
                    }
                ]
            } 
        ]
    },
    // 插件列表：构建全流程附加功能，filter(Boolean)过滤空插件
    plugins: [
        // 全局常量注入插件，代码内可直接读取 process.env.xxx
        new rspack.DefinePlugin({
            "process.env.VI_TESTING": "'false'", // 测试标识关闭
            "process.env.SC_RANDOM_KEY": `'${uuidv4()}'`, // 每次打包生成唯一随机密钥
            "process.env.SC_DISABLE_AGENT": `'${enableAgent ? "false" : "true"}'`, // Agent开关注入代码
        }),
        // 静态资源复制插件：拷贝manifest、图标、多语言等无需编译的文件
        new rspack.CopyRspackPlugin({
            patterns: [
                {
                    from: `${src}/manifest.json`, // 源文件：源码manifest模板（插件核心配置json）
                    to: `${dist}/ext`, // 输出到插件根目录 dist/ext
                }
            ]
        }),
        // HtmlRspackPlugin：为每个React页面生成独立HTML文件，自动注入对应JS打包产物
        // 弹窗页面html
        new rspack.HtmlRspackPlugin({
            filename: `${dist}/ext/src/popup.html`,
            template: `${src}/pages/popup.html`, // html模板源文件
            inject: "head", // 将js插入head标签
            title: "ScriptCat",
            minify: true, // 生产环境压缩html
            chunks: ["popup"], // 只注入popup入口打包后的js
        }),
        // 安装引导页面html
        new rspack.HtmlRspackPlugin({
            filename: `${dist}/ext/src/install.html`, 
            template: `${src}/pages/install.html`, // html模板源文件
            inject: "head", // 将js插入head标签
            title: "ScriptCat", // html标题
            minify: true, // 生产环境压缩html
            chunks: ["install"], // 只注入install入口打包后的js
    }),
    ]
} satisfies Configuration;