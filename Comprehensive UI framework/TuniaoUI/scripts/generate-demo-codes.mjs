/**
 * 生成每个 demo-block 的完整示例源码注册表。
 *
 * 卡片源码不是手写摘要，而是在构建前从页面 SFC 里提取：
 * 1. 该卡片的完整模板片段；
 * 2. 模板实际引用到的 script setup 状态 / 方法 / 类型；
 * 3. 页面样式里与该卡片 class 相关的规则。
 *
 * 这样卡片「源码」始终和真实运行代码一致，不会随页面改动漂移。
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { parse } from '@vue/compiler-sfc'

const root = process.cwd()
const sourceRoot = path.join(root, 'src')
const outputPath = path.join(root, 'src/utils/demo-code.generated.ts')

const roots = ['src/pages', 'src/pages-sub']
const routeToFile = new Map()

function walk(dir) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name)
		if (entry.isDirectory()) walk(full)
		else if (entry.isFile() && entry.name.endsWith('.vue')) {
			const relative = path.relative(sourceRoot, full).split(path.sep).join('/')
			routeToFile.set(relative.replace(/\.vue$/, ''), full)
		}
	}
}

for (const dir of roots) {
	const absolute = path.join(root, dir)
	if (fs.existsSync(absolute)) walk(absolute)
}

function decodeEntities(text) {
	return text
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&')
}

/** 从 <demo-block 开始找到开标签结束的 >，跳过引号里的 > */
function findTagEnd(text, start) {
	let quote = ''
	for (let i = start; i < text.length; i += 1) {
		const char = text[i]
		if (quote) {
			if (char === quote) quote = ''
			continue
		}
		if (char === '"' || char === "'") quote = char
		else if (char === '>') return i
	}
	return -1
}

function attr(openTag, name) {
	const match = openTag.match(new RegExp(`(?:^|\\s)${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=\\s*"([^"]*)"`, 'i'))
	return match ? decodeEntities(match[1]) : ''
}

function scanDemoBlocks(template) {
	const blocks = []
	let cursor = 0
	while (cursor < template.length) {
		const start = template.indexOf('<demo-block', cursor)
		if (start < -1 || start === -1) break
		const openEnd = findTagEnd(template, start)
		if (openEnd < 0) break
		const close = template.indexOf('</demo-block>', openEnd)
		if (close < 0) break
		const openTag = template.slice(start, openEnd + 1)
		const inner = template.slice(openEnd + 1, close).trim()
		blocks.push({
			index: blocks.length + 1,
			openTag,
			inner,
			title: attr(openTag, 'title'),
			dynamicTitle: !attr(openTag, 'title') && !!openTag.match(/(?:^|\s):title\s*=/, 'i'),
			codeKey: attr(openTag, 'code-key'),
		})
		cursor = close + '</demo-block>'.length
	}
	return blocks
}

function bindingNames(name, out) {
	if (!name) return
	if (ts.isIdentifier(name)) {
		out.push(name.text)
		return
	}
	if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
		for (const element of name.elements) {
			if (ts.isBindingElement(element)) bindingNames(element.name, out)
		}
	}
}

function declaredNames(statement) {
	const names = []
	if (ts.isVariableStatement(statement)) {
		for (const declaration of statement.declarationList.declarations) bindingNames(declaration.name, names)
	} else if (
		(ts.isFunctionDeclaration(statement) ||
			ts.isClassDeclaration(statement) ||
			ts.isInterfaceDeclaration(statement) ||
			ts.isTypeAliasDeclaration(statement) ||
			ts.isEnumDeclaration(statement)) &&
		statement.name
	) {
		names.push(statement.name.text)
	}
	return names
}

function identifiers(text) {
	return new Set(text.match(/[A-Za-z_$][\w$]*/g) || [])
}

/** 只从插值和指令表达式里判断脚本依赖，避免把 class / 标签名当成变量 */
function templateExpressionIdentifiers(template) {
	const ids = new Set()
	for (const match of template.matchAll(/{{([\s\S]*?)}}/g)) {
		for (const id of identifiers(match[1])) ids.add(id)
	}
	for (const match of template.matchAll(/\s(?::|v-|@)(?:[\w:-]*)\s*=\s*"([^"]*)"/g)) {
		for (const id of identifiers(match[1])) ids.add(id)
	}
	// 命令式组件通过 ref="modalRef" 取实例，静态 ref 也要算依赖
	for (const match of template.matchAll(/\sref\s*=\s*"([^"]*)"/g)) {
		for (const id of identifiers(match[1])) ids.add(id)
	}
	return ids
}

