<script lang="ts" setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { menuApi } from '@/api/menu'
import type { MenuItem, MenuType, StatusValue } from '@/api/types'
import type { TableColumn } from '@/components/ui/types'
import { useUserStore } from '@/store/modules/user'
import { isRegisteredPage } from '@/config/routes'
import { useCrudForm } from '@/hooks/useCrudForm'
import { confirmDelete } from '@/utils/dialog'
import { collectTreeIds, flattenTree, findTreeNode } from '@/utils/tree'
import AppLayout from '@/components/layout/AppLayout.vue'
import AppCard from '@/components/ui/AppCard.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppSegmented from '@/components/ui/AppSegmented.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppTable from '@/components/ui/AppTable.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppField from '@/components/ui/AppField.vue'
import AppSwitch from '@/components/ui/AppSwitch.vue'
import AppTag from '@/components/ui/AppTag.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const user = useUserStore()
const { t } = useI18n()

const loading = ref(false)
const menuTree = ref<MenuItem[]>([])
const keyword = ref('')

const columns: TableColumn[] = [
  { key: 'name', title: t('menu.name'), width: 220 },
  { key: 'type', title: t('common.type'), width: 84, align: 'center' },
  { key: 'path', title: t('common.path'), width: 200, card: false },
  { key: 'perms', title: t('common.perms'), width: 170 },
  { key: 'sort', title: t('common.sort'), width: 66, align: 'center', card: false },
  { key: 'status', title: t('common.status'), width: 84, align: 'center' },
  { key: 'actions', title: t('common.actions'), width: 210, align: 'right' },
]

const rows = computed<Array<Record<string, any>>>(() => {
  const flat = flattenTree<MenuItem>(menuTree.value)
  const keywordValue = keyword.value.trim()
  return flat
    .filter((item) => (keywordValue ? item.node.name.includes(keywordValue) : true))
    .map((item) => ({ ...item.node, depth: item.depth }))
})

const typeLabel = (type: MenuType): string => {
  if (type === 'catalog') return t('role.typeCatalog')
  if (type === 'menu') return t('role.typeMenu')
  return t('role.typeButton')
}

const typeTag = (type: MenuType): 'warning' | 'primary' | 'info' => {
  if (type === 'catalog') return 'warning'
  if (type === 'menu') return 'primary'
  return 'info'
}

const loadTree = async () => {
  loading.value = true
  try {
    menuTree.value = await menuApi.tree()
  } finally {
    loading.value = false
  }
}

/* ------------------------------- 表单 ------------------------------- */

const iconOptions = [
  { label: 'dashboard', value: 'dashboard' },
  { label: 'home', value: 'home' },
  { label: 'my', value: 'my' },
  { label: 'set', value: 'set' },
  { label: 'menu-list', value: 'menu-list' },
  { label: 'group-circle', value: 'group-circle' },
  { label: 'organizatio', value: 'organizatio' },
  { label: 'book', value: 'book' },
  { label: 'record', value: 'record' },
  { label: 'statistics', value: 'statistics' },
  { label: 'order', value: 'order' },
  { label: 'pay', value: 'pay' },
]

const typeOptions = [
  { label: t('role.typeCatalog'), value: 'catalog' },
  { label: t('role.typeMenu'), value: 'menu' },
  { label: t('role.typeButton'), value: 'button' },
]

interface MenuForm {
  parentId: number
  name: string
  type: MenuType
  path: string
  icon: string
  perms: string
  sort: number
  visible: boolean
  status: StatusValue
}

const {
  form,
  visible: dialogVisible,
  editing,
  submitting,
  error: formError,
  title: dialogTitle,
  openCreate: openCreateForm,
  openEdit: openEditForm,
  submit: submitForm,
} = useCrudForm<MenuForm, MenuItem, Partial<MenuItem>>({
  empty: () => ({
    parentId: 0,
    name: '',
    type: 'menu',
    path: '',
    icon: 'menu-list',
    perms: '',
    sort: 1,
    visible: true,
    status: 1,
  }),
  fill: (row) => ({
    parentId: row.parentId,
    name: row.name,
    type: row.type,
    path: row.path,
    icon: row.icon || 'menu-list',
    perms: row.perms,
    sort: row.sort,
    visible: row.visible,
    status: row.status,
  }),
  rules: [
    {
      field: 'name',
      label: t('menu.name'),
      required: true,
      requiredMessage: t('menu.requiredName'),
    },
    {
      field: 'path',
      label: t('common.path'),
      validate: (value, formData) => {
        if (formData.type !== 'menu') return ''
        const path = String(value || '').trim()
        if (!path) return t('menu.requiredPath')
        // 菜单指向的页面必须已在 pages.json 注册，否则点击后跳转不到任何页面
        if (!isRegisteredPage(path)) {
          return t('menu.pathUnregistered', { path })
        }
        return ''
      },
    },
    {
      field: 'perms',
      label: t('common.perms'),
      validate: (value, formData) => {
        if (formData.type !== 'button') return ''
        return String(value || '').trim() ? '' : t('menu.requiredPerms')
      },
    },
  ],
  create: (payload) => menuApi.create(payload),
  update: (id, payload) => menuApi.update(id, payload),
  payload: (formData) => ({
    ...formData,
    path: formData.type === 'button' ? '' : formData.path,
    icon: formData.type === 'button' ? '' : formData.icon,
    perms: formData.type === 'catalog' ? '' : formData.perms,
  }),
  title: (row) => (row ? t('menu.editTitle') : t('menu.createTitle')),
  onSaved: async () => {
    await loadTree()
    // 菜单变化后刷新当前账号菜单树，侧边栏即时生效
    user.fetchProfile().catch(() => undefined)
  },
})

