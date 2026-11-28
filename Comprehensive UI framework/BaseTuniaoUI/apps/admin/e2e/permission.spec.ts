import { expect, test } from '@playwright/test'
import { login, resetApp } from './helpers'

test.describe('权限拦截', () => {
  test('chenmo 没有菜单管理权限，打开即落到无权限页', async ({ page }) => {
    await resetApp(page)
    await login(page, 'chenmo')
    await page.goto('/#/pages/system/menu/index')
    await expect(page.getByText('无访问权限')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('重新加载')).toBeVisible()
  })

  test('zhouye 没有用户管理权限', async ({ page }) => {
    await resetApp(page)
    await login(page, 'zhouye')
    await page.goto('/#/pages/system/user/index')
    await expect(page.getByText('无访问权限')).toBeVisible({ timeout: 15000 })
  })

  test('admin 有用户管理权限，能看到新增按钮', async ({ page }) => {
    await resetApp(page)
    await login(page, 'admin')
    await page.goto('/#/pages/system/user/index')
    await expect(page.getByText('用户管理').first()).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.app-btn', { hasText: '新增用户' })).toBeVisible()
  })
})
