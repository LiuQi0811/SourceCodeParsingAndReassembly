<script lang="ts" setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import {
  createDemoPage,
  DecoRenderer,
  validateDecoPage,
  type DecoBanner,
  type DecoComponent,
  type DecoGoods,
  type DecoNav,
  type DecoNotice,
  type DecoPage,
} from '@btn/deco'
import {
  decoApi,
  type DecoPageSummary,
  type DecoTemplateSummary,
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
import ImagePicker from '@/components/ui/ImagePicker.vue'

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
const saving = ref(false)
const publishing = ref(false)
const pages = ref<DecoPageSummary[]>([])
const currentId = ref('')
const creating = ref(false)
const removing = ref(false)
const copying = ref(false)
const templates = ref<DecoTemplateSummary[]>([])
const versions = ref<DecoVersionSummary[]>([])
const showTemplates = ref(false)
const showVersions = ref(false)
const templatesLoading = ref(false)
const versionsLoading = ref(false)
const savingTemplate = ref(false)
const usingTemplateId = ref('')
const removingTemplateId = ref('')
const rollingVersionId = ref('')

const currentPage = computed<DecoPageSummary | null>(
  () => pages.value.find((item) => item.id === currentId.value) ?? null
)

const pageOptions = computed(() =>
  pages.value.map((item) => ({
    label: item.isHome ? t('deco.pageHomeOption', { title: item.title }) : item.title,
    value: item.id,
  }))
)

const blankPage = (title: string): DecoPage => ({ version: 1, title, components: [] })

const applyDraft = (id: string, draftPage: DecoPage | null, fallbackTitle: string) => {
  currentId.value = id
  page.value = draftPage && validateDecoPage(draftPage).valid ? draftPage : blankPage(fallbackTitle)
  selectedId.value = page.value.components[0]?.id ?? ''
}

/** 重新拉列表，只同步状态，不改当前正在编辑的内容 */
const refreshPages = async () => {
  const result = await decoApi.pages()
  pages.value = result.pages
  const current = result.pages.find((item) => item.id === currentId.value)
  publishedAt.value = current?.publishedAt || ''
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

const banner = computed<DecoBanner | null>(() =>
  selected.value?.type === 'banner' ? selected.value : null
)
const notice = computed<DecoNotice | null>(() =>
  selected.value?.type === 'notice' ? selected.value : null
)
const nav = computed<DecoNav | null>(() => (selected.value?.type === 'nav' ? selected.value : null))
const goods = computed<DecoGoods | null>(() =>
  selected.value?.type === 'goods' ? selected.value : null
)

const typeLabel = (type: DecoComponent['type']): string =>
  t(`deco.add${type.charAt(0).toUpperCase()}${type.slice(1)}`)

const summary = (item: DecoComponent): string => {
  switch (item.type) {
    case 'banner':
      return `${item.items.length} slides`
    case 'notice':
      return item.text
    case 'nav':
      return `${item.items.length} × ${item.columns}`
    case 'goods':
      return `${item.items.length} products`
    default:
      return ''
  }
}

const select = (id: string) => {
  selectedId.value = id
}

const addBanner = () => {
  const item: DecoBanner = {
    id: uid('banner'),
    type: 'banner',
    height: 170,
    radius: 14,
    items: [{ id: uid('slide'), title: '新增轮播图' }],
  }
  page.value.components.push(item)
  selectedId.value = item.id
}

const addNotice = () => {
  const item: DecoNotice = {
    id: uid('notice'),
    type: 'notice',
    tag: t('deco.addNotice'),
    text: '在这里填写公告内容',
  }
  page.value.components.push(item)
  selectedId.value = item.id
}

const addNav = () => {
  const item: DecoNav = {
    id: uid('nav'),
    type: 'nav',
    columns: 4,
    items: [
      { id: uid('navitem'), text: '入口一' },
      { id: uid('navitem'), text: '入口二' },
    ],
  }
  page.value.components.push(item)
  selectedId.value = item.id
}

const addGoods = () => {
  const item: DecoGoods = {
    id: uid('goods'),
    type: 'goods',
    title: '商品推荐',
    columns: 2,
    items: [{ id: uid('good'), name: '新商品', price: 99 }],
  }
  page.value.components.push(item)
  selectedId.value = item.id
}

const move = (index: number, offset: number) => {
  const target = index + offset
  if (target < 0 || target >= page.value.components.length) return
  const list = page.value.components
  const [item] = list.splice(index, 1)
  list.splice(target, 0, item)
}

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
  try {
    await decoApi.saveDraft(currentId.value, JSON.parse(JSON.stringify(page.value)))
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
  try {
    const res = await decoApi.publish(currentId.value, JSON.parse(JSON.stringify(page.value)))
    publishedAt.value = res.publishedAt
    await refreshPages()
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
  await loadVersions()
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
    const result = await decoApi.pages()
    pages.value = result.pages
    const first = result.pages[0]
    if (first) await openPage(first.id)
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

    <view class="editor">
      <app-card class="panel panel-list" padding="14">
        <view class="panel-head">
          <text class="panel-title">{{ t('deco.componentList') }}</text>
          <text class="panel-tip">{{ t('deco.tip') }}</text>
        </view>

        <view class="add-row">
          <app-button size="sm" plain @click="addBanner">+ {{ t('deco.addBanner') }}</app-button>
          <app-button size="sm" plain @click="addNotice">+ {{ t('deco.addNotice') }}</app-button>
          <app-button size="sm" plain @click="addNav">+ {{ t('deco.addNav') }}</app-button>
          <app-button size="sm" plain @click="addGoods">+ {{ t('deco.addGoods') }}</app-button>
        </view>

        <app-empty v-if="page.components.length === 0" :text="t('deco.emptyList')" />

        <view class="comp-list">
          <view
            v-for="(item, index) in page.components"
            :key="item.id"
            class="comp-item"
            :class="{ 'is-active': item.id === selectedId }"
            @click="select(item.id)"
          >
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

          <template v-if="selected.type === 'banner' && banner">
            <view class="prop-item">
              <text class="prop-label">{{ t('deco.bannerHeight') }}</text>
              <app-input
                :model-value="String(banner.height ?? 170)"
                type="number"
                @update:model-value="banner.height = toNum($event)"
              />
            </view>
            <view class="prop-item">
              <text class="prop-label">{{ t('deco.bannerRadius') }}</text>
              <app-input
                :model-value="String(banner.radius ?? 14)"
                type="number"
                @update:model-value="banner.radius = toNum($event)"
              />
            </view>

            <text class="prop-label block">{{ t('deco.slides') }}</text>
            <view v-for="(slide, index) in banner.items" :key="slide.id" class="sub-block">
              <view class="sub-head">
                <text class="sub-title">{{ index + 1 }}</text>
                <app-button
                  type="text"
                  size="sm"
                  icon="delete"
                  @click="banner.items.splice(index, 1)"
                />
              </view>
              <app-input v-model="slide.title" :placeholder="t('deco.slideTitle')" />
              <text class="prop-label">{{ t('deco.slideImage') }}</text>
              <image-picker v-model="slide.image" />
            </view>
            <app-button
              size="sm"
              plain
              block
              @click="
                banner.items.push({
                  id: uid('slide'),
                  title: '新轮播图',
                })
              "
            >
              {{ t('deco.addSlide') }}
            </app-button>
          </template>

          <template v-if="selected.type === 'notice' && notice">
            <view class="prop-item">
              <text class="prop-label">{{ t('deco.noticeTag') }}</text>
              <app-input v-model="notice.tag" />
            </view>
            <view class="prop-item">
              <text class="prop-label">{{ t('deco.noticeText') }}</text>
              <app-input v-model="notice.text" textarea :min-height="70" />
            </view>
            <view class="prop-item">
              <text class="prop-label">{{ t('deco.noticeLink') }}</text>
              <app-input v-model="notice.link" />
            </view>
          </template>

          <template v-if="selected.type === 'nav' && nav">
            <view class="prop-item">
              <text class="prop-label">{{ t('deco.navColumns') }}</text>
              <app-input
                :model-value="String(nav.columns ?? 4)"
                type="number"
                @update:model-value="nav.columns = toNum($event)"
              />
            </view>

            <text class="prop-label block">{{ t('deco.navItems') }}</text>
            <view v-for="(entry, index) in nav.items" :key="entry.id" class="sub-block">
              <view class="sub-head">
                <text class="sub-title">{{ index + 1 }}</text>
                <app-button
                  type="text"
                  size="sm"
                  icon="delete"
                  @click="nav.items.splice(index, 1)"
                />
              </view>
              <app-input v-model="entry.text" :placeholder="t('deco.navText')" />
              <app-input v-model="entry.icon" :placeholder="t('deco.navIcon')" />
            </view>
            <app-button
              size="sm"
              plain
              block
              @click="nav.items.push({ id: uid('navitem'), text: '新入口' })"
            >
              {{ t('deco.addNav') }}
            </app-button>
          </template>

          <template v-if="selected.type === 'goods' && goods">
            <view class="prop-item">
              <text class="prop-label">{{ t('deco.goodsTitle') }}</text>
              <app-input v-model="goods.title" />
            </view>
            <view class="prop-item">
              <text class="prop-label">{{ t('deco.goodsColumns') }}</text>
              <app-input
                :model-value="String(goods.columns ?? 2)"
                type="number"
                @update:model-value="goods.columns = toNum($event)"
              />
            </view>

            <text class="prop-label block">{{ t('deco.goodsItems') }}</text>
            <view v-for="(product, index) in goods.items" :key="product.id" class="sub-block">
              <view class="sub-head">
                <text class="sub-title">{{ index + 1 }}</text>
                <app-button
                  type="text"
                  size="sm"
                  icon="delete"
                  @click="goods.items.splice(index, 1)"
                />
              </view>
              <app-input v-model="product.name" :placeholder="t('deco.goodsName')" />
              <text class="prop-label">{{ t('deco.goodsCover') }}</text>
              <image-picker v-model="product.cover" />
              <app-input
                :model-value="String(product.price)"
                type="number"
                :placeholder="t('deco.goodsPrice')"
                @update:model-value="product.price = toNum($event)"
              />
              <app-input v-model="product.tag" :placeholder="t('deco.goodsTag')" />
            </view>
            <app-button
              size="sm"
              plain
              block
              @click="goods.items.push({ id: uid('good'), name: '新商品', price: 99 })"
            >
              {{ t('deco.addGoods') }}
            </app-button>
          </template>
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
  </app-layout>
</template>

<style lang="scss" scoped>
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
