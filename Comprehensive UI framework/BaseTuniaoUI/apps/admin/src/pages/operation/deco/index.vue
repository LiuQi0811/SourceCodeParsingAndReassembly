<script lang="ts" setup>
import { computed, onUnmounted, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import {
  createDemoPage,
  createDecoComponent,
  DECO_COMPONENT_REGISTRY,
  DecoRenderer,
  getDecoComponentDefinition,
  validateDecoPage,
  type DecoComponent,
  type DecoComponentType,
  type DecoPage,
} from '@btn/deco'
import {
  decoApi,
  type DecoAccountSummary,
  type DecoAuditAction,
  type DecoAuditRecord,
  type DecoPageSummary,
  type DecoTemplateSummary,
  type DecoTenantSummary,
  type DecoVersionSummary,
} from '@/api/deco'
import { useUserStore } from '@/store/modules/user'
import AppLayout from '@/components/layout/AppLayout.vue'
import AppCard from '@/components/ui/AppCard.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppTag from '@/components/ui/AppTag.vue'
import AppEmpty from '@/components/ui/AppEmpty.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import DecoPropsPanel from '@/components/deco/DecoPropsPanel.vue'
import { getDecoTenantId, setDecoTenantId } from '@/utils/decoTenant'
import {
  insertIndexToMoveIndex,
  moveItem,
  resolveInsertIndex,
  type DragRect,
} from '@/utils/decoDrag'

const { t } = useI18n()
const user = useUserStore()

const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

const toNum = (value: string): number => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const page = ref<DecoPage>(createDemoPage())
const selectedId = ref(page.value.components[0]?.id ?? '')
const publishedAt = ref<string>('')
const tenants = ref<DecoTenantSummary[]>([])
const defaultTenantId = ref('')
const canManageTenants = ref(true)
const accounts = ref<DecoAccountSummary[]>([])
const tenantMembers = ref<string[]>([])
const tenantId = ref(getDecoTenantId())
const tenantDialogVisible = ref(false)
const tenantEditingId = ref('')
const tenantName = ref('')
const tenantAppId = ref('')
const tenantCode = ref('')
const tenantSaving = ref(false)
const saving = ref(false)
const publishing = ref(false)
const workspaceLoading = ref(false)
const pages = ref<DecoPageSummary[]>([])
const currentId = ref('')
const creating = ref(false)
const removing = ref(false)
const copying = ref(false)
const templates = ref<DecoTemplateSummary[]>([])
const versions = ref<DecoVersionSummary[]>([])
const auditRecords = ref<DecoAuditRecord[]>([])
const showTemplates = ref(false)
const showVersions = ref(false)
const showAudit = ref(false)
const templatesLoading = ref(false)
const versionsLoading = ref(false)
const auditLoading = ref(false)
const savingTemplate = ref(false)
const usingTemplateId = ref('')
const removingTemplateId = ref('')
const rollingVersionId = ref('')
const dragIndex = ref(-1)
const dragInsertIndex = ref(-1)
let originalUserSelect = ''
let originalCursor = ''

const currentPage = computed<DecoPageSummary | null>(
  () => pages.value.find((item) => item.id === currentId.value) ?? null
)

const currentTenant = computed<DecoTenantSummary | null>(
  () => tenants.value.find((item) => item.id === tenantId.value) ?? null
)

const tenantOptions = computed(() =>
  tenants.value.map((item) => ({
    label: item.name,
    value: item.id,
  }))
)

const accountOptions = computed(() =>
  accounts.value.map((item) => ({
    label: item.username,
    value: item.username,
  }))
)

const auditActionLabel = (action: DecoAuditAction): string => {
  const labels: Record<DecoAuditAction, string> = {
    publish: t('deco.auditPublish'),
    rollback: t('deco.auditRollback'),
    'page-create': t('deco.auditPageCreate'),
    'page-copy': t('deco.auditPageCopy'),
    'page-delete': t('deco.auditPageDelete'),
    'template-use': t('deco.auditTemplateUse'),
  }
  return labels[action] || action
}

const pageOptions = computed(() =>
  pages.value.map((item) => ({
    label: item.isHome ? t('deco.pageHomeOption', { title: item.title }) : item.title,
    value: item.id,
  }))
)

const blankPage = (title: string): DecoPage => ({ version: 1, title, components: [] })
const pageSnapshot = (value: DecoPage) => JSON.stringify(value)
/** 已保存（或刚载入）的页面快照，用于切换应用前判断是否有未保存草稿 */
const savedPageSnapshot = ref('')
const hasUnsavedDraft = computed(
  () => Boolean(currentId.value) && pageSnapshot(page.value) !== savedPageSnapshot.value
)

const applyDraft = (id: string, draftPage: DecoPage | null, fallbackTitle: string) => {
  currentId.value = id
  page.value = draftPage && validateDecoPage(draftPage).valid ? draftPage : blankPage(fallbackTitle)
  savedPageSnapshot.value = pageSnapshot(page.value)
  selectedId.value = page.value.components[0]?.id ?? ''
}

/** 重新拉列表，只同步状态，不改当前正在编辑的内容 */
const refreshPages = async () => {
  const result = await decoApi.pages()
  pages.value = result.pages
  const current = result.pages.find((item) => item.id === currentId.value)
  publishedAt.value = current?.publishedAt || ''
}

const loadTenants = async () => {
  const result = await decoApi.tenants()
  tenants.value = result.tenants
  defaultTenantId.value = result.defaultTenantId
  canManageTenants.value = result.canManage
  if (!result.tenants.length) {
    tenantId.value = ''
    return
  }
  const stored = getDecoTenantId()
  const fallback =
    result.tenants.find((item) => item.id === result.defaultTenantId)?.id ||
    result.tenants[0]?.id ||
    ''
  tenantId.value = result.tenants.some((item) => item.id === stored) ? stored : fallback
  if (tenantId.value) setDecoTenantId(tenantId.value)
}

/** 应用成员账号列表由超级管理员接口提供；编辑账号看不到，也不显示成员设置 */
const loadAccounts = async () => {
  if (!canManageTenants.value) {
    accounts.value = []
    return
  }
  try {
    const result = await decoApi.accounts()
    accounts.value = result.accounts
  } catch (error) {
    accounts.value = []
  }
}

/** 切换应用后清空当前编辑状态，重新读该应用自己的页面和模板 */
const reloadWorkspace = async () => {
  workspaceLoading.value = true
  pages.value = []
  currentId.value = ''
  publishedAt.value = ''
  templates.value = []
  versions.value = []
  auditRecords.value = []
  showTemplates.value = false
  showVersions.value = false
  showAudit.value = false
  page.value = blankPage(t('deco.untitledPage'))
  savedPageSnapshot.value = pageSnapshot(page.value)
  selectedId.value = ''
  try {
    if (!tenantId.value) return
    const result = await decoApi.pages()
    pages.value = result.pages
    const first = result.pages[0]
    if (first) await openPage(first.id)
  } finally {
    workspaceLoading.value = false
  }
}

const confirmDiscardDraft = () =>
  new Promise<boolean>((resolve) => {
    uni.showModal({
      title: t('deco.tenantDiscardTitle'),
      content: t('deco.tenantDiscardContent'),
      confirmText: t('deco.tenantDiscardConfirm'),
      cancelText: t('common.cancel'),
      confirmColor: '#f0a020',
      success: (res) => resolve(Boolean(res.confirm)),
      fail: () => resolve(false),
    })
  })

const switchTenant = async (value: string | number | (string | number)[]) => {
  const id = String(Array.isArray(value) ? (value[0] ?? '') : value)
  if (!id || id === tenantId.value) return
  if (hasUnsavedDraft.value && !(await confirmDiscardDraft())) return
  tenantId.value = id
  setDecoTenantId(id)
  try {
    await reloadWorkspace()
    const name = currentTenant.value?.name || id
    uni.showToast({ title: t('deco.tenantSwitched', { name }), icon: 'none' })
  } catch (error) {
    // request 层已提示错误
  }
}

const openTenantDialog = (mode: 'create' | 'edit') => {
  tenantEditingId.value = mode === 'edit' ? tenantId.value : ''
  tenantName.value = mode === 'edit' ? currentTenant.value?.name || '' : ''
  tenantAppId.value = mode === 'edit' ? currentTenant.value?.appId || '' : ''
  tenantMembers.value = mode === 'edit' ? [...(currentTenant.value?.members || [])] : []
  tenantCode.value = ''
  tenantDialogVisible.value = true
}

const saveTenant = async () => {
  if (tenantSaving.value) return
  const name = tenantName.value.trim()
  const appId = tenantAppId.value.trim()
  if (!name) {
    uni.showToast({ title: t('deco.tenantNameRequired'), icon: 'none' })
    return
  }
  if (!/^wx[a-z0-9]{16}$/.test(appId)) {
    uni.showToast({ title: t('deco.tenantAppIdInvalid'), icon: 'none' })
    return
  }

  tenantSaving.value = true
  try {
    if (tenantEditingId.value) {
      await decoApi.updateTenant(tenantEditingId.value, {
        name,
        appId,
        members: tenantMembers.value,
      })
      await loadTenants()
      uni.showToast({ title: t('deco.tenantUpdated'), icon: 'success' })
    } else {
      const created = await decoApi.createTenant({
        name,
        appId,
        members: tenantMembers.value,
        ...(tenantCode.value.trim() ? { id: tenantCode.value.trim() } : {}),
      })
      await loadTenants()
      tenantId.value = created.id
      setDecoTenantId(created.id)
      await reloadWorkspace()
      uni.showToast({ title: t('deco.tenantCreated'), icon: 'success' })
    }
    tenantDialogVisible.value = false
  } catch (error) {
    // request 层已提示错误
  } finally {
    tenantSaving.value = false
  }
}

const removeTenant = () => {
  const target = tenants.value.find((item) => item.id === tenantEditingId.value)
  if (!target || tenantSaving.value) return
  if (target.id === defaultTenantId.value) {
    uni.showToast({ title: t('deco.tenantDefaultCannotDelete'), icon: 'none' })
    return
  }
  uni.showModal({
    title: t('deco.tenantDeleteTitle'),
    content: t('deco.tenantDeleteConfirm', { name: target.name }),
    confirmText: t('deco.tenantDelete'),
    cancelText: t('common.cancel'),
    confirmColor: '#f5455c',
    success: async (res) => {
      if (!res.confirm) return
      tenantSaving.value = true
      try {
        await decoApi.removeTenant(target.id)
        await loadTenants()
        await reloadWorkspace()
        tenantDialogVisible.value = false
        uni.showToast({ title: t('deco.tenantDeleted'), icon: 'success' })
      } catch (error) {
        // request 层已提示错误
      } finally {
        tenantSaving.value = false
      }
    },
  })
}

const openPage = async (id: string) => {
  const target = pages.value.find((item) => item.id === id)
  publishedAt.value = target?.publishedAt || ''
  const draft = await decoApi.draft(id)
  applyDraft(id, draft.page, target?.title || t('deco.untitledPage'))
}

const selected = computed<DecoComponent | null>(
  () => page.value.components.find((item) => item.id === selectedId.value) ?? null
)

const typeLabel = (type: DecoComponent['type']): string => {
  const definition = getDecoComponentDefinition(type)
  return definition ? t(definition.labelKey) : type
}

const summary = (item: DecoComponent): string => {
  const definition = getDecoComponentDefinition(item.type)
  return definition ? definition.summary(item, (key, params) => String(t(key, params ?? {}))) : ''
}

const addComponent = (type: DecoComponentType) => {
  const item = createDecoComponent(type, {
    id: uid,
    t: (key) => String(t(key)),
  })
  if (!item) return
  page.value.components.push(item)
  selectedId.value = item.id
}

const select = (id: string) => {
  selectedId.value = id
}

const move = (index: number, offset: number) => {
  const target = index + offset
  if (target < 0 || target >= page.value.components.length) return
  const list = page.value.components
  const [item] = list.splice(index, 1)
  list.splice(target, 0, item)
}

/** 拖拽排序：只绑定 H5 的鼠标 / 触摸事件，小程序端仍用上移、下移 */
const readDragRects = (): DragRect[] => {
  if (typeof document === 'undefined') return []
  const list = document.querySelector('.comp-list')
  if (!list) return []
  return Array.from(list.querySelectorAll('.comp-item')).map((element) => {
    const rect = element.getBoundingClientRect()
    return { top: rect.top, height: rect.height }
  })
}

const eventClientY = (event: Event): number | null => {
  if ('touches' in event) {
    const touchEvent = event as TouchEvent
    const touch = touchEvent.touches[0] ?? touchEvent.changedTouches[0]
    return touch ? touch.clientY : null
  }
  const mouseEvent = event as MouseEvent
  return typeof mouseEvent.clientY === 'number' ? mouseEvent.clientY : null
}

const stopDrag = () => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('mousemove', onDragMove)
    document.removeEventListener('mouseup', onDragEnd)
    document.removeEventListener('touchmove', onDragMove)
    document.removeEventListener('touchend', onDragEnd)
    document.removeEventListener('touchcancel', onDragEnd)
    document.body.style.userSelect = originalUserSelect
    document.body.style.cursor = originalCursor
  }
  dragIndex.value = -1
  dragInsertIndex.value = -1
}

