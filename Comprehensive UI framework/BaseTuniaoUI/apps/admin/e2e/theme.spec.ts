import { expect, test } from '@playwright/test'
import { field, layoutClass, login, openUserMenu, resetApp, switchLocale } from './helpers'

test.describe('主题外观与语言', () => {
  test('切换深色后根节点 class 与本地存储同步', async ({ page }) => {
    await resetApp(page)
    await login(page, 'admin')
    await openUserMenu(page, '主题外观')

    const panel = page.locator('.dialog-panel')
    await expect(panel.locator('.dialog-title')).toHaveText('主题外观')
    await panel.locator('.app-segmented', { hasText: '深色' }).getByText('深色').click()
    await panel.locator('.app-btn', { hasText: '完成' }).click()

    await expect(page.locator('.app-layout')).toHaveClass(/theme-dark/)
    const saved = await page.evaluate(() => localStorage.getItem('BTN_theme'))
    expect(saved).toBe(JSON.stringify('dark'))
  })

  test('紧凑密度与大圆角可以叠加生效', async ({ page }) => {
    await resetApp(page)
    await login(page, 'admin')
    await openUserMenu(page, '主题外观')

    const panel = page.locator('.dialog-panel')
    await panel.getByText('紧凑', { exact: true }).click()
    await panel.getByText('大', { exact: true }).click()
    await panel.locator('.app-btn', { hasText: '完成' }).click()

    const cls = await layoutClass(page)
    expect(cls).toContain('density-compact')
    expect(cls).toContain('radius-large')
    expect(await page.evaluate(() => localStorage.getItem('BTN_density'))).toBe(
      JSON.stringify('compact')
    )
  })

  test('切换英文后页面文案变英文，再切回中文', async ({ page }) => {
    await resetApp(page)
    await login(page, 'admin')
    await openUserMenu(page, '语言 / Language')

    const panel = page.locator('.dialog-panel')
    await panel.getByText('English', { exact: true }).click()
    await panel.locator('.app-btn', { hasText: '完成' }).click()

    await expect(page.getByText('Dashboard').first()).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.app-layout')).toContainText('Users')
    // 菜单名、角色名、日志模块/动作都来自 Mock，切英文后应一起变英文
    await expect(page.locator('.side-menu .item-text', { hasText: 'Operation Logs' })).toBeVisible()
    await expect(page.locator('.user-role')).toHaveText('Super Admin')
    await expect(page.locator('.recent-list').first()).toContainText('Sign-in')

    await openUserMenu(page, 'Language')
    const panel2 = page.locator('.dialog-panel')
    await panel2.getByText('简体中文', { exact: true }).click()
    await panel2.locator('.app-btn', { hasText: 'Done' }).click()

    await expect(page.getByText('工作台').first()).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.app-layout')).toContainText('用户总数')
    await expect(page.locator('.side-menu .item-text', { hasText: '操作日志' })).toBeVisible()
    await expect(page.locator('.user-role')).toHaveText('超级管理员')
  })

  test('英文环境下列表页的部门名与角色名同步翻译', async ({ page }) => {
    await resetApp(page)
    await login(page, 'admin')
    await openUserMenu(page, '语言 / Language')

    const panel = page.locator('.dialog-panel')
    await panel.getByText('English', { exact: true }).click()
    await panel.locator('.app-btn', { hasText: '完成' }).click()
    await expect(page.getByText('Dashboard').first()).toBeVisible({ timeout: 15000 })

    await page.goto('/#/pages/system/user/index')
    await expect(page.locator('.page-title')).toHaveText('Users', { timeout: 15000 })

    const table = page.locator('.app-table')
    await expect(table.getByText('R&D Department').first()).toBeVisible()
    await expect(table.getByText('System Admin', { exact: true }).first()).toBeVisible()
    // 账号、昵称属于业务录入值，不做翻译
    await expect(table.getByText('唐一', { exact: true }).first()).toBeVisible()
  })

  test('英文环境下重复账号拿到英文错误提示', async ({ page }) => {
    await resetApp(page)
    await login(page, 'admin')
    await switchLocale(page, 'English')

    await page.goto('/#/pages/system/user/index')
    await expect(page.locator('.page-title')).toHaveText('Users', { timeout: 15000 })
    await page.locator('.app-btn', { hasText: 'New user' }).click()

    const dialog = '.dialog-panel'
    await field(page, dialog, 'e.g. zhangsan').fill('admin')
    await field(page, dialog, 'Real name or nickname').fill('Duplicate')
    await page.locator(`${dialog} .dialog-footer .app-btn`, { hasText: 'OK' }).click()

    await expect(page.getByText('Username already exists').first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator(`${dialog} .form-error`)).toHaveText('Username already exists')
  })
})
