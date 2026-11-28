<script lang="ts" setup>
import { ref } from 'vue'

const importExample = "import { TnButton } from '@tuniao/tnui-vue3-uniapp'"

/** Navbar */
const navbarBg = ref<'primary' | 'white'>('white')

/** Tabs */
const tabActive = ref('basic')
const tabActiveNoBar = ref(1)
const tabsData = [
	{ name: 'basic', title: '基础' },
	{ name: 'form', title: '表单' },
	{ name: 'feedback', title: '反馈' },
	{ name: 'nav', title: '导航' },
	{ name: 'data', title: '数据' },
	{ name: 'theme', title: '主题' },
]

/** Tabbar */
const tabbarActive = ref('home')
const tabbarItems = [
	{ name: 'home', text: '首页', icon: 'home', activeIcon: 'home-fill' },
	{ name: 'component', text: '组件', icon: 'cube', activeIcon: 'cube-fill', badge: '2' },
	{ name: 'publish', text: '发布', icon: 'add', bulge: true, bulgeBgColor: 'tn-blue' },
	{ name: 'message', text: '消息', icon: 'message', activeIcon: 'message-fill', badge: '9' },
	{ name: 'mine', text: '我的', icon: 'my', activeIcon: 'my-fill' },
]

/** SwitchTab */
const switchTabIndex = ref(1)
const switchTabs = ['待付款', '待发货', '待收货', '已完成']

/** Steps */
const stepIndex = ref(1)
const stepMode = ref<'dot' | 'number' | 'dotIcon' | 'icon'>('number')

/** Collapse */
const collapseAccordion = ref(true)
const collapseValue = ref<number | number[]>(0)

function setCollapseMode(accordion: boolean) {
	collapseAccordion.value = accordion
	// 手风琴只允许一个索引；多开模式用数组一次展开多项
	collapseValue.value = accordion ? 0 : [0, 1]
}

/** Subsection */
const subsectionIndex = ref(0)
const subsectionButtonIndex = ref(1)

/** SwipeAction */
function onSwipeClick(item: any) {
	const text = item?.text || String(item)
	uni.showToast({ title: `点击了 ${text}`, icon: 'none' })
}
</script>

