import requests
from bs4 import BeautifulSoup
import re
import json

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
}

url = 'https://livewallpapers4free.com/'
print(f"[*] 正在访问 {url}")

try:
    session = requests.Session()
    resp = session.get(url, headers=headers, timeout=30)
    print(f"[+] 状态码: {resp.status_code}")
    print(f"[+] Content-Type: {resp.headers.get('Content-Type')}")
    print(f"[+] 页面大小: {len(resp.content)} bytes")
    
    # 保存原始HTML
    with open('homepage.html', 'wb') as f:
        f.write(resp.content)
    print("[+] 首页已保存为 homepage.html")
    
    soup = BeautifulSoup(resp.text, 'html.parser')
    
    # 提取所有链接
    print("\n=== 页面链接分析 ===")
    links = set()
    for a in soup.find_all('a', href=True):
        href = a['href']
        if href.startswith('/') or 'livewallpapers4free.com' in href:
            links.add(href)
    
    print(f"[+] 发现内部链接数量: {len(links)}")
    for link in sorted(links)[:30]:
        print(f"  - {link}")
    
    # 查找图片/视频资源
    print("\n=== 媒体资源分析 ===")
    imgs = soup.find_all('img', src=True)
    print(f"[+] 发现图片数量: {len(imgs)}")
    for img in imgs[:10]:
        print(f"  - {img['src']}")
    
    videos = soup.find_all('video')
    print(f"\n[+] 发现video标签数量: {len(videos)}")
    for video in videos[:5]:
        print(f"  - src: {video.get('src')}")
        for source in video.find_all('source'):
            print(f"    source: {source.get('src')} type={source.get('type')}")
    
    # 查找JavaScript中的数据/API
    print("\n=== JavaScript/API分析 ===")
    scripts = soup.find_all('script')
    print(f"[+] script标签数量: {len(scripts)}")
    for i, script in enumerate(scripts):
        if script.string and len(script.string.strip()) > 0:
            content = script.string.strip()
            if 'ajax' in content.lower() or 'api' in content.lower() or 'wp-json' in content.lower() or 'download' in content.lower():
                print(f"\n--- Script {i} (含关键关键词) ---")
                print(content[:2000])
                
            # 查找wp-json路径
            if 'wp-json' in content:
                print(f"\n[!] 在script {i}中发现wp-json API路径!")
                
    # 检查是否是WordPress站点
    print("\n=== CMS检测 ===")
    wp_indicators = ['wp-content', 'wp-includes', 'wp-json', 'wordpress']
    for indicator in wp_indicators:
        if indicator in resp.text:
            print(f"[+] 检测到WordPress特征: {indicator}")
    
    # 查找分页链接
    pagination = soup.find_all(['nav', 'div'], class_=re.compile(r'pagination|page-numbers|pager', re.I))
    if pagination:
        print(f"\n[+] 发现分页导航")
        for p in pagination:
            print(p.prettify()[:500])
            
except Exception as e:
    print(f"[-] 错误: {e}")
    import traceback
    traceback.print_exc()
