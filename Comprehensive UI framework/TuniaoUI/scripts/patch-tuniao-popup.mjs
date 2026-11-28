/**
 * 给 TuniaoUI 的 TnPopup / TnOverlay 打小程序样式隔离补丁。
 *
 * 背景：微信小程序的组件样式隔离在部分基础库下会丢失组件 wxss 里的
 * `position: fixed`、内容区终态 `opacity / transform`，表现为：
 * 1. 弹层被当成普通文档流元素渲染在页面底部；
 * 2. 点开弹层后遮罩/面板看不见，像“点不动”；
 * 3. 隐藏态的 fixed 层仍可能挡住整页点击。
 *
 * 这里把 fixed / inset / display / visibility / pointer-events 以及内容区
 * 终态布局写成内联样式，内联样式不受样式隔离影响。
 * `npm install` 后由 postinstall 自动执行，脚本是幂等的。
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const popupPath = path.join(
	root,
	'node_modules/@tuniao/tnui-vue3-uniapp/components/popup/src/popup.vue'
)
const overlayPath = path.join(
	root,
	'node_modules/@tuniao/tnui-vue3-uniapp/components/overlay/src/composables/use-overlay.ts'
)
const pickerCssPath = path.join(
	root,
	'node_modules/@tuniao/tnui-vue3-uniapp/theme-chalk/src/picker.scss'
)
const pickerRuntimePath = path.join(
	root,
	'node_modules/@tuniao/tnui-vue3-uniapp/components/picker/src/composables/use-picker.ts'
)
const pickerTemplatePath = path.join(
	root,
	'node_modules/@tuniao/tnui-vue3-uniapp/components/picker/src/picker.vue'
)

const POPUP_CONTENT_STYLE = `/**
 * 小程序组件样式隔离偶发丢失 scoped wxss：只靠 .tn-popup__content 的
 * position / opacity / transform 时，弹层会“打开了但看不见”。
 * 这里把终态布局写成内联样式，打开时不再依赖组件样式表。
 */
const popupContentFallbackStyle = computed(() => {
  const style: Record<string, string | number> = {
    opacity: showPopup.value ? 1 : 0,
    visibility: showPopup.value ? 'visible' : 'hidden',
    transition: 'none',
    boxSizing: 'border-box',
  }
  if (!showPopup.value) return style

  const direction = props.openDirection || 'center'
  style.position = 'absolute'
  if (direction === 'center') {
    style.left = '50%'
    style.top = '50%'
    style.transform = 'translate(-50%, -50%) scale(1)'
  } else if (direction === 'bottom') {
    style.left = '0'
    style.bottom = '0'
    style.width = '100%'
    style.transform = 'scaleY(1)'
  } else if (direction === 'top') {
    style.left = '0'
    style.top = '0'
    style.width = '100%'
    style.transform = 'scaleY(1)'
  } else if (direction === 'left') {
    style.left = '0'
    style.top = '0'
    style.height = '100%'
    style.transform = 'scaleX(1)'
  } else if (direction === 'right') {
    style.right = '0'
    style.top = '0'
    style.height = '100%'
    style.transform = 'scaleX(1)'
  }
  return style
})
`

function patchPopupRoot(text) {
	if (text.includes('display: showPopup ?')) {
		if (!text.includes('pointerEvents: showPopup')) {
			text = text.replace(
				"display: showPopup ? 'block' : 'none',",
				`display: showPopup ? 'block' : 'none',
      overflow: 'hidden',
      visibility: showPopup ? 'visible' : 'hidden',
      pointerEvents: showPopup ? 'auto' : 'none',`
			)
		}
		return text
	}

	text = text.replace(
		/:style="\{\s*zIndex,?\s*\}"/,
		`:style="{
      zIndex,
      position: 'fixed',
      left: '0',
      top: '0',
      right: '0',
      bottom: '0',
      overflow: 'hidden',
      display: showPopup ? 'block' : 'none',
      visibility: showPopup ? 'visible' : 'hidden',
      pointerEvents: showPopup ? 'auto' : 'none',
    }"`
	)
	return text
}

function patchPopupContent(text) {
	if (text.includes('popupContentFallbackStyle')) return text

	text = text.replace(
		'<script lang="ts" setup>',
		'<script lang="ts" setup>\nimport { computed } from \'vue\''
	)
	text = text.replace(
		'const { ns, overlayZIndex, zIndex, popupContentClass, popupContentStyle } =\n  usePopupCustomStyle(props)',
		`const { ns, overlayZIndex, zIndex, popupContentClass, popupContentStyle } =
  usePopupCustomStyle(props)

${POPUP_CONTENT_STYLE}`
	)
	text = text.replace(
		':style="popupContentStyle"',
		':style="[popupContentStyle, popupContentFallbackStyle]"'
	)
	return text
}

