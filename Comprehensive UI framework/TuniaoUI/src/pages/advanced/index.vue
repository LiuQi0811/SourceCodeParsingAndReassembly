<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
	TnActionSheetInstance,
	TnCountDownInstance,
	TnFormInstance,
	TnModalInstance,
} from '@tuniao/tnui-vue3-uniapp'
import { localeOptions, setLocale } from '@/i18n'

const { t, locale } = useI18n()

const formRef = ref<TnFormInstance>()
const actionSheetRef = ref<TnActionSheetInstance>()
const countDownRef = ref<TnCountDownInstance>()
const modalRef = ref<TnModalInstance>()

/** ---------------- 1. 类型化实例 + validateField ---------------- */
const formModel = ref({
	username: '',
	email: '',
})

const rules = {
	username: [
		{ required: true, message: '请输入用户名', trigger: 'blur' },
		{ min: 3, max: 12, message: '长度 3-12 个字符', trigger: 'blur' },
		{
			validator: (rule: any, value: string, callback: any) => {
				if (!value) return callback()
				if (!/^[a-zA-Z]/.test(value)) {
					callback(new Error('必须以字母开头'))
					return
				}
				callback()
			},
			trigger: 'blur',
		},
	],
	email: [{ required: true, type: 'email', message: '邮箱格式不正确', trigger: 'blur' }],
}

const validateResult = ref('尚未校验')

async function validateUsername() {
	if (!formRef.value) return
	try {
		await formRef.value.validateField('username')
		validateResult.value = '用户名校验通过 ✅'
	} catch (errors: any) {
		validateResult.value = `用户名校验失败：${errors?.[0]?.message || '格式错误'}`
	}
}

async function validateAll() {
	if (!formRef.value) return
	try {
		await formRef.value.validate()
		validateResult.value = '全部字段校验通过 ✅'
	} catch {
		validateResult.value = '存在校验失败的字段 ❌'
	}
}

function resetForm() {
	formRef.value?.resetFields()
	validateResult.value = '已重置表单'
}

/** ---------------- 2. Navbar 返回拦截 ---------------- */
function beforeBack(): Promise<boolean> {
	return new Promise((resolve) => {
		uni.showModal({
			title: '返回拦截',
			content: 'TnNavbar 的 beforeBack 可以拦截返回，返回 false 则停留在当前页。',
			success: (res) => resolve(res.confirm),
			fail: () => resolve(false),
		})
	})
}

/** ---------------- 3. Tabs beforeSwitch ---------------- */
const tabIndex = ref(0)
const tabNames = ['基础', '进阶', '审批']

function beforeSwitchTabs(index: number): Promise<boolean> {
	if (index !== 2) return Promise.resolve(true)
	return new Promise((resolve) => {
		uni.showModal({
			title: '需要审批',
			content: '切换到「审批」标签前需要确认，取消则停留在当前标签。',
			success: (res) => resolve(res.confirm),
			fail: () => resolve(false),
		})
	})
}

/** ---------------- 4. Tabbar 凸起 / 角标 / 禁用 ---------------- */
const tabbarValue = ref(0)

function onTabbarItemClick(value: number | string) {
	uni.showToast({ title: `点击 tabbar：${value}`, icon: 'none' })
}

/** ---------------- 5. NoticeBar 纵向滚动 ---------------- */
const noticeData = [
	'纵向通知栏：direction="vertical" 每条停留 2.5s',
	'暂停按钮切换 pause，可随时冻结滚动',
	'点击左右图标分别触发 left-icon-click / right-icon-click',
]
const noticePaused = ref(false)

function toggleNotice() {
	noticePaused.value = !noticePaused.value
}

function onNoticeClick(index: number) {
	uni.showToast({ title: `点击第 ${index + 1} 条通知`, icon: 'none' })
}

/** ---------------- 6. SwipeAction 事件 / 禁用 / 圆形 ---------------- */
const swipeItems = ref([
	{ id: 1, title: '左滑删除（圆形按钮）', round: true, disabled: false },
	{ id: 2, title: '左滑置顶（方形按钮）', round: false, disabled: false },
	{ id: 3, title: '该项已禁用滑动', round: true, disabled: true },
])

function swipeOptions(item: any) {
	return [
		{ text: '置顶', icon: 'totop', bgColor: 'tn-blue', round: item.round },
		{ text: '删除', icon: 'delete', bgColor: 'tn-red', round: item.round },
		{ text: '禁用项', icon: 'prohibit', bgColor: 'tn-grey', disabled: true, round: item.round },
	]
}

