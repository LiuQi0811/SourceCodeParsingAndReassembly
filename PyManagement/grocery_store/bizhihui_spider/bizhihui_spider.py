#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
壁纸汇 (bizhihui.com) 全站壁纸爬虫
功能：
1. 自动抓取所有分类页面壁纸
2. 支持多线程下载
3. 自动去重、断点续传
4. 保存元数据（标题、分类、标签、分辨率等）
5. 支持电脑版/手机版/原图等多尺寸下载
"""

import os
import re
import sys
import time
import json
import random
import hashlib
import logging
import argparse
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

import requests
from bs4 import BeautifulSoup

# ============ 配置 ============
BASE_URL = "https://www.bizhihui.com"
CDN_BASE = "https://s.panlai.com"
SAVE_DIR = "./bizhihui_wallpapers"
MAX_WORKERS = 5
MAX_RETRIES = 3
TIMEOUT = 30
DELAY_MIN = 0.5
DELAY_MAX = 1.5

# 请求头
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Referer": "https://www.bizhihui.com/",
}

# 所有分类URL
CATEGORIES = {
    "首页": "/",
    "卡通动漫": "/dongman/",
    "人物画照": "/renwu/",
    "风景静物": "/fengjing/",
    "影视体育": "/yingshi/",
    "游戏视觉": "/youxi/",
    "美食果蔬": "/meishi/",
    "唯美治愈": "/weimei/",
    "动物萌宠": "/mengchong/",
    "艺术绘画": "/yishu/",
    "宇宙星空": "/yuzhou/",
    "军事科技": "/keji/",
    "简约主义": "/jianyue/",
    "机车": "/jiche/",
    "其它风格": "/qita/",
}

# 标签页
TAGS = {
    "4K壁纸": "/tags/4Kbizhi/",
    "8K壁纸": "/tags/8Kbizhi/",
    "手机壁纸": "/tags/shouji/",
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("./spider.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)


class WallpaperSpider:
    def __init__(self, save_dir=SAVE_DIR, download_original=True, download_pc=False, download_phone=False):
        self.save_dir = save_dir
        self.download_original = download_original
        self.download_pc = download_pc
        self.download_phone = download_phone
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.downloaded_urls = set()
        self.all_wallpapers = {}
        self.metadata_file = os.path.join(save_dir, "metadata.json")
        self.progress_file = os.path.join(save_dir, "progress.json")
        
        # 创建目录
        os.makedirs(save_dir, exist_ok=True)
        os.makedirs(os.path.join(save_dir, "original"), exist_ok=True)
        os.makedirs(os.path.join(save_dir, "pc_3840x2160"), exist_ok=True)
        os.makedirs(os.path.join(save_dir, "phone_978x2160"), exist_ok=True)
        
        # 加载已下载记录
        self._load_progress()
    
    def _load_progress(self):
        """加载已下载进度"""
        if os.path.exists(self.metadata_file):
            with open(self.metadata_file, "r", encoding="utf-8") as f:
                self.all_wallpapers = json.load(f)
            logger.info(f"已加载 {len(self.all_wallpapers)} 条壁纸元数据")
        
        if os.path.exists(self.progress_file):
            with open(self.progress_file, "r", encoding="utf-8") as f:
                progress = json.load(f)
                self.downloaded_urls = set(progress.get("downloaded", []))
            logger.info(f"已下载 {len(self.downloaded_urls)} 张图片")
    
    def _save_progress(self):
        """保存进度"""
        with open(self.metadata_file, "w", encoding="utf-8") as f:
            json.dump(self.all_wallpapers, f, ensure_ascii=False, indent=2)
        
        with open(self.progress_file, "w", encoding="utf-8") as f:
            json.dump({
                "downloaded": list(self.downloaded_urls),
                "last_update": datetime.now().isoformat(),
                "total": len(self.all_wallpapers),
            }, f, ensure_ascii=False, indent=2)
    
    def _request(self, url, retry=0):
        """带重试的请求"""
        try:
            time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))
            resp = self.session.get(url, timeout=TIMEOUT)
            resp.raise_for_status()
            return resp
        except Exception as e:
            if retry < MAX_RETRIES:
                logger.warning(f"请求失败 {url}, 重试 {retry+1}/{MAX_RETRIES}: {e}")
                time.sleep(2 * (retry + 1))
                return self._request(url, retry + 1)
            else:
                logger.error(f"请求失败 {url}: {e}")
                return None
    
    def get_max_page(self, category_url):
        """获取分类最大页数"""
        url = urljoin(BASE_URL, category_url)
        resp = self._request(url)
        if not resp:
            return 1
        
        soup = BeautifulSoup(resp.text, "html.parser")
        max_page = 1
        
        # 查找所有分页链接，提取最大页码
        page_links = soup.find_all("a", href=True)
        for a in page_links:
            href = a["href"]
            text = a.get_text(strip=True)
            # 匹配首页分页 /page/N/
            m1 = re.search(r"/page/(\d+)/?", href)
            # 匹配分类分页 /category/N/  (数字且非详情页)
            m2 = re.search(r"/(\d+)/?$", href)
            
            if m1 and BASE_URL in urljoin(BASE_URL, href):
                p = int(m1.group(1))
                max_page = max(max_page, p)
            elif m2 and category_url.rstrip("/") in href and "/p/" not in href:
                p = int(m2.group(1))
                if 1 < p < 10000:
                    max_page = max(max_page, p)
        
        return max_page
    
    def parse_list_page(self, url):
        """解析列表页，获取壁纸详情链接"""
        resp = self._request(url)
        if not resp:
            return []
        
        soup = BeautifulSoup(resp.text, "html.parser")
        wallpaper_links = []
        
        for a in soup.find_all("a", href=re.compile(r"/p/\d+\.html")):
            href = a["href"]
            if href.startswith("/"):
                href = urljoin(BASE_URL, href)
            if href not in wallpaper_links:
                wallpaper_links.append(href)
        
        return wallpaper_links
    
    def parse_detail_page(self, url, category=""):
        """解析详情页，提取壁纸信息"""
        resp = self._request(url)
        if not resp:
            return None
        
        soup = BeautifulSoup(resp.text, "html.parser")
        
        # 壁纸ID
        m = re.search(r"/p/(\d+)\.html", url)
        wid = m.group(1) if m else hashlib.md5(url.encode()).hexdigest()[:10]
        
        # 标题
        title_tag = soup.find("h1")
        title = title_tag.get_text(strip=True) if title_tag else "未命名"
        
        # 主图（缩略图）
        main_img = soup.find("img", class_="img-lightbox")
        thumb_url = main_img.get("src", "") if main_img else ""
        
        # 原图URL (去掉-arthumbs后缀)
        original_url = thumb_url.replace("-arthumbs", "").replace("-pcthumbs", "")
        
        # 提取下载链接（多个尺寸）
        pc_url = ""
        phone_url = ""
        normal_url = ""
        
        all_links = soup.find_all("a", href=True)
        for a in all_links:
            href = a["href"]
            text = a.get_text(strip=True)
            if "panlai.com" not in href:
                continue
            if "电脑" in text or "3840" in text:
                pc_url = href
            elif "手机" in text or "978" in text:
                phone_url = href
            elif "普通" in text or "1920" in text:
                normal_url = href
        
        # 如果没找到下载按钮，从原图URL构造
        if not pc_url and original_url:
            pc_url = original_url + "?x-oss-process=image/auto-orient,1/interlace,1/resize,m_fill,w_3840,h_2160"
        if not phone_url and original_url:
            phone_url = original_url + "?x-oss-process=image/auto-orient,1/interlace,1/resize,m_fill,w_978,h_2160"
        
        # 标签
        tags = []
        tag_area = soup.find("div", class_=re.compile(r"tag|labels?", re.I))
        if tag_area:
            for a in tag_area.find_all("a"):
                tag_text = a.get_text(strip=True)
                if tag_text:
                    tags.append(tag_text)
        
        # 发布时间
        date = ""
        date_tag = soup.find("time") or soup.find("span", class_="date")
        if date_tag:
            date = date_tag.get_text(strip=True)
        
        # 分辨率提取
        resolution = ""
        res_match = re.search(r"(\d{3,4})\s*[xX×]\s*(\d{3,4})", title)
        if res_match:
            resolution = f"{res_match.group(1)}x{res_match.group(2)}"
        
        # 文件扩展名
        ext = "jpg"
        if ".png" in original_url:
            ext = "png"
        elif ".webp" in original_url:
            ext = "webp"
        
        wallpaper_info = {
            "id": wid,
            "url": url,
            "title": self._clean_filename(title),
            "original_title": title,
            "category": category,
            "tags": tags,
            "date": date,
            "resolution": resolution,
            "thumb_url": thumb_url,
            "original_url": original_url,
            "pc_url": pc_url,
            "phone_url": phone_url,
            "extension": ext,
            "downloaded": False,
            "download_time": "",
        }
        
        return wallpaper_info
    
    def _clean_filename(self, name):
        """清理文件名"""
        name = re.sub(r'[\\/*?:"<>|]', "_", name)
        name = re.sub(r"\s+", " ", name).strip()
        if len(name) > 100:
            name = name[:100]
        return name
    
    def download_image(self, url, save_path):
        """下载单张图片"""
        if url in self.downloaded_urls and os.path.exists(save_path):
            return True
        
        try:
            resp = self.session.get(url, timeout=TIMEOUT, stream=True)
            resp.raise_for_status()
            
            with open(save_path, "wb") as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            
            self.downloaded_urls.add(url)
            return True
        except Exception as e:
            logger.error(f"下载失败 {url}: {e}")
            if os.path.exists(save_path):
                os.remove(save_path)
            return False
    
    def download_wallpaper(self, info):
        """下载单个壁纸的所有选定尺寸"""
        wid = info["id"]
        title = info["title"]
        ext = info["extension"]
        downloaded = False
        
        # 原图
        if self.download_original and info["original_url"]:
            filename = f"{wid}_{title}.{ext}"
            save_path = os.path.join(self.save_dir, "original", filename)
            if not os.path.exists(save_path):
                if self.download_image(info["original_url"], save_path):
                    logger.info(f"[原图] {title}")
                    downloaded = True
            else:
                downloaded = True
        
        # 电脑版
        if self.download_pc and info["pc_url"]:
            filename = f"{wid}_{title}_pc.jpg"
            save_path = os.path.join(self.save_dir, "pc_3840x2160", filename)
            if not os.path.exists(save_path):
                if self.download_image(info["pc_url"], save_path):
                    logger.info(f"[电脑] {title}")
                    downloaded = True
            else:
                downloaded = True
        
        # 手机版
        if self.download_phone and info["phone_url"]:
            filename = f"{wid}_{title}_phone.jpg"
            save_path = os.path.join(self.save_dir, "phone_978x2160", filename)
            if not os.path.exists(save_path):
                if self.download_image(info["phone_url"], save_path):
                    logger.info(f"[手机] {title}")
                    downloaded = True
            else:
                downloaded = True
        
        if downloaded:
            info["downloaded"] = True
            info["download_time"] = datetime.now().isoformat()
        
        return downloaded
    
    def crawl_category(self, category_name, category_url, start_page=1, max_pages=None):
        """爬取单个分类"""
        logger.info(f"开始爬取分类: {category_name}")
        
        all_detail_urls = []
        page = start_page
        consecutive_empty = 0
        max_consecutive_empty = 3
        
        while True:
            if max_pages and page > max_pages:
                break
            
            if category_url == "/":
                if page == 1:
                    page_url = urljoin(BASE_URL, "/")
                else:
                    page_url = urljoin(BASE_URL, f"/page/{page}/")
            else:
                cat_path = category_url.rstrip("/")
                if page == 1:
                    page_url = urljoin(BASE_URL, category_url)
                else:
                    page_url = urljoin(BASE_URL, f"{cat_path}/{page}/")
            
            logger.info(f"  爬取 [{category_name}] 第 {page} 页")
            links = self.parse_list_page(page_url)
            
            if not links:
                consecutive_empty += 1
                if consecutive_empty >= max_consecutive_empty:
                    logger.info(f"  连续 {max_consecutive_empty} 页无内容，停止爬取")
                    break
            else:
                consecutive_empty = 0
                new_count = 0
                for link in links:
                    if link not in [v["url"] for v in self.all_wallpapers.values()] and link not in [u for u, _ in all_detail_urls]:
                        all_detail_urls.append((link, category_name))
                        new_count += 1
                
                if new_count == 0 and page > 5:
                    # 后续页面都是已爬取过的旧内容，停止
                    logger.info(f"  第 {page} 页无新内容，停止爬取")
                    break
            
            if page % 10 == 0:
                self._save_progress()
            
            page += 1
        
        logger.info(f"  [{category_name}] 爬取完成，共 {page-1} 页，{len(all_detail_urls)} 个新壁纸")
        return all_detail_urls
    
    def run(self, categories=None, max_pages=None, skip_crawl=False, skip_download=False):
        """运行爬虫"""
        logger.info("=" * 60)
        logger.info("壁纸汇全站爬虫启动")
        logger.info(f"保存目录: {self.save_dir}")
        logger.info(f"下载原图: {self.download_original}, 电脑版: {self.download_pc}, 手机版: {self.download_phone}")
        logger.info("=" * 60)
        
        all_detail_urls = []
        
        if not skip_crawl:
            cats_to_crawl = categories if categories else CATEGORIES
            
            for cat_name, cat_url in cats_to_crawl.items():
                urls = self.crawl_category(cat_name, cat_url, max_pages=max_pages)
                all_detail_urls.extend(urls)
            
            logger.info(f"共发现 {len(all_detail_urls)} 个新壁纸页面")
            
            # 解析详情页获取元数据
            for idx, (url, cat) in enumerate(all_detail_urls, 1):
                if url in [v["url"] for v in self.all_wallpapers.values()]:
                    continue
                
                logger.info(f"解析详情页 {idx}/{len(all_detail_urls)}: {url}")
                info = self.parse_detail_page(url, cat)
                if info and info["original_url"]:
                    self.all_wallpapers[info["id"]] = info
                
                if idx % 20 == 0:
                    self._save_progress()
            
            self._save_progress()
            logger.info(f"元数据解析完成，共 {len(self.all_wallpapers)} 个壁纸")
        
        if not skip_download:
            logger.info("开始下载图片...")
            to_download = [info for info in self.all_wallpapers.values() if not info["downloaded"]]
            logger.info(f"待下载: {len(to_download)} 个壁纸")
            
            with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
                futures = {executor.submit(self.download_wallpaper, info): info["id"] for info in to_download}
                
                completed = 0
                for future in as_completed(futures):
                    wid = futures[future]
                    try:
                        result = future.result()
                        completed += 1
                        if completed % 10 == 0:
                            self._save_progress()
                            logger.info(f"下载进度: {completed}/{len(to_download)}")
                    except Exception as e:
                        logger.error(f"下载壁纸 {wid} 出错: {e}")
            
            self._save_progress()
        
        # 生成统计报告
        self._generate_report()
        logger.info("爬取完成!")
    
    def _generate_report(self):
        """生成统计报告"""
        total = len(self.all_wallpapers)
        downloaded = sum(1 for v in self.all_wallpapers.values() if v["downloaded"])
        
        categories = {}
        for v in self.all_wallpapers.values():
            cat = v["category"] or "未分类"
            categories[cat] = categories.get(cat, 0) + 1
        
        report = f"""
