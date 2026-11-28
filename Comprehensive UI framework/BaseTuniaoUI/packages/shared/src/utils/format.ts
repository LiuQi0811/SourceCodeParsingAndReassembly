export const padZero = (value: number, length = 2): string => String(value).padStart(length, '0')

/** 格式化为 YYYY-MM-DD HH:mm:ss */
export const formatDateTime = (date: Date = new Date()): string => {
  const y = date.getFullYear()
  const m = padZero(date.getMonth() + 1)
  const d = padZero(date.getDate())
  const hh = padZero(date.getHours())
  const mm = padZero(date.getMinutes())
  const ss = padZero(date.getSeconds())
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
}

/** 只取日期 YYYY-MM-DD */
export const formatDate = (value: string): string => {
  if (!value) return ''
  return value.split(' ')[0]
}

/** 手机号脱敏 */
export const maskPhone = (phone: string): string => {
  if (!phone || phone.length < 11) return phone || ''
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}
