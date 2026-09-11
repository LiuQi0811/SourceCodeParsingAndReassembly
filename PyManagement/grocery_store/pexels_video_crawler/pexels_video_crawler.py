#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pexels 全站视频爬虫 (极致精简稳定版)

逆向分析最终结论 (完美逆向):
1. Pexels视频无任何加密/DRM，全部是标准MP4文件托管在 videos.pexels.com
2. Cloudflare只保护HTML页面，CDN视频域名完全无防护（requests直接下载）
3. 视频文件命名逆向规律:
   - 预览版URL示例: https://videos.pexels.com/video-files/37936241/16097296_360_640_24fps.mp4
   - 格式: /{video_id}/{file_hash}_{width}_{height}_{fps}fps.mp4
   - 分辨率越大，file_hash依次+1！
     360p → hash+0, 540p→hash+1, 720p→hash+2, 1080p→hash+3, 1440p→hash+4, 2160p→hash+5
   - 横屏/竖屏方向由宽高顺序自动适配
4. 方案: Playwright访问一次列表页(绕过Cloudflare)提取视频ID和预览src，
        然后根据规律构造所有分辨率URL，requests多线程高速直下CDN！

安装依赖: pip install requests tqdm playwright && playwright install chromium
"""

import os
import re
import json
import time
import random
import logging
import argparse
from pathlib import Path
from urllib.parse import quote
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

import requests
from tqdm import tqdm
from playwright.sync_api import sync_playwright

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.FileHandler('pexels.log', encoding='utf-8'), logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

BASE_URL = "https://www.pexels.com"
CDN = "https://videos.pexels.com/video-files"
CDN_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Referer': BASE_URL + '/',
}

# 分辨率配置 (name, max_dim, hash_offset)
# hash_offset是相对于预览版(一般为360p)的偏移量
RESOLUTIONS = [
    ('2160p', 2160, 5),  # 4K UHD
    ('1440p', 1440, 4),  # 2K QHD
    ('1080p', 1080, 3),  # Full HD
    ('720p', 720, 2),    # HD
    ('540p', 540, 1),    # qHD
    ('360p', 360, 0),    # SD
    ('240p', 240, -1),   # LD (hash_offset=-1 表示比预览更低)
]


def get_browser():
    """启动Playwright浏览器获取一次页面内容"""
    logger.info("启动浏览器绕过Cloudflare...")
    pw = sync_playwright().start()
    browser = pw.chromium.launch(headless=True)
    ctx = browser.new_context(
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport={'width': 1920, 'height': 1080},
        locale='en-US',
    )
    page = ctx.new_page()
    return pw, browser, ctx, page


def close_browser(pw, browser, ctx):
    try:
        ctx.close()
        browser.close()
        pw.stop()
    except:
        pass


def get_page_html(page, url, wait=5):
    """获取页面HTML"""
    try:
        page.goto(url, wait_until='domcontentloaded', timeout=60000)
        time.sleep(wait)
        return page.content()
    except Exception as e:
        logger.error(f"页面加载失败: {e}")
        return ""


def extract_videos_from_html(html):
    """从HTML提取视频ID、预览hash、fps、方向"""
    videos = {}
    
    # 从video src提取完整信息
    # 模式: video-files/ID/HASH_WIDTH_HEIGHT_FPSfps.mp4
    pattern = r'video-files/(\d+)/(\d+)_(\d+)_(\d+)_(\d+)fps\.mp4'
    for vid, fhash, w, h, fps in re.findall(pattern, html):
        vid = str(vid)
        if vid not in videos:
            videos[vid] = {
                'id': vid,
                'base_hash': int(fhash),
                'preview_w': int(w),
                'preview_h': int(h),
                'fps': int(fps),
                # 判断竖屏还是横屏
                'portrait': int(h) > int(w),
            }
    
    # 补充从详情链接提取的视频ID（无src的）
    for vid in re.findall(r'/video/[^"]+-(\d{6,})/["\']', html):
        vid = str(vid)
        if vid not in videos:
            videos[vid] = {'id': vid, 'base_hash': None}
    
    return list(videos.values())


def construct_video_urls(video, quality='1080p'):
    """
    根据逆向的文件名规律构造对应质量的视频URL
    核心逆向发现: 同一视频不同质量的文件hash连续递增
    基准: 预览版(360p)对应 hash+0
    """
    vid = video['id']
    base_hash = video.get('base_hash')
    fps = video.get('fps', 30)
    portrait = video.get('portrait', False)
    
    if not base_hash:
        return None
    
    # 分辨率映射: (hash_offset, width, height)
    # 以360p为基准(base_hash+0)
    res_map = {
        '240p': (-1, 240, 426),
        '360p': (0, 360, 640),
        '540p': (1, 540, 960),
        '720p': (2, 720, 1280),
        '1080p': (3, 1080, 1920),
        '1440p': (4, 1440, 2560),
        '2160p': (5, 2160, 3840),
    }
    
    if quality not in res_map:
        quality = '1080p'
    
    offset, w, h = res_map[quality]
    if not portrait:
        w, h = h, w  # 横屏交换宽高
    
    file_hash = base_hash + offset
    url = f"{CDN}/{vid}/{file_hash}_{w}_{h}_{fps}fps.mp4"
    return {
        'url': url,
        'width': w,
        'height': h,
        'fps': fps,
        'hash': file_hash,
    }


def verify_url(url):
    """验证URL是否存在"""
    try:
        r = requests.head(url, headers=CDN_HEADERS, timeout=10, allow_redirects=True)
        return r.status_code == 200, int(r.headers.get('content-length', 0))
    except:
        return False, 0


def download_video(video, quality, save_dir):
    """下载单个视频"""
    vid = video['id']
    
    # 构造URL并验证（从最高质量开始往下尝试）
    target_info = None
    quality_order = ['2160p', '1440p', '1080p', '720p', '540p', '360p', '240p']
    if quality in quality_order:
        start_idx = quality_order.index(quality)
    else:
        start_idx = 2  # 1080p
    
    for q in quality_order[start_idx:]:
        info = construct_video_urls(video, q)
        if not info:
            continue
        ok, size = verify_url(info['url'])
        if ok and size > 10000:
            target_info = info
            target_info['quality'] = q
            target_info['size'] = size
            break
    
    if not target_info:
        # 如果构造失败，尝试用原始预览URL
        if video.get('base_hash'):
            w, h, fps = video['preview_w'], video['preview_h'], video['fps']
            url = f"{CDN}/{vid}/{video['base_hash']}_{w}_{h}_{fps}fps.mp4"
            ok, size = verify_url(url)
            if ok:
                target_info = {'url': url, 'width': w, 'height': h, 'fps': fps, 'quality': 'preview', 'size': size}
    
    if not target_info:
        return False, vid
    
    url = target_info['url']
    w, h = target_info['width'], target_info['height']
    
    filename = f"{vid}_{w}x{h}_{target_info['quality']}.mp4"
    filepath = save_dir / filename
    partpath = filepath.with_suffix('.part')
    
    # 断点续传
    downloaded = 0
    if filepath.exists():
        if abs(filepath.stat().st_size - target_info['size']) < 10240:
            return True, vid
        filepath.unlink()
    
    if partpath.exists():
        downloaded = partpath.stat().st_size
    
    try:
        headers = dict(CDN_HEADERS)
        if downloaded > 0:
            headers['Range'] = f'bytes={downloaded}-'
        
        r = requests.get(url, headers=headers, stream=True, timeout=120)
        mode = 'ab' if downloaded > 0 else 'wb'
        
        with open(partpath, mode) as f, tqdm(
            desc=filename[:35].ljust(35),
            total=target_info['size'],
            initial=downloaded,
            unit='B',
            unit_scale=True,
            unit_divisor=1024,
            leave=False
        ) as pbar:
            for chunk in r.iter_content(65536):
                if chunk:
                    f.write(chunk)
                    pbar.update(len(chunk))
        
        os.rename(partpath, filepath)
        return True, vid
    except Exception as e:
        logger.debug(f"下载失败 {vid}: {e}")
        return False, vid


# ==================== 主类 ====================
class PexelsCrawler:
    def __init__(self, save_dir='pexels_videos', quality='1080p', workers=5):
        self.save_dir = Path(save_dir)
        self.save_dir.mkdir(parents=True, exist_ok=True)
        self.quality = quality
        self.workers = workers
        self.session = requests.Session()
        self.session.headers.update(CDN_HEADERS)
        self.downloaded = set()
        self.lock = Lock()
        
        # 加载历史
        self.history_file = self.save_dir / 'downloaded.json'
        if self.history_file.exists():
            try:
                with open(self.history_file) as f:
                    self.downloaded = set(json.load(f).get('ids', []))
            except:
                pass
        
        logger.info(f"=" * 60)
        logger.info(f"Pexels视频爬虫启动 - 逆向完成: 无加密, 直链下载")
        logger.info(f"目标质量: {quality}, 并发数: {workers}")
        logger.info(f"保存目录: {self.save_dir.absolute()}")
        logger.info(f"已下载历史: {len(self.downloaded)} 个")
        logger.info(f"=" * 60)
    
    def _save_history(self):
        with self.lock:
            with open(self.history_file, 'w') as f:
                json.dump({'ids': list(self.downloaded)}, f)
    
    def crawl_popular(self, max_pages=10):
        pw, browser, ctx, page = get_browser()
        all_videos = {}
        try:
            # 直接访问视频列表页
            for p in range(1, max_pages + 1):
                url = f"{BASE_URL}/videos/" if p == 1 else f"{BASE_URL}/videos/?page={p}"
                html = get_page_html(page, url, wait=7)
                videos = extract_videos_from_html(html)
                new = 0
                for v in videos:
                    if v['id'] not in all_videos and v['id'] not in self.downloaded:
                        all_videos[v['id']] = v
                        new += 1
                logger.info(f"第{p}页: 解析到{len(videos)}个视频, 新增{new}个, 累计{len(all_videos)}个待下载")
                if new == 0 and p > 1:
                    break
                # 滚动触发加载更多
                try:
                    page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
                    time.sleep(3)
                except:
                    pass
        finally:
            close_browser(pw, browser, ctx)
        
        return list(all_videos.values())
    
    def crawl_search(self, keyword, max_pages=10):
        pw, browser, ctx, page = get_browser()
        all_videos = {}
        try:
            page.goto(BASE_URL, wait_until='domcontentloaded')
            time.sleep(3)
            
            for p in range(1, max_pages + 1):
                url = f"{BASE_URL}/search/videos/{quote(keyword)}/?page={p}"
                html = get_page_html(page, url, wait=4)
                videos = extract_videos_from_html(html)
                new = 0
                for v in videos:
                    if v['id'] not in all_videos and v['id'] not in self.downloaded:
                        all_videos[v['id']] = v
                        new += 1
                logger.info(f"搜索'{keyword}'第{p}页: 新增{new}, 累计{len(all_videos)}")
                if new == 0 and p > 2:
                    break
                page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
                time.sleep(2)
        finally:
            close_browser(pw, browser, ctx)
        return list(all_videos.values())
    
    def batch_download(self, videos):
        videos = [v for v in videos if v['id'] not in self.downloaded]
        if not videos:
            logger.info("没有需要下载的视频")
            return
        
        logger.info(f"\n开始下载 {len(videos)} 个视频...")
        success = 0
        fail = 0
        
        with ThreadPoolExecutor(max_workers=self.workers) as ex:
            futures = [ex.submit(download_video, v, self.quality, self.save_dir) for v in videos]
            for fut in tqdm(as_completed(futures), total=len(futures), desc="下载进度"):
                ok, vid = fut.result()
                if ok:
                    success += 1
                    with self.lock:
                        self.downloaded.add(vid)
                else:
                    fail += 1
        
        self._save_history()
        logger.info(f"\n下载完成! 成功: {success}, 失败: {fail}")
        logger.info(f"视频保存在: {self.save_dir.absolute()}")
    
    def run(self, mode='popular', keyword=None, pages=10, max_count=None):
        if mode == 'popular':
            videos = self.crawl_popular(pages)
        elif mode == 'search':
            videos = self.crawl_search(keyword, pages) if keyword else []
        else:
            videos = []
        
        if max_count and len(videos) > max_count:
            videos = videos[:max_count]
        
        self.batch_download(videos)


def main():
    parser = argparse.ArgumentParser(description='Pexels全站视频爬虫 - 完美逆向，直链下载')
    parser.add_argument('-m', '--mode', default='popular', choices=['popular', 'search'])
    parser.add_argument('-k', '--keyword', help='搜索关键词')
    parser.add_argument('-o', '--output', default='pexels_videos')
    parser.add_argument('-q', '--quality', default='1080p', choices=['2160p','1440p','1080p','720p','540p','360p'])
    parser.add_argument('-p', '--pages', type=int, default=10)
    parser.add_argument('-n', '--max', type=int, default=30)
    parser.add_argument('-w', '--workers', type=int, default=5)
    args = parser.parse_args()
    
    crawler = PexelsCrawler(args.output, args.quality, args.workers)
    crawler.run(args.mode, args.keyword, args.pages, args.max)


if __name__ == '__main__':
    main()
