<script lang="ts" setup>
import { computed, ref } from 'vue'
import { banners, contacts, gallery, goods, scrollListData, waterFallData } from '@/data/mock'

/** Calendar */
const calendarMode = ref<'date' | 'multi' | 'range'>('date')
const calendarValue = ref<any>('')
const calendarText = computed(() => {
	const v = calendarValue.value
	return Array.isArray(v) ? v.join(' ~ ') || '未选择' : v || '未选择'
})

function changeCalendarMode(mode: typeof calendarMode.value) {
	calendarMode.value = mode
	calendarValue.value = mode === 'date' ? '' : []
}

function onCalendarTabChange(index: number) {
	changeCalendarMode(index === 0 ? 'date' : index === 1 ? 'multi' : 'range')
}

function onCalendarUpdate(value: any) {
	calendarValue.value = value
}

function onSwiperItemClick(index: number) {
	uni.showToast({ title: `点击第 ${index + 1} 张`, icon: 'none' })
}

function onSwiperChange(index: number) {
	swiperIndex.value = index
}

/** WeekCalendar */
const now = new Date()
const weekValue = ref(now.getDate())
const weekYear = ref(now.getFullYear())
const weekMonth = ref(now.getMonth() + 1)
const weekCustomData = [
	{ date: 5, desc: '发布' },
	{ date: 12, desc: '直播' },
	{ date: 18, desc: '上新' },
	{ date: 25, desc: '活动' },
]

/** Swiper */
const swiperIndex = ref(0)
const swiperIndicatorType = ref<'line' | 'dot' | 'number'>('line')
const swiperIndicatorPosition = ref<
	'left-top' | 'center-top' | 'right-top' | 'left-bottom' | 'center-bottom' | 'right-bottom'
>('center-bottom')

function setSwiperType(type: string) {
	swiperIndicatorType.value = type as 'line' | 'dot' | 'number'
}

function setSwiperPosition(position: string) {
	swiperIndicatorPosition.value = position as typeof swiperIndicatorPosition.value
}

/** PhotoAlbum */
const albumIndex = ref(-1)

/** WaterFall */
const waterFallRef = ref<any>(null)
const waterFallList = ref([...waterFallData])
const waterFallMode = ref<'normal' | 'calc'>('calc')
function appendWaterFall() {
	waterFallList.value = [
		...waterFallList.value,
		{ id: Date.now(), title: '新增模块', color: 'tn-blue', icon: 'add', height: 150 },
	]
}

/** ScrollList */
const scrollTip = ref('左右滑动试试')

/** IndexList */
function callPhone(item: any) {
	uni.showToast({ title: `拨打 ${item.name}：${item.phone}`, icon: 'none' })
}
</script>