const onDragEnd = () => {
  const from = dragIndex.value
  const insertIndex = dragInsertIndex.value
  stopDrag()
  if (from < 0 || insertIndex < 0) return
  const target = insertIndexToMoveIndex(from, insertIndex)
  if (target === from) return
  page.value.components = moveItem(page.value.components, from, target)
}

const onDragMove = (event: Event) => {
  if (dragIndex.value < 0) return
  const pointerY = eventClientY(event)
  if (pointerY === null) return
  event.preventDefault()
  dragInsertIndex.value = resolveInsertIndex(pointerY, readDragRects())
}

const startDrag = (index: number, event: Event) => {
  if ('button' in event && (event as MouseEvent).button !== 0) return
  if (eventClientY(event) === null || typeof document === 'undefined') return
  dragIndex.value = index
  dragInsertIndex.value = index
  selectedId.value = page.value.components[index]?.id ?? selectedId.value
  originalUserSelect = document.body.style.userSelect
  originalCursor = document.body.style.cursor
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'grabbing'
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
  document.addEventListener('touchmove', onDragMove, { passive: false })
  document.addEventListener('touchend', onDragEnd)
  document.addEventListener('touchcancel', onDragEnd)
}

onUnmounted(stopDrag)

const askRemove = (id: string) => {
  uni.showModal({
    title: t('deco.removeTitle'),
    content: t('deco.removeConfirm'),
    cancelText: t('common.cancel'),
    confirmColor: '#f5455c',
    success: (res) => {
      if (!res.confirm) return
      const index = page.value.components.findIndex((item) => item.id === id)
      if (index < 0) return
      page.value.components.splice(index, 1)
      if (selectedId.value === id) {
        selectedId.value = page.value.components[0]?.id ?? ''
      }
    },
  })
}

