/** 当前页面路由；小程序 / H5 都可用 */
export function getCurrentPageRoute(): string {
	const pages = getCurrentPages()
	const current = pages[pages.length - 1] as { route?: string } | undefined
	return current?.route || ''
}
