import { type Configuration } from '@rspack/core';



// 判断当前运行环境是否为开发环境，返回布尔值 true / false
const isDev = process.env.NODE_ENV === "development";

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

export default {
    entry: {
    }
} satisfies Configuration;