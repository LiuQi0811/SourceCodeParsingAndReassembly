<script lang="ts" setup>
import {
  APP_CATEGORIES,
  APP_STATUSES,
  appListStore,
  createEmptyDraft,
  isDraftValid,
  statusLabel,
  toAppInput,
  validateAppDraft,
  type AppCategory,
  type AppDraft,
  type AppDraftErrors,
  type AppStatus,
} from '@tdesignui/core';

// 校验规则、文案、错误判定全部来自 core，页面只负责把错误贴到对应输入框上
const draft = ref<AppDraft>(createEmptyDraft());
const errors = ref<AppDraftErrors>({});
const attempted = ref(false);
const createdText = ref('');

// 没点过提交就不提前报错，避免一进页面满屏红字
const shown = computed(() => (attempted.value ? errors.value : {}));

function revalidate() {
  errors.value = validateAppDraft(draft.value, appListStore.names());
}

function onEdit() {
  createdText.value = '';
  if (attempted.value) revalidate();
}

function pickCategory(value: AppCategory) {
  draft.value = { ...draft.value, category: value };
  onEdit();
}

function pickStatus(value: AppStatus) {
  draft.value = { ...draft.value, status: value };
  onEdit();
}

function submit() {
  attempted.value = true;
  revalidate();
  if (!isDraftValid(errors.value)) return;

  // 共享单例：写入后列表页订阅会立刻收到新快照
  const item = appListStore.addApp(toAppInput(draft.value));
  createdText.value = `已创建「${item.name}」（${item.id}），更新于 ${item.updatedAt}`;
  draft.value = createEmptyDraft();
  attempted.value = false;
  errors.value = {};
}

function resetForm() {
  draft.value = createEmptyDraft();
  errors.value = {};
  attempted.value = false;
  createdText.value = '';
}
</script>

<template>
  <div class="tds-page">
    <header class="tds-hero--left">
      <h1>新建应用</h1>
      <p>校验规则与错误文案全部来自 @tdesignui/core，两端共用同一套判定</p>
    </header>

    <div class="tds-stack">
      <t-card :bordered="true" title="应用信息">
        <t-space direction="vertical" size="16px" style="width: 100%">
          <t-input
            v-model="draft.name"
            label="应用名"
            placeholder="2-20 个字，不能与已有应用重名"
            clearable
            :status="shown.name ? 'error' : 'default'"
            :tips="shown.name || '应用名必填，2-20 个字'"
            @change="onEdit"
          />

          <t-input
            v-model="draft.owner"
            label="负责人"
            placeholder="最多 10 个字"
            clearable
            :status="shown.owner ? 'error' : 'default'"
            :tips="shown.owner || '填写实际负责人，列表页会展示'"
            @change="onEdit"
          />

          <div class="tds-field">
            <span class="tds-field-label">分类</span>
            <t-space align="center" size="8px" break-line>
              <t-tag
                v-for="item in APP_CATEGORIES"
                :key="item"
                :theme="draft.category === item ? 'primary' : 'default'"
                :variant="draft.category === item ? 'light' : 'outline'"
                class="tds-pickable"
                @click="pickCategory(item)"
              >
                {{ item }}
              </t-tag>
            </t-space>
            <span v-if="shown.category" class="tds-field-error">{{ shown.category }}</span>
          </div>

          <div class="tds-field">
            <span class="tds-field-label">状态</span>
            <t-space align="center" size="8px" break-line>
              <t-tag
                v-for="item in APP_STATUSES"
                :key="item"
                :theme="draft.status === item ? 'primary' : 'default'"
                :variant="draft.status === item ? 'light' : 'outline'"
                class="tds-pickable"
                @click="pickStatus(item)"
              >
                {{ statusLabel(item) }}
              </t-tag>
            </t-space>
            <span v-if="shown.status" class="tds-field-error">{{ shown.status }}</span>
          </div>

          <t-space align="center">
            <t-button theme="primary" @click="submit">创建应用</t-button>
            <t-button theme="default" variant="outline" @click="resetForm">清空</t-button>
            <span class="tds-hint"> 点提交后才会显示错误，修改内容会实时重新校验 </span>
          </t-space>

          <t-alert v-if="createdText" theme="success" :message="createdText" />
          <router-link v-if="createdText" to="/apps" class="tds-hint tds-link-inline">
            去应用列表查看 →
          </router-link>
        </t-space>
      </t-card>

      <t-card :bordered="true" title="规则速览">
        <t-space direction="vertical" size="8px">
          <span class="tds-hint"
            >应用名：必填，2-20 个字，不能与现有应用重名（忽略首尾空格与大小写）</span
          >
          <span class="tds-hint">负责人：必填，最多 10 个字</span>
          <span class="tds-hint">分类与状态：必须取自 core 提供的合法取值</span>
        </t-space>
      </t-card>
    </div>
  </div>
</template>