<template>
	<view class="page">
		<view class="page-header">
			<text class="page-header__title">数据展示</text>
			<text class="page-header__desc">
				Calendar / WeekCalendar / Swiper / PhotoAlbum / LazyLoad / WaterFall / IndexList / ScrollList，覆盖日历、轮播、相册、图片懒加载、瀑布流与索引列表
			</text>
		</view>

		<!-- Calendar -->
		<demo-block
			title="TnCalendar 日历"
			desc="date / multi / range 三种模式；model-value 支持字符串或数组，可限制可选区间并显示农历"
			code="<tn-calendar v-model=&quot;v&quot; mode=&quot;range&quot; show-lunar />"
		>
			<tn-switch-tab
				:tabs="['单日', '多选', '区间']"
				:model-value="calendarMode === 'date' ? 0 : calendarMode === 'multi' ? 1 : 2"
				@change="onCalendarTabChange"
			/>
			<view class="calendar-wrap section-gap">
				<tn-calendar
					:model-value="calendarValue"
					:mode="calendarMode"
					min-date="2024-01-01"
					max-date="2027-12-31"
					:show-lunar="true"
					active-bg-color="tn-blue"
					range-bg-color="tn-blue-light"
					@update:model-value="onCalendarUpdate"
				/>
			</view>
			<text class="tn-gray_text tn-mt-sm">选中：{{ calendarText }}</text>
		</demo-block>

		<!-- WeekCalendar -->
		<demo-block
			title="TnWeekCalendar 周视图日历"
			desc="按月渲染一行一周，custom-data 可在日期下挂备注；v-model 为当月第几天"
			code="<tn-week-calendar v-model=&quot;day&quot; :year=&quot;2025&quot; :month=&quot;3&quot; :custom-data=&quot;list&quot; />"
		>
			<view class="week-calendar-wrap">
				<tn-week-calendar
					v-model="weekValue"
					:year="weekYear"
					:month="weekMonth"
					:custom-data="weekCustomData"
					active-bg-color="tn-purple"
					active-text-color="tn-white"
				/>
			</view>
			<text class="tn-gray_text tn-mt-sm">选中日期：{{ weekYear }}-{{ weekMonth }}-{{ weekValue }}</text>
		</demo-block>

		<!-- Swiper -->
		<demo-block
			title="TnSwiper 轮播图"
			desc="默认插槽参数为 { active, data, index }；indicatorType 支持 line / dot / number，indicatorPosition 支持 6 个位置"
			code="<tn-swiper :data=&quot;list&quot; indicator :indicator-type=&quot;type&quot; :indicator-position=&quot;position&quot; />"
		>
			<view class="mode-row">
				<tn-button
					v-for="item in ['line', 'dot', 'number']"
					:key="item"
					size="sm"
					:plain="swiperIndicatorType !== item"
					:type="swiperIndicatorType === item ? 'primary' : 'info'"
					@click="setSwiperType(item)"
				>
					{{ item }}
				</tn-button>
			</view>
			<view class="mode-row">
				<tn-button
					v-for="item in ['left-top', 'center-top', 'right-top', 'left-bottom', 'center-bottom', 'right-bottom']"
					:key="item"
					size="sm"
					:plain="swiperIndicatorPosition !== item"
					:type="swiperIndicatorPosition === item ? 'primary' : 'info'"
					@click="setSwiperPosition(item)"
				>
					{{ item.replace('-', ' · ') }}
				</tn-button>
			</view>
			<tn-swiper
				:data="banners"
				:model-value="swiperIndex"
				height="320"
				autoplay
				loop
				indicator
				:indicator-type="swiperIndicatorType"
				:indicator-position="swiperIndicatorPosition"
				indicator-active-bg-color="tn-blue"
				@update:model-value="onSwiperChange"
				@item-click="onSwiperItemClick"
			>
				<template #default="{ active, data }">
					<view class="swiper-item" :class="{ 'swiper-item--active': active }">
						<image :src="data.image" class="swiper-image" mode="aspectFill" />
						<view class="swiper-mask">
							<text class="swiper-title">{{ data.title }}</text>
							<text class="swiper-desc">{{ data.desc }}</text>
						</view>
					</view>
				</template>
			</tn-swiper>
			<text class="tn-gray_text tn-mt-sm">当前第 {{ swiperIndex + 1 }} / {{ banners.length }} 张</text>
		</demo-block>

		<!-- PhotoAlbum -->
		<demo-block
			title="TnPhotoAlbum 相册"
			desc="九宫格图片，支持 column / max / 懒加载 / 点击预览"
			code="<tn-photo-album :data=&quot;imgs&quot; :column=&quot;3&quot; :max=&quot;9&quot; />"
		>
			<tn-photo-album :data="gallery" :column="3" :max="6" @click="albumIndex = $event" />
			<text class="tn-gray_text tn-mt-sm">点击第 {{ albumIndex + 1 }} 张图片即可调起预览</text>
		</demo-block>

		<!-- LazyLoad -->
		<demo-block
			title="TnLazyLoad 图片懒加载"
			desc="距离视口 threshold 时才真正请求图片，transition 控制淡入，适合长列表图片"
			code="<tn-lazy-load src=&quot;/static/demo/goods-1.jpg&quot; height=&quot;300&quot; :threshold=&quot;100&quot; />"
		>
			<view class="lazy-row">
				<view v-for="item in goods" :key="item.id" class="lazy-cell">
					<tn-lazy-load :src="item.image" height="220" :threshold="100" transition />
					<text class="lazy-cell__text">{{ item.name }}</text>
				</view>
			</view>
		</demo-block>

		<!-- WaterFall -->
		<demo-block
			title="TnWaterFall 瀑布流"
			desc="normal / calc 两种排布模式可切换：normal 固定左右分栏，calc 按内容高度动态分配；reset() 可重置布局"
			code="<tn-water-fall :data=&quot;list&quot; :mode=&quot;mode&quot;><template #left=&quot;{ item }&quot;>...</template><template #right=&quot;{ item }&quot;>...</template></tn-water-fall>"
		>
			<view class="mode-row">
				<tn-button size="sm" :plain="waterFallMode !== 'normal'" @click="waterFallMode = 'normal'">normal</tn-button>
				<tn-button size="sm" :plain="waterFallMode !== 'calc'" @click="waterFallMode = 'calc'">calc</tn-button>
			</view>
			<view class="waterfall-wrap">
				<tn-water-fall ref="waterFallRef" :data="waterFallList" :mode="waterFallMode">
					<template #left="{ item }">
						<view class="waterfall-card" :class="[`tn-${String(item.color).replace('tn-', '')}_bg`]" :style="{ height: item.height + 'rpx' }">
							<tn-icon :name="item.icon" :size="40" color="#ffffff" />
							<text class="waterfall-card__title">{{ item.title }}</text>
						</view>
					</template>
					<template #right="{ item }">
						<view class="waterfall-card" :class="[`tn-${String(item.color).replace('tn-', '')}_bg`]" :style="{ height: item.height + 'rpx' }">
							<tn-icon :name="item.icon" :size="40" color="#ffffff" />
							<text class="waterfall-card__title">{{ item.title }}</text>
						</view>
					</template>
				</tn-water-fall>
			</view>
			<tn-button size="sm" plain class="tn-mt-sm" @click="appendWaterFall">追加一项</tn-button>
		</demo-block>

		<!-- ScrollList -->
		<demo-block
			title="TnScrollList 横向滚动"
			desc="横向 scroll-view 封装，带指示器；scroll-left / scroll-right 事件可做边界加载"
			code="<tn-scroll-list indicator><view v-for=&quot;...&quot; /></tn-scroll-list>"
		>
			<tn-scroll-list
				indicator
				indicator-color="tn-grey-light"
				indicator-block-color="tn-blue"
				@scroll-left="scrollTip = '已到最左边'"
				@scroll-right="scrollTip = '已到最右边'"
			>
				<view class="scroll-item" v-for="item in scrollListData" :key="item.id">
					<tn-icon :name="item.icon" :size="36" color="tn-blue" />
					<text class="scroll-item__title">{{ item.title }}</text>
					<text class="scroll-item__desc">{{ item.desc }}</text>
				</view>
			</tn-scroll-list>
			<text class="tn-gray_text tn-mt-sm">状态：{{ scrollTip }}</text>
		</demo-block>

		<!-- IndexList -->
		<demo-block
			title="TnIndexList 索引列表"
			desc="数据结构为 [{ key, title, data }]，右侧索引栏点击可跳转分组，支持吸顶分组标题"
			code="<tn-index-list :data=&quot;list&quot; show-keys-list><template #default=&quot;{ item }&quot;>...</template></tn-index-list>"
		>
			<view class="index-list-wrap">
				<tn-index-list :data="contacts" :sticky-offset-top="0" title-bg-color="tn-grey-light" show-keys-list>
					<template #default="{ data }">
						<view class="contact" @click="callPhone(data)">
							<tn-avatar :icon="data.avatarIcon" :bg-color="data.color" :size="40" />
							<view class="contact__info">
								<text class="contact__name">{{ data.name }}</text>
								<text class="contact__phone">{{ data.phone }}</text>
							</view>
							<tn-icon name="phone" :size="28" color="tn-blue" />
						</view>
					</template>
				</tn-index-list>
			</view>
		</demo-block>

		<view class="tip">所有数据来自 src/data/mock.ts，换成接口返回值即可直接复用</view>
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
	background: linear-gradient(135deg, rgba(45, 232, 189, 0.12), rgba(1, 190, 255, 0.12));
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

