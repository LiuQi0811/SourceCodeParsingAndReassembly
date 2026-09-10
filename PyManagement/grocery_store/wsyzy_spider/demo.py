#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
快速入门示例 - 演示 wsyzy_spider 的各种用法
运行前请先安装依赖: pip install -r requirements.txt
"""

import sys
sys.path.insert(0, ".")

from wsyzy_spider import (
    WsyzyAPISpider,
    WsyzyHTMLSpider,
    DataExporter,
    M3U8Parser,
    OUTPUT_DIR,
    create_session,
)


def demo_1_crawl_newest():
    """示例1: 抓取最近24小时更新的内容（最快，最常用）"""
    print("=" * 50)
    print("示例1: 抓取最近24小时更新的视频")
    print("=" * 50)
    spider = WsyzyAPISpider()
    data = spider.fetch_all(recent_hours=24, threads=4)
    print(f"获取到最近24小时更新视频: {len(data)} 条\n")
    return data


def demo_2_crawl_by_category():
    """示例2: 抓取指定分类（如电影、国产剧）"""
    print("=" * 50)
    print("示例2: 抓取电影分类前5页")
    print("=" * 50)
    spider = WsyzyAPISpider()
    categories = spider.get_categories()
    print("可用分类:", list(categories.values()))
    # 找电影分类ID
    movie_id = None
    for tid, tname in categories.items():
        if tname == "电影":
            movie_id = tid
            break
    if movie_id:
        data = spider.fetch_all(type_id=movie_id, max_pages=5, threads=4)
        print(f"电影分类前5页共: {len(data)} 条\n")
        return data
    return []


def demo_3_search():
    """示例3: 按关键词搜索"""
    print("=" * 50)
    print("示例3: 搜索含'庆余年'的视频")
    print("=" * 50)
    spider = WsyzyAPISpider()
    data = spider.fetch_all(keyword="庆余年", threads=2)
    for v in data:
        print(f"  - [{v['type_name']}] {v['vod_name']} ({v['vod_remarks']})")
        if v["play_sources"]:
            eps = v["play_sources"][0]["episodes"]
            print(f"    共{len(eps)}集, 首集地址: {eps[0]['url'][:80]}...")
    print()
    return data


def demo_4_crawl_all_and_export():
    """示例4: 抓取全站所有数据并导出为多种格式"""
    print("=" * 50)
    print("示例4: 抓取全站前10页并导出为JSON/CSV/Excel")
    print("=" * 50)
    spider = WsyzyAPISpider()
    data = spider.fetch_all(max_pages=10, threads=8)
    # 导出
    exporter = DataExporter(data, OUTPUT_DIR)
    results = exporter.export(["json", "csv", "excel"])
    print("导出文件:")
    for fmt, path in results.items():
        print(f"  {fmt}: {path}")
    print()
    return data


def demo_5_parse_m3u8():
    """示例5: 获取m3u8解析播放地址"""
    print("=" * 50)
    print("示例5: m3u8播放地址解析")
    print("=" * 50)
    test_url = "https://v13.wsyzym3u8.com/202609/06/DQRx5thE4d27/video/index.m3u8"
    parse_url = M3U8Parser.get_parse_url(test_url, 0)
    print(f"原始m3u8地址: {test_url}")
    print(f"在线解析播放: {parse_url}")
    print()


def demo_6_list_categories():
    """示例6: 列出全部分类"""
    print("=" * 50)
    print("示例6: 列出所有视频分类")
    print("=" * 50)
    spider = WsyzyAPISpider()
    categories = spider.get_categories()
    total, pages = spider.get_total_info()
    print(f"全站共 {total:,} 条视频，{pages} 页")
    print(f"共 {len(categories)} 个分类:\n")
    for tid, tname in sorted(categories.items()):
        # 获取每个分类的数量
        cat_total, _ = spider.get_total_info(t=tid)
        print(f"  ID:{tid:3d}  {tname:<12s} ({cat_total:>8,d} 条)")
    print()


if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════╗
║  无水印资源站(wsyzy.cc) 爬虫 - 使用示例合集     ║
╚══════════════════════════════════════════════════╝
""")
    # 取消注释下面的行来运行不同示例
    demo_6_list_categories()
    demo_1_crawl_newest()
    demo_3_search()
    demo_5_parse_m3u8()
    # demo_2_crawl_by_category()  # 取消注释以运行
    # demo_4_crawl_all_and_export()  # 取消注释以运行

    print("所有示例运行完成！")
