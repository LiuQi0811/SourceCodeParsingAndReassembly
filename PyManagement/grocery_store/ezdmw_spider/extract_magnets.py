#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从已抓取的动漫数据中提取全部磁力链接，导出为文本/CSV方便使用
用法:
  python extract_magnets.py              # 生成 magnets.txt（人类可读）和 magnets.csv（表格）
  python extract_magnets.py --anime "从零" # 只导出标题含关键词的动漫
"""
import os
import json
import csv
import argparse
from glob import glob

OUTPUT_DIR = "ezdmw_data"


def main():
    parser = argparse.ArgumentParser(description="从爬虫结果中提取磁力链接")
    parser.add_argument("--anime", type=str, default="", help="只导出标题包含关键词的动漫")
    parser.add_argument("--output-dir", type=str, default=OUTPUT_DIR, help="数据目录")
    args = parser.parse_args()

    anime_file = os.path.join(args.output_dir, "anime.json")
    if not os.path.exists(anime_file):
        print(f"未找到 {anime_file}，请先运行 ezdmw_spider.py 抓取数据")
        return

    with open(anime_file, "r", encoding="utf-8") as f:
        anime_list = json.load(f)

    keyword = args.anime.strip()
    results = []
    for anime in anime_list:
        title = anime.get("title", "")
        if keyword and keyword not in title:
            continue
        magnets = anime.get("magnets", [])
        for m in magnets:
            results.append({
                "title": title,
                "year": anime.get("year", ""),
                "status": anime.get("status", ""),
                "tags": " ".join(anime.get("tags", [])),
                "name": m.get("name", ""),
                "magnet": m.get("magnet", ""),
                "url": anime.get("url", ""),
            })

    print(f"共找到 {len(results)} 条磁力链接，来自 {len(set(r['title'] for r in results))} 部动漫")

    # 写入 txt
    txt_path = os.path.join(args.output_dir, "magnets.txt")
    with open(txt_path, "w", encoding="utf-8") as f:
        current_title = ""
        for r in results:
            if r["title"] != current_title:
                f.write(f"\n{'='*60}\n")
                f.write(f"【{r['title']}】({r['status']}) {r['tags']}\n")
                f.write(f"链接: {r['url']}\n")
                f.write(f"{'='*60}\n")
                current_title = r["title"]
            f.write(f"{r['name']}\n{r['magnet']}\n\n")

    # 写入 csv
    csv_path = os.path.join(args.output_dir, "magnets.csv")
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["title", "year", "status", "tags", "name", "magnet", "url"])
        writer.writeheader()
        writer.writerows(results)

    print(f"已导出:")
    print(f"  文本格式: {os.path.abspath(txt_path)}")
    print(f"  CSV表格:  {os.path.abspath(csv_path)}")


if __name__ == "__main__":
    main()
