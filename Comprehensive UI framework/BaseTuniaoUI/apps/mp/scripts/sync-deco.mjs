/**
 * uni-app 的 mp-weixin 编译器不接受 src 之外的 .vue（会生成 ../node-modules 这类非法 chunk 名），
 * 所以装修渲染器的唯一源码放在 packages/deco，构建前同步一份到 apps/mp/src/deco。
 * 不要手改 apps/mp/src/deco，它由本脚本生成且已 gitignore。
 */
import { cpSync, rmSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const source = resolve(here, '../../../packages/deco/src')
const target = resolve(here, '../src/deco')

if (!existsSync(source)) {
  console.error(`[sync-deco] 找不到源目录：${source}`)
  process.exit(1)
}

rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })
cpSync(source, target, { recursive: true })
console.log(`[sync-deco] packages/deco/src → apps/mp/src/deco`)