function collectInvalidStart() {
	return new Set([
		'true',
		'false',
		'null',
		'undefined',
		'$event',
		'item',
		'index',
		'$slots',
		'$attrs',
		'this',
		'Math',
		'String',
		'Number',
		'Object',
		'Array',
		'Date',
	])
}

function buildScript(script, template, title) {
	if (!script.trim()) return { text: '', ids: new Set() }
	const sourceFile = ts.createSourceFile('demo.ts', script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
	const imports = []
	const declarations = []
	const globals = []

	for (const statement of sourceFile.statements) {
		if (ts.isImportDeclaration(statement)) {
			imports.push(statement)
			continue
		}
		const names = declaredNames(statement)
		if (names.length) declarations.push({ statement, names })
		else globals.push({ statement })
	}

	const byName = new Map()
	for (const declaration of declarations) {
		for (const name of declaration.names) {
			if (!byName.has(name)) byName.set(name, declaration)
		}
	}

	const candidates = templateExpressionIdentifiers(template)
	const ignored = collectInvalidStart()
	for (const name of Array.from(candidates)) {
		if (ignored.has(name)) candidates.delete(name)
	}

	const selected = new Set(candidates)
	const selectedStatements = new Set()
	let changed = true
	while (changed) {
		changed = false
		for (const declaration of declarations) {
			if (selectedStatements.has(declaration)) continue
			if (!declaration.names.some((name) => selected.has(name))) continue
			selectedStatements.add(declaration)
			for (const id of identifiers(declaration.statement.getText(sourceFile))) selected.add(id)
			changed = true
		}
	}

	// 生命周期、watch 这类没有声明名的顶层调用，只要引用到当前卡片的状态就带上。
	// “生命周期”卡片额外把所有生命周期注册都收进来，避免示例只有模板没有行为。
	const isLifecycleCard = /生命周期/.test(title)
	changed = true
	while (changed) {
		changed = false
		for (const global of globals) {
			if (selectedStatements.has(global)) continue
			const text = global.statement.getText(sourceFile)
			const ids = identifiers(text)
			const hit = Array.from(ids).some((id) => selected.has(id))
			const lifecycle =
				isLifecycleCard &&
				/(?:^|\s)(onLoad|onReady|onShow|onHide|onUnload|onPageScroll|onShareAppMessage|onShareTimeline|onReachBottom|onPullDownRefresh|onTabItemTap)\s*\(/.test(
					text,
				)
			if (!hit && !lifecycle) continue
			selectedStatements.add(global)
			for (const id of ids) selected.add(id)
			changed = true
		}
	}

	// 处理新加入状态对普通声明的依赖。
	changed = true
	while (changed) {
		changed = false
		for (const declaration of declarations) {
			if (selectedStatements.has(declaration)) continue
			if (!declaration.names.some((name) => selected.has(name))) continue
			selectedStatements.add(declaration)
			for (const id of identifiers(declaration.statement.getText(sourceFile))) selected.add(id)
			changed = true
		}
	}

	const selectedNodes = new Set(imports)
	for (const declaration of declarations) {
		if (selectedStatements.has(declaration)) selectedNodes.add(declaration.statement)
	}
	for (const global of globals) {
		if (selectedStatements.has(global)) selectedNodes.add(global.statement)
	}
	const orderedNodes = Array.from(selectedNodes).sort((a, b) => a.getStart(sourceFile) - b.getStart(sourceFile))

	const importsText = imports.map((node) => node.getText(sourceFile)).join('\n')
	const bodyText = orderedNodes
		.filter((node) => !imports.includes(node))
		.map((node) => script.slice(node.getFullStart(), node.end).trim())
		.filter(Boolean)
		.join('\n\n')

	return {
		text: [importsText, bodyText].filter(Boolean).join('\n\n'),
		ids: selected,
	}
}

function collectClasses(template) {
	const classes = new Set()
	for (const match of template.matchAll(/\s(?::)?class\s*=\s*"([^"]*)"/g)) {
		for (const token of match[1].match(/[A-Za-z_][\w-]*/g) || []) classes.add(token)
	}
	return classes
}

function extractRelevantCss(css, classes) {
	if (!css.trim() || !classes.size) return ''
	const output = []
	let cursor = 0
	while (cursor < css.length) {
		const brace = css.indexOf('{', cursor)
		if (brace < 0) break
		let depth = 0
		let end = brace
		for (; end < css.length; end += 1) {
			if (css[end] === '{') depth += 1
			else if (css[end] === '}') {
				depth -= 1
				if (depth === 0) break
			}
		}
		if (end >= css.length) break
		const rule = css.slice(cursor, end + 1)
		const selector = css.slice(cursor, brace)
		const used = Array.from(classes).some((name) => {
			const token = `.${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
			return new RegExp(`${token}(?![\\w-])`).test(selector) || new RegExp(`${token}(?![\\w-])`).test(rule)
		})
		if (used) output.push(rule.trim())
		cursor = end + 1
		while (/\s/.test(css[cursor] || '')) cursor += 1
	}
	return output.join('\n\n')
}

function buildDemoCode(route, title, block, script, styles, hostMarkup) {
	const styleRules = styles
		.map((style) => extractRelevantCss(style.content, collectClasses(`${block.inner}\n${hostMarkup}`)))
		.filter(Boolean)
		.join('\n\n')
	const scriptText = buildScript(script, `${block.inner}\n${hostMarkup}`, title).text
	const templateParts = [block.inner]
	if (hostMarkup.trim()) {
		templateParts.push(
			`<!-- 页面根部承载的弹层 / 浮层：小程序自定义组件里 fixed 定位会失效，因此必须放在页面根节点 -->\n${hostMarkup.trim()}`,
		)
	}
	const parts = [
		`<!-- 卡片「${title}」完整示例 · 来自 ${route} -->`,
		`<template>\n${templateParts.join('\n\n')}\n</template>`,
	]
	if (scriptText) parts.push(`<script setup lang="ts">\n${scriptText}\n</script>`)
	if (styleRules) parts.push(`<style lang="scss" scoped>\n${styleRules}\n</style>`)
	return parts.join('\n\n')
}

/** 把页面根节点下、不在 demo-block 里的 tn-* 组件当作潜在弹层宿主 */
function collectHostCandidates(descriptor, source) {
	const ast = descriptor.template?.ast
	const candidates = []
	const root = ast?.children?.find((node) => node.type === 1)
	if (!root) return candidates
	for (const node of root.children || []) {
		if (node.type !== 1 || !node.tag || node.tag === 'demo-block') continue
		if (!node.tag.startsWith('tn-')) continue
		const markup = source.slice(node.loc.start.offset, node.loc.end.offset)
		candidates.push({ tag: node.tag, markup })
	}
	return candidates
}

function hostBindingExpressions(markup) {
	const expressions = []
	for (const match of markup.matchAll(/\s(?:v-model(?::[\w-]+)?|:open|:show|ref)\s*=\s*"([^"]*)"/g)) {
		expressions.push(match[1].replace(/\s+/g, ''))
	}
	return expressions
}

function pickHostMarkup(candidates, cardTemplate, extraIds) {
	const compactCard = cardTemplate.replace(/\s+/g, '')
	const picked = []
	for (const candidate of candidates) {
		const bindings = hostBindingExpressions(candidate.markup)
		const hit = bindings.some((expr) => {
			if (compactCard.includes(expr)) return true
			return /^[A-Za-z_$][\w$]*$/.test(expr) && extraIds && extraIds.has(expr)
		})
		if (hit) picked.push(candidate.markup)
	}
	return picked.join('\n\n')
}

const map = {}
const warnings = []
const codeLabels = {
	'icon-library': '图标库',
}

for (const [route, file] of routeToFile) {
	const source = fs.readFileSync(file, 'utf8')
	const { descriptor } = parse(source, { filename: file })
	const template = descriptor.template?.content || ''
	const blocks = scanDemoBlocks(template)
	if (!blocks.length) continue
	const hostCandidates = collectHostCandidates(descriptor, source)
	const script = descriptor.scriptSetup?.content || ''
	const styles = descriptor.styles || []

	for (const block of blocks) {
		const key = block.codeKey || block.title
		if (!key) {
			warnings.push(`${route} 第 ${block.index} 张卡缺少静态 title / code-key，已跳过`)
			continue
		}
		const registryKey = `${route}#${key}`
		if (map[registryKey]) {
			warnings.push(`${route} 卡片键重复：${key}`)
			continue
		}
		const displayTitle = block.title || codeLabels[key] || key
		const baseScript = buildScript(script, block.inner, displayTitle)
		const hostMarkup = pickHostMarkup(hostCandidates, block.inner, baseScript.ids)
		map[registryKey] = buildDemoCode(route, displayTitle, block, script, styles, hostMarkup).replace(
			/#(ifdef|ifndef|endif)/g,
			'＃$1',
		)
	}
}

const output = `// 由 scripts/generate-demo-codes.mjs 生成，请勿手改。
export const demoCodeMap: Record<string, string> = ${JSON.stringify(map, null, '\t')}\n`
fs.writeFileSync(outputPath, output, 'utf8')

console.log(`[demo-codes] ${Object.keys(map).length} cards -> src/utils/demo-code.generated.ts`)
for (const warning of warnings) console.warn(`[demo-codes] ${warning}`)
