#!/usr/bin/env python3
import requests
import os
from pathlib import Path

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Range': 'bytes=0-',
    'Referer': 'https://livewallpapers4free.com/goku-fury-of-the-saiyan/',
}

session = requests.Session()

# 直接下载HD版本验证
url = 'https://livewallpapers4free.com/download/52617/'
save_path = Path('./test_download/goku_hd.mp4')
save_path.parent.mkdir(exist_ok=True)

print(f"下载: {url}")
resp = session.get(url, headers=headers, stream=True, timeout=120)
print(f"状态: {resp.status_code}, 类型: {resp.headers['Content-Type']}, 大小: {int(resp.headers['Content-Length'])/1024/1024:.1f}MB")

downloaded = 0
with open(save_path, 'wb') as f:
    for chunk in resp.iter_content(131072):
        if chunk:
            f.write(chunk)
            downloaded += len(chunk)
            print(f"\r已下载: {downloaded/1024/1024:.1f}MB", end='', flush=True)

print(f"\n完成! 文件大小: {os.path.getsize(save_path)/1024/1024:.2f}MB")

# 验证MP4头
with open(save_path, 'rb') as f:
    header = f.read(32)
    print(f"文件头hex: {header[:16].hex()}")
    print(f"是否有效MP4: {'ftyp' in header and header[4:8] == b'ftyp'}")
