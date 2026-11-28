import { spawn } from 'node:child_process'

/**
 * 只拦截 src 目录内的类型错误。
 * @tuniao 组件库自带的 .ts 源码存在上游类型冲突（dayjs 双实例、wx 全局缺失），
 * 直接跑 vue-tsc 会整体退出码 2；这里把上游噪音与业务代码分开统计。
 */
const child = spawn('npx', ['vue-tsc', '--noEmit'], {
	shell: true,
	stdio: ['ignore', 'pipe', 'pipe'],
})

let output = ''
child.stdout.on('data', (chunk) => (output += chunk))
child.stderr.on('data', (chunk) => (output += chunk))

child.on('close', () => {
	const lines = output.split(/\r?\n/)
	const srcErrors = lines.filter((line) => {
		if (!/error TS\d+/.test(line)) return false
		return /^src[\\/]/.test(line) || /[\\/]TuniaoUI[\\/]src[\\/]/.test(line)
	})
	const upstreamErrors = lines.filter(
		(line) => /node_modules.*error TS\d+/.test(line) && !srcErrors.includes(line),
	)

	if (srcErrors.length) {
		console.error(`src 类型错误 ${srcErrors.length} 处：`)
		console.error(srcErrors.join('\n'))
		process.exit(1)
	}

	console.log(`src 类型检查通过；忽略 @tuniao 上游错误 ${upstreamErrors.length} 行。`)
})
