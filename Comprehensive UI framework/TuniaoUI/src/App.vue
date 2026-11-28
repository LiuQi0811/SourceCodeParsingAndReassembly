<script lang="ts" setup>
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

onLaunch(() => {
	console.log('[TuniaoUI] App Launch')
	// 读取本地保存的语言，实现多语言持久化
	const cachedLocale = uni.getStorageSync('tn-demo-locale')
	if (cachedLocale) {
		i18nGlobalLocale(cachedLocale)
	}
})

onShow(() => {
	console.log('[TuniaoUI] App Show', t('app.name'))
})

onHide(() => {
	console.log('[TuniaoUI] App Hide')
})

function i18nGlobalLocale(locale: string) {
	// 延迟引入，避免循环依赖
	import('./i18n').then(({ default: i18n }) => {
		i18n.global.locale.value = locale as any
	})
}
</script>

<style lang="scss">
/* 图鸟 UI 原子类样式：tn-flex / tn-p-* / tn-text-* / tn-bg-* / tn-shadow-* ... */
@import '@tuniao/tn-style/dist/uniapp/index.css';

/* 图标字体本地化：用 base64 内嵌 woff2 覆盖 tn-style 里的 //at.alicdn.com 声明
   顺序必须在 tn-style 之后；离线构建 / 小程序真机无外网时图标仍可显示 */
@import '@tuniao/tn-icon/dist/base64/index.css';

page {
	background-color: #f4f7fb;
	color: var(--tn-text-color-primary, #0f172a);
	font-size: 28rpx;

	/* 示例工程统一设计变量：深墨色标题、冷灰辅助文字、蓝青强调色 */
	--demo-ink: #0f172a;
	--demo-muted: #64748b;
	--demo-faint: #94a3b8;
	--demo-line: #e8eef7;
	--demo-surface: #ffffff;
	--demo-bg: #f4f7fb;
	--demo-primary: #2f6bff;
	--demo-cyan: #06b6d4;
}

.page {
	box-sizing: border-box;
	padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
}

/* #ifdef H5 */
/* H5 下 TnPopup 的 scoped transition 偶发停在起始帧（opacity 0 / scaleY(0)），
   表现为“点了按钮但弹层不出现”。这里用 !important 强制打开态终态。 */
.tn-popup.is-show .tn-popup__content {
	opacity: 1 !important;
	transition: none !important;
}

.tn-popup.is-show .tn-popup__content--center {
	transform: translate(-50%, -50%) scale(1) !important;
}

.tn-popup.is-show .tn-popup__content--top {
	transform: scaleY(1) !important;
}

.tn-popup.is-show .tn-popup__content--bottom {
	transform: scaleY(1) !important;
}

.tn-popup.is-show .tn-popup__content--left {
	transform: scaleX(1) !important;
}

.tn-popup.is-show .tn-popup__content--right {
	transform: scaleX(1) !important;
}
/* #endif */

/* 隐藏态的弹层 / 遮罩 / 通知必须完全退出命中测试：
   小程序里 visibility:hidden 的 fixed 层仍可能盖住整页，表现为“点不动”。 */
.tn-popup:not(.is-show),
.tn-overlay:not(.tn-overlay--show),
.tn-notify:not(.is-active) {
	display: none !important;
}

/* 全局通用卡片 */
.tn-demo-card {
	margin: 0 28rpx 28rpx;
	padding: 28rpx;
	background-color: var(--demo-surface);
	border: 1rpx solid var(--demo-line);
	border-radius: 28rpx;
	box-shadow: 0 12rpx 32rpx rgba(15, 23, 42, 0.05);
}

.tn-demo-title {
	font-size: 30rpx;
	font-weight: 700;
	color: var(--demo-ink);
	margin-bottom: 18rpx;
}

.tn-demo-desc {
	font-size: 24rpx;
	color: var(--demo-muted);
	margin-bottom: 20rpx;
	line-height: 1.7;
}

.tn-demo-row {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 16rpx;
}

/* 代码片段展示：外层用 scroll-view 横向滑动，长行不再断词 */
.tn-demo-code {
	display: inline-block;
	box-sizing: border-box;
	min-width: 100%;
	padding: 22rpx 24rpx;
	margin-top: 0;
	background-color: #0f172a;
	border: none;
	border-radius: 0;
	font-size: 24rpx;
	color: #cbd5e1;
	line-height: 1.8;
	white-space: pre;
	word-break: normal;
	font-family: Menlo, Consolas, 'Courier New', monospace;
}

/* 页面级小标题：编号 + 英文眉题 + 中文标题 */
.demo-section {
	margin: 36rpx 28rpx 18rpx;
}

.demo-section__eyebrow {
	font-size: 20rpx;
	font-weight: 600;
	letter-spacing: 2rpx;
	color: var(--demo-primary);
	text-transform: uppercase;
}

.demo-section__title {
	display: block;
	margin-top: 6rpx;
	font-size: 34rpx;
	font-weight: 700;
	line-height: 1.35;
	color: var(--demo-ink);
}

.demo-section__meta {
	font-size: 22rpx;
	color: var(--demo-faint);
}
</style>
