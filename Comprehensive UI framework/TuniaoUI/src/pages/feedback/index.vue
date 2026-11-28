<script lang="ts" setup>
import { computed, ref } from 'vue'
import { noticeList } from '@/data/mock'

/** ---------------- 命令式：Modal ---------------- */
const modalRef = ref<any>(null)

function openBasicModal() {
	modalRef.value?.showModal({
		title: '基础弹窗',
		content: '这是通过 ref.showModal() 调起的模态框，内容是字符串，支持换行。',
	})
}

function openConfirmModal() {
	modalRef.value?.showModal({
		title: '确认操作',
		content: '确认要删除这条数据吗？该操作不可撤销。',
		showCancel: true,
		cancelText: '再想想',
		confirmText: '删除',
		confirmStyle: { color: '#ff444f' },
		maskClosable: true,
		confirm: () => {
			uni.showToast({ title: '已删除', icon: 'success' })
			return true
		},
	})
}

function openAsyncModal() {
	modalRef.value?.showModal({
		title: '异步确认',
		content: '点击确认后模拟 800ms 请求，成功才会关闭弹窗。',
		showCancel: true,
		confirm: () => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 800)),
	})
}

/** ---------------- 命令式：Notify ---------------- */
const notifyRef = ref<any>(null)

function showNotify(type: string, position: string) {
	notifyRef.value?.show({
		msg: `${type} 通知 · ${position}`,
		type,
		position,
		duration: 2000,
	})
}

/** ---------------- 命令式：ActionSheet ---------------- */
const actionSheetRef = ref<any>(null)

function openActionSheet() {
	actionSheetRef.value?.show({
		title: '选择操作',
		cancelText: '取消',
		maskClosable: true,
		actions: [
			{ text: '复制链接', desc: '分享给好友', value: 'copy' },
			{ text: '保存图片', value: 'save' },
			{ text: '举报', value: 'report' },
			{ text: '删除', desc: '不可恢复', value: 'delete' },
		],
		select: (index: number, value: string) => {
			uni.showToast({ title: `点击了 ${value}`, icon: 'none' })
			return true
		},
	})
}

/** ---------------- Popup ---------------- */
const popupShow = ref(false)
const popupDirection = ref<'top' | 'bottom' | 'left' | 'right' | 'center'>('center')

function openPopup(direction: typeof popupDirection.value) {
	popupDirection.value = direction
	popupShow.value = true
}

/** ---------------- Overlay ---------------- */
const overlayShow = ref(false)

/** ---------------- Loading ---------------- */
const loadingShow = ref(true)

/** ---------------- Progress ---------------- */
const percent = ref(30)
function changePercent() {
	percent.value = Math.floor(Math.random() * 100)
}

/** ---------------- Loadmore / Empty ---------------- */
const loadStatuses = ['loadmore', 'loading', 'nomore', 'empty'] as const
const emptyModes = ['cart', 'page', 'search', 'address', 'network', 'order'] as const

/** ---------------- ReadMore ---------------- */
const longText = `TuniaoUI（图鸟 UI）是一套基于 uni-app、Vue3 与 TypeScript 的跨端 UI 组件库。
它提供统一的设计语言、19 种主色的配色体系、838 个内置图标，以及 56 个开箱即用的组件。
通过 @tuniao/tn-style 的原子类可以快速完成布局与配色，通过 CSS 变量可以在不修改源码的情况下换肤。
所有组件都支持自定义样式（customStyle / customClass），并按 uni-app 的条件编译规则适配 H5、App 与小程序。`

const readMoreTip = ref('')
function beforeExpandReadMore(): Promise<boolean> {
	return new Promise((resolve) => {
		uni.showModal({
			title: 'beforeExpand 拦截',
			content: '展开前先确认，可用于登录校验、付费内容等场景',
			confirmText: '确认展开',
			success: (res) => resolve(res.confirm),
			fail: () => resolve(false),
		})
	})
}

function onReadMoreExpand() {
	readMoreTip.value = '已展开'
}

