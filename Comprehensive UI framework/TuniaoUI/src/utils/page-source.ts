/**
 * 页面完整源码查询。
 * 具体源码由 scripts/generate-page-sources.mjs 在构建前生成，
 * 这里只保留稳定 API，避免 `.vue?raw` 触发 uni-app 预处理器。
 */
import { pageSources } from './page-source.generated'

/** 按页面路由取完整源码，取不到时返回空字符串 */
export function getPageSource(route: string): string {
	return pageSources[route] || ''
}
