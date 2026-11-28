/** 小程序端最小请求层：没配 VITE_API_BASE 时各模块走内置示例数据 */
const BASE = ((import.meta.env.VITE_API_BASE as string | undefined) || '').replace(/\/$/, '')

export const hasRemoteApi = (): boolean => BASE !== ''

export const apiGet = <T>(url: string, data?: Record<string, unknown>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    uni.request({
      url: `${BASE}${url}`,
      method: 'GET',
      data,
      success: (res) => {
        const body = res.data as { code: number; msg: string; data: T }
        if (body && body.code === 0) resolve(body.data)
        else reject(new Error(body?.msg || '请求失败'))
      },
      fail: (error) => reject(error),
    })
  })
