# 向前兼容Python低版本注解语法（支持函数返回自身类型标注）
from  __future__ import  annotations

import asyncio
from collections.abc import Awaitable,Callable
from typing import Optional

# 自定义类型别名：无入参、无返回值的异步函数类型，用于主程序/清理回调
AsyncFn = Callable[[],Awaitable[None]]

def run(app_main: AsyncFn, #【必填】业务主异步函数，爬虫核心逻辑入口
        app_cleanup: AsyncFn, #【必填】程序退出时执行的异步资源清理函数（关闭连接、释放文件、销毁浏览器等）
        *,
        cleanup_timeout_seconds: float = 15.0, # 命名参数：清理流程最大超时时间，超过则强制跳过清理
        on_first_interrupt: Optional[Callable[[],None]] = None, # 命名参数：第一次收到终止信号时触发的同步回调（可选）
        force_exit_code: int = 130 # 命名参数：二次按下终止信号时强制退出的进程码，130为标准Ctrl+C退出码
        ) -> None:

    async def _cleanup_with_timeout() -> None:
        print(" Cleanup with timeout")

    async def _cancel_remaining_tasks(timeout_seconds: float = 2.0) -> None:
        print(" Canceling remaining tasks ", timeout_seconds)

    async def _runner() -> None:
        print(" Running")

        def _on_signal() -> None:
            print("On signal")
        try:
            # 执行业务主爬虫逻辑
            await app_main()
        finally:
            # 无论主程序正常结束 / 异常退出 / 被中断，都必须执行资源清理
            try:
                await _cleanup_with_timeout()
            except Exception as e:
                # 清理流程出现未知异常，打印日志不阻断后续任务销毁
                print(f"[Main] 资源清理过程发生异常: {e}")
            # 兜底销毁所有残留后台协程，防止进程挂死
            await _cancel_remaining_tasks()

    # 启动异步事件循环，执行内部runner完整生命周期
    asyncio.run(_runner())

