export interface ApiResponse<T = unknown> {
  code: number
  msg: string
  data: T
}

export interface PageQuery {
  pageNum?: number
  pageSize?: number
}

export interface PageResult<T> {
  list: T[]
  total: number
  pageNum: number
  pageSize: number
}

/** 通用键值选项 */
export interface OptionItem<T = string | number> {
  label: string
  value: T
}
