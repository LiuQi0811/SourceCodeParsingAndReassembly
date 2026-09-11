#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SeedHub (https://www.seedhub.cc/) 全站爬虫
网站结构：VuePress静态站点，无JS加密，真实链接直接在页面JS变量panLink中
功能：
1. 抓取所有电影/动漫/剧集详情页
2. 提取影片元数据（标题、评分、导演、演员、简介、封面等）
3. 解析所有网盘下载链接（夸克、百度、迅雷、UC、阿里）
4. 提取磁力链接
5. 支持增量抓取、断点续爬
6. 导出为JSON/CSV/Markdown多种格式
"""

import os
import re
import json
import time
import csv
import random
from urllib.parse import urljoin, urlparse, unquote
from collections import deque

import requests
from bs4 import BeautifulSoup
from tqdm import tqdm

# ============ 配置 ============
BASE_URL = "https://www.seedhub.cc/"
OUTPUT_DIR = "seedhub_data"
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
]
# 延迟范围（秒），防止请求过快
DELAY_MIN = 0.5
DELAY_MAX = 1.5
# 超时时间（秒）
TIMEOUT = 15
# 重试次数
MAX_RETRIES = 3

# ============ 初始化 ============
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(os.path.join(OUTPUT_DIR, "images"), exist_ok=True)
os.makedirs(os.path.join(OUTPUT_DIR, "pages"), exist_ok=True)

# 已访问URL记录
visited_file = os.path.join(OUTPUT_DIR, "visited.json")
if os.path.exists(visited_file):
    with open(visited_file, "r", encoding="utf-8") as f:
        visited = set(json.load(f))
else:
    visited = set()

# 影片数据
movies_file = os.path.join(OUTPUT_DIR, "movies.json")
if os.path.exists(movies_file):
    with open(movies_file, "r", encoding="utf-8") as f:
        movies = json.load(f)
else:
    movies = {}

session = requests.Session()
session.headers.update({
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": BASE_URL,
})


def get_random_ua():
    return random.choice(USER_AGENTS)


def delay():
    time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))


def fetch(url, retries=MAX_RETRIES):
    """带重试的HTTP请求"""
    for i in range(retries):
        try:
            session.headers["User-Agent"] = get_random_ua()
            resp = session.get(url, timeout=TIMEOUT)
            resp.encoding = "utf-8"
            if resp.status_code == 200:
                return resp.text
            elif resp.status_code == 404:
                return None
            else:
                print(f"  [{resp.status_code}] {url}")
        except Exception as e:
            if i == retries - 1:
                print(f"  [ERROR] {url}: {e}")
                return None
        time.sleep(2 ** i)
    return None


def extract_pan_links(html):
    """从页面提取panLink变量中的网盘链接"""
    pan_links = []
    
    # 提取主panLink
    main_match = re.search(r'var panLink\s*=\s*"([^"]+)"', html)
    if main_match:
        link = main_match.group(1)
        if link and link != "":
            pan_links.append({
                "title": "主链接",
                "url": link,
                "type": identify_pan_type(link)
            })
    
    # 提取所有可能的其他网盘链接（备选）
    pan_patterns = [
        r'https?://pan\.quark\.cn/s/[a-zA-Z0-9]+',
        r'https?://pan\.baidu\.com/s/[a-zA-Z0-9_-]+(?:\?pwd=[a-zA-Z0-9]+)?',
        r'https?://pan\.xunlei\.com/s/[a-zA-Z0-9]+(?:\?pwd=[a-zA-Z0-9]+)?',
        r'https?://drive\.uc\.cn/s/[a-zA-Z0-9]+',
        r'https?://www\.alipan\.com/s/[a-zA-Z0-9]+',
        r'https?://pan\.aliyundrive\.com/s/[a-zA-Z0-9]+',
        r'magnet:\?xt=urn:btih:[a-zA-Z0-9]+',
    ]
    
    found_links = set()
    for pattern in pan_patterns:
        for match in re.finditer(pattern, html):
            link = match.group(0)
            if link not in found_links and link not in [p["url"] for p in pan_links]:
                found_links.add(link)
                pan_links.append({
                    "title": "页面内嵌链接",
                    "url": link,
                    "type": identify_pan_type(link)
                })
    
    return pan_links


def identify_pan_type(url):
    """识别网盘类型"""
    if "pan.quark.cn" in url:
        return "夸克网盘"
    elif "pan.baidu.com" in url:
        return "百度网盘"
    elif "pan.xunlei.com" in url:
        return "迅雷网盘"
    elif "drive.uc.cn" in url:
        return "UC网盘"
    elif "alipan.com" in url or "aliyundrive.com" in url:
        return "阿里云盘"
    elif url.startswith("magnet:"):
        return "磁力链接"
    else:
        return "其他"


def extract_pwd(url):
    """从链接提取提取码"""
    if "?pwd=" in url:
        return url.split("?pwd=")[1][:4]
    return None


def parse_movie_page(url, html):
    """解析影片详情页"""
    soup = BeautifulSoup(html, "html.parser")
    movie = {
        "url": url,
        "id": url.strip("/").split("/")[-1],
        "title": "",
        "original_title": "",
        "rating": "",
        "year": "",
        "region": "",
        "language": "",
        "genres": [],
        "directors": [],
        "actors": [],
        "cover": "",
        "description": "",
        "pan_links": [],
        "subtitles": [],
        "images": [],
        "crawl_time": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    
    # 标题
    title_tag = soup.find("h1")
    if title_tag:
        movie["title"] = title_tag.get_text(strip=True)
    
    # meta信息
    title_meta = soup.find("meta", property="og:title")
    if title_meta:
        movie["title"] = title_meta.get("content", movie["title"])
    
    desc_meta = soup.find("meta", {"name": "description"})
    if desc_meta:
        movie["description"] = desc_meta.get("content", "").strip()
    
    # 封面图
    cover_img = soup.find("div", class_="cover-container")
    if cover_img:
        img = cover_img.find("img")
        if img and img.get("src"):
            movie["cover"] = img["src"]
    
    # 评分 - 查找数字评分链接
    rating_links = soup.find_all("a", text=re.compile(r'^\d+\.?\d*$'))
    for link in rating_links:
        text = link.get_text(strip=True)
        if re.match(r'^\d+\.?\d*$', text):
            movie["rating"] = text
            break
    
    # 类型标签（链接文本，非分类导航）
    genre_keywords = ["剧情", "喜剧", "惊悚", "动作", "爱情", "犯罪", "恐怖", "悬疑", 
                      "冒险", "科幻", "奇幻", "纪录片", "家庭", "传记", "战争", "历史",
                      "音乐", "运动", "同性", "古装", "歌舞", "西部", "短片", "武侠",
                      "灾难", "动画", "儿童", "真人秀"]
    
    # 在内容区域查找类型标签
    content_area = soup.find("div", class_="content")
    if content_area:
        # 查找年份、地区、语言
        info_text = content_area.get_text()
        year_match = re.search(r'(\d{4})', info_text)
        if year_match:
            movie["year"] = year_match.group(1)
    
    # 提取所有网盘跳转链接并获取真实链接
    link_start_urls = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/link_start/?redirect_to=" in href:
            full_url = urljoin(BASE_URL, href)
            link_start_urls.append((a.get("title", a.get_text(strip=True)), full_url))
    
    # 访问每个link_start页面获取真实网盘链接
    print(f"    发现 {len(link_start_urls)} 个资源链接，正在解析...")
    for idx, (title, link_url) in enumerate(link_start_urls):
        pan_html = fetch(link_url)
        if pan_html:
            pan_matches = re.findall(r'var panLink\s*=\s*"([^"]+)"', pan_html)
            for pan_url in pan_matches:
                if pan_url and pan_url != "":
                    movie["pan_links"].append({
                        "title": title,
                        "url": pan_url,
                        "type": identify_pan_type(pan_url),
                        "pwd": extract_pwd(pan_url)
                    })
        delay()
    
    # 如果link_start页面没获取到，尝试从当前页面提取
    if not movie["pan_links"]:
        movie["pan_links"] = extract_pan_links(html)
    
    # 去重
    seen_urls = set()
    unique_pans = []
    for pan in movie["pan_links"]:
        if pan["url"] not in seen_urls:
            seen_urls.add(pan["url"])
            unique_pans.append(pan)
    movie["pan_links"] = unique_pans
    
    # 剧情图片
    pictures_div = soup.find("ul", class_="pictures")
    if pictures_div:
        for img in pictures_div.find_all("img"):
            if img.get("src"):
                movie["images"].append(img["src"])
    
    return movie


def is_movie_url(url):
    """判断是否为影片详情页（排除分类列表页）"""
    # 影片详情页格式: /movies/数字/
    if "/movies/" not in url or not url.endswith("/"):
        return False
    # 排除列表页：/categories/.../movies/ 或 /types/.../movies/ 或 /page/.../
    if "/categories/" in url or "/types/" in url or "/page/" in url or url.endswith("/movies/"):
        return False
    # 检查是否是纯数字ID
    parts = url.strip("/").split("/")
    if len(parts) >= 2 and parts[-2] == "movies":
        movie_id = parts[-1]
        return movie_id.isdigit()
    return False


def is_list_url(url):
    """判断是否为列表页/分类页"""
    patterns = [
        r"/categories/\d+/movies/",
        r"/page/\d+/",
        r"/s/",
        r"/tags/",
    ]
    return any(re.search(p, url) for p in patterns)


def extract_links(html, base_url):
    """提取页面中的所有站内链接"""
    soup = BeautifulSoup(html, "html.parser")
    links = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith("#") or href.startswith("javascript:"):
            continue
        full_url = urljoin(base_url, href)
        # 只保留同域名链接
        if urlparse(full_url).netloc == urlparse(BASE_URL).netloc:
            # 排除静态资源
            if not any(full_url.endswith(ext) for ext in [".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg"]):
                # 排除link_start和一些特殊页面
                if "/link_start/" not in full_url and "/wp-content/" not in full_url:
                    links.add(full_url)
    return links


def save_progress():
    """保存进度"""
    with open(visited_file, "w", encoding="utf-8") as f:
        json.dump(list(visited), f, ensure_ascii=False, indent=2)
    with open(movies_file, "w", encoding="utf-8") as f:
        json.dump(movies, f, ensure_ascii=False, indent=2)


def export_csv():
    """导出CSV格式"""
    csv_file = os.path.join(OUTPUT_DIR, "seedhub_movies.csv")
    with open(csv_file, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "ID", "标题", "评分", "年份", "类型", "导演", "演员",
            "夸克链接", "夸克提取码", "百度链接", "百度提取码", 
            "迅雷链接", "迅雷提取码", "磁力链接", "封面", "详情页", "简介"
        ])
        
        for movie in movies.values():
            quark = [p for p in movie["pan_links"] if p["type"] == "夸克网盘"]
            baidu = [p for p in movie["pan_links"] if p["type"] == "百度网盘"]
            xunlei = [p for p in movie["pan_links"] if p["type"] == "迅雷网盘"]
            magnet = [p for p in movie["pan_links"] if p["type"] == "磁力链接"]
            
            writer.writerow([
                movie["id"],
                movie["title"],
                movie["rating"],
                movie["year"],
                "/".join(movie["genres"]),
                "/".join(movie["directors"]),
                "/".join(movie["actors"]),
                quark[0]["url"] if quark else "",
                quark[0]["pwd"] if quark and quark[0].get("pwd") else "",
                baidu[0]["url"] if baidu else "",
                baidu[0]["pwd"] if baidu and baidu[0].get("pwd") else "",
                xunlei[0]["url"] if xunlei else "",
                xunlei[0]["pwd"] if xunlei and xunlei[0].get("pwd") else "",
                magnet[0]["url"] if magnet else "",
                movie["cover"],
                movie["url"],
                movie["description"][:200] if movie["description"] else ""
            ])
    print(f"CSV已导出: {csv_file}")


def export_markdown():
    """导出Markdown格式，方便浏览"""
    md_file = os.path.join(OUTPUT_DIR, "seedhub_index.md")
    with open(md_file, "w", encoding="utf-8") as f:
        f.write("# SeedHub 影视资源索引\n\n")
        f.write(f"共抓取 **{len(movies)}** 部影片，更新时间：{time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write("---\n\n")
        
        # 按评分排序
        sorted_movies = sorted(
            movies.values(), 
            key=lambda x: float(x["rating"]) if x["rating"] and x["rating"] != "0" else 0,
            reverse=True
        )
        
        for movie in sorted_movies:
            if not movie["title"]:
                continue
            f.write(f"## {movie['title']}\n\n")
            if movie["rating"] and movie["rating"] != "0":
                f.write(f"- **豆瓣评分**: {movie['rating']}\n")
            if movie["year"]:
                f.write(f"- **年份**: {movie['year']}\n")
            f.write(f"- **详情页**: [{movie['url']}]({movie['url']})\n\n")
            
            if movie["cover"]:
                f.write(f"![{movie['title']}]({movie['cover']})\n\n")
            
            if movie["description"]:
                f.write(f"> {movie['description'][:300]}...\n\n")
            
            # 下载链接
            f.write("**下载链接**:\n\n")
            for pan in movie["pan_links"]:
                pwd_text = f" (提取码: `{pan['pwd']}`)" if pan.get("pwd") else ""
                f.write(f"- [{pan['type']}] [{pan['title'][:50]}]({pan['url']}){pwd_text}\n")
            
            f.write("\n---\n\n")
    
    print(f"Markdown索引已导出: {md_file}")


def crawl():
    """主爬虫函数"""
    queue = deque([BASE_URL])
    new_count = 0
    
    print("=" * 60)
    print("SeedHub 全站爬虫启动")
    print(f"已抓取影片数: {len(movies)}")
    print(f"已访问URL数: {len(visited)}")
    print("=" * 60)
    
    pbar = tqdm(desc="爬取进度", unit="页")
    
    try:
        while queue:
            url = queue.popleft()
            
            if url in visited:
                continue
            
            visited.add(url)
            pbar.update(1)
            pbar.set_postfix(影片数=len(movies), 队列数=len(queue))
            
            html = fetch(url)
            if not html:
                continue
            
            # 保存原始页面
            if is_movie_url(url):
                page_file = os.path.join(OUTPUT_DIR, "pages", f"{url.strip('/').split('/')[-1]}.html")
                with open(page_file, "w", encoding="utf-8") as f:
                    f.write(html)
            
            # 如果是影片详情页，解析并保存
            if is_movie_url(url):
                movie_id = url.strip("/").split("/")[-1]
                if movie_id not in movies:
                    print(f"\n解析影片: {url}")
                    movie = parse_movie_page(url, html)
                    movies[movie_id] = movie
                    new_count += 1
                    print(f"  标题: {movie['title']}")
                    print(f"  资源数: {len(movie['pan_links'])}")
                    
                    # 每抓取10部电影保存一次
                    if new_count % 10 == 0:
                        save_progress()
            
            # 提取新链接加入队列
            if is_list_url(url) or url == BASE_URL or is_movie_url(url):
                new_links = extract_links(html, url)
                for link in new_links:
                    if link not in visited and link not in queue:
                        # 只加入列表页和详情页
                        if is_movie_url(link) or is_list_url(link) or link == BASE_URL:
                            queue.append(link)
            
            delay()
            
            # 安全限制，防止无限爬取（可注释）
            if len(movies) > 5000:
                print("\n达到5000部影片限制，停止爬取")
                break
    
    except KeyboardInterrupt:
        print("\n用户中断，正在保存进度...")
    finally:
        pbar.close()
        save_progress()
        export_csv()
        export_markdown()
        
        print("\n" + "=" * 60)
        print("爬取完成!")
        print(f"总计抓取影片: {len(movies)} 部")
        print(f"数据保存目录: {os.path.abspath(OUTPUT_DIR)}")
        print("=" * 60)
        
        # 统计链接类型
        total_links = sum(len(m["pan_links"]) for m in movies.values())
        type_counts = {}
        for m in movies.values():
            for p in m["pan_links"]:
                t = p["type"]
                type_counts[t] = type_counts.get(t, 0) + 1
        
        print("\n资源链接统计:")
        for t, c in sorted(type_counts.items(), key=lambda x: -x[1]):
            print(f"  {t}: {c} 个")
        print(f"  总计: {total_links} 个")


def download_covers():
    """下载封面图"""
    print("\n开始下载封面图片...")
    cover_dir = os.path.join(OUTPUT_DIR, "images", "covers")
    os.makedirs(cover_dir, exist_ok=True)
    
    success = 0
    for movie_id, movie in tqdm(movies.items(), desc="下载封面"):
        if not movie["cover"]:
            continue
        ext = os.path.splitext(urlparse(movie["cover"]).path)[1] or ".jpg"
        save_path = os.path.join(cover_dir, f"{movie_id}{ext}")
        
        if os.path.exists(save_path):
            success += 1
            continue
        
        try:
            resp = session.get(movie["cover"], timeout=10)
            if resp.status_code == 200:
                with open(save_path, "wb") as f:
                    f.write(resp.content)
                success += 1
            time.sleep(0.2)
        except:
            pass
    
    print(f"封面下载完成: {success}/{len(movies)}")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "covers":
        download_covers()
    elif len(sys.argv) > 1 and sys.argv[1] == "export":
        export_csv()
        export_markdown()
    else:
        crawl()
