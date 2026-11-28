<script lang="ts" setup>
import { computed, ref } from 'vue'
import {
	onHide,
	onLoad,
	onPageScroll,
	onReady,
	onShareAppMessage,
	onShareTimeline,
	onShow,
	onTabItemTap,
	onUnload,
} from '@dcloudio/uni-app'
import { useComponentColor, useComponentSize, useNamespace } from '@tuniao/tnui-vue3-uniapp'
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()


interface LogItem {
	id: number
	type: string
	detail: string
	time: string
}

const logs = ref<LogItem[]>([])
let logId = 0
let lastScrollLog = 0

function timeText() {
	const d = new Date()
	const hh = String(d.getHours()).padStart(2, '0')
	const mm = String(d.getMinutes()).padStart(2, '0')
	const ss = String(d.getSeconds()).padStart(2, '0')
	return `${hh}:${mm}:${ss}`
}

function addLog(type: string, detail: string) {
	logs.value = [{ id: ++logId, type, detail, time: timeText() }, ...logs.value].slice(0, 8)
}

function clearLogs() {
	logs.value = []
	addLog('手动刷新', '生命周期日志已清空，继续操作页面即可重新记录')
}

/** ---------------- 生命周期 ---------------- */
const platform = ref('检测中')
const readyState = ref('未 ready')
const scrollTop = ref(0)
let h5ScrollHandler: (() => void) | null = null

function recordScroll(top: number) {
	scrollTop.value = top
	const now = Date.now()
	if (now - lastScrollLog > 450) {
		lastScrollLog = now
		addLog('onPageScroll', `scrollTop = ${top}`)
	}
}

/** H5 的页面滚动由 window 承担，补一个 scroll 监听保证示例在浏览器里也能看到 scrollTop */
function initH5ScrollFallback() {
	// #ifdef H5
	h5ScrollHandler = () => recordScroll(Math.round(window.scrollY || document.documentElement.scrollTop || 0))
	document.addEventListener('scroll', h5ScrollHandler, { passive: true })
	// #endif
}

onLoad((options) => {
	const sys = uni.getSystemInfoSync() as any
	platform.value = sys.uniPlatform || sys.platform || 'unknown'
	addLog('onLoad', `路由参数 ${JSON.stringify(options || {})}`)
	addLog('平台', `${platform.value} · ${sys.model || sys.deviceBrand || 'device'}`)
})

onReady(() => {
	readyState.value = '已 ready'
	capabilitiesRefresh.value++
	addLog('onReady', '页面首次渲染完成，适合测量节点尺寸')
	initNetworkWatch()
	initWindowWatch()
	initH5ScrollFallback()
})

onShow(() => {
	addLog('onShow', '页面显示 / 从后台恢复')
})

onHide(() => {
	addLog('onHide', '页面隐藏 / 切到后台')
})

onUnload(() => {
	cleanupWatchers()
	addLog('onUnload', '页面卸载，监听器已清理')
})

onPageScroll((e) => {
	recordScroll(Math.round(e.scrollTop))
})

// 只有 tabBar 页面会触发；本页不是 tab，保留代码用于说明触发条件
onTabItemTap((item) => {
	addLog('onTabItemTap', `点击 tab：${item.text || item.pagePath}`)
})

onShareAppMessage(() => {
	addLog('onShareAppMessage', '生成微信分享卡片')
	return {
		title: 'TuniaoUI 跨端生命周期与系统 API',
		path: '/pages/cross-platform/index',
		imageUrl: '/static/demo/banner-1.jpg',
	}
})

onShareTimeline(() => {
	addLog('onShareTimeline', '生成朋友圈分享内容')
	return {
		title: 'TuniaoUI 跨端生命周期与系统 API',
		query: 'from=timeline',
	}
})

/** ---------------- 网络 / 窗口监听 ---------------- */
const networkType = ref('未知')
const networkConnected = ref(true)
const windowSize = ref('')

let networkHandler: ((res: any) => void) | null = null
let windowHandler: ((res: any) => void) | null = null

