<script lang="ts" setup>
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()


const { t } = useI18n()

/** 表单模型：所有 v-model 都指向这个对象，TnForm 通过 prop 定位字段 */
const formModel = reactive({
	username: '',
	password: '',
	nickname: '',
	asyncName: '',
	email: '',
	phone: '',
	gender: 'male',
	hobbies: ['篮球'] as string[],
	notify: true,
	volume: 40,
	priceRange: [20, 80] as number[],
	level: 3,
	count: 1,
	keyword: '',
	images: [] as string[],
	role: 'personal',
	remark: '',
	cityName: '',
	cityCodes: [] as string[],
	regionNames: ['广东省', '深圳市', '南山区'] as string[],
	birthday: '',
	sizeColor: ['M', '红色'] as string[],
	area: ['广东省', '深圳市', '南山区'] as string[],
})

/** 知识点：async-validator 规则：required / type / min-max / pattern / trigger */
const rules = {
	username: [
		{ required: true, message: '请输入用户名', trigger: 'blur' },
		{ min: 3, max: 12, message: '用户名 3-12 个字符', trigger: 'blur' },
	],
	email: [
		{ required: false, type: 'email', message: '邮箱格式不正确', trigger: ['blur', 'change'] },
	],
	phone: [{ pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }],
	gender: [{ required: true, message: '请选择性别', trigger: 'change' }],
	hobbies: [{ type: 'array', required: true, min: 1, message: '至少选择一个爱好', trigger: 'change' }],
	nickname: [{ max: 8, message: '昵称最多 8 个字', trigger: 'blur' }],
	/** 异步 validator：模拟请求接口校验昵称是否已被占用 */
	asyncName: [
		{ required: true, message: '请输入异步校验字段', trigger: 'blur' },
		{
			validator: (_rule: any, value: string, callback: any) => {
				if (!value) return callback()
				setTimeout(() => {
					if (value === 'admin') {
						callback(new Error('该名称已被占用（异步校验）'))
						return
					}
					callback()
				}, 600)
			},
			trigger: 'blur',
		},
	],
}

const formRef = ref<any>(null)

async function submitForm() {
	try {
		await formRef.value?.validate()
		uni.showToast({ title: t('form.submitSuccess'), icon: 'success' })
	} catch (e) {
		uni.showToast({ title: t('form.validateFail'), icon: 'none' })
	}
}

function resetForm() {
	formRef.value?.resetFields()
	uni.showToast({ title: '已重置', icon: 'none' })
}

function clearValidate() {
	formRef.value?.clearValidate()
	uni.showToast({ title: '已清除校验提示', icon: 'none' })
}

/** 单选 / 复选 */
const hobbyOptions = ['篮球', '足球', '游泳', '音乐', '摄影', '编程']

/** Picker 数据：单列 / 多列 / 级联 三种数据格式 */
const cityData = [
	{ label: '北京市', value: '北京' },
	{ label: '上海市', value: '上海' },
	{ label: '广州市', value: '广州' },
	{ label: '深圳市', value: '深圳' },
	{ label: '杭州市', value: '杭州' },
	{ label: '成都市', value: '成都' },
]

const sizeColorData = [
	[
		{ label: 'S', value: 'S' },
		{ label: 'M', value: 'M' },
		{ label: 'L', value: 'L' },
		{ label: 'XL', value: 'XL' },
	],
	[
		{ label: '红色', value: '红色' },
		{ label: '蓝色', value: '蓝色' },
		{ label: '绿色', value: '绿色' },
	],
]

const areaData = [
	{
		label: '广东省',
		value: '广东省',
		children: [
			{
				label: '深圳市',
				value: '深圳市',
				children: [
					{ label: '南山区', value: '南山区' },
					{ label: '福田区', value: '福田区' },
					{ label: '宝安区', value: '宝安区' },
				],
			},
			{
				label: '广州市',
				value: '广州市',
				children: [
					{ label: '天河区', value: '天河区' },
					{ label: '越秀区', value: '越秀区' },
				],
			},
		],
	},
	{
		label: '江苏省',
		value: '江苏省',
		children: [
			{
				label: '南京市',
				value: '南京市',
				children: [
					{ label: '玄武区', value: '玄武区' },
					{ label: '鼓楼区', value: '鼓楼区' },
				],
			},
			{
				label: '苏州市',
				value: '苏州市',
				children: [
					{ label: '工业园区', value: '工业园区' },
					{ label: '姑苏区', value: '姑苏区' },
				],
			},
		],
	},
]

