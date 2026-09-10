#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import spider_6vdy as s

results = []
test_pairs = [
    ("xijupian", "喜剧片"),
    ("dongzuopian", "动作片"),
    ("juqingpian", "剧情片"),
]
for cat_path, cat_name in test_pairs:
    links = s.parse_list_page(cat_path, 1)[:5]
    for url in links:
        data = s.parse_detail(url, cat_name)
        if data:
            results.append(data)
            cnt = len(data['magnets'])+len(data['netdisks'])+len(data['thunders'])+len(data['ed2ks'])+len(data['ftps'])
            print(f"[{cat_name}] {data['title']} -> magnets={len(data['magnets'])}, netdisk={len(data['netdisks'])}, total={cnt}")

s.save_results(results)
print(f"\n共 {len(results)} 部，已保存到 {s.OUTPUT_DIR}")