function initNetworkWatch() {
	uni.getNetworkType({
		success: (res) => {
			networkType.value = res.networkType
			addLog('getNetworkType', `当前网络：${res.networkType}`)
		},
		fail: (err) => addLog('getNetworkType', `读取失败：${err.errMsg || 'unknown'}`),
	})

	networkHandler = (res: any) => {
		networkConnected.value = res.isConnected
		networkType.value = res.networkType
		addLog('网络变化', `${res.isConnected ? '已连接' : '已断开'} · ${res.networkType}`)
	}
	uni.onNetworkStatusChange(networkHandler)
}

function initWindowWatch() {
	if (typeof (uni as any).onWindowResize !== 'function') return
	windowHandler = (res: any) => {
		windowSize.value = `${Math.round(res.size.width)} × ${Math.round(res.size.height)}`
		addLog('窗口变化', `${windowSize.value}px`)
	}
	;(uni as any).onWindowResize(windowHandler)
}

function cleanupWatchers() {
	if (networkHandler) uni.offNetworkStatusChange(networkHandler)
	if (windowHandler && typeof (uni as any).offWindowResize === 'function') {
		;(uni as any).offWindowResize(windowHandler)
	}
	// #ifdef H5
	if (h5ScrollHandler) document.removeEventListener('scroll', h5ScrollHandler)
	// #endif
	networkHandler = null
	windowHandler = null
	h5ScrollHandler = null
}

function readNetworkType() {
	uni.getNetworkType({
		success: (res) => {
			networkType.value = res.networkType
			addLog('getNetworkType', `手动读取：${res.networkType}`)
		},
		fail: (err) => failApi('getNetworkType', err),
	})
}

/** ---------------- 系统 API ---------------- */
const chosenImage = ref('')
const scanResult = ref('')
const locationText = ref('')
const settingText = ref('')
const phoneText = ref('')
const apiResult = ref('尚未调用系统 API')

const capabilitiesRefresh = ref(0)
const capabilities = computed(() => {
	void capabilitiesRefresh.value
	return [
		{ name: 'chooseImage', label: '选择图片', ok: canUse('chooseImage') },
		{ name: 'previewImage', label: '预览图片', ok: canUse('previewImage') },
		{ name: 'scanCode', label: '扫码', ok: canUse('scanCode') },
		{ name: 'chooseLocation', label: '选择位置', ok: canUse('chooseLocation') },
		{ name: 'openSetting', label: '打开设置', ok: canUse('openSetting') },
		{ name: 'makePhoneCall', label: '拨打电话', ok: canUse('makePhoneCall') },
	]
})

function canUse(name: string) {
	return typeof (uni as any)[name] === 'function'
}

function guardApi(name: string) {
	if (canUse(name)) return true
	const message = `${name} 在当前平台不可用`
	apiResult.value = message
	addLog(name, message)
	uni.showToast({ title: message, icon: 'none' })
	return false
}

function failApi(name: string, err: any) {
	const msg = err?.errMsg || err?.message || '当前平台不支持或用户取消'
	apiResult.value = `${name} 失败：${msg}`
	addLog(name, apiResult.value)
	uni.showToast({ title: msg, icon: 'none' })
}

function succeedApi(name: string, detail: string) {
	apiResult.value = `${name} 成功：${detail}`
	addLog(name, apiResult.value)
}

function chooseImage() {
	if (!guardApi('chooseImage')) return
	uni.chooseImage({
		count: 1,
		sizeType: ['original', 'compressed'],
		sourceType: ['album', 'camera'],
		success: (res) => {
			const paths = (res.tempFilePaths || []) as string[]
			chosenImage.value = paths[0] || ''
			succeedApi('chooseImage', chosenImage.value || '已选择图片')
		},
		fail: (err) => failApi('chooseImage', err),
	})
}

function previewImage() {
	if (!guardApi('previewImage')) return
	const urls = chosenImage.value
		? [chosenImage.value, '/static/demo/banner-1.jpg']
		: ['/static/demo/banner-1.jpg', '/static/demo/banner-2.jpg', '/static/demo/banner-3.jpg']
	uni.previewImage({
		urls,
		current: urls[0],
		success: () => succeedApi('previewImage', `预览 ${urls.length} 张`),
		fail: (err) => failApi('previewImage', err),
	})
}