const showPicker = ref(false)
const showMultiPicker = ref(false)
const showAreaPicker = ref(false)
const showDatePicker = ref(false)
const showRegionPicker = ref(false)
const showKeyboard = ref(false)
const keyboardValue = ref('')

/** DateTimePicker：7 种 mode 全部纳入同一实例切换 */
const dateModes = [
	{ label: '年', value: 'year' },
	{ label: '年月', value: 'yearmonth' },
	{ label: '日期', value: 'date' },
	{ label: '日期时间', value: 'datetime' },
	{ label: '时间', value: 'time' },
	{ label: '日期时间无秒', value: 'datetimeNoSecond' },
	{ label: '时间无秒', value: 'timeNoSecond' },
] as const
type DateMode = (typeof dateModes)[number]['value']
const dateMode = ref<DateMode>('date')
const dateFormat = computed(() => {
	const formats: Record<DateMode, string> = {
		year: 'YYYY',
		yearmonth: 'YYYY-MM',
		date: 'YYYY-MM-DD',
		datetime: 'YYYY-MM-DD HH:mm:ss',
		time: 'HH:mm:ss',
		datetimeNoSecond: 'YYYY-MM-DD HH:mm',
		timeNoSecond: 'HH:mm',
	}
	return formats[dateMode.value]
})

function selectDateMode(mode: DateMode) {
	dateMode.value = mode
	formModel.birthday = ''
	showDatePicker.value = true
}

/** Keyboard：number / digit / idcard / random / car 五种模式 */
const keyboardModes = ['number', 'digit', 'idcard', 'random', 'car'] as const
type KeyboardMode = (typeof keyboardModes)[number]
const keyboardMode = ref<KeyboardMode>('number')
const keyboardCarLang = ref<'cn' | 'en'>('cn')

function selectKeyboardMode(mode: KeyboardMode) {
	keyboardMode.value = mode
	keyboardValue.value = ''
	showKeyboard.value = true
}

/** 图片上传：自定义上传逻辑，避免依赖后端接口 */
function customUpload(file: any): Promise<string> {
	// 这里直接返回本地临时路径；真实项目里替换为 uni.uploadFile / 对象存储直传
	return new Promise((resolve) => {
		setTimeout(() => resolve(file.path || file.url || ''), 300)
	})
}

const searchValue = ref('')
function onSearch(value: string) {
	if (!value) return
	uni.showToast({ title: `搜索：${value}`, icon: 'none' })
}

function beforeSwitchChange() {
	return new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 300))
}

function onUploadSuccess(file: any) {
	console.log('上传成功', file)
}

function onUploadRemove(url: string) {
	console.log('移除', url)
}

const regionText = computed(() => formModel.regionNames.join(' / '))
</script>

