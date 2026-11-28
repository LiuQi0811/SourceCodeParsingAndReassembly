/**
 * 小程序旧缓存兼容层。
 *
 * 完整源码入口曾从 demo-block 引用过 utils/current-page，后来改成组件内直接
 * getCurrentPages()，这个文件在最新构建里已经不再被任何代码 require。
 * 但微信开发者工具的 appservice 缓存仍可能保留旧引用；如果文件不存在，
 * 启动时就会报 ENOENT。
 *
 * 这里只在 mp-weixin 构建产物里补一个同样的轻量模块，避免旧缓存报文件缺失；
 * 当前业务代码不依赖它，清缓存/重新导入项目后也不会再被引用。
 */
import fs from 'node:fs'
import path from 'node:path'

const mpRoot = path.resolve('dist/build/mp-weixin')
if (!fs.existsSync(mpRoot)) {
	process.exit(0)
}

const target = path.join(mpRoot, 'utils/current-page.js')
fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(
	target,
	'"use strict";exports.getCurrentPageRoute=function(){const t=getCurrentPages(),e=t[t.length-1];return(null==e?void 0:e.route)||""};\n',
	'utf8',
)
console.log('[mp-compat] restored utils/current-page.js for stale devtools cache')
