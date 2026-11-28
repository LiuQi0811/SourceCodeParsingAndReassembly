<script lang="ts" setup>
	import { onLaunch } from '@dcloudio/uni-app'
	import { restoreTheme } from '@/qq/store'
	import { initPersistence } from '@/qq/persist'

	// onLaunch 加载提示语
	onLaunch(() => {
		restoreTheme()
		initPersistence()
		console.log('App Launch welcome QQ by TuniaoUI.')
	})
</script>

<style lang="scss">
	@import '@tuniao/tn-style/dist/uniapp/index.css';
	@import './styles/qq.scss';
</style>
