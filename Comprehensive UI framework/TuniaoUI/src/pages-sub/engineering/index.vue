<script lang="ts" setup>
import { computed, ref } from 'vue'

const checks = ref([
	{ key: 'safe-area', label: '底部安全区：tabBar / 固定操作栏留出 safe-area-inset-bottom', done: true },
	{ key: 'capsule', label: '自定义导航栏对齐胶囊：用 uni.getMenuButtonBoundingClientRect() 计算高度', done: true },
	{ key: 'font', label: '图标字体：确认使用 base64 内嵌版本，真机无外网也能显示', done: true },
	{ key: 'subpackage', label: '分包配置：subPackages 路径、root 与页面路径不重复', done: true },
	{ key: 'tabbar', label: '原生 tabBar 页面不能放在分包，switchTab 只能跳主包页面', done: true },
	{ key: 'easycom', label: '自定义 easycom 规则只在 pages.json 生效，H5 / 小程序 / App 表现一致', done: true },
	{ key: 'size', label: '主包体积 < 2MB，整体 < 20MB（当前小程序主包约 1.31MB）', done: true },
	{ key: 'device', label: '真机预览：iOS / Android 各跑一次，检查滚动、键盘、弹层层级', done: false },
])

const doneCount = computed(() => checks.value.filter((c) => c.done).length)

function toggleCheck(index: number) {
	const item = checks.value[index]
	if (item) item.done = !item.done
}

function goAdvanced() {
	uni.navigateBack({
		fail: () => {
			uni.redirectTo({ url: '/pages/advanced/index' })
		},
	})
}

const pagesJsonCode = `{
  "pages": [
    { "path": "pages/index/index", "style": { "navigationBarTitleText": "首页" } }
    // ... 主包 12 个页面
  ],
  "subPackages": [
    {
      "root": "pages-sub",
      "pages": [
        { "path": "engineering/index", "style": { "navigationBarTitleText": "工程化" } }
      ]
    }
  ]
}`

const onDemandCode = `// 按需引入：只打包用到的组件
import { TnButton, TnInput, TnPopup } from '@tuniao/tnui-vue3-uniapp'
app.component('TnButton', TnButton)
app.component('TnInput', TnInput)
app.component('TnPopup', TnPopup)

// 全量注册：本项目采用（示例工程需要展示全部 55 个组件）
import * as TnUI from '@tuniao/tnui-vue3-uniapp'
Object.entries(TnUI).forEach(([name, comp]) => {
  if (/^Tn[A-Z]/.test(name) && comp?.install) {
    app.component(name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(), comp)
  }
})`

const fontCode = `/* App.vue：在 tn-style 之后追加 base64 图标字体，覆盖 CDN 地址 */
@import '@tuniao/tn-style/dist/uniapp/index.css';
@import '@tuniao/tn-icon/dist/base64/index.css';`

const mpCheckCode = `// 自定义导航栏高度（含状态栏 + 胶囊）
const menu = uni.getMenuButtonBoundingClientRect()
const statusBar = uni.getSystemInfoSync().statusBarHeight || 0
const navHeight = menu.height + (menu.top - statusBar) * 2`
</script>

