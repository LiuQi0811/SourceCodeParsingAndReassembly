import { expect, type Page } from '@playwright/test'

/** 清空本地存储后回到登录页，保证每个用例从同一份 Mock 种子数据开始 */
export async function resetApp(page: Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.goto('/#/pages/login/index')
  // hash 跳转不会重建应用，必须 reload 才能让 pinia 丢掉内存里的登录态
  await page.reload()
  await expect(page.locator('.login-page')).toBeVisible()
}

/**
 * uni-app 的 input 不带 placeholder 属性，占位文案在同级的 .uni-input-placeholder 里，
 * 所以按「容器 + 占位文案」定位到真实 input
 */
export function field(page: Page, scope: string, placeholder: string) {
  return page.locator(`${scope} .app-input`, { hasText: placeholder }).locator('input').first()
}

/** 演示账号登录，密码固定 123456 */
export async function login(page: Page, username: string, password = '123456') {
  await field(page, '.login-panel', '请输入账号').fill(username)
  await field(page, '.login-panel', '请输入密码').fill(password)
  await page.locator('.app-btn', { hasText: '登 录' }).first().click()
  await expect(page).toHaveURL(/pages\/home\/index/, { timeout: 20000 })
  await expect(page.locator('.app-layout')).toBeVisible()
}

/** 打开头像菜单里的某一项 */
export async function openUserMenu(page: Page, label: string) {
  await page.locator('.user-chip').first().click()
  await page.locator('.popover-item', { hasText: label }).first().click()
}

/** 从头像菜单切语言：English ↔ 简体中文，切完等首页文案变过去 */
export async function switchLocale(page: Page, target: 'English' | '简体中文') {
  await openUserMenu(page, target === 'English' ? '语言 / Language' : 'Language')
  const panel = page.locator('.dialog-panel')
  await panel.getByText(target, { exact: true }).click()
  await panel.locator('.app-btn', { hasText: target === 'English' ? '完成' : 'Done' }).click()
  await expect(page.getByText(target === 'English' ? 'Dashboard' : '工作台').first()).toBeVisible({
    timeout: 15000,
  })
  // reLaunch 之后 uni 还会再挂载一次页面；马上点开弹窗会被这次重挂载冲掉，等它稳定
  await expect(page.locator('.app-layout')).toHaveCount(1)
  await page.waitForTimeout(400)
}

/** 读取 AppLayout 根节点上的主题 class */
export async function layoutClass(page: Page) {
  return (await page.locator('.app-layout').getAttribute('class')) || ''
}
