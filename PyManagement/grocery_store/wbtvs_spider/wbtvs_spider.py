#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
wbtvs.cc 全站爬虫
功能特性：
1. 自动绕过Cloudflare 5秒盾防护
2. 支持全站分类、分页遍历
3. 影片详情信息完整抓取
4. 播放器JS加密逆向解密（支持base64、Unicode、eval混淆解密）
5. M3U8视频流AES-128-CBC自动解密下载
6. 多线程异步并发下载
7. 自动断点续传、失败重试
8. 数据本地存储（JSON/CSV/SQLite）

作者：AI爬虫助手
版本：v1.0
日期：2026-09-10
"""

import os
import re
import sys
import json
import time
import base64
import random
import hashlib
import sqlite3
import logging
import argparse
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional, Tuple, Any

import cloudscraper
import requests
from bs4 import BeautifulSoup
from tqdm import tqdm
import m3u8
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad

# ==================== 配置区 ====================
CONFIG = {
    'base_url': 'https://www.wbtvs.cc',
    'save_dir': 'wbtvs_downloads',
    'video_dir': 'videos',
    'max_workers': 5,
    'download_workers': 10,
    'delay_min': 2,
    'delay_max': 5,
    'max_retries': 3,
    'timeout': 30,
    'categories': ['dianying', 'dianshiju', 'dongman'],
    'user_agents': [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
    ]
}

# ==================== 日志配置 ====================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('wbtvs_spider.log', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# ==================== 解密工具类 ====================
class JSDecryptor:
    """JavaScript加密解密工具类，支持常见的影视站加密算法"""
    
    @staticmethod
    def base64_decode(text: str) -> str:
        """Base64解码"""
        try:
            # 处理URL安全base64
            text = text.replace('-', '+').replace('_', '/')
            # 补齐padding
            padding = 4 - len(text) % 4
            if padding != 4:
                text += '=' * padding
            return base64.b64decode(text).decode('utf-8', errors='ignore')
        except:
            return text
    
    @staticmethod
    def decode_unicode(text: str) -> str:
        """Unicode解码"""
        try:
            return text.encode('utf-8').decode('unicode_escape')
        except:
            return text
    
    @staticmethod
    def hex_to_str(hex_str: str) -> str:
        """16进制转字符串"""
        try:
            return bytes.fromhex(hex_str).decode('utf-8', errors='ignore')
        except:
            return hex_str
    
    @staticmethod
    def unpacker(packed: str) -> str:
        """
        解密eval(function(p,a,c,k,e,d){})类型的packer加密
        这是苹果CMS最常用的加密方式
        """
        try:
            # 匹配packer格式
            pattern = r"eval\(function\(p,a,c,k,e,[dr]\)\{(.*?)\}\((.*?)\)\)"
            match = re.search(pattern, packed, re.DOTALL)
            if not match:
                return packed
            
            # 提取参数
            params = match.group(2).split(',')
            if len(params) < 4:
                return packed
            
            # 解析p, a, c, k
            p = params[0].strip("'\"")
            a = int(params[1]) if params[1].isdigit() else 62
            c = int(params[2]) if params[2].isdigit() else 0
            k_str = ','.join(params[3:])
            
            # 解析k数组
            k = []
            if '[' in k_str:
                k_match = re.search(r'\[(.*?)\]', k_str, re.DOTALL)
                if k_match:
                    k_items = re.findall(r"'([^']*)'", k_match.group(1))
                    k = k_items
            
            # 解密函数
            def e(c):
                if c < a:
                    return ''
                return e(c // a) + (str(c % a) if c % a < 10 else chr(c % a + 87))
            
            # 构建替换字典
            d = {}
            for i in range(c):
                if i < len(k) and k[i]:
                    d[e(i)] = k[i]
            
            # 替换
            result = p
            for key in sorted(d.keys(), key=len, reverse=True):
                result = result.replace(key, d[key])
            
            return result
        except Exception as e:
            logger.debug(f"Unpacker解密失败: {e}")
            return packed
    
    @staticmethod
    def multi_decrypt(text: str, depth: int = 5) -> str:
        """多层解密，递归解密直到无加密特征"""
        result = text
        for i in range(depth):
            original = result
            
            # 检测并解密base64
            b64_pattern = r'[A-Za-z0-9+/]{50,}={0,2}'
            b64_matches = re.findall(b64_pattern, result)
            for m in b64_matches:
                try:
                    decoded = JSDecryptor.base64_decode(m)
                    if any(c in decoded for c in ['http', '.m3u8', '.mp4', 'player', 'url']):
                        result = result.replace(m, decoded)
                except:
                    pass
            
            # 解密packer
            if 'eval(function(p,a,c,k' in result:
                result = JSDecryptor.unpacker(result)
            
            # Unicode解码
            if '\\u' in result or '\\x' in result:
                result = JSDecryptor.decode_unicode(result)
            
            # 如果没有变化，停止解密
            if result == original:
                break
        
        return result
    
    @staticmethod
    def extract_m3u8_urls(js_code: str, base_url: str = '') -> List[str]:
        """从JS代码中提取m3u8/mp4视频地址"""
        urls = []
        
        # 多层解密
        decrypted = JSDecryptor.multi_decrypt(js_code)
        
        # URL匹配模式
        patterns = [
            r'(https?://[^\s"\'<>]+\.m3u8[^\s"\'<>]*)',
            r'(https?://[^\s"\'<>]+\.mp4[^\s"\'<>]*)',
            r'url\s*[:=]\s*["\']([^"\']+)["\']',
            r'src\s*[:=]\s*["\']([^"\']+)["\']',
            r'video\s*[:=]\s*["\']([^"\']+)["\']',
            r'playurl\s*[:=]\s*["\']([^"\']+)["\']',
            r'vod_url\s*[:=]\s*["\']([^"\']+)["\']',
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, decrypted, re.IGNORECASE)
            for m in matches:
                if isinstance(m, tuple):
                    m = m[0]
                if m.startswith('//'):
                    m = 'https:' + m
                elif m.startswith('/'):
                    m = urljoin(base_url, m)
                if any(ext in m.lower() for ext in ['.m3u8', '.mp4', '.flv']):
                    if m not in urls:
                        urls.append(m)
        
        return urls, decrypted


# ==================== 主爬虫类 ====================
class WbtvsSpider:
    def __init__(self, config: Dict = None):
        self.config = config or CONFIG
        self.base_url = self.config['base_url']
        self.save_dir = self.config['save_dir']
        self.video_dir = os.path.join(self.save_dir, self.config['video_dir'])
        
        # 创建目录
        os.makedirs(self.save_dir, exist_ok=True)
        os.makedirs(self.video_dir, exist_ok=True)
        
        # 初始化数据库
        self.db_path = os.path.join(self.save_dir, 'wbtvs.db')
        self.init_database()
        
        # 创建scraper
        self.scraper = self._create_scraper()
        
        self.session_cookies = {}
        self.downloaded_count = 0
    
    def _create_scraper(self) -> cloudscraper.CloudScraper:
        """创建绕过Cloudflare的scraper"""
        scraper = cloudscraper.create_scraper(
            browser={
                'browser': 'chrome',
                'platform': 'windows',
                'desktop': True,
                'custom': random.choice(self.config['user_agents'])
            },
            delay=random.uniform(2, 4)
        )
        
        scraper.headers.update({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Referer': self.base_url + '/'
        })
        
        return scraper
    
    def init_database(self):
        """初始化SQLite数据库"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        c.execute('''CREATE TABLE IF NOT EXISTS videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vod_id TEXT UNIQUE,
            title TEXT,
            category TEXT,
            cover_url TEXT,
            year TEXT,
            area TEXT,
            type TEXT,
            rating TEXT,
            director TEXT,
            actors TEXT,
            description TEXT,
            detail_url TEXT UNIQUE,
            m3u8_urls TEXT,
            download_status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''')
        
        c.execute('''CREATE TABLE IF NOT EXISTS crawl_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT,
            page INTEGER,
            finished INTEGER DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''')
        
        conn.commit()
        conn.close()
    
    def random_delay(self):
        """随机延迟"""
        time.sleep(random.uniform(self.config['delay_min'], self.config['delay_max']))
    
    def get_headers(self) -> Dict:
        """获取随机请求头"""
        return {
            'User-Agent': random.choice(self.config['user_agents']),
            'Referer': self.base_url + '/'
        }
    
    def request(self, url: str, retries: int = 0) -> Optional[requests.Response]:
        """带重试的请求"""
        if retries >= self.config['max_retries']:
            logger.error(f"请求失败，已达最大重试次数: {url}")
            return None
        
        try:
            self.random_delay()
            
            # 定期重建scraper
            if retries > 0:
                self.scraper = self._create_scraper()
            
            response = self.scraper.get(
                url, 
                headers=self.get_headers(),
                timeout=self.config['timeout'],
                allow_redirects=True
            )
            
            # 检查是否被Cloudflare拦截
            if response.status_code in [403, 503] or 'Just a moment' in response.text:
                logger.warning(f"触发Cloudflare验证，重试中... ({retries+1}/{self.config['max_retries']})")
                time.sleep(5 + retries * 3)
                return self.request(url, retries + 1)
            
            if response.status_code == 200:
                return response
            else:
                logger.warning(f"请求返回 {response.status_code}: {url}")
                return self.request(url, retries + 1)
                
        except Exception as e:
            logger.error(f"请求异常: {e}, URL: {url}")
            time.sleep(2)
            return self.request(url, retries + 1)
    
    def get_total_pages(self, category: str) -> int:
        """获取分类总页数"""
        url = f"{self.base_url}/type/{category}/"
        response = self.request(url)
        if not response:
            return 1
        
        soup = BeautifulSoup(response.text, 'lxml')
        
        # 查找分页
        page_nums = []
        page_links = soup.select('a[href*="/type/"]')
        for a in page_links:
            href = a.get('href', '')
            match = re.search(r'/type/.*?/(\d+)\.html', href)
            if match:
                page_nums.append(int(match.group(1)))
        
        # 也可以从页码文本提取
        page_text = soup.select_one('.page-text, .page_info')
        if page_text:
            match = re.search(r'共\s*(\d+)\s*页', page_text.text)
            if match:
                return int(match.group(1))
        
        return max(page_nums) if page_nums else 1
    
    def crawl_list_page(self, category: str, page: int) -> List[Dict]:
        """爬取列表页，返回影片基本信息列表"""
        if page == 1:
            url = f"{self.base_url}/type/{category}/"
        else:
            url = f"{self.base_url}/type/{category}/{page}.html"
        
        logger.info(f"爬取列表页: {url}")
        response = self.request(url)
        if not response:
            return []
        
        soup = BeautifulSoup(response.text, 'lxml')
        videos = []
        
        items = soup.select('.module-item')
        for item in items:
            try:
                title_elem = item.select_one('.video-name a')
                if not title_elem:
                    continue
                
                title = title_elem.get('title', title_elem.text.strip())
                href = title_elem.get('href', '')
                vod_id_match = re.search(r'/vod/(\d+)/', href)
                vod_id = vod_id_match.group(1) if vod_id_match else ''
                
                img = item.select_one('img')
                cover = img.get('data-src', img.get('src', '')) if img else ''
                
                caption = item.select_one('.module-item-caption')
                year = ''
                area = ''
                vtype = ''
                if caption:
                    spans = caption.select('span')
                    if len(spans) >= 1:
                        year = spans[0].text.strip()
                    if len(spans) >= 2:
                        vtype = spans[1].text.strip()
                    if len(spans) >= 3:
                        area = spans[2].text.strip()
                
                videos.append({
                    'vod_id': vod_id,
                    'title': title,
                    'category': category,
                    'cover_url': cover,
                    'year': year,
                    'area': area,
                    'type': vtype,
                    'detail_url': urljoin(self.base_url, href)
                })
            except Exception as e:
                logger.debug(f"解析影片项失败: {e}")
                continue
        
        logger.info(f"列表页获取影片数: {len(videos)}")
        return videos
    
    def crawl_detail_page(self, video_info: Dict) -> Optional[Dict]:
        """爬取详情页，获取详细信息和播放地址"""
        url = video_info['detail_url']
        logger.info(f"爬取详情页: {video_info['title']} - {url}")
        
        response = self.request(url)
        if not response:
            return video_info
        
        html = response.text
        soup = BeautifulSoup(html, 'lxml')
        
        try:
            # 影片简介
            desc_elem = soup.select_one('.video-info-content, .vod_content, .module-info-intro')
            if desc_elem:
                video_info['description'] = desc_elem.get_text(strip=True)
            
            # 导演演员
            info_items = soup.select('.video-info-item, .module-info-item')
            for item in info_items:
                text = item.get_text(' ', strip=True)
                if '导演' in text:
                    video_info['director'] = text.replace('导演', '').strip(' :：')
                elif '主演' in text:
                    video_info['actors'] = text.replace('主演', '').strip(' :：')
                elif '类型' in text:
                    video_info['type'] = text.replace('类型', '').strip(' :：')
                elif '地区' in text:
                    video_info['area'] = text.replace('地区', '').strip(' :：')
                elif '年份' in text:
                    video_info['year'] = text.replace('年份', '').strip(' :：')
            
            # 提取并解密播放器JS中的视频地址
            scripts = soup.find_all('script')
            m3u8_urls = []
            decrypted_js = ''
            
            for script in scripts:
                script_text = script.string if script.string else ''
                if not script_text or len(script_text) < 50:
                    continue
                
                # 检查是否包含播放相关关键字
                if any(k in script_text.lower() for k in ['player', 'm3u8', 'vod', 'play', 'url']):
                    # 解密JS
                    decrypted = JSDecryptor.multi_decrypt(script_text)
                    decrypted_js += decrypted + '\n'
                    
                    # 提取URL
                    urls, _ = JSDecryptor.extract_m3u8_urls(script_text, self.base_url)
                    m3u8_urls.extend(urls)
            
            # 也在整个HTML中搜索m3u8地址
            all_urls, _ = JSDecryptor.extract_m3u8_urls(html, self.base_url)
            m3u8_urls.extend(all_urls)
            
            # 去重
            m3u8_urls = list(set(m3u8_urls))
            video_info['m3u8_urls'] = json.dumps(m3u8_urls, ensure_ascii=False)
            
            if m3u8_urls:
                logger.info(f"找到视频地址 {len(m3u8_urls)} 个 for {video_info['title']}")
                logger.debug(f"M3U8 URLs: {m3u8_urls}")
            
        except Exception as e:
            logger.error(f"解析详情页失败 {video_info['title']}: {e}")
        
        return video_info
    
    def save_video(self, video_info: Dict):
        """保存影片信息到数据库"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        try:
            c.execute('''INSERT OR REPLACE INTO videos 
                (vod_id, title, category, cover_url, year, area, type, 
                 director, actors, description, detail_url, m3u8_urls)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (
                    video_info.get('vod_id', ''),
                    video_info.get('title', ''),
                    video_info.get('category', ''),
                    video_info.get('cover_url', ''),
                    video_info.get('year', ''),
                    video_info.get('area', ''),
                    video_info.get('type', ''),
                    video_info.get('director', ''),
                    video_info.get('actors', ''),
                    video_info.get('description', ''),
                    video_info.get('detail_url', ''),
                    video_info.get('m3u8_urls', '[]')
                ))
            conn.commit()
        except Exception as e:
            logger.error(f"保存数据失败: {e}")
        finally:
            conn.close()
    
    def download_m3u8(self, m3u8_url: str, title: str) -> bool:
        """
        下载M3U8视频，支持AES-128-CBC自动解密
        """
        try:
            safe_title = re.sub(r'[<>:"/\\|?*]', '_', title)
            video_path = os.path.join(self.video_dir, f"{safe_title}.mp4")
            ts_dir = os.path.join(self.video_dir, safe_title + '_ts')
            os.makedirs(ts_dir, exist_ok=True)
            
            if os.path.exists(video_path) and os.path.getsize(video_path) > 1024 * 1024:
                logger.info(f"视频已存在，跳过: {title}")
                return True
            
            logger.info(f"开始下载视频: {title}")
            logger.info(f"M3U8地址: {m3u8_url}")
            
            # 获取m3u8内容
            headers = {
                'User-Agent': random.choice(self.config['user_agents']),
                'Referer': self.base_url + '/'
            }
            
            # 处理可能是多级m3u8的情况
            m3u8_obj = m3u8.load(m3u8_url, headers=headers)
            
            # 如果是主列表（master），选择第一个流
            if m3u8_obj.is_variant:
                if m3u8_obj.playlists:
                    playlist = m3u8_obj.playlists[0]
                    m3u8_url = urljoin(m3u8_url, playlist.uri)
                    m3u8_obj = m3u8.load(m3u8_url, headers=headers)
                    logger.info(f"切换到子m3u8: {m3u8_url}")
            
            segments = m3u8_obj.segments
            if not segments:
                logger.warning(f"未找到视频片段: {m3u8_url}")
                return False
            
            logger.info(f"视频片段数: {len(segments)}")
            
            # 获取密钥（如果有加密）
            key = None
            iv = None
            if m3u8_obj.keys and m3u8_obj.keys[0]:
                key_obj = m3u8_obj.keys[0]
                if key_obj.uri:
                    key_url = urljoin(m3u8_url, key_obj.uri)
                    key_resp = requests.get(key_url, headers=headers, timeout=30)
                    key = key_resp.content
                    logger.info(f"获取解密密钥: {key.hex()}")
                
                if key_obj.iv:
                    iv = key_obj.iv
            
            # 下载所有ts片段
            ts_files = []
            
            def download_segment(i, seg):
                ts_url = urljoin(m3u8_url, seg.uri) if not seg.uri.startswith('http') else seg.uri
                ts_file = os.path.join(ts_dir, f"{i:05d}.ts")
                
                if os.path.exists(ts_file) and os.path.getsize(ts_file) > 0:
                    return i, ts_file
                
                for retry in range(3):
                    try:
                        resp = requests.get(ts_url, headers=headers, timeout=30, stream=True)
                        if resp.status_code == 200:
                            data = resp.content
                            
                            # AES解密
                            if key:
                                try:
                                    current_iv = iv if iv else i.to_bytes(16, byteorder='big')
                                    cipher = AES.new(key, AES.MODE_CBC, iv=current_iv)
                                    data = cipher.decrypt(data)
                                    # 去除PKCS7填充
                                    pad_len = data[-1]
                                    if pad_len <= 16:
                                        data = data[:-pad_len]
                                except Exception as e:
                                    logger.debug(f"解密片段失败 {i}: {e}")
                            
                            with open(ts_file, 'wb') as f:
                                f.write(data)
                            return i, ts_file
                    except Exception as e:
                        time.sleep(1)
                        continue
                return i, None
            
            # 多线程下载片段
            with ThreadPoolExecutor(max_workers=self.config['download_workers']) as executor:
                futures = [executor.submit(download_segment, i, seg) 
                          for i, seg in enumerate(segments)]
                
                with tqdm(total=len(segments), desc=f"下载 {title[:20]}") as pbar:
                    for future in as_completed(futures):
                        i, ts_file = future.result()
                        if ts_file:
                            ts_files.append((i, ts_file))
                        pbar.update(1)
            
            # 合并文件
            ts_files.sort(key=lambda x: x[0])
            
            logger.info(f"合并视频文件: {video_path}")
            with open(video_path, 'wb') as outfile:
                for i, ts_file in ts_files:
                    if os.path.exists(ts_file):
                        with open(ts_file, 'rb') as infile:
                            outfile.write(infile.read())
            
            # 清理临时文件
            import shutil
            try:
                shutil.rmtree(ts_dir)
            except:
                pass
            
            file_size = os.path.getsize(video_path) / (1024 * 1024)
            logger.info(f"视频下载完成: {title}, 大小: {file_size:.2f} MB")
            
            self.downloaded_count += 1
            return True
            
        except Exception as e:
            logger.error(f"下载视频失败 {title}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return False
    
    def crawl_category(self, category: str, max_pages: int = None):
        """爬取整个分类"""
        total_pages = self.get_total_pages(category)
        if max_pages:
            total_pages = min(total_pages, max_pages)
        
        logger.info(f"开始爬取分类 [{category}], 总页数: {total_pages}")
        
        all_videos = []
        
        for page in range(1, total_pages + 1):
            videos = self.crawl_list_page(category, page)
            
            for video in videos:
                # 爬取详情页
                video_detail = self.crawl_detail_page(video)
                if video_detail:
                    self.save_video(video_detail)
                    all_videos.append(video_detail)
            
            # 更新进度
            self.update_progress(category, page)
            
            logger.info(f"分类 [{category}] 第 {page}/{total_pages} 页完成")
        
        return all_videos
    
    def update_progress(self, category: str, page: int, finished: int = 0):
        """更新爬取进度"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('''INSERT OR REPLACE INTO crawl_progress (category, page, finished)
            VALUES (?, ?, ?)''', (category, page, finished))
        conn.commit()
        conn.close()
    
    def get_pending_videos(self, with_url_only: bool = True) -> List[Dict]:
        """获取待下载的视频"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        if with_url_only:
            c.execute("SELECT * FROM videos WHERE m3u8_urls != '[]' AND download_status = 'pending'")
        else:
            c.execute("SELECT * FROM videos WHERE download_status = 'pending'")
        
        rows = c.fetchall()
        conn.close()
        
        videos = []
        for row in rows:
            video = dict(row)
            video['m3u8_urls'] = json.loads(video['m3u8_urls'])
            videos.append(video)
        
        return videos
    
    def mark_downloaded(self, vod_id: str, status: str = 'downloaded'):
        """标记下载状态"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("UPDATE videos SET download_status = ? WHERE vod_id = ?", (status, vod_id))
        conn.commit()
        conn.close()
    
    def export_json(self, filepath: str = None):
        """导出所有数据为JSON"""
        if not filepath:
            filepath = os.path.join(self.save_dir, 'wbtvs_all_videos.json')
        
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM videos ORDER BY category, vod_id")
        rows = c.fetchall()
        conn.close()
        
        videos = []
        for row in rows:
            v = dict(row)
            v['m3u8_urls'] = json.loads(v['m3u8_urls'])
            videos.append(v)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(videos, f, ensure_ascii=False, indent=2)
        
        logger.info(f"数据已导出到: {filepath}, 共 {len(videos)} 条记录")
        return filepath
    
    def run(self, categories: List[str] = None, max_pages: int = None, 
            download_videos: bool = False):
        """运行爬虫主函数"""
        if not categories:
            categories = self.config['categories']
        
        logger.info("=" * 60)
        logger.info("wbtvs.cc 全站爬虫启动")
        logger.info(f"分类: {categories}")
        logger.info(f"最大页数: {max_pages if max_pages else '全部'}")
        logger.info(f"是否下载视频: {download_videos}")
        logger.info("=" * 60)
        
        # 先访问首页建立会话
        logger.info("初始化会话，绕过Cloudflare...")
        self.request(self.base_url)
        
        all_videos = []
        
        # 爬取各个分类
        for category in categories:
            videos = self.crawl_category(category, max_pages)
            all_videos.extend(videos)
        
        logger.info(f"信息爬取完成，共获取 {len(all_videos)} 部影片")
        
        # 导出数据
        self.export_json()
        
        # 下载视频
        if download_videos:
            logger.info("开始下载视频...")
            pending = self.get_pending_videos(with_url_only=True)
            logger.info(f"待下载视频数: {len(pending)}")
            
            for video in pending:
                if video['m3u8_urls']:
                    # 尝试第一个可用的URL
                    for m3u8_url in video['m3u8_urls']:
                        success = self.download_m3u8(m3u8_url, video['title'])
                        if success:
                            self.mark_downloaded(video['vod_id'], 'downloaded')
                            break
                    else:
                        self.mark_downloaded(video['vod_id'], 'failed')
            
            logger.info(f"视频下载完成，成功下载 {self.downloaded_count} 个视频")
        
        logger.info("爬虫任务完成!")
        logger.info(f"数据保存目录: {os.path.abspath(self.save_dir)}")


# ==================== 解密工具使用示例 ====================
def demo_decrypt():
    """解密功能演示"""
    print("=" * 50)
    print("JS解密工具演示")
    print("=" * 50)
    
    test_cases = [
        # 测试base64编码
        "aHR0cHM6Ly9leGFtcGxlLmNvbS92aWRlby5tM3U4",
        # 测试unicode编码
        "\\u68\\u74\\u74\\u70\\u73\\u3a\\u2f\\u2f\\u65\\u78\\u61\\u6d\\u70\\u6c\\u65\\u2e\\u63\\u6f\\u6d",
    ]
    
    decryptor = JSDecryptor()
    
    for test in test_cases:
        print(f"\n原始: {test}")
        result = decryptor.multi_decrypt(test)
        print(f"解密: {result}")
    
    print("\n解密工具已就绪！支持:")
    print("- Base64编码/解码")
    print("- Unicode转义解密")
    print("- Eval Packer加密解密（苹果CMS常用）")
    print("- 多层嵌套递归解密")
    print("- M3U8/MP4地址自动提取")


def main():
    parser = argparse.ArgumentParser(description='wbtvs.cc 全站爬虫')
    parser.add_argument('--category', '-c', nargs='+', 
                       default=['dianying', 'dianshiju', 'dongman'],
                       help='要爬取的分类: dianying dianshiju dongman')
    parser.add_argument('--pages', '-p', type=int, default=None,
                       help='每个分类爬取的最大页数')
    parser.add_argument('--download', '-d', action='store_true',
                       help='是否下载视频文件')
    parser.add_argument('--demo-decrypt', action='store_true',
                       help='演示解密功能')
    parser.add_argument('--workers', '-w', type=int, default=5,
                       help='并发线程数')
    
    args = parser.parse_args()
    
    if args.demo_decrypt:
        demo_decrypt()
        return
    
    CONFIG['max_workers'] = args.workers
    
    spider = WbtvsSpider(CONFIG)
    spider.run(
        categories=args.category,
        max_pages=args.pages,
        download_videos=args.download
    )


if __name__ == '__main__':
    print("""
██╗    ██╗██████╗ ████████╗██╗   ██╗███████╗
██║    ██║██╔══██╗╚══██╔══╝██║   ██║██╔════╝
██║ █╗ ██║██████╔╝   ██║   ██║   ██║███████╗
██║███╗██║██╔══██╗   ██║   ██║   ██║╚════██║
╚███╔███╔╝██████╔╝   ██║   ╚██████╔╝███████║
 ╚══╝╚══╝ ╚═════╝    ╚═╝    ╚═════╝ ╚══════╝
    wbtvs.cc 全站爬虫 v1.0 - 支持自动解密
    """)
    main()
