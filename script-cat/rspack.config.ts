import { type Configuration } from '@rspack/core';
import * as path from 'path';
import { readFileSync } from 'fs';
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
    },
    // 打包产物输出配置
    output: {
        path: `${dist}/ext/src`, // JS代码输出目录 dist/ext/src
        filename: "[name].js", // 输出文件名和入口key同名，如service_worker.js
        clean: true // 每次打包自动清空旧dist目录，避免残留文件
    }
} satisfies Configuration;