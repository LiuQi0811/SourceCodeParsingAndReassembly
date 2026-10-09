import time
import asyncio
from initialize_model import _initialize_model



async def demo_async_invoke():
    print('=== 演示：ainvoke 的异步（非阻塞）效果 ===')
    # 开始记录时间
    start_time = time.perf_counter()
    print("程序开始...", start_time)
    # 创建任务（Task）
    print('>>> 发起异步模型调用 (ainvoke)..')
    model = await _initialize_model()
    async_task = asyncio.create_task(model.ainvoke('用一句话解释人工智能。'))
    # 并发执行其他任务
    print('>>> 模型请求已在后台发送，继续执行本地逻辑...')
    for i in range(3):
        # 使用异步等待，释放控制权
        await asyncio.sleep(1)
        print(f'>>> 正在执行第{i + 1}个任务... (已耗时 {time.perf_counter() - start_time:.2f}s)')
    # 获取模型结果
    print('>>> 本地任务完成，检查模型状态...')
    response = await async_task
    # 结束时间
    end_time = time.perf_counter()
    print(f'>>> 模型返回: {response.content}')
    print(f'=== 总运行耗时: {end_time - start_time:.2f}s ===')




async def main():
    """ 主函数 """
    await demo_async_invoke()

if __name__ =='__main__':
    asyncio.run(main())

