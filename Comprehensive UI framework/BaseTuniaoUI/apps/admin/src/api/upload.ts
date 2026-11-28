import { decoPost } from '@/utils/decoRequest'

export interface UploadResult {
  url: string
  name: string
  size: number
  /** Mock 阶段直接返回 base64 内联地址，真实后端应返回 OSS / CDN 地址 */
  inline: boolean
  /** 真实后端会把上传登记进当前应用的素材库 */
  assetId?: string
}

export type UploadErrorCode = 'too-large' | 'unsupported' | 'read-failed' | 'failed'

export class UploadError extends Error {
  readonly code: UploadErrorCode

  constructor(code: UploadErrorCode) {
    super(code)
    this.name = 'UploadError'
    this.code = code
  }
}

/** Mock 阶段允许的图片体积（二进制），base64 后约 800KB */
export const MAX_IMAGE_SIZE = 600 * 1024
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

const toDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new UploadError('read-failed'))
    reader.readAsDataURL(blob)
  })

type ChosenFile = Blob & { file?: Blob; name?: string }

const firstOf = <T>(value: T | T[] | undefined): T | undefined =>
  Array.isArray(value) ? value[0] : value

/** H5 下 chooser 返回的 tempFiles[0] 就是 File；取不到就回退到 blob URL */
const readChosenFile = async (
  tempFiles: ChosenFile | ChosenFile[] | undefined,
  tempFilePaths: string | string[] | undefined
): Promise<{ blob: Blob; name: string }> => {
  const first = firstOf(tempFiles)
  const blob = first?.file instanceof Blob ? first.file : first instanceof Blob ? first : null
  if (blob) return { blob, name: (blob as File).name || 'image' }

  const path = firstOf(tempFilePaths)
  if (!path) throw new UploadError('read-failed')
  const fetched = await fetch(path).then((response) => response.blob())
  return { blob: fetched, name: 'image' }
}

/**
 * 选一张图并上传。
 * 取消选择返回 null；校验失败 / 上传失败抛 UploadError，由调用方按 code 提示文案。
 */
export const chooseAndUploadImage = async (): Promise<UploadResult | null> => {
  const res = await new Promise<UniApp.ChooseImageSuccessCallbackResult>((resolve) => {
    uni.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (result) => resolve(result),
      fail: () => resolve({ tempFilePaths: [], tempFiles: [] }),
    })
  })

  const hasChosen =
    Boolean(firstOf(res.tempFiles as ChosenFile | ChosenFile[] | undefined)) ||
    Boolean(firstOf(res.tempFilePaths as string | string[] | undefined))
  if (!hasChosen) return null

  const { blob, name } = await readChosenFile(
    res.tempFiles as ChosenFile | ChosenFile[] | undefined,
    res.tempFilePaths as string | string[] | undefined
  )
  if (blob.type && !ALLOWED_TYPES.includes(blob.type)) throw new UploadError('unsupported')
  if (blob.size > MAX_IMAGE_SIZE) throw new UploadError('too-large')

  const dataUrl = await toDataUrl(blob)
  try {
    return await decoPost<UploadResult>('/upload', { name, dataUrl }, { showError: false })
  } catch (error) {
    throw new UploadError('failed')
  }
}
