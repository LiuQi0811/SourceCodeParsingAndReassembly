<script lang="ts" setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { deptApi } from '@/api/dept'
import { roleApi } from '@/api/role'
import { userApi } from '@/api/user'
import type { UserPayload } from '@/api/user'
import type { DeptItem, StatusValue, UserItem } from '@/api/types'
import type { TableColumn } from '@/components/ui/types'
import { useCrudForm } from '@/hooks/useCrudForm'
import { useTableList } from '@/hooks/useTableList'
import { useUserStore } from '@/store/modules/user'
import { confirmDelete } from '@/utils/dialog'
import { flattenTree } from '@/utils/tree'
import { EMAIL_PATTERN, PHONE_PATTERN } from '@/utils/validate'
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

const query = ref<{ keyword: string; status: StatusValue | '' }>({
  keyword: '',
  status: '',
})

const { list, total, loading, pageNum, pageSize, load, search, changePage } =
  useTableList<UserItem>((params) =>
    userApi.page({
      pageNum: params.pageNum,
      pageSize: params.pageSize,
      keyword: query.value.keyword,
      status: query.value.status,
    })
  )

const columns: TableColumn[] = [
  { key: 'nickname', title: t('common.nickname'), width: 170 },
  { key: 'username', title: t('common.account'), width: 120, card: false },
  { key: 'deptName', title: t('common.dept'), width: 120 },
  { key: 'roleNames', title: t('common.role'), width: 140 },
  { key: 'phone', title: t('common.phone'), width: 130, card: false },
  { key: 'status', title: t('common.status'), width: 84, align: 'center' },
  { key: 'createTime', title: t('common.createTime'), width: 160, card: false },
  { key: 'actions', title: t('common.actions'), width: 170, align: 'right' },
]

/* ---------------------------- 部门 / 角色选项 ---------------------------- */

const deptOptions = ref<{ label: string; value: number }[]>([])
const roleOptions = ref<{ label: string; value: number }[]>([])

const loadOptions = async () => {
  const [depts, roles] = await Promise.all([
    deptApi.tree(),
    roleApi.page({ pageNum: 1, pageSize: 100 }),
  ])
  const flat = flattenTree<DeptItem>(depts)
  deptOptions.value = flat.map((item) => ({
    label: `${'　'.repeat(item.depth)}${item.node.name}`,
    value: item.node.id,
  }))
  roleOptions.value = roles.list.map((role) => ({ label: role.name, value: role.id }))
}

/* ------------------------------- 查询 ------------------------------- */

const resetQuery = () => {
  query.value.keyword = ''
  query.value.status = ''
  search()
}

/* ------------------------------- 表单 ------------------------------- */

const {
  form,
  visible: dialogVisible,
  submitting,
  error: formError,
  title: dialogTitle,
  openCreate: openCreateForm,
  openEdit,
  submit: submitForm,
} = useCrudForm<UserPayload, UserItem, UserPayload>({
  empty: () => ({
    username: '',
    nickname: '',
    deptId: 0,
    roleIds: [],
    phone: '',
    email: '',
    status: 1,
  }),
  defaults: () => ({ deptId: deptOptions.value[0]?.value || 0 }),
  fill: (row) => ({
    username: row.username,
    nickname: row.nickname,
    deptId: row.deptId,
    roleIds: [...row.roleIds],
    phone: row.phone,
    email: row.email,
    status: row.status,
  }),
  rules: [
    {
      field: 'username',
      label: t('common.account'),
      required: true,
      requiredMessage: t('user.requiredAccount'),
    },
    {
      field: 'nickname',
      label: t('common.nickname'),
      required: true,
      requiredMessage: t('user.requiredNickname'),
    },
    {
      field: 'phone',
      label: t('common.phone'),
      pattern: PHONE_PATTERN,
      invalidMessage: t('user.phoneInvalid'),
    },
    {
      field: 'email',
      label: t('common.email'),
      pattern: EMAIL_PATTERN,
      invalidMessage: t('user.emailInvalid'),
    },
  ],
  create: (payload) => userApi.create(payload),
  update: (id, payload) => userApi.update(id, payload),
  title: (row) => (row ? t('user.editTitle') : t('user.createTitle')),
  onSaved: () => load(),
})

const openCreate = () => openCreateForm()

/* ------------------------------- 操作 ------------------------------- */

const remove = (row: UserItem) => {
  confirmDelete({
    title: t('user.deleteTitle'),
    content: t('user.deleteContent', { name: row.nickname }),
    onConfirm: async () => {
      await userApi.remove(row.id)
      uni.showToast({ title: t('user.deleted'), icon: 'success' })
      load()
    },
  })
}

const changeStatus = async (row: UserItem, value: string | number | boolean) => {
  const next = Number(value) as StatusValue
  try {
    await userApi.setStatus(row.id, next)
    row.status = next
    uni.showToast({
      title: next === 1 ? t('common.switchEnabled') : t('common.switchDisabled'),
      icon: 'none',
    })
  } catch (e) {
    // 失败时保持原状态，无需回滚
  }
}

