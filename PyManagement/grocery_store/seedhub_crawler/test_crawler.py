#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SeedHub爬虫快速测试脚本
只抓取前几页验证功能是否正常
"""

import sys
sys.path.insert(0, '.')

from seedhub_crawler import *

# 测试模式：只抓取少量页面
OUTPUT_DIR = "seedhub_test"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def test_crawler():
    print("=== SeedHub 爬虫功能测试 ===")
    
    # 1. 测试首页访问
    print("\n1. 测试访问首页...")
    html = fetch(BASE_URL)
    if html:
        print(f"   ✓ 首页访问成功，长度: {len(html)} 字符")
    else:
        print("   ✗ 首页访问失败!")
        return
    
    # 2. 测试提取链接
    print("\n2. 测试链接提取...")
    links = extract_links(html, BASE_URL)
    movie_links = [l for l in links if is_movie_url(l)]
    list_links = [l for l in links if is_list_url(l)]
    print(f"   ✓ 提取到 {len(links)} 个链接")
    print(f"   ✓ 其中影片详情页: {len(movie_links)} 个")
    print(f"   ✓ 其中列表/分类页: {len(list_links)} 个")
    
    # 3. 测试解析单个影片页
    if movie_links:
        test_url = list(movie_links)[0]
        print(f"\n3. 测试解析影片详情页: {test_url}")
        movie_html = fetch(test_url)
        if movie_html:
            movie = parse_movie_page(test_url, movie_html)
            print(f"   ✓ 标题: {movie['title']}")
            print(f"   ✓ 评分: {movie['rating'] or '无'}")
            print(f"   ✓ 年份: {movie['year'] or '无'}")
            print(f"   ✓ 封面: {'有' if movie['cover'] else '无'}")
            print(f"   ✓ 资源链接数: {len(movie['pan_links'])}")
            
            if movie['pan_links']:
                print("\n   资源列表示例:")
                for i, pan in enumerate(movie['pan_links'][:5], 1):
                    pwd = f" (提取码: {pan['pwd']})" if pan.get('pwd') else ""
                    print(f"     {i}. [{pan['type']}] {pan['url'][:60]}...{pwd}")
    
    # 4. 测试link_start跳转解析
    print("\n4. 测试网盘跳转页解析...")
    test_pan_url = "https://www.seedhub.cc/link_start/?redirect_to=pan_id_804633"
    pan_html = fetch(test_pan_url)
    if pan_html:
        pan_match = re.search(r'var panLink\s*=\s*"([^"]+)"', pan_html)
        if pan_match:
            real_link = pan_match.group(1)
            print(f"   ✓ 跳转页解析成功!")
            print(f"   ✓ 原始跳转页: {test_pan_url}")
            print(f"   ✓ 真实网盘链接: {real_link}")
            print(f"   ✓ 网盘类型: {identify_pan_type(real_link)}")
            print(f"\n   ✅ 验证结论: 网站无加密! 真实链接直接在页面JS中!")
        else:
            print("   ✗ 未找到panLink变量")
    else:
        print("   ✗ 跳转页访问失败!")
    
    print("\n=== 测试完成 ===")
    print("\n使用方法:")
    print("  python seedhub_crawler.py        # 开始全站爬取")
    print("  python seedhub_crawler.py export # 仅导出CSV/Markdown")
    print("  python seedhub_crawler.py covers # 仅下载封面图片")
    print("\n特性:")
    print("  ✓ 自动断点续爬（中断后再次运行会继续）")
    print("  ✓ 自动请求延迟，防止被封IP")
    print("  ✓ 支持夸克/百度/迅雷/UC/阿里云盘/磁力链接")
    print("  ✓ 自动提取网盘提取码")
    print("  ✓ 导出JSON/CSV/Markdown三种格式")
    print("  ✓ 可选择下载封面图片")

if __name__ == "__main__":
    test_crawler()
