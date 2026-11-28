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
			desc="name 直接写图标名；size/color/bold/type 控制外观；也支持传图片地址渲染为图片图标"
			code="<tn-icon name=&quot;home-fill&quot; :size=&quot;40&quot; color=&quot;tn-blue&quot; bold />"
		>
			<view class="icon-row">
				<view v-for="item in ['home','home-fill','search','cart','like','star-fill','ai','fire','gift','vip','creative','image']" :key="item" class="icon-cell">
					<tn-icon :name="item" :size="40" color="tn-blue" />
					<text class="icon-cell__label">{{ item }}</text>
				</view>
			</view>

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
				<tn-avatar icon="girl" type="primary" :size="56" />
				<tn-avatar icon="boy" type="success" :size="56" shape="square" />
				<tn-avatar url="/static/demo/goods-1.jpg" :size="56" border border-color="tn-blue" border-bold />
				<tn-avatar icon="vip" type="warning" :size="56" shadow shadow-color="tn-orange" />
				<tn-avatar icon="girl" type="danger" :size="56" badge="8" :badge-config="{ max: 99 }" />
			</view>

			<view class="avatar-sizes section-gap">
				<tn-avatar v-for="size in avatarSizes" :key="size" icon="boy" bg-color="tn-aquablue" :size="size || 44" />
			</view>

			<view class="section-gap">
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
			desc="数值角标 / 上限 max / 圆点 dot / 绝对定位（配合 relative 容器使用）"
			code="<tn-badge value=&quot;99&quot; :max=&quot;99&quot; type=&quot;danger&quot; />"
		>
			<view class="tn-demo-row">
				<tn-badge value="5" />
				<tn-badge value="120" :max="99" type="danger" />
				<tn-badge value="NEW" type="warning" />
				<tn-badge dot type="success" />
				<tn-badge value="9" size="sm" type="info" />
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
				<tn-tag v-for="type in types" :key="type" :type="type">{{ typeLabels[type] }}</tn-tag>
			</view>
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
			desc="6 种模式：normal / vLine / dot / hLine / subTitle / transparent，可对齐与自定义辅助色"
			code="<tn-title title=&quot;标题&quot; sub-title=&quot;副标题&quot; mode=&quot;subTitle&quot; align=&quot;center&quot; />"
		>
			<tn-title title="normal 模式" />
			<tn-title title="vLine 竖线" mode="vLine" assist-color="tn-blue" />
			<tn-title title="dot 圆点" mode="dot" assist-color="tn-green" />
			<tn-title title="hLine 横线" mode="hLine" align="center" assist-color="tn-orange" />
			<tn-title title="subTitle" sub-title="带副标题的标题" mode="subTitle" />
			<tn-title title="transparent" mode="transparent" />
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
}

.icon-cell__label {
	margin-top: 8rpx;
	font-size: 20rpx;
	color: #909399;
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

