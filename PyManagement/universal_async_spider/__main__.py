"""命令行入口 - 可直接 `python -m universal_async_spider <url>` 运行"""
import argparse
import sys
from .config import Config
from .spider import UniversalSpider


def main():
    parser = argparse.ArgumentParser(
        description="通用异步全站爬虫 (Universal Async Spider)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python -m universal_async_spider https://example.com
  python -m universal_async_spider https://example.com -c 50 -d 0.2
  python -m universal_async_spider https://example.com --decryption aes --key mysecretkey12345
  python -m universal_async_spider https://example.com --resume  # 断点续传
        """
    )
    parser.add_argument("url", help="起始 URL（支持多个用逗号分隔）")
    parser.add_argument("-d", "--domain", action="append", default=[], help="允许的域名，可多次指定；默认自动使用起始 URL 域名")
    parser.add_argument("-o", "--output", default="output", help="输出目录，默认 ./output")
    parser.add_argument("-c", "--concurrency", type=int, default=20, help="并发数，默认 20")
    parser.add_argument("--delay", type=float, default=0.3, help="请求基础间隔（秒）")
    parser.add_argument("--depth", type=int, default=10, help="最大抓取深度，默认 10")
    parser.add_argument("--retries", type=int, default=5, help="最大重试次数，默认 5")
    parser.add_argument("--timeout", type=int, default=30, help="请求超时秒数，默认 30")
    parser.add_argument("--proxy", default=None, help="代理地址，如 http://127.0.0.1:7890")
    parser.add_argument("--user-agent", default=None, help="自定义 User-Agent")
    parser.add_argument("--decryption", default="auto", choices=["auto", "none", "aes", "base64", "json"], help="解密模式")
    parser.add_argument("--key", default=None, help="AES 解密密钥")
    parser.add_argument("--iv", default=None, help="AES 解密 IV")
    parser.add_argument("--no-resume", action="store_true", help="禁用断点续传，重新开始")
    parser.add_argument("--no-save-html", action="store_true", help="不保存 HTML 文件（仅统计）")
    parser.add_argument("--verify-ssl", action="store_true", default=True, help="校验 SSL 证书")
    parser.add_argument("--no-verify-ssl", dest="verify_ssl", action="store_false", help="跳过 SSL 证书校验")

    args = parser.parse_args()

    urls = [u.strip() for u in args.url.split(",") if u.strip()]
    domains = set(args.domain) if args.domain else set()

    cfg = Config(
        start_urls=urls,
        allowed_domains=domains,
        output_dir=args.output,
        concurrency=args.concurrency,
        delay=args.delay,
        max_depth=args.depth,
        max_retries=args.retries,
        timeout=args.timeout,
        proxy=args.proxy,
        user_agent=args.user_agent,
        decryption=args.decryption,
        decryption_key=args.key,
        decryption_iv=args.iv,
        resume=not args.no_resume,
        save_html=not args.no_save_html,
        verify_ssl=args.verify_ssl,
    )

    spider = UniversalSpider(cfg)
    try:
        spider.run()
    except KeyboardInterrupt:
        print("\n已中断。再次运行同命令将自动从断点续传。")
        sys.exit(130)


if __name__ == "__main__":
    main()