/** ---------------- CountDown ---------------- */
const countDownRef = ref<any>(null)
const countDownTime = ref(2 * 3600 + 45)

function resetCountDown() {
	countDownTime.value = 2 * 3600 + 45
	countDownRef.value?.reset()
}

function onCountDownEnd() {
	uni.showToast({ title: '倒计时结束', icon: 'none' })
}

/** ---------------- CountTo / CountScroll ---------------- */
const countToEnd = ref(9999.99)
function randomCountTo() {
	countToEnd.value = Math.floor(Math.random() * 100000)
}

const countScrollValue = ref('1288')
function randomCountScroll() {
	countScrollValue.value = String(Math.floor(Math.random() * 100000))
}

const bubbleOptions: any = [
	[
		{ text: '复制', icon: 'copy', disabled: false },
		{ text: '分享', icon: 'share', disabled: false },
		{ text: '下载', icon: 'download', disabled: false },
	],
	[
		{ text: '编辑', icon: 'edit', disabled: false },
		{ text: '删除', icon: 'delete', disabled: false },
	],
]

const bubbleClick = ref('')
function onBubbleClick(item: any) {
	bubbleClick.value = item.text
}

const noticeRight = computed(() => noticeList.slice(0, 3))
const noticeDirection = ref<'horizontal' | 'vertical'>('vertical')
</script>

