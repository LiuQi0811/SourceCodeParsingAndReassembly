#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
樱花动漫(yhdmhy.com)全站爬虫
支持:
1. 全动漫列表爬取
2. 详情信息采集
3. m3u8视频解析
4. AES-128自动解密下载
5. 多线程TS片段下载
6. 自动合并为MP4
7. 断点续传
"""

import os
import re
import json
import time
import base64
import hashlib
import requests
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from Crypto.Cipher import AES
from bs4 import BeautifulSoup
from tqdm import tqdm
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('crawler.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

BASE_URL = "https://www.yhdmhy.com"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': BASE_URL + '/',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}

# 保存目录
SAVE_DIR = "樱花动漫下载"
os.makedirs(SAVE_DIR, exist_ok=True)


class YhdmCrawler:
    def __init__(self, max_workers=16, download_ts_workers=32):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.max_workers = max_workers
        self.download_ts_workers = download_ts_workers
        self.downloaded_anime = set()
        self.load_progress()

    def load_progress(self):
        """加载已下载进度"""
        progress_file = os.path.join(SAVE_DIR, 'progress.json')
        if os.path.exists(progress_file):
            with open(progress_file, 'r', encoding='utf-8') as f:
                self.downloaded_anime = set(json.load(f).get('downloaded', []))
            logger.info(f"已加载进度，已完成 {len(self.downloaded_anime)} 部动漫")

    def save_progress(self):
        """保存下载进度"""
        progress_file = os.path.join(SAVE_DIR, 'progress.json')
        with open(progress_file, 'w', encoding='utf-8') as f:
            json.dump({'downloaded': list(self.downloaded_anime)}, f, ensure_ascii=False, indent=2)

    def get_page(self, url, retries=3):
        """获取页面内容，带重试"""
        for i in range(retries):
            try:
                resp = self.session.get(url, timeout=30)
                resp.encoding = 'utf-8'
                if resp.status_code == 200:
                    return resp.text
                elif resp.status_code == 404:
                    return None
            except Exception as e:
                logger.warning(f"请求失败 {url}，第{i+1}次重试: {e}")
                time.sleep(2 ** i)
        return None

    def get_anime_list_page(self, page=1):
        """获取动漫列表页的所有动漫ID"""
        if page == 1:
            url = BASE_URL + "/"
        else:
            url = f"{BASE_URL}/page/{page}.html"
        
        html = self.get_page(url)
        if not html:
            return [], False
        
        soup = BeautifulSoup(html, 'html.parser')
        anime_links = soup.select('a[href*="/detail/"]')
        anime_ids = set()
        for link in anime_links:
            href = link.get('href', '')
            match = re.search(r'/detail/(\d+)', href)
            if match:
                anime_ids.add(match.group(1))
        
        # 判断是否有下一页
        has_next = bool(soup.select_one('a.next') or page < 100)
        
        return list(anime_ids), has_next

    def get_all_anime_ids(self, max_pages=None):
        """获取所有动漫ID"""
        all_anime_ids = []
        page = 1
        
        while True:
            if max_pages and page > max_pages:
                break
            
            logger.info(f"正在爬取列表页第 {page} 页")
            anime_ids, has_next = self.get_anime_list_page(page)
            
            if not anime_ids:
                break
                
            new_ids = [aid for aid in anime_ids if aid not in self.downloaded_anime]
            all_anime_ids.extend(new_ids)
            logger.info(f"第 {page} 页发现 {len(anime_ids)} 部动漫，新增 {len(new_ids)} 部")
            
            if not has_next:
                break
                
            page += 1
            time.sleep(1)
        
        logger.info(f"总共获取到 {len(all_anime_ids)} 部待爬取动漫")
        return all_anime_ids

    def get_anime_detail(self, anime_id):
        """获取动漫详情"""
        url = f"{BASE_URL}/detail/{anime_id}"
        html = self.get_page(url)
        if not html:
            return None
        
        soup = BeautifulSoup(html, 'html.parser')
        
        # 获取标题 - 使用age-anime-title
        title_elem = soup.select_one('.age-anime-title')
        if not title_elem:
            title_elem = soup.select_one('h1, h5')
        title = title_elem.get_text(strip=True) if title_elem else f"动漫_{anime_id}"
        
        # 清理文件名非法字符
        title = re.sub(r'[\\/*?:"<>|]', '', title)
        
        # 获取基本信息
        info = {}
        info_items = soup.select('li')
        for item in info_items:
            spans = item.select('span')
            if len(spans) >= 2:
                key = spans[0].get_text(strip=True).replace(' ', '')
                value = spans[1].get_text(strip=True)
                info[key] = value
        
        # 获取封面
        poster = None
        img_elem = soup.select_one('img.card-img-')
        if img_elem:
            poster = urljoin(BASE_URL, img_elem.get('src', ''))
        
        # 获取所有播放集数 - 链接是 /play/xxx 格式
        episodes = []
        play_links = soup.select('a.age-episode[href*="/play/"]')
        for link in play_links:
            ep_name = link.get_text(strip=True)
            play_url = urljoin(BASE_URL, link.get('href', ''))
            episodes.append({
                'name': ep_name,
                'play_url': play_url,
                'player_url': None
            })
        
        return {
            'id': anime_id,
            'title': title,
            'info': info,
            'poster': poster,
            'episodes': episodes,
            'save_dir': os.path.join(SAVE_DIR, title)
        }

    def get_player_and_m3u8(self, play_url):
        """从play页面获取iframe player地址，然后获取m3u8"""
        # 先访问play页面
        html = self.get_page(play_url)
        if not html:
            return None, None
        
        # 提取iframe src
        match = re.search(r'<iframe[^>]+src="([^"]*_player_x_[^"]*)"', html)
        if not match:
            return None, None
        
        player_url = urljoin(BASE_URL, match.group(1))
        
        # 访问player页面获取m3u8
        player_html = self.get_page(player_url)
        if not player_html:
            return None, None
        
        # 提取source标签中的m3u8地址
        m = re.search(r'<source\s+src="([^"]+\.m3u8[^"]*)"', player_html)
        if m:
            m3u8_url = m.group(1)
            if not m3u8_url.startswith('http'):
                m3u8_url = urljoin(player_url, m3u8_url)
            return m3u8_url, None
        
        # 提取mp4地址
        m = re.search(r'<source\s+src="([^"]+\.mp4[^"]*)"', player_html)
        if m:
            return m.group(1), 'mp4'
        
        return None, None

    def download_m3u8(self, m3u8_url, save_path, anime_title, ep_name):
        """下载m3u8视频，自动处理AES-128解密"""
        logger.info(f"开始下载: {anime_title} - {ep_name}")
        
        # 创建临时目录
        temp_dir = save_path + '_temp'
        os.makedirs(temp_dir, exist_ok=True)
        
        # 1. 下载m3u8文件
        try:
            m3u8_content = self.session.get(m3u8_url, timeout=30).text
        except Exception as e:
            logger.error(f"下载m3u8失败: {e}")
            return False
        
        # 解析m3u8
        key = None
        iv = None
        ts_urls = []
        key_url = None
        
        lines = m3u8_content.split('\n')
        for i, line in enumerate(lines):
            line = line.strip()
            
            if line.startswith('#EXT-X-KEY:'):
                # 解析加密信息
                method_match = re.search(r'METHOD=([^,]+)', line)
                uri_match = re.search(r'URI="([^"]+)"', line)
                iv_match = re.search(r'IV=0x([0-9a-fA-F]+)', line)
                
                if method_match and method_match.group(1) == 'AES-128' and uri_match:
                    key_url = uri_match.group(1)
                    # 处理key的相对路径
                    if not key_url.startswith('http'):
                        key_url = urljoin(m3u8_url, key_url)
                
                if iv_match:
                    iv_hex = iv_match.group(1)
                    iv = bytes.fromhex(iv_hex)
            
            elif line and not line.startswith('#'):
                # ts地址
                ts_url = line
                if not ts_url.startswith('http'):
                    ts_url = urljoin(m3u8_url, ts_url)
                ts_urls.append(ts_url)
        
        if not ts_urls:
            logger.error(f"未找到TS片段: {m3u8_url}")
            return False
        
        # 2. 获取解密密钥
        if key_url:
            logger.info(f"检测到AES-128加密，正在获取密钥...")
            for _ in range(3):
                try:
                    key_resp = self.session.get(key_url, timeout=30)
                    key = key_resp.content
                    if len(key) == 16:
                        break
                except Exception as e:
                    logger.warning(f"获取密钥失败: {e}")
                    time.sleep(2)
            
            if not key or len(key) != 16:
                logger.error("获取密钥失败，无法解密视频")
                return False
            
            logger.info("密钥获取成功，开始解密下载")
        
        # 3. 多线程下载TS片段
        logger.info(f"共 {len(ts_urls)} 个TS片段，开始多线程下载...")
        
        # 检查已下载的片段
        ts_files = {}
        downloaded_count = 0
        
        def download_ts(idx_tsurl):
            idx, ts_url = idx_tsurl
            ts_file = os.path.join(temp_dir, f"ts_{idx:05d}.ts")
            
            if os.path.exists(ts_file):
                return idx, ts_file, True
            
            for retry in range(3):
                try:
                    headers = {'Referer': m3u8_url}
                    resp = self.session.get(ts_url, headers=headers, timeout=60)
                    
                    if key:
                        # 需要解密
                        if iv:
                            # 使用m3u8中指定的IV
                            cipher = AES.new(key, AES.MODE_CBC, iv)
                        else:
                            # 使用序号作为IV (常见情况)
                            ep_iv = idx.to_bytes(16, byteorder='big')
                            cipher = AES.new(key, AES.MODE_CBC, ep_iv)
                        
                        decrypted = cipher.decrypt(resp.content)
                        
                        # 去除PKCS7填充
                        padding_len = decrypted[-1]
                        if padding_len <= 16 and all(b == padding_len for b in decrypted[-padding_len:]):
                            decrypted = decrypted[:-padding_len]
                        
                        with open(ts_file, 'wb') as f:
                            f.write(decrypted)
                    else:
                        # 无加密，直接保存
                        with open(ts_file, 'wb') as f:
                            f.write(resp.content)
                    
                    return idx, ts_file, True
                    
                except Exception as e:
                    if retry == 2:
                        logger.warning(f"下载TS片段 {idx} 失败: {e}")
                        return idx, None, False
                    time.sleep(retry + 1)
        
        with ThreadPoolExecutor(max_workers=self.download_ts_workers) as executor:
            futures = [executor.submit(download_ts, (i, url)) for i, url in enumerate(ts_urls)]
            
            with tqdm(total=len(ts_urls), desc=f"{ep_name}", unit="ts") as pbar:
                for future in as_completed(futures):
                    idx, ts_file, success = future.result()
                    if success and ts_file:
                        ts_files[idx] = ts_file
                    pbar.update(1)
        
        # 检查是否全部下载成功
        success_count = len(ts_files)
        if success_count < len(ts_urls):
            logger.warning(f"部分TS片段下载失败: {success_count}/{len(ts_urls)}")
        
        # 4. 合并TS文件
        logger.info(f"开始合并 {success_count} 个TS片段...")
        with open(save_path, 'wb') as outf:
            for i in range(len(ts_urls)):
                ts_file = os.path.join(temp_dir, f"ts_{i:05d}.ts")
                if os.path.exists(ts_file):
                    with open(ts_file, 'rb') as inf:
                        outf.write(inf.read())
        
        # 5. 删除临时文件
        import shutil
        try:
            shutil.rmtree(temp_dir)
        except:
            pass
        
        logger.info(f"下载完成: {save_path}")
        return True

    def download_episode(self, anime, episode):
        """下载单集"""
        ep_name = re.sub(r'[\\/*?:"<>|]', '', episode['name'])
        save_path = os.path.join(anime['save_dir'], f"{ep_name}.mp4")
        
        # 检查是否已下载
        if os.path.exists(save_path) and os.path.getsize(save_path) > 1024*1024:  # 大于1MB认为已下载完成
            logger.info(f"已跳过: {anime['title']} - {ep_name}")
            return True
        
        os.makedirs(anime['save_dir'], exist_ok=True)
        
        # 获取m3u8地址
        m3u8_url, video_type = self.get_player_and_m3u8(episode['play_url'])
        if not m3u8_url:
            logger.warning(f"未获取到视频地址: {anime['title']} - {ep_name}")
            return False
        
        if video_type == 'mp4':
            # 直接下载mp4
            try:
                logger.info(f"直接下载MP4: {anime['title']} - {ep_name}")
                resp = self.session.get(m3u8_url, stream=True, timeout=60)
                total_size = int(resp.headers.get('content-length', 0))
                
                with open(save_path, 'wb') as f, tqdm(
                    desc=ep_name,
                    total=total_size,
                    unit='B',
                    unit_scale=True,
                ) as pbar:
                    for chunk in resp.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                            pbar.update(len(chunk))
                return True
            except Exception as e:
                logger.error(f"下载MP4失败: {e}")
                return False
        else:
            # m3u8下载
            return self.download_m3u8(m3u8_url, save_path, anime['title'], ep_name)

    def download_anime(self, anime_id):
        """下载单部动漫的所有集"""
        logger.info(f"开始处理动漫: {anime_id}")
        
        # 获取详情
        anime = self.get_anime_detail(anime_id)
        if not anime:
            logger.error(f"获取动漫详情失败: {anime_id}")
            return False
        
        logger.info(f"动漫: {anime['title']}, 共 {len(anime['episodes'])} 集")
        
        # 保存详情信息
        os.makedirs(anime['save_dir'], exist_ok=True)
        meta_file = os.path.join(anime['save_dir'], 'info.json')
        with open(meta_file, 'w', encoding='utf-8') as f:
            json.dump(anime, f, ensure_ascii=False, indent=2)
        
        # 下载封面
        if anime.get('poster'):
            poster_ext = os.path.splitext(urlparse(anime['poster']).path)[1] or '.jpg'
            poster_path = os.path.join(anime['save_dir'], f'poster{poster_ext}')
            if not os.path.exists(poster_path):
                try:
                    r = self.session.get(anime['poster'], timeout=30)
                    with open(poster_path, 'wb') as f:
                        f.write(r.content)
                except:
                    pass
        
        # 下载每一集
        success_count = 0
        for episode in anime['episodes']:
            if self.download_episode(anime, episode):
                success_count += 1
            time.sleep(1)
        
        logger.info(f"动漫 {anime['title']} 下载完成: {success_count}/{len(anime['episodes'])} 集")
        self.downloaded_anime.add(anime_id)
        self.save_progress()
        return True

    def crawl_all(self, max_pages=None, max_anime=None):
        """全站爬取"""
        logger.info("=== 开始全站爬取 ===")
        
        # 获取所有动漫ID
        all_anime_ids = self.get_all_anime_ids(max_pages=max_pages)
        
        if max_anime:
            all_anime_ids = all_anime_ids[:max_anime]
        
        logger.info(f"开始爬取 {len(all_anime_ids)} 部动漫")
        
        for i, anime_id in enumerate(all_anime_ids, 1):
            logger.info(f"=== 进度: {i}/{len(all_anime_ids)} ===")
            try:
                self.download_anime(anime_id)
            except Exception as e:
                logger.error(f"处理动漫 {anime_id} 出错: {e}", exc_info=True)
            time.sleep(2)
        
        logger.info("=== 全站爬取完成 ===")

    def search_and_download(self, keyword):
        """搜索动漫并下载"""
        # 搜索接口
        search_url = f"{BASE_URL}/search/{keyword}"
        html = self.get_page(search_url)
        if not html:
            logger.error(f"搜索失败: {keyword}")
            return []
        
        soup = BeautifulSoup(html, 'html.parser')
        anime_links = soup.select('a[href*="/detail/"]')
        anime_ids = set()
        for link in anime_links:
            href = link.get('href', '')
            match = re.search(r'/detail/(\d+)', href)
            if match:
                anime_ids.add(match.group(1))
        
        anime_ids = list(anime_ids)
        logger.info(f"搜索到 {len(anime_ids)} 部相关动漫")
        
        for anime_id in anime_ids:
            self.download_anime(anime_id)
        
        return list(anime_ids)


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='樱花动漫全站爬虫')
    parser.add_argument('--mode', default='all', choices=['all', 'search', 'single'], 
                        help='运行模式: all=全站爬取, search=搜索下载, single=单部下载')
    parser.add_argument('--keyword', type=str, help='搜索关键词')
    parser.add_argument('--anime_id', type=str, help='单部动漫ID')
    parser.add_argument('--max_pages', type=int, default=None, help='最大爬取页数')
    parser.add_argument('--max_anime', type=int, default=None, help='最大爬取动漫数')
    parser.add_argument('--workers', type=int, default=16, help='并发线程数')
    parser.add_argument('--ts_workers', type=int, default=32, help='TS下载线程数')
    
    args = parser.parse_args()
    
    crawler = YhdmCrawler(max_workers=args.workers, download_ts_workers=args.ts_workers)
    
    if args.mode == 'all':
        crawler.crawl_all(max_pages=args.max_pages, max_anime=args.max_anime)
    elif args.mode == 'search':
        if not args.keyword:
            print("请指定搜索关键词 --keyword")
            return
        crawler.search_and_download(args.keyword)
    elif args.mode == 'single':
        if not args.anime_id:
            print("请指定动漫ID --anime_id")
            return
        crawler.download_anime(args.anime_id)


if __name__ == '__main__':
    print("=" * 60)
    print("樱花动漫(yhdmhy.com)全站爬虫")
    print("支持AES-128自动解密 | 多线程下载 | 自动合并MP4")
    print("=" * 60)
    print()
    main()
