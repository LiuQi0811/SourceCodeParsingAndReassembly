#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""快速验证解析正确性：抓第1类前1页 + 3个详情"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ymck_spider import (
    fetch_list_page, fetch_detail, parse_list_page, parse_detail_page,
    CATEGORIES, mkdir_p, flush_data, write_csv, BASE_URL
)

def main():
    print("=" * 50)
    print("测试1：抓取分类1第1页（电影）")
    movies, total_pages = fetch_list_page(1, 1)
    print(f"  返回影片数: {len(movies) if movies else 0}")
    print(f"  总页数: {total_pages}")
    if movies:
        for m in movies[:5]:
            print(f"    id={m['id']}  title={m['title'][:30]}  poster={'有' if m['poster'] else '无'}")

    print()
    print("测试2：抓取3个详情页")
    test_ids = [m['id'] for m in movies[:3]] if movies else [123325, 123326, 123324]
    results = {}
    for mid in test_ids:
        d = fetch_detail(mid)
        if d:
            results[mid] = d
            print(f"  [{mid}] {d.get('title','')}")
            print(f"     年份={d.get('year')}  评分={d.get('rating')}  导演={d.get('director','')[:20]}")
            print(f"     分类={d.get('categories')}")
            print(f"     演员={d.get('actors', [])[:3]}")
            print(f"     简介={d.get('intro','')[:60]}...")
            print(f"     海报={d.get('poster','')[:60]}")
            print(f"     海报本地={d.get('poster_local','')}")
        else:
            print(f"  [{mid}] 抓取失败")

    # 保存测试结果
    flush_data(results)
    write_csv(results)
    print()
    print(f"测试数据已保存到 ymck_data/")
    print("=" * 50)
    print("若上面输出正常，则爬虫可直接运行 python3 ymck_spider.py 全站抓取")

if __name__ == "__main__":
    main()
