#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
高级使用示例
演示：模式动态切换、自定义解密、代理使用、内容提取等进阶功能
"""

import asyncio
import re
import base64
from universal_crawler import UniversalCrawler, BS4Parse, XPathParse, RegexParse, JSDecryptor


def example_custom_decrypt(html: str, url: str) -> str:
    """
    自定义解密函数示例
    针对某类特定加密网站的解密逻辑
    """
    # 示例1：解密页面中嵌入的Base64加密内容
    b64_pattern = re.compile(r'var\s+content\s*=\s*["\']([A-Za-z0-9+/=]+)["\']')
    match = b64_pattern.search(html)
    if match:
        try:
            decoded = JSDecryptor.decode_base64(match.group(1))
            html = html.replace(match.group(0), f'var content = "{decoded}"')
            print(f"[+] 解密了页面中的Base64内容: {url}")
        except:
            pass
    
    # 示例2：移除简单的JS混淆干扰
    html = html.replace('document.write(unescape("', '')
    html = html.replace('"));', '')
    
    return html


async def example_1_basic_crawl():
    """示例1：基础全站爬取（边爬边下+BS4解析）"""
    print("=" * 50)
    print("示例1：基础全站爬取 - 边爬边下 + BS4解析")
    print("=" * 50)
    
    crawler = UniversalCrawler(
        start_url='https://quotes.toscrape.com',  # 练习用爬取站点
        output_dir='./example_basic_output',
        crawl_mode='stream',
        parse_mode='bs4',
        concurrency=10,
        delay=0.5,
        download_resources=True
    )
    await crawler.start()


async def example_2_memory_mode():
    """示例2：内存队列模式（先收集URL再下载）+ XPath解析"""
    print("=" * 50)
    print("示例2：内存队列模式 + XPath解析")
    print("=" * 50)
    
    crawler = UniversalCrawler(
        start_url='https://quotes.toscrape.com',
        output_dir='./example_memory_output',
        crawl_mode='memory',    # 先收集所有URL再统一下载
        parse_mode='xpath',     # 使用XPath解析
        concurrency=10,
        delay=0.3
    )
    await crawler.start()


async def example_3_mode_switch():
    """示例3：运行时动态切换模式"""
    print("=" * 50)
    print("示例3：运行时动态切换抓取和解析模式")
    print("=" * 50)
    
    crawler = UniversalCrawler(
        start_url='https://quotes.toscrape.com',
        output_dir='./example_switch_output',
        crawl_mode='stream',
        parse_mode='bs4',
        concurrency=5
    )
    
    # 动态切换解析模式到正则
    print("[*] 切换解析模式为：regex")
    crawler.switch_parse_mode('regex')
    
    # 动态切换抓取模式到内存队列
    print("[*] 切换抓取模式为：memory")
    crawler.switch_crawl_mode('memory')
    
    await crawler.start()


async def example_4_with_decrypt():
    """示例4：带自定义解密的爬取"""
    print("=" * 50)
    print("示例4：带自定义JS解密的爬取")
    print("=" * 50)
    
    crawler = UniversalCrawler(
        start_url='https://example.com',
        output_dir='./example_decrypt_output',
        crawl_mode='stream',
        parse_mode='bs4',
        concurrency=10,
        custom_decryptor=example_custom_decrypt  # 传入自定义解密器
    )
    await crawler.start()


async def example_5_parse_content():
    """示例5：爬取后使用三种解析器提取结构化内容"""
    print("=" * 50)
    print("示例5：三种解析模式内容提取演示")
    print("=" * 50)
    
    sample_html = """
    <html>
        <head><title>测试页面</title></head>
        <body>
            <h1 class="title">文章标题</h1>
            <div class="content">这是文章内容段落1</div>
            <div class="content">这是文章内容段落2</div>
            <a href="/page1.html">链接1</a>
            <a href="/page2.html">链接2</a>
            <img src="/image.jpg" />
        </body>
    </html>
    """
    
    # 使用BS4解析
    bs4_parser = BS4Parse()
    bs4_result = bs4_parser.parse_content(sample_html, selectors={
        'titles': 'h1.title',
        'contents': '.content'
    })
    print("BS4解析结果：")
    print(f"  标题: {bs4_result['title']}")
    print(f"  自定义标题: {bs4_result.get('titles', [])}")
    print(f"  内容块: {bs4_result.get('contents', [])}")
    
    # 使用XPath解析
    xpath_parser = XPathParse()
    xpath_result = xpath_parser.parse_content(sample_html, selectors={
        'titles': '//h1/text()',
        'contents': '//div[@class="content"]/text()'
    })
    print("\nXPath解析结果：")
    print(f"  标题: {xpath_result['title']}")
    print(f"  自定义标题: {xpath_result.get('titles', [])}")
    
    # 使用正则解析
    re_parser = RegexParse()
    re_result = re_parser.parse_content(sample_html, selectors={
        'titles': r'<h1[^>]*>([^<]+)</h1>',
        'contents': r'<div class="content">([^<]+)</div>'
    })
    print("\n正则解析结果：")
    print(f"  标题: {re_result['title']}")
    print(f"  内容块: {re_result.get('contents', [])}")
    
    print("\n解析链接测试：")
    base_url = 'https://example.com/index.html'
    print(f"BS4提取链接数: {len(bs4_parser.parse_links(sample_html, base_url))}")
    print(f"XPath提取链接数: {len(xpath_parser.parse_links(sample_html, base_url))}")
    print(f"正则提取链接数: {len(re_parser.parse_links(sample_html, base_url))}")


async def example_6_resume_crawl():
    """示例6：断点续传演示（中断后重新运行自动继续）"""
    print("=" * 50)
    print("示例6：断点续传演示")
    print("=" * 50)
    print("提示：运行中途按Ctrl+C中断，再次运行将自动从断点继续")
    
    crawler = UniversalCrawler(
        start_url='https://quotes.toscrape.com',
        output_dir='./example_resume_output',
        crawl_mode='stream',
        parse_mode='bs4',
        concurrency=10,
        resume=True  # 启用断点续传
    )
    await crawler.start()


if __name__ == '__main__':
    print("通用爬虫高级示例")
    print("请选择要运行的示例：")
    print("1 - 基础爬取（边爬边下+BS4）")
    print("2 - 内存队列模式+XPath解析")
    print("3 - 运行时动态切换模式")
    print("4 - 带自定义JS解密爬取")
    print("5 - 三种解析器内容提取演示")
    print("6 - 断点续传演示")
    
    choice = input("\n请输入示例编号 (默认: 5): ").strip() or "5"
    
    examples = {
        '1': example_1_basic_crawl,
        '2': example_2_memory_mode,
        '3': example_3_mode_switch,
        '4': example_4_with_decrypt,
        '5': example_5_parse_content,
        '6': example_6_resume_crawl
    }
    
    if choice in examples:
        asyncio.run(examples[choice]())
    else:
        print("无效选择，运行解析演示示例...")
        asyncio.run(example_5_parse_content())
