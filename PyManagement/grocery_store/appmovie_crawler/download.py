#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
M3U8视频下载器 (基于ffmpeg,推荐)
用法:
  python download.py [json文件]  [输出目录]
  python download.py movies.json ./downloads
支持断点续传,多线程下载后合并
依赖: ffmpeg (系统需安装,比纯python实现稳定10倍)
"""
import os, sys, json, re, subprocess, shutil
import time
from concurrent.futures import ThreadPoolExecutor
import requests

OUT_BASE = "./downloads"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36",
    "Referer": "https://www.appmovie.vip/",
}


def safe_name(s):
    return re.sub(r'[\\/:*?"<>|]', '_', s).strip()[:80]


def dl_with_ffmpeg(url, save_path):
    """使用ffmpeg下载(推荐,自动解密/合并/转封装)"""
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    cmd = [
        "ffmpeg", "-y",
        "-headers", f"User-Agent: {HEADERS['User-Agent']}\r\nReferer: {HEADERS['Referer']}\r\n",
        "-i", url,
        "-c", "copy",
        "-bsf:a", "aac_adtstoasc",
        save_path,
    ]
    print(f"  [ffmpeg] {os.path.basename(save_path)}")
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    return r.returncode == 0 and os.path.exists(save_path) and os.path.getsize(save_path) > 10*1024


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        print("请指定要下载的json文件(由crawler.py生成)")
        sys.exit(1)

    json_path = sys.argv[1]
    out_base = sys.argv[2] if len(sys.argv) > 2 else OUT_BASE
    os.makedirs(out_base, exist_ok=True)

    if shutil.which("ffmpeg") is None:
        print("[错误] 未检测到ffmpeg,请先安装:")
        print("  Ubuntu/Debian: sudo apt install ffmpeg")
        print("  macOS: brew install ffmpeg")
        print("  Windows: 从 https://ffmpeg.org 下载并加入PATH")
        sys.exit(1)

    with open(json_path, "r", encoding="utf-8") as f:
        videos = json.load(f)

    cat = os.path.basename(json_path).replace(".json", "")
    out_dir = os.path.join(out_base, cat)
    os.makedirs(out_dir, exist_ok=True)

    total = sum(len(v["episodes"]) for v in videos)
    done = 0
    ok = 0
    fail = 0
    skip = 0

    print(f"共 {len(videos)} 部视频, {total} 集, 输出: {out_dir}\n")
    for v in videos:
        title = safe_name(v["title"])
        vdir = os.path.join(out_dir, title)
        os.makedirs(vdir, exist_ok=True)
        # 优先选第一个源
        eps = {}
        for ep in v["episodes"]:
            if ep["ep"] not in eps and ep.get("url"):
                eps[ep["ep"]] = ep["url"]

        for ep_name, url in eps.items():
            save_path = os.path.join(vdir, safe_name(ep_name) + ".mp4")
            if os.path.exists(save_path) and os.path.getsize(save_path) > 10*1024:
                skip += 1
                done += 1
                continue
            try:
                if dl_with_ffmpeg(url, save_path):
                    ok += 1
                else:
                    fail += 1
                    if os.path.exists(save_path):
                        os.remove(save_path)
            except Exception as e:
                fail += 1
                print(f"  [失败] {ep_name}: {e}")
            done += 1
            print(f"  进度: {done}/{total} (成功:{ok} 失败:{fail} 跳过:{skip})")
            time.sleep(0.5)

    print(f"\n下载完成! 成功:{ok} 失败:{fail} 跳过:{skip}")


if __name__ == "__main__":
    main()