const resetDemo = () => {
  page.value = createDemoPage()
  selectedId.value = page.value.components[0]?.id ?? ''
  uni.showToast({ title: t('deco.resetDemo'), icon: 'none' })
}

const saveDraft = async () => {
  if (saving.value || !currentId.value) return
  saving.value = true
  const payload = JSON.parse(JSON.stringify(page.value)) as DecoPage
  try {
    await decoApi.saveDraft(currentId.value, payload)
    savedPageSnapshot.value = pageSnapshot(payload)
    await refreshPages()
    uni.showToast({ title: t('deco.draftSaved'), icon: 'success' })
  } catch (error) {
    // request 层已提示错误，这里不再重复 toast
  } finally {
    saving.value = false
  }
}

const publish = async () => {
  if (publishing.value || !currentId.value) return
  const result = validateDecoPage(page.value)
  if (!result.valid) {
    uni.showToast({ title: t('deco.invalid', { message: result.message }), icon: 'none' })
    return
  }
  publishing.value = true
  const payload = JSON.parse(JSON.stringify(page.value)) as DecoPage
  try {
    const res = await decoApi.publish(currentId.value, payload)
    publishedAt.value = res.publishedAt
    savedPageSnapshot.value = pageSnapshot(payload)
    await refreshPages()
    if (showAudit.value) await loadAudit()
    uni.showToast({ title: t('deco.published'), icon: 'success' })
  } catch (error) {
    // request 层已提示错误
  } finally {
    publishing.value = false
  }
}

