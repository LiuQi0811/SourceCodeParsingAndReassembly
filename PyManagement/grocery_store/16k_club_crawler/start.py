#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
快速启动脚本 - 交互式配置爬虫参数
"""

import os
import sys


def print_banner():
    print("=" * 60)
    print("    16k.club 全站爬虫 - 支持自动解密反爬")
    print("=" * 60)
    print()


def main():
    print_banner()

    print("请选择爬取模式:")
    print("  1. 全站爬取（爬取网站所有小说）")
    print("  2. 单本小说（输入小说详情页URL）")
    print("  3. 分类爬取（输入分类页面URL）")
    print("  4. 仅导出小说列表（不下载内容）")
    print()

    choice = input("请输入选项 (1-4，默认1): ").strip() or "1"

    # 默认配置
    url = "https://16k.club"
    threads = "5"
    delay = "1.0"
    output = "novels"
    extra_args = []

    if choice == "1":
        print("\n[全站爬取模式]")
        url = input(f"网站首页地址 (默认 {url}): ").strip() or url
        max_novels = input("最多爬取多少本小说 (直接回车不限制): ").strip()
        max_pages = input("最多爬取多少个页面 (直接回车不限制): ").strip()
        threads = input(f"并发线程数 (默认 {threads}): ").strip() or threads
        delay = input(f"请求延迟秒数 (默认 {delay}): ").strip() or delay
        output = input(f"输出目录 (默认 {output}): ").strip() or output

        if max_novels:
            extra_args.extend(["--max-novels", max_novels])
        if max_pages:
            extra_args.extend(["--max-pages", max_pages])

    elif choice == "2":
        print("\n[单本小说模式]")
        novel_url = input("请输入小说详情页URL: ").strip()
        if not novel_url:
            print("URL不能为空！")
            return
        extra_args.extend(["--novel", novel_url])
        threads = input(f"并发线程数 (默认 {threads}): ").strip() or threads
        delay = input(f"请求延迟秒数 (默认 {delay}): ").strip() or delay
        output = input(f"输出目录 (默认 {output}): ").strip() or output

    elif choice == "3":
        print("\n[分类爬取模式]")
        category_url = input("请输入分类页面URL: ").strip()
        if not category_url:
            print("URL不能为空！")
            return
        extra_args.extend(["--category", category_url])
        max_novels = input("最多爬取多少本小说 (直接回车不限制): ").strip()
        threads = input(f"并发线程数 (默认 {threads}): ").strip() or threads
        delay = input(f"请求延迟秒数 (默认 {delay}): ").strip() or delay
        output = input(f"输出目录 (默认 {output}): ").strip() or output
        if max_novels:
            extra_args.extend(["--max-novels", max_novels])

    elif choice == "4":
        print("\n[仅导出小说列表模式]")
        url = input(f"网站首页地址 (默认 {url}): ").strip() or url
        max_novels = input("最多爬取多少本小说 (直接回车不限制): ").strip()
        extra_args.append("--list-only")
        if max_novels:
            extra_args.extend(["--max-novels", max_novels])
        threads = input(f"并发线程数 (默认 3): ").strip() or "3"
        delay = input(f"请求延迟秒数 (默认 1.0): ").strip() or "1.0"
        output = input(f"输出目录 (默认 {output}): ").strip() or output

    else:
        print("无效选项！")
        return

    # 构建命令
    cmd = [
        sys.executable, "crawler.py",
        "-u", url,
        "-o", output,
        "-t", threads,
        "-d", delay,
    ] + extra_args

    print("\n" + "=" * 60)
    print("即将执行命令:")
    print(" ".join(cmd))
    print("=" * 60)
    print()

    confirm = input("确认开始爬取？(Y/n): ").strip().lower()
    if confirm in ['', 'y', 'yes']:
        print("\n[*] 启动爬虫...\n")
        os.execv(sys.executable, cmd)
    else:
        print("已取消")


if __name__ == "__main__":
    main()