========== 爬取报告 ==========
总壁纸数: {total}
已下载: {downloaded}
下载目录: {os.path.abspath(self.save_dir)}

分类统计:
"""
        for cat, count in sorted(categories.items(), key=lambda x: -x[1]):
            report += f"  {cat}: {count} 张\n"
        
        report += "==============================\n"
        
        print(report)
        with open(os.path.join(self.save_dir, "report.txt"), "w", encoding="utf-8") as f:
            f.write(report)


def main():
    global MAX_WORKERS
    
    parser = argparse.ArgumentParser(description="壁纸汇全站爬虫 (bizhihui.com)")
    parser.add_argument("-d", "--dir", default=SAVE_DIR, help="保存目录")
    parser.add_argument("-o", "--original", action="store_true", default=True, help="下载原图 (默认开启)")
    parser.add_argument("-p", "--pc", action="store_true", help="下载电脑版 3840x2160")
    parser.add_argument("-m", "--phone", action="store_true", help="下载手机版 978x2160")
    parser.add_argument("-c", "--category", nargs="+", help="指定爬取分类，如 dongman fengjing")
    parser.add_argument("--max-pages", type=int, help="每个分类最大爬取页数")
    parser.add_argument("--skip-crawl", action="store_true", help="跳过爬取，直接下载")
    parser.add_argument("--skip-download", action="store_true", help="只爬取元数据，不下载图片")
    parser.add_argument("--workers", type=int, default=MAX_WORKERS, help="下载线程数")
    
    args = parser.parse_args()
    
    MAX_WORKERS = args.workers
    
    # 选择分类
    cats = None
    if args.category:
        cats = {}
        for key in args.category:
            # 匹配中文名或路径名
            for cn_name, url in CATEGORIES.items():
                if key in url or key in cn_name or url.strip("/") == key:
                    cats[cn_name] = url
                    break
        if not cats:
            logger.error(f"未找到分类: {args.category}")
            logger.info(f"可用分类: {list(CATEGORIES.keys())} {list(CATEGORIES.values())}")
            return
    
    spider = WallpaperSpider(
        save_dir=args.dir,
        download_original=args.original,
        download_pc=args.pc,
        download_phone=args.phone,
    )
    
    spider.run(
        categories=cats,
        max_pages=args.max_pages,
        skip_crawl=args.skip_crawl,
        skip_download=args.skip_download,
    )


if __name__ == "__main__":
    main()
