// 无登录工具型应用：anon 角色全量读写，无需会话
export async function ensureSession(): Promise<string | null> {
  return null
}