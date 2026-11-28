<script lang="ts" setup>
import { ref } from 'vue'

/** 按钮：加载中 / 禁用 / 图标 / 文本按钮 */
const loading = ref(false)
function toggleLoading() {
	loading.value = true
	setTimeout(() => (loading.value = false), 1500)
}

const types = ['primary', 'success', 'warning', 'danger', 'info'] as const
const typeLabels = { primary: '主要', success: '成功', warning: '警告', danger: '危险', info: '信息' }

const clickCount = ref(0)
function handleClick() {
	clickCount.value++
	uni.showToast({ title: `点击 ${clickCount.value} 次`, icon: 'none' })
}

const avatarSizes = ['sm', '', 'lg', 'xl']

/** 图标：点击复制用法，并记录当前选中 */
const selectedIcon = ref('home')
function pickIcon(name: string) {
	selectedIcon.value = name
	uni.setClipboardData({
		data: `<tn-icon name="${name}" />`,
		success: () => uni.showToast({ title: `已复制 ${name}`, icon: 'none' }),
	})
}

/** 头像：点击记录当前选中的头像类型 */
const selectedAvatar = ref('girl')

/** 角标：加减改变数值，验证 max 与响应式更新 */
const badgeCount = ref(12)
function changeBadge(delta: number) {
	badgeCount.value = Math.max(0, Math.min(120, badgeCount.value + delta))
}

/** 标签：点击记录当前选中的语义色 */
const selectedTag = ref('success')

/** 标题：点击记录当前模式 */
const selectedTitle = ref('normal')
</script>