function onSwipeOpen(index: number) {
	uni.showToast({ title: `第 ${index + 1} 项已展开`, icon: 'none' })
}

function onSwipeSelect(index: number, optionIndex: number) {
	uni.showToast({ title: `第 ${index + 1} 项 · 第 ${optionIndex + 1} 个操作`, icon: 'none' })
}

/** ---------------- 7. Icon 图片模式 / 透明 / 偏移 ---------------- */
const iconImages = ['/static/demo/goods-1.jpg', '/static/demo/goods-2.jpg', '/static/demo/goods-3.jpg']

/** ---------------- 8. Popup 事件 ---------------- */
const showPopup = ref(false)
const popupLog = ref('等待事件...')

function onPopupOpen() {
	popupLog.value = 'open：弹层已打开'
}

function onPopupClose() {
	popupLog.value = 'close：弹层已关闭'
}

function onPopupOverlayClick() {
	popupLog.value = 'overlay-click：点击了遮罩层'
}

/** ---------------- 9. 组件内置文案 i18n ---------------- */
const showPicker = ref(false)
const pickerValue = ref('frontend')
const pickerData = computed(() => [
	{ label: t('advanced.roleFrontend'), value: 'frontend' },
	{ label: t('advanced.roleBackend'), value: 'backend' },
	{ label: t('advanced.roleDesign'), value: 'design' },
])

const loadmoreStatus = ref<'loadmore' | 'loading' | 'nomore'>('loadmore')
const loadmoreText = computed(() => ({
	loadmore: t('common.more'),
	loading: t('common.loading'),
	nomore: t('advanced.noMore'),
}))

function cycleLoadmore() {
	const order = ['loadmore', 'loading', 'nomore'] as const
	const next = order[(order.indexOf(loadmoreStatus.value) + 1) % order.length]
	loadmoreStatus.value = next
}

function showI18nModal() {
	modalRef.value?.showModal({
		title: t('advanced.i18nTitle'),
		content: t('advanced.i18nContent'),
		confirmText: t('common.confirm'),
		cancelText: t('common.cancel'),
		showCancel: true,
	})
}

function showI18nActionSheet() {
	const actions = [
		{ text: t('advanced.sheetSave'), value: 'save' },
		{ text: t('advanced.sheetShare'), value: 'share' },
		{ text: t('advanced.sheetDelete'), value: 'delete', desc: t('advanced.sheetDeleteDesc') },
	]
	actionSheetRef.value?.show({
		title: t('advanced.sheetTitle'),
		cancelText: t('common.cancel'),
		actions,
		select: (index: number, value: string | number) => {
			const action = actions[index]
			uni.showToast({ title: `${t('common.confirm')}：${action?.text ?? value}`, icon: 'none' })
			return true
		},
	})
}

const langIndex = computed(() => localeOptions.findIndex((o) => o.value === locale.value))

function onLangChange(index: number) {
	const option = localeOptions[index]
	if (option) setLocale(option.value)
}

/** ---------------- 10. CountDown 实例 ---------------- */
const countTime = 300
function startCount() {
	countDownRef.value?.start()
}
function stopCount() {
	countDownRef.value?.stop()
}
function resetCount() {
	countDownRef.value?.reset()
}

/** ---------------- 跳转 ---------------- */
function goEngineering() {
	uni.navigateTo({ url: '/pages-sub/engineering/index' })
}

function goComponents() {
	uni.switchTab({ url: '/pages/components/index' })
}
</script>

