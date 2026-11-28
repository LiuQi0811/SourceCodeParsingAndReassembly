import { expect, test } from '@playwright/test'
import { login, resetApp } from './helpers'

test.describe('页面装修编辑器', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page)
    await login(page, 'admin')
    await page.goto('/#/pages/operation/deco/index')
    await expect(page.locator('.editor')).toBeVisible()
    // 等页面列表和首份草稿加载完，保存/发布按钮此时才可用
    await expect(page.locator('.page-select .select-text')).toContainText('图鸟商城')
  })

  test('组件列表、预览与属性面板联动，支持新增与上移', async ({ page }) => {
    await expect(page.locator('.comp-item')).toHaveCount(4)
    await expect(page.locator('.phone .deco-banner')).toBeVisible()

    await page.locator('.app-btn', { hasText: '轮播' }).first().click()
    await expect(page.locator('.comp-item')).toHaveCount(5)

    // 新增的轮播默认选中，属性面板出现「轮播高度」
    await expect(page.locator('.panel-props')).toContainText('轮播高度')

    const last = page.locator('.comp-item').last()
    await last.locator('.app-btn', { hasText: '上移' }).click()
    await expect(page.locator('.comp-item').nth(3)).toContainText('轮播')
  })

  test('拖拽左侧手柄可以调整组件顺序', async ({ page }) => {
    await expect(page.locator('.comp-item').first()).toContainText('轮播')
    await expect(page.locator('.comp-item').last()).toContainText('商品')

    const handle = page.locator('.comp-item .drag-handle').first()
    const target = page.locator('.comp-item').last()
    const handleBox = await handle.boundingBox()
    const targetBox = await target.boundingBox()
    if (!handleBox || !targetBox) throw new Error('拖拽元素没有渲染尺寸')

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height - 2, {
      steps: 12,
    })
    await expect(page.locator('.drop-line')).toBeVisible()
    await page.mouse.up()

    await expect(page.locator('.comp-item').last()).toContainText('轮播')
    await expect(page.locator('.comp-item').first()).toContainText('公告')
  })

  test('保存草稿后刷新仍然保留', async ({ page }) => {
    await page.locator('.comp-item').first().click()
    await page.locator('.panel-props .app-input input').first().fill('24')

    await page.locator('.app-layout .app-btn', { hasText: '保存草稿' }).click()
    await expect(page.getByText('草稿已保存').first()).toBeVisible()

    await page.reload()
    await expect(page.locator('.editor')).toBeVisible()
    await page.locator('.comp-item').first().click()
    await expect(page.locator('.panel-props .app-input input').first()).toHaveValue('24')
  })

  test('发布后状态标签显示最近发布时间', async ({ page }) => {
    await page.locator('.app-layout .app-btn', { hasText: '发布' }).click()
    await expect(page.getByText('已发布').first()).toBeVisible()
    await expect(page.locator('.preview-head')).toContainText('最近发布')

    await page.reload()
    await expect(page.locator('.editor')).toBeVisible()
    await expect(page.locator('.preview-head')).toContainText('最近发布')
  })

  test('选择图片后回填地址，保存草稿刷新仍在', async ({ page }) => {
    await page.locator('.comp-item').first().click()

    // 1×1 透明 PNG，够跑通「本地选图 → base64 → Mock 上传」链路
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    )
    const chooserPromise = page.waitForEvent('filechooser')
    await page
      .locator('.panel-props .image-picker .app-btn', { hasText: '选择图片' })
      .first()
      .click()
    const chooser = await chooserPromise
    await chooser.setFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: pixel })

    const imageInput = page.locator('.panel-props .image-picker input').first()
    await expect(imageInput).toHaveValue(/^data:image\/png;base64,/i)

    await page.locator('.app-layout .app-btn', { hasText: '保存草稿' }).click()
    await expect(page.getByText('草稿已保存').first()).toBeVisible()

    await page.reload()
    await page.locator('.comp-item').first().click()
    await expect(page.locator('.panel-props .image-picker input').first()).toHaveValue(
      /^data:image\/png;base64,/i
    )
  })

  test('新建页面、保存、切换与删除', async ({ page }) => {
    await expect(page.locator('.page-bar .app-tag')).toContainText('首页')
    await expect(page.locator('.comp-item')).toHaveCount(4)

    await page.locator('.page-bar .app-btn', { hasText: '新建页面' }).click()
    await expect(page.getByText('页面已创建').first()).toBeVisible()
    // 新页面从空白开始，且出现删除按钮（首页没有）
    await expect(page.locator('.comp-item')).toHaveCount(0)
    await expect(page.locator('.page-bar .page-delete-btn')).toBeVisible()

    await page.locator('.meta-card .app-input input').first().fill('活动页')
    await page.locator('.app-layout .app-btn', { hasText: '保存草稿' }).click()
    await expect(page.getByText('草稿已保存').first()).toBeVisible()

    // 切回首页：标题恢复为示例页，组件回来
    await page.locator('.page-select .select-trigger').click()
    await page.locator('.select-panel .option-row', { hasText: '图鸟商城（首页）' }).click()
    await expect(page.locator('.comp-item')).toHaveCount(4)
    await expect(page.locator('.page-bar .app-tag')).toContainText('首页')

    // 再切回活动页，标题仍在
    await page.locator('.page-select .select-trigger').click()
    await page.locator('.select-panel .option-row', { hasText: '活动页' }).click()
    await expect(page.locator('.meta-card .app-input input').first()).toHaveValue('活动页')

    // 删除当前页，自动回到首页
    await page.locator('.page-bar .page-delete-btn').click()
    await page.getByText('确定', { exact: true }).click()
    await expect(page.getByText('页面已删除').first()).toBeVisible()
    await expect(page.locator('.comp-item')).toHaveCount(4)
    await expect(page.locator('.page-bar .app-tag')).toContainText('首页')
  })

  test('复制页面与模板复用', async ({ page }) => {
    await page.locator('.page-bar .app-btn', { hasText: '复制当前页' }).click()
    await expect(page.getByText('页面已复制').first()).toBeVisible()
    await expect(page.locator('.page-select .select-text')).toContainText('副本')
    await expect(page.locator('.comp-item')).toHaveCount(4)

    await page.locator('.page-bar .app-btn', { hasText: '存为模板' }).click()
    await expect(page.getByText('模板已保存').first()).toBeVisible()
    await expect(page.locator('.aux-panel')).toContainText('模板库')
    // 内置「电商首页模板」+ 刚存的模板
    await expect(page.locator('.aux-row')).toHaveCount(2)

    await page
      .locator('.aux-row', { hasText: '电商首页模板' })
      .locator('.app-btn', { hasText: '使用' })
      .click()
    await expect(page.getByText('已用模板新建页面').first()).toBeVisible()
    await expect(page.locator('.comp-item')).toHaveCount(4)
    await expect(page.locator('.page-select .select-text')).toContainText('电商首页模板')
  })

  test('发布历史保留上一版并可回滚', async ({ page }) => {
    await page.locator('.app-layout .app-btn', { hasText: '发布' }).click()
    await expect(page.getByText('已发布').first()).toBeVisible()
    await expect(page.locator('.preview-head')).toContainText('最近发布')
    // 等发布请求收尾，按钮退出 loading 再改标题发第二版
    await page.waitForTimeout(1000)

    await page.locator('.meta-card .app-input input').first().fill('第二版')
    await page.locator('.app-layout .app-btn', { hasText: '发布' }).click()
    await expect(page.getByText('已发布').first()).toBeVisible()
    await page.waitForTimeout(1000)

    await page.locator('.page-bar .app-btn', { hasText: '版本历史' }).click()
    await expect(page.locator('.aux-row')).toHaveCount(1)
    await expect(page.locator('.aux-row').first()).toContainText('图鸟商城')

    await page.locator('.aux-row .app-btn', { hasText: '回滚' }).click()
    await page.getByText('确定', { exact: true }).click()
    await expect(page.getByText('已回滚并发布').first()).toBeVisible()
    await expect(page.locator('.meta-card .app-input input').first()).toHaveValue('图鸟商城')

    // 回滚前的「第二版」继续留在历史里
    await expect(page.locator('.aux-row').first()).toContainText('第二版')
  })
})
