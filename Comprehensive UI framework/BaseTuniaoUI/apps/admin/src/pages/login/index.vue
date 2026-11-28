<script lang="ts" setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { appConfig } from '@/config'
import { useAppStore } from '@/store/modules/app'
import { useUserStore } from '@/store/modules/user'
import { setLocale, type LocaleKey } from '@/locales'
import AppField from '@/components/ui/AppField.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const app = useAppStore()
const user = useUserStore()
const { t, locale } = useI18n()

/** 登录页也要能切语言：未登录时进不去用户菜单 */
const toggleLang = () => {
  const next: LocaleKey = locale.value === 'zh-CN' ? 'en-US' : 'zh-CN'
  setLocale(next)
  uni.reLaunch({ url: '/pages/login/index' })
}

const form = ref({
  username: 'admin',
  password: '123456',
})
const loading = ref(false)
const errorMessage = ref('')

const isMobile = computed(() => app.isMobile)

const quickAccounts = computed(() => [
  { username: 'admin', label: t('login.quickAdmin'), desc: t('login.quickAdminDesc') },
  { username: 'chenmo', label: t('login.quickSystem'), desc: t('login.quickSystemDesc') },
  { username: 'zhouye', label: t('login.quickOps'), desc: t('login.quickOpsDesc') },
])

const features = computed(() => [
  t('login.feature1'),
  t('login.feature2'),
  t('login.feature3'),
  t('login.feature4'),
])

const fillAccount = (username: string) => {
  form.value.username = username
  form.value.password = '123456'
  errorMessage.value = ''
}

const handleLogin = async () => {
  if (loading.value) return
  errorMessage.value = ''

  if (!form.value.username) {
    errorMessage.value = t('login.requiredAccount')
    return
  }
  if (!form.value.password) {
    errorMessage.value = t('login.requiredPassword')
    return
  }

  loading.value = true
  try {
    await user.login({ username: form.value.username.trim(), password: form.value.password })
    uni.reLaunch({ url: '/pages/home/index' })
  } catch (e) {
    // 请求层已统一 toast，这里只保留表单内提示
    const error = e as Error
    errorMessage.value = error.message || t('login.failed')
  } finally {
    loading.value = false
  }
}

onLoad(async () => {
  app.initResponsive()
  if (!user.isLogin) return
  try {
    await user.fetchProfile()
    uni.reLaunch({ url: '/pages/home/index' })
  } catch (e) {
    await user.logout(true)
  }
})
</script>

<template>
  <view class="login-page" :class="app.themeClass">
    <view class="lang-switch" @tap="toggleLang">
      {{ locale === 'zh-CN' ? 'EN' : '中文' }}
    </view>
    <view class="login-panel">
      <!-- 左侧品牌区（桌面端显示） -->
      <view v-if="!isMobile" class="brand-side">
        <view class="brand-top">
          <view class="brand-logo">
            <app-icon name="logo-tuniao" :size="26" color="#ffffff" />
          </view>
          <text class="brand-name">{{ appConfig.appName }}</text>
        </view>

        <text class="brand-title">{{ t('login.title') }}</text>
        <text class="brand-desc">{{ t('login.desc') }}</text>

        <view class="feature-list">
          <view v-for="item in features" :key="item" class="feature-item">
            <view class="feature-dot">
              <app-icon name="check" :size="11" color="var(--app-primary)" />
            </view>
            <text class="feature-text">{{ item }}</text>
          </view>
        </view>

        <view class="brand-footer">
          <text class="footer-text">Tuniao Admin Base · v1.0.0</text>
        </view>
      </view>

      <!-- 右侧表单区 -->
      <view class="form-side">
        <view v-if="isMobile" class="mobile-brand">
          <view class="brand-logo small">
            <app-icon name="logo-tuniao" :size="20" color="#ffffff" />
          </view>
          <text class="mobile-brand-name">{{ appConfig.appName }}</text>
        </view>

        <text class="form-title">{{ t('login.welcome') }}</text>
        <text class="form-desc">{{ t('login.welcomeDesc') }}</text>

        <view class="login-form">
          <app-field :label="t('login.account')">
            <app-input
              v-model="form.username"
              :placeholder="t('login.accountPlaceholder')"
              prefix-icon="my"
              @confirm="handleLogin"
            />
          </app-field>
          <app-field :label="t('login.password')">
            <app-input
              v-model="form.password"
              :placeholder="t('login.passwordPlaceholder')"
              password
              prefix-icon="lock"
              @confirm="handleLogin"
            />
          </app-field>
        </view>

        <text v-if="errorMessage" class="form-error">{{ errorMessage }}</text>

        <view class="login-btn">
          <app-button size="lg" block :loading="loading" @click="handleLogin">
            {{ t('login.submit') }}
          </app-button>
        </view>

        <view class="quick-box">
          <text class="quick-title">{{ t('login.quickTitle') }}</text>
          <view class="quick-list">
            <view
              v-for="item in quickAccounts"
              :key="item.username"
              class="quick-item"
              :class="{ 'is-active': form.username === item.username }"
              @tap="fillAccount(item.username)"
            >
              <text class="quick-label">{{ item.label }}</text>
              <text class="quick-desc">{{ item.username }} · {{ item.desc }}</text>
            </view>
          </view>
        </view>

        <view v-if="appConfig.useMock" class="env-badge">
          <app-icon name="notice" :size="12" color="#c77700" />
          <text class="env-text">{{ t('login.mockTip') }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--app-bg);
}