<template>
	<view class="page" :style="theme.vars">
		<view class="page-header">
			<text class="page-header__title">表单组件</text>
			<text class="page-header__desc">
				TnForm 校验 + 全部输入类组件：Input / Checkbox / Radio / Switch / Slider / Rate / NumberBox / SearchBox / ImageUpload / Picker / DateTimePicker / RegionPicker / Keyboard
			</text>
		</view>

		<!-- 表单校验 -->
		<demo-block
			title="TnForm + TnFormItem 表单校验"
			desc="rules 采用 async-validator 规则；validate() / clearValidate() / resetFields() 通过 ref 调用；asyncName 演示 600ms 异步校验"
			code="const formRef = ref(); await formRef.value.validate(); formRef.value.clearValidate()"
		>
			<tn-form ref="formRef" :model="formModel" :rules="rules" label-width="180rpx" label-position="left">
				<tn-form-item :label="t('form.username')" prop="username" required>
					<tn-input v-model="formModel.username" placeholder="3-12 个字符" clearable />
				</tn-form-item>

				<tn-form-item label="密码" prop="password">
					<tn-input v-model="formModel.password" type="password" placeholder="输入密码可切换明文" />
				</tn-form-item>

				<tn-form-item :label="t('form.nickname')" prop="nickname">
					<tn-input v-model="formModel.nickname" placeholder="最多 8 个字" :maxlength="8" show-word-limit />
				</tn-form-item>

				<tn-form-item label="异步校验" prop="asyncName">
					<tn-input v-model="formModel.asyncName" placeholder="输入 admin 触发异步校验失败" clearable />
					<text class="form-tip">失焦后模拟接口校验，600ms 后返回结果</text>
				</tn-form-item>

				<tn-form-item :label="t('form.email')" prop="email">
					<tn-input v-model="formModel.email" placeholder="选填，但格式要正确">
						<template #prefix>
							<tn-icon name="email" :size="30" class="tn-gray_text" />
						</template>
					</tn-input>
				</tn-form-item>

				<tn-form-item :label="t('form.phone')" prop="phone">
					<tn-input v-model="formModel.phone" type="number" placeholder="11 位手机号" :maxlength="11" />
				</tn-form-item>

				<tn-form-item :label="t('form.gender')" prop="gender">
					<tn-radio-group v-model="formModel.gender">
						<tn-radio label="male">{{ t('form.male') }}</tn-radio>
						<tn-radio label="female">{{ t('form.female') }}</tn-radio>
					</tn-radio-group>
				</tn-form-item>

				<tn-form-item :label="t('form.hobbies')" prop="hobbies">
					<tn-checkbox-group v-model="formModel.hobbies" :max="3" wrap>
						<tn-checkbox v-for="item in hobbyOptions" :key="item" :label="item" border />
					</tn-checkbox-group>
				</tn-form-item>

				<tn-form-item :label="t('form.role')" prop="role">
					<tn-radio-group v-model="formModel.role">
						<tn-radio label="personal">个人开发者</tn-radio>
						<tn-radio label="company">企业用户</tn-radio>
					</tn-radio-group>
				</tn-form-item>

				<tn-form-item :label="t('form.remark')" prop="remark">
					<tn-input
						v-model="formModel.remark"
						type="textarea"
						placeholder="多行文本，自动增高"
						:maxlength="60"
						show-word-limit
					/>
				</tn-form-item>
			</tn-form>

			<view class="form-actions">
				<tn-button type="primary" width="100%" @click="submitForm">{{ t('common.submit') }}</tn-button>
				<tn-button plain width="100%" class="tn-mt-sm" @click="resetForm">{{ t('common.reset') }}</tn-button>
				<tn-button text width="100%" class="tn-mt-sm" @click="clearValidate">只清除校验提示（clearValidate）</tn-button>
			</view>
		</demo-block>

		<!-- 开关 / 滑块 / 评分 / 步进 -->
		<demo-block
			title="Switch / Slider / Rate / NumberBox"
			desc="开关支持文字与图标、切换前异步拦截；滑块数组值即区间；步进器支持长按连续点按"
			code="<tn-switch v-model=&quot;v&quot; active-text=&quot;开&quot; inactive-text=&quot;关&quot; />"
		>
			<view class="row-item">
				<text class="row-label">{{ t('form.notify') }}</text>
				<tn-switch v-model="formModel.notify" active-text="开" inactive-text="关" />
			</view>
			<view class="row-item">
				<text class="row-label">切换前拦截</text>
				<tn-switch :model-value="true" active-icon="check" inactive-icon="close" :before-change="beforeSwitchChange" />
			</view>
			<view class="row-item">
				<text class="row-label">{{ t('form.volume') }}：{{ formModel.volume }}</text>
				<view class="row-control">
					<tn-slider v-model="formModel.volume" :min="0" :max="100" active-color="tn-blue" />
				</view>
			</view>
			<view class="row-item">
				<text class="row-label">价格区间：{{ formModel.priceRange[0] }} - {{ formModel.priceRange[1] }}</text>
				<view class="row-control">
					<tn-slider v-model="formModel.priceRange" :min="0" :max="100" active-color="tn-purple" />
				</view>
			</view>
			<view class="row-item">
				<text class="row-label">{{ t('form.level') }}</text>
				<tn-rate v-model="formModel.level" allow-half />
			</view>
			<view class="row-item">
				<text class="row-label">数量步进器</text>
				<tn-number-box v-model="formModel.count" :min="1" :max="99" :step="1">
					<template #minus>
						<tn-icon name="reduce" :size="28" />
					</template>
					<template #plus>
						<tn-icon name="add" :size="28" />
					</template>
				</tn-number-box>
			</view>
			<view class="row-item">
				<text class="row-label">禁用状态</text>
				<tn-number-box :model-value="5" disabled />
			</view>
		</demo-block>

		<!-- 搜索框 -->
		<demo-block
			title="TnSearchBox 搜索框"
			desc="自带防抖与搜索按钮，方向、形状、对齐方式都可调"
			code="<tn-search-box v-model=&quot;k&quot; @search=&quot;onSearch&quot; />"
		>
			<tn-search-box v-model="formModel.keyword" placeholder="搜索组件、模板、图标" @search="onSearch" />
			<tn-search-box
				v-model="searchValue"
				shape="round"
				text-align="center"
				:search-button="false"
				class="section-gap"
				@search="onSearch"
			/>
			<tn-search-box :model-value="''" placeholder="禁用状态" disabled class="section-gap" />
		</demo-block>

		<!-- 图片上传 -->
		<demo-block
			title="TnImageUpload 图片上传"
			desc="limit / multiple / maxSize 限制，customUploadHandler 接管上传逻辑，支持插槽自定义按钮"
			code="<tn-image-upload v-model=&quot;urls&quot; :limit=&quot;4&quot; :custom-upload-handler=&quot;upload&quot; />"
		>
			<tn-image-upload
				v-model="formModel.images"
				:limit="4"
				:custom-upload-handler="customUpload"
				:max-size="5 * 1024 * 1024"
				@success="onUploadSuccess"
				@remove="onUploadRemove"
			>
				<template #addBtn>
					<view class="upload-btn">
						<tn-icon name="camera" :size="36" color="tn-grey" />
						<text class="upload-btn__text">上传（最多 4 张）</text>
					</view>
				</template>
			</tn-image-upload>
		</demo-block>

		<!-- 选择器 -->
		<demo-block
			title="TnPicker 选择器：单列 / 多列 / 级联"
			desc="data 结构决定模式：一维对象数组=单列，二维数组=多列，含 children=级联"
			code="<tn-picker v-model=&quot;v&quot; v-model:open=&quot;show&quot; :data=&quot;list&quot; />"
		>
			<view class="picker-row" @click="showPicker = true">
				<text class="row-label">城市（单列）</text>
				<view class="picker-value">
					<text :class="formModel.cityName ? '' : 'tn-gray_text'">{{ formModel.cityName || '请选择' }}</text>
					<tn-icon name="right" :size="22" color="tn-grey" />
				</view>
			</view>
			<view class="picker-row" @click="showMultiPicker = true">
				<text class="row-label">尺码 / 颜色（多列）</text>
				<view class="picker-value">
					<text :class="formModel.sizeColor.length ? '' : 'tn-gray_text'">
						{{ formModel.sizeColor.length ? formModel.sizeColor.join(' / ') : '请选择' }}
					</text>
					<tn-icon name="right" :size="22" color="tn-grey" />
				</view>
			</view>
			<view class="picker-row" @click="showAreaPicker = true">
				<text class="row-label">省市区（级联）</text>
				<view class="picker-value">
					<text :class="formModel.area.length ? '' : 'tn-gray_text'">
						{{ formModel.area.length ? formModel.area.join(' / ') : '请选择' }}
					</text>
					<tn-icon name="right" :size="22" color="tn-grey" />
				</view>
			</view>

			</demo-block>

		<!-- 日期 / 地区 -->
		<demo-block
			title="TnDateTimePicker / TnRegionPicker"
			desc="日期选择器 7 种 mode 全部可点选，format 跟随 mode 变化；地区选择器内置省市区数据，返回 code 或 name"
			code="<tn-date-time-picker v-model=&quot;v&quot; v-model:open=&quot;show&quot; :mode=&quot;mode&quot; :format=&quot;format&quot; />"
		>
			<view class="mode-row">
				<tn-button
					v-for="item in dateModes"
					:key="item.value"
					size="sm"
					:plain="dateMode !== item.value"
					:type="dateMode === item.value ? 'primary' : 'info'"
					@click="selectDateMode(item.value)"
				>
					{{ item.label }}
				</tn-button>
			</view>
			<view class="mode-current">当前 mode：{{ dateMode }} · format：{{ dateFormat }}</view>

			<view class="picker-row" @click="showDatePicker = true">
				<text class="row-label">{{ t('form.birthday') }}</text>
				<view class="picker-value">
					<text :class="formModel.birthday ? '' : 'tn-gray_text'">{{ formModel.birthday || '请选择日期' }}</text>
					<tn-icon name="right" :size="22" color="tn-grey" />
				</view>
			</view>
			<view class="picker-row" @click="showRegionPicker = true">
				<text class="row-label">{{ t('form.city') }}</text>
				<view class="picker-value">
					<text :class="regionText ? '' : 'tn-gray_text'">{{ regionText || '请选择地区' }}</text>
					<tn-icon name="right" :size="22" color="tn-grey" />
				</view>
			</view>

		</demo-block>

		<!-- 键盘 -->
		<demo-block
			title="TnKeyboard 自定义键盘"
			desc="number / digit / idcard / random / car 五种键盘全部可切换，支持长按删除与震动反馈"
			code="<tn-keyboard v-model=&quot;k&quot; v-model:show=&quot;show&quot; :mode=&quot;mode&quot; />"
		>
			<view class="mode-row">
				<tn-button
					v-for="item in keyboardModes"
					:key="item"
					size="sm"
					:plain="keyboardMode !== item"
					:type="keyboardMode === item ? 'primary' : 'info'"
					@click="selectKeyboardMode(item)"
				>
					{{ item }}
				</tn-button>
			</view>
			<view v-if="keyboardMode === 'car'" class="mode-row">
				<tn-button size="sm" :plain="keyboardCarLang !== 'cn'" @click="keyboardCarLang = 'cn'">车牌中文</tn-button>
				<tn-button size="sm" :plain="keyboardCarLang !== 'en'" @click="keyboardCarLang = 'en'">车牌英文</tn-button>
			</view>
			<view class="picker-row" @click="showKeyboard = true">
				<text class="row-label">{{ keyboardMode }} 键盘</text>
				<view class="picker-value">
					<text :class="keyboardValue ? '' : 'tn-gray_text'">{{ keyboardValue || '点击唤起键盘' }}</text>
					<tn-icon name="keyboard" :size="24" color="tn-grey" />
				</view>
			</view>

		</demo-block>

		<view class="tip">表单值实时同步：{{ JSON.stringify({ username: formModel.username, hobbies: formModel.hobbies, notify: formModel.notify }) }}</view>

		<!-- 选择器 / 键盘宿主统一放在页面根节点，避免被示例卡裁剪 -->
		<tn-picker id="city-picker" class="picker-host city-picker" v-model="formModel.cityName" v-model:open="showPicker" :data="cityData" />
		<tn-picker id="multi-picker" class="picker-host multi-picker" v-model="formModel.sizeColor" v-model:open="showMultiPicker" :data="sizeColorData" />
		<tn-picker id="area-picker" class="picker-host area-picker" v-model="formModel.area" v-model:open="showAreaPicker" :data="areaData" />
		<tn-date-time-picker
			id="date-picker"
			v-model="formModel.birthday"
			v-model:open="showDatePicker"
			:mode="dateMode"
			:format="dateFormat"
			min-time="1970/01/01 00:00:00"
			max-time="2030/12/31 23:59:59"
		/>
		<tn-region-picker id="region-picker" v-model="formModel.regionNames" v-model:open="showRegionPicker" />
		<tn-keyboard
			v-model="keyboardValue"
			v-model:show="showKeyboard"
			:mode="keyboardMode"
			:car-lang="keyboardCarLang"
			@close="showKeyboard = false"
		/>
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
	background: linear-gradient(135deg, rgba(137, 47, 232, 0.1), rgba(231, 47, 140, 0.1));
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
	color: var(--demo-muted);
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