<template>
	<view class="page">
		<view class="page-header">
			<text class="page-header__title">进阶 API 与工程化</text>
			<text class="page-header__desc">
				补齐基础示例没覆盖的部分：类型化实例、validateField、返回拦截、切换拦截、事件全集、组件内置文案国际化
			</text>
		</view>

		<!-- 1. 类型化实例 + validateField -->
		<demo-block
			title="类型安全的实例调用 + validateField"
			desc="ref&lt;TnFormInstance&gt;() 后可获得完整的 validate / validateField / resetFields 类型提示；validateField 支持单字段校验"
			code="const formRef = ref&lt;TnFormInstance&gt;()&#10;await formRef.value?.validateField('username')"
		>
			<tn-form ref="formRef" :model="formModel" :rules="rules" label-width="140">
				<tn-form-item label="用户名" prop="username">
					<tn-input v-model="formModel.username" placeholder="字母开头，3-12 位" clearable />
				</tn-form-item>
				<tn-form-item label="邮箱" prop="email">
					<tn-input v-model="formModel.email" placeholder="name@example.com" clearable />
				</tn-form-item>
			</tn-form>
			<view class="tn-demo-row tn-mt-sm">
				<tn-button size="sm" type="primary" @click="validateUsername">只校验用户名</tn-button>
				<tn-button size="sm" @click="validateAll">校验全部</tn-button>
				<tn-button size="sm" plain @click="resetForm">重置</tn-button>
			</view>
			<text class="result-line">{{ validateResult }}</text>
		</demo-block>

		<!-- 2. Navbar 返回拦截 -->
		<demo-block
			title="TnNavbar 返回 / 回首页拦截"
			desc="beforeBack / beforeHome 返回 Promise&lt;boolean&gt; 或 boolean，false 时阻止跳转，可用于「表单未保存」二次确认"
			code="&lt;tn-navbar :before-back=&quot;beforeBack&quot; :before-home=&quot;beforeHome&quot; /&gt;"
		>
			<view class="navbar-box">
				<tn-navbar :fixed="false" back-icon="left" home-icon="home" :before-back="beforeBack" :safe-area-inset-right="false">
					<text class="navbar-title">点左侧返回按钮试试</text>
				</tn-navbar>
			</view>
			<text class="tn-gray_text tn-mt-sm">确认弹窗中选择「取消」即返回 false，页面不会返回。</text>
		</demo-block>

		<!-- 3. Tabs beforeSwitch -->
		<demo-block
			title="TnTabs beforeSwitch 切换拦截"
			desc="切到第 3 个标签前弹出确认；返回 false 时 modelValue 不变，标签停留在原位置"
			code="&lt;tn-tabs v-model=&quot;i&quot; :before-switch=&quot;beforeSwitchTabs&quot;&gt;...&lt;/tn-tabs&gt;"
		>
			<tn-tabs v-model="tabIndex" :before-switch="beforeSwitchTabs">
				<tn-tabs-item v-for="(name, index) in tabNames" :key="name" :name="index" :title="name" />
			</tn-tabs>
			<text class="result-line">当前标签：{{ tabNames[tabIndex] }}（索引 {{ tabIndex }}）</text>
		</demo-block>

		<!-- 4. Tabbar 凸起 / 角标 / 禁用 -->
		<demo-block
			title="TnTabbarItem 凸起 / 角标 / 禁用"
			desc="bulge 让中间项凸起，badge 显示角标，disabled 禁止点击；选中值通过 v-model + @change 获取"
			code="&lt;tn-tabbar v-model=&quot;v&quot; @change=&quot;onChange&quot;&gt;&#10;  &lt;tn-tabbar-item text=&quot;发布&quot; bulge bulge-bg-color=&quot;tn-blue&quot; /&gt;&#10;&lt;/tn-tabbar&gt;"
		>
			<view class="tabbar-box">
				<tn-tabbar v-model="tabbarValue" :fixed="false" :safe-area-inset-bottom="false" active-color="tn-blue" @change="onTabbarItemClick">
					<tn-tabbar-item :name="0" text="首页" icon="home" active-icon="home-fill" :badge="3" />
					<tn-tabbar-item :name="1" text="发布" icon="add" bulge bulge-bg-color="tn-blue" />
					<tn-tabbar-item :name="2" text="消息" icon="message" active-icon="message-fill" :badge="9" />
					<tn-tabbar-item :name="3" text="我的" icon="my" active-icon="my-fill" disabled />
				</tn-tabbar>
			</view>
			<text class="result-line">当前选中：{{ tabbarValue }}（第 4 项已禁用，点击无响应）</text>
		</demo-block>

		<!-- 5. NoticeBar 纵向 -->
		<demo-block
			title="TnNoticeBar 纵向滚动 / 暂停 / 图标事件"
			desc="direction=&quot;vertical&quot; 逐条切换；pause 冻结滚动；click / right-icon-click 暴露给业务"
			code="&lt;tn-notice-bar :data=&quot;list&quot; direction=&quot;vertical&quot; :pause=&quot;p&quot; @click=&quot;onClick&quot; /&gt;"
		>
			<tn-notice-bar
				:data="noticeData"
				direction="vertical"
				:auto-play="true"
				:speed="2500"
				left-icon="notice"
				left-icon-color="tn-blue"
				:right-icon="noticePaused ? 'play' : 'stop'"
				right-icon-color="tn-grey-dark"
				:pause="noticePaused"
				bg-color="tn-blue-light"
				text-color="tn-blue-dark"
				@click="onNoticeClick"
				@right-icon-click="toggleNotice"
			/>
			<view class="tn-demo-row tn-mt-sm">
				<tn-button size="sm" :type="noticePaused ? 'success' : 'warning'" @click="toggleNotice">
					{{ noticePaused ? '继续滚动' : '暂停滚动' }}
				</tn-button>
			</view>
		</demo-block>

		<!-- 6. SwipeAction -->
		<demo-block
			title="TnSwipeAction 事件 / 圆形 / 禁用"
			desc="open 在展开时触发，select 返回 (index, optionIndex)；选项支持 round 圆形、disabled 单项禁用"
			code="&lt;tn-swipe-action @open=&quot;onOpen&quot; @select=&quot;onSelect&quot;&gt;&#10;  &lt;tn-swipe-action-item :options=&quot;options&quot; /&gt;&#10;&lt;/tn-swipe-action&gt;"
		>
			<tn-swipe-action @open="onSwipeOpen" @select="onSwipeSelect">
				<tn-swipe-action-item v-for="item in swipeItems" :key="item.id" :options="swipeOptions(item)" :disabled="item.disabled">
					<view class="swipe-card">
						<text class="swipe-title">{{ item.title }}</text>
						<text class="tn-gray_text tn-text-sm">向左滑动查看操作项</text>
					</view>
				</tn-swipe-action-item>
			</tn-swipe-action>
		</demo-block>

		<!-- 7. Icon 进阶 -->
		<demo-block
			title="TnIcon 图片模式 / 透明 / 偏移"
			desc="name 除内置图标外还支持图片绝对路径（走 imgMode）；transparent 降低不透明度；offsetTop 做基线下移"
			code="&lt;tn-icon :name=&quot;'/static/demo/goods-1.jpg'&quot; :size=&quot;80&quot; img-mode=&quot;aspectFill&quot; /&gt;"
		>
			<view class="tn-demo-row">
				<view v-for="src in iconImages" :key="src" class="icon-cell">
					<tn-icon :name="src" :size="80" img-mode="aspectFill" />
					<text class="icon-label">图片图标</text>
				</view>
				<view class="icon-cell">
					<tn-icon name="star" :size="80" color="tn-orange" transparent />
					<text class="icon-label">transparent</text>
				</view>
				<view class="icon-cell">
					<tn-icon name="star-fill" :size="80" color="tn-red" :offset-top="12" />
					<text class="icon-label">offsetTop=12</text>
				</view>
			</view>
		</demo-block>

		<!-- 颜色命名规则 -->
		<demo-block
			title="颜色命名规则：type 用语义，color 用调色板"
			desc="组件内部会把 tn- 开头的颜色拼成 tn-xxx_bg / tn-xxx_text 原子类，而图鸟的原子类只有调色板名（tn-blue、tn-green…），没有 tn-primary；语义名只适用于 type"
			code="&lt;tn-button type=&quot;primary&quot; /&gt;      // ✅ 语义色&#10;&lt;tn-icon color=&quot;tn-blue&quot; /&gt;    // ✅ 调色板名&#10;&lt;tn-icon color=&quot;tn-primary&quot; /&gt; // ❌ 类不存在，回退默认色"
		>
			<view class="color-rule">
				<view class="color-cell">
					<tn-button size="sm" type="primary">type="primary"</tn-button>
					<text class="color-note">type 走语义映射 ✅</text>
				</view>
				<view class="color-cell">
					<tn-icon name="star-fill" :size="40" color="tn-blue" />
					<text class="color-note">color="tn-blue" ✅</text>
				</view>
				<view class="color-cell">
					<tn-icon name="star-fill" :size="40" color="tn-primary" />
					<text class="color-note">color="tn-primary" ❌</text>
				</view>
			</view>
		</demo-block>

		<!-- 8. Popup 事件 -->
		<demo-block
			title="TnPopup open / close / overlay-click"
			desc="弹层生命周期事件可用于埋点、二次确认、打开时请求数据"
			code="&lt;tn-popup v-model=&quot;show&quot; @open=&quot;onOpen&quot; @close=&quot;onClose&quot; @overlay-click=&quot;onOverlay&quot; /&gt;"
		>
			<view class="tn-demo-row">
				<tn-button size="sm" type="primary" @click="showPopup = true">打开弹层</tn-button>
			</view>
			<text class="result-line">事件日志：{{ popupLog }}</text>
		</demo-block>

		<!-- 9. 组件内置文案 i18n -->
		<demo-block
			title="组件内置文案国际化"
			desc="组件库的固定文案不会自动跟随 vue-i18n：Picker 用 cancel-text / confirm-text，ActionSheet 用 cancel-text，Loadmore 用 :text，Empty 用 #tips 插槽"
			code="&lt;tn-picker :cancel-text=&quot;t('common.cancel')&quot; :confirm-text=&quot;t('common.confirm')&quot; /&gt;"
		>
			<view class="lang-row">
				<tn-button
					v-for="(option, index) in localeOptions"
					:key="option.value"
					size="sm"
					:type="index === langIndex ? 'primary' : 'info'"
					:plain="index !== langIndex"
					@click="onLangChange(index)"
				>
					{{ option.label }}
				</tn-button>
			</view>

			<view class="i18n-grid">
				<view class="i18n-cell">
					<text class="i18n-label">Picker</text>
					<tn-button size="sm" @click="showPicker = true">{{ t('advanced.openPicker') }}</tn-button>
				</view>
				<view class="i18n-cell">
					<text class="i18n-label">ActionSheet</text>
					<tn-button size="sm" @click="showI18nActionSheet">{{ t('advanced.openSheet') }}</tn-button>
				</view>
				<view class="i18n-cell">
					<text class="i18n-label">Modal</text>
					<tn-button size="sm" @click="showI18nModal">{{ t('advanced.openModal') }}</tn-button>
				</view>
				<view class="i18n-cell">
					<text class="i18n-label">Loadmore</text>
					<tn-button size="sm" @click="cycleLoadmore">{{ t('advanced.switchStatus') }}</tn-button>
				</view>
			</view>

			<tn-loadmore :status="loadmoreStatus" :text="loadmoreText" class="tn-mt-sm" />

			<tn-empty mode="search" :show-tips="false" class="tn-mt-sm">
				<template #tips>
					<text>{{ t('advanced.emptyTips') }}</text>
				</template>
			</tn-empty>
		</demo-block>

		<!-- 10. CountDown 实例方法 -->
		<demo-block
			title="TnCountDown 实例方法 start / stop / reset"
			desc="ref&lt;TnCountDownInstance&gt;() 暴露三个方法，适合秒杀暂停、活动重置等场景"
			code="countRef.value?.stop()&#10;countRef.value?.reset()"
		>
			<tn-count-down ref="countDownRef" :time="countTime" separator-mode="en" border border-color="tn-blue" text-color="tn-blue" />
			<view class="tn-demo-row tn-mt-sm">
				<tn-button size="sm" @click="startCount">start</tn-button>
				<tn-button size="sm" plain @click="stopCount">stop</tn-button>
				<tn-button size="sm" type="warning" plain @click="resetCount">reset</tn-button>
			</view>
		</demo-block>

		<!-- 11. 工程化入口 -->
		<view class="engineering-card" @click="goEngineering">
			<view class="tn-flex tn-flex-center-start">
				<view class="engineering-icon">
					<tn-icon name="cube" :size="40" color="#ffffff" />
				</view>
				<view class="engineering-info">
					<text class="engineering-title">工程化与性能分包</text>
					<text class="engineering-desc">按需引入 / 分包 / 图标字体本地化 / 小程序上线检查清单</text>
				</view>
			</view>
			<tn-icon name="right" :size="32" color="tn-grey" />
		</view>

		<tn-footer
			:fixed="false"
			:navigator="[
				{ title: '组件总览', url: '/pages/components/index' },
				{ title: '主题规范', url: '/pages/theme/index' },
			]"
			content="进阶 API · 类型与多语言细节"
		/>

		<!-- 命令式组件 -->
		<tn-action-sheet ref="actionSheetRef" />
		<tn-modal ref="modalRef" />
		<tn-popup
			v-model="showPopup"
			:close-btn="true"
			:radius="24"
			@open="onPopupOpen"
			@close="onPopupClose"
			@overlay-click="onPopupOverlayClick"
		>
			<view class="popup-body">
				<text class="popup-title">Popup 事件演示</text>
				<text class="popup-desc">点击遮罩层、关闭按钮都会写入下方日志；open / close 与 v-model 同步。</text>
				<tn-button type="primary" class="tn-mt-sm" @click="showPopup = false">关闭弹层</tn-button>
			</view>
		</tn-popup>
		<tn-picker
			v-model="pickerValue"
			:data="pickerData"
			:open="showPicker"
			title="选择岗位"
			:cancel-text="t('common.cancel')"
			:confirm-text="t('common.confirm')"
			@close="showPicker = false"
			@confirm="showPicker = false"
		/>
		<view class="bottom-space" />
	</view>
