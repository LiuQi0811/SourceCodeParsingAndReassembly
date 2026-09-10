#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
4kvm.net 全站爬虫
- 自动爬取电影、电视剧、动漫等所有分类
- 内置WASM解密服务器获取真实视频播放地址 (100%还原原始算法)
- 支持断点续爬、SQLite去重存储、JSON导出
"""

import os
import re
import json
import time
import random
import logging
import sqlite3
import threading
import subprocess
import signal
import sys
from urllib.parse import urljoin, urlencode
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup

# ==================== 配置 ====================
BASE_URL = "https://www.4kvm.net"
OUTPUT_DIR = "4kvm_data"
DATABASE_PATH = os.path.join(OUTPUT_DIR, "scraper.db")
DECRYPT_PORT = 29527
MAX_WORKERS = 2
REQUEST_DELAY = (1, 2.5)
TIMEOUT = 30
MAX_RETRIES = 3

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Connection": "keep-alive",
    "Referer": BASE_URL + "/",
}

CATEGORIES = ["movie", "tv", "anime"]

# ==================== 日志 ====================
os.makedirs(OUTPUT_DIR, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(OUTPUT_DIR, 'scraper.log'), encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ==================== WASM解密服务管理 ====================
class WasmDecryptor:
    """管理Node.js WASM解密子进程，100%复用原始WASM二进制"""
    
    def __init__(self, port=DECRYPT_PORT):
        self.port = port
        self.process = None
        self.play_key = "X1VVVkZQXQUICg4FCgc7IUlZVU8="
        self.base_url = f"http://localhost:{port}"
        self._start_server()
        self._init_play_key()
    
    def _start_server(self):
        """启动Node.js解密服务"""
        logger.info("启动WASM解密服务...")
        script_dir = os.path.dirname(os.path.abspath(__file__))
        server_script = os.path.join(script_dir, "decrypt_server.mjs")
        
        self.process = subprocess.Popen(
            ["node", server_script],
            cwd=script_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True
        )
        
        # 等待服务启动
        for i in range(15):
            time.sleep(1)
            try:
                r = requests.get(f"{self.base_url}/health", timeout=3)
                if r.status_code == 200 and r.json().get("wasm_ready"):
                    logger.info("WASM解密服务启动成功!")
                    return
            except:
                pass
            # 打印输出查看进度
            line = self.process.stdout.readline()
            if line:
                logger.debug(f"[WASM Server] {line.strip()}")
        
        raise RuntimeError("WASM解密服务启动失败")
    
    def _init_play_key(self):
        """获取访客play_key"""
        try:
            session = requests.Session()
            session.headers.update(HEADERS)
            resp = session.get(BASE_URL + "/", timeout=TIMEOUT)
            match = re.search(r"userlink['\"]?\s*[:=]\s*['\"]([^'\"]+)['\"]", resp.text)
            if match:
                self.play_key = match.group(1)
                logger.info(f"获取play_key: {self.play_key}")
        except Exception as e:
            logger.warning(f"获取play_key失败，使用默认值: {e}")
    
    def build_play_url(self, dataid, secret_key, quality="1080"):
        """调用本地WASM服务生成API URL (完美逆向)"""
        params = {
            "dataid": dataid,
            "key": secret_key,
            "q": quality,
            "play_key": self.play_key
        }
        r = requests.get(f"{self.base_url}/build_url", params=params, timeout=10)
        data = r.json()
        if "error" in data:
            raise RuntimeError(f"构建URL失败: {data['error']}")
        return data["url"]
    
    def get_video_url(self, dataid, secret_key, quality="1080"):
        """获取真实视频地址"""
        session = requests.Session()
        session.headers.update(HEADERS)
        
        for retry in range(MAX_RETRIES):
            try:
                api_path = self.build_play_url(dataid, secret_key, quality)
                headers = HEADERS.copy()
                headers['Referer'] = f"{BASE_URL}/play/{secret_key}"
                headers['Accept'] = 'application/json'
                
                resp = session.get(BASE_URL + api_path, headers=headers, timeout=TIMEOUT)
                data = resp.json()
                
                if data.get('code') == 200 and data.get('data'):
                    return data['data']
                else:
                    msg = data.get('message', 'unknown')
                    logger.warning(f"获取视频失败({retry+1}): {msg}")
                    if retry == 1:
                        self._init_play_key()
                    time.sleep(1)
            except Exception as e:
                logger.error(f"视频请求异常: {e}")
                time.sleep(1)
        return None
    
    def stop(self):
        if self.process:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except:
                self.process.kill()
            logger.info("WASM解密服务已停止")

# ==================== 数据库 ====================
class Database:
    def __init__(self, db_path):
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.lock = threading.Lock()
        self._init()
    
    def _init(self):
        with self.lock:
            c = self.conn.cursor()
            c.execute('''CREATE TABLE IF NOT EXISTS videos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vod_id TEXT UNIQUE,
                secret_key TEXT, title TEXT, cover TEXT,
                description TEXT, category TEXT, year TEXT,
                area TEXT, genre TEXT,
                detail_crawled INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )''')
            c.execute('''CREATE TABLE IF NOT EXISTS episodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                video_vod_id TEXT, dataid TEXT,
                episode_num INTEGER, line_name TEXT, line_num INTEGER,
                secret_key TEXT, title TEXT,
                video_url TEXT, video_type TEXT, quality TEXT,
                status TEXT DEFAULT 'pending',
                UNIQUE(video_vod_id, line_num, episode_num)
            )''')
            c.execute('''CREATE TABLE IF NOT EXISTS progress (
                category TEXT PRIMARY KEY, last_page INTEGER, last_update TIMESTAMP
            )''')
            self.conn.commit()
    
    def add_video(self, vod_id, secret_key, title, cover, category):
        with self.lock:
            c = self.conn.cursor()
            c.execute('INSERT OR IGNORE INTO videos (vod_id, secret_key, title, cover, category) VALUES (?,?,?,?,?)',
                     (vod_id, secret_key, title, cover, category))
            self.conn.commit()
    
    def update_video_detail(self, vod_id, **kwargs):
        with self.lock:
            kwargs['detail_crawled'] = 1
            sets = ', '.join(f"{k}=?" for k in kwargs.keys())
            c = self.conn.cursor()
            c.execute(f'UPDATE videos SET {sets} WHERE vod_id=?', (*kwargs.values(), vod_id))
            self.conn.commit()
    
    def add_episode(self, vid, dataid, ep_num, line_name, line_num, key, title):
        with self.lock:
            c = self.conn.cursor()
            c.execute('INSERT OR IGNORE INTO episodes (video_vod_id,dataid,episode_num,line_name,line_num,secret_key,title) VALUES (?,?,?,?,?,?,?)',
                     (vid, dataid, ep_num, line_name, line_num, key, title))
            self.conn.commit()
    
    def update_episode(self, ep_id, url, vtype, quality):
        with self.lock:
            c = self.conn.cursor()
            c.execute('UPDATE episodes SET video_url=?, video_type=?, quality=?, status=? WHERE id=?',
                     (url, vtype, quality, 'done', ep_id))
            self.conn.commit()
    
    def get_pending_videos(self, limit=100):
        with self.lock:
            c = self.conn.cursor()
            c.execute('SELECT vod_id,secret_key,title FROM videos WHERE detail_crawled=0 LIMIT ?', (limit,))
            return c.fetchall()
    
    def get_pending_episodes(self, limit=100):
        with self.lock:
            c = self.conn.cursor()
            c.execute('SELECT id,dataid,secret_key FROM episodes WHERE status="pending" LIMIT ?', (limit,))
            return c.fetchall()
    
    def update_progress(self, cat, page):
        with self.lock:
            c = self.conn.cursor()
            c.execute('INSERT OR REPLACE INTO progress VALUES (?,?,?)', (cat, page, datetime.now().isoformat()))
            self.conn.commit()
    
    def get_stats(self):
        with self.lock:
            c = self.conn.cursor()
            c.execute('SELECT COUNT(*),SUM(detail_crawled) FROM videos')
            tv, td = c.fetchone()
            c.execute('SELECT COUNT(*),SUM(CASE WHEN status="done" THEN 1 END) FROM episodes')
            te, ed = c.fetchall()[0]
            return {'videos': tv or 0, 'details': td or 0, 'episodes': te or 0, 'ep_done': ed or 0}
    
    def export_json(self, path):
        with self.lock:
            c = self.conn.cursor()
            c.execute('SELECT * FROM videos ORDER BY id')
            cols = [d[0] for d in c.description]
            videos = []
            for row in c.fetchall():
                v = dict(zip(cols, row))
                c2 = self.conn.cursor()
                c2.execute('SELECT * FROM episodes WHERE video_vod_id=? ORDER BY line_num,episode_num', (v['vod_id'],))
                ecols = [d[0] for d in c2.description]
                v['episodes'] = [dict(zip(ecols, r)) for r in c2.fetchall()]
                videos.append(v)
            result = {
                'site': BASE_URL,
                'crawl_time': datetime.now().isoformat(),
                'stats': self.get_stats(),
                'videos': videos
            }
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            return path

# ==================== 爬虫主类 ====================
class Scraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.db = Database(DATABASE_PATH)
        self.decryptor = WasmDecryptor()
    
    def _get(self, url, retry=0):
        try:
            time.sleep(random.uniform(*REQUEST_DELAY))
            r = self.session.get(url, timeout=TIMEOUT)
            r.raise_for_status()
            r.encoding = 'utf-8'
            return r
        except Exception as e:
            if retry < MAX_RETRIES:
                time.sleep(2**retry)
                return self._get(url, retry+1)
            logger.error(f"请求失败: {url} - {e}")
            return None
    
    def crawl_list(self, category, page=1):
        if category == 'home':
            url = BASE_URL + '/'
        else:
            url = f"{BASE_URL}/{category}"
            if page > 1:
                url += f"?page={page}"
        
        logger.info(f"爬取: {url}")
        r = self._get(url)
        if not r:
            return [], page
        
        soup = BeautifulSoup(r.text, 'html.parser')
        seen = set()
        videos = []
        
        for a in soup.find_all('a', href=re.compile(r'^/play/[a-z0-9]+$')):
            href = a['href']
            if href in seen:
                continue
            seen.add(href)
            
            key = href.split('/play/')[-1]
            title = key
            cover = ""
            
            card = a
            for _ in range(5):
                img = card.find('img')
                if img:
                    cover = img.get('src', '') or img.get('data-src', '')
                    t = card.find(['h3', 'h4'])
                    if t:
                        title = t.get_text(strip=True)
                    elif img.get('alt'):
                        title = img['alt']
                    break
                card = card.parent
                if not card: break
            
            videos.append({'key': key, 'title': title, 'cover': cover})
        
        max_page = page
        for a in soup.find_all('a', href=re.compile(r'[?&]page=\d+')):
            m = re.search(r'page=(\d+)', a['href'])
            if m:
                p = int(m.group(1))
                max_page = max(max_page, p)
        
        logger.info(f"  发现 {len(videos)} 个视频")
        return videos, max_page
    
    def crawl_detail(self, vinfo):
        vod_id, key, old_title = vinfo
        url = f"{BASE_URL}/play/{key}"
        r = self._get(url)
        if not r:
            return
        
        # 提取真实vod_id
        m = re.search(r"vodid\s*=\s*['\"](\d+)['\"]", r.text)
        real_id = m.group(1) if m else vod_id
        
        soup = BeautifulSoup(r.text, 'html.parser')
        title = old_title
        h1 = soup.find('h1')
        if h1:
            title = h1.get_text(strip=True)
        
        desc = ""
        dm = soup.find('meta', {'name':'description'})
        if dm:
            desc = dm.get('content','')
        
        cover = ""
        og = soup.find('meta', {'property':'og:image'})
        if og:
            cover = og.get('content','')
        
        year = ""
        km = soup.find('meta', {'name':'keywords'})
        if km:
            for p in km.get('content','').split(','):
                if re.match(r'^\d{4}$', p.strip()):
                    year = p.strip()
                    break
        
        self.db.update_video_detail(real_id, secret_key=key, title=title, cover=cover, description=desc, year=year)
        
        # 解析播放线路
        lines = []
        lm = re.search(r"episodeManager\(\d+,\s*\d+,\s*(\[[\s\S]+?\])\s*\)", r.text)
        if lm:
            try:
                lines = json.loads(lm.group(1))
            except:
                lines = [{"lineName": "主线路", "episodeCount": 0}]
        if not lines:
            lines = [{"lineName": "主线路", "episodeCount": 0}]
        
        # 提取剧集
        eps = re.findall(r'dataid="(\d+)"[^>]*href="(/play/[a-z0-9]+)"', r.text)
        if not eps:
            temp = re.findall(r'href="(/play/[a-z0-9]+)"[^>]*dataid="(\d+)"', r.text)
            eps = [(did, h) for h, did in temp]
        
        for idx, (dataid, href) in enumerate(eps, 1):
            ep_key = href.split('/play/')[-1]
            self.db.add_episode(real_id, dataid, idx, lines[0]['lineName'], 1, ep_key, f"第{idx}集")
        
        logger.info(f"详情: {title} - {len(eps)}集")
    
    def decrypt_episode(self, einf):
        eid, dataid, key = einf
        data = self.decryptor.get_video_url(dataid, key)
        if not data or not data.get('quality_urls'):
            return False
        
        best = None
        for q in data['quality_urls']:
            if q.get('url') and q['url'] != '1':
                if not best or q.get('bitrate', 0) > best.get('bitrate', 0):
                    best = q
        
        if best:
            self.db.update_episode(eid, best['url'], best.get('mtype','m3u8'), best.get('title',''))
            return True
        return False
    
    def crawl_category(self, category, max_pages=None):
        logger.info(f"===== 分类: {category} =====")
        page = 1
        empty = 0
        while True:
            if max_pages and page > max_pages:
                break
            videos, maxp = self.crawl_list(category, page)
            if not videos:
                empty += 1
                if empty >= 3: break
                page += 1
                continue
            empty = 0
            new = 0
            for v in videos:
                before = self.db.conn.total_changes
                self.db.add_video(v['key'], v['key'], v['title'], v['cover'], category)
                new += 1
            logger.info(f"  第{page}页, 新增{new}个")
            self.db.update_progress(category, page)
            if page >= maxp and maxp > 0 and page > 1:
                break
            page += 1
    
    def run(self, categories=None, max_pages=None, max_videos=None, max_eps=None):
        if categories is None:
            categories = CATEGORIES
        
        # 测试解密
        logger.info("测试WASM解密...")
        test = self.decryptor.get_video_url('815', 'cgzobzuhl')
        if test and test.get('quality_urls'):
            logger.info(f"✓ 解密测试成功! 示例地址: {test['quality_urls'][0]['url'][:80]}...")
        
        for cat in categories:
            self.crawl_category(cat, max_pages)
        
        logger.info("开始爬取详情...")
        done = 0
        while True:
            pending = self.db.get_pending_videos(20)
            if not pending: break
            with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
                list(ex.map(self.crawl_detail, pending))
            done += len(pending)
            s = self.db.get_stats()
            logger.info(f"详情进度: {s['details']}/{s['videos']}, 剧集: {s['episodes']}")
            if max_videos and done >= max_videos: break
        
        logger.info("开始解密视频地址...")
        done = 0
        succ = 0
        while True:
            pending = self.db.get_pending_episodes(20)
            if not pending: break
            with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
                for r in ex.map(self.decrypt_episode, pending):
                    if r: succ += 1
                    done += 1
            s = self.db.get_stats()
            logger.info(f"解密进度: {succ}/{done} 完成, 总进度: {s['ep_done']}/{s['episodes']}")
            if max_eps and done >= max_eps: break
        
        json_path = os.path.join(OUTPUT_DIR, "4kvm_all_videos.json")
        self.db.export_json(json_path)
        
        s = self.db.get_stats()
        logger.info("="*50)
        logger.info(f"爬取完成! 视频:{s['videos']}, 详情:{s['details']}, 剧集:{s['episodes']}, 已解密:{s['ep_done']}")
        logger.info(f"导出文件: {json_path}")
        logger.info("="*50)
        return json_path
    
    def shutdown(self):
        self.decryptor.stop()

def main():
    import argparse
    parser = argparse.ArgumentParser(description='4kvm.net 全站爬虫 (WASM完美逆向解密)')
    parser.add_argument('--max-pages', type=int, default=None)
    parser.add_argument('--max-videos', type=int, default=None)
    parser.add_argument('--max-episodes', type=int, default=None)
    parser.add_argument('--test', action='store_true', help='测试模式: 只爬取1页电影')
    args = parser.parse_args()
    
    scraper = Scraper()
    
    def signal_handler(sig, frame):
        logger.info("收到中断信号，正在退出...")
        scraper.shutdown()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        if args.test:
            scraper.crawl_category('movie', 1)
            pending = scraper.db.get_pending_videos(3)
            for v in pending:
                scraper.crawl_detail(v)
            pending_eps = scraper.db.get_pending_episodes(5)
            for ep in pending_eps:
                ok = scraper.decrypt_episode(ep)
                logger.info(f"解密剧集: {'成功' if ok else '失败'}")
            json_path = os.path.join(OUTPUT_DIR, "4kvm_test.json")
            scraper.db.export_json(json_path)
            s = scraper.db.get_stats()
            logger.info(f"测试完成! 视频:{s['videos']}, 剧集:{s['episodes']}")
        else:
            scraper.run(max_pages=args.max_pages, max_videos=args.max_videos, max_eps=args.max_episodes)
    finally:
        scraper.shutdown()

if __name__ == '__main__':
    main()
