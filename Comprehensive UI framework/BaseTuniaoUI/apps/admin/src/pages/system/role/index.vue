<script lang="ts" setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { menuApi } from '@/api/menu'
import { roleApi } from '@/api/role'
import type { RolePayload } from '@/api/role'
import type { MenuItem, RoleItem, StatusValue } from '@/api/types'
import type { TableColumn } from '@/components/ui/types'
import { useCrudForm } from '@/hooks/useCrudForm'
import { useTableList } from '@/hooks/useTableList'
import { useUserStore } from '@/store/modules/user'
import { confirmDelete } from '@/utils/dialog'
import { collectTreeIds, flattenTree } from '@/utils/tree'
import AppLayout from '@/components/layout/AppLayout.vue'
import AppCard from '@/components/ui/AppCard.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppTable from '@/components/ui/AppTable.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppField from '@/components/ui/AppField.vue'
import AppSwitch from '@/components/ui/AppSwitch.vue'
import AppTag from '@/components/ui/AppTag.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const user = useUserStore()
const { t } = useI18n()

const statusOptions = [
  { label: t('common.allStatus'), value: '' },
  { label: t('common.enabled'), value: 1 },
  { label: t('common.disabled'), value: 0 },
]

const query = ref<{ keyword: string; status: StatusValue | '' }>({ keyword: '', status: '' })

const { list, total, loading, pageNum, pageSize, load, search, changePage } =
  useTableList<RoleItem>((params) =>
    roleApi.page({
      pageNum: params.pageNum,
      pageSize: params.pageSize,
      keyword: query.value.keyword,
      status: query.value.status,
    })
  )

const columns: TableColumn[] = [
  { key: 'name', title: t('role.name'), width: 180 },
  { key: 'code', title: t('role.code'), width: 140 },
  { key: 'sort', title: t('common.sort'), width: 70, align: 'center', card: false },
  { key: 'status', title: t('common.status'), width: 90, align: 'center' },
  { key: 'remark', title: t('common.remark'), width: 150, card: false },
  { key: 'actions', title: t('common.actions'), width: 210, align: 'right' },
]

const resetQuery = () => {
  query.value.keyword = ''
  query.value.status = ''
  search()
}

/* ------------------------------- 表单 ------------------------------- */

const {
  form,
  visible: dialogVisible,
  editing,
  submitting,
  error: formError,
  title: dialogTitle,
  openCreate: openCreateForm,
  openEdit,
  submit: submitForm,
} = useCrudForm<RolePayload, RoleItem, RolePayload>({
  empty: () => ({ name: '', code: '', sort: 1, status: 1, remark: '' }),
  defaults: () => ({ sort: list.value.length + 1 }),
  fill: (row) => ({
    name: row.name,
    code: row.code,
    sort: row.sort,
    status: row.status,
    remark: row.remark,
  }),
  rules: [
    {
      field: 'name',
      label: t('role.name'),
      required: true,
      requiredMessage: t('role.requiredName'),
    },
    {
      field: 'code',
      label: t('role.code'),
      required: true,
      requiredMessage: t('role.requiredCode'),
      pattern: /^[a-zA-Z][a-zA-Z0-9_-]*$/,
      invalidMessage: t('role.codeFormat'),
    },
  ],
  create: (payload) => roleApi.create(payload),
  update: (id, payload) => roleApi.update(id, payload),
  title: (row) => (row ? t('role.editTitle') : t('role.createTitle')),
  onSaved: async (mode) => {
    // 改的是自己所属角色：名称/状态变化要立刻反映到顶栏与权限
    if (mode === 'update' && editing.value && user.roleIds.includes(editing.value.id)) {
      await user.refreshProfile()
    }
    load()
  },
})

const openCreate = () => openCreateForm()

/* ----------------------------- 菜单授权 ----------------------------- */