<template>
	<view class="page">
		<view class="page-header">
			<text class="page-header__title">基础组件</text>
			<text class="page-header__desc">按钮 / 图标 / 头像 / 标签 / 角标 / 标题，展示尺寸、形状、颜色类型与插槽用法</text>
		</view>

		<!-- Button -->
		<demo-block
			title="TnButton 按钮"
			desc="type 5 种语义色，size 4 档，shape 3 种；另有 plain / text / shadow / icon / loading / disabled"
			code="<tn-button type=&quot;primary&quot; size=&quot;lg&quot; shape=&quot;round&quot; icon=&quot;right&quot;>按钮</tn-button>"
		>
			<view class="tn-demo-row">
				<tn-button v-for="type in types" :key="type" :type="type" @click="handleClick">
					{{ typeLabels[type] }}
				</tn-button>
			</view>

			<view class="tn-demo-row section-gap">
				<tn-button size="sm">小号 sm</tn-button>
				<tn-button>默认</tn-button>
				<tn-button size="lg">大号 lg</tn-button>
				<tn-button size="xl">超大 xl</tn-button>
			</view>

			<view class="tn-demo-row section-gap">
				<tn-button shape="round">round</tn-button>
				<tn-button shape="circle" icon="like" />
				<tn-button plain>朴素按钮</tn-button>
				<tn-button text>文本按钮</tn-button>
			</view>

			<view class="tn-demo-row section-gap">
				<tn-button icon="share" shadow>带图标 + 阴影</tn-button>
				<tn-button :loading="loading" @click="toggleLoading">
					{{ loading ? '加载中' : '点击加载' }}
				</tn-button>
				<tn-button disabled>禁用</tn-button>
			</view>

			<view class="section-gap">
				<tn-button
					width="100%"
					height="96rpx"
					bg-color="tn-aquablue"
					shadow
					shadow-color="tn-aquablue"
					icon="cart"
				>
					自定义宽度 / 高度 / 背景色 / 阴影色（并占满一行）
				</tn-button>
			</view>
		</demo-block>

		<!-- Icon -->
		<demo-block
			title="TnIcon 图标"
			desc="name 直接写图标名；size/color/bold/type 控制外观；点击任意图标会复制对应 &lt;tn-icon&gt; 用法"
			code="<tn-icon name=&quot;home-fill&quot; :size=&quot;40&quot; color=&quot;tn-blue&quot; bold />"
		>
			<view class="icon-row">
				<view
					v-for="item in ['home','home-fill','search','cart','like','star-fill','ai','fire','gift','vip','creative','image']"
					:key="item"
					class="icon-cell"
					:class="{ 'icon-cell--active': selectedIcon === item }"
					@click="pickIcon(item)"
				>
					<tn-icon :name="item" :size="40" color="tn-blue" />
					<text class="icon-cell__label">{{ item }}</text>
				</view>
			</view>
			<text class="tn-gray_text tn-mt-sm">已选图标：{{ selectedIcon }} · 点击卡片复制用法</text>

			<view class="tn-demo-row section-gap">
				<tn-icon name="star-fill" :size="30" color="tn-orange" />
				<tn-icon name="star-fill" :size="40" color="tn-red" bold />
				<tn-icon name="star-fill" :size="52" type="primary" />
				<tn-icon name="star-fill" :size="52" type="success" transparent transparent-bg="tn-green-light" />
				<tn-icon name="star-fill" :size="52" color="tn-purple" />
				<tn-icon name="/static/demo/goods-2.jpg" :size="52" />
			</view>
		</demo-block>

		<!-- Avatar -->
		<demo-block
			title="TnAvatar 头像 + TnAvatarGroup 头像组"
			desc="图标头像 / 图片头像 / 形状 / 边框 / 阴影 / 角标，头像组自动重叠排列"
			code="<tn-avatar icon=&quot;girl&quot; type=&quot;primary&quot; shape=&quot;square&quot; badge=&quot;9&quot; />"
		>
			<view class="tn-demo-row">
				<view class="avatar-pick" :class="{ 'avatar-pick--active': selectedAvatar === 'girl' }" @click="selectedAvatar = 'girl'">
					<tn-avatar icon="girl" type="primary" :size="56" />
				</view>
				<view class="avatar-pick" :class="{ 'avatar-pick--active': selectedAvatar === 'boy' }" @click="selectedAvatar = 'boy'">
					<tn-avatar icon="boy" type="success" :size="56" shape="square" />
				</view>
				<view class="avatar-pick" :class="{ 'avatar-pick--active': selectedAvatar === 'image' }" @click="selectedAvatar = 'image'">
					<tn-avatar url="/static/demo/goods-1.jpg" :size="56" border border-color="tn-blue" border-bold />
				</view>
				<view class="avatar-pick" :class="{ 'avatar-pick--active': selectedAvatar === 'vip' }" @click="selectedAvatar = 'vip'">
					<tn-avatar icon="vip" type="warning" :size="56" shadow shadow-color="tn-orange" />
				</view>
				<view class="avatar-pick" :class="{ 'avatar-pick--active': selectedAvatar === 'badge' }" @click="selectedAvatar = 'badge'">
					<tn-avatar icon="girl" type="danger" :size="56" badge="8" :badge-config="{ max: 99 }" />
				</view>
			</view>
			<text class="tn-gray_text tn-mt-sm">已选头像：{{ selectedAvatar }}</text>

			<view class="avatar-sizes section-gap">
				<tn-avatar v-for="size in avatarSizes" :key="size" icon="boy" bg-color="tn-aquablue" :size="size || 44" />
			</view>

			<view class="section-gap avatar-group-pick" :class="{ 'avatar-group-pick--active': selectedAvatar === 'group' }" @click="selectedAvatar = 'group'">
				<tn-avatar-group :gap="0.6">
					<tn-avatar icon="girl" type="primary" :size="50" />
					<tn-avatar icon="boy" type="success" :size="50" />
					<tn-avatar icon="ai" bg-color="tn-purple" :size="50" />
					<tn-avatar url="/static/demo/goods-3.jpg" :size="50" />
					<tn-avatar :size="50" bg-color="tn-grey">+8</tn-avatar>
				</tn-avatar-group>
			</view>
		</demo-block>

		<!-- Badge -->
		<demo-block
			title="TnBadge 角标"
			desc="数值角标 / 上限 max / 圆点 dot / 绝对定位；下面可以加减数值观察角标实时更新"
			code="<tn-badge :value=&quot;count&quot; :max=&quot;99&quot; type=&quot;danger&quot; />"
		>
			<view class="tn-demo-row">
				<view class="badge-live">
					<tn-badge :value="badgeCount" :max="99" type="primary" />
					<text class="badge-live__text">{{ badgeCount }}</text>
				</view>
				<tn-badge value="120" :max="99" type="danger" />
				<tn-badge value="NEW" type="warning" />
				<tn-badge dot type="success" />
				<tn-badge value="9" size="sm" type="info" />
			</view>

			<view class="badge-control section-gap">
				<text class="badge-control__btn" @click="changeBadge(-1)">−</text>
				<text class="badge-control__value">当前值 {{ badgeCount }}，超过 99 会显示 99+</text>
				<text class="badge-control__btn" @click="changeBadge(1)">＋</text>
			</view>

			<view class="badge-anchor section-gap">
				<view class="badge-anchor__box" />
				<tn-badge value="12" type="danger" :absolute="true" :absolute-center="false" :absolute-position="{ top: 0, right: 0 }" />
			</view>
		</demo-block>

		<!-- Tag -->
		<demo-block
			title="TnTag 标签"
			desc="语义色 / 尺寸 / 形状（round、circleLeft、circleRight）/ 描边"
			code="<tn-tag type=&quot;success&quot; size=&quot;sm&quot; shape=&quot;circleLeft&quot;>标签</tn-tag>"
		>
			<view class="tn-demo-row">
				<view
					v-for="type in types"
					:key="type"
					class="tag-pick"
					:class="{ 'tag-pick--active': selectedTag === type }"
				>
					<tn-tag :type="type" @click="selectedTag = type">{{ typeLabels[type] }}</tn-tag>
				</view>
			</view>
			<text class="tn-gray_text tn-mt-sm">当前标签：{{ selectedTag }}</text>
			<view class="tn-demo-row section-gap">
				<tn-tag size="sm">sm</tn-tag>
				<tn-tag>默认</tn-tag>
				<tn-tag size="lg">lg</tn-tag>
				<tn-tag shape="round" type="primary">round</tn-tag>
				<tn-tag shape="circleLeft" type="success">circleLeft</tn-tag>
				<tn-tag shape="circleRight" type="warning">circleRight</tn-tag>
				<tn-tag border border-color="tn-red" border-bold text-color="tn-red">描边</tn-tag>
			</view>
		</demo-block>

		<!-- Title -->
		<demo-block
			title="TnTitle 标题"
			desc="6 种模式：normal / vLine / dot / hLine / subTitle / transparent，点击任意标题记录当前模式"
			code="<tn-title title=&quot;标题&quot; sub-title=&quot;副标题&quot; mode=&quot;subTitle&quot; align=&quot;center&quot; />"
		>
			<view class="tn-title-picks">
				<view class="title-pick" :class="{ 'title-pick--active': selectedTitle === 'normal' }">
					<tn-title title="normal 模式" @click="selectedTitle = 'normal'" />
				</view>
				<view class="title-pick" :class="{ 'title-pick--active': selectedTitle === 'vLine' }">
					<tn-title title="vLine 竖线" mode="vLine" assist-color="tn-blue" @click="selectedTitle = 'vLine'" />
				</view>
				<view class="title-pick" :class="{ 'title-pick--active': selectedTitle === 'dot' }">
					<tn-title title="dot 圆点" mode="dot" assist-color="tn-green" @click="selectedTitle = 'dot'" />
				</view>
				<view class="title-pick" :class="{ 'title-pick--active': selectedTitle === 'hLine' }">
					<tn-title title="hLine 横线" mode="hLine" align="center" assist-color="tn-orange" @click="selectedTitle = 'hLine'" />
				</view>
				<view class="title-pick" :class="{ 'title-pick--active': selectedTitle === 'subTitle' }">
					<tn-title title="subTitle" sub-title="带副标题的标题" mode="subTitle" @click="selectedTitle = 'subTitle'" />
				</view>
				<view class="title-pick" :class="{ 'title-pick--active': selectedTitle === 'transparent' }">
					<tn-title title="transparent" mode="transparent" @click="selectedTitle = 'transparent'" />
				</view>
			</view>
			<text class="tn-gray_text tn-mt-sm">当前标题模式：{{ selectedTitle }}</text>
		</demo-block>

		<view class="tip">点击计数：{{ clickCount }} 次（按钮事件与页面状态联动）</view>
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
	background: linear-gradient(135deg, rgba(1, 190, 255, 0.12), rgba(95, 79, 217, 0.12));
}

