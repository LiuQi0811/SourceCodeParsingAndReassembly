<script lang="ts" setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { dictApi } from '@/api/dict'
import type { DictDataItem, DictTypeItem, StatusValue } from '@/api/types'
import type { TableColumn } from '@/components/ui/types'
import { useCrudForm } from '@/hooks/useCrudForm'
import { useTableList } from '@/hooks/useTableList'
import { useUserStore } from '@/store/modules/user'
import { confirmDelete } from '@/utils/dialog'
import AppLayout from '@/components/layout/AppLayout.vue'
import AppCard from '@/components/ui/AppCard.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppSegmented from '@/components/ui/AppSegmented.vue'
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

const tab = ref<'type' | 'data'>('type')

const tabOptions = [
  { label: t('dict.tabType'), value: 'type' },
  { label: t('dict.tabData'), value: 'data' },
]

const statusOptions = [
  { label: t('common.allStatus'), value: '' },
  { label: t('common.enabled'), value: 1 },
  { label: t('common.disabled'), value: 0 },
]

const tagTypeOptions = [
  { label: t('dict.tagGray'), value: '' },
  { label: t('dict.tagPrimary'), value: 'primary' },
  { label: t('dict.tagSuccess'), value: 'success' },
  { label: t('dict.tagWarning'), value: 'warning' },
  { label: t('dict.tagDanger'), value: 'danger' },
]

/* ------------------------------ 字典类型 ------------------------------ */

const typeQuery = ref<{ keyword: string; status: StatusValue | '' }>({ keyword: '', status: '' })

const typeColumns: TableColumn[] = [
  { key: 'name', title: t('dict.typeName'), width: 180 },
  { key: 'code', title: t('dict.typeCode'), width: 180 },
  { key: 'status', title: t('common.status'), width: 84, align: 'center' },
  { key: 'remark', title: t('common.remark'), width: 150, card: false },
  { key: 'createTime', title: t('common.createTime'), width: 176, card: false },
  { key: 'actions', title: t('common.actions'), width: 200, align: 'right' },
]

const typeTable = useTableList<DictTypeItem>((params) =>
  dictApi.typePage({
    pageNum: params.pageNum,
    pageSize: params.pageSize,
    keyword: typeQuery.value.keyword,
    status: typeQuery.value.status,
  })
)

/* ------------------------------ 字典数据 ------------------------------ */

const dataQuery = ref<{ typeCode: string; keyword: string; status: StatusValue | '' }>({
  typeCode: '',
  keyword: '',
  status: '',
})

const dataColumns: TableColumn[] = [
  { key: 'label', title: t('dict.dataLabel'), width: 160 },
  { key: 'value', title: t('dict.dataValue'), width: 120 },
  { key: 'sort', title: t('common.sort'), width: 66, align: 'center', card: false },
  { key: 'tagType', title: t('common.tagType'), width: 110, align: 'center', card: false },
  { key: 'status', title: t('common.status'), width: 84, align: 'center' },
  { key: 'actions', title: t('common.actions'), width: 140, align: 'right' },
]

const dataTable = useTableList<DictDataItem>((params) =>
  dictApi.dataPage({
    pageNum: params.pageNum,
    pageSize: params.pageSize,
    typeCode: dataQuery.value.typeCode,
    keyword: dataQuery.value.keyword,
    status: dataQuery.value.status,
  })
)

/* 类型下拉选项（供字典数据切换） */
const typeOptions = ref<{ label: string; value: string }[]>([])

const loadTypeOptions = async () => {
  const result = await dictApi.typePage({ pageNum: 1, pageSize: 100 })
  typeOptions.value = result.list.map((item) => ({
    label: `${item.name}（${item.code}）`,
    value: item.code,
  }))
}

const currentTypeName = computed(() => {
  const option = typeOptions.value.find((item) => item.value === dataQuery.value.typeCode)
  return option ? option.label : ''
})

const switchTab = (value: string | number) => {
  tab.value = value as 'type' | 'data'
  if (tab.value === 'type') typeTable.load()
  else datatableReload()
}

const datatableReload = () => {
  if (!dataQuery.value.typeCode && typeOptions.value.length) {
    dataQuery.value.typeCode = typeOptions.value[0].value
  }
  dataTable.load()
}

const resetTypeQuery = () => {
  typeQuery.value.keyword = ''
  typeQuery.value.status = ''
  typeTable.search()
}

const openDataOfType = (row: DictTypeItem) => {
  dataQuery.value.typeCode = row.code
  dataQuery.value.keyword = ''
  dataQuery.value.status = ''
  tab.value = 'data'
  dataTable.search()
}