.mode-current {
	font-size: 22rpx;
	color: var(--demo-faint);
	padding-bottom: 8rpx;
}

.form-tip {
	display: block;
	margin-top: 6rpx;
	font-size: 20rpx;
	color: var(--demo-faint);
}

.form-actions {
	margin-top: 28rpx;
}

.row-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 18rpx 0;
	border-bottom: 1rpx solid #f0f2f5;
}

.row-item:last-child {
	border-bottom: none;
}

.row-label {
	font-size: 26rpx;
	color: var(--demo-text);
	white-space: nowrap;
}

.row-control {
	flex: 1;
	margin-left: 40rpx;
}

.picker-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 22rpx 0;
	border-bottom: 1rpx solid #f0f2f5;
}

.picker-row:last-of-type {
	border-bottom: none;
}

.picker-value {
	display: flex;
	align-items: center;
	font-size: 26rpx;
	color: var(--demo-text);
}

.upload-btn {
	width: 150rpx;
	height: 150rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	background-color: var(--demo-soft);
	border-radius: 16rpx;
}

.upload-btn__text {
	margin-top: 8rpx;
	font-size: 20rpx;
	color: var(--demo-faint);
}

.tip {
	margin: 8rpx 32rpx 40rpx;
	font-size: 22rpx;
	color: var(--demo-faint);
	line-height: 1.6;
	word-break: break-all;
}
</style>