<template>
	<view class="page">
		<view class="page-header">
			<view class="header-top">
				<tn-tag type="primary" size="sm">分包页面</tn-tag>
				<text class="header-path">pages-sub/engineering/index</text>
			</view>
			<text class="page-header__title">工程化与性能分包</text>
			<text class="page-header__desc">
				这一页本身放在 subPackages 里，用来演示真实分包、按需引入、图标字体本地化和小程序上线检查清单。
			</text>
		</view>

		<demo-block
			title="真实分包：subPackages"
			desc="本页路径为 pages-sub/engineering/index，由 pages.json 的 subPackages 声明；从进阶页 navigateTo 进入，构建时会单独产出分包 chunk"
			code="&quot;subPackages&quot;: [{ &quot;root&quot;: &quot;pages-sub&quot;, &quot;pages&quot;: [{ &quot;path&quot;: &quot;engineering/index&quot; }] }]"
		>
			<view class="stat-row">
				<view class="stat-cell">
					<text class="stat-num">12</text>
					<text class="stat-label">主包页面</text>
				</view>
				<view class="stat-cell">
					<text class="stat-num">1</text>
					<text class="stat-label">分包页面</text>
				</view>
				<view class="stat-cell">
					<text class="stat-num">2MB</text>
					<text class="stat-label">微信主包上限</text>
				</view>
			</view>
			<text class="tip-text">
				分包的价值：主包只保留 tabBar 与高频页面，低频/重型页面放进 subPackages，首次启动下载体积更小；微信允许「分包预下载」进一步优化体验。
			</text>
			<text class="code-title">pages.json 结构</text>
			<scroll-view class="code-scroll" scroll-x :show-scrollbar="false">
				<text class="tn-demo-code">{{ pagesJsonCode }}</text>
			</scroll-view>
			<text class="warn-text">
				注意：tabBar 页面必须在主包；分包之间不能互相引用资源；分包页面跳转仍用绝对路径 /pages-sub/xxx。
			</text>
		</demo-block>

		<demo-block
			title="按需引入 vs 全量注册"
			desc="组件库入口只导出组件对象、不自动注册；生产项目建议按需注册，示例工程为了展示全部组件才用全量遍历"
			code="import { TnButton } from '@tuniao/tnui-vue3-uniapp'&#10;app.component('TnButton', TnButton)"
		>
			<scroll-view class="code-scroll" scroll-x :show-scrollbar="false">
				<text class="tn-demo-code">{{ onDemandCode }}</text>
			</scroll-view>
			<view class="compare-row">
				<view class="compare-cell compare-cell--good">
					<text class="compare-title">按需注册</text>
					<text class="compare-desc">产物体积小、启动快；新增组件需要手动补一行。</text>
				</view>
				<view class="compare-cell">
					<text class="compare-title">全量注册（本项目）</text>
					<text class="compare-desc">一次注册全部 55 个组件，适合示例/组件库文档站；业务项目慎用。</text>
				</view>
			</view>
		</demo-block>

		<demo-block
			title="图标字体本地化（离线 / 小程序可用）"
			desc="默认样式表的 @font-face 指向 //at.alicdn.com 的 woff，断网或域名被拦截时图标会变方块；改用 dist/base64 内嵌字体重写声明即可离线"
			code="@import '@tuniao/tn-icon/dist/base64/index.css';"
		>
			<scroll-view class="code-scroll" scroll-x :show-scrollbar="false">
				<text class="tn-demo-code">{{ fontCode }}</text>
			</scroll-view>
			<text class="tip-text">
				本项目已在 App.vue 引入 base64 版本（约 178KB，woff2 内嵌）。引入顺序必须在 tn-style 之后，后声明的同名字体族会覆盖前者。
			</text>
			<view class="font-preview">
				<tn-icon v-for="name in ['home', 'message', 'my', 'star', 'cart', 'set', 'creative', 'image']" :key="name" :name="name" :size="52" color="tn-blue" />
			</view>
			<text class="tn-gray_text tn-text-sm">以上图标全部来自本地字体文件；H5 控制台 Network 里不应再出现 at.alicdn 请求。</text>
		</demo-block>

		<demo-block
			title="小程序上线检查清单"
			desc="H5 通过不代表小程序通过：安全区、胶囊、字体、分包、tabBar 都有平台差异，逐项打勾"
			code="uni.getMenuButtonBoundingClientRect() // 胶囊位置"
		>
			<view class="check-progress">
				<text class="check-progress__text">已完成 {{ doneCount }} / {{ checks.length }}</text>
				<view class="check-progress__bar">
					<view class="check-progress__inner" :style="{ width: `${(doneCount / checks.length) * 100}%` }" />
				</view>
			</view>
			<view v-for="(item, index) in checks" :key="item.key" class="check-item" @click="toggleCheck(index)">
				<tn-icon :name="item.done ? 'check' : 'circle'" :size="34" :color="item.done ? 'tn-green' : 'tn-grey'" />
				<text class="check-label" :class="{ 'check-label--done': item.done }">{{ item.label }}</text>
			</view>
			<text class="code-title">自定义导航栏高度计算</text>
			<scroll-view class="code-scroll" scroll-x :show-scrollbar="false">
				<text class="tn-demo-code">{{ mpCheckCode }}</text>
			</scroll-view>
		</demo-block>

		<demo-block
			title="构建命令与产物体积"
			desc="H5 构建约 1.46MB / 46 个文件；小程序约 1.33MB / 188 个文件；App 约 1.9MB / 38 个文件"
			code="npm run build:h5&#10;npm run build:mp-weixin&#10;npm run build:app&#10;npm run type-check"
		>
			<view class="cmd-list">
				<view class="cmd-item">
					<text class="cmd-name">npm run dev:h5</text>
					<text class="cmd-desc">本地开发，默认 5173（占用时自动 5174）</text>
				</view>
				<view class="cmd-item">
					<text class="cmd-name">npm run build:h5</text>
					<text class="cmd-desc">产出 dist/build/h5，base 为 './' 可直接静态部署</text>
				</view>
				<view class="cmd-item">
					<text class="cmd-name">npm run build:mp-weixin</text>
					<text class="cmd-desc">产出 dist/build/mp-weixin，用微信开发者工具导入</text>
				</view>
				<view class="cmd-item">
					<text class="cmd-name">npm run build:app</text>
					<text class="cmd-desc">产出 dist/build/app，用 HBuilderX 导入运行到 App 基座</text>
				</view>
				<view class="cmd-item">
					<text class="cmd-name">npm run type-check</text>
					<text class="cmd-desc">vue-tsc 全量类型检查，建议接入 CI</text>
				</view>
			</view>
		</demo-block>

		<demo-block
			title="小程序常见差异（踩坑记录）"
			desc="这些差异在 H5 上看不出来，真机才会暴露"
			code="// 统一走 safe-area / 胶囊计算，别写死 44px"
		>
			<view class="pitfall-list">
				<view class="pitfall-item">
					<tn-icon name="warning" :size="30" color="tn-orange" />
					<text class="pitfall-text">弹层层级：小程序原生组件（video / map / canvas）会盖住普通 popup，必要时用 cover-view。</text>
				</view>
				<view class="pitfall-item">
					<tn-icon name="warning" :size="30" color="tn-orange" />
					<text class="pitfall-text">CSS：不支持部分选择器与 backdrop-filter，阴影/毛玻璃要降级。</text>
				</view>
				<view class="pitfall-item">
					<tn-icon name="warning" :size="30" color="tn-orange" />
					<text class="pitfall-text">字体：小程序不能加载外链字体，必须 base64 或本地 ttf 转换。</text>
				</view>
				<view class="pitfall-item">
					<tn-icon name="warning" :size="30" color="tn-orange" />
					<text class="pitfall-text">分包：分包内不能引用主包外的静态资源，图片尽量放主包 static 或 CDN。</text>
				</view>
			</view>
		</demo-block>

		<view class="back-card" @click="goAdvanced">
			<tn-icon name="left" :size="32" color="tn-blue" />
			<text class="back-text">返回进阶 API 页</text>
		</view>

		<tn-footer
			:fixed="false"
			:navigator="[
				{ title: '进阶 API', url: '/pages/advanced/index' },
				{ title: '主题规范', url: '/pages/theme/index' },
			]"
			content="工程化 · 分包 · 离线字体"
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
	background: linear-gradient(135deg, rgba(1, 190, 255, 0.16), rgba(95, 79, 217, 0.14));
}