<template>
	<view class="page">
		<view class="page-header">
			<text class="page-header__title">反馈组件</text>
			<text class="page-header__desc">
				Modal / Notify / ActionSheet 三个命令式组件，外加 Popup、Overlay、Loading、进度条、空状态、加载更多、阅读更多、倒计时、数字动画、气泡菜单
			</text>
		</view>

		<!-- Modal -->
		<demo-block
			title="TnModal 模态框"
			desc="通过 ref.showModal(options) 调起；confirm / cancel 返回 false 或 reject 时不会关闭，可用于异步提交"
			code="modalRef.value.showModal({ title, content, showCancel: true })"
		>
			<view class="tn-demo-row">
				<tn-button type="primary" @click="openBasicModal">基础弹窗</tn-button>
				<tn-button type="danger" @click="openConfirmModal">确认 / 取消</tn-button>
				<tn-button plain @click="openAsyncModal">异步确认</tn-button>
			</view>
		</demo-block>

		<!-- Notify -->
		<demo-block
			title="TnNotify 顶部通知"
			desc="show({ msg, type, position, duration })，position 支持 top / bottom，5 种语义色"
			code="notifyRef.value.show({ msg: '成功', type: 'success', position: 'top' })"
		>
			<view class="tn-demo-row">
				<tn-button size="sm" @click="showNotify('primary', 'top')">primary</tn-button>
				<tn-button size="sm" type="success" @click="showNotify('success', 'top')">success</tn-button>
				<tn-button size="sm" type="warning" @click="showNotify('warning', 'top')">warning</tn-button>
				<tn-button size="sm" type="danger" @click="showNotify('danger', 'top')">danger</tn-button>
				<tn-button size="sm" type="info" @click="showNotify('info', 'bottom')">底部</tn-button>
			</view>
		</demo-block>

		<!-- ActionSheet -->
		<demo-block
			title="TnActionSheet 操作菜单"
			desc="show({ title, actions, cancelText, select })，actions 支持 text / desc / value"
			code="actionSheetRef.value.show({ title, actions: [{ text: '删除', value: 'delete' }] })"
		>
			<tn-button type="primary" @click="openActionSheet">打开操作菜单</tn-button>
		</demo-block>

		<!-- Popup + Overlay -->
		<demo-block
			title="TnPopup 弹层 + TnOverlay 遮罩"
			desc="5 个弹出方向，支持关闭按钮、遮罩点击关闭、安全区、圆角与自定义宽高"
			code="<tn-popup v-model=&quot;show&quot; open-direction=&quot;bottom&quot; close-btn>...</tn-popup>"
		>
			<view class="tn-demo-row">
				<tn-button size="sm" @click="openPopup('center')">center</tn-button>
				<tn-button size="sm" @click="openPopup('bottom')">bottom</tn-button>
				<tn-button size="sm" @click="openPopup('top')">top</tn-button>
				<tn-button size="sm" @click="openPopup('left')">left</tn-button>
				<tn-button size="sm" @click="openPopup('right')">right</tn-button>
			</view>

			<view class="section-gap">
				<tn-button plain @click="overlayShow = !overlayShow">切换独立 Overlay</tn-button>
			</view>
		</demo-block>

		<!-- Loading -->
		<demo-block
			title="TnLoading 加载中"
			desc="semicircle / circle / flower 三种动画，可配颜色、尺寸与动画时长"
			code="<tn-loading show mode=&quot;flower&quot; type=&quot;primary&quot; :size=&quot;40&quot; />"
		>
			<view class="loading-row">
				<view class="loading-cell">
					<tn-loading show mode="semicircle" />
					<text class="loading-cell__text">semicircle</text>
				</view>
				<view class="loading-cell">
					<tn-loading show mode="circle" />
					<text class="loading-cell__text">circle</text>
				</view>
				<view class="loading-cell">
					<tn-loading show mode="flower" size="40" />
					<text class="loading-cell__text">flower</text>
				</view>
				<view class="loading-cell">
					<tn-loading :show="loadingShow" mode="circle" color="tn-purple" :size="44" />
					<text class="loading-cell__text">自定义颜色</text>
				</view>
			</view>
		</demo-block>

		<!-- Progress -->
		<demo-block
			title="CircleProgress / LineProgress 进度条"
			desc="属性名是 percent（0-100），duration 控制动画；圆环进度条不支持内置颜色，需传色值"
			code="<tn-line-progress :percent=&quot;60&quot; stripe show-percent />"
		>
			<view class="progress-row">
				<tn-circle-progress :percent="percent" :radius="46" :ring-width="8" active-color="#01beff" show-percent />
				<tn-circle-progress :percent="100 - percent" :radius="46" :ring-width="8" active-color="#5f4fd9" show-percent />
				<tn-circle-progress :percent="percent" :radius="56" :ring-width="4" active-color="#00d886" />
			</view>

			<view class="section-gap">
				<tn-line-progress :percent="percent" show-percent />
				<tn-line-progress :percent="percent" stripe active-color="#5f4fd9" class="tn-mt-sm" show-percent />
				<tn-line-progress :percent="percent" :height="12" active-color="#ff7043" inactive-color="tn-grey-light" class="tn-mt-sm" show-percent />
			</view>

			<tn-button size="sm" plain class="tn-mt-sm" @click="changePercent">随机进度</tn-button>
		</demo-block>

		<!-- Empty -->
		<demo-block
			title="TnEmpty 空状态"
			desc="6 种内置插画模式，支持自定义文案、颜色与尺寸"
			code="<tn-empty mode=&quot;cart&quot; tips=&quot;购物车空空如也&quot; />"
		>
			<view class="empty-grid">
				<view v-for="mode in emptyModes" :key="mode" class="empty-cell">
					<tn-empty :mode="mode" size="120" :show-tips="false" />
					<text class="empty-cell__text">{{ mode }}</text>
				</view>
			</view>
			<tn-empty mode="order" tips="还没有订单，去逛逛吧" class="section-gap" />
		</demo-block>

		<!-- Loadmore -->
		<demo-block
			title="TnLoadmore 加载更多"
			desc="loadmore / loading / nomore / empty 四种状态，可自定义文案与图标动画"
			code="<tn-loadmore status=&quot;nomore&quot; />"
		>
			<tn-loadmore v-for="status in loadStatuses" :key="status" :status="status" class="tn-mt-sm" />
			<tn-loadmore status="loadmore" :text="{ loadmore: '上拉加载更多', loading: '努力加载中', nomore: '到底啦' }" loading-icon-mode="flower" class="tn-mt-sm" />
		</demo-block>

		<!-- ReadMore -->
		<demo-block
			title="TnReadMore 阅读更多"
			desc="默认收起高度、展开/收起文案与图标都可配置；beforeExpand 返回 Promise，可拦截展开"
			code="<tn-read-more :height=&quot;200&quot; :before-expand=&quot;check&quot;>长文本</tn-read-more>"
		>
			<tn-read-more :height="200" tip-color="tn-blue" :before-expand="beforeExpandReadMore" @expand="onReadMoreExpand">
				<text class="long-text">{{ longText }}</text>
			</tn-read-more>
			<text class="tn-gray_text section-gap">展开状态：{{ readMoreTip || '未展开' }}</text>
		</demo-block>

		<!-- CountDown -->
		<demo-block
			title="TnCountDown 倒计时"
			desc="time 单位为秒，showDay/showHour 等控制显示单位，separatorMode 控制分隔符；ref 可 start / stop / reset"
			code="<tn-count-down ref=&quot;cdRef&quot; :time=&quot;seconds&quot; separator-mode=&quot;en&quot; @end=&quot;onEnd&quot; />"
		>
			<tn-count-down
				ref="countDownRef"
				:time="countDownTime"
				show-day
				separator-mode="en"
				border
				border-color="tn-blue"
				text-color="tn-blue"
				@end="onCountDownEnd"
			/>
			<view class="tn-demo-row section-gap">
				<tn-button size="sm" @click="countDownRef?.start()">开始</tn-button>
				<tn-button size="sm" plain @click="countDownRef?.stop()">暂停</tn-button>
				<tn-button size="sm" type="info" @click="resetCountDown">重置</tn-button>
			</view>
		</demo-block>

		<!-- CountTo / CountScroll -->
		<demo-block
			title="TnCountTo 数字动画 / TnCountScroll 数字滚动"
			desc="CountTo 支持起止值、小数位、千分位；CountScroll 适合金额、粉丝数等场景"
			code="<tn-count-to :end=&quot;9999.99&quot; :decimals=&quot;2&quot; thousands-separator=&quot;,&quot; />"
		>
			<view class="count-row">
				<view class="count-cell">
					<text class="count-cell__label">CountTo</text>
					<tn-count-to :start="0" :end="countToEnd" :decimals="2" thousands-separator="," text-color="tn-blue" font-size="40" />
				</view>
				<view class="count-cell">
					<text class="count-cell__label">CountScroll</text>
					<tn-count-scroll :value="countScrollValue" text-color="tn-purple" font-size="40" thousands-separator="," />
				</view>
			</view>
			<view class="tn-demo-row section-gap">
				<tn-button size="sm" plain @click="randomCountTo">随机 CountTo</tn-button>
				<tn-button size="sm" plain @click="randomCountScroll">随机 CountScroll</tn-button>
			</view>
		</demo-block>

		<!-- NoticeBar -->
		<demo-block
			title="TnNoticeBar 通知栏（横向 / 纵向）"
			desc="direction 支持 horizontal 与 vertical：横向衔接滚动，纵向上下轮播；speed 的含义随方向变化"
			code="<tn-notice-bar :data=&quot;list&quot; :direction=&quot;direction&quot; :loop=&quot;loop&quot; />"
		>
			<view class="mode-row">
				<tn-button size="sm" :plain="noticeDirection !== 'horizontal'" @click="noticeDirection = 'horizontal'">horizontal</tn-button>
				<tn-button size="sm" :plain="noticeDirection !== 'vertical'" @click="noticeDirection = 'vertical'">vertical</tn-button>
			</view>
			<tn-notice-bar
				:data="noticeDirection === 'vertical' ? noticeRight : noticeList"
				:direction="noticeDirection"
				:loop="noticeDirection === 'horizontal'"
				:speed="noticeDirection === 'horizontal' ? 60 : 3000"
				bg-color="tn-blue-light"
				text-color="tn-blue-dark"
				left-icon="notice"
				right-icon="right"
			/>
		</demo-block>

		<!-- BubbleBox -->
		<demo-block
			title="TnBubbleBox 气泡菜单"
			desc="点击触发器弹出气泡选项，options 为二维数组（每行一组），支持禁用项与图标"
			code="<tn-bubble-box :options=&quot;rows&quot; position=&quot;top&quot;>触发器</tn-bubble-box>"
		>
			<view class="tn-demo-row">
				<tn-bubble-box :options="bubbleOptions" position="top" @click="onBubbleClick">
					<tn-button plain icon="menu-more">点击弹出气泡</tn-button>
				</tn-bubble-box>
				<text class="tn-gray_text">最近点击：{{ bubbleClick || '无' }}</text>
			</view>
		</demo-block>

		<view class="tip">以上命令式组件都需要在模板里放一个空标签并绑定 ref，再通过 ref 调方法</view>

		<!-- 弹层宿主统一放在页面根节点，避免被示例卡的 overflow / 圆角裁剪 -->
		<tn-modal ref="modalRef" />
		<tn-notify ref="notifyRef" />
		<tn-action-sheet ref="actionSheetRef" />
		<tn-popup
			v-model="popupShow"
			:open-direction="popupDirection"
			:width="popupDirection === 'left' || popupDirection === 'right' ? '70%' : undefined"
			close-btn
			safe-area-inset-bottom
		>
			<view class="popup-content">
				<text class="popup-content__title">弹层内容</text>
				<text class="popup-content__desc">当前方向：{{ popupDirection }}</text>
				<tn-button type="primary" class="tn-mt-sm" @click="popupShow = false">关闭</tn-button>
			</view>
			<template #close-btn>
				<tn-icon name="close" :size="32" color="tn-grey" />
			</template>
		</tn-popup>
		<tn-overlay v-model:show="overlayShow" :opacity="0.6" />
	</view>