const switchPage = async (value: string | number | (string | number)[]) => {
  const picked = Array.isArray(value) ? value[0] : value
  const id = picked === undefined ? '' : String(picked)
  if (!id || id === currentId.value) return
  showTemplates.value = false
  showVersions.value = false
  showAudit.value = false
  try {
    await openPage(id)
  } catch (error) {
    uni.showToast({ title: t('deco.pageLoadFailed'), icon: 'none' })
  }
}

const createPage = async () => {
  if (creating.value) return
  creating.value = true
  try {
    const created = await decoApi.createPage(t('deco.newPageTitle', { n: pages.value.length + 1 }))
    await refreshPages()
    await openPage(created.id)
    uni.showToast({ title: t('deco.pageCreated'), icon: 'success' })
  } catch (error) {
    // request 层已提示错误
  } finally {
    creating.value = false
  }
}

const askRemovePage = () => {
  const target = currentPage.value
  if (!target || removing.value) return
  if (target.isHome) {
    uni.showToast({ title: t('deco.homeUndeletable'), icon: 'none' })
    return
  }
  uni.showModal({
    title: t('deco.pageRemoveTitle'),
    content: t('deco.pageRemoveConfirm', { title: target.title }),
    cancelText: t('common.cancel'),
    confirmText: t('common.confirm'),
    confirmColor: '#f5455c',
    success: async (res) => {
      if (!res.confirm) return
      removing.value = true
      try {
        await decoApi.removePage(target.id)
        await refreshPages()
        const fallback = pages.value[0]
        if (fallback) await openPage(fallback.id)
        uni.showToast({ title: t('deco.pageRemoved'), icon: 'success' })
      } catch (error) {
        // request 层已提示错误
      } finally {
        removing.value = false
      }
    },
  })
}

const copyCurrent = async () => {
  if (!currentPage.value || copying.value) return
  copying.value = true
  try {
    const baseTitle = page.value.title || currentPage.value.title
    const created = await decoApi.copyPage(
      currentPage.value.id,
      `${baseTitle} ${t('deco.copySuffix')}`.trim()
    )
    await refreshPages()
    await openPage(created.id)
    uni.showToast({ title: t('deco.pageCopied'), icon: 'success' })
  } catch (error) {
    // request 层已提示错误
  } finally {
    copying.value = false
  }
}

const loadTemplates = async () => {
  templatesLoading.value = true
  try {
    templates.value = (await decoApi.templates()).templates
  } catch (error) {
    // request 层已提示错误
  } finally {
    templatesLoading.value = false
  }
}

const toggleTemplates = async () => {
  showTemplates.value = !showTemplates.value
  if (!showTemplates.value) return
  showVersions.value = false
  showAudit.value = false
  await loadTemplates()
}

const saveAsTemplate = async () => {
  const target = currentPage.value
  if (!target || savingTemplate.value) return
  savingTemplate.value = true
  try {
    const name = `${page.value.title || target.title} ${t('deco.templateSuffix')}`.trim()
    await decoApi.saveTemplate(name, JSON.parse(JSON.stringify(page.value)))
    await loadTemplates()
    showTemplates.value = true
    showVersions.value = false
    showAudit.value = false
    uni.showToast({ title: t('deco.templateSaved'), icon: 'success' })
  } catch (error) {
    // request 层已提示错误
  } finally {
    savingTemplate.value = false
  }
}

const useTemplate = async (template: DecoTemplateSummary) => {
  if (usingTemplateId.value) return
  usingTemplateId.value = template.id
  try {
    const created = await decoApi.useTemplate(
      template.id,
      `${template.name} ${t('deco.copySuffix')}`.trim()
    )
    await refreshPages()
    await openPage(created.id)
    showTemplates.value = false
    uni.showToast({ title: t('deco.templateUsed'), icon: 'success' })
  } catch (error) {
    // request 层已提示错误
  } finally {
    usingTemplateId.value = ''
  }
}

