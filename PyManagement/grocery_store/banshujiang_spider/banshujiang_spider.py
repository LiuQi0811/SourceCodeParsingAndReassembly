#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
搬书匠 (banshujiang.cn) 全站爬虫
功能:
1. 爬取所有电子书列表页
2. 爬取每本电子书详情页元数据(标题/作者/年份/分类/简介等)
3. 下载书籍封面图片
4. 提取所有网盘下载链接(城通网盘等)
5. 支持断点续爬、延时防封、多线程
6. 数据保存为JSON/CSV格式

注意: 电子书文件存储在第三方网盘(如城通网盘),网盘本身需要浏览器验证和人工操作,
     本爬虫负责提取网盘直跳链接,实际文件下载请通过浏览器打开链接手动操作。
"""

import os
import re
import json
import time
import csv
import threading
import queue
import logging
from urllib.parse import urljoin, urlparse
from datetime import datetime
import requests
from bs4 import BeautifulSoup
from fake_useragent import UserAgent

# ==================== 配置项 ====================
BASE_URL = "http://www.banshujiang.cn"
LIST_URL_TPL = "http://www.banshujiang.cn/e_books/page/{page}"
DETAIL_URL_TPL = "http://www.banshujiang.cn/e_books/{book_id}"
IMAGE_BASE = "http://image.banshujiang.cn"

SAVE_DIR = "banshujiang_data"       # 数据保存目录
IMAGE_DIR = os.path.join(SAVE_DIR, "covers")  # 封面保存目录
DATA_JSON = os.path.join(SAVE_DIR, "books.json")
DATA_CSV = os.path.join(SAVE_DIR, "books.csv")
PROGRESS_FILE = os.path.join(SAVE_DIR, "progress.json")

THREAD_COUNT = 3                    # 并发线程数
DELAY_MIN = 1                       # 请求最小间隔(秒)
DELAY_MAX = 3                       # 请求最大间隔(秒)
TIMEOUT = 30                        # 请求超时(秒)
MAX_RETRY = 3                       # 最大重试次数

# ==================== 日志配置 ====================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(threadName)s] %(levelname)s: %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# ==================== 全局锁 ====================
file_lock = threading.Lock()
progress_lock = threading.Lock()

# ==================== 工具函数 ====================
def get_random_ua():
    """获取随机User-Agent"""
    try:
        return UserAgent().random
    except:
        return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

def get_session():
    """创建带默认headers的requests session"""
    session = requests.Session()
    session.headers.update({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Referer': BASE_URL + '/',
    })
    return session

def polite_delay():
    """礼貌延时"""
    time.sleep(DELAY_MIN + (DELAY_MAX - DELAY_MIN) * (time.time() % 1))

def safe_request(session, url, method='get', **kwargs):
    """带重试的安全请求"""
    for attempt in range(MAX_RETRY):
        try:
            session.headers['User-Agent'] = get_random_ua()
            if method.lower() == 'get':
                resp = session.get(url, timeout=TIMEOUT, **kwargs)
            else:
                resp = session.post(url, timeout=TIMEOUT, **kwargs)
            resp.encoding = 'utf-8'
            if resp.status_code == 200:
                return resp
            elif resp.status_code == 404:
                logger.warning(f"页面不存在(404): {url}")
                return None
            else:
                logger.warning(f"状态码{resp.status_code}, 重试{attempt+1}/{MAX_RETRY}: {url}")
        except Exception as e:
            logger.warning(f"请求异常({e}), 重试{attempt+1}/{MAX_RETRY}: {url}")
        time.sleep(2 ** attempt)
    logger.error(f"请求失败,已达最大重试次数: {url}")
    return None

# ==================== 数据持久化 ====================
def load_progress():
    """加载爬取进度"""
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {
        'list_pages_crawled': [],     # 已爬列表页
        'detail_crawled': [],         # 已爬详情页ID
        'total_pages': None,          # 总页数(探测后填入)
        'total_books': 0,             # 总书籍数
        'start_time': datetime.now().isoformat(),
    }

def save_progress(progress):
    """保存爬取进度"""
    with progress_lock:
        progress['last_update'] = datetime.now().isoformat()
        with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
            json.dump(progress, f, ensure_ascii=False, indent=2)

def load_existing_books():
    """加载已爬取的书籍数据"""
    books = {}
    if os.path.exists(DATA_JSON):
        try:
            with open(DATA_JSON, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for book in data:
                    books[str(book['id'])] = book
        except:
            pass
    return books

def save_book(book_dict, all_books):
    """增量保存单本书籍"""
    with file_lock:
        all_books[str(book_dict['id'])] = book_dict
        with open(DATA_JSON, 'w', encoding='utf-8') as f:
            json.dump(list(all_books.values()), f, ensure_ascii=False, indent=2)

def books_to_csv():
    """将JSON数据转换为CSV"""
    if not os.path.exists(DATA_JSON):
        return
    with open(DATA_JSON, 'r', encoding='utf-8') as f:
        books = json.load(f)
    if not books:
        return
    # 收集所有字段
    all_fields = set()
    for b in books:
        all_fields.update(b.keys())
    fields = ['id', 'title', 'author', 'language', 'year', 'publisher', 'category',
              'cover_url', 'cover_local', 'detail_url', 'download_links', 'summary_text', 'crawl_time']
    fields = [f for f in fields if f in all_fields]
    with open(DATA_CSV, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction='ignore')
        writer.writeheader()
        for b in books:
            row = dict(b)
            if 'download_links' in row:
                row['download_links'] = ' | '.join([f"{x['type']}:{x['name']}->{x['url']}" for x in row['download_links']])
            writer.writerow(row)

# ==================== 解析函数 ====================
def parse_max_page(html):
    """从第一页解析总页数"""
    soup = BeautifulSoup(html, 'lxml')
    # 查找分页区域
    pager = soup.find('div', class_='pagination')
    if not pager:
        pager = soup.find('ul', class_='pager')
    if not pager:
        # 尝试找"最旧"链接
        oldest = soup.find('a', string=re.compile(r'最旧|末页|Last'))
        if oldest and oldest.get('href'):
            m = re.search(r'/page/(\d+)', oldest['href'])
            if m:
                return int(m.group(1))
        return 1
    # 查找所有页码链接
    page_nums = []
    for a in pager.find_all('a', href=True):
        m = re.search(r'/page/(\d+)', a['href'])
        if m:
            page_nums.append(int(m.group(1)))
    if page_nums:
        return max(page_nums)
    return 1

def parse_book_list(html):
    """解析列表页,返回书籍ID列表和详情链接"""
    soup = BeautifulSoup(html, 'lxml')
    book_ids = []
    # 查找所有"去下载"链接,从中提取书籍ID和链接ID
    # 先找书籍容器
    items = soup.select('div.ebook-item, li.ebook-item, .ebook-list .item')
    if not items:
        # 通用匹配:找所有 /e_books/(\d+) 的链接
        seen = set()
        for a in soup.find_all('a', href=True):
            href = a['href']
            m = re.match(r'^/e_books/(\d+)/?$', href)
            if m:
                bid = m.group(1)
                if bid not in seen and not a.get('class') or 'link-name' not in (a.get('class') or []):
                    seen.add(bid)
                    book_ids.append(bid)
        # 再找详情页内的下载链接需要另一个ID,这里先返回book_id
    # 备用方案:直接从 "去下载" 链接提取
    download_links = soup.find_all('a', string=re.compile(r'去下载|下载'))
    for a in download_links:
        href = a.get('href', '')
        m = re.search(r'/e_books/(\d+)', href)
        if m:
            bid = m.group(1)
            if bid not in book_ids:
                book_ids.append(bid)
    return list(set(book_ids))

def parse_download_links(html):
    """解析详情页中的下载链接"""
    soup = BeautifulSoup(html, 'lxml')
    links = []
    # 查找下载链接区域
    download_section = None
    for td in soup.find_all('td'):
        if '下载链接' in td.get_text():
            download_section = td.find_next_sibling('td')
            break
    if not download_section:
        # 找包含 to_link 的链接
        for a in soup.find_all('a', href=True):
            href = a['href']
            if '/to_link' in href or '/webstorage' in href or 'pan.' in href:
                # 获取格式标签
                format_tag = None
                parent = a.parent
                if parent:
                    tag_span = parent.find('span', class_=re.compile(r'format|PDF|EPUB|MOBI'))
                    if tag_span:
                        format_tag = tag_span.get_text(strip=True)
                if not format_tag:
                    prev = a.find_previous('span')
                    if prev:
                        format_tag = prev.get_text(strip=True)
                links.append({
                    'type': format_tag or 'Unknown',
                    'name': a.get_text(strip=True),
                    'url': urljoin(BASE_URL, href)
                })
        return links

    # 在下载区域内提取
    for li in download_section.find_all('li'):
        format_span = li.find('span', class_=re.compile(r'format-tag|PDF|EPUB|MOBI|AZW3'))
        fmt = format_span.get_text(strip=True) if format_span else 'Unknown'
        for a in li.find_all('a', href=True):
            links.append({
                'type': fmt,
                'name': a.get_text(strip=True),
                'url': urljoin(BASE_URL, a['href'])
            })
    # 如果还没找到,兜底遍历区域内所有链接
    if not links:
        for a in download_section.find_all('a', href=True):
            links.append({
                'type': 'Unknown',
                'name': a.get_text(strip=True),
                'url': urljoin(BASE_URL, a['href'])
            })
    return links

def parse_book_detail(html, book_id):
    """解析书籍详情页,返回书籍元数据"""
    soup = BeautifulSoup(html, 'lxml')
    book = {
        'id': book_id,
        'title': '',
        'author': '',
        'language': '',
        'year': '',
        'publisher': '',
        'category': '',
        'cover_url': '',
        'cover_local': '',
        'detail_url': DETAIL_URL_TPL.format(book_id=book_id),
        'download_links': [],
        'summary_text': '',
        'summary_html': '',
        'crawl_time': datetime.now().isoformat()
    }

    # 标题
    title_div = soup.find('div', class_='ebook-title')
    if title_div:
        title_a = title_div.find('a')
        if title_a:
            book['title'] = title_a.get_text(strip=True)
    if not book['title']:
        h1 = soup.find('h1')
        if h1:
            book['title'] = h1.get_text(strip=True)
        else:
            title_tag = soup.find('title')
            if title_tag:
                book['title'] = title_tag.get_text(strip=True).replace(' - 搬书匠 - 电子书下载', '').strip()

    # 封面图
    img = soup.find('img', alt=book['title'] or True)
    if img and img.get('src'):
        src = img['src']
        if src.startswith('//'):
            src = 'http:' + src
        book['cover_url'] = src

    # 元数据表格
    info_table = soup.find('table', class_='tablex')
    if info_table:
        for tr in info_table.find_all('tr'):
            tds = tr.find_all('td')
            if len(tds) >= 2:
                label = tds[0].get_text(strip=True).replace('：', '').replace(':', '').strip()
                value = tds[1].get_text(strip=True)
                if label == '作者':
                    book['author'] = value
                elif label == '语言':
                    book['language'] = value
                elif label in ('出版年份', '出版日期', '年份'):
                    book['year'] = value
                elif label == '出版社':
                    book['publisher'] = value
                elif '分类' in label:
                    book['category'] = value

    # 从meta补充
    desc_meta = soup.find('meta', attrs={'name': 'description'})
    if desc_meta and desc_meta.get('content'):
        content = desc_meta['content']
        parts = content.split(';')
        for part in parts:
            part = part.strip()
            if part.startswith('作者:') and not book['author']:
                book['author'] = part[3:].strip()
            elif part.startswith('语言:') and not book['language']:
                book['language'] = part[3:].strip()
            elif part.startswith('出版年份:') and not book['year']:
                book['year'] = part[5:].strip()

    # 下载链接
    book['download_links'] = parse_download_links(html)

    # 简介/摘要
    markdown_div = soup.find('div', class_='ebook-markdown-content')
    if markdown_div:
        book['summary_html'] = str(markdown_div)
        book['summary_text'] = markdown_div.get_text('\n', strip=True)

    return book

def download_cover(session, book):
    """下载封面图片"""
    if not book.get('cover_url'):
        return book
    try:
        url = book['cover_url']
        ext = os.path.splitext(urlparse(url).path)[1] or '.jpeg'
        # 去掉query参数中的timestamp
        ext = ext.split('?')[0]
        local_path = os.path.join(IMAGE_DIR, f"{book['id']}{ext}")
        if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
            book['cover_local'] = local_path
            return book
        polite_delay()
        resp = safe_request(session, url)
        if resp:
            with open(local_path, 'wb') as f:
                f.write(resp.content)
            book['cover_local'] = local_path
            logger.info(f"封面已下载: {book['id']} - {os.path.basename(local_path)}")
    except Exception as e:
        logger.warning(f"封面下载失败({book['id']}): {e}")
    return book

# ==================== 爬取逻辑 ====================
def get_max_page(session):
    """探测总页数"""
    url = LIST_URL_TPL.format(page=1)
    resp = safe_request(session, url)
    if not resp:
        return 1
    max_p = parse_max_page(resp.text)
    logger.info(f"探测到总页数: {max_p}")
    return max_p, resp.text

def crawl_list_page(session, page_num):
    """爬单个列表页,返回book_id列表"""
    url = LIST_URL_TPL.format(page=page_num)
    logger.info(f"开始爬取列表页: 第{page_num}页")
    resp = safe_request(session, url)
    if not resp:
        return []
    book_ids = parse_book_list(resp.text)
    logger.info(f"列表页{page_num} 发现{len(book_ids)}本书")
    return book_ids

def crawl_detail_page(session, book_id):
    """爬单本书详情"""
    url = DETAIL_URL_TPL.format(book_id=book_id)
    resp = safe_request(session, url)
    if not resp:
        return None
    book = parse_book_detail(resp.text, book_id)
    book = download_cover(session, book)
    logger.info(f"详情已爬取: [{book_id}] {book['title'][:40]}...")
    return book

# ==================== 多线程Worker ====================
def list_worker(list_queue, detail_queue, progress, session_factory):
    """列表页爬取线程"""
    session = session_factory()
    while True:
        try:
            page = list_queue.get_nowait()
        except queue.Empty:
            break
        try:
            if page in progress['list_pages_crawled']:
                logger.info(f"列表页{page}已爬过,跳过")
                continue
            book_ids = crawl_list_page(session, page)
            for bid in book_ids:
                if bid not in progress['detail_crawled']:
                    detail_queue.put(bid)
            progress['list_pages_crawled'].append(page)
            save_progress(progress)
            polite_delay()
        except Exception as e:
            logger.error(f"列表页{page}处理异常: {e}")
        finally:
            list_queue.task_done()

def detail_worker(detail_queue, progress, all_books, session_factory):
    """详情页爬取线程"""
    session = session_factory()
    while True:
        try:
            bid = detail_queue.get(timeout=5)
        except queue.Empty:
            break
        try:
            if bid in progress['detail_crawled']:
                continue
            book = crawl_detail_page(session, bid)
            if book:
                save_book(book, all_books)
                progress['detail_crawled'].append(bid)
                progress['total_books'] = len(all_books)
                save_progress(progress)
            polite_delay()
        except Exception as e:
            logger.error(f"详情页{bid}处理异常: {e}")
        finally:
            detail_queue.task_done()

# ==================== 主函数 ====================
def main(start_page=1, end_page=None, only_extract_links=False, skip_images=False):
    """
    主入口
    :param start_page: 起始页码
    :param end_page: 结束页码(None表示自动探测到最后一页)
    :param only_extract_links: 仅提取下载链接不下载封面
    :param skip_images: 跳过封面下载
    """
    os.makedirs(SAVE_DIR, exist_ok=True)
    os.makedirs(IMAGE_DIR, exist_ok=True)

    logger.info("="*50)
    logger.info("搬书匠全站爬虫启动")
    logger.info(f"数据目录: {os.path.abspath(SAVE_DIR)}")
    logger.info("="*50)

    # 加载进度与已爬数据
    progress = load_progress()
    all_books = load_existing_books()
    logger.info(f"断点续传: 已爬{len(all_books)}本书,已完成{len(progress['list_pages_crawled'])}个列表页")

    session = get_session()

    # 探测总页数
    if end_page is None:
        if progress['total_pages']:
            end_page = progress['total_pages']
            logger.info(f"使用已记录总页数: {end_page}")
        else:
            end_page, first_html = get_max_page(session)
            progress['total_pages'] = end_page
            # 第一页直接解析
            first_page_ids = parse_book_list(first_html)
            save_progress(progress)
    logger.info(f"爬取范围: 第{start_page}页 ~ 第{end_page}页")

    # 构建队列
    list_queue = queue.Queue()
    detail_queue = queue.Queue()

    for p in range(start_page, end_page + 1):
        list_queue.put(p)

    # 启动列表页爬取线程
    list_threads = []
    for i in range(min(THREAD_COUNT, 2)):
        t = threading.Thread(
            target=list_worker,
            args=(list_queue, detail_queue, progress, get_session),
            name=f"List-{i+1}",
            daemon=True
        )
        t.start()
        list_threads.append(t)

    # 等待列表页爬取完成,或者启动详情线程边爬边解析
    # 先启动详情线程
    detail_threads = []
    for i in range(THREAD_COUNT):
        t = threading.Thread(
            target=detail_worker,
            args=(detail_queue, progress, all_books, get_session),
            name=f"Detail-{i+1}",
            daemon=True
        )
        t.start()
        detail_threads.append(t)

    # 等待所有线程完成
    for t in list_threads:
        t.join()
    logger.info("所有列表页爬取完成,等待详情页处理...")

    for t in detail_threads:
        t.join()

    # 最后导出CSV
    books_to_csv()

    logger.info("="*50)
    logger.info(f"爬取完成! 共{len(all_books)}本书")
    logger.info(f"JSON数据: {os.path.abspath(DATA_JSON)}")
    logger.info(f"CSV数据: {os.path.abspath(DATA_CSV)}")
    logger.info(f"封面目录: {os.path.abspath(IMAGE_DIR)}")
    logger.info("="*50)

    # 统计下载链接数
    total_links = sum(len(b.get('download_links', [])) for b in all_books.values())
    logger.info(f"共提取网盘下载链接: {total_links}条")

def print_stats():
    """打印统计信息"""
    if not os.path.exists(DATA_JSON):
        print("暂无数据")
        return
    with open(DATA_JSON, 'r', encoding='utf-8') as f:
        books = json.load(f)
    print(f"\n=== 爬取统计 ===")
    print(f"总书籍数: {len(books)}")
    lang_count = {}
    year_count = {}
    fmt_count = {}
    total_links = 0
    for b in books:
        lang = b.get('language', '未知')
        lang_count[lang] = lang_count.get(lang, 0) + 1
        year = b.get('year', '未知')
        year_count[year] = year_count.get(year, 0) + 1
        for link in b.get('download_links', []):
            total_links += 1
            fmt = link['type']
            fmt_count[fmt] = fmt_count.get(fmt, 0) + 1
    print(f"\n语言分布: {lang_count}")
    print(f"\n文件格式: {fmt_count}")
    print(f"\n下载链接总数: {total_links}")
    print(f"\n数据文件: {os.path.abspath(DATA_JSON)}")

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='搬书匠全站爬虫')
    parser.add_argument('--start', type=int, default=1, help='起始页码')
    parser.add_argument('--end', type=int, default=None, help='结束页码(默认爬全部)')
    parser.add_argument('--threads', type=int, default=3, help='并发线程数')
    parser.add_argument('--no-image', action='store_true', help='不下载封面')
    parser.add_argument('--stats', action='store_true', help='只显示统计信息')
    args = parser.parse_args()

    THREAD_COUNT = args.threads
    if args.stats:
        print_stats()
    else:
        main(start_page=args.start, end_page=args.end, skip_images=args.no_image)
