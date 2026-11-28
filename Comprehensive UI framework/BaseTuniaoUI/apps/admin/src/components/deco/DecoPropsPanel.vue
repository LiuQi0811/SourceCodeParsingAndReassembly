<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  getDecoComponentDefinition,
  type DecoComponent,
  type DecoListField,
  type DecoSimpleField,
} from '@btn/deco'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppButton from '@/components/ui/AppButton.vue'
import ImagePicker from '@/components/ui/ImagePicker.vue'

const props = defineProps<{ component: DecoComponent }>()
const emit = defineEmits<{ (e: 'request-asset', apply: (url: string) => void): void }>()

const { t } = useI18n()
const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

const definition = computed(() => getDecoComponentDefinition(props.component.type))
const simpleFields = computed<DecoSimpleField[]>(
  () => definition.value?.fields.filter((field) => field.kind !== 'list') as DecoSimpleField[]
)
const listFields = computed<DecoListField[]>(
  () => definition.value?.fields.filter((field) => field.kind === 'list') as DecoListField[]
)

const model = computed(() => props.component as unknown as Record<string, unknown>)

const asString = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value)
const readValue = (key: string): unknown => model.value[key]
const writeValue = (key: string, value: unknown) => {
  model.value[key] = value
}

const updateSimpleField = (field: DecoSimpleField, raw: string | number) => {
  if (field.kind === 'number') {
    const value = Number(raw)
    writeValue(field.key, Number.isFinite(value) ? value : 0)
    return
  }
  writeValue(field.key, String(raw))
}

const selectOptions = (field: DecoSimpleField) =>
  (field.options ?? []).map((option) => ({
    label: t(option.labelKey),
    value: option.value,
  }))

const onSelect = (field: DecoSimpleField, raw: unknown) => {
  const value = Array.isArray(raw) ? raw[0] : raw
  writeValue(field.key, value ?? '')
}

const getList = (field: DecoListField): Record<string, unknown>[] => {
  const value = model.value[field.key]
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : []
}

const canAdd = (field: DecoListField) => {
  const max = field.maxItems
  return max === undefined || getList(field).length < max
}

const canRemove = (field: DecoListField) => {
  const min = field.minItems ?? 0
  return getList(field).length > min
}

const addListItem = (field: DecoListField) => {
  if (!canAdd(field)) return
  getList(field).push(
    field.createItem({
      id: uid,
      t: (key) => String(t(key)),
    })
  )
}

const removeListItem = (field: DecoListField, index: number) => {
  if (!canRemove(field)) return
  getList(field).splice(index, 1)
}

const moveListItem = (field: DecoListField, index: number, offset: number) => {
  const list = getList(field)
  const target = index + offset
  if (target < 0 || target >= list.length) return
  const [item] = list.splice(index, 1)
  list.splice(target, 0, item)
}

const updateListItemField = (
  item: Record<string, unknown>,
  field: DecoSimpleField,
  raw: string | number
) => {
  if (field.kind === 'number') {
    const value = Number(raw)
    item[field.key] = Number.isFinite(value) ? value : 0
    return
  }
  item[field.key] = String(raw)
}

const requestSimpleAsset = (field: DecoSimpleField) => {
  emit('request-asset', (url: string) => updateSimpleField(field, url))
}

const requestListAsset = (item: Record<string, unknown>, field: DecoSimpleField) => {
  emit('request-asset', (url: string) => updateListItemField(item, field, url))
}
</script>

<template>
  <view class="deco-props">
    <view v-for="field in simpleFields" :key="field.key" class="prop-item">
      <text class="prop-label">{{ t(field.labelKey) }}</text>
      <image-picker
        v-if="field.kind === 'image'"
        asset-pickable
        :model-value="asString(readValue(field.key))"
        @update:model-value="updateSimpleField(field, $event)"
        @request-asset="requestSimpleAsset(field)"
      />
      <app-select
        v-else-if="field.kind === 'select'"
        :model-value="asString(readValue(field.key))"
        :options="selectOptions(field)"
        @update:model-value="onSelect(field, $event)"
      />
      <app-input
        v-else
        :model-value="asString(readValue(field.key))"
        :type="field.kind === 'number' ? 'number' : 'text'"
        :textarea="field.kind === 'textarea'"
        :min-height="70"
        :placeholder="field.placeholderKey ? t(field.placeholderKey) : ''"
        @update:model-value="updateSimpleField(field, $event)"
      />
    </view>

    <template v-for="field in listFields" :key="field.key">
      <view class="list-head">
        <text class="prop-label">{{ t(field.labelKey) }}</text>
        <text class="list-count">{{ getList(field).length }}</text>
      </view>

      <view
        v-for="(item, index) in getList(field)"
        :key="asString(item.id) || index"
        class="sub-block"
      >
        <view class="sub-head">
          <text class="sub-title">{{ t(field.labelKey) }} {{ index + 1 }}</text>
          <view class="sub-ops">
            <app-button
              type="text"
              size="sm"
              :disabled="index === 0"
              @click="moveListItem(field, index, -1)"
            >
              ↑
            </app-button>
            <app-button
              type="text"
              size="sm"
              :disabled="index === getList(field).length - 1"
              @click="moveListItem(field, index, 1)"
            >
              ↓
            </app-button>
            <app-button
              type="text"
              size="sm"
              icon="delete"
              :disabled="!canRemove(field)"
              @click="removeListItem(field, index)"
            />
          </view>
        </view>

        <view v-for="itemField in field.itemFields" :key="itemField.key" class="item-field">
          <text class="prop-label">{{ t(itemField.labelKey) }}</text>
          <image-picker
            v-if="itemField.kind === 'image'"
            asset-pickable
            :model-value="asString(item[itemField.key])"
            @update:model-value="updateListItemField(item, itemField, $event)"
            @request-asset="requestListAsset(item, itemField)"
          />
          <app-select
            v-else-if="itemField.kind === 'select'"
            :model-value="asString(item[itemField.key])"
            :options="selectOptions(itemField)"
            @update:model-value="
              updateListItemField(item, itemField, Array.isArray($event) ? $event[0] : $event)
            "
          />
          <app-input
            v-else
            :model-value="asString(item[itemField.key])"
            :type="itemField.kind === 'number' ? 'number' : 'text'"
            :textarea="itemField.kind === 'textarea'"
            :min-height="60"
            :placeholder="itemField.placeholderKey ? t(itemField.placeholderKey) : ''"
            @update:model-value="updateListItemField(item, itemField, $event)"
          />
        </view>
      </view>

      <app-button size="sm" plain block :disabled="!canAdd(field)" @click="addListItem(field)">
        + {{ t(field.addLabelKey) }}
      </app-button>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.deco-props {
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

.list-head {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-top: 2px;
}

.list-count {
  min-width: 18px;
  padding: 0 6px;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  color: var(--app-text-3);
  background: var(--app-bg);
  border: 1px solid var(--app-border);
  border-radius: 9px;
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

.sub-ops {
  flex-direction: row;
  align-items: center;
  gap: 2px;
}

.item-field {
  gap: 4px;
}
</style>
