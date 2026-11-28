import { ref } from 'vue'
import type { Ref } from 'vue'
import { appConfig } from '@/config'
import type { PageResult } from '@/types/http'

export interface PageParams {
  pageNum: number
  pageSize: number
}

/**
 * 列表分页通用逻辑
 * 页面只需要提供 fetcher，查询条件由页面自己维护，
 * 搜索 / 翻页 / 刷新都复用同一套状态
 */
export const useTableList = <T>(fetcher: (params: PageParams) => Promise<PageResult<T>>) => {
  const list = ref([]) as Ref<T[]>
  const total = ref(0)
  const loading = ref(false)
  const pageNum = ref(1)
  const pageSize = ref(appConfig.pageSize)

  const load = async (): Promise<void> => {
    loading.value = true
    try {
      const result = await fetcher({ pageNum: pageNum.value, pageSize: pageSize.value })
      list.value = result.list
      total.value = result.total
      // 删除最后一页的最后一条后自动回退一页
      if (!result.list.length && pageNum.value > 1) {
        pageNum.value -= 1
        await load()
      }
    } finally {
      loading.value = false
    }
  }

  /** 条件变更后从头查 */
  const search = (): void => {
    pageNum.value = 1
    load()
  }

  const changePage = (page: number): void => {
    pageNum.value = page
    load()
  }

  return { list, total, loading, pageNum, pageSize, load, search, changePage }
}