.header-top {
	display: flex;
	align-items: center;
	margin-bottom: 12rpx;
}

.header-path {
	margin-left: 14rpx;
	font-size: 22rpx;
	color: #7b8794;
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

.stat-row {
	display: flex;
	margin-bottom: 18rpx;
}

.stat-cell {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 18rpx 0;
	background-color: #f4f8ff;
	border-radius: 14rpx;
	margin-right: 12rpx;
}

.stat-cell:last-child {
	margin-right: 0;
}

.stat-num {
	font-size: 34rpx;
	font-weight: 700;
	color: #01beff;
}

.stat-label {
	margin-top: 6rpx;
	font-size: 20rpx;
	color: #909399;
}

.tip-text {
	display: block;
	font-size: 23rpx;
	line-height: 1.75;
	color: #606266;
}

.warn-text {
	display: block;
	margin-top: 14rpx;
	padding: 14rpx 18rpx;
	font-size: 22rpx;
	line-height: 1.7;
	color: #b26a00;
	background-color: #fff8e8;
	border-radius: 12rpx;
}

.code-scroll {
	margin-top: 20rpx;
	border: 1rpx solid #1e293b;
	border-radius: 18rpx;
	background-color: #0f172a;
	overflow: hidden;
}

.code-title {
	display: block;
	margin: 20rpx 0 8rpx;
	font-size: 22rpx;
	font-weight: 600;
	color: #303133;
}

.compare-row {
	display: flex;
	margin-top: 18rpx;
}

.compare-cell {
	flex: 1;
	padding: 20rpx;
	border-radius: 14rpx;
	background-color: #f7f9fc;
	margin-right: 12rpx;
}

.compare-cell:last-child {
	margin-right: 0;
}

.compare-cell--good {
	background-color: #f0fbf3;
}

.compare-title {
	display: block;
	font-size: 24rpx;
	font-weight: 600;
	color: #303133;
}

.compare-desc {
	display: block;
	margin-top: 8rpx;
	font-size: 21rpx;
	line-height: 1.6;
	color: #7b8794;
}

.font-preview {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 24rpx;
	margin: 18rpx 0 10rpx;
}

.check-progress {
	margin-bottom: 16rpx;
}

.check-progress__text {
	font-size: 22rpx;
	color: #606266;
}

.check-progress__bar {
	margin-top: 8rpx;
	height: 12rpx;
	border-radius: 8rpx;
	background-color: #eef1f6;
	overflow: hidden;
}

.check-progress__inner {
	height: 100%;
	border-radius: 8rpx;
	background: linear-gradient(90deg, #01beff, #5f4fd9);
	transition: width 0.3s;
}

.check-item {
	display: flex;
	align-items: flex-start;
	padding: 14rpx 0;
	border-bottom: 1rpx solid #f0f2f5;
}

.check-label {
	flex: 1;
	margin-left: 14rpx;
	font-size: 23rpx;
	line-height: 1.6;
	color: #606266;
}

.check-label--done {
	color: #9aa3ad;
	text-decoration: line-through;
}

.cmd-list {
	margin-top: 8rpx;
}

.cmd-item {
	display: flex;
	flex-direction: column;
	padding: 16rpx 18rpx;
	margin-bottom: 12rpx;
	background-color: #f7f9fc;
	border-radius: 12rpx;
}

.cmd-name {
	font-size: 24rpx;
	font-weight: 600;
	color: #01beff;
	font-family: 'Menlo', 'Consolas', monospace;
}

.cmd-desc {
	margin-top: 6rpx;
	font-size: 21rpx;
	color: #7b8794;
}

.pitfall-item {
	display: flex;
	align-items: flex-start;
	padding: 12rpx 0;
}

.pitfall-text {
	flex: 1;
	margin-left: 12rpx;
	font-size: 23rpx;
	line-height: 1.65;
	color: #606266;
}

.back-card {
	margin: 16rpx 24rpx 0;
	padding: 24rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background-color: #ffffff;
	border-radius: 18rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.back-text {
	margin-left: 10rpx;
	font-size: 26rpx;
	color: #01beff;
}

.bottom-space {
	height: 40rpx;
}
</style>