</template>

<style lang="scss" scoped>
.page {
	background-color: #f5f6fa;
	padding-bottom: 40rpx;
}

.page-header {
	margin: 24rpx;
	padding: 32rpx;
	border-radius: 24rpx;
	background: linear-gradient(135deg, rgba(95, 79, 217, 0.14), rgba(1, 190, 255, 0.14));
}

.page-header__title {
	display: block;
	font-size: 38rpx;
	font-weight: 700;
	color: #303133;
}

.page-header__desc {
	display: block;
	margin-top: 10rpx;
	font-size: 24rpx;
	line-height: 1.7;
	color: #606266;
}

.result-line {
	display: block;
	margin-top: 16rpx;
	padding: 14rpx 18rpx;
	background-color: #f4f7fb;
	border-radius: 12rpx;
	font-size: 22rpx;
	color: #5a6472;
}

.navbar-box {
	overflow: hidden;
	border-radius: 16rpx;
	background-color: #f7f9fc;
}

.navbar-title {
	font-size: 26rpx;
	font-weight: 600;
}

.tabbar-box {
	padding: 8rpx 0;
	border-radius: 16rpx;
	background-color: #f7f9fc;
}

.swipe-card {
	padding: 26rpx 24rpx;
	background-color: #f7f9fc;
	border-radius: 14rpx;
	display: flex;
	flex-direction: column;
}

