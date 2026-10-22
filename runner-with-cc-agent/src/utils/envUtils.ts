import {memoize} from 'lodash-es/lodash.js';
import {homedir} from 'os';
import {join} from 'path';
import * as process from "node:process";

// Memoized: 150+ callers, many on hot paths. Keyed off RUNNER_CLAUDE_CONFIG_DIR so
// tests that change the env var get a fresh value without explicit cache.clear.
/**
 * getRunnerClaudeConfigHomeDir 获取 Claude 配置根目录
 * @description 做了memoize缓存优化：150+调用方，大量处于热点执行路径；缓存key依赖 RUNNER_CLAUDE_CONFIG_DIR，
 * 单元测试修改该环境变量时会自动刷新缓存，无需手动调用 cache.clear()
 * 优先级：环境变量 RUNNER_CC_CONFIG_DIR > 用户家目录下 .claude
 * normalize('NFC')：做Unicode字符标准化，消除不同操作系统特殊字符路径差异
 */
export const getRunnerClaudeConfigHomeDir = memoize((): string => {
        return (process.env.RUNNER_CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"))
            .normalize("NFC");
    },
    // 自定义memoize缓存key生成函数，CLAUDE_CONFIG_DIR变化则缓存失效
    () => process.env.RUNNER_CLAUDE_CONFIG_DIR);

/**
 * getTeamsDir
 * Get teams config directory path
 * @description 获取teams团队配置目录路径，存放多团队相关配置文件
 */
export function getTeamsDir(): string {
    return join(getRunnerClaudeConfigHomeDir(), "teams");
}

/**
 * hasNodeOption
 * Check if NODE_OPTIONS contains a specific flag.
 * Splits on whitespace and checks for exact match to avoid false positives.
 * @description 检查 NODE_OPTIONS 环境变量是否包含指定启动参数；按空白字符分割，做完全匹配避免子字符串误命中
 * @param flag 需要检测的node启动参数，例如 "--max‑old‑space‑size=8192"
 * @returns true 存在该flag；false 不存在 / NODE_OPTIONS未设置
 */
export function hasNodeOption(flag: string): boolean {
    const nodeOptions = process.env.NODE_OPTIONS;
    if (!nodeOptions) return false;
    return nodeOptions.split(/\s+/).includes(flag);
}

/**
 * isEnvTruthy 判断环境变量是否为真值
 * @description 兼容布尔值、字符串输入；字符串忽略大小写与前后空格
 * 真值集合: ['1', 'true', 'yes', 'on']
 * @param envVar 环境变量原始值 string | boolean | undefined
 * @returns true 代表开启；false 关闭或未设置
 */
export function isEnvTruthy(envVar: string | boolean | undefined): boolean {
    if (!envVar) return false;
    if (typeof envVar === "boolean") return envVar;
    const normalizedValue = envVar
        .toLowerCase()
        .trim();
    return ["1", "true", "yes", "on"].includes(normalizedValue);
}

/**
 * isEnvDefinedFalsy 判断环境变量是否被显式设置为假值
 * @description 注意区分：变量为undefined返回false，用来区分“未设置”和“显式关闭”两种状态
 * 假值集合: ['0', 'false', 'no', 'off']
 * @param envVar 环境变量原始值 string | boolean | undefined
 * @returns true 被显式关闭；false 未设置或者为真值
 */
export function isEnvDefinedFalsy(envVar: string | boolean | undefined): boolean {
    if (envVar === undefined) return false;
    if (typeof envVar === "boolean") return !envVar;
    if (!envVar) return false;
    const normalizedValue = envVar
        .toLowerCase()
        .trim();
    return ["0", "false", "no", "off"].includes(normalizedValue);
}

/**
 * --bare / CLAUDE_CODE_SIMPLE — skip hooks, LSP, plugin sync, skill dir‑walk,
 * attribution, background prefetches, and ALL keychain/credential reads.
 * Auth is strictly ANTHROPIC_API_KEY env or apiKeyHelper from --settings.
 * Explicit CLI flags (--plugin‑dir, --add‑dir, --mcp‑config) still honored.
 * ~30 gates across the codebase.
 *
 * Checks argv directly (in addition to the env var) because several gates
 * run before main.tsx's action handler sets CLAUDE_CODE_SIMPLE=1 from --bare
 * — notably startKeychainPrefetch() at main.tsx top‑level.
 * isBareMode
 * @description 极简模式(bare模式)判断开关
 * 生效后行为：跳过钩子、LSP、插件同步、技能目录扫描、归因统计、后台预加载；完全不读取密钥链凭证
 * 鉴权仅支持环境变量 ANTHROPIC_API_KEY 或者 --settings传入apiKeyHelper；
 * 显式指定的CLI参数(--plugin‑dir / --add‑dir / --mcp‑config)仍然生效；整个项目约30处逻辑受此开关控制。
 * 同时读取process.argv与环境变量：部分逻辑执行时机早于命令行解析，此时还未把--bare转化为CLAUDE_CODE_SIMPLE环境变量
 * @returns true 当前处于bare极简模式
 */
export function isBareMode(): boolean {
    return (
        isEnvTruthy(process.env.RUNNER_CLAUDE_CODE_SIMPLE)
        ||
        process.argv.includes("--bare")
    );
}

/**
 * parseEnvVars
 * Parses an array of environment variable strings into a key‑value object
 * @description 解析命令行传入的环境变量字符串数组，转为键值对象
 * @param rawEnvArgs 格式为 KEY=VALUE 的字符串数组，例如 ['KEY1=val1','KEY2=val2']
 * @returns 解析完成的键值Record对象
 * @throws 遇到非法格式抛出错误，提示用户正确使用方式
 */
export function parseEnvVars(rawEnvArgs: string[] | undefined): Record<string, string> {
    const parsedEnv: Record<string, string> = {};
    // Parse individual env vars
    if (rawEnvArgs) {
        for (const envStr of rawEnvArgs) {
            const [key, ...valueParts] = envStr.split("=");
            if (!key || valueParts.length === 0) throw new Error(
                `Invalid environment variable format: ${envStr}, environment variables should be added as: -e KEY1=value1 -e KEY2=value2`,
            );
            parsedEnv[key] = valueParts.join("=");
        }
    }
    return parsedEnv;
}

/**
 * getAWSRegion
 * Get the AWS region with fallback to default
 * Matches the Anthropic Bedrock SDK's region behavior
 * @description 获取AWS区域，降级兜底策略对齐Anthropic Bedrock SDK
 * 优先级：AWS_REGION > AWS_DEFAULT_REGION > 'us‑east‑1'
 * @returns aws区域字符串
 */
export function getAWSRegion(): string {
    return process.env.AWS_REGION
        || process.env.AWS_DEFAULT_REGION
        || "us-east-1";
}

/**
 * getDefaultVertexRegion
 * Get the default Vertex AI region
 * @description 获取GCP Vertex AI默认部署区域
 * 优先级：CLOUD_ML_REGION环境变量 > 'us‑east5'
 * @returns vertex默认区域字符串
 */
export function getDefaultVertexRegion(): string {
    return process.env.CLOUD_ML_REGION
        || "us-east5";
}

/**
 * shouldMaintainProjectWorkingDir
 * Check if bash commands should maintain project working directory (reset to original after each command)
 * @description 判断Bash工具是否需要保持项目工作目录；每条命令执行完毕重置回原始项目目录
 * @returns true 开启目录保持逻辑
 */
export function shouldMaintainProjectWorkingDir(): boolean {
    return isEnvTruthy(process.env.RUNNER_CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR);
}

/**
 * isRunningOnHomespace
 * Check if running on Homespace (ant‑internal cloud environment)
 * @description 判断程序是否运行在Ant内部Homespace云环境
 * @returns true 运行于内部Homespace
 */
export function isRunningOnHomespace(): boolean {
    return (
        process.env.USER_TYPE === "ant"
        && isEnvTruthy(process.env.COO_RUNNING_ON_HOMESPACE)
    );
}

/**
 * Conservative check for whether Claude Code is running inside a protected
 * (privileged or ASL3+) COO namespace or cluster.
 *
 * Conservative means: when signals are ambiguous, assume protected. We would
 * rather over‑report protected usage than miss it. Unprotected environments
 * are homespace, namespaces on the open allowlist, and no k8s/COO signals
 * at all (laptop/local dev).
 *
 * isInProtectedNamespace
 * Used for telemetry to measure auto‑mode usage in sensitive environments.
 *
 * @description 保守策略判断是否运行在受保护COO命名空间/集群（高权限ASL3+内部环境）
 * 保守策略：环境信号模糊时判定为受保护环境；宁可误报，不可漏报敏感环境。
 * 非保护环境：homespace、开放白名单命名空间、本地开发机器(无k8s/COO标记)
 * 用途：遥测埋点，统计自动模式在敏感环境下的使用情况
 * 注意：USER_TYPE为编译期define注入；对外构建版本该代码块会被DCE死代码消除，不会打包内部校验逻辑
 * @returns true 处于受保护命名空间
 */
export function isInProtectedNamespace(): boolean {
    // USER_TYPE is build‑time --define'd; in external builds this block is
    // DCE'd so the require() and namespace allowlist never appear in the bundle.
    if (process.env.USER_TYPE === "ant") {
        /* eslint‑disable @typescript‑eslint/no‑require‑imports */
        return (
            require("./protectedNamespace.js") as typeof import("./protectedNamespace.js")
        ).getProtectedNamespace();
        /* eslint‑enable @typescript‑eslint/no‑require‑imports */
    }
    return false;
}

// @[MODEL LAUNCH]: Add a Vertex region override env var for the new model.
/**
 * Model prefix → env var for Vertex region overrides.
 * Order matters: more specific prefixes must come before less specific ones
 * (e.g., 'claude‑opus‑4‑1' before 'claude‑opus‑4').
 *
 * @description 模型前缀与Vertex区域覆盖环境变量映射表
 * ⚠️数组顺序至关重要：更具体、更长的模型前缀必须写在靠前位置，防止短前缀优先错误匹配
 */
const VERTEX_REGION_OVERRIDES: ReadonlyArray<[string, string]> = [
    ["claude-haiku-4-5", "VERTEX_REGION_CLAUDE_HAIKU_4_5"],
    ["claude-3-5-haiku", "VERTEX_REGION_CLAUDE_3_5_HAIKU"],
    ["claude-3-5-sonnet", "VERTEX_REGION_CLAUDE_3_5_SONNET"],
    ["claude-3-7-sonnet", "VERTEX_REGION_CLAUDE_3_7_SONNET"],
    ["claude-opus-4-1", "VERTEX_REGION_CLAUDE_4_1_OPUS"],
    ["claude-opus-4", "VERTEX_REGION_CLAUDE_4_0_OPUS"],
    ["claude-sonnet-4-6", "VERTEX_REGION_CLAUDE_4_6_SONNET"],
    ["claude-sonnet-4-5", "VERTEX_REGION_CLAUDE_4_5_SONNET"],
    ["claude-sonnet-4", "VERTEX_REGION_CLAUDE_4_0_SONNET"]
];

/**
 * getVertexRegionForModel
 * Get the Vertex AI region for a specific model.
 * Different models may be available in different regions.
 *
 * @description 根据模型名称获取该模型对应的GCP Vertex AI部署区域
 * 不同模型可部署在不同GCP区域；优先读取该模型专属环境变量，无配置回退到默认Vertex区域
 * @param model 模型完整名称字符串
 * @returns vertex区域字符串
 */
export function getVertexRegionForModel(model: string | undefined): string | undefined {
    if (model) {
        const match = VERTEX_REGION_OVERRIDES.find(([prefix]) => model.startsWith(prefix));
        if (match) return process.env[match[1]] || getDefaultVertexRegion();
    }
    return getDefaultVertexRegion();
}

const result = getVertexRegionForModel("claude-sonnet-4-5");
console.log(result)

