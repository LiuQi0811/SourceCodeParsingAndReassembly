#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""快速演示版：每个分类仅爬前1页，快速验证产物结构"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import spider_6vdy as s
import json, time

def quick_demo():
    os.makedirs(s.OUTPUT_DIR, exist_ok=True)
    seen = s.load_seen()
    results = []
    all_urls = []
    for cat_path, cat_name in s.CATEGORIES:
        # demo：只爬第一页
        links = s.parse_list_page(cat_path, 1)
        print(f"[{cat_name}] 首页链接数: {len(links)}")
        for l in links:
            if l not in seen:
                all_urls.append((l, cat_name))
        time.sleep(0.3)

    print(f"\n待抓取演示详情页：{len(all_urls)} 条\n")
    done = 0
    for url, cat in all_urls:
        try:
            data = s.parse_detail(url, cat)
            if data:
                results.append(data)
                seen.add(url)
                done += 1
                cnt = len(data['magnets'])+len(data['netdisks'])+len(data['thunders'])+len(data['ed2ks'])+len(data['ftps'])
                print(f"[{done}/{len(all_urls)}] [{cat}] {data['title']} -> {cnt} links")
        except Exception as e:
            print(f"err {url}: {e}")

    s.save_results(results)
    s.save_seen(seen)
    print(f"\n完成！共抓取 {len(results)} 部影片")

if __name__ == "__main__":
    quick_demo()
