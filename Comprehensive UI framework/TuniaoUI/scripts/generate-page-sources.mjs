/**
 * 生成页面完整源码注册表。
 * uni-app 的预处理器会把 `.vue?raw` 当成 Vue 文件再处理，导致 `#ifdef` 解析失败，
 * 所以这里在构建前把页面源码读成普通字符串，写成 TS 常量供查看器使用。
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const groups = [
	['src/pages', 'pages'],
	['src/pages-sub', 'pages-sub'],
]

const sources = {}

function walk(dir) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name)
		if (entry.isDirectory()) walk(full)
		else if (entry.isFile() && entry.name.endsWith('.vue')) {
			const relative = path.relative(path.join(root, 'src'), full).split(path.sep).join('/')
			const route = relative.replace(/\.vue$/, '')
			let text = fs.readFileSync(full, 'utf8')
			// uni-app 的预处理插件会扫描所有 .ts 文本，字符串里的 #ifdef 也会被误判。
			// 用全角 # 展示，既保留条件编译的可读性，又不会触发预处理器。
			text = text.replace(/#(ifdef|ifndef|endif)/g, '＃$1')
			sources[route] = text
		}
	}
}

for (const [dir] of groups) {
	const absolute = path.join(root, dir)
	if (fs.existsSync(absolute)) walk(absolute)
}

const output = `// 由 scripts/generate-page-sources.mjs 生成，请勿手改。\nexport const pageSources: Record<string, string> = ${JSON.stringify(sources, null, '\t')}\n`
const outputPath = path.join(root, 'src/pages-sub/source/page-source.generated.ts')
fs.writeFileSync(outputPath, output, 'utf8')
console.log(`[page-sources] ${Object.keys(sources).length} pages -> src/pages-sub/source/page-source.generated.ts`)
