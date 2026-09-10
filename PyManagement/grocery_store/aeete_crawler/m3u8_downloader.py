#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
m3u8 视频下载器（可选使用）
============================
对爬虫输出的 JSON 中的 m3u8 直链，下载 ts 分片并合并为 mp4。
依赖：pip install m3u8  以及系统安装 ffmpeg

用法：
  python m3u8_downloader.py <m3u8_url> [输出文件名.mp4]
  python m3u8_downloader.py --from-json output/json/xxx.json   # 自动从json取第1集
"""

import os, sys, re, json, time, random, argparse, subprocess, shutil
import requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
    "Referer": "https://www.aeete.com/",
}


def download_with_ffmpeg(m3u8_url, out_path, headers=None):
    """推荐：用 ffmpeg 一键下载合并"""
    hdr_str = ""
    if headers:
        for k, v in headers.items():
            hdr_str += f"{k}: {v}\r\n"
    cmd = [
        "ffmpeg", "-y",
        "-headers", hdr_str,
        "-i", m3u8_url,
        "-c", "copy",
        "-bsf:a", "aac_adtstoasc",
        out_path,
    ]
    print("执行:", " ".join(cmd))
    subprocess.run(cmd, check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url", nargs="?", help="m3u8 地址")
    ap.add_argument("out", nargs="?", default="output.mp4", help="输出 mp4 路径")
    ap.add_argument("--from-json", help="从爬虫输出的 JSON 文件取 m3u8")
    args = ap.parse_args()

    m3u8_url = args.url
    if args.from_json:
        with open(args.from_json, encoding="utf-8") as f:
            data = json.load(f)
        eps = data.get("episodes", [])
        if not eps:
            print("JSON 中无集数信息"); sys.exit(1)
        m3u8_url = eps[0].get("m3u8")
        if not args.out or args.out == "output.mp4":
            args.out = re.sub(r'[\\/:*?"<>|]', '_', data.get("title", "video")) + ".mp4"
        print(f"从 JSON 读取：{data.get('title')} -> {m3u8_url}")

    if not m3u8_url:
        print("请提供 m3u8 地址或 --from-json 参数"); sys.exit(1)
    if not shutil.which("ffmpeg"):
        print("未检测到 ffmpeg，请先安装：apt install ffmpeg / brew install ffmpeg")
        sys.exit(1)
    download_with_ffmpeg(m3u8_url, args.out, HEADERS)
    print(f"✔ 下载完成: {args.out}")


if __name__ == "__main__":
    import shutil
    main()
