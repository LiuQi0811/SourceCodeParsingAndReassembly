import i18n from './index'

const pageTitleKeys: Record<string, string> = {
	'pages/index/index': 'pageTitle.home',
	'pages/components/index': 'pageTitle.components',
	'pages/template/index': 'pageTitle.template',
	'pages/theme/index': 'pageTitle.theme',
	'pages/mine/index': 'pageTitle.mine',
	'pages/basic/index': 'pageTitle.basic',
	'pages/layout/index': 'pageTitle.layout',
	'pages/form/index': 'pageTitle.form',
	'pages/feedback/index': 'pageTitle.feedback',
	'pages/nav/index': 'pageTitle.nav',
	'pages/data/index': 'pageTitle.data',
	'pages/advanced/index': 'pageTitle.advanced',
	'pages/cross-platform/index': 'pageTitle.crossPlatform',
	'pages/business/index': 'pageTitle.business',
	'pages/search/index': 'pageTitle.search',
	'pages/detail/index': 'pageTitle.detail',
	'pages/cart/index': 'pageTitle.cart',
	'pages/checkout/index': 'pageTitle.checkout',
	'pages-sub/engineering/index': 'pageTitle.engineering',
	'pages-sub/source/index': 'pageTitle.source',
}

const tabBarKeys = ['tabBar.home', 'tabBar.components', 'tabBar.template', 'tabBar.theme', 'tabBar.mine']

function translate(key: string) {
	return i18n.global.t(key)
}

/** 语言切换后同步原生 TabBar 与当前页面标题 */
export function applyLocaleChrome() {
	tabBarKeys.forEach((key, index) => {
		uni.setTabBarItem({
			index,
			text: translate(key),
			fail: () => {},
		})
	})

	try {
		const pages = getCurrentPages()
		const current = pages[pages.length - 1] as { route?: string } | undefined
		const key = current?.route ? pageTitleKeys[current.route] : ''
		if (key) {
			uni.setNavigationBarTitle({
				title: translate(key),
				fail: () => {},
			})
		}
	} catch {
		// 页面尚未挂载时忽略，下一次导航会再次同步
	}
}