const authVisible = ref(false)
const authRole = ref<RoleItem | null>(null)
const authMenuTree = ref<MenuItem[]>([])
const checkedIds = ref<number[]>([])
const authLoading = ref(false)

const flatMenus = computed(() => flattenTree<MenuItem>(authMenuTree.value))

const parentMap = computed(() => {
  const map: Record<number, number> = {}
  flatMenus.value.forEach((item) => {
    map[item.node.id] = item.node.parentId
  })
  return map
})

const typeLabel = (type: MenuItem['type']): string => {
  if (type === 'catalog') return t('role.typeCatalog')
  if (type === 'menu') return t('role.typeMenu')
  return t('role.typeButton')
}

const isChecked = (id: number): boolean => checkedIds.value.includes(id)

const toggleCheck = (node: MenuItem) => {
  const ids = collectTreeIds(node)
  if (checkedIds.value.includes(node.id)) {
    checkedIds.value = checkedIds.value.filter((id) => !ids.includes(id))
    return
  }

  const merged = new Set<number>([...checkedIds.value, ...ids])
  // 勾选子项时自动补齐父级链路，避免出现“有子无父”的非法授权
  let parentId = parentMap.value[node.id] || 0
  while (parentId) {
    merged.add(parentId)
    parentId = parentMap.value[parentId] || 0
  }
  checkedIds.value = Array.from(merged)
}

const checkAll = () => {
  checkedIds.value = flatMenus.value.map((item) => item.node.id)
}

const clearAll = () => {
  checkedIds.value = []
}

const openAuth = async (row: RoleItem) => {
  authRole.value = row
  authVisible.value = true
  authLoading.value = true
  try {
    if (!authMenuTree.value.length) {
      authMenuTree.value = await menuApi.tree()
    }
    const result = await roleApi.getMenuIds(row.id)
    checkedIds.value = result.menuIds
  } finally {
    authLoading.value = false
  }
}

const saveAuth = async () => {
  if (!authRole.value) return
  authLoading.value = true
  try {
    await roleApi.updateMenuIds(authRole.value.id, checkedIds.value)
    // 授权对象就是当前账号所属角色时，立即重新拉取菜单与按钮权限，不用刷新页面
    if (user.roleIds.includes(authRole.value.id)) {
      await user.refreshProfile()
      uni.showToast({ title: t('role.authSavedRefresh'), icon: 'none' })
    } else {
      uni.showToast({ title: t('role.authSaved'), icon: 'success' })
    }
    authVisible.value = false
  } finally {
    authLoading.value = false
  }
}

/* ------------------------------- 操作 ------------------------------- */

const remove = (row: RoleItem) => {
  confirmDelete({
    title: t('role.deleteTitle'),
    content: t('role.deleteContent', { name: row.name }),
    onConfirm: async () => {
      await roleApi.remove(row.id)
      uni.showToast({ title: t('role.deleted'), icon: 'success' })
      load()
    },
  })
}

const changeStatus = async (row: RoleItem, value: string | number | boolean) => {
  const next = Number(value) as StatusValue
  try {
    await roleApi.update(row.id, {
      name: row.name,
      code: row.code,
      sort: row.sort,
      remark: row.remark,
      status: next,
    })
    row.status = next
    uni.showToast({
      title: next === 1 ? t('common.switchEnabled') : t('common.switchDisabled'),
      icon: 'none',
    })
  } catch (e) {
    // 失败保持原状态
  }
}

onLoad(() => {
  load()
})
</script>

