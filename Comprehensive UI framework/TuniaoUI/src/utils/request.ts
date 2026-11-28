/**
 * 统一请求封装：token 注入、业务码解包、401 兜底、超时 / 取消 / 重试、上传下载进度、Mock 适配。
 *
 * 真实项目把 .env 里的 VITE_API_BASE_URL 换成后端地址即可；示例页全部走 mock，避免依赖外部服务。
 * 业务响应约定：{ code: 0 | 200, data, message }；非该结构时原样返回，兼容旧接口。
 */
const envBase = (import.meta.env?.VITE_API_BASE_URL as string | undefined) || 'https://api.example.com'

export const BASE_URL = envBase
export const TOKEN_KEY = 'tn-demo-token'

export interface RequestOptions<T> {
	url: string
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
	data?: Record<string, unknown>
	/** 是否携带 token，默认 true */
	auth?: boolean
	/** 是否展示全局 loading */
	loading?: boolean
	/** 自定义请求头，会与默认头合并 */
	headers?: Record<string, string>
	/** 超时时间（ms），默认 10000；0 表示不设超时 */
	timeout?: number
	/** 失败重试次数，默认 0；只对网络错误 / 5xx / 408 重试 */
	retries?: number
	/** 首次重试等待时间（ms），后续按次数递增 */
	retryDelay?: number
	/** 外部取消信号，传入 AbortController.signal 可中断请求（H5 / 支持 AbortController 的平台） */
	signal?: AbortSignal
	/** 拿到底层 RequestTask，可调用 task.abort()，适配小程序 / App 的取消方式 */
	onTask?: (task: UniApp.RequestTask | null) => void
	/** 是否解包 { code, data, message }，默认 true；旧接口没有 code 时会自动原样返回 */
	unwrap?: boolean
	/** 传入 mock 时不会发真实网络请求，便于离线演示；可直接返回 T，也可返回 { code, data, message } */
	mock?: () => T | ApiEnvelope<T> | Promise<T | ApiEnvelope<T>>
	/** mock 延迟，模拟网络耗时 */
	delay?: number
}

export class RequestError extends Error {
	statusCode: number

	constructor(message: string, statusCode: number) {
		super(message)
		this.name = 'RequestError'
		this.statusCode = statusCode
	}
}

/** 业务码错误：HTTP 200，但 { code } 不是成功码 */
export class BusinessError extends RequestError {
	code: number | string
	payload: unknown

	constructor(message: string, code: number | string, payload?: unknown) {
		super(message, 200)
		this.name = 'BusinessError'
		this.code = code
		this.payload = payload
	}
}

interface ApiEnvelope<T> {
	code: number | string
	data?: T
	message?: string
	msg?: string
}

function toast(title: string) {
	uni.showToast({ title, icon: 'none' })
}

/** 统一错误处理：401 清 token 并提示重新登录 */
function handleUnauthorized() {
	uni.removeStorageSync(TOKEN_KEY)
	toast('登录已过期，请重新登录')
}

function authHeader(auth: boolean): Record<string, string> {
	if (!auth) return {}
	const token = uni.getStorageSync(TOKEN_KEY) as string
	return token ? { Authorization: `Bearer ${token}` } : {}
}

function isEnvelope<T>(body: unknown): body is ApiEnvelope<T> {
	return !!body && typeof body === 'object' && 'code' in (body as Record<string, unknown>)
}

function unwrapBody<T>(body: unknown, unwrap = true): T {
	if (!unwrap || !isEnvelope<T>(body)) return body as T
	const code = body.code
	if (code === 0 || code === 200) return body.data as T
	if (code === 401) handleUnauthorized()
	throw new BusinessError(body.message || body.msg || `业务失败（${code}）`, code, body)
}

function shouldRetry(error: unknown): boolean {
	if (error instanceof BusinessError) return false
	if (error instanceof RequestError) {
		return error.statusCode === 0 || error.statusCode === 408 || error.statusCode >= 500
	}
	return true
}

function sleep(ms: number) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

interface RawRequestParams {
	url: string
	method: NonNullable<RequestOptions<unknown>['method']>
	data?: Record<string, unknown>
	headers: Record<string, string>
	timeout: number
	signal?: AbortSignal
	onTask?: (task: UniApp.RequestTask | null) => void
}

/** 单次真实请求：负责超时与取消，返回原始响应 */
function requestOnce(params: RawRequestParams): Promise<UniApp.RequestSuccessCallbackResult> {
	const { url, method, data, headers, timeout, signal, onTask } = params
	return new Promise((resolve, reject) => {
		let settled = false
		let timer: ReturnType<typeof setTimeout> | undefined

		const finish = (fn: () => void) => {
			if (settled) return
			settled = true
			if (timer) clearTimeout(timer)
			finishAbort()
			onTask?.(null)
			fn()
		}

		const task = uni.request({
			url,
			method,
			data,
			header: headers,
			success: (res) => finish(() => resolve(res)),
			fail: (err) => finish(() => reject(new RequestError(err.errMsg || '网络异常', 0))),
		})
		onTask?.(task)

		const onAbort = () => {
			task.abort()
			finish(() => reject(new RequestError('请求已取消', -1)))
		}

		const finishAbort = () => {
			if (signal) signal.removeEventListener('abort', onAbort)
		}

		if (signal) {
			if (signal.aborted) {
				onAbort()
				return
			}
			signal.addEventListener('abort', onAbort, { once: true })
		}

		if (timeout > 0) {
			timer = setTimeout(() => {
				task.abort()
				finish(() => reject(new RequestError(`请求超时（${timeout}ms）`, 408)))
			}, timeout)
		}
	})
}

