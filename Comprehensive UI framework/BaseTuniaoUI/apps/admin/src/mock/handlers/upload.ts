import { defineMock, MockError } from '../adapter'

/** 图片以 base64 内联返回；换成真实后端时这里改成上传到 OSS 并返回 CDN 地址 */
const DATA_URL_PATTERN = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=]+$/i
/** base64 长度上限约对应 600KB 二进制 */
const MAX_DATA_URL_LENGTH = 820_000

defineMock('POST', '/upload', ({ body }) => {
  const dataUrl = String(body.dataUrl || '')
  const name = String(body.name || 'image')

  if (!DATA_URL_PATTERN.test(dataUrl)) {
    throw new MockError('仅支持 PNG / JPG / WebP / GIF 图片', 400)
  }
  if (dataUrl.length > MAX_DATA_URL_LENGTH) {
    throw new MockError('图片不能超过 600KB（演示环境直接内联存储）', 400)
  }

  const payload = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const size = Math.round((payload.length * 3) / 4)

  return { url: dataUrl, name, size, inline: true }
})
