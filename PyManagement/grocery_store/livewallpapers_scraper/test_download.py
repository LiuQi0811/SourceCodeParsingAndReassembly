import requests
import re

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer': 'https://livewallpapers4free.com/goku-fury-of-the-saiyan/',
}

session = requests.Session()
session.headers.update(headers)

# 测试几个下载链接
download_urls = [
    'https://livewallpapers4free.com/download/52617/',  # HD
    'https://livewallpapers4free.com/download/52614/',  # 2K
    'https://livewallpapers4free.com/download/52611/',  # 4K
    'https://livewallpapers4free.com/wp-content/uploads/2026/09/goku-fury-of-the-saiyan-VIDEO-zxcv.mp4',  # 预览视频
]

for dl_url in download_urls:
    print(f"\n[*] 测试: {dl_url}")
    try:
        # 不自动跟随重定向
        resp = session.get(dl_url, allow_redirects=False, timeout=30, stream=True)
        print(f"  状态码: {resp.status_code}")
        print(f"  Location: {resp.headers.get('Location', '无')}")
        print(f"  Content-Type: {resp.headers.get('Content-Type')}")
        print(f"  Content-Disposition: {resp.headers.get('Content-Disposition', '无')}")
        
        # 如果是重定向，跟随看最终地址
        if resp.status_code in [301, 302, 303, 307, 308]:
            resp2 = session.get(dl_url, allow_redirects=True, timeout=30, stream=True)
            print(f"  最终URL: {resp2.url}")
            print(f"  最终状态码: {resp2.status_code}")
            print(f"  最终Content-Type: {resp2.headers.get('Content-Type')}")
            print(f"  最终Content-Length: {resp2.headers.get('Content-Length')}")
            
            # 如果是视频/文件，检查前几个字节
            if resp2.status_code == 200:
                chunk = next(resp2.iter_content(chunk_size=1024), b'')
                print(f"  文件头(前16字节hex): {chunk[:16].hex()}")
                # 检查是否是MP4文件
                if b'ftyp' in chunk[:32] or chunk[:4] in [b'\x00\x00\x00\x18', b'\x00\x00\x00\x20']:
                    print("  [!] 检测到可能是视频文件!")
        else:
            # 获取部分内容看是否是HTML还是文件
            content = resp.content[:2000]
            if b'<html' in content.lower() or b'<!doctype' in content.lower():
                print("  返回HTML页面")
                # 查找是否有JavaScript跳转或加密
                soup_text = content.decode('utf-8', errors='ignore')
                # 查找setTimeout/meta refresh/window.location
                if 'window.location' in soup_text or 'location.href' in soup_text:
                    matches = re.findall(r'(?:window\.location|location\.href)\s*=\s*["\']([^"\']+)["\']', soup_text)
                    print(f"  JS跳转目标: {matches}")
                if 'meta' in soup_text and 'refresh' in soup_text.lower():
                    print("  发现meta refresh跳转")
                    
    except Exception as e:
        print(f"  错误: {e}")
    finally:
        try:
            resp.close()
        except:
            pass
