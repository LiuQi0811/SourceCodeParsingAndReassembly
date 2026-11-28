import { expect, test } from '@playwright/test'
import { field, login, resetApp } from './helpers'

test.describe('登录与会话', () => {
  test('未登录直接访问受保护页面会落回登录页', async ({ page }) => {
    await resetApp(page)
    await page.goto('/#/pages/system/user/index')
    await page.reload()
    await expect(page.locator('.login-page')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('用户管理')).toHaveCount(0)
  })

  test('空账号提交时提示必填', async ({ page }) => {
    await resetApp(page)
    // 登录页默认预填 admin / 123456，这里先清空账号
    await field(page, '.login-panel', '请输入账号').fill('')
    await page.locator('.app-btn', { hasText: '登 录' }).first().click()
    await expect(page.locator('.form-error')).toHaveText('请输入账号')
  })

  test('密码错误时在表单内提示失败原因', async ({ page }) => {
    await resetApp(page)
    await field(page, '.login-panel', '请输入账号').fill('admin')
    await field(page, '.login-panel', '请输入密码').fill('wrong-pass')
    await page.locator('.app-btn', { hasText: '登 录' }).first().click()
    await expect(page.locator('.form-error')).toHaveText('账号或密码错误')
    await expect(page.locator('.login-page')).toBeVisible()
  })

  test('admin 登录后进入工作台并能读到汇总数据', async ({ page }) => {
    await resetApp(page)
    await login(page, 'admin')
    await expect(page).toHaveURL(/pages\/home\/index/)
    await expect(page.getByText('用户总数')).toBeVisible()
  })
})
