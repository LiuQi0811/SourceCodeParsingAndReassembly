#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试爬虫 - 仅下载前2页的前几张图片验证功能
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from baozangtuku_spider import (
    BASE_URL, HEADERS, session, get_soup, download_image,
    safe_filename, get_detail_page
)

def test_download():
    """测试下载功能"""
    print("="*50)
    print("测试宝藏图库爬虫...")
    print("="*50)
    
    # 创建测试目录
    test_dir = "测试下载"
    os.makedirs(test_dir, exist_ok=True)
    
    # 测试1: 访问首页
    print("\n1. 测试访问网站...")
    soup = get_soup(BASE_URL)
    if soup:
        print("   ✓ 网站访问成功")
    else:
        print("   ✗ 网站访问失败")
        return
    
    # 测试2: 测试已知原图URL是否可访问
    print("\n2. 测试原图下载（去掉small前缀验证）...")
    test_small_url = "https://www.baozangtuku.com/d/file/p/20260908/small7195565d7949e0c0f5182d7b833b544e.jpg"
    test_original_url = test_small_url.replace("small", "")
    print(f"   缩略图URL: {test_small_url}")
    print(f"   原图URL:   {test_original_url}")
    
    test_save_path = os.path.join(test_dir, "测试图片_麻匪雪竹_4K.jpg")
    result = download_image(test_original_url, test_save_path)
    
    if result and os.path.exists(test_save_path):
        size_mb = os.path.getsize(test_save_path) / 1024 / 1024
        print(f"   ✓ 原图下载成功! 文件大小: {size_mb:.2f}MB")
    else:
        print("   ✗ 原图下载失败")
    
    # 测试3: 访问一个详情页提取图片
    print("\n3. 测试详情页图片提取...")
    detail_url = "https://www.baozangtuku.com/dongman/4794.html"
    title, img_urls = get_detail_page(detail_url, "动漫壁纸")
    print(f"   标题: {title}")
    print(f"   提取到图片数: {len(img_urls)}")
    for i, url in enumerate(img_urls[:3]):
        print(f"   图片{i+1}: {url}")
    
    print("\n" + "="*50)
    print("测试完成!")
    print(f"测试图片保存在: {os.path.abspath(test_dir)}")
    print("\n运行完整爬虫请执行: python baozangtuku_spider.py")
    print("="*50)


if __name__ == "__main__":
    test_download()
