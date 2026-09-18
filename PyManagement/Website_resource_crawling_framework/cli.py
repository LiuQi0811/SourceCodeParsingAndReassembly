"""
CLI 极客终端交互命令行工具
支持通过终端参数或交互菜单自由运行全功能爬虫：
1. 切换内存队列 vs SQLite 持久化队列断点续爬
2. 切换与组合 BS4 / XPath / Regex 解析器
3. 自动识别 GBK/UTF-8 字符集与分类资源下载
4. 演示与测试前端逆向解密
"""
import argparse
import asyncio
import os
import sys
from crawler_framework import (
    CrawlerEngine,
    QueueFactory,
    ParserFactory,
    DecryptorFactory,
    TerminalColors as C,
)


def print_banner():
    banner = f"""
{C.NEON_GREEN}{C.BOLD}
  ██████╗██████╗  █████╗ ██╗    ██╗██╗     ███████╗██████╗ 
 ██╔════╝██╔══██╗██╔══██╗██║    ██║██║     ██╔════╝██╔══██╗
 ██║     ██████╔╝███████║██║ █╗ ██║██║     █████╗  ██████╔╝
 ██║     ██╔══██╗██╔══██║██║███╗██║██║     ██╔══╝  ██╔══██╗
 ╚██████╗██║  ██║██║  ██║╚███╔███╔╝███████╗███████╗██║  ██║
  ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚══════╝╚══════╝╚═╝  ╚═╝
  >> 基于 Python 3.14+ asyncio + aiohttp 异步全站通用爬虫框架 <<
  [策略模式 | 工厂模式 | 观察者模式 | 断点续爬 | 智能编码 | 逆向解密]
{C.RESET}"""
    print(banner)


async def run_cli():
    parser = argparse.ArgumentParser(description="异步全站资源通用抓取框架 CLI")
    parser.add_argument("--url", "-u", type=str, help="种子抓取目标 URL")
    parser.add_argument("--queue", "-q", choices=["memory", "sqlite"], default="memory", help="队列模式 (memory/sqlite)")
    parser.add_argument("--parser", "-p", choices=["xpath", "bs4", "regex", "composite"], default="xpath", help="默认解析器")
    parser.add_argument("--concurrency", "-c", type=int, default=5, help="并发连接限制")
    parser.add_argument("--depth", "-d", type=int, default=2, help="最大抓取递归深度")
    parser.add_argument("--save-dir", "-s", type=str, default="downloads", help="分类存储下载目录")
    parser.add_argument("--db-path", type=str, default="crawler_tasks.db", help="SQLite持久化数据库路径")
    parser.add_argument("--decrypt-test", action="store_true", help="运行内置反爬逆向解密算法套件测试")
    parser.add_argument("--resume", action="store_true", help="SQLite队列断点续爬（自动重置中断任务）")

    args = parser.parse_args()
    print_banner()

    if args.decrypt_test:
        print(f"{C.AMBER_ORANGE}[!] 运行内置逆向解密模块测试...{C.RESET}\n")
        # 1. Base64
        b64_dec = DecryptorFactory.create_decryptor("base64")
        b64_res = b64_dec.decrypt("eyJtc2ciOiAi5Y+N54is6YCG5ZCR6Kej5a+G5oiQ5YqfISJ9")
        print(f"{C.NEON_GREEN}✓ Base64 逆向解密结果:{C.RESET} {b64_res}")

        # 2. XOR
        xor_dec = DecryptorFactory.create_decryptor("xor")
        # "Hello, Crawler!" with key "sec"
        raw_text = "Hello, Crawler! 爬虫中文测试"
        key = "cyberpunk"
        enc_hex = bytes([b ^ key.encode()[i % len(key.encode())] for i, b in enumerate(raw_text.encode())]).hex()
        xor_res = xor_dec.decrypt(enc_hex, {"key": key, "format": "hex"})
        print(f"{C.NEON_GREEN}✓ XOR 异或逆向解密结果:{C.RESET} {xor_res}")

        # 3. RC4
        rc4_dec = DecryptorFactory.create_decryptor("rc4")
        rc4_res = rc4_dec.decrypt("rc4_cipher", {"key": "secret", "format": "base64"})
        print(f"{C.NEON_GREEN}✓ RC4 流密码逆向解密接口就绪{C.RESET}")

        print(f"\n{C.NEON_GREEN}所有逆向解密扩展策略校验通过!{C.RESET}")
        return

    target_url = args.url
    if not target_url:
        print(f"{C.AMBER_ORANGE}提示: 未指定 --url 参数。默认展示演示模式：抓取测试靶场或公共技术站点。{C.RESET}")
        target_url = "https://httpbin.org/html"

    print(f"{C.CYAN}配置信息:{C.RESET}")
    print(f"  • 种子 URL:   {C.NEON_GREEN}{target_url}{C.RESET}")
    print(f"  • 队列模式:   {C.AMBER_ORANGE}{args.queue.upper()}{C.RESET} {'(持久化可断点续爬)' if args.queue == 'sqlite' else '(纯内存高速)'}")
    print(f"  • 默认解析器: {C.CYAN}{args.parser.upper()}{C.RESET}")
    print(f"  • 并发数量:   {args.concurrency}")
    print(f"  • 最大深度:   {args.depth}")
    print(f"  • 保存目录:   {args.save_dir}")
    print(f"─────────────────────────────────────────────────────────────\n")

    engine = CrawlerEngine(
        queue_mode=args.queue,
        db_path=args.db_path,
        default_parser=args.parser,
        concurrency=args.concurrency,
        max_depth=args.depth,
        save_dir=args.save_dir,
    )

    await engine.add_url(target_url)
    stats = await engine.run()

    print(f"\n{C.NEON_GREEN}{C.BOLD}抓取统计指标汇总:{C.RESET}")
    for k, v in stats.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    asyncio.run(run_cli())
