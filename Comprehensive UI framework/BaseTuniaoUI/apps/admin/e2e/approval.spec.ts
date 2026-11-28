import { expect, test } from '@playwright/test'
import { login, openUserMenu, resetApp } from './helpers'

/** 等当前账号退出并回到登录页，便于同一用例验证编辑提交、管理员审批的职责分离 */
async function logout(page: Parameters<typeof login>[0]) {
  await openUserMenu(page, '退出登录')
  await page.locator('.uni-modal').getByText('确定', { exact: true }).click()
  await expect(page.locator('.login-page')).toBeVisible()
}

async function publishedTitle(page: Parameters<typeof login>[0]) {
  return page.evaluate(() => {
    const pages = JSON.parse(localStorage.getItem('BTN_deco_pages') || '[]') as Array<{
      published?: { title?: string }
    }>
    return pages[0]?.published?.title || ''
  })
}

test.describe('发布审批流', () => {
  test('编辑提交审核，管理员通过后按提交快照上线', async ({ page }) => {
    await resetApp(page)
    await login(page, 'chenmo')
    await page.goto('/#/pages/operation/deco/index')
    await expect(page.locator('.page-select .select-text')).toContainText('图鸟商城')

    // 编辑账号不能直接发布，只能提交审核
    await expect(page.locator('.app-layout .app-btn').filter({ hasText: /^发布$/ })).toHaveCount(0)
    await page.locator('.meta-card .app-input input').first().fill('待审版')
    await page.locator('.app-layout .app-btn', { hasText: '提交审核' }).click()
    await expect(page.getByText('已提交审核').first()).toBeVisible()

    const queue = page.locator('.aux-panel', { hasText: '发布审批' })
    await expect(queue.locator('.approval-row').first()).toContainText('待审核')
    await expect(queue.locator('.approval-row').first()).toContainText('陈默')

    await logout(page)
    await login(page, 'admin')
    await page.goto('/#/pages/operation/deco/index')
    await expect(page.locator('.page-select .select-text')).toContainText('待审版')

    const queueButton = page.locator('.page-bar .app-btn', { hasText: '发布审批' })
    await expect(queueButton).toContainText('1')
    await queueButton.click()

    const panel = page.locator('.aux-panel', { hasText: '发布审批' })
    const row = panel.locator('.approval-row').first()
    await expect(row).toContainText('待审核')
    await row.locator('.app-btn', { hasText: '通过并发布' }).click()
    const modal = page.locator('.uni-modal')
    await expect(modal).toContainText('按提交时的页面快照发布')
    await modal.getByText('通过并发布', { exact: true }).click()
    await expect(page.getByText('已通过并发布').first()).toBeVisible()

    await expect(row).toContainText('已通过')
    await expect(row).toContainText('刘奇')
    expect(await publishedTitle(page)).toBe('待审版')

    await page.locator('.page-bar .app-btn', { hasText: '操作日志' }).click()
    const auditPanel = page.locator('.aux-panel', { hasText: '操作日志' })
    await expect(auditPanel.locator('.aux-row').first()).toContainText('审批通过并发布')
  })

  test('管理员驳回后线上保持原版本，并记录驳回原因', async ({ page }) => {
    await resetApp(page)
    await login(page, 'chenmo')
    await page.goto('/#/pages/operation/deco/index')
    await expect(page.locator('.page-select .select-text')).toContainText('图鸟商城')

    await page.locator('.meta-card .app-input input').first().fill('待驳回版')
    await page.locator('.app-layout .app-btn', { hasText: '提交审核' }).click()
    await expect(page.getByText('已提交审核').first()).toBeVisible()

    await logout(page)
    await login(page, 'admin')
    await page.goto('/#/pages/operation/deco/index')
    const queueButton = page.locator('.page-bar .app-btn', { hasText: '发布审批' })
    await expect(queueButton).toContainText('1')
    await queueButton.click()
    const publishedBefore = await publishedTitle(page)

    const panel = page.locator('.aux-panel', { hasText: '发布审批' })
    const row = panel.locator('.approval-row').first()
    await row.locator('.app-btn', { hasText: '驳回' }).click()
    const modal = page.locator('.uni-modal')
    await expect(modal).toContainText('编辑可以修改后重新提交')
    await modal.getByText('驳回', { exact: true }).click()
    await expect(page.getByText('已驳回').first()).toBeVisible()

    await expect(row).toContainText('已驳回')
    await expect(row).toContainText('内容未通过审核')
    expect(await publishedTitle(page)).toBe(publishedBefore)
    await expect(page.locator('.preview-head')).toContainText(
      publishedBefore ? '最近发布' : '尚未发布'
    )

    await page.locator('.page-bar .app-btn', { hasText: '操作日志' }).click()
    const auditPanel = page.locator('.aux-panel', { hasText: '操作日志' })
    await expect(auditPanel.locator('.aux-row').first()).toContainText('驳回发布审核')
  })
})