.page-header__title {
	display: block;
	font-size: 36rpx;
	font-weight: 700;
	color: #303133;
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

.icon-row {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}

.icon-cell {
	width: 110rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 14rpx 0;
	border-radius: 14rpx;
	background-color: #f7f9fc;
	border: 2rpx solid transparent;
}

.icon-cell--active {
	border-color: #5f4fd9;
	background-color: #f0efff;
}

.icon-cell__label {
	margin-top: 8rpx;
	font-size: 20rpx;
	color: #909399;
}

.avatar-pick {
	padding: 6rpx;
	border: 2rpx solid transparent;
	border-radius: 16rpx;
}

.avatar-pick--active {
	border-color: #5f4fd9;
	background-color: #f3f1ff;
}

.avatar-group-pick {
	align-self: flex-start;
	display: inline-flex;
	padding: 8rpx;
	border: 2rpx solid transparent;
	border-radius: 16rpx;
}

.avatar-group-pick--active {
	border-color: #5f4fd9;
	background-color: #f3f1ff;
}

.badge-live {
	display: flex;
	align-items: center;
	gap: 12rpx;
	padding: 8rpx 14rpx;
	border-radius: 12rpx;
	background-color: #f4f6fb;
}

.badge-live__text {
	font-size: 22rpx;
	color: #606266;
}

.badge-control {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16rpx;
	padding: 14rpx 16rpx;
	border-radius: 12rpx;
	background-color: #f7f9fc;
}

.badge-control__btn {
	width: 56rpx;
	height: 56rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
	background-color: #5f4fd9;
	color: #ffffff;
	font-size: 28rpx;
}

.badge-control__value {
	flex: 1;
	text-align: center;
	font-size: 21rpx;
	color: #606266;
}

.tag-pick {
	padding: 6rpx;
	border: 2rpx solid transparent;
	border-radius: 12rpx;
}

.tag-pick--active {
	border-color: #5f4fd9;
	background-color: #f3f1ff;
}

.tn-title-picks {
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.title-pick {
	padding: 6rpx 12rpx;
	border: 2rpx solid transparent;
	border-radius: 12rpx;
}

.title-pick--active {
	border-color: #5f4fd9;
	background-color: #f7f6ff;
}

.avatar-sizes {
	display: flex;
	align-items: flex-end;
	gap: 18rpx;
}

.badge-anchor {
	position: relative;
	width: 140rpx;
	height: 140rpx;
}

.badge-anchor__box {
	width: 100%;
	height: 100%;
	border-radius: 20rpx;
	background: linear-gradient(135deg, #e8f7ff, #e6e4fb);
}

.tip {
	margin: 8rpx 32rpx 40rpx;
	font-size: 22rpx;
	color: #909399;
}
</style>

