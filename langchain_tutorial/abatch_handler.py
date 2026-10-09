import asyncio
import time

from initialize_model import _initialize_model


async def demo_async_batch():
    """演示异步批量的非阻塞特性"""
    print('=== 演示：abatch 的异步（非阻塞）效果 ===')
    # 记录开始时间
    start_time = time.perf_counter()
    print('程序开始...')
    # 准备批量输入
    questions = ['用一句话说明深度学习与传统机器学习的区别','中国首都在哪里？']
    # 发起异步批量请求
    # 关键修改：使用 create_task 让协程立即在后台执行
    print('>>> 发起异步批量调用 (abatch)...')
    model = await _initialize_model()
    batch_task = asyncio.create_task(model.abatch(questions))
    # 在等待批量处理的同时，执行其他任务
    print('>>> 批量任务已在后台运行，主程序继续执行...')
    for i in range(3):
        # 关键修改：使用 asyncio.sleep 允许后台任务获取 CPU 时间片进行网络请求
        await asyncio.sleep(1)
        print(f'>>> 正在执行第{i + 1}个任务... (已耗时 {time.perf_counter() -start_time:.2f}s)')
    # 等待批量处理结果
    print('>>> 其他任务已完成，现在获取后台批量任务的结果...')
    # 此时 batch_task 可能已经完成，或者我们在这里等待它完成
    responses = await batch_task
    # 结束时间
    end_time = time.perf_counter()
    for response in responses:
        content = response.content if hasattr(response, 'content') else str(response)
        print(f'>>> 响应内容: {content}')
    print(f'=== 总运行耗时: {end_time - start_time:.2f}s ===')



async def main():
    """主函数"""
    await demo_async_batch()

if __name__ == '__main__':
    asyncio.run(main())