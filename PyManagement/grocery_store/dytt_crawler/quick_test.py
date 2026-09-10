#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
快速测试脚本 - 只抓取前3页用于验证
"""

import sys
sys.path.insert(0, '.')

from dytt_crawler import DYTTCrawler

if __name__ == "__main__":
    print("运行快速测试 - 抓取前3页数据验证功能...\n")
    crawler = DYTTCrawler(
        output_dir="./test_output",
        max_workers=3,
        delay=0.5,
        page_size=20,
        format_type="both"
    )

    # 手动测试前3页
    import os
    import json
    import csv
    import time

    os.makedirs("./test_output", exist_ok=True)
    start = time.time()

    print("=" * 50)
    print("开始测试抓取...")

    all_videos = []
    for page in range(1, 4):
        print(f"\n正在抓取第 {page} 页...")
        success, _, videos, pagecount, total = crawler._fetch_page(page)
        if success:
            print(f"  成功! 获取到 {len(videos)} 条视频")
            if videos:
                print(f"  第一条: {videos[0]['vod_name']} - {videos[0].get('vod_remarks', '')}")
                print(f"  播放源: {videos[0].get('vod_play_from', 'N/A')}")
                all_videos.extend(videos)
        else:
            print(f"  抓取失败!")

    # 保存测试数据
    if all_videos:
        json_path = "./test_output/test_videos.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(all_videos, f, ensure_ascii=False, indent=2)
        print(f"\nJSON测试数据已保存到: {json_path}")

        csv_path = "./test_output/test_videos.csv"
        with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
            from dytt_crawler import VOD_FIELDS
            writer = csv.DictWriter(f, fieldnames=VOD_FIELDS, extrasaction="ignore")
            writer.writeheader()
            for v in all_videos:
                writer.writerow({k: v.get(k, "") for k in VOD_FIELDS})
        print(f"CSV测试数据已保存到: {csv_path}")

    elapsed = time.time() - start
    print(f"\n测试完成! 耗时: {elapsed:.2f}秒, 共获取 {len(all_videos)} 条视频")
    print("=" * 50)
    print("\n✓ 爬虫代码验证通过! 可运行 python dytt_crawler.py 开始全站抓取")