function scanCode() {
	if (!guardApi('scanCode')) return
	uni.scanCode({
		onlyFromCamera: false,
		scanType: ['qrCode', 'barCode'],
		success: (res) => {
			scanResult.value = res.result
			succeedApi('scanCode', res.result || '已识别')
		},
		fail: (err) => failApi('scanCode', err),
	})
}

function chooseLocation() {
	if (!guardApi('chooseLocation')) return
	uni.chooseLocation({
		success: (res) => {
			locationText.value = [res.name, res.address].filter(Boolean).join(' · ') || '已选择位置'
			succeedApi('chooseLocation', locationText.value)
		},
		fail: (err) => failApi('chooseLocation', err),
	})
}

function openSetting() {
	if (!guardApi('openSetting')) return
	uni.openSetting({
		success: (res) => {
			settingText.value = JSON.stringify(res.authSetting || {})
			succeedApi('openSetting', settingText.value)
		},
		fail: (err) => failApi('openSetting', err),
	})
}

function makePhoneCall() {
	if (!guardApi('makePhoneCall')) return
	uni.makePhoneCall({
		phoneNumber: '10086',
		success: () => {
			phoneText.value = '已发起拨号：10086'
			succeedApi('makePhoneCall', phoneText.value)
		},
		fail: (err) => failApi('makePhoneCall', err),
	})
}

/** ---------------- 二次开发 hooks ---------------- */
const ns = useNamespace('knowledge-card')
const demoColor = ref('tn-blue')
const [colorClass, colorStyle] = useComponentColor(demoColor, 'bg')
const { sizeType } = useComponentSize('lg')
const hookClassList = computed(() => [ns.b(), ns.e('body'), ns.is('active', true)])

function switchDemoColor() {
	demoColor.value = demoColor.value === 'tn-blue' ? 'tn-purple' : 'tn-blue'
}

function showShareConfig() {
	uni.showModal({
		title: 'onShareAppMessage 返回值',
		content: 'title: TuniaoUI 跨端生命周期与系统 API\npath: /pages/cross-platform/index\nimageUrl: /static/demo/banner-1.jpg',
		showCancel: false,
	})
}
</script>

