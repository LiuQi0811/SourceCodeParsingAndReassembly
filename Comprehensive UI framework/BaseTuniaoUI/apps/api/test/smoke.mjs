/**
 * 装修后端冒烟测试：临时数据目录 + 独立端口，不污染 apps/api/data。
 * 运行：npm run smoke:api
 */
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const PORT = 3101
const BASE = `http://127.0.0.1:${PORT}`
const temp = await mkdtemp(path.join(tmpdir(), 'btn-api-'))

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const request = async (method, url, body, token) => {
  const headers = []
  if (body) headers.push(['Content-Type', 'application/json'])
  if (token) headers.push(['Authorization', `Bearer ${token}`])
  const response = await fetch(`${BASE}${url}`, {
    method,
    headers: headers.length ? Object.fromEntries(headers) : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  return response.json()
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const server = spawn(process.execPath, [path.join(ROOT, 'src', 'server.mjs')], {
  env: {
    ...process.env,
    PORT: String(PORT),
    HOST: '127.0.0.1',
    API_DATA_DIR: path.join(temp, 'data'),
    API_UPLOAD_DIR: path.join(temp, 'uploads'),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
server.stderr.on('data', (chunk) => console.error(String(chunk)))

const stop = async () => {
  server.kill()
  await sleep(200)
  await rm(temp, { recursive: true, force: true })
}

try {
  let ready = false
  for (let i = 0; i < 50; i += 1) {
    try {
      const health = await request('GET', '/health')
      if (health.code === 0) {
        ready = true
        break
      }
    } catch {
      await sleep(200)
    }
  }
  assert(ready, '服务未启动')

  const denied = await request('GET', '/deco/pages')
  assert(denied.code === 401, '未登录访问页面列表应返回 401')

  const login = await request('POST', '/auth/deco-login', { username: 'admin', password: '123456' })
  assert(login.code === 0 && login.data.token, '装修鉴权登录失败')
  const token = login.data.token

  const noPerm = await request('POST', '/auth/deco-login', { username: 'chenmo', password: '123456' })
  assert(noPerm.code === 403, '无装修权限账号不应拿到 token')

  const pages = await request('GET', '/deco/pages', undefined, token)
  assert(pages.code === 0 && pages.data.pages.length === 1, '首页初始数据不正确')
  assert(pages.data.pages[0].isHome, '首条应为首页')

  const home = await request('GET', '/deco/home')
  assert(home.data.page?.components.length === 4, '首页发布数据应包含 4 个组件')

  const copy = await request('POST', '/deco/pages/home/copy', { title: '副本页' }, token)
  assert(copy.code === 0 && copy.data.title === '副本页', '复制页面失败')
  const copyId = copy.data.id

  // 未发布页面不能出现在 C 端清单里
  const publicBefore = await request('GET', '/deco/published')
  assert(publicBefore.code === 0 && publicBefore.data.pages.length === 1, '未发布页面泄露到 C 端清单')

  const page = home.data.page
  page.title = '第二版'
  const publish1 = await request('PUT', `/deco/pages/${copyId}/publish`, { page }, token)
  assert(publish1.code === 0, '首次发布失败')

  const publicAfter = await request('GET', '/deco/published')
  assert(publicAfter.data.pages.length === 2, '发布后页面未进入 C 端清单')

  const next = { ...page, title: '第三版' }
  const publish2 = await request('PUT', `/deco/pages/${copyId}/publish`, { page: next }, token)
  assert(publish2.code === 0, '第二次发布失败')

  const versions = await request('GET', `/deco/pages/${copyId}/versions`, undefined, token)
  assert(versions.data.versions.length === 1, '发布历史应保留 1 版')
  const versionId = versions.data.versions[0].id

  const rollback = await request(
    'POST',
    `/deco/pages/${copyId}/versions/${versionId}/rollback`,
    undefined,
    token
  )
  assert(rollback.code === 0, '回滚失败')
  const detail = await request('GET', `/deco/pages/${copyId}`)
  assert(detail.data.page.title === '第二版', '回滚后的标题不正确')

  const templates = await request('GET', '/deco/templates', undefined, token)
  assert(templates.data.templates.length === 1, '内置模板缺失')
  const saveTemplate = await request('POST', '/deco/templates', { name: '我的模板', page: next }, token)
  assert(saveTemplate.code === 0, '保存模板失败')
  const useTemplate = await request(
    'POST',
    `/deco/templates/${saveTemplate.data.id}/use`,
    { title: '模板页' },
    token
  )
  assert(useTemplate.code === 0, '套用模板失败')

  // 1x1 透明 PNG
  const png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
  const upload = await request('POST', '/upload', { name: 'dot.png', dataUrl: png }, token)
  assert(upload.code === 0 && upload.data.url.startsWith(BASE), '上传返回地址不正确')
  const image = await fetch(upload.data.url)
  assert(image.headers.get('content-type') === 'image/png', '上传文件不可访问')

  console.log(
    'api smoke passed: auth / pages / copy / publish / versions / rollback / templates / upload / published'
  )
} finally {
  await stop()
}
