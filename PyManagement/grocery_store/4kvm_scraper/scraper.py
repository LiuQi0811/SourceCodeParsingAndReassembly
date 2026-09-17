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

# 下载配置
DOWNLOAD_DIR = "4kvm_videos"
DOWNLOAD_TIMEOUT = 3600  # 单集下载超时(秒)
DOWNLOAD_WORKERS = 1     # 下载并发数(m3u8建议单线程避免被封)

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
                downloaded INTEGER DEFAULT 0,
                UNIQUE(video_vod_id, line_num, episode_num)
            )''')
            c.execute('''CREATE TABLE IF NOT EXISTS progress (
                category TEXT PRIMARY KEY, last_page INTEGER, last_update TIMESTAMP
            )''')
            # 兼容旧数据库：追加 downloaded 字段
            try:
                c.execute('ALTER TABLE episodes ADD COLUMN downloaded INTEGER DEFAULT 0')
            except sqlite3.OperationalError:
                pass
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
    
    def get_pending_downloads(self, limit=100):
        with self.lock:
            c = self.conn.cursor()
            c.execute('''SELECT e.id, e.title, e.episode_num, e.video_url, v.title
                         FROM episodes e
                         LEFT JOIN videos v ON e.video_vod_id = v.vod_id
                         WHERE e.status="done" AND e.downloaded=0
                           AND e.video_url IS NOT NULL AND e.video_url != ""
                           AND e.video_url != "1"
                         ORDER BY e.id
                         LIMIT ?''', (limit,))
            return c.fetchall()
    
    def mark_downloaded(self, ep_id):
        with self.lock:
            c = self.conn.cursor()
            c.execute('UPDATE episodes SET downloaded=1 WHERE id=?', (ep_id,))
            self.conn.commit()

    def mark_download_failed(self, ep_id):
        """标记下载失败(downloaded=2)，避免反复重试"""
        with self.lock:
            c = self.conn.cursor()
            c.execute('UPDATE episodes SET downloaded=2 WHERE id=?', (ep_id,))
            self.conn.commit()

    def get_download_stats(self):
        with self.lock:
            c = self.conn.cursor()
            c.execute('''SELECT COUNT(*),
                                SUM(CASE WHEN downloaded=1 THEN 1 ELSE 0 END),
                                SUM(CASE WHEN downloaded=2 THEN 1 ELSE 0 END)
                         FROM episodes WHERE status="done"''')
            total, done, failed = c.fetchone()
            return {'downloadable': total or 0, 'downloaded': done or 0, 'download_failed': failed or 0}
    
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

# ==================== 视频下载器 ====================
class VideoDownloader:
    """基于 ffmpeg 的 m3u8 视频下载器，将已解密的播放地址下载为本地 mp4"""

    def __init__(self, db, output_dir=DOWNLOAD_DIR):
        self.db = db
        self.output_dir = os.path.abspath(output_dir)
        os.makedirs(self.output_dir, exist_ok=True)
        self.ffmpeg = self._find_ffmpeg()
        logger.info(f"下载器就绪，输出目录: {self.output_dir}")

    def _find_ffmpeg(self):
        """检测 ffmpeg 是否可用"""
        try:
            r = subprocess.run(['ffmpeg', '-version'], capture_output=True, timeout=5)
            if r.returncode == 0:
                return 'ffmpeg'
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
        raise RuntimeError("未找到 ffmpeg，请先安装: brew install ffmpeg")

    @staticmethod
    def _safe_name(name):
        """清理文件名中的非法字符"""
        name = re.sub(r'[\\/:*?"<>|\r\n\t]', '_', str(name))
        return name.strip(' ._') or 'video'

    def download_one(self, ep_id, ep_title, ep_num, video_url, video_title=""):
        """下载单集视频，返回 (success: bool, message: str)"""
        if not video_url or video_url in ('1', ''):
            self.db.mark_download_failed(ep_id)
            return False, "无效地址"

        base = self._safe_name(video_title) if video_title else 'video'
        ep_name = self._safe_name(ep_title) if ep_title else f'第{ep_num}集'
        filename = f"{base}_{ep_name}.mp4"
        filepath = os.path.join(self.output_dir, filename)

        # 已存在且大小正常则跳过
        if os.path.exists(filepath) and os.path.getsize(filepath) > 1024:
            self.db.mark_downloaded(ep_id)
            return True, "已存在，跳过"

        # ffmpeg 请求头（Referer 防盗链 + UA）
        headers = (
            f"Referer: {BASE_URL}/\r\n"
            f"User-Agent: {HEADERS['User-Agent']}\r\n"
        )

        cmd = [
            self.ffmpeg, '-y',
            '-headers', headers,
            '-i', video_url,
            '-c', 'copy',
            '-bsf:a', 'aac_adtstoasc',
            '-loglevel', 'error',
            filepath
        ]

        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True,
                timeout=DOWNLOAD_TIMEOUT
            )
            if result.returncode == 0 and os.path.exists(filepath) and os.path.getsize(filepath) > 0:
                self.db.mark_downloaded(ep_id)
                size_mb = os.path.getsize(filepath) / 1024 / 1024
                return True, f"下载完成 ({size_mb:.1f}MB)"
            else:
                err = (result.stderr or '')[-300:].strip()
                if os.path.exists(filepath):
                    os.remove(filepath)
                self.db.mark_download_failed(ep_id)
                return False, f"ffmpeg失败: {err or '未知错误'}"
        except subprocess.TimeoutExpired:
            if os.path.exists(filepath):
                os.remove(filepath)
            self.db.mark_download_failed(ep_id)
            return False, "下载超时"
        except Exception as e:
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                except OSError:
                    pass
            self.db.mark_download_failed(ep_id)
            return False, f"异常: {e}"

    def download_all(self, max_downloads=None, max_workers=DOWNLOAD_WORKERS, stop_event=None):
        """批量下载所有已解密但未下载的剧集。

        Args:
            stop_event: 若提供，则在没有待下载项时不立即退出，而是轮询等待新解密的地址；
                        当 stop_event 被设置(解密完成)且仍无待下载项时才退出。
                        用于边采集边下载模式。
        """
        stats = self.db.get_download_stats()
        logger.info(f"待下载: {stats['downloadable'] - stats['downloaded']} / 已解密 {stats['downloadable']}")

        done = 0
        success = 0
        empty_polls = 0
        MAX_EMPTY_POLLS = 120  # 后台模式最多空轮询120次(约10分钟)

        while True:
            pending = self.db.get_pending_downloads(20)
            if not pending:
                if stop_event is not None and not stop_event.is_set():
                    # 边采集边下载：解密还在进行，等待新地址
                    empty_polls += 1
                    if empty_polls >= MAX_EMPTY_POLLS:
                        logger.warning("等待新解密地址超时，下载线程退出")
                        break
                    time.sleep(5)
                    continue
                break
            empty_polls = 0

            with ThreadPoolExecutor(max_workers=max_workers) as ex:
                futures = {}
                for ep in pending:
                    ep_id, ep_title, ep_num, video_url, video_title = ep
                    f = ex.submit(
                        self.download_one, ep_id, ep_title, ep_num, video_url, video_title
                    )
                    futures[f] = (ep_id, ep_title, ep_num)

                for f in as_completed(futures):
                    ep_id, ep_title, ep_num = futures[f]
                    ok, msg = f.result()
                    done += 1
                    if ok:
                        success += 1
                    logger.info(f"[{done}] {ep_title or f'第{ep_num}集'}: {msg}")

            if max_downloads and done >= max_downloads:
                break

        logger.info(f"下载结束: 成功 {success}/{done}")
        return success, done

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
    
    def run(self, categories=None, max_pages=None, max_videos=None, max_eps=None,
            download_mode='none', download_dir=DOWNLOAD_DIR, max_downloads=None):
        """执行完整爬取流程。

        Args:
            download_mode: 'none' 只爬取不下载;
                           'after' 全部解密完成后统一下载;
                           'parallel' 边解密边下载(后台线程)。
        """
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

        # ===== 下载模式控制 =====
        download_thread = None
        decrypt_done_event = None

        if download_mode == 'parallel':
            logger.info("===== 边采集边下载模式: 启动后台下载线程 =====")
            decrypt_done_event = threading.Event()
            downloader = VideoDownloader(self.db, download_dir)
            download_thread = threading.Thread(
                target=downloader.download_all,
                kwargs={'max_downloads': max_downloads, 'stop_event': decrypt_done_event},
                daemon=True,
                name='video-downloader'
            )
            download_thread.start()
        elif download_mode == 'after':
            logger.info("===== 下载模式: 全部解密完成后统一下载 =====")

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

        # 解密完成，通知后台下载线程
        if decrypt_done_event is not None:
            decrypt_done_event.set()
            logger.info("解密全部完成，等待后台下载线程收尾...")
            download_thread.join()

        json_path = os.path.join(OUTPUT_DIR, "4kvm_all_videos.json")
        self.db.export_json(json_path)

        s = self.db.get_stats()
        logger.info("="*50)
        logger.info(f"爬取完成! 视频:{s['videos']}, 详情:{s['details']}, 剧集:{s['episodes']}, 已解密:{s['ep_done']}")
        logger.info(f"导出文件: {json_path}")

        # after 模式：解密完成后统一下载
        if download_mode == 'after':
            self.download_videos(download_dir, max_downloads)

        ds = self.db.get_download_stats()
        logger.info(f"下载统计: 已下载 {ds['downloaded']}/{ds['downloadable']}")
        logger.info("="*50)
        return json_path

    def download_videos(self, download_dir=DOWNLOAD_DIR, max_downloads=None):
        """下载已解密的视频到本地"""
        logger.info("===== 开始下载视频 =====")
        downloader = VideoDownloader(self.db, download_dir)
        return downloader.download_all(max_downloads)

    def shutdown(self):
        self.decryptor.stop()

def main():
    import argparse
    parser = argparse.ArgumentParser(description='4kvm.net 全站爬虫 (WASM完美逆向解密)')
    parser.add_argument('--max-pages', type=int, default=None)
    parser.add_argument('--max-videos', type=int, default=None)
    parser.add_argument('--max-episodes', type=int, default=None)
    parser.add_argument('--test', action='store_true', help='测试模式: 只爬取1页电影')
    parser.add_argument('--download', action='store_true',
                        help='下载模式: 将已解密的视频下载到本地(不启动爬虫，直接读数据库)')
    parser.add_argument('--download-mode', choices=['none', 'after', 'parallel'], default='none',
                        help='爬取时的下载策略: none=不下载(默认), after=全部解密后统一下载, parallel=边解密边下载')
    parser.add_argument('--download-dir', type=str, default=DOWNLOAD_DIR,
                        help=f'视频下载目录(默认: {DOWNLOAD_DIR})')
    parser.add_argument('--max-downloads', type=int, default=None, help='最多下载数量')
    args = parser.parse_args()

    # ===== 下载模式：只下载，不启动爬虫和WASM解密服务 =====
    if args.download:
        db = Database(DATABASE_PATH)
        stats = db.get_download_stats()
        if stats['downloadable'] == 0:
            logger.warning("数据库中没有已解密的视频地址，请先运行爬虫获取地址")
            return
        pending = stats['downloadable'] - stats['downloaded']
        logger.info(f"已解密: {stats['downloadable']}, 已下载: {stats['downloaded']}, 待下载: {pending}")
        if pending == 0:
            logger.info("所有视频已下载完成")
            return
        downloader = VideoDownloader(db, args.download_dir)
        downloader.download_all(max_downloads=args.max_downloads)
        return

    # ===== 正常爬取模式 =====
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
            scraper.run(
                max_pages=args.max_pages,
                max_videos=args.max_videos,
                max_eps=args.max_episodes,
                download_mode=args.download_mode,
                download_dir=args.download_dir,
                max_downloads=args.max_downloads
            )
    finally:
        scraper.shutdown()

if __name__ == '__main__':
    main()
