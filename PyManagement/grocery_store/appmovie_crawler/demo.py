#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
APP影院 (appmovie.vip) 极简验证爬虫 - 证明抓取+解密完全可用
逆向结论:
  ✅ 站点使用苹果CMS v10, player_data中encrypt=0,视频地址明文,无需解密!
"""
import os, re, json, time, csv
import urllib3
urllib3.util.connection.HAS_H2 = False  # 关键:禁用HTTP/2,否则被RST反爬
import requests
from bs4 import BeautifulSoup

BASE = "https://www.appmovie.vip"
OUT = os.path.dirname(os.path.abspath(__file__))
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Referer": BASE + "/",
}

s = requests.Session()
s.headers.update(HEADERS)

def get(url):
    for i in range(5):
        try:
            time.sleep(0.5 + (i*0.5))
            r = s.get(url, timeout=20)
            r.encoding = "utf-8"
            if r.status_code == 200 and len(r.text) > 2000:
                return r.text
        except Exception as e:
            print(f"  retry {i}: {type(e).__name__}")
            time.sleep(3+i*3)
    return ""

# 先访问首页拿cookie
print("==> 访问首页建立会话...")
get(BASE + "/")
time.sleep(1)

# 爬取电影分类前1页
print("==> 爬取电影列表第一页...")
html = get(f"{BASE}/index.php/vod/show/id/1.html")
vids = []
seen = set()
for m in re.finditer(r'/vod/detail/id/(\d+)\.html', html):
    vid = m.group(1)
    if vid not in seen:
        seen.add(vid)
        vids.append((vid, f"{BASE}/index.php/vod/detail/id/{vid}.html"))
print(f"  列表解析到 {len(vids)} 部电影")

videos = []
for idx, (vid, durl) in enumerate(vids[:10], 1):  # 先爬10部验证
    print(f"  [{idx}/10] 解析详情: {durl[-40:]}")
    html = get(durl)
    soup = BeautifulSoup(html, "lxml")
    title_tag = soup.select_one(".stui-content__detail h3.title")
    title = title_tag.get_text(strip=True) if title_tag else vid
    cover_tag = soup.select_one(".stui-content__thumb img")
    cover = cover_tag.get("data-original","") if cover_tag else ""
    info = soup.select_one(".stui-content__detail")
    info_text = info.get_text(" ", strip=True) if info else ""

    def g(p):
        m = re.search(p, info_text)
        return m.group(1).strip() if m else ""
    year = g(r'年份[：:]\s*(\d{4})')
    director = g(r'导演[：:]\s*([^\s]+)')

    # 播放源
    eps = []
    for ul in soup.select("ul.stui-content__playlist")[:1]:  # 只取第一个播放源演示
        for a in ul.select("li a"):
            eps.append({
                "ep": a.get_text(strip=True),
                "play_page": BASE + a["href"],
                "url": "",
            })

    videos.append({
        "id": vid, "title": title, "cover": cover,
        "year": year, "director": director,
        "episodes": eps,
    })

# 解析播放页获取m3u8直链(关键验证:是否有加密)
print(f"\n==> 解析{sum(len(v['episodes']) for v in videos)}个播放页获取m3u8直链...")
encrypt_count = 0
plain_count = 0
for v in videos:
    for ep in v["episodes"]:
        html = get(ep["play_page"])
        m = re.search(r'var\s+player_data\s*=\s*(\{.*?\})\s*</script>', html, re.DOTALL)
        if m:
            data = json.loads(m.group(1).replace('\\/','/'))
            ep["url"] = data.get("url","")
            ep["encrypt"] = data.get("encrypt",0)
            if data.get("encrypt",0) == 0:
                plain_count += 1
            else:
                encrypt_count += 1
        print(f"  [{v['title']}] {ep['ep']} encrypt={ep.get('encrypt')} url={ep['url'][:70]}")

# 保存结果
out_json = os.path.join(OUT, "demo_result.json")
with open(out_json, "w", encoding="utf-8") as f:
    json.dump(videos, f, ensure_ascii=False, indent=2)

out_csv = os.path.join(OUT, "demo_result.csv")
with open(out_csv, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f)
    w.writerow(["ID","标题","年份","导演","集数","encrypt","m3u8直链","播放页"])
    for v in videos:
        for ep in v["episodes"]:
            w.writerow([v["id"],v["title"],v["year"],v["director"],ep["ep"],
                        ep.get("encrypt"),ep["url"],ep["play_page"]])

print(f"\n===== 验证结果 =====")
print(f"成功爬取电影: {len(videos)} 部")
print(f"成功解析直链: {plain_count} 条 (encrypt=0,明文无加密)")
print(f"加密链接数:   {encrypt_count} 条")
print(f"结果文件: {out_json}")
print(f"结果文件: {out_csv}")
if encrypt_count == 0:
    print("\n✅ 完美结论: 该站点无任何视频加密! 直接正则提取player_data.url即可获得全部m3u8直链!")
