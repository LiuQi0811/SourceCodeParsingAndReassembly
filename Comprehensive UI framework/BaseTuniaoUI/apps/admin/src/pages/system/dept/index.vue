<script lang="ts" setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { deptApi } from '@/api/dept'
import type { DeptPayload } from '@/api/dept'
import type { DeptItem } from '@/api/types'
import type { TableColumn } from '@/components/ui/types'
import { useUserStore } from '@/store/modules/user'
import { useCrudForm } from '@/hooks/useCrudForm'
import { confirmDelete } from '@/utils/dialog'
import { collectTreeIds, flattenTree, findTreeNode } from '@/utils/tree'
import { PHONE_PATTERN } from '@/utils/validate'
import AppLayout from '@/components/layout/AppLayout.vue'
import AppCard from '@/components/ui/AppCard.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
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
const deptTree = ref<DeptItem[]>([])
const keyword = ref('')

const columns: TableColumn[] = [
  { key: 'name', title: t('dept.name'), width: 240 },
  { key: 'leader', title: t('common.leader'), width: 120 },
  { key: 'phone', title: t('dept.phoneLabel'), width: 140, card: false },
  { key: 'sort', title: t('common.sort'), width: 66, align: 'center', card: false },
  { key: 'status', title: t('common.status'), width: 84, align: 'center' },
  { key: 'actions', title: t('common.actions'), width: 200, align: 'right' },
]

const rows = computed<Array<Record<string, any>>>(() => {
  const flat = flattenTree<DeptItem>(deptTree.value)
  const keywordValue = keyword.value.trim()
  return flat
    .filter((item) => (keywordValue ? item.node.name.includes(keywordValue) : true))
    .map((item) => ({ ...item.node, depth: item.depth }))
})

const loadTree = async () => {
  loading.value = true
  try {
    deptTree.value = await deptApi.tree()
  } finally {
    loading.value = false
  }
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
  openEdit: openEditForm,
  submit: submitForm,
} = useCrudForm<DeptPayload, DeptItem, DeptPayload>({
  empty: () => ({
    parentId: 0,
    name: '',
    leader: '',
    phone: '',
    sort: 1,
    status: 1,
  }),
  fill: (row) => ({
    parentId: row.parentId,
    name: row.name,
    leader: row.leader,
    phone: row.phone,
    sort: row.sort,
    status: row.status,
  }),
  rules: [
    {
      field: 'name',
      label: t('dept.name'),
      required: true,
      requiredMessage: t('dept.requiredName'),
    },
    {
      field: 'phone',
      label: t('dept.phoneLabel'),
      pattern: PHONE_PATTERN,
      invalidMessage: t('dept.phoneInvalid'),
    },
  ],
  create: (payload) => deptApi.create(payload),
  update: (id, payload) => deptApi.update(id, payload),
  title: (row) => (row ? t('dept.editTitle') : t('dept.createTitle')),
  onSaved: () => loadTree(),
})

const openCreate = (parent?: DeptItem | null) => {
  openCreateForm({ parentId: parent ? parent.id : 0 })
}

const openEdit = (row: DeptItem) => {
  openEditForm(findTreeNode(deptTree.value, (node) => node.id === row.id) || row)
}

const parentOptions = computed(() => {
  const flat = flattenTree<DeptItem>(deptTree.value)
  const blockedIds = editing.value ? collectTreeIds(editing.value) : []
  const options = [{ label: t('dept.topLevel'), value: 0 }]
  flat
    .filter((item) => !blockedIds.includes(item.node.id))
    .forEach((item) => {
      options.push({
        label: `${'　'.repeat(item.depth)}${item.node.name}`,
        value: item.node.id,
      })
    })
  return options
})

/* ------------------------------- 操作 ------------------------------- */

const remove = (row: DeptItem) => {
  const hasChildren = deptTree.value.some((item) => item.parentId === row.id)
  if (hasChildren) {
    uni.showToast({ title: t('dept.hasChildren'), icon: 'none' })
    return
  }
  confirmDelete({
    title: t('dept.deleteTitle'),
    content: t('dept.deleteContent', { name: row.name }),
    onConfirm: async () => {
      await deptApi.remove(row.id)
      uni.showToast({ title: t('dept.deleted'), icon: 'success' })
      await loadTree()
    },
  })
}