const askRemoveTemplate = (template: DecoTemplateSummary) => {
  if (removingTemplateId.value) return
  uni.showModal({
    title: t('deco.templateRemoveTitle'),
    content: t('deco.templateRemoveConfirm', { name: template.name }),
    cancelText: t('common.cancel'),
    confirmText: t('common.confirm'),
    confirmColor: '#f5455c',
    success: async (res) => {
      if (!res.confirm) return
      removingTemplateId.value = template.id
      try {
        await decoApi.removeTemplate(template.id)
        await loadTemplates()
        uni.showToast({ title: t('deco.templateRemoved'), icon: 'success' })
      } catch (error) {
        // request 层已提示错误
      } finally {
        removingTemplateId.value = ''
      }
    },
  })
}

const loadVersions = async () => {
  if (!currentId.value) return
  versionsLoading.value = true
  try {
    versions.value = (await decoApi.versions(currentId.value)).versions
  } catch (error) {
    // request 层已提示错误
  } finally {
    versionsLoading.value = false
  }
}

const toggleVersions = async () => {
  showVersions.value = !showVersions.value
  if (!showVersions.value) return
  showTemplates.value = false
  showAudit.value = false
  await loadVersions()
}

const loadAudit = async () => {
  if (!tenantId.value) return
  auditLoading.value = true
  try {
    auditRecords.value = (await decoApi.audit()).records
  } catch (error) {
    // request 层已提示错误
  } finally {
    auditLoading.value = false
  }
}

const toggleAudit = async () => {
  showAudit.value = !showAudit.value
  if (!showAudit.value) return
  showTemplates.value = false
  showVersions.value = false
  await loadAudit()
}

const askRollback = (version: DecoVersionSummary) => {
  const target = currentPage.value
  if (!target || rollingVersionId.value) return
  uni.showModal({
    title: t('deco.rollbackTitle'),
    content: t('deco.rollbackConfirm', { time: version.publishedAt }),
    cancelText: t('common.cancel'),
    confirmText: t('common.confirm'),
    success: async (res) => {
      if (!res.confirm) return
      rollingVersionId.value = version.id
      try {
        await decoApi.rollback(target.id, version.id)
        await refreshPages()
        await openPage(target.id)
        await loadVersions()
        if (showAudit.value) await loadAudit()
        uni.showToast({ title: t('deco.rollbackDone'), icon: 'success' })
      } catch (error) {
        // request 层已提示错误
      } finally {
        rollingVersionId.value = ''
      }
    },
  })
}

const onPreviewJump = (link?: string) => {
  if (!link) return
  uni.showToast({ title: link, icon: 'none' })
}

const primaryOptions = computed(() => [
  { label: t('deco.colorSky'), value: '#01beff' },
  { label: t('deco.colorGreen'), value: '#00b96b' },
  { label: t('deco.colorViolet'), value: '#7a5af8' },
  { label: t('deco.colorOrange'), value: '#ff7a45' },
])

onLoad(async () => {
  try {
    await loadTenants()
    // 账号列表只服务编辑弹窗，不阻塞首屏工作区加载
    void loadAccounts()
  } catch (error) {
    // 应用列表失败时仍允许继续用默认应用
  }
  try {
    await reloadWorkspace()
  } catch (error) {
    // 接口失败时保留本地示例，页面仍可编辑（但保存/发布不可用）
  }
})
</script>

