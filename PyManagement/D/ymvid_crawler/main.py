"""入口：命令行参数解析"""
import asyncio
import argparse
import sys
from core.orchestrator import Crawler


def parse_args():
    parser = argparse.ArgumentParser(
        description="ymvid.com 全站资源异步抓取框架",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 内存队列 + bs4 解析器
  python main.py -u https://www.ymvid.com/ -q memory -p bs4

  # SQLite 队列（支持断点续爬）+ 组合解析器
  python main.py -u https://www.ymvid.com/ -q sqlite -p bs4 xpath re

  # 高并发 + 深度 3
  python main.py -u https://www.ymvid.com/ -c 50 -d 3

  # 携带 Cookie / 自定义请求头（防盗链）
  python main.py -u https://www.ymvid.com/ --cookie "sessionid=xxx" -H "Origin: https://www.ymvid.com"

  # 只下载视频 + 只跟进播放页链接
  python main.py -u https://www.ymvid.com/play/7061 --video-only --link-include ".*/play/.*"
        """
    )
    parser.add_argument("--url", "-u", nargs="+", required=True,
                        help="起始 URL（可多个）")
    parser.add_argument("--queue-mode", "-q", choices=["memory", "sqlite"],
                        default="memory", help="队列模式（默认 memory）")
    parser.add_argument("--parsers", "-p", nargs="+",
                        choices=["bs4", "xpath", "lxml", "re", "regex"],
                        default=["bs4", "xpath"],
                        help="解析器（可组合，默认 bs4 xpath）")
    parser.add_argument("--concurrency", "-c", type=int, default=20,
                        help="并发数（默认 20）")
    parser.add_argument("--depth", "-d", type=int, default=3,
                        help="最大爬取深度（默认 3）")
    parser.add_argument("--output", "-o", default="./downloads",
                        help="输出目录（默认 ./downloads）")
    parser.add_argument("--db", default="crawl_queue.db",
                        help="SQLite 数据库路径")
    parser.add_argument("--timeout", "-t", type=int, default=30,
                        help="请求超时秒数（默认 30）")
    parser.add_argument("--workers", "-w", type=int, default=5,
                        help="工作协程数（默认 5）")
    parser.add_argument("--user-agent", "--ua", default="",
                        help="自定义 User-Agent（反爬/防盗链）")
    parser.add_argument("--cookie", default="",
                        help="自定义 Cookie（登录态/防盗链）")
    parser.add_argument("--header", "-H", action="append", default=[],
                        metavar="NAME:VALUE",
                        help="额外请求头，可多次使用，如 -H 'Origin: https://...'")
    parser.add_argument("--video-only", action="store_true",
                        help="只下载视频类资源（跳过图片/音频/文档等）")
    parser.add_argument("--link-include", action="append", default=[],
                        metavar="REGEX",
                        help="只跟进匹配正则的链接，可多次使用")
    parser.add_argument("--link-exclude", action="append", default=[],
                        metavar="REGEX",
                        help="跳过匹配正则的链接（如登录/搜索页），可多次使用")
    return parser.parse_args()
    return parser.parse_args()


async def main():
    args = parse_args()

    extra_headers = {}
    if args.user_agent:
        extra_headers["User-Agent"] = args.user_agent
    if args.cookie:
        extra_headers["Cookie"] = args.cookie
    for header in args.header:
        if ":" in header:
            key, value = header.split(":", 1)
            extra_headers[key.strip()] = value.strip()

    config = {
        "queue_mode": args.queue_mode,
        "db_path": args.db,
        "parsers": args.parsers,
        "concurrency": args.concurrency,
        "max_depth": args.depth,
        "download_dir": args.output,
        "timeout": args.timeout,
        "retries": 3,
        "workers": args.workers,
        "extra_headers": extra_headers,
        "video_only": args.video_only,
        "link_include": args.link_include,
        "link_exclude": args.link_exclude,
    }

    print("=" * 60)
    print("  全站资源异步抓取框架")
    print("=" * 60)
    print(f"  起始 URL : {args.url}")
    print(f"  队列模式 : {args.queue_mode}")
    print(f"  解析器   : {' + '.join(args.parsers)}")
    print(f"  并发数   : {args.concurrency}")
    print(f"  工作协程 : {args.workers}")
    print(f"  最大深度 : {args.depth}")
    print(f"  输出目录 : {args.output}")
    if args.video_only:
        print("  资源过滤 : 仅视频")
    if args.link_include or args.link_exclude:
        print(f"  链接过滤 : include={args.link_include} exclude={args.link_exclude}")
    if extra_headers:
        print(f"  自定义头 : {extra_headers}")
    print("=" * 60)

    crawler = Crawler(config)
    try:
        await crawler.run(args.url)
    except KeyboardInterrupt:
        print("\n[!] 用户中断，进度已保存至数据库")
    finally:
        stats = crawler.stats.stats
        print("\n" + "=" * 60)
        print("  抓取统计")
        print("=" * 60)
        for k, v in stats.items():
            print(f"  {k:12s}: {v}")
        print("=" * 60)


if __name__ == "__main__":
    if sys.version_info < (3, 10):
        print("需要 Python 3.10+")
        sys.exit(1)
    asyncio.run(main())