const openCreate = (parent?: MenuItem | null) => {
  openCreateForm({
    parentId: parent ? parent.id : 0,
    type: parent && parent.type === 'menu' ? 'button' : 'menu',
  })
}

const openEdit = (row: MenuItem) => {
  // 从树里取回带 children 的节点，用于过滤上级选项
  openEditForm(findTreeNode(menuTree.value, (node) => node.id === row.id) || row)
}

const parentOptions = computed(() => {
  const flat = flattenTree<MenuItem>(menuTree.value)
  const blockedIds = editing.value ? collectTreeIds(editing.value) : []
  const options = [{ label: t('menu.topLevel'), value: 0 }]
  flat
    .filter((item) => item.node.type !== 'button' && !blockedIds.includes(item.node.id))
    .forEach((item) => {
      options.push({
        label: `${'　'.repeat(item.depth)}${item.node.name}`,
        value: item.node.id,
      })
    })
  return options
})

/* ------------------------------- 操作 ------------------------------- */

const remove = (row: MenuItem) => {
  confirmDelete({
    title: t('menu.deleteTitle'),
    content: t('menu.deleteContent', { name: row.name }),
    onConfirm: async () => {
      await menuApi.remove(row.id)
      uni.showToast({ title: t('menu.deleted'), icon: 'success' })
      await loadTree()
      user.fetchProfile().catch(() => undefined)
    },
  })
}

const changeStatus = async (row: MenuItem, value: string | number | boolean) => {
  const next = Number(value) as StatusValue
  try {
    await menuApi.update(row.id, { status: next })
    row.status = next
    uni.showToast({
      title: next === 1 ? t('common.switchEnabled') : t('common.switchDisabled'),
      icon: 'none',
    })
    user.fetchProfile().catch(() => undefined)
  } catch (e) {
    // 失败保持原状态
  }
}

onLoad(() => {
  loadTree()
})
</script>

