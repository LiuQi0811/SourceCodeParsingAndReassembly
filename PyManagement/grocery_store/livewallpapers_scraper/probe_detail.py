import requests
from bs4 import BeautifulSoup
import re
import json

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer': 'https://livewallpapers4free.com/',
}

session = requests.Session()

# 访问一个具体壁纸页面
detail_url = 'https://livewallpapers4free.com/goku-fury-of-the-saiyan/'
print(f"[*] 访问详情页: {detail_url}")
resp = session.get(detail_url, headers=headers, timeout=30)
print(f"[+] 状态码: {resp.status_code}")

with open('detail_page.html', 'wb') as f:
    f.write(resp.content)
print("[+] 详情页已保存")

soup = BeautifulSoup(resp.text, 'html.parser')

# 查找下载按钮/链接
print("\n=== 查找下载链接 ===")
download_links = soup.find_all('a', class_=re.compile(r'download', re.I))
print(f"[+] 含download类的链接: {len(download_links)}")
for link in download_links:
    print(f"  href: {link.get('href')}")
    print(f"  class: {link.get('class')}")
    print(f"  text: {link.get_text(strip=True)}")
    print(f"  onclick: {link.get('onclick')}")
    print()

# 查找所有链接中的视频/zip/exe文件
print("\n=== 查找媒体/下载文件链接 ===")
all_links = soup.find_all('a', href=True)
for a in all_links:
    href = a['href']
    if any(ext in href.lower() for ext in ['.mp4', '.zip', '.exe', '.rar', '.7z', '.webm', '.mov', 'download']):
        print(f"  - {a.get_text(strip=True)[:50]} -> {href}")

# 查找video/source标签
print("\n=== 视频标签 ===")
videos = soup.find_all(['video', 'source', 'iframe'])
for v in videos:
    print(f"  标签: {v.name}, src: {v.get('src')}, data-src: {v.get('data-src')}")

# 查找所有JavaScript内容
print("\n=== 分析JavaScript中的下载逻辑 ===")
scripts = soup.find_all('script')
for i, script in enumerate(scripts):
    if script.string:
        content = script.string
        if any(kw in content.lower() for kw in ['download', 'blob', 'encrypted', 'decrypt', 'crypto', 'fetch', 'ajax', 'wp-json']):
            print(f"\n--- Script {i} ---")
            print(content[:3000])

# 检查表单
print("\n=== 表单检查 ===")
forms = soup.find_all('form')
print(f"表单数量: {len(forms)}")
for form in forms:
    print(f"  action: {form.get('action')}, method: {form.get('method')}")
    for inp in form.find_all('input'):
        print(f"    input: name={inp.get('name')}, value={inp.get('value')}, type={inp.get('type')}")

# 查看wp-json
print("\n=== 尝试WordPress REST API ===")
api_url = 'https://livewallpapers4free.com/wp-json/wp/v2/'
try:
    api_resp = session.get(api_url, headers=headers, timeout=10)
    print(f"API状态码: {api_resp.status_code}")
    if api_resp.status_code == 200:
        print("WP REST API可用!")
        api_data = api_resp.json()
        for route in list(api_data.get('routes', {}).keys())[:20]:
            print(f"  - {route}")
except Exception as e:
    print(f"API访问失败: {e}")