<template>
  <app-layout
    :title="t('role.title')"
    :breadcrumb="[t('common.system'), t('role.title')]"
    :subtitle="t('role.subtitle')"
  >
    <template #actions>
      <app-button v-if="user.hasPerm('system:role:add')" icon="add" @click="openCreate">
        {{ t('role.add') }}
      </app-button>
    </template>

    <app-card padding="14">
      <view class="toolbar">
        <view class="toolbar-left">
          <app-input
            v-model="query.keyword"
            :placeholder="t('role.keyword')"
            prefix-icon="search"
            clearable
            class="toolbar-input"
            @confirm="search"
          />
          <app-select
            v-model="query.status"
            :options="statusOptions"
            :placeholder="t('common.allStatus')"
            :title="t('common.status')"
            class="toolbar-select"
            @change="search"
          />
          <app-button icon="search" @click="search">{{ t('common.query') }}</app-button>
          <app-button type="default" @click="resetQuery">{{ t('common.reset') }}</app-button>
        </view>
      </view>
    </app-card>

    <app-card padding="0 0 14px">
      <app-table :columns="columns" :data="list" :loading="loading" :empty-text="t('role.empty')">
        <template #cell-name="{ row }">
          <view class="role-name-cell">
            <view class="role-dot" :class="{ 'is-off': row.status === 0 }" />
            <text class="role-name">{{ row.name }}</text>
          </view>
        </template>

        <template #cell-code="{ row }">
          <app-tag type="info" size="sm">{{ row.code }}</app-tag>
        </template>

        <template #cell-status="{ row }">
          <view class="status-cell">
            <app-switch
              :model-value="row.status"
              :active-value="1"
              :inactive-value="0"
              :disabled="row.code === 'admin'"
              @change="(value) => changeStatus(row, value)"
            />
          </view>
        </template>

        <template #cell-remark="{ row }">
          <text class="remark-text">{{ row.remark || '—' }}</text>
        </template>

        <template #cell-actions="{ row }">
          <view class="action-cell">
            <app-button
              v-if="user.hasPerm('system:role:edit')"
              type="text"
              size="sm"
              @click="openEdit(row)"
            >
              {{ t('common.edit') }}
            </app-button>
            <app-button
              v-if="user.hasPerm('system:role:auth')"
              type="text"
              size="sm"
              icon="key"
              @click="openAuth(row)"
            >
              {{ t('role.auth') }}
            </app-button>
            <app-button
              v-if="user.hasPerm('system:role:remove')"
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

      <view class="table-footer">
        <app-pagination
          :total="total"
          :page-num="pageNum"
          :page-size="pageSize"
          @change="changePage"
        />
      </view>
    </app-card>

    <!-- 新增 / 编辑角色 -->
    <app-dialog
      v-model:visible="dialogVisible"
      :title="dialogTitle"
      :loading="submitting"
      @confirm="submitForm"
    >
      <view class="form-grid">
        <app-field :label="t('role.name')" required>
          <app-input v-model="form.name" :placeholder="t('role.namePlaceholder')" />
        </app-field>
        <app-field :label="t('role.code')" required>
          <app-input v-model="form.code" :placeholder="t('role.codePlaceholder')" />
        </app-field>
        <app-field :label="t('common.sort')">
          <app-input v-model="form.sort" type="number" :placeholder="t('role.sortPlaceholder')" />
        </app-field>
        <app-field :label="t('common.status')">
          <view class="status-row">
            <app-switch v-model="form.status" :active-value="1" :inactive-value="0" />
            <text class="status-hint">
              {{ form.status === 1 ? t('common.enabled') : t('common.disabled') }}
            </text>
          </view>
        </app-field>
      </view>
      <app-field :label="t('common.remark')">
        <app-input
          v-model="form.remark"
          textarea
          :placeholder="t('role.remarkPlaceholder')"
          :min-height="70"
        />
      </app-field>

      <view v-if="formError" class="form-error">
        <app-icon name="warning" :size="13" color="#f5455c" />
        <text class="form-error-text">{{ formError }}</text>
      </view>
    </app-dialog>

    <!-- 菜单授权 -->
    <app-dialog
      v-model:visible="authVisible"
      :title="t('role.authTitle', { name: authRole?.name || '' })"
      :width="620"
      :confirm-text="t('role.authSave')"
      :loading="authLoading"
      @confirm="saveAuth"
    >
      <view class="auth-toolbar">
        <view class="auth-info">
          <text class="auth-count">{{ t('role.authSelected', { count: checkedIds.length }) }}</text>
          <text class="auth-tip">{{ t('role.authTip') }}</text>
        </view>
        <view class="auth-actions">
          <app-button type="text" size="sm" @click="checkAll">{{ t('role.checkAll') }}</app-button>
          <app-button type="text" size="sm" @click="clearAll">{{ t('role.clearAll') }}</app-button>
        </view>
      </view>

      <view class="auth-tree">
        <view
          v-for="item in flatMenus"
          :key="item.node.id"
          class="auth-row"
          :class="{ 'is-checked': isChecked(item.node.id) }"
          :style="{ paddingLeft: `${10 + item.depth * 18}px` }"
          @tap="toggleCheck(item.node)"
        >
          <view class="check-box" :class="{ 'is-checked': isChecked(item.node.id) }">
            <app-icon v-if="isChecked(item.node.id)" name="check" :size="10" color="#ffffff" />
          </view>
          <text class="auth-name">{{ item.node.name }}</text>
          <app-tag
            size="sm"
            :type="
              item.node.type === 'button'
                ? 'info'
                : item.node.type === 'catalog'
                  ? 'warning'
                  : 'primary'
            "
          >
            {{ typeLabel(item.node.type) }}
          </app-tag>
        </view>
      </view>
    </app-dialog>
  </app-layout>
