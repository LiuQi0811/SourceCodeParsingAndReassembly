#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
爬虫功能快速测试脚本
直接运行本脚本验证核心解密功能是否正常
"""
import sys
import time

print("=" * 60)
print("  ikanbot爬虫 - 功能测试")
print("=" * 60)

try:
    from curl_cffi import requests
except ImportError:
    print("正在安装 curl_cffi ...")
    import subprocess
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'curl_cffi', '-q'])
    from curl_cffi import requests

import re
import json

def generate_token(video_id: str, e_token: str) -> str:
    """核心解密算法"""
    vid_str = str(video_id)
    last4 = vid_str[-4:] if len(vid_str) >= 4 else vid_str.zfill(4)[-4:]
    parts = []
    buf = e_token
    for ch in last4:
        d = int(ch)
        off = d % 3 + 1
        parts.append(buf[off:off+8])
        buf = buf[off+8:]
    return ''.join(parts)

def main():
    print("\n[1/4] 初始化HTTP客户端(模拟Chrome 120 TLS指纹)...")
    session = requests.Session(impersonate='chrome120')
    session.headers.update({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
    })

    print("[2/4] 访问首页建立session...")
    try:
        r = session.get('https://www.ikanbot.com/', timeout=15)
        print(f"      首页状态: {r.status_code}")
        if r.status_code != 200:
            print("      ❌ 首页访问失败!")
            return False
    except Exception as e:
        print(f"      ❌ 网络错误: {e}")
        return False

    time.sleep(3)

    print("[3/4] 获取影片详情页和e_token...")
    test_id = "1012121"  # 求救信号
    try:
        r = session.get(f'https://www.ikanbot.com/play/{test_id}', timeout=15)
        print(f"      详情页状态: {r.status_code}")
        if r.status_code != 200:
            print("      ❌ 详情页访问失败!")
            return False
    except Exception as e:
        print(f"      ❌ 网络错误: {e}")
        return False

    # 提取信息
    e_token_m = re.search(r'id="e_token"[^>]*value="([^"]+)"', r.text)
    title_m = re.search(r'<h1[^>]*id="video_title"[^>]*>([^<]+)</h1>', r.text)

    if not e_token_m:
        print("      ❌ 未找到e_token!")
        return False

    e_token = e_token_m.group(1)
    title = title_m.group(1) if title_m else "未知"
    print(f"      影片: {title}")
    print(f"      e_token: {e_token}")

    # 生成token
    token = generate_token(test_id, e_token)
    print(f"      生成token: {token}")

    time.sleep(2)

    print("[4/4] 调用API获取播放源...")
    try:
        api_url = f'https://www.ikanbot.com/api/getResN?videoId={test_id}&mtype=1&token={token}'
        r = session.get(api_url, headers={'Referer': f'https://www.ikanbot.com/play/{test_id}'}, timeout=15)
        data = r.json()
        print(f"      API状态: {data.get('state')} - {data.get('message', '')}")

        if data.get('state') != 1:
            print("      ❌ API返回错误!")
            return False

        sources = []
        for item in data['data']['list']:
            for res in json.loads(item.get('resData', '[]')):
                for p in res.get('url', '').split('#'):
                    if '$' in p and p.endswith('.m3u8'):
                        n, u = p.split('$', 1)
                        sources.append((n.strip(), u.strip()))

        print(f"      ✓ 成功解析 {len(sources)} 个m3u8播放源:")
        for i, (n, u) in enumerate(sources[:5], 1):
            print(f"        {i}. [{n}] {u}")
        if len(sources) > 5:
            print(f"        ... 还有 {len(sources)-5} 个源")

    except Exception as e:
        print(f"      ❌ API调用错误: {e}")
        return False

    print("\n" + "=" * 60)
    print("  ✓ 所有测试通过! 解密算法完美可用")
    print("=" * 60)
    print("\n可直接使用 ikanbot_spider.py 进行全站爬取:")
    print("  from ikanbot_spider import IkanbotSpider")
    print("  spider = IkanbotSpider()")
    print("  movie = spider.get_movie_detail('1012121')")
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