onLoad(() => {
  loadTree()
})
</script>

<template>
  <app-layout
    :title="t('dept.title')"
    :breadcrumb="[t('common.system'), t('dept.title')]"
    :subtitle="t('dept.subtitle')"
  >
    <template #actions>
      <app-button v-if="user.hasPerm('system:dept:add')" icon="add" @click="openCreate()">
        {{ t('dept.add') }}
      </app-button>
    </template>

    <app-card padding="14">
      <view class="toolbar">
        <view class="toolbar-left">
          <app-input
            v-model="keyword"
            :placeholder="t('dept.keyword')"
            prefix-icon="search"
            clearable
            class="toolbar-input"
          />
          <app-button type="default" @click="loadTree">{{ t('common.refresh') }}</app-button>
        </view>
        <text class="toolbar-tip">{{ t('dept.tip') }}</text>
      </view>
    </app-card>

    <app-card padding="0 0 14px">
      <app-table :columns="columns" :data="rows" :loading="loading" :empty-text="t('dept.empty')">
        <template #cell-name="{ row }">
          <view class="dept-name-cell" :style="{ paddingLeft: `${row.depth * 20}px` }">
            <view class="dept-icon" :class="{ 'is-root': row.depth === 0 }">
              <app-icon
                :name="row.depth === 0 ? 'company' : 'organizatio'"
                :size="14"
                :color="row.depth === 0 ? 'var(--app-primary)' : 'var(--app-text-3)'"
              />
            </view>
            <text class="dept-name">{{ row.name }}</text>
          </view>
        </template>

        <template #cell-status="{ row }">
          <app-tag :type="row.status === 1 ? 'success' : 'info'" size="sm">
            {{ row.status === 1 ? t('common.enabled') : t('common.disabled') }}
          </app-tag>
        </template>

        <template #cell-actions="{ row }">
          <view class="action-cell">
            <app-button
              v-if="user.hasPerm('system:dept:add')"
              type="text"
              size="sm"
              @click="openCreate(row)"
            >
              {{ t('dept.addChild') }}
            </app-button>
            <app-button
              v-if="user.hasPerm('system:dept:edit')"
              type="text"
              size="sm"
              @click="openEdit(row)"
            >
              {{ t('common.edit') }}
            </app-button>
            <app-button
              v-if="user.hasPerm('system:dept:remove')"
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
      :loading="submitting"
      @confirm="submitForm"
    >
      <view class="form-grid">
        <app-field :label="t('dept.parent')">
          <app-select
            v-model="form.parentId"
            :options="parentOptions"
            :placeholder="t('dept.topLevel')"
            :title="t('dept.parentTitle')"
          />
        </app-field>
        <app-field :label="t('dept.name')" required>
          <app-input v-model="form.name" :placeholder="t('dept.namePlaceholder')" />
        </app-field>
        <app-field :label="t('dept.leader')">
          <app-input v-model="form.leader" :placeholder="t('dept.leaderPlaceholder')" />
        </app-field>
        <app-field :label="t('dept.phoneLabel')">
          <app-input
            v-model="form.phone"
            type="number"
            :placeholder="t('dept.phonePlaceholder')"
            :maxlength="11"
          />
        </app-field>
        <app-field :label="t('common.sort')">
          <app-input v-model="form.sort" type="number" :placeholder="t('menu.sortPlaceholder')" />
        </app-field>
        <app-field :label="t('common.status')">
          <view class="inline-switch">
            <app-switch v-model="form.status" :active-value="1" :inactive-value="0" />
            <text class="switch-hint">
              {{ form.status === 1 ? t('common.enabled') : t('common.disabled') }}
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

.dept-name-cell {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.dept-icon {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  background: var(--app-bg-2);
  align-items: center;
  justify-content: center;
  flex: none;
}

.dept-icon.is-root {
  background: var(--app-primary-weak);
}

.dept-name {
  font-size: var(--app-font);
  color: var(--app-text);
  font-weight: 500;
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
  .form-grid {
    grid-template-columns: 1fr;
  }
  .toolbar-tip {
    display: none;
  }
}
</style>
