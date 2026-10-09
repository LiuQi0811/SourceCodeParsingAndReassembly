import asyncio
import time
from initialize_model import _initialize_model

async def demo_async_stream():
    """演示异步调用的非阻塞特性"""
    print('=== 演示：astream 的异步（非阻塞）效果 ===')
    # 记录开始时间
    start_time = time.perf_counter()
    print('程序开始...')
    # 发起异步流式请求
    # 注意：此时请求已发出，返回的是一个异步生成器
    print('>>> 发起异步流式调用（astream）...')
    model = await  _initialize_model()
    stream_response = model.astream('请用一句话解释机器学习的基本概念。')
    # 在等待流式响应的同时，执行其他任务
    print('>>> 流式请求已发送，程序无需等待，继续执行其他异步任务...')
    for i in range(3):
        # 使用 asyncio.sleep 而非 time.sleep
        # 这允许事件循环在等待时去处理上面的 stream_resp 网络 IO
        await asyncio.sleep(1)
        print(f'>>> 正在执行第{i + 1}个任务... (已耗时 {time.perf_counter() -start_time:.2f}s)')
    # 现在开始处理流式结果
    print('>>> 模拟任务已完成，开始读取缓冲区中的流式结果...')
    end_time = time.perf_counter()
    print('>>> 流式输出: ', end='', flush=True)
    async for chunk in stream_response:
        # LangChain 的消息块通常通过 .content 获取内容
        content = chunk.content if hasattr(chunk, 'content') else str(chunk)
        print(content, end='',flush=True)
    print('\n>>> 流式输出结束\n')
    print(f'=== 总运行耗时: {end_time - start_time:.2f}s ===')

async def main():
    """ 主函数 """
    await demo_async_stream()

if __name__ == '__main__':
   asyncio.run(main())