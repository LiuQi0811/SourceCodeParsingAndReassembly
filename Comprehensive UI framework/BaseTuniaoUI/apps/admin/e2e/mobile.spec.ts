import { expect, test } from '@playwright/test'
import { layoutClass, login, openUserMenu, resetApp } from './helpers'

/**
 * 窄屏（660×570，命中 <768 的 mobile 断点）布局回归：
 * 抽屉菜单、顶栏标题、卡片列表、收起昵称的头像菜单。
 */
test.describe('移动端布局', () => {
  test('登录后不渲染侧边栏，顶栏用页面标题代替面包屑', async ({ page }) => {
    await resetApp(page)
    await login(page, 'admin')

    await expect(page.locator('.app-layout')).toHaveClass(/theme-light/)
    await expect(page.locator('.sidebar')).toHaveCount(0)
    await expect(page.locator('.drawer')).toHaveCount(1)
    await expect(page.locator('.breadcrumb')).toHaveCount(0)
    await expect(page.locator('.header-title')).toBeVisible()
  })

  test('顶栏菜单按钮打开抽屉，点菜单项跳转并自动收起', async ({ page }) => {
    await resetApp(page)
    await login(page, 'admin')

    const drawer = page.locator('.drawer')
    await expect(drawer).not.toHaveClass(/is-open/)

    await page.locator('.header-left .header-icon-btn').click()
    await expect(drawer).toHaveClass(/is-open/)
    await expect(page.locator('.drawer-mask')).toBeVisible()

    await page.locator('.drawer .side-menu .menu-item', { hasText: '用户管理' }).first().click()
    await expect(page).toHaveURL(/pages\/system\/user\/index/)
    await expect(drawer).not.toHaveClass(/is-open/)
    await expect(page.locator('.header-title')).toHaveText('用户管理')
  })

  test('用户列表在窄屏渲染为卡片而非表格', async ({ page }) => {
    await resetApp(page)
    await login(page, 'admin')
    await page.goto('/#/pages/system/user/index')
    await expect(page.locator('.header-title')).toHaveText('用户管理', { timeout: 15000 })

    await expect(page.locator('.table-wrap')).toHaveCount(0)
    await expect(page.locator('.table-cards .data-card').first()).toBeVisible()
    await expect(
      page.locator('.table-cards .data-card').first().locator('.card-actions .app-btn').first()
    ).toBeVisible()
  })

  test('头像菜单在窄屏收起昵称，仍能打开主题面板切深色', async ({ page }) => {
    await resetApp(page)
    await login(page, 'admin')
    await expect(page.locator('.user-meta')).toHaveCount(0)

    await openUserMenu(page, '主题外观')
    const panel = page.locator('.dialog-panel')
    await expect(panel.locator('.dialog-title')).toHaveText('主题外观')
    await panel.locator('.app-segmented', { hasText: '深色' }).getByText('深色').click()
    await panel.locator('.app-btn', { hasText: '完成' }).click()

    expect(await layoutClass(page)).toContain('theme-dark')
    expect(await page.evaluate(() => localStorage.getItem('BTN_theme'))).toBe(
      JSON.stringify('dark')
    )
  })
})