.calendar-wrap {
	overflow: hidden;
	border-radius: 16rpx;
}

.week-calendar-wrap {
	overflow: hidden;
	border-radius: 16rpx;
	background-color: #ffffff;
}

.swiper-item {
	position: relative;
	width: 100%;
	height: 100%;
	overflow: hidden;
	border-radius: 16rpx;
}

.swiper-item--active {
	opacity: 1;
}

.swiper-image {
	width: 100%;
	height: 100%;
	border-radius: 16rpx;
}

.swiper-mask {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	padding: 24rpx;
	background: linear-gradient(0deg, rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0));
	display: flex;
	flex-direction: column;
}

.swiper-title {
	font-size: 30rpx;
	font-weight: 600;
	color: #ffffff;
}

.swiper-desc {
	margin-top: 6rpx;
	font-size: 22rpx;
	color: rgba(255, 255, 255, 0.86);
}

.lazy-row {
	display: flex;
	gap: 16rpx;
}

.lazy-cell {
	flex: 1;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	border-radius: 12rpx;
	background-color: #f7f9fc;
}

.lazy-cell__text {
	padding: 10rpx;
	font-size: 20rpx;
	color: #606266;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.waterfall-wrap {
	min-height: 200rpx;
}

.waterfall-card {
	margin-bottom: 16rpx;
	padding: 20rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	border-radius: 16rpx;
}

.waterfall-card__title {
	margin-top: 10rpx;
	font-size: 24rpx;
	color: #ffffff;
}

.scroll-item {
	width: 240rpx;
	margin-right: 16rpx;
	padding: 22rpx;
	display: flex;
	flex-direction: column;
	background-color: #f7f9fc;
	border-radius: 16rpx;
}

.scroll-item__title {
	margin-top: 10rpx;
	font-size: 26rpx;
	font-weight: 600;
	color: #303133;
}

.scroll-item__desc {
	margin-top: 6rpx;
	font-size: 22rpx;
	color: #909399;
}

.index-list-wrap {
	overflow: hidden;
	border-radius: 16rpx;
}

.contact {
	display: flex;
	align-items: center;
	padding: 18rpx 20rpx;
	background-color: #ffffff;
	border-bottom: 1rpx solid #f2f4f8;
}

.contact__info {
	flex: 1;
	margin-left: 16rpx;
	display: flex;
	flex-direction: column;
}

.contact__name {
	font-size: 26rpx;
	color: #303133;
}

.contact__phone {
	font-size: 22rpx;
	color: #909399;
}

.tip {
	margin: 8rpx 32rpx 40rpx;
	font-size: 22rpx;
	color: #909399;
}
</style>