<template>
	<view class="page" :style="theme.vars">
		<view class="page-header">
			<text class="page-header__eyebrow">CROSS PLATFORM</text>
			<text class="page-header__title">跨端生命周期与系统 API</text>
			<text class="page-header__desc">
				页面生命周期、网络 / 窗口监听、分享、媒体、扫码、定位、设置与拨号，以及 easycom 自定义规则和组件库 hooks
			</text>
			<view class="platform-badge">
				<text class="platform-badge__label">当前平台</text>
				<text class="platform-badge__value">{{ platform }}</text>
			</view>
		</view>

		<!-- 生命周期 -->
		<demo-block
			title="页面生命周期：onLoad / onReady / onShow / onHide / onUnload"
			desc="打开页面会依次记录 onLoad → onShow → onReady；切后台、返回会补 onHide / onUnload；滚动会记录 onPageScroll"
			code="onLoad((options) => {}) / onReady(() => {}) / onShow(() => {}) / onHide(() => {}) / onUnload(() => {})"
		>
			<view class="metric-row">
				<text class="metric">ready：{{ readyState }}</text>
				<text class="metric">scrollTop：{{ scrollTop }}</text>
			</view>
			<view class="log-list">
				<view v-for="item in logs" :key="item.id" class="log-item">
					<text class="log-time">{{ item.time }}</text>
					<text class="log-type">{{ item.type }}</text>
					<text class="log-detail">{{ item.detail }}</text>
				</view>
				<view v-if="!logs.length" class="log-empty">操作页面后，这里会实时记录生命周期</view>
			</view>
			<tn-button size="sm" plain class="tn-mt-sm" @click="clearLogs">清空日志</tn-button>
		</demo-block>

		<!-- 网络 / 窗口 -->
		<demo-block
			title="网络状态与窗口尺寸监听"
			desc="uni.onNetworkStatusChange 监听断网 / 切网；uni.onWindowResize 在 H5 / App 的窗口尺寸变化时触发"
			code="uni.onNetworkStatusChange((res) => {}) / uni.onWindowResize((res) => {})"
		>
			<view class="metric-grid">
				<view class="metric-card">
					<text class="metric-card__label">网络类型</text>
					<text class="metric-card__value">{{ networkType }}</text>
					<text class="metric-card__hint">{{ networkConnected ? '已连接' : '已断开' }}</text>
				</view>
				<view class="metric-card">
					<text class="metric-card__label">窗口尺寸</text>
					<text class="metric-card__value">{{ windowSize || '拖动窗口试试' }}</text>
					<text class="metric-card__hint">H5 / App 生效</text>
				</view>
			</view>
			<view class="button-row">
				<tn-button size="sm" plain @click="readNetworkType">读取网络类型</tn-button>
				<tn-button size="sm" plain @click="initWindowWatch">重新监听窗口</tn-button>
			</view>
		</demo-block>

		<!-- 分享 -->
		<demo-block
			title="小程序分享：onShareAppMessage / onShareTimeline"
			desc="分享卡片只在微信小程序等平台触发；H5 不会弹出微信分享，代码仍然注册在同一页面"
			code="onShareAppMessage(() => ({ title, path, imageUrl })) / onShareTimeline(() => ({ title, query }))"
		>
			<view class="share-card">
				<tn-icon name="share" :size="34" color="tn-blue" />
				<view class="share-card__body">
					<text class="share-card__title">TuniaoUI 跨端生命周期与系统 API</text>
					<text class="share-card__desc">path：/pages/cross-platform/index</text>
				</view>
			</view>
			<tn-button size="sm" plain class="tn-mt-sm" @click="showShareConfig">查看分享返回值</tn-button>
		</demo-block>

		<!-- 媒体 -->
		<demo-block
			title="媒体：选择图片 / 预览图片"
			desc="chooseImage 返回 tempFilePaths；previewImage 传入 urls 与 current。H5 受浏览器权限与平台支持限制，能力矩阵会标出不可用项"
			code="uni.chooseImage({ count: 1, sourceType: ['album', 'camera'] }) / uni.previewImage({ urls, current })"
		>
			<view class="button-row">
				<tn-button size="sm" type="primary" @click="chooseImage">选择图片</tn-button>
				<tn-button size="sm" plain @click="previewImage">预览图片</tn-button>
			</view>
			<image v-if="chosenImage" :src="chosenImage" class="selected-image" mode="aspectFill" />
			<text class="hint-text">{{ chosenImage ? `已选择：${chosenImage}` : '未选择时预览会使用内置示例图；当前平台没有的 API 会在点击时直接提示' }}</text>
		</demo-block>

		<!-- 扫码 / 定位 -->
		<demo-block
			title="扫码与选择位置"
			desc="scanCode 支持二维码 / 条形码；chooseLocation 需要地图能力，H5 未配置地图 key 时会走 fail 分支"
			code="uni.scanCode({ scanType: ['qrCode', 'barCode'] }) / uni.chooseLocation({ success })"
		>
			<view class="button-row">
				<tn-button size="sm" type="primary" @click="scanCode">扫码</tn-button>
				<tn-button size="sm" plain @click="chooseLocation">选择位置</tn-button>
			</view>
			<view v-if="scanResult" class="result-box">扫码结果：{{ scanResult }}</view>
			<view v-if="locationText" class="result-box">位置：{{ locationText }}</view>
			<text v-if="!scanResult && !locationText" class="hint-text">扫码 / 定位结果会显示在这里；失败会 toast 并写入下方 API 结果</text>
		</demo-block>

		<!-- 设置 / 拨号 -->
		<demo-block
			title="授权设置与拨打电话"
			desc="openSetting 查看 authSetting；makePhoneCall 直接调起系统拨号，H5 通常会打开 tel: 链接"
			code="uni.openSetting({ success }) / uni.makePhoneCall({ phoneNumber: '10086' })"
		>
			<view class="button-row">
				<tn-button size="sm" plain @click="openSetting">打开授权设置</tn-button>
				<tn-button size="sm" plain @click="makePhoneCall">拨号 10086</tn-button>
			</view>
			<view v-if="settingText" class="result-box">authSetting：{{ settingText }}</view>
			<view v-if="phoneText" class="result-box">{{ phoneText }}</view>
		</demo-block>

		<!-- 能力探测 -->
		<demo-block
			title="平台能力探测"
			desc="用 typeof uni.xxx === 'function' 先探测再调用，避免 H5 不支持时直接报错；不同平台的能力矩阵会不同"
			code="typeof uni.scanCode === 'function'"
		>
			<view class="capability-grid">
				<view v-for="item in capabilities" :key="item.name" class="capability-cell">
					<text class="capability-cell__name">{{ item.name }}</text>
					<text class="capability-cell__state" :class="item.ok ? 'is-ok' : 'is-off'">{{ item.ok ? '可用' : '不可用' }}</text>
				</view>
			</view>
			<text class="hint-text">能力矩阵里标为「不可用」的 API，点击对应按钮会直接提示，不会抛出原始报错；可切换到小程序 / App 再验证。</text>
			<view class="result-box">{{ apiResult }}</view>
		</demo-block>

		<!-- easycom custom + hooks -->
		<demo-block
			title="easycom.custom 与二次开发 hooks"
			desc="tnx-button 不在 main.ts 全局注册，只靠 pages.json 的 custom 规则映射到组件库源码；hooks 展示命名空间与颜色解析"
			code="easycom.custom: '^tnx-(.*)': '@tuniao/tnui-vue3-uniapp/components/$1/src/$1.vue'"
		>
			<view class="hook-row">
				<tnx-button type="primary" size="sm" @click="switchDemoColor">tnx-button（custom easycom）</tnx-button>
				<tn-button size="sm" plain @click="switchDemoColor">切换 hook 颜色</tn-button>
			</view>
			<view class="hook-demo">
				<view class="hook-swatch" :class="colorClass" :style="{ background: colorStyle }">
					<text class="hook-swatch__text">{{ colorClass || 'style color' }}</text>				</view>
				<text class="hook-demo__title" :class="hookClassList">{{ ns.b() }} / {{ ns.e('body') }}</text>
				<text class="hook-demo__text">useComponentColor → {{ colorClass || 'style color' }}</text>
				<text class="hook-demo__text">useComponentSize('lg') → {{ sizeType }}</text>
			</view>
		</demo-block>

		<view class="tip">生命周期注册必须放在页面 setup 顶层；监听器要在 onUnload 里 off，避免热重载或来回跳转后重复触发。</view>
	</view>