/* --------------------------- 字典类型表单 --------------------------- */

interface DictTypeForm {
  name: string
  code: string
  status: StatusValue
  remark: string
}

const {
  form: typeForm,
  visible: typeDialog,
  submitting: typeSubmitting,
  error: typeFormError,
  title: typeDialogTitle,
  openCreate: openTypeCreate,
  openEdit: openTypeEdit,
  submit: submitType,
} = useCrudForm<DictTypeForm, DictTypeItem, Partial<DictTypeItem>>({
  empty: () => ({ name: '', code: '', status: 1, remark: '' }),
  fill: (row) => ({ name: row.name, code: row.code, status: row.status, remark: row.remark }),
  rules: [
    {
      field: 'name',
      label: t('dict.typeName'),
      required: true,
      requiredMessage: t('dict.requiredTypeName'),
    },
    {
      field: 'code',
      label: t('dict.typeCode'),
      required: true,
      requiredMessage: t('dict.requiredTypeCode'),
    },
  ],
  create: (payload) => dictApi.typeCreate(payload),
  update: (id, payload) => dictApi.typeUpdate(id, payload),
  title: (row) => (row ? t('dict.typeEdit') : t('dict.typeCreate')),
  onSaved: () => {
    typeTable.load()
    loadTypeOptions()
  },
})

/* --------------------------- 字典数据表单 --------------------------- */

interface DictDataForm {
  label: string
  value: string
  sort: number
  status: StatusValue
  tagType: DictDataItem['tagType']
}

const {
  form: dataForm,
  visible: dataDialog,
  submitting: dataSubmitting,
  error: dataFormError,
  title: dataDialogTitle,
  openCreate: openDataFormCreate,
  openEdit: openDataEdit,
  submit: submitData,
} = useCrudForm<DictDataForm, DictDataItem, Partial<DictDataItem>>({
  empty: () => ({
    label: '',
    value: '',
    sort: 1,
    status: 1,
    tagType: '',
  }),
  defaults: () => ({ sort: dataTable.list.value.length + 1 }),
  fill: (row) => ({
    label: row.label,
    value: row.value,
    sort: row.sort,
    status: row.status,
    tagType: row.tagType,
  }),
  rules: [
    {
      field: 'label',
      label: t('dict.dataLabel'),
      required: true,
      requiredMessage: t('dict.requiredLabel'),
    },
    {
      field: 'value',
      label: t('dict.dataValue'),
      required: true,
      requiredMessage: t('dict.requiredValue'),
    },
  ],
  create: (payload) => dictApi.dataCreate(payload),
  update: (id, payload) => dictApi.dataUpdate(id, payload),
  payload: (formData) => ({ ...formData, typeCode: dataQuery.value.typeCode }),
  title: (row) => (row ? t('dict.dataEdit') : t('dict.dataCreate')),
  onSaved: () => dataTable.load(),
})

const openDataCreate = () => {
  if (!dataQuery.value.typeCode) {
    uni.showToast({ title: t('dict.needType'), icon: 'none' })
    return
  }
  openDataFormCreate()
}

/* ------------------------------- 操作 ------------------------------- */

