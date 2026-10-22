import { feature } from 'bun:bundle';
import * as process from "node:process";

// Bugfix for corepack auto‑pinning, which adds yarnpkg to peoples' package.jsons
// 修复 corepack 自动锁定问题：corepack自动模式会向用户package.json写入yarnpkg相关字段，这里关闭该能力
// eslint‑disable‑next‑line custom‑rules/no‑top‑level‑side‑effects
process.env.COREPACK_ENABLE_AUTO_PIN = "0";

// Set max heap size for child processes in CCR environments (containers have 16GB)
// 为CCR容器环境下的子进程设置最大堆内存，容器总内存16GB
// eslint‑disable‑next‑line custom‑rules/no‑top‑level‑side‑effects, custom‑rules/no‑process‑env‑top‑level, custom‑rules/safe‑env‑boolean‑check
if(process.env.RUNNER_CC_REMOTE  === "true"){
    // eslint‑disable‑next‑line custom‑rules/no‑top‑level‑side‑effects, custom‑rules/no‑process‑env‑top‑level
    const existing = process.env.NODE_OPTIONS || "";
    // eslint‑disable‑next‑line custom‑rules/no‑top‑level‑side‑effects, custom‑rules/no‑process‑env‑top‑level
    // 追加node最大老年代堆内存参数 8192MB，保留用户原有NODE_OPTIONS配置
    process.env.NODE_OPTIONS = existing ? `${existing} --max‑old‑space‑size=8192`: "--max‑old‑space‑size=8192";
}

// Harness‑science L0 ablation baseline. Inlined here (not init.ts) because
// BashTool/AgentTool/PowerShellTool capture DISABLE_BACKGROUND_TASKS into
// module‑level consts at import time — init() runs too late. feature() gate
// DCEs this entire block from external builds.
// 【科学实验消融基线配置】
// 不能放到init.ts中：BashTool、AgentTool、PowerShellTool会在模块import阶段就读取DISABLE_BACKGROUND_TASKS常量；
// init()函数执行时机太晚，无法生效。
// feature()编译期开关：对外发布版本会通过DCE(死代码消除)把整块代码删掉，不会打包进外部版本。
// eslint‑disable‑next‑line custom‑rules/no‑top‑level‑side‑effects, custom‑rules/no‑process‑env‑top‑level
if(feature("ABLATION_BASELINE") && process.env.RUNNER_CLAUDE_CODE_ABLATION_BASELINE){
    // 批量把实验开关环境变量全部置为"1"开启消融基线模式
    for (const k of ["RUNNER_CLAUDE_CODE_SIMPLE",
        "RUNNER_CLAUDE_CODE_DISABLE_THINKING",
        "DISABLE_INTERLEAVED_THINKING",
        "DISABLE_COMPACT",
        "DISABLE_AUTO_COMPACT",
        "RUNNER_CLAUDE_CODE_DISABLE_AUTO_MEMORY",
        "RUNNER_CLAUDE_CODE_DISABLE_BACKGROUND_TASKS"]) {
        // eslint‑disable‑next‑line custom‑rules/no‑top‑level‑side‑effects, custom‑rules/no‑process‑env‑top‑level
        // ??= 仅当环境变量未设置时赋值，不覆盖用户手动设置的值
        process.env[k] ??= "1";
    }
}

/**
 * Bootstrap entrypoint — 引导层入口文件
 * 在加载完整CLI业务之前，优先处理特殊命令行标识。
 * 全部使用动态import，最小化模块加载，实现命令快速响应。
 * --version 快速路径：除本文件外零模块导入，启动极快。
 */
async function main(): Promise<void>{
    // 截取命令行参数，去掉node/bun执行程序、脚本路径，只保留用户传入参数
    const args = process.argv.slice(2);

    // Fast‑path for --version/-v: zero module loading needed
    // 【版本号快速路径】--version / -v / -V，不需要加载任何业务模块，直接输出版本号返回
    if (args.length === 1 && (args[0] === "--version" || args[0] === "-v" || args[0] === "-V")) {
        // MACRO.VERSION 是打包编译期注入的全局宏常量
        // biome‑ignore lint/suspicious/noConsole:: intentional console output
        console.log(`${MACRO.VERSION} (Runner Claude Code)`);
        return;
    }

    // For all other paths, load the startup profiler
    // 其他所有分支：加载启动性能埋点工具，记录各个阶段耗时
    const { profileCheckpoint } = await import("../utils/startupProfiler.js");
    console.log(" Cli Server ......", profileCheckpoint("cli_entry"))
}


// temp .....
await main()