<template>
	<view class="page">
		<view class="page-header">
			<text class="page-header__title">导航组件</text>
			<text class="page-header__desc">
				Navbar / Tabs / Tabbar / SwitchTab / Steps / Collapse / SwipeAction / Subsection，覆盖自定义导航、标签切换、步骤条、折叠面板与滑动操作
			</text>
		</view>

		<!-- Navbar -->
		<demo-block
			title="TnNavbar 自定义导航栏"
			desc="支持返回/回首页、标题插槽、右侧操作插槽、毛玻璃与透明度；fixed 时会自动占位"
			code="<tn-navbar :fixed=&quot;false&quot;>标题<template #right>...</template></tn-navbar>"
		>
			<view class="navbar-demo">
				<tn-navbar :fixed="false" :bg-color="navbarBg === 'primary' ? 'tn-blue' : '#ffffff'" :text-color="navbarBg === 'primary' ? 'tn-white' : '#303133'">
					自定义导航栏
					<template #right>
						<view class="tn-flex tn-flex-center-center" @click="navbarBg = navbarBg === 'primary' ? 'white' : 'primary'">
							<tn-icon name="creative" :size="34" :color="navbarBg === 'primary' ? 'tn-white' : 'tn-grey'" />
						</view>
					</template>
				</tn-navbar>
			</view>
			<text class="tn-gray_text tn-mt-sm">点击右侧调色板图标切换导航栏配色</text>
		</demo-block>

		<!-- Tabs -->
		<demo-block
			title="TnTabs 标签页"
			desc="v-model 绑定 item 的 name；bar / scroll / activeBold / barWidth 可配置，支持下划线或纯文字模式"
			code="<tn-tabs v-model=&quot;active&quot;><tn-tabs-item name=&quot;a&quot; title=&quot;A&quot; /></tn-tabs>"
		>
			<view class="tabs-wrap">
				<tn-tabs v-model="tabActive" :scroll="true" :bar="true" active-color="tn-blue" bar-color="tn-blue">
					<tn-tabs-item v-for="item in tabsData" :key="item.name" :name="item.name" :title="item.title" />
				</tn-tabs>
			</view>
			<text class="tn-gray_text tn-mt-sm">当前选中：{{ tabActive }}</text>

			<view class="tabs-wrap section-gap">
				<tn-tabs v-model="tabActiveNoBar" :bar="false" active-color="tn-purple" active-font-size="34" bottom-shadow>
					<tn-tabs-item :name="1" title="推荐" :badge-config="{ value: 'HOT' }" />
					<tn-tabs-item :name="2" title="最新" />
					<tn-tabs-item :name="3" title="关注" disabled />
				</tn-tabs>
			</view>
		</demo-block>

		<!-- Tabbar -->
		<demo-block
			title="TnTabbar 底部标签栏"
			desc="支持凸起按钮、角标、毛玻璃、切换动画和切换前拦截；本项目实际使用的是原生 tabBar"
			code="<tn-tabbar v-model=&quot;active&quot;><tn-tabbar-item name=&quot;home&quot; icon=&quot;home&quot; /></tn-tabbar>"
			>
			<view class="tabbar-demo">
				<tn-tabbar v-model="tabbarActive" :fixed="false" :safe-area-inset-bottom="false" active-color="tn-blue" :switch-animation="true">
					<tn-tabbar-item
						v-for="item in tabbarItems"
						:key="item.name"
						:name="item.name"
						:text="item.text"
						:icon="item.icon"
						:active-icon="item.activeIcon"
						:bulge="item.bulge"
						:bulge-bg-color="item.bulgeBgColor"
						:badge="item.badge"
					/>
				</tn-tabbar>
			</view>
			<text class="tn-gray_text tn-mt-sm">当前选中：{{ tabbarActive }}</text>
		</demo-block>

		<!-- SwitchTab -->
		<demo-block
			title="TnSwitchTab 分段切换"
			desc="纯字符串数组即可渲染，选中项背景色与文字色都能定制"
			code="<tn-switch-tab v-model=&quot;i&quot; :tabs=&quot;['A','B']&quot; active-bg-color=&quot;tn-blue&quot; />"
		>
			<tn-switch-tab
				v-model="switchTabIndex"
				:tabs="switchTabs"
				active-bg-color="tn-blue"
				inactive-bg-color="tn-grey-light"
				active-text-color="tn-white"
				inactive-text-color="tn-grey-dark"
			/>
			<text class="tn-gray_text tn-mt-sm">当前索引：{{ switchTabIndex }}</text>
		</demo-block>

		<!-- Steps -->
		<demo-block
			title="TnSteps 步骤条"
			desc="dot / number / dotIcon / icon 四种模式，点击可切换当前步骤"
			code="<tn-steps v-model=&quot;step&quot; mode=&quot;number&quot;><tn-steps-item title=&quot;下单&quot; /></tn-steps>"
		>
			<view class="tn-demo-row">
				<tn-button v-for="mode in ['dot', 'number', 'dotIcon', 'icon']" :key="mode" size="sm" :plain="stepMode !== mode" @click="stepMode = mode">
					{{ mode }}
				</tn-button>
			</view>

			<view class="section-gap">
				<tn-steps v-model="stepIndex" :mode="stepMode">
					<tn-steps-item title="提交订单" icon="edit-form" active-icon="edit" />
					<tn-steps-item title="商家发货" icon="cart" active-icon="cart-fill" />
					<tn-steps-item title="确认收货" icon="check" active-icon="check" />
					<tn-steps-item title="评价" icon="comment" active-icon="comment-fill" />
				</tn-steps>
			</view>
			<text class="tn-gray_text tn-mt-sm">当前步骤：{{ stepIndex + 1 }} / 4</text>
		</demo-block>

		<!-- Collapse -->
		<demo-block
			title="TnCollapse 折叠面板"
			desc="accordion=true 一次只展开一项，modelValue 为 number；accordion=false 可同时展开多项，modelValue 为 number[]"
			code="<tn-collapse v-model=&quot;value&quot; :accordion=&quot;accordion&quot;><tn-collapse-item title=&quot;标题&quot; /></tn-collapse>"
		>
			<view class="mode-row">
				<tn-button size="sm" :plain="!collapseAccordion" @click="setCollapseMode(true)">手风琴（单开）</tn-button>
				<tn-button size="sm" :plain="collapseAccordion" @click="setCollapseMode(false)">多开（number[]）</tn-button>
			</view>
			<tn-collapse v-model="collapseValue" :accordion="collapseAccordion">
				<tn-collapse-item title="什么是原子类？">
					<text class="collapse-text">@tuniao/tn-style 提供 tn-flex、tn-w-1-2、tn-p-lg 等工具类，减少重复样式编写。</text>
				</tn-collapse-item>
				<tn-collapse-item title="如何换肤？">
					<text class="collapse-text">覆盖 --tn-color-primary 与 --tn-color-primary-rgb 两个 CSS 变量即可全局生效，详见「主题」页。</text>
				</tn-collapse-item>
				<tn-collapse-item title="如何按需引入？">
					<text class="collapse-text">除 app.use 全量安装外，也可以在页面里 {{ importExample }}，或用 easycom 规则自动引入。</text>
				</tn-collapse-item>
			</tn-collapse>
		</demo-block>

		<!-- Subsection -->
		<demo-block
			title="TnSubsection 分段器"
			desc="default 下划线风格与 button 按钮风格，v-model 为索引"
			code="<tn-subsection v-model=&quot;i&quot; mode=&quot;button&quot;><tn-subsection-item title=&quot;全部&quot; /></tn-subsection>"
		>
			<tn-subsection v-model="subsectionIndex" active-color="tn-blue">
				<tn-subsection-item title="全部订单" />
				<tn-subsection-item title="待付款" />
				<tn-subsection-item title="已完成" />
			</tn-subsection>

			<view class="section-gap">
				<tn-subsection v-model="subsectionButtonIndex" mode="button" active-color="tn-purple" radius="12">
					<tn-subsection-item title="日" />
					<tn-subsection-item title="周" />
					<tn-subsection-item title="月" />
				</tn-subsection>
			</view>
		</demo-block>

		<!-- SwipeAction -->
		<demo-block
			title="TnSwipeAction 滑动操作"
			desc="左滑露出操作菜单，options 支持 text / icon / bgColor / round / disabled"
			code="<tn-swipe-action-item :options=&quot;[{ text: '删除', bgColor: 'tn-red' }]&quot; />"
		>
			<tn-swipe-action-item :options="[{ text: '置顶', bgColor: 'tn-blue', textColor: 'tn-white' }, { text: '删除', bgColor: 'tn-red', textColor: 'tn-white', icon: 'delete' }]" @click="onSwipeClick">
				<view class="swipe-cell">
					<tn-avatar icon="boy" type="primary" :size="40" />
					<view class="swipe-cell__info">
						<text class="swipe-cell__title">向左滑动这一行</text>
						<text class="swipe-cell__desc">露出置顶 / 删除按钮</text>
					</view>
				</view>
			</tn-swipe-action-item>

			<tn-swipe-action-item
				class="section-gap"
				:options="[{ text: '复制', bgColor: 'tn-grey-light', textColor: 'tn-grey-dark', round: true }, { text: '禁用项', disabled: true }]"
			>
				<view class="swipe-cell">
					<tn-avatar icon="girl" type="purple" :size="40" />
					<view class="swipe-cell__info">
						<text class="swipe-cell__title">圆角 / 禁用项演示</text>
						<text class="swipe-cell__desc">options 每一项都可以单独设置</text>
					</view>
				</view>
			</tn-swipe-action-item>
		</demo-block>

		<view class="tip">Navbar / Tabbar 默认 fixed，示例中关闭了 fixed 以便在页面内展示；真实项目里按需开启即可</view>
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
	background: linear-gradient(135deg, rgba(0, 216, 134, 0.12), rgba(49, 201, 232, 0.12));
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

.navbar-demo {
	overflow: hidden;
	border-radius: 16rpx;
	border: 1rpx solid #eaedf2;
}

.tabs-wrap {
	overflow: hidden;
	border-radius: 16rpx;
	background-color: #ffffff;
}

.tabbar-demo {
	overflow: hidden;
	border-radius: 16rpx;
	border: 1rpx solid #eaedf2;
}

.collapse-text {
	font-size: 24rpx;
	line-height: 1.7;
	color: #606266;
}

.swipe-cell {
	display: flex;
	align-items: center;
	padding: 20rpx 24rpx;
	background-color: #ffffff;
}

.swipe-cell__info {
	margin-left: 16rpx;
	display: flex;
	flex-direction: column;
}

.swipe-cell__title {
	font-size: 26rpx;
	color: #303133;
}

.swipe-cell__desc {
	margin-top: 6rpx;
	font-size: 22rpx;
	color: #909399;
}

.tip {
	margin: 8rpx 32rpx 40rpx;
	font-size: 22rpx;
	color: #909399;
}
</style>