<template>
  <app-layout
    :title="t('deco.title')"
    :breadcrumb="[t('deco.catalog'), t('deco.title')]"
    :subtitle="t('deco.subtitle')"
  >
    <template #actions>
      <app-button type="default" @click="resetDemo">{{ t('deco.resetDemo') }}</app-button>
      <app-button
        v-if="user.hasPerm('operation:deco:save')"
        type="default"
        :loading="saving"
        :disabled="!currentId"
        @click="saveDraft"
      >
        {{ t('deco.saveDraft') }}
      </app-button>
      <app-button
        v-if="user.hasPerm('operation:deco:publish')"
        :loading="publishing"
        :disabled="!currentId"
        @click="publish"
      >
        {{ t('deco.publish') }}
      </app-button>
    </template>

    <view v-if="workspaceLoading" class="workspace-mask">
      <view class="workspace-loading">
        <text>{{ t('common.loading') }}</text>
      </view>
    </view>

    <app-card padding="14" class="tenant-bar">
      <view class="tenant-row">
        <text class="prop-label">{{ t('deco.tenantLabel') }}</text>
        <app-select
          :model-value="tenantId"
          :options="tenantOptions"
          class="tenant-select"
          :placeholder="t('deco.tenantLabel')"
          @update:model-value="switchTenant"
        />
        <app-tag v-if="currentTenant?.appId" size="sm">{{ currentTenant.appId }}</app-tag>
        <view v-if="canManageTenants" class="tenant-actions">
          <app-button size="sm" plain @click="openTenantDialog('create')">
            + {{ t('deco.tenantAdd') }}
          </app-button>
          <app-button
            size="sm"
            type="text"
            :disabled="!currentTenant"
            @click="openTenantDialog('edit')"
          >
            {{ t('deco.tenantEdit') }}
          </app-button>
        </view>
      </view>
      <text v-if="tenantId" class="tenant-tip">{{ t('deco.tenantTip', { id: tenantId }) }}</text>
      <text v-else class="tenant-tip">{{ t('deco.tenantEmpty') }}</text>
      <text v-if="!canManageTenants" class="tenant-tip">
        {{ t('deco.tenantReadonlyTip') }}
      </text>
    </app-card>

    <app-card padding="14" class="page-bar">
      <view class="page-bar-row">
        <text class="prop-label">{{ t('deco.pageSelector') }}</text>
        <app-select
          :model-value="currentId"
          :options="pageOptions"
          class="page-select"
          :placeholder="t('deco.untitledPage')"
          @update:model-value="switchPage"
        />
        <app-button size="sm" plain :loading="creating" @click="createPage">
          + {{ t('deco.newPage') }}
        </app-button>
        <app-button
          v-if="currentPage && !currentPage.isHome"
          class="page-delete-btn"
          size="sm"
          type="text"
          icon="delete"
          :loading="removing"
          @click="askRemovePage"
        />
        <app-tag v-if="currentPage?.isHome" size="sm">{{ t('deco.homePage') }}</app-tag>
      </view>
      <view v-if="currentPage" class="page-bar-meta">
        <text class="page-path">{{ t('deco.pagePath') }}：{{ currentPage.path }}</text>
        <text v-if="currentPage.updatedAt" class="page-time">
          {{ t('deco.pageUpdatedAt', { time: currentPage.updatedAt }) }}
        </text>
      </view>
      <view class="page-bar-actions">
        <app-button
          size="sm"
          type="text"
          :loading="copying"
          :disabled="!currentId"
          @click="copyCurrent"
        >
          {{ t('deco.copyPage') }}
        </app-button>
        <app-button
          size="sm"
          type="text"
          :loading="savingTemplate"
          :disabled="!currentId"
          @click="saveAsTemplate"
        >
          {{ t('deco.saveAsTemplate') }}
        </app-button>
        <app-button size="sm" type="text" @click="toggleTemplates">
          {{ t('deco.templateLibrary') }}
        </app-button>
        <app-button size="sm" type="text" :disabled="!currentId" @click="toggleVersions">
          {{ t('deco.versionHistory') }}
        </app-button>
        <app-button size="sm" type="text" @click="toggleAudit">
          {{ t('deco.auditLog') }}
        </app-button>
      </view>
    </app-card>

    <app-card v-if="showTemplates" padding="14" class="aux-panel">
      <view class="aux-head">
        <text class="panel-title">{{ t('deco.templateLibrary') }}</text>
        <app-button size="sm" type="text" @click="showTemplates = false">
          {{ t('common.close') }}
        </app-button>
      </view>
      <app-empty v-if="!templates.length && !templatesLoading" :text="t('deco.templateEmpty')" />
      <view v-for="item in templates" :key="item.id" class="aux-row">
        <view class="aux-main">
          <text class="aux-title">{{ item.name }}</text>
          <text class="aux-sub">{{ t('deco.templateCreatedAt', { time: item.createdAt }) }}</text>
        </view>
        <app-button
          size="sm"
          plain
          :loading="usingTemplateId === item.id"
          @click="useTemplate(item)"
        >
          {{ t('deco.useTemplate') }}
        </app-button>
        <app-button
          size="sm"
          type="text"
          icon="delete"
          :loading="removingTemplateId === item.id"
          @click="askRemoveTemplate(item)"
        />
      </view>
    </app-card>

    <app-card v-if="showVersions" padding="14" class="aux-panel">
      <view class="aux-head">
        <text class="panel-title">{{ t('deco.versionHistory') }}</text>
        <app-button size="sm" type="text" @click="showVersions = false">
          {{ t('common.close') }}
        </app-button>
      </view>
      <app-empty v-if="!versions.length && !versionsLoading" :text="t('deco.versionEmpty')" />
      <view v-for="item in versions" :key="item.id" class="aux-row">
        <view class="aux-main">
          <text class="aux-title">{{ item.title }}</text>
          <text class="aux-sub">
            {{ t('deco.versionPublishedAt', { time: item.publishedAt }) }}
          </text>
        </view>
        <app-button
          size="sm"
          plain
          :loading="rollingVersionId === item.id"
          @click="askRollback(item)"
        >
          {{ t('deco.rollback') }}
        </app-button>
      </view>
    </app-card>

    <app-card v-if="showAudit" padding="14" class="aux-panel">
      <view class="aux-head">
        <text class="panel-title">{{ t('deco.auditLog') }}</text>
        <app-button size="sm" type="text" @click="showAudit = false">
          {{ t('common.close') }}
        </app-button>
      </view>
      <app-empty v-if="!auditRecords.length && !auditLoading" :text="t('deco.auditEmpty')" />
      <view v-for="item in auditRecords" :key="item.id" class="aux-row">
        <view class="aux-main">
          <text class="aux-title">
            {{ auditActionLabel(item.action) }}
            <text v-if="item.pageTitle">· {{ item.pageTitle }}</text>
          </text>
          <text class="aux-sub">
            {{ t('deco.auditBy', { actor: item.actor, time: item.at }) }}
          </text>
        </view>
      </view>
    </app-card>

    <view class="editor">
      <app-card class="panel panel-list" padding="14">
        <view class="panel-head">
          <text class="panel-title">{{ t('deco.componentList') }}</text>
          <text class="panel-tip">{{ t('deco.tip') }}</text>
        </view>

        <view class="add-row">
          <app-button
            v-for="item in DECO_COMPONENT_REGISTRY"
            :key="item.type"
            size="sm"
            plain
            @click="addComponent(item.type)"
          >
            + {{ t(item.labelKey) }}
          </app-button>
        </view>

        <app-empty v-if="page.components.length === 0" :text="t('deco.emptyList')" />

        <view class="comp-list">
          <template v-for="(item, index) in page.components" :key="item.id">
            <view
              v-if="dragIndex !== -1 && dragInsertIndex === index && dragInsertIndex !== dragIndex"
              class="drop-line"
            />
            <view
              class="comp-item"
              :class="{
                'is-active': item.id === selectedId,
                'is-dragging': dragIndex === index,
              }"
              @click="select(item.id)"
            >
              <view
                class="drag-handle"
                title="按住拖动排序"
                @mousedown.stop.prevent="startDrag(index, $event)"
                @touchstart.stop.prevent="startDrag(index, $event)"
              >
                <app-icon name="sort" :size="14" />
              </view>
              <view class="comp-main">
                <text class="comp-type">{{ typeLabel(item.type) }}</text>
                <text class="comp-sub">{{ summary(item) }}</text>
              </view>
              <view class="comp-ops">
                <app-button type="text" size="sm" :disabled="index === 0" @click="move(index, -1)">
                  上移
                </app-button>
                <app-button
                  type="text"
                  size="sm"
                  :disabled="index === page.components.length - 1"
                  @click="move(index, 1)"
                >
                  下移
                </app-button>
                <app-button type="text" size="sm" icon="delete" @click="askRemove(item.id)" />
              </view>
            </view>
          </template>
          <view
            v-if="dragIndex !== -1 && dragInsertIndex === page.components.length"
            class="drop-line"
          />
        </view>
      </app-card>

      <view class="preview-col">
        <app-card padding="14">
          <view class="preview-head">
            <text class="panel-title">{{ t('deco.preview') }}</text>
            <app-tag v-if="publishedAt" type="success" size="sm">
              {{ t('deco.publishedAt', { time: publishedAt }) }}
            </app-tag>
            <app-tag v-else type="warning" size="sm">{{ t('deco.unpublished') }}</app-tag>
          </view>

          <view class="phone">
            <view class="phone-bar">
              <text class="phone-title">{{ page.title }}</text>
            </view>
            <scroll-view scroll-y class="phone-body">
              <deco-renderer :page="page" @jump="onPreviewJump" />
            </scroll-view>
          </view>
          <text class="preview-tip">{{ t('deco.previewTip') }}</text>
        </app-card>
      </view>

      <app-card class="panel panel-props" padding="14">
        <text class="panel-title">{{ t('deco.settings') }}</text>

        <view v-if="!selected" class="select-tip">
          <text class="tip-text">{{ t('deco.selectTip') }}</text>
        </view>

        <view v-else class="prop-body">
          <view class="prop-item">
            <text class="prop-label">{{ t('deco.componentId') }}</text>
            <text class="prop-value">{{ selected.id }}</text>
          </view>

          <view class="prop-item">
            <text class="prop-label">{{ t('deco.gap') }}</text>
            <app-input
              :model-value="String(selected.gap ?? 12)"
              type="number"
              @update:model-value="selected.gap = toNum($event)"
            />
          </view>

          <deco-props-panel :component="selected" />
        </view>
      </app-card>
    </view>

    <app-card padding="14" class="meta-card">
      <view class="meta-row">
        <text class="prop-label">{{ t('deco.pageTitle') }}</text>
        <app-input v-model="page.title" class="meta-input" />
      </view>
      <view class="meta-row">
        <text class="prop-label">{{ t('deco.primaryColor') }}</text>
        <app-select v-model="page.primary" :options="primaryOptions" class="meta-input" />
      </view>
    </app-card>

    <app-dialog
      v-model:visible="tenantDialogVisible"
      :title="tenantEditingId ? t('deco.tenantDialogEdit') : t('deco.tenantDialogCreate')"
      :loading="tenantSaving"
      @confirm="saveTenant"
    >
      <view class="tenant-form">
        <view class="prop-item">
          <text class="prop-label">{{ t('deco.tenantName') }}</text>
          <app-input v-model="tenantName" :placeholder="t('deco.tenantNamePlaceholder')" />
        </view>
        <view class="prop-item">
          <text class="prop-label">{{ t('deco.tenantAppId') }}</text>
          <app-input v-model="tenantAppId" placeholder="wxabcdef1234567890" />
        </view>
        <view v-if="!tenantEditingId" class="prop-item">
          <text class="prop-label">{{ t('deco.tenantCode') }}</text>
          <app-input v-model="tenantCode" :placeholder="t('deco.tenantCodePlaceholder')" />
        </view>
        <view v-if="canManageTenants" class="prop-item">
          <text class="prop-label">{{ t('deco.tenantMembers') }}</text>
          <app-select
            v-model="tenantMembers"
            multiple
            :options="accountOptions"
            :placeholder="t('deco.tenantMemberPlaceholder')"
            :title="t('deco.tenantMembers')"
            class="tenant-member-select"
          />
          <text class="tenant-dialog-tip">{{ t('deco.tenantMembersTip') }}</text>
        </view>
        <text class="tenant-dialog-tip">
          {{ tenantEditingId ? t('deco.tenantEditTip') : t('deco.tenantCodeTip') }}
        </text>
        <view
          v-if="tenantEditingId && tenantEditingId !== defaultTenantId"
          class="tenant-delete-row"
        >
          <app-button type="danger" plain size="sm" :loading="tenantSaving" @click="removeTenant">
            {{ t('deco.tenantDelete') }}
          </app-button>
        </view>
      </view>
    </app-dialog>
  </app-layout>
