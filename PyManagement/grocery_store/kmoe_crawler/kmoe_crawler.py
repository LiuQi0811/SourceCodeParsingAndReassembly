#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Kmoe (kxx.moe) 全站爬虫框架
============================
功能：
1. 漫画元数据全站抓取（目录、分类、详情、卷信息）
2. 请求头签名模拟（逆向还原 X-KM-FROM 头生成逻辑）
3. 验证码识别框架（captcha）
4. 下载链接生成与批量下载（需有效账号/VIP）
5. 支持断点续传、进度保存

使用前须知：
- 本工具仅供学习交流，请支持正版
- 下载功能需有效账号且需遵守网站使用条款
- 验证码可能需要人工介入或接入打码平台
"""

import os
import re
import sys
import json
import time
import random
import hashlib
import logging
import argparse
from urllib.parse import urljoin, urlencode, quote, unquote
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Set, Iterator

import requests
from bs4 import BeautifulSoup
from tqdm import tqdm

# ============ 配置区 ============

BASE_URL = "https://kxx.moe"
# 备用域名
MIRROR_DOMAINS = ["kxx.moe", "kzz.moe", "koz.moe"]

# 默认请求头
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-TW,zh;q=0.9,ja;q=0.8,en-US;q=0.7,en;q=0.6",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Referer": BASE_URL + "/",
}

# API版本签名（从JS逆向得到）
KB_API_VERSION = "KMOE/3.0.0"

# ============ 日志配置 ============
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('kmoe_crawler.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)


class KmoeCrawler:
    """Kmoe 爬虫主类"""
    
    def __init__(self, data_dir: str = "./kmoe_data", delay: float = 2.0):
        """
        初始化爬虫
        :param data_dir: 数据保存目录
        :param delay: 请求间隔（秒）
        """
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.delay = delay
        
        self.session = requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)
        
        # 进度文件
        self.progress_file = self.data_dir / "progress.json"
        self.progress = self._load_progress()
        
        # 已抓取漫画ID集合
        self.crawled_ids: Set[str] = set(self.progress.get("crawled_ids", []))
        
        # 分类映射
        self.categories = self._get_categories()
        
    def _load_progress(self) -> Dict:
        """加载抓取进度"""
        if self.progress_file.exists():
            try:
                with open(self.progress_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                pass
        return {
            "crawled_ids": [],
            "last_page": 0,
            "total_pages": 0,
            "crawl_time": None
        }
    
    def _save_progress(self):
        """保存抓取进度"""
        self.progress["crawled_ids"] = list(self.crawled_ids)
        self.progress["crawl_time"] = datetime.now().isoformat()
        with open(self.progress_file, 'w', encoding='utf-8') as f:
            json.dump(self.progress, f, ensure_ascii=False, indent=2)
    
    def _get_categories(self) -> Dict[str, str]:
        """获取分类URL映射（从JS硬编码）"""
        return {
            "幽默": "CAT*幽默",
            "爱情": "CAT*愛情",
            "竞技": "CAT*競技",
            "热血": "CAT*熱血",
            "格斗": "CAT*格鬥",
            "冒险": "CAT*冒險",
            "恐怖": "CAT*恐怖",
            "生存": "CAT*生存",
            "悬疑": "CAT*懸疑",
            "侦探": "CAT*偵探",
            "历史": "CAT*歷史",
            "战争": "CAT*戰爭",
            "生活": "CAT*生活",
            "励志": "CAT*勵志",
            "校园": "CAT*校園",
            "职场": "CAT*職場",
            "美食": "CAT*美食",
            "音乐舞蹈": "CAT*音樂",
            "机战": "CAT*機戰",
            "科幻": "CAT*科幻",
            "魔幻": "CAT*魔幻",
            "魔法": "CAT*魔法",
            "奇幻": "CAT*奇幻",
            "神鬼": "CAT*神鬼",
            "武侠": "CAT*武俠",
            "仙侠": "CAT*仙俠",
            "治愈": "CAT*治癒",
            "萌系": "CAT*萌系",
            "宅系": "CAT*宅系",
            "青年": "CAT*青年",
            "少年": "CAT*少年",
            "少女": "CAT*少女",
            "后宫": "CAT*後宮",
            "百合": "CAT*百合",
            "伪娘": "CAT*偽娘",
            "性转换": "CAT*性轉",
            "TL": "CAT*TL",
            "耽美": "BL",
            "转生": "CAT*轉生",
            "穿越": "CAT*穿越",
            "童话": "CAT*童話",
            "东方": "CAT*東方",
            "四格": "CAT*四格",
            "绘本": "CAT*繪本",
            "艺术": "CAT*藝術",
            "杂志": "CAT*雜誌",
            "轻小说改编": "CAT*輕改",
            "连环画": "CAT*連環畫",
        }
    
    def _build_signed_headers(self, method: str = "GET", path: str = "/") -> Dict:
        """
        构建带签名的请求头（逆向X-KM-FROM头）
        从zzcomm.js逆向: KB_API_VERSION+'('+KM_VIEW+') '+method+' '+pathname
        """
        headers = {}
        km_from = f"{KB_API_VERSION}(WEB) {method.upper()} {path}"
        headers["X-KM-FROM"] = km_from
        return headers
    
    def _request(self, url: str, method: str = "GET", **kwargs) -> Optional[requests.Response]:
        """
        统一请求方法，自动添加签名头和延时
        """
        path = url.replace(BASE_URL, "").split("?")[0]
        if not path.startswith("/"):
            path = "/" + path
            
        signed_headers = self._build_signed_headers(method, path)
        
        headers = kwargs.pop("headers", {})
        headers.update(signed_headers)
        
        time.sleep(self.delay + random.uniform(0, 1))
        
        try:
            response = self.session.request(
                method, url, headers=headers, timeout=30, **kwargs
            )
            response.raise_for_status()
            response.encoding = 'utf-8'
            return response
        except requests.exceptions.RequestException as e:
            logger.error(f"请求失败: {url} - {e}")
            return None
    
    # ============ 列表页解析 ============
    
    def parse_list_page(self, html: str) -> List[Dict]:
        """
        解析列表页，提取漫画条目
        数据完全从 disp_divinfo() JS函数调用中提取（服务端渲染的内嵌数据）
        """
        books = []
        
        # 稳健的正则匹配：URL + 评分 + 书名 + 作者
        # disp_divinfo( ... "URL", ... "score", "name", "author", "status", "update" )
        pattern = re.compile(
            r'disp_divinfo\s*\([^)]+?'
            r'\"(https://kxx\.moe/c/[^\"]+\.htm)\"'  # URL
            r'[^)]+?'
            r'\"([\d.]+)\"\s*,\s*'                  # score
            r'\"([^\"]+)\"\s*,\s*'                   # name
            r'\"([^\"]*)\"\s*,\s*'                   # author
            r'\"([^\"]*)\"\s*,\s*'                   # status
            r'\"([^\"]*)\"',                         # update
            re.DOTALL
        )
        
        # 单独提取封面URL
        cover_pattern = re.compile(
            r'disp_divinfo\s*\(\s*\"div_info_\"\s*\+\s*\"\d+\"\s*,\s*'
            r'\"(https://kxx\.moe/c/[^\"]+\.htm)\"\s*,\s*'
            r'\"([^\"]+)\"',
            re.DOTALL
        )
        
        # 构建URL到封面的映射
        url_to_cover = {}
        for cm in cover_pattern.finditer(html):
            url_to_cover[cm.group(1)] = cm.group(2)
        
        seen_ids = set()
        for match in pattern.finditer(html):
            url = match.group(1)
            score = match.group(2)
            name = match.group(3)
            author = match.group(4)
            status = match.group(5)
            update = match.group(6)
            
            id_match = re.search(r'/c/([^.]+)\.htm', url)
            if not id_match:
                continue
            book_id = id_match.group(1)
            
            if book_id in seen_ids or book_id == "10001":
                continue
            seen_ids.add(book_id)
            
            book_status = ""
            if "完結" in status:
                book_status = "完结"
            elif "連載" in status:
                book_status = "连载"
            
            books.append({
                "id": book_id,
                "title": name,
                "author": author,
                "score": score,
                "status": book_status,
                "update_info": status + " " + update,
                "url": url,
                "cover": url_to_cover.get(url, ""),
            })
        
        # 获取总页数 - 从 disp_divpage 调用中提取
        # disp_divpage( "input_go", "", "895", ...)
        total_pages = 1
        page_match = re.search(r'disp_divpage\s*\(\s*"[^"]*"\s*,\s*"[^"]*"\s*,\s*"(\d+)"', html)
        if page_match:
            total_pages = int(page_match.group(1))
        else:
            page_match2 = re.search(r'(\d+)\s*頁', html)
            if page_match2:
                total_pages = int(page_match2.group(1))
        
        return books, total_pages
    
    def crawl_list_page(self, page: int = 1, category: str = None) -> Tuple[List[Dict], int]:
        """
        抓取指定页码的列表
        :param page: 页码
        :param category: 分类过滤（可选）
        """
        if category and category in self.categories:
            # 分类URL格式: /l/CAT*XXX,all,all,sortpoint,all,all,BL,0,0/
            cat_code = self.categories[category]
            url = f"{BASE_URL}/l/{cat_code},all,all,sortpoint,all,all,BL,0,0/{page}.htm"
        else:
            # 所有列表页统一用 /l/--/{page}.htm 格式（第1页也用，确保分页一致）
            url = f"{BASE_URL}/l/--/{page}.htm"
        
        logger.info(f"抓取列表页: {url}")
        resp = self._request(url)
        if not resp:
            return [], 0
        
        books, total_pages = self.parse_list_page(resp.text)
        logger.info(f"第{page}页: 找到{len(books)}本漫画, 共{total_pages}页")
        
        return books, total_pages
    
    # ============ 详情页解析 ============
    
    def parse_detail_page(self, html: str, book_id: str) -> Dict:
        """
        解析漫画详情页
        """
        soup = BeautifulSoup(html, 'html.parser')
        
        result = {
            "id": book_id,
            "url": f"{BASE_URL}/c/{book_id}.htm",
            "title": "",
            "title_en": "",
            "author": "",
            "description": "",
            "cover": "",
            "score": "",
            "score_count": 0,
            "status": "",  # 连载/完结
            "region": "",  # 地区
            "language": "",  # 语言
            "last_publish": "",
            "publisher": "",
            "scanner": "",
            "maintainer": "",
            "subscribers": 0,
            "favorites": 0,
            "read_count": 0,
            "hot": 0,
            "categories": [],
            "volumes": [],
            "is_hd": False,
            "is_color": False,
            "is_jpn": False,
            "is_eng": False,
            "is_r18": False,
        }
        
        # 标题
        title_elem = soup.find('font', class_='text_bglight_big')
        if title_elem:
            result["title"] = title_elem.get_text(strip=True)
        
        # 副标题/英文名
        title_fonts = soup.find_all('font', class_='text_bglight')
        for f in title_fonts:
            text = f.get_text(strip=True)
            if text.startswith("(") or text.startswith("（"):
                result["title_en"] = text
                break
        
        # 封面
        cover_img = soup.find('img', class_='img_book')
        if cover_img:
            result["cover"] = cover_img.get('src', '')
        
        # 评分
        score_elem = soup.find('font', style=lambda x: x and 'font-size:30px' in x if x else False)
        if score_elem:
            result["score"] = score_elem.get_text(strip=True)
        
        # 提取详细信息
        info_texts = []
        for f in soup.find_all('font', class_='text_bglight'):
            text = f.get_text(strip=True)
            if text:
                info_texts.append(text)
        
        info_text = " ".join(info_texts)
        
        # 作者
        author_match = re.search(r'作者[：:]\s*([^\s]+)', info_text)
        if author_match:
            result["author"] = author_match.group(1)
        
        # 状态
        if "完結" in info_text:
            result["status"] = "完结"
        elif "連載" in info_text:
            result["status"] = "连载"
        
        # 地区
        region_match = re.search(r'地區[：:]\s*([^\s]+)', info_text)
        if region_match:
            result["region"] = region_match.group(1)
        
        # 语言
        lang_match = re.search(r'語言[：:]\s*([^\s]+)', info_text)
        if lang_match:
            result["language"] = lang_match.group(1)
        
        # 最后出版
        pub_match = re.search(r'最後出版[：:]\s*(\d+)', info_text)
        if pub_match:
            result["last_publish"] = pub_match.group(1)
        
        # 版本/扫者
        version_match = re.search(r'版本[：:]\s*([^\s]+)', info_text)
        if version_match:
            result["publisher"] = version_match.group(1)
        
        scanner_match = re.search(r'掃者[：:]\s*([^\s]+)', info_text)
        if scanner_match:
            result["scanner"] = scanner_match.group(1)
        
        # 订阅/收藏/热度
        sub_match = re.search(r'訂閱[：:]\s*(\d+)', info_text)
        if sub_match:
            result["subscribers"] = int(sub_match.group(1))
        fav_match = re.search(r'收藏[：:]\s*(\d+)', info_text)
        if fav_match:
            result["favorites"] = int(fav_match.group(1))
        read_match = re.search(r'讀過[：:]\s*(\d+)', info_text)
        if read_match:
            result["read_count"] = int(read_match.group(1))
        hot_match = re.search(r'熱度[：:]\s*(\d+)', info_text)
        if hot_match:
            result["hot"] = int(hot_match.group(1))
        
        # 简介
        desc_elem = soup.find('div', id='div_desc_content')
        if desc_elem:
            result["description"] = desc_elem.get_text(strip=True)
        
        # 分类
        cate_links = soup.find_all('a', href=re.compile(r'/list\.php\?s='))
        for cl in cate_links:
            cat_name = cl.get_text(strip=True)
            if cat_name and not cat_name.isdigit() and "(" not in cat_name:
                if cat_name not in result["categories"]:
                    result["categories"].append(cat_name)
        
        # 检测标签图标
        result["is_hd"] = 'id="logo_hd" style=""' in html or "display:" in str(soup.find('img', id='logo_hd'))
        result["is_jpn"] = soup.find('img', id='logo_jpn') and 'display:none' not in str(soup.find('img', id='logo_jpn'))
        result["is_eng"] = soup.find('img', id='logo_eng') and 'display:none' not in str(soup.find('img', id='logo_eng'))
        
        # 提取卷数据 - 从内联JS中提取 arr_voldata
        vol_pattern = re.compile(r'arr_voldata\s*=\s*(\[.*?\]);', re.DOTALL)
        vol_match = vol_pattern.search(html)
        if vol_match:
            try:
                # JS数组解析（简化处理）
                vol_data_str = vol_match.group(1)
                # 使用正则提取每个卷条目
                vol_entries = re.findall(r'\[(.*?)\]', vol_data_str)
                for entry_str in vol_entries[:50]:  # 限制解析数量
                    parts = re.findall(r'"([^"]*)"', entry_str)
                    if len(parts) >= 5:
                        vol_info = {
                            "vol_id": parts[0] if parts[0].isdigit() else "",
                            "vol_name": parts[1] if len(parts) > 1 else "",
                            "vol_type": parts[3] if len(parts) > 3 else "",
                        }
                        if vol_info["vol_id"]:
                            result["volumes"].append(vol_info)
            except Exception as e:
                logger.warning(f"解析卷数据失败: {e}")
        
        return result
    
    def crawl_detail(self, book_id: str) -> Optional[Dict]:
        """
        抓取漫画详情页
        """
        url = f"{BASE_URL}/c/{book_id}.htm"
        logger.info(f"抓取详情: {url}")
        
        resp = self._request(url)
        if not resp:
            return None
        
        try:
            detail = self.parse_detail_page(resp.text, book_id)
            return detail
        except Exception as e:
            logger.error(f"解析详情页失败 {book_id}: {e}")
            return None
    
    # ============ 全站元数据抓取 ============
    
    def crawl_all_metadata(self, start_page: int = 1, max_pages: int = None, 
                           save_every: int = 10) -> List[Dict]:
        """
        全站元数据抓取
        :param start_page: 起始页码
        :param max_pages: 最大页数（None为全部）
        :param save_every: 每N页保存一次
        """
        all_books = []
        
        # 先抓第一页获取总页数
        books, total_pages = self.crawl_list_page(start_page)
        
        if max_pages:
            total_pages = min(total_pages, max_pages)
        
        logger.info(f"开始全站抓取，共 {total_pages} 页")
        self.progress["total_pages"] = total_pages
        
        metadata_file = self.data_dir / "books_metadata.json"
        if metadata_file.exists():
            with open(metadata_file, 'r', encoding='utf-8') as f:
                all_books = json.load(f)
        
        for page in range(start_page, total_pages + 1):
            self.progress["last_page"] = page
            
            if page > start_page:
                books, _ = self.crawl_list_page(page)
            
            for book in books:
                book_id = book["id"]
                if book_id in self.crawled_ids:
                    logger.debug(f"跳过已抓取: {book['title']} ({book_id})")
                    continue
                
                detail = self.crawl_detail(book_id)
                if detail:
                    # 合并列表信息和详情
                    detail["score"] = book.get("score", detail["score"])
                    all_books.append(detail)
                    self.crawled_ids.add(book_id)
                    logger.info(f"已抓取: {detail['title']} (ID:{book_id})")
            
            # 定期保存
            if page % save_every == 0:
                with open(metadata_file, 'w', encoding='utf-8') as f:
                    json.dump(all_books, f, ensure_ascii=False, indent=2)
                self._save_progress()
                logger.info(f"保存进度: 第{page}页, 已抓{len(all_books)}本")
        
        # 最终保存
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(all_books, f, ensure_ascii=False, indent=2)
        self._save_progress()
        
        logger.info(f"全站抓取完成! 共抓取 {len(all_books)} 本漫画")
        return all_books
    
    # ============ 下载URL生成（逆向分析）============
    
    def generate_download_url(self, book_id: str, vol_id: str, 
                               line: int = 0, file_type: int = 1,
                               file_count: int = 1) -> str:
        """
        生成下载URL（逆向do_down_batch函数）
        URL格式: /dl/{bookid}/{volid}/{line}/{type}/{file_count}/
        file_type: 0=zip源图, 1=mobi, 2=epub
        line: 0=线1, 1=线2(VIP)
        """
        url = f"{BASE_URL}/dl/{book_id}/{vol_id}/{line}/{file_type}/{file_count}/0/"
        return url
    
    # ============ 验证码处理框架 ============
    
    def get_captcha(self) -> Optional[str]:
        """
        获取验证码图片
        返回验证码图片路径（需要人工识别或接入打码平台）
        """
        # 验证码URL需要从captcha_show函数获取
        # 典型实现需先访问获取验证码页面
        captcha_url = f"{BASE_URL}/captcha.php"
        resp = self._request(captcha_url)
        if resp and resp.status_code == 200:
            captcha_file = self.data_dir / "captcha.png"
            with open(captcha_file, 'wb') as f:
                f.write(resp.content)
            logger.info(f"验证码已保存到: {captcha_file}")
            logger.info("请查看验证码图片并输入验证码")
            return str(captcha_file)
        return None
    
    def submit_captcha(self, captcha_code: str, down_url: str) -> bool:
        """
        提交验证码并触发下载
        """
        # 验证码提交逻辑需根据实际captcha_do.php接口分析
        submit_url = f"{BASE_URL}/captcha_do.php"
        data = {
            "code": captcha_code,
            "url": down_url,
        }
        resp = self._request(submit_url, method="POST", data=data)
        if resp:
            try:
                result = resp.json()
                if result.get("code") == "m100" or result.get("downurl"):
                    logger.info("验证码验证成功")
                    return True
            except:
                pass
        return False
    
    # ============ 登录（需要用户提供账号）============
    
    def login(self, username: str, password: str) -> bool:
        """
        登录账号（密码可能需要加密，需进一步逆向login_do.php）
        """
        login_url = f"{BASE_URL}/login_do.php"
        
        # 获取登录页获取token/cookie
        self._request(f"{BASE_URL}/login.php")
        
        # TODO: 分析密码加密逻辑（如有）
        data = {
            "u": username,
            "p": hashlib.md5(password.encode()).hexdigest(),  # 推测MD5，需验证
        }
        
        resp = self._request(login_url, method="POST", data=data)
        if resp:
            try:
                result = resp.json()
                if "uin" in str(result) or result.get("code") == "m100":
                    logger.info("登录成功!")
                    return True
            except:
                # 可能是重定向
                if "我的漫畫" in resp.text or "主頁" in resp.text:
                    logger.info("登录成功!")
                    return True
        
        logger.error("登录失败，请检查账号密码")
        return False
    
    # ============ 文件下载 ============
    
    def download_file(self, url: str, save_path: Path, 
                      expected_size: int = None) -> bool:
        """
        下载文件（支持断点续传）
        """
        save_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 检查已下载部分
        existing_size = 0
        if save_path.exists():
            existing_size = save_path.stat().st_size
            if expected_size and existing_size >= expected_size:
                logger.info(f"文件已存在: {save_path.name}")
                return True
        
        headers = {}
        if existing_size > 0:
            headers["Range"] = f"bytes={existing_size}-"
        
        signed_headers = self._build_signed_headers("GET", url.replace(BASE_URL, ""))
        headers.update(signed_headers)
        headers["Referer"] = url
        
        try:
            resp = self.session.get(url, headers=headers, stream=True, timeout=60)
            
            if resp.status_code == 416:  # Range not satisfiable
                return True
            
            mode = 'ab' if existing_size > 0 and resp.status_code == 206 else 'wb'
            
            total_size = int(resp.headers.get('content-length', 0))
            if resp.status_code == 206:
                total_size += existing_size
            
            with open(save_path, mode) as f:
                with tqdm(total=total_size, initial=existing_size if mode == 'ab' else 0,
                         unit='B', unit_scale=True, desc=save_path.name) as pbar:
                    for chunk in resp.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                            pbar.update(len(chunk))
            
            logger.info(f"下载完成: {save_path.name}")
            return True
            
        except Exception as e:
            logger.error(f"下载失败 {url}: {e}")
            return False


def main():
    parser = argparse.ArgumentParser(description="Kmoe (kxx.moe) 全站爬虫框架")
    parser.add_argument("--mode", choices=["metadata", "list", "detail", "download"],
                       default="metadata", help="运行模式")
    parser.add_argument("--start-page", type=int, default=1, help="起始页码")
    parser.add_argument("--max-pages", type=int, default=None, help="最大抓取页数")
    parser.add_argument("--book-id", type=str, help="指定漫画ID（详情/下载模式）")
    parser.add_argument("--data-dir", type=str, default="./kmoe_data", help="数据保存目录")
    parser.add_argument("--delay", type=float, default=2.0, help="请求间隔(秒)")
    parser.add_argument("--username", type=str, help="登录用户名")
    parser.add_argument("--password", type=str, help="登录密码")
    
    args = parser.parse_args()
    
    crawler = KmoeCrawler(data_dir=args.data_dir, delay=args.delay)
    
    if args.username and args.password:
        crawler.login(args.username, args.password)
    
    if args.mode == "metadata":
        crawler.crawl_all_metadata(
            start_page=args.start_page,
            max_pages=args.max_pages
        )
    
    elif args.mode == "list":
        books, total = crawler.crawl_list_page(args.start_page)
        print(f"\n第{args.start_page}页漫画列表 (共{total}页):")
        for b in books:
            print(f"  [{b['id']}] {b['title']} - {b['score']}分")
    
    elif args.mode == "detail":
        if not args.book_id:
            print("请指定 --book-id")
            return
        detail = crawler.crawl_detail(args.book_id)
        if detail:
            print(json.dumps(detail, ensure_ascii=False, indent=2))
    
    elif args.mode == "download":
        if not args.book_id:
            print("请指定 --book-id")
            return
        detail = crawler.crawl_detail(args.book_id)
        if detail and detail.get("volumes"):
            book_dir = Path(args.data_dir) / "downloads" / detail["title"]
            book_dir.mkdir(parents=True, exist_ok=True)
            
            for vol in detail["volumes"]:
                vol_id = vol["vol_id"]
                vol_name = vol["vol_name"] or f"vol_{vol_id}"
                # 下载epub格式
                down_url = crawler.generate_download_url(
                    args.book_id, vol_id, line=0, file_type=2
                )
                save_file = book_dir / f"{vol_name}.epub"
                logger.info(f"下载 {vol_name}: {down_url}")
                crawler.download_file(down_url, save_file)


if __name__ == "__main__":
    print("""
╔═══════════════════════════════════════════════════════════╗
║       Kmoe (kxx.moe) 全站爬虫框架 v1.0                   ║
║  仅供学习研究使用，请支持正版，遵守网站使用条款            ║
╚═══════════════════════════════════════════════════════════╝
    """)
    main()