/**
 * 统一请求入口。
 *
 * ```ts
 * const user = await request<User>({ url: '/user/1' })
 * const list = await request<List>({ url: '/orders', data: { page: 1 } })
 * ```
 */
export async function request<T>(options: RequestOptions<T>): Promise<T> {
	const {
		url,
		method = 'GET',
		data,
		auth = true,
		loading = false,
		headers = {},
		timeout = 10000,
		retries = 0,
		retryDelay = 400,
		signal,
		unwrap = true,
		mock,
		delay = 320,
		onTask,
	} = options

	if (loading) uni.showLoading({ title: '加载中', mask: true })

	try {
		// Mock 分支：不发起真实请求，但保留并复用业务码解包 / 取消信号
		if (mock) {
			onTask?.(null)
			await sleep(delay)
			if (signal?.aborted) throw new RequestError('请求已取消', -1)
			return unwrapBody<T>(await mock(), unwrap)
		}

		const fullUrl = /^https?:\/\//.test(url) ? url : `${BASE_URL}${url}`
		const mergedHeaders: Record<string, string> = {
			'Content-Type': 'application/json',
			...authHeader(auth),
			...headers,
		}

		let lastError: unknown
		for (let attempt = 0; attempt <= retries; attempt++) {
			try {
				const res = await requestOnce({
					url: fullUrl,
					method,
					data,
					headers: mergedHeaders,
					timeout,
					signal,
					onTask,
				})

				if (res.statusCode === 401) {
					handleUnauthorized()
					throw new RequestError('登录已过期', 401)
				}
				if (res.statusCode < 200 || res.statusCode >= 300) {
					throw new RequestError(`请求失败（${res.statusCode}）`, res.statusCode)
				}
				return unwrapBody<T>(res.data, unwrap)
			} catch (error) {
				lastError = error
				if (attempt >= retries || !shouldRetry(error) || signal?.aborted) break
				await sleep(retryDelay * (attempt + 1))
			}
		}
		throw lastError instanceof Error ? lastError : new RequestError('请求失败', 0)
	} finally {
		if (loading) uni.hideLoading()
	}
}

/** ---------------- 上传 / 下载 ---------------- */

export interface UploadOptions<T> {
	url: string
	filePath: string
	name?: string
	formData?: Record<string, unknown>
	headers?: Record<string, string>
	auth?: boolean
	loading?: boolean
	unwrap?: boolean
	/** 0 - 100 */
	onProgress?: (percent: number) => void
}

export interface DownloadOptions {
	url: string
	headers?: Record<string, string>
	auth?: boolean
	loading?: boolean
	onProgress?: (percent: number, written: number, total: number) => void
}

/** 上传文件：统一 token / loading / 进度 / 业务解包 */
export function uploadFile<T = unknown>(options: UploadOptions<T>): Promise<T> {
	const { url, filePath, name = 'file', formData, headers = {}, auth = true, loading = false, unwrap = true, onProgress } = options
	const fullUrl = /^https?:\/\//.test(url) ? url : `${BASE_URL}${url}`

	if (loading) uni.showLoading({ title: '上传中', mask: true })

	return new Promise<T>((resolve, reject) => {
		const task = uni.uploadFile({
			url: fullUrl,
			filePath,
			name,
			formData: formData as Record<string, any>,
			header: { ...authHeader(auth), ...headers },
			success: (res) => {
				if (loading) uni.hideLoading()
				if (res.statusCode === 401) {
					handleUnauthorized()
					reject(new RequestError('登录已过期', 401))
					return
				}
				if (res.statusCode < 200 || res.statusCode >= 300) {
					reject(new RequestError(`上传失败（${res.statusCode}）`, res.statusCode))
					return
				}
				try {
					const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
					resolve(unwrapBody<T>(body, unwrap))
				} catch (error) {
					reject(new RequestError('上传响应不是合法 JSON', 0))
				}
			},
			fail: (err) => {
				if (loading) uni.hideLoading()
				reject(new RequestError(err.errMsg || '上传失败', 0))
			},
		})
		task.onProgressUpdate((res) => onProgress?.(res.progress))
	})
}

/** 下载文件：返回本地临时路径，可配合 uni.openDocument / saveFile 使用 */
export function downloadFile(options: DownloadOptions): Promise<string> {
	const { url, headers = {}, auth = true, loading = false, onProgress } = options
	const fullUrl = /^https?:\/\//.test(url) ? url : `${BASE_URL}${url}`

	if (loading) uni.showLoading({ title: '下载中', mask: true })

	return new Promise<string>((resolve, reject) => {
		const task = uni.downloadFile({
			url: fullUrl,
			header: { ...authHeader(auth), ...headers },
			success: (res) => {
				if (loading) uni.hideLoading()
				if (res.statusCode === 200 && res.tempFilePath) {
					resolve(res.tempFilePath)
					return
				}
				reject(new RequestError(`下载失败（${res.statusCode}）`, res.statusCode))
			},
			fail: (err) => {
				if (loading) uni.hideLoading()
				reject(new RequestError(err.errMsg || '下载失败', 0))
			},
		})
		task.onProgressUpdate((res) => {
			onProgress?.(res.progress, res.totalBytesWritten, res.totalBytesExpectedToWrite)
		})
	})
}
