#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
按 vod_id 或关键字从 catalog.jsonl 中读取 m3u8，并下载为 mp4。
依赖 spider.py 中的 download_m3u8。
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from spider import download_m3u8, safe_name, VIDEO_DIR, BASE_URL


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--vod-id", help="按 vod_id 下载")
    ap.add_argument("--keyword", help="按标题关键字模糊匹配下载")
    ap.add_argument("--sid", type=int, default=1, help="下载哪条线路，默认1")
    ap.add_argument("--out", help="指定输出mp4路径（单集时可用）")
    args = ap.parse_args()

    cat_path = Path(__file__).parent / "data" / "catalog.jsonl"
    if not cat_path.exists():
        print("未找到 data/catalog.jsonl，请先运行 spider.py 抓取元数据")
        sys.exit(1)

    targets = []
    with open(cat_path, "r", encoding="utf-8") as f:
        for line in f:
            try:
                d = json.loads(line)
            except Exception:
                continue
            if args.vod_id and str(d.get("vod_id")) != str(args.vod_id):
                continue
            if args.keyword and args.keyword not in (d.get("title") or ""):
                continue
            targets.append(d)

    if not targets:
        print("未匹配到视频，请先确认元数据已抓取或关键字/vod_id正确")
        sys.exit(2)

    for d in targets:
        title = d.get("title", f"vod_{d.get('vod_id')}")
        cat = d.get("category", "其他")
        eps = [e for e in d.get("episodes", []) if e.get("sid") == args.sid and e.get("m3u8")]
        print(f"[√] 命中《{title}》共 {len(eps)} 集")
        for i, ep in enumerate(eps, 1):
            fname = f"{safe_name(title)}_EP{ep['nid']}_{safe_name(ep.get('name',''))}.mp4"
            out = Path(args.out) if args.out and len(eps) == 1 else VIDEO_DIR / cat / fname
            out.parent.mkdir(parents=True, exist_ok=True)
            if out.exists() and out.stat().st_size > 1024:
                print(f"  [{i}/{len(eps)}] 已存在: {out.name}")
                continue
            print(f"  [{i}/{len(eps)}] 下载 {out.name}  ← {ep['m3u8']}")
            try:
                download_m3u8(ep["m3u8"], out, referer=ep.get("play_url", BASE_URL))
                print(f"      ✓ 完成 {out}")
            except Exception as e:
                print(f"      ✗ 失败: {e}")


if __name__ == "__main__":
    main()