</template>

<style lang="scss" scoped>
.workspace-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(245, 248, 252, 0.62);
  backdrop-filter: blur(1px);
}

.workspace-loading {
  padding: 10px 18px;
  font-size: 13px;
  color: var(--app-text-2);
  background: var(--app-card);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  box-shadow: var(--app-shadow);
}

.editor {
  display: grid;
  grid-template-columns: 300px minmax(340px, 1fr) 300px;
  gap: 14px;
  align-items: start;
  width: 100%;
  box-sizing: border-box;
}

.page-bar {
  margin-bottom: 14px;
}

.tenant-bar {
  margin-bottom: 14px;
}

.tenant-row {
  flex-direction: row;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.tenant-select {
  width: 220px;
}

.tenant-actions {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.tenant-tip {
  margin-top: 6px;
  font-size: 12px;
  color: var(--app-text-3);
}

.tenant-form {
  gap: 12px;
}

.tenant-member-select {
  width: 100%;
}

.tenant-dialog-tip {
  font-size: 12px;
  line-height: 1.6;
  color: var(--app-text-3);
}

.tenant-delete-row {
  flex-direction: row;
  padding-top: 4px;
}

.page-bar-row {
  flex-direction: row;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.page-select {
  width: 220px;
}

.page-bar-meta {
  flex-direction: row;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.page-path,
.page-time {
  font-size: 12px;
  color: var(--app-text-3);
}

.page-bar-actions {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed var(--app-border);
}

.aux-panel {
  margin-bottom: 14px;
}

.aux-head {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.aux-row {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px dashed var(--app-border);
}

.aux-main {
  flex: 1;
  gap: 2px;
  min-width: 0;
}

.aux-title {
  font-size: 13px;
  color: var(--app-text);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.aux-sub {
  font-size: 12px;
  color: var(--app-text-3);
}

@media (max-width: 1199px) {
  .editor {
    grid-template-columns: 1fr;
  }

  .panel-list,
  .panel-props {
    width: auto;
  }

  .preview-col {
    min-width: 0;
  }
}

.panel {
  min-width: 0;
}

.panel-list,
.panel-props {
  width: 100%;
}

.panel-head {
  gap: 8px;
  margin-bottom: 10px;
}

.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text);
}

.panel-tip {
  font-size: 12px;
  color: var(--app-text-3);
}

.add-row {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.comp-list {
  gap: 8px;
}

.comp-item {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg);
  cursor: pointer;
}

.comp-item.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-weak-2);
}

.comp-item.is-dragging {
  opacity: 0.55;
  border-style: dashed;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}

.drag-handle {
  flex: none;
  width: 22px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--app-text-3);
  cursor: grab;
  touch-action: none;
}

.drag-handle:hover {
  color: var(--app-primary);
  background: var(--app-primary-weak-2);
}

.drop-line {
  height: 2px;
  margin: 1px 8px;
  border-radius: 2px;
  background: var(--app-primary);
  box-shadow: 0 0 0 2px var(--app-primary-weak-2);
}

.comp-main {
  flex: 1;
  gap: 2px;
  overflow: hidden;
}

.comp-type {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text);
}

