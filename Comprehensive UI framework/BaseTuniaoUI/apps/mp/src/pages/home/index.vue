<template>
  <view v-if="loading" class="loading">
    <text class="loading-text">加载中...</text>
  </view>
  <DecoRenderer v-else :page="page" @jump="handleJump" />
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { createDemoPage, validateDecoPage, type DecoPage } from "@/deco";
import DecoRenderer from "@/deco/DecoRenderer.vue";
import { fetchDecoPage, fetchHomePage } from "@/api/deco";

const page = ref<DecoPage>(createDemoPage());
const loading = ref(true);

onLoad(async (options) => {
  const pageId = typeof options?.pageId === "string" ? options.pageId : "";
  page.value = pageId ? await fetchDecoPage(pageId) : await fetchHomePage();
  const result = validateDecoPage(page.value);
  if (!result.valid) {
    console.warn("[deco] 装修数据不合法：", result.message);
    page.value = createDemoPage();
  }
  uni.setNavigationBarTitle({ title: page.value.title || "首页" });
  loading.value = false;
});

const handleJump = (link?: string) => {
  if (!link) return;
  if (/^https?:/.test(link)) {
    uni.setClipboardData({ data: link });
    uni.showToast({ title: "链接已复制", icon: "none" });
    return;
  }
  uni.navigateTo({
    url: link,
    fail: () => uni.showToast({ title: "页面未开放", icon: "none" }),
  });
};
</script>

<style lang="scss" scoped>
page {
  background: #f5f7fa;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60vh;
}

.loading-text {
  font-size: 13px;
  color: #98a2b3;
}
</style>
