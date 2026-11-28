/**
 * 切换当前小程序构建目标：
 *   node scripts/use-tenant.mjs <应用标识> <AppID> [API 地址]
 *
 * 会同步修改 apps/mp/.env 的 VITE_DECO_TENANT，以及 src/manifest.json 里的微信 AppID。
 * 一个应用标识对应后台「页面装修 → 小程序应用」里的 id。
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const envFile = path.join(root, '.env')
const manifestFile = path.join(root, 'src', 'manifest.json')

const tenantId = String(process.argv[2] || '').trim()
const appId = String(process.argv[3] || '').trim()
const apiBase = String(process.argv[4] || '').trim()

if (!/^[a-z0-9][a-z0-9-]{1,31}$/.test(tenantId)) {
  console.error('用法：node scripts/use-tenant.mjs <应用标识> <AppID> [API 地址]')
  console.error('应用标识只能是 2-32 位小写字母、数字或中划线')
  process.exit(1)
}
if (!/^wx[a-z0-9]{16}$/.test(appId)) {
  console.error('AppID 格式不正确，应以 wx 开头且共 18 位')
  process.exit(1)
}

const env = await readFile(envFile, 'utf8')
let nextEnv = env.match(/^VITE_DECO_TENANT=.*$/m)
  ? env.replace(/^VITE_DECO_TENANT=.*$/m, `VITE_DECO_TENANT=${tenantId}`)
  : `${env.trimEnd()}\nVITE_DECO_TENANT=${tenantId}\n`
if (apiBase) {
  nextEnv = nextEnv.match(/^VITE_API_BASE=.*$/m)
    ? nextEnv.replace(/^VITE_API_BASE=.*$/m, `VITE_API_BASE=${apiBase}`)
    : `${nextEnv.trimEnd()}\nVITE_API_BASE=${apiBase}\n`
}

const manifest = JSON.parse(await readFile(manifestFile, 'utf8'))
manifest.appid = appId
manifest['mp-weixin'] = { ...(manifest['mp-weixin'] || {}), appid: appId }

await writeFile(envFile, nextEnv, 'utf8')
await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

console.log(`已切换到应用 ${tenantId}（${appId}）`)
if (apiBase) console.log(`装修接口地址：${apiBase}`)