<template>
  <app-layout
    :title="t('menu.title')"
    :breadcrumb="[t('common.system'), t('menu.title')]"
    :subtitle="t('menu.subtitle')"
  >
    <template #actions>
      <app-button v-if="user.hasPerm('system:menu:add')" icon="add" @click="openCreate()">
        {{ t('menu.add') }}
      </app-button>
    </template>

    <app-card padding="14">
      <view class="toolbar">
        <view class="toolbar-left">
          <app-input
            v-model="keyword"
            :placeholder="t('menu.keyword')"
            prefix-icon="search"
            clearable
            class="toolbar-input"
          />
          <app-button type="default" @click="loadTree">{{ t('common.refresh') }}</app-button>
        </view>
        <text class="toolbar-tip">{{ t('menu.tip') }}</text>
      </view>
    </app-card>

    <app-card padding="0 0 14px">
      <app-table :columns="columns" :data="rows" :loading="loading" :empty-text="t('menu.empty')">
        <template #cell-name="{ row }">
          <view class="menu-name-cell" :style="{ paddingLeft: `${row.depth * 18}px` }">
            <app-icon
              v-if="row.type !== 'button'"
              :name="row.icon || 'menu-list'"
              :size="15"
              color="#8a94a6"
            />
            <view v-else class="btn-dot" />
            <text class="menu-name">{{ row.name }}</text>
          </view>
        </template>

        <template #cell-type="{ row }">
          <app-tag :type="typeTag(row.type)" size="sm">{{ typeLabel(row.type) }}</app-tag>
        </template>

        <template #cell-path="{ row }">
          <view class="path-cell">
            <text class="mono-text">{{ row.path || '—' }}</text>
            <app-tag
              v-if="row.type === 'menu' && !isRegisteredPage(row.path)"
              type="danger"
              size="sm"
            >
              {{ t('menu.unregistered') }}
            </app-tag>
          </view>
        </template>

        <template #cell-perms="{ row }">
          <text class="mono-text">{{ row.perms || '—' }}</text>
        </template>

        <template #cell-status="{ row }">
          <view class="status-cell">
            <app-switch
              :model-value="row.status"
              :active-value="1"
              :inactive-value="0"
              @change="(value) => changeStatus(row, value)"
            />
          </view>
        </template>

        <template #cell-actions="{ row }">
          <view class="action-cell">
            <app-button
              v-if="user.hasPerm('system:menu:add') && row.type !== 'button'"
              type="text"
              size="sm"
              @click="openCreate(row)"
            >
              {{ t('menu.addChild') }}
            </app-button>
            <app-button
              v-if="user.hasPerm('system:menu:edit')"
              type="text"
              size="sm"
              @click="openEdit(row)"
            >
              {{ t('common.edit') }}
            </app-button>
            <app-button
              v-if="user.hasPerm('system:menu:remove')"
              type="text"
              size="sm"
              class="danger-text"
              @click="remove(row)"
            >
              {{ t('common.remove') }}
            </app-button>
          </view>
        </template>
      </app-table>
    </app-card>

    <app-dialog
      v-model:visible="dialogVisible"
      :title="dialogTitle"
      :width="600"
      :loading="submitting"
      @confirm="submitForm"
    >
      <view class="form-grid">
        <app-field :label="t('menu.parent')">
          <app-select
            v-model="form.parentId"
            :options="parentOptions"
            :placeholder="t('menu.topLevel')"
            :title="t('menu.parentTitle')"
          />
        </app-field>
        <app-field :label="t('menu.type')">
          <app-segmented v-model="form.type" :options="typeOptions" />
        </app-field>
        <app-field :label="t('menu.name')" required>
          <app-input v-model="form.name" :placeholder="t('menu.namePlaceholder')" />
        </app-field>
        <app-field :label="t('common.sort')">
          <app-input v-model="form.sort" type="number" :placeholder="t('menu.sortPlaceholder')" />
        </app-field>

        <app-field v-if="form.type !== 'button'" :label="t('menu.icon')">
          <app-select v-model="form.icon" :options="iconOptions" :title="t('menu.iconTitle')" />
        </app-field>
        <app-field v-if="form.type === 'menu'" :label="t('common.path')" required>
          <app-input v-model="form.path" placeholder="/pages/system/xxx/index" />
        </app-field>
        <app-field v-if="form.type !== 'catalog'" :label="t('common.perms')">
          <app-input v-model="form.perms" :placeholder="t('menu.permsPlaceholder')" />
        </app-field>
      </view>

      <view class="switch-row">
        <app-field :label="t('menu.visible')">
          <view class="inline-switch">
            <app-switch v-model="form.visible" />
            <text class="switch-hint">
              {{ form.visible ? t('menu.visibleOn') : t('menu.visibleOff') }}
            </text>
          </view>
        </app-field>
        <app-field :label="t('menu.statusLabel')">
          <view class="inline-switch">
            <app-switch v-model="form.status" :active-value="1" :inactive-value="0" />
            <text class="switch-hint">
              {{ form.status === 1 ? t('menu.statusOn') : t('menu.statusOff') }}
            </text>
          </view>
        </app-field>
      </view>

      <view v-if="formError" class="form-error">
        <app-icon name="warning" :size="13" color="#f5455c" />
        <text class="form-error-text">{{ formError }}</text>
      </view>
    </app-dialog>
  </app-layout>
</template>

<style lang="scss" scoped>
.toolbar {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-left {
  flex-direction: row;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.toolbar-input {
  width: 240px;
}

.toolbar-tip {
  font-size: var(--app-font-xs);
  color: var(--app-text-3);
}

.menu-name-cell {
  flex-direction: row;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.btn-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px dashed #b6bfcc;
  flex: none;
}

.menu-name {
  font-size: var(--app-font);
  color: var(--app-text);
  font-weight: 500;
}

.path-cell {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
}

.mono-text {
  font-size: var(--app-font-sm);
  color: var(--app-text-3);
  font-family: Menlo, Consolas, monospace;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.status-cell {
  align-items: center;
}

.action-cell {
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
}

.danger-text {
  color: var(--app-danger) !important;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0 18px;
}

.switch-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0 18px;
}

.inline-switch {
  flex-direction: row;
  align-items: center;
  gap: 10px;
  min-height: 36px;
}

.switch-hint {
  font-size: var(--app-font-xs);
  color: var(--app-text-3);
}

.form-error {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: var(--app-radius-sm);
  background: var(--app-danger-weak);
  margin-top: 8px;
  /* 表单较长时错误提示落在滚动区外，吸附在弹窗底部保证可见 */
  position: sticky;
  bottom: 0;
  z-index: 2;
}

.form-error-text {
  font-size: var(--app-font-sm);
  color: var(--app-danger);
}

@media (max-width: 767px) {
  .toolbar-input {
    width: 100%;
  }
  .form-grid,
  .switch-row {
    grid-template-columns: 1fr;
  }
  .toolbar-tip {
    display: none;
  }
}
</style>
