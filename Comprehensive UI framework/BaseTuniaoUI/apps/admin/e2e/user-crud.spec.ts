import { expect, test } from '@playwright/test'
import { field, login, resetApp } from './helpers'

async function openUserPage(page: import('@playwright/test').Page) {
  await resetApp(page)
  await login(page, 'admin')
  await page.goto('/#/pages/system/user/index')
  await expect(page.getByText('用户管理').first()).toBeVisible({ timeout: 15000 })
  await page.locator('.app-btn', { hasText: '新增用户' }).click()
  await expect(page.locator('.dialog-panel')).toBeVisible()
}

test.describe('用户 CRUD 与表单校验', () => {
  test('空表单提交提示必填账号', async ({ page }) => {
    await openUserPage(page)
    await page.locator('.dialog-footer .app-btn', { hasText: '确定' }).click()
    await expect(page.locator('.dialog-panel .form-error')).toHaveText('请输入登录账号')
  })

  test('手机号格式不合法时拦在提交前', async ({ page }) => {
    await openUserPage(page)
    const dialog = '.dialog-panel'
    await field(page, dialog, '如 zhangsan').fill('e2e_phone')
    await field(page, dialog, '真实姓名或昵称').fill('E2E 手机号')
    await field(page, dialog, '11 位手机号').fill('13800')
    await page.locator(`${dialog} .dialog-footer .app-btn`, { hasText: '确定' }).click()
    await expect(page.locator(`${dialog} .form-error`)).toHaveText('手机号格式不正确')
  })

  test('新增成功后可在列表中检索到并删除', async ({ page }) => {
    await openUserPage(page)
    const dialog = '.dialog-panel'
    await field(page, dialog, '如 zhangsan').fill('e2e_crud')
    await field(page, dialog, '真实姓名或昵称').fill('E2E 测试用户')
    await field(page, dialog, '11 位手机号').fill('13900001111')
    await page.locator(`${dialog} .dialog-footer .app-btn`, { hasText: '确定' }).click()

    await expect(page.getByText('新增成功')).toBeVisible({ timeout: 10000 })
    await expect(page.locator(dialog)).toBeHidden()

    await field(page, '.app-card', '搜索账号 / 昵称 / 手机号').fill('e2e_crud')
    await page.locator('.app-btn', { hasText: '查询' }).click()
    await expect(page.getByText('E2E 测试用户')).toBeVisible()

    await page
      .locator('.table-row', { hasText: 'E2E 测试用户' })
      .locator('.app-btn', { hasText: '删除' })
      .click()
    // 确认框是 uni.showModal：确认键是「删除」，取消键由 confirmDelete 显式传 t('common.cancel')
    await expect(page.getByText('取消', { exact: true })).toBeVisible()
    await page.getByText('删除', { exact: true }).last().click()
    await expect(page.getByText('已删除')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('没有符合条件的用户')).toBeVisible()
    await expect(page.locator('.app-table').getByText('E2E 测试用户')).toHaveCount(0)
  })
})