.swipe-title {
	font-size: 26rpx;
	font-weight: 600;
	color: #303133;
}

.icon-cell {
	width: 25%;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 12rpx 0;
}

.icon-label {
	margin-top: 8rpx;
	font-size: 20rpx;
	color: #909399;
}

.color-rule {
	display: flex;
	flex-wrap: wrap;
}

.color-cell {
	width: 33.33%;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 14rpx 0;
}

.color-note {
	margin-top: 10rpx;
	font-size: 20rpx;
	color: #909399;
	text-align: center;
}

.popup-body {
	padding: 44rpx 32rpx 36rpx;
	display: flex;
	flex-direction: column;
}

.popup-title {
	font-size: 30rpx;
	font-weight: 600;
	color: #303133;
}

.popup-desc {
	margin-top: 12rpx;
	font-size: 24rpx;
	line-height: 1.7;
	color: #606266;
}

.lang-row {
	display: flex;
	flex-wrap: wrap;
	gap: 16rpx;
	margin-top: 16rpx;
}

.i18n-grid {
	display: flex;
	flex-wrap: wrap;
	margin-top: 16rpx;
}

.i18n-cell {
	width: 50%;
	display: flex;
	align-items: center;
	justify-content: space-between;
	box-sizing: border-box;
	padding: 14rpx 16rpx 14rpx 0;
}

.i18n-label {
	font-size: 24rpx;
	color: #606266;
}

.engineering-card {
	margin: 16rpx 24rpx 0;
	padding: 26rpx 24rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	background: linear-gradient(135deg, #ffffff 0%, #eef7ff 100%);
	border-radius: 20rpx;
	box-shadow: 0 6rpx 20rpx rgba(1, 190, 255, 0.1);
}

.engineering-icon {
	width: 76rpx;
	height: 76rpx;
	border-radius: 18rpx;
	background: linear-gradient(135deg, #01beff 0%, #5f4fd9 100%);
	display: flex;
	align-items: center;
	justify-content: center;
}

.engineering-info {
	margin-left: 18rpx;
	display: flex;
	flex-direction: column;
}

.engineering-title {
	font-size: 28rpx;
	font-weight: 600;
	color: #303133;
}

.engineering-desc {
	margin-top: 6rpx;
	font-size: 22rpx;
	color: #909399;
}
</style>