const isAdminRow = (row: UserItem): boolean => row.id === 1

onLoad(() => {
  loadOptions()
  load()
})
</script>

<template>
  <app-layout
    :title="t('user.title')"
    :breadcrumb="[t('common.system'), t('user.title')]"
    :subtitle="t('user.subtitle')"
  >
    <template #actions>
      <app-button v-if="user.hasPerm('system:user:add')" icon="add" @click="openCreate">
        {{ t('user.add') }}
      </app-button>
    </template>

    <app-card padding="14">
      <view class="toolbar">
        <view class="toolbar-left">
          <app-input
            v-model="query.keyword"
            :placeholder="t('user.keyword')"
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
      <app-table :columns="columns" :data="list" :loading="loading" :empty-text="t('user.empty')">
        <template #cell-nickname="{ row }">
          <view class="user-cell">
            <view class="user-avatar">{{ String(row.nickname).slice(0, 1) }}</view>
            <view class="user-meta">
              <text class="user-name">{{ row.nickname }}</text>
              <text class="user-mail">{{ row.email || t('user.noEmail') }}</text>
            </view>
          </view>
        </template>

        <template #cell-roleNames="{ row }">
          <view class="role-cell">
            <app-tag v-for="name in String(row.roleNames || '').split('、')" :key="name" size="sm">
              {{ name }}
            </app-tag>
            <text v-if="!row.roleNames" class="text-3">{{ t('user.noRole') }}</text>
          </view>
        </template>

        <template #cell-status="{ row }">
          <view class="status-cell">
            <app-switch
              :model-value="row.status"
              :active-value="1"
              :inactive-value="0"
              :disabled="isAdminRow(row)"
              @change="(value) => changeStatus(row, value)"
            />
          </view>
        </template>

        <template #cell-actions="{ row }">
          <view class="action-cell">
            <app-button
              v-if="user.hasPerm('system:user:edit')"
              type="text"
              size="sm"
              @click="openEdit(row)"
            >
              {{ t('common.edit') }}
            </app-button>
            <app-button
              v-if="user.hasPerm('system:user:remove')"
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

    <!-- 新增 / 编辑 -->
    <app-dialog
      v-model:visible="dialogVisible"
      :title="dialogTitle"
      :loading="submitting"
      @confirm="submitForm"
    >
      <view class="form-grid">
        <app-field :label="t('common.account')" required>
          <app-input v-model="form.username" :placeholder="t('user.accountPlaceholder')" />
        </app-field>
        <app-field :label="t('common.nickname')" required>
          <app-input v-model="form.nickname" :placeholder="t('user.nicknamePlaceholder')" />
        </app-field>
        <app-field :label="t('common.dept')">
          <app-select
            v-model="form.deptId"
            :options="deptOptions"
            :placeholder="t('user.selectDept')"
            :title="t('user.deptTitle')"
          />
        </app-field>
        <app-field :label="t('common.role')">
          <app-select
            v-model="form.roleIds"
            :options="roleOptions"
            multiple
            :placeholder="t('user.selectRole')"
            :title="t('user.roleTitle')"
          />
        </app-field>
        <app-field :label="t('common.phone')">
          <app-input
            v-model="form.phone"
            type="number"
            :placeholder="t('user.phonePlaceholder')"
            :maxlength="11"
          />
        </app-field>
        <app-field :label="t('common.email')">
          <app-input v-model="form.email" :placeholder="t('user.emailPlaceholder')" />
        </app-field>
      </view>

      <app-field :label="t('user.accountStatus')">
        <view class="status-row">
          <app-switch v-model="form.status" :active-value="1" :inactive-value="0" />
          <text class="status-hint">
            {{ form.status === 1 ? t('user.enabledHint') : t('user.disabledHint') }}
          </text>
        </view>
      </app-field>

      <view v-if="formError" class="form-error">
        <app-icon name="warning" :size="13" color="#f5455c" />
        <text class="form-error-text">{{ formError }}</text>
      </view>
    </app-dialog>
  </app-layout>
</template>

<style lang="scss" scoped>
/* 工具栏 */
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
  flex: 1;
}

.toolbar-input {
  width: 240px;
}

.toolbar-select {
  width: 140px;
}

/* 用户单元格 */
.user-cell {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.user-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--app-primary-weak);
  color: var(--app-primary);
  font-size: var(--app-font-sm);
  font-weight: 600;
  align-items: center;
  justify-content: center;
  flex: none;
}

.user-meta {
  gap: 1px;
  min-width: 0;
}

.user-name {
  font-size: var(--app-font);
  color: var(--app-text);
  font-weight: 500;
}

.user-mail {
  font-size: 11px;
  color: var(--app-text-3);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.role-cell {
  flex-direction: row;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
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

.table-footer {
  padding: 0 16px;
}

/* 表单 */
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
}
</style>
