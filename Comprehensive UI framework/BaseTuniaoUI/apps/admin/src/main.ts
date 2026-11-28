import { createSSRApp } from 'vue'
import App from './App.vue'

import { pinia } from './store'
import { i18n } from './locales'

// 基础控件全局注册，页面中直接使用 <app-button /> 即可，无需逐个 import
import AppIcon from './components/ui/AppIcon.vue'
import AppButton from './components/ui/AppButton.vue'
import AppTag from './components/ui/AppTag.vue'
import AppSwitch from './components/ui/AppSwitch.vue'
import AppInput from './components/ui/AppInput.vue'
import AppSelect from './components/ui/AppSelect.vue'
import AppDialog from './components/ui/AppDialog.vue'
import AppTable from './components/ui/AppTable.vue'
import AppEmpty from './components/ui/AppEmpty.vue'
import AppPagination from './components/ui/AppPagination.vue'
import AppCard from './components/ui/AppCard.vue'
import AppSegmented from './components/ui/AppSegmented.vue'
import AppField from './components/ui/AppField.vue'
import AppLayout from './components/layout/AppLayout.vue'

const components = {
  AppIcon,
  AppButton,
  AppTag,
  AppSwitch,
  AppInput,
  AppSelect,
  AppDialog,
  AppTable,
  AppEmpty,
  AppPagination,
  AppCard,
  AppSegmented,
  AppField,
  AppLayout,
}

export function createApp() {
  const app = createSSRApp(App)

  // Pinia 必须在挂载前注册
  app.use(pinia)

  // 多语言：语言包与持久化在 locales/index.ts
  app.use(i18n)

  // 框架内置控件
  Object.entries(components).forEach(([name, component]) => {
    app.component(name, component)
  })

  return {
    app,
  }
}
