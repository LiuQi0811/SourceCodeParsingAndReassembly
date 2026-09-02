# 系统标准库导入
import sys
import io


from typing import Optional,Type

import config
from base.base_crawler import AbstractCrawler
from media_platform import bilibili
from media_platform.bilibili import BilibiliCrawler
import cmd_arg

# 终端输出编码强制UTF-8处理模块
# 解决Windows/部分服务器终端GBK编码，打印中文乱码、编码报错问题
# 强制标准输出stdout、标准错误stderr统一使用UTF-8编码输出
# Force UTF-8 encoding for stdout/stderr to prevent encoding errors
# when outputting Chinese characters in non-UTF-8 terminals
if sys.stdout and hasattr(sys.stdout,"buffer"):
    # 判断当前输出编码不是UTF-8时，重新包装输出流
    if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
        # errors='replace'：遇到无法解码字符自动替换为占位符，避免程序崩溃
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8",errors="replace")
if sys.stderr and hasattr(sys.stderr, "buffer"):
    # 判断当前输出编码不是UTF-8时，重新包装输出流
    if sys.stderr.encoding and sys.stderr.encoding.lower() != "utf-8":
        # errors='replace'：遇到无法解码字符自动替换为占位符，避免程序崩溃
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer,encoding="utf-8",errors="replace")

# 爬虫工厂类：统一创建各平台爬虫实例
class CrawlerFactory:
    # 平台标识与爬虫类映射字典，key为命令行传入的平台简写，value为爬虫类
    CRAWLERS: dict[str,Type[AbstractCrawler]] = {
        "bili": BilibiliCrawler # bilibili B站
    }

    @staticmethod
    def create_crawler(platform: str) -> AbstractCrawler:
        """
            静态工厂方法：根据传入平台标识，实例化对应爬虫对象
            :param platform: 平台简写字符串，如 xhs / dy / bili
            :return: 对应平台爬虫实例（继承AbstractCrawler抽象类）
            :raises ValueError: 传入不存在的平台标识时抛出异常，列出支持平台
        """
        crawler_class =  CrawlerFactory.CRAWLERS.get(platform)
        if not crawler_class:
            supported = ", ".join(sorted(CrawlerFactory.CRAWLERS))
            raise ValueError(f"Invalid media platform: ${platform!r}. Supported: {supported}")
        return  crawler_class()

crawler: Optional[AbstractCrawler] = None

def _flush_excel_if_needed() -> None:
    print("Flushing excel if needed ...")

async def _generate_wordcloud_if_needed() -> None:
    print(" Generating Wordcloud if needed ......")

async def main() -> None:
    """
        程序主异步入口函数，完整爬虫生命周期主逻辑
        执行流程：解析命令行参数 → 初始化数据库(按需) → 创建爬虫实例 → 启动爬虫 → 后置数据处理
    """
    global crawler
    # 异步解析命令行输入参数（平台、存储模式、初始化数据库指令等）
    args = await cmd_arg.parse_cmd()
    if args.init_db:
        print("Initializing database ...")
    crawler = CrawlerFactory.create_crawler(platform=config.PLATFORM)
    await crawler.start()

async def async_cleanup() -> None:
    print(" Async clean up ......")

if __name__  == "__main__":
    # 导入全局异步运行管理器
    from tools.app_runner import run

    def _force_stop():
        print(" Force stop ......")


    # 启动异步程序管理器
    run(main, # 业务主异步函数（爬虫完整流程）
        async_cleanup, # 优雅退出异步资源清理函数
        cleanup_timeout_seconds=15.0, # 资源清理最长等待15秒，超时强制退出
        on_first_interrupt=_force_stop # 首次Ctrl+C触发同步浏览器兜底销毁
        )
