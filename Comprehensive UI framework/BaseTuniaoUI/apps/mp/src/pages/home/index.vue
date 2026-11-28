<template>
  <view v-if="loading" class="loading">
    <text class="loading-text">加载中...</text>
  </view>
  <view v-else class="home">
    <DecoRenderer :page="page" @jump="handleJump" />

    <view v-if="pageList.length > 1" class="page-switch" @click="showPagePanel = true">
      装修页面 {{ pageList.length }}
    </view>

    <view v-if="showPagePanel" class="page-mask" @click="showPagePanel = false">
      <view class="page-panel" @click.stop>
        <view class="panel-head">
          <text class="panel-title">装修页面</text>
          <text class="panel-close" @click="showPagePanel = false">×</text>
        </view>
        <scroll-view scroll-y class="panel-list">
          <view
            v-for="item in pageList"
            :key="item.id"
            class="panel-item"
            :class="{ active: item.id === currentPageId }"
            @click="switchPage(item)"
          >
            <text class="item-title">{{ item.title }}</text>
            <text v-if="item.isHome" class="item-tag">首页</text>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { createDemoPage, validateDecoPage, type DecoPage } from "@/deco";
import DecoRenderer from "@/deco/DecoRenderer.vue";
import {
  fetchDecoPage,
  fetchDecoPages,
  fetchHomePage,
  type DecoPageSummary,
} from "@/api/deco";

const page = ref<DecoPage>(createDemoPage());
const loading = ref(true);
const pageList = ref<DecoPageSummary[]>([]);
const currentPageId = ref("home");
const showPagePanel = ref(false);

onLoad(async (options) => {
  const pageId = typeof options?.pageId === "string" ? options.pageId : "";
  currentPageId.value = pageId || "home";
  page.value = pageId ? await fetchDecoPage(pageId) : await fetchHomePage();
  const result = validateDecoPage(page.value);
  if (!result.valid) {
    console.warn("[deco] 装修数据不合法：", result.message);
    page.value = createDemoPage();
  }
  uni.setNavigationBarTitle({ title: page.value.title || "首页" });
  loading.value = false;

  pageList.value = await fetchDecoPages();
});

const switchPage = (item: DecoPageSummary) => {
  showPagePanel.value = false;
  if (item.id === currentPageId.value) return;
  uni.reLaunch({
    url: `/pages/home/index?pageId=${item.id}`,
    fail: () => uni.showToast({ title: "页面切换失败", icon: "none" }),
  });
};

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

.home {
  min-height: 100vh;
}

.page-switch {
  position: fixed;
  left: 24rpx;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
  z-index: 20;
  display: flex;
  align-items: center;
  height: 64rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: rgba(17, 24, 39, 0.82);
  color: #ffffff;
  font-size: 24rpx;
  box-shadow: 0 6rpx 20rpx rgba(17, 24, 39, 0.24);
}

.page-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 30;
  display: flex;
  align-items: flex-end;
  background: rgba(17, 24, 39, 0.45);
}

.page-panel {
  width: 100%;
  max-height: 70vh;
  padding: 8rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
  border-radius: 28rpx 28rpx 0 0;
  background: #ffffff;
  box-sizing: border-box;
}

.panel-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
}

.panel-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #111827;
}

.panel-close {
  font-size: 40rpx;
  line-height: 1;
  color: #98a2b3;
}

.panel-list {
  max-height: 55vh;
}

.panel-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  border-bottom: 1rpx solid #f2f4f7;
}

.panel-item.active .item-title {
  color: #01beff;
  font-weight: 600;
}

.item-title {
  font-size: 28rpx;
  color: #344054;
}

.item-tag {
  padding: 2rpx 12rpx;
  border-radius: 8rpx;
  background: #ecf9ff;
  color: #01beff;
  font-size: 22rpx;
}
</style>