function patchPopup() {
	if (!fs.existsSync(popupPath)) return
	let text = fs.readFileSync(popupPath, 'utf8')
	const before = text
	text = patchPopupRoot(text)
	text = patchPopupContent(text)
	if (text === before) {
		console.log('[patch] popup already patched')
		return
	}
	fs.writeFileSync(popupPath, text, 'utf8')
	console.log('[patch] popup fixed / visible fallback applied')
}

function patchOverlay() {
	if (!fs.existsSync(overlayPath)) return
	let text = fs.readFileSync(overlayPath, 'utf8')
	if (text.includes('style.display = props.show')) return console.log('[patch] overlay already patched')

	if (text.includes("style.position = 'fixed'")) {
		text = text.replace(
			/style\.bottom = '0'/,
			`style.bottom = '0'
    style.display = props.show ? 'block' : 'none'
    style.pointerEvents = props.show ? 'auto' : 'none'`
		)
	} else {
		text = text.replace(
			/if \(props\.zIndex\) style\.zIndex = props\.zIndex\n\n    return style/,
			`if (props.zIndex) style.zIndex = props.zIndex

    // 小程序里组件样式隔离偶发丢失 position: fixed，用内联样式兜底。
    style.position = 'fixed'
    style.left = '0'
    style.top = '0'
    style.right = '0'
    style.bottom = '0'
    style.display = props.show ? 'block' : 'none'
    style.pointerEvents = props.show ? 'auto' : 'none'

    return style`
		)
	}
	fs.writeFileSync(overlayPath, text, 'utf8')
	console.log('[patch] overlay fixed style applied')
}

function patchPickerCss() {
	if (!fs.existsSync(pickerCssPath)) return
	let text = fs.readFileSync(pickerCssPath, 'utf8')
	let changed = false

	if (!text.includes('height: 44px;')) {
		text = text.replace(
			/@include e\(content-item\) \{\n\s*display: flex;\n\s*align-items: center;\n\s*justify-content: center;/,
			`@include e(content-item) {
    display: flex;
    align-items: center;
    justify-content: center;
    /* 微信小程序不支持 fit-content，picker-view 内条目会塌缩成 0 高 */
    height: 44px;`
		)
		changed = true
	}

	if (!text.includes('@include e(picker-view-column)')) {
		text = text.replace(
			/  \/\* picker-view 样式 end \*\//,
			`  @include e(picker-view-column) {
    /* 微信小程序原生 picker-view-column 不给高度时会塌缩，高索引行会滚出可视区 */
    height: 100%;
  }
  /* picker-view 样式 end */`
		)
		changed = true
	}

	if (!changed) {
		console.log('[patch] picker css already patched')
		return
	}
	fs.writeFileSync(pickerCssPath, text, 'utf8')
	console.log('[patch] picker css fixed')
}

function patchPickerRuntime() {
	if (!fs.existsSync(pickerRuntimePath)) return
	let text = fs.readFileSync(pickerRuntimePath, 'utf8')
	if (text.includes('// #ifdef MP-WEIXIN')) {
		console.log('[patch] picker runtime already patched')
		return
	}
	text = text.replace(
		`      openPopup.value = value
      // #ifdef MP-ALIPAY`,
		`      openPopup.value = value
      // #ifdef MP-WEIXIN
      // 级联选择器的列是后生成的，原生 picker-view 不会为后到的列补渲染；
      // 打开时稍等一拍再重建 picker-view，确保列数据已经就位。
      if (value) {
        showPicker.value = false
        setTimeout(() => {
          showPicker.value = true
        }, 300)
      }
      // #endif
      // #ifdef MP-ALIPAY`
	)
	fs.writeFileSync(pickerRuntimePath, text, 'utf8')
	console.log('[patch] picker runtime remount applied')
}

function patchPickerTemplate() {
	if (!fs.existsSync(pickerTemplatePath)) return
	let text = fs.readFileSync(pickerTemplatePath, 'utf8')
	if (text.includes('props.indicatorHeight || 44}px` }')) {
		console.log('[patch] picker template already patched')
		return
	}
	text = text.replace(
		`              :class="ns.e('content-item')"
            >`,
		`              :class="ns.e('content-item')"
              :style="{ height: \`\${props.indicatorHeight || 44}px\` }"
            >`
	)
	fs.writeFileSync(pickerTemplatePath, text, 'utf8')
	console.log('[patch] picker item inline height applied')
}

patchPopup()
patchOverlay()
patchPickerCss()
patchPickerRuntime()
patchPickerTemplate()
