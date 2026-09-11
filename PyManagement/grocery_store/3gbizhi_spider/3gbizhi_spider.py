#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
3G壁纸网站全站爬虫 - 完美可用版
https://www.3gbizhi.com/

功能特性：
✓ 无需登录，直接下载无水印图片（/uploads/ 目录）
✓ 支持手机壁纸、桌面壁纸、壁纸专题全站爬取
✓ 自动分页，多线程下载，断点续传
✓ 自动按分类创建目录保存
✓ 进度条显示，错误自动重试
✓ 图片验证机制，跳过损坏文件
✓ 请求频率随机延迟，避免被封

逆向说明：
- 带水印预览图: /uploadmark/日期/hash.webp
- 无水印高清图: /uploads/日期/hash.webp (列表页lay-src属性直接获取，无需解密！)
- 列表页直接提取所有图片URL，无需逐个进入详情页
"""

import os
import re
import time
import random
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin, urlparse
import requests
from tqdm import tqdm

# ==================== 配置 ====================
BASE_URL = "https://www.3gbizhi.com"
DESK_URL = "https://desk.3gbizhi.com"  # 桌面壁纸子域名
SAVE_ROOT = "3G壁纸全站下载"
THREAD_NUM = 8  # 下载线程数，建议不超过10
TIMEOUT = 30
RETRY_TIMES = 3
DELAY_MIN = 0.3  # 请求最小延迟(秒)
DELAY_MAX = 1.0  # 请求最大延迟(秒)

# 请求头，模拟浏览器
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.3gbizhi.com/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}

# 线程安全
lock = threading.Lock()
session = requests.Session()
session.headers.update(HEADERS)

# 已下载历史（断点续传）
downloaded_urls = set()
history_file = os.path.join(SAVE_ROOT, "download_history.txt")


def init_env():
    """初始化环境，创建目录，加载下载历史"""
    os.makedirs(SAVE_ROOT, exist_ok=True)
    if os.path.exists(history_file):
        with open(history_file, "r", encoding="utf-8") as f:
            for line in f:
                url = line.strip()
                if url:
                    downloaded_urls.add(url)
        print(f"[+] 加载历史记录：已下载 {len(downloaded_urls)} 张图片")


def save_history(url):
    """保存下载记录"""
    with lock:
        with open(history_file, "a", encoding="utf-8") as f:
            f.write(url + "\n")
        downloaded_urls.add(url)


def random_delay():
    """随机延迟"""
    time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))


def fetch(url, retry=RETRY_TIMES):
    """获取页面内容"""
    for i in range(retry):
        try:
            resp = session.get(url, timeout=TIMEOUT)
            resp.encoding = "utf-8"
            if resp.status_code == 200:
                return resp.text
            elif resp.status_code == 404:
                return None
        except Exception as e:
            if i == retry - 1:
                print(f"[-] 请求失败: {url}, 错误: {str(e)[:50]}")
            time.sleep(1)
    return None


def download_image(img_url, save_path):
    """下载单张图片"""
    # 断点续传
    if img_url in downloaded_urls and os.path.exists(save_path):
        if os.path.getsize(save_path) > 10000:  # 文件大于10KB认为完整
            return True
    
    for attempt in range(RETRY_TIMES):
        try:
            resp = session.get(img_url, timeout=TIMEOUT, stream=True)
            if resp.status_code == 200:
                # 检查文件大小
                content_length = int(resp.headers.get("content-length", 0))
                if content_length < 5000:  # 小于5KB可能是错误页面
                    continue
                
                # 保存文件
                os.makedirs(os.path.dirname(save_path), exist_ok=True)
                with open(save_path, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                
                # 验证文件
                if os.path.getsize(save_path) > 10000:
                    save_history(img_url)
                    return True
        except Exception as e:
            if attempt == RETRY_TIMES - 1:
                pass
            time.sleep(1)
    
    return False


def extract_list_images(html):
    """从列表页提取所有图片URL和标题
    核心正则：匹配lay-src属性，这是无水印高清图的真实地址
    """
    images = []
    
    # 匹配 lay-src="https://pic.3gbizhi.com/uploads/xxx.webp"
    pattern = r'lay-src="(https://pic\.3gbizhi\.com/uploads/[^"]+)"[^>]*alt="([^"]*)"'
    matches = re.findall(pattern, html)
    
    for img_url, title in matches:
        if img_url and img_url not in [i[0] for i in images]:
            # 清理文件名中的非法字符
            title = re.sub(r'[\\/*?:"<>|]', "", title)[:80].strip()
            if not title:
                title = str(int(time.time() * 1000))
            images.append((img_url, title))
    
    return images


def get_max_page(html, base_url):
    """获取最大页数"""
    page_nums = re.findall(r'index_(\d+)\.html', html)
    if page_nums:
        return max([int(p) for p in page_nums])
    return 1


def crawl_category(cat_name, start_url, save_subdir, page_param="index_{page}.html"):
    """爬取单个分类"""
    print(f"\n{'='*60}")
    print(f"[*] 开始爬取: {cat_name}")
    print(f"[*] 入口地址: {start_url}")
    print(f"[*] 保存目录: {os.path.join(SAVE_ROOT, save_subdir)}")
    print(f"{'='*60}\n")
    
    os.makedirs(os.path.join(SAVE_ROOT, save_subdir), exist_ok=True)
    
    # 获取第一页
    first_html = fetch(start_url)
    if not first_html:
        print(f"[-] 无法访问入口页面: {start_url}")
        return 0, 0
    
    max_page = get_max_page(first_html, start_url)
    print(f"[+] 检测到总页数: {max_page}")
    
    all_images = []
    
    # 提取第一页图片
    first_images = extract_list_images(first_html)
    all_images.extend(first_images)
    print(f"[+] 第1页: {len(first_images)} 张图片")
    random_delay()
    
    # 爬取后续页面
    for page in range(2, max_page + 1):
        if "wallMV" in start_url or "sjbz" in start_url:
            page_url = f"{BASE_URL}/wallMV/index_{page}.html"
        elif "desk." in start_url or "wallPC" in start_url:
            page_url = f"{DESK_URL}/index_{page}.html"
        else:
            page_url = urljoin(start_url, page_param.format(page=page))
        
        html = fetch(page_url)
        if not html:
            break
        
        images = extract_list_images(html)
        all_images.extend(images)
        print(f"[+] 第{page}页: {len(images)} 张图片 | 累计: {len(all_images)} 张")
        random_delay()
    
    # 去重
    all_images = list(dict.fromkeys(all_images))
    print(f"\n[+] {cat_name} 共获取 {len(all_images)} 张有效图片")
    
    # 准备下载任务
    tasks = []
    for img_url, title in all_images:
        ext = os.path.splitext(urlparse(img_url).path)[1] or ".webp"
        filename = f"{title}_{int(time.time()*1000)%100000}{ext}"
        # 避免文件名重复
        count = 1
        save_path = os.path.join(SAVE_ROOT, save_subdir, filename)
        while os.path.exists(save_path):
            filename = f"{title}_{count}{ext}"
            save_path = os.path.join(SAVE_ROOT, save_subdir, filename)
            count += 1
        tasks.append((img_url, save_path))
    
    # 多线程下载
    success = 0
    fail = 0
    
    print(f"[*] 开始下载...\n")
    with ThreadPoolExecutor(max_workers=THREAD_NUM) as executor:
        futures = {executor.submit(download_image, url, path): (url, path) for url, path in tasks}
        
        for future in tqdm(as_completed(futures), total=len(futures), desc=f"下载 {cat_name}"):
            try:
                if future.result():
                    success += 1
                else:
                    fail += 1
            except:
                fail += 1
    
    print(f"\n[✓] {cat_name} 完成！成功: {success}, 失败: {fail}")
    return success, fail


def crawl_topics():
    """爬取所有壁纸专题"""
    print(f"\n{'='*60}")
    print(f"[*] 开始爬取壁纸专题")
    print(f"{'='*60}\n")
    
    topic_base = f"{BASE_URL}/walltopic/"
    first_html = fetch(topic_base + "index.html")
    if not first_html:
        print("[-] 无法访问专题页面")
        return 0, 0
    
    max_page = get_max_page(first_html, topic_base)
    print(f"[+] 专题总页数: {max_page}")
    
    # 获取所有专题链接
    topic_links = []
    
    # 第一页专题
    topic_matches = re.findall(r'<a[^>]+href="(/walltopic/\d+\.html)"[^>]*>([^<]+)</a>', first_html)
    for url, name in topic_matches:
        full_url = urljoin(BASE_URL, url)
        if full_url not in [t[0] for t in topic_links]:
            topic_links.append((full_url, re.sub(r'[\\/*?:"<>|]', "", name)[:50]))
    
    # 后续页专题
    for page in range(2, max_page + 1):
        page_url = f"{topic_base}index_{page}.html"
        html = fetch(page_url)
        if html:
            matches = re.findall(r'<a[^>]+href="(/walltopic/\d+\.html)"[^>]*>([^<]+)</a>', html)
            for url, name in matches:
                full_url = urljoin(BASE_URL, url)
                if full_url not in [t[0] for t in topic_links]:
                    topic_links.append((full_url, re.sub(r'[\\/*?:"<>|]', "", name)[:50]))
            random_delay()
    
    print(f"[+] 共找到 {len(topic_links)} 个专题\n")
    
    total_success = 0
    total_fail = 0
    
    for idx, (topic_url, topic_name) in enumerate(topic_links, 1):
        print(f"\n[{idx}/{len(topic_links)}] 爬取专题: {topic_name}")
        topic_dir = os.path.join("壁纸专题", topic_name)
        
        html = fetch(topic_url)
        if not html:
            continue
        
        images = extract_list_images(html)
        print(f"  找到 {len(images)} 张图片")
        
        # 专题分页
        topic_max = get_max_page(html, topic_url)
        for p in range(2, topic_max + 1):
            p_url = topic_url.replace(".html", f"_{p}.html")
            if p_url == topic_url:
                p_url = topic_url.replace(".html", f"index_{p}.html")
            p_html = fetch(p_url)
            if p_html:
                p_imgs = extract_list_images(p_html)
                images.extend(p_imgs)
                random_delay()
        
        # 下载
        s, f = 0, 0
        for img_url, title in images:
            ext = os.path.splitext(urlparse(img_url).path)[1] or ".webp"
            filename = f"{title}{ext}"
            save_path = os.path.join(SAVE_ROOT, topic_dir, filename)
            if download_image(img_url, save_path):
                s += 1
            else:
                f += 1
        
        total_success += s
        total_fail += f
        print(f"  下载完成: 成功{s}, 失败{f}")
        random_delay()
    
    return total_success, total_fail


def main():
    print("="*60)
    print("3G壁纸全站爬虫 v2.0 - 无水印直下版")
    print("网站: https://www.3gbizhi.com/")
    print("="*60)
    
    init_env()
    
    total_s = 0
    total_f = 0
    
    # 1. 爬取手机壁纸
    s, f = crawl_category(
        "手机壁纸",
        f"{BASE_URL}/wallMV/",
        "手机壁纸"
    )
    total_s += s
    total_f += f
    
    # 2. 爬取桌面壁纸
    s, f = crawl_category(
        "桌面壁纸",
        f"{DESK_URL}/",
        "桌面壁纸"
    )
    total_s += s
    total_f += f
    
    # 3. 爬取壁纸专题（可选，如果只需要主分类可以注释掉）
    # s, f = crawl_topics()
    # total_s += s
    # total_f += f
    
    print("\n" + "="*60)
    print("【爬取完成！统计信息】")
    print(f"✓ 总成功下载: {total_s} 张无水印壁纸")
    print(f"✗ 总失败: {total_f} 张")
    print(f"📁 保存目录: {os.path.abspath(SAVE_ROOT)}")
    print("="*60)
    print("\n说明：")
    print("- 下载的图片均为无水印高清webp格式，可直接使用")
    print("- 如需继续下载，重新运行即可自动断点续传")
    print("- 如需爬取壁纸专题，取消代码中crawl_topics()的注释即可")


if __name__ == "__main__":
    main()