</template>

<style lang="scss" scoped>
.page {
	padding-top: 24rpx;
}

.page-header {
	margin: 0 24rpx 24rpx;
	padding: 28rpx 32rpx;
	border-radius: 24rpx;
	background: linear-gradient(135deg, rgba(255, 167, 38, 0.12), rgba(255, 68, 79, 0.12));
}

.page-header__title {
	display: block;
	font-size: 36rpx;
	font-weight: 700;
}

.page-header__desc {
	display: block;
	margin-top: 10rpx;
	font-size: 24rpx;
	line-height: 1.6;
	color: #606266;
}

.section-gap {
	margin-top: 20rpx;
}

.mode-row {
	display: flex;
	flex-wrap: wrap;
	gap: 10rpx;
	padding-bottom: 16rpx;
}

.popup-content {
	padding: 40rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.popup-content__title {
	font-size: 32rpx;
	font-weight: 600;
}

.popup-content__desc {
	margin: 12rpx 0 24rpx;
	font-size: 24rpx;
	color: #909399;
}

.loading-row {
	display: flex;
	flex-wrap: wrap;
}

.loading-cell {
	width: 25%;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 16rpx 0;
}

.loading-cell__text {
	margin-top: 12rpx;
	font-size: 20rpx;
	color: #909399;
}

.progress-row {
	display: flex;
	justify-content: space-around;
	align-items: center;
	padding: 12rpx 0;
}

.empty-grid {
	display: flex;
	flex-wrap: wrap;
}

.empty-cell {
	width: 33.33%;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 12rpx 0;
}

.empty-cell__text {
	font-size: 20rpx;
	color: #909399;
}

.long-text {
	font-size: 26rpx;
	line-height: 1.8;
	color: #606266;
}

.count-row {
	display: flex;
	align-items: center;
}

.count-cell {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.count-cell__label {
	margin-bottom: 10rpx;
	font-size: 22rpx;
	color: #909399;
}

.tip {
	margin: 8rpx 32rpx 40rpx;
	font-size: 22rpx;
	color: #909399;
}
</style>