const changeTypeStatus = async (row: DictTypeItem, value: string | number | boolean) => {
  const next = Number(value) as StatusValue
  try {
    await dictApi.typeUpdate(row.id, {
      name: row.name,
      code: row.code,
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

const changeDataStatus = async (row: DictDataItem, value: string | number | boolean) => {
  const next = Number(value) as StatusValue
  try {
    await dictApi.dataUpdate(row.id, { ...row, status: next })
    row.status = next
    uni.showToast({
      title: next === 1 ? t('common.switchEnabled') : t('common.switchDisabled'),
      icon: 'none',
    })
  } catch (e) {
    // 失败保持原状态
  }
}

const removeType = (row: DictTypeItem) => {
  confirmDelete({
    title: t('dict.deleteTypeTitle'),
    content: t('dict.deleteTypeContent', { name: row.name }),
    onConfirm: async () => {
      await dictApi.typeRemove(row.id)
      uni.showToast({ title: t('dict.deleted'), icon: 'success' })
      typeTable.load()
      loadTypeOptions()
    },
  })
}

const removeData = (row: DictDataItem) => {
  confirmDelete({
    title: t('dict.deleteDataTitle'),
    content: t('dict.deleteDataContent', { label: row.label }),
    onConfirm: async () => {
      await dictApi.dataRemove(row.id)
      uni.showToast({ title: t('dict.deleted'), icon: 'success' })
      dataTable.load()
    },
  })
}

onLoad(() => {
  typeTable.load()
  loadTypeOptions().then(() => {
    if (typeOptions.value.length) {
      dataQuery.value.typeCode = typeOptions.value[0].value
    }
  })
})
</script>

<template>
  <app-layout
    :title="t('dict.title')"
    :breadcrumb="[t('common.system'), t('dict.title')]"
    :subtitle="t('dict.subtitle')"
  >
    <app-card padding="14">
      <view class="toolbar">
        <app-segmented v-model="tab" :options="tabOptions" @change="switchTab" />
        <view class="toolbar-left">
          <template v-if="tab === 'type'">
            <app-input
              v-model="typeQuery.keyword"
              :placeholder="t('dict.typeKeyword')"
              prefix-icon="search"
              clearable
              class="toolbar-input"
              @confirm="typeTable.search"
            />
            <app-select
              v-model="typeQuery.status"
              :options="statusOptions"
              :placeholder="t('common.allStatus')"
              class="toolbar-select"
              @change="typeTable.search"
            />
            <app-button icon="search" @click="typeTable.search">{{ t('common.query') }}</app-button>
            <app-button type="default" @click="resetTypeQuery">{{ t('common.reset') }}</app-button>
          </template>
          <template v-else>
            <app-select
              v-model="dataQuery.typeCode"
              :options="typeOptions"
              :placeholder="t('dict.selectType')"
              :title="t('dict.selectType')"
              class="toolbar-type"
              @change="dataTable.search"
            />
            <app-input
              v-model="dataQuery.keyword"
              :placeholder="t('dict.dataKeyword')"
              prefix-icon="search"
              clearable
              class="toolbar-input"
              @confirm="dataTable.search"
            />
            <app-button icon="search" @click="dataTable.search">{{ t('common.query') }}</app-button>
          </template>
        </view>
        <app-button
          v-if="user.hasPerm('system:dict:add')"
          icon="add"
          @click="tab === 'type' ? openTypeCreate() : openDataCreate()"
        >
          {{ tab === 'type' ? t('dict.addType') : t('dict.addData') }}
        </app-button>
      </view>
    </app-card>

    <!-- 字典类型 -->
    <app-card v-if="tab === 'type'" padding="0 0 14px">
      <app-table
        :columns="typeColumns"
        :data="typeTable.list.value"
        :loading="typeTable.loading.value"
        :empty-text="t('dict.typeEmpty')"
      >
        <template #cell-code="{ row }">
          <app-tag type="primary" size="sm">{{ row.code }}</app-tag>
        </template>

        <template #cell-status="{ row }">
          <view class="status-cell">
            <app-switch
              :model-value="row.status"
              :active-value="1"
              :inactive-value="0"
              @change="(value) => changeTypeStatus(row, value)"
            />
          </view>
        </template>

        <template #cell-remark="{ row }">
          <text class="remark-text">{{ row.remark || '—' }}</text>
        </template>

        <template #cell-actions="{ row }">
          <view class="action-cell">
            <app-button type="text" size="sm" icon="book" @click="openDataOfType(row)">
              {{ t('dict.items') }}
            </app-button>
            <app-button
              v-if="user.hasPerm('system:dict:edit')"
              type="text"
              size="sm"
              @click="openTypeEdit(row)"
            >
              {{ t('common.edit') }}
            </app-button>
            <app-button
              v-if="user.hasPerm('system:dict:remove')"
              type="text"
              size="sm"
              class="danger-text"
              @click="removeType(row)"
            >
              {{ t('common.remove') }}
            </app-button>
          </view>
        </template>
      </app-table>

      <view class="table-footer">
        <app-pagination
          :total="typeTable.total.value"
          :page-num="typeTable.pageNum.value"
          :page-size="typeTable.pageSize.value"
          @change="typeTable.changePage"
        />
      </view>
    </app-card>

    <!-- 字典数据 -->
    <app-card v-else padding="0 0 14px">
      <view class="data-head">
        <text class="data-head-title">{{ currentTypeName || t('dict.selectType') }}</text>
        <text class="data-head-tip">
          {{ t('dict.countTip', { count: dataTable.total.value }) }}
        </text>
      </view>

      <app-table
        :columns="dataColumns"
        :data="dataTable.list.value"
        :loading="dataTable.loading.value"
        :empty-text="t('dict.dataEmpty')"
      >
        <template #cell-label="{ row }">
          <view class="label-cell">
            <app-tag :type="row.tagType || 'info'" size="sm">{{ row.label }}</app-tag>
          </view>
        </template>

        <template #cell-value="{ row }">
          <text class="mono-text">{{ row.value }}</text>
        </template>

        <template #cell-tagType="{ row }">
          <text class="text-3">{{ row.tagType || t('dict.tagDefault') }}</text>
        </template>

        <template #cell-status="{ row }">
          <view class="status-cell">
            <app-switch
              :model-value="row.status"
              :active-value="1"
              :inactive-value="0"
              @change="(value) => changeDataStatus(row, value)"
            />
          </view>
        </template>

        <template #cell-actions="{ row }">
          <view class="action-cell">
            <app-button
              v-if="user.hasPerm('system:dict:edit')"
              type="text"
              size="sm"
              @click="openDataEdit(row)"
            >
              {{ t('common.edit') }}
            </app-button>
            <app-button
              v-if="user.hasPerm('system:dict:remove')"
              type="text"
              size="sm"
              class="danger-text"
              @click="removeData(row)"
            >
              {{ t('common.remove') }}
            </app-button>
          </view>
        </template>
      </app-table>

      <view class="table-footer">
        <app-pagination
          :total="dataTable.total.value"
          :page-num="dataTable.pageNum.value"
          :page-size="dataTable.pageSize.value"
          @change="dataTable.changePage"
        />
      </view>
    </app-card>

    <!-- 类型表单 -->
    <app-dialog
      v-model:visible="typeDialog"
      :title="typeDialogTitle"
      :loading="typeSubmitting"
      @confirm="submitType"
    >
      <view class="form-grid">
        <app-field :label="t('dict.typeName')" required>
          <app-input v-model="typeForm.name" :placeholder="t('dict.typeNamePlaceholder')" />
        </app-field>
        <app-field :label="t('dict.typeCode')" required>
          <app-input v-model="typeForm.code" :placeholder="t('dict.typeCodePlaceholder')" />
        </app-field>
      </view>
      <app-field :label="t('common.remark')">
        <app-input
          v-model="typeForm.remark"
          textarea
          :min-height="64"
          :placeholder="t('dict.remarkPlaceholder')"
        />
      </app-field>
      <app-field :label="t('common.status')">
        <view class="inline-switch">
          <app-switch v-model="typeForm.status" :active-value="1" :inactive-value="0" />
          <text class="switch-hint">
            {{ typeForm.status === 1 ? t('common.enabled') : t('common.disabled') }}
          </text>
        </view>
      </app-field>
      <view v-if="typeFormError" class="form-error">
        <app-icon name="warning" :size="13" color="#f5455c" />
        <text class="form-error-text">{{ typeFormError }}</text>
      </view>
    </app-dialog>

    <!-- 数据表单 -->
    <app-dialog
      v-model:visible="dataDialog"
      :title="dataDialogTitle"
      :loading="dataSubmitting"
      @confirm="submitData"
    >
      <view class="form-grid">
        <app-field :label="t('dict.dataLabel')" required>
          <app-input v-model="dataForm.label" :placeholder="t('dict.labelPlaceholder')" />
        </app-field>
        <app-field :label="t('dict.dataValue')">
          <app-input v-model="dataForm.value" :placeholder="t('dict.valuePlaceholder')" />
        </app-field>
        <app-field :label="t('common.sort')">
          <app-input v-model="dataForm.sort" type="number" />
        </app-field>
        <app-field :label="t('common.tagType')">
          <app-select
            v-model="dataForm.tagType"
            :options="tagTypeOptions"
            :title="t('dict.tagTitle')"
          />
        </app-field>
      </view>
      <app-field :label="t('common.status')">
        <view class="inline-switch">
          <app-switch v-model="dataForm.status" :active-value="1" :inactive-value="0" />
          <text class="switch-hint">
            {{ dataForm.status === 1 ? t('common.enabled') : t('common.disabled') }}
          </text>
        </view>
      </app-field>
      <view v-if="dataFormError" class="form-error">
        <app-icon name="warning" :size="13" color="#f5455c" />
        <text class="form-error-text">{{ dataFormError }}</text>
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
  flex: 1;
}

.toolbar-input {
  width: 220px;
}

.toolbar-select {
  width: 130px;
}

.toolbar-type {
  width: 220px;
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

.label-cell {
  flex-direction: row;
  align-items: center;
}

.mono-text {
  font-size: var(--app-font-sm);
  color: var(--app-text-3);
  font-family: Menlo, Consolas, monospace;
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

.data-head {
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 14px 16px 10px;
}

.data-head-title {
  font-size: var(--app-font);
  font-weight: 600;
  color: var(--app-text);
}

.data-head-tip {
  font-size: var(--app-font-xs);
  color: var(--app-text-3);
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
  .toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .toolbar-left {
    flex-direction: row;
    flex-wrap: wrap;
    width: 100%;
  }
  .toolbar-input,
  .toolbar-select,
  .toolbar-type {
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
