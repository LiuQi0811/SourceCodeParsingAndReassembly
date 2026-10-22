import {isEnvTruthy} from './envUtils.js'


// ========== 模块级全局状态，模块加载时一次性确定 ==========
// eslint-disable-next-line custom-rules/no-process-env-top-level
// 是否开启【详细性能剖析模式】，由环境变量 RUNNER_CLAUDE_CODE_PROFILE_STARTUP 控制
const DETAILED_PROFILING = isEnvTruthy(process.env.RUNNER_CLAUDE_CODE_PROFILE_STARTUP);

// Statsig埋点采样率：外部用户采样 0.5%；内部Ant用户全部上报
const STATSIG_SAMPLE_RATE = 0.005

// eslint-disable-next-line custom-rules/no-process-env-top-level
// 是否命中埋点采样：内部用户直接true；外部用户按概率随机采样
// 模块加载阶段一次性判定，未命中采样的会话完全不执行性能采集逻辑，无性能损耗
const STATSIG_LOGGING_SAMPLED = process.env.USER_TYPE === "ant"
|| Math.random() < STATSIG_SAMPLE_RATE;

// 是否需要执行性能采集：开启详细模式 或者 命中Statsig采样
const SHOULD_PROFILE = DETAILED_PROFILING || STATSIG_LOGGING_SAMPLED;

// 内存快照数组；仅 DETAILED_PROFILING 开启时才会写入数据
// perf_hooks 的 mark 打点本身不记录内存，需要手动捕获 process.memoryUsage()
//
// 注意：不能使用 Map<checkpoint名称,内存快照>
// 原因：部分checkpoint会被多次触发（例如 loadSettingsFromDisk_start，初始化执行一次、插件重置缓存后又执行一次）
// Map会发生覆盖丢失前一次内存；使用数组和perf.mark下标一一对应，保证多次打点数据全部保留
const memorySnapshots: NodeJS.MemoryUsage[] = [];

/**
 * 启动性能分析工具：用于测量、上报程序各个初始化阶段耗时
 *
 * 两种工作模式：
 * 1. 采样上报模式：内部Ant用户100%采样，外部用户0.5%采样，将阶段耗时上报至Statsig埋点平台
 * 2. 完整详细分析模式：环境变量 RUNNER_CC_PROFILE_STARTUP=1 开启；输出完整报告附带内存快照
 *
 * 底层使用 Node.js 内置 performance hooks API 做标准时间打点测量
 */


export function profileCheckpoint(name: string){

}

console.log(memorySnapshots)