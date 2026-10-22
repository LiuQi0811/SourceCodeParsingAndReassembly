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