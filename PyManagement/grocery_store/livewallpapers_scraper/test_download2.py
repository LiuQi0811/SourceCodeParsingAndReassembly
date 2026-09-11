import requests
import re

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

session = requests.Session()
session.headers.update(headers)

# 先用HEAD请求测试
download_urls = [
    'https://livewallpapers4free.com/download/52617/',
    'https://livewallpapers4free.com/download/52614/',
    'https://livewallpapers4free.com/wp-content/uploads/2026/09/goku-fury-of-the-saiyan-VIDEO-zxcv.mp4',
]

for dl_url in download_urls:
    print(f"\n[*] HEAD测试: {dl_url}")
    try:
        resp = session.head(dl_url, allow_redirects=True, timeout=15)
        print(f"  最终URL: {resp.url}")
        print(f"  状态码: {resp.status_code}")
        print(f"  Content-Type: {resp.headers.get('Content-Type')}")
        print(f"  Content-Length: {resp.headers.get('Content-Length')}")
        print(f"  Content-Disposition: {resp.headers.get('Content-Disposition', '无')}")
    except requests.exceptions.Timeout:
        print("  超时!")
    except Exception as e:
        print(f"  错误: {e}")

# 测试直接访问带Range头
print("\n[*] 带Range头测试下载链接")
try:
    range_headers = headers.copy()
    range_headers['Range'] = 'bytes=0-1023'
    resp = session.get('https://livewallpapers4free.com/download/52617/', 
                      headers=range_headers, 
                      allow_redirects=True, 
                      timeout=20)
    print(f"  状态码: {resp.status_code}")
    print(f"  最终URL: {resp.url}")
    print(f"  Content-Type: {resp.headers.get('Content-Type')}")
    print(f"  Content-Length: {resp.headers.get('Content-Length')}")
    content = resp.content[:100]
    print(f"  前100字节hex: {content.hex()}")
except Exception as e:
    print(f"  错误: {e}")