.comp-sub {
  font-size: 12px;
  color: var(--app-text-3);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.comp-ops {
  flex-direction: row;
  align-items: center;
  gap: 2px;
}

.preview-head {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.phone {
  width: 375px;
  max-width: 100%;
  margin: 0 auto;
  border: 1px solid var(--app-border);
  border-radius: 18px;
  overflow: hidden;
  background: var(--app-bg);
}

.phone-bar {
  height: 44px;
  align-items: center;
  justify-content: center;
  background: var(--app-card);
  border-bottom: 1px solid var(--app-border);
}

.phone-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text);
}

.phone-body {
  height: 560px;
  background: var(--app-bg);
}

.preview-tip {
  margin-top: 8px;
  font-size: 12px;
  color: var(--app-text-3);
  text-align: center;
}

.prop-body {
  gap: 10px;
  margin-top: 10px;
}

.prop-item {
  gap: 4px;
}

.prop-label {
  font-size: 12px;
  color: var(--app-text-3);
}

.prop-label.block {
  display: block;
  margin-top: 4px;
}

.prop-value {
  font-size: 12px;
  color: var(--app-text-2);
}

.sub-block {
  gap: 6px;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
}

.sub-head {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.sub-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text-2);
}

.select-tip {
  padding: 24px 0;
}

.tip-text {
  font-size: 12px;
  color: var(--app-text-3);
}

.meta-card {
  margin-top: 14px;
}

.meta-row {
  flex-direction: row;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.meta-input {
  width: 240px;
}
</style>