</template>

<style lang="scss" scoped>
.page {
	padding-top: 24rpx;
}

.page-header {
	margin: 0 24rpx 24rpx;
	padding: 32rpx;
	border-radius: 28rpx;
	background: linear-gradient(135deg, #e8f8ff, #eef2ff 55%, #f8f0ff);
}

.page-header__eyebrow {
	display: block;
	font-size: 20rpx;
	font-weight: 700;
	letter-spacing: 2rpx;
	color: #4b8bc9;
}

.page-header__title {
	display: block;
	margin-top: 10rpx;
	font-size: 40rpx;
	font-weight: 800;
	color: var(--demo-ink);
}

.page-header__desc {
	display: block;
	margin-top: 12rpx;
	font-size: 24rpx;
	line-height: 1.7;
	color: var(--demo-muted);
}

.platform-badge {
	display: inline-flex;
	align-items: center;
	margin-top: 22rpx;
	padding: 10rpx 18rpx;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.72);
}

.platform-badge__label {
	font-size: 20rpx;
	color: var(--demo-muted);
}

.platform-badge__value {
	margin-left: 10rpx;
	font-size: 22rpx;
	font-weight: 700;
	color: #1d7fd6;
}

.metric-row {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
	margin-bottom: 18rpx;
}

.metric {
	padding: 10rpx 16rpx;
	border-radius: 10rpx;
	background: #f2f7ff;
	font-size: 22rpx;
	color: #376b9e;
}

.log-list {
	border-radius: 16rpx;
	background: var(--demo-soft);
	overflow: hidden;
}