</template>

<style lang="scss" scoped>
.toolbar {
  flex-direction: row;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-left {
  flex-direction: row;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  flex: 1;
}

.toolbar-input {
  width: 240px;
}

.toolbar-select {
  width: 140px;
}

.role-name-cell {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.role-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--app-success);
}

.role-dot.is-off {
  background: var(--app-text-3);
}

.role-name {
  font-size: var(--app-font);
  color: var(--app-text);
  font-weight: 500;
}

.status-cell {
  align-items: center;
}

.remark-text {
  font-size: var(--app-font-sm);
  color: var(--app-text-3);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
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

.table-footer {
  padding: 0 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0 18px;
}

.status-row {
  flex-direction: row;
  align-items: center;
  gap: 10px;
}

.status-hint {
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
  position: sticky;
  bottom: 0;
  z-index: 2;
}

.form-error-text {
  font-size: var(--app-font-sm);
  color: var(--app-danger);
}

/* 授权 */
.auth-toolbar {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 2px 0 10px;
  border-bottom: 1px solid var(--app-border-2);
}

.auth-info {
  gap: 2px;
}

.auth-count {
  font-size: var(--app-font-sm);
  color: var(--app-text);
  font-weight: 500;
}

.auth-tip {
  font-size: 11px;
  color: var(--app-text-3);
}

.auth-actions {
  flex-direction: row;
  align-items: center;
  gap: 4px;
}

.auth-tree {
  padding: 8px 0;
  max-height: 46vh;
  overflow-y: auto;
}

.auth-row {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  height: 36px;
  border-radius: var(--app-radius-sm);
  padding-right: 8px;
}

.auth-row:hover {
  background: #f7fbff;
}

.auth-row.is-checked {
  background: var(--app-primary-weak-2);
}

.check-box {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid #cfd6e0;
  background: var(--app-card);
  align-items: center;
  justify-content: center;
  flex: none;
}

.check-box.is-checked {
  border-color: var(--app-primary);
  background: var(--app-primary);
}

.auth-name {
  font-size: var(--app-font-sm);
  color: var(--app-text-2);
  flex: 1;
}

.is-checked .auth-name {
  color: var(--app-primary);
  font-weight: 500;
}

@media (max-width: 767px) {
  .toolbar-input,
  .toolbar-select {
    width: 100%;
  }
  .form-grid {
    grid-template-columns: 1fr;
  }
  .table-footer {
    padding: 0;
  }
  .auth-tree {
    max-height: 52vh;
  }
}
</style>
