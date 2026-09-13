#!/usr/bin/env python3
"""
通用全站爬虫 - 主入口
提供命令行接口和简单的编程接口
"""
import asyncio
import argparse
import sys
from pathlib import Path

# 将项目根目录加入sys.path
sys.path.insert(0, str(Path(__file__).parent))

from core.config import CrawlerConfig, FetchMode, ParseMode
from core.crawler import Crawler
from proxies.proxy_pool import ProxyRotationStrategy
from utils.logger import get_logger

logger = get_logger("Main")


def parse_args():
    parser = argparse.ArgumentParser(description="通用全站异步爬虫框架", formatter_class=argparse.RawDescriptionHelpFormatter,
                                     epilog="""
示例用法:
  # 基本爬取（内存队列模式，BS4解析）
  python main.py -u https://example.com

  # 流式爬取，XPath解析，并发20
  python main.py -u https://example.com --fetch-mode stream --parse-mode xpath -c 20

  # 使用代理，限制深度为3，最多1000页
  python main.py -u https://example.com --proxies proxies.txt --depth 3 --max-pages 1000

  # 断点续爬（默认开启，无需额外参数，重新运行即可）
  python main.py -u https://example.com
                                     """)
    parser.add_argument("-u", "--url", required=True, help="起始URL")
    parser.add_argument("-o", "--output", default="./output", help="输出目录 (默认: ./output)")
    parser.add_argument("--fetch-mode", choices=["memory", "stream"], default="memory",
                        help="抓取模式: memory=一次性加载队列, stream=边存边下载 (默认: memory)")
    parser.add_argument("--parse-mode", choices=["bs4", "xpath", "regex"], default="bs4",
                        help="解析模式: bs4/xpath/regex (默认: bs4)")
    parser.add_argument("-c", "--concurrency", type=int, default=10, help="最大并发数 (默认: 10)")
    parser.add_argument("--delay", type=float, default=0.5, help="请求随机延迟上限秒数 (默认: 0.5)")
    parser.add_argument("--depth", type=int, default=-1, help="最大爬取深度, -1表示无限 (默认: -1)")
    parser.add_argument("--max-pages", type=int, default=-1, help="最大抓取页数, -1表示无限 (默认: -1)")
    parser.add_argument("--timeout", type=int, default=30, help="请求超时秒数 (默认: 30)")
    parser.add_argument("--retries", type=int, default=3, help="最大重试次数 (默认: 3)")
    parser.add_argument("--proxies", type=str, default=None, help="代理列表文件路径，每行一个代理URL")
    parser.add_argument("--proxy-strategy", choices=["round_robin", "random", "least_used"], default="round_robin",
                        help="代理轮换策略 (默认: round_robin)")
    parser.add_argument("--no-resume", action="store_true", help="禁用断点续爬")
    parser.add_argument("--no-resources", action="store_true", help="不下载静态资源（仅HTML）")
    parser.add_argument("--external", action="store_true", help="允许爬取外链（不限制同域名）")
    parser.add_argument("--exclude", action="append", default=[], help="排除URL正则模式，可多次指定")
    parser.add_argument("--no-progress", action="store_true", help="不显示进度条")
    parser.add_argument("--decrypt", action="store_true", help="启用自动逆向解密解压")

    return parser.parse_args()


async def run(args):
    # 构建配置
    fetch_mode_map = {"memory": FetchMode.MEMORY_QUEUE, "stream": FetchMode.STREAM_QUEUE}
    parse_mode_map = {"bs4": ParseMode.BS4, "xpath": ParseMode.XPATH, "regex": ParseMode.REGEX}
    strategy_map = {
        "round_robin": ProxyRotationStrategy.ROUND_ROBIN,
        "random": ProxyRotationStrategy.RANDOM,
        "least_used": ProxyRotationStrategy.LEAST_USED,
    }

    config = CrawlerConfig(
        base_url=args.url,
        output_dir=Path(args.output),
        fetch_mode=fetch_mode_map[args.fetch_mode],
        parse_mode=parse_mode_map[args.parse_mode],
        max_concurrent=args.concurrency,
        request_delay=args.delay,
        max_depth=args.depth,
        max_pages=args.max_pages,
        timeout=args.timeout,
        max_retries=args.retries,
        enable_resume=not args.no_resume,
        download_resources=not args.no_resources,
        stay_in_domain=not args.external,
        excluded_patterns=args.exclude,
        show_progress=not args.no_progress,
        enable_decrypt=args.decrypt,
    )

    # 创建爬虫实例
    async with Crawler(config) as crawler:
        # 加载代理
        if args.proxies:
            crawler.load_proxies_from_file(args.proxies)
            crawler.proxy_pool.set_strategy(strategy_map[args.proxy_strategy])

        # 示例：添加自定义解析回调（可选）
        # def on_parsed(result):
        #     logger.info(f"解析完成: {result.title} - {result.url}, 发现{len(result.links)}个链接")
        # crawler.set_parse_callback(on_parsed)

        # 启动爬虫
        await crawler.start(args.url)


def main():
    args = parse_args()
    try:
        asyncio.run(run(args))
    except KeyboardInterrupt:
        logger.info("用户中断，程序退出")
    except Exception as e:
        logger.error(f"程序异常退出: {e}", exc_info=True)
        sys.exit(1)


# ---------- 编程接口示例 ----------
def example_programmatic_usage():
    """编程方式使用示例"""
    async def _run():
        config = CrawlerConfig(
            base_url="https://example.com",
            output_dir=Path("./example_output"),
            fetch_mode=FetchMode.STREAM_QUEUE,
            parse_mode=ParseMode.XPATH,
            max_concurrent=15,
            max_depth=2,
        )
        async with Crawler(config) as crawler:
            # 链式配置
            # crawler.set_concurrency(20).set_delay(1.0).enable_resource_download(False)
            await crawler.start("https://example.com")

    asyncio.run(_run())


if __name__ == "__main__":
    main()