.log-item {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	padding: 14rpx 18rpx;
	border-bottom: 1rpx solid #edf1f6;
}

.log-item:last-child {
	border-bottom: none;
}

.log-time {
	width: 78rpx;
	font-size: 18rpx;
	color: var(--demo-faint);
}

.log-type {
	margin-right: 12rpx;
	font-size: 20rpx;
	font-weight: 700;
	color: #1689d6;
}

.log-detail {
	flex: 1;
	min-width: 300rpx;
	font-size: 20rpx;
	line-height: 1.5;
	color: var(--demo-muted);
	word-break: break-all;
}

.log-empty {
	padding: 24rpx;
	font-size: 22rpx;
	color: var(--demo-faint);
	text-align: center;
}

.metric-grid {
	display: flex;
	gap: 16rpx;
}

.metric-card {
	flex: 1;
	display: flex;
	flex-direction: column;
	padding: 22rpx;
	border-radius: 16rpx;
	background: var(--demo-soft);
}

.metric-card__label {
	font-size: 20rpx;
	color: var(--demo-muted);
}

.metric-card__value {
	margin-top: 8rpx;
	font-size: 30rpx;
	font-weight: 700;
	color: var(--demo-ink);
	word-break: break-all;
}

.metric-card__hint {
	margin-top: 8rpx;
	font-size: 19rpx;
	color: var(--demo-faint);
}

.button-row {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 12rpx;
	margin-top: 18rpx;
}

.share-card {
	display: flex;
	align-items: center;
	padding: 20rpx;
	border-radius: 16rpx;
	background: var(--demo-soft);
}

.share-card__body {
	flex: 1;
	margin-left: 16rpx;
}

.share-card__title {
	display: block;
	font-size: 24rpx;
	font-weight: 600;
	color: var(--demo-ink);
}

.share-card__desc {
	display: block;
	margin-top: 6rpx;
	font-size: 19rpx;
	color: var(--demo-faint);
}

.selected-image {
	display: block;
	width: 100%;
	height: 220rpx;
	margin-top: 18rpx;
	border-radius: 16rpx;
}

.hint-text {
	display: block;
	margin-top: 12rpx;
	font-size: 20rpx;
	line-height: 1.6;
	color: var(--demo-faint);
	word-break: break-all;
}

.result-box {
	margin-top: 16rpx;
	padding: 16rpx 18rpx;
	border-radius: 12rpx;
	background: #f2f7ff;
	font-size: 22rpx;
	line-height: 1.6;
	color: #376b9e;
	word-break: break-all;
}

.capability-grid {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}

.capability-cell {
	width: calc(33.33% - 8rpx);
	display: flex;
	flex-direction: column;
	padding: 14rpx;
	border-radius: 12rpx;
	background: var(--demo-soft);
	box-sizing: border-box;
}

.capability-cell__name {
	font-size: 18rpx;
	color: var(--demo-muted);
}

.capability-cell__state {
	margin-top: 6rpx;
	font-size: 20rpx;
	font-weight: 700;
	color: var(--demo-faint);
}

.capability-cell__state.is-ok {
	color: #19a974;
}

.capability-cell__state.is-off {
	color: #d08a3c;
}

.hook-row {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 12rpx;
}

.hook-demo {
	margin-top: 18rpx;
	padding: 24rpx;
	border-radius: 16rpx;
	background: var(--demo-soft);
}

.hook-swatch {
	display: inline-flex;
	align-items: center;
	margin-bottom: 16rpx;
	padding: 10rpx 16rpx;
	border-radius: 10rpx;
	background: #e8f4ff;
}

.hook-swatch__text {
	font-size: 20rpx;
	font-weight: 700;
	color: var(--demo-ink);
}

.hook-demo__title {
	display: block;
	font-size: 24rpx;
	font-weight: 700;
	color: var(--demo-ink);
}

.hook-demo__text {
	display: block;
	margin-top: 8rpx;
	font-size: 20rpx;
	color: var(--demo-muted);
}

.tip {
	margin: 8rpx 32rpx 40rpx;
	font-size: 22rpx;
	line-height: 1.6;
	color: var(--demo-faint);
}
</style>
