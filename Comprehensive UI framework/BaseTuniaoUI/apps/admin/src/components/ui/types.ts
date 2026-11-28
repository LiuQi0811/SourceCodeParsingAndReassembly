export interface TableColumn {
  key: string
  title: string
  width?: number | string
  align?: 'left' | 'center' | 'right'
  /** 移动端卡片是否展示该列，默认 true */
  card?: boolean
  /** 超长省略，默认 true */
  ellipsis?: boolean
}