/* 浅色下保留品牌氛围渐变，深色下直接用中性底色 */
.login-page.theme-light {
  background: radial-gradient(circle at 12% 20%, #e6f9ff 0%, #f4f6fa 42%, #eef2f8 100%);
}

/* 未登录时也能切换界面语言 */
.lang-switch {
  position: absolute;
  top: 16px;
  right: 18px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--app-border);
  background: var(--app-card);
  font-size: var(--app-font-xs);
  color: var(--app-text-2);
  z-index: 3;
}

.login-panel {
  width: 100%;
  max-width: 980px;
  flex-direction: row;
  background: var(--app-card);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 18px 50px rgba(17, 31, 45, 0.12);
}

/* 品牌区 */
.brand-side {
  flex: 1.05;
  padding: 44px 40px;
  background: linear-gradient(150deg, #0a2233 0%, #0b4a6b 55%, #06718f 100%);
  justify-content: space-between;
  gap: 26px;
}

.brand-top {
  flex-direction: row;
  align-items: center;
  gap: 10px;
}

.brand-logo {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--app-primary), var(--app-primary-active));
  align-items: center;
  justify-content: center;
}

.brand-logo.small {
  width: 32px;
  height: 32px;
  border-radius: 9px;
}

.brand-name {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  letter-spacing: 1px;
}

.brand-title {
  font-size: 30px;
  font-weight: 700;
  color: #fff;
  line-height: 1.3;
  letter-spacing: 1px;
}

.brand-desc {
  font-size: var(--app-font-sm);
  color: rgba(255, 255, 255, 0.68);
  line-height: 1.8;
  max-width: 400px;
}

.feature-list {
  gap: 12px;
}

.feature-item {
  flex-direction: row;
  align-items: flex-start;
  gap: 10px;
}

.feature-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(var(--app-primary-rgb), 0.16);
  align-items: center;
  justify-content: center;
  flex: none;
  margin-top: 2px;
}

.feature-text {
  font-size: var(--app-font-sm);
  color: rgba(255, 255, 255, 0.82);
  line-height: 1.6;
  flex: 1;
}

.brand-footer {
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.footer-text {
  font-size: var(--app-font-xs);
  color: rgba(255, 255, 255, 0.45);
}

/* 表单区 */
.form-side {
  flex: 1;
  padding: 44px 44px 32px;
  justify-content: center;
}

.mobile-brand {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  margin-bottom: 18px;
}

.mobile-brand-name {
  font-size: var(--app-font-lg);
  font-weight: 600;
  color: var(--app-text);
}

.form-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--app-text);
  letter-spacing: 0.5px;
}

.form-desc {
  font-size: var(--app-font-sm);
  color: var(--app-text-3);
  margin-top: 8px;
  margin-bottom: 22px;
}

.login-form {
  gap: 4px;
}

.form-error {
  font-size: var(--app-font-sm);
  color: var(--app-danger);
  margin-top: 10px;
}

.login-btn {
  margin-top: 18px;
}

.quick-box {
  margin-top: 26px;
  padding-top: 18px;
  border-top: 1px dashed var(--app-border);
}

.quick-title {
  font-size: var(--app-font-xs);
  color: var(--app-text-3);
  margin-bottom: 10px;
}

.quick-list {
  gap: 8px;
}

.quick-item {
  padding: 8px 12px;
  border-radius: var(--app-radius-sm);
  border: 1px solid var(--app-border);
  background: var(--app-bg-2);
  gap: 2px;
}

.quick-item.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-weak-2);
}

.quick-label {
  font-size: var(--app-font-sm);
  color: var(--app-text-2);
  font-weight: 500;
}

.quick-item.is-active .quick-label {
  color: var(--app-primary);
}

.quick-desc {
  font-size: 11px;
  color: var(--app-text-3);
}

.env-badge {
  flex-direction: row;
  align-items: flex-start;
  gap: 6px;
  margin-top: 18px;
  padding: 8px 10px;
  border-radius: var(--app-radius-sm);
  background: var(--app-warning-weak);
}

.env-text {
  flex: 1;
  font-size: 11px;
  color: var(--app-warning);
  line-height: 1.5;
}

@media (max-width: 767px) {
  .login-page {
    padding: 16px;
  }
  .login-panel {
    flex-direction: column;
    border-radius: 16px;
  }
  .form-side {
    padding: 28px 20px 24px;
  }
  .form-title {
    font-size: 22px;
  }
}
</style>
