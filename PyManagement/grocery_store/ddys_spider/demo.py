#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
快速演示：抓取首页最新24部影视的信息
运行: python demo.py
"""
import sys
sys.path.insert(0, '.')
from ddys_spider import *

def main():
    print("="*60)
    print("低端影视 ddys.io 爬虫演示")
    print("="*60)
    
    spider = DDYSSpider()
    
    # 1. 抓取首页
    print("\n[1/3] 抓取首页最新电影...")
    movies = fetch_page_list(spider.scraper, 'movie', 1)
    print(f"    获取到 {len(movies)} 部影视")
    
    # 2. 取前3部抓取详情
    print("\n[2/3] 获取前3部影视详情和视频源...")
    for movie in movies[:3]:
        print(f"\n  正在获取: {movie.get('title')}")
        detail = fetch_detail(spider.scraper, movie)
        if detail:
            sources = detail.get('video_sources', [])
            netdisks = detail.get('netdisk_resources', [])
            print(f"    播放源: {len(sources)}个")
            for src in sources:
                print(f"      - {src['source_name']} ({src['format']}): {src['episode_count']}集")
            print(f"    网盘资源: {len(netdisks)}个")
            for nd in netdisks:
                pwd = f" 提取码:{nd['password']}" if nd['password'] else ""
                print(f"      [{nd['type']}] {nd['url']}{pwd}")
        
        random_delay()
    
    # 3. 保存演示数据
    print("\n[3/3] 保存数据...")
    demo_file = OUTPUT_DIR / "demo_results.json"
    with open(demo_file, 'w', encoding='utf-8') as f:
        json.dump(movies[:10], f, ensure_ascii=False, indent=2)
    print(f"    前10部列表已保存到: {demo_file}")
    
    print("\n" + "="*60)
    print("演示完成!")
    print("="*60)
    print("\n完整功能请运行:")
    print("  python ddys_spider.py --help")
    print("\n注意: 下载视频需要安装ffmpeg")

if __name__ == "__main__":
    main()